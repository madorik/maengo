import assert from 'node:assert/strict';
import { test } from 'node:test';
import { strictSchema } from '../openai-schema';

test('OpenAI strict 스키마: 객체마다 additionalProperties:false·모든 속성 required, 원래 스키마는 그대로', () => {
  const schema = {
    type: 'object',
    properties: {
      headline: { type: 'string' },
      personal: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, text: { type: 'string' } }, required: ['id'] } },
    },
    required: ['headline'],
  };
  const out = strictSchema(schema) as typeof schema & { additionalProperties: boolean };
  assert.equal(out.additionalProperties, false);
  assert.deepEqual(out.required, ['headline', 'personal']);
  const item = out.properties.personal.items as unknown as { additionalProperties: boolean; required: string[] };
  assert.equal(item.additionalProperties, false);
  assert.deepEqual(item.required, ['id', 'text']);
  assert.deepEqual(schema.required, ['headline']);
  assert.equal('additionalProperties' in schema, false);
});
