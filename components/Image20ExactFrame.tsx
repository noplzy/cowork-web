"use client";

import Link from "next/link";
import { type CSSProperties, type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";

export type Hotspot = {
  href?: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  onClick?: () => void;
};

export type ExactFrameProps = {
  image: string;
  mobileImage?: string;
  pageName: string;
  hotspots?: Hotspot[];
  children?: ReactNode;
};

export function Image20ExactFrame({ image, mobileImage, pageName, hotspots = [], children }: ExactFrameProps) {
  return (
    <main className="i20x-shell" data-image20-exact-page={pageName}>
      <div className="i20x-frame">
        <picture>
          {mobileImage ? <source srcSet={mobileImage} media="(max-width: 700px)" /> : null}
          <img className="i20x-reference" src={image} alt="" draggable={false} />
        </picture>
        <ExactNavLayer />
        {hotspots.map((spot) => <ExactHotspot key={`${spot.label}-${spot.x}-${spot.y}`} {...spot} />)}
        {children}
      </div>
    </main>
  );
}

function ExactHotspot({ href, label, x, y, w, h, onClick }: Hotspot) {
  const style: CSSProperties = { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` };

  if (onClick) {
    return <button type="button" className="i20x-hotspot" style={style} aria-label={label} onClick={onClick} />;
  }

  return <Link href={href ?? "#"} className="i20x-hotspot" style={style} aria-label={label} />;
}

export function ExactNavLayer() {
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    invalidateClientSessionSnapshotCache();
    clearAccountStatusCache();
    router.replace("/");
  }

  return (
    <>
      <Link href="/" className="i20x-hotspot" style={{ left: "4%", top: "3%", width: "16%", height: "6%" }} aria-label="回首頁" />
      <Link href="/" className="i20x-hotspot" style={{ left: "38.7%", top: "2%", width: "4.8%", height: "5.5%" }} aria-label="首頁" />
      <Link href="/rooms" className="i20x-hotspot" style={{ left: "43.8%", top: "2%", width: "6.3%", height: "5.5%" }} aria-label="同行空間" />
      <Link href="/buddies" className="i20x-hotspot" style={{ left: "50.3%", top: "2%", width: "6.4%", height: "5.5%" }} aria-label="安感夥伴" />
      <Link href="/pricing" className="i20x-hotspot" style={{ left: "57.2%", top: "2%", width: "7.7%", height: "5.5%" }} aria-label="方案價格" />
      <Link href="/contact" className="i20x-hotspot" style={{ left: "65.1%", top: "2%", width: "4.8%", height: "5.5%" }} aria-label="客服" />
      <Link href="/account" className="i20x-hotspot" style={{ left: "75%", top: "2%", width: "10.5%", height: "5.5%" }} aria-label="帳號中心" />
      <Link href="/account" className="i20x-hotspot" style={{ left: "86%", top: "2%", width: "5.5%", height: "5.5%" }} aria-label="我的島" />
      <button type="button" className="i20x-hotspot" style={{ left: "92%", top: "2%", width: "5.2%", height: "5.5%" }} aria-label="登出" onClick={signOut} />
    </>
  );
}

export function ExactAiOrb() {
  const [open, setOpen] = useState(false);
  return (
    <div className="i20x-ai-layer" data-ai-companion-entry="image2.0-exact-background-v5">
      {open ? (
        <div className="i20x-ai-panel">
          <img src="/site-assets/image20-reference/global-ai-companion-panel.png" alt="AI Companion Panel" />
          <button type="button" className="i20x-ai-close" onClick={() => setOpen(false)} aria-label="關閉 AI 面板" />
          <Link href="/rooms" className="i20x-ai-panel-hotspot" aria-label="前往 Rooms" />
        </div>
      ) : null}
      <button type="button" className="i20x-ai-orb" onClick={() => setOpen((value) => !value)} aria-label="開啟 AI 夥伴" />
    </div>
  );
}
