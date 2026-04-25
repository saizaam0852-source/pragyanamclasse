
-- 1. Force handle_new_user_role to always default to 'student', ignoring metadata
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY: never trust user-supplied role metadata. Always default to 'student'.
  -- Promotion to teacher/admin happens only via admin-only flows.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 2. Lock down the backfill RPC to service_role only
REVOKE EXECUTE ON FUNCTION public.backfill_profile_from_auth_metadata() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.backfill_profile_from_auth_metadata() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.backfill_profile_from_auth_metadata() FROM anon;

REVOKE EXECUTE ON FUNCTION public.run_profile_backfill() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_profile_backfill() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.run_profile_backfill() FROM anon;

-- 3. Restrict chapters SELECT to actually enrolled users (or teachers/admins)
DROP POLICY IF EXISTS "Students view chapters of enrolled courses" ON public.chapters;
CREATE POLICY "Students view chapters of enrolled courses"
ON public.chapters
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.subjects sub
    JOIN public.courses c ON c.id = sub.course_id
    LEFT JOIN public.enrollments e
      ON e.course_id = c.id AND e.user_id = auth.uid() AND e.status = 'active'
    WHERE sub.id = chapters.subject_id
      AND c.is_published = true
      AND (c.is_free = true OR e.id IS NOT NULL)
  )
);

-- 4. Restrict enrollment self-insert: free course OR a paid payment exists
DROP POLICY IF EXISTS "Students can enroll" ON public.enrollments;
CREATE POLICY "Students can enroll"
ON public.enrollments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = enrollments.course_id
        AND (c.is_free = true OR COALESCE(c.price, 0) = 0)
    )
    OR EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.user_id = auth.uid()
        AND p.status = 'paid'
    )
  )
);

-- 5. Restrict test_questions answer keys to the test creator + admins only
DROP POLICY IF EXISTS "Teachers/admins can view all questions" ON public.test_questions;
DROP POLICY IF EXISTS "Teachers can manage questions" ON public.test_questions;

-- View answer keys: only test creator or admin
CREATE POLICY "Test creators and admins view questions"
ON public.test_questions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.tests t
    WHERE t.id = test_questions.test_id
      AND t.created_by = auth.uid()
  )
);

-- Manage (insert/update/delete) questions: only test creator or admin
CREATE POLICY "Test creators and admins insert questions"
ON public.test_questions
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.tests t
    WHERE t.id = test_questions.test_id
      AND t.created_by = auth.uid()
  )
);

CREATE POLICY "Test creators and admins update questions"
ON public.test_questions
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.tests t
    WHERE t.id = test_questions.test_id
      AND t.created_by = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.tests t
    WHERE t.id = test_questions.test_id
      AND t.created_by = auth.uid()
  )
);

CREATE POLICY "Test creators and admins delete questions"
ON public.test_questions
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.tests t
    WHERE t.id = test_questions.test_id
      AND t.created_by = auth.uid()
  )
);
