/**
 * Smart Quiz Portal — In-App Update Checker
 *
 * Asks GitHub for the latest published release and compares its tag with the
 * version of the app that is installed. If the released version is newer, the
 * Settings screen offers an update button that opens the download.
 *
 * The check is best-effort: with no internet (or if GitHub is unreachable) it
 * fails silently and the app carries on working exactly as before.
 */
(function (global) {
  'use strict';

  var REPO = 'codebylogic/Class10th-quiz-android';
  var API_LATEST = 'https://api.github.com/repos/' + REPO + '/releases/latest';
  var CACHE_KEY = 'quiz_update_check_v1';
  var CACHE_MS = 12 * 60 * 60 * 1000; // re-check at most twice a day
  var lastResult = null;

  function parseVersion(value) {
    var parts = String(value || '').replace(/^v/i, '').trim().split('.');
    return [
      parseInt(parts[0], 10) || 0,
      parseInt(parts[1], 10) || 0,
      parseInt(parts[2], 10) || 0
    ];
  }

  function isNewer(latest, current) {
    for (var i = 0; i < 3; i++) {
      if (latest[i] > current[i]) return true;
      if (latest[i] < current[i]) return false;
    }
    return false;
  }

  function installedVersion() {
    try {
      // Bridge.getVersion() already returns a parsed object; tolerate a raw JSON string too.
      var info = global.QuizStorage.Bridge.getVersion();
      if (typeof info === 'string') info = JSON.parse(info);
      return (info && info.appVersion) || '0.0.0';
    } catch (e) {
      return '0.0.0';
    }
  }

  function readCache() {
    try {
      var raw = global.localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.result) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeCache(result) {
    try {
      global.localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), result: result }));
    } catch (e) { /* storage full or blocked — not important */ }
  }

  function pickApkUrl(release) {
    var assets = (release && release.assets) || [];
    for (var i = 0; i < assets.length; i++) {
      var name = String(assets[i].name || '').toLowerCase();
      if (name.indexOf('.apk') !== -1) return assets[i].browser_download_url;
    }
    return release ? release.html_url : '';
  }

  function buildResult(release) {
    var tag = release.tag_name || '';
    var current = installedVersion();
    var apkUrl = pickApkUrl(release);
    return {
      available: isNewer(parseVersion(tag), parseVersion(current)),
      latest: tag || current,
      current: 'v' + current,
      downloadUrl: apkUrl || release.html_url,
      releaseUrl: release.html_url || '',
      notes: (release.body || '').slice(0, 500),
      checkedAt: Date.now()
    };
  }

  /** Returns the last known result without any network call (may be null). */
  function getCached() {
    if (lastResult) return lastResult;
    var cached = readCache();
    return cached ? cached.result : null;
  }

  /** Checks GitHub. force = true ignores the 12-hour cache. Never throws. */
  async function check(force) {
    var cached = readCache();
    if (!force && cached && (Date.now() - (cached.at || 0)) < CACHE_MS) {
      lastResult = cached.result;
      return cached.result;
    }
    try {
      var res = await global.fetch(API_LATEST, {
        headers: { 'Accept': 'application/vnd.github+json' }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var release = await res.json();
      var result = buildResult(release);
      lastResult = result;
      writeCache(result);
      return result;
    } catch (err) {
      // offline, rate-limited or blocked — never disturb the user
      if (cached) { lastResult = cached.result; return cached.result; }
      return { available: false, current: 'v' + installedVersion(), latest: '', error: String(err && err.message || err) };
    }
  }

  /** Opens the download in the device browser. */
  function openDownload(url) {
    if (!url) return;
    try {
      global.QuizStorage.Bridge.openExternal(url);
    } catch (e) {
      try { global.open(url, '_blank'); } catch (e2) { /* ignore */ }
    }
  }

  global.QuizUpdater = {
    check: check,
    getCached: getCached,
    installedVersion: installedVersion,
    openDownload: openDownload
  };
})(window);
