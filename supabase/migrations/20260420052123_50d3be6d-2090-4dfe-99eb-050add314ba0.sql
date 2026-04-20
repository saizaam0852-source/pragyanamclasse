CREATE OR REPLACE FUNCTION public.backfill_profile_from_auth_metadata()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles p
  SET
    full_name = COALESCE(NULLIF(p.full_name, ''), COALESCE(u.raw_user_meta_data->>'full_name', '')),
    phone = COALESCE(p.phone, NULLIF(u.raw_user_meta_data->>'phone', '')),
    parent_phone = COALESCE(p.parent_phone, NULLIF(u.raw_user_meta_data->>'parent_phone', '')),
    school = COALESCE(p.school, NULLIF(u.raw_user_meta_data->>'school', '')),
    class_level = COALESCE(p.class_level, NULLIF(u.raw_user_meta_data->>'class_level', '')),
    state = COALESCE(p.state, NULLIF(u.raw_user_meta_data->>'state', '')),
    district = COALESCE(p.district, NULLIF(u.raw_user_meta_data->>'district', '')),
    qualification = COALESCE(p.qualification, NULLIF(u.raw_user_meta_data->>'qualification', '')),
    subjects_taught = COALESCE(p.subjects_taught, NULLIF(u.raw_user_meta_data->>'subjects_taught', '')),
    subscription_plan = COALESCE(p.subscription_plan, NULLIF(u.raw_user_meta_data->>'subscription_plan', '')),
    is_free_student = COALESCE(p.is_free_student, COALESCE((u.raw_user_meta_data->>'is_free_student')::boolean, false))
  FROM auth.users u
  WHERE u.id = p.user_id;
END;
$$;