import { withBase } from "@/lib/base-path";

// PC 화면의 '휴대폰으로 받기' QR(2026-11-11, lib/app-install.ts). 휴대폰 카메라로 찍으면 /go/app?from=qr_<자리>로 가서 그 휴대폰의 스토어가 열린다.
// 그림은 public/qr/app-<자리>.svg(남색 점·흰 바탕, 다크 모드에서도 흰 바탕 그대로 둬야 찍힌다).
// 주소를 바꾸면 그림도 다시 만든다: npx qrcode@1.5.4 -e M -q 1 -d 1F2340 -l FFFFFF -o app-<자리>.svg "https://watalabs.com/maengo/go/app?from=qr_<자리>"
export function AppQr({ spot, size, className = "" }: { spot: "landing" | "side"; size: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 작은 SVG라 next/image 최적화가 필요 없다
    <img
      src={withBase(`/qr/app-${spot}.svg`)}
      width={size}
      height={size}
      alt="맹고 앱 받기 QR 코드"
      className={`keep-light shrink-0 rounded-lg bg-white p-1 ${className}`}
    />
  );
}
