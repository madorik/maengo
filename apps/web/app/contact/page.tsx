import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { BackButton } from "@/components/ui/BackButton";
import { INQUIRY_CATEGORIES } from "@/lib/inquiry";
import { currentProfile } from "@/lib/server/session";
import { appUrl } from "@/lib/site";

export const metadata: Metadata = { title: "문의하기", alternates: { canonical: appUrl("/contact") } };

// 문의하기 양식(2026-10-26, 메일 링크 대신). 로그인하지 않아도 보낼 수 있다(소개 페이지 위 메뉴).
// 로그인했으면 답장 받을 메일을 미리 채우고, 회원 번호·플랜·최근 결제·앱 버전은 서버가 붙인다(lib/server/inquiry.ts).
// ?c=billing처럼 종류를 미리 고를 수 있고, ?q=restore는 구매 복원이 막혔을 때(다른 계정의 구매) 내용을 미리 채운다.
type Props = { searchParams: Promise<{ c?: string | string[]; q?: string | string[] }> };

export default async function ContactPage({ searchParams }: Props) {
  const [profile, sp] = await Promise.all([currentProfile(), searchParams]);
  const category = INQUIRY_CATEGORIES.find((c) => c.id === sp.c)?.id ?? null;
  const preset = sp.q === "restore" ? "다른 맹고 계정에서 산 구매를 이 계정으로 복원하고 싶어요.\n" : "";

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-10 border-b-2 border-line bg-paper pt-[env(safe-area-inset-top)]">
        <div className="mx-auto grid h-14 max-w-[600px] grid-cols-[1fr_auto_1fr] items-center px-2">
          <div>
            <BackButton fallback={profile ? "/settings" : "/"} />
          </div>
          <h1 className="text-[17px] font-black tracking-[-0.02em]">문의하기</h1>
        </div>
      </header>
      <main className="mx-auto max-w-[560px] px-5 pb-[calc(48px+env(safe-area-inset-bottom))] pt-6">
        <ContactForm defaultEmail={profile?.email ?? ""} home={profile ? "/settings" : "/"} category={category} preset={preset} />
      </main>
    </div>
  );
}
