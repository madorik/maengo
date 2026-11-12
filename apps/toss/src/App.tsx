import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { Spinner } from "@/components/ui/Spinner";
import { GuestTour, type TossMode } from "@/components/try/GuestTour";
import type { BriefingInsight } from "@/lib/server/briefing-insight";
import type { GuestItem } from "@/lib/types";
import { onBack } from "./bridge";
import { tossPlayer } from "./shims/player";
import { TossInsightHero } from "./TossInsight";
import { ReportEntry, TossReport, type TossReportData } from "./TossReport";

// 토스판 맹고: 로그인 없이 둘러보기(/try)와 같은 화면에 토스판 분야(AI·주식·반도체·로봇·Tech) 소식 10개.
// 머리에는 그 10개로 엮은 오늘의 흐름(앱 오늘 화면 머리와 같은 모양), 듣기 버튼 아래에 지난주 리포트 입구.
// 소식·음성·흐름·리포트는 맹고 서버의 토스 전용 공개 API(apps/web/app/api/toss). 로그인이 없어 회원 맞춤이 아닌 공통판이다
const API: string = import.meta.env.VITE_API_BASE ?? "https://watalabs.com/maengo";

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; items: GuestItem[] };

async function getJson<T>(path: string, timeoutMs = 20_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}${path}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function App() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [insight, setInsight] = useState<{ ids: number[]; insight: BriefingInsight | null } | null>(null);
  const [report, setReport] = useState<TossReportData | null>(null);
  const [screen, setScreen] = useState<"home" | "report">("home");
  const homeScroll = useRef(0);

  const fetchAll = useCallback(async () => {
    setLoad({ state: "loading" });
    // 흐름·리포트는 처음 만들 때 몇 초 걸려 소식 목록과 따로 받는다(못 받으면 그 칸만 없다)
    getJson<{ ids: number[]; insight: BriefingInsight | null }>("/api/toss/insight", 60_000).then(setInsight, () => {});
    getJson<{ report: TossReportData | null }>("/api/toss/report", 90_000).then((r) => setReport(r.report), () => {});
    try {
      const { items } = await getJson<{ items: GuestItem[] }>("/api/toss/tour");
      setLoad(items.length ? { state: "ready", items } : { state: "error" });
    } catch {
      setLoad({ state: "error" });
    }
  }, []);
  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // 리포트 화면에서는 토스 뒤로가기·안드로이드 백버튼이 오늘 화면으로 돌아온다(첫 화면에서는 구독하지 않아 미니앱이 닫힌다)
  const openReport = () => {
    homeScroll.current = window.scrollY;
    setScreen("report");
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    if (screen !== "report") return;
    return onBack(() => setScreen("home"));
  }, [screen]);
  useEffect(() => {
    if (screen === "home") window.scrollTo(0, homeScroll.current);
  }, [screen]);

  const items = load.state === "ready" ? load.items : null;
  // 흐름은 지금 목록과 같은 소식 묶음으로 만든 것만 쓴다(목록이 바뀌는 사이)
  const sameIds = !!items && !!insight?.insight && insight.ids.join(",") === items.map((i) => i.clusterId).join(",");
  const toss = useMemo<TossMode>(
    () => ({
      audioSrc: (item) => `${API}/api/toss/audio?id=${item.clusterId}`,
      label: "AI가 요약하고 읽어 주는 오늘의 브리핑",
      hero: sameIds && items ? <TossInsightHero insight={insight!.insight!} items={items} /> : undefined,
      extra: report ? <ReportEntry report={report} onOpen={openReport} /> : undefined,
      onPlayer: (api) => {
        tossPlayer.playId = api.playId;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sameIds, items, insight, report],
  );

  if (items) {
    return (
      <>
        {/* 리포트를 보는 동안에도 듣던 소식이 이어지게 오늘 화면은 숨기기만 한다 */}
        <div hidden={screen !== "home"}>
          <GuestTour items={items} toss={toss} perks={[]} priceLabel="" trialDays={0} />
        </div>
        {screen === "report" && report && <TossReport report={report} />}
      </>
    );
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-[400px] flex-col items-center justify-center bg-paper px-6 text-center">
      <Mascot mood="listen" className="size-24" />
      {load.state === "loading" ? (
        <Spinner className="mt-6 size-6 text-sub" />
      ) : (
        <>
          <h1 className="mt-4 text-[22px] font-bold tracking-[-0.03em]">소식을 불러오지 못했어요</h1>
          <p className="mt-2 text-[15px] font-medium leading-relaxed text-sub">인터넷 연결을 확인하고 다시 시도해 주세요.</p>
          <button type="button" onClick={() => void fetchAll()} className="btn mt-8 min-h-14 w-full text-[17px]">
            다시 불러오기
          </button>
        </>
      )}
    </main>
  );
}
