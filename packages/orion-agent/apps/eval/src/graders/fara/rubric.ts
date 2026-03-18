import OpenAI from 'openai'
import { type GraderResult, isToolInputAvailable } from '../../types'
import type { Grader, GraderInput } from '../types'

/**
 * Fara Rubric Verifier
 *
 * Based on the Fara paper (Microsoft Research, 2024):
 * "The Rubric Verifier generates a rubric for each task and judges the
 * corresponding trajectory against the rubric, crediting points for partial
 * completion of various sub-goals. Each rubric is expressed as a list of
 * criteria that a trajectory would likely need to meet in order to be successful."
 *
 * Two-step process:
 * 1. Generate task-specific rubric with criteria and point values
 * 2. Score trajectory against rubric, calculating proportion of points satisfied
 *
 * Uses threshold of 0.8 - trajectories scoring above this are marked successful.
 */

const RUBRIC_GENERATION_PROMPT = `You are an expert evaluator creating a rubric for assessing web agent task completion.

Given a task, generate a detailed rubric with specific, measurable criteria that a web agent would need to satisfy to successfully complete the task.

**Instructions:**
1. Break down the task into discrete, verifiable sub-goals
2. Assign point values based on importance (total should sum to 100)
3. Make criteria specific and observable from the action sequence
4. Include both process criteria (correct navigation, interactions) and outcome criteria (final result)

**Output Format:**
Return a JSON object with the following structure:
{
  "criteria": [
    {
      "id": 1,
      "description": "Description of criterion",
      "points": <number>,
      "required": <boolean>
    }
  ],
  "total_points": 100
}

**Guidelines:**
- Mark criteria as "required": true if failure means the task cannot be successful
- Include 4-8 criteria for most tasks
- Ensure criteria are observable from action sequence and final response
- Consider edge cases and partial completions`

const RUBRIC_SCORING_PROMPT = `You are an expert evaluator scoring a web agent's trajectory against a rubric.

**Instructions:**
1. Carefully review each criterion in the rubric
2. Determine if the agent's actions and response satisfy each criterion
3. Award full points, partial points (if applicable), or zero points for each criterion
4. Provide clear justification for each score

**Output Format:**
Return a JSON object with the following structure:
{
  "scores": [
    {
      "criterion_id": <number>,
      "points_earned": <number>,
      "max_points": <number>,
      "satisfied": <boolean>,
      "justification": "Brief explanation"
    }
  ],
  "total_earned": <number>,
  "total_possible": <number>,
  "percentage": <number>,
  "required_criteria_met": <boolean>,
  "summary": "Overall assessment summary"
}`

interface RubricCriterion {
  id: number
  description: string
  points: number
  required: boolean
}

interface RubricScore {
  criterion_id: number
  points_earned: number
  max_points: number
  satisfied: boolean
  justification: string
}

interface Rubric {
  criteria: RubricCriterion[]
  total_points: number
}

interface ScoringResult {
  scores: RubricScore[]
  total_earned: number
  total_possible: number
  percentage: number
  required_criteria_met: boolean
  summary: string
}

export class FaraRubricGrader implements Grader {
  name = 'fara_rubric'
  private client: OpenAI
  private model: string
  private passThreshold = 0.8
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
    try {
      // Step 1: Generate rubric for the task
      const rubric = await this.generateRubric(input.task.query)

      // Step 2: Score trajectory against rubric
      const actionSequence = this.extractActionSequence(input)
      const scoringResult = await this.scoreAgainstRubric(
        input.task.query,
        rubric,
        actionSequence,
        input.finalAnswer,
      )

      const score = scoringResult.percentage / 100
      const isPass =
        score >= this.passThreshold && scoringResult.required_criteria_met

      return {
        score,
        pass: isPass,
        reasoning: this.formatReasoning(rubric, scoringResult),
        details: {
          verifier: 'rubric',
          rubric: rubric.criteria,
          scores: scoringResult.scores,
          totalEarned: scoringResult.total_earned,
          totalPossible: scoringResult.total_possible,
          percentage: scoringResult.percentage,
          threshold: this.passThreshold * 100,
          requiredCriteriaMet: scoringResult.required_criteria_met,
          model: this.model,
        },
      }
    } catch (error) {
      return {
        score: 0,
        pass: false,
        reasoning: `Rubric verifier error: ${error instanceof Error ? error.message : String(error)}`,
        details: { error: true, verifier: 'rubric' },
      }
    }
  }

  private async generateRubric(task: string): Promise<Rubric> {
    const response = await this.callWithRetry([
      { role: 'system', content: RUBRIC_GENERATION_PROMPT },
      {
        role: 'user',
        content: `Generate a rubric for evaluating this web task:\n\n${task}`,
      },
    ])

    const content = response.choices[0]?.message?.content || ''
    return this.parseRubric(content)
  }

  private async scoreAgainstRubric(
    task: string,
    rubric: Rubric,
    actionSequence: string,
    finalAnswer: string | null,
  ): Promise<ScoringResult> {
    const rubricJson = JSON.stringify(rubric, null, 2)

    const userPrompt = `**Task:** ${task}

**Rubric:**
${rubricJson}

**Agent Action Sequence:**
${actionSequence || 'No actions taken'}

**Final Response:** ${finalAnswer || '[No response provided]'}

Score this trajectory against each criterion in the rubric.`

    const response = await this.callWithRetry([
      { role: 'system', content: RUBRIC_SCORING_PROMPT },
      { role: 'user', content: userPrompt },
    ])

    const content = response.choices[0]?.message?.content || ''
    return this.parseScoringResult(content, rubric)
  }

  private parseRubric(content: string): Rubric {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (
          parsed.criteria &&
          Array.isArray(parsed.criteria) &&
          parsed.criteria.length > 0
        ) {
          return {
            criteria: parsed.criteria.map(
              (c: Partial<RubricCriterion>, idx: number) => ({
                id: c.id ?? idx + 1,
                description: c.description ?? `Criterion ${idx + 1}`,
                points: c.points ?? 25,
                required: c.required ?? false,
              }),
            ),
            total_points:
              parsed.total_points ||
              parsed.criteria.reduce(
                (sum: number, c: Partial<RubricCriterion>) =>
                  sum + (c.points ?? 25),
                0,
              ),
          }
        }
      }
    } catch {
      // Fall through to default rubric
    }

    return this.getDefaultRubric()
  }

  private getDefaultRubric(): Rubric {
    return {
      criteria: [
        {
          id: 1,
          description: 'Agent navigated to relevant pages for the task',
          points: 25,
          required: true,
        },
        {
          id: 2,
          description: 'Agent performed correct interactions (clicks, inputs)',
          points: 25,
          required: false,
        },
        {
          id: 3,
          description: 'Agent reached the target state or information',
          points: 30,
          required: true,
        },
        {
          id: 4,
          description: 'Final response accurately addresses the task',
          points: 20,
          required: false,
        },
      ],
      total_points: 100,
    }
  }

  private parseScoringResult(content: string, rubric: Rubric): ScoringResult {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.scores && Array.isArray(parsed.scores)) {
          const totalEarned =
            parsed.total_earned ??
            parsed.scores.reduce(
              (sum: number, s: Partial<RubricScore>) =>
                sum + (s.points_earned ?? 0),
              0,
            )
          const totalPossible =
            parsed.total_possible ??
            rubric.total_points ??
            parsed.scores.reduce(
              (sum: number, s: Partial<RubricScore>) =>
                sum + (s.max_points ?? 0),
              0,
            )

          const requiredCriteriaMet =
            parsed.required_criteria_met ??
            this.checkRequiredCriteria(parsed.scores, rubric)

          return {
            scores: parsed.scores.map(
              (s: Partial<RubricScore>, idx: number) => ({
                criterion_id: s.criterion_id ?? idx + 1,
                points_earned: s.points_earned ?? 0,
                max_points: s.max_points ?? 25,
                satisfied: s.satisfied ?? false,
                justification: s.justification ?? 'No justification provided',
              }),
            ),
            total_earned: totalEarned,
            total_possible: totalPossible,
            percentage:
              parsed.percentage ??
              (totalPossible > 0
                ? Math.round((totalEarned / totalPossible) * 100)
                : 0),
            required_criteria_met: requiredCriteriaMet,
            summary: parsed.summary ?? 'Scoring completed',
          }
        }
      }
    } catch {
      // Fall through to default scoring
    }

    return this.getDefaultScoringResult(rubric)
  }

  private checkRequiredCriteria(
    scores: Partial<RubricScore>[],
    rubric: Rubric,
  ): boolean {
    const requiredIds = rubric.criteria
      .filter((c) => c.required)
      .map((c) => c.id)

    for (const reqId of requiredIds) {
      const score = scores.find((s) => s.criterion_id === reqId)
      if (!score || !score.satisfied) {
        return false
      }
    }
    return true
  }

  private getDefaultScoringResult(rubric: Rubric): ScoringResult {
    return {
      scores: rubric.criteria.map((c) => ({
        criterion_id: c.id,
        points_earned: 0,
        max_points: c.points,
        satisfied: false,
        justification: 'Unable to evaluate',
      })),
      total_earned: 0,
      total_possible: rubric.total_points,
      percentage: 0,
      required_criteria_met: false,
      summary: 'Unable to parse scoring result',
    }
  }

  private formatReasoning(rubric: Rubric, result: ScoringResult): string {
    const lines: string[] = []

    lines.push('**Rubric Evaluation**\n')
    lines.push(
      `Score: ${result.total_earned}/${result.total_possible} (${result.percentage}%)`,
    )
    lines.push(`Threshold: ${this.passThreshold * 100}%`)
    lines.push(
      `Required Criteria Met: ${result.required_criteria_met ? 'Yes' : 'No'}\n`,
    )

    lines.push('**Criteria Scores:**')
    for (const score of result.scores) {
      const criterion = rubric.criteria.find((c) => c.id === score.criterion_id)
      const status = score.satisfied ? 'PASS' : 'FAIL'
      const required = criterion?.required ? ' [REQUIRED]' : ''
      lines.push(
        `- ${criterion?.description ?? `Criterion ${score.criterion_id}`}${required}: ${score.points_earned}/${score.max_points} (${status})`,
      )
      lines.push(`  Justification: ${score.justification}`)
    }

    lines.push(`\n**Summary:** ${result.summary}`)

    return lines.join('\n')
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

  private async callWithRetry(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    attempt = 1,
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    try {
      return await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        messages,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      })
    } catch (error) {
      if (attempt < this.maxRetries) {
        const delay = this.retryDelayMs * 2 ** (attempt - 1)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.callWithRetry(messages, attempt + 1)
      }
      throw error
    }
  }
}
