/**
 * Smart Quiz Portal — Profile & Settings Screen (#/settings)
 * Implements FR-14, FR-16, FR-18, and Section 16.10:
 * - Theme switcher (Dark / Light / System)
 * - Profile Language switcher (हिंदी / English — re-renders content immediately without restart)
 * - Default Bilingual Display Mode (hi-pri / en-pri / only-hi / only-en)
 * - Clear All Data with confirmation
 * - About Card with App Version & Bundled Content Version (2026.10.1)
 */
(function (global) {
  'use strict';

  function renderSettingsScreen(container, onSettingsChanged) {
    const currentTheme = global.QuizStorage.getTheme();
    const currentProfileLang = global.QuizStorage.getProfileLanguage();
    const currentQuizPref = global.QuizStorage.getQuizLanguagePref();
    const sfxMuted = global.QuizSfx ? global.QuizSfx.isMuted() : false;
    const questionsPerPart = global.QuizStorage.getQuestionsPerPart();
    const versionInfo = global.QuizStorage.Bridge.getVersion();
    const streakInfo = global.QuizStorage.getStreakAndWeeklyBars();
    const attempts = global.QuizStorage.getAllAttempts();
    const bookmarks = global.QuizStorage.getBookmarksList();
    const weakTopics = global.QuizStorage.getWeakTopicsList();

    container.innerHTML = `
      <div class="greeting-row">
        <div>
          <h1 class="greeting-title">प्रोफ़ाइल और सेटिंग्स</h1>
          <p class="greeting-date">Profile, Language, Theme &amp; Offline Storage</p>
        </div>
        <span class="board-badge"><span class="board-badge-dot"></span> OFFLINE v1.5</span>
      </div>

      <!-- Student Quick Summary Card -->
      <div class="streak-card" style="margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <div class="avatar-btn" style="width:48px;height:48px;font-size:1.2rem;font-weight:700;">छात्र</div>
          <div>
            <div style="font-size:1.08rem;font-weight:700;">बिहार एवं CBSE बोर्ड विद्यार्थी</div>
            <div style="font-size:0.76rem;color:var(--text-secondary);">100% ऑफ़लाइन स्मार्ट अध्ययन प्रोफ़ाइल</div>
          </div>
        </div>
        <div class="stats-four-grid" style="margin-bottom:0;">
          <div class="stat-mini-box total">
            <div class="stat-mini-label">स्ट्रीक</div>
            <div class="stat-mini-num">${streakInfo.streak}d</div>
            <div class="stat-mini-sub">लगातार दिन</div>
          </div>
          <div class="stat-mini-box correct">
            <div class="stat-mini-label">टेस्ट पूर्ण</div>
            <div class="stat-mini-num">${attempts.length}</div>
            <div class="stat-mini-sub">अभ्यास</div>
          </div>
          <div class="stat-mini-box skipped">
            <div class="stat-mini-label">कमज़ोर प्रश्न</div>
            <div class="stat-mini-num">${weakTopics.length}</div>
            <div class="stat-mini-sub">सुधार सूची</div>
          </div>
          <div class="stat-mini-box wrong">
            <div class="stat-mini-label">बुकमार्क</div>
            <div class="stat-mini-num">${bookmarks.length}</div>
            <div class="stat-mini-sub">रिवीजन</div>
          </div>
        </div>
      </div>

      <!-- Profile Language Selector (FR-17, FR-18, Section 16.10) -->
      <div class="settings-group">
        <div class="settings-group-title">🌐 प्रोफ़ाइल भाषा (Profile Language — FR-18)</div>
        <p style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:10px;">
          सभी एकल-भाषा (Single-language) प्रश्न और विकल्प आपकी चुनी हुई प्रोफ़ाइल भाषा में स्वतः अनुवादित और कैश हो जाते हैं।
        </p>
        <div class="segmented-control" id="profile-lang-control">
          <button class="seg-btn ${currentProfileLang === 'hi' ? 'active' : ''}" data-lang="hi">हिंदी (Hindi Default)</button>
          <button class="seg-btn ${currentProfileLang === 'en' ? 'active' : ''}" data-lang="en">English</button>
        </div>
      </div>

      <!-- Bilingual Quiz Preference (Appendix C.3 & C.4) -->
      <div class="settings-group">
        <div class="settings-group-title">📖 द्विभाषी प्रश्न मोड (Bilingual Display Preference)</div>
        <div class="lang-pills-grid" id="quiz-pref-control" style="margin:6px 0 0;">
          <button class="lang-pill-btn ${currentQuizPref === 'hi-pri' ? 'active' : ''}" data-pref="hi-pri">हिंदी प्रमुख (Hindi + Eng)</button>
          <button class="lang-pill-btn ${currentQuizPref === 'en-pri' ? 'active' : ''}" data-pref="en-pri">English Primary (Eng + हिं)</button>
          <button class="lang-pill-btn ${currentQuizPref === 'only-hi' ? 'active' : ''}" data-pref="only-hi">केवल हिंदी (Hindi Only)</button>
          <button class="lang-pill-btn ${currentQuizPref === 'only-en' ? 'active' : ''}" data-pref="only-en">Only English</button>
        </div>
      </div>

      <!-- Questions per Test (Parts) -->
      <div class="settings-group">
        <div class="settings-group-title">🧩 एक टेस्ट में कितने प्रश्न (Questions per Test)</div>
        <p style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:10px;">
          लंबे अध्याय छोटे-छोटे भागों में बँट जाते हैं। जैसे 100 प्रश्न और 40 चुना → भाग 1 (प्रश्न 1–40), भाग 2 (41–80), भाग 3 (81–100)। "डिफ़ॉल्ट" पर पूरा अध्याय एक साथ आता है।
        </p>
        <div class="segmented-control" id="parts-control">
          <button class="seg-btn ${questionsPerPart === 0 ? 'active' : ''}" data-part="0">डिफ़ॉल्ट</button>
          <button class="seg-btn ${questionsPerPart === 20 ? 'active' : ''}" data-part="20">20</button>
          <button class="seg-btn ${questionsPerPart === 30 ? 'active' : ''}" data-part="30">30</button>
          <button class="seg-btn ${questionsPerPart === 40 ? 'active' : ''}" data-part="40">40</button>
          <button class="seg-btn ${questionsPerPart === 50 ? 'active' : ''}" data-part="50">50</button>
        </div>
      </div>

      <!-- Theme Selector (FR-14) -->
      <div class="settings-group">
        <div class="settings-group-title">🎨 ऐप थीम (Appearance Theme)</div>
        <div class="segmented-control" id="theme-control">
          <button class="seg-btn ${currentTheme === 'dark' ? 'active' : ''}" data-theme-val="dark">🌙 डार्क (Dark)</button>
          <button class="seg-btn ${currentTheme === 'light' ? 'active' : ''}" data-theme-val="light">☀️ लाइट (Light)</button>
          <button class="seg-btn ${currentTheme === 'system' ? 'active' : ''}" data-theme-val="system">⚙️ सिस्टम</button>
        </div>
      </div>

      <!-- Answer Sound Effects -->
      <div class="settings-group">
        <div class="settings-group-title">🔊 उत्तर ध्वनि प्रभाव (Answer Sound Effects)</div>
        <p style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:10px;">
          सही उत्तर पर एक मधुर ध्वनि और गलत उत्तर पर हल्की बज़ — बिना किसी इंटरनेट के।
        </p>
        <div class="segmented-control" id="sfx-control">
          <button class="seg-btn ${sfxMuted ? '' : 'active'}" data-sfx="on">🔔 चालू (On)</button>
          <button class="seg-btn ${sfxMuted ? 'active' : ''}" data-sfx="off">🔇 बंद (Off)</button>
        </div>
      </div>

      <!-- Data Management (FR-14) -->
      <div class="settings-group">
        <div class="settings-group-title">🗄️ ऑफ़लाइन डेटा प्रबंधन (Local Storage &amp; Backup)</div>
        <p style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:10px;">
          आपका सारा स्कोर, स्ट्रीक और बुकमार्क आपके फ़ोन पर सुरक्षित हैं—कोई डेटा किसी सर्वर पर नहीं भेजा जाता।
        </p>
        <button id="btn-clear-all-data" class="btn-secondary-full" style="border-color:rgba(244,63,94,0.4);color:var(--accent-rose);margin-bottom:0;">
          🗑️ सभी प्रगति और कैश साफ़ करें (Clear All Data)
        </button>
      </div>

      <!-- About & Content Version (FR-16) -->
      <div class="settings-group">
        <div class="settings-group-title">ℹ️ ऐप के बारे में (About &amp; Content Version)</div>
        <div style="font-size:0.78rem;color:var(--text-secondary);display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;justify-content:space-between;">
            <span>ऐप संस्करण (App Version):</span>
            <strong style="color:var(--text-primary);">v${versionInfo.appVersion} (Build ${versionInfo.versionCode})</strong>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span>बंडल सामग्री संस्करण (Content Version):</span>
            <strong style="color:var(--accent-cyan-bright);">${versionInfo.contentVersion}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span>आर्किटेक्चर (Architecture):</span>
            <strong style="color:var(--text-primary);">Kotlin WebView + LocalAssetServer</strong>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span>स्रोत (Source of Truth):</span>
            <strong style="color:var(--text-primary);">codebylogic/Class10th-quiz</strong>
          </div>
        </div>
      </div>

      <!-- App Update -->
      <div class="settings-group">
        <div class="settings-group-title">⬆️ ऐप अपडेट (App Update)</div>
        <div style="font-size:0.78rem;color:var(--text-secondary);display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;justify-content:space-between;">
            <span>इंस्टॉल किया गया संस्करण (Installed):</span>
            <strong style="color:var(--text-primary);" id="update-current">v${versionInfo.appVersion}</strong>
          </div>
          <div id="update-msg">जाँच हो रही है…</div>
        </div>
        <button id="btn-check-update" class="btn-secondary-full" style="margin-top:10px;margin-bottom:0;">🔄 अपडेट जाँचें (Check for update)</button>
        <button id="btn-do-update" class="btn-primary-gradient full-width hidden" style="margin-top:8px;">⬇️ अमी अपडेट करें</button>
      </div>
    `;

    // Event bindings
    container.querySelectorAll('#profile-lang-control .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');
        if (global.QuizSfx) global.QuizSfx.playClick();
        global.QuizStorage.setProfileLanguage(lang);
        global.QuizStorage.Bridge.toast(lang === 'en' ? 'Profile language set to English' : 'प्रोफ़ाइल भाषा हिंदी चुनी गई');
        renderSettingsScreen(container, onSettingsChanged);
        if (typeof onSettingsChanged === 'function') onSettingsChanged();
      });
    });

    container.querySelectorAll('#quiz-pref-control .lang-pill-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pref = btn.getAttribute('data-pref');
        if (global.QuizSfx) global.QuizSfx.playClick();
        global.QuizStorage.setQuizLanguagePref(pref);
        global.QuizStorage.Bridge.toast('द्विभाषी प्रश्न प्राथमिकता अपडेट की गई');
        renderSettingsScreen(container, onSettingsChanged);
        if (typeof onSettingsChanged === 'function') onSettingsChanged();
      });
    });

    container.querySelectorAll('#parts-control .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = parseInt(btn.getAttribute('data-part'), 10) || 0;
        if (global.QuizSfx) global.QuizSfx.playClick();
        global.QuizStorage.setQuestionsPerPart(n);
        global.QuizStorage.Bridge.toast(n > 0 ? `हर टेस्ट में ${n} प्रश्न` : 'पूरा अध्याय एक साथ');
        renderSettingsScreen(container, onSettingsChanged);
        if (typeof onSettingsChanged === 'function') onSettingsChanged();
      });
    });

    container.querySelectorAll('#theme-control .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.getAttribute('data-theme-val');
        if (global.QuizSfx) global.QuizSfx.playClick();
        global.QuizStorage.setTheme(t);
        renderSettingsScreen(container, onSettingsChanged);
        if (typeof onSettingsChanged === 'function') onSettingsChanged();
      });
    });

    container.querySelectorAll('#sfx-control .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const off = btn.getAttribute('data-sfx') === 'off';
        if (global.QuizSfx) {
          global.QuizSfx.setMuted(off);
          if (!off) global.QuizSfx.playCorrect(); // preview + unlocks audio on first tap
        }
        global.QuizStorage.Bridge.toast(off ? 'ध्वनि बंद कर दी गई' : 'ध्वनि चालू कर दी गई');
        renderSettingsScreen(container, onSettingsChanged);
        if (typeof onSettingsChanged === 'function') onSettingsChanged();
      });
    });

    // ---- App update check (best-effort; never blocks the app) ----
    const updateMsg = container.querySelector('#update-msg');
    const doUpdateBtn = container.querySelector('#btn-do-update');
    const checkUpdateBtn = container.querySelector('#btn-check-update');

    function paintUpdate(info) {
      if (!updateMsg) return;
      if (!info) { updateMsg.textContent = '\u091c\u093e\u0901\u091a \u0928\u0939\u0940\u0902 \u0939\u094b \u0938\u0915\u0940\u0964'; return; }
      if (info.error) {
        updateMsg.textContent = '\u0907\u0902\u091f\u0930\u0928\u0947\u091f \u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902 \u2014 \u091c\u093e\u0901\u091a \u0928\u0939\u0940\u0902 \u0939\u094b \u0938\u0915\u0940\u0964';
        if (doUpdateBtn) doUpdateBtn.classList.add('hidden');
        return;
      }
      if (info.available) {
        updateMsg.innerHTML = '\u0928\u092f\u093e \u0938\u0902\u0938\u094d\u0915\u0930\u0923 \u0909\u092a\u0932\u092c\u094d\u0927 \u0939\u0948: <strong style="color:var(--accent-emerald-bright);">' + info.latest + '</strong>';
        if (doUpdateBtn) {
          doUpdateBtn.classList.remove('hidden');
          doUpdateBtn.textContent = '\u2b07\ufe0f ' + info.latest + ' \u0921\u093e\u0909\u0928\u0932\u094b\u0921 \u0915\u0930\u0947\u0902';
        }
      } else {
        updateMsg.textContent = '\u0906\u092a \u0928\u0935\u0940\u0928\u0924\u092e \u0938\u0902\u0938\u094d\u0915\u0930\u0923 \u092a\u0930 \u0939\u0948\u0902 (' + (info.latest || info.current) + ')\u0964';
        if (doUpdateBtn) doUpdateBtn.classList.add('hidden');
      }
    }

    if (global.QuizUpdater) {
      const cachedInfo = global.QuizUpdater.getCached();
      if (cachedInfo) paintUpdate(cachedInfo);
      global.QuizUpdater.check(false).then(paintUpdate).catch(() => {});
    }

    if (checkUpdateBtn) {
      checkUpdateBtn.addEventListener('click', async () => {
        if (global.QuizSfx) global.QuizSfx.playClick();
        if (updateMsg) updateMsg.textContent = '\u091c\u093e\u0901\u091a \u0939\u094b \u0930\u0939\u0940 \u0939\u0948\u2026';
        const info = await global.QuizUpdater.check(true);
        paintUpdate(info);
        global.QuizStorage.Bridge.toast(info && info.available ? 'नया अपडेट उपलब्ध है' : 'आप नवीनतम संस्करण पर हैं');
      });
    }

    if (doUpdateBtn) {
      doUpdateBtn.addEventListener('click', () => {
        if (global.QuizSfx) global.QuizSfx.playClick();
        const info = global.QuizUpdater.getCached();
        const url = (info && info.downloadUrl) || '';
        if (!url) { global.QuizStorage.Bridge.toast('डाउनलोड लिंक नहीं मिला'); return; }
        global.QuizUpdater.openDownload(url);
        global.QuizStorage.Bridge.toast('ब्राउज़र में डाउनलोड खुल रहा है…');
      });
    }

    const clearBtn = container.querySelector('#btn-clear-all-data');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        if (window.confirm('क्या आप निश्चित हैं? आपकी सभी परीक्षा प्रगति, स्ट्रीक और बुकमार्क मिटा दिए जाएंगे।')) {
          await global.QuizStorage.clearAllUserData();
          global.QuizStorage.Bridge.toast('सभी स्थानीय डेटा साफ़ कर दिया गया है।');
          renderSettingsScreen(container, onSettingsChanged);
          if (typeof onSettingsChanged === 'function') onSettingsChanged();
        }
      });
    }
  }

  global.QuizSettingsView = {
    renderSettingsScreen
  };
})(window);
