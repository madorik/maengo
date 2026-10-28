import { BUSINESS, CEO_NAME, COMPANY_NAME, SUPPORT_EMAIL, businessCheckUrl } from "@/lib/site";

/** 사업자 정보 한 벌(전자상거래법 표시 의무). 값은 lib/site.ts의 BUSINESS, 빈 값은 줄째 숨긴다 */
export function BusinessInfo({ className = "" }: { className?: string }) {
  const items: [string, string][] = [
    ["상호", COMPANY_NAME],
    ["대표", CEO_NAME],
    ["사업자등록번호", BUSINESS.regNo],
    ["통신판매업 신고", BUSINESS.mailOrderNo],
    ["주소", BUSINESS.address],
    ["전화", BUSINESS.phone],
    ["이메일", SUPPORT_EMAIL],
  ];
  return (
    <p className={className}>
      {items
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <span key={k}>
            {k} {v}
          </span>
        ))}
      {BUSINESS.mailOrderNo && (
        <a href={businessCheckUrl()} target="_blank" rel="noopener noreferrer" className="underline">
          사업자정보 확인
        </a>
      )}
    </p>
  );
}
