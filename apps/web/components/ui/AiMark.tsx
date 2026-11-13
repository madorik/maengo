import { useId } from "react";
import { gptLive } from "@/lib/site";

/**
 * 맹고 AI 표시(2026-11-13 사용자 '질문하는 것도 GPT로 바꾸자, 아이콘도 바꿔'). 남색 동그라미에 흰 'GPT' 글자.
 * 맹고 AI 답·추천 질문을 OpenAI GPT(gpt-6-luna, lib/server/openai.ts)로 만든다는 표시다.
 * OpenAI·ChatGPT 로고 파일이나 그 모양을 따라 그리지 않는다(다른 회사 상표를 앱 버튼에 그대로 쓰지 않는다: App Store 5.2.1).
 * 색은 토큰(--color-ink·--color-paper)이라 어두운 화면에서는 밝은 동그라미에 어두운 글자로 뒤집힌다.
 * 처리방침 시행일(gptLive) 전에는 아직 Gemini가 답하므로 예전 반짝이(파랑→보라, 직접 그린 일반 모양)를 보인다(2026-11-14 배포).
 * 글 화면 맹고 AI(버튼·창 머리·답 옆·예상 질문 기다림)에 쓴다
 */
export function AiMark({ className = "size-6" }: { className?: string }) {
  const id = useId();
  if (!gptLive()) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#4C8DF6" />
            <stop offset="0.55" stopColor="#7B6CF0" />
            <stop offset="1" stopColor="#B36CE0" />
          </linearGradient>
        </defs>
        <path d="M12 2C12.7 7.3 16.7 11.3 22 12C16.7 12.7 12.7 16.7 12 22C11.3 16.7 7.3 12.7 2 12C7.3 11.3 11.3 7.3 12 2Z" fill={`url(#${id})`} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="var(--color-ink)" />
      <text
        x="12"
        y="15.1"
        textAnchor="middle"
        fontSize="8.6"
        fontWeight="800"
        letterSpacing="-0.15"
        fill="var(--color-paper)"
        style={{ fontFamily: "var(--font-round), system-ui, sans-serif" }}
      >
        GPT
      </text>
    </svg>
  );
}
