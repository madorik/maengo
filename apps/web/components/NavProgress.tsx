"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

// instrumentation-client.ts와 같은 이름(그 파일은 앱보다 먼저 도는 곳이라 여기서 불러오지 않는다)
const NAV_START_EVENT = "maengo:nav-start";
/** 이보다 빨리 끝나는 이동에는 보이지 않는다(깜빡임 방지) */
const SHOW_AFTER_MS = 100;
/** 무슨 일이 있어도 이만큼 지나면 닫는다 */
const GIVE_UP_MS = 15_000;

/** 주소에서 경로와 쿼리만(#은 같은 화면이라 뺀다) */
const pageOf = (href: string) => {
  const u = new URL(href, window.location.href);
  return u.pathname + u.search;
};

function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const running = useRef(false);
  const timers = useRef<number[]>([]);
  const finishRef = useRef<() => void>(() => {});

  const clear = () => {
    // setTimeout·setInterval 번호는 같은 공간이라 둘 다 지운다
    for (const t of timers.current) {
      window.clearTimeout(t);
      window.clearInterval(t);
    }
    timers.current = [];
  };

  // 이동이 시작되면 잠깐 기다렸다가 보이고, 끝날 때까지 90% 직전까지 천천히 차오른다
  useEffect(() => {
    const onStart = (e: Event) => {
      const to = (e as CustomEvent<string>).detail;
      if (!to || pageOf(to) === window.location.pathname + window.location.search) return;
      clear();
      running.current = true;
      timers.current.push(
        window.setTimeout(() => {
          if (!running.current) return;
          setVisible(true);
          setWidth(12);
          timers.current.push(window.setInterval(() => setWidth((w) => w + (90 - w) * 0.08), 200));
        }, SHOW_AFTER_MS),
        window.setTimeout(() => finish(), GIVE_UP_MS),
      );
    };
    const finish = () => {
      if (!running.current) return;
      running.current = false;
      clear();
      setWidth(100);
      timers.current.push(window.setTimeout(() => setVisible(false), 250), window.setTimeout(() => setWidth(0), 500));
    };
    window.addEventListener(NAV_START_EVENT, onStart);
    finishRef.current = finish;
    return () => {
      window.removeEventListener(NAV_START_EVENT, onStart);
      clear();
    };
  }, []);

  // 경로나 쿼리가 바뀌면 이동이 끝난 것이다
  useEffect(() => {
    finishRef.current();
  }, [pathname, search]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-[100] h-[3px] transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="h-full rounded-r-full bg-mango-dark shadow-[0_0_8px_var(--color-mango)] transition-[width] duration-200 ease-out" style={{ width: `${width}%` }} />
    </div>
  );
}

/** 화면을 옮기는 동안 맨 위에 차오르는 얇은 진행 바. useSearchParams 때문에 Suspense로 감싼다 */
export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
