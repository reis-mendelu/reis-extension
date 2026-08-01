# Capacitor spike — findings

Results of the day-one device tests from #158. Each answer is measured, not inferred.

## Environment

| Component | Version |
|---|---|
| Capacitor CLI | 8.5.0 |
| @capacitor/core | 8.5.0 |
| @capacitor/ios | 8.5.0 |
| @capacitor/android | 8.5.0 |
| @capgo/capacitor-inappbrowser | 8.13.2 (post-8.6.0 — on the breaking-change side of the proxy-handling change) |
| Xcode / iOS Simulator | Xcode 26.6 (build 17F113), iOS 26.5 Simulator runtime pending |
| Android emulator API level | not installed |

## Results

| # | Question | Answer | Evidence |
|---|---|---|---|
| 0 | Does `preShowScript` injection run on IS? | pending | |
| 1 | Does iOS WKWebView keep `UISAuth` across app kill? | pending | |
| 2 | Does Android WebView keep `UISAuth` across app kill? | pending | |
| 3 | Does blob + `a[download]` save a file? | pending | |
| 4 | Does `ACTION_WIFI_ADD_NETWORKS` accept an EAP-TLS config? | pending | |

## Consequences for #158

pending
