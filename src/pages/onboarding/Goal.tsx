import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, Flame, TrendingUp, Heart, Zap } from "lucide-react";

const goals = [
  { id: "weight-loss", label: "Weight Loss", icon: Flame },
  { id: "muscle-gain", label: "Muscle Gain", icon: TrendingUp },
  { id: "endurance", label: "Endurance", icon: Heart },
  { id: "general", label: "General Fitness", icon: Target },
  { id: "athletic", label: "Athletic Performance", icon: Zap },
];

const Goal = () => {
  const navigate = useNavigate();
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  useEffect(() => {
    // Check if user is authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      }
    });
  }, [navigate]);

  const toggleGoal = (goalId: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goalId)
        ? prev.filter((id) => id !== goalId)
        : [...prev, goalId]
    );
  };

  const handleNext = () => {
    if (selectedGoals.length > 0) {
      // Store in sessionStorage to pass to next screens
      sessionStorage.setItem("onboarding_goals", JSON.stringify(selectedGoals));
      navigate("/onboarding/level");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col p-6 md:p-8">
      <div className="mb-8">
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`h-1 flex-1 rounded-full transition-colors ${
                step === 1 ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          What's your main goal?
        </h1>
        <p className="text-muted-foreground">Select one or more goals</p>
      </div>

      <div className="flex-1 flex flex-col gap-3 max-w-2xl mx-auto w-full">
        {goals.map((goal) => {
          const Icon = goal.icon;
          const isSelected = selectedGoals.includes(goal.id);
          
          return (
            <button
              key={goal.id}
              onClick={() => toggleGoal(goal.id)}
              className={`p-6 rounded-2xl border-2 transition-all text-left flex items-center gap-4 ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(0,217,192,0.3)]"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <div className={`p-3 rounded-xl ${isSelected ? "bg-primary/20" : "bg-muted"}`}>
                <Icon className={`w-6 h-6 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <span className={`text-lg font-medium ${isSelected ? "text-foreground" : "text-card-foreground"}`}>
                {goal.label}
              </span>
            </button>
          );
        })}
      </div>

      <Button
        onClick={handleNext}
        disabled={selectedGoals.length === 0}
        className="mt-8 w-full max-w-2xl mx-auto h-14 text-lg font-semibold rounded-2xl"
        size="lg"
      >
        Continue
        <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </div>
  );
};

export default Goal;
