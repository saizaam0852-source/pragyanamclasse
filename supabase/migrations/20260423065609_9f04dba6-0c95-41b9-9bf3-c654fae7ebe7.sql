
-- 1. Enrollments: prevent students from changing status/progress
DROP POLICY IF EXISTS "Users can update own enrollments" ON public.enrollments;

CREATE POLICY "Users can update own enrollments (no status/progress)"
ON public.enrollments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status IS NOT DISTINCT FROM (SELECT status FROM public.enrollments e WHERE e.id = enrollments.id)
  AND progress IS NOT DISTINCT FROM (SELECT progress FROM public.enrollments e WHERE e.id = enrollments.id)
);

CREATE POLICY "Teachers and admins can update enrollments"
ON public.enrollments
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role));

-- 2. Live chat messages: restrict to enrolled students + class teacher + admins
DROP POLICY IF EXISTS "Authenticated can view chat messages" ON public.live_chat_messages;
DROP POLICY IF EXISTS "Authenticated can send chat messages" ON public.live_chat_messages;

CREATE POLICY "View chat messages for enrolled or teaching"
ON public.live_chat_messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.live_classes lc
    WHERE lc.id = live_chat_messages.class_id
      AND (
        lc.teacher_id = auth.uid()
        OR lc.course_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.enrollments e
          WHERE e.user_id = auth.uid()
            AND e.course_id = lc.course_id
            AND e.status = 'active'
        )
      )
  )
);

CREATE POLICY "Send chat messages for enrolled or teaching"
ON public.live_chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.live_classes lc
      WHERE lc.id = live_chat_messages.class_id
        AND (
          lc.teacher_id = auth.uid()
          OR lc.course_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.user_id = auth.uid()
              AND e.course_id = lc.course_id
              AND e.status = 'active'
          )
        )
    )
  )
);

-- 3. Doubts: restrict SELECT to author, course-enrolled, course-teacher, admins
DROP POLICY IF EXISTS "Doubts viewable by authenticated" ON public.doubts;

CREATE POLICY "Doubts viewable by author, enrolled, teachers/admins"
ON public.doubts
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'teacher'::app_role)
  OR (
    course_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.user_id = auth.uid()
        AND e.course_id = doubts.course_id
        AND e.status = 'active'
    )
  )
);

-- 4. Doubt replies: restrict SELECT to people who can see the parent doubt
DROP POLICY IF EXISTS "Replies viewable by authenticated" ON public.doubt_replies;

CREATE POLICY "Replies viewable when doubt is viewable"
ON public.doubt_replies
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'teacher'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.doubts d
    WHERE d.id = doubt_replies.doubt_id
      AND (
        d.user_id = auth.uid()
        OR (
          d.course_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.user_id = auth.uid()
              AND e.course_id = d.course_id
              AND e.status = 'active'
          )
        )
      )
  )
);

-- 5. Hide teacher phone/parent_phone from students.
-- Replace the existing "Students view teacher profiles" policy so students CANNOT
-- read the full profiles row of teachers they don't have a direct relationship with.
-- Instead, students will use the existing `teacher_profiles` / `profiles_public` views,
-- which already exclude phone and parent_phone.
DROP POLICY IF EXISTS "Students view teacher profiles" ON public.profiles;
