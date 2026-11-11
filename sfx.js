// 영어정복 B-2: 효과음. 파일 없이 브라우저(Web Audio)로 직접 합성한다. 스타일 3종.
// 음 하나: [시작 주파수, 시작 시각(초), 길이(초), 파형, 크기, 끝 주파수(선택)]
var SFX = (function () {
  "use strict";
  var ctx = null, failed = false;
  var GAIN = 0.9;   // 전체 음량(기기 음량으로 조절)
  var STYLES = ["retro", "bright", "chime"];
  var SETS = {
    retro: { boost: 1.5, s: {
      click: [[1200, 0, 0.04, "square", 0.12]],
      correct: [[988, 0, 0.07, "square", 0.13], [1319, 0.07, 0.16, "square", 0.13]],
      wrong: [[200, 0, 0.1, "square", 0.14], [150, 0.1, 0.18, "square", 0.14]],
      combo: [[523, 0, 0.05, "square", 0.12], [659, 0.05, 0.05, "square", 0.12], [784, 0.1, 0.05, "square", 0.12], [1047, 0.15, 0.05, "square", 0.12], [1319, 0.2, 0.15, "square", 0.13]],
      clear: [[523, 0, 0.08, "square", 0.12], [659, 0.08, 0.08, "square", 0.12], [784, 0.16, 0.08, "square", 0.12], [1047, 0.24, 0.08, "square", 0.12], [784, 0.32, 0.08, "square", 0.12], [1047, 0.4, 0.08, "square", 0.12], [1319, 0.48, 0.35, "square", 0.13]],
      over: [[392, 0, 0.12, "square", 0.12], [370, 0.12, 0.12, "square", 0.12], [349, 0.24, 0.12, "square", 0.12], [330, 0.36, 0.35, "square", 0.13, 200]]
    } },
    bright: { boost: 1, s: {
      click: [[880, 0, 0.06, "triangle", 0.25, 1320]],
      correct: [[1047, 0, 0.1, "triangle", 0.3], [1319, 0.09, 0.18, "triangle", 0.3], [2093, 0.09, 0.12, "sine", 0.08]],
      wrong: [[260, 0, 0.22, "sawtooth", 0.18, 170], [180, 0.12, 0.2, "sawtooth", 0.14, 120]],
      combo: [[784, 0, 0.07, "triangle", 0.28], [988, 0.07, 0.07, "triangle", 0.28], [1175, 0.14, 0.07, "triangle", 0.28], [1568, 0.21, 0.2, "triangle", 0.3]],
      clear: [[523, 0, 0.12, "triangle", 0.3], [659, 0.12, 0.12, "triangle", 0.3], [784, 0.24, 0.12, "triangle", 0.3], [1047, 0.36, 0.4, "triangle", 0.32], [1319, 0.36, 0.4, "sine", 0.15], [1568, 0.36, 0.4, "sine", 0.1]],
      over: [[392, 0, 0.18, "triangle", 0.28], [330, 0.18, 0.18, "triangle", 0.28], [262, 0.36, 0.18, "triangle", 0.28], [196, 0.54, 0.4, "triangle", 0.28, 150]]
    } },
    chime: { boost: 1, s: {
      click: [[660, 0, 0.08, "sine", 0.22]],
      correct: [[1047, 0, 0.35, "sine", 0.28], [2094, 0, 0.2, "sine", 0.08], [1568, 0.12, 0.4, "sine", 0.26], [3136, 0.12, 0.2, "sine", 0.06]],
      wrong: [[330, 0, 0.3, "sine", 0.3, 247], [311, 0.02, 0.3, "triangle", 0.1, 233]],
      combo: [[880, 0, 0.25, "sine", 0.24], [1109, 0.08, 0.25, "sine", 0.24], [1319, 0.16, 0.3, "sine", 0.24], [1760, 0.24, 0.45, "sine", 0.26]],
      clear: [[523, 0, 0.5, "sine", 0.26], [659, 0.15, 0.5, "sine", 0.26], [784, 0.3, 0.55, "sine", 0.26], [1047, 0.45, 0.9, "sine", 0.3], [2094, 0.45, 0.5, "sine", 0.07]],
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

  // name: click / correct / wrong / combo / clear / over. 재생을 시작했으면 true
  function play(name, style) {
    var set = SETS[style] || SETS.retro, notes = set.s[name];
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

  return { play: play, STYLES: STYLES };
})();
