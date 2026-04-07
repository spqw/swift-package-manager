// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "DemoUnicode",
    products: [
        .library(name: "DemoUnicode", targets: ["DemoUnicode"]),
    ],
    targets: [
        .target(name: "DemoUnicode"),
    ]
)
