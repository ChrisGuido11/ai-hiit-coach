import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Bookmark,
  GripVertical,
  X,
  Trash2,
  Zap,
  Clock,
  Repeat,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
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

interface SavedWorkout {
  id: string;
  user_id: string;
  framework_type: string;
  created_at: string;
  exercises: {
    warmup: Exercise[];
    main: Exercise[];
    cooldown: Exercise[];
  };
  completed: boolean;
}

interface Exercise {
  name: string;
  duration?: string;
  instructions?: string;
  reps?: number;
}

// Helper function to get relative time
const getRelativeTime = (savedDate: string) => {
  const now = new Date();
  const saved = new Date(savedDate);
  const diffMs = now.getTime() - saved.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60)
    return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffWeeks === 1) return "1 week ago";
  if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
  if (diffMonths === 1) return "1 month ago";
  return `${diffMonths} months ago`;
};

// Get framework icon
const getFrameworkIcon = (framework: string) => {
  switch (framework.toLowerCase()) {
    case "tabata":
      return Zap;
    case "emom":
      return Clock;
    case "amrap":
      return Repeat;
    case "ladder":
      return TrendingUp;
    default:
      return Zap;
  }
};

// Get framework gradient class
const getFrameworkGradient = (framework: string) => {
  switch (framework.toLowerCase()) {
    case "tabata":
      return "bg-gradient-tabata";
    case "emom":
      return "bg-gradient-emom";
    case "amrap":
      return "bg-gradient-amrap";
    case "ladder":
      return "bg-gradient-to-br from-green-400 to-green-500";
    default:
      return "bg-gradient-tabata";
  }
};

// Get workout details string
const getWorkoutDetails = (workout: SavedWorkout) => {
  const exerciseCount = workout.exercises.main.length;
  const framework = workout.framework_type.toLowerCase();

  // For simplicity, we'll show exercise count for all types
  // In a real app, you'd extract this from the workout data
  return `${exerciseCount} exercise${exerciseCount !== 1 ? "s" : ""}`;
};

const SavedWorkouts = () => {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState<SavedWorkout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    workout: SavedWorkout | null;
  }>({
    isOpen: false,
    workout: null,
  });

  useEffect(() => {
    fetchSavedWorkouts();
  }, []);

  const fetchSavedWorkouts = async () => {
    try {
      setIsLoading(true);
      setError(false);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", user.id)
        .eq("completed", false)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      setWorkouts((data as any[]) || []);
    } catch (err) {
      console.error("Failed to fetch saved workouts:", err);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorkoutTap = (workout: SavedWorkout) => {
    if (isEditMode) return;

    navigate(`/workout/${workout.framework_type}`, {
      state: {
        workout: workout.exercises,
        workoutId: workout.id,
      },
    });
  };

  const handleDeleteClick = (workout: SavedWorkout) => {
    setDeleteDialog({
      isOpen: true,
      workout,
    });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.workout) return;

    try {
      const { error: deleteError } = await supabase
        .from("workouts")
        .delete()
        .eq("id", deleteDialog.workout.id);

      if (deleteError) throw deleteError;

      // Update local state
      setWorkouts((prev) =>
        prev.filter((w) => w.id !== deleteDialog.workout!.id)
      );

      setDeleteDialog({ isOpen: false, workout: null });
    } catch (err) {
      console.error("Failed to delete workout:", err);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === index) return;

    const newWorkouts = [...workouts];
    const draggedItem = newWorkouts[draggedIndex];

    // Remove from old position
    newWorkouts.splice(draggedIndex, 1);

    // Insert at new position
    newWorkouts.splice(index, 0, draggedItem);

    setWorkouts(newWorkouts);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;

    setDraggedIndex(null);

    // Note: order column doesn't exist in database, so we just maintain local state
  };

  const handleGenerateNew = () => {
    navigate("/home");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-warm flex flex-col">
        {/* Header */}
        <div
          className="px-6 pt-4 flex items-center justify-between"
          style={{
            paddingTop: "calc(1rem + var(--safe-area-top))",
          }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/home")}
            className="text-foreground active:bg-foreground/10 active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-[22px] font-semibold text-foreground">
            Saved Workouts
          </h1>
          <div className="w-10" />
        </div>

        {/* Loading Skeletons */}
        <div className="flex-1 px-6 pt-6">
          <div className="space-y-3 max-w-2xl mx-auto">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[88px] rounded-[20px] glass-card animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-warm flex flex-col">
        {/* Header */}
        <div
          className="px-6 pt-4 flex items-center justify-between"
          style={{
            paddingTop: "calc(1rem + var(--safe-area-top))",
          }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/home")}
            className="text-foreground active:bg-foreground/10 active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-[22px] font-semibold text-foreground">
            Saved Workouts
          </h1>
          <div className="w-10" />
        </div>

        {/* Error State */}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <div className="w-[120px] h-[120px] mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-12 h-12 text-destructive" />
            </div>
            <h2 className="text-[22px] font-semibold text-foreground mb-3">
              Couldn't Load Workouts
            </h2>
            <p className="text-[15px] text-muted-foreground mb-8 leading-relaxed">
              Please check your connection and try again
            </p>
            <Button
              onClick={fetchSavedWorkouts}
              className="rounded-full h-12 px-8 bg-gradient-primary text-white font-semibold"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (workouts.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-warm flex flex-col">
        {/* Header */}
        <div
          className="px-6 pt-4 flex items-center justify-between"
          style={{
            paddingTop: "calc(1rem + var(--safe-area-top))",
          }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/home")}
            className="text-foreground active:bg-foreground/10 active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-[22px] font-semibold text-foreground">
            Saved Workouts
          </h1>
          <div className="w-10" />
        </div>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-[280px]">
            <div className="w-[120px] h-[120px] mx-auto mb-6 rounded-[28px] bg-gradient-to-br from-orange-400/20 to-pink-400/20 backdrop-blur-sm border-2 border-white/20 flex items-center justify-center shadow-[0_8px_32px_rgba(251,146,60,0.15)]">
              <Zap className="w-14 h-14 text-orange-500" />
            </div>
            <h2 className="text-[22px] font-semibold text-foreground mb-3">
              No Saved Workouts Yet
            </h2>
            <p className="text-[15px] text-muted-foreground mb-8 leading-relaxed">
              Start generating your first workout and save it for quick access.
            </p>
            <Button
              onClick={handleGenerateNew}
              className="rounded-full h-12 px-8 bg-gradient-primary text-white font-semibold shadow-[0_10px_30px_rgba(254,173,99,0.3)] active:scale-95 transition-transform"
            >
              Generate Workout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm flex flex-col">
      {/* Header */}
      <div
        className="px-6 pt-4 flex items-center justify-between"
        style={{
          paddingTop: "calc(1rem + var(--safe-area-top))",
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/home")}
          className="text-foreground active:bg-foreground/10 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-[22px] font-semibold text-foreground">
          Saved Workouts
        </h1>
        <Button
          variant="ghost"
          onClick={() => setIsEditMode(!isEditMode)}
          className="text-[14px] font-semibold text-primary hover:bg-transparent active:opacity-70"
        >
          {isEditMode ? "Done" : "Edit"}
        </Button>
      </div>

      {/* Workout List */}
      <div
        className="flex-1 px-6 pt-6 pb-24"
        style={{
          paddingBottom: "calc(6rem + var(--safe-area-bottom))",
        }}
      >
        <div className="space-y-3 max-w-2xl mx-auto">
          {workouts.map((workout, index) => {
            const Icon = getFrameworkIcon(workout.framework_type);
            const gradientClass = getFrameworkGradient(workout.framework_type);
            const isDragging = draggedIndex === index;

            return (
              <div
                key={workout.id}
                draggable={isEditMode}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => handleWorkoutTap(workout)}
                className={`
                  glass-card rounded-[20px] p-4 flex items-center gap-4
                  transition-all duration-200
                  ${!isEditMode ? "active:scale-[0.98] cursor-pointer" : ""}
                  ${isDragging ? "opacity-50 scale-105 shadow-elevated" : ""}
                `}
              >
                {/* Drag Handle */}
                {isEditMode && (
                  <div className="cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}

                {/* Icon */}
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${gradientClass}`}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[18px] font-bold text-foreground mb-1 capitalize">
                    {workout.framework_type}
                  </h3>
                  <p className="text-[14px] font-medium text-muted-foreground mb-1">
                    {getWorkoutDetails(workout)}
                  </p>
                  <p className="text-[13px] text-muted-foreground opacity-80">
                    Saved {getRelativeTime(workout.created_at)}
                  </p>
                </div>

                {/* Delete Button or Arrow */}
                {isEditMode ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(workout);
                    }}
                    className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0 active:scale-90 transition-all"
                  >
                    <X className="w-[18px] h-[18px] text-destructive" />
                  </button>
                ) : (
                  <div className="w-5 h-5 flex-shrink-0">
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      className="text-muted-foreground opacity-50"
                    >
                      <path
                        d="M7 4l6 6-6 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) =>
          !open && setDeleteDialog({ isOpen: false, workout: null })
        }
      >
        <AlertDialogContent className="rounded-[32px] glass-card max-w-[340px] mx-4 p-8">
          <AlertDialogHeader className="space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/15 border-2 border-destructive/30 flex items-center justify-center">
              <Trash2 className="w-7 h-7 text-destructive" />
            </div>
            <AlertDialogTitle className="text-[24px] font-bold text-foreground text-center">
              Delete Workout?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[15px] text-muted-foreground text-center leading-relaxed">
              Are you sure you want to delete this workout?
              <br />
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 sm:gap-3 mt-6">
            <AlertDialogCancel className="flex-1 h-12 rounded-full border-2 border-foreground/15 hover:bg-foreground/5">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="flex-1 h-12 rounded-full bg-gradient-to-r from-destructive to-pink-400 hover:opacity-90 text-white font-semibold shadow-[0_8px_24px_rgba(251,113,133,0.3)]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SavedWorkouts;
