// 수집 출처. collect 단계가 시작할 때 sources 테이블에 upsert 한다(url 기준, active·실패 횟수는 건드리지 않는다).
// 2026-10-09(개발)·10-10(주식·부동산)에 모두 열어 보고 넣었다. 봇을 막는 곳(우아한형제들 403)은 넣지 않았다.
// weight: 출처 가중치(랭킹의 sourceWeight). 공식·큐레이션은 높게, 기사량이 많은 매체는 낮게.

export interface SourceSeed {
  kind: 'rss' | 'youtube' | 'hn';
  url: string;
  name: string;
  weight: number;
  lang: 'ko' | 'en';
}

const yt = (channelId: string) => `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

export const SOURCES: SourceSeed[] = [
  // 국내 큐레이션·매체
  { kind: 'rss', url: 'https://news.hada.io/rss/news', name: '긱뉴스', weight: 1.2, lang: 'ko' },
  { kind: 'rss', url: 'https://byline.network/feed/', name: '바이라인네트워크', weight: 0.9, lang: 'ko' },
  { kind: 'rss', url: 'https://www.aitimes.com/rss/allArticle.xml', name: 'AI타임스', weight: 0.8, lang: 'ko' },
  { kind: 'rss', url: 'https://feeds.feedburner.com/zdkorea', name: 'ZDNet Korea', weight: 0.8, lang: 'ko' },
  { kind: 'rss', url: 'https://www.bloter.net/rss/allArticle.xml', name: '블로터', weight: 0.8, lang: 'ko' },
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
  { kind: 'rss', url: 'https://www.yna.co.kr/rss/economy.xml', name: '연합뉴스 경제', weight: 0.9, lang: 'ko' },
  { kind: 'rss', url: 'https://kr.investing.com/rss/news.rss', name: '인베스팅닷컴', weight: 0.8, lang: 'ko' },
  { kind: 'rss', url: 'https://www.cnbc.com/id/15839069/device/rss/rss.html', name: 'CNBC', weight: 1.0, lang: 'en' },
  // 부동산(2026-10-10 추가)
  { kind: 'rss', url: 'https://www.hankyung.com/feed/realestate', name: '한국경제 부동산', weight: 1.0, lang: 'ko' },
  { kind: 'rss', url: 'https://www.mk.co.kr/rss/50300009/', name: '매일경제 부동산', weight: 0.9, lang: 'ko' },
  { kind: 'rss', url: 'http://rss.edaily.co.kr/realestate_news.xml', name: '이데일리 부동산', weight: 0.8, lang: 'ko' },
  // 유튜브 채널(채널 RSS는 가끔 500·404를 내서 몇 번 다시 시도한다)
  { kind: 'youtube', url: yt('UC_x5XG1OV2P6uZZ5FSM9Ttw'), name: 'Google for Developers', weight: 1.0, lang: 'en' },
  { kind: 'youtube', url: yt('UCQNE2JmbasNYbjGAcuBiRRg'), name: '조코딩', weight: 0.9, lang: 'ko' },
];
