import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import OpenAI from 'openai'
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions'
import { type GraderResult, isToolInputAvailable } from '../../types'
import type { Grader, GraderInput } from '../types'

/**
 * Mind2Web WebJudge Grader - 3-step automatic evaluation
 * Reference: https://github.com/OSU-NLP-Group/Online-Mind2Web/tree/main/src/methods
 *
 * Steps:
 * 1. Key Point Identification - Extract critical requirements from task
 * 2. Key Screenshot Identification - Score screenshots for relevance (1-5)
 * 3. Outcome Judgment - Final success/failure determination
 */

// ============================================================================
// Prompts (Exact from Online-Mind2Web repository)
// ============================================================================

const STEP1_KEY_POINTS_SYSTEM = `You are an expert tasked with analyzing a given task to identify the key points explicitly stated in the task description.

**Objective**: Carefully analyze the task description and extract the critical elements explicitly mentioned in the task for achieving its goal.

**Instructions**:
1. Read the task description carefully.
2. Identify and extract **key points** directly stated in the task description.
   - A **key point** is a critical element, condition, or step explicitly mentioned in the task description.
   - Do not infer or add any unstated elements.
   - Words such as "best," "highest," "cheapest," "latest," "most recent," "lowest," "closest," "highest-rated," "largest," and "newest" must go through the sort function(e.g., the key point should be "Filter by highest").

**Respond with**:
- **Key Points**: A numbered list of the explicit key points for completing this task, one per line, without explanations or additional details.`

const STEP2_IMAGE_SCORING_SYSTEM = `You are an expert evaluator tasked with determining whether an image contains information about the necessary steps to complete a task.

**Objective**: Analyze the provided image and decide if it shows essential steps or evidence required for completing the task. Use your reasoning to explain your decision before assigning a score.

**Instructions**:
1. Provide a detailed description of the image, including its contents, visible elements, text (if any), and any notable features.

2. Carefully examine the image and evaluate whether it contains necessary steps or evidence crucial to task completion:
- Identify key points that could be relevant to task completion, such as actions, progress indicators, tool usage, applied filters, or step-by-step instructions.
- Does the image show actions, progress indicators, or critical information directly related to completing the task?
- Is this information indispensable for understanding or ensuring task success?
- If the image contains partial but relevant information, consider its usefulness rather than dismissing it outright.

3. Provide your response in the following format:
- **Reasoning**: Explain your thought process and observations. Mention specific elements in the image that indicate necessary steps, evidence, or lack thereof.
- **Score**: Assign a score based on the reasoning, using the following scale:
    - **1**: The image does not contain any necessary steps or relevant information.
    - **2**: The image contains minimal or ambiguous information, unlikely to be essential.
    - **3**: The image includes some relevant steps or hints but lacks clarity or completeness.
    - **4**: The image contains important steps or evidence that are highly relevant but not fully comprehensive.
    - **5**: The image clearly displays necessary steps or evidence crucial for completing the task.

Respond with:
1. **Reasoning**: [Your explanation]
2. **Score**: [1-5]`

const STEP3_OUTCOME_SYSTEM = `You are an expert in evaluating the performance of a web navigation agent. The agent is designed to help a human user navigate a website to complete a task. Given the user's task, the agent's action history, key points for task completion, some potentially important web pages in the agent's trajectory and their reasons, your goal is to determine whether the agent has completed the task and achieved all requirements.

Your response must strictly follow the following evaluation criteria!
*Important Evaluation Criteria*:
1: The filtered results must be displayed correctly. If filters were not properly applied (i.e., missing selection, missing confirmation, or no visible effect in results), the task is not considered successful.
2: You must carefully check whether these snapshots and action history meet these key points. Ensure that specific filter conditions, such as "best," "highest," "cheapest," "latest," "most recent," "lowest," "closest," "highest-rated," "largest," and "newest" are correctly applied using the filter function(e.g., sort function).
3: Certain key points or requirements should be applied by the filter. Otherwise, a search with all requirements as input will be deemed a failure since it cannot guarantee that all results meet the requirements!
4: If the task requires filtering by a specific range of money, years, or the number of beds and bathrooms, the applied filter must exactly match the given requirement. Any deviation results in failure. To ensure the task is successful, the applied filter must precisely match the specified range without being too broad or too narrow.
Examples of Failure Cases:
- If the requirement is less than $50, but the applied filter is less than $25, it is a failure.
- If the requirement is $1500-$2500, but the applied filter is $2000-$2500, it is a failure.
- If the requirement is $25-$200, but the applied filter is $0-$200, it is a failure.
- If the required years are 2004-2012, but the filter applied is 2001-2012, it is a failure.
- If the required years are before 2015, but the applied filter is 2000-2014, it is a failure.
- If the task requires exactly 2 beds, but the filter applied is 2+ beds, it is a failure.
5: Some tasks require a submission action or a display of results to be considered successful.
6: If the retrieved information is invalid or empty(e.g., No match was found), but the agent has correctly performed the required action, it should still be considered successful.
7: If the current page already displays all available items, then applying a filter is not necessary. As long as the agent selects items that meet the requirements (e.g., the cheapest or lowest price), the task is still considered successful.

*IMPORTANT*
Format your response into two lines as shown below:

Thoughts: <your thoughts and reasoning process based on double-checking each key points and the evaluation criteria>
Status: "success" or "failure"`

// ============================================================================
// Mind2Web WebJudge Grader Implementation
// ============================================================================

export class Mind2WebJudgeGrader implements Grader {
  name = 'mind2web_judge'
  private client: OpenAI
  private model: string
  private scoreThreshold = 3
  private maxImages = 50

  constructor(apiKey: string, baseURL?: string, model?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || undefined,
    })
    this.model = model || 'gpt-4o'
  }

  async grade(input: GraderInput): Promise<GraderResult> {
    try {
      // Step 1: Identify key points from task
      const keyPoints = await this.identifyKeyPoints(input.task.query)

      // Step 2: Score screenshots and filter relevant ones
      const screenshotResults = await this.scoreScreenshots(
        input.task.query,
        keyPoints,
        input.outputDir,
        input.screenshotCount,
      )

      // Step 3: Final outcome judgment
      const actionHistory = this.extractActionHistory(input.messages)
      const outcome = await this.judgeOutcome(
        input.task.query,
        keyPoints,
        actionHistory,
        screenshotResults.relevantImages,
        screenshotResults.thoughts,
      )

      return {
        score: outcome.success ? 1 : 0,
        pass: outcome.success,
        reasoning: outcome.reasoning,
        details: {
          keyPoints,
          screenshotsEvaluated: screenshotResults.totalEvaluated,
          screenshotsRelevant: screenshotResults.relevantImages.length,
          model: this.model,
        },
      }
    } catch (error) {
      return {
        score: 0,
        pass: false,
        reasoning: `Grader error: ${error instanceof Error ? error.message : String(error)}`,
        details: { error: true },
      }
    }
  }

  /**
   * Step 1: Key Point Identification
   */
  private async identifyKeyPoints(task: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: 'system', content: STEP1_KEY_POINTS_SYSTEM },
        { role: 'user', content: `Task: ${task}` },
      ],
      max_tokens: 512,
    })

    const content = response.choices[0]?.message?.content || ''

    // Extract key points section
    if (content.includes('**Key Points**:')) {
      return content.split('**Key Points**:')[1].trim()
    }
    if (content.includes('Key Points:')) {
      return content.split('Key Points:')[1].trim()
    }

    return content
  }

  /**
   * Step 2: Key Screenshot Identification
   */
  private async scoreScreenshots(
    task: string,
    keyPoints: string,
    outputDir: string,
    screenshotCount: number,
  ): Promise<{
    relevantImages: { data: string; score: number }[]
    thoughts: string[]
    totalEvaluated: number
  }> {
    const relevantImages: { data: string; score: number }[] = []
    const thoughts: string[] = []
    let totalEvaluated = 0

    // Evaluate each screenshot
    for (let i = 1; i <= screenshotCount; i++) {
      try {
        const filepath = join(outputDir, 'screenshots', `${i}.png`)
        const buffer = await readFile(filepath)
        const base64 = buffer.toString('base64')
        const imageUrl = `data:image/png;base64,${base64}`

        totalEvaluated++

        // Score this image
        const response = await this.client.chat.completions.create({
          model: this.model,
          temperature: 0,
          messages: [
            { role: 'system', content: STEP2_IMAGE_SCORING_SYSTEM },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `**Task**: ${task}\n\n**Key Points for Task Completion**: ${keyPoints}\n\nThe snapshot of the web page is shown in the image.`,
                },
                {
                  type: 'image_url',
                  image_url: { url: imageUrl, detail: 'high' },
                },
              ],
            },
          ],
          max_tokens: 512,
        })

        const content = response.choices[0]?.message?.content || ''

        // Extract score
        const scoreMatch = content.match(/Score[:\s]*\**\s*([1-5])/i)
        const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 1

        // Extract reasoning/thought
        const thoughtMatch = content.match(
          /\*\*Reasoning\*\*:?\s*([\s\S]*?)(?=\n\n|\*\*Score|$)/i,
        )
        const thought = thoughtMatch
          ? thoughtMatch[1].trim().replace(/\n/g, ' ')
          : content.split('\n')[0]

        // Keep if above threshold
        if (score >= this.scoreThreshold) {
          relevantImages.push({ data: imageUrl, score })
          thoughts.push(`Screenshot ${i} (score ${score}): ${thought}`)
        }
      } catch {
        // Skip missing files
      }
    }

    // Limit to max images
    if (relevantImages.length > this.maxImages) {
      relevantImages.splice(0, relevantImages.length - this.maxImages)
      thoughts.splice(0, thoughts.length - this.maxImages)
    }

    return { relevantImages, thoughts, totalEvaluated }
  }

  /**
   * Step 3: Outcome Judgment
   */
  private async judgeOutcome(
    task: string,
    keyPoints: string,
    actionHistory: string[],
    relevantImages: { data: string; score: number }[],
    thoughts: string[],
  ): Promise<{ success: boolean; reasoning: string }> {
    // Format action history
    const actionsFormatted = actionHistory
      .map((action, i) => `${i + 1}. ${action}`)
      .join('\n')

    // Format thoughts
    const thoughtsFormatted = thoughts
      .map((thought, i) => `${i + 1}. ${thought}`)
      .join('\n')

    // Build message content
    const messageContent: ChatCompletionContentPart[] = []

    if (relevantImages.length > 0) {
      messageContent.push({
        type: 'text',
        text: `User Task: ${task}

Key Points: ${keyPoints}

Action History:
${actionsFormatted || 'No actions recorded'}

The potentially important snapshots of the webpage in the agent's trajectory and their reasons:
${thoughtsFormatted || 'No relevant screenshots identified'}`,
      })

      // Add images
      for (const img of relevantImages) {
        messageContent.push({
          type: 'image_url',
          image_url: { url: img.data, detail: 'high' as const },
        })
      }
    } else {
      // No images - text only
      messageContent.push({
        type: 'text',
        text: `User Task: ${task}

Key Points: ${keyPoints}

Action History:
${actionsFormatted || 'No actions recorded'}`,
      })
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: 'system', content: STEP3_OUTCOME_SYSTEM },
        { role: 'user', content: messageContent },
      ],
      max_tokens: 1000,
    })

    const content = response.choices[0]?.message?.content || ''

    const statusMatch = content.match(/Status:\s*"?(success|failure)"?/i)
    const isSuccess = statusMatch
      ? statusMatch[1].toLowerCase() === 'success'
      : false

    return {
      success: isSuccess,
      reasoning: content,
    }
  }

  /**
   * Extract action history from messages
   */
  private extractActionHistory(messages: GraderInput['messages']): string[] {
    const actions: string[] = []

    for (const msg of messages) {
      if (isToolInputAvailable(msg)) {
        const params = JSON.stringify(msg.input as Record<string, unknown>)
        actions.push(`${msg.toolName}(${params})`)
      }
    }

    return actions
  }
}
