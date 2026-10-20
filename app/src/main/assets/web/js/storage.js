/**
 * Smart Quiz Portal — Offline Storage & Progress Engine (PRD Section 6.5, 7.2, C.8)
 *
 * Manages:
 * - Preferences in localStorage + NativeBridge DataStore mirror (theme, profile_lang, quiz_lang_pref, selected_course)
 * - Attempt history & chapter progress (best score, last score, status)
 * - Real daily streak & 7-day activity histogram (FR-11)
 * - Per-question accuracy & weak-topic tracking (FR-10)
 * - Mid-quiz auto-save & resume incomplete quiz (FR-12)
 * - Question bookmarks / revision vault (FR-13)
 * - IndexedDB translation cache (`SmartQuizDB.translations`) (Section 16.5)
 */
(function (global) {
  'use strict';

  const KEYS = {
    THEME: 'quiz_theme',
    PROFILE_LANG: 'quiz_profile_lang',
    QUIZ_LANG_PREF: 'quiz_lang_pref',
    SELECTED_COURSE: 'quiz_selected_course',
    ATTEMPTS: 'quiz_attempts_v1',
    CHAPTER_PROGRESS: 'quiz_chapter_progress_v1',
    DAILY_ACTIVITY: 'quiz_daily_activity_v1',
    QUESTION_STATS: 'quiz_question_stats_v1',
    BOOKMARKS: 'quiz_bookmarks_v1',
    INCOMPLETE_QUIZZES: 'quiz_incomplete_v1',
    QUESTIONS_PER_PART: 'quiz_questions_per_part'
  };

  const DB_NAME = 'SmartQuizPortalDB';
  const DB_VERSION = 1;
  let dbPromise = null;

  function openDatabase() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      if (!global.indexedDB) {
        resolve(null);
        return;
      }
      const req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('translations')) {
          db.createObjectStore('translations', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('attempts')) {
          db.createObjectStore('attempts', { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => resolve(null);
    });
    return dbPromise;
  }

  function safeGetJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function safeSetJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function todayDateKey(dateObj) {
    const d = dateObj || new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Native Bridge Helper (PRD Section 7.3)
  const Bridge = {
    isAvailable() {
      return typeof global.AndroidBridge !== 'undefined' && global.AndroidBridge !== null;
    },
    vibrate(ms) {
      if (this.isAvailable() && typeof global.AndroidBridge.vibrate === 'function') {
        try { global.AndroidBridge.vibrate(ms || 35); } catch (_) {}
      } else if (navigator.vibrate) {
        try { navigator.vibrate(ms || 35); } catch (_) {}
      }
    },
    toast(msg) {
      if (this.isAvailable() && typeof global.AndroidBridge.toast === 'function') {
        try { global.AndroidBridge.toast(String(msg)); return; } catch (_) {}
      }
      showWebToast(msg);
    },
    share(text) {
      if (this.isAvailable() && typeof global.AndroidBridge.share === 'function') {
        try { global.AndroidBridge.share(String(text)); return; } catch (_) {}
      }
      if (navigator.share) {
        navigator.share({ text: String(text) }).catch(() => {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(String(text)).then(() => showWebToast('स्कोर क्लिपबोर्ड पर कॉपी हो गया!'));
      }
    },
    getVersion() {
      if (this.isAvailable() && typeof global.AndroidBridge.getVersion === 'function') {
        try {
          return JSON.parse(global.AndroidBridge.getVersion());
        } catch (_) {}
      }
      return {
        appVersion: '1.0.0',
        versionCode: 1,
        contentVersion: '2026.10.1',
        platform: 'Android WebView Hybrid (Offline)'
      };
    },
    exit() {
      if (this.isAvailable() && typeof global.AndroidBridge.exit === 'function') {
        try { global.AndroidBridge.exit(); } catch (_) {}
      }
    },
    syncPrefsToNative() {
      if (!this.isAvailable() || typeof global.AndroidBridge.savePrefs !== 'function') return;
      try {
        global.AndroidBridge.savePrefs(JSON.stringify({
          theme: getTheme(),
          profileLang: getProfileLanguage(),
          quizLangPref: getQuizLanguagePref(),
          selectedCourse: getSelectedCourse()
        }));
      } catch (_) {}
    },
    syncProgressToNative() {
      if (!this.isAvailable() || typeof global.AndroidBridge.saveProgress !== 'function') return;
      try {
        const snapshot = {
          chapterProgress: safeGetJSON(KEYS.CHAPTER_PROGRESS, {}),
          dailyActivity: safeGetJSON(KEYS.DAILY_ACTIVITY, {}),
          questionStats: safeGetJSON(KEYS.QUESTION_STATS, {}),
          bookmarks: safeGetJSON(KEYS.BOOKMARKS, {}),
          updatedAt: Date.now()
        };
        global.AndroidBridge.saveProgress(JSON.stringify(snapshot));
      } catch (_) {}
    },
    restoreFromNativeIfEmpty() {
      if (!this.isAvailable()) return;
      try {
        if (!localStorage.getItem(KEYS.SELECTED_COURSE) && typeof global.AndroidBridge.getPrefs === 'function') {
          const prefs = JSON.parse(global.AndroidBridge.getPrefs() || '{}');
          if (prefs.theme) localStorage.setItem(KEYS.THEME, prefs.theme);
          if (prefs.profileLang) localStorage.setItem(KEYS.PROFILE_LANG, prefs.profileLang);
          if (prefs.quizLangPref) localStorage.setItem(KEYS.QUIZ_LANG_PREF, prefs.quizLangPref);
          if (prefs.selectedCourse) localStorage.setItem(KEYS.SELECTED_COURSE, prefs.selectedCourse);
        }
        if (!localStorage.getItem(KEYS.CHAPTER_PROGRESS) && typeof global.AndroidBridge.loadProgress === 'function') {
          const raw = global.AndroidBridge.loadProgress();
          if (raw) {
            const snap = JSON.parse(raw);
            if (snap.chapterProgress) safeSetJSON(KEYS.CHAPTER_PROGRESS, snap.chapterProgress);
            if (snap.dailyActivity) safeSetJSON(KEYS.DAILY_ACTIVITY, snap.dailyActivity);
            if (snap.questionStats) safeSetJSON(KEYS.QUESTION_STATS, snap.questionStats);
            if (snap.bookmarks) safeSetJSON(KEYS.BOOKMARKS, snap.bookmarks);
          }
        }
      } catch (_) {}
    }
  };

  function showWebToast(msg) {
    let el = document.getElementById('web-toast-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'web-toast-banner';
      el.style.cssText = 'position:fixed;bottom:78px;left:50%;transform:translateX(-50%);background:#1E293B;color:#F8FAFC;border:1px solid rgba(139,92,246,0.45);padding:9px 16px;border-radius:999px;font-size:0.78rem;font-weight:700;z-index:100;box-shadow:0 8px 20px rgba(0,0,0,0.45);transition:opacity 0.2s;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.opacity = '0'; }, 2200);
  }

  // Preferences

  // ------------------------------------------------------------------
  // Parts feature: how many questions the student wants in one test
  // 0 = Default (no split — the whole chapter in one go)
  // ------------------------------------------------------------------
  function getQuestionsPerPart() {
    const raw = parseInt(localStorage.getItem(KEYS.QUESTIONS_PER_PART), 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }

  function setQuestionsPerPart(n) {
    const num = parseInt(n, 10);
    localStorage.setItem(KEYS.QUESTIONS_PER_PART, String(Number.isFinite(num) && num > 0 ? num : 0));
  }

  // Incomplete quizzes are stored per part so each part resumes independently.
  // partIndex 0 (or missing) keeps the plain chapterId, so old data still works.
  function partSessionKey(chapterId, partIndex) {
    const p = Number(partIndex) || 0;
    return p > 0 ? `${chapterId}#p${p}` : String(chapterId);
  }

  // How many distinct parts of this chapter have been completed.
  function getCompletedPartsCount(chapterId) {
    const attempts = safeGetJSON(KEYS.ATTEMPTS, []);
    const seen = {};
    attempts.forEach((a) => {
      if (a && a.chapterId === chapterId && a.partIndex) seen[a.partIndex] = true;
    });
    return Object.keys(seen).length;
  }

  function getBestPartScores(chapterId) {
    const attempts = safeGetJSON(KEYS.ATTEMPTS, []);
    const best = {};
    attempts.forEach((a) => {
      if (a && a.chapterId === chapterId && a.partIndex) {
        best[a.partIndex] = Math.max(best[a.partIndex] || 0, a.percentage || 0);
      }
    });
    return best;
  }

  function getTheme() {
    return localStorage.getItem(KEYS.THEME) || 'dark';
  }
  function setTheme(theme) {
    localStorage.setItem(KEYS.THEME, theme);
    applyThemeToDOM(theme);
    Bridge.syncPrefsToNative();
  }
  function applyThemeToDOM(theme) {
    const resolved = theme === 'system'
      ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : theme;
    document.documentElement.setAttribute('data-theme', resolved);
  }

  function getProfileLanguage() {
    return localStorage.getItem(KEYS.PROFILE_LANG) || 'hi';
  }
  function setProfileLanguage(lang) {
    const clean = lang === 'en' ? 'en' : 'hi';
    localStorage.setItem(KEYS.PROFILE_LANG, clean);
    document.documentElement.setAttribute('lang', clean);
    Bridge.syncPrefsToNative();
  }

  function getQuizLanguagePref() {
    return localStorage.getItem(KEYS.QUIZ_LANG_PREF) || 'hi-pri';
  }
  function setQuizLanguagePref(pref) {
    localStorage.setItem(KEYS.QUIZ_LANG_PREF, pref);
    Bridge.syncPrefsToNative();
  }

  function getSelectedCourse() {
    return localStorage.getItem(KEYS.SELECTED_COURSE) || 'bseb10';
  }
  function setSelectedCourse(courseId) {
    localStorage.setItem(KEYS.SELECTED_COURSE, courseId);
    Bridge.syncPrefsToNative();
  }

  // Daily Activity & Real Streak (FR-11)
  function recordDailyQuestionAnswered(countDelta) {
    const activity = safeGetJSON(KEYS.DAILY_ACTIVITY, {});
    const key = todayDateKey();
    activity[key] = (activity[key] || 0) + (countDelta || 1);
    safeSetJSON(KEYS.DAILY_ACTIVITY, activity);
    Bridge.syncProgressToNative();
  }

  function getStreakAndWeeklyBars() {
    const activity = safeGetJSON(KEYS.DAILY_ACTIVITY, {});
    const now = new Date();
    let streak = 0;
    const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // If user hasn't answered today yet, check if yesterday had activity to keep current streak alive
    const todayKey = todayDateKey(cursor);
    if (!activity[todayKey]) {
      const yesterday = new Date(cursor);
      yesterday.setDate(yesterday.getDate() - 1);
      if (activity[todayDateKey(yesterday)] > 0) {
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    while (true) {
      const k = todayDateKey(cursor);
      if ((activity[k] || 0) > 0) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    // Build 7-day bars for current week (Sunday .. Saturday)
    const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const todayDow = now.getDay();
    const bars = [];
    let maxVal = 10;
    const rawCounts = [];

    for (let dow = 0; dow < 7; dow++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (todayDow - dow));
      const cnt = activity[todayDateKey(d)] || 0;
      rawCounts.push(cnt);
      if (cnt > maxVal) maxVal = cnt;
    }

    for (let dow = 0; dow < 7; dow++) {
      const cnt = rawCounts[dow];
      const heightPct = cnt === 0 ? 22 : Math.max(32, Math.round((cnt / maxVal) * 100));
      bars.push({
        label: dayLetters[dow],
        count: cnt,
        heightPct,
        isToday: dow === todayDow
      });
    }

    return { streak, bars, totalDaysActive: Object.keys(activity).length };
  }

  // Per-question stats & Weak Topics (FR-10)
  function recordQuestionOutcome(chapterId, chapterTitle, questionIndex, questionData, isCorrect) {
    const stats = safeGetJSON(KEYS.QUESTION_STATS, {});
    const qId = `${chapterId}::q${questionIndex}`;
    const existing = stats[qId] || {
      qId,
      chapterId,
      chapterTitle,
      questionIndex,
      q: questionData.q,
      o: questionData.o,
      a: questionData.a,
      correctCount: 0,
      wrongCount: 0,
      lastAnsweredAt: 0
    };
    if (isCorrect) {
      existing.correctCount += 1;
    } else {
      existing.wrongCount += 1;
    }
    existing.lastAnsweredAt = Date.now();
    stats[qId] = existing;
    safeSetJSON(KEYS.QUESTION_STATS, stats);
    recordDailyQuestionAnswered(1);
  }

  function getWeakTopicsList() {
    const stats = safeGetJSON(KEYS.QUESTION_STATS, {});
    return Object.values(stats)
      .filter((item) => item.wrongCount > 0 && item.wrongCount >= item.correctCount)
      .sort((a, b) => (b.wrongCount - b.correctCount) - (a.wrongCount - a.correctCount));
  }

  // Mid-Quiz Incomplete Session Save / Resume (FR-12)
  function saveIncompleteQuiz(sessionKey, sessionState) {
    const all = safeGetJSON(KEYS.INCOMPLETE_QUIZZES, {});
    all[sessionKey] = {
      ...sessionState,
      updatedAt: Date.now()
    };
    safeSetJSON(KEYS.INCOMPLETE_QUIZZES, all);

    // Chapter progress is always tracked at chapter level (never per part)
    const chapterId = sessionState.chapterId || sessionKey;
    const prog = safeGetJSON(KEYS.CHAPTER_PROGRESS, {});
    const curr = prog[chapterId] || { status: 'not_started', bestScorePct: 0, lastScorePct: 0, attemptsCount: 0 };
    const answeredCount = (sessionState.states || []).filter((s) => s === 'correct' || s === 'wrong').length;
    prog[chapterId] = {
      ...curr,
      status: curr.status === 'completed' ? 'completed' : (answeredCount > 0 ? 'in_progress' : curr.status),
      answeredSoFar: answeredCount,
      totalQuestions: (sessionState.questions || []).length,
      updatedAt: Date.now()
    };
    safeSetJSON(KEYS.CHAPTER_PROGRESS, prog);
  }

  function getIncompleteQuiz(sessionKey) {
    const all = safeGetJSON(KEYS.INCOMPLETE_QUIZZES, {});
    return all[sessionKey] || null;
  }

  function getLatestIncompleteQuiz() {
    const all = safeGetJSON(KEYS.INCOMPLETE_QUIZZES, {});
    const list = Object.values(all).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return list[0] || null;
  }

  function clearIncompleteQuiz(sessionKey) {
    const all = safeGetJSON(KEYS.INCOMPLETE_QUIZZES, {});
    delete all[sessionKey];
    safeSetJSON(KEYS.INCOMPLETE_QUIZZES, all);
  }

  // Completed Attempts & Chapter Progress (FR-07, FR-09)
  function saveCompletedAttempt(attempt) {
    const attempts = safeGetJSON(KEYS.ATTEMPTS, []);
    attempts.unshift(attempt);
    if (attempts.length > 200) attempts.length = 200;
    safeSetJSON(KEYS.ATTEMPTS, attempts);

    const prog = safeGetJSON(KEYS.CHAPTER_PROGRESS, {});
    const prev = prog[attempt.chapterId] || {
      bestScorePct: 0,
      lastScorePct: 0,
      attemptsCount: 0
    };
    prog[attempt.chapterId] = {
      chapterId: attempt.chapterId,
      status: 'completed',
      bestScorePct: Math.max(prev.bestScorePct || 0, attempt.percentage),
      lastScorePct: attempt.percentage,
      lastCorrect: attempt.correct,
      totalQuestions: attempt.total,
      attemptsCount: (prev.attemptsCount || 0) + 1,
      updatedAt: Date.now()
    };
    safeSetJSON(KEYS.CHAPTER_PROGRESS, prog);
    clearIncompleteQuiz(attempt.chapterId);
    Bridge.syncProgressToNative();

    openDatabase().then((db) => {
      if (!db) return;
      try {
        const tx = db.transaction('attempts', 'readwrite');
        tx.objectStore('attempts').put(attempt);
      } catch (_) {}
    });

    return attempt;
  }

  function getAttemptById(attemptId) {
    const attempts = safeGetJSON(KEYS.ATTEMPTS, []);
    return attempts.find((a) => a.id === attemptId) || attempts[0] || null;
  }

  function getAllAttempts() {
    return safeGetJSON(KEYS.ATTEMPTS, []);
  }

  function getChapterProgress(chapterId) {
    const prog = safeGetJSON(KEYS.CHAPTER_PROGRESS, {});
    return prog[chapterId] || {
      chapterId,
      status: 'not_started',
      bestScorePct: 0,
      lastScorePct: 0,
      attemptsCount: 0,
      answeredSoFar: 0
    };
  }

  function getAllChapterProgress() {
    return safeGetJSON(KEYS.CHAPTER_PROGRESS, {});
  }

  // Bookmarks / Revision List (FR-13)
  function toggleBookmark(item) {
    const bookmarks = safeGetJSON(KEYS.BOOKMARKS, {});
    const key = `${item.chapterId}::q${item.questionIndex}`;
    let added = false;
    if (bookmarks[key]) {
      delete bookmarks[key];
    } else {
      bookmarks[key] = {
        key,
        chapterId: item.chapterId,
        chapterTitle: item.chapterTitle,
        questionIndex: item.questionIndex,
        q: item.q,
        o: item.o,
        a: item.a,
        savedAt: Date.now()
      };
      added = true;
    }
    safeSetJSON(KEYS.BOOKMARKS, bookmarks);
    Bridge.syncProgressToNative();
    return added;
  }

  function isBookmarked(chapterId, questionIndex) {
    const bookmarks = safeGetJSON(KEYS.BOOKMARKS, {});
    return Boolean(bookmarks[`${chapterId}::q${questionIndex}`]);
  }

  function getBookmarksList() {
    const bookmarks = safeGetJSON(KEYS.BOOKMARKS, {});
    return Object.values(bookmarks).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  }

  // IndexedDB Translation Cache (PRD Section 16.5 & 16.6)
  async function getCachedTranslation(key) {
    const db = await openDatabase();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('translations', 'readonly');
        const req = tx.objectStore('translations').get(key);
        req.onsuccess = () => resolve(req.result ? req.result.translated : null);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  }

  async function setCachedTranslation(key, translated) {
    const db = await openDatabase();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('translations', 'readwrite');
        tx.objectStore('translations').put({ key, translated, updatedAt: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (_) {
        resolve();
      }
    });
  }

  async function clearAllUserData() {
    localStorage.clear();
    if (Bridge.isAvailable() && typeof global.AndroidBridge.clearNativeData === 'function') {
      try { global.AndroidBridge.clearNativeData(); } catch (_) {}
    }
    const db = await openDatabase();
    if (db) {
      try {
        const tx1 = db.transaction('translations', 'readwrite');
        tx1.objectStore('translations').clear();
        const tx2 = db.transaction('attempts', 'readwrite');
        tx2.objectStore('attempts').clear();
      } catch (_) {}
    }
  }

  // Initialize restoration on boot
  Bridge.restoreFromNativeIfEmpty();
  applyThemeToDOM(getTheme());

  global.QuizStorage = {
    Bridge,
    getTheme,
    setTheme,
    applyThemeToDOM,
    getProfileLanguage,
    setProfileLanguage,
    getQuizLanguagePref,
    setQuizLanguagePref,
    getQuestionsPerPart,
    setQuestionsPerPart,
    partSessionKey,
    getCompletedPartsCount,
    getBestPartScores,
    getSelectedCourse,
    setSelectedCourse,
    recordDailyQuestionAnswered,
    getStreakAndWeeklyBars,
    recordQuestionOutcome,
    getWeakTopicsList,
    saveIncompleteQuiz,
    getIncompleteQuiz,
    getLatestIncompleteQuiz,
    clearIncompleteQuiz,
    saveCompletedAttempt,
    getAttemptById,
    getAllAttempts,
    getChapterProgress,
    getAllChapterProgress,
    toggleBookmark,
    isBookmarked,
    getBookmarksList,
    getCachedTranslation,
    setCachedTranslation,
    clearAllUserData
  };
})(window);
