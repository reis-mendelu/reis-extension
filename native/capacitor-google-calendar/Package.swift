// swift-tools-version: 5.9
import PackageDescription

// SPIKE. Package/product names are derived by `cap sync` from the npm name
// (`@reis/capacitor-google-calendar` -> `ReisCapacitorGoogleCalendar`); see
// native/capacitor-secure-store/Package.swift for why they are not free choices.
// The only third-party dependency is Google's own sign-in SDK. No Facebook, no
// Firebase.
let package = Package(
    name: "ReisCapacitorGoogleCalendar",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "ReisCapacitorGoogleCalendar",
            targets: ["GoogleCalendarAuthPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/google/GoogleSignIn-iOS.git", from: "9.0.0")
    ],
    targets: [
        .target(
            name: "GoogleCalendarAuthPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS"),
            ],
            path: "ios/Sources/GoogleCalendarAuthPlugin")
    ]
)
