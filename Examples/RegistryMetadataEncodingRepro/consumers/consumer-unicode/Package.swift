// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ConsumerUnicode",
    dependencies: [
        .package(id: "demo.unicode", exact: "1.0.0"),
    ],
    targets: [
        .executableTarget(
            name: "ConsumerUnicode",
            dependencies: [
                .product(name: "DemoUnicode", package: "demo.unicode"),
            ]
        ),
    ]
)
