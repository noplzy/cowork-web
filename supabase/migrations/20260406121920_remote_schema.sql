


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."can_join_room"("p_user_id" "uuid", "p_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.rooms r
    where r.id = p_room_id
      and (
        r.created_by = p_user_id
        or r.visibility = 'public'
        or (r.visibility = 'members' and public.viewer_is_vip(p_user_id))
        or (r.visibility = 'friends' and public.viewer_is_friend(p_user_id, r.created_by))
      )
  );
$$;


ALTER FUNCTION "public"."can_join_room"("p_user_id" "uuid", "p_room_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_empty_room_after_member_leave"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = old.room_id
  ) then
    delete from public.rooms where id = old.room_id;
  end if;

  return old;
end;
$$;


ALTER FUNCTION "public"."cleanup_empty_room_after_member_leave"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_rooms_and_schedules"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_deleted_posts integer := 0;
  v_deleted_rooms integer := 0;
begin
  with deleted_posts as (
    delete from public.scheduled_room_posts
    where start_at <= now()
    returning id
  )
  select count(*) into v_deleted_posts from deleted_posts;

  with deleted_rooms as (
    delete from public.rooms r
    where not exists (
      select 1 from public.room_members rm where rm.room_id = r.id
    )
    returning r.id
  )
  select count(*) into v_deleted_rooms from deleted_rooms;

  return jsonb_build_object(
    'deleted_schedule_posts', v_deleted_posts,
    'deleted_rooms', v_deleted_rooms
  );
end;
$$;


ALTER FUNCTION "public"."cleanup_rooms_and_schedules"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cowork_try_consume_credits"("p_user_id" "uuid", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_new_used int;
begin
  if p_cost <= 0 then
    return p_allowance;
  end if;

  insert into public.cowork_monthly_usage(user_id, month_start, credits_used)
  values(p_user_id, p_month_start, 0)
  on conflict do nothing;

  update public.cowork_monthly_usage
  set credits_used = credits_used + p_cost,
      updated_at = now()
  where user_id = p_user_id
    and month_start = p_month_start
    and credits_used + p_cost <= p_allowance
  returning credits_used into v_new_used;

  if not found then
    return -1; -- insufficient
  end if;

  return p_allowance - v_new_used;
end;
$$;


ALTER FUNCTION "public"."cowork_try_consume_credits"("p_user_id" "uuid", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cowork_try_consume_identity_credits"("p_user_id" "uuid", "p_identity_key" "text", "p_month_start" "date", "p_cost" integer, "p_allowance" integer DEFAULT 4) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_used integer;
  v_remaining integer;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if p_identity_key is null or length(trim(p_identity_key)) = 0 then
    raise exception 'p_identity_key is required';
  end if;

  if p_cost is null or p_cost <= 0 then
    raise exception 'p_cost must be > 0';
  end if;

  if p_allowance is null or p_allowance <= 0 then
    raise exception 'p_allowance must be > 0';
  end if;

  insert into public.cowork_identity_monthly_usage (identity_key, month_start, credits_used, last_user_id)
  values (p_identity_key, p_month_start, 0, p_user_id)
  on conflict (identity_key, month_start) do nothing;

  insert into public.cowork_monthly_usage (user_id, month_start, credits_used)
  values (p_user_id, p_month_start, 0)
  on conflict (user_id, month_start) do nothing;

  perform 1
  from public.cowork_identity_monthly_usage
  where identity_key = p_identity_key
    and month_start = p_month_start
  for update;

  select credits_used
    into v_used
  from public.cowork_identity_monthly_usage
  where identity_key = p_identity_key
    and month_start = p_month_start;

  if coalesce(v_used, 0) + p_cost > p_allowance then
    return -1;
  end if;

  update public.cowork_identity_monthly_usage
  set credits_used = credits_used + p_cost,
      last_user_id = p_user_id
  where identity_key = p_identity_key
    and month_start = p_month_start;

  update public.cowork_monthly_usage
  set credits_used = credits_used + p_cost
  where user_id = p_user_id
    and month_start = p_month_start;

  select greatest(0, p_allowance - credits_used)
    into v_remaining
  from public.cowork_identity_monthly_usage
  where identity_key = p_identity_key
    and month_start = p_month_start;

  return v_remaining;
end;
$$;


ALTER FUNCTION "public"."cowork_try_consume_identity_credits"("p_user_id" "uuid", "p_identity_key" "text", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ecpay_mark_order_paid"("p_merchant_trade_no" "text", "p_provider_trade_no" "text" DEFAULT NULL::"text", "p_paid_at" timestamp with time zone DEFAULT "now"(), "p_provider_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_order public.payment_orders%rowtype;
  v_current_vip_until timestamptz;
  v_next_vip_until timestamptz;
begin
  if p_merchant_trade_no is null or length(trim(p_merchant_trade_no)) = 0 then
    raise exception 'p_merchant_trade_no is required';
  end if;

  select *
    into v_order
  from public.payment_orders
  where merchant_trade_no = p_merchant_trade_no
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'order_not_found'
    );
  end if;

  if v_order.status = 'paid' then
    return jsonb_build_object(
      'ok', true,
      'already_paid', true,
      'merchant_trade_no', v_order.merchant_trade_no,
      'user_id', v_order.user_id
    );
  end if;

  if v_order.status <> 'pending' then
    return jsonb_build_object(
      'ok', false,
      'reason', 'invalid_status',
      'status', v_order.status
    );
  end if;

  update public.payment_orders
  set status = 'paid',
      provider_trade_no = coalesce(p_provider_trade_no, provider_trade_no),
      paid_at = coalesce(p_paid_at, now()),
      provider_payload = coalesce(provider_payload, '{}'::jsonb) || coalesce(p_provider_payload, '{}'::jsonb),
      updated_at = now()
  where merchant_trade_no = p_merchant_trade_no;

  select vip_until
    into v_current_vip_until
  from public.user_entitlements
  where user_id = v_order.user_id
  for update;

  if v_current_vip_until is not null and v_current_vip_until > now() then
    v_next_vip_until := v_current_vip_until + make_interval(days => v_order.vip_days);
  else
    v_next_vip_until := now() + make_interval(days => v_order.vip_days);
  end if;

  insert into public.user_entitlements (user_id, plan, vip_until)
  values (v_order.user_id, 'vip', v_next_vip_until)
  on conflict (user_id) do update
    set plan = 'vip',
        vip_until = v_next_vip_until,
        updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'already_paid', false,
    'merchant_trade_no', v_order.merchant_trade_no,
    'user_id', v_order.user_id,
    'vip_until', v_next_vip_until
  );
end;
$$;


ALTER FUNCTION "public"."ecpay_mark_order_paid"("p_merchant_trade_no" "text", "p_provider_trade_no" "text", "p_paid_at" timestamp with time zone, "p_provider_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_room_invite_code"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.rooms where invite_code = v_code)
      and not exists (select 1 from public.scheduled_room_posts where invite_code = v_code);
  end loop;
  return v_code;
end;
$$;


ALTER FUNCTION "public"."generate_room_invite_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_entitlement"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.user_entitlements(user_id, plan, vip_until)
  values (new.id, 'free', null)
  on conflict (user_id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user_entitlement"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prepare_room_row"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_existing_count integer;
begin
  if new.room_category not in ('focus', 'life', 'share', 'hobby') then
    raise exception 'room_category must be one of focus, life, share, hobby';
  end if;

  if new.interaction_style not in ('silent', 'light-chat', 'guided', 'open-share') then
    raise exception 'interaction_style must be one of silent, light-chat, guided, open-share';
  end if;

  if new.visibility not in ('public', 'members', 'friends', 'invited') then
    raise exception 'visibility must be one of public, members, friends, invited';
  end if;

  select count(*)
    into v_existing_count
  from public.rooms r
  where r.created_by = new.created_by
    and r.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_existing_count >= 1 then
    raise exception '每位使用者目前最多只能建立 1 間即時同行空間';
  end if;

  if new.visibility = 'invited' then
    if new.invite_code is null or length(trim(new.invite_code)) = 0 then
      new.invite_code := public.generate_room_invite_code();
    end if;
  else
    new.invite_code := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."prepare_room_row"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prepare_scheduled_room_post"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_future_count integer;
begin
  if new.start_at is null then
    raise exception 'start_at is required';
  end if;

  if new.start_at <= now() then
    raise exception '排程開始時間必須晚於現在';
  end if;

  if new.duration_minutes is null or new.duration_minutes not in (25, 50, 75, 100) then
    raise exception 'duration_minutes must be one of 25, 50, 75, 100';
  end if;

  if new.seat_limit is null or new.seat_limit not in (2, 4, 6) then
    raise exception 'seat_limit must be one of 2, 4, 6';
  end if;

  if new.room_category not in ('focus', 'life', 'share', 'hobby') then
    raise exception 'room_category must be one of focus, life, share, hobby';
  end if;

  if new.interaction_style not in ('silent', 'light-chat', 'guided', 'open-share') then
    raise exception 'interaction_style must be one of silent, light-chat, guided, open-share';
  end if;

  if new.visibility not in ('public', 'members', 'friends', 'invited') then
    raise exception 'visibility must be one of public, members, friends, invited';
  end if;

  select count(*)
    into v_future_count
  from public.scheduled_room_posts p
  where p.host_user_id = new.host_user_id
    and p.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and p.start_at > now();

  if v_future_count >= 2 then
    raise exception '每位使用者目前最多只能安排 2 間排程房';
  end if;

  new.end_at := new.start_at + make_interval(mins => new.duration_minutes);

  if new.visibility = 'invited' then
    if new.invite_code is null or length(trim(new.invite_code)) = 0 then
      new.invite_code := public.generate_room_invite_code();
    end if;
  else
    new.invite_code := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."prepare_scheduled_room_post"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_current_timestamp_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_scheduled_room_post_timing"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.duration_minutes is null or new.duration_minutes not in (25, 50, 75, 100) then
    raise exception 'duration_minutes must be one of 25, 50, 75, 100';
  end if;

  if new.seat_limit is null or new.seat_limit not in (2, 4, 6) then
    raise exception 'seat_limit must be one of 2, 4, 6';
  end if;

  if new.start_at is null then
    raise exception 'start_at is required';
  end if;

  new.end_at := new.start_at + make_interval(mins => new.duration_minutes);
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_scheduled_room_post_timing"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."viewer_is_friend"("p_left" "uuid", "p_right" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case
    when p_left is null or p_right is null then false
    when p_left = p_right then true
    else exists (
      select 1
      from public.friendships f
      where f.user_low = least(p_left, p_right)
        and f.user_high = greatest(p_left, p_right)
    )
  end;
$$;


ALTER FUNCTION "public"."viewer_is_friend"("p_left" "uuid", "p_right" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."viewer_is_vip"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_entitlements ue
    where ue.user_id = p_user_id
      and ue.plan = 'vip'
      and (ue.vip_until is null or ue.vip_until > now())
  );
$$;


ALTER FUNCTION "public"."viewer_is_vip"("p_user_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."abuse_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_user_id" "uuid",
    "target_user_id" "uuid",
    "room_id" "uuid",
    "report_type" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "abuse_reports_report_type_check" CHECK (("report_type" = ANY (ARRAY['scam'::"text", 'adult'::"text", 'gambling'::"text", 'harassment'::"text", 'other'::"text"]))),
    CONSTRAINT "abuse_reports_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'reviewing'::"text", 'resolved'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."abuse_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."buddy_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "buyer_user_id" "uuid" NOT NULL,
    "provider_user_id" "uuid" NOT NULL,
    "scheduled_start_at" timestamp with time zone NOT NULL,
    "hours_booked" integer NOT NULL,
    "total_amount_twd" integer NOT NULL,
    "booking_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "buyer_note" "text",
    "provider_note" "text",
    "linked_room_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scheduled_end_at" timestamp with time zone,
    CONSTRAINT "buddy_bookings_booking_status_check" CHECK (("booking_status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'cancelled'::"text", 'completed'::"text"]))),
    CONSTRAINT "buddy_bookings_hours_booked_check" CHECK ((("hours_booked" >= 1) AND ("hours_booked" <= 4))),
    CONSTRAINT "buddy_bookings_not_self" CHECK (("buyer_user_id" <> "provider_user_id")),
    CONSTRAINT "buddy_bookings_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'paid'::"text", 'refunded'::"text"]))),
    CONSTRAINT "buddy_bookings_total_amount_twd_check" CHECK (("total_amount_twd" > 0))
);


ALTER TABLE "public"."buddy_bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."buddy_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "reviewer_user_id" "uuid" NOT NULL,
    "reviewee_user_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "buddy_reviews_not_self" CHECK (("reviewer_user_id" <> "reviewee_user_id")),
    CONSTRAINT "buddy_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."buddy_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."buddy_service_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "provider_user_id" "uuid" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "slot_status" "text" DEFAULT 'open'::"text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "buddy_service_slots_slot_status_check" CHECK (("slot_status" = ANY (ARRAY['open'::"text", 'held'::"text", 'booked'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "buddy_service_slots_time_order" CHECK (("starts_at" < "ends_at"))
);


ALTER TABLE "public"."buddy_service_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."buddy_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "description" "text",
    "room_category" "text" NOT NULL,
    "interaction_style" "text" DEFAULT 'guided'::"text" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "price_per_hour_twd" integer NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "buddy_category" "text" DEFAULT 'focus'::"text",
    "delivery_mode" "text" DEFAULT 'remote'::"text",
    "tag_list" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "accepts_new_users" boolean DEFAULT true NOT NULL,
    "accepts_last_minute" boolean DEFAULT false NOT NULL,
    "availability_note" "text",
    CONSTRAINT "buddy_services_buddy_category_check" CHECK (("buddy_category" = ANY (ARRAY['focus'::"text", 'life'::"text", 'sports'::"text", 'hobby'::"text", 'share'::"text", 'support'::"text", 'travel'::"text"]))),
    CONSTRAINT "buddy_services_delivery_mode_check" CHECK (("delivery_mode" = ANY (ARRAY['remote'::"text", 'in_person'::"text", 'hybrid'::"text"]))),
    CONSTRAINT "buddy_services_interaction_style_check" CHECK (("interaction_style" = ANY (ARRAY['silent'::"text", 'light-chat'::"text", 'guided'::"text", 'open-share'::"text"]))),
    CONSTRAINT "buddy_services_price_per_hour_twd_check" CHECK ((("price_per_hour_twd" >= 100) AND ("price_per_hour_twd" <= 10000))),
    CONSTRAINT "buddy_services_room_category_check" CHECK (("room_category" = ANY (ARRAY['focus'::"text", 'life'::"text", 'share'::"text", 'hobby'::"text"]))),
    CONSTRAINT "buddy_services_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text", 'archived'::"text"]))),
    CONSTRAINT "buddy_services_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'members'::"text", 'friends'::"text"])))
);


ALTER TABLE "public"."buddy_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cowork_identity_monthly_usage" (
    "identity_key" "text" NOT NULL,
    "month_start" "date" NOT NULL,
    "credits_used" integer DEFAULT 0 NOT NULL,
    "last_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cowork_identity_monthly_usage_credits_used_check" CHECK (("credits_used" >= 0))
);


ALTER TABLE "public"."cowork_identity_monthly_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cowork_monthly_usage" (
    "user_id" "uuid" NOT NULL,
    "month_start" "date" NOT NULL,
    "credits_used" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cowork_monthly_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friend_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_user_id" "uuid" NOT NULL,
    "addressee_user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "message" "text",
    "pair_key" "text" GENERATED ALWAYS AS (
CASE
    WHEN (("requester_user_id")::"text" < ("addressee_user_id")::"text") THEN ((("requester_user_id")::"text" || ':'::"text") || ("addressee_user_id")::"text")
    ELSE ((("addressee_user_id")::"text" || ':'::"text") || ("requester_user_id")::"text")
END) STORED,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "friend_requests_no_self" CHECK (("requester_user_id" <> "addressee_user_id")),
    CONSTRAINT "friend_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."friend_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friendships" (
    "user_low" "uuid" NOT NULL,
    "user_high" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "friendships_ordered_pair" CHECK (("user_low" < "user_high"))
);


ALTER TABLE "public"."friendships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_events" (
    "id" bigint NOT NULL,
    "merchant_trade_no" "text" NOT NULL,
    "provider" "text" DEFAULT 'ecpay'::"text" NOT NULL,
    "event_type" "text" NOT NULL,
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_events_provider_check" CHECK (("provider" = 'ecpay'::"text"))
);


ALTER TABLE "public"."payment_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."payment_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."payment_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."payment_events_id_seq" OWNED BY "public"."payment_events"."id";



CREATE TABLE IF NOT EXISTS "public"."payment_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'ecpay'::"text" NOT NULL,
    "merchant_trade_no" "text" NOT NULL,
    "plan_code" "text" NOT NULL,
    "amount" integer NOT NULL,
    "currency" "text" DEFAULT 'TWD'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "item_name" "text" NOT NULL,
    "trade_desc" "text" NOT NULL,
    "vip_days" integer DEFAULT 30 NOT NULL,
    "provider_trade_no" "text",
    "paid_at" timestamp with time zone,
    "last_error" "text",
    "provider_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_orders_amount_check" CHECK (("amount" > 0)),
    CONSTRAINT "payment_orders_currency_check" CHECK (("currency" = 'TWD'::"text")),
    CONSTRAINT "payment_orders_plan_code_check" CHECK (("plan_code" = 'vip_month'::"text")),
    CONSTRAINT "payment_orders_provider_check" CHECK (("provider" = 'ecpay'::"text")),
    CONSTRAINT "payment_orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'cancelled'::"text", 'expired'::"text"]))),
    CONSTRAINT "payment_orders_vip_days_check" CHECK ((("vip_days" > 0) AND ("vip_days" <= 366)))
);


ALTER TABLE "public"."payment_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "handle" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "avatar_url" "text",
    "bio" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "accepting_friend_requests" boolean DEFAULT true NOT NULL,
    "accepting_schedule_invites" boolean DEFAULT true NOT NULL,
    "show_upcoming_schedule" boolean DEFAULT true NOT NULL,
    "is_professional_buddy" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_handle_format" CHECK (("handle" ~ '^[a-z0-9._-]{3,30}$'::"text")),
    CONSTRAINT "profiles_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'members'::"text", 'friends'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_members" (
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."room_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "duration_minutes" integer NOT NULL,
    "mode" "text" NOT NULL,
    "max_size" integer NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "daily_room_url" "text",
    "room_category" "text" DEFAULT 'focus'::"text" NOT NULL,
    "interaction_style" "text" DEFAULT 'silent'::"text" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "host_note" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invite_code" "text",
    CONSTRAINT "rooms_duration_minutes_check" CHECK (("duration_minutes" = ANY (ARRAY[25, 50]))),
    CONSTRAINT "rooms_interaction_style_check" CHECK (("interaction_style" = ANY (ARRAY['silent'::"text", 'light-chat'::"text", 'guided'::"text", 'open-share'::"text"]))),
    CONSTRAINT "rooms_max_size_check" CHECK ((("max_size" >= 2) AND ("max_size" <= 6))),
    CONSTRAINT "rooms_mode_check" CHECK (("mode" = ANY (ARRAY['group'::"text", 'pair'::"text"]))),
    CONSTRAINT "rooms_room_category_check" CHECK (("room_category" = ANY (ARRAY['focus'::"text", 'life'::"text", 'share'::"text", 'hobby'::"text"]))),
    CONSTRAINT "rooms_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'members'::"text", 'friends'::"text", 'invited'::"text"])))
);


ALTER TABLE "public"."rooms" OWNER TO "postgres";


COMMENT ON COLUMN "public"."rooms"."room_category" IS 'Rooms 場景：focus / life / share / hobby';



COMMENT ON COLUMN "public"."rooms"."interaction_style" IS '互動形式：silent / light-chat / guided / open-share';



COMMENT ON COLUMN "public"."rooms"."visibility" IS '可見性：public / members / friends / invited';



COMMENT ON COLUMN "public"."rooms"."host_note" IS '房主補充說明，主要用於 room list 與 room detail 的輔助資訊';



COMMENT ON COLUMN "public"."rooms"."invite_code" IS '邀請制即時房的加入代碼；只有 invited 可見性時會自動產生';



CREATE TABLE IF NOT EXISTS "public"."scheduled_room_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "host_user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "room_category" "text" DEFAULT 'focus'::"text" NOT NULL,
    "interaction_style" "text" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "seat_limit" integer DEFAULT 4 NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "duration_minutes" integer,
    "invite_code" "text",
    CONSTRAINT "scheduled_room_posts_interaction_style_check" CHECK (("interaction_style" = ANY (ARRAY['silent'::"text", 'light-chat'::"text", 'guided'::"text", 'open-share'::"text"]))),
    CONSTRAINT "scheduled_room_posts_room_category_check" CHECK (("room_category" = ANY (ARRAY['focus'::"text", 'life'::"text", 'share'::"text", 'hobby'::"text"]))),
    CONSTRAINT "scheduled_room_posts_seat_limit_check" CHECK ((("seat_limit" >= 2) AND ("seat_limit" <= 12))),
    CONSTRAINT "scheduled_room_posts_time_order" CHECK (("start_at" < "end_at")),
    CONSTRAINT "scheduled_room_posts_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'members'::"text", 'friends'::"text", 'invited'::"text"])))
);


ALTER TABLE "public"."scheduled_room_posts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."scheduled_room_posts"."room_category" IS 'Rooms 排程場景：focus / life / share / hobby';



COMMENT ON COLUMN "public"."scheduled_room_posts"."invite_code" IS '邀請制排程房的查看代碼；只有 invited 可見性時會自動產生';



CREATE TABLE IF NOT EXISTS "public"."security_audit_logs" (
    "id" bigint NOT NULL,
    "actor_user_id" "uuid",
    "target_user_id" "uuid",
    "action" "text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."security_audit_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."security_audit_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."security_audit_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."security_audit_logs_id_seq" OWNED BY "public"."security_audit_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."user_blocks" (
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "block_scope" "text" DEFAULT 'site'::"text" NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_blocks_block_scope_check" CHECK (("block_scope" = 'site'::"text"))
);


ALTER TABLE "public"."user_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_entitlements" (
    "user_id" "uuid" NOT NULL,
    "plan" "text" DEFAULT 'free'::"text" NOT NULL,
    "vip_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_entitlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_private_profile_settings" (
    "user_id" "uuid" NOT NULL,
    "notify_friend_requests" boolean DEFAULT true NOT NULL,
    "notify_schedule_updates" boolean DEFAULT true NOT NULL,
    "notify_room_reminders" boolean DEFAULT true NOT NULL,
    "payment_card_brand" "text",
    "payment_card_last4" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_card_last4_format" CHECK ((("payment_card_last4" IS NULL) OR ("payment_card_last4" ~ '^[0-9]{4}$'::"text")))
);


ALTER TABLE "public"."user_private_profile_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_security_flags" (
    "user_id" "uuid" NOT NULL,
    "block_scope" "text" DEFAULT 'none'::"text" NOT NULL,
    "block_reason" "text",
    "blocked_at" timestamp with time zone,
    "blocked_by" "uuid",
    "bound_phone_hash" "text",
    "phone_verified_at" timestamp with time zone,
    "phone_conflict" boolean DEFAULT false NOT NULL,
    "risk_level" "text" DEFAULT 'normal'::"text" NOT NULL,
    "require_phone_verification" boolean DEFAULT true NOT NULL,
    "last_auth_provider" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_security_flags_block_scope_check" CHECK (("block_scope" = ANY (ARRAY['none'::"text", 'site'::"text"]))),
    CONSTRAINT "user_security_flags_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['normal'::"text", 'review'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."user_security_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."verified_phone_identities" (
    "phone_hash" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "phone_e164" "text" NOT NULL,
    "first_verified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_verified_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."verified_phone_identities" OWNER TO "postgres";


ALTER TABLE ONLY "public"."payment_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."payment_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."security_audit_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."security_audit_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."abuse_reports"
    ADD CONSTRAINT "abuse_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buddy_bookings"
    ADD CONSTRAINT "buddy_bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buddy_reviews"
    ADD CONSTRAINT "buddy_reviews_booking_id_key" UNIQUE ("booking_id");



ALTER TABLE ONLY "public"."buddy_reviews"
    ADD CONSTRAINT "buddy_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buddy_service_slots"
    ADD CONSTRAINT "buddy_service_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buddy_services"
    ADD CONSTRAINT "buddy_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cowork_identity_monthly_usage"
    ADD CONSTRAINT "cowork_identity_monthly_usage_pkey" PRIMARY KEY ("identity_key", "month_start");



ALTER TABLE ONLY "public"."cowork_monthly_usage"
    ADD CONSTRAINT "cowork_monthly_usage_pkey" PRIMARY KEY ("user_id", "month_start");



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("user_low", "user_high");



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_merchant_trade_no_key" UNIQUE ("merchant_trade_no");



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."room_members"
    ADD CONSTRAINT "room_members_pkey" PRIMARY KEY ("room_id", "user_id");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scheduled_room_posts"
    ADD CONSTRAINT "scheduled_room_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_audit_logs"
    ADD CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_entitlements"
    ADD CONSTRAINT "user_entitlements_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_private_profile_settings"
    ADD CONSTRAINT "user_private_profile_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_security_flags"
    ADD CONSTRAINT "user_security_flags_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."verified_phone_identities"
    ADD CONSTRAINT "verified_phone_identities_pkey" PRIMARY KEY ("phone_hash");



ALTER TABLE ONLY "public"."verified_phone_identities"
    ADD CONSTRAINT "verified_phone_identities_user_id_key" UNIQUE ("user_id");



CREATE INDEX "friend_requests_addressee_idx" ON "public"."friend_requests" USING "btree" ("addressee_user_id", "status", "created_at" DESC);



CREATE UNIQUE INDEX "friend_requests_pair_key_idx" ON "public"."friend_requests" USING "btree" ("pair_key");



CREATE INDEX "friend_requests_requester_idx" ON "public"."friend_requests" USING "btree" ("requester_user_id", "status", "created_at" DESC);



CREATE INDEX "friendships_user_high_idx" ON "public"."friendships" USING "btree" ("user_high", "created_at" DESC);



CREATE INDEX "friendships_user_low_idx" ON "public"."friendships" USING "btree" ("user_low", "created_at" DESC);



CREATE INDEX "idx_abuse_reports_status" ON "public"."abuse_reports" USING "btree" ("status");



CREATE INDEX "idx_buddy_bookings_buyer_created" ON "public"."buddy_bookings" USING "btree" ("buyer_user_id", "created_at" DESC);



CREATE INDEX "idx_buddy_bookings_provider_created" ON "public"."buddy_bookings" USING "btree" ("provider_user_id", "created_at" DESC);



CREATE INDEX "idx_buddy_bookings_service_created" ON "public"."buddy_bookings" USING "btree" ("service_id", "created_at" DESC);



CREATE INDEX "idx_buddy_bookings_status_start" ON "public"."buddy_bookings" USING "btree" ("booking_status", "scheduled_start_at");



CREATE UNIQUE INDEX "idx_buddy_reviews_booking_reviewer_unique" ON "public"."buddy_reviews" USING "btree" ("booking_id", "reviewer_user_id");



CREATE INDEX "idx_buddy_reviews_service_created" ON "public"."buddy_reviews" USING "btree" ("service_id", "created_at" DESC);



CREATE INDEX "idx_buddy_service_slots_provider_starts" ON "public"."buddy_service_slots" USING "btree" ("provider_user_id", "starts_at");



CREATE INDEX "idx_buddy_service_slots_service_starts" ON "public"."buddy_service_slots" USING "btree" ("service_id", "starts_at");



CREATE INDEX "idx_buddy_services_category_status" ON "public"."buddy_services" USING "btree" ("buddy_category", "status", "updated_at" DESC);



CREATE INDEX "idx_buddy_services_provider" ON "public"."buddy_services" USING "btree" ("provider_user_id", "updated_at" DESC);



CREATE INDEX "idx_buddy_services_provider_updated" ON "public"."buddy_services" USING "btree" ("provider_user_id", "updated_at" DESC);



CREATE INDEX "idx_buddy_services_scene_status" ON "public"."buddy_services" USING "btree" ("room_category", "status", "updated_at" DESC);



CREATE INDEX "idx_buddy_services_status_visibility" ON "public"."buddy_services" USING "btree" ("status", "visibility", "updated_at" DESC);



CREATE INDEX "idx_buddy_services_tag_list" ON "public"."buddy_services" USING "gin" ("tag_list");



CREATE INDEX "idx_cowork_identity_monthly_usage_last_user_id" ON "public"."cowork_identity_monthly_usage" USING "btree" ("last_user_id");



CREATE INDEX "idx_payment_events_trade_no_created_at" ON "public"."payment_events" USING "btree" ("merchant_trade_no", "created_at" DESC);



CREATE INDEX "idx_payment_orders_status_created_at" ON "public"."payment_orders" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_payment_orders_user_id_created_at" ON "public"."payment_orders" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_security_audit_logs_target_user_id" ON "public"."security_audit_logs" USING "btree" ("target_user_id");



CREATE INDEX "idx_user_security_flags_block_scope" ON "public"."user_security_flags" USING "btree" ("block_scope");



CREATE INDEX "idx_verified_phone_identities_user_id" ON "public"."verified_phone_identities" USING "btree" ("user_id");



CREATE UNIQUE INDEX "profiles_handle_lower_idx" ON "public"."profiles" USING "btree" ("lower"("handle"));



CREATE INDEX "room_members_room_idx" ON "public"."room_members" USING "btree" ("room_id");



CREATE INDEX "room_members_user_idx" ON "public"."room_members" USING "btree" ("user_id");



CREATE INDEX "rooms_created_at_idx" ON "public"."rooms" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "rooms_invite_code_idx" ON "public"."rooms" USING "btree" ("invite_code") WHERE ("invite_code" IS NOT NULL);



CREATE UNIQUE INDEX "rooms_one_owner_active_idx" ON "public"."rooms" USING "btree" ("created_by");



CREATE INDEX "rooms_room_category_created_at_idx" ON "public"."rooms" USING "btree" ("room_category", "created_at" DESC);



CREATE INDEX "rooms_visibility_created_at_idx" ON "public"."rooms" USING "btree" ("visibility", "created_at" DESC);



CREATE INDEX "scheduled_room_posts_host_idx" ON "public"."scheduled_room_posts" USING "btree" ("host_user_id", "start_at");



CREATE UNIQUE INDEX "scheduled_room_posts_invite_code_idx" ON "public"."scheduled_room_posts" USING "btree" ("invite_code") WHERE ("invite_code" IS NOT NULL);



CREATE INDEX "scheduled_room_posts_start_idx" ON "public"."scheduled_room_posts" USING "btree" ("start_at");



CREATE OR REPLACE TRIGGER "trg_abuse_reports_updated_at" BEFORE UPDATE ON "public"."abuse_reports" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_buddy_bookings_updated_at" BEFORE UPDATE ON "public"."buddy_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_buddy_service_slots_updated_at" BEFORE UPDATE ON "public"."buddy_service_slots" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_buddy_services_updated_at" BEFORE UPDATE ON "public"."buddy_services" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_cowork_identity_monthly_usage_updated_at" BEFORE UPDATE ON "public"."cowork_identity_monthly_usage" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_friend_requests_updated_at" BEFORE UPDATE ON "public"."friend_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_payment_orders_updated_at" BEFORE UPDATE ON "public"."payment_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_room_members_cleanup_empty_room" AFTER DELETE ON "public"."room_members" FOR EACH ROW EXECUTE FUNCTION "public"."cleanup_empty_room_after_member_leave"();



CREATE OR REPLACE TRIGGER "trg_rooms_prepare" BEFORE INSERT OR UPDATE ON "public"."rooms" FOR EACH ROW EXECUTE FUNCTION "public"."prepare_room_row"();



CREATE OR REPLACE TRIGGER "trg_rooms_updated_at" BEFORE UPDATE ON "public"."rooms" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_scheduled_room_posts_sync_timing" BEFORE INSERT OR UPDATE ON "public"."scheduled_room_posts" FOR EACH ROW EXECUTE FUNCTION "public"."prepare_scheduled_room_post"();



CREATE OR REPLACE TRIGGER "trg_scheduled_room_posts_updated_at" BEFORE UPDATE ON "public"."scheduled_room_posts" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_private_profile_settings_updated_at" BEFORE UPDATE ON "public"."user_private_profile_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_security_flags_updated_at" BEFORE UPDATE ON "public"."user_security_flags" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();



ALTER TABLE ONLY "public"."abuse_reports"
    ADD CONSTRAINT "abuse_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."abuse_reports"
    ADD CONSTRAINT "abuse_reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."buddy_bookings"
    ADD CONSTRAINT "buddy_bookings_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buddy_bookings"
    ADD CONSTRAINT "buddy_bookings_linked_room_id_fkey" FOREIGN KEY ("linked_room_id") REFERENCES "public"."rooms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."buddy_bookings"
    ADD CONSTRAINT "buddy_bookings_provider_user_id_fkey" FOREIGN KEY ("provider_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buddy_bookings"
    ADD CONSTRAINT "buddy_bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."buddy_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buddy_reviews"
    ADD CONSTRAINT "buddy_reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."buddy_bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buddy_reviews"
    ADD CONSTRAINT "buddy_reviews_reviewee_user_id_fkey" FOREIGN KEY ("reviewee_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buddy_reviews"
    ADD CONSTRAINT "buddy_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buddy_reviews"
    ADD CONSTRAINT "buddy_reviews_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."buddy_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buddy_service_slots"
    ADD CONSTRAINT "buddy_service_slots_provider_user_id_fkey" FOREIGN KEY ("provider_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buddy_service_slots"
    ADD CONSTRAINT "buddy_service_slots_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."buddy_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buddy_services"
    ADD CONSTRAINT "buddy_services_provider_user_id_fkey" FOREIGN KEY ("provider_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cowork_monthly_usage"
    ADD CONSTRAINT "cowork_monthly_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_addressee_user_id_fkey" FOREIGN KEY ("addressee_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user_high_fkey" FOREIGN KEY ("user_high") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user_low_fkey" FOREIGN KEY ("user_low") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_members"
    ADD CONSTRAINT "room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_room_posts"
    ADD CONSTRAINT "scheduled_room_posts_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_audit_logs"
    ADD CONSTRAINT "security_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."security_audit_logs"
    ADD CONSTRAINT "security_audit_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_entitlements"
    ADD CONSTRAINT "user_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_private_profile_settings"
    ADD CONSTRAINT "user_private_profile_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_security_flags"
    ADD CONSTRAINT "user_security_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."verified_phone_identities"
    ADD CONSTRAINT "verified_phone_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."abuse_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."buddy_bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buddy_bookings_insert_buyer" ON "public"."buddy_bookings" FOR INSERT TO "authenticated" WITH CHECK (("buyer_user_id" = "auth"."uid"()));



CREATE POLICY "buddy_bookings_select_parties" ON "public"."buddy_bookings" FOR SELECT TO "authenticated" USING ((("buyer_user_id" = "auth"."uid"()) OR ("provider_user_id" = "auth"."uid"())));



CREATE POLICY "buddy_bookings_update_parties" ON "public"."buddy_bookings" FOR UPDATE TO "authenticated" USING ((("buyer_user_id" = "auth"."uid"()) OR ("provider_user_id" = "auth"."uid"()))) WITH CHECK ((("buyer_user_id" = "auth"."uid"()) OR ("provider_user_id" = "auth"."uid"())));



ALTER TABLE "public"."buddy_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buddy_reviews_insert_reviewer" ON "public"."buddy_reviews" FOR INSERT TO "authenticated" WITH CHECK (("reviewer_user_id" = "auth"."uid"()));



CREATE POLICY "buddy_reviews_select_all" ON "public"."buddy_reviews" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "buddy_reviews_select_public" ON "public"."buddy_reviews" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "buddy_reviews_update_reviewer" ON "public"."buddy_reviews" FOR UPDATE TO "authenticated" USING (("reviewer_user_id" = "auth"."uid"())) WITH CHECK (("reviewer_user_id" = "auth"."uid"()));



ALTER TABLE "public"."buddy_service_slots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buddy_service_slots_delete_own" ON "public"."buddy_service_slots" FOR DELETE TO "authenticated" USING (("provider_user_id" = "auth"."uid"()));



CREATE POLICY "buddy_service_slots_insert_own" ON "public"."buddy_service_slots" FOR INSERT TO "authenticated" WITH CHECK (("provider_user_id" = "auth"."uid"()));



CREATE POLICY "buddy_service_slots_select_all" ON "public"."buddy_service_slots" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "buddy_service_slots_update_own" ON "public"."buddy_service_slots" FOR UPDATE TO "authenticated" USING (("provider_user_id" = "auth"."uid"())) WITH CHECK (("provider_user_id" = "auth"."uid"()));



ALTER TABLE "public"."buddy_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buddy_services_authenticated_select" ON "public"."buddy_services" FOR SELECT TO "authenticated" USING ((("provider_user_id" = "auth"."uid"()) OR (("status" = 'active'::"text") AND ("visibility" = ANY (ARRAY['public'::"text", 'members'::"text", 'friends'::"text"])))));



CREATE POLICY "buddy_services_delete_own" ON "public"."buddy_services" FOR DELETE TO "authenticated" USING (("provider_user_id" = "auth"."uid"()));



CREATE POLICY "buddy_services_insert_own" ON "public"."buddy_services" FOR INSERT TO "authenticated" WITH CHECK (("provider_user_id" = "auth"."uid"()));



CREATE POLICY "buddy_services_public_select" ON "public"."buddy_services" FOR SELECT TO "anon" USING ((("status" = 'active'::"text") AND ("visibility" = 'public'::"text")));



CREATE POLICY "buddy_services_select_anon_public" ON "public"."buddy_services" FOR SELECT TO "anon" USING ((("status" = 'active'::"text") AND ("visibility" = 'public'::"text")));



CREATE POLICY "buddy_services_select_authenticated" ON "public"."buddy_services" FOR SELECT TO "authenticated" USING ((("provider_user_id" = "auth"."uid"()) OR (("status" = 'active'::"text") AND ("visibility" = 'public'::"text")) OR (("status" = 'active'::"text") AND ("visibility" = 'members'::"text") AND "public"."viewer_is_vip"("auth"."uid"())) OR (("status" = 'active'::"text") AND ("visibility" = 'friends'::"text") AND "public"."viewer_is_friend"("auth"."uid"(), "provider_user_id"))));



CREATE POLICY "buddy_services_update_own" ON "public"."buddy_services" FOR UPDATE TO "authenticated" USING (("provider_user_id" = "auth"."uid"())) WITH CHECK (("provider_user_id" = "auth"."uid"()));



ALTER TABLE "public"."cowork_identity_monthly_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cowork_monthly_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."friend_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "friend_requests_insert_requester" ON "public"."friend_requests" FOR INSERT TO "authenticated" WITH CHECK ((("requester_user_id" = "auth"."uid"()) AND ("requester_user_id" <> "addressee_user_id")));



CREATE POLICY "friend_requests_select_parties" ON "public"."friend_requests" FOR SELECT TO "authenticated" USING ((("requester_user_id" = "auth"."uid"()) OR ("addressee_user_id" = "auth"."uid"())));



CREATE POLICY "friend_requests_update_parties" ON "public"."friend_requests" FOR UPDATE TO "authenticated" USING ((("requester_user_id" = "auth"."uid"()) OR ("addressee_user_id" = "auth"."uid"()))) WITH CHECK ((("requester_user_id" = "auth"."uid"()) OR ("addressee_user_id" = "auth"."uid"())));



ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "friendships_delete_own" ON "public"."friendships" FOR DELETE TO "authenticated" USING ((("user_low" = "auth"."uid"()) OR ("user_high" = "auth"."uid"())));



CREATE POLICY "friendships_insert_own" ON "public"."friendships" FOR INSERT TO "authenticated" WITH CHECK (((("user_low" = "auth"."uid"()) OR ("user_high" = "auth"."uid"())) AND ("user_low" < "user_high")));



CREATE POLICY "friendships_select_own" ON "public"."friendships" FOR SELECT TO "authenticated" USING ((("user_low" = "auth"."uid"()) OR ("user_high" = "auth"."uid"())));



CREATE POLICY "members_delete_self" ON "public"."room_members" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "members_insert_self" ON "public"."room_members" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."can_join_room"("auth"."uid"(), "room_id")));



CREATE POLICY "members_select_self" ON "public"."room_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."payment_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_events_no_direct_delete" ON "public"."payment_events" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "payment_events_no_direct_insert" ON "public"."payment_events" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "payment_events_no_direct_select" ON "public"."payment_events" FOR SELECT TO "authenticated" USING (false);



CREATE POLICY "payment_events_no_direct_update" ON "public"."payment_events" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



ALTER TABLE "public"."payment_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_orders_no_direct_delete" ON "public"."payment_orders" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "payment_orders_no_direct_insert" ON "public"."payment_orders" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "payment_orders_no_direct_update" ON "public"."payment_orders" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "payment_orders_select_own" ON "public"."payment_orders" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "private_settings_insert_own" ON "public"."user_private_profile_settings" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "private_settings_select_own" ON "public"."user_private_profile_settings" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "private_settings_update_own" ON "public"."user_private_profile_settings" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_delete_own" ON "public"."profiles" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "profiles_select_anon_public" ON "public"."profiles" FOR SELECT TO "anon" USING (("visibility" = 'public'::"text"));



CREATE POLICY "profiles_select_authenticated" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("visibility" = ANY (ARRAY['public'::"text", 'members'::"text"]))));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "read_own_entitlement" ON "public"."user_entitlements" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "read_own_monthly_usage" ON "public"."cowork_monthly_usage" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."room_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rooms_delete_owner" ON "public"."rooms" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "created_by"));



CREATE POLICY "rooms_insert_owner" ON "public"."rooms" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "rooms_select_authenticated" ON "public"."rooms" FOR SELECT TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR ("visibility" = 'public'::"text") OR (("visibility" = 'members'::"text") AND "public"."viewer_is_vip"("auth"."uid"())) OR (("visibility" = 'friends'::"text") AND "public"."viewer_is_friend"("auth"."uid"(), "created_by"))));



CREATE POLICY "rooms_update_owner" ON "public"."rooms" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "created_by")) WITH CHECK (("auth"."uid"() = "created_by"));



ALTER TABLE "public"."scheduled_room_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "scheduled_room_posts_delete_own" ON "public"."scheduled_room_posts" FOR DELETE TO "authenticated" USING (("host_user_id" = "auth"."uid"()));



CREATE POLICY "scheduled_room_posts_insert_own" ON "public"."scheduled_room_posts" FOR INSERT TO "authenticated" WITH CHECK (("host_user_id" = "auth"."uid"()));



CREATE POLICY "scheduled_room_posts_select_anon_public" ON "public"."scheduled_room_posts" FOR SELECT TO "anon" USING (("visibility" = 'public'::"text"));



CREATE POLICY "scheduled_room_posts_select_authenticated" ON "public"."scheduled_room_posts" FOR SELECT TO "authenticated" USING ((("host_user_id" = "auth"."uid"()) OR ("visibility" = 'public'::"text") OR (("visibility" = 'members'::"text") AND "public"."viewer_is_vip"("auth"."uid"())) OR (("visibility" = 'friends'::"text") AND "public"."viewer_is_friend"("auth"."uid"(), "host_user_id"))));



CREATE POLICY "scheduled_room_posts_update_own" ON "public"."scheduled_room_posts" FOR UPDATE TO "authenticated" USING (("host_user_id" = "auth"."uid"())) WITH CHECK (("host_user_id" = "auth"."uid"()));



ALTER TABLE "public"."security_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_blocks_no_direct_delete" ON "public"."user_blocks" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "user_blocks_no_direct_insert" ON "public"."user_blocks" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "user_blocks_no_direct_select" ON "public"."user_blocks" FOR SELECT TO "authenticated" USING (false);



CREATE POLICY "user_blocks_no_direct_update" ON "public"."user_blocks" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



ALTER TABLE "public"."user_entitlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_private_profile_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_security_flags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."verified_phone_identities" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."can_join_room"("p_user_id" "uuid", "p_room_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_join_room"("p_user_id" "uuid", "p_room_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_join_room"("p_user_id" "uuid", "p_room_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_empty_room_after_member_leave"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_empty_room_after_member_leave"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_empty_room_after_member_leave"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_rooms_and_schedules"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_rooms_and_schedules"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_rooms_and_schedules"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_rooms_and_schedules"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cowork_try_consume_credits"("p_user_id" "uuid", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_try_consume_credits"("p_user_id" "uuid", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cowork_try_consume_credits"("p_user_id" "uuid", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cowork_try_consume_credits"("p_user_id" "uuid", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."cowork_try_consume_identity_credits"("p_user_id" "uuid", "p_identity_key" "text", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_try_consume_identity_credits"("p_user_id" "uuid", "p_identity_key" "text", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cowork_try_consume_identity_credits"("p_user_id" "uuid", "p_identity_key" "text", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cowork_try_consume_identity_credits"("p_user_id" "uuid", "p_identity_key" "text", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."ecpay_mark_order_paid"("p_merchant_trade_no" "text", "p_provider_trade_no" "text", "p_paid_at" timestamp with time zone, "p_provider_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ecpay_mark_order_paid"("p_merchant_trade_no" "text", "p_provider_trade_no" "text", "p_paid_at" timestamp with time zone, "p_provider_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."ecpay_mark_order_paid"("p_merchant_trade_no" "text", "p_provider_trade_no" "text", "p_paid_at" timestamp with time zone, "p_provider_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ecpay_mark_order_paid"("p_merchant_trade_no" "text", "p_provider_trade_no" "text", "p_paid_at" timestamp with time zone, "p_provider_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_room_invite_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_room_invite_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_room_invite_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_entitlement"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_entitlement"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_entitlement"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prepare_room_row"() TO "anon";
GRANT ALL ON FUNCTION "public"."prepare_room_row"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prepare_room_row"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prepare_scheduled_room_post"() TO "anon";
GRANT ALL ON FUNCTION "public"."prepare_scheduled_room_post"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prepare_scheduled_room_post"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_current_timestamp_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_current_timestamp_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_current_timestamp_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_scheduled_room_post_timing"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_scheduled_room_post_timing"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_scheduled_room_post_timing"() TO "service_role";



GRANT ALL ON FUNCTION "public"."viewer_is_friend"("p_left" "uuid", "p_right" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."viewer_is_friend"("p_left" "uuid", "p_right" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."viewer_is_friend"("p_left" "uuid", "p_right" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."viewer_is_vip"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."viewer_is_vip"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."viewer_is_vip"("p_user_id" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."abuse_reports" TO "anon";
GRANT ALL ON TABLE "public"."abuse_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."abuse_reports" TO "service_role";



GRANT ALL ON TABLE "public"."buddy_bookings" TO "anon";
GRANT ALL ON TABLE "public"."buddy_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_bookings" TO "service_role";



GRANT ALL ON TABLE "public"."buddy_reviews" TO "anon";
GRANT ALL ON TABLE "public"."buddy_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."buddy_service_slots" TO "anon";
GRANT ALL ON TABLE "public"."buddy_service_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_service_slots" TO "service_role";



GRANT ALL ON TABLE "public"."buddy_services" TO "anon";
GRANT ALL ON TABLE "public"."buddy_services" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_services" TO "service_role";



GRANT ALL ON TABLE "public"."cowork_identity_monthly_usage" TO "anon";
GRANT ALL ON TABLE "public"."cowork_identity_monthly_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."cowork_identity_monthly_usage" TO "service_role";



GRANT ALL ON TABLE "public"."cowork_monthly_usage" TO "anon";
GRANT ALL ON TABLE "public"."cowork_monthly_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."cowork_monthly_usage" TO "service_role";



GRANT ALL ON TABLE "public"."friend_requests" TO "anon";
GRANT ALL ON TABLE "public"."friend_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."friend_requests" TO "service_role";



GRANT ALL ON TABLE "public"."friendships" TO "anon";
GRANT ALL ON TABLE "public"."friendships" TO "authenticated";
GRANT ALL ON TABLE "public"."friendships" TO "service_role";



GRANT ALL ON TABLE "public"."payment_events" TO "anon";
GRANT ALL ON TABLE "public"."payment_events" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."payment_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."payment_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."payment_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."payment_orders" TO "anon";
GRANT ALL ON TABLE "public"."payment_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_orders" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."room_members" TO "anon";
GRANT ALL ON TABLE "public"."room_members" TO "authenticated";
GRANT ALL ON TABLE "public"."room_members" TO "service_role";



GRANT ALL ON TABLE "public"."rooms" TO "anon";
GRANT ALL ON TABLE "public"."rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."rooms" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_room_posts" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_room_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_room_posts" TO "service_role";



GRANT ALL ON TABLE "public"."security_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."security_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."security_audit_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."security_audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."security_audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."security_audit_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_blocks" TO "anon";
GRANT ALL ON TABLE "public"."user_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."user_entitlements" TO "anon";
GRANT ALL ON TABLE "public"."user_entitlements" TO "authenticated";
GRANT ALL ON TABLE "public"."user_entitlements" TO "service_role";



GRANT ALL ON TABLE "public"."user_private_profile_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_private_profile_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_private_profile_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_security_flags" TO "anon";
GRANT ALL ON TABLE "public"."user_security_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."user_security_flags" TO "service_role";



GRANT ALL ON TABLE "public"."verified_phone_identities" TO "anon";
GRANT ALL ON TABLE "public"."verified_phone_identities" TO "authenticated";
GRANT ALL ON TABLE "public"."verified_phone_identities" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

drop policy "buddy_reviews_select_all" on "public"."buddy_reviews";

drop policy "buddy_reviews_select_public" on "public"."buddy_reviews";


  create policy "buddy_reviews_select_all"
  on "public"."buddy_reviews"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "buddy_reviews_select_public"
  on "public"."buddy_reviews"
  as permissive
  for select
  to anon, authenticated
using (true);


CREATE TRIGGER on_auth_user_created_entitlement AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_entitlement();


