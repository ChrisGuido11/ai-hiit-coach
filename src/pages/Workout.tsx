import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, RefreshCw, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const frameworkDetails: Record<string, { fullName: string; description: string; benefits: string }> = {
  tabata: {
    fullName: "Tabata Protocol",
    description: "High-intensity interval training with 20 seconds of maximum effort followed by 10 seconds of rest, repeated for 8 rounds (4 minutes total per exercise).",
    benefits: "Burns calories rapidly, improves cardiovascular fitness, and boosts metabolism for hours after your workout."
  },
  emom: {
    fullName: "Every Minute On the Minute",
    description: "Complete the prescribed reps at the start of each minute, then rest for the remainder of that 60-second window. When the next minute starts, you go again.",
    benefits: "Builds strength and endurance while teaching pace management and mental toughness under time pressure."
  },
  amrap: {
    fullName: "As Many Rounds As Possible",
    description: "Complete as many rounds of the exercise circuit as possible within the time limit, maintaining good form throughout.",
    benefits: "Maximizes workout density, improves work capacity, and provides measurable progress tracking session to session."
  },
  circuit: {
    fullName: "Circuit Training",
    description: "Move through a series of exercises with minimal rest between stations, completing multiple rounds of the full circuit.",
    benefits: "Provides full-body conditioning, keeps heart rate elevated, and efficiently combines strength and cardio training."
  }
};

// Helper function to format exercise display text
const formatExerciseDisplay = (exercise: any) => {
  if (exercise.type === "time") {
    return `${exercise.duration_seconds} seconds`;
  } else if (exercise.type === "reps") {
    return `${exercise.reps} reps`;
  } else if (exercise.type === "tabata") {
    return `${exercise.work_seconds}s work / ${exercise.rest_seconds}s rest`;
  } else if (exercise.type === "emom") {
    const reps = typeof exercise.reps === "number" ? exercise.reps : 
                 (typeof exercise.reps === "string" ? parseInt(exercise.reps) : null);
    if (!reps) {
      console.warn('EMOM exercise missing reps:', exercise.name, exercise);
      return ""; // Don't show broken subtitle
    }
    return `${reps} reps`;
  }
  return "";
};

const Workout = () => {
  const { framework } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSaved, setIsSaved] = useState(false);
  const [workoutData, setWorkoutData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const frameworkKey = framework?.toLowerCase() || "tabata";
  const details = frameworkDetails[frameworkKey] || frameworkDetails.tabata;

  useEffect(() => {
    const loadWorkout = async () => {
      // First, try to get workout data from navigation state
      if (location.state?.workoutData) {
        setWorkoutData(location.state.workoutData);
        
        // Debug EMOM data
        if (framework === 'emom') {
          console.log('DEBUG EMOM workoutData.sections.main:', location.state.workoutData?.sections?.main);
          location.state.workoutData?.sections?.main?.forEach((ex: any, i: number) => {
            console.log(`Exercise ${i}: type="${ex.type}", reps=${ex.reps} (${typeof ex.reps})`);
          });
        }
        
        setLoading(false);
        return;
      }

      // If no state, try to fetch from Supabase using workoutId
      if (location.state?.workoutId) {
        try {
          const { data, error } = await supabase
            .from('workouts')
            .select('exercises')
            .eq('id', location.state.workoutId)
            .single();

          if (error) throw error;
          setWorkoutData(data.exercises);
          
          // Debug EMOM data
          if (framework === 'emom' && data.exercises) {
            console.log('DEBUG EMOM workoutData.sections.main:', (data.exercises as any)?.sections?.main);
            (data.exercises as any)?.sections?.main?.forEach((ex: any, i: number) => {
              console.log(`Exercise ${i}: type="${ex.type}", reps=${ex.reps} (${typeof ex.reps})`);
            });
          }
        } catch (error) {
          console.error('Error loading workout:', error);
        }
      }
      
      setLoading(false);
    };

    loadWorkout();
  }, [location.state]);

  const handlePlayTutorial = (exerciseName: string) => {
    console.log(`Watch tutorial for ${exerciseName}`);
  };

  const handleReplaceExercise = (exerciseName: string) => {
    console.log(`Replace ${exerciseName}`);
  };

  const handleBeginWorkout = () => {
    console.log("Begin workout - navigate to timer screen");
  };

  const handleSaveWorkout = async () => {
    // For now, just toggle the UI state
    // In the future, this could update the workout in Supabase
    setIsSaved(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A1F2E] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading workout...</p>
        </div>
      </div>
    );
  }

  if (!workoutData) {
    return (
      <div className="min-h-screen bg-[#0A1F2E] flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">No workout found</h2>
          <p className="text-muted-foreground mb-6">Please generate a new workout</p>
          <Button onClick={() => navigate('/home')} className="bg-primary hover:bg-primary/90">
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  const { sections } = workoutData;

  return (
    <div className="min-h-screen bg-[#0A1F2E] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/home")}
          className="text-foreground hover:bg-foreground/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground capitalize">
          {frameworkKey}
        </h1>
        <div className="w-10" />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-32 scrollbar-hide">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Framework Description Card */}
          <div 
            className="rounded-2xl p-5 border"
            style={{
              backgroundColor: 'rgba(0, 217, 192, 0.08)',
              borderColor: 'rgba(0, 217, 192, 0.2)'
            }}
          >
            <h2 className="text-xl font-bold text-primary mb-3">
              {details.fullName}
            </h2>
            <p className="text-[15px] text-muted-foreground mb-4 leading-relaxed">
              {details.description}
            </p>
            <div className="flex items-start gap-2">
              <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold text-primary">Benefits: </span>
                <span className="text-muted-foreground">{details.benefits}</span>
              </div>
            </div>
          </div>

          {/* Warm-up Section */}
          {sections?.warmup && sections.warmup.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-lg font-bold text-foreground">Warm-up</h3>
                <div className="flex-1 h-0.5 bg-[#FF9500]" />
              </div>
              <div className="space-y-3">
                {sections.warmup.map((exercise: any, index: number) => (
                <div 
                  key={index}
                  className="rounded-xl p-4 border border-border/30"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: '#FF9500' }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-foreground mb-1">{exercise.name}</h4>
                      <p className="text-sm font-medium mb-2" style={{ color: '#FF9500' }}>
                        {formatExerciseDisplay(exercise)}
                      </p>
                      <p className="text-sm text-muted-foreground">{exercise.instructions}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePlayTutorial(exercise.name)}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"
                    >
                      <Play className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Main Workout Section */}
          {sections?.main && sections.main.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-lg font-bold text-foreground">Main Workout</h3>
                <div className="flex-1 h-0.5 bg-primary" />
              </div>
              <div className="space-y-3">
                {sections.main.map((exercise: any, index: number) => (
                <div 
                  key={index}
                  className="rounded-xl p-4 border border-border/30"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-foreground mb-1">{exercise.name}</h4>
                      <p className="text-sm text-primary font-medium mb-2">
                        {formatExerciseDisplay(exercise)}
                      </p>
                      <p className="text-sm text-muted-foreground">{exercise.instructions}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePlayTutorial(exercise.name)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Play className="w-5 h-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleReplaceExercise(exercise.name)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Cool-down Section */}
          {sections?.cooldown && sections.cooldown.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-lg font-bold text-foreground">Cool-down</h3>
                <div className="flex-1 h-0.5 bg-[#8B5CF6]" />
              </div>
              <div className="space-y-3">
                {sections.cooldown.map((exercise: any, index: number) => (
                <div 
                  key={index}
                  className="rounded-xl p-4 border border-border/30"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: '#8B5CF6' }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-foreground mb-1">{exercise.name}</h4>
                      <p className="text-sm font-medium mb-2" style={{ color: '#8B5CF6' }}>
                        {formatExerciseDisplay(exercise)}
                      </p>
                      <p className="text-sm text-muted-foreground">{exercise.instructions}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePlayTutorial(exercise.name)}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"
                    >
                      <Play className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Fixed Action Buttons */}
      <div 
        className="fixed bottom-0 left-0 right-0 p-6 space-y-3"
        style={{ 
          background: 'linear-gradient(to top, #0A1F2E 80%, transparent)',
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))'
        }}
      >
        <div className="max-w-2xl mx-auto space-y-3">
          <Button
            onClick={handleBeginWorkout}
            className="w-full h-14 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Begin Workout
          </Button>
          <Button
            onClick={handleSaveWorkout}
            variant="outline"
            className="w-full h-12 text-base font-medium border-border/50 transition-all duration-300"
            style={{
              backgroundColor: isSaved ? 'rgba(0, 217, 192, 0.1)' : 'rgba(255, 255, 255, 0.05)',
              borderColor: isSaved ? 'rgba(0, 217, 192, 0.3)' : 'rgba(255, 255, 255, 0.1)',
              color: isSaved ? '#00D9C0' : undefined
            }}
          >
            {isSaved ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Saved
              </>
            ) : (
              "Save Workout"
            )}
          </Button>
        </div>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default Workout;
