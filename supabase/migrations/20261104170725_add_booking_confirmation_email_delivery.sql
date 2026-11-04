alter table public.bookings
add column confirmation_email_status text not null default 'not_configured',
add column confirmation_email_provider_id text,
add column confirmation_email_sent_at timestamptz,
add column confirmation_email_last_error text,
add constraint bookings_confirmation_email_status_valid check (
  confirmation_email_status in ('sent', 'failed', 'not_configured')
);
