import type { ComponentType } from "react";
import { IconAtom, IconChip, IconCode, IconCoin, IconGlobe, IconLandmark, IconPalette, IconPencil, IconPeople, IconSparkles, IconTrendUp, IconWon } from "@/components/icons";

// 관심 분야마다 대표 아이콘과 색. 색은 글 카테고리 칩(CategoryChip)과 맞춰 같은 분야가 같은 색으로 보이게 한다.
const LOOK: Record<string, { Icon: ComponentType<{ className?: string }>; tone: string }> = {
  ai: { Icon: IconSparkles, tone: "bg-[#EFEAFF] text-[#5A3FC0]" },
  stock: { Icon: IconTrendUp, tone: "bg-[#E2F5F3] text-[#0F6E66]" },
  coin: { Icon: IconCoin, tone: "bg-[#FFF3D1] text-[#8A5A00]" },
  "chip-robot": { Icon: IconChip, tone: "bg-sky-tint text-sky-dark" },
  dev: { Icon: IconCode, tone: "bg-[#E6EBFF] text-[#3046B5]" },
  // 뉴스 분야(헤드라인)
  politics: { Icon: IconLandmark, tone: "bg-[#EEF0F6] text-[#3B4A6B]" },
  economy: { Icon: IconWon, tone: "bg-[#E2F5F3] text-[#0F6E66]" },
  society: { Icon: IconPeople, tone: "bg-[#E9F0EE] text-[#3E6158]" },
  "life-culture": { Icon: IconPalette, tone: "bg-[#FDECEC] text-[#B23A3A]" },
  "it-science": { Icon: IconAtom, tone: "bg-[#E6EBFF] text-[#3046B5]" },
  world: { Icon: IconGlobe, tone: "bg-[#E8EEF9] text-[#2A4F8F]" },
  etc: { Icon: IconPencil, tone: "bg-snow text-sub" },
};

/** 분야 색(배경 + 글자). 설정의 내 관심사 라벨이 쓴다. 모르는 id는 기타 색 */
export function topicTone(id: string): string {
  return (LOOK[id] ?? LOOK.etc).tone;
}

/** 관심 분야 아이콘(둥근 네모 안). 모르는 id는 기타 모양 */
export function TopicGroupIcon({ id, className = "size-12 rounded-2xl", iconClassName = "size-7" }: { id: string; className?: string; iconClassName?: string }) {
  const { Icon, tone } = LOOK[id] ?? LOOK.etc;
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center ${tone} ${className}`}>
      <Icon className={iconClassName} />
    </span>
  );
}
