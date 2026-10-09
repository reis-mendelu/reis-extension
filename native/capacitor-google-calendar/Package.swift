// swift-tools-version: 5.9
import PackageDescription

// Same shape as native/capacitor-eduroam. The package and product name come from the npm
// name (`@reis/capacitor-google-calendar` → `ReisCapacitorGoogleCalendar`).
let package = Package(
    name: "ReisCapacitorGoogleCalendar",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "ReisCapacitorGoogleCalendar",
            targets: ["GoogleCalendarPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/google/GoogleSignIn-iOS.git", from: "10.0.0"),
    ],
    targets: [
        .target(
            name: "GoogleCalendarPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS"),
            ],
            path: "ios/Sources/GoogleCalendarPlugin")
    ]
)
