// 영어정복 2단계: 브라우저 로컬 저장 (설계.md 4-2)
// 저장 3종: ej_progress(단계·최고 점수), ej_wordbook(맞힌 단어), ej_settings(설정)
// 원칙: 값이 바뀔 때만 저장한다(열기만 해서 저장하지 않음). 저장이 막혀도 화면은 깨지지 않는다.
var EJ = (function () {
  "use strict";

  var FORMAT = 1; // 저장 형식 번호(v). 나중에 형식이 바뀌면 이 값을 올리고 옛 기록을 변환한다
  var KEYS = { progress: "ej_progress", wordbook: "ej_wordbook", settings: "ej_settings" };
  var GRADES = ["C", "B", "A", "S"]; // 낮은 등급 -> 높은 등급
  var STAGE_COUNT = 4;
  var STYLES = ["retro", "bright", "chime"]; // 효과음 스타일: 레트로 8비트 / 밝은 게임풍 / 부드러운 차임

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
    if (name === "wordbook") return { v: FORMAT, items: [] };
    return { v: FORMAT, sound: true, mute: false, sfx: true, style: "retro", word: true };
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

  // 한 판 결과 기록: 단계 최고 등급·모드 최고 점수를 갱신하고, 등급 B 이상이면 다음 단계를 연다
  function recordResult(stage, modeId, grade, score) {
    if (GRADES.indexOf(grade) < 0 || stage < 1 || stage > STAGE_COUNT) return false;
    var p = get("progress");
    var st = p.stages[String(stage)];
    if (GRADES.indexOf(grade) > GRADES.indexOf(st.best)) st.best = grade;
    var key = stage + ":" + modeId;
    if (typeof score === "number" && (typeof p.modes[key] !== "number" || score > p.modes[key])) p.modes[key] = score;
    var next = p.stages[String(stage + 1)];
    if (next && gradeAtLeast(st.best, "B")) next.unlocked = true;
    return set("progress", p);
  }

  // 맞힌 단어 추가: 이미 있으면 저장하지 않는다
  function addWord(id, date) {
    var wb = get("wordbook");
    for (var i = 0; i < wb.items.length; i++) if (wb.items[i].id === id) return false;
    wb.items.push({ id: id, date: date || today() });
    return set("wordbook", wb);
  }

  function setSound(on) {
    var s = get("settings");
    s.sound = !!on;
    return set("settings", s);
  }

  // 소리 설정 1개 변경: key는 mute·sfx·word(true/false), style(STYLES 중 하나). 저장했으면 true
  function setSetting(key, value) {
    if (key === "style") { if (STYLES.indexOf(value) < 0) return false; }
    else if (key === "mute" || key === "sfx" || key === "word") { if (typeof value !== "boolean") return false; }
    else return false;
    var st = get("settings");
    st[key] = value;
    return set("settings", st);
  }

  // 3종 모두 삭제(개발용 점검 페이지에서만 사용)
  function clearAll() {
    var names = ["progress", "wordbook", "settings"];
    for (var i = 0; i < names.length; i++) {
      delete memory[names[i]];
      if (!blocked) { try { localStorage.removeItem(KEYS[names[i]]); } catch (e) { blocked = true; } }
    }
  }

  return {
    KEYS: KEYS, GRADES: GRADES, STYLES: STYLES,
    get: get, set: set, recordResult: recordResult, addWord: addWord, setSound: setSound, setSetting: setSetting,
    clearAll: clearAll, gradeAtLeast: gradeAtLeast, mode: mode,
    writes: function () { return writes; },
    status: function (name) { return statuses[name] || "-"; }
  };
})();
