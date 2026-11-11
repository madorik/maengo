import { LibrarySkeleton } from "@/components/ui/Skeletons";

// 보관함으로 옮길 때 바로 보이는 뼈대(2026-11-11 로딩 A안). 다 불러온 화면과 같은 자리에 같은 모양
export default function Loading() {
  return <LibrarySkeleton />;
}
