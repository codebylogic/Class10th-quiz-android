/**
 * Smart Quiz Portal — Answer Sound Effects
 *
 * Plays the bundled audio files:
 *   - correct : ./sounds/correct.m4a
 *   - wrong   : ./sounds/wrong.m4a
 *
 * Both are preloaded so the first answer is instant, and a synthesised tone
 * is used as a fallback if the audio file cannot be played for any reason.
 * The user can turn sounds off from Settings (localStorage flag).
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'quiz_sfx_muted';
  var FILES = { correct: './sounds/correct.m4a', wrong: './sounds/wrong.m4a' };
  var players = {};
  var ctx = null;

  function isMuted() {
    try { return global.localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }

  function setMuted(muted) {
    try { global.localStorage.setItem(STORAGE_KEY, muted ? '1' : '0'); } catch (e) {}
  }

  function player(name) {
    if (name in players) return players[name];
    var a = null;
    try {
      a = new global.Audio(FILES[name]);
      a.preload = 'auto';
      a.volume = 0.9;
    } catch (e) {
      a = null;
    }
    players[name] = a;
    return a;
  }

  function play(name) {
    if (isMuted()) return;
    var a = player(name);
    if (a) {
      try {
        a.pause();
        a.currentTime = 0;
        var p = a.play();
        if (p && typeof p.catch === 'function') p.catch(function () { synth(name); });
        return;
      } catch (e) { /* fall through to the synth */ }
    }
    synth(name);
  }

  /* ---------- fallback: synthesised tones (used only if audio fails) ---------- */

  function audioContext() {
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      return ctx;
    } catch (e) { return null; }
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

  function synth(name) {
    var ac = audioContext();
    if (!ac) return;
    var t = ac.currentTime;
    if (name === 'correct') {
      note(ac, 783.99, t, 0.14, 'sine', 0.18);
      note(ac, 1174.66, t + 0.09, 0.22, 'sine', 0.16);
    } else {
      note(ac, 196.00, t, 0.17, 'triangle', 0.16);
      note(ac, 146.83, t + 0.11, 0.24, 'triangle', 0.15);
    }
  }

  function playCorrect() { play('correct'); }
  function playWrong() { play('wrong'); }

  function preload() {
    player('correct');
    player('wrong');
  }

  // Warm the audio cache as soon as the script loads (local files, instant).
  try { preload(); } catch (e) {}

  global.QuizSfx = {
    playCorrect: playCorrect,
    playWrong: playWrong,
    isMuted: isMuted,
    setMuted: setMuted,
    preload: preload
  };
})(window);
