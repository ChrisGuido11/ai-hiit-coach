import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AIBlob } from "@/components/AIBlob";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Zap, Clock, Repeat, Activity, Bookmark, User } from "lucide-react";

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

  const handleFrameworkClick = (frameworkId: string) => {
    navigate(`/workout/${frameworkId}`);
  };

  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (goal.trim()) {
      // TODO: Process custom goal
      console.log("Custom goal:", goal);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div 
        className="p-6 text-center"
        style={{ 
          paddingTop: 'calc(1.5rem + var(--safe-area-top))'
        }}
      >
        <h1 className="text-4xl md:text-5xl font-bold mb-1">
          <span className="text-foreground">HIIT </span>
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Coach
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">AI-powered HIIT training for any level</p>
      </div>

      {/* AI Blob */}
      <div className="flex justify-center my-8">
        <AIBlob size="medium" />
      </div>

      {/* Custom Goal Input */}
      <div className="px-6 mb-8">
        <form onSubmit={handleGoalSubmit} className="max-w-2xl mx-auto">
          <div className="relative">
            <Input
              type="text"
              placeholder="What's your fitness goal today?"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="h-14 pr-14 rounded-2xl bg-card border-border text-foreground placeholder:text-muted-foreground"
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-2 top-2 h-10 w-10 rounded-xl"
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
          <h2 className="text-xl font-semibold text-foreground mb-3">
            Or try one of these:
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Pick a plan and get moving
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {frameworks.map((framework) => {
              const Icon = framework.icon;
              
              return (
                <button
                  key={framework.id}
                  onClick={() => handleFrameworkClick(framework.id)}
                  className="p-6 rounded-2xl border-2 border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-6 h-6 text-primary" />
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
        className="fixed bottom-0 left-0 right-0 bg-card border-t border-border"
        style={{ 
          paddingBottom: 'var(--safe-area-bottom)',
          minHeight: 'calc(4rem + var(--safe-area-bottom))'
        }}
      >
        <div className="flex items-center justify-around h-16 max-w-2xl mx-auto">
          <button className="flex flex-col items-center gap-1 px-4 py-2">
            <Activity className="w-5 h-5 text-primary" />
            <span className="text-xs font-medium text-primary">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1 px-4 py-2">
            <Bookmark className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Saved</span>
          </button>
          <button className="flex flex-col items-center gap-1 px-4 py-2">
            <User className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
