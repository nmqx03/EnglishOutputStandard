/* ============================================================
   Ôn Thi Tiếng Anh HUMG – app.js
   Fully hardcoded – no AI API needed
   ============================================================ */
(() => {
'use strict';

// ── STATE ────────────────────────────────────────────────────
const S = {
  exam: null, pages: [], curPage: 0, zoom: 1.0,
  answers: {}, submitted: false,
};
const LS_KEY = (n) => `humg_v2_exam_${n}`;

// ── ACTIVE AUDIO (singleton – only one playing at a time) ────
let activeAudioCtx = null; // { audio, playBtn, progressFill }
function stopActiveAudio() {
  if (!activeAudioCtx) return;
  const { audio, playBtn, progressFill } = activeAudioCtx;
  if (!audio.paused) audio.pause();
  playBtn.textContent = '▶';
  playBtn.classList.remove('playing');
  activeAudioCtx = null;
}

// ── DOM ──────────────────────────────────────────────────────
const $  = (id) => document.getElementById(id);
const CE = (tag, attrs = {}) => Object.assign(document.createElement(tag), attrs);

const homeScreen    = $('home-screen');
const examScreen    = $('exam-screen');
const examGrid      = $('exam-grid');
const navTitle      = $('nav-title');
const pdfImg        = $('pdf-img');
const pdfImgWrap    = $('pdf-img-wrap');
const thumbStrip    = $('thumb-strip');
const pageInd       = $('page-indicator');
const zoomVal       = $('zoom-val');
const answerContent = $('answer-content');
const answerStatus  = $('answer-status');
const resultPanel   = $('result-panel');
const scoreBadge    = $('score-badge');
const scoreText     = $('score-text');

// ── HOME ─────────────────────────────────────────────────────
function buildHome() {
  examGrid.innerHTML = '';
  for (let i = 1; i <= 20; i++) {
    const pages = (EXAM_DATA[i] || []).length;
    const saved = loadSaved(i);
    const done  = saved?.submitted;
    const score = saved?.score;
    const card  = CE('div', { className: 'exam-card' + (done ? ' done' : '') });
    const scoreHtml = done && score
      ? `<div class="card-score ${score.pct >= 70 ? 'score-hi' : score.pct >= 40 ? 'score-mid' : 'score-lo'}">
           <span class="score-num">${score.correct}/${score.total}</span>
           <span class="score-pct">${score.pct}%</span>
         </div>`
      : '';
    card.innerHTML = `
      <div class="card-num">Đề số</div>
      <div class="card-title">${String(i).padStart(2,'0')}</div>
      <div class="card-tags">
        <span class="tag tag-rw">Reading</span>
        <span class="tag tag-rw">Writing</span>
        <span class="tag tag-ls">Listening</span>
      </div>
      <div class="card-pages">${pages} trang</div>
      ${scoreHtml}
      <div class="card-done">✓ Đã làm</div>`;
    card.addEventListener('click', () => openExam(i));
    examGrid.appendChild(card);
  }
}

// ── SAVE / LOAD ───────────────────────────────────────────────
function loadSaved(n) {
  try { return JSON.parse(localStorage.getItem(LS_KEY(n)) || 'null'); } catch { return null; }
}
function save(scoreData) {
  try {
    const prev = loadSaved(S.exam) || {};
    const payload = { answers: S.answers, submitted: S.submitted };
    if (scoreData) payload.score = scoreData;
    else if (prev.score) payload.score = prev.score;
    localStorage.setItem(LS_KEY(S.exam), JSON.stringify(payload));
  } catch {}
}

// ── OPEN EXAM ─────────────────────────────────────────────────
function openExam(num) {
  const pages = EXAM_DATA[num];
  if (!pages?.length) { alert('Không tìm thấy dữ liệu đề ' + num); return; }

  S.exam = num; S.pages = pages; S.curPage = 0; S.zoom = 1.0;
  S.answers = {}; S.submitted = false;

  const saved = loadSaved(num);
  if (saved) { S.answers = saved.answers || {}; S.submitted = saved.submitted || false; }

  navTitle.textContent = `Đề ${num}`;
  document.title = `Đề ${num} – Ôn Thi Tiếng Anh HUMG`;
  homeScreen.classList.add('hidden');
  examScreen.classList.remove('hidden');

  buildThumbs();
  showPage(0);
  renderAnswerSheet();
  updateUI();

  if (S.submitted) markAnswers();
}

// ── PDF VIEWER ────────────────────────────────────────────────
function buildThumbs() {
  thumbStrip.innerHTML = '';
  S.pages.forEach((src, i) => {
    const div = CE('div', { className: 'thumb-item' + (i === 0 ? ' active' : '') });
    const img = CE('img', { src, loading: 'lazy', alt: `Trang ${i + 1}` });
    div.appendChild(img);
    div.addEventListener('click', () => showPage(i));
    thumbStrip.appendChild(div);
  });
}

function showPage(idx) {
  if (idx < 0 || idx >= S.pages.length) return;
  S.curPage = idx;
  pdfImg.src = S.pages[idx];
  pdfImgWrap.style.transform = `scale(${S.zoom})`;
  pdfImgWrap.style.transformOrigin = 'top center';
  pageInd.textContent = `${idx + 1} / ${S.pages.length}`;
  $('btn-prev-page').disabled = idx === 0;
  $('btn-next-page').disabled = idx >= S.pages.length - 1;
  thumbStrip.querySelectorAll('.thumb-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
    if (i === idx) el.scrollIntoView({ inline: 'nearest' });
  });
  $('pdf-viewer').scrollTop = 0;
  $('pdf-viewer').scrollLeft = 0;
}

function setZoom(z) {
  S.zoom = Math.max(0.4, Math.min(3, z));
  pdfImgWrap.style.transform = `scale(${S.zoom})`;
  zoomVal.textContent = Math.round(S.zoom * 100) + '%';
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
    // Section header
    const sh = CE('div', { className: 'sec-hdr', textContent: sec.label });
    answerContent.appendChild(sh);

    (sec.parts || []).forEach(part => {
      const blk = CE('div', { className: 'part-blk' });
      if (part.instruction) {
        blk.appendChild(CE('div', { className: 'part-inst', textContent: part.instruction }));
      }
      if (part.audioSrc) {
        blk.appendChild(renderAudioPlayer(part.audioSrc, part.id));
      }

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

  // Restore saved answers
  if (Object.keys(S.answers).length) restoreAnswers();
}

// ── MCQ ───────────────────────────────────────────────────────
function renderMCQ(secId, part) {
  const wrap = CE('div');
  (part.questions || []).forEach(q => {
    const qk = key(secId, part.id, q.num);
    const row = CE('div', { className: 'q-row', id: `qrow_${qk}` });

    // Stem
    if (q.stem && !q.stem.match(/^\d+$/)) {
      const stem = CE('div', { className: 'q-stem' });
      stem.innerHTML = `<span class="q-num">${q.num}.</span> ${esc(q.stem)}`;
      row.appendChild(stem);
    } else {
      const stem = CE('div', { className: 'q-stem' });
      stem.innerHTML = `<span class="q-num">${q.num}.</span>`;
      row.appendChild(stem);
    }

    // Choices
    const ch = CE('div', { className: 'choices' });
    const labels = ['A','B','C'];
    (q.opts || []).forEach((opt, idx) => {
      const btn = CE('button', { className: 'cbtn', textContent: `${labels[idx]}  ${opt}` });
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
  S.answers[k] = val;
  answerContent.querySelectorAll(`.cbtn[data-sec="${sec}"][data-part="${part}"][data-num="${num}"]`)
    .forEach(b => b.classList.toggle('selected', b.dataset.val === val));
  updateAnswerStatus();
  save();
}

// ── MATCHING ──────────────────────────────────────────────────
function renderMatching(secId, part) {
  const wrap = CE('div');
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

function onMatchChange(e) {
  if (S.submitted) return;
  const { sec, part, num } = e.target.dataset;
  S.answers[key(sec, part, num)] = e.target.value;
  updateAnswerStatus();
  save();
}

// ── AUDIO PLAYER ─────────────────────────────────────────────
function renderAudioPlayer(baseSrc, partId) {
  const wrap = CE('div', { className: 'audio-player-wrap', id: `audio_${partId}` });
  const inner = CE('div', { className: 'audio-player' });
  const playBtn = CE('button', { className: 'audio-play-btn', innerHTML: '▶', title: 'Phát / Dừng' });
  const timeEl = CE('span', { className: 'audio-time', textContent: '0:00 / 0:00' });
  const progressWrap = CE('div', { className: 'audio-progress-wrap' });
  const progressBar = CE('div', { className: 'audio-progress-bar' });
  const progressFill = CE('div', { className: 'audio-progress-fill' });
  progressBar.appendChild(progressFill);
  progressWrap.appendChild(progressBar);
  const speedSel = CE('select', { className: 'audio-speed' });
  [['0.75×', 0.75], ['1×', 1], ['1.25×', 1.25], ['1.5×', 1.5]].forEach(([label, val]) => {
    const opt = CE('option', { value: val, textContent: label });
    if (val === 1) opt.selected = true;
    speedSel.appendChild(opt);
  });
  inner.appendChild(playBtn);
  inner.appendChild(progressWrap);
  inner.appendChild(timeEl);
  inner.appendChild(speedSel);
  wrap.appendChild(inner);

  const exts = ['mp3', 'ogg', 'wav', 'm4a'];
  let audio = null, triedIdx = 0;
  function fmt(s) { s = Math.floor(s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  function initAudio() {
    if (audio) return;
    audio = new Audio();
    audio.preload = 'metadata';
    function tryNext() {
      if (triedIdx >= exts.length) {
        playBtn.textContent = '⚠'; playBtn.title = 'Không tìm thấy file audio'; playBtn.disabled = true; return;
      }
      audio.src = `${baseSrc}.${exts[triedIdx++]}`; audio.load();
    }
    audio.onerror = tryNext;
    audio.addEventListener('loadedmetadata', () => { timeEl.textContent = `0:00 / ${fmt(audio.duration)}`; });
    audio.addEventListener('timeupdate', () => {
      const pct = audio.duration ? (audio.currentTime / audio.duration * 100) : 0;
      progressFill.style.width = pct + '%';
      timeEl.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
    });
    audio.addEventListener('ended', () => {
      playBtn.textContent = '▶'; playBtn.classList.remove('playing');
      progressFill.style.width = '0%';
      if (activeAudioCtx?.audio === audio) activeAudioCtx = null;
    });
    tryNext();
  }

  playBtn.addEventListener('click', () => {
    initAudio();
    if (audio.paused) {
      // Stop whichever other audio is playing
      stopActiveAudio();
      audio.play().then(() => {
        playBtn.textContent = '⏸'; playBtn.classList.add('playing');
        activeAudioCtx = { audio, playBtn, progressFill };
      }).catch(() => {});
    } else {
      audio.pause(); playBtn.textContent = '▶'; playBtn.classList.remove('playing');
      if (activeAudioCtx?.audio === audio) activeAudioCtx = null;
    }
  });

  progressWrap.addEventListener('click', (e) => {
    initAudio();
    if (!audio.duration) return;
    const rect = progressWrap.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  });
  speedSel.addEventListener('change', () => { if (audio) audio.playbackRate = parseFloat(speedSel.value); });
  return wrap;
}

// ── IMAGE LOADER (tries extensions if none present) ──────────
function loadImgWithFallback(img, imgWrap, baseSrc) {
  const hasExt = /\.(jpe?g|png|gif|webp)$/i.test(baseSrc);
  if (hasExt) {
    img.src = baseSrc;
    img.onerror = () => { imgWrap.classList.add('fill-img-missing'); imgWrap.innerHTML = `<span class="fill-img-placeholder">📷 Ảnh đề: ${baseSrc}</span>`; };
    return;
  }
  const exts = ['jpg', 'png', 'jpeg'];
  let idx = 0;
  function tryNext() {
    if (idx >= exts.length) { imgWrap.classList.add('fill-img-missing'); imgWrap.innerHTML = `<span class="fill-img-placeholder">📷 Ảnh đề: ${baseSrc}</span>`; return; }
    img.src = `${baseSrc}.${exts[idx++]}`; img.onerror = tryNext;
  }
  img.onerror = tryNext;
  img.src = `${baseSrc}.${exts[idx++]}`;
}

// ── WORD FILL / TEXT FILL ────────────────────────────────────
// Supports part.groups = [{label, imgSrc, nums:[41,42,43,44]}, ...]
// If no groups defined, renders all questions flat (legacy)
function renderWordFill(secId, part) {
  const wrap = CE('div');
  const questions = part.questions || [];
  const examNum = S.exam;

  if (part.groups && part.groups.length) {
    part.groups.forEach(grp => {
      const grpWrap = CE('div', { className: 'fill-group' });

      // Group label
      if (grp.label) {
        grpWrap.appendChild(CE('div', { className: 'fill-group-label', textContent: grp.label }));
      }

      // Excerpt image
      const imgSrc = grp.imgSrc || `images/exam${examNum}_${part.id}_${grp.nums[0]}.jpg`;
      const imgWrap = CE('div', { className: 'fill-img-wrap' });
      const img = CE('img', { className: 'fill-img', alt: `Đề ${examNum}` });
      loadImgWithFallback(img, imgWrap, imgSrc);
      imgWrap.appendChild(img);
      grpWrap.appendChild(imgWrap);

      // Questions for this group
      const grpNums = new Set(grp.nums);
      questions.filter(q => grpNums.has(q.num)).forEach(q => {
        grpWrap.appendChild(buildFillRow(secId, part, q));
      });

      wrap.appendChild(grpWrap);
    });
  } else {
    // Flat legacy
    questions.forEach(q => wrap.appendChild(buildFillRow(secId, part, q)));
  }
  return wrap;
}

function buildFillRow(secId, part, q) {
  const k = key(secId, part.id, q.num);
  const row = CE('div', { className: 'fill-row', id: `qrow_${k}` });

  const hasStem = q.stem && !q.stem.match(/^\(Xem/);
  if (hasStem) {
    const stem = CE('div', { className: 'q-stem' });
    stem.innerHTML = `<span class="q-num">${q.num}.</span> ${esc(q.stem)}${q.hint ? `<span class="fill-hint"> (${esc(q.hint)})</span>` : ''}`;
    row.appendChild(stem);
  }

  const inpRow = CE('div', { className: 'fill-inp-row' });
  inpRow.appendChild(CE('span', { className: 'fill-num-badge', textContent: `${q.num}.` }));
  const inp = CE('input', { className: 'fill-inp', type: 'text', placeholder: 'Nhập từ...', id: `inp_${k}`, autocomplete: 'off' });
  inp.dataset.sec = secId; inp.dataset.part = part.id; inp.dataset.num = q.num;
  inp.addEventListener('input', onFillInput);
  inpRow.appendChild(inp);
  row.appendChild(inpRow);
  row.appendChild(CE('div', { className: 'q-fb', id: `fb_${k}` }));
  return row;
}

// ── FORM FILL ─────────────────────────────────────────────────
// Supports optional part.imgSrc for a form image above the fields
function renderFormFill(secId, part) {
  const wrap = CE('div');
  const examNum = S.exam;
  const grp = CE('div', { className: 'fill-group' });

  // Group label
  const lbText = part.form_title || 'Questions 51–55';
  grp.appendChild(CE('div', { className: 'fill-group-label', textContent: lbText }));

  // Excerpt image
  const imgSrc = part.imgSrc || `images/exam${examNum}_${part.id}.jpg`;
  const imgWrap = CE('div', { className: 'fill-img-wrap' });
  const img = CE('img', { className: 'fill-img', alt: `Form đề ${examNum}` });
  loadImgWithFallback(img, imgWrap, imgSrc);
  imgWrap.appendChild(img);
  grp.appendChild(imgWrap);

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
    // MCQ button
    const btn = answerContent.querySelector(`.cbtn[data-sec="${secId}"][data-part="${partId}"][data-num="${num}"][data-val="${val}"]`);
    if (btn) {
      answerContent.querySelectorAll(`.cbtn[data-sec="${secId}"][data-part="${partId}"][data-num="${num}"]`)
        .forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      return;
    }
    // Matching select
    const sel = $(`sel_${k}`);
    if (sel) { sel.value = val; return; }
    // Input / textarea
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
      const items = part.type === 'matching' ? part.questions : part.questions;
      (items || []).forEach(q => {
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
  answerStatus.textContent = `${done}/${total} câu đã làm`;
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

  // Disable all inputs
  answerContent.querySelectorAll('.cbtn, .match-sel, input, textarea')
    .forEach(el => { el.disabled = true; });

  data.sections.forEach(sec => {
    (sec.parts || []).forEach(part => {
      if (part.type === 'writing') return;

      if (part.type === 'matching') {
        const correctMap = part.answers || {};
        (part.questions || []).forEach(item => {
          const k = key(sec.id, part.id, item.num);
          const correct = correctMap[item.num];
          const user = S.answers[k];
          const sel = $(`sel_${k}`);
          const fb = $(`fb_${k}`);
          if (!correct) return;
          if (sel) sel.classList.add(user === String(correct) ? 'correct-fill' : 'wrong-fill');
          if (fb) {
            fb.className = 'q-fb ' + (user === String(correct) ? 'ok' : 'bad');
            fb.textContent = user === String(correct) ? '✓ Đúng' : `✗ Đáp án: ${correct}`;
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
          if (q.alts) q.alts.forEach(a => accepted.push(a.toLowerCase().trim()));
          const isOk = userLow !== '' && accepted.some(a => a && userLow === a);
          const displayAns = Array.isArray(q.ans) ? q.ans.join(' / ') : (q.ans || '');
          const hasAns = Array.isArray(q.ans) ? q.ans.some(a => a) : !!q.ans;
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
          if (!user) skip++; else if (user === ans) correct++; else wrong++;
        });
        return;
      }

      (part.questions || []).forEach(q => {
        const user = (S.answers[key(sec.id, part.id, q.num)] || '').toLowerCase().trim();
        // Build accepted list
        const accepted = Array.isArray(q.ans)
          ? q.ans.map(a => a.toLowerCase().trim())
          : [(q.ans || '').toLowerCase().trim()];
        if (q.alts) q.alts.forEach(a => accepted.push(a.toLowerCase().trim()));
        const hasAns = accepted.some(a => a.length > 0);
        if (!hasAns) return;
        if (!user) skip++;
        else if (accepted.some(a => a && user === a)) correct++;
        else wrong++;
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
  save();
  answerContent.querySelectorAll('.cbtn').forEach(b => { b.disabled = false; b.classList.remove('selected','correct','wrong-sel'); });
  answerContent.querySelectorAll('.match-sel').forEach(s => { s.disabled = false; s.value = ''; s.classList.remove('correct-fill','wrong-fill'); });
  answerContent.querySelectorAll('input').forEach(i => { i.disabled = false; i.value = ''; i.classList.remove('correct-fill','wrong-fill'); });
  answerContent.querySelectorAll('textarea').forEach(t => { t.disabled = false; t.value = ''; });
  answerContent.querySelectorAll('.q-fb').forEach(f => { f.textContent = ''; f.className = 'q-fb'; });
  answerContent.querySelectorAll('.wc').forEach(w => { w.textContent = '0 từ'; });
  resultPanel.classList.add('hidden');
  scoreBadge.classList.add('hidden');
  updateUI();
}

// ── HELPERS ───────────────────────────────────────────────────
function key(secId, partId, num) { return `${secId}_${partId}_${num}`; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── EVENT LISTENERS ───────────────────────────────────────────
$('btn-back').addEventListener('click', () => {
  stopActiveAudio();
  examScreen.classList.add('hidden');
  homeScreen.classList.remove('hidden');
  document.title = 'Ôn Thi Tiếng Anh – HUMG';
  buildHome();
});

$('btn-prev-page').addEventListener('click', () => showPage(S.curPage - 1));
$('btn-next-page').addEventListener('click', () => showPage(S.curPage + 1));
$('btn-zoom-in').addEventListener('click', () => setZoom(S.zoom + 0.15));
$('btn-zoom-out').addEventListener('click', () => setZoom(S.zoom - 0.15));

$('btn-submit').addEventListener('click', () => $('modal-submit').classList.remove('hidden'));
$('modal-cancel').addEventListener('click', () => $('modal-submit').classList.add('hidden'));
$('modal-confirm').addEventListener('click', () => {
  $('modal-submit').classList.add('hidden');
  S.submitted = true;
  $('btn-submit').style.display = 'none';
  markAnswers();
  const scoreData = showResults();
  save(scoreData);
  // Update home card immediately with score
  const cards = examGrid.querySelectorAll('.exam-card');
  const card = cards[S.exam - 1];
  if (card) {
    card.classList.add('done');
    const existing = card.querySelector('.card-score');
    if (existing) existing.remove();
    if (scoreData) {
      const scoreDiv = CE('div', {
        className: `card-score ${scoreData.pct >= 70 ? 'score-hi' : scoreData.pct >= 40 ? 'score-mid' : 'score-lo'}`
      });
      scoreDiv.innerHTML = `<span class="score-num">${scoreData.correct}/${scoreData.total}</span><span class="score-pct">${scoreData.pct}%</span>`;
      card.appendChild(scoreDiv);
    }
  }
});

$('btn-reset').addEventListener('click', () => {
  if (confirm('Làm lại từ đầu? Toàn bộ đáp án sẽ bị xoá.')) resetExam();
});

$('btn-review').addEventListener('click', () => {
  resultPanel.classList.add('hidden');
  answerContent.scrollTop = 0;
});
$('btn-retry').addEventListener('click', resetExam);

// Nav tabs (mobile)
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const t = tab.dataset.tab;
    $('panel-exam').style.display = t === 'answer' ? 'none' : '';
    $('panel-answer').classList.toggle('open', t === 'answer');
  });
});

// Keyboard
document.addEventListener('keydown', e => {
  if (examScreen.classList.contains('hidden')) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); showPage(S.curPage + 1); }
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); showPage(S.curPage - 1); }
  if (e.key === '+' || e.key === '=') setZoom(S.zoom + 0.15);
  if (e.key === '-') setZoom(S.zoom - 0.15);
  if (e.key === 'Escape') $('modal-submit').classList.add('hidden');
});

// Touch swipe
let tx0 = 0;
$('pdf-viewer').addEventListener('touchstart', e => { tx0 = e.touches[0].clientX; }, { passive: true });
$('pdf-viewer').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - tx0;
  if (Math.abs(dx) > 55) showPage(dx < 0 ? S.curPage + 1 : S.curPage - 1);
});

// ── INIT ──────────────────────────────────────────────────────
buildHome();

})();