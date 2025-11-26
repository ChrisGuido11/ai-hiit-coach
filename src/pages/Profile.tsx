import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Target,
  Trophy,
  Dumbbell,
  Volume2,
  Bell,
  Info,
  LogOut,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
}

interface UserPreferences {
  fitness_level: string;
  fitness_goal: string[];
  available_equipment: string[];
  workout_duration: string;
}

interface WorkoutStats {
  totalWorkouts: number;
  totalTime: string;
  currentStreak: number;
}

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [stats, setStats] = useState<WorkoutStats>({
    totalWorkouts: 0,
    totalTime: "0h 0m",
    currentStreak: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch preferences
      const { data: prefsData } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (prefsData) {
        setPreferences(prefsData);
      }

      // Fetch workout stats
      await fetchWorkoutStats(user.id);
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkoutStats = async (userId: string) => {
    try {
      // Fetch completed workouts
      const { data: workouts } = await supabase
        .from("workout_history")
        .select("*")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false });

      if (workouts && workouts.length > 0) {
        // Calculate total workouts
        const totalWorkouts = workouts.length;

        // Calculate total time
        const totalMinutes = workouts.reduce(
          (sum, w) => sum + w.duration_minutes,
          0
        );
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const totalTime = `${hours}h ${minutes}m`;

        // Calculate current streak
        const currentStreak = calculateStreak(workouts);

        setStats({ totalWorkouts, totalTime, currentStreak });
      }
    } catch (error) {
      console.error("Error fetching workout stats:", error);
    }
  };

  const calculateStreak = (workouts: any[]) => {
    if (workouts.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if there's a workout today or yesterday to start streak
    const mostRecent = new Date(workouts[0].completed_at);
    mostRecent.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor(
      (today.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff > 1) return 0; // Streak broken

    let currentDate = new Date(today);
    if (daysDiff === 1) {
      currentDate.setDate(currentDate.getDate() - 1);
      streak = 1;
    }

    // Count consecutive days
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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Error logging out:", error);
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Delete user data
      await supabase.from("user_preferences").delete().eq("user_id", user.id);
      await supabase.from("workout_history").delete().eq("user_id", user.id);
      await supabase.from("workouts").delete().eq("user_id", user.id);
      await supabase.from("profiles").delete().eq("id", user.id);

      // Sign out
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({
        title: "Error",
        description: "Failed to delete account",
        variant: "destructive",
      });
    }
  };

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  const formatMemberSince = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const formatFitnessLevel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  const formatGoals = (goals: string[]) => {
    if (!goals || goals.length === 0) return "Not set";
    return goals
      .map((g) => g.charAt(0).toUpperCase() + g.slice(1))
      .join(", ");
  };

  const formatEquipment = (equipment: string[]) => {
    if (!equipment || equipment.length === 0) return "None";
    return equipment
      .map((e) => e.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" "))
      .join(", ");
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
          onClick={() => navigate("/home")}
          className="p-2 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">Profile</h1>
        <div className="w-10"></div>
      </div>

      {/* Profile Header Card */}
      <div className="px-6 mb-6">
        <div className="glass-card p-6 text-center">
          <div className="relative inline-block mb-4">
            <Avatar className="w-20 h-20 border-4 border-white shadow-lg">
              <AvatarImage src="" />
              <AvatarFallback className="bg-gradient-primary text-white text-2xl font-bold">
                {profile ? getInitials(profile.email) : "U"}
              </AvatarFallback>
            </Avatar>
            <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary border-2 border-white flex items-center justify-center active:scale-95 transition-transform">
              <Camera className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          <h2 className="text-[22px] font-bold text-foreground mb-1">
            {profile?.email.split("@")[0] || "User"}
          </h2>
          <p className="text-[13px] font-medium text-muted-foreground">
            Member since {profile ? formatMemberSince(profile.created_at) : ""}
          </p>
        </div>
      </div>

      {/* Stats Overview Card */}
      <div className="px-6 mb-6">
        <div className="glass-card p-5">
          <div className="flex justify-around">
            <div className="text-center flex-1">
              <div className="text-[28px] font-extrabold text-primary mb-1">
                {stats.totalWorkouts}
              </div>
              <div className="text-[13px] font-medium text-muted-foreground uppercase tracking-wide">
                Workouts
              </div>
            </div>
            <div className="w-px bg-border"></div>
            <div className="text-center flex-1">
              <div className="text-[28px] font-extrabold text-primary mb-1">
                {stats.totalTime}
              </div>
              <div className="text-[13px] font-medium text-muted-foreground uppercase tracking-wide">
                Time
              </div>
            </div>
            <div className="w-px bg-border"></div>
            <div className="text-center flex-1">
              <div className="text-[28px] font-extrabold text-primary mb-1">
                {stats.currentStreak}
              </div>
              <div className="text-[13px] font-medium text-muted-foreground uppercase tracking-wide">
                Streak
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="px-6 space-y-3">
        {/* Workout History */}
        <button
          onClick={() => navigate("/profile/workout-history")}
          className="w-full glass-card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-tabata shadow-[0_0_32px_rgba(54,209,220,0.5)]">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-base font-semibold text-foreground">
              Workout History
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
        </button>

        {/* My Stats */}
        <button
          onClick={() => navigate("/profile/stats")}
          className="w-full glass-card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-emom shadow-[0_0_32px_rgba(255,107,181,0.5)]">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-base font-semibold text-foreground">
              My Stats
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
        </button>
      </div>

      {/* Preferences Section */}
      <div className="px-6 mt-8 mb-3">
        <h3 className="text-[15px] font-bold text-muted-foreground uppercase tracking-wide">
          Preferences
        </h3>
      </div>

      <div className="px-6 space-y-3">
        {/* Fitness Level */}
        <button
          onClick={() => navigate("/profile/fitness-level")}
          className="w-full glass-card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-amrap shadow-[0_0_32px_rgba(168,85,247,0.5)]">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-base font-semibold text-foreground">
              Fitness Level
            </div>
            <div className="text-[13px] text-muted-foreground">
              {preferences ? formatFitnessLevel(preferences.fitness_level) : "Not set"}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
        </button>

        {/* Fitness Goals */}
        <button
          onClick={() => navigate("/profile/fitness-goals")}
          className="w-full glass-card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-circuit shadow-[0_0_32px_rgba(74,222,128,0.5)]">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-base font-semibold text-foreground">
              Fitness Goals
            </div>
            <div className="text-[13px] text-muted-foreground line-clamp-1">
              {preferences ? formatGoals(preferences.fitness_goal) : "Not set"}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
        </button>

        {/* Available Equipment */}
        <button
          onClick={() => navigate("/profile/equipment")}
          className="w-full glass-card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-primary shadow-[0_0_40px_rgba(254,173,99,0.5)]">
            <Dumbbell className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-base font-semibold text-foreground">
              Available Equipment
            </div>
            <div className="text-[13px] text-muted-foreground line-clamp-1">
              {preferences ? formatEquipment(preferences.available_equipment) : "Not set"}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
        </button>
      </div>

      {/* Settings Section */}
      <div className="px-6 mt-8 mb-3">
        <h3 className="text-[15px] font-bold text-muted-foreground uppercase tracking-wide">
          Settings
        </h3>
      </div>

      <div className="px-6 space-y-3">
        {/* Voice Coaching */}
        <button
          onClick={() => navigate("/profile/voice-coaching")}
          className="w-full glass-card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-tabata shadow-[0_0_32px_rgba(54,209,220,0.5)]">
            <Volume2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-base font-semibold text-foreground">
              Voice Coaching
            </div>
            <div className="text-[13px] text-muted-foreground">Enabled</div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
        </button>

        {/* Notifications */}
        <button
          onClick={() => navigate("/profile/notifications")}
          className="w-full glass-card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-emom shadow-[0_0_32px_rgba(255,107,181,0.5)]">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-base font-semibold text-foreground">
              Notifications
            </div>
            <div className="text-[13px] text-muted-foreground">Enabled</div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
        </button>

        {/* About & Support */}
        <button
          onClick={() => navigate("/profile/about")}
          className="w-full glass-card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-amrap shadow-[0_0_32px_rgba(168,85,247,0.5)]">
            <Info className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-base font-semibold text-foreground">
              About & Support
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
        </button>
      </div>

      {/* Account Section */}
      <div className="px-6 mt-8 mb-3">
        <h3 className="text-[15px] font-bold text-muted-foreground uppercase tracking-wide">
          Account
        </h3>
      </div>

      <div className="px-6 space-y-3">
        {/* Log Out */}
        <button
          onClick={() => setShowLogoutDialog(true)}
          className="w-full glass-card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-circuit shadow-[0_0_32px_rgba(74,222,128,0.5)]">
            <LogOut className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-base font-semibold text-foreground">Log Out</div>
          </div>
        </button>

        {/* Delete Account */}
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="w-full glass-card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-to-br from-red-400 to-red-500 shadow-[0_0_32px_rgba(248,113,113,0.5)]">
            <Trash2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-base font-semibold text-destructive">
              Delete Account
            </div>
          </div>
        </button>
      </div>

      {/* Logout Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="glass-card border-white/65 rounded-[32px] max-w-sm">
          <AlertDialogHeader>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center">
                <LogOut className="w-8 h-8 text-primary" />
              </div>
            </div>
            <AlertDialogTitle className="text-center text-2xl">
              Log Out?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-base">
              Are you sure you want to log out of your account?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3">
            <AlertDialogCancel className="flex-1 rounded-full">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="flex-1 rounded-full bg-gradient-primary"
            >
              Log Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="glass-card border-white/65 rounded-[32px] max-w-sm">
          <AlertDialogHeader>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-destructive/15 border-2 border-destructive/30 flex items-center justify-center">
                <Trash2 className="w-8 h-8 text-destructive" />
              </div>
            </div>
            <AlertDialogTitle className="text-center text-2xl">
              Delete Account?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-base">
              This action is permanent and cannot be undone. All your workouts,
              progress, and data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 py-4">
            <p className="text-sm text-muted-foreground mb-2 text-center">
              Type <span className="font-bold">DELETE</span> to confirm:
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="glass-pill text-center"
            />
          </div>
          <AlertDialogFooter className="flex-row gap-3">
            <AlertDialogCancel
              className="flex-1 rounded-full"
              onClick={() => setDeleteConfirmText("")}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "DELETE"}
              className="flex-1 rounded-full bg-gradient-to-r from-red-400 to-red-500 disabled:opacity-50 disabled:pointer-events-none"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Profile;
