DROP POLICY IF EXISTS "Students view teacher profiles" ON public.profiles;
CREATE POLICY "Students view teacher profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = profiles.user_id
      AND ur.role = 'teacher'
  )
);