import Link from "next/link";
import { AuthLink } from "@/components/landing/AuthLink";
import { topicsPath } from "@/lib/public-topics";
import { SiteFooter } from "./SiteFooter";

/**
 * 공개 분야 페이지(/topics/…)의 틀. 소개 페이지와 같은 머리·바닥을 쓴다.
 * 로그인 여부에 따른 버튼만 AuthLink가 브라우저에서 바꾸고, 나머지는 정적으로 그린다.
 */
export function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      {/* 2026-11-10 새 화면: 소개 페이지와 같은 '맹고 | 내 관심 뉴스 요약' 머리 */}
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between gap-3 px-5">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 no-underline">
            <span className="text-[22px] font-bold tracking-[-0.035em] text-ink">맹고</span>
            <span aria-hidden="true" className="h-4 w-px bg-line-dark max-[519px]:hidden" />
            <span className="text-[15px] font-medium text-sub max-[519px]:hidden">내 관심 뉴스 요약</span>
          </Link>
          <nav aria-label="공개 메뉴" className="flex items-center gap-1">
            <Link href={topicsPath()} className="inline-flex min-h-11 items-center rounded-full px-3 text-[15px] font-semibold text-sub no-underline hover:bg-snow">
              1분 요약
            </Link>
            <Link href="/#pricing" className="hidden min-h-11 items-center rounded-full px-3 text-[15px] font-semibold text-sub no-underline hover:bg-snow sm:inline-flex">
              요금
            </Link>
            <AuthLink
              signedOut={{ href: "/login", label: "로그인" }}
              signedIn={{ href: "/today", label: "내 브리핑" }}
              className="ml-1 inline-flex min-h-10 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink no-underline hover:bg-snow"
            />
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

/** 페이지 아래 가입 권유. 소개 페이지 맨 아래 띠와 같은 모양 */
export function StartBand({ title, body }: { title: string; body: string }) {
  return (
    <section aria-labelledby="start-title" className="mx-auto max-w-[1100px] px-5 py-16 md:py-20">
      <div className="keep-light flex flex-col items-center gap-6 rounded-3xl bg-mango px-6 py-10 text-center md:flex-row md:px-12 md:text-left">
        <div className="flex-1">
          <h2 id="start-title" className="text-[24px] font-bold leading-snug tracking-[-0.04em] md:text-[30px]">
            {title}
          </h2>
          <p className="mt-2 text-[16px] font-medium text-ink/75">{body}</p>
        </div>
        <AuthLink
          signedOut={{ href: "/login", label: "무료로 시작하기" }}
          signedIn={{ href: "/today", label: "내 브리핑 열기" }}
          className="btn btn-ink min-h-14 shrink-0 px-8 text-[17px]"
        />
      </div>
    </section>
  );
}

/** 구조화 데이터(JSON-LD). '<'를 이스케이프해 글 제목에 든 태그가 스크립트를 닫지 못하게 한다 */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
