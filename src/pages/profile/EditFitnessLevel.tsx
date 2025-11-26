import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

const EditFitnessLevel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCurrentLevel();
  }, []);

  const fetchCurrentLevel = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data } = await supabase
        .from("user_preferences")
        .select("fitness_level")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setSelectedLevel(data.fitness_level);
      }
    } catch (error) {
      console.error("Error fetching fitness level:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedLevel) return;

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_preferences")
        .update({ fitness_level: selectedLevel })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Fitness level updated successfully",
      });
      navigate("/profile");
    } catch (error) {
      console.error("Error updating fitness level:", error);
      toast({
        title: "Error",
        description: "Failed to update fitness level",
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
        <h1 className="text-xl font-semibold text-foreground">Fitness Level</h1>
        <div className="w-10"></div>
      </div>

      <div className="mb-6">
        <p className="text-muted-foreground text-center">
          Select your current fitness level
        </p>
      </div>

      {/* Level Options */}
      <div className="flex-1 flex flex-col gap-3 max-w-2xl mx-auto w-full">
        {levels.map((level) => {
          const isSelected = selectedLevel === level.id;

          return (
            <button
              key={level.id}
              onClick={() => setSelectedLevel(level.id)}
              className={`p-5 rounded-2xl transition-all text-left relative ${
                isSelected
                  ? "glass-card ring-2 ring-primary glow-primary"
                  : "glass-card"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="font-semibold text-base mb-1 text-foreground">
                    {level.label}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {level.description}
                  </div>
                </div>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={!selectedLevel || saving}
        className="mt-8 w-full max-w-2xl mx-auto"
        size="lg"
      >
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
};

export default EditFitnessLevel;
