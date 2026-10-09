import assert from 'node:assert/strict';
import { test } from 'node:test';
import { youtubeId, youtubeThumbnail } from '../util/youtube';

test('유튜브 주소에서 영상 ID 뽑기', () => {
  assert.equal(youtubeId('https://www.youtube.com/watch?v=jNQXAC9IVRw&t=30s'), 'jNQXAC9IVRw');
  assert.equal(youtubeId('https://youtu.be/jNQXAC9IVRw?si=abc'), 'jNQXAC9IVRw');
  assert.equal(youtubeId('https://m.youtube.com/shorts/jNQXAC9IVRw'), 'jNQXAC9IVRw');
  assert.equal(youtubeId('https://www.youtube.com/embed/jNQXAC9IVRw'), 'jNQXAC9IVRw');
  assert.equal(youtubeId('https://www.youtube.com/results?search_query=rag'), null);
  assert.equal(youtubeId('https://example.com/watch?v=jNQXAC9IVRw'), null);
  assert.equal(youtubeId('not a url'), null);
  assert.equal(youtubeThumbnail('jNQXAC9IVRw'), 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg');
});
