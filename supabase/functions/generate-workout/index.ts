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

    const systemPrompt = `You are a fitness AI generating ${framework.toUpperCase()} workouts.

${frameworkRules[framework] || ''}

CRITICAL FORMATTING RULES:

1. DURATION FIELD - Use ONLY the interval pattern, NOT total time:
   - Tabata: "20s work / 10s rest"
   - EMOM: "10 reps" or "12 reps"
   - AMRAP: "10 reps" or "15 reps"
   - HIIT: "40s work / 20s rest"
   - Circuit: "45 seconds" or "30 seconds"
   - Warm-up/Cool-down: "60 seconds" or "30 seconds each side"

   WRONG: "4 minutes", "8 rounds (20s work, 10s rest)", "2 minutes"
   CORRECT: "20s work / 10s rest", "45 seconds", "10 reps"

2. INSTRUCTIONS - Must be ONE short sentence about form only:
   - Describe body positioning and movement technique
   - NO timing info (don't mention seconds, rounds, rest)
   - NO rep counts
   - NO workout structure

   WRONG: "Perform high knees for 20 seconds, followed by 10 seconds rest. Repeat for 8 rounds."
   CORRECT: "Drive knees to hip height while pumping arms vigorously"

Return ONLY valid JSON (no markdown):
{
  "warmup": [{"name": "Exercise", "duration": "60 seconds", "instructions": "One sentence form cue"}],
  "main": [{"name": "Exercise", "duration": "format per framework", "instructions": "One sentence form cue"}],
  "cooldown": [{"name": "Exercise", "duration": "30 seconds", "instructions": "One sentence form cue"}]
}`;

    const userPrompt = `Generate a ${framework.toUpperCase()} workout:
- Fitness Level: ${fitnessLevel}
- Equipment: ${equipment?.join(', ') || 'bodyweight only'}
- Duration: ${duration} minutes total
${goal ? `- Goal: ${goal}` : ''}

Create 2-3 warmup exercises, 4-6 main exercises, 2-3 cooldown stretches.
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
