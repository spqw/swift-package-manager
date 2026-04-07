// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ConsumerASCII",
    dependencies: [
        .package(id: "demo.ascii", exact: "1.0.0"),
    ],
    targets: [
        .executableTarget(
            name: "ConsumerASCII",
            dependencies: [
                .product(name: "DemoASCII", package: "demo.ascii"),
            ]
        ),
    ]
)
