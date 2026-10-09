import 'server-only';
import type { RankCandidate } from '@maengo/core/feed';

// 파이프라인(collect → summarize)이 만들었을 결과를 흉내 낸 데모 데이터.
// Supabase가 붙으면 clusters·summaries·cluster_topics 조회로 바뀐다.
// - short: 목록에 보이는 요약. body: 상세 화면의 전체 글(문단 단위, 우리 말로 다시 쓴 글).
// - 공식 문서는 실제 문서 주소와 발행처를 썼다. 그 밖의 블로그·채널·작성자는 데모용 예시이고 링크는 example.com이다.
// - DEMO_CLUSTERS는 오늘 피드 후보, ARCHIVE_CLUSTERS는 지난 피드(보관함)다.
// - why는 앞머리("RAG에 관심 있다면")를 뺀 본문만 둔다. 앞머리는 그 소식을 고른 토픽 이름으로 붙는다.

export interface DemoCluster {
  id: number;
  title: string;
  kind: 'article' | 'video';
  sourceLabel: string;
  /** 글쓴이 또는 유튜브 채널 */
  author: string;
  coverage?: string;
  url: string;
  ageHours: number;
  size: number;
  sourceWeight: number;
  topics: { topicId: string; relevance: number }[];
  short: string;
  body: string[];
  scenes?: { t: string; label: string }[];
  why: Record<string, string>;
}

const yt = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
const demo = (slug: string) => `https://example.com/blog/${slug}`;

export const DEMO_CLUSTERS: DemoCluster[] = [
  {
    id: 101,
    title: 'Gemini API, 유튜브 링크만으로 영상 요약',
    kind: 'article',
    sourceLabel: '공식 문서',
    author: 'Google AI for Developers',
    coverage: '긱뉴스 외 2곳에서도 다뤘어요',
    url: 'https://ai.google.dev/gemini-api/docs/video-understanding',
    ageHours: 10,
    size: 3,
    sourceWeight: 1.2,
    topics: [{ topicId: 'llm-dev', relevance: 0.9 }, { topicId: 'ai-tools', relevance: 0.6 }],
    short: '공개 영상 URL을 그대로 넣으면 자막을 따로 뽑지 않아도 내용을 요약하고 장면을 짚어 줍니다. 무료 티어는 하루 8시간까지, 유료 티어는 길이 제한이 없어요.',
    body: [
      'Gemini API는 공개된 유튜브 영상 주소를 입력으로 받아 영상 내용을 바로 이해할 수 있어요. 예전처럼 자막을 따로 내려받거나 음성을 글자로 바꾸는 단계를 거치지 않아도 됩니다.',
      '모델은 영상의 화면과 소리를 함께 읽어요. 그래서 발표 슬라이드나 화면에만 나오는 코드처럼 자막에는 없는 정보도 요약에 들어가고, 특정 장면을 시각과 함께 짚어 달라고 요청할 수도 있어요.',
      '다만 공개 영상만 넣을 수 있고, 무료 티어에는 하루에 처리할 수 있는 영상 길이 제한이 있어요. 해상도를 낮춰 처리하면 토큰을 크게 줄일 수 있어서, 긴 영상을 많이 다룰수록 이 설정이 비용을 좌우합니다.',
    ],
    why: {
      'llm-dev': '영상 요약 기능에서 자막 크롤러를 걷어낼 수 있어요.',
      'ai-tools': '강의 영상 정리를 사람 손 없이 돌릴 수 있어요.',
    },
  },
  {
    id: 102,
    title: '음성 합성도 프롬프트로, Gemini TTS',
    kind: 'article',
    sourceLabel: '공식 문서',
    author: 'Google AI for Developers',
    coverage: 'Hacker News에서도 다뤘어요',
    url: 'https://ai.google.dev/gemini-api/docs/speech-generation',
    ageHours: 14,
    size: 2,
    sourceWeight: 1.2,
    topics: [{ topicId: 'speech-ai', relevance: 0.9 }, { topicId: 'ai-tools', relevance: 0.6 }, { topicId: 'llm-dev', relevance: 0.5 }],
    short: '30개 넘는 목소리 중에서 고르고, 말투와 속도와 감정을 문장으로 지시합니다. 두 사람이 나누는 대화도 한 번에 만들어요.',
    body: [
      'Gemini API의 음성 생성 기능은 글을 목소리로 바꿔 줍니다. 미리 준비된 30개가 넘는 목소리 가운데 하나를 고르고, 어떤 말투로 읽을지는 문장으로 지시해요.',
      '스타일 지시는 "차분한 선생님처럼", "조금 빠르고 밝게"처럼 평소 말로 적으면 됩니다. 대화형 콘텐츠를 만들 때는 두 화자에게 각각 다른 목소리를 정해 한 번에 대화를 만들 수 있어요.',
      '결과는 PCM 오디오로 나오기 때문에 웹이나 팟캐스트에 쓰려면 MP3 같은 형식으로 바꿔야 해요. 같은 문장을 반복해서 만들면 비용이 쌓이니, 한 번 만든 음성은 저장해 두고 다시 쓰는 구조가 좋습니다.',
    ],
    why: {
      'speech-ai': '녹음 없이 팟캐스트형 콘텐츠를 만들 수 있어요.',
      'llm-dev': '텍스트 응답을 음성으로 바꾸는 기능을 따로 TTS 업체 없이 붙일 수 있어요.',
      'ai-tools': '교육 영상 내레이션을 직접 녹음하지 않아도 돼요.',
    },
  },
  {
    id: 103,
    title: '에이전트 평가, 정답셋 없이 시작하는 법',
    kind: 'video',
    sourceLabel: '유튜브',
    author: 'AI 엔지니어링 라이브',
    coverage: '영상 요약',
    url: yt('LLM agent evaluation without golden dataset'),
    ageHours: 8,
    size: 1,
    sourceWeight: 1,
    topics: [{ topicId: 'llm-agent', relevance: 0.9 }, { topicId: 'rag', relevance: 0.5 }],
    short: '실서비스 로그에서 실패한 대화를 모아 평가셋의 씨앗으로 삼고, 사람이 고친 답을 기준으로 회귀 테스트를 돌리는 흐름을 보여 줍니다.',
    body: [
      '에이전트를 만들고 나면 "이번 수정으로 더 나아졌나"를 판단하기가 어려워요. 이 영상은 정답셋을 처음부터 완벽하게 만들려다 멈추는 대신, 실서비스에서 실패한 대화부터 모으라고 말합니다.',
      '실패 사례를 유형별로 묶고 우선순위를 정한 다음, 사람이 고친 답을 정답으로 쌓아 가요. 이렇게 모인 수십 개의 사례가 첫 평가셋이 되고, 시간이 지날수록 자연스럽게 늘어납니다.',
      '마지막으로 배포 전에 이 평가셋을 자동으로 돌리고, 점수가 떨어지면 배포를 막는 순서를 실제 화면으로 보여 줘요. 정답셋이 없어서 평가를 미루고 있었다면 오늘 바로 시작할 수 있는 방법입니다.',
    ],
    scenes: [
      { t: '1:12', label: '실패 로그를 평가셋으로 바꾸는 기준' },
      { t: '6:40', label: '사람이 고친 답을 정답으로 쓰는 법' },
      { t: '14:05', label: '배포 전 회귀 테스트에 붙이는 순서' },
    ],
    why: {
      'llm-agent': '지금 만드는 에이전트의 회귀 테스트에 바로 쓸 수 있어요.',
      rag: 'RAG 챗봇 답변 품질을 배포할 때마다 확인할 수 있어요.',
    },
  },
  {
    id: 104,
    title: '안 쓰이는 PostgreSQL 인덱스, 통계 뷰로 찾기',
    kind: 'article',
    sourceLabel: '공식 문서',
    author: 'PostgreSQL 문서',
    coverage: 'Hacker News 외 1곳에서도 다뤘어요',
    url: 'https://www.postgresql.org/docs/current/monitoring-stats.html',
    ageHours: 20,
    size: 2,
    sourceWeight: 1,
    topics: [{ topicId: 'postgres', relevance: 0.9 }, { topicId: 'database', relevance: 0.8 }, { topicId: 'backend-perf', relevance: 0.7 }],
    short: '통계 뷰에서 스캔 횟수가 0인 인덱스를 골라내고, 지우기 전에 확인할 것들을 정리했어요. 인덱스가 많을수록 쓰기가 느려지는 이유도 함께 설명합니다.',
    body: [
      '인덱스는 읽기를 빠르게 해 주지만, 데이터를 쓸 때마다 함께 갱신해야 해서 쓰기를 느리게 만들어요. 그래서 쓰이지 않는 인덱스는 비용만 남깁니다.',
      'PostgreSQL의 pg_stat_user_indexes 뷰에서 idx_scan 값이 0인 인덱스를 찾으면 한동안 한 번도 쓰이지 않은 인덱스를 골라낼 수 있어요. 인덱스 크기와 함께 보면 무엇부터 정리할지 순서도 정할 수 있습니다.',
      '다만 지우기 전에 확인할 것이 있어요. 통계가 초기화된 지 얼마 안 됐거나 복제본에서만 쓰는 인덱스일 수 있고, 유니크 제약을 지키는 인덱스는 스캔이 없어도 지우면 안 됩니다.',
    ],
    why: {
      'backend-perf': '쓰기가 느려진 테이블부터 점검해 볼 수 있어요.',
      database: '운영 DB의 인덱스 정리 기준으로 그대로 쓸 수 있어요.',
      postgres: '이번 주 점검 쿼리 목록에 바로 넣을 수 있어요.',
    },
  },
  {
    id: 105,
    title: '긴 시스템 프롬프트, 캐싱으로 비용 줄이는 설계',
    kind: 'article',
    sourceLabel: '공식 문서',
    author: 'Google AI for Developers',
    url: 'https://ai.google.dev/gemini-api/docs/caching',
    ageHours: 16,
    size: 1,
    sourceWeight: 1,
    topics: [{ topicId: 'prompt', relevance: 0.8 }, { topicId: 'llm-dev', relevance: 0.8 }, { topicId: 'llm-agent', relevance: 0.4 }, { topicId: 'backend-perf', relevance: 0.4 }],
    short: '바뀌지 않는 앞부분을 고정해 두고 바뀌는 입력은 뒤로 미루는 프롬프트 구조를 예시와 함께 보여 줍니다. 캐시가 깨지는 흔한 실수도 정리했어요.',
    body: [
      'LLM API를 부를 때마다 같은 시스템 프롬프트와 문서를 보낸다면, 그 부분을 캐시해 두고 다시 쓸 수 있어요. 캐시된 입력은 더 싸게 계산되고 응답도 빨라집니다.',
      '핵심은 순서예요. 도구 정의와 예시처럼 바뀌지 않는 내용을 앞에 두고, 대화와 사용자 입력처럼 매번 바뀌는 내용을 뒤에 둬야 앞부분이 그대로 재사용됩니다.',
      '흔한 실수는 시스템 프롬프트 맨 앞에 오늘 날짜나 사용자 이름을 넣는 거예요. 이런 값이 하나만 바뀌어도 그 뒤 전체가 새 입력으로 계산되니, 바뀌는 값은 꼭 뒤로 보내세요.',
    ],
    why: {
      'llm-dev': '매 요청마다 같은 문서를 붙이는 API에 바로 적용할 수 있어요.',
      'llm-agent': '에이전트가 도구 정의를 매번 다시 읽는 비용을 줄일 수 있어요.',
      prompt: '지금 프롬프트에서 캐시를 깨는 줄부터 찾아볼 수 있어요.',
      'backend-perf': '첫 토큰까지 걸리는 시간도 같이 줄어요.',
    },
  },
  {
    id: 106,
    title: 'RAG 검색 품질, 청크 크기보다 먼저 볼 것',
    kind: 'article',
    sourceLabel: '기술블로그',
    author: '박서연',
    coverage: '긱뉴스에서도 다뤘어요',
    url: demo('rag-retrieval-quality'),
    ageHours: 30,
    size: 2,
    sourceWeight: 1,
    topics: [{ topicId: 'rag', relevance: 0.9 }, { topicId: 'llm-dev', relevance: 0.4 }],
    short: '검색이 엉뚱한 문서를 가져올 때 청크 크기부터 바꾸기 쉽지만, 대부분은 질문과 문서의 표현 차이에서 생긴다고 짚어요. 질문을 다시 쓰고 키워드 검색을 섞는 방법을 비교합니다.',
    body: [
      'RAG 챗봇이 엉뚱한 문서를 가져오면 청크 크기부터 바꾸기 쉬워요. 하지만 이 글은 문제 대부분이 질문과 문서의 표현 차이에서 생긴다고 말합니다.',
      '사용자는 "환불 언제 돼요?"라고 묻는데 문서에는 "결제 취소 처리 기간"이라고 적혀 있으면 임베딩 검색이 놓치기 쉬워요. 글쓴이는 같은 데이터로 키워드 검색 섞기, 질문을 문서 말투로 바꿔 쓰기, 재정렬 모델 붙이기를 차례로 비교했습니다.',
      '평가 질문 50개만 있어도 어떤 방법이 효과가 있는지 분명하게 보였다고 해요. 청크 크기는 그다음에 조정해도 늦지 않다는 게 결론입니다.',
    ],
    why: {
      rag: '검색 결과가 엉뚱할 때 어디부터 손댈지 정할 수 있어요.',
      'llm-dev': '문서 검색이 붙은 기능의 답변 품질을 올리는 순서를 잡을 수 있어요.',
    },
  },
  {
    id: 107,
    title: '쿠버네티스 파드가 OOMKilled 될 때 먼저 볼 지표',
    kind: 'article',
    sourceLabel: '공식 문서',
    author: 'Kubernetes 문서',
    url: 'https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/',
    ageHours: 22,
    size: 1,
    sourceWeight: 1,
    topics: [{ topicId: 'kubernetes', relevance: 0.9 }, { topicId: 'observability', relevance: 0.6 }, { topicId: 'backend-perf', relevance: 0.3 }],
    short: '메모리 요청값과 한도를 어떻게 잡았는지, 컨테이너가 실제로 쓴 메모리가 어디서 늘었는지 순서대로 확인하는 방법이에요.',
    body: [
      '파드가 OOMKilled로 재시작되면 메모리 한도를 올리는 것부터 떠올리기 쉬워요. 하지만 원인을 모른 채 한도만 올리면 같은 일이 노드 전체로 번질 수 있습니다.',
      '먼저 컨테이너에 설정한 메모리 요청값과 한도를 확인하고, 실제 사용량이 어디서 늘었는지 봐야 해요. JVM이나 Node.js는 힙 밖에서 쓰는 메모리가 꽤 커서 힙 크기만 보면 놓치기 쉽습니다.',
      '한도에 닿기 전에 알림이 오도록 기준을 잡아 두면 재시작이 일어나기 전에 대응할 수 있어요. 요청값과 한도의 차이가 너무 크면 스케줄링도 불안정해진다는 점도 함께 기억하세요.',
    ],
    why: {
      kubernetes: '재시작이 잦은 파드부터 원인을 좁힐 수 있어요.',
      observability: '메모리 알림 기준을 다시 잡을 근거가 생겨요.',
      'backend-perf': '갑자기 느려지는 API가 메모리 때문인지 가려낼 수 있어요.',
    },
  },
  {
    id: 108,
    title: 'React 서버 컴포넌트, 데이터 가져오기 패턴 정리',
    kind: 'article',
    sourceLabel: '공식 문서',
    author: 'React 문서',
    coverage: '긱뉴스에서도 다뤘어요',
    url: 'https://react.dev/reference/rsc/server-components',
    ageHours: 12,
    size: 2,
    sourceWeight: 1.2,
    topics: [{ topicId: 'react', relevance: 0.9 }, { topicId: 'web-perf', relevance: 0.4 }],
    short: '서버 컴포넌트에서 데이터를 가져올 때 요청이 줄줄이 이어지는 경우와 한꺼번에 보내는 경우를 비교합니다. 로딩 화면을 어디에 둘지도 함께 정리했어요.',
    body: [
      '서버 컴포넌트는 서버에서 데이터를 가져와 바로 화면을 그릴 수 있어요. 그런데 부모가 데이터를 기다린 뒤에야 자식이 요청을 시작하면, 요청이 줄줄이 이어져 화면이 늦게 뜹니다.',
      '필요한 요청을 위쪽에서 한꺼번에 시작하고, 결과가 늦게 오는 부분만 Suspense로 감싸면 나머지 화면을 먼저 보여 줄 수 있어요. 사용자는 기다리는 동안에도 내용을 읽기 시작합니다.',
      '로딩 화면을 어디에 둘지도 중요해요. 너무 위에 두면 페이지 전체가 비어 보이고, 너무 잘게 나누면 화면이 여러 번 깜빡입니다. 사용자가 먼저 보는 영역을 기준으로 경계를 정하세요.',
    ],
    why: {
      react: '느린 페이지에서 요청이 줄줄이 이어지는 곳을 찾을 수 있어요.',
      'web-perf': '첫 화면이 늦게 뜨는 원인 중 하나를 바로 확인할 수 있어요.',
    },
  },
  {
    id: 109,
    title: '한글 웹 폰트 때문에 늦어지는 첫 화면 줄이기',
    kind: 'article',
    sourceLabel: '기술블로그',
    author: '정우진',
    url: demo('korean-webfont-performance'),
    ageHours: 26,
    size: 1,
    sourceWeight: 1,
    topics: [{ topicId: 'web-perf', relevance: 0.9 }, { topicId: 'design-system', relevance: 0.3 }],
    short: '한글 폰트는 글자 수가 많아 파일이 커요. 쓰는 글자만 잘라 내는 서브셋과 글자 범위별로 나눠 받는 방법을 비교합니다.',
    body: [
      '한글 폰트는 글자 수가 많아 파일이 수 메가바이트까지 커져요. 이 파일을 다 받을 때까지 글자가 안 보이면 첫 화면이 늦게 뜬 것처럼 느껴집니다.',
      '방법은 두 가지예요. 실제로 쓰는 글자만 잘라 내는 서브셋, 그리고 글자 범위별로 파일을 나눠 필요한 조각만 받게 하는 방식이에요. 글쓴이는 본문 폰트는 범위별로 나누고, 제목처럼 쓰는 글자가 정해진 곳만 서브셋을 만드는 조합을 추천합니다.',
      '폰트가 늦게 와도 기본 글꼴로 먼저 보여 주도록 font-display를 설정하는 것도 잊지 마세요. 글자가 바뀌며 화면이 밀리지 않게 대체 글꼴의 크기를 맞추는 방법도 소개합니다.',
    ],
    why: {
      'web-perf': '첫 화면 지표가 나쁜 페이지에서 폰트부터 확인해 볼 수 있어요.',
      'design-system': '디자인 시스템 폰트 설정을 다시 볼 때 기준으로 쓸 수 있어요.',
    },
  },
  {
    id: 110,
    title: '의존성 하나가 공급망 공격 통로가 되는 과정',
    kind: 'video',
    sourceLabel: '유튜브',
    author: '보안 브리핑',
    coverage: '영상 요약',
    url: yt('software supply chain attack dependency'),
    ageHours: 18,
    size: 1,
    sourceWeight: 1,
    topics: [{ topicId: 'security', relevance: 0.9 }, { topicId: 'kubernetes', relevance: 0.2 }],
    short: '널리 쓰이는 패키지의 관리자 계정이 넘어가면서 악성 코드가 배포되는 과정을 처음부터 따라갑니다. 잠금 파일과 설치 스크립트 차단이 어디서 막아 주는지 보여 줘요.',
    body: [
      '널리 쓰이는 패키지의 관리자 계정이 넘어가면, 공격자는 정상 버전처럼 보이는 새 버전을 올릴 수 있어요. 이 영상은 그 과정이 실제로 어떻게 퍼지는지 처음부터 따라갑니다.',
      '버전 범위를 넓게 열어 둔 프로젝트는 새 버전이 나오자마자 그대로 받아 가요. 설치할 때 자동으로 실행되는 스크립트가 있다면 개발자 PC와 CI 서버에서 바로 코드가 돌게 됩니다.',
      '잠금 파일로 버전을 고정하고, 설치 스크립트 실행을 막고, 의존성 변경을 코드 리뷰에서 따로 확인하는 습관이 각각 어디서 피해를 막는지 정리해 줘요.',
    ],
    scenes: [
      { t: '0:48', label: '관리자 계정이 넘어간 첫 신호' },
      { t: '7:30', label: '설치 스크립트가 하는 일' },
      { t: '12:10', label: '잠금 파일로 막을 수 있는 것과 없는 것' },
    ],
    why: {
      security: '우리 저장소의 설치 스크립트 설정부터 점검해 볼 수 있어요.',
      kubernetes: '빌드 이미지에 들어가는 패키지를 다시 볼 이유가 돼요.',
    },
  },
  {
    id: 111,
    title: '데이터 파이프라인, 다시 돌려도 결과가 같게 만드는 법',
    kind: 'article',
    sourceLabel: '기술블로그',
    author: '한지민',
    url: demo('idempotent-data-pipeline'),
    ageHours: 34,
    size: 1,
    sourceWeight: 1,
    topics: [{ topicId: 'data-eng', relevance: 0.9 }, { topicId: 'database', relevance: 0.4 }, { topicId: 'backend-perf', relevance: 0.2 }],
    short: '실패한 배치를 다시 돌렸더니 데이터가 두 번 들어가는 문제를 날짜 키와 덮어쓰기로 막는 방법이에요. 늦게 도착한 데이터를 다루는 기준도 정리했어요.',
    body: [
      '배치가 중간에 실패해 다시 돌렸더니 데이터가 두 번 들어간 경험이 있다면, 파이프라인이 멱등하지 않은 거예요. 몇 번을 다시 돌려도 결과가 같아야 안심하고 재실행할 수 있습니다.',
      '글쓴이는 단계마다 "이미 있으면 건너뛴다"를 지키고, 날짜 단위로 통째로 지우고 다시 쓰는 방식을 기본으로 삼으라고 해요. 행 단위로 덧붙이는 방식보다 단순하고 실수가 적습니다.',
      '외부 API를 부르는 단계는 결과를 저장해 두고 재실행 때 다시 부르지 않게 해야 비용과 속도를 모두 지킬 수 있어요. 늦게 도착한 데이터를 어느 날짜에 넣을지도 미리 정해 두라고 권합니다.',
    ],
    why: {
      'data-eng': '재실행이 무서운 배치부터 고칠 순서를 잡을 수 있어요.',
      database: '중복 적재를 DB 제약으로 막는 방법을 같이 볼 수 있어요.',
      'backend-perf': '배치 재실행 시간을 줄이는 데도 도움이 돼요.',
    },
  },
  {
    id: 112,
    title: '디자인 토큰을 코드와 피그마에서 같이 쓰기',
    kind: 'article',
    sourceLabel: '기술블로그',
    author: '오세린',
    url: demo('design-tokens-figma-code'),
    ageHours: 28,
    size: 1,
    sourceWeight: 1,
    topics: [{ topicId: 'design-system', relevance: 0.9 }, { topicId: 'react', relevance: 0.3 }],
    short: '색과 간격 값을 한곳에 두고 피그마 변수와 CSS 변수로 함께 내보내는 구조를 보여 줍니다. 이름을 쓰임새로 짓는 규칙이 핵심이에요.',
    body: [
      '색과 간격 값을 피그마와 코드에 따로 적어 두면 금방 서로 달라져요. 이 글은 값을 한곳에 두고 피그마 변수와 CSS 변수로 함께 내보내는 구조를 보여 줍니다.',
      '핵심은 이름이에요. "파랑 500" 대신 "강조 배경"처럼 쓰임새로 이름을 지으면, 다크 모드나 브랜드 색을 바꿀 때 컴포넌트는 그대로 두고 값만 바꾸면 됩니다.',
      '토큰 변경을 코드 리뷰로 받는 흐름도 소개해요. 디자이너가 값을 바꾸면 자동으로 변경 요청이 만들어지고, 개발자는 어떤 화면이 바뀌는지 미리 확인할 수 있습니다.',
    ],
    why: {
      'design-system': '지금 쓰는 색 이름부터 쓰임새 기준으로 정리해 볼 수 있어요.',
      react: '컴포넌트 스타일에서 하드코딩된 색을 걷어낼 수 있어요.',
    },
  },
  {
    id: 113,
    title: '기능 우선순위, 임팩트와 노력 매트릭스의 함정',
    kind: 'video',
    sourceLabel: '유튜브',
    author: '프로덕트 토크',
    coverage: '영상 요약',
    url: yt('impact effort matrix pitfalls product management'),
    ageHours: 40,
    size: 1,
    sourceWeight: 1,
    topics: [{ topicId: 'product', relevance: 0.9 }, { topicId: 'growth', relevance: 0.3 }],
    short: '네 칸 매트릭스에 기능을 놓으면 모든 게 "임팩트 큼"으로 몰리는 이유를 짚어요. 숫자로 근거를 붙이는 간단한 방법을 제안합니다.',
    body: [
      '임팩트와 노력으로 나눈 네 칸 매트릭스는 우선순위를 정할 때 자주 쓰여요. 그런데 막상 해 보면 모든 기능이 "임팩트 큼, 노력 작음" 칸으로 몰립니다.',
      '영상은 그 이유를 근거 없이 감으로 점수를 매기기 때문이라고 짚어요. 임팩트를 "몇 명이, 얼마나 자주 겪는 문제인가"로 쪼개 적고, 노력은 개발자가 직접 적게 하면 점수가 훨씬 현실적이 됩니다.',
      '매트릭스는 결론이 아니라 대화를 시작하는 도구라는 점도 강조해요. 점수가 비슷한 기능끼리는 고객 인터뷰나 작은 실험으로 결정하는 편이 낫다고 말합니다.',
    ],
    scenes: [
      { t: '2:05', label: '모든 기능이 오른쪽 위로 몰리는 이유' },
      { t: '9:20', label: '임팩트를 숫자로 쪼개 적는 법' },
    ],
    why: {
      product: '다음 분기 우선순위 회의 자료를 바로 고쳐 볼 수 있어요.',
      growth: '실험 후보를 고를 때도 같은 기준을 쓸 수 있어요.',
    },
  },
  {
    id: 114,
    title: '모바일 앱 첫 실행 시간 줄이는 체크리스트',
    kind: 'article',
    sourceLabel: '공식 문서',
    author: 'Android Developers',
    url: 'https://developer.android.com/topic/performance/vitals/launch-time',
    ageHours: 24,
    size: 1,
    sourceWeight: 1,
    topics: [{ topicId: 'mobile-app', relevance: 0.9 }, { topicId: 'web-perf', relevance: 0.2 }],
    short: '앱을 켜고 첫 화면이 뜨기까지 무엇이 시간을 잡아먹는지 재는 법과 줄이는 순서를 정리했어요. 초기화 코드를 미루는 것만으로도 차이가 커요.',
    body: [
      '앱을 켰을 때 첫 화면이 늦게 뜨면 사용자는 앱이 느리다고 느껴요. 먼저 앱 시작부터 첫 화면이 그려질 때까지 걸리는 시간을 재고, 어느 구간이 오래 걸리는지 나눠 봐야 합니다.',
      '가장 흔한 원인은 앱이 시작될 때 여러 SDK를 한꺼번에 초기화하는 거예요. 분석이나 광고 SDK처럼 첫 화면에 필요 없는 것은 화면이 뜬 뒤로 미루면 차이가 큽니다.',
      '첫 화면에 꼭 필요한 데이터만 먼저 불러오고, 나머지는 사용자가 화면을 보는 동안 가져오세요. 개선한 뒤에는 실제 기기에서 다시 재서 숫자로 확인하는 것이 중요합니다.',
    ],
    why: {
      'mobile-app': '앱 시작 코드에서 미룰 수 있는 초기화부터 찾아볼 수 있어요.',
      'web-perf': '웹뷰를 쓰는 화면에도 같은 순서를 적용할 수 있어요.',
    },
  },
  {
    id: 115,
    title: '로그 대신 트레이스로 느린 API 찾기',
    kind: 'video',
    sourceLabel: '유튜브',
    author: '백엔드 라이브',
    coverage: '영상 요약',
    url: yt('distributed tracing find slow api'),
    ageHours: 32,
    size: 1,
    sourceWeight: 1,
    topics: [{ topicId: 'observability', relevance: 0.9 }, { topicId: 'backend-perf', relevance: 0.7 }],
    short: '로그를 뒤지는 대신 요청 하나가 거쳐 간 길을 시간순으로 펼쳐 보는 방법이에요. 느린 구간이 DB인지 외부 API인지 한눈에 보입니다.',
    body: [
      '느린 API를 찾으려고 로그를 뒤지다 보면 요청 하나가 어디서 시간을 썼는지 맞추기 어려워요. 이 영상은 트레이스로 요청 하나의 경로를 시간순으로 펼쳐 보는 방법을 보여 줍니다.',
      '트레이스를 보면 전체 응답 시간 가운데 DB 쿼리, 외부 API 호출, 서비스 내부 처리가 각각 얼마를 차지하는지 한눈에 보여요. 서비스 사이에 추적 ID를 넘기는 설정이 첫걸음입니다.',
      '모든 요청을 저장하면 비용이 커지니, 느리거나 실패한 요청만 골라 남기는 샘플링 설정도 다뤄요. 대시보드에서 먼저 볼 그래프 순서까지 알려 줍니다.',
    ],
    scenes: [
      { t: '3:30', label: '요청 하나를 시간순으로 펼쳐 보기' },
      { t: '11:45', label: '느린 요청만 남기는 샘플링' },
    ],
    why: {
      observability: '지금 쓰는 모니터링에 트레이스를 더할 근거가 돼요.',
      'backend-perf': '가장 느린 API 하나를 골라 바로 따라가 볼 수 있어요.',
    },
  },
  {
    id: 116,
    title: '구조화된 출력으로 LLM 응답을 JSON 스키마에 맞추기',
    kind: 'article',
    sourceLabel: '공식 문서',
    author: 'Google AI for Developers',
    coverage: '긱뉴스에서도 다뤘어요',
    url: 'https://ai.google.dev/gemini-api/docs/structured-output',
    ageHours: 44,
    size: 2,
    sourceWeight: 1.2,
    topics: [{ topicId: 'llm-dev', relevance: 0.8 }, { topicId: 'llm-agent', relevance: 0.5 }, { topicId: 'backend-perf', relevance: 0.2 }],
    short: '응답 형식을 JSON 스키마로 지정하면 파싱 실패와 재시도 코드를 크게 줄일 수 있어요. 스키마를 너무 깊게 만들면 생기는 문제도 다룹니다.',
    body: [
      'LLM 응답을 프로그램에서 쓰려면 정해진 형식이 필요해요. 응답 형식을 JSON 스키마로 지정하면 모델이 그 구조에 맞춰 답하므로, 파싱 실패와 재시도 코드를 크게 줄일 수 있습니다.',
      '필드 설명을 스키마 안에 적어 두면 프롬프트가 짧아지고, 선택 필드는 꼭 필요한 것만 두는 편이 좋아요. 스키마가 너무 깊고 복잡하면 오히려 응답 품질이 떨어질 수 있습니다.',
      '형식을 지정해도 모델이 답을 거절하거나 응답이 중간에 끊기는 경우는 생겨요. 이런 경우를 따로 확인하고 처리하는 코드를 함께 두라고 권합니다.',
    ],
    why: {
      'llm-dev': 'LLM 응답을 정규식으로 파싱하던 코드를 걷어낼 수 있어요.',
      'llm-agent': '도구 호출 인자가 깨지는 문제를 줄일 수 있어요.',
      'backend-perf': '재시도 호출이 줄어 응답 시간도 짧아져요.',
    },
  },
  {
    id: 117,
    title: 'AI 코딩 도구, 팀에 들일 때 먼저 정할 규칙',
    kind: 'article',
    sourceLabel: '뉴스레터',
    author: '최유나',
    coverage: '긱뉴스 외 2곳에서도 다뤘어요',
    url: demo('ai-coding-tools-team-rules'),
    ageHours: 36,
    size: 3,
    sourceWeight: 0.9,
    topics: [{ topicId: 'ai-tools', relevance: 0.9 }, { topicId: 'product', relevance: 0.3 }],
    short: '코드 리뷰 기준, 비밀값을 다루는 규칙, 생성된 코드의 책임을 누가 지는지부터 정하라고 조언해요. 도구 선택은 그다음이라는 이야기예요.',
    body: [
      'AI 코딩 도구를 팀에 들일 때 어떤 도구를 쓸지부터 고르기 쉬워요. 이 글은 그보다 먼저 정해야 할 규칙이 있다고 말합니다.',
      '생성된 코드도 사람이 쓴 코드와 같은 리뷰를 거치게 하고, 비밀값과 고객 데이터를 도구에 넘기지 않는 규칙, 생성된 코드의 책임을 누가 지는지를 먼저 문서로 남기라는 거예요.',
      '이런 규칙을 먼저 정한 팀이 도입 뒤에 문제가 적었다고 해요. 도입 효과를 무엇으로 잴지, 예를 들어 리뷰 시간이나 배포 횟수를 미리 정해 두라는 조언도 덧붙입니다.',
    ],
    why: {
      'ai-tools': '팀 규칙 문서에 바로 옮길 항목을 얻을 수 있어요.',
      product: '도입 효과를 무엇으로 잴지 정하는 데 참고할 수 있어요.',
    },
  },
  {
    id: 118,
    title: '퍼널 분석, 이탈 구간을 잘못 읽는 세 가지 경우',
    kind: 'article',
    sourceLabel: '기술블로그',
    author: '윤도현',
    url: demo('funnel-analysis-pitfalls'),
    ageHours: 38,
    size: 1,
    sourceWeight: 1,
    topics: [{ topicId: 'growth', relevance: 0.9 }, { topicId: 'product', relevance: 0.4 }],
    short: '단계 사이 이탈률만 보면 원인을 엉뚱한 화면에서 찾기 쉬워요. 기간 설정, 중복 집계, 다시 돌아온 사용자를 어떻게 셀지에 따라 결론이 바뀌는 예를 보여 줍니다.',
    body: [
      '퍼널에서 단계 사이 이탈률만 보면 원인을 엉뚱한 화면에서 찾기 쉬워요. 이 글은 같은 데이터로도 집계 기준에 따라 결론이 바뀌는 예를 보여 줍니다.',
      '"7일 안에 다음 단계로 간 사람"과 "언젠가 간 사람"은 전혀 다른 숫자가 나와요. 한 사람이 여러 번 들어온 경우를 어떻게 셀지, 다시 돌아온 사용자를 새 사용자로 볼지도 결과를 크게 바꿉니다.',
      '글쓴이는 대시보드에 집계 기준을 함께 적어 두라고 권해요. 팀원마다 다른 숫자를 들고 회의에 들어오는 일을 막을 수 있습니다.',
    ],
    why: {
      growth: '지금 보는 퍼널 대시보드의 기준부터 확인해 볼 수 있어요.',
      product: '이탈 원인을 두고 팀이 다른 숫자를 보는 일을 줄일 수 있어요.',
    },
  },
];

/**
 * 지난 피드(보관함) 데모. 데모 계정은 어제까지 무료였다고 보고 하루 1개씩 14일 치를 둔다.
 * daysAgo = 며칠 전 피드에 들어갔는지, topicId = 그날 why 문구를 고른 토픽.
 */
export interface ArchiveCluster extends DemoCluster {
  daysAgo: number;
  topicId: string;
}

const archive = (a: Omit<ArchiveCluster, 'ageHours' | 'size' | 'sourceWeight' | 'topics'> & { topics?: DemoCluster['topics'] }): ArchiveCluster => ({
  ...a,
  ageHours: a.daysAgo * 24 + 5,
  size: 1,
  sourceWeight: 1,
  topics: a.topics ?? [{ topicId: a.topicId, relevance: 0.9 }],
});

export const ARCHIVE_CLUSTERS: ArchiveCluster[] = [
  archive({
    id: 201, daysAgo: 1, topicId: 'llm-dev',
    title: 'LLM 응답이 느릴 때, 스트리밍으로 체감 속도 높이기',
    kind: 'article', sourceLabel: '기술블로그', author: '김민준', url: demo('llm-streaming-latency'),
    short: '전체 답이 끝날 때까지 기다리지 않고 만들어지는 대로 보여 주면, 같은 응답 시간도 훨씬 빠르게 느껴져요. 스트리밍을 붙일 때 생기는 문제도 정리했어요.',
    body: [
      'LLM 응답은 길수록 오래 걸려요. 전체 답을 다 받은 뒤 화면에 보여 주면 사용자는 그동안 빈 화면을 봐야 합니다. 만들어지는 대로 조금씩 보여 주는 스트리밍을 쓰면 첫 글자가 뜨는 시간이 짧아져 훨씬 빠르게 느껴져요.',
      '대신 중간에 연결이 끊기거나, 응답이 형식에 맞는지 끝까지 받아 봐야 아는 경우를 따로 처리해야 해요. 글쓴이는 화면에는 스트리밍으로 보여 주고, 저장과 후처리는 전체 응답을 받은 뒤에 하는 구조를 추천합니다.',
    ],
    why: { 'llm-dev': '응답이 긴 기능부터 스트리밍으로 바꿔 볼 수 있어요.' },
  }),
  archive({
    id: 202, daysAgo: 2, topicId: 'database',
    title: 'PostgreSQL 커넥션 풀, 크기를 얼마로 잡을까',
    kind: 'article', sourceLabel: '기술블로그', author: '이수아', url: demo('postgres-connection-pool'),
    short: '커넥션을 많이 열수록 빨라질 것 같지만, 서버 코어 수를 넘어서면 오히려 느려져요. 서버 수와 DB 한도를 같이 보고 풀 크기를 정하는 방법이에요.',
    body: [
      '애플리케이션 서버가 늘어날 때마다 커넥션 풀을 그대로 두면, 데이터베이스가 감당할 수 있는 커넥션 수를 금방 넘어요. 커넥션이 너무 많으면 DB는 문맥 전환에 시간을 써서 전체 처리량이 떨어집니다.',
      '글쓴이는 서버 한 대의 풀 크기를 정할 때 DB의 최대 커넥션을 서버 수로 나누고, 여유분을 남기라고 해요. 서버 수가 자주 바뀐다면 앞단에 커넥션 프록시를 두는 편이 관리하기 쉽습니다.',
    ],
    why: { database: '서버를 늘릴 때마다 커넥션 한도를 넘기던 문제를 미리 막을 수 있어요.' },
  }),
  archive({
    id: 203, daysAgo: 3, topicId: 'rag',
    title: '임베딩 모델을 바꿀 때 벡터를 다시 만드는 순서',
    kind: 'article', sourceLabel: '기술블로그', author: '박서연', url: demo('reembedding-migration'),
    short: '임베딩 모델을 바꾸면 기존 벡터와 새 벡터를 섞어 쓸 수 없어요. 서비스를 멈추지 않고 벡터를 다시 만드는 순서를 정리했어요.',
    body: [
      '임베딩 모델마다 벡터 공간이 달라서, 모델을 바꾸면 기존 문서 벡터를 전부 새로 만들어야 해요. 새 모델로 만든 질문 벡터를 옛 문서 벡터와 비교하면 검색 결과가 엉망이 됩니다.',
      '글쓴이는 새 벡터를 별도 컬럼이나 인덱스에 쌓고, 다 채운 뒤 검색 쪽을 한 번에 바꾸라고 해요. 바꾸기 전에 평가 질문으로 두 모델의 검색 품질을 비교해 두면 되돌릴지 판단하기도 쉽습니다.',
    ],
    why: { rag: '임베딩 모델을 바꿀 때 검색이 깨지는 기간을 없앨 수 있어요.' },
  }),
  archive({
    id: 204, daysAgo: 4, topicId: 'career',
    title: '백엔드 면접에서 자주 나오는 시스템 설계 질문',
    kind: 'article', sourceLabel: '뉴스레터', author: '최준호', url: demo('backend-interview-system-design'),
    short: '이직을 준비하는 시니어 백엔드 개발자에게 자주 묻는 시스템 설계 질문과, 면접관이 실제로 보는 부분을 정리했어요.',
    body: [
      '시스템 설계 면접은 정답을 맞히는 자리가 아니에요. 면접관은 요구 사항을 어떻게 좁히는지, 병목을 어디로 보는지, 그리고 무엇을 포기하는지 설명하는 과정을 봅니다.',
      '자주 나오는 질문은 URL 단축기, 알림 발송, 피드 만들기 같은 주제예요. 글쓴이는 숫자로 규모를 먼저 어림하고, 처음에는 단순한 구조로 시작해 점점 확장하는 순서로 답하라고 권합니다.',
    ],
    why: { career: '이직 준비를 시작했다면 연습할 질문 목록으로 바로 쓸 수 있어요.' },
  }),
  archive({
    id: 205, daysAgo: 5, topicId: 'backend-perf',
    title: 'API 레이트 리밋, 토큰 버킷으로 직접 만들기',
    kind: 'video', sourceLabel: '유튜브', author: '백엔드 라이브', coverage: '영상 요약', url: yt('token bucket rate limiting api'),
    short: '요청이 몰릴 때 서버를 지키는 레이트 리밋을 토큰 버킷 방식으로 직접 구현해 봅니다. 여러 서버에서 같은 한도를 지키는 방법도 다뤄요.',
    body: [
      '토큰 버킷은 일정한 속도로 토큰을 채우고, 요청마다 토큰을 하나씩 꺼내 쓰는 방식이에요. 잠깐 몰리는 요청은 쌓아 둔 토큰으로 받아 주고, 계속 넘치는 요청은 거절할 수 있어 API 레이트 리밋에 많이 쓰입니다.',
      '영상은 서버 한 대에서 동작하는 구현부터 시작해, 여러 서버가 같은 한도를 지키도록 공용 저장소에 상태를 두는 방법까지 차례로 보여 줘요. 거절할 때 언제 다시 시도하면 되는지 알려 주는 응답 헤더도 함께 다룹니다.',
    ],
    scenes: [
      { t: '2:20', label: '토큰 버킷이 요청을 받는 방식' },
      { t: '10:05', label: '여러 서버에서 한도 맞추기' },
    ],
    why: { 'backend-perf': '트래픽이 몰릴 때 서버가 같이 넘어지는 일을 막을 수 있어요.' },
  }),
  archive({
    id: 206, daysAgo: 6, topicId: 'llm-agent',
    title: '에이전트에게 도구를 몇 개까지 줘도 될까',
    kind: 'article', sourceLabel: '기술블로그', author: '김민준', url: demo('agent-tool-count'),
    short: '에이전트에 도구를 많이 붙일수록 똑똑해질 것 같지만, 비슷한 도구가 많으면 잘못 고르는 일이 늘어요. 도구를 나누고 설명을 쓰는 요령이에요.',
    body: [
      'LLM 에이전트는 도구 설명을 읽고 어떤 도구를 쓸지 고릅니다. 이름과 설명이 비슷한 도구가 많아지면 모델이 엉뚱한 도구를 고르거나 같은 일을 두 번 하는 경우가 늘어요.',
      '글쓴이는 비슷한 도구를 하나로 합치고, 설명에 "언제 쓰는지"와 "언제 쓰지 않는지"를 함께 적으라고 해요. 도구가 많이 필요하다면 단계별로 필요한 도구만 보여 주는 구조가 낫다고 합니다.',
    ],
    why: { 'llm-agent': '지금 붙인 도구 목록에서 합칠 것부터 찾아볼 수 있어요.' },
  }),
  archive({
    id: 207, daysAgo: 7, topicId: 'remote-work',
    title: '원격 근무자를 위한 워케이션, 한 달 살 도시 고르는 기준',
    kind: 'article', sourceLabel: '블로그', author: '정하린', url: demo('workation-city-checklist'),
    short: '워케이션 도시는 풍경보다 인터넷과 시차, 숙소의 작업 환경이 먼저예요. 한 달 살기 전에 확인할 것들을 정리했어요.',
    body: [
      '여행지에서 일하는 워케이션은 낭만적으로 들리지만, 화상 회의가 끊기면 금방 고생길이 돼요. 글쓴이는 도시를 고를 때 인터넷 속도, 팀과의 시차, 숙소에 책상과 의자가 있는지를 먼저 보라고 합니다.',
      '항공권과 숙소는 일하는 날과 쉬는 날을 나눠 계획하고, 첫 주에는 동네에서 일할 카페나 공유 오피스를 찾아 두면 좋아요. 한 달이 길다면 두 도시를 나눠 머무는 방법도 소개합니다.',
    ],
    why: { 'remote-work': '다음 워케이션을 계획할 때 체크리스트로 쓸 수 있어요.' },
  }),
  archive({
    id: 208, daysAgo: 8, topicId: 'backend-perf',
    title: 'Redis 캐시가 한꺼번에 만료될 때 생기는 일',
    kind: 'article', sourceLabel: '기술블로그', author: '이수아', url: demo('redis-cache-stampede'),
    short: '같은 시각에 많은 캐시가 만료되면 요청이 한꺼번에 DB로 몰려요. 만료 시간을 흩뜨리고, 한 요청만 캐시를 다시 채우게 하는 방법이에요.',
    body: [
      '인기 있는 데이터를 같은 만료 시간으로 Redis에 넣어 두면, 그 시각에 캐시가 동시에 비면서 요청이 데이터베이스로 몰려요. 이때 DB가 느려지면 캐시를 다시 채우는 요청까지 밀려 장애로 번지기 쉽습니다.',
      '글쓴이는 만료 시간에 약간의 무작위 값을 더해 흩뜨리고, 캐시가 비었을 때 한 요청만 DB에서 값을 가져오도록 잠금을 거는 방법을 소개해요. 만료 직전에 미리 갱신하는 방법도 함께 비교합니다.',
    ],
    why: { 'backend-perf': '트래픽이 많은 시간에 DB가 갑자기 느려지는 원인을 점검해 볼 수 있어요.' },
  }),
  archive({
    id: 209, daysAgo: 9, topicId: 'tech-biz',
    title: 'AI 기능 가격, 사용량 과금과 정액제 사이',
    kind: 'article', sourceLabel: '뉴스레터', author: '최유나', url: demo('ai-feature-pricing'),
    short: 'AI 기능은 고객마다 쓰는 양이 크게 달라 가격을 정하기 어려워요. 사용량 과금, 정액제, 둘을 섞은 요금제의 장단점을 비교했어요.',
    body: [
      'AI 기능은 고객이 쓸수록 비용이 들어서, 모든 고객에게 같은 가격을 받으면 많이 쓰는 고객 때문에 매출보다 비용이 커질 수 있어요. 그렇다고 사용량만큼 받으면 고객은 요금을 예상하기 어려워합니다.',
      '글쓴이는 기본 사용량을 포함한 정액제에 넘는 만큼만 추가 과금하는 요금제를 많이 쓴다고 정리해요. 처음에는 넉넉하게 시작하고, 실제 사용량 데이터를 보고 가격을 조정하라고 권합니다.',
    ],
    why: { 'tech-biz': 'AI 기능을 유료로 낼 때 요금제를 정하는 기준으로 쓸 수 있어요.' },
  }),
  archive({
    id: 210, daysAgo: 10, topicId: 'llm-dev',
    title: '작은 모델로 분류 작업 비용 줄이기',
    kind: 'article', sourceLabel: '기술블로그', author: '김민준', url: demo('small-model-classification'),
    short: '글을 분류하거나 태그를 다는 단순한 작업에 큰 LLM을 쓸 필요는 없어요. 작은 모델로 바꾸고 품질을 확인하는 순서를 정리했어요.',
    body: [
      '분류처럼 답이 정해진 목록 중 하나인 작업은 작은 모델로도 충분한 경우가 많아요. 큰 모델과 작은 모델의 비용 차이는 크게는 수십 배라서, 호출이 많을수록 효과가 커집니다.',
      '글쓴이는 먼저 큰 모델의 결과를 정답처럼 모아 두고, 같은 입력을 작은 모델에 넣어 얼마나 일치하는지 재 보라고 해요. 일치율이 충분하면 바꾸고, 애매한 경우만 큰 모델로 다시 묻는 방법도 소개합니다.',
    ],
    why: { 'llm-dev': '호출이 많은 단순 작업부터 모델을 바꿔 비용을 줄일 수 있어요.' },
  }),
  archive({
    id: 211, daysAgo: 11, topicId: 'design-system',
    title: '개발자가 알아 두면 좋은 여백과 정렬 원칙',
    kind: 'article', sourceLabel: '기술블로그', author: '오세린', url: demo('spacing-alignment-for-devs'),
    short: '디자이너 없이 화면을 만들 때 가장 티 나는 건 여백과 정렬이에요. 몇 가지 원칙만 지켜도 UI가 훨씬 정돈돼 보입니다.',
    body: [
      '화면이 어수선해 보이는 이유는 대부분 여백이 제각각이기 때문이에요. 4나 8의 배수처럼 정해진 간격만 쓰고, 관련 있는 요소는 가깝게, 관련 없는 요소는 멀게 두면 디자인이 정돈돼 보입니다.',
      '정렬도 중요해요. 글자와 버튼의 왼쪽 선을 맞추고, 한 화면에서 가운데 정렬과 왼쪽 정렬을 섞지 않는 것만으로도 UI가 훨씬 깔끔해져요. 글쓴이는 디자인 토큰으로 간격 값을 정해 두면 실수가 줄어든다고 말합니다.',
    ],
    why: { 'design-system': '혼자 만드는 관리자 화면부터 간격 규칙을 적용해 볼 수 있어요.' },
  }),
  archive({
    id: 212, daysAgo: 12, topicId: 'observability',
    title: '로그 레벨, 운영에서는 무엇을 남길까',
    kind: 'article', sourceLabel: '기술블로그', author: '이수아', url: demo('log-levels-in-production'),
    short: '로그를 너무 많이 남기면 비용이 커지고, 너무 적으면 장애 때 원인을 못 찾아요. 레벨별로 무엇을 남길지 기준을 정했어요.',
    body: [
      '운영 환경의 로그는 비용과 직결돼요. 디버그 로그를 그대로 켜 두면 저장 비용이 커지고, 정작 장애 때 필요한 로그를 찾기도 어려워집니다.',
      '글쓴이는 에러는 사람이 바로 봐야 하는 일, 경고는 곧 문제가 될 수 있는 일, 정보는 요청 하나를 따라갈 수 있는 최소한의 기록으로 나누라고 해요. 로그에 요청 ID를 꼭 남겨 두면 장애 때 흐름을 이어 붙이기 쉽습니다.',
    ],
    why: { observability: '지금 로그 비용이 큰 서비스부터 레벨 기준을 다시 잡아 볼 수 있어요.' },
  }),
  archive({
    id: 213, daysAgo: 13, topicId: 'tech-biz',
    title: '클라우드 비용, 환율이 오르면 무엇부터 볼까',
    kind: 'article', sourceLabel: '뉴스레터', author: '최유나', url: demo('cloud-cost-exchange-rate'),
    short: '클라우드 요금은 달러로 나가서 환율이 오르면 같은 사용량에도 예산이 늘어요. 먼저 줄일 수 있는 항목과 계약 방식을 정리했어요.',
    body: [
      '대부분의 클라우드 요금은 달러로 청구돼요. 환율이 오르면 쓰는 양이 그대로여도 원화 예산이 늘어나서, 연초에 세운 예산을 금방 넘기기 쉽습니다.',
      '글쓴이는 쓰지 않는 자원을 정리하고, 꾸준히 쓰는 서버는 약정 할인으로 바꾸고, 데이터 전송량이 큰 구간부터 확인하라고 해요. 달러 기준 사용량과 원화 지출을 따로 보면 환율 영향과 실제 사용량 증가를 구분할 수 있습니다.',
    ],
    why: { 'tech-biz': '다음 분기 인프라 예산을 다시 잡을 근거로 쓸 수 있어요.' },
  }),
  archive({
    id: 214, daysAgo: 14, topicId: 'rag',
    title: 'RAG 답변에 출처 달기, 사용자가 믿게 만드는 법',
    kind: 'article', sourceLabel: '기술블로그', author: '박서연', url: demo('rag-citations'),
    short: 'LLM 답변에 어떤 문서를 보고 답했는지 출처를 붙이면 사용자가 답을 확인할 수 있어요. 출처를 정확하게 다는 프롬프트와 화면 구성을 소개해요.',
    body: [
      'RAG 챗봇의 답이 그럴듯해도 사용자는 근거를 알고 싶어 해요. 답의 문장마다 어떤 문서를 참고했는지 표시하면, 사용자가 직접 확인할 수 있어 신뢰가 올라갑니다.',
      '글쓴이는 검색한 문서에 번호를 붙여 모델에 넘기고, 답에 그 번호를 달도록 프롬프트를 쓰라고 해요. 화면에서는 번호를 누르면 원문 구절이 바로 보이게 하고, 출처가 없는 문장은 따로 표시하는 방법도 소개합니다.',
    ],
    why: { rag: '지금 챗봇 답변에 출처 번호부터 붙여 볼 수 있어요.' },
  }),
];

export const CLUSTER_BY_ID: ReadonlyMap<number, DemoCluster> = new Map([...DEMO_CLUSTERS, ...ARCHIVE_CLUSTERS].map((c) => [c.id, c]));

export function toCandidate(c: DemoCluster): RankCandidate {
  return { id: c.id, ageHours: c.ageHours, sourceWeight: c.sourceWeight, size: c.size, isVideo: c.kind === 'video', topics: c.topics };
}
