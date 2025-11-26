-- Add missing columns to workouts table
ALTER TABLE public.workouts 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_saved BOOLEAN DEFAULT false;

-- Create index for faster queries on is_saved
CREATE INDEX IF NOT EXISTS idx_workouts_is_saved ON public.workouts(user_id, is_saved) WHERE is_saved = true;