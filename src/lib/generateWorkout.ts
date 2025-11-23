import OpenAI from "openai";

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

// Framework-specific rules for the AI
const frameworkRules: Record<string, string> = {
  tabata: `Tabata Protocol Rules:
- 20 seconds of maximum effort work
- 10 seconds of rest
- 8 rounds per exercise (4 minutes total per exercise)
- Duration format for main exercises: "20s work / 10s rest × 8 rounds"
- Choose explosive, high-intensity exercises
- Total workout time should fit within the user's duration preference`,

  emom: `EMOM (Every Minute On the Minute) Rules:
- Complete prescribed reps at the start of each minute
- Rest for the remainder of the minute
- Duration format: "X reps every minute for Y minutes"
- Choose compound movements that can be done quickly
- Reps should be achievable in 30-40 seconds to allow rest`,

  amrap: `AMRAP (As Many Rounds As Possible) Rules:
- Complete as many rounds of the circuit as possible
- Minimal rest between exercises
- Duration format: "X reps" (the time limit is set separately)
- Choose exercises that flow well together
- Mix upper body, lower body, and cardio movements`,

  circuit: `Circuit Training Rules:
- Move through exercises with minimal rest (15-30 seconds)
- Complete multiple rounds of the full circuit
- Duration format: "X seconds" or "X reps"
- Include variety: strength, cardio, and mobility
- Balance push/pull and upper/lower body movements`,

  custom: `Custom Goal Workout Rules:
- Design based on the user's specific goal
- Balance the workout appropriately
- Include proper warm-up and cool-down
- Duration format should match the exercise type`
};

// Fallback workouts for each framework
const fallbackWorkouts: Record<string, GeneratedWorkout> = {
  tabata: {
    warmup: [
      { name: "Jumping Jacks", duration: "60 seconds", instructions: "Start with feet together, jump and spread legs while raising arms overhead" },
      { name: "Arm Circles", duration: "30 seconds each direction", instructions: "Extend arms and make controlled circular motions" },
      { name: "High Knees", duration: "45 seconds", instructions: "Run in place, driving knees up to hip height" }
    ],
    main: [
      { name: "Burpees", duration: "20s work / 10s rest × 8 rounds", instructions: "Squat down, jump back to plank, perform push-up, jump feet forward, explode up" },
      { name: "Mountain Climbers", duration: "20s work / 10s rest × 8 rounds", instructions: "In plank position, rapidly alternate driving knees to chest" },
      { name: "Jump Squats", duration: "20s work / 10s rest × 8 rounds", instructions: "Lower into squat, explode upward, land softly and repeat" },
      { name: "High Knees", duration: "20s work / 10s rest × 8 rounds", instructions: "Run in place with maximum speed, driving knees up high" }
    ],
    cooldown: [
      { name: "Standing Forward Fold", duration: "45 seconds", instructions: "Bend at hips, let head and arms hang, relax hamstrings" },
      { name: "Quad Stretch", duration: "30 seconds each leg", instructions: "Stand on one leg, pull heel to glutes, keep knees together" },
      { name: "Child's Pose", duration: "60 seconds", instructions: "Kneel, sit back on heels, extend arms forward on floor" }
    ]
  },
  emom: {
    warmup: [
      { name: "Light Jog in Place", duration: "60 seconds", instructions: "Easy pace to elevate heart rate gradually" },
      { name: "Leg Swings", duration: "30 seconds each leg", instructions: "Swing leg forward and back, holding wall for balance" },
      { name: "Arm Swings", duration: "30 seconds", instructions: "Swing arms across body and back, loosening shoulders" }
    ],
    main: [
      { name: "Push-ups", duration: "10 reps every minute for 4 minutes", instructions: "Full range of motion, chest to floor, arms fully extended at top" },
      { name: "Air Squats", duration: "15 reps every minute for 4 minutes", instructions: "Break parallel, weight in heels, chest up" },
      { name: "Sit-ups", duration: "12 reps every minute for 4 minutes", instructions: "Full sit-up, touch toes at top, shoulder blades to floor" },
      { name: "Lunges", duration: "10 reps (alternating) every minute for 4 minutes", instructions: "Step forward, both knees at 90 degrees, drive through front heel" }
    ],
    cooldown: [
      { name: "Pigeon Pose", duration: "45 seconds each side", instructions: "From plank, bring knee forward, extend back leg, fold forward" },
      { name: "Seated Spinal Twist", duration: "30 seconds each side", instructions: "Sit tall, cross one leg over, twist toward bent knee" },
      { name: "Lying Hamstring Stretch", duration: "45 seconds each leg", instructions: "On back, extend leg up, gently pull toward chest" }
    ]
  },
  amrap: {
    warmup: [
      { name: "Jumping Jacks", duration: "45 seconds", instructions: "Moderate pace to warm up entire body" },
      { name: "Bodyweight Good Mornings", duration: "30 seconds", instructions: "Hands behind head, hinge at hips, feel hamstring stretch" },
      { name: "Inchworms", duration: "45 seconds", instructions: "Fold forward, walk hands to plank, walk feet to hands, stand" }
    ],
    main: [
      { name: "Burpees", duration: "5 reps", instructions: "Full burpee with push-up and jump at top" },
      { name: "Air Squats", duration: "10 reps", instructions: "Break parallel, drive through heels" },
      { name: "Push-ups", duration: "10 reps", instructions: "Chest to floor, full arm extension" },
      { name: "Sit-ups", duration: "15 reps", instructions: "Full range of motion, touch toes" },
      { name: "Jumping Lunges", duration: "10 reps total", instructions: "Lunge, jump and switch legs mid-air" }
    ],
    cooldown: [
      { name: "Cat-Cow Stretch", duration: "60 seconds", instructions: "On all fours, alternate arching and rounding spine" },
      { name: "Figure Four Stretch", duration: "45 seconds each side", instructions: "On back, cross ankle over knee, pull thigh toward chest" },
      { name: "Chest Opener", duration: "45 seconds", instructions: "Clasp hands behind back, lift chest, squeeze shoulder blades" }
    ]
  },
  circuit: {
    warmup: [
      { name: "March in Place", duration: "60 seconds", instructions: "High knees march, pump arms naturally" },
      { name: "Hip Circles", duration: "30 seconds each direction", instructions: "Hands on hips, make large circles with hips" },
      { name: "Shoulder Rolls", duration: "30 seconds", instructions: "Roll shoulders forward then backward" }
    ],
    main: [
      { name: "Squats", duration: "45 seconds", instructions: "Feet shoulder-width, sit back and down, chest up" },
      { name: "Push-ups", duration: "45 seconds", instructions: "Modify on knees if needed, maintain plank position" },
      { name: "Reverse Lunges", duration: "45 seconds", instructions: "Step back into lunge, alternate legs" },
      { name: "Plank Hold", duration: "45 seconds", instructions: "Forearms on ground, body in straight line" },
      { name: "Jumping Jacks", duration: "45 seconds", instructions: "Full range of motion, arms overhead" }
    ],
    cooldown: [
      { name: "Standing Side Stretch", duration: "30 seconds each side", instructions: "Reach arm overhead, lean to opposite side" },
      { name: "Downward Dog", duration: "60 seconds", instructions: "Hands and feet on floor, hips high, heels toward ground" },
      { name: "Neck Stretches", duration: "30 seconds each side", instructions: "Gently tilt ear to shoulder, hold" }
    ]
  },
  custom: {
    warmup: [
      { name: "Light Cardio", duration: "60 seconds", instructions: "Jumping jacks or jogging in place" },
      { name: "Dynamic Stretching", duration: "60 seconds", instructions: "Leg swings, arm circles, torso twists" }
    ],
    main: [
      { name: "Squats", duration: "45 seconds", instructions: "Basic bodyweight squats with good form" },
      { name: "Push-ups", duration: "45 seconds", instructions: "Standard or modified push-ups" },
      { name: "Lunges", duration: "45 seconds", instructions: "Alternating forward lunges" },
      { name: "Plank", duration: "45 seconds", instructions: "Hold strong plank position" }
    ],
    cooldown: [
      { name: "Full Body Stretch", duration: "45 seconds", instructions: "Standing forward fold, reach for toes" },
      { name: "Hip Flexor Stretch", duration: "30 seconds each side", instructions: "Kneeling lunge stretch" }
    ]
  }
};

// Clean AI response by removing markdown code blocks
function cleanJsonResponse(response: string): string {
  // Remove markdown code blocks
  let cleaned = response.replace(/```json\n?/gi, "").replace(/```\n?/gi, "");
  // Trim whitespace
  cleaned = cleaned.trim();
  return cleaned;
}

// Initialize OpenAI client
function getOpenAIClient(): OpenAI {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true // For development only - will move to backend later
  });
}

// Build the system prompt
function buildSystemPrompt(framework: string): string {
  const rules = frameworkRules[framework] || frameworkRules.custom;

  return `You are an expert HIIT fitness coach and workout designer. Your job is to create personalized, effective workouts that are safe and appropriate for the user's fitness level.

${rules}

IMPORTANT GUIDELINES:
1. Always include a proper warm-up to prepare the body
2. Main workout should be challenging but achievable
3. Cool-down should help with recovery and flexibility
4. Consider the available equipment when selecting exercises
5. Adjust intensity based on fitness level:
   - Beginner: Lower reps, longer rest, simpler movements
   - Intermediate: Moderate challenge, standard protocols
   - Advanced: Higher intensity, complex movements, shorter rest

You must respond with ONLY valid JSON in this exact structure (no markdown, no explanations):
{
  "warmup": [
    { "name": "Exercise Name", "duration": "time format", "instructions": "Brief form cue" }
  ],
  "main": [
    { "name": "Exercise Name", "duration": "time format per framework rules", "instructions": "Brief form cue" }
  ],
  "cooldown": [
    { "name": "Exercise Name", "duration": "time format", "instructions": "Brief form cue" }
  ]
}`;
}

// Build the user prompt
function buildUserPrompt(params: GenerateWorkoutParams): string {
  const { framework, goal, fitnessLevel, equipment, duration } = params;

  const equipmentList = equipment.length > 0
    ? equipment.join(", ")
    : "bodyweight only (no equipment)";

  let prompt = `Create a ${framework.toUpperCase()} workout for me with these specifications:

FITNESS LEVEL: ${fitnessLevel}
AVAILABLE EQUIPMENT: ${equipmentList}
TARGET DURATION: ${duration} minutes total`;

  if (goal) {
    prompt += `\nSPECIFIC GOAL: ${goal}`;
  }

  prompt += `

Please create:
- 2-3 warm-up exercises (about 3-5 minutes total)
- 4-6 main workout exercises following ${framework.toUpperCase()} protocol
- 2-3 cool-down stretches (about 3-5 minutes total)

Remember to use ONLY the equipment I have available and adjust difficulty for my ${fitnessLevel} fitness level.

Respond with ONLY the JSON object, no additional text or markdown.`;

  return prompt;
}

// Main function to generate workout
export async function generateWorkout(params: GenerateWorkoutParams): Promise<{
  workout: GeneratedWorkout;
  usedFallback: boolean;
}> {
  const { framework } = params;
  const frameworkKey = framework.toLowerCase();

  try {
    const openai = getOpenAIClient();

    const systemPrompt = buildSystemPrompt(frameworkKey);
    const userPrompt = buildUserPrompt(params);

    console.log("Calling OpenAI API for workout generation...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 1500
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No response content from OpenAI");
    }

    console.log("Raw AI response:", content);

    // Clean and parse the response
    const cleanedContent = cleanJsonResponse(content);
    const workout: GeneratedWorkout = JSON.parse(cleanedContent);

    // Validate the workout structure
    if (!workout.warmup || !workout.main || !workout.cooldown) {
      throw new Error("Invalid workout structure returned by AI");
    }

    if (!Array.isArray(workout.warmup) || !Array.isArray(workout.main) || !Array.isArray(workout.cooldown)) {
      throw new Error("Workout sections must be arrays");
    }

    console.log("Successfully generated workout:", workout);

    return {
      workout,
      usedFallback: false
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
