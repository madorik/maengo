import { withBase } from "@/lib/base-path";

/**
 * 음성을 못 만들었을 때 보여 줄 오류(짧게 한 줄, 옆에 '다시 시도' 버튼이 있다). <audio>는 응답 본문을 못 읽어서, 실패하면 서비스 음성 한도가 찼는지 다시 물어 본다.
 */
export async function ttsErrorMessage(): Promise<string> {
  try {
    const res = await fetch(withBase("/api/tts-status"), { cache: "no-store" });
    const { busy } = (await res.json()) as { busy: boolean };
    // 한도는 몇 시간 뒤에 풀려서 그때까지는 다시 눌러도 안 된다는 것만 덧붙인다
    if (busy) return "음성 사용량이 꽉 찼어요. 몇 시간 뒤 다시 눌러 주세요";
  } catch {}
  return "음성을 만들지 못했어요";
}
