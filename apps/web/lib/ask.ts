// 글 화면의 맹고 AI(2026-11-03). 화면(components/article/AskDock.tsx·AskChat.tsx)과 서버(lib/server/ask.ts)가 같이 쓰는 값.
// 정책은 맹고-문서/소식-물어보기.md

/** 질문 하나의 최대 글자 수 */
export const ASK_TEXT_MAX = 200;

/** 플랜별 하루(KST) 질문 수. 답을 받은 질문만 센다. 무엇이든 물을 수 있어서 이 횟수가 비용을 막는다 */
export const ASK_DAILY: Record<"free" | "plus", number> = { free: 3, plus: 20 };

/** 이어서 묻기 위해 서버에 다시 보내는 앞선 대화 수(질문·답 합쳐서) */
export const ASK_HISTORY_TURNS = 6;

/** 처음에 눌러 바로 물어보는 질문 */
export const ASK_CHIPS = ["더 쉽게 설명해 줘", "왜 중요한 소식이야?", "어려운 용어 풀어 줘"];

export type AskTurn = { role: "user" | "model"; text: string };
