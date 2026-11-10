import Link from "next/link";
import { reportPushTitle } from "@maengo/core/report";
import { IconChevronRight, IconTrendUp } from "@/components/icons";
import { freshReport } from "@/lib/server/report";
import { requireProfile } from "@/lib/server/session";

/** 오늘 화면 맨 위: 아직 안 연 리포트가 나왔으면(이레 안, Premium) 그 리포트로 가는 카드. 리포트를 열면 사라진다 */
export async function ReportBanner() {
  const profile = await requireProfile();
  const r = await freshReport(profile).catch(() => null);
  if (!r) return null;
  return (
    <Link href={`/report?d=${r.start}`} className="tile mb-4 flex items-center gap-3 border-mango bg-mango-tint p-3.5 no-underline hover:brightness-[1.02]">
      <span className="keep-light flex size-11 shrink-0 items-center justify-center rounded-full bg-mango text-ink">
        <IconTrendUp className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold tracking-[-0.02em]">{reportPushTitle(r.period, r.start)}</span>
        {r.headline && <span className="mt-0.5 block truncate text-[14px] font-semibold text-sub">{r.headline}</span>}
      </span>
      <IconChevronRight className="size-5 shrink-0 text-faint" />
    </Link>
  );
}
