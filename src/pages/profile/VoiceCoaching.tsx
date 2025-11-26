import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const VoiceCoaching = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Voice coaching settings state
  const [enabled, setEnabled] = useState(true);
  const [countdownCues, setCountdownCues] = useState(true);
  const [timeCallouts, setTimeCallouts] = useState(true);
  const [roundAnnouncements, setRoundAnnouncements] = useState(true);
  const [motivation, setMotivation] = useState(false);
  const [formReminders, setFormReminders] = useState(false);
  const [voiceType, setVoiceType] = useState<"female" | "male">("male");

  const handleSave = async () => {
    try {
      setSaving(true);

      // TODO: Save to Supabase once voice_coaching fields are added
      // const settings = {
      //   enabled,
      //   countdownCues,
      //   timeCallouts,
      //   roundAnnouncements,
      //   motivation,
      //   formReminders,
      //   voiceType
      // };

      toast({
        title: "Success",
        description: "Voice coaching settings updated successfully",
      });
      navigate("/profile");
    } catch (error) {
      console.error("Error updating voice coaching settings:", error);
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm flex flex-col p-6 pb-32">
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
        <h1 className="text-xl font-semibold text-foreground">Voice Coaching</h1>
        <div className="w-10"></div>
      </div>

      {/* Master Toggle */}
      <div className="mb-6">
        <div className="glass-card p-4 flex items-center justify-between">
          <div className="flex-1">
            <div className="text-base font-semibold text-foreground">
              Enable Voice Coaching
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      {/* Coaching Options */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-foreground mb-3">Coaching Options</h2>
        <div className="glass-card divide-y divide-border">
          <div className="p-4 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground mb-1">
                Countdown Cues
              </div>
              <div className="text-sm text-muted-foreground">
                "3, 2, 1, Go!"
              </div>
            </div>
            <div className="flex items-center gap-2">
              {countdownCues && (
                <div className="w-6 h-6 rounded-full bg-gradient-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              <Switch
                checked={countdownCues}
                onCheckedChange={setCountdownCues}
                disabled={!enabled}
              />
            </div>
          </div>

          <div className="p-4 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground mb-1">
                Time Callouts
              </div>
              <div className="text-sm text-muted-foreground">
                "One minute remaining"
              </div>
            </div>
            <div className="flex items-center gap-2">
              {timeCallouts && (
                <div className="w-6 h-6 rounded-full bg-gradient-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              <Switch
                checked={timeCallouts}
                onCheckedChange={setTimeCallouts}
                disabled={!enabled}
              />
            </div>
          </div>

          <div className="p-4 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground mb-1">
                Round Announcements
              </div>
              <div className="text-sm text-muted-foreground">
                "Round 2 complete"
              </div>
            </div>
            <div className="flex items-center gap-2">
              {roundAnnouncements && (
                <div className="w-6 h-6 rounded-full bg-gradient-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              <Switch
                checked={roundAnnouncements}
                onCheckedChange={setRoundAnnouncements}
                disabled={!enabled}
              />
            </div>
          </div>

          <div className="p-4 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground mb-1">
                Motivation
              </div>
              <div className="text-sm text-muted-foreground">
                "Keep pushing!"
              </div>
            </div>
            <div className="flex items-center gap-2">
              {motivation && (
                <div className="w-6 h-6 rounded-full bg-gradient-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              <Switch
                checked={motivation}
                onCheckedChange={setMotivation}
                disabled={!enabled}
              />
            </div>
          </div>

          <div className="p-4 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground mb-1">
                Form Reminders
              </div>
              <div className="text-sm text-muted-foreground">
                "Focus on form"
              </div>
            </div>
            <div className="flex items-center gap-2">
              {formReminders && (
                <div className="w-6 h-6 rounded-full bg-gradient-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              <Switch
                checked={formReminders}
                onCheckedChange={setFormReminders}
                disabled={!enabled}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Voice Type */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-foreground mb-3">Voice</h2>
        <div className="glass-card p-5">
          <div className="text-base text-foreground mb-4">Voice Type</div>
          <div className="flex gap-3">
            <button
              onClick={() => setVoiceType("female")}
              disabled={!enabled}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                voiceType === "female"
                  ? "bg-gradient-primary text-white"
                  : "bg-white/60 text-foreground"
              } ${!enabled && "opacity-50"}`}
            >
              Female
            </button>
            <button
              onClick={() => setVoiceType("male")}
              disabled={!enabled}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                voiceType === "male"
                  ? "bg-gradient-primary text-white"
                  : "bg-white/60 text-foreground"
              } ${!enabled && "opacity-50"}`}
            >
              Male
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-warm">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full max-w-2xl mx-auto"
          size="lg"
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};

export default VoiceCoaching;
