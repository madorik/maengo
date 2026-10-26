"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconBell } from "@/components/icons";
import type { AdminAlert } from "@/lib/admin-ops";

// 관리자 알림 종(위 막대 오른쪽). 운영 경고(lib/server/admin-alerts.ts)를 본문 위에 늘어놓지 않고, 종을 누르면 아래로 목록을 연다.
// 안 읽은 알림이 있으면 종에 빨간 점, 목록에서는 안 읽은 알림 앞에 빨간 점. 알림을 누르면 그 알림만, '모두 읽음'을 누르면 한 번에 읽은 것으로.
// 읽음은 이 브라우저에만 남긴다(알림은 DB에 쌓이는 게 아니라 열 때마다 새로 계산된다). 제목·내용이 바뀌면(문의 건수가 늘어나는 등) 다시 안 읽음이 된다.

const SEEN_KEY = "maengo:admin-alerts-seen";
const noSubscribe = () => () => {};
const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
};
const keyOf = (a: AdminAlert) => `${a.title}\n${a.detail}`;
const parse = (raw: string | null): Set<string> => {
  try {
    const v: unknown = JSON.parse(raw ?? "[]");
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
};

export function AlertBell({ alerts }: { alerts: AdminAlert[] }) {
  const stored = useSyncExternalStore(noSubscribe, readSeen, () => null);
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [seenRaw, setSeenRaw] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const seen = parse(seenRaw ?? stored);
  const isUnread = (a: AdminAlert) => hydrated && !seen.has(keyOf(a));
  const unread = alerts.filter(isUnread).length;

  // 바깥을 누르거나 Esc면 닫는다
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /** 읽은 것으로 남긴다. 지금 알림만 남겨서 사라진 알림의 기록이 쌓이지 않게 한다 */
  const markRead = (keys: string[]) => {
    const next = JSON.stringify(alerts.map(keyOf).filter((k) => seen.has(k) || keys.includes(k)));
    try {
      localStorage.setItem(SEEN_KEY, next);
    } catch {}
    setSeenRaw(next);
  };

  return (
    // 목록은 이 상자가 아니라 부르는 쪽의 기준 상자(relative) 오른쪽 끝에 붙는다: 종 오른쪽에 다른 버튼이 있어도 휴대폰에서 왼쪽으로 잘리지 않게
    <div ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="admin-alerts"
        aria-label={unread ? `알림, 안 읽은 알림 ${unread}개` : "알림"}
        className={`relative grid size-11 place-items-center rounded-xl text-ink hover:bg-snow ${open ? "bg-snow" : ""}`}
      >
        <IconBell className="size-6" />
        {unread > 0 && <span aria-hidden="true" className="absolute right-2 top-2 size-2.5 rounded-full bg-cherry ring-2 ring-paper" />}
      </button>
      {open && (
        <div
          id="admin-alerts"
          role="region"
          aria-label="알림"
          className="tile absolute right-0 top-full z-30 mt-2 max-h-[70vh] w-[min(400px,calc(100vw-40px))] overflow-y-auto shadow-[0_12px_32px_rgba(31,35,64,0.16)]"
        >
          <div className="sticky top-0 flex min-h-12 items-center justify-between gap-2 border-b-2 border-line bg-paper pl-4 pr-2">
            <p className="text-[14px] font-black">알림{alerts.length ? ` ${alerts.length}` : ""}</p>
            {alerts.length > 0 && (
              <button
                type="button"
                onClick={() => markRead(alerts.map(keyOf))}
                disabled={unread === 0}
                className="min-h-10 rounded-lg px-3 text-[13px] font-extrabold text-sky-dark hover:bg-sky-tint disabled:text-faint disabled:hover:bg-transparent"
              >
                모두 읽음
              </button>
            )}
          </div>
          {alerts.length === 0 ? (
            <p className="px-4 py-6 text-center text-[14px] font-semibold text-sub">알림이 없어요.</p>
          ) : (
            <ul className="divide-y-2 divide-line">
              {alerts.map((a) => {
                const fresh = isUnread(a);
                const inner = (
                  <>
                    <span aria-hidden="true" className={`mt-[7px] size-2 shrink-0 rounded-full ${fresh ? "bg-cherry" : "bg-line-dark"}`} />
                    <div className="min-w-0">
                      <p className={`text-[14px] font-black ${fresh ? "text-orange" : "text-sub"}`}>
                        {fresh && <span className="sr-only">안 읽은 알림: </span>}
                        {a.title}
                      </p>
                      <p className="mt-0.5 break-words text-[13px] font-semibold leading-relaxed text-sub">{a.detail}</p>
                    </div>
                  </>
                );
                const read = () => markRead([keyOf(a)]);
                return (
                  <li key={keyOf(a)}>
                    {/* 누르면 그 알림만 읽음. 갈 곳이 있는 알림(문의 등)은 그 탭으로 */}
                    {a.href ? (
                      <Link
                        href={a.href}
                        onClick={() => {
                          read();
                          setOpen(false);
                        }}
                        className="flex gap-2.5 px-4 py-3 no-underline hover:bg-snow"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button type="button" onClick={read} className="flex w-full gap-2.5 px-4 py-3 text-left hover:bg-snow">
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
