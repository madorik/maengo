"use client";

import { useEffect, useRef, useState } from "react";
import { smallPhoto, type PhotoSize } from "@/lib/photo";

// 작게 그리는 원문 사진(2026-11-11 성능 2번 A안, lib/photo.ts).
// - 화면에 다가올 때(300px 앞)만 받는다. 브라우저 기본 lazy는 느린 망에서 1~2화면 앞까지 미리 받아서
// - 언론사가 주는 작은 크기 주소가 있으면 그걸 먼저, 못 불러오면 원본, 그것도 안 되면 자리째 숨긴다(지금처럼)
// 받기 전에는 같은 크기의 빈 자리(className 그대로)를 둔다

export function PhotoImg({ src, size = "list", className }: { src: string; size?: PhotoSize; className: string }) {
  const small = smallPhoto(src, size);
  const [stage, setStage] = useState<0 | 1 | 2>(small ? 0 : 1);
  const [near, setNear] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  if (stage === 2) return null;
  if (!near) return <span ref={ref} aria-hidden="true" className={`block shrink-0 ${className}`} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 언론사마다 주소가 달라 next/image 허용 목록에 넣을 수 없고, 최적화(복사본)를 만들지 않으려고
    <img
      src={stage === 0 && small ? small : src}
      alt=""
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setStage((s) => (s === 0 ? 1 : 2))}
      className={`shrink-0 object-cover ${className}`}
    />
  );
}
