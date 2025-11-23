import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Pause, Play, X, ChevronRight, Volume2, VolumeX, RefreshCw, SkipForward } from "lucide-react";
import { GeneratedWorkout, Exercise } from "@/lib/generateWorkout";

type TimerPhase = "warmup" | "main" | "cooldown" | "complete";
type IntervalType = "work" | "rest" | "exercise";
type TransitionType = "phase" | "exercise" | null;
type SideType = "right" | "left" | null;
type BodyPartType = "leg" | "arm" | "side";

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
  if (!exercise) return false;
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
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [showTutorialDrawer, setShowTutorialDrawer] = useState(false);
  const [showSkipWarmupConfirm, setShowSkipWarmupConfirm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [stats, setStats] = useState<WorkoutStats>({
    totalTime: 0,
    exercisesCompleted: 0,
    roundsCompleted: 0,
  });

  // Side-switching state for warmup/cooldown exercises
  const [currentSide, setCurrentSide] = useState<SideType>("right");
  const [hasAnnouncedSwitch, setHasAnnouncedSwitch] = useState(false);

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

      // Reset side state for new exercise
      setCurrentSide("right");
      setHasAnnouncedSwitch(false);

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

  // Announce first exercise with side information on initialization
  useEffect(() => {
    if (!isInitialized || !typedWorkout) return;

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
    }
  }, [isInitialized, typedWorkout, speak]);

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
              // Announce exercise name for first work interval of the new round
              speak(mainExercises[0].name, true);
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

        // Reset side state for new exercise
        setCurrentSide("right");
        setHasAnnouncedSwitch(false);

        // Announce with side information if applicable
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
        // Finished all exercises in this round
        setStats(s => ({ ...s, roundsCompleted: s.roundsCompleted + 1 }));

        if (prev.round < phaseMaxRounds) {
          // Start next round, back to first exercise
          const nextRound = prev.round + 1;
          const firstExercise = exercises[0];
          const duration = parseDuration(firstExercise.duration);

          // Reset side state for new exercise
          setCurrentSide("right");
          setHasAnnouncedSwitch(false);

          // Announce with side information if applicable
          const needsSideSwitch = isSideSwitchingExercise(firstExercise, prev.phase);
          if (needsSideSwitch) {
            const bodyPart = getBodyPartTerm(firstExercise);
            const sideText = getSideAnnouncement("right", bodyPart);
            speak(`Round ${nextRound}! ${firstExercise.name}, ${sideText}`, true);
          } else {
            speak(`Round ${nextRound}! ${firstExercise.name}`, true);
          }

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

            // Announce exercise name for phase start
            if (prev.nextPhase === "main") {
              const firstExerciseName = typedWorkout?.main?.[0]?.name;
              speak(firstExerciseName || "Work", true);
              vibrate([100]);
            } else if (prev.nextPhase === "cooldown") {
              // Reset side state for cooldown first exercise
              setCurrentSide("right");
              setHasAnnouncedSwitch(false);

              const firstCooldownExercise = typedWorkout?.cooldown?.[0];
              if (firstCooldownExercise) {
                const needsSideSwitch = isSideSwitchingExercise(firstCooldownExercise, "cooldown");
                if (needsSideSwitch) {
                  const bodyPart = getBodyPartTerm(firstCooldownExercise);
                  const sideText = getSideAnnouncement("right", bodyPart);
                  speak(`${firstCooldownExercise.name}, ${sideText}`, true);
                } else {
                  speak(firstCooldownExercise.name, true);
                }
                vibrate([100]);
              }
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

  // Halfway side switch announcement for warmup/cooldown exercises
  useEffect(() => {
    // Only apply to warmup and cooldown phases
    if (timerState.phase !== "warmup" && timerState.phase !== "cooldown") return;
    if (timerState.isPaused || transition) return;
    if (hasAnnouncedSwitch) return;
    if (!currentExercise) return;

    // Check if this exercise requires side switching
    const needsSideSwitch = isSideSwitchingExercise(currentExercise, timerState.phase);
    if (!needsSideSwitch) return;

    // Calculate halfway point
    const totalDuration = parseDuration(currentExercise.duration);
    const halfwayPoint = Math.floor(totalDuration / 2);

    // Trigger switch announcement when we reach the halfway point
    if (timerState.timeRemaining === halfwayPoint && halfwayPoint > 0) {
      const bodyPart = getBodyPartTerm(currentExercise);
      const sideText = getSideAnnouncement("left", bodyPart);
      speak(`Switch, ${sideText}`, true);
      vibrate([100, 50, 100]);
      setCurrentSide("left");
      setHasAnnouncedSwitch(true);
    }
  }, [timerState.timeRemaining, timerState.phase, timerState.isPaused, transition, currentExercise, hasAnnouncedSwitch, speak, vibrate]);

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

  // Lesson button handler - opens YouTube tutorial drawer
  const handleLessonClick = () => {
    // Pause the timer
    setTimerState((prev) => ({ ...prev, isPaused: true }));

    // Open the tutorial drawer
    setShowTutorialDrawer(true);

    // Voice announcement
    speak("Timer paused. Tap to view tutorial.", true);
  };

  // Close tutorial drawer
  const handleCloseTutorialDrawer = () => {
    setShowTutorialDrawer(false);
  };

  // Open YouTube with mobile-aware deep linking
  const handleOpenYouTube = () => {
    const exerciseName = currentExercise?.name?.trim() || "HIIT exercise tutorial";
    const searchQuery = `how to ${exerciseName}`.toLowerCase().replace(/ /g, '+');

    // Detect if on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      // Try YouTube app deep link first, fallback to web
      const youtubeAppUrl = `youtube://results?search_query=${searchQuery}`;
      const youtubeWebUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;

      // Create a hidden iframe to try the app URL
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = youtubeAppUrl;
      document.body.appendChild(iframe);

      // Fallback to web after a short delay if app doesn't open
      setTimeout(() => {
        document.body.removeChild(iframe);
        window.open(youtubeWebUrl, '_blank');
      }, 500);
    } else {
      // Desktop - open in new tab
      const youtubeUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;
      window.open(youtubeUrl, '_blank');
    }

    // Close the drawer after opening YouTube
    setShowTutorialDrawer(false);
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

  // Skip warm-up handlers
  const handleSkipWarmupClick = () => {
    setTimerState((prev) => ({ ...prev, isPaused: true }));
    setShowSkipWarmupConfirm(true);
  };

  const handleSkipWarmupCancel = () => {
    setShowSkipWarmupConfirm(false);
  };

  const handleSkipWarmupConfirm = () => {
    // Clear any current timers
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (transitionRef.current) {
      clearInterval(transitionRef.current);
      transitionRef.current = null;
    }

    // Close the confirmation modal
    setShowSkipWarmupConfirm(false);

    // Unpause the timer so the transition countdown can run
    setTimerState((prev) => ({ ...prev, isPaused: false }));

    // Start transition to main workout with GET READY countdown
    setTransition({
      type: "phase",
      countdown: 3, // 3-second "GET READY" transition
      nextPhase: "main",
      nextExerciseName: typedWorkout?.main?.[0]?.name,
    });

    // Announce the skip
    speak("Main workout starting", true);
    vibrate([100, 50, 100]);
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
        @keyframes slideUpDrawer {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes slideDownDrawer {
          from { transform: translateY(0); }
          to { transform: translateY(100%); }
        }
        @keyframes fadeInBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .drawer-slide-up { animation: slideUpDrawer 300ms ease-out forwards; }
        .drawer-slide-down { animation: slideDownDrawer 250ms ease-in forwards; }
        .backdrop-fade-in { animation: fadeInBackdrop 300ms ease-out forwards; }
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

      {/* Skip Warm-up Confirmation Modal */}
      {showSkipWarmupConfirm && (
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
                background: 'linear-gradient(135deg, rgba(255, 149, 0, 0.2) 0%, rgba(255, 149, 0, 0.1) 100%)',
                border: '1px solid rgba(255, 149, 0, 0.3)',
              }}
            >
              <SkipForward className="w-7 h-7 text-[#FF9500]" />
            </div>

            <h3 className="text-xl font-bold text-white text-center mb-2">
              Skip Warm-up?
            </h3>
            <p className="text-[#B0B8C1] text-center mb-4">
              Are you sure you want to skip the warm-up and start the main workout?
            </p>
            <p className="text-[#94A3B8] text-xs text-center mb-6 italic">
              ⚠️ Skipping warm-up may increase injury risk
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleSkipWarmupCancel}
                className="flex-1 py-3 rounded-xl font-semibold transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(180deg, rgba(148, 163, 184, 0.15) 0%, rgba(30, 41, 59, 0.6) 100%)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  color: '#FFFFFF',
                }}
              >
                Continue Warm-up
              </button>
              <button
                onClick={handleSkipWarmupConfirm}
                className="flex-1 py-3 rounded-xl font-semibold transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                  color: '#FFFFFF',
                }}
              >
                Skip Warm-up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YouTube Tutorial Drawer */}
      {showTutorialDrawer && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 backdrop-fade-in"
            style={{
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
            onClick={handleCloseTutorialDrawer}
          />

          {/* Drawer */}
          <div
            className="absolute inset-x-0 bottom-0 drawer-slide-up"
            style={{
              height: '75vh',
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              borderTop: '1px solid rgba(148, 163, 184, 0.3)',
              boxShadow: '0 -20px 60px rgba(0, 0, 0, 0.5)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {/* Drawer Header */}
            <div
              className="relative flex flex-col items-center pt-3"
              style={{ height: '60px' }}
            >
              {/* Drag Handle */}
              <div
                className="mb-3"
                style={{
                  width: '40px',
                  height: '4px',
                  borderRadius: '2px',
                  background: 'rgba(148, 163, 184, 0.5)',
                }}
              />

              {/* Title */}
              <div className="text-center px-16">
                <h3 className="text-lg font-bold text-white truncate">
                  {currentExercise?.name || 'Exercise'} Tutorial
                </h3>
              </div>

              {/* Close Button */}
              <button
                onClick={handleCloseTutorialDrawer}
                className="absolute right-4 top-3 w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
                style={{
                  background: 'linear-gradient(180deg, rgba(148, 163, 184, 0.15) 0%, rgba(30, 41, 59, 0.6) 100%)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                }}
                aria-label="Close tutorial"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Subtitle */}
            <p className="text-center text-sm text-[#64748B] mb-6">
              Swipe down or tap X to close
            </p>

            {/* Content */}
            <div className="flex flex-col items-center px-6 flex-1">
              {/* YouTube Icon/Preview */}
              <div
                className="w-full max-w-sm rounded-2xl p-8 mb-6 flex flex-col items-center"
                style={{
                  background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
                  border: '1px solid rgba(148, 163, 184, 0.15)',
                }}
              >
                {/* YouTube Play Icon */}
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 0, 0, 0.2) 0%, rgba(255, 0, 0, 0.1) 100%)',
                    border: '2px solid rgba(255, 0, 0, 0.3)',
                  }}
                >
                  <svg
                    className="w-10 h-10"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
                      fill="#FF0000"
                    />
                  </svg>
                </div>

                <p className="text-white text-center text-lg font-medium mb-2">
                  Search YouTube for:
                </p>
                <p
                  className="text-center font-semibold text-lg mb-1"
                  style={{ color: '#00D9C0' }}
                >
                  "How to {currentExercise?.name || 'Exercise'}"
                </p>
                <p className="text-[#64748B] text-sm text-center">
                  Watch tutorial videos from fitness experts
                </p>
              </div>

              {/* Open YouTube Button */}
              <button
                onClick={handleOpenYouTube}
                className="w-full max-w-sm py-4 rounded-2xl font-semibold text-lg transition-all active:scale-95 flex items-center justify-center gap-3 mb-4"
                style={{
                  background: 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)',
                  boxShadow: '0 8px 32px rgba(255, 0, 0, 0.3)',
                  color: '#FFFFFF',
                }}
              >
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                Open in YouTube
              </button>

              {/* Info Text */}
              <p className="text-[#64748B] text-sm text-center max-w-sm">
                On mobile devices, this will open the YouTube app if installed
              </p>
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
            {/* Show round info */}
            <span
              className="text-sm font-medium transition-colors duration-300 mt-3"
              style={{ color: timerState.phase === "main" && timerState.intervalType === "work" ? "#00D9C0" : "#64748B" }}
            >
              Round {timerState.round} of {maxRounds}
            </span>
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
            {/* Side indicator for side-switching exercises */}
            {isSideSwitchingExercise(currentExercise, timerState.phase) && currentSide && (
              <div
                className="flex items-center justify-center gap-2 mb-2 transition-all duration-300"
              >
                <span
                  className="px-3 py-1 rounded-full text-sm font-semibold"
                  style={{
                    background: currentSide === "right"
                      ? 'linear-gradient(135deg, rgba(0, 217, 192, 0.2) 0%, rgba(0, 217, 192, 0.1) 100%)'
                      : 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)',
                    border: `1px solid ${currentSide === "right" ? 'rgba(0, 217, 192, 0.4)' : 'rgba(139, 92, 246, 0.4)'}`,
                    color: currentSide === "right" ? '#00D9C0' : '#8B5CF6',
                  }}
                >
                  {getSideAnnouncement(currentSide, getBodyPartTerm(currentExercise))}
                </span>
              </div>
            )}
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

        {/* Skip Warm-up Button - Only visible during warm-up phase */}
        {timerState.phase === "warmup" && (
          <div className="relative z-10 px-6 pt-3">
            <button
              onClick={handleSkipWarmupClick}
              className="w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] active:opacity-80"
              style={{
                background: 'rgba(30, 41, 59, 0.4)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
              }}
              aria-label="Skip warm-up and start main workout"
            >
              <SkipForward className="w-4 h-4 text-[#94A3B8]" />
              <span className="text-sm font-medium text-[#94A3B8]">Skip to Main Workout</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TabataTimer;
