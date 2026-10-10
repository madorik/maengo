-- 알림 켜고 끄기(2026-10-11). 꺼 두면 알림 시각에 맹고는 만들어 두되 푸시는 보내지 않는다(delivery_jobs 'muted').
-- 기본은 꺼짐: 기기에서 알림 권한을 받고 토큰을 등록한 뒤 켠다(설정 > 알림). 끄면 그 사람의 기기 토큰도 지운다.
alter table public.profiles add column push_enabled boolean not null default false;

alter table public.delivery_jobs drop constraint delivery_jobs_status_check;
alter table public.delivery_jobs add constraint delivery_jobs_status_check
  check (status in ('pending','building','ready','empty','sending','sent','no_device','muted','failed'));
