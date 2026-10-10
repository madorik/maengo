-- 요약(한국어 제목+목록 요약)의 벡터. 원문 임베딩으로는 못 묶은 한·영 같은 소식을 요약 뒤에 찾아 합친다.
alter table public.clusters add column summary_vec extensions.vector(768);
