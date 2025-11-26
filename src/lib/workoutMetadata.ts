import { GeneratedWorkout } from "./generateWorkout";

interface WorkoutMetadata {
  duration: string;
  rounds: string;
}

/**
 * Extract total workout duration and rounds information from the generated workout
 * Returns formatted strings ready for display, e.g., "20 minutes" and "8 rounds"
 */
export function extractWorkoutMetadata(
  workout: GeneratedWorkout,
  framework: string,
  workoutDuration?: string
): WorkoutMetadata {
  const frameworkLower = framework?.toLowerCase() || "custom";

  switch (frameworkLower) {
    case "tabata":
      return extractTabataMetadata(workout);
    case "emom":
      return extractEMOMMetadata(workout, workoutDuration);
    case "amrap":
      return extractAMRAPMetadata(workout, workoutDuration);
    case "ladder":
      return extractLadderMetadata(workout);
    case "circuit":
      return extractCircuitMetadata(workout, workoutDuration);
    case "hiit":
      return extractHIITMetadata(workout, workoutDuration);
    default:
      // For custom or unknown frameworks, use the workout duration
      const duration = workoutDuration ? `${workoutDuration} minutes` : "Custom duration";
      return { duration, rounds: "reps-based" };
  }
}

function extractTabataMetadata(workout: GeneratedWorkout): WorkoutMetadata {
  // Tabata: 20s work / 10s rest = 30s per round, 8 rounds per exercise
  // Each exercise = 30s × 8 = 240s = 4 minutes per exercise
  // Plus warmup and cooldown (approximate each as ~90s-120s)

  const mainExerciseCount = workout.main.length;
  const mainDuration = mainExerciseCount * 30 * 8; // 30s per round, 8 rounds per exercise

  // Estimate warmup duration (sum of exercise durations)
  let warmupDuration = 0;
  for (const ex of workout.warmup) {
    warmupDuration += estimateExerciseDuration(ex.duration);
  }

  // Estimate cooldown duration
  let cooldownDuration = 0;
  for (const ex of workout.cooldown) {
    cooldownDuration += estimateExerciseDuration(ex.duration);
  }

  const totalSeconds = warmupDuration + mainDuration + cooldownDuration;
  const totalMinutes = Math.round(totalSeconds / 60);

  return {
    duration: `${totalMinutes} minutes`,
    rounds: "8 rounds (Tabata)"
  };
}

function extractEMOMMetadata(workout: GeneratedWorkout, workoutDuration?: string): WorkoutMetadata {
  // EMOM: Complete reps at start of each minute, repeat for duration
  // Each exercise is typically 10 reps or similar
  // Display duration and reps-based structure

  const duration = workoutDuration ? `${workoutDuration} minutes` : "Custom duration";
  const exerciseCount = workout.main.length;

  return {
    duration,
    rounds: `${exerciseCount}-exercise circuit (EMOM)`
  };
}

function extractAMRAPMetadata(workout: GeneratedWorkout, workoutDuration?: string): WorkoutMetadata {
  // AMRAP: As many rounds as possible in the time limit
  // The actual duration comes from user preferences

  const duration = workoutDuration ? `${workoutDuration} minutes` : "Custom duration";
  const exerciseCount = workout.main.length;

  return {
    duration,
    rounds: `${exerciseCount}-exercise circuit (AMRAP)`
  };
}

function extractLadderMetadata(workout: GeneratedWorkout): WorkoutMetadata {
  // Ladder: Progressive rep scheme
  // Extract the ladder pattern from the duration string
  // e.g., "Ladder: 1→10 ascending, For Time" → "10 rounds"

  if (workout.main.length === 0) {
    return { duration: "Custom duration", rounds: "Ladder" };
  }

  const durationStr = workout.main[0].duration;
  const match = durationStr.match(/Ladder:\s*(\d+)→(\d+)/);

  if (match) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    const rounds = end - start + 1;

    return {
      duration: "Custom duration",
      rounds: `${rounds} rounds (Ladder)`
    };
  }

  return { duration: "Custom duration", rounds: "Ladder" };
}

function extractCircuitMetadata(workout: GeneratedWorkout, workoutDuration?: string): WorkoutMetadata {
  // Circuit: Multiple exercises with minimal rest
  const duration = workoutDuration ? `${workoutDuration} minutes` : "Custom duration";
  const exerciseCount = workout.main.length;

  return {
    duration,
    rounds: `${exerciseCount}-exercise circuit`
  };
}

function extractHIITMetadata(workout: GeneratedWorkout, workoutDuration?: string): WorkoutMetadata {
  // HIIT: High-intensity intervals
  const duration = workoutDuration ? `${workoutDuration} minutes` : "Custom duration";
  const exerciseCount = workout.main.length;

  return {
    duration,
    rounds: `${exerciseCount}-exercise HIIT`
  };
}

/**
 * Helper function to estimate duration of an exercise from its duration string
 * e.g., "60 seconds" → 60, "30 seconds each leg" → 60, "30 seconds each direction" → 60
 */
function estimateExerciseDuration(durationStr: string): number {
  // Try to extract numeric value
  const match = durationStr.match(/(\d+)\s*(?:seconds?|minutes?|s|m)/i);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[0].match(/m/i) ? 60 : 1; // Convert minutes to seconds

    let duration = value * unit;

    // Check if it's "each leg", "each side", "each direction" etc.
    if (/each\s+(?:leg|side|direction|arm)/i.test(durationStr)) {
      duration *= 2;
    }

    return duration;
  }

  // Default to 30 seconds if we can't parse
  return 30;
}
