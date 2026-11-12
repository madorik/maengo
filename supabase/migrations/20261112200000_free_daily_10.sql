-- Free도 브리핑마다 소식 10개(2026-11-12 사용자 결정: "free도 소식 10개 똑같이 주자"). Premium 10개와 같다
update public.plans set daily_items = 10, updated_at = now() where id = 'free';
