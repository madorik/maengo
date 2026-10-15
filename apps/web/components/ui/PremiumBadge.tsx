import { Crown } from "@/components/icons";

/**
 * 👑 Premium 표시. Free 계정에서 Premium 기능(듣기·기타 관심사·플레이리스트) 버튼 옆에 붙인다.
 * 글자 없이 왕관 아이콘만 보인다(2026-10-14 사용자 결정). 화면 읽기 프로그램에는 'Premium'으로 읽힌다
 */
export function PremiumBadge({ className = "" }: { className?: string }) {
  return (
    <span title="Premium" className={`inline-flex shrink-0 items-center ${className}`}>
      <Crown className="size-[18px]" />
      <span className="sr-only">Premium</span>
    </span>
  );
}
