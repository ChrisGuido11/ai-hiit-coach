-- Add fields to support saved workouts functionality

-- Add is_saved field to track if user explicitly saved a workout
ALTER TABLE public.workouts
ADD COLUMN IF NOT EXISTS is_saved BOOLEAN DEFAULT false;

-- Add order field for custom workout ordering
ALTER TABLE public.workouts
ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;

-- Add name field for custom workout names
ALTER TABLE public.workouts
ADD COLUMN IF NOT EXISTS name TEXT;

-- Create index on is_saved and user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_workouts_user_saved
ON public.workouts(user_id, is_saved, "order");

-- Add comment
COMMENT ON COLUMN public.workouts.is_saved IS 'Whether the user explicitly saved this workout';
COMMENT ON COLUMN public.workouts."order" IS 'Custom sort order for saved workouts';
COMMENT ON COLUMN public.workouts.name IS 'Optional custom name for the workout';
