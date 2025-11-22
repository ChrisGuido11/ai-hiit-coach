import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, RefreshCw, Check } from "lucide-react";

const frameworkDetails: Record<string, { fullName: string; description: string; benefits: string }> = {
  tabata: {
    fullName: "Tabata Protocol",
    description: "High-intensity interval training with 20 seconds of maximum effort followed by 10 seconds of rest, repeated for 8 rounds (4 minutes total per exercise).",
    benefits: "Burns calories rapidly, improves cardiovascular fitness, and boosts metabolism for hours after your workout."
  },
  emom: {
    fullName: "Every Minute On the Minute",
    description: "Complete a set number of reps at the start of each minute, then rest for the remainder. Repeat for the specified duration.",
    benefits: "Builds strength and endurance while teaching pace management and mental toughness under time pressure."
  },
  amrap: {
    fullName: "As Many Rounds As Possible",
    description: "Complete as many rounds of the exercise circuit as possible within the time limit, maintaining good form throughout.",
    benefits: "Maximizes workout density, improves work capacity, and provides measurable progress tracking session to session."
  },
  circuit: {
    fullName: "Circuit Training",
    description: "Move through a series of exercises with minimal rest between stations, completing multiple rounds of the full circuit.",
    benefits: "Provides full-body conditioning, keeps heart rate elevated, and efficiently combines strength and cardio training."
  }
};

const mockWorkout = {
  warmup: [
    { name: "Jumping Jacks", duration: "60 seconds", instructions: "Start with feet together, jump and spread legs while raising arms" },
    { name: "Arm Circles", duration: "30 seconds", instructions: "Extend arms and make circular motions" }
  ],
  main: [
    { name: "Bodyweight Squats", duration: "20s work / 10s rest", instructions: "Stand with feet shoulder-width apart, lower into squat" },
    { name: "Push-ups", duration: "20s work / 10s rest", instructions: "Start in plank position, lower chest to ground" },
    { name: "Mountain Climbers", duration: "20s work / 10s rest", instructions: "Drive knees to chest alternately in plank position" },
    { name: "Burpees", duration: "20s work / 10s rest", instructions: "Squat, jump back to plank, return and jump up" }
  ],
  cooldown: [
    { name: "Quad Stretch", duration: "30 seconds each leg", instructions: "Stand on one leg, pull heel to glutes" },
    { name: "Hamstring Stretch", duration: "30 seconds each leg", instructions: "Sit and reach towards toes" }
  ]
};

const Workout = () => {
  const { framework } = useParams();
  const navigate = useNavigate();
  const [isSaved, setIsSaved] = useState(false);

  const frameworkKey = framework?.toLowerCase() || "tabata";
  const details = frameworkDetails[frameworkKey] || frameworkDetails.tabata;

  const handlePlayTutorial = (exerciseName: string) => {
    console.log(`Watch tutorial for ${exerciseName}`);
  };

  const handleReplaceExercise = (exerciseName: string) => {
    console.log(`Replace ${exerciseName}`);
  };

  const handleBeginWorkout = () => {
    console.log("Begin workout - navigate to timer screen");
  };

  const handleSaveWorkout = () => {
    setIsSaved(true);
  };

  return (
    <div className="min-h-screen bg-[#0A1F2E] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/home")}
          className="text-foreground hover:bg-foreground/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground capitalize">
          {frameworkKey}
        </h1>
        <div className="w-10" />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-32 scrollbar-hide">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Framework Description Card */}
          <div 
            className="rounded-2xl p-5 border"
            style={{
              backgroundColor: 'rgba(0, 217, 192, 0.08)',
              borderColor: 'rgba(0, 217, 192, 0.2)'
            }}
          >
            <h2 className="text-xl font-bold text-primary mb-3">
              {details.fullName}
            </h2>
            <p className="text-[15px] text-muted-foreground mb-4 leading-relaxed">
              {details.description}
            </p>
            <div className="flex items-start gap-2">
              <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold text-primary">Benefits: </span>
                <span className="text-muted-foreground">{details.benefits}</span>
              </div>
            </div>
          </div>

          {/* Warm-up Section */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-bold text-foreground">Warm-up</h3>
              <div className="flex-1 h-0.5 bg-[#FF9500]" />
            </div>
            <div className="space-y-3">
              {mockWorkout.warmup.map((exercise, index) => (
                <div 
                  key={index}
                  className="rounded-xl p-4 border border-border/30"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: '#FF9500' }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-foreground mb-1">{exercise.name}</h4>
                      <p className="text-sm font-medium mb-2" style={{ color: '#FF9500' }}>
                        {exercise.duration}
                      </p>
                      <p className="text-sm text-muted-foreground">{exercise.instructions}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePlayTutorial(exercise.name)}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"
                    >
                      <Play className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Workout Section */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-bold text-foreground">Main Workout</h3>
              <div className="flex-1 h-0.5 bg-primary" />
            </div>
            <div className="space-y-3">
              {mockWorkout.main.map((exercise, index) => (
                <div 
                  key={index}
                  className="rounded-xl p-4 border border-border/30"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-foreground mb-1">{exercise.name}</h4>
                      <p className="text-sm text-primary font-medium mb-2">
                        {exercise.duration}
                      </p>
                      <p className="text-sm text-muted-foreground">{exercise.instructions}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePlayTutorial(exercise.name)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Play className="w-5 h-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleReplaceExercise(exercise.name)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cool-down Section */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-bold text-foreground">Cool-down</h3>
              <div className="flex-1 h-0.5 bg-[#8B5CF6]" />
            </div>
            <div className="space-y-3">
              {mockWorkout.cooldown.map((exercise, index) => (
                <div 
                  key={index}
                  className="rounded-xl p-4 border border-border/30"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: '#8B5CF6' }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-foreground mb-1">{exercise.name}</h4>
                      <p className="text-sm font-medium mb-2" style={{ color: '#8B5CF6' }}>
                        {exercise.duration}
                      </p>
                      <p className="text-sm text-muted-foreground">{exercise.instructions}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePlayTutorial(exercise.name)}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"
                    >
                      <Play className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Action Buttons */}
      <div 
        className="fixed bottom-0 left-0 right-0 p-6 space-y-3"
        style={{ 
          background: 'linear-gradient(to top, #0A1F2E 80%, transparent)',
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))'
        }}
      >
        <div className="max-w-2xl mx-auto space-y-3">
          <Button
            onClick={handleBeginWorkout}
            className="w-full h-14 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Begin Workout
          </Button>
          <Button
            onClick={handleSaveWorkout}
            variant="outline"
            className="w-full h-12 text-base font-medium border-border/50 transition-all duration-300"
            style={{
              backgroundColor: isSaved ? 'rgba(0, 217, 192, 0.1)' : 'rgba(255, 255, 255, 0.05)',
              borderColor: isSaved ? 'rgba(0, 217, 192, 0.3)' : 'rgba(255, 255, 255, 0.1)',
              color: isSaved ? '#00D9C0' : undefined
            }}
          >
            {isSaved ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Saved
              </>
            ) : (
              "Save Workout"
            )}
          </Button>
        </div>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default Workout;
