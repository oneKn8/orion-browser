import type { GraderResult } from '../../types'
import type { Grader, GraderInput } from '../types'
import { FaraAlignmentGrader } from './alignment'
import { FaraMultimodalGrader } from './multimodal'
import { FaraRubricGrader } from './rubric'

/**
 * Fara Combined Verifier (3-Verifier System)
 *
 * Based on the Fara paper (Microsoft Research, 2024):
 * "Before using any tasks for training, three verifier agents evaluate if a task
 * was 'successful': The Alignment Verifier checks if the trajectory of actions
 * match the task's intent; the Rubric Verifier defines completion criteria and
 * scores the trajectory against them; and the Multimodal Verifier reviews screenshots
 * and responses to confirm visual evidence supports successful completion."
 *
 * Decision Strategy: Majority Voting
 * - All three verifiers run independently
 * - A trajectory passes if at least 2 of 3 verifiers pass
 * - Combined score is the average of individual scores
 * - Detailed breakdown of each verifier's decision is provided
 *
 * This combined approach addresses different failure modes:
 * - Alignment: catches trajectories that wander off-task
 * - Rubric: catches partial completions via granular scoring
 * - Multimodal: catches hallucinations via visual evidence verification
 */

interface VerifierResult {
  name: string
  pass: boolean
  score: number
  reasoning: string
  details?: Record<string, unknown>
}

export class FaraCombinedGrader implements Grader {
  name = 'fara_combined'
  private alignmentGrader: FaraAlignmentGrader
  private rubricGrader: FaraRubricGrader
  private multimodalGrader: FaraMultimodalGrader
  private runInParallel: boolean

  constructor(
    apiKey: string,
    baseUrl?: string,
    model?: string,
    options?: { parallel?: boolean },
  ) {
    this.alignmentGrader = new FaraAlignmentGrader(
      apiKey,
      baseUrl,
      model || 'gpt-4o-mini',
    )
    this.rubricGrader = new FaraRubricGrader(
      apiKey,
      baseUrl,
      model || 'gpt-4o-mini',
    )
    this.multimodalGrader = new FaraMultimodalGrader(
      apiKey,
      baseUrl,
      model || 'gpt-4o',
    )
    this.runInParallel = options?.parallel ?? true
  }

  async grade(input: GraderInput): Promise<GraderResult> {
    try {
      const verifierResults: VerifierResult[] = []

      if (this.runInParallel) {
        // Run all verifiers in parallel for speed
        const [alignmentResult, rubricResult, multimodalResult] =
          await Promise.all([
            this.runVerifier('alignment', () =>
              this.alignmentGrader.grade(input),
            ),
            this.runVerifier('rubric', () => this.rubricGrader.grade(input)),
            this.runVerifier('multimodal', () =>
              this.multimodalGrader.grade(input),
            ),
          ])

        verifierResults.push(alignmentResult, rubricResult, multimodalResult)
      } else {
        // Run sequentially (useful for debugging or rate limiting)
        verifierResults.push(
          await this.runVerifier('alignment', () =>
            this.alignmentGrader.grade(input),
          ),
        )
        verifierResults.push(
          await this.runVerifier('rubric', () =>
            this.rubricGrader.grade(input),
          ),
        )
        verifierResults.push(
          await this.runVerifier('multimodal', () =>
            this.multimodalGrader.grade(input),
          ),
        )
      }

      // Majority voting: pass if at least 2 of 3 verifiers pass
      const passCount = verifierResults.filter((r) => r.pass).length
      const majorityPass = passCount >= 2

      // Combined score: average of individual scores
      const averageScore =
        verifierResults.reduce((sum, r) => sum + r.score, 0) /
        verifierResults.length

      // Build combined reasoning
      const combinedReasoning = this.formatCombinedReasoning(
        verifierResults,
        majorityPass,
        passCount,
      )

      return {
        score: averageScore,
        pass: majorityPass,
        reasoning: combinedReasoning,
        details: {
          verifier: 'combined',
          votingResult: {
            passCount,
            totalVerifiers: 3,
            majorityThreshold: 2,
            decision: majorityPass ? 'PASS' : 'FAIL',
          },
          verifiers: {
            alignment: {
              pass: verifierResults[0].pass,
              score: verifierResults[0].score,
              details: verifierResults[0].details,
            },
            rubric: {
              pass: verifierResults[1].pass,
              score: verifierResults[1].score,
              details: verifierResults[1].details,
            },
            multimodal: {
              pass: verifierResults[2].pass,
              score: verifierResults[2].score,
              details: verifierResults[2].details,
            },
          },
        },
      }
    } catch (error) {
      return {
        score: 0,
        pass: false,
        reasoning: `Combined verifier error: ${error instanceof Error ? error.message : String(error)}`,
        details: { error: true, verifier: 'combined' },
      }
    }
  }

  private async runVerifier(
    name: string,
    graderFn: () => Promise<GraderResult>,
  ): Promise<VerifierResult> {
    try {
      const result = await graderFn()
      return {
        name,
        pass: result.pass,
        score: result.score,
        reasoning: result.reasoning,
        details: result.details,
      }
    } catch (error) {
      return {
        name,
        pass: false,
        score: 0,
        reasoning: `${name} verifier error: ${error instanceof Error ? error.message : String(error)}`,
        details: { error: true },
      }
    }
  }

  private formatCombinedReasoning(
    results: VerifierResult[],
    majorityPass: boolean,
    passCount: number,
  ): string {
    const lines: string[] = []

    lines.push('# Fara 3-Verifier Combined Evaluation\n')
    lines.push(
      `**Final Decision:** ${majorityPass ? 'PASS' : 'FAIL'} (${passCount}/3 verifiers passed)`,
    )
    lines.push(`**Majority Threshold:** 2/3 verifiers must pass\n`)

    lines.push('---\n')

    // Alignment Verifier Summary
    const alignment = results[0]
    lines.push(`## 1. Alignment Verifier: ${alignment.pass ? 'PASS' : 'FAIL'}`)
    lines.push(`Score: ${alignment.score}`)
    lines.push(`${this.truncateReasoning(alignment.reasoning, 500)}\n`)

    // Rubric Verifier Summary
    const rubric = results[1]
    lines.push(`## 2. Rubric Verifier: ${rubric.pass ? 'PASS' : 'FAIL'}`)
    lines.push(`Score: ${(rubric.score * 100).toFixed(1)}%`)
    if (rubric.details && 'percentage' in rubric.details) {
      lines.push(
        `Rubric Score: ${rubric.details.percentage}% (threshold: ${rubric.details.threshold}%)`,
      )
    }
    lines.push(`${this.truncateReasoning(rubric.reasoning, 500)}\n`)

    // Multimodal Verifier Summary
    const multimodal = results[2]
    lines.push(
      `## 3. Multimodal Verifier: ${multimodal.pass ? 'PASS' : 'FAIL'}`,
    )
    lines.push(`Score: ${multimodal.score}`)
    if (multimodal.details) {
      if ('responseConsistent' in multimodal.details) {
        lines.push(
          `Response Consistent: ${multimodal.details.responseConsistent ? 'Yes' : 'No'}`,
        )
      }
      if ('taskSatisfied' in multimodal.details) {
        lines.push(
          `Task Satisfied: ${multimodal.details.taskSatisfied ? 'Yes' : 'No'}`,
        )
      }
      if ('relevantScreenshots' in multimodal.details) {
        lines.push(
          `Screenshots Analyzed: ${multimodal.details.relevantScreenshots}/${multimodal.details.totalScreenshots}`,
        )
      }
    }
    lines.push(`${this.truncateReasoning(multimodal.reasoning, 500)}\n`)

    lines.push('---\n')
    lines.push('**Voting Summary:**')
    lines.push(`- Alignment: ${alignment.pass ? 'YES' : 'NO'}`)
    lines.push(`- Rubric: ${rubric.pass ? 'YES' : 'NO'}`)
    lines.push(`- Multimodal: ${multimodal.pass ? 'YES' : 'NO'}`)
    lines.push(
      `- **Result: ${majorityPass ? 'MAJORITY PASS' : 'MAJORITY FAIL'}**`,
    )

    return lines.join('\n')
  }

  private truncateReasoning(reasoning: string, maxLength: number): string {
    if (reasoning.length <= maxLength) {
      return reasoning
    }
    return `${reasoning.substring(0, maxLength)}...`
  }
}

/**
 * Factory function to create Fara graders
 */
export function createFaraGrader(
  type: 'alignment' | 'rubric' | 'multimodal' | 'combined',
  apiKey: string,
  baseUrl?: string,
  model?: string,
): Grader {
  switch (type) {
    case 'alignment':
      return new FaraAlignmentGrader(apiKey, baseUrl, model)
    case 'rubric':
      return new FaraRubricGrader(apiKey, baseUrl, model)
    case 'multimodal':
      return new FaraMultimodalGrader(apiKey, baseUrl, model)
    case 'combined':
      return new FaraCombinedGrader(apiKey, baseUrl, model)
    default:
      throw new Error(`Unknown Fara grader type: ${type}`)
  }
}
