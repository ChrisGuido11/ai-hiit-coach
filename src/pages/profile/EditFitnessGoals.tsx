import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, Flame, TrendingUp, Heart, Zap, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const goals = [
  { id: "weight-loss", label: "Weight Loss", icon: Flame },
  { id: "muscle-gain", label: "Muscle Gain", icon: TrendingUp },
  { id: "endurance", label: "Endurance", icon: Heart },
  { id: "general", label: "General Fitness", icon: Target },
  { id: "athletic", label: "Athletic Performance", icon: Zap },
];

const EditFitnessGoals = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCurrentGoals();
  }, []);

  const fetchCurrentGoals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data } = await supabase
        .from("user_preferences")
        .select("fitness_goal")
        .eq("user_id", user.id)
        .single();

      if (data && data.fitness_goal) {
        setSelectedGoals(data.fitness_goal);
      }
    } catch (error) {
      console.error("Error fetching fitness goals:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGoal = (goalId: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goalId)
        ? prev.filter((id) => id !== goalId)
        : [...prev, goalId]
    );
  };

  const handleSave = async () => {
    if (selectedGoals.length === 0) return;

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_preferences")
        .update({ fitness_goal: selectedGoals })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Fitness goals updated successfully",
      });
      navigate("/profile");
    } catch (error) {
      console.error("Error updating fitness goals:", error);
      toast({
        title: "Error",
        description: "Failed to update fitness goals",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-warm flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm flex flex-col p-6">
      {/* Header */}
      <div
        className="flex items-center justify-between mb-8"
        style={{
          paddingTop: "calc(0.5rem + var(--safe-area-top))",
        }}
      >
        <button
          onClick={() => navigate("/profile")}
          className="p-2 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">Fitness Goals</h1>
        <div className="w-10"></div>
      </div>

      <div className="mb-6">
        <p className="text-muted-foreground text-center">
          Select your fitness goals (multiple)
        </p>
      </div>

      {/* Goals Options */}
      <div className="flex-1 flex flex-col gap-3 max-w-2xl mx-auto w-full">
        {goals.map((goal) => {
          const Icon = goal.icon;
          const isSelected = selectedGoals.includes(goal.id);

          return (
            <button
              key={goal.id}
              onClick={() => toggleGoal(goal.id)}
              className={`p-5 rounded-2xl transition-all text-left flex items-center gap-4 ${
                isSelected
                  ? "glass-card ring-2 ring-primary glow-primary"
                  : "glass-card"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isSelected ? "bg-gradient-primary" : "bg-white/60"
                }`}
              >
                <Icon
                  className={`w-6 h-6 ${
                    isSelected ? "text-white" : "text-muted-foreground"
                  }`}
                />
              </div>
              <div className="flex-1">
                <span
                  className={`text-base font-semibold ${
                    isSelected ? "text-foreground" : "text-card-foreground"
                  }`}
                >
                  {goal.label}
                </span>
              </div>
              {isSelected && (
                <div className="w-6 h-6 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={selectedGoals.length === 0 || saving}
        className="mt-8 w-full max-w-2xl mx-auto"
        size="lg"
      >
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
};

export default EditFitnessGoals;
