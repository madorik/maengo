import { CATEGORY_LABEL } from "@maengo/core/categories";
import { beforeNotify } from "@maengo/core/kst";
import { NextResponse, type NextRequest } from "next/server";
import { widgetToday } from "@/lib/server/feed";
import { loadProfile } from "@/lib/server/profile";
import { readWidgetToken } from "@/lib/server/widget-token";

/** 위젯이 그리는 소식 줄 수의 최대(큰 위젯 기준). 위젯은 자기 크기만큼 앞에서부터 그린다 */
const MAX_ITEMS = 5;

/**
 * GET (Authorization: Bearer <위젯 토큰>) → 홈 화면 위젯(앱 1.3부터)이 그릴 오늘 소식.
 * { date, total, done, empty, refreshAt, items: [{ id, title, category, categoryLabel, read }] }
 * empty는 소식이 없을 때 위젯에 보일 한 줄(알림 시각 전이면 언제 오는지). 문구는 여기서 정해 위젯 코드(iOS·안드로이드)는 그리기만 한다.
 * refreshAt은 알림 시각 전이면 소식이 올 즈음(알림 3분 뒤, ISO). iOS 위젯은 이때 다시 부른다(안드로이드는 한 시간마다).
 * 위젯이 한 시간쯤마다 부르고, 앱은 읽음이 바뀌면 위젯을 다시 그리게 한다. 피드를 만들거나 채우지 않는다(widgetToday)
 */
export async function GET(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const userId = await readWidgetToken(bearer);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const profile = await loadProfile(userId, { provider: "google", email: null, avatarUrl: null, demo: false });
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const today = await widgetToday(profile);
  const waiting = beforeNotify(profile.notifyAt);
  const empty = today.items.length ? null : waiting ? `오늘 소식은 ${today.notifyLabel}에 와요` : "맹고를 열어 오늘 소식을 받아 보세요";
  const refreshAt = waiting ? new Date(Date.parse(`${today.date}T${profile.notifyAt}:00+09:00`) + 3 * 60_000).toISOString() : null;
  return NextResponse.json(
    {
      date: today.date,
      total: today.items.length,
      done: today.items.filter((i) => i.read).length,
      empty,
      refreshAt,
      items: today.items.slice(0, MAX_ITEMS).map((i) => ({ ...i, categoryLabel: CATEGORY_LABEL[i.category] })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
