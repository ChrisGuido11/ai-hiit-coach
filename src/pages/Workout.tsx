import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Workout = () => {
  const { framework } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col p-6 md:p-8">
      <Button
        variant="ghost"
        onClick={() => navigate("/home")}
        className="w-fit mb-8"
      >
        <ArrowLeft className="mr-2 w-4 h-4" />
        Back
      </Button>

      <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto text-center">
        <div className="p-8 rounded-3xl bg-card border-2 border-border">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            {framework?.toUpperCase()} Workout
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Workout generation coming soon
          </p>
          <div className="text-sm text-muted-foreground">
            We're working on AI-powered workout generation. <br />
            This feature will create personalized HIIT workouts based on your preferences.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Workout;
