/**
 * 음성을 기다리는 동안 알려 주는 말과 어림 시간(2026-11-27 사용자: 만드는 10초 동안 지루하지 않게, 기다릴 수 있는 시간을 알려 주자, 음성으로도).
 * Free(Chirp)는 소식 하나를 한 번에 만들어 약 11초, Premium(Gemini)은 약 5초(2026-11-27 잼).
 * 기다린 시간에 따라 단계가 바뀌고, 화면의 기다림 칸(components/listen/WaitProgress.tsx)과 안내 음성(public/voice-samples/wait-*.mp3,
 * scripts/voice-samples.ts --wait)이 같은 때 같은 말을 한다. 안내 음성은 기다리기 시작하고 WAIT_DELAY_MS 뒤에 처음부터 나온다
 */
export const WAIT = {
  title: "자연스러운 목소리로 만들고 있어요",
  lateTitle: "조금 더 걸리고 있어요",
} as const;

/** 기다리기 시작하고 안내 음성이 처음부터 나오기까지(이미 만든 음성은 보통 이 안에 열려 안내가 들리지 않는다, PlayerProvider) */
export const WAIT_DELAY_MS = 800;

export interface WaitStage {
  /** 기다리기 시작하고 이만큼 지나면 이 단계 */
  atMs: number;
  title: string;
  note: string;
  /** 안내 음성이 이때 하는 말 */
  say: string;
}

/** 기다림 단계(처음 → 곧 → 늦어짐 → 더 늦어짐). 늦어짐은 어림 시간 3초 뒤 */
export function waitStages(premium: boolean): WaitStage[] {
  const late = waitSeconds(premium) * 1000 + 3000;
  const time = premium ? "5초쯤" : "10초쯤";
  return [
    { atMs: 0, title: WAIT.title, note: `${time} 걸려요`, say: `${WAIT.title}. ${time} 걸려요.` },
    // Premium은 처음 말이 끝날 무렵 다 되므로 '곧'은 Free만
    ...(premium ? [] : [{ atMs: 8000, title: WAIT.title, note: "곧 들려 드릴게요", say: "곧 들려 드릴게요." }]),
    { atMs: late, title: WAIT.lateTitle, note: "사람이 몰리면 그래요", say: "사람이 몰려서 조금 더 걸리고 있어요." },
    { atMs: late + 15000, title: WAIT.lateTitle, note: "조금만 더 기다려 주세요", say: "조금만 더 기다려 주세요." },
  ];
}

/** 기다린 시간(ms)의 단계 */
export function waitStageAt(elapsedMs: number, premium: boolean): WaitStage {
  const stages = waitStages(premium);
  return stages.filter((s) => s.atMs <= elapsedMs).at(-1) ?? stages[0]!;
}

/** 기다릴 어림 시간(초). 진행 막대가 이 시간 동안 차오른다 */
export function waitSeconds(premium: boolean): number {
  return premium ? 6 : 12;
}

/** 좁은 자리(떠 있는 플레이어 막대)용 한 줄. 단계를 따른다 */
export function waitShort(stage: WaitStage, premium: boolean): string {
  if (stage.atMs === 0) return premium ? "목소리 만드는 중, 5초쯤" : "목소리 만드는 중, 10초쯤";
  return stage.title === WAIT.title ? stage.note : stage.title;
}

/**
 * 기다린 시간 → 진행 막대 채움(0~1). 어림 시간까지 0.9까지 거의 곧게 차고, 그 뒤로는 0.97을 넘지 않게 천천히(끝을 모르므로 다 채우지 않는다)
 */
export function waitFill(elapsedMs: number, premium: boolean): number {
  const t = elapsedMs / (waitSeconds(premium) * 1000);
  if (t <= 1) return 0.04 + 0.86 * t;
  return Math.min(0.97, 0.9 + 0.07 * (1 - Math.exp(-(t - 1) * 1.5)));
}

export function minutesLabel(ms: number | null): string {
  return ms === null ? "" : `약 ${Math.max(1, Math.round(ms / 60000))}분`;
}
