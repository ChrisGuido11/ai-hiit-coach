import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AIBlob } from "@/components/AIBlob";

const Splash = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/onboarding/goal");
    }, 2500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="animate-fade-in">
        <AIBlob size="large" />
        <div className="mt-12 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-2">
            HIIT
          </h1>
          <h2 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Coach
          </h2>
          <p className="text-muted-foreground mt-4 text-sm md:text-base">
            AI-powered HIIT training for any level
          </p>
        </div>
      </div>
    </div>
  );
};

export default Splash;
