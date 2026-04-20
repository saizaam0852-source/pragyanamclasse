CREATE OR REPLACE FUNCTION public.run_profile_backfill()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.backfill_profile_from_auth_metadata();
$$;