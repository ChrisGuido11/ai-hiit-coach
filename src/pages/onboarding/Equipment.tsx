import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Dumbbell,
  User,
  Activity,
  Minus,
  Zap,
  Circle,
  Box,
  Link2,
  Square
} from "lucide-react";
import SuccessScreen from "@/components/SuccessScreen";

const equipment = [
  { id: "bodyweight", label: "Bodyweight Only", icon: User },
  { id: "dumbbells", label: "Dumbbells", icon: Dumbbell },
  { id: "kettlebell", label: "Kettlebell", icon: Dumbbell },
  { id: "resistance", label: "Resistance Bands", icon: Activity },
  { id: "pullup", label: "Pull-up Bar", icon: Minus },
  { id: "jumprope", label: "Jump Rope", icon: Zap },
  { id: "medicineball", label: "Medicine Ball", icon: Circle },
  { id: "barbell", label: "Barbell", icon: Dumbbell },
  { id: "bench", label: "Bench", icon: Box },
  { id: "trx", label: "TRX / Suspension Trainer", icon: Link2 },
  { id: "foamroller", label: "Foam Roller", icon: Circle },
  { id: "mat", label: "Exercise Mat", icon: Square },
];

const Equipment = () => {
  const navigate = useNavigate();
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      }
    });
  }, [navigate]);

  const toggleEquipment = (equipmentId: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(equipmentId)
        ? prev.filter((id) => id !== equipmentId)
        : [...prev, equipmentId]
    );
  };

  // Legacy field: Derive workout_duration to satisfy DB NOT NULL constraint
  // AI personalization should NOT rely on this value - duration is determined dynamically
  const deriveWorkoutDuration = (fitnessLevel: string): string => {
    const durationMap: Record<string, string> = {
      beginner: "20",      // 20 min - Balanced session
      intermediate: "20",  // 20 min - Balanced session
      advanced: "30",      // 30 min - Full workout
    };
    return durationMap[fitnessLevel] || "20"; // Default to 20 min if level unknown
  };

  const handleNext = async () => {
    if (selectedEquipment.length > 0) {
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

        // Derive workout_duration (legacy field) to satisfy DB constraint
        const resolvedWorkoutDuration = deriveWorkoutDuration(level);

        // Save to database using upsert
        const { error } = await supabase.from("user_preferences").upsert(
          {
            user_id: session.user.id,
            fitness_goal: goals,
            fitness_level: level,
            available_equipment: selectedEquipment,
            workout_duration: resolvedWorkoutDuration, // Legacy field - auto-filled
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
        paddingBottom: 'calc(3rem + var(--safe-area-bottom))'
      }}
    >
      <div className="mb-8">
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className="h-2 flex-1 rounded-full bg-gradient-primary transition-colors"
            />
          ))}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          Your Equipment
        </h1>
        <p className="text-muted-foreground mb-1">What equipment do you have access to?</p>
        <p className="text-muted-foreground text-sm italic">Select all that apply</p>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3 max-w-2xl mx-auto w-full mt-6 overflow-y-auto">
        {equipment.map((item) => {
          const Icon = item.icon;
          const isSelected = selectedEquipment.includes(item.id);

          return (
            <button
              key={item.id}
              onClick={() => toggleEquipment(item.id)}
              className={`p-4 rounded-3xl transition-all flex flex-col items-center justify-center gap-2 ${
                isSelected
                  ? "glass-card ring-2 ring-primary"
                  : "glass-card hover:shadow-elevated"
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isSelected ? "bg-gradient-primary" : "bg-white/60"}`}>
                <Icon className={`w-6 h-6 ${isSelected ? "text-white" : "text-muted-foreground"}`} />
              </div>
              <span className={`text-sm font-medium text-center ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <Button
        onClick={handleNext}
        disabled={selectedEquipment.length === 0 || loading}
        className="mt-6 mb-2 w-full max-w-2xl mx-auto shrink-0"
        size="lg"
      >
        {loading ? "Saving..." : "Get Started"}
        <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </div>
  );
};

export default Equipment;
