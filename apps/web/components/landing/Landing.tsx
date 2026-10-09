import type { CategoryId } from "@maengo/core/categories";
import Link from "next/link";
import { IconCheck, IconDoc, IconPlay, IconSpeaker } from "@/components/icons";
import { MangoIcon } from "@/components/MangoIcon";
import { Mascot } from "@/components/Mascot";
import { Bubble } from "@/components/ui/Bubble";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import { AuthLink } from "./AuthLink";

// 소개(메인) 페이지. 로그인 전에 맹고가 무엇인지 보여 준다. 그림 대신 실제 화면 조각을 그대로 쓴다.
// 검색과 속도를 위해 정적으로 만들고, 로그인 여부에 따라 달라지는 버튼만 AuthLink가 브라우저에서 바꾼다.

const START = { href: "/login", label: "무료로 시작하기" };
const OPEN = { href: "/today", label: "오늘 맹고 열기" };

const FAQ: [string, string][] = [
  ["어떤 소식을 모아요?", "긱뉴스, Hacker News, 공식 블로그, 유튜브 채널, 국내외 기술블로그를 매일 새벽에 모아요. 여러 곳에서 같은 소식을 다루면 하나로 묶어요."],
  ["개발자가 아니어도 쓸 수 있나요?", "네. 직업은 묻지 않아요. 디자인 시스템, 그로스, AI 도구처럼 관심 있는 분야만 고르면 그 분야 소식만 골라 드려요."],
  ["원문은 어디서 읽어요?", "모든 소식에 원문 링크가 있어요. 맹고는 요약과 다시 쓴 전체 글을 보여 주고, 원문은 출처에서 읽을 수 있어요."],
  ["무료로 얼마나 쓸 수 있나요?", "무료는 하루 1개 소식을 글로 읽어요. 플러스는 하루 최대 10개와 오디오 듣기를 쓸 수 있고, 7일 동안 무료로 써 볼 수 있어요."],
];

type Sample = { category: CategoryId; source: string; video?: boolean; title: string; short: string; author: string; date: string; coverage?: string };

const SAMPLES: Sample[] = [
  {
    category: "ai",
    source: "유튜브",
    video: true,
    title: "에이전트 평가, 정답셋 없이 시작하는 법",
    short: "실서비스 로그에서 실패한 대화를 모아 평가셋의 씨앗으로 삼는 흐름을 보여 줍니다.",
    author: "AI 엔지니어링 라이브",
    date: "오늘 오전 6시",
  },
  {
    category: "tech",
    source: "공식 문서",
    title: "안 쓰이는 PostgreSQL 인덱스, 통계 뷰로 찾기",
    short: "스캔 횟수가 0인 인덱스를 골라내고, 지우기 전에 확인할 것들을 정리했어요.",
    author: "PostgreSQL 문서",
    date: "어제 오후 6시",
    coverage: "Hacker News 외 1곳에서도 다뤘어요",
  },
];

export function Landing() {
  return (
    <div className="min-h-dvh bg-white">
      <JsonLd />
      <header className="sticky top-0 z-20 border-b-2 border-line bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between gap-3 px-5">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <MangoIcon className="size-9" />
            <span className="text-[26px] font-black tracking-[-0.04em] text-mango-deep">맹고</span>
          </Link>
          <nav aria-label="소개 메뉴" className="flex items-center gap-1">
            <a href="#features" className="hidden min-h-11 items-center rounded-xl px-3 text-[15px] font-extrabold text-sub no-underline hover:bg-snow sm:inline-flex">
              무엇을 해 주나요
            </a>
            <a href="#pricing" className="hidden min-h-11 items-center rounded-xl px-3 text-[15px] font-extrabold text-sub no-underline hover:bg-snow sm:inline-flex">
              요금
            </a>
            <AuthLink signedOut={{ href: "/login", label: "로그인" }} signedIn={{ href: "/today", label: "오늘 맹고" }} className="btn btn-ghost ml-1 min-h-11 px-4 text-[14px]" />
          </nav>
        </div>
      </header>

      <main>
        {/* 첫 화면: 말은 오른쪽, 실제 화면은 왼쪽(모바일은 말이 먼저) */}
        <section aria-labelledby="hero-title" className="mx-auto grid max-w-[1100px] items-center gap-12 px-5 pb-16 pt-10 md:grid-cols-2 md:gap-16 md:pb-24 md:pt-20">
          <div className="md:order-2">
            <h1 id="hero-title" className="text-[36px] font-black leading-[1.2] tracking-[-0.045em] md:text-[54px]">
              검색은 AI가,
              <br />
              당신은 듣기만.
            </h1>
            <p className="mt-5 max-w-[470px] text-[17px] font-medium leading-relaxed text-sub md:text-[19px]">
              관심 있는 분야만 알려 주세요. 매일 아침 긱뉴스, 공식 블로그, 유튜브, 기술블로그를 AI가 훑어서 그 분야의 놓치면 안 되는 기술 뉴스만 골라 요약해 읽어 드리고 들려 드려요.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <AuthLink signedOut={START} signedIn={OPEN} className="btn min-h-14 px-8 text-[17px]" />
              <AuthLink signedOut={{ href: "/login", label: "이미 계정이 있어요" }} signedIn={null} className="btn btn-ghost min-h-14 px-6 text-[16px]" />
            </div>
            <p className="mt-4 text-[13px] font-semibold text-sub">무료는 하루 1개, 플러스는 하루 최대 10개. 플러스는 7일 동안 무료로 써 볼 수 있어요.</p>
          </div>

          <div aria-hidden="true" className="mx-auto w-full max-w-[460px] md:order-1">
            <div className="flex items-end gap-2">
              <Mascot mood="cheer" className="pop size-28 shrink-0 md:size-32" />
              <Bubble className="rise mb-8 flex-1">
                <p className="text-[15px] font-extrabold">오늘 놓치면 안 되는 소식, 골라 뒀어요!</p>
              </Bubble>
            </div>
            <div className="mt-2 flex flex-col gap-3">
              {SAMPLES.map((s, i) => (
                <SampleCard key={s.title} sample={s} className={i === 0 ? "-rotate-1" : "ml-5 rotate-1"} />
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <ListenPill />
            </div>
          </div>
        </section>

        <section id="features" aria-label="맹고가 해 주는 일" className="scroll-mt-20 border-y-2 border-line bg-snow">
          <div className="mx-auto flex max-w-[1100px] flex-col gap-20 px-5 py-16 md:gap-28 md:py-24">
            <Feature
              title="관심사에 맞춰, 같은 소식은 하나로"
              body="LLM, 쿠버네티스, 디자인 시스템처럼 관심 있는 분야만 고르면 돼요. 직업과 상관없이 그 분야 소식만 골라요. 여러 곳에서 같은 소식을 다뤄도 하나로 묶고, AI·테크·디자인처럼 카테고리도 자동으로 붙여요."
            >
              <div className="tile p-5">
                <p className="text-[14px] font-black text-sub">내 토픽</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {["LLM 에이전트", "RAG", "백엔드 성능", "데이터베이스", "쿠버네티스"].map((t) => (
                    <li key={t} className="tile px-3 py-1 text-[14px] font-extrabold">
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t-2 border-line pt-4 text-[13px] font-extrabold">
                  <CategoryChip category="ai" />
                  <span className="inline-flex items-center gap-1 rounded-lg bg-sky-tint px-2 py-0.5 text-sky-dark">
                    <IconDoc className="size-3.5" />
                    공식 문서
                  </span>
                  <span className="font-bold text-sub">긱뉴스 외 2곳에서도 다뤘어요</span>
                </div>
                <p className="mt-2 text-[17px] font-black leading-snug">Gemini API, 유튜브 링크만으로 영상 요약</p>
              </div>
            </Feature>

            <Feature
              flip
              title="왜 중요한지까지 한 줄로"
              body="요약만 던지고 끝내지 않아요. 이 소식이 내 관심 분야에서 왜 중요한지 망고가 한 줄로 짚어 드려요. 같은 소식이라도 어떤 관심사로 골랐는지에 따라 다르게 설명해요."
            >
              <div className="flex items-start gap-2">
                <Mascot className="size-24 shrink-0" />
                <div className="flex flex-1 flex-col gap-3 pt-2">
                  <Bubble>
                    <p className="text-[16px] font-bold leading-relaxed">
                      <span className="text-mango-deep">LLM 에이전트에 관심 있다면, </span>지금 만드는 에이전트의 회귀 테스트에 바로 쓸 수 있어요.
                    </p>
                  </Bubble>
                  <Bubble>
                    <p className="text-[16px] font-bold leading-relaxed">
                      <span className="text-mango-deep">RAG에 관심 있다면, </span>챗봇 답변 품질을 배포할 때마다 확인할 수 있어요.
                    </p>
                  </Bubble>
                </div>
              </div>
            </Feature>

            <Feature
              title="출근길엔 귀로 들어요"
              body="선생님, 아나운서, 대담 말투 중에 골라 오늘 소식을 끝까지 이어서 들어요. 글을 보면서 들으면 지금 읽는 문단을 짚어 줘요. 운전 중이라면 재생 한 번이면 끝까지 넘어가요."
            >
              <div className="tile p-5">
                <div className="flex flex-col gap-3">
                  <ScriptLine who="진행자" text="첫 번째 소식은 뭔가요?" />
                  <ScriptLine who="해설자" right current text="실서비스에서 실패한 대화부터 모아 평가셋을 만드는 방법이에요." />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {["아나운서", "선생님", "대담"].map((p) => (
                    <span key={p} className={`tile py-2 text-center text-[14px] font-extrabold ${p === "대담" ? "border-sky bg-sky-tint text-sky-dark" : ""}`}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </Feature>

            <Feature
              flip
              title="다 보면 끝, 지난 소식은 보관함에"
              body="끝없이 스크롤하게 만들지 않아요. 오늘 분량을 다 보면 오늘은 거기까지예요. 지난 소식은 보관함에 날짜별로 쌓이고, 카테고리로 다시 찾을 수 있어요."
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-end gap-2">
                  <Mascot mood="cheer" className="size-20 shrink-0" />
                  <Bubble className="mb-5 flex-1">
                    <p className="text-[16px] font-bold">오늘은 여기까지예요! 나머지 소식은 몰라도 괜찮아요.</p>
                  </Bubble>
                </div>
                <div className="tile p-4">
                  <p className="text-[14px] font-black text-sub">보관함</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {[
                      ["전체", 24],
                      ["AI", 11],
                      ["테크", 8],
                      ["커리어", 1],
                      ["여행", 1],
                    ].map(([label, n], i) => (
                      <li key={label} className={`tile px-3 py-1 text-[14px] font-extrabold ${i === 0 ? "border-sky bg-sky-tint text-sky-dark" : ""}`}>
                        {label} <span className="font-round text-[13px] text-faint">{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Feature>
          </div>
        </section>

        <section aria-labelledby="how-title" className="mx-auto max-w-[1100px] px-5 py-16 md:py-24">
          <h2 id="how-title" className="text-center text-[28px] font-black tracking-[-0.03em] md:text-[36px]">
            시작은 1분이면 돼요
          </h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              ["관심사를 골라요", "추천 토픽에서 고르거나, 문장으로 적어도 맞는 토픽을 찾아 드려요."],
              ["새벽에 AI가 훑고 골라요", "매일 새벽 소식을 모아 같은 소식은 묶고, 요약하고, 나에게 맞는 순서로 골라요."],
              ["아침에 받아서 읽고 들어요", "고른 시각에 오늘의 맹고가 도착해요. 읽어도 되고, 이어서 들어도 돼요."],
            ].map(([title, body], i) => (
              <li key={title} className="tile flex flex-col gap-3 p-6">
                <span className="flex size-11 items-center justify-center rounded-full bg-mango font-round text-[20px] font-black text-ink shadow-[0_3px_0_var(--color-mango-dark)]">
                  {i + 1}
                </span>
                <span className="text-[19px] font-black">{title}</span>
                <span className="text-[15px] font-medium leading-relaxed text-sub">{body}</span>
              </li>
            ))}
          </ol>
        </section>

        <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 border-y-2 border-line bg-snow">
          <div className="mx-auto max-w-[880px] px-5 py-16 md:py-24">
            <h2 id="pricing-title" className="text-center text-[28px] font-black tracking-[-0.03em] md:text-[36px]">
              요금
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <Plan
                name="무료"
                price="0원"
                items={["하루 1개 소식", "요약, 왜 중요한가, 전체 글", "보관함과 카테고리", "관심 토픽 5개"]}
                cta={{ signedOut: START, signedIn: OPEN, ghost: true }}
              />
              <Plan
                featured
                name="플러스"
                price="월 4,900원"
                badge="7일 무료 체험"
                items={["하루 최대 10개 소식", "오디오로 이어 듣기, 말투 3종", "더 좋은 AI 모델로 요약", "관심 토픽 20개"]}
                later="팟캐스트 앱 연동과 주간 스터디 팩은 곧 열려요"
                cta={{ signedOut: { href: "/login", label: "7일 무료로 써 보기" }, signedIn: { href: "/settings#plan", label: "7일 무료로 써 보기" } }}
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="faq-title" className="mx-auto max-w-[760px] px-5 pt-16 md:pt-24">
          <h2 id="faq-title" className="text-center text-[28px] font-black tracking-[-0.03em] md:text-[36px]">
            자주 묻는 질문
          </h2>
          <div className="mt-8 flex flex-col gap-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="tile group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[17px] font-black">
                  {q}
                  <span aria-hidden="true" className="text-[22px] font-black text-sky transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[15px] font-medium leading-relaxed text-sub">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="cta-title" className="mx-auto max-w-[1100px] px-5 py-16 md:py-24">
          <div className="flex flex-col items-center gap-6 rounded-3xl bg-mango px-6 py-12 text-center shadow-[0_6px_0_var(--color-mango-dark)] md:flex-row md:px-14 md:text-left">
            <Mascot mood="listen" className="size-28 shrink-0 md:size-36" />
            <div className="flex-1">
              <h2 id="cta-title" className="text-[26px] font-black leading-snug tracking-[-0.03em] md:text-[34px]">
                내일 아침부터 받아 보세요
              </h2>
              <p className="mt-2 text-[16px] font-semibold text-ink/75">관심사만 고르면 첫 소식을 바로 보여 드려요.</p>
            </div>
            <AuthLink signedOut={START} signedIn={OPEN} className="btn btn-ink min-h-14 shrink-0 px-8 text-[17px]" />
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-line">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-2 px-5 py-8 text-[13px] font-semibold text-sub sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <MangoIcon className="size-6" />
            관심사에 맞춘 기술 소식, 맹고
          </span>
          <span>© 2026 맹고</span>
        </div>
      </footer>
    </div>
  );
}

function Feature({ title, body, flip = false, children }: { title: string; body: string; flip?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
      <div className={flip ? "md:order-2" : ""}>
        <h2 className="text-[26px] font-black leading-snug tracking-[-0.03em] md:text-[34px]">{title}</h2>
        <p className="mt-4 max-w-[460px] text-[16px] font-medium leading-relaxed text-sub md:text-[17px]">{body}</p>
      </div>
      <div aria-hidden="true" className={`mx-auto w-full max-w-[460px] ${flip ? "md:order-1" : ""}`}>
        {children}
      </div>
    </div>
  );
}

function SampleCard({ sample: s, className = "" }: { sample: Sample; className?: string }) {
  return (
    <div className={`tile bg-white p-4 shadow-[0_8px_20px_rgb(31_35_64/0.06)] ${className}`}>
      <div className="flex items-center gap-2 text-[13px] font-extrabold">
        <CategoryChip category={s.category} />
        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 ${s.video ? "bg-[#FFE9E6] text-[#B8321F]" : "bg-sky-tint text-sky-dark"}`}>
          {s.video ? <IconPlay className="size-3.5" /> : <IconDoc className="size-3.5" />}
          {s.source}
        </span>
        {s.coverage && <span className="hidden truncate font-bold text-sub sm:inline">{s.coverage}</span>}
      </div>
      <p className="mt-2 text-[17px] font-black leading-snug tracking-[-0.02em]">{s.title}</p>
      <p className="mt-1.5 text-[14px] font-medium leading-relaxed text-sub">{s.short}</p>
      <div className="mt-3 flex items-center gap-3">
        <p className="min-w-0 truncate text-[13px]">
          <span className="font-extrabold">{s.author}</span>
          <span className="ml-2 font-semibold text-faint">{s.date}</span>
        </p>
        <span className="tile ml-auto inline-flex min-h-9 shrink-0 items-center gap-1.5 px-3 text-[13px] font-extrabold">
          <IconSpeaker className="size-4 text-sky" />
          듣기
        </span>
      </div>
    </div>
  );
}

function ListenPill() {
  return (
    <div className="tile flex items-center gap-2 rounded-full p-1.5 shadow-[0_8px_24px_rgb(31_35_64/0.16)]">
      <span className="flex size-11 items-center justify-center rounded-full bg-mango-tint">
        <Mascot mood="listen" className="size-9" />
      </span>
      <span className="pr-1">
        <span className="block text-[14px] font-black">오늘 맹고 전체 듣기</span>
        <span className="block text-[12px] font-bold text-sky">10개, 약 11분</span>
      </span>
      <span className="flex size-11 items-center justify-center rounded-full bg-sky text-white shadow-[0_3px_0_var(--color-sky-dark)]">
        <IconPlay className="size-5" />
      </span>
    </div>
  );
}

function ScriptLine({ who, text, right = false, current = false }: { who: string; text: string; right?: boolean; current?: boolean }) {
  return (
    <div className={`flex items-end gap-2 ${right ? "flex-row-reverse" : ""}`}>
      <Mascot mood={right ? "happy" : "listen"} className={`size-11 shrink-0 ${right ? "-scale-x-100" : ""}`} />
      <div className={`flex max-w-[80%] flex-col ${right ? "items-end" : ""}`}>
        <span className="mb-1 px-1 text-[12px] font-extrabold text-sub">{who}</span>
        <span className={`rounded-2xl border-2 px-4 py-2.5 text-[15px] leading-[1.6] ${current ? "border-sky bg-sky-tint font-bold" : "border-line bg-white font-medium text-sub"}`}>{text}</span>
      </div>
    </div>
  );
}

function Plan({
  name,
  price,
  items,
  cta,
  badge,
  later,
  featured = false,
}: {
  name: string;
  price: string;
  items: string[];
  cta: { signedOut: { href: string; label: string }; signedIn: { href: string; label: string }; ghost?: boolean };
  badge?: string;
  later?: string;
  featured?: boolean;
}) {
  return (
    <div className={`tile flex flex-col p-6 ${featured ? "border-mango" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[20px] font-black">{name}</h3>
        {badge && <span className="rounded-lg bg-mango px-2 py-0.5 text-[12px] font-black">{badge}</span>}
      </div>
      <p className="mt-2 font-round text-[30px] font-black tracking-[-0.02em]">{price}</p>
      <ul className="mt-5 flex flex-1 flex-col gap-2.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-[15px] font-semibold">
            <IconCheck className={`mt-0.5 size-5 [stroke-width:3] ${featured ? "text-mango-deep" : "text-leaf"}`} />
            {it}
          </li>
        ))}
      </ul>
      {later && <p className="mt-3 text-[13px] font-semibold text-sub">{later}</p>}
      <AuthLink signedOut={cta.signedOut} signedIn={cta.signedIn} className={`btn mt-6 w-full ${cta.ghost ? "btn-ghost" : ""}`} />
    </div>
  );
}

/** 검색엔진용 구조화 데이터: 사이트, 서비스(웹앱과 요금), 자주 묻는 질문 */
function JsonLd() {
  const url = siteUrl().toString();
  const data = [
    { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url, inLanguage: "ko-KR", description: SITE_DESCRIPTION },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE_NAME,
      url,
      applicationCategory: "NewsApplication",
      operatingSystem: "Web",
      inLanguage: "ko-KR",
      description: SITE_DESCRIPTION,
      offers: [
        { "@type": "Offer", name: "무료", price: "0", priceCurrency: "KRW" },
        { "@type": "Offer", name: "플러스", price: "4900", priceCurrency: "KRW" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
