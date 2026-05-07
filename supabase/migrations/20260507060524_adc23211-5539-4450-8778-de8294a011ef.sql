REVOKE EXECUTE ON FUNCTION public.auto_update_live_classes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_end_live_classes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_update_live_classes() TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_end_live_classes() TO service_role;