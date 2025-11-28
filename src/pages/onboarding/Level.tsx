import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const levels = [
  {
    id: "beginner",
    label: "Beginner",
    description: "New to HIIT or regular exercise",
  },
  {
    id: "intermediate",
    label: "Intermediate",
    description: "Some experience with HIIT workouts",
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "Regular HIIT training, high intensity",
  },
];

const Level = () => {
  const navigate = useNavigate();
  const [selectedLevel, setSelectedLevel] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      }
    });
  }, [navigate]);

  const handleNext = () => {
    if (selectedLevel) {
      sessionStorage.setItem("onboarding_level", selectedLevel);
      navigate("/onboarding/equipment");
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-warm flex flex-col px-6 md:px-8"
      style={{
        paddingTop: 'calc(2rem + var(--safe-area-top))',
        paddingBottom: 'calc(2rem + var(--safe-area-bottom))'
      }}
    >
      <div className="mb-8">
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`h-2 flex-1 rounded-full transition-colors ${
                step <= 2 ? "bg-gradient-primary" : "bg-white/50"
              }`}
            />
          ))}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          What's your fitness level?
        </h1>
        <p className="text-muted-foreground">This helps us personalize your workouts</p>
      </div>

      <div className="flex-1 flex flex-col gap-4 max-w-2xl mx-auto w-full">
        {levels.map((level) => {
          const isSelected = selectedLevel === level.id;

          return (
            <button
              key={level.id}
              onClick={() => setSelectedLevel(level.id)}
              className={`p-4 rounded-3xl transition-all text-left ${
                isSelected
                  ? "glass-card ring-2 ring-primary glow-primary"
                  : "glass-card hover:shadow-elevated"
              }`}
            >
              <div className="font-semibold text-lg mb-1 text-foreground">
                {level.label}
              </div>
              <div className="text-sm text-muted-foreground">
                {level.description}
              </div>
            </button>
          );
        })}
      </div>

      <Button
        onClick={handleNext}
        disabled={!selectedLevel}
        className="mt-8 w-full max-w-2xl mx-auto shrink-0"
        size="lg"
      >
        Continue
        <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </div>
  );
};

export default Level;
