// 영어정복 캐릭터·말풍선 (v0.72): 홈·모드 선택에서는 대기 캐릭터+말풍선, 게임 중에는 상황에 맞는 캐릭터가 잠깐 나왔다 사라진다.
// 화면 표시만 하고 저장·게임 규칙에는 관여하지 않는다(읽기·저장 없음). 이미지는 img/chr/<등급 코드>/<상황>.webp (대기 이미지 idle은 평민~전설 10개 등급 모두 있고, 표정 이미지는 평민~전설 10개 등급 모두 있음(전설은 v0.86)). 직업 이미지(마법사)는 img/chr/wiz/<등급 코드>/에 대기 이미지만 보관 중(v0.86, 화면 연결은 직업 선택 단계)
(function () {
  "use strict";

  var JOB = "warrior";   // 직업: warrior(전사)·wizard(마법사). app.js가 Chr.setJob으로 정한다(v0.87)
  var BAND = "c";   // 지금 보여 줄 등급 코드(app.js가 Chr.setBand로 바꾼다)
  var POSES = { c: true, b: true, t: true, f: true, w: true, e: true, m: true, g: true, p: true, l: true };   // 표정 이미지(smile 등 6종)가 있는 등급(평민~전설, 전설은 v0.86). 새 등급·직업의 표정 이미지가 생기면 여기에 추가한다
  var KINDS = ["idle", "smile", "happy", "sad", "cheer", "danger", "party"];

  // 상황별 대사 후보(\n은 줄바꿈). 같은 상황에서 직전과 같은 대사는 연속으로 나오지 않는다
  var LINES = {
    home: ["오늘도\n열심히 해보자!", "나는 할 수 있어!", "어제보다\n한 단어 더!", "오늘은 몇 레벨까지\n가볼까?"],
    modes: ["오늘은 어떤\n게임을 해볼까?", "이전에 어디까지\n했더라?", "칸을 가득\n채워 보자!", "약한 모드부터\n도전해 볼까?"],
    smile: ["좋아,\n시작해 볼까?", "집중, 집중!", "한 판에 10문제,\n간다!"],
    happy: ["정답이야!\n좋았어!", "딱 맞혔다!", "이 느낌 좋아!"],
    sad: ["아쉽다...\n다음엔 맞힐 수 있어!", "괜찮아,\n다시 해 보자!", "이건 복습하면 돼!"],
    cheer: ["굉장해!\n연속 정답이다!", "불타오른다!", "멈추지 않아!"],
    danger: ["으악!\n체력이 얼마 안 남았어!", "조심해!\n한 번만 더 틀리면 끝이야!"],
    time: ["시간이 얼마\n안 남았어!", "서둘러!\n시간이 없어!", "째깍째깍...\n빨리빨리!"],
    hp1: ["체력이 얼마 안 남았어!\n집중해!", "한 번만 더 틀리면\n끝이야!", "정신 차리자,\n마지막 기회야!"],
    cry: ["으앙...\n체력이 다 떨어졌어", "흑흑...\n다음엔 꼭 해낼 거야!", "너무 아쉬워...\n다시 도전하자!"],
    party: ["새 레벨이 열렸어!\n해냈다!", "우리가 해냈어!"]
  };
  var IMG_OF = { home: "idle", modes: "idle", smile: "smile", happy: "happy", sad: "sad", cheer: "cheer", danger: "danger", time: "danger", hp1: "danger", cry: "sad", party: "party" };   // 우는 전용 이미지(cry.webp)가 생기면 cry를 "cry"로 바꾸고 KINDS에 추가한다

  var last = {};   // 상황별 직전 대사 번호
  function pickLine(key) {
    var a = LINES[key], i = Math.floor(Math.random() * a.length);
    if (a.length > 1 && i === last[key]) i = (i + 1 + Math.floor(Math.random() * (a.length - 1))) % a.length;
    last[key] = i;
    return a[i];
  }
  // 마법사는 표정 이미지가 아직 없어 모든 상황에 그 등급의 대기 이미지(img/chr/wiz/<등급 코드>/idle.webp)를 쓴다. 표정 시트가 오면 POSES처럼 확장한다
  function src(kind) { if (JOB === "wizard") return "img/chr/wiz/" + BAND + "/idle.webp"; return "img/chr/" + BAND + "/" + kind + ".webp"; }
  function reduced() { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }

  // 이미지 미리 받기(처음 나올 때 깜빡이지 않게). 실패해도 게임에는 영향 없다
  function preload() { var im = new Image(); im.src = src("idle"); if (JOB === "wizard" || !POSES[BAND]) return; for (var i = 0; i < KINDS.length; i++) { im = new Image(); im.src = src(KINDS[i]); } }

  // 말풍선: 둥근 네모+꼬리를 SVG 경로 하나(닫힌 선 1개)로 그려 겹치는 선·어긋남이 없게 한다. 글 크기가 바뀌면 다시 그린다(v0.73)
  var SVGNS = "http://www.w3.org/2000/svg", R = 16, TH = 9, TL = 13, SW = 3;   // 모서리 반지름, 꼬리 밑변 절반, 꼬리 길이, 선 굵기
  function drawBubble(b) {
    var r = b.getBoundingClientRect(), w = r.width, h = r.height;
    if (w < 20 || h < 20) return;
    var s = SW / 2, x1 = w - s, y1 = h - s, cy = h / 2, rr = Math.min(R, (h - SW - 2 * TH - 2) / 2);
    if (rr < 6) rr = 6;
    var d = "M" + (s + rr) + "," + s + " H" + (x1 - rr) + " A" + rr + "," + rr + " 0 0 1 " + x1 + "," + (s + rr) +
      " V" + (cy - TH) + " C" + x1 + "," + (cy - TH * 0.55) + " " + (x1 + TL * 0.45) + "," + (cy - 2) + " " + (x1 + TL) + "," + cy +
      " C" + (x1 + TL * 0.45) + "," + (cy + 2) + " " + x1 + "," + (cy + TH * 0.55) + " " + x1 + "," + (cy + TH) +
      " V" + (y1 - rr) + " A" + rr + "," + rr + " 0 0 1 " + (x1 - rr) + "," + y1 +
      " H" + (s + rr) + " A" + rr + "," + rr + " 0 0 1 " + s + "," + (y1 - rr) +
      " V" + (s + rr) + " A" + rr + "," + rr + " 0 0 1 " + (s + rr) + "," + s + " Z";
    var svg = b.querySelector("svg.bg");
    if (!svg) {
      svg = document.createElementNS(SVGNS, "svg"); svg.setAttribute("class", "bg"); svg.setAttribute("aria-hidden", "true");
      var p = document.createElementNS(SVGNS, "path"); svg.appendChild(p); b.insertBefore(svg, b.firstChild);
    }
    svg.setAttribute("width", w + TL + s); svg.setAttribute("height", h); svg.setAttribute("viewBox", "0 0 " + (w + TL + s) + " " + h);
    var path = svg.firstChild; path.setAttribute("d", d);
  }
  var ro = window.ResizeObserver ? new ResizeObserver(function (ents) { for (var i = 0; i < ents.length; i++) drawBubble(ents[i].target); }) : null;
  function setBubble(box, text) {
    box.textContent = "";
    var b = document.createElement("div"); b.className = "chrb";
    var t = document.createElement("span"); t.textContent = text; b.appendChild(t);
    box.appendChild(b);
    if (ro) ro.observe(b);
    drawBubble(b);
    if (window.requestAnimationFrame) requestAnimationFrame(function () { drawBubble(b); });
  }

  // ① 홈·모드 선택의 대기 캐릭터(화면 아래 고정 영역)
  var docks = { home: null, modes: null }, idleName = "", idleTimer = null;
  function dockOf(name) { return document.getElementById("dock-" + name); }
  function fillDock(name) {
    var d = dockOf(name); if (!d) return;
    var im = d.querySelector(".chrimg"), bw = d.querySelector(".chrbw");
    if (im && im.getAttribute("src") !== src("idle")) im.src = src("idle");
    if (bw) setBubble(bw, pickLine(name));
  }
  function stopIdle() { if (idleTimer) { clearInterval(idleTimer); idleTimer = null; } idleName = ""; }

  // ② 게임 중 팝업(문제 아래 빈 공간 오른쪽에 캐릭터, 왼쪽에 말풍선)
  var pop = null, popImg = null, popPh = null, popBox = null, popTimer = null;
  function ensurePop() {
    if (pop) return;
    pop = document.createElement("div"); pop.id = "chr-pop"; pop.className = "chrpop"; pop.setAttribute("aria-hidden", "true"); pop.style.display = "none";
    popBox = document.createElement("div"); popBox.className = "chrbw";
    popImg = document.createElement("img"); popImg.className = "chrimg"; popImg.alt = ""; popImg.draggable = false;
    popPh = document.createElement("div"); popPh.className = "chrph"; popPh.textContent = "준비중"; popPh.style.display = "none";
    pop.appendChild(popBox); pop.appendChild(popImg); pop.appendChild(popPh);
    document.body.appendChild(pop);
  }
  function hide() {
    if (popTimer) { clearTimeout(popTimer); popTimer = null; }
    if (pop) { pop.style.display = "none"; pop.classList.remove("in", "over"); }
  }
  // 게임 화면에서 문제·보기 아래 ~ 하단 줄(힌트·다음 버튼) 위의 빈 높이를 잰다
  function freeSpace() {
    var g = document.getElementById("game"), foot = document.getElementById("g-foot");
    if (!g || !foot) return null;
    var top = 0, kids = g.children, i;
    for (i = 0; i < kids.length; i++) {
      var c = kids[i];
      if (c === foot || c.classList.contains("shade") || getComputedStyle(c).display === "none" || getComputedStyle(c).position === "fixed") continue;
      var r = c.getBoundingClientRect(); if (r.height > 0 && r.bottom > top) top = r.bottom;
    }
    var fr = foot.getBoundingClientRect();
    return { top: top, bottom: fr.top, avail: fr.top - top };
  }
  function show(kind, opt) {
    opt = opt || {};
    ensurePop();
    var h, bottom;
    if (opt.over) {   // 결과 팝업 위(레벨 열림 축하): 화면 아래 모서리에 작게
      h = Math.min(150, Math.round(window.innerHeight * 0.22)); bottom = 8;
    } else {
      var f = freeSpace();
      if (!f || f.avail < 84) { hide(); return; }   // 빈 공간이 모자라면(직소 등) 나오지 않는다
      h = Math.min(170, Math.floor(f.avail - 8)); bottom = Math.round(window.innerHeight - f.bottom) + 6;
    }
    popBox.textContent = ""; setBubble(popBox, pickLine(kind));
    var has = JOB === "wizard" || !!POSES[BAND];   // 표정 이미지가 없는 등급은 "준비중" 상자로 대신한다
    popImg.style.display = has ? "" : "none"; popPh.style.display = has ? "none" : "";
    if (has) popImg.src = src(IMG_OF[kind]);
    pop.style.height = h + "px"; pop.style.bottom = bottom + "px";
    pop.classList.toggle("over", !!opt.over);
    pop.style.display = "flex";
    var pb = popBox.querySelector(".chrb"); if (pb) drawBubble(pb);
    pop.classList.remove("in"); void pop.offsetWidth; if (!reduced()) pop.classList.add("in");
    if (popTimer) clearTimeout(popTimer);
    popTimer = setTimeout(hide, opt.ms || 1500);
  }

  window.Chr = {
    // 화면이 바뀔 때 호출: 홈·모드 선택이면 대기 캐릭터를 갱신하고 말풍선을 주기적으로 바꾼다
    screen: function (name) {
      hide(); stopIdle();
      if (name === "home" || name === "modes") {
        fillDock(name); idleName = name;
        idleTimer = setInterval(function () {
          var d = dockOf(idleName), bw = d && d.querySelector(".chrbw");
          if (bw && d.offsetParent !== null && !document.hidden) setBubble(bw, pickLine(idleName));
        }, 9000);
      }
    },
    // 등급이 바뀌면 호출: 대기 이미지를 그 등급 것으로 바꾼다(말풍선은 그대로)
    setBand: function (id) {
      if (!id || id === BAND) return;
      BAND = id; preload();
      var d = dockOf("home"), e = dockOf("modes"), i;
      for (i = 0; i < 2; i++) { var dk = [d, e][i], im = dk && dk.querySelector(".chrimg"); if (im) im.src = src("idle"); }
    },
    // 직업(캐릭터)이 정해지면 호출: 대기 이미지를 그 직업 것으로 바꾼다
    setJob: function (j) {
      if ((j !== "warrior" && j !== "wizard") || j === JOB) return;
      JOB = j; preload();
      var ids = ["home", "modes"], i;
      for (i = 0; i < 2; i++) { var dk = dockOf(ids[i]), im = dk && dk.querySelector(".chrimg"); if (im) im.src = src("idle"); }
    },
    pop: show,
    hide: hide,
    // 점검용: 상황별 대사 목록
    lines: LINES
  };
  preload();
})();
