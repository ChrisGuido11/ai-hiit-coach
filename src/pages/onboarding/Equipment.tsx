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

  const handleNext = () => {
    if (selectedEquipment.length > 0) {
      sessionStorage.setItem("onboarding_equipment", JSON.stringify(selectedEquipment));
      navigate("/onboarding/duration");
    }
  };

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
              className={`h-2 flex-1 rounded-full transition-colors ${
                step <= 3 ? "bg-gradient-primary" : "bg-white/50"
              }`}
            />
          ))}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          Your Equipment
        </h1>
        <p className="text-muted-foreground mb-1">What equipment do you have access to?</p>
        <p className="text-muted-foreground text-sm italic">Select all that apply</p>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3 max-w-2xl mx-auto w-full mt-6">
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
        disabled={selectedEquipment.length === 0}
        className="mt-8 w-full max-w-2xl mx-auto"
        size="lg"
      >
        Continue
        <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </div>
  );
};

export default Equipment;
