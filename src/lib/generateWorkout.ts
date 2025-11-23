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
  circuit: {
    warmup: [
      { name: "March in Place", duration: "60 seconds", instructions: "Lift knees high while pumping arms naturally" },
      { name: "Hip Circles", duration: "30 seconds each direction", instructions: "Hands on hips, rotate hips in large controlled circles" },
      { name: "Shoulder Rolls", duration: "30 seconds", instructions: "Roll shoulders forward then backward in smooth motions" }
    ],
    main: [
      { name: "Squats", duration: "45 seconds", instructions: "Feet shoulder-width, sit back and down, keep chest up" },
      { name: "Push-ups", duration: "45 seconds", instructions: "Maintain plank position, lower chest to floor with control" },
      { name: "Reverse Lunges", duration: "45 seconds", instructions: "Step back into lunge, keep front knee over ankle" },
      { name: "Plank Hold", duration: "45 seconds", instructions: "Forearms on ground, maintain straight line from head to heels" },
      { name: "Jumping Jacks", duration: "45 seconds", instructions: "Jump feet wide while raising arms overhead, return to start" }
    ],
    cooldown: [
      { name: "Standing Side Stretch", duration: "30 seconds each side", instructions: "Reach arm overhead and lean to opposite side" },
      { name: "Downward Dog", duration: "60 seconds", instructions: "Press hips high, push heels toward ground, relax neck" },
      { name: "Neck Stretches", duration: "30 seconds each side", instructions: "Gently tilt ear toward shoulder, hold the stretch" }
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
