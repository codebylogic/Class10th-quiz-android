REELS — v1.9.1 changes
======================

Apply these files at the SAME paths inside codebylogic/Class10th-quiz-android (branch: main).

MODIFIED FILES (8)
  app/src/main/java/com/smartquiz/portal/web/ReelsStore.kt   folder auto-detect (output / outputs / recursive)
  app/src/main/java/com/smartquiz/portal/web/NativeBridge.kt  reelsInfo() now also reports "scanned" folders
  app/src/main/assets/web/js/reels.js                         full-screen feed, restart-on-rescroll, scanned list
  app/src/main/assets/web/js/app.js                           body.reels-mode toggle per route
  app/src/main/assets/web/js/settings.js                      version badge v1.9.1
  app/src/main/assets/web/css/theme.css                       full-screen CSS + fixed missing CSS variables
  app/src/main/assets/web/index.html                          Reels item added to the bottom nav
  app/build.gradle.kts                                        versionCode 14 / 1.9.1

WHAT CHANGED
  1. FOLDER BUG FIXED
     Your folder is ".../data/outputs" (with an s) but the app was looking at
     ".../data/output". ReelsStore now tries both names, then any sub-folder of data/,
     then does a bounded walk (depth 3) under /storage/emulated/0/SARVER/reel-compressor.
     Whichever folder actually contains videos wins.

  2. FULL-SCREEN REELS
     The feed is now edge-to-edge (position: fixed, full height). The app's top bar and
     bottom nav hide while you are on #/reels, and come back when you leave.

  3. REELS IN THE BOTTOM NAV
     A new "Reels" item sits between Vault and Profile.

  4. RESTART ON SCROLL-BACK
     When a reel becomes the visible one again, it starts from 0:00 instead of resuming.

  5. CSS VARIABLE FIX
     Several of the new styles used variable names that do not exist in this app's theme
     (--emerald instead of --accent-emerald, plus radius/easing tokens that were never
     defined). That silently dropped gradients and rounded corners on some new buttons.
     All of them now resolve — verified: zero undefined variables left in theme.css.

  6. DEBUG HELP
     If no reels are found, the empty screen now lists every folder that was checked and
     how many videos each one holds ("नहीं मिला" = folder does not exist).

AFTER PUSHING
  The existing workflow builds the APK. versionName = 1.9.1
