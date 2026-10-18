import { IconChevronDown } from "@/components/icons";
import type { WalletReason } from "@/lib/server/wallet";

/** 지갑 내역 이름(wallet_ledger.reason) */
const LABEL: Record<WalletReason, string> = {
  signup: "가입 선물",
  purchase: "구매",
  more: "사용",
  refund: "되돌림",
  chargeback: "환불 회수",
  admin: "지급",
};

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * 설정 > 플랜 > 지갑 내역: 지갑 맹고가 들고 난 기록(가입 선물·구매·사용·되돌림·환불 회수), 최근 것부터 서버가 준 만큼(lib/server/wallet.ts walletHistory).
 * 접어 두고 누르면 펼친다(서버에서 그려 자바스크립트 없이 열린다)
 */
export function WalletHistory({ entries }: { entries: { at: string; reason: WalletReason; delta: number }[] }) {
  if (!entries.length) return null;
  return (
    <details className="group mt-2">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-[14px] font-extrabold text-sub hover:text-ink [&::-webkit-details-marker]:hidden">
        지갑 내역
        <IconChevronDown className="size-4 text-faint transition-transform group-open:rotate-180" />
      </summary>
      <ul className="tile max-h-80 divide-y-2 divide-line overflow-y-auto px-4">
        {entries.map((e, i) => (
          <li key={`${e.at}:${i}`} className="flex min-h-12 items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block text-[15px] font-bold">{LABEL[e.reason] ?? e.reason}</span>
              <span className="block text-[13px] font-semibold text-faint tabular-nums">{timeLabel(e.at)}</span>
            </span>
            <span className={`shrink-0 font-round text-[17px] font-black tabular-nums ${e.delta > 0 ? "text-leaf" : "text-sub"}`}>
              {e.delta > 0 ? `+${e.delta.toLocaleString("ko-KR")}` : `−${Math.abs(e.delta).toLocaleString("ko-KR")}`}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
