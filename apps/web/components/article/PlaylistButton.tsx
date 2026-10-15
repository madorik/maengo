"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { playlistToggle } from "@/app/actions";
import { IconCheck, IconPlus } from "@/components/icons";
import { useProfile } from "@/components/providers/ProfileProvider";
import { PremiumBadge } from "@/components/ui/PremiumBadge";

/** 글 화면의 '플레이리스트에 담기'(Premium). 담겨 있으면 눌린 모양이고, 다시 누르면 뺀다. Free는 Premium 안내로 */
export function PlaylistButton({ clusterId, initial }: { clusterId: number; initial: boolean }) {
  const profile = useProfile();
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const cls = "tile mt-6 inline-flex min-h-12 items-center justify-center gap-2 px-4 text-[15px] font-extrabold no-underline";

  if (!profile.audio) {
    return (
      <Link href="/premium" aria-label="플레이리스트에 담기, Premium에서 쓸 수 있어요" className={`${cls} text-faint`}>
        <IconPlus className="size-5" />
        플레이리스트에 담기
        <PremiumBadge />
      </Link>
    );
  }
  const toggle = () =>
    start(async () => {
      setError(null);
      const r = await playlistToggle(clusterId, !on);
      setOn(r.inPlaylist);
      setError(r.error ?? null);
    });
  return (
    <div>
      <button type="button" aria-pressed={on} onClick={toggle} disabled={busy} className={`${cls} ${on ? "border-sky bg-sky-tint text-sky-dark" : "hover:bg-snow"}`}>
        {on ? <IconCheck className="size-5 [stroke-width:3]" /> : <IconPlus className="size-5" />}
        {on ? "플레이리스트에 담김" : "플레이리스트에 담기"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-[14px] font-bold text-orange">
          {error}
        </p>
      )}
    </div>
  );
}
