CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  room_id TEXT NOT NULL,
  join_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  leave_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_room_id ON public.attendance(room_id);
CREATE INDEX IF NOT EXISTS idx_attendance_join_time ON public.attendance(join_time DESC);

DROP POLICY IF EXISTS "Students view own attendance" ON public.attendance;
CREATE POLICY "Students view own attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (
  auth.uid() = student_id
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'teacher')
);

DROP POLICY IF EXISTS "Students create own attendance" ON public.attendance;
CREATE POLICY "Students create own attendance"
ON public.attendance
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
);

DROP POLICY IF EXISTS "Students update own attendance" ON public.attendance;
CREATE POLICY "Students update own attendance"
ON public.attendance
FOR UPDATE
TO authenticated
USING (
  auth.uid() = student_id
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'teacher')
)
WITH CHECK (
  auth.uid() = student_id
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'teacher')
);

DROP POLICY IF EXISTS "Admins manage attendance" ON public.attendance;
CREATE POLICY "Admins manage attendance"
ON public.attendance
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);

DROP TRIGGER IF EXISTS update_attendance_updated_at ON public.attendance;
CREATE TRIGGER update_attendance_updated_at
BEFORE UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();