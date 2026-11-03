// 글 화면의 맹고 AI(2026-11-03). 화면(components/article/AskDock.tsx·AskChat.tsx)과 서버(lib/server/ask.ts)가 같이 쓰는 값.
// 정책은 맹고-문서/소식-물어보기.md

/** 질문 하나의 최대 글자 수 */
export const ASK_TEXT_MAX = 200;

/** 플랜별 하루(KST) 질문 수. 소식과 관계없어 답하지 않은 질문도 센다(Gemini를 부르므로) */
export const ASK_DAILY: Record<"free" | "plus", number> = { free: 3, plus: 20 };

/** 이어서 묻기 위해 서버에 다시 보내는 앞선 대화 수(질문·답 합쳐서) */
export const ASK_HISTORY_TURNS = 6;

/** 소식과 관계없는 질문에 쓰는 정해 둔 답(Gemini가 쓰지 않는다) */
export const OFF_TOPIC_REPLY = "이 소식에 관한 질문에만 답할 수 있어요.";

/** 처음에 눌러 바로 물어보는 질문 */
export const ASK_CHIPS = ["더 쉽게 설명해 줘", "왜 중요한 소식이야?", "어려운 용어 풀어 줘"];

export type AskTurn = { role: "user" | "model"; text: string };
