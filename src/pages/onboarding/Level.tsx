import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

  const handleNext = () => {
    if (selectedLevel) {
      navigate("/onboarding/equipment");
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
                step <= 2 ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          What's your fitness level?
        </h1>
        <p className="text-muted-foreground">This helps us personalize your workouts</p>
      </div>

      <div className="flex-1 flex flex-col gap-3 max-w-2xl mx-auto w-full">
        {levels.map((level) => {
          const isSelected = selectedLevel === level.id;
          
          return (
            <button
              key={level.id}
              onClick={() => setSelectedLevel(level.id)}
              className={`p-6 rounded-2xl border-2 transition-all text-left ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(0,217,192,0.3)]"
                  : "border-border bg-card hover:border-primary/50"
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
        className="mt-8 w-full max-w-2xl mx-auto h-14 text-lg font-semibold rounded-2xl"
        size="lg"
      >
        Continue
        <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </div>
  );
};

export default Level;
