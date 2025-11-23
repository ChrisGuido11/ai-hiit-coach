import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Pause, Play, X, ChevronRight } from "lucide-react";
import { GeneratedWorkout, Exercise } from "@/lib/generateWorkout";

type TimerPhase = "warmup" | "main" | "cooldown" | "complete";
type IntervalType = "work" | "rest" | "exercise";

interface TimerState {
  phase: TimerPhase;
  exerciseIndex: number;
  round: number;
  intervalType: IntervalType;
  timeRemaining: number;
  isPaused: boolean;
  isCountdown: boolean;
}

const WORK_DURATION = 20;
const REST_DURATION = 10;
const ROUNDS_PER_EXERCISE = 8;
const COUNTDOWN_DURATION = 3;

const TabataTimer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { workout, workoutId, framework } = location.state || {};

  const [timerState, setTimerState] = useState<TimerState>({
    phase: "warmup",
    exerciseIndex: 0,
    round: 1,
    intervalType: "exercise",
    timeRemaining: COUNTDOWN_DURATION,
    isPaused: false,
    isCountdown: true,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const typedWorkout = workout as GeneratedWorkout | undefined;

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
  const nextExercise = currentExercises[timerState.exerciseIndex + 1];

  // Parse duration from exercise (for warmup/cooldown)
  const parseDuration = (duration: string): number => {
    const match = duration.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 45;
  };

  // Get total duration for current interval
  const getTotalDuration = useCallback((): number => {
    if (timerState.isCountdown) return COUNTDOWN_DURATION;
    if (timerState.phase === "main") {
      return timerState.intervalType === "work" ? WORK_DURATION : REST_DURATION;
    }
    // Warmup and cooldown use exercise duration
    if (currentExercise) {
      return parseDuration(currentExercise.duration);
    }
    return 45;
  }, [timerState.isCountdown, timerState.phase, timerState.intervalType, currentExercise]);

  // Calculate progress (0 to 1)
  const progress = timerState.timeRemaining / getTotalDuration();

  // Move to next state
  const advanceTimer = useCallback(() => {
    setTimerState((prev) => {
      // Handle countdown completion
      if (prev.isCountdown) {
        const duration = prev.phase === "main" ? WORK_DURATION :
          (currentExercise ? parseDuration(currentExercise.duration) : 45);
        return {
          ...prev,
          isCountdown: false,
          intervalType: prev.phase === "main" ? "work" : "exercise",
          timeRemaining: duration,
        };
      }

      // Main phase logic (Tabata intervals)
      if (prev.phase === "main") {
        if (prev.intervalType === "work") {
          // Work -> Rest
          return {
            ...prev,
            intervalType: "rest",
            timeRemaining: REST_DURATION,
          };
        } else {
          // Rest -> Next round or next exercise
          if (prev.round < ROUNDS_PER_EXERCISE) {
            return {
              ...prev,
              round: prev.round + 1,
              intervalType: "work",
              timeRemaining: WORK_DURATION,
            };
          } else {
            // Finished all rounds for this exercise
            const nextIndex = prev.exerciseIndex + 1;
            const mainExercises = typedWorkout?.main || [];

            if (nextIndex < mainExercises.length) {
              // Move to next exercise
              return {
                ...prev,
                exerciseIndex: nextIndex,
                round: 1,
                intervalType: "work",
                timeRemaining: COUNTDOWN_DURATION,
                isCountdown: true,
              };
            } else {
              // Move to cooldown
              const cooldownExercises = typedWorkout?.cooldown || [];
              if (cooldownExercises.length > 0) {
                return {
                  ...prev,
                  phase: "cooldown",
                  exerciseIndex: 0,
                  round: 1,
                  intervalType: "exercise",
                  timeRemaining: COUNTDOWN_DURATION,
                  isCountdown: true,
                };
              } else {
                return { ...prev, phase: "complete" };
              }
            }
          }
        }
      }

      // Warmup/Cooldown logic (simple exercise timer)
      const exercises = prev.phase === "warmup"
        ? typedWorkout?.warmup || []
        : typedWorkout?.cooldown || [];
      const nextIndex = prev.exerciseIndex + 1;

      if (nextIndex < exercises.length) {
        return {
          ...prev,
          exerciseIndex: nextIndex,
          timeRemaining: COUNTDOWN_DURATION,
          isCountdown: true,
        };
      } else {
        // Move to next phase
        if (prev.phase === "warmup") {
          const mainExercises = typedWorkout?.main || [];
          if (mainExercises.length > 0) {
            return {
              ...prev,
              phase: "main",
              exerciseIndex: 0,
              round: 1,
              intervalType: "work",
              timeRemaining: COUNTDOWN_DURATION,
              isCountdown: true,
            };
          }
        }
        return { ...prev, phase: "complete" };
      }
    });
  }, [typedWorkout, currentExercise]);

  // Timer tick
  useEffect(() => {
    if (timerState.isPaused || timerState.phase === "complete") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimerState((prev) => {
        if (prev.timeRemaining <= 1) {
          return prev; // Will be handled by advanceTimer
        }
        return { ...prev, timeRemaining: prev.timeRemaining - 1 };
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState.isPaused, timerState.phase]);

  // Check for timer completion
  useEffect(() => {
    if (timerState.timeRemaining <= 0 && timerState.phase !== "complete") {
      advanceTimer();
    }
  }, [timerState.timeRemaining, timerState.phase, advanceTimer]);

  const togglePause = () => {
    setTimerState((prev) => ({ ...prev, isPaused: !prev.isPaused }));
  };

  const handleExit = () => {
    navigate(-1);
  };

  const handleComplete = () => {
    navigate("/home");
  };

  // Colors based on interval type
  const getColors = () => {
    if (timerState.isCountdown) {
      return {
        primary: "#F59E0B", // Amber for countdown
        glow: "rgba(245, 158, 11, 0.5)",
        text: "GET READY",
      };
    }
    if (timerState.phase === "main" && timerState.intervalType === "work") {
      return {
        primary: "#00D9C0", // Cyan for work
        glow: "rgba(0, 217, 192, 0.5)",
        text: "WORK",
      };
    }
    if (timerState.phase === "main" && timerState.intervalType === "rest") {
      return {
        primary: "#64748B", // Slate for rest
        glow: "rgba(100, 116, 139, 0.4)",
        text: "REST",
      };
    }
    return {
      primary: "#00D9C0",
      glow: "rgba(0, 217, 192, 0.4)",
      text: timerState.phase.toUpperCase(),
    };
  };

  const colors = getColors();

  // SVG circle calculations
  const size = 300;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  // Completion screen
  if (timerState.phase === "complete") {
    return (
      <div className="min-h-screen bg-[#0A1F2E] flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{
              background: 'linear-gradient(135deg, rgba(0, 217, 192, 0.3) 0%, rgba(0, 217, 192, 0.1) 100%)',
              boxShadow: '0 0 40px rgba(0, 217, 192, 0.4)',
            }}
          >
            <span className="text-5xl">🎉</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Workout Complete!</h1>
          <p className="text-[#B0B8C1] mb-8">Great job! You crushed that Tabata session.</p>
          <button
            onClick={handleComplete}
            className="px-8 py-4 rounded-2xl font-semibold text-lg transition-transform active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #00D9C0 0%, #00B4A0 100%)',
              boxShadow: '0 8px 32px rgba(0, 217, 192, 0.4)',
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
    <div className="min-h-screen bg-[#0A1F2E] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-6">
        <button
          onClick={handleExit}
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
            className="text-xs font-medium px-3 py-1 rounded-full"
            style={{
              background: 'rgba(0, 217, 192, 0.15)',
              color: '#00D9C0',
            }}
          >
            {timerState.phase === "warmup" && "WARM UP"}
            {timerState.phase === "main" && "TABATA"}
            {timerState.phase === "cooldown" && "COOL DOWN"}
          </span>
        </div>
        <div className="w-11" /> {/* Spacer */}
      </div>

      {/* Main Timer Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Circular Progress Ring */}
        <div className="relative mb-8">
          {/* Glow effect */}
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-60"
            style={{ background: colors.glow }}
          />

          {/* SVG Ring */}
          <svg width={size} height={size} className="relative z-10 transform -rotate-90">
            {/* Background ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(100, 116, 139, 0.2)"
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
                transition: 'stroke-dashoffset 0.3s ease-out',
                filter: `drop-shadow(0 0 8px ${colors.glow})`,
              }}
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
            <span
              className="text-sm font-semibold tracking-wider mb-2"
              style={{ color: colors.primary }}
            >
              {colors.text}
            </span>
            <span className="text-7xl font-bold text-white tabular-nums">
              {timerState.timeRemaining}
            </span>
            {timerState.phase === "main" && !timerState.isCountdown && (
              <span className="text-[#B0B8C1] text-sm mt-2">
                Round {timerState.round} of {ROUNDS_PER_EXERCISE}
              </span>
            )}
          </div>
        </div>

        {/* Current Exercise */}
        {currentExercise && (
          <div
            className="w-full max-w-sm rounded-2xl p-5 mb-4"
            style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(148, 163, 184, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          >
            <h2 className="text-xl font-bold text-white text-center mb-2">
              {currentExercise.name}
            </h2>
            <p className="text-[#B0B8C1] text-sm text-center leading-relaxed">
              {currentExercise.instructions}
            </p>
          </div>
        )}

        {/* Next Exercise Preview */}
        {nextExercise && (
          <div className="flex items-center gap-2 text-[#64748B] text-sm">
            <span>Next:</span>
            <span className="text-[#B0B8C1]">{nextExercise.name}</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="p-6 pb-8">
        <button
          onClick={togglePause}
          className="w-full py-5 rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
          style={{
            background: timerState.isPaused
              ? 'linear-gradient(135deg, #00D9C0 0%, #00B4A0 100%)'
              : 'linear-gradient(180deg, rgba(148, 163, 184, 0.15) 0%, rgba(30, 41, 59, 0.6) 100%)',
            border: timerState.isPaused ? 'none' : '1px solid rgba(148, 163, 184, 0.25)',
            boxShadow: timerState.isPaused
              ? '0 8px 32px rgba(0, 217, 192, 0.4)'
              : '0 4px 16px rgba(0, 0, 0, 0.3)',
            color: timerState.isPaused ? '#0A1F2E' : '#FFFFFF',
          }}
        >
          {timerState.isPaused ? (
            <>
              <Play className="w-6 h-6" />
              Resume
            </>
          ) : (
            <>
              <Pause className="w-6 h-6" />
              Pause
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default TabataTimer;
