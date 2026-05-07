-- Keep live class status in sync with scheduled start/end times.
CREATE OR REPLACE FUNCTION public.auto_update_live_classes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.live_classes
  SET status = 'live',
      started_at = COALESCE(started_at, scheduled_at),
      updated_at = now()
  WHERE status = 'scheduled'
    AND scheduled_at <= now()
    AND scheduled_at + (COALESCE(duration_minutes, 60) || ' minutes')::interval > now();

  UPDATE public.live_classes
  SET status = 'ended',
      ended_at = COALESCE(ended_at, scheduled_at + (COALESCE(duration_minutes, 60) || ' minutes')::interval, now()),
      updated_at = now()
  WHERE status IN ('scheduled', 'live')
    AND COALESCE(started_at, scheduled_at) + (COALESCE(duration_minutes, 60) || ' minutes')::interval <= now();
END;
$$;

-- Preserve compatibility with the existing scheduled job name/function.
CREATE OR REPLACE FUNCTION public.auto_end_live_classes()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.auto_update_live_classes();
$$;

-- Ensure live classes are not public-by-default for students.
DROP POLICY IF EXISTS "Students view enrolled course live classes" ON public.live_classes;
CREATE POLICY "Students view enrolled course live classes"
ON public.live_classes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
  OR (
    course_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.enrollments e
      WHERE e.user_id = auth.uid()
        AND e.course_id = live_classes.course_id
        AND e.status = 'active'
    )
  )
);

-- Schedule status sync once per minute if pg_cron is available.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
DO $$
BEGIN
  PERFORM cron.unschedule('auto-update-live-classes');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'auto-update-live-classes',
  '* * * * *',
  $$ SELECT public.auto_update_live_classes(); $$
);