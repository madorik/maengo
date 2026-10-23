package kr.maengo.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;

/**
 * 스토어 별점 요청(Play 인앱 리뷰, 앱 1.3부터). 언제 부를지는 웹이 정한다(apps/web/lib/native/review.ts).
 * 창을 실제로 띄울지는 Play가 정하고 결과는 알려 주지 않아서, 끝나면 늘 resolve한다
 */
@CapacitorPlugin(name = "MaengoReview")
public class MaengoReviewPlugin extends Plugin {

    @PluginMethod
    public void request(PluginCall call) {
        ReviewManager manager = ReviewManagerFactory.create(getContext());
        manager
            .requestReviewFlow()
            .addOnCompleteListener(task -> {
                if (!task.isSuccessful() || getActivity() == null) {
                    call.resolve();
                    return;
                }
                manager.launchReviewFlow(getActivity(), task.getResult()).addOnCompleteListener(done -> call.resolve());
            });
    }
}
