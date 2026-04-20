DROP POLICY IF EXISTS "Students view teacher profiles" ON public.profiles;
CREATE POLICY "Students view teacher profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(profiles.user_id, 'teacher')
);