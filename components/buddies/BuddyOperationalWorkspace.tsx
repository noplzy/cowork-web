"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BuddyPaymentButton } from "@/components/buddies/BuddyPaymentButton";
import {
  FormalOpsShell,
  accountOpsNav,
} from "@/components/formalOps/FormalOpsShell";
import {
  formatDateTime,
  formatTwd,
  useAuthedJson,
} from "@/components/formalOps/useAuthedJson";
import type {
  BuddyWorkspaceActionKey,
  BuddyWorkspaceBooking,
  BuddyWorkspaceSnapshot,
  BuddyWorkspaceView,
} from "@/lib/buddyWorkspaceTypes";
import { P4B_BUILD_TAGS } from "@/lib/p4bStatus";
import styles from "./BuddyOperationalWorkspace.module.css";

const bookingLabels: Record<string, string> = {
  pending: "待回覆",
  accepted: "已接受",
  declined: "已婉拒",
  cancelled: "已取消",
  completed: "已完成",
};

const paymentLabels: Record<string, string> = {
  unpaid: "未付款",
  paid: "已付款",
  refunded: "已退款",
};

const settlementLabels: Record<string, string> = {
  awaiting_payment: "等待付款",
  funds_held: "款項保管中",
  service_accepted: "等待履約",
  completed_hold: "完成後保留期",
  releasable: "可撥款",
  dispute_hold: "爭議保留",
  refund_pending: "退款處理中",
  refunded: "已退款",
  payout_processing: "撥款處理中",
  paid_out: "已撥款",
  manual_review: "人工處理",
};

const payoutAccountLabels: Record<string, string> = {
  pending_review: "等待人工核對",
  verified: "已核對",
  rejected: "需要修正",
  suspended: "暫停使用",
};

function label(map: Record<string, string>, value?: string | null) {
  return map[String(value || "")] || String(value || "—");
}

function initial(value: string) {
  return value.trim().slice(0, 1) || "島";
}

function actionTitle(key: BuddyWorkspaceActionKey) {
  const labels: Record<BuddyWorkspaceActionKey, string> = {
    pay: "前往付款",
    accept: "接受預約",
    decline: "婉拒並退款",
    cancel: "開始前取消",
    room: "建立／進入履約房",
    complete: "確認我已完成",
    dispute: "建立爭議",
  };
  return labels[key];
}

function BookingCard({
  row,
  busy,
  onAction,
  onRoom,
  onDispute,
}: {
  row: BuddyWorkspaceBooking;
  busy: boolean;
  onAction: (bookingId: string, action: "accept" | "decline" | "cancel" | "complete") => Promise<void>;
  onRoom: (bookingId: string) => Promise<void>;
  onDispute: (bookingId: string) => void;
}) {
  const counterpartName = row.counterpart?.display_name || "安感島使用者";
  const profileHref = row.counterpart?.handle
    ? `/profile/${encodeURIComponent(row.counterpart.handle)}`
    : null;

  return (
    <article className={styles.bookingCard} data-booking-id={row.id}>
      <div className={styles.bookingTop}>
        <div className={styles.identity}>
          <div className={styles.avatar}>
            {row.counterpart?.avatar_url ? (
              <img src={row.counterpart.avatar_url} alt="" loading="lazy" decoding="async" />
            ) : (
              <span>{initial(counterpartName)}</span>
            )}
          </div>
          <div className={styles.identityText}>
            <b>{counterpartName}</b>
            <span>
              {row.viewer_role === "buyer" ? "服務提供者" : "預約者"}
              {row.counterpart?.is_professional_buddy ? "・已審核安感夥伴" : ""}
            </span>
          </div>
        </div>
        <div className={styles.amount}>{formatTwd(row.total_amount_twd)}</div>
      </div>

      <h3 className={styles.serviceTitle}>{row.service?.title || "安感夥伴服務"}</h3>

      <div className={styles.metaRow}>
        <span>{formatDateTime(row.scheduled_start_at)} ～ {formatDateTime(row.scheduled_end_at)}</span>
      </div>

      <div className={styles.chipRow}>
        <span className={styles.chip}>{label(bookingLabels, row.booking_status)}</span>
        <span className={styles.chip}>{label(paymentLabels, row.payment_status)}</span>
        <span className={styles.chip}>
          {label(settlementLabels, row.settlement?.status || null)}
        </span>
        {row.service?.delivery_mode ? (
          <span className={styles.chip}>{row.service.delivery_mode === "remote" ? "遠端" : row.service.delivery_mode}</span>
        ) : null}
      </div>

      <div className={styles.nextStep} data-tone={row.next_step.tone}>
        <b>{row.next_step.label}</b>
        <span>{row.next_step.detail}</span>
      </div>

      {row.viewer_role === "provider" && row.buyer_note ? (
        <div className={styles.note}>
          <b>預約者留言：</b> {row.buyer_note}
        </div>
      ) : null}
      {row.viewer_role === "buyer" && row.provider_note ? (
        <div className={styles.note}>
          <b>提供者留言：</b> {row.provider_note}
        </div>
      ) : null}

      <div className={styles.actions}>
        {row.actions.pay.enabled ? (
          <BuddyPaymentButton bookingId={row.id} disabled={busy} />
        ) : null}
        {row.actions.accept.enabled ? (
          <button
            type="button"
            data-primary="true"
            disabled={busy}
            onClick={() => void onAction(row.id, "accept")}
          >
            {actionTitle("accept")}
          </button>
        ) : null}
        {row.actions.decline.enabled ? (
          <button
            type="button"
            data-danger="true"
            disabled={busy}
            onClick={() => void onAction(row.id, "decline")}
          >
            {actionTitle("decline")}
          </button>
        ) : null}
        {row.actions.room.enabled ? (
          <button
            type="button"
            data-primary="true"
            disabled={busy}
            onClick={() => void onRoom(row.id)}
          >
            {actionTitle("room")}
          </button>
        ) : null}
        {row.actions.complete.enabled ? (
          <button
            type="button"
            data-primary="true"
            disabled={busy}
            onClick={() => void onAction(row.id, "complete")}
          >
            {actionTitle("complete")}
          </button>
        ) : null}
        {row.actions.cancel.enabled ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onAction(row.id, "cancel")}
          >
            {actionTitle("cancel")}
          </button>
        ) : null}
        {row.actions.dispute.enabled ? (
          <button
            type="button"
            data-danger="true"
            disabled={busy}
            onClick={() => onDispute(row.id)}
          >
            {actionTitle("dispute")}
          </button>
        ) : null}
        {profileHref ? <Link href={profileHref}>查看公開頁</Link> : null}
        {row.linked_room_id ? <Link href={`/rooms/${row.linked_room_id}`}>房間連結</Link> : null}
      </div>

      {row.recent_events.length ? (
        <div className={styles.timeline} aria-label="近期狀態紀錄">
          {row.recent_events.slice(0, 4).map((event) => (
            <div key={event.id}>
              <i aria-hidden="true" />
              <span>
                {event.event_type}
                {event.to_status ? ` → ${label(settlementLabels, event.to_status)}` : ""}
              </span>
              <time>{formatDateTime(event.created_at)}</time>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function BuddyOperationalWorkspace({
  initialView = "buyer",
}: {
  initialView?: BuddyWorkspaceView;
}) {
  const redirectTo =
    initialView === "payout"
      ? "/account/buddies/earnings"
      : "/account/buddies/workspace";
  const { accessToken, authedFetch } = useAuthedJson(redirectTo);
  const [view, setView] = useState<BuddyWorkspaceView>(initialView);
  const [payload, setPayload] = useState<BuddyWorkspaceSnapshot | null>(null);
  const [message, setMessage] = useState("正在整理 Buddies 工作台…");
  const [busyId, setBusyId] = useState("");
  const [disputeBookingId, setDisputeBookingId] = useState("");
  const [disputeCategory, setDisputeCategory] = useState("service_issue");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountLast5, setAccountLast5] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [payoutConsent, setPayoutConsent] = useState(false);

  async function load() {
    const workspace = (await authedFetch(
      "/api/account/buddies/workspace",
    )) as BuddyWorkspaceSnapshot;
    setPayload(workspace);
    setBankCode(workspace.payout.account?.bank_code || "");
    setAccountLast5(workspace.payout.account?.account_last5 || "");
    setAccountHolder(workspace.payout.account?.account_holder_name || "");
    setMessage("");
  }

  useEffect(() => {
    if (!accessToken) return;
    void load().catch((error) =>
      setMessage(error instanceof Error ? error.message : "讀取工作台失敗。"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function act(
    bookingId: string,
    action: "accept" | "decline" | "cancel" | "complete",
  ) {
    const confirmationCopy: Partial<Record<typeof action, string>> = {
      decline: "確定要婉拒這筆預約嗎？若已付款，系統會進入退款流程。",
      cancel: "確定要取消這筆預約嗎？若已付款，系統會進入退款流程。",
      complete: "請確認服務已實際完成。單方確認不會立即撥款。",
    };
    const copy = confirmationCopy[action];
    if (copy && !window.confirm(copy)) return;

    setBusyId(bookingId);
    setMessage("正在更新預約狀態…");
    try {
      await authedFetch(`/api/buddies/bookings/${bookingId}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      await load();
      setMessage(
        action === "complete"
          ? "已記錄完成確認；雙方都確認後才會進入撥款保留期。"
          : "預約狀態已更新。",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失敗。" );
    } finally {
      setBusyId("");
    }
  }

  async function openRoom(bookingId: string) {
    setBusyId(bookingId);
    setMessage("正在核對履約時間並準備私人房…");
    try {
      const result = await authedFetch(
        `/api/buddies/bookings/${bookingId}/room`,
        { method: "POST" },
      );
      const roomId = result.room?.id || result.booking?.linked_room_id;
      if (!roomId) throw new Error("履約房尚未準備完成。");
      window.location.href = `/rooms/${roomId}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立履約房失敗。" );
      setBusyId("");
    }
  }

  async function submitDispute() {
    if (!disputeBookingId || disputeDescription.trim().length < 10) {
      setMessage("爭議說明至少需要 10 個字。");
      return;
    }
    setBusyId(disputeBookingId);
    setMessage("正在建立爭議並暫停撥款…");
    try {
      await authedFetch(
        `/api/buddies/bookings/${disputeBookingId}/dispute`,
        {
          method: "POST",
          body: JSON.stringify({
            reason_category: disputeCategory,
            description: disputeDescription.trim(),
          }),
        },
      );
      setDisputeBookingId("");
      setDisputeDescription("");
      await load();
      setMessage("爭議已建立，客服單與撥款保留狀態已同步。" );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立爭議失敗。" );
    } finally {
      setBusyId("");
    }
  }

  async function savePayoutAccount() {
    setMessage("正在送交人工核對…");
    try {
      await authedFetch("/api/account/buddies/payout-account", {
        method: "PUT",
        body: JSON.stringify({
          bank_code: bankCode,
          account_last5: accountLast5,
          account_holder_name: accountHolder,
          consent: payoutConsent,
        }),
      });
      setPayoutConsent(false);
      await load();
      setMessage(
        "已送交人工核對。完整帳號只透過指定安全管道提供，不會存進網站資料庫。",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存收款設定失敗。" );
    }
  }

  const currentBookings = useMemo(() => {
    const rows =
      view === "buyer"
        ? payload?.buyer.bookings || []
        : payload?.provider.bookings || [];
    const toneRank = { attention: 0, ready: 1, neutral: 2, blocked: 3, done: 4 };
    return [...rows].sort((left, right) => {
      const toneDelta = toneRank[left.next_step.tone] - toneRank[right.next_step.tone];
      if (toneDelta) return toneDelta;
      return (
        new Date(left.scheduled_start_at).getTime() -
        new Date(right.scheduled_start_at).getTime()
      );
    });
  }, [payload, view]);

  const activeHref =
    view === "payout"
      ? "/account/buddies/earnings"
      : "/account/buddies/workspace";

  const title =
    view === "buyer"
      ? "我的預約工作台"
      : view === "provider"
        ? "安感夥伴工作台"
        : "收益與人工撥款";

  return (
    <FormalOpsShell
      activeHref={activeHref}
      navItems={accountOpsNav}
      eyebrow="Buddies Operations"
      title={title}
      description="把付款、回覆、履約房、雙方完成、爭議與撥款整理成清楚的下一步。試營運仍只開放遠端服務，完整銀行帳號不進入網站資料庫。"
      quoteTitle="先知道下一步，再執行不可逆動作"
      quoteBody="P4-B 只新增營運讀模與工作台；付款、退款、結算與履約仍沿用已驗證的 P3 command routes。"
      topActions={
        <div className={styles.actions}>
          <Link href="/buddies">尋找／管理服務</Link>
          <button type="button" onClick={() => void load()}>
            重新整理
          </button>
        </div>
      }
      dataPage="p4b-buddies-operational-workspace-v141"
    >
      <div className={styles.shell} data-p4b-build={P4B_BUILD_TAGS.ui}>
        <nav className={styles.tabs} aria-label="Buddies 工作台分頁">
          <button
            type="button"
            data-active={view === "buyer"}
            onClick={() => setView("buyer")}
          >
            我預約的服務
          </button>
          <button
            type="button"
            data-active={view === "provider"}
            onClick={() => setView("provider")}
          >
            我提供的服務
          </button>
          <button
            type="button"
            data-active={view === "payout"}
            onClick={() => setView("payout")}
          >
            收益與撥款
          </button>
        </nav>

        {message ? <div className={styles.notice}>{message}</div> : null}

        {view === "buyer" ? (
          <section className={styles.metricGrid} aria-label="預約摘要">
            <article className={styles.metric}><span>待付款</span><b>{payload?.buyer.pending_payment ?? "—"}</b></article>
            <article className={styles.metric}><span>等待回覆</span><b>{payload?.buyer.waiting_provider ?? "—"}</b></article>
            <article className={styles.metric}><span>即將履約</span><b>{payload?.buyer.upcoming ?? "—"}</b></article>
            <article className={styles.metric}><span>需要注意</span><b>{payload?.buyer.attention ?? "—"}</b></article>
            <article className={styles.metric}><span>已完成</span><b>{payload?.buyer.completed ?? "—"}</b></article>
          </section>
        ) : null}

        {view === "provider" ? (
          <section className={styles.metricGrid} aria-label="提供者摘要">
            <article className={styles.metric}><span>待回覆</span><b>{payload?.provider.awaiting_reply ?? "—"}</b></article>
            <article className={styles.metric}><span>即將履約</span><b>{payload?.provider.upcoming ?? "—"}</b></article>
            <article className={styles.metric}><span>待完成確認</span><b>{payload?.provider.completion_pending ?? "—"}</b></article>
            <article className={styles.metric}><span>上架服務</span><b>{payload?.provider.active_services ?? "—"}</b></article>
            <article className={styles.metric}><span>開放時段</span><b>{payload?.provider.open_slots ?? "—"}</b></article>
          </section>
        ) : null}

        {view === "payout" ? (
          <section className={styles.metricGrid} aria-label="收益摘要">
            <article className={styles.metric}><span>保留中</span><b>{formatTwd(payload?.payout.held_twd)}</b></article>
            <article className={styles.metric}><span>可撥款</span><b>{formatTwd(payload?.payout.releasable_twd)}</b></article>
            <article className={styles.metric}><span>處理中</span><b>{formatTwd(payload?.payout.processing_twd)}</b></article>
            <article className={styles.metric}><span>已撥款</span><b>{formatTwd(payload?.payout.paid_out_twd)}</b></article>
            <article className={styles.metric}><span>帳戶狀態</span><b>{label(payoutAccountLabels, payload?.payout.account?.status)}</b></article>
          </section>
        ) : null}

        {view === "buyer" || view === "provider" ? (
          <div className={styles.layout}>
            <main className={styles.mainColumn}>
              <section className={styles.sectionCard}>
                <header className={styles.sectionHead}>
                  <div>
                    <span>{view === "buyer" ? "Buyer Bookings" : "Provider Bookings"}</span>
                    <h2>{view === "buyer" ? "我的預約與下一步" : "待回覆與履約中的預約"}</h2>
                  </div>
                  <Link href="/buddies">前往服務市場</Link>
                </header>
                <div className={styles.list}>
                  {currentBookings.length ? (
                    currentBookings.map((row) => (
                      <BookingCard
                        key={row.id}
                        row={row}
                        busy={busyId === row.id}
                        onAction={act}
                        onRoom={openRoom}
                        onDispute={setDisputeBookingId}
                      />
                    ))
                  ) : (
                    <div className={styles.empty}>
                      {view === "buyer"
                        ? "目前沒有預約。從安感夥伴服務頁選擇遠端時段後，狀態會集中在這裡。"
                        : "目前沒有需要處理的預約。新的已付款預約會顯示在這裡。"}
                    </div>
                  )}
                </div>
              </section>
            </main>

            <aside className={styles.sideColumn}>
              {view === "provider" ? (
                <section className={styles.sectionCard}>
                  <header className={styles.sectionHead}>
                    <div><span>Services</span><h3>我的服務與時段</h3></div>
                    <Link href="/buddies">管理全部</Link>
                  </header>
                  <div className={styles.serviceList}>
                    {(payload?.provider.services || []).map((service) => (
                      <article className={styles.serviceRow} key={service.id}>
                        <header><b>{service.title}</b><span className={styles.chip}>{service.status}</span></header>
                        <p>{formatTwd(service.price_per_hour_twd)} / 小時・{service.open_slots_count} 個開放時段</p>
                        <p>{service.next_slot_at ? `下一時段：${formatDateTime(service.next_slot_at)}` : "尚無開放時段"}</p>
                        <div className={styles.actions}>
                          <Link href={`/buddies/services/${service.id}`}>查看／管理服務</Link>
                        </div>
                      </article>
                    ))}
                    {!payload?.provider.services.length ? (
                      <div className={styles.empty}>尚未建立服務，或服務資料尚未載入。</div>
                    ) : null}
                  </div>
                </section>
              ) : (
                <section className={styles.sectionCard}>
                  <header className={styles.sectionHead}>
                    <div><span>Safety Boundary</span><h3>付款與履約原則</h3></div>
                  </header>
                  <div className={styles.note}>
                    付款完成不代表服務自動成立；提供者仍需接受。履約房只在開始前 15 分鐘到結束後 15 分鐘開放。雙方完成確認後，才進入撥款保留期。
                  </div>
                </section>
              )}

              {disputeBookingId ? (
                <section className={styles.sectionCard}>
                  <header className={styles.sectionHead}>
                    <div><span>Dispute</span><h3>建立爭議</h3></div>
                  </header>
                  <div className={styles.form}>
                    <label>
                      類別
                      <select value={disputeCategory} onChange={(event) => setDisputeCategory(event.target.value)}>
                        <option value="service_issue">服務問題</option>
                        <option value="no_show">未出席</option>
                        <option value="safety">安全疑慮</option>
                        <option value="payment">付款／退款</option>
                        <option value="other">其他</option>
                      </select>
                    </label>
                    <label>
                      說明
                      <textarea value={disputeDescription} onChange={(event) => setDisputeDescription(event.target.value)} placeholder="請至少用 10 個字描述實際情況。" />
                    </label>
                    <div className={styles.actions}>
                      <button type="button" data-primary="true" disabled={busyId === disputeBookingId} onClick={() => void submitDispute()}>
                        送出並暫停撥款
                      </button>
                      <button type="button" onClick={() => setDisputeBookingId("")}>取消</button>
                    </div>
                  </div>
                </section>
              ) : null}
            </aside>
          </div>
        ) : null}

        {view === "payout" ? (
          <div className={styles.layout}>
            <main className={styles.mainColumn}>
              <section className={styles.sectionCard}>
                <header className={styles.sectionHead}>
                  <div><span>Settlements</span><h2>近期撥款紀錄</h2></div>
                </header>
                <div className={styles.payoutList}>
                  {(payload?.payout.recent_items || []).map((item) => (
                    <article className={styles.payoutRow} key={item.id}>
                      <header><b>{formatTwd(item.amount_twd)}</b><span className={styles.chip}>{item.status}</span></header>
                      <p>建立：{formatDateTime(item.created_at)}</p>
                      <p>{item.processed_at ? `處理：${formatDateTime(item.processed_at)}` : "尚未完成處理"}</p>
                      {item.provider_reference ? <p>轉帳參考：{item.provider_reference}</p> : null}
                    </article>
                  ))}
                  {!payload?.payout.recent_items.length ? (
                    <div className={styles.empty}>目前沒有撥款批次紀錄。</div>
                  ) : null}
                </div>
              </section>
            </main>

            <aside className={styles.sideColumn}>
              <section className={styles.sectionCard}>
                <header className={styles.sectionHead}>
                  <div><span>Payout Account</span><h3>人工核對收款帳戶</h3></div>
                  <span className={styles.chip}>{label(payoutAccountLabels, payload?.payout.account?.status)}</span>
                </header>
                <div className={styles.form}>
                  <label>銀行代碼<input value={bankCode} onChange={(event) => setBankCode(event.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" maxLength={3} /></label>
                  <label>帳號末 4～5 碼<input value={accountLast5} onChange={(event) => setAccountLast5(event.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" maxLength={5} /></label>
                  <label>戶名<input value={accountHolder} onChange={(event) => setAccountHolder(event.target.value)} maxLength={80} /></label>
                  <label className={styles.checkRow}>
                    <input type="checkbox" checked={payoutConsent} onChange={(event) => setPayoutConsent(event.target.checked)} />
                    <span>我了解網站只保存銀行代碼、末碼與人工核對 reference；完整帳號需透過平台指定安全管道提供。</span>
                  </label>
                  <button type="button" data-primary="true" disabled={!payoutConsent} onClick={() => void savePayoutAccount()}>
                    送交人工核對
                  </button>
                </div>
                {payload?.payout.account?.reviewer_note ? (
                  <div className={styles.notice}>{payload.payout.account.reviewer_note}</div>
                ) : null}
              </section>
            </aside>
          </div>
        ) : null}

        <div className={styles.build}>
          Build {payload?.build_tag || P4B_BUILD_TAGS.workspace}・P3 dependency {payload?.dependency_build_tag || "讀取中"}
        </div>
      </div>
    </FormalOpsShell>
  );
}
