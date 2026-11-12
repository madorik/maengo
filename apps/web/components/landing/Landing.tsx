import { archiveLabel, discountPct, type PlanLimits } from "@maengo/core/plans";
import { SECTIONS } from "@maengo/core/sections";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { Crown, IconCheck, IconDoc, IconExternal, IconGlobe } from "@/components/icons";
import { Mascot, type MascotMood } from "@/components/Mascot";
import { JsonLd } from "@/components/public/PublicPage";
import { SiteFooter } from "@/components/public/SiteFooter";
import { TopicGroupIcon } from "@/components/TopicGroupIcon";
import { ASK_DAILY } from "@/lib/ask";
import { MORE_MAX, MORE_STEP } from "@/lib/more";
import { detailsLine, PUBLIC_TOPICS, topicsPath } from "@/lib/public-topics";
import {
  APP_OPERATING_SYSTEMS,
  APP_STORE_URL,
  COMPANY_NAME,
  COMPANY_NAME_EN,
  PLAY_STORE_URL,
  SITE_ALT_NAMES,
  SITE_DEFINITION,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_NAME_EN,
  STORE_URLS,
  SUPPORT_EMAIL,
  appUrl,
  organizationId,
  organizationJsonLd,
} from "@/lib/site";
import { getPlans, monthlyPrice } from "@/lib/server/plans";
import { AppQr } from "@/components/app-install/AppQr";
import { AuthLink } from "./AuthLink";
import articleShot from "./app-article.webp";
import foundShot from "./app-found.webp";
import libraryShot from "./app-library.webp";
import listenShot from "./app-listen.webp";
import reportShot from "./app-report.webp";
import todayPmShot from "./app-today-pm.webp";
import todayShot from "./app-today.webp";

// 소개(메인) 페이지. 로그인 전에 맹고가 무엇인지 보여 준다. 그림 대신 실제 앱 화면을 그대로 쓴다.
// 2026-11-10 개편(사용자: '관심사를 선택하는 게 아니고 사용자 관심에 맞게 자동으로 골라 주는 것'): 관심사는 맹고가 찾고 맞춘다,
// 출근길·퇴근길 하루 두 번 브리핑, 주간 리포트(Premium). 예전 소개 영상(예전 화면)·내 관심 링크 소개는 뺐다.
// 2026-11-12 대상 '재테크하는 직장인'(맹고-문서/타겟.md). 핵심(사용자): ① 내 관심 분야 소식 요약 ② 그 소식이 나에게 미칠 영향.
// 분야를 '금리·환율·주식'처럼 나열하지 않고, 주식·부동산·재테크라는 말을 화면에 대놓고 쓰지 않는다('내게 미칠 영향'으로, 2026-11-12 사용자).
// 검색과 속도를 위해 정적으로 만들고, 로그인 여부에 따라 달라지는 버튼만 AuthLink가 브라우저에서 바꾼다.

const START = { href: "/login", label: "무료로 시작하기" };
/** 첫 화면의 큰 버튼(로그인 전). 2026-11-08: 로그인 화면에서 대부분 떠나서 먼저 들어 보게 한다(app/try) */
const TRY = { href: "/try", label: "로그인 없이 들어 보기" };
const OPEN = { href: "/today", label: "내 브리핑 열기" };

/** 분야 8개 이름(맹고가 다루는 분야) */
const SECTION_NAMES = SECTIONS.map((s) => s.label);

/**
 * 요금 카드의 기능 목록(/premium 비교표와 같은 내용). 숫자는 plans 표.
 * 2026-11-10 개편: 하루 소식 → 브리핑마다 소식, 메뉴에서 뺀 내 관심 링크는 빼고 Premium에 주간 리포트
 */
function planItems(l: PlanLimits, askDaily: number): string[] {
  return [
    `출근길·퇴근길 브리핑마다 소식 ${l.dailyItems}개`,
    ...(l.audio ? ["자연스러운 AI 목소리로 음성 듣기(TTS) 무제한"] : l.dailyListens > 0 ? [`음성 듣기(TTS) 하루 ${l.dailyListens}개`] : []),
    `맹고 AI 질문 하루 ${askDaily}번`,
    ...(l.id === "plus" ? ["주간 리포트"] : []),
    l.archiveDays == null ? "받은 소식 무제한 보관" : `받은 소식 ${archiveLabel(l.archiveDays)} 보관`,
  ];
}

/**
 * 자주 묻는 질문. 플랜 숫자는 plans 표 값. 검색·AI 답변이 그대로 옮겨 가도 맞도록 답의 첫 문장에 결론을 쓴다
 */
const faq = (free: PlanLimits, plus: PlanLimits): [string, string][] => [
  // 영문 이름·만든 회사를 같이 적어 '망고'·비슷한 이름의 다른 서비스와 헷갈리지 않게 한다(2026-11-06)
  [
    "맹고는 어떤 앱인가요?",
    `${SITE_DEFINITION} 영문 이름은 ${SITE_NAME_EN}이고, ${COMPANY_NAME}(${COMPANY_NAME_EN})가 만들어요. 읽고 듣던 소식에 맞춰 맹고가 내 관심 분야 소식만 골라 출근길·퇴근길 하루 두 번 출처와 함께 요약하고, 그 소식이 나에게 어떤 영향을 줄지 짚어 읽어 드려요. 웹에서 바로 쓰고, ${
      PLAY_STORE_URL ? "Android·iPhone 앱은 Google Play·App Store에서 받아요." : "iPhone 앱은 App Store에서 받아요. Android 앱은 곧 Google Play에 나와요."
    }`,
  ],
  // 2026-11-12 재테크하는 직장인: 핵심 질문 '그게 나한테 어떤 영향을 주지?'와 투자 권유를 안 한다는 답을 앞에
  [
    "관심 분야 소식이 나한테 어떤 영향인지도 알려 주나요?",
    "네. 오늘의 흐름에서 받은 소식을 하나로 엮고, 맞춤 체크에서 그 소식이 나에게 어떤 영향을 줄지 짚어 드려요. 내 상황을 알려 주면 더 맞춰지고, 없으면 읽고 듣던 소식과 자주 보는 분야를 바탕으로 짚어요. Free에서도 돼요.",
  ],
  ["사거나 팔라는 말도 하나요?", "아니요. 맹고는 투자를 권하지 않아요. 소식이 무슨 뜻인지, 무엇을 확인해 보면 좋은지만 짚고, 모든 소식에 원문 출처를 붙여요."],
  [
    "관심사는 어떻게 정해요?",
    `직접 고르거나 적을 필요가 없어요. 처음에 끌리는 소식 몇 개만 누르면 맹고가 관심 분야를 찾고, 그 뒤로는 읽고 듣고 북마크한 소식과 '덜 받기'를 누른 소식에 맞춰 분야 비중을 계속 맞춰요. 분야는 ${SECTION_NAMES.join(", ")} ${SECTION_NAMES.length}개예요.`,
  ],
  ["어떤 소식을 모아요?", `${SECTION_NAMES.join("·")} 소식을 국내 언론사와 해외 매체, 공식 기술 문서·기업 테크 블로그에서 모아요. 여러 곳에서 같은 소식을 다루면 하나로 묶고, 많이 다룬 소식을 먼저 놓고, 모든 소식에 원문 출처와 사진을 붙여요.`],
  ["해외 소식도 한국어로 받을 수 있나요?", "네. 해외 매체와 공식 블로그의 영어 글도 한국어로 요약해요. 원문 링크가 함께 붙어서 필요하면 바로 원문을 확인할 수 있어요."],
  ["소식은 언제 와요?", "출근길·퇴근길 하루 두 번 와요. 아침과 오후에 새 소식을 모아 요약하고, 정한 시각(처음은 오전 7시·오후 6시, 설정에서 바꿔요)에 브리핑이 도착해요. 알림을 켜 두면 그 시각에 알려 드려요."],
  // 2026-11-12 '더 보기'(lib/more.ts): 맹고 '하나 더 받기'를 대신한다
  ["소식을 더 보고 싶으면요?", `브리핑을 다 받은 뒤 '소식 ${MORE_STEP}개 더 보기'를 누르면 최근 이틀 동안 나온 관심 분야 소식을 더 보여 드려요. 브리핑마다 ${MORE_MAX}개까지, Free도 똑같이 돼요.`],
  [
    "음성으로 들을 수 있나요?",
    // 2026-11-10: 첫 화면이 '귀로 들어요'인데 답이 'Premium에서'로 시작해 Free는 못 듣는 것처럼 읽혔다 → Free가 듣는 몫부터
    free.audio
      ? "네. 브리핑 듣기를 누르면 소식을 끝까지 이어서 읽어 주고, 앱에서는 화면을 꺼도 계속 들려요."
      : free.dailyListens > 0
        ? `네. Free도 하루 ${free.dailyListens}개는 기본 목소리로 들을 수 있고, 브리핑 듣기도 그 안에서 돼요. Premium은 개수 제한 없이, 문장이 자연스럽게 이어지는 AI 목소리(여성·남성 중 선택)로 들어요. 앱에서는 화면을 꺼도 계속 들려요.`
        : "네, Premium에서 요약을 음성으로 들어요. 브리핑 듣기를 누르면 끝까지 이어서 읽어 주고, 목소리는 여성·남성 중에 골라요. 앱에서는 화면을 꺼도 계속 들려요.",
  ],
  ["운전 중이나 손을 쓰기 어려울 때도 들을 수 있나요?", `네. 브리핑 듣기를 누르면 소식을 끝까지 이어서 읽어 주고${free.dailyListens > 0 && !free.audio ? `(Free는 하루 ${free.dailyListens}개까지)` : ""}, 앱에서는 화면을 꺼도 계속 들려요. 운전할 때는 출발 전에 재생을 눌러 두면 화면을 보지 않고 들을 수 있어요.`],
  ["주간 리포트는 뭐예요?", "Premium에서 매주 월요일 아침, 지난주에 받은 소식을 한 줄 총평·분야별 정리·많이 본 분야·놓친 주요 소식으로 모아 드려요."],
  ["원문은 어디서 읽어요?", "모든 소식에 원문 링크가 있어요. 맹고는 요약과 다시 쓴 전체 글을 보여 주고, 원문은 출처에서 읽을 수 있어요."],
  [
    "소식에 대해 더 물어볼 수 있나요?",
    `네. 소식 화면 오른쪽 아래 맹고 AI 버튼을 누르면 궁금한 걸 글이나 말로 물어볼 수 있어요. 읽던 소식을 바탕으로 물은 것부터 바로 답하고, 소식과 관계없는 질문에도 답해요. Free는 하루 ${ASK_DAILY.free}번, Premium은 하루 ${ASK_DAILY.plus}번까지 물어볼 수 있어요.`,
  ],
  ["무료로 얼마나 쓸 수 있나요?", `가입하면 Free 플랜으로 브리핑마다 소식 ${free.dailyItems}개를 받아요.${free.dailyListens > 0 && !free.audio ? ` 음성 듣기도 하루 ${free.dailyListens}개는 무료예요.` : ""} 음성 듣기 무제한${plus.dailyItems > free.dailyItems ? `, 브리핑마다 소식 ${plus.dailyItems}개` : ""}, 주간 리포트는 Premium(${monthlyPrice(plus)}${discountPct(plus) > 0 ? `, 정가 ${plus.listPriceKrw!.toLocaleString("ko-KR")}원에서 ${discountPct(plus)}% 할인` : ""})에서 쓸 수 있고, 맹고 앱에서 결제해요.`],
  ["Premium은 언제든 해지할 수 있나요?", "네. 결제한 스토어(App Store·Google Play)의 구독 관리에서 언제든 해지할 수 있어요. 해지해도 이미 결제한 기간이 끝날 때까지는 Premium으로 써요."],
];

/** 소식 하나를 듣는 데 걸리는 시간(분). 둘러보기 소식 10개 음성이 평균 85초(47~101초, 2026-11-10 확인)라 1.5분으로 어림한다 */
const LISTEN_MIN_PER_ITEM = 1.5;

/** 출처 예시(소개용) */
const SOURCES = [
  { kind: "국내 경제지", title: "반도체 수출, 석 달 연속 늘어", Icon: IconDoc },
  { kind: "해외 매체(영어 → 한국어)", title: "미국 증시 마감, 기술주 강세", Icon: IconGlobe },
  { kind: "국내 언론사", title: "청약 제도, 이렇게 바뀌어요", Icon: IconDoc },
];

/**
 * 맞춤 체크 예시(소개용, 2026-11-12). 실제 소식 내용이 아니라 관심 분야 소식이 재테크에 어떻게 닿는지 보여 주는 일반적인 문장만 쓴다.
 * 사라·팔라는 말은 넣지 않는다(맹고-문서/오늘의-흐름.md)
 */
const CHECKS = [
  { about: "자주 보는 AI 소식", body: "빅테크의 AI 투자 소식은 관련 기업들의 실적 기대로 이어질 수 있어요. 다음 실적 발표의 투자 계획을 확인해 보세요." },
  { about: "자주 보는 반도체 소식", body: "수출이 늘었다는 소식은 반도체 기업의 실적 전망과 함께 볼 만해요." },
  { about: "자주 보는 경제 소식", body: "기준금리 소식은 대출 이자와 예금 금리에 함께 닿아요. 발표 날짜를 확인해 보세요." },
];

/**
 * 화면을 보기 어려운 순간들(2026-10-27 사용자: 손 시린 날·만원 지하철·운전 중). 듣기가 맹고의 핵심이라 기능보다 먼저 보인다.
 * 카드마다 그 순간의 맹고 표정(떨기·찡그림·웃으며 듣기)
 */
const MOMENTS: { title: string; body: string; mood: MascotMood; tint: string }[] = [
  { title: "손 시린 출근길", body: "브리핑 듣기를 한 번 누르고 휴대폰을 주머니에 넣어 두세요. 소식을 끝까지 이어서 읽어 드려요.", mood: "shiver", tint: "bg-mango-tint" },
  { title: "만원 지하철", body: "화면을 들여다볼 틈이 없어도 이어폰만 있으면 돼요. 앱에서는 화면을 꺼도 계속 들려요.", mood: "squeeze", tint: "bg-snow" },
  { title: "운전 중", body: "출발 전에 브리핑 듣기를 눌러 두면 도착할 때까지 화면을 보지 않고 들을 수 있어요.", mood: "listen", tint: "bg-mango-tint" },
];

/** 실제 앱 화면 한 장(휴대폰 틀) */
function Phone({ src, className = "", priority = false }: { src: StaticImageData; className?: string; priority?: boolean }) {
  return (
    <div className={`rounded-[34px] bg-[#1F2340] p-2 shadow-[0_18px_44px_rgb(31_35_64/0.2)] ${className}`}>
      <Image src={src} alt="" sizes="(min-width: 768px) 240px, 45vw" priority={priority} className="h-auto w-full rounded-[27px]" />
    </div>
  );
}

export async function Landing() {
  const plans = await getPlans();
  const free = plans.get("free")!;
  const plus = plans.get("plus")!;
  const FAQ = faq(free, plus);
  const navLink = "inline-flex min-h-11 items-center rounded-full px-2.5 text-[15px] font-semibold text-sub no-underline hover:bg-snow sm:px-3";
  return (
    <div className="min-h-dvh bg-paper">
      <LandingJsonLd faq={FAQ} premiumKrw={plus.priceKrw} />
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between gap-3 px-5">
          {/* 앱 머리말과 같은 '맹고 | 오늘 뉴스 핵심 요약'. 좁은 휴대폰에서는 뒤 문구를 숨겨 메뉴가 한 줄에 들어가게 한다 */}
          <Link href="/" className="flex min-w-0 items-center gap-2.5 no-underline">
            <span className="text-[22px] font-bold tracking-[-0.035em] text-ink">맹고</span>
            <span aria-hidden="true" className="h-4 w-px bg-line-dark max-[519px]:hidden" />
            <span className="text-[15px] font-medium text-sub max-[519px]:hidden">오늘 뉴스 핵심 요약</span>
          </Link>
          <nav aria-label="소개 메뉴" className="flex items-center gap-1 whitespace-nowrap">
            <Link href={topicsPath()} className={navLink}>
              1분 요약
            </Link>
            <a href="#pricing" className={navLink}>
              요금
            </a>
            <Link href="/contact" className={navLink}>
              문의하기
            </Link>
            <AuthLink
              signedOut={{ href: "/login", label: "로그인" }}
              signedIn={{ href: "/today", label: "내 브리핑" }}
              className="ml-1 inline-flex min-h-10 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink no-underline hover:bg-snow"
            />
          </nav>
        </div>
      </header>

      <main>
        {/* 첫 화면: 말은 오른쪽, 실제 앱 화면(출근길·퇴근길 두 장)은 왼쪽(모바일은 말이 먼저) */}
        <section aria-labelledby="hero-title" className="mx-auto grid max-w-[1100px] items-center gap-12 px-5 pb-16 pt-10 md:grid-cols-2 md:gap-16 md:pb-24 md:pt-20">
          <div className="md:order-2">
            {/* 대상: 재테크하는 직장인. 핵심은 관심 분야 요약 + 그 소식이 나에게 미칠 영향(2026-11-12 사용자, 맹고-문서/타겟.md). 360px 휴대폰에서 줄마다 한 줄 */}
            <h1 id="hero-title" className="text-[36px] font-bold leading-[1.22] tracking-[-0.05em] md:text-[54px]">
              내 관심 분야 소식
              <br />
              오늘 뉴스 핵심 요약
            </h1>
            <p className="mt-5 max-w-[470px] text-[17px] font-medium leading-relaxed text-sub md:text-[19px]">
              내가 보는 분야의 소식만 맹고가 골라 핵심만 요약하고, 그 소식이 나한테 어떤 영향을 줄지 짚어 드려요. 출근길·퇴근길 하루 두 번, 브리핑 하나를
              다 들어도 약 {Math.round(plus.dailyItems * LISTEN_MIN_PER_ITEM)}분이에요.
            </p>
            <ul aria-label="맹고가 다른 점" className="mt-5 flex flex-col gap-2 text-[15px] font-semibold md:text-[16px]">
              {[
                "관심 분야 소식만, 핵심만 요약",
                "오늘의 흐름과 맞춤 인사이트까지",
                "출근길·퇴근길 하루 두 번, 다 들으면 끝",
                free.audio ? "누구나 귀로 듣기" : free.dailyListens > 0 ? `Free도 하루 ${free.dailyListens}개는 귀로 듣기` : null,
              ]
                .filter((t): t is string => !!t)
                .map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 size-5 shrink-0 text-mango-deep [stroke-width:3]" />
                    <span>{t}</span>
                  </li>
                ))}
            </ul>
            {/* 로그인 전: 큰 버튼은 둘러보기(이미 만든 음성 소식을 로그인 없이 들어 본다, app/try), 옆은 가입. 로그인 뒤: 내 브리핑 */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <AuthLink signedOut={TRY} signedIn={OPEN} className="btn btn-ink min-h-14 px-8 text-[17px]" />
              <AuthLink signedOut={START} signedIn={null} className="btn btn-ghost min-h-14 px-6 text-[16px]" />
            </div>
            {/* 스토어 링크(앱은 이 페이지 대신 로그인·오늘로 가므로 앱 안에는 안 보인다, proxy.ts).
                PC(넓은 화면)는 QR을 앞에 둔다: 출퇴근길에 쓰는 건 휴대폰이라 찍어서 바로 받게(2026-11-11) */}
            <div className="mt-6 flex items-center gap-4">
              <AppQr spot="landing" size={92} className="hidden lg:block" />
              <div className="min-w-0">
                <p className="hidden text-[15px] font-bold lg:block">휴대폰 카메라로 찍으면 앱을 받아요</p>
                <p className="flex flex-wrap gap-x-5 gap-y-1 lg:mt-1">
                  <StoreLink href={APP_STORE_URL} label="App Store에서 iPhone 앱 받기" />
                  {PLAY_STORE_URL && <StoreLink href={PLAY_STORE_URL} label="Google Play에서 Android 앱 받기" />}
                </p>
              </div>
            </div>
          </div>

          <div aria-hidden="true" className="mx-auto flex w-full max-w-[460px] items-start justify-center gap-3 sm:gap-4 md:order-1">
            <Phone src={todayShot} priority className="w-1/2 max-w-[220px]" />
            <Phone src={todayPmShot} className="mt-12 w-1/2 max-w-[220px]" />
          </div>
        </section>

        <section aria-labelledby="moments-title" className="mx-auto max-w-[1100px] px-5 pb-16 md:pb-24">
          <h2 id="moments-title" className="text-center text-[28px] font-bold tracking-[-0.04em] md:text-[36px]">
            읽을 수 없을 땐, 들으면 돼요
          </h2>
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {MOMENTS.map(({ title, body, mood, tint }) => (
              <li key={title} className="tile flex flex-col gap-4 p-6">
                <div className="flex items-center gap-4">
                  <span className={`keep-light flex size-20 shrink-0 items-center justify-center rounded-3xl ${tint}`}>
                    <Mascot mood={mood} className="size-16" />
                  </span>
                  <span className="text-[20px] font-bold">{title}</span>
                </div>
                <span className="text-[15px] font-medium leading-relaxed text-sub">{body}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="features" aria-label="맹고가 해 주는 일" className="scroll-mt-20 border-y border-line bg-snow">
          <div className="mx-auto flex max-w-[1100px] flex-col gap-20 px-5 py-16 md:gap-28 md:py-24">
            <Feature
              title="그게 나한테 어떤 영향을 주지?"
              body="관심 분야 소식을 하나의 흐름으로 엮고, 그 소식이 나에게 어떤 영향을 줄지 짚어 드려요. 내 상황을 알려 주면 더 맞춰지고, 없으면 읽고 듣던 소식을 바탕으로 짚어요. 사거나 팔라는 말은 하지 않아요."
            >
              <div className="tile p-5">
                <p className="text-[14px] font-semibold text-sub">맞춤 체크 예시</p>
                <ul className="mt-3 flex flex-col gap-3">
                  {CHECKS.map(({ about, body }) => (
                    <li key={about} className="rounded-2xl border border-line bg-paper p-4">
                      <span className="inline-flex items-center rounded-lg bg-snow px-2 py-0.5 text-[13px] font-semibold text-ink">{about}</span>
                      <p className="mt-2 text-[16px] font-bold leading-snug">{body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </Feature>

            <Feature
              flip
              title="관심사는 맹고가 찾아요"
              body="키워드를 고르거나 적을 필요가 없어요. 처음에 끌리는 소식 몇 개만 누르면 관심 분야를 찾고, 그 뒤로는 읽고 듣고 북마크한 소식에 맞춰 계속 맞춰 드려요. 많이 본 분야는 더, 넘긴 분야는 덜 받아요."
            >
              <Phone src={foundShot} className="mx-auto w-[62%] max-w-[240px]" />
            </Feature>

            <Feature
              title="출근길·퇴근길, 하루 두 번"
              body="아침엔 출근길 브리핑, 저녁엔 그 뒤에 나온 소식으로 퇴근길 브리핑을 한 번 더 챙겨 드려요. 여러 곳에서 다룬 같은 소식은 하나로 묶고, 많이 다룬 소식을 맨 앞에 놓아요. 다 들으면 거기까지, 끝없는 스크롤은 없어요."
            >
              <div className="flex items-start justify-center gap-3 sm:gap-4">
                <Phone src={todayShot} className="w-1/2 max-w-[220px]" />
                <Phone src={todayPmShot} className="mt-10 w-1/2 max-w-[220px]" />
              </div>
            </Feature>

            <Feature
              flip
              title="듣기만 하면 돼요"
              body="브리핑 듣기를 누르면 소식을 끝까지 이어서 읽어 드려요. 앱에서는 화면을 꺼도 계속 들리고, 보관함에서 고른 소식만 골라 들을 수도 있어요. 목소리는 여성·남성 중에 골라요."
            >
              <Phone src={listenShot} className="mx-auto w-[62%] max-w-[240px]" />
            </Feature>

            <Feature
              title="다 읽지 않아도, 핵심만 요약해요"
              body="긴 글을 끝까지 읽을 필요 없어요. AI가 핵심만 짧게 요약하고, 원문 사진과 출처 링크를 함께 보여 드려요. 영어로 된 해외 글도 한국어로 요약하고, 읽다 궁금한 건 맹고 AI에게 물어보면 돼요."
            >
              <Phone src={articleShot} className="mx-auto w-[62%] max-w-[240px]" />
            </Feature>

            <Feature
              flip
              title="모든 소식엔 출처가 있어요"
              body="국내 경제지와 언론사, 해외 매체에서 모으고(영어 글도 한국어로), 소식마다 원문 링크가 붙어 있어 더 궁금하면 바로 확인할 수 있어요."
            >
              <div className="tile p-5">
                <p className="text-[14px] font-semibold text-sub">소식마다 붙는 출처</p>
                <ul className="mt-3 flex flex-col gap-3">
                  {SOURCES.map(({ kind, title, Icon }) => (
                    <li key={kind} className="rounded-2xl border border-line bg-paper p-4">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-snow px-2 py-0.5 text-[13px] font-semibold text-ink">
                        <Icon className="size-3.5" />
                        {kind}
                      </span>
                      <p className="mt-2 text-[16px] font-bold leading-snug">{title}</p>
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold text-sub underline underline-offset-4">
                        원문 보기
                        <IconExternal className="size-3.5" />
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </Feature>

            <Feature
              title="지난 소식은 보관함에, 한 주는 리포트로"
              body="받은 소식은 보관함에 최신순으로 쌓이고, 분야로 거르거나 찾아서 골라 들을 수 있어요. Premium은 매주 월요일 아침, 지난주 소식을 한 줄 총평과 분야별 정리로 모은 주간 리포트를 받아요."
            >
              <div className="flex items-start justify-center gap-3 sm:gap-4">
                <Phone src={libraryShot} className="w-1/2 max-w-[220px]" />
                <Phone src={reportShot} className="mt-10 w-1/2 max-w-[220px]" />
              </div>
            </Feature>
          </div>
        </section>

        <section aria-labelledby="how-title" className="mx-auto max-w-[1100px] px-5 py-16 md:py-24">
          <h2 id="how-title" className="text-center text-[28px] font-bold tracking-[-0.04em] md:text-[36px]">
            시작은 1분이면 돼요
          </h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              ["끌리는 소식을 눌러요", "처음에 소식 몇 개만 누르면 맹고가 관심 분야를 찾아요. 고르거나 적을 건 없어요."],
              ["맹고가 모으고 골라요", "출근길·퇴근길 전에 소식을 모아 같은 소식은 묶고, 요약하고, 내 관심에 맞는 순서로 골라요."],
              ["출퇴근길에 들어요", "브리핑이 도착하면 읽어도 되고 이어서 들어도 돼요. 듣고 읽는 만큼 관심사도 더 잘 맞춰져요."],
            ].map(([title, body], i) => (
              <li key={title} className="tile flex flex-col gap-3 p-6">
                <span className="keep-light flex size-11 items-center justify-center rounded-full bg-mango font-round text-[20px] font-black text-ink">{i + 1}</span>
                <span className="text-[19px] font-bold">{title}</span>
                <span className="text-[15px] font-medium leading-relaxed text-sub">{body}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* 맹고가 다루는 분야. 분야마다 소식 목록을 보여 주는 공개 페이지(검색 노출용)로 잇는다 */}
        <section id="topics" aria-labelledby="topics-title" className="mx-auto max-w-[1100px] scroll-mt-20 px-5 pb-16 md:pb-24">
          <h2 id="topics-title" className="text-center text-[28px] font-bold tracking-[-0.04em] md:text-[36px]">
            맹고가 다루는 분야
          </h2>
          <p className="mt-3 text-center text-[16px] font-medium text-sub">{SECTION_NAMES.join(", ")}. 분야를 누르면 맹고가 요약한 소식을 볼 수 있어요.</p>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PUBLIC_TOPICS.map((t) => (
              <li key={t.slug}>
                <Link href={topicsPath(t.slug)} className="tile flex h-full items-center gap-3 p-4 no-underline hover:border-line-dark">
                  <TopicGroupIcon id={t.id} className="size-11 rounded-2xl" iconClassName="size-6" />
                  <span className="min-w-0">
                    <span className="block text-[17px] font-bold">{t.name}</span>
                    <span className="block truncate text-[14px] font-medium text-sub">{detailsLine(t, 3)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 border-y border-line bg-snow">
          <div className="mx-auto max-w-[880px] px-5 py-16 md:py-24">
            <h2 id="pricing-title" className="text-center text-[28px] font-bold tracking-[-0.04em] md:text-[36px]">
              요금
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <Plan name="Free" price="0원" items={planItems(free, ASK_DAILY.free)} cta={{ signedOut: START, signedIn: OPEN, ghost: true }} />
              <Plan
                featured
                name="Premium"
                price={monthlyPrice(plus)}
                listPrice={discountPct(plus) > 0 ? `${plus.listPriceKrw!.toLocaleString("ko-KR")}원` : undefined}
                discount={discountPct(plus)}
                items={planItems(plus, ASK_DAILY.plus)}
                // 로그인 전 버튼: 할인 중이면 '할인가로 시작하기'(2026-10-22 사용자 결정), 아니면 다른 시작 버튼과 같게
                cta={{ signedOut: discountPct(plus) > 0 ? { ...START, label: "할인가로 시작하기" } : START, signedIn: { href: "/premium", label: "Premium 알아보기" } }}
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="faq-title" className="mx-auto max-w-[760px] px-5 pt-16 md:pt-24">
          <h2 id="faq-title" className="text-center text-[28px] font-bold tracking-[-0.04em] md:text-[36px]">
            자주 묻는 질문
          </h2>
          <div className="mt-8 flex flex-col gap-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="tile group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[17px] font-bold">
                  {q}
                  <span aria-hidden="true" className="text-[22px] font-bold text-sub transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[15px] font-medium leading-relaxed text-sub">{a}</p>
              </details>
            ))}
          </div>
          {/* 질문 목록에 없는 건 문의하기 양식으로(로그인 없이도 된다) */}
          {SUPPORT_EMAIL && (
            <div className="tile mt-6 flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:justify-between sm:text-left">
              <div className="min-w-0">
                <p className="text-[17px] font-bold">더 궁금한 게 있나요?</p>
                <p className="mt-1 break-all text-[14px] font-medium text-sub">{SUPPORT_EMAIL}</p>
              </div>
              <Link href="/contact" className="btn btn-ghost min-h-12 shrink-0 px-6 text-[15px] no-underline">
                문의하기
              </Link>
            </div>
          )}
        </section>

        <section aria-labelledby="cta-title" className="mx-auto max-w-[1100px] px-5 py-16 md:py-24">
          <div className="keep-light flex flex-col items-center gap-6 rounded-3xl bg-mango px-6 py-12 text-center md:flex-row md:px-14 md:text-left">
            <Mascot mood="listen" className="size-28 shrink-0 md:size-36" />
            <div className="flex-1">
              <h2 id="cta-title" className="text-[26px] font-bold leading-snug tracking-[-0.04em] md:text-[34px]">
                오늘 퇴근길부터 들어 보세요
              </h2>
              <p className="mt-2 text-[16px] font-medium text-ink/75">끌리는 소식 몇 개만 누르면 첫 브리핑을 바로 보여 드려요.</p>
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
        <h2 className="text-[26px] font-bold leading-snug tracking-[-0.04em] md:text-[34px]">{title}</h2>
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
        <h3 className="inline-flex items-center gap-1.5 text-[20px] font-bold">
          {featured && <Crown className="size-6" />}
          {name}
        </h3>
        {badge && <span className="keep-light rounded-lg bg-mango px-2 py-0.5 text-[12px] font-bold">{badge}</span>}
      </div>
      {listPrice && (
        <p className="mt-2 flex items-center gap-2 font-round">
          <del className="text-[16px] font-bold text-faint">{listPrice}</del>
          <span className="rounded-lg bg-orange px-2 py-0.5 text-[12px] font-bold text-white">{discount}% 할인</span>
        </p>
      )}
      <p className={`${listPrice ? "mt-0.5" : "mt-2"} flex flex-wrap items-baseline gap-x-2 font-round font-bold tracking-[-0.02em]`}>
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

function StoreLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-1 text-[15px] font-semibold text-sky-dark no-underline hover:underline">
      {label}
      <IconExternal className="size-3.5" />
    </a>
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
            // 웹·iOS(·Android) 앱 하나. 스토어 주소를 sameAs로 이어 같은 앱임을 알린다(2026-11-06 iOS 출시)
            "@type": "SoftwareApplication",
            "@id": `${url}#app`,
            name: SITE_NAME,
            alternateName: SITE_ALT_NAMES,
            url,
            sameAs: STORE_URLS,
            installUrl: PLAY_STORE_URL ?? APP_STORE_URL,
            applicationCategory: "NewsApplication",
            operatingSystem: APP_OPERATING_SYSTEMS,
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
