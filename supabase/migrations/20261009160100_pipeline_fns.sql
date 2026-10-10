-- 파이프라인이 한 번에 여러 행을 고칠 때 쓰는 함수. service role만 부를 수 있다.
create function public.set_item_embeddings(p jsonb) returns int
language sql security invoker set search_path = '' as $$
  with u as (
    update public.items i set embedding = (e->>'v')::extensions.vector
    from jsonb_array_elements(p) e
    where i.id = (e->>'id')::bigint
    returning 1
  )
  select count(*)::int from u;
$$;

create function public.set_item_clusters(p jsonb) returns int
language sql security invoker set search_path = '' as $$
  with u as (
    update public.items i set cluster_id = (e->>'c')::bigint
    from jsonb_array_elements(p) e
    where i.id = (e->>'id')::bigint
    returning 1
  )
  select count(*)::int from u;
$$;

revoke execute on function public.set_item_embeddings(jsonb) from public, anon, authenticated;
revoke execute on function public.set_item_clusters(jsonb) from public, anon, authenticated;
