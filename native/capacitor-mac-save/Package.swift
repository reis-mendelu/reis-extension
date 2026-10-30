// swift-tools-version: 5.9
import PackageDescription

// Same shape as native/capacitor-secure-store: one plugin target under
// ios/Sources/<TargetName>, registered by `cap sync` from the `@objc(...)` it
// finds there. The package and product name are derived by `cap sync` from the
// npm package name (`@reis/capacitor-mac-save` → `ReisCapacitorMacSave`); rename
// one and the other must follow.
let package = Package(
    name: "ReisCapacitorMacSave",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "ReisCapacitorMacSave",
            targets: ["MacSavePlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "MacSavePlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
            ],
            path: "ios/Sources/MacSavePlugin")
    ]
)
