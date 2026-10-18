-- 하루 소식 수를 출시 값으로 되돌린다(2026-10-18 사용자 결정). 10-15에 시험 때문에 운영 DB에서 직접 Free 1·Premium 1로 낮춰 뒀다
update public.plans set daily_items = 3, updated_at = now() where id = 'free';
update public.plans set daily_items = 10, updated_at = now() where id = 'plus';
