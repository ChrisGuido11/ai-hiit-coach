import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Notifications = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Notification settings state
  const [enabled, setEnabled] = useState(true);
  const [dailyReminder, setDailyReminder] = useState(true);
  const [reminderTime, setReminderTime] = useState("08:00");
  const [streakReminders, setStreakReminders] = useState(true);
  const [achievements, setAchievements] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);

      // TODO: Save to Supabase once notification fields are added
      // const settings = {
      //   enabled,
      //   dailyReminder,
      //   reminderTime,
      //   streakReminders,
      //   achievements,
      //   weeklySummary
      // };

      toast({
        title: "Success",
        description: "Notification settings updated successfully",
      });
      navigate("/profile");
    } catch (error) {
      console.error("Error updating notification settings:", error);
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
        <h1 className="text-xl font-semibold text-foreground">Notifications</h1>
        <div className="w-10"></div>
      </div>

      {/* Master Toggle */}
      <div className="mb-6">
        <div className="glass-card p-4 flex items-center justify-between">
          <div className="flex-1">
            <div className="text-base font-semibold text-foreground">
              Enable Notifications
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      {/* Notification Types */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-foreground mb-3">
          Notification Types
        </h2>
        <div className="glass-card divide-y divide-border">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1">
                <div className="text-base font-semibold text-foreground mb-1">
                  Daily Workout Reminder
                </div>
              </div>
              <div className="flex items-center gap-2">
                {dailyReminder && (
                  <div className="w-6 h-6 rounded-full bg-gradient-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
                <Switch
                  checked={dailyReminder}
                  onCheckedChange={setDailyReminder}
                  disabled={!enabled}
                />
              </div>
            </div>
            {dailyReminder && enabled && (
              <div className="mt-3">
                <Input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="glass-pill"
                />
              </div>
            )}
          </div>

          <div className="p-4 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground mb-1">
                Streak Reminders
              </div>
              <div className="text-sm text-muted-foreground">
                Don't break your streak!
              </div>
            </div>
            <div className="flex items-center gap-2">
              {streakReminders && (
                <div className="w-6 h-6 rounded-full bg-gradient-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              <Switch
                checked={streakReminders}
                onCheckedChange={setStreakReminders}
                disabled={!enabled}
              />
            </div>
          </div>

          <div className="p-4 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground mb-1">
                Achievement Notifications
              </div>
              <div className="text-sm text-muted-foreground">
                New milestones reached
              </div>
            </div>
            <div className="flex items-center gap-2">
              {achievements && (
                <div className="w-6 h-6 rounded-full bg-gradient-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              <Switch
                checked={achievements}
                onCheckedChange={setAchievements}
                disabled={!enabled}
              />
            </div>
          </div>

          <div className="p-4 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground mb-1">
                Weekly Summary
              </div>
              <div className="text-sm text-muted-foreground">
                Every Monday at 9:00 AM
              </div>
            </div>
            <div className="flex items-center gap-2">
              {weeklySummary && (
                <div className="w-6 h-6 rounded-full bg-gradient-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              <Switch
                checked={weeklySummary}
                onCheckedChange={setWeeklySummary}
                disabled={!enabled}
              />
            </div>
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

export default Notifications;
