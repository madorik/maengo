-- 요약 실패 세기(2026-10-18 점검). 돈을 내고 받은 요약이 비었거나(안전 필터·출력 토큰 한도) JSON이 깨지면 skip_reason 없이 실패로만 끝나서,
-- 1분 배송이 사람마다·실행마다 같은 묶음을 다시 골라 또 불렀다(그때마다 과금). 묶음마다 실패를 세어 세 번이면 skip_reason을 채워
-- 후보에서 뺀다(pipeline/src/jobs/summarize.ts, 횟수는 코드의 MAX_SUMMARY_FAILURES가 넘긴다).
-- 이 마이그레이션 전에는 함수가 없어 세지 못할 뿐 요약은 그대로 돈다(코드가 오류를 로그로만 남긴다).
-- 열 추가는 상수 기본값이라 표를 다시 쓰지 않는다.
alter table public.clusters add column if not exists summary_failures int not null default 0;

-- 실패를 하나 더 센다. p_max번째면 skip_reason을 채운다(이미 다른 이유로 빠졌으면 그대로). 센 뒤의 횟수를 돌려준다
create or replace function public.note_summary_failure(p_cluster bigint, p_reason text, p_max int) returns int
language sql security definer set search_path = '' as $$
  update public.clusters
     set summary_failures = summary_failures + 1,
         skip_reason = case when skip_reason is null and summary_failures + 1 >= p_max
                            then left('요약 실패 ' || (summary_failures + 1) || '번: ' || coalesce(p_reason, ''), 200)
                            else skip_reason end
   where id = p_cluster
  returning summary_failures;
$$;
revoke all on function public.note_summary_failure(bigint, text, int) from public, anon, authenticated;
grant execute on function public.note_summary_failure(bigint, text, int) to service_role;
