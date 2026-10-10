"use client";

import { useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { isAppUserAgent } from "@/lib/app-client";

type Provider = "google" | "apple";
const noSubscribe = () => () => {};

/**
 * 구글·애플 로그인 버튼. 브라우저는 서버 액션(signIn)으로 넘어가고,
 * 앱은 구글이 웹뷰 로그인을 막아서 시스템 브라우저로 로그인한 뒤 돌아온다(lib/native/auth.ts).
 * demo가 true면(로컬 개발) 공용 데모 계정으로 들어가는 버튼을 하나 더 둔다
 */
export function LoginButtons({ demo }: { demo: boolean }) {
  const { pending, data } = useFormStatus();
  const inApp = useSyncExternalStore(noSubscribe, () => isAppUserAgent(navigator.userAgent), () => false);
  const [appBusy, setAppBusy] = useState<Provider | null>(null);
  const [appError, setAppError] = useState(false);
  const busy = (p: string) => (pending && data?.get("provider") === p) || appBusy === p;

  const appLogin = async (provider: Provider) => {
    setAppBusy(provider);
    setAppError(false);
    const { appSignIn } = await import("@/lib/native/auth");
    const result = await appSignIn(provider);
    // 성공하면 화면이 /auth/callback으로 넘어간다. 닫았거나 실패하면 버튼을 되살린다
    if (result === "ok") return;
    setAppBusy(null);
    setAppError(result === "error");
  };
  // 앱이면 폼을 보내지 않고 앱 로그인을 연다
  const appProps = (provider: Provider) => (inApp ? { type: "button" as const, onClick: () => void appLogin(provider) } : { type: "submit" as const });

  return (
    <>
      {appError && (
        <p role="alert" className="text-center text-[14px] font-bold text-orange">
          로그인을 마치지 못했어요. 다시 눌러 주세요.
        </p>
      )}
      <button
        {...appProps("google")}
        name="provider"
        value="google"
        disabled={pending || appBusy !== null}
        className="btn btn-ghost w-full"
      >
        <svg viewBox="0 0 48 48" aria-hidden="true" className="size-5">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        {busy("google") ? "들어가는 중" : "Google로 계속하기"}
      </button>
      <button
        {...appProps("apple")}
        name="provider"
        value="apple"
        disabled={pending || appBusy !== null}
        className="btn btn-ink w-full"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-white">
          <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
        </svg>
        {busy("apple") ? "들어가는 중" : "Apple로 계속하기"}
      </button>
      {demo && (
        <button type="submit" name="provider" value="demo" disabled={pending} className="mt-1 min-h-11 text-[14px] font-extrabold text-sky hover:underline">
          {busy("demo") ? "들어가는 중" : "데모 계정으로 둘러보기"}
        </button>
      )}
    </>
  );
}
