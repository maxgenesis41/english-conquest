// 영어정복 2단계: 브라우저 로컬 저장 (설계.md 4-2)
// 저장 4종: ej_progress(레벨별 최고 등급·모드별 최고 점수), ej_wordbook(맞힌 단어, v0.29부터 사용 중단), ej_review(틀린 단어), ej_settings(설정)
// v0.36: 단계 4개 -> 레벨(Lv) 1~99. progress·review는 형식 2로 올렸고, 형식이 다른 옛 기록은 읽을 때 기본값으로 시작한다(덮어쓰기는 다음 변경 때만).
// v0.37: 다음 레벨 열림 조건 = 그 레벨의 모든 모드(필수 모드)에서 A 이상 + 틀린 단어 0개. 모드별 최고 등급은 lvs[레벨].g({모드:등급})에 저장한다(형식 번호 그대로, 없으면 빈 값).
// v0.39: 레벨업 = 경험치 칸 방식. 레벨 L의 필요 라운드 R(L)=올림(√L), 바는 (필수 모드 수)×R칸. 모드 1판을 A 이상으로 클리어하면 그 모드 칸이 1 늘고(모드당 최대 R칸), 모든 모드가 R칸이면 다음 레벨이 열린다(+틀린 단어 0개).
//        모드별 칸 수는 lvs[레벨].c({모드:횟수})에 저장한다(형식 번호 그대로, 없으면 빈 값). c가 없는 모드는 g가 A 이상이면 1칸으로 본다(옛 기록 인정).
// 원칙: 값이 바뀔 때만 저장한다(열기만 해서 저장하지 않음). 저장이 막혀도 화면은 깨지지 않는다.
var EJ = (function () {
  "use strict";

  var FORMATS = { progress: 2, review: 2, wordbook: 1, settings: 1 }; // 저장 형식 번호(v). 형식이 바뀌면 해당 값을 올린다(옛 형식 기록은 기본값으로 시작)
  var KEYS = { progress: "ej_progress", wordbook: "ej_wordbook", review: "ej_review", settings: "ej_settings" };
  var GRADES = ["C", "B", "A", "S"]; // 낮은 등급 -> 높은 등급
  var MODES = ["letter", "meaning", "spell", "sentence", "listen"]; // 모드 id(화면 순서)
  var NEED = "A";        // 다음 레벨을 열려면 각 모드에서 필요한 최저 등급
  var LV_COUNT = 99;     // 레벨 수(전체 Lv 1개 체계)
  var STYLES = ["retro", "bright", "chime"]; // 효과음 스타일: 레트로 8비트 / 밝은 게임풍 / 부드러운 차임
  var NEXTS = ["order", "same"];
  var BETA_IDS = ["c", "b", "t", "f", "w", "e", "m", "g", "p", "l"];   // BETA-TEST 임시: app.js 등급 id와 같다

  var memory = {};   // 저장이 막혔을 때만 쓰는 임시 보관(새로고침하면 사라짐)
  var blocked = false;
  var writes = 0;    // 이 페이지를 연 뒤 실제로 저장한 횟수
  var statuses = {}; // 마지막 읽기 결과: empty(없음) / ok / corrupt(손상)

  function defaults(name) {
    if (name === "progress") {
      var lvs = {};
      for (var i = 1; i <= LV_COUNT; i++) {
        lvs[String(i)] = { best: "", unlocked: i === 1 };
      }
      return { v: FORMATS.progress, lvs: lvs, modes: {} };
    }
    if (name === "wordbook" || name === "review") return { v: FORMATS[name], items: [] };
    return { v: FORMATS.settings, sound: true, mute: false, sfx: true, style: "retro", word: true, result: true, timer: true, next: "order", bgm: true, bgmVol: 100, betaBand: "" };   // betaBand: BETA-TEST 임시(개발 완료 후 삭제) 시험할 등급 id, ""=끔
  }

  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }

  function valid(name, o) {
    if (!isObj(o) || o.v !== FORMATS[name]) return false;
    if (name === "progress") {
      if (!isObj(o.lvs) || !isObj(o.modes)) return false;
      for (var i = 1; i <= LV_COUNT; i++) {
        var s = o.lvs[String(i)];
        if (!isObj(s) || typeof s.unlocked !== "boolean") return false;
        if (s.best !== "" && GRADES.indexOf(s.best) < 0) return false;
        if (s.g !== undefined) {
          if (!isObj(s.g)) return false;
          for (var gk in s.g) if (MODES.indexOf(gk) < 0 || GRADES.indexOf(s.g[gk]) < 0) return false;
        }
        if (s.c !== undefined) {
          if (!isObj(s.c)) return false;
          for (var ck in s.c) if (MODES.indexOf(ck) < 0 || typeof s.c[ck] !== "number" || s.c[ck] < 0 || s.c[ck] % 1 !== 0) return false;
        }
      }
      return true;
    }
    if (name === "review") {   // 틀린 단어: id(문자열)·lv(1~레벨 수)·date(문자열)
      if (!Array.isArray(o.items)) return false;
      for (var r = 0; r < o.items.length; r++) {
        var rv = o.items[r];
        if (!isObj(rv) || typeof rv.id !== "string" || typeof rv.date !== "string") return false;
        if (typeof rv.lv !== "number" || rv.lv < 1 || rv.lv > LV_COUNT || rv.lv % 1 !== 0) return false;
      }
      return true;
    }
    if (name === "wordbook") {
      if (!Array.isArray(o.items)) return false;
      for (var j = 0; j < o.items.length; j++) {
        var it = o.items[j];
        if (!isObj(it) || typeof it.id !== "string" || typeof it.date !== "string") return false;
      }
      return true;
    }
    if (typeof o.sound !== "boolean") return false;
    if (o.mute !== undefined && typeof o.mute !== "boolean") return false;
    if (o.sfx !== undefined && typeof o.sfx !== "boolean") return false;
    if (o.word !== undefined && typeof o.word !== "boolean") return false;
    if (o.result !== undefined && typeof o.result !== "boolean") return false;
    if (o.timer !== undefined && typeof o.timer !== "boolean") return false;
    if (o.bgm !== undefined && typeof o.bgm !== "boolean") return false;   // v0.47 배경음악 켜짐
    if (o.bgmVol !== undefined && (typeof o.bgmVol !== "number" || o.bgmVol < 0 || o.bgmVol > 100 || o.bgmVol % 1 !== 0)) return false;   // 배경음악 볼륨 0~100(%)
    if (o.betaBand !== undefined && (typeof o.betaBand !== "string" || (o.betaBand !== "" && BETA_IDS.indexOf(o.betaBand) < 0))) return false;   // BETA-TEST
    if (o.next !== undefined && NEXTS.indexOf(o.next) < 0) return false;
    if (o.style !== undefined && STYLES.indexOf(o.style) < 0) return false;
    return true;
  }

  function rawGet(name) {
    if (!blocked) {
      try { return localStorage.getItem(KEYS[name]); } catch (e) { blocked = true; }
    }
    return memory[name] === undefined ? null : memory[name];
  }

  function rawSet(name, text) {
    if (!blocked) {
      try { localStorage.setItem(KEYS[name], text); return; } catch (e) { blocked = true; }
    }
    memory[name] = text;
  }

  function mode() {
    if (!blocked) {
      try { localStorage.getItem("ej_probe"); } catch (e) { blocked = true; }
    }
    return blocked ? "memory" : "local";
  }

  // 읽기: 없거나 손상되면 기본값을 돌려준다(읽기만으로 저장하지 않는다)
  function get(name) {
    var raw = rawGet(name);
    if (raw === null) { statuses[name] = "empty"; return defaults(name); }
    var obj;
    try { obj = JSON.parse(raw); } catch (e) { obj = null; }
    if (!valid(name, obj)) { statuses[name] = "corrupt"; return defaults(name); }
    statuses[name] = "ok";
    if (name === "settings") {   // 옛 저장본에 없는 항목은 기본값으로 채운다(읽기만, 저장하지 않음)
      var d = defaults(name);
      for (var k in d) if (obj[k] === undefined) obj[k] = d[k];
    }
    return obj;
  }

  // 쓰기: 저장된 값과 같으면 저장하지 않는다. 저장했으면 true
  function set(name, value) {
    var text = JSON.stringify(value);
    var raw = rawGet(name);
    var current = raw !== null ? raw : JSON.stringify(defaults(name));
    if (text === current) return false;
    rawSet(name, text);
    writes++;
    return true;
  }

  function gradeAtLeast(grade, min) {
    return GRADES.indexOf(grade) >= GRADES.indexOf(min) && GRADES.indexOf(grade) >= 0;
  }

  function today() {
    var d = new Date();
    function p(n) { return n < 10 ? "0" + n : "" + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  // 필수 모드 목록 정리: 인수가 없거나 잘못되면 전체 모드
  function reqList(required) {
    if (!Array.isArray(required)) return MODES.slice();
    var out = [];
    for (var i = 0; i < required.length; i++) if (MODES.indexOf(required[i]) >= 0 && out.indexOf(required[i]) < 0) out.push(required[i]);
    return out.length ? out : MODES.slice();
  }

  // 레벨 lv의 필요 라운드 R(lv) = 올림(√lv): Lv1=1, Lv2~4=2, Lv5~9=3, ... Lv82~99=10
  function need(lv) { return Math.ceil(Math.sqrt(lv)); }

  // 그 레벨·모드의 채운 칸 수(최대 R). c가 없으면 옛 기록(g가 A 이상)을 1칸으로 본다
  function slotOf(st, lv, modeId) {
    if (!st) return 0;
    var n = (st.c && typeof st.c[modeId] === "number") ? st.c[modeId] : (st.g && gradeAtLeast(st.g[modeId] || "", NEED) ? 1 : 0);
    return Math.min(n, need(lv));
  }

  function modeSlots(lv, modeId) {
    return slotOf(get("progress").lvs[String(lv)], lv, modeId);
  }

  // 그 레벨 경험치: {cur: 채운 칸, total: 전체 칸, per: 모드당 칸}
  function xp(lv, required) {
    var st = get("progress").lvs[String(lv)], req = reqList(required), cur = 0;
    for (var i = 0; i < req.length; i++) cur += slotOf(st, lv, req[i]);
    return { cur: cur, total: req.length * need(lv), per: need(lv) };
  }

  // (v0.37 호환) 그 레벨에서 A 이상을 달성한 필수 모드 수
  function modesCleared(lv, required) {
    var st = get("progress").lvs[String(lv)], req = reqList(required), n = 0;
    if (!st) return 0;
    for (var i = 0; i < req.length; i++) if (st.g && gradeAtLeast(st.g[req[i]] || "", NEED)) n++;
    return n;
  }

  // 한 판 결과 기록: 레벨 최고 등급·모드별 최고 등급·모드 최고 점수를 갱신하고, 필수 모드 모두 A 이상이며 그 레벨 틀린 단어가 0개면 다음 레벨을 연다
  function recordResult(lv, modeId, grade, score, required) {
    if (GRADES.indexOf(grade) < 0 || lv < 1 || lv > LV_COUNT || MODES.indexOf(modeId) < 0) return false;
    var p = get("progress");
    var st = p.lvs[String(lv)];
    if (GRADES.indexOf(grade) > GRADES.indexOf(st.best)) st.best = grade;
    var base = slotOf(st, lv, modeId);   // 등급 기록보다 먼저 계산한다(c가 없는 옛 기록은 g로 1칸을 인정하므로, g를 먼저 바꾸면 이중으로 센다)
    if (!st.g) st.g = {};
    if (GRADES.indexOf(grade) > GRADES.indexOf(st.g[modeId] || "")) st.g[modeId] = grade;
    if (gradeAtLeast(grade, NEED)) {   // A 이상 클리어: 그 모드 칸 +1(최대 R칸). 칸이 이미 가득이면 값이 같아 저장하지 않는다
      if (!st.c) st.c = {};
      st.c[modeId] = Math.min(base + 1, need(lv));
    }
    var key = lv + ":" + modeId;
    if (typeof score === "number" && (typeof p.modes[key] !== "number" || score > p.modes[key])) p.modes[key] = score;
    var next = p.lvs[String(lv + 1)];
    if (next && allCleared(st, required, lv) && reviewLeft(lv) === 0) next.unlocked = true;
    return set("progress", p);
  }

  // 필수 모드가 모두 R칸이면 true(lv는 st가 속한 레벨)
  function allCleared(st, required, lv) {
    var req = reqList(required);
    for (var i = 0; i < req.length; i++) if (slotOf(st, lv, req[i]) < need(lv)) return false;
    return true;
  }

  // 그 레벨에 남은 틀린 단어 수
  function reviewLeft(lv) {
    var items = get("review").items, n = 0;
    for (var i = 0; i < items.length; i++) if (items[i].lv === lv) n++;
    return n;
  }

  // 복습을 마친 뒤 다음 레벨 열기: 필수 모드 모두 A 이상 + 틀린 단어 0개일 때만 연다. 새로 열었으면 true(이미 열려 있으면 저장하지 않고 false)
  function tryUnlock(lv, required) {
    var p = get("progress");
    var st = p.lvs[String(lv)], next = p.lvs[String(lv + 1)];
    if (!st || !next || next.unlocked || !allCleared(st, required, lv) || reviewLeft(lv) > 0) return false;
    next.unlocked = true;
    return set("progress", p);
  }

  // 맞힌 단어 추가: 이미 있으면 저장하지 않는다
  function addWord(id, date) {
    var wb = get("wordbook");
    for (var i = 0; i < wb.items.length; i++) if (wb.items[i].id === id) return false;
    wb.items.push({ id: id, date: date || today() });
    return set("wordbook", wb);
  }

  // 틀린 단어 추가(한 판이 끝날 때 한 번에): list는 [{id, lv}]. 이미 있는 단어·잘못된 항목은 건너뛰고, 새로 추가한 것이 있을 때만 저장한다
  // 반환: 새로 추가한 개수(저장 못 했으면 0)
  function addWrongs(list, date) {
    var rv = get("review"), have = {}, added = 0, i;
    for (i = 0; i < rv.items.length; i++) have[rv.items[i].id] = true;
    for (i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it || typeof it.id !== "string" || have[it.id]) continue;
      if (typeof it.lv !== "number" || it.lv < 1 || it.lv > LV_COUNT || it.lv % 1 !== 0) continue;
      have[it.id] = true;
      rv.items.push({ id: it.id, lv: it.lv, date: date || today() });
      added++;
    }
    if (!added) return 0;
    return set("review", rv) ? added : 0;
  }

  // 틀린 단어 제거(복습에서 맞힌 단어, 한 판이 끝날 때 한 번에): ids는 단어 id 목록. 제거한 개수를 돌려주고, 제거할 것이 없으면 저장하지 않는다
  function removeWrongs(ids) {
    var rv = get("review"), drop = {}, kept = [], i;
    for (i = 0; i < ids.length; i++) drop[ids[i]] = true;
    for (i = 0; i < rv.items.length; i++) if (!drop[rv.items[i].id]) kept.push(rv.items[i]);
    var removed = rv.items.length - kept.length;
    if (!removed) return 0;
    rv.items = kept;
    return set("review", rv) ? removed : 0;
  }

  function setSound(on) {
    var s = get("settings");
    s.sound = !!on;
    return set("settings", s);
  }

  // 소리 설정 1개 변경: key는 mute·sfx·word(true/false), style(STYLES 중 하나). 저장했으면 true
  function setSetting(key, value) {
    if (key === "style") { if (STYLES.indexOf(value) < 0) return false; }
    else if (key === "next") { if (NEXTS.indexOf(value) < 0) return false; }
    else if (key === "mute" || key === "sfx" || key === "word" || key === "result" || key === "timer" || key === "bgm") { if (typeof value !== "boolean") return false; }
    else if (key === "betaBand") { if (typeof value !== "string" || (value !== "" && BETA_IDS.indexOf(value) < 0)) return false; }   // BETA-TEST
    else if (key === "bgmVol") { if (typeof value !== "number" || value < 0 || value > 100 || value % 1 !== 0) return false; }
    else return false;
    var st = get("settings");
    st[key] = value;
    return set("settings", st);
  }

  // 4종 모두 삭제(개발용 점검 페이지에서만 사용)
  function clearAll() {
    var names = ["progress", "wordbook", "review", "settings"];
    for (var i = 0; i < names.length; i++) {
      delete memory[names[i]];
      if (!blocked) { try { localStorage.removeItem(KEYS[names[i]]); } catch (e) { blocked = true; } }
    }
  }

  return {
    KEYS: KEYS, MODES: MODES, NEED: NEED, LV_COUNT: LV_COUNT, GRADES: GRADES, STYLES: STYLES, NEXTS: NEXTS,
    get: get, set: set, recordResult: recordResult, addWord: addWord, addWrongs: addWrongs, removeWrongs: removeWrongs, reviewLeft: reviewLeft, modesCleared: modesCleared, need: need, xp: xp, modeSlots: modeSlots, tryUnlock: tryUnlock, setSound: setSound, setSetting: setSetting,
    clearAll: clearAll, gradeAtLeast: gradeAtLeast, mode: mode,
    writes: function () { return writes; },
    status: function (name) { return statuses[name] || "-"; }
  };
})();
