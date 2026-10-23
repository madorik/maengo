package kr.maengo.app;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 홈 화면 위젯과 웹을 잇는다(apps/web/lib/native/widget.ts, 앱 1.3부터).
 * setToken: 위젯이 /api/widget을 부를 토큰과 주소를 저장하고 다시 그린다. clear: 로그아웃(지우고 '로그인' 안내). reload: 다시 그리기
 */
@CapacitorPlugin(name = "MaengoWidget")
public class MaengoWidgetPlugin extends Plugin {

    @PluginMethod
    public void setToken(PluginCall call) {
        String token = call.getString("token");
        String endpoint = call.getString("endpoint");
        if (token == null || endpoint == null || !endpoint.startsWith("https://") && !endpoint.startsWith("http://")) {
            call.reject("bad_request");
            return;
        }
        getContext()
            .getSharedPreferences(TodayWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(TodayWidgetProvider.KEY_TOKEN, token)
            .putString(TodayWidgetProvider.KEY_ENDPOINT, endpoint)
            .apply();
        TodayWidgetProvider.refreshAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        getContext().getSharedPreferences(TodayWidgetProvider.PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        TodayWidgetProvider.refreshAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void reload(PluginCall call) {
        TodayWidgetProvider.refreshAll(getContext());
        call.resolve();
    }
}
