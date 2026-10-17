package kr.maengo.app;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * 듣기 알림의 버튼(이전·재생/일시정지·다음)과 알림을 밀어 지울 때. 서비스가 이미 내려가 있어도 받을 수 있게
 * 방송(broadcast)으로 받아 웹 플레이어에 넘긴다(MaengoMediaPlugin.dispatch).
 */
public class MediaActionReceiver extends BroadcastReceiver {

    private static final String EXTRA_ACTION = "action";
    /** 멈춘 뒤 남은 알림을 밀어 지웠을 때 */
    static final String DISMISS = "dismiss";

    static PendingIntent intent(Context context, String action) {
        Intent i = new Intent(context, MediaActionReceiver.class).setAction("kr.maengo.app.media." + action).putExtra(EXTRA_ACTION, action);
        return PendingIntent.getBroadcast(context, action.hashCode(), i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getStringExtra(EXTRA_ACTION);
        if (action == null) return;
        if (DISMISS.equals(action)) {
            MediaPlaybackService.shutdown(context);
            return;
        }
        MaengoMediaPlugin.dispatch(action, null);
    }
}
