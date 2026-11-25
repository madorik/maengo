// OpenAI 구조화 출력(strict json_schema)에 맞게 JSON 스키마를 바꾼다(2026-11-13, 오늘의 흐름을 gpt-6-luna로).
// 2026-11-25: 주간 리포트(파이프라인)도 OpenAI를 쓰게 되어 공용(packages/core/src/ai/openai.ts)으로 옮겼다
export { strictSchema } from "@maengo/core/openai";
