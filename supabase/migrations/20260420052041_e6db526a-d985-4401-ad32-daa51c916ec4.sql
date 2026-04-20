DROP VIEW IF EXISTS public.teacher_profiles;
CREATE VIEW public.teacher_profiles
WITH (security_invoker=on) AS
SELECT
  p.user_id,
  p.full_name,
  p.avatar_url,
  p.bio,
  p.qualification,
  p.experience_years,
  p.school,
  p.district,
  p.state,
  p.subjects_taught
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.user_id
WHERE ur.role = 'teacher';