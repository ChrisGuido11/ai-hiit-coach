import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Dumbbell,
  User,
  Activity,
  Minus,
  Zap,
  Circle,
  Box,
  Link2,
  Square,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

const EditEquipment = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCurrentEquipment();
  }, []);

  const fetchCurrentEquipment = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data } = await supabase
        .from("user_preferences")
        .select("available_equipment")
        .eq("user_id", user.id)
        .single();

      if (data && data.available_equipment) {
        setSelectedEquipment(data.available_equipment);
      }
    } catch (error) {
      console.error("Error fetching equipment:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEquipment = (equipmentId: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(equipmentId)
        ? prev.filter((id) => id !== equipmentId)
        : [...prev, equipmentId]
    );
  };

  const handleSave = async () => {
    if (selectedEquipment.length === 0) return;

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_preferences")
        .update({ available_equipment: selectedEquipment })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Equipment updated successfully",
      });
      navigate("/profile");
    } catch (error) {
      console.error("Error updating equipment:", error);
      toast({
        title: "Error",
        description: "Failed to update equipment",
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
        <h1 className="text-xl font-semibold text-foreground">Available Equipment</h1>
        <div className="w-10"></div>
      </div>

      <div className="mb-6">
        <p className="text-muted-foreground text-center">
          Select what equipment you have
        </p>
      </div>

      {/* Equipment Grid */}
      <div className="flex-1 grid grid-cols-2 gap-3 max-w-2xl mx-auto w-full">
        {equipment.map((item) => {
          const Icon = item.icon;
          const isSelected = selectedEquipment.includes(item.id);

          return (
            <button
              key={item.id}
              onClick={() => toggleEquipment(item.id)}
              className={`p-4 rounded-2xl transition-all flex flex-col items-center justify-center gap-2 ${
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
              <span
                className={`text-sm font-medium text-center ${
                  isSelected ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={selectedEquipment.length === 0 || saving}
        className="mt-8 w-full max-w-2xl mx-auto"
        size="lg"
      >
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
};

export default EditEquipment;
