import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyFcmError } from '../fcm';

const body = (status: string, errorCode?: string, message = '') => ({ error: { status, message, details: errorCode ? [{ errorCode }] : [] } });

test('토큰이 없어졌으면 지운다(UNREGISTERED·404·SENDER_ID_MISMATCH)', () => {
  assert.equal(classifyFcmError(404, body('NOT_FOUND', 'UNREGISTERED', 'Requested entity was not found.')), 'dead');
  assert.equal(classifyFcmError(404, null), 'dead');
  assert.equal(classifyFcmError(403, body('PERMISSION_DENIED', 'SENDER_ID_MISMATCH')), 'dead');
});

test('INVALID_ARGUMENT는 토큰을 가리킬 때만 지우고, 메시지 모양 문제면 토큰을 둔다', () => {
  assert.equal(classifyFcmError(400, body('INVALID_ARGUMENT', 'INVALID_ARGUMENT', 'The registration token is not a valid FCM registration token')), 'dead');
  assert.equal(classifyFcmError(400, body('INVALID_ARGUMENT', 'INVALID_ARGUMENT', 'Invalid JSON payload received. Unknown name "foo"')), 'error');
  assert.equal(classifyFcmError(400, body('INVALID_ARGUMENT')), 'error');
  assert.equal(classifyFcmError(400, null), 'error');
});

test('429·5xx·인증 실패는 잠깐의 실패(다시 보낸다)', () => {
  assert.equal(classifyFcmError(429, body('RESOURCE_EXHAUSTED', 'QUOTA_EXCEEDED')), 'retry');
  assert.equal(classifyFcmError(503, body('UNAVAILABLE', 'UNAVAILABLE')), 'retry');
  assert.equal(classifyFcmError(500, body('INTERNAL', 'INTERNAL')), 'retry');
  assert.equal(classifyFcmError(502, null), 'retry');
  assert.equal(classifyFcmError(401, body('UNAUTHENTICATED')), 'retry');
});

test('그 밖의 실패는 다시 해도 같다고 보고 토큰도 둔다', () => {
  assert.equal(classifyFcmError(403, body('PERMISSION_DENIED')), 'error');
  assert.equal(classifyFcmError(401, body('UNAUTHENTICATED', 'THIRD_PARTY_AUTH_ERROR')), 'retry');
});
