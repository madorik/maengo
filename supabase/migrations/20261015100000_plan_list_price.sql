-- 정가와 할인(2026-10-15 사용자 결정: Premium 정가 5,900원에 취소선, 3,800원으로 결제).
-- price_krw = 실제 결제 금액(스토어 상품 가격과 같게), list_price_krw = 화면에 취소선으로 보여 주는 정가(null이면 할인 없음).
-- 할인율은 화면에서 계산한다(내림, core/plans.ts discountPct). 대시보드에서 손으로 먼저 돌려도 되게 여러 번 돌려도 같은 결과가 나오게 쓴다.
alter table public.plans add column if not exists list_price_krw int;
alter table public.plans drop constraint if exists plans_list_price_check;
alter table public.plans add constraint plans_list_price_check check (list_price_krw is null or (list_price_krw > 0 and list_price_krw > price_krw));
update public.plans set price_krw = 3800, list_price_krw = 5900, updated_at = now() where id = 'plus';
