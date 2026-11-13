// 영어정복: 화면 이동 + 저장값 표시 (2단계). 화면을 그릴 때는 읽기만 하고 저장하지 않는다.
// 주소 끝 #game 같은 값은 미리보기용
(function () {
  "use strict";

  var ALLW = WORDS.concat(typeof WORDS_ADV !== "undefined" ? WORDS_ADV : []);   // 일반 단어(CEFR-J) + 고급 단어(Octanove, Lv91~99)
  var LV_COUNT = EJ.LV_COUNT;

  function lvName(n) { return "레벨 " + n; }
  // v0.38: 레벨 10개 등급(캐릭터 성장 단계 이름, 10단위 경계). 카드 색은 등급 색을 따른다. 99 달성 뒤의 "신화"(환생)는 등급이 아니라 나중에 만들 상태다
  var BANDS = [
    { id: "c", name: "평민", en: "Civilian", from: 1, to: 9, c: "#A98467" },
    { id: "b", name: "입문자", en: "Beginner", from: 10, to: 19, c: "var(--green)" },
    { id: "t", name: "견습생", en: "Trainee", from: 20, to: 29, c: "#1FB5A8" },
    { id: "f", name: "싸움꾼", en: "Fighter", from: 30, to: 39, c: "var(--blue)" },
    { id: "w", name: "전사", en: "Warrior", from: 40, to: 49, c: "var(--orange)" },
    { id: "e", name: "정예", en: "Elite", from: 50, to: 59, c: "#E5484D" },
    { id: "m", name: "마스터", en: "Master", from: 60, to: 69, c: "var(--pink)" },
    { id: "g", name: "그랜드마스터", en: "Grandmaster", from: 70, to: 79, c: "#8A5CF6" },
    { id: "p", name: "에픽", en: "Epic", from: 80, to: 89, c: "#5B6EE8" },
    { id: "l", name: "전설", en: "Legend", from: 90, to: 99, c: "#E0A100" }
  ];
  function bandOf(n) { for (var i = 0; i < BANDS.length; i++) if (n >= BANDS[i].from && n <= BANDS[i].to) return BANDS[i]; return BANDS[BANDS.length - 1]; }
  function lvColor(n) { return bandOf(n).c; }
  function openedMsg(n) { return "새 레벨이 열렸어요! (" + lvName(n) + ")"; }   // 숫자 뒤 조사(이/가)를 피하려고 괄호로 쓴다

  // v0.39: 다음 레벨을 열려면 경험치 칸을 모두 채우고(모드 1판 A 이상 = 1칸, 모드당 R=올림(√레벨)칸) 틀린 단어 0개. 듣기는 영어 음성이 없는 기기에서 제외
  function requiredModes() {
    var out = [];
    for (var i = 0; i < MODE_ORDER.length; i++) if (MODE_ORDER[i] !== "listen" || Sound.ok()) out.push(MODE_ORDER[i]);
    return out;
  }

  // 가장 높게 열린 레벨(현재 레벨)
  function frontierLv() {
    var p = EJ.get("progress"), f = 1;
    for (var n = 1; n <= LV_COUNT; n++) if (lvOpen(p, n)) f = n;
    return f;
  }

  // BETA-TEST (임시, 개발 완료 후 삭제): 설정의 "시험할 등급" 첫 레벨까지 화면에서만 열린 것으로 취급한다. 진행 기록은 바꾸지 않는다
  function betaStart() {
    var id = EJ.get("settings").betaBand;
    if (!id) return 0;
    for (var i = 0; i < BANDS.length; i++) if (BANDS[i].id === id) return BANDS[i].from;
    return 0;
  }
  var betaFrom = 0;   // BETA-TEST: 홈을 그릴 때 한 번 읽는다
  function lvOpen(p, n) { return p.lvs[String(n)].unlocked || n <= betaFrom; }   // BETA-TEST: 열림 판정(진행 기록 또는 베타)

  // 잠긴 레벨 카드를 눌렀을 때 안내(현재 레벨 기준: 거기서부터 차례대로 열린다)
  function lockMsg() {
    var f = frontierLv(), req = requiredModes(), x = EJ.xp(f, req), left = EJ.reviewLeft(f);
    if (x.cur === x.total && left > 0) showToast("틀린 단어 복습 " + left + "개를 마쳐야 해요", lvName(f) + " 경험치는 가득 찼어요");
    else if (x.cur === x.total) showToast(lvName(f) + " 레벨업 테스트를 통과해야 해요", "모드 목록의 레벨업 테스트에서 퍼즐 " + EJ.passNeed(f) + "개를 완성하세요");
    else showToast(lvName(f) + " 경험치를 모두 채워야 해요", "경험치 " + x.cur + "/" + x.total + " (모드마다 A 이상 " + x.per + "회)");
  }

  // 홈(v0.53, 고정 크기·스크롤 없음): 등급 하나의 레벨 10개를 2열×5행으로 보여 주고 ◀ ▶로 등급을 넘긴다(다음 등급 1개까지, 그 뒤는 숨김). 처음 열면 현재 레벨이 있는 등급이다. 선택한 등급은 저장하지 않는다
  var viewBand = -1;   // -1이면 현재 등급
  function renderHome() {
    betaFrom = betaStart();   // BETA-TEST
    var p = EJ.get("progress"), req = requiredModes(), f = frontierLv(), curB = bandOf(f), n;
    var curIdx = BANDS.indexOf(curB), maxView = Math.min(curIdx + 1, BANDS.length - 1);
    if (viewBand < 0 || viewBand > maxView) viewBand = curIdx;
    var b = BANDS[viewBand], cnt = 0, total = b.to - b.from + 1, html = "";
    for (n = b.from; n <= b.to; n++) if (lvOpen(p, n)) cnt++;   // BETA-TEST: 원래는 p.lvs[..].unlocked
    function card(n) {
      var st = p.lvs[String(n)];
      if (lvOpen(p, n)) {   // BETA-TEST: 원래는 st.unlocked
        var x = EJ.xp(n, req);
        return '<button class="chunk stage' + (n === f ? " now" : "") + '" data-go="modes" data-n="' + n + '" data-stage="' + lvName(n) + '" style="--c:' + lvColor(n) + '">' +
          '<span class="tile pop">' + n + '</span>' +
          '<span class="txt"><div class="meta">경험치</div><div class="xp">' + x.cur + "/" + x.total + '</div></span>' +
          '<span class="grade' + (st.best ? "" : " none") + '">' + (st.best ? st.best : "-") + '</span>' + (n === f ? '<span class="nowchip">지금</span>' : "") + '</button>';
      }
      return '<button class="chunk stage locked" data-lock="' + n + '" aria-disabled="true" aria-label="' + lvName(n) + ' 잠김">' +
        '<span class="tile pop">' + n + '</span><svg class="ic lock"><use href="#i-lock"/></svg></button>';
    }
    for (n = b.from; n <= b.to; n++) html += card(n);
    if (viewBand === 0) html += '<div class="stage empty" aria-hidden="true"></div>';   // 평민은 9개라 10번째 칸을 비운다
    document.getElementById("stage-list").innerHTML = html;
    var locked = cnt === 0;
    document.getElementById("bandnav").innerHTML =
      '<button class="arr pv" data-bandmove="-1" aria-label="이전 등급"' + (viewBand <= 0 ? " disabled" : "") + '><svg class="ic"><use href="#i-back"/></svg></button>' +
      '<div class="cur' + (locked ? " locked" : "") + '" style="--c:' + b.c + '"><div class="l1"><span class="bn">' + b.name + '</span><span class="be">' + b.en + '</span><span class="pg">' + (viewBand + 1) + '/' + BANDS.length + '</span></div>' +
      '<div class="l2">레벨 ' + b.from + '~' + b.to + ' · ' + (locked ? "잠김" : "열림 " + cnt + "/" + total) + '</div></div>' +
      '<button class="arr nx" data-bandmove="1" aria-label="다음 등급"' + (viewBand >= maxView ? " disabled" : "") + '><svg class="ic"><use href="#i-back"/></svg></button>';
    var bb = document.getElementById("beta-badge");   // BETA-TEST
    if (bb) { bb.style.display = betaFrom ? "" : "none"; bb.innerHTML = betaFrom ? "🧪 베타<br>레벨 " + betaFrom + "~" : ""; bb.setAttribute("aria-label", betaFrom ? "베타: " + bandOf(betaFrom).name + "(레벨 " + betaFrom + "~) 열림" : ""); }
    var rvN = EJ.get("review").items.length;
    document.getElementById("rv-count").textContent = String(rvN);
    document.getElementById("rv-guide").style.display = rvN > 0 ? "" : "none";
  }

  var WMAP = null;
  function wordById(id) {
    if (!WMAP) { WMAP = {}; for (var i = 0; i < ALLW.length; i++) WMAP[ALLW[i].id] = ALLW[i]; }
    return WMAP[id] || null;
  }

  // 틀린 단어 복습: 틀린 단어를 레벨별로 묶어(오래된 순) 보여 준다. 없으면 빈 상태 화면
  // 틀린 단어 복습(v0.54, 고정 크기): 틀린 단어가 있는 레벨을 ◀▶로 넘기고, 단어는 2열×5행(10개)씩 쪽으로 보여 준다. 1쪽 10개가 곧 "복습 시작"으로 풀 단어(오래된 순)다. 선택한 레벨·쪽은 저장하지 않는다
  var rvLv = 0, rvPage = 1;   // rvLv: 보고 있는 레벨(0이면 첫 레벨)
  function renderReview() {
    var items = EJ.get("review").items, i, by = {}, lvs = [];
    document.getElementById("rv-full").style.display = items.length ? "flex" : "none";
    document.getElementById("rv-empty").style.display = items.length ? "none" : "block";
    document.getElementById("rv-sum").textContent = "틀린 단어 " + items.length + "개";
    if (!items.length) return;
    for (i = 0; i < items.length; i++) (by[items[i].lv] = by[items[i].lv] || []).push(items[i]);
    for (var n = 1; n <= LV_COUNT; n++) if (by[n]) lvs.push(n);
    if (!by[rvLv]) { rvLv = lvs[0]; rvPage = 1; }
    var li = lvs.indexOf(rvLv), its = by[rvLv], pages = Math.max(1, Math.ceil(its.length / 10));
    if (rvPage < 1) rvPage = 1; if (rvPage > pages) rvPage = pages;
    document.getElementById("rv-nav").innerHTML =
      '<button class="arr pv" data-lvmove="-1" aria-label="이전 레벨"' + (li <= 0 ? " disabled" : "") + '><svg class="ic"><use href="#i-back"/></svg></button>' +
      '<div class="cur" style="--c:' + lvColor(rvLv) + '"><div class="l1"><span class="bn">' + lvName(rvLv) + '</span><span class="pg">' + (li + 1) + "/" + lvs.length + '</span></div><div class="l2">틀린 단어 ' + its.length + '개</div></div>' +
      '<button class="arr nx" data-lvmove="1" aria-label="다음 레벨"' + (li >= lvs.length - 1 ? " disabled" : "") + '><svg class="ic"><use href="#i-back"/></svg></button>';
    var list = document.getElementById("rv-list");
    list.textContent = "";
    var from = (rvPage - 1) * 10, k2;
    for (i = from; i < from + 10; i++) {
      var row = document.createElement("div");
      if (i < its.length) {
        var w = wordById(its[i].id);
        row.className = "chunk word";
        var e = document.createElement("span"); e.className = "e"; e.textContent = w ? w.en : its[i].id;
        var k = document.createElement("span"); k.className = "k"; k.textContent = w ? w.ko : "?";
        row.appendChild(e); row.appendChild(k);
      } else row.className = "chunk word fill";
      list.appendChild(row);
    }
    document.getElementById("rv-pager").innerHTML = pages > 1 ?
      '<button class="pv" data-pgmove="-1" aria-label="이전 쪽"' + (rvPage <= 1 ? " disabled" : "") + '><svg class="ic"><use href="#i-back"/></svg></button><span>' + rvPage + "/" + pages + '쪽</span>' +
      '<button class="nx" data-pgmove="1" aria-label="다음 쪽"' + (rvPage >= pages ? " disabled" : "") + '><svg class="ic"><use href="#i-back"/></svg></button>' : "";
    var go = document.getElementById("rv-go"); go.dataset.review = String(rvLv); go.textContent = lvName(rvLv) + " 복습 시작";
  }

  // ===== 게임 흐름 (3단계) =====
  var cur = null;       // 진행 중인 판 상태(Game.start 결과)
  var timer = null;     // 정답 후 자동 넘김
  var lastStage = 1, lastMode = "letter", lastReview = false;   // lastReview: 방금 한 판이 틀린 단어 복습인지
  function $(id) { return document.getElementById(id); }
  function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }

  // ===== 정답 연출 (v0.45) =====
  // 연속 정답 단계(3·5·10)에 따라 리본·카드 빛·연속 칩의 색을 바꾼다(v0.67부터 별 없음). 점수·저장 규칙은 건드리지 않고, 복습 판에는 쓰지 않는다
  function comboTier(c) { return c >= 10 ? 10 : c >= 5 ? 5 : c >= 3 ? 3 : 0; }
  function fxClear() {   // 연속이 끊기거나 판이 끝나거나 나갈 때: 카드 빛·리본·가장자리 빛·점수 칩 효과를 모두 걷는다
    var card = $("g-card"), old = card.querySelectorAll(".fx-banner"), i;
    for (i = old.length - 1; i >= 0; i--) card.removeChild(old[i]);
    card.classList.remove("glow3", "glow5", "glow10");
    $("game").classList.remove("edge10");
    fxPulse(false);
  }
  function fxPulse(on) { document.querySelector("#game .score").classList.toggle("pulse", on); }
  function fxChip() {   // 연속 칩 크기·색: 지금 연속 횟수 기준(오답으로 0이 되면 원래대로)
    var cb = document.querySelector("#game .combo"), t = cur ? comboTier(cur.combo) : 0;
    cb.classList.remove("c3", "c5", "c10");
    if (t) cb.classList.add("c" + t);
  }
  // 지금 연속 단계의 연출을 카드에 그린다. 연속이 이어지는 동안 새 문제에서도 유지되고(반짝임은 CSS 반복), 정답 순간(enter)에만 튀어 나온다
  function fxShow(enter) {
    var t = cur && !cur.review ? comboTier(cur.combo) : 0, card = $("g-card"), e;
    fxClear();
    if (!t) return;
    card.classList.add("glow" + t);
    e = el("span", "fx-banner t" + t + (enter ? " in" : ""), cur.combo + " 콤보!" + (t === 10 ? "!" : ""));
    e.setAttribute("aria-hidden", "true");
    card.appendChild(e);
    if (t === 10) $("game").classList.add("edge10");
  }

  function wordsOfStage(n, mode) {
    var src = mode === "sentence" ? SENTENCES : ALLW, out = [];
    for (var i = 0; i < src.length; i++) if (src[i].lv === n) out.push(src[i]);
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
    function speak(text, onstart, onend, rate) {
      var s = api(); if (!s) return false;
      try {
        s.cancel();
        var u = new window.SpeechSynthesisUtterance(text);
        u.lang = "en-US"; u.rate = rate || 0.85;
        var v = pick(); if (v) u.voice = v;
        u.onstart = function () { bgmDuck(true); if (onstart) onstart(); };
        u.onend = u.onerror = function () { bgmDuck(false); if (onend) onend(); };
        s.speak(u); return true;
      } catch (e) { return false; }
    }
    function stop() { try { var s = api(); if (s) s.cancel(); } catch (e) {} bgmDuck(false); }
    return { ok: ok, speak: speak, stop: stop };
  })();
  // 소리 설정(저장값): 무음·효과음·스타일·단어 소리. 듣기 게임의 문제 소리는 무음이어도 나온다
  function sfx(name) { var s = EJ.get("settings"); if (s.mute || !s.sfx) return; SFX.play(name, s.style); }
  function wordSay(text) { var s = EJ.get("settings"); if (s.mute || !s.word || !Sound.ok()) return; Sound.speak(text); }
  var playTimer = null;
  // 듣기 다시 듣기 표시(v0.59): 횟수 제한이 있으면 남은 횟수를 보여 주고, 0이면 스피커를 끈다(문제를 푼 뒤에는 횟수와 무관하게 들을 수 있다)
  function drawReplays() {
    var b = $("g-spk"), h = document.querySelector("#g-card .hint2");
    if (!b || !cur) return;
    var lim = cur.replaysMax > 0, left = cur.replaysLeft, off = lim && left <= 0 && cur.picked == null;
    b.disabled = off; b.classList.toggle("off", off);
    if (h) h.textContent = !lim ? "누르면 다시 들려요" : off ? "다시 듣기를 다 썼어요" : "다시 듣기 " + left + "회 남음";
    b.setAttribute("aria-label", !lim ? "다시 듣기" : "다시 듣기 " + (off ? 0 : left) + "회 남음");
  }
  function hideReplayNote(q) { var h = document.querySelector("#g-card .hint2"); if (h && isLong(q)) h.style.display = "none"; }   // 문장·대답 고르기는 답한 뒤 칸이 모자라 안내 줄을 숨긴다
  function isLong(q) { return q.kind === "sentence" || q.kind === "dialog"; }   // 보기가 문장인 듣기 유형(보기 한 줄 1개 배치)
  // 답한 뒤 풀이(v0.61 대답 고르기): 영어 질문(굵게)·한글 뜻(작게) 두 줄
  function revealDlg(q) { var r = el("div", "reveal dl"); r.appendChild(el("b", "", q.en)); r.appendChild(el("span", "", q.ko)); var c = $("g-card"); c.dataset.a = "1"; return r; }
  function revealOf(q) { return q.kind === "dialog" ? revealDlg(q) : el("div", "reveal", q.kind === "sentence" ? q.ko : q.en + " = " + q.ko); }
  function speakCurrent(manual) {
    if (!cur || cur.mode !== "listen") return;
    var q = Game.current(cur), b = $("g-spk");
    if (!b) return;
    if (manual === true && cur.picked == null) {   // 직접 누른 다시 듣기만 횟수를 센다(자동 재생은 세지 않음, 재생 중에는 무시)
      if (cur.replaysMax > 0 && b.classList.contains("on")) return;
      if (!Game.replay(cur)) return;
      drawReplays();
    }
    function off() { if (playTimer) { clearTimeout(playTimer); playTimer = null; } b.classList.remove("on"); beginLimit(); }
    b.classList.add("on");
    if (playTimer) clearTimeout(playTimer);
    playTimer = setTimeout(off, isLong(q) ? 8000 : 4000);
    if (!Sound.ok() || !Sound.speak(q.en, null, off, q.rate)) off();
  }

  // ===== 배경음악 (v0.47): 게임 중에만 재생. 강도 = 연속 정답(3·5·10회)과 제한시간(주황·빨강) 중 높은 쪽(복습은 평상), 듣기는 상한 2·음량 절반, 음성 재생 중에는 줄임 =====
  var bgmOn = false, bgmDk = null, bgmPv = null;
  function bgmMul(s) { return (s.bgmVol === undefined ? 100 : s.bgmVol) / 100 * 1.6; }   // 슬라이더 100% = 소리 점검에서 정한 1.6배
  function bgmWanted(s) { return !!(cur && $("game").classList.contains("on") && !s.mute && s.bgm !== false && s.bgmVol !== 0); }
  function bgmLevel() {
    if (!cur || cur.review) return 0;
    var c = cur.combo, lv = c >= 10 ? 3 : c >= 5 ? 2 : c >= 3 ? 1 : 0;
    if (tm && tm.started && !tm.done && !tm.paused) {   // 제한시간: 주황 구간 2, 빨강 구간 4
      var left = Math.max(0, tm.end - Date.now()), span = Math.max(3000, tm.ms * 0.25);
      lv = Math.max(lv, left <= span ? 4 : left <= tm.ms * 0.5 ? 2 : 0);
    }
    return lv;
  }
  function bgmSync() {   // 지금 상태(화면·설정·판)에 맞게 시작·정지·강도·음량을 맞춘다
    var s = EJ.get("settings");
    if (!bgmWanted(s)) { if (bgmOn) { bgmOn = false; BGM.stop(0.5); } return; }
    BGM.setVolume(bgmMul(s)); BGM.setListen(cur.mode === "listen"); BGM.setLevel(bgmLevel());
    bgmOn = true; BGM.start();
  }
  function bgmTick() { if (bgmOn && cur) BGM.setLevel(bgmLevel()); }   // 제한시간이 줄어드는 동안 강도를 따라간다
  function bgmDuck(on) {   // 문제·단어 음성이 나오는 동안 줄인다(끝 신호가 없으면 6초 뒤 복귀)
    BGM.setDuck(on);
    if (bgmDk) { clearTimeout(bgmDk); bgmDk = null; }
    if (on) bgmDk = setTimeout(function () { bgmDk = null; BGM.setDuck(false); }, 6000);
  }
  function bgmPreview(v) {   // 설정에서 볼륨을 움직일 때 잠깐 평상 강도로 들려준다
    var s = EJ.get("settings");
    if (bgmOn || s.mute || s.bgm === false) return;
    if (v <= 0) { BGM.stop(0.3); return; }
    BGM.setListen(false); BGM.setDuck(false); BGM.setLevel(0); BGM.setVolume(v / 100 * 1.6); BGM.start();
    if (bgmPv) clearTimeout(bgmPv);
    bgmPv = setTimeout(function () { bgmPv = null; if (!bgmOn) BGM.stop(0.5); }, 1800);
  }

  // ===== 제한시간 (v0.42): 문제마다 시간 제한. 끄면(설정) 없음. 복습·Lv1~9는 제한 없음 =====
  var tm = null;   // {ms, left, end, iv, started, done, paused, sec}
  function drawLimit() {
    var row = $("g-tmr"); if (!tm || !row) return;
    var left = tm.started ? Math.max(0, tm.paused ? tm.left : tm.end - Date.now()) : tm.ms;
    var sec = Math.ceil(left / 1000);
    var crit = tm.started && left <= Math.max(3000, tm.ms * 0.25), warn = tm.started && left <= tm.ms * 0.5;
    row.classList.toggle("wait", !tm.started);
    row.classList.toggle("crit", crit);
    row.classList.toggle("warn", warn && !crit);
    row.classList.toggle("blink", tm.started && left <= 3000 && left > 0 && !tm.done);
    $("g-tbar").style.width = (tm.started ? left * 100 / tm.ms : 100) + "%";
    $("g-tsec").textContent = tm.started ? sec + "초" : "대기";
    if (tm.sec !== sec || tm.waitShown !== !tm.started) {
      tm.sec = sec; tm.waitShown = !tm.started;
      row.setAttribute("aria-label", tm.started ? "남은 시간 " + sec + "초" : "소리가 끝나면 시간이 시작돼요");
    }
  }
  function tickLimit() {
    if (!tm || tm.done || tm.paused) return;
    if (tm.end - Date.now() <= 0) { drawLimit(); tm.done = true; stopIv(); onTimeout(); return; }
    drawLimit();
    tickSound();
    bgmTick();
  }
  // 째깍 소리(v0.43): 초록 무소리, 주황 초당 1회, 빨강 초당 3→5회로 점점 빨라짐. 효과음·무음 설정은 sfx()가 따른다
  function tickSound() {
    if (!tm || !tm.started || tm.done || tm.paused) return;
    var left = Math.max(0, tm.end - Date.now()), now = Date.now();
    var span = Math.max(3000, tm.ms * 0.25), zone = left <= span ? 2 : left <= tm.ms * 0.5 ? 1 : 0;
    if (zone !== tm.zone) { tm.zone = zone; tm.nextTick = 0; }
    if (!zone || now < tm.nextTick) return;
    var gap = zone === 1 ? 1000 : 1000 / (3 + 2 * (1 - left / span));
    sfx(zone === 1 ? "tick" : "tickfast");
    tm.nextTick = (tm.nextTick && now - tm.nextTick < gap ? tm.nextTick : now) + gap;
  }
  function stopIv() { if (tm && tm.iv) { clearInterval(tm.iv); tm.iv = null; } }
  function beginLimit() {
    if (!tm || tm.started || tm.done) return;
    tm.started = true; tm.end = Date.now() + tm.left;
    tm.iv = setInterval(tickLimit, 50);
    drawLimit();
  }
  function freezeLimit() { if (tm) { stopIv(); tm.done = true; if (tm.started) tm.left = Math.max(0, tm.end - Date.now()); tm.paused = false; drawLimit(); } }
  function pauseLimit() { if (tm && tm.started && !tm.done && !tm.paused) { tm.left = Math.max(0, tm.end - Date.now()); tm.paused = true; stopIv(); } }
  function resumeLimit() { if (tm && tm.paused && !tm.done) { tm.paused = false; tm.end = Date.now() + tm.left; tm.iv = setInterval(tickLimit, 50); } }
  function setupLimit() {
    stopIv(); tm = null;
    var row = $("g-tmr");
    row.classList.remove("wait", "warn", "crit", "blink");
    if (!cur || !cur.limit || EJ.get("settings").timer === false) { row.style.display = "none"; return; }
    var lms = cur.limit * (Game.current(cur).mul || 1) * 1000;   // 한글 뜻 듣기(v0.60)는 생각 시간 2배
    tm = { ms: lms, left: lms, end: 0, iv: null, started: false, done: false, paused: false, sec: -1, zone: 0, nextTick: 0 };
    row.style.display = "flex";
    if (cur.mode === "listen") drawLimit();   // 듣기: 문제 소리가 끝나면 시작(speakCurrent의 off에서 beginLimit)
    else beginLimit();
  }
  // 시간 초과: 오답 처리(체력 -1·틀린 단어 기록), 정답을 보여 주고 다음으로
  function onTimeout() {
    if (!cur || cur.picked != null || cur.finished) return;
    dragEnd();
    var q = Game.current(cur), r = Game.timeout(cur), i;
    if (!r) return;
    var ans;
    if (spell) {
      var chips = $("g-sent").children;
      for (i = 0; i < chips.length; i++) chips[i].className = wcls("bad");
      $("g-sent").classList.add("done");
      var bx = $("g-opts").children;
      for (i = 0; i < bx.length; i++) { bx[i].disabled = true; bx[i].className = "opt used"; }
      $("g-erase").disabled = true;
      ans = cur.mode === "sentence" ? "\"" + q.en + "\"" : q.en;
    } else {
      var opts = $("g-opts").querySelectorAll(".opt");
      for (i = 0; i < opts.length; i++) {
        opts[i].disabled = true;
        opts[i].classList.add(i === q.answer ? "right" : "dim");
      }
      if (cur.mode === "letter") { var tl = $("g-tiles").children[q.blank]; tl.textContent = q.options[q.answer]; tl.className = "bad"; }
      if (cur.mode === "listen") { $("g-card").appendChild(revealOf(q)); hideReplayNote(q); }
      ans = q.kind === "dialog" ? "초록색 대답" : q.kind === "sentence" ? "\"" + q.en + "\"" : q.en + " = " + q.ko;
    }
    feedback(r, q, q.kind === "dialog" ? "시간이 다 됐어요. 초록색이 정답이에요" : "시간이 다 됐어요. 정답: " + ans);
  }

  var spell = null;     // 철자 쓰기 진행: {seq:[{t:타일번호, lock:힌트로 채움}]}
  var MODE_NAMES = { letter: "글자 맞추기", meaning: "뜻 맞추기", spell: "철자 쓰기", sentence: "문장 배열", listen: "듣기" };
  function items(q) { return q.letters || q.pool; }   // 순서 모드의 섞인 조각(글자 또는 단어)
  function dragMode() { return !!cur && (cur.mode === "sentence" || cur.mode === "spell"); }   // 끌어서 순서 맞추는 모드(v0.65 문장 배열, v0.66 철자 쓰기)
  function wcls(extra) { return "wd" + (cur && cur.mode === "spell" ? " ltr" : "") + (extra ? " " + extra : ""); }   // 조각 카드 클래스(철자 쓰기는 글자 모양 ltr)
  function ansAt(q, n) { return cur.mode === "sentence" ? q.tokens[n] : q.answer.charAt(n); }   // n번째 정답 조각

  // 글자 칸(글자 맞추기 tiles·철자 쓰기 slots): 한 줄에 다 안 들어가면 같은 개수씩 여러 줄로 나눈다(13~14글자 단어가 칸 밖으로 넘치지 않게)
  var CELL_MIN = { "": 32, sm: 30, xs: 26 };   // 크기별 한 칸의 최소 너비(px)
  function layoutCells(box) {
    var n = +box.dataset.n, size = box.dataset.size || "";
    var gap = parseFloat(getComputedStyle(box).columnGap) || 6;
    var per = Math.max(1, Math.floor((box.clientWidth + gap) / (CELL_MIN[size] + gap)));
    var rows = Math.ceil(n / per);
    box.style.setProperty("--cols", String(Math.ceil(n / rows)));
  }
  // 듣기 보기(영어 단어): 가장 긴 단어가 보기 안에 들어갈 때까지 글자 크기를 모두 같이 줄인다
  function fitListen() {
    var bs = $("g-opts").querySelectorAll(".opt.en"), i;
    if (!bs.length) return;
    for (i = 0; i < bs.length; i++) bs[i].style.fontSize = "";
    var sl = bs[0].classList.contains("sl");   // 문장 보기: 여러 줄이라 높이가 넘치는지로 맞춘다
    var fs = parseFloat(getComputedStyle(bs[0]).fontSize);
    function over() { for (var k = 0; k < bs.length; k++) if (bs[k].scrollWidth > bs[k].clientWidth || (sl && bs[k].scrollHeight > bs[k].clientHeight + 1)) return true; return false; }
    while (fs > (sl ? 11 : 12) && over()) {
      fs -= 1;
      for (i = 0; i < bs.length; i++) bs[i].style.fontSize = fs + "px";
    }
  }
  function refit() {   // 화면 폭이 바뀌면(기기 회전 등) 다시 맞춘다
    if (!cur || !$("game").classList.contains("on")) return;
    var tl = $("g-tiles"), sl = $("g-slots");
    if (tl) layoutCells(tl);
    if (sl) layoutCells(sl);
    if (cur.mode === "listen") fitListen();
  }

  function renderQuestion() {
    var q = Game.current(cur);
    fxPulse(false);
    renderHp();
    $("g-score").textContent = String(cur.score);
    $("g-count").textContent = (cur.index + 1) + " / " + cur.total;
    $("g-bar").style.width = (cur.index * 100 / cur.total) + "%";
    $("g-combo").textContent = String(cur.combo);
    fxChip();
    var hb = $("g-hint");
    renderHint();
    hb.disabled = cur.hintsLeft <= 0;
    $("g-foot").classList.remove("fb");
    $("g-next").style.display = "none";
    setupLimit();
    bgmSync();   // 판 시작·다음 문제: 연속 정답 단계와 듣기 보호를 반영
    var isSpell = cur.mode === "spell", isSent = cur.mode === "sentence", isOrder = isSpell || isSent;
    dragEnd();
    var er = $("g-erase");
    er.style.display = isOrder ? "" : "none";
    er.textContent = "확인";   // 문장 배열(v0.65)·철자 쓰기(v0.66)는 지우기 없이 확인 버튼
    er.classList.toggle("ok", isOrder);
    spell = isOrder ? { seq: [] } : null;
    if (isOrder) for (var si = 0; si < items(q).length; si++) spell.seq.push({ t: si, lock: false });   // 카드(글자)를 모두 칸에 섞어 둔다
    var card = $("g-card"); card.textContent = "";
    card.dataset.k = (cur.mode === "listen" && isLong(q)) ? "s" : "";
    delete card.dataset.a;   // 답한 뒤 표시(v0.61 대답 고르기에서 낮은 화면 압축에 쓴다)
    fxShow(false);   // 연속이 이어지는 동안 새 문제에서도 연출 유지
    var box = $("g-opts"); box.textContent = "";
    box.className = "opts";
    if (cur.mode === "letter") {
      card.appendChild(el("div", "sub", "빈칸에 들어갈 글자는?"));
      var ko = el("div", "ko", q.ko); ko.style.cssText = "font-size:26px;font-weight:700;margin:8px 0 14px";
      card.appendChild(ko);
      var tsz = q.en.length > 12 ? "xs" : q.en.length > 8 ? "sm" : "";
      var t = el("div", "tiles" + (tsz ? " " + tsz : ""));
      t.id = "g-tiles"; t.dataset.n = String(q.en.length); t.dataset.size = tsz;
      for (var i = 0; i < q.en.length; i++) t.appendChild(el("span", i === q.blank ? "blank" : "", i === q.blank ? "?" : q.en.charAt(i)));
      card.appendChild(t);
      layoutCells(t);
    } else if (isSpell) {
      card.appendChild(el("div", "sub", "뜻에 맞게 글자를 끌어 순서를 바꿔 보세요"));
      var ko2 = el("div", "ko", q.ko); ko2.style.cssText = "font-size:26px;font-weight:700;margin:8px 0 14px";
      card.appendChild(ko2);
      var n = q.letters.length;
      var ssz = n > 12 ? " xs" : n > 8 ? " sm" : "";
      var lt = el("div", "sent drag ltr" + ssz); lt.id = "g-sent";
      card.appendChild(lt);
      box.className = "wpool none";   // 아래 글자 풀 없음(글자는 칸에서 끌어 옮긴다)
      renderSpell();
      fixSentHeight();
    } else if (isSent) {
      card.appendChild(el("div", "sub", "뜻에 맞게 카드를 끌어 순서를 바꿔 보세요"));
      var ko3 = el("div", "ko", q.ko); ko3.style.cssText = "font-size:23px;font-weight:700;margin:8px 0 12px;word-break:keep-all";
      card.appendChild(ko3);
      var sent = el("div", "sent drag"); sent.id = "g-sent";
      card.appendChild(sent);
      box.className = "wpool none";   // 아래 카드 풀 없음(카드는 문장 칸에서 끌어 옮긴다)
      renderSpell();
      fixSentHeight();
    } else if (cur.mode === "listen") {
      if (q.kind === "dialog") {   // 대답 고르기: 질문 글자가 화면에 없어서 헷갈리지 않게 안내 문구를 반짝이는 배지로 크게 보여 준다
        var dq = el("div", "sub dq"); dq.appendChild(el("i", "", "✦")); dq.appendChild(el("span", "", "질문을 듣고 알맞은 대답을 골라 주세요")); dq.appendChild(el("i", "", "✦"));
        card.appendChild(dq);
      } else card.appendChild(el("div", "sub", q.kind === "sentence" ? "소리를 듣고 알맞은 문장을 골라 주세요" : q.kind === "mean" ? "소리를 듣고 알맞은 뜻을 골라 주세요" : "소리를 듣고 알맞은 단어를 골라 주세요"));
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
        var b = el("button", "opt" + (cur.mode === "meaning" ? " txt" : cur.mode === "listen" ? (isLong(q) ? " en sl" : q.kind === "mean" ? " txt" : " en") : ""), q.options[k]);
        b.dataset.i = String(k);
        box.appendChild(b);
      }
    }
    var first = box.querySelector(".opt");
    if (first) first.focus();
    if (cur.mode === "listen") { if (isLong(q)) box.classList.add("sl"); drawReplays(); fitListen(); setTimeout(speakCurrent, 250); }   // 문제가 나오면 한 번 자동 재생(기기가 막으면 버튼으로)
  }

  // 문장 배열·철자 쓰기: 칸의 카드(글자)를 현재 순서(spell.seq)에 맞게 다시 그린다
  function renderSpell() {
    var q = Game.current(cur), seq = spell.seq, arr = items(q), i;
    var area = $("g-sent"); area.textContent = "";
    for (i = 0; i < seq.length; i++) { var wc = el("span", wcls(seq[i].lock ? "hintfill" : ""), arr[seq[i].t]); wc.dataset.t = String(seq[i].t); area.appendChild(wc); }
    $("g-erase").disabled = cur.picked !== null;
  }

  function spellWord() {
    var q = Game.current(cur), arr = items(q), parts = [];
    for (var i = 0; i < spell.seq.length; i++) parts.push(arr[spell.seq[i].t]);
    return parts.join(cur.mode === "sentence" ? " " : "");
  }

  // ---- 문장 배열 카드 드래그(v0.65): 문장 칸의 카드를 끌어 순서를 바꾸거나 카드 사이에 끼워 넣는다
  var drg = null;   // {el, id, x0, y0, on, fl, dx, dy}
  function sentSyncSeq() {   // 화면 카드 순서를 spell.seq로 옮긴다
    var ch = $("g-sent").children, seq = [];
    for (var i = 0; i < ch.length; i++) seq.push({ t: +ch[i].dataset.t, lock: ch[i].classList.contains("hintfill") });
    spell.seq = seq;
  }
  function dragEnd() {   // 드래그 중이면 현재 위치에 놓고 끝낸다(시간 초과·확인·다음 문제 때도 안전하게 정리)
    var d = drg; drg = null;
    if (!d) return;
    if (d.fl && d.fl.parentNode) d.fl.parentNode.removeChild(d.fl);
    if (d.on && d.el) {
      d.el.className = wcls();
      if (spell && dragMode() && $("g-sent") && d.el.parentNode === $("g-sent")) sentSyncSeq();
    }
  }
  function sentLocked() { var n = 0, ch = $("g-sent").children; while (n < ch.length && ch[n].classList.contains("hintfill")) n++; return n; }
  function dragMove(px, py) {   // 손가락이 있는 줄에서 가운데가 손가락보다 오른쪽인 첫 카드 앞에 빈틈을 둔다
    var area = $("g-sent"), ch = area.children, cards = [], i;
    for (i = 0; i < ch.length; i++) if (ch[i] !== drg.el) cards.push(ch[i]);
    if (!cards.length) return;
    var pr = drg.el.getBoundingClientRect();
    if (px >= pr.left && px <= pr.right && py >= pr.top - 4 && py <= pr.bottom + 4) return;   // 빈틈 위에서는 그대로
    var row = [], minTop = 1e9, maxBot = -1e9, r;
    for (i = 0; i < cards.length; i++) {
      r = cards[i].getBoundingClientRect();
      if (r.top < minTop) minTop = r.top;
      if (r.bottom > maxBot) maxBot = r.bottom;
      if (py >= r.top - 5 && py <= r.bottom + 5) row.push({ c: cards[i], r: r });
    }
    var ref;
    if (row.length) {
      ref = null;
      for (i = 0; i < row.length; i++) if (row[i].r.left + row[i].r.width / 2 > px) { ref = row[i].c; break; }
      if (!ref) ref = row[row.length - 1].c.nextSibling;
    } else if (py > maxBot) ref = null;
    else if (py < minTop) ref = cards[0];
    else return;
    var lk = sentLocked();
    if (ref && ref.classList.contains("hintfill")) ref = cards[lk] || null;   // 고정된 카드 앞으로는 못 간다
    if (ref === drg.el || drg.el.nextSibling === ref) return;
    area.insertBefore(drg.el, ref);
  }
  function dragPos(px, py) { drg.fl.style.left = (px - drg.dx) + "px"; drg.fl.style.top = (py - drg.dy - 26) + "px"; }
  function dragBegin(e) {
    var w = drg.el, r = w.getBoundingClientRect(), fl = w.cloneNode(true);
    try { if (w.hasPointerCapture && w.hasPointerCapture(drg.id)) w.releasePointerCapture(drg.id); } catch (x) {}
    fl.className = wcls("lift"); fl.style.width = r.width + "px"; fl.style.height = r.height + "px";
    $("game").appendChild(fl);
    drg.fl = fl; drg.dx = e.clientX - r.left; drg.dy = e.clientY - r.top; drg.on = true;
    w.className = wcls("gap");
    dragPos(e.clientX, e.clientY);
  }
  document.addEventListener("pointerdown", function (e) {
    if (e.button > 0 || !cur || !spell || !dragMode() || cur.picked !== null || drg) return;
    var w = e.target.closest ? e.target.closest("#g-sent .wd") : null;
    if (!w) return;
    if (w.classList.contains("hintfill")) { if (cur.mode === "sentence") wordSay(w.textContent); return; }   // 힌트로 고정된 카드는 못 끌지만 소리는 난다
    drg = { el: w, id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, fl: null, dx: 0, dy: 0 };
  });
  document.addEventListener("pointermove", function (e) {
    if (!drg || e.pointerId !== drg.id) return;
    if (!drg.on) {
      if (Math.abs(e.clientX - drg.x0) + Math.abs(e.clientY - drg.y0) < 7) return;   // 살짝 눌러 떨리는 것은 끌기로 보지 않는다
      dragBegin(e);
    }
    e.preventDefault();
    dragPos(e.clientX, e.clientY);
    dragMove(e.clientX, e.clientY);
  }, { passive: false });
  function dragUp(e) {
    if (!drg || e.pointerId !== drg.id) return;
    var w = drg.el;
    dragEnd();
    if (e.type !== "pointercancel" && cur && cur.mode === "sentence") wordSay(w.textContent);   // 소리는 문장 배열만(글자는 소리 없음)   // 놓거나 살짝 누르면 그 단어 소리
  }
  document.addEventListener("pointerup", dragUp);
  document.addEventListener("pointercancel", dragUp);
  // 카드가 줄바꿈으로 바뀌어도 칸 높이가 출렁이지 않게: 가장 나쁜 줄 수만큼 높이를 미리 잡는다
  function fixSentHeight() {
    var area = $("g-sent"); if (!area) return;
    area.style.minHeight = "";
    var cs = getComputedStyle(area), ch = area.children, n = ch.length, i, tot = 0, h = ch[0].offsetHeight;
    var gx = parseFloat(cs.columnGap) || 8, gy = parseFloat(cs.rowGap) || 8;
    var inner = area.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    for (i = 0; i < n; i++) tot += ch[i].offsetWidth + gx;
    if (cur && cur.mode === "spell") tot -= gx;
    var rows = Math.min(n, Math.ceil(tot / inner) + (cur && cur.mode === "spell" ? 0 : 1));   // 글자는 폭이 고정이라 줄 수가 변하지 않는다
    area.style.minHeight = (rows * h + (rows - 1) * gy + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + 6) + "px";
  }
  function sentSubmit() {
    if (!cur || !spell || !dragMode() || cur.picked !== null) return;
    dragEnd();
    sentSyncSeq();
    spellFinish();
  }
  // 문장 배열 힌트: 앞에서부터 맞게 놓인 카드 다음 자리에 정답 카드를 옮기고 그 앞쪽을 모두 고정한다(이미 전부 맞으면 힌트를 쓰지 않는다)
  function sentHint(q) {
    dragEnd(); sentSyncSeq();
    var arr = items(q), seq = spell.seq, p = 0, k;
    while (p < seq.length && arr[seq[p].t] === ansAt(q, p)) p++;
    if (p >= seq.length) return;
    if (!Game.hintSpell(cur)) return;
    var j = p;
    for (k = p; k < seq.length; k++) if (arr[seq[k].t] === ansAt(q, p)) { j = k; break; }
    var mv = seq.splice(j, 1)[0]; seq.splice(p, 0, mv);
    for (k = 0; k <= p; k++) seq[k].lock = true;
    renderHint(); $("g-hint").disabled = true;
    renderSpell();
  }

  function spellFinish() {
    var q = Game.current(cur);
    var r = Game.submit(cur, spellWord());
    if (!r) return;
    var i, k;
    var chips = $("g-sent").children;
    for (i = 0; i < chips.length; i++) chips[i].className = wcls(r.correct ? "fill" : "bad");
    $("g-sent").classList.add("done");
    var box = $("g-opts").children;
    for (k = 0; k < box.length; k++) { box[k].disabled = true; box[k].className = "opt used"; }
    $("g-erase").disabled = true;
    feedback(r, q, cur.mode === "sentence" ? "아쉬워요. 정답은 \"" + q.en + "\"예요" : "아쉬워요. 정답은 " + q.en + "이에요");
  }

  function startGame(stage, mode) {
    clearTimer(); jigLeave();
    lastStage = stage; lastMode = mode; lastReview = false;
    $("game").classList.remove("review");
    if (mode === "listen" && !Sound.ok()) return false;
    var g = Game.start({ lv: stage, mode: mode, words: wordsOfStage(stage, mode), sentences: mode === "listen" ? wordsOfStage(stage, "sentence") : undefined, dialogs: mode === "listen" && typeof DIALOGS !== "undefined" ? DIALOGS[String(Game.bandOf(stage))] : undefined, sound: mode === "listen" && typeof SOUND !== "undefined" ? SOUND : undefined, allWords: mode === "listen" ? ALLW : undefined });
    if (!g) return false;
    cur = g;
    show("game");
    renderQuestion();
    return true;
  }

  // 틀린 단어 복습 시작: 그 레벨의 틀린 단어를 오래된 순으로 최대 10개, 뜻 맞추기 방식(체력·점수·힌트 없음)
  function startReview(stage) {
    clearTimer(); jigLeave();
    var its = EJ.get("review").items, ws = [], i;
    for (i = 0; i < its.length; i++) if (its[i].lv === stage) { var w = wordById(its[i].id); if (w) ws.push(w); }
    if (!ws.length) return false;
    var g = Game.start({ lv: stage, mode: "meaning", words: ws, pool: wordsOfStage(stage, "meaning"), total: Math.min(10, ws.length), review: true, ordered: true });
    if (!g) return false;
    lastStage = stage; lastMode = "meaning"; lastReview = true;
    cur = g;
    $("game").classList.add("review");
    $("g-rtag").textContent = "틀린 단어 복습 · " + lvName(stage);
    show("game");
    renderQuestion();
    return true;
  }

  // 정답/오답 공통 표시: 점수·연속·체력·안내 문구·다음 버튼
  function feedback(r, q, wrongText) {
    freezeLimit();
    sfx(r.correct ? (!cur.review && cur.combo >= 3 ? "correct" + comboTier(cur.combo) : "correct") : "wrong");   // v0.46: 연속 3·5·10회 단계(복습 제외)마다 정답음이 높아진다
    $("g-hint").disabled = true;
    $("g-score").textContent = String(cur.score);
    $("g-combo").textContent = String(cur.combo);
    fxChip();
    bgmSync();   // 연속이 늘면 빨라지고, 오답·시간 초과로 끊기면 평상으로
    renderHp();
    var msg;   // v0.55: 정답·오답 안내는 문제 카드 맨 위 안내 줄을 바꿔 보여 준다(고정 크기 화면에서 높이를 더하지 않으려고)
    if (r.correct) {
      msg = "정답이에요!" + (r.healed ? " 체력 +1" : "");
      if (!cur.review) { $("g-card").appendChild(el("span", "gain", "+" + r.gain)); fxShow(true); fxPulse(true); }
    } else {
      msg = wrongText;
      fxClear();   // 오답·시간 초과로 연속이 끊기면 연출도 사라진다
    }
    var sub = $("g-card").querySelector(".sub");
    if (sub) { sub.className = "sub fbmsg " + (r.correct ? "good" : "bad"); sub.textContent = msg; }
    if (r.correct && !r.over && !r.last) {
      timer = setTimeout(next, 800);
    } else {
      var nb = $("g-next");
      nb.textContent = (r.over || r.last) ? "결과 보기" : "다음 문제";
      nb.style.display = "block";
      $("g-foot").classList.add("fb");   // 힌트·지우기 자리를 다음 버튼이 쓴다
      nb.focus();
    }
  }

  function onPick(i) {
    if (!cur || cur.picked != null || cur.finished) return;
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
    if (cur.mode === "listen") { $("g-card").appendChild(revealOf(q)); hideReplayNote(q); }
    feedback(r, q, q.kind === "dialog" ? "아쉬워요. 초록색이 정답이에요" : (cur.mode === "meaning" || q.kind === "mean") ? "아쉬워요. " + q.en + " = " + q.ko : q.kind === "sentence" ? "아쉬워요. 정답은 \"" + q.en + "\"예요" : "아쉬워요. 정답은 " + q.en + "이에요");
  }

  function next() {
    clearTimer();
    if (!cur) return;
    if (Game.advance(cur)) renderQuestion();
    else finish();
  }

  function onHint() {
    if (!cur || cur.picked != null) return;
    if (spell) { sentHint(Game.current(cur)); return; }   // 문장 배열·철자 쓰기: 앞쪽 정답 카드를 고정
    var rem = Game.hint(cur);
    if (!rem) return;
    var opts = $("g-opts").querySelectorAll(".opt");
    for (var k = 0; k < rem.length; k++) { opts[rem[k]].disabled = true; opts[rem[k]].classList.add("dim"); }
    var hb = $("g-hint");
    renderHint();
    hb.disabled = true;
  }

  // 복습이 끝날 때 한 번만 저장: 맞힌 단어를 틀린 단어 목록에서 뺀다(틀린 단어는 그대로 남는다). 레벨 등급·점수는 기록하지 않는다
  function finishReview() {
    clearTimer();
    Sound.stop();
    var r = Game.result(cur), stage = lastStage, i;
    EJ.removeWrongs(r.correctIds);
    var left = EJ.reviewLeft(stage);
    var opened = EJ.tryUnlock(stage, requiredModes());   // 그 레벨 복습을 모두 마쳤고 모든 모드 A 이상이면 다음 레벨을 연다
    cur = null;
    bgmSync();
    resetRecord();
    $("r-label").textContent = lvName(stage) + " · 틀린 단어 복습";
    var badge = $("r-badge"); badge.textContent = "✓"; badge.className = "badge pop";
    $("r-score").textContent = r.answered + "개 중 " + r.correct + "개 맞힘";
    $("r-l1").textContent = "맞힘"; $("r-correct2").textContent = String(r.correct);
    $("r-l2").textContent = "다시 틀림"; $("r-combo").textContent = String(r.answered - r.correct);
    $("r-new-l").textContent = "남은 단어"; $("r-new").textContent = String(left);
    var ban = $("r-banner"); ban.textContent = "";
    if (opened) ban.appendChild(el("div", "banner up", openedMsg(stage + 1)));
    else if (!left) ban.appendChild(el("div", "banner up", lvName(stage) + " 복습을 모두 마쳤어요!"));
    else if (r.correct) ban.appendChild(el("div", "banner up", "맞힌 " + r.correct + "개는 목록에서 빠졌어요!"));
    var nb = $("r-next"), ag = $("r-again");
    nb.dataset.act = ""; ag.dataset.act = ""; ag.querySelector(".t").textContent = "다시"; ag.querySelector(".s").textContent = "같은 게임";
    ag.style.display = "none";
    if (left) { nb.style.display = ""; nb.className = "btn ib"; nb.querySelector(".t").textContent = "다시 복습"; $("r-next-s").textContent = "남은 " + left + "개"; }
    else nb.style.display = "none";
    $("r-modes-t").textContent = "목록"; $("r-modes-s").textContent = "틀린 단어 복습";
    sfx("clear");
    $("res-modal").style.display = "grid";
    (left ? nb : $("r-modes")).focus();
  }

  // 힌트 버튼: 열쇠 아이콘을 그 레벨의 판당 힌트 수만큼 보여 주고, 남은 것은 컬러·사용한 것은 오른쪽부터 회색(v0.41). 힌트가 없는 레벨(Lv90~99)은 사선 열쇠 1개
  function renderHint() {
    var hb = $("g-hint"), left = cur.hintsLeft, max = cur.hintsMax, html = "", i;
    if (max <= 0) html = '<svg class="hi used" aria-hidden="true"><use href="#i-key"/><path class="slash" d="M5 28L28 5"/></svg>';
    else for (i = 0; i < max; i++) html += '<svg class="hi' + (i >= left ? " used" : "") + '" aria-hidden="true"><use href="#i-key"/></svg>';
    hb.innerHTML = html;
    hb.classList.toggle("nohint", max <= 0);
    hb.setAttribute("aria-label", max <= 0 ? "힌트 없음" : "힌트 " + left + "개 남음");
  }

  // 한 판이 끝날 때 한 번만 저장
  function finish() {
    fxClear();
    if (cur && cur.review) { finishReview(); return; }
    clearTimer();
    Sound.stop();
    var r = Game.result(cur);
    var before = EJ.get("progress").lvs[String(lastStage + 1)];
    var wasUnlocked = !!(before && before.unlocked);
    var slotBefore = EJ.modeSlots(lastStage, lastMode);
    var i;
    if (lastMode !== "sentence" && r.wrongIds.length) {   // 틀린 단어 기록(문장 제외, 한 판에 한 번 저장)
      var wl = [];
      for (i = 0; i < r.wrongIds.length; i++) { var ww = wordById(r.wrongIds[i]); if (ww) wl.push({ id: ww.id, lv: ww.lv }); }
      EJ.addWrongs(wl);
    }
    var prevBest = EJ.best(lastStage, lastMode);   // v0.49: 저장하기 전에 이전 최고를 읽어 둔다
    EJ.recordResult(lastStage, lastMode, r.grade, r.score, requiredModes(), r.bestCombo);   // 틀린 단어를 먼저 기록해야 레벨 열림 조건(복습 0개)이 맞다
    var after = EJ.get("progress").lvs[String(lastStage + 1)];
    var newlyUnlocked = !!(after && after.unlocked && !wasUnlocked);
    var lab = lvName(lastStage) + " · " + MODE_NAMES[lastMode];
    var unlockMsg = newlyUnlocked ? openedMsg(lastStage + 1) : "";
    // 경험치를 모두 채웠어도 복습이 남아 다음 레벨이 잠겨 있는 경우
    var req = requiredModes(), xpNow = EJ.xp(lastStage, req), slotAfter = EJ.modeSlots(lastStage, lastMode);
    var pendLeft = EJ.reviewLeft(lastStage), pendNext = lastStage < LV_COUNT;
    var pending = !!(pendNext && after && !after.unlocked && xpNow.cur === xpNow.total && pendLeft > 0);
    var set = EJ.get("settings");
    var perfect = r.score === 1350 && r.correct === 10 && r.answered === 10;   // v0.49: 10개 정답·힌트 없음(연속 보너스 포함 만점 1350점)
    cur = null;
    bgmSync();
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
      $("r-new-l").textContent = lastMode === "sentence" ? "힌트 사용" : "틀린 단어";
      $("r-new").textContent = String(lastMode === "sentence" ? r.hintsUsed : r.wrongIds.filter(function (id) { return wordById(id); }).length);
      showRecord(r, prevBest, perfect);
      var ban = $("r-banner"); ban.textContent = "";
      if (r.over) ban.appendChild(el("div", "banner over", "체력이 모두 떨어졌어요"));
      if (unlockMsg) { ban.appendChild(unlockBanner(lastStage + 1)); ufxStart(); }   // v0.57: 레벨 열림 축하 연출
      else if (pendNext && after && !after.unlocked && ltState(lastStage) === "go") ban.appendChild(el("div", "banner up", "레벨업 테스트에 도전하세요!"));   // v0.63: 경험치·복습을 채우면 테스트 통과가 남는다
      else if (pendNext && (r.grade === "S" || r.grade === "A")) ban.appendChild(el("div", "banner up", slotAfter > slotBefore ? "경험치 +1! (" + xpNow.cur + "/" + xpNow.total + ")" : "이 모드 칸은 가득 찼어요 (" + xpNow.cur + "/" + xpNow.total + ")"));
      var nm = pickNext(set.next);
      var nb = $("r-next"), ag = $("r-again");
      var twoBtn = !(set.next === "order" && nm && nm !== lastMode);
      if (twoBtn) { nb.querySelector(".t").textContent = "한 번 더"; $("r-next-s").textContent = "같은 게임"; nb.dataset.mode = lastMode; }
      else { nb.querySelector(".t").textContent = "계속하기"; $("r-next-s").textContent = MODE_NAMES[nm]; nb.dataset.mode = nm; }
      ag.style.display = twoBtn ? "none" : "";
      var failFirst = r.over && !twoBtn;   // 체력 0: 같은 게임 다시를 1순위(초록)로
      nb.className = "btn ib" + (failFirst ? " blue" : "");
      ag.className = "btn ib" + (failFirst ? "" : " blue");
      nb.dataset.act = ""; ag.dataset.act = ""; ag.querySelector(".t").textContent = "다시"; ag.querySelector(".s").textContent = "같은 게임";
      if (pending) {   // 첫 버튼을 "복습하기"로(다시·모드 버튼은 그대로)
        nb.className = "btn ib"; ag.className = "btn ib blue"; ag.style.display = "";
        nb.querySelector(".t").textContent = "복습하기"; $("r-next-s").textContent = lvName(lastStage) + " " + pendLeft + "개";
        nb.dataset.act = "review";
      }
      sfx(r.over ? "over" : perfect ? "perfect" : "clear");
      if (unlockMsg) unlockSound(perfect);
      $("res-modal").style.display = "grid"; nb.focus();
    } else {
      sfx(perfect ? "perfect" : "clear");
      if (unlockMsg) unlockSound(perfect);
      var m2 = pickNext(set.next) || lastMode;
      if (!startGame(lastStage, m2)) startGame(lastStage, lastMode);
      showToast((perfect ? "🌟 PERFECT! " : "") + lab.split(" · ")[1] + " " + r.grade + " · " + r.score + "점 · " + r.correct + "/" + r.answered, unlockMsg);
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
  // v0.49: 결과 팝업의 이전 기록 비교·PERFECT 표시(복습 판은 resetRecord로 모두 숨긴다)
  function resetRecord() {
    $("r-rec").style.display = "none"; $("r-rec").textContent = "";
    $("r-perfect").style.display = "none"; $("r-combo-nb").style.display = "none";
    var m = document.querySelector(".modal.res"); m.classList.remove("pf");
    var x = m.querySelectorAll(".pfx"); for (var i = 0; i < x.length; i++) m.removeChild(x[i]);
  }
  function showRecord(r, prev, perfect) {
    resetRecord();
    var rec = $("r-rec"), c, b;
    if (prev.score === undefined) {
      rec.appendChild(el("b", "chip", "첫 도전")); rec.appendChild(el("span", "", "기록이 저장됐어요"));
    } else if (r.score > prev.score) {
      rec.appendChild(el("b", "chip gold", "🏆 신기록!"));
      c = el("span", ""); c.appendChild(el("s", "", String(prev.score))); c.appendChild(document.createTextNode(" → "));
      c.appendChild(el("b", "", r.score + "점")); rec.appendChild(c);
    } else {
      c = el("span", "", "이전 최고 "); c.appendChild(el("b", "", prev.score + "점")); rec.appendChild(c);
      rec.appendChild(el("span", "", "· " + (prev.score > r.score ? (prev.score - r.score) + "점 차이" : "같은 점수")));
    }
    rec.style.display = "";
    if (prev.score !== undefined && prev.combo !== undefined && r.bestCombo > prev.combo) $("r-combo-nb").style.display = "";
    if (perfect) {
      var m = document.querySelector(".modal.res");
      $("r-perfect").style.display = ""; m.classList.add("pf");
      var pos = [["8px", "10px"], ["6px", "calc(100% - 30px)"], ["40%", "-4px"], ["44%", "calc(100% - 22px)"], ["70%", "6px"]];
      for (var i = 0; i < pos.length; i++) {
        var e = el("span", "pfx", i % 2 ? "✦" : "★");
        e.style.top = pos[i][0]; e.style.left = pos[i][1]; e.style.fontSize = (14 + i * 3) + "px"; e.style.setProperty("--d", (i * 180) + "ms");
        m.appendChild(e);
      }
    }
  }
  var toastT = null;
  function showToast(text, sub) {
    var t = $("toast"); t.textContent = text;
    if (sub) t.appendChild(el("small", "", sub));
    t.style.display = "";
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.style.display = "none"; }, 2200);
  }
  function closeRes() { $("res-modal").style.display = "none"; ufxClear(); }

  // v0.57: 레벨 열림 축하 연출(결과 팝업). 빛 번짐·방울·색종이·폭죽은 CSS 애니메이션이라 모션 줄이기면 보이지 않는다(배너만 표시)
  var UFX_COLORS = ["#FF5767", "#FFC83A", "#4CCB4B", "#3D8BFF", "#FF6FAE", "#FF8F3A"], ufxT = null, ufxS = null;
  function ufxClear() {
    var sh = $("res-modal"), l = sh.querySelectorAll(".ufx"), i;
    for (i = 0; i < l.length; i++) sh.removeChild(l[i]);
    sh.querySelector(".modal.res").classList.remove("up");
    clearTimeout(ufxT); clearTimeout(ufxS);
  }
  function unlockSound(perfect) {   // 클리어·PERFECT 소리가 끝난 뒤 열림 소리(팝업이 열려 있을 때만)
    clearTimeout(ufxS);
    ufxS = setTimeout(function () { sfx("unlock"); }, perfect ? 2200 : 950);
  }
  function unlockBanner(n) {
    var d = el("div", "banner up unlock"), i, sp, s, pts = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1.4], [0, 1.4], [-1.6, 0], [1.6, 0]];
    d.innerHTML = '<span class="utag">NEW</span>' +
      '<svg class="ulock" viewBox="0 0 40 40" aria-hidden="true"><g class="sh"><path d="M12 19V13a8 8 0 0 1 16 0v6" fill="none" stroke="#24336B" stroke-width="9" stroke-linecap="round"/><path d="M12 19V13a8 8 0 0 1 16 0v6" fill="none" stroke="#DDE6F5" stroke-width="3.4" stroke-linecap="round"/></g><rect x="6" y="18" width="28" height="19" rx="5" fill="#FFC83A" stroke="#24336B" stroke-width="3"/><circle cx="20" cy="26.5" r="3" fill="#24336B"/><rect x="18.8" y="27" width="2.4" height="5.5" rx="1.2" fill="#24336B"/></svg>' +
      '<div class="utx"><b>새 레벨이 열렸어요!</b><span class="uchip">' + lvName(n) + '</span></div>';
    for (i = 0; i < pts.length; i++) {
      sp = el("span", "usp", i % 2 ? "\u2726" : "\u2605");
      sp.setAttribute("aria-hidden", "true"); sp.style.left = "44px"; sp.style.top = "50%";
      sp.style.setProperty("--dx", (pts[i][0] * 34) + "px"); sp.style.setProperty("--dy", (pts[i][1] * 22) + "px");
      d.appendChild(sp);
    }
    return d;
  }
  function ufxStart() {
    ufxClear();
    var sh = $("res-modal"), back = el("div", "ufx back"), bb, front, i, j, k, c, f, q, ang, r, dd, cols = UFX_COLORS;
    function rnd() { return Math.random(); }
    sh.querySelector(".modal.res").classList.add("up");
    back.appendChild(el("div", "glow")); sh.insertBefore(back, sh.firstChild);
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;   // 모션 줄이기: 배너·테두리 빛만
    bb = el("div", "ufx back");
    for (i = 0; i < 16; i++) {
      c = el("i", "bk");
      c.style.cssText = "--x:" + Math.round(rnd() * 100) + "%;--s:" + (10 + Math.round(rnd() * 16)) + "px;--c:" + cols[i % 6] + ";--sw:" + (Math.round(rnd() * 50) - 25) + "px;--d:" + (3 + rnd() * 1.5).toFixed(2) + "s;--dl:" + (rnd() * 1.2).toFixed(2) + "s";
      bb.appendChild(c);
    }
    sh.insertBefore(bb, sh.children[1]);
    front = el("div", "ufx front");
    for (i = 0; i < 44; i++) {
      c = el("i", "cf" + (i % 4 === 0 ? " rd" : ""));
      c.style.cssText = "--x:" + Math.round(rnd() * 100) + "%;--w:" + (8 + Math.round(rnd() * 5)) + "px;--h:" + (11 + Math.round(rnd() * 6)) + "px;--c:" + cols[i % 6] + ";--sw:" + (Math.round(rnd() * 60) - 30) + "px;--d:" + (2 + rnd() * 1.1).toFixed(2) + "s;--dl:" + (rnd() * 0.9).toFixed(2) + "s";
      front.appendChild(c);
    }
    [[18, 20, 0.15], [80, 15, 0.45], [50, 9, 0.75]].forEach(function (p) {
      f = el("div", "fw"); f.style.cssText = "--x:" + p[0] + "%;--y:" + p[1] + "%;--dl:" + p[2] + "s";
      for (q = 0; q < 14; q++) {
        ang = q / 14 * Math.PI * 2; r = 46 + (q % 2) * 16; dd = el("i");
        dd.style.cssText = "--c:" + cols[(q + p[0]) % 6] + ";--dx:" + Math.round(Math.cos(ang) * r) + "px;--dy:" + Math.round(Math.sin(ang) * r) + "px";
        f.appendChild(dd);
      }
      front.appendChild(f);
    });
    sh.appendChild(front);
    ufxT = setTimeout(function () { if (front.parentNode) front.parentNode.removeChild(front); }, 5000);   // 색종이·폭죽은 한 번만(5초 뒤 정리)
  }

  function openExit() { pauseLimit(); $("exit-modal").style.display = "grid"; $("exit-no").focus(); }
  function closeExit() { $("exit-modal").style.display = "none"; resumeLimit(); }

  // 설정 탭(v0.52): 화면 표시만 바꾸고 저장하지 않는다
  function setTab(k) {
    var ts = document.querySelectorAll("#settings .tab"), ps = document.querySelectorAll("#settings .pane");
    for (var i = 0; i < ts.length; i++) { var on = ts[i].dataset.tab === k; ts[i].classList.toggle("on", on); ts[i].setAttribute("aria-selected", on ? "true" : "false"); }
    for (var q = 0; q < ps.length; q++) ps[q].classList.toggle("on", ps[q].id === "p-" + k);
  }

  // ===== 레벨업 테스트: 영단어 직소 (v0.62) =====
  // v0.63: 다음 레벨 열림 조건. 레벨의 필수 조건(경험치 칸 가득 + 복습 0)을 채우면 도전을 제안하고, 퍼즐 5개 중 EJ.passNeed(레벨)개 이상 완성하면 통과해 다음 레벨이 열린다(실패해도 재도전 무제한). 게임 화면(#game)을 그대로 쓰고, 진행 상태는 jig에만 둔다(cur는 null).
  var jig = null, ltAsked = {}, ltAfter = null, jigT = null;
  function ltState(lv) {   // "pass" 통과함(다시 해 볼 수 있음) / "go" 도전 가능 / "lock" 조건 미달
    var t = EJ.levelTest(lv);
    if (t && t.p === true) return "pass";
    var x = EJ.xp(lv, requiredModes());
    return (x.cur === x.total && EJ.reviewLeft(lv) === 0) ? "go" : "lock";
  }
  function jigLeave() {   // 직소 화면 정리(다른 게임을 시작하거나 나갈 때)
    if (jigT) { clearTimeout(jigT); jigT = null; }
    jig = null;
    $("game").classList.remove("jig");
  }
  function ltOffer(after) {   // 도전 제안 팝업. 띄웠으면 true(레벨당 이 접속에서 한 번만 제안한다. 모드 목록의 줄은 계속 남는다)
    var lv = lastStage, nx = EJ.get("progress").lvs[String(lv + 1)];
    if (ltAsked[lv] || ltState(lv) !== "go" || !nx || nx.unlocked) return false;   // 다음 레벨이 이미 열려 있으면 제안하지 않는다(모드 목록 줄은 남는다)
    ltAsked[lv] = true; ltAfter = after;
    $("lt-text").textContent = lvName(lv) + "의 필수 조건을 모두 채웠어요! 영단어 직소 퍼즐 " + Jig.COUNT + "개 중 " + EJ.passNeed(lv) + "개를 완성하면 다음 레벨이 열려요. 도전해 볼까요?";
    $("lt-modal").style.display = "grid";
    $("lt-go").focus();
    return true;
  }
  function ltRowClick() {
    var st = ltState(lastStage);
    if (st === "lock") { showToast("레벨업 테스트는 아직 잠겨 있어요", "경험치 칸을 채우고 복습을 마치면 열려요"); return; }
    if (wordsOfStage(lastStage).length < 10) return;
    ltAsked[lastStage] = true;
    startJig(lastStage);
  }
  function startJig(lv) {
    clearTimer(); jigLeave();
    var data = Jig.build({ lv: lv, band: Game.bandOf(lv), words: ALLW });
    if (!data) { showToast("퍼즐을 준비하지 못했어요"); return false; }
    lastStage = lv; lastReview = false; cur = null; spell = null;
    jig = { lv: lv, d: data, pi: 0, si: 0, picked: null, correct: 0, full: 0, pOk: true, got: {} };
    $("game").classList.add("review", "jig");
    $("g-rtag").textContent = "레벨업 테스트 · " + lvName(lv);
    show("game");
    jigRender();
    return true;
  }
  function jigStep() { var p = jig.d.puzzles[jig.pi]; return { p: p, k: p.steps[jig.si] }; }
  function jigRender() {
    var s = jigStep(), p = s.p, k = s.k, card = $("g-card"), box = $("g-opts"), o = p.o[k];
    $("g-count").textContent = (jig.pi + 1) + " / " + jig.d.puzzles.length;
    $("g-bar").style.width = (jig.pi * 100 / jig.d.puzzles.length) + "%";
    $("g-foot").classList.remove("fb"); $("g-next").style.display = "none";
    card.textContent = ""; delete card.dataset.a; card.dataset.k = "";
    box.textContent = ""; box.className = "opts cw2" + (k === "x" ? " lt" : "");
    card.appendChild(el("div", "sub", k === "a" ? "가로 ① 단어를 골라 주세요" : k === "d" ? "세로 ② 단어를 골라 주세요" : "겹치는 칸의 알파벳은?"));
    jig.sub = card.firstChild;
    var cs = el("div", "cws");
    function clue(n, lab, ko, on) { var e = el("div", "cl" + (on ? " on" : "")), b = el("b", "", lab); e.appendChild(b); e.appendChild(document.createTextNode(ko)); return e; }
    cs.appendChild(clue(1, "가로 ①", p.a.ko, k === "a"));
    cs.appendChild(clue(2, "세로 ②", p.d.ko, k === "d"));
    card.appendChild(cs);
    var grid = el("div", "cw"); card.appendChild(grid); jig.grid = grid;
    jigGrid(false);
    for (var i = 0; i < o.options.length; i++) {
      var b = el("button", "opt en", o.options[i].toUpperCase()); b.dataset.i = String(i); b.type = "button"; box.appendChild(b);
    }
    jig.picked = null;
    jigFit();
  }
  // 격자 그리기: 정답을 맞혔거나(또는 틀려서 공개된) 단어는 글자를 채운다. reveal=true면 지금 단계의 정답까지 채운다
  function jigGrid(reveal, wrongKind) {
    var s = jigStep(), p = s.p, g = jig.grid, nc = p.a.en.length, nr = p.d.en.length, x, y;
    var got = jig.got, cur = s.k;
    if (reveal) { got = {}; for (var q in jig.got) got[q] = jig.got[q]; got[cur] = true; }
    g.textContent = "";
    g.style.gridTemplateColumns = "repeat(" + nc + ",var(--cs))"; g.style.gridAutoRows = "var(--cs)";
    for (y = 0; y < nr; y++) for (x = 0; x < nc; x++) {
      var inA = y === p.di, inD = x === p.ai, c = el("span");
      if (!inA && !inD) { c.style.visibility = "hidden"; g.appendChild(c); continue; }
      var isX = inA && inD, ch = "", cls = "c";
      if (isX) ch = (got.a || got.d || (got.x && reveal)) ? p.ch : "";
      else if (inA) ch = (x === 0 || got.a) ? p.a.en.charAt(x) : "";
      else ch = (y === 0 || got.d) ? p.d.en.charAt(y) : "";
      if (inA && x === 0) { cls = "c st"; c.appendChild(el("b", "", "1")); }
      else if (inD && y === 0) { cls = "c st"; c.appendChild(el("b", "", "2")); }
      else if (isX && cur === "x" && !reveal) { cls = "c x"; ch = "?"; }
      else if (reveal && ((cur === "a" && inA) || (cur === "d" && inD) || (cur === "x" && isX))) cls = "c " + (wrongKind === "bad" ? "bad" : "ok");
      else if (!reveal && ((cur === "a" && inA) || (cur === "d" && inD))) cls = "c act";
      c.className = cls;
      c.appendChild(document.createTextNode(ch.toUpperCase()));
      g.appendChild(c);
    }
    jigFit();
  }
  function jigFit() {   // 칸 크기: 화면에 들어가는 가장 큰 값(12~40px). 아래에 "다음" 버튼 자리(58px)를 남긴다
    var g = jig.grid, p = jigStep().p, nc = p.a.en.length, card = $("g-card"), box = $("g-opts"), inner = card.clientWidth - 28, best = 12, s;
    for (s = 40; s >= 12; s--) {
      g.style.setProperty("--cs", s + "px");
      if (nc * s + (nc - 1) * 2 <= inner && box.getBoundingClientRect().bottom + 58 <= window.innerHeight - 6) { best = s; break; }
    }
    g.style.setProperty("--cs", best + "px");
    var cells = g.children, fs = Math.max(10, Math.round(best * 0.56));
    for (var i = 0; i < cells.length; i++) cells[i].style.fontSize = fs + "px";
    var bs = box.children;
    for (var j = 0; j < bs.length; j++) { var f = parseFloat(getComputedStyle(bs[j]).fontSize); while (f > 10 && bs[j].scrollWidth > bs[j].clientWidth) { f--; bs[j].style.fontSize = f + "px"; } }
  }
  function jigPick(i) {
    if (!jig || jig.picked !== null) return;
    var s = jigStep(), o = s.p.o[s.k], ok = i === o.answer, bs = $("g-opts").children, k;
    jig.picked = i;
    for (k = 0; k < bs.length; k++) { bs[k].disabled = true; bs[k].classList.add(k === o.answer ? "right" : k === i ? "wrong" : "dim"); }
    if (ok) jig.correct++; else jig.pOk = false;
    jig.got[s.k] = true;
    jigGrid(true, "ok");   // 공개된 단어는 정답이므로 맞든 틀리든 초록으로 보여 준다
    sfx(ok ? "correct" : "wrong");
    jig.sub.className = "sub fbmsg " + (ok ? "good" : "bad");
    jig.sub.textContent = ok ? "정답이에요!" : "아쉬워요. 초록색이 정답이에요";
    if (ok) { jigT = setTimeout(jigNext, 800); }
    else { var nb = $("g-next"); nb.textContent = "다음"; nb.style.display = "block"; $("g-foot").classList.add("fb"); nb.focus(); }
  }
  function jigNext() {
    if (jigT) { clearTimeout(jigT); jigT = null; }
    if (!jig) return;
    var p = jig.d.puzzles[jig.pi];
    jig.si++;
    if (jig.si >= p.steps.length) {   // 퍼즐 하나 끝
      if (jig.pOk) jig.full++;
      jig.pi++; jig.si = 0; jig.pOk = true; jig.got = {};
      if (jig.pi >= jig.d.puzzles.length) { jigFinish(); return; }
    }
    jigRender();
  }
  // 끝날 때 한 번만 저장. 완성한 퍼즐이 통과 기준 이상이면 통과 기록을 남기고(필수 조건이 갖춰져 있으면) 다음 레벨을 연다
  function jigFinish() {
    var j = jig, total = j.d.total, gr = Jig.grade(j.correct, total), need = EJ.passNeed(j.lv);
    jigLeave();
    var res = EJ.recordLevelTest(j.lv, gr, j.correct, total, j.full, requiredModes());
    bgmSync(); resetRecord(); ufxClear();
    $("r-label").textContent = lvName(j.lv) + " · 레벨업 테스트";
    var badge = $("r-badge"); badge.textContent = ""; badge.className = "badge pop" + (res.passed ? "" : " gray");
    badge.appendChild(document.createTextNode(gr));
    $("r-score").textContent = "퍼즐 " + j.full + " / " + j.d.puzzles.length + " 완성";
    $("r-l1").textContent = "정답"; $("r-correct2").textContent = j.correct + " / " + total;
    $("r-l2").textContent = "통과 기준"; $("r-combo").textContent = need + "개";
    $("r-new-l").textContent = "기록"; $("r-new").textContent = res.saved ? "저장됨" : "그대로";
    var ban = $("r-banner"); ban.textContent = "";
    if (res.opened) { ban.appendChild(unlockBanner(j.lv + 1)); ufxStart(); }
    else if (res.passed) ban.appendChild(el("div", "banner up", "통과했어요!"));
    else ban.appendChild(el("div", "banner over", "퍼즐 " + need + "개를 완성하면 통과예요. 다시 도전해 보세요!"));
    $("r-next").style.display = "none";
    var ag = $("r-again");
    ag.style.display = res.passed ? "none" : ""; ag.dataset.act = "jig"; ag.className = "btn ib blue";
    ag.querySelector(".t").textContent = "다시 도전"; ag.querySelector(".s").textContent = "새 퍼즐";
    $("r-modes-t").textContent = "모드"; $("r-modes-s").textContent = "선택";
    sfx(res.passed ? "clear" : "over");
    if (res.opened) unlockSound(false);
    $("res-modal").style.display = "grid";
    (res.passed ? $("r-modes") : ag).focus();
  }

  function show(name) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.toggle("on", screens[i].id === name);
    }
    if (name === "home") { viewBand = -1; renderHome(); }
    if (name === "review") { rvLv = 0; rvPage = 1; renderReview(); }
    if (name === "modes") renderModes();
    if (name === "settings") { setTab("game"); renderSettings(); }
    bgmSync();   // 게임 화면에서만 재생, 다른 화면으로 가면 정지
    window.scrollTo(0, 0);
  }

  // 설정 화면: 저장된 값을 읽어 스위치·스타일을 표시한다(읽기만 하고 저장하지 않음)
  var SW_KEYS = { "sw-mute": "mute", "sw-sfx": "sfx", "sw-word": "word", "sw-result": "result", "sw-timer": "timer", "sw-bgm": "bgm" };
  function renderSettings() {
    var s = EJ.get("settings");
    function sw(id, on, dis) {
      var b = $(id); b.className = "sw " + (on ? "on" : "off");
      b.setAttribute("aria-checked", on ? "true" : "false"); b.disabled = !!dis;
    }
    sw("sw-mute", s.mute, false); sw("sw-sfx", s.sfx, s.mute); sw("sw-word", s.word, s.mute); sw("sw-result", s.result, false); sw("sw-timer", s.timer !== false, false);
    sw("sw-bgm", s.bgm !== false, s.mute);
    var bo = s.mute || s.bgm === false, bv = s.bgmVol === undefined ? 100 : s.bgmVol, rg = $("bgm-vol");
    rg.value = String(bv); rg.disabled = bo; rg.style.setProperty("--p", bv + "%"); $("bgm-vol-val").textContent = bv + "%"; $("bgm-vol-row").classList.toggle("off", bo);
    $("beta-band").value = s.betaBand || "";   // BETA-TEST
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
    var empty = wordsOfStage(n).length < 10;   // 단어 기준(문장은 레벨당 10개 확보)
    var note = $("modes-note"); note.textContent = "";
    if (empty) note.appendChild(el("div", "say bad", lvName(n) + " 단어는 아직 준비 중이에요"));
    var req = requiredModes(), nx = EJ.get("progress").lvs[String(n + 1)];
    var xn = EJ.xp(n, req);
    $("modes-prog").textContent = "경험치 " + xn.cur + "/" + xn.total + " · 모드마다 A 이상 " + xn.per + "회" + ((nx && !nx.unlocked) ? " · 채우고 레벨업 테스트를 통과하면 다음 레벨이 열려요" : "");
    var lvst = EJ.get("progress").lvs[String(n)];
    for (var mi = 0; mi < MODE_ORDER.length; mi++) {
      var mg = document.querySelector('[data-mg="' + MODE_ORDER[mi] + '"]'), g = (lvst.g && lvst.g[MODE_ORDER[mi]]) || "";
      mg.textContent = g || "-";
      mg.className = "mg" + (g ? (EJ.gradeAtLeast(g, "A") ? " ok" : "") : " none");
    }
    var lts = ltState(n), ltr = EJ.levelTest(n), lrow = $("lt-row"), nlk = !!(nx && !nx.unlocked);   // v0.63 레벨업 테스트 줄(읽기만)
    lrow.className = "chunk mode lt" + (lts === "lock" ? " lock" : lts === "pass" ? " done" : "");
    $("lt-desc").textContent = lts === "lock" ? "필수 조건을 채우면 열려요" : lts === "pass" ? "영단어 직소 · 최고 " + ltr.f + "/" + Jig.COUNT + "개 완성" : "영단어 직소 · " + (nlk ? EJ.passNeed(n) + "개 완성하면 다음 레벨이 열려요" : "도전해 보세요");
    $("lt-tag").textContent = lts === "lock" ? "잠김" : lts === "pass" ? "통과" : "도전!";
    lrow.disabled = empty;
    var btns = document.querySelectorAll("[data-start]");
    for (var i = 0; i < btns.length; i++) btns[i].disabled = empty;
    // 듣기: 영어 음성이 없는 기기에서는 막고 안내한다
    var lb = document.querySelector('[data-start="listen"]');
    var noSound = !Sound.ok();
    lb.classList.toggle("soon", noSound);
    $("listen-chip").style.display = noSound ? "" : "none";
    document.querySelector('[data-mg="listen"]').style.display = noSound ? "none" : ""; 
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
    var bm = t.closest("[data-bandmove]");
    if (bm) {   // 등급 넘기기(저장하지 않음)
      if (!bm.disabled) { viewBand += +bm.dataset.bandmove; renderHome(); var nb = document.querySelector('[data-bandmove="' + bm.dataset.bandmove + '"]'); if (nb && !nb.disabled) nb.focus(); }
      return;
    }
    if (t.closest("[data-lock]")) { lockMsg(); return; }
    var go = t.closest("[data-go]");
    if (go && !go.disabled) {
      if (go.dataset.stage) {
        $("modes-title").textContent = go.dataset.stage;
        lastStage = +go.dataset.n || 1;
      }
      show(go.dataset.go);
      return;
    }
    var lm = t.closest("[data-lvmove]");
    if (lm) {   // 복습 목록: 레벨 넘기기(저장하지 않음)
      if (!lm.disabled) {
        var ks = {}, ls = [], it2 = EJ.get("review").items, q;
        for (q = 0; q < it2.length; q++) ks[it2[q].lv] = 1;
        for (q = 1; q <= LV_COUNT; q++) if (ks[q]) ls.push(q);
        var ni = ls.indexOf(rvLv) + (+lm.dataset.lvmove);
        if (ni >= 0 && ni < ls.length) { rvLv = ls[ni]; rvPage = 1; renderReview(); var nb = document.querySelector('[data-lvmove="' + lm.dataset.lvmove + '"]'); if (nb && !nb.disabled) nb.focus(); }
      }
      return;
    }
    var pm = t.closest("[data-pgmove]");
    if (pm) {   // 복습 목록: 쪽 넘기기(저장하지 않음)
      if (!pm.disabled) { rvPage += +pm.dataset.pgmove; renderReview(); var np = document.querySelector('[data-pgmove="' + pm.dataset.pgmove + '"]'); if (np && !np.disabled) np.focus(); }
      return;
    }
    var rb = t.closest("[data-review]");
    if (rb && !rb.disabled) { startReview(+rb.dataset.review); return; }
    if (t.closest("#lt-row")) { if (!$("lt-row").disabled) ltRowClick(); return; }
    if (t.closest("#lt-go")) { $("lt-modal").style.display = "none"; ltAfter = null; startJig(lastStage); return; }
    if (t.closest("#lt-later")) { $("lt-modal").style.display = "none"; var af = ltAfter; ltAfter = null; if (af) af(); return; }
    var st = t.closest("[data-start]");
    if (st && !st.disabled) { startGame(lastStage, st.dataset.start); return; }
    var op = t.closest(".opt");
    if (op && !op.disabled && op.parentNode.id === "g-opts") { if (jig) jigPick(+op.dataset.i); else onPick(+op.dataset.i); return; }
    if (t.closest("#g-spk")) { speakCurrent(true); return; }
    if (t.closest("#g-hint")) { onHint(); return; }
    if (t.closest("#g-erase")) { sentSubmit(); return; }
    if (t.closest("#g-next")) { if (jig) jigNext(); else next(); return; }
    if (t.closest("#g-exit")) { openExit(); return; }
    if (t.closest("#exit-no")) { closeExit(); return; }
    if (t.closest("#exit-yes")) { freezeLimit(); tm = null; closeExit(); closeRes(); clearTimer(); jigLeave(); Sound.stop(); cur = null; fxClear(); show("home"); return; }
    if (t.closest("#r-next")) { closeRes(); var rn = function () { if (lastReview || $("r-next").dataset.act === "review") { startReview(lastStage); return; } startGame(lastStage, $("r-next").dataset.mode || lastMode); }; if (!ltOffer(rn)) rn(); return; }
    if (t.closest("#r-again")) { closeRes(); if ($("r-again").dataset.act === "jig") { startJig(lastStage); return; } var ra = function () { startGame(lastStage, lastMode); }; if (!ltOffer(ra)) ra(); return; }
    if (t.closest("#r-modes")) { closeRes(); var rm = function () { if (lastReview) { show("review"); return; } $("modes-title").textContent = lvName(lastStage); show("modes"); }; if (!ltOffer(rm)) rm(); return; }
  });

  // 키보드: 방향키로 활성 보기 사이 이동 (Enter는 버튼 기본 동작)
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && $("exit-modal").style.display === "grid") { closeExit(); return; }
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

  // 배경음악 볼륨 슬라이더: 움직이는 동안 미리 듣기, 손을 떼면(변경 시) 한 번만 저장
  (function () {
    var rg = $("bgm-vol");
    rg.addEventListener("input", function () { var v = +rg.value; rg.style.setProperty("--p", v + "%"); $("bgm-vol-val").textContent = v + "%"; bgmPreview(v); });
    rg.addEventListener("change", function () { EJ.setSetting("bgmVol", +rg.value); });
  })();

  document.querySelector("#settings .tabs").addEventListener("click", function (e) { var t = e.target.closest(".tab"); if (t) setTab(t.dataset.tab); });   // 설정 탭

  $("beta-band").addEventListener("change", function () { EJ.setSetting("betaBand", $("beta-band").value); });   // BETA-TEST

  window.addEventListener("resize", refit);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { pauseLimit(); bgmOn = false; BGM.stop(0.2); }   // 화면이 가려지면 음악도 멈춘다
    else { if ($("exit-modal").style.display !== "grid") resumeLimit(); bgmSync(); }
  });

  var h = (location.hash || "#home").slice(1);
  show(h === "modes" || h === "review" || h === "settings" ? h : h === "wordbook" ? "review" : "home");
})();
