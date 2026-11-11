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

  // 잠긴 단계 카드 안내(①): 앞 단계가 B 이상이면 남은 복습 수, 아니면 필요한 조건
  function needText(i) {
    var pv = STAGES[i - 1], left = EJ.reviewLeft(pv.n);
    if (EJ.gradeAtLeast(EJ.get("progress").stages[String(pv.n)].best, "B") && left > 0) return "틀린 단어 복습 " + left + "개 남음";   // B는 달성, 복습만 남은 경우(사실과 맞게)
    return pv.name + " B등급 필요";
  }

  // 홈: 단계 카드(열림/잠김, 최고 등급)와 틀린 단어 개수
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
          '<span class="txt"><div class="name">' + s.name + '</div><div class="meta">' + needText(i) + '</div></span>' +
          '<svg class="ic lock"><use href="#i-lock"/></svg></button>';
      }
    }
    document.getElementById("stage-list").innerHTML = html;
    var rvN = EJ.get("review").items.length;
    document.getElementById("rv-count").textContent = String(rvN);
    document.getElementById("rv-guide").style.display = rvN > 0 ? "" : "none";
  }

  function shortName(n) { return STAGES[n - 1].name.split(" ")[0]; }   // "중급 (인터미디어)" → "중급" (문장 안에서 조사가 어색하지 않게)

  function wordById(id) {
    for (var i = 0; i < WORDS.length; i++) if (WORDS[i].id === id) return WORDS[i];
    return null;
  }

  // 틀린 단어 복습: 틀린 단어를 단계별로 묶어(오래된 순) 보여 준다. 없으면 빈 상태 화면
  function renderReview() {
    var items = EJ.get("review").items;
    var list = document.getElementById("rv-list");
    list.textContent = "";
    document.getElementById("rv-full").style.display = items.length ? "block" : "none";
    document.getElementById("rv-empty").style.display = items.length ? "none" : "block";
    document.getElementById("rv-sum").textContent = "틀린 단어 " + items.length + "개";
    var prog = EJ.get("progress"), lockedNext = false;
    for (var n = 1; n <= STAGES.length; n++) {
      var its = [], i;
      for (i = 0; i < items.length; i++) if (items[i].level === n) its.push(items[i]);
      if (!its.length) continue;
      var head = document.createElement("div"); head.className = "rgrp";
      var tt = document.createElement("b"); tt.textContent = STAGES[n - 1].name + " · " + its.length + "개";
      var bt = document.createElement("button"); bt.className = "btn"; bt.textContent = "복습 시작"; bt.dataset.review = String(n);
      head.appendChild(tt); head.appendChild(bt);
      list.appendChild(head);
      for (i = 0; i < its.length; i++) {
        var w = wordById(its[i].id);
        var row = document.createElement("div");
        row.className = "chunk word";
        var e = document.createElement("span"); e.className = "e"; e.textContent = w ? w.en : its[i].id;
        var k = document.createElement("span"); k.className = "k"; k.textContent = w ? w.ko : "?";
        row.appendChild(e); row.appendChild(k);
        list.appendChild(row);
      }
    }
  }

  // ===== 게임 흐름 (3단계) =====
  var cur = null;       // 진행 중인 판 상태(Game.start 결과)
  var timer = null;     // 정답 후 자동 넘김
  var lastStage = 1, lastMode = "letter", lastReview = false;   // lastReview: 방금 한 판이 틀린 단어 복습인지
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
  // 소리 설정(저장값): 무음·효과음·스타일·단어 소리. 듣기 게임의 문제 소리는 무음이어도 나온다
  function sfx(name) { var s = EJ.get("settings"); if (s.mute || !s.sfx) return; SFX.play(name, s.style); }
  function wordSay(text) { var s = EJ.get("settings"); if (s.mute || !s.word || !Sound.ok()) return; Sound.speak(text); }
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
    $("g-count").textContent = (cur.index + 1) + " / " + cur.total;
    $("g-bar").style.width = (cur.index * 100 / cur.total) + "%";
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
    if (cur.mode === "sentence") wordSay(items(q)[t]);
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
    lastStage = stage; lastMode = mode; lastReview = false;
    $("game").classList.remove("review");
    if (mode === "listen" && !Sound.ok()) return false;
    var g = Game.start({ stage: stage, mode: mode, words: wordsOfStage(stage, mode) });
    if (!g) return false;
    cur = g;
    show("game");
    renderQuestion();
    return true;
  }

  // 틀린 단어 복습 시작: 그 단계의 틀린 단어를 오래된 순으로 최대 10개, 뜻 맞추기 방식(체력·점수·힌트 없음)
  function startReview(stage) {
    clearTimer();
    var its = EJ.get("review").items, ws = [], i;
    for (i = 0; i < its.length; i++) if (its[i].level === stage) { var w = wordById(its[i].id); if (w) ws.push(w); }
    if (!ws.length) return false;
    var g = Game.start({ stage: stage, mode: "meaning", words: ws, pool: wordsOfStage(stage, "meaning"), total: Math.min(10, ws.length), review: true, ordered: true });
    if (!g) return false;
    lastStage = stage; lastMode = "meaning"; lastReview = true;
    cur = g;
    $("game").classList.add("review");
    $("g-rtag").textContent = "틀린 단어 복습 · " + STAGES[stage - 1].name;
    show("game");
    renderQuestion();
    return true;
  }

  // 정답/오답 공통 표시: 점수·연속·체력·안내 문구·다음 버튼
  function feedback(r, q, wrongText) {
    sfx(r.correct ? (!cur.review && cur.combo > 0 && cur.combo % 3 === 0 ? "combo" : "correct") : "wrong");   // 연속 정답 3·6·9회째는 combo 소리
    $("g-hint").disabled = true;
    $("g-score").textContent = String(cur.score);
    $("g-combo").textContent = String(cur.combo);
    renderHp();
    var say = el("div", "say " + (r.correct ? "good" : "bad"));
    if (r.correct) {
      say.textContent = "정답이에요!" + (r.healed ? " 체력 +1" : "");
      if (!cur.review) $("g-card").appendChild(el("span", "gain", "+" + r.gain));
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

  // 복습이 끝날 때 한 번만 저장: 맞힌 단어를 틀린 단어 목록에서 뺀다(틀린 단어는 그대로 남는다). 단계 등급·점수는 기록하지 않는다
  function finishReview() {
    clearTimer();
    Sound.stop();
    var r = Game.result(cur), stage = lastStage, i;
    EJ.removeWrongs(r.correctIds);
    var left = EJ.reviewLeft(stage);
    var opened = EJ.tryUnlock(stage);   // 그 단계 복습을 모두 마쳤고 B 이상이면 다음 단계를 연다
    var nxt = EJ.get("progress").stages[String(stage + 1)], nextLocked = !!(nxt && !nxt.unlocked);
    var bestOk = EJ.gradeAtLeast(EJ.get("progress").stages[String(stage)].best, "B");
    cur = null;
    $("r-label").textContent = STAGES[stage - 1].name + " · 틀린 단어 복습";
    var badge = $("r-badge"); badge.textContent = "✓"; badge.className = "badge pop";
    $("r-score").textContent = r.answered + "개 중 " + r.correct + "개 맞힘";
    $("r-l1").textContent = "맞힘"; $("r-correct2").textContent = String(r.correct);
    $("r-l2").textContent = "다시 틀림"; $("r-combo").textContent = String(r.answered - r.correct);
    $("r-new-l").textContent = "남은 단어"; $("r-new").textContent = String(left);
    var ban = $("r-banner"); ban.textContent = "";
    if (opened) ban.appendChild(el("div", "banner up", shortName(stage + 1) + "이 열렸어요!"));
    else if (!left) ban.appendChild(el("div", "banner up", STAGES[stage - 1].name + " 복습을 모두 마쳤어요!"));
    else if (r.correct) ban.appendChild(el("div", "banner up", "맞힌 " + r.correct + "개는 목록에서 빠졌어요!"));
    var nb = $("r-next"), ag = $("r-again");
    nb.dataset.act = "";
    ag.style.display = "none";
    if (left) { nb.style.display = ""; nb.className = "btn ib"; nb.querySelector(".t").textContent = "다시 복습"; $("r-next-s").textContent = "남은 " + left + "개"; }
    else nb.style.display = "none";
    $("r-modes-t").textContent = "목록"; $("r-modes-s").textContent = "틀린 단어 복습";
    sfx("clear");
    $("res-modal").style.display = "grid";
    (left ? nb : $("r-modes")).focus();
  }

  // 한 판이 끝날 때 한 번만 저장
  function finish() {
    if (cur && cur.review) { finishReview(); return; }
    clearTimer();
    Sound.stop();
    var r = Game.result(cur);
    var before = EJ.get("progress").stages[String(lastStage + 1)];
    var wasUnlocked = !!(before && before.unlocked);
    var wb = EJ.get("wordbook").items, have = {}, newCount = 0, i;
    for (i = 0; i < wb.length; i++) have[wb[i].id] = true;
    if (lastMode !== "sentence" && r.wrongIds.length) {   // 틀린 단어 기록(문장 제외, 한 판에 한 번 저장)
      var lv = {}, wl = [];
      for (i = 0; i < WORDS.length; i++) lv[WORDS[i].id] = WORDS[i].level;
      for (i = 0; i < r.wrongIds.length; i++) if (lv[r.wrongIds[i]]) wl.push({ id: r.wrongIds[i], level: lv[r.wrongIds[i]] });
      EJ.addWrongs(wl);
    }
    EJ.recordResult(lastStage, lastMode, r.grade, r.score);   // 틀린 단어를 먼저 기록해야 단계 열림 조건(복습 0개)이 맞다
    if (lastMode !== "sentence") {   // 문장은 단어장에 넣지 않는다
      for (i = 0; i < r.correctIds.length; i++) {
        if (!have[r.correctIds[i]]) { have[r.correctIds[i]] = true; newCount++; }
        EJ.addWord(r.correctIds[i]);
      }
    }
    var after = EJ.get("progress").stages[String(lastStage + 1)];
    var newlyUnlocked = !!(after && after.unlocked && !wasUnlocked);
    var lab = STAGES[lastStage - 1].name + " · " + MODE_NAMES[lastMode];
    var unlockMsg = newlyUnlocked ? STAGES[lastStage].name + "이 열렸어요!" : "";
    // ③ B 이상을 받았어도 복습이 남아 다음 단계가 잠겨 있는 경우
    var pendLeft = EJ.reviewLeft(lastStage), pendNext = STAGES[lastStage];
    var pending = !!(pendNext && after && !after.unlocked && EJ.gradeAtLeast(EJ.get("progress").stages[String(lastStage)].best, "B") && pendLeft > 0);
    var set = EJ.get("settings");
    cur = null;
    if (set.result || r.over) {
      $("r-label").textContent = lab;
      $("r-l1").textContent = "정답"; $("r-l2").textContent = "최고 연속";   // 복습 팝업에서 바꾼 문구를 되돌린다
      $("r-modes-t").textContent = "모드"; $("r-modes-s").textContent = "선택";
      $("r-next").style.display = "";
      var badge = $("r-badge"); badge.textContent = "";
      badge.className = "badge pop" + (r.grade === "C" ? " gray" : "");
      badge.appendChild(document.createTextNode(r.grade));
      if (r.grade === "S" || r.grade === "A") {
        var st = el("span", "st"); st.textContent = "★"; st.style.cssText = "top:2px;right:8px";
        badge.appendChild(st);
      }
      $("r-score").textContent = r.score + "점";
      $("r-correct2").textContent = r.correct + " / " + r.answered;
      $("r-combo").textContent = String(r.bestCombo);
      $("r-new-l").textContent = lastMode === "sentence" ? "힌트 사용" : "새 단어";
      $("r-new").textContent = String(lastMode === "sentence" ? r.hintsUsed : newCount);
      var ban = $("r-banner"); ban.textContent = "";
      if (r.over) ban.appendChild(el("div", "banner over", "체력이 모두 떨어졌어요"));
      if (unlockMsg) ban.appendChild(el("div", "banner up", unlockMsg));
      var nm = pickNext(set.next);
      var nb = $("r-next"), ag = $("r-again");
      var twoBtn = !(set.next === "order" && nm && nm !== lastMode);
      if (twoBtn) { nb.querySelector(".t").textContent = "한 번 더"; $("r-next-s").textContent = "같은 게임"; nb.dataset.mode = lastMode; }
      else { nb.querySelector(".t").textContent = "계속하기"; $("r-next-s").textContent = MODE_NAMES[nm]; nb.dataset.mode = nm; }
      ag.style.display = twoBtn ? "none" : "";
      var failFirst = r.over && !twoBtn;   // 체력 0: 같은 게임 다시를 1순위(초록)로
      nb.className = "btn ib" + (failFirst ? " blue" : "");
      ag.className = "btn ib" + (failFirst ? "" : " blue");
      nb.dataset.act = "";
      if (pending) {   // 첫 버튼을 "복습하기"로(다시·모드 버튼은 그대로)
        nb.className = "btn ib"; ag.className = "btn ib blue"; ag.style.display = "";
        nb.querySelector(".t").textContent = "복습하기"; $("r-next-s").textContent = STAGES[lastStage - 1].name + " " + pendLeft + "개";
        nb.dataset.act = "review";
      }
      sfx(r.over ? "over" : "clear");
      $("res-modal").style.display = "grid"; nb.focus();
    } else {
      sfx("clear");
      var m2 = pickNext(set.next) || lastMode;
      if (!startGame(lastStage, m2)) startGame(lastStage, lastMode);
      showToast(lab.split(" · ")[1] + " " + r.grade + " · " + r.score + "점 · " + r.correct + "/" + r.answered, unlockMsg);
    }
  }

  // 모드 순서대로 다음 판 고르기(할 수 없는 모드는 건너뜀). same이면 방금 모드
  var MODE_ORDER = ["letter", "meaning", "spell", "sentence", "listen"];
  function canPlay(m) {
    if (m === "listen" && !Sound.ok()) return false;
    return m === "sentence" || wordsOfStage(lastStage, m).length >= 10;
  }
  function pickNext(kind) {
    if (kind !== "order") return lastMode;
    var i0 = MODE_ORDER.indexOf(lastMode);
    for (var k = 1; k <= MODE_ORDER.length; k++) {
      var m = MODE_ORDER[(i0 + k) % MODE_ORDER.length];
      if (canPlay(m)) return m;
    }
    return lastMode;
  }
  var toastT = null;
  function showToast(text, sub) {
    var t = $("toast"); t.textContent = text;
    if (sub) t.appendChild(el("small", "", sub));
    t.style.display = "";
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.style.display = "none"; }, 2200);
  }
  function closeRes() { $("res-modal").style.display = "none"; }

  function openExit() { $("exit-modal").style.display = "grid"; $("exit-no").focus(); }
  function closeExit() { $("exit-modal").style.display = "none"; }

  function show(name) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.toggle("on", screens[i].id === name);
    }
    if (name === "home") renderHome();
    if (name === "review") renderReview();
    if (name === "modes") renderModes();
    if (name === "settings") renderSettings();
    window.scrollTo(0, 0);
  }

  // 설정 화면: 저장된 값을 읽어 스위치·스타일을 표시한다(읽기만 하고 저장하지 않음)
  var SW_KEYS = { "sw-mute": "mute", "sw-sfx": "sfx", "sw-word": "word", "sw-result": "result" };
  function renderSettings() {
    var s = EJ.get("settings");
    function sw(id, on, dis) {
      var b = $(id); b.className = "sw " + (on ? "on" : "off");
      b.setAttribute("aria-checked", on ? "true" : "false"); b.disabled = !!dis;
    }
    sw("sw-mute", s.mute, false); sw("sw-sfx", s.sfx, s.mute); sw("sw-word", s.word, s.mute); sw("sw-result", s.result, false);
    var nr = document.querySelectorAll("#next-box .so");
    for (var q = 0; q < nr.length; q++) {
      var non = nr[q].dataset.next === s.next;
      nr[q].classList.toggle("on", non); nr[q].setAttribute("aria-checked", non ? "true" : "false");
    }
    var off = s.mute || !s.sfx;
    $("sty-box").classList.toggle("off", off);
    var rows = document.querySelectorAll("#sty-box .so");
    for (var i = 0; i < rows.length; i++) {
      var on = rows[i].dataset.style === s.style;
      rows[i].classList.toggle("on", on);
      rows[i].setAttribute("aria-checked", on ? "true" : "false");
      rows[i].setAttribute("aria-disabled", off ? "true" : "false");
      rows[i].querySelector(".pl").disabled = off;
    }
  }
  function toggleSetting(id) {
    var key = SW_KEYS[id];
    EJ.setSetting(key, !EJ.get("settings")[key]);
    renderSettings();
    sfx("click");
  }
  function chooseStyle(st) {
    EJ.setSetting("style", st);
    renderSettings();
    sfx("click");
  }
  function previewStyle(st) {
    var s = EJ.get("settings"); if (s.mute || !s.sfx) return;
    SFX.play("correct", st);
    setTimeout(function () { SFX.play("clear", st); }, 650);
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
    var swb = t.closest(".sw");
    if (swb && SW_KEYS[swb.id]) { if (!swb.disabled) toggleSetting(swb.id); return; }
    var pv = t.closest(".pl");
    if (pv) { if (!pv.disabled) previewStyle(pv.dataset.style); return; }
    var nx = t.closest("#next-box .so");
    if (nx) { EJ.setSetting("next", nx.dataset.next); renderSettings(); sfx("click"); return; }
    var so = t.closest("#sty-box .so");
    if (so) { if (so.getAttribute("aria-disabled") !== "true") chooseStyle(so.dataset.style); return; }
    var cb = t.closest("button");   // 버튼 클릭 효과음(정답 고르기·듣기·결과 보기는 다른 소리가 나므로 제외)
    if (cb && !cb.disabled && !(cb.parentNode && cb.parentNode.id === "g-opts" && !spell) && cb.id !== "g-spk" &&
        !(cb.id === "g-next" && cb.textContent === "결과 보기")) sfx("click");
    var go = t.closest("[data-go]");
    if (go && !go.disabled) {
      if (go.dataset.stage) {
        $("modes-title").textContent = go.dataset.stage;
        lastStage = +go.dataset.n || 1;
      }
      show(go.dataset.go);
      return;
    }
    var rb = t.closest("[data-review]");
    if (rb && !rb.disabled) { startReview(+rb.dataset.review); return; }
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
    if (t.closest("#exit-yes")) { closeExit(); closeRes(); clearTimer(); Sound.stop(); cur = null; show("home"); return; }
    if (t.closest("#r-next")) { closeRes(); if (lastReview || $("r-next").dataset.act === "review") { startReview(lastStage); return; } startGame(lastStage, $("r-next").dataset.mode || lastMode); return; }
    if (t.closest("#r-again")) { closeRes(); startGame(lastStage, lastMode); return; }
    if (t.closest("#r-modes")) { closeRes(); if (lastReview) { show("review"); return; } $("modes-title").textContent = STAGES[lastStage - 1].name; show("modes"); return; }
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

  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("so")) {
      e.preventDefault();
      if (e.target.getAttribute("aria-disabled") !== "true") chooseStyle(e.target.dataset.style);
    }
  });

  var h = (location.hash || "#home").slice(1);
  show(h === "modes" || h === "review" || h === "settings" ? h : h === "wordbook" ? "review" : "home");
})();
