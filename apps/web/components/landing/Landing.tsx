import { archiveLabel, discountPct, SIGNUP_BONUS, type PlanLimits } from "@maengo/core/plans";
import Image from "next/image";
import Link from "next/link";
import { Crown, IconCheck, IconCode, IconDoc, IconExternal, IconGlobe } from "@/components/icons";
import { MangoIcon } from "@/components/MangoIcon";
import { Mascot } from "@/components/Mascot";
import { JsonLd } from "@/components/public/PublicPage";
import { SiteFooter } from "@/components/public/SiteFooter";
import { TopicGroupIcon } from "@/components/TopicGroupIcon";
import { Bubble } from "@/components/ui/Bubble";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { detailsLine, NEWS_SECTION_NAMES, PUBLIC_TOPICS, topicsPath } from "@/lib/public-topics";
import { SITE_DEFINITION, SITE_DESCRIPTION, SITE_NAME, SITE_NAME_EN, SUPPORT_EMAIL, appUrl, organizationId, organizationJsonLd } from "@/lib/site";
import { getPlans, monthlyPrice } from "@/lib/server/plans";
import { AuthLink } from "./AuthLink";
import { PromoVideo } from "./PromoVideo";
import playlistScriptShot from "./playlist-script.webp";
import playlistShot from "./playlist.webp";

// 소개(메인) 페이지. 로그인 전에 맹고가 무엇인지 보여 준다. 그림 대신 실제 화면 조각을 그대로 쓴다.
// 검색과 속도를 위해 정적으로 만들고, 로그인 여부에 따라 달라지는 버튼만 AuthLink가 브라우저에서 바꾼다.

const START = { href: "/login", label: "무료로 시작하기" };
const OPEN = { href: "/today", label: "오늘의 소식 열기" };

/**
 * 자주 묻는 질문. 플랜 숫자는 plans 표 값. 검색·AI 답변이 그대로 옮겨 가도 맞도록 답의 첫 문장에 결론을 쓴다.
 * 분야 이름은 토픽 사전(PUBLIC_TOPICS·NEWS_SECTION_NAMES)에서 읽는다
 */
const faq = (free: PlanLimits, plus: PlanLimits): [string, string][] => [
  ["맹고는 어떤 앱인가요?", `${SITE_DEFINITION} AI, 주식, 코인처럼 관심 있는 분야를 고르면 매일 아침 그 분야 소식만 골라 출처와 함께 요약해요. 웹에서 바로 쓰고, Android·iPhone 앱은 지금 테스트 중이에요.`],
  [
    "고를 수 있는 관심 분야는 뭐예요?",
    `관심 분야 ${PUBLIC_TOPICS.length}개(${PUBLIC_TOPICS.map((t) => t.name).join(", ")})와 뉴스 분야 ${NEWS_SECTION_NAMES.length}개(${NEWS_SECTION_NAMES.join(", ")})에서 골라요. AI 안의 바이브코딩, 주식 안의 미국 주식처럼 세부 관심사를 고르면 더 좁혀 받고, 목록에 없는 관심사는 Premium에서 직접 적을 수 있어요.`,
  ],
  ["어떤 소식을 모아요?", "테크 소식은 공식 기술 문서와 국내 대기업 테크 블로그, AI·코인·반도체 전문 매체에서 모으고, 정치·경제·사회·생활/문화·IT/과학·세계 뉴스는 네이버 뉴스 헤드라인에 오른 기사에서 골라요. 여러 곳에서 같은 소식을 다루면 하나로 묶고, 모든 소식에 원문 출처를 붙여요."],
  ["소식은 언제 와요?", "매일 아침 6시에 새 소식을 모아 요약하고, 설정에서 고른 시각에 오늘의 소식이 도착해요. 알림을 켜 두면 그 시각에 알려 드려요."],
  [
    "음성으로 들을 수 있나요?",
    "네, Premium에서 요약을 음성으로 들어요. 플레이리스트에 담아 전체 듣기를 누르면 끝까지 이어서 읽어 주고, 목소리는 여성·남성 중에 골라요. 앱에서는 화면을 꺼도 계속 들려요.",
  ],
  ["개발자가 아니어도 쓸 수 있나요?", "네. 직업은 묻지 않아요. 주식, 코인, 정치, 세계 뉴스처럼 관심 있는 분야만 고르면 그 분야 소식만 골라 드려요."],
  ["원문은 어디서 읽어요?", "모든 소식에 원문 링크가 있어요. 맹고는 요약과 다시 쓴 전체 글을 보여 주고, 원문은 출처에서 읽을 수 있어요."],
  ["무료로 얼마나 쓸 수 있나요?", `가입하면 Free 플랜으로 하루 소식 ${free.dailyItems}개를 받고, 가입 선물로 ${SIGNUP_BONUS}맹고를 드려요. 음성 듣기와 하루 소식 ${plus.dailyItems}개는 Premium(${monthlyPrice(plus)}${discountPct(plus) > 0 ? `, 정가 ${plus.listPriceKrw!.toLocaleString("ko-KR")}원에서 ${discountPct(plus)}% 할인` : ""})에서 쓸 수 있고, 맹고 앱에서 결제해요.`],
  ["Premium은 언제든 해지할 수 있나요?", "네. 결제한 스토어(App Store·Google Play)의 구독 관리에서 언제든 해지할 수 있어요. 해지해도 이미 결제한 기간이 끝날 때까지는 Premium으로 써요."],
  ["지갑의 맹고는 뭐예요?", `맹고는 앱 안에서 쓰는 재화예요. 하루 소식(Free ${free.dailyItems}개, Premium ${plus.dailyItems}개)보다 더 받고 싶을 때 1맹고로 소식을 하나 더 받아요. 가입 선물(${SIGNUP_BONUS}맹고)과 추가 구매한 맹고는 지갑에 들어가 사라지지 않아요. ${free.canBuyMaengo ? "맹고는 맹고 앱에서 더 살 수 있어요." : "맹고 추가 구매는 Premium에서 할 수 있어요."}`],
];

/** 출처 예시(소개용). 테크는 공식 문서·기업 테크 블로그, 뉴스는 네이버 헤드라인에서 고른다 */
const SOURCES = [
  { kind: "공식 기술 문서", title: "PostgreSQL 19, 11월 출시로 연기", Icon: IconDoc },
  { kind: "기업 테크 블로그", title: "주문 시스템을 이벤트 기반으로 바꾼 이야기", Icon: IconCode },
  { kind: "네이버 뉴스 헤드라인", title: "반도체 수출, 석 달 연속 늘어", Icon: IconGlobe },
];

export async function Landing() {
  const plans = await getPlans();
  const free = plans.get("free")!;
  const plus = plans.get("plus")!;
  const FAQ = faq(free, plus);
  return (
    <div className="min-h-dvh bg-paper">
      <LandingJsonLd faq={FAQ} premiumKrw={plus.priceKrw} />
      <header className="sticky top-0 z-20 border-b-2 border-line bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between gap-3 px-5">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <MangoIcon className="size-9" />
            <span className="text-[26px] font-black tracking-[-0.04em] text-mango-deep">맹고</span>
          </Link>
          <nav aria-label="소개 메뉴" className="flex items-center gap-1">
            <a href="#features" className="hidden min-h-11 items-center rounded-xl px-3 text-[15px] font-extrabold text-sub no-underline hover:bg-snow sm:inline-flex">
              무엇을 해 주나요
            </a>
            <Link href={topicsPath()} className="hidden min-h-11 items-center rounded-xl px-3 text-[15px] font-extrabold text-sub no-underline hover:bg-snow sm:inline-flex">
              관심 분야
            </Link>
            {/* 요금은 휴대폰에서도 보인다(기능은 넓은 화면에서만) */}
            <a href="#pricing" className="inline-flex min-h-11 items-center rounded-xl px-3 text-[15px] font-extrabold text-sub no-underline hover:bg-snow">
              요금
            </a>
            <AuthLink signedOut={{ href: "/login", label: "로그인" }} signedIn={{ href: "/today", label: "오늘의 소식" }} className="btn btn-ghost ml-1 min-h-11 px-4 text-[14px]" />
          </nav>
        </div>
      </header>

      <main>
        {/* 첫 화면: 말은 오른쪽, 소개 영상(소리 없음)은 왼쪽(모바일은 말이 먼저). 영상 배경이 페이지 색과 같아 상자 없이 놓인다 */}
        <section aria-labelledby="hero-title" className="mx-auto grid max-w-[1100px] items-start gap-12 px-5 pb-16 pt-10 md:grid-cols-2 md:gap-16 md:pb-24 md:pt-20">
          <div className="md:order-2">
            <h1 id="hero-title" className="text-[36px] font-black leading-[1.2] tracking-[-0.045em] md:text-[54px]">
              쏟아지는 소식,
              <br />
              내 관심 분야만.
            </h1>
            <p className="mt-5 max-w-[470px] text-[17px] font-medium leading-relaxed text-sub md:text-[19px]">
              {SITE_DEFINITION} AI, 주식, 반도체처럼 고른 분야의 소식만 매일 모아 출처와 함께 핵심만 짚고, 출퇴근길엔 플레이리스트로 이어서 들려 드려요.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <AuthLink signedOut={START} signedIn={OPEN} className="btn min-h-14 px-8 text-[17px]" />
              <AuthLink signedOut={{ href: "/login", label: "이미 계정이 있어요" }} signedIn={null} className="btn btn-ghost min-h-14 px-6 text-[16px]" />
            </div>
          </div>

          <div className="mx-auto w-full max-w-[420px] md:order-1">
            <PromoVideo />
          </div>
        </section>

        <section id="features" aria-label="맹고가 해 주는 일" className="scroll-mt-20 border-y-2 border-line bg-snow">
          <div className="mx-auto flex max-w-[1100px] flex-col gap-20 px-5 py-16 md:gap-28 md:py-24">
            <Feature
              title="관심 있는 분야만, 매일 받아요"
              body="요즘은 하루에도 너무 많은 정보가 쏟아져요. AI, 주식, 코인, 반도체처럼 관심 있는 분야만 고르면 그 분야 소식만 매일 골라 드려요. 목록에 없는 관심사는 Premium에서 직접 적을 수 있고, 여러 곳에서 다룬 같은 소식은 하나로 묶어요."
            >
              <div className="tile p-5">
                <p className="text-[14px] font-black text-sub">내 관심사</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {["바이브코딩", "AI 에이전트", "코스피", "비트코인", "정치"].map((t) => (
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
              title="모든 소식엔 출처가 있어요"
              body="테크 소식은 공식 기술 문서와 국내 대기업 테크 블로그를 인용하고, 뉴스는 네이버 뉴스 헤드라인에 오른 기사에서 골라요. 소식마다 원문 링크가 붙어 있어 더 궁금하면 바로 확인할 수 있어요."
            >
              <div className="tile p-5">
                <p className="text-[14px] font-black text-sub">소식마다 붙는 출처</p>
                <ul className="mt-3 flex flex-col gap-3">
                  {SOURCES.map(({ kind, title, Icon }) => (
                    <li key={kind} className="rounded-2xl border-2 border-line bg-paper p-4">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-sky-tint px-2 py-0.5 text-[13px] font-extrabold text-sky-dark">
                        <Icon className="size-3.5" />
                        {kind}
                      </span>
                      <p className="mt-2 text-[16px] font-black leading-snug">{title}</p>
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-extrabold text-sky-dark">
                        원문 보기
                        <IconExternal className="size-3.5" />
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </Feature>

            <Feature
              title="다 읽지 않아도, 핵심만 요약해요"
              body="긴 글을 끝까지 읽을 필요 없어요. AI가 핵심 내용만 짧게 요약하고, 이 소식이 내 관심 분야에서 왜 중요한지도 한 줄로 짚어 드려요. 같은 소식이라도 어떤 관심사로 골랐는지에 따라 다르게 설명해요."
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
              flip
              title="출퇴근길엔 플레이리스트로 들어요"
              body="듣고 싶은 소식을 플레이리스트에 담고 전체 듣기를 누르면 끝까지 이어서 읽어 드려요. 듣는 동안 대본에서 지금 읽는 문장을 짚어 주고, 앱에서는 화면을 꺼도 계속 들려요. 목소리는 여성·남성 중에 골라요."
            >
              {/* 실제 화면(앱): 플레이리스트와, 전체 듣기를 누르면 열리는 재생·대본 창 */}
              <div className="flex items-start justify-center gap-3 sm:gap-4">
                {[playlistShot, playlistScriptShot].map((shot, i) => (
                  <div key={i} className={`w-1/2 max-w-[220px] rounded-[34px] bg-[#1F2340] p-2 shadow-[0_18px_44px_rgb(31_35_64/0.22)] ${i === 1 ? "mt-10" : ""}`}>
                    <Image src={shot} alt="" sizes="220px" className="h-auto w-full rounded-[27px]" />
                  </div>
                ))}
              </div>
            </Feature>

            <Feature
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
              ["관심사를 골라요", "목록에서 고르면 돼요. 목록에 없는 관심사는 Premium에서 직접 적을 수 있어요."],
              ["새벽에 AI가 훑고 골라요", "매일 새벽 소식을 모아 같은 소식은 묶고, 요약하고, 나에게 맞는 순서로 골라요."],
              ["받아서 읽고 들어요", "고른 시각에 오늘의 소식이 도착해요. 읽어도 되고, 이어서 들어도 돼요."],
            ].map(([title, body], i) => (
              <li key={title} className="tile flex flex-col gap-3 p-6">
                <span className="flex size-11 items-center justify-center keep-light rounded-full bg-mango font-round text-[20px] font-black text-ink shadow-[0_3px_0_var(--color-mango-dark)]">
                  {i + 1}
                </span>
                <span className="text-[19px] font-black">{title}</span>
                <span className="text-[15px] font-medium leading-relaxed text-sub">{body}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* 고를 수 있는 관심 분야. 분야마다 이번 주 소식을 보여 주는 공개 페이지로 잇는다 */}
        <section id="topics" aria-labelledby="topics-title" className="mx-auto max-w-[1100px] scroll-mt-20 px-5 pb-16 md:pb-24">
          <h2 id="topics-title" className="text-center text-[28px] font-black tracking-[-0.03em] md:text-[36px]">
            고를 수 있는 관심 분야
          </h2>
          <p className="mt-3 text-center text-[16px] font-medium text-sub">분야를 누르면 이번 주에 맹고가 고른 소식을 볼 수 있어요.</p>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PUBLIC_TOPICS.map((t) => (
              <li key={t.slug}>
                <Link href={topicsPath(t.slug)} className="tile flex h-full items-center gap-3 p-4 no-underline hover:border-line-dark">
                  <TopicGroupIcon id={t.id} className="size-11 rounded-2xl" iconClassName="size-6" />
                  <span className="min-w-0">
                    <span className="block text-[17px] font-black">{t.name}</span>
                    <span className="block truncate text-[14px] font-semibold text-sub">{detailsLine(t, 3)}</span>
                  </span>
                </Link>
              </li>
            ))}
            <li className="tile flex items-center gap-3 p-4">
              <TopicGroupIcon id="politics" className="size-11 rounded-2xl" iconClassName="size-6" />
              <span className="min-w-0">
                <span className="block text-[17px] font-black">뉴스 분야</span>
                <span className="block text-[14px] font-semibold text-sub">{NEWS_SECTION_NAMES.join(", ")}</span>
              </span>
            </li>
          </ul>
        </section>

        <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 border-y-2 border-line bg-snow">
          <div className="mx-auto max-w-[880px] px-5 py-16 md:py-24">
            <h2 id="pricing-title" className="text-center text-[28px] font-black tracking-[-0.03em] md:text-[36px]">
              요금
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <Plan
                name="Free"
                price="0원"
                items={[`하루 소식 ${free.dailyItems}개`, free.canBuyMaengo ? `가입하면 ${SIGNUP_BONUS}맹고, 맹고 추가 구매` : `가입하면 ${SIGNUP_BONUS}맹고`, `보관함 최근 ${archiveLabel(free.archiveDays)}, 관심사 ${free.topicLimit}개`]}
                cta={{ signedOut: START, signedIn: OPEN, ghost: true }}
              />
              <Plan
                featured
                name="Premium"
                price={monthlyPrice(plus)}
                listPrice={discountPct(plus) > 0 ? `${plus.listPriceKrw!.toLocaleString("ko-KR")}원` : undefined}
                discount={discountPct(plus)}
                items={[`하루 소식 ${plus.dailyItems}개`, "오디오로 이어 듣기, 여성·남성 목소리", `${plus.canBuyMaengo && !free.canBuyMaengo ? "맹고 추가 구매, " : ""}목록에 없는 관심사 ${plus.customLimit}개`, `보관함 전체, 관심사 ${plus.topicLimit}개`]}
                // 로그인 전 버튼: 할인 중이면 '할인가로 시작하기'(2026-10-22 사용자 결정), 아니면 다른 시작 버튼과 같게
                cta={{ signedOut: discountPct(plus) > 0 ? { ...START, label: "할인가로 시작하기" } : START, signedIn: { href: "/premium", label: "Premium 알아보기" } }}
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
          {/* 질문 목록에 없는 건 메일로 */}
          {SUPPORT_EMAIL && (
            <div className="tile mt-6 flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:justify-between sm:text-left">
              <div className="min-w-0">
                <p className="text-[17px] font-black">더 궁금한 게 있나요?</p>
                <p className="mt-1 break-all text-[14px] font-semibold text-sub">{SUPPORT_EMAIL}</p>
              </div>
              <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("[맹고 문의]")}`} className="btn btn-ghost min-h-12 shrink-0 px-6 text-[15px]">
                문의하기
              </a>
            </div>
          )}
        </section>

        <section aria-labelledby="cta-title" className="mx-auto max-w-[1100px] px-5 py-16 md:py-24">
          <div className="keep-light flex flex-col items-center gap-6 rounded-3xl bg-mango px-6 py-12 text-center shadow-[0_6px_0_var(--color-mango-dark)] md:flex-row md:px-14 md:text-left">
            <Mascot mood="listen" className="size-28 shrink-0 md:size-36" />
            <div className="flex-1">
              <h2 id="cta-title" className="text-[26px] font-black leading-snug tracking-[-0.03em] md:text-[34px]">
                오늘부터 받아 보세요
              </h2>
              <p className="mt-2 text-[16px] font-semibold text-ink/75">관심사만 고르면 첫 소식을 바로 보여 드려요.</p>
            </div>
            <AuthLink signedOut={START} signedIn={OPEN} className="btn btn-ink min-h-14 shrink-0 px-8 text-[17px]" />
          </div>
        </section>
      </main>

      <SiteFooter />
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

function Plan({
  name,
  price,
  listPrice,
  discount = 0,
  items,
  cta,
  badge,
  featured = false,
}: {
  name: string;
  price: string;
  /** 취소선으로 보여 줄 정가(할인할 때만) */
  listPrice?: string;
  discount?: number;
  items: string[];
  cta: { signedOut: { href: string; label: string }; signedIn: { href: string; label: string }; ghost?: boolean };
  badge?: string;
  featured?: boolean;
}) {
  return (
    <div className={`tile flex flex-col p-6 ${featured ? "border-mango" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-[20px] font-black">
          {featured && <Crown className="size-6" />}
          {name}
        </h3>
        {badge && <span className="keep-light rounded-lg bg-mango px-2 py-0.5 text-[12px] font-black">{badge}</span>}
      </div>
      {listPrice && (
        <p className="mt-2 flex items-center gap-2 font-round">
          <del className="text-[16px] font-bold text-faint">{listPrice}</del>
          <span className="rounded-lg bg-orange px-2 py-0.5 text-[12px] font-black text-white">{discount}% 할인</span>
        </p>
      )}
      <p className={`${listPrice ? "mt-0.5" : "mt-2"} flex flex-wrap items-baseline gap-x-2 font-round font-black tracking-[-0.02em]`}>
        <span className="text-[30px]">{price}</span>
      </p>
      <ul className="mt-5 flex flex-1 flex-col gap-2.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-[15px] font-semibold">
            <IconCheck className={`mt-0.5 size-5 [stroke-width:3] ${featured ? "text-mango-deep" : "text-leaf"}`} />
            {it}
          </li>
        ))}
      </ul>
      <AuthLink signedOut={cta.signedOut} signedIn={cta.signedIn} className={`btn mt-6 w-full ${cta.ghost ? "btn-ghost" : ""}`} />
    </div>
  );
}

/** 검색엔진용 구조화 데이터: 운영사, 사이트, 서비스(웹앱과 월 요금), 자주 묻는 질문. 서로 @id로 잇는다 */
function LandingJsonLd({ faq, premiumKrw }: { faq: [string, string][]; premiumKrw: number }) {
  const url = appUrl("/");
  const publisher = { "@id": organizationId() };
  const monthly = (price: number) => ({ "@type": "UnitPriceSpecification", price: String(price), priceCurrency: "KRW", billingDuration: "P1M", unitCode: "MON" });
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [
          organizationJsonLd(),
          { "@type": "WebSite", "@id": `${url}#website`, name: SITE_NAME, alternateName: SITE_NAME_EN, url, inLanguage: "ko-KR", description: SITE_DESCRIPTION, publisher },
          {
            "@type": "WebApplication",
            "@id": `${url}#app`,
            name: SITE_NAME,
            alternateName: SITE_NAME_EN,
            url,
            applicationCategory: "NewsApplication",
            operatingSystem: "Web",
            inLanguage: "ko-KR",
            description: SITE_DESCRIPTION,
            publisher,
            offers: [
              { "@type": "Offer", name: "Free", price: "0", priceCurrency: "KRW" },
              { "@type": "Offer", name: "Premium", price: String(premiumKrw), priceCurrency: "KRW", priceSpecification: monthly(premiumKrw) },
            ],
          },
          {
            "@type": "FAQPage",
            "@id": `${url}#faq`,
            mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
          },
        ],
      }}
    />
  );
}
