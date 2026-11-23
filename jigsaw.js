// 영어정복 v0.62(v0.93 빈칸 문장 단서, v0.94 보기 같은 글자 수, v0.95 문법 객관식): 영단어 직소(v0.70부터 일반 모드) 퍼즐 만들기. 화면·저장은 app.js·storage.js가 맡고, 여기는 문제 만들기만 한다(저장·화면 접근 없음).
// 규칙(확정): 가로 1개·세로 1개 단어가 한 글자를 공유한다. 첫 글자는 항상 보여 주고, 보기 4개는 모두 그 첫 글자로 시작한다.
//   난이도는 보기 길이로 차등: 낮음(band 0~2)=길이 제한 없음 / 중간(band 3~5)=정답 길이 ±1 / 높음(band 6~9)=정답과 같은 길이. 부족하면 한 단계씩 완화한다.
//   낮음은 가로→세로 2단계, 중간·높음은 가로·세로·겹치는 글자 3단계(높음은 가로·세로 순서가 퍼즐마다 섞인다).
//   v0.93 빈칸 문장 단서: 퍼즐 한 개에서 가로·세로 중 한 단어(최대 1개)의 단서를 "한글 뜻" 대신 "빈칸 영어 문장 + 한글 번역"으로 바꾼다. 나머지 단어는 기존 한글 뜻 단서 그대로(둘 다 빈칸인 퍼즐은 없음).
//   빈칸 문장은 기존 문장(SENTENCES) 중 레벨 FILL_MAX_LV(60, 초등~중등 수준 상한) 이하 문장에서만 뽑고, 레벨 FILL_MIN_LV(5) 미만 판에는 쓰지 않는다. 기존 한글 뜻 단서의 수준·방식은 바꾸지 않는다.
var Jig = (function () {
  "use strict";

  var COUNT = 5;   // 한 번에 푸는 퍼즐 수
  var FILL_MAX_LV = 60, FILL_MIN_LV = 5, FILL_RATE = 0.45;   // v0.93: 빈칸 문장 상한 레벨·최소 판 레벨·퍼즐당 적용 확률
  var GRAM_RATE = 0.4, GRAM_M_MIN_LV = 15, DEF_RATE = 0.25;   // v0.97: 영영 풀이는 새 유형이 걸린 퍼즐 중 약 25%(먼저 뽑고, 나머지에서 문법 40%·빈칸 문장)
    // v0.95: 새 유형이 걸린 퍼즐 중 문법 객관식 비율, 중등 문법을 쓰기 시작하는 판 레벨

  function usable(w) { return !!w && /^[a-z]{4,8}$/.test(w.en); }
  function tierOf(band) { return band <= 2 ? 0 : band <= 5 ? 1 : 2; }
  function shuffle(a, rng) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // 보기 길이 제한: 단계 0=제한 없음, 1=±1, 2=같은 길이. 단계가 높을수록 엄격하다
  function lenOk(level, a, b) {
    var d = Math.abs(a.length - b.length);
    return level >= 2 ? d === 0 : level === 1 ? d <= 1 : true;
  }

  // 단어 w(정답)의 같은 첫 글자 오답 3개. pool 안에서 고른다. 못 채우면 null
  function distractors(w, pool, tier, minLv, banEn, banKo, rng) {
    var cands = [], i, p, seen = {};
    for (i = 0; i < pool.length; i++) {
      p = pool[i];
      if (p.en.charAt(0) !== w.en.charAt(0) || p.en === w.en || banEn[p.en] || banKo[p.ko] || seen[p.en]) continue;
      seen[p.en] = 1; cands.push(p);
    }
    for (var lv = tier; lv >= minLv; lv--) {   // 엄격 -> 완화
      var ok = [];
      for (i = 0; i < cands.length; i++) if (lenOk(lv, w.en, cands[i].en)) ok.push(cands[i]);
      if (ok.length >= 3) { shuffle(ok, rng); return [ok[0].en, ok[1].en, ok[2].en]; }
    }
    return null;
  }

  function wordOpts(w, ds, rng) {   // 보기 4개(정답 위치 무작위)
    var arr = shuffle(ds.concat([w.en]), rng);
    return { options: arr, answer: arr.indexOf(w.en) };
  }

  function letterOpts(a, d, ch, rng) {   // 겹치는 글자 보기 4개(정답 + 두 단어에 나오는 다른 글자 우선)
    var pool = [], seen = {}, i, c, extra = "etaoinsrhl";
    seen[ch] = 1;
    var s = a + d;
    for (i = 0; i < s.length; i++) { c = s.charAt(i); if (!seen[c]) { seen[c] = 1; pool.push(c); } }
    shuffle(pool, rng);
    for (i = 0; i < extra.length && pool.length < 3; i++) { c = extra.charAt(i); if (!seen[c]) { seen[c] = 1; pool.push(c); } }
    var arr = shuffle(pool.slice(0, 3).concat([ch]), rng);
    return { options: arr, answer: arr.indexOf(ch) };
  }


  // v0.93 빈칸 문장: 문장 하나에서 단어 w(원형 그대로, 1번만 나옴)를 빈칸으로 바꾼 문제. 못 만들면 null
  function blankOf(sent, w) {
    var toks = sent.en.split(" "), hit = -1, i, n = 0;
    for (i = 0; i < toks.length; i++) {
      var core = toks[i].replace(/[^A-Za-z']/g, "").toLowerCase();
      if (core === w) { hit = i; n++; }
    }
    if (n !== 1) return null;
    toks[hit] = toks[hit].replace(/[A-Za-z']+/, "____");
    return { en: toks.join(" "), ko: sent.ko };
  }
  // 문장 목록에서 빈칸으로 쓸 수 있는 단어 -> [문장] 표. 레벨 FILL_MAX_LV 이하 문장만, 4~8글자 단어만
  function fillIndex(sents, byEn) {
    var idx = {}, i, j;
    for (i = 0; i < sents.length; i++) {
      var st = sents[i];
      if (!st || st.lv > FILL_MAX_LV || !st.en || !st.ko) continue;
      var toks = st.en.split(" ");
      for (j = 0; j < toks.length; j++) {
        var core = toks[j].replace(/[^A-Za-z']/g, "").toLowerCase();
        if (!byEn[core] || !usable(byEn[core])) continue;
        if (!blankOf(st, core)) continue;   // 같은 단어가 두 번 나오는 문장 제외
        (idx[core] = idx[core] || []).push(st);
      }
    }
    return idx;
  }

  // 퍼즐 만들기. o = {lv, band, words(전체 단어), sents(문장, 선택), gram(문법 문제 JIGGRAM, 선택), def(영영 풀이 JIGDEF, 선택), rng}. 반환: {tier, puzzles:[{a:{en,ko}, d:{en,ko}, ai, di, ch, steps:["a","d"(,"x")], o:{a,d,x}}], total} 또는 null(5개를 못 만듦)
  function build(o) {
    var rng = o.rng || Math.random, tier = tierOf(o.band), all = [], own = [], near = [], far = [], i;
    for (i = 0; i < o.words.length; i++) {
      var w = o.words[i];
      if (!usable(w)) continue;
      all.push(w);
      if (w.lv === o.lv) own.push(w); else if (Math.abs(w.lv - o.lv) <= 2) near.push(w); else if (Math.abs(w.lv - o.lv) <= 6) far.push(w);
    }
    var pool = own.concat(near);
    var pool2 = pool.concat(far);   // 인접 레벨까지도 모자란 레벨(단어가 매우 긴 레벨)만 ±6레벨 단어를 쓴다   // 오답·보충 후보: 같은 레벨 먼저, 인접(±2) 레벨 다음
    function attempt(src, pl, minLv, strict) {   // v0.94 strict=true: 모든 단어 보기를 정답과 같은 글자 수로(격자 칸 수가 보이므로)
      var out = [], used = {}, usedKo = {}, A = shuffle(src.slice(), rng), x, y;
      for (x = 0; x < A.length && out.length < COUNT; x++) {
        var a = A[x];
        if (used[a.en]) continue;
        var ys = shuffle(src.slice(), rng);
        for (y = 0; y < ys.length; y++) {
          var d = ys[y];
          if (d.en === a.en || used[d.en] || d.ko === a.ko || usedKo[a.ko] || usedKo[d.ko]) continue;
          var cs = [], p, q;   // 겹치는 위치 후보(첫 글자 칸은 제외)
          for (p = 1; p < a.en.length; p++) for (q = 1; q < d.en.length; q++) if (a.en.charAt(p) === d.en.charAt(q)) cs.push([p, q]);
          if (!cs.length) continue;
          var pick = cs[Math.floor(rng() * cs.length)];
          var banEn = {}, banKo = {}; banEn[a.en] = banEn[d.en] = 1; banKo[a.ko] = banKo[d.ko] = 1;
          var tl = strict ? 2 : tier, ml = strict ? 2 : minLv;
          var da = distractors(a, pl, tl, ml, banEn, banKo, rng), dd = da && distractors(d, pl, tl, ml, banEn, banKo, rng);
          if (!dd) continue;
          var steps = tier === 0 ? ["a", "d"] : tier === 1 ? ["a", "d", "x"] : (rng() < 0.5 ? ["a", "d", "x"] : ["d", "a", "x"]);
          var ch = a.en.charAt(pick[0]);
          var os = { a: wordOpts(a, da, rng), d: wordOpts(d, dd, rng) };
          if (tier > 0) os.x = letterOpts(a.en, d.en, ch, rng);
          out.push({ a: { en: a.en, ko: a.ko }, d: { en: d.en, ko: d.ko }, ai: pick[0], di: pick[1], ch: ch, steps: steps, o: os });
          used[a.en] = used[d.en] = 1; usedKo[a.ko] = usedKo[d.ko] = 1;
          break;
        }
      }
      return out;
    }
    // 1차: 정답 후보 = 같은 레벨, 보기 길이 규칙 엄격 적용(보기는 ±6레벨 단어까지). 모자라면 정답 후보를 인접 레벨로 넓히고, 그래도 모자라면 길이 규칙을 완화한다
    var ps = attempt(own, pool2, tier, true);   // v0.94: 먼저 같은 글자 수 보기만으로 만들어 보고, 모자랄 때만 아래 옛 단계 규칙으로 완화한다
    if (ps.length < COUNT) ps = attempt(own.concat(near), pool2, tier, true);
    if (ps.length < COUNT) ps = attempt(own.concat(near, far), pool2, tier, true);
    if (ps.length < COUNT) ps = attempt(own, pool2, tier);
    if (ps.length < COUNT) ps = attempt(own.concat(near), pool2, tier);
    if (ps.length < COUNT) ps = attempt(own, pool2, 0);
    if (ps.length < COUNT) ps = attempt(own.concat(near), pool2, 0);
    if (ps.length < COUNT) ps = attempt(own.concat(near, far), pool2, 0);
    if (ps.length < COUNT) return null;
    if ((o.sents || o.gram || o.def) && o.lv >= FILL_MIN_LV) fillify(ps, o, all, tier, rng);   // v0.93: 일부 퍼즐의 한 단어를 빈칸 문장 단서로 바꾼다
    var total = 0;
    for (i = 0; i < ps.length; i++) total += ps[i].steps.length;
    return { tier: tier, puzzles: ps, total: total };
  }

  // v0.93 빈칸 문장 / v0.95 문법 객관식: 퍼즐 일부의 가로·세로 중 한 단어를 "새 유형 단서" 단어로 교체한다(최대 1개, 나머지는 기존 한글 뜻 단서).
  //   빈칸 문장: 문장 표(SENTENCES Lv60 이하)의 쉬운 단어, 이 판 레벨 근처 우선. 문법: JIGGRAM(직접 작성, 초등 e·중등 m)의 정답·보기를 그대로 쓴다(보기는 정답과 같은 첫 글자·글자 수).
  function fillify(ps, o, all, tier, rng) {
    var byEn = {}, i, k;
    for (i = 0; i < all.length; i++) if (!byEn[all[i].en]) byEn[all[i].en] = all[i];
    var idx = o.sents ? fillIndex(o.sents, byEn) : {}, keys = [], gl = [], dl = [];
    for (k in idx) keys.push(k);
    if (o.gram) for (i = 0; i < o.gram.length; i++) { var gi = o.gram[i]; if (gi && usable({ en: gi.ans }) && gi.opts && gi.opts.length === 3 && gi.en && gi.en.split("____").length === 2) gl.push(gi); }
    if (o.def) for (i = 0; i < o.def.length; i++) { var di = o.def[i]; if (di && usable({ en: di.ans }) && di.opts && di.opts.length === 3 && di.d && di.ko) dl.push(di); }
    if (!keys.length && !gl.length && !dl.length) return;
    var easy = [];   // 빈칸 문장 보기(오답) 후보: 쉬운 단어(레벨 FILL_MAX_LV 이하)
    for (i = 0; i < all.length; i++) if (all[i].lv <= FILL_MAX_LV) easy.push(all[i]);
    var target = Math.min(o.lv, FILL_MAX_LV), used = {}, usedKo = {};
    for (i = 0; i < ps.length; i++) { used[ps[i].a.en] = used[ps[i].d.en] = 1; usedKo[ps[i].a.ko] = usedKo[ps[i].d.ko] = 1; }
    function shares(w, keepEn) {
      for (var x = 1; x < w.length; x++) for (var y = 1; y < keepEn.length; y++) if (w.charAt(x) === keepEn.charAt(y)) return true;
      return false;
    }
    // 새 단서 단어 f2(en·ko)를 넣어 퍼즐을 다시 만든다. dd = f2의 오답 3개, bl = {en, ko}(빈칸 문장)
    function place(pi, keepKey, fillKey, f2, dd, bl) {
      var p = ps[pi], keep = p[keepKey], a = fillKey === "a" ? f2 : keep, d = fillKey === "d" ? f2 : keep, cs = [], pp, qq;
      for (pp = 1; pp < a.en.length; pp++) for (qq = 1; qq < d.en.length; qq++) if (a.en.charAt(pp) === d.en.charAt(qq)) cs.push([pp, qq]);
      var pick = cs[Math.floor(rng() * cs.length)], ch = a.en.charAt(pick[0]);
      var os = { a: p.o.a, d: p.o.d };
      os[fillKey] = wordOpts(f2, dd, rng);
      if (tier > 0) os.x = letterOpts(a.en, d.en, ch, rng);
      ps[pi] = { a: { en: a.en, ko: a.ko }, d: { en: d.en, ko: d.ko }, ai: pick[0], di: pick[1], ch: ch, steps: p.steps, o: os, fill: { k: fillKey, en: bl.en, ko: bl.ko, g: !!bl.g, df: !!bl.df } };
      used[f2.en] = 1; usedKo[f2.ko] = 1;
    }
    for (var pi = 0; pi < ps.length; pi++) {
      if (rng() >= FILL_RATE) continue;
      var p = ps[pi], keepKey = rng() < 0.5 ? "a" : "d", fillKey = keepKey === "a" ? "d" : "a", keep = p[keepKey], keepOpts = p.o[keepKey].options, q, done = false;
      // 0) 영영 풀이(확률 DEF_RATE): 영어 풀이를 보고 단어 고르기. 수준 규칙은 문법과 같다(초등 e 항상, 중등 m은 Lv15 이상, Lv40 이상은 m 우선)
      if (dl.length && rng() < DEF_RATE) {
        var de = [], dm = [];
        for (i = 0; i < dl.length; i++) {
          var dq = dl[i], dbad = used[dq.ans] || usedKo[dq.ko] || dq.ans === keep.en || dq.ko === keep.ko || !shares(dq.ans, keep.en);
          for (q = 0; q < dq.opts.length && !dbad; q++) if (dq.opts[q] === keep.en) dbad = true;
          for (q = 0; q < keepOpts.length && !dbad; q++) if (keepOpts[q] === dq.ans) dbad = true;
          if (dbad) continue;
          if (dq.lv === "m") { if (target >= GRAM_M_MIN_LV) dm.push(dq); } else de.push(dq);
        }
        var dc = dm.length && (target >= 40 ? rng() < 0.7 : false) ? dm : de.concat(dm);
        if (dc.length) {
          var dp = dc[Math.floor(rng() * dc.length)];
          place(pi, keepKey, fillKey, { en: dp.ans, ko: dp.ko, lv: dp.lv === "m" ? 45 : 15 }, dp.opts.slice(), { en: dp.d, ko: dp.ko, df: true });
          continue;
        }
      }
      // 1) 문법 객관식(확률 GRAM_RATE): 이 판 레벨에 맞는 수준(초등 e는 항상, 중등 m은 Lv15 이상, Lv40 이상은 m 우선)
      if (gl.length && rng() < GRAM_RATE) {
        var ge = [], gm = [];
        for (i = 0; i < gl.length; i++) {
          var g = gl[i], bad = used[g.ans] || usedKo[g.ko] || g.ans === keep.en || g.ko === keep.ko || !shares(g.ans, keep.en);
          for (q = 0; q < g.opts.length && !bad; q++) if (g.opts[q] === keep.en) bad = true;
          for (q = 0; q < keepOpts.length && !bad; q++) if (keepOpts[q] === g.ans) bad = true;
          if (bad) continue;
          if (g.lv === "m") { if (target >= GRAM_M_MIN_LV) gm.push(g); } else ge.push(g);
        }
        var gc = gm.length && (target >= 40 ? rng() < 0.7 : false) ? gm : ge.concat(gm);
        if (gc.length) {
          var gp = gc[Math.floor(rng() * gc.length)];
          place(pi, keepKey, fillKey, { en: gp.ans, ko: gp.ko, lv: gp.lv === "m" ? 45 : 15 }, gp.opts.slice(), { en: gp.en, ko: gp.ko, g: true });
          done = true;
        }
      }
      if (done) continue;
      // 2) 빈칸 문장
      var near = [], any = [];
      for (i = 0; i < keys.length; i++) {
        var f = byEn[keys[i]];
        if (used[f.en] || usedKo[f.ko] || f.en === keep.en || f.ko === keep.ko || !shares(f.en, keep.en)) continue;
        (Math.abs(f.lv - target) <= 8 ? near : any).push(f);
      }
      var cands = near.length ? near : any;
      if (!cands.length) continue;
      shuffle(cands, rng);
      for (i = 0; i < cands.length; i++) {
        var f2 = cands[i], banEn = {}, banKo = {};
        banEn[f2.en] = banEn[keep.en] = 1; banKo[f2.ko] = banKo[keep.ko] = 1;
        var dd = distractors(f2, easy, 2, 2, banEn, banKo, rng);   // 빈칸 문장 단서는 격자 칸 수가 보이므로 보기도 정답과 같은 글자 수만 쓴다(못 채우면 이 단어는 건너뜀)
        if (!dd) continue;
        var clash = false;
        for (q = 0; q < keepOpts.length; q++) if (keepOpts[q] === f2.en) clash = true;
        if (clash) continue;
        var sents = idx[f2.en], st = sents[Math.floor(rng() * sents.length)], bl = blankOf(st, f2.en);
        place(pi, keepKey, fillKey, f2, dd, bl);
        break;
      }
    }
  }

  // 등급: 정답률 90% 이상 S, 75% 이상 A, 50% 이상 B, 그 밖에 C (게임 등급과 같은 글자)
  function grade(correct, total) {
    var r = total ? correct / total : 0;
    return r >= 0.9 ? "S" : r >= 0.75 ? "A" : r >= 0.5 ? "B" : "C";
  }

  return { COUNT: COUNT, build: build, grade: grade, tierOf: tierOf, FILL_MAX_LV: FILL_MAX_LV, FILL_MIN_LV: FILL_MIN_LV };
})();
if (typeof module !== "undefined") module.exports = Jig;
