/**
 * Snake — 클래식 뱀 게임
 *
 * GameRegistry.register() 로 등록되며,
 * init(container) 메서드가 호출됩니다.
 */
(function () {
  'use strict';

  // ===== 상수 =====
  const COLS = 20;
  const ROWS = 20;
  const BLOCK = 20;
  const CANVAS_SIZE = COLS * BLOCK;

  // 방향
  const DIR = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
  };

  // ===== GameRegistry 등록 =====
  GameRegistry.register({
    id: 'snake',
    name: '뱀게임',
    description: '클래식 뱀 게임 — 먹이를 먹고 자라세요!',
    init(container) {
      return new SnakeGame(container);
    },
  });

  // ===== 게임 클래스 =====
  class SnakeGame {
    constructor(container) {
      this.container = container;
      this.canvas = document.createElement('canvas');
      this.canvas.width = CANVAS_SIZE;
      this.canvas.height = CANVAS_SIZE;
      this.canvas.style.border = '2px solid var(--color-primary)';
      this.canvas.style.borderRadius = '4px';
      this.ctx = this.canvas.getContext('2d');

      this.gameStarted = false;
      this.gameOver = false;
      this.animationId = null;
      this._overlay = null;

      this.container.appendChild(this.canvas);

      this.showWaitingScreen();
      this.bindKeys();
    }

    // ===== 대기화면 =====
    showWaitingScreen() {
      const { ctx, canvas } = this;
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#eee';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('\ud83d\udc0d 뱀게임', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '16px sans-serif';
      ctx.fillText('Enter 또는 Space를 눌러 시작하세요', canvas.width / 2, canvas.height / 2 + 10);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('화살표 키로 이동하세요', canvas.width / 2, canvas.height / 2 + 40);
    }

    resetGame() {
      this.snake = [{ x: 10, y: 10 }];
      this.food = null;
      this.direction = DIR.RIGHT;
      this.directionQueue = [];
      this.score = 0;
      this.lastUpdate = 0;
      this.speed = 150;
      this.spawnFood();

      // Score display
      if (!this.scoreEl) {
        this.scoreEl = document.createElement('div');
        this.scoreEl.style.cssText =
          'margin-top:0.5rem;font-size:1.1rem;color:var(--color-text)';
        this.container.appendChild(this.scoreEl);
      }
    }

    spawnFood() {
      let pos;
      do {
        pos = {
          x: Math.floor(Math.random() * COLS),
          y: Math.floor(Math.random() * ROWS),
        };
      } while (this.snake.some((seg) => seg.x === pos.x && seg.y === pos.y));
      this.food = pos;
    }

    bindKeys() {
      this.keyHandler = (e) => {
        // 대기화면에서 Enter/Space 누르면 게임 시작
        if (!this.gameStarted && (e.key === 'Enter' || e.key === ' ')) {
          this.gameStarted = true;
          this.resetGame();
          this.update();
          e.preventDefault();
          return;
        }

        // 게임 종료 시 처리
        if (this.gameOver) return;

        // 큐의 마지막 방향(다음에 적용될 방향)으로 반대 방향 체크
        const lastQueued =
          this.directionQueue.length > 0
            ? this.directionQueue[this.directionQueue.length - 1]
            : this.direction;

        let newDir = null;
        switch (e.key) {
          case 'ArrowUp':
            newDir = DIR.UP;
            break;
          case 'ArrowDown':
            newDir = DIR.DOWN;
            break;
          case 'ArrowLeft':
            newDir = DIR.LEFT;
            break;
          case 'ArrowRight':
            newDir = DIR.RIGHT;
            break;
        }

        if (newDir) {
          // 같은 방향 중복 입력 무시
          if (newDir.x === lastQueued.x && newDir.y === lastQueued.y) {
            e.preventDefault();
            return;
          }
          // 반대 방향 체크 (큐의 마지막 방향 기준)
          if (newDir.x === -lastQueued.x && newDir.y === -lastQueued.y) {
            e.preventDefault();
            return;
          }
          // 큐 최대 3개까지만 허용 (과도한 쌓임 방지)
          if (this.directionQueue.length < 3) {
            this.directionQueue.push(newDir);
          }
          e.preventDefault();
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }

    restart() {
      this.gameOver = false;
      this.resetGame();
      this.removeOverlay();
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

    showGameOverUI() {
      const title = document.createElement('div');
      title.textContent = '게임 종료';
      title.style.cssText = 'color:#e94560;font:bold 28px sans-serif;margin-bottom:0.3rem';

      const score = document.createElement('div');
      score.textContent = '점수: ' + this.score;
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

    tick() {
      // 큐에서 다음 방향 꺼내기
      if (this.directionQueue.length > 0) {
        this.direction = this.directionQueue.shift();
      }

      const head = this.snake[0];
      const newHead = {
        x: head.x + this.direction.x,
        y: head.y + this.direction.y,
      };

      // Wall collision
      if (
        newHead.x < 0 ||
        newHead.x >= COLS ||
        newHead.y < 0 ||
        newHead.y >= ROWS
      ) {
        this.gameOver = true;
        this.showGameOverUI();
        return;
      }

      // Self collision
      if (this.snake.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
        this.gameOver = true;
        this.showGameOverUI();
        return;
      }

      this.snake.unshift(newHead);

      // Food collision
      if (newHead.x === this.food.x && newHead.y === this.food.y) {
        this.score += 10;
        this.spawnFood();
        // Slightly increase speed
        this.speed = Math.max(60, this.speed - 2);
      } else {
        this.snake.pop();
      }
    }

    draw() {
      const { ctx, canvas } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lines (subtle)
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * BLOCK, 0);
        ctx.lineTo(x * BLOCK, CANVAS_SIZE);
        ctx.stroke();
      }
      for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * BLOCK);
        ctx.lineTo(CANVAS_SIZE, y * BLOCK);
        ctx.stroke();
      }

      // Food
      if (this.food) {
        ctx.fillStyle = '#e94560';
        ctx.beginPath();
        ctx.arc(
          this.food.x * BLOCK + BLOCK / 2,
          this.food.y * BLOCK + BLOCK / 2,
          BLOCK / 2 - 2,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // Snake
      this.snake.forEach((seg, i) => {
        if (i === 0) {
          ctx.fillStyle = '#4ade80'; // head
        } else {
          // Gradient from green to darker green
          const ratio = i / this.snake.length;
          ctx.fillStyle = 'rgba(74, 222, 128, ' + (1 - ratio * 0.6) + ')';
        }
        ctx.fillRect(
          seg.x * BLOCK + 1,
          seg.y * BLOCK + 1,
          BLOCK - 2,
          BLOCK - 2
        );
      });

      // Score
      this.scoreEl.textContent = '점수: ' + this.score + '  |  길이: ' + this.snake.length;
    }

    update(timestamp = 0) {
      if (this.gameOver) {
        this.draw();
        return;
      }

      if (timestamp - this.lastUpdate > this.speed) {
        this.tick();
        this.lastUpdate = timestamp;
      }

      this.draw();
      this.animationId = requestAnimationFrame((ts) => this.update(ts));
    }

    destroy() {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
      this.container.innerHTML = '';
    }
  }
})();