CREATE OR REPLACE FUNCTION public.get_total_revenue()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(amount), 0)::bigint
  FROM public.payments
  WHERE status = 'paid'
$$;