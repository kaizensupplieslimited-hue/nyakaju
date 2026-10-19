alter table public.bookings
add column adults_count integer not null default 1,
add column children_count integer not null default 0,
add column receipt_email_status text not null default 'not_configured',
add column receipt_email_provider_id text,
add column receipt_email_sent_at timestamptz,
add column receipt_email_last_error text,
add constraint bookings_adults_count_valid check (adults_count between 1 and 8),
add constraint bookings_children_count_valid check (children_count between 0 and 8),
add constraint bookings_party_fits_rooms check (adults_count + children_count <= room_count * 2),
add constraint bookings_receipt_email_status_valid check (
  receipt_email_status in ('sent', 'failed', 'not_configured')
);

drop function public.create_booking_request(
  bigint, text, text, text, text, date, date, integer
);

create function public.create_booking_request(
  p_room_type_id bigint,
  p_guest_first_name text,
  p_guest_last_name text,
  p_guest_email text,
  p_guest_phone text,
  p_arrival_date date,
  p_departure_date date,
  p_room_count integer,
  p_adults_count integer,
  p_children_count integer
)
returns table (
  booking_id bigint,
  booking_room_name text,
  booking_confirmation_code text,
  booking_status text,
  booked_nightly_rate numeric,
  booking_total_amount numeric,
  booking_currency text,
  remaining_units integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room public.room_types%rowtype;
  v_reserved integer;
  v_booking_id bigint;
  v_confirmation text;
  v_total numeric(12, 2);
  v_attempt integer := 0;
begin
  if p_arrival_date is null
    or p_departure_date is null
    or p_departure_date <= p_arrival_date
    or p_arrival_date < current_date then
    raise exception using errcode = '22023', message = 'INVALID_STAY_DATES';
  end if;

  if btrim(coalesce(p_guest_first_name, '')) = ''
    or btrim(coalesce(p_guest_last_name, '')) = ''
    or btrim(coalesce(p_guest_email, '')) = ''
    or btrim(coalesce(p_guest_phone, '')) = '' then
    raise exception using errcode = '22023', message = 'INVALID_GUEST_DETAILS';
  end if;

  if p_room_count is null or p_room_count < 1 then
    raise exception using errcode = '22023', message = 'INVALID_ROOM_COUNT';
  end if;

  if p_adults_count is null
    or p_adults_count < 1
    or p_adults_count > 8
    or p_children_count is null
    or p_children_count < 0
    or p_children_count > 8
    or p_adults_count + p_children_count > p_room_count * 2 then
    raise exception using errcode = '22023', message = 'INVALID_OCCUPANCY';
  end if;

  perform pg_advisory_xact_lock(p_room_type_id);

  select *
  into v_room
  from public.room_types
  where id = p_room_type_id
    and is_active;

  if not found then
    raise exception using errcode = 'P0002', message = 'ROOM_NOT_AVAILABLE';
  end if;

  select coalesce(sum(b.room_count), 0)::integer
  into v_reserved
  from public.bookings as b
  where b.room_type_id = p_room_type_id
    and b.status = 'confirmed'
    and b.arrival_date < p_departure_date
    and b.departure_date > p_arrival_date;

  if v_reserved + p_room_count > v_room.total_units then
    raise exception using errcode = 'P0001', message = 'ROOM_SOLD_OUT';
  end if;

  v_total := v_room.nightly_rate * (p_departure_date - p_arrival_date) * p_room_count;

  loop
    v_attempt := v_attempt + 1;
    v_confirmation := 'NYK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    begin
      insert into public.bookings (
        confirmation_code,
        room_type_id,
        guest_first_name,
        guest_last_name,
        guest_email,
        guest_phone,
        arrival_date,
        departure_date,
        room_count,
        adults_count,
        children_count,
        status,
        nightly_rate,
        total_amount,
        currency
      )
      values (
        v_confirmation,
        v_room.id,
        btrim(p_guest_first_name),
        btrim(p_guest_last_name),
        lower(btrim(p_guest_email)),
        btrim(p_guest_phone),
        p_arrival_date,
        p_departure_date,
        p_room_count,
        p_adults_count,
        p_children_count,
        'pending',
        v_room.nightly_rate,
        v_total,
        v_room.currency
      )
      returning id into v_booking_id;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 5 then raise; end if;
    end;
  end loop;

  return query
  select
    v_booking_id,
    v_room.name,
    v_confirmation,
    'pending'::text,
    v_room.nightly_rate,
    v_total,
    v_room.currency,
    v_room.total_units - v_reserved - p_room_count;
end;
$$;

revoke all on function public.create_booking_request(
  bigint, text, text, text, text, date, date, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.create_booking_request(
  bigint, text, text, text, text, date, date, integer, integer, integer
) to service_role;
