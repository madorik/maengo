import { DAILY_LINK_VOICES } from "@maengo/core/plans";
import { withBase } from "@/lib/base-path";

/** 내 관심 링크 소식 음성을 오늘 더 만들 수 없을 때(app/api/tts-status linkLimit) */
export const LINK_VOICE_LIMIT = `내 관심 링크 소식은 하루 ${DAILY_LINK_VOICES}개까지 새로 들을 수 있어요`;

/** 소식 카드 머리줄처럼 좁은 곳에 쓰는 짧은 오류 */
export function ttsErrorLabel(error: string): string {
  return error === LINK_VOICE_LIMIT ? `링크 음성은 하루 ${DAILY_LINK_VOICES}개까지` : "음성을 못 만들었어요";
}

/**
 * 음성을 못 만들었을 때 보여 줄 오류(짧게 한 줄, 옆에 '다시 시도' 버튼이 있다). <audio>는 응답 본문을 못 읽어서, 실패하면 이유를 다시 물어 본다:
 * 서비스 음성 한도가 찼는지, 소식 하나(clusterId)를 듣다 실패했으면 오늘 링크 소식 음성 몫을 다 썼는지
 */
export async function ttsErrorMessage(clusterId?: number): Promise<string> {
  try {
    const res = await fetch(withBase(`/api/tts-status${clusterId ? `?id=${clusterId}` : ""}`), { cache: "no-store" });
    const { busy, linkLimit } = (await res.json()) as { busy: boolean; linkLimit?: boolean };
    // 한도는 몇 시간 뒤에 풀려서 그때까지는 다시 눌러도 안 된다는 것만 덧붙인다
    if (busy) return "음성 사용량이 꽉 찼어요. 몇 시간 뒤 다시 눌러 주세요";
    if (linkLimit) return LINK_VOICE_LIMIT;
  } catch {}
  return "음성을 만들지 못했어요";
}
