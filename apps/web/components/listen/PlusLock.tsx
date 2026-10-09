import Link from "next/link";
import { Mascot } from "@/components/Mascot";
import { Bubble } from "@/components/ui/Bubble";

/** 무료 플랜에서 듣기 자리. 오디오는 플러스(체험 포함) 전용이다 */
export function PlusLock() {
  return (
    <div className="flex flex-col items-center text-center">
      <Bubble tail="bottom" className="max-w-[340px]">
        <p className="text-[16px] font-bold leading-relaxed">
          플러스에서는 하루 최대 10개를 받고, 선생님·아나운서·대담 말투로 끝까지 이어서 들려 드려요.
        </p>
      </Bubble>
      <Mascot mood="listen" className="mt-4 size-36" />
      <Link href="/settings#plan" className="btn mt-8 min-w-[240px]">
        7일 무료로 들어 보기
      </Link>
    </div>
  );
}
