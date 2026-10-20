/**
 * Smart Quiz Portal — Answer Sound Effects (new)
 *
 * Two short, synthesised tones played when a question is answered:
 *   - correct : a bright two-note rise (G5 -> D6)
 *   - wrong   : a short, soft low buzz (G3 -> D3)
 *
 * The sounds are generated with the Web Audio API, so NO audio files are
 * bundled — this adds zero bytes to the APK and works completely offline.
 * The user can turn them off from Settings (localStorage flag).
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'quiz_sfx_muted';
  var ctx = null;

  function isMuted() {
    try { return global.localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }

  function setMuted(muted) {
    try { global.localStorage.setItem(STORAGE_KEY, muted ? '1' : '0'); } catch (e) {}
  }

  function audioContext() {
    if (isMuted()) return null;
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      return ctx;
    } catch (e) {
      return null;
    }
  }

  function note(ac, freq, start, dur, type, gain) {
    var osc = ac.createOscillator();
    var amp = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.linearRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp);
    amp.connect(ac.destination);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  function playCorrect() {
    var ac = audioContext();
    if (!ac) return;
    var t = ac.currentTime;
    note(ac, 783.99, t, 0.14, 'sine', 0.18);         // G5
    note(ac, 1174.66, t + 0.09, 0.22, 'sine', 0.16); // D6
  }

  function playWrong() {
    var ac = audioContext();
    if (!ac) return;
    var t = ac.currentTime;
    note(ac, 196.00, t, 0.17, 'triangle', 0.16);     // G3
    note(ac, 146.83, t + 0.11, 0.24, 'triangle', 0.15); // D3
  }

  global.QuizSfx = {
    playCorrect: playCorrect,
    playWrong: playWrong,
    isMuted: isMuted,
    setMuted: setMuted
  };
})(window);
