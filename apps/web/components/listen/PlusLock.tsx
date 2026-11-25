import Link from "next/link";

/** Free 플랜에서 듣기 자리. 오디오는 Premium 전용이라 결제 페이지(/premium)로 보낸다 */
export function PlusLock() {
  return (
    <div className="flex flex-col items-center text-center">
      {/* 캐릭터·말풍선 대신 회색 둥근 상자(2026-11-25 사용자: 캐릭터 빼기) */}
      <div className="max-w-[340px] rounded-2xl bg-snow px-5 py-4">
        <p className="text-[16px] font-bold leading-relaxed">
          Premium에서는 아나운서가 오늘 소식을 끝까지 이어서 읽어 드려요.
        </p>
      </div>
      <Link href="/premium" className="btn mt-8 min-w-[240px]">
        Premium 알아보기
      </Link>
    </div>
  );
}
