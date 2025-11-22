import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { frameworkType, sessionLengthMinutes, userGoalText } = await req.json();
    
    // Get user ID from JWT
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Fetch user preferences
    const { data: prefs, error: prefsError } = await supabaseClient
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (prefsError) {
      console.error('Error fetching preferences:', prefsError);
      throw new Error('Failed to fetch user preferences');
    }

    const fitnessLevel = prefs.fitness_level;
    const fitnessGoal = prefs.fitness_goal;
    const availableEquipment = prefs.available_equipment;
    const workoutDuration = sessionLengthMinutes || parseInt(prefs.workout_duration) || 20;
    const goalText = userGoalText || fitnessGoal.join(', ');

    // Build framework-specific programming parameters
    let frameworkRules = '';
    
    if (frameworkType === 'Tabata') {
      frameworkRules = `
Tabata Protocol Rules:
- Each Tabata block is 4 minutes (20s work / 10s rest × 8 rounds)
- Beginner: 1-2 blocks (4-8 min main workout)
- Intermediate: 2-3 blocks (8-12 min main workout)
- Advanced: 3-4 blocks (12-16 min main workout)
- Each exercise in main section MUST have: type="tabata", work_seconds=20, rest_seconds=10, rounds=8
- Total session length target: ${workoutDuration} minutes (including warm-up and cool-down)
`;
    } else if (frameworkType === 'EMOM') {
      frameworkRules = `
EMOM (Every Minute On the Minute) Rules:
- User completes X reps at the start of each minute, rests for remainder
- Beginner: 10-12 minutes total, 8-12 reps per minute
- Intermediate: 12-15 minutes total, 12-18 reps per minute
- Advanced: 15-20 minutes total, 18-25 reps per minute
- Each exercise in main section MUST have: type="emom", reps=[number], minute_block_count=[minutes for this exercise]
- Total session length target: ${workoutDuration} minutes

IMPORTANT - Exercise Instructions Format:
- DO NOT explain the EMOM protocol in individual exercise instructions
- Each exercise's "instructions" field should be 1 SHORT sentence about form, technique, or breathing
- Examples: "Keep elbows close to ribs, body in straight line", "Sit hips back, chest proud, drive through heels"
- The EMOM timing/structure is shown in the framework description card, not in exercise cards
`;
    } else if (frameworkType === 'AMRAP') {
      frameworkRules = `
AMRAP (As Many Rounds As Possible) Rules:
- User completes as many rounds of the circuit as possible in the time limit
- Beginner: 10 minutes total, 8-12 reps per exercise
- Intermediate: 15 minutes total, 12-18 reps per exercise
- Advanced: 20 minutes total, 18-25 reps per exercise
- Each exercise in main section MUST have: type="reps", reps=[number]
- Total session duration: ${workoutDuration} minutes (this is the AMRAP time limit)
`;
    } else if (frameworkType === 'Circuit') {
      frameworkRules = `
Circuit Training Rules:
- Beginner: 4-5 exercises, 30s work / 15s rest, 2-3 rounds, 60s rest between rounds
- Intermediate: 5-6 exercises, 45s work / 15s rest, 3-4 rounds, 60s rest between rounds
- Advanced: 6-8 exercises, 60s work / 15s rest, 4-5 rounds, 90s rest between rounds
- Each exercise in main section MUST have: type="time", duration_seconds=[30/45/60 based on level]
- Include rounds and rest_between_rounds in metadata
- Total session length target: ${workoutDuration} minutes
`;
    }

    const systemPrompt = `You are an expert HIIT workout programmer. You create safe, effective workouts following strict framework rules.

Equipment available: ${availableEquipment.join(', ')}
Fitness level: ${fitnessLevel}
Goals: ${goalText}
Session length: ${workoutDuration} minutes

${frameworkRules}

CRITICAL JSON STRUCTURE - Return ONLY valid JSON, no other text:
{
  "framework": "${frameworkType}",
  "framework_meta": {
    "session_length_minutes": ${workoutDuration},
    "fitness_level": "${fitnessLevel}",
    "goal_focus": "${goalText}"
  },
  "sections": {
    "warmup": [
      {
        "name": "Exercise name",
        "type": "time",
        "duration_seconds": 60,
        "instructions": "Clear 1-2 sentence instruction"
      }
    ],
    "main": [
      // Use the correct type for this framework (tabata/emom/reps/time)
      // Include all required fields for that type
    ],
    "cooldown": [
      {
        "name": "Stretch name",
        "type": "time",
        "duration_seconds": 30,
        "instructions": "Clear instruction"
      }
    ]
  }
}

Rules:
- Warmup: 2-3 exercises, type="time", 30-60 seconds each
- Cooldown: 2-3 stretches, type="time", 30-45 seconds each
- Main: Follow framework rules EXACTLY
- Only use available equipment
- For EMOM exercises: instructions should be concise form/technique cues only (1 short sentence)
- For all other exercises: instructions must be clear and safe for the fitness level
- Return ONLY the JSON object, no markdown, no explanations`;

    const userPrompt = `Generate a ${workoutDuration}-minute ${frameworkType} workout for a ${fitnessLevel} user focusing on: ${goalText}`;

    // Call OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('Calling OpenAI for workout generation...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const generatedText = aiData.choices[0].message.content;
    
    console.log('Raw AI response:', generatedText);

    // Parse JSON from response
    let workoutData;
    try {
      // Remove markdown code blocks if present
      const cleanedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      workoutData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Attempted to parse:', generatedText);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Save workout to database
    const { data: workout, error: workoutError } = await supabaseClient
      .from('workouts')
      .insert({
        user_id: user.id,
        framework_type: frameworkType,
        exercises: workoutData,
        completed: false
      })
      .select('id, exercises')
      .single();

    if (workoutError) {
      console.error('Error saving workout:', workoutError);
      throw new Error('Failed to save workout to database');
    }

    console.log('Workout saved successfully:', workout.id);

    return new Response(
      JSON.stringify({
        workoutId: workout.id,
        workoutData: workout.exercises
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in generate-workout function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
