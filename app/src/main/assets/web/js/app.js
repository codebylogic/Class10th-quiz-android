/**
 * Smart Quiz Portal — Main SPA Router & View Controller (PRD Section 6.5 & 9)
 *
 * Implements all routes & screens matching the 4 reference screenshots:
 * - `#/home`            -> Dashboard (Streak card, weekly bars, quick chips, subject grid, scholarship quiz)
 * - `#/subject/:id`     -> Subject & Section Chooser + Chapter list with status badges
 * - `#/section/:id`     -> Direct section deep-link
 * - `#/quiz/:chapterId` -> Quiz Intro Sheet + Active Question Engine + Segmented Bar + Navigator Sheet
 * - `#/result/:attemptId` -> Circular percentage ring, 4-column stats, accuracy/time metrics, review & retry
 * - `#/weak-topics`     -> Weak-topic tracking & targeted revision quiz (FR-10)
 * - `#/bookmarks`       -> Bookmarked questions revision vault (FR-13)
 * - `#/stats`           -> Overall progress & attempt history leaderboard/analysis
 * - `#/settings`        -> Profile & Settings (FR-14, FR-18)
 */
(function (global) {
  'use strict';

  const state = {
    catalog: null,
    selectedCourseId: 'bseb10',
    activeSubjectId: null,
    activeSectionId: null,
    activeQuizSession: null,
    quizTimerInterval: null
  };

  // DOM References
  const routeContainer = document.getElementById('route-container');
  const btnTopBack = document.getElementById('btn-top-back');
  const topBarTitle = document.getElementById('top-bar-title');
  const topBarSubtitle = document.getElementById('top-bar-subtitle');
  const currentCourseLabel = document.getElementById('current-course-label');
  const btnCourseSelector = document.getElementById('btn-course-selector');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const btnProfileNav = document.getElementById('btn-profile-nav');
  const bottomNav = document.getElementById('bottom-nav');

  // Modals
  const courseModalBackdrop = document.getElementById('course-modal-backdrop');
  const courseListContainer = document.getElementById('course-list-container');
  const btnCloseCourseModal = document.getElementById('btn-close-course-modal');
  const quizIntroBackdrop = document.getElementById('quiz-intro-backdrop');
  const quizIntroContent = document.getElementById('quiz-intro-content');
  const navigatorBackdrop = document.getElementById('navigator-backdrop');
  const navigatorGrid = document.getElementById('navigator-grid');
  const navigatorSummaryText = document.getElementById('navigator-summary-text');
  const btnCloseNavigator = document.getElementById('btn-close-navigator');
  const btnSubmitFromSheet = document.getElementById('btn-submit-from-sheet');

  function formatHindiDate() {
    const daysHi = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
    const monthsHi = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
    const now = new Date();
    return `${daysHi[now.getDay()]}, ${now.getDate()} ${monthsHi[now.getMonth()]} ${now.getFullYear()}`;
  }

  function formatDurationMMSS(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function formatDurationHuman(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  }

  function stopQuizTimer() {
    if (state.quizTimerInterval) {
      clearInterval(state.quizTimerInterval);
      state.quizTimerInterval = null;
    }
  }

  function updateHeaderUI(mode, titleText, subtitleText) {
    const course = global.QuizCatalog.getCourseById(state.selectedCourseId);
    if (course) {
      currentCourseLabel.textContent = course.shortLabel || course.id.toUpperCase();
    }
    if (mode === 'home') {
      btnTopBack.classList.add('hidden');
      topBarTitle.textContent = 'Smart Quiz...';
      topBarSubtitle.textContent = 'डिजिटल लर्निंग प्लेटफॉर्म';
      bottomNav.classList.remove('hidden');
    } else if (mode === 'quiz') {
      btnTopBack.classList.remove('hidden');
      topBarTitle.textContent = 'Live Exam Ro...';
      topBarSubtitle.textContent = subtitleText || 'ऑफ़लाइन अभ्यास कक्ष';
      bottomNav.classList.add('hidden');
    } else if (mode === 'result') {
      btnTopBack.classList.remove('hidden');
      topBarTitle.textContent = 'Exam Analysis';
      topBarSubtitle.textContent = 'रिजल्ट एवं विश्लेषण';
      bottomNav.classList.add('hidden');
    } else {
      btnTopBack.classList.remove('hidden');
      topBarTitle.textContent = titleText || 'Live Exam Ro...';
      topBarSubtitle.textContent = subtitleText || 'अध्यायवार अभ्यास';
      bottomNav.classList.remove('hidden');
    }
  }

  function updateBottomNavActive(hash) {
    document.querySelectorAll('#bottom-nav .nav-item').forEach((btn) => {
      const target = btn.getAttribute('data-route');
      if (hash.startsWith(target)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // ==========================================================================
  // Course / Track Selector Modal (FR-01: 7 Tracks)
  // ==========================================================================
  function openCourseSelectorModal() {
    const courses = global.QuizCatalog.getCourses();
    courseListContainer.innerHTML = courses.map((c) => {
      const isActive = c.id === state.selectedCourseId;
      const totalSubj = (c.subjects || []).length;
      return `
        <button class="course-option-btn ${isActive ? 'active' : ''}" data-course-id="${c.id}">
          <div>
            <div style="font-size:0.95rem;font-weight:700;">${c.title}</div>
            <div style="font-size:0.74rem;color:var(--text-secondary);">${c.subtitle || ''} • ${totalSubj} विषय</div>
          </div>
          <span style="font-size:0.78rem;font-weight:700;color:${isActive ? 'var(--accent-lavender)' : 'var(--text-muted)'};">
            ${isActive ? '✓ सक्रिय' : 'चुनें →'}
          </span>
        </button>
      `;
    }).join('');

    courseListContainer.querySelectorAll('.course-option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const newId = btn.getAttribute('data-course-id');
        state.selectedCourseId = newId;
        global.QuizStorage.setSelectedCourse(newId);
        courseModalBackdrop.classList.add('hidden');
        global.QuizSfx.playClick();
        if (window.location.hash === '#/home' || !window.location.hash) {
          renderHomeDashboard();
        } else {
          window.location.hash = '#/home';
        }
      });
    });

    courseModalBackdrop.classList.remove('hidden');
  }

  // ==========================================================================
  // Screen 1: Dashboard (#/home) — Matches unnamed.png
  // ==========================================================================
  function renderHomeDashboard() {
    stopQuizTimer();
    const course = global.QuizCatalog.getCourseById(state.selectedCourseId);
    updateHeaderUI('home');
    updateBottomNavActive('#/home');

    const streakData = global.QuizStorage.getStreakAndWeeklyBars();
    const allProg = global.QuizStorage.getAllChapterProgress();
    const subjects = course ? (course.subjects || []) : [];

    // Compute real syllabus completion % across current course (FR-11)
    let totalCourseChapters = 0;
    let completedCourseChapters = 0;
    let firstChapterId = null;

    subjects.forEach((subj) => {
      const { allChapters } = global.QuizCatalog.countSubjectChaptersAndQuestions(subj);
      allChapters.forEach((ch) => {
        if (!firstChapterId) firstChapterId = ch.id;
        totalCourseChapters++;
        if (allProg[ch.id] && allProg[ch.id].status === 'completed') {
          completedCourseChapters++;
        }
      });
    });

    const syllabusPct = totalCourseChapters > 0
      ? Math.round((completedCourseChapters / totalCourseChapters) * 100)
      : 0;

    const latestIncomplete = global.QuizStorage.getLatestIncompleteQuiz();
    const resumeTargetId = (latestIncomplete && latestIncomplete.chapterId) || firstChapterId;

    const barsHtml = streakData.bars.map((b) => {
      const barClass = b.isToday ? 'day-bar active' : (b.count > 0 ? 'day-bar semi' : 'day-bar');
      return `
        <div class="day-col">
          <div class="${barClass}" style="height:${b.heightPct}%;"></div>
          <span class="day-label ${b.isToday ? 'today' : ''}">${b.label}</span>
        </div>
      `;
    }).join('');

    const subjectCardsHtml = subjects.map((subj) => {
      const { chapterCount } = global.QuizCatalog.countSubjectChaptersAndQuestions(subj);
      const accentBg = subj.accentBg || 'rgba(6, 182, 212, 0.16)';
      const accentBorder = subj.accentBorder || 'rgba(6, 182, 212, 0.35)';
      return `
        <div class="subject-card" data-subject-id="${subj.id}">
          <div>
            <div class="subject-card-top">
              <div class="subject-icon-box" style="background:${accentBg};border:1px solid ${accentBorder};">
                ${subj.icon || '📘'}
              </div>
              <span class="subject-tag">${subj.badge || 'NCERT'}</span>
            </div>
            <div class="subject-title-hi">${subj.titleHi || subj.name}</div>
            <div class="subject-title-en">${subj.titleEn || ''}</div>
            <div class="subject-desc">${subj.description || ''}</div>
          </div>
          <div class="subject-card-footer">
            <span>📖 ${chapterCount} अध्याय</span>
            <span>›</span>
          </div>
        </div>
      `;
    }).join('');

    const updateInfo = global.QuizUpdater ? global.QuizUpdater.getCached() : null;
    const updateBannerHtml = (updateInfo && updateInfo.available) ? `
      <div class="streak-card" onclick="window.location.hash='#/settings'" style="border:1px solid rgba(16,185,129,0.38);background:rgba(16,185,129,0.10);margin-bottom:12px;cursor:pointer;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:1.7rem;">⬆️</div>
          <div style="flex:1;">
            <div style="font-size:0.96rem;font-weight:700;">नया अपडेट उपलब्ध — ${updateInfo.latest}</div>
            <div style="font-size:0.74rem;color:var(--text-secondary);">आपके पास ${updateInfo.current} है। डाउनलोड करने के लिए यहाँ टैप करें।</div>
          </div>
        </div>
      </div>
    ` : '';

    routeContainer.innerHTML = `
      <!-- Greeting Row -->
      <div class="greeting-row">
        <div>
          <h1 class="greeting-title">नमस्ते, छात्र 👋</h1>
          <p class="greeting-date">${formatHindiDate()}</p>
        </div>
        <span class="board-badge">
          <span class="board-badge-dot"></span>
          ${course ? (course.badge || 'BOARD 2026') : 'BOARD 2026'}
        </span>
      </div>

      ${updateBannerHtml}

      <!-- Streak & Weekly Activity Card (FR-11) -->
      <div class="streak-card">
        <div class="streak-top">
          <div class="streak-left">
            <div class="streak-Count-row">
              <div class="flame-circle">🔥</div>
              <div>
                <div class="streak-number">${streakData.streak} दिन</div>
                <div class="streak-batch-tag">TOP 5% BATCH</div>
              </div>
            </div>
            <div class="streak-caption">लर्निंग स्ट्रीक जारी है! Keep it up!</div>
          </div>
          <div class="weekly-bars-box" aria-label="साप्ताहिक गतिविधि">
            ${barsHtml}
          </div>
        </div>

        <div class="syllabus-progress-block">
          <div class="syllabus-label-row">
            <span>पाठ्यक्रम प्रगति (Syllabus)</span>
            <span class="syllabus-pct">${syllabusPct}% (${completedCourseChapters}/${totalCourseChapters})</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${Math.max(4, syllabusPct)}%;"></div>
          </div>
        </div>
      </div>

      <!-- Quick Action Chips (FR-10, FR-12, FR-13) -->
      <div class="quick-chips-row">
        <button id="chip-resume-quiz" class="action-chip primary">
          <span>▶️</span>
          <span>${latestIncomplete ? 'क्विज़ जारी रखें' : 'अभ्यास शुरू करें'}</span>
        </button>
        <button id="chip-revision-test" class="action-chip">
          <span>📝</span>
          <span>रिवीजन टेस्ट</span>
        </button>
        <button id="chip-weak-topics" class="action-chip">
          <span>⚠️</span>
          <span>कमज़ोर टॉपिक</span>
        </button>
      </div>

      <!-- Subject Grid Header -->
      <div class="section-header-row">
        <div>
          <h2 class="section-heading">स्मार्ट अभ्यास, उत्कृष्ट परिणाम</h2>
          <p class="section-subheading">विषयों की अध्यायवार तैयारी एवं रियल-टाइम क्विज़ प्रैक्टिस।</p>
        </div>
        <button id="btn-view-all-subjects" class="link-btn">सभी देखें →</button>
      </div>

      <!-- 2-Column Subject Grid (FR-02) -->
      <div class="subject-grid">
        ${subjectCardsHtml}
      </div>

      <!-- Daily Scholarship / Mega Practice Banner -->
      <div class="scholarship-banner">
        <div class="scholarship-left">
          <div class="scholarship-icon">🎖️</div>
          <div>
            <div class="scholarship-title">दैनिक स्कॉलरशिप क्विज़ <span style="color:var(--accent-rose);">●</span></div>
            <div class="scholarship-sub">संपूर्ण सिलेबस महा-अभ्यास सेट • 100% ऑफ़लाइन</div>
          </div>
        </div>
        <button id="btn-start-scholarship" class="btn-pill-light">भाग लें</button>
      </div>
    `;

    // Bind subject cards
    routeContainer.querySelectorAll('.subject-card').forEach((card) => {
      card.addEventListener('click', () => {
        const subjId = card.getAttribute('data-subject-id');
        global.QuizSfx.playClick();
        window.location.hash = `#/subject/${subjId}`;
      });
    });

    const chipResume = document.getElementById('chip-resume-quiz');
    if (chipResume && resumeTargetId) {
      chipResume.addEventListener('click', () => {
        window.location.hash = `#/quiz/${resumeTargetId}`;
      });
    }

    const chipRevision = document.getElementById('chip-revision-test');
    if (chipRevision) {
      chipRevision.addEventListener('click', () => {
        window.location.hash = '#/bookmarks';
      });
    }

    const chipWeak = document.getElementById('chip-weak-topics');
    if (chipWeak) {
      chipWeak.addEventListener('click', () => {
        window.location.hash = '#/weak-topics';
      });
    }

    const btnScholarship = document.getElementById('btn-start-scholarship');
    if (btnScholarship && firstChapterId) {
      btnScholarship.addEventListener('click', () => {
        window.location.hash = `#/quiz/${firstChapterId}`;
      });
    }

    const btnViewAll = document.getElementById('btn-view-all-subjects');
    if (btnViewAll && subjects[0]) {
      btnViewAll.addEventListener('click', () => {
        window.location.hash = `#/subject/${subjects[0].id}`;
      });
    }
  }

  // ==========================================================================
  // Screen 2: Subject / Section & Chapter List (#/subject/:id) — unnamed (1).png
  // ==========================================================================
  function renderSubjectScreen(subjectId, explicitSectionId) {
    stopQuizTimer();
    const course = global.QuizCatalog.getCourseById(state.selectedCourseId);
    const subject = global.QuizCatalog.findSubject(state.selectedCourseId, subjectId);
    if (!subject) {
      window.location.hash = '#/home';
      return;
    }

    state.activeSubjectId = subject.id;
    updateHeaderUI('subject', 'Live Exam Ro...', subject.titleHi || subject.name);
    updateBottomNavActive('#/home');

    const hasSections = Array.isArray(subject.sections) && subject.sections.length > 0;
    let activeSection = null;
    if (hasSections) {
      activeSection = subject.sections.find((s) => s.id === explicitSectionId) || subject.sections[0];
      state.activeSectionId = activeSection.id;
    } else {
      state.activeSectionId = null;
    }

    const chaptersToShow = hasSections ? (activeSection.chapters || []) : (subject.chapters || []);
    const allProg = global.QuizStorage.getAllChapterProgress();

    // Calculate total questions & answered questions across this view
    let totalQuestionsInView = 0;
    let completedQuestionsInView = 0;
    chaptersToShow.forEach((ch) => {
      const qCount = ch.questions || 20;
      totalQuestionsInView += qCount;
      const p = allProg[ch.id];
      if (p) {
        if (p.status === 'completed') {
          completedQuestionsInView += qCount;
        } else if (p.status === 'in_progress') {
          completedQuestionsInView += Math.min(qCount, p.answeredSoFar || 0);
        }
      }
    });

    const readyPct = totalQuestionsInView > 0
      ? Math.round((completedQuestionsInView / totalQuestionsInView) * 100)
      : 0;

    const sectionTabsHtml = hasSections
      ? `
        <div class="section-tabs" role="tablist">
          ${subject.sections.map((sec) => `
            <button class="section-tab-btn ${sec.id === activeSection.id ? 'active' : ''}" data-sec-id="${sec.id}" role="tab">
              <span class="section-tab-hi">${sec.titleHi || sec.name}</span>
              <span class="section-tab-en">${sec.titleEn || ''}</span>
            </button>
          `).join('')}
        </div>
      `
      : '';

    const partSizeSetting = global.QuizStorage.getQuestionsPerPart();

    const chaptersHtml = chaptersToShow.map((ch, idx) => {
      const numStr = String(idx + 1).padStart(2, '0');
      const p = global.QuizStorage.getChapterProgress(ch.id);
      let statusBadgeHtml = '';
      let numBoxClass = 'chapter-num-box';
      let playBtnClass = 'chapter-play-btn';
      let playIcon = '▶';

      if (p.status === 'completed') {
        numBoxClass += ' completed';
        playBtnClass += ' replay';
        playIcon = '↻';
        statusBadgeHtml = `
          <span class="status-pill completed">✓ पूरा — ${p.bestScorePct}% स्कोर (अंतिम: ${p.lastScorePct}%)</span>
          <span class="chapter-mcq-count">${ch.questions || 20} MCQs</span>
        `;
      } else if (p.status === 'in_progress') {
        numBoxClass += ' in-progress';
        playBtnClass += ' active';
        statusBadgeHtml = `
          <span class="status-pill in-progress">● जारी है — ${p.answeredSoFar || 1}/${ch.questions || 20} प्रश्न</span>
        `;
      } else {
        statusBadgeHtml = `
          <span class="status-pill not-started">अभी शुरू नहीं किया (${ch.questions || 20} MCQs)</span>
        `;
      }

      let partsBadgeHtml = '';
      const chParts = global.QuizEngine.computeParts(ch.questions || 20, partSizeSetting);
      if (chParts.length > 1) {
        const doneParts = global.QuizStorage.getCompletedPartsCount(ch.id);
        partsBadgeHtml = `<span class="status-pill ${doneParts >= chParts.length ? 'completed' : 'in-progress'}">📚 ${doneParts}/${chParts.length} भाग पूर्ण</span>`;
      }

      return `
        <div class="chapter-card" data-chapter-id="${ch.id}">
          <div class="chapter-card-left">
            <div class="${numBoxClass}">${numStr}</div>
            <div class="chapter-info">
              <div class="chapter-title-hi">${ch.titleHi || ch.name}</div>
              <div class="chapter-title-en">${ch.titleEn || ch.subtitle || ''}</div>
              <div class="chapter-meta-row">
                ${statusBadgeHtml}
                ${partsBadgeHtml}
              </div>
            </div>
          </div>
          <button class="${playBtnClass}" aria-label="क्विज़ खोलें">${playIcon}</button>
        </div>
      `;
    }).join('');

    const sectionTitleSuffix = activeSection ? ` — ${activeSection.titleHi || activeSection.name} (${activeSection.titleEn || ''})` : '';
    const megaChapter = chaptersToShow[chaptersToShow.length - 1] || chaptersToShow[0];

    routeContainer.innerHTML = `
      <div class="subject-hero-header">
        <div>
          <h1 class="subject-hero-title">${subject.titleHi || subject.name}${sectionTitleSuffix}</h1>
          <p class="subject-hero-sub">${course ? course.title : ''}</p>
        </div>
        <span class="chapter-count-pill">● कुल ${chaptersToShow.length} अध्याय</span>
      </div>

      <!-- Chapter Progress Overview Card -->
      <div class="overview-progress-card">
        <div class="overview-left">
          <div class="overview-icon">📊</div>
          <div>
            <div class="overview-label">अध्याय प्रगति अवलोकन</div>
            <div class="overview-stat">${completedQuestionsInView} <small style="font-weight:400;color:var(--text-secondary);">/ ${totalQuestionsInView} प्रश्न पूर्ण</small></div>
          </div>
        </div>
        <div class="overview-right">
          <div class="overview-pct-text">${readyPct}% तैयार</div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${Math.max(5, readyPct)}%;background:linear-gradient(90deg,#22D3EE,#8B5CF6);"></div>
          </div>
        </div>
      </div>

      ${sectionTabsHtml}

      <div class="syllabus-bar-label">
        <span>अध्याय सूची • SYLLABUS</span>
        <span>☰ मानक क्रम</span>
      </div>

      <div class="chapter-list">
        ${chaptersHtml}
      </div>

      ${megaChapter ? `
        <div class="scholarship-banner" style="margin-top:6px;">
          <div class="scholarship-left">
            <div class="scholarship-icon">🧠</div>
            <div>
              <div class="scholarship-title">संपूर्ण ${activeSection ? (activeSection.titleHi || activeSection.name) : (subject.titleHi || subject.name)} मेगा मॉक टेस्ट</div>
              <div class="scholarship-sub">सभी ${chaptersToShow.length} अध्यायों का संयुक्त प्रश्नों का सेट</div>
            </div>
          </div>
          <button id="btn-mega-mock" class="btn-pill-light" data-mega-id="${megaChapter.id}">आरंभ करें ⚡</button>
        </div>
      ` : ''}
    `;

    // Section tab switching
    routeContainer.querySelectorAll('.section-tab-btn').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const secId = tabBtn.getAttribute('data-sec-id');
        global.QuizSfx.playClick();
        renderSubjectScreen(subject.id, secId);
      });
    });

    // Chapter click -> open Quiz Intro Modal (FR-04)
    routeContainer.querySelectorAll('.chapter-card').forEach((card) => {
      card.addEventListener('click', () => {
        const chId = card.getAttribute('data-chapter-id');
        global.QuizSfx.playClick();
        openChapterOrParts(chId);
      });
    });

    const megaBtn = document.getElementById('btn-mega-mock');
    if (megaBtn) {
      megaBtn.addEventListener('click', () => {
        const megaId = megaBtn.getAttribute('data-mega-id');
        openChapterOrParts(megaId);
      });
    }
  }

  // ==========================================================================
  // Quiz Intro & Language Preference Bottom Sheet (FR-04)
  // ==========================================================================
  async function openQuizIntroSheet(chapterId, partIndex) {
    try {
      const chapterData = await global.QuizCatalog.loadChapterData(chapterId);
      const allParts = global.QuizEngine.computeParts(chapterData.questions.length, global.QuizStorage.getQuestionsPerPart());
      const part = allParts.find((x) => x.index === (parseInt(partIndex, 10) || 0)) || allParts[0];
      const qCount = part.count;
      const infoStrip = global.QuizEngine.computeQuizInfoStrip(qCount);
      const isBilingual = global.QuizCatalog.isBilingualChapter(chapterData.questions);
      const currentPref = global.QuizStorage.getQuizLanguagePref();
      const sessionKey = global.QuizStorage.partSessionKey(chapterId, part.index);
      const incomplete = global.QuizStorage.getIncompleteQuiz(sessionKey);
      const chProg = global.QuizStorage.getChapterProgress(chapterId);
      const partHash = part.index
        ? `#/quiz/${encodeURIComponent(chapterId)}/${part.index}`
        : `#/quiz/${encodeURIComponent(chapterId)}`;
      const partBadgeHtml = part.index
        ? `<span class="status-pill in-progress" style="margin-top:8px;">🧩 भाग ${part.index} / ${part.total} • प्रश्न ${part.start + 1}–${part.end}</span>`
        : '';

      quizIntroContent.innerHTML = `
        <div class="sheet-header">
          <div>
            <span class="board-badge" style="margin-bottom:6px;">${chapterData.title}</span>
            <h3 class="sheet-title" style="font-size:1.15rem;">${chapterData.subtitle}</h3>
            <p class="sheet-subtitle" style="margin-top:4px;">${chapterData.description}</p>
            ${partBadgeHtml}
          </div>
          <button id="btn-close-quiz-intro" class="icon-btn">✕</button>
        </div>

        <!-- Info Strip (Questions, Estimated Minutes, Marks — FR-04 & Appendix C.6) -->
        <div class="stats-four-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px;">
          <div class="stat-mini-box total">
            <div class="stat-mini-label">कुल प्रश्न</div>
            <div class="stat-mini-num">${infoStrip.questions}</div>
            <div class="stat-mini-sub">MCQs</div>
          </div>
          <div class="stat-mini-box correct">
            <div class="stat-mini-label">अनुमानित समय</div>
            <div class="stat-mini-num">${infoStrip.estimatedMinutes}m</div>
            <div class="stat-mini-sub">मिनट</div>
          </div>
          <div class="stat-mini-box skipped">
            <div class="stat-mini-label">कुल अंक</div>
            <div class="stat-mini-num">${infoStrip.marks}</div>
            <div class="stat-mini-sub">Marks</div>
          </div>
        </div>

        ${chProg.attemptsCount > 0 ? `
          <div style="font-size:0.76rem;color:var(--accent-emerald-bright);margin-bottom:12px;padding:8px 12px;border-radius:10px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.28);">
            🏆 सर्वश्रेष्ठ स्कोर: <strong>${chProg.bestScorePct}%</strong> • अंतिम प्रयास: <strong>${chProg.lastScorePct}%</strong> (${chProg.attemptsCount} बार हल किया)
          </div>
        ` : ''}

        ${isBilingual ? `
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-secondary);">
            भाषा प्राथमिकता चुनें (Language Preference — FR-04):
          </div>
          <div class="lang-pills-grid" id="intro-lang-pills">
            <button class="lang-pill-btn ${currentPref === 'hi-pri' ? 'active' : ''}" data-pref="hi-pri">हिंदी + English</button>
            <button class="lang-pill-btn ${currentPref === 'en-pri' ? 'active' : ''}" data-pref="en-pri">English + हिंदी</button>
            <button class="lang-pill-btn ${currentPref === 'only-hi' ? 'active' : ''}" data-pref="only-hi">केवल हिंदी</button>
            <button class="lang-pill-btn ${currentPref === 'only-en' ? 'active' : ''}" data-pref="only-en">English Only</button>
          </div>
        ` : `
          <div style="font-size:0.76rem;color:var(--text-secondary);margin-bottom:14px;">
            🌐 प्रोफ़ाइल भाषा: <strong>${global.QuizStorage.getProfileLanguage() === 'en' ? 'English' : 'हिंदी (Hindi)'}</strong>
          </div>
        `}

        <div style="display:flex;flex-direction:column;gap:8px;">
          ${incomplete ? `
            <button id="btn-resume-existing-quiz" class="btn-emerald-full" style="margin-bottom:0;">
              ▶️ अधूरा क्विज़ वहीं से जारी रखें (प्रश्न ${(incomplete.currentIndex || 0) + 1}/${qCount})
            </button>
          ` : ''}
          <button id="btn-start-fresh-quiz" class="btn-primary-gradient full-width">
            🚀 ${incomplete ? 'नए सिरे से क्विज़ शुरू करें (Start New)' : 'क्विज़ शुरू करें (Start Quiz) →'}
          </button>
        </div>
      `;

      quizIntroContent.querySelectorAll('#intro-lang-pills .lang-pill-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          quizIntroContent.querySelectorAll('#intro-lang-pills .lang-pill-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          global.QuizStorage.setQuizLanguagePref(btn.getAttribute('data-pref'));
        });
      });

      const closeBtn = document.getElementById('btn-close-quiz-intro');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => quizIntroBackdrop.classList.add('hidden'));
      }

      const startFreshBtn = document.getElementById('btn-start-fresh-quiz');
      if (startFreshBtn) {
        startFreshBtn.addEventListener('click', () => {
          quizIntroBackdrop.classList.add('hidden');
          global.QuizStorage.clearIncompleteQuiz(sessionKey);
          window.location.hash = partHash;
        });
      }

      const resumeBtn = document.getElementById('btn-resume-existing-quiz');
      if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
          quizIntroBackdrop.classList.add('hidden');
          window.location.hash = partHash;
        });
      }

      quizIntroBackdrop.classList.remove('hidden');
    } catch (err) {
      global.QuizStorage.Bridge.toast(err.message || 'अध्याय लोड नहीं हो सका');
    }
  }

  // ==========================================================================
  // Chapter -> Parts chooser (only when a "questions per test" size is set)
  // ==========================================================================
  function openChapterOrParts(chapterId) {
    const meta = global.QuizCatalog.findChapterMeta(chapterId);
    const total = (meta && meta.chapter && meta.chapter.questions) || 0;
    const parts = global.QuizEngine.computeParts(total, global.QuizStorage.getQuestionsPerPart());
    if (parts.length > 1) {
      window.location.hash = `#/parts/${encodeURIComponent(chapterId)}`;
    } else {
      openQuizIntroSheet(chapterId, 0);
    }
  }

  async function renderPartsScreen(chapterId) {
    updateHeaderUI('sub', 'अध्याय भाग', 'भागवार अभ्यास');
    updateBottomNavActive('');
    try {
      const chapterData = await global.QuizCatalog.loadChapterData(chapterId);
      const total = chapterData.questions.length;
      const partSize = global.QuizStorage.getQuestionsPerPart();
      const parts = global.QuizEngine.computeParts(total, partSize);
      const bestScores = global.QuizStorage.getBestPartScores(chapterId);

      const rows = parts.map((part) => {
        const best = bestScores[part.index];
        const done = typeof best === 'number';
        const statusHtml = done
          ? `<span class="status-pill completed">✓ पूरा — ${best}% स्कोर</span><span class="chapter-mcq-count">${part.count} MCQs</span>`
          : `<span class="status-pill not-started">अभी शुरू नहीं किया (${part.count} MCQs)</span>`;
        return `
          <div class="chapter-card" data-part-index="${part.index}">
            <div class="chapter-card-left">
              <div class="chapter-num-box${done ? ' completed' : ''}">${String(part.index).padStart(2, '0')}</div>
              <div class="chapter-info">
                <div class="chapter-title-hi">भाग ${part.index}</div>
                <div class="chapter-title-en">प्रश्न ${part.start + 1}–${part.end}</div>
                <div class="chapter-meta-row">${statusHtml}</div>
              </div>
            </div>
            <button class="chapter-play-btn${done ? ' replay' : ''}" aria-label="भाग खोलें">${done ? '↻' : '▶'}</button>
          </div>
        `;
      }).join('');

      routeContainer.innerHTML = `
        <div class="subject-hero-header">
          <div>
            <h1 class="subject-hero-title">${chapterData.subtitle || chapterData.title}</h1>
            <p class="subject-hero-sub">${chapterData.title} • कुल ${total} प्रश्न</p>
          </div>
          <span class="chapter-count-pill">● ${parts.length} भाग</span>
        </div>
        <div class="syllabus-bar-label">
          <span>भाग सूची • PARTS</span>
          <span>${partSize} प्रश्न / भाग</span>
        </div>
        <div class="chapter-list">
          ${rows}
        </div>
      `;

      routeContainer.querySelectorAll('.chapter-card').forEach((card) => {
        card.addEventListener('click', () => {
          global.QuizSfx.playClick();
          openQuizIntroSheet(chapterId, Number(card.getAttribute('data-part-index')) || 0);
        });
      });
    } catch (err) {
      routeContainer.innerHTML = `
        <div class="streak-card" style="text-align:center;padding:28px 18px;margin-top:24px;">
          <div style="font-size:2.4rem;margin-bottom:10px;">⚠️</div>
          <h2 style="font-size:1.15rem;margin-bottom:6px;">अध्याय लोड करने में समस्या आई</h2>
          <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:18px;">${err.message || 'फ़ाइल उपलब्ध नहीं है।'}</p>
          <button class="btn-primary-gradient" onclick="window.location.hash='#/home'">← होम स्क्रीन पर वापस जाएँ</button>
        </div>
      `;
    }
  }

  // ==========================================================================
  // Screen 3: Active Quiz Engine (#/quiz/:chapterId) — Matches unnamed (2).png
  // ==========================================================================
  async function startOrResumeQuizScreen(chapterId, partIndex, customSessionData) {
    stopQuizTimer();
    updateHeaderUI('quiz', 'Live Exam Ro...');

    try {
      let session = null;
      const pIdx = parseInt(partIndex, 10) || 0;
      const sessionKey = global.QuizStorage.partSessionKey(chapterId, pIdx);

      if (customSessionData) {
        session = customSessionData;
      } else {
        const savedSession = global.QuizStorage.getIncompleteQuiz(sessionKey);
        const chapterData = await global.QuizCatalog.loadChapterData(chapterId);

        if (savedSession && Array.isArray(savedSession.questions) && savedSession.questions.length > 0) {
          session = savedSession;
        } else {
          const allParts = global.QuizEngine.computeParts(chapterData.questions.length, global.QuizStorage.getQuestionsPerPart());
          const part = allParts.find((x) => x.index === pIdx) || allParts[0];
          const partQuestions = chapterData.questions.slice(part.start, part.end);
          const shuffled = global.QuizEngine.shuffleQuestionsAndOptions(partQuestions);
          session = {
            chapterId,
            sessionKey,
            partIndex: part.index,
            partTotal: part.total,
            partStart: part.start,
            partEnd: part.end,
            title: chapterData.title,
            title: chapterData.title,
            subtitle: chapterData.subtitle,
            description: chapterData.description,
            courseTitle: chapterData.meta && chapterData.meta.course ? chapterData.meta.course.title : 'BSEB / CBSE',
            subjectName: chapterData.meta && chapterData.meta.subject ? (chapterData.meta.subject.titleHi || chapterData.meta.subject.name) : 'विज्ञान',
            chapterNumber: chapterData.meta ? chapterData.meta.chapterNumber : 1,
            questions: shuffled,
            states: shuffled.map((_, idx) => (idx === 0 ? 'current' : 'default')),
            selectedAnswers: shuffled.map(() => null),
            currentIndex: 0,
            score: 0,
            elapsedSeconds: 0,
            languagePref: global.QuizStorage.getQuizLanguagePref()
          };
          global.QuizStorage.saveIncompleteQuiz(sessionKey, session);
        }
      }

      state.activeQuizSession = session;
      renderActiveQuestionView();

      // Start 1-second timer
      state.quizTimerInterval = setInterval(() => {
        if (!state.activeQuizSession) return;
        state.activeQuizSession.elapsedSeconds = (state.activeQuizSession.elapsedSeconds || 0) + 1;
        const timerEl = document.getElementById('hud-timer-val');
        if (timerEl) {
          const totalTargetSec = Math.ceil(state.activeQuizSession.questions.length * 0.7) * 60;
          const remaining = Math.max(0, totalTargetSec - state.activeQuizSession.elapsedSeconds);
          timerEl.textContent = formatDurationMMSS(remaining);
        }
      }, 1000);
    } catch (err) {
      // Friendly error screen (PRD Section 10 Reliability)
      routeContainer.innerHTML = `
        <div class="streak-card" style="text-align:center;padding:28px 18px;margin-top:24px;">
          <div style="font-size:2.4rem;margin-bottom:10px;">⚠️</div>
          <h2 style="font-size:1.15rem;margin-bottom:6px;">अध्याय लोड करने में समस्या आई</h2>
          <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:18px;">${err.message || 'फ़ाइल उपलब्ध नहीं है।'}</p>
          <button class="btn-primary-gradient" onclick="window.location.hash='#/home'">← होम स्क्रीन पर वापस जाएँ</button>
        </div>
      `;
    }
  }

  function renderActiveQuestionView() {
    const sess = state.activeQuizSession;
    if (!sess) return;

    const qIdx = sess.currentIndex;
    const total = sess.questions.length;
    const item = sess.questions[qIdx];
    const chosenIdx = sess.selectedAnswers[qIdx];
    const isAnswered = chosenIdx !== null && chosenIdx !== undefined;
    const totalTargetSec = Math.ceil(total * 0.7) * 60;
    const remainingSec = Math.max(0, totalTargetSec - (sess.elapsedSeconds || 0));

    // Resolve Question Text (Bilingual or Profile-Language Translated)
    const qPair = global.QuizTranslator.resolveDisplayPair(
      item.q,
      false,
      sess.languagePref,
      (swapped) => {
        const pEl = document.getElementById('active-q-primary');
        const sEl = document.getElementById('active-q-secondary');
        if (pEl) pEl.textContent = swapped.primary;
        if (sEl) {
          sEl.textContent = swapped.secondary || '';
          sEl.classList.toggle('hidden', !swapped.secondary);
        }
      }
    );

    const bookmarked = global.QuizStorage.isBookmarked(sess.chapterId, qIdx);

    // Build Segmented Progress Bar (Appendix C.7)
    const segmentsHtml = sess.states.map((st, idx) => {
      const cls = idx === qIdx ? 'seg-pill current' : `seg-pill ${st}`;
      return `<div class="${cls}" data-seg-idx="${idx}"></div>`;
    }).join('');

    // Build Options (Appendix C.2, C.4, C.5)
    const optionsHtml = (item.o || []).map((optRaw, optIdx) => {
      const letter = global.QuizEngine.getOptionLetter(optIdx);
      const optPair = global.QuizTranslator.resolveDisplayPair(
        optRaw,
        true,
        sess.languagePref,
        (swapped) => {
          const opEl = document.getElementById(`opt-pri-${optIdx}`);
          const osEl = document.getElementById(`opt-sec-${optIdx}`);
          if (opEl) opEl.textContent = swapped.primary;
          if (osEl) {
            osEl.textContent = swapped.secondary || '';
            osEl.classList.toggle('hidden', !swapped.secondary);
          }
        }
      );

      let cardClass = 'option-card';
      let iconHtml = '';
      if (isAnswered) {
        if (optIdx === item.a) {
          cardClass += ' correct';
          iconHtml = '✓';
        } else if (optIdx === chosenIdx && chosenIdx !== item.a) {
          cardClass += ' wrong';
          iconHtml = '✕';
        }
      }

      return `
        <button class="${cardClass}" data-opt-idx="${optIdx}" ${isAnswered ? 'disabled' : ''}>
          <div class="option-left">
            <span class="option-letter">${letter}</span>
            <div class="option-text-wrap">
              <span id="opt-pri-${optIdx}" class="option-primary">${optPair.primary}</span>
              <span id="opt-sec-${optIdx}" class="option-secondary ${optPair.secondary ? '' : 'hidden'}">${optPair.secondary || ''}</span>
            </div>
          </div>
          <span class="option-status-icon">${iconHtml}</span>
        </button>
      `;
    }).join('');

    const isLastQuestion = qIdx === total - 1;

    routeContainer.innerHTML = `
      <div id="quiz-touch-surface">
        <!-- Chapter Header Strip -->
        <div class="quiz-header-strip">
          <div style="min-width:0;">
            <div class="quiz-chapter-heading">${sess.title}</div>
            <div class="quiz-chapter-sub">
              <span class="course-dot"></span>
              <span>${sess.subtitle}</span>
            </div>
          </div>
          <div class="live-exam-badge">⚡ LIVE<br/>EXAM</div>
        </div>

        <!-- Quiz HUD Bar (Counter, Timer, Live Score, Navigator Button) -->
        <div class="quiz-hud-bar">
          <div class="hud-q-counter">${qIdx + 1} <small>/ ${total}</small></div>
          <div class="hud-timer-pill">
            <span>⏱</span>
            <span id="hud-timer-val">${formatDurationMMSS(remainingSec)}</span>
          </div>
          <div class="hud-score-pill">✓ स्कोर: ${sess.score}</div>
          <button id="btn-open-navigator" class="hud-grid-btn" aria-label="प्रश्न नेविगेटर खोलें" title="Question Grid">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
        </div>

        <!-- Segmented Progress Bar (Appendix C.7) -->
        <div class="segmented-bar" id="quiz-segmented-bar">
          ${segmentsHtml}
        </div>

        <!-- Question Card -->
        <div class="question-card">
          <div class="question-card-meta">
            <span class="question-tag-pill">📖 अध्याय ${sess.chapterNumber || 1} • ${sess.subjectName || 'अभ्यास'} • 1 अंक</span>
            <button id="btn-bookmark-q" class="bookmark-btn ${bookmarked ? 'active' : ''}" aria-label="प्रश्न बुकमार्क करें">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="${bookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
            </button>
          </div>

          <div id="active-q-primary" class="q-primary-text">${qPair.primary}</div>
          <div id="active-q-secondary" class="q-secondary-text ${qPair.secondary ? '' : 'hidden'}">${qPair.secondary || ''}</div>

          <button id="btn-toggle-hint" class="hint-toggle-btn">
            💡 अवधारणा संकेत (Conceptual Hint) ⌄
          </button>
          <div id="hint-content-box" class="hint-box hidden">
            ${item.hint || 'विकल्पों को ध्यान से पढ़ें और मुख्य वैज्ञानिक/पाठ्यपुस्तक परिभाषा को याद करें।'}
          </div>
        </div>

        <!-- Options List -->
        <div class="options-list">
          ${optionsHtml}
        </div>

        <!-- Bottom Action Buttons (Skip & Next / Submit) -->
        <div class="quiz-bottom-actions">
          <button id="btn-quiz-skip" class="btn-skip">
            ↪ ${isAnswered ? 'पिछला प्रश्न' : 'स्किप करें'}
          </button>
          <button id="btn-quiz-next" class="btn-next">
            <span>${isLastQuestion ? 'क्विज़ सबमिट करें' : 'अगला प्रश्न'}</span>
            <span>→</span>
          </button>
        </div>

        <div class="swipe-hint-footer">
          👆 ← स्वाइप करके अगला या पिछला प्रश्न देखें →
        </div>
      </div>
    `;

    // Scroll active segment pill into view
    const activeSeg = routeContainer.querySelector('.seg-pill.current');
    if (activeSeg && activeSeg.scrollIntoView) {
      activeSeg.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    // Bind Option Selection (Appendix C.7)
    routeContainer.querySelectorAll('.option-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (sess.selectedAnswers[qIdx] !== null) return;
        const picked = Number(btn.getAttribute('data-opt-idx'));
        handleAnswerSelection(picked);
      });
    });

    // Bind Hint toggle
    const hintBtn = document.getElementById('btn-toggle-hint');
    const hintBox = document.getElementById('hint-content-box');
    if (hintBtn && hintBox) {
      hintBtn.addEventListener('click', () => hintBox.classList.toggle('hidden'));
    }

    // Bind Bookmark toggle (FR-13)
    const bmBtn = document.getElementById('btn-bookmark-q');
    if (bmBtn) {
      bmBtn.addEventListener('click', () => {
        const added = global.QuizStorage.toggleBookmark({
          chapterId: sess.chapterId,
          chapterTitle: `${sess.title} — ${sess.subtitle}`,
          questionIndex: qIdx,
          q: item.q,
          o: item.o,
          a: item.a
        });
        bmBtn.classList.toggle('active', added);
        global.QuizSfx.playClick();
        global.QuizStorage.Bridge.toast(added ? 'प्रश्न रिवीजन वॉल्ट में सहेजा गया 🔖' : 'बुकमार्क हटाया गया');
      });
    }

    // Bind Skip / Previous button
    const skipBtn = document.getElementById('btn-quiz-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        if (isAnswered) {
          if (qIdx > 0) jumpToQuestion(qIdx - 1);
        } else {
          sess.states[qIdx] = 'skipped';
          if (!sess.isCustomPractice) {
            global.QuizStorage.saveIncompleteQuiz(sess.chapterId, sess);
          }
          if (qIdx < total - 1) {
            jumpToQuestion(qIdx + 1);
          } else {
            openNavigatorSheet();
          }
        }
      });
    }

    // Bind Next / Submit button
    const nextBtn = document.getElementById('btn-quiz-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (!isAnswered && sess.states[qIdx] === 'current') {
          sess.states[qIdx] = 'skipped';
        }
        if (isLastQuestion) {
          finishAndSubmitQuiz();
        } else {
          jumpToQuestion(qIdx + 1);
        }
      });
    }

    // Bind Navigator Sheet open button (FR-06)
    const navOpenBtn = document.getElementById('btn-open-navigator');
    if (navOpenBtn) {
      navOpenBtn.addEventListener('click', openNavigatorSheet);
    }

    // Bind Touch Swipe Left / Right Gesture Navigation (FR-05)
    const touchSurface = document.getElementById('quiz-touch-surface');
    if (touchSurface) {
      let touchStartX = 0;
      let touchStartY = 0;
      touchSurface.addEventListener('touchstart', (e) => {
        if (!e.changedTouches || !e.changedTouches[0]) return;
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      }, { passive: true });

      touchSurface.addEventListener('touchend', (e) => {
        if (!e.changedTouches || !e.changedTouches[0]) return;
        const dx = e.changedTouches[0].screenX - touchStartX;
        const dy = e.changedTouches[0].screenY - touchStartY;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          if (dx < 0 && qIdx < total - 1) {
            if (!isAnswered && sess.states[qIdx] === 'current') sess.states[qIdx] = 'skipped';
            jumpToQuestion(qIdx + 1);
          } else if (dx > 0 && qIdx > 0) {
            jumpToQuestion(qIdx - 1);
          }
        }
      }, { passive: true });
    }
  }

  function handleAnswerSelection(pickedIdx) {
    const sess = state.activeQuizSession;
    if (!sess) return;
    const qIdx = sess.currentIndex;
    const item = sess.questions[qIdx];
    const isCorrect = pickedIdx === item.a;

    sess.selectedAnswers[qIdx] = pickedIdx;
    if (isCorrect) {
      sess.score += 1;
      sess.states[qIdx] = 'correct';
      if (global.QuizSfx) global.QuizSfx.playCorrect();
    } else {
      sess.states[qIdx] = 'wrong';
      if (global.QuizSfx) global.QuizSfx.playWrong();
    }

    // Record per-question accuracy & daily streak (FR-10, FR-11)
    global.QuizStorage.recordQuestionOutcome(
      sess.chapterId,
      `${sess.title} — ${sess.subtitle}`,
      qIdx,
      item,
      isCorrect
    );

    if (!sess.isCustomPractice) {
      global.QuizStorage.saveIncompleteQuiz(sess.chapterId, sess);
    }

    renderActiveQuestionView();
  }

  function jumpToQuestion(targetIndex) {
    const sess = state.activeQuizSession;
    if (!sess) return;
    if (targetIndex < 0 || targetIndex >= sess.questions.length) return;
    sess.currentIndex = targetIndex;
    if (sess.states[targetIndex] === 'default') {
      sess.states[targetIndex] = 'current';
    }
    if (!sess.isCustomPractice) {
      global.QuizStorage.saveIncompleteQuiz(sess.chapterId, sess);
    }
    renderActiveQuestionView();
  }

  // ==========================================================================
  // Question Navigator Bottom Sheet (FR-06)
  // ==========================================================================
  function openNavigatorSheet() {
    const sess = state.activeQuizSession;
    if (!sess) return;

    const correctCount = sess.states.filter((s) => s === 'correct').length;
    const wrongCount = sess.states.filter((s) => s === 'wrong').length;
    const skippedCount = sess.states.filter((s) => s === 'skipped').length;
    const unansweredCount = sess.states.length - correctCount - wrongCount - skippedCount;

    navigatorSummaryText.textContent = `सही: ${correctCount} • गलत: ${wrongCount} • छोड़े गए: ${skippedCount} • शेष: ${unansweredCount}`;

    navigatorGrid.innerHTML = sess.states.map((st, idx) => {
      const cls = idx === sess.currentIndex ? 'nav-q-circle current' : `nav-q-circle ${st}`;
      return `<button class="${cls}" data-jump-idx="${idx}">${idx + 1}</button>`;
    }).join('');

    navigatorGrid.querySelectorAll('.nav-q-circle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = Number(btn.getAttribute('data-jump-idx'));
        navigatorBackdrop.classList.add('hidden');
        jumpToQuestion(target);
      });
    });

    navigatorBackdrop.classList.remove('hidden');
  }

  function finishAndSubmitQuiz() {
    stopQuizTimer();
    navigatorBackdrop.classList.add('hidden');
    const sess = state.activeQuizSession;
    if (!sess) return;

    const total = sess.questions.length;
    const correct = sess.states.filter((s) => s === 'correct').length;
    const wrong = sess.states.filter((s) => s === 'wrong').length;
    const skipped = total - correct - wrong;
    const band = global.QuizEngine.evaluateResultBand(correct, total);

    const attempt = {
      id: 'att_' + Date.now(),
      chapterId: sess.chapterId,
      partIndex: sess.partIndex || 0,
      partTotal: sess.partTotal || 1,
      partStart: sess.partStart || 0,
      partEnd: sess.partEnd || 0,
      partLabel: sess.partIndex ? `भाग ${sess.partIndex}/${sess.partTotal}` : '',
      title: sess.title,
      subtitle: sess.subtitle,
      subjectName: sess.subjectName,
      total,
      correct,
      wrong,
      skipped,
      score: correct,
      percentage: band.percentage,
      gradeLabel: band.gradeLabel,
      message: band.message,
      ringColor: band.ringColor,
      elapsedSeconds: sess.elapsedSeconds || 12,
      questionsSnapshot: sess.questions,
      selectedAnswers: sess.selectedAnswers,
      completedAt: Date.now()
    };

    if (!sess.isCustomPractice) {
      global.QuizStorage.saveCompletedAttempt(attempt);
    } else {
      state.lastCustomAttempt = attempt;
    }

    state.activeQuizSession = null;
    window.location.hash = `#/result/${attempt.id}`;
  }

  // ==========================================================================
  // Screen 4: Result & Scorecard (#/result/:attemptId) — Matches unnamed (3).png
  // ==========================================================================
  function renderResultScreen(attemptId) {
    stopQuizTimer();
    updateHeaderUI('result');

    const attempt = (state.lastCustomAttempt && state.lastCustomAttempt.id === attemptId)
      ? state.lastCustomAttempt
      : global.QuizStorage.getAttemptById(attemptId);

    if (!attempt) {
      window.location.hash = '#/home';
      return;
    }

    const attemptedCount = attempt.correct + attempt.wrong;
    const accuracyRate = attemptedCount > 0
      ? ((attempt.correct / attemptedCount) * 100).toFixed(1)
      : '0.0';
    const avgSecPerQ = attempt.total > 0
      ? ((attempt.elapsedSeconds || 15) / attempt.total).toFixed(1)
      : '0.0';

    // SVG Ring Geometry (r = 68 -> circumference = 427.25)
    const radius = 68;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (attempt.percentage / 100) * circumference;

    routeContainer.innerHTML = `
      <!-- Top Result Strip -->
      <div class="result-top-strip">
        <div class="result-strip-title">
          <span class="emerald-dot"></span>
          <span>रिजल्ट एवं विश्लेषण</span>
        </div>
        <button id="btn-result-close" class="icon-btn" aria-label="डैशबोर्ड पर जाएँ">✕</button>
      </div>

      <!-- Chapter Info Banner -->
      <div class="result-chapter-banner">
        <div class="result-banner-top">
          <span>● ${attempt.title}</span>
          <span class="subject-tag">${attempt.subjectName || 'Science'}</span>
        </div>
        <div class="result-banner-bottom">
          <strong style="font-size:1.02rem;">${attempt.subtitle}</strong>
          <span style="font-size:0.74rem;color:var(--text-secondary);">(कुल प्रश्न: ${attempt.total})</span>
        </div>
      </div>

      <!-- Mastery & Motivational Headline (Appendix C.6) -->
      <div class="result-hero-center">
        <div class="mastery-pill">🎖️ अध्याय दक्षता पूर्ण (MASTERY)</div>
        <h1 class="result-congrats-title">क्विज़ पूर्ण हुई! 🎉</h1>
        <p class="result-motivation-msg">${attempt.message}</p>

        <!-- Circular Percentage Ring -->
        <div class="ring-chart-wrapper">
          <svg class="ring-svg" viewBox="0 0 160 160">
            <circle class="ring-bg" cx="80" cy="80" r="${radius}" />
            <circle
              class="ring-progress"
              cx="80"
              cy="80"
              r="${radius}"
              stroke="${attempt.ringColor || '#10B981'}"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${dashOffset}"
            />
          </svg>
          <div class="ring-center-content">
            <div class="ring-pct-value">${attempt.percentage}%</div>
            <div class="ring-grade-pill">● ${attempt.gradeLabel}</div>
          </div>
        </div>
      </div>

      <!-- 4-Column Stats Box (Total / Correct / Wrong / Skipped — FR-07) -->
      <div class="stats-four-grid">
        <div class="stat-mini-box total">
          <div class="stat-mini-label">कुल प्रश्न</div>
          <div class="stat-mini-num">${attempt.total}</div>
          <div class="stat-mini-sub">लक्ष्य</div>
        </div>
        <div class="stat-mini-box correct">
          <div class="stat-mini-label" style="color:var(--accent-emerald-bright);">सही उत्तर</div>
          <div class="stat-mini-num" style="color:var(--accent-emerald-bright);">${String(attempt.correct).padStart(2, '0')}</div>
          <div class="stat-mini-sub" style="color:var(--accent-emerald-bright);">+${attempt.correct} अंक</div>
        </div>
        <div class="stat-mini-box wrong">
          <div class="stat-mini-label" style="color:var(--accent-rose);">गलत उत्तर</div>
          <div class="stat-mini-num" style="color:var(--accent-rose);">${String(attempt.wrong).padStart(2, '0')}</div>
          <div class="stat-mini-sub" style="color:var(--accent-rose);">-0 अंक</div>
        </div>
        <div class="stat-mini-box skipped">
          <div class="stat-mini-label" style="color:var(--accent-amber);">छोड़े गए</div>
          <div class="stat-mini-num" style="color:var(--accent-amber);">${String(attempt.skipped).padStart(2, '0')}</div>
          <div class="stat-mini-sub" style="color:var(--accent-amber);">अनिर्णित</div>
        </div>
      </div>

      <!-- Accuracy & Time Spent Cards -->
      <div class="metric-row-card">
        <div class="metric-row-left">
          <div class="overview-icon" style="color:var(--accent-cyan-bright);">✓</div>
          <div>
            <div style="font-size:0.86rem;font-weight:700;">सटीकता (Accuracy Rate)</div>
            <div style="font-size:0.72rem;color:var(--text-secondary);">प्रयास किए गए प्रश्नों पर</div>
          </div>
        </div>
        <div class="metric-row-val" style="color:var(--accent-cyan-bright);">${accuracyRate}%</div>
      </div>

      <div class="metric-row-card">
        <div class="metric-row-left">
          <div class="overview-icon" style="color:var(--accent-lavender);">⏱</div>
          <div>
            <div style="font-size:0.86rem;font-weight:700;">कुल समय (Time Spent)</div>
            <div style="font-size:0.72rem;color:var(--text-secondary);">औसत: ${avgSecPerQ}s / प्रश्न</div>
          </div>
        </div>
        <div class="metric-row-val">${formatDurationHuman(attempt.elapsedSeconds || 15)}</div>
      </div>

      <!-- Suggestion Box -->
      <div class="suggestion-card">
        <span style="font-size:1.2rem;">💡</span>
        <div>
          <strong>सुझाव:</strong> ${attempt.wrong > 0
            ? `जिन ${attempt.wrong} प्रश्नों में त्रुटि हुई है, वे 'कमज़ोर टॉपिक' सूची में जोड़ दिए गए हैं। उनका एक बार दोहराव अवश्य करें!`
            : 'आपका प्रदर्शन शानदार रहा! अगले अध्याय का अभ्यास जारी रखें।'}
        </div>
      </div>

      <!-- Primary Actions (Retry, Review All Answers, Share, Back to Dashboard — FR-08, FR-20) -->
      <button id="btn-retry-quiz" class="btn-emerald-full">
        <span>पुनः प्रयास करें (Retry)</span>
        <span>↻</span>
      </button>

      <button id="btn-toggle-answer-review" class="btn-secondary-full">
        <span>👁</span>
        <span>सभी प्रश्न उत्तर सहित देखें (Review Solutions)</span>
      </button>

      <button id="btn-share-result" class="btn-secondary-full">
        <span>📤</span>
        <span>परिणाम साझा करें (Share Score)</span>
      </button>

      <div id="answer-review-list" class="hidden" style="margin-top:12px;"></div>

      <button id="btn-back-dashboard" class="link-btn full-width" style="text-align:center;padding:12px 0;">
        ← डैशबोर्ड पर वापस जाएँ
      </button>
    `;

    // Retry Quiz (FR-08: reshuffles questions and options and resets state)
    document.getElementById('btn-retry-quiz').addEventListener('click', () => {
      global.QuizSfx.playClick();
      global.QuizStorage.clearIncompleteQuiz(global.QuizStorage.partSessionKey(attempt.chapterId, attempt.partIndex || 0));
      window.location.hash = attempt.partIndex
        ? `#/quiz/${attempt.chapterId}/${attempt.partIndex}`
        : `#/quiz/${attempt.chapterId}`;
    });

    // Review Solutions inline
    const reviewBtn = document.getElementById('btn-toggle-answer-review');
    const reviewContainer = document.getElementById('answer-review-list');
    reviewBtn.addEventListener('click', () => {
      if (!reviewContainer.classList.contains('hidden')) {
        reviewContainer.classList.add('hidden');
        return;
      }
      const qSnap = attempt.questionsSnapshot || [];
      const selSnap = attempt.selectedAnswers || [];
      reviewContainer.innerHTML = qSnap.map((qItem, idx) => {
        const qDisp = global.QuizTranslator.resolveDisplayPair(qItem.q, false);
        const correctDisp = global.QuizTranslator.resolveDisplayPair(qItem.o[qItem.a], true);
        const userPickIdx = selSnap[idx];
        const userPickDisp = (userPickIdx !== null && userPickIdx !== undefined)
          ? global.QuizTranslator.resolveDisplayPair(qItem.o[userPickIdx], true).primary
          : 'छोड़ा गया (Skipped)';
        const isRight = userPickIdx === qItem.a;
        return `
          <div class="streak-card" style="padding:12px;margin-bottom:8px;">
            <div style="font-size:0.74rem;color:var(--text-secondary);margin-bottom:4px;">प्रश्न ${idx + 1}</div>
            <div style="font-size:0.9rem;font-weight:700;margin-bottom:6px;">${qDisp.primary}</div>
            <div style="font-size:0.78rem;color:var(--accent-emerald-bright);">✓ सही उत्तर: <strong>${correctDisp.primary}</strong></div>
            <div style="font-size:0.76rem;color:${isRight ? 'var(--accent-cyan-bright)' : 'var(--accent-rose)'};margin-top:2px;">
              आपका उत्तर: ${userPickDisp}
            </div>
          </div>
        `;
      }).join('');
      reviewContainer.classList.remove('hidden');
    });

    // Share Score via NativeBridge (FR-20)
    document.getElementById('btn-share-result').addEventListener('click', () => {
      const shareMsg = `🎯 मैंने Smart Quiz Portal (Offline App) पर "${attempt.subtitle}" में ${attempt.percentage}% (${attempt.correct}/${attempt.total}) अंक प्राप्त किए!`;
      global.QuizStorage.Bridge.share(shareMsg);
    });

    document.getElementById('btn-result-close').addEventListener('click', () => {
      window.location.hash = '#/home';
    });

    document.getElementById('btn-back-dashboard').addEventListener('click', () => {
      window.location.hash = '#/home';
    });
  }

  // ==========================================================================
  // Screen 5: Weak-Topic Tracking (#/weak-topics — FR-10)
  // ==========================================================================
  function renderWeakTopicsScreen() {
    stopQuizTimer();
    updateHeaderUI('sub', 'कमज़ोर टॉपिक (FR-10)', 'जिन प्रश्नों में अक्सर गलती हुई है');
    updateBottomNavActive('#/weak-topics');

    const weakList = global.QuizStorage.getWeakTopicsList();

    if (weakList.length === 0) {
      routeContainer.innerHTML = `
        <div class="greeting-row">
          <div>
            <h1 class="greeting-title">⚠️ कमज़ोर टॉपिक (Weak Topics)</h1>
            <p class="greeting-date">जिन प्रश्नों का उत्तर आपने गलत दिया है वे यहाँ दिखेंगे</p>
          </div>
        </div>
        <div class="streak-card" style="text-align:center;padding:28px 16px;">
          <div style="font-size:2.4rem;margin-bottom:8px;">🌟</div>
          <h3 style="margin-bottom:6px;">अभी कोई कमज़ोर प्रश्न नहीं है!</h3>
          <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:16px;">
            जब आप अध्यायवार क्विज़ हल करेंगे, तो गलत हुए प्रश्न स्वतः यहाँ रिवीजन के लिए जमा हो जाएंगे।
          </p>
          <button class="btn-primary-gradient" onclick="window.location.hash='#/home'">अभ्यास शुरू करें →</button>
        </div>
      `;
      return;
    }

    const itemsHtml = weakList.map((item, idx) => {
      const qDisp = global.QuizTranslator.resolveDisplayPair(item.q, false);
      const ansDisp = global.QuizTranslator.resolveDisplayPair(item.o[item.a], true);
      return `
        <div class="streak-card" style="padding:13px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--accent-rose);font-weight:700;margin-bottom:4px;">
            <span>#${idx + 1} • ${item.chapterTitle || item.chapterId}</span>
            <span>गलत: ${item.wrongCount} बार | सही: ${item.correctCount} बार</span>
          </div>
          <div style="font-size:0.94rem;font-weight:700;margin-bottom:6px;">${qDisp.primary}</div>
          <div style="font-size:0.8rem;color:var(--accent-emerald-bright);">✓ सही उत्तर: <strong>${ansDisp.primary}</strong></div>
        </div>
      `;
    }).join('');

    routeContainer.innerHTML = `
      <div class="greeting-row">
        <div>
          <h1 class="greeting-title">⚠️ कमज़ोर टॉपिक (${weakList.length})</h1>
          <p class="greeting-date">लगातार गलत हुए प्रश्नों का विशेष अभ्यास सेट</p>
        </div>
      </div>
      <button id="btn-practice-weak-now" class="btn-primary-gradient full-width" style="margin-bottom:14px;">
        🎯 सभी ${weakList.length} कमज़ोर प्रश्नों का री-टेस्ट लें →
      </button>
      <div>${itemsHtml}</div>
    `;

    document.getElementById('btn-practice-weak-now').addEventListener('click', () => {
      const shuffled = global.QuizEngine.shuffleQuestionsAndOptions(weakList.map((w) => ({
        q: w.q,
        o: w.o,
        a: w.a
      })));
      startOrResumeQuizScreen('weak-practice', 0, {
        isCustomPractice: true,
        chapterId: 'weak-practice',
        title: 'विशेष सुधार अभ्यास (Weak Topics)',
        subtitle: 'कमज़ोर प्रश्नों का लक्षित रिवीजन सेट',
        subjectName: 'Revision',
        chapterNumber: 1,
        questions: shuffled,
        states: shuffled.map((_, idx) => (idx === 0 ? 'current' : 'default')),
        selectedAnswers: shuffled.map(() => null),
        currentIndex: 0,
        score: 0,
        elapsedSeconds: 0,
        languagePref: global.QuizStorage.getQuizLanguagePref()
      });
    });
  }

  // ==========================================================================
  // Screen 6: Bookmarks / Revision Vault (#/bookmarks — FR-13)
  // ==========================================================================
  function renderBookmarksScreen() {
    stopQuizTimer();
    updateHeaderUI('sub', 'रिवीजन वॉल्ट (FR-13)', 'सहेजे गए महत्वपूर्ण प्रश्न');
    updateBottomNavActive('#/bookmarks');

    const bmList = global.QuizStorage.getBookmarksList();
    if (bmList.length === 0) {
      routeContainer.innerHTML = `
        <div class="greeting-row">
          <div>
            <h1 class="greeting-title">🔖 रिवीजन वॉल्ट (Bookmarks)</h1>
            <p class="greeting-date">परीक्षा से पहले त्वरित दोहराव के लिए बुकमार्क किए गए प्रश्न</p>
          </div>
        </div>
        <div class="streak-card" style="text-align:center;padding:28px 16px;">
          <div style="font-size:2.4rem;margin-bottom:8px;">🔖</div>
          <h3 style="margin-bottom:6px;">कोई बुकमार्क प्रश्न नहीं है</h3>
          <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:16px;">
            क्विज़ के दौरान किसी भी महत्वपूर्ण प्रश्न के ऊपर बने 🔖 आइकन को दबाकर उसे यहाँ सहेजें।
          </p>
          <button class="btn-primary-gradient" onclick="window.location.hash='#/home'">अध्यायों की ओर जाएँ →</button>
        </div>
      `;
      return;
    }

    const itemsHtml = bmList.map((item, idx) => {
      const qDisp = global.QuizTranslator.resolveDisplayPair(item.q, false);
      const ansDisp = global.QuizTranslator.resolveDisplayPair(item.o[item.a], true);
      return `
        <div class="streak-card" style="padding:13px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--accent-amber);font-weight:700;margin-bottom:4px;">
            <span>#${idx + 1} • ${item.chapterTitle || item.chapterId}</span>
            <span>🔖 सहेजा गया</span>
          </div>
          <div style="font-size:0.94rem;font-weight:700;margin-bottom:6px;">${qDisp.primary}</div>
          <div style="font-size:0.8rem;color:var(--accent-emerald-bright);">✓ उत्तर: <strong>${ansDisp.primary}</strong></div>
        </div>
      `;
    }).join('');

    routeContainer.innerHTML = `
      <div class="greeting-row">
        <div>
          <h1 class="greeting-title">🔖 रिवीजन वॉल्ट (${bmList.length})</h1>
          <p class="greeting-date">आपके द्वारा बुकमार्क किए गए महत्वपूर्ण प्रश्न</p>
        </div>
      </div>
      <button id="btn-practice-bookmarks-now" class="btn-primary-gradient full-width" style="margin-bottom:14px;">
        📝 बुकमार्क प्रश्नों का रिवीजन टेस्ट शुरू करें →
      </button>
      <div>${itemsHtml}</div>
    `;

    document.getElementById('btn-practice-bookmarks-now').addEventListener('click', () => {
      const shuffled = global.QuizEngine.shuffleQuestionsAndOptions(bmList.map((b) => ({
        q: b.q,
        o: b.o,
        a: b.a
      })));
      startOrResumeQuizScreen('bookmark-practice', 0, {
        isCustomPractice: true,
        chapterId: 'bookmark-practice',
        title: 'बुकमार्क रिवीजन टेस्ट',
        subtitle: 'सहेजे गए महत्वपूर्ण प्रश्नों का अभ्यास',
        subjectName: 'Vault',
        chapterNumber: 1,
        questions: shuffled,
        states: shuffled.map((_, idx) => (idx === 0 ? 'current' : 'default')),
        selectedAnswers: shuffled.map(() => null),
        currentIndex: 0,
        score: 0,
        elapsedSeconds: 0,
        languagePref: global.QuizStorage.getQuizLanguagePref()
      });
    });
  }

  // ==========================================================================
  // Screen 7: Attempt History & Stats (#/stats — FR-09)
  // ==========================================================================
  function renderStatsScreen() {
    stopQuizTimer();
    updateHeaderUI('sub', 'प्रदर्शन एवं इतिहास', 'Attempt History & Scorecards');
    updateBottomNavActive('#/stats');

    const attempts = global.QuizStorage.getAllAttempts();
    if (attempts.length === 0) {
      routeContainer.innerHTML = `
        <div class="greeting-row">
          <div>
            <h1 class="greeting-title">📊 प्रदर्शन इतिहास (History)</h1>
            <p class="greeting-date">आपके द्वारा हल किए गए सभी क्विज़ का रिकॉर्ड</p>
          </div>
        </div>
        <div class="streak-card" style="text-align:center;padding:28px 16px;">
          <div style="font-size:2.4rem;margin-bottom:8px;">📈</div>
          <h3 style="margin-bottom:6px;">अभी तक कोई प्रयास दर्ज नहीं हुआ</h3>
          <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:16px;">
            अपना पहला अध्याय क्विज़ पूरा करें और अपना विस्तृत स्कोरकार्ड यहाँ देखें।
          </p>
          <button class="btn-primary-gradient" onclick="window.location.hash='#/home'">पहला क्विज़ चुनें →</button>
        </div>
      `;
      return;
    }

    const listHtml = attempts.map((att) => `
      <div class="chapter-card" data-attempt-id="${att.id}" style="margin-bottom:10px;">
        <div class="chapter-card-left">
          <div class="chapter-num-box completed">${att.percentage}%</div>
          <div class="chapter-info">
            <div class="chapter-title-hi">${att.subtitle}</div>
            <div class="chapter-title-en">${att.title}</div>
            <div class="chapter-meta-row">
              <span class="status-pill completed">✓ ${att.correct}/${att.total} सही</span>
              <span class="chapter-mcq-count">⏱ ${formatDurationHuman(att.elapsedSeconds || 15)}</span>
            </div>
          </div>
        </div>
        <button class="chapter-play-btn">›</button>
      </div>
    `).join('');

    routeContainer.innerHTML = `
      <div class="greeting-row">
        <div>
          <h1 class="greeting-title">📊 परीक्षा इतिहास (${attempts.length})</h1>
          <p class="greeting-date">किसी भी प्रयास पर टैप करके विस्तृत स्कोरकार्ड देखें</p>
        </div>
      </div>
      <div>${listHtml}</div>
    `;

    routeContainer.querySelectorAll('.chapter-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-attempt-id');
        window.location.hash = `#/result/${id}`;
      });
    });
  }

  // ==========================================================================
  // Router Dispatch (PRD Section 9)
  // ==========================================================================
  function handleRouteChange() {
    const hash = window.location.hash || '#/home';
    routeContainer.scrollTop = 0;

    if (hash === '#/home' || hash === '#') {
      renderHomeDashboard();
      return;
    }
    if (hash.startsWith('#/subject/')) {
      const subjId = decodeURIComponent(hash.replace('#/subject/', ''));
      renderSubjectScreen(subjId, null);
      return;
    }
    if (hash.startsWith('#/section/')) {
      const parts = hash.replace('#/section/', '').split('/');
      renderSubjectScreen(decodeURIComponent(parts[0] || ''), decodeURIComponent(parts[1] || ''));
      return;
    }
    if (hash.startsWith('#/parts/')) {
      const chapterId = decodeURIComponent(hash.replace('#/parts/', ''));
      renderPartsScreen(chapterId);
      return;
    }
    if (hash.startsWith('#/quiz/')) {
      const rest = hash.replace('#/quiz/', '').split('/');
      const chapterId = decodeURIComponent(rest[0] || '');
      const partIndex = parseInt(rest[1], 10) || 0;
      startOrResumeQuizScreen(chapterId, partIndex);
      return;
    }
    if (hash.startsWith('#/result/')) {
      const attemptId = decodeURIComponent(hash.replace('#/result/', ''));
      renderResultScreen(attemptId);
      return;
    }
    if (hash === '#/weak-topics') {
      renderWeakTopicsScreen();
      return;
    }
    if (hash === '#/bookmarks') {
      renderBookmarksScreen();
      return;
    }
    if (hash === '#/stats') {
      renderStatsScreen();
      return;
    }
    if (hash === '#/settings') {
      stopQuizTimer();
      updateHeaderUI('sub', 'Settings & Profile', 'प्रोफ़ाइल और सेटिंग्स');
      updateBottomNavActive('#/settings');
      global.QuizSettingsView.renderSettingsScreen(routeContainer, () => {
        const course = global.QuizCatalog.getCourseById(state.selectedCourseId);
        if (course) currentCourseLabel.textContent = course.shortLabel || course.id.toUpperCase();
      });
      return;
    }

    renderHomeDashboard();
  }

  // Hardware Back Navigation Hook called by Kotlin `BackHandler.kt`
  function handleBackNavigation() {
    if (!navigatorBackdrop.classList.contains('hidden')) {
      navigatorBackdrop.classList.add('hidden');
      return 'HANDLED';
    }
    if (!quizIntroBackdrop.classList.contains('hidden')) {
      quizIntroBackdrop.classList.add('hidden');
      return 'HANDLED';
    }
    if (!courseModalBackdrop.classList.contains('hidden')) {
      courseModalBackdrop.classList.add('hidden');
      return 'HANDLED';
    }
    const hash = window.location.hash || '#/home';
    if (hash !== '#/home' && hash !== '#') {
      if ((hash.startsWith('#/quiz/') || hash.startsWith('#/parts/')) && state.activeSubjectId) {
        window.location.hash = `#/subject/${state.activeSubjectId}`;
      } else {
        window.location.hash = '#/home';
      }
      return 'HANDLED';
    }
    return 'ROOT';
  }

  // ==========================================================================
  // Boot & Global Event Listeners
  // ==========================================================================
  async function bootApplication() {
    try {
      state.selectedCourseId = global.QuizStorage.getSelectedCourse();
      state.catalog = await global.QuizCatalog.loadCatalog();
    } catch (err) {
      routeContainer.innerHTML = `<div style="padding:24px;color:var(--accent-rose);">कैटलॉग लोड करने में त्रुटि: ${err.message}</div>`;
      return;
    }

    btnTopBack.addEventListener('click', () => {
      handleBackNavigation();
    });

    document.getElementById('brand-home-trigger').addEventListener('click', () => {
      window.location.hash = '#/home';
    });

    btnCourseSelector.addEventListener('click', openCourseSelectorModal);
    btnCloseCourseModal.addEventListener('click', () => courseModalBackdrop.classList.add('hidden'));

    btnThemeToggle.addEventListener('click', () => {
      const next = global.QuizStorage.getTheme() === 'light' ? 'dark' : 'light';
      global.QuizStorage.setTheme(next);
      global.QuizSfx.playClick();
      global.QuizStorage.Bridge.toast(next === 'light' ? '☀️ लाइट थीम सक्रिय' : '🌙 डार्क थीम सक्रिय');
      if (window.location.hash === '#/settings') {
        handleRouteChange();
      }
    });

    btnProfileNav.addEventListener('click', () => {
      window.location.hash = '#/settings';
    });

    document.querySelectorAll('#bottom-nav .nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-route');
        global.QuizSfx.playClick();
        window.location.hash = route;
      });
    });

    btnCloseNavigator.addEventListener('click', () => navigatorBackdrop.classList.add('hidden'));
    btnSubmitFromSheet.addEventListener('click', finishAndSubmitQuiz);

    window.addEventListener('hashchange', handleRouteChange);
    handleRouteChange();

    // Best-effort update check — never blocks or breaks the app when offline
    if (global.QuizUpdater) {
      global.QuizUpdater.check(false).then((info) => {
        if (info && info.available) {
          global.QuizStorage.Bridge.toast(`नया अपडेट उपलब्ध: ${info.latest} — Settings → ऐप अपडेट`);
          const h = window.location.hash;
          if (h === '#/home' || h === '' || h === '#') renderHomeDashboard();
        }
      }).catch(() => {});
    }
  }

  global.SmartQuizApp = {
    handleBackNavigation
  };

  document.addEventListener('DOMContentLoaded', bootApplication);
})(window);
