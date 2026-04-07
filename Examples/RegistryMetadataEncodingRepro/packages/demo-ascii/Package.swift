// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "DemoASCII",
    products: [
        .library(name: "DemoASCII", targets: ["DemoASCII"]),
    ],
    targets: [
        .target(name: "DemoASCII"),
    ]
)
