// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TaskScore",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .executable(name: "TaskScore", targets: ["TaskScore"]),
    ],
    targets: [
        .executableTarget(
            name: "TaskScore",
            path: "TaskScore",
            resources: [
                .process("Resources"),
            ]
        ),
        .testTarget(
            name: "TaskScoreTests",
            dependencies: ["TaskScore"],
            path: "TaskScoreTests"
        ),
    ]
)
