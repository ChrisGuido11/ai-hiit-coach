import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AIBlob } from "@/components/AIBlob";

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
