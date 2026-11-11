// 영어정복 3단계: 게임 규칙 엔진 (화면과 분리, 저장도 하지 않음)
// 규칙: 작업지침 7항 / 설계.md 1항
//  - 한 판 10문제, 체력 5, 힌트 3회
//  - 정답 100점 + 연속 정답 보너스(2회째부터 +10씩, 최대 +50), 힌트 쓴 문제는 점수(보너스 포함) 절반
//  - 오답 시 체력 -1, 연속 정답 3회마다 체력 +1(최대 5), 체력 0이면 즉시 종료
//  - 등급: 정답 10개 S, 9개 A, 7~8개 B, 6개 이하 C (체력 0 종료도 C)
//  - 틀린 단어 복습(v0.30): review=true면 체력·종료 없음, total(문제 수)은 10 이하, ordered면 받은 순서대로 출제
var Game = (function () {
  "use strict";

  var TOTAL = 10, MAX_HP = 5, HINTS = 3;
  var LETTERS = "abcdefghijklmnopqrstuvwxyz";

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

  // 듣기: 소리로 낸 단어를 영어 보기 4개에서 고른다(보기는 같은 단계의 다른 단어)
  function listenQuestion(w, words, rng) {
    var pool = [];
    for (var i = 0; i < words.length; i++) if (words[i].id !== w.id && words[i].en !== w.en) pool.push(words[i].en);
    var p = place(shuffle(pool, rng).slice(0, 3), w.en, rng);
    return { id: w.id, en: w.en, ko: w.ko, options: p.options, answer: p.answer };
  }

  // 문장 배열: 공백으로 단어를 나눠 섞는다(섞은 결과가 원문 순서와 같지 않게)
  function sentenceQuestion(s, rng) {
    var tokens = s.en.split(" "), mixed = tokens, t = 0;
    do { mixed = shuffle(tokens, rng); t++; } while (mixed.join(" ") === tokens.join(" ") && t < 30);
    return { id: s.id, en: s.en, ko: s.ko, tokens: tokens, pool: mixed, answer: s.en };
  }

  // 새 판 시작. 단어가 10개 미만이면 null(그 단계는 아직 준비 중)
  function start(o) {
    var rng = o.rng || Math.random;
    var words = o.words || [];
    var total = o.total || TOTAL;
    if (words.length < total) return null;
    var pool = o.pool || words;   // 보기(오답) 후보: 복습은 같은 단계 전체 단어
    var picked = o.ordered ? words.slice(0, total) : shuffle(words, rng).slice(0, total);
    var qs = [];
    for (var i = 0; i < picked.length; i++) {
      qs.push(o.mode === "letter" ? letterQuestion(picked[i], rng) :
              o.mode === "spell" ? spellQuestion(picked[i], rng) :
              o.mode === "sentence" ? sentenceQuestion(picked[i], rng) :
              o.mode === "listen" ? listenQuestion(picked[i], pool, rng) : meaningQuestion(picked[i], pool, rng));
    }
    return {
      stage: o.stage, mode: o.mode, questions: qs, index: 0, total: total, review: !!o.review,
      hp: MAX_HP, score: 0, combo: 0, bestCombo: 0, correct: 0, answered: 0,
      hintsLeft: HINTS, hintUsed: false, removed: [], picked: null,
      ending: false, over: false, finished: false, correctIds: [], wrongIds: []
    };
  }

  function current(g) { return g.questions[g.index]; }

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

  // 순서 모드 힌트: 사용 처리만 한다(채울 글자·단어는 화면이 정답에서 가져옴). 문제당 1번, 판당 3번
  function hintSpell(g) {
    if (!g || g.finished || g.picked !== null || !isOrder(g) || g.hintsLeft <= 0 || g.hintUsed) return false;
    g.hintsLeft--; g.hintUsed = true;
    return true;
  }

  // 힌트: 오답 보기 2개를 지운다. 문제당 1번, 판당 3번. 지워진 보기 번호 배열을 돌려준다
  function hint(g, rng) {
    if (!g || g.finished || g.picked !== null || g.hintsLeft <= 0 || g.hintUsed) return null;
    var q = current(g), wrong = [];
    for (var i = 0; i < 4; i++) if (i !== q.answer) wrong.push(i);
    g.removed = shuffle(wrong, rng || Math.random).slice(0, 2).sort();
    g.hintsLeft--;
    g.hintUsed = true;
    return g.removed;
  }

  // 다음 문제로. 마지막이거나 체력 0이면 판을 끝내고 false
  function advance(g) {
    if (!g || g.picked === null) return false;
    if (g.ending) { g.finished = true; return false; }
    g.index++;
    g.picked = null;
    g.hintUsed = false;
    g.removed = [];
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
    return { grade: grade(g), score: g.score, correct: g.correct, answered: g.answered, bestCombo: g.bestCombo, over: g.over, hintsUsed: HINTS - g.hintsLeft, correctIds: g.correctIds.slice(), wrongIds: g.wrongIds.slice(), total: g.total, review: g.review };
  }

  return { TOTAL: TOTAL, MAX_HP: MAX_HP, HINTS: HINTS, start: start, current: current, pick: pick, submit: submit, hintSpell: hintSpell, hint: hint, advance: advance, result: result, grade: grade };
})();
