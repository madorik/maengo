-- 부동산 상세 관심사 정리(2026-10-10): 청약·분양, 전월세, 재건축·재개발은 지역마다 사정이 달라 뺀다. 부동산 정책·세금만 남긴다.
-- packages/core/src/topics/dictionary.ts와 같다. 이 셋을 고른 사람은 부동산 분야 전체로 옮긴다.
insert into public.user_topics (user_id, topic_id, weight, source)
select distinct user_id, 'realestate', 1, 'settings' from public.user_topics
where topic_id in ('re-subscription', 're-rent', 're-redevelop')
on conflict (user_id, topic_id) do nothing;

update public.feedback set topic_id = null where topic_id in ('re-subscription', 're-rent', 're-redevelop');
update public.feeds set topic_id = 'realestate' where topic_id in ('re-subscription', 're-rent', 're-redevelop');
delete from public.cluster_why where topic_id in ('re-subscription', 're-rent', 're-redevelop');
delete from public.cluster_topics where topic_id in ('re-subscription', 're-rent', 're-redevelop');
delete from public.user_topics where topic_id in ('re-subscription', 're-rent', 're-redevelop');
delete from public.topics where id in ('re-subscription', 're-rent', 're-redevelop');
