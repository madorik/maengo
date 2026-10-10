import type { ComponentType } from "react";
import { IconBowl, IconChip, IconCode, IconCoin, IconLipstick, IconMusic, IconPencil, IconSparkles, IconTrendUp } from "@/components/icons";

// 관심 분야마다 대표 아이콘과 색. 색은 글 카테고리 칩(CategoryChip)과 맞춰 같은 분야가 같은 색으로 보이게 한다.
const LOOK: Record<string, { Icon: ComponentType<{ className?: string }>; tone: string }> = {
  ai: { Icon: IconSparkles, tone: "bg-[#EFEAFF] text-[#5A3FC0]" },
  stock: { Icon: IconTrendUp, tone: "bg-[#E2F5F3] text-[#0F6E66]" },
  coin: { Icon: IconCoin, tone: "bg-[#FFF3D1] text-[#8A5A00]" },
  "chip-robot": { Icon: IconChip, tone: "bg-sky-tint text-sky-dark" },
  dev: { Icon: IconCode, tone: "bg-[#E6EBFF] text-[#3046B5]" },
  kpop: { Icon: IconMusic, tone: "bg-[#F6E8FF] text-[#8A2DB8]" },
  kbeauty: { Icon: IconLipstick, tone: "bg-[#FFE6EE] text-[#B4325E]" },
  kfood: { Icon: IconBowl, tone: "bg-[#F1F4DC] text-[#5E6B12]" },
  etc: { Icon: IconPencil, tone: "bg-snow text-sub" },
};

/** 관심 분야 아이콘(둥근 네모 안). 모르는 id는 기타 모양 */
export function TopicGroupIcon({ id, className = "size-12 rounded-2xl", iconClassName = "size-7" }: { id: string; className?: string; iconClassName?: string }) {
  const { Icon, tone } = LOOK[id] ?? LOOK.etc;
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center ${tone} ${className}`}>
      <Icon className={iconClassName} />
    </span>
  );
}
