-- 마지막으로 앱을 연 때(2026-10-18 점검). 로그인한 화면을 그릴 때 하루(KST) 한 번만 고친다(apps/web/lib/server/visits.ts, 응답 뒤 after).
-- 1분 배송은 일주일 넘게 안 연 사람에게 새로 요약하지 않고 이미 요약된 소식으로만 하루 소식을 만든다(알림은 보내 다시 부른다,
-- pipeline/src/deliveries.ts). 값이 없으면 가입 시각으로 본다. 이 열이 없을 때(마이그레이션 전)는 배송이 모두 활동 중으로 본다.
-- 서버 키로만 쓴다(클라이언트의 profiles 쓰기는 20261018191000에서 막았다).
alter table public.profiles add column if not exists last_seen_at timestamptz;

-- 지금까지의 접속 기록(visits, 2026-10-11부터)으로 채운다. 그날 0시(KST)로 넣는다(하루 단위 기록이라)
update public.profiles p
   set last_seen_at = v.last
  from (select user_id, (max(date)::timestamp at time zone 'Asia/Seoul') as last from public.visits group by user_id) v
 where v.user_id = p.id and p.last_seen_at is null;
