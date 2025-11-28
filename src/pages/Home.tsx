import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Zap, Clock, Repeat, TrendingUp, Dumbbell, Sparkles, Send } from "lucide-react";
import { useTypingAnimation } from "@/hooks/useTypingAnimation";
import { parseWorkoutRequest, formatParsedRequest } from "@/lib/parseWorkoutRequest";
import BottomNav from "@/components/BottomNav";

const frameworks = [
  {
    id: "tabata",
    name: "Tabata",
    description: "20s work, 10s rest",
    icon: Zap,
  },
  {
    id: "emom",
    name: "EMOM",
    description: "Every minute on minute",
    icon: Clock,
  },
  {
    id: "amrap",
    name: "AMRAP",
    description: "As many rounds as possible",
    icon: Repeat,
  },
  {
    id: "ladder",
    name: "Ladder",
    description: "Progressive reps",
    icon: TrendingUp,
  },
];

const Home = () => {
  const navigate = useNavigate();
  const [goal, setGoal] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const animatedPlaceholder = useTypingAnimation(!isFocused && goal === "");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };


  const handleFrameworkClick = (frameworkId: string) => {
    // All frameworks go to AI generation
    navigate('/workout/generate', { state: { framework: frameworkId } });
  };

  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (goal.trim()) {
      // Parse the user's natural language request into structured parameters
      const parsed = parseWorkoutRequest(goal);
      console.log(`Parsed: ${formatParsedRequest(parsed)}`);

      // Navigate to generation with structured parameters
      navigate('/workout/generate', {
        state: {
          goal,
          parsedRequest: parsed,
          // If user explicitly mentioned a framework, use it
          framework: parsed.explicitFramework,
        },
      });
      setGoal('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm flex flex-col">
      {/* Header Area */}
      <div
        className="px-6 pt-4 flex items-center justify-between"
        style={{
          paddingTop: 'calc(1.5rem + var(--safe-area-top))'
        }}
      >
        {/* Future: Add close/back button if needed */}
        <div></div>
        {/* Future: Pro badge can go here */}
        <div></div>
      </div>

      {/* Hero Icon Circle */}
      <div
        className="flex justify-center mb-8"
        style={{
          paddingTop: '1rem'
        }}
      >
        <div className="relative w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center animate-hero-breathe">
          <Dumbbell className="w-10 h-10 text-white" />
        </div>
      </div>

      {/* Main Title */}
      <div className="px-6 mb-12">
        <h1 className="text-4xl font-semibold text-center text-foreground leading-tight max-w-xs mx-auto">
          AI-Powered HIIT Coach
        </h1>
      </div>

      {/* AI Input Bar */}
      <div className="px-6 mb-8">
        <form onSubmit={handleGoalSubmit} className="max-w-2xl mx-auto">
          <div className="relative glass-pill h-14 flex items-center px-5 gap-3">
            <div className="w-9 h-9 rounded-full bg-accent-amrap flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <input
              type="text"
              placeholder={animatedPlaceholder || "Tap to Ask..."}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              className="w-9 h-9 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </form>
      </div>

      {/* Workout Type Cards Section */}
      <div
        className="flex-1 px-6"
        style={{
          paddingBottom: 'calc(6rem + var(--safe-area-bottom))'
        }}
      >
        <div className="max-w-2xl mx-auto">
          <h2 className="text-[22px] font-semibold text-foreground mb-4">
            Quick Start Workouts
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {frameworks.map((framework, index) => {
              const Icon = framework.icon;
              const gradientClasses = [
                "bg-gradient-tabata",
                "bg-gradient-emom",
                "bg-gradient-amrap",
                "bg-gradient-to-br from-green-400 to-green-500"
              ];
              const glowClasses = [
                "shadow-[0_0_32px_rgba(54,209,220,0.5)]",
                "shadow-[0_0_32px_rgba(255,107,181,0.5)]",
                "shadow-[0_0_32px_rgba(168,85,247,0.5)]",
                "shadow-[0_0_32px_rgba(74,222,128,0.5)]"
              ];

              return (
                <button
                  key={framework.id}
                  onClick={() => handleFrameworkClick(framework.id)}
                  className="p-5 rounded-3xl glass-card hover:shadow-elevated transition-all active:scale-97 active:opacity-90"
                >
                  <div className="flex flex-col items-start">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${gradientClasses[index]} ${glowClasses[index]} mb-4`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="font-semibold text-lg text-foreground mb-1 text-left">
                      {framework.name}
                    </h3>
                    <p className="text-xs text-muted-foreground text-left">
                      {framework.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default Home;
