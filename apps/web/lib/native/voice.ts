import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capgo/capacitor-speech-recognition";

// 맹고 AI 음성 입력(2026-11-03). 말한 질문을 글자로 바꿔 입력칸에 넣는다(보내기는 사람이 누른다).
// - 앱: 네이티브 음성 인식(@capgo/capacitor-speech-recognition, iOS Speech·안드로이드 SpeechRecognizer). 이 플러그인이 든 앱 빌드부터 보인다.
//   앱 웹뷰의 브라우저 음성 인식은 쓰지 않는다(안드로이드 웹뷰엔 없고, iOS는 권한 문구 없이 부르면 앱이 죽는다)
// - 웹 브라우저: Web Speech API(크롬·엣지·사파리). 없으면(파이어폭스 등) 마이크 버튼을 숨긴다
// 음성은 기기·브라우저 제공자(Apple·Google)가 글자로 바꾸고, 맹고 서버는 음성을 받지 않는다.

export type VoiceKind = "native" | "web";
export type VoiceError = "denied" | "failed";

export interface VoiceHandlers {
  /** 지금까지 알아들은 글 전체(말하는 동안 계속 바뀐다) */
  onText: (text: string) => void;
  onEnd: () => void;
  onError: (e: VoiceError) => void;
}

const LANG = "ko-KR";

type WebRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type WebRecognitionCtor = new () => WebRecognition;

function webCtor(): WebRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: WebRecognitionCtor; webkitSpeechRecognition?: WebRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** 이 기기에서 쓸 음성 입력. 없으면 null(마이크 버튼을 숨긴다) */
export function voiceKind(): VoiceKind | null {
  if (Capacitor.isNativePlatform()) return Capacitor.isPluginAvailable("SpeechRecognition") ? "native" : null;
  return webCtor() ? "web" : null;
}

/** 듣기 시작. 돌려준 함수로 멈춘다(멈춰도 onEnd가 온다) */
export async function startVoice(kind: VoiceKind, h: VoiceHandlers): Promise<() => void> {
  return kind === "native" ? startNative(h) : startWeb(h);
}

function startWeb(h: VoiceHandlers): () => void {
  const Ctor = webCtor();
  if (!Ctor) {
    h.onError("failed");
    h.onEnd();
    return () => {};
  }
  const r = new Ctor();
  r.lang = LANG;
  r.interimResults = true;
  // 질문 하나: 말을 멈추면 끝낸다
  r.continuous = false;
  r.onresult = (e) => {
    let text = "";
    for (let i = 0; i < e.results.length; i++) text += e.results[i]![0]?.transcript ?? "";
    h.onText(text);
  };
  r.onerror = (e) => {
    // 말이 없었거나 우리가 멈춘 건 오류로 보이지 않는다
    if (e.error === "no-speech" || e.error === "aborted") return;
    h.onError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied" : "failed");
  };
  r.onend = h.onEnd;
  try {
    r.start();
  } catch {
    h.onError("failed");
    h.onEnd();
  }
  return () => r.stop();
}

async function startNative(h: VoiceHandlers): Promise<() => void> {
  let ended = false;
  const handles: { remove: () => Promise<void> }[] = [];
  const end = () => {
    if (ended) return;
    ended = true;
    handles.forEach((x) => void x.remove());
    h.onEnd();
  };
  try {
    const perm = await SpeechRecognition.requestPermissions();
    if (perm.speechRecognition !== "granted") {
      h.onError("denied");
      end();
      return () => {};
    }
    handles.push(
      await SpeechRecognition.addListener("partialResults", (e) => {
        const text = e.accumulatedText ?? e.matches?.[0];
        if (text) h.onText(text);
      }),
      await SpeechRecognition.addListener("listeningState", (e) => {
        if ((e.state ?? e.status) === "stopped") end();
      }),
    );
    await SpeechRecognition.start({ language: LANG, partialResults: true, popup: false, addPunctuation: true });
  } catch {
    h.onError("failed");
    end();
    return () => {};
  }
  return () => {
    void SpeechRecognition.stop().catch(() => end());
  };
}
