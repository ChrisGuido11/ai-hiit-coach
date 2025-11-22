import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock } from "lucide-react";

const durations = [
  { id: "15", label: "15 minutes", description: "Quick workout" },
  { id: "20", label: "20 minutes", description: "Balanced session" },
  { id: "30", label: "30 minutes", description: "Full workout" },
  { id: "45", label: "45 minutes", description: "Extended training" },
];

const Duration = () => {
  const navigate = useNavigate();
  const [selectedDuration, setSelectedDuration] = useState<string>("");

  const handleNext = () => {
    if (selectedDuration) {
      navigate("/home");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col p-6 md:p-8">
      <div className="mb-8">
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className="h-1 flex-1 rounded-full bg-primary transition-colors"
            />
          ))}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          How much time per workout?
        </h1>
        <p className="text-muted-foreground">Choose your preferred duration</p>
      </div>

      <div className="flex-1 flex flex-col gap-3 max-w-2xl mx-auto w-full">
        {durations.map((duration) => {
          const isSelected = selectedDuration === duration.id;
          
          return (
            <button
              key={duration.id}
              onClick={() => setSelectedDuration(duration.id)}
              className={`p-6 rounded-2xl border-2 transition-all text-left flex items-center gap-4 ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(0,217,192,0.3)]"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <div className={`p-3 rounded-xl ${isSelected ? "bg-primary/20" : "bg-muted"}`}>
                <Clock className={`w-6 h-6 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-lg mb-1 text-foreground">
                  {duration.label}
                </div>
                <div className="text-sm text-muted-foreground">
                  {duration.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Button
        onClick={handleNext}
        disabled={!selectedDuration}
        className="mt-8 w-full max-w-2xl mx-auto h-14 text-lg font-semibold rounded-2xl"
        size="lg"
      >
        Get Started
        <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </div>
  );
};

export default Duration;
