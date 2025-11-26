import { supabase } from "@/integrations/supabase/client";

// Types for workout structure
export interface Exercise {
  name: string;
  duration: string;
  instructions: string;
}

export interface GeneratedWorkout {
  warmup: Exercise[];
  main: Exercise[];
  cooldown: Exercise[];
}

export interface GenerateWorkoutParams {
  framework: string;
  goal?: string;
  fitnessLevel: string;
  equipment: string[];
  duration: string;
}

// Fallback workouts for each framework (with correct duration formats and concise instructions)
const fallbackWorkouts: Record<string, GeneratedWorkout> = {
  tabata: {
    warmup: [
      { name: "Jumping Jacks", duration: "60 seconds", instructions: "Jump feet wide while raising arms overhead, return to start" },
      { name: "Arm Circles", duration: "30 seconds each direction", instructions: "Extend arms and rotate in controlled circular motions" },
      { name: "High Knees", duration: "45 seconds", instructions: "Drive knees to hip height while pumping arms" }
    ],
    main: [
      { name: "Burpees", duration: "20s work / 10s rest", instructions: "Drop to plank, perform push-up, jump feet forward, explode up" },
      { name: "Mountain Climbers", duration: "20s work / 10s rest", instructions: "Hold plank position, rapidly alternate driving knees to chest" },
      { name: "Jump Squats", duration: "20s work / 10s rest", instructions: "Lower into squat, explode upward, land softly with bent knees" },
      { name: "High Knees", duration: "20s work / 10s rest", instructions: "Run in place bringing knees to hip height, pump arms vigorously" }
    ],
    cooldown: [
      { name: "Standing Forward Fold", duration: "45 seconds", instructions: "Hinge at hips, let head hang, relax into the stretch" },
      { name: "Quad Stretch", duration: "30 seconds each leg", instructions: "Stand on one leg, pull heel to glutes, keep knees together" },
      { name: "Child's Pose", duration: "60 seconds", instructions: "Kneel and sit back on heels, extend arms forward on floor" }
    ]
  },
  emom: {
    warmup: [
      { name: "Light Jog in Place", duration: "60 seconds", instructions: "Easy pace jog to gradually elevate heart rate" },
      { name: "Leg Swings", duration: "30 seconds each leg", instructions: "Swing leg forward and back, hold wall for balance" },
      { name: "Arm Swings", duration: "30 seconds", instructions: "Swing arms across body dynamically to loosen shoulders" }
    ],
    main: [
      { name: "Push-ups", duration: "10 reps", instructions: "Lower chest to floor, push up with full arm extension" },
      { name: "Air Squats", duration: "15 reps", instructions: "Sit back and down past parallel, weight in heels, chest up" },
      { name: "Sit-ups", duration: "12 reps", instructions: "Lie flat, engage core, curl up to touch toes" },
      { name: "Lunges", duration: "10 reps", instructions: "Step forward into lunge, both knees at 90 degrees, alternate legs" }
    ],
    cooldown: [
      { name: "Pigeon Pose", duration: "45 seconds each side", instructions: "Bring knee forward, extend back leg, fold forward over front leg" },
      { name: "Seated Spinal Twist", duration: "30 seconds each side", instructions: "Sit tall, cross one leg over, rotate torso toward bent knee" },
      { name: "Lying Hamstring Stretch", duration: "45 seconds each leg", instructions: "On back, extend leg up, gently pull toward chest" }
    ]
  },
  amrap: {
    warmup: [
      { name: "Jumping Jacks", duration: "45 seconds", instructions: "Jump feet wide while swinging arms overhead" },
      { name: "Bodyweight Good Mornings", duration: "30 seconds", instructions: "Hands behind head, hinge at hips keeping back flat" },
      { name: "Inchworms", duration: "45 seconds", instructions: "Fold forward, walk hands to plank, walk feet back to hands" }
    ],
    main: [
      { name: "Burpees", duration: "5 reps", instructions: "Drop to plank with push-up, jump feet forward, explode up" },
      { name: "Air Squats", duration: "10 reps", instructions: "Sit back past parallel, drive through heels to stand" },
      { name: "Push-ups", duration: "10 reps", instructions: "Lower chest to floor, maintain rigid plank throughout" },
      { name: "Sit-ups", duration: "15 reps", instructions: "Engage core, curl up fully, control the descent" },
      { name: "Jumping Lunges", duration: "10 reps", instructions: "Lunge position, jump and switch legs mid-air, land softly" }
    ],
    cooldown: [
      { name: "Cat-Cow Stretch", duration: "60 seconds", instructions: "On all fours, alternate between arching and rounding spine" },
      { name: "Figure Four Stretch", duration: "45 seconds each side", instructions: "On back, cross ankle over knee, pull thigh toward chest" },
      { name: "Chest Opener", duration: "45 seconds", instructions: "Clasp hands behind back, lift chest, squeeze shoulder blades" }
    ]
  },
  ladder: {
    warmup: [
      { name: "Arm Circles", duration: "30 seconds each direction", instructions: "Extend arms and rotate in controlled circular motions" },
      { name: "Leg Swings", duration: "30 seconds each leg", instructions: "Swing leg forward and back, hold wall for balance" },
      { name: "Jumping Jacks", duration: "45 seconds", instructions: "Jump feet wide while swinging arms overhead" }
    ],
    main: [
      { name: "Push-ups", duration: "Ladder: 1→10 ascending, For Time", instructions: "Lower chest to floor, push up with full arm extension" },
      { name: "Squats", duration: "Ladder: 1→10 ascending, For Time", instructions: "Feet shoulder-width apart, squat down until thighs parallel to ground" }
    ],
    cooldown: [
      { name: "Child's Pose", duration: "60 seconds", instructions: "Kneel and sit back on heels, extend arms forward on floor" },
      { name: "Quad Stretch", duration: "30 seconds each leg", instructions: "Stand on one leg, pull heel to glutes, keep knees together" },
      { name: "Hamstring Stretch", duration: "30 seconds each leg", instructions: "Sit with legs extended, reach forward toward toes" }
    ]
  },
  custom: {
    warmup: [
      { name: "Light Cardio", duration: "60 seconds", instructions: "Jog in place or perform jumping jacks at easy pace" },
      { name: "Dynamic Stretching", duration: "60 seconds", instructions: "Perform leg swings, arm circles, and torso twists" }
    ],
    main: [
      { name: "Squats", duration: "45 seconds", instructions: "Lower hips back and down, keep weight in heels" },
      { name: "Push-ups", duration: "45 seconds", instructions: "Lower chest to floor, maintain straight body alignment" },
      { name: "Lunges", duration: "45 seconds", instructions: "Step forward into lunge, alternate legs with control" },
      { name: "Plank", duration: "45 seconds", instructions: "Hold rigid plank position, engage core throughout" }
    ],
    cooldown: [
      { name: "Full Body Stretch", duration: "45 seconds", instructions: "Fold forward at hips, reach toward toes" },
      { name: "Hip Flexor Stretch", duration: "30 seconds each side", instructions: "Kneel in lunge position, push hips forward gently" }
    ]
  }
};

// Main function to generate workout (uses Supabase edge function)
export async function generateWorkout(params: GenerateWorkoutParams): Promise<{
  workout: GeneratedWorkout;
  usedFallback: boolean;
}> {
  const { framework, goal, fitnessLevel, equipment, duration } = params;
  const frameworkKey = framework.toLowerCase();

  try {
    console.log("Calling edge function to generate workout...");

    const { data, error } = await supabase.functions.invoke('generate-workout', {
      body: {
        framework: frameworkKey,
        goal,
        fitnessLevel,
        equipment,
        duration
      }
    });

    if (error) {
      console.error("Edge function error:", error);
      throw error;
    }

    if (!data || !data.workout) {
      throw new Error("No workout data returned from edge function");
    }

    console.log("Successfully generated workout:", data.workout);

    return {
      workout: data.workout,
      usedFallback: data.usedFallback || false
    };

  } catch (error) {
    console.error("Error generating workout:", error);

    // Return fallback workout
    const fallback = fallbackWorkouts[frameworkKey] || fallbackWorkouts.custom;

    return {
      workout: fallback,
      usedFallback: true
    };
  }
}

// Export fallback workouts for direct access if needed
export { fallbackWorkouts };

// Extensive fallback exercises for replacement (when AI fails)
// These lists are large to ensure we always have unique exercises available
const fallbackReplacementExercises: Record<string, Exercise[]> = {
  warmup: [
    { name: "Arm Circles", duration: "30 seconds each direction", instructions: "Extend arms and rotate in controlled circular motions" },
    { name: "Leg Swings", duration: "30 seconds each leg", instructions: "Swing leg forward and back, hold wall for balance" },
    { name: "Torso Twists", duration: "30 seconds", instructions: "Rotate upper body side to side with arms extended" },
    { name: "Hip Circles", duration: "30 seconds each direction", instructions: "Hands on hips, rotate hips in large controlled circles" },
    { name: "Neck Rolls", duration: "30 seconds", instructions: "Slowly roll head in circular motion to loosen neck muscles" },
    { name: "Shoulder Rolls", duration: "30 seconds", instructions: "Roll shoulders forward then backward in smooth motions" },
    { name: "Ankle Circles", duration: "30 seconds each ankle", instructions: "Rotate ankle in circles, both directions" },
    { name: "Wrist Circles", duration: "30 seconds", instructions: "Rotate wrists in circular motions to warm up joints" },
    { name: "Cat-Cow Stretch", duration: "45 seconds", instructions: "On all fours, alternate between arching and rounding spine" },
    { name: "Inchworms", duration: "45 seconds", instructions: "Fold forward, walk hands to plank, walk feet back to hands" },
    { name: "Jumping Jacks", duration: "45 seconds", instructions: "Jump feet wide while raising arms overhead, return to start" },
    { name: "High Knees March", duration: "45 seconds", instructions: "March in place lifting knees to hip height" },
    { name: "Butt Kicks", duration: "45 seconds", instructions: "Jog in place, kicking heels toward glutes" },
    { name: "Lateral Lunges", duration: "30 seconds each side", instructions: "Step wide to side, bend one knee while keeping other leg straight" },
    { name: "Arm Swings", duration: "30 seconds", instructions: "Swing arms across body dynamically to loosen shoulders" },
    { name: "World's Greatest Stretch", duration: "45 seconds", instructions: "Lunge with rotation, opening chest toward front leg" },
    { name: "Knee Hugs", duration: "30 seconds", instructions: "Standing, pull knee to chest alternating legs" },
    { name: "Leg Cradles", duration: "30 seconds each leg", instructions: "Cradle shin and pull knee toward chest while standing" },
    { name: "Hip Flexor Stretch", duration: "30 seconds each side", instructions: "Kneel in lunge position, push hips forward gently" },
    { name: "Standing Side Bends", duration: "30 seconds each side", instructions: "Reach arm overhead and lean to opposite side" },
  ],
  main: [
    { name: "High Knees", duration: "20s work / 10s rest", instructions: "Run in place bringing knees to hip height, pump arms vigorously" },
    { name: "Burpees", duration: "20s work / 10s rest", instructions: "Drop to plank, perform push-up, jump feet forward, explode up" },
    { name: "Mountain Climbers", duration: "20s work / 10s rest", instructions: "Hold plank position, rapidly alternate driving knees to chest" },
    { name: "Jump Squats", duration: "20s work / 10s rest", instructions: "Lower into squat, explode upward, land softly with bent knees" },
    { name: "Plank Jacks", duration: "20s work / 10s rest", instructions: "Hold plank, jump feet wide then back together" },
    { name: "Speed Skaters", duration: "20s work / 10s rest", instructions: "Leap side to side, landing on one foot with opposite leg behind" },
    { name: "Bicycle Crunches", duration: "20s work / 10s rest", instructions: "Lie on back, alternate elbow to opposite knee in cycling motion" },
    { name: "Jump Lunges", duration: "20s work / 10s rest", instructions: "Lunge position, jump and switch legs mid-air, land softly" },
    { name: "Skater Hops", duration: "20s work / 10s rest", instructions: "Hop laterally from foot to foot like a speed skater" },
    { name: "Squat Thrusts", duration: "20s work / 10s rest", instructions: "From standing, drop to squat, kick feet back to plank, reverse" },
    { name: "Boxing Punches", duration: "20s work / 10s rest", instructions: "Rapid alternating punches while maintaining athletic stance" },
    { name: "Tuck Jumps", duration: "20s work / 10s rest", instructions: "Jump explosively, tucking knees to chest at peak" },
    { name: "Bear Crawls", duration: "20s work / 10s rest", instructions: "Crawl forward on hands and feet with knees hovering" },
    { name: "Side Plank Dips", duration: "20s work / 10s rest", instructions: "In side plank, dip hip down and back up" },
    { name: "Push-ups", duration: "20s work / 10s rest", instructions: "Lower chest to floor, push up with full arm extension" },
    { name: "Star Jumps", duration: "20s work / 10s rest", instructions: "Jump spreading arms and legs wide like a star" },
    { name: "V-ups", duration: "20s work / 10s rest", instructions: "Lie flat, simultaneously lift legs and torso to touch toes" },
    { name: "Frog Jumps", duration: "20s work / 10s rest", instructions: "Deep squat, then explode forward in a jumping motion" },
    { name: "Plank Shoulder Taps", duration: "20s work / 10s rest", instructions: "In plank, alternate tapping opposite shoulder while staying stable" },
    { name: "Lateral Shuffles", duration: "20s work / 10s rest", instructions: "Quick side-to-side shuffles in athletic stance" },
    { name: "Jumping Jacks", duration: "20s work / 10s rest", instructions: "Jump feet wide while raising arms overhead, return to start" },
    { name: "Commandos", duration: "20s work / 10s rest", instructions: "From plank, lower to forearms one arm at a time, then push back up" },
    { name: "Sumo Squat Jumps", duration: "20s work / 10s rest", instructions: "Wide stance squat, explode up and land softly" },
    { name: "Russian Twists", duration: "20s work / 10s rest", instructions: "Seated, lean back slightly, rotate torso side to side" },
    { name: "Box Jumps", duration: "20s work / 10s rest", instructions: "Jump onto elevated surface, step back down" },
    { name: "Reverse Lunges", duration: "20s work / 10s rest", instructions: "Step back into lunge, keep front knee over ankle" },
    { name: "Broad Jumps", duration: "20s work / 10s rest", instructions: "Explosive forward jump, landing softly in squat position" },
    { name: "Crab Walks", duration: "20s work / 10s rest", instructions: "Face up on hands and feet, walk sideways" },
    { name: "Burpee Broad Jumps", duration: "20s work / 10s rest", instructions: "Burpee followed by explosive forward jump" },
    { name: "Scissor Jumps", duration: "20s work / 10s rest", instructions: "Split stance, jump and switch legs rapidly" },
  ],
  cooldown: [
    { name: "Quad Stretch", duration: "30 seconds each leg", instructions: "Stand on one leg, pull heel to glutes, keep knees together" },
    { name: "Hamstring Stretch", duration: "30 seconds each leg", instructions: "Sit with legs extended, reach forward toward toes" },
    { name: "Shoulder Stretch", duration: "30 seconds each arm", instructions: "Pull arm across chest, hold at elbow with opposite hand" },
    { name: "Child's Pose", duration: "45 seconds", instructions: "Kneel and sit back on heels, extend arms forward on floor" },
    { name: "Cobra Stretch", duration: "45 seconds", instructions: "Lie face down, push chest up while keeping hips on floor" },
    { name: "Butterfly Stretch", duration: "45 seconds", instructions: "Sit with soles of feet together, gently press knees down" },
    { name: "Seated Spinal Twist", duration: "30 seconds each side", instructions: "Sit tall, cross one leg over, rotate torso toward bent knee" },
    { name: "Pigeon Pose", duration: "45 seconds each side", instructions: "Bring knee forward, extend back leg, fold forward over front leg" },
    { name: "Figure Four Stretch", duration: "30 seconds each leg", instructions: "On back, cross ankle over knee, pull thigh toward chest" },
    { name: "Cat Stretch", duration: "45 seconds", instructions: "On all fours, round spine upward, tuck chin to chest" },
    { name: "Tricep Stretch", duration: "30 seconds each arm", instructions: "Reach arm overhead, bend elbow, push gently with other hand" },
    { name: "Standing Forward Fold", duration: "45 seconds", instructions: "Hinge at hips, let head hang, relax into the stretch" },
    { name: "Lying Hamstring Stretch", duration: "30 seconds each leg", instructions: "On back, extend leg up, gently pull toward chest" },
    { name: "Neck Stretch", duration: "30 seconds each side", instructions: "Gently tilt ear toward shoulder, hold the stretch" },
    { name: "Hip Flexor Stretch", duration: "30 seconds each side", instructions: "Kneel in lunge position, push hips forward gently" },
    { name: "Chest Opener", duration: "45 seconds", instructions: "Clasp hands behind back, lift chest, squeeze shoulder blades" },
    { name: "Calf Stretch", duration: "30 seconds each leg", instructions: "Step one foot back, press heel down, lean forward" },
    { name: "Thread the Needle", duration: "30 seconds each side", instructions: "On all fours, reach one arm under body, rotate torso" },
    { name: "Happy Baby Pose", duration: "45 seconds", instructions: "On back, grab feet, pull knees toward armpits" },
    { name: "Supine Twist", duration: "30 seconds each side", instructions: "Lie on back, drop knees to one side, look opposite direction" },
    { name: "Frog Stretch", duration: "45 seconds", instructions: "On all fours, spread knees wide, push hips back" },
    { name: "Standing Quad Stretch", duration: "30 seconds each leg", instructions: "Balance on one leg, pull opposite heel to glutes" },
    { name: "Seated Forward Fold", duration: "45 seconds", instructions: "Sit with legs extended, fold forward from hips" },
    { name: "Lizard Pose", duration: "45 seconds each side", instructions: "Deep lunge with both hands inside front foot" },
    { name: "Reclined Spinal Twist", duration: "30 seconds each side", instructions: "On back, cross one leg over and twist spine" },
  ]
};

// Parameters for replacing a single exercise
export interface ReplaceExerciseParams {
  exerciseName: string;
  category: 'warmup' | 'main' | 'cooldown';
  framework: string;
  fitnessLevel: string;
  equipment: string[];
  allExercisesInWorkout: string[]; // Complete list of all exercise names in the workout to avoid duplicates
}

// Function to generate a replacement exercise using AI
export async function generateReplacementExercise(params: ReplaceExerciseParams): Promise<{
  exercise: Exercise;
  usedFallback: boolean;
}> {
  const { exerciseName, category, framework, fitnessLevel, equipment, allExercisesInWorkout } = params;

  const maxRetries = 3;
  let attempt = 0;

  console.log('=== EXERCISE REPLACEMENT DEBUG ===');
  console.log('Replacing:', exerciseName);
  console.log('All exercises in workout:', allExercisesInWorkout);

  while (attempt < maxRetries) {
    try {
      console.log(`Attempt ${attempt + 1}: Calling edge function to replace exercise...`);

      const { data, error } = await supabase.functions.invoke('replace-exercise', {
        body: {
          exerciseName,
          category,
          framework: framework.toLowerCase(),
          fitnessLevel,
          equipment,
          allExercisesInWorkout
        }
      });

      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }

      if (!data || !data.exercise) {
        throw new Error("No exercise data returned from edge function");
      }

      // Validate: Check if generated exercise is a duplicate
      const isDuplicate = allExercisesInWorkout.some(
        existingEx => existingEx.toLowerCase() === data.exercise.name.toLowerCase()
      );

      console.log('Generated exercise:', data.exercise.name);
      console.log('Is duplicate?', isDuplicate);

      if (isDuplicate) {
        console.log(`Attempt ${attempt + 1}: AI returned duplicate "${data.exercise.name}", retrying...`);
        attempt++;
        continue; // Try again
      }

      // Success - unique exercise generated
      console.log(`Successfully generated unique exercise: ${data.exercise.name}`);

      return {
        exercise: data.exercise,
        usedFallback: data.usedFallback || false
      };

    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      attempt++;
    }
  }

  // After max retries, use fallback with uniqueness check
  console.log("Max retries reached, using fallback exercise with uniqueness filtering");
  return getFallbackExercise(category, allExercisesInWorkout);
}

// Get a fallback exercise that's not already in the workout
function getFallbackExercise(
  category: 'warmup' | 'main' | 'cooldown',
  allExercisesInWorkout: string[]
): { exercise: Exercise; usedFallback: boolean } {
  const fallbackList = fallbackReplacementExercises[category] || fallbackReplacementExercises.main;

  // Filter out exercises already in workout (case-insensitive)
  const availableExercises = fallbackList.filter(
    ex => !allExercisesInWorkout.some(
      existing => existing.toLowerCase() === ex.name.toLowerCase()
    )
  );

  console.log('Fallback list size:', fallbackList.length);
  console.log('Available after filtering:', availableExercises.length);

  if (availableExercises.length === 0) {
    // This should rarely happen with large fallback lists
    console.error('No unique fallback exercises available! Returning first fallback.');
    return {
      exercise: fallbackList[0],
      usedFallback: true
    };
  }

  // Pick random exercise from available ones
  const randomIndex = Math.floor(Math.random() * availableExercises.length);
  const selectedExercise = availableExercises[randomIndex];

  console.log('Selected fallback exercise:', selectedExercise.name);

  return {
    exercise: selectedExercise,
    usedFallback: true
  };
}
