"use client";

import { useSignedIn } from "@/components/landing/AuthLink";

/** 1분 요약 카드 아래 안내: 로그인 전이면 '가입하고 전체 요약 보기', 로그인했으면 '1분 요약 읽기'(2026-11-10 사용자: 상세를 누르면 가입으로) */
export function SignupHint() {
  return <>{useSignedIn() ? "1분 요약 읽기" : "가입하고 전체 요약 보기"}</>;
}
