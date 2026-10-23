// 수집 출처. collect 단계가 시작할 때 sources 테이블에 upsert 한다(url 기준, active·실패 횟수는 건드리지 않는다).
// 2026-10-09(개발)·10-10(주식, 코인·반도체·로봇)·10-11(뉴스 분야)에 모두 열어 보고 넣었다. 봇을 막는 곳(우아한형제들 403)은 넣지 않았다.
// 목록에서 빼도 DB sources 행은 남는다. 그만 받을 출처는 마이그레이션에서 active = false로 끈다(부동산: …_topics_v2.sql).
// weight: 출처 가중치(랭킹의 sourceWeight). 공식·큐레이션은 높게, 기사량이 많은 매체는 낮게. 요약 프롬프트는 1.0 이상을 '신뢰도 높음'으로 보여 준다(core/feed/quality.ts의 credibilityLabel).
// section: 뉴스 분야(core NEWS_SECTIONS의 id). 이 피드의 글이 여러 언론사가 같이 다룬 소식에 끼면 그 분야 헤드라인이 된다(tag.ts의 tagHeadlines).
//   DB에는 넣지 않고 코드에서 url로 찾는다.
// 2026-10-11: K-Pop·K-뷰티·K-푸드 출처는 뺐다(DB에서는 …_news_sections.sql이 끈다).

export interface SourceSeed {
  kind: 'rss' | 'youtube' | 'hn';
  url: string;
  name: string;
  weight: number;
  lang: 'ko' | 'en';
  section?: NewsSectionId;
  /**
   * 이 출처가 다루는 관심사(core 토픽 id). 그 분야를 누가 골랐으면 글을 낱말 거름 없이 모두 임베딩한다(lib/source-topic.ts).
   * 한 분야만 다루는 곳(공식 블로그·기술 블로그·보안 매체)에만 단다. AI·과학처럼 여러 분야를 다루는 매체는 비워 둔다
   */
  topic?: 'ai' | 'dev' | 'dev-release' | 'cloud' | 'security' | 'stock' | 'coin' | 'semiconductor' | 'robot' | 'ev-battery';
}

export type NewsSectionId = 'politics' | 'economy' | 'society' | 'life-culture' | 'it-science' | 'world';

export const SOURCES: SourceSeed[] = [
  // 국내 큐레이션·매체
  { kind: 'rss', url: 'https://news.hada.io/rss/news', name: '긱뉴스', weight: 1.2, lang: 'ko' },
  { kind: 'rss', url: 'https://byline.network/feed/', name: '바이라인네트워크', weight: 0.9, lang: 'ko', section: 'it-science' },
  { kind: 'rss', url: 'https://www.aitimes.com/rss/allArticle.xml', name: 'AI타임스', weight: 0.8, lang: 'ko', section: 'it-science' },
  { kind: 'rss', url: 'https://feeds.feedburner.com/zdkorea', name: 'ZDNet Korea', weight: 0.8, lang: 'ko', section: 'it-science' },
  { kind: 'rss', url: 'https://www.bloter.net/rss/allArticle.xml', name: '블로터', weight: 0.8, lang: 'ko', section: 'it-science' },
  // 파이토치 한국 사용자 모임 '읽을거리&정보공유'(2026-10-23 추가). 논문·뉴스 요약에 SPRi 'AI Brief'(월간, RSS 없음)도 올라온다
  { kind: 'rss', url: 'https://discuss.pytorch.kr/c/news/14.rss', name: '파이토치 한국 사용자 모임', weight: 1.0, lang: 'ko', topic: 'ai' },
  // 국내 기술 블로그
  { kind: 'rss', url: 'https://toss.tech/rss.xml', name: '토스 기술 블로그', weight: 1.1, lang: 'ko', topic: 'dev' },
  { kind: 'rss', url: 'https://tech.kakao.com/feed/', name: '카카오 기술 블로그', weight: 1.1, lang: 'ko', topic: 'dev' },
  { kind: 'rss', url: 'https://d2.naver.com/d2.atom', name: '네이버 D2', weight: 1.1, lang: 'ko', topic: 'dev' },
  { kind: 'rss', url: 'https://techblog.lycorp.co.jp/ko/feed/index.xml', name: 'LY Corp 기술 블로그', weight: 1.0, lang: 'ko', topic: 'dev' },
  { kind: 'rss', url: 'https://medium.com/feed/daangn', name: '당근 테크 블로그', weight: 1.0, lang: 'ko', topic: 'dev' },
  { kind: 'rss', url: 'https://medium.com/feed/musinsa-tech', name: '무신사 테크', weight: 1.0, lang: 'ko', topic: 'dev' },
  { kind: 'rss', url: 'https://tech.devsisters.com/rss.xml', name: '데브시스터즈 기술 블로그', weight: 1.0, lang: 'ko', topic: 'dev' },
  { kind: 'rss', url: 'https://oliveyoung.tech/rss.xml', name: '올리브영 테크 블로그', weight: 1.0, lang: 'ko', topic: 'dev' },
  { kind: 'rss', url: 'https://meetup.nhncloud.com/rss', name: 'NHN Cloud Meetup', weight: 1.0, lang: 'ko', topic: 'dev' },
  { kind: 'rss', url: 'https://devocean.sk.com/blog/rss.do', name: 'SK devocean', weight: 0.9, lang: 'ko', topic: 'dev' },
  // 해외 큐레이션·매체
  { kind: 'hn', url: 'https://hnrss.org/frontpage?points=200', name: 'Hacker News', weight: 1.1, lang: 'en', topic: 'dev' },
  { kind: 'rss', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', name: 'The Verge', weight: 0.9, lang: 'en', topic: 'ai' },
  { kind: 'rss', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', name: 'TechCrunch', weight: 0.9, lang: 'en', topic: 'ai' },
  { kind: 'rss', url: 'https://feed.infoq.com/', name: 'InfoQ', weight: 0.9, lang: 'en', topic: 'dev' },
  { kind: 'rss', url: 'https://feeds.feedburner.com/TheHackersNews', name: 'The Hacker News', weight: 0.8, lang: 'en', topic: 'security' },
  { kind: 'rss', url: 'https://krebsonsecurity.com/feed/', name: 'Krebs on Security', weight: 1.0, lang: 'en', topic: 'security' },
  // 미국 테크 매체·보안(2026-10-23 추가). 편집 기준이 있는 큰 매체만, 하루 글이 많은 종합 피드(TechCrunch·Wired·The Verge 전체) 대신 분야 피드로.
  // 본문을 읽을 수 있는지 확인했다. Medium(Netflix·Airbnb 기술 블로그)·LWN은 본문이 막혀서, Techmeme은 글이 모음 페이지라 뺐다
  { kind: 'rss', url: 'https://www.technologyreview.com/feed/', name: 'MIT Technology Review', weight: 1.1, lang: 'en' },
  { kind: 'rss', url: 'https://spectrum.ieee.org/feeds/feed.rss', name: 'IEEE Spectrum', weight: 1.1, lang: 'en' },
  { kind: 'rss', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', name: 'Ars Technica', weight: 1.0, lang: 'en', topic: 'dev' },
  { kind: 'rss', url: 'https://stackoverflow.blog/feed/', name: 'Stack Overflow 블로그', weight: 0.9, lang: 'en', topic: 'dev' },
  { kind: 'rss', url: 'https://thenewstack.io/feed/', name: 'The New Stack', weight: 0.8, lang: 'en', topic: 'cloud' },
  { kind: 'rss', url: 'https://www.wired.com/feed/category/security/latest/rss', name: 'Wired 보안', weight: 1.0, lang: 'en', topic: 'security' },
  { kind: 'rss', url: 'https://techcrunch.com/category/security/feed/', name: 'TechCrunch 보안', weight: 1.0, lang: 'en', topic: 'security' },
  { kind: 'rss', url: 'https://www.bleepingcomputer.com/feed/', name: 'BleepingComputer', weight: 0.9, lang: 'en', topic: 'security' },
  { kind: 'rss', url: 'https://www.schneier.com/feed/atom/', name: 'Schneier on Security', weight: 1.0, lang: 'en', topic: 'security' },
  // 미국 빅테크 기술 블로그(2026-10-23 추가)
  { kind: 'rss', url: 'https://engineering.fb.com/feed/', name: 'Meta Engineering', weight: 1.1, lang: 'en', topic: 'dev' },
  { kind: 'rss', url: 'https://shopify.engineering/blog.atom', name: 'Shopify Engineering', weight: 1.0, lang: 'en', topic: 'dev' },
  { kind: 'rss', url: 'https://engineering.atspotify.com/feed/', name: 'Spotify Engineering', weight: 1.0, lang: 'en', topic: 'dev' },
  { kind: 'rss', url: 'https://dropbox.tech/feed', name: 'Dropbox Tech', weight: 1.0, lang: 'en', topic: 'dev' },
  { kind: 'rss', url: 'https://stripe.com/blog/feed.rss', name: 'Stripe 블로그', weight: 1.0, lang: 'en', topic: 'dev' },
  // 해외 공식 블로그
  { kind: 'rss', url: 'https://openai.com/news/rss.xml', name: 'OpenAI', weight: 1.2, lang: 'en', topic: 'ai' },
  { kind: 'rss', url: 'https://blog.google/technology/ai/rss/', name: 'Google AI 블로그', weight: 1.1, lang: 'en', topic: 'ai' },
  { kind: 'rss', url: 'https://huggingface.co/blog/feed.xml', name: 'Hugging Face', weight: 1.0, lang: 'en', topic: 'ai' },
  { kind: 'rss', url: 'https://github.blog/feed/', name: 'GitHub 블로그', weight: 1.0, lang: 'en', topic: 'dev' },
  { kind: 'rss', url: 'https://blog.cloudflare.com/rss/', name: 'Cloudflare 블로그', weight: 1.0, lang: 'en', topic: 'dev' },
  { kind: 'rss', url: 'https://vercel.com/atom', name: 'Vercel', weight: 1.0, lang: 'en', topic: 'dev' },
  { kind: 'rss', url: 'https://react.dev/rss.xml', name: 'React 블로그', weight: 1.2, lang: 'en', topic: 'dev-release' },
  { kind: 'rss', url: 'https://nextjs.org/feed.xml', name: 'Next.js 블로그', weight: 1.1, lang: 'en', topic: 'dev-release' },
  { kind: 'rss', url: 'https://www.postgresql.org/news.rss', name: 'PostgreSQL', weight: 1.1, lang: 'en', topic: 'dev-release' },
  { kind: 'rss', url: 'https://planet.postgresql.org/rss20.xml', name: 'Planet PostgreSQL', weight: 0.8, lang: 'en', topic: 'dev' },
  { kind: 'rss', url: 'https://kubernetes.io/feed.xml', name: 'Kubernetes 블로그', weight: 1.0, lang: 'en', topic: 'cloud' },
  { kind: 'rss', url: 'https://www.cncf.io/feed/', name: 'CNCF', weight: 0.8, lang: 'en', topic: 'cloud' },
  { kind: 'rss', url: 'https://android-developers.googleblog.com/feeds/posts/default', name: 'Android Developers', weight: 1.0, lang: 'en', topic: 'dev' },
  { kind: 'rss', url: 'https://www.figma.com/blog/feed/atom.xml', name: 'Figma 블로그', weight: 1.0, lang: 'en' },
  // 공식 블로그·릴리스(언어·프레임워크·클라우드, 2026-10-10 추가). 새 버전 소식을 여기서 받는다
  { kind: 'rss', url: 'https://spring.io/blog.atom', name: 'Spring 블로그', weight: 1.2, lang: 'en', topic: 'dev-release' },
  { kind: 'rss', url: 'https://github.com/fastapi/fastapi/releases.atom', name: 'FastAPI 릴리스', weight: 1.1, lang: 'en', topic: 'dev-release' },
  { kind: 'rss', url: 'https://inside.java/feed.xml', name: 'Inside Java', weight: 1.1, lang: 'en', topic: 'dev-release' },
  { kind: 'rss', url: 'https://blog.jetbrains.com/kotlin/feed/', name: 'Kotlin 블로그', weight: 1.1, lang: 'en', topic: 'dev-release' },
  { kind: 'rss', url: 'https://blog.python.org/feeds/posts/default', name: 'Python Insider', weight: 1.1, lang: 'en', topic: 'dev-release' },
  { kind: 'rss', url: 'https://aws.amazon.com/blogs/aws/feed/', name: 'AWS News Blog', weight: 1.1, lang: 'en', topic: 'cloud' },
  { kind: 'rss', url: 'https://www.microsoft.com/releasecommunications/api/v2/azure/rss', name: 'Azure 업데이트', weight: 0.9, lang: 'en', topic: 'cloud' },
  { kind: 'rss', url: 'https://azure.microsoft.com/en-us/blog/feed/', name: 'Azure 블로그', weight: 1.0, lang: 'en', topic: 'cloud' },
  { kind: 'rss', url: 'https://cloudblog.withgoogle.com/rss/', name: 'Google Cloud 블로그', weight: 1.0, lang: 'en', topic: 'cloud' },
  { kind: 'rss', url: 'https://blog.vuejs.org/feed.rss', name: 'Vue 블로그', weight: 1.1, lang: 'en', topic: 'dev-release' },
  { kind: 'rss', url: 'https://devblogs.microsoft.com/typescript/feed/', name: 'TypeScript 블로그', weight: 1.1, lang: 'en', topic: 'dev-release' },
  // 언어·플랫폼 공식 블로그(2026-10-23 추가)
  { kind: 'rss', url: 'https://go.dev/blog/feed.atom', name: 'Go 블로그', weight: 1.1, lang: 'en', topic: 'dev-release' },
  { kind: 'rss', url: 'https://blog.rust-lang.org/feed.xml', name: 'Rust 블로그', weight: 1.1, lang: 'en', topic: 'dev-release' },
  { kind: 'rss', url: 'https://nodejs.org/en/feed/blog.xml', name: 'Node.js 블로그', weight: 1.1, lang: 'en', topic: 'dev-release' },
  { kind: 'rss', url: 'https://www.swift.org/atom.xml', name: 'Swift 블로그', weight: 1.1, lang: 'en', topic: 'dev-release' },
  { kind: 'rss', url: 'https://devblogs.microsoft.com/dotnet/feed/', name: '.NET 블로그', weight: 1.1, lang: 'en', topic: 'dev-release' },
  { kind: 'rss', url: 'https://developer.apple.com/news/rss/news.rss', name: 'Apple Developer 뉴스', weight: 1.1, lang: 'en', topic: 'dev-release' },
  { kind: 'rss', url: 'https://developer.chrome.com/static/blog/feed.xml', name: 'Chrome for Developers', weight: 1.0, lang: 'en', topic: 'dev-release' },
  { kind: 'rss', url: 'https://www.docker.com/blog/feed/', name: 'Docker 블로그', weight: 0.9, lang: 'en', topic: 'cloud' },
  { kind: 'rss', url: 'https://deepmind.google/blog/rss.xml', name: 'Google DeepMind', weight: 1.1, lang: 'en', topic: 'ai' },
  // 해외 개인·뉴스레터
  { kind: 'rss', url: 'https://simonwillison.net/atom/everything/', name: 'Simon Willison', weight: 1.0, lang: 'en' },
  { kind: 'rss', url: 'https://newsletter.pragmaticengineer.com/feed', name: 'The Pragmatic Engineer', weight: 1.1, lang: 'en', topic: 'dev' },
  { kind: 'rss', url: 'https://martinfowler.com/feed.atom', name: 'Martin Fowler', weight: 1.0, lang: 'en', topic: 'dev' },
  { kind: 'rss', url: 'https://www.smashingmagazine.com/feed/', name: 'Smashing Magazine', weight: 0.9, lang: 'en', topic: 'dev' },
  { kind: 'rss', url: 'https://www.lennysnewsletter.com/feed', name: "Lenny's Newsletter", weight: 1.0, lang: 'en' },
  { kind: 'rss', url: 'https://www.latent.space/feed', name: 'Latent Space', weight: 1.0, lang: 'en', topic: 'ai' },
  // AI 주간 정리 뉴스레터(2026-10-23 추가). The Batch(DeepLearning.AI)는 RSS가 없어 못 넣었다.
  // Import AI는 Anthropic 공동창업자 Jack Clark가 쓴다. Turing Post 한국어판(turingpost.co.kr)은 RSS가 없어 영문판을 받는다(요약은 늘 한국어)
  { kind: 'rss', url: 'https://importai.substack.com/feed', name: 'Import AI', weight: 1.0, lang: 'en', topic: 'ai' },
  { kind: 'rss', url: 'https://lastweekin.ai/feed', name: 'Last Week in AI', weight: 1.0, lang: 'en', topic: 'ai' },
  { kind: 'rss', url: 'https://turingpost.substack.com/feed', name: 'Turing Post', weight: 1.0, lang: 'en', topic: 'ai' },
  // 주식·금리(2026-10-10 추가)
  { kind: 'rss', url: 'https://www.hankyung.com/feed/finance', name: '한국경제 증권', weight: 1.0, lang: 'ko', topic: 'stock' },
  { kind: 'rss', url: 'https://www.mk.co.kr/rss/50200011/', name: '매일경제 증권', weight: 0.9, lang: 'ko', topic: 'stock' },
  { kind: 'rss', url: 'https://www.yna.co.kr/rss/market.xml', name: '연합뉴스 마켓', weight: 1.0, lang: 'ko', topic: 'stock' },
  { kind: 'rss', url: 'https://www.yna.co.kr/rss/economy.xml', name: '연합뉴스 경제', weight: 0.9, lang: 'ko', section: 'economy' },
  { kind: 'rss', url: 'https://kr.investing.com/rss/news.rss', name: '인베스팅닷컴', weight: 0.8, lang: 'ko', topic: 'stock' },
  { kind: 'rss', url: 'https://www.cnbc.com/id/15839069/device/rss/rss.html', name: 'CNBC', weight: 1.0, lang: 'en', topic: 'stock' },
  // 코인(2026-10-10 추가)
  { kind: 'rss', url: 'https://www.blockmedia.co.kr/feed', name: '블록미디어', weight: 1.0, lang: 'ko', topic: 'coin' },
  { kind: 'rss', url: 'https://www.tokenpost.kr/rss', name: '토큰포스트', weight: 0.8, lang: 'ko', topic: 'coin' },
  { kind: 'rss', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk', weight: 1.0, lang: 'en', topic: 'coin' },
  { kind: 'rss', url: 'https://cointelegraph.com/rss', name: 'Cointelegraph', weight: 0.8, lang: 'en', topic: 'coin' },
  // 반도체·로봇·전기차(2026-10-10 추가)
  { kind: 'rss', url: 'https://www.thelec.kr/rss/allArticle.xml', name: '디일렉', weight: 1.0, lang: 'ko', section: 'it-science', topic: 'semiconductor' },
  { kind: 'rss', url: 'https://www.irobotnews.com/rss/allArticle.xml', name: '로봇신문', weight: 1.0, lang: 'ko', topic: 'robot' },
  { kind: 'rss', url: 'https://www.therobotreport.com/feed/', name: 'The Robot Report', weight: 0.9, lang: 'en', topic: 'robot' },
  { kind: 'rss', url: 'https://spectrum.ieee.org/feeds/topic/robotics.rss', name: 'IEEE Spectrum 로봇', weight: 0.9, lang: 'en', topic: 'robot' },
  { kind: 'rss', url: 'https://www.eetimes.com/feed/', name: 'EE Times', weight: 0.8, lang: 'en', topic: 'semiconductor' },
  { kind: 'rss', url: 'https://electrek.co/feed/', name: 'Electrek', weight: 0.8, lang: 'en', topic: 'ev-battery' },
  // 뉴스 분야 헤드라인(2026-10-11). 네이버 뉴스처럼 여러 언론사가 같이 다룬 소식만 헤드라인으로 고른다(tag.ts의 tagHeadlines).
  // 네이버 뉴스는 robots.txt로 모든 봇을 막고 AI·RAG 수집을 금지해서, 언론사가 직접 내는 섹션 RSS를 받는다.
  // 2026-10-11에 모두 열어 보고 넣었다(JTBC RSS는 2024년에 멈춰 뺐다. 조선일보 경제·문화 RSS는 하루 1~2개라 뺐다).
  // 정치
  { kind: 'rss', url: 'https://www.yna.co.kr/rss/politics.xml', name: '연합뉴스 정치', weight: 1.0, lang: 'ko', section: 'politics' },
  { kind: 'rss', url: 'https://rss.donga.com/politics.xml', name: '동아일보 정치', weight: 0.9, lang: 'ko', section: 'politics' },
  { kind: 'rss', url: 'https://www.khan.co.kr/rss/rssdata/politic_news.xml', name: '경향신문 정치', weight: 0.9, lang: 'ko', section: 'politics' },
  { kind: 'rss', url: 'https://www.chosun.com/arc/outboundfeeds/rss/category/politics/?outputType=xml', name: '조선일보 정치', weight: 0.9, lang: 'ko', section: 'politics' },
  { kind: 'rss', url: 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01', name: 'SBS 정치', weight: 0.9, lang: 'ko', section: 'politics' },
  { kind: 'rss', url: 'https://www.hankyung.com/feed/politics', name: '한국경제 정치', weight: 0.8, lang: 'ko', section: 'politics' },
  { kind: 'rss', url: 'https://www.newsis.com/RSS/politics.xml', name: '뉴시스 정치', weight: 0.8, lang: 'ko', section: 'politics' },
  // 경제(연합뉴스 경제는 위 주식·금리에 있다)
  { kind: 'rss', url: 'https://rss.donga.com/economy.xml', name: '동아일보 경제', weight: 0.9, lang: 'ko', section: 'economy' },
  { kind: 'rss', url: 'https://www.khan.co.kr/rss/rssdata/economy_news.xml', name: '경향신문 경제', weight: 0.9, lang: 'ko', section: 'economy' },
  { kind: 'rss', url: 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=02', name: 'SBS 경제', weight: 0.9, lang: 'ko', section: 'economy' },
  { kind: 'rss', url: 'https://www.hankyung.com/feed/economy', name: '한국경제 경제', weight: 0.9, lang: 'ko', section: 'economy' },
  { kind: 'rss', url: 'https://www.newsis.com/RSS/economy.xml', name: '뉴시스 경제', weight: 0.8, lang: 'ko', section: 'economy' },
  // 사회
  { kind: 'rss', url: 'https://www.yna.co.kr/rss/society.xml', name: '연합뉴스 사회', weight: 1.0, lang: 'ko', section: 'society' },
  { kind: 'rss', url: 'https://rss.donga.com/national.xml', name: '동아일보 사회', weight: 0.9, lang: 'ko', section: 'society' },
  { kind: 'rss', url: 'https://www.khan.co.kr/rss/rssdata/society_news.xml', name: '경향신문 사회', weight: 0.9, lang: 'ko', section: 'society' },
  { kind: 'rss', url: 'https://www.chosun.com/arc/outboundfeeds/rss/category/national/?outputType=xml', name: '조선일보 사회', weight: 0.9, lang: 'ko', section: 'society' },
  { kind: 'rss', url: 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=03', name: 'SBS 사회', weight: 0.9, lang: 'ko', section: 'society' },
  { kind: 'rss', url: 'https://www.hankyung.com/feed/society', name: '한국경제 사회', weight: 0.8, lang: 'ko', section: 'society' },
  { kind: 'rss', url: 'https://www.newsis.com/RSS/society.xml', name: '뉴시스 사회', weight: 0.8, lang: 'ko', section: 'society' },
  // 생활/문화(네이버 생활/문화처럼 건강도 여기에)
  { kind: 'rss', url: 'https://www.yna.co.kr/rss/culture.xml', name: '연합뉴스 문화', weight: 1.0, lang: 'ko', section: 'life-culture' },
  { kind: 'rss', url: 'https://www.yna.co.kr/rss/health.xml', name: '연합뉴스 건강', weight: 1.0, lang: 'ko', section: 'life-culture' },
  { kind: 'rss', url: 'https://rss.donga.com/culture.xml', name: '동아일보 문화', weight: 0.9, lang: 'ko', section: 'life-culture' },
  { kind: 'rss', url: 'https://www.khan.co.kr/rss/rssdata/culture_news.xml', name: '경향신문 문화', weight: 0.9, lang: 'ko', section: 'life-culture' },
  { kind: 'rss', url: 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=08', name: 'SBS 문화/라이프', weight: 0.9, lang: 'ko', section: 'life-culture' },
  { kind: 'rss', url: 'https://www.hankyung.com/feed/life', name: '한국경제 생활', weight: 0.8, lang: 'ko', section: 'life-culture' },
  { kind: 'rss', url: 'https://www.newsis.com/RSS/culture.xml', name: '뉴시스 문화', weight: 0.8, lang: 'ko', section: 'life-culture' },
  // IT/과학(ZDNet Korea·블로터·바이라인네트워크·AI타임스·디일렉도 이 분야로 센다)
  { kind: 'rss', url: 'https://rss.donga.com/science.xml', name: '동아일보 IT/의학', weight: 0.9, lang: 'ko', section: 'it-science' },
  { kind: 'rss', url: 'https://www.khan.co.kr/rss/rssdata/science_news.xml', name: '경향신문 과학·환경', weight: 0.9, lang: 'ko', section: 'it-science' },
  { kind: 'rss', url: 'https://www.hankyung.com/feed/it', name: '한국경제 IT·과학', weight: 0.9, lang: 'ko', section: 'it-science' },
  { kind: 'rss', url: 'https://www.newsis.com/RSS/health.xml', name: '뉴시스 IT·바이오', weight: 0.8, lang: 'ko', section: 'it-science' },
  { kind: 'rss', url: 'https://rss.etnews.com/Section901.xml', name: '전자신문', weight: 0.9, lang: 'ko', section: 'it-science' },
  // 세계
  { kind: 'rss', url: 'https://www.yna.co.kr/rss/international.xml', name: '연합뉴스 세계', weight: 1.0, lang: 'ko', section: 'world' },
  { kind: 'rss', url: 'https://rss.donga.com/international.xml', name: '동아일보 국제', weight: 0.9, lang: 'ko', section: 'world' },
  { kind: 'rss', url: 'https://www.khan.co.kr/rss/rssdata/kh_world.xml', name: '경향신문 국제', weight: 0.9, lang: 'ko', section: 'world' },
  { kind: 'rss', url: 'https://www.chosun.com/arc/outboundfeeds/rss/category/international/?outputType=xml', name: '조선일보 국제', weight: 0.9, lang: 'ko', section: 'world' },
  { kind: 'rss', url: 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=07', name: 'SBS 국제', weight: 0.9, lang: 'ko', section: 'world' },
  { kind: 'rss', url: 'https://www.hankyung.com/feed/international', name: '한국경제 국제', weight: 0.8, lang: 'ko', section: 'world' },
  { kind: 'rss', url: 'https://www.newsis.com/RSS/international.xml', name: '뉴시스 국제', weight: 0.8, lang: 'ko', section: 'world' },
  // 유튜브 채널 99곳은 2026-10-23에 뺐다(사용자 결정: 영상은 요약하지 않는다). 서버가 영상을 요약하지 않아 거의 배송되지 않으면서
  // 임베딩 상한의 19%를 차지했다. DB에서는 …_youtube_off.sql이 끈다.
];
