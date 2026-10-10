import AuthenticationServices
import Capacitor
import UIKit

// 앱 로그인(APP_PLAN.md 2단계, 시스템 브라우저 + 딥링크). 구글은 웹뷰 안 로그인을 막아서
// 로그인 주소를 ASWebAuthenticationSession(사파리)으로 열고, kr.maengo.app://auth/callback?code=… 로 돌아오면 그 주소를 웹에 넘긴다.
// 웹은 그 code로 /auth/callback을 열어 세션을 만든다(apps/web/lib/native/auth.ts).

/** Capacitor 화면에 앱 전용 플러그인을 등록한다(SceneDelegate가 이 화면을 띄운다) */
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AuthSessionPlugin())
    }
}

@objc(AuthSessionPlugin)
public class AuthSessionPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "AuthSessionPlugin"
    public let jsName = "AuthSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise)
    ]
    /** 진행 중인 세션(끝날 때까지 붙잡아 둔다) */
    private var session: ASWebAuthenticationSession?

    /** start({ url, scheme }) → { url: 돌아온 주소 }. 사용자가 닫으면 'canceled'로 거절한다 */
    @objc func start(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw), let scheme = call.getString("scheme") else {
            call.reject("bad_request")
            return
        }
        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { [weak self] callback, error in
                self?.session = nil
                if let callback {
                    call.resolve(["url": callback.absoluteString])
                } else if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    call.reject("canceled", "canceled")
                } else {
                    call.reject(error?.localizedDescription ?? "failed", "failed")
                }
            }
            session.presentationContextProvider = self
            // 사파리 로그인 상태를 같이 써서 다음 로그인이 빠르다
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            if !session.start() {
                self.session = nil
                call.reject("failed", "failed")
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
