"use client";

import { useRouter } from "next/navigation";
import { IconBack } from "@/components/icons";

/** 들어온 곳으로 돌아간다. 바로 열었으면(앞 기록 없음) 대신 갈 곳으로 */
export function BackButton({ fallback = "/today", label = "뒤로" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-[15px] font-extrabold text-sub hover:bg-snow"
    >
      <IconBack />
      {label}
    </button>
  );
}
