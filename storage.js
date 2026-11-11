// 영어정복 2단계: 브라우저 로컬 저장 (설계.md 4-2)
// 저장 4종: ej_progress(단계·최고 점수), ej_wordbook(맞힌 단어, v0.29부터 사용 중단), ej_review(틀린 단어, v0.29), ej_settings(설정)
// 원칙: 값이 바뀔 때만 저장한다(열기만 해서 저장하지 않음). 저장이 막혀도 화면은 깨지지 않는다.
var EJ = (function () {
  "use strict";

  var FORMAT = 1; // 저장 형식 번호(v). 나중에 형식이 바뀌면 이 값을 올리고 옛 기록을 변환한다
  var KEYS = { progress: "ej_progress", wordbook: "ej_wordbook", review: "ej_review", settings: "ej_settings" };
  var GRADES = ["C", "B", "A", "S"]; // 낮은 등급 -> 높은 등급
  var STAGE_COUNT = 4;
  var STYLES = ["retro", "bright", "chime"]; // 효과음 스타일: 레트로 8비트 / 밝은 게임풍 / 부드러운 차임
  var NEXTS = ["order", "same"];

  var memory = {};   // 저장이 막혔을 때만 쓰는 임시 보관(새로고침하면 사라짐)
  var blocked = false;
  var writes = 0;    // 이 페이지를 연 뒤 실제로 저장한 횟수
  var statuses = {}; // 마지막 읽기 결과: empty(없음) / ok / corrupt(손상)

  function defaults(name) {
    if (name === "progress") {
      var stages = {};
      for (var i = 1; i <= STAGE_COUNT; i++) {
        stages[String(i)] = { best: "", unlocked: i === 1 };
      }
      return { v: FORMAT, stages: stages, modes: {} };
    }
    if (name === "wordbook" || name === "review") return { v: FORMAT, items: [] };
    return { v: FORMAT, sound: true, mute: false, sfx: true, style: "retro", word: true, result: true, next: "order" };
  }

  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }

  function valid(name, o) {
    if (!isObj(o) || o.v !== FORMAT) return false;
    if (name === "progress") {
      if (!isObj(o.stages) || !isObj(o.modes)) return false;
      for (var i = 1; i <= STAGE_COUNT; i++) {
        var s = o.stages[String(i)];
        if (!isObj(s) || typeof s.unlocked !== "boolean") return false;
        if (s.best !== "" && GRADES.indexOf(s.best) < 0) return false;
      }
      return true;
    }
    if (name === "review") {   // 틀린 단어: id(문자열)·level(1~단계 수)·date(문자열)
      if (!Array.isArray(o.items)) return false;
      for (var r = 0; r < o.items.length; r++) {
        var rv = o.items[r];
        if (!isObj(rv) || typeof rv.id !== "string" || typeof rv.date !== "string") return false;
        if (typeof rv.level !== "number" || rv.level < 1 || rv.level > STAGE_COUNT || rv.level % 1 !== 0) return false;
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

  // 한 판 결과 기록: 단계 최고 등급·모드 최고 점수를 갱신하고, 등급 B 이상이며 그 단계 틀린 단어가 0개면 다음 단계를 연다
  function recordResult(stage, modeId, grade, score) {
    if (GRADES.indexOf(grade) < 0 || stage < 1 || stage > STAGE_COUNT) return false;
    var p = get("progress");
    var st = p.stages[String(stage)];
    if (GRADES.indexOf(grade) > GRADES.indexOf(st.best)) st.best = grade;
    var key = stage + ":" + modeId;
    if (typeof score === "number" && (typeof p.modes[key] !== "number" || score > p.modes[key])) p.modes[key] = score;
    var next = p.stages[String(stage + 1)];
    if (next && gradeAtLeast(st.best, "B") && reviewLeft(stage) === 0) next.unlocked = true;   // v0.31: 그 단계의 틀린 단어 복습도 끝나야 연다
    return set("progress", p);
  }

  // 그 단계(level)에 남은 틀린 단어 수
  function reviewLeft(stage) {
    var items = get("review").items, n = 0;
    for (var i = 0; i < items.length; i++) if (items[i].level === stage) n++;
    return n;
  }

  // 복습을 마친 뒤 다음 단계 열기: 그 단계 최고 등급 B 이상 + 틀린 단어 0개일 때만 연다. 새로 열었으면 true(이미 열려 있으면 저장하지 않고 false)
  function tryUnlock(stage) {
    var p = get("progress");
    var st = p.stages[String(stage)], next = p.stages[String(stage + 1)];
    if (!st || !next || next.unlocked || !gradeAtLeast(st.best, "B") || reviewLeft(stage) > 0) return false;
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

  // 틀린 단어 추가(한 판이 끝날 때 한 번에): list는 [{id, level}]. 이미 있는 단어·잘못된 항목은 건너뛰고, 새로 추가한 것이 있을 때만 저장한다
  // 반환: 새로 추가한 개수(저장 못 했으면 0)
  function addWrongs(list, date) {
    var rv = get("review"), have = {}, added = 0, i;
    for (i = 0; i < rv.items.length; i++) have[rv.items[i].id] = true;
    for (i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it || typeof it.id !== "string" || have[it.id]) continue;
      if (typeof it.level !== "number" || it.level < 1 || it.level > STAGE_COUNT || it.level % 1 !== 0) continue;
      have[it.id] = true;
      rv.items.push({ id: it.id, level: it.level, date: date || today() });
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
    else if (key === "mute" || key === "sfx" || key === "word" || key === "result") { if (typeof value !== "boolean") return false; }
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
    KEYS: KEYS, GRADES: GRADES, STYLES: STYLES, NEXTS: NEXTS,
    get: get, set: set, recordResult: recordResult, addWord: addWord, addWrongs: addWrongs, removeWrongs: removeWrongs, reviewLeft: reviewLeft, tryUnlock: tryUnlock, setSound: setSound, setSetting: setSetting,
    clearAll: clearAll, gradeAtLeast: gradeAtLeast, mode: mode,
    writes: function () { return writes; },
    status: function (name) { return statuses[name] || "-"; }
  };
})();
