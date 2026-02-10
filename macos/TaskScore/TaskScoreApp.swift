import SwiftUI

@main
struct TaskScoreApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .commands {
            CommandGroup(after: .newItem) {
                Button("Open IGC File...") {
                    NotificationCenter.default.post(name: .openIGCFile, object: nil)
                }
                .keyboardShortcut("o", modifiers: .command)
            }
        }

        Settings {
            SettingsView()
        }
    }

    init() {
        // Ensure ~/Documents/TaskScore/ directories exist
        try? FileStore.ensureDirectories()
    }
}

extension Notification.Name {
    static let openIGCFile = Notification.Name("openIGCFile")
}
