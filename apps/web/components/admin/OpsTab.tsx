import type { AdminRange } from "@/lib/admin-range";
import type { OpsStats } from "@/lib/admin-stats";
import { db, must } from "@/lib/server/db";
import { Card, Chips, Section } from "./parts";

// 관리자 운영 탭. 숫자는 admin_stats_ops(supabase/migrations/20261022100000_admin_tabs.sql). 작업·기기는 지금 값, 알림 결과는 기간.

const TASK_LABEL: Record<string, string> = { deliveries: "소식 지급·알림", ingest: "수집", summarize: "요약", daily: "하루 정리", trial_reminder: "체험 끝 알림" };
const DELIVERY_LABEL: Record<string, string> = {
  pending: "대기",
  building: "만드는 중",
  ready: "보낼 차례",
  sending: "보내는 중",
  sent: "보냄",
  empty: "소식 없음",
  had: "이미 받음",
  no_device: "기기 없음",
  muted: "알림 꺼짐",
  failed: "실패",
};

const kst = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const when = (iso: string | null) => (iso ? kst.format(new Date(iso)) : "—");

export async function OpsTab({ range }: { range: AdminRange }) {
  const s = must(await db.rpc("admin_stats_ops", { p_from: range.from, p_to: range.to }), "admin_stats_ops") as OpsStats;
  return (
    <Section id="sec-ops" title="운영">
      <Card title="작업·알림">
        <table className="w-full text-left text-[13px]">
          <thead className="text-sub">
            <tr>
              <th className="whitespace-nowrap pb-2 pr-3 font-extrabold">작업</th>
              <th className="whitespace-nowrap pb-2 pr-3 font-extrabold">다음 차례</th>
              <th className="pb-2 font-extrabold">마지막</th>
            </tr>
          </thead>
          <tbody>
            {s.tasks.map((t) => (
              <tr key={t.name} className="border-t-2 border-line align-top">
                <td className="whitespace-nowrap py-2 pr-3 font-bold">
                  {TASK_LABEL[t.name] ?? t.name}
                  <span className="block text-[12px] font-semibold text-faint">{t.everyMinutes >= 1440 ? "하루" : `${t.everyMinutes}분`}마다{t.enabled ? "" : " · 꺼짐"}</span>
                </td>
                <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{t.runningSince ? "도는 중" : when(t.nextRunAt)}</td>
                <td className="py-2">
                  <span className={`font-extrabold ${t.lastStatus === "failed" ? "text-orange" : t.lastStatus === "ok" ? "text-leaf" : "text-faint"}`}>
                    {t.lastStatus === "ok" ? "성공" : t.lastStatus === "failed" ? "실패" : "—"}
                  </span>
                  {t.lastFinishedAt && <span className="ml-1 tabular-nums text-sub">{when(t.lastFinishedAt)}</span>}
                  {t.lastError && <span className="mt-0.5 block line-clamp-2 break-all text-[12px] text-faint">{t.lastError}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[13px] font-extrabold text-sub">알림 결과(기간)</p>
            <Chips data={s.deliveries} labels={DELIVERY_LABEL} />
          </div>
          <div>
            <p className="text-[13px] font-extrabold text-sub">알림 기기(지금)</p>
            <Chips data={s.devices} labels={{ web: "웹", ios: "iOS", android: "Android" }} />
          </div>
        </div>
      </Card>
    </Section>
  );
}
