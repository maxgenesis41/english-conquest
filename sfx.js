// 영어정복 B-2: 효과음. 파일 없이 브라우저(Web Audio)로 직접 합성한다. 스타일 3종.
// 음 하나: [시작 주파수, 시작 시각(초), 길이(초), 파형, 크기, 끝 주파수(선택)]
var SFX = (function () {
  "use strict";
  var ctx = null, failed = false;
  var GAIN = 0.9;   // 전체 음량(기기 음량으로 조절)
  var STYLES = ["retro", "bright", "chime"];
  // v0.49·v0.50 PERFECT 팡파레(약 2초): 북 소리 도입 → 상승 아르페지오 → 화음 타격 2번 → 화음 길게 + 낮은 받침음 → 반짝이는 높은 음
  function fan(w, a, o) {
    var n = [], i, run = [523, 659, 784, 1047, 1319, 1568], chord = [1047, 1319, 1568], sp = [2637, 3136, 3520, 3136, 2637, 3136, 3520, 2637];
    if (o.roll) for (i = 0; i < 6; i++) n.push([170 + i * 30, i * 0.04, 0.06, "triangle", a * 0.7]);
    for (i = 0; i < run.length; i++) n.push([run[i], 0.26 + i * 0.06, o.run, w, a]);
    [0.66, 0.8].forEach(function (t) { chord.forEach(function (f) { n.push([f, t, o.stab, w, a * 0.8]); }); });
    chord.concat([2093]).forEach(function (f) { n.push([f, 0.96, o.hold, w, a * 0.8]); });
    n.push([262, 0.96, o.hold, o.bass, a * 0.9]); n.push([131, 0.96, o.hold, o.bass, a * 0.9]);
    for (i = 0; i < sp.length; i++) n.push([sp[i], 1.05 + i * 0.09, 0.12, "sine", a * 0.45]);
    return n;
  }
  var SETS = {
    retro: { boost: 1.5, s: {
      click: [[1200, 0, 0.04, "square", 0.12]],
      tick: [[1500, 0, 0.03, "square", 0.1]],
      tickfast: [[2100, 0, 0.03, "square", 0.14]],
      correct: [[988, 0, 0.07, "square", 0.13], [1319, 0.07, 0.16, "square", 0.13]],
      wrong: [[200, 0, 0.1, "square", 0.14], [150, 0.1, 0.18, "square", 0.14]],
      combo: [[523, 0, 0.05, "square", 0.12], [659, 0.05, 0.05, "square", 0.12], [784, 0.1, 0.05, "square", 0.12], [1047, 0.15, 0.05, "square", 0.12], [1319, 0.2, 0.15, "square", 0.13]],
      clear: [[523, 0, 0.08, "square", 0.12], [659, 0.08, 0.08, "square", 0.12], [784, 0.16, 0.08, "square", 0.12], [1047, 0.24, 0.08, "square", 0.12], [784, 0.32, 0.08, "square", 0.12], [1047, 0.4, 0.08, "square", 0.12], [1319, 0.48, 0.35, "square", 0.13]],
      perfect: fan("square", 0.09, { roll: true, run: 0.08, stab: 0.1, hold: 0.9, bass: "square" }),
      over: [[392, 0, 0.12, "square", 0.12], [370, 0.12, 0.12, "square", 0.12], [349, 0.24, 0.12, "square", 0.12], [330, 0.36, 0.35, "square", 0.13, 200]]
    } },
    bright: { boost: 1, s: {
      click: [[880, 0, 0.06, "triangle", 0.25, 1320]],
      tick: [[1000, 0, 0.04, "triangle", 0.22, 800]],
      tickfast: [[1500, 0, 0.04, "triangle", 0.32, 1100]],
      correct: [[1047, 0, 0.1, "triangle", 0.3], [1319, 0.09, 0.18, "triangle", 0.3], [2093, 0.09, 0.12, "sine", 0.08]],
      wrong: [[260, 0, 0.22, "sawtooth", 0.18, 170], [180, 0.12, 0.2, "sawtooth", 0.14, 120]],
      combo: [[784, 0, 0.07, "triangle", 0.28], [988, 0.07, 0.07, "triangle", 0.28], [1175, 0.14, 0.07, "triangle", 0.28], [1568, 0.21, 0.2, "triangle", 0.3]],
      clear: [[523, 0, 0.12, "triangle", 0.3], [659, 0.12, 0.12, "triangle", 0.3], [784, 0.24, 0.12, "triangle", 0.3], [1047, 0.36, 0.4, "triangle", 0.32], [1319, 0.36, 0.4, "sine", 0.15], [1568, 0.36, 0.4, "sine", 0.1]],
      perfect: fan("triangle", 0.2, { roll: true, run: 0.1, stab: 0.12, hold: 1.0, bass: "triangle" }),
      over: [[392, 0, 0.18, "triangle", 0.28], [330, 0.18, 0.18, "triangle", 0.28], [262, 0.36, 0.18, "triangle", 0.28], [196, 0.54, 0.4, "triangle", 0.28, 150]]
    } },
    chime: { boost: 1, s: {
      click: [[660, 0, 0.08, "sine", 0.22]],
      tick: [[880, 0, 0.07, "sine", 0.18]],
      tickfast: [[1320, 0, 0.07, "sine", 0.28]],
      correct: [[1047, 0, 0.35, "sine", 0.28], [2094, 0, 0.2, "sine", 0.08], [1568, 0.12, 0.4, "sine", 0.26], [3136, 0.12, 0.2, "sine", 0.06]],
      wrong: [[330, 0, 0.3, "sine", 0.3, 247], [311, 0.02, 0.3, "triangle", 0.1, 233]],
      combo: [[880, 0, 0.25, "sine", 0.24], [1109, 0.08, 0.25, "sine", 0.24], [1319, 0.16, 0.3, "sine", 0.24], [1760, 0.24, 0.45, "sine", 0.26]],
      clear: [[523, 0, 0.5, "sine", 0.26], [659, 0.15, 0.5, "sine", 0.26], [784, 0.3, 0.55, "sine", 0.26], [1047, 0.45, 0.9, "sine", 0.3], [2094, 0.45, 0.5, "sine", 0.07]],
      perfect: fan("sine", 0.16, { roll: false, run: 0.5, stab: 0.35, hold: 1.6, bass: "sine" }),
      over: [[440, 0, 0.4, "sine", 0.26], [349, 0.3, 0.4, "sine", 0.26], [294, 0.6, 0.7, "sine", 0.26, 262]]
    } }
  };

  function ac() {
    if (failed) return null;
    try {
      if (!ctx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) { failed = true; return null; }
        ctx = new C();
      }
      if (ctx.state === "suspended" && ctx.resume) ctx.resume();
      return ctx;
    } catch (e) { failed = true; return null; }
  }

  // v0.46 콤보 정답음: correct3·correct5·correct10 = 기본 정답음을 반음 단위로 올리고 반짝음을 얹는다(연속 3·5·10회 단계)
  var TIER = { 3: { r: 1.122, sp: 1 }, 5: { r: 1.26, sp: 2 }, 10: { r: 1.498, sp: 3 } };   // r: 음높이 배율(+2·+4·+7반음), sp: 반짝음 개수
  var SPARK = [1.26, 1.498, 2], SPARK_MAX = 3600;   // 반짝음 높이: 주된 음 위 장3도·완전5도·옥타브(너무 날카롭지 않게 상한 둠)
  function tierNotes(base, tier) {
    var T = TIER[tier], out = [], i, top = 0, maxAmp = 0, n;
    for (i = 0; i < base.length; i++) maxAmp = Math.max(maxAmp, base[i][4] || 0.3);
    for (i = 0; i < base.length; i++) {
      n = base[i].slice(); n[0] = Math.min(SPARK_MAX, n[0] * T.r); if (n[5]) n[5] = Math.min(SPARK_MAX, n[5] * T.r); out.push(n);
      if ((base[i][4] || 0.3) >= maxAmp * 0.5) top = Math.max(top, n[0]);   // 주된 음(작은 배음 제외) 중 가장 높은 음
    }
    for (i = 0; i < T.sp; i++) out.push([Math.min(SPARK_MAX, top * SPARK[i]), 0.12 + i * 0.07, 0.1, base[0][3], maxAmp * 0.6]);
    return out;
  }

  // name: click / correct / correct3·5·10(콤보 단계) / wrong / combo / clear / perfect(v0.49 만점) / over / tick(주황) / tickfast(빨강). 재생을 시작했으면 true
  function play(name, style) {
    var set = SETS[style] || SETS.retro, notes = set.s[name], m = /^correct(3|5|10)$/.exec(name);
    if (m) notes = tierNotes(set.s.correct, +m[1]);
    if (!notes) return false;
    var c = ac(); if (!c) return false;
    try {
      var t0 = c.currentTime + 0.02, vol = GAIN * (set.boost || 1);
      for (var i = 0; i < notes.length; i++) {
        var n = notes[i], o = c.createOscillator(), g = c.createGain();
        var st = t0 + n[1], d = n[2], peak = Math.max(0.0002, (n[4] || 0.3) * vol);
        o.type = n[3];
        o.frequency.setValueAtTime(n[0], st);
        if (n[5]) o.frequency.exponentialRampToValueAtTime(n[5], st + d);
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(peak, st + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, st + d);
        o.connect(g); g.connect(c.destination);
        o.start(st); o.stop(st + d + 0.03);
      }
      return true;
    } catch (e) { return false; }
  }

  return { play: play, STYLES: STYLES, tierNotes: tierNotes, SETS: SETS };
})();
