-- Free도 맹고 추가 구매(2026-10-15 사용자 결정, apps/mobile/BILLING.md·맹고-문서/플랜.md). 운영 DB는 그때 표를 직접 고쳐서 이미 이 값이고,
-- 마이그레이션이 없어 마이그레이션으로 새로 만든 DB(로컬)만 Free가 불가로 남아 있었다(2026-10-26 확인). 여러 번 돌려도 같다
update public.plans set can_buy_maengo = true where id = 'free' and can_buy_maengo is distinct from true;
