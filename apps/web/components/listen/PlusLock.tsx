import Link from "next/link";
import { MangoIcon } from "@/components/MangoIcon";

/** Free 플랜에서 듣기 자리. 오디오는 Premium 전용이라 결제 페이지(/premium)로 보낸다 */
export function PlusLock() {
  return (
    <div className="flex flex-col items-center text-center">
      {/* 회색 둥근 상자, 그 아래 맹고 캐릭터가 있던 자리에 새 앱 아이콘 (2026-11-26 사용자: 캐릭터 자리에 새 앱 아이콘) */}
      <div className="max-w-[340px] rounded-2xl bg-snow px-5 py-4">
        <p className="text-[16px] font-bold leading-relaxed">
          Premium에서는 아나운서가 오늘 소식을 끝까지 이어서 읽어 드려요.
        </p>
      </div>
      <MangoIcon className="mt-4 size-36" />
      <Link href="/premium" className="btn mt-8 min-w-[240px]">
        Premium 알아보기
      </Link>
    </div>
  );
}
