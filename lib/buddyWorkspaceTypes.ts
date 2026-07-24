export type BuddyWorkspaceView = "buyer" | "provider" | "payout";
export type BuddyViewerRole = "buyer" | "provider";

export type BuddyWorkspaceActionKey =
  | "pay"
  | "accept"
  | "decline"
  | "cancel"
  | "room"
  | "complete"
  | "dispute";

export type BuddyWorkspaceActionState = {
  enabled: boolean;
  reason: string | null;
};

export type BuddyWorkspaceProfile = {
  user_id: string;
  handle: string | null;
  display_name: string;
  avatar_url: string | null;
  is_professional_buddy: boolean;
};

export type BuddyWorkspaceBooking = {
  id: string;
  viewer_role: BuddyViewerRole;
  booking_status: string;
  payment_status: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  total_amount_twd: number;
  buyer_note: string | null;
  provider_note: string | null;
  linked_room_id: string | null;
  room_provision_status: string | null;
  buyer_completed_at: string | null;
  provider_completed_at: string | null;
  dispute_status: string | null;
  service: {
    id: string;
    title: string;
    summary: string;
    buddy_category: string;
    interaction_style: string;
    delivery_mode: string;
    price_per_hour_twd: number;
  } | null;
  counterpart: BuddyWorkspaceProfile | null;
  settlement: {
    id: string;
    status: string;
    gross_amount_twd: number;
    platform_fee_twd: number;
    provider_net_twd: number;
    refund_amount_twd: number;
    available_for_payout_at: string | null;
    paid_out_at: string | null;
    hold_reason: string | null;
  } | null;
  dispute: {
    id: string;
    dispute_status: string;
    reason_category: string;
    created_at: string;
  } | null;
  room: {
    id: string;
    status: string | null;
    scheduled_end_at: string | null;
    ended_at: string | null;
  } | null;
  recent_events: Array<{
    id: string;
    event_type: string;
    from_status: string | null;
    to_status: string | null;
    actor_role: string;
    created_at: string;
  }>;
  next_step: {
    code: string;
    label: string;
    detail: string;
    tone: "neutral" | "attention" | "ready" | "done" | "blocked";
  };
  actions: Record<BuddyWorkspaceActionKey, BuddyWorkspaceActionState>;
};

export type BuddyWorkspaceService = {
  id: string;
  title: string;
  summary: string;
  status: string;
  buddy_category: string;
  delivery_mode: string;
  price_per_hour_twd: number;
  accepts_new_users: boolean;
  availability_note: string | null;
  open_slots_count: number;
  next_slot_at: string | null;
};

export type BuddyWorkspacePayoutAccount = {
  id: string;
  status: string;
  bank_code: string;
  account_last5: string;
  account_holder_name: string;
  reviewer_note: string | null;
  verified_at: string | null;
  secure_reference_present: boolean;
  updated_at: string;
} | null;

export type BuddyWorkspaceSnapshot = {
  generated_at: string;
  server_now: string;
  viewer_user_id: string;
  buyer: {
    pending_payment: number;
    waiting_provider: number;
    upcoming: number;
    attention: number;
    completed: number;
    bookings: BuddyWorkspaceBooking[];
  };
  provider: {
    awaiting_reply: number;
    upcoming: number;
    completion_pending: number;
    attention: number;
    active_services: number;
    open_slots: number;
    bookings: BuddyWorkspaceBooking[];
    services: BuddyWorkspaceService[];
  };
  payout: {
    held_twd: number;
    releasable_twd: number;
    processing_twd: number;
    paid_out_twd: number;
    account: BuddyWorkspacePayoutAccount;
    recent_items: Array<{
      id: string;
      amount_twd: number;
      status: string;
      provider_reference: string | null;
      processed_at: string | null;
      created_at: string;
    }>;
  };
  build_tag: string;
  dependency_build_tag: string;
};
