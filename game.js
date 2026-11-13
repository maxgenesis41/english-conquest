// 영어정복 3단계: 게임 규칙 엔진 (화면과 분리, 저장도 하지 않음)
// 규칙: 작업지침 7항 / 설계.md 1항
//  - 한 판 10문제, 체력 5, 힌트는 레벨별(v0.40): Lv1~29 3회·Lv30~59 2회·Lv60~89 1회·Lv90~99 0회(복습 판은 기존 3회 유지, 화면에서 힌트 없음)
//  - 정답 100점 + 연속 정답 보너스(2회째부터 +10씩, 최대 +50), 힌트 쓴 문제는 점수(보너스 포함) 절반
//  - 오답 시 체력 -1, 연속 정답 3회마다 체력 +1(최대 5), 체력 0이면 즉시 종료
//  - 등급: 정답 10개 S, 9개 A, 7~8개 B, 6개 이하 C (체력 0 종료도 C)
//  - 듣기 등급별 난이도(v0.59): 등급(Lv 1~9=0, 10~19=1 … 90~99=9)이 오를수록 문장 듣기 개수(=등급 번호)·소리 속도·오답 보기 비슷함(단어는 첫 글자, 문장은 길이)이 올라가고, 다시 듣기 횟수가 줄어든다(listenCfg). 복습 판은 기존 규칙
//  - 듣기 유형(v0.60): a 쉬운 단어 보기(같은 레벨 무작위) / b 비슷한 발음 단어 보기 / c 소리를 듣고 한글 뜻 고르기(오답 뜻 = 비슷한 발음 단어의 뜻, 제한시간 2배). 등급별 비율은 LISTEN_MIX, 발음은 data/sound.js(SOUND)
//  - 듣기 유형 d(v0.61): 영어 질문을 듣고 알맞은 대답(영어 문장) 고르기, 마스터~전설 전용, 제한시간 2배. 문제는 data/dialogs.js(DIALOGS[등급번호]), 단어가 아니므로 틀려도 복습 목록에 넣지 않는다(id가 dg로 시작)
//  - 틀린 단어 복습(v0.30): review=true면 체력·종료 없음, total(문제 수)은 10 이하, ordered면 받은 순서대로 출제
var Game = (function () {
  "use strict";

  var TOTAL = 10, MAX_HP = 5, HINTS = 3;
  var LETTERS = "abcdefghijklmnopqrstuvwxyz";

  // 레벨별 판당 힌트 수(v0.40): 레벨이 오를수록 줄어든다
  function hintsFor(lv) {
    if (typeof lv !== "number" || !(lv >= 30)) return HINTS;   // 잘못된 값(NaN 등)도 기본 3회
    return lv < 60 ? 2 : lv < 90 ? 1 : 0;
  }

  function randInt(n, rng) { return Math.floor(rng() * n); }

  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(i + 1, rng);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 오답 3개 사이 무작위 위치에 정답을 끼워 넣는다
  function place(wrong, correct, rng) {
    var opts = wrong.slice();
    var at = randInt(4, rng);
    opts.splice(at, 0, correct);
    return { options: opts, answer: at };
  }

  function letterQuestion(w, rng) {
    var en = w.en.toLowerCase();
    var blank = randInt(en.length, rng);
    var c = en.charAt(blank);
    var pool = [];
    for (var i = 0; i < LETTERS.length; i++) if (LETTERS.charAt(i) !== c) pool.push(LETTERS.charAt(i));
    var p = place(shuffle(pool, rng).slice(0, 3), c, rng);
    return { id: w.id, en: w.en, ko: w.ko, blank: blank, options: p.options, answer: p.answer };
  }

  function meaningQuestion(w, words, rng) {
    var pool = [];
    for (var i = 0; i < words.length; i++) {
      if (words[i].id !== w.id && words[i].ko !== w.ko) pool.push(words[i].ko);
    }
    var p = place(shuffle(pool, rng).slice(0, 3), w.ko, rng);
    return { id: w.id, en: w.en, ko: w.ko, options: p.options, answer: p.answer };
  }

  // 철자 쓰기: 단어의 글자를 섞어 타일로 낸다(섞은 결과가 정답과 같지 않게)
  function spellQuestion(w, rng) {
    var letters = w.en.toLowerCase().split(""), mixed = letters, t = 0;
    do { mixed = shuffle(letters, rng); t++; } while (mixed.join("") === letters.join("") && t < 30);
    return { id: w.id, en: w.en, ko: w.ko, letters: mixed, answer: w.en.toLowerCase() };
  }

  // 듣기 등급별 설정(v0.59). 등급 번호 b = Lv1~9 → 0, Lv10~19 → 1 … Lv90~99 → 9
  //  sent: 한 판 10문제 중 문장 듣기 개수(=b) / rate: 소리 속도 / replays: 문제당 다시 듣기 횟수(0=무제한) / sim: 오답 보기 비슷함(0 무작위, 1 길이, 2 길이+첫 글자)
  var LISTEN_RATE = [0.85, 0.85, 0.85, 0.9, 0.9, 0.9, 0.95, 0.95, 1.0, 1.0];
  var LISTEN_REPLAYS = [0, 0, 0, 0, 0, 3, 3, 2, 2, 1];
  function bandOf(lv) { return (typeof lv === "number" && lv >= 10) ? Math.min(9, Math.floor(lv / 10)) : 0; }
  // 등급별 유형 비율(v0.61, 10문제 중 [a 쉬운 단어, b 비슷한 발음 단어, c 한글 뜻, d 질문 듣고 대답 고르기]) — 문장 듣기(v0.59)는 중단(sent 0). d는 대화 데이터가 없으면 c(발음 데이터도 없으면 a)로 대신한다
  var LISTEN_MIX = [[10, 0, 0, 0], [10, 0, 0, 0], [7, 3, 0, 0], [4, 6, 0, 0], [2, 8, 0, 0], [0, 10, 0, 0], [0, 5, 2, 3], [0, 3, 3, 4], [0, 0, 5, 5], [0, 0, 4, 6]];
  // 비슷한 발음 보기의 허용 발음 거리(발음 기호 몇 개가 다른가) 우선순서: 견습생·싸움꾼 2~3칸, 전사·정예 1~2칸, 마스터 이상 1칸부터
  var SOUND_NEAR = [[[1], [2], [3]], [[1], [2], [3]], [[2, 3], [1]], [[2, 3], [1]], [[1, 2], [3]], [[1, 2], [3]], [[1], [2], [3]], [[1], [2], [3]], [[1], [2], [3]], [[1], [2], [3]]];
  function listenCfg(lv, review) {
    if (review) return { sent: 0, mix: [10, 0, 0, 0], near: SOUND_NEAR[0], rate: 0.85, replays: 0, sim: 0 };
    var b = bandOf(lv);
    return { sent: 0, mix: LISTEN_MIX[b], near: SOUND_NEAR[b], rate: LISTEN_RATE[b], replays: LISTEN_REPLAYS[b], sim: 0 };
  }

  // 발음 거리: 발음 기호 글자열의 편집 거리(바꾸기·넣기·빼기 각 1칸). cap을 넘으면 cap+1
  function phDist(a, b, cap) {
    var n = a.length, m = b.length, i, j;
    if (Math.abs(n - m) > cap) return cap + 1;
    var prev = [], cur;
    for (j = 0; j <= m; j++) prev.push(j);
    for (i = 1; i <= n; i++) {
      cur = [i]; var best = i;
      for (j = 1; j <= m; j++) {
        var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
        cur.push(v); if (v < best) best = v;
      }
      if (best > cap) return cap + 1;
      prev = cur;
    }
    return prev[m];
  }

  // 같은 뿌리 단어(앞 5글자가 같음: possess·possession 등)는 한글 뜻 보기에서 정답과 헷갈려 억울하므로 뺀다
  function sameRoot(a, b) { a = a.toLowerCase(); b = b.toLowerCase(); return a.length >= 5 && b.length >= 5 && a.substr(0, 5) === b.substr(0, 5); }

  // 비슷한 발음 단어 후보(v0.60): 발음 거리 1~3칸. 같은 소리(거리 0)·같은 철자·같은 뜻은 뺀다. byKo=true면 뜻이 서로 다른 것만(한글 뜻 보기용)
  function soundMates(w, allWords, sound, near, rng, count, byKo, usedKo) {
    var p = sound[w.id], cands = [], i;
    if (!p) return [];
    for (i = 0; i < allWords.length; i++) {
      var x = allWords[i], q = sound[x.id];
      if (!q || x.id === w.id || x.ko === w.ko || x.en.toLowerCase() === w.en.toLowerCase() || (byKo && sameRoot(x.en, w.en))) continue;
      var d = phDist(p, q, 3);
      if (d >= 1 && d <= 3) cands.push({ w: x, d: d, near: x.lv <= w.lv + 10 });
    }
    var out = [], seen = {}, seenKo = {};
    seen[w.en.toLowerCase()] = true; seenKo[w.ko] = true;
    for (i = 0; i < (usedKo || []).length; i++) seenKo[usedKo[i]] = true;
    for (var g = 0; g < near.length && out.length < count; g++) {
      var grp = cands.filter(function (c) { return near[g].indexOf(c.d) >= 0; });
      var a = shuffle(grp.filter(function (c) { return c.near; }), rng).concat(shuffle(grp.filter(function (c) { return !c.near; }), rng));
      for (i = 0; i < a.length && out.length < count; i++) {
        var key = a[i].w.en.toLowerCase();
        if (seen[key] || (byKo && seenKo[a[i].w.ko])) continue;
        seen[key] = true; seenKo[a[i].w.ko] = true; out.push(a[i].w);
      }
    }
    if (out.length < count) {   // 3칸 안의 후보가 모자라는 긴 단어: 발음 길이의 60%까지 넓혀 가장 가까운 것부터 채운다
      var cap = Math.min(8, Math.ceil(p.length * 0.6)), far = [];
      for (i = 0; i < allWords.length; i++) {
        var y = allWords[i], z = sound[y.id];
        if (!z || y.id === w.id || y.ko === w.ko || y.en.toLowerCase() === w.en.toLowerCase() || (byKo && sameRoot(y.en, w.en))) continue;
        var dd = phDist(p, z, cap);
        if (dd > 3 && dd <= cap) far.push({ w: y, d: dd });
      }
      far = shuffle(far, rng).sort(function (u, v) { return u.d - v.d; });
      for (i = 0; i < far.length && out.length < count; i++) {
        var k2 = far[i].w.en.toLowerCase();
        if (seen[k2] || (byKo && seenKo[far[i].w.ko])) continue;
        seen[k2] = true; seenKo[far[i].w.ko] = true; out.push(far[i].w);
      }
    }
    return out;
  }

  // 오답 보기 3개 고르기(v0.59). isSent=false(단어): sim 0 무작위, 1 첫 글자가 같은 단어 1개 포함(있으면), 2 첫 글자가 같은 것 우선(후보 상위 6개 중 무작위 3개).
  //  isSent=true(문장): sim 0 무작위, 1 이상은 길이가 비슷한 것 우선(후보 상위 6개 중 무작위 3개). 단어는 레벨마다 글자 수가 거의 같아 길이 기준이 효과가 없다
  function pickWrongs(correct, pool, sim, rng, isSent) {
    var cand = shuffle(pool, rng);
    if (sim <= 0) return cand.slice(0, 3);
    var c0 = correct.charAt(0).toLowerCase();
    var same = function (t) { return t.charAt(0).toLowerCase() === c0; };
    if (!isSent && sim === 1) {
      var one = cand.filter(same).slice(0, 1);
      var rest = cand.filter(function (t) { return one.indexOf(t) < 0; });
      return shuffle(one.concat(rest.slice(0, 3 - one.length)), rng);
    }
    var sc = function (t) { return isSent ? Math.abs(t.length - correct.length) : Math.abs(t.length - correct.length) - (same(t) ? 3 : 0); };
    cand = cand.map(function (t, i) { return { t: t, k: sc(t), i: i }; }).sort(function (x, y) { return x.k - y.k || x.i - y.i; }).slice(0, 6)
      .map(function (o) { return o.t; });
    return shuffle(cand, rng).slice(0, 3);
  }

  // 듣기(단어): 소리로 낸 단어를 영어 보기 4개에서 고른다(보기는 같은 레벨의 다른 단어)
  function listenQuestion(w, words, rng, cfg) {
    var pool = [];
    for (var i = 0; i < words.length; i++) if (words[i].id !== w.id && words[i].en !== w.en) pool.push(words[i].en);
    var p = place(pickWrongs(w.en, pool, cfg ? cfg.sim : 0, rng, false), w.en, rng);
    return { id: w.id, en: w.en, ko: w.ko, options: p.options, answer: p.answer, kind: "word", rate: cfg ? cfg.rate : 0.85 };
  }

  // 듣기(문장): 문장을 소리로 듣고 영어 문장 보기 4개에서 고른다(보기는 같은 레벨의 다른 문장)
  function listenSentenceQuestion(sn, sents, rng, cfg) {
    var pool = [];
    for (var i = 0; i < sents.length; i++) if (sents[i].id !== sn.id && sents[i].en !== sn.en) pool.push(sents[i].en);
    var p = place(pickWrongs(sn.en, pool, cfg.sim, rng, true), sn.en, rng);
    return { id: sn.id, en: sn.en, ko: sn.ko, options: p.options, answer: p.answer, kind: "sentence", rate: cfg.rate };
  }

  // 듣기(비슷한 발음 단어): 소리로 낸 단어를 영어 보기 4개에서 고른다(오답 3개는 발음이 비슷한 다른 단어, 부족하면 같은 레벨 단어로 채움)
  function soundQuestion(w, pool, allWords, sound, cfg, rng) {
    var m = soundMates(w, allWords, sound, cfg.near, rng, 3, false), wrongs = m.map(function (x) { return x.en; });
    if (wrongs.length < 3) {
      var rest = [];
      for (var i = 0; i < pool.length; i++) if (pool[i].id !== w.id && pool[i].en !== w.en && wrongs.indexOf(pool[i].en) < 0) rest.push(pool[i].en);
      wrongs = wrongs.concat(pickWrongs(w.en, rest, 0, rng, false).slice(0, 3 - wrongs.length));
    }
    var p = place(wrongs, w.en, rng);
    return { id: w.id, en: w.en, ko: w.ko, options: p.options, answer: p.answer, kind: "sound", rate: cfg.rate, mates: m.length };
  }

  // 듣기(한글 뜻): 소리를 듣고 알맞은 한글 뜻을 4개에서 고른다(오답 뜻 3개는 발음이 비슷한 단어의 뜻, 부족하면 같은 레벨 단어의 뜻). 제한시간은 2배(mul)
  function meanListenQuestion(w, pool, allWords, sound, cfg, rng) {
    var m = soundMates(w, allWords, sound, cfg.near, rng, 3, true), wrongs = m.map(function (x) { return x.ko; });
    if (wrongs.length < 3) {
      var rest = [];
      for (var i = 0; i < pool.length; i++) if (pool[i].id !== w.id && pool[i].ko !== w.ko && wrongs.indexOf(pool[i].ko) < 0 && rest.indexOf(pool[i].ko) < 0) rest.push(pool[i].ko);
      wrongs = wrongs.concat(shuffle(rest, rng).slice(0, 3 - wrongs.length));
    }
    var p = place(wrongs, w.ko, rng);
    return { id: w.id, en: w.en, ko: w.ko, options: p.options, answer: p.answer, kind: "mean", rate: cfg.rate, mul: 2, mates: m.length };
  }

  // 듣기(질문 듣고 대답 고르기, v0.61): 영어 질문을 소리로 듣고 알맞은 대답(영어 문장) 4개 중 하나를 고른다. 항목 = [질문, 질문 뜻, 정답, [오답 3개]]. 제한시간 2배(mul)
  function dialogQuestion(item, n, cfg, rng) {
    var p = place(shuffle(item[3], rng), item[2], rng);
    return { id: "dg" + n, en: item[0], ko: item[1], reply: item[2], options: p.options, answer: p.answer, kind: "dialog", rate: cfg.rate, mul: 2 };
  }

  // 문장 배열(v0.65): 첫 단어의 대문자는 힌트가 되므로 I·I'm 류와 고유명사만 남기고 소문자로 바꾼다(정답도 같은 형태, 안내 문구의 원문 en은 그대로)
  var KEEP_CAP = ["I", "Korea", "Seoul", "English", "Tom", "Rome", "God", "Asia", "Arctic", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function lowerFirst(tok) {
    var base = tok.replace(/[?!,.]+$/, "");
    if (base === "I" || base.indexOf("I'") === 0 || KEEP_CAP.indexOf(base) >= 0) return tok;
    return tok.charAt(0).toLowerCase() + tok.slice(1);
  }
  // 공백으로 단어를 나눠 섞는다(섞은 결과가 원문 순서와 같지 않게)
  function sentenceQuestion(s, rng) {
    var tokens = s.en.split(" "), mixed = tokens, t = 0;
    tokens[0] = lowerFirst(tokens[0]);
    do { mixed = shuffle(tokens, rng); t++; } while (mixed.join(" ") === tokens.join(" ") && t < 30);
    return { id: s.id, en: s.en, ko: s.ko, tokens: tokens, pool: mixed, answer: tokens.join(" ") };
  }

  // 새 판 시작. 단어가 10개 미만이면 null(그 레벨은 아직 준비 중)
  function start(o) {
    var rng = o.rng || Math.random;
    var words = o.words || [];
    var total = o.total || TOTAL;
    if (words.length < total) return null;
    var pool = o.pool || words;   // 보기(오답) 후보: 복습은 같은 레벨 전체 단어
    var picked = o.ordered ? words.slice(0, total) : shuffle(words, rng).slice(0, total);
    var qs = [];
    var lcfg = o.mode === "listen" ? listenCfg(o.lv, o.review) : null;
    var sents = (lcfg && lcfg.sent > 0 && o.sentences && o.sentences.length >= 4) ? o.sentences : null;
    var ns = sents ? Math.min(lcfg.sent, total, sents.length) : 0;   // 문장 듣기 개수(문장이 부족하면 줄임)
    var snd = (lcfg && o.sound && o.allWords) ? o.sound : null;   // 발음 데이터가 없으면 비슷한 발음·한글 뜻 유형은 쉬운 단어 유형으로 대신한다
    var dlg = (lcfg && lcfg.mix[3] > 0 && o.dialogs && o.dialogs.length >= 4) ? o.dialogs : null;   // 대화 데이터가 없으면 d는 c로 대신
    var nb = snd ? Math.min(lcfg.mix[1], total - ns) : 0;
    var nd = dlg ? Math.min(lcfg.mix[3], total - ns - nb, dlg.length) : 0;
    var nc = snd ? Math.min(lcfg.mix[2] + (lcfg.mix[3] - nd), total - ns - nb - nd) : 0;
    var kinds = [];
    for (var k = 0; k < total; k++) kinds.push(k < ns ? "s" : k < ns + nb ? "b" : k < ns + nb + nc ? "c" : k < ns + nb + nc + nd ? "d" : "w");
    kinds = shuffle(kinds, rng);
    var dlgPick = nd > 0 ? shuffle(dlg.map(function (x, n) { return { x: x, n: n }; }), rng).slice(0, nd) : [], di = 0;
    var sentPick = ns > 0 ? shuffle(sents, rng).slice(0, ns) : [], si = 0;
    for (var i = 0; i < picked.length; i++) {
      if (lcfg && kinds[i] === "b") { qs.push(soundQuestion(picked[i], pool, o.allWords, snd, lcfg, rng)); continue; }
      if (lcfg && kinds[i] === "d") { qs.push(dialogQuestion(dlgPick[di].x, dlgPick[di].n, lcfg, rng)); di++; continue; }
      if (lcfg && kinds[i] === "c") { qs.push(meanListenQuestion(picked[i], pool, o.allWords, snd, lcfg, rng)); continue; }
      if (lcfg && kinds[i] === "s") { qs.push(listenSentenceQuestion(sentPick[si++], sents, rng, lcfg)); continue; }
      qs.push(o.mode === "letter" ? letterQuestion(picked[i], rng) :
              o.mode === "spell" ? spellQuestion(picked[i], rng) :
              o.mode === "sentence" ? sentenceQuestion(picked[i], rng) :
              o.mode === "listen" ? listenQuestion(picked[i], pool, rng, lcfg) : meaningQuestion(picked[i], pool, rng));
    }
    var hs = o.review ? HINTS : hintsFor(o.lv);   // 복습 판은 기존 값 유지
    return {
      lv: o.lv, mode: o.mode, questions: qs, index: 0, total: total, review: !!o.review,
      hp: MAX_HP, score: 0, combo: 0, bestCombo: 0, correct: 0, answered: 0,
      replaysMax: lcfg ? lcfg.replays : 0, replaysLeft: lcfg ? lcfg.replays : 0, hintsLeft: hs, hintsMax: hs, limit: o.review ? 0 : limitFor(o.lv, o.mode), hintUsed: false, removed: [], picked: null,
      ending: false, over: false, finished: false, correctIds: [], wrongIds: []
    };
  }

  function current(g) { return g.questions[g.index]; }

  // 제한시간(초): 선택형(글자·뜻·듣기) Lv1~9 없음·10~29 20초·30~59 15초·60~89 12초·90~99 10초, 입력형(철자·문장)은 2배. 복습·알 수 없는 레벨은 0(제한 없음)
  function limitFor(lv, mode) {
    if (typeof lv !== "number" || !(lv >= 10)) return 0;
    var s = lv < 30 ? 20 : lv < 60 ? 15 : lv < 90 ? 12 : 10;
    return (mode === "spell" || mode === "sentence") ? s * 2 : s;
  }

  // 시간 초과: 아직 답하지 않았으면 오답으로 채점한다(체력 -1, 틀린 단어 기록). 이미 답했으면 null
  function timeout(g) {
    if (!g || g.finished || g.picked !== null) return null;
    return judge(g, current(g), -1, false);
  }

  // 보기 선택. 이미 답했거나 지워진 보기면 null
  function pick(g, i) {
    if (!g || g.finished || g.picked !== null) return null;
    if (i < 0 || i > 3 || g.removed.indexOf(i) >= 0) return null;
    return judge(g, current(g), i, i === current(g).answer);
  }

  // 채점 공통: 점수·연속·체력·종료 판정
  function judge(g, q, picked, isCorrect) {
    g.picked = picked;
    g.answered++;
    var fb = { correct: isCorrect, gain: 0, healed: false, over: false, last: false };
    if (fb.correct) {
      g.combo++;
      if (g.combo > g.bestCombo) g.bestCombo = g.combo;
      g.correct++;
      g.correctIds.push(q.id);
      var pts = 100 + (g.combo >= 2 ? Math.min(50, (g.combo - 1) * 10) : 0);
      if (g.hintUsed) pts = Math.floor(pts / 2);
      g.score += pts;
      fb.gain = pts;
      if (g.combo % 3 === 0 && g.hp < MAX_HP) { g.hp++; fb.healed = true; }
    } else {
      g.combo = 0;
      g.wrongIds.push(q.id);
      if (!g.review) {   // 복습은 체력이 없다
        g.hp--;
        if (g.hp <= 0) { g.hp = 0; g.over = true; fb.over = true; }
      }
    }
    g.ending = g.over || g.index >= g.total - 1;
    fb.last = g.ending;
    return fb;
  }

  // 순서 모드(철자 쓰기·문장 배열) 제출: 완성한 답을 채점한다. 이미 답했으면 null
  // 철자 쓰기는 대소문자 무관, 문장 배열은 원문과 정확히 같은 순서만 정답
  function isOrder(g) { return g.mode === "spell" || g.mode === "sentence"; }
  function submit(g, text) {
    if (!g || g.finished || g.picked !== null || !isOrder(g)) return null;
    var q = current(g), s = String(text);
    return judge(g, q, s, g.mode === "spell" ? s.toLowerCase() === q.answer : s === q.answer);
  }

  // 순서 모드 힌트: 사용 처리만 한다(채울 글자·단어는 화면이 정답에서 가져옴). 문제당 1번, 판당 횟수는 레벨별(hintsFor)
  function hintSpell(g) {
    if (!g || g.finished || g.picked !== null || !isOrder(g) || g.hintsLeft <= 0 || g.hintUsed) return false;
    g.hintsLeft--; g.hintUsed = true;
    return true;
  }

  // 힌트: 오답 보기 2개를 지운다. 문제당 1번, 판당 횟수는 레벨별(hintsFor). 지워진 보기 번호 배열을 돌려준다
  function hint(g, rng) {
    if (!g || g.finished || g.picked !== null || g.hintsLeft <= 0 || g.hintUsed) return null;
    var q = current(g), wrong = [];
    for (var i = 0; i < 4; i++) if (i !== q.answer) wrong.push(i);
    g.removed = shuffle(wrong, rng || Math.random).slice(0, 2).sort();
    g.hintsLeft--;
    g.hintUsed = true;
    return g.removed;
  }

  // 다시 듣기(v0.59): 문제마다 횟수가 새로 채워진다(replaysMax 0=무제한). 횟수가 남았으면 true(남은 횟수 -1), 없으면 false
  function replay(g) {
    if (!g || g.finished || g.mode !== "listen") return false;
    if (!g.replaysMax) return true;
    if (g.replaysLeft <= 0) return false;
    g.replaysLeft--;
    return true;
  }

  // 다음 문제로. 마지막이거나 체력 0이면 판을 끝내고 false
  function advance(g) {
    if (!g || g.picked === null) return false;
    if (g.ending) { g.finished = true; return false; }
    g.index++;
    g.picked = null;
    g.hintUsed = false;
    g.removed = [];
    g.replaysLeft = g.replaysMax;
    return true;
  }

  function grade(g) {
    if (g.over) return "C";
    if (g.correct >= 10) return "S";
    if (g.correct >= 9) return "A";
    if (g.correct >= 7) return "B";
    return "C";
  }

  function result(g) {
    return { grade: grade(g), score: g.score, correct: g.correct, answered: g.answered, bestCombo: g.bestCombo, over: g.over, hintsUsed: g.hintsMax - g.hintsLeft, correctIds: g.correctIds.slice(), wrongIds: g.wrongIds.slice(), total: g.total, review: g.review };
  }

  return { TOTAL: TOTAL, MAX_HP: MAX_HP, HINTS: HINTS, hintsFor: hintsFor, bandOf: bandOf, listenCfg: listenCfg, phDist: phDist, replay: replay, limitFor: limitFor, timeout: timeout, start: start, current: current, pick: pick, submit: submit, hintSpell: hintSpell, hint: hint, advance: advance, result: result, grade: grade };
})();
