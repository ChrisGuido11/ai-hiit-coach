import { cn } from "@/lib/utils";

interface AIBlobProps {
  size?: "small" | "medium" | "large";
  className?: string;
  withParticles?: boolean;
}

export const AIBlob = ({ size = "large", className, withParticles = false }: AIBlobProps) => {
  const sizeClasses = {
    small: "w-24 h-24",
    medium: "w-40 h-40",
    large: "w-64 h-64 md:w-80 md:h-80",
  };
  
  const particles = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    size: Math.random() * 4 + 4,
    delay: Math.random() * 3,
    duration: Math.random() * 2 + 3,
    x: (Math.random() - 0.5) * 100,
    y: (Math.random() - 0.5) * 100,
    opacity: Math.random() * 0.4 + 0.3,
  }));

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {/* Floating Particles */}
      {withParticles && particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-primary"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            left: `calc(50% + ${particle.x}px)`,
            top: `calc(50% + ${particle.y}px)`,
            opacity: particle.opacity,
            animation: `float ${particle.duration}s ease-in-out infinite`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
      
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
          "relative rounded-full bg-gradient-to-br from-primary to-[hsl(174,100%,38%)]",
          sizeClasses[size]
        )}
        style={{
          animation: "breathe 3s ease-in-out infinite",
          boxShadow: "0 0 60px rgba(0, 217, 192, 0.4)",
        }}
      >
        {/* Inner glow */}
        <div className="absolute inset-8 rounded-full bg-primary/40 blur-xl" />
      </div>

      <style>{`
        @keyframes breathe {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
            opacity: 0;
          }
          10% {
            opacity: var(--particle-opacity, 0.5);
          }
          90% {
            opacity: var(--particle-opacity, 0.5);
          }
          100% {
            transform: translateY(-60px) translateX(calc(var(--float-x, 0) * 20px));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};
