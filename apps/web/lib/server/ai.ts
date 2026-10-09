import 'server-only';
import { createDummyAi } from '@maengo/core/ai';
import { CLUSTER_BY_ID } from './demo-clusters';

// 지금은 더미 응답만 쓴다. GEMINI_API_KEY가 들어오면 여기서 Gemini 클라이언트로 바꾼다.
// 어떤 모델을 부를지는 호출하는 쪽이 modelForPlan(profile.plan)으로 정해 넘긴다.
export const ai = createDummyAi({
  whyBody: (clusterId, topicId) => CLUSTER_BY_ID.get(clusterId)?.why[topicId],
});

/** 오디오 대본·음성 모델. 오디오는 플러스 전용이라 상위 등급만 쓴다. */
export function ttsModel(): string {
  return process.env.GEMINI_TTS_MODEL?.trim() || 'gemini-2.5-flash-preview-tts';
}
