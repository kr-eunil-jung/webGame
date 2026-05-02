# 🎮 Developer Guide — 새로운 게임 추가하기

이 가이드는 WebGame 플랫폼에 새로운 게임을 추가하는 방법을 설명합니다.

---

## 📋 목차

1. [아키텍처 개요](#아키텍처-개요)
2. [게임 등록 구조](#게임-등록-구조)
3. [단계별 가이드](#단계별-가이드)
4. [게임 생명주기](#게임-생명주기)
5. [GameInstance 인터페이스](#gameinstance-인터페이스)
6. [오디오 (배경음 & 효과음)](#오디오-배경음--효과음)
7. [모범 사례](#모범-사례)
8. [디버깅 팁](#디버깅-팁)

---

## 아키텍처 개요

```
index.html
  ├── registry.js    → GameRegistry (게임 등록/조회)
  ├── router.js      → Hash 기반 SPA 라우터
  ├── games/*.js     → 개별 게임 모듈
  └── app.js         → 진입점 (라우트 처리, 렌더링)
```

### 데이터 흐름

```
사용자가 게임 선택
    → Router.hash 변경
    → Router.onRouteChange() 발동
    → app.js가 GameRegistry.get(id) 로 게임 조회
    → gameConfig.init(container) 호출
    → GameInstance 반환 → canvas/DOM 렌더링
```

---

## 게임 등록 구조

모든 게임은 `GameRegistry.register()`를 호출하여 등록해야 합니다.

```javascript
GameRegistry.register({
  id: 'my-game',                    // 고유 ID (URL hash용, 소문자+하이픈 권장)
  name: 'My Game',                  // 표시 이름 (네비게이션 바, 카드에 표시됨)
  description: 'A fun game!',       // 홈 화면 카드 설명
  init(container) {                 // ✅ 필수: 게임 초기화 함수
    // container: HTMLElement (#game-canvas div)
    // 이 함수는 GameInstance 객체를 반환해야 합니다
    return new MyGame(container);
  },
  options: {                        // ✅ 선택: 추가 메타데이터
    category: 'puzzle',
    difficulty: 'easy',
  },
});
```

---

## 단계별 가이드

### Step 1: 게임 파일 생성

`js/games/` 폴더에 새 JavaScript 파일을 만듭니다.

```
js/games/
  ├── sirtet.js
  ├── memory-card.js
  └── my-game.js      ← 새로 추가
```

### Step 2: IIFE로 캡슐화

파일 최상단에 IIFE(즉시 호출 함수 표현식)로 감싸 전역 오염을 방지합니다.

```javascript
(function () {
  'use strict';

  // 게임 코드 작성

})();
```

### Step 3: GameRegistry.register() 호출

IIFE 내부에서 게임을 등록합니다.

```javascript
GameRegistry.register({
  id: 'snake',
  name: 'Snake',
  description: 'Classic snake game',
  init(container) {
    return new SnakeGame(container);
  },
});
```

### Step 4: GameInstance 클래스 구현

반드시 `destroy()` 메서드를 포함해야 합니다.

```javascript
class SnakeGame {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 400;
    this.canvas.height = 400;
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // 상태 초기화
    this.gameOver = false;
    this.animationId = null;

    // 이벤트 바인딩
    this.bindKeys();

    // 게임 시작
    this.update();
  }

  bindKeys() {
    this.keyHandler = (e) => {
      // 키 입력 처리
      if (this.gameOver) return;
      // ...
      e.preventDefault();
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  update(timestamp) {
    if (this.gameOver) {
      this.draw();
      return;
    }
    // 게임 로직
    this.draw();
    this.animationId = requestAnimationFrame((ts) => this.update(ts));
  }

  draw() {
    // 렌더링 로직
  }

  // ✅ 필수: 리소스 정리
  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.container.innerHTML = '';
  }
}
```

### Step 5: index.html에 스크립트 추가

`index.html`에서 `app.js` **앞에** 새 게임 파일을 추가합니다.

```html
<script src="js/registry.js"></script>
<script src="js/router.js"></script>
<script src="js/games/sirtet.js"></script>
<script src="js/games/my-game.js"></script>  <!-- ← 추가 -->
<script src="js/app.js"></script>
```

> **중요:** `app.js`는 반드시 마지막에 로드되어야 합니다.

### Step 6: 테스트

브라우저에서 `index.html`을 열고:

1. 홈 화면에 새 게임 카드가 나타나는지 확인
2. 게임 클릭 시 정상적으로 실행되는지 확인
3. "Back" 버튼 클릭 시 홈으로 돌아가고 게임이 정리되는지 확인
4. 다른 게임으로 전환했을 때 충돌이 없는지 확인

---

## 게임 생명주기

### 1. 대기화면에서 시작

모든 게임은 `init()` 호출 시 즉시 게임 로직을 시작하지 않고, **대기화면(ready/waiting screen)** 을 먼저 표시해야 합니다. 대기화면에는 게임 제목과 시작 안내 텍스트를 캔버스에 직접 렌더링합니다. 사용자가 Enter 또는 Space를 눌러 명시적으로 시작을 선택한 후 게임 루프가 동작하도록 구성합니다.

```javascript
class MyGame {
  constructor(container) {
    this.container = container;
    this.gameStarted = false;
    this.gameOver = false;
    this._overlay = null;

    this.canvas = document.createElement('canvas');
    this.canvas.width = 400;
    this.canvas.height = 400;
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.showWaitingScreen();
    this.bindKeys();
  }

  // ===== 대기화면 =====
  showWaitingScreen() {
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#eee';
    this.ctx.font = 'bold 28px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('My Game', this.canvas.width / 2, this.canvas.height / 2 - 40);
    this.ctx.font = '16px sans-serif';
    this.ctx.fillText('Press Enter or Space to Start', this.canvas.width / 2, this.canvas.height / 2 + 10);
  }

  bindKeys() {
    this.keyHandler = (e) => {
      // 대기화면에서 Enter/Space 누르면 게임 시작
      if (!this.gameStarted && (e.key === 'Enter' || e.key === ' ')) {
        this.gameStarted = true;
        this.update();
        e.preventDefault();
        return;
      }
      // 게임 로직...
    };
    window.addEventListener('keydown', this.keyHandler);
  }
}
```

### 2. 게임 종료 후 처리

게임이 종료되면 **오버레이 + 버튼** 으로 **다시 하기**, **대기화면** 을 표시합니다. 캔버스에 직접 텍스트를 그리는 대신 DOM 버튼을 사용하여 일관된 UI를 제공합니다.

```javascript
  // ===== 오버레이 생성 (버튼용) =====
  createOverlay(children) {
    this.removeOverlay();

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.75); display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 0.3rem; z-index: 10;
    `;

    children.forEach((child) => overlay.appendChild(child));

    if (getComputedStyle(this.container).position === 'static') {
      this.container.style.position = 'relative';
    }
    this.container.appendChild(overlay);
    this._overlay = overlay;
  }

  removeOverlay() {
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
  }

  // 게임 종료 시 버튼 오버레이 표시
  showGameOverUI() {
    const title = document.createElement('div');
    title.textContent = 'GAME OVER';
    title.style.cssText = 'color:#e94560;font:bold 28px sans-serif;margin-bottom:0.3rem';

    const score = document.createElement('div');
    score.textContent = `Score: ${this.score}`;
    score.style.cssText = 'color:#eee;font:18px sans-serif;margin-bottom:0.8rem';

    const btnRestart = document.createElement('button');
    btnRestart.textContent = '다시 하기';
    btnRestart.style.cssText = `
      padding: 0.5rem 1.6rem; font: bold 15px sans-serif; cursor: pointer;
      border: none; border-radius: 4px; background: #e94560; color: #fff;
    `;
    btnRestart.addEventListener('click', () => this.restart());

    const btnWaiting = document.createElement('button');
    btnWaiting.textContent = '대기화면';
    btnWaiting.style.cssText = `
      padding: 0.5rem 1.6rem; font: bold 15px sans-serif; cursor: pointer;
      border: none; border-radius: 4px; background: #555; color: #fff;
    `;
    btnWaiting.addEventListener('click', () => this.resetToWaiting());

    this.createOverlay([title, score, btnRestart, btnWaiting]);
  }

  restart() {
    this.gameOver = false;
    this.score = 0;
    this.removeOverlay();
    // 게임 상태 초기화...
    this.update();
  }

  resetToWaiting() {
    this.gameOver = false;
    this.gameStarted = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.removeOverlay();
    this.showWaitingScreen();
  }
}
```

---

## GameInstance 인터페이스

`init(container)`가 반환하는 객체는 아래 인터페이스를 따라야 합니다.

| 메서드 | 필수 | 설명 |
|--------|:----:|------|
| `destroy()` | ✅ | 게임 종료 시 리소스 정리 (animation cancel, event listener 제거, DOM 제거) |

### 권장 상태 플래그

| 속성 | 타입 | 설명 |
|------|:----:|------|
| `gameStarted` | `boolean` | 대기화면 통과 여부 |
| `gameOver` | `boolean` | 게임 종료 상태 |
| `animationId` | `number` | 현재 requestAnimationFrame ID |

---

그 외 메서드는 게임 구현에 따라 자유롭게 정의합니다.

---

## 오디오 (배경음 & 효과음)

WebGame 플랫폼은 `js/audio.js`에 포함된 `GameAudio` 클래스를 통해 배경음(BGM)과 효과음(SFX)을 제공합니다. 외부 오디오 파일 없이 Web Audio API로 사운드를 합성합니다.

### 아키텍처

```
js/audio.js  → GameAudio 클래스 (BGM + SFX 합성)
    ↓
js/games/sirtet.js  → GameAudio 인스턴스 사용
```

### GameAudio 사용법

```javascript
// 1. 인스턴스 생성
const audio = new GameAudio();

// 2. 초기화 (사용자 제스처 후 호출 — 브라우저 정책)
audio.init();

// 3. 효과음 재생
audio.playSFX('move');      // 블록 이동
audio.playSFX('rotate');    // 블록 회전
audio.playSFX('drop');      // 하드 드롭
audio.playSFX('clear');     // 라인 클리어
audio.playSFX('gameover');  // 게임 종료
audio.playSFX('start');     // 게임 시작
audio.playSFX('eat');       // 먹이 먹음
audio.playSFX('select');    // 선택
audio.playSFX('invalid');   // 무효

// 4. 배경음 재생/정지
audio.playBGM('sirtet');    // Sirtet BGM 재생
audio.playBGM('snake');     // 뱀게임 BGM 재생
audio.playBGM('fruitbox');  // 사과게임 BGM 재생
audio.playBGM('breakout');  // 벽돌깨기 BGM 재생
audio.playBGM('memory');    // 메모리카드 BGM 재생
audio.stopBGM();            // BGM 정지

// 5. 볼륨 조절
audio.setVolume(0.12, 0.35); // (bgmVol, sfxVol)

// 6. 음소거 토글
const enabled = audio.toggle();

// 7. 리소스 정리
audio.destroy();
```

### 지원 효과음 (SFX)

| 이름 | 설명 | 사운드 특징 |
|------|------|-------------|
| `move` | 블록 이동 | 짧은 저음 스퀘어 파형 |
| `rotate` | 블록 회전 | 상승하는 사인 파형 |
| `drop` | 하드 드롭 | 하강하는 톤 + 임팩트 |
| `clear` | 라인 클리어 | 상승하는 아르페지오 (C-E-G-C) |
| `gameover` | 게임 종료 | 하강하는 멜로디 (G-F-E-C) |
| `start` | 게임 시작 | 상승하는 아르페지오 (C-E-G-C) |
| `eat` | 먹이 먹음 | 밝고 짧은 상승 사인 파형 |
| `select` | 선택 | 부드러운 트라이앵글 클릭 |
| `invalid` | 무효 | 낮고 짧은 소스웨이브 buzz |

### 지원 배경음 (BGM)

| 프리셋 | 설명 |
|--------|------|
| `sirtet` | Tetris Theme(Everlydeen) 스타일 8비트 루프 멜로디, BPM 132 |
| `snake` | 경쾌한 8비트 루프 멜로디, BPM 120 |
| `fruitbox` | 경쾌한 팝 스타일 8비트 루프, BPM 110 |
| `breakout` | 역동적인 8비트 루프 멜로디, BPM 128 |
| `memory`   | 차분한 8비트 루프 멜로디, BPM 100 |

### 게임에 오디오 통합하기

```javascript
class MyGame {
  constructor(container) {
    this.audio = new GameAudio();
    // ...
  }

  startGame() {
    this.audio.init();       // AudioContext 초기화 (사용자 입력 시)
    this.audio.playSFX('start');
    this.audio.playBGM('sirtet');
  }

  gameOver() {
    this.audio.stopBGM();
    this.audio.playSFX('gameover');
  }

  destroy() {
    this.audio.destroy();    // AudioContext 닫기
  }
}
```

### 브라우저 오디오 정책

모든 브라우저는 **사용자 제스처(클릭, 키 입력 등) 없이 AudioContext를 재생할 수 없습니다**. 따라서:

1. `audio.init()`을 대기화면에서 사용자가 Enter/Space를 눌렀을 때 호출
2. `init()` 내부에서 `AudioContext`를 생성하고 `resume()`

```javascript
// 대기화면에서 키 입력 시
if (!this.gameStarted && (e.key === 'Enter' || e.key === ' ')) {
  this.audio.init();  // ✅ 여기에서 초기화
  this.gameStarted = true;
  this.initGame();
}
```

### 새로운 사운드 추가하기

`GameAudio` 클래스에 새로운 SFX 메서드를 추가합니다:

```javascript
// js/audio.js 내
_sfxMySound(t) {
  const o = this.ctx.createOscillator();
  const g = this.ctx.createGain();
  o.type = 'square';
  o.frequency.value = 440;
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  o.connect(g).connect(this.sfxGain);
  o.start(t); o.stop(t + 0.15);
}

// playSFX()의 switch 문에 추가
case 'mysound':
  this._sfxMySound(now);
  break;
```

---

## 모범 사례

### 1. 전역 변수 금지

모든 변수를 IIFE 내부 또는 클래스 내부에 선언하세요.

```javascript
// ❌ 안됨
let score = 0;

// ✅ 권장
class MyGame {
  constructor() {
    this.score = 0;
  }
}
```

### 2. 이벤트 리스너 정리

`destroy()`에서 반드시 추가한 이벤트 리스너를 제거하세요.

```javascript
destroy() {
  window.removeEventListener('keydown', this.keyHandler);
}
```

### 3. requestAnimationFrame 정리

```javascript
destroy() {
  if (this.animationId) {
    cancelAnimationFrame(this.animationId);
  }
}
```

### 4. Canvas 크기 제한

게임 캔버스 크기가 화면을 넘지 않도록 주의하세요.

```javascript
// 반응형 처리 예시
const maxSize = Math.min(window.innerWidth - 100, 600);
this.canvas.width = maxSize;
this.canvas.height = maxSize;
```

### 5. 게임 상태 분리

게임 로직과 렌더링 로직을 분리하면 유지보수가 쉬워집니다.

```javascript
update(timestamp) {
  this.updateLogic(timestamp);  // 상태 업데이트
  this.draw();                  // 렌더링
  this.animationId = requestAnimationFrame((ts) => this.update(ts));
}
```

---

## 디버깅 팁

### 게임이 나타나지 않음

- `index.html`에 `<script>` 태그가 올바른 순서로 추가되었는지 확인
- 브라우저 콘솔에서 `[GameRegistry] Invalid game config` 에러 확인
- `GameRegistry.register()` 호출 시 필수 필드(id, name, init)가 모두 있는지 확인

### 게임 전환 시 충돌

- `destroy()` 메서드가 올바르게 구현되었는지 확인
- `requestAnimationFrame`과 `setInterval`이 모두 정리되었는지 확인
- 이벤트 리스너 제거가 누락되지 않았는지 확인

### 성능 문제

- `requestAnimationFrame`을 `setInterval` 대신 사용하세요
- Canvas 크기를 필요 이상으로 크게 하지 마세요
- 불필요한 DOM 조작을 최소화하세요

### 오디오 관련 문제

- **소리가 나지 않음**: `audio.init()`이 사용자 제스처(키 입력 등) 후에 호출되었는지 확인
- **BGM이 중복 재생**: `playBGM()` 호출 전에 `stopBGM()`을 호출했는지 확인
- **게임 전환 후 잔향**: `destroy()`에서 `audio.destroy()`를 호출했는지 확인

---

## 참고: 기존 게임 분석

`js/games/sirtet.js`를 참고하면:

- GameRegistry 등록 패턴
- Canvas 기반 렌더링
- 키보드 입력 처리
- 게임 루프 (requestAnimationFrame)
- destroy() 리소스 정리
- **GameAudio를 활용한 배경음/효과음 통합**

모든 패턴을 확인할 수 있습니다.
