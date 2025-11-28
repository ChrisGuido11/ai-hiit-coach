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
    <div
      className="min-h-screen bg-gradient-warm flex flex-col px-6 md:px-8"
      style={{
        paddingTop: 'calc(1.5rem + var(--safe-area-top))',
        paddingBottom: 'calc(2rem + var(--safe-area-bottom))'
      }}
    >
      <div className="mb-6">
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`h-2 flex-1 rounded-full transition-colors ${
                step === 1 ? "bg-gradient-primary" : "bg-white/50"
              }`}
            />
          ))}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          What's your main goal?
        </h1>
        <p className="text-muted-foreground">Select one or more goals</p>
      </div>

      <div className="flex-1 flex flex-col gap-2 max-w-2xl mx-auto w-full">
        {goals.map((goal) => {
          const Icon = goal.icon;
          const isSelected = selectedGoals.includes(goal.id);

          return (
            <button
              key={goal.id}
              onClick={() => toggleGoal(goal.id)}
              className={`p-4 rounded-3xl transition-all text-left flex items-center gap-4 ${
                isSelected
                  ? "glass-card ring-2 ring-primary glow-primary"
                  : "glass-card hover:shadow-elevated"
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isSelected ? "bg-gradient-primary" : "bg-white/60"}`}>
                <Icon className={`w-6 h-6 ${isSelected ? "text-white" : "text-muted-foreground"}`} />
              </div>
              <span className={`text-lg font-semibold ${isSelected ? "text-foreground" : "text-card-foreground"}`}>
                {goal.label}
              </span>
            </button>
          );
        })}
      </div>

      <Button
        onClick={handleNext}
        disabled={selectedGoals.length === 0}
        className="mt-auto pt-4 w-full max-w-2xl mx-auto shrink-0"
        size="lg"
      >
        Continue
        <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </div>
  );
};

export default Goal;
