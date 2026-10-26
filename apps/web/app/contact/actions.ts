"use server";

import { submitInquiry, type InquiryResult } from "@/lib/server/inquiry";
import { currentProfile } from "@/lib/server/session";

/** 문의하기 양식 보내기(로그인하지 않아도 된다). website는 사람 눈에 안 보이는 스팸 덫 칸 */
export async function sendInquiryAction(_prev: InquiryResult | null, formData: FormData): Promise<InquiryResult> {
  const profile = await currentProfile();
  return submitInquiry(profile, {
    category: formData.get("category"),
    body: formData.get("body"),
    replyTo: formData.get("replyTo"),
    trap: formData.get("website"),
  });
}
