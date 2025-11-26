import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Pause, Play, X } from "lucide-react";

type LadderType = "ascending" | "descending" | "pyramid";
type TimerMode = "forTime" | "amrap";
type Phase = "prep" | "active" | "complete";

interface Exercise {
  name: string;
}

interface LadderConfig {
  ladderType: LadderType;
  startReps: number;
  endReps: number;
  exercises: Exercise[];
  timerMode: TimerMode;
  duration: number; // seconds (for AMRAP mode)
  prepTime: number; // seconds
}

const LadderTimer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const config = location.state as LadderConfig | null;

  // State
  const [phase, setPhase] = useState<Phase>("prep");
  const [currentRound, setCurrentRound] = useState<number>(0);
  const [currentReps, setCurrentReps] = useState<number>(0);
  const [timeElapsed, setTimeElapsed] = useState<number>(0); // For Time mode
  const [timeRemaining, setTimeRemaining] = useState<number>(0); // AMRAP mode or prep
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showPauseMenu, setShowPauseMenu] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const hasAnnouncedRef = useRef<boolean>(false);

  // Redirect if no config
  useEffect(() => {
    if (!config) {
      navigate("/home");
    }
  }, [config, navigate]);

  if (!config) return null;

  // Generate ladder sequence
  const generateLadderSequence = (): number[] => {
    const sequence: number[] = [];

    if (config.ladderType === "ascending") {
      for (let i = config.startReps; i <= config.endReps; i++) {
        sequence.push(i);
      }
    } else if (config.ladderType === "descending") {
      for (let i = config.startReps; i >= config.endReps; i--) {
        sequence.push(i);
      }
    } else if (config.ladderType === "pyramid") {
      // Up: startReps to endReps
      for (let i = config.startReps; i <= config.endReps; i++) {
        sequence.push(i);
      }
      // Down: endReps-1 to startReps
      for (let i = config.endReps - 1; i >= config.startReps; i--) {
        sequence.push(i);
      }
    }

    return sequence;
  };

  const ladderSequence = generateLadderSequence();
  const totalRounds = ladderSequence.length;

  // Wake Lock
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch (err) {
        console.log("Wake Lock not supported");
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

  // Voice announcement
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

  // Initialize - start prep phase
  useEffect(() => {
    if (phase === "prep") {
      setTimeRemaining(config.prepTime);
      setCurrentReps(ladderSequence[0]);

      if (!hasAnnouncedRef.current) {
        hasAnnouncedRef.current = true;
        const ladderTypeText = config.ladderType === "ascending"
          ? "Ascending ladder"
          : config.ladderType === "descending"
          ? "Descending ladder"
          : "Pyramid ladder";
        speak(`Get ready for ${ladderTypeText}. Starting at ${ladderSequence[0]} reps`, true);
      }
    }
  }, [phase, config.prepTime, config.ladderType, ladderSequence, speak]);

  // Timer tick
  useEffect(() => {
    if (isPaused || phase === "complete") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      if (phase === "prep") {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Prep complete, start active phase
            setPhase("active");
            setCurrentRound(1);
            if (config.timerMode === "forTime") {
              setTimeElapsed(0);
              speak("Go!", true);
            } else {
              setTimeRemaining(config.duration);
              speak("Go!", true);
            }
            vibrate([100]);
            return 0;
          }

          // Countdown voice for last 3 seconds
          if (prev <= 3) {
            speak(prev.toString());
          }

          return prev - 1;
        });
      } else if (phase === "active") {
        if (config.timerMode === "forTime") {
          // Stopwatch counts UP
          setTimeElapsed((prev) => prev + 1);
        } else {
          // AMRAP counts DOWN
          setTimeRemaining((prev) => {
            if (prev <= 1) {
              // Time's up!
              handleWorkoutComplete();
              return 0;
            }

            // Countdown voice for last 10 seconds
            if (prev <= 10 && prev > 0) {
              speak(prev.toString());
            }

            return prev - 1;
          });
        }
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused, phase, config.timerMode, config.duration, speak, vibrate]);

  // Handle next round button tap
  const handleNextRound = useCallback(() => {
    if (phase !== "active" || isPaused) return;

    if (config.timerMode === "forTime") {
      // For Time: Check if ladder is complete
      if (currentRound >= totalRounds) {
        handleWorkoutComplete();
        return;
      }

      // Move to next round
      const nextRound = currentRound + 1;
      setCurrentRound(nextRound);
      setCurrentReps(ladderSequence[nextRound - 1]);

      vibrate([50]);

      if (nextRound <= totalRounds) {
        speak(`Round ${nextRound}, ${ladderSequence[nextRound - 1]} reps`, true);
      }

      if (nextRound > totalRounds) {
        handleWorkoutComplete();
      }
    } else {
      // AMRAP: Just progress to next round
      const nextRound = currentRound + 1;

      if (nextRound > totalRounds) {
        // Completed ladder, loop back to start
        setCurrentRound(1);
        setCurrentReps(ladderSequence[0]);
        speak(`Ladder complete! Starting over. ${ladderSequence[0]} reps`, true);
      } else {
        setCurrentRound(nextRound);
        setCurrentReps(ladderSequence[nextRound - 1]);
        speak(`Round ${nextRound}, ${ladderSequence[nextRound - 1]} reps`, true);
      }

      vibrate([50]);
    }
  }, [phase, isPaused, config.timerMode, currentRound, totalRounds, ladderSequence, vibrate, speak]);

  const handleWorkoutComplete = useCallback(() => {
    setPhase("complete");

    if (config.timerMode === "forTime") {
      speak(`Ladder complete! Total time: ${formatTime(timeElapsed)}`, true);
    } else {
      speak(`Time's up! You completed ${currentRound} rounds`, true);
    }

    vibrate([200, 100, 200, 100, 200]);
  }, [config.timerMode, timeElapsed, currentRound, speak, vibrate]);

  // Pause menu handlers
  const handlePauseMenuOpen = () => {
    if (!isPaused) {
      setIsPaused(true);
      speak("Paused");
    }
    setShowPauseMenu(true);
  };

  const handleResume = () => {
    setShowPauseMenu(false);
    setIsPaused(false);
    speak("Resume");
  };

  const handleToggleSound = () => {
    setVoiceEnabled(!voiceEnabled);
  };

  const handleExitFromMenu = () => {
    setShowPauseMenu(false);
    setShowExitConfirm(true);
  };

  const handleExitConfirm = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
    }
    navigate("/home");
  };

  const handleExitCancel = () => {
    setShowExitConfirm(false);
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
    switch (config.ladderType) {
      case "ascending":
        return "ASCENDING";
      case "descending":
        return "DESCENDING";
      case "pyramid":
        return "PYRAMID";
    }
  };

  // Completion screen
  if (phase === "complete") {
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
            {config.timerMode === "forTime" ? "Ladder Complete!" : "Time's Up!"}
          </h1>
          <p className="mb-8 fade-in-up" style={{ color: '#8F8A84', animationDelay: '0.1s' }}>
            {config.timerMode === "forTime"
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
              {config.timerMode === "forTime" ? (
                <>
                  <p className="text-5xl font-bold mb-2" style={{ color: '#4ADE80' }}>
                    {formatTime(timeElapsed)}
                  </p>
                  <p className="text-sm" style={{ color: '#8F8A84' }}>Total Time</p>
                </>
              ) : (
                <>
                  <p className="text-5xl font-bold mb-2" style={{ color: '#4ADE80' }}>
                    {currentRound}
                  </p>
                  <p className="text-sm" style={{ color: '#8F8A84' }}>Rounds Completed</p>
                </>
              )}
            </div>
          </div>

          {/* Workout Details */}
          <div
            className="mb-8 max-w-sm mx-auto p-5 rounded-xl text-left fade-in-up"
            style={{
              background: 'rgba(255, 255, 255, 0.92)',
              border: '1px solid rgba(255, 255, 255, 0.65)',
              animationDelay: '0.25s'
            }}
          >
            <p className="text-sm font-semibold mb-3" style={{ color: '#8F8A84' }}>
              {config.ladderType.charAt(0).toUpperCase() + config.ladderType.slice(1)}: {config.startReps} → {config.endReps}
            </p>
            {config.timerMode === "amrap" && (
              <p className="text-sm mb-3" style={{ color: '#8F8A84' }}>
                Duration: {formatTime(config.duration)}
              </p>
            )}
            <p className="text-xs font-semibold mb-2" style={{ color: '#8F8A84' }}>EXERCISES:</p>
            {config.exercises.map((ex, idx) => (
              <p key={idx} className="text-sm" style={{ color: '#1F2124' }}>
                • {ex.name}
              </p>
            ))}
          </div>

          <button
            onClick={handleComplete}
            className="px-10 py-4 rounded-2xl font-semibold text-lg transition-all active:scale-95 fade-in-up"
            style={{
              background: 'linear-gradient(90deg, #4ADE80, #22C55E)',
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

  // Active timer screen
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
                className="w-full py-4 rounded-full font-semibold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                style={{
                  background: 'linear-gradient(90deg, #4ADE80, #22C55E)',
                  boxShadow: '0 8px 24px rgba(74, 222, 128, 0.4)',
                  color: '#FFFFFF',
                }}
              >
                <Play className="w-6 h-6" />
                Resume
              </button>

              <div className="flex items-center justify-center gap-4 mt-2">
                <button
                  onClick={handleToggleSound}
                  className="text-sm font-medium transition-opacity"
                  style={{ color: '#8F8A84' }}
                >
                  {voiceEnabled ? "Sound: On" : "Sound: Off"}
                </button>
                <span style={{ color: '#8F8A84' }}>•</span>
                <button
                  onClick={handleExitFromMenu}
                  className="text-sm font-medium transition-opacity"
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

      {/* TOP SAFE AREA SPACER */}
      <div style={{ height: 'var(--safe-area-top)' }} />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col px-4 overflow-hidden">

        {/* Status Badge */}
        <div className="flex justify-center pt-8 pb-8">
          <div
            className="px-5 py-2 rounded-full text-sm font-semibold tracking-widest"
            style={{
              background: 'rgba(255, 255, 255, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: '#4ADE80',
              letterSpacing: '1.5px',
            }}
          >
            {phase === "prep" ? "GET READY" : getLadderTypeText()}
          </div>
        </div>

        {/* Timer Display */}
        <div className="flex justify-center mb-12">
          <div className="text-center">
            {phase === "prep" ? (
              <span className="font-bold tabular-nums leading-none" style={{ fontSize: '120px', color: '#1F2124', fontVariantNumeric: 'tabular-nums' }}>
                {timeRemaining}
              </span>
            ) : config.timerMode === "forTime" ? (
              <span className="font-bold tabular-nums leading-none" style={{ fontSize: '120px', color: '#1F2124', fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(timeElapsed)}
              </span>
            ) : (
              <span className="font-bold tabular-nums leading-none" style={{ fontSize: '120px', color: '#1F2124', fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(timeRemaining)}
              </span>
            )}
          </div>
        </div>

        {/* Round Info Card */}
        {phase === "active" && (
          <div
            className="max-w-[280px] mx-auto rounded-3xl p-6 text-center mb-6"
            style={{
              background: 'rgba(255, 255, 255, 0.92)',
              border: '1px solid rgba(255, 255, 255, 0.65)',
              backdropFilter: 'blur(18px)',
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.18)',
            }}
          >
            <p className="text-lg font-semibold mb-2" style={{ color: '#8F8A84' }}>
              Round {currentRound}
            </p>
            <p className="text-5xl font-bold" style={{ color: '#4ADE80' }}>
              {currentReps}
            </p>
            <p className="text-sm mt-2" style={{ color: '#8F8A84' }}>Reps</p>
          </div>
        )}

        {/* Exercise List Card */}
        {phase === "active" && (
          <div
            className="max-w-[320px] mx-auto rounded-3xl p-5 mb-6"
            style={{
              background: 'rgba(255, 255, 255, 0.92)',
              border: '1px solid rgba(255, 255, 255, 0.65)',
              backdropFilter: 'blur(18px)',
            }}
          >
            {config.exercises.map((ex, idx) => (
              <div
                key={idx}
                className="py-2 text-base font-medium"
                style={{
                  color: '#1F2124',
                  borderBottom: idx < config.exercises.length - 1 ? '1px solid rgba(31, 33, 36, 0.1)' : 'none'
                }}
              >
                {idx + 1}. {ex.name} ({currentReps})
              </div>
            ))}
          </div>
        )}

        {/* Progress Display */}
        {phase === "active" && (
          <div
            className="max-w-fit mx-auto px-4 py-2 rounded-full text-sm font-medium mb-6"
            style={{
              background: 'rgba(255, 255, 255, 0.7)',
              color: '#8F8A84',
            }}
          >
            {config.timerMode === "forTime"
              ? `Completed: ${currentRound - 1}/${totalRounds} rounds`
              : `Started at ${ladderSequence[0]} reps`}
          </div>
        )}

        {/* Tap Area or Pause Button */}
        {phase === "active" ? (
          <div className="max-w-[280px] mx-auto mb-8">
            <div
              onClick={handleNextRound}
              className="rounded-3xl p-8 text-center cursor-pointer transition-all active:scale-[0.95]"
              style={{
                background: 'rgba(74, 222, 128, 0.1)',
                border: '2px dashed rgba(74, 222, 128, 0.3)',
              }}
            >
              <h3 className="text-xl font-bold mb-2" style={{ color: '#4ADE80' }}>
                Next Round
              </h3>
              <p className="text-sm" style={{ color: '#8F8A84' }}>
                Tap when done
              </p>
            </div>
          </div>
        ) : null}

        {/* Pause Button */}
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

        <div className="h-4" />

      </div>

      {/* BOTTOM SAFE AREA SPACER */}
      <div style={{ height: 'var(--safe-area-bottom)' }} />

    </div>
  );
};

export default LadderTimer;
