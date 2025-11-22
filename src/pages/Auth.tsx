import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AIBlob } from "@/components/AIBlob";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        checkUserPreferences(session.user.id);
      }
    });
  }, []);

  const checkUserPreferences = async (userId: string) => {
    const { data } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      navigate("/home");
    } else {
      navigate("/onboarding/goal");
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          await checkUserPreferences(data.user.id);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        if (data.user) {
          toast({
            title: "Account created!",
            description: "Please complete your profile setup.",
          });
          navigate("/onboarding/goal");
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-background flex flex-col items-center justify-center p-6"
      style={{ 
        paddingTop: 'calc(1.5rem + var(--safe-area-top))',
        paddingBottom: 'calc(1.5rem + var(--safe-area-bottom))'
      }}
    >
      <div className="w-full max-w-md">
        {/* Logo and AI Blob */}
        <div className="text-center mb-8">
          <AIBlob size="small" className="mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-2">
            <span className="text-foreground">HIIT </span>
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Coach
            </span>
          </h1>
          <p className="text-muted-foreground">
            Your AI-powered fitness companion
          </p>
        </div>

        {/* Auth Form */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-xl font-medium transition-all ${
                isLogin
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-xl font-medium transition-all ${
                !isLogin
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-background"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-base font-semibold rounded-xl"
            >
              {loading ? "Loading..." : isLogin ? "Login" : "Sign Up"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
