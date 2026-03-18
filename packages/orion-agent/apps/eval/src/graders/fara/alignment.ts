import OpenAI from 'openai'
import {
  countToolCalls,
  type GraderResult,
  isToolInputAvailable,
} from '../../types'
import type { Grader, GraderInput } from '../types'

/**
 * Fara Alignment Verifier
 *
 * Based on the Fara paper (Microsoft Research, 2024):
 * "A text-only verifier designed to judge whether the actions taken and final
 * response of a trajectory aligns with the given task. The purpose of this
 * verifier is to give a high-level judgement of whether the trajectory likely
 * satisfies the intent of the task."
 *
 * For transactional tasks: verifies whether the trajectory correctly identified
 * target URLs matching requested products/services.
 *
 * For information-seeking tasks: checks whether the response correctly answers
 * the input question.
 */

const ALIGNMENT_SYSTEM_PROMPT = `You are an expert evaluator verifying if a web agent's trajectory aligns with the given task intent.

Your role is to provide a high-level judgment of whether the agent's actions and final response satisfy the intent of the task.

**Evaluation Criteria:**

1. **Task Intent Alignment**: Do the actions taken directly address what the task is asking for?

2. **Action Relevance**: Were the actions purposeful and directed toward completing the task?
   - Did the agent navigate to relevant pages?
   - Did it interact with appropriate elements (buttons, forms, links)?
   - Were there unnecessary detours or irrelevant actions?

3. **Response Accuracy** (for information-seeking tasks):
   - Does the final response correctly answer the question asked?
   - Is the information retrieved from the correct source?

4. **Target Completion** (for transactional tasks):
   - Did the agent reach the correct destination (product page, search results, etc.)?
   - Were the correct parameters/filters applied?

**Output Format:**
Provide your analysis, then conclude with a clear verdict.

VERDICT: PASS or FAIL
REASONING: <One sentence summary of your decision>`

export class FaraAlignmentGrader implements Grader {
  name = 'fara_alignment'
  private client: OpenAI
  private model: string
  private maxRetries = 3
  private retryDelayMs = 1000

  constructor(apiKey: string, baseUrl?: string, model?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl || undefined,
    })
    this.model = model || 'gpt-4o-mini'
  }

  async grade(input: GraderInput): Promise<GraderResult> {
    const actionSequence = this.extractActionSequence(input)
    const taskType = this.classifyTaskType(input.task.query)

    const userPrompt = `**Task:** ${input.task.query}

**Task Type:** ${taskType}

**Action Sequence:**
${actionSequence || 'No actions taken'}

**Final Response:** ${input.finalAnswer || '[No response provided]'}

Evaluate whether this trajectory aligns with the task intent and provide your verdict.`

    try {
      const response = await this.callWithRetry(userPrompt)
      const content = response.choices[0]?.message?.content || ''

      const isPass = this.parseVerdict(content)

      return {
        score: isPass ? 1 : 0,
        pass: isPass,
        reasoning: content,
        details: {
          verifier: 'alignment',
          taskType,
          actionCount: countToolCalls(input.messages),
          model: this.model,
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
        },
      }
    } catch (error) {
      return {
        score: 0,
        pass: false,
        reasoning: `Alignment verifier error: ${error instanceof Error ? error.message : String(error)}`,
        details: { error: true, verifier: 'alignment' },
      }
    }
  }

  private extractActionSequence(input: GraderInput): string {
    const actions: string[] = []
    let stepNum = 1

    for (const msg of input.messages) {
      if (isToolInputAvailable(msg)) {
        const paramsStr = this.formatParams(
          msg.input as Record<string, unknown>,
        )
        actions.push(`${stepNum}. ${msg.toolName}(${paramsStr})`)
        stepNum++
      }
    }

    return actions.join('\n')
  }

  private formatParams(params: Record<string, unknown>): string {
    const entries = Object.entries(params)
    if (entries.length === 0) return ''

    return entries
      .map(([key, value]) => {
        const strValue =
          typeof value === 'string'
            ? `"${value.substring(0, 100)}${value.length > 100 ? '...' : ''}"`
            : JSON.stringify(value)
        return `${key}=${strValue}`
      })
      .join(', ')
  }

  private classifyTaskType(query: string): string {
    const lowerQuery = query.toLowerCase()

    const infoKeywords = [
      'find',
      'search',
      'look up',
      'what is',
      'how to',
      'tell me',
      'show me',
      'get information',
      'check',
      'verify',
      'confirm',
      'list',
      'summarize',
      'review',
    ]
    const transactionalKeywords = [
      'buy',
      'purchase',
      'add to cart',
      'book',
      'reserve',
      'order',
      'subscribe',
      'sign up',
      'register',
      'download',
      'submit',
      'apply',
    ]

    for (const keyword of transactionalKeywords) {
      if (lowerQuery.includes(keyword)) {
        return 'transactional'
      }
    }

    for (const keyword of infoKeywords) {
      if (lowerQuery.includes(keyword)) {
        return 'information-seeking'
      }
    }

    return 'general'
  }

  private parseVerdict(content: string): boolean {
    const upperContent = content.toUpperCase()

    if (upperContent.includes('VERDICT: PASS')) {
      return true
    }
    if (upperContent.includes('VERDICT: FAIL')) {
      return false
    }
    if (upperContent.includes('VERDICT:')) {
      const verdictMatch = upperContent.match(/VERDICT:\s*(PASS|FAIL)/)
      if (verdictMatch) {
        return verdictMatch[1] === 'PASS'
      }
    }

    return false
  }

  private async callWithRetry(
    userPrompt: string,
    attempt = 1,
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    try {
      return await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        messages: [
          { role: 'system', content: ALIGNMENT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1000,
      })
    } catch (error) {
      if (attempt < this.maxRetries) {
        const delay = this.retryDelayMs * 2 ** (attempt - 1)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.callWithRetry(userPrompt, attempt + 1)
      }
      throw error
    }
  }
}
