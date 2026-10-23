package kr.maengo.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 홈 화면 위젯 '오늘 소식'(앱 1.3부터). 웹의 /api/widget을 위젯 토큰으로 불러 오늘 소식 세 줄을 그린다.
 * 토큰과 주소는 로그인한 웹 화면이 MaengoWidgetPlugin으로 넘긴다(apps/web/lib/native/widget.ts). 없으면 '로그인' 안내.
 * 한 시간마다(today_widget_info.xml) 그리고 앱이 부를 때(refreshAll) 다시 그린다. 연결이 없으면 마지막으로 받은 것을 그린다.
 * 줄을 누르면 kr.maengo.app://open/article/<id>로 앱을 열고, 웹(lib/native/shell.ts)이 그 화면으로 옮긴다.
 */
public class TodayWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "maengo_widget";
    static final String KEY_TOKEN = "token";
    static final String KEY_ENDPOINT = "endpoint";
    private static final String KEY_LAST = "last";

    private static final int[] ROW_IDS = { R.id.widget_row0, R.id.widget_row1, R.id.widget_row2 };
    private static final int[] CAT_IDS = { R.id.widget_cat0, R.id.widget_cat1, R.id.widget_cat2 };
    private static final int[] TITLE_IDS = { R.id.widget_title0, R.id.widget_title1, R.id.widget_title2 };

    /** 네트워크는 한 줄로 차례차례(위젯이 여러 개여도 한 번에 하나) */
    private static final ExecutorService EXEC = Executors.newSingleThreadExecutor();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        PendingResult pending = goAsync();
        Context app = context.getApplicationContext();
        EXEC.execute(() -> {
            try {
                refresh(app, manager, ids);
            } finally {
                pending.finish();
            }
        });
    }

    /** 토큰이 바뀌었거나(로그인·로그아웃) 읽음이 바뀌었을 때 앱이 부른다(MaengoWidgetPlugin) */
    static void refreshAll(Context context) {
        Context app = context.getApplicationContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(app);
        int[] ids = manager.getAppWidgetIds(new ComponentName(app, TodayWidgetProvider.class));
        if (ids.length == 0) return;
        EXEC.execute(() -> refresh(app, manager, ids));
    }

    private static void refresh(Context context, AppWidgetManager manager, int[] ids) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String token = prefs.getString(KEY_TOKEN, null);
        String endpoint = prefs.getString(KEY_ENDPOINT, null);
        RemoteViews views;
        if (token == null || endpoint == null) {
            views = message(context, context.getString(R.string.widget_signed_out));
        } else {
            Fetch fetched = fetch(endpoint, token);
            if (fetched.unauthorized) {
                // 탈퇴했거나 토큰이 무효가 됐다. 다시 로그인하면 앱이 새 토큰을 넘긴다
                prefs.edit().remove(KEY_TOKEN).remove(KEY_LAST).apply();
                views = message(context, context.getString(R.string.widget_signed_out));
            } else {
                String json = fetched.body;
                if (json != null) prefs.edit().putString(KEY_LAST, json).apply();
                else json = prefs.getString(KEY_LAST, null);
                views = json != null ? render(context, json) : null;
                if (views == null) views = message(context, context.getString(R.string.widget_failed));
            }
        }
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    private static final class Fetch {
        @Nullable
        final String body;
        final boolean unauthorized;

        Fetch(@Nullable String body, boolean unauthorized) {
            this.body = body;
            this.unauthorized = unauthorized;
        }
    }

    private static Fetch fetch(String endpoint, String token) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(endpoint).openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Accept", "application/json");
            int status = conn.getResponseCode();
            if (status == 401) return new Fetch(null, true);
            if (status != 200) return new Fetch(null, false);
            try (InputStream in = conn.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                return new Fetch(out.toString(StandardCharsets.UTF_8.name()), false);
            }
        } catch (Exception e) {
            return new Fetch(null, false);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /** /api/widget 응답으로 그린다. 읽을 수 없는 응답이면 null */
    @Nullable
    private static RemoteViews render(Context context, String json) {
        try {
            JSONObject data = new JSONObject(json);
            JSONArray items = data.getJSONArray("items");
            RemoteViews views = base(context);
            if (items.length() == 0) {
                views.setTextViewText(R.id.widget_empty, data.optString("empty", ""));
                views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
                return views;
            }
            views.setViewVisibility(R.id.widget_empty, View.GONE);
            views.setTextViewText(R.id.widget_meta, "읽음 " + data.optInt("done") + "/" + data.optInt("total"));
            int ink = ContextCompat.getColor(context, R.color.maengo_ink);
            int faint = ContextCompat.getColor(context, R.color.maengo_faint);
            for (int i = 0; i < ROW_IDS.length; i++) {
                if (i >= items.length()) {
                    views.setViewVisibility(ROW_IDS[i], View.GONE);
                    continue;
                }
                JSONObject item = items.getJSONObject(i);
                views.setViewVisibility(ROW_IDS[i], View.VISIBLE);
                views.setTextViewText(CAT_IDS[i], item.optString("categoryLabel"));
                views.setTextViewText(TITLE_IDS[i], item.optString("title"));
                // 읽은 소식은 흐리게(앱 오늘 목록과 같다)
                views.setTextColor(TITLE_IDS[i], item.optBoolean("read") ? faint : ink);
                views.setOnClickPendingIntent(ROW_IDS[i], open(context, "/article/" + item.optLong("id"), i + 1));
            }
            return views;
        } catch (Exception e) {
            return null;
        }
    }

    /** 소식 줄 없이 한 줄 안내만 */
    private static RemoteViews message(Context context, String text) {
        RemoteViews views = base(context);
        views.setTextViewText(R.id.widget_empty, text);
        views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
        for (int row : ROW_IDS) views.setViewVisibility(row, View.GONE);
        return views;
    }

    /** 위젯 전체(머리줄 포함)를 누르면 오늘 화면 */
    private static RemoteViews base(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);
        views.setTextViewText(R.id.widget_meta, "");
        views.setOnClickPendingIntent(R.id.widget_root, open(context, "/today", 0));
        return views;
    }

    /** kr.maengo.app://open<path>?from=widget 로 앱을 연다. requestCode가 달라야 줄마다 다른 PendingIntent가 된다 */
    private static PendingIntent open(Context context, String path, int requestCode) {
        Uri uri = Uri.parse(context.getString(R.string.custom_url_scheme) + "://open" + path + "?from=widget");
        Intent intent = new Intent(Intent.ACTION_VIEW, uri, context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
