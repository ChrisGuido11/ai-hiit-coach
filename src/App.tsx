import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Splash from "./pages/Splash";
import Auth from "./pages/Auth";
import Goal from "./pages/onboarding/Goal";
import Level from "./pages/onboarding/Level";
import Equipment from "./pages/onboarding/Equipment";
import Duration from "./pages/onboarding/Duration";
import Home from "./pages/Home";
import Workout from "./pages/Workout";
import WorkoutGeneration from "./pages/WorkoutGeneration";
import SavedWorkouts from "./pages/SavedWorkouts";
import TabataTimer from "./pages/timers/TabataTimer";
import EMOMTimer from "./pages/timers/EMOMTimer";
import AMRAPTimer from "./pages/timers/AMRAPTimer";
import LadderConfig from "./pages/timers/LadderConfig";
import LadderTimer from "./pages/timers/LadderTimer";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding/goal" element={<Goal />} />
          <Route path="/onboarding/level" element={<Level />} />
          <Route path="/onboarding/equipment" element={<Equipment />} />
          <Route path="/onboarding/duration" element={<Duration />} />
          <Route path="/home" element={<Home />} />
          <Route path="/workout/generate" element={<WorkoutGeneration />} />
          <Route path="/saved-workouts" element={<SavedWorkouts />} />
          <Route path="/workout/tabata/timer" element={<TabataTimer />} />
          <Route path="/workout/emom/timer" element={<EMOMTimer />} />
          <Route path="/workout/amrap/timer" element={<AMRAPTimer />} />
          <Route path="/workout/ladder/config" element={<LadderConfig />} />
          <Route path="/workout/ladder/timer" element={<LadderTimer />} />
          <Route path="/workout/:framework" element={<Workout />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
