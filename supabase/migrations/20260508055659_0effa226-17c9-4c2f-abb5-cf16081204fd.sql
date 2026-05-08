-- Strengthen live class scheduling and participation access.
DROP POLICY IF EXISTS "Teachers can create live classes" ON public.live_classes;
CREATE POLICY "Teachers can create live classes"
ON public.live_classes
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'teacher'::app_role)
    AND teacher_id = auth.uid()
    AND course_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = live_classes.course_id
        AND c.created_by = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Teachers can update own live classes" ON public.live_classes;
CREATE POLICY "Teachers can update own live classes"
ON public.live_classes
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    teacher_id = auth.uid()
    AND has_role(auth.uid(), 'teacher'::app_role)
    AND course_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = live_classes.course_id
        AND c.created_by = auth.uid()
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    teacher_id = auth.uid()
    AND has_role(auth.uid(), 'teacher'::app_role)
    AND course_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = live_classes.course_id
        AND c.created_by = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Students create own attendance" ON public.attendance;
CREATE POLICY "Students create own attendance"
ON public.attendance
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND EXISTS (
    SELECT 1
    FROM public.live_classes lc
    JOIN public.enrollments e ON e.course_id = lc.course_id
    WHERE lc.id = attendance.class_id
      AND lc.status = 'live'
      AND e.user_id = auth.uid()
      AND e.status = 'active'
  )
);

DROP POLICY IF EXISTS "Send chat messages for enrolled or teaching" ON public.live_chat_messages;
CREATE POLICY "Send chat messages for enrolled or teaching"
ON public.live_chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.live_classes lc
      WHERE lc.id = live_chat_messages.class_id
        AND lc.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.live_classes lc
      JOIN public.enrollments e ON e.course_id = lc.course_id
      WHERE lc.id = live_chat_messages.class_id
        AND e.user_id = auth.uid()
        AND e.status = 'active'
    )
  )
);

DROP POLICY IF EXISTS "View chat messages for enrolled or teaching" ON public.live_chat_messages;
CREATE POLICY "View chat messages for enrolled or teaching"
ON public.live_chat_messages
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.live_classes lc
    WHERE lc.id = live_chat_messages.class_id
      AND lc.teacher_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.live_classes lc
    JOIN public.enrollments e ON e.course_id = lc.course_id
    WHERE lc.id = live_chat_messages.class_id
      AND e.user_id = auth.uid()
      AND e.status = 'active'
  )
);