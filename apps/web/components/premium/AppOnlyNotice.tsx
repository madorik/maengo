import { IconPhone } from "@/components/icons";

/**
 * 웹(PC·휴대폰 브라우저)에서 보이는 결제 안내. 결제는 앱의 인앱 결제(애플·구글)로만 받는다.
 * /premium에서 PremiumBuy가 앱이 아닐 때만 그린다(앱 안에서는 결제 버튼)
 */
export function AppOnlyNotice({ className = "" }: { className?: string }) {
  return (
    <div role="note" className={`tile flex items-start gap-3 p-4 text-left ${className}`}>
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-tint text-sky-dark">
        <IconPhone className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-black leading-snug">결제는 맹고 앱(Android·iOS)에서만 할 수 있어요</p>
        <p className="mt-1 text-[14px] font-medium leading-relaxed text-sub">앱에서 같은 계정으로 Premium을 시작하면 웹에서도 그대로 쓸 수 있어요.</p>
      </div>
    </div>
  );
}
