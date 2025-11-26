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

// Extensive fallback exercises by category (large lists to ensure uniqueness)
const fallbackExercises: Record<string, Array<{ name: string; duration: string; instructions: string }>> = {
  warmup: [
    { name: "Arm Circles", duration: "30 seconds each direction", instructions: "Extend arms and rotate in controlled circular motions" },
    { name: "Leg Swings", duration: "30 seconds each leg", instructions: "Swing leg forward and back, hold wall for balance" },
    { name: "Torso Twists", duration: "30 seconds", instructions: "Rotate upper body side to side with arms extended" },
    { name: "Hip Circles", duration: "30 seconds each direction", instructions: "Hands on hips, rotate hips in large controlled circles" },
    { name: "Jumping Jacks", duration: "45 seconds", instructions: "Jump feet wide while raising arms overhead, return to start" },
    { name: "High Knees", duration: "45 seconds", instructions: "Drive knees to hip height while pumping arms" },
    { name: "Neck Rolls", duration: "30 seconds", instructions: "Slowly roll head in circular motion to loosen neck muscles" },
    { name: "Shoulder Rolls", duration: "30 seconds", instructions: "Roll shoulders forward then backward in smooth motions" },
    { name: "Ankle Circles", duration: "30 seconds each ankle", instructions: "Rotate ankle in circles, both directions" },
    { name: "Wrist Circles", duration: "30 seconds", instructions: "Rotate wrists in circular motions to warm up joints" },
    { name: "Cat-Cow Stretch", duration: "45 seconds", instructions: "On all fours, alternate between arching and rounding spine" },
    { name: "Inchworms", duration: "45 seconds", instructions: "Fold forward, walk hands to plank, walk feet back to hands" },
    { name: "High Knees March", duration: "45 seconds", instructions: "March in place lifting knees to hip height" },
    { name: "Butt Kicks", duration: "45 seconds", instructions: "Jog in place, kicking heels toward glutes" },
    { name: "Lateral Lunges", duration: "30 seconds each side", instructions: "Step wide to side, bend one knee while keeping other leg straight" },
    { name: "Arm Swings", duration: "30 seconds", instructions: "Swing arms across body dynamically to loosen shoulders" },
    { name: "World's Greatest Stretch", duration: "45 seconds", instructions: "Lunge with rotation, opening chest toward front leg" },
    { name: "Knee Hugs", duration: "30 seconds", instructions: "Standing, pull knee to chest alternating legs" },
    { name: "Leg Cradles", duration: "30 seconds each leg", instructions: "Cradle shin and pull knee toward chest while standing" },
    { name: "Standing Side Bends", duration: "30 seconds each side", instructions: "Reach arm overhead and lean to opposite side" }
  ],
  main_tabata: [
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
    { name: "Reverse Lunges", duration: "20s work / 10s rest", instructions: "Step back into lunge, keep front knee over ankle" },
    { name: "Broad Jumps", duration: "20s work / 10s rest", instructions: "Explosive forward jump, landing softly in squat position" },
    { name: "Scissor Jumps", duration: "20s work / 10s rest", instructions: "Split stance, jump and switch legs rapidly" }
  ],
  main_emom: [
    { name: "Push-ups", duration: "10 reps", instructions: "Lower chest to floor, push up with full arm extension" },
    { name: "Air Squats", duration: "15 reps", instructions: "Sit back and down past parallel, weight in heels, chest up" },
    { name: "Sit-ups", duration: "12 reps", instructions: "Lie flat, engage core, curl up to touch toes" },
    { name: "Lunges", duration: "10 reps", instructions: "Step forward into lunge, both knees at 90 degrees, alternate legs" },
    { name: "Burpees", duration: "8 reps", instructions: "Drop to plank, perform push-up, jump feet forward, explode up" },
    { name: "Mountain Climbers", duration: "20 reps", instructions: "Hold plank position, rapidly alternate driving knees to chest" },
    { name: "Jump Squats", duration: "10 reps", instructions: "Lower into squat, explode upward, land softly with bent knees" },
    { name: "Plank Hold", duration: "45 seconds", instructions: "Hold rigid plank position from forearms" },
    { name: "Bicycle Crunches", duration: "15 reps", instructions: "Lie on back, alternate elbow to opposite knee in cycling motion" },
    { name: "Box Jumps", duration: "8 reps", instructions: "Jump onto elevated surface, step back down" },
    { name: "Kettlebell Swings", duration: "12 reps", instructions: "Hinge at hips, swing weight to shoulder height" },
    { name: "Dumbbell Thrusters", duration: "10 reps", instructions: "Squat with weights, stand and press overhead" }
  ],
  main_amrap: [
    { name: "Burpees", duration: "5 reps", instructions: "Drop to plank with push-up, jump feet forward, explode up" },
    { name: "Air Squats", duration: "10 reps", instructions: "Sit back past parallel, drive through heels to stand" },
    { name: "Push-ups", duration: "10 reps", instructions: "Lower chest to floor, maintain rigid plank throughout" },
    { name: "Sit-ups", duration: "15 reps", instructions: "Engage core, curl up fully, control the descent" },
    { name: "Jumping Lunges", duration: "10 reps", instructions: "Lunge position, jump and switch legs mid-air, land softly" },
    { name: "Mountain Climbers", duration: "15 reps", instructions: "Hold plank position, rapidly alternate driving knees to chest" },
    { name: "Box Jumps", duration: "8 reps", instructions: "Jump onto elevated surface, step back down" },
    { name: "Kettlebell Swings", duration: "10 reps", instructions: "Hinge at hips, swing weight to shoulder height" },
    { name: "Toes to Bar", duration: "8 reps", instructions: "Hang from bar, lift toes to touch the bar" },
    { name: "Double Unders", duration: "20 reps", instructions: "Jump rope passing under feet twice per jump" }
  ],
  main_circuit: [
    { name: "Squats", duration: "45 seconds", instructions: "Feet shoulder-width, sit back and down, keep chest up" },
    { name: "Push-ups", duration: "45 seconds", instructions: "Maintain plank position, lower chest to floor with control" },
    { name: "Reverse Lunges", duration: "45 seconds", instructions: "Step back into lunge, keep front knee over ankle" },
    { name: "Plank Hold", duration: "45 seconds", instructions: "Forearms on ground, maintain straight line from head to heels" },
    { name: "Jumping Jacks", duration: "45 seconds", instructions: "Jump feet wide while raising arms overhead, return to start" },
    { name: "Mountain Climbers", duration: "45 seconds", instructions: "Hold plank position, rapidly alternate driving knees to chest" },
    { name: "Burpees", duration: "45 seconds", instructions: "Drop to plank, perform push-up, jump feet forward, explode up" },
    { name: "High Knees", duration: "45 seconds", instructions: "Run in place bringing knees to hip height, pump arms vigorously" },
    { name: "Bicycle Crunches", duration: "45 seconds", instructions: "Lie on back, alternate elbow to opposite knee in cycling motion" },
    { name: "Lateral Lunges", duration: "45 seconds", instructions: "Step wide to side, bend one knee while keeping other leg straight" }
  ],
  cooldown: [
    { name: "Quad Stretch", duration: "30 seconds each leg", instructions: "Stand on one leg, pull heel to glutes, keep knees together" },
    { name: "Hamstring Stretch", duration: "30 seconds each leg", instructions: "Sit with legs extended, reach forward toward toes" },
    { name: "Shoulder Stretch", duration: "30 seconds each arm", instructions: "Pull arm across chest, hold at elbow with opposite hand" },
    { name: "Child's Pose", duration: "45 seconds", instructions: "Kneel and sit back on heels, extend arms forward on floor" },
    { name: "Standing Forward Fold", duration: "45 seconds", instructions: "Hinge at hips, let head hang, relax into the stretch" },
    { name: "Cat-Cow Stretch", duration: "45 seconds", instructions: "On all fours, alternate between arching and rounding spine" },
    { name: "Cobra Stretch", duration: "45 seconds", instructions: "Lie face down, push chest up while keeping hips on floor" },
    { name: "Butterfly Stretch", duration: "45 seconds", instructions: "Sit with soles of feet together, gently press knees down" },
    { name: "Seated Spinal Twist", duration: "30 seconds each side", instructions: "Sit tall, cross one leg over, rotate torso toward bent knee" },
    { name: "Pigeon Pose", duration: "45 seconds each side", instructions: "Bring knee forward, extend back leg, fold forward over front leg" },
    { name: "Figure Four Stretch", duration: "30 seconds each leg", instructions: "On back, cross ankle over knee, pull thigh toward chest" },
    { name: "Tricep Stretch", duration: "30 seconds each arm", instructions: "Reach arm overhead, bend elbow, push gently with other hand" },
    { name: "Lying Hamstring Stretch", duration: "30 seconds each leg", instructions: "On back, extend leg up, gently pull toward chest" },
    { name: "Neck Stretch", duration: "30 seconds each side", instructions: "Gently tilt ear toward shoulder, hold the stretch" },
    { name: "Hip Flexor Stretch", duration: "30 seconds each side", instructions: "Kneel in lunge position, push hips forward gently" },
    { name: "Chest Opener", duration: "45 seconds", instructions: "Clasp hands behind back, lift chest, squeeze shoulder blades" },
    { name: "Calf Stretch", duration: "30 seconds each leg", instructions: "Step one foot back, press heel down, lean forward" },
    { name: "Thread the Needle", duration: "30 seconds each side", instructions: "On all fours, reach one arm under body, rotate torso" },
    { name: "Happy Baby Pose", duration: "45 seconds", instructions: "On back, grab feet, pull knees toward armpits" },
    { name: "Supine Twist", duration: "30 seconds each side", instructions: "Lie on back, drop knees to one side, look opposite direction" }
  ]
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { exerciseName, category, framework, fitnessLevel, equipment, allExercisesInWorkout = [] } = await req.json();

    console.log('=== EDGE FUNCTION: EXERCISE REPLACEMENT DEBUG ===');
    console.log('Replacing:', exerciseName);
    console.log('All exercises in workout:', allExercisesInWorkout);

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    // Get appropriate fallback category
    const getFallbackKey = (cat: string, fw: string) => {
      if (cat === 'warmup') return 'warmup';
      if (cat === 'cooldown') return 'cooldown';
      const mainKey = `main_${fw}`;
      return fallbackExercises[mainKey] ? mainKey : 'main_tabata';
    };

    const fallbackKey = getFallbackKey(category, framework);
    const fallbackList = fallbackExercises[fallbackKey];

    // Get a random fallback exercise that's not in the workout at all
    const getRandomFallback = () => {
      // Filter out ALL exercises that are already in the workout (case-insensitive)
      const available = fallbackList.filter(e =>
        !allExercisesInWorkout.some(
          (existing: string) => existing.toLowerCase() === e.name.toLowerCase()
        )
      );

      console.log('Fallback list size:', fallbackList.length);
      console.log('Available after filtering:', available.length);

      if (available.length === 0) {
        console.log('No unique fallback available, returning first from list');
        return fallbackList[0];
      }

      const selected = available[Math.floor(Math.random() * available.length)];
      console.log('Selected fallback:', selected.name);
      return selected;
    };

    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured, using fallback');
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

    // Build list of exercises to avoid (all exercises currently in workout)
    const exercisesToAvoid = allExercisesInWorkout.length > 0
      ? allExercisesInWorkout.join(', ')
      : exerciseName;

    const systemPrompt = `You are a professional fitness trainer who creates unique, effective workout exercises. You NEVER repeat exercises and always provide creative alternatives.

Generate ONE unique ${categoryDescription}.

CRITICAL REQUIREMENTS:
1. Do NOT generate any of these exercises that are already in the workout: ${exercisesToAvoid}
2. The exercise you generate must be COMPLETELY DIFFERENT from all exercises listed above
3. Exercise must be appropriate for ${fitnessLevel} fitness level
4. Equipment available: ${equipment?.length > 0 ? equipment.join(', ') : 'bodyweight only'}
5. Provide a creative, effective exercise that targets different muscle groups than exercises already in the workout

DURATION FORMAT:
- Warm-up/Cool-down: "X seconds" or "X seconds each side/leg"
- Main workout (${framework}): ${durationFormat}

INSTRUCTIONS: ONE short sentence about proper form and technique only. No timing, reps, or rounds.

Return ONLY valid JSON (no markdown):
{"name": "Exercise Name", "duration": "format per rules", "instructions": "One sentence form cue"}`;

    const userPrompt = `Generate a single UNIQUE ${category} exercise to replace "${exerciseName}".
The workout already contains: ${exercisesToAvoid}
Generate something DIFFERENT from all of these.
Return ONLY the JSON object.`;

    console.log('Calling Lovable AI Gateway with Gemini 2.5 Flash for exercise replacement...');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.95, // Increased for more creativity/variety
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Gateway error:', response.status, errorText);
      
      // Handle rate limiting and payment errors
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded. Please try again in a moment.',
            exercise: getRandomFallback(),
            usedFallback: true 
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: 'AI credits depleted. Please add credits in Settings → Workspace → Usage.',
            exercise: getRandomFallback(),
            usedFallback: true 
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
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

    console.log('Raw AI response length:', generatedText.length);

    // Clean the response - remove markdown code blocks and any surrounding text
    generatedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Try to extract JSON if it's embedded in other text
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      generatedText = jsonMatch[0];
    }

    try {
      const exercise = JSON.parse(generatedText);

      // Validate the exercise object has required fields
      if (!exercise.name || !exercise.duration || !exercise.instructions) {
        throw new Error('Invalid exercise format');
      }

      console.log('Successfully generated replacement exercise:', exercise.name);

      // Note: Duplicate validation is now done on the client side with retry logic
      // The client will call this function again if a duplicate is returned

      return new Response(
        JSON.stringify({ exercise, usedFallback: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Response text (first 300 chars):', generatedText.substring(0, 300));
      
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
