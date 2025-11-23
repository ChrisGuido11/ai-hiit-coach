import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const frameworkDurationFormats: Record<string, string> = {
  tabata: '20s work / 10s rest',
  emom: 'X reps (e.g., "10 reps", "12 reps")',
  amrap: 'X reps (e.g., "10 reps", "15 reps")',
  hiit: 'Xs work / Xs rest (e.g., "40s work / 20s rest")',
  circuit: 'X seconds (e.g., "45 seconds", "30 seconds")'
};

// Fallback exercises by category
const fallbackExercises: Record<string, Array<{ name: string; duration: string; instructions: string }>> = {
  warmup: [
    { name: "Arm Circles", duration: "30 seconds each direction", instructions: "Extend arms and rotate in controlled circular motions" },
    { name: "Leg Swings", duration: "30 seconds each leg", instructions: "Swing leg forward and back, hold wall for balance" },
    { name: "Torso Twists", duration: "30 seconds", instructions: "Rotate upper body side to side with arms extended" },
    { name: "Hip Circles", duration: "30 seconds each direction", instructions: "Hands on hips, rotate hips in large controlled circles" },
    { name: "Jumping Jacks", duration: "45 seconds", instructions: "Jump feet wide while raising arms overhead, return to start" },
    { name: "High Knees", duration: "45 seconds", instructions: "Drive knees to hip height while pumping arms" }
  ],
  main_tabata: [
    { name: "High Knees", duration: "20s work / 10s rest", instructions: "Run in place bringing knees to hip height, pump arms vigorously" },
    { name: "Burpees", duration: "20s work / 10s rest", instructions: "Drop to plank, perform push-up, jump feet forward, explode up" },
    { name: "Mountain Climbers", duration: "20s work / 10s rest", instructions: "Hold plank position, rapidly alternate driving knees to chest" },
    { name: "Jump Squats", duration: "20s work / 10s rest", instructions: "Lower into squat, explode upward, land softly with bent knees" },
    { name: "Plank Jacks", duration: "20s work / 10s rest", instructions: "Hold plank, jump feet wide then back together" },
    { name: "Speed Skaters", duration: "20s work / 10s rest", instructions: "Leap side to side, landing on one foot with opposite leg behind" }
  ],
  main_emom: [
    { name: "Push-ups", duration: "10 reps", instructions: "Lower chest to floor, push up with full arm extension" },
    { name: "Air Squats", duration: "15 reps", instructions: "Sit back and down past parallel, weight in heels, chest up" },
    { name: "Sit-ups", duration: "12 reps", instructions: "Lie flat, engage core, curl up to touch toes" },
    { name: "Lunges", duration: "10 reps", instructions: "Step forward into lunge, both knees at 90 degrees, alternate legs" },
    { name: "Burpees", duration: "8 reps", instructions: "Drop to plank, perform push-up, jump feet forward, explode up" }
  ],
  main_amrap: [
    { name: "Burpees", duration: "5 reps", instructions: "Drop to plank with push-up, jump feet forward, explode up" },
    { name: "Air Squats", duration: "10 reps", instructions: "Sit back past parallel, drive through heels to stand" },
    { name: "Push-ups", duration: "10 reps", instructions: "Lower chest to floor, maintain rigid plank throughout" },
    { name: "Sit-ups", duration: "15 reps", instructions: "Engage core, curl up fully, control the descent" },
    { name: "Jumping Lunges", duration: "10 reps", instructions: "Lunge position, jump and switch legs mid-air, land softly" }
  ],
  main_circuit: [
    { name: "Squats", duration: "45 seconds", instructions: "Feet shoulder-width, sit back and down, keep chest up" },
    { name: "Push-ups", duration: "45 seconds", instructions: "Maintain plank position, lower chest to floor with control" },
    { name: "Reverse Lunges", duration: "45 seconds", instructions: "Step back into lunge, keep front knee over ankle" },
    { name: "Plank Hold", duration: "45 seconds", instructions: "Forearms on ground, maintain straight line from head to heels" },
    { name: "Jumping Jacks", duration: "45 seconds", instructions: "Jump feet wide while raising arms overhead, return to start" }
  ],
  cooldown: [
    { name: "Quad Stretch", duration: "30 seconds each leg", instructions: "Stand on one leg, pull heel to glutes, keep knees together" },
    { name: "Hamstring Stretch", duration: "30 seconds each leg", instructions: "Sit with legs extended, reach forward toward toes" },
    { name: "Shoulder Stretch", duration: "30 seconds each arm", instructions: "Pull arm across chest, hold at elbow with opposite hand" },
    { name: "Child's Pose", duration: "45 seconds", instructions: "Kneel and sit back on heels, extend arms forward on floor" },
    { name: "Standing Forward Fold", duration: "45 seconds", instructions: "Hinge at hips, let head hang, relax into the stretch" },
    { name: "Cat-Cow Stretch", duration: "45 seconds", instructions: "On all fours, alternate between arching and rounding spine" }
  ]
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { exerciseName, category, framework, fitnessLevel, equipment } = await req.json();

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    // Get appropriate fallback category
    const getFallbackKey = (cat: string, fw: string) => {
      if (cat === 'warmup') return 'warmup';
      if (cat === 'cooldown') return 'cooldown';
      const mainKey = `main_${fw}`;
      return fallbackExercises[mainKey] ? mainKey : 'main_tabata';
    };

    const fallbackKey = getFallbackKey(category, framework);
    const fallbackList = fallbackExercises[fallbackKey];

    // Get a random fallback exercise that's different from the current one
    const getRandomFallback = () => {
      const available = fallbackList.filter(e => e.name.toLowerCase() !== exerciseName.toLowerCase());
      if (available.length === 0) return fallbackList[0];
      return available[Math.floor(Math.random() * available.length)];
    };

    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY not configured, using fallback');
      return new Response(
        JSON.stringify({
          exercise: getRandomFallback(),
          usedFallback: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const durationFormat = frameworkDurationFormats[framework] || frameworkDurationFormats.tabata;
    const categoryDescription = category === 'warmup'
      ? 'warm-up exercise (prepare muscles, elevate heart rate)'
      : category === 'cooldown'
        ? 'cool-down stretch (relax muscles, improve flexibility)'
        : `main workout exercise for ${framework.toUpperCase()} format`;

    const systemPrompt = `You are a fitness AI generating a single replacement exercise.

Generate ONE ${categoryDescription}.

CRITICAL RULES:
1. Do NOT include "${exerciseName}" - generate a DIFFERENT exercise
2. Exercise must be appropriate for ${fitnessLevel} fitness level
3. Equipment available: ${equipment?.length > 0 ? equipment.join(', ') : 'bodyweight only'}

DURATION FORMAT:
- Warm-up/Cool-down: "X seconds" or "X seconds each side/leg"
- Main workout (${framework}): ${durationFormat}

INSTRUCTIONS: ONE short sentence about form only. No timing, reps, or rounds.

Return ONLY valid JSON (no markdown):
{"name": "Exercise Name", "duration": "format per rules", "instructions": "One sentence form cue"}`;

    const userPrompt = `Generate a single ${category} exercise to replace "${exerciseName}".
Return ONLY the JSON object.`;

    console.log('Calling OpenAI API for exercise replacement...');
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
        temperature: 0.9,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({
          exercise: getRandomFallback(),
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
      const exercise = JSON.parse(generatedText);

      // Validate the exercise object has required fields
      if (!exercise.name || !exercise.duration || !exercise.instructions) {
        throw new Error('Invalid exercise format');
      }

      console.log('Successfully generated replacement exercise:', exercise.name);
      return new Response(
        JSON.stringify({ exercise, usedFallback: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      return new Response(
        JSON.stringify({
          exercise: getRandomFallback(),
          usedFallback: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in replace-exercise function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        exercise: fallbackExercises.warmup[0],
        usedFallback: true
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
