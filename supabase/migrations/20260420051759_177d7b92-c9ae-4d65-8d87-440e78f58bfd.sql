CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=on) AS
SELECT
  user_id,
  full_name,
  avatar_url,
  class_level,
  school,
  state,
  district,
  qualification,
  subjects_taught,
  experience_years,
  bio,
  language,
  subscription_plan,
  is_free_student,
  is_verified,
  is_disabled,
  created_at,
  updated_at
FROM public.profiles;