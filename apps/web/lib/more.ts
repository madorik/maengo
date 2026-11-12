// '더 보기'(2026-11-12 사용자): 브리핑(하루 소식)을 다 받은 뒤 10개씩, 브리핑마다 30개까지 더 본다. 맹고(재화)는 쓰지 않는다.
// 서버(app/api/feed/today/fill)와 오늘 화면(components/today/TodayList·FillToday)이 같이 쓴다.

/** 한 번에 더 보여 주는 수 */
export const MORE_STEP = 10;
/** 브리핑마다 더 볼 수 있는 수. 넘으려 하면 '오전/오후 주요 뉴스는 다 봤어요!' */
export const MORE_MAX = 30;
