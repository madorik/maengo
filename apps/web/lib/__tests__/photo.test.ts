import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNotPhoto, smallPhoto } from '../photo';

test('사진이 아닌 대표 이미지(링크 카드·로고)는 뺀다', () => {
  assert.equal(isNotPhoto('https://social.news.hada.io/topic/36592'), true);
  assert.equal(isNotPhoto('https://r.yna.co.kr/global/home/v01/img/yonhapnews_logo_1200x800_kr01.jpg'), true);
  assert.equal(isNotPhoto('https://img.sbs.co.kr/newimg/news/20261014/202231511_1280.jpg'), false);
  assert.equal(isNotPhoto('https://cdn.example.com/blogger-photo.jpg'), false);
  assert.equal(isNotPhoto('주소 아님'), true);
});

test('언론사가 주는 작은 크기 주소(2026-11-11 확인한 곳)', () => {
  assert.equal(smallPhoto('https://img.sbs.co.kr/newimg/news/20261014/202231511_1280.jpg'), 'https://img.sbs.co.kr/newimg/news/20261014/202231511_300.jpg');
  assert.equal(smallPhoto('https://img.sbs.co.kr/newimg/news/20261014/202231511_1280.jpg', 'card'), 'https://img.sbs.co.kr/newimg/news/20261014/202231511_700.jpg');
  assert.equal(smallPhoto('https://img.hankyung.com/photo/202611/01.46369196.1.jpg'), 'https://img.hankyung.com/photo/202611/01.46369196.3.jpg');
  assert.equal(smallPhoto('https://dimg.donga.com/wps/NEWS/IMAGE/2026/11/09/134993474.1.jpg'), 'https://dimg.donga.com/a/300/0/90/5/wps/NEWS/IMAGE/2026/11/09/134993474.1.jpg');
  assert.equal(smallPhoto('https://dimg.donga.com/wps/NEWS/IMAGE/2026/11/09/134993474.1.jpg', 'card'), 'https://dimg.donga.com/a/600/0/90/5/wps/NEWS/IMAGE/2026/11/09/134993474.1.jpg');
  assert.match(smallPhoto('https://platform.theverge.com/wp-content/uploads/a.jpg?quality=90&strip=all&w=1200')!, /[?&]w=320(&|$)/);
  assert.equal(smallPhoto('https://cdn.aitimes.com/news/photo/202611/217162_221368_1811.png'), 'https://cdn.aitimes.com/news/thumbnail/202611/217162_221368_1811_v150.jpg');
  assert.equal(smallPhoto('https://cdn.irobotnews.com/news/photo/202611/49495_105564_359.jpg'), 'https://cdn.irobotnews.com/news/thumbnail/202611/49495_105564_359_v150.jpg');
  // 확인하지 않은 곳은 원본 그대로
  assert.equal(smallPhoto('https://img3.yna.co.kr/photo/yna/YH/2026/11/09/PYH2026110901310001301_P4.jpg'), null);
  assert.equal(smallPhoto('https://cdn.blockmedia.co.kr/wp-content/uploads/2026/10/bm-card-1157490-2c028a90.jpg'), null);
});
