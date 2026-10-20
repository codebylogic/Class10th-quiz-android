/**
 * Smart Quiz Portal — Unicode Script Language Detector (PRD Section 16.5)
 * Detects Hindi (Devanagari: U+0900..U+097F) vs English (Latin) for single-language strings.
 */
(function (global) {
  'use strict';

  const DEVANAGARI_REGEX = /[\u0900-\u097F]/g;
  const LATIN_REGEX = /[A-Za-z]/g;

  function detectLanguage(text) {
    if (!text || typeof text !== 'string') return 'hi';
    const devMatches = text.match(DEVANAGARI_REGEX);
    const devCount = devMatches ? devMatches.length : 0;
    if (devCount > 0) {
      return 'hi';
    }
    const latMatches = text.match(LATIN_REGEX);
    const latCount = latMatches ? latMatches.length : 0;
    return latCount > 0 ? 'en' : 'hi';
  }

  function hashTranslationKey(text, fromLang, toLang) {
    const raw = `${fromLang}:${toLang}:${String(text).trim()}`;
    let h1 = 0xdeadbeef ^ raw.length;
    let h2 = 0x41c6ce57 ^ raw.length;
    for (let i = 0, ch; i < raw.length; i++) {
      ch = raw.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 'tr_' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  global.LangDetect = {
    detectLanguage,
    hashTranslationKey
  };
})(window);
