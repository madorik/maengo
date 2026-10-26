import assert from 'node:assert/strict';
import { test } from 'node:test';
import { framedReply, inquirySubject, lineBreakSentences, parseInquiry, replySubject, replyText, stripReplyFrame } from '../inquiry';

test('문의 양식: 종류·내용·메일을 확인한다', () => {
  assert.deepEqual(parseInquiry({ category: 'billing', body: '  환불하고 싶어요. 어제 결제했어요  ', replyTo: ' a@b.co ' }), {
    ok: true,
    value: { category: 'billing', body: '환불하고 싶어요. 어제 결제했어요', replyTo: 'a@b.co' },
  });
  assert.equal(parseInquiry({ category: null, body: '내용이 있어요', replyTo: 'a@b.co' }).ok, false);
  assert.equal(parseInquiry({ category: 'hack', body: '내용이 있어요', replyTo: 'a@b.co' }).ok, false);
  assert.equal(parseInquiry({ category: 'bug', body: '짧음', replyTo: 'a@b.co' }).ok, false);
  assert.equal(parseInquiry({ category: 'bug', body: 'x'.repeat(2001), replyTo: 'a@b.co' }).ok, false);
  assert.equal(parseInquiry({ category: 'bug', body: '내용이 있어요', replyTo: 'not-mail' }).ok, false);
  // 애플 '이메일 가리기' 주소도 받는다
  assert.equal(parseInquiry({ category: 'other', body: '내용이 있어요', replyTo: 'x1y2@privaterelay.appleid.com' }).ok, true);
});

test('메일 제목: 종류와 첫 줄 앞부분', () => {
  assert.equal(inquirySubject('billing', '\n\n환불하고 싶어요\n둘째 줄'), '[맹고 문의·결제·환불] 환불하고 싶어요');
  assert.equal(inquirySubject('bug', '가'.repeat(50)), `[맹고 문의·오류 신고] ${'가'.repeat(40)}…`);
});

test('회원에게 가는 답장: 제목, 답장 + 보낸 문의 인용 + 답장하면 어디로 가는지', () => {
  assert.equal(replySubject('\n아이패드에서도 쓸 수 있나요?\n둘째 줄'), '[맹고] 문의에 답드려요: 아이패드에서도 쓸 수 있나요?');
  const text = replyText('  네, 쓸 수 있어요.  ', { body: '아이패드?\n둘째 줄', category: 'other', createdAt: '2026-10-26T01:00:00Z' }, 'https://watalabs.com/maengo');
  assert.equal(
    text,
    ['네, 쓸 수 있어요.', '', '──────────', '보내 주신 문의(10월 26일, 기타)', '> 아이패드?', '> 둘째 줄', '', '이 메일에 회신하시면 맹고 운영자에게 전달됩니다.', '와타랩스 맹고 · https://watalabs.com/maengo'].join('\n'),
  );
});

test('답장 틀: 첫 인사·맺음말은 늘 같고, AI가 틀까지 써 와도 두 번 붙지 않는다', () => {
  const framed = '안녕하세요. 와타랩스 맹고입니다.\n문의하신 내용에 답변드립니다.\n\n아이패드에서도 쓰실 수 있습니다.\n\n감사합니다.';
  assert.equal(framedReply('아이패드에서도 쓰실 수 있습니다.'), framed);
  assert.equal(framedReply('안녕하세요. 맹고입니다. 문의하신 내용에 답변드립니다.\n아이패드에서도 쓰실 수 있습니다.\n감사합니다.'), framed);
  assert.equal(stripReplyFrame('  감사 인사를 드립니다.  '), '감사 인사를 드립니다.');
  // 본문 문장 끝의 '감사합니다'는 맺음말이 아니다(따로 한 줄일 때만 뗀다)
  assert.equal(stripReplyFrame('좋은 제안을 보내 주셔서 감사합니다.'), '좋은 제안을 보내 주셔서 감사합니다.');
  assert.equal(framedReply(''), '안녕하세요. 와타랩스 맹고입니다.\n문의하신 내용에 답변드립니다.\n\n\n\n감사합니다.');
});

test('답장 줄바꿈: 문장마다, 문단은 그대로, 숫자·주소는 안 끊는다', () => {
  assert.equal(
    lineBreakSentences('환불 대상입니다. 진행해 드리겠습니다.\n\n월 3.8천 원이 아니라 3,800원입니다. reportaproblem.apple.com에서 요청해 주세요. 괜찮으신가요? 네.'),
    '환불 대상입니다.\n진행해 드리겠습니다.\n\n월 3.8천 원이 아니라 3,800원입니다.\nreportaproblem.apple.com에서 요청해 주세요.\n괜찮으신가요?\n네.',
  );
});
