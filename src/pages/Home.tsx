import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AIBlob } from "@/components/AIBlob";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Zap, Clock, Repeat, Activity, Bookmark, User } from "lucide-react";
import { useTypingAnimation } from "@/hooks/useTypingAnimation";

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
    id: "circuit",
    name: "Circuit",
    description: "Multiple exercises in sequence",
    icon: Activity,
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
    navigate('/workout/generate', { state: { framework: frameworkId } });
  };

  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (goal.trim()) {
      navigate('/workout/generate', { state: { goal } });
      setGoal('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm flex flex-col">
      {/* AI Blob */}
      <div
        className="flex justify-center pt-6"
        style={{
          paddingTop: 'calc(1.5rem + var(--safe-area-top))'
        }}
      >
        <AIBlob size="medium" />
      </div>

      {/* Header - Below AI Blob */}
      <div className="pt-6 text-center">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          <span className="text-foreground">HIIT </span>
          <span className="bg-gradient-primary bg-clip-text text-transparent">
            Coach
          </span>
        </h1>
        <p className="text-base text-muted-foreground">AI-powered HIIT training for any level</p>
      </div>

      {/* Custom Goal Input */}
      <div className="px-6 mt-8 mb-6">
        <form onSubmit={handleGoalSubmit} className="max-w-2xl mx-auto">
          <div className="relative">
            <Input
              type="text"
              placeholder={animatedPlaceholder}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="h-14 pr-14"
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-2 top-2 h-10 w-10"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </form>
      </div>

      {/* Framework Cards */}
      <div
        className="flex-1 px-6"
        style={{
          paddingBottom: 'calc(6rem + var(--safe-area-bottom))'
        }}
      >
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Or try one of these:
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {frameworks.map((framework, index) => {
              const Icon = framework.icon;
              const gradientClasses = [
                "bg-gradient-tabata",
                "bg-gradient-emom",
                "bg-gradient-amrap",
                "bg-gradient-circuit"
              ];

              return (
                <button
                  key={framework.id}
                  onClick={() => handleFrameworkClick(framework.id)}
                  className="p-6 rounded-3xl glass-card hover:shadow-elevated transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${gradientClasses[index]} group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-foreground mb-1">
                        {framework.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {framework.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div
        className="fixed bottom-0 left-0 right-0 glass-nav mx-auto max-w-md rounded-full mb-4"
        style={{
          marginBottom: 'calc(1rem + var(--safe-area-bottom))',
          marginLeft: 'auto',
          marginRight: 'auto',
          left: '1rem',
          right: '1rem',
          width: 'calc(100% - 2rem)',
          maxWidth: '400px'
        }}
      >
        <div className="flex items-center justify-around h-16 px-6">
          <button className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-primary">
            <Activity className="w-5 h-5 text-white" />
          </button>
          <button className="flex items-center justify-center p-3">
            <Bookmark className="w-5 h-5 text-white/55" />
          </button>
          <button className="flex items-center justify-center p-3">
            <User className="w-5 h-5 text-white/55" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
