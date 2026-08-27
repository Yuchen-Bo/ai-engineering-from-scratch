(function () {
  var root = document.documentElement;
  var stored = localStorage.getItem('theme');
  if (stored) {
    root.setAttribute('data-theme', stored);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.setAttribute('data-theme', 'light');
  }
  updateThemeIcon();

  document.addEventListener('DOMContentLoaded', function () {
    initThemeToggle();
    populateCurriculumSummary();
    populateStats();
    renderPhases();
    initStaggerIndex();
    initModal();
    initCopyButton();
    initMastheadFigure();
    initFadeObserver();
  });

  function populateCurriculumSummary() {
    if (typeof PHASES === 'undefined' || !Array.isArray(PHASES)) return;
    var lessonTotal = PHASES.reduce(function (total, phase) {
      return total + (Array.isArray(phase.lessons) ? phase.lessons.length : 0);
    }, 0);
    var values = {
      mastheadLessonCount: lessonTotal + ' lessons',
      mastheadPhaseCount: PHASES.length + ' phases',
      prefaceLessonCount: lessonTotal + ' lessons',
      prefacePhaseCount: PHASES.length + ' phases'
    };
    Object.keys(values).forEach(function (id) {
      var target = document.getElementById(id);
      if (target) target.textContent = values[id];
    });
  }

  function updateThemeIcon() {
    var icon = document.getElementById('themeIcon');
    if (!icon) return;
    var theme = root.getAttribute('data-theme');
    icon.textContent = theme === 'light' ? 'N' : 'D';
  }

  function initThemeToggle() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var current = root.getAttribute('data-theme');
      var next = current === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      updateThemeIcon();
    });
    updateThemeIcon();
  }

  function computeStats() {
    var totalLessons = 0;
    var completeLessons = 0;
    var hasProgress = !!window.AIFSProgress;
    for (var i = 0; i < PHASES.length; i++) {
      var lessons = PHASES[i].lessons;
      totalLessons += lessons.length;
      for (var j = 0; j < lessons.length; j++) {
        var staticDone = lessons[j].status === 'complete';
        var userDone = false;
        if (hasProgress && lessons[j].url) {
          var lp = window.AIFSProgress.extractPath(lessons[j].url);
          if (lp) userDone = window.AIFSProgress.isLessonComplete(lp);
        }
        if (staticDone || userDone) completeLessons++;
      }
    }
    var completePhases = 0;
    for (var p = 0; p < PHASES.length; p++) {
      if (PHASES[p].status === 'complete') completePhases++;
    }
    return {
      lessons: totalLessons,
      phases: PHASES.length,
      complete: completeLessons,
      completePhases: completePhases
    };
  }

  function setBar(selector, pct) {
    var el = document.querySelector(selector);
    if (!el) return;
    var clamped = Math.max(0, Math.min(100, pct));
    el.setAttribute('data-target-pct', clamped.toFixed(1));
    if (el.classList.contains('in-view') || !window.IntersectionObserver) {
      setBarScale(el, clamped);
    } else {
      setBarScale(el, 0);
    }
  }

  function setBarScale(el, pct) {
    var clamped = Math.max(0, Math.min(100, Number(pct) || 0));
    el.style.setProperty('--bar-scale', (clamped / 100).toFixed(3));
  }

  function populateStats() {
    var stats = computeStats();
    var pct = stats.lessons > 0 ? (stats.complete / stats.lessons) * 100 : 0;
    var phasePct = stats.phases > 0 ? (stats.completePhases / stats.phases) * 100 : 0;
    var glossaryCount = (typeof GLOSSARY !== 'undefined') ? GLOSSARY.length : 0;

    setText('[data-stat="complete-frac"]', stats.complete + ' / ' + stats.lessons);
    setText('[data-stat="phases-frac"]', stats.completePhases + ' / ' + stats.phases);
    setText('[data-stat="glossary-count"]', String(glossaryCount));
    setBar('[data-bar="complete"]', pct);
    setBar('[data-bar="phases"]', phasePct);
    setBar('[data-bar="languages"]', 100);
    setBar('[data-bar="glossary"]', glossaryCount > 0 ? 100 : 0);
  }

  function setText(selector, value) {
    var el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function renderPhases() {
    var grid = document.getElementById('phasesGrid');
    if (!grid) return;
    var hasProgress = !!window.AIFSProgress;
    var html = '';
    for (var i = 0; i < PHASES.length; i++) {
      var p = PHASES[i];
      var total = p.lessons.length;
      var done = 0;
      for (var j = 0; j < p.lessons.length; j++) {
        var staticDone = p.lessons[j].status === 'complete';
        var userDone = false;
        if (hasProgress && p.lessons[j].url) {
          var lp = window.AIFSProgress.extractPath(p.lessons[j].url);
          if (lp) userDone = window.AIFSProgress.isLessonComplete(lp);
        }
        if (staticDone || userDone) done++;
      }
      var statusClass = p.status.replace(/ /g, '-');
      var roman = toRoman(p.id);
      var num = String(p.id).padStart(2, '0');
      html += '<div class="toc-row" data-phase="' + i + '">';
      html += '<span class="toc-num">' + roman + '.</span>';
      html += '<div><span class="toc-status ' + statusClass + '"></span><span class="toc-name">' + escapeHtml(p.name) + '</span></div>';
      html += '<span class="toc-meta">' + done + ' / ' + total + '</span>';
      html += '<span class="toc-meta">' + num + '</span>';
      html += '</div>';
    }
    grid.innerHTML = html;

    // Re-apply per-row stagger delays for the freshly created rows.
    initStaggerIndex();

    // If the reveal observer has already initialised (body.js-anim is set),
    // the IntersectionObserver is only watching the *original* rows it was
    // given at startup. Re-rendering via innerHTML replaces those nodes with
    // brand-new elements that are NOT being observed, so they would otherwise
    // stay hidden forever under `body.js-anim .toc-row { opacity: 0 }`.
    //
    // Since the user has already seen the initial reveal animation, just mark
    // the rebuilt rows as visible immediately (no second fade-in).
    if (document.body.classList.contains('js-anim')) {
      var newRows = grid.querySelectorAll('.toc-row');
      for (var r = 0; r < newRows.length; r++) {
        newRows[r].classList.add('in-view', 'visible');
      }
    }
  }

  function toRoman(num) {
    var lookup = [
      ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
      ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
      ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]
    ];
    var n = parseInt(num, 10);
    if (isNaN(n) || n <= 0) return String(num);
    var out = '';
    for (var k = 0; k < lookup.length; k++) {
      while (n >= lookup[k][1]) {
        out += lookup[k][0];
        n -= lookup[k][1];
      }
    }
    return out;
  }

  function initModal() {
    var overlay = document.getElementById('modalOverlay');
    var closeBtn = document.getElementById('modalClose');
    if (!overlay || !closeBtn) return;

    document.addEventListener('click', function (e) {
      var row = e.target.closest('.toc-row, .phase-card');
      if (row) {
        var idx = parseInt(row.getAttribute('data-phase'), 10);
        if (!isNaN(idx)) openModal(idx);
      }
    });

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    var resetBtn = document.getElementById('modalReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (!window.AIFSProgress) return;
        var ok = window.confirm('Clear all your local progress (quiz answers and completed lessons)? This cannot be undone.');
        if (!ok) return;
        window.AIFSProgress.reset();
      });
    }
  }

  var currentPhaseIdx = -1;

  function openModal(idx) {
    var p = PHASES[idx];
    if (!p) return;
    currentPhaseIdx = idx;

    document.getElementById('modalPhaseNum').textContent = 'PHASE ' + String(p.id).padStart(2, '0');
    document.getElementById('modalTitle').textContent = p.name;
    document.getElementById('modalDesc').textContent = p.desc;

    renderModalLessons(p);

    document.getElementById('modalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function renderModalLessons(p) {
    var container = document.getElementById('modalLessons');
    if (!container) return;

    var hasProgress = !!window.AIFSProgress;
    var userDone = 0;
    var html = '';

    for (var i = 0; i < p.lessons.length; i++) {
      var l = p.lessons[i];
      var pathMatch = l.url ? l.url.match(/(phases\/[^/]+\/[^/]+)\/?$/) : null;
      var lessonPath = pathMatch ? pathMatch[1] : '';
      var userComplete = hasProgress && lessonPath && window.AIFSProgress.isLessonComplete(lessonPath);
      if (userComplete) userDone++;

      var statusClass = l.status.replace(/ /g, '-');
      if (userComplete) statusClass = 'complete';

      html += '<div class="modal-lesson' + (userComplete ? ' user-done' : '') + '">';
      html += '<span class="modal-lesson-status ' + statusClass + '"' + (userComplete ? ' title="You completed this lesson"' : '') + '></span>';
      if (l.url) {
        html += '<a href="' + l.url + '" target="_blank" rel="noopener">' + escapeHtml(l.name) + '</a>';
      } else {
        html += '<a>' + escapeHtml(l.name) + '</a>';
      }
      html += '<span class="modal-lesson-type" data-type="' + escapeHtml(l.type) + '"' + (l.combines ? ' title="Combines: ' + escapeHtml(l.combines) + '"' : '') + '>' + escapeHtml(l.type) + '</span>';
      html += '<span class="modal-lesson-lang">' + escapeHtml(l.lang) + '</span>';

      var actionHtml = '';
      if ((l.status === 'complete' || userComplete) && lessonPath) {
        actionHtml = '<a href="lesson.html?path=' + lessonPath + '" class="modal-lesson-read">' + (userComplete ? 'Review' : 'Read') + '</a>';
      }
      var toggleHtml = '';
      if (hasProgress && lessonPath) {
        toggleHtml = '<button type="button" class="modal-lesson-toggle' + (userComplete ? ' done' : '') + '" data-path="' + lessonPath + '" title="' + (userComplete ? 'Mark as not done' : 'Mark complete') + '" aria-label="' + (userComplete ? 'Mark as not done' : 'Mark complete') + '">' + (userComplete ? '✓' : '+') + '</button>';
      }
      html += (actionHtml || '<span class="modal-lesson-read-placeholder" aria-hidden="true"></span>') + toggleHtml;
      html += '</div>';
    }

    container.innerHTML = html;

    var toggles = container.querySelectorAll('.modal-lesson-toggle');
    for (var t = 0; t < toggles.length; t++) {
      toggles[t].addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var path = this.getAttribute('data-path');
        if (!path || !window.AIFSProgress) return;
        if (window.AIFSProgress.isLessonComplete(path)) {
          window.AIFSProgress.unmarkLessonComplete(path);
        } else {
          window.AIFSProgress.markLessonComplete(path);
        }
      });
    }

    var progEl = document.getElementById('modalProgress');
    var barEl = document.getElementById('modalProgressBar');
    var barFill = document.getElementById('modalProgressBarFill');
    if (hasProgress && p.lessons.length > 0) {
      var pct = Math.round((userDone / p.lessons.length) * 100);
      if (progEl) {
        progEl.style.display = '';
        progEl.innerHTML = '<span class="modal-progress-count">' + userDone + ' / ' + p.lessons.length + '</span> <span class="modal-progress-label">completed</span> <span class="modal-progress-pct">' + pct + '%</span>';
      }
      if (barEl && barFill) {
        barEl.style.display = '';
        barFill.style.width = pct + '%';
      }
    } else {
      if (progEl) progEl.style.display = 'none';
      if (barEl) barEl.style.display = 'none';
    }
  }

  if (window.AIFSProgress) {
    window.AIFSProgress.onChange(function () {
      if (currentPhaseIdx >= 0 && PHASES[currentPhaseIdx]) {
        renderModalLessons(PHASES[currentPhaseIdx]);
      }
      populateStats();
      renderPhases();
    });
  }

  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  function initCopyButton() {
    var btn = document.getElementById('copyBtn');
    var code = document.getElementById('cloneCmd');
    if (!btn || !code) return;
    var originalLabel = btn.textContent;
    var revertTimer = null;
    btn.addEventListener('click', function () {
      navigator.clipboard.writeText(code.textContent).then(function () {
        btn.textContent = '✓';
        if (revertTimer) clearTimeout(revertTimer);
        revertTimer = setTimeout(function () { btn.textContent = originalLabel; }, 1500);
      });
    });
  }

  function initMastheadFigure() {
    var figure = document.querySelector('[data-masthead-figure]');
    if (!figure) return;
    var panels = Array.prototype.slice.call(figure.querySelectorAll('.fig-panel'));
    var dots = Array.prototype.slice.call(figure.querySelectorAll('.fig-dot'));
    var previous = figure.querySelector('.fig-previous');
    var next = figure.querySelector('.fig-next');
    var controls = figure.querySelector('.fig-controls');
    var caption = figure.querySelector('.fig-caption');
    if (panels.length < 2 || dots.length !== panels.length || !previous || !next || !controls || !caption) return;

    var autoplayDelay = 6500;
    var current = Math.max(0, panels.findIndex(function (panel) { return panel.classList.contains('is-active'); }));
    var reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var desktopQuery = window.matchMedia ? window.matchMedia('(min-width: 1280px) and (hover: hover) and (pointer: fine)') : null;
    var inViewport = !window.IntersectionObserver;
    var timer = 0;
    var timerStartedAt = 0;
    var timerRemaining = autoplayDelay;
    var autoplayCancelled = !!(reducedQuery && reducedQuery.matches);
    var autoplayComplete = false;
    var disposed = false;
    var cleanups = [];

    function now() {
      return window.performance && typeof window.performance.now === 'function' ? window.performance.now() : Date.now();
    }

    function listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      cleanups.push(function () { target.removeEventListener(type, handler, options); });
    }

    function listenToQuery(query, handler) {
      if (!query) return;
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', handler);
        cleanups.push(function () { query.removeEventListener('change', handler); });
      } else if (typeof query.addListener === 'function') {
        query.addListener(handler);
        cleanups.push(function () { query.removeListener(handler); });
      }
    }

    function isDesktopView() {
      return desktopQuery ? desktopQuery.matches : figure.getClientRects().length > 0;
    }

    function isReduced() {
      return !!(reducedQuery && reducedQuery.matches);
    }

    function isOnScreen() {
      var rect = figure.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    }

    function showPlate(index, announce) {
      current = Math.max(0, Math.min(panels.length - 1, index));
      panels.forEach(function (panel, panelIndex) {
        var active = panelIndex === current;
        panel.classList.toggle('is-active', active);
        panel.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
      dots.forEach(function (dot, dotIndex) {
        var active = dotIndex === current;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      caption.setAttribute('aria-live', announce ? 'polite' : 'off');
      caption.textContent = 'Plate ' + (current + 1) + ' of ' + panels.length + '. ' + panels[current].getAttribute('data-caption');
      previous.disabled = current === 0;
      next.disabled = current === panels.length - 1;
    }

    function clearTimer(preserveRemaining) {
      if (!timer) return;
      if (preserveRemaining) {
        timerRemaining = Math.max(0, timerRemaining - (now() - timerStartedAt));
      }
      window.clearTimeout(timer);
      timer = 0;
      timerStartedAt = 0;
    }

    function canAutoplay() {
      return !autoplayCancelled && !autoplayComplete && !isReduced() && isDesktopView() && inViewport && !document.hidden && figure.getClientRects().length > 0;
    }

    function scheduleAutoplay() {
      if (timer || !canAutoplay()) return;
      if (current >= panels.length - 1) {
        autoplayComplete = true;
        figure.removeAttribute('data-autoplay');
        return;
      }
      figure.setAttribute('data-autoplay', 'true');
      timerStartedAt = now();
      timer = window.setTimeout(function () {
        timer = 0;
        timerStartedAt = 0;
        showPlate(current + 1, false);
        timerRemaining = autoplayDelay;
        if (current >= panels.length - 1) {
          autoplayComplete = true;
          figure.removeAttribute('data-autoplay');
          return;
        }
        scheduleAutoplay();
      }, Math.max(16, timerRemaining));
    }

    function cancelAutoplay() {
      clearTimer(false);
      autoplayCancelled = true;
      figure.removeAttribute('data-autoplay');
    }

    function syncRuntime() {
      if (disposed) return;
      var paused = isReduced() || !isDesktopView() || !inViewport || document.hidden || figure.getClientRects().length === 0;
      figure.setAttribute('data-motion-paused', paused ? 'true' : 'false');
      if (paused) clearTimer(true);
      else scheduleAutoplay();
    }

    function choosePlate(index) {
      cancelAutoplay();
      showPlate(index, true);
      syncRuntime();
    }

    dots.forEach(function (dot, index) {
      listen(dot, 'click', function () { choosePlate(index); });
    });
    listen(previous, 'click', function () { choosePlate(current - 1); });
    listen(next, 'click', function () { choosePlate(current + 1); });
    listen(controls, 'pointerdown', cancelAutoplay);
    listen(controls, 'keydown', cancelAutoplay);
    listen(controls, 'focusin', cancelAutoplay);
    listen(document, 'visibilitychange', syncRuntime);

    listenToQuery(reducedQuery, function () {
      if (isReduced()) cancelAutoplay();
      syncRuntime();
    });
    listenToQuery(desktopQuery, function () {
      inViewport = isOnScreen();
      syncRuntime();
    });

    if (window.IntersectionObserver) {
      var observer = new IntersectionObserver(function (entries) {
        if (!entries.length) return;
        inViewport = entries[0].isIntersecting && entries[0].intersectionRatio > 0;
        syncRuntime();
      }, { threshold: 0.12 });
      observer.observe(figure);
      cleanups.push(function () { observer.disconnect(); });
    } else {
      var checkViewport = function () {
        inViewport = isOnScreen();
        syncRuntime();
      };
      listen(window, 'scroll', checkViewport, { passive: true });
      listen(window, 'resize', checkViewport);
      checkViewport();
    }

    function cleanup() {
      if (disposed) return;
      disposed = true;
      clearTimer(false);
      while (cleanups.length) cleanups.pop()();
      figure.removeAttribute('data-autoplay');
      figure.setAttribute('data-motion-paused', 'true');
    }

    listen(window, 'pagehide', function (event) {
      if (!event.persisted) cleanup();
    });
    showPlate(current, false);
    syncRuntime();
  }

  function initFadeObserver() {
    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var visibleEls = document.querySelectorAll('.reveal, .fade-in, .ascii-rule, .toc-row');
    for (var v = 0; v < visibleEls.length; v++) {
      visibleEls[v].classList.add('in-view', 'visible');
    }

    if (!window.IntersectionObserver || prefersReduced) {
      document.querySelectorAll('.stat-row-bar').forEach(function (el) {
        el.classList.add('in-view', 'visible');
        var target = el.getAttribute('data-target-pct');
        if (target !== null) setBarScale(el, target);
      });
      return;
    }

    var els = document.querySelectorAll('.stat-row-bar');
    if (!els.length) return;
    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          var el = entries[i].target;
          el.classList.add('in-view', 'visible');
          var target = el.getAttribute('data-target-pct');
          if (target !== null) {
            setBarScale(el, target);
          }
          observer.unobserve(el);
        }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    for (var i = 0; i < els.length; i++) {
      observer.observe(els[i]);
    }
  }

  function initStaggerIndex() {
    var rows = document.querySelectorAll('.toc-list .toc-row');
    for (var i = 0; i < rows.length; i++) {
      rows[i].style.setProperty('--stagger-delay', (i * 30) + 'ms');
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }
})();
