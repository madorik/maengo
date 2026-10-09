import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

// 소개 페이지. 누구나 볼 수 있는 정적 페이지다(로그인 여부에 따른 버튼은 AuthLink가 브라우저에서 바꾼다).
export default function Home() {
  return <Landing />;
}
