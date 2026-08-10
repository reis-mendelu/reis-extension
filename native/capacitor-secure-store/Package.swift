// swift-tools-version: 5.9
import PackageDescription

// Shape copied from @capacitor/preferences, which is the closest sibling: a
// single plugin target under ios/Sources/<TargetName>. `cap sync` reads the
// package.json next to this file, scans that directory for `@objc(...)`, and
// generates BOTH the CapApp-SPM dependency and the packageClassList entry — the
// registration that an app-local Swift file can never get.
// The package and product name are NOT free choices: `cap sync` derives them from
// the npm package name (`@reis/capacitor-secure-store` → `ReisCapacitorSecureStore`)
// and writes that into the generated CapApp-SPM/Package.swift. A mismatch fails at
// dependency resolution, before any Swift compiles:
//   product 'ReisCapacitorSecureStore' ... not found in package 'ReisCapacitorSecureStore'
// Rename the npm package and this must follow.
let package = Package(
    name: "ReisCapacitorSecureStore",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "ReisCapacitorSecureStore",
            targets: ["SecureStorePlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "SecureStorePlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
            ],
            path: "ios/Sources/SecureStorePlugin")
    ]
)
