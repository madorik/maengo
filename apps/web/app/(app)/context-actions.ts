"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/server/session";
import { setUserContext } from "@/lib/server/user-context";

// 내 맞춤 정보 답하기·바꾸기·지우기(lib/context.ts). 오늘 화면의 맞춤 체크 질문과 '내 관심 키워드' 화면이 부른다

/** 답하기. briefing('날짜:am|pm')은 오늘 화면에서 답할 때만(새 질문은 브리핑마다 하나) */
export async function answerContextAction(key: string, value: string, briefing?: string): Promise<{ ok: boolean }> {
  const profile = await requireProfile();
  const ok = await setUserContext(profile.id, key, value, briefing);
  if (ok) {
    revalidatePath("/today");
    revalidatePath("/keywords");
  }
  return { ok };
}

export async function clearContextAction(key: string): Promise<{ ok: boolean }> {
  const profile = await requireProfile();
  const ok = await setUserContext(profile.id, key, null);
  if (ok) {
    revalidatePath("/today");
    revalidatePath("/keywords");
  }
  return { ok };
}
