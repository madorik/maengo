import { CATEGORY_LABEL, type CategoryId } from "@maengo/core/categories";

// 카테고리마다 색 하나. 글자는 진한 톤이라 연한 바탕 위에서도 읽힌다.
const TONE: Record<CategoryId, string> = {
  ai: "bg-[#EFEAFF] text-[#5A3FC0]",
  tech: "bg-sky-tint text-sky-dark",
  design: "bg-[#FFE8F2] text-[#B02A6B]",
  business: "bg-mango-tint text-mango-deep",
  marketing: "bg-[#FFEBDD] text-[#B4500B]",
  career: "bg-leaf-tint text-leaf-dark",
  finance: "bg-[#E2F5F3] text-[#0F6E66]",
  realestate: "bg-[#F3EEE6] text-[#7A5A2E]",
  science: "bg-[#E6EBFF] text-[#3046B5]",
  travel: "bg-[#E0F4FA] text-[#0B6C8A]",
  life: "bg-[#FDECEC] text-[#B23A3A]",
  etc: "bg-snow text-sub",
};

export function CategoryChip({ category }: { category: CategoryId }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-lg px-2 py-0.5 text-[13px] font-extrabold ${TONE[category]}`}>
      <span className="sr-only">카테고리 </span>
      {CATEGORY_LABEL[category]}
    </span>
  );
}
