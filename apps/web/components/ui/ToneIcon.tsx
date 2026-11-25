/**
 * 성격 표시: 긍정 요인 체크, 부담 요인 경고 삼각형, 지켜볼 변수 눈(오늘의 흐름·주간 리포트가 같이 쓴다).
 * 화살표(↗·↘)는 쓰지 않는다(2026-11-13 사용자: 국내 증시가 급락했는데 '↘ 부담 요인'이 부담이 내려간 것처럼 보인다). 방향이 아니라 성격을 나타낸다
 */
export function ToneIcon({ tone, className = "size-3.5" }: { tone: "plus" | "minus" | "watch"; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {tone === "plus" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.4l2.8 2.8L16.2 9.8" />
        </>
      ) : tone === "minus" ? (
        <>
          <path d="M10.3 4.2L2.6 18a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z" />
          <path d="M12 9.5v4.5" />
          <path d="M12 17.4v.1" />
        </>
      ) : (
        <>
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      )}
    </svg>
  );
}
