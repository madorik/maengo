import { IconDoc, IconExternal, IconPlay } from "@/components/icons";
import type { PublicTopicItem } from "@/lib/server/public-topics";

// 공개 분야·세부 주제 페이지의 소식 한 줄(제목·한 줄 요약·출처·날짜·원문 링크). 다시 쓴 전체 글은 보이지 않는다

export const dayLabel = (iso: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" }).format(new Date(iso));

export function TopicItem({ item: it, label }: { item: PublicTopicItem; /** 여러 분야를 섞어 보일 때 분야 이름 */ label?: string }) {
  const video = it.kind === "video";
  return (
    <li className="tile p-5">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-extrabold">
        {label && <span className="rounded-lg bg-mango-tint px-2 py-0.5 text-mango-deep">{label}</span>}
        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 ${video ? "bg-[#FFE9E6] text-[#B8321F] tone [--tone:#B8321F]" : "bg-sky-tint text-sky-dark"}`}>
          {video ? <IconPlay className="size-3.5" /> : <IconDoc className="size-3.5" />}
          {it.sourceLabel}
        </span>
        <time dateTime={it.date} className="font-semibold text-sub">
          {dayLabel(it.date)}
        </time>
      </p>
      <h3 className="mt-2 text-[18px] font-black leading-snug tracking-[-0.02em]">{it.title}</h3>
      <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-sub">{it.short}</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <a href={it.url} target="_blank" rel="noopener" className="inline-flex min-h-9 items-center gap-1 text-[14px] font-extrabold text-sky-dark no-underline hover:underline">
          {video ? "영상 보기" : "원문 보기"}
          <IconExternal className="size-3.5" />
        </a>
        {it.coverage && <span className="text-[13px] font-bold text-sub">{it.coverage}</span>}
      </p>
    </li>
  );
}
