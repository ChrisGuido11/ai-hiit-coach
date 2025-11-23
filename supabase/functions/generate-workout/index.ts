import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const frameworkRules: Record<string, string> = {
  tabata: `TABATA Format:
- Work: 20 seconds high intensity
- Rest: 10 seconds
- Total: 8 rounds per exercise (4 minutes per exercise)
Structure: warmup (3-5 min) → main exercises (3-4 exercises) → cooldown (3-5 min)`,
  
  emom: `EMOM Format:
- Every Minute On the Minute
- Complete exercise within 60 seconds
- Rest remaining time in that minute
Structure: warmup (3-5 min) → main exercises (12-20 minutes) → cooldown (3-5 min)`,
  
  amrap: `AMRAP Format:
- As Many Rounds As Possible
- Complete rounds of exercises in time limit
- Track total rounds completed
Structure: warmup (3-5 min) → main circuit (15-20 minutes) → cooldown (3-5 min)`,
  
  hiit: `HIIT Format:
- High intensity intervals
- Work: 30-45 seconds
- Rest: 15-30 seconds between exercises
Structure: warmup (3-5 min) → circuits (20-30 min) → cooldown (3-5 min)`,
  
  circuit: `CIRCUIT Format:
- Move through exercises with minimal rest
- Complete 3-4 rounds
- Rest 1-2 minutes between rounds
Structure: warmup (3-5 min) → circuit rounds (20-30 min) → cooldown (3-5 min)`
};

const fallbackWorkouts: Record<string, any> = {
  tabata: {
    warmup: [
      { name: "Jumping Jacks", duration: "2 minutes", instructions: "Start with feet together, jump while spreading legs and raising arms overhead." },
      { name: "Arm Circles", duration: "1 minute", instructions: "Extend arms to sides and make circular motions, 30 seconds forward, 30 seconds backward." },
      { name: "High Knees", duration: "2 minutes", instructions: "Run in place while bringing knees up to hip level." }
    ],
    main: [
      { name: "Burpees", duration: "8 rounds (20s work, 10s rest)", instructions: "Start standing, drop to plank, do a push-up, jump feet to hands, jump up with arms overhead." },
      { name: "Mountain Climbers", duration: "8 rounds (20s work, 10s rest)", instructions: "In plank position, alternate bringing knees to chest in a running motion." },
      { name: "Jump Squats", duration: "8 rounds (20s work, 10s rest)", instructions: "Perform a squat, then explode up into a jump. Land softly and repeat." }
    ],
    cooldown: [
      { name: "Standing Quad Stretch", duration: "1 minute each leg", instructions: "Stand on one leg, pull other foot to glutes, hold." },
      { name: "Seated Forward Fold", duration: "2 minutes", instructions: "Sit with legs extended, reach forward toward toes." },
      { name: "Child's Pose", duration: "2 minutes", instructions: "Kneel and sit back on heels, extend arms forward on the ground." }
    ]
  },
  emom: {
    warmup: [
      { name: "Light Jog", duration: "3 minutes", instructions: "Jog at an easy pace to warm up your body." },
      { name: "Dynamic Stretching", duration: "2 minutes", instructions: "Leg swings, arm swings, and torso twists." }
    ],
    main: [
      { name: "Push-ups", duration: "Minute 1: 15 reps", instructions: "Complete 15 push-ups within the minute, rest the remainder." },
      { name: "Air Squats", duration: "Minute 2: 20 reps", instructions: "Complete 20 air squats within the minute, rest the remainder." },
      { name: "Sit-ups", duration: "Minute 3: 15 reps", instructions: "Complete 15 sit-ups within the minute, rest the remainder." },
      { name: "Burpees", duration: "Minute 4: 10 reps", instructions: "Complete 10 burpees within the minute, rest the remainder." }
    ],
    cooldown: [
      { name: "Walking", duration: "3 minutes", instructions: "Walk slowly to bring heart rate down." },
      { name: "Full Body Stretch", duration: "2 minutes", instructions: "Stretch all major muscle groups." }
    ]
  },
  amrap: {
    warmup: [
      { name: "Jump Rope", duration: "3 minutes", instructions: "Jump rope or simulate the movement." },
      { name: "Arm and Leg Swings", duration: "2 minutes", instructions: "Dynamic stretching for arms and legs." }
    ],
    main: [
      { name: "AMRAP Circuit", duration: "15 minutes", instructions: "Complete as many rounds as possible of: 10 push-ups, 15 squats, 20 mountain climbers, 10 burpees." }
    ],
    cooldown: [
      { name: "Slow Walk", duration: "3 minutes", instructions: "Walk slowly to recover." },
      { name: "Stretching", duration: "2 minutes", instructions: "Focus on stretching worked muscles." }
    ]
  },
  hiit: {
    warmup: [
      { name: "Light Cardio", duration: "3 minutes", instructions: "Jog in place or march with high knees." },
      { name: "Dynamic Stretches", duration: "2 minutes", instructions: "Leg swings, arm circles, torso twists." }
    ],
    main: [
      { name: "High Knees", duration: "45s work, 15s rest", instructions: "Run in place with knees up high." },
      { name: "Push-ups", duration: "45s work, 15s rest", instructions: "Perform as many push-ups as possible." },
      { name: "Jump Squats", duration: "45s work, 15s rest", instructions: "Squat and explode into a jump." },
      { name: "Plank", duration: "45s work, 15s rest", instructions: "Hold a plank position." }
    ],
    cooldown: [
      { name: "Walking", duration: "3 minutes", instructions: "Walk to lower heart rate." },
      { name: "Full Body Stretch", duration: "2 minutes", instructions: "Stretch all muscle groups." }
    ]
  },
  circuit: {
    warmup: [
      { name: "Jumping Jacks", duration: "3 minutes", instructions: "Jump while spreading legs and raising arms." },
      { name: "Arm Circles", duration: "2 minutes", instructions: "Make circles with arms extended." }
    ],
    main: [
      { name: "Circuit Round 1", duration: "Complete 3-4 rounds", instructions: "10 Push-ups, 15 Squats, 20 Sit-ups, 10 Burpees. Rest 90 seconds between rounds." }
    ],
    cooldown: [
      { name: "Slow Walk", duration: "3 minutes", instructions: "Walk slowly to recover." },
      { name: "Stretching", duration: "2 minutes", instructions: "Stretch all major muscle groups." }
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

    const systemPrompt = `You are a fitness AI that generates ${framework.toUpperCase()} workouts.

${frameworkRules[framework] || ''}

CRITICAL RULES:
1. Return ONLY valid JSON, no markdown, no code blocks
2. Use this exact structure:
{
  "warmup": [{"name": "Exercise", "duration": "X minutes", "instructions": "..."}],
  "main": [{"name": "Exercise", "duration": "X rounds/minutes", "instructions": "..."}],
  "cooldown": [{"name": "Exercise", "duration": "X minutes", "instructions": "..."}]
}
3. Keep instructions clear and concise
4. Match the ${framework} format exactly
5. Total workout should be approximately ${duration} minutes`;

    const userPrompt = `Generate a ${framework} workout:
- Goal: ${goal}
- Fitness Level: ${fitnessLevel}
- Equipment: ${equipment.join(', ')}
- Duration: ${duration} minutes

Remember: Return ONLY the JSON object, no other text.`;

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
        temperature: 0.7,
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
