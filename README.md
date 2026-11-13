# 영어정복

영어 단어·문장·듣기를 게임으로 익히는 웹 학습 게임입니다. PC와 휴대폰 브라우저에서 동작하며, 설치·가입 없이 바로 쓸 수 있습니다.

- 웹 주소: https://maxgenesis41.github.io/english-conquest/

## 게임 방식

- 레벨 1~99: 쉬운 단어에서 시작해 점점 어려워지고, 마지막 구간(Lv91~99)은 고급 단어(C1·C2)입니다
- 5가지 모드: 글자 맞추기 · 뜻 맞추기 · 철자 쓰기 · 문장 배열 · 듣기
- 한 판 10문제, 체력 5칸, 힌트 3회. 정답이면 점수와 연속 보너스, 오답이면 체력이 줄어듭니다
- 등급 S·A·B·C. 그 레벨의 모든 모드에서 A 이상을 받고 틀린 단어 복습을 모두 마치면(듣기는 영어 음성이 없는 기기에서 제외) 다음 레벨이 열립니다
- 틀린 단어는 "틀린 단어 복습"에 레벨별로 쌓이고, 복습 게임에서 맞히면 목록에서 빠집니다(문장 모드는 제외)
- 단어 3,813개(레벨당 36~44개), 문장 990개(레벨당 10개)

## 직접 실행

`index.html`을 더블클릭하면 브라우저에서 열립니다. 빌드나 설치가 필요 없습니다.

## 저장 방식

학습 기록(레벨 등급·최고 점수·틀린 단어)은 사용자 브라우저의 로컬 저장소에만 저장됩니다. 서버로 보내지 않으며, 로그인과 개인정보 수집이 없습니다. 브라우저 데이터를 지우거나 다른 기기·브라우저로 옮기면 기록은 이어지지 않습니다.

## 듣기 모드

브라우저 내장 음성 합성(Web Speech API)을 사용합니다. 영어 음성이 없는 기기에서는 듣기 모드만 비활성화되고 나머지 모드는 정상 동작합니다.

듣기 문제는 등급이 오를수록 어려워집니다. 낮은 등급은 확연히 다른 단어 4개 중에서 고르고, 중간 등급은 발음이 비슷한 단어 4개 중에서 고르며, 높은 등급은 소리를 듣고 한글 뜻을 고릅니다(생각 시간 2배). 비슷한 발음은 아래 발음 사전으로 계산합니다.

## 출처와 이용 조건

- 영어 단어 목록(Lv1~91, 일부 선정, 한글 뜻 추가):

  ```
  The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies.
  Retrieved from https://github.com/openlanguageprofiles/olp-en-cefrj
  (a copy of the list distributed at https://www.cefr-j.org/download.html) on 2026-11-10.
  ```

- 위 목록의 저작권은 도쿄외국어대학 Tono 연구실에 있으며, 출처를 적절히 밝히면 연구·상업 목적으로 사용할 수 있습니다. 이 프로젝트는 원 목록에서 일부 단어를 선정하고 한글 뜻을 직접 추가했습니다(원 목록을 고쳐 만든 것입니다). 원 목록은 완전하지 않을 수 있고 제작처는 사용으로 생기는 손해에 책임을 지지 않으므로, 이 프로젝트의 단어 데이터에도 오류가 있을 수 있습니다. 최신 개정판(v1.6 등)은 공식 사이트에서 확인하세요
- 고급 단어(Lv91~99, 일부 선정, 한글 뜻 추가):

  ```
  Octanove Vocabulary Profile C1/C2 (ver 1.0), Octanove Labs (http://www.octanove.com/)
  Retrieved from https://github.com/openlanguageprofiles/olp-en-cefrj
  Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)
  ```

- 이 프로젝트는 위 목록에서 일부 단어를 선정하고 한글 뜻을 직접 추가했습니다(변경됨). 변경한 단어 데이터(`data/words-adv.js`)도 같은 CC BY-SA 4.0으로 배포합니다. 원 자료는 어떠한 보증 없이 있는 그대로 제공되며, 이 프로젝트의 단어 데이터에도 오류가 있을 수 있습니다
- 위 라이선스는 `data/words-adv.js`에 적용됩니다. 앱 코드와 다른 데이터 파일은 이 라이선스의 대상이 아닙니다
- 단어 발음 기호(`data/sound.js`, 듣기 모드의 비슷한 발음 보기 계산용):

  ```
  The Carnegie Mellon Pronouncing Dictionary (CMUdict 0.7b), Copyright (C) 1993-2015 Carnegie Mellon University.
  https://github.com/cmusphinx/cmudict
  ```

  이용 조건 원문은 `data/sound.js` 맨 위에 있습니다. 철자를 발음 기호로 바꿔 한 글자씩 저장한 것입니다(변경됨).
- 한글 뜻과 모든 문장: 직접 작성
- 글꼴: Pretendard (SIL Open Font License 1.1, `fonts/LICENSE.txt` 참조)
- 코드: 순수 HTML·CSS·JavaScript(외부 라이브러리 없음)
- 이 프로젝트의 코드·이미지·문구는 다른 게임에서 가져오지 않았습니다. 게임 진행 방식(규칙)만 공개 자료를 참고해 새로 설계했습니다

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 구조 |
| `style.css` | 화면 스타일 |
| `app.js` | 화면 이동·게임 진행 |
| `game.js` | 게임 규칙(점수·체력·힌트·등급) |
| `storage.js` | 브라우저 로컬 저장 |
| `data/words.js`, `data/sentences.js` | 단어(Lv1~91)·문장 데이터 |
| `data/words-adv.js` | 고급 단어 데이터(Octanove, CC BY-SA 4.0) |
| `data/sound.js` | 단어 발음 기호(CMU 발음 사전, 듣기 모드 비슷한 발음 보기용) |
| `data/dialogs.js` | 듣기 모드 대답 고르기 문제 120개(마스터~전설 등급별 30개, 직접 작성) |
| `fonts/` | Pretendard 글꼴과 라이선스 |
