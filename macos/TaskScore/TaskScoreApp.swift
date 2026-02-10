import SwiftUI
import AppKit

@main
struct TaskScoreApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(minWidth: 800, minHeight: 500)
        }
        .defaultSize(width: 1200, height: 800)
        .commands {
            CommandGroup(after: .newItem) {
                Button("Open IGC File...") {
                    NotificationCenter.default.post(name: .openIGCFile, object: nil)
                }
                .keyboardShortcut("o", modifiers: .command)

                Button("Open Task File...") {
                    NotificationCenter.default.post(name: .openXCTaskFile, object: nil)
                }
                .keyboardShortcut("t", modifiers: [.command, .shift])

                Divider()

                Button("Load AirScore Task...") {
                    NotificationCenter.default.post(name: .loadAirScoreTask, object: nil)
                }
                .keyboardShortcut("l", modifiers: .command)
            }
        }

        Settings {
            SettingsView()
        }
    }
}

/// App delegate to handle activation for SPM-built executables
class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationWillFinishLaunching(_ notification: Notification) {
        NSApplication.shared.setActivationPolicy(.regular)
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApplication.shared.activate(ignoringOtherApps: true)
        try? FileStore.ensureDirectories()
    }
}

extension Notification.Name {
    static let openIGCFile = Notification.Name("openIGCFile")
    static let openXCTaskFile = Notification.Name("openXCTaskFile")
    static let loadAirScoreTask = Notification.Name("loadAirScoreTask")
}
