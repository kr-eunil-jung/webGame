/**
 * Pong — 클래식 pong 게임
 *
 * GameRegistry.register() 로 등록되며,
 * init(container) 메서드가 호출됩니다.
 */
(function () {
  'use strict';

  // ===== 상수 =====
  const CANVAS_W = 480;
  const CANVAS_H = 360;
  const PADDLE_W = 10;
  const PADDLE_H = 70;
  const BALL_SIZE = 8;
  const PADDLE_SPEED = 6;
  const INITIAL_BALL_SPEED = 4;
  const AI_SPEED = 3.5;

  // ===== GameRegistry 등록 =====
  GameRegistry.register({
    id: 'pong',
    name: 'Pong',
    description: '클래식 Pong — AI와 맞서세요!',
    init(container) {
      return new PongGame(container);
    },
  });

  // ===== 게임 클래스 =====
  class PongGame {
    constructor(container) {
      this.container = container;
      this.canvas = document.createElement('canvas');
      this.canvas.width = CANVAS_W;
      this.canvas.height = CANVAS_H;
      this.canvas.style.border = '2px solid var(--color-primary)';
      this.canvas.style.borderRadius = '4px';
      this.ctx = this.canvas.getContext('2d');

      this.gameStarted = false;
      this.gameOver = false;
      this.animationId = null;
      this._overlay = null;

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
      ctx.fillText('🏓 Pong', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '16px sans-serif';
      ctx.fillText('Enter 또는 Space를 눌러 시작하세요', canvas.width / 2, canvas.height / 2 + 10);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('↑ ↓ 키로 패들을 움직이세요', canvas.width / 2, canvas.height / 2 + 40);
    }

    resetGame() {
      this.playerY = CANVAS_H / 2 - PADDLE_H / 2;
      this.aiY = CANVAS_H / 2 - PADDLE_H / 2;
      this.playerScore = 0;
      this.aiScore = 0;
      this.keys = { up: false, down: false };
      this.maxScore = 7;
      this.spawnBall();

      // Score display
      if (!this.scoreEl) {
        this.scoreEl = document.createElement('div');
        this.scoreEl.style.cssText =
          'margin-top:0.5rem;font-size:1.1rem;color:var(--color-text)';
        this.container.appendChild(this.scoreEl);
      }
    }

    spawnBall() {
      const angle = (Math.random() * Math.PI / 3) - Math.PI / 6; // -30° ~ +30°
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.ball = {
        x: CANVAS_W / 2 - BALL_SIZE / 2,
        y: CANVAS_H / 2 - BALL_SIZE / 2,
        vx: dir * INITIAL_BALL_SPEED * Math.cos(angle),
        vy: INITIAL_BALL_SPEED * Math.sin(angle),
      };
    }

    bindKeys() {
      this.keyDownHandler = (e) => {
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

        if (e.key === 'ArrowUp' || e.key === 'w') {
          this.keys.up = true;
          e.preventDefault();
        }
        if (e.key === 'ArrowDown' || e.key === 's') {
          this.keys.down = true;
          e.preventDefault();
        }
      };

      this.keyUpHandler = (e) => {
        if (e.key === 'ArrowUp' || e.key === 'w') this.keys.up = false;
        if (e.key === 'ArrowDown' || e.key === 's') this.keys.down = false;
      };

      window.addEventListener('keydown', this.keyDownHandler);
      window.addEventListener('keyup', this.keyUpHandler);
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
      title.textContent = this.playerScore >= this.maxScore ? '승리!' : '패배!';
      title.style.cssText = 'color:#e94560;font:bold 28px sans-serif;margin-bottom:0.3rem';

      const score = document.createElement('div');
      score.textContent = this.playerScore + ' : ' + this.aiScore;
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
      // Player paddle movement
      if (this.keys.up) this.playerY -= PADDLE_SPEED;
      if (this.keys.down) this.playerY += PADDLE_SPEED;
      this.playerY = Math.max(0, Math.min(CANVAS_H - PADDLE_H, this.playerY));

      // AI paddle movement (follow ball with limited speed)
      const aiCenter = this.aiY + PADDLE_H / 2;
      const ballTarget = this.ball.y;
      if (aiCenter < ballTarget - 10) {
        this.aiY += AI_SPEED;
      } else if (aiCenter > ballTarget + 10) {
        this.aiY -= AI_SPEED;
      }
      this.aiY = Math.max(0, Math.min(CANVAS_H - PADDLE_H, this.aiY));

      // Ball movement
      this.ball.x += this.ball.vx;
      this.ball.y += this.ball.vy;

      // Top/bottom wall collision
      if (this.ball.y <= 0) {
        this.ball.y = 0;
        this.ball.vy *= -1;
      }
      if (this.ball.y + BALL_SIZE >= CANVAS_H) {
        this.ball.y = CANVAS_H - BALL_SIZE;
        this.ball.vy *= -1;
      }

      // Player paddle collision (left side)
      if (
        this.ball.x <= PADDLE_W + 10 &&
        this.ball.x >= PADDLE_W + 10 - BALL_SIZE &&
        this.ball.y + BALL_SIZE >= this.playerY &&
        this.ball.y <= this.playerY + PADDLE_H &&
        this.ball.vx < 0
      ) {
        this.ball.x = PADDLE_W + 10;
        const hitPos = (this.ball.y + BALL_SIZE / 2 - this.playerY) / PADDLE_H; // 0~1
        const angle = (hitPos - 0.5) * Math.PI * 0.6; // -54° ~ +54°
        const speed = Math.sqrt(this.ball.vx ** 2 + this.ball.vy ** 2) * 1.05;
        const cappedSpeed = Math.min(speed, 10);
        this.ball.vx = cappedSpeed * Math.cos(angle);
        this.ball.vy = cappedSpeed * Math.sin(angle);
        this.audio.playSFX('move');
      }

      // AI paddle collision (right side)
      const aiPaddleX = CANVAS_W - PADDLE_W - 10;
      if (
        this.ball.x + BALL_SIZE >= aiPaddleX &&
        this.ball.x + BALL_SIZE <= aiPaddleX + BALL_SIZE &&
        this.ball.y + BALL_SIZE >= this.aiY &&
        this.ball.y <= this.aiY + PADDLE_H &&
        this.ball.vx > 0
      ) {
        this.ball.x = aiPaddleX - BALL_SIZE;
        const hitPos = (this.ball.y + BALL_SIZE / 2 - this.aiY) / PADDLE_H;
        const angle = (hitPos - 0.5) * Math.PI * 0.6;
        const speed = Math.sqrt(this.ball.vx ** 2 + this.ball.vy ** 2) * 1.05;
        const cappedSpeed = Math.min(speed, 10);
        this.ball.vx = -cappedSpeed * Math.cos(angle);
        this.ball.vy = cappedSpeed * Math.sin(angle);
        this.audio.playSFX('move');
      }

      // Scoring
      if (this.ball.x + BALL_SIZE < 0) {
        // AI scores
        this.aiScore++;
        this.audio.playSFX('invalid');
        if (this.aiScore >= this.maxScore) {
          this.gameOver = true;
          this.audio.stopBGM();
          this.audio.playSFX('gameover');
          this.showGameOverUI();
        } else {
          this.spawnBall();
        }
      }
      if (this.ball.x > CANVAS_W) {
        // Player scores
        this.playerScore++;
        this.audio.playSFX('clear');
        if (this.playerScore >= this.maxScore) {
          this.gameOver = true;
          this.audio.stopBGM();
          this.audio.playSFX('start');
          this.showGameOverUI();
        } else {
          this.spawnBall();
        }
      }
    }

    draw() {
      const { ctx } = this;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Background
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Center line
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(CANVAS_W / 2, 0);
      ctx.lineTo(CANVAS_W / 2, CANVAS_H);
      ctx.stroke();
      ctx.setLineDash([]);

      // Scores on canvas
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.playerScore, CANVAS_W / 4, 70);
      ctx.fillText(this.aiScore, (CANVAS_W * 3) / 4, 70);

      // Player paddle (left)
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(PADDLE_W + 10, this.playerY, PADDLE_W, PADDLE_H);

      // AI paddle (right)
      ctx.fillStyle = '#e94560';
      ctx.fillRect(CANVAS_W - PADDLE_W - 10, this.aiY, PADDLE_W, PADDLE_H);

      // Ball
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(
        this.ball.x + BALL_SIZE / 2,
        this.ball.y + BALL_SIZE / 2,
        BALL_SIZE / 2,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Score display below canvas
      this.scoreEl.textContent = '플레이어: ' + this.playerScore + '  |  AI: ' + this.aiScore + '  (먼저 ' + this.maxScore + '점)';
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
      if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler);
      if (this.keyUpHandler) window.removeEventListener('keyup', this.keyUpHandler);
      this.audio.destroy();
      this.container.innerHTML = '';
    }
  }
})();
