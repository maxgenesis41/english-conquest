// 영어정복: 화면 이동 + 저장값 표시 (2단계). 화면을 그릴 때는 읽기만 하고 저장하지 않는다.
// 주소 끝 #game 같은 값은 미리보기용
(function () {
  "use strict";

  var STAGES = [
    { n: 1, name: "입문", cefr: "A1", color: "var(--green)" },
    { n: 2, name: "초급", cefr: "A2", color: "var(--blue)" },
    { n: 3, name: "초중급", cefr: "B1", color: "var(--orange)" },
    { n: 4, name: "중급 (인터미디어)", cefr: "B2", color: "var(--pink)" }
  ];

  // 홈: 단계 카드(열림/잠김, 최고 등급)와 단어장 개수
  function renderHome() {
    var p = EJ.get("progress");
    var html = "";
    for (var i = 0; i < STAGES.length; i++) {
      var s = STAGES[i];
      var st = p.stages[String(s.n)];
      if (st.unlocked) {
        html += '<button class="chunk stage" data-go="modes" data-n="' + s.n + '" data-stage="' + s.name + '" style="--c:' + s.color + '">' +
          '<span class="tile pop">' + s.cefr + '</span>' +
          '<span class="txt"><div class="name">' + s.name + '</div><div class="meta">' + (st.best ? "최고 등급 " + st.best : "기록 없음") + '</div></span>' +
          '<span class="grade' + (st.best ? "" : " none") + '">' + (st.best ? st.best : "-") + '</span></button>';
      } else {
        html += '<button class="chunk stage locked" disabled>' +
          '<span class="tile pop">' + s.cefr + '</span>' +
          '<span class="txt"><div class="name">' + s.name + '</div><div class="meta">' + STAGES[i - 1].name + ' B등급 이상 필요</div></span>' +
          '<svg class="ic lock"><use href="#i-lock"/></svg></button>';
      }
    }
    document.getElementById("stage-list").innerHTML = html;
    document.getElementById("wb-count").textContent = String(EJ.get("wordbook").items.length);
  }

  function wordById(id) {
    for (var i = 0; i < WORDS.length; i++) if (WORDS[i].id === id) return WORDS[i];
    return null;
  }

  // 단어장: 맞힌 단어를 최근 순으로 표시. 없으면 빈 상태 화면
  function renderWordbook() {
    var items = EJ.get("wordbook").items.slice().reverse();
    var list = document.getElementById("wb-list");
    list.textContent = "";
    document.getElementById("wb-full").style.display = items.length ? "block" : "none";
    document.getElementById("wb-empty").style.display = items.length ? "none" : "block";
    document.getElementById("wb-sum").textContent = "모은 단어 " + items.length + "개";
    for (var i = 0; i < items.length; i++) {
      var w = wordById(items[i].id);
      var row = document.createElement("div");
      row.className = "chunk word";
      var e = document.createElement("span"); e.className = "e"; e.textContent = w ? w.en : items[i].id;
      var k = document.createElement("span"); k.className = "k"; k.textContent = w ? w.ko : "?";
      row.appendChild(e); row.appendChild(k);
      list.appendChild(row);
    }
  }

  // ===== 게임 흐름 (3단계) =====
  var cur = null;       // 진행 중인 판 상태(Game.start 결과)
  var timer = null;     // 정답 후 자동 넘김
  var lastStage = 1, lastMode = "letter";
  function $(id) { return document.getElementById(id); }
  function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }

  function wordsOfStage(n, mode) {
    var src = mode === "sentence" ? SENTENCES : WORDS, out = [];
    for (var i = 0; i < src.length; i++) if (src[i].level === n) out.push(src[i]);
    return out;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderHp() {
    var box = $("g-hp"); box.textContent = "";
    for (var i = 0; i < 5; i++) box.appendChild(el("i", i < cur.hp ? "" : "off"));
  }

  // 소리: 브라우저 내장 음성(Web Speech API). 영어 음성이 없으면 듣기 모드를 막는다
  var Sound = (function () {
    function api() { return window.speechSynthesis && window.SpeechSynthesisUtterance ? window.speechSynthesis : null; }
    function voices() { try { var s = api(); return s ? (s.getVoices() || []) : []; } catch (e) { return []; } }
    function enVoices() { var v = voices(), o = []; for (var i = 0; i < v.length; i++) if (/^en/i.test(v[i].lang || "")) o.push(v[i]); return o; }
    // 음성 목록이 아직 비어 있으면(비동기 로딩) 일단 가능으로 본다
    function ok() { if (!api()) return false; return voices().length === 0 || enVoices().length > 0; }
    function pick() { var e = enVoices(); for (var i = 0; i < e.length; i++) if (/^en[-_]US$/i.test(e[i].lang)) return e[i]; return e[0] || null; }
    function speak(text, onstart, onend) {
      var s = api(); if (!s) return false;
      try {
        s.cancel();
        var u = new window.SpeechSynthesisUtterance(text);
        u.lang = "en-US"; u.rate = 0.85;
        var v = pick(); if (v) u.voice = v;
        u.onstart = onstart; u.onend = onend; u.onerror = onend;
        s.speak(u); return true;
      } catch (e) { return false; }
    }
    function stop() { try { var s = api(); if (s) s.cancel(); } catch (e) {} }
    return { ok: ok, speak: speak, stop: stop };
  })();
  var playTimer = null;
  function speakCurrent() {
    if (!cur || cur.mode !== "listen") return;
    var q = Game.current(cur), b = $("g-spk");
    if (!b) return;
    function off() { if (playTimer) { clearTimeout(playTimer); playTimer = null; } b.classList.remove("on"); }
    b.classList.add("on");
    if (playTimer) clearTimeout(playTimer);
    playTimer = setTimeout(off, 4000);
    if (!Sound.ok() || !Sound.speak(q.en, null, off)) off();
  }

  var spell = null;     // 철자 쓰기 진행: {seq:[{t:타일번호, lock:힌트로 채움}]}
  var MODE_NAMES = { letter: "글자 맞추기", meaning: "뜻 맞추기", spell: "철자 쓰기", sentence: "문장 배열", listen: "듣기" };
  function items(q) { return q.letters || q.pool; }   // 순서 모드의 섞인 조각(글자 또는 단어)

  function renderQuestion() {
    var q = Game.current(cur);
    renderHp();
    $("g-score").textContent = String(cur.score);
    $("g-count").textContent = (cur.index + 1) + " / 10";
    $("g-bar").style.width = (cur.index * 10) + "%";
    $("g-combo").textContent = String(cur.combo);
    var hb = $("g-hint");
    hb.textContent = "힌트 " + cur.hintsLeft;
    hb.disabled = cur.hintsLeft <= 0;
    $("g-say").textContent = "";
    $("g-next").style.display = "none";
    var isSpell = cur.mode === "spell", isSent = cur.mode === "sentence", isOrder = isSpell || isSent;
    $("g-erase").style.display = isOrder ? "" : "none";
    spell = isOrder ? { seq: [] } : null;
    var card = $("g-card"); card.textContent = "";
    var box = $("g-opts"); box.textContent = "";
    box.className = "opts";
    if (cur.mode === "letter") {
      card.appendChild(el("div", "sub", "빈칸에 들어갈 글자는?"));
      var ko = el("div", "ko", q.ko); ko.style.cssText = "font-size:26px;font-weight:700;margin:8px 0 14px";
      card.appendChild(ko);
      var t = el("div", "tiles" + (q.en.length > 12 ? " xs" : q.en.length > 8 ? " sm" : ""));
      t.id = "g-tiles";
      for (var i = 0; i < q.en.length; i++) t.appendChild(el("span", i === q.blank ? "blank" : "", i === q.blank ? "?" : q.en.charAt(i)));
      card.appendChild(t);
    } else if (isSpell) {
      card.appendChild(el("div", "sub", "뜻에 맞게 글자를 눌러 주세요"));
      var ko2 = el("div", "ko", q.ko); ko2.style.cssText = "font-size:26px;font-weight:700;margin:8px 0 14px";
      card.appendChild(ko2);
      var n = q.letters.length;
      var sl = el("div", "slots" + (n > 12 ? " xs" : n > 8 ? " sm" : ""));
      sl.id = "g-slots"; sl.style.setProperty("--n", String(n));
      for (var j = 0; j < n; j++) sl.appendChild(el("span", "sl0"));
      card.appendChild(sl);
      box.className = "pool" + (n > 8 ? " sm" : "");
      renderSpell();
    } else if (isSent) {
      card.appendChild(el("div", "sub", "뜻에 맞게 단어를 순서대로 눌러 주세요"));
      var ko3 = el("div", "ko", q.ko); ko3.style.cssText = "font-size:23px;font-weight:700;margin:8px 0 12px;word-break:keep-all";
      card.appendChild(ko3);
      var sent = el("div", "sent"); sent.id = "g-sent";
      card.appendChild(sent);
      box.className = "wpool";
      renderSpell();
    } else if (cur.mode === "listen") {
      card.appendChild(el("div", "sub", "소리를 듣고 알맞은 단어를 골라 주세요"));
      var sp = el("button", "spk"); sp.id = "g-spk"; sp.setAttribute("aria-label", "다시 듣기");
      sp.innerHTML = '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" fill="#fff"/><path d="M15.5 9a4.2 4.2 0 010 6"/><path d="M18 6.5a8 8 0 010 11"/></svg>';
      card.appendChild(sp);
      card.appendChild(el("div", "hint2", "누르면 다시 들려요"));
    } else {
      card.appendChild(el("div", "sub", "이 단어의 뜻은?"));
      card.appendChild(el("div", "en", q.en));
    }
    if (!isOrder) {
      for (var k = 0; k < q.options.length; k++) {
        var b = el("button", "opt" + (cur.mode === "meaning" ? " txt" : cur.mode === "listen" ? " en" : ""), q.options[k]);
        b.dataset.i = String(k);
        box.appendChild(b);
      }
    }
    var first = box.querySelector(".opt");
    if (first) first.focus();
    if (cur.mode === "listen") setTimeout(speakCurrent, 250);   // 문제가 나오면 한 번 자동 재생(기기가 막으면 버튼으로)
  }

  // 철자 쓰기: 칸과 타일을 현재 입력(spell.seq)에 맞게 다시 그린다
  function renderSpell() {
    var q = Game.current(cur), seq = spell.seq, arr = items(q), n = arr.length, i;
    if (cur.mode === "sentence") {
      var area = $("g-sent"); area.textContent = "";
      if (!seq.length) area.appendChild(el("span", "ph", "단어를 눌러 문장을 만드세요"));
      for (i = 0; i < seq.length; i++) area.appendChild(el("span", "wd" + (seq[i].lock ? " hintfill" : ""), arr[seq[i].t]));
    } else {
      var slots = $("g-slots").children;
      for (i = 0; i < n; i++) {
        var s = slots[i];
        if (i < seq.length) { s.textContent = arr[seq[i].t]; s.className = seq[i].lock ? "hintfill" : ""; }
        else { s.textContent = "·"; s.className = "sl0" + (i === seq.length && cur.picked === null ? " cur" : ""); }
      }
    }
    var box = $("g-opts"), used = {};
    for (i = 0; i < seq.length; i++) used[seq[i].t] = true;
    if (!box.children.length) {
      for (var k = 0; k < n; k++) { var b = el("button", "opt", arr[k]); b.dataset.i = String(k); box.appendChild(b); }
    }
    for (var m = 0; m < n; m++) {
      var tb = box.children[m], u = !!used[m];
      tb.className = "opt" + (u ? " used" : "");
      tb.disabled = u || cur.picked !== null;
    }
    var canErase = false;
    for (i = 0; i < seq.length; i++) if (!seq[i].lock) canErase = true;
    $("g-erase").disabled = !canErase || cur.picked !== null;
  }

  function spellAdd(t) {
    if (!cur || !spell || cur.picked !== null) return;
    var q = Game.current(cur);
    for (var i = 0; i < spell.seq.length; i++) if (spell.seq[i].t === t) return;
    spell.seq.push({ t: t, lock: false });
    renderSpell();
    if (spell.seq.length === items(q).length) spellFinish();
  }

  function spellErase() {
    if (!cur || !spell || cur.picked !== null) return;
    var s = spell.seq;
    if (!s.length || s[s.length - 1].lock) return;
    s.pop();
    renderSpell();
  }

  function spellWord() {
    var q = Game.current(cur), arr = items(q), parts = [];
    for (var i = 0; i < spell.seq.length; i++) parts.push(arr[spell.seq[i].t]);
    return parts.join(cur.mode === "sentence" ? " " : "");
  }

  function spellFinish() {
    var q = Game.current(cur);
    var r = Game.submit(cur, spellWord());
    if (!r) return;
    var i, k;
    if (cur.mode === "sentence") {
      var chips = $("g-sent").children;
      for (i = 0; i < chips.length; i++) chips[i].className = "wd " + (r.correct ? "fill" : "bad");
      $("g-sent").classList.add("done");
    } else {
      var slots = $("g-slots").children;
      for (i = 0; i < slots.length; i++) slots[i].className = r.correct ? "fill" : "bad";
    }
    var box = $("g-opts").children;
    for (k = 0; k < box.length; k++) { box[k].disabled = true; box[k].className = "opt used"; }
    $("g-erase").disabled = true;
    feedback(r, q, cur.mode === "sentence" ? "아쉬워요. 정답은 \"" + q.en + "\"예요" : "아쉬워요. 정답은 " + q.en + "이에요");
  }

  function startGame(stage, mode) {
    clearTimer();
    lastStage = stage; lastMode = mode;
    if (mode === "listen" && !Sound.ok()) return false;
    var g = Game.start({ stage: stage, mode: mode, words: wordsOfStage(stage, mode) });
    if (!g) return false;
    cur = g;
    show("game");
    renderQuestion();
    return true;
  }

  // 정답/오답 공통 표시: 점수·연속·체력·안내 문구·다음 버튼
  function feedback(r, q, wrongText) {
    $("g-hint").disabled = true;
    $("g-score").textContent = String(cur.score);
    $("g-combo").textContent = String(cur.combo);
    renderHp();
    var say = el("div", "say " + (r.correct ? "good" : "bad"));
    if (r.correct) {
      say.textContent = "정답이에요!" + (r.healed ? " 체력 +1" : "");
      $("g-card").appendChild(el("span", "gain", "+" + r.gain));
    } else {
      say.textContent = wrongText;
    }
    var sayBox = $("g-say"); sayBox.textContent = ""; sayBox.appendChild(say);
    if (r.correct && !r.over && !r.last) {
      timer = setTimeout(next, 800);
    } else {
      var nb = $("g-next");
      nb.textContent = (r.over || r.last) ? "결과 보기" : "다음 문제";
      nb.style.display = "block";
      nb.focus();
    }
  }

  function onPick(i) {
    if (!cur || cur.picked != null || cur.finished) return;
    if (spell) { spellAdd(i); return; }
    var q = Game.current(cur);
    var r = Game.pick(cur, i);
    if (!r) return;
    var opts = $("g-opts").querySelectorAll(".opt");
    for (var k = 0; k < opts.length; k++) {
      opts[k].disabled = true;
      if (k === q.answer) opts[k].classList.add("right");
      else if (k === i) opts[k].classList.add("wrong");
      else opts[k].classList.add("dim");
    }
    if (cur.mode === "letter") {
      var tl = $("g-tiles").children[q.blank];
      tl.textContent = q.options[q.answer];
      tl.className = r.correct ? "fill" : "bad";
    }
    if (cur.mode === "listen") $("g-card").appendChild(el("div", "reveal", q.en + " = " + q.ko));
    feedback(r, q, cur.mode === "meaning" ? "아쉬워요. " + q.en + " = " + q.ko : "아쉬워요. 정답은 " + q.en + "이에요");
  }

  function next() {
    clearTimer();
    if (!cur) return;
    if (Game.advance(cur)) renderQuestion();
    else finish();
  }

  function onHint() {
    if (!cur || cur.picked != null) return;
    if (spell) {
      var q = Game.current(cur);
      if (!Game.hintSpell(cur)) return;
      // 맞게 입력된 앞부분만 남기고, 다음 정답 글자(단어)를 힌트로 채운다
      var arr = items(q), seq = spell.seq, keep = 0;
      var correctAt = cur.mode === "sentence" ? function (n) { return q.tokens[n]; } : function (n) { return q.answer.charAt(n); };
      while (keep < seq.length && arr[seq[keep].t] === correctAt(keep)) keep++;
      seq.length = keep;
      var used = {}, i;
      for (i = 0; i < seq.length; i++) used[seq[i].t] = true;
      var want = correctAt(seq.length);
      for (i = 0; i < arr.length; i++) if (!used[i] && arr[i] === want) { seq.push({ t: i, lock: true }); break; }
      var hb2 = $("g-hint"); hb2.textContent = "힌트 " + cur.hintsLeft; hb2.disabled = true;
      renderSpell();
      if (seq.length === arr.length) spellFinish();
      return;
    }
    var rem = Game.hint(cur);
    if (!rem) return;
    var opts = $("g-opts").querySelectorAll(".opt");
    for (var k = 0; k < rem.length; k++) { opts[rem[k]].disabled = true; opts[rem[k]].classList.add("dim"); }
    var hb = $("g-hint");
    hb.textContent = "힌트 " + cur.hintsLeft;
    hb.disabled = true;
  }

  // 한 판이 끝날 때 한 번만 저장
  function finish() {
    clearTimer();
    Sound.stop();
    var r = Game.result(cur);
    var before = EJ.get("progress").stages[String(lastStage + 1)];
    var wasUnlocked = !!(before && before.unlocked);
    var wb = EJ.get("wordbook").items, have = {}, newCount = 0, i;
    for (i = 0; i < wb.length; i++) have[wb[i].id] = true;
    EJ.recordResult(lastStage, lastMode, r.grade, r.score);
    if (lastMode !== "sentence") {   // 문장은 단어장에 넣지 않는다
      for (i = 0; i < r.correctIds.length; i++) {
        if (!have[r.correctIds[i]]) { have[r.correctIds[i]] = true; newCount++; }
        EJ.addWord(r.correctIds[i]);
      }
    }
    var after = EJ.get("progress").stages[String(lastStage + 1)];
    var newlyUnlocked = !!(after && after.unlocked && !wasUnlocked);
    $("r-label").textContent = STAGES[lastStage - 1].name + " · " + MODE_NAMES[lastMode];
    var badge = $("r-badge"); badge.textContent = "";
    badge.className = "badge pop" + (r.grade === "C" ? " gray" : "");
    badge.appendChild(document.createTextNode(r.grade));
    if (r.grade === "S" || r.grade === "A") {
      var st = el("span", "st"); st.textContent = "★"; st.style.cssText = "top:6px;right:18px";
      badge.appendChild(st);
    }
    $("r-score").textContent = r.score + "점";
    $("r-correct").textContent = r.correct + " / " + r.answered;
    $("r-combo").textContent = String(r.bestCombo);
    $("r-new-l").textContent = lastMode === "sentence" ? "힌트 사용" : "새 단어";
    $("r-new").textContent = String(lastMode === "sentence" ? r.hintsUsed : newCount);
    var ban = $("r-banner"); ban.textContent = "";
    if (r.over) ban.appendChild(el("div", "banner over", "체력이 모두 떨어졌어요"));
    if (newlyUnlocked) ban.appendChild(el("div", "banner up", STAGES[lastStage].name + "이 열렸어요!"));
    cur = null;
    show("result");
  }

  function openExit() { $("exit-modal").style.display = "grid"; $("exit-no").focus(); }
  function closeExit() { $("exit-modal").style.display = "none"; }

  function show(name) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.toggle("on", screens[i].id === name);
    }
    if (name === "home") renderHome();
    if (name === "wordbook") renderWordbook();
    if (name === "modes") renderModes();
    window.scrollTo(0, 0);
  }

  function renderModes() {
    var n = lastStage;
    var empty = wordsOfStage(n).length < 10;   // 단어 기준(문장은 단계별 50개 확보)
    var note = $("modes-note"); note.textContent = "";
    if (empty) note.appendChild(el("div", "say bad", STAGES[n - 1].name + " 단어는 아직 준비 중이에요"));
    var btns = document.querySelectorAll("[data-start]");
    for (var i = 0; i < btns.length; i++) btns[i].disabled = empty;
    // 듣기: 영어 음성이 없는 기기에서는 막고 안내한다
    var lb = document.querySelector('[data-start="listen"]');
    var noSound = !Sound.ok();
    lb.classList.toggle("soon", noSound);
    $("listen-chip").style.display = noSound ? "" : "none";
    if (noSound) {
      lb.disabled = true;
      note.appendChild(el("div", "say bad", "이 기기에서는 소리를 지원하지 않아요. 듣기는 할 수 없어요"));
    }
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    var go = t.closest("[data-go]");
    if (go && !go.disabled) {
      if (go.dataset.stage) {
        $("modes-title").textContent = go.dataset.stage;
        lastStage = +go.dataset.n || 1;
      }
      show(go.dataset.go);
      return;
    }
    var st = t.closest("[data-start]");
    if (st && !st.disabled) { startGame(lastStage, st.dataset.start); return; }
    var op = t.closest(".opt");
    if (op && !op.disabled && op.parentNode.id === "g-opts") { onPick(+op.dataset.i); return; }
    if (t.closest("#g-spk")) { speakCurrent(); return; }
    if (t.closest("#g-hint")) { onHint(); return; }
    if (t.closest("#g-erase")) { spellErase(); return; }
    if (t.closest("#g-next")) { next(); return; }
    if (t.closest("#g-exit")) { openExit(); return; }
    if (t.closest("#exit-no")) { closeExit(); return; }
    if (t.closest("#exit-yes")) { closeExit(); clearTimer(); Sound.stop(); cur = null; show("home"); return; }
    if (t.closest("#r-again")) { startGame(lastStage, lastMode); return; }
  });

  // 키보드: 방향키로 활성 보기 사이 이동 (Enter는 버튼 기본 동작)
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && $("exit-modal").style.display === "grid") { closeExit(); return; }
    if (cur && spell && cur.picked === null && $("exit-modal").style.display !== "grid" && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.key === "Backspace") { spellErase(); e.preventDefault(); return; }
      if (cur.mode === "spell" && /^[a-zA-Z]$/.test(e.key)) {
        var qq = Game.current(cur), lo = e.key.toLowerCase(), usedT = {};
        for (var z = 0; z < spell.seq.length; z++) usedT[spell.seq[z].t] = true;
        for (var y = 0; y < qq.letters.length; y++) if (!usedT[y] && qq.letters[y] === lo) { spellAdd(y); break; }
        e.preventDefault(); return;
      }
    }
    if (!cur || e.key.indexOf("Arrow") !== 0) return;
    var list = [].slice.call($("g-opts").querySelectorAll(".opt:not(:disabled)"));
    if (!list.length) return;
    var idx = list.indexOf(document.activeElement);
    var d = (e.key === "ArrowRight" || e.key === "ArrowDown") ? 1 : -1;
    list[(idx + d + list.length) % list.length].focus();
    e.preventDefault();
  });

  try {
    if (window.speechSynthesis && window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener("voiceschanged", function () {
        if ($("modes").classList.contains("on")) renderModes();
      });
    }
  } catch (e) {}

  var h = (location.hash || "#home").slice(1);
  show(h === "modes" || h === "wordbook" || h === "settings" ? h : "home");
})();
