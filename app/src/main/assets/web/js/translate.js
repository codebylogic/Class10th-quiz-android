/**
 * Smart Quiz Portal — Profile Language Translation Pipeline (PRD Section 16)
 *
 * Implements:
 * - Section 16.2 Translation Rule:
 *   * Hindi-only content: shown as-is when Profile = Hindi; translated Hindi -> English when Profile = English.
 *   * English-only content: translated English -> Hindi when Profile = Hindi; shown as-is when Profile = English.
 *   * Bilingual { hi, en } content: already holds both Hindi & English (no network call needed!).
 *     Follows Section 16.11 edge case: when Profile = English, bilingual content collapses duplicate English lines
 *     or uses the authoritative English field cleanly.
 * - Section 16.4 Display Pipeline:
 *   1. Pick source variant
 *   2. For options only: strip parenthetical glosses (`text.replace(/\s*\([^)]*\)/g, "").trim()`) BEFORE translating
 *   3. Check source language == profile language -> show as-is; else lookup IndexedDB cache -> Bundled Offline Dictionary -> Online Provider
 *   4. Return result immediately (swapping in async translation if fetched online).
 */
(function (global) {
  'use strict';

  const memoryCache = new Map();

  // Pre-bundled offline dictionary for common single-language NCERT/BSEB terms & questions (Section 16.8)
  const OFFLINE_DICTIONARY = {
    'en:hi': {
      'Which mirror is used as a rear-view mirror in vehicles?': 'वाहनों में पीछे का दृश्य देखने के लिए किस दर्पण का उपयोग किया जाता है?',
      'Which type of mirror is used as a rear-view mirror in vehicles?': 'वाहनों में पश्य-दृश्य दर्पण के रूप में किस दर्पण का उपयोग होता है?',
      'Convex mirror': 'उत्तल दर्पण',
      'Plane mirror': 'समतल दर्पण',
      'Concave mirror': 'अवतल दर्पण',
      'Parabolic mirror': 'परवलयिक दर्पण',
      'What is the SI unit of electric current?': 'विद्युत धारा का SI मात्रक क्या है?',
      'Ampere': 'एम्पियर',
      'Volt': 'वोल्ट',
      'Ohm': 'ओम',
      'Watt': 'वाट',
      'What is the pH of pure water?': 'शुद्ध जल का pH मान क्या होता है?',
      'Which gas is liberated when an acid reacts with a metal?': 'जब कोई अम्ल किसी धातु के साथ अभिक्रिया करता है तो कौन-सी गैस निकलती है?',
      'Hydrogen': 'हाइड्रोजन',
      'Oxygen': 'ऑक्सीजन',
      'Nitrogen': 'नाइट्रोजन',
      'Carbon dioxide': 'कार्बन डाइऑक्साइड',
      'Who is known as the Father of the Indian Constitution?': 'भारतीय संविधान के जनक के रूप में किसे जाना जाता है?',
      'Dr. B.R. Ambedkar': 'डॉ. बी.आर. अम्बेडकर',
      'Mahatma Gandhi': 'महात्मा गांधी',
      'Jawaharlal Nehru': 'जवाहरलाल नेहरू',
      'Sardar Vallabhbhai Patel': 'सरदार वल्लभभाई पटेल'
    },
    'hi:en': {
      'प्रकाश के परावर्तन के कितने नियम हैं?': 'How many laws of reflection of light are there?',
      'प्रकाश का वेग न्यूनतम होता है:': 'The speed of light is minimum in:',
      'निर्वात में': 'In vacuum',
      'जल में': 'In water',
      'वायु में': 'In air',
      'काँच में': 'In glass',
      'समतल दर्पण द्वारा बना प्रतिबिम्ब होता है:': 'The image formed by a plane mirror is:',
      'वास्तविक': 'Real',
      'काल्पनिक': 'Virtual',
      'दोनों': 'Both',
      'इनमें से कोई नहीं': 'None of these',
      'विभवांतर का SI मात्रक क्या होता है?': 'What is the SI unit of potential difference?',
      'मानव नेत्र के किस भाग पर किसी वस्तु का प्रतिबिंब बनता है?': 'On which part of the human eye is the image of an object formed?',
      'रेटिना या दृष्टिपटल': 'Retina',
      'कॉर्निया': 'Cornea',
      'परितारिका': 'Iris',
      'पुतली': 'Pupil',
      'श्रम विभाजन और जाति प्रथा के लेखक कौन हैं?': 'Who is the author of Labour Division and Caste System?',
      'भीमराव अम्बेडकर': 'Bhimrao Ambedkar',
      'नलिन विलोचन शर्मा': 'Nalin Vilochan Sharma',
      'मैक्स मूलर': 'Max Muller',
      'हजारी प्रसाद द्विवेदी': 'Hazari Prasad Dwivedi'
    }
  };

  /**
   * Appendix C.2: Strip parenthetical glosses before displaying or translating option text
   */
  function stripParentheses(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/\s*\([^)]*\)/g, '').trim();
  }

  /**
   * Online Translation Provider with automatic fallback to original text when offline (Section 16.5 & 16.7)
   */
  async function callOnlineTranslationProvider(text, fromLang, toLang) {
    if (!navigator.onLine) return null;
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(fromLang)}&tl=${encodeURIComponent(toLang)}&dt=t&q=${encodeURIComponent(text)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) return null;
      const data = await response.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const joined = data[0].map((part) => (part && part[0]) ? part[0] : '').join('').trim();
        if (joined && joined !== text) {
          return joined;
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Translates a single-language string into targetProfileLang ('hi' or 'en').
   * Checks memoryCache -> Bundled Offline Dictionary -> IndexedDB -> Online Provider -> Original fallback.
   */
  async function translateString(rawText, isOption, targetProfileLang) {
    if (!rawText || typeof rawText !== 'string') {
      return { text: '', translated: false, fromCache: true };
    }
    const cleaned = isOption ? stripParentheses(rawText) : rawText.trim();
    const profileLang = targetProfileLang || global.QuizStorage.getProfileLanguage();
    const sourceLang = global.LangDetect.detectLanguage(cleaned);

    if (sourceLang === profileLang) {
      return { text: cleaned, translated: false, fromCache: true };
    }

    const dirKey = `${sourceLang}:${profileLang}`;
    if (OFFLINE_DICTIONARY[dirKey] && OFFLINE_DICTIONARY[dirKey][cleaned]) {
      return {
        text: OFFLINE_DICTIONARY[dirKey][cleaned],
        translated: true,
        fromCache: true
      };
    }

    const cacheKey = global.LangDetect.hashTranslationKey(cleaned, sourceLang, profileLang);
    if (memoryCache.has(cacheKey)) {
      return { text: memoryCache.get(cacheKey), translated: true, fromCache: true };
    }

    const dbHit = await global.QuizStorage.getCachedTranslation(cacheKey);
    if (dbHit) {
      memoryCache.set(cacheKey, dbHit);
      return { text: dbHit, translated: true, fromCache: true };
    }

    const onlineResult = await callOnlineTranslationProvider(cleaned, sourceLang, profileLang);
    if (onlineResult) {
      memoryCache.set(cacheKey, onlineResult);
      await global.QuizStorage.setCachedTranslation(cacheKey, onlineResult);
      return { text: onlineResult, translated: true, fromCache: false };
    }

    // Section 16.7 Offline Fallback: return original text cleanly so quiz never blocks
    return { text: cleaned, translated: false, offlineFallback: true };
  }

  /**
   * Synchronously formats a question or option for immediate rendering (never leaves a blank screen),
   * and triggers `onAsyncSwap` if an uncached single-language string finishes translating.
   */
  function resolveDisplayPair(fieldVal, isOption, languagePref, onAsyncSwap) {
    const profileLang = global.QuizStorage.getProfileLanguage();
    const pref = languagePref || global.QuizStorage.getQuizLanguagePref();

    // Case 1: Bilingual { hi, en } object (Section 16.2, 16.11, Appendix C.3 & C.4)
    if (fieldVal && typeof fieldVal === 'object' && ('hi' in fieldVal || 'en' in fieldVal)) {
      const hiText = isOption ? stripParentheses(fieldVal.hi || '') : (fieldVal.hi || '').trim();
      const enText = isOption ? stripParentheses(fieldVal.en || '') : (fieldVal.en || '').trim();

      // Section 16.11 Edge Case: If profileLang === 'en' and user chose 'only-en' (or bilingual collapse when requested)
      if (pref === 'only-hi') {
        return { primary: hiText || enText, secondary: '' };
      }
      if (pref === 'only-en') {
        return { primary: enText || hiText, secondary: '' };
      }
      if (pref === 'en-pri' || profileLang === 'en') {
        return { primary: enText || hiText, secondary: hiText };
      }
      // Default hi-pri
      return { primary: hiText || enText, secondary: enText };
    }

    // Case 2: Single-language string (Section 16.2 & 16.4)
    const rawStr = String(fieldVal || '');
    const cleaned = isOption ? stripParentheses(rawStr) : rawStr.trim();
    const sourceLang = global.LangDetect.detectLanguage(cleaned);

    if (sourceLang === profileLang) {
      return { primary: cleaned, secondary: '' };
    }

    const dirKey = `${sourceLang}:${profileLang}`;
    if (OFFLINE_DICTIONARY[dirKey] && OFFLINE_DICTIONARY[dirKey][cleaned]) {
      return { primary: OFFLINE_DICTIONARY[dirKey][cleaned], secondary: cleaned };
    }

    const cacheKey = global.LangDetect.hashTranslationKey(cleaned, sourceLang, profileLang);
    if (memoryCache.has(cacheKey)) {
      return { primary: memoryCache.get(cacheKey), secondary: cleaned };
    }

    // Kick off async lookup / translation and swap in when ready (Section 16.6)
    if (typeof onAsyncSwap === 'function') {
      translateString(rawStr, isOption, profileLang).then((res) => {
        if (res && res.translated && res.text && res.text !== cleaned) {
          onAsyncSwap({ primary: res.text, secondary: cleaned });
        }
      });
    }

    return { primary: cleaned, secondary: '' };
  }

  global.QuizTranslator = {
    stripParentheses,
    translateString,
    resolveDisplayPair
  };
})(window);
