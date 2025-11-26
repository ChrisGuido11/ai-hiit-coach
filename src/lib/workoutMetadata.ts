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

  // CRITICAL: If mainDurationMinutes is set in the workout object, use that
  // This ensures we always show the MAIN workout duration (excluding warmup/cooldown)
  if (workout.mainDurationMinutes) {
    workoutDuration = workout.mainDurationMinutes.toString();
  }

  switch (frameworkLower) {
    case "tabata":
      return extractTabataMetadata(workout, workoutDuration);
    case "emom":
      return extractEMOMMetadata(workout, workoutDuration);
    case "amrap":
      return extractAMRAPMetadata(workout, workoutDuration);
    case "ladder":
      return extractLadderMetadata(workout, workoutDuration);
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

function extractTabataMetadata(workout: GeneratedWorkout, workoutDuration?: string): WorkoutMetadata {
  // Tabata: 20s work / 10s rest = 30s per round, 8 rounds per exercise
  // Each exercise = 30s × 8 = 240s = 4 minutes per exercise
  
  // CRITICAL: Show ONLY main workout duration (exclude warmup/cooldown)
  // If workoutDuration is provided, use it (for free-text generated workouts)
  if (workoutDuration) {
    const durationMinutes = parseInt(workoutDuration);
    return {
      duration: `${durationMinutes} minutes`,
      rounds: "8 rounds • Tabata"
    };
  }

  // For preset workouts, calculate from exercise count
  const mainExerciseCount = workout.main.length;
  const mainDurationSeconds = mainExerciseCount * 30 * 8; // 30s per round, 8 rounds per exercise
  const mainDurationMinutes = Math.round(mainDurationSeconds / 60);

  return {
    duration: `${mainDurationMinutes} minutes`,
    rounds: "8 rounds • Tabata"
  };
}

function extractEMOMMetadata(workout: GeneratedWorkout, workoutDuration?: string): WorkoutMetadata {
  // EMOM: Every Minute On the Minute
  // Number of rounds = number of minutes (1 round per minute)

  const durationMinutes = workoutDuration ? parseInt(workoutDuration) : 10;
  const duration = `${durationMinutes} minutes`;

  // For EMOM, each minute is 1 round
  const rounds = `${durationMinutes} rounds • EMOM`;

  return { duration, rounds };
}

function extractAMRAPMetadata(workout: GeneratedWorkout, workoutDuration?: string): WorkoutMetadata {
  // AMRAP: As many rounds as possible in the time limit
  // Rounds are unknown ahead of time

  const durationMinutes = workoutDuration ? parseInt(workoutDuration) : 10;
  const duration = `${durationMinutes} minutes`;
  const rounds = "AMRAP circuit";

  return { duration, rounds };
}

function extractLadderMetadata(workout: GeneratedWorkout, workoutDuration?: string): WorkoutMetadata {
  // Ladder: Progressive rep scheme
  // Extract the ladder pattern from the duration string
  // e.g., "Ladder: 1→10 ascending, For Time" → "10 rounds"

  if (workout.main.length === 0) {
    const duration = workoutDuration ? `${workoutDuration} minutes` : "Custom duration";
    return { duration, rounds: "Ladder" };
  }

  const durationStr = workout.main[0].duration;
  const match = durationStr.match(/Ladder:\s*(\d+)→(\d+)(?:→(\d+))?/);

  const durationMinutes = workoutDuration ? parseInt(workoutDuration) : 12;
  const duration = `${durationMinutes} minutes`;

  if (match) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    const third = match[3] ? parseInt(match[3]) : null;

    // For pyramid (1→5→1), count total rounds
    let roundCount;
    if (third !== null) {
      // Pyramid: 1→5→1 = 9 rounds (1,2,3,4,5,4,3,2,1)
      roundCount = (end - start) * 2 + 1;
    } else {
      // Ascending or descending: just the difference + 1
      roundCount = Math.abs(end - start) + 1;
    }

    return {
      duration,
      rounds: `${roundCount} rounds • Ladder`
    };
  }

  return { duration, rounds: "Ladder" };
}

function extractCircuitMetadata(workout: GeneratedWorkout, workoutDuration?: string): WorkoutMetadata {
  // Circuit: Multiple exercises with minimal rest
  // Calculate estimated rounds based on exercise count and duration

  const durationMinutes = workoutDuration ? parseInt(workoutDuration) : 15;
  const duration = `${durationMinutes} minutes`;
  const exerciseCount = workout.main.length;

  // Estimate: If each exercise is ~30-45 seconds, plus transitions
  // Approximate time per round = exerciseCount * 40 seconds
  const secondsPerRound = exerciseCount * 40;
  const estimatedRounds = Math.round((durationMinutes * 60) / secondsPerRound);

  return {
    duration,
    rounds: `${estimatedRounds} rounds • Circuit`
  };
}

function extractHIITMetadata(workout: GeneratedWorkout, workoutDuration?: string): WorkoutMetadata {
  // HIIT: High-intensity intervals
  // Typically 40s work / 20s rest = 60s per exercise

  const durationMinutes = workoutDuration ? parseInt(workoutDuration) : 15;
  const duration = `${durationMinutes} minutes`;
  const exerciseCount = workout.main.length;

  // Estimate rounds: if 60s per exercise, how many complete rounds in duration?
  const secondsPerRound = exerciseCount * 60;
  const estimatedRounds = Math.round((durationMinutes * 60) / secondsPerRound);

  return {
    duration,
    rounds: `${estimatedRounds} rounds • HIIT`
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
