// swift-tools-version: 5.9
import PackageDescription

// Same shape as native/capacitor-secure-store: one plugin target under
// ios/Sources/<TargetName>. `cap sync` reads the package.json next to this file,
// scans that directory for `@objc(...)`, and generates BOTH the CapApp-SPM
// dependency and the packageClassList entry — the registration an app-local
// Swift file can never get.
// The package and product name are NOT free choices: `cap sync` derives them from
// the npm package name (`@reis/capacitor-eduroam` → `ReisCapacitorEduroam`). A
// mismatch fails at dependency resolution, before any Swift compiles.
let package = Package(
    name: "ReisCapacitorEduroam",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "ReisCapacitorEduroam",
            targets: ["EduroamPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "EduroamPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
            ],
            path: "ios/Sources/EduroamPlugin")
    ]
)
