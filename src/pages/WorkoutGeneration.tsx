import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AIBlob } from "@/components/AIBlob";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const WorkoutGeneration = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { framework, goal } = location.state || {};
  const [error, setError] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const generateWorkout = async () => {
      setError(false);
      
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('User not authenticated');
        }

        // Call the edge function
        const { data: functionData, error: functionError } = await supabase.functions.invoke('generate-workout', {
          body: {
            frameworkType: framework || 'Tabata',
            sessionLengthMinutes: undefined, // Use user's preference
            userGoalText: goal
          }
        });

        if (functionError) {
          console.error('Edge function error:', functionError);
          throw functionError;
        }

        if (isCancelled) return;

        // Navigate to workout details with the generated data
        navigate(`/workout/${framework || 'custom'}`, { 
          state: { 
            workoutId: functionData.workoutId,
            workoutData: functionData.workoutData,
            framework 
          },
          replace: true 
        });

      } catch (err) {
        console.error('Error generating workout:', err);
        if (!isCancelled) {
          setError(true);
        }
      }
    };

    generateWorkout();

    return () => {
      isCancelled = true;
    };
  }, [framework, goal, navigate]);

  const handleRetry = () => {
    window.location.reload();
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A1F2E] flex items-center justify-center p-6">
        <div className="max-w-md mx-auto">
          {/* Error Card */}
          <div 
            className="rounded-xl p-6 border text-center"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 107, 107, 0.6)'
            }}
          >
            <h2 className="text-lg font-bold text-foreground mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-[#B0B8C1] mb-6">
              We couldn't generate your workout. Please try again.
            </p>
            <Button 
              onClick={handleRetry} 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A1F2E] flex items-center justify-center p-6">
      <div className="flex flex-col items-center max-w-md mx-auto text-center">
        {/* Active AI Blob with faster animation */}
        <div className="relative mb-8">
          <div
            className="relative rounded-full bg-gradient-to-br from-primary via-primary to-accent w-40 h-40 md:w-44 md:h-44"
            style={{
              animation: "activeBreath 1s ease-in-out infinite, spin 3s linear infinite",
              boxShadow: "0 0 60px rgba(0, 217, 192, 0.6)",
            }}
          >
            {/* Inner glow */}
            <div className="absolute inset-8 rounded-full bg-primary/40 blur-xl" />
          </div>

          {/* Outer glow rings */}
          <div className="absolute inset-0 animate-pulse">
            <div
              className="absolute inset-0 rounded-full bg-primary/20 blur-3xl"
              style={{
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            />
            <div
              className="absolute inset-4 rounded-full bg-primary/30 blur-2xl"
              style={{
                animation: "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite 0.3s",
              }}
            />
          </div>
        </div>

        {/* Status Text */}
        <h1 className="text-xl font-bold text-foreground mb-3">
          Creating your personalized workout...
        </h1>
        
        <p className="text-sm text-[#B0B8C1] mb-6">
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
              box-shadow: 0 0 60px rgba(0, 217, 192, 0.6);
            }
            50% {
              transform: scale(1.1);
              box-shadow: 0 0 80px rgba(0, 217, 192, 0.9);
            }
          }
          
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
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
