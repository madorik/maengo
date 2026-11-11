"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/server/session";
import { SKIP, followUpOf, type PickedQuestion } from "@/lib/context";
import { setPersonalInsight, setUserContext } from "@/lib/server/user-context";

// 내 맞춤 정보 답하기·바꾸기·지우기(lib/context.ts). 오늘 화면의 맞춤 체크 질문과 '내 관심 키워드' 화면이 부른다

/**
 * 답하기. day(한국 날짜)는 소식을 보다 답할 때만(새 질문은 하루에 하나). 이어 묻는 질문이 있으면 같이 돌려준다(같은 자리에서 바로 묻는다).
 * 오늘 화면의 맞춤 체크는 다음에 열 때 이 답으로 다시 만들어진다
 */
export async function answerContextAction(key: string, value: string, day?: string): Promise<{ ok: boolean; next?: PickedQuestion | null }> {
  const profile = await requireProfile();
  const ok = await setUserContext(profile.id, key, value, day);
  if (ok) {
    revalidatePath("/today");
    revalidatePath("/keywords");
  }
  return { ok, next: ok && value !== SKIP ? followUpOf(key, value) : null };
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

/** 설정 > 맞춤 인사이트 켜고 끄기 */
export async function setPersonalInsightAction(on: boolean): Promise<{ ok: boolean }> {
  const profile = await requireProfile();
  await setPersonalInsight(profile.id, on);
  revalidatePath("/today");
  revalidatePath("/settings");
  return { ok: true };
}
