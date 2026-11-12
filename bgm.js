// 영어정복 v0.47: 배경음악(BGM). 파일 없이 브라우저(Web Audio)로 직접 합성한다(음원 파일·저작권 문제 없음).
// 강도 0~4: 템포·음량·소리 층이 올라간다. 듣기 보호(setListen)·음성 재생 중 줄임(setDuck)·전체 음량 배율(setVolume: 앱은 설정값 0~100% × 1.6배)을 제공한다.
var BGM = (function () {
  "use strict";
  // bpm: 분당 박 수, vol: 마스터 음량(효과음보다 작게). 강도 0 평상 / 1 콤보3~4 / 2 콤보5~9·타이머 주황 / 3 콤보10+ / 4 타이머 빨강
  var LEVELS = [
    { bpm: 80, vol: 0.05 }, { bpm: 96, vol: 0.065 }, { bpm: 112, vol: 0.08 }, { bpm: 124, vol: 0.095 }, { bpm: 136, vol: 0.11 }
  ];
  var LISTEN_MAX_LEVEL = 2, LISTEN_VOL = 0.5, DUCK_VOL = 0.15;   // 듣기 보호: 강도 상한·음량 배율, 음성 재생 중 배율
  // 4마디 반복: Am - F - C - G (b: 베이스, t: 화음 구성음)
  var CH = [
    { b: 110.00, t: [220.00, 261.63, 329.63] },
    { b: 87.31, t: [174.61, 220.00, 261.63] },
    { b: 130.81, t: [261.63, 329.63, 392.00] },
    { b: 98.00, t: [196.00, 246.94, 293.66] }
  ];
  var ARP = [0, 1, 2, 1];
  var ctx = null, master = null, failed = false, timer = null, stopTimer = null;
  var st = { level: 0, bpm: LEVELS[0].bpm, step: 0, nextT: 0, listen: false, duck: false, volume: 1, running: false, gain: 0 };

  function ac() {
    if (failed) return null;
    try {
      if (!ctx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) { failed = true; return null; }
        ctx = new C();
        master = ctx.createGain(); master.gain.value = 0.0001; master.connect(ctx.destination);
      }
      if (ctx.state === "suspended" && ctx.resume) ctx.resume();
      return ctx;
    } catch (e) { failed = true; return null; }
  }

  // 음 하나: 주파수 f, 시작 t, 길이 d, 파형, 최대 크기, 끝 주파수(선택), 서서히 커지는 시간(att)
  function note(c, dest, f, t, d, type, peak, f2, att, sus) {
    var o = c.createOscillator(), g = c.createGain(), a = att || 0.01, rel = sus ? Math.min(0.12, d * 0.5) : d > 0.6 ? 0.35 : 0;   // sus: 짧은 음도 끝까지 유지하다 끊음
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    if (rel) g.gain.setValueAtTime(Math.max(0.0002, peak), t + d - rel);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + d + 0.03);
  }
  function noiseFor(c) {
    if (c.__bgmNoise) return c.__bgmNoise;
    var len = Math.floor(c.sampleRate * 0.08), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    c.__bgmNoise = b; return b;
  }
  function hat(c, dest, t, peak) {
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseFor(c); f.type = "highpass"; f.frequency.value = 6500;
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + 0.06);
  }
  function kick(c, dest, t, peak) { note(c, dest, 140, t, 0.13, "sine", peak, 48); }

  // 16분음표 하나를 예약한다. idx: 전체 번호, level: 강도, sd: 16분음표 길이(초)
  function scheduleStep(c, dest, t, idx, level, sd) {
    var s = idx % 16, ch = CH[(idx >> 4) % 4], i;
    if (s === 0) for (i = 0; i < 3; i++) note(c, dest, ch.t[i], t, sd * 15.5, "sine", 0.05, 0, 0.3);   // 잔잔한 화음(패드)
    if (level < 3) { if (s === 0 || s === 8) note(c, dest, ch.b, t, sd * 6, "sine", 0.4); }        // 베이스
    else if (s % 2 === 0) note(c, dest, s % 4 === 2 ? ch.b * 2 : ch.b, t, sd * 2, "sine", 0.4, 0, 0.01, true);
    if (level === 0 && (s === 0 || s === 6 || s === 10)) note(c, dest, ch.t[s === 6 ? 1 : s === 10 ? 2 : 0] * 2, t, sd * 5, "sine", 0.12);   // 평상시 부드러운 종소리
    if (level >= 1 && (level >= 4 || s % 2 === 0)) note(c, dest, ch.t[ARP[(level >= 4 ? s : s >> 1) % 4]] * 2, t, sd * 1.6, "triangle", 0.16);   // 아르페지오
    if (level >= 2 && s % 4 === 2) hat(c, dest, t, 0.06);
    if (level >= 4 && s % 2 === 1) hat(c, dest, t, 0.04);
    if (level >= 3 && s % 4 === 0) kick(c, dest, t, 0.45);
  }

  function effLevel() { return st.listen ? Math.min(st.level, LISTEN_MAX_LEVEL) : st.level; }
  function targetGain() { return LEVELS[effLevel()].vol * st.volume * (st.listen ? LISTEN_VOL : 1) * (st.duck ? DUCK_VOL : 1); }
  function applyGain(tc) {
    if (!ctx || !master) return;
    st.gain = targetGain();
    try { master.gain.setTargetAtTime(Math.max(0.0001, st.gain), ctx.currentTime, tc || 0.4); } catch (e) {}
  }

  function tick() {
    var c = ctx; if (!c || !st.running) return;
    try {
      var now = c.currentTime, lv = effLevel();
      st.bpm += (LEVELS[lv].bpm - st.bpm) * 0.06;   // 50ms마다 조금씩 접근 → 약 1초 안팎으로 부드럽게 빨라지거나 느려진다
      if (st.nextT < now - 0.3) st.nextT = now + 0.05;   // 탭이 멈췄다 돌아오면 밀린 음을 몰아 재생하지 않는다
      while (st.nextT < now + 0.25) {
        var sd = 60 / st.bpm / 4;
        scheduleStep(c, master, st.nextT, st.step, lv, sd);
        st.nextT += sd; st.step++;
      }
    } catch (e) {   // 기기가 지원하지 않는 소리 기능이면 음악만 조용히 포기한다(게임은 계속)
      failed = true; st.running = false;
      if (timer) { clearInterval(timer); timer = null; }
    }
  }

  function start() {
    var c = ac(); if (!c) return false;
    if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
    if (st.running) { applyGain(0.3); return true; }
    st.running = true; st.step = 0; st.bpm = LEVELS[effLevel()].bpm; st.nextT = c.currentTime + 0.1;
    applyGain(0.3); tick();
    timer = setInterval(tick, 50);
    return true;
  }
  function stop(fade) {
    if (!st.running) return;
    st.running = false;
    if (ctx && master) { try { master.gain.setTargetAtTime(0.0001, ctx.currentTime, (fade || 0.4) / 3); } catch (e) {} }
    if (timer) { clearInterval(timer); timer = null; }
  }
  function setLevel(n) { n = Math.max(0, Math.min(4, Math.round(n))); if (n === st.level) return; st.level = n; applyGain(0.4); }
  function setListen(b) { st.listen = !!b; applyGain(0.3); }
  function setDuck(b) { b = !!b; if (b === st.duck) return; st.duck = b; applyGain(b ? 0.08 : 0.4); }   // 음성이 시작되면 빠르게 줄이고, 끝나면 천천히 복귀
  function setVolume(v) { st.volume = Math.max(0, Math.min(2, +v || 0)); applyGain(0.2); }
  function state() { return { running: st.running, level: st.level, eff: effLevel(), bpm: Math.round(st.bpm), step: st.step, gain: st.gain, listen: st.listen, duck: st.duck, volume: st.volume }; }

  // 검증용: 오프라인 오디오 컨텍스트에 강도 level의 음악을 seconds초만큼 미리 그린다
  function renderOffline(oc, level, seconds, listen) {
    var lv = listen ? Math.min(level, LISTEN_MAX_LEVEL) : level, m = oc.createGain();
    m.gain.value = LEVELS[lv].vol * (listen ? LISTEN_VOL : 1); m.connect(oc.destination);
    var sd = 60 / LEVELS[lv].bpm / 4, n = Math.floor(seconds / sd);
    for (var i = 0; i < n; i++) scheduleStep(oc, m, 0.05 + i * sd, i, lv, sd);
  }

  return { start: start, stop: stop, setLevel: setLevel, setListen: setListen, setDuck: setDuck, setVolume: setVolume, state: state, renderOffline: renderOffline, LEVELS: LEVELS };
})();
