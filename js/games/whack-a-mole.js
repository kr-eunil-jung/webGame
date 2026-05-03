/**
 * Whack-a-Mole — 두더지치기 게임
 *
 * GameRegistry.register() 로 등록되며,
 * init(container) 메서드가 호출됩니다.
 */
(function () {
  'use strict';

  // ===== 상수 =====
  const GRID_COLS = 3;
  const GRID_ROWS = 3;
  const HOLE_SIZE = 80;
  const GAP = 16;
  const CANVAS_WIDTH = GRID_COLS * (HOLE_SIZE + GAP) - GAP + 20;
  const CANVAS_HEIGHT = GRID_ROWS * (HOLE_SIZE + GAP) - GAP + 60;
  const GAME_DURATION = 30; // seconds
  const MOLE_MIN_SHOW = 400;
  const MOLE_MAX_SHOW = 1000;

  // ===== GameRegistry 등록 =====
  GameRegistry.register({
    id: 'whack-a-mole',
    name: '두더지치기',
    description: '두더지를 클릭해서 점수를 얻으세요!',
    init(container) {
      return new WhackAMole(container);
    },
  });

  // ===== 게임 클래스 =====
  class WhackAMole {
    constructor(container) {
      this.container = container;
      this.canvas = document.createElement('canvas');
      this.canvas.width = CANVAS_WIDTH;
      this.canvas.height = CANVAS_HEIGHT;
      this.canvas.style.border = '2px solid var(--color-primary)';
      this.canvas.style.borderRadius = '4px';
      this.canvas.style.cursor = 'pointer';
      this.ctx = this.canvas.getContext('2d');

      this.gameStarted = false;
      this.gameOver = false;
      this.animationId = null;
      this._overlay = null;

      this.audio = new GameAudio();

      this.container.appendChild(this.canvas);

      this.showWaitingScreen();
      this.bindKeys();
      this.bindClick();
    }

    // ===== 대기화면 =====
    showWaitingScreen() {
      const { ctx, canvas } = this;
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#eee';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🐹 두더지치기', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '16px sans-serif';
      ctx.fillText('Enter 또는 Space를 눌러 시작하세요', canvas.width / 2, canvas.height / 2 + 10);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('두더지가 나타나면 클릭하세요!', canvas.width / 2, canvas.height / 2 + 40);
    }

    resetGame() {
      this.score = 0;
      this.misses = 0;
      this.timeLeft = GAME_DURATION;
      this.lastTime = 0;
      this.moleTimer = 0;
      this.moleInterval = 800;
      this.holes = [];

      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          this.holes.push({
            row: r,
            col: c,
            x: 10 + c * (HOLE_SIZE + GAP),
            y: 30 + r * (HOLE_SIZE + GAP),
            moleState: 0, // 0=hidden, 0-1=appearing, 1=visible, 1-0=disappearing
            moleTarget: 0,
            moleSpeed: 0,
            showTime: 0,
            isShowing: false,
          });
        }
      }

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
      };
      window.addEventListener('keydown', this.keyHandler);
    }

    bindClick() {
      this.clickHandler = (e) => {
        if (!this.gameStarted || this.gameOver) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;

        for (const hole of this.holes) {
          if (
            mx >= hole.x &&
            mx <= hole.x + HOLE_SIZE &&
            my >= hole.y &&
            my <= hole.y + HOLE_SIZE
          ) {
            if (hole.isShowing && hole.moleState >= 0.8) {
              // Hit!
              this.score += 10;
              this.audio.playSFX('eat');
              hole.isShowing = false;
              hole.moleTarget = 0;
              hole.moleSpeed = 0.08;
            } else if (!hole.isShowing && hole.moleState < 0.1) {
              // Miss (clicked empty hole)
              this.misses++;
              this.audio.playSFX('invalid');
            }
            break;
          }
        }
      };
      this.canvas.addEventListener('click', this.clickHandler);
    }

    spawnMole() {
      const hidden = this.holes.filter((h) => !h.isShowing && h.moleState < 0.1);
      if (hidden.length === 0) return;

      const hole = hidden[Math.floor(Math.random() * hidden.length)];
      hole.isShowing = true;
      hole.moleTarget = 1;
      hole.moleSpeed = 0.08;
      hole.showTime = MOLE_MIN_SHOW + Math.random() * (MOLE_MAX_SHOW - MOLE_MIN_SHOW);
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
      title.textContent = '게임 종료';
      title.style.cssText = 'color:#e94560;font:bold 28px sans-serif;margin-bottom:0.3rem';

      const score = document.createElement('div');
      score.textContent = '점수: ' + this.score + '  |  실패: ' + this.misses;
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

    update(timestamp = 0) {
      if (this.gameOver) {
        this.draw();
        return;
      }

      const dt = this.lastTime ? timestamp - this.lastTime : 0;
      this.lastTime = timestamp;

      // Timer countdown
      if (this.gameStarted) {
        this.timeLeft -= dt / 1000;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.gameOver = true;
          this.audio.stopBGM();
          this.audio.playSFX('gameover');
          this.draw();
          this.showGameOverUI();
          return;
        }

        // Spawn moles
        this.moleTimer += dt;
        // Speed up as time decreases
        const currentInterval = Math.max(400, this.moleInterval - (GAME_DURATION - this.timeLeft) * 15);
        if (this.moleTimer >= currentInterval) {
          this.moleTimer = 0;
          this.spawnMole();
        }
      }

      // Update mole animations
      for (const hole of this.holes) {
        if (hole.isShowing && hole.moleState < 1) {
          hole.moleState = Math.min(1, hole.moleState + hole.moleSpeed);
        } else if (!hole.isShowing && hole.moleState > 0) {
          hole.moleState = Math.max(0, hole.moleState - hole.moleSpeed);
          // Auto-hide after show time
        }

        if (hole.isShowing) {
          hole.showTime -= dt;
          if (hole.showTime <= 0) {
            hole.isShowing = false;
            hole.moleTarget = 0;
            hole.moleSpeed = 0.06;
          }
        }
      }

      this.draw();
      this.animationId = requestAnimationFrame((ts) => this.update(ts));
    }

    draw() {
      const { ctx, canvas } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw holes and moles
      for (const hole of this.holes) {
        this.drawHole(ctx, hole);
      }

      // HUD
      ctx.fillStyle = '#eee';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('점수: ' + this.score, 10, canvas.height - 10);
      ctx.textAlign = 'right';
      const timeText = Math.ceil(this.timeLeft) + '초';
      ctx.fillText(timeText, canvas.width - 10, canvas.height - 10);

      // Score element
      if (this.scoreEl) {
        this.scoreEl.textContent = '점수: ' + this.score + '  |  남은시간: ' + Math.ceil(this.timeLeft) + '초';
      }
    }

    drawHole(ctx, hole) {
      const { x, y, moleState } = hole;
      const cx = x + HOLE_SIZE / 2;
      const cy = y + HOLE_SIZE / 2;

      // Dirt mound (hole background)
      ctx.fillStyle = '#3d2b1f';
      ctx.beginPath();
      ctx.ellipse(cx, y + HOLE_SIZE - 5, HOLE_SIZE / 2 + 4, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hole interior
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.ellipse(cx, y + HOLE_SIZE - 10, HOLE_SIZE / 2 - 4, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Mole (animated)
      if (moleState > 0.01) {
        const moleY = cy - moleState * 25;
        const moleRadius = (HOLE_SIZE / 2 - 8) * moleState;

        // Mole body
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.arc(cx, moleY, moleRadius, 0, Math.PI * 2);
        ctx.fill();

        // Mole nose
        if (moleState > 0.5) {
          ctx.fillStyle = '#ff6b6b';
          ctx.beginPath();
          ctx.arc(cx, moleY - moleRadius * 0.15, moleRadius * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Mole eyes
        if (moleState > 0.6) {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(cx - moleRadius * 0.3, moleY - moleRadius * 0.35, moleRadius * 0.15, 0, Math.PI * 2);
          ctx.arc(cx + moleRadius * 0.3, moleY - moleRadius * 0.35, moleRadius * 0.15, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.arc(cx - moleRadius * 0.3, moleY - moleRadius * 0.35, moleRadius * 0.08, 0, Math.PI * 2);
          ctx.arc(cx + moleRadius * 0.3, moleY - moleRadius * 0.35, moleRadius * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    destroy() {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
      if (this.clickHandler) this.canvas.removeEventListener('click', this.clickHandler);
      this.audio.destroy();
      this.container.innerHTML = '';
    }
  }
})();
