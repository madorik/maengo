"""가이드 — 마크다운으로 보고서 쓰기 · 표 칸 합치기 · PDF 쪽 나눔."""

from build_pages import page

GUIDES = [("가이드 · 노트", "/guides.html")]

# ───────────────────────── 1. 마크다운으로 보고서 쓰기 ─────────────────────────
page(
    "guides/markdown-report.html",
    "마크다운으로 보고서 쓰기: 제목·항목·표로 뼈대 잡는 법",
    "업무 보고서·계획서·회의록을 마크다운(Markdown)으로 쓰는 방법. 제목과 섹션, 항목, 표, 비고로 뼈대를 잡고 PDF로 내기까지의 순서를 예시와 함께 정리했어요.",
    kicker="가이드 · 문서 작성",
    crumbs=GUIDES,
    nav="/guides.html",
    image="/img/lasee-doc.webp",
    lede="보고서는 모양이 거의 정해진 문서예요. 제목, 항목, 표가 반복되죠. 이런 문서는 글자 크기나 칸 간격을 손으로 맞추는 워드보다, <strong>구조를 글로 적는 마크다운</strong>이 더 잘 맞아요.",
    body="""
    <h2>왜 보고서를 마크다운으로 쓰나요</h2>
    <p>마크다운(Markdown)은 <code>#</code>, <code>-</code>, <code>|</code> 같은 기호로 제목·목록·표를 적는 텍스트 형식이에요. 워드 파일과 달리 원본이 그냥 글이라서 세 가지가 편해져요.</p>
    <ul>
      <li><strong>서식이 깨지지 않아요.</strong> 다른 사람이 열어도, 다른 프로그램으로 옮겨도 제목은 제목, 표는 표로 남아요.</li>
      <li><strong>고친 곳이 보여요.</strong> 지난 판과 이번 판을 줄 단위로 견줄 수 있어 "어디가 바뀌었지?"를 찾는 시간이 줄어요.</li>
      <li><strong>AI 와 함께 고치기 쉬워요.</strong> AI 에게 원본 글을 그대로 주고, 고친 글을 그대로 받아 붙이면 돼요. 서식이 섞인 파일보다 실수가 적어요.</li>
    </ul>

    <h2>1. 뼈대부터: 문서 제목 → 섹션 → 블록</h2>
    <p>보고서의 목차를 먼저 세 단계로 나눠 적어요. 가장 큰 제목은 문서에 한 번만 쓰고, 그 아래를 번호 붙인 섹션으로 나눈 뒤, 섹션 안을 작은 제목이 붙은 덩어리(블록)로 채워요.</p>
<pre><code># 3분기 운영 보고

## 1. 요약

### 한눈에 보기
- 3분기 매출은 18억 4천만 원으로 전 분기보다 12% 늘었다.
- 신규 회원은 4만 2천 명이다.

## 2. 매출

### 분야별 매출
| 분야 | 매출(백만 원) | 비중 |
|:---|---:|---:|
| 문학 | 508 | 27.6% |
| 인문·사회 | 436 | 23.7% |

## 3. 4분기 할 일

1. 물류 센터를 한 곳 더 연다.
2. 전자책 할인 행사를 11월에 연다.</code></pre>
    <p>이렇게 쓰면 <code>#</code> 은 문서 제목, <code>##</code> 은 섹션, <code>###</code> 은 블록 제목이 돼요. 섹션 제목 앞에 <code>1.</code> <code>2.</code> 를 붙여 두면 읽는 사람이 "2장 매출"처럼 가리키기 쉬워요. 네 단계(<code>####</code>)부터는 보고서에서 거의 쓰지 않아요. 단계가 깊어지면 섹션을 나누는 편이 읽기 좋아요.</p>

    <h2>2. 항목은 짧게, 한 줄에 한 사실</h2>
    <p>보고서의 대부분은 목록이에요. 항목 하나에 사실 하나만 담으면 읽는 사람이 훑기 좋고, 나중에 숫자를 고칠 때도 한 줄만 바꾸면 돼요.</p>
    <ul>
      <li><strong>글머리 목록</strong>은 <code>- </code> 로 시작해요. 순서가 중요하면 <code>1. </code> 번호 목록을 써요.</li>
      <li><strong>하위 항목</strong>은 위 항목의 글자 위치만큼 들여 써요. <code>- </code> 아래는 2칸, <code>1. </code> 아래는 3칸이에요. 세 단계를 넘기면 읽기 어려워져요.</li>
      <li><strong>다음 할 일</strong>은 <code>- [ ] 할 일</code>, 끝낸 일은 <code>- [x] 끝낸 일</code> 로 적으면 체크 상자로 보여요.</li>
    </ul>
<pre><code>- 신규 회원은 4만 2천 명이다.
  - 모바일 앱 가입이 71%다.
- [ ] 반품 사유를 주문 화면에서 고르게 하기
- [x] 도서 정보 오류 점검표 만들기</code></pre>

    <h2>3. 숫자는 표로, 단위는 머리글에</h2>
    <p>숫자가 세 개 이상 나란히 나오면 표가 낫습니다. 마크다운 표는 <code>|</code> 로 칸을 나누고, 둘째 줄의 구분선으로 열 정렬을 정해요.</p>
    <div class="table"><table>
      <thead><tr><th>구분선</th><th>정렬</th><th>쓰기 좋은 곳</th></tr></thead>
      <tbody>
        <tr><td><code>:---</code></td><td>왼쪽</td><td>이름, 분야 같은 글자</td></tr>
        <tr><td><code>---:</code></td><td>오른쪽</td><td>금액, 개수 같은 숫자(자릿수가 맞아 견주기 쉬워요)</td></tr>
        <tr><td><code>:---:</code></td><td>가운데</td><td>비율, 짧은 표시(○, ✕)</td></tr>
      </tbody>
    </table></div>
    <p>단위는 칸마다 쓰지 말고 머리글에 한 번만 적어요. <code>매출(백만 원)</code> 처럼요. 칸에는 숫자만 남아 훨씬 깔끔해져요. 머리글이 두 줄이거나 칸을 합쳐야 하는 표는 <a href="/guides/markdown-table-merge.html">마크다운 표에서 칸 합치는 방법</a>을 참고하세요.</p>

    <h2>4. 근거는 비고로 남기기</h2>
    <p>표나 목록 아래에 "부가세를 뺀 금액이다", "10월 5일 마감 기준" 같은 주석을 남겨 두면, 나중에 숫자를 두고 다시 묻는 일이 줄어요. 마크다운에서는 줄 앞에 <code>&gt; </code> 를 붙여 적어요.</p>
<pre><code>| 분야 | 매출(백만 원) |
|:---|---:|
| 문학 | 508 |
&gt; 매출은 부가세를 뺀 금액이다.</code></pre>

    <h2>5. 강조는 아껴서</h2>
    <p>모든 줄이 굵으면 아무것도 눈에 띄지 않아요. 문서 전체에서 정말 봐야 할 숫자 두세 개만 강조하세요.</p>
    <ul>
      <li><code>**굵게**</code> — 결론 숫자, 결정 사항</li>
      <li><code>~~취소선~~</code> — 바뀐 계획을 남겨 둘 때</li>
      <li>글자 색이나 형광펜은 표준 마크다운에 없어요. 편집기마다 쓰는 법이 달라서, 다른 곳으로 옮길 문서라면 굵게만으로 충분해요.</li>
    </ul>

    <h2>6. 마지막으로 PDF 로 내기</h2>
    <p>보고서는 결국 PDF 로 보내는 일이 많아요. 이때 화면에서는 멀쩡하던 표가 쪽 중간에서 잘리거나, 제목만 쪽 끝에 덩그러니 남는 일이 생겨요. 왜 그런지, 어떻게 맞추는지는 <a href="/guides/markdown-pdf-page-break.html">마크다운을 PDF 로 바꿀 때 쪽 나눔이 어긋나는 이유</a>에 정리했어요.</p>

    <h2>보내기 전 점검 목록</h2>
    <ul>
      <li>문서 제목(<code>#</code>)은 한 번만 썼나요?</li>
      <li>섹션 번호가 1, 2, 3 순서대로인가요?</li>
      <li>항목 하나에 사실 하나만 들어 있나요?</li>
      <li>숫자 열은 오른쪽 정렬이고, 단위는 머리글에 있나요?</li>
      <li>기준일·출처 같은 근거를 비고로 남겼나요?</li>
      <li>굵게 표시가 문서 전체에서 다섯 군데를 넘지 않나요?</li>
    </ul>

    <h2>라씨로 써 보기</h2>
    <figure>
      <img loading="lazy" decoding="async" src="/img/lasee-doc.webp" alt="MDitor 라씨 문서 화면: 표가 있는 보고서를 보이는 모양 그대로 고치는 모습" width="1200" height="1040">
      <figcaption>MDitor 라씨의 문서 탭. 워드처럼 고치면 원본은 마크다운으로 남아요.</figcaption>
    </figure>
    <p>와타랩스가 만든 <a href="https://lasee.watalabs.com/">MDitor 라씨</a>는 이 글의 방식대로 보고서를 쓰는 무료 편집기예요. 문서 탭에서 워드처럼 고치거나 MD 탭에서 마크다운을 바로 고칠 수 있고, 미리보기의 쪽 경계가 내려받을 PDF 와 같아요. 가입 없이 브라우저에서 바로 쓸 수 있어요.</p>

    <aside class="related">
      <h2>함께 읽기</h2>
      <ul>
        <li><a href="/guides/markdown-table-merge.html">마크다운 표에서 칸 합치는 방법</a></li>
        <li><a href="/guides/markdown-pdf-page-break.html">마크다운을 PDF 로 바꿀 때 쪽 나눔이 어긋나는 이유와 맞추는 법</a></li>
      </ul>
    </aside>""",
)

# ───────────────────────── 2. 표 칸 합치기 ─────────────────────────
page(
    "guides/markdown-table-merge.html",
    "마크다운 표에서 칸 합치는 방법: 표준 문법의 한계와 세 가지 대안",
    "표준 마크다운(CommonMark·GFM)에는 표 칸 합치기(colspan·rowspan)가 없어요. HTML 표, 머리글 풀어 쓰기, MDitor 라씨의 < ^ 표기까지 세 가지 대안과 장단점을 예시로 정리했어요.",
    kicker="가이드 · 문서 작성",
    crumbs=GUIDES,
    nav="/guides.html",
    lede="결론부터 말하면, <strong>표준 마크다운에는 칸 합치기가 없어요.</strong> GitHub 가 쓰는 GFM 표도 모든 행의 칸 수가 같은 단순한 격자만 그려요. 그래도 두 줄 머리글이 필요한 보고서 표는 많죠. 상황별로 쓸 수 있는 방법이 세 가지 있어요.",
    body="""
    <h2>합친 칸이 필요한 표는 어떤 모양인가요</h2>
    <p>보고서에서 흔한 모양은 "큰 분류 아래 작은 분류" 머리글이에요. 아래 표에서 "매출(백만 원)"은 두 열에 걸쳐 있고, "분야"와 "비중"은 두 줄에 걸쳐 있어요.</p>
    <div class="table"><table>
      <thead>
        <tr><th rowspan="2">분야</th><th colspan="2">매출(백만 원)</th><th rowspan="2">비중</th></tr>
        <tr><th>종이책</th><th>전자책</th></tr>
      </thead>
      <tbody>
        <tr><td>문학</td><td class="num">412</td><td class="num">96</td><td class="num">27.6%</td></tr>
        <tr><td>인문·사회</td><td class="num">365</td><td class="num">71</td><td class="num">23.7%</td></tr>
      </tbody>
    </table></div>
    <p>이 표를 마크다운으로 옮기는 방법을 차례로 볼게요.</p>

    <h2>방법 1. HTML 표를 그대로 쓰기</h2>
    <p>많은 마크다운 도구가 문서 안의 HTML 을 그대로 보여 줘요. 그래서 합친 칸이 필요한 표만 HTML 로 쓰는 방법이 있어요.</p>
<pre><code>&lt;table&gt;
  &lt;tr&gt;&lt;th rowspan="2"&gt;분야&lt;/th&gt;&lt;th colspan="2"&gt;매출(백만 원)&lt;/th&gt;&lt;th rowspan="2"&gt;비중&lt;/th&gt;&lt;/tr&gt;
  &lt;tr&gt;&lt;th&gt;종이책&lt;/th&gt;&lt;th&gt;전자책&lt;/th&gt;&lt;/tr&gt;
  &lt;tr&gt;&lt;td&gt;문학&lt;/td&gt;&lt;td&gt;412&lt;/td&gt;&lt;td&gt;96&lt;/td&gt;&lt;td&gt;27.6%&lt;/td&gt;&lt;/tr&gt;
&lt;/table&gt;</code></pre>
    <ul>
      <li><strong>좋은 점:</strong> 원하는 모양을 정확히 그릴 수 있어요.</li>
      <li><strong>아쉬운 점:</strong> 원본이 길고 읽기 어려워요. 칸 하나를 고치려 해도 태그 사이를 찾아야 해요. HTML 을 막아 두는 서비스에서는 표가 아예 안 보이기도 해요.</li>
    </ul>

    <h2>방법 2. 합치지 말고 머리글을 풀어 쓰기</h2>
    <p>가장 호환성이 좋은 방법은 합친 칸을 없애는 거예요. 큰 분류를 작은 분류 이름 안에 넣어 머리글을 한 줄로 만들어요.</p>
<pre><code>| 분야 | 종이책 매출(백만 원) | 전자책 매출(백만 원) | 비중 |
|:---|---:|---:|---:|
| 문학 | 412 | 96 | 27.6% |
| 인문·사회 | 365 | 71 | 23.7% |</code></pre>
    <ul>
      <li><strong>좋은 점:</strong> 어떤 마크다운 뷰어에서도 똑같이 보여요. 표를 스프레드시트로 옮길 때도 깔끔해요.</li>
      <li><strong>아쉬운 점:</strong> 머리글이 길어지고 같은 말("매출(백만 원)")이 반복돼요.</li>
    </ul>

    <h2>방법 3. 칸 합치기 표기를 지원하는 편집기 쓰기</h2>
    <p>일부 편집기는 마크다운 표 안에 "이 칸은 옆 칸과 합친다"는 표시를 따로 정해 두었어요. 와타랩스의 <a href="https://lasee.watalabs.com/">MDitor 라씨</a>는 칸에 <code>&lt;</code> 하나만 적으면 왼쪽 칸과, <code>^</code> 하나만 적으면 위 칸과 합쳐요.</p>
<pre><code>| 분야 | 매출(백만 원) | &lt; | 비중 |
| ^ | 종이책 | 전자책 | ^ |
|:---|---:|---:|:---:|
| 문학 | 412 | 96 | 27.6% |
| 인문·사회 | 365 | 71 | 23.7% |</code></pre>
    <p>첫 줄의 <code>&lt;</code> 는 "매출(백만 원)"을 오른쪽으로 한 칸 늘리고, 둘째 줄의 <code>^</code> 두 개는 "분야"와 "비중"을 아래로 한 칸 늘려요. 구분선(<code>|---|</code>) 위의 두 줄이 모두 머리글이 돼요.</p>
    <h3>지켜야 할 규칙</h3>
    <ul>
      <li><strong>행마다 칸 수는 그대로</strong> 둬요. 합쳐지는 칸도 <code>&lt;</code> 나 <code>^</code> 로 자리를 채워요.</li>
      <li><strong>머리글과 본문은 따로</strong> 합쳐요. 머리글 칸을 본문 칸과 합칠 수는 없어요.</li>
      <li><strong>합친 모양은 직사각형</strong>이어야 해요. ㄱ자처럼 어긋난 모양은 합쳐지지 않아요.</li>
      <li><code>&lt;</code> 나 <code>^</code> 를 글자 그대로 쓰려면 <code>\\&lt;</code>, <code>\\^</code> 처럼 앞에 <code>\\</code> 를 붙여요.</li>
      <li>칸 배경을 회색으로 칠하려면 칸 내용 전체를 <code>{음영}…{/음영}</code> 으로 감싸요.</li>
    </ul>
    <ul>
      <li><strong>좋은 점:</strong> 원본이 여전히 짧은 마크다운 표예요. PDF 로 내면 합친 칸 그대로 그려지고, 쪽이 넘어가면 두 줄 머리글이 다음 쪽에 다시 나와요.</li>
      <li><strong>아쉬운 점:</strong> 이 표기를 모르는 일반 마크다운 뷰어에서는 <code>&lt;</code>, <code>^</code> 가 글자로 보여요. 표 자체는 깨지지 않아서 내용은 읽을 수 있어요.</li>
    </ul>

    <h2>어떤 방법을 고를까</h2>
    <div class="table"><table>
      <thead><tr><th></th><th>HTML 표</th><th>머리글 풀어 쓰기</th><th>&lt; ^ 표기(라씨)</th></tr></thead>
      <tbody>
        <tr><th>원본 읽기</th><td>어려움</td><td>쉬움</td><td>쉬움</td></tr>
        <tr><th>일반 뷰어에서</th><td>HTML 을 허용하면 그대로</td><td>그대로</td><td>기호가 글자로 보임</td></tr>
        <tr><th>합친 칸 모양</th><td>그대로</td><td>합치지 않음</td><td>그대로</td></tr>
        <tr><th>잘 맞는 곳</th><td>웹 문서 한두 곳</td><td>여러 서비스에 붙여 넣는 표</td><td>PDF 로 내는 보고서</td></tr>
      </tbody>
    </table></div>

    <h2>자주 하는 실수</h2>
    <ul>
      <li><strong>칸 수가 행마다 다름</strong> — 머리글이 4칸이면 모든 행이 4칸이어야 해요. 빈 칸도 <code>| |</code> 로 자리를 남겨요.</li>
      <li><strong>칸 안에 <code>|</code> 를 씀</strong> — 칸 구분으로 읽혀요. <code>\\|</code> 로 적어요.</li>
      <li><strong>칸 안에서 줄을 바꿈</strong> — 표 한 행은 한 줄이에요. 칸 안 줄바꿈은 <code>&lt;br&gt;</code> 로 적어요.</li>
    </ul>

    <aside class="related">
      <h2>함께 읽기</h2>
      <ul>
        <li><a href="/guides/markdown-report.html">마크다운으로 보고서 쓰기: 제목·항목·표로 뼈대 잡는 법</a></li>
        <li><a href="/guides/markdown-pdf-page-break.html">마크다운을 PDF 로 바꿀 때 쪽 나눔이 어긋나는 이유와 맞추는 법</a></li>
      </ul>
    </aside>""",
)

# ───────────────────────── 3. PDF 쪽 나눔 ─────────────────────────
page(
    "guides/markdown-pdf-page-break.html",
    "마크다운을 PDF로 바꿀 때 쪽 나눔이 어긋나는 이유와 맞추는 법",
    "화면에서는 멀쩡한 마크다운 문서가 PDF로 바꾸면 표가 쪽 중간에서 잘리고 제목만 쪽 끝에 남는 이유, 그리고 쪽 나눔을 맞추는 방법을 정리했어요.",
    kicker="가이드 · 문서 작성",
    crumbs=GUIDES,
    nav="/guides.html",
    image="/img/lasee-preview.webp",
    lede="마크다운 보고서를 PDF 로 바꿨더니 표가 두 쪽에 걸쳐 잘리고, 다음 쪽 표에는 머리글이 없고, 섹션 제목만 쪽 맨 아래에 남아 있던 적 있으신가요? <strong>화면과 종이가 글을 배치하는 방식이 다르기 때문</strong>이에요.",
    body="""
    <h2>왜 어긋나나요</h2>
    <p>화면은 끝없이 이어지는 두루마리예요. 쪽이라는 개념이 없어요. PDF 는 A4 같은 정해진 크기의 종이에 여백을 두고 글을 다시 앉혀요. 이때 세 가지가 달라져요.</p>
    <ul>
      <li><strong>글자 크기와 줄 폭</strong> — 화면 폭과 종이 폭이 달라서 같은 문단도 줄 수가 바뀌어요. 줄 수가 바뀌면 쪽이 넘어가는 자리도 바뀌어요.</li>
      <li><strong>변환기마다 다른 규칙</strong> — 브라우저 인쇄, 변환 프로그램, 편집기의 내보내기는 쪽을 넘기는 규칙이 저마다 달라요. 같은 문서도 도구에 따라 다른 자리에서 끊겨요.</li>
      <li><strong>"어디서 끊으면 안 되는지"를 모름</strong> — 사람은 제목과 본문이 한 덩어리라는 걸 알지만, 변환기는 그냥 글자를 위에서부터 채워요. 그래서 제목만 쪽 끝에 남기도 해요.</li>
    </ul>

    <h2>보기 좋은 쪽 나눔의 규칙</h2>
    <p>출판물에서 오래 써 온 규칙을 보고서에 옮기면 이렇게 정리돼요.</p>
    <ol>
      <li><strong>제목은 본문과 함께 넘긴다.</strong> 제목 아래 본문이 한 줄도 없이 쪽이 끝나면, 제목도 다음 쪽으로 보내요.</li>
      <li><strong>작은 덩어리는 쪼개지 않는다.</strong> 블록 제목, 본문, 비고가 남은 자리에 다 안 들어가면 통째로 다음 쪽으로 보내요.</li>
      <li><strong>긴 표는 행 단위로 나누고 머리글을 다시 단다.</strong> 다음 쪽 표만 봐도 어떤 열인지 알 수 있어야 해요.</li>
      <li><strong>새 장은 새 쪽에서</strong> — 필요한 경우 섹션마다 새 쪽에서 시작해요.</li>
    </ol>

    <h2>도구별로 쪽 나눔을 맞추는 방법</h2>
    <h3>브라우저 인쇄 · HTML 을 거치는 변환</h3>
    <p>마크다운을 HTML 로 바꾼 뒤 인쇄하는 방식이라면, 인쇄용 CSS 로 위 규칙을 적을 수 있어요.</p>
<pre><code>@media print {
  h2, h3 { break-after: avoid; }        /* 제목 바로 뒤에서 끊지 않기 */
  table, figure { break-inside: avoid; } /* 짧은 표 · 그림은 통째로 */
  thead { display: table-header-group; } /* 긴 표의 머리글을 쪽마다 반복 */
  h2 { break-before: page; }             /* 섹션마다 새 쪽(필요할 때만) */
}</code></pre>
    <p>다만 브라우저마다 지원 정도가 달라서, 같은 CSS 라도 결과가 조금씩 달라요. 내보낸 PDF 를 열어 직접 확인해야 해요.</p>
    <h3>원하는 자리에서 직접 넘기기</h3>
    <p>"여기서는 꼭 새 쪽"인 자리가 있다면 문서에 쪽 나눔 표시를 넣어요. 많은 도구가 HTML 주석 형태를 써요.</p>
<pre><code>## 3. 부록

&lt;!-- pagebreak --&gt;

### 상세 집계표</code></pre>
    <p>주석이라 일반 마크다운 뷰어에서는 보이지 않고, 이 표시를 아는 도구에서만 쪽이 넘어가요. 쓰는 도구가 어떤 표시를 쓰는지 먼저 확인하세요.</p>

    <h2>미리보기와 PDF 를 똑같이 만드는 방법</h2>
    <p>가장 확실한 방법은 <strong>미리보기가 PDF 를 실제로 그려 본 결과를 보여 주는 것</strong>이에요. 와타랩스가 만든 <a href="https://lasee.watalabs.com/">MDitor 라씨</a>가 이렇게 동작해요.</p>
    <figure>
      <img loading="lazy" decoding="async" src="/img/lasee-preview.webp" alt="MDitor 라씨 미리보기: 쪽이 넘어가는 자리에 점선 경계" width="1200" height="1040">
      <figcaption>라씨 미리보기. 점선이 내려받을 PDF 에서 쪽이 넘어가는 자리예요.</figcaption>
    </figure>
    <ul>
      <li>서버가 PDF 를 실제로 그려 보고, 각 블록·항목·표 행이 몇 쪽에 놓이는지 알려 줘요. 미리보기는 그 자리에 쪽 경계를 그려요. 그래서 화면에서 본 대로 PDF 가 나와요.</li>
      <li>위의 규칙을 기본으로 따라요. 블록은 남은 자리에 안 들어가면 통째로 다음 쪽으로 가고, 한 쪽보다 큰 표는 행 단위로 나뉘며 머리글이 반복돼요. 한 쪽보다 긴 코드 블록은 줄 단위로 나뉘어요.</li>
      <li><code>&lt;!-- pagebreak --&gt;</code> 한 줄로 그 자리에서 쪽을 넘길 수 있어요. 이미 쪽 맨 위라면 빈 쪽을 만들지 않아요.</li>
      <li>쪽 설정에서 '섹션마다 새 쪽'을 켜면 <code>##</code> 마다 새 쪽에서 시작해요. 용지(A4·Letter), 가로·세로, 여백, 글자 크기, 쪽 번호도 고를 수 있어요.</li>
    </ul>

    <h2>내보내기 전 점검 목록</h2>
    <ul>
      <li>쪽 맨 아래에 제목만 남은 곳이 없나요?</li>
      <li>두 쪽에 걸친 표의 다음 쪽에도 머리글이 있나요?</li>
      <li>그림과 그 설명이 다른 쪽으로 떨어지지 않았나요?</li>
      <li>쪽 나눔 표시를 넣었다면 그 앞 쪽이 너무 비지 않았나요?</li>
      <li>마지막 쪽에 한두 줄만 남았다면, 여백이나 글자 크기를 조금 줄여 한 쪽을 아낄 수 있나요?</li>
    </ul>

    <aside class="related">
      <h2>함께 읽기</h2>
      <ul>
        <li><a href="/guides/markdown-report.html">마크다운으로 보고서 쓰기: 제목·항목·표로 뼈대 잡는 법</a></li>
        <li><a href="/guides/markdown-table-merge.html">마크다운 표에서 칸 합치는 방법</a></li>
        <li><a href="/notes/lasee-performance.html">40만 자 문서 하나가 서버를 세우던 이유 — 라씨 성능 개선 기록</a></li>
      </ul>
    </aside>""",
)
