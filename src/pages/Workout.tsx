import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, RefreshCw, Check, Loader2 } from "lucide-react";
import { GeneratedWorkout, Exercise, generateReplacementExercise } from "@/lib/generateWorkout";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const frameworkDetails: Record<string, { fullName: string; description: string; benefits: string }> = {
  tabata: {
    fullName: "Tabata Protocol",
    description: "High-intensity interval training with 20 seconds of maximum effort followed by 10 seconds of rest, repeated for 8 rounds (4 minutes total per exercise).",
    benefits: "Burns calories rapidly, improves cardiovascular fitness, and boosts metabolism for hours after your workout."
  },
  emom: {
    fullName: "Every Minute On the Minute",
    description: "Complete a set number of reps at the start of each minute, then rest for the remainder. Repeat for the specified duration.",
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

const mockWorkout = {
  warmup: [
    { name: "Jumping Jacks", duration: "60 seconds", instructions: "Jump feet wide while raising arms overhead, return to start" },
    { name: "Arm Circles", duration: "30 seconds", instructions: "Extend arms and rotate in controlled circular motions" }
  ],
  main: [
    { name: "Bodyweight Squats", duration: "20s work / 10s rest", instructions: "Sit back and down with weight in heels, chest up" },
    { name: "Push-ups", duration: "20s work / 10s rest", instructions: "Lower chest to floor, maintain rigid plank throughout" },
    { name: "Mountain Climbers", duration: "20s work / 10s rest", instructions: "Hold plank position, rapidly alternate driving knees to chest" },
    { name: "Burpees", duration: "20s work / 10s rest", instructions: "Drop to plank, perform push-up, jump feet forward, explode up" }
  ],
  cooldown: [
    { name: "Quad Stretch", duration: "30 seconds each leg", instructions: "Stand on one leg, pull heel to glutes, keep knees together" },
    { name: "Hamstring Stretch", duration: "30 seconds each leg", instructions: "Sit with legs extended, reach forward toward toes" }
  ]
};

interface LocationState {
  workout?: GeneratedWorkout;
  workoutId?: string | null;
  goal?: string;
  framework?: string;
}

const Workout = () => {
  const { framework } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSaved, setIsSaved] = useState(false);

  // Get workout from navigation state, fallback to mock
  const locationState = location.state as LocationState | null;
  const [currentWorkout, setCurrentWorkout] = useState<GeneratedWorkout>(
    locationState?.workout || mockWorkout
  );
  const workoutId = locationState?.workoutId;

  // State for exercise replacement
  const [loadingExerciseIndex, setLoadingExerciseIndex] = useState<{
    category: 'warmup' | 'main' | 'cooldown';
    index: number;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    exercise: Exercise | null;
    index: number;
    category: 'warmup' | 'main' | 'cooldown';
  }>({
    isOpen: false,
    exercise: null,
    index: 0,
    category: 'warmup'
  });

  const frameworkKey = framework?.toLowerCase() || "tabata";
  const details = frameworkDetails[frameworkKey] || frameworkDetails.tabata;

  const handlePlayTutorial = (exerciseName: string) => {
    // Format the exercise name for URL (replace spaces with +)
    const searchQuery = `how to ${exerciseName}`.replace(/\s+/g, '+');

    // YouTube deep link (opens YouTube app on mobile)
    const youtubeDeepLink = `youtube://results?search_query=${searchQuery}`;

    // Fallback web URL
    const youtubeWebUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;

    // Try to open YouTube app first
    window.location.href = youtubeDeepLink;

    // Set a timeout to fallback to web if deep link doesn't work
    setTimeout(() => {
      window.open(youtubeWebUrl, '_blank');
    }, 500);
  };

  // Show confirmation dialog before replacing exercise
  const handleReplaceExercise = (
    exercise: Exercise,
    index: number,
    category: 'warmup' | 'main' | 'cooldown'
  ) => {
    setConfirmDialog({
      isOpen: true,
      exercise,
      index,
      category
    });
  };

  // Actually replace the exercise after confirmation
  const confirmReplaceExercise = async () => {
    const { exercise, index, category } = confirmDialog;
    if (!exercise) return;

    // Close dialog
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));

    // Set loading state
    setLoadingExerciseIndex({ category, index });

    try {
      // Build complete list of ALL exercises in the workout to avoid duplicates
      const allExercisesInWorkout: string[] = [
        ...currentWorkout.warmup.map(e => e.name),
        ...currentWorkout.main.map(e => e.name),
        ...currentWorkout.cooldown.map(e => e.name)
      ];

      console.log('All exercises in workout:', allExercisesInWorkout);

      // Generate replacement exercise with complete workout context
      const { exercise: newExercise } = await generateReplacementExercise({
        exerciseName: exercise.name,
        category,
        framework: frameworkKey,
        fitnessLevel: 'intermediate', // Default, could be fetched from user preferences
        equipment: ['bodyweight'], // Default, could be fetched from user preferences
        allExercisesInWorkout
      });

      // Update the workout with the new exercise
      const updatedWorkout = { ...currentWorkout };
      if (category === 'warmup') {
        updatedWorkout.warmup = [...currentWorkout.warmup];
        updatedWorkout.warmup[index] = newExercise;
      } else if (category === 'main') {
        updatedWorkout.main = [...currentWorkout.main];
        updatedWorkout.main[index] = newExercise;
      } else if (category === 'cooldown') {
        updatedWorkout.cooldown = [...currentWorkout.cooldown];
        updatedWorkout.cooldown[index] = newExercise;
      }

      // Update state
      setCurrentWorkout(updatedWorkout);

      // Update database if workout is saved
      if (workoutId) {
        const { error } = await supabase
          .from('workouts')
          .update({
            exercises: updatedWorkout as any
          })
          .eq('id', workoutId);

        if (error) {
          console.error('Failed to update workout in database:', error);
        }
      }

      console.log(`Successfully replaced ${exercise.name} with ${newExercise.name}`);

    } catch (error) {
      console.error('Failed to replace exercise:', error);
    } finally {
      setLoadingExerciseIndex(null);
    }
  };

  // Cancel the replacement
  const cancelReplaceExercise = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  // Check if a specific exercise is loading
  const isExerciseLoading = (category: 'warmup' | 'main' | 'cooldown', index: number) => {
    return loadingExerciseIndex?.category === category && loadingExerciseIndex?.index === index;
  };

  const handleBeginWorkout = () => {
    // Navigate to the appropriate timer based on framework
    if (frameworkKey === "tabata") {
      navigate("/workout/tabata/timer", {
        state: {
          workout: currentWorkout,
          workoutId,
          framework: frameworkKey,
        },
      });
    } else if (frameworkKey === "emom") {
      navigate("/workout/emom/timer", {
        state: {
          workout: currentWorkout,
          workoutId,
          framework: frameworkKey,
        },
      });
    } else if (frameworkKey === "amrap") {
      navigate("/workout/amrap/timer", {
        state: {
          workout: currentWorkout,
          workoutId,
          framework: frameworkKey,
        },
      });
    } else {
      // TODO: Add other framework timers
      console.log("Timer not yet implemented for:", frameworkKey);
    }
  };

  const handleSaveWorkout = () => {
    // If workout was already saved during generation, just update UI
    if (workoutId) {
      console.log("Workout already saved with ID:", workoutId);
    }
    setIsSaved(true);
  };

  return (
    <div className="min-h-screen bg-gradient-warm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/home")}
          className="text-foreground active:bg-foreground/10 active:scale-95 transition-transform"
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
          
          {/* Framework Description Card - Glassmorphism */}
          <div
            className="rounded-2xl p-5 border backdrop-blur-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(0, 217, 192, 0.12) 0%, rgba(0, 217, 192, 0.04) 100%)',
              borderColor: 'rgba(0, 217, 192, 0.25)',
              boxShadow: '0 8px 32px rgba(0, 217, 192, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
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
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-bold text-foreground">Warm-up</h3>
              <div
                className="flex-1 h-0.5 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #FF9500 0%, rgba(255, 149, 0, 0.1) 100%)'
                }}
              />
            </div>
            <div className="space-y-3">
              {currentWorkout.warmup.map((exercise, index) => (
                <div
                  key={index}
                  className="rounded-xl p-4 border backdrop-blur-lg"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 149, 0, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
                    borderColor: 'rgba(255, 149, 0, 0.15)',
                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, #FF9500 0%, #E68600 100%)',
                        boxShadow: '0 2px 8px rgba(255, 149, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                      }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-foreground mb-1">{exercise.name}</h4>
                      <p className="text-sm font-medium mb-2" style={{ color: '#FF9500' }}>
                        {exercise.duration}
                      </p>
                      <p className="text-sm text-muted-foreground">{exercise.instructions}</p>
                    </div>
                    <div className="flex gap-3 flex-shrink-0">
                      <button
                        onClick={() => handlePlayTutorial(exercise.name)}
                        className="w-16 h-16 rounded-2xl flex items-center justify-center active:scale-95 transition-all duration-200 hover:bg-white/40"
                        style={{
                          background: 'rgba(255, 255, 255, 0.25)',
                          border: '1px solid rgba(255, 255, 255, 0.4)',
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        <Play className="w-6 h-6 text-white" />
                      </button>
                      <button
                        onClick={() => handleReplaceExercise(exercise, index, 'warmup')}
                        disabled={isExerciseLoading('warmup', index)}
                        className="w-16 h-16 rounded-2xl flex items-center justify-center active:scale-95 transition-all duration-200 hover:bg-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: 'rgba(255, 255, 255, 0.25)',
                          border: '1px solid rgba(255, 255, 255, 0.4)',
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        {isExerciseLoading('warmup', index) ? (
                          <Loader2 className="w-6 h-6 animate-spin text-white" />
                        ) : (
                          <RefreshCw className="w-6 h-6 text-white" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Workout Section */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-bold text-foreground">Main Workout</h3>
              <div
                className="flex-1 h-0.5 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #00D9C0 0%, rgba(0, 217, 192, 0.1) 100%)'
                }}
              />
            </div>
            <div className="space-y-3">
              {currentWorkout.main.map((exercise, index) => (
                <div
                  key={index}
                  className="rounded-xl p-4 border backdrop-blur-lg"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0, 217, 192, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
                    borderColor: 'rgba(0, 217, 192, 0.15)',
                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, #00D9C0 0%, #00B8A3 100%)',
                        boxShadow: '0 2px 8px rgba(0, 217, 192, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                      }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-foreground mb-1">{exercise.name}</h4>
                      <p className="text-sm text-primary font-medium mb-2">
                        {exercise.duration}
                      </p>
                      <p className="text-sm text-muted-foreground">{exercise.instructions}</p>
                    </div>
                    <div className="flex gap-3 flex-shrink-0">
                      <button
                        onClick={() => handlePlayTutorial(exercise.name)}
                        className="w-16 h-16 rounded-2xl flex items-center justify-center active:scale-95 transition-all duration-200 hover:bg-white/40"
                        style={{
                          background: 'rgba(255, 255, 255, 0.25)',
                          border: '1px solid rgba(255, 255, 255, 0.4)',
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        <Play className="w-6 h-6 text-white" />
                      </button>
                      <button
                        onClick={() => handleReplaceExercise(exercise, index, 'main')}
                        disabled={isExerciseLoading('main', index)}
                        className="w-16 h-16 rounded-2xl flex items-center justify-center active:scale-95 transition-all duration-200 hover:bg-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: 'rgba(255, 255, 255, 0.25)',
                          border: '1px solid rgba(255, 255, 255, 0.4)',
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        {isExerciseLoading('main', index) ? (
                          <Loader2 className="w-6 h-6 animate-spin text-white" />
                        ) : (
                          <RefreshCw className="w-6 h-6 text-white" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cool-down Section */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-bold text-foreground">Cool-down</h3>
              <div
                className="flex-1 h-0.5 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #8B5CF6 0%, rgba(139, 92, 246, 0.1) 100%)'
                }}
              />
            </div>
            <div className="space-y-3">
              {currentWorkout.cooldown.map((exercise, index) => (
                <div
                  key={index}
                  className="rounded-xl p-4 border backdrop-blur-lg"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
                    borderColor: 'rgba(139, 92, 246, 0.15)',
                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, #8B5CF6 0%, #7C4DE8 100%)',
                        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                      }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-foreground mb-1">{exercise.name}</h4>
                      <p className="text-sm font-medium mb-2" style={{ color: '#8B5CF6' }}>
                        {exercise.duration}
                      </p>
                      <p className="text-sm text-muted-foreground">{exercise.instructions}</p>
                    </div>
                    <div className="flex gap-3 flex-shrink-0">
                      <button
                        onClick={() => handlePlayTutorial(exercise.name)}
                        className="w-16 h-16 rounded-2xl flex items-center justify-center active:scale-95 transition-all duration-200 hover:bg-white/40"
                        style={{
                          background: 'rgba(255, 255, 255, 0.25)',
                          border: '1px solid rgba(255, 255, 255, 0.4)',
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        <Play className="w-6 h-6 text-white" />
                      </button>
                      <button
                        onClick={() => handleReplaceExercise(exercise, index, 'cooldown')}
                        disabled={isExerciseLoading('cooldown', index)}
                        className="w-16 h-16 rounded-2xl flex items-center justify-center active:scale-95 transition-all duration-200 hover:bg-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: 'rgba(255, 255, 255, 0.25)',
                          border: '1px solid rgba(255, 255, 255, 0.4)',
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        {isExerciseLoading('cooldown', index) ? (
                          <Loader2 className="w-6 h-6 animate-spin text-white" />
                        ) : (
                          <RefreshCw className="w-6 h-6 text-white" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Action Buttons - Glassmorphism */}
      <div
        className="fixed bottom-0 left-0 right-0 p-6 pt-8 backdrop-blur-xl"
        style={{
          background: 'linear-gradient(to top, rgba(245, 241, 238, 0.98) 60%, rgba(245, 241, 238, 0.8) 80%, transparent)',
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
          borderTop: '1px solid rgba(255, 255, 255, 0.3)'
        }}
      >
        <div className="max-w-2xl mx-auto space-y-3">
          <Button
            onClick={handleBeginWorkout}
            size="lg"
            className="w-full text-base font-bold rounded-3xl"
          >
            Begin Workout
          </Button>
          <Button
            onClick={handleSaveWorkout}
            variant="ghost"
            className="w-full h-12 text-base font-medium transition-all duration-300 rounded-3xl active:scale-[0.98]"
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

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && cancelReplaceExercise()}>
        <AlertDialogContent className="rounded-3xl glass-card max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground text-lg font-bold">
              Replace Exercise?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Generate a new exercise to replace "{confirmDialog.exercise?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 sm:gap-3">
            <AlertDialogCancel
              onClick={cancelReplaceExercise}
              className="flex-1 h-11 rounded-full glass-pill hover:opacity-80"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReplaceExercise}
              className="flex-1 h-11 rounded-full bg-gradient-primary hover:opacity-90 text-primary-foreground font-semibold"
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Workout;
