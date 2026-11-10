-- 소식 상세의 원문 대표 사진(2026-11-10 사용자 "그 뉴스 소식에서 주는 이미지도 상세 페이지에 같이 보여주게 하자. 지금 유튜브 보여지는것처럼").
-- 이미지 파일은 맹고에 복사하지 않고 주소만 남긴다. 수집할 때 RSS에 붙은 이미지(media:content·media:thumbnail·enclosure·본문 첫 img),
-- 없으면 요약할 때 원문 페이지의 og:image. 로그인한 사람의 상세 화면에서만 원문 주소로 바로 보이고, 누르면 원문으로 간다.
alter table public.items add column if not exists image_url text;
