// OpenAI 구조화 출력(strict json_schema)에 맞게 JSON 스키마를 바꾼다(2026-11-13, 오늘의 흐름을 gpt-6-luna로).
// strict 모드는 객체마다 additionalProperties:false와 모든 속성을 required로 요구한다. Gemini용 스키마(lib/server/briefing-insight.ts SCHEMA)를 그대로 쓰려고 바꿔서 보낸다

export function strictSchema<T>(schema: T): T {
  if (Array.isArray(schema)) return schema.map(strictSchema) as T;
  if (schema && typeof schema === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema)) out[k] = strictSchema(v);
    if (out.type === "object" && out.properties && typeof out.properties === "object") {
      out.additionalProperties = false;
      out.required = Object.keys(out.properties);
    }
    return out as T;
  }
  return schema;
}
