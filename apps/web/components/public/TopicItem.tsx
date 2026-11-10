import { AuthLink } from "@/components/landing/AuthLink";
import { IconChevronRight, IconDoc, IconExternal, IconPlay } from "@/components/icons";
import type { PublicTopicItem } from "@/lib/server/public-topics";
import { SignupHint } from "./SignupHint";

// 공개 분야·세부 주제·지난 소식 페이지의 소식 카드(제목·한 줄 요약·출처·날짜·원문 링크).
// 카드를 누르면 로그인 전에는 가입(로그인) 화면으로, 로그인했으면 맹고가 다시 쓴 1분 요약 전체 글(/s/<토큰>)이 열린다
// (2026-11-10 사용자: 상세 정보를 누르면 회원가입으로 유도). 원문 링크는 카드 위에 따로 눌리게 둔다

export const dayLabel = (iso: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" }).format(new Date(iso));

export function TopicItem({ item: it, label }: { item: PublicTopicItem; /** 여러 분야를 섞어 보일 때 분야 이름 */ label?: string }) {
  const video = it.kind === "video";
  return (
    <li className="tile relative px-5 pb-3 pt-5 transition-colors hover:border-line-dark">
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
      <h3 className="mt-2 text-[18px] font-black leading-snug tracking-[-0.02em]">
        {/* 카드 전체가 눌리게 제목 링크를 카드 크기로 늘린다 */}
        <AuthLink
          signedOut={{ href: "/login", label: it.title }}
          signedIn={{ href: it.href, label: it.title }}
          className="text-ink no-underline after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] hover:underline"
        />
      </h3>
      {/* 목록에선 요약 한 줄만(2026-11-10 사용자), 전체는 눌러서 */}
      <p className="mt-1.5 line-clamp-1 text-[15px] font-medium leading-relaxed text-sub">{it.short}</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span aria-hidden="true" className="inline-flex min-h-9 items-center gap-0.5 text-[14px] font-extrabold text-ink">
          <SignupHint />
          <IconChevronRight className="size-4" />
        </span>
        <a href={it.url} target="_blank" rel="noopener" className="relative z-10 inline-flex min-h-9 items-center gap-1 text-[14px] font-extrabold text-sky-dark no-underline hover:underline">
          {video ? "영상 보기" : "원문 보기"}
          <IconExternal className="size-3.5" />
        </a>
        {it.coverage && <span className="text-[13px] font-bold text-sub">{it.coverage}</span>}
      </p>
    </li>
  );
}
