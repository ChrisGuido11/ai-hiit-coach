import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Zap, Clock, Repeat, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Workout {
  id: string;
  framework_type: string;
  name: string | null;
  exercises: any;
  created_at: string;
  completed: boolean;
}

interface WorkoutHistoryItem {
  id: string;
  workout_id: string;
  completed_at: string;
  duration_minutes: number;
  workout: Workout;
}

interface GroupedWorkouts {
  [key: string]: WorkoutHistoryItem[];
}

const WorkoutHistory = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [workouts, setWorkouts] = useState<WorkoutHistoryItem[]>([]);
  const [filteredWorkouts, setFilteredWorkouts] = useState<WorkoutHistoryItem[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const filters = [
    { id: "all", name: "All" },
    { id: "tabata", name: "Tabata" },
    { id: "emom", name: "EMOM" },
    { id: "amrap", name: "AMRAP" },
    { id: "ladder", name: "Ladder" },
  ];

  useEffect(() => {
    fetchWorkoutHistory();
  }, []);

  useEffect(() => {
    if (selectedFilter === "all") {
      setFilteredWorkouts(workouts);
    } else {
      setFilteredWorkouts(
        workouts.filter((w) => w.workout.framework_type.toLowerCase() === selectedFilter)
      );
    }
  }, [selectedFilter, workouts]);

  const fetchWorkoutHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("workout_history")
        .select(`
          *,
          workout:workouts (
            id,
            framework_type,
            name,
            exercises,
            created_at,
            completed
          )
        `)
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false });

      if (error) throw error;

      if (data) {
        setWorkouts(data as any);
        setFilteredWorkouts(data as any);
      }
    } catch (error) {
      console.error("Error fetching workout history:", error);
      toast({
        title: "Error",
        description: "Failed to load workout history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const groupWorkoutsByDate = (workouts: WorkoutHistoryItem[]): GroupedWorkouts => {
    const grouped: GroupedWorkouts = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    workouts.forEach((workout) => {
      const workoutDate = new Date(workout.completed_at);
      workoutDate.setHours(0, 0, 0, 0);

      let groupKey: string;

      if (workoutDate.getTime() === today.getTime()) {
        groupKey = "Today";
      } else if (workoutDate.getTime() === yesterday.getTime()) {
        groupKey = "Yesterday";
      } else if (workoutDate.getTime() > oneWeekAgo.getTime()) {
        groupKey = "This Week";
      } else {
        groupKey = workoutDate.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
      }

      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(workout);
    });

    return grouped;
  };

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

  const getFrameworkColor = (framework: string) => {
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
        return "bg-gradient-primary";
    }
  };

  const getFrameworkGlow = (framework: string) => {
    switch (framework.toLowerCase()) {
      case "tabata":
        return "shadow-[0_0_24px_rgba(54,209,220,0.4)]";
      case "emom":
        return "shadow-[0_0_24px_rgba(255,107,181,0.4)]";
      case "amrap":
        return "shadow-[0_0_24px_rgba(168,85,247,0.4)]";
      case "ladder":
        return "shadow-[0_0_24px_rgba(74,222,128,0.4)]";
      default:
        return "glow-primary";
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDayOfWeek = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
    });
  };

  const getExerciseCount = (exercises: any) => {
    if (!exercises) return 0;
    let count = 0;
    if (exercises.warmup) count += exercises.warmup.length;
    if (exercises.main) count += exercises.main.length;
    if (exercises.cooldown) count += exercises.cooldown.length;
    return count;
  };

  const groupedWorkouts = groupWorkoutsByDate(filteredWorkouts);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-warm flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm pb-8">
      {/* Header */}
      <div
        className="px-6 pt-4 pb-4 flex items-center justify-between"
        style={{
          paddingTop: "calc(1rem + var(--safe-area-top))",
        }}
      >
        <button
          onClick={() => navigate("/profile")}
          className="p-2 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">Workout History</h1>
        <div className="w-10"></div>
      </div>

      {/* Filter Buttons */}
      <div className="px-6 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedFilter === filter.id
                  ? "bg-gradient-primary text-white shadow-lg"
                  : "glass-pill text-foreground"
              }`}
            >
              {filter.name}
            </button>
          ))}
        </div>
      </div>

      {/* Workout List */}
      <div className="px-6 space-y-6">
        {Object.keys(groupedWorkouts).length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground">No workouts completed yet</p>
          </div>
        ) : (
          Object.entries(groupedWorkouts).map(([date, workouts]) => (
            <div key={date}>
              <h2 className="text-lg font-bold text-foreground mb-3">{date}</h2>
              <div className="space-y-3">
                {workouts.map((item) => {
                  const Icon = getFrameworkIcon(item.workout.framework_type);
                  return (
                    <div
                      key={item.id}
                      className="glass-card p-4 flex items-center gap-4"
                    >
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${getFrameworkColor(
                          item.workout.framework_type
                        )} ${getFrameworkGlow(item.workout.framework_type)}`}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-foreground capitalize">
                            {item.workout.framework_type}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-sm text-muted-foreground">
                            {item.duration_minutes} min
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {getExerciseCount(item.workout.exercises)} exercises
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {date === "Today" || date === "Yesterday"
                            ? formatTime(item.completed_at)
                            : `${formatDayOfWeek(item.completed_at)} ${formatTime(
                                item.completed_at
                              )}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default WorkoutHistory;
