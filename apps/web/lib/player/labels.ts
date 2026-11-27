/**
 * 음성을 기다리는 동안 알려 주는 말과 어림 시간(2026-11-27 사용자: 만드는 10초 동안 지루하지 않게, 기다릴 수 있는 시간을 알려 주자, 음성으로도).
 * Free(Chirp)는 소식 하나를 한 번에 만들어 약 11초, Premium(Gemini)은 약 5초(2026-11-27 잼).
 * 기다린 시간에 따라 단계가 바뀌고, 화면의 기다림 칸(components/listen/WaitProgress.tsx)과 안내 음성(public/voice-samples/wait-*.mp3,
 * scripts/voice-samples.ts --wait)이 같은 때 같은 말을 한다. 안내 음성은 기다리기 시작하고 WAIT_DELAY_MS 뒤에 처음부터 나온다
 */
export const WAIT = {
  title: "조금 더 자연스러운 문장으로 다듬고 있어요",
  soonTitle: "거의 다 됐어요",
  lateTitle: "오늘따라 듣는 분이 많네요",
  thanksTitle: "기다려 주셔서 고마워요",
} as const;

/** 기다리기 시작하고 안내 음성이 처음부터 나오기까지(이미 만든 음성은 보통 이 안에 열려 안내가 들리지 않는다, PlayerProvider) */
export const WAIT_DELAY_MS = 800;

export interface WaitStage {
  /** 기다리기 시작하고 이만큼 지나면 이 단계 */
  atMs: number;
  title: string;
  note: string;
  /** 떠 있는 막대의 둘째 줄(글 자리 170px, 12px 글자로 14자 안팎) */
  short: string;
  /** 안내 음성이 이때 하는 말('~'처럼 읽기 어색한 기호는 뺀다) */
  say: string;
}

/**
 * 기다림 단계(처음 → 곧 → 늦어짐 → 고마움). 늦어짐은 어림 시간 3초 뒤.
 * 말투는 다정하게(2026-11-27 사용자: 안내 글을 좀 더 감성적으로, '조금 더 자연스러운 문장으로 다듬고 있어요. 10초 정도 걸릴 것 같아요. 조금만 기다려주세요~!' 이런 식으로)
 */
export function waitStages(premium: boolean): WaitStage[] {
  const late = waitSeconds(premium) * 1000 + 3000;
  const time = premium ? "5초" : "10초";
  return [
    {
      atMs: 0,
      title: WAIT.title,
      note: `${time} 정도 걸릴 것 같아요. 조금만 기다려주세요~!`,
      short: `다듬는 중이에요, ${time}쯤`,
      say: `${WAIT.title}. ${time} 정도 걸릴 것 같아요. 조금만 기다려 주세요!`,
    },
    // Premium은 처음 말이 끝날 무렵 다 되므로 '곧'은 Free만. 처음 말(약 6.7초)과 1초쯤 띄우고, 보통 다 되는 11~12초 전에 끝나게 8.5초
    ...(premium
      ? []
      : [{ atMs: 8500, title: WAIT.soonTitle, note: "곧 들려 드릴게요!", short: "거의 다 됐어요!", say: "거의 다 됐어요. 곧 들려 드릴게요!" }]),
    {
      atMs: late,
      title: WAIT.lateTitle,
      note: "조금만 더 기다려 주시면 금방 들려 드릴게요",
      short: "듣는 분이 많네요, 금방요",
      say: "오늘따라 듣는 분이 많아서 조금 더 걸리고 있어요. 금방 들려 드릴게요!",
    },
    { atMs: late + 15000, title: WAIT.thanksTitle, note: "정말 조금만 더요!", short: "조금만 더 기다려 주세요", say: "기다려 주셔서 고마워요. 정말 조금만 더요!" },
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
