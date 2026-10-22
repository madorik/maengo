import Link from "next/link";
import { MangoIcon } from "@/components/MangoIcon";
import { COMPANY_NAME, companyUrl } from "@/lib/site";
import { topicsPath } from "@/lib/public-topics";

const LINK = "text-sub no-underline hover:text-ink hover:underline";

/** 소개·공개 분야 페이지의 바닥. 운영사(와타랩스)를 회사 사이트로 잇는다 */
export function SiteFooter() {
  return (
    <footer className="border-t-2 border-line">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-2 px-5 pb-[calc(32px+env(safe-area-inset-bottom))] pt-8 text-[13px] font-semibold text-sub sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2">
          <MangoIcon className="size-6" />
          관심사에 맞춘 오늘의 소식, 맹고
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href={topicsPath()} className={LINK}>
            관심 분야
          </Link>
          <Link href="/terms" className={LINK}>
            이용약관
          </Link>
          <Link href="/privacy" className={`font-extrabold ${LINK}`}>
            개인정보 처리방침
          </Link>
          {/* 회사 사이트는 basePath(/maengo) 밖이라 Link가 아닌 a로 건다 */}
          <span>
            © 2026{" "}
            <a href={companyUrl()} className={LINK}>
              {COMPANY_NAME}
            </a>
          </span>
        </span>
      </div>
    </footer>
  );
}
