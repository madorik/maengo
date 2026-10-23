import SwiftUI
import WidgetKit

// 홈 화면·잠금 화면 위젯 '오늘 소식'(앱 1.3부터). 앱이 앱 그룹에 넣어 둔 토큰으로 웹의 /api/widget을 불러 그린다
// (apps/web/app/api/widget/route.ts, 토큰은 App/NativeWidget.swift가 받는다).
// 알림 시각 전이면 소식이 올 즈음(refreshAt), 아니면 한 시간마다 다시 부르고, 앱은 열거나 읽을 때 다시 그리게 한다.
// 연결이 없으면 마지막으로 받은 것을 그린다. 누르면 kr.maengo.app://open/…으로 앱의 그 화면을 연다(apps/web/lib/native/shell.ts).

private enum Shared {
    // App/NativeWidget.swift의 WidgetShared와 같은 값
    static let group = "group.kr.maengo.app"
    static let tokenKey = "widget.token"
    static let endpointKey = "widget.endpoint"
    static let lastKey = "widget.last"
}

struct WidgetItem: Decodable, Hashable {
    let id: Int
    let title: String
    let categoryLabel: String
    let read: Bool
}

struct WidgetPayload: Decodable {
    let date: String
    let total: Int
    let done: Int
    let empty: String?
    let refreshAt: String?
    let items: [WidgetItem]

    var refreshDate: Date? {
        guard let refreshAt else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: refreshAt)
    }

    /** 위젯 갤러리·처음 그릴 때 보이는 예시 */
    static let sample = WidgetPayload(
        date: "",
        total: 3,
        done: 1,
        empty: nil,
        refreshAt: nil,
        items: [
            WidgetItem(id: 0, title: "AI 반도체 수요가 다시 늘어요", categoryLabel: "AI", read: true),
            WidgetItem(id: 0, title: "코스피가 사흘 만에 반등했어요", categoryLabel: "경제·주식", read: false),
            WidgetItem(id: 0, title: "새 휴머노이드 로봇이 공개됐어요", categoryLabel: "Tech", read: false),
        ]
    )
}

enum TodayState {
    case signedOut
    case failed
    case data(WidgetPayload)
}

struct TodayEntry: TimelineEntry {
    let date: Date
    let state: TodayState
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry {
        TodayEntry(date: Date(), state: .data(.sample))
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        if context.isPreview {
            completion(placeholder(in: context))
            return
        }
        Task { completion(await load().entry) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        Task {
            let (entry, refreshAt) = await load()
            let now = Date()
            let hour = now.addingTimeInterval(3600)
            let next = max(refreshAt.map { min($0, hour) } ?? hour, now.addingTimeInterval(60))
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    private func load() async -> (entry: TodayEntry, refreshAt: Date?) {
        let defaults = UserDefaults(suiteName: Shared.group)
        guard let token = defaults?.string(forKey: Shared.tokenKey),
              let endpoint = defaults?.string(forKey: Shared.endpointKey),
              let url = URL(string: endpoint)
        else {
            return (TodayEntry(date: Date(), state: .signedOut), nil)
        }
        var request = URLRequest(url: url, timeoutInterval: 10)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let (data, response) = try? await URLSession.shared.data(for: request) {
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if status == 401 {
                // 탈퇴했거나 토큰이 무효가 됐다. 다시 로그인하면 앱이 새 토큰을 넘긴다
                defaults?.removeObject(forKey: Shared.tokenKey)
                defaults?.removeObject(forKey: Shared.lastKey)
                return (TodayEntry(date: Date(), state: .signedOut), nil)
            }
            if status == 200, let payload = try? JSONDecoder().decode(WidgetPayload.self, from: data) {
                defaults?.set(data, forKey: Shared.lastKey)
                return (TodayEntry(date: Date(), state: .data(payload)), payload.refreshDate)
            }
        }
        if let last = defaults?.data(forKey: Shared.lastKey), let payload = try? JSONDecoder().decode(WidgetPayload.self, from: last) {
            return (TodayEntry(date: Date(), state: .data(payload)), nil)
        }
        return (TodayEntry(date: Date(), state: .failed), nil)
    }
}

// MARK: - 그리기

private extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    }
}

/** 웹 globals.css 토큰과 같은 색(밝게·어둡게) */
private extension Color {
    init(light: UInt32, dark: UInt32) {
        self.init(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }

    static let paper = Color(light: 0xFFFFFF, dark: 0x151722)
    static let ink = Color(light: 0x1F2340, dark: 0xECEEF5)
    static let sub = Color(light: 0x6B7089, dark: 0xA6ABC0)
    static let faint = Color(light: 0xA3A8BC, dark: 0x6F7491)
    static let mangoDeep = Color(light: 0xA86A00, dark: 0xF4B740)
    static let mangoTint = Color(light: 0xFFF4D6, dark: 0x3A2F14)
}

private func appLink(_ path: String) -> URL {
    URL(string: "kr.maengo.app://open\(path)?from=widget")!
}

private let signedOutText = "맹고를 열어 로그인해 주세요"
private let failedText = "소식을 불러오지 못했어요"

struct TodayWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TodayEntry

    var body: some View {
        content
            .widgetURL(tapURL)
            .widgetBackground(family == .accessoryRectangular ? .clear : .paper)
    }

    /** 위젯 전체를 누르면: 작은 위젯은 거기 보이는 소식, 나머지는 오늘 화면(중간·큰 위젯의 줄은 Link로 각자 연다) */
    private var tapURL: URL {
        if family == .systemSmall, case .data(let p) = entry.state, let item = featured(p) {
            return appLink("/article/\(item.id)")
        }
        return appLink("/today")
    }

    /** 아직 안 읽은 첫 소식(다 읽었으면 첫 소식) */
    private func featured(_ p: WidgetPayload) -> WidgetItem? {
        p.items.first { !$0.read } ?? p.items.first
    }

    @ViewBuilder private var content: some View {
        if family == .accessoryRectangular {
            lockScreen
        } else {
            VStack(alignment: .leading, spacing: 0) {
                header
                switch entry.state {
                case .signedOut: message(signedOutText)
                case .failed: message(failedText)
                case .data(let p):
                    if p.items.isEmpty {
                        message(p.empty ?? "")
                    } else if family == .systemSmall {
                        small(p)
                    } else {
                        rows(p, limit: family == .systemLarge ? 5 : 3)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    private var header: some View {
        HStack(spacing: 6) {
            Image("Mango")
                .resizable()
                .frame(width: 20, height: 20)
                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
            Text("오늘 소식")
                .font(.system(size: 14, weight: .heavy))
                .foregroundColor(.ink)
            Spacer(minLength: 4)
            if case .data(let p) = entry.state, p.total > 0 {
                Text("\(p.done)/\(p.total)")
                    .font(.system(size: 13, weight: .heavy, design: .rounded))
                    .foregroundColor(.mangoDeep)
            }
        }
    }

    private func message(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 14, weight: .bold))
            .foregroundColor(.sub)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    /** 작은 위젯: 아직 안 읽은 첫 소식(다 읽었으면 첫 소식)을 크게 */
    private func small(_ p: WidgetPayload) -> some View {
        let item = featured(p) ?? p.items[0]
        return VStack(alignment: .leading, spacing: 6) {
            Spacer(minLength: 0)
            chip(item.categoryLabel)
            Text(item.title)
                .font(.system(size: 15, weight: .heavy))
                .foregroundColor(item.read ? .faint : .ink)
                .lineLimit(3)
        }
    }

    /** 중간·큰 위젯: 소식 줄들이 남은 높이를 똑같이 나눠 쓴다(줄이 적어도 위에만 몰리지 않게) */
    private func rows(_ p: WidgetPayload, limit: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(p.items.prefix(limit), id: \.self) { item in
                Link(destination: appLink("/article/\(item.id)")) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        chip(item.categoryLabel)
                        Text(item.title)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(item.read ? .faint : .ink)
                            .lineLimit(family == .systemLarge ? 2 : 1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(maxHeight: .infinity)
                }
            }
        }
        .padding(.top, 8)
    }

    private func chip(_ label: String) -> some View {
        Text(label)
            .font(.system(size: 11, weight: .heavy))
            .foregroundColor(.mangoDeep)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(RoundedRectangle(cornerRadius: 5, style: .continuous).fill(Color.mangoTint))
            .fixedSize()
    }

    /** 잠금 화면: 읽은 수와 아직 안 읽은 첫 소식 */
    @ViewBuilder private var lockScreen: some View {
        VStack(alignment: .leading, spacing: 2) {
            switch entry.state {
            case .signedOut:
                Text("맹고").font(.headline)
                Text(signedOutText).font(.caption).lineLimit(2)
            case .failed:
                Text("맹고").font(.headline)
                Text(failedText).font(.caption).lineLimit(2)
            case .data(let p):
                Text(p.total > 0 ? "맹고 · \(p.done)/\(p.total)" : "맹고").font(.headline)
                if let item = featured(p) {
                    Text(item.title).font(.caption).lineLimit(2)
                } else {
                    Text(p.empty ?? "").font(.caption).lineLimit(2)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private extension View {
    /** iOS 17부터는 위젯 바탕을 containerBackground로 줘야 한다(여백도 시스템이 준다). 16은 직접 칠하고 여백을 둔다 */
    @ViewBuilder func widgetBackground(_ color: Color) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(color, for: .widget)
        } else {
            padding(16).background(color)
        }
    }
}

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MaengoToday", provider: Provider()) { entry in
            TodayWidgetView(entry: entry)
        }
        .configurationDisplayName("오늘 소식")
        .description("오늘 받은 소식 제목을 홈 화면에서 봐요")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular])
    }
}

@main
struct MaengoWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodayWidget()
    }
}
