# Email OTP login setup (PlotMap_MAEP)

This change switches **approved User sign-in** to email OTP. Admin authentication remains the existing Admin PIN flow. User registration and Admin approval remain unchanged.

## 1. Create the OTP table in Supabase

Run this in the Supabase SQL Editor for the same project used by PlotMap_MAEP:

```sql
create table if not exists public.user_email_otps (
  email text primary key,
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  sent_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.user_email_otps enable row level security;
```

Do not create public/anon policies for this table. The Netlify function accesses it using the server-side Supabase key. Keep `SUPABASE_SERVICE_ROLE_KEY` private; never add it to frontend variables or commit it to GitHub.

## 2. Configure an email sender

The function sends email through Resend. Create/verify a sending domain in Resend, then configure these Netlify environment variables for **Production and Deploy Previews**:

- `RESEND_API_KEY`: API key from Resend.
- `EMAIL_FROM`: a sender on your verified domain, e.g. `Mary Ann Elite Properties <login@your-verified-domain.com>`. Replace the example with your actual verified sender.
- `USER_SESSION_SECRET`: keep using the same secret already configured for the existing user session system.
- `SUPABASE_URL`: your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: recommended server-side key, or `SUPABASE_KEY` if that key has suitable table permissions.
- Optional: `USER_ACCESS_TABLE=user_access` and `USER_EMAIL_OTP_TABLE=user_email_otps` if your table names differ.

Do not paste API keys into chat or commit them to the repository. After setting environment variables, redeploy Netlify.

## 3. Behaviour and protections

- Only users whose `user_access.status` is `approved` can receive a code and sign in.
- OTP is six digits, expires after five minutes, and is stored as an HMAC hash.
- A 60-second resend cooldown and five failed verification attempts are enforced.
- OTP records are deleted after successful verification, expiry, or too many failed attempts.
- Admin PIN authentication, user registration, Admin approvals, session verification, plots, bookings, and dashboard code paths remain in place.

## 4. Test after deployment

1. Register a test User and approve it in the Admin > Users page.
2. Choose User, enter that approved email, and click **Get OTP**.
3. Check inbox and spam/junk folders; enter the six-digit code and click **Sign in**.
4. Verify an unapproved account cannot sign in.
5. Verify Admin still signs in with the existing Admin PIN.
