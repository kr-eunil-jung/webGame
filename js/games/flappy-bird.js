/**
 * Flappy Bird — 플러피 버드 게임
 *
 * GameRegistry.register() 로 등록되며,
 * init(container) 메서드가 호출됩니다.
 */
(function () {
  'use strict';

  // ===== 상수 =====
  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 500;
  const GRAVITY = 0.45;
  const JUMP_FORCE = -7.5;
  const PIPE_WIDTH = 52;
  const PIPE_GAP = 145;
  const PIPE_SPEED = 2.5;
  const PIPE_INTERVAL = 1600;
  const BIRD_SIZE = 20;
  const GROUND_HEIGHT = 50;

  // ===== GameRegistry 등록 =====
  GameRegistry.register({
    id: 'flappy-bird',
    name: 'Flappy Bird',
    description: '관문을 통과하며 최고 기록을 도전하세요!',
    init(container) {
      return new FlappyBird(container);
    },
  });

  // ===== 게임 클래스 =====
  class FlappyBird {
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

      this.audio = new GameAudio();

      this.container.appendChild(this.canvas);

      this.showWaitingScreen();
      this.bindKeys();
    }

    // ===== 대기화면 =====
    showWaitingScreen() {
      const { ctx, canvas } = this;
      this.drawBackground(ctx);
      ctx.fillStyle = '#eee';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🐦 Flappy Bird', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '16px sans-serif';
      ctx.fillText('Enter 또는 Space를 눌러 시작하세요', canvas.width / 2, canvas.height / 2 + 10);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('Space 또는 클릭으로 날으세요', canvas.width / 2, canvas.height / 2 + 40);
    }

    resetGame() {
      this.bird = {
        x: 80,
        y: CANVAS_HEIGHT / 2 - 20,
        vy: 0,
      };
      this.pipes = [];
      this.score = 0;
      this.bestScore = this.bestScore || 0;
      this.lastPipeTime = 0;
      this.groundX = 0;

      // Score display
      if (!this.scoreEl) {
        this.scoreEl = document.createElement('div');
        this.scoreEl.style.cssText =
          'margin-top:0.5rem;font-size:1.1rem;color:var(--color-text)';
        this.container.appendChild(this.scoreEl);
      }
    }

    bindKeys() {
      this.keyHandler = (e) => {
        // 대기화면에서 Enter/Space 누르면 게임 시작
        if (!this.gameStarted && (e.key === 'Enter' || e.key === ' ')) {
          this.audio.init();
          this.audio.playSFX('start');
          this.audio.playBGM('fruitbox');
          this.gameStarted = true;
          this.resetGame();
          this.lastTime = performance.now();
          this.update(this.lastTime);
          e.preventDefault();
          return;
        }

        if (this.gameOver) return;

        if (e.key === ' ' || e.key === 'ArrowUp') {
          this.jump();
          e.preventDefault();
        }
      };
      window.addEventListener('keydown', this.keyHandler);

      // Click / touch to jump
      this.clickHandler = (e) => {
        if (!this.gameStarted || this.gameOver) return;
        this.jump();
      };
      this.canvas.addEventListener('mousedown', this.clickHandler);
      this.canvas.addEventListener('touchstart', this.clickHandler);
    }

    jump() {
      this.bird.vy = JUMP_FORCE;
      this.audio.playSFX('move');
    }

    spawnPipe(time) {
      if (time - this.lastPipeTime > PIPE_INTERVAL) {
        const minTop = 60;
        const maxTop = CANVAS_HEIGHT - GROUND_HEIGHT - PIPE_GAP - 60;
        const topHeight = minTop + Math.random() * (maxTop - minTop);

        this.pipes.push({
          x: CANVAS_WIDTH,
          topHeight: topHeight,
          scored: false,
        });
        this.lastPipeTime = time;
      }
    }

    update(timestamp) {
      if (this.gameOver) {
        this.draw();
        return;
      }

      const dt = Math.min((timestamp - this.lastTime) / 16.667, 2);
      this.lastTime = timestamp;

      // Bird physics
      this.bird.vy += GRAVITY * dt;
      this.bird.y += this.bird.vy * dt;

      // Spawn pipes
      this.spawnPipe(timestamp);

      // Move pipes
      for (let i = this.pipes.length - 1; i >= 0; i--) {
        const pipe = this.pipes[i];
        pipe.x -= PIPE_SPEED * dt;

        // Score
        if (!pipe.scored && pipe.x + PIPE_WIDTH < this.bird.x) {
          pipe.scored = true;
          this.score++;
          this.audio.playSFX('clear');
        }

        // Remove off-screen pipes
        if (pipe.x + PIPE_WIDTH < -10) {
          this.pipes.splice(i, 1);
        }
      }

      // Ground scroll
      this.groundX = (this.groundX - PIPE_SPEED * dt) % 24;

      // Collision detection
      this.checkCollision();

      this.draw();
      this.animationId = requestAnimationFrame((ts) => this.update(ts));
    }

    checkCollision() {
      const bird = this.bird;
      const birdLeft = bird.x - BIRD_SIZE / 2;
      const birdRight = bird.x + BIRD_SIZE / 2;
      const birdTop = bird.y - BIRD_SIZE / 2;
      const birdBottom = bird.y + BIRD_SIZE / 2;

      // Ground or ceiling
      if (birdBottom >= CANVAS_HEIGHT - GROUND_HEIGHT || birdTop <= 0) {
        this.endGame();
        return;
      }

      // Pipes
      for (const pipe of this.pipes) {
        const pipeLeft = pipe.x;
        const pipeRight = pipe.x + PIPE_WIDTH;

        if (birdRight > pipeLeft && birdLeft < pipeRight) {
          if (birdTop < pipe.topHeight || birdBottom > pipe.topHeight + PIPE_GAP) {
            this.endGame();
            return;
          }
        }
      }
    }

    endGame() {
      this.gameOver = true;
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
      }
      this.audio.stopBGM();
      this.audio.playSFX('gameover');
      this.showGameOverUI();
    }

    restart() {
      this.gameOver = false;
      this.resetGame();
      this.removeOverlay();
      this.audio.playBGM('fruitbox');
      this.lastTime = performance.now();
      this.update(this.lastTime);
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
      score.textContent = '점수: ' + this.score + '  |  최고: ' + this.bestScore;
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

    // ===== 렌더링 =====
    drawBackground(ctx) {
      // Sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT - GROUND_HEIGHT);
      grad.addColorStop(0, '#4dc9f6');
      grad.addColorStop(1, '#87ceeb');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_HEIGHT);

      // Ground
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, 12);

      // Ground pattern
      ctx.fillStyle = '#7a3b10';
      for (let x = this.groundX; x < CANVAS_WIDTH; x += 24) {
        ctx.fillRect(x, CANVAS_HEIGHT - GROUND_HEIGHT + 12, 12, 4);
      }
    }

    drawPipe(ctx, pipe) {
      const bottomY = pipe.topHeight + PIPE_GAP;
      const bottomHeight = CANVAS_HEIGHT - GROUND_HEIGHT - bottomY;

      // Pipe body
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
      ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, bottomHeight);

      // Pipe cap
      ctx.fillStyle = '#66BB6A';
      ctx.fillRect(pipe.x - 4, pipe.topHeight - 24, PIPE_WIDTH + 8, 24);
      ctx.fillRect(pipe.x - 4, bottomY, PIPE_WIDTH + 8, 24);

      // Pipe border
      ctx.strokeStyle = '#2E7D32';
      ctx.lineWidth = 2;
      ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
      ctx.strokeRect(pipe.x, bottomY, PIPE_WIDTH, bottomHeight);
    }

    drawBird(ctx) {
      const { x, y } = this.bird;

      // Body
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(x, y, BIRD_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#E6A800';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Eye
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + 4, y - 4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x + 6, y - 4, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = '#FF6B35';
      ctx.beginPath();
      ctx.moveTo(x + BIRD_SIZE / 2, y - 2);
      ctx.lineTo(x + BIRD_SIZE / 2 + 8, y + 2);
      ctx.lineTo(x + BIRD_SIZE / 2, y + 6);
      ctx.closePath();
      ctx.fill();

      // Wing
      ctx.fillStyle = '#F0C400';
      ctx.beginPath();
      ctx.ellipse(x - 4, y + 4, 8, 5, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    drawScore(ctx) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText(this.score, CANVAS_WIDTH / 2, 50);
      ctx.fillText(this.score, CANVAS_WIDTH / 2, 50);
    }

    draw() {
      const { ctx } = this;

      this.drawBackground(ctx);

      // Pipes
      for (const pipe of this.pipes) {
        this.drawPipe(ctx, pipe);
      }

      // Bird
      this.drawBird(ctx);

      // Score
      if (this.gameStarted) {
        this.drawScore(ctx);
      }

      // Score element below canvas
      if (this.scoreEl) {
        this.scoreEl.textContent = '점수: ' + this.score + '  |  최고 기록: ' + this.bestScore;
      }
    }

    destroy() {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
      if (this.clickHandler) {
        this.canvas.removeEventListener('mousedown', this.clickHandler);
        this.canvas.removeEventListener('touchstart', this.clickHandler);
      }
      this.audio.destroy();
      this.container.innerHTML = '';
    }
  }
})();
