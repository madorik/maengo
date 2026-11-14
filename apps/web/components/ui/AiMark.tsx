import { useId } from "react";

/**
 * 맹고 AI 표시. 파랑→보라 반짝이(직접 그린 일반 모양).
 * 2026-11-13 'GPT' 글자 동그라미 → 11-14 OpenAI 매듭 → 같은 날 사용자 '예전 반짝이 쓰자, Powered by GPT처럼 어떤 모델 쓰는지 넣지 말자'로 되돌렸다.
 * 화면·소개 문구에 모델 이름(GPT·제미나이)을 쓰지 않는다. 국외 이전 고지가 필요한 개인정보 처리방침만 OpenAI·Google을 적는다.
 * 글 화면 맹고 AI(버튼·창 머리·답 옆·예상 질문 기다림)에 쓴다
 */
export function AiMark({ className = "size-6" }: { className?: string }) {
  const id = useId();
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
