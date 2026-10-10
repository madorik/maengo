-- Fireship 유튜브는 첫 수집(2026-10-09) 때 RSS가 404를 한 번 내서 꺼 뒀다. 지금은 정상이라 유튜브 출처를 늘리며 다시 켠다.
update public.sources
set active = true, fail_count = 0, last_error = null
where url = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA';
