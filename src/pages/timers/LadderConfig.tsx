import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LadderType = "ascending" | "descending" | "pyramid";
type TimerMode = "forTime" | "amrap";

interface Exercise {
  name: string;
}

const LadderConfig = () => {
  const navigate = useNavigate();

  // Configuration state
  const [ladderType, setLadderType] = useState<LadderType>("ascending");
  const [startReps, setStartReps] = useState<number>(1);
  const [endReps, setEndReps] = useState<number>(10);
  const [exercises, setExercises] = useState<Exercise[]>([
    { name: "Push-ups" },
    { name: "Squats" }
  ]);
  const [timerMode, setTimerMode] = useState<TimerMode>("forTime");
  const [duration, setDuration] = useState<number>(600); // 10 minutes default
  const [prepTime, setPrepTime] = useState<number>(10); // 10 seconds default
  const [newExerciseName, setNewExerciseName] = useState<string>("");
  const [showAddExercise, setShowAddExercise] = useState<boolean>(false);

  // Generate preview of ladder sequence
  const generatePreview = (): number[] => {
    const preview: number[] = [];

    if (ladderType === "ascending") {
      for (let i = startReps; i <= Math.min(endReps, startReps + 5); i++) {
        preview.push(i);
      }
    } else if (ladderType === "descending") {
      for (let i = startReps; i >= Math.max(endReps, startReps - 5); i--) {
        preview.push(i);
      }
    } else if (ladderType === "pyramid") {
      // Show ascending part
      for (let i = startReps; i <= Math.min(endReps, startReps + 3); i++) {
        preview.push(i);
      }
    }

    return preview;
  };

  const previewSequence = generatePreview();

  const handleAddExercise = () => {
    if (newExerciseName.trim() && exercises.length < 3) {
      setExercises([...exercises, { name: newExerciseName.trim() }]);
      setNewExerciseName("");
      setShowAddExercise(false);
    }
  };

  const handleRemoveExercise = (index: number) => {
    if (exercises.length > 1) {
      setExercises(exercises.filter((_, i) => i !== index));
    }
  };

  const handleStartWorkout = () => {
    // Validate
    if (exercises.length === 0) {
      alert("Please add at least one exercise");
      return;
    }

    if (ladderType === "ascending" && startReps >= endReps) {
      alert("For ascending ladder, start reps must be less than end reps");
      return;
    }

    if (ladderType === "descending" && startReps <= endReps) {
      alert("For descending ladder, start reps must be greater than end reps");
      return;
    }

    if (ladderType === "pyramid" && startReps >= endReps) {
      alert("For pyramid ladder, start reps must be less than peak reps");
      return;
    }

    // Navigate to timer with configuration
    navigate("/workout/ladder/timer", {
      state: {
        ladderType,
        startReps,
        endReps,
        exercises,
        timerMode,
        duration,
        prepTime
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-warm flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 pt-4"
        style={{ paddingTop: 'calc(1rem + var(--safe-area-top))' }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/home")}
          className="text-foreground active:bg-foreground/10 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Ladder Setup</h1>
        <div className="w-10" />
      </div>

      {/* Scrollable Content */}
      <div
        className="flex-1 overflow-y-auto px-6 pb-32 pt-6"
        style={{ paddingBottom: 'calc(10rem + var(--safe-area-bottom))' }}
      >
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Ladder Type */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-3">Ladder Type</h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setLadderType("ascending")}
                className={`py-4 px-4 rounded-2xl font-semibold transition-all active:scale-95 ${
                  ladderType === "ascending"
                    ? "bg-gradient-to-br from-green-400 to-green-500 text-white shadow-lg"
                    : "bg-white/60 text-foreground border border-white/40"
                }`}
              >
                <TrendingUp className="w-5 h-5 mx-auto mb-1" />
                <div className="text-sm">Ascending</div>
              </button>
              <button
                onClick={() => setLadderType("descending")}
                className={`py-4 px-4 rounded-2xl font-semibold transition-all active:scale-95 ${
                  ladderType === "descending"
                    ? "bg-gradient-to-br from-green-400 to-green-500 text-white shadow-lg"
                    : "bg-white/60 text-foreground border border-white/40"
                }`}
              >
                <TrendingUp className="w-5 h-5 mx-auto mb-1 rotate-180" />
                <div className="text-sm">Descending</div>
              </button>
              <button
                onClick={() => setLadderType("pyramid")}
                className={`py-4 px-4 rounded-2xl font-semibold transition-all active:scale-95 ${
                  ladderType === "pyramid"
                    ? "bg-gradient-to-br from-green-400 to-green-500 text-white shadow-lg"
                    : "bg-white/60 text-foreground border border-white/40"
                }`}
              >
                <div className="text-2xl mb-1">⛰️</div>
                <div className="text-sm">Pyramid</div>
              </button>
            </div>
          </div>

          {/* Rep Range */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-3">Rep Range</h3>
            <div
              className="rounded-2xl p-5 backdrop-blur-lg"
              style={{
                background: 'rgba(255, 255, 255, 0.92)',
                border: '1px solid rgba(255, 255, 255, 0.65)',
              }}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    {ladderType === "pyramid" ? "Start" : ladderType === "ascending" ? "Start" : "Start"}
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={startReps}
                    onChange={(e) => setStartReps(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-12 text-center text-lg font-bold"
                  />
                </div>
                <div className="text-2xl text-muted-foreground pt-6">→</div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    {ladderType === "pyramid" ? "Peak" : "End"}
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={endReps}
                    onChange={(e) => setEndReps(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-12 text-center text-lg font-bold"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-foreground/10">
                <p className="text-sm font-medium text-muted-foreground mb-2">Preview:</p>
                <p className="text-base font-semibold" style={{ color: '#4ADE80' }}>
                  {previewSequence.join(", ")}
                  {previewSequence.length >= 5 && ladderType !== "pyramid" ? "..." : ""}
                  {ladderType === "pyramid" && `, ${endReps}, ...`}
                </p>
              </div>
            </div>
          </div>

          {/* Exercises */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-3">
              Exercises <span className="text-sm font-normal text-muted-foreground">(Same reps each round)</span>
            </h3>
            <div className="space-y-3">
              {exercises.map((exercise, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-4 rounded-2xl backdrop-blur-lg"
                  style={{
                    background: 'rgba(255, 255, 255, 0.92)',
                    border: '1px solid rgba(255, 255, 255, 0.65)',
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 font-semibold text-foreground">
                    {exercise.name}
                  </div>
                  {exercises.length > 1 && (
                    <button
                      onClick={() => handleRemoveExercise(index)}
                      className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center active:scale-95 transition-all"
                    >
                      <X className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>
              ))}

              {exercises.length < 3 && !showAddExercise && (
                <button
                  onClick={() => setShowAddExercise(true)}
                  className="w-full py-4 rounded-2xl border-2 border-dashed border-foreground/20 text-foreground font-semibold active:scale-95 transition-all"
                  style={{ background: 'rgba(255, 255, 255, 0.4)' }}
                >
                  <Plus className="w-5 h-5 mx-auto mb-1" />
                  Add Exercise
                </button>
              )}

              {showAddExercise && (
                <div
                  className="p-4 rounded-2xl backdrop-blur-lg space-y-3"
                  style={{
                    background: 'rgba(255, 255, 255, 0.92)',
                    border: '1px solid rgba(255, 255, 255, 0.65)',
                  }}
                >
                  <Input
                    type="text"
                    placeholder="Exercise name..."
                    value={newExerciseName}
                    onChange={(e) => setNewExerciseName(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleAddExercise()}
                    className="h-12"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddExercise}
                      disabled={!newExerciseName.trim()}
                      className="flex-1 h-11"
                    >
                      Add
                    </Button>
                    <Button
                      onClick={() => {
                        setShowAddExercise(false);
                        setNewExerciseName("");
                      }}
                      variant="outline"
                      className="flex-1 h-11"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timer Mode */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-3">Timer Mode</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTimerMode("forTime")}
                className={`py-5 px-4 rounded-2xl font-semibold transition-all active:scale-95 ${
                  timerMode === "forTime"
                    ? "bg-gradient-to-br from-green-400 to-green-500 text-white shadow-lg"
                    : "bg-white/60 text-foreground border border-white/40"
                }`}
              >
                <div className="text-2xl mb-2">⏱️</div>
                <div className="font-bold">For Time</div>
                <div className="text-xs mt-1 opacity-80">Stopwatch (counts up)</div>
              </button>
              <button
                onClick={() => setTimerMode("amrap")}
                className={`py-5 px-4 rounded-2xl font-semibold transition-all active:scale-95 ${
                  timerMode === "amrap"
                    ? "bg-gradient-to-br from-green-400 to-green-500 text-white shadow-lg"
                    : "bg-white/60 text-foreground border border-white/40"
                }`}
              >
                <div className="text-2xl mb-2">⏰</div>
                <div className="font-bold">AMRAP Style</div>
                <div className="text-xs mt-1 opacity-80">Countdown timer</div>
              </button>
            </div>
          </div>

          {/* Duration (AMRAP only) */}
          {timerMode === "amrap" && (
            <div>
              <h3 className="text-lg font-bold text-foreground mb-3">Duration</h3>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setDuration(600)}
                  className={`py-4 rounded-2xl font-semibold transition-all active:scale-95 ${
                    duration === 600
                      ? "bg-gradient-to-br from-green-400 to-green-500 text-white shadow-lg"
                      : "bg-white/60 text-foreground border border-white/40"
                  }`}
                >
                  10 min
                </button>
                <button
                  onClick={() => setDuration(900)}
                  className={`py-4 rounded-2xl font-semibold transition-all active:scale-95 ${
                    duration === 900
                      ? "bg-gradient-to-br from-green-400 to-green-500 text-white shadow-lg"
                      : "bg-white/60 text-foreground border border-white/40"
                  }`}
                >
                  15 min
                </button>
                <button
                  onClick={() => setDuration(1200)}
                  className={`py-4 rounded-2xl font-semibold transition-all active:scale-95 ${
                    duration === 1200
                      ? "bg-gradient-to-br from-green-400 to-green-500 text-white shadow-lg"
                      : "bg-white/60 text-foreground border border-white/40"
                  }`}
                >
                  20 min
                </button>
              </div>
            </div>
          )}

          {/* Prep Time */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-3">Prep Time</h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setPrepTime(5)}
                className={`py-4 rounded-2xl font-semibold transition-all active:scale-95 ${
                  prepTime === 5
                    ? "bg-gradient-to-br from-green-400 to-green-500 text-white shadow-lg"
                    : "bg-white/60 text-foreground border border-white/40"
                }`}
              >
                5 sec
              </button>
              <button
                onClick={() => setPrepTime(10)}
                className={`py-4 rounded-2xl font-semibold transition-all active:scale-95 ${
                  prepTime === 10
                    ? "bg-gradient-to-br from-green-400 to-green-500 text-white shadow-lg"
                    : "bg-white/60 text-foreground border border-white/40"
                }`}
              >
                10 sec
              </button>
              <button
                onClick={() => setPrepTime(15)}
                className={`py-4 rounded-2xl font-semibold transition-all active:scale-95 ${
                  prepTime === 15
                    ? "bg-gradient-to-br from-green-400 to-green-500 text-white shadow-lg"
                    : "bg-white/60 text-foreground border border-white/40"
                }`}
              >
                15 sec
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Fixed Start Button */}
      <div
        className="fixed bottom-0 left-0 right-0 p-6 pt-8 backdrop-blur-xl"
        style={{
          background: 'linear-gradient(to top, rgba(245, 241, 238, 0.98) 60%, rgba(245, 241, 238, 0.8) 80%, transparent)',
          paddingBottom: 'calc(1.5rem + var(--safe-area-bottom))',
          borderTop: '1px solid rgba(255, 255, 255, 0.3)'
        }}
      >
        <div className="max-w-2xl mx-auto">
          <Button
            onClick={handleStartWorkout}
            size="lg"
            className="w-full text-base font-bold rounded-3xl h-14 bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 shadow-lg"
          >
            Start Ladder Workout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LadderConfig;
