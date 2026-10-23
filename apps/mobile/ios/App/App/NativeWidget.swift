import Capacitor
import StoreKit
import UIKit
import WidgetKit

// 홈 화면 위젯과 스토어 별점 요청(앱 1.3부터). 웹이 부르는 곳은 apps/web/lib/native/widget.ts·review.ts.
// 위젯(MaengoWidget 확장)은 앱과 같은 앱 그룹의 UserDefaults로 토큰과 주소를 받아 /api/widget을 부른다.

enum WidgetShared {
    /** 앱과 위젯이 같이 쓰는 앱 그룹(App.entitlements·MaengoWidget.entitlements) */
    static let group = "group.kr.maengo.app"
    static let tokenKey = "widget.token"
    static let endpointKey = "widget.endpoint"
    static let lastKey = "widget.last"
    static var defaults: UserDefaults? { UserDefaults(suiteName: group) }
}

@objc(MaengoWidgetPlugin)
public class MaengoWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MaengoWidgetPlugin"
    public let jsName = "MaengoWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reload", returnType: CAPPluginReturnPromise),
    ]

    /** setToken({ token, endpoint }): 위젯이 부를 토큰·주소를 저장하고 다시 그린다 */
    @objc func setToken(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), let endpoint = call.getString("endpoint"), endpoint.hasPrefix("https://") || endpoint.hasPrefix("http://") else {
            call.reject("bad_request")
            return
        }
        let defaults = WidgetShared.defaults
        defaults?.set(token, forKey: WidgetShared.tokenKey)
        defaults?.set(endpoint, forKey: WidgetShared.endpointKey)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    /** 로그아웃: 토큰과 마지막으로 받은 소식을 지운다(위젯은 '로그인' 안내) */
    @objc func clear(_ call: CAPPluginCall) {
        let defaults = WidgetShared.defaults
        for key in [WidgetShared.tokenKey, WidgetShared.endpointKey, WidgetShared.lastKey] {
            defaults?.removeObject(forKey: key)
        }
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    @objc func reload(_ call: CAPPluginCall) {
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}

/** 별점 요청. 창을 실제로 띄울지는 iOS가 정하고(1년에 3번까지) 결과는 알 수 없어서 늘 resolve한다 */
@objc(MaengoReviewPlugin)
public class MaengoReviewPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MaengoReviewPlugin"
    public let jsName = "MaengoReview"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise)
    ]

    @objc func request(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let scene = UIApplication.shared.connectedScenes.first { $0.activationState == .foregroundActive } as? UIWindowScene
            if let scene {
                if #available(iOS 16.0, *) {
                    AppStore.requestReview(in: scene)
                } else {
                    SKStoreReviewController.requestReview(in: scene)
                }
            }
            call.resolve()
        }
    }
}
