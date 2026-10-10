import Link from "next/link";
import { MangoIcon } from "@/components/MangoIcon";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/site";

const DOCS = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보 처리방침" },
  { href: "/delete-account", label: "계정 삭제 안내" },
] as const;

/**
 * 약관·개인정보 처리방침·계정 삭제 안내의 공통 틀. 로그인 없이 누구나 본다(스토어 심사·등록 정보에서 이 주소를 건다).
 * 본문은 h2·p·ul·table을 그대로 쓰고 글꼴·간격은 여기서 한 번에 맞춘다.
 */
export function LegalPage({ title, path, children }: { title: string; path: (typeof DOCS)[number]["href"]; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b-2 border-line pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-[720px] items-center px-5">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <MangoIcon className="size-7" />
            <span className="text-[20px] font-black tracking-[-0.04em] text-mango-deep">맹고</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[720px] px-5 pb-16 pt-8">
        <h1 className="text-[28px] font-black tracking-[-0.03em]">{title}</h1>
        <p className="mt-1 text-[14px] font-semibold text-sub">시행일 {LEGAL_EFFECTIVE_DATE}</p>
        <div className="mt-8 text-[15px] font-medium leading-[1.8] text-ink [&_a]:font-bold [&_a]:text-sky-dark [&_h2]:mb-2 [&_h2]:mt-10 [&_h2]:text-[18px] [&_h2]:font-black [&_h2]:tracking-[-0.02em] [&_h3]:mb-1 [&_h3]:mt-5 [&_h3]:text-[15px] [&_h3]:font-black [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
        <nav aria-label="다른 문서" className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t-2 border-line pt-5 text-[14px] font-bold">
          {DOCS.filter((d) => d.href !== path).map((d) => (
            <Link key={d.href} href={d.href} className="text-sub no-underline hover:text-ink hover:underline">
              {d.label}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}

/** 위탁·국외 이전처럼 항목이 많은 표는 휴대폰에서 가로로 넘치지 않게 받는 곳마다 묶어 보여 준다 */
export function Recipient({ name, rows }: { name: string; rows: [string, React.ReactNode][] }) {
  return (
    <section className="tile mt-3 p-4">
      <h3 className="!mt-0">{name}</h3>
      <dl className="mt-1 grid grid-cols-[6.5em_1fr] gap-x-3 gap-y-1 text-[14px] leading-[1.6]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-bold text-sub">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
