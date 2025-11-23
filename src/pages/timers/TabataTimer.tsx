import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Pause, Play, X, ChevronRight, Volume2, VolumeX, RefreshCw } from "lucide-react";
import { GeneratedWorkout, Exercise } from "@/lib/generateWorkout";

type TimerPhase = "warmup" | "main" | "cooldown" | "complete";
type IntervalType = "work" | "rest" | "exercise";
type TransitionType = "phase" | "exercise" | null;

interface TimerState {
  phase: TimerPhase;
  exerciseIndex: number;
  round: number;
  intervalType: IntervalType;
  timeRemaining: number;
  isPaused: boolean;
}

interface TransitionState {
  type: TransitionType;
  countdown: number;
  nextPhase?: TimerPhase;
  nextExerciseName?: string;
}

interface WorkoutStats {
  totalTime: number;
  exercisesCompleted: number;
  roundsCompleted: number;
}

const WORK_DURATION = 20;
const REST_DURATION = 10;
const TRANSITION_DURATION = 10;

// Phase-specific round counts (each round cycles through ALL exercises)
const WARMUP_ROUNDS = 2;
const MAIN_ROUNDS = 8;
const COOLDOWN_ROUNDS = 1; // Cooldown just goes through once

// Phase colors
const phaseColors = {
  warmup: {
    primary: "#FF9500",
    glow: "rgba(255, 149, 0, 0.5)",
    gradient: "linear-gradient(135deg, rgba(255, 149, 0, 0.15) 0%, rgba(255, 149, 0, 0.05) 100%)",
  },
  main: {
    primary: "#00D9C0",
    glow: "rgba(0, 217, 192, 0.5)",
    gradient: "linear-gradient(135deg, rgba(0, 217, 192, 0.15) 0%, rgba(0, 217, 192, 0.05) 100%)",
  },
  cooldown: {
    primary: "#8B5CF6",
    glow: "rgba(139, 92, 246, 0.5)",
    gradient: "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)",
  },
  work: {
    primary: "#00D9C0",
    glow: "rgba(0, 217, 192, 0.5)",
  },
  rest: {
    primary: "#64748B",
    glow: "rgba(100, 116, 139, 0.4)",
  },
};

const TabataTimer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { workout, workoutId } = location.state || {};

  const [timerState, setTimerState] = useState<TimerState>({
    phase: "warmup",
    exerciseIndex: 0,
    round: 1,
    intervalType: "exercise",
    timeRemaining: 0, // Will be initialized by useEffect
    isPaused: true, // Start paused until initialized
  });
  const [isInitialized, setIsInitialized] = useState(false);

  const [transition, setTransition] = useState<TransitionState | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [stats, setStats] = useState<WorkoutStats>({
    totalTime: 0,
    exercisesCompleted: 0,
    roundsCompleted: 0,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const transitionRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const typedWorkout = workout as GeneratedWorkout | undefined;

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
      const match = firstExercise.duration.match(/(\d+)/);
      const duration = match ? parseInt(match[1], 10) : 45;

      setTimerState({
        phase: "warmup",
        exerciseIndex: 0,
        round: 1,
        intervalType: "exercise",
        timeRemaining: duration,
        isPaused: false,
      });
      setIsInitialized(true);
    } else {
      // No warmup, start with main
      const mainExercises = typedWorkout.main || [];
      if (mainExercises.length > 0) {
        setTimerState({
          phase: "main",
          exerciseIndex: 0,
          round: 1,
          intervalType: "work",
          timeRemaining: WORK_DURATION,
          isPaused: false,
        });
        setIsInitialized(true);
      }
    }
  }, [typedWorkout, isInitialized]);

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

  // Get max rounds for current phase
  const getMaxRounds = useCallback((): number => {
    switch (timerState.phase) {
      case "warmup":
        return WARMUP_ROUNDS;
      case "main":
        return MAIN_ROUNDS;
      case "cooldown":
        return COOLDOWN_ROUNDS;
      default:
        return MAIN_ROUNDS;
    }
  }, [timerState.phase]);

  const maxRounds = getMaxRounds();

  // Get next exercise in the rotation (cycles within the round)
  const getNextExerciseInRotation = useCallback((): { exercise: Exercise | null; isNextRound: boolean; isNextPhase: boolean } => {
    const exercises = getCurrentExercises();
    const nextIndex = timerState.exerciseIndex + 1;

    if (nextIndex < exercises.length) {
      // Next exercise in current round
      return { exercise: exercises[nextIndex], isNextRound: false, isNextPhase: false };
    } else {
      // Finished all exercises in this round
      if (timerState.round < maxRounds) {
        // Start next round with first exercise
        return { exercise: exercises[0], isNextRound: true, isNextPhase: false };
      } else {
        // Move to next phase
        return { exercise: null, isNextRound: false, isNextPhase: true };
      }
    }
  }, [getCurrentExercises, timerState.exerciseIndex, timerState.round, maxRounds]);

  // Get next phase's first exercise name
  const getNextPhaseExercise = useCallback((): string | undefined => {
    if (!typedWorkout) return undefined;
    if (timerState.phase === "warmup" && typedWorkout.main?.length > 0) {
      return typedWorkout.main[0].name;
    }
    if (timerState.phase === "main" && typedWorkout.cooldown?.length > 0) {
      return typedWorkout.cooldown[0].name;
    }
    return undefined;
  }, [typedWorkout, timerState.phase]);

  // Parse duration from exercise (for warmup/cooldown)
  const parseDuration = (duration: string): number => {
    const match = duration.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 45;
  };

  // Get total duration for current interval
  const getTotalDuration = useCallback((): number => {
    if (timerState.phase === "main") {
      return timerState.intervalType === "work" ? WORK_DURATION : REST_DURATION;
    }
    if (currentExercise) {
      return parseDuration(currentExercise.duration);
    }
    return 45;
  }, [timerState.phase, timerState.intervalType, currentExercise]);

  // Calculate progress (0 to 1)
  const progress = timerState.timeRemaining / getTotalDuration();

  // Start phase transition
  const startPhaseTransition = useCallback((nextPhase: TimerPhase) => {
    setTransition({
      type: "phase",
      countdown: TRANSITION_DURATION,
      nextPhase,
      nextExerciseName: nextPhase === "main"
        ? typedWorkout?.main?.[0]?.name
        : typedWorkout?.cooldown?.[0]?.name,
    });

    const phaseAnnouncement = nextPhase === "main"
      ? "Main workout starting"
      : "Cool down starting";
    speak(phaseAnnouncement, true);
    vibrate([100, 50, 100]);
  }, [typedWorkout, speak, vibrate]);

  // Move to next state - cycles through exercises within each round
  const advanceTimer = useCallback(() => {
    setTimerState((prev) => {
      const phaseMaxRounds = prev.phase === "warmup" ? WARMUP_ROUNDS
        : prev.phase === "main" ? MAIN_ROUNDS
        : COOLDOWN_ROUNDS;

      // Main phase logic (Tabata intervals with exercise cycling)
      if (prev.phase === "main") {
        const mainExercises = typedWorkout?.main || [];

        if (prev.intervalType === "work") {
          // Work -> Rest
          speak("Rest", true);
          vibrate([50]);
          return {
            ...prev,
            intervalType: "rest",
            timeRemaining: REST_DURATION,
          };
        } else {
          // Rest -> Next exercise in rotation or next round
          const nextExerciseIndex = prev.exerciseIndex + 1;

          setStats(s => ({ ...s, exercisesCompleted: s.exercisesCompleted + 1 }));

          if (nextExerciseIndex < mainExercises.length) {
            // Move to next exercise in the current round
            speak(`${mainExercises[nextExerciseIndex].name}!`, true);
            vibrate([100]);
            return {
              ...prev,
              exerciseIndex: nextExerciseIndex,
              intervalType: "work",
              timeRemaining: WORK_DURATION,
            };
          } else {
            // Finished all exercises in this round
            setStats(s => ({ ...s, roundsCompleted: s.roundsCompleted + 1 }));

            if (prev.round < phaseMaxRounds) {
              // Start next round, back to first exercise
              const nextRound = prev.round + 1;
              const isLastRound = nextRound === phaseMaxRounds;
              if (isLastRound) {
                speak(`Last round! ${mainExercises[0].name}!`, true);
              } else {
                speak(`Round ${nextRound}! ${mainExercises[0].name}!`, true);
              }
              vibrate([100, 50, 100]);
              return {
                ...prev,
                round: nextRound,
                exerciseIndex: 0,
                intervalType: "work",
                timeRemaining: WORK_DURATION,
              };
            } else {
              // Finished all rounds - move to cooldown
              const cooldownExercises = typedWorkout?.cooldown || [];
              if (cooldownExercises.length > 0) {
                startPhaseTransition("cooldown");
                return prev; // Keep current state during transition
              } else {
                return { ...prev, phase: "complete" };
              }
            }
          }
        }
      }

      // Warmup/Cooldown logic (cycling through exercises with rounds)
      const exercises = prev.phase === "warmup"
        ? typedWorkout?.warmup || []
        : typedWorkout?.cooldown || [];
      const nextExerciseIndex = prev.exerciseIndex + 1;

      setStats(s => ({ ...s, exercisesCompleted: s.exercisesCompleted + 1 }));

      if (nextExerciseIndex < exercises.length) {
        // Next exercise in current round
        const nextExercise = exercises[nextExerciseIndex];
        const nextDuration = parseDuration(nextExercise.duration);
        speak(`${nextExercise.name}`, true);
        vibrate([50]);
        return {
          ...prev,
          exerciseIndex: nextExerciseIndex,
          timeRemaining: nextDuration,
        };
      } else {
        // Finished all exercises in this round
        setStats(s => ({ ...s, roundsCompleted: s.roundsCompleted + 1 }));

        if (prev.round < phaseMaxRounds) {
          // Start next round, back to first exercise
          const nextRound = prev.round + 1;
          const firstExercise = exercises[0];
          const duration = parseDuration(firstExercise.duration);
          speak(`Round ${nextRound}! ${firstExercise.name}`, true);
          vibrate([100, 50, 100]);
          return {
            ...prev,
            round: nextRound,
            exerciseIndex: 0,
            timeRemaining: duration,
          };
        } else {
          // Move to next phase
          if (prev.phase === "warmup") {
            const mainExercises = typedWorkout?.main || [];
            if (mainExercises.length > 0) {
              startPhaseTransition("main");
              return prev; // Keep current state during transition
            }
          }
          return { ...prev, phase: "complete" };
        }
      }
    });
  }, [typedWorkout, speak, vibrate, startPhaseTransition]);

  // Handle transition countdown
  useEffect(() => {
    if (!transition || timerState.isPaused) {
      if (transitionRef.current) {
        clearInterval(transitionRef.current);
        transitionRef.current = null;
      }
      return;
    }

    transitionRef.current = setInterval(() => {
      setTransition((prev) => {
        if (!prev) return null;

        if (prev.countdown <= 1) {
          // Transition complete - update timer state
          clearInterval(transitionRef.current!);
          transitionRef.current = null;

          if (prev.type === "phase" && prev.nextPhase) {
            // Calculate duration for first exercise of new phase
            let duration = WORK_DURATION;
            if (prev.nextPhase === "cooldown") {
              const cooldownExercise = typedWorkout?.cooldown?.[0];
              if (cooldownExercise) {
                const match = cooldownExercise.duration.match(/(\d+)/);
                duration = match ? parseInt(match[1], 10) : 45;
              }
            }

            setTimerState((ts) => ({
              ...ts,
              phase: prev.nextPhase!,
              exerciseIndex: 0,
              round: 1,
              intervalType: prev.nextPhase === "main" ? "work" : "exercise",
              timeRemaining: duration,
            }));

            // Announce work start for main phase
            if (prev.nextPhase === "main") {
              speak("Work!", true);
              vibrate([100]);
            }
          } else if (prev.type === "exercise") {
            // Start next exercise in main phase
            setTimerState((ts) => ({
              ...ts,
              exerciseIndex: ts.exerciseIndex + 1,
              round: 1,
              intervalType: "work",
              timeRemaining: WORK_DURATION,
            }));
            speak("Work!", true);
            vibrate([100]);
          }

          return null;
        }

        // Countdown voice
        if (prev.countdown <= 3) {
          speak(prev.countdown.toString());
        }

        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);

    return () => {
      if (transitionRef.current) {
        clearInterval(transitionRef.current);
      }
    };
  }, [transition, timerState.isPaused, speak]);

  // Timer tick
  useEffect(() => {
    if (timerState.isPaused || timerState.phase === "complete" || transition) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimerState((prev) => {
        // Don't decrement if already at 0 (advanceTimer will handle)
        if (prev.timeRemaining <= 0) {
          return prev;
        }

        const newTime = prev.timeRemaining - 1;

        // Count down voice for last 3 seconds
        if (newTime <= 3 && newTime > 0) {
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
  }, [timerState.isPaused, timerState.phase, transition, speak]);

  // Check for timer completion
  useEffect(() => {
    if (timerState.timeRemaining <= 0 && timerState.phase !== "complete" && !transition) {
      advanceTimer();
    }
  }, [timerState.timeRemaining, timerState.phase, transition, advanceTimer]);

  const togglePause = () => {
    setTimerState((prev) => ({ ...prev, isPaused: !prev.isPaused }));
    if (!timerState.isPaused) {
      speak("Paused");
    } else {
      speak("Resume");
    }
  };

  const handleExitRequest = () => {
    setShowExitConfirm(true);
    setTimerState((prev) => ({ ...prev, isPaused: true }));
  };

  const handleExitConfirm = () => {
    // Release wake lock
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
    }
    navigate(-1);
  };

  const handleExitCancel = () => {
    setShowExitConfirm(false);
  };

  // Lesson modal handlers
  const handleLessonClick = () => {
    setTimerState((prev) => ({ ...prev, isPaused: true }));
    setShowLessonModal(true);
  };

  const handleLessonClose = () => {
    setShowLessonModal(false);
  };

  // Refresh/replace exercise handlers
  const handleRefreshClick = () => {
    setTimerState((prev) => ({ ...prev, isPaused: true }));
    setShowRefreshModal(true);
  };

  const handleRefreshCancel = () => {
    setShowRefreshModal(false);
  };

  const handleRefreshConfirm = async () => {
    if (!currentExercise || !typedWorkout) return;

    setIsRefreshing(true);

    // Simulate generating a new exercise (in a real app, this would call an AI API)
    // For now, we'll create a variation of the current exercise
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Alternative exercises based on category/type
    const alternativeExercises: Record<string, Exercise[]> = {
      warmup: [
        { name: "Arm Circles", duration: "45 seconds", instructions: "Make large circles with your arms, forward then backward" },
        { name: "Hip Rotations", duration: "45 seconds", instructions: "Hands on hips, rotate hips in circles both directions" },
        { name: "Leg Swings", duration: "45 seconds", instructions: "Hold a wall for balance, swing each leg forward and back" },
        { name: "Torso Twists", duration: "45 seconds", instructions: "Feet shoulder-width apart, rotate upper body side to side" },
        { name: "Neck Rolls", duration: "30 seconds", instructions: "Slowly roll your head in circles, then reverse direction" },
      ],
      main: [
        { name: "Burpees", duration: "20 seconds", instructions: "Jump up, drop to plank, do a push-up, jump back up with arms overhead" },
        { name: "Mountain Climbers", duration: "20 seconds", instructions: "In plank position, drive knees to chest alternately at high speed" },
        { name: "Jump Squats", duration: "20 seconds", instructions: "Squat down, then explode up jumping as high as you can" },
        { name: "High Knees", duration: "20 seconds", instructions: "Run in place, bringing knees up to hip level with each step" },
        { name: "Plank Jacks", duration: "20 seconds", instructions: "In plank position, jump feet wide then back together" },
        { name: "Speed Skaters", duration: "20 seconds", instructions: "Leap side to side, landing on one foot and reaching across" },
        { name: "Tuck Jumps", duration: "20 seconds", instructions: "Jump up and tuck knees to chest at the peak" },
      ],
      cooldown: [
        { name: "Standing Quad Stretch", duration: "30 seconds each side", instructions: "Stand on one leg, pull opposite foot to glute, hold for stretch" },
        { name: "Seated Forward Fold", duration: "45 seconds", instructions: "Sit with legs extended, reach for toes while keeping back straight" },
        { name: "Cat-Cow Stretch", duration: "45 seconds", instructions: "On all fours, alternate between arching and rounding your spine" },
        { name: "Child's Pose", duration: "45 seconds", instructions: "Kneel, sit back on heels, extend arms forward on floor" },
        { name: "Pigeon Pose", duration: "30 seconds each side", instructions: "One leg bent in front, other extended back, fold forward" },
      ],
    };

    const phaseExercises = alternativeExercises[timerState.phase] || alternativeExercises.main;
    // Pick a random exercise that's different from current
    const availableExercises = phaseExercises.filter(e => e.name !== currentExercise.name);
    const newExercise = availableExercises[Math.floor(Math.random() * availableExercises.length)];

    // Update the workout with the new exercise
    if (typedWorkout) {
      const phaseKey = timerState.phase as 'warmup' | 'main' | 'cooldown';
      if (typedWorkout[phaseKey]) {
        typedWorkout[phaseKey][timerState.exerciseIndex] = newExercise;
      }
    }

    speak(`New exercise: ${newExercise.name}`, true);
    setIsRefreshing(false);
    setShowRefreshModal(false);
  };

  const handleComplete = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
    }
    navigate("/home");
  };

  // Get colors based on current state
  const getColors = () => {
    if (timerState.phase === "main" && timerState.intervalType === "work") {
      return {
        primary: phaseColors.work.primary,
        glow: phaseColors.work.glow,
        text: "WORK",
      };
    }
    if (timerState.phase === "main" && timerState.intervalType === "rest") {
      return {
        primary: phaseColors.rest.primary,
        glow: phaseColors.rest.glow,
        text: "REST",
      };
    }
    // Warmup/Cooldown
    const phaseColor = phaseColors[timerState.phase as keyof typeof phaseColors] || phaseColors.main;
    return {
      primary: phaseColor.primary,
      glow: phaseColor.glow,
      text: timerState.phase.toUpperCase(),
    };
  };

  const colors = getColors();
  const currentPhaseColors = phaseColors[timerState.phase as keyof typeof phaseColors] || phaseColors.main;

  // SVG circle calculations
  const size = 300;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  // Format time for completion screen
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Completion screen
  if (timerState.phase === "complete") {
    const totalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

    return (
      <div className="min-h-screen bg-[#0A1F2E] flex flex-col items-center justify-center p-6">
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
            0%, 100% { box-shadow: 0 0 40px rgba(0, 217, 192, 0.4); }
            50% { box-shadow: 0 0 60px rgba(0, 217, 192, 0.6); }
          }
          .celebration-icon { animation: celebration 0.6s ease-in-out infinite; }
          .fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
          .pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }
        `}</style>

        <div className="text-center">
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-8 pulse-glow celebration-icon"
            style={{
              background: 'linear-gradient(135deg, rgba(0, 217, 192, 0.3) 0%, rgba(0, 217, 192, 0.1) 100%)',
              border: '2px solid rgba(0, 217, 192, 0.4)',
            }}
          >
            <span className="text-6xl">🎉</span>
          </div>

          <h1 className="text-3xl font-bold text-white mb-3 fade-in-up">
            Workout Complete!
          </h1>
          <p className="text-[#B0B8C1] mb-8 fade-in-up" style={{ animationDelay: '0.1s' }}>
            Amazing work! You crushed that Tabata session.
          </p>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3 mb-8 max-w-sm mx-auto fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div
              className="rounded-xl p-4 backdrop-blur-md"
              style={{
                background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
              }}
            >
              <p className="text-2xl font-bold text-white">{formatTime(totalDuration)}</p>
              <p className="text-xs text-[#B0B8C1] mt-1">Duration</p>
            </div>
            <div
              className="rounded-xl p-4 backdrop-blur-md"
              style={{
                background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
              }}
            >
              <p className="text-2xl font-bold text-white">{stats.exercisesCompleted}</p>
              <p className="text-xs text-[#B0B8C1] mt-1">Exercises</p>
            </div>
            <div
              className="rounded-xl p-4 backdrop-blur-md"
              style={{
                background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
              }}
            >
              <p className="text-2xl font-bold text-white">{stats.roundsCompleted}</p>
              <p className="text-xs text-[#B0B8C1] mt-1">Rounds</p>
            </div>
          </div>

          <button
            onClick={handleComplete}
            className="px-10 py-4 rounded-2xl font-semibold text-lg transition-all active:scale-95 fade-in-up"
            style={{
              background: 'linear-gradient(135deg, #00D9C0 0%, #00B4A0 100%)',
              boxShadow: '0 8px 32px rgba(0, 217, 192, 0.4)',
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
      <div className="min-h-screen bg-[#0A1F2E] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-[#B0B8C1] mb-4">No workout data found</p>
          <button
            onClick={() => navigate("/home")}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A1F2E] flex flex-col overflow-hidden">
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.02); opacity: 0.9; }
        }
        @keyframes glowPulse {
          0%, 100% { filter: drop-shadow(0 0 8px ${colors.glow}); }
          50% { filter: drop-shadow(0 0 20px ${colors.glow}); }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .work-pulse { animation: pulse 1s ease-in-out infinite; }
        .glow-pulse { animation: glowPulse 1.5s ease-in-out infinite; }
        .breathe { animation: breathe 3s ease-in-out infinite; }
        .fade-in { animation: fadeIn 0.3s ease-out; }
        .slide-up { animation: slideUp 0.3s ease-out; }
      `}</style>

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 fade-in"
          style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 slide-up"
            style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
            }}
          >
            <h3 className="text-xl font-bold text-white mb-2">Exit Workout?</h3>
            <p className="text-[#B0B8C1] mb-6">
              Your progress will be lost. Are you sure you want to exit?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleExitCancel}
                className="flex-1 py-3 rounded-xl font-semibold transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(180deg, rgba(148, 163, 184, 0.15) 0%, rgba(30, 41, 59, 0.6) 100%)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  color: '#FFFFFF',
                }}
              >
                Continue
              </button>
              <button
                onClick={handleExitConfirm}
                className="flex-1 py-3 rounded-xl font-semibold transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                  color: '#FFFFFF',
                }}
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Modal */}
      {showLessonModal && currentExercise && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 fade-in"
          style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden slide-up"
            style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Modal Header */}
            <div
              className="p-4 flex items-center justify-between"
              style={{
                background: 'linear-gradient(180deg, rgba(0, 217, 192, 0.15) 0%, rgba(0, 217, 192, 0.05) 100%)',
                borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
              }}
            >
              <h3 className="text-lg font-bold text-white">Exercise Guide</h3>
              <button
                onClick={handleLessonClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95"
                style={{
                  background: 'rgba(148, 163, 184, 0.15)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                }}
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Exercise Name */}
              <h2
                className="text-2xl font-bold mb-4"
                style={{ color: currentPhaseColors.primary }}
              >
                {currentExercise.name}
              </h2>

              {/* Duration Badge */}
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-4"
                style={{
                  background: 'rgba(148, 163, 184, 0.1)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                }}
              >
                <span className="text-sm text-[#B0B8C1]">Duration:</span>
                <span className="text-sm font-semibold text-white">{currentExercise.duration}</span>
              </div>

              {/* Instructions */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-2">
                  Instructions
                </h4>
                <p className="text-[#E2E8F0] leading-relaxed">
                  {currentExercise.instructions}
                </p>
              </div>

              {/* Tips Section */}
              <div
                className="rounded-xl p-4 mb-6"
                style={{
                  background: 'rgba(255, 149, 0, 0.1)',
                  border: '1px solid rgba(255, 149, 0, 0.2)',
                }}
              >
                <h4 className="text-sm font-semibold text-[#FF9500] mb-2">💡 Tips</h4>
                <ul className="text-sm text-[#B0B8C1] space-y-1">
                  <li>• Focus on proper form over speed</li>
                  <li>• Breathe steadily throughout</li>
                  <li>• Modify if needed for your fitness level</li>
                </ul>
              </div>

              {/* Close Button */}
              <button
                onClick={handleLessonClose}
                className="w-full py-3 rounded-xl font-semibold transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #00D9C0 0%, #00B4A0 100%)',
                  boxShadow: '0 8px 32px rgba(0, 217, 192, 0.3)',
                  color: '#0A1F2E',
                }}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refresh/Replace Exercise Modal */}
      {showRefreshModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 fade-in"
          style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 slide-up"
            style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Icon */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
              }}
            >
              <RefreshCw className={`w-7 h-7 text-[#8B5CF6] ${isRefreshing ? 'animate-spin' : ''}`} />
            </div>

            <h3 className="text-xl font-bold text-white text-center mb-2">
              Replace this exercise?
            </h3>
            <p className="text-[#B0B8C1] text-center mb-6">
              We'll swap <span className="text-white font-medium">{currentExercise?.name}</span> with a similar alternative exercise.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleRefreshCancel}
                disabled={isRefreshing}
                className="flex-1 py-3 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(180deg, rgba(148, 163, 184, 0.15) 0%, rgba(30, 41, 59, 0.6) 100%)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  color: '#FFFFFF',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRefreshConfirm}
                disabled={isRefreshing}
                className="flex-1 py-3 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                  color: '#FFFFFF',
                }}
              >
                {isRefreshing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Finding...
                  </>
                ) : (
                  'Replace'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase Transition Overlay */}
      {transition && (
        <div
          className="fixed inset-0 z-40 flex flex-col items-center justify-center p-6 fade-in"
          style={{
            background: 'rgba(10, 31, 46, 0.95)',
            backdropFilter: 'blur(16px)'
          }}
        >
          <div className="text-center slide-up">
            {/* Phase Icon */}
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 breathe"
              style={{
                background: transition.nextPhase === "main"
                  ? 'linear-gradient(135deg, rgba(0, 217, 192, 0.3) 0%, rgba(0, 217, 192, 0.1) 100%)'
                  : transition.nextPhase === "cooldown"
                  ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.1) 100%)'
                  : 'linear-gradient(135deg, rgba(0, 217, 192, 0.3) 0%, rgba(0, 217, 192, 0.1) 100%)',
                boxShadow: transition.nextPhase === "main"
                  ? '0 0 40px rgba(0, 217, 192, 0.4)'
                  : transition.nextPhase === "cooldown"
                  ? '0 0 40px rgba(139, 92, 246, 0.4)'
                  : '0 0 40px rgba(0, 217, 192, 0.4)',
                border: `2px solid ${transition.nextPhase === "cooldown" ? 'rgba(139, 92, 246, 0.5)' : 'rgba(0, 217, 192, 0.5)'}`,
              }}
            >
              <span className="text-5xl">
                {transition.nextPhase === "main" ? "💪" : transition.nextPhase === "cooldown" ? "🧘" : "🔥"}
              </span>
            </div>

            {/* Phase Title */}
            <h2 className="text-2xl font-bold text-white mb-2">
              {transition.type === "phase"
                ? transition.nextPhase === "main"
                  ? "Main Workout Starting"
                  : "Cool-down Starting"
                : "Next Exercise"
              }
            </h2>

            {/* Next Exercise Name */}
            {transition.nextExerciseName && (
              <p
                className="text-xl font-medium mb-8"
                style={{ color: transition.nextPhase === "cooldown" ? "#8B5CF6" : "#00D9C0" }}
              >
                {transition.nextExerciseName}
              </p>
            )}

            {/* Countdown */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
              style={{
                background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
                border: '3px solid',
                borderColor: transition.nextPhase === "cooldown" ? "#8B5CF6" : "#00D9C0",
                boxShadow: `0 0 30px ${transition.nextPhase === "cooldown" ? 'rgba(139, 92, 246, 0.5)' : 'rgba(0, 217, 192, 0.5)'}`,
              }}
            >
              <span className="text-4xl font-bold text-white">{transition.countdown}</span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-6 safe-area-top">
        <button
          onClick={handleExitRequest}
          className="w-11 h-11 rounded-xl flex items-center justify-center backdrop-blur-md active:scale-95 transition-transform"
          style={{
            background: 'linear-gradient(180deg, rgba(148, 163, 184, 0.15) 0%, rgba(30, 41, 59, 0.6) 100%)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
          }}
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="text-center">
          <span
            className="text-xs font-semibold px-4 py-1.5 rounded-full tracking-wider"
            style={{
              background: currentPhaseColors.gradient,
              color: currentPhaseColors.primary,
              border: `1px solid ${currentPhaseColors.primary}30`,
            }}
          >
            {timerState.phase === "warmup" && "WARM UP"}
            {timerState.phase === "main" && "TABATA"}
            {timerState.phase === "cooldown" && "COOL DOWN"}
          </span>
        </div>

        {/* Voice Toggle */}
        <button
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          className="w-11 h-11 rounded-xl flex items-center justify-center backdrop-blur-md active:scale-95 transition-transform"
          style={{
            background: 'linear-gradient(180deg, rgba(148, 163, 184, 0.15) 0%, rgba(30, 41, 59, 0.6) 100%)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
          }}
        >
          {voiceEnabled ? (
            <Volume2 className="w-5 h-5 text-white" />
          ) : (
            <VolumeX className="w-5 h-5 text-[#64748B]" />
          )}
        </button>
      </div>

      {/* Main Timer Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Circular Progress Ring */}
        <div className={`relative mb-8 ${timerState.phase === "main" && timerState.intervalType === "work" ? 'work-pulse' : ''}`}>
          {/* Glow effect */}
          <div
            className="absolute inset-[-20px] rounded-full blur-3xl opacity-50 transition-colors duration-500"
            style={{ background: colors.glow }}
          />

          {/* Glass background */}
          <div
            className="absolute inset-[20px] rounded-full"
            style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.7) 100%)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(148, 163, 184, 0.08)',
            }}
          />

          {/* SVG Ring */}
          <svg
            width={size}
            height={size}
            className={`relative z-10 transform -rotate-90 ${timerState.phase === "main" && timerState.intervalType === "work" ? 'glow-pulse' : ''}`}
          >
            {/* Background ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(100, 116, 139, 0.15)"
              strokeWidth={strokeWidth}
            />
            {/* Progress ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={colors.primary}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: 'stroke-dashoffset 0.3s ease-out, stroke 0.3s ease-out',
                filter: `drop-shadow(0 0 8px ${colors.glow})`,
              }}
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
            <span
              className="text-sm font-bold tracking-widest mb-1 transition-colors duration-300"
              style={{ color: colors.primary }}
            >
              {colors.text}
            </span>
            <span className="text-8xl font-bold text-white tabular-nums leading-none">
              {timerState.timeRemaining}
            </span>
            {/* Show round and exercise info */}
            <div className="flex flex-col items-center mt-3">
              <span
                className="text-sm font-medium transition-colors duration-300"
                style={{ color: timerState.phase === "main" && timerState.intervalType === "work" ? "#00D9C0" : "#64748B" }}
              >
                Round {timerState.round} of {maxRounds}
              </span>
              {currentExercises.length > 1 && (
                <span className="text-xs mt-1 text-[#64748B]">
                  Exercise {timerState.exerciseIndex + 1} of {currentExercises.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Current Exercise Card */}
        {currentExercise && (
          <div
            className="w-full max-w-sm rounded-2xl p-5 mb-4 slide-up"
            style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(148, 163, 184, 0.1)',
              boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(${
                timerState.phase === "warmup" ? "255, 149, 0" :
                timerState.phase === "cooldown" ? "139, 92, 246" : "0, 217, 192"
              }, 0.1)`,
            }}
          >
            <h2 className="text-2xl font-bold text-white text-center mb-2">
              {currentExercise.name}
            </h2>
            <p className="text-[#B0B8C1] text-sm text-center leading-relaxed">
              {currentExercise.instructions}
            </p>
          </div>
        )}

        {/* Next Exercise Preview - shows rotation within rounds */}
        {!transition && (() => {
          const nextInfo = getNextExerciseInRotation();

          if (nextInfo.isNextPhase) {
            // Show next phase (or workout complete)
            if (timerState.phase === "cooldown" || (timerState.phase === "main" && !typedWorkout?.cooldown?.length)) {
              return (
                <div className="flex items-center gap-2 text-sm fade-in" style={{ color: '#64748B' }}>
                  <span>Almost done!</span>
                  <span className="text-[#00D9C0] font-medium">Finish strong!</span>
                </div>
              );
            }
            return (
              <div className="flex items-center gap-2 text-sm fade-in" style={{ color: '#64748B' }}>
                <span>Up next:</span>
                <span
                  className="font-medium"
                  style={{ color: timerState.phase === "warmup" ? "#00D9C0" : "#8B5CF6" }}
                >
                  {timerState.phase === "warmup" ? "Main Workout" : "Cool Down"}
                </span>
                <ChevronRight className="w-4 h-4" />
              </div>
            );
          }

          if (nextInfo.isNextRound) {
            // Show next round info
            return (
              <div className="flex items-center gap-2 text-sm fade-in" style={{ color: '#64748B' }}>
                <span>Next:</span>
                <span className="text-[#B0B8C1] font-medium">
                  Round {timerState.round + 1} → {nextInfo.exercise?.name}
                </span>
                <ChevronRight className="w-4 h-4" />
              </div>
            );
          }

          if (nextInfo.exercise) {
            // Show next exercise in current round
            return (
              <div className="flex items-center gap-2 text-sm fade-in" style={{ color: '#64748B' }}>
                <span>Next:</span>
                <span className="text-[#B0B8C1] font-medium">{nextInfo.exercise.name}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            );
          }

          return null;
        })()}
      </div>

      {/* Bottom Controls */}
      <div
        className="relative"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        {/* Gradient fade background for better button visibility */}
        <div
          className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(10, 31, 46, 0.95) 0%, rgba(10, 31, 46, 0.7) 50%, transparent 100%)',
          }}
        />

        {/* Button container */}
        <div className="relative z-10 flex items-center justify-center gap-4 px-6 pt-4">
          {/* Lesson Button (Left) */}
          <button
            onClick={handleLessonClick}
            className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 active:opacity-80"
            style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            }}
            aria-label="View exercise tutorial"
          >
            <Play className="w-7 h-7 text-[#E2E8F0]" />
          </button>

          {/* Pause/Resume Button (Center) */}
          <button
            onClick={togglePause}
            className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 active:opacity-80"
            style={{
              background: timerState.isPaused
                ? 'linear-gradient(180deg, rgba(0, 217, 192, 0.7) 0%, rgba(0, 180, 160, 0.8) 100%)'
                : 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: timerState.isPaused
                ? '1px solid rgba(0, 217, 192, 0.5)'
                : '1px solid rgba(148, 163, 184, 0.3)',
              boxShadow: timerState.isPaused
                ? '0 8px 16px rgba(0, 217, 192, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                : '0 8px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            }}
            aria-label={timerState.isPaused ? "Resume timer" : "Pause timer"}
          >
            {timerState.isPaused ? (
              <Play className="w-7 h-7 text-[#0A1F2E]" />
            ) : (
              <Pause className="w-7 h-7 text-[#E2E8F0]" />
            )}
          </button>

          {/* Refresh/Replace Button (Right) */}
          <button
            onClick={handleRefreshClick}
            className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 active:opacity-80"
            style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            }}
            aria-label="Replace exercise"
          >
            <RefreshCw className="w-7 h-7 text-[#E2E8F0]" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TabataTimer;
