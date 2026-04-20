CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    full_name,
    phone,
    parent_phone,
    school,
    class_level,
    state,
    district,
    qualification,
    subjects_taught,
    subscription_plan,
    is_free_student,
    trial_starts_at,
    trial_ends_at,
    is_verified
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'parent_phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'school', ''),
    NULLIF(NEW.raw_user_meta_data->>'class_level', ''),
    NULLIF(NEW.raw_user_meta_data->>'state', ''),
    NULLIF(NEW.raw_user_meta_data->>'district', ''),
    NULLIF(NEW.raw_user_meta_data->>'qualification', ''),
    NULLIF(NEW.raw_user_meta_data->>'subjects_taught', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'subscription_plan', ''), 'paid'),
    COALESCE((NEW.raw_user_meta_data->>'is_free_student')::boolean, false),
    CASE WHEN COALESCE(NULLIF(NEW.raw_user_meta_data->>'subscription_plan', ''), 'paid') = 'paid' THEN now() ELSE NULL END,
    CASE WHEN COALESCE(NULLIF(NEW.raw_user_meta_data->>'subscription_plan', ''), 'paid') = 'paid' THEN now() + interval '7 days' ELSE NULL END,
    CASE WHEN COALESCE(NULLIF(NEW.raw_user_meta_data->>'subscription_plan', ''), 'paid') = 'paid' THEN true ELSE false END
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    parent_phone = COALESCE(public.profiles.parent_phone, EXCLUDED.parent_phone),
    school = COALESCE(public.profiles.school, EXCLUDED.school),
    class_level = COALESCE(public.profiles.class_level, EXCLUDED.class_level),
    state = COALESCE(public.profiles.state, EXCLUDED.state),
    district = COALESCE(public.profiles.district, EXCLUDED.district),
    qualification = COALESCE(public.profiles.qualification, EXCLUDED.qualification),
    subjects_taught = COALESCE(public.profiles.subjects_taught, EXCLUDED.subjects_taught),
    subscription_plan = COALESCE(public.profiles.subscription_plan, EXCLUDED.subscription_plan),
    is_free_student = COALESCE(public.profiles.is_free_student, EXCLUDED.is_free_student),
    trial_starts_at = COALESCE(public.profiles.trial_starts_at, EXCLUDED.trial_starts_at),
    trial_ends_at = COALESCE(public.profiles.trial_ends_at, EXCLUDED.trial_ends_at),
    is_verified = COALESCE(public.profiles.is_verified, EXCLUDED.is_verified);
  RETURN NEW;
END;
$$;