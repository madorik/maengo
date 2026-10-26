"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/server/admin";
import { replyInquiry, setInquiryStatus, type ReplyResult } from "@/lib/server/inquiry";
import { draftInquiryReply } from "@/lib/server/inquiry-draft";
import { requireProfile } from "@/lib/server/session";

// 관리자 > 문의 탭: 답장 보내기, AI로 다시 쓰기, 닫기·다시 열기. 관리자만(ADMIN_EMAILS)

async function adminOnly() {
  const profile = await requireProfile();
  if (!isAdmin(profile)) throw new Error("관리자만 할 수 있어요");
}

const idOf = (formData: FormData) => {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) throw new Error("bad_inquiry_id");
  return id;
};

export async function replyInquiryAction(_prev: ReplyResult | null, formData: FormData): Promise<ReplyResult> {
  await adminOnly();
  const res = await replyInquiry(idOf(formData), String(formData.get("body") ?? ""));
  if (res.ok) revalidatePath("/admin");
  return res;
}

export async function closeInquiryAction(formData: FormData) {
  await adminOnly();
  await setInquiryStatus(idOf(formData), formData.get("reopen") === "1" ? "open" : "closed");
  revalidatePath("/admin");
}

/** AI로 답장 초안 다시 쓰기(처음 초안이 없거나 마음에 안 들 때). 새 초안이 답장 칸에 채워진다 */
export async function redraftInquiryAction(_prev: ReplyResult | null, formData: FormData): Promise<ReplyResult> {
  await adminOnly();
  const draft = await draftInquiryReply(idOf(formData));
  if (!draft) return { ok: false, error: "AI가 답장을 쓰지 못했어요. 잠시 뒤 다시 눌러 주세요." };
  revalidatePath("/admin");
  return { ok: true };
}
