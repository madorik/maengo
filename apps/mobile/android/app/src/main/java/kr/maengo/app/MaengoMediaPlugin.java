package kr.maengo.app;

import androidx.annotation.Nullable;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 듣기를 화면 밖에서도 이어 가게 한다(apps/web/lib/native/media.ts).
 * 웹 플레이어가 재생·멈춤·제목이 바뀔 때마다 update를 부르면 재생 중에는 포그라운드 서비스(MediaPlaybackService)를 띄워
 * 다른 앱으로 가도 앱이 얼지 않게 하고, 알림·잠금 화면·이어폰 버튼은 'action' 이벤트로 웹 플레이어에 넘긴다.
 * 안드로이드 웹뷰는 웹 표준 Media Session을 시스템에 띄우지 않아서 이 플러그인이 대신한다(iOS는 웹뷰가 한다).
 */
@CapacitorPlugin(name = "MaengoMedia")
public class MaengoMediaPlugin extends Plugin {

    private static MaengoMediaPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    /** 알림·잠금 화면·이어폰 버튼을 웹 플레이어로 넘긴다. action은 Media Session 이름(play, pause, nexttrack, seekto…) */
    static void dispatch(String action, @Nullable Double seekTime) {
        MaengoMediaPlugin plugin = instance;
        if (plugin == null) return;
        JSObject data = new JSObject();
        data.put("action", action);
        if (seekTime != null) data.put("seekTime", seekTime);
        plugin.notifyListeners("action", data);
    }

    @PluginMethod
    public void update(PluginCall call) {
        MediaPlaybackService.State state = new MediaPlaybackService.State(
            call.getString("title", ""),
            call.getString("artist", "맹고"),
            call.getString("album", ""),
            Boolean.TRUE.equals(call.getBoolean("playing", false)),
            (long) (call.getDouble("position", 0d) * 1000),
            (long) (call.getDouble("duration", 0d) * 1000),
            call.getFloat("rate", 1f)
        );
        getActivity().runOnUiThread(() -> {
            try {
                MediaPlaybackService.apply(getContext(), state);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            MediaPlaybackService.shutdown(getContext());
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        // 화면(웹뷰)이 없어지면 소리도 멈추므로 알림을 남기지 않는다
        if (instance == this) instance = null;
        MediaPlaybackService.shutdown(getContext());
    }
}
