import Link from "next/link";
import { Mascot } from "@/components/Mascot";
import { Bubble } from "@/components/ui/Bubble";

/** Free 플랜에서 듣기 자리. 오디오는 Premium 전용이라 결제 페이지(/premium)로 보낸다 */
export function PlusLock() {
  return (
    <div className="flex flex-col items-center text-center">
      <Bubble tail="bottom" className="max-w-[340px]">
        <p className="text-[16px] font-bold leading-relaxed">
          Premium에서는 아나운서가 오늘 소식을 끝까지 이어서 읽어 드려요.
        </p>
      </Bubble>
      <Mascot mood="listen" className="mt-4 size-36" />
      <Link href="/premium" className="btn mt-8 min-w-[240px]">
        Premium 알아보기
      </Link>
    </div>
  );
}
