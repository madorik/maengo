import { useId } from "react";

/**
 * AI 표시(네 갈래 반짝이, 파랑→보라, 2026-11-11 사용자: 소식 상세의 맹고 AI 아이콘을 제미나이 같은 AI 아이콘으로).
 * 구글 제미나이 로고 파일은 쓰지 않고 직접 그린 일반 반짝이다(다른 회사 상표를 앱 버튼에 그대로 쓰지 않는다: App Store 5.2.1).
 * 글 화면 맹고 AI(버튼·창 머리·답 옆)에 쓴다
 */
export function AiSparkle({ className = "size-6" }: { className?: string }) {
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
