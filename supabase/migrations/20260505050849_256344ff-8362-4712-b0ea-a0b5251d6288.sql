
-- 1. live_classes: timing columns
ALTER TABLE public.live_classes
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

-- 2. attendance: link to live class
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS class_id uuid;

CREATE INDEX IF NOT EXISTS idx_attendance_class_id ON public.attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance(student_id);

-- Allow teachers to view attendance for their own classes
DROP POLICY IF EXISTS "Teachers view attendance for own classes" ON public.attendance;
CREATE POLICY "Teachers view attendance for own classes"
ON public.attendance FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.live_classes lc
    WHERE lc.id = attendance.class_id AND lc.teacher_id = auth.uid()
  )
);

-- 3. live_chat_messages: threading + doubt support
ALTER TABLE public.live_chat_messages
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.live_chat_messages(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS is_resolved boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_chat_class_id ON public.live_chat_messages(class_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_parent_id ON public.live_chat_messages(parent_id);

-- Allow teachers to mark doubts as resolved
DROP POLICY IF EXISTS "Teachers update doubt status" ON public.live_chat_messages;
CREATE POLICY "Teachers update doubt status"
ON public.live_chat_messages FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.live_classes lc
    WHERE lc.id = live_chat_messages.class_id AND lc.teacher_id = auth.uid()
  )
);

-- 4. Realtime
ALTER TABLE public.live_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.live_classes REPLICA IDENTITY FULL;
ALTER TABLE public.attendance REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_classes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Auto-end function
CREATE OR REPLACE FUNCTION public.auto_end_live_classes()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.live_classes
  SET status = 'ended', ended_at = COALESCE(ended_at, now()), updated_at = now()
  WHERE status = 'live'
    AND COALESCE(started_at, scheduled_at) + (COALESCE(duration_minutes, 60) || ' minutes')::interval < now();
$$;

-- 6. Cron — every minute
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN
  PERFORM cron.unschedule('auto-end-live-classes');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'auto-end-live-classes',
  '* * * * *',
  $$ SELECT public.auto_end_live_classes(); $$
);
