REELS FEATURE — source changes (v1.9.0)
=======================================

Apply these files at the SAME paths inside codebylogic/Class10th-quiz-android
(branch: main). Nothing else in the project needs to change.

NEW FILES
  app/src/main/java/com/smartquiz/portal/web/ReelsStore.kt
  app/src/main/res/xml/network_security_config.xml
  app/src/main/res/xml/file_paths.xml
  app/src/main/assets/web/js/reels.js

MODIFIED FILES
  app/src/main/java/com/smartquiz/portal/web/LocalAssetServer.kt   (video MIME, Range support, reels routes)
  app/src/main/java/com/smartquiz/portal/web/NativeBridge.kt       (pro + reels bridge methods)
  app/src/main/java/com/smartquiz/portal/web/WebViewHost.kt        (mixed content for 127.0.0.1)
  app/src/main/java/com/smartquiz/portal/AppPrefs.kt               (pro flag)
  app/src/main/java/com/smartquiz/portal/MainActivity.kt           (reels base url -> bridge)
  app/src/main/AndroidManifest.xml                                 (storage perms, network config, FileProvider)
  app/src/main/assets/web/js/app.js                                (#/pro and #/reels routes)
  app/src/main/assets/web/js/settings.js                           (PRO & Reels group, version badge)
  app/src/main/assets/web/css/theme.css                            (PRO + reels styles)
  app/src/main/assets/web/index.html                               (loads js/reels.js)
  app/build.gradle.kts                                             (versionCode 13 / 1.9.0)

WHAT IT DOES
  - Profile screen gets a "PRO & Reels" group.
  - PRO screen: payment option (placeholder) + offer-code redeem. Code: FREEREEL
  - After unlock, a Reels entry appears. The feed plays the user's own .mp4 files from
    /storage/emulated/0/SARVER/reel-compressor/data/output/
  - Videos are streamed by the Kotlin loopback server (Range-enabled) so HTML5 <video> can seek.
  - Android 11+ needs "All files access" — the app opens the system screen to grant it.

AFTER APPLYING
  The existing GitHub Actions workflow builds the APK on push.
