/**
 * Parse natural language workout requests into structured parameters
 * Examples:
 * - "10 minutes legs" → {durationMinutes: 10, muscleGroups: ["legs"], ...}
 * - "15-min abs & core beginner" → {durationMinutes: 15, muscleGroups: ["abs", "core"], ...}
 * - "20 min tabata full body" → {durationMinutes: 20, muscleGroups: ["full body"], explicitFramework: "tabata", ...}
 */

export interface ParsedWorkoutRequest {
  durationMinutes: number;
  muscleGroups: string[];
  constraints: string[];
  explicitFramework: string | null;
}

const VALID_FRAMEWORKS = ["tabata", "emom", "amrap", "ladder", "circuit", "hiit"];

const MUSCLE_GROUP_KEYWORDS = {
  legs: ["legs", "leg", "lower body", "quads", "hamstring", "glutes", "calf", "glute"],
  glutes: ["glutes", "glute", "booty", "butt"],
  "abs & core": ["abs", "core", "abdominal", "ab", "abs & core", "abs and core", "core & abs"],
  "upper body": ["upper body", "upper", "chest", "back", "shoulders", "arms", "triceps", "biceps"],
  "full body": ["full body", "full-body", "total body", "total-body", "whole body"],
  cardio: ["cardio", "cardio burn", "cardio blast"],
  back: ["back", "lats", "rhomboid"],
  chest: ["chest", "pecs", "pectoral"],
  shoulders: ["shoulders", "shoulder", "delts"],
  arms: ["arms", "arm", "bicep", "tricep"],
};

const CONSTRAINT_KEYWORDS = {
  "no equipment": ["no equipment", "bodyweight", "no weights", "equipment free"],
  beginner: ["beginner", "easy", "intro"],
  intermediate: ["intermediate", "moderate", "mid-level"],
  advanced: ["advanced", "hard", "challenging", "difficult"],
};

/**
 * Parse a natural language workout request string
 * @param input - User's natural language input (e.g., "10 minutes legs")
 * @returns Structured workout parameters
 */
export function parseWorkoutRequest(input: string): ParsedWorkoutRequest {
  if (!input || typeof input !== "string") {
    return getDefaultRequest();
  }

  const lowerInput = input.toLowerCase().trim();

  // Extract duration
  const durationMinutes = extractDuration(lowerInput);

  // Extract explicit framework (must be said directly by user)
  const explicitFramework = extractExplicitFramework(lowerInput);

  // Extract muscle groups
  const muscleGroups = extractMuscleGroups(lowerInput);

  // Extract constraints
  const constraints = extractConstraints(lowerInput);

  return {
    durationMinutes,
    muscleGroups,
    constraints,
    explicitFramework,
  };
}

/**
 * Extract duration from text like "10 minutes", "10-min", "for 10 mins"
 * Default to 10 minutes if not found
 */
function extractDuration(text: string): number {
  // Match patterns like "10 minutes", "10-min", "10min", "for 10 mins"
  const match = text.match(/(?:for\s+)?(\d+)\s*(?:-)?(?:minutes?|mins?|min)/i);

  if (match && match[1]) {
    return parseInt(match[1], 10);
  }

  // Default to 10 minutes
  return 10;
}

/**
 * Extract explicit framework ONLY if user explicitly mentions it
 * Do NOT assume or default to any framework
 */
function extractExplicitFramework(text: string): string | null {
  for (const framework of VALID_FRAMEWORKS) {
    if (text.includes(framework)) {
      return framework;
    }
  }
  return null;
}

/**
 * Extract muscle group targets from the request
 * Returns canonical muscle group names
 */
function extractMuscleGroups(text: string): string[] {
  const groups: Set<string> = new Set();

  // Check each muscle group category
  for (const [group, keywords] of Object.entries(MUSCLE_GROUP_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        groups.add(group);
        break; // Found this group, move to next
      }
    }
  }

  // If no muscle groups found, return empty array (don't default to anything)
  return Array.from(groups);
}

/**
 * Extract constraints like "beginner", "no equipment", etc.
 */
function extractConstraints(text: string): string[] {
  const constraints: Set<string> = new Set();

  for (const [constraint, keywords] of Object.entries(CONSTRAINT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        constraints.add(constraint);
        break;
      }
    }
  }

  return Array.from(constraints);
}

/**
 * Get default request (all parameters at defaults)
 */
function getDefaultRequest(): ParsedWorkoutRequest {
  return {
    durationMinutes: 10,
    muscleGroups: [],
    constraints: [],
    explicitFramework: null,
  };
}

/**
 * Format parsed request for logging/debugging
 */
export function formatParsedRequest(parsed: ParsedWorkoutRequest): string {
  const parts: string[] = [];

  parts.push(`${parsed.durationMinutes} min`);

  if (parsed.muscleGroups.length > 0) {
    parts.push(`focus: ${parsed.muscleGroups.join(", ")}`);
  }

  if (parsed.explicitFramework) {
    parts.push(`protocol: ${parsed.explicitFramework}`);
  }

  if (parsed.constraints.length > 0) {
    parts.push(`constraints: ${parsed.constraints.join(", ")}`);
  }

  return `[${parts.join(" | ")}]`;
}
