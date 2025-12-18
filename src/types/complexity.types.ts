/**
 * Complexity Estimation Types
 * Types for task complexity analysis and estimation
 */

import type { TaskComplexity } from '@prisma/client'

/**
 * Factors contributing to complexity score
 */
export interface ComplexityFactors {
  // Keyword-based factors
  scopeIndicators: number // Words like "all", "entire", "every", "refactor"
  techKeywords: number // New technologies, integrations mentioned
  crossCutting: number // Changes affecting multiple areas

  // Task description factors
  descriptionLength: number // Longer descriptions often = more complex
  questionWords: number // Uncertainty indicators

  // Project context factors
  fileTypesDiversity: number // Different file types impacted
  estimatedFilesCount: number // Number of files to modify
}

/**
 * Complexity estimation result
 */
export interface ComplexityEstimation {
  complexity: TaskComplexity
  score: number // 0-100 score
  confidence: number // 0-1 confidence level
  factors: ComplexityFactors
  reasoning: string
  suggestedFilesCount: number
}

/**
 * Estimation configuration
 */
export interface EstimationConfig {
  // Scoring weights
  weights: {
    scopeIndicators: number
    techKeywords: number
    crossCutting: number
    descriptionLength: number
    questionWords: number
    fileTypesDiversity: number
    estimatedFilesCount: number
  }
  // Thresholds for complexity levels
  thresholds: {
    simple: number // Score below this = simple
    moderate: number // Score between simple and this = moderate
    // Above moderate = critical
  }
}

/**
 * Default estimation configuration
 */
export const DEFAULT_ESTIMATION_CONFIG: EstimationConfig = {
  weights: {
    scopeIndicators: 15,
    techKeywords: 10,
    crossCutting: 20,
    descriptionLength: 5,
    questionWords: 10,
    fileTypesDiversity: 15,
    estimatedFilesCount: 25,
  },
  thresholds: {
    simple: 30,
    moderate: 60,
  },
}

/**
 * Keywords and patterns for complexity detection
 */
export const COMPLEXITY_PATTERNS = {
  // High complexity indicators
  scopeIndicators: [
    'all', 'entire', 'every', 'throughout', 'complete', 'full',
    'refactor', 'rewrite', 'migrate', 'replace', 'overhaul',
    'architecture', 'infrastructure', 'system-wide', 'global',
  ],

  // Tech complexity indicators
  techKeywords: [
    'authentication', 'authorization', 'security', 'encryption',
    'database', 'migration', 'api', 'integration', 'webhook',
    'real-time', 'websocket', 'caching', 'performance',
    'microservice', 'queue', 'async', 'concurrent',
  ],

  // Cross-cutting change indicators
  crossCutting: [
    'multiple', 'several', 'various', 'different',
    'across', 'between', 'connect', 'integrate',
    'shared', 'common', 'central', 'core',
  ],

  // Uncertainty indicators (add complexity due to unknowns)
  uncertainty: [
    'maybe', 'possibly', 'unclear', 'investigate',
    'research', 'evaluate', 'consider', 'explore',
    '?', 'tbd', 'todo', 'figure out',
  ],
}
