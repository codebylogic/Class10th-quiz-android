/* ============================================================================
   PRO gate + Reels feed
   ----------------------------------------------------------------------------
   Reels are NOT bundled in the app. They are the user's own .mp4 files from
   /storage/emulated/0/SARVER/reel-compressor/data/output/, streamed by the
   Kotlin loopback server (Range-enabled) so HTML5 <video> can seek properly.

   The section only appears once PRO is unlocked — either by payment (placeholder)
   or by redeeming an offer code.
   ========================================================================== */
(function (global) {
  'use strict';

  const PRO_CODE = 'FREEREEL';
  const LS_PRO = 'quiz_pro_unlocked_v1';

  function bridge() {
    return (typeof global.AndroidBridge !== 'undefined' && global.AndroidBridge)
      ? global.AndroidBridge
      : null;
  }

  function isProUnlocked() {
    const b = bridge();
    if (b && typeof b.isProUnlocked === 'function') {
      try { return !!b.isProUnlocked(); } catch (_) {}
    }
    try { return localStorage.getItem(LS_PRO) === '1'; } catch (_) { return false; }
  }

  function unlockPro() {
    const b = bridge();
    if (b && typeof b.setProUnlocked === 'function') {
      try { b.setProUnlocked(true); } catch (_) {}
    }
    try { localStorage.setItem(LS_PRO, '1'); } catch (_) {}
  }

  function readReelsInfo() {
    const b = bridge();
    if (b && typeof b.reelsInfo === 'function') {
      try { return JSON.parse(b.reelsInfo()); } catch (_) {}
    }
    // Browser fallback (so the UI can be previewed without the Android shell)
    return {
      folder: '/storage/emulated/0/SARVER/reel-compressor/data/output',
      allowed: false, exists: false, count: 0, baseUrl: '', files: []
    };
  }

  function toast(msg) {
    if (global.QuizStorage && global.QuizStorage.Bridge) {
      global.QuizStorage.Bridge.toast(msg);
    } else {
      const t = document.getElementById('reels-toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(t._h);
      t._h = setTimeout(() => t.classList.remove('show'), 2600);
    }
  }

  function prettyName(name) {
    return String(name || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  }

  // ==========================================================================
  //  PRO screen
  // ==========================================================================
  function renderProScreen(container) {
    const unlocked = isProUnlocked();
    const info = readReelsInfo();

    container.innerHTML = `
      <div class="pro-hero">
        <div class="pro-crown">👑</div>
        <h1 class="pro-title">PRO</h1>
        <p class="pro-sub">रील्स सेक्शन अनलॉक करें</p>
        ${unlocked ? '<span class="pro-active-pill">✓ PRO सक्रिय है</span>' : ''}
      </div>

      ${unlocked ? `
        <div class="pro-option" id="btn-open-reels">
          <div class="pro-option-left">
            <div class="pro-option-icon">🎬</div>
            <div>
              <div class="pro-option-title">रील्स खोलें</div>
              <div class="pro-option-sub">${info.count || 0} रील मिलीं · ${info.folder}</div>
            </div>
          </div>
          <span class="pro-option-cta">खोलें ›</span>
        </div>
      ` : `
        <div class="pro-option" id="btn-pay">
          <div class="pro-option-left">
            <div class="pro-option-icon">💳</div>
            <div>
              <div class="pro-option-title">भुगतान करें</div>
              <div class="pro-option-sub">₹99 · एक बार का भुगतान</div>
            </div>
          </div>
          <span class="pro-option-cta">भुगतान ›</span>
        </div>

        <div class="pro-redeem">
          <div class="pro-redeem-title">🎁 ऑफ़र कोड से अनलॉक करें</div>
          <div class="pro-redeem-sub">कोड डालें और रील्स अनलॉक करें</div>
          <div class="pro-redeem-row">
            <input id="pro-code" class="pro-code-input" type="text" placeholder="कोड डालें"
                   autocomplete="off" autocapitalize="characters" spellcheck="false">
            <button id="btn-redeem" class="pro-redeem-btn">अनलॉक करें</button>
          </div>
          <div id="pro-msg" class="pro-msg"></div>
        </div>

        <p class="pro-note">
          ऑनलाइन भुगतान अभी ऐप से जुड़ा नहीं है — फ़िलहाल ऑफ़र कोड से अनलॉक करें।
        </p>
      `}
    `;

    const openReels = container.querySelector('#btn-open-reels');
    if (openReels) {
      openReels.addEventListener('click', () => {
        if (global.QuizSfx) global.QuizSfx.playClick();
        window.location.hash = '#/reels';
      });
    }

    const pay = container.querySelector('#btn-pay');
    if (pay) {
      pay.addEventListener('click', () => {
        if (global.QuizSfx) global.QuizSfx.playClick();
        toast('ऑनलाइन भुगतान अभी उपलब्ध नहीं — ऑफ़र कोड डालें');
      });
    }

    const btn = container.querySelector('#btn-redeem');
    const input = container.querySelector('#pro-code');
    const msg = container.querySelector('#pro-msg');

    function submit() {
      const code = String((input && input.value) || '').trim().toUpperCase();
      if (!code) {
        if (msg) { msg.textContent = 'कोड डालें'; msg.className = 'pro-msg error'; }
        return;
      }
      if (code === PRO_CODE) {
        unlockPro();
        if (global.QuizSfx) global.QuizSfx.playClick();
        if (msg) { msg.textContent = '✓ सही कोड — PRO अनलॉक हो गया'; msg.className = 'pro-msg ok'; }
        setTimeout(() => renderProScreen(container), 700);
      } else {
        if (global.QuizSfx) global.QuizSfx.playClick();
        if (msg) { msg.textContent = '✗ कोड सही नहीं है'; msg.className = 'pro-msg error'; }
        if (input) { input.value = ''; input.focus(); }
      }
    }

    if (btn) btn.addEventListener('click', submit);
    if (input) {
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    }
  }

  // ==========================================================================
  //  Reels feed
  // ==========================================================================
  function renderReelsScreen(container) {
    if (!isProUnlocked()) {
      container.innerHTML = `
        <div class="reels-empty">
          <div class="reels-empty-icon">🔒</div>
          <div class="reels-empty-title">रील्स के लिए PRO चाहिए</div>
          <p class="reels-empty-sub">प्रोफ़ाइल में जाकर PRO अनलॉक करें।</p>
          <button class="btn-primary-gradient" id="reels-go-pro">PRO अनलॉक करें</button>
        </div>`;
      const go = container.querySelector('#reels-go-pro');
      if (go) go.addEventListener('click', () => { window.location.hash = '#/pro'; });
      return;
    }

    const info = readReelsInfo();
    const files = Array.isArray(info.files) ? info.files : [];
    const baseUrl = info.baseUrl || '';

    // ---- empty / permission states ----
    if (!info.allowed || !info.exists || !files.length) {
      let icon = '📂';
      let title = 'कोई रील नहीं मिली';
      let sub = `इस फ़ोल्डर में कोई .mp4 फ़ाइल नहीं है:<br><span class="reels-path">${info.folder}</span>`;
      let action = '';
      if (!info.allowed) {
        icon = '🔐';
        title = 'फ़ोल्डर पढ़ने की अनुमति नहीं';
        sub = `रील्स पढ़ने के लिए "सभी फ़ाइलों तक पहुँच" की अनुमति दें, फिर यहाँ लौटें.<br><span class="reels-path">${info.folder}</span>`;
        action = '<button class="btn-primary-gradient" id="reels-grant">अनुमति दें</button>';
      } else if (!info.exists) {
        icon = '📁';
        title = 'फ़ोल्डर नहीं मिला';
        sub = `यह फ़ोल्डर मौजूद नहीं है:<br><span class="reels-path">${info.folder}</span>`;
        action = '<button class="btn-secondary-full" id="reels-reload">फिर जाँचें</button>';
      } else {
        action = '<button class="btn-secondary-full" id="reels-reload">फिर जाँचें</button>';
      }

      container.innerHTML = `
        <div class="reels-empty">
          <div class="reels-empty-icon">${icon}</div>
          <div class="reels-empty-title">${title}</div>
          <p class="reels-empty-sub">${sub}</p>
          ${action}
        </div>`;

      const grant = container.querySelector('#reels-grant');
      if (grant) {
        grant.addEventListener('click', () => {
          const b = bridge();
          if (b && typeof b.requestReelsAccess === 'function') {
            try { b.requestReelsAccess(); } catch (_) {}
          } else {
            toast('यह सुविधा सिर्फ़ ऐप में उपलब्ध है');
          }
        });
      }
      const reload = container.querySelector('#reels-reload');
      if (reload) {
        reload.addEventListener('click', () => {
          if (global.QuizSfx) global.QuizSfx.playClick();
          renderReelsScreen(container);
        });
      }
      return;
    }

    // ---- the feed ----
    const slides = files.map((f, i) => `
      <div class="reel-slide" data-index="${i}">
        <video class="reel-video" data-name="${f.name}"
               src="${baseUrl}/v/${encodeURIComponent(f.name)}"
               playsinline webkit-playsinline loop preload="metadata" muted></video>
        <div class="reel-tap-hint" hidden>▶</div>
        <div class="reel-error" hidden>
          <div>वीडियो नहीं चला</div>
          <button class="reel-error-btn" data-external="${f.name}">ऐप के प्लेयर में खोलें</button>
        </div>
        <div class="reel-overlay">
          <div class="reel-caption">
            <span class="reel-index">${i + 1}/${files.length}</span>
            <span class="reel-name">${prettyName(f.name)}</span>
          </div>
          <div class="reel-actions">
            <button class="reel-action" data-mute="${i}" aria-label="आवाज़ बदलें">🔇</button>
            <button class="reel-action" data-external="${f.name}" aria-label="प्लेयर में खोलें">⤴</button>
          </div>
          <div class="reel-progress"><div class="reel-progress-fill" data-fill="${i}"></div></div>
        </div>
      </div>`).join('');

    container.innerHTML = `
      <div class="reels-head">
        <button class="reels-back" id="reels-back" aria-label="वापस">←</button>
        <div class="reels-head-title">🎬 रील्स</div>
        <div class="reels-head-count">${files.length}</div>
      </div>
      <div class="reels-feed" id="reels-feed">${slides}</div>
    `;

    const feed = container.querySelector('#reels-feed');
    const videos = Array.from(container.querySelectorAll('.reel-video'));
    let muted = true;

    container.querySelector('#reels-back').addEventListener('click', () => {
      if (global.QuizSfx) global.QuizSfx.playClick();
      window.location.hash = '#/settings';
    });

    // open in the phone's video player (fallback / explicit action)
    container.querySelectorAll('[data-external]').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const name = el.getAttribute('data-external');
        const b = bridge();
        if (b && typeof b.openVideoExternally === 'function') {
          try { b.openVideoExternally(name); return; } catch (_) {}
        }
        toast('यह सुविधा सिर्फ़ ऐप में उपलब्ध है');
      });
    });

    // mute toggle
    container.querySelectorAll('[data-mute]').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        muted = !muted;
        videos.forEach((v) => { v.muted = muted; });
        container.querySelectorAll('[data-mute]').forEach((b) => { b.textContent = muted ? '🔇' : '🔊'; });
        if (global.QuizSfx) global.QuizSfx.playClick();
      });
    });

    // tap to play / pause
    videos.forEach((v) => {
      v.addEventListener('click', () => {
        if (v.paused) { v.play().catch(() => {}); } else { v.pause(); }
      });
      v.addEventListener('error', () => {
        const slide = v.closest('.reel-slide');
        if (slide) {
          const err = slide.querySelector('.reel-error');
          if (err) err.hidden = false;
        }
      });
      v.addEventListener('timeupdate', () => {
        const idx = v.closest('.reel-slide').getAttribute('data-index');
        const fill = container.querySelector(`[data-fill="${idx}"]`);
        if (fill && v.duration) {
          fill.style.width = Math.min(100, (v.currentTime / v.duration) * 100) + '%';
        }
      });
    });

    // autoplay only the reel in view
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const v = entry.target.querySelector('video');
          if (!v) return;
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            v.muted = muted;
            const p = v.play();
            if (p && p.catch) p.catch(() => {});
          } else {
            v.pause();
          }
        });
      }, { root: feed, threshold: [0, 0.6, 1] });
      container.querySelectorAll('.reel-slide').forEach((s) => io.observe(s));
    }
  }

  global.QuizReels = {
    renderProScreen,
    renderReelsScreen,
    isProUnlocked,
    unlockPro,
    PRO_CODE
  };
})(window);
