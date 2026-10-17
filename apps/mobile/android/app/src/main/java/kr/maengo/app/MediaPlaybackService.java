package kr.maengo.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

/**
 * 듣는 동안 띄우는 포그라운드 서비스(미디어 재생). 안드로이드는 다른 앱으로 간 앱을 얼려서 웹뷰 소리도 멈추는데,
 * 이 서비스가 떠 있으면 얼리지 않는다. 멈추면 포그라운드에서 내리고 알림만 남겨(밀어서 지울 수 있게) 다시 재생할 수 있게 한다.
 * 알림의 버튼·잠금 화면·이어폰 버튼은 MaengoMediaPlugin.dispatch로 웹 플레이어에 넘긴다.
 */
public class MediaPlaybackService extends Service {

    private static final String TAG = "MaengoMedia";
    /** 설정 > 알림에 '듣기'로 보이는 채널. 소리·진동 없음 */
    private static final String CHANNEL_ID = "listen";
    private static final int NOTIFICATION_ID = 7;

    /** 웹 플레이어가 넘기는 지금 상태 */
    static final class State {

        final String title;
        final String artist;
        final String album;
        final boolean playing;
        final long positionMs;
        final long durationMs;
        final float rate;

        State(String title, String artist, String album, boolean playing, long positionMs, long durationMs, float rate) {
            this.title = title;
            this.artist = artist;
            this.album = album;
            this.playing = playing;
            this.positionMs = positionMs;
            this.durationMs = durationMs;
            this.rate = rate;
        }
    }

    @Nullable
    private static MediaPlaybackService running;

    @Nullable
    private static State pending;

    private MediaSessionCompat session;

    @Nullable
    private State state;

    private boolean foreground;

    @Nullable
    private Bitmap art;

    /** 상태를 반영한다. 서비스가 없을 때는 재생을 시작할 때만 띄운다(멈춘 채로 새로 띄우지 않는다) */
    static void apply(Context context, State s) {
        if (running != null) {
            running.render(s);
            return;
        }
        if (!s.playing) return;
        pending = s;
        ContextCompat.startForegroundService(context, new Intent(context, MediaPlaybackService.class));
    }

    /** 듣기를 끝냈거나 화면이 없어졌을 때: 알림까지 지운다(서비스가 먼저 내려갔어도 남은 알림은 지운다) */
    static void shutdown(Context context) {
        pending = null;
        if (running != null) running.finish();
        else context.getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        running = this;
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "듣기", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("듣는 동안 재생을 멈추거나 다음 소식으로 넘길 수 있어요");
        channel.setShowBadge(false);
        nm.createNotificationChannel(channel);

        session = new MediaSessionCompat(this, TAG);
        session.setCallback(
            new MediaSessionCompat.Callback() {
                @Override
                public void onPlay() {
                    MaengoMediaPlugin.dispatch("play", null);
                }

                @Override
                public void onPause() {
                    MaengoMediaPlugin.dispatch("pause", null);
                }

                @Override
                public void onStop() {
                    MaengoMediaPlugin.dispatch("pause", null);
                }

                @Override
                public void onSkipToNext() {
                    MaengoMediaPlugin.dispatch("nexttrack", null);
                }

                @Override
                public void onSkipToPrevious() {
                    MaengoMediaPlugin.dispatch("previoustrack", null);
                }

                @Override
                public void onFastForward() {
                    MaengoMediaPlugin.dispatch("seekforward", null);
                }

                @Override
                public void onRewind() {
                    MaengoMediaPlugin.dispatch("seekbackward", null);
                }

                @Override
                public void onSeekTo(long pos) {
                    MaengoMediaPlugin.dispatch("seekto", pos / 1000.0);
                }
            }
        );
        session.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // startForegroundService로 띄웠으면 몇 초 안에 startForeground를 불러야 한다
        State s = pending != null ? pending : state;
        pending = null;
        if (s == null) s = new State("", "맹고", "", true, 0, 0, 1f);
        render(s);
        return START_NOT_STICKY;
    }

    private void render(State s) {
        state = s;
        session.setMetadata(
            new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, s.title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, s.artist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, s.album)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, s.durationMs > 0 ? s.durationMs : -1)
                .putBitmap(MediaMetadataCompat.METADATA_KEY_ART, art())
                .build()
        );
        session.setPlaybackState(
            new PlaybackStateCompat.Builder()
                .setActions(
                    PlaybackStateCompat.ACTION_PLAY |
                    PlaybackStateCompat.ACTION_PAUSE |
                    PlaybackStateCompat.ACTION_PLAY_PAUSE |
                    PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                    PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                    PlaybackStateCompat.ACTION_SEEK_TO |
                    PlaybackStateCompat.ACTION_FAST_FORWARD |
                    PlaybackStateCompat.ACTION_REWIND
                )
                .setState(s.playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED, s.positionMs, s.playing ? s.rate : 0f)
                .build()
        );

        Notification notification = buildNotification(s);
        if (s.playing) {
            try {
                ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                foreground = true;
                return;
            } catch (Exception e) {
                // 백그라운드에서 다시 재생할 때 시스템이 막으면(안드로이드 12+) 알림만 고친다
                Log.w(TAG, "startForeground", e);
            }
        } else if (foreground) {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_DETACH);
            foreground = false;
        }
        try {
            getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, notification);
        } catch (SecurityException e) {
            // 알림 권한이 없으면 알림 없이 둔다
        }
    }

    private Notification buildNotification(State s) {
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent content = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_maengo)
            .setColor(ContextCompat.getColor(this, R.color.maengo_mango))
            .setLargeIcon(art())
            .setContentTitle(s.title)
            .setContentText(s.album)
            .setContentIntent(content)
            .setDeleteIntent(MediaActionReceiver.intent(this, MediaActionReceiver.DISMISS))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setOngoing(s.playing)
            .addAction(android.R.drawable.ic_media_previous, "이전", MediaActionReceiver.intent(this, "previoustrack"))
            .addAction(
                s.playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                s.playing ? "일시정지" : "재생",
                MediaActionReceiver.intent(this, s.playing ? "pause" : "play")
            )
            .addAction(android.R.drawable.ic_media_next, "다음", MediaActionReceiver.intent(this, "nexttrack"))
            .setStyle(new androidx.media.app.NotificationCompat.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0, 1, 2))
            .build();
    }

    /** 알림·잠금 화면에 보일 앱 아이콘(적응형 아이콘이라 그려서 만든다) */
    private Bitmap art() {
        if (art != null) return art;
        Drawable d = ContextCompat.getDrawable(this, R.mipmap.ic_launcher);
        int size = 256;
        art = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        if (d != null) {
            Canvas canvas = new Canvas(art);
            d.setBounds(0, 0, size, size);
            d.draw(canvas);
        }
        return art;
    }

    private void finish() {
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);
        foreground = false;
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (running == this) running = null;
        session.setActive(false);
        session.release();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
