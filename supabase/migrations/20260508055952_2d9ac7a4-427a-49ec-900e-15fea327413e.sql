DROP POLICY IF EXISTS "Teachers and admins view all live classes" ON public.live_classes;
CREATE POLICY "Admins view all live classes"
ON public.live_classes
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers view own live classes"
ON public.live_classes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND teacher_id = auth.uid()
);