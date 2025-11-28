import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Pause, Play, X, RefreshCw, Loader2 } from "lucide-react";
import { GeneratedWorkout, Exercise, generateReplacementExercise } from "@/lib/generateWorkout";
import { supabase } from "@/integrations/supabase/client";

type TimerPhase = "warmup" | "main" | "cooldown" | "complete";
type SideType = "right" | "left" | null;
type BodyPartType = "leg" | "arm" | "side";

// Ladder-specific types
type LadderType = "ascending" | "descending" | "pyramid";
type TimerMode = "forTime" | "amrap";

interface TimerState {
  phase: TimerPhase;
  exerciseIndex: number; // Current exercise in warmup/cooldown
  round: number; // Current round in ladder (1-indexed)
  currentReps: number; // Current rep count for this round
  timeElapsed: number; // For Time mode (seconds)
  timeRemaining: number; // AMRAP mode or warmup/cooldown (seconds)
  isPaused: boolean;
}

// Metadata about the ladder configuration (parsed from AI-generated workout)
interface LadderMetadata {
  ladderType: LadderType;
  sequence: number[]; // The full ladder sequence [1, 2, 3, 4, 5] or [10, 9, 8, 7, 6] etc.
  timerMode: TimerMode;
  duration: number; // AMRAP duration in seconds
}

const TRANSITION_DURATION = 10;

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

// Parse ladder metadata from AI-generated workout
// Parses duration field from first main exercise
// Expected format: "Ladder: 1→10 ascending, For Time" or "Ladder: 10→1 descending, AMRAP 10:00"
const parseLadderMetadata = (workout: GeneratedWorkout): LadderMetadata => {
  // Default values
  let ladderType: LadderType = "ascending";
  let startReps = 1;
  let endReps = 10;
  let timerMode: TimerMode = "forTime";
  let duration = 600; // 10 minutes for AMRAP

  // Try to parse from first main exercise duration
  if (workout.main && workout.main.length > 0) {
    const firstExercise = workout.main[0];
    const durationStr = firstExercise.duration || "";

    console.log('Parsing ladder metadata from:', durationStr);

    // Pattern: "Ladder: 1→10 ascending, For Time"
    // Pattern: "Ladder: 10→1 descending, AMRAP 10:00"
    // Pattern: "Ladder: 1→5→1 pyramid, For Time"

    if (durationStr.includes('Ladder:')) {
      // Extract ladder type
      if (durationStr.toLowerCase().includes('ascending')) {
        ladderType = "ascending";
      } else if (durationStr.toLowerCase().includes('descending')) {
        ladderType = "descending";
      } else if (durationStr.toLowerCase().includes('pyramid')) {
        ladderType = "pyramid";
      }

      // Extract rep range
      // Look for pattern like "1→10" or "1→5→1"
      const arrowMatch = durationStr.match(/(\d+)→(\d+)(?:→(\d+))?/);
      if (arrowMatch) {
        startReps = parseInt(arrowMatch[1], 10);
        endReps = parseInt(arrowMatch[2], 10);

        // If pyramid has explicit return (1→5→1), use it
        if (arrowMatch[3]) {
          ladderType = "pyramid";
        }
      }

      // Extract timer mode
      if (durationStr.toLowerCase().includes('amrap')) {
        timerMode = "amrap";

        // Extract duration if present (format: "10:00" or "10 min")
        const timeMatch = durationStr.match(/(\d+):(\d+)/);
        if (timeMatch) {
          const mins = parseInt(timeMatch[1], 10);
          const secs = parseInt(timeMatch[2], 10);
          duration = mins * 60 + secs;
        } else {
          const minMatch = durationStr.match(/(\d+)\s*min/i);
          if (minMatch) {
            duration = parseInt(minMatch[1], 10) * 60;
          }
        }
      } else if (durationStr.toLowerCase().includes('for time')) {
        timerMode = "forTime";
      }
    }
  }

  // Generate sequence based on type
  const sequence: number[] = [];
  if (ladderType === "ascending") {
    for (let i = startReps; i <= endReps; i++) {
      sequence.push(i);
    }
  } else if (ladderType === "descending") {
    for (let i = startReps; i >= endReps; i--) {
      sequence.push(i);
    }
  } else if (ladderType === "pyramid") {
    // Up
    for (let i = startReps; i <= endReps; i++) {
      sequence.push(i);
    }
    // Down
    for (let i = endReps - 1; i >= startReps; i--) {
      sequence.push(i);
    }
  }

  console.log('Parsed ladder metadata:', { ladderType, sequence, timerMode, duration });

  return {
    ladderType,
    sequence,
    timerMode,
    duration
  };
};

const LadderTimer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { workout, workoutId, workoutDuration } = location.state || {};

  const typedWorkout = workout as GeneratedWorkout | undefined;
  const ladderMeta = typedWorkout ? parseLadderMetadata(typedWorkout) : null;

  // Override duration with workoutDuration if provided by user
  if (ladderMeta && workoutDuration && ladderMeta.timerMode === 'amrap') {
    const userDuration = parseInt(workoutDuration) * 60;
    console.log('Ladder Timer - overriding parsed duration:', ladderMeta.duration, 'with user duration:', userDuration);
    ladderMeta.duration = userDuration;
  }

  const [timerState, setTimerState] = useState<TimerState>({
    phase: "warmup",
    exerciseIndex: 0,
    round: 0,
    currentReps: 0,
    timeElapsed: 0,
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

  // Mutable workout state for exercise replacements
  const [workoutData, setWorkoutData] = useState<GeneratedWorkout | undefined>(undefined);

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

  // Initialize workoutData from passed workout
  // Always update when workout changes (e.g., after exercise replacement)
  useEffect(() => {
    if (workout) {
      console.log("=== LADDER TIMER RECEIVED WORKOUT ===");
      console.log("First warmup exercise:", (workout as GeneratedWorkout).warmup[0]?.name);
      console.log("Workout ID:", workoutId);
      setWorkoutData(workout as GeneratedWorkout);
    }
  }, [workout, workoutId]);

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

      console.log('LadderTimer: Initializing warmup with first exercise:', firstExercise.name, 'at index 0');

      setTimerState({
        phase: "warmup",
        exerciseIndex: 0, // ALWAYS start from first exercise (index 0)
        round: 0,
        currentReps: 0,
        timeElapsed: 0,
        timeRemaining: duration,
        isPaused: false,
      });

      setCurrentSide("right");
      setHasAnnouncedSwitch(false);

      setIsInitialized(true);
    } else {
      // No warmup, start with main ladder
      setTimerState({
        phase: "main",
        exerciseIndex: 0,
        round: 1,
        currentReps: ladderMeta?.sequence[0] || 1,
        timeElapsed: 0,
        timeRemaining: ladderMeta?.timerMode === "amrap" ? (ladderMeta?.duration || 600) : 0,
        isPaused: false,
      });
      setIsInitialized(true);
    }
  }, [typedWorkout, isInitialized, ladderMeta]);

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

    // Get the current exercise from timer state - this is what's actually displayed
    // Using getCurrentExercises ensures voice matches the visual display
    const exercises = typedWorkout[timerState.phase] || [];
    const exerciseToAnnounce = exercises[timerState.exerciseIndex];

    if (exerciseToAnnounce) {
      const needsSideSwitch = isSideSwitchingExercise(exerciseToAnnounce, timerState.phase);

      if (needsSideSwitch) {
        const bodyPart = getBodyPartTerm(exerciseToAnnounce);
        const sideText = getSideAnnouncement("right", bodyPart);
        speak(`${exerciseToAnnounce.name}, ${sideText}`, true);
      } else {
        speak(exerciseToAnnounce.name, true);
      }
    } else {
      const ladderTypeText = ladderMeta?.ladderType === "ascending"
        ? "Ascending"
        : ladderMeta?.ladderType === "descending"
        ? "Descending"
        : "Pyramid";
      speak(`${ladderTypeText} ladder starting`, true);
    }
  }, [isInitialized, speak]);

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
      ? "Ladder starting"
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
              round: 1,
              currentReps: ladderMeta?.sequence[0] || 1,
              timeElapsed: ladderMeta?.timerMode === "forTime" ? 0 : ts.timeElapsed,
              timeRemaining: ladderMeta?.timerMode === "amrap" ? (ladderMeta?.duration || 600) : 0,
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
              exerciseIndex: 0, // ALWAYS start from first exercise (index 0)
              round: 0,
              currentReps: 0,
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
  }, [transitionCountdown, timerState.isPaused, nextPhase, ladderMeta, typedWorkout, speak, vibrate]);

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
        if (prev.phase === "warmup" || prev.phase === "cooldown") {
          // Count down for warmup/cooldown
          if (prev.timeRemaining <= 0) {
            return prev;
          }

          const newTime = prev.timeRemaining - 1;

          // Count down voice for last 3 seconds in warmup/cooldown
          if (newTime <= 3 && newTime > 0) {
            speak(newTime.toString());
          }

          return { ...prev, timeRemaining: newTime };
        } else if (prev.phase === "main") {
          // Main ladder phase
          if (ladderMeta?.timerMode === "forTime") {
            // Stopwatch counts UP
            return { ...prev, timeElapsed: prev.timeElapsed + 1 };
          } else {
            // AMRAP counts DOWN
            if (prev.timeRemaining <= 0) {
              return prev;
            }

            const newTime = prev.timeRemaining - 1;

            // Count down voice for last 10 seconds
            if (newTime <= 10 && newTime > 0) {
              speak(newTime.toString());
            }

            return { ...prev, timeRemaining: newTime };
          }
        }

        return prev;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState.isPaused, timerState.phase, transitionCountdown, ladderMeta, speak]);

  // Check for timer completion
  useEffect(() => {
    // Only advance if initialized to prevent skipping first exercise on mount
    if (isInitialized && timerState.timeRemaining <= 0 && timerState.phase !== "complete" && transitionCountdown === null) {
      if (timerState.phase === "main" && ladderMeta?.timerMode === "amrap") {
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
      } else if (timerState.phase === "warmup" || timerState.phase === "cooldown") {
        // Warmup or cooldown phase complete
        advanceTimer();
      }
    }
  }, [isInitialized, timerState.timeRemaining, timerState.phase, transitionCountdown, typedWorkout, ladderMeta, advanceTimer, speak, vibrate, startPhaseTransition]);

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

  // Handle manual round advancement in ladder main phase (user taps "Next Round")
  const handleNextRound = useCallback(() => {
    if (timerState.phase !== "main") return;
    if (timerState.isPaused || transitionCountdown !== null) return;
    if (!ladderMeta) return;

    const nextRound = timerState.round + 1;

    if (ladderMeta.timerMode === "forTime") {
      // For Time mode: check if ladder is complete
      if (nextRound > ladderMeta.sequence.length) {
        // Ladder complete!
        handleWorkoutComplete();
        return;
      }

      // Move to next round
      setTimerState(prev => ({
        ...prev,
        round: nextRound,
        currentReps: ladderMeta.sequence[nextRound - 1]
      }));

      vibrate([50]);
      speak(`Round ${nextRound}, ${ladderMeta.sequence[nextRound - 1]} reps`, true);
    } else {
      // AMRAP mode: loop ladder if complete
      if (nextRound > ladderMeta.sequence.length) {
        // Completed full ladder, restart
        setTimerState(prev => ({
          ...prev,
          round: 1,
          currentReps: ladderMeta.sequence[0]
        }));
        vibrate([100, 50, 100]);
        speak(`Ladder complete! Starting over. ${ladderMeta.sequence[0]} reps`, true);
      } else {
        // Next round in ladder
        setTimerState(prev => ({
          ...prev,
          round: nextRound,
          currentReps: ladderMeta.sequence[nextRound - 1]
        }));
        vibrate([50]);
        speak(`Round ${nextRound}, ${ladderMeta.sequence[nextRound - 1]} reps`, true);
      }
    }
  }, [timerState.phase, timerState.isPaused, timerState.round, transitionCountdown, ladderMeta, vibrate, speak]);

  const handleWorkoutComplete = useCallback(() => {
    setTimerState(prev => ({ ...prev, phase: "complete" }));

    if (ladderMeta?.timerMode === "forTime") {
      speak(`Ladder complete! Total time: ${formatTime(timerState.timeElapsed)}`, true);
    } else {
      speak(`Time's up! You completed ${timerState.round} rounds`, true);
    }

    vibrate([200, 100, 200, 100, 200]);

    // Move to cooldown if available
    const cooldownExercises = typedWorkout?.cooldown || [];
    if (cooldownExercises.length > 0 && timerState.phase !== "cooldown") {
      startPhaseTransition("cooldown");
    }
  }, [ladderMeta, timerState.timeElapsed, timerState.round, timerState.phase, speak, vibrate, typedWorkout, startPhaseTransition]);

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
        framework: 'ladder',
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
    if (mainExercises.length > 0 && ladderMeta) {
      console.log('LadderTimer: Skipping warmup, starting main workout at exercise index 0');

      setTimerState({
        phase: "main",
        exerciseIndex: 0, // ALWAYS start from first exercise (index 0)
        round: 1,
        currentReps: ladderMeta.sequence[0],
        timeElapsed: ladderMeta.timerMode === "forTime" ? 0 : 0,
        timeRemaining: ladderMeta.timerMode === "amrap" ? ladderMeta.duration : 0,
        isPaused: false,
      });

      speak(`Ladder starting!`, true);
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

  // Get ladder type display text
  const getLadderTypeText = (): string => {
    if (!ladderMeta) return "LADDER";
    switch (ladderMeta.ladderType) {
      case "ascending":
        return "ASCENDING";
      case "descending":
        return "DESCENDING";
      case "pyramid":
        return "PYRAMID";
      default:
        return "LADDER";
    }
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
            0%, 100% { box-shadow: 0 0 40px rgba(74, 222, 128, 0.4); }
            50% { box-shadow: 0 0 60px rgba(74, 222, 128, 0.6); }
          }
          .celebration-icon { animation: celebration 0.6s ease-in-out infinite; }
          .fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
          .pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }
        `}</style>

        <div className="text-center">
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-8 pulse-glow celebration-icon"
            style={{
              background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.3) 0%, rgba(74, 222, 128, 0.1) 100%)',
              border: '2px solid rgba(74, 222, 128, 0.4)',
            }}
          >
            <span className="text-6xl">🎉</span>
          </div>

          <h1 className="text-3xl font-bold mb-3 fade-in-up" style={{ color: '#1F2124' }}>
            {ladderMeta?.timerMode === "forTime" ? "Ladder Complete!" : "Time's Up!"}
          </h1>
          <p className="mb-8 fade-in-up" style={{ color: '#8F8A84', animationDelay: '0.1s' }}>
            {ladderMeta?.timerMode === "forTime"
              ? "Amazing work! You crushed that ladder."
              : "Great effort! You pushed through."}
          </p>

          {/* Stats Card */}
          <div className="mb-8 max-w-sm mx-auto fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div
              className="rounded-xl p-6"
              style={{
                background: 'rgba(255, 255, 255, 0.92)',
                border: '1px solid rgba(255, 255, 255, 0.65)',
              }}
            >
              {ladderMeta?.timerMode === "forTime" ? (
                <>
                  <p className="text-4xl font-bold mb-2" style={{ color: '#4ADE80' }}>
                    {formatTime(timerState.timeElapsed)}
                  </p>
                  <p className="text-sm" style={{ color: '#8F8A84' }}>Total Time</p>
                  <div className="mt-4 pt-4 border-t border-foreground/10">
                    <p className="text-sm" style={{ color: '#8F8A84' }}>
                      Completed {timerState.round} rounds
                    </p>
                    <p className="text-sm font-medium" style={{ color: '#4ADE80' }}>
                      {getLadderTypeText()}: {ladderMeta?.sequence[0]} → {ladderMeta?.sequence[ladderMeta.sequence.length - 1]}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-4xl font-bold mb-2" style={{ color: '#4ADE80' }}>
                    {timerState.round}
                  </p>
                  <p className="text-sm" style={{ color: '#8F8A84' }}>Rounds Completed</p>
                  <div className="mt-4 pt-4 border-t border-foreground/10">
                    <p className="text-sm" style={{ color: '#8F8A84' }}>
                      Duration: {formatTime(ladderMeta?.duration || 600)}
                    </p>
                    <p className="text-sm font-medium" style={{ color: '#4ADE80' }}>
                      {getLadderTypeText()}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            onClick={handleComplete}
            className="px-10 py-4 rounded-2xl font-semibold text-lg transition-all active:scale-95 fade-in-up"
            style={{
              background: 'linear-gradient(90deg, #4ADE80, #86EFAC)',
              boxShadow: '0 8px 32px rgba(74, 222, 128, 0.4)',
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
  if (!typedWorkout || !ladderMeta) {
    return (
      <div className="min-h-screen bg-gradient-warm flex items-center justify-center p-6">
        <div className="text-center">
          <p className="mb-4" style={{ color: '#8F8A84' }}>No workout data found</p>
          <button
            onClick={() => navigate("/home")}
            className="px-6 py-3 rounded-xl"
            style={{
              background: 'linear-gradient(90deg, #4ADE80, #86EFAC)',
              color: '#FFFFFF',
            }}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

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
                  background: 'linear-gradient(90deg, #4ADE80, #86EFAC)',
                  boxShadow: '0 8px 24px rgba(74, 222, 128, 0.4)',
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
              className="text-center mb-6"
              style={{
                color: '#8F8A84',
                fontSize: '16px',
                lineHeight: '1.5',
              }}
            >
              Are you sure you want to skip the warm-up and start the ladder workout?
            </p>

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
                  background: 'linear-gradient(90deg, #4ADE80, #86EFAC)',
                  border: 'none',
                  borderRadius: '999px',
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontWeight: '600',
                  boxShadow: '0 10px 30px rgba(74, 222, 128, 0.3)',
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
                background: 'rgba(74, 222, 128, 0.2)',
                border: '1px solid rgba(74, 222, 128, 0.3)',
              }}
            >
              <RefreshCw className="w-7 h-7" style={{ color: '#4ADE80' }} />
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
                  background: 'linear-gradient(90deg, #4ADE80, #86EFAC)',
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
                background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.3) 0%, rgba(74, 222, 128, 0.1) 100%)',
                boxShadow: '0 0 40px rgba(74, 222, 128, 0.4)',
                border: '2px solid rgba(74, 222, 128, 0.5)',
              }}
            >
              <span className="text-5xl">
                {nextPhase === "main" ? "💪" : "🧘"}
              </span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              {nextPhase === "main" ? "Ladder Starting" : "Cool-down Starting"}
            </h2>

            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mt-8"
              style={{
                background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
                border: '3px solid #4ADE80',
                boxShadow: '0 0 30px rgba(74, 222, 128, 0.5)',
              }}
            >
              <span className="text-4xl font-bold text-white">{transitionCountdown}</span>
            </div>
          </div>
        </div>
      )}

      {/* TOP SAFE AREA SPACER */}
      <div style={{ height: 'calc(1rem + var(--safe-area-top))' }} />

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
              color: timerState.phase === "warmup" ? "#FF9500" : timerState.phase === "main" ? "#4ADE80" : "#A855F7",
              letterSpacing: '1px',
            }}
          >
            {timerState.phase === "warmup" && "WARM UP"}
            {timerState.phase === "main" && getLadderTypeText()}
            {timerState.phase === "cooldown" && "COOL DOWN"}
          </div>
        </div>

        {/* Timer Display Area */}
        <div className="flex justify-center">
          <div className="relative flex flex-col items-center">
            {timerState.phase === "main" ? (
              <>
                <span className="font-bold tabular-nums leading-none" style={{ fontSize: '120px', color: '#1F2124', fontVariantNumeric: 'tabular-nums' }}>
                  {ladderMeta.timerMode === "forTime" ? formatTime(timerState.timeElapsed) : formatTime(timerState.timeRemaining)}
                </span>
                <div
                  className="mt-4 px-4 py-1.5 rounded-full text-xs font-medium"
                  style={{
                    background: 'rgba(255, 255, 255, 0.6)',
                    color: '#8F8A84',
                  }}
                >
                  Round {timerState.round} of {ladderMeta.sequence.length}
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

        <div className="h-6" />

        {/* Exercise Card or Tap Area */}
        {timerState.phase === "main" ? (
          <div className="max-w-[90%] w-full mx-auto">
            {/* Round Info Card */}
            <div
              className="rounded-3xl p-6 mb-4"
              style={{
                background: 'rgba(255, 255, 255, 0.92)',
                border: '1px solid rgba(255, 255, 255, 0.65)',
                backdropFilter: 'blur(18px)',
                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.18)',
              }}
            >
              <p className="text-sm font-medium mb-1 text-center" style={{ color: '#8F8A84' }}>
                Current Rep Count
              </p>
              <p className="text-6xl font-bold text-center" style={{ color: '#4ADE80' }}>
                {timerState.currentReps}
              </p>
              <p className="text-sm text-center mt-2" style={{ color: '#8F8A84' }}>
                reps per exercise
              </p>
            </div>

            {/* Exercise List */}
            <div
              className="rounded-3xl p-5 mb-4"
              style={{
                background: 'rgba(255, 255, 255, 0.92)',
                border: '1px solid rgba(255, 255, 255, 0.65)',
                backdropFilter: 'blur(18px)',
              }}
            >
              <p className="text-xs font-semibold mb-3" style={{ color: '#8F8A84' }}>EXERCISES:</p>
              {currentExercises.map((ex, idx) => (
                <div
                  key={idx}
                  className="py-2"
                  style={{
                    color: '#1F2124',
                    fontWeight: '500',
                    borderBottom: idx < currentExercises.length - 1 ? '1px solid rgba(31, 33, 36, 0.1)' : 'none'
                  }}
                >
                  {idx + 1}. {ex.name} ({timerState.currentReps})
                </div>
              ))}
            </div>

            {/* Tap to Advance */}
            <div
              onClick={handleNextRound}
              className="rounded-3xl p-8 text-center cursor-pointer transition-all active:scale-[0.98]"
              style={{
                background: 'rgba(74, 222, 128, 0.1)',
                border: '2px dashed rgba(74, 222, 128, 0.3)',
              }}
            >
              <h3 className="text-2xl font-bold mb-2" style={{ color: '#4ADE80' }}>
                Next Round
              </h3>
              <p className="text-sm" style={{ color: '#8F8A84' }}>
                Tap when round complete
              </p>
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
                    background: 'rgba(74, 222, 128, 0.2)',
                    border: '1px solid rgba(74, 222, 128, 0.3)',
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
              background: 'linear-gradient(90deg, #4ADE80, #86EFAC)',
              boxShadow: '0 10px 30px rgba(74, 222, 128, 0.4)',
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
              style={{ color: '#4ADE80' }}
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

export default LadderTimer;
