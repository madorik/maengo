-- 가입 트리거 함수는 트리거로만 돈다. API(rpc)로 직접 부를 수 없게 실행 권한을 거둔다.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
