import { closeView, graniteEvent, openURL, Storage } from "@apps-in-toss/web-framework";

// 토스 앱 기능(브릿지). 브라우저에서 열면(개발) 브릿지가 없어 실패하므로 브라우저 기능으로 대신한다

export async function loadValue(key: string): Promise<string | null> {
  try {
    return await Storage.getItem(key);
  } catch {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
}

export async function saveValue(key: string, value: string): Promise<void> {
  try {
    await Storage.setItem(key, value);
  } catch {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* 저장 못 해도 이번 실행은 그대로 쓴다 */
    }
  }
}

/** 원문은 기기 브라우저로 연다(토스 화면 안에 다른 사이트를 띄우지 않는다) */
export async function openExternal(url: string): Promise<void> {
  try {
    await openURL(url);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

export async function closeApp(): Promise<void> {
  try {
    await closeView();
  } catch {
    /* 브라우저에서는 닫을 창이 없다 */
  }
}

/**
 * 토스 네비게이션 바 뒤로가기·안드로이드 백버튼. 구독하면 기본 동작이 막히므로 handler가 화면을 되돌리거나 앱을 닫는다.
 * 브라우저(개발)에서는 아무 일도 하지 않는다
 */
export function onBack(handler: () => void): () => void {
  try {
    return graniteEvent.addEventListener("backEvent", { onEvent: handler, onError: () => {} });
  } catch {
    return () => {};
  }
}
