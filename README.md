# Smart Quiz Portal — Android App (Offline WebView Hybrid Edition v1.0)

Native Android WebView hybrid application for **Smart Quiz Portal** (BSEB & CBSE Classes 9, 10, 11 + Common GK & Grammar), built strictly to the **Product Requirements Document & Technical Architecture (v1.0 · 20 October 2026)**.

## 1. Architecture Overview

| Layer | Technology | Files & Responsibilities |
| :--- | :--- | :--- |
| **Android Shell** | Kotlin (`minSdk 24`, `targetSdk 35`) | `MainActivity.kt`, `WebViewHost.kt`, `LocalAssetServer.kt`, `BackHandler.kt`, `NativeBridge.kt`, `AppPrefs.kt` |
| **Local Asset Server** | `androidx.webkit.WebViewAssetLoader` (Option A default) + Embedded `127.0.0.1` HTTP Server (Option B) | Serves `app/src/main/assets/web/` over `https://appassets.androidplatform.net/` so `fetch()`, `localStorage`, and `IndexedDB` work 100% offline in airplane mode |
| **Web Layer (UI/UX)** | Vanilla HTML5 + CSS3 + ES6 JavaScript | `index.html`, `css/theme.css`, `js/app.js`, `js/quiz.js`, `js/catalog.js`, `js/storage.js`, `js/translate.js`, `js/lang-detect.js`, `js/settings.js` |
| **Offline Fonts** | Bundled TrueType/OpenType fonts | `assets/web/fonts/` (`Mukta-Regular.ttf`, `Mukta-Bold.ttf`, `Inter-Regular.otf`, `Inter-Bold.otf`, `SpaceGrotesk-Bold.otf`) |
| **Content & Validator** | Bundled JSON + Gradle `validateQuizContent` | `assets/web/catalog.json`, `assets/web/data/**`, `scripts/validate_content.py`, `scripts/sync_from_pwa_repo.py` |

## 2. Implemented PRD Functional Requirements (FR-01 to FR-20)

- **FR-01 to FR-03 (Course, Subject, Section & Chapter Navigation)**: Supports all 7 tracks (`BSEB 10th`, `BSEB 11th`, `BSEB 9th`, `CBSE 10th`, `CBSE 9th`, `Common GK`, `Common Grammar`), section choosers (e.g., Physics / Chemistry / Biology, Gadhya / Kavya / Varnika), and chapter cards with live status pills (`पूरा`, `जारी है`, `अभी शुरू नहीं किया`).
- **FR-04 to FR-08 (Quiz Engine, Navigator Sheet, Result & Retry)**:
  - Exact Fisher–Yates question & option shuffle (Appendix C.1) using index-safe `isCorrect` flag pairing so duplicate option text never mis-maps `item.a`.
  - Display-time parenthesis stripping on options (`text.replace(/\s*\([^)]*\)/g, "").trim()`, Appendix C.2).
  - Bilingual rendering modes (`hi-pri`, `en-pri`, `only-hi`, `only-en`, Appendix C.3 & C.4).
  - Segmented progress bar, live countdown timer, instant right/wrong lock, touch swipe left/right navigation, and 6-column Question Navigator bottom sheet.
  - Circular SVG percentage ring, 4-column scorecard, accuracy/time metrics, solution review, and full reshuffle on Retry.
- **FR-09 to FR-13 (Offline Persistence)**:
  - Completed attempt history, per-chapter best & last score (`localStorage` + `IndexedDB` + native `DataStore` backup via `AndroidBridge`).
  - **Weak-Topic Tracking (`#/weak-topics`)**: Automatically tracks questions answered wrong more often than right and generates a targeted re-test.
  - **Real Streak & Weekly Activity Bars**: Computes consecutive active practice days and 7-day bar chart on `#/home`.
  - **Mid-Quiz Auto-Save & Resume**: Resumes incomplete quizzes from the exact question where the student left off.
  - **Bookmarks / Revision Vault (`#/bookmarks`)**: One-tap question bookmarking and custom revision test.
- **FR-14 to FR-20 (Settings, Profile Language Translation & Native Bridge)**:
  - Dark / Light / System themes, Profile Language switcher (`हिंदी` / `English`) with instant re-rendering and `IndexedDB` translation cache (Section 16), and `@JavascriptInterface` bridge (`vibrate`, `share`, `toast`, `getVersion`, `saveProgress`, `loadProgress`, `exit`).

## 3. Building the APK in Android Studio or CLI

1. Open the `SmartQuizPortal-Android` folder in **Android Studio Ladybug (2024.2.1)+** or build from the terminal:
   ```bash
   ./gradlew validateQuizContent assembleDebug
   ```
2. The build automatically runs the `validateQuizContent` task (PRD Section 11) before packaging to guarantee every JSON file and catalogue reference is valid.
3. To sync all 404 chapter JSON files from a local clone of `github.com/codebylogic/Class10th-quiz` (with automatic repair of `PHYSICS/mega.json`, `BIOLOGY/mega.json`, and `Sangatkar.json`):
   ```bash
   python3 scripts/sync_from_pwa_repo.py /path/to/Class10th-quiz
   ```
