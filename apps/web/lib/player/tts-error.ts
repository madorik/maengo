/**
 * 음성을 못 만들었을 때 보여 줄 안내. <audio>는 응답 본문을 못 읽어서, 실패하면 서비스 음성 한도가 찼는지 다시 물어 본다.
 */
export async function ttsErrorMessage(): Promise<string> {
  try {
    const res = await fetch("/api/tts-status", { cache: "no-store" });
    const { busy } = (await res.json()) as { busy: boolean };
    if (busy) return "지금은 음성 서비스 사용량이 꽉 찼어요. 몇 시간 뒤 다시 눌러 주세요. 이미 만든 음성은 들을 수 있어요.";
  } catch {}
  return "음성을 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.";
}
