import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyFcmError, errorNote, failureCodes, fcmErrorCode } from '../fcm';

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
});

test('APNs·웹 푸시 키 문제(THIRD_PARTY_AUTH_ERROR, 401)는 다시 보내지 않는다(2026-11-26 iOS 알림 3주 0건)', () => {
  assert.equal(classifyFcmError(401, body('UNAUTHENTICATED', 'THIRD_PARTY_AUTH_ERROR')), 'error');
  // 우리 접근 토큰이 거절된 401은 그대로 잠깐의 실패
  assert.equal(classifyFcmError(401, body('UNAUTHENTICATED')), 'retry');
});

test('오류 코드를 기록에 남긴다', () => {
  assert.equal(fcmErrorCode(401, body('UNAUTHENTICATED', 'THIRD_PARTY_AUTH_ERROR')), 'THIRD_PARTY_AUTH_ERROR');
  assert.equal(fcmErrorCode(503, body('UNAVAILABLE')), 'UNAVAILABLE');
  assert.equal(fcmErrorCode(502, null), 'HTTP 502');
  const results = [
    { result: 'error' as const, code: 'THIRD_PARTY_AUTH_ERROR' },
    { result: 'error' as const, code: 'THIRD_PARTY_AUTH_ERROR' },
    { result: 'retry' as const, code: 'UNAVAILABLE' },
    { result: 'retry' as const },
  ];
  assert.equal(failureCodes(results, 'error'), 'THIRD_PARTY_AUTH_ERROR');
  assert.equal(failureCodes(results, 'retry'), 'UNAVAILABLE');
  assert.match(errorNote('THIRD_PARTY_AUTH_ERROR'), /APNs 인증 키/);
  assert.equal(errorNote('PERMISSION_DENIED'), 'FCM 발송 실패(PERMISSION_DENIED)');
  assert.equal(errorNote(''), 'FCM 발송 실패(코드 없음)');
});
