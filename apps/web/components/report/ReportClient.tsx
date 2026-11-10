"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ReportPeriod } from "@maengo/core/report";
import { reportSeen } from "@/app/actions";
import { Spinner } from "@/components/ui/Spinner";
import { track } from "@/lib/analytics";
import { withBase } from "@/lib/base-path";

/** 리포트를 열었다: 오늘 화면 안내 카드를 거두고 report_open을 남긴다(리포트마다 한 번) */
export function ReportSeen({ period, start }: { period: ReportPeriod; start: string }) {
  useEffect(() => {
    track("report_open", { kind: period });
    void reportSeen(period, start).catch(() => {});
  }, [period, start]);
  return null;
}

const MAKE_ERRORS: Record<string, string> = {
  blocked: "지금은 요청이 많아 만들 수 없어요. 조금 뒤에 다시 눌러 주세요.",
  not_due: "아직 만들 리포트가 없어요.",
  premium: "Premium에서 받을 수 있어요.",
};

/** 지난 기간 리포트를 지금 만든다(api/report). 다 되면 그 리포트로 옮긴다 */
export function MakeReport({ period, label }: { period: ReportPeriod; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const make = async () => {
    setBusy(true);
    setError("");
    track("report_make", { kind: period });
    try {
      const res = await fetch(withBase("/api/report"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ period }) });
      const out = (await res.json().catch(() => ({}))) as { status?: string; start?: string; error?: string };
      if (!res.ok) {
        setError(MAKE_ERRORS[out.error ?? ""] ?? "만들지 못했어요. 다시 눌러 주세요.");
        setBusy(false);
        return;
      }
      startTransition(() => {
        router.replace(out.start ? `/report?d=${out.start}` : "/report");
        router.refresh();
      });
    } catch {
      setError("만들지 못했어요. 다시 눌러 주세요.");
      setBusy(false);
    }
  };
  return (
    <div>
      <button type="button" onClick={make} disabled={busy} className="btn w-full">
        {busy ? (
          <>
            <Spinner className="size-5" />
            만드는 중
          </>
        ) : (
          label
        )}
      </button>
      <p aria-live="polite" className="mt-2 text-center text-[13px] font-bold text-cherry empty:hidden">
        {error}
      </p>
    </div>
  );
}
