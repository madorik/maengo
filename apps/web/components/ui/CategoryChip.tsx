import { CATEGORY_LABEL, type CategoryId } from "@maengo/core/categories";
import { SECTION_LABEL, sectionOf } from "@maengo/core/sections";

export function CategoryChip({ category }: { category: CategoryId }) {
  // 2026-11-10 개편: 글 종류(코인·경제·주식…) 대신 분야 8개 이름으로 보인다(오늘·보관함과 같은 이름). 분야가 없는 글(기타)만 글 종류 이름
  const section = sectionOf({ category });
  return (
    <span className="inline-flex shrink-0 items-center rounded-lg bg-snow px-2 py-0.5 text-[13px] font-semibold text-ink">
      <span className="sr-only">분야 </span>
      {section ? SECTION_LABEL[section] : CATEGORY_LABEL[category]}
    </span>
  );
}
