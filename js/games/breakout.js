/**
 * Breakout — 클래식 벽돌깨기 게임
 *
 * GameRegistry.register() 로 등록되며,
 * init(container) 메서드가 호출됩니다.
 */
(function () {
  'use strict';

  // ===== 상수 =====
  const COLS = 10;
  const ROWS = 6;
  const PADDLE_WIDTH = 80;
  const PADDLE_HEIGHT = 12;
  const BALL_RADIUS = 6;
  const BRICK_PADDING = 4;
  const BRICK_HEIGHT = 22;
  const BRICK_TOP_OFFSET = 40;
  const CANVAS_WIDTH = 480;
  const CANVAS_HEIGHT = 420;

  // 패들 속도
  const PADDLE_SPEED = 7;

  // 행별 색상
  const BRICK_COLORS = ['#e94560', '#f5a623', '#4ade80', '#22d3ee', '#a78bfa', '#f472b6'];

  // ===== GameRegistry 등록 =====
  GameRegistry.register({
    id: 'breakout',
    name: '벽돌깨기',
    description: '공으로 벽돌을 모두 깨세요!',
    init(container) {
      return new BreakoutGame(container);
    },
  });

  // ===== 게임 클래스 =====
  class BreakoutGame {
    constructor(container) {
      this.container = container;
      this.canvas = document.createElement('canvas');
      this.canvas.width = CANVAS_WIDTH;
      this.canvas.height = CANVAS_HEIGHT;
      this.canvas.style.border = '2px solid var(--color-primary)';
      this.canvas.style.borderRadius = '4px';
      this.ctx = this.canvas.getContext('2d');

      this.gameStarted = false;
      this.gameOver = false;
      this.animationId = null;
      this._overlay = null;
      this.lives = 3;

      this.audio = new GameAudio();

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
      ctx.fillText('🧱 벽돌깨기', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '16px sans-serif';
      ctx.fillText('Enter 또는 Space를 눌러 시작하세요', canvas.width / 2, canvas.height / 2 + 10);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('좌우 화살표 또는 마우스로 패들을 이동', canvas.width / 2, canvas.height / 2 + 40);
    }

    resetGame() {
      this.score = 0;
      this.lives = 3;
      this.paddleX = (CANVAS_WIDTH - PADDLE_WIDTH) / 2;
      this.ballX = CANVAS_WIDTH / 2;
      this.ballY = CANVAS_HEIGHT - 40;
      this.ballDX = 3;
      this.ballDY = -3;
      this.keys = { left: false, right: false };
      this.initBricks();

      // Score display
      if (!this.scoreEl) {
        this.scoreEl = document.createElement('div');
        this.scoreEl.style.cssText =
          'margin-top:0.5rem;font-size:1.1rem;color:var(--color-text)';
        this.container.appendChild(this.scoreEl);
      }
    }

    initBricks() {
      this.bricks = [];
      const brickWidth = (CANVAS_WIDTH - (COLS + 1) * BRICK_PADDING) / COLS;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          this.bricks.push({
            x: BRICK_PADDING + c * (brickWidth + BRICK_PADDING),
            y: BRICK_TOP_OFFSET + r * (BRICK_HEIGHT + BRICK_PADDING),
            w: brickWidth,
            h: BRICK_HEIGHT,
            color: BRICK_COLORS[r],
            alive: true,
          });
        }
      }
    }

    bindKeys() {
      this.keyHandler = (e) => {
        // 대기화면에서 Enter/Space 누르면 게임 시작
        if (!this.gameStarted && (e.key === 'Enter' || e.key === ' ')) {
          this.audio.init();
          this.audio.playSFX('start');
          this.audio.playBGM('breakout');
          this.gameStarted = true;
          this.resetGame();
          this.update();
          e.preventDefault();
          return;
        }

        if (this.gameOver) return;

        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          if (e.type === 'keydown' && !e.repeat) {
            this.keys[e.key === 'ArrowLeft' ? 'left' : 'right'] = true;
            e.preventDefault();
          } else if (e.type === 'keyup') {
            this.keys[e.key === 'ArrowLeft' ? 'left' : 'right'] = false;
          }
        }
      };
      window.addEventListener('keydown', this.keyHandler);
      window.addEventListener('keyup', this.keyHandler);

      // 마우스/터치 컨트롤
      this.mouseHandler = (e) => {
        if (!this.gameStarted || this.gameOver) return;
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const relX = (mouseX / rect.width) * CANVAS_WIDTH;
        this.paddleX = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, relX - PADDLE_WIDTH / 2));
      };
      this.canvas.addEventListener('mousemove', this.mouseHandler);

      this.touchHandler = (e) => {
        if (!this.gameStarted || this.gameOver) return;
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const touchX = e.touches[0].clientX - rect.left;
        const relX = (touchX / rect.width) * CANVAS_WIDTH;
        this.paddleX = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, relX - PADDLE_WIDTH / 2));
      };
      this.canvas.addEventListener('touchmove', this.touchHandler, { passive: false });
    }

    restart() {
      this.gameOver = false;
      this.resetGame();
      this.removeOverlay();
      this.audio.playBGM('breakout');
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
      title.textContent = this.score > 0 ? '클리어!' : '게임 종료';
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
      // 패들 이동 (키보드)
      if (this.keys.left) {
        this.paddleX = Math.max(0, this.paddleX - PADDLE_SPEED);
      }
      if (this.keys.right) {
        this.paddleX = Math.min(CANVAS_WIDTH - PADDLE_WIDTH, this.paddleX + PADDLE_SPEED);
      }

      // 공 이동
      this.ballX += this.ballDX;
      this.ballY += this.ballDY;

      // 벽 충돌 (좌우)
      if (this.ballX - BALL_RADIUS < 0 || this.ballX + BALL_RADIUS > CANVAS_WIDTH) {
        this.ballDX = -this.ballDX;
        this.audio.playSFX('move');
      }

      // 천장 충돌
      if (this.ballY - BALL_RADIUS < 0) {
        this.ballDY = -this.ballDY;
        this.audio.playSFX('move');
      }

      // 바닥 — 생명 감소
      if (this.ballY + BALL_RADIUS > CANVAS_HEIGHT) {
        this.lives--;
        this.audio.playSFX('invalid');
        if (this.lives <= 0) {
          this.gameOver = true;
          this.audio.stopBGM();
          this.audio.playSFX('gameover');
          this.showGameOverUI();
          return;
        }
        // 공 리셋
        this.ballX = CANVAS_WIDTH / 2;
        this.ballY = CANVAS_HEIGHT - 40;
        this.ballDX = 3;
        this.ballDY = -3;
        return;
      }

      // 패들 충돌
      const paddleTop = CANVAS_HEIGHT - 24;
      if (
        this.ballY + BALL_RADIUS >= paddleTop &&
        this.ballY + BALL_RADIUS <= paddleTop + PADDLE_HEIGHT &&
        this.ballX >= this.paddleX &&
        this.ballX <= this.paddleX + PADDLE_WIDTH
      ) {
        // 패들 어디에 맞았는지에 따라 각도 변경
        const hitPos = (this.ballX - this.paddleX) / PADDLE_WIDTH; // 0~1
        this.ballDX = hitPos * 8 - 4; // -4 ~ 4
        this.ballDY = -Math.abs(this.ballDY);
        this.audio.playSFX('select');
      }

      // 벽돌 충돌
      let bricksRemaining = 0;
      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        bricksRemaining++;

        if (
          this.ballX + BALL_RADIUS > brick.x &&
          this.ballX - BALL_RADIUS < brick.x + brick.w &&
          this.ballY + BALL_RADIUS > brick.y &&
          this.ballY - BALL_RADIUS < brick.y + brick.h
        ) {
          brick.alive = false;
          this.ballDY = -this.ballDY;
          this.score += 10;
          this.audio.playSFX('clear');
          break; // 한 프레임에 한 벽돌만
        }
      }

      // 모든 벽돌 클리어
      if (bricksRemaining === 0) {
        this.gameOver = true;
        this.audio.stopBGM();
        this.audio.playSFX('clear');
        this.showGameOverUI();
      }
    }

    draw() {
      const { ctx } = this;
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 배경
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 벽돌
      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        ctx.fillStyle = brick.color;
        ctx.beginPath();
        ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 3);
        ctx.fill();

        // 하이라이트
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h / 2);
      }

      // 패들
      const paddleTop = CANVAS_HEIGHT - 24;
      const gradient = ctx.createLinearGradient(this.paddleX, paddleTop, this.paddleX, paddleTop + PADDLE_HEIGHT);
      gradient.addColorStop(0, '#60a5fa');
      gradient.addColorStop(1, '#3b82f6');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(this.paddleX, paddleTop, PADDLE_WIDTH, PADDLE_HEIGHT, 6);
      ctx.fill();

      // 공
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.ballX, this.ballY, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // 공 글로우
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(this.ballX, this.ballY, BALL_RADIUS + 4, 0, Math.PI * 2);
      ctx.fill();

      // HUD
      this.scoreEl.textContent = '점수: ' + this.score + '  |  생명: ' + '❤️'.repeat(this.lives);
    }

    update(timestamp = 0) {
      if (this.gameOver) {
        this.draw();
        return;
      }

      this.tick();
      this.draw();
      this.animationId = requestAnimationFrame((ts) => this.update(ts));
    }

    destroy() {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
      if (this.mouseHandler) this.canvas.removeEventListener('mousemove', this.mouseHandler);
      if (this.touchHandler) this.canvas.removeEventListener('touchmove', this.touchHandler);
      this.audio.destroy();
      this.container.innerHTML = '';
    }
  }
})();
