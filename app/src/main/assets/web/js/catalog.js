/**
 * Smart Quiz Portal — Catalogue & Chapter JSON Loader (PRD Section 2.2, 6.5, 7.1)
 *
 * Loads `./catalog.json` and resolves chapter paths:
 * - Standard chapters: `baseDir + file` (e.g., `data/BSEB/10th/SCIENCE/PHYSICS/01.json`)
 * - COMMON/ prefix chapters: `data/COMMON/...`
 * Caches loaded JSON in memory for instant navigation.
 */
(function (global) {
  'use strict';

  let catalogData = null;
  const chapterCache = new Map();

  async function loadCatalog() {
    if (catalogData) return catalogData;
    const response = await fetch('./catalog.json');
    if (!response.ok) {
      throw new Error(`Failed to load catalog.json (${response.status})`);
    }
    catalogData = await response.json();
    return catalogData;
  }

  function resolveChapterFileUrl(baseDir, fileRel) {
    if (!fileRel) return '';
    if (fileRel.startsWith('COMMON/')) {
      return `./data/${fileRel}`;
    }
    if (fileRel.startsWith('data/')) {
      return `./${fileRel}`;
    }
    const cleanBase = baseDir.endsWith('/') ? baseDir : `${baseDir}/`;
    return `./${cleanBase}${fileRel}`;
  }

  function getCourses() {
    return catalogData ? (catalogData.courses || []) : [];
  }

  function getCourseById(courseId) {
    const courses = getCourses();
    return courses.find((c) => c.id === courseId) || courses[0] || null;
  }

  function findSubject(courseId, subjectId) {
    const course = getCourseById(courseId);
    if (!course) return null;
    const subjects = course.subjects || [];
    return subjects.find((s) => s.id === subjectId) || subjects[0] || null;
  }

  function findChapterMeta(chapterId) {
    const courses = getCourses();
    for (const course of courses) {
      for (const subj of (course.subjects || [])) {
        if (Array.isArray(subj.chapters)) {
          for (let idx = 0; idx < subj.chapters.length; idx++) {
            const ch = subj.chapters[idx];
            if (ch.id === chapterId) {
              return {
                course,
                subject: subj,
                section: null,
                chapter: ch,
                chapterNumber: idx + 1,
                url: resolveChapterFileUrl(course.baseDir, ch.file)
              };
            }
          }
        }
        if (Array.isArray(subj.sections)) {
          for (const sec of subj.sections) {
            for (let idx = 0; idx < (sec.chapters || []).length; idx++) {
              const ch = sec.chapters[idx];
              if (ch.id === chapterId) {
                return {
                  course,
                  subject: subj,
                  section: sec,
                  chapter: ch,
                  chapterNumber: idx + 1,
                  url: resolveChapterFileUrl(course.baseDir, ch.file)
                };
              }
            }
          }
        }
      }
    }
    return null;
  }

  function countSubjectChaptersAndQuestions(subject) {
    let chapterCount = 0;
    let questionCount = 0;
    const allChapters = [];
    if (Array.isArray(subject.chapters)) {
      for (const ch of subject.chapters) {
        chapterCount++;
        questionCount += (ch.questions || 20);
        allChapters.push(ch);
      }
    }
    if (Array.isArray(subject.sections)) {
      for (const sec of subject.sections) {
        for (const ch of (sec.chapters || [])) {
          chapterCount++;
          questionCount += (ch.questions || 20);
          allChapters.push(ch);
        }
      }
    }
    return { chapterCount, questionCount, allChapters };
  }

  async function loadChapterData(chapterId) {
    if (chapterCache.has(chapterId)) {
      return chapterCache.get(chapterId);
    }
    const meta = findChapterMeta(chapterId);
    if (!meta) {
      throw new Error(`अध्याय नहीं मिला (Chapter ID: ${chapterId})`);
    }
    const response = await fetch(meta.url);
    if (!response.ok) {
      throw new Error(`अध्याय फ़ाइल लोड करने में त्रुटि (${meta.url})`);
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error('इस अध्याय में प्रश्न उपलब्ध नहीं हैं।');
    }
    const enriched = {
      ...data,
      meta
    };
    chapterCache.set(chapterId, enriched);
    return enriched;
  }

  function isBilingualChapter(questions) {
    if (!Array.isArray(questions) || questions.length === 0) return false;
    const firstQ = questions[0].q;
    return Boolean(firstQ && typeof firstQ === 'object' && ('hi' in firstQ || 'en' in firstQ));
  }

  global.QuizCatalog = {
    loadCatalog,
    getCourses,
    getCourseById,
    findSubject,
    findChapterMeta,
    countSubjectChaptersAndQuestions,
    loadChapterData,
    isBilingualChapter
  };
})(window);
