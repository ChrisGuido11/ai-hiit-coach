import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock } from "lucide-react";
import SuccessScreen from "@/components/SuccessScreen";

const durations = [
  { id: "15", label: "15 minutes", description: "Quick workout" },
  { id: "20", label: "20 minutes", description: "Balanced session" },
  { id: "30", label: "30 minutes", description: "Full workout" },
  { id: "45", label: "45 minutes", description: "Extended training" },
];

const Duration = () => {
  const navigate = useNavigate();
  const [selectedDuration, setSelectedDuration] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      }
    });
  }, [navigate]);

  const handleNext = async () => {
    if (selectedDuration) {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/auth");
          return;
        }

        // Get all onboarding data from sessionStorage
        const goals = JSON.parse(sessionStorage.getItem("onboarding_goals") || "[]");
        const level = sessionStorage.getItem("onboarding_level") || "";
        const equipment = JSON.parse(sessionStorage.getItem("onboarding_equipment") || "[]");

        // Save to database using upsert
        const { error } = await supabase.from("user_preferences").upsert(
          {
            user_id: session.user.id,
            fitness_goal: goals,
            fitness_level: level,
            available_equipment: equipment,
            workout_duration: selectedDuration,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

        if (error) throw error;

        // Clear sessionStorage
        sessionStorage.removeItem("onboarding_goals");
        sessionStorage.removeItem("onboarding_level");
        sessionStorage.removeItem("onboarding_equipment");

        // Show success screen
        setShowSuccess(true);
      } catch (error: any) {
        console.error("Error saving preferences:", error);
      } finally {
        setLoading(false);
      }
    }
  };


  if (showSuccess) {
    return <SuccessScreen onComplete={() => navigate("/home")} />;
  }

  return (
    <div
      className="min-h-screen bg-gradient-warm flex flex-col px-6 md:px-8"
      style={{
        paddingTop: 'calc(1.5rem + var(--safe-area-top))',
        paddingBottom: 'calc(1.5rem + var(--safe-area-bottom))'
      }}
    >
      <div className="mb-8">
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className="h-2 flex-1 rounded-full bg-gradient-primary transition-colors"
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
              className={`p-6 rounded-3xl transition-all text-left flex items-center gap-4 ${
                isSelected
                  ? "glass-card ring-2 ring-primary glow-primary"
                  : "glass-card hover:shadow-elevated"
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isSelected ? "bg-gradient-primary" : "bg-white/60"}`}>
                <Clock className={`w-6 h-6 ${isSelected ? "text-white" : "text-muted-foreground"}`} />
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
        disabled={!selectedDuration || loading}
        className="mt-8 w-full max-w-2xl mx-auto"
        size="lg"
      >
        {loading ? "Saving..." : "Get Started"}
        <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </div>
  );
};

export default Duration;
