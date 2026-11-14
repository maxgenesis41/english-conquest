// 영어정복 v0.62: 영단어 직소(v0.70부터 일반 모드) 퍼즐 만들기. 화면·저장은 app.js·storage.js가 맡고, 여기는 문제 만들기만 한다(저장·화면 접근 없음).
// 규칙(확정): 가로 1개·세로 1개 단어가 한 글자를 공유한다. 첫 글자는 항상 보여 주고, 보기 4개는 모두 그 첫 글자로 시작한다.
//   난이도는 보기 길이로 차등: 낮음(band 0~2)=길이 제한 없음 / 중간(band 3~5)=정답 길이 ±1 / 높음(band 6~9)=정답과 같은 길이. 부족하면 한 단계씩 완화한다.
//   낮음은 가로→세로 2단계, 중간·높음은 가로·세로·겹치는 글자 3단계(높음은 가로·세로 순서가 퍼즐마다 섞인다).
var Jig = (function () {
  "use strict";

  var COUNT = 5;   // 한 번에 푸는 퍼즐 수

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

  // 퍼즐 만들기. o = {lv, band, words(전체 단어), rng}. 반환: {tier, puzzles:[{a:{en,ko}, d:{en,ko}, ai, di, ch, steps:["a","d"(,"x")], o:{a,d,x}}], total} 또는 null(5개를 못 만듦)
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
    function attempt(src, pl, minLv) {
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
          var da = distractors(a, pl, tier, minLv, banEn, banKo, rng), dd = da && distractors(d, pl, tier, minLv, banEn, banKo, rng);
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
    var ps = attempt(own, pool2, tier);
    if (ps.length < COUNT) ps = attempt(own.concat(near), pool2, tier);
    if (ps.length < COUNT) ps = attempt(own, pool2, 0);
    if (ps.length < COUNT) ps = attempt(own.concat(near), pool2, 0);
    if (ps.length < COUNT) ps = attempt(own.concat(near, far), pool2, 0);
    if (ps.length < COUNT) return null;
    var total = 0;
    for (i = 0; i < ps.length; i++) total += ps[i].steps.length;
    return { tier: tier, puzzles: ps, total: total };
  }

  // 등급: 정답률 90% 이상 S, 75% 이상 A, 50% 이상 B, 그 밖에 C (게임 등급과 같은 글자)
  function grade(correct, total) {
    var r = total ? correct / total : 0;
    return r >= 0.9 ? "S" : r >= 0.75 ? "A" : r >= 0.5 ? "B" : "C";
  }

  return { COUNT: COUNT, build: build, grade: grade, tierOf: tierOf };
})();
if (typeof module !== "undefined") module.exports = Jig;
