// 화면 테마(설정 > 화면 > 다크 모드). 켜고 끈 값은 이 기기 localStorage에 두고, <html data-theme>로 붙인다(globals.css가 색을 바꾼다).
// 한 번도 안 눌렀으면 속성 없이 prefers-color-scheme(기기 설정)을 따른다. 첫 그림 전에 붙이는 건 app/layout.tsx의 THEME_SCRIPT.

export const THEME_KEY = "maengo_theme";
/** 테마를 바꾸면 알린다(components/ThemeSync.tsx가 상태 표시줄·theme-color를 맞춘다) */
export const THEME_EVENT = "maengo:theme";
/** 바탕색(globals.css의 --color-paper와 같다). 브라우저 위쪽 막대·앱 상태 표시줄 */
export const PAPER = { light: "#FFFFFF", dark: "#151722" } as const;

/** 그리기 전에 <head>에서 도는 스크립트. 고른 값이 있으면 data-theme을 붙인다 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export function setThemePref(pref: "light" | "dark"): void {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {}
  document.documentElement.setAttribute("data-theme", pref);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** 지금 화면이 어두운지(고른 값, 없으면 시스템) */
export function isDarkNow(): boolean {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "dark") return true;
  if (t === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
