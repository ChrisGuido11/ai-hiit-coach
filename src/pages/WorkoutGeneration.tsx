import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { generateWorkout, GeneratedWorkout } from "@/lib/generateWorkout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserPreferences {
  fitness_level: string;
  available_equipment: string[];
  workout_duration: string;
}

const defaultPreferences: UserPreferences = {
  fitness_level: "intermediate",
  available_equipment: ["bodyweight"],
  workout_duration: "20"
};

const WorkoutGeneration = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { framework, goal } = location.state || {};
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const generate = async () => {
      try {
        // Step 1: Get current user (optional - we can still generate without auth)
        const { data: { user } } = await supabase.auth.getUser();

        // Step 2: Fetch user preferences from Supabase
        let preferences = defaultPreferences;

        if (user) {
          const { data: prefData, error: prefError } = await supabase
            .from("user_preferences")
            .select("fitness_level, available_equipment, workout_duration")
            .eq("user_id", user.id)
            .single();

          if (prefError) {
            console.log("No preferences found, using defaults:", prefError.message);
          } else if (prefData) {
            preferences = {
              fitness_level: prefData.fitness_level || defaultPreferences.fitness_level,
              available_equipment: prefData.available_equipment || defaultPreferences.available_equipment,
              workout_duration: prefData.workout_duration || defaultPreferences.workout_duration
            };
          }
        }

        console.log("Using preferences:", preferences);

        // Step 3: Generate workout using AI
        const { workout, usedFallback } = await generateWorkout({
          framework: framework || "custom",
          goal,
          fitnessLevel: preferences.fitness_level,
          equipment: preferences.available_equipment,
          duration: preferences.workout_duration
        });

        if (!isMounted) return;

        // Show toast if using fallback
        if (usedFallback) {
          toast({
            title: "Using default workout",
            description: "AI generation unavailable. Here's a great workout for you!",
            variant: "default"
          });
        }

        // Step 4: Save workout to Supabase (only if user is logged in)
        let savedWorkoutId: string | null = null;

        if (user) {
          const { data: savedWorkout, error: saveError } = await supabase
            .from("workouts")
            .insert([{
              user_id: user.id,
              framework_type: framework || "custom",
              exercises: workout as any,
              completed: false
            }])
            .select("id")
            .single();

          if (saveError) {
            console.error("Failed to save workout to database:", saveError);
            // Continue anyway - user can still see the workout
          } else {
            savedWorkoutId = savedWorkout?.id || null;
            console.log("Workout saved with ID:", savedWorkoutId);
          }
        }

        // Step 5: Navigate to workout details screen
        navigate(`/workout/${framework || 'custom'}`, {
          state: {
            workout,
            workoutId: savedWorkoutId,
            goal,
            framework
          },
          replace: true
        });

      } catch (err) {
        console.error("Error in workout generation:", err);
        if (isMounted) {
          setError(true);
          setErrorMessage(err instanceof Error ? err.message : "Failed to generate workout");
        }
      }
    };

    generate();

    return () => {
      isMounted = false;
    };
  }, [framework, goal, navigate, toast]);

  const handleRetry = () => {
    setError(false);
    setErrorMessage("");
    // Re-trigger the generation by remounting the effect
    window.location.reload();
  };

  const handleGoBack = () => {
    navigate("/home");
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-warm flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">!</span>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-3">
            Oops! Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground mb-2">
            Failed to generate workout
          </p>
          {errorMessage && (
            <p className="text-xs text-red-400/80 mb-6">
              {errorMessage}
            </p>
          )}
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleRetry}
              className="w-full"
              size="lg"
            >
              Try Again
            </Button>
            <Button
              onClick={handleGoBack}
              variant="ghost"
              className="w-full"
              size="lg"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm flex items-center justify-center p-6">
      <div className="flex flex-col items-center max-w-md mx-auto text-center">
        {/* Simple loading icon circle */}
        <div className="relative mb-8">
          <div
            className="relative rounded-full bg-gradient-primary w-20 h-20 flex items-center justify-center glow-primary"
            style={{
              animation: "activeBreath 1.5s ease-in-out infinite",
            }}
          >
            {/* Inner glow */}
            <div className="absolute inset-4 rounded-full bg-white/40 blur-xl" />
          </div>
        </div>

        {/* Status Text */}
        <h1 className="text-xl font-semibold text-foreground mb-3">
          Creating your personalized workout...
        </h1>

        <p className="text-sm text-muted-foreground mb-6">
          {goal
            ? `Our AI is designing a workout for: ${goal}`
            : `Our AI is designing the perfect ${framework?.toUpperCase()} workout for you`
          }
        </p>

        {/* Loading dots */}
        <div className="flex gap-2">
          <div
            className="w-2 h-2 rounded-full bg-primary"
            style={{ animation: "dotPulse 1.4s infinite 0s" }}
          />
          <div
            className="w-2 h-2 rounded-full bg-primary"
            style={{ animation: "dotPulse 1.4s infinite 0.2s" }}
          />
          <div
            className="w-2 h-2 rounded-full bg-primary"
            style={{ animation: "dotPulse 1.4s infinite 0.4s" }}
          />
        </div>

        <style>{`
          @keyframes activeBreath {
            0%, 100% {
              transform: scale(1);
              opacity: 0.9;
            }
            50% {
              transform: scale(1.05);
              opacity: 1;
            }
          }

          @keyframes dotPulse {
            0%, 100% {
              opacity: 0.3;
              transform: scale(0.8);
            }
            50% {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default WorkoutGeneration;
