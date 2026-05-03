/**
 * Simon Says — 색 패턴 기억 게임
 *
 * GameRegistry.register() 로 등록되며,
 * init(container) 메서드가 호출됩니다.
 */
(function () {
  'use strict';

  // ===== 상수 =====
  const COLORS = ['#e94560', '#0f3460', '#16c79a', '#f5a623'];

  // ===== GameRegistry 등록 =====
  GameRegistry.register({
    id: 'simon-says',
    name: '시몬 Says',
    description: '색 패턴을 기억하고 반복하세요!',
    init(container) {
      return new SimonSays(container);
    },
  });

  // ===== 게임 클래스 =====
  class SimonSays {
    constructor(container) {
      this.container = container;
      this.gameStarted = false;
      this.gameOver = false;
      this.animationId = null;
      this._overlay = null;

      this.audio = new GameAudio();
      this.sequence = [];
      this.playerIndex = 0;
      this.score = 0;
      this.isShowing = false;

      this.canvas = document.createElement('canvas');
      this.canvas.width = 400;
      this.canvas.height = 400;
      this.canvas.style.border = '2px solid var(--color-primary)';
      this.canvas.style.borderRadius = '4px';
      this.container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      this.showWaitingScreen();
      this.bindKeys();
      this.bindClicks();
    }

    // ===== 대기화면 =====
    showWaitingScreen() {
      const { ctx, canvas } = this;
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#eee';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🎨 시몬 Says', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '16px sans-serif';
      ctx.fillText('Enter 또는 Space를 눌러 시작하세요', canvas.width / 2, canvas.height / 2 + 10);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('색 패턴을 기억하고 클릭하세요', canvas.width / 2, canvas.height / 2 + 40);
    }

    // ===== 게임 초기화 =====
    resetGame() {
      this.sequence = [];
      this.playerIndex = 0;
      this.score = 0;
      this.isShowing = false;

      if (!this.scoreEl) {
        this.scoreEl = document.createElement('div');
        this.scoreEl.style.cssText =
          'margin-top:0.5rem;font-size:1.1rem;color:var(--color-text)';
        this.container.appendChild(this.scoreEl);
      }
      this.updateScore();
    }

    updateScore() {
      if (this.scoreEl) {
        this.scoreEl.textContent = `Round: ${this.score}`;
      }
    }

    // ===== 키 바인딩 =====
    bindKeys() {
      this.keyHandler = (e) => {
        if (!this.gameStarted && (e.key === 'Enter' || e.key === ' ')) {
          this.audio.init();
          this.audio.playSFX('start');
          this.audio.playBGM('memory');
          this.gameStarted = true;
          this.resetGame();
          this.nextRound();
          e.preventDefault();
          return;
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }

    // ===== 클릭 바인딩 =====
    bindClicks() {
      this.clickHandler = (e) => {
        if (!this.gameStarted || this.isShowing || this.gameOver) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const clicked = this.getClickedQuad(x, y);

        if (clicked === -1) return;

        this.flashQuad(clicked, 250);
        this.audio.playSFX('select');

        if (this.sequence[this.playerIndex] === clicked) {
          this.playerIndex++;

          if (this.playerIndex === this.sequence.length) {
            this.score++;
            this.updateScore();
            this.audio.playSFX('clear');
            this.playerIndex = 0;
            setTimeout(() => this.nextRound(), 600);
          }
        } else {
          this.audio.playSFX('invalid');
          this.gameOverAction();
        }
      };
      this.canvas.addEventListener('click', this.clickHandler);
    }

    // ===== 사분면 감지 =====
    getClickedQuad(x, y) {
      const cx = 200, cy = 200, gap = 16;
      const half = (cx - gap / 2);

      if (x < half && y < half) return 0; // top-left
      if (x >= half && y < half) return 1; // top-right
      if (x < half && y >= half) return 2; // bottom-left
      if (x >= half && y >= half) return 3; // bottom-right
      return -1;
    }

    // ===== 라운드 진행 =====
    nextRound() {
      const color = Math.floor(Math.random() * 4);
      this.sequence.push(color);
      this.isShowing = true;
      this.playerIndex = 0;

      this.playSequence();
    }

    playSequence() {
      let i = 0;
      const interval = setInterval(() => {
        if (i >= this.sequence.length) {
          clearInterval(interval);
          this.isShowing = false;
          return;
        }
        this.flashQuad(this.sequence[i], 400);
        i++;
      }, 600);
    }

    // ===== 깜빡임 효과 =====
    flashQuad(index, duration) {
      this.drawBoard(index, 1.0);
      if (this.animationId) cancelAnimationFrame(this.animationId);

      const startTime = performance.now();
      const animate = (time) => {
        const elapsed = time - startTime;
        if (elapsed >= duration) {
          this.drawBoard(-1, 0);
          return;
        }
        const alpha = 1.0 - (elapsed / duration);
        this.drawBoard(index, alpha);
        this.animationId = requestAnimationFrame(animate);
      };
      this.animationId = requestAnimationFrame(animate);
    }

    // ===== 보드 렌더링 =====
    drawBoard(highlight, intensity) {
      const { ctx, canvas } = this;
      const cx = 200, cy = 200, gap = 16;
      const size = cx - gap / 2;

      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const positions = [
        { x: gap / 2, y: gap / 2 },
        { x: cx + gap / 2, y: gap / 2 },
        { x: gap / 2, y: cy + gap / 2 },
        { x: cx + gap / 2, y: cy + gap / 2 },
      ];

      for (let i = 0; i < 4; i++) {
        const pos = positions[i];
        const isHighlighted = i === highlight;

        if (isHighlighted && intensity > 0) {
          ctx.fillStyle = COLORS[i];
          ctx.globalAlpha = 0.4 + intensity * 0.6;
        } else {
          ctx.fillStyle = COLORS[i];
          ctx.globalAlpha = 0.45;
        }

        this.roundRect(ctx, pos.x, pos.y, size, size, 12);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // Center circle
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.fillStyle = '#222';
      ctx.fill();
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    // ===== 게임 오버 =====
    gameOverAction() {
      this.gameOver = true;
      this.audio.stopBGM();
      this.audio.playSFX('gameover');
      this.showGameOverUI();
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

    showGameOverUI() {
      const title = document.createElement('div');
      title.textContent = 'GAME OVER';
      title.style.cssText = 'color:#e94560;font:bold 28px sans-serif;margin-bottom:0.3rem';

      const score = document.createElement('div');
      score.textContent = `Round: ${this.score}`;
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
      this.gameStarted = true;
      this.audio.playBGM('memory');
      this.removeOverlay();
      this.resetGame();
      this.nextRound();
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

    // ===== 리소스 정리 =====
    destroy() {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
      if (this.clickHandler) this.canvas.removeEventListener('click', this.clickHandler);
      this.audio.destroy();
      this.removeOverlay();
      if (this.scoreEl) this.scoreEl.remove();
      this.container.innerHTML = '';
    }
  }
})();
