package kr.maengo.app;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 웹을 못 불러와 안내 화면(www/index.html)이 떠 있을 때 뒤로 가기는 앱을 내린다.
        // 안내 화면에는 웹의 뒤로 가기 처리(apps/web/lib/native/shell.ts)가 없고, 기본 처리는 실패한 주소로 되돌아가 안내 화면이 다시 뜬다.
        // 나중에 더한 콜백이 먼저 불리므로(App 플러그인 것보다 앞) 안내 화면이 아니면 다음 콜백에 넘긴다.
        getOnBackPressedDispatcher()
            .addCallback(
                this,
                new OnBackPressedCallback(true) {
                    @Override
                    public void handleOnBackPressed() {
                        String url = bridge.getWebView().getUrl();
                        if (url != null && url.equals(bridge.getErrorUrl())) {
                            moveTaskToBack(true);
                            return;
                        }
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                        setEnabled(true);
                    }
                }
            );
    }
}
