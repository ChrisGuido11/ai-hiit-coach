import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";

interface SuccessScreenProps {
  onComplete: () => void;
}

const SuccessScreen = ({ onComplete }: SuccessScreenProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-warm flex items-center justify-center animate-fade-in">
      <div className="flex flex-col items-center gap-4 px-6">
        {/* Animated Checkmark Circle */}
        <div className="relative animate-scale-in">
          <div className="absolute inset-0 bg-[#FEAD63]/20 rounded-full blur-xl animate-pulse" />
          <div className="relative bg-gradient-primary rounded-full p-6 glow-primary">
            <CheckCircle2 className="w-16 h-16 text-white animate-[draw-check_0.5s_ease-out]" />
          </div>
        </div>

        {/* Success Text */}
        <div className="text-center space-y-2 animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <h2 className="text-3xl font-bold text-foreground">
            You're all set!
          </h2>
          <p className="text-muted-foreground text-lg">
            Let's start your fitness journey
          </p>
        </div>
      </div>
    </div>
  );
};

export default SuccessScreen;
