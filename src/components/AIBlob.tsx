import { cn } from "@/lib/utils";

interface AIBlobProps {
  size?: "small" | "medium" | "large";
  className?: string;
}

export const AIBlob = ({ size = "large", className }: AIBlobProps) => {
  const sizeClasses = {
    small: "w-24 h-24",
    medium: "w-48 h-48",
    large: "w-64 h-64 md:w-80 md:h-80",
  };

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {/* Outer glow rings */}
      <div className="absolute inset-0 animate-pulse">
        <div
          className="absolute inset-0 rounded-full bg-primary/20 blur-3xl"
          style={{
            animation: "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
        <div
          className="absolute inset-4 rounded-full bg-primary/30 blur-2xl"
          style={{
            animation: "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite 0.5s",
          }}
        />
      </div>
      
      {/* Main blob */}
      <div
        className={cn(
          "relative rounded-full bg-gradient-to-br from-primary via-primary to-accent",
          sizeClasses[size],
          "shadow-[0_0_60px_rgba(0,217,192,0.6)]"
        )}
        style={{
          animation: "breathe 4s ease-in-out infinite",
        }}
      >
        {/* Inner glow */}
        <div className="absolute inset-8 rounded-full bg-primary/40 blur-xl" />
      </div>

      <style>{`
        @keyframes breathe {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 60px rgba(0, 217, 192, 0.6);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 80px rgba(0, 217, 192, 0.8);
          }
        }
      `}</style>
    </div>
  );
};
