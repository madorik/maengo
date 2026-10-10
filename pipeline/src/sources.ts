// 수집 출처. collect 단계가 시작할 때 sources 테이블에 upsert 한다(url 기준, active·실패 횟수는 건드리지 않는다).
// 2026-10-09(개발)·10-10(주식, 코인·반도체·로봇)·10-11(뉴스 분야)에 모두 열어 보고 넣었다. 봇을 막는 곳(우아한형제들 403)은 넣지 않았다.
// 목록에서 빼도 DB sources 행은 남는다. 그만 받을 출처는 마이그레이션에서 active = false로 끈다(부동산: …_topics_v2.sql).
// weight: 출처 가중치(랭킹의 sourceWeight). 공식·큐레이션은 높게, 기사량이 많은 매체는 낮게.
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
}

export type NewsSectionId = 'politics' | 'economy' | 'society' | 'life-culture' | 'it-science' | 'world';

const yt = (channelId: string) => `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

export const SOURCES: SourceSeed[] = [
  // 국내 큐레이션·매체
  { kind: 'rss', url: 'https://news.hada.io/rss/news', name: '긱뉴스', weight: 1.2, lang: 'ko' },
  { kind: 'rss', url: 'https://byline.network/feed/', name: '바이라인네트워크', weight: 0.9, lang: 'ko', section: 'it-science' },
  { kind: 'rss', url: 'https://www.aitimes.com/rss/allArticle.xml', name: 'AI타임스', weight: 0.8, lang: 'ko', section: 'it-science' },
  { kind: 'rss', url: 'https://feeds.feedburner.com/zdkorea', name: 'ZDNet Korea', weight: 0.8, lang: 'ko', section: 'it-science' },
  { kind: 'rss', url: 'https://www.bloter.net/rss/allArticle.xml', name: '블로터', weight: 0.8, lang: 'ko', section: 'it-science' },
  // 국내 기술 블로그
  { kind: 'rss', url: 'https://toss.tech/rss.xml', name: '토스 기술 블로그', weight: 1.1, lang: 'ko' },
  { kind: 'rss', url: 'https://tech.kakao.com/feed/', name: '카카오 기술 블로그', weight: 1.1, lang: 'ko' },
  { kind: 'rss', url: 'https://d2.naver.com/d2.atom', name: '네이버 D2', weight: 1.1, lang: 'ko' },
  { kind: 'rss', url: 'https://techblog.lycorp.co.jp/ko/feed/index.xml', name: 'LY Corp 기술 블로그', weight: 1.0, lang: 'ko' },
  { kind: 'rss', url: 'https://medium.com/feed/daangn', name: '당근 테크 블로그', weight: 1.0, lang: 'ko' },
  { kind: 'rss', url: 'https://medium.com/feed/musinsa-tech', name: '무신사 테크', weight: 1.0, lang: 'ko' },
  { kind: 'rss', url: 'https://tech.devsisters.com/rss.xml', name: '데브시스터즈 기술 블로그', weight: 1.0, lang: 'ko' },
  { kind: 'rss', url: 'https://oliveyoung.tech/rss.xml', name: '올리브영 테크 블로그', weight: 1.0, lang: 'ko' },
  { kind: 'rss', url: 'https://meetup.nhncloud.com/rss', name: 'NHN Cloud Meetup', weight: 1.0, lang: 'ko' },
  { kind: 'rss', url: 'https://devocean.sk.com/blog/rss.do', name: 'SK devocean', weight: 0.9, lang: 'ko' },
  // 해외 큐레이션·매체
  { kind: 'hn', url: 'https://hnrss.org/frontpage?points=200', name: 'Hacker News', weight: 1.1, lang: 'en' },
  { kind: 'rss', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', name: 'The Verge', weight: 0.9, lang: 'en' },
  { kind: 'rss', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', name: 'TechCrunch', weight: 0.9, lang: 'en' },
  { kind: 'rss', url: 'https://feed.infoq.com/', name: 'InfoQ', weight: 0.9, lang: 'en' },
  { kind: 'rss', url: 'https://feeds.feedburner.com/TheHackersNews', name: 'The Hacker News', weight: 0.8, lang: 'en' },
  { kind: 'rss', url: 'https://krebsonsecurity.com/feed/', name: 'Krebs on Security', weight: 1.0, lang: 'en' },
  // 해외 공식 블로그
  { kind: 'rss', url: 'https://openai.com/news/rss.xml', name: 'OpenAI', weight: 1.2, lang: 'en' },
  { kind: 'rss', url: 'https://blog.google/technology/ai/rss/', name: 'Google AI 블로그', weight: 1.1, lang: 'en' },
  { kind: 'rss', url: 'https://huggingface.co/blog/feed.xml', name: 'Hugging Face', weight: 1.0, lang: 'en' },
  { kind: 'rss', url: 'https://github.blog/feed/', name: 'GitHub 블로그', weight: 1.0, lang: 'en' },
  { kind: 'rss', url: 'https://blog.cloudflare.com/rss/', name: 'Cloudflare 블로그', weight: 1.0, lang: 'en' },
  { kind: 'rss', url: 'https://vercel.com/atom', name: 'Vercel', weight: 1.0, lang: 'en' },
  { kind: 'rss', url: 'https://react.dev/rss.xml', name: 'React 블로그', weight: 1.2, lang: 'en' },
  { kind: 'rss', url: 'https://nextjs.org/feed.xml', name: 'Next.js 블로그', weight: 1.1, lang: 'en' },
  { kind: 'rss', url: 'https://www.postgresql.org/news.rss', name: 'PostgreSQL', weight: 1.1, lang: 'en' },
  { kind: 'rss', url: 'https://planet.postgresql.org/rss20.xml', name: 'Planet PostgreSQL', weight: 0.8, lang: 'en' },
  { kind: 'rss', url: 'https://kubernetes.io/feed.xml', name: 'Kubernetes 블로그', weight: 1.0, lang: 'en' },
  { kind: 'rss', url: 'https://www.cncf.io/feed/', name: 'CNCF', weight: 0.8, lang: 'en' },
  { kind: 'rss', url: 'https://android-developers.googleblog.com/feeds/posts/default', name: 'Android Developers', weight: 1.0, lang: 'en' },
  { kind: 'rss', url: 'https://www.figma.com/blog/feed/atom.xml', name: 'Figma 블로그', weight: 1.0, lang: 'en' },
  // 공식 블로그·릴리스(언어·프레임워크·클라우드, 2026-10-10 추가). 새 버전 소식을 여기서 받는다
  { kind: 'rss', url: 'https://spring.io/blog.atom', name: 'Spring 블로그', weight: 1.2, lang: 'en' },
  { kind: 'rss', url: 'https://github.com/fastapi/fastapi/releases.atom', name: 'FastAPI 릴리스', weight: 1.1, lang: 'en' },
  { kind: 'rss', url: 'https://inside.java/feed.xml', name: 'Inside Java', weight: 1.1, lang: 'en' },
  { kind: 'rss', url: 'https://blog.jetbrains.com/kotlin/feed/', name: 'Kotlin 블로그', weight: 1.1, lang: 'en' },
  { kind: 'rss', url: 'https://blog.python.org/feeds/posts/default', name: 'Python Insider', weight: 1.1, lang: 'en' },
  { kind: 'rss', url: 'https://aws.amazon.com/blogs/aws/feed/', name: 'AWS News Blog', weight: 1.1, lang: 'en' },
  { kind: 'rss', url: 'https://www.microsoft.com/releasecommunications/api/v2/azure/rss', name: 'Azure 업데이트', weight: 0.9, lang: 'en' },
  { kind: 'rss', url: 'https://azure.microsoft.com/en-us/blog/feed/', name: 'Azure 블로그', weight: 1.0, lang: 'en' },
  { kind: 'rss', url: 'https://cloudblog.withgoogle.com/rss/', name: 'Google Cloud 블로그', weight: 1.0, lang: 'en' },
  { kind: 'rss', url: 'https://blog.vuejs.org/feed.rss', name: 'Vue 블로그', weight: 1.1, lang: 'en' },
  { kind: 'rss', url: 'https://devblogs.microsoft.com/typescript/feed/', name: 'TypeScript 블로그', weight: 1.1, lang: 'en' },
  { kind: 'rss', url: 'https://deepmind.google/blog/rss.xml', name: 'Google DeepMind', weight: 1.1, lang: 'en' },
  // 해외 개인·뉴스레터
  { kind: 'rss', url: 'https://simonwillison.net/atom/everything/', name: 'Simon Willison', weight: 1.0, lang: 'en' },
  { kind: 'rss', url: 'https://newsletter.pragmaticengineer.com/feed', name: 'The Pragmatic Engineer', weight: 1.1, lang: 'en' },
  { kind: 'rss', url: 'https://martinfowler.com/feed.atom', name: 'Martin Fowler', weight: 1.0, lang: 'en' },
  { kind: 'rss', url: 'https://www.smashingmagazine.com/feed/', name: 'Smashing Magazine', weight: 0.9, lang: 'en' },
  { kind: 'rss', url: 'https://www.lennysnewsletter.com/feed', name: "Lenny's Newsletter", weight: 1.0, lang: 'en' },
  { kind: 'rss', url: 'https://www.latent.space/feed', name: 'Latent Space', weight: 1.0, lang: 'en' },
  // 주식·금리(2026-10-10 추가)
  { kind: 'rss', url: 'https://www.hankyung.com/feed/finance', name: '한국경제 증권', weight: 1.0, lang: 'ko' },
  { kind: 'rss', url: 'https://www.mk.co.kr/rss/50200011/', name: '매일경제 증권', weight: 0.9, lang: 'ko' },
  { kind: 'rss', url: 'https://www.yna.co.kr/rss/market.xml', name: '연합뉴스 마켓', weight: 1.0, lang: 'ko' },
  { kind: 'rss', url: 'https://www.yna.co.kr/rss/economy.xml', name: '연합뉴스 경제', weight: 0.9, lang: 'ko', section: 'economy' },
  { kind: 'rss', url: 'https://kr.investing.com/rss/news.rss', name: '인베스팅닷컴', weight: 0.8, lang: 'ko' },
  { kind: 'rss', url: 'https://www.cnbc.com/id/15839069/device/rss/rss.html', name: 'CNBC', weight: 1.0, lang: 'en' },
  // 코인(2026-10-10 추가)
  { kind: 'rss', url: 'https://www.blockmedia.co.kr/feed', name: '블록미디어', weight: 1.0, lang: 'ko' },
  { kind: 'rss', url: 'https://www.tokenpost.kr/rss', name: '토큰포스트', weight: 0.8, lang: 'ko' },
  { kind: 'rss', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk', weight: 1.0, lang: 'en' },
  { kind: 'rss', url: 'https://cointelegraph.com/rss', name: 'Cointelegraph', weight: 0.8, lang: 'en' },
  // 반도체·로봇·전기차(2026-10-10 추가)
  { kind: 'rss', url: 'https://www.thelec.kr/rss/allArticle.xml', name: '디일렉', weight: 1.0, lang: 'ko', section: 'it-science' },
  { kind: 'rss', url: 'https://www.irobotnews.com/rss/allArticle.xml', name: '로봇신문', weight: 1.0, lang: 'ko' },
  { kind: 'rss', url: 'https://www.therobotreport.com/feed/', name: 'The Robot Report', weight: 0.9, lang: 'en' },
  { kind: 'rss', url: 'https://spectrum.ieee.org/feeds/topic/robotics.rss', name: 'IEEE Spectrum 로봇', weight: 0.9, lang: 'en' },
  { kind: 'rss', url: 'https://www.eetimes.com/feed/', name: 'EE Times', weight: 0.8, lang: 'en' },
  { kind: 'rss', url: 'https://electrek.co/feed/', name: 'Electrek', weight: 0.8, lang: 'en' },
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
  // 유튜브 채널(채널 RSS는 가끔 500·404를 내서 몇 번 다시 시도한다). 쇼츠는 수집할 때 거른다(lib/feed.ts의 isShort).
  // 2026-10-11: 분야별로 채널 검색 + 알려진 채널 약 700곳의 RSS를 열어, 30일 안에 올렸고 쇼츠가 70% 미만이며
  // 뉴스·해설·공식인 곳만 넣었다(가격 예측·매매 신호·먹방·리액션은 뺐다). 줄 끝은 채널 핸들.
  // weight: 공식 1.1, 전문가·언론사가 하는 해설 1.0, 일반 해설 유튜버·방송사 0.9, 자극적이거나 약한 곳 0.7~0.8.
  // 요약 프롬프트는 1.0 이상을 '신뢰도 높음'으로 보여 준다(core/feed/quality.ts의 credibilityLabel).
  { kind: 'youtube', url: yt('UC_x5XG1OV2P6uZZ5FSM9Ttw'), name: 'Google for Developers', weight: 1.0, lang: 'en' },
  { kind: 'youtube', url: yt('UCQNE2JmbasNYbjGAcuBiRRg'), name: '조코딩', weight: 0.9, lang: 'ko' },
  // 유튜브 AI
  { kind: 'youtube', url: yt('UCIgnGlGkVRhd4qNFcEwLL4A'), name: 'AI Search', weight: 0.9, lang: 'en' }, // @theAIsearch
  { kind: 'youtube', url: yt('UCawZsQWqfGSbCI5yjkdVkTA'), name: 'Matthew Berman', weight: 0.9, lang: 'en' }, // @matthew_berman
  { kind: 'youtube', url: yt('UCXZCJLdBC09xxGZ6gcdrc6A'), name: 'OpenAI 유튜브', weight: 1.1, lang: 'en' }, // @OpenAI
  { kind: 'youtube', url: yt('UChpleBmo18P08aKCIgti38g'), name: 'Matt Wolfe', weight: 0.9, lang: 'en' }, // @mreflow
  { kind: 'youtube', url: yt('UC0C-17n9iuUQPylguM1d-lQ'), name: 'Nate B Jones', weight: 0.9, lang: 'en' }, // @NateBJones
  { kind: 'youtube', url: yt('UCqcbQf6yw5KzRoDDcZ_wBSw'), name: 'Wes Roth', weight: 0.9, lang: 'en' }, // @WesRoth
  { kind: 'youtube', url: yt('UCP7jMXSY2xbc3KCAE0MHQ-A'), name: 'Google DeepMind 유튜브', weight: 1.1, lang: 'en' }, // @GoogleDeepMind
  { kind: 'youtube', url: yt('UCeN2YeJcBCRJoXgzF_OU3qw'), name: '안될공학', weight: 1.0, lang: 'ko' }, // @unrealtech
  { kind: 'youtube', url: yt('UC55ODQSvARtgSyc8ThfiepQ'), name: 'Sam Witteveen', weight: 1.0, lang: 'en' }, // @samwitteveenai
  { kind: 'youtube', url: yt('UCbfYPyITQ-7l4upoX8nvctg'), name: 'Two Minute Papers', weight: 1.0, lang: 'en' }, // @TwoMinutePapers
  { kind: 'youtube', url: yt('UCelFN6fJ6OY6v8pbc_SLiXA'), name: '티타임즈TV', weight: 1.0, lang: 'ko' }, // @TTimesTV
  { kind: 'youtube', url: yt('UCrDwWp7EBBv4NwvScIpBDOA'), name: 'Anthropic 유튜브', weight: 1.1, lang: 'en' }, // @anthropic-ai
  { kind: 'youtube', url: yt('UCKelCK4ZaO6HeEI1KQjqzWA'), name: 'The AI Daily Brief', weight: 0.9, lang: 'en' }, // @AIDailyBrief
  { kind: 'youtube', url: yt('UCNJ1Ymd5yFuUPtn21xtRbbw'), name: 'AI Explained', weight: 1.0, lang: 'en' }, // @aiexplained-official
  { kind: 'youtube', url: yt('UCdLZ0MsYS4hmqFgOYCB6C9w'), name: 'CONNECT AI LAB', weight: 0.9, lang: 'ko' }, // @CONNECT-AI-LAB
  { kind: 'youtube', url: yt('UCgfe2ooZD3VJPB6aJAnuQng'), name: 'bycloud', weight: 0.9, lang: 'en' }, // @bycloudAI
  { kind: 'youtube', url: yt('UCztt42h03X49HFRGW9--Bhg'), name: 'AI 겸임교수 이종범', weight: 0.9, lang: 'ko' }, // @aiadjunct
  { kind: 'youtube', url: yt('UCPP1HVcKyFThWlpO-JJdXdg'), name: '감자나라ai', weight: 0.8, lang: 'ko' }, // @감자나라ai
  { kind: 'youtube', url: yt('UC6MJ21q3iLp4pttosZp-Sgw'), name: '소이랩(생생한 AI 소식)', weight: 0.8, lang: 'ko' }, // @soy_lab
  // 유튜브 주식
  { kind: 'youtube', url: yt('UCsJ6RuBiTVWRX156FVbeaGg'), name: '슈카월드', weight: 1.0, lang: 'ko' }, // @syukaworld
  { kind: 'youtube', url: yt('UCOB62fKRT7b73X7tRxMuN2g'), name: '박종훈의 지식한방', weight: 1.0, lang: 'ko' }, // @kpunch
  { kind: 'youtube', url: yt('UC_JJ_NhRqPKcIOj5Ko3W_3w'), name: '오선의 미국 증시 라이브', weight: 1.0, lang: 'ko' }, // @futuresnow
  { kind: 'youtube', url: yt('UC9ijza42jVR3T6b8bColgvg'), name: 'Kitco NEWS', weight: 0.8, lang: 'en' }, // @kitco
  { kind: 'youtube', url: yt('UChlv4GSd7OQl3js-jkLOnFA'), name: '삼프로TV', weight: 1.0, lang: 'ko' }, // @3protv
  { kind: 'youtube', url: yt('UCASM0cgfkJxQ1ICmRilfHLw'), name: 'Patrick Boyle', weight: 1.0, lang: 'en' }, // @PBoyle
  { kind: 'youtube', url: yt('UCiYbaVEODktcsh09454Grow'), name: '손에잡히는경제', weight: 1.0, lang: 'ko' }, // @손경제
  { kind: 'youtube', url: yt('UCC3yfxS5qC6PCwDzetUuEWg'), name: '소수몽키', weight: 0.9, lang: 'ko' }, // @sosumonkey
  { kind: 'youtube', url: yt('UC3pfEoxaRDT6hvZZjpHu7Tg'), name: '김광석TV', weight: 1.0, lang: 'ko' }, // @경읽남_김광석TV
  { kind: 'youtube', url: yt('UCMupe3fvv1-Hi3SRxZzSsTw'), name: '미국 주식 채널 에디', weight: 0.9, lang: 'ko' }, // @미국주식
  { kind: 'youtube', url: yt('UCWskYkV4c4S9D__rsfOl2JA'), name: '한경 글로벌마켓', weight: 0.9, lang: 'ko' }, // @한경글로벌마켓
  { kind: 'youtube', url: yt('UCp6aBHRM6ZS_kLeC57HV4kg'), name: 'TheStreet', weight: 0.8, lang: 'en' }, // @TheStreet
  { kind: 'youtube', url: yt('UCGCGxsbmG_9nincyI7xypow'), name: '한경 코리아마켓', weight: 0.9, lang: 'ko' }, // @hk_koreamarket
  { kind: 'youtube', url: yt('UCrp_UI8XtuYfpiqluWLD7Lw'), name: 'CNBC Television', weight: 0.9, lang: 'en' }, // @CNBCtelevision
  { kind: 'youtube', url: yt('UCDnIfMiHBNs1RP7y6B6wf1Q'), name: '염블리(LS증권)', weight: 0.9, lang: 'ko' }, // @yeomvely
  { kind: 'youtube', url: yt('UCF8AeLlUbEpKju6v1H6p8Eg'), name: '한국경제TV', weight: 0.9, lang: 'ko' }, // @hkwowtv
  { kind: 'youtube', url: yt('UClErHbdZKUnD1NyIUeQWvuQ'), name: 'MTN 머니투데이방송', weight: 0.9, lang: 'ko' }, // @mtn
  { kind: 'youtube', url: yt('UCNnwmqZOxSuOiF3_c7mAGWA'), name: '미국주식으로 은퇴하기 미주은', weight: 0.9, lang: 'ko' }, // @mijooeun
  { kind: 'youtube', url: yt('UCqoSrYgusd8ZddtMoWhjHYA'), name: 'Schwab Network', weight: 0.9, lang: 'en' }, // @SchwabNetwork
  { kind: 'youtube', url: yt('UCEAZeUIeJs0IjQiqTCdVSIg'), name: 'Yahoo Finance', weight: 0.9, lang: 'en' }, // @YahooFinance
  { kind: 'youtube', url: yt('UC1eyYJRpM_g5WBp60mmRwCQ'), name: '경제명탐정', weight: 0.9, lang: 'ko' }, // @경제명탐정
  { kind: 'youtube', url: yt('UC5fZv7bPcF5j2RsfO-9OiLA'), name: "Investor's Business Daily", weight: 0.9, lang: 'en' }, // @investorsbusinessdaily
  { kind: 'youtube', url: yt('UCNi2OWpVGVBC2SuMBGXFzbA'), name: '딜사이트경제TV', weight: 0.8, lang: 'ko' }, // @dealsitetv2024
  // 유튜브 코인
  { kind: 'youtube', url: yt('UCRvqjQPSeaWn-uEx-w0XOIg'), name: 'Benjamin Cowen', weight: 0.9, lang: 'en' }, // @benjaminjcowen
  { kind: 'youtube', url: yt('UC4VPa7EOvObpyCRI4YKRQRw'), name: 'Paul Barron Network', weight: 0.8, lang: 'en' }, // @PaulBarronNetwork
  { kind: 'youtube', url: yt('UCevXpeL8cNyAnww-NqJ4m2w'), name: 'Anthony Pompliano', weight: 0.9, lang: 'en' }, // @AnthonyPompliano
  { kind: 'youtube', url: yt('UCqK_GSMbpiV8spgD3ZGloSw'), name: 'Coin Bureau', weight: 0.9, lang: 'en' }, // @CoinBureau
  { kind: 'youtube', url: yt('UCJgHxpqfhWEEjYH9cLXqhIQ'), name: 'Digital Asset News', weight: 0.8, lang: 'en' }, // @DigitalAssetNews
  { kind: 'youtube', url: yt('UC2iTeBq1P151zPPuENMBq-g'), name: '불장TV 퍼즈', weight: 0.8, lang: 'ko' }, // @ppause
  { kind: 'youtube', url: yt('UCAl9Ld79qaZxp9JzEOwd3aA'), name: 'Bankless', weight: 0.9, lang: 'en' }, // @Bankless
  { kind: 'youtube', url: yt('UCVu8stljjVNfYoISzDUFsbA'), name: '백훈종의 전지적 비트코인 시점', weight: 0.9, lang: 'ko' }, // @백훈종
  { kind: 'youtube', url: yt('UCtOV5M-T3GcsJAq8QKaf0lg'), name: 'Bitcoin Magazine', weight: 0.9, lang: 'en' }, // @BitcoinMagazine
  { kind: 'youtube', url: yt('UCzGUaygjUeV-Zm_DRuFS0pA'), name: '오태민의 지혜의족보', weight: 0.9, lang: 'ko' }, // @wisdom_of_bitcoin
  { kind: 'youtube', url: yt('UCRqBu-grVX1p97WaX4d-OuQ'), name: 'Cointelegraph 유튜브', weight: 0.8, lang: 'en' }, // @Cointelegraph
  { kind: 'youtube', url: yt('UCuj_rpY3vgPHAwBrIGOLT5A'), name: '블록미디어 유튜브', weight: 1.0, lang: 'ko' }, // @blockmedia
  { kind: 'youtube', url: yt('UCZJ9ZukOgTjKcjN9SJQPf7w'), name: 'EZPZ 이지피지', weight: 0.8, lang: 'ko' }, // @EZPZNOW
  { kind: 'youtube', url: yt('UC7TghOL755nBk7HelHoi9LQ'), name: 'CoinDesk 유튜브', weight: 1.0, lang: 'en' }, // @CoinDesk
  // 유튜브 반도체·로봇·전기차
  { kind: 'youtube', url: yt('UCsMbp4V8oxzHCMdOUP-3oWw'), name: 'Unitree Robotics', weight: 1.1, lang: 'en' }, // @UnitreeRobotics
  { kind: 'youtube', url: yt('UChIs72whgZI9w6d6FhwGGHA'), name: 'Gamers Nexus', weight: 1.0, lang: 'en' }, // @GamersNexus
  { kind: 'youtube', url: yt('UCMTZqwCdw9Nynw9BkCgfeRQ'), name: '모트라인', weight: 0.9, lang: 'ko' }, // @motline
  { kind: 'youtube', url: yt('UC1LpsuAUaKoMzzJSEt5WImw'), name: 'Asianometry', weight: 1.0, lang: 'en' }, // @Asianometry
  { kind: 'youtube', url: yt('UC5WjFrtBdufl6CZojX3D8dQ'), name: 'Tesla 유튜브', weight: 1.1, lang: 'en' }, // @Tesla
  { kind: 'youtube', url: yt('UC7cF2ZYvGm_zgrX-xCV88mA'), name: '한국경제TV뉴스', weight: 0.9, lang: 'ko' }, // @hkwowtvnews
  { kind: 'youtube', url: yt('UCORX3Cl7ByidjEgzSCgv9Yw'), name: 'Anastasi In Tech', weight: 1.0, lang: 'en' }, // @AnastasiInTech
  { kind: 'youtube', url: yt('UCr1QM8ej1x8c3kPLmiPgKtg'), name: '차미남TV', weight: 0.8, lang: 'ko' }, // @CMNTV100
  { kind: 'youtube', url: yt('UCHQDjDDW8w2RieO-IuqYlyg'), name: 'AMD 유튜브', weight: 1.1, lang: 'en' }, // @AMD
  { kind: 'youtube', url: yt('UCbMjg2EvXs_RUGW-KrdM3pw'), name: 'SBS Biz 뉴스', weight: 0.9, lang: 'ko' }, // @SBSBiz2021
  { kind: 'youtube', url: yt('UC3aD-gfmHV_MhMmcwyIu1wA'), name: 'Chip Stock Investor', weight: 0.8, lang: 'en' }, // @chipstockinvestor
  { kind: 'youtube', url: yt('UCHuiy8bXnmK5nisYHUd1J5g'), name: 'NVIDIA 유튜브', weight: 1.1, lang: 'en' }, // @NVIDIA
  { kind: 'youtube', url: yt('UC1r0DG-KEPyqOeW6o79PByw'), name: 'TechTechPotato', weight: 1.0, lang: 'en' }, // @TechTechPotato
  { kind: 'youtube', url: yt('UC7vVhkEfw4nOGp8TyDk7RcQ'), name: 'Boston Dynamics', weight: 1.1, lang: 'en' }, // @BostonDynamics
  { kind: 'youtube', url: yt('UCj--iMtToRO_cGG_fpmP5XQ'), name: 'Munro Live', weight: 1.0, lang: 'en' }, // @MunroLive
  { kind: 'youtube', url: yt('UCu8luTDe_Xxd2ahAXsCWX5g'), name: 'PRO ROBOTS', weight: 0.8, lang: 'en' }, // @PROROBOTS
  { kind: 'youtube', url: yt('UCpGckZ8X4J0UJ1yqYqKpLig'), name: '삼성전자 반도체 뉴스룸', weight: 1.1, lang: 'ko' }, // @SamsungSemiconductorNewsroom
  { kind: 'youtube', url: yt('UCmMwHbw2j8LfvTKVh3O7Vdw'), name: 'High Yield', weight: 1.0, lang: 'en' }, // @HighYield
  { kind: 'youtube', url: yt('UCcOIZzJgLCyMPILY7-1Vsdg'), name: 'Electrek 유튜브', weight: 0.8, lang: 'en' }, // @electrek
  { kind: 'youtube', url: yt('UCYlq-KmwPjc1DtsGmthFqSQ'), name: 'Figure', weight: 1.1, lang: 'en' }, // @figureai
  // 유튜브 개발
  { kind: 'youtube', url: yt('UCsBjURrPoezykLs9EqgamOA'), name: 'Fireship', weight: 1.0, lang: 'en' }, // @Fireship
  { kind: 'youtube', url: yt('UCUyeluBRhGPCW4rPe_UvBZQ'), name: 'The PrimeTime', weight: 0.9, lang: 'en' }, // @ThePrimeTimeagen
  { kind: 'youtube', url: yt('UCbRP3c757lWg9M-U7TyEkXA'), name: 'Theo (t3.gg)', weight: 0.9, lang: 'en' }, // @t3dotgg
  { kind: 'youtube', url: yt('UC9x0AN7BWHpCDHSm9NiJFJQ'), name: 'NetworkChuck', weight: 0.9, lang: 'en' }, // @NetworkChuck
  { kind: 'youtube', url: yt('UCSLrpBAzr-ROVGHQ5EmxnUg'), name: '코딩애플', weight: 1.0, lang: 'ko' }, // @codingapple
  { kind: 'youtube', url: yt('UCCfqyGl3nq_V0bo64CjZh8g'), name: 'Modern Software Engineering', weight: 1.0, lang: 'en' }, // @ModernSoftwareEngineeringYT
  { kind: 'youtube', url: yt('UC9-y-6csu5WGm29I7JiwpnA'), name: 'Computerphile', weight: 1.0, lang: 'en' }, // @Computerphile
  { kind: 'youtube', url: yt('UC6VbqOLKkdDhdtnhuTYPKxA'), name: '실밸개발자', weight: 0.9, lang: 'ko' }, // @sv.developer
  { kind: 'youtube', url: yt('UC1_ZZYZsHh2_DzCXN4VGVcQ'), name: '개발동생', weight: 0.9, lang: 'ko' }, // @개발동생
  { kind: 'youtube', url: yt('UCUpJs89fSBXNolQGOYKn0YQ'), name: '노마드 코더', weight: 1.0, lang: 'ko' }, // @nomadcoders
  { kind: 'youtube', url: yt('UCGp4UBwpTNegd_4nCpuBcow'), name: 'JetBrains 유튜브', weight: 1.1, lang: 'en' }, // @JetBrainsTV
  { kind: 'youtube', url: yt('UCdGTtaI-ERLjzZNLuBj3X6A'), name: '널널한 개발자 TV', weight: 0.9, lang: 'ko' }, // @nullnull_not_eq_null
  { kind: 'youtube', url: yt('UCVhQ2NnY5Rskt6UjCUkJ_DA'), name: 'ArjanCodes', weight: 0.9, lang: 'en' }, // @ArjanCodes
  { kind: 'youtube', url: yt('UCKdKdx5-eLZUmAgsdvxkKiA'), name: '양실장의 바이브코딩대학', weight: 0.8, lang: 'ko' }, // @VibecodingUniversity
  { kind: 'youtube', url: yt('UC7c3Kb6jYCRj4JOHHZTxKsQ'), name: 'GitHub 유튜브', weight: 1.1, lang: 'en' }, // @GitHub
  { kind: 'youtube', url: yt('UCsMica-v34Irf9KVTh6xx-g'), name: 'Microsoft Developer', weight: 1.1, lang: 'en' }, // @MicrosoftDeveloper
  { kind: 'youtube', url: yt('UCBtG00ljZ8R_DBQCTR4C00A'), name: '기술노트with 알렉', weight: 0.9, lang: 'ko' }, // @with2511
  { kind: 'youtube', url: yt('UCZgt6AzoyjslHTC9dz0UoTw'), name: 'ByteByteGo', weight: 1.0, lang: 'en' }, // @ByteByteGo
  { kind: 'youtube', url: yt('UCaYhcUwRBNscFNUKTjgPFiA'), name: 'Rust 유튜브', weight: 1.1, lang: 'en' }, // @RustVideos
  { kind: 'youtube', url: yt('UCwNwSGlLJNZTatOnE2t33tg'), name: '당근 팀', weight: 1.1, lang: 'ko' }, // @daangnteam
  { kind: 'youtube', url: yt('UC-mOekGSesms0agFntnQang'), name: '우아한테크', weight: 1.1, lang: 'ko' }, // @woowatech
];
