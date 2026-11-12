import { useCallback, useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { Spinner } from "@/components/ui/Spinner";
import { GuestTour, type TossMode } from "@/components/try/GuestTour";
import type { GuestItem } from "@/lib/types";

// 토스판 맹고: 로그인 없이 둘러보기(/try)와 같은 화면에 토스판 분야(AI·주식·반도체·로봇·Tech) 소식 10개를 띄운다.
// 소식·음성은 맹고 서버의 토스 전용 공개 API(apps/web/app/api/toss)
const API: string = import.meta.env.VITE_API_BASE ?? "https://watalabs.com/maengo";

const TOSS: TossMode = {
  audioSrc: (item) => `${API}/api/toss/audio?id=${item.clusterId}`,
  label: "AI가 요약하고 읽어 주는 오늘의 브리핑",
};

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; items: GuestItem[] };

export function App() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const fetchTour = useCallback(async () => {
    setLoad({ state: "loading" });
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20_000);
      const res = await fetch(`${API}/api/toss/tour`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { items } = (await res.json()) as { items: GuestItem[] };
      setLoad(items.length ? { state: "ready", items } : { state: "error" });
    } catch {
      setLoad({ state: "error" });
    }
  }, []);
  useEffect(() => {
    void fetchTour();
  }, [fetchTour]);

  if (load.state === "ready") return <GuestTour items={load.items} toss={TOSS} perks={[]} priceLabel="" trialDays={0} />;
  return (
    <main className="mx-auto flex min-h-dvh max-w-[400px] flex-col items-center justify-center bg-paper px-6 text-center">
      <Mascot mood="listen" className="size-24" />
      {load.state === "loading" ? (
        <Spinner className="mt-6 size-6 text-sub" />
      ) : (
        <>
          <h1 className="mt-4 text-[22px] font-bold tracking-[-0.03em]">소식을 불러오지 못했어요</h1>
          <p className="mt-2 text-[15px] font-medium leading-relaxed text-sub">인터넷 연결을 확인하고 다시 시도해 주세요.</p>
          <button type="button" onClick={() => void fetchTour()} className="btn mt-8 min-h-14 w-full text-[17px]">
            다시 불러오기
          </button>
        </>
      )}
    </main>
  );
}
