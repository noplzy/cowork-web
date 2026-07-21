--
-- PostgreSQL database dump
--

-- \restrict dNrKL46FGBxkQmZdilLvdaiCl1epTgSaM22dRN9zuc2wJBcoj258rp3FigW72Gm

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";

--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: ai_mode; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."ai_mode" AS ENUM (
    'global-guide',
    'room-personal',
    'room-host'
);


ALTER TYPE "public"."ai_mode" OWNER TO "postgres";

--
-- Name: ai_session_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."ai_session_status" AS ENUM (
    'pending',
    'active',
    'ended',
    'error'
);


ALTER TYPE "public"."ai_session_status" OWNER TO "postgres";

--
-- Name: ai_usage_event_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."ai_usage_event_type" AS ENUM (
    'session_start',
    'session_end',
    'message',
    'host_intervention',
    'tts_start',
    'tts_end',
    'error'
);


ALTER TYPE "public"."ai_usage_event_type" OWNER TO "postgres";

--
-- Name: presence_mode; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."presence_mode" AS ENUM (
    'quiet',
    'audio',
    'mosaic',
    'camera'
);


ALTER TYPE "public"."presence_mode" OWNER TO "postgres";

--
-- Name: room_presence_event_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."room_presence_event_type" AS ENUM (
    'selected',
    'heartbeat',
    'visible',
    'hidden',
    'audio_on',
    'audio_off',
    'video_on',
    'video_off',
    'brb_start',
    'brb_end',
    'extension_confirmed',
    'left'
);


ALTER TYPE "public"."room_presence_event_type" OWNER TO "postgres";

--
-- Name: billing_release_job_lock("text", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."billing_release_job_lock"("p_job_name" "text", "p_locked_by" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_released boolean;
begin
  update public.billing_automation_locks
  set locked_until = now(),
      updated_at = now()
  where job_name = p_job_name
    and locked_by = p_locked_by
  returning true into v_released;

  return coalesce(v_released, false);
end;
$$;


ALTER FUNCTION "public"."billing_release_job_lock"("p_job_name" "text", "p_locked_by" "uuid") OWNER TO "postgres";

--
-- Name: billing_try_acquire_job_lock("text", integer, "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."billing_try_acquire_job_lock"("p_job_name" "text", "p_lock_seconds" integer, "p_locked_by" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_acquired boolean;
begin
  if p_job_name is null or length(trim(p_job_name)) = 0 then
    raise exception 'missing_job_name';
  end if;
  if p_locked_by is null then
    raise exception 'missing_locked_by';
  end if;

  insert into public.billing_automation_locks (job_name, locked_until, locked_by, updated_at)
  values (p_job_name, now() + make_interval(secs => greatest(coalesce(p_lock_seconds, 60), 30)), p_locked_by, now())
  on conflict (job_name) do update
    set locked_until = excluded.locked_until,
        locked_by = excluded.locked_by,
        updated_at = now()
  where public.billing_automation_locks.locked_until <= now()
     or public.billing_automation_locks.locked_by = p_locked_by
  returning public.billing_automation_locks.locked_by = p_locked_by into v_acquired;

  return coalesce(v_acquired, false);
end;
$$;


ALTER FUNCTION "public"."billing_try_acquire_job_lock"("p_job_name" "text", "p_lock_seconds" integer, "p_locked_by" "uuid") OWNER TO "postgres";

--
-- Name: calmco_p3_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."calmco_p3_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."calmco_p3_touch_updated_at"() OWNER TO "postgres";

--
-- Name: calmco_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."calmco_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."calmco_touch_updated_at"() OWNER TO "postgres";

--
-- Name: can_join_room("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: cleanup_rooms_and_schedules(); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: cowork_append_appeal_message("uuid", "uuid", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_append_appeal_message"("p_appeal_id" "uuid", "p_actor_user_id" "uuid", "p_actor_role" "text", "p_body" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_appeal public.appeals%rowtype; v_message public.appeal_messages%rowtype;
begin
  if p_actor_role not in ('user','admin') then raise exception 'Invalid actor role'; end if;
  if p_body is null or char_length(trim(p_body)) < 1 or char_length(p_body) > 6000 then raise exception 'Message must be 1-6000 characters'; end if;
  select * into v_appeal from public.appeals where id = p_appeal_id for update;
  if not found then raise exception 'Appeal not found'; end if;
  if p_actor_role = 'user' and v_appeal.user_id is distinct from p_actor_user_id then raise exception 'Appeal does not belong to this user'; end if;
  if p_actor_role = 'user' and v_appeal.status not in ('open','reviewing') then raise exception 'Appeal is not open for user messages'; end if;
  insert into public.appeal_messages(appeal_id,sender_user_id,sender_role,body,metadata) values(p_appeal_id,p_actor_user_id,p_actor_role,trim(p_body),coalesce(p_metadata,'{}'::jsonb)) returning * into v_message;
  update public.appeals set last_user_message_at = case when p_actor_role='user' then now() else last_user_message_at end, last_admin_message_at = case when p_actor_role='admin' then now() else last_admin_message_at end, version = version + 1 where id = p_appeal_id;
  insert into public.appeal_events(appeal_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata) values(p_appeal_id,p_actor_user_id,p_actor_role,'appeal_message_added',v_appeal.status,v_appeal.status,jsonb_build_object('message_id',v_message.id));
  return jsonb_build_object('message',to_jsonb(v_message));
end;
$$;


ALTER FUNCTION "public"."cowork_append_appeal_message"("p_appeal_id" "uuid", "p_actor_user_id" "uuid", "p_actor_role" "text", "p_body" "text", "p_metadata" "jsonb") OWNER TO "postgres";

--
-- Name: cowork_apply_buddy_payment_v3("uuid", "uuid", "uuid", integer, timestamp with time zone, "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_apply_buddy_payment_v3"("p_payment_order_id" "uuid", "p_booking_id" "uuid", "p_buyer_user_id" "uuid", "p_platform_fee_bps" integer, "p_paid_at" timestamp with time zone, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_booking public.buddy_bookings%rowtype;
  v_order public.payment_orders%rowtype;
  v_application public.buddy_booking_payment_applications%rowtype;
  v_settlement public.buddy_settlements%rowtype;
  v_fee integer;
  v_net integer;
  v_existing boolean := false;
begin
  select * into v_booking from public.buddy_bookings where id = p_booking_id for update;
  if not found then raise exception 'BUDDY_BOOKING_NOT_FOUND'; end if;
  select * into v_order from public.payment_orders where id = p_payment_order_id for update;
  if not found then raise exception 'PAYMENT_ORDER_NOT_FOUND'; end if;
  if v_booking.buyer_user_id is distinct from p_buyer_user_id or v_order.user_id is distinct from p_buyer_user_id then raise exception 'BUDDY_PAYMENT_BUYER_MISMATCH'; end if;
  if v_order.buddy_booking_id is distinct from v_booking.id then raise exception 'BUDDY_PAYMENT_BOOKING_MISMATCH'; end if;
  if v_order.status <> 'paid' then raise exception 'BUDDY_PAYMENT_ORDER_NOT_PAID'; end if;
  if v_order.amount <> v_booking.total_amount_twd then raise exception 'BUDDY_PAYMENT_AMOUNT_MISMATCH'; end if;
  if p_platform_fee_bps < 0 or p_platform_fee_bps > 5000 then raise exception 'INVALID_PLATFORM_FEE_BPS'; end if;

  select * into v_application from public.buddy_booking_payment_applications where booking_id = v_booking.id for update;
  if found and v_application.status = 'applied' then
    select * into v_settlement from public.buddy_settlements where booking_id = v_booking.id;
    return jsonb_build_object('application', to_jsonb(v_application), 'settlement', to_jsonb(v_settlement), 'applied', false);
  end if;

  v_fee := round(v_booking.total_amount_twd * p_platform_fee_bps / 10000.0)::integer;
  v_net := greatest(0, v_booking.total_amount_twd - v_fee);

  insert into public.buddy_booking_payment_applications(
    booking_id,payment_order_id,buyer_user_id,provider_user_id,amount_twd,status,applied_at,metadata
  ) values (
    v_booking.id,v_order.id,v_booking.buyer_user_id,v_booking.provider_user_id,
    v_booking.total_amount_twd,'applied',coalesce(p_paid_at,now()),coalesce(p_metadata,'{}'::jsonb)
  ) on conflict (booking_id) do update set
    payment_order_id=excluded.payment_order_id, amount_twd=excluded.amount_twd,
    status='applied', applied_at=excluded.applied_at, reversed_at=null,
    metadata=public.buddy_booking_payment_applications.metadata || excluded.metadata,
    updated_at=now()
  returning * into v_application;

  insert into public.buddy_settlements(
    booking_id,payment_order_id,buyer_user_id,provider_user_id,status,
    gross_amount_twd,platform_fee_bps,platform_fee_twd,provider_net_twd,metadata
  ) values (
    v_booking.id,v_order.id,v_booking.buyer_user_id,v_booking.provider_user_id,'funds_held',
    v_booking.total_amount_twd,p_platform_fee_bps,v_fee,v_net,coalesce(p_metadata,'{}'::jsonb)
  ) on conflict (booking_id) do update set
    payment_order_id=excluded.payment_order_id,status='funds_held',
    gross_amount_twd=excluded.gross_amount_twd,platform_fee_bps=excluded.platform_fee_bps,
    platform_fee_twd=excluded.platform_fee_twd,provider_net_twd=excluded.provider_net_twd,
    refund_amount_twd=0,hold_reason=null,metadata=public.buddy_settlements.metadata || excluded.metadata,
    updated_at=now()
  returning * into v_settlement;

  update public.buddy_bookings set
    payment_status='paid', payment_order_id=v_order.id, settlement_id=v_settlement.id,
    paid_at=coalesce(p_paid_at,now()), payment_failed_at=null, updated_at=now()
  where id=v_booking.id;

  insert into public.buddy_settlement_events(settlement_id,booking_id,actor_user_id,actor_role,event_type,from_status,to_status,amount_twd,metadata)
  values(v_settlement.id,v_booking.id,v_booking.buyer_user_id,'buyer','payment_applied','awaiting_payment','funds_held',v_booking.total_amount_twd,coalesce(p_metadata,'{}'::jsonb));

  insert into public.billing_ledger(user_id,provider,ledger_type,direction,amount_twd,currency,payment_order_id,buddy_booking_id,description,metadata)
  values(v_booking.buyer_user_id,'ecpay','buddy_payment','credit',v_booking.total_amount_twd,'TWD',v_order.id,v_booking.id,'Buddies 預約付款',jsonb_build_object('settlement_id',v_settlement.id))
  on conflict do nothing;
  insert into public.billing_ledger(user_id,provider,ledger_type,direction,amount_twd,currency,payment_order_id,buddy_booking_id,description,metadata)
  values(v_booking.provider_user_id,'internal','buddy_provider_payable','none',v_net,'TWD',v_order.id,v_booking.id,'Buddies 提供者應付帳款',jsonb_build_object('settlement_id',v_settlement.id,'platform_fee_twd',v_fee))
  on conflict do nothing;

  return jsonb_build_object('application',to_jsonb(v_application),'settlement',to_jsonb(v_settlement),'applied',true);
end;
$$;


ALTER FUNCTION "public"."cowork_apply_buddy_payment_v3"("p_payment_order_id" "uuid", "p_booking_id" "uuid", "p_buyer_user_id" "uuid", "p_platform_fee_bps" integer, "p_paid_at" timestamp with time zone, "p_metadata" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: room_access_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."room_access_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "daily_room_name" "text" NOT NULL,
    "billing_session_key" "text" NOT NULL,
    "duration_minutes" integer NOT NULL,
    "cost_credits" integer DEFAULT 0 NOT NULL,
    "charge_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "charged_at" timestamp with time zone,
    "last_token_issued_at" timestamp with time zone,
    "token_exp" timestamp with time zone,
    "entitlement_source" "text" DEFAULT 'free_credits'::"text" NOT NULL,
    "allowed_by_pair_vip_carry" boolean DEFAULT false NOT NULL,
    "join_confirmed_at" timestamp with time zone,
    "last_presence_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "provider_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "connected_at" timestamp with time zone,
    "disconnected_at" timestamp with time zone,
    "connected_seconds" bigint DEFAULT 0 NOT NULL,
    "visual_seconds" bigint DEFAULT 0 NOT NULL,
    "audio_only_seconds" bigint DEFAULT 0 NOT NULL,
    "screen_share_seconds" bigint DEFAULT 0 NOT NULL,
    "billing_media_class" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "billable_participant_minutes" numeric(14,4) DEFAULT 0 NOT NULL,
    "estimated_provider_cost_usd" numeric(14,6) DEFAULT 0 NOT NULL,
    "usage_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reconciled_at" timestamp with time zone,
    "reconciliation_source" "text",
    "commercial_plan_code" "text",
    "wallet_visual_debited_seconds" bigint DEFAULT 0 NOT NULL,
    "wallet_visual_overage_seconds" bigint DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."room_access_sessions" OWNER TO "postgres";

--
-- Name: cowork_apply_presence_usage("uuid", integer, "text", "text", boolean, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_apply_presence_usage"("p_access_session_id" "uuid", "p_delta_seconds" integer, "p_interval_media_class" "text", "p_current_media_class" "text", "p_screen_share_on" boolean, "p_connected" boolean) RETURNS "public"."room_access_sessions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.room_access_sessions;
  v_delta integer := least(greatest(coalesce(p_delta_seconds, 0), 0), 90);
  v_interval_media text := case
    when p_interval_media_class = 'video' then 'video'
    when p_interval_media_class = 'audio_only' then 'audio_only'
    when p_interval_media_class = 'no_media' then 'no_media'
    else 'unknown'
  end;
  v_current_media text := case
    when p_current_media_class = 'video' then 'video'
    when p_current_media_class = 'audio_only' then 'audio_only'
    when p_current_media_class = 'no_media' then 'no_media'
    else 'unknown'
  end;
begin
  update public.room_access_sessions
  set
    connected_at = case
      when p_connected and connected_at is null then now()
      else connected_at
    end,
    disconnected_at = case
      when p_connected then null
      else now()
    end,
    connected_seconds = connected_seconds + v_delta,
    visual_seconds = visual_seconds + case
      when v_interval_media = 'video' then v_delta
      else 0
    end,
    audio_only_seconds = audio_only_seconds + case
      when v_interval_media in ('audio_only', 'no_media') then v_delta
      else 0
    end,
    screen_share_seconds = screen_share_seconds + case
      when coalesce(p_screen_share_on, false) then v_delta
      else 0
    end,
    billing_media_class = case
      when billing_media_class = 'video'
        or v_interval_media = 'video'
        or v_current_media = 'video'
        then 'video'
      when billing_media_class = 'audio_only'
        or v_interval_media = 'audio_only'
        or v_current_media = 'audio_only'
        then 'audio_only'
      when billing_media_class = 'no_media'
        or v_interval_media = 'no_media'
        or v_current_media = 'no_media'
        then 'no_media'
      else 'unknown'
    end,
    billable_participant_minutes = round(
      ((connected_seconds + v_delta)::numeric / 60.0),
      4
    ),
    usage_status = case when p_connected then 'connected' else 'closed' end,
    updated_at = now()
  where id = p_access_session_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'ROOM_ACCESS_SESSION_NOT_FOUND';
  end if;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."cowork_apply_presence_usage"("p_access_session_id" "uuid", "p_delta_seconds" integer, "p_interval_media_class" "text", "p_current_media_class" "text", "p_screen_share_on" boolean, "p_connected" boolean) OWNER TO "postgres";

--
-- Name: cowork_apply_subscription_payment_v2("uuid", "uuid", "uuid", "text", timestamp with time zone, timestamp with time zone, "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_apply_subscription_payment_v2"("p_payment_order_id" "uuid", "p_user_id" "uuid", "p_subscription_profile_id" "uuid", "p_plan_code" "text", "p_period_start" timestamp with time zone, "p_period_end" timestamp with time zone, "p_source" "text" DEFAULT 'ecpay_recurring_notify_v130'::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_order public.payment_orders%rowtype;
  v_profile public.subscription_profiles%rowtype;
  v_existing public.subscription_payment_applications%rowtype;
  v_entitlement public.user_plan_entitlements%rowtype;
  v_wallet public.user_usage_wallets%rowtype;
  v_event_type text := 'grant';
  v_visual_grant bigint := 0;
  v_extension_grant bigint := 0;
begin
  if p_payment_order_id is null or p_user_id is null or p_subscription_profile_id is null then
    raise exception 'P2_PAYMENT_APPLICATION_IDENTIFIERS_REQUIRED';
  end if;
  if p_plan_code <> 'rooms_unlimited_299' then
    raise exception 'P2_PLAN_BLOCKED_UNTIL_P3';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end <= p_period_start then
    raise exception 'P2_PAYMENT_PERIOD_INVALID';
  end if;

  select *
    into v_existing
  from public.subscription_payment_applications
  where payment_order_id = p_payment_order_id
  limit 1;

  if found then
    return jsonb_build_object(
      'applied', true,
      'idempotent', true,
      'payment_order_id', v_existing.payment_order_id,
      'plan_code', v_existing.plan_code,
      'period_start', v_existing.period_start,
      'period_end', v_existing.period_end
    );
  end if;

  select *
    into v_order
  from public.payment_orders
  where id = p_payment_order_id
  for update;

  if not found then
    raise exception 'P2_PAYMENT_ORDER_NOT_FOUND';
  end if;
  if v_order.user_id is distinct from p_user_id then
    raise exception 'P2_PAYMENT_ORDER_USER_MISMATCH';
  end if;
  if v_order.status <> 'paid' then
    raise exception 'P2_PAYMENT_ORDER_NOT_PAID';
  end if;
  if v_order.plan_code is distinct from p_plan_code then
    raise exception 'P2_PAYMENT_ORDER_PLAN_MISMATCH';
  end if;
  if coalesce(v_order.amount, 0) <> 299 then
    raise exception 'P2_PAYMENT_ORDER_AMOUNT_MISMATCH';
  end if;

  select *
    into v_profile
  from public.subscription_profiles
  where id = p_subscription_profile_id
  for update;

  if not found then
    raise exception 'P2_SUBSCRIPTION_PROFILE_NOT_FOUND';
  end if;
  if v_profile.user_id is distinct from p_user_id then
    raise exception 'P2_SUBSCRIPTION_PROFILE_USER_MISMATCH';
  end if;
  if v_profile.plan_code is distinct from p_plan_code then
    raise exception 'P2_SUBSCRIPTION_PROFILE_PLAN_MISMATCH';
  end if;

  if exists (
    select 1
    from public.user_plan_entitlements
    where user_id = p_user_id
      and plan_code = p_plan_code
  ) then
    v_event_type := 'extend';
  end if;

  insert into public.subscription_payment_applications (
    payment_order_id,
    user_id,
    subscription_profile_id,
    plan_code,
    period_start,
    period_end,
    status,
    metadata
  )
  values (
    p_payment_order_id,
    p_user_id,
    p_subscription_profile_id,
    p_plan_code,
    p_period_start,
    p_period_end,
    'applied',
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('source', p_source)
  );

  insert into public.user_plan_entitlements (
    user_id,
    plan_code,
    status,
    valid_from,
    valid_until,
    auto_renew,
    cancel_at_period_end,
    source_subscription_profile_id,
    source_payment_order_id,
    metadata
  )
  values (
    p_user_id,
    p_plan_code,
    'active',
    p_period_start,
    p_period_end,
    true,
    false,
    p_subscription_profile_id,
    p_payment_order_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('source', p_source)
  )
  on conflict (user_id, plan_code)
  do update set
    status = 'active',
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until,
    auto_renew = true,
    cancel_at_period_end = false,
    source_subscription_profile_id = excluded.source_subscription_profile_id,
    source_payment_order_id = excluded.source_payment_order_id,
    metadata = public.user_plan_entitlements.metadata || excluded.metadata,
    updated_at = now()
  returning * into v_entitlement;

  -- Compatibility projection for existing room/token code while P2 is rolled out.
  insert into public.user_entitlements (user_id, plan, vip_until, updated_at)
  values (p_user_id, p_plan_code, p_period_end, now())
  on conflict (user_id)
  do update set
    plan = excluded.plan,
    vip_until = excluded.vip_until,
    updated_at = now();

  v_visual_grant := 1200 * 60;
  v_extension_grant := 12;

  insert into public.user_usage_wallets (
    user_id,
    plan_code,
    resource_key,
    unit,
    period_start,
    period_end,
    granted_quantity,
    consumed_quantity,
    overage_quantity,
    status,
    source_subscription_profile_id,
    source_payment_order_id,
    metadata
  )
  values (
    p_user_id,
    p_plan_code,
    'visual_seconds',
    'seconds',
    p_period_start,
    p_period_end,
    v_visual_grant,
    0,
    0,
    'active',
    p_subscription_profile_id,
    p_payment_order_id,
    jsonb_build_object('included_minutes', 1200, 'source', p_source)
  )
  on conflict (user_id, plan_code, resource_key, period_start, period_end)
  do update set
    granted_quantity = greatest(public.user_usage_wallets.granted_quantity, excluded.granted_quantity),
    status = 'active',
    source_subscription_profile_id = excluded.source_subscription_profile_id,
    source_payment_order_id = excluded.source_payment_order_id,
    metadata = public.user_usage_wallets.metadata || excluded.metadata,
    updated_at = now()
  returning * into v_wallet;

  insert into public.user_usage_wallet_events (
    wallet_id,
    user_id,
    event_type,
    resource_key,
    delta_quantity,
    balance_after,
    idempotency_key,
    payment_order_id,
    metadata
  )
  values (
    v_wallet.id,
    p_user_id,
    'grant',
    'visual_seconds',
    v_visual_grant,
    greatest(v_wallet.granted_quantity - v_wallet.consumed_quantity, 0),
    'payment:' || p_payment_order_id::text || ':visual_seconds',
    p_payment_order_id,
    jsonb_build_object('plan_code', p_plan_code, 'period_end', p_period_end)
  )
  on conflict (user_id, idempotency_key) do nothing;

  insert into public.user_usage_wallets (
    user_id,
    plan_code,
    resource_key,
    unit,
    period_start,
    period_end,
    granted_quantity,
    consumed_quantity,
    overage_quantity,
    status,
    source_subscription_profile_id,
    source_payment_order_id,
    metadata
  )
  values (
    p_user_id,
    p_plan_code,
    'extension_points',
    'points',
    p_period_start,
    p_period_end,
    v_extension_grant,
    0,
    0,
    'active',
    p_subscription_profile_id,
    p_payment_order_id,
    jsonb_build_object('extension_minutes_per_point', 25, 'source', p_source)
  )
  on conflict (user_id, plan_code, resource_key, period_start, period_end)
  do update set
    granted_quantity = greatest(public.user_usage_wallets.granted_quantity, excluded.granted_quantity),
    status = 'active',
    source_subscription_profile_id = excluded.source_subscription_profile_id,
    source_payment_order_id = excluded.source_payment_order_id,
    metadata = public.user_usage_wallets.metadata || excluded.metadata,
    updated_at = now()
  returning * into v_wallet;

  insert into public.user_usage_wallet_events (
    wallet_id,
    user_id,
    event_type,
    resource_key,
    delta_quantity,
    balance_after,
    idempotency_key,
    payment_order_id,
    metadata
  )
  values (
    v_wallet.id,
    p_user_id,
    'grant',
    'extension_points',
    v_extension_grant,
    greatest(v_wallet.granted_quantity - v_wallet.consumed_quantity, 0),
    'payment:' || p_payment_order_id::text || ':extension_points',
    p_payment_order_id,
    jsonb_build_object('plan_code', p_plan_code, 'period_end', p_period_end)
  )
  on conflict (user_id, idempotency_key) do nothing;

  if not exists (
    select 1
    from public.entitlement_events
    where payment_order_id = p_payment_order_id
      and entitlement_key = 'rooms_access'
      and event_type = v_event_type
  ) then
    insert into public.entitlement_events (
      user_id,
      event_type,
      plan_code,
      entitlement_key,
      quantity,
      valid_from,
      valid_until,
      payment_order_id,
      metadata
    )
    values (
      p_user_id,
      v_event_type,
      p_plan_code,
      'rooms_access',
      1,
      p_period_start,
      p_period_end,
      p_payment_order_id,
      jsonb_build_object(
        'subscription_profile_id', p_subscription_profile_id,
        'source', p_source,
        'build_tag', 'commercial-entitlements-v130-2026-07-20'
      )
    );
  end if;

  update public.subscription_profiles
  set
    status = 'active',
    current_period_start = p_period_start,
    current_period_end = p_period_end,
    next_charge_at = p_period_end,
    commercial_entitlement_status = 'applied',
    entitlement_applied_at = now(),
    updated_at = now()
  where id = p_subscription_profile_id;

  return jsonb_build_object(
    'applied', true,
    'idempotent', false,
    'payment_order_id', p_payment_order_id,
    'subscription_profile_id', p_subscription_profile_id,
    'entitlement_id', v_entitlement.id,
    'plan_code', p_plan_code,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'visual_seconds_granted', v_visual_grant,
    'extension_points_granted', v_extension_grant
  );
exception
  when unique_violation then
    select *
      into v_existing
    from public.subscription_payment_applications
    where payment_order_id = p_payment_order_id
    limit 1;

    if found then
      return jsonb_build_object(
        'applied', true,
        'idempotent', true,
        'payment_order_id', v_existing.payment_order_id,
        'plan_code', v_existing.plan_code,
        'period_start', v_existing.period_start,
        'period_end', v_existing.period_end
      );
    end if;
    raise;
end;
$$;


ALTER FUNCTION "public"."cowork_apply_subscription_payment_v2"("p_payment_order_id" "uuid", "p_user_id" "uuid", "p_subscription_profile_id" "uuid", "p_plan_code" "text", "p_period_start" timestamp with time zone, "p_period_end" timestamp with time zone, "p_source" "text", "p_metadata" "jsonb") OWNER TO "postgres";

--
-- Name: cowork_claim_buddy_room_provision_v3("uuid", "uuid", integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_claim_buddy_room_provision_v3"("p_booking_id" "uuid", "p_user_id" "uuid", "p_early_minutes" integer DEFAULT 15, "p_late_minutes" integer DEFAULT 15) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_booking public.buddy_bookings%rowtype; v_claimed boolean:=false;
begin
  select * into v_booking from public.buddy_bookings where id=p_booking_id for update;
  if not found then raise exception 'BUDDY_BOOKING_NOT_FOUND'; end if;
  if p_user_id is distinct from v_booking.buyer_user_id and p_user_id is distinct from v_booking.provider_user_id then raise exception 'BOOKING_PARTY_REQUIRED'; end if;
  if v_booking.booking_status <> 'accepted' or v_booking.payment_status <> 'paid' then raise exception 'BOOKING_NOT_READY_FOR_ROOM'; end if;
  if now() < v_booking.scheduled_start_at - make_interval(mins=>greatest(0,least(p_early_minutes,60))) then raise exception 'BUDDY_ROOM_TOO_EARLY'; end if;
  if now() > v_booking.scheduled_end_at + make_interval(mins=>greatest(0,least(p_late_minutes,60))) then raise exception 'BUDDY_ROOM_WINDOW_ENDED'; end if;
  if v_booking.linked_room_id is not null and v_booking.room_provision_status='ready' then
    return jsonb_build_object('claimed',false,'ready',true,'booking',to_jsonb(v_booking));
  end if;
  if v_booking.room_provision_status='provisioning' and v_booking.room_provision_claimed_at > now()-interval '2 minutes' then
    return jsonb_build_object('claimed',false,'ready',false,'in_progress',true,'booking',to_jsonb(v_booking));
  end if;
  update public.buddy_bookings set room_provision_status='provisioning',room_provision_claimed_at=now(),room_provision_error=null,updated_at=now() where id=p_booking_id returning * into v_booking;
  v_claimed:=true;
  insert into public.buddy_booking_events(booking_id,actor_user_id,event_type,metadata)
  values(p_booking_id,p_user_id,'fulfillment_room_provision_claimed',jsonb_build_object('claimed_at',v_booking.room_provision_claimed_at));
  return jsonb_build_object('claimed',v_claimed,'ready',false,'booking',to_jsonb(v_booking));
end;
$$;


ALTER FUNCTION "public"."cowork_claim_buddy_room_provision_v3"("p_booking_id" "uuid", "p_user_id" "uuid", "p_early_minutes" integer, "p_late_minutes" integer) OWNER TO "postgres";

--
-- Name: cowork_cleanup_expired_rooms(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_cleanup_expired_rooms"("p_grace_minutes" integer DEFAULT 5, "p_presence_grace_minutes" integer DEFAULT 10) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_room record;
  v_updated integer := 0;
  v_ids uuid[] := array[]::uuid[];
begin
  for v_room in
    select id
    from public.rooms
    where coalesce(status, 'active') = 'active'
      and (
        (scheduled_end_at is not null and scheduled_end_at < now() - make_interval(mins => greatest(coalesce(p_grace_minutes, 5), 1)))
        or (
          scheduled_end_at is null
          and created_at + make_interval(mins => coalesce(duration_minutes, 25) + greatest(coalesce(p_grace_minutes, 5), 1)) < now()
        )
      )
      and (
        last_presence_at is null
        or last_presence_at < now() - make_interval(mins => greatest(coalesce(p_presence_grace_minutes, 10), 1))
      )
    for update
  loop
    update public.rooms
    set status = 'ended',
        ended_at = coalesce(ended_at, now()),
        cleanup_reason = coalesce(cleanup_reason, 'expired_empty_room')
    where id = v_room.id
      and coalesce(status, 'active') = 'active';

    if found then
      v_updated := v_updated + 1;
      v_ids := array_append(v_ids, v_room.id);
    end if;
  end loop;

  if coalesce(array_length(v_ids, 1), 0) > 0 then
    delete from public.room_members
    where room_id = any(v_ids);

    update public.room_access_sessions
    set status = 'ended',
        updated_at = now()
    where room_id = any(v_ids)
      and status = 'active';
  end if;

  return jsonb_build_object('updated', v_updated, 'room_ids', v_ids);
end;
$$;


ALTER FUNCTION "public"."cowork_cleanup_expired_rooms"("p_grace_minutes" integer, "p_presence_grace_minutes" integer) OWNER TO "postgres";

--
-- Name: cowork_close_appeal("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_close_appeal"("p_appeal_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_appeal public.appeals%rowtype; v_from text;
begin
  select * into v_appeal from public.appeals where id=p_appeal_id for update;
  if not found then raise exception 'Appeal not found'; end if;
  if v_appeal.user_id is distinct from p_user_id then raise exception 'Appeal does not belong to this user'; end if;
  if v_appeal.status not in ('open','reviewing') then raise exception 'Appeal cannot be closed from current status'; end if;
  v_from := v_appeal.status;
  update public.appeals set status='closed', closed_at=now(), version=version+1 where id=p_appeal_id returning * into v_appeal;
  insert into public.appeal_events(appeal_id,actor_user_id,actor_role,event_type,from_status,to_status) values(p_appeal_id,p_user_id,'user','appeal_closed_by_user',v_from,'closed');
  return jsonb_build_object('appeal',to_jsonb(v_appeal));
end;
$$;


ALTER FUNCTION "public"."cowork_close_appeal"("p_appeal_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: cowork_confirm_buddy_completion_v3("uuid", "uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_confirm_buddy_completion_v3"("p_booking_id" "uuid", "p_user_id" "uuid", "p_hold_hours" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_booking public.buddy_bookings%rowtype;
  v_settlement public.buddy_settlements%rowtype;
  v_role text;
  v_both boolean;
  v_dispute boolean;
begin
  select * into v_booking from public.buddy_bookings where id=p_booking_id for update;
  if not found then raise exception 'BUDDY_BOOKING_NOT_FOUND'; end if;
  if v_booking.booking_status not in ('accepted','completed') or v_booking.payment_status <> 'paid' then raise exception 'BOOKING_NOT_COMPLETABLE'; end if;
  if now() < v_booking.scheduled_end_at - interval '15 minutes' then raise exception 'BUDDY_COMPLETION_TOO_EARLY'; end if;
  if p_user_id=v_booking.buyer_user_id then
    v_role := 'buyer';
    update public.buddy_bookings set buyer_completed_at=coalesce(buyer_completed_at,now()),updated_at=now() where id=p_booking_id returning * into v_booking;
  elsif p_user_id=v_booking.provider_user_id then
    v_role := 'provider';
    update public.buddy_bookings set provider_completed_at=coalesce(provider_completed_at,now()),updated_at=now() where id=p_booking_id returning * into v_booking;
  else raise exception 'BOOKING_PARTY_REQUIRED'; end if;
  v_both := v_booking.buyer_completed_at is not null and v_booking.provider_completed_at is not null;
  select exists(select 1 from public.buddy_disputes d where d.booking_id=p_booking_id and d.dispute_status in ('open','reviewing')) into v_dispute;
  select * into v_settlement from public.buddy_settlements where booking_id=p_booking_id for update;
  if not found then raise exception 'BUDDY_SETTLEMENT_NOT_FOUND'; end if;
  if v_both then
    update public.buddy_bookings set booking_status='completed',completed_at=coalesce(completed_at,now()),updated_at=now() where id=p_booking_id returning * into v_booking;
    if v_dispute then
      update public.buddy_settlements set status='dispute_hold',available_for_payout_at=null,hold_reason='open_dispute',updated_at=now() where id=v_settlement.id returning * into v_settlement;
    else
      update public.buddy_settlements set status='completed_hold',available_for_payout_at=now() + make_interval(hours=>greatest(0,least(p_hold_hours,720))),hold_reason=null,updated_at=now() where id=v_settlement.id returning * into v_settlement;
    end if;
  end if;
  insert into public.buddy_settlement_events(settlement_id,booking_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata)
  values(v_settlement.id,p_booking_id,p_user_id,v_role,'completion_confirmed',v_settlement.status,v_settlement.status,jsonb_build_object('both_confirmed',v_both,'available_for_payout_at',v_settlement.available_for_payout_at));
  return jsonb_build_object('booking',to_jsonb(v_booking),'settlement',to_jsonb(v_settlement),'both_confirmed',v_both);
end;
$$;


ALTER FUNCTION "public"."cowork_confirm_buddy_completion_v3"("p_booking_id" "uuid", "p_user_id" "uuid", "p_hold_hours" integer) OWNER TO "postgres";

--
-- Name: cowork_consume_usage_wallet_v2("uuid", "text", bigint, "text", "uuid", "uuid", "uuid", boolean, "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_consume_usage_wallet_v2"("p_user_id" "uuid", "p_resource_key" "text", "p_quantity" bigint, "p_idempotency_key" "text", "p_room_id" "uuid" DEFAULT NULL::"uuid", "p_access_session_id" "uuid" DEFAULT NULL::"uuid", "p_payment_order_id" "uuid" DEFAULT NULL::"uuid", "p_allow_overage" boolean DEFAULT false, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_wallet public.user_usage_wallets%rowtype;
  v_existing public.user_usage_wallet_events%rowtype;
  v_remaining bigint;
  v_consumed bigint := 0;
  v_overage bigint := 0;
  v_allowed boolean := false;
  v_event_type text := 'denied';
begin
  if p_user_id is null then
    raise exception 'P2_WALLET_USER_REQUIRED';
  end if;
  if p_resource_key not in ('visual_seconds', 'extension_points') then
    raise exception 'P2_WALLET_RESOURCE_NOT_SUPPORTED';
  end if;
  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'P2_WALLET_QUANTITY_INVALID';
  end if;
  if nullif(trim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'P2_WALLET_IDEMPOTENCY_REQUIRED';
  end if;

  select *
    into v_existing
  from public.user_usage_wallet_events
  where user_id = p_user_id
    and idempotency_key = p_idempotency_key
  limit 1;

  if found then
    return jsonb_build_object(
      'allowed', v_existing.event_type = 'consume',
      'idempotent', true,
      'event_id', v_existing.id,
      'wallet_id', v_existing.wallet_id,
      'resource_key', v_existing.resource_key,
      'consumed_quantity', v_existing.delta_quantity,
      'overage_quantity', v_existing.overage_delta,
      'remaining_quantity', v_existing.balance_after
    );
  end if;

  select w.*
    into v_wallet
  from public.user_usage_wallets w
  join public.user_plan_entitlements e
    on e.user_id = w.user_id
   and e.plan_code = w.plan_code
   and e.status in ('active', 'cancel_pending')
   and e.valid_from <= now()
   and e.valid_until > now()
  where w.user_id = p_user_id
    and w.resource_key = p_resource_key
    and w.status = 'active'
    and w.period_start <= now()
    and w.period_end > now()
  order by
    case w.plan_code
      when 'host_999' then 4
      when 'whole_site_599' then 3
      when 'rooms_unlimited_299' then 2
      else 1
    end desc,
    w.period_end desc
  limit 1
  for update of w;

  if not found then
    insert into public.user_usage_wallet_events (
      wallet_id,
      user_id,
      event_type,
      resource_key,
      delta_quantity,
      overage_delta,
      balance_after,
      idempotency_key,
      payment_order_id,
      room_id,
      access_session_id,
      metadata
    )
    values (
      null,
      p_user_id,
      'denied',
      p_resource_key,
      0,
      0,
      0,
      p_idempotency_key,
      p_payment_order_id,
      p_room_id,
      p_access_session_id,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('reason', 'wallet_not_found')
    )
    returning * into v_existing;

    return jsonb_build_object(
      'allowed', false,
      'idempotent', false,
      'reason', 'wallet_not_found',
      'event_id', v_existing.id,
      'resource_key', p_resource_key,
      'remaining_quantity', 0
    );
  end if;

  v_remaining := greatest(v_wallet.granted_quantity - v_wallet.consumed_quantity, 0);

  if v_remaining >= p_quantity then
    v_allowed := true;
    v_consumed := p_quantity;
    v_event_type := 'consume';
  elsif p_allow_overage then
    v_allowed := false;
    v_consumed := v_remaining;
    v_overage := p_quantity - v_remaining;
    v_event_type := 'overage';
  else
    v_allowed := false;
    v_consumed := 0;
    v_overage := 0;
    v_event_type := 'denied';
  end if;

  update public.user_usage_wallets
  set
    consumed_quantity = consumed_quantity + v_consumed,
    overage_quantity = overage_quantity + v_overage,
    updated_at = now()
  where id = v_wallet.id
  returning * into v_wallet;

  insert into public.user_usage_wallet_events (
    wallet_id,
    user_id,
    event_type,
    resource_key,
    delta_quantity,
    overage_delta,
    balance_after,
    idempotency_key,
    payment_order_id,
    room_id,
    access_session_id,
    metadata
  )
  values (
    v_wallet.id,
    p_user_id,
    v_event_type,
    p_resource_key,
    v_consumed,
    v_overage,
    greatest(v_wallet.granted_quantity - v_wallet.consumed_quantity, 0),
    p_idempotency_key,
    p_payment_order_id,
    p_room_id,
    p_access_session_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_existing;

  return jsonb_build_object(
    'allowed', v_allowed,
    'idempotent', false,
    'event_id', v_existing.id,
    'wallet_id', v_wallet.id,
    'plan_code', v_wallet.plan_code,
    'resource_key', v_wallet.resource_key,
    'consumed_quantity', v_consumed,
    'overage_quantity', v_overage,
    'remaining_quantity', greatest(v_wallet.granted_quantity - v_wallet.consumed_quantity, 0),
    'period_end', v_wallet.period_end
  );
exception
  when unique_violation then
    select *
      into v_existing
    from public.user_usage_wallet_events
    where user_id = p_user_id
      and idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return jsonb_build_object(
        'allowed', v_existing.event_type = 'consume',
        'idempotent', true,
        'event_id', v_existing.id,
        'wallet_id', v_existing.wallet_id,
        'resource_key', v_existing.resource_key,
        'consumed_quantity', v_existing.delta_quantity,
        'overage_quantity', v_existing.overage_delta,
        'remaining_quantity', v_existing.balance_after
      );
    end if;
    raise;
end;
$$;


ALTER FUNCTION "public"."cowork_consume_usage_wallet_v2"("p_user_id" "uuid", "p_resource_key" "text", "p_quantity" bigint, "p_idempotency_key" "text", "p_room_id" "uuid", "p_access_session_id" "uuid", "p_payment_order_id" "uuid", "p_allow_overage" boolean, "p_metadata" "jsonb") OWNER TO "postgres";

--
-- Name: cowork_create_appeal("uuid", "uuid", "uuid", "text", "text", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_create_appeal"("p_user_id" "uuid", "p_moderation_case_id" "uuid", "p_moderation_action_id" "uuid", "p_reason_code" "text", "p_message" "text", "p_requested_outcome" "text", "p_idempotency_key" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_case_id uuid := p_moderation_case_id;
  v_target_user_id uuid;
  v_existing public.appeals%rowtype;
  v_appeal public.appeals%rowtype;
begin
  if p_user_id is null then raise exception 'Missing user'; end if;
  if p_message is null or char_length(trim(p_message)) < 10 or char_length(p_message) > 6000 then raise exception 'Appeal message must be 10-6000 characters'; end if;
  if p_moderation_action_id is null and p_moderation_case_id is null then raise exception 'Appeal requires moderation case or action'; end if;

  if p_moderation_action_id is not null then
    select case_id, target_user_id into v_case_id, v_target_user_id from public.moderation_actions where id = p_moderation_action_id;
    if not found then raise exception 'Moderation action not found'; end if;
    if v_target_user_id is distinct from p_user_id then raise exception 'Moderation action does not target this user'; end if;
    if p_moderation_case_id is not null and p_moderation_case_id is distinct from v_case_id then raise exception 'Moderation case/action mismatch'; end if;
  else
    select target_user_id into v_target_user_id from public.moderation_cases where id = p_moderation_case_id;
    if not found then raise exception 'Moderation case not found'; end if;
    if v_target_user_id is distinct from p_user_id then raise exception 'Moderation case does not target this user'; end if;
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.appeals where user_id = p_user_id and idempotency_key = p_idempotency_key limit 1;
    if found then return jsonb_build_object('appeal', to_jsonb(v_existing), 'created', false); end if;
  end if;

  select * into v_existing from public.appeals
  where user_id = p_user_id and status in ('open','reviewing') and (
    (p_moderation_action_id is not null and moderation_action_id = p_moderation_action_id) or
    (p_moderation_action_id is null and moderation_action_id is null and moderation_case_id = v_case_id)
  ) limit 1;
  if found then return jsonb_build_object('appeal', to_jsonb(v_existing), 'created', false); end if;

  insert into public.appeals(user_id, moderation_case_id, moderation_action_id, status, message, reason_code, requested_outcome, source, idempotency_key, metadata, last_user_message_at)
  values(p_user_id, v_case_id, p_moderation_action_id, 'open', trim(p_message), coalesce(p_reason_code,'other'), nullif(trim(p_requested_outcome),''), 'user', nullif(trim(p_idempotency_key),''), coalesce(p_metadata,'{}'::jsonb), now())
  returning * into v_appeal;

  insert into public.appeal_messages(appeal_id, sender_user_id, sender_role, body, metadata) values(v_appeal.id, p_user_id, 'user', trim(p_message), '{}'::jsonb);
  insert into public.appeal_events(appeal_id, actor_user_id, actor_role, event_type, to_status, metadata) values(v_appeal.id, p_user_id, 'user', 'appeal_created', 'open', jsonb_build_object('reason_code',v_appeal.reason_code));
  return jsonb_build_object('appeal', to_jsonb(v_appeal), 'created', true);
exception when unique_violation then
  select * into v_existing from public.appeals where user_id = p_user_id and ((p_idempotency_key is not null and idempotency_key = p_idempotency_key) or (p_moderation_action_id is not null and moderation_action_id = p_moderation_action_id and status in ('open','reviewing')) or (p_moderation_action_id is null and moderation_action_id is null and moderation_case_id = v_case_id and status in ('open','reviewing'))) order by updated_at desc limit 1;
  if found then return jsonb_build_object('appeal', to_jsonb(v_existing), 'created', false); end if;
  raise;
end;
$$;


ALTER FUNCTION "public"."cowork_create_appeal"("p_user_id" "uuid", "p_moderation_case_id" "uuid", "p_moderation_action_id" "uuid", "p_reason_code" "text", "p_message" "text", "p_requested_outcome" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") OWNER TO "postgres";

--
-- Name: cowork_create_buddy_booking_v3("uuid", "uuid", "uuid", "text", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_create_buddy_booking_v3"("p_buyer_user_id" "uuid", "p_service_id" "uuid", "p_slot_id" "uuid", "p_buyer_note" "text", "p_max_amount_twd" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_service public.buddy_services%rowtype;
  v_slot public.buddy_service_slots%rowtype;
  v_booking public.buddy_bookings%rowtype;
  v_seconds integer;
  v_hours integer;
  v_amount integer;
begin
  if p_buyer_user_id is null then raise exception 'MISSING_BUYER'; end if;
  select * into v_service from public.buddy_services where id = p_service_id for update;
  if not found then raise exception 'BUDDY_SERVICE_NOT_FOUND'; end if;
  select * into v_slot from public.buddy_service_slots where id = p_slot_id for update;
  if not found then raise exception 'BUDDY_SLOT_NOT_FOUND'; end if;
  if v_service.provider_user_id = p_buyer_user_id then raise exception 'CANNOT_BOOK_OWN_SERVICE'; end if;
  if v_service.status <> 'active' or coalesce(v_service.accepts_new_users, true) is not true then raise exception 'SERVICE_NOT_ACTIVE'; end if;
  if v_service.delivery_mode <> 'remote' then raise exception 'P3_REMOTE_ONLY'; end if;
  if not exists (
    select 1 from public.buddy_provider_applications a
    where a.user_id = v_service.provider_user_id and a.application_status = 'approved'
  ) then raise exception 'BUDDY_PROVIDER_NOT_APPROVED'; end if;
  if v_slot.service_id is distinct from v_service.id or v_slot.provider_user_id is distinct from v_service.provider_user_id then raise exception 'SLOT_SERVICE_MISMATCH'; end if;
  if v_slot.slot_status <> 'open' then raise exception 'SLOT_NOT_OPEN'; end if;
  if v_slot.starts_at <= now() then raise exception 'SLOT_IN_PAST'; end if;
  if exists (
    select 1 from public.buddy_bookings b
    where b.slot_id = v_slot.id and b.booking_status in ('pending','accepted')
  ) then raise exception 'SLOT_ALREADY_BOOKED'; end if;
  v_seconds := extract(epoch from (v_slot.ends_at - v_slot.starts_at))::integer;
  if v_seconds <= 0 or mod(v_seconds, 3600) <> 0 then raise exception 'P3_WHOLE_HOURS_REQUIRED'; end if;
  v_hours := v_seconds / 3600;
  if v_hours < 1 or v_hours > 2 then raise exception 'P3_BOOKING_HOURS_LIMIT'; end if;
  v_amount := v_service.price_per_hour_twd * v_hours;
  if v_amount < 100 or v_amount > p_max_amount_twd then raise exception 'BUDDY_BOOKING_AMOUNT_OVER_PILOT_LIMIT'; end if;

  update public.buddy_service_slots set slot_status = 'held', updated_at = now() where id = v_slot.id;
  insert into public.buddy_bookings(
    service_id, slot_id, buyer_user_id, provider_user_id,
    scheduled_start_at, scheduled_end_at, hours_booked, total_amount_twd,
    booking_status, payment_status, buyer_note, payment_due_at
  ) values (
    v_service.id, v_slot.id, p_buyer_user_id, v_service.provider_user_id,
    v_slot.starts_at, v_slot.ends_at, v_hours, v_amount,
    'pending', 'unpaid', nullif(trim(p_buyer_note), ''), now() + interval '30 minutes'
  ) returning * into v_booking;

  insert into public.buddy_booking_events(booking_id, actor_user_id, event_type, metadata)
  values(v_booking.id, p_buyer_user_id, 'commercial_booking_created', jsonb_build_object(
    'amount_twd', v_amount, 'payment_due_at', v_booking.payment_due_at,
    'build_tag', 'buddy-settlement-ledger-v131-2026-07-21'
  ));
  return jsonb_build_object('booking', to_jsonb(v_booking), 'created', true);
end;
$$;


ALTER FUNCTION "public"."cowork_create_buddy_booking_v3"("p_buyer_user_id" "uuid", "p_service_id" "uuid", "p_slot_id" "uuid", "p_buyer_note" "text", "p_max_amount_twd" integer) OWNER TO "postgres";

--
-- Name: cowork_create_buddy_payout_batch_v3("uuid", "uuid", "uuid"[], "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_create_buddy_payout_batch_v3"("p_admin_user_id" "uuid", "p_provider_user_id" "uuid", "p_settlement_ids" "uuid"[], "p_note" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_account public.buddy_payout_accounts%rowtype; v_batch public.buddy_payout_batches%rowtype; v_count integer; v_total integer; v_id uuid;
begin
  if p_settlement_ids is null or cardinality(p_settlement_ids)=0 then raise exception 'NO_SETTLEMENTS_SELECTED'; end if;
  select * into v_account from public.buddy_payout_accounts where provider_user_id=p_provider_user_id and status='verified' for update;
  if not found or v_account.secure_provider_reference is null then raise exception 'VERIFIED_PAYOUT_ACCOUNT_REQUIRED'; end if;
  select count(*),coalesce(sum(provider_net_twd),0) into v_count,v_total from public.buddy_settlements
  where id=any(p_settlement_ids) and provider_user_id=p_provider_user_id and status='releasable';
  if v_count <> cardinality(p_settlement_ids) then raise exception 'SETTLEMENT_SELECTION_NOT_RELEASABLE'; end if;
  insert into public.buddy_payout_batches(provider_user_id,payout_account_id,status,total_items,total_amount_twd,created_by_admin_user_id,note,metadata)
  values(p_provider_user_id,v_account.id,'approved',v_count,v_total,p_admin_user_id,nullif(trim(p_note),''),jsonb_build_object('payout_mode','manual_verified','raw_bank_account_stored',false)) returning * into v_batch;
  foreach v_id in array p_settlement_ids loop
    insert into public.buddy_payout_items(batch_id,settlement_id,provider_user_id,payout_account_id,amount_twd,status)
    select v_batch.id,s.id,s.provider_user_id,v_account.id,s.provider_net_twd,'queued' from public.buddy_settlements s where s.id=v_id;
    update public.buddy_settlements set status='payout_processing',payout_account_id=v_account.id,payout_batch_id=v_batch.id,updated_at=now() where id=v_id;
    insert into public.buddy_settlement_events(settlement_id,booking_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata)
    select s.id,s.booking_id,p_admin_user_id,'admin','payout_batch_created','releasable','payout_processing',jsonb_build_object('batch_id',v_batch.id) from public.buddy_settlements s where s.id=v_id;
  end loop;
  return jsonb_build_object('batch',to_jsonb(v_batch));
end;
$$;


ALTER FUNCTION "public"."cowork_create_buddy_payout_batch_v3"("p_admin_user_id" "uuid", "p_provider_user_id" "uuid", "p_settlement_ids" "uuid"[], "p_note" "text") OWNER TO "postgres";

--
-- Name: cowork_end_room_for_user("uuid", "uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_end_room_for_user"("p_room_id" "uuid", "p_user_id" "uuid", "p_reason" "text" DEFAULT 'user_left'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_room record;
  v_remaining integer := 0;
  v_was_member boolean := false;
begin
  if p_room_id is null or p_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'MISSING_ARGUMENT');
  end if;

  select id, created_by, daily_room_url, status, ended_at
    into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ROOM_NOT_FOUND');
  end if;

  select exists(
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_user_id
  ) into v_was_member;

  if not v_was_member and v_room.created_by <> p_user_id then
    return jsonb_build_object('ok', false, 'code', 'NOT_A_MEMBER');
  end if;

  delete from public.room_members
  where room_id = p_room_id
    and user_id = p_user_id;

  update public.room_access_sessions
  set status = 'ended',
      last_presence_at = null,
      updated_at = now()
  where room_id = p_room_id
    and user_id = p_user_id
    and status = 'active';

  select count(*) into v_remaining
  from public.room_members
  where room_id = p_room_id;

  if v_remaining <= 0 and coalesce(v_room.status, 'active') = 'active' and v_room.ended_at is null then
    update public.rooms
    set status = 'ended',
        ended_at = now(),
        cleanup_reason = coalesce(nullif(trim(p_reason), ''), 'empty_after_leave')
    where id = p_room_id;

    update public.room_access_sessions
    set status = 'ended',
        updated_at = now()
    where room_id = p_room_id
      and status = 'active';

    return jsonb_build_object(
      'ok', true,
      'left', true,
      'room_ended', true,
      'remaining_members', v_remaining,
      'daily_room_url', v_room.daily_room_url
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'left', true,
    'room_ended', false,
    'remaining_members', v_remaining,
    'daily_room_url', v_room.daily_room_url
  );
end;
$$;


ALTER FUNCTION "public"."cowork_end_room_for_user"("p_room_id" "uuid", "p_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";

--
-- Name: cowork_expire_unpaid_buddy_bookings_v3(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_expire_unpaid_buddy_bookings_v3"("p_limit" integer DEFAULT 200) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_row public.buddy_bookings%rowtype; v_count integer:=0;
begin
  for v_row in
    select * from public.buddy_bookings
    where booking_status='pending' and payment_status='unpaid' and payment_due_at is not null and payment_due_at < now()
    order by payment_due_at for update skip locked limit greatest(1,least(p_limit,500))
  loop
    update public.buddy_bookings set booking_status='cancelled',cancelled_at=now(),updated_at=now() where id=v_row.id;
    update public.buddy_service_slots set slot_status='open',updated_at=now() where id=v_row.slot_id and slot_status='held';
    insert into public.buddy_booking_events(booking_id,event_type,metadata) values(v_row.id,'payment_window_expired',jsonb_build_object('payment_due_at',v_row.payment_due_at));
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('expired_count',v_count);
end;
$$;


ALTER FUNCTION "public"."cowork_expire_unpaid_buddy_bookings_v3"("p_limit" integer) OWNER TO "postgres";

--
-- Name: cowork_finalize_room_extension_v2("uuid", "uuid", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_finalize_room_extension_v2"("p_room_id" "uuid", "p_sponsor_user_id" "uuid", "p_extension_window_key" "text", "p_idempotency_key" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_room public.rooms%rowtype;
  v_existing public.room_extension_grants%rowtype;
  v_grant public.room_extension_grants%rowtype;
  v_sponsor_entitled boolean := false;
  v_active_count integer := 0;
  v_missing_count integer := 0;
  v_beneficiaries uuid[] := '{}'::uuid[];
  v_points_required integer := 0;
  v_wallet_result jsonb;
  v_wallet_id uuid;
  v_new_end timestamptz;
  v_requested_end timestamptz;
  v_prior_grants integer := 0;
begin
  if p_room_id is null or p_sponsor_user_id is null then
    raise exception 'P2_EXTENSION_IDENTIFIERS_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_extension_window_key, '')), '') is null then
    raise exception 'P2_EXTENSION_WINDOW_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'P2_EXTENSION_IDEMPOTENCY_REQUIRED';
  end if;

  select *
    into v_existing
  from public.room_extension_grants
  where idempotency_key = p_idempotency_key
     or (room_id = p_room_id and extension_window_key = p_extension_window_key)
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'applied', v_existing.status = 'applied',
      'idempotent', true,
      'grant_id', v_existing.id,
      'room_id', v_existing.room_id,
      'points_consumed', v_existing.points_consumed,
      'new_scheduled_end_at', v_existing.new_scheduled_end_at,
      'beneficiary_user_ids', v_existing.beneficiary_user_ids,
      'reload_required', true
    );
  end if;

  select *
    into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'P2_EXTENSION_ROOM_NOT_FOUND';
  end if;
  if v_room.status in ('ended', 'expired') or v_room.ended_at is not null then
    raise exception 'P2_EXTENSION_ROOM_ENDED';
  end if;
  if v_room.scheduled_end_at is null then
    raise exception 'P2_EXTENSION_ROOM_END_MISSING';
  end if;
  begin
    if left(p_extension_window_key, 4) <> 'end:' then
      raise exception 'P2_EXTENSION_WINDOW_STALE';
    end if;
    v_requested_end := substring(p_extension_window_key from 5)::timestamptz;
  exception
    when others then
      raise exception 'P2_EXTENSION_WINDOW_STALE';
  end;
  if v_requested_end is distinct from v_room.scheduled_end_at then
    raise exception 'P2_EXTENSION_WINDOW_STALE';
  end if;

  if not exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and user_id = p_sponsor_user_id
  ) and v_room.created_by is distinct from p_sponsor_user_id then
    raise exception 'P2_EXTENSION_SPONSOR_NOT_MEMBER';
  end if;

  select count(*)
    into v_prior_grants
  from public.room_extension_grants
  where room_id = p_room_id
    and status = 'applied';

  if v_prior_grants >= 1 then
    raise exception 'P2_EXTENSION_PILOT_LIMIT_REACHED';
  end if;

  select count(*)
    into v_active_count
  from public.room_member_presence_state s
  where s.room_id = p_room_id
    and s.presence_status in ('active', 'hidden', 'brb')
    and s.daily_participant_state = 'joined';

  select count(*)
    into v_missing_count
  from public.room_member_presence_state s
  where s.room_id = p_room_id
    and s.presence_status in ('active', 'hidden', 'brb')
    and s.daily_participant_state = 'joined'
    and not exists (
      select 1
      from public.room_extension_confirmations c
      where c.room_id = p_room_id
        and c.user_id = s.user_id
        and c.extension_window_key = p_extension_window_key
    );

  if v_active_count = 0 then
    raise exception 'P2_EXTENSION_NO_ACTIVE_PARTICIPANTS';
  end if;
  if v_missing_count > 0 then
    raise exception 'P2_EXTENSION_WAITING_FOR_PARTICIPANTS';
  end if;

  select coalesce(array_agg(c.user_id order by c.user_id), '{}'::uuid[])
    into v_beneficiaries
  from public.room_extension_confirmations c
  where c.room_id = p_room_id
    and c.extension_window_key = p_extension_window_key
    and c.decision = 'continue';

  if coalesce(array_length(v_beneficiaries, 1), 0) = 0 then
    raise exception 'P2_EXTENSION_NO_CONTINUE_DECISIONS';
  end if;

  select exists (
    select 1
    from public.user_plan_entitlements e
    where e.user_id = p_sponsor_user_id
      and e.plan_code in ('rooms_unlimited_299', 'whole_site_599', 'host_999')
      and e.status in ('active', 'cancel_pending')
      and e.valid_from <= now()
      and e.valid_until > now()
  ) or exists (
    select 1
    from public.user_entitlements legacy
    where legacy.user_id = p_sponsor_user_id
      and legacy.plan in ('vip', 'vip_month', 'rooms_unlimited_299', 'whole_site_599', 'host_999')
      and (legacy.vip_until is null or legacy.vip_until > now())
  )
  into v_sponsor_entitled;

  if not v_sponsor_entitled then
    raise exception 'P2_EXTENSION_SPONSOR_REQUIRES_ROOMS_ENTITLEMENT';
  end if;

  select count(*)
    into v_points_required
  from unnest(v_beneficiaries) as beneficiary(user_id)
  where not exists (
    select 1
    from public.user_plan_entitlements e
    where e.user_id = beneficiary.user_id
      and e.plan_code in ('rooms_unlimited_299', 'whole_site_599', 'host_999')
      and e.status in ('active', 'cancel_pending')
      and e.valid_from <= now()
      and e.valid_until > now()
  )
  and not exists (
    select 1
    from public.user_entitlements legacy
    where legacy.user_id = beneficiary.user_id
      and legacy.plan in ('vip', 'vip_month', 'rooms_unlimited_299', 'whole_site_599', 'host_999')
      and (legacy.vip_until is null or legacy.vip_until > now())
  );

  if v_points_required > 0 then
    v_wallet_result := public.cowork_consume_usage_wallet_v2(
      p_sponsor_user_id,
      'extension_points',
      v_points_required,
      'extension:' || p_idempotency_key,
      p_room_id,
      null,
      null,
      false,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'beneficiary_user_ids', v_beneficiaries,
        'extension_window_key', p_extension_window_key
      )
    );

    if coalesce((v_wallet_result ->> 'allowed')::boolean, false) is not true then
      raise exception 'P2_EXTENSION_POINTS_INSUFFICIENT';
    end if;

    v_wallet_id := nullif(v_wallet_result ->> 'wallet_id', '')::uuid;
  end if;

  v_new_end := v_room.scheduled_end_at + interval '25 minutes';

  update public.rooms
  set scheduled_end_at = v_new_end
  where id = p_room_id;

  insert into public.room_extension_grants (
    room_id,
    extension_window_key,
    sponsor_user_id,
    sponsor_wallet_id,
    beneficiary_user_ids,
    points_consumed,
    requested_extension_minutes,
    previous_scheduled_end_at,
    new_scheduled_end_at,
    status,
    idempotency_key,
    metadata
  )
  values (
    p_room_id,
    p_extension_window_key,
    p_sponsor_user_id,
    v_wallet_id,
    v_beneficiaries,
    v_points_required,
    25,
    v_room.scheduled_end_at,
    v_new_end,
    'applied',
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'pilot_extension_number', 1,
      'active_participant_count', v_active_count
    )
  )
  returning * into v_grant;

  update public.room_extension_confirmations
  set
    extension_grant_id = v_grant.id,
    finalization_status = 'applied',
    finalized_at = now(),
    sponsor_user_id = p_sponsor_user_id,
    points_consumed = case
      when user_id = any(v_beneficiaries) and not is_rooms_entitled then 1
      else 0
    end,
    new_scheduled_end_at = v_new_end,
    updated_at = now()
  where room_id = p_room_id
    and extension_window_key = p_extension_window_key;

  return jsonb_build_object(
    'applied', true,
    'idempotent', false,
    'grant_id', v_grant.id,
    'room_id', p_room_id,
    'points_consumed', v_points_required,
    'beneficiary_user_ids', v_beneficiaries,
    'previous_scheduled_end_at', v_room.scheduled_end_at,
    'new_scheduled_end_at', v_new_end,
    'reload_required', true,
    'pilot_limit', 'one_25_minute_extension_per_room'
  );
end;
$$;


ALTER FUNCTION "public"."cowork_finalize_room_extension_v2"("p_room_id" "uuid", "p_sponsor_user_id" "uuid", "p_extension_window_key" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") OWNER TO "postgres";

--
-- Name: cowork_finish_buddy_room_provision_v3("uuid", "uuid", "uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_finish_buddy_room_provision_v3"("p_booking_id" "uuid", "p_actor_user_id" "uuid", "p_room_id" "uuid", "p_invite_code" "text", "p_error" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_booking public.buddy_bookings%rowtype;
begin
  select * into v_booking from public.buddy_bookings where id=p_booking_id for update;
  if not found then raise exception 'BUDDY_BOOKING_NOT_FOUND'; end if;
  if p_actor_user_id is distinct from v_booking.buyer_user_id and p_actor_user_id is distinct from v_booking.provider_user_id then raise exception 'BOOKING_PARTY_REQUIRED'; end if;
  if p_room_id is not null then
    update public.buddy_bookings set linked_room_id=p_room_id,linked_room_invite_code=p_invite_code,room_provision_status='ready',room_provision_error=null,updated_at=now() where id=p_booking_id returning * into v_booking;
    insert into public.buddy_booking_events(booking_id,actor_user_id,event_type,metadata)
    values(p_booking_id,p_actor_user_id,'fulfillment_room_ready',jsonb_build_object('room_id',p_room_id));
  else
    update public.buddy_bookings set room_provision_status='failed',room_provision_error=left(coalesce(p_error,'room_provision_failed'),1000),updated_at=now() where id=p_booking_id returning * into v_booking;
    insert into public.buddy_booking_events(booking_id,actor_user_id,event_type,metadata)
    values(p_booking_id,p_actor_user_id,'fulfillment_room_failed',jsonb_build_object('error',p_error));
  end if;
  return to_jsonb(v_booking);
end;
$$;


ALTER FUNCTION "public"."cowork_finish_buddy_room_provision_v3"("p_booking_id" "uuid", "p_actor_user_id" "uuid", "p_room_id" "uuid", "p_invite_code" "text", "p_error" "text") OWNER TO "postgres";

--
-- Name: cowork_hold_buddy_settlement_v3("uuid", "uuid", "text", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_hold_buddy_settlement_v3"("p_booking_id" "uuid", "p_actor_user_id" "uuid", "p_reason" "text", "p_dispute_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_row public.buddy_settlements%rowtype; v_booking public.buddy_bookings%rowtype; v_from text; v_actor_role text;
begin
  select * into v_booking from public.buddy_bookings where id=p_booking_id;
  select * into v_row from public.buddy_settlements where booking_id=p_booking_id for update;
  if not found then raise exception 'BUDDY_SETTLEMENT_NOT_FOUND'; end if;
  if v_row.status in ('refunded','paid_out') then raise exception 'SETTLEMENT_TERMINAL'; end if;
  v_from := v_row.status;
  v_actor_role := case
    when p_actor_user_id is null then 'system'
    when p_actor_user_id = v_booking.buyer_user_id then 'buyer'
    when p_actor_user_id = v_booking.provider_user_id then 'provider'
    else 'admin'
  end;
  update public.buddy_settlements set status='dispute_hold',available_for_payout_at=null,hold_reason=left(coalesce(p_reason,'manual_hold'),500),metadata=metadata||jsonb_build_object('dispute_id',p_dispute_id),updated_at=now() where id=v_row.id returning * into v_row;
  insert into public.buddy_settlement_events(settlement_id,booking_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata)
  values(v_row.id,p_booking_id,p_actor_user_id,v_actor_role,'settlement_held',v_from,'dispute_hold',jsonb_build_object('reason',p_reason,'dispute_id',p_dispute_id));
  return to_jsonb(v_row);
end;
$$;


ALTER FUNCTION "public"."cowork_hold_buddy_settlement_v3"("p_booking_id" "uuid", "p_actor_user_id" "uuid", "p_reason" "text", "p_dispute_id" "uuid") OWNER TO "postgres";

--
-- Name: cowork_join_room_with_capacity("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_join_room_with_capacity"("p_room_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_room record;
  v_member_count integer;
  v_max_size integer;
  v_is_existing boolean := false;
begin
  if p_room_id is null or p_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'MISSING_ARGUMENT');
  end if;

  select id, created_by, mode, max_size, status, scheduled_end_at, ended_at
    into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ROOM_NOT_FOUND');
  end if;

  if coalesce(v_room.status, 'active') <> 'active' or v_room.ended_at is not null then
    return jsonb_build_object('ok', false, 'code', 'ROOM_ENDED');
  end if;

  if v_room.scheduled_end_at is not null and v_room.scheduled_end_at < now() - interval '3 minutes' then
    return jsonb_build_object('ok', false, 'code', 'ROOM_EXPIRED');
  end if;

  select exists(
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_user_id
  ) into v_is_existing;

  if v_is_existing or v_room.created_by = p_user_id then
    return jsonb_build_object('ok', true, 'already_member', true, 'member_count', null);
  end if;

  select count(*) into v_member_count
  from public.room_members
  where room_id = p_room_id;

  v_max_size := case
    when v_room.mode = 'pair' then 2
    else greatest(1, coalesce(v_room.max_size, 4))
  end;

  if v_member_count >= v_max_size then
    return jsonb_build_object(
      'ok', false,
      'code', 'ROOM_FULL',
      'member_count', v_member_count,
      'max_size', v_max_size
    );
  end if;

  insert into public.room_members(room_id, user_id)
  values (p_room_id, p_user_id)
  on conflict (room_id, user_id) do nothing;

  return jsonb_build_object(
    'ok', true,
    'already_member', false,
    'member_count', v_member_count + 1,
    'max_size', v_max_size
  );
end;
$$;


ALTER FUNCTION "public"."cowork_join_room_with_capacity"("p_room_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: cowork_leave_room("uuid", "uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_leave_room"("p_room_id" "uuid", "p_user_id" "uuid", "p_reason" "text" DEFAULT 'user_leave'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_room record;
  v_deleted integer := 0;
  v_remaining integer := 0;
begin
  if p_room_id is null or p_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'MISSING_ARGUMENT');
  end if;

  select id, created_by, daily_room_url, status, ended_at
    into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ROOM_NOT_FOUND');
  end if;

  delete from public.room_members
  where room_id = p_room_id
    and user_id = p_user_id;

  get diagnostics v_deleted = row_count;

  update public.room_access_sessions
  set status = 'ended',
      updated_at = now(),
      last_presence_at = null
  where room_id = p_room_id
    and user_id = p_user_id
    and status = 'active';

  insert into public.room_lifecycle_events(room_id, actor_user_id, event_type, reason, metadata)
  values (
    p_room_id,
    p_user_id,
    'member_left',
    coalesce(nullif(p_reason, ''), 'user_leave'),
    jsonb_build_object('deleted_membership_rows', v_deleted)
  );

  select count(*)
    into v_remaining
  from public.room_members
  where room_id = p_room_id;

  if v_remaining <= 0 and coalesce(v_room.status, 'active') = 'active' and v_room.ended_at is null then
    update public.rooms
    set status = 'ended',
        ended_at = now(),
        last_presence_at = null,
        cleanup_reason = coalesce(cleanup_reason, 'all_members_left')
    where id = p_room_id;

    update public.room_access_sessions
    set status = 'ended',
        updated_at = now(),
        last_presence_at = null
    where room_id = p_room_id
      and status = 'active';

    insert into public.room_lifecycle_events(room_id, actor_user_id, event_type, reason, metadata)
    values (
      p_room_id,
      p_user_id,
      'room_ended',
      'all_members_left',
      jsonb_build_object('remaining_members', v_remaining)
    );

    return jsonb_build_object(
      'ok', true,
      'left', true,
      'room_ended', true,
      'remaining_members', v_remaining,
      'daily_room_url', v_room.daily_room_url
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'left', v_deleted > 0,
    'room_ended', false,
    'remaining_members', v_remaining,
    'daily_room_url', v_room.daily_room_url
  );
end;
$$;


ALTER FUNCTION "public"."cowork_leave_room"("p_room_id" "uuid", "p_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";

--
-- Name: cowork_p0_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_p0_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."cowork_p0_touch_updated_at"() OWNER TO "postgres";

--
-- Name: cowork_p2_refund_reversal_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_p2_refund_reversal_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_result jsonb;
begin
  if new.status = 'refunded'
    and old.status is distinct from new.status
    and new.payment_order_id is not null
  then
    begin
      v_result := public.cowork_reverse_subscription_payment_v2(
        new.payment_order_id,
        new.id,
        new.amount_twd,
        'refund_requests_status_trigger',
        jsonb_build_object('triggered_at', now())
      );

      if v_result ->> 'reason' = 'partial_refund_requires_manual_entitlement_decision' then
        insert into public.reliability_events (
          user_id,
          event_type,
          severity,
          source,
          metadata
        )
        values (
          new.user_id,
          'p2_partial_subscription_refund_requires_manual_entitlement_review',
          'high',
          'p2_refund_trigger',
          jsonb_build_object(
            'refund_request_id', new.id,
            'payment_order_id', new.payment_order_id,
            'result', v_result
          )
        );
      end if;
    exception
      when others then
        begin
          insert into public.reliability_events (
            user_id,
            event_type,
            severity,
            source,
            metadata
          )
          values (
            new.user_id,
            'p2_refund_entitlement_reversal_failed',
            'high',
            'p2_refund_trigger',
            jsonb_build_object(
              'refund_request_id', new.id,
              'payment_order_id', new.payment_order_id,
              'error', sqlerrm
            )
          );
        exception
          when others then
            null;
        end;
    end;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."cowork_p2_refund_reversal_trigger"() OWNER TO "postgres";

--
-- Name: cowork_p2_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_p2_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."cowork_p2_touch_updated_at"() OWNER TO "postgres";

--
-- Name: cowork_p3_refund_reversal_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_p3_refund_reversal_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if new.status='refunded' and old.status is distinct from new.status and new.payment_order_id is not null then
    begin
      perform public.cowork_reverse_buddy_payment_v3(new.payment_order_id,new.id,coalesce(new.amount_twd,0));
    exception when others then
      insert into public.reliability_events(user_id,event_type,severity,source,metadata)
      values(new.user_id,'manual_note','critical','refund_trigger',jsonb_build_object('signal','p3_buddy_refund_reversal_failed','refund_request_id',new.id,'payment_order_id',new.payment_order_id,'error',sqlerrm));
    end;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."cowork_p3_refund_reversal_trigger"() OWNER TO "postgres";

--
-- Name: cowork_promote_buddy_settlements_v3(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_promote_buddy_settlements_v3"("p_limit" integer DEFAULT 200) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_row public.buddy_settlements%rowtype; v_count integer:=0;
begin
  for v_row in
    select * from public.buddy_settlements s
    where s.status='completed_hold' and s.available_for_payout_at <= now()
      and not exists(select 1 from public.buddy_disputes d where d.booking_id=s.booking_id and d.dispute_status in ('open','reviewing'))
    order by s.available_for_payout_at for update skip locked limit greatest(1,least(p_limit,500))
  loop
    update public.buddy_settlements set status='releasable',updated_at=now() where id=v_row.id;
    insert into public.buddy_settlement_events(settlement_id,booking_id,actor_role,event_type,from_status,to_status)
    values(v_row.id,v_row.booking_id,'system','hold_period_completed','completed_hold','releasable');
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('promoted_count',v_count);
end;
$$;


ALTER FUNCTION "public"."cowork_promote_buddy_settlements_v3"("p_limit" integer) OWNER TO "postgres";

--
-- Name: cowork_release_buddy_settlement_v3("uuid", "uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_release_buddy_settlement_v3"("p_booking_id" "uuid", "p_admin_user_id" "uuid", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_row public.buddy_settlements%rowtype; v_booking public.buddy_bookings%rowtype; v_from text;
begin
  select * into v_booking from public.buddy_bookings where id=p_booking_id for update;
  if not found then raise exception 'BUDDY_BOOKING_NOT_FOUND'; end if;
  select * into v_row from public.buddy_settlements where booking_id=p_booking_id for update;
  if not found then raise exception 'BUDDY_SETTLEMENT_NOT_FOUND'; end if;
  if v_booking.booking_status <> 'completed' then raise exception 'BOOKING_NOT_COMPLETED'; end if;
  if exists(select 1 from public.buddy_disputes d where d.booking_id=p_booking_id and d.dispute_status in ('open','reviewing')) then raise exception 'OPEN_DISPUTE_EXISTS'; end if;
  if v_row.status in ('refunded','paid_out','payout_processing') then raise exception 'SETTLEMENT_NOT_RELEASABLE'; end if;
  v_from := v_row.status;
  update public.buddy_settlements set status='releasable',available_for_payout_at=now(),hold_reason=null,metadata=metadata||jsonb_build_object('release_reason',p_reason,'released_by',p_admin_user_id),updated_at=now() where id=v_row.id returning * into v_row;
  insert into public.buddy_settlement_events(settlement_id,booking_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata)
  values(v_row.id,p_booking_id,p_admin_user_id,'admin','settlement_released',v_from,'releasable',jsonb_build_object('reason',p_reason));
  return to_jsonb(v_row);
end;
$$;


ALTER FUNCTION "public"."cowork_release_buddy_settlement_v3"("p_booking_id" "uuid", "p_admin_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";

--
-- Name: cowork_resolve_buddy_dispute_v3("uuid", "uuid", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_resolve_buddy_dispute_v3"("p_dispute_id" "uuid", "p_admin_user_id" "uuid", "p_action" "text", "p_settlement_resolution" "text", "p_admin_note" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_dispute public.buddy_disputes%rowtype;
  v_booking public.buddy_bookings%rowtype;
  v_settlement public.buddy_settlements%rowtype;
  v_refund public.refund_requests%rowtype;
  v_next_dispute text;
  v_next_settlement text;
  v_from_settlement text;
begin
  select * into v_dispute from public.buddy_disputes where id=p_dispute_id for update;
  if not found then raise exception 'BUDDY_DISPUTE_NOT_FOUND'; end if;
  select * into v_booking from public.buddy_bookings where id=v_dispute.booking_id for update;
  if not found then raise exception 'BUDDY_BOOKING_NOT_FOUND'; end if;
  select * into v_settlement from public.buddy_settlements where booking_id=v_booking.id for update;
  if not found then raise exception 'BUDDY_SETTLEMENT_NOT_FOUND'; end if;
  v_from_settlement:=v_settlement.status;

  if p_action='review' then
    v_next_dispute:='reviewing';
    v_next_settlement:='dispute_hold';
  elsif p_action in ('resolve','reject','cancel') then
    v_next_dispute:=case when p_action='resolve' then 'resolved' when p_action='reject' then 'rejected' else 'cancelled' end;
    if p_settlement_resolution='refund' then
      v_next_settlement:='refund_pending';
      select * into v_refund from public.refund_requests
      where payment_order_id=v_booking.payment_order_id and status in ('requested','reviewing','approved','processing','refunded')
      order by created_at desc limit 1;
      if not found then
        insert into public.refund_requests(user_id,payment_order_id,amount_twd,reason_category,reason,status,provider,metadata)
        values(v_booking.buyer_user_id,v_booking.payment_order_id,v_booking.total_amount_twd,'service_issue',coalesce(nullif(trim(p_admin_note),''),'Buddies 爭議全額退款'),'requested','ecpay',jsonb_build_object('buddy_booking_id',v_booking.id,'buddy_dispute_id',v_dispute.id,'admin_user_id',p_admin_user_id))
        returning * into v_refund;
      end if;
    elsif p_settlement_resolution='release' then
      if v_booking.booking_status <> 'completed' then raise exception 'BOOKING_NOT_COMPLETED_FOR_RELEASE'; end if;
      v_next_settlement:='releasable';
    else
      v_next_settlement:='manual_review';
    end if;
  else raise exception 'INVALID_DISPUTE_ACTION'; end if;

  update public.buddy_disputes set dispute_status=v_next_dispute,admin_user_id=p_admin_user_id,
    admin_note=nullif(trim(p_admin_note),''),resolved_at=case when v_next_dispute in ('resolved','rejected','cancelled') then now() else null end,
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('settlement_resolution',coalesce(p_settlement_resolution,'manual_review')),
    updated_at=now() where id=v_dispute.id returning * into v_dispute;
  update public.buddy_bookings set dispute_status=v_next_dispute,updated_at=now() where id=v_booking.id returning * into v_booking;
  update public.buddy_settlements set status=v_next_settlement,
    available_for_payout_at=case when v_next_settlement='releasable' then now() else null end,
    hold_reason=case when v_next_settlement in ('dispute_hold','manual_review','refund_pending') then coalesce(nullif(trim(p_admin_note),''),v_next_settlement) else null end,
    updated_at=now() where id=v_settlement.id returning * into v_settlement;
  insert into public.buddy_booking_events(booking_id,actor_user_id,event_type,metadata)
  values(v_booking.id,p_admin_user_id,'admin_dispute_'||v_next_dispute,jsonb_build_object('dispute_id',v_dispute.id,'settlement_resolution',p_settlement_resolution,'refund_request_id',v_refund.id));
  insert into public.buddy_settlement_events(settlement_id,booking_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata)
  values(v_settlement.id,v_booking.id,p_admin_user_id,'admin','dispute_resolved',v_from_settlement,v_next_settlement,jsonb_build_object('dispute_id',v_dispute.id,'dispute_status',v_next_dispute,'refund_request_id',v_refund.id,'admin_note',p_admin_note));
  return jsonb_build_object('dispute',to_jsonb(v_dispute),'booking',to_jsonb(v_booking),'settlement',to_jsonb(v_settlement),'refund_request',to_jsonb(v_refund));
end;
$$;


ALTER FUNCTION "public"."cowork_resolve_buddy_dispute_v3"("p_dispute_id" "uuid", "p_admin_user_id" "uuid", "p_action" "text", "p_settlement_resolution" "text", "p_admin_note" "text") OWNER TO "postgres";

--
-- Name: cowork_reverse_buddy_payment_v3("uuid", "uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_reverse_buddy_payment_v3"("p_payment_order_id" "uuid", "p_refund_request_id" "uuid", "p_refund_amount_twd" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_row public.buddy_settlements%rowtype; v_app public.buddy_booking_payment_applications%rowtype; v_status text;
begin
  select * into v_row from public.buddy_settlements where payment_order_id=p_payment_order_id for update;
  if not found then return jsonb_build_object('skipped',true,'reason','not_buddy_payment'); end if;
  if v_row.status='refunded' then return jsonb_build_object('skipped',true,'reason','already_refunded','settlement',to_jsonb(v_row)); end if;
  if p_refund_amount_twd < v_row.gross_amount_twd then
    update public.buddy_settlements set status='manual_review',refund_amount_twd=p_refund_amount_twd,hold_reason='partial_refund_requires_manual_allocation',updated_at=now() where id=v_row.id returning * into v_row;
    insert into public.reliability_events(user_id,event_type,severity,source,metadata)
    values(v_row.provider_user_id,'manual_note','high','buddy_settlement',jsonb_build_object('signal','p3_partial_buddy_refund_requires_manual_review','settlement_id',v_row.id,'refund_request_id',p_refund_request_id,'amount_twd',p_refund_amount_twd));
    return jsonb_build_object('manual_review',true,'settlement',to_jsonb(v_row));
  end if;
  v_status := v_row.status;
  if v_row.status='paid_out' then
    update public.buddy_settlements set status='manual_review',refund_amount_twd=p_refund_amount_twd,hold_reason='refund_after_payout_requires_clawback',updated_at=now() where id=v_row.id returning * into v_row;
    insert into public.reliability_events(user_id,event_type,severity,source,metadata)
    values(v_row.provider_user_id,'manual_note','critical','buddy_settlement',jsonb_build_object('signal','p3_buddy_refund_after_payout','settlement_id',v_row.id,'refund_request_id',p_refund_request_id));
    return jsonb_build_object('manual_review',true,'reason','refund_after_payout','settlement',to_jsonb(v_row));
  end if;
  update public.buddy_settlements set status='refunded',refund_amount_twd=p_refund_amount_twd,available_for_payout_at=null,hold_reason=null,metadata=metadata||jsonb_build_object('refund_request_id',p_refund_request_id),updated_at=now() where id=v_row.id returning * into v_row;
  update public.buddy_booking_payment_applications set status='reversed',reversed_at=now(),updated_at=now() where payment_order_id=p_payment_order_id returning * into v_app;
  update public.buddy_bookings set payment_status='refunded',updated_at=now() where id=v_row.booking_id;
  insert into public.buddy_settlement_events(settlement_id,booking_id,actor_role,event_type,from_status,to_status,amount_twd,metadata)
  values(v_row.id,v_row.booking_id,'system','payment_refunded',v_status,'refunded',p_refund_amount_twd,jsonb_build_object('refund_request_id',p_refund_request_id));
  insert into public.billing_ledger(user_id,provider,ledger_type,direction,amount_twd,currency,payment_order_id,buddy_booking_id,description,metadata)
  values(v_row.buyer_user_id,'ecpay','buddy_refund','debit',p_refund_amount_twd,'TWD',p_payment_order_id,v_row.booking_id,'Buddies 預約退款',jsonb_build_object('refund_request_id',p_refund_request_id)) on conflict do nothing;
  insert into public.billing_ledger(user_id,provider,ledger_type,direction,amount_twd,currency,payment_order_id,buddy_booking_id,description,metadata)
  values(v_row.provider_user_id,'internal','buddy_provider_payable_reversal','none',v_row.provider_net_twd,'TWD',p_payment_order_id,v_row.booking_id,'Buddies 提供者應付帳款反轉',jsonb_build_object('refund_request_id',p_refund_request_id)) on conflict do nothing;
  return jsonb_build_object('reversed',true,'settlement',to_jsonb(v_row),'application',to_jsonb(v_app));
end;
$$;


ALTER FUNCTION "public"."cowork_reverse_buddy_payment_v3"("p_payment_order_id" "uuid", "p_refund_request_id" "uuid", "p_refund_amount_twd" integer) OWNER TO "postgres";

--
-- Name: cowork_reverse_subscription_payment_v2("uuid", "uuid", integer, "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_reverse_subscription_payment_v2"("p_payment_order_id" "uuid", "p_refund_request_id" "uuid", "p_refund_amount_twd" integer DEFAULT NULL::integer, "p_source" "text" DEFAULT 'refund_provider_refunded'::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_application public.subscription_payment_applications%rowtype;
  v_order public.payment_orders%rowtype;
  v_wallet public.user_usage_wallets%rowtype;
  v_refund_amount integer;
  v_entitlement_reversed boolean := false;
  v_wallet_count integer := 0;
begin
  if p_payment_order_id is null then
    raise exception 'P2_REFUND_PAYMENT_ORDER_REQUIRED';
  end if;

  select *
    into v_application
  from public.subscription_payment_applications
  where payment_order_id = p_payment_order_id
  for update;

  if not found then
    return jsonb_build_object(
      'reversed', false,
      'idempotent', false,
      'skipped', true,
      'reason', 'payment_has_no_p2_application',
      'payment_order_id', p_payment_order_id
    );
  end if;

  if v_application.status = 'reversed' then
    return jsonb_build_object(
      'reversed', true,
      'idempotent', true,
      'payment_order_id', p_payment_order_id,
      'refund_request_id', v_application.reversal_refund_request_id,
      'plan_code', v_application.plan_code
    );
  end if;

  select *
    into v_order
  from public.payment_orders
  where id = p_payment_order_id
  for update;

  if not found then
    raise exception 'P2_REFUND_PAYMENT_ORDER_NOT_FOUND';
  end if;

  v_refund_amount := coalesce(p_refund_amount_twd, v_order.amount, 0);
  if v_refund_amount < coalesce(v_order.amount, 0) then
    return jsonb_build_object(
      'reversed', false,
      'idempotent', false,
      'skipped', true,
      'reason', 'partial_refund_requires_manual_entitlement_decision',
      'payment_order_id', p_payment_order_id,
      'refund_amount_twd', v_refund_amount,
      'order_amount_twd', v_order.amount
    );
  end if;

  update public.subscription_payment_applications
  set
    status = 'reversed',
    reversed_at = now(),
    reversal_refund_request_id = p_refund_request_id,
    metadata = coalesce(metadata, '{}'::jsonb) ||
      coalesce(p_metadata, '{}'::jsonb) ||
      jsonb_build_object(
        'reversal_source', p_source,
        'refund_amount_twd', v_refund_amount,
        'reversed_at', now()
      )
  where payment_order_id = p_payment_order_id;

  update public.user_plan_entitlements
  set
    status = 'refunded',
    valid_until = greatest(
      valid_from + interval '1 second',
      least(valid_until, now())
    ),
    auto_renew = false,
    cancel_at_period_end = false,
    metadata = coalesce(metadata, '{}'::jsonb) ||
      coalesce(p_metadata, '{}'::jsonb) ||
      jsonb_build_object(
        'refunded_payment_order_id', p_payment_order_id,
        'refund_request_id', p_refund_request_id,
        'reversal_source', p_source
      ),
    updated_at = now()
  where user_id = v_application.user_id
    and plan_code = v_application.plan_code
    and source_payment_order_id = p_payment_order_id;

  get diagnostics v_wallet_count = row_count;
  v_entitlement_reversed := v_wallet_count > 0;
  v_wallet_count := 0;

  for v_wallet in
    select *
    from public.user_usage_wallets
    where source_payment_order_id = p_payment_order_id
      and status <> 'refunded'
    for update
  loop
    update public.user_usage_wallets
    set
      status = 'refunded',
      metadata = coalesce(metadata, '{}'::jsonb) ||
        coalesce(p_metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'refund_request_id', p_refund_request_id,
          'reversal_source', p_source
        ),
      updated_at = now()
    where id = v_wallet.id;

    insert into public.user_usage_wallet_events (
      wallet_id,
      user_id,
      event_type,
      resource_key,
      delta_quantity,
      overage_delta,
      balance_after,
      idempotency_key,
      payment_order_id,
      metadata
    )
    values (
      v_wallet.id,
      v_wallet.user_id,
      'refund',
      v_wallet.resource_key,
      0,
      0,
      0,
      'refund:' || coalesce(p_refund_request_id::text, p_payment_order_id::text) ||
        ':' || v_wallet.id::text,
      p_payment_order_id,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'refund_request_id', p_refund_request_id,
        'plan_code', v_wallet.plan_code,
        'reversal_source', p_source,
        'previous_balance', greatest(
          v_wallet.granted_quantity - v_wallet.consumed_quantity,
          0
        )
      )
    )
    on conflict (user_id, idempotency_key) do nothing;

    v_wallet_count := v_wallet_count + 1;
  end loop;

  if v_entitlement_reversed then
    update public.user_entitlements
    set
      plan = 'free',
      vip_until = null,
      updated_at = now()
    where user_id = v_application.user_id
      and plan = v_application.plan_code
      and (
        vip_until is null or
        abs(extract(epoch from (vip_until - v_application.period_end))) < 5
      );

    update public.subscription_profiles
    set
      status = 'cancelled',
      auto_renew = false,
      next_charge_at = null,
      cancelled_at = coalesce(cancelled_at, now()),
      cancel_reason = coalesce(cancel_reason, 'full_refund'),
      commercial_entitlement_status = 'refunded',
      raw_payload = coalesce(raw_payload, '{}'::jsonb) ||
        jsonb_build_object(
          'p2_refund_reversal', jsonb_build_object(
            'payment_order_id', p_payment_order_id,
            'refund_request_id', p_refund_request_id,
            'reversed_at', now(),
            'source', p_source
          )
        ),
      updated_at = now()
    where id = v_application.subscription_profile_id;

  end if;

  -- Every fully refunded P2 payment gets a revoke event, even when a later
  -- renewal is already the current entitlement. The current projection itself
  -- is only cancelled above when it still points at this payment order.
  if not exists (
    select 1
    from public.entitlement_events
    where payment_order_id = p_payment_order_id
      and event_type = 'revoke'
      and entitlement_key = 'rooms_access'
  ) then
    insert into public.entitlement_events (
      user_id,
      event_type,
      plan_code,
      entitlement_key,
      quantity,
      valid_from,
      valid_until,
      payment_order_id,
      metadata
    )
    values (
      v_application.user_id,
      'revoke',
      v_application.plan_code,
      'rooms_access',
      1,
      v_application.period_start,
      least(
        v_application.period_end,
        greatest(v_application.period_start + interval '1 second', now())
      ),
      p_payment_order_id,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'refund_request_id', p_refund_request_id,
        'source', p_source,
        'current_projection_reversed', v_entitlement_reversed,
        'build_tag', 'commercial-entitlements-v130-2026-07-20'
      )
    );
  end if;

  return jsonb_build_object(
    'reversed', true,
    'idempotent', false,
    'payment_order_id', p_payment_order_id,
    'refund_request_id', p_refund_request_id,
    'plan_code', v_application.plan_code,
    'entitlement_reversed', v_entitlement_reversed,
    'wallets_refunded', v_wallet_count
  );
end;
$$;


ALTER FUNCTION "public"."cowork_reverse_subscription_payment_v2"("p_payment_order_id" "uuid", "p_refund_request_id" "uuid", "p_refund_amount_twd" integer, "p_source" "text", "p_metadata" "jsonb") OWNER TO "postgres";

--
-- Name: cowork_transition_appeal("uuid", "uuid", "text", "text", "text", boolean, "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_transition_appeal"("p_appeal_id" "uuid", "p_admin_user_id" "uuid", "p_to_status" "text", "p_admin_response" "text", "p_decision_reason" "text", "p_create_restore_action" boolean DEFAULT false, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_appeal public.appeals%rowtype; v_from text; v_restore_id uuid;
begin
  select * into v_appeal from public.appeals where id=p_appeal_id for update;
  if not found then raise exception 'Appeal not found'; end if;
  v_from := v_appeal.status;
  if p_to_status not in ('reviewing','accepted','rejected','closed') then raise exception 'Invalid appeal status'; end if;
  if p_to_status is distinct from v_from and not (
    (v_from = 'open' and p_to_status in ('reviewing','closed')) or
    (v_from = 'reviewing' and p_to_status in ('accepted','rejected','closed')) or
    (v_from in ('accepted','rejected','closed') and p_to_status = 'reviewing') or
    (v_from in ('accepted','rejected') and p_to_status = 'closed')
  ) then raise exception 'Invalid appeal status transition from % to %', v_from, p_to_status; end if;
  if p_to_status in ('accepted','rejected') and (p_admin_response is null or char_length(trim(p_admin_response))=0) then raise exception 'Admin response is required'; end if;
  if p_create_restore_action and p_to_status <> 'accepted' then raise exception 'Restore action is only allowed for accepted appeals'; end if;
  if p_create_restore_action then
    if v_appeal.resolution_action_id is not null then
      v_restore_id := v_appeal.resolution_action_id;
    else
      insert into public.moderation_actions(case_id,actor_admin_user_id,target_user_id,action_type,reason,metadata)
      values(v_appeal.moderation_case_id,p_admin_user_id,v_appeal.user_id,'restore',coalesce(nullif(trim(p_admin_response),''),'Appeal accepted'),jsonb_build_object('appeal_id',p_appeal_id,'source','appeal_resolution')) returning id into v_restore_id;
    end if;
  end if;
  update public.appeals set
    status=p_to_status,
    admin_response=coalesce(nullif(trim(p_admin_response),''),admin_response),
    decision=case when p_to_status in ('accepted','rejected') then p_to_status when p_to_status='reviewing' then null else decision end,
    decision_reason=case when p_to_status='reviewing' then null else coalesce(nullif(trim(p_decision_reason),''),decision_reason) end,
    resolution_action_id=coalesce(v_restore_id,resolution_action_id),
    resolved_by_admin_user_id=p_admin_user_id,
    review_started_at=case when p_to_status='reviewing' then coalesce(review_started_at,now()) else review_started_at end,
    resolved_at=case when p_to_status in ('accepted','rejected') then now() when p_to_status='reviewing' then null else resolved_at end,
    closed_at=case when p_to_status='closed' then now() when p_to_status='reviewing' then null else closed_at end,
    last_admin_message_at=case when p_admin_response is not null and char_length(trim(p_admin_response))>0 then now() else last_admin_message_at end,
    metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb),
    version=version+1
  where id=p_appeal_id returning * into v_appeal;
  if p_admin_response is not null and char_length(trim(p_admin_response))>0 then insert into public.appeal_messages(appeal_id,sender_user_id,sender_role,body,metadata) values(p_appeal_id,p_admin_user_id,'admin',trim(p_admin_response),jsonb_build_object('decision_status',p_to_status)); end if;
  insert into public.appeal_events(appeal_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata) values(p_appeal_id,p_admin_user_id,'admin','appeal_status_changed',v_from,p_to_status,jsonb_build_object('restore_action_id',v_restore_id,'decision_reason',p_decision_reason));
  return jsonb_build_object('appeal',to_jsonb(v_appeal),'restore_action_id',v_restore_id);
end;
$$;


ALTER FUNCTION "public"."cowork_transition_appeal"("p_appeal_id" "uuid", "p_admin_user_id" "uuid", "p_to_status" "text", "p_admin_response" "text", "p_decision_reason" "text", "p_create_restore_action" boolean, "p_metadata" "jsonb") OWNER TO "postgres";

--
-- Name: cowork_transition_buddy_booking_v3("uuid", "uuid", "text", "text", "uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_transition_buddy_booking_v3"("p_booking_id" "uuid", "p_actor_user_id" "uuid", "p_action" "text", "p_note" "text", "p_linked_room_id" "uuid", "p_linked_room_invite_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_booking public.buddy_bookings%rowtype;
  v_settlement public.buddy_settlements%rowtype;
  v_from text;
  v_next text;
begin
  select * into v_booking from public.buddy_bookings where id=p_booking_id for update;
  if not found then raise exception 'BUDDY_BOOKING_NOT_FOUND'; end if;
  v_from := v_booking.booking_status;
  if p_action = 'accept' then
    if p_actor_user_id is distinct from v_booking.provider_user_id then raise exception 'ONLY_PROVIDER_CAN_ACCEPT'; end if;
    if v_booking.booking_status <> 'pending' then raise exception 'BOOKING_NOT_PENDING'; end if;
    if v_booking.payment_status <> 'paid' then raise exception 'BUDDY_BOOKING_UNPAID'; end if;
    v_next := 'accepted';
    update public.buddy_bookings set booking_status='accepted',accepted_at=coalesce(accepted_at,now()),provider_note=nullif(trim(p_note),''),linked_room_id=coalesce(p_linked_room_id,linked_room_id),linked_room_invite_code=coalesce(p_linked_room_invite_code,linked_room_invite_code),room_provision_status=case when p_linked_room_id is not null then 'ready' else 'unprovisioned' end,room_provision_error=null,updated_at=now() where id=p_booking_id returning * into v_booking;
    update public.buddy_service_slots set slot_status='booked',updated_at=now() where id=v_booking.slot_id;
    update public.buddy_settlements set status='service_accepted',updated_at=now() where booking_id=p_booking_id and status='funds_held' returning * into v_settlement;
  elsif p_action = 'decline' then
    if p_actor_user_id is distinct from v_booking.provider_user_id then raise exception 'ONLY_PROVIDER_CAN_DECLINE'; end if;
    if v_booking.booking_status <> 'pending' then raise exception 'BOOKING_NOT_PENDING'; end if;
    v_next := 'declined';
    update public.buddy_bookings set booking_status='declined',cancelled_at=now(),provider_note=nullif(trim(p_note),''),updated_at=now() where id=p_booking_id returning * into v_booking;
    update public.buddy_service_slots set slot_status='open',updated_at=now() where id=v_booking.slot_id;
    if v_booking.payment_status='paid' then update public.buddy_settlements set status='refund_pending',hold_reason='provider_declined',updated_at=now() where booking_id=p_booking_id returning * into v_settlement; end if;
  elsif p_action = 'cancel' then
    if p_actor_user_id is distinct from v_booking.buyer_user_id and p_actor_user_id is distinct from v_booking.provider_user_id then raise exception 'BOOKING_PARTY_REQUIRED'; end if;
    if v_booking.booking_status not in ('pending','accepted') then raise exception 'BOOKING_CANNOT_CANCEL'; end if;
    if v_booking.booking_status='accepted' and now() >= v_booking.scheduled_start_at then raise exception 'BUDDY_CANCELLATION_REQUIRES_DISPUTE'; end if;
    v_next := 'cancelled';
    update public.buddy_bookings set booking_status='cancelled',cancelled_at=now(),updated_at=now() where id=p_booking_id returning * into v_booking;
    update public.buddy_service_slots set slot_status='open',updated_at=now() where id=v_booking.slot_id;
    if v_booking.payment_status='paid' then update public.buddy_settlements set status='refund_pending',hold_reason='booking_cancelled',updated_at=now() where booking_id=p_booking_id returning * into v_settlement; end if;
  else
    raise exception 'INVALID_BOOKING_ACTION';
  end if;
  insert into public.buddy_booking_events(booking_id,actor_user_id,event_type,metadata)
  values(p_booking_id,p_actor_user_id,'commercial_booking_'||p_action,jsonb_build_object('from_status',v_from,'to_status',v_next,'note',p_note));
  if v_settlement.id is not null then
    insert into public.buddy_settlement_events(settlement_id,booking_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata)
    values(v_settlement.id,p_booking_id,p_actor_user_id,case when p_actor_user_id=v_booking.provider_user_id then 'provider' else 'buyer' end,'booking_'||p_action,null,v_settlement.status,jsonb_build_object('note',p_note));
  end if;
  return jsonb_build_object('booking',to_jsonb(v_booking),'settlement',to_jsonb(v_settlement));
end;
$$;


ALTER FUNCTION "public"."cowork_transition_buddy_booking_v3"("p_booking_id" "uuid", "p_actor_user_id" "uuid", "p_action" "text", "p_note" "text", "p_linked_room_id" "uuid", "p_linked_room_invite_code" "text") OWNER TO "postgres";

--
-- Name: cowork_transition_buddy_payout_batch_v3("uuid", "uuid", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cowork_transition_buddy_payout_batch_v3"("p_batch_id" "uuid", "p_admin_user_id" "uuid", "p_action" "text", "p_provider_reference" "text", "p_note" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_batch public.buddy_payout_batches%rowtype; v_status text;
begin
  select * into v_batch from public.buddy_payout_batches where id=p_batch_id for update;
  if not found then raise exception 'PAYOUT_BATCH_NOT_FOUND'; end if;
  if p_action='mark_processing' then
    if v_batch.status <> 'approved' then raise exception 'PAYOUT_BATCH_NOT_APPROVED'; end if;
    v_status:='processing';
    update public.buddy_payout_batches set status='processing',processing_at=now(),processed_by_admin_user_id=p_admin_user_id,note=coalesce(nullif(trim(p_note),''),note),updated_at=now() where id=p_batch_id returning * into v_batch;
    update public.buddy_payout_items set status='processing',updated_at=now() where batch_id=p_batch_id and status='queued';
  elsif p_action='complete' then
    if v_batch.status not in ('approved','processing') then raise exception 'PAYOUT_BATCH_NOT_PROCESSABLE'; end if;
    if p_provider_reference is null or char_length(trim(p_provider_reference))<3 then raise exception 'PROVIDER_REFERENCE_REQUIRED'; end if;
    v_status:='completed';
    update public.buddy_payout_batches set status='completed',provider_reference=left(trim(p_provider_reference),180),completed_at=now(),processed_by_admin_user_id=p_admin_user_id,note=coalesce(nullif(trim(p_note),''),note),updated_at=now() where id=p_batch_id returning * into v_batch;
    update public.buddy_payout_items set status='paid',provider_reference=v_batch.provider_reference,processed_at=now(),updated_at=now() where batch_id=p_batch_id;
    update public.buddy_settlements set status='paid_out',paid_out_at=now(),updated_at=now() where payout_batch_id=p_batch_id;
    insert into public.billing_ledger(user_id,provider,ledger_type,direction,amount_twd,currency,payment_order_id,buddy_booking_id,description,metadata)
    select s.provider_user_id,'manual_bank_transfer','buddy_payout','debit',s.provider_net_twd,'TWD',s.payment_order_id,s.booking_id,'Buddies 人工撥款',jsonb_build_object('batch_id',p_batch_id,'provider_reference',v_batch.provider_reference)
    from public.buddy_settlements s where s.payout_batch_id=p_batch_id on conflict do nothing;
    insert into public.buddy_settlement_events(settlement_id,booking_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata)
    select s.id,s.booking_id,p_admin_user_id,'admin','payout_completed','payout_processing','paid_out',jsonb_build_object('batch_id',p_batch_id,'provider_reference',v_batch.provider_reference)
    from public.buddy_settlements s where s.payout_batch_id=p_batch_id;
  elsif p_action in ('cancel','fail') then
    if v_batch.status='completed' then raise exception 'COMPLETED_BATCH_TERMINAL'; end if;
    v_status:=case when p_action='cancel' then 'cancelled' else 'failed' end;
    update public.buddy_payout_batches set status=v_status,error=case when p_action='fail' then coalesce(nullif(trim(p_note),''),'manual_payout_failed') else error end,processed_by_admin_user_id=p_admin_user_id,updated_at=now() where id=p_batch_id returning * into v_batch;
    update public.buddy_payout_items set status=case when p_action='cancel' then 'cancelled' else 'failed' end,error=case when p_action='fail' then p_note else null end,updated_at=now() where batch_id=p_batch_id;
    update public.buddy_settlements set status=case when p_action='cancel' then 'releasable' else 'manual_review' end,payout_batch_id=null,hold_reason=case when p_action='fail' then 'manual_payout_failed' else null end,updated_at=now() where payout_batch_id=p_batch_id;
  else raise exception 'INVALID_PAYOUT_BATCH_ACTION'; end if;
  return jsonb_build_object('batch',to_jsonb(v_batch),'status',v_status);
end;
$$;


ALTER FUNCTION "public"."cowork_transition_buddy_payout_batch_v3"("p_batch_id" "uuid", "p_admin_user_id" "uuid", "p_action" "text", "p_provider_reference" "text", "p_note" "text") OWNER TO "postgres";

--
-- Name: cowork_try_consume_credits("uuid", "date", integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: cowork_try_consume_identity_credits("uuid", "text", "date", integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: ecpay_mark_order_paid("text", "text", timestamp with time zone, "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: generate_room_invite_code(); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: handle_new_user_entitlement(); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: prepare_room_row(); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: prepare_scheduled_room_post(); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: set_current_timestamp_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_current_timestamp_updated_at"() OWNER TO "postgres";

--
-- Name: sync_scheduled_room_post_timing(); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: viewer_is_friend("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: viewer_is_vip("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: abuse_reports; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: admin_audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."admin_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_admin_user_id" "uuid",
    "action_type" "text" NOT NULL,
    "target_type" "text",
    "target_id" "text",
    "ip_address" "inet",
    "user_agent" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_audit_logs" OWNER TO "postgres";

--
-- Name: admin_entity_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."admin_entity_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "admin_user_id" "uuid",
    "body" "text" NOT NULL,
    "pinned" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_entity_notes_target_type_check" CHECK (("target_type" = ANY (ARRAY['user'::"text", 'room'::"text", 'payment_order'::"text", 'subscription'::"text", 'refund_request'::"text", 'support_ticket'::"text", 'moderation_case'::"text", 'host_credit'::"text"])))
);


ALTER TABLE "public"."admin_entity_notes" OWNER TO "postgres";

--
-- Name: admin_permission_presets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."admin_permission_presets" (
    "role_key" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "permissions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_system" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_permission_presets_role_check" CHECK (("role_key" = ANY (ARRAY['owner'::"text", 'ops'::"text", 'support'::"text", 'safety'::"text", 'finance'::"text", 'viewer'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."admin_permission_presets" OWNER TO "postgres";

--
-- Name: admin_role_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."admin_role_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_key" "text" DEFAULT 'ops'::"text" NOT NULL,
    "permissions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "granted_by_admin_user_id" "uuid",
    "revoked_by_admin_user_id" "uuid",
    "note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_role_assignments_role_check" CHECK (("role_key" = ANY (ARRAY['owner'::"text", 'ops'::"text", 'support'::"text", 'safety'::"text", 'finance'::"text", 'viewer'::"text", 'custom'::"text"]))),
    CONSTRAINT "admin_role_assignments_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."admin_role_assignments" OWNER TO "postgres";

--
-- Name: ai_room_host_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ai_room_host_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "payer_user_id" "uuid",
    "ai_mode" "text" NOT NULL,
    "host_credit_budget" integer DEFAULT 0 NOT NULL,
    "host_credit_used" integer DEFAULT 0 NOT NULL,
    "active_seconds" integer DEFAULT 0 NOT NULL,
    "provider" "text",
    "provider_session_id" "text",
    "summary_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "stop_reason" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "sponsor_user_id" "uuid" NOT NULL,
    "host_credit_spent" integer DEFAULT 0 NOT NULL,
    "mode" "text" NOT NULL,
    "status" "text" DEFAULT 'reserved'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_room_host_sessions_ai_mode_check" CHECK (("ai_mode" = ANY (ARRAY['global'::"text", 'room-personal'::"text", 'room-host'::"text"]))),
    CONSTRAINT "ai_room_host_sessions_credit_check" CHECK (("host_credit_spent" >= 0)),
    CONSTRAINT "ai_room_host_sessions_mode_check" CHECK (("mode" = ANY (ARRAY['global'::"text", 'personal'::"text", 'shared_host'::"text"]))),
    CONSTRAINT "ai_room_host_sessions_status_check" CHECK (("status" = ANY (ARRAY['reserved'::"text", 'active'::"text", 'ended'::"text", 'cancelled'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."ai_room_host_sessions" OWNER TO "postgres";

--
-- Name: ai_usage_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ai_usage_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid",
    "session_id" "uuid",
    "ai_mode" "text" NOT NULL,
    "payer_user_id" "uuid",
    "benefited_user_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[] NOT NULL,
    "host_credit_used" integer DEFAULT 0 NOT NULL,
    "shared_host_active_seconds" integer DEFAULT 0 NOT NULL,
    "personal_ai_active_seconds" integer DEFAULT 0 NOT NULL,
    "provider_cost_estimate_twd" numeric(10,4),
    "provider_error_code" "text",
    "stop_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ai_session_id" "uuid",
    "mode" "text" NOT NULL,
    "provider" "text",
    "model" "text",
    "input_tokens" integer,
    "output_tokens" integer,
    "estimated_cost_usd" numeric(12,6),
    CONSTRAINT "ai_usage_events_ai_mode_check" CHECK (("ai_mode" = ANY (ARRAY['global'::"text", 'room-personal'::"text", 'room-host'::"text"]))),
    CONSTRAINT "ai_usage_events_input_tokens_check" CHECK ((("input_tokens" IS NULL) OR ("input_tokens" >= 0))),
    CONSTRAINT "ai_usage_events_mode_check" CHECK (("mode" = ANY (ARRAY['global'::"text", 'personal'::"text", 'shared_host'::"text"]))),
    CONSTRAINT "ai_usage_events_output_tokens_check" CHECK ((("output_tokens" IS NULL) OR ("output_tokens" >= 0)))
);


ALTER TABLE "public"."ai_usage_events" OWNER TO "postgres";

--
-- Name: ai_user_mode_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ai_user_mode_preferences" (
    "user_id" "uuid" NOT NULL,
    "default_global_persona" "text" DEFAULT 'calm-guide'::"text" NOT NULL,
    "default_room_persona" "text" DEFAULT 'calm-companion'::"text" NOT NULL,
    "prefers_shared_host_first" boolean DEFAULT true NOT NULL,
    "default_presence_mode" "public"."presence_mode" DEFAULT 'quiet'::"public"."presence_mode" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_user_mode_preferences" OWNER TO "postgres";

--
-- Name: appeal_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."appeal_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appeal_id" "uuid" NOT NULL,
    "actor_user_id" "uuid",
    "actor_role" "text" DEFAULT 'system'::"text" NOT NULL,
    "event_type" "text" NOT NULL,
    "from_status" "text",
    "to_status" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "appeal_events_actor_role_check" CHECK (("actor_role" = ANY (ARRAY['user'::"text", 'admin'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."appeal_events" OWNER TO "postgres";

--
-- Name: appeal_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."appeal_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appeal_id" "uuid" NOT NULL,
    "sender_user_id" "uuid",
    "sender_role" "text" DEFAULT 'user'::"text" NOT NULL,
    "body" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "appeal_messages_body_len" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 6000))),
    CONSTRAINT "appeal_messages_sender_role_check" CHECK (("sender_role" = ANY (ARRAY['user'::"text", 'admin'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."appeal_messages" OWNER TO "postgres";

--
-- Name: appeals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."appeals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "moderation_case_id" "uuid",
    "moderation_action_id" "uuid",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "message" "text" NOT NULL,
    "admin_response" "text",
    "resolved_by_admin_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "reason_code" "text" DEFAULT 'other'::"text" NOT NULL,
    "requested_outcome" "text",
    "decision" "text",
    "decision_reason" "text",
    "resolution_action_id" "uuid",
    "source" "text" DEFAULT 'user'::"text" NOT NULL,
    "idempotency_key" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "review_started_at" timestamp with time zone,
    "last_user_message_at" timestamp with time zone,
    "last_admin_message_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "version" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "appeals_decision_reason_len" CHECK ((("decision_reason" IS NULL) OR ("char_length"("decision_reason") <= 3000))),
    CONSTRAINT "appeals_message_len" CHECK ((("char_length"("message") >= 1) AND ("char_length"("message") <= 6000))),
    CONSTRAINT "appeals_reason_code_check" CHECK (("reason_code" = ANY (ARRAY['mistaken_identity'::"text", 'missing_context'::"text", 'incorrect_facts'::"text", 'disproportionate_action'::"text", 'resolved_issue'::"text", 'other'::"text"]))),
    CONSTRAINT "appeals_requested_outcome_len" CHECK ((("requested_outcome" IS NULL) OR ("char_length"("requested_outcome") <= 1000))),
    CONSTRAINT "appeals_source_check" CHECK (("source" = ANY (ARRAY['user'::"text", 'admin'::"text", 'system'::"text"]))),
    CONSTRAINT "appeals_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'reviewing'::"text", 'accepted'::"text", 'rejected'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."appeals" OWNER TO "postgres";

--
-- Name: auth_sms_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."auth_sms_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "phone" "text" NOT NULL,
    "otp_flow" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "provider" "text" NOT NULL,
    "status" "text" NOT NULL,
    "provider_message_id" "text",
    "error_code" "text",
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "auth_sms_attempts_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."auth_sms_attempts" OWNER TO "postgres";

--
-- Name: billing_automation_locks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."billing_automation_locks" (
    "job_name" "text" NOT NULL,
    "locked_until" timestamp with time zone NOT NULL,
    "locked_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."billing_automation_locks" OWNER TO "postgres";

--
-- Name: billing_automation_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."billing_automation_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_name" "text" DEFAULT 'billing_automation'::"text" NOT NULL,
    "status" "text" NOT NULL,
    "trigger_source" "text",
    "schedule" "text",
    "user_agent" "text",
    "build_tag" "text",
    "automation_build_tag" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "duration_ms" integer,
    "result" "jsonb",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "billing_automation_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'failed'::"text", 'skipped_locked'::"text"])))
);


ALTER TABLE "public"."billing_automation_runs" OWNER TO "postgres";

--
-- Name: billing_ledger; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."billing_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'internal'::"text" NOT NULL,
    "ledger_type" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "amount_twd" integer DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'TWD'::"text" NOT NULL,
    "payment_order_id" "uuid",
    "buddy_booking_id" "uuid",
    "room_id" "uuid",
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "billing_ledger_currency_check" CHECK (("currency" = 'TWD'::"text")),
    CONSTRAINT "billing_ledger_direction_check" CHECK (("direction" = ANY (ARRAY['debit'::"text", 'credit'::"text", 'none'::"text"]))),
    CONSTRAINT "billing_ledger_type_check" CHECK (("ledger_type" = ANY (ARRAY['payment'::"text", 'refund'::"text", 'entitlement_grant'::"text", 'room_credit'::"text", 'host_credit'::"text", 'buddy_charge'::"text", 'buddy_payout'::"text", 'invoice'::"text", 'manual_adjustment'::"text", 'other'::"text", 'buddy_payment'::"text", 'buddy_provider_payable'::"text", 'buddy_refund'::"text", 'buddy_provider_payable_reversal'::"text"])))
);


ALTER TABLE "public"."billing_ledger" OWNER TO "postgres";

--
-- Name: buddy_booking_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."buddy_booking_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "actor_user_id" "uuid",
    "event_type" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."buddy_booking_events" OWNER TO "postgres";

--
-- Name: buddy_booking_payment_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."buddy_booking_payment_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "payment_order_id" "uuid" NOT NULL,
    "buyer_user_id" "uuid" NOT NULL,
    "provider_user_id" "uuid" NOT NULL,
    "amount_twd" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "applied_at" timestamp with time zone,
    "reversed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "buddy_booking_payment_applications_amount_twd_check" CHECK (("amount_twd" >= 0)),
    CONSTRAINT "buddy_booking_payment_applications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'applied'::"text", 'reversed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."buddy_booking_payment_applications" OWNER TO "postgres";

--
-- Name: buddy_bookings; Type: TABLE; Schema: public; Owner: postgres
--

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
    "accepted_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "buyer_completed_at" timestamp with time zone,
    "provider_completed_at" timestamp with time zone,
    "dispute_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "payment_order_id" "uuid",
    "settlement_id" "uuid",
    "payment_due_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "payment_failed_at" timestamp with time zone,
    "room_provision_status" "text" DEFAULT 'unprovisioned'::"text" NOT NULL,
    "room_provision_claimed_at" timestamp with time zone,
    "room_provision_error" "text",
    CONSTRAINT "buddy_bookings_booking_status_check" CHECK (("booking_status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'cancelled'::"text", 'completed'::"text"]))),
    CONSTRAINT "buddy_bookings_hours_booked_check" CHECK ((("hours_booked" >= 1) AND ("hours_booked" <= 4))),
    CONSTRAINT "buddy_bookings_not_self" CHECK (("buyer_user_id" <> "provider_user_id")),
    CONSTRAINT "buddy_bookings_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'paid'::"text", 'refunded'::"text"]))),
    CONSTRAINT "buddy_bookings_room_provision_status_check" CHECK (("room_provision_status" = ANY (ARRAY['unprovisioned'::"text", 'provisioning'::"text", 'ready'::"text", 'failed'::"text"]))),
    CONSTRAINT "buddy_bookings_total_amount_twd_check" CHECK (("total_amount_twd" > 0))
);


ALTER TABLE "public"."buddy_bookings" OWNER TO "postgres";

--
-- Name: buddy_disputes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."buddy_disputes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "service_id" "uuid",
    "opened_by_user_id" "uuid",
    "counterparty_user_id" "uuid",
    "dispute_status" "text" DEFAULT 'open'::"text" NOT NULL,
    "reason_category" "text" DEFAULT 'other'::"text" NOT NULL,
    "description" "text" NOT NULL,
    "admin_user_id" "uuid",
    "admin_note" "text",
    "resolved_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "buddy_disputes_status_check" CHECK (("dispute_status" = ANY (ARRAY['open'::"text", 'reviewing'::"text", 'resolved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."buddy_disputes" OWNER TO "postgres";

--
-- Name: buddy_payout_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."buddy_payout_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_user_id" "uuid" NOT NULL,
    "payout_method" "text" DEFAULT 'manual_bank_transfer'::"text" NOT NULL,
    "bank_code" "text" NOT NULL,
    "account_last5" "text" NOT NULL,
    "account_holder_name" "text" NOT NULL,
    "status" "text" DEFAULT 'pending_review'::"text" NOT NULL,
    "secure_provider_reference" "text",
    "verified_at" timestamp with time zone,
    "verified_by_admin_user_id" "uuid",
    "reviewer_note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "buddy_payout_accounts_account_holder_name_check" CHECK ((("char_length"("account_holder_name") >= 2) AND ("char_length"("account_holder_name") <= 80))),
    CONSTRAINT "buddy_payout_accounts_account_last5_check" CHECK (("account_last5" ~ '^[0-9]{4,5}$'::"text")),
    CONSTRAINT "buddy_payout_accounts_bank_code_check" CHECK (("bank_code" ~ '^[0-9]{3}$'::"text")),
    CONSTRAINT "buddy_payout_accounts_payout_method_check" CHECK (("payout_method" = 'manual_bank_transfer'::"text")),
    CONSTRAINT "buddy_payout_accounts_secure_provider_reference_check" CHECK ((("secure_provider_reference" IS NULL) OR ("secure_provider_reference" !~ '[0-9]{8,}'::"text"))),
    CONSTRAINT "buddy_payout_accounts_status_check" CHECK (("status" = ANY (ARRAY['pending_review'::"text", 'verified'::"text", 'rejected'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."buddy_payout_accounts" OWNER TO "postgres";

--
-- Name: COLUMN "buddy_payout_accounts"."secure_provider_reference"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."buddy_payout_accounts"."secure_provider_reference" IS 'Reference to external secure record only. Never store raw bank account numbers here.';


--
-- Name: buddy_payout_batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."buddy_payout_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_user_id" "uuid" NOT NULL,
    "payout_account_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'approved'::"text" NOT NULL,
    "currency" "text" DEFAULT 'TWD'::"text" NOT NULL,
    "total_items" integer DEFAULT 0 NOT NULL,
    "total_amount_twd" integer DEFAULT 0 NOT NULL,
    "created_by_admin_user_id" "uuid",
    "processed_by_admin_user_id" "uuid",
    "provider_reference" "text",
    "note" "text",
    "error" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "approved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processing_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "buddy_payout_batches_currency_check" CHECK (("currency" = 'TWD'::"text")),
    CONSTRAINT "buddy_payout_batches_status_check" CHECK (("status" = ANY (ARRAY['approved'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "buddy_payout_batches_total_amount_twd_check" CHECK (("total_amount_twd" >= 0)),
    CONSTRAINT "buddy_payout_batches_total_items_check" CHECK (("total_items" >= 0))
);


ALTER TABLE "public"."buddy_payout_batches" OWNER TO "postgres";

--
-- Name: buddy_payout_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."buddy_payout_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "settlement_id" "uuid" NOT NULL,
    "provider_user_id" "uuid" NOT NULL,
    "payout_account_id" "uuid" NOT NULL,
    "amount_twd" integer NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "provider_reference" "text",
    "processed_at" timestamp with time zone,
    "error" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "buddy_payout_items_amount_twd_check" CHECK (("amount_twd" > 0)),
    CONSTRAINT "buddy_payout_items_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'paid'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."buddy_payout_items" OWNER TO "postgres";

--
-- Name: buddy_provider_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."buddy_provider_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "application_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "display_title" "text",
    "experience_summary" "text",
    "service_boundaries" "text",
    "identity_request_id" "uuid",
    "reviewer_user_id" "uuid",
    "reviewer_note" "text",
    "submitted_at" timestamp with time zone,
    "reviewed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "buddy_provider_applications_status_check" CHECK (("application_status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'needs_more_info'::"text", 'approved'::"text", 'rejected'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."buddy_provider_applications" OWNER TO "postgres";

--
-- Name: buddy_reviews; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: buddy_service_slots; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: buddy_services; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: buddy_settlement_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."buddy_settlement_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "settlement_id" "uuid",
    "booking_id" "uuid" NOT NULL,
    "actor_user_id" "uuid",
    "actor_role" "text" DEFAULT 'system'::"text" NOT NULL,
    "event_type" "text" NOT NULL,
    "from_status" "text",
    "to_status" "text",
    "amount_twd" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "buddy_settlement_events_actor_role_check" CHECK (("actor_role" = ANY (ARRAY['buyer'::"text", 'provider'::"text", 'admin'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."buddy_settlement_events" OWNER TO "postgres";

--
-- Name: buddy_settlements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."buddy_settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "payment_order_id" "uuid" NOT NULL,
    "buyer_user_id" "uuid" NOT NULL,
    "provider_user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'awaiting_payment'::"text" NOT NULL,
    "currency" "text" DEFAULT 'TWD'::"text" NOT NULL,
    "gross_amount_twd" integer DEFAULT 0 NOT NULL,
    "platform_fee_bps" integer DEFAULT 2000 NOT NULL,
    "platform_fee_twd" integer DEFAULT 0 NOT NULL,
    "provider_net_twd" integer DEFAULT 0 NOT NULL,
    "refund_amount_twd" integer DEFAULT 0 NOT NULL,
    "available_for_payout_at" timestamp with time zone,
    "payout_account_id" "uuid",
    "payout_batch_id" "uuid",
    "paid_out_at" timestamp with time zone,
    "hold_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "buddy_settlements_currency_check" CHECK (("currency" = 'TWD'::"text")),
    CONSTRAINT "buddy_settlements_gross_amount_twd_check" CHECK (("gross_amount_twd" >= 0)),
    CONSTRAINT "buddy_settlements_platform_fee_bps_check" CHECK ((("platform_fee_bps" >= 0) AND ("platform_fee_bps" <= 5000))),
    CONSTRAINT "buddy_settlements_platform_fee_twd_check" CHECK (("platform_fee_twd" >= 0)),
    CONSTRAINT "buddy_settlements_provider_net_twd_check" CHECK (("provider_net_twd" >= 0)),
    CONSTRAINT "buddy_settlements_refund_amount_twd_check" CHECK (("refund_amount_twd" >= 0)),
    CONSTRAINT "buddy_settlements_status_check" CHECK (("status" = ANY (ARRAY['awaiting_payment'::"text", 'funds_held'::"text", 'service_accepted'::"text", 'completed_hold'::"text", 'releasable'::"text", 'dispute_hold'::"text", 'refund_pending'::"text", 'refunded'::"text", 'payout_processing'::"text", 'paid_out'::"text", 'manual_review'::"text"])))
);


ALTER TABLE "public"."buddy_settlements" OWNER TO "postgres";

--
-- Name: TABLE "buddy_settlements"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."buddy_settlements" IS 'Internal Buddies payable/hold ledger. Not legal escrow or trust custody.';


--
-- Name: cowork_identity_monthly_usage; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: cowork_monthly_usage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."cowork_monthly_usage" (
    "user_id" "uuid" NOT NULL,
    "month_start" "date" NOT NULL,
    "credits_used" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cowork_monthly_usage" OWNER TO "postgres";

--
-- Name: ecpay_invoice_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ecpay_invoice_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_event_id" "uuid",
    "payment_order_id" "uuid",
    "user_id" "uuid",
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider_invoice_no" "text",
    "provider_random_number" "text",
    "provider_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_error" "text",
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "refund_request_id" "uuid",
    "action_type" "text" DEFAULT 'issue'::"text" NOT NULL,
    "provider_task_id" "text",
    CONSTRAINT "ecpay_invoice_tasks_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'issued'::"text", 'failed'::"text", 'manual_required'::"text", 'voided'::"text", 'allowance_issued'::"text", 'completed'::"text", 'skipped'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."ecpay_invoice_tasks" OWNER TO "postgres";

--
-- Name: ecpay_refund_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ecpay_refund_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "refund_request_id" "uuid",
    "payment_order_id" "uuid",
    "user_id" "uuid",
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider_refund_id" "text",
    "provider_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_error" "text",
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider_task_id" "text",
    CONSTRAINT "ecpay_refund_tasks_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'refunded'::"text", 'manual_required'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."ecpay_refund_tasks" OWNER TO "postgres";

--
-- Name: ecpay_subscription_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ecpay_subscription_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subscription_profile_id" "uuid",
    "user_id" "uuid",
    "action_type" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider_task_id" "text",
    "provider_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_error" "text",
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ecpay_subscription_tasks_action_check" CHECK (("action_type" = ANY (ARRAY['create_profile'::"text", 'cancel_profile'::"text", 'verify_profile'::"text", 'manual_note'::"text"]))),
    CONSTRAINT "ecpay_subscription_tasks_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'submitted'::"text", 'completed'::"text", 'manual_required'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."ecpay_subscription_tasks" OWNER TO "postgres";

--
-- Name: entitlement_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."entitlement_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "plan_code" "text",
    "entitlement_key" "text" DEFAULT 'vip'::"text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "valid_from" timestamp with time zone,
    "valid_until" timestamp with time zone,
    "payment_order_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "entitlement_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['grant'::"text", 'extend'::"text", 'revoke'::"text", 'expire'::"text", 'manual_adjustment'::"text", 'sync'::"text"])))
);


ALTER TABLE "public"."entitlement_events" OWNER TO "postgres";

--
-- Name: friend_requests; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: friendships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."friendships" (
    "user_low" "uuid" NOT NULL,
    "user_high" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "friendships_ordered_pair" CHECK (("user_low" < "user_high"))
);


ALTER TABLE "public"."friendships" OWNER TO "postgres";

--
-- Name: identity_verification_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."identity_verification_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "request_type" "text" DEFAULT 'manual_review'::"text" NOT NULL,
    "legal_name" "text",
    "birth_year" integer,
    "document_type" "text",
    "document_last4" "text",
    "review_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewer_user_id" "uuid",
    "reviewer_note" "text",
    "user_note" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "identity_verification_requests_status_check" CHECK (("review_status" = ANY (ARRAY['pending'::"text", 'needs_more_info'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."identity_verification_requests" OWNER TO "postgres";

--
-- Name: invoice_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."invoice_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "payment_order_id" "uuid",
    "provider" "text" DEFAULT 'ecpay_invoice'::"text" NOT NULL,
    "event_type" "text" NOT NULL,
    "invoice_number" "text",
    "invoice_random_number" "text",
    "issued_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoice_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['requested'::"text", 'issued'::"text", 'failed'::"text", 'manual_note'::"text", 'manual_required'::"text", 'void_or_allowance_required'::"text", 'voided'::"text", 'allowance'::"text", 'allowance_issued'::"text", 'void_or_allowance_completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."invoice_events" OWNER TO "postgres";

--
-- Name: moderation_actions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."moderation_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "actor_admin_user_id" "uuid",
    "target_user_id" "uuid",
    "action_type" "text" NOT NULL,
    "reason" "text",
    "starts_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "moderation_actions_action_type_check" CHECK (("action_type" = ANY (ARRAY['warn'::"text", 'room_remove'::"text", 'content_hide'::"text", 'restrict_room_create'::"text", 'restrict_buddies'::"text", 'suspend'::"text", 'ban'::"text", 'restore'::"text", 'note'::"text"])))
);


ALTER TABLE "public"."moderation_actions" OWNER TO "postgres";

--
-- Name: moderation_cases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."moderation_cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_report_id" "uuid",
    "target_type" "text" NOT NULL,
    "target_user_id" "uuid",
    "target_room_id" "uuid",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "severity" "text" DEFAULT 'normal'::"text" NOT NULL,
    "summary" "text",
    "assigned_admin_user_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    CONSTRAINT "moderation_cases_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "moderation_cases_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'investigating'::"text", 'action_required'::"text", 'actioned'::"text", 'dismissed'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."moderation_cases" OWNER TO "postgres";

--
-- Name: notification_delivery_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."notification_delivery_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_id" "uuid",
    "channel" "text" NOT NULL,
    "status" "text" NOT NULL,
    "provider" "text",
    "provider_message_id" "text",
    "provider_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error_message" "text",
    "attempted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_delivery_attempts_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'sent'::"text", 'failed'::"text", 'manual_required'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."notification_delivery_attempts" OWNER TO "postgres";

--
-- Name: notification_outbox; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."notification_outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "channel" "text" NOT NULL,
    "recipient" "text",
    "template_key" "text" NOT NULL,
    "subject" "text",
    "body" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "target_type" "text",
    "target_id" "text",
    "dedupe_key" "text",
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "provider" "text",
    "provider_message_id" "text",
    "provider_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_error" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_outbox_channel_check" CHECK (("channel" = ANY (ARRAY['in_app'::"text", 'email'::"text", 'sms'::"text", 'line'::"text", 'telegram'::"text", 'webhook'::"text"]))),
    CONSTRAINT "notification_outbox_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "notification_outbox_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'sent'::"text", 'read'::"text", 'dismissed'::"text", 'manual_required'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."notification_outbox" OWNER TO "postgres";

--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "user_id" "uuid" NOT NULL,
    "in_app_enabled" boolean DEFAULT true NOT NULL,
    "email_enabled" boolean DEFAULT true NOT NULL,
    "sms_enabled" boolean DEFAULT false NOT NULL,
    "line_enabled" boolean DEFAULT false NOT NULL,
    "telegram_enabled" boolean DEFAULT false NOT NULL,
    "support_updates" boolean DEFAULT true NOT NULL,
    "billing_updates" boolean DEFAULT true NOT NULL,
    "safety_updates" boolean DEFAULT true NOT NULL,
    "room_updates" boolean DEFAULT true NOT NULL,
    "marketing_updates" boolean DEFAULT false NOT NULL,
    "quiet_hours_enabled" boolean DEFAULT false NOT NULL,
    "quiet_hours_start" "text",
    "quiet_hours_end" "text",
    "locale" "text" DEFAULT 'zh-TW'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";

--
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."notification_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_key" "text" NOT NULL,
    "category" "text" DEFAULT 'system'::"text" NOT NULL,
    "channel" "text" DEFAULT 'in_app'::"text" NOT NULL,
    "locale" "text" DEFAULT 'zh-TW'::"text" NOT NULL,
    "subject_template" "text",
    "body_template" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "required_variables" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_templates_category_check" CHECK (("category" = ANY (ARRAY['support'::"text", 'billing'::"text", 'safety'::"text", 'room'::"text", 'ai'::"text", 'system'::"text", 'marketing'::"text"]))),
    CONSTRAINT "notification_templates_channel_check" CHECK (("channel" = ANY (ARRAY['in_app'::"text", 'email'::"text", 'sms'::"text", 'line'::"text", 'telegram'::"text", 'webhook'::"text"])))
);


ALTER TABLE "public"."notification_templates" OWNER TO "postgres";

--
-- Name: ops_action_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ops_action_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "severity" "text" DEFAULT 'normal'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "assigned_admin_user_id" "uuid",
    "due_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "resolved_by_admin_user_id" "uuid",
    "resolution_note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ops_action_items_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text", 'critical'::"text"]))),
    CONSTRAINT "ops_action_items_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'waiting'::"text", 'resolved'::"text", 'dismissed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."ops_action_items" OWNER TO "postgres";

--
-- Name: payment_events; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: payment_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS "public"."payment_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."payment_events_id_seq" OWNER TO "postgres";

--
-- Name: payment_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."payment_events_id_seq" OWNED BY "public"."payment_events"."id";


--
-- Name: payment_orders; Type: TABLE; Schema: public; Owner: postgres
--

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
    "invoice_preference" "jsonb",
    "buddy_booking_id" "uuid",
    CONSTRAINT "payment_orders_amount_check" CHECK (("amount" > 0)),
    CONSTRAINT "payment_orders_currency_check" CHECK (("currency" = 'TWD'::"text")),
    CONSTRAINT "payment_orders_plan_code_check" CHECK (("plan_code" = ANY (ARRAY['vip_month'::"text", 'companion_basic_299'::"text", 'companion_regular_599'::"text", 'host_islander_1299'::"text"]))),
    CONSTRAINT "payment_orders_provider_check" CHECK (("provider" = ANY (ARRAY['ecpay'::"text", 'ecpay_recurring'::"text", 'internal'::"text"]))),
    CONSTRAINT "payment_orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'cancelled'::"text", 'expired'::"text"]))),
    CONSTRAINT "payment_orders_vip_days_check" CHECK ((("vip_days" > 0) AND ("vip_days" <= 366)))
);


ALTER TABLE "public"."payment_orders" OWNER TO "postgres";

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

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
    "public_profile_enabled" boolean DEFAULT true NOT NULL,
    "profile_visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "public_contact_note" "text",
    CONSTRAINT "profiles_handle_format" CHECK (("handle" ~ '^[a-z0-9._-]{3,30}$'::"text")),
    CONSTRAINT "profiles_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'members'::"text", 'friends'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";

--
-- Name: refund_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."refund_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "refund_request_id" "uuid" NOT NULL,
    "actor_user_id" "uuid",
    "actor_role" "text" DEFAULT 'system'::"text" NOT NULL,
    "event_type" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "refund_events_actor_role_check" CHECK (("actor_role" = ANY (ARRAY['user'::"text", 'admin'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."refund_events" OWNER TO "postgres";

--
-- Name: refund_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."refund_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "payment_order_id" "uuid",
    "support_ticket_id" "uuid",
    "amount_twd" integer,
    "reason_category" "text" DEFAULT 'other'::"text" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "provider" "text" DEFAULT 'ecpay'::"text" NOT NULL,
    "provider_refund_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_by_admin_user_id" "uuid",
    "admin_note" "text",
    CONSTRAINT "refund_requests_reason_category_check" CHECK (("reason_category" = ANY (ARRAY['duplicate_payment'::"text", 'service_issue'::"text", 'accidental_purchase'::"text", 'fraud'::"text", 'billing_error'::"text", 'other'::"text"]))),
    CONSTRAINT "refund_requests_reason_len" CHECK ((("char_length"("reason") >= 1) AND ("char_length"("reason") <= 6000))),
    CONSTRAINT "refund_requests_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'reviewing'::"text", 'approved'::"text", 'rejected'::"text", 'processing'::"text", 'refunded'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."refund_requests" OWNER TO "postgres";

--
-- Name: reliability_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."reliability_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "room_id" "uuid",
    "event_type" "text" NOT NULL,
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "source" "text" DEFAULT 'system'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reliability_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['no_show'::"text", 'late_join'::"text", 'early_leave'::"text", 'extension_no_response'::"text", 'disconnect'::"text", 'brb_overrun'::"text", 'report_received'::"text", 'room_cleanup'::"text", 'daily_delete_failed'::"text", 'daily_delete_success'::"text", 'manual_note'::"text"])))
);


ALTER TABLE "public"."reliability_events" OWNER TO "postgres";

--
-- Name: room_extension_confirmations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."room_extension_confirmations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "access_session_id" "uuid",
    "extension_window_key" "text" NOT NULL,
    "decision" "text" NOT NULL,
    "requested_extension_minutes" integer DEFAULT 25 NOT NULL,
    "is_rooms_entitled" boolean DEFAULT false NOT NULL,
    "sponsor_points_required" integer DEFAULT 0 NOT NULL,
    "current_scheduled_end_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "extension_grant_id" "uuid",
    "finalization_status" "text",
    "finalized_at" timestamp with time zone,
    "sponsor_user_id" "uuid",
    "points_consumed" integer DEFAULT 0 NOT NULL,
    "new_scheduled_end_at" timestamp with time zone,
    CONSTRAINT "room_extension_confirmations_decision_check" CHECK (("decision" = ANY (ARRAY['continue'::"text", 'leave'::"text"]))),
    CONSTRAINT "room_extension_confirmations_minutes_check" CHECK (("requested_extension_minutes" = 25)),
    CONSTRAINT "room_extension_confirmations_points_check" CHECK (("sponsor_points_required" >= 0))
);


ALTER TABLE "public"."room_extension_confirmations" OWNER TO "postgres";

--
-- Name: TABLE "room_extension_confirmations"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."room_extension_confirmations" IS 'P0 extension confirmation only. Commercial point consumption/final extension remains server-gated and must not be inferred from this table alone.';


--
-- Name: room_extension_grants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."room_extension_grants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "extension_window_key" "text" NOT NULL,
    "sponsor_user_id" "uuid" NOT NULL,
    "sponsor_wallet_id" "uuid",
    "beneficiary_user_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "points_consumed" integer DEFAULT 0 NOT NULL,
    "requested_extension_minutes" integer DEFAULT 25 NOT NULL,
    "previous_scheduled_end_at" timestamp with time zone NOT NULL,
    "new_scheduled_end_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'applied'::"text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_extension_grants_minutes_check" CHECK (("requested_extension_minutes" = 25)),
    CONSTRAINT "room_extension_grants_period_check" CHECK (("new_scheduled_end_at" > "previous_scheduled_end_at")),
    CONSTRAINT "room_extension_grants_points_check" CHECK (("points_consumed" >= 0)),
    CONSTRAINT "room_extension_grants_status_check" CHECK (("status" = ANY (ARRAY['applied'::"text", 'reversed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."room_extension_grants" OWNER TO "postgres";

--
-- Name: TABLE "room_extension_grants"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."room_extension_grants" IS 'P2 server-authoritative room extension result. P2 pilot allows one 25-minute commercial extension per room.';


--
-- Name: room_lifecycle_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."room_lifecycle_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid",
    "actor_user_id" "uuid",
    "event_type" "text" NOT NULL,
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."room_lifecycle_events" OWNER TO "postgres";

--
-- Name: room_member_presence_state; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."room_member_presence_state" (
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "access_session_id" "uuid",
    "presence_mode" "text" DEFAULT 'quiet'::"text" NOT NULL,
    "presence_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "last_event_type" "text" DEFAULT 'selected'::"text" NOT NULL,
    "last_heartbeat_at" timestamp with time zone,
    "last_visible_at" timestamp with time zone,
    "last_hidden_at" timestamp with time zone,
    "audio_track_state" "text" DEFAULT 'off'::"text" NOT NULL,
    "video_track_state" "text" DEFAULT 'off'::"text" NOT NULL,
    "screen_track_state" "text" DEFAULT 'off'::"text" NOT NULL,
    "daily_participant_state" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "billing_media_class" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "brb_started_at" timestamp with time zone,
    "brb_until" timestamp with time zone,
    "brb_returned_at" timestamp with time zone,
    "extension_confirmed_at" timestamp with time zone,
    "last_presence_at" timestamp with time zone,
    "connected_at" timestamp with time zone,
    "disconnected_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_member_presence_state_daily_check" CHECK (("daily_participant_state" = ANY (ARRAY['unknown'::"text", 'joining'::"text", 'joined'::"text", 'left'::"text", 'error'::"text"]))),
    CONSTRAINT "room_member_presence_state_media_check" CHECK (("billing_media_class" = ANY (ARRAY['unknown'::"text", 'no_media'::"text", 'audio_only'::"text", 'video'::"text"]))),
    CONSTRAINT "room_member_presence_state_mode_check" CHECK (("presence_mode" = ANY (ARRAY['quiet'::"text", 'audio'::"text", 'mosaic'::"text", 'camera'::"text"]))),
    CONSTRAINT "room_member_presence_state_status_check" CHECK (("presence_status" = ANY (ARRAY['active'::"text", 'hidden'::"text", 'brb'::"text", 'left'::"text", 'disconnected'::"text"]))),
    CONSTRAINT "room_member_presence_state_track_check" CHECK ((("audio_track_state" = ANY (ARRAY['on'::"text", 'off'::"text", 'unknown'::"text"])) AND ("video_track_state" = ANY (ARRAY['on'::"text", 'off'::"text", 'unknown'::"text"])) AND ("screen_track_state" = ANY (ARRAY['on'::"text", 'off'::"text", 'unknown'::"text"]))))
);


ALTER TABLE "public"."room_member_presence_state" OWNER TO "postgres";

--
-- Name: TABLE "room_member_presence_state"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."room_member_presence_state" IS 'P0 current-state projection. Event history remains in room_presence_events; this table is the current operational state.';


--
-- Name: room_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."room_members" (
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."room_members" OWNER TO "postgres";

--
-- Name: room_participant_summaries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."room_participant_summaries" (
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "access_session_id" "uuid",
    "presence_mode" "text" DEFAULT 'quiet'::"text" NOT NULL,
    "first_presence_at" timestamp with time zone,
    "last_presence_at" timestamp with time zone,
    "actual_presence_seconds" bigint DEFAULT 0 NOT NULL,
    "participant_minutes" numeric(14,4) DEFAULT 0 NOT NULL,
    "visual_seconds" bigint DEFAULT 0 NOT NULL,
    "audio_only_seconds" bigint DEFAULT 0 NOT NULL,
    "screen_share_seconds" bigint DEFAULT 0 NOT NULL,
    "billing_media_class" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "joined_confirmed" boolean DEFAULT false NOT NULL,
    "left_explicitly" boolean DEFAULT false NOT NULL,
    "brb_count" integer DEFAULT 0 NOT NULL,
    "hidden_count" integer DEFAULT 0 NOT NULL,
    "extension_confirm_count" integer DEFAULT 0 NOT NULL,
    "reliability_event_count" integer DEFAULT 0 NOT NULL,
    "estimated_provider_cost_usd" numeric(14,6) DEFAULT 0 NOT NULL,
    "summary_version" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_participant_summaries_media_check" CHECK (("billing_media_class" = ANY (ARRAY['unknown'::"text", 'no_media'::"text", 'audio_only'::"text", 'video'::"text"]))),
    CONSTRAINT "room_participant_summaries_mode_check" CHECK (("presence_mode" = ANY (ARRAY['quiet'::"text", 'audio'::"text", 'mosaic'::"text", 'camera'::"text"])))
);


ALTER TABLE "public"."room_participant_summaries" OWNER TO "postgres";

--
-- Name: TABLE "room_participant_summaries"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."room_participant_summaries" IS 'Per-participant session summary calculated from heartbeat/media state events and access sessions.';


--
-- Name: room_presence_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."room_presence_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "presence_mode" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "visible_state" "text",
    "audio_track_state" "text",
    "video_track_state" "text",
    "brb_until" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "heartbeat_at" timestamp with time zone,
    "media_track_state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "access_session_id" "uuid",
    "daily_participant_state" "text",
    "billing_media_class" "text",
    CONSTRAINT "room_presence_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['join'::"text", 'heartbeat'::"text", 'visibility'::"text", 'media_state'::"text", 'brb_start'::"text", 'brb_end'::"text", 'extension_confirm'::"text", 'leave'::"text", 'selected'::"text", 'visible'::"text", 'hidden'::"text", 'audio_on'::"text", 'audio_off'::"text", 'video_on'::"text", 'video_off'::"text", 'extension_confirmed'::"text", 'left'::"text"]))),
    CONSTRAINT "room_presence_events_presence_mode_check" CHECK (("presence_mode" = ANY (ARRAY['quiet'::"text", 'audio'::"text", 'mosaic'::"text", 'camera'::"text"]))),
    CONSTRAINT "room_presence_events_visible_state_check" CHECK (("visible_state" = ANY (ARRAY['visible'::"text", 'hidden'::"text"])))
);


ALTER TABLE "public"."room_presence_events" OWNER TO "postgres";

--
-- Name: room_reconciliation_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."room_reconciliation_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid",
    "issue_type" "text" NOT NULL,
    "severity" "text" DEFAULT 'normal'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "room_id" "uuid",
    "daily_room_name" "text",
    "daily_room_url" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "recommended_action" "text",
    "fixed_by_admin_user_id" "uuid",
    "fixed_at" timestamp with time zone,
    "fix_result" "jsonb",
    "ignored_by_admin_user_id" "uuid",
    "ignored_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_reconciliation_items_issue_check" CHECK (("issue_type" = ANY (ARRAY['active_overdue'::"text", 'active_without_daily_url'::"text", 'active_daily_missing'::"text", 'ended_with_daily_room'::"text", 'orphan_daily_room'::"text", 'active_without_members'::"text", 'stale_presence'::"text", 'daily_list_failed'::"text"]))),
    CONSTRAINT "room_reconciliation_items_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text", 'critical'::"text"]))),
    CONSTRAINT "room_reconciliation_items_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'fixed'::"text", 'ignored'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."room_reconciliation_items" OWNER TO "postgres";

--
-- Name: room_reconciliation_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."room_reconciliation_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_type" "text" DEFAULT 'manual_scan'::"text" NOT NULL,
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "scanned_supabase_rooms" integer DEFAULT 0 NOT NULL,
    "scanned_daily_rooms" integer DEFAULT 0 NOT NULL,
    "detected_items" integer DEFAULT 0 NOT NULL,
    "fixed_items" integer DEFAULT 0 NOT NULL,
    "failed_items" integer DEFAULT 0 NOT NULL,
    "triggered_by_admin_user_id" "uuid",
    "summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_reconciliation_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'partial_failed'::"text", 'failed'::"text"]))),
    CONSTRAINT "room_reconciliation_runs_type_check" CHECK (("run_type" = ANY (ARRAY['manual_scan'::"text", 'manual_fix'::"text", 'cleanup_cron'::"text", 'auto_scan'::"text"])))
);


ALTER TABLE "public"."room_reconciliation_runs" OWNER TO "postgres";

--
-- Name: room_session_summaries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."room_session_summaries" (
    "room_id" "uuid" NOT NULL,
    "summary_version" "text" NOT NULL,
    "room_title" "text",
    "room_category" "text",
    "room_mode" "text",
    "visibility" "text",
    "scheduled_duration_minutes" integer DEFAULT 0 NOT NULL,
    "scheduled_start_at" timestamp with time zone,
    "scheduled_end_at" timestamp with time zone,
    "actual_started_at" timestamp with time zone,
    "actual_ended_at" timestamp with time zone,
    "end_reason" "text",
    "participant_count" integer DEFAULT 0 NOT NULL,
    "connected_participant_count" integer DEFAULT 0 NOT NULL,
    "total_presence_seconds" bigint DEFAULT 0 NOT NULL,
    "total_participant_minutes" numeric(14,4) DEFAULT 0 NOT NULL,
    "total_visual_seconds" bigint DEFAULT 0 NOT NULL,
    "total_audio_only_seconds" bigint DEFAULT 0 NOT NULL,
    "estimated_provider_cost_usd" numeric(14,6) DEFAULT 0 NOT NULL,
    "source_event_count" integer DEFAULT 0 NOT NULL,
    "source_access_session_count" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'ready'::"text" NOT NULL,
    "last_error" "text",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_session_summaries_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'ready'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."room_session_summaries" OWNER TO "postgres";

--
-- Name: TABLE "room_session_summaries"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."room_session_summaries" IS 'Idempotent room-level post-session summary. Does not store transcript, raw audio, or video.';


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: postgres
--

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
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "scheduled_end_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "last_presence_at" timestamp with time zone,
    "cleanup_reason" "text",
    "daily_room_deleted_at" timestamp with time zone,
    "daily_room_delete_error" "text",
    CONSTRAINT "rooms_duration_minutes_check" CHECK (("duration_minutes" = ANY (ARRAY[25, 50]))),
    CONSTRAINT "rooms_interaction_style_check" CHECK (("interaction_style" = ANY (ARRAY['silent'::"text", 'light-chat'::"text", 'guided'::"text", 'open-share'::"text"]))),
    CONSTRAINT "rooms_max_size_check" CHECK ((("max_size" >= 2) AND ("max_size" <= 6))),
    CONSTRAINT "rooms_mode_check" CHECK (("mode" = ANY (ARRAY['group'::"text", 'pair'::"text"]))),
    CONSTRAINT "rooms_room_category_check" CHECK (("room_category" = ANY (ARRAY['focus'::"text", 'life'::"text", 'share'::"text", 'hobby'::"text"]))),
    CONSTRAINT "rooms_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'ended'::"text", 'expired'::"text", 'error'::"text"]))),
    CONSTRAINT "rooms_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'members'::"text", 'friends'::"text", 'invited'::"text"])))
);


ALTER TABLE "public"."rooms" OWNER TO "postgres";

--
-- Name: COLUMN "rooms"."room_category"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."rooms"."room_category" IS 'Rooms 場景：focus / life / share / hobby';


--
-- Name: COLUMN "rooms"."interaction_style"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."rooms"."interaction_style" IS '互動形式：silent / light-chat / guided / open-share';


--
-- Name: COLUMN "rooms"."visibility"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."rooms"."visibility" IS '可見性：public / members / friends / invited';


--
-- Name: COLUMN "rooms"."host_note"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."rooms"."host_note" IS '房主補充說明，主要用於 room list 與 room detail 的輔助資訊';


--
-- Name: COLUMN "rooms"."invite_code"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."rooms"."invite_code" IS '邀請制即時房的加入代碼；只有 invited 可見性時會自動產生';


--
-- Name: scheduled_room_posts; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: COLUMN "scheduled_room_posts"."room_category"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."scheduled_room_posts"."room_category" IS 'Rooms 排程場景：focus / life / share / hobby';


--
-- Name: COLUMN "scheduled_room_posts"."invite_code"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."scheduled_room_posts"."invite_code" IS '邀請制排程房的查看代碼；只有 invited 可見性時會自動產生';


--
-- Name: security_audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."security_audit_logs" (
    "id" bigint NOT NULL,
    "actor_user_id" "uuid",
    "target_user_id" "uuid",
    "action" "text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."security_audit_logs" OWNER TO "postgres";

--
-- Name: security_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS "public"."security_audit_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."security_audit_logs_id_seq" OWNER TO "postgres";

--
-- Name: security_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."security_audit_logs_id_seq" OWNED BY "public"."security_audit_logs"."id";


--
-- Name: subscription_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."subscription_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subscription_profile_id" "uuid",
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "merchant_trade_no" "text",
    "payment_order_id" "uuid",
    "provider_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscription_events" OWNER TO "postgres";

--
-- Name: subscription_payment_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."subscription_payment_applications" (
    "payment_order_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subscription_profile_id" "uuid",
    "plan_code" "text" NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'applied'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reversed_at" timestamp with time zone,
    "reversal_refund_request_id" "uuid",
    CONSTRAINT "subscription_payment_applications_period_check" CHECK (("period_end" > "period_start")),
    CONSTRAINT "subscription_payment_applications_plan_check" CHECK (("plan_code" = ANY (ARRAY['rooms_unlimited_299'::"text", 'buddies_pro_399'::"text", 'whole_site_599'::"text", 'host_999'::"text"]))),
    CONSTRAINT "subscription_payment_applications_status_check" CHECK (("status" = ANY (ARRAY['applied'::"text", 'reversed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."subscription_payment_applications" OWNER TO "postgres";

--
-- Name: TABLE "subscription_payment_applications"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."subscription_payment_applications" IS 'Idempotency boundary between a paid recurring payment order and entitlement/wallet grants.';


--
-- Name: subscription_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."subscription_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'ecpay'::"text" NOT NULL,
    "plan_code" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "merchant_member_id" "text",
    "merchant_trade_no" "text",
    "provider_profile_id" "text",
    "period_amount" integer DEFAULT 0 NOT NULL,
    "period_type" "text" DEFAULT 'M'::"text" NOT NULL,
    "frequency" integer DEFAULT 1 NOT NULL,
    "exec_times" integer DEFAULT 999 NOT NULL,
    "auto_renew" boolean DEFAULT true NOT NULL,
    "next_charge_at" timestamp with time zone,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancel_reason" "text",
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cancel_requested_at" timestamp with time zone,
    "cancel_requested_by_user_id" "uuid",
    "last_provider_error" "text",
    "admin_note" "text",
    "invoice_preference" "jsonb",
    "commercial_entitlement_status" "text",
    "entitlement_applied_at" timestamp with time zone,
    CONSTRAINT "subscription_profiles_amount_check" CHECK (("period_amount" >= 0)),
    CONSTRAINT "subscription_profiles_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'past_due'::"text", 'cancel_pending'::"text", 'cancelled'::"text", 'expired'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."subscription_profiles" OWNER TO "postgres";

--
-- Name: support_ticket_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."support_ticket_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "actor_user_id" "uuid",
    "actor_role" "text" DEFAULT 'system'::"text" NOT NULL,
    "event_type" "text" NOT NULL,
    "from_status" "text",
    "to_status" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_ticket_events_actor_role_check" CHECK (("actor_role" = ANY (ARRAY['user'::"text", 'admin'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."support_ticket_events" OWNER TO "postgres";

--
-- Name: support_ticket_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."support_ticket_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "sender_user_id" "uuid",
    "sender_role" "text" DEFAULT 'user'::"text" NOT NULL,
    "body" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_ticket_messages_body_len" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 8000))),
    CONSTRAINT "support_ticket_messages_sender_role_check" CHECK (("sender_role" = ANY (ARRAY['user'::"text", 'admin'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."support_ticket_messages" OWNER TO "postgres";

--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category" "text" DEFAULT 'other'::"text" NOT NULL,
    "subject" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "related_room_id" "uuid",
    "related_booking_id" "uuid",
    "related_payment_order_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_user_message_at" timestamp with time zone,
    "last_admin_message_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_admin_user_id" "uuid",
    "admin_note" "text",
    CONSTRAINT "support_tickets_category_check" CHECK (("category" = ANY (ARRAY['payment'::"text", 'invoice'::"text", 'room'::"text", 'account'::"text", 'safety'::"text", 'buddies'::"text", 'ai'::"text", 'refund'::"text", 'technical'::"text", 'other'::"text"]))),
    CONSTRAINT "support_tickets_description_len" CHECK (("char_length"("description") <= 6000)),
    CONSTRAINT "support_tickets_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "support_tickets_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'pending'::"text", 'admin_review'::"text", 'resolved'::"text", 'closed'::"text"]))),
    CONSTRAINT "support_tickets_subject_len" CHECK ((("char_length"("subject") >= 4) AND ("char_length"("subject") <= 160)))
);


ALTER TABLE "public"."support_tickets" OWNER TO "postgres";

--
-- Name: user_blocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_blocks" (
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "block_scope" "text" DEFAULT 'site'::"text" NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "blocker_user_id" "uuid",
    "blocked_user_id" "uuid",
    "source_report_id" "uuid",
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    CONSTRAINT "user_blocks_block_scope_check" CHECK (("block_scope" = 'site'::"text"))
);


ALTER TABLE "public"."user_blocks" OWNER TO "postgres";

--
-- Name: user_entitlements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_entitlements" (
    "user_id" "uuid" NOT NULL,
    "plan" "text" DEFAULT 'free'::"text" NOT NULL,
    "vip_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_entitlements" OWNER TO "postgres";

--
-- Name: user_identity_bindings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_identity_bindings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "binding_type" "text" NOT NULL,
    "binding_value_masked" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "verified_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "source" "text" DEFAULT 'account'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_identity_bindings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text", 'revoked'::"text"]))),
    CONSTRAINT "user_identity_bindings_type_check" CHECK (("binding_type" = ANY (ARRAY['email'::"text", 'phone'::"text", 'google'::"text", 'line'::"text", 'telegram'::"text", 'manual_review'::"text", 'government_id'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."user_identity_bindings" OWNER TO "postgres";

--
-- Name: user_invoice_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_invoice_preferences" (
    "user_id" "uuid" NOT NULL,
    "preference" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_invoice_preferences" OWNER TO "postgres";

--
-- Name: user_plan_entitlements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_plan_entitlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_code" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "valid_from" timestamp with time zone NOT NULL,
    "valid_until" timestamp with time zone NOT NULL,
    "auto_renew" boolean DEFAULT false NOT NULL,
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "source_subscription_profile_id" "uuid",
    "source_payment_order_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_plan_entitlements_period_check" CHECK (("valid_until" > "valid_from")),
    CONSTRAINT "user_plan_entitlements_plan_check" CHECK (("plan_code" = ANY (ARRAY['rooms_unlimited_299'::"text", 'buddies_pro_399'::"text", 'whole_site_599'::"text", 'host_999'::"text"]))),
    CONSTRAINT "user_plan_entitlements_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'past_due'::"text", 'cancel_pending'::"text", 'cancelled'::"text", 'expired'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."user_plan_entitlements" OWNER TO "postgres";

--
-- Name: TABLE "user_plan_entitlements"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."user_plan_entitlements" IS 'P2 current commercial entitlement projection. Browser direct access is denied; server APIs return safe projections.';


--
-- Name: user_private_profile_settings; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: user_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_user_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_user_id" "uuid",
    "target_room_id" "uuid",
    "target_buddy_service_id" "uuid",
    "target_buddy_booking_id" "uuid",
    "category" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "severity" "text" DEFAULT 'normal'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "linked_moderation_case_id" "uuid",
    "admin_note" "text",
    CONSTRAINT "user_reports_category_check" CHECK (("category" = ANY (ARRAY['harassment'::"text", 'sexual'::"text", 'spam'::"text", 'scam'::"text", 'illegal'::"text", 'self_harm'::"text", 'privacy'::"text", 'payment'::"text", 'impersonation'::"text", 'other'::"text"]))),
    CONSTRAINT "user_reports_description_len" CHECK (("char_length"("description") <= 6000)),
    CONSTRAINT "user_reports_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "user_reports_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'triaged'::"text", 'actioned'::"text", 'dismissed'::"text", 'closed'::"text"]))),
    CONSTRAINT "user_reports_target_type_check" CHECK (("target_type" = ANY (ARRAY['user'::"text", 'room'::"text", 'buddy_service'::"text", 'buddy_booking'::"text", 'payment_order'::"text", 'ai'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."user_reports" OWNER TO "postgres";

--
-- Name: user_security_flags; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: user_usage_wallet_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_usage_wallet_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "resource_key" "text" NOT NULL,
    "delta_quantity" bigint DEFAULT 0 NOT NULL,
    "overage_delta" bigint DEFAULT 0 NOT NULL,
    "balance_after" bigint DEFAULT 0 NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "payment_order_id" "uuid",
    "room_id" "uuid",
    "access_session_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_usage_wallet_events_resource_check" CHECK (("resource_key" = ANY (ARRAY['visual_seconds'::"text", 'extension_points'::"text", 'priority_waitlist_uses'::"text", 'tracked_buddies'::"text", 'max_buddy_services'::"text", 'exposure_credits'::"text"]))),
    CONSTRAINT "user_usage_wallet_events_type_check" CHECK (("event_type" = ANY (ARRAY['grant'::"text", 'consume'::"text", 'overage'::"text", 'denied'::"text", 'adjustment'::"text", 'refund'::"text", 'expire'::"text"])))
);


ALTER TABLE "public"."user_usage_wallet_events" OWNER TO "postgres";

--
-- Name: user_usage_wallets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_usage_wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_code" "text" NOT NULL,
    "resource_key" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "granted_quantity" bigint DEFAULT 0 NOT NULL,
    "consumed_quantity" bigint DEFAULT 0 NOT NULL,
    "overage_quantity" bigint DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "source_subscription_profile_id" "uuid",
    "source_payment_order_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_usage_wallets_period_check" CHECK (("period_end" > "period_start")),
    CONSTRAINT "user_usage_wallets_plan_check" CHECK (("plan_code" = ANY (ARRAY['rooms_unlimited_299'::"text", 'buddies_pro_399'::"text", 'whole_site_599'::"text", 'host_999'::"text"]))),
    CONSTRAINT "user_usage_wallets_quantity_check" CHECK ((("granted_quantity" >= 0) AND ("consumed_quantity" >= 0) AND ("overage_quantity" >= 0))),
    CONSTRAINT "user_usage_wallets_resource_check" CHECK (("resource_key" = ANY (ARRAY['visual_seconds'::"text", 'extension_points'::"text", 'priority_waitlist_uses'::"text", 'tracked_buddies'::"text", 'max_buddy_services'::"text", 'exposure_credits'::"text"]))),
    CONSTRAINT "user_usage_wallets_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'revoked'::"text", 'refunded'::"text"]))),
    CONSTRAINT "user_usage_wallets_unit_check" CHECK (("unit" = ANY (ARRAY['seconds'::"text", 'points'::"text", 'uses'::"text", 'items'::"text"])))
);


ALTER TABLE "public"."user_usage_wallets" OWNER TO "postgres";

--
-- Name: TABLE "user_usage_wallets"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."user_usage_wallets" IS 'P2 period wallet for visual seconds and extension points. Immutable history is stored in user_usage_wallet_events.';


--
-- Name: verified_phone_identities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."verified_phone_identities" (
    "phone_hash" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "phone_e164" "text" NOT NULL,
    "first_verified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_verified_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."verified_phone_identities" OWNER TO "postgres";

--
-- Name: payment_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."payment_events_id_seq"'::"regclass");


--
-- Name: security_audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."security_audit_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."security_audit_logs_id_seq"'::"regclass");


--
-- Name: abuse_reports abuse_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."abuse_reports"
    ADD CONSTRAINT "abuse_reports_pkey" PRIMARY KEY ("id");


--
-- Name: admin_audit_logs admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id");


--
-- Name: admin_entity_notes admin_entity_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_entity_notes"
    ADD CONSTRAINT "admin_entity_notes_pkey" PRIMARY KEY ("id");


--
-- Name: admin_permission_presets admin_permission_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_permission_presets"
    ADD CONSTRAINT "admin_permission_presets_pkey" PRIMARY KEY ("role_key");


--
-- Name: admin_role_assignments admin_role_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_role_assignments"
    ADD CONSTRAINT "admin_role_assignments_pkey" PRIMARY KEY ("id");


--
-- Name: ai_room_host_sessions ai_room_host_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_room_host_sessions"
    ADD CONSTRAINT "ai_room_host_sessions_pkey" PRIMARY KEY ("id");


--
-- Name: ai_usage_events ai_usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_usage_events"
    ADD CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id");


--
-- Name: ai_user_mode_preferences ai_user_mode_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_user_mode_preferences"
    ADD CONSTRAINT "ai_user_mode_preferences_pkey" PRIMARY KEY ("user_id");


--
-- Name: appeal_events appeal_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appeal_events"
    ADD CONSTRAINT "appeal_events_pkey" PRIMARY KEY ("id");


--
-- Name: appeal_messages appeal_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appeal_messages"
    ADD CONSTRAINT "appeal_messages_pkey" PRIMARY KEY ("id");


--
-- Name: appeals appeals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appeals"
    ADD CONSTRAINT "appeals_pkey" PRIMARY KEY ("id");


--
-- Name: auth_sms_attempts auth_sms_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."auth_sms_attempts"
    ADD CONSTRAINT "auth_sms_attempts_pkey" PRIMARY KEY ("id");


--
-- Name: billing_automation_locks billing_automation_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."billing_automation_locks"
    ADD CONSTRAINT "billing_automation_locks_pkey" PRIMARY KEY ("job_name");


--
-- Name: billing_automation_runs billing_automation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."billing_automation_runs"
    ADD CONSTRAINT "billing_automation_runs_pkey" PRIMARY KEY ("id");


--
-- Name: billing_ledger billing_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."billing_ledger"
    ADD CONSTRAINT "billing_ledger_pkey" PRIMARY KEY ("id");


--
-- Name: buddy_booking_events buddy_booking_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_booking_events"
    ADD CONSTRAINT "buddy_booking_events_pkey" PRIMARY KEY ("id");


--
-- Name: buddy_booking_payment_applications buddy_booking_payment_applications_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_booking_payment_applications"
    ADD CONSTRAINT "buddy_booking_payment_applications_booking_id_key" UNIQUE ("booking_id");


--
-- Name: buddy_booking_payment_applications buddy_booking_payment_applications_payment_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_booking_payment_applications"
    ADD CONSTRAINT "buddy_booking_payment_applications_payment_order_id_key" UNIQUE ("payment_order_id");


--
-- Name: buddy_booking_payment_applications buddy_booking_payment_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_booking_payment_applications"
    ADD CONSTRAINT "buddy_booking_payment_applications_pkey" PRIMARY KEY ("id");


--
-- Name: buddy_bookings buddy_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_bookings"
    ADD CONSTRAINT "buddy_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: buddy_disputes buddy_disputes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_disputes"
    ADD CONSTRAINT "buddy_disputes_pkey" PRIMARY KEY ("id");


--
-- Name: buddy_payout_accounts buddy_payout_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_payout_accounts"
    ADD CONSTRAINT "buddy_payout_accounts_pkey" PRIMARY KEY ("id");


--
-- Name: buddy_payout_accounts buddy_payout_accounts_provider_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_payout_accounts"
    ADD CONSTRAINT "buddy_payout_accounts_provider_user_id_key" UNIQUE ("provider_user_id");


--
-- Name: buddy_payout_batches buddy_payout_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_payout_batches"
    ADD CONSTRAINT "buddy_payout_batches_pkey" PRIMARY KEY ("id");


--
-- Name: buddy_payout_items buddy_payout_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_payout_items"
    ADD CONSTRAINT "buddy_payout_items_pkey" PRIMARY KEY ("id");


--
-- Name: buddy_payout_items buddy_payout_items_settlement_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_payout_items"
    ADD CONSTRAINT "buddy_payout_items_settlement_id_key" UNIQUE ("settlement_id");


--
-- Name: buddy_provider_applications buddy_provider_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_provider_applications"
    ADD CONSTRAINT "buddy_provider_applications_pkey" PRIMARY KEY ("id");


--
-- Name: buddy_reviews buddy_reviews_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_reviews"
    ADD CONSTRAINT "buddy_reviews_booking_id_key" UNIQUE ("booking_id");


--
-- Name: buddy_reviews buddy_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_reviews"
    ADD CONSTRAINT "buddy_reviews_pkey" PRIMARY KEY ("id");


--
-- Name: buddy_service_slots buddy_service_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_service_slots"
    ADD CONSTRAINT "buddy_service_slots_pkey" PRIMARY KEY ("id");


--
-- Name: buddy_services buddy_services_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_services"
    ADD CONSTRAINT "buddy_services_pkey" PRIMARY KEY ("id");


--
-- Name: buddy_settlement_events buddy_settlement_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_settlement_events"
    ADD CONSTRAINT "buddy_settlement_events_pkey" PRIMARY KEY ("id");


--
-- Name: buddy_settlements buddy_settlements_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_settlements"
    ADD CONSTRAINT "buddy_settlements_booking_id_key" UNIQUE ("booking_id");


--
-- Name: buddy_settlements buddy_settlements_payment_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_settlements"
    ADD CONSTRAINT "buddy_settlements_payment_order_id_key" UNIQUE ("payment_order_id");


--
-- Name: buddy_settlements buddy_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_settlements"
    ADD CONSTRAINT "buddy_settlements_pkey" PRIMARY KEY ("id");


--
-- Name: cowork_identity_monthly_usage cowork_identity_monthly_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cowork_identity_monthly_usage"
    ADD CONSTRAINT "cowork_identity_monthly_usage_pkey" PRIMARY KEY ("identity_key", "month_start");


--
-- Name: cowork_monthly_usage cowork_monthly_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cowork_monthly_usage"
    ADD CONSTRAINT "cowork_monthly_usage_pkey" PRIMARY KEY ("user_id", "month_start");


--
-- Name: ecpay_invoice_tasks ecpay_invoice_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ecpay_invoice_tasks"
    ADD CONSTRAINT "ecpay_invoice_tasks_pkey" PRIMARY KEY ("id");


--
-- Name: ecpay_refund_tasks ecpay_refund_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ecpay_refund_tasks"
    ADD CONSTRAINT "ecpay_refund_tasks_pkey" PRIMARY KEY ("id");


--
-- Name: ecpay_subscription_tasks ecpay_subscription_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ecpay_subscription_tasks"
    ADD CONSTRAINT "ecpay_subscription_tasks_pkey" PRIMARY KEY ("id");


--
-- Name: entitlement_events entitlement_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."entitlement_events"
    ADD CONSTRAINT "entitlement_events_pkey" PRIMARY KEY ("id");


--
-- Name: friend_requests friend_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id");


--
-- Name: friendships friendships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("user_low", "user_high");


--
-- Name: identity_verification_requests identity_verification_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."identity_verification_requests"
    ADD CONSTRAINT "identity_verification_requests_pkey" PRIMARY KEY ("id");


--
-- Name: invoice_events invoice_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."invoice_events"
    ADD CONSTRAINT "invoice_events_pkey" PRIMARY KEY ("id");


--
-- Name: moderation_actions moderation_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id");


--
-- Name: moderation_cases moderation_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."moderation_cases"
    ADD CONSTRAINT "moderation_cases_pkey" PRIMARY KEY ("id");


--
-- Name: notification_delivery_attempts notification_delivery_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notification_delivery_attempts"
    ADD CONSTRAINT "notification_delivery_attempts_pkey" PRIMARY KEY ("id");


--
-- Name: notification_outbox notification_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notification_outbox"
    ADD CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id");


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id");


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id");


--
-- Name: notification_templates notification_templates_template_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_template_key_key" UNIQUE ("template_key");


--
-- Name: ops_action_items ops_action_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ops_action_items"
    ADD CONSTRAINT "ops_action_items_pkey" PRIMARY KEY ("id");


--
-- Name: payment_events payment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id");


--
-- Name: payment_orders payment_orders_merchant_trade_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_merchant_trade_no_key" UNIQUE ("merchant_trade_no");


--
-- Name: payment_orders payment_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id");


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");


--
-- Name: refund_events refund_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."refund_events"
    ADD CONSTRAINT "refund_events_pkey" PRIMARY KEY ("id");


--
-- Name: refund_requests refund_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id");


--
-- Name: reliability_events reliability_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reliability_events"
    ADD CONSTRAINT "reliability_events_pkey" PRIMARY KEY ("id");


--
-- Name: room_access_sessions room_access_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_access_sessions"
    ADD CONSTRAINT "room_access_sessions_pkey" PRIMARY KEY ("id");


--
-- Name: room_access_sessions room_access_sessions_unique_billing; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_access_sessions"
    ADD CONSTRAINT "room_access_sessions_unique_billing" UNIQUE ("room_id", "user_id", "billing_session_key");


--
-- Name: room_extension_confirmations room_extension_confirmations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_extension_confirmations"
    ADD CONSTRAINT "room_extension_confirmations_pkey" PRIMARY KEY ("id");


--
-- Name: room_extension_confirmations room_extension_confirmations_room_id_user_id_extension_wind_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_extension_confirmations"
    ADD CONSTRAINT "room_extension_confirmations_room_id_user_id_extension_wind_key" UNIQUE ("room_id", "user_id", "extension_window_key");


--
-- Name: room_extension_grants room_extension_grants_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_extension_grants"
    ADD CONSTRAINT "room_extension_grants_idempotency_key_key" UNIQUE ("idempotency_key");


--
-- Name: room_extension_grants room_extension_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_extension_grants"
    ADD CONSTRAINT "room_extension_grants_pkey" PRIMARY KEY ("id");


--
-- Name: room_extension_grants room_extension_grants_room_id_extension_window_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_extension_grants"
    ADD CONSTRAINT "room_extension_grants_room_id_extension_window_key_key" UNIQUE ("room_id", "extension_window_key");


--
-- Name: room_lifecycle_events room_lifecycle_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_lifecycle_events"
    ADD CONSTRAINT "room_lifecycle_events_pkey" PRIMARY KEY ("id");


--
-- Name: room_member_presence_state room_member_presence_state_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_member_presence_state"
    ADD CONSTRAINT "room_member_presence_state_pkey" PRIMARY KEY ("room_id", "user_id");


--
-- Name: room_members room_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_members"
    ADD CONSTRAINT "room_members_pkey" PRIMARY KEY ("room_id", "user_id");


--
-- Name: room_participant_summaries room_participant_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_participant_summaries"
    ADD CONSTRAINT "room_participant_summaries_pkey" PRIMARY KEY ("room_id", "user_id");


--
-- Name: room_presence_events room_presence_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_presence_events"
    ADD CONSTRAINT "room_presence_events_pkey" PRIMARY KEY ("id");


--
-- Name: room_reconciliation_items room_reconciliation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_reconciliation_items"
    ADD CONSTRAINT "room_reconciliation_items_pkey" PRIMARY KEY ("id");


--
-- Name: room_reconciliation_runs room_reconciliation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_reconciliation_runs"
    ADD CONSTRAINT "room_reconciliation_runs_pkey" PRIMARY KEY ("id");


--
-- Name: room_session_summaries room_session_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_session_summaries"
    ADD CONSTRAINT "room_session_summaries_pkey" PRIMARY KEY ("room_id");


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_pkey" PRIMARY KEY ("id");


--
-- Name: scheduled_room_posts scheduled_room_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scheduled_room_posts"
    ADD CONSTRAINT "scheduled_room_posts_pkey" PRIMARY KEY ("id");


--
-- Name: security_audit_logs security_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."security_audit_logs"
    ADD CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id");


--
-- Name: subscription_events subscription_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id");


--
-- Name: subscription_payment_applications subscription_payment_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."subscription_payment_applications"
    ADD CONSTRAINT "subscription_payment_applications_pkey" PRIMARY KEY ("payment_order_id");


--
-- Name: subscription_profiles subscription_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."subscription_profiles"
    ADD CONSTRAINT "subscription_profiles_pkey" PRIMARY KEY ("id");


--
-- Name: support_ticket_events support_ticket_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."support_ticket_events"
    ADD CONSTRAINT "support_ticket_events_pkey" PRIMARY KEY ("id");


--
-- Name: support_ticket_messages support_ticket_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id");


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");


--
-- Name: user_blocks user_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("user_id");


--
-- Name: user_entitlements user_entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_entitlements"
    ADD CONSTRAINT "user_entitlements_pkey" PRIMARY KEY ("user_id");


--
-- Name: user_identity_bindings user_identity_bindings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_identity_bindings"
    ADD CONSTRAINT "user_identity_bindings_pkey" PRIMARY KEY ("id");


--
-- Name: user_invoice_preferences user_invoice_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_invoice_preferences"
    ADD CONSTRAINT "user_invoice_preferences_pkey" PRIMARY KEY ("user_id");


--
-- Name: user_plan_entitlements user_plan_entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_plan_entitlements"
    ADD CONSTRAINT "user_plan_entitlements_pkey" PRIMARY KEY ("id");


--
-- Name: user_plan_entitlements user_plan_entitlements_user_id_plan_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_plan_entitlements"
    ADD CONSTRAINT "user_plan_entitlements_user_id_plan_code_key" UNIQUE ("user_id", "plan_code");


--
-- Name: user_private_profile_settings user_private_profile_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_private_profile_settings"
    ADD CONSTRAINT "user_private_profile_settings_pkey" PRIMARY KEY ("user_id");


--
-- Name: user_reports user_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id");


--
-- Name: user_security_flags user_security_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_security_flags"
    ADD CONSTRAINT "user_security_flags_pkey" PRIMARY KEY ("user_id");


--
-- Name: user_usage_wallet_events user_usage_wallet_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_usage_wallet_events"
    ADD CONSTRAINT "user_usage_wallet_events_pkey" PRIMARY KEY ("id");


--
-- Name: user_usage_wallet_events user_usage_wallet_events_user_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_usage_wallet_events"
    ADD CONSTRAINT "user_usage_wallet_events_user_id_idempotency_key_key" UNIQUE ("user_id", "idempotency_key");


--
-- Name: user_usage_wallets user_usage_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_usage_wallets"
    ADD CONSTRAINT "user_usage_wallets_pkey" PRIMARY KEY ("id");


--
-- Name: user_usage_wallets user_usage_wallets_user_id_plan_code_resource_key_period_st_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_usage_wallets"
    ADD CONSTRAINT "user_usage_wallets_user_id_plan_code_resource_key_period_st_key" UNIQUE ("user_id", "plan_code", "resource_key", "period_start", "period_end");


--
-- Name: verified_phone_identities verified_phone_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."verified_phone_identities"
    ADD CONSTRAINT "verified_phone_identities_pkey" PRIMARY KEY ("phone_hash");


--
-- Name: verified_phone_identities verified_phone_identities_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."verified_phone_identities"
    ADD CONSTRAINT "verified_phone_identities_user_id_key" UNIQUE ("user_id");


--
-- Name: admin_role_assignments_one_active_per_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "admin_role_assignments_one_active_per_user" ON "public"."admin_role_assignments" USING "btree" ("user_id") WHERE ("status" = 'active'::"text");


--
-- Name: ai_room_host_sessions_room_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ai_room_host_sessions_room_created_idx" ON "public"."ai_room_host_sessions" USING "btree" ("room_id", "created_at" DESC);


--
-- Name: ai_room_host_sessions_room_started_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ai_room_host_sessions_room_started_idx" ON "public"."ai_room_host_sessions" USING "btree" ("room_id", "started_at" DESC);


--
-- Name: ai_room_host_sessions_sponsor_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ai_room_host_sessions_sponsor_created_idx" ON "public"."ai_room_host_sessions" USING "btree" ("sponsor_user_id", "created_at" DESC);


--
-- Name: ai_usage_events_payer_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ai_usage_events_payer_created_idx" ON "public"."ai_usage_events" USING "btree" ("payer_user_id", "created_at" DESC);


--
-- Name: ai_usage_events_room_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ai_usage_events_room_created_idx" ON "public"."ai_usage_events" USING "btree" ("room_id", "created_at" DESC);


--
-- Name: ai_usage_events_user_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ai_usage_events_user_created_idx" ON "public"."ai_usage_events" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: appeals_one_active_per_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "appeals_one_active_per_action" ON "public"."appeals" USING "btree" ("user_id", "moderation_action_id") WHERE (("moderation_action_id" IS NOT NULL) AND ("status" = ANY (ARRAY['open'::"text", 'reviewing'::"text"])));


--
-- Name: appeals_one_active_per_case_without_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "appeals_one_active_per_case_without_action" ON "public"."appeals" USING "btree" ("user_id", "moderation_case_id") WHERE (("moderation_action_id" IS NULL) AND ("moderation_case_id" IS NOT NULL) AND ("status" = ANY (ARRAY['open'::"text", 'reviewing'::"text"])));


--
-- Name: appeals_user_idempotency_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "appeals_user_idempotency_unique" ON "public"."appeals" USING "btree" ("user_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);


--
-- Name: auth_sms_attempts_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "auth_sms_attempts_created_at_idx" ON "public"."auth_sms_attempts" USING "btree" ("created_at" DESC);


--
-- Name: auth_sms_attempts_phone_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "auth_sms_attempts_phone_idx" ON "public"."auth_sms_attempts" USING "btree" ("phone", "created_at" DESC);


--
-- Name: auth_sms_attempts_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "auth_sms_attempts_user_id_idx" ON "public"."auth_sms_attempts" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: billing_automation_runs_job_started_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "billing_automation_runs_job_started_idx" ON "public"."billing_automation_runs" USING "btree" ("job_name", "started_at" DESC);


--
-- Name: billing_automation_runs_status_started_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "billing_automation_runs_status_started_idx" ON "public"."billing_automation_runs" USING "btree" ("status", "started_at" DESC);


--
-- Name: buddy_reviews_booking_reviewer_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "buddy_reviews_booking_reviewer_unique" ON "public"."buddy_reviews" USING "btree" ("booking_id", "reviewer_user_id");


--
-- Name: ecpay_invoice_tasks_order_action_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ecpay_invoice_tasks_order_action_status_idx" ON "public"."ecpay_invoice_tasks" USING "btree" ("payment_order_id", "action_type", "status", "created_at" DESC);


--
-- Name: friend_requests_addressee_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "friend_requests_addressee_idx" ON "public"."friend_requests" USING "btree" ("addressee_user_id", "status", "created_at" DESC);


--
-- Name: friend_requests_pair_key_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "friend_requests_pair_key_idx" ON "public"."friend_requests" USING "btree" ("pair_key");


--
-- Name: friend_requests_requester_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "friend_requests_requester_idx" ON "public"."friend_requests" USING "btree" ("requester_user_id", "status", "created_at" DESC);


--
-- Name: friendships_user_high_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "friendships_user_high_idx" ON "public"."friendships" USING "btree" ("user_high", "created_at" DESC);


--
-- Name: friendships_user_low_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "friendships_user_low_idx" ON "public"."friendships" USING "btree" ("user_low", "created_at" DESC);


--
-- Name: idx_abuse_reports_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_abuse_reports_status" ON "public"."abuse_reports" USING "btree" ("status");


--
-- Name: idx_admin_audit_logs_actor_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_audit_logs_actor_created" ON "public"."admin_audit_logs" USING "btree" ("actor_admin_user_id", "created_at" DESC);


--
-- Name: idx_admin_audit_logs_target_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_audit_logs_target_created" ON "public"."admin_audit_logs" USING "btree" ("target_type", "target_id", "created_at" DESC);


--
-- Name: idx_admin_entity_notes_admin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_entity_notes_admin" ON "public"."admin_entity_notes" USING "btree" ("admin_user_id", "created_at" DESC) WHERE ("admin_user_id" IS NOT NULL);


--
-- Name: idx_admin_entity_notes_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_entity_notes_target" ON "public"."admin_entity_notes" USING "btree" ("target_type", "target_id", "pinned" DESC, "created_at" DESC);


--
-- Name: idx_admin_role_assignments_status_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_role_assignments_status_role" ON "public"."admin_role_assignments" USING "btree" ("status", "role_key", "updated_at" DESC);


--
-- Name: idx_admin_role_assignments_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_role_assignments_user" ON "public"."admin_role_assignments" USING "btree" ("user_id", "updated_at" DESC);


--
-- Name: idx_ai_room_host_sessions_payer_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_room_host_sessions_payer_user_id" ON "public"."ai_room_host_sessions" USING "btree" ("payer_user_id");


--
-- Name: idx_ai_room_host_sessions_room_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_room_host_sessions_room_id" ON "public"."ai_room_host_sessions" USING "btree" ("room_id");


--
-- Name: idx_ai_room_host_sessions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_room_host_sessions_status" ON "public"."ai_room_host_sessions" USING "btree" ("status");


--
-- Name: idx_ai_usage_events_mode_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_usage_events_mode_created" ON "public"."ai_usage_events" USING "btree" ("ai_mode", "created_at" DESC);


--
-- Name: idx_ai_usage_events_room_id_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_usage_events_room_id_created" ON "public"."ai_usage_events" USING "btree" ("room_id", "created_at" DESC);


--
-- Name: idx_ai_usage_events_user_id_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_usage_events_user_id_created" ON "public"."ai_usage_events" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_appeal_events_appeal_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_appeal_events_appeal_created" ON "public"."appeal_events" USING "btree" ("appeal_id", "created_at" DESC);


--
-- Name: idx_appeal_messages_appeal_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_appeal_messages_appeal_created" ON "public"."appeal_messages" USING "btree" ("appeal_id", "created_at");


--
-- Name: idx_appeals_action_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_appeals_action_updated" ON "public"."appeals" USING "btree" ("moderation_action_id", "updated_at" DESC) WHERE ("moderation_action_id" IS NOT NULL);


--
-- Name: idx_appeals_case_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_appeals_case_updated" ON "public"."appeals" USING "btree" ("moderation_case_id", "updated_at" DESC) WHERE ("moderation_case_id" IS NOT NULL);


--
-- Name: idx_appeals_status_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_appeals_status_updated" ON "public"."appeals" USING "btree" ("status", "updated_at" DESC);


--
-- Name: idx_appeals_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_appeals_user_created" ON "public"."appeals" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_billing_ledger_buddy_payment_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_billing_ledger_buddy_payment_unique" ON "public"."billing_ledger" USING "btree" ("buddy_booking_id", "ledger_type") WHERE (("buddy_booking_id" IS NOT NULL) AND ("ledger_type" = ANY (ARRAY['buddy_payment'::"text", 'buddy_provider_payable'::"text", 'buddy_refund'::"text", 'buddy_provider_payable_reversal'::"text", 'buddy_payout'::"text"])));


--
-- Name: idx_billing_ledger_order_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_billing_ledger_order_type" ON "public"."billing_ledger" USING "btree" ("payment_order_id", "ledger_type") WHERE ("payment_order_id" IS NOT NULL);


--
-- Name: idx_billing_ledger_payment_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_billing_ledger_payment_order" ON "public"."billing_ledger" USING "btree" ("payment_order_id") WHERE ("payment_order_id" IS NOT NULL);


--
-- Name: idx_billing_ledger_user_occurred; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_billing_ledger_user_occurred" ON "public"."billing_ledger" USING "btree" ("user_id", "occurred_at" DESC);


--
-- Name: idx_buddy_bookings_buyer_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_bookings_buyer_created" ON "public"."buddy_bookings" USING "btree" ("buyer_user_id", "created_at" DESC);


--
-- Name: idx_buddy_bookings_payment_due; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_bookings_payment_due" ON "public"."buddy_bookings" USING "btree" ("payment_due_at") WHERE (("payment_status" = 'unpaid'::"text") AND ("booking_status" = 'pending'::"text"));


--
-- Name: idx_buddy_bookings_payment_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_bookings_payment_status" ON "public"."buddy_bookings" USING "btree" ("payment_status", "booking_status", "created_at" DESC);


--
-- Name: idx_buddy_bookings_provider_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_bookings_provider_created" ON "public"."buddy_bookings" USING "btree" ("provider_user_id", "created_at" DESC);


--
-- Name: idx_buddy_bookings_service_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_bookings_service_created" ON "public"."buddy_bookings" USING "btree" ("service_id", "created_at" DESC);


--
-- Name: idx_buddy_bookings_status_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_bookings_status_start" ON "public"."buddy_bookings" USING "btree" ("booking_status", "scheduled_start_at");


--
-- Name: idx_buddy_disputes_admin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_disputes_admin" ON "public"."buddy_disputes" USING "btree" ("admin_user_id", "updated_at" DESC) WHERE ("admin_user_id" IS NOT NULL);


--
-- Name: idx_buddy_disputes_review_queue; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_disputes_review_queue" ON "public"."buddy_disputes" USING "btree" ("dispute_status", "created_at" DESC);


--
-- Name: idx_buddy_payout_accounts_status_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_payout_accounts_status_updated" ON "public"."buddy_payout_accounts" USING "btree" ("status", "updated_at" DESC);


--
-- Name: idx_buddy_payout_batches_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_payout_batches_status_created" ON "public"."buddy_payout_batches" USING "btree" ("status", "created_at" DESC);


--
-- Name: idx_buddy_payout_items_provider_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_payout_items_provider_created" ON "public"."buddy_payout_items" USING "btree" ("provider_user_id", "created_at" DESC);


--
-- Name: idx_buddy_provider_applications_review_queue; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_provider_applications_review_queue" ON "public"."buddy_provider_applications" USING "btree" ("application_status", "created_at" DESC);


--
-- Name: idx_buddy_provider_applications_reviewer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_provider_applications_reviewer" ON "public"."buddy_provider_applications" USING "btree" ("reviewer_user_id", "reviewed_at" DESC) WHERE ("reviewer_user_id" IS NOT NULL);


--
-- Name: idx_buddy_reviews_booking_reviewer_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_buddy_reviews_booking_reviewer_unique" ON "public"."buddy_reviews" USING "btree" ("booking_id", "reviewer_user_id");


--
-- Name: idx_buddy_reviews_service_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_reviews_service_created" ON "public"."buddy_reviews" USING "btree" ("service_id", "created_at" DESC);


--
-- Name: idx_buddy_service_slots_provider_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_service_slots_provider_start" ON "public"."buddy_service_slots" USING "btree" ("provider_user_id", "starts_at" DESC);


--
-- Name: idx_buddy_service_slots_provider_starts; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_service_slots_provider_starts" ON "public"."buddy_service_slots" USING "btree" ("provider_user_id", "starts_at");


--
-- Name: idx_buddy_service_slots_service_open; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_service_slots_service_open" ON "public"."buddy_service_slots" USING "btree" ("service_id", "slot_status", "starts_at") WHERE ("slot_status" = 'open'::"text");


--
-- Name: idx_buddy_service_slots_service_starts; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_service_slots_service_starts" ON "public"."buddy_service_slots" USING "btree" ("service_id", "starts_at");


--
-- Name: idx_buddy_service_slots_service_status_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_service_slots_service_status_start" ON "public"."buddy_service_slots" USING "btree" ("service_id", "slot_status", "starts_at");


--
-- Name: idx_buddy_services_active_visibility; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_services_active_visibility" ON "public"."buddy_services" USING "btree" ("status", "visibility", "updated_at" DESC);


--
-- Name: idx_buddy_services_category_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_services_category_status" ON "public"."buddy_services" USING "btree" ("buddy_category", "status", "updated_at" DESC);


--
-- Name: idx_buddy_services_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_services_provider" ON "public"."buddy_services" USING "btree" ("provider_user_id", "updated_at" DESC);


--
-- Name: idx_buddy_services_provider_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_services_provider_status" ON "public"."buddy_services" USING "btree" ("provider_user_id", "status", "updated_at" DESC);


--
-- Name: idx_buddy_services_provider_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_services_provider_updated" ON "public"."buddy_services" USING "btree" ("provider_user_id", "updated_at" DESC);


--
-- Name: idx_buddy_services_scene_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_services_scene_status" ON "public"."buddy_services" USING "btree" ("room_category", "status", "updated_at" DESC);


--
-- Name: idx_buddy_services_status_visibility; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_services_status_visibility" ON "public"."buddy_services" USING "btree" ("status", "visibility", "updated_at" DESC);


--
-- Name: idx_buddy_services_tag_list; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_services_tag_list" ON "public"."buddy_services" USING "gin" ("tag_list");


--
-- Name: idx_buddy_settlement_events_booking_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_settlement_events_booking_created" ON "public"."buddy_settlement_events" USING "btree" ("booking_id", "created_at");


--
-- Name: idx_buddy_settlements_provider_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_settlements_provider_created" ON "public"."buddy_settlements" USING "btree" ("provider_user_id", "created_at" DESC);


--
-- Name: idx_buddy_settlements_status_available; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_buddy_settlements_status_available" ON "public"."buddy_settlements" USING "btree" ("status", "available_for_payout_at");


--
-- Name: idx_cowork_identity_monthly_usage_last_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_cowork_identity_monthly_usage_last_user_id" ON "public"."cowork_identity_monthly_usage" USING "btree" ("last_user_id");


--
-- Name: idx_ecpay_invoice_tasks_action_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ecpay_invoice_tasks_action_status_created" ON "public"."ecpay_invoice_tasks" USING "btree" ("action_type", "status", "created_at" DESC);


--
-- Name: idx_ecpay_invoice_tasks_invoice_event_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ecpay_invoice_tasks_invoice_event_action" ON "public"."ecpay_invoice_tasks" USING "btree" ("invoice_event_id", "action_type", "created_at" DESC) WHERE ("invoice_event_id" IS NOT NULL);


--
-- Name: idx_ecpay_invoice_tasks_invoice_event_action_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ecpay_invoice_tasks_invoice_event_action_status" ON "public"."ecpay_invoice_tasks" USING "btree" ("invoice_event_id", "action_type", "status");


--
-- Name: idx_ecpay_invoice_tasks_invoice_event_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_ecpay_invoice_tasks_invoice_event_unique" ON "public"."ecpay_invoice_tasks" USING "btree" ("invoice_event_id") WHERE ("invoice_event_id" IS NOT NULL);


--
-- Name: idx_ecpay_invoice_tasks_payment_order_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ecpay_invoice_tasks_payment_order_action" ON "public"."ecpay_invoice_tasks" USING "btree" ("payment_order_id", "action_type", "created_at" DESC) WHERE ("payment_order_id" IS NOT NULL);


--
-- Name: idx_ecpay_invoice_tasks_payment_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ecpay_invoice_tasks_payment_status_created" ON "public"."ecpay_invoice_tasks" USING "btree" ("payment_order_id", "status", "created_at" DESC) WHERE ("payment_order_id" IS NOT NULL);


--
-- Name: idx_ecpay_invoice_tasks_refund_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ecpay_invoice_tasks_refund_request" ON "public"."ecpay_invoice_tasks" USING "btree" ("refund_request_id", "created_at" DESC) WHERE ("refund_request_id" IS NOT NULL);


--
-- Name: idx_ecpay_invoice_tasks_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ecpay_invoice_tasks_status_created" ON "public"."ecpay_invoice_tasks" USING "btree" ("status", "created_at" DESC);


--
-- Name: idx_ecpay_invoice_tasks_status_next; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ecpay_invoice_tasks_status_next" ON "public"."ecpay_invoice_tasks" USING "btree" ("status", "next_attempt_at", "created_at" DESC);


--
-- Name: idx_ecpay_refund_tasks_payment_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ecpay_refund_tasks_payment_order" ON "public"."ecpay_refund_tasks" USING "btree" ("payment_order_id", "created_at" DESC) WHERE ("payment_order_id" IS NOT NULL);


--
-- Name: idx_ecpay_refund_tasks_payment_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ecpay_refund_tasks_payment_status_created" ON "public"."ecpay_refund_tasks" USING "btree" ("payment_order_id", "status", "created_at" DESC) WHERE ("payment_order_id" IS NOT NULL);


--
-- Name: idx_ecpay_refund_tasks_refund_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ecpay_refund_tasks_refund_request" ON "public"."ecpay_refund_tasks" USING "btree" ("refund_request_id", "created_at" DESC) WHERE ("refund_request_id" IS NOT NULL);


--
-- Name: idx_ecpay_refund_tasks_refund_request_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_ecpay_refund_tasks_refund_request_unique" ON "public"."ecpay_refund_tasks" USING "btree" ("refund_request_id") WHERE ("refund_request_id" IS NOT NULL);


--
-- Name: idx_ecpay_refund_tasks_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ecpay_refund_tasks_status_created" ON "public"."ecpay_refund_tasks" USING "btree" ("status", "created_at" DESC);


--
-- Name: idx_ecpay_refund_tasks_status_next; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ecpay_refund_tasks_status_next" ON "public"."ecpay_refund_tasks" USING "btree" ("status", "next_attempt_at", "created_at" DESC);


--
-- Name: idx_ecpay_subscription_tasks_status_next_attempt; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ecpay_subscription_tasks_status_next_attempt" ON "public"."ecpay_subscription_tasks" USING "btree" ("status", "next_attempt_at", "created_at" DESC);


--
-- Name: idx_entitlement_events_order_type_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_entitlement_events_order_type_key" ON "public"."entitlement_events" USING "btree" ("payment_order_id", "event_type", "entitlement_key") WHERE ("payment_order_id" IS NOT NULL);


--
-- Name: idx_entitlement_events_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_entitlement_events_user_created" ON "public"."entitlement_events" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_identity_verification_requests_review_queue; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_identity_verification_requests_review_queue" ON "public"."identity_verification_requests" USING "btree" ("review_status", "created_at" DESC);


--
-- Name: idx_identity_verification_requests_reviewer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_identity_verification_requests_reviewer" ON "public"."identity_verification_requests" USING "btree" ("reviewer_user_id", "reviewed_at" DESC) WHERE ("reviewer_user_id" IS NOT NULL);


--
-- Name: idx_identity_verification_requests_user_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_identity_verification_requests_user_status" ON "public"."identity_verification_requests" USING "btree" ("user_id", "review_status", "created_at" DESC);


--
-- Name: idx_invoice_events_order_event_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_invoice_events_order_event_created" ON "public"."invoice_events" USING "btree" ("payment_order_id", "event_type", "created_at" DESC) WHERE ("payment_order_id" IS NOT NULL);


--
-- Name: idx_invoice_events_order_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_invoice_events_order_type" ON "public"."invoice_events" USING "btree" ("payment_order_id", "event_type") WHERE ("payment_order_id" IS NOT NULL);


--
-- Name: idx_invoice_events_payment_event_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_invoice_events_payment_event_created" ON "public"."invoice_events" USING "btree" ("payment_order_id", "event_type", "created_at" DESC);


--
-- Name: idx_invoice_events_payment_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_invoice_events_payment_order" ON "public"."invoice_events" USING "btree" ("payment_order_id") WHERE ("payment_order_id" IS NOT NULL);


--
-- Name: idx_invoice_events_payment_order_event_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_invoice_events_payment_order_event_created" ON "public"."invoice_events" USING "btree" ("payment_order_id", "event_type", "created_at" DESC) WHERE ("payment_order_id" IS NOT NULL);


--
-- Name: idx_invoice_events_payment_order_event_type_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_invoice_events_payment_order_event_type_created_at" ON "public"."invoice_events" USING "btree" ("payment_order_id", "event_type", "created_at" DESC);


--
-- Name: idx_invoice_events_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_invoice_events_user_created" ON "public"."invoice_events" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_moderation_actions_case_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_moderation_actions_case_created" ON "public"."moderation_actions" USING "btree" ("case_id", "created_at" DESC);


--
-- Name: idx_moderation_actions_target_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_moderation_actions_target_user_created" ON "public"."moderation_actions" USING "btree" ("target_user_id", "created_at" DESC) WHERE ("target_user_id" IS NOT NULL);


--
-- Name: idx_moderation_cases_status_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_moderation_cases_status_updated" ON "public"."moderation_cases" USING "btree" ("status", "updated_at" DESC);


--
-- Name: idx_moderation_cases_target_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_moderation_cases_target_user" ON "public"."moderation_cases" USING "btree" ("target_user_id", "created_at" DESC) WHERE ("target_user_id" IS NOT NULL);


--
-- Name: idx_notification_delivery_attempts_notification; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notification_delivery_attempts_notification" ON "public"."notification_delivery_attempts" USING "btree" ("notification_id", "attempted_at" DESC);


--
-- Name: idx_notification_outbox_dedupe; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_notification_outbox_dedupe" ON "public"."notification_outbox" USING "btree" ("dedupe_key") WHERE ("dedupe_key" IS NOT NULL);


--
-- Name: idx_notification_outbox_status_next; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notification_outbox_status_next" ON "public"."notification_outbox" USING "btree" ("status", "next_attempt_at", "priority");


--
-- Name: idx_notification_outbox_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notification_outbox_target" ON "public"."notification_outbox" USING "btree" ("target_type", "target_id", "created_at" DESC) WHERE (("target_type" IS NOT NULL) AND ("target_id" IS NOT NULL));


--
-- Name: idx_notification_outbox_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notification_outbox_user_created" ON "public"."notification_outbox" USING "btree" ("user_id", "created_at" DESC) WHERE ("user_id" IS NOT NULL);


--
-- Name: idx_notification_preferences_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notification_preferences_updated" ON "public"."notification_preferences" USING "btree" ("updated_at" DESC);


--
-- Name: idx_notification_templates_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notification_templates_category" ON "public"."notification_templates" USING "btree" ("category", "enabled");


--
-- Name: idx_notification_templates_key_channel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notification_templates_key_channel" ON "public"."notification_templates" USING "btree" ("template_key", "channel", "locale");


--
-- Name: idx_ops_action_items_assignee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ops_action_items_assignee" ON "public"."ops_action_items" USING "btree" ("assigned_admin_user_id", "status", "due_at") WHERE ("assigned_admin_user_id" IS NOT NULL);


--
-- Name: idx_ops_action_items_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ops_action_items_source" ON "public"."ops_action_items" USING "btree" ("source_type", "source_id") WHERE ("source_id" IS NOT NULL);


--
-- Name: idx_ops_action_items_status_severity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ops_action_items_status_severity" ON "public"."ops_action_items" USING "btree" ("status", "severity", "created_at" DESC);


--
-- Name: idx_payment_events_merchant_event_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_payment_events_merchant_event_created" ON "public"."payment_events" USING "btree" ("merchant_trade_no", "event_type", "created_at" DESC) WHERE ("merchant_trade_no" IS NOT NULL);


--
-- Name: idx_payment_events_trade_no_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_payment_events_trade_no_created_at" ON "public"."payment_events" USING "btree" ("merchant_trade_no", "created_at" DESC);


--
-- Name: idx_payment_orders_invoice_preference_kind; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_payment_orders_invoice_preference_kind" ON "public"."payment_orders" USING "btree" ((("invoice_preference" ->> 'kind'::"text"))) WHERE ("invoice_preference" IS NOT NULL);


--
-- Name: idx_payment_orders_one_buddy_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_payment_orders_one_buddy_order" ON "public"."payment_orders" USING "btree" ("buddy_booking_id") WHERE (("buddy_booking_id" IS NOT NULL) AND ("status" = ANY (ARRAY['pending'::"text", 'paid'::"text"])));


--
-- Name: idx_payment_orders_status_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_payment_orders_status_created_at" ON "public"."payment_orders" USING "btree" ("status", "created_at" DESC);


--
-- Name: idx_payment_orders_user_id_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_payment_orders_user_id_created_at" ON "public"."payment_orders" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_profiles_professional_buddy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_professional_buddy" ON "public"."profiles" USING "btree" ("is_professional_buddy", "updated_at" DESC);


--
-- Name: idx_refund_events_request_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_refund_events_request_created" ON "public"."refund_events" USING "btree" ("refund_request_id", "created_at" DESC);


--
-- Name: idx_refund_requests_order_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_refund_requests_order_status_created" ON "public"."refund_requests" USING "btree" ("payment_order_id", "status", "created_at" DESC) WHERE ("payment_order_id" IS NOT NULL);


--
-- Name: idx_refund_requests_payment_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_refund_requests_payment_status_created" ON "public"."refund_requests" USING "btree" ("payment_order_id", "status", "created_at" DESC);


--
-- Name: idx_refund_requests_reviewed_by_admin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_refund_requests_reviewed_by_admin" ON "public"."refund_requests" USING "btree" ("reviewed_by_admin_user_id", "reviewed_at" DESC) WHERE ("reviewed_by_admin_user_id" IS NOT NULL);


--
-- Name: idx_refund_requests_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_refund_requests_status_created" ON "public"."refund_requests" USING "btree" ("status", "created_at" DESC);


--
-- Name: idx_refund_requests_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_refund_requests_user_created" ON "public"."refund_requests" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_reliability_events_room_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_reliability_events_room_created" ON "public"."reliability_events" USING "btree" ("room_id", "created_at" DESC) WHERE ("room_id" IS NOT NULL);


--
-- Name: idx_reliability_events_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_reliability_events_user_created" ON "public"."reliability_events" USING "btree" ("user_id", "created_at" DESC) WHERE ("user_id" IS NOT NULL);


--
-- Name: idx_room_access_sessions_room_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_access_sessions_room_user" ON "public"."room_access_sessions" USING "btree" ("room_id", "user_id", "created_at" DESC);


--
-- Name: idx_room_access_sessions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_access_sessions_status" ON "public"."room_access_sessions" USING "btree" ("status", "token_exp" DESC);


--
-- Name: idx_room_access_sessions_usage_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_access_sessions_usage_status" ON "public"."room_access_sessions" USING "btree" ("usage_status", "updated_at" DESC);


--
-- Name: idx_room_access_sessions_user_connected; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_access_sessions_user_connected" ON "public"."room_access_sessions" USING "btree" ("user_id", "connected_at" DESC);


--
-- Name: idx_room_extension_confirmations_room_window; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_extension_confirmations_room_window" ON "public"."room_extension_confirmations" USING "btree" ("room_id", "extension_window_key", "created_at" DESC);


--
-- Name: idx_room_extension_grants_room_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_extension_grants_room_created" ON "public"."room_extension_grants" USING "btree" ("room_id", "created_at" DESC);


--
-- Name: idx_room_extension_grants_sponsor_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_extension_grants_sponsor_created" ON "public"."room_extension_grants" USING "btree" ("sponsor_user_id", "created_at" DESC);


--
-- Name: idx_room_lifecycle_events_actor_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_lifecycle_events_actor_created" ON "public"."room_lifecycle_events" USING "btree" ("actor_user_id", "created_at" DESC);


--
-- Name: idx_room_lifecycle_events_room_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_lifecycle_events_room_created" ON "public"."room_lifecycle_events" USING "btree" ("room_id", "created_at" DESC);


--
-- Name: idx_room_member_presence_state_brb; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_member_presence_state_brb" ON "public"."room_member_presence_state" USING "btree" ("presence_status", "brb_until") WHERE ("presence_status" = 'brb'::"text");


--
-- Name: idx_room_member_presence_state_room_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_member_presence_state_room_updated" ON "public"."room_member_presence_state" USING "btree" ("room_id", "updated_at" DESC);


--
-- Name: idx_room_member_presence_state_user_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_member_presence_state_user_updated" ON "public"."room_member_presence_state" USING "btree" ("user_id", "updated_at" DESC);


--
-- Name: idx_room_participant_summaries_room_generated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_participant_summaries_room_generated" ON "public"."room_participant_summaries" USING "btree" ("room_id", "generated_at" DESC);


--
-- Name: idx_room_participant_summaries_user_generated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_participant_summaries_user_generated" ON "public"."room_participant_summaries" USING "btree" ("user_id", "generated_at" DESC);


--
-- Name: idx_room_presence_events_access_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_presence_events_access_session" ON "public"."room_presence_events" USING "btree" ("access_session_id", "created_at" DESC);


--
-- Name: idx_room_presence_events_room_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_presence_events_room_created" ON "public"."room_presence_events" USING "btree" ("room_id", "created_at" DESC);


--
-- Name: idx_room_presence_events_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_presence_events_user_created" ON "public"."room_presence_events" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_room_reconciliation_items_daily_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_reconciliation_items_daily_name" ON "public"."room_reconciliation_items" USING "btree" ("daily_room_name", "status", "created_at" DESC) WHERE ("daily_room_name" IS NOT NULL);


--
-- Name: idx_room_reconciliation_items_room; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_reconciliation_items_room" ON "public"."room_reconciliation_items" USING "btree" ("room_id", "status", "created_at" DESC) WHERE ("room_id" IS NOT NULL);


--
-- Name: idx_room_reconciliation_items_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_reconciliation_items_status_created" ON "public"."room_reconciliation_items" USING "btree" ("status", "severity", "created_at" DESC);


--
-- Name: idx_room_reconciliation_runs_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_reconciliation_runs_created" ON "public"."room_reconciliation_runs" USING "btree" ("created_at" DESC);


--
-- Name: idx_room_session_summaries_generated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_session_summaries_generated" ON "public"."room_session_summaries" USING "btree" ("generated_at" DESC);


--
-- Name: idx_room_session_summaries_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_room_session_summaries_status" ON "public"."room_session_summaries" USING "btree" ("status", "updated_at" DESC);


--
-- Name: idx_rooms_daily_room_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_rooms_daily_room_deleted_at" ON "public"."rooms" USING "btree" ("daily_room_deleted_at");


--
-- Name: idx_rooms_last_presence_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_rooms_last_presence_at" ON "public"."rooms" USING "btree" ("last_presence_at" DESC);


--
-- Name: idx_rooms_status_scheduled_end; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_rooms_status_scheduled_end" ON "public"."rooms" USING "btree" ("status", "scheduled_end_at" DESC);


--
-- Name: idx_security_audit_logs_target_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_security_audit_logs_target_user_id" ON "public"."security_audit_logs" USING "btree" ("target_user_id");


--
-- Name: idx_subscription_events_profile_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_subscription_events_profile_created" ON "public"."subscription_events" USING "btree" ("subscription_profile_id", "created_at" DESC);


--
-- Name: idx_subscription_events_profile_event_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_subscription_events_profile_event_created" ON "public"."subscription_events" USING "btree" ("subscription_profile_id", "event_type", "created_at" DESC) WHERE ("subscription_profile_id" IS NOT NULL);


--
-- Name: idx_subscription_payment_applications_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_subscription_payment_applications_user" ON "public"."subscription_payment_applications" USING "btree" ("user_id", "applied_at" DESC);


--
-- Name: idx_subscription_profiles_invoice_preference_kind; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_subscription_profiles_invoice_preference_kind" ON "public"."subscription_profiles" USING "btree" ((("invoice_preference" ->> 'kind'::"text"))) WHERE ("invoice_preference" IS NOT NULL);


--
-- Name: idx_subscription_profiles_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_subscription_profiles_status_created" ON "public"."subscription_profiles" USING "btree" ("status", "created_at" DESC);


--
-- Name: idx_subscription_profiles_status_next; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_subscription_profiles_status_next" ON "public"."subscription_profiles" USING "btree" ("status", "next_charge_at");


--
-- Name: idx_subscription_profiles_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_subscription_profiles_user_created" ON "public"."subscription_profiles" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_subscription_tasks_profile_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_subscription_tasks_profile_created" ON "public"."ecpay_subscription_tasks" USING "btree" ("subscription_profile_id", "created_at" DESC) WHERE ("subscription_profile_id" IS NOT NULL);


--
-- Name: idx_subscription_tasks_status_next; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_subscription_tasks_status_next" ON "public"."ecpay_subscription_tasks" USING "btree" ("status", "next_attempt_at");


--
-- Name: idx_support_ticket_events_ticket_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_support_ticket_events_ticket_created" ON "public"."support_ticket_events" USING "btree" ("ticket_id", "created_at" DESC);


--
-- Name: idx_support_ticket_messages_sender_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_support_ticket_messages_sender_created" ON "public"."support_ticket_messages" USING "btree" ("sender_user_id", "created_at" DESC);


--
-- Name: idx_support_ticket_messages_ticket_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_support_ticket_messages_ticket_created" ON "public"."support_ticket_messages" USING "btree" ("ticket_id", "created_at");


--
-- Name: idx_support_tickets_assigned_admin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_support_tickets_assigned_admin" ON "public"."support_tickets" USING "btree" ("assigned_admin_user_id", "updated_at" DESC) WHERE ("assigned_admin_user_id" IS NOT NULL);


--
-- Name: idx_support_tickets_payment_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_support_tickets_payment_order" ON "public"."support_tickets" USING "btree" ("related_payment_order_id") WHERE ("related_payment_order_id" IS NOT NULL);


--
-- Name: idx_support_tickets_related_room; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_support_tickets_related_room" ON "public"."support_tickets" USING "btree" ("related_room_id") WHERE ("related_room_id" IS NOT NULL);


--
-- Name: idx_support_tickets_status_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_support_tickets_status_updated" ON "public"."support_tickets" USING "btree" ("status", "updated_at" DESC);


--
-- Name: idx_support_tickets_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_support_tickets_user_created" ON "public"."support_tickets" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_user_blocks_blocked_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_blocks_blocked_user" ON "public"."user_blocks" USING "btree" ("blocked_user_id", "created_at" DESC);


--
-- Name: idx_user_blocks_blocker_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_blocks_blocker_user" ON "public"."user_blocks" USING "btree" ("blocker_user_id", "created_at" DESC);


--
-- Name: idx_user_identity_bindings_user_type_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_identity_bindings_user_type_status" ON "public"."user_identity_bindings" USING "btree" ("user_id", "binding_type", "status", "updated_at" DESC);


--
-- Name: idx_user_plan_entitlements_profile; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_plan_entitlements_profile" ON "public"."user_plan_entitlements" USING "btree" ("source_subscription_profile_id") WHERE ("source_subscription_profile_id" IS NOT NULL);


--
-- Name: idx_user_plan_entitlements_user_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_plan_entitlements_user_active" ON "public"."user_plan_entitlements" USING "btree" ("user_id", "status", "valid_until" DESC);


--
-- Name: idx_user_reports_linked_case; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_reports_linked_case" ON "public"."user_reports" USING "btree" ("linked_moderation_case_id") WHERE ("linked_moderation_case_id" IS NOT NULL);


--
-- Name: idx_user_reports_reporter_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_reports_reporter_created" ON "public"."user_reports" USING "btree" ("reporter_user_id", "created_at" DESC);


--
-- Name: idx_user_reports_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_reports_status_created" ON "public"."user_reports" USING "btree" ("status", "created_at" DESC);


--
-- Name: idx_user_reports_target_room; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_reports_target_room" ON "public"."user_reports" USING "btree" ("target_room_id", "created_at" DESC) WHERE ("target_room_id" IS NOT NULL);


--
-- Name: idx_user_reports_target_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_reports_target_user" ON "public"."user_reports" USING "btree" ("target_user_id", "created_at" DESC) WHERE ("target_user_id" IS NOT NULL);


--
-- Name: idx_user_security_flags_block_scope; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_security_flags_block_scope" ON "public"."user_security_flags" USING "btree" ("block_scope");


--
-- Name: idx_user_usage_wallet_events_room_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_usage_wallet_events_room_created" ON "public"."user_usage_wallet_events" USING "btree" ("room_id", "created_at" DESC) WHERE ("room_id" IS NOT NULL);


--
-- Name: idx_user_usage_wallet_events_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_usage_wallet_events_user_created" ON "public"."user_usage_wallet_events" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_user_usage_wallets_resource_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_usage_wallets_resource_period" ON "public"."user_usage_wallets" USING "btree" ("resource_key", "status", "period_end" DESC);


--
-- Name: idx_user_usage_wallets_user_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_usage_wallets_user_period" ON "public"."user_usage_wallets" USING "btree" ("user_id", "status", "period_end" DESC);


--
-- Name: idx_verified_phone_identities_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_verified_phone_identities_user_id" ON "public"."verified_phone_identities" USING "btree" ("user_id");


--
-- Name: invoice_events_payment_order_event_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "invoice_events_payment_order_event_type_idx" ON "public"."invoice_events" USING "btree" ("payment_order_id", "event_type", "created_at" DESC);


--
-- Name: moderation_actions_one_restore_per_appeal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "moderation_actions_one_restore_per_appeal" ON "public"."moderation_actions" USING "btree" ((("metadata" ->> 'appeal_id'::"text"))) WHERE (("action_type" = 'restore'::"text") AND (("metadata" ->> 'source'::"text") = 'appeal_resolution'::"text") AND (("metadata" ->> 'appeal_id'::"text") IS NOT NULL));


--
-- Name: profiles_handle_lower_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "profiles_handle_lower_idx" ON "public"."profiles" USING "btree" ("lower"("handle"));


--
-- Name: profiles_handle_unique_lower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "profiles_handle_unique_lower" ON "public"."profiles" USING "btree" ("lower"("handle")) WHERE (("handle" IS NOT NULL) AND ("handle" <> ''::"text"));


--
-- Name: room_members_room_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "room_members_room_idx" ON "public"."room_members" USING "btree" ("room_id");


--
-- Name: room_members_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "room_members_user_idx" ON "public"."room_members" USING "btree" ("user_id");


--
-- Name: room_presence_events_room_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "room_presence_events_room_created_idx" ON "public"."room_presence_events" USING "btree" ("room_id", "created_at" DESC);


--
-- Name: room_presence_events_user_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "room_presence_events_user_created_idx" ON "public"."room_presence_events" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: rooms_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "rooms_created_at_idx" ON "public"."rooms" USING "btree" ("created_at" DESC);


--
-- Name: rooms_invite_code_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "rooms_invite_code_idx" ON "public"."rooms" USING "btree" ("invite_code") WHERE ("invite_code" IS NOT NULL);


--
-- Name: rooms_one_owner_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "rooms_one_owner_active_idx" ON "public"."rooms" USING "btree" ("created_by") WHERE (("status" = 'active'::"text") AND ("ended_at" IS NULL));


--
-- Name: rooms_room_category_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "rooms_room_category_created_at_idx" ON "public"."rooms" USING "btree" ("room_category", "created_at" DESC);


--
-- Name: rooms_visibility_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "rooms_visibility_created_at_idx" ON "public"."rooms" USING "btree" ("visibility", "created_at" DESC);


--
-- Name: scheduled_room_posts_host_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "scheduled_room_posts_host_idx" ON "public"."scheduled_room_posts" USING "btree" ("host_user_id", "start_at");


--
-- Name: scheduled_room_posts_invite_code_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "scheduled_room_posts_invite_code_idx" ON "public"."scheduled_room_posts" USING "btree" ("invite_code") WHERE ("invite_code" IS NOT NULL);


--
-- Name: scheduled_room_posts_start_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "scheduled_room_posts_start_idx" ON "public"."scheduled_room_posts" USING "btree" ("start_at");


--
-- Name: user_blocks_id_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "user_blocks_id_unique" ON "public"."user_blocks" USING "btree" ("id");


--
-- Name: user_blocks_relationship_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "user_blocks_relationship_unique" ON "public"."user_blocks" USING "btree" ("blocker_user_id", "blocked_user_id");


--
-- Name: user_blocks_unique_pair_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "user_blocks_unique_pair_idx" ON "public"."user_blocks" USING "btree" ("blocker_user_id", "blocked_user_id");


--
-- Name: user_identity_bindings_user_type_value_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "user_identity_bindings_user_type_value_unique" ON "public"."user_identity_bindings" USING "btree" ("user_id", "binding_type", COALESCE("binding_value_masked", ''::"text"));


--
-- Name: abuse_reports trg_abuse_reports_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_abuse_reports_updated_at" BEFORE UPDATE ON "public"."abuse_reports" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();


--
-- Name: appeals trg_appeals_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_appeals_updated_at" BEFORE UPDATE ON "public"."appeals" FOR EACH ROW EXECUTE FUNCTION "public"."calmco_touch_updated_at"();


--
-- Name: buddy_booking_payment_applications trg_buddy_booking_payment_applications_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_buddy_booking_payment_applications_updated_at" BEFORE UPDATE ON "public"."buddy_booking_payment_applications" FOR EACH ROW EXECUTE FUNCTION "public"."calmco_p3_touch_updated_at"();


--
-- Name: buddy_bookings trg_buddy_bookings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_buddy_bookings_updated_at" BEFORE UPDATE ON "public"."buddy_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();


--
-- Name: buddy_payout_accounts trg_buddy_payout_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_buddy_payout_accounts_updated_at" BEFORE UPDATE ON "public"."buddy_payout_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."calmco_p3_touch_updated_at"();


--
-- Name: buddy_payout_batches trg_buddy_payout_batches_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_buddy_payout_batches_updated_at" BEFORE UPDATE ON "public"."buddy_payout_batches" FOR EACH ROW EXECUTE FUNCTION "public"."calmco_p3_touch_updated_at"();


--
-- Name: buddy_payout_items trg_buddy_payout_items_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_buddy_payout_items_updated_at" BEFORE UPDATE ON "public"."buddy_payout_items" FOR EACH ROW EXECUTE FUNCTION "public"."calmco_p3_touch_updated_at"();


--
-- Name: buddy_service_slots trg_buddy_service_slots_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_buddy_service_slots_updated_at" BEFORE UPDATE ON "public"."buddy_service_slots" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();


--
-- Name: buddy_services trg_buddy_services_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_buddy_services_updated_at" BEFORE UPDATE ON "public"."buddy_services" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();


--
-- Name: buddy_settlements trg_buddy_settlements_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_buddy_settlements_updated_at" BEFORE UPDATE ON "public"."buddy_settlements" FOR EACH ROW EXECUTE FUNCTION "public"."calmco_p3_touch_updated_at"();


--
-- Name: cowork_identity_monthly_usage trg_cowork_identity_monthly_usage_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_cowork_identity_monthly_usage_updated_at" BEFORE UPDATE ON "public"."cowork_identity_monthly_usage" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();


--
-- Name: friend_requests trg_friend_requests_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_friend_requests_updated_at" BEFORE UPDATE ON "public"."friend_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();


--
-- Name: refund_requests trg_p2_refund_reversal; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_p2_refund_reversal" AFTER UPDATE OF "status" ON "public"."refund_requests" FOR EACH ROW WHEN ((("new"."status" = 'refunded'::"text") AND ("old"."status" IS DISTINCT FROM "new"."status"))) EXECUTE FUNCTION "public"."cowork_p2_refund_reversal_trigger"();


--
-- Name: refund_requests trg_p3_buddy_refund_reversal; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_p3_buddy_refund_reversal" AFTER UPDATE OF "status" ON "public"."refund_requests" FOR EACH ROW EXECUTE FUNCTION "public"."cowork_p3_refund_reversal_trigger"();


--
-- Name: payment_orders trg_payment_orders_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_payment_orders_updated_at" BEFORE UPDATE ON "public"."payment_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();


--
-- Name: profiles trg_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();


--
-- Name: room_extension_confirmations trg_room_extension_confirmations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_room_extension_confirmations_updated_at" BEFORE UPDATE ON "public"."room_extension_confirmations" FOR EACH ROW EXECUTE FUNCTION "public"."cowork_p0_touch_updated_at"();


--
-- Name: room_extension_grants trg_room_extension_grants_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_room_extension_grants_updated_at" BEFORE UPDATE ON "public"."room_extension_grants" FOR EACH ROW EXECUTE FUNCTION "public"."cowork_p2_touch_updated_at"();


--
-- Name: room_member_presence_state trg_room_member_presence_state_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_room_member_presence_state_updated_at" BEFORE UPDATE ON "public"."room_member_presence_state" FOR EACH ROW EXECUTE FUNCTION "public"."cowork_p0_touch_updated_at"();


--
-- Name: room_participant_summaries trg_room_participant_summaries_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_room_participant_summaries_updated_at" BEFORE UPDATE ON "public"."room_participant_summaries" FOR EACH ROW EXECUTE FUNCTION "public"."cowork_p0_touch_updated_at"();


--
-- Name: room_session_summaries trg_room_session_summaries_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_room_session_summaries_updated_at" BEFORE UPDATE ON "public"."room_session_summaries" FOR EACH ROW EXECUTE FUNCTION "public"."cowork_p0_touch_updated_at"();


--
-- Name: rooms trg_rooms_prepare; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_rooms_prepare" BEFORE INSERT OR UPDATE ON "public"."rooms" FOR EACH ROW EXECUTE FUNCTION "public"."prepare_room_row"();


--
-- Name: rooms trg_rooms_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_rooms_updated_at" BEFORE UPDATE ON "public"."rooms" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();


--
-- Name: scheduled_room_posts trg_scheduled_room_posts_sync_timing; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_scheduled_room_posts_sync_timing" BEFORE INSERT OR UPDATE ON "public"."scheduled_room_posts" FOR EACH ROW EXECUTE FUNCTION "public"."prepare_scheduled_room_post"();


--
-- Name: scheduled_room_posts trg_scheduled_room_posts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_scheduled_room_posts_updated_at" BEFORE UPDATE ON "public"."scheduled_room_posts" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();


--
-- Name: user_plan_entitlements trg_user_plan_entitlements_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_user_plan_entitlements_updated_at" BEFORE UPDATE ON "public"."user_plan_entitlements" FOR EACH ROW EXECUTE FUNCTION "public"."cowork_p2_touch_updated_at"();


--
-- Name: user_private_profile_settings trg_user_private_profile_settings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_user_private_profile_settings_updated_at" BEFORE UPDATE ON "public"."user_private_profile_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();


--
-- Name: user_security_flags trg_user_security_flags_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_user_security_flags_updated_at" BEFORE UPDATE ON "public"."user_security_flags" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();


--
-- Name: user_usage_wallets trg_user_usage_wallets_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_user_usage_wallets_updated_at" BEFORE UPDATE ON "public"."user_usage_wallets" FOR EACH ROW EXECUTE FUNCTION "public"."cowork_p2_touch_updated_at"();


--
-- Name: abuse_reports abuse_reports_reporter_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."abuse_reports"
    ADD CONSTRAINT "abuse_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: abuse_reports abuse_reports_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."abuse_reports"
    ADD CONSTRAINT "abuse_reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: admin_audit_logs admin_audit_logs_actor_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_actor_admin_user_id_fkey" FOREIGN KEY ("actor_admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: admin_entity_notes admin_entity_notes_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_entity_notes"
    ADD CONSTRAINT "admin_entity_notes_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: admin_role_assignments admin_role_assignments_granted_by_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_role_assignments"
    ADD CONSTRAINT "admin_role_assignments_granted_by_admin_user_id_fkey" FOREIGN KEY ("granted_by_admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: admin_role_assignments admin_role_assignments_revoked_by_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_role_assignments"
    ADD CONSTRAINT "admin_role_assignments_revoked_by_admin_user_id_fkey" FOREIGN KEY ("revoked_by_admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: admin_role_assignments admin_role_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_role_assignments"
    ADD CONSTRAINT "admin_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ai_room_host_sessions ai_room_host_sessions_payer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_room_host_sessions"
    ADD CONSTRAINT "ai_room_host_sessions_payer_user_id_fkey" FOREIGN KEY ("payer_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: ai_room_host_sessions ai_room_host_sessions_room_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_room_host_sessions"
    ADD CONSTRAINT "ai_room_host_sessions_room_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;


--
-- Name: ai_room_host_sessions ai_room_host_sessions_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_room_host_sessions"
    ADD CONSTRAINT "ai_room_host_sessions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;


--
-- Name: ai_room_host_sessions ai_room_host_sessions_sponsor_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_room_host_sessions"
    ADD CONSTRAINT "ai_room_host_sessions_sponsor_fk" FOREIGN KEY ("sponsor_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ai_usage_events ai_usage_events_payer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_usage_events"
    ADD CONSTRAINT "ai_usage_events_payer_user_id_fkey" FOREIGN KEY ("payer_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: ai_usage_events ai_usage_events_room_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_usage_events"
    ADD CONSTRAINT "ai_usage_events_room_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE SET NULL;


--
-- Name: ai_usage_events ai_usage_events_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_usage_events"
    ADD CONSTRAINT "ai_usage_events_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE SET NULL;


--
-- Name: ai_usage_events ai_usage_events_session_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_usage_events"
    ADD CONSTRAINT "ai_usage_events_session_fk" FOREIGN KEY ("ai_session_id") REFERENCES "public"."ai_room_host_sessions"("id") ON DELETE SET NULL;


--
-- Name: ai_usage_events ai_usage_events_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_usage_events"
    ADD CONSTRAINT "ai_usage_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."ai_room_host_sessions"("id") ON DELETE SET NULL;


--
-- Name: ai_usage_events ai_usage_events_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_usage_events"
    ADD CONSTRAINT "ai_usage_events_user_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ai_user_mode_preferences ai_user_mode_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_user_mode_preferences"
    ADD CONSTRAINT "ai_user_mode_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: appeal_events appeal_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appeal_events"
    ADD CONSTRAINT "appeal_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: appeal_events appeal_events_appeal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appeal_events"
    ADD CONSTRAINT "appeal_events_appeal_id_fkey" FOREIGN KEY ("appeal_id") REFERENCES "public"."appeals"("id") ON DELETE CASCADE;


--
-- Name: appeal_messages appeal_messages_appeal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appeal_messages"
    ADD CONSTRAINT "appeal_messages_appeal_id_fkey" FOREIGN KEY ("appeal_id") REFERENCES "public"."appeals"("id") ON DELETE CASCADE;


--
-- Name: appeal_messages appeal_messages_sender_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appeal_messages"
    ADD CONSTRAINT "appeal_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: appeals appeals_moderation_action_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appeals"
    ADD CONSTRAINT "appeals_moderation_action_id_fkey" FOREIGN KEY ("moderation_action_id") REFERENCES "public"."moderation_actions"("id") ON DELETE SET NULL;


--
-- Name: appeals appeals_moderation_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appeals"
    ADD CONSTRAINT "appeals_moderation_case_id_fkey" FOREIGN KEY ("moderation_case_id") REFERENCES "public"."moderation_cases"("id") ON DELETE SET NULL;


--
-- Name: appeals appeals_resolution_action_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appeals"
    ADD CONSTRAINT "appeals_resolution_action_id_fkey" FOREIGN KEY ("resolution_action_id") REFERENCES "public"."moderation_actions"("id") ON DELETE SET NULL;


--
-- Name: appeals appeals_resolved_by_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appeals"
    ADD CONSTRAINT "appeals_resolved_by_admin_user_id_fkey" FOREIGN KEY ("resolved_by_admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: appeals appeals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appeals"
    ADD CONSTRAINT "appeals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: billing_ledger billing_ledger_buddy_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."billing_ledger"
    ADD CONSTRAINT "billing_ledger_buddy_booking_id_fkey" FOREIGN KEY ("buddy_booking_id") REFERENCES "public"."buddy_bookings"("id") ON DELETE SET NULL;


--
-- Name: billing_ledger billing_ledger_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."billing_ledger"
    ADD CONSTRAINT "billing_ledger_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE SET NULL;


--
-- Name: billing_ledger billing_ledger_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."billing_ledger"
    ADD CONSTRAINT "billing_ledger_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE SET NULL;


--
-- Name: billing_ledger billing_ledger_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."billing_ledger"
    ADD CONSTRAINT "billing_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: buddy_booking_events buddy_booking_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_booking_events"
    ADD CONSTRAINT "buddy_booking_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: buddy_booking_events buddy_booking_events_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_booking_events"
    ADD CONSTRAINT "buddy_booking_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."buddy_bookings"("id") ON DELETE CASCADE;


--
-- Name: buddy_booking_payment_applications buddy_booking_payment_applications_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_booking_payment_applications"
    ADD CONSTRAINT "buddy_booking_payment_applications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."buddy_bookings"("id") ON DELETE CASCADE;


--
-- Name: buddy_booking_payment_applications buddy_booking_payment_applications_buyer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_booking_payment_applications"
    ADD CONSTRAINT "buddy_booking_payment_applications_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: buddy_booking_payment_applications buddy_booking_payment_applications_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_booking_payment_applications"
    ADD CONSTRAINT "buddy_booking_payment_applications_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE CASCADE;


--
-- Name: buddy_booking_payment_applications buddy_booking_payment_applications_provider_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_booking_payment_applications"
    ADD CONSTRAINT "buddy_booking_payment_applications_provider_user_id_fkey" FOREIGN KEY ("provider_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: buddy_bookings buddy_bookings_buyer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_bookings"
    ADD CONSTRAINT "buddy_bookings_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: buddy_bookings buddy_bookings_linked_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_bookings"
    ADD CONSTRAINT "buddy_bookings_linked_room_id_fkey" FOREIGN KEY ("linked_room_id") REFERENCES "public"."rooms"("id") ON DELETE SET NULL;


--
-- Name: buddy_bookings buddy_bookings_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_bookings"
    ADD CONSTRAINT "buddy_bookings_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE SET NULL;


--
-- Name: buddy_bookings buddy_bookings_provider_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_bookings"
    ADD CONSTRAINT "buddy_bookings_provider_user_id_fkey" FOREIGN KEY ("provider_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: buddy_bookings buddy_bookings_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_bookings"
    ADD CONSTRAINT "buddy_bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."buddy_services"("id") ON DELETE CASCADE;


--
-- Name: buddy_bookings buddy_bookings_settlement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_bookings"
    ADD CONSTRAINT "buddy_bookings_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "public"."buddy_settlements"("id") ON DELETE SET NULL;


--
-- Name: buddy_disputes buddy_disputes_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_disputes"
    ADD CONSTRAINT "buddy_disputes_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: buddy_disputes buddy_disputes_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_disputes"
    ADD CONSTRAINT "buddy_disputes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."buddy_bookings"("id") ON DELETE CASCADE;


--
-- Name: buddy_disputes buddy_disputes_counterparty_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_disputes"
    ADD CONSTRAINT "buddy_disputes_counterparty_user_id_fkey" FOREIGN KEY ("counterparty_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: buddy_disputes buddy_disputes_opened_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_disputes"
    ADD CONSTRAINT "buddy_disputes_opened_by_user_id_fkey" FOREIGN KEY ("opened_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: buddy_disputes buddy_disputes_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_disputes"
    ADD CONSTRAINT "buddy_disputes_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."buddy_services"("id") ON DELETE SET NULL;


--
-- Name: buddy_payout_accounts buddy_payout_accounts_provider_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_payout_accounts"
    ADD CONSTRAINT "buddy_payout_accounts_provider_user_id_fkey" FOREIGN KEY ("provider_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: buddy_payout_accounts buddy_payout_accounts_verified_by_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_payout_accounts"
    ADD CONSTRAINT "buddy_payout_accounts_verified_by_admin_user_id_fkey" FOREIGN KEY ("verified_by_admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: buddy_payout_batches buddy_payout_batches_created_by_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_payout_batches"
    ADD CONSTRAINT "buddy_payout_batches_created_by_admin_user_id_fkey" FOREIGN KEY ("created_by_admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: buddy_payout_batches buddy_payout_batches_payout_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_payout_batches"
    ADD CONSTRAINT "buddy_payout_batches_payout_account_id_fkey" FOREIGN KEY ("payout_account_id") REFERENCES "public"."buddy_payout_accounts"("id") ON DELETE RESTRICT;


--
-- Name: buddy_payout_batches buddy_payout_batches_processed_by_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_payout_batches"
    ADD CONSTRAINT "buddy_payout_batches_processed_by_admin_user_id_fkey" FOREIGN KEY ("processed_by_admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: buddy_payout_batches buddy_payout_batches_provider_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_payout_batches"
    ADD CONSTRAINT "buddy_payout_batches_provider_user_id_fkey" FOREIGN KEY ("provider_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;


--
-- Name: buddy_payout_items buddy_payout_items_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_payout_items"
    ADD CONSTRAINT "buddy_payout_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."buddy_payout_batches"("id") ON DELETE CASCADE;


--
-- Name: buddy_payout_items buddy_payout_items_payout_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_payout_items"
    ADD CONSTRAINT "buddy_payout_items_payout_account_id_fkey" FOREIGN KEY ("payout_account_id") REFERENCES "public"."buddy_payout_accounts"("id") ON DELETE RESTRICT;


--
-- Name: buddy_payout_items buddy_payout_items_provider_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_payout_items"
    ADD CONSTRAINT "buddy_payout_items_provider_user_id_fkey" FOREIGN KEY ("provider_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;


--
-- Name: buddy_payout_items buddy_payout_items_settlement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_payout_items"
    ADD CONSTRAINT "buddy_payout_items_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "public"."buddy_settlements"("id") ON DELETE RESTRICT;


--
-- Name: buddy_provider_applications buddy_provider_applications_identity_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_provider_applications"
    ADD CONSTRAINT "buddy_provider_applications_identity_request_id_fkey" FOREIGN KEY ("identity_request_id") REFERENCES "public"."identity_verification_requests"("id") ON DELETE SET NULL;


--
-- Name: buddy_provider_applications buddy_provider_applications_reviewer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_provider_applications"
    ADD CONSTRAINT "buddy_provider_applications_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: buddy_provider_applications buddy_provider_applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_provider_applications"
    ADD CONSTRAINT "buddy_provider_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: buddy_reviews buddy_reviews_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_reviews"
    ADD CONSTRAINT "buddy_reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."buddy_bookings"("id") ON DELETE CASCADE;


--
-- Name: buddy_reviews buddy_reviews_reviewee_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_reviews"
    ADD CONSTRAINT "buddy_reviews_reviewee_user_id_fkey" FOREIGN KEY ("reviewee_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: buddy_reviews buddy_reviews_reviewer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_reviews"
    ADD CONSTRAINT "buddy_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: buddy_reviews buddy_reviews_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_reviews"
    ADD CONSTRAINT "buddy_reviews_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."buddy_services"("id") ON DELETE CASCADE;


--
-- Name: buddy_service_slots buddy_service_slots_provider_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_service_slots"
    ADD CONSTRAINT "buddy_service_slots_provider_user_id_fkey" FOREIGN KEY ("provider_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: buddy_service_slots buddy_service_slots_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_service_slots"
    ADD CONSTRAINT "buddy_service_slots_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."buddy_services"("id") ON DELETE CASCADE;


--
-- Name: buddy_services buddy_services_provider_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_services"
    ADD CONSTRAINT "buddy_services_provider_user_id_fkey" FOREIGN KEY ("provider_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: buddy_settlement_events buddy_settlement_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_settlement_events"
    ADD CONSTRAINT "buddy_settlement_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: buddy_settlement_events buddy_settlement_events_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_settlement_events"
    ADD CONSTRAINT "buddy_settlement_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."buddy_bookings"("id") ON DELETE CASCADE;


--
-- Name: buddy_settlement_events buddy_settlement_events_settlement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_settlement_events"
    ADD CONSTRAINT "buddy_settlement_events_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "public"."buddy_settlements"("id") ON DELETE CASCADE;


--
-- Name: buddy_settlements buddy_settlements_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_settlements"
    ADD CONSTRAINT "buddy_settlements_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."buddy_bookings"("id") ON DELETE CASCADE;


--
-- Name: buddy_settlements buddy_settlements_buyer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_settlements"
    ADD CONSTRAINT "buddy_settlements_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;


--
-- Name: buddy_settlements buddy_settlements_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_settlements"
    ADD CONSTRAINT "buddy_settlements_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE RESTRICT;


--
-- Name: buddy_settlements buddy_settlements_payout_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_settlements"
    ADD CONSTRAINT "buddy_settlements_payout_account_id_fkey" FOREIGN KEY ("payout_account_id") REFERENCES "public"."buddy_payout_accounts"("id") ON DELETE SET NULL;


--
-- Name: buddy_settlements buddy_settlements_payout_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_settlements"
    ADD CONSTRAINT "buddy_settlements_payout_batch_id_fkey" FOREIGN KEY ("payout_batch_id") REFERENCES "public"."buddy_payout_batches"("id") ON DELETE SET NULL;


--
-- Name: buddy_settlements buddy_settlements_provider_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."buddy_settlements"
    ADD CONSTRAINT "buddy_settlements_provider_user_id_fkey" FOREIGN KEY ("provider_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;


--
-- Name: cowork_monthly_usage cowork_monthly_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cowork_monthly_usage"
    ADD CONSTRAINT "cowork_monthly_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ecpay_invoice_tasks ecpay_invoice_tasks_invoice_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ecpay_invoice_tasks"
    ADD CONSTRAINT "ecpay_invoice_tasks_invoice_event_id_fkey" FOREIGN KEY ("invoice_event_id") REFERENCES "public"."invoice_events"("id") ON DELETE SET NULL;


--
-- Name: ecpay_invoice_tasks ecpay_invoice_tasks_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ecpay_invoice_tasks"
    ADD CONSTRAINT "ecpay_invoice_tasks_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE SET NULL;


--
-- Name: ecpay_refund_tasks ecpay_refund_tasks_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ecpay_refund_tasks"
    ADD CONSTRAINT "ecpay_refund_tasks_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE SET NULL;


--
-- Name: ecpay_refund_tasks ecpay_refund_tasks_refund_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ecpay_refund_tasks"
    ADD CONSTRAINT "ecpay_refund_tasks_refund_request_id_fkey" FOREIGN KEY ("refund_request_id") REFERENCES "public"."refund_requests"("id") ON DELETE SET NULL;


--
-- Name: ecpay_subscription_tasks ecpay_subscription_tasks_subscription_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ecpay_subscription_tasks"
    ADD CONSTRAINT "ecpay_subscription_tasks_subscription_profile_id_fkey" FOREIGN KEY ("subscription_profile_id") REFERENCES "public"."subscription_profiles"("id") ON DELETE SET NULL;


--
-- Name: ecpay_subscription_tasks ecpay_subscription_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ecpay_subscription_tasks"
    ADD CONSTRAINT "ecpay_subscription_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: entitlement_events entitlement_events_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."entitlement_events"
    ADD CONSTRAINT "entitlement_events_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE SET NULL;


--
-- Name: entitlement_events entitlement_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."entitlement_events"
    ADD CONSTRAINT "entitlement_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: friend_requests friend_requests_addressee_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_addressee_user_id_fkey" FOREIGN KEY ("addressee_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: friend_requests friend_requests_requester_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: friendships friendships_user_high_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user_high_fkey" FOREIGN KEY ("user_high") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: friendships friendships_user_low_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user_low_fkey" FOREIGN KEY ("user_low") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: identity_verification_requests identity_verification_requests_reviewer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."identity_verification_requests"
    ADD CONSTRAINT "identity_verification_requests_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: identity_verification_requests identity_verification_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."identity_verification_requests"
    ADD CONSTRAINT "identity_verification_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: invoice_events invoice_events_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."invoice_events"
    ADD CONSTRAINT "invoice_events_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE SET NULL;


--
-- Name: invoice_events invoice_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."invoice_events"
    ADD CONSTRAINT "invoice_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: moderation_actions moderation_actions_actor_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_actor_admin_user_id_fkey" FOREIGN KEY ("actor_admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: moderation_actions moderation_actions_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."moderation_cases"("id") ON DELETE SET NULL;


--
-- Name: moderation_actions moderation_actions_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: moderation_cases moderation_cases_assigned_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."moderation_cases"
    ADD CONSTRAINT "moderation_cases_assigned_admin_user_id_fkey" FOREIGN KEY ("assigned_admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: moderation_cases moderation_cases_source_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."moderation_cases"
    ADD CONSTRAINT "moderation_cases_source_report_id_fkey" FOREIGN KEY ("source_report_id") REFERENCES "public"."user_reports"("id") ON DELETE SET NULL;


--
-- Name: moderation_cases moderation_cases_target_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."moderation_cases"
    ADD CONSTRAINT "moderation_cases_target_room_id_fkey" FOREIGN KEY ("target_room_id") REFERENCES "public"."rooms"("id") ON DELETE SET NULL;


--
-- Name: moderation_cases moderation_cases_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."moderation_cases"
    ADD CONSTRAINT "moderation_cases_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: notification_delivery_attempts notification_delivery_attempts_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notification_delivery_attempts"
    ADD CONSTRAINT "notification_delivery_attempts_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."notification_outbox"("id") ON DELETE CASCADE;


--
-- Name: notification_outbox notification_outbox_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notification_outbox"
    ADD CONSTRAINT "notification_outbox_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ops_action_items ops_action_items_assigned_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ops_action_items"
    ADD CONSTRAINT "ops_action_items_assigned_admin_user_id_fkey" FOREIGN KEY ("assigned_admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: ops_action_items ops_action_items_resolved_by_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ops_action_items"
    ADD CONSTRAINT "ops_action_items_resolved_by_admin_user_id_fkey" FOREIGN KEY ("resolved_by_admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: payment_orders payment_orders_buddy_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_buddy_booking_id_fkey" FOREIGN KEY ("buddy_booking_id") REFERENCES "public"."buddy_bookings"("id") ON DELETE SET NULL;


--
-- Name: payment_orders payment_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: refund_events refund_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."refund_events"
    ADD CONSTRAINT "refund_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: refund_events refund_events_refund_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."refund_events"
    ADD CONSTRAINT "refund_events_refund_request_id_fkey" FOREIGN KEY ("refund_request_id") REFERENCES "public"."refund_requests"("id") ON DELETE CASCADE;


--
-- Name: refund_requests refund_requests_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE SET NULL;


--
-- Name: refund_requests refund_requests_reviewed_by_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_reviewed_by_admin_user_id_fkey" FOREIGN KEY ("reviewed_by_admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: refund_requests refund_requests_support_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_support_ticket_id_fkey" FOREIGN KEY ("support_ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE SET NULL;


--
-- Name: refund_requests refund_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: reliability_events reliability_events_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reliability_events"
    ADD CONSTRAINT "reliability_events_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE SET NULL;


--
-- Name: reliability_events reliability_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reliability_events"
    ADD CONSTRAINT "reliability_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: room_access_sessions room_access_sessions_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_access_sessions"
    ADD CONSTRAINT "room_access_sessions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;


--
-- Name: room_access_sessions room_access_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_access_sessions"
    ADD CONSTRAINT "room_access_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: room_extension_confirmations room_extension_confirmations_access_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_extension_confirmations"
    ADD CONSTRAINT "room_extension_confirmations_access_session_id_fkey" FOREIGN KEY ("access_session_id") REFERENCES "public"."room_access_sessions"("id") ON DELETE SET NULL;


--
-- Name: room_extension_confirmations room_extension_confirmations_extension_grant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_extension_confirmations"
    ADD CONSTRAINT "room_extension_confirmations_extension_grant_id_fkey" FOREIGN KEY ("extension_grant_id") REFERENCES "public"."room_extension_grants"("id") ON DELETE SET NULL;


--
-- Name: room_extension_confirmations room_extension_confirmations_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_extension_confirmations"
    ADD CONSTRAINT "room_extension_confirmations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;


--
-- Name: room_extension_confirmations room_extension_confirmations_sponsor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_extension_confirmations"
    ADD CONSTRAINT "room_extension_confirmations_sponsor_user_id_fkey" FOREIGN KEY ("sponsor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: room_extension_confirmations room_extension_confirmations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_extension_confirmations"
    ADD CONSTRAINT "room_extension_confirmations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: room_extension_grants room_extension_grants_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_extension_grants"
    ADD CONSTRAINT "room_extension_grants_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;


--
-- Name: room_extension_grants room_extension_grants_sponsor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_extension_grants"
    ADD CONSTRAINT "room_extension_grants_sponsor_user_id_fkey" FOREIGN KEY ("sponsor_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: room_extension_grants room_extension_grants_sponsor_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_extension_grants"
    ADD CONSTRAINT "room_extension_grants_sponsor_wallet_id_fkey" FOREIGN KEY ("sponsor_wallet_id") REFERENCES "public"."user_usage_wallets"("id") ON DELETE SET NULL;


--
-- Name: room_lifecycle_events room_lifecycle_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_lifecycle_events"
    ADD CONSTRAINT "room_lifecycle_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: room_lifecycle_events room_lifecycle_events_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_lifecycle_events"
    ADD CONSTRAINT "room_lifecycle_events_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE SET NULL;


--
-- Name: room_member_presence_state room_member_presence_state_access_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_member_presence_state"
    ADD CONSTRAINT "room_member_presence_state_access_session_id_fkey" FOREIGN KEY ("access_session_id") REFERENCES "public"."room_access_sessions"("id") ON DELETE SET NULL;


--
-- Name: room_member_presence_state room_member_presence_state_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_member_presence_state"
    ADD CONSTRAINT "room_member_presence_state_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;


--
-- Name: room_member_presence_state room_member_presence_state_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_member_presence_state"
    ADD CONSTRAINT "room_member_presence_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: room_members room_members_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_members"
    ADD CONSTRAINT "room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;


--
-- Name: room_participant_summaries room_participant_summaries_access_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_participant_summaries"
    ADD CONSTRAINT "room_participant_summaries_access_session_id_fkey" FOREIGN KEY ("access_session_id") REFERENCES "public"."room_access_sessions"("id") ON DELETE SET NULL;


--
-- Name: room_participant_summaries room_participant_summaries_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_participant_summaries"
    ADD CONSTRAINT "room_participant_summaries_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;


--
-- Name: room_participant_summaries room_participant_summaries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_participant_summaries"
    ADD CONSTRAINT "room_participant_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: room_presence_events room_presence_events_access_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_presence_events"
    ADD CONSTRAINT "room_presence_events_access_session_id_fkey" FOREIGN KEY ("access_session_id") REFERENCES "public"."room_access_sessions"("id") ON DELETE SET NULL;


--
-- Name: room_presence_events room_presence_events_room_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_presence_events"
    ADD CONSTRAINT "room_presence_events_room_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;


--
-- Name: room_presence_events room_presence_events_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_presence_events"
    ADD CONSTRAINT "room_presence_events_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;


--
-- Name: room_presence_events room_presence_events_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_presence_events"
    ADD CONSTRAINT "room_presence_events_user_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: room_presence_events room_presence_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_presence_events"
    ADD CONSTRAINT "room_presence_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: room_reconciliation_items room_reconciliation_items_fixed_by_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_reconciliation_items"
    ADD CONSTRAINT "room_reconciliation_items_fixed_by_admin_user_id_fkey" FOREIGN KEY ("fixed_by_admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: room_reconciliation_items room_reconciliation_items_ignored_by_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_reconciliation_items"
    ADD CONSTRAINT "room_reconciliation_items_ignored_by_admin_user_id_fkey" FOREIGN KEY ("ignored_by_admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: room_reconciliation_items room_reconciliation_items_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_reconciliation_items"
    ADD CONSTRAINT "room_reconciliation_items_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE SET NULL;


--
-- Name: room_reconciliation_items room_reconciliation_items_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_reconciliation_items"
    ADD CONSTRAINT "room_reconciliation_items_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."room_reconciliation_runs"("id") ON DELETE SET NULL;


--
-- Name: room_reconciliation_runs room_reconciliation_runs_triggered_by_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_reconciliation_runs"
    ADD CONSTRAINT "room_reconciliation_runs_triggered_by_admin_user_id_fkey" FOREIGN KEY ("triggered_by_admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: room_session_summaries room_session_summaries_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."room_session_summaries"
    ADD CONSTRAINT "room_session_summaries_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;


--
-- Name: scheduled_room_posts scheduled_room_posts_host_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scheduled_room_posts"
    ADD CONSTRAINT "scheduled_room_posts_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: security_audit_logs security_audit_logs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."security_audit_logs"
    ADD CONSTRAINT "security_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: security_audit_logs security_audit_logs_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."security_audit_logs"
    ADD CONSTRAINT "security_audit_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: subscription_events subscription_events_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE SET NULL;


--
-- Name: subscription_events subscription_events_subscription_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_subscription_profile_id_fkey" FOREIGN KEY ("subscription_profile_id") REFERENCES "public"."subscription_profiles"("id") ON DELETE CASCADE;


--
-- Name: subscription_events subscription_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: subscription_payment_applications subscription_payment_applicatio_reversal_refund_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."subscription_payment_applications"
    ADD CONSTRAINT "subscription_payment_applicatio_reversal_refund_request_id_fkey" FOREIGN KEY ("reversal_refund_request_id") REFERENCES "public"."refund_requests"("id") ON DELETE SET NULL;


--
-- Name: subscription_payment_applications subscription_payment_applications_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."subscription_payment_applications"
    ADD CONSTRAINT "subscription_payment_applications_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE CASCADE;


--
-- Name: subscription_payment_applications subscription_payment_applications_subscription_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."subscription_payment_applications"
    ADD CONSTRAINT "subscription_payment_applications_subscription_profile_id_fkey" FOREIGN KEY ("subscription_profile_id") REFERENCES "public"."subscription_profiles"("id") ON DELETE SET NULL;


--
-- Name: subscription_payment_applications subscription_payment_applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."subscription_payment_applications"
    ADD CONSTRAINT "subscription_payment_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: subscription_profiles subscription_profiles_cancel_requested_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."subscription_profiles"
    ADD CONSTRAINT "subscription_profiles_cancel_requested_by_user_id_fkey" FOREIGN KEY ("cancel_requested_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: subscription_profiles subscription_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."subscription_profiles"
    ADD CONSTRAINT "subscription_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: support_ticket_events support_ticket_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."support_ticket_events"
    ADD CONSTRAINT "support_ticket_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: support_ticket_events support_ticket_events_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."support_ticket_events"
    ADD CONSTRAINT "support_ticket_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE;


--
-- Name: support_ticket_messages support_ticket_messages_sender_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: support_ticket_messages support_ticket_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_assigned_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_assigned_admin_user_id_fkey" FOREIGN KEY ("assigned_admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_related_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_related_booking_id_fkey" FOREIGN KEY ("related_booking_id") REFERENCES "public"."buddy_bookings"("id") ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_related_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_related_payment_order_id_fkey" FOREIGN KEY ("related_payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_related_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_related_room_id_fkey" FOREIGN KEY ("related_room_id") REFERENCES "public"."rooms"("id") ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_blocks user_blocks_blocked_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_blocks user_blocks_blocker_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocker_user_id_fkey" FOREIGN KEY ("blocker_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_blocks user_blocks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_entitlements user_entitlements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_entitlements"
    ADD CONSTRAINT "user_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_identity_bindings user_identity_bindings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_identity_bindings"
    ADD CONSTRAINT "user_identity_bindings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_plan_entitlements user_plan_entitlements_source_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_plan_entitlements"
    ADD CONSTRAINT "user_plan_entitlements_source_payment_order_id_fkey" FOREIGN KEY ("source_payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE SET NULL;


--
-- Name: user_plan_entitlements user_plan_entitlements_source_subscription_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_plan_entitlements"
    ADD CONSTRAINT "user_plan_entitlements_source_subscription_profile_id_fkey" FOREIGN KEY ("source_subscription_profile_id") REFERENCES "public"."subscription_profiles"("id") ON DELETE SET NULL;


--
-- Name: user_plan_entitlements user_plan_entitlements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_plan_entitlements"
    ADD CONSTRAINT "user_plan_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_private_profile_settings user_private_profile_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_private_profile_settings"
    ADD CONSTRAINT "user_private_profile_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_reports user_reports_linked_moderation_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_linked_moderation_case_id_fkey" FOREIGN KEY ("linked_moderation_case_id") REFERENCES "public"."moderation_cases"("id") ON DELETE SET NULL;


--
-- Name: user_reports user_reports_reporter_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_reports user_reports_target_buddy_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_target_buddy_booking_id_fkey" FOREIGN KEY ("target_buddy_booking_id") REFERENCES "public"."buddy_bookings"("id") ON DELETE SET NULL;


--
-- Name: user_reports user_reports_target_buddy_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_target_buddy_service_id_fkey" FOREIGN KEY ("target_buddy_service_id") REFERENCES "public"."buddy_services"("id") ON DELETE SET NULL;


--
-- Name: user_reports user_reports_target_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_target_room_id_fkey" FOREIGN KEY ("target_room_id") REFERENCES "public"."rooms"("id") ON DELETE SET NULL;


--
-- Name: user_reports user_reports_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: user_security_flags user_security_flags_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_security_flags"
    ADD CONSTRAINT "user_security_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_usage_wallet_events user_usage_wallet_events_access_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_usage_wallet_events"
    ADD CONSTRAINT "user_usage_wallet_events_access_session_id_fkey" FOREIGN KEY ("access_session_id") REFERENCES "public"."room_access_sessions"("id") ON DELETE SET NULL;


--
-- Name: user_usage_wallet_events user_usage_wallet_events_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_usage_wallet_events"
    ADD CONSTRAINT "user_usage_wallet_events_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE SET NULL;


--
-- Name: user_usage_wallet_events user_usage_wallet_events_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_usage_wallet_events"
    ADD CONSTRAINT "user_usage_wallet_events_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE SET NULL;


--
-- Name: user_usage_wallet_events user_usage_wallet_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_usage_wallet_events"
    ADD CONSTRAINT "user_usage_wallet_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_usage_wallet_events user_usage_wallet_events_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_usage_wallet_events"
    ADD CONSTRAINT "user_usage_wallet_events_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."user_usage_wallets"("id") ON DELETE SET NULL;


--
-- Name: user_usage_wallets user_usage_wallets_source_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_usage_wallets"
    ADD CONSTRAINT "user_usage_wallets_source_payment_order_id_fkey" FOREIGN KEY ("source_payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE SET NULL;


--
-- Name: user_usage_wallets user_usage_wallets_source_subscription_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_usage_wallets"
    ADD CONSTRAINT "user_usage_wallets_source_subscription_profile_id_fkey" FOREIGN KEY ("source_subscription_profile_id") REFERENCES "public"."subscription_profiles"("id") ON DELETE SET NULL;


--
-- Name: user_usage_wallets user_usage_wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_usage_wallets"
    ADD CONSTRAINT "user_usage_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: verified_phone_identities verified_phone_identities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."verified_phone_identities"
    ADD CONSTRAINT "verified_phone_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: abuse_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."abuse_reports" ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_audit_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admin_audit_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_entity_notes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admin_entity_notes" ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_permission_presets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admin_permission_presets" ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_role_assignments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admin_role_assignments" ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_room_host_sessions ai host sessions payer read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai host sessions payer read" ON "public"."ai_room_host_sessions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "payer_user_id"));


--
-- Name: ai_room_host_sessions ai host sessions readable by room members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai host sessions readable by room members" ON "public"."ai_room_host_sessions" FOR SELECT TO "authenticated" USING ((("sponsor_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."room_members" "rm"
  WHERE (("rm"."room_id" = "ai_room_host_sessions"."room_id") AND ("rm"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."rooms" "r"
  WHERE (("r"."id" = "ai_room_host_sessions"."room_id") AND ("r"."created_by" = "auth"."uid"()))))));


--
-- Name: ai_usage_events ai usage payer read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai usage payer read" ON "public"."ai_usage_events" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "payer_user_id") OR ("auth"."uid"() = ANY ("benefited_user_ids"))));


--
-- Name: ai_room_host_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ai_room_host_sessions" ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_room_host_sessions ai_room_host_sessions_select_room_members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_room_host_sessions_select_room_members" ON "public"."ai_room_host_sessions" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."room_members" "rm"
  WHERE (("rm"."room_id" = "ai_room_host_sessions"."room_id") AND ("rm"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."rooms" "r"
  WHERE (("r"."id" = "ai_room_host_sessions"."room_id") AND ("r"."created_by" = "auth"."uid"()))))));


--
-- Name: ai_usage_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ai_usage_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage_events ai_usage_events_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_usage_events_select_own" ON "public"."ai_usage_events" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() = "payer_user_id")));


--
-- Name: ai_user_mode_preferences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ai_user_mode_preferences" ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_user_mode_preferences ai_user_mode_preferences_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_user_mode_preferences_select_own" ON "public"."ai_user_mode_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: ai_user_mode_preferences ai_user_mode_preferences_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_user_mode_preferences_update_own" ON "public"."ai_user_mode_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: ai_user_mode_preferences ai_user_mode_preferences_upsert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_user_mode_preferences_upsert_own" ON "public"."ai_user_mode_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: appeal_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."appeal_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: appeal_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."appeal_messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: appeals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."appeals" ENABLE ROW LEVEL SECURITY;

--
-- Name: appeals appeals_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "appeals_select_own" ON "public"."appeals" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: auth_sms_attempts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."auth_sms_attempts" ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_sms_attempts auth_sms_attempts_service_role_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "auth_sms_attempts_service_role_only" ON "public"."auth_sms_attempts" USING (false) WITH CHECK (false);


--
-- Name: billing_automation_locks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."billing_automation_locks" ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_automation_runs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."billing_automation_runs" ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_ledger; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."billing_ledger" ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_ledger billing_ledger_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "billing_ledger_select_own" ON "public"."billing_ledger" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: buddy_booking_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."buddy_booking_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: buddy_booking_payment_applications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."buddy_booking_payment_applications" ENABLE ROW LEVEL SECURITY;

--
-- Name: buddy_bookings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."buddy_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: buddy_bookings buddy_bookings_insert_buyer; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_bookings_insert_buyer" ON "public"."buddy_bookings" FOR INSERT TO "authenticated" WITH CHECK (("buyer_user_id" = "auth"."uid"()));


--
-- Name: buddy_bookings buddy_bookings_select_parties; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_bookings_select_parties" ON "public"."buddy_bookings" FOR SELECT TO "authenticated" USING ((("buyer_user_id" = "auth"."uid"()) OR ("provider_user_id" = "auth"."uid"())));


--
-- Name: buddy_bookings buddy_bookings_update_parties; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_bookings_update_parties" ON "public"."buddy_bookings" FOR UPDATE TO "authenticated" USING ((("buyer_user_id" = "auth"."uid"()) OR ("provider_user_id" = "auth"."uid"()))) WITH CHECK ((("buyer_user_id" = "auth"."uid"()) OR ("provider_user_id" = "auth"."uid"())));


--
-- Name: buddy_disputes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."buddy_disputes" ENABLE ROW LEVEL SECURITY;

--
-- Name: buddy_payout_accounts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."buddy_payout_accounts" ENABLE ROW LEVEL SECURITY;

--
-- Name: buddy_payout_batches; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."buddy_payout_batches" ENABLE ROW LEVEL SECURITY;

--
-- Name: buddy_payout_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."buddy_payout_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: buddy_provider_applications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."buddy_provider_applications" ENABLE ROW LEVEL SECURITY;

--
-- Name: buddy_reviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."buddy_reviews" ENABLE ROW LEVEL SECURITY;

--
-- Name: buddy_reviews buddy_reviews_insert_reviewer; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_reviews_insert_reviewer" ON "public"."buddy_reviews" FOR INSERT TO "authenticated" WITH CHECK (("reviewer_user_id" = "auth"."uid"()));


--
-- Name: buddy_reviews buddy_reviews_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_reviews_select_all" ON "public"."buddy_reviews" FOR SELECT TO "authenticated", "anon" USING (true);


--
-- Name: buddy_reviews buddy_reviews_select_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_reviews_select_public" ON "public"."buddy_reviews" FOR SELECT TO "authenticated", "anon" USING (true);


--
-- Name: buddy_reviews buddy_reviews_update_reviewer; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_reviews_update_reviewer" ON "public"."buddy_reviews" FOR UPDATE TO "authenticated" USING (("reviewer_user_id" = "auth"."uid"())) WITH CHECK (("reviewer_user_id" = "auth"."uid"()));


--
-- Name: buddy_service_slots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."buddy_service_slots" ENABLE ROW LEVEL SECURITY;

--
-- Name: buddy_service_slots buddy_service_slots_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_service_slots_delete_own" ON "public"."buddy_service_slots" FOR DELETE TO "authenticated" USING (("provider_user_id" = "auth"."uid"()));


--
-- Name: buddy_service_slots buddy_service_slots_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_service_slots_insert_own" ON "public"."buddy_service_slots" FOR INSERT TO "authenticated" WITH CHECK (("provider_user_id" = "auth"."uid"()));


--
-- Name: buddy_service_slots buddy_service_slots_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_service_slots_select_all" ON "public"."buddy_service_slots" FOR SELECT TO "authenticated" USING (true);


--
-- Name: buddy_service_slots buddy_service_slots_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_service_slots_update_own" ON "public"."buddy_service_slots" FOR UPDATE TO "authenticated" USING (("provider_user_id" = "auth"."uid"())) WITH CHECK (("provider_user_id" = "auth"."uid"()));


--
-- Name: buddy_services; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."buddy_services" ENABLE ROW LEVEL SECURITY;

--
-- Name: buddy_services buddy_services_authenticated_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_services_authenticated_select" ON "public"."buddy_services" FOR SELECT TO "authenticated" USING ((("provider_user_id" = "auth"."uid"()) OR (("status" = 'active'::"text") AND ("visibility" = ANY (ARRAY['public'::"text", 'members'::"text", 'friends'::"text"])))));


--
-- Name: buddy_services buddy_services_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_services_delete_own" ON "public"."buddy_services" FOR DELETE TO "authenticated" USING (("provider_user_id" = "auth"."uid"()));


--
-- Name: buddy_services buddy_services_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_services_insert_own" ON "public"."buddy_services" FOR INSERT TO "authenticated" WITH CHECK (("provider_user_id" = "auth"."uid"()));


--
-- Name: buddy_services buddy_services_public_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_services_public_select" ON "public"."buddy_services" FOR SELECT TO "anon" USING ((("status" = 'active'::"text") AND ("visibility" = 'public'::"text")));


--
-- Name: buddy_services buddy_services_select_anon_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_services_select_anon_public" ON "public"."buddy_services" FOR SELECT TO "anon" USING ((("status" = 'active'::"text") AND ("visibility" = 'public'::"text")));


--
-- Name: buddy_services buddy_services_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_services_select_authenticated" ON "public"."buddy_services" FOR SELECT TO "authenticated" USING ((("provider_user_id" = "auth"."uid"()) OR (("status" = 'active'::"text") AND ("visibility" = 'public'::"text")) OR (("status" = 'active'::"text") AND ("visibility" = 'members'::"text") AND "public"."viewer_is_vip"("auth"."uid"())) OR (("status" = 'active'::"text") AND ("visibility" = 'friends'::"text") AND "public"."viewer_is_friend"("auth"."uid"(), "provider_user_id"))));


--
-- Name: buddy_services buddy_services_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_services_update_own" ON "public"."buddy_services" FOR UPDATE TO "authenticated" USING (("provider_user_id" = "auth"."uid"())) WITH CHECK (("provider_user_id" = "auth"."uid"()));


--
-- Name: buddy_settlement_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."buddy_settlement_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: buddy_settlements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."buddy_settlements" ENABLE ROW LEVEL SECURITY;

--
-- Name: cowork_identity_monthly_usage; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cowork_identity_monthly_usage" ENABLE ROW LEVEL SECURITY;

--
-- Name: cowork_monthly_usage; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cowork_monthly_usage" ENABLE ROW LEVEL SECURITY;

--
-- Name: ecpay_invoice_tasks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ecpay_invoice_tasks" ENABLE ROW LEVEL SECURITY;

--
-- Name: ecpay_refund_tasks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ecpay_refund_tasks" ENABLE ROW LEVEL SECURITY;

--
-- Name: ecpay_subscription_tasks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ecpay_subscription_tasks" ENABLE ROW LEVEL SECURITY;

--
-- Name: entitlement_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."entitlement_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: entitlement_events entitlement_events_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "entitlement_events_select_own" ON "public"."entitlement_events" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: friend_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."friend_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: friend_requests friend_requests_insert_requester; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "friend_requests_insert_requester" ON "public"."friend_requests" FOR INSERT TO "authenticated" WITH CHECK ((("requester_user_id" = "auth"."uid"()) AND ("requester_user_id" <> "addressee_user_id")));


--
-- Name: friend_requests friend_requests_select_parties; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "friend_requests_select_parties" ON "public"."friend_requests" FOR SELECT TO "authenticated" USING ((("requester_user_id" = "auth"."uid"()) OR ("addressee_user_id" = "auth"."uid"())));


--
-- Name: friend_requests friend_requests_update_parties; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "friend_requests_update_parties" ON "public"."friend_requests" FOR UPDATE TO "authenticated" USING ((("requester_user_id" = "auth"."uid"()) OR ("addressee_user_id" = "auth"."uid"()))) WITH CHECK ((("requester_user_id" = "auth"."uid"()) OR ("addressee_user_id" = "auth"."uid"())));


--
-- Name: friendships; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;

--
-- Name: friendships friendships_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "friendships_delete_own" ON "public"."friendships" FOR DELETE TO "authenticated" USING ((("user_low" = "auth"."uid"()) OR ("user_high" = "auth"."uid"())));


--
-- Name: friendships friendships_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "friendships_insert_own" ON "public"."friendships" FOR INSERT TO "authenticated" WITH CHECK (((("user_low" = "auth"."uid"()) OR ("user_high" = "auth"."uid"())) AND ("user_low" < "user_high")));


--
-- Name: friendships friendships_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "friendships_select_own" ON "public"."friendships" FOR SELECT TO "authenticated" USING ((("user_low" = "auth"."uid"()) OR ("user_high" = "auth"."uid"())));


--
-- Name: user_identity_bindings identity_bindings_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "identity_bindings_select_own" ON "public"."user_identity_bindings" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));


--
-- Name: identity_verification_requests identity_requests_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "identity_requests_select_own" ON "public"."identity_verification_requests" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));


--
-- Name: identity_verification_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."identity_verification_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."invoice_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_events invoice_events_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "invoice_events_select_own" ON "public"."invoice_events" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: room_members members_delete_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "members_delete_self" ON "public"."room_members" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));


--
-- Name: room_members members_insert_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "members_insert_self" ON "public"."room_members" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."can_join_room"("auth"."uid"(), "room_id")));


--
-- Name: room_members members_select_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "members_select_self" ON "public"."room_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));


--
-- Name: moderation_actions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."moderation_actions" ENABLE ROW LEVEL SECURITY;

--
-- Name: moderation_cases; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."moderation_cases" ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_delivery_attempts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."notification_delivery_attempts" ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_outbox; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."notification_outbox" ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_outbox notification_outbox_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notification_outbox_select_own" ON "public"."notification_outbox" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_preferences notification_preferences_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notification_preferences_insert_own" ON "public"."notification_preferences" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: notification_preferences notification_preferences_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notification_preferences_select_own" ON "public"."notification_preferences" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: notification_preferences notification_preferences_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notification_preferences_update_own" ON "public"."notification_preferences" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: notification_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."notification_templates" ENABLE ROW LEVEL SECURITY;

--
-- Name: ops_action_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ops_action_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."payment_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_events payment_events_no_direct_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "payment_events_no_direct_delete" ON "public"."payment_events" FOR DELETE TO "authenticated" USING (false);


--
-- Name: payment_events payment_events_no_direct_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "payment_events_no_direct_insert" ON "public"."payment_events" FOR INSERT TO "authenticated" WITH CHECK (false);


--
-- Name: payment_events payment_events_no_direct_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "payment_events_no_direct_select" ON "public"."payment_events" FOR SELECT TO "authenticated" USING (false);


--
-- Name: payment_events payment_events_no_direct_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "payment_events_no_direct_update" ON "public"."payment_events" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);


--
-- Name: payment_orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."payment_orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_orders payment_orders_no_direct_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "payment_orders_no_direct_delete" ON "public"."payment_orders" FOR DELETE TO "authenticated" USING (false);


--
-- Name: payment_orders payment_orders_no_direct_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "payment_orders_no_direct_insert" ON "public"."payment_orders" FOR INSERT TO "authenticated" WITH CHECK (false);


--
-- Name: payment_orders payment_orders_no_direct_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "payment_orders_no_direct_update" ON "public"."payment_orders" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);


--
-- Name: payment_orders payment_orders_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "payment_orders_select_own" ON "public"."payment_orders" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));


--
-- Name: user_private_profile_settings private_settings_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "private_settings_insert_own" ON "public"."user_private_profile_settings" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: user_private_profile_settings private_settings_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "private_settings_select_own" ON "public"."user_private_profile_settings" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));


--
-- Name: user_private_profile_settings private_settings_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "private_settings_update_own" ON "public"."user_private_profile_settings" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "profiles_delete_own" ON "public"."profiles" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));


--
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: profiles profiles_select_anon_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "profiles_select_anon_public" ON "public"."profiles" FOR SELECT TO "anon" USING (("visibility" = 'public'::"text"));


--
-- Name: profiles profiles_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "profiles_select_authenticated" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("visibility" = ANY (ARRAY['public'::"text", 'members'::"text"]))));


--
-- Name: profiles profiles_select_public_or_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "profiles_select_public_or_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("visibility" = 'public'::"text") OR ("user_id" = "auth"."uid"())));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: buddy_provider_applications provider_applications_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "provider_applications_select_own" ON "public"."buddy_provider_applications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));


--
-- Name: user_entitlements read_own_entitlement; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "read_own_entitlement" ON "public"."user_entitlements" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: cowork_monthly_usage read_own_monthly_usage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "read_own_monthly_usage" ON "public"."cowork_monthly_usage" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: refund_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."refund_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: refund_events refund_events_select_own_request; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "refund_events_select_own_request" ON "public"."refund_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."refund_requests" "r"
  WHERE (("r"."id" = "refund_events"."refund_request_id") AND ("r"."user_id" = "auth"."uid"())))));


--
-- Name: refund_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."refund_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: refund_requests refund_requests_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "refund_requests_select_own" ON "public"."refund_requests" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: reliability_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."reliability_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: reliability_events reliability_events_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reliability_events_select_own" ON "public"."reliability_events" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: room_presence_events room presence own insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "room presence own insert" ON "public"."room_presence_events" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: room_presence_events room presence own read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "room presence own read" ON "public"."room_presence_events" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: room_presence_events room presence readable by room members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "room presence readable by room members" ON "public"."room_presence_events" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."room_members" "rm"
  WHERE (("rm"."room_id" = "room_presence_events"."room_id") AND ("rm"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."rooms" "r"
  WHERE (("r"."id" = "room_presence_events"."room_id") AND ("r"."created_by" = "auth"."uid"()))))));


--
-- Name: room_access_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."room_access_sessions" ENABLE ROW LEVEL SECURITY;

--
-- Name: room_access_sessions room_access_sessions_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "room_access_sessions_select_own" ON "public"."room_access_sessions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: room_extension_confirmations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."room_extension_confirmations" ENABLE ROW LEVEL SECURITY;

--
-- Name: room_extension_grants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."room_extension_grants" ENABLE ROW LEVEL SECURITY;

--
-- Name: room_lifecycle_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."room_lifecycle_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: room_lifecycle_events room_lifecycle_events_no_direct_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "room_lifecycle_events_no_direct_select" ON "public"."room_lifecycle_events" FOR SELECT TO "authenticated" USING (false);


--
-- Name: room_member_presence_state; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."room_member_presence_state" ENABLE ROW LEVEL SECURITY;

--
-- Name: room_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."room_members" ENABLE ROW LEVEL SECURITY;

--
-- Name: room_participant_summaries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."room_participant_summaries" ENABLE ROW LEVEL SECURITY;

--
-- Name: room_presence_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."room_presence_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: room_presence_events room_presence_events_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "room_presence_events_select_own" ON "public"."room_presence_events" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: room_reconciliation_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."room_reconciliation_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: room_reconciliation_runs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."room_reconciliation_runs" ENABLE ROW LEVEL SECURITY;

--
-- Name: room_session_summaries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."room_session_summaries" ENABLE ROW LEVEL SECURITY;

--
-- Name: rooms; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;

--
-- Name: rooms rooms_delete_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "rooms_delete_owner" ON "public"."rooms" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "created_by"));


--
-- Name: rooms rooms_insert_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "rooms_insert_owner" ON "public"."rooms" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));


--
-- Name: rooms rooms_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "rooms_select_authenticated" ON "public"."rooms" FOR SELECT TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR ("visibility" = 'public'::"text") OR (("visibility" = 'members'::"text") AND "public"."viewer_is_vip"("auth"."uid"())) OR (("visibility" = 'friends'::"text") AND "public"."viewer_is_friend"("auth"."uid"(), "created_by"))));


--
-- Name: rooms rooms_update_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "rooms_update_owner" ON "public"."rooms" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "created_by")) WITH CHECK (("auth"."uid"() = "created_by"));


--
-- Name: scheduled_room_posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."scheduled_room_posts" ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduled_room_posts scheduled_room_posts_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "scheduled_room_posts_delete_own" ON "public"."scheduled_room_posts" FOR DELETE TO "authenticated" USING (("host_user_id" = "auth"."uid"()));


--
-- Name: scheduled_room_posts scheduled_room_posts_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "scheduled_room_posts_insert_own" ON "public"."scheduled_room_posts" FOR INSERT TO "authenticated" WITH CHECK (("host_user_id" = "auth"."uid"()));


--
-- Name: scheduled_room_posts scheduled_room_posts_select_anon_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "scheduled_room_posts_select_anon_public" ON "public"."scheduled_room_posts" FOR SELECT TO "anon" USING (("visibility" = 'public'::"text"));


--
-- Name: scheduled_room_posts scheduled_room_posts_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "scheduled_room_posts_select_authenticated" ON "public"."scheduled_room_posts" FOR SELECT TO "authenticated" USING ((("host_user_id" = "auth"."uid"()) OR ("visibility" = 'public'::"text") OR (("visibility" = 'members'::"text") AND "public"."viewer_is_vip"("auth"."uid"())) OR (("visibility" = 'friends'::"text") AND "public"."viewer_is_friend"("auth"."uid"(), "host_user_id"))));


--
-- Name: scheduled_room_posts scheduled_room_posts_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "scheduled_room_posts_update_own" ON "public"."scheduled_room_posts" FOR UPDATE TO "authenticated" USING (("host_user_id" = "auth"."uid"())) WITH CHECK (("host_user_id" = "auth"."uid"()));


--
-- Name: security_audit_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."security_audit_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."subscription_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_events subscription_events_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "subscription_events_select_own" ON "public"."subscription_events" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: subscription_payment_applications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."subscription_payment_applications" ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."subscription_profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_profiles subscription_profiles_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "subscription_profiles_select_own" ON "public"."subscription_profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: support_ticket_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."support_ticket_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: support_ticket_events support_ticket_events_select_own_ticket; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "support_ticket_events_select_own_ticket" ON "public"."support_ticket_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."support_tickets" "t"
  WHERE (("t"."id" = "support_ticket_events"."ticket_id") AND ("t"."user_id" = "auth"."uid"())))));


--
-- Name: support_ticket_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."support_ticket_messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: support_ticket_messages support_ticket_messages_select_own_ticket; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "support_ticket_messages_select_own_ticket" ON "public"."support_ticket_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."support_tickets" "t"
  WHERE (("t"."id" = "support_ticket_messages"."ticket_id") AND ("t"."user_id" = "auth"."uid"())))));


--
-- Name: support_tickets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets support_tickets_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "support_tickets_select_own" ON "public"."support_tickets" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: user_blocks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_blocks" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_blocks user_blocks_no_direct_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_blocks_no_direct_delete" ON "public"."user_blocks" FOR DELETE TO "authenticated" USING (false);


--
-- Name: user_blocks user_blocks_no_direct_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_blocks_no_direct_insert" ON "public"."user_blocks" FOR INSERT TO "authenticated" WITH CHECK (false);


--
-- Name: user_blocks user_blocks_no_direct_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_blocks_no_direct_select" ON "public"."user_blocks" FOR SELECT TO "authenticated" USING (false);


--
-- Name: user_blocks user_blocks_no_direct_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_blocks_no_direct_update" ON "public"."user_blocks" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);


--
-- Name: user_blocks user_blocks_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_blocks_select_own" ON "public"."user_blocks" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "blocker_user_id"));


--
-- Name: user_entitlements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_entitlements" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_identity_bindings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_identity_bindings" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_invoice_preferences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_invoice_preferences" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_invoice_preferences user_invoice_preferences_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_invoice_preferences_select_own" ON "public"."user_invoice_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: user_invoice_preferences user_invoice_preferences_upsert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_invoice_preferences_upsert_own" ON "public"."user_invoice_preferences" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: user_plan_entitlements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_plan_entitlements" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_private_profile_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_private_profile_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_reports" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_reports user_reports_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_reports_select_own" ON "public"."user_reports" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "reporter_user_id"));


--
-- Name: user_security_flags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_security_flags" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_usage_wallet_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_usage_wallet_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_usage_wallets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_usage_wallets" ENABLE ROW LEVEL SECURITY;

--
-- Name: room_presence_events users can insert own room presence; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "users can insert own room presence" ON "public"."room_presence_events" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ((EXISTS ( SELECT 1
   FROM "public"."room_members" "rm"
  WHERE (("rm"."room_id" = "room_presence_events"."room_id") AND ("rm"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."rooms" "r"
  WHERE (("r"."id" = "room_presence_events"."room_id") AND ("r"."created_by" = "auth"."uid"())))))));


--
-- Name: ai_usage_events users can read own ai usage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "users can read own ai usage" ON "public"."ai_usage_events" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));


--
-- Name: verified_phone_identities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."verified_phone_identities" ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: FUNCTION "billing_release_job_lock"("p_job_name" "text", "p_locked_by" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."billing_release_job_lock"("p_job_name" "text", "p_locked_by" "uuid") TO "service_role";


--
-- Name: FUNCTION "billing_try_acquire_job_lock"("p_job_name" "text", "p_lock_seconds" integer, "p_locked_by" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."billing_try_acquire_job_lock"("p_job_name" "text", "p_lock_seconds" integer, "p_locked_by" "uuid") TO "service_role";


--
-- Name: FUNCTION "calmco_p3_touch_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."calmco_p3_touch_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."calmco_p3_touch_updated_at"() TO "service_role";


--
-- Name: FUNCTION "calmco_touch_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."calmco_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."calmco_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calmco_touch_updated_at"() TO "service_role";


--
-- Name: FUNCTION "can_join_room"("p_user_id" "uuid", "p_room_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."can_join_room"("p_user_id" "uuid", "p_room_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_join_room"("p_user_id" "uuid", "p_room_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_join_room"("p_user_id" "uuid", "p_room_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "cleanup_rooms_and_schedules"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cleanup_rooms_and_schedules"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_rooms_and_schedules"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_rooms_and_schedules"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_rooms_and_schedules"() TO "service_role";


--
-- Name: FUNCTION "cowork_append_appeal_message"("p_appeal_id" "uuid", "p_actor_user_id" "uuid", "p_actor_role" "text", "p_body" "text", "p_metadata" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_append_appeal_message"("p_appeal_id" "uuid", "p_actor_user_id" "uuid", "p_actor_role" "text", "p_body" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_append_appeal_message"("p_appeal_id" "uuid", "p_actor_user_id" "uuid", "p_actor_role" "text", "p_body" "text", "p_metadata" "jsonb") TO "service_role";


--
-- Name: FUNCTION "cowork_apply_buddy_payment_v3"("p_payment_order_id" "uuid", "p_booking_id" "uuid", "p_buyer_user_id" "uuid", "p_platform_fee_bps" integer, "p_paid_at" timestamp with time zone, "p_metadata" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_apply_buddy_payment_v3"("p_payment_order_id" "uuid", "p_booking_id" "uuid", "p_buyer_user_id" "uuid", "p_platform_fee_bps" integer, "p_paid_at" timestamp with time zone, "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_apply_buddy_payment_v3"("p_payment_order_id" "uuid", "p_booking_id" "uuid", "p_buyer_user_id" "uuid", "p_platform_fee_bps" integer, "p_paid_at" timestamp with time zone, "p_metadata" "jsonb") TO "service_role";


--
-- Name: TABLE "room_access_sessions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."room_access_sessions" TO "anon";
GRANT ALL ON TABLE "public"."room_access_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."room_access_sessions" TO "service_role";


--
-- Name: FUNCTION "cowork_apply_presence_usage"("p_access_session_id" "uuid", "p_delta_seconds" integer, "p_interval_media_class" "text", "p_current_media_class" "text", "p_screen_share_on" boolean, "p_connected" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_apply_presence_usage"("p_access_session_id" "uuid", "p_delta_seconds" integer, "p_interval_media_class" "text", "p_current_media_class" "text", "p_screen_share_on" boolean, "p_connected" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_apply_presence_usage"("p_access_session_id" "uuid", "p_delta_seconds" integer, "p_interval_media_class" "text", "p_current_media_class" "text", "p_screen_share_on" boolean, "p_connected" boolean) TO "service_role";


--
-- Name: FUNCTION "cowork_apply_subscription_payment_v2"("p_payment_order_id" "uuid", "p_user_id" "uuid", "p_subscription_profile_id" "uuid", "p_plan_code" "text", "p_period_start" timestamp with time zone, "p_period_end" timestamp with time zone, "p_source" "text", "p_metadata" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_apply_subscription_payment_v2"("p_payment_order_id" "uuid", "p_user_id" "uuid", "p_subscription_profile_id" "uuid", "p_plan_code" "text", "p_period_start" timestamp with time zone, "p_period_end" timestamp with time zone, "p_source" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_apply_subscription_payment_v2"("p_payment_order_id" "uuid", "p_user_id" "uuid", "p_subscription_profile_id" "uuid", "p_plan_code" "text", "p_period_start" timestamp with time zone, "p_period_end" timestamp with time zone, "p_source" "text", "p_metadata" "jsonb") TO "service_role";


--
-- Name: FUNCTION "cowork_claim_buddy_room_provision_v3"("p_booking_id" "uuid", "p_user_id" "uuid", "p_early_minutes" integer, "p_late_minutes" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_claim_buddy_room_provision_v3"("p_booking_id" "uuid", "p_user_id" "uuid", "p_early_minutes" integer, "p_late_minutes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_claim_buddy_room_provision_v3"("p_booking_id" "uuid", "p_user_id" "uuid", "p_early_minutes" integer, "p_late_minutes" integer) TO "service_role";


--
-- Name: FUNCTION "cowork_cleanup_expired_rooms"("p_grace_minutes" integer, "p_presence_grace_minutes" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_cleanup_expired_rooms"("p_grace_minutes" integer, "p_presence_grace_minutes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_cleanup_expired_rooms"("p_grace_minutes" integer, "p_presence_grace_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cowork_cleanup_expired_rooms"("p_grace_minutes" integer, "p_presence_grace_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cowork_cleanup_expired_rooms"("p_grace_minutes" integer, "p_presence_grace_minutes" integer) TO "service_role";


--
-- Name: FUNCTION "cowork_close_appeal"("p_appeal_id" "uuid", "p_user_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_close_appeal"("p_appeal_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_close_appeal"("p_appeal_id" "uuid", "p_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "cowork_confirm_buddy_completion_v3"("p_booking_id" "uuid", "p_user_id" "uuid", "p_hold_hours" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_confirm_buddy_completion_v3"("p_booking_id" "uuid", "p_user_id" "uuid", "p_hold_hours" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_confirm_buddy_completion_v3"("p_booking_id" "uuid", "p_user_id" "uuid", "p_hold_hours" integer) TO "service_role";


--
-- Name: FUNCTION "cowork_consume_usage_wallet_v2"("p_user_id" "uuid", "p_resource_key" "text", "p_quantity" bigint, "p_idempotency_key" "text", "p_room_id" "uuid", "p_access_session_id" "uuid", "p_payment_order_id" "uuid", "p_allow_overage" boolean, "p_metadata" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_consume_usage_wallet_v2"("p_user_id" "uuid", "p_resource_key" "text", "p_quantity" bigint, "p_idempotency_key" "text", "p_room_id" "uuid", "p_access_session_id" "uuid", "p_payment_order_id" "uuid", "p_allow_overage" boolean, "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_consume_usage_wallet_v2"("p_user_id" "uuid", "p_resource_key" "text", "p_quantity" bigint, "p_idempotency_key" "text", "p_room_id" "uuid", "p_access_session_id" "uuid", "p_payment_order_id" "uuid", "p_allow_overage" boolean, "p_metadata" "jsonb") TO "service_role";


--
-- Name: FUNCTION "cowork_create_appeal"("p_user_id" "uuid", "p_moderation_case_id" "uuid", "p_moderation_action_id" "uuid", "p_reason_code" "text", "p_message" "text", "p_requested_outcome" "text", "p_idempotency_key" "text", "p_metadata" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_create_appeal"("p_user_id" "uuid", "p_moderation_case_id" "uuid", "p_moderation_action_id" "uuid", "p_reason_code" "text", "p_message" "text", "p_requested_outcome" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_create_appeal"("p_user_id" "uuid", "p_moderation_case_id" "uuid", "p_moderation_action_id" "uuid", "p_reason_code" "text", "p_message" "text", "p_requested_outcome" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") TO "service_role";


--
-- Name: FUNCTION "cowork_create_buddy_booking_v3"("p_buyer_user_id" "uuid", "p_service_id" "uuid", "p_slot_id" "uuid", "p_buyer_note" "text", "p_max_amount_twd" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_create_buddy_booking_v3"("p_buyer_user_id" "uuid", "p_service_id" "uuid", "p_slot_id" "uuid", "p_buyer_note" "text", "p_max_amount_twd" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_create_buddy_booking_v3"("p_buyer_user_id" "uuid", "p_service_id" "uuid", "p_slot_id" "uuid", "p_buyer_note" "text", "p_max_amount_twd" integer) TO "service_role";


--
-- Name: FUNCTION "cowork_create_buddy_payout_batch_v3"("p_admin_user_id" "uuid", "p_provider_user_id" "uuid", "p_settlement_ids" "uuid"[], "p_note" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_create_buddy_payout_batch_v3"("p_admin_user_id" "uuid", "p_provider_user_id" "uuid", "p_settlement_ids" "uuid"[], "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_create_buddy_payout_batch_v3"("p_admin_user_id" "uuid", "p_provider_user_id" "uuid", "p_settlement_ids" "uuid"[], "p_note" "text") TO "service_role";


--
-- Name: FUNCTION "cowork_end_room_for_user"("p_room_id" "uuid", "p_user_id" "uuid", "p_reason" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_end_room_for_user"("p_room_id" "uuid", "p_user_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_end_room_for_user"("p_room_id" "uuid", "p_user_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cowork_end_room_for_user"("p_room_id" "uuid", "p_user_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cowork_end_room_for_user"("p_room_id" "uuid", "p_user_id" "uuid", "p_reason" "text") TO "service_role";


--
-- Name: FUNCTION "cowork_expire_unpaid_buddy_bookings_v3"("p_limit" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_expire_unpaid_buddy_bookings_v3"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_expire_unpaid_buddy_bookings_v3"("p_limit" integer) TO "service_role";


--
-- Name: FUNCTION "cowork_finalize_room_extension_v2"("p_room_id" "uuid", "p_sponsor_user_id" "uuid", "p_extension_window_key" "text", "p_idempotency_key" "text", "p_metadata" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_finalize_room_extension_v2"("p_room_id" "uuid", "p_sponsor_user_id" "uuid", "p_extension_window_key" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_finalize_room_extension_v2"("p_room_id" "uuid", "p_sponsor_user_id" "uuid", "p_extension_window_key" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") TO "service_role";


--
-- Name: FUNCTION "cowork_finish_buddy_room_provision_v3"("p_booking_id" "uuid", "p_actor_user_id" "uuid", "p_room_id" "uuid", "p_invite_code" "text", "p_error" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_finish_buddy_room_provision_v3"("p_booking_id" "uuid", "p_actor_user_id" "uuid", "p_room_id" "uuid", "p_invite_code" "text", "p_error" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_finish_buddy_room_provision_v3"("p_booking_id" "uuid", "p_actor_user_id" "uuid", "p_room_id" "uuid", "p_invite_code" "text", "p_error" "text") TO "service_role";


--
-- Name: FUNCTION "cowork_hold_buddy_settlement_v3"("p_booking_id" "uuid", "p_actor_user_id" "uuid", "p_reason" "text", "p_dispute_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_hold_buddy_settlement_v3"("p_booking_id" "uuid", "p_actor_user_id" "uuid", "p_reason" "text", "p_dispute_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_hold_buddy_settlement_v3"("p_booking_id" "uuid", "p_actor_user_id" "uuid", "p_reason" "text", "p_dispute_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "cowork_join_room_with_capacity"("p_room_id" "uuid", "p_user_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."cowork_join_room_with_capacity"("p_room_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cowork_join_room_with_capacity"("p_room_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cowork_join_room_with_capacity"("p_room_id" "uuid", "p_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "cowork_leave_room"("p_room_id" "uuid", "p_user_id" "uuid", "p_reason" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_leave_room"("p_room_id" "uuid", "p_user_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_leave_room"("p_room_id" "uuid", "p_user_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cowork_leave_room"("p_room_id" "uuid", "p_user_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cowork_leave_room"("p_room_id" "uuid", "p_user_id" "uuid", "p_reason" "text") TO "service_role";


--
-- Name: FUNCTION "cowork_p0_touch_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."cowork_p0_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."cowork_p0_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cowork_p0_touch_updated_at"() TO "service_role";


--
-- Name: FUNCTION "cowork_p2_refund_reversal_trigger"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_p2_refund_reversal_trigger"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_p2_refund_reversal_trigger"() TO "service_role";


--
-- Name: FUNCTION "cowork_p2_touch_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."cowork_p2_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."cowork_p2_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cowork_p2_touch_updated_at"() TO "service_role";


--
-- Name: FUNCTION "cowork_p3_refund_reversal_trigger"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."cowork_p3_refund_reversal_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."cowork_p3_refund_reversal_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cowork_p3_refund_reversal_trigger"() TO "service_role";


--
-- Name: FUNCTION "cowork_promote_buddy_settlements_v3"("p_limit" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_promote_buddy_settlements_v3"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_promote_buddy_settlements_v3"("p_limit" integer) TO "service_role";


--
-- Name: FUNCTION "cowork_release_buddy_settlement_v3"("p_booking_id" "uuid", "p_admin_user_id" "uuid", "p_reason" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_release_buddy_settlement_v3"("p_booking_id" "uuid", "p_admin_user_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_release_buddy_settlement_v3"("p_booking_id" "uuid", "p_admin_user_id" "uuid", "p_reason" "text") TO "service_role";


--
-- Name: FUNCTION "cowork_resolve_buddy_dispute_v3"("p_dispute_id" "uuid", "p_admin_user_id" "uuid", "p_action" "text", "p_settlement_resolution" "text", "p_admin_note" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_resolve_buddy_dispute_v3"("p_dispute_id" "uuid", "p_admin_user_id" "uuid", "p_action" "text", "p_settlement_resolution" "text", "p_admin_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_resolve_buddy_dispute_v3"("p_dispute_id" "uuid", "p_admin_user_id" "uuid", "p_action" "text", "p_settlement_resolution" "text", "p_admin_note" "text") TO "service_role";


--
-- Name: FUNCTION "cowork_reverse_buddy_payment_v3"("p_payment_order_id" "uuid", "p_refund_request_id" "uuid", "p_refund_amount_twd" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_reverse_buddy_payment_v3"("p_payment_order_id" "uuid", "p_refund_request_id" "uuid", "p_refund_amount_twd" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_reverse_buddy_payment_v3"("p_payment_order_id" "uuid", "p_refund_request_id" "uuid", "p_refund_amount_twd" integer) TO "service_role";


--
-- Name: FUNCTION "cowork_reverse_subscription_payment_v2"("p_payment_order_id" "uuid", "p_refund_request_id" "uuid", "p_refund_amount_twd" integer, "p_source" "text", "p_metadata" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_reverse_subscription_payment_v2"("p_payment_order_id" "uuid", "p_refund_request_id" "uuid", "p_refund_amount_twd" integer, "p_source" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_reverse_subscription_payment_v2"("p_payment_order_id" "uuid", "p_refund_request_id" "uuid", "p_refund_amount_twd" integer, "p_source" "text", "p_metadata" "jsonb") TO "service_role";


--
-- Name: FUNCTION "cowork_transition_appeal"("p_appeal_id" "uuid", "p_admin_user_id" "uuid", "p_to_status" "text", "p_admin_response" "text", "p_decision_reason" "text", "p_create_restore_action" boolean, "p_metadata" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_transition_appeal"("p_appeal_id" "uuid", "p_admin_user_id" "uuid", "p_to_status" "text", "p_admin_response" "text", "p_decision_reason" "text", "p_create_restore_action" boolean, "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_transition_appeal"("p_appeal_id" "uuid", "p_admin_user_id" "uuid", "p_to_status" "text", "p_admin_response" "text", "p_decision_reason" "text", "p_create_restore_action" boolean, "p_metadata" "jsonb") TO "service_role";


--
-- Name: FUNCTION "cowork_transition_buddy_booking_v3"("p_booking_id" "uuid", "p_actor_user_id" "uuid", "p_action" "text", "p_note" "text", "p_linked_room_id" "uuid", "p_linked_room_invite_code" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_transition_buddy_booking_v3"("p_booking_id" "uuid", "p_actor_user_id" "uuid", "p_action" "text", "p_note" "text", "p_linked_room_id" "uuid", "p_linked_room_invite_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_transition_buddy_booking_v3"("p_booking_id" "uuid", "p_actor_user_id" "uuid", "p_action" "text", "p_note" "text", "p_linked_room_id" "uuid", "p_linked_room_invite_code" "text") TO "service_role";


--
-- Name: FUNCTION "cowork_transition_buddy_payout_batch_v3"("p_batch_id" "uuid", "p_admin_user_id" "uuid", "p_action" "text", "p_provider_reference" "text", "p_note" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_transition_buddy_payout_batch_v3"("p_batch_id" "uuid", "p_admin_user_id" "uuid", "p_action" "text", "p_provider_reference" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_transition_buddy_payout_batch_v3"("p_batch_id" "uuid", "p_admin_user_id" "uuid", "p_action" "text", "p_provider_reference" "text", "p_note" "text") TO "service_role";


--
-- Name: FUNCTION "cowork_try_consume_credits"("p_user_id" "uuid", "p_month_start" "date", "p_cost" integer, "p_allowance" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_try_consume_credits"("p_user_id" "uuid", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_try_consume_credits"("p_user_id" "uuid", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cowork_try_consume_credits"("p_user_id" "uuid", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cowork_try_consume_credits"("p_user_id" "uuid", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) TO "service_role";


--
-- Name: FUNCTION "cowork_try_consume_identity_credits"("p_user_id" "uuid", "p_identity_key" "text", "p_month_start" "date", "p_cost" integer, "p_allowance" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cowork_try_consume_identity_credits"("p_user_id" "uuid", "p_identity_key" "text", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cowork_try_consume_identity_credits"("p_user_id" "uuid", "p_identity_key" "text", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cowork_try_consume_identity_credits"("p_user_id" "uuid", "p_identity_key" "text", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cowork_try_consume_identity_credits"("p_user_id" "uuid", "p_identity_key" "text", "p_month_start" "date", "p_cost" integer, "p_allowance" integer) TO "service_role";


--
-- Name: FUNCTION "ecpay_mark_order_paid"("p_merchant_trade_no" "text", "p_provider_trade_no" "text", "p_paid_at" timestamp with time zone, "p_provider_payload" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."ecpay_mark_order_paid"("p_merchant_trade_no" "text", "p_provider_trade_no" "text", "p_paid_at" timestamp with time zone, "p_provider_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ecpay_mark_order_paid"("p_merchant_trade_no" "text", "p_provider_trade_no" "text", "p_paid_at" timestamp with time zone, "p_provider_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."ecpay_mark_order_paid"("p_merchant_trade_no" "text", "p_provider_trade_no" "text", "p_paid_at" timestamp with time zone, "p_provider_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ecpay_mark_order_paid"("p_merchant_trade_no" "text", "p_provider_trade_no" "text", "p_paid_at" timestamp with time zone, "p_provider_payload" "jsonb") TO "service_role";


--
-- Name: FUNCTION "generate_room_invite_code"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."generate_room_invite_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_room_invite_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_room_invite_code"() TO "service_role";


--
-- Name: FUNCTION "handle_new_user_entitlement"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."handle_new_user_entitlement"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_entitlement"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_entitlement"() TO "service_role";


--
-- Name: FUNCTION "prepare_room_row"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."prepare_room_row"() TO "anon";
GRANT ALL ON FUNCTION "public"."prepare_room_row"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prepare_room_row"() TO "service_role";


--
-- Name: FUNCTION "prepare_scheduled_room_post"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."prepare_scheduled_room_post"() TO "anon";
GRANT ALL ON FUNCTION "public"."prepare_scheduled_room_post"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prepare_scheduled_room_post"() TO "service_role";


--
-- Name: FUNCTION "set_current_timestamp_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."set_current_timestamp_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_current_timestamp_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_current_timestamp_updated_at"() TO "service_role";


--
-- Name: FUNCTION "sync_scheduled_room_post_timing"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."sync_scheduled_room_post_timing"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_scheduled_room_post_timing"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_scheduled_room_post_timing"() TO "service_role";


--
-- Name: FUNCTION "viewer_is_friend"("p_left" "uuid", "p_right" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."viewer_is_friend"("p_left" "uuid", "p_right" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."viewer_is_friend"("p_left" "uuid", "p_right" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."viewer_is_friend"("p_left" "uuid", "p_right" "uuid") TO "service_role";


--
-- Name: FUNCTION "viewer_is_vip"("p_user_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."viewer_is_vip"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."viewer_is_vip"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."viewer_is_vip"("p_user_id" "uuid") TO "service_role";


--
-- Name: TABLE "abuse_reports"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."abuse_reports" TO "anon";
GRANT ALL ON TABLE "public"."abuse_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."abuse_reports" TO "service_role";


--
-- Name: TABLE "admin_audit_logs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."admin_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_logs" TO "service_role";


--
-- Name: TABLE "admin_entity_notes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."admin_entity_notes" TO "anon";
GRANT ALL ON TABLE "public"."admin_entity_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_entity_notes" TO "service_role";


--
-- Name: TABLE "admin_permission_presets"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."admin_permission_presets" TO "anon";
GRANT ALL ON TABLE "public"."admin_permission_presets" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_permission_presets" TO "service_role";


--
-- Name: TABLE "admin_role_assignments"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."admin_role_assignments" TO "anon";
GRANT ALL ON TABLE "public"."admin_role_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_role_assignments" TO "service_role";


--
-- Name: TABLE "ai_room_host_sessions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ai_room_host_sessions" TO "anon";
GRANT ALL ON TABLE "public"."ai_room_host_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_room_host_sessions" TO "service_role";


--
-- Name: TABLE "ai_usage_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ai_usage_events" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage_events" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage_events" TO "service_role";


--
-- Name: TABLE "ai_user_mode_preferences"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ai_user_mode_preferences" TO "anon";
GRANT ALL ON TABLE "public"."ai_user_mode_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_user_mode_preferences" TO "service_role";


--
-- Name: TABLE "appeal_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."appeal_events" TO "service_role";


--
-- Name: TABLE "appeal_messages"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."appeal_messages" TO "service_role";


--
-- Name: TABLE "appeals"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."appeals" TO "service_role";


--
-- Name: TABLE "auth_sms_attempts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."auth_sms_attempts" TO "anon";
GRANT ALL ON TABLE "public"."auth_sms_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_sms_attempts" TO "service_role";


--
-- Name: TABLE "billing_automation_locks"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."billing_automation_locks" TO "service_role";


--
-- Name: TABLE "billing_automation_runs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."billing_automation_runs" TO "service_role";


--
-- Name: TABLE "billing_ledger"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."billing_ledger" TO "anon";
GRANT ALL ON TABLE "public"."billing_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_ledger" TO "service_role";


--
-- Name: TABLE "buddy_booking_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."buddy_booking_events" TO "anon";
GRANT ALL ON TABLE "public"."buddy_booking_events" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_booking_events" TO "service_role";


--
-- Name: TABLE "buddy_booking_payment_applications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."buddy_booking_payment_applications" TO "service_role";


--
-- Name: TABLE "buddy_bookings"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."buddy_bookings" TO "anon";
GRANT ALL ON TABLE "public"."buddy_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_bookings" TO "service_role";


--
-- Name: TABLE "buddy_disputes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."buddy_disputes" TO "anon";
GRANT ALL ON TABLE "public"."buddy_disputes" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_disputes" TO "service_role";


--
-- Name: TABLE "buddy_payout_accounts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."buddy_payout_accounts" TO "service_role";


--
-- Name: TABLE "buddy_payout_batches"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."buddy_payout_batches" TO "service_role";


--
-- Name: TABLE "buddy_payout_items"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."buddy_payout_items" TO "service_role";


--
-- Name: TABLE "buddy_provider_applications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."buddy_provider_applications" TO "anon";
GRANT ALL ON TABLE "public"."buddy_provider_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_provider_applications" TO "service_role";


--
-- Name: TABLE "buddy_reviews"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."buddy_reviews" TO "anon";
GRANT ALL ON TABLE "public"."buddy_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_reviews" TO "service_role";


--
-- Name: TABLE "buddy_service_slots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."buddy_service_slots" TO "anon";
GRANT ALL ON TABLE "public"."buddy_service_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_service_slots" TO "service_role";


--
-- Name: TABLE "buddy_services"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."buddy_services" TO "anon";
GRANT ALL ON TABLE "public"."buddy_services" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_services" TO "service_role";


--
-- Name: TABLE "buddy_settlement_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."buddy_settlement_events" TO "service_role";


--
-- Name: TABLE "buddy_settlements"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."buddy_settlements" TO "service_role";


--
-- Name: TABLE "cowork_identity_monthly_usage"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cowork_identity_monthly_usage" TO "anon";
GRANT ALL ON TABLE "public"."cowork_identity_monthly_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."cowork_identity_monthly_usage" TO "service_role";


--
-- Name: TABLE "cowork_monthly_usage"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cowork_monthly_usage" TO "anon";
GRANT ALL ON TABLE "public"."cowork_monthly_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."cowork_monthly_usage" TO "service_role";


--
-- Name: TABLE "ecpay_invoice_tasks"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ecpay_invoice_tasks" TO "anon";
GRANT ALL ON TABLE "public"."ecpay_invoice_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."ecpay_invoice_tasks" TO "service_role";


--
-- Name: TABLE "ecpay_refund_tasks"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ecpay_refund_tasks" TO "anon";
GRANT ALL ON TABLE "public"."ecpay_refund_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."ecpay_refund_tasks" TO "service_role";


--
-- Name: TABLE "ecpay_subscription_tasks"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ecpay_subscription_tasks" TO "service_role";


--
-- Name: TABLE "entitlement_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."entitlement_events" TO "anon";
GRANT ALL ON TABLE "public"."entitlement_events" TO "authenticated";
GRANT ALL ON TABLE "public"."entitlement_events" TO "service_role";


--
-- Name: TABLE "friend_requests"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."friend_requests" TO "anon";
GRANT ALL ON TABLE "public"."friend_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."friend_requests" TO "service_role";


--
-- Name: TABLE "friendships"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."friendships" TO "anon";
GRANT ALL ON TABLE "public"."friendships" TO "authenticated";
GRANT ALL ON TABLE "public"."friendships" TO "service_role";


--
-- Name: TABLE "identity_verification_requests"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."identity_verification_requests" TO "anon";
GRANT ALL ON TABLE "public"."identity_verification_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."identity_verification_requests" TO "service_role";


--
-- Name: TABLE "invoice_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."invoice_events" TO "anon";
GRANT ALL ON TABLE "public"."invoice_events" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_events" TO "service_role";


--
-- Name: TABLE "moderation_actions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."moderation_actions" TO "service_role";


--
-- Name: TABLE "moderation_cases"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."moderation_cases" TO "service_role";


--
-- Name: TABLE "notification_delivery_attempts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."notification_delivery_attempts" TO "anon";
GRANT ALL ON TABLE "public"."notification_delivery_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_delivery_attempts" TO "service_role";


--
-- Name: TABLE "notification_outbox"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."notification_outbox" TO "anon";
GRANT ALL ON TABLE "public"."notification_outbox" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_outbox" TO "service_role";


--
-- Name: TABLE "notification_preferences"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";


--
-- Name: TABLE "notification_templates"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."notification_templates" TO "anon";
GRANT ALL ON TABLE "public"."notification_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_templates" TO "service_role";


--
-- Name: TABLE "ops_action_items"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ops_action_items" TO "anon";
GRANT ALL ON TABLE "public"."ops_action_items" TO "authenticated";
GRANT ALL ON TABLE "public"."ops_action_items" TO "service_role";


--
-- Name: TABLE "payment_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."payment_events" TO "anon";
GRANT ALL ON TABLE "public"."payment_events" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_events" TO "service_role";


--
-- Name: SEQUENCE "payment_events_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."payment_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."payment_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."payment_events_id_seq" TO "service_role";


--
-- Name: TABLE "payment_orders"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."payment_orders" TO "anon";
GRANT ALL ON TABLE "public"."payment_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_orders" TO "service_role";


--
-- Name: TABLE "profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";


--
-- Name: TABLE "refund_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."refund_events" TO "anon";
GRANT ALL ON TABLE "public"."refund_events" TO "authenticated";
GRANT ALL ON TABLE "public"."refund_events" TO "service_role";


--
-- Name: TABLE "refund_requests"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."refund_requests" TO "anon";
GRANT ALL ON TABLE "public"."refund_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."refund_requests" TO "service_role";


--
-- Name: TABLE "reliability_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."reliability_events" TO "anon";
GRANT ALL ON TABLE "public"."reliability_events" TO "authenticated";
GRANT ALL ON TABLE "public"."reliability_events" TO "service_role";


--
-- Name: TABLE "room_extension_confirmations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."room_extension_confirmations" TO "anon";
GRANT ALL ON TABLE "public"."room_extension_confirmations" TO "authenticated";
GRANT ALL ON TABLE "public"."room_extension_confirmations" TO "service_role";


--
-- Name: TABLE "room_extension_grants"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."room_extension_grants" TO "service_role";


--
-- Name: TABLE "room_lifecycle_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."room_lifecycle_events" TO "anon";
GRANT ALL ON TABLE "public"."room_lifecycle_events" TO "authenticated";
GRANT ALL ON TABLE "public"."room_lifecycle_events" TO "service_role";


--
-- Name: TABLE "room_member_presence_state"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."room_member_presence_state" TO "anon";
GRANT ALL ON TABLE "public"."room_member_presence_state" TO "authenticated";
GRANT ALL ON TABLE "public"."room_member_presence_state" TO "service_role";


--
-- Name: TABLE "room_members"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."room_members" TO "anon";
GRANT ALL ON TABLE "public"."room_members" TO "authenticated";
GRANT ALL ON TABLE "public"."room_members" TO "service_role";


--
-- Name: TABLE "room_participant_summaries"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."room_participant_summaries" TO "anon";
GRANT ALL ON TABLE "public"."room_participant_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."room_participant_summaries" TO "service_role";


--
-- Name: TABLE "room_presence_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."room_presence_events" TO "anon";
GRANT ALL ON TABLE "public"."room_presence_events" TO "authenticated";
GRANT ALL ON TABLE "public"."room_presence_events" TO "service_role";


--
-- Name: TABLE "room_reconciliation_items"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."room_reconciliation_items" TO "anon";
GRANT ALL ON TABLE "public"."room_reconciliation_items" TO "authenticated";
GRANT ALL ON TABLE "public"."room_reconciliation_items" TO "service_role";


--
-- Name: TABLE "room_reconciliation_runs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."room_reconciliation_runs" TO "anon";
GRANT ALL ON TABLE "public"."room_reconciliation_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."room_reconciliation_runs" TO "service_role";


--
-- Name: TABLE "room_session_summaries"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."room_session_summaries" TO "anon";
GRANT ALL ON TABLE "public"."room_session_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."room_session_summaries" TO "service_role";


--
-- Name: TABLE "rooms"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."rooms" TO "anon";
GRANT ALL ON TABLE "public"."rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."rooms" TO "service_role";


--
-- Name: TABLE "scheduled_room_posts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."scheduled_room_posts" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_room_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_room_posts" TO "service_role";


--
-- Name: TABLE "security_audit_logs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."security_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."security_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."security_audit_logs" TO "service_role";


--
-- Name: SEQUENCE "security_audit_logs_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."security_audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."security_audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."security_audit_logs_id_seq" TO "service_role";


--
-- Name: TABLE "subscription_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."subscription_events" TO "service_role";


--
-- Name: TABLE "subscription_payment_applications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."subscription_payment_applications" TO "service_role";


--
-- Name: TABLE "subscription_profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."subscription_profiles" TO "service_role";


--
-- Name: TABLE "support_ticket_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."support_ticket_events" TO "service_role";


--
-- Name: TABLE "support_ticket_messages"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."support_ticket_messages" TO "service_role";


--
-- Name: TABLE "support_tickets"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."support_tickets" TO "service_role";


--
-- Name: TABLE "user_blocks"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_blocks" TO "anon";
GRANT ALL ON TABLE "public"."user_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_blocks" TO "service_role";


--
-- Name: TABLE "user_entitlements"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_entitlements" TO "anon";
GRANT ALL ON TABLE "public"."user_entitlements" TO "authenticated";
GRANT ALL ON TABLE "public"."user_entitlements" TO "service_role";


--
-- Name: TABLE "user_identity_bindings"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_identity_bindings" TO "anon";
GRANT ALL ON TABLE "public"."user_identity_bindings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_identity_bindings" TO "service_role";


--
-- Name: TABLE "user_invoice_preferences"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_invoice_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_invoice_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_invoice_preferences" TO "service_role";


--
-- Name: TABLE "user_plan_entitlements"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_plan_entitlements" TO "service_role";


--
-- Name: TABLE "user_private_profile_settings"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_private_profile_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_private_profile_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_private_profile_settings" TO "service_role";


--
-- Name: TABLE "user_reports"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_reports" TO "service_role";


--
-- Name: TABLE "user_security_flags"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_security_flags" TO "anon";
GRANT ALL ON TABLE "public"."user_security_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."user_security_flags" TO "service_role";


--
-- Name: TABLE "user_usage_wallet_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_usage_wallet_events" TO "service_role";


--
-- Name: TABLE "user_usage_wallets"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_usage_wallets" TO "service_role";


--
-- Name: TABLE "verified_phone_identities"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."verified_phone_identities" TO "anon";
GRANT ALL ON TABLE "public"."verified_phone_identities" TO "authenticated";
GRANT ALL ON TABLE "public"."verified_phone_identities" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- PostgreSQL database dump complete
--

-- \unrestrict dNrKL46FGBxkQmZdilLvdaiCl1epTgSaM22dRN9zuc2wJBcoj258rp3FigW72Gm

