import { closeInquiryAction } from "@/app/admin/inquiry-actions";
import type { AdminRange } from "@/lib/admin-range";
import { categoryLabel, STATUS_LABEL } from "@/lib/inquiry";
import { inquiryList, type InquiryView } from "@/lib/server/inquiry";
import { InquiryReplyForm } from "./InquiryReplyForm";
import { Note, Section } from "./parts";

// 관리자 문의 탭(?tab=inquiries): 문의하기(/contact)로 받은 문의. 답장 대기는 기간과 상관없이 모두 펼쳐서, 그 밖엔 기간 안에 받은 것을 접어서.
// 펼치면 내용·회원 정보·답장 기록·답장 칸(AI 초안이 미리 채워져 보내기만 누르면 된다). 맹고-문서/문의하기.md

const kst = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const when = (iso: string) => kst.format(new Date(iso));

const STATUS_STYLE: Record<InquiryView["status"], string> = {
  open: "bg-orange text-white",
  replied: "bg-leaf-tint text-leaf-dark dark:text-leaf-bright",
  closed: "bg-snow text-sub",
};

function Item({ q }: { q: InquiryView }) {
  const first = q.body.split("\n").find((l) => l.trim()) ?? "";
  // 방금(10분 안) 답장한 문의도 펼쳐 둔다(답장이 갔는지 바로 보이게)
  const open = q.status === "open" || q.justReplied;
  const sent = q.replies.filter((r) => r.mailStatus === "sent").length;
  return (
    <details open={open} className="group border-t-2 border-line first:border-t-0">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 py-3 text-[13px] [&::-webkit-details-marker]:hidden">
        <span className={`rounded-full px-2 py-0.5 font-extrabold ${STATUS_STYLE[q.status]}`}>{STATUS_LABEL[q.status]}</span>
        <span className="font-extrabold text-sub">{categoryLabel(q.category)}</span>
        <span className="min-w-0 flex-1 truncate font-bold">{first}</span>
        <span className="tabular-nums text-faint">
          #{q.id} · {when(q.createdAt)}
        </span>
      </summary>
      <div className="pb-4">
        <p className="text-[12px] font-semibold text-sub">
          {q.member ? `회원 ${q.member}` : "비회원"} · 답장 주소 <span className="break-all font-bold text-ink">{q.replyTo}</span>
          {q.mailStatus !== "sent" && <span className="ml-1 font-extrabold text-orange">· 운영자 메일 못 감</span>}
        </p>
        <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-snow px-3 py-2.5 text-[14px] font-medium leading-relaxed">{q.body}</p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
          {Object.entries(q.meta).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-extrabold text-faint">{k}</dt>
              <dd className="break-all font-semibold text-sub">{v}</dd>
            </div>
          ))}
        </dl>
        {/* AI가 초안 전에 확인한 회원 기록(결제 다시 읽기·플랜·지갑·결제별 환불 판정·알림). 주문 번호는 여기에만 */}
        {q.aiFacts.length > 0 && (
          <details className="mt-3 rounded-xl border-2 border-line px-3 py-2" open={q.status === "open"}>
            <summary className="cursor-pointer text-[12px] font-extrabold text-sub">AI가 확인한 기록</summary>
            <ul className="mt-2 flex flex-col gap-1 text-[12px] font-semibold leading-relaxed text-ink">
              {q.aiFacts.map((f, i) => (
                <li key={i} className="break-words">
                  {f.text}
                  {f.extra && <span className="block break-all font-bold text-sub">{f.extra}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
        {q.replies.length > 0 && (
          <ol className="mt-3 flex flex-col gap-2">
            {q.replies.map((r) => (
              <li key={r.id} className="rounded-xl border-2 border-line px-3 py-2">
                <p className="text-[12px] font-extrabold text-sub">
                  운영자 답장 · {when(r.createdAt)}
                  {r.mailStatus === "failed" && <span className="ml-1 text-cherry">· 못 보냄</span>}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-[14px] font-medium leading-relaxed">{r.body}</p>
              </li>
            ))}
          </ol>
        )}
        <InquiryReplyForm key={`${sent}:${q.aiDraftAt ?? ""}`} id={q.id} to={q.replyTo} draft={q.aiDraft} check={q.aiCheck} />
        <form action={closeInquiryAction} className="mt-2">
          <input type="hidden" name="id" value={q.id} />
          {q.status === "closed" ? (
            <button name="reopen" value="1" className="min-h-10 text-[13px] font-bold text-sub underline">
              다시 열기
            </button>
          ) : q.status === "open" ? (
            <button className="min-h-10 text-[13px] font-bold text-sub underline">답장 없이 닫기</button>
          ) : null}
        </form>
      </div>
    </details>
  );
}

export async function InquiriesCard({ range }: { range: AdminRange }) {
  const list = await inquiryList(range);
  const open = list.filter((q) => q.status === "open").length;
  return (
    <Section id="sec-inquiries" title={`문의${open ? ` · 답장 대기 ${open}` : ""}`}>
      <div className="tile px-4 py-1">
        {list.length ? list.map((q) => <Item key={q.id} q={q} />) : <p className="py-4 text-[14px] font-semibold text-sub">이 기간에 받은 문의가 없어요.</p>}
      </div>
      <Note>답장 대기는 기간과 상관없이 모두, 그 밖엔 기간 안에 받은 문의 50개까지. 답장은 회원이 적은 주소로 가고, 회원이 다시 답장하면 운영자 메일로 와요.</Note>
    </Section>
  );
}
