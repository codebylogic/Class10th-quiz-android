/**
 * Smart Quiz Portal — Launch Intro
 *
 * Plays the opening animation (a book page turns, a QUIZ question appears and a
 * hand taps the correct option) and then reveals the app. The animation itself
 * lives in css/intro.css; this file only drives the sound cues, marks the
 * correct option, and gets the overlay out of the way — always.
 *
 * Tap anywhere to skip. Reduced-motion users never see it at all.
 */
(function (global) {
  'use strict';

  var OVERLAY_ID = 'app-intro';
  var CORRECT_INDEX = 1;          // the option the hand taps (B)

  // Timings kept in step with the keyframes in css/intro.css
  var TAP_CLICK_MS = 2330;        // hand reaches the option
  var TAP_HIT_MS = 2510;          // hand presses down -> option turns green
  var FADE_OUT_MS = 2950;
  var REMOVE_MS = 3420;
  var SAFETY_MS = 6000;           // hard stop: never trap the user

  var timers = [];
  var done = false;

  function later(fn, ms) { timers.push(global.setTimeout(fn, ms)); }
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) global.clearTimeout(timers[i]);
    timers = [];
  }

  function remove(overlay, fast) {
    if (done) return;
    done = true;
    clearTimers();
    overlay.classList.add('intro-out');
    global.setTimeout(function () {
      overlay.classList.add('intro-gone');
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, fast ? 200 : 460);
  }

  function start() {
    var overlay = global.document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    try {
      if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        return;
      }
    } catch (e) { /* matchMedia unavailable — carry on */ }

    var opts = overlay.querySelectorAll('.intro-opt');
    var target = opts[CORRECT_INDEX] || null;

    later(function () {
      if (global.QuizSfx) global.QuizSfx.playClick();
    }, TAP_CLICK_MS);

    later(function () {
      if (target) target.classList.add('is-correct');
      if (global.QuizSfx) global.QuizSfx.playCorrect();
    }, TAP_HIT_MS);

    later(function () { if (!done) { overlay.classList.add('intro-out'); } }, FADE_OUT_MS);
    later(function () { remove(overlay, false); }, REMOVE_MS);
    later(function () { remove(overlay, true); }, SAFETY_MS);

    var skip = function () { remove(overlay, true); };
    overlay.addEventListener('click', skip, { once: true });
    overlay.addEventListener('touchstart', skip, { once: true, passive: true });
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  global.QuizIntro = { start: start };
})(window);
