import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Zap, Clock, Repeat, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WorkoutHistoryItem {
  id: string;
  completed_at: string;
  duration_minutes: number;
  workout: {
    framework_type: string;
  };
}

interface FrameworkStats {
  count: number;
  totalMinutes: number;
}

interface Achievement {
  title: string;
  description: string;
  date: string;
  emoji: string;
}

const MyStats = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [totalTime, setTotalTime] = useState({ hours: 0, minutes: 0 });
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [avgDuration, setAvgDuration] = useState(0);
  const [frameworkStats, setFrameworkStats] = useState<{
    [key: string]: FrameworkStats;
  }>({});
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
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
            framework_type
          )
        `)
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const workouts = data as any as WorkoutHistoryItem[];

        // Total workouts
        setTotalWorkouts(workouts.length);

        // Total time
        const totalMinutes = workouts.reduce(
          (sum, w) => sum + w.duration_minutes,
          0
        );
        setTotalTime({
          hours: Math.floor(totalMinutes / 60),
          minutes: totalMinutes % 60,
        });

        // Average duration
        setAvgDuration(Math.round(totalMinutes / workouts.length));

        // Current streak
        const currentStreakDays = calculateCurrentStreak(workouts);
        setCurrentStreak(currentStreakDays);

        // Longest streak
        const longestStreakDays = calculateLongestStreak(workouts);
        setLongestStreak(longestStreakDays);

        // Framework breakdown
        const frameworks: { [key: string]: FrameworkStats } = {};
        workouts.forEach((w) => {
          const type = w.workout.framework_type.toLowerCase();
          if (!frameworks[type]) {
            frameworks[type] = { count: 0, totalMinutes: 0 };
          }
          frameworks[type].count++;
          frameworks[type].totalMinutes += w.duration_minutes;
        });
        setFrameworkStats(frameworks);

        // Achievements
        const achs = calculateAchievements(workouts, currentStreakDays, user);
        setAchievements(achs);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast({
        title: "Error",
        description: "Failed to load stats",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateCurrentStreak = (workouts: WorkoutHistoryItem[]) => {
    if (workouts.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const mostRecent = new Date(workouts[0].completed_at);
    mostRecent.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor(
      (today.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff > 1) return 0;

    let currentDate = new Date(today);
    if (daysDiff === 1) {
      currentDate.setDate(currentDate.getDate() - 1);
      streak = 1;
    }

    for (const workout of workouts) {
      const workoutDate = new Date(workout.completed_at);
      workoutDate.setHours(0, 0, 0, 0);

      if (workoutDate.getTime() === currentDate.getTime()) {
        if (streak === 0) streak = 1;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (workoutDate.getTime() < currentDate.getTime()) {
        const diff = Math.floor(
          (currentDate.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diff === 1) {
          streak++;
          currentDate = new Date(workoutDate);
        } else {
          break;
        }
      }
    }

    return streak;
  };

  const calculateLongestStreak = (workouts: WorkoutHistoryItem[]) => {
    if (workouts.length === 0) return 0;

    let longestStreak = 0;
    let currentStreak = 1;

    // Sort by date ascending
    const sorted = [...workouts].sort(
      (a, b) =>
        new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
    );

    for (let i = 1; i < sorted.length; i++) {
      const prevDate = new Date(sorted[i - 1].completed_at);
      prevDate.setHours(0, 0, 0, 0);
      const currDate = new Date(sorted[i].completed_at);
      currDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 1) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else if (daysDiff > 1) {
        currentStreak = 1;
      }
    }

    return Math.max(longestStreak, 1);
  };

  const calculateAchievements = (
    workouts: WorkoutHistoryItem[],
    streak: number,
    user: any
  ): Achievement[] => {
    const achs: Achievement[] = [];

    if (workouts.length > 0) {
      achs.push({
        title: "First Workout",
        description: new Date(workouts[workouts.length - 1].completed_at).toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric", year: "numeric" }
        ),
        date: workouts[workouts.length - 1].completed_at,
        emoji: "🎉",
      });
    }

    if (streak >= 7) {
      achs.push({
        title: "7 Day Streak",
        description: "Today",
        date: new Date().toISOString(),
        emoji: "🔥",
      });
    }

    if (workouts.length >= 10) {
      const tenthWorkout = [...workouts]
        .sort(
          (a, b) =>
            new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
        )
        .find((_, idx) => idx === 9);
      if (tenthWorkout) {
        achs.push({
          title: "10 Workouts Completed",
          description: new Date(tenthWorkout.completed_at).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric", year: "numeric" }
          ),
          date: tenthWorkout.completed_at,
          emoji: "💪",
        });
      }
    }

    if (workouts.length >= 25) {
      const twentyFifthWorkout = [...workouts]
        .sort(
          (a, b) =>
            new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
        )
        .find((_, idx) => idx === 24);
      if (twentyFifthWorkout) {
        achs.push({
          title: "25 Workouts Completed",
          description: new Date(twentyFifthWorkout.completed_at).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric", year: "numeric" }
          ),
          date: twentyFifthWorkout.completed_at,
          emoji: "🏆",
        });
      }
    }

    return achs.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  const getFrameworkIcon = (framework: string) => {
    switch (framework) {
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
    switch (framework) {
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

  const formatFrameworkName = (framework: string) => {
    return framework.charAt(0).toUpperCase() + framework.slice(1);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

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
        <h1 className="text-xl font-semibold text-foreground">My Stats</h1>
        <div className="w-10"></div>
      </div>

      {/* Overall Stats */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-bold text-foreground mb-3">Overall</h2>
        <div className="glass-card p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-base text-foreground">Total Workouts</span>
            <span className="text-lg font-bold text-primary">{totalWorkouts}</span>
          </div>
          <div className="h-px bg-border"></div>
          <div className="flex justify-between items-center">
            <span className="text-base text-foreground">Total Time</span>
            <span className="text-lg font-bold text-primary">
              {totalTime.hours}h {totalTime.minutes}m
            </span>
          </div>
          <div className="h-px bg-border"></div>
          <div className="flex justify-between items-center">
            <span className="text-base text-foreground">Current Streak</span>
            <span className="text-lg font-bold text-primary">
              {currentStreak}🔥
            </span>
          </div>
          <div className="h-px bg-border"></div>
          <div className="flex justify-between items-center">
            <span className="text-base text-foreground">Longest Streak</span>
            <span className="text-lg font-bold text-primary">
              {longestStreak}🔥
            </span>
          </div>
          <div className="h-px bg-border"></div>
          <div className="flex justify-between items-center">
            <span className="text-base text-foreground">Avg. Workout Time</span>
            <span className="text-lg font-bold text-primary">{avgDuration}m</span>
          </div>
        </div>
      </div>

      {/* By Framework */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-bold text-foreground mb-3">By Framework</h2>
        <div className="glass-card divide-y divide-border">
          {Object.keys(frameworkStats).length === 0 ? (
            <div className="p-5 text-center text-muted-foreground">
              No workouts yet
            </div>
          ) : (
            Object.entries(frameworkStats).map(([framework, stats]) => {
              const Icon = getFrameworkIcon(framework);
              return (
                <div key={framework} className="p-4 flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getFrameworkColor(
                      framework
                    )}`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">
                      {formatFrameworkName(framework)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {stats.count} workouts · {formatTime(stats.totalMinutes)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Recent Achievements */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-bold text-foreground mb-3">
          Recent Achievements
        </h2>
        <div className="glass-card divide-y divide-border">
          {achievements.length === 0 ? (
            <div className="p-5 text-center text-muted-foreground">
              Complete workouts to earn achievements
            </div>
          ) : (
            achievements.map((achievement, index) => (
              <div key={index} className="p-4 flex items-center gap-4">
                <div className="text-3xl">{achievement.emoji}</div>
                <div className="flex-1">
                  <div className="font-semibold text-foreground">
                    {achievement.title}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {achievement.description}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MyStats;
