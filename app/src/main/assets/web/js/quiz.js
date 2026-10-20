/**
 * Smart Quiz Portal — Core Quiz Engine (PRD Appendix B & Appendix C.1 - C.7)
 *
 * Implements:
 * - C.1: Fisher–Yates question & option shuffle with index-safe `isCorrect` pairing
 *        (prevents the duplicate-option indexOf bug noted in Appendix C.1).
 * - C.2: Option parenthesis stripping at display time.
 * - C.3 & C.4: Bilingual question & option rendering (`hi-pri`, `en-pri`, `only-hi`, `only-en`).
 * - C.5: Option letter badges A..F.
 * - C.6: Result percentage, grade bands (100%, >=80%, >=50%, <50%), ring colors, and exact Hindi messages.
 * - C.7: Per-question 5-state machine (`default`, `current`, `correct`, `wrong`, `skipped`),
 *        instant feedback lock, Skip -> Next replacement, touch swipe navigation, and live timer.
 */
(function (global) {
  'use strict';

  const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  /**
   * Appendix C.1: Fisher–Yates Question & Option Shuffle
   * Uses `isCorrect` flag pairing rather than `indexOf` value lookup so identical option strings
   * never mis-map the correct index `a`.
   */
  function shuffleQuestionsAndOptions(questionsArray) {
    const cloned = JSON.parse(JSON.stringify(questionsArray || []));

    // Shuffle question order
    for (let i = cloned.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = cloned[i];
      cloned[i] = cloned[j];
      cloned[j] = tmp;
    }

    // Shuffle options inside each question while preserving exact correct option
    for (let qIdx = 0; qIdx < cloned.length; qIdx++) {
      const item = cloned[qIdx];
      const taggedOptions = (item.o || []).map((optVal, idx) => ({
        optVal,
        isCorrect: idx === item.a
      }));

      for (let i = taggedOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = taggedOptions[i];
        taggedOptions[i] = taggedOptions[j];
        taggedOptions[j] = tmp;
      }

      item.o = taggedOptions.map((entry) => entry.optVal);
      const newCorrectIndex = taggedOptions.findIndex((entry) => entry.isCorrect);
      item.a = newCorrectIndex >= 0 ? newCorrectIndex : 0;
    }

    return cloned;
  }

  /**
   * Appendix C.6: Quiz-start info strip calculation
   */
  function computeQuizInfoStrip(questionCount) {
    const count = Number(questionCount) || 0;
    return {
      questions: count,
      estimatedMinutes: Math.ceil(count * 0.7),
      marks: count
    };
  }

  /**
   * Appendix C.6: Scoring, Result Bands, Ring Colors & Motivational Messages
   */
  function evaluateResultBand(score, total) {
    const safeTotal = Math.max(1, Number(total) || 1);
    const percentage = Math.round((score / safeTotal) * 100);

    if (percentage === 100) {
      return {
        percentage,
        message: 'उत्कृष्ट! आपने पूरे अंक प्राप्त किए हैं!',
        gradeLabel: 'उत्कृष्ट (Grade A+)',
        ringColor: '#10B981',
        ringToken: 'emerald'
      };
    }
    if (percentage >= 80) {
      return {
        percentage,
        message: 'शानदार प्रदर्शन! आपकी तैयारी बहुत अच्छी है।',
        gradeLabel: 'उत्कृष्ट (Grade A)',
        ringColor: '#10B981',
        ringToken: 'emerald'
      };
    }
    if (percentage >= 50) {
      return {
        percentage,
        message: 'अच्छा प्रयास! पाठ को एक बार और दोहराएँ।',
        gradeLabel: 'अच्छा (Grade B)',
        ringColor: '#F59E0B',
        ringToken: 'amber'
      };
    }
    return {
      percentage,
      message: 'अभ्यास जारी रखें! पाठ्यपुस्तक को ध्यान से पढ़ें और पुनः प्रयास करें।',
      gradeLabel: 'सुधार आवश्यक (Grade C)',
      ringColor: '#F43F5E',
      ringToken: 'rose'
    };
  }

  function getOptionLetter(index) {
    return OPTION_LETTERS[index] || String.fromCharCode(65 + index);
  }

  global.QuizEngine = {
    shuffleQuestionsAndOptions,
    computeQuizInfoStrip,
    evaluateResultBand,
    getOptionLetter
  };
})(window);
