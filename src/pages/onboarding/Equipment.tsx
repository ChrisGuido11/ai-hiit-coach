import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Dumbbell, Package, Home } from "lucide-react";

const equipment = [
  { id: "bodyweight", label: "Bodyweight Only", icon: Home },
  { id: "dumbbells", label: "Dumbbells", icon: Dumbbell },
  { id: "resistance", label: "Resistance Bands", icon: Package },
  { id: "gym", label: "Full Gym Access", icon: Dumbbell },
];

const Equipment = () => {
  const navigate = useNavigate();
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  const toggleEquipment = (equipmentId: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(equipmentId)
        ? prev.filter((id) => id !== equipmentId)
        : [...prev, equipmentId]
    );
  };

  const handleNext = () => {
    if (selectedEquipment.length > 0) {
      navigate("/onboarding/duration");
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
                step <= 3 ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          What equipment do you have?
        </h1>
        <p className="text-muted-foreground">Select all that apply</p>
      </div>

      <div className="flex-1 flex flex-col gap-3 max-w-2xl mx-auto w-full">
        {equipment.map((item) => {
          const Icon = item.icon;
          const isSelected = selectedEquipment.includes(item.id);
          
          return (
            <button
              key={item.id}
              onClick={() => toggleEquipment(item.id)}
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
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <Button
        onClick={handleNext}
        disabled={selectedEquipment.length === 0}
        className="mt-8 w-full max-w-2xl mx-auto h-14 text-lg font-semibold rounded-2xl"
        size="lg"
      >
        Continue
        <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </div>
  );
};

export default Equipment;
