-- 유튜브 채널 출처를 끈다(2026-10-23 사용자 결정: 영상은 요약하지 않는다).
-- 서버는 영상을 요약하지 않아(배송 videos: 0, summarize 태스크는 10-15부터 꺼짐) 요약 안 된 영상은 배송되지 않는데,
-- 임베딩 상한의 19%를 차지했다(10-17~23 영상 603개 임베딩, 배송 묶음 95개 중 영상 6개). 코드 목록(pipeline/src/sources.ts)에서도 뺐다.
-- 내 관심 링크는 원래 유튜브를 받지 않는다(custom 출처는 건드리지 않는다).
update public.sources set active = false where kind = 'youtube' and not custom;
