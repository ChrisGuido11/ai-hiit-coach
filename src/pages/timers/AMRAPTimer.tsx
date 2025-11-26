import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Pause, Play, X, ChevronDown, ChevronUp, Volume2, VolumeX, RefreshCw, SkipForward, Loader2 } from "lucide-react";
import { GeneratedWorkout, Exercise, generateReplacementExercise } from "@/lib/generateWorkout";
import { supabase } from "@/integrations/supabase/client";

type TimerPhase = "warmup" | "main" | "cooldown" | "complete";
type SideType = "right" | "left" | null;
type BodyPartType = "leg" | "arm" | "side";

interface TimerState {
  phase: TimerPhase;
  exerciseIndex: number; // Current exercise in main phase
  round: number; // Completed full rounds
  timeRemaining: number;
  isPaused: boolean;
}

interface WorkoutStats {
  totalTime: number;
  exercisesCompleted: number;
  roundsCompleted: number;
}

const TRANSITION_DURATION = 10;

// Default AMRAP duration (10 minutes = 600 seconds)
const DEFAULT_AMRAP_DURATION = 600;

// Phase-specific round counts for warmup/cooldown (AMRAP main phase has no rounds, just time)
const WARMUP_ROUNDS = 1;
const COOLDOWN_ROUNDS = 1;

// Side-switching exercise detection patterns
const SIDE_SWITCH_PATTERNS = [
  "each leg",
  "each side",
  "each arm",
  "per leg",
  "per side",
  "per arm",
  "alternating"
];

// Helper function to detect if exercise requires side switching
const isSideSwitchingExercise = (exercise: Exercise | undefined, phase: TimerPhase): boolean => {
  if (!exercise || !exercise.duration) return false;
  // Only apply to warmup and cooldown phases
  if (phase !== "warmup" && phase !== "cooldown") return false;

  const durationLower = exercise.duration.toLowerCase();
  const instructionsLower = exercise.instructions?.toLowerCase() || "";

  return SIDE_SWITCH_PATTERNS.some(pattern =>
    durationLower.includes(pattern) || instructionsLower.includes(pattern)
  );
};

// Helper function to determine the body part term (leg, arm, side)
const getBodyPartTerm = (exercise: Exercise): BodyPartType => {
  if (!exercise || !exercise.duration) return "side";
  const durationLower = exercise.duration.toLowerCase();
  const instructionsLower = exercise.instructions?.toLowerCase() || "";
  const combined = durationLower + " " + instructionsLower;

  if (combined.includes("leg")) return "leg";
  if (combined.includes("arm")) return "arm";
  return "side";
};

// Helper function to get side announcement text
const getSideAnnouncement = (side: SideType, bodyPart: BodyPartType): string => {
  if (!side) return "";
  const capitalizedSide = side.charAt(0).toUpperCase() + side.slice(1);
  const capitalizedPart = bodyPart.charAt(0).toUpperCase() + bodyPart.slice(1);
  return `${capitalizedSide} ${capitalizedPart}`;
};

const AMRAPTimer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { workout, workoutId, workoutDuration } = location.state || {};

  const [timerState, setTimerState] = useState<TimerState>({
    phase: "warmup",
    exerciseIndex: 0,
    round: 0, // Start at 0 for AMRAP
    timeRemaining: 0,
    isPaused: true,
  });
  const [isInitialized, setIsInitialized] = useState(false);

  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSkipWarmupConfirm, setShowSkipWarmupConfirm] = useState(false);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [isReplacingExercise, setIsReplacingExercise] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showExerciseList, setShowExerciseList] = useState(false);

  // Mutable workout state for exercise replacements
  const [workoutData, setWorkoutData] = useState<GeneratedWorkout | undefined>(undefined);
  const [stats, setStats] = useState<WorkoutStats>({
    totalTime: 0,
    exercisesCompleted: 0,
    roundsCompleted: 0,
  });

  // Side-switching state for warmup/cooldown exercises
  const [currentSide, setCurrentSide] = useState<SideType>("right");
  const [hasAnnouncedSwitch, setHasAnnouncedSwitch] = useState(false);

  // Transition countdown (for phase changes)
  const [transitionCountdown, setTransitionCountdown] = useState<number | null>(null);
  const [nextPhase, setNextPhase] = useState<TimerPhase | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const transitionRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const hasAnnouncedInitialRef = useRef<boolean>(false);

  // AMRAP duration in seconds (get from workout metadata or default to 10 minutes)
  const amrapDuration = workoutDuration
    ? parseInt(workoutDuration) * 60
    : DEFAULT_AMRAP_DURATION;

  // Log the duration for debugging
  console.log('AMRAP Timer - workoutDuration:', workoutDuration, 'amrapDuration (seconds):', amrapDuration);

  // Use workoutData if available (for exercise replacements), otherwise use passed workout
  const typedWorkout = workoutData || (workout as GeneratedWorkout | undefined);

  // Initialize workoutData from passed workout
  useEffect(() => {
    if (workout && !workoutData) {
      setWorkoutData(workout as GeneratedWorkout);
    }
  }, [workout, workoutData]);

  // Wake Lock API to prevent screen sleep
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch (err) {
        console.log("Wake Lock not supported or denied");
      }
    };

    requestWakeLock();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, []);

  // Re-acquire wake lock on visibility change
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && "wakeLock" in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        } catch (err) {
          console.log("Wake Lock re-acquisition failed");
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Initialize timer with first exercise duration
  useEffect(() => {
    if (!typedWorkout || isInitialized) return;

    const warmupExercises = typedWorkout.warmup || [];
    if (warmupExercises.length > 0) {
      const firstExercise = warmupExercises[0];
      if (!firstExercise || !firstExercise.duration) {
        console.error('Invalid warmup exercise data', firstExercise);
        return;
      }
      const match = firstExercise.duration.match(/(\d+)/);
      const duration = match ? parseInt(match[1], 10) : 45;

      setTimerState({
        phase: "warmup",
        exerciseIndex: 0,
        round: 1,
        timeRemaining: duration,
        isPaused: false,
      });

      setCurrentSide("right");
      setHasAnnouncedSwitch(false);

      setIsInitialized(true);
    } else {
      // No warmup, start with main AMRAP
      setTimerState({
        phase: "main",
        exerciseIndex: 0,
        round: 0,
        timeRemaining: amrapDuration,
        isPaused: false,
      });
      setIsInitialized(true);
    }
  }, [typedWorkout, isInitialized, amrapDuration]);

  // Voice announcement function
  const speak = useCallback((text: string, priority: boolean = false) => {
    if (!voiceEnabled || typeof window === "undefined") return;

    try {
      if ("speechSynthesis" in window) {
        if (priority) {
          window.speechSynthesis.cancel();
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.log("Speech synthesis not available");
    }
  }, [voiceEnabled]);

  // Announce first exercise with side information on initialization
  useEffect(() => {
    if (!isInitialized || !typedWorkout) return;

    if (hasAnnouncedInitialRef.current) return;
    hasAnnouncedInitialRef.current = true;

    const warmupExercises = typedWorkout.warmup || [];
    if (warmupExercises.length > 0) {
      const firstExercise = warmupExercises[0];
      const needsSideSwitch = isSideSwitchingExercise(firstExercise, "warmup");

      if (needsSideSwitch) {
        const bodyPart = getBodyPartTerm(firstExercise);
        const sideText = getSideAnnouncement("right", bodyPart);
        speak(`${firstExercise.name}, ${sideText}`, true);
      } else {
        speak(firstExercise.name, true);
      }
    } else {
      speak("AMRAP workout starting", true);
    }
  }, [isInitialized, typedWorkout, speak]);

  // Haptic feedback
  const vibrate = useCallback((pattern: number | number[]) => {
    try {
      if ("vibrate" in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (err) {
      // Vibration not supported
    }
  }, []);

  // Get current exercises based on phase
  const getCurrentExercises = useCallback((): Exercise[] => {
    if (!typedWorkout) return [];
    switch (timerState.phase) {
      case "warmup":
        return typedWorkout.warmup || [];
      case "main":
        return typedWorkout.main || [];
      case "cooldown":
        return typedWorkout.cooldown || [];
      default:
        return [];
    }
  }, [typedWorkout, timerState.phase]);

  const currentExercises = getCurrentExercises();
  const currentExercise = currentExercises[timerState.exerciseIndex];

  // Parse duration from exercise (for warmup/cooldown)
  const parseDuration = (duration: string): number => {
    const match = duration.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 45;
  };

  // Start phase transition
  const startPhaseTransition = useCallback((targetPhase: TimerPhase) => {
    setNextPhase(targetPhase);
    setTransitionCountdown(TRANSITION_DURATION);

    const phaseAnnouncement = targetPhase === "main"
      ? "AMRAP workout starting"
      : "Cool down starting";
    speak(phaseAnnouncement, true);
    vibrate([100, 50, 100]);
  }, [speak, vibrate]);

  // Move to next state - handles warmup/cooldown auto-advancement
  const advanceTimer = useCallback(() => {
    setTimerState((prev) => {
      // Warmup/Cooldown logic (auto-advance through exercises)
      if (prev.phase === "warmup" || prev.phase === "cooldown") {
        const exercises = prev.phase === "warmup"
          ? typedWorkout?.warmup || []
          : typedWorkout?.cooldown || [];
        const nextExerciseIndex = prev.exerciseIndex + 1;

        setStats(s => ({ ...s, exercisesCompleted: s.exercisesCompleted + 1 }));

        if (nextExerciseIndex < exercises.length) {
          // Next exercise in current round
          const nextExercise = exercises[nextExerciseIndex];
          if (!nextExercise || !nextExercise.duration) {
            console.error('Invalid next exercise data', nextExercise);
            return prev;
          }
          const nextDuration = parseDuration(nextExercise.duration);

          setCurrentSide("right");
          setHasAnnouncedSwitch(false);

          const needsSideSwitch = isSideSwitchingExercise(nextExercise, prev.phase);
          if (needsSideSwitch) {
            const bodyPart = getBodyPartTerm(nextExercise);
            const sideText = getSideAnnouncement("right", bodyPart);
            speak(`${nextExercise.name}, ${sideText}`, true);
          } else {
            speak(`${nextExercise.name}`, true);
          }

          vibrate([50]);
          return {
            ...prev,
            exerciseIndex: nextExerciseIndex,
            timeRemaining: nextDuration,
          };
        } else {
          // Finished all exercises in this phase - move to next phase
          if (prev.phase === "warmup") {
            const mainExercises = typedWorkout?.main || [];
            if (mainExercises.length > 0) {
              startPhaseTransition("main");
              return prev; // Keep current state during transition
            }
          } else {
            // Cooldown complete
            return { ...prev, phase: "complete" };
          }
        }
      }

      return prev;
    });
  }, [typedWorkout, speak, vibrate, startPhaseTransition]);

  // Handle transition countdown
  useEffect(() => {
    if (transitionCountdown === null || timerState.isPaused) {
      if (transitionRef.current) {
        clearInterval(transitionRef.current);
        transitionRef.current = null;
      }
      return;
    }

    transitionRef.current = setInterval(() => {
      setTransitionCountdown((prev) => {
        if (prev === null) return null;

        if (prev <= 1) {
          clearInterval(transitionRef.current!);
          transitionRef.current = null;

          // Transition complete - update timer state
          if (nextPhase === "main") {
            setTimerState((ts) => ({
              ...ts,
              phase: "main",
              exerciseIndex: 0,
              round: 0,
              timeRemaining: amrapDuration,
            }));
            speak("Go!", true);
            vibrate([100]);
          } else if (nextPhase === "cooldown") {
            const cooldownExercise = typedWorkout?.cooldown?.[0];
            const duration = cooldownExercise && cooldownExercise.duration
              ? parseDuration(cooldownExercise.duration)
              : 45;

            setTimerState((ts) => ({
              ...ts,
              phase: "cooldown",
              exerciseIndex: 0,
              round: 1,
              timeRemaining: duration,
            }));

            setCurrentSide("right");
            setHasAnnouncedSwitch(false);

            if (cooldownExercise) {
              const needsSideSwitch = isSideSwitchingExercise(cooldownExercise, "cooldown");
              if (needsSideSwitch) {
                const bodyPart = getBodyPartTerm(cooldownExercise);
                const sideText = getSideAnnouncement("right", bodyPart);
                speak(`${cooldownExercise.name}, ${sideText}`, true);
              } else {
                speak(cooldownExercise.name, true);
              }
              vibrate([100]);
            }
          }

          setNextPhase(null);
          return null;
        }

        // Countdown voice
        if (prev <= 3) {
          speak(prev.toString());
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (transitionRef.current) {
        clearInterval(transitionRef.current);
      }
    };
  }, [transitionCountdown, timerState.isPaused, nextPhase, amrapDuration, typedWorkout, speak, vibrate]);

  // Timer tick
  useEffect(() => {
    if (timerState.isPaused || timerState.phase === "complete" || transitionCountdown !== null) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimerState((prev) => {
        if (prev.timeRemaining <= 0) {
          return prev;
        }

        const newTime = prev.timeRemaining - 1;

        // Count down voice for last 10 seconds in main phase
        if (prev.phase === "main" && newTime <= 10 && newTime > 0) {
          speak(newTime.toString());
        }

        // Count down voice for last 3 seconds in warmup/cooldown
        if ((prev.phase === "warmup" || prev.phase === "cooldown") && newTime <= 3 && newTime > 0) {
          speak(newTime.toString());
        }

        // Track total time
        setStats(s => ({ ...s, totalTime: s.totalTime + 1 }));

        return { ...prev, timeRemaining: newTime };
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState.isPaused, timerState.phase, transitionCountdown, speak]);

  // Check for timer completion
  useEffect(() => {
    if (timerState.timeRemaining <= 0 && timerState.phase !== "complete" && transitionCountdown === null) {
      if (timerState.phase === "main") {
        // AMRAP main phase complete - move to cooldown or complete
        const cooldownExercises = typedWorkout?.cooldown || [];
        if (cooldownExercises.length > 0) {
          speak("Time's up! Great work!", true);
          vibrate([200, 100, 200, 100, 200]);
          startPhaseTransition("cooldown");
        } else {
          speak("Time's up! Workout complete!", true);
          vibrate([200, 100, 200, 100, 200]);
          setTimerState(prev => ({ ...prev, phase: "complete" }));
        }
      } else {
        // Warmup or cooldown phase complete
        advanceTimer();
      }
    }
  }, [timerState.timeRemaining, timerState.phase, transitionCountdown, typedWorkout, advanceTimer, speak, vibrate, startPhaseTransition]);

  // Halfway side switch announcement for warmup/cooldown exercises
  useEffect(() => {
    if (timerState.phase !== "warmup" && timerState.phase !== "cooldown") return;
    if (timerState.isPaused || transitionCountdown !== null) return;
    if (hasAnnouncedSwitch) return;
    if (!currentExercise || !currentExercise.duration) return;

    const needsSideSwitch = isSideSwitchingExercise(currentExercise, timerState.phase);
    if (!needsSideSwitch) return;

    const totalDuration = parseDuration(currentExercise.duration);
    const halfwayPoint = Math.floor(totalDuration / 2);

    if (timerState.timeRemaining === halfwayPoint && halfwayPoint > 0) {
      const bodyPart = getBodyPartTerm(currentExercise);
      const sideText = getSideAnnouncement("left", bodyPart);
      speak(`Switch, ${sideText}`, true);
      vibrate([100, 50, 100]);
      setCurrentSide("left");
      setHasAnnouncedSwitch(true);
    }
  }, [timerState.timeRemaining, timerState.phase, timerState.isPaused, transitionCountdown, currentExercise, hasAnnouncedSwitch, speak, vibrate]);

  // Handle manual exercise advancement in AMRAP main phase
  const handleTapToAdvance = useCallback(() => {
    if (timerState.phase !== "main") return;
    if (timerState.isPaused || transitionCountdown !== null) return;

    const mainExercises = typedWorkout?.main || [];
    const nextIndex = timerState.exerciseIndex + 1;

    if (nextIndex >= mainExercises.length) {
      // Completed full round
      setTimerState(prev => ({
        ...prev,
        round: prev.round + 1,
        exerciseIndex: 0,
      }));
      setStats(s => ({
        ...s,
        exercisesCompleted: s.exercisesCompleted + 1,
        roundsCompleted: s.roundsCompleted + 1,
      }));
      vibrate([100, 50, 100]);
      speak(`Round ${timerState.round + 1} complete!`, true);
    } else {
      // Move to next exercise
      setTimerState(prev => ({
        ...prev,
        exerciseIndex: nextIndex,
      }));
      setStats(s => ({ ...s, exercisesCompleted: s.exercisesCompleted + 1 }));
      vibrate([50]);
      speak(mainExercises[nextIndex].name, true);
    }
  }, [timerState.phase, timerState.isPaused, timerState.exerciseIndex, timerState.round, transitionCountdown, typedWorkout, vibrate, speak]);

  // Open pause menu
  const handlePauseMenuOpen = () => {
    if (!timerState.isPaused) {
      setTimerState((prev) => ({ ...prev, isPaused: true }));
      speak("Paused");
    }
    setShowPauseMenu(true);
  };

  // Resume from pause menu
  const handleResume = () => {
    setShowPauseMenu(false);
    setTimerState((prev) => ({ ...prev, isPaused: false }));
    speak("Resume");
  };

  // Toggle sound from pause menu
  const handleToggleSound = () => {
    setVoiceEnabled(!voiceEnabled);
  };

  // Show exit confirmation from pause menu
  const handleExitFromMenu = () => {
    setShowPauseMenu(false);
    setShowExitConfirm(true);
  };

  const handleExitConfirm = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
    }
    navigate(-1);
  };

  const handleExitCancel = () => {
    setShowExitConfirm(false);
  };

  // Replace Exercise from Pause Menu handlers
  const handleReplaceFromPauseMenu = () => {
    setShowReplaceConfirm(true);
  };

  const handleReplaceConfirmCancel = () => {
    setShowReplaceConfirm(false);
  };

  const handleReplaceConfirmExecute = async () => {
    if (!currentExercise || !typedWorkout || !workoutData) {
      setShowReplaceConfirm(false);
      return;
    }

    setShowReplaceConfirm(false);
    setIsReplacingExercise(true);

    try {
      const category: 'warmup' | 'main' | 'cooldown' = timerState.phase === 'warmup'
        ? 'warmup'
        : timerState.phase === 'cooldown'
          ? 'cooldown'
          : 'main';

      const allExercisesInWorkout: string[] = [
        ...workoutData.warmup.map(e => e.name),
        ...workoutData.main.map(e => e.name),
        ...workoutData.cooldown.map(e => e.name)
      ];

      const { exercise: newExercise } = await generateReplacementExercise({
        exerciseName: currentExercise.name,
        category,
        framework: 'amrap',
        fitnessLevel: 'intermediate',
        equipment: ['bodyweight'],
        allExercisesInWorkout
      });

      const updatedWorkout = { ...workoutData };
      const phaseKey = timerState.phase as 'warmup' | 'main' | 'cooldown';
      if (phaseKey === 'warmup') {
        updatedWorkout.warmup = [...workoutData.warmup];
        updatedWorkout.warmup[timerState.exerciseIndex] = newExercise;
      } else if (phaseKey === 'main') {
        updatedWorkout.main = [...workoutData.main];
        updatedWorkout.main[timerState.exerciseIndex] = newExercise;
      } else {
        updatedWorkout.cooldown = [...workoutData.cooldown];
        updatedWorkout.cooldown[timerState.exerciseIndex] = newExercise;
      }

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      setWorkoutData(updatedWorkout);

      if (timerState.phase === 'warmup' || timerState.phase === 'cooldown') {
        setCurrentSide('right');
        setHasAnnouncedSwitch(false);

        if (!newExercise || !newExercise.duration) {
          console.error('Invalid new exercise data', newExercise);
          return;
        }
        const match = newExercise.duration.match(/(\d+)/);
        const duration = match ? parseInt(match[1], 10) : 45;
        setTimerState(prev => ({
          ...prev,
          timeRemaining: duration,
          isPaused: false
        }));
      } else {
        // Main phase - just keep timer running, don't reset
        setTimerState(prev => ({
          ...prev,
          isPaused: false
        }));
      }

      setShowPauseMenu(false);

      setTimeout(() => {
        if (voiceEnabled) {
          if (timerState.phase === 'warmup' || timerState.phase === 'cooldown') {
            const needsSideSwitch = isSideSwitchingExercise(newExercise, timerState.phase);
            if (needsSideSwitch) {
              const bodyPart = getBodyPartTerm(newExercise);
              const sideText = getSideAnnouncement('right', bodyPart);
              speak(`${newExercise.name}, ${sideText}`, true);
            } else {
              speak(newExercise.name, true);
            }
          } else {
            speak(newExercise.name, true);
          }
        }
      }, 300);

      if (workoutId) {
        supabase
          .from('workouts')
          .update({
            exercises: updatedWorkout as any
          })
          .eq('id', workoutId)
          .then(({ error }) => {
            if (error) {
              console.error('Failed to update workout in database:', error);
            }
          });
      }

    } catch (error) {
      console.error('Failed to replace exercise:', error);
      alert('Failed to generate replacement exercise. Please try again.');
    } finally {
      setIsReplacingExercise(false);
    }
  };

  // Skip warm-up handlers
  const handleSkipWarmupClick = () => {
    setTimerState((prev) => ({ ...prev, isPaused: true }));
    setShowSkipWarmupConfirm(true);
  };

  const handleSkipWarmupCancel = () => {
    setShowSkipWarmupConfirm(false);
  };

  const handleSkipWarmupConfirm = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (transitionRef.current) {
      clearInterval(transitionRef.current);
      transitionRef.current = null;
    }

    setShowSkipWarmupConfirm(false);

    const mainExercises = typedWorkout?.main || [];
    if (mainExercises.length > 0) {
      setTimerState({
        phase: "main",
        exerciseIndex: 0,
        round: 0,
        timeRemaining: amrapDuration,
        isPaused: false,
      });

      speak(`AMRAP workout starting!`, true);
      vibrate([100, 50, 100]);
    }
  };

  const handleComplete = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
    }
    navigate("/home");
  };

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Completion screen
  if (timerState.phase === "complete") {
    const totalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

    return (
      <div className="min-h-screen bg-gradient-warm flex flex-col items-center justify-center p-6">
        <style>{`
          @keyframes celebration {
            0%, 100% { transform: scale(1) rotate(0deg); }
            25% { transform: scale(1.1) rotate(-5deg); }
            75% { transform: scale(1.1) rotate(5deg); }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulseGlow {
            0%, 100% { box-shadow: 0 0 40px rgba(254, 173, 99, 0.4); }
            50% { box-shadow: 0 0 60px rgba(254, 173, 99, 0.6); }
          }
          .celebration-icon { animation: celebration 0.6s ease-in-out infinite; }
          .fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
          .pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }
        `}</style>

        <div className="text-center">
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-8 pulse-glow celebration-icon"
            style={{
              background: 'linear-gradient(135deg, rgba(254, 173, 99, 0.3) 0%, rgba(254, 173, 99, 0.1) 100%)',
              border: '2px solid rgba(254, 173, 99, 0.4)',
            }}
          >
            <span className="text-6xl">🎉</span>
          </div>

          <h1 className="text-3xl font-bold mb-3 fade-in-up" style={{ color: '#1F2124' }}>
            Workout Complete!
          </h1>
          <p className="mb-8 fade-in-up" style={{ color: '#8F8A84', animationDelay: '0.1s' }}>
            Amazing work! You crushed that AMRAP session.
          </p>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3 mb-8 max-w-sm mx-auto fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(255, 255, 255, 0.92)',
                border: '1px solid rgba(255, 255, 255, 0.65)',
              }}
            >
              <p className="text-2xl font-bold" style={{ color: '#1F2124' }}>{formatTime(totalDuration)}</p>
              <p className="text-xs mt-1" style={{ color: '#8F8A84' }}>Duration</p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(255, 255, 255, 0.92)',
                border: '1px solid rgba(255, 255, 255, 0.65)',
              }}
            >
              <p className="text-2xl font-bold" style={{ color: '#1F2124' }}>{timerState.round}</p>
              <p className="text-xs mt-1" style={{ color: '#8F8A84' }}>Rounds</p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(255, 255, 255, 0.92)',
                border: '1px solid rgba(255, 255, 255, 0.65)',
              }}
            >
              <p className="text-2xl font-bold" style={{ color: '#1F2124' }}>
                {timerState.round > 0 ? `+${timerState.exerciseIndex}` : timerState.exerciseIndex}
              </p>
              <p className="text-xs mt-1" style={{ color: '#8F8A84' }}>Partial</p>
            </div>
          </div>

          <button
            onClick={handleComplete}
            className="px-10 py-4 rounded-2xl font-semibold text-lg transition-all active:scale-95 fade-in-up"
            style={{
              background: 'linear-gradient(90deg, #FEAD63, #FBCDA4)',
              boxShadow: '0 8px 32px rgba(254, 173, 99, 0.4)',
              color: '#FFFFFF',
              animationDelay: '0.3s',
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // No workout data
  if (!typedWorkout) {
    return (
      <div className="min-h-screen bg-gradient-warm flex items-center justify-center p-6">
        <div className="text-center">
          <p className="mb-4" style={{ color: '#8F8A84' }}>No workout data found</p>
          <button
            onClick={() => navigate("/home")}
            className="px-6 py-3 rounded-xl"
            style={{
              background: 'linear-gradient(90deg, #FEAD63, #FBCDA4)',
              color: '#FFFFFF',
            }}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Calculate progress for main phase
  const progress = timerState.phase === "main"
    ? 1 - (timerState.timeRemaining / amrapDuration)
    : 0;

  const ringSize = 280;
  const ringStrokeWidth = 14;
  const ringRadius = (ringSize - ringStrokeWidth) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringStrokeDashoffset = ringCircumference * (1 - progress);

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(90deg, #F5F1EE, #F8E0C8)' }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .fade-in { animation: fadeIn 0.3s ease-out; }
        .slide-up { animation: slideUp 0.3s ease-out; }
        .breathe { animation: breathe 3s ease-in-out infinite; }
      `}</style>

      {/* Pause Menu Modal */}
      {showPauseMenu && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 fade-in"
          style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(12px)' }}
          onClick={() => {}}
        >
          <div
            className="w-full max-w-[400px] rounded-3xl p-6 slide-up"
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: 'none',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.15)',
            }}
          >
            <h3 className="text-2xl font-bold text-center mb-6" style={{ color: '#1F2124' }}>Paused</h3>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleResume}
                disabled={isReplacingExercise}
                className="w-full py-4 rounded-full font-semibold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(90deg, #FEAD63, #FBCDA4)',
                  boxShadow: '0 8px 24px rgba(254, 173, 99, 0.4)',
                  color: '#FFFFFF',
                }}
              >
                <Play className="w-6 h-6" />
                Resume
              </button>

              <button
                onClick={handleReplaceFromPauseMenu}
                disabled={isReplacingExercise || transitionCountdown !== null}
                className="w-full py-3.5 rounded-full font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(31, 33, 36, 0.2)',
                  color: '#1F2124',
                }}
              >
                {isReplacingExercise ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5" />
                    Replace Exercise
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-4 mt-2">
                <button
                  onClick={handleToggleSound}
                  disabled={isReplacingExercise}
                  className="text-sm font-medium disabled:opacity-50 transition-opacity"
                  style={{ color: '#8F8A84' }}
                >
                  {voiceEnabled ? "Sound: On" : "Sound: Off"}
                </button>
                <span style={{ color: '#8F8A84' }}>•</span>
                <button
                  onClick={handleExitFromMenu}
                  disabled={isReplacingExercise}
                  className="text-sm font-medium disabled:opacity-50 transition-opacity"
                  style={{ color: '#8F8A84' }}
                >
                  End Workout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 fade-in"
          style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full max-w-[400px] rounded-3xl slide-up"
            style={{
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              padding: '32px 24px',
              boxShadow: '0 20px 60px rgba(15, 23, 42, 0.3)',
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{
                background: 'rgba(251, 113, 133, 0.15)',
                border: '2px solid rgba(251, 113, 133, 0.3)',
              }}
            >
              <X className="w-7 h-7" style={{ color: '#FB7185' }} />
            </div>

            <h3
              className="text-center mb-4"
              style={{
                color: '#1F2124',
                fontSize: '28px',
                fontWeight: '700',
              }}
            >
              Exit Workout?
            </h3>

            <p
              className="text-center mb-6"
              style={{
                color: '#8F8A84',
                fontSize: '16px',
                lineHeight: '1.5',
              }}
            >
              Your progress will be lost. Are you sure you want to exit?
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleExitCancel}
                className="flex-1 transition-all active:scale-95"
                style={{
                  height: '52px',
                  background: 'transparent',
                  border: '2px solid rgba(31, 33, 36, 0.15)',
                  borderRadius: '999px',
                  color: '#1F2124',
                  fontSize: '16px',
                  fontWeight: '600',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExitConfirm}
                className="flex-1 transition-all active:scale-95"
                style={{
                  height: '52px',
                  background: 'linear-gradient(90deg, #FB7185, #FDA4AF)',
                  border: 'none',
                  borderRadius: '999px',
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontWeight: '600',
                  boxShadow: '0 10px 30px rgba(251, 113, 133, 0.3)',
                }}
              >
                Exit Workout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skip Warm-up Confirmation Modal */}
      {showSkipWarmupConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 fade-in"
          style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full max-w-[400px] rounded-3xl slide-up"
            style={{
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              padding: '32px 24px',
              boxShadow: '0 20px 60px rgba(15, 23, 42, 0.3)',
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{
                background: 'rgba(254, 173, 99, 0.15)',
                border: '2px solid rgba(254, 173, 99, 0.3)',
              }}
            >
              <SkipForward className="w-7 h-7" style={{ color: '#FEAD63' }} />
            </div>

            <h3
              className="text-center mb-4"
              style={{
                color: '#1F2124',
                fontSize: '28px',
                fontWeight: '700',
              }}
            >
              Skip Warm-up?
            </h3>

            <p
              className="text-center mb-4"
              style={{
                color: '#8F8A84',
                fontSize: '16px',
                lineHeight: '1.5',
              }}
            >
              Are you sure you want to skip the warm-up and start the AMRAP workout?
            </p>

            <div
              className="mb-6"
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: '12px',
                padding: '12px',
              }}
            >
              <p
                className="text-center"
                style={{
                  color: '#F59E0B',
                  fontSize: '14px',
                  fontWeight: '500',
                  margin: 0,
                }}
              >
                ⚠️ Skipping warm-up may increase injury risk
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSkipWarmupCancel}
                className="flex-1 transition-all active:scale-95"
                style={{
                  height: '52px',
                  background: 'transparent',
                  border: '2px solid rgba(31, 33, 36, 0.15)',
                  borderRadius: '999px',
                  color: '#1F2124',
                  fontSize: '16px',
                  fontWeight: '600',
                }}
              >
                Continue Warm-up
              </button>
              <button
                onClick={handleSkipWarmupConfirm}
                className="flex-1 transition-all active:scale-95"
                style={{
                  height: '52px',
                  background: 'linear-gradient(90deg, #FEAD63, #FBCDA4)',
                  border: 'none',
                  borderRadius: '999px',
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontWeight: '600',
                  boxShadow: '0 10px 30px rgba(254, 173, 99, 0.3)',
                }}
              >
                Skip Warm-up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace Exercise Confirmation Modal */}
      {showReplaceConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 fade-in"
          style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 slide-up"
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.85)',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.15)',
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{
                background: 'rgba(254, 173, 99, 0.2)',
                border: '1px solid rgba(254, 173, 99, 0.3)',
              }}
            >
              <RefreshCw className="w-7 h-7" style={{ color: '#FEAD63' }} />
            </div>

            <h3 className="text-xl font-bold text-center mb-2" style={{ color: '#1F2124' }}>
              Replace Exercise?
            </h3>
            <p className="text-center mb-4" style={{ color: '#8F8A84' }}>
              Generate a new exercise to replace "<span className="font-medium" style={{ color: '#1F2124' }}>{currentExercise?.name}</span>"?
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleReplaceConfirmCancel}
                className="flex-1 py-3 rounded-xl font-semibold transition-all active:scale-95"
                style={{
                  background: 'transparent',
                  border: '2px solid rgba(31, 33, 36, 0.15)',
                  color: '#1F2124',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReplaceConfirmExecute}
                className="flex-1 py-3 rounded-xl font-semibold transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(90deg, #FEAD63, #FBCDA4)',
                  color: '#FFFFFF',
                }}
              >
                Replace & Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase Transition Overlay */}
      {transitionCountdown !== null && nextPhase && (
        <div
          className="fixed inset-0 z-40 flex flex-col items-center justify-center p-6 fade-in"
          style={{
            background: 'rgba(10, 31, 46, 0.95)',
            backdropFilter: 'blur(16px)'
          }}
        >
          <div className="text-center slide-up">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 breathe"
              style={{
                background: nextPhase === "main"
                  ? 'linear-gradient(135deg, rgba(254, 173, 99, 0.3) 0%, rgba(254, 173, 99, 0.1) 100%)'
                  : 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(168, 85, 247, 0.1) 100%)',
                boxShadow: nextPhase === "main"
                  ? '0 0 40px rgba(254, 173, 99, 0.4)'
                  : '0 0 40px rgba(168, 85, 247, 0.4)',
                border: `2px solid ${nextPhase === "cooldown" ? 'rgba(168, 85, 247, 0.5)' : 'rgba(254, 173, 99, 0.5)'}`,
              }}
            >
              <span className="text-5xl">
                {nextPhase === "main" ? "💪" : "🧘"}
              </span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              {nextPhase === "main" ? "AMRAP Starting" : "Cool-down Starting"}
            </h2>

            {nextPhase === "main" && (
              <p className="text-xl font-medium mb-8" style={{ color: '#FEAD63' }}>
                {formatTime(amrapDuration)} on the clock
              </p>
            )}

            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
              style={{
                background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
                border: '3px solid',
                borderColor: nextPhase === "cooldown" ? "#A855F7" : "#FEAD63",
                boxShadow: `0 0 30px ${nextPhase === "cooldown" ? 'rgba(168, 85, 247, 0.5)' : 'rgba(254, 173, 99, 0.5)'}`,
              }}
            >
              <span className="text-4xl font-bold text-white">{transitionCountdown}</span>
            </div>
          </div>
        </div>
      )}

      {/* TOP SAFE AREA SPACER */}
      <div style={{ height: 'var(--safe-area-top)' }} />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col px-4 overflow-hidden">

        {/* Phase Badge */}
        <div className="flex justify-center pt-8 pb-8">
          <div
            className="px-5 py-2 rounded-full text-sm font-semibold tracking-widest"
            style={{
              background: 'rgba(255, 255, 255, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: timerState.phase === "warmup" ? "#FF9500" : timerState.phase === "main" ? "#FEAD63" : "#A855F7",
              letterSpacing: '1px',
            }}
          >
            {timerState.phase === "warmup" && "WARM UP"}
            {timerState.phase === "main" && "AMRAP"}
            {timerState.phase === "cooldown" && "COOL DOWN"}
          </div>
        </div>

        {/* Timer Display Area */}
        <div className="flex justify-center">
          <div className="relative flex flex-col items-center">
            {timerState.phase === "main" && (
              <svg
                width={ringSize}
                height={ringSize}
                className="absolute transform -rotate-90"
              >
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringRadius}
                  fill="none"
                  stroke="rgba(254, 173, 99, 0.15)"
                  strokeWidth={12}
                />
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringRadius}
                  fill="none"
                  stroke="url(#progressGradient)"
                  strokeWidth={12}
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringStrokeDashoffset}
                  style={{
                    transition: 'stroke-dashoffset 0.3s ease-out',
                    filter: 'drop-shadow(0 0 12px rgba(254, 173, 99, 0.4))',
                  }}
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FEAD63" />
                    <stop offset="100%" stopColor="#FF8C42" />
                  </linearGradient>
                </defs>
              </svg>
            )}

            <div className="relative z-10 flex flex-col items-center justify-center" style={{ width: ringSize, height: ringSize }}>
              {timerState.phase === "main" ? (
                <>
                  <span className="font-bold tabular-nums leading-none" style={{ fontSize: '72px', color: '#1F2124', fontVariantNumeric: 'tabular-nums' }}>
                    {formatTime(timerState.timeRemaining)}
                  </span>
                  <div
                    className="mt-4 px-4 py-1.5 rounded-full text-xs font-medium"
                    style={{
                      background: 'rgba(255, 255, 255, 0.6)',
                      color: '#8F8A84',
                    }}
                  >
                    {timerState.round} rounds + {timerState.exerciseIndex}
                  </div>
                </>
              ) : (
                <>
                  <span className="font-bold tabular-nums leading-none" style={{ fontSize: '120px', color: '#1F2124', fontVariantNumeric: 'tabular-nums' }}>
                    {timerState.timeRemaining}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="h-6" />

        {/* Exercise Card or Tap Area */}
        {timerState.phase === "main" ? (
          <div className="max-w-[90%] w-full mx-auto">
            {/* Tap to Advance Button */}
            <div
              onClick={handleTapToAdvance}
              className="rounded-3xl p-8 text-center cursor-pointer transition-all active:scale-[0.98]"
              style={{
                background: 'rgba(254, 173, 99, 0.1)',
                border: '2px dashed rgba(254, 173, 99, 0.3)',
              }}
            >
              <h3 className="text-2xl font-bold mb-2" style={{ color: '#FEAD63' }}>
                {currentExercise?.name || "Tap to Start"}
              </h3>
              <p className="text-sm" style={{ color: '#8F8A84' }}>
                Tap when exercise complete
              </p>
            </div>

            {/* Exercise List Toggle */}
            <div className="mt-4">
              <button
                onClick={() => setShowExerciseList(!showExerciseList)}
                className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 transition-all"
                style={{
                  background: 'rgba(255, 255, 255, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.85)',
                  color: '#1F2124',
                }}
              >
                <span className="font-medium">Exercise List</span>
                {showExerciseList ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>

              {showExerciseList && (
                <div
                  className="mt-3 p-4 rounded-2xl slide-up"
                  style={{
                    background: 'rgba(255, 255, 255, 0.92)',
                    border: '1px solid rgba(255, 255, 255, 0.65)',
                    backdropFilter: 'blur(18px)',
                  }}
                >
                  <p className="text-xs font-semibold mb-3" style={{ color: '#8F8A84' }}>CIRCUIT:</p>
                  {currentExercises.map((ex, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 py-2"
                      style={{
                        color: idx < timerState.exerciseIndex ? '#8F8A84' : idx === timerState.exerciseIndex ? '#FEAD63' : '#1F2124',
                        fontWeight: idx === timerState.exerciseIndex ? '600' : '400',
                      }}
                    >
                      {idx < timerState.exerciseIndex && <span>✓</span>}
                      {idx === timerState.exerciseIndex && <span>→</span>}
                      <span>{idx + 1}. {ex.duration} - {ex.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : currentExercise && (
          <div
            className="max-w-[90%] w-full mx-auto rounded-3xl"
            style={{
              background: 'rgba(255, 255, 255, 0.92)',
              border: '1px solid rgba(255, 255, 255, 0.65)',
              borderRadius: '24px',
              padding: '24px',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.18)',
            }}
          >
            <h3 className="text-2xl font-bold mb-2 text-center" style={{ color: '#1F2124', lineHeight: '1.2' }}>
              {currentExercise.name}
            </h3>
            {isSideSwitchingExercise(currentExercise, timerState.phase) && currentSide && (
              <div className="flex items-center justify-center gap-2 mb-2 transition-all duration-300">
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
                  style={{
                    background: 'rgba(254, 173, 99, 0.2)',
                    border: '1px solid rgba(254, 173, 99, 0.3)',
                    color: '#1F2124',
                  }}
                >
                  {getSideAnnouncement(currentSide, getBodyPartTerm(currentExercise))}
                </span>
              </div>
            )}
            <p className="text-[15px] text-center" style={{ color: '#8F8A84', fontWeight: '400', lineHeight: '1.5', margin: 0 }}>
              {currentExercise.instructions}
            </p>
          </div>
        )}

        <div className="h-6" />

        {/* Primary Action Button */}
        <div className="flex justify-center items-center">
          <button
            onClick={handlePauseMenuOpen}
            className="w-16 h-16 rounded-full flex items-center justify-center active:scale-95 transition-all duration-200"
            style={{
              background: 'linear-gradient(90deg, #FEAD63, #FBCDA4)',
              boxShadow: '0 10px 30px rgba(254, 173, 99, 0.4)',
            }}
            aria-label="Open pause menu"
          >
            <Pause className="w-7 h-7 text-white" />
          </button>
        </div>

        {/* Skip Warm-up Button */}
        {timerState.phase === "warmup" && (
          <div className="mt-6 text-center">
            <button
              onClick={handleSkipWarmupClick}
              className="text-sm font-semibold active:opacity-70 transition-opacity"
              style={{ color: '#FEAD63' }}
            >
              Skip Warm-up →
            </button>
          </div>
        )}

        <div className="h-4" />

      </div>

      {/* BOTTOM SAFE AREA SPACER */}
      <div style={{ height: 'var(--safe-area-bottom)' }} />

    </div>
  );
};

export default AMRAPTimer;
