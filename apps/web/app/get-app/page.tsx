import type { Metadata } from "next";
import Link from "next/link";
import { Mascot } from "@/components/Mascot";
import { IconExternal } from "@/components/icons";
import { withBase } from "@/lib/base-path";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/site";

// 앱 받기(2026-11-12 사용자 '앱에서 알림 받는 게 메인이어야 해, PC 웹에서 접속하면 다 앱 다운로드로 돌리자').
// PC 브라우저로 로그인·오늘·보관함 같은 앱 화면을 열면 proxy.ts가 여기로 보낸다(관리자는 예외).
// 휴대폰 카메라로 QR을 찍으면 /go/app?from=qr_get → 그 휴대폰의 스토어. 소개·1분 요약·공유 글·약관은 PC에서도 그대로 읽는다

export const metadata: Metadata = {
  title: "맹고 앱 받기",
  description: "맹고는 앱에서 출근길·퇴근길 알림으로 맞춤 인사이트를 받아요. 휴대폰 카메라로 QR을 찍어 앱을 받아 주세요.",
  alternates: { canonical: "/get-app" },
};

const POINTS = ["출근길·퇴근길에 알림으로 브리핑이 와요", "화면을 꺼도 이어서 들어요", "관심 분야 소식과 맞춤 인사이트를 한 번에"];

export default function GetAppPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-5 py-12">
      <div className="w-full max-w-[720px]">
        <div className="flex flex-col items-center gap-10 md:flex-row md:items-center md:gap-14">
          <div className="flex-1 text-center md:text-left">
            <Mascot mood="listen" className="mx-auto size-16 md:mx-0" />
            <h1 className="mt-4 text-[30px] font-bold leading-[1.25] tracking-[-0.04em] md:text-[38px]">
              맹고는
              <br />
              앱에서 받아요
            </h1>
            <ul className="mt-5 flex flex-col gap-2 text-[16px] font-semibold text-ink">
              {POINTS.map((p) => (
                <li key={p} className="flex items-start justify-center gap-2 md:justify-start">
                  <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-mango-deep" />
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[14px] font-medium leading-relaxed text-sub">이미 가입했다면 앱에서 같은 계정(구글·애플)으로 로그인하면 그대로 이어져요.</p>
          </div>

          <div className="flex shrink-0 flex-col items-center">
            <div className="rounded-[28px] bg-snow p-5">
              {/* eslint-disable-next-line @next/next/no-img-element -- 작은 SVG QR(public/qr/app-get.svg) */}
              <img src={withBase("/qr/app-get.svg")} width={200} height={200} alt="맹고 앱 받기 QR 코드" className="keep-light rounded-xl bg-white p-2" />
            </div>
            <p className="mt-3 text-[14px] font-bold">휴대폰 카메라로 찍어 주세요</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <a href={APP_STORE_URL} target="_blank" rel="noopener" className="btn btn-ink min-h-12 gap-1.5 px-5 text-[15px] no-underline">
                App Store
                <IconExternal className="size-3.5" />
              </a>
              {PLAY_STORE_URL && (
                <a href={PLAY_STORE_URL} target="_blank" rel="noopener" className="btn btn-ghost min-h-12 gap-1.5 px-5 text-[15px] no-underline">
                  Google Play
                  <IconExternal className="size-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
        <p className="mt-12 text-center text-[13px] font-medium text-sub">
          <Link href="/" className="underline underline-offset-4">
            맹고 소개 보기
          </Link>
        </p>
      </div>
    </main>
  );
}
