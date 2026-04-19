UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email = 'superadmin5670@gmail.com';

SELECT public.promote_user_to_admin('superadmin5670@gmail.com');