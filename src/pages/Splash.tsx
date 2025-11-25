import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dumbbell } from "lucide-react";

const Splash = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkAuthAndNavigate();
  }, []);

  const checkAuthAndNavigate = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Check if user has completed onboarding
        const { data: preferences } = await supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", session.user.id)
          .maybeSingle();

        setTimeout(() => {
          if (preferences) {
            navigate("/home");
          } else {
            navigate("/onboarding/goal");
          }
        }, 2500);
      } else {
        // No session, go to auth
        setTimeout(() => {
          navigate("/auth");
        }, 2500);
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      setTimeout(() => {
        navigate("/auth");
      }, 2500);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm flex flex-col items-center justify-center p-8">
      <div className="animate-fade-in text-center">
        <div className="flex justify-center mb-12">
          <div className="w-24 h-24 rounded-full bg-gradient-primary flex items-center justify-center glow-primary animate-breathe">
            <Dumbbell className="w-12 h-12 text-white" />
          </div>
        </div>
        <div>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-2">
            HIIT
          </h1>
          <h2 className="text-5xl md:text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent">
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
