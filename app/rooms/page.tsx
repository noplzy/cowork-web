"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { fetchAccountStatus, type AccountStatusResp } from "@/lib/accountStatusClient";
import { getClientSessionSnapshot } from "@/lib/clientAuth";
import { Image20SidebarShell } from "@/components/image20/Image20Chrome";
import { Image20MobileDock, roomScenes } from "@/components/image20/Image20Shared";
import {
  ACTIVE_ROOM_SCENE_OPTIONS,
  INSTANT_ROOM_DURATION_OPTIONS,
  INTERACTION_STYLE_OPTIONS,
  SCHEDULE_DURATION_OPTIONS,
  SCHEDULE_SEAT_LIMIT_OPTIONS,
  SCHEDULE_VISIBILITY_OPTIONS,
  formatDateTimeRange,
  formatDurationLabel,
  labelForInteractionStyle,
  labelForRoomScene,
  labelForVisibility,
  normalizeRoomCategoryForUi,
  toDatetimeLocalValue,
  type ActiveRoomScene,
  type InteractionStyle,
  type PublicProfileRow,
  type RoomCategory,
  type ScheduleVisibility,
} from "@/lib/socialProfile";

type Room = { id: string; title: string; duration_minutes: number; mode: "group" | "pair"; max_size: number; created_at: string; created_by: string; room_category?: RoomCategory | null; interaction_style?: InteractionStyle | null; visibility?: ScheduleVisibility | null; host_note?: string | null; invite_code?: string | null; };
type ScheduledRoomPostRow = { id: string; host_user_id: string; title: string; room_category: RoomCategory; interaction_style: InteractionStyle; visibility: ScheduleVisibility; start_at: string; end_at: string; duration_minutes: number; seat_limit: number; note: string | null; invite_code?: string | null; };
type Snapshot = { rooms: Room[]; schedulePosts: ScheduledRoomPostRow[]; hostProfiles: Record<string, PublicProfileRow>; generatedAt: string; cacheState: "cached" | "fresh"; buildTag: string; };
type Mode = "now" | "schedule";
type Filter = "all" | ActiveRoomScene;
const sceneCover: Record<ActiveRoomScene, string> = { focus: "/site-assets/image20/rooms/room-thumb-silent-focus-work.png", life: "/site-assets/image20/rooms/room-thumb-life-light-chat.png", share: "/site-assets/image20/rooms/room-thumb-topic-share-books.png", hobby: "/site-assets/image20/rooms/room-thumb-hobby-evening-craft.png" };
function minDatetimeLocalValue(){ return toDatetimeLocalValue(new Date(Date.now()+60*60*1000).toISOString()); }
function costLabel(minutes:number){ return `${Math.ceil(minutes/25)} 場`; }

export default function RoomsPage(){
  const router=useRouter(); const params=useSearchParams();
  const [email,setEmail]=useState(""); const [userId,setUserId]=useState(""); const [accessToken,setAccessToken]=useState(""); const [status,setStatus]=useState<AccountStatusResp|null>(null);
  const [rooms,setRooms]=useState<Room[]>([]); const [schedulePosts,setSchedulePosts]=useState<ScheduledRoomPostRow[]>([]); const [profiles,setProfiles]=useState<Record<string,PublicProfileRow>>({});
  const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false); const [msg,setMsg]=useState("");
  const [mode,setMode]=useState<Mode>((params.get("mode")==="schedule"?"schedule":"now")); const [filter,setFilter]=useState<Filter>((["focus","life","share","hobby"].includes(params.get("scene")||"")?params.get("scene"):"all") as Filter);
  const [instantTitle,setInstantTitle]=useState("晚間共工 50 分鐘｜安靜同行"); const [instantCategory,setInstantCategory]=useState<RoomCategory>("focus"); const [instantInteraction,setInstantInteraction]=useState<InteractionStyle>("silent"); const [instantVisibility,setInstantVisibility]=useState<ScheduleVisibility>("public"); const [instantRoomMode,setInstantRoomMode]=useState<"group"|"pair">("group"); const [instantDuration,setInstantDuration]=useState<number>(50); const [instantSize,setInstantSize]=useState<number>(4); const [instantNote,setInstantNote]=useState("");
  const [scheduleTitle,setScheduleTitle]=useState("晚間共工 50 分鐘｜安靜同行"); const [startAtInput,setStartAtInput]=useState(minDatetimeLocalValue()); const [durationMinutes,setDurationMinutes]=useState<number>(50); const [seatLimit,setSeatLimit]=useState<number>(4); const [scheduleNote,setScheduleNote]=useState("");
  const [inviteCode,setInviteCode]=useState(""); const [inviteResult,setInviteResult]=useState<any>(null);

  async function loadBoard(token=accessToken, uid=userId, fresh=false){
    setLoading(true); setMsg("");
    try{
      const url=new URL("/api/public/rooms-board", window.location.origin); if(fresh) url.searchParams.set("fresh","1");
      const res=await fetch(url.toString(),{cache:fresh?"no-store":"default"}); const json=await res.json().catch(()=>null) as Snapshot|null;
      if(!res.ok||!json||!("rooms" in json)) throw new Error("讀取同行空間列表失敗。");
      setRooms(json.rooms||[]); setSchedulePosts(json.schedulePosts||[]); setProfiles(json.hostProfiles||{});
      if(token){ const s=await fetchAccountStatus(token).catch(()=>null); if(s) setStatus(s); }
    }catch(e:any){ setMsg(e?.message||"讀取房間失敗。"); } finally{ setLoading(false); }
  }
  useEffect(()=>{ let cancelled=false; (async()=>{ const session=await getClientSessionSnapshot().catch(()=>null); if(!session){ router.replace("/auth/login"); return; } if(cancelled) return; setEmail(session.email); setUserId(session.user.id); setAccessToken(session.accessToken??""); await loadBoard(session.accessToken??"", session.user.id); })(); return()=>{cancelled=true}; },[router]);
  useEffect(()=>{ if(filter!=="all"){ setInstantCategory(filter); } },[filter]);
  const filteredRooms=useMemo(()=>rooms.filter(r=>filter==="all"||normalizeRoomCategoryForUi(r.room_category)===filter),[rooms,filter]);
  const filteredSchedules=useMemo(()=>schedulePosts.filter(p=>filter==="all"||normalizeRoomCategoryForUi(p.room_category)===filter),[schedulePosts,filter]);
  function updateRoute(nextMode:Mode,nextFilter:Filter){ const sp=new URLSearchParams(); sp.set("mode",nextMode); if(nextFilter!=="all") sp.set("scene",nextFilter); router.replace(`/rooms?${sp.toString()}#rooms-board`,{scroll:false}); }
  function switchMode(m:Mode){ setMode(m); updateRoute(m,filter); }
  function switchFilter(f:Filter){ setFilter(f); updateRoute(mode,f); }
  async function createInstantRoom(){ setBusy(true); setMsg(""); try{ const res=await fetch("/api/rooms/create",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${accessToken}`},body:JSON.stringify({title:instantTitle.trim(),duration_minutes:instantDuration,mode:instantRoomMode,max_size:instantRoomMode==="pair"?2:instantSize,room_category:filter==="all"?instantCategory:filter,interaction_style:instantInteraction,visibility:instantVisibility,host_note:instantNote.trim()||null})}); const json=await res.json().catch(()=>({})); if(!res.ok) throw new Error(json?.error||"建立同行空間失敗。"); await loadBoard(accessToken,userId,true); if(json?.room?.id) router.push(`/rooms/${json.room.id}`); else setMsg("已建立同行空間。"); }catch(e:any){ setMsg(e?.message||"建立失敗。"); }finally{ setBusy(false); } }
  async function createSchedulePost(){ setBusy(true); setMsg(""); try{ const category=filter==="all"?instantCategory:filter; const result=await supabase.from("scheduled_room_posts").insert({host_user_id:userId,title:scheduleTitle.trim().slice(0,80),room_category:category,interaction_style:instantInteraction,visibility:instantVisibility,start_at:new Date(startAtInput).toISOString(),end_at:new Date(new Date(startAtInput).getTime()+durationMinutes*60000).toISOString(),duration_minutes:durationMinutes,seat_limit:seatLimit,note:scheduleNote.trim()||null}); if(result.error) throw result.error; setMsg("已建立排程。若是邀請制，系統會自動產生邀請碼。"); await loadBoard(accessToken,userId,true); }catch(e:any){ setMsg(e?.message||"建立排程失敗。"); }finally{ setBusy(false); } }
  async function joinRoom(roomId:string, inviteCodeArg?:string){ setBusy(true); setMsg(""); try{ const res=await fetch("/api/rooms/join",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${accessToken}`},body:JSON.stringify(inviteCodeArg?{inviteCode:inviteCodeArg}:{roomId})}); const json=await res.json().catch(()=>({})); if(!res.ok) throw new Error(json?.error||"加入房間失敗。"); router.push(`/rooms/${json.roomId||roomId}`); }catch(e:any){ setMsg(e?.message||"加入失敗。"); }finally{ setBusy(false); } }
  async function resolveInvite(){ setBusy(true); setMsg(""); setInviteResult(null); try{ const res=await fetch("/api/rooms/invite/resolve",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${accessToken}`},body:JSON.stringify({inviteCode})}); const json=await res.json().catch(()=>({})); if(!res.ok) throw new Error(json?.error||"查找邀請碼失敗。"); setInviteResult(json); }catch(e:any){ setMsg(e?.message||"查找失敗。"); }finally{ setBusy(false); } }

  return <Image20SidebarShell title="探索房間" email={email}>
    <div className="i20-page" data-image20-dom-page="rooms-browsing-v6" id="rooms-board">
      <section className="i20-panel dark" style={{backgroundImage:"linear-gradient(90deg,rgba(7,21,29,.95),rgba(7,21,29,.68)),url(/site-assets/image20/rooms/rooms-browsing-lounge-evening.png)",backgroundSize:"cover",backgroundPosition:"center",minHeight:270}}>
        <span className="i20-kicker">Rooms Browsing</span><h2 className="i20-serif" style={{fontSize:44,margin:"12px 0"}}>今天想去哪一種房間？</h2><p>先決定現在進房或排程，再從專注、生活、分享、興趣中挑一個舒服的入口。</p>
        <div className="i20-actions-row"><button className={`i20-btn ${mode==="now"?"":"ghost"}`} onClick={()=>switchMode("now")}>現在可進房</button><button className={`i20-btn peach ${mode==="schedule"?"":""}`} onClick={()=>switchMode("schedule")}>排程房間</button></div>
      </section>
      <section className="i20-softbar" style={{marginTop:18}}><div className="i20-chip-row"><button className={`i20-chip ${filter==="all"?"active":""}`} onClick={()=>switchFilter("all")}>全部</button>{ACTIVE_ROOM_SCENE_OPTIONS.map(o=><button key={o.value} className={`i20-chip ${filter===o.value?"active":""}`} onClick={()=>switchFilter(o.value)}>{o.label}</button>)}</div><button className="i20-btn light" onClick={()=>loadBoard(accessToken,userId,true)}>重新整理</button></section>
      {msg?<div className="i20-panel" style={{marginTop:18,color:"#a43d2f"}}>{msg}</div>:null}
      <div className="i20-room-layout" style={{marginTop:18}}>
        <section className="i20-panel">
          <div className="i20-section-head"><div><span className="i20-kicker">{mode==="now"?"Now":"Schedule"}</span><h3>{mode==="now"?"現在可加入的房間":"可預約的排程"}</h3></div><span className="i20-chip">{mode==="now"?filteredRooms.length:filteredSchedules.length} 間</span></div>
          {loading?<div className="i20-card">正在整理房間列表…</div>:mode==="now"?(
            filteredRooms.length? <div className="i20-room-grid">{filteredRooms.map(room=>{ const scene=normalizeRoomCategoryForUi(room.room_category); return <article className="i20-card i20-room-card" key={room.id}><div className="i20-card-cover" style={{backgroundImage:`url(${sceneCover[scene]})`}}/><div className="i20-chip-row"><span className="i20-chip">{labelForRoomScene(scene)}</span><span className="i20-chip">{formatDurationLabel(room.duration_minutes)}</span><span className="i20-chip">{labelForVisibility(room.visibility)}</span></div><h3>{room.title}</h3><p>{room.host_note||"一間低壓力、可立即加入的安靜同行空間。"}</p><button className="i20-btn" onClick={()=>joinRoom(room.id)} disabled={busy}>加入房間</button></article>})}</div> : <EmptyRoom />
          ):(
            filteredSchedules.length? <div className="i20-list">{filteredSchedules.map(post=><article className="i20-list-row" key={post.id}><div className="i20-avatar">{labelForRoomScene(post.room_category).slice(0,1)}</div><div><b>{post.title}</b><p style={{margin:"4px 0 0"}}>{formatDateTimeRange(post.start_at,post.end_at)} · {labelForInteractionStyle(post.interaction_style)} · {post.seat_limit} 人</p></div><span className="i20-chip">{labelForVisibility(post.visibility)}</span></article>)}</div> : <EmptyRoom />
          )}
        </section>
        <aside className="i20-panel dark">
          <span className="i20-kicker">Create / Invite</span><h3>想開始，就在這裡開一間。</h3>
          <div className="i20-list" style={{marginTop:16}}>
            <div className="i20-field"><label>房間名稱</label><input className="i20-input" value={instantTitle} onChange={e=>setInstantTitle(e.target.value)} /></div>
            <div className="i20-form-grid"><div className="i20-field"><label>場景</label><select className="i20-select" value={filter==="all"?instantCategory:filter} onChange={e=>setInstantCategory(e.target.value as RoomCategory)} disabled={filter!=="all"}>{ACTIVE_ROOM_SCENE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div><div className="i20-field"><label>互動</label><select className="i20-select" value={instantInteraction} onChange={e=>setInstantInteraction(e.target.value as InteractionStyle)}>{INTERACTION_STYLE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div></div>
            {mode==="now"? <><div className="i20-form-grid"><div className="i20-field"><label>時長</label><select className="i20-select" value={instantDuration} onChange={e=>setInstantDuration(Number(e.target.value))}>{INSTANT_ROOM_DURATION_OPTIONS.map(m=><option key={m} value={m}>{formatDurationLabel(m)}（{costLabel(m)}）</option>)}</select></div><div className="i20-field"><label>房型</label><select className="i20-select" value={instantRoomMode} onChange={e=>setInstantRoomMode(e.target.value as "group"|"pair")}><option value="group">小組同行</option><option value="pair">雙人同行</option></select></div></div><div className="i20-field"><label>補充說明</label><textarea className="i20-textarea" value={instantNote} onChange={e=>setInstantNote(e.target.value)} /></div><button className="i20-btn peach" disabled={busy||!instantTitle.trim()} onClick={createInstantRoom}>建立同行空間</button></> : <><div className="i20-form-grid"><div className="i20-field"><label>開始時間</label><input className="i20-input" type="datetime-local" min={minDatetimeLocalValue()} value={startAtInput} onChange={e=>setStartAtInput(e.target.value)} /></div><div className="i20-field"><label>時長</label><select className="i20-select" value={durationMinutes} onChange={e=>setDurationMinutes(Number(e.target.value))}>{SCHEDULE_DURATION_OPTIONS.map(m=><option key={m} value={m}>{formatDurationLabel(m)}</option>)}</select></div></div><div className="i20-form-grid"><div className="i20-field"><label>可見性</label><select className="i20-select" value={instantVisibility} onChange={e=>setInstantVisibility(e.target.value as ScheduleVisibility)}>{SCHEDULE_VISIBILITY_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div><div className="i20-field"><label>名額</label><select className="i20-select" value={seatLimit} onChange={e=>setSeatLimit(Number(e.target.value))}>{SCHEDULE_SEAT_LIMIT_OPTIONS.map(m=><option key={m} value={m}>{m} 人</option>)}</select></div></div><textarea className="i20-textarea" value={scheduleNote} onChange={e=>setScheduleNote(e.target.value)} placeholder="補充說明"/><button className="i20-btn peach" disabled={busy||!scheduleTitle.trim()} onClick={createSchedulePost}>建立排程</button></>}
            <div className="i20-softbar" style={{background:"rgba(255,255,255,.08)",borderColor:"rgba(255,255,255,.12)"}}><input className="i20-input" value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())} placeholder="邀請碼"/><button className="i20-btn ghost" disabled={busy||!inviteCode} onClick={resolveInvite}>查找</button></div>
            {inviteResult?.kind==="room"?<button className="i20-btn" onClick={()=>joinRoom(inviteResult.room.id, inviteCode)}>加入邀請房</button>:null}
          </div>
        </aside>
      </div>
      <section className="i20-grid four" style={{marginTop:18}}>{roomScenes.map(s=><article className="i20-card" key={s.key}><img src={s.image} alt="" style={{width:"100%",height:110,objectFit:"cover",borderRadius:18}}/><h3>{s.title}</h3><p>{s.body}</p></article>)}</section>
    </div><Image20MobileDock />
  </Image20SidebarShell>;
}
function EmptyRoom(){return <div className="i20-card"><img src="/site-assets/image20/rooms/empty-rooms-gentle-first-room.png" alt="" style={{width:"100%",borderRadius:18,marginBottom:12}}/><h3>目前沒有符合條件的房間。</h3><p>你可以切換場景、改看排程，或直接建立一間新的房間。</p></div>}
