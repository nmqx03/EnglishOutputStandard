/* ============================================================
   English Test – app.js  (no PDF viewer)
   ============================================================ */
(() => {
'use strict';

// ── STATE ────────────────────────────────────────────────────
const S = {
  exam: null,
  answers: {}, submitted: false,
  timerInterval: null, timerSeconds: 0,
};
const EXAM_DURATION = 90 * 60; // 90 minutes
const LS_KEY = (n) => `humg_v2_exam_${n}`;

// ── DOM ──────────────────────────────────────────────────────
const $  = (id) => document.getElementById(id);
const CE = (tag, attrs = {}) => Object.assign(document.createElement(tag), attrs);

const homeScreen    = $('home-screen');
const examScreen    = $('exam-screen');
const examGrid      = $('exam-grid');
const navTitle      = $('nav-title');
const answerContent = $('answer-content');
const answerStatus  = $('answer-status');
const resultPanel   = $('result-panel');
const scoreBadge    = $('score-badge');
const scoreText     = $('score-text');
const timerBadge    = $('timer-badge');
const timerText     = $('timer-text');

// ── SAVE / LOAD ───────────────────────────────────────────────
function save(scoreData) {
  try {
    localStorage.setItem(LS_KEY(S.exam), JSON.stringify({
      answers: S.answers, submitted: S.submitted,
      score: scoreData || null, ts: Date.now(),
      timerSeconds: S.timerSeconds
    }));
  } catch(e) {}
}
function loadSaved(n) {
  try { return JSON.parse(localStorage.getItem(LS_KEY(n))); } catch(e) { return null; }
}

// ── HOME ─────────────────────────────────────────────────────
function buildHome() {
  examGrid.innerHTML = '';
  for (let i = 1; i <= 20; i++) {
    const saved = loadSaved(i);
    const done     = saved?.submitted;
    const inProgress = !done && saved && Object.keys(saved.answers || {}).length > 0;
    const score = saved?.score;
    const card  = CE('div', { className: 'exam-card' + (done ? ' done' : inProgress ? ' in-progress' : '') });

    const scoreHtml = done && score
      ? (() => {
          const wrong = score.wrong ?? (score.total - score.correct);
          const cls = wrong > 7 ? 'score-lo' : wrong >= 4 ? 'score-mid' : 'score-hi';
          return `<div class="card-score ${cls}">
             <span class="score-num">${score.correct}/${score.total}</span>
             <span class="score-pct">${score.pct}%</span>
           </div>`;
        })()
      : '';

    const inProgressHtml = inProgress
      ? `<div class="card-score score-purple">
           <span class="score-num">Đang làm</span>
         </div>`
      : '';

    let timeHtml = '';
    if (done && typeof saved.timerSeconds === 'number') {
      const elapsed = EXAM_DURATION - saved.timerSeconds;
      const safeSecs = Math.max(0, elapsed);
      const m = Math.floor(safeSecs / 60);
      const s = safeSecs % 60;
      timeHtml = `<div class="card-time">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
        ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}
      </div>`;
    }

    card.innerHTML = `
      <div class="card-top">
        <div class="card-num">Đề</div>
        <div class="card-title">${i}</div>
      </div>
      <div class="card-bottom">
        ${scoreHtml}
        ${inProgressHtml}
        ${timeHtml}
      </div>
      <div class="card-arrow">→</div>`;
    card.addEventListener('click', () => showStartModal(i));
    examGrid.appendChild(card);
  }
}

// ── OPEN EXAM ────────────────────────────────────────────────
function showStartModal(num) {
  const saved = loadSaved(num);
  const hasSaved = saved && (Object.keys(saved.answers || {}).length > 0 || saved.submitted);
  $('modal-start-title').textContent = `Đề ${num}`;
  $('modal-start-icon').textContent = hasSaved ? '📂' : '📝';
  $('modal-start-desc').textContent = hasSaved
    ? (saved.submitted ? `Đã nộp bài · ${saved.score ? saved.score.correct + '/' + saved.score.total + ' câu đúng' : ''}` : 'Đang làm dở · Tiếp tục bài thi')
    : 'Thời gian: 90 phút';
  $('modal-start-confirm').textContent = '';
  $('modal-start-confirm').innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> ' + (hasSaved ? 'Tiếp tục bài thi' : 'Bắt đầu làm bài');
  // Show/hide "Làm lại" button
  const resetBtn = $('modal-start-reset');
  if (hasSaved) resetBtn.classList.remove('hidden');
  else resetBtn.classList.add('hidden');
  $('modal-start').dataset.examNum = num;
  $('modal-start').classList.remove('hidden');
}

function openExam(num) {
  S.exam = num;
  S.answers = {}; S.submitted = false;

  const saved = loadSaved(num);
  if (saved) {
    S.answers = saved.answers || {};
    S.submitted = saved.submitted || false;
    S.timerSeconds = (typeof saved.timerSeconds === 'number') ? saved.timerSeconds : EXAM_DURATION;
  } else {
    S.timerSeconds = EXAM_DURATION;
  }

  navTitle.textContent = `Đề ${num}`;
  document.title = `Đề ${num} – English Test`;

  examScreen.classList.remove('hidden');

  renderAnswerSheet();
  answerContent.scrollTop = 0;
  updateUI();
  if (S.submitted) {
    markAnswers();
    stopTimer();
    renderTimer(S.timerSeconds);
  } else {
    startTimer();
  }
}

// ── IMAGE LIGHTBOX ───────────────────────────────────────────
// makePartImgEl: creates a tappable image thumbnail.
// Clicking opens fullscreen lightbox with pinch-zoom support.
function makePartImgEl(src, alt) {
  const wrap = CE('div', { className: 'part-img-wrap' });
  const img  = CE('img',  { className: 'part-img', alt: alt || 'Ảnh đề bài' });
  loadImgWithFallback(img, wrap, src);
  // Zoom icon
  const icon = CE('div', { className: 'part-img-icon', innerHTML: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>' });
  wrap.appendChild(img);
  wrap.appendChild(icon);
  wrap.addEventListener('click', () => openLightbox(img.src));
  return wrap;
}

// renderPartImage: thin wrapper for parts with imgSrc field
function renderPartImage(part) {
  if (!part.imgSrc) return null;
  return makePartImgEl(part.imgSrc, 'Ảnh đề bài');
}

// ── LIGHTBOX ──────────────────────────────────────────────────
let lbScale = 1, lbPinchDist0 = null, lbPanX = 0, lbPanY = 0, lbDragStartX, lbDragStartY, lbPanX0, lbPanY0;

function openLightbox(src) {
  const overlay = CE('div', { className: 'lb-overlay', id: 'lb-overlay' });
  const inner   = CE('div', { className: 'lb-inner' });
  const img     = CE('img',  { className: 'lb-img', src, alt: 'Ảnh đề bài' });
  const closeBtn = CE('button', { className: 'lb-close', textContent: '✕' });

  inner.appendChild(img);
  const hint = CE('div', { className: 'lb-hint', textContent: 'Kéo 2 ngón để zoom · Vuốt để di chuyển · Esc để đóng' });
  overlay.appendChild(closeBtn);
  overlay.appendChild(inner);
  overlay.appendChild(hint);
  document.body.appendChild(overlay);

  lbScale = 1; lbPanX = 0; lbPanY = 0;

  function applyTransform() {
    img.style.transform = `scale(${lbScale}) translate(${lbPanX / lbScale}px, ${lbPanY / lbScale}px)`;
  }

  function close() { overlay.remove(); }
  closeBtn.addEventListener('click', close);
  // Click anywhere outside the image (on overlay or inner background) closes lightbox
  overlay.addEventListener('click', e => {
    if (e.target === overlay || e.target === inner) close();
  });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  });

  // ── Touch: pinch-to-zoom + drag ──
  overlay.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lbPinchDist0 = Math.hypot(dx, dy);
      lbPanX0 = lbPanX; lbPanY0 = lbPanY;
    } else if (e.touches.length === 1) {
      lbDragStartX = e.touches[0].clientX - lbPanX;
      lbDragStartY = e.touches[0].clientY - lbPanY;
    }
  }, { passive: true });

  overlay.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      lbScale = Math.max(1, Math.min(6, lbScale * dist / lbPinchDist0));
      lbPinchDist0 = dist;
      applyTransform();
    } else if (e.touches.length === 1 && lbScale > 1) {
      lbPanX = e.touches[0].clientX - lbDragStartX;
      lbPanY = e.touches[0].clientY - lbDragStartY;
      applyTransform();
    }
  }, { passive: false });

  overlay.addEventListener('touchend', e => {
    if (e.touches.length < 2) lbPinchDist0 = null;
  }, { passive: true });

  // ── Mouse: wheel zoom + drag ──
  overlay.addEventListener('wheel', e => {
    e.preventDefault();
    lbScale = Math.max(1, Math.min(6, lbScale * (e.deltaY < 0 ? 1.15 : 0.87)));
    if (lbScale === 1) { lbPanX = 0; lbPanY = 0; }
    applyTransform();
  }, { passive: false });

  let dragging = false;
  img.addEventListener('click', e => { e.stopPropagation(); });
  img.addEventListener('mousedown', e => {
    if (lbScale <= 1) return;
    dragging = true;
    lbDragStartX = e.clientX - lbPanX;
    lbDragStartY = e.clientY - lbPanY;
    img.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    lbPanX = e.clientX - lbDragStartX;
    lbPanY = e.clientY - lbDragStartY;
    applyTransform();
  });
  window.addEventListener('mouseup', () => { dragging = false; img.style.cursor = ''; });
}

// ── RENDER ANSWER SHEET ───────────────────────────────────────
function renderAnswerSheet() {
  answerContent.innerHTML = '';
  resultPanel.classList.add('hidden');

  const data = QUESTIONS[S.exam];
  if (!data) {
    answerContent.innerHTML = '<p style="color:#64748b;padding:20px;font-size:12px;text-align:center">⚠️ Chưa có dữ liệu câu hỏi cho đề này.</p>';
    return;
  }

  data.sections.forEach(sec => {
    const sh = CE('div', { className: 'sec-hdr', textContent: sec.label });
    answerContent.appendChild(sh);

    (sec.parts || []).forEach(part => {
      const blk = CE('div', { className: 'part-blk' });

      // Instruction text
      if (part.instruction) {
        blk.appendChild(CE('div', { className: 'part-inst', textContent: part.instruction }));
      }

      // ls1 special layout: instruction → audio → per-question images inside each q
      // All other parts: part image → audio → questions
      const isLs1 = (part.id === 'ls1');

      if (isLs1) {
        // ls1: audio before per-question content; images rendered inside renderMCQ per question
        if (part.audioSrc) blk.appendChild(renderAudioPlayer(part.audioSrc, part.id));
      } else {
        // form_fill and word_fill/text_fill render their own images internally → skip here
        const selfRendersImg = (part.type === 'form_fill' || part.type === 'word_fill' || part.type === 'text_fill');
        if (!selfRendersImg) {
          // Part-level image for mcq, matching, writing, ls4 form, etc.
          const imgEl = renderPartImage(part);
          if (imgEl) blk.appendChild(imgEl);
        }
        // Audio after image
        if (part.audioSrc) blk.appendChild(renderAudioPlayer(part.audioSrc, part.id));
      }

      // Questions
      switch (part.type) {
        case 'matching':   blk.appendChild(renderMatching(sec.id, part)); break;
        case 'mcq':        blk.appendChild(renderMCQ(sec.id, part)); break;
        case 'word_fill':  blk.appendChild(renderWordFill(sec.id, part)); break;
        case 'text_fill':  blk.appendChild(renderWordFill(sec.id, part)); break;
        case 'form_fill':  blk.appendChild(renderFormFill(sec.id, part)); break;
        case 'writing':    blk.appendChild(renderWriting(sec.id, part)); break;
        default:           blk.appendChild(renderMCQ(sec.id, part));
      }
      answerContent.appendChild(blk);
    });
  });

  if (Object.keys(S.answers).length) restoreAnswers();
}

// ── AUDIO PLAYER ─────────────────────────────────────────────
let activeAudioCtx = null;

function stopActiveAudio() {
  if (!activeAudioCtx) return;
  const { audio, playBtn, progressFill } = activeAudioCtx;
  audio.pause();
  playBtn.textContent = '▶';
  playBtn.classList.remove('playing');
  if (progressFill) progressFill.style.width = '0%';
  activeAudioCtx = null;
}

function renderAudioPlayer(baseSrc, partId) {
  const wrap = CE('div', { className: 'audio-player-wrap' });
  const player = CE('div', { className: 'audio-player' });

  const playBtn = CE('button', { className: 'audio-play-btn', textContent: '▶', title: 'Phát / Dừng' });
  const progWrap = CE('div', { className: 'audio-progress-wrap' });
  const progBar  = CE('div', { className: 'audio-progress-bar' });
  const progFill = CE('div', { className: 'audio-progress-fill' });
  const timeEl   = CE('span', { className: 'audio-time', textContent: '0:00 / 0:00' });
  const speedSel = CE('select', { className: 'audio-speed' });
  [['0.75×','0.75'],['1×','1'],['1.25×','1.25'],['1.5×','1.5']].forEach(([label, val]) => {
    const opt = CE('option', { value: val, textContent: label });
    if (val === '1') opt.selected = true;
    speedSel.appendChild(opt);
  });

  progBar.appendChild(progFill);
  progWrap.appendChild(progBar);
  player.append(playBtn, progWrap, timeEl, speedSel);
  wrap.appendChild(player);

  let audio = null;
  let ready = false;

  function fmt(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2,'0')}`;
  }

  function initAudio() {
    if (audio) return;
    audio = new Audio();
    audio.preload = 'metadata';
    const exts = ['.mp3', '.ogg', '.wav', '.m4a'];
    let idx = 0;
    audio.src = baseSrc + exts[idx];
    audio.onerror = () => {
      idx++;
      if (idx < exts.length) { audio.src = baseSrc + exts[idx]; }
      else {
        playBtn.disabled = true;
        playBtn.textContent = '⚠';
        playBtn.title = 'Không tìm thấy file audio';
      }
    };
    audio.addEventListener('loadedmetadata', () => {
      timeEl.textContent = `0:00 / ${fmt(audio.duration)}`;
      ready = true;
    });
    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      progFill.style.width = pct + '%';
      timeEl.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
    });
    audio.addEventListener('ended', () => {
      playBtn.textContent = '▶';
      playBtn.classList.remove('playing');
      progFill.style.width = '0%';
      if (activeAudioCtx?.audio === audio) activeAudioCtx = null;
    });
  }

  playBtn.addEventListener('click', () => {
    initAudio();
    if (!audio.paused) {
      audio.pause();
      playBtn.textContent = '▶';
      playBtn.classList.remove('playing');
      if (activeAudioCtx?.audio === audio) activeAudioCtx = null;
    } else {
      stopActiveAudio();
      audio.play().catch(() => {});
      playBtn.textContent = '⏸';
      playBtn.classList.add('playing');
      activeAudioCtx = { audio, playBtn, progressFill: progFill };
    }
  });

  progWrap.addEventListener('click', (e) => {
    initAudio();
    if (!audio.duration) return;
    const rect = progWrap.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  });

  speedSel.addEventListener('change', () => {
    initAudio();
    audio.playbackRate = parseFloat(speedSel.value);
  });

  return wrap;
}

// ── MCQ ───────────────────────────────────────────────────────
function renderMCQ(secId, part) {
  const wrap = CE('div');
  (part.questions || []).forEach(q => {
    const qk = key(secId, part.id, q.num);
    const row = CE('div', { className: 'q-row', id: `qrow_${qk}` });

    // Per-question image (ls1: N.L0105.Q shown above each question)
    if (q.qImgSrc) {
      const qImgEl = makePartImgEl(q.qImgSrc, `Câu ${q.num}`);
      qImgEl.classList.add('q-img-wrap');
      row.appendChild(qImgEl);
    }

    const stem = CE('div', { className: 'q-stem' });
    if (q.stem && !q.stem.match(/^\d+$/)) {
      stem.innerHTML = `<span class="q-num">${q.num}.</span> ${esc(q.stem)}`;
    } else {
      stem.innerHTML = `<span class="q-num">${q.num}.</span>`;
    }
    row.appendChild(stem);

    const isVertical = (part.id === 'p3');
    const ch = CE('div', { className: isVertical ? 'choices choices--vertical' : 'choices' });
    const labels = ['A','B','C'];
    (q.opts || []).forEach((opt, idx) => {
      const btn = CE('button', { className: 'cbtn', textContent: `${labels[idx]}. ${opt}` });
      btn.dataset.sec = secId; btn.dataset.part = part.id;
      btn.dataset.num = q.num; btn.dataset.val = labels[idx];
      btn.addEventListener('click', onMCQClick);
      ch.appendChild(btn);
    });
    row.appendChild(ch);
    row.appendChild(CE('div', { className: 'q-fb', id: `fb_${qk}` }));
    wrap.appendChild(row);
  });
  return wrap;
}

function onMCQClick(e) {
  if (S.submitted) return;
  const { sec, part, num, val } = e.currentTarget.dataset;
  const k = key(sec, part, num);
  // Toggle: click same answer again → deselect
  if (S.answers[k] === val) {
    delete S.answers[k];
    answerContent.querySelectorAll(`.cbtn[data-sec="${sec}"][data-part="${part}"][data-num="${num}"]`)
      .forEach(b => b.classList.remove('selected'));
  } else {
    S.answers[k] = val;
    answerContent.querySelectorAll(`.cbtn[data-sec="${sec}"][data-part="${part}"][data-num="${num}"]`)
      .forEach(b => b.classList.toggle('selected', b.dataset.val === val));
  }
  updateAnswerStatus();
  save();
}

// ── MATCHING ──────────────────────────────────────────────────
// p1 (RW Q1-5): image-based → show only letter buttons A-H, no text
// ls2 (Listening Q6-10): show text options as letter buttons
// others: keep original select dropdown
function renderMatching(secId, part) {
  const wrap = CE('div');
  const isP1   = (part.id === 'p1');   // RW Q1-5: ảnh đã có, chỉ cần chọn chữ
  const isLs2  = (part.id === 'ls2');  // Listening Q6-10: hiện text + chọn chữ

  if (isP1 || isLs2) {
    const opts = part.options || [];
    const questions = part.questions || [];

    if (isLs2) {
      // ── 2-column table: left=questions(people/times), right=options(clothes/activities) ──
      // Extract column titles from instruction: "Match X with their Y."
      const inst = part.instruction || '';
      const mTitle = inst.match(/Match (.+?) with (?:their )?(.+?)\.?$/i);
      const col1Title = mTitle ? mTitle[1].trim() : 'Câu hỏi';
      const col2Title = mTitle ? mTitle[2].trim() : 'Đáp án';

      const table = CE('div', { className: 'ls2-table' });

      // Left column: questions + per-question button rows (ABCD / EFGH)
      const leftCol = CE('div', { className: 'ls2-col ls2-col--left' });
      leftCol.appendChild(CE('div', { className: 'ls2-col-hdr', textContent: col1Title }));
      questions.forEach(item => {
        const k = key(secId, part.id, item.num);
        const cell = CE('div', { className: 'ls2-cell ls2-cell--with-btns' });
        // Question text row
        const row = CE('div', { className: 'ls2-row' });
        row.innerHTML = `<span class="ls2-q-num">${item.num}.</span><span class="ls2-q-text">${esc(item.text || '')}</span>`;
        cell.appendChild(row);
        // Button grid: 4 per row
        const btnGrid = CE('div', { className: 'ls2-btn-grid' });
        opts.forEach(o => {
          const btn = CE('button', { className: 'match-lbtn', textContent: o.id });
          btn.dataset.sec = secId; btn.dataset.part = part.id;
          btn.dataset.num = item.num; btn.dataset.val = o.id;
          btn.addEventListener('click', onMatchBtnClick);
          btnGrid.appendChild(btn);
        });
        cell.appendChild(btnGrid);
        cell.appendChild(CE('div', { className: 'q-fb', id: `fb_${k}` }));
        leftCol.appendChild(cell);
      });

      // Right column: options A–H list
      const rightCol = CE('div', { className: 'ls2-col ls2-col--right' });
      rightCol.appendChild(CE('div', { className: 'ls2-col-hdr', textContent: col2Title }));
      opts.forEach(o => {
        const item = CE('div', { className: 'ls2-opt-item' });
        item.innerHTML = `<span class="match-opt-letter">${o.id}</span><span class="ls2-opt-text">${esc(o.text)}</span>`;
        rightCol.appendChild(item);
      });

      table.appendChild(leftCol);
      table.appendChild(rightCol);
      wrap.appendChild(table);
      return wrap;
    }

    // p1: show letter options list + per-question letter buttons
    if (isP1 && opts.length) {
      const optList = CE('div', { className: 'match-opt-list match-opt-list--letters' });
      opts.forEach(o => {
        const item = CE('div', { className: 'match-opt-item' });
        item.innerHTML = `<span class="match-opt-letter">${o.id}</span>`;
        optList.appendChild(item);
      });
      wrap.appendChild(optList);
    }

    // Questions row: number + letter buttons
    questions.forEach(item => {
      const k = key(secId, part.id, item.num);
      const div = CE('div', { className: 'match-q match-q--btn' });
      const numSpan = CE('span', { className: 'match-q-num', textContent: `${item.num}.` });
      div.appendChild(numSpan);
      const btnRow = CE('div', { className: 'match-btn-row' });
      opts.forEach(o => {
        const btn = CE('button', { className: 'match-lbtn', textContent: o.id });
        btn.dataset.sec = secId; btn.dataset.part = part.id;
        btn.dataset.num = item.num; btn.dataset.val = o.id;
        btn.addEventListener('click', onMatchBtnClick);
        btnRow.appendChild(btn);
      });
      div.appendChild(btnRow);
      div.appendChild(CE('div', { className: 'q-fb', id: `fb_${k}` }));
      wrap.appendChild(div);
    });

    return wrap;
  }

  // Default: select dropdown
  const optsHtml = ['<option value="">-- Chọn --</option>',
    ...(part.options || []).map(o => `<option value="${o.id}">${o.id} – ${esc(o.text)}</option>`)
  ].join('');

  (part.questions || []).forEach(item => {
    const k = key(secId, part.id, item.num);
    const div = CE('div', { className: 'match-q' });
    const txt = CE('div', { className: 'match-txt' });
    txt.innerHTML = `<span class="q-num">${item.num}.</span> ${esc(item.text || '')}`;
    div.appendChild(txt);

    const sel = CE('select', { className: 'match-sel', id: `sel_${k}` });
    sel.innerHTML = optsHtml;
    sel.dataset.sec = secId; sel.dataset.part = part.id; sel.dataset.num = item.num;
    sel.addEventListener('change', onMatchChange);
    div.appendChild(sel);
    div.appendChild(CE('div', { className: 'q-fb', id: `fb_${k}` }));
    wrap.appendChild(div);
  });
  return wrap;
}

function onMatchBtnClick(e) {
  if (S.submitted) return;
  const { sec, part, num, val } = e.currentTarget.dataset;
  const k = key(sec, part, num);
  // Toggle deselect
  if (S.answers[k] === val) {
    delete S.answers[k];
    answerContent.querySelectorAll(`.match-lbtn[data-sec="${sec}"][data-part="${part}"][data-num="${num}"]`)
      .forEach(b => b.classList.remove('selected'));
  } else {
    S.answers[k] = val;
    answerContent.querySelectorAll(`.match-lbtn[data-sec="${sec}"][data-part="${part}"][data-num="${num}"]`)
      .forEach(b => b.classList.toggle('selected', b.dataset.val === val));
  }
  updateAnswerStatus();
  save();
}

function onMatchChange(e) {
  if (S.submitted) return;
  const { sec, part, num } = e.target.dataset;
  S.answers[key(sec, part, num)] = e.target.value;
  updateAnswerStatus();
  save();
}

// ── WORD FILL / TEXT FILL ────────────────────────────────────
function renderWordFill(secId, part) {
  const wrap = CE('div');
  const questions = part.questions || [];
  const examNum = S.exam;

  if (part.groups && part.groups.length) {
    part.groups.forEach(grp => {
      const grpWrap = CE('div', { className: 'fill-group' });
      // Build label from actual question numbers in this group
      const grpNums2 = grp.nums || [];
      const grpLabel = grpNums2.length
        ? `Questions ${grpNums2[0]}–${grpNums2[grpNums2.length - 1]}`
        : grp.label;
      if (grpLabel) {
        grpWrap.appendChild(CE('div', { className: 'fill-group-label', textContent: grpLabel }));
      }

      // Group-level image → unified clickable part image
      if (grp.imgSrc) {
        const imgEl = makePartImgEl(grp.imgSrc, `Đề ${examNum}`);
        grpWrap.appendChild(imgEl);
      }

      const grpNums = new Set(grp.nums);
      questions.filter(q => grpNums.has(q.num)).forEach(q => {
        grpWrap.appendChild(buildFillRow(secId, part, q));
      });
      wrap.appendChild(grpWrap);
    });
  } else {
    questions.forEach(q => wrap.appendChild(buildFillRow(secId, part, q)));
  }
  return wrap;
}

function loadImgWithFallback(img, wrap, baseSrc) {
  const hasExt = /\.(jpg|jpeg|png|gif|webp)$/i.test(baseSrc);
  if (hasExt) { img.src = baseSrc; return; }
  const exts = ['.png', '.jpg', '.jpeg'];
  let idx = 0;
  img.src = baseSrc + exts[idx];
  img.onerror = () => {
    idx++;
    if (idx < exts.length) { img.src = baseSrc + exts[idx]; }
    else { wrap.classList.add('fill-img-missing'); wrap.innerHTML = `<span class="fill-img-placeholder">📷 ${baseSrc}</span>`; }
  };
}

// Returns the primary answer string
function getPrimaryAns(ans) {
  return (Array.isArray(ans) ? ans[0] : ans) || '';
}

function buildFillRow(secId, part, q) {
  const k = key(secId, part.id, q.num);
  const row = CE('div', { className: 'fill-row', id: `qrow_${k}` });

  const hasStem = q.stem && !q.stem.match(/^\(Xem/) && !(q.num >= 41 && q.num <= 50);
  if (hasStem) {
    const stem = CE('div', { className: 'q-stem' });
    stem.innerHTML = `<span class="q-num">${q.num}.</span> ${esc(q.stem)}${q.hint ? `<span class="fill-hint"> (${esc(q.hint)})</span>` : ''}`;
    row.appendChild(stem);
  }

  const inpRow = CE('div', { className: 'fill-inp-row' });
  // Always show question number before input
  inpRow.appendChild(CE('span', { className: 'fill-num-badge', textContent: `${q.num}.` }));
  const inp = CE('input', { className: 'fill-inp', type: 'text', placeholder: 'Nhập từ...', id: `inp_${k}`, autocomplete: 'off' });
  inp.dataset.sec = secId; inp.dataset.part = part.id; inp.dataset.num = q.num;
  inp.addEventListener('input', onFillInput);
  inpRow.appendChild(inp);
  // Q36-40 only: show first letter + blanks for remaining letters
  if (q.num >= 36 && q.num <= 40) {
    const primary = getPrimaryAns(q.ans);
    if (primary.length > 0) {
      const first = primary[0].toUpperCase();
      const rest  = primary.length - 1;
      const hint  = CE('span', { className: 'fill-letter-hint' });
      hint.innerHTML =
        `<span class="fill-first">${first}</span>` +
        (rest > 0 ? `<span class="fill-blanks">${'_ '.repeat(rest).trim()}</span>` : '') +
        `<span class="fill-count">(${primary.length} chữ cái)</span>`;
      inpRow.appendChild(hint);
    }
  }
  row.appendChild(inpRow);
  row.appendChild(CE('div', { className: 'q-fb', id: `fb_${k}` }));
  return row;
}

// ── FORM FILL ─────────────────────────────────────────────────
function renderFormFill(secId, part) {
  const wrap = CE('div');
  const examNum = S.exam;
  const grp = CE('div', { className: 'fill-group' });

  const formQs = part.questions || [];
  const formLabel = formQs.length
    ? `Questions ${formQs[0].num}–${formQs[formQs.length - 1].num}`
    : (part.form_title || 'Questions');
  grp.appendChild(CE('div', { className: 'fill-group-label', textContent: formLabel }));

  // Form image (part.imgSrc) → unified clickable part image
  if (part.imgSrc) {
    grp.appendChild(makePartImgEl(part.imgSrc, `Form đề ${examNum}`));
  }

  (part.questions || []).forEach(q => {
    const k = key(secId, part.id, q.num);
    const row = CE('div', { className: 'fill-row form-fill-row', id: `qrow_${k}` });

    const lbl = CE('div', { className: 'form-fill-label' });
    lbl.innerHTML = `<span class="q-num">${q.num}.</span> ${esc(q.label || '')}`;
    row.appendChild(lbl);

    const fw = CE('div', { className: 'fill-wrap' });
    if (q.prefix) fw.appendChild(CE('span', { className: 'fill-pre', textContent: q.prefix }));
    const inp = CE('input', { className: 'fill-inp', type: 'text', placeholder: '...', id: `inp_${k}`, autocomplete: 'off' });
    inp.dataset.sec = secId; inp.dataset.part = part.id; inp.dataset.num = q.num;
    inp.addEventListener('input', onFillInput);
    fw.appendChild(inp);
    if (q.suffix) fw.appendChild(CE('span', { className: 'fill-suf', textContent: q.suffix }));

    row.appendChild(fw);
    row.appendChild(CE('div', { className: 'q-fb', id: `fb_${k}` }));
    grp.appendChild(row);
  });

  wrap.appendChild(grp);
  return wrap;
}

function onFillInput(e) {
  const { sec, part, num } = e.target.dataset;
  S.answers[key(sec, part, num)] = e.target.value.trim();
  updateAnswerStatus();
  save();
}

// ── WRITING ───────────────────────────────────────────────────
function renderWriting(secId, part) {
  const wrap = CE('div');
  (part.questions || []).forEach(q => {
    const k = key(secId, part.id, q.num);
    const blk = CE('div', { className: 'write-blk' });
    blk.appendChild(CE('div', { className: 'write-inst', innerHTML: `<span class="q-num">${q.num}.</span> ${esc(q.instruction || '')}` }));
    const ta = CE('textarea', { className: 'write-ta', placeholder: 'Viết câu trả lời tại đây...', id: `inp_${k}` });
    ta.dataset.sec = secId; ta.dataset.part = part.id; ta.dataset.num = q.num;
    const wc = CE('div', { className: 'wc', textContent: '0 từ', id: `wc_${k}` });
    ta.addEventListener('input', () => {
      const words = ta.value.trim().split(/\s+/).filter(Boolean).length;
      wc.textContent = `${words} từ`;
      S.answers[k] = ta.value;
      save();
    });
    blk.appendChild(ta); blk.appendChild(wc);
    wrap.appendChild(blk);
  });
  return wrap;
}

// ── RESTORE SAVED ANSWERS ─────────────────────────────────────
function restoreAnswers() {
  Object.entries(S.answers).forEach(([k, val]) => {
    if (!val) return;
    const [secId, partId, num] = k.split('_');
    const btn = answerContent.querySelector(`.cbtn[data-sec="${secId}"][data-part="${partId}"][data-num="${num}"][data-val="${val}"]`);
    if (btn) {
      answerContent.querySelectorAll(`.cbtn[data-sec="${secId}"][data-part="${partId}"][data-num="${num}"]`)
        .forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      return;
    }
    const lbtn = answerContent.querySelector(`.match-lbtn[data-sec="${secId}"][data-part="${partId}"][data-num="${num}"][data-val="${val}"]`);
    if (lbtn) {
      answerContent.querySelectorAll(`.match-lbtn[data-sec="${secId}"][data-part="${partId}"][data-num="${num}"]`)
        .forEach(b => b.classList.remove('selected'));
      lbtn.classList.add('selected');
      return;
    }
    const sel = $(`sel_${k}`);
    if (sel) { sel.value = val; return; }
    const inp = $(`inp_${k}`);
    if (inp) {
      inp.value = val;
      if (inp.tagName === 'TEXTAREA') {
        const wc = $(`wc_${k}`);
        if (wc) wc.textContent = val.trim().split(/\s+/).filter(Boolean).length + ' từ';
      }
    }
  });
}

// ── COUNT ANSWERS ─────────────────────────────────────────────
function countAnswers() {
  const data = QUESTIONS[S.exam];
  if (!data) return { total: 0, done: 0 };
  let total = 0, done = 0;
  data.sections.forEach(sec => {
    (sec.parts || []).forEach(part => {
      if (part.type === 'writing') return;
      (part.questions || []).forEach(q => {
        total++;
        const k = key(sec.id, part.id, q.num);
        if (S.answers[k]) done++;
      });
    });
  });
  return { total, done };
}

function updateAnswerStatus() {
  const { total, done } = countAnswers();
  answerStatus.textContent = `${done}/${total}`;
  answerStatus.style.color = done === total ? '#22c55e' : '#94a3b8';
  $('unanswered-count').textContent = total - done;
}

function updateUI() {
  $('btn-submit').style.display = S.submitted ? 'none' : '';
  scoreBadge.classList.toggle('hidden', !S.submitted);
  updateAnswerStatus();
}

// ── MARK ANSWERS ──────────────────────────────────────────────
function markAnswers() {
  const data = QUESTIONS[S.exam];
  if (!data) return;

  answerContent.querySelectorAll('.cbtn, .match-lbtn, .match-sel, input, textarea')
    .forEach(el => { el.disabled = true; });

  data.sections.forEach(sec => {
    (sec.parts || []).forEach(part => {
      if (part.type === 'writing') return;

      if (part.type === 'matching') {
        const correctMap = part.answers || {};
        const isBtn = (part.id === 'p1' || part.id === 'ls2');
        (part.questions || []).forEach(item => {
          const k = key(sec.id, part.id, item.num);
          const correct = String(correctMap[item.num] || '');
          const user = S.answers[k] || '';
          const fb = $(`fb_${k}`);
          if (!correct) return;
          if (isBtn) {
            answerContent.querySelectorAll(`.match-lbtn[data-sec="${sec.id}"][data-part="${part.id}"][data-num="${item.num}"]`)
              .forEach(b => {
                if (b.dataset.val === correct) b.classList.add('lbtn-correct');
                else if (b.dataset.val === user && user !== correct) b.classList.add('lbtn-wrong');
              });
          } else {
            const sel = $(`sel_${k}`);
            if (sel) sel.classList.add(user === correct ? 'correct-fill' : 'wrong-fill');
          }
          if (fb) {
            fb.className = 'q-fb ' + (user === correct ? 'ok' : 'bad');
            fb.textContent = user === correct ? '✓ Đúng' : `✗ Đáp án: ${correct}`;
          }
        });
        return;
      }

      (part.questions || []).forEach(q => {
        const k = key(sec.id, part.id, q.num);
        const fb = $(`fb_${k}`);

        if (part.type === 'mcq') {
          const correct = (q.ans || '').toUpperCase().trim();
          const user = (S.answers[k] || '').toUpperCase().trim();
          answerContent.querySelectorAll(`.cbtn[data-sec="${sec.id}"][data-part="${part.id}"][data-num="${q.num}"]`)
            .forEach(btn => {
              if (btn.dataset.val === correct && correct) btn.classList.add('correct');
              if (btn.dataset.val === user && user !== correct) btn.classList.add('wrong-sel');
            });
          if (fb && correct) {
            fb.className = 'q-fb ' + (user === correct ? 'ok' : 'bad');
            fb.textContent = user === correct ? '✓ Đúng' : `✗ Đáp án: ${correct}`;
          }
        } else if (part.type === 'word_fill' || part.type === 'text_fill' || part.type === 'form_fill') {
          const inp = $(`inp_${k}`);
          const userLow = (S.answers[k] || '').toLowerCase().trim();
          const accepted = Array.isArray(q.ans)
            ? q.ans.map(a => a.toLowerCase().trim())
            : [(q.ans || '').toLowerCase().trim()];
          if (q.alts) [].concat(q.alts).forEach(a => accepted.push(a.toLowerCase().trim()));
          const isOk = userLow !== '' && accepted.some(a => a && userLow === a);
          const displayAns = Array.isArray(q.ans) ? q.ans.join(' / ') : q.ans;
          const hasAns = Array.isArray(q.ans) ? q.ans.length > 0 : !!q.ans;
          if (inp && hasAns) inp.classList.add(isOk ? 'correct-fill' : 'wrong-fill');
          if (fb && hasAns) {
            fb.className = 'q-fb ' + (isOk ? 'ok' : 'bad');
            fb.textContent = isOk ? '✓ Đúng' : `✗ Đáp án: ${displayAns}`;
          }
        }
      });
    });
  });
}

// ── SHOW RESULTS ──────────────────────────────────────────────
function showResults() {
  const data = QUESTIONS[S.exam];
  if (!data) return;
  let correct = 0, wrong = 0, skip = 0;

  // Per-section counters
  const nghe = { correct: 0, total: 0 };
  const doc  = { correct: 0, total: 0 }; // q.num 1-35
  const viet = { correct: 0, total: 0 }; // q.num 36-55

  function isNghe(secId) {
    const s = (secId || '').toLowerCase();
    return s.includes('ls') || s.includes('listen') || s.includes('nghe');
  }

  function scoreQ(q, secId, partId, bucket) {
    const user = (S.answers[key(secId, partId, q.num)] || '').toLowerCase().trim();
    const accepted = Array.isArray(q.ans)
      ? q.ans.map(a => a.toLowerCase().trim())
      : [(q.ans || '').toLowerCase().trim()];
    if (q.alts) [].concat(q.alts).forEach(a => accepted.push(a.toLowerCase().trim()));
    const hasAns = accepted.some(a => a.length > 0);
    if (!hasAns) return;
    bucket.total++;
    if (!user) { skip++; }
    else if (accepted.some(a => a && user === a)) { correct++; bucket.correct++; }
    else { wrong++; }
  }

  data.sections.forEach(sec => {
    (sec.parts || []).forEach(part => {
      if (part.type === 'writing') return;

      if (part.type === 'matching') {
        const correctMap = part.answers || {};
        (part.questions || []).forEach(item => {
          const k = key(sec.id, part.id, item.num);
          const ans = String(correctMap[item.num] || '').trim();
          const user = (S.answers[k] || '').trim();
          if (!ans) return;
          const bucket = isNghe(sec.id) ? nghe : (item.num <= 35 ? doc : viet);
          bucket.total++;
          if (!user) skip++;
          else if (user === ans) { correct++; bucket.correct++; }
          else wrong++;
        });
        return;
      }

      (part.questions || []).forEach(q => {
        const bucket = isNghe(sec.id) ? nghe : (q.num <= 35 ? doc : viet);
        scoreQ(q, sec.id, part.id, bucket);
      });
    });
  });

  const total = correct + wrong + skip;
  const pct = total ? Math.round(correct / total * 100) : 0;

  $('res-correct').textContent = correct;
  $('res-wrong').textContent = wrong;
  $('res-skip').textContent = skip;
  $('result-pct').textContent = pct + '%';
  scoreText.textContent = `${correct}/${total}`;
  scoreBadge.classList.remove('hidden');

  // Inject section breakdown block if not yet present
  if (!$('res-section-nghe')) {
    const breakdown = CE('div', { id: 'res-section-breakdown' });
    breakdown.style.cssText = 'margin:12px 0 4px;display:flex;flex-direction:column;gap:7px;';
    const rows = [
      { id: 'res-section-nghe', label: 'Phần Nghe' },
      { id: 'res-section-doc',  label: 'Phần Đọc (câu 1-35)' },
      { id: 'res-section-viet', label: 'Phần Viết (câu 36-55)' },
    ];
    rows.forEach(({ id, label }) => {
      const row = CE('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:6px 10px;background:var(--card,#f8fafc);border-radius:8px;';
      const lbl = CE('span', { textContent: label });
      lbl.style.cssText = 'color:var(--text-2,#64748b);font-weight:500;';
      const val = CE('span', { id });
      val.style.cssText = 'font-weight:700;color:var(--text-1,#1e293b);';
      row.appendChild(lbl); row.appendChild(val);
      breakdown.appendChild(row);
    });
    const anchor = $('res-correct') ? $('res-correct').closest('div') : null;
    if (anchor && anchor.parentNode === resultPanel) anchor.insertAdjacentElement('afterend', breakdown);
    else resultPanel.insertBefore(breakdown, resultPanel.firstChild);
  }

  // Update section breakdown
  const elNghe = $('res-section-nghe');
  const elDoc  = $('res-section-doc');
  const elViet = $('res-section-viet');
  if (elNghe) elNghe.textContent = `${nghe.correct}/${nghe.total} câu`;
  if (elDoc)  elDoc.textContent  = `${doc.correct}/${doc.total} câu`;
  if (elViet) elViet.textContent = `${viet.correct}/${viet.total} câu`;

  const arc = $('result-arc');
  if (arc) {
    setTimeout(() => { arc.style.strokeDashoffset = 314 - (314 * pct / 100); }, 80);
    arc.style.stroke = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
  }
  resultPanel.classList.remove('hidden');
  answerContent.scrollTop = 0;
  return { correct, wrong, skip, total, pct };
}

// ── RESET ─────────────────────────────────────────────────────
function resetExam() {
  S.answers = {}; S.submitted = false;
  S.timerSeconds = EXAM_DURATION;
  save();
  answerContent.querySelectorAll('.cbtn').forEach(b => { b.disabled = false; b.classList.remove('selected','correct','wrong-sel'); });
  answerContent.querySelectorAll('.match-lbtn').forEach(b => { b.disabled = false; b.classList.remove('selected','lbtn-correct','lbtn-wrong'); });
  answerContent.querySelectorAll('.match-sel').forEach(s => { s.disabled = false; s.value = ''; s.classList.remove('correct-fill','wrong-fill'); });
  answerContent.querySelectorAll('input').forEach(i => { i.disabled = false; i.value = ''; i.classList.remove('correct-fill','wrong-fill'); });
  answerContent.querySelectorAll('textarea').forEach(t => { t.disabled = false; t.value = ''; });
  answerContent.querySelectorAll('.q-fb').forEach(f => { f.textContent = ''; f.className = 'q-fb'; });
  answerContent.querySelectorAll('.wc').forEach(w => { w.textContent = '0 từ'; });
  resultPanel.classList.add('hidden');
  scoreBadge.classList.add('hidden');
  answerContent.scrollTop = 0;
  startTimer();
  updateUI();
}

// ── TOAST ─────────────────────────────────────────────────────
function showToast(msg) {
  const t = CE('div', { className: 'toast', textContent: msg });
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast--show'));
  setTimeout(() => {
    t.classList.remove('toast--show');
    setTimeout(() => t.remove(), 400);
  }, 3000);
}

// ── HELPERS ───────────────────────────────────────────────────
function key(secId, partId, num) { return `${secId}_${partId}_${num}`; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── TIMER ─────────────────────────────────────────────────────
function renderTimer(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  timerText.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  timerBadge.classList.remove('warn','urgent');
  if (secs <= 60) timerBadge.classList.add('urgent');
  else if (secs <= 300) timerBadge.classList.add('warn');
}

function startTimer() {
  stopTimer();
  renderTimer(S.timerSeconds);
  if (S.submitted) return;
  S.timerInterval = setInterval(() => {
    S.timerSeconds--;
    if (S.timerSeconds < 0) S.timerSeconds = 0;
    renderTimer(S.timerSeconds);
    save();
    if (S.timerSeconds === 0) {
      stopTimer();
      // Auto-submit when time is up
      $('modal-submit').classList.add('hidden');
      S.submitted = true;
      $('btn-submit').style.display = 'none';
      markAnswers();
      const scoreData = showResults();
      save(scoreData);
      buildHome();
      showToast('⏰ Hết giờ! Bài đã được nộp tự động.');
    }
  }, 1000);
}

function stopTimer() {
  if (S.timerInterval) { clearInterval(S.timerInterval); S.timerInterval = null; }
}

// ── EVENT LISTENERS ───────────────────────────────────────────
$('btn-back').addEventListener('click', () => {
  stopActiveAudio();
  stopTimer();
  examScreen.classList.add('hidden');
  document.title = 'English Test';
  buildHome();
});

// Click dim overlay (outside popup box) also closes
examScreen.addEventListener('click', (e) => {
  if (e.target === examScreen) {
    stopActiveAudio();
    stopTimer();
    examScreen.classList.add('hidden');
    document.title = 'English Test';
    buildHome();
  }
});

$('btn-submit').addEventListener('click', () => $('modal-submit').classList.remove('hidden'));
$('modal-cancel').addEventListener('click', () => $('modal-submit').classList.add('hidden'));
$('modal-confirm').addEventListener('click', () => {
  $('modal-submit').classList.add('hidden');
  S.submitted = true;
  stopTimer();
  $('btn-submit').style.display = 'none';
  markAnswers();
  const scoreData = showResults();
  save(scoreData);
  buildHome();
  updateWrongBannerSub();
});

$('btn-reset').addEventListener('click', () => {
  if (confirm('Làm lại từ đầu? Toàn bộ đáp án sẽ bị xoá.')) resetExam();
});

$('btn-review').addEventListener('click', () => {
  resultPanel.classList.add('hidden');
  answerContent.scrollTop = 0;
});
$('btn-retry').addEventListener('click', resetExam);

document.addEventListener('keydown', e => {
  if (examScreen.classList.contains('hidden')) return;
  if (e.key === 'Escape') $('modal-submit').classList.add('hidden');
});

// ══════════════════════════════════════════════════════════════
// PRACTICE MODE
// ══════════════════════════════════════════════════════════════

const PRAC = {
  section: 'doc',       // 'doc' | 'nghe'
  group: null,          // { from, to } e.g. { from:1, to:5 }
  answers: {},
  submitted: false,
  questions: [],        // flat list of { examNum, secId, part, q }
};

// ── FIXED question groups per section ──────────────────────────
// Reading:  1-5 | 6-10 | 11-15 | 21-27 | 28-35 | 36-40 | 41-50 | 51-55
// Listening: 1-5 | 6-10 | 11-15 | 16-20 | 21-25
const PRAC_GROUPS = {
  doc:  [
    { from:  1, to:  5,  label: 'Câu 1–5'   },
    { from:  6, to: 10,  label: 'Câu 6–10'  },
    { from: 11, to: 15,  label: 'Câu 11–15' },
    { from: 21, to: 27,  label: 'Câu 21–27' },
    { from: 28, to: 35,  label: 'Câu 28–35' },
    { from: 36, to: 40,  label: 'Câu 36–40' },
    { from: 41, to: 50,  label: 'Câu 41–50' },
    { from: 51, to: 55,  label: 'Câu 51–55' },
  ],
  nghe: [
    { from:  1, to:  5,  label: 'Câu 1–5'   },
    { from:  6, to: 10,  label: 'Câu 6–10'  },
    { from: 11, to: 15,  label: 'Câu 11–15' },
    { from: 16, to: 20,  label: 'Câu 16–20' },
    { from: 21, to: 25,  label: 'Câu 21–25' },
  ],
};

function getPracGroups(section) {
  return PRAC_GROUPS[section] || [];
}

function buildPracGroupGrid() {
  const grid = $('prac-group-grid');
  grid.innerHTML = '';
  PRAC.group = null;
  updatePracStartBtn();
  const groups = getPracGroups(PRAC.section);
  groups.forEach(g => {
    const btn = CE('button', { className: 'prac-group-btn' });
    btn.innerHTML = `<span class="prac-group-range">${g.label}</span><span class="prac-group-count">× 20 đề</span>`;
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.prac-group-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      PRAC.group = g;
      updatePracStartBtn();
    });
    grid.appendChild(btn);
  });
}

function updatePracStartBtn() {
  $('prac-start-btn').disabled = !PRAC.group;
}

function openPracticeSelector() {
  homeScreen.classList.add('hidden');
  $('practice-screen').classList.remove('hidden');
  PRAC.section = 'doc';
  PRAC.group = null;
  // Set active tab
  document.querySelectorAll('.prac-tab').forEach(t => t.classList.toggle('active', t.dataset.sec === PRAC.section));
  buildPracGroupGrid();
}

function closePracticeSelector() {
  $('practice-screen').classList.add('hidden');
  homeScreen.classList.remove('hidden');
}

// Collect all matching questions/parts from all 20 exams for the selected group
function collectPracQuestions() {
  const { section, group } = PRAC;
  const { from, to } = group;

  const isNgheSec = (id) => {
    const s = (id||'').toLowerCase();
    return s.includes('ls') || s.includes('listen') || s.includes('nghe');
  };
  const secTest = section === 'nghe' ? isNgheSec
    : (id) => !isNgheSec(id) && !id.toLowerCase().includes('writ');

  const list = [];

  for (let examNum = 1; examNum <= 20; examNum++) {
    const data = (typeof QUESTIONS !== 'undefined') ? QUESTIONS[examNum] : null;
    if (!data) continue;

    data.sections.forEach(sec => {
      if (!secTest(sec.id)) return;

      (sec.parts || []).forEach(part => {
        if (part.type === 'writing') return;

        // Filter questions that fall in [from, to]
        const qs = (part.questions || []).filter(q => q.num >= from && q.num <= to);
        if (!qs.length) return;

        // For parts with sub-groups (text_fill / word_fill with groups array),
        // figure out which sub-group images apply to the filtered questions.
        let filteredGroups = null;
        if (part.groups && part.groups.length) {
          filteredGroups = part.groups
            .map(grp => {
              const filteredNums = (grp.nums || []).filter(n => n >= from && n <= to);
              if (!filteredNums.length) return null;
              return { ...grp, nums: filteredNums };
            })
            .filter(Boolean);
        }

        const partCopy = {
          ...part,
          questions: qs,
          // Replace groups with only the relevant sub-groups (or null)
          groups: filteredGroups && filteredGroups.length ? filteredGroups : undefined,
        };

        list.push({ examNum, secId: sec.id, part: partCopy });
      });
    });
  }

  return list;
}

function pracKey(examNum, secId, partId, num) {
  return `e${examNum}_${secId}_${partId}_${num}`;
}

function startPractice() {
  PRAC.answers = {};
  PRAC.submitted = false;
  PRAC.questions = collectPracQuestions();

  if (!PRAC.questions.length) {
    showToast('⚠️ Không tìm thấy câu hỏi cho dạng này.');
    return;
  }

  const secLabel = PRAC.section === 'nghe' ? 'Phần Nghe' : 'Phần Đọc';
  $('prac-exam-title').textContent = `${secLabel} · Câu ${PRAC.group.from}–${PRAC.group.to}`;

  $('practice-screen').classList.add('hidden');
  $('prac-exam-screen').classList.remove('hidden');
  $('prac-result-panel').classList.add('hidden');
  $('prac-btn-submit').style.display = '';

  renderPracAnswerSheet();
  updatePracUI();
}

function renderPracAnswerSheet() {
  const content = $('prac-answer-content');
  content.innerHTML = '';
  $('prac-result-panel').classList.add('hidden');

  PRAC.questions.forEach((item, idx) => {
    const { examNum, secId, part } = item;

    // ── Exam source badge ──
    const badge = CE('div', { className: 'prac-exam-source' });
    badge.textContent = `📝 Đề ${examNum}`;
    content.appendChild(badge);

    // ── Instruction ──
    if (part.instruction) {
      content.appendChild(CE('div', { className: 'part-inst', textContent: part.instruction }));
    }

    const isLs1 = (part.id === 'ls1');
    const selfRendersImg = (part.type === 'form_fill' || part.type === 'word_fill' || part.type === 'text_fill');

    if (isLs1) {
      // ls1: audio first, then per-question images are rendered inside renderPracMCQ
      if (part.audioSrc) content.appendChild(renderAudioPlayer(part.audioSrc, `prac_e${examNum}_${part.id}`));
    } else {
      // Part-level image (not for self-rendering types)
      if (!selfRendersImg && part.imgSrc) {
        content.appendChild(makePartImgEl(part.imgSrc, `Đề ${examNum}`));
      }
      // Audio after image
      if (part.audioSrc) content.appendChild(renderAudioPlayer(part.audioSrc, `prac_e${examNum}_${part.id}`));
    }

    // ── Questions block ──
    let qBlock;
    switch (part.type) {
      case 'matching':  qBlock = renderPracMatching(examNum, secId, part); break;
      case 'mcq':       qBlock = renderPracMCQ(examNum, secId, part); break;
      case 'word_fill':
      case 'text_fill': qBlock = renderPracWordFill(examNum, secId, part); break;
      case 'form_fill': qBlock = renderPracFormFill(examNum, secId, part); break;
      default:          qBlock = renderPracMCQ(examNum, secId, part); break;
    }
    content.appendChild(qBlock);

    // Divider between exams (not after last)
    if (idx < PRAC.questions.length - 1) {
      content.appendChild(CE('hr', { className: 'prac-exam-divider' }));
    }
  });

  if (Object.keys(PRAC.answers).length) restorePracAnswers();
}

// ── PRAC MCQ ──
function renderPracMCQ(examNum, secId, part) {
  const wrap = CE('div');
  (part.questions || []).forEach(q => {
    const qk = pracKey(examNum, secId, part.id, q.num);
    const row = CE('div', { className: 'q-row', id: `pqrow_${qk}` });

    if (q.qImgSrc) {
      const qImgEl = makePartImgEl(q.qImgSrc, `Câu ${q.num}`);
      qImgEl.classList.add('q-img-wrap');
      row.appendChild(qImgEl);
    }

    const stem = CE('div', { className: 'q-stem' });
    stem.innerHTML = (q.stem && !q.stem.match(/^\d+$/))
      ? `<span class="q-num">${q.num}.</span> ${esc(q.stem)}`
      : `<span class="q-num">${q.num}.</span>`;
    row.appendChild(stem);

    const isVertical = (part.id === 'p3');
    const ch = CE('div', { className: isVertical ? 'choices choices--vertical' : 'choices' });
    const labels = ['A','B','C'];
    (q.opts || []).forEach((opt, idx) => {
      const btn = CE('button', { className: 'cbtn', textContent: `${labels[idx]}. ${opt}` });
      btn.dataset.examNum = examNum;
      btn.dataset.sec = secId; btn.dataset.part = part.id;
      btn.dataset.num = q.num; btn.dataset.val = labels[idx];
      btn.addEventListener('click', onPracMCQClick);
      ch.appendChild(btn);
    });
    row.appendChild(ch);
    row.appendChild(CE('div', { className: 'q-fb', id: `pfb_${qk}` }));
    wrap.appendChild(row);
  });
  return wrap;
}

function onPracMCQClick(e) {
  if (PRAC.submitted) return;
  const { examNum, sec, part, num, val } = e.currentTarget.dataset;
  const k = pracKey(examNum, sec, part, num);
  if (PRAC.answers[k] === val) {
    delete PRAC.answers[k];
    $('prac-answer-content').querySelectorAll(`.cbtn[data-exam-num="${examNum}"][data-sec="${sec}"][data-part="${part}"][data-num="${num}"]`)
      .forEach(b => b.classList.remove('selected'));
  } else {
    PRAC.answers[k] = val;
    $('prac-answer-content').querySelectorAll(`.cbtn[data-exam-num="${examNum}"][data-sec="${sec}"][data-part="${part}"][data-num="${num}"]`)
      .forEach(b => b.classList.toggle('selected', b.dataset.val === val));
  }
  updatePracUI();
}

// ── PRAC MATCHING ──
function renderPracMatching(examNum, secId, part) {
  const wrap = CE('div');
  const isP1  = (part.id === 'p1');
  const isLs2 = (part.id === 'ls2');

  if (isP1 || isLs2) {
    const opts = part.options || [];
    const questions = part.questions || [];

    if (isLs2) {
      const inst = part.instruction || '';
      const mTitle = inst.match(/Match (.+?) with (?:their )?(.+?)\.?$/i);
      const col1Title = mTitle ? mTitle[1].trim() : 'Câu hỏi';
      const col2Title = mTitle ? mTitle[2].trim() : 'Đáp án';
      const table = CE('div', { className: 'ls2-table' });
      const leftCol = CE('div', { className: 'ls2-col ls2-col--left' });
      leftCol.appendChild(CE('div', { className: 'ls2-col-hdr', textContent: col1Title }));
      questions.forEach(item => {
        const k = pracKey(examNum, secId, part.id, item.num);
        const cell = CE('div', { className: 'ls2-cell ls2-cell--with-btns' });
        const row = CE('div', { className: 'ls2-row' });
        row.innerHTML = `<span class="ls2-q-num">${item.num}.</span><span class="ls2-q-text">${esc(item.text || '')}</span>`;
        cell.appendChild(row);
        const btnGrid = CE('div', { className: 'ls2-btn-grid' });
        opts.forEach(o => {
          const btn = CE('button', { className: 'match-lbtn' });
          btn.textContent = o.id;
          btn.dataset.examNum = examNum; btn.dataset.sec = secId;
          btn.dataset.part = part.id; btn.dataset.num = item.num; btn.dataset.val = o.id;
          btn.addEventListener('click', onPracMatchBtnClick);
          btnGrid.appendChild(btn);
        });
        cell.appendChild(btnGrid);
        cell.appendChild(CE('div', { className: 'q-fb', id: `pfb_${k}` }));
        leftCol.appendChild(cell);
      });
      const rightCol = CE('div', { className: 'ls2-col ls2-col--right' });
      rightCol.appendChild(CE('div', { className: 'ls2-col-hdr', textContent: col2Title }));
      opts.forEach(o => {
        const item = CE('div', { className: 'ls2-opt-item' });
        item.innerHTML = `<span class="match-opt-letter">${o.id}</span><span class="ls2-opt-text">${esc(o.text)}</span>`;
        rightCol.appendChild(item);
      });
      table.appendChild(leftCol); table.appendChild(rightCol);
      wrap.appendChild(table);
      return wrap;
    }

    if (isP1 && opts.length) {
      const optList = CE('div', { className: 'match-opt-list match-opt-list--letters' });
      opts.forEach(o => {
        const item = CE('div', { className: 'match-opt-item' });
        item.innerHTML = `<span class="match-opt-letter">${o.id}</span>`;
        optList.appendChild(item);
      });
      wrap.appendChild(optList);
    }
    questions.forEach(item => {
      const k = pracKey(examNum, secId, part.id, item.num);
      const div = CE('div', { className: 'match-q match-q--btn' });
      div.appendChild(CE('span', { className: 'match-q-num', textContent: `${item.num}.` }));
      const btnRow = CE('div', { className: 'match-btn-row' });
      opts.forEach(o => {
        const btn = CE('button', { className: 'match-lbtn', textContent: o.id });
        btn.dataset.examNum = examNum; btn.dataset.sec = secId;
        btn.dataset.part = part.id; btn.dataset.num = item.num; btn.dataset.val = o.id;
        btn.addEventListener('click', onPracMatchBtnClick);
        btnRow.appendChild(btn);
      });
      div.appendChild(btnRow);
      div.appendChild(CE('div', { className: 'q-fb', id: `pfb_${k}` }));
      wrap.appendChild(div);
    });
    return wrap;
  }

  // Default: select
  const optsHtml = ['<option value="">-- Chọn --</option>',
    ...(part.options || []).map(o => `<option value="${o.id}">${o.id} – ${esc(o.text)}</option>`)
  ].join('');
  (part.questions || []).forEach(item => {
    const k = pracKey(examNum, secId, part.id, item.num);
    const div = CE('div', { className: 'match-q' });
    const txt = CE('div', { className: 'match-txt' });
    txt.innerHTML = `<span class="q-num">${item.num}.</span> ${esc(item.text || '')}`;
    div.appendChild(txt);
    const sel = CE('select', { className: 'match-sel', id: `psel_${k}` });
    sel.innerHTML = optsHtml;
    sel.dataset.examNum = examNum; sel.dataset.sec = secId;
    sel.dataset.part = part.id; sel.dataset.num = item.num;
    sel.addEventListener('change', onPracMatchChange);
    div.appendChild(sel);
    div.appendChild(CE('div', { className: 'q-fb', id: `pfb_${k}` }));
    wrap.appendChild(div);
  });
  return wrap;
}

function onPracMatchBtnClick(e) {
  if (PRAC.submitted) return;
  const { examNum, sec, part, num, val } = e.currentTarget.dataset;
  const k = pracKey(examNum, sec, part, num);
  if (PRAC.answers[k] === val) {
    delete PRAC.answers[k];
    $('prac-answer-content').querySelectorAll(`.match-lbtn[data-exam-num="${examNum}"][data-sec="${sec}"][data-part="${part}"][data-num="${num}"]`)
      .forEach(b => b.classList.remove('selected'));
  } else {
    PRAC.answers[k] = val;
    $('prac-answer-content').querySelectorAll(`.match-lbtn[data-exam-num="${examNum}"][data-sec="${sec}"][data-part="${part}"][data-num="${num}"]`)
      .forEach(b => b.classList.toggle('selected', b.dataset.val === val));
  }
  updatePracUI();
}

function onPracMatchChange(e) {
  if (PRAC.submitted) return;
  const { examNum, sec, part, num } = e.target.dataset;
  PRAC.answers[pracKey(examNum, sec, part, num)] = e.target.value;
  updatePracUI();
}

// ── PRAC WORD FILL ──
function renderPracWordFill(examNum, secId, part) {
  const wrap = CE('div');
  const questions = part.questions || [];

  if (part.groups && part.groups.length) {
    part.groups.forEach(grp => {
      const grpNums = new Set(grp.nums);
      const grpQs = questions.filter(q => grpNums.has(q.num));
      if (!grpQs.length) return;
      const grpWrap = CE('div', { className: 'fill-group' });
      // Sub-group image
      if (grp.imgSrc) grpWrap.appendChild(makePartImgEl(grp.imgSrc, `Đề ${examNum}`));
      grpQs.forEach(q => grpWrap.appendChild(buildPracFillRow(examNum, secId, part, q)));
      wrap.appendChild(grpWrap);
    });
  } else {
    // No sub-groups — part-level image already rendered above
    questions.forEach(q => wrap.appendChild(buildPracFillRow(examNum, secId, part, q)));
  }
  return wrap;
}

function renderPracFormFill(examNum, secId, part) {
  const wrap = CE('div');
  const grp = CE('div', { className: 'fill-group' });
  if (part.imgSrc) grp.appendChild(makePartImgEl(part.imgSrc, `Đề ${examNum}`));
  (part.questions || []).forEach(q => {
    const k = pracKey(examNum, secId, part.id, q.num);
    const row = CE('div', { className: 'fill-row form-fill-row', id: `pqrow_${k}` });
    const lbl = CE('div', { className: 'form-fill-label' });
    lbl.innerHTML = `<span class="q-num">${q.num}.</span> ${esc(q.label || '')}`;
    row.appendChild(lbl);
    const fw = CE('div', { className: 'fill-wrap' });
    if (q.prefix) fw.appendChild(CE('span', { className: 'fill-pre', textContent: q.prefix }));
    const inp = CE('input', { className: 'fill-inp', type: 'text', placeholder: '...', id: `pinp_${k}`, autocomplete: 'off' });
    inp.dataset.examNum = examNum; inp.dataset.sec = secId; inp.dataset.part = part.id; inp.dataset.num = q.num;
    inp.addEventListener('input', onPracFillInput);
    fw.appendChild(inp);
    if (q.suffix) fw.appendChild(CE('span', { className: 'fill-suf', textContent: q.suffix }));
    row.appendChild(fw);
    row.appendChild(CE('div', { className: 'q-fb', id: `pfb_${k}` }));
    grp.appendChild(row);
  });
  wrap.appendChild(grp);
  return wrap;
}

function buildPracFillRow(examNum, secId, part, q) {
  const k = pracKey(examNum, secId, part.id, q.num);
  const row = CE('div', { className: 'fill-row', id: `pqrow_${k}` });
  const hasStem = q.stem && !q.stem.match(/^\(Xem/);
  if (hasStem) {
    const stem = CE('div', { className: 'q-stem' });
    stem.innerHTML = `<span class="q-num">${q.num}.</span> ${esc(q.stem)}${q.hint ? `<span class="fill-hint"> (${esc(q.hint)})</span>` : ''}`;
    row.appendChild(stem);
  }
  const inpRow = CE('div', { className: 'fill-inp-row' });
  inpRow.appendChild(CE('span', { className: 'fill-num-badge', textContent: `${q.num}.` }));
  const inp = CE('input', { className: 'fill-inp', type: 'text', placeholder: 'Nhập từ...', id: `pinp_${k}`, autocomplete: 'off' });
  inp.dataset.examNum = examNum; inp.dataset.sec = secId; inp.dataset.part = part.id; inp.dataset.num = q.num;
  inp.addEventListener('input', onPracFillInput);
  inpRow.appendChild(inp);
  row.appendChild(inpRow);
  row.appendChild(CE('div', { className: 'q-fb', id: `pfb_${k}` }));
  return row;
}

function onPracFillInput(e) {
  const { examNum, sec, part, num } = e.target.dataset;
  PRAC.answers[pracKey(examNum, sec, part, num)] = e.target.value.trim();
  updatePracUI();
}

// ── PRAC RESTORE ──
function restorePracAnswers() {
  const content = $('prac-answer-content');
  Object.entries(PRAC.answers).forEach(([k, val]) => {
    if (!val) return;
    const parts = k.split('_'); // e1_secId_partId_num
    const [epart, secId, partId, num] = parts;
    const examNum = epart.slice(1);
    const btn = content.querySelector(`.cbtn[data-exam-num="${examNum}"][data-sec="${secId}"][data-part="${partId}"][data-num="${num}"][data-val="${val}"]`);
    if (btn) {
      content.querySelectorAll(`.cbtn[data-exam-num="${examNum}"][data-sec="${secId}"][data-part="${partId}"][data-num="${num}"]`).forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      return;
    }
    const lbtn = content.querySelector(`.match-lbtn[data-exam-num="${examNum}"][data-sec="${secId}"][data-part="${partId}"][data-num="${num}"][data-val="${val}"]`);
    if (lbtn) {
      content.querySelectorAll(`.match-lbtn[data-exam-num="${examNum}"][data-sec="${secId}"][data-part="${partId}"][data-num="${num}"]`).forEach(b => b.classList.remove('selected'));
      lbtn.classList.add('selected');
      return;
    }
    const sel = $(`psel_${k}`);
    if (sel) { sel.value = val; return; }
    const inp = $(`pinp_${k}`);
    if (inp) inp.value = val;
  });
}

// ── PRAC COUNT ──
function countPracAnswers() {
  let total = 0, done = 0;
  PRAC.questions.forEach(({ examNum, secId, part }) => {
    (part.questions || []).forEach(q => {
      total++;
      if (PRAC.answers[pracKey(examNum, secId, part.id, q.num)]) done++;
    });
  });
  return { total, done };
}

function updatePracUI() {
  const { total, done } = countPracAnswers();
  $('prac-answer-status').textContent = `${done}/${total}`;
  $('prac-answer-status').style.color = done === total ? '#22c55e' : '#94a3b8';
  $('prac-unanswered-count').textContent = total - done;
}

// ── PRAC MARK ──
function markPracAnswers() {
  const content = $('prac-answer-content');
  content.querySelectorAll('.cbtn, .match-lbtn, .match-sel, input').forEach(el => { el.disabled = true; });

  PRAC.questions.forEach(({ examNum, secId, part }) => {
    if (part.type === 'matching') {
      const correctMap = part.answers || {};
      const isBtn = (part.id === 'p1' || part.id === 'ls2');
      (part.questions || []).forEach(item => {
        const k = pracKey(examNum, secId, part.id, item.num);
        const correct = String(correctMap[item.num] || '');
        const user = PRAC.answers[k] || '';
        const fb = $(`pfb_${k}`);
        if (!correct) return;
        if (isBtn) {
          content.querySelectorAll(`.match-lbtn[data-exam-num="${examNum}"][data-sec="${secId}"][data-part="${part.id}"][data-num="${item.num}"]`).forEach(b => {
            if (b.dataset.val === correct) b.classList.add('lbtn-correct');
            else if (b.dataset.val === user && user !== correct) b.classList.add('lbtn-wrong');
          });
        } else {
          const sel = $(`psel_${k}`);
          if (sel) sel.classList.add(user === correct ? 'correct-fill' : 'wrong-fill');
        }
        if (fb) { fb.className = 'q-fb ' + (user === correct ? 'ok' : 'bad'); fb.textContent = user === correct ? '✓ Đúng' : `✗ Đáp án: ${correct}`; }
      });
      return;
    }

    (part.questions || []).forEach(q => {
      const k = pracKey(examNum, secId, part.id, q.num);
      const fb = $(`pfb_${k}`);
      if (part.type === 'mcq') {
        const correct = (q.ans || '').toUpperCase().trim();
        const user = (PRAC.answers[k] || '').toUpperCase().trim();
        content.querySelectorAll(`.cbtn[data-exam-num="${examNum}"][data-sec="${secId}"][data-part="${part.id}"][data-num="${q.num}"]`).forEach(btn => {
          if (btn.dataset.val === correct && correct) btn.classList.add('correct');
          if (btn.dataset.val === user && user !== correct) btn.classList.add('wrong-sel');
        });
        if (fb && correct) { fb.className = 'q-fb ' + (user === correct ? 'ok' : 'bad'); fb.textContent = user === correct ? '✓ Đúng' : `✗ Đáp án: ${correct}`; }
      } else if (part.type === 'word_fill' || part.type === 'text_fill' || part.type === 'form_fill') {
        const inp = $(`pinp_${k}`);
        const userLow = (PRAC.answers[k] || '').toLowerCase().trim();
        const accepted = Array.isArray(q.ans) ? q.ans.map(a => a.toLowerCase().trim()) : [(q.ans || '').toLowerCase().trim()];
        if (q.alts) [].concat(q.alts).forEach(a => accepted.push(a.toLowerCase().trim()));
        const isOk = userLow !== '' && accepted.some(a => a && userLow === a);
        const displayAns = Array.isArray(q.ans) ? q.ans.join(' / ') : q.ans;
        const hasAns = Array.isArray(q.ans) ? q.ans.length > 0 : !!q.ans;
        if (inp && hasAns) inp.classList.add(isOk ? 'correct-fill' : 'wrong-fill');
        if (fb && hasAns) { fb.className = 'q-fb ' + (isOk ? 'ok' : 'bad'); fb.textContent = isOk ? '✓ Đúng' : `✗ Đáp án: ${displayAns}`; }
      }
    });
  });
}

// ── PRAC RESULTS ──
function showPracResults() {
  let correct = 0, wrong = 0, skip = 0;
  PRAC.questions.forEach(({ examNum, secId, part }) => {
    if (part.type === 'matching') {
      const correctMap = part.answers || {};
      (part.questions || []).forEach(item => {
        const ans = String(correctMap[item.num] || '').trim();
        const user = (PRAC.answers[pracKey(examNum, secId, part.id, item.num)] || '').trim();
        if (!ans) return;
        if (!user) skip++;
        else if (user === ans) correct++;
        else wrong++;
      });
      return;
    }
    (part.questions || []).forEach(q => {
      const k = pracKey(examNum, secId, part.id, q.num);
      const user = (PRAC.answers[k] || '').toLowerCase().trim();
      const accepted = Array.isArray(q.ans) ? q.ans.map(a => a.toLowerCase().trim()) : [(q.ans || '').toLowerCase().trim()];
      if (q.alts) [].concat(q.alts).forEach(a => accepted.push(a.toLowerCase().trim()));
      const hasAns = accepted.some(a => a.length > 0);
      if (!hasAns) return;
      if (!user) skip++;
      else if (accepted.some(a => a && user === a)) correct++;
      else wrong++;
    });
  });

  const total = correct + wrong + skip;
  const pct = total ? Math.round(correct / total * 100) : 0;
  $('prac-res-correct').textContent = correct;
  $('prac-res-wrong').textContent = wrong;
  $('prac-res-skip').textContent = skip;
  $('prac-result-pct').textContent = pct + '%';
  const arc = $('prac-result-arc');
  if (arc) {
    setTimeout(() => { arc.style.strokeDashoffset = 314 - (314 * pct / 100); }, 80);
    arc.style.stroke = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
  }
  $('prac-result-panel').classList.remove('hidden');
  $('prac-answer-content').scrollTop = 0;
}

function resetPracExam() {
  PRAC.answers = {};
  PRAC.submitted = false;
  $('prac-btn-submit').style.display = '';
  $('prac-result-panel').classList.add('hidden');
  renderPracAnswerSheet();
  updatePracUI();
}

// ── PRAC EVENTS ──
$('btn-practice-mode').addEventListener('click', openPracticeSelector);

$('prac-btn-back').addEventListener('click', closePracticeSelector);
$('practice-screen').addEventListener('click', e => {
  if (e.target === $('practice-screen')) closePracticeSelector();
});

document.querySelectorAll('.prac-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.prac-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    PRAC.section = tab.dataset.sec;
    buildPracGroupGrid();
  });
});

$('prac-start-btn').addEventListener('click', () => {
  if (!PRAC.group) return;
  startPractice();
});

$('prac-exam-back').addEventListener('click', () => {
  stopActiveAudio();
  $('prac-exam-screen').classList.add('hidden');
  $('practice-screen').classList.remove('hidden');
});
$('prac-exam-screen').addEventListener('click', e => {
  if (e.target === $('prac-exam-screen')) {
    stopActiveAudio();
    $('prac-exam-screen').classList.add('hidden');
    $('practice-screen').classList.remove('hidden');
  }
});

$('prac-btn-submit').addEventListener('click', () => $('prac-modal-submit').classList.remove('hidden'));
$('prac-modal-cancel').addEventListener('click', () => $('prac-modal-submit').classList.add('hidden'));
$('prac-modal-confirm').addEventListener('click', () => {
  $('prac-modal-submit').classList.add('hidden');
  PRAC.submitted = true;
  $('prac-btn-submit').style.display = 'none';
  markPracAnswers();
  showPracResults();
});
$('prac-modal-submit').addEventListener('click', e => {
  if (e.target === $('prac-modal-submit')) $('prac-modal-submit').classList.add('hidden');
});

$('prac-btn-reset').addEventListener('click', () => {
  if (confirm('Làm lại từ đầu? Toàn bộ đáp án sẽ bị xoá.')) resetPracExam();
});
$('prac-btn-review').addEventListener('click', () => {
  $('prac-result-panel').classList.add('hidden');
  $('prac-answer-content').scrollTop = 0;
});
$('prac-btn-retry').addEventListener('click', resetPracExam);

// ══════════════════════════════════════════════════════════════
// WRONG ANSWER REVIEW MODULE
// ══════════════════════════════════════════════════════════════

const WR = {
  filter: 'all',   // 'all' | 'doc' | 'nghe'
  source: null,    // null = all exams, or examNum
  items: [],       // [{examNum, secId, part (with filtered questions), wrongNums}]
  answers: {},
  submitted: false,
};

const WR_LS_KEY = 'humg_wr_session';

function saveWR() {
  try {
    localStorage.setItem(WR_LS_KEY, JSON.stringify({
      answers: WR.answers,
      submitted: WR.submitted,
      examSubmitted: WR.examSubmitted || {},
      filter: WR.filter,
      source: WR.source,
    }));
  } catch(e) {}
}

function loadWR() {
  try { return JSON.parse(localStorage.getItem(WR_LS_KEY)); } catch(e) { return null; }
}

function clearWRSession() {
  try { localStorage.removeItem(WR_LS_KEY); } catch(e) {}
}

// ── Helpers ──────────────────────────────────────────────────

function isNgheSec(secId) {
  const s = (secId || '').toLowerCase();
  return s.includes('ls') || s.includes('listen') || s.includes('nghe');
}

// Return list of questions needing review: answered WRONG or LEFT BLANK
function getWrongItems(examNum, filter) {
  const saved = loadSaved(examNum);
  if (!saved || !saved.submitted) return [];
  const data = QUESTIONS[examNum];
  if (!data) return [];
  const answers = saved.answers || {};
  const wrongs = [];

  data.sections.forEach(sec => {
    const isNghe = isNgheSec(sec.id);
    if (filter === 'doc'  && isNghe)  return;
    if (filter === 'nghe' && !isNghe) return;

    (sec.parts || []).forEach(part => {
      if (part.type === 'writing') return;

      if (part.type === 'matching') {
        const correctMap = part.answers || {};
        (part.questions || []).forEach(item => {
          const ans = String(correctMap[item.num] || '').trim();
          if (!ans) return;
          const user = (answers[key(sec.id, part.id, item.num)] || '').trim();
          // bỏ trống hoặc sai → cần ôn
          if (!user || user !== ans) wrongs.push({ examNum, secId: sec.id, partId: part.id, num: item.num });
        });
        return;
      }

      (part.questions || []).forEach(q => {
        const k = key(sec.id, part.id, q.num);
        const user = (answers[k] || '').toLowerCase().trim();
        const accepted = Array.isArray(q.ans) ? q.ans.map(a => a.toLowerCase().trim()) : [(q.ans || '').toLowerCase().trim()];
        if (q.alts) [].concat(q.alts).forEach(a => accepted.push(a.toLowerCase().trim()));
        const hasAns = accepted.some(a => a.length > 0);
        if (!hasAns) return;
        // bỏ trống hoặc sai → cần ôn
        const isOk = user && accepted.some(a => a && user === a);
        if (!isOk) wrongs.push({ examNum, secId: sec.id, partId: part.id, num: q.num });
      });
    });
  });

  return wrongs;
}

// Build summary: mỗi phần tử = { examNum, section, group, wrongCount }
// Chỉ tạo phần tử khi nhóm đó có ít nhất 1 câu sai
function buildWrongGroupSummary() {
  const rows = [];
  for (let examNum = 1; examNum <= 20; examNum++) {
    const saved = loadSaved(examNum);
    if (!saved || !saved.submitted) continue;
    const data = QUESTIONS[examNum];
    if (!data) continue;
    const answers = saved.answers || {};

    // Check each section × group combination
    ['doc','nghe'].forEach(section => {
      const groups = PRAC_GROUPS[section] || [];
      groups.forEach(group => {
        // Count wrong questions in this exam × section × group
        let wrongCount = 0;
        data.sections.forEach(sec => {
          const isNghe = isNgheSec(sec.id);
          if (section === 'doc'  && isNghe)  return;
          if (section === 'nghe' && !isNghe) return;
          (sec.parts || []).forEach(part => {
            if (part.type === 'writing') return;
            if (part.type === 'matching') {
              const correctMap = part.answers || {};
              (part.questions || []).forEach(item => {
                if (item.num < group.from || item.num > group.to) return;
                const ans = String(correctMap[item.num] || '').trim();
                if (!ans) return;
                const user = (answers[key(sec.id, part.id, item.num)] || '').trim();
                // chưa làm (bỏ trống) hoặc sai → cần ôn
                if (!user || user !== ans) wrongCount++;
              });
            } else {
              (part.questions || []).forEach(q => {
                if (q.num < group.from || q.num > group.to) return;
                const k = key(sec.id, part.id, q.num);
                const user = (answers[k] || '').toLowerCase().trim();
                const accepted = Array.isArray(q.ans) ? q.ans.map(a => a.toLowerCase().trim()) : [(q.ans||'').toLowerCase().trim()];
                if (q.alts) [].concat(q.alts).forEach(a => accepted.push(a.toLowerCase().trim()));
                const hasAns = accepted.some(a => a.length > 0);
                if (!hasAns) return;
                const isOk = user && accepted.some(a => a && user === a);
                // chưa làm (bỏ trống) hoặc sai → cần ôn
                if (!isOk) wrongCount++;
              });
            }
          });
        });
        if (wrongCount > 0) {
          rows.push({ examNum, section, group, wrongCount });
        }
      });
    });
  }
  return rows;
}

// ── Selector screen ───────────────────────────────────────────

function openWrongReview() {
  homeScreen.classList.add('hidden');
  $('wrong-screen').classList.remove('hidden');
  WR.filter = 'all';
  renderWrongSelector();
}

function closeWrongSelector() {
  $('wrong-screen').classList.add('hidden');
  homeScreen.classList.remove('hidden');
  updateWrongBannerSub();
}

function updateWrongBannerSub() {
  const sub = $('wrong-review-sub');
  if (sub) sub.textContent = 'Luyện lại những câu sai';
}

// Check result of a specific group after submission
// Returns 'ok' if submitted and all questions correct, 'fail' if submitted with errors, null if not submitted
function getWrGroupResult(examNum, section, group) {
  const saved = loadSaved(examNum);
  if (!saved || !saved.submitted) return null;
  // Check if this exam was submitted in WR session
  const wrSaved = loadWR();
  if (!wrSaved || !wrSaved.examSubmitted || !wrSaved.examSubmitted[examNum]) return null;
  const wrAnswers = wrSaved.answers || {};
  const data = QUESTIONS[examNum];
  if (!data) return null;
  const isNgheSec_ = (id) => { const s=(id||'').toLowerCase(); return s.includes('ls')||s.includes('listen')||s.includes('nghe'); };
  let allOk = true;
  data.sections.forEach(sec => {
    const isNghe = isNgheSec_(sec.id);
    if (section === 'doc'  && isNghe)  return;
    if (section === 'nghe' && !isNghe) return;
    (sec.parts || []).forEach(part => {
      if (part.type === 'writing') return;
      if (part.type === 'matching') {
        const correctMap = part.answers || {};
        (part.questions || []).forEach(item => {
          if (item.num < group.from || item.num > group.to) return;
          const ans = String(correctMap[item.num] || '').trim();
          if (!ans) return;
          const k = wrKey(examNum, sec.id, part.id, item.num);
          const user = (wrAnswers[k] || '').trim();
          if (user !== ans) allOk = false;
        });
      } else {
        (part.questions || []).forEach(q => {
          if (q.num < group.from || q.num > group.to) return;
          const k = wrKey(examNum, sec.id, part.id, q.num);
          const user = (wrAnswers[k] || '').toLowerCase().trim();
          const accepted = Array.isArray(q.ans) ? q.ans.map(a=>a.toLowerCase().trim()) : [(q.ans||'').toLowerCase().trim()];
          if (q.alts) [].concat(q.alts).forEach(a=>accepted.push(a.toLowerCase().trim()));
          const hasAns = accepted.some(a=>a.length>0);
          if (!hasAns) return;
          if (!(user && accepted.some(a=>a&&user===a))) allOk = false;
        });
      }
    });
  });
  return allOk ? 'ok' : 'fail';
}

function renderWrongSelector() {
  const content = $('wrong-selector-content');
  content.innerHTML = '';

  const allRows = buildWrongGroupSummary();

  // ── Filter bar ──
  const filterBar = CE('div', { className: 'wr-filter-bar' });
  [['all','Tất cả'], ['doc','📖 Đọc'], ['nghe','🎧 Nghe']].forEach(([val, label]) => {
    const btn = CE('button', {
      className: 'wr-filter-btn' + (WR.filter === val ? ' active' : ''),
      textContent: label,
    });
    btn.addEventListener('click', () => { WR.filter = val; renderWrongSelector(); });
    filterBar.appendChild(btn);
  });
  content.appendChild(filterBar);

  // Apply filter
  const rows = WR.filter === 'all' ? allRows
    : allRows.filter(r => r.section === WR.filter);

  if (!rows.length) {
    const empty = CE('div', { className: 'wr-empty' });
    empty.innerHTML = `
      <div class="wr-empty-icon">🎉</div>
      <div class="wr-empty-title">Không có câu sai!</div>
      <div class="wr-empty-sub">Hãy hoàn thành thêm đề thi để xem kết quả tổng hợp.</div>
    `;
    content.appendChild(empty);
    return;
  }

  // ── Header ──
  const totalQ = rows.reduce((a, r) => a + r.wrongCount, 0);
  const hdr = CE('div', { className: 'wr-summary-hdr' });
  hdr.innerHTML = `
    <div class="wr-summary-title">Nhóm câu cần ôn lại</div>
    <div class="wr-summary-count">❌ ${totalQ} câu · ${rows.length} nhóm</div>
  `;
  content.appendChild(hdr);

  // ── Group rows sorted by examNum then section then group.from ──
  const sorted = [...rows].sort((a, b) =>
    a.examNum - b.examNum ||
    (a.section === 'doc' ? -1 : 1) - (b.section === 'doc' ? -1 : 1) ||
    a.group.from - b.group.from
  );

  // Group by examNum for visual separation
  const byExam = {};
  sorted.forEach(r => {
    if (!byExam[r.examNum]) byExam[r.examNum] = [];
    byExam[r.examNum].push(r);
  });

  Object.keys(byExam).map(Number).sort((a,b)=>a-b).forEach(examNum => {
    // Exam heading
    const examHdr = CE('div', { className: 'wr-exam-hdr' });
    const examWrong = byExam[examNum].reduce((a, r) => a + r.wrongCount, 0);
    examHdr.innerHTML = `
      <span class="wr-exam-hdr-num">Đề ${examNum}</span>
      <span class="wr-exam-hdr-count">❌ ${examWrong} câu cần ôn</span>
    `;
    content.appendChild(examHdr);

    // Group chips for this exam
    const chipWrap = CE('div', { className: 'wr-chip-wrap' });
    byExam[examNum].forEach(row => {
      const { section, group, wrongCount } = row;
      const secIcon = section === 'nghe' ? '🎧' : '📖';
      // Check if this group was submitted and all correct
      const groupResult = getWrGroupResult(examNum, section, group);
      const chip = CE('button', { className: 'wr-chip' + (groupResult === 'ok' ? ' wr-chip--ok' : '') });
      chip.innerHTML = `
        <span class="wr-chip-sec">${secIcon}</span>
        <span class="wr-chip-range">${group.label}</span>
        ${groupResult === 'ok'
          ? '<span class="wr-chip-count wr-chip-ok">✓</span>'
          : `<span class="wr-chip-count">❌${wrongCount}</span>`}
      `;
      chip.addEventListener('click', () => startWrongExam(examNum, section, group));
      chipWrap.appendChild(chip);
    });
    content.appendChild(chipWrap);
  });

  // ── Start All button ──
  const startAll = CE('button', { className: 'wr-start-all-btn' });
  startAll.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Ôn tất cả ${totalQ} câu sai (${rows.length} nhóm)`;
  startAll.addEventListener('click', () => startWrongExam(null, null, null));
  content.appendChild(startAll);
}

// ── Build wrong-questions item list ──────────────────────────
// Nếu nhóm có ít nhất 1 câu sai → load TOÀN BỘ nhóm đó để làm lại
// examNumFilter: null = all exams, or specific examNum
// sectionFilter: 'doc'|'nghe'|null = all
// groupFilter: { from, to } | null = all groups
function buildWrongItems(examNumFilter, sectionFilter, groupFilter) {
  const items = [];
  const exams = examNumFilter
    ? [examNumFilter]
    : Array.from({ length: 20 }, (_, i) => i + 1);

  // Kiểm tra 1 câu có bị sai không (đã làm nhưng sai, không tính bỏ qua)
  // Kiểm tra câu cần ôn lại: đã làm SAI hoặc BỎ TRỐNG
  function needsReview(part, q, secId, partId, answers) {
    if (part.type === 'matching') {
      const correctMap = part.answers || {};
      const ans = String(correctMap[q.num] || '').trim();
      if (!ans) return false;
      const user = (answers[key(secId, partId, q.num)] || '').trim();
      // bỏ trống hoặc sai → cần ôn
      return !user || user !== ans;
    }
    const k = key(secId, partId, q.num);
    const user = (answers[k] || '').toLowerCase().trim();
    const accepted = Array.isArray(q.ans)
      ? q.ans.map(a => a.toLowerCase().trim())
      : [(q.ans || '').toLowerCase().trim()];
    if (q.alts) [].concat(q.alts).forEach(a => accepted.push(a.toLowerCase().trim()));
    const hasAns = accepted.some(a => a.length > 0);
    if (!hasAns) return false;
    // bỏ trống hoặc sai → cần ôn
    return !(user && accepted.some(a => a && user === a));
  }

  exams.forEach(examNum => {
    const saved = loadSaved(examNum);
    if (!saved || !saved.submitted) return;
    const data = QUESTIONS[examNum];
    if (!data) return;
    const answers = saved.answers || {};

    data.sections.forEach(sec => {
      const isNghe = isNgheSec(sec.id);
      if (sectionFilter === 'doc'  && isNghe)  return;
      if (sectionFilter === 'nghe' && !isNghe) return;
      if (!sectionFilter && WR.filter === 'doc'  && isNghe)  return;
      if (!sectionFilter && WR.filter === 'nghe' && !isNghe) return;

      (sec.parts || []).forEach(part => {
        if (part.type === 'writing') return;

        // Xác định nhóm cần kiểm tra
        const section = isNghe ? 'nghe' : 'doc';
        const groupsToCheck = groupFilter
          ? [groupFilter]
          : (PRAC_GROUPS[section] || []);

        groupsToCheck.forEach(group => {
          // Tất cả câu của part nằm trong phạm vi nhóm này
          const allQsInGroup = (part.questions || []).filter(q =>
            q.num >= group.from && q.num <= group.to
          );
          if (!allQsInGroup.length) return;

          // Chỉ load nhóm nếu có ít nhất 1 câu đã làm SAI
          const hasWrong = allQsInGroup.some(q =>
            needsReview(part, q, sec.id, part.id, answers)
          );
          if (!hasWrong) return;

          // Load TOÀN BỘ câu trong nhóm (kể cả câu đúng và chưa làm)
          // Với text_fill/word_fill có sub-groups: giữ sub-group thuộc range này
          let filteredGroups = undefined;
          if (part.groups && part.groups.length) {
            filteredGroups = part.groups
              .map(grp => {
                const numsInRange = (grp.nums || []).filter(n =>
                  n >= group.from && n <= group.to
                );
                return numsInRange.length ? { ...grp, nums: numsInRange } : null;
              })
              .filter(Boolean);
          }

          items.push({
            examNum, secId: sec.id,
            part: {
              ...part,
              questions: allQsInGroup,
              groups: filteredGroups || undefined,
            },
          });
        });
      });
    });
  });

  return items;
}

// ── Start wrong exam ─────────────────────────────────────────
// examNumFilter: null = all, or specific examNum
// sectionFilter: 'doc'|'nghe'|null
// groupFilter: { from, to, label }|null
function startWrongExam(examNumFilter, sectionFilter, groupFilter) {
  WR.source = examNumFilter;
  WR.submitted = false;
  WR.items = buildWrongItems(examNumFilter, sectionFilter, groupFilter);

  if (!WR.items.length) {
    showToast('🎉 Không có câu sai để ôn!');
    return;
  }

  // Restore saved session if exists
  const savedWR = loadWR();
  if (savedWR) {
    WR.answers = savedWR.answers || {};
    WR.examSubmitted = savedWR.examSubmitted || {};
    WR.submitted = savedWR.submitted || false;
  } else {
    WR.answers = {};
    WR.examSubmitted = {};
    WR.submitted = false;
  }

  // Build nav title
  const parts = [];
  if (examNumFilter) parts.push(`Đề ${examNumFilter}`);
  else parts.push('Tất cả đề');
  if (sectionFilter === 'doc')  parts.push('Phần Đọc');
  else if (sectionFilter === 'nghe') parts.push('Phần Nghe');
  if (groupFilter) parts.push(groupFilter.label);
  const totalWrong = WR.items.reduce((a, i) => a + i.part.questions.length, 0);
  parts.push(`${totalWrong} câu`);

  $('wrong-exam-title').textContent = parts.join(' · ');
  $('wrong-screen').classList.add('hidden');
  $('wrong-exam-screen').classList.remove('hidden');
  $('wrong-result-panel').classList.add('hidden');
  $('wrong-btn-submit').style.display = 'none'; // per-exam submit buttons used instead

  renderWrongAnswerSheet();
  if (WR.submitted) { markWrAnswers(); showWrResults(); }
  updateWrongUI();
}

// ── Render wrong answer sheet ─────────────────────────────────

function wrKey(examNum, secId, partId, num) {
  return `wr_e${examNum}_${secId}_${partId}_${num}`;
}

// WR per-exam submitted state: { [examNum]: true/false }
// Stored inside WR.examSubmitted
function renderWrongAnswerSheet() {
  if (!WR.examSubmitted) WR.examSubmitted = {};
  const content = $('wrong-answer-content');
  content.innerHTML = '';
  $('wrong-result-panel').classList.add('hidden');

  // Group items by examNum
  const byExam = {};
  WR.items.forEach(item => {
    if (!byExam[item.examNum]) byExam[item.examNum] = [];
    byExam[item.examNum].push(item);
  });

  const examNums = Object.keys(byExam).map(Number).sort((a,b)=>a-b);

  examNums.forEach((examNum, eIdx) => {
    const isSubmitted = !!WR.examSubmitted[examNum];

    // ── Exam block wrapper ──
    const examBlock = CE('div', { className: 'wr-exam-block', id: `wr-exam-block-${examNum}` });

    // Badge
    const examBadge = CE('div', { className: 'prac-exam-source prac-exam-source--wrong', id: `wr-badge-${examNum}` });
    examBadge.innerHTML = isSubmitted
      ? `✅ Đề ${examNum} — đã nộp`
      : `❌ Đề ${examNum} — câu sai`;
    examBlock.appendChild(examBadge);

    byExam[examNum].forEach((item) => {
      const { secId, part } = item;
      const isLs1 = (part.id === 'ls1');
      const selfRendersImg = (part.type === 'form_fill' || part.type === 'word_fill' || part.type === 'text_fill');
      if (part.instruction) examBlock.appendChild(CE('div', { className: 'part-inst', textContent: part.instruction }));
      if (isLs1) {
        if (part.audioSrc) examBlock.appendChild(renderAudioPlayer(part.audioSrc, `wr_e${examNum}_${part.id}`));
      } else {
        if (!selfRendersImg && part.imgSrc) examBlock.appendChild(makePartImgEl(part.imgSrc, `Đề ${examNum}`));
        if (part.audioSrc) examBlock.appendChild(renderAudioPlayer(part.audioSrc, `wr_e${examNum}_${part.id}`));
      }
      let qBlock;
      switch (part.type) {
        case 'matching':  qBlock = renderWrMatching(examNum, secId, part); break;
        case 'mcq':       qBlock = renderWrMCQ(examNum, secId, part); break;
        case 'word_fill':
        case 'text_fill': qBlock = renderWrWordFill(examNum, secId, part); break;
        case 'form_fill': qBlock = renderWrFormFill(examNum, secId, part); break;
        default:          qBlock = renderWrMCQ(examNum, secId, part); break;
      }
      examBlock.appendChild(qBlock);
    });

    // ── Per-exam submit button ──
    if (!isSubmitted) {
      const submitBtn = CE('button', { className: 'wr-exam-submit-btn', id: `wr-submit-${examNum}` });
      submitBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Nộp Đề ${examNum}`;
      submitBtn.addEventListener('click', () => submitWrExam(examNum));
      examBlock.appendChild(submitBtn);
    } else {
      // Already submitted — lock inputs and show answers
      lockWrExamBlock(examNum, byExam[examNum]);
    }

    content.appendChild(examBlock);
    if (eIdx < examNums.length - 1) content.appendChild(CE('hr', { className: 'prac-exam-divider' }));
  });

  if (Object.keys(WR.answers).length) restoreWrAnswers();
  // Re-lock already-submitted exams after restore
  examNums.forEach(examNum => {
    if (WR.examSubmitted[examNum]) lockWrExamBlock(examNum, byExam[examNum]);
  });
}

// Lock all inputs in an exam block and show per-question feedback
function lockWrExamBlock(examNum, items) {
  const block = $(`wr-exam-block-${examNum}`);
  if (!block) return;
  block.querySelectorAll('.cbtn, .match-lbtn, .match-sel, input').forEach(el => { el.disabled = true; });
  items.forEach(({ secId, part }) => markWrPartAnswers(examNum, secId, part));
  // Remove submit button if present
  const btn = $(`wr-submit-${examNum}`);
  if (btn) btn.remove();
}

// Submit a single exam block
function submitWrExam(examNum) {
  if (!WR.examSubmitted) WR.examSubmitted = {};
  WR.examSubmitted[examNum] = true;

  // Update badge
  const badge = $(`wr-badge-${examNum}`);
  if (badge) badge.innerHTML = `✅ Đề ${examNum} — đã nộp`;

  // Find items for this exam
  const items = WR.items.filter(i => i.examNum === examNum);
  lockWrExamBlock(examNum, items);

  saveWR();
  updateWrongUI();
  checkAllWrSubmitted();
}

// Check if all exams are submitted → update chips in selector
function checkAllWrSubmitted() {
  if (!WR.examSubmitted) return;
  const examNums = [...new Set(WR.items.map(i => i.examNum))];
  const allDone = examNums.every(n => WR.examSubmitted[n]);
  if (allDone) {
    // Show overall results panel
    showWrResults();
  }
  // Always refresh selector chips (to update ✓/❌ status)
}

// Mark answers for one part
function markWrPartAnswers(examNum, secId, part) {
  const content = $('wrong-answer-content');
  if (part.type === 'matching') {
    const correctMap = part.answers || {};
    const isBtn = (part.id === 'p1' || part.id === 'ls2');
    (part.questions||[]).forEach(item => {
      const k = wrKey(examNum, secId, part.id, item.num);
      const correct = String(correctMap[item.num]||'');
      const user = WR.answers[k]||'';
      const fb = $(`wrfb_${k}`);
      if (!correct) return;
      if (isBtn) {
        content.querySelectorAll(`.match-lbtn[data-exam-num="${examNum}"][data-sec="${secId}"][data-part="${part.id}"][data-num="${item.num}"]`).forEach(b => {
          if (b.dataset.val===correct) b.classList.add('lbtn-correct');
          else if (b.dataset.val===user && user!==correct) b.classList.add('lbtn-wrong');
        });
      } else {
        const sel = $(`wrsel_${k}`);
        if (sel) sel.classList.add(user===correct?'correct-fill':'wrong-fill');
      }
      if (fb) { fb.className='q-fb '+(user===correct?'ok':'bad'); fb.textContent=user===correct?'✓ Đúng':`✗ Đáp án: ${correct}`; }
    });
    return;
  }
  (part.questions||[]).forEach(q => {
    const k = wrKey(examNum, secId, part.id, q.num);
    const fb = $(`wrfb_${k}`);
    if (part.type === 'mcq') {
      const correct = (q.ans||'').toUpperCase().trim();
      const user = (WR.answers[k]||'').toUpperCase().trim();
      content.querySelectorAll(`.cbtn[data-exam-num="${examNum}"][data-sec="${secId}"][data-part="${part.id}"][data-num="${q.num}"]`).forEach(btn => {
        if (btn.dataset.val===correct && correct) btn.classList.add('correct');
        if (btn.dataset.val===user && user!==correct) btn.classList.add('wrong-sel');
      });
      if (fb && correct) { fb.className='q-fb '+(user===correct?'ok':'bad'); fb.textContent=user===correct?'✓ Đúng':`✗ Đáp án: ${correct}`; }
    } else {
      const inp = $(`wrinp_${k}`);
      const userLow = (WR.answers[k]||'').toLowerCase().trim();
      const accepted = Array.isArray(q.ans)?q.ans.map(a=>a.toLowerCase().trim()):[(q.ans||'').toLowerCase().trim()];
      if (q.alts) [].concat(q.alts).forEach(a=>accepted.push(a.toLowerCase().trim()));
      const isOk = userLow!==''&&accepted.some(a=>a&&userLow===a);
      const displayAns = Array.isArray(q.ans)?q.ans.join(' / '):q.ans;
      const hasAns = Array.isArray(q.ans)?q.ans.length>0:!!q.ans;
      if (inp && hasAns) inp.classList.add(isOk?'correct-fill':'wrong-fill');
      if (fb && hasAns) { fb.className='q-fb '+(isOk?'ok':'bad'); fb.textContent=isOk?'✓ Đúng':`✗ Đáp án: ${displayAns}`; }
    }
  });
}

// ── WR MCQ ───────────────────────────────────────────────────
function renderWrMCQ(examNum, secId, part) {
  const wrap = CE('div');
  (part.questions || []).forEach(q => {
    const qk = wrKey(examNum, secId, part.id, q.num);
    const row = CE('div', { className: 'q-row', id: `wrrow_${qk}` });
    if (q.qImgSrc) { const img = makePartImgEl(q.qImgSrc, `Câu ${q.num}`); img.classList.add('q-img-wrap'); row.appendChild(img); }
    const stem = CE('div', { className: 'q-stem' });
    stem.innerHTML = (q.stem && !q.stem.match(/^\d+$/)) ? `<span class="q-num">${q.num}.</span> ${esc(q.stem)}` : `<span class="q-num">${q.num}.</span>`;
    row.appendChild(stem);
    const isVertical = (part.id === 'p3');
    const ch = CE('div', { className: isVertical ? 'choices choices--vertical' : 'choices' });
    ['A','B','C'].forEach((lbl, idx) => {
      if (!(q.opts||[])[idx]) return;
      const btn = CE('button', { className: 'cbtn', textContent: `${lbl}. ${q.opts[idx]}` });
      btn.dataset.examNum = examNum; btn.dataset.sec = secId; btn.dataset.part = part.id; btn.dataset.num = q.num; btn.dataset.val = lbl;
      btn.addEventListener('click', onWrMCQClick);
      ch.appendChild(btn);
    });
    row.appendChild(ch);
    row.appendChild(CE('div', { className: 'q-fb', id: `wrfb_${qk}` }));
    wrap.appendChild(row);
  });
  return wrap;
}
function onWrMCQClick(e) {
  if (WR.submitted) return;
  const { examNum, sec, part, num, val } = e.currentTarget.dataset;
  const k = wrKey(examNum, sec, part, num);
  const content = $('wrong-answer-content');
  if (WR.answers[k] === val) {
    delete WR.answers[k];
    content.querySelectorAll(`.cbtn[data-exam-num="${examNum}"][data-sec="${sec}"][data-part="${part}"][data-num="${num}"]`).forEach(b => b.classList.remove('selected'));
  } else {
    WR.answers[k] = val;
    content.querySelectorAll(`.cbtn[data-exam-num="${examNum}"][data-sec="${sec}"][data-part="${part}"][data-num="${num}"]`).forEach(b => b.classList.toggle('selected', b.dataset.val === val));
  }
  saveWR();
  updateWrongUI();
}

// ── WR MATCHING ──────────────────────────────────────────────
function renderWrMatching(examNum, secId, part) {
  const wrap = CE('div');
  const isP1 = (part.id === 'p1'), isLs2 = (part.id === 'ls2');
  const opts = part.options || [], questions = part.questions || [];

  if (isLs2) {
    const inst = part.instruction || '';
    const mTitle = inst.match(/Match (.+?) with (?:their )?(.+?)\.?$/i);
    const table = CE('div', { className: 'ls2-table' });
    const leftCol = CE('div', { className: 'ls2-col ls2-col--left' });
    leftCol.appendChild(CE('div', { className: 'ls2-col-hdr', textContent: mTitle ? mTitle[1].trim() : 'Câu hỏi' }));
    questions.forEach(item => {
      const k = wrKey(examNum, secId, part.id, item.num);
      const cell = CE('div', { className: 'ls2-cell ls2-cell--with-btns' });
      const row = CE('div', { className: 'ls2-row' });
      row.innerHTML = `<span class="ls2-q-num">${item.num}.</span><span class="ls2-q-text">${esc(item.text||'')}</span>`;
      cell.appendChild(row);
      const btnGrid = CE('div', { className: 'ls2-btn-grid' });
      opts.forEach(o => {
        const btn = CE('button', { className: 'match-lbtn', textContent: o.id });
        btn.dataset.examNum = examNum; btn.dataset.sec = secId; btn.dataset.part = part.id; btn.dataset.num = item.num; btn.dataset.val = o.id;
        btn.addEventListener('click', onWrMatchBtnClick);
        btnGrid.appendChild(btn);
      });
      cell.appendChild(btnGrid);
      cell.appendChild(CE('div', { className: 'q-fb', id: `wrfb_${k}` }));
      leftCol.appendChild(cell);
    });
    const rightCol = CE('div', { className: 'ls2-col ls2-col--right' });
    rightCol.appendChild(CE('div', { className: 'ls2-col-hdr', textContent: mTitle ? mTitle[2].trim() : 'Đáp án' }));
    opts.forEach(o => { const item = CE('div', { className: 'ls2-opt-item' }); item.innerHTML = `<span class="match-opt-letter">${o.id}</span><span class="ls2-opt-text">${esc(o.text)}</span>`; rightCol.appendChild(item); });
    table.appendChild(leftCol); table.appendChild(rightCol);
    wrap.appendChild(table); return wrap;
  }

  if (isP1 && opts.length) {
    const optList = CE('div', { className: 'match-opt-list match-opt-list--letters' });
    opts.forEach(o => { const item = CE('div', { className: 'match-opt-item' }); item.innerHTML = `<span class="match-opt-letter">${o.id}</span>`; optList.appendChild(item); });
    wrap.appendChild(optList);
  }
  if (isP1) {
    questions.forEach(item => {
      const k = wrKey(examNum, secId, part.id, item.num);
      const div = CE('div', { className: 'match-q match-q--btn' });
      div.appendChild(CE('span', { className: 'match-q-num', textContent: `${item.num}.` }));
      const btnRow = CE('div', { className: 'match-btn-row' });
      opts.forEach(o => {
        const btn = CE('button', { className: 'match-lbtn', textContent: o.id });
        btn.dataset.examNum = examNum; btn.dataset.sec = secId; btn.dataset.part = part.id; btn.dataset.num = item.num; btn.dataset.val = o.id;
        btn.addEventListener('click', onWrMatchBtnClick);
        btnRow.appendChild(btn);
      });
      div.appendChild(btnRow);
      div.appendChild(CE('div', { className: 'q-fb', id: `wrfb_${k}` }));
      wrap.appendChild(div);
    });
    return wrap;
  }

  // Default select
  const optsHtml = ['<option value="">-- Chọn --</option>', ...(opts.map(o=>`<option value="${o.id}">${o.id} – ${esc(o.text)}</option>`))].join('');
  questions.forEach(item => {
    const k = wrKey(examNum, secId, part.id, item.num);
    const div = CE('div', { className: 'match-q' });
    div.appendChild(Object.assign(CE('div', { className: 'match-txt' }), { innerHTML: `<span class="q-num">${item.num}.</span> ${esc(item.text||'')}` }));
    const sel = CE('select', { className: 'match-sel', id: `wrsel_${k}`, innerHTML: optsHtml });
    sel.dataset.examNum = examNum; sel.dataset.sec = secId; sel.dataset.part = part.id; sel.dataset.num = item.num;
    sel.addEventListener('change', onWrMatchChange);
    div.appendChild(sel);
    div.appendChild(CE('div', { className: 'q-fb', id: `wrfb_${k}` }));
    wrap.appendChild(div);
  });
  return wrap;
}
function onWrMatchBtnClick(e) {
  if (WR.submitted) return;
  const { examNum, sec, part, num, val } = e.currentTarget.dataset;
  const k = wrKey(examNum, sec, part, num);
  const content = $('wrong-answer-content');
  if (WR.answers[k] === val) {
    delete WR.answers[k];
    content.querySelectorAll(`.match-lbtn[data-exam-num="${examNum}"][data-sec="${sec}"][data-part="${part}"][data-num="${num}"]`).forEach(b => b.classList.remove('selected'));
  } else {
    WR.answers[k] = val;
    content.querySelectorAll(`.match-lbtn[data-exam-num="${examNum}"][data-sec="${sec}"][data-part="${part}"][data-num="${num}"]`).forEach(b => b.classList.toggle('selected', b.dataset.val === val));
  }
  saveWR();
  updateWrongUI();
}
function onWrMatchChange(e) {
  if (WR.submitted) return;
  const { examNum, sec, part, num } = e.target.dataset;
  WR.answers[wrKey(examNum, sec, part, num)] = e.target.value;
  saveWR();
  updateWrongUI();
}

// ── WR WORD / TEXT FILL ──────────────────────────────────────
function renderWrWordFill(examNum, secId, part) {
  const wrap = CE('div');
  const questions = part.questions || [];
  if (part.groups && part.groups.length) {
    part.groups.forEach(grp => {
      const grpNums = new Set(grp.nums);
      const grpQs = questions.filter(q => grpNums.has(q.num));
      if (!grpQs.length) return;
      const grpWrap = CE('div', { className: 'fill-group' });
      if (grp.imgSrc) grpWrap.appendChild(makePartImgEl(grp.imgSrc, `Đề ${examNum}`));
      grpQs.forEach(q => grpWrap.appendChild(buildWrFillRow(examNum, secId, part, q)));
      wrap.appendChild(grpWrap);
    });
  } else {
    questions.forEach(q => wrap.appendChild(buildWrFillRow(examNum, secId, part, q)));
  }
  return wrap;
}
function renderWrFormFill(examNum, secId, part) {
  const wrap = CE('div');
  const grp = CE('div', { className: 'fill-group' });
  if (part.imgSrc) grp.appendChild(makePartImgEl(part.imgSrc, `Đề ${examNum}`));
  (part.questions || []).forEach(q => {
    const k = wrKey(examNum, secId, part.id, q.num);
    const row = CE('div', { className: 'fill-row form-fill-row', id: `wrrow_${k}` });
    const lbl = CE('div', { className: 'form-fill-label' });
    lbl.innerHTML = `<span class="q-num">${q.num}.</span> ${esc(q.label||'')}`;
    row.appendChild(lbl);
    const fw = CE('div', { className: 'fill-wrap' });
    if (q.prefix) fw.appendChild(CE('span', { className: 'fill-pre', textContent: q.prefix }));
    const inp = CE('input', { className: 'fill-inp', type: 'text', placeholder: '...', id: `wrinp_${k}`, autocomplete: 'off' });
    inp.dataset.examNum = examNum; inp.dataset.sec = secId; inp.dataset.part = part.id; inp.dataset.num = q.num;
    inp.addEventListener('input', onWrFillInput);
    fw.appendChild(inp);
    if (q.suffix) fw.appendChild(CE('span', { className: 'fill-suf', textContent: q.suffix }));
    row.appendChild(fw);
    row.appendChild(CE('div', { className: 'q-fb', id: `wrfb_${k}` }));
    grp.appendChild(row);
  });
  wrap.appendChild(grp);
  return wrap;
}
function buildWrFillRow(examNum, secId, part, q) {
  const k = wrKey(examNum, secId, part.id, q.num);
  const row = CE('div', { className: 'fill-row', id: `wrrow_${k}` });
  const hasStem = q.stem && !q.stem.match(/^\(Xem/) && !(q.num >= 41 && q.num <= 50);
  if (hasStem) {
    const stem = CE('div', { className: 'q-stem' });
    stem.innerHTML = `<span class="q-num">${q.num}.</span> ${esc(q.stem)}${q.hint?`<span class="fill-hint"> (${esc(q.hint)})</span>`:''}`;
    row.appendChild(stem);
  }
  const inpRow = CE('div', { className: 'fill-inp-row' });
  inpRow.appendChild(CE('span', { className: 'fill-num-badge', textContent: `${q.num}.` }));
  const inp = CE('input', { className: 'fill-inp', type: 'text', placeholder: 'Nhập từ...', id: `wrinp_${k}`, autocomplete: 'off' });
  inp.dataset.examNum = examNum; inp.dataset.sec = secId; inp.dataset.part = part.id; inp.dataset.num = q.num;
  inp.addEventListener('input', onWrFillInput);
  inpRow.appendChild(inp);
  // Q36-40: hiển thị chữ cái đầu + dấu gạch
  if (q.num >= 36 && q.num <= 40) {
    const primary = getPrimaryAns(q.ans);
    if (primary.length > 0) {
      const first = primary[0].toUpperCase();
      const rest  = primary.length - 1;
      const hint  = CE('span', { className: 'fill-letter-hint' });
      hint.innerHTML =
        `<span class="fill-first">${first}</span>` +
        (rest > 0 ? `<span class="fill-blanks">${'_ '.repeat(rest).trim()}</span>` : '') +
        `<span class="fill-count">(${primary.length} chữ cái)</span>`;
      inpRow.appendChild(hint);
    }
  }
  row.appendChild(inpRow);
  row.appendChild(CE('div', { className: 'q-fb', id: `wrfb_${k}` }));
  return row;
}
function onWrFillInput(e) {
  const { examNum, sec, part, num } = e.target.dataset;
  WR.answers[wrKey(examNum, sec, part, num)] = e.target.value.trim();
  saveWR();
  updateWrongUI();
}

// ── WR RESTORE ───────────────────────────────────────────────
function restoreWrAnswers() {
  const content = $('wrong-answer-content');
  Object.entries(WR.answers).forEach(([k, val]) => {
    if (!val) return;
    // k = wr_eN_secId_partId_num
    const m = k.match(/^wr_e(\d+)_(.+)_([^_]+)_(\d+)$/);
    if (!m) return;
    const [, examNum, secId, partId, num] = m;
    const btn = content.querySelector(`.cbtn[data-exam-num="${examNum}"][data-sec="${secId}"][data-part="${partId}"][data-num="${num}"][data-val="${val}"]`);
    if (btn) { content.querySelectorAll(`.cbtn[data-exam-num="${examNum}"][data-sec="${secId}"][data-part="${partId}"][data-num="${num}"]`).forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); return; }
    const lbtn = content.querySelector(`.match-lbtn[data-exam-num="${examNum}"][data-sec="${secId}"][data-part="${partId}"][data-num="${num}"][data-val="${val}"]`);
    if (lbtn) { content.querySelectorAll(`.match-lbtn[data-exam-num="${examNum}"][data-sec="${secId}"][data-part="${partId}"][data-num="${num}"]`).forEach(b=>b.classList.remove('selected')); lbtn.classList.add('selected'); return; }
    const sel = $(`wrsel_${k}`);
    if (sel) { sel.value = val; return; }
    const inp = $(`wrinp_${k}`);
    if (inp) inp.value = val;
  });
}

// ── WR COUNT / UI ────────────────────────────────────────────
function countWrAnswers() {
  let total = 0, done = 0;
  WR.items.forEach(({ part }) => { (part.questions||[]).forEach(q => { total++; }); });
  Object.values(WR.answers).forEach(v => { if (v) done++; });
  // recount properly
  done = 0; total = 0;
  WR.items.forEach(({ examNum, secId, part }) => {
    (part.questions||[]).forEach(q => {
      total++;
      if (WR.answers[wrKey(examNum, secId, part.id, q.num)]) done++;
    });
  });
  return { total, done };
}
function updateWrongUI() {
  const { total, done } = countWrAnswers();
  $('wrong-answer-status').textContent = `${done}/${total}`;
  $('wrong-answer-status').style.color = done === total ? '#22c55e' : '#94a3b8';
  $('wrong-unanswered-count').textContent = total - done;
}

// ── WR MARK ── delegates to markWrPartAnswers (called per-exam on submit)
function markWrAnswers() {
  WR.items.forEach(({ examNum, secId, part }) => markWrPartAnswers(examNum, secId, part));
}

// ── WR RESULTS ───────────────────────────────────────────────
function showWrResults() {
  let correct=0, wrong=0, skip=0;
  WR.items.forEach(({ examNum, secId, part }) => {
    if (part.type==='matching') {
      const correctMap = part.answers||{};
      (part.questions||[]).forEach(item => {
        const ans = String(correctMap[item.num]||'').trim();
        const user = (WR.answers[wrKey(examNum,secId,part.id,item.num)]||'').trim();
        if (!ans) return;
        if (!user) skip++; else if (user===ans) correct++; else wrong++;
      });
      return;
    }
    (part.questions||[]).forEach(q => {
      const k = wrKey(examNum,secId,part.id,q.num);
      const user = (WR.answers[k]||'').toLowerCase().trim();
      const accepted = Array.isArray(q.ans)?q.ans.map(a=>a.toLowerCase().trim()):[(q.ans||'').toLowerCase().trim()];
      if (q.alts) [].concat(q.alts).forEach(a=>accepted.push(a.toLowerCase().trim()));
      const hasAns = accepted.some(a=>a.length>0);
      if (!hasAns) return;
      if (!user) skip++; else if (accepted.some(a=>a&&user===a)) correct++; else wrong++;
    });
  });
  const total=correct+wrong+skip, pct=total?Math.round(correct/total*100):0;
  $('wrong-res-correct').textContent=correct;
  $('wrong-res-wrong').textContent=wrong;
  $('wrong-res-skip').textContent=skip;
  $('wrong-result-pct').textContent=pct+'%';
  const arc=$('wrong-result-arc');
  if (arc) { setTimeout(()=>{ arc.style.strokeDashoffset=314-(314*pct/100); },80); arc.style.stroke=pct>=70?'#22c55e':pct>=40?'#f59e0b':'#ef4444'; }
  $('wrong-result-panel').classList.remove('hidden');
  $('wrong-answer-content').scrollTop=0;
}

function resetWrExam() {
  WR.answers = {}; WR.submitted = false; WR.examSubmitted = {};
  $('wrong-btn-submit').style.display = '';
  $('wrong-result-panel').classList.add('hidden');
  renderWrongAnswerSheet();
  updateWrongUI();
}

// ── WR EVENT LISTENERS ───────────────────────────────────────
$('btn-wrong-review').addEventListener('click', openWrongReview);
$('wrong-btn-back').addEventListener('click', closeWrongSelector);
$('wrong-screen').addEventListener('click', e => { if (e.target===$('wrong-screen')) closeWrongSelector(); });

$('wrong-exam-back').addEventListener('click', () => {
  stopActiveAudio();
  $('wrong-exam-screen').classList.add('hidden');
  $('wrong-screen').classList.remove('hidden');
  renderWrongSelector();
});
$('wrong-exam-screen').addEventListener('click', e => {
  if (e.target===$('wrong-exam-screen')) { stopActiveAudio(); $('wrong-exam-screen').classList.add('hidden'); $('wrong-screen').classList.remove('hidden'); renderWrongSelector(); }
});

$('wrong-btn-submit').addEventListener('click', () => $('wrong-modal-submit').classList.remove('hidden'));
$('wrong-modal-cancel').addEventListener('click', () => $('wrong-modal-submit').classList.add('hidden'));
$('wrong-modal-confirm').addEventListener('click', () => {
  $('wrong-modal-submit').classList.add('hidden');
  WR.submitted = true; $('wrong-btn-submit').style.display = 'none';
  saveWR();
  markWrAnswers(); showWrResults();
});
$('wrong-modal-submit').addEventListener('click', e => { if (e.target===$('wrong-modal-submit')) $('wrong-modal-submit').classList.add('hidden'); });

$('wrong-btn-reset').addEventListener('click', () => {
  if (confirm('Làm lại từ đầu? Toàn bộ đáp án sẽ bị xoá.')) {
    clearWRSession();
    resetWrExam();
  }
});
$('wrong-btn-review').addEventListener('click', () => { $('wrong-result-panel').classList.add('hidden'); $('wrong-answer-content').scrollTop = 0; });
$('wrong-btn-retry').addEventListener('click', () => { clearWRSession(); resetWrExam(); });

// ── INIT ──────────────────────────────────────────────────────
buildHome();
updateWrongBannerSub();

// Start exam modal
$('modal-start-confirm').addEventListener('click', () => {
  const num = parseInt($('modal-start').dataset.examNum);
  $('modal-start').classList.add('hidden');
  try {
    openExam(num);
  } catch(err) {
    console.error('[openExam error]', err);
    alert('Lỗi mở bài thi: ' + err.message);
  }
});
$('modal-start-cancel').addEventListener('click', () => {
  $('modal-start').classList.add('hidden');
});
$('modal-start-reset').addEventListener('click', () => {
  const num = parseInt($('modal-start').dataset.examNum);
  $('modal-start').classList.add('hidden');
  try {
    localStorage.removeItem(LS_KEY(num));
  } catch(e) {}
  buildHome();
  openExam(num);
});
$('modal-start').addEventListener('click', (e) => {
  if (e.target === $('modal-start')) $('modal-start').classList.add('hidden');
});

// Clear history
$('btn-clear-history').addEventListener('click', () => {
  $('modal-clear').classList.remove('hidden');
});
$('modal-clear-cancel').addEventListener('click', () => {
  $('modal-clear').classList.add('hidden');
});
$('modal-clear-confirm').addEventListener('click', () => {
  for (let i = 1; i <= 20; i++) {
    try { localStorage.removeItem(LS_KEY(i)); } catch(e) {}
  }
  $('modal-clear').classList.add('hidden');
  buildHome();
  updateWrongBannerSub();
});
$('modal-clear').addEventListener('click', (e) => {
  if (e.target === $('modal-clear')) $('modal-clear').classList.add('hidden');
});

})();