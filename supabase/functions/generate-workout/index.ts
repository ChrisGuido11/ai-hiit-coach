import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const frameworkRules: Record<string, string> = {
  tabata: `Tabata Protocol:
- 20 seconds work, 10 seconds rest
- 8 rounds per exercise (4 minutes total)
- DURATION FORMAT: Must be exactly "20s work / 10s rest"
- Choose explosive, high-intensity exercises`,

  emom: `EMOM (Every Minute On the Minute):
- Complete reps at start of each minute
- Rest for remainder of minute
- DURATION FORMAT: Must be "X reps" (e.g., "10 reps", "12 reps")
- Reps achievable in 30-40 seconds`,

  amrap: `AMRAP (As Many Rounds As Possible):
- Complete as many rounds as possible
- Minimal rest between exercises
- DURATION FORMAT: Must be "X reps" (e.g., "10 reps", "15 reps")
- Mix upper/lower body and cardio`,

  ladder: `Ladder Workout:

CRITICAL RULES FOR LADDER WORKOUTS:
1. Choose ONLY ONE ladder type for the entire workout
2. ALL exercises must use the SAME ladder pattern
3. DO NOT mix ascending, descending, and pyramid in one workout

Select ONE of these patterns for the ENTIRE workout:

OPTION A - ASCENDING LADDER:
- All exercises: 1 → X reps (where X is 5-10 depending on fitness level)
- Example: Exercise 1: 1→8, Exercise 2: 1→8, Exercise 3: 1→8
- Progressively harder as reps increase

OPTION B - DESCENDING LADDER:
- All exercises: X → 1 reps (where X is 5-15 depending on fitness level)
- Example: Exercise 1: 10→1, Exercise 2: 10→1, Exercise 3: 10→1
- Start hard, get easier

OPTION C - PYRAMID LADDER:
- All exercises: 1 → X → 1 reps (where X is 5-10 depending on fitness level)
- Example: Exercise 1: 1→5→1, Exercise 2: 1→5→1, Exercise 3: 1→5→1
- Build up then back down

Choose appropriate pattern based on:
- Beginner: Shorter range (1→5, 5→1, or 1→3→1)
- Intermediate: Medium range (1→8, 10→1, or 1→5→1)
- Advanced: Longer range (1→10, 15→1, or 1→8→1)

Timer Mode:
- For Time: Stopwatch counts up, complete entire ladder
- AMRAP: Countdown timer, get as far as possible
- Choose based on ladder complexity and fitness level

DURATION FORMAT: Must be "Ladder: [start]→[end] [type], [mode] [duration if AMRAP]"
Examples: "Ladder: 1→10 ascending, For Time"
          "Ladder: 10→1 descending, AMRAP 10:00"
          "Ladder: 1→5→1 pyramid, For Time"

CRITICAL: Exercise INSTRUCTIONS field MUST follow this format:
"[Exercise Name]: [Concise form cue in 5-8 words]"

Examples of CORRECT instructions:
- "Push-ups: Chest to ground, elbows 45°, controlled"
- "Squats: Feet shoulder-width, depth to parallel, knees out"
- "Burpees: Chest down, jump feet in, explosive jump"
- "Mountain Climbers: Plank position, drive knees to chest"
- "Kettlebell Swings: Hinge at hips, explosive hip drive"
- "Lunges: Step forward, 90° angles, back knee hovers"

DO NOT write long form instructions. Keep it under 10 words.
ALWAYS start with the exercise name followed by a colon.

Generate 2-3 exercises that:
- Match user's fitness level
- Use available equipment
- Work well together
- Are safe at the rep ranges chosen
- ALL use the SAME ladder pattern (CRITICAL!)`,

  hiit: `HIIT Format:
- High intensity intervals
- Work 30-45 seconds, rest 15-30 seconds
- DURATION FORMAT: Must be "Xs work / Xs rest" (e.g., "40s work / 20s rest")`,

  circuit: `Circuit Training:
- Move through exercises with minimal rest
- Complete multiple rounds
- DURATION FORMAT: Must be "X seconds" (e.g., "45 seconds", "30 seconds")
- Balance push/pull and upper/lower movements`
};

const fallbackWorkouts: Record<string, any> = {
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
      { name: "Arm Circles", duration: "30 seconds each direction", instructions: "Arm Circles: Extend arms, rotate in controlled circles" },
      { name: "Leg Swings", duration: "30 seconds each leg", instructions: "Leg Swings: Forward and back, hold wall for balance" },
      { name: "Jumping Jacks", duration: "45 seconds", instructions: "Jumping Jacks: Jump feet wide, arms overhead" }
    ],
    main: [
      { name: "Push-ups", duration: "Ladder: 1→10 ascending, For Time", instructions: "Push-ups: Chest to ground, elbows 45°, controlled" },
      { name: "Squats", duration: "Ladder: 1→10 ascending, For Time", instructions: "Squats: Feet shoulder-width, depth to parallel" }
    ],
    cooldown: [
      { name: "Child's Pose", duration: "60 seconds", instructions: "Child's Pose: Kneel back on heels, arms forward" },
      { name: "Quad Stretch", duration: "30 seconds each leg", instructions: "Quad Stretch: Pull heel to glutes, knees together" },
      { name: "Hamstring Stretch", duration: "30 seconds each leg", instructions: "Hamstring Stretch: Legs extended, reach toward toes" }
    ]
  },
  hiit: {
    warmup: [
      { name: "March in Place", duration: "60 seconds", instructions: "Lift knees high while pumping arms naturally" },
      { name: "Hip Circles", duration: "30 seconds each direction", instructions: "Hands on hips, rotate hips in large controlled circles" },
      { name: "Shoulder Rolls", duration: "30 seconds", instructions: "Roll shoulders forward then backward in smooth motions" }
    ],
    main: [
      { name: "High Knees", duration: "40s work / 20s rest", instructions: "Run in place bringing knees to hip height" },
      { name: "Push-ups", duration: "40s work / 20s rest", instructions: "Lower chest to floor, maintain plank position" },
      { name: "Jump Squats", duration: "40s work / 20s rest", instructions: "Squat down, explode up, land softly" },
      { name: "Plank Hold", duration: "40s work / 20s rest", instructions: "Hold rigid plank, engage core throughout" }
    ],
    cooldown: [
      { name: "Standing Side Stretch", duration: "30 seconds each side", instructions: "Reach arm overhead and lean to opposite side" },
      { name: "Downward Dog", duration: "60 seconds", instructions: "Press hips high, push heels toward ground, relax neck" },
      { name: "Neck Stretches", duration: "30 seconds each side", instructions: "Gently tilt ear toward shoulder, hold the stretch" }
    ]
  },
  circuit: {
    warmup: [
      { name: "Jumping Jacks", duration: "60 seconds", instructions: "Jump feet wide while raising arms overhead, return to start" },
      { name: "Arm Circles", duration: "30 seconds each direction", instructions: "Extend arms and rotate in controlled circular motions" }
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
      { name: "Downward Dog", duration: "60 seconds", instructions: "Press hips high, push heels toward ground, relax neck" }
    ]
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { framework, goal, fitnessLevel, equipment, duration } = await req.json();

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY not configured, using fallback');
      return new Response(
        JSON.stringify({
          workout: fallbackWorkouts[framework] || fallbackWorkouts.tabata,
          usedFallback: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an expert fitness coach who interprets natural language workout requests and generates precise, effective workouts.

ALWAYS FOLLOW THESE STEPS:
1. PARSE the user's request to extract: duration, target muscles, intensity level, equipment
2. CHOOSE the best protocol BASED ON THE REQUEST (consider user preference AND duration)
3. GENERATE exercises that DIRECTLY match the target muscles
4. ENSURE total workout time matches the requested duration

${frameworkRules[framework] || ''}

CRITICAL FORMATTING RULES:

1. DURATION FIELD - Use ONLY the interval pattern, NOT total time:
   - Tabata: "20s work / 10s rest"
   - EMOM: "10 reps" or "12 reps"
   - AMRAP: "10 reps" or "15 reps"
   - Ladder: "Ladder: 1→10 ascending, For Time" or "Ladder: 10→1 descending, AMRAP 10:00"
   - HIIT: "40s work / 20s rest"
   - Circuit: "45 seconds" or "30 seconds"
   - Warm-up/Cool-down: "60 seconds" or "30 seconds each side"

   WRONG: "4 minutes", "8 rounds (20s work, 10s rest)", "2 minutes"
   CORRECT: "20s work / 10s rest", "45 seconds", "10 reps", "Ladder: 1→10 ascending, For Time"

2. INSTRUCTIONS - Must be ONE short sentence about form only:
   - Describe body positioning and movement technique
   - NO timing info (don't mention seconds, rounds, rest)
   - NO rep counts
   - NO workout structure

   WRONG: "Perform high knees for 20 seconds, followed by 10 seconds rest. Repeat for 8 rounds."
   CORRECT: "Drive knees to hip height while pumping arms vigorously"

3. EXERCISE SELECTION - CRITICAL:
   - If user specifies target muscles (e.g., "abs and core"), prioritize exercises that work those areas
   - Do NOT generate unrelated exercises
   - Match exercise intensity to user's fitness level
   - If no equipment is specified, DO NOT include exercises requiring equipment

Return ONLY valid JSON (no markdown):
{
  "warmup": [{"name": "Exercise", "duration": "60 seconds", "instructions": "One sentence form cue"}],
  "main": [{"name": "Exercise", "duration": "format per framework", "instructions": "One sentence form cue"}],
  "cooldown": [{"name": "Exercise", "duration": "30 seconds", "instructions": "One sentence form cue"}]
}`;

    const userPrompt = `Generate a ${framework.toUpperCase()} workout with these parameters:
- Fitness Level: ${fitnessLevel}
- Equipment Available: ${equipment?.join(', ') || 'bodyweight only'}
- Total Duration: ${duration} minutes
${goal ? `- User's Request: "${goal}"` : '- User Request: Generic workout'}

REQUIREMENTS:
1. If user specified a body part/goal (e.g., "abs and core", "legs"), ALL main exercises must target that area
2. If user specified duration, structure the workout to fit that timeframe
3. If user has no equipment restrictions, use only bodyweight
4. Exercise selection must align with the user's specific request - NO unrelated exercises
5. Create 2-3 warmup exercises, 4-6 main exercises, 2-3 cooldown stretches

Return ONLY the JSON object.`;

    console.log('Calling OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({
          workout: fallbackWorkouts[framework] || fallbackWorkouts.tabata,
          usedFallback: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    let generatedText = data.choices[0].message.content;

    // Clean the response
    generatedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const workout = JSON.parse(generatedText);
      console.log('Successfully generated workout');
      return new Response(
        JSON.stringify({ workout, usedFallback: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      return new Response(
        JSON.stringify({
          workout: fallbackWorkouts[framework] || fallbackWorkouts.tabata,
          usedFallback: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in generate-workout function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        workout: fallbackWorkouts.tabata,
        usedFallback: true
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
