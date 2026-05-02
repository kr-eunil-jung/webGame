/**
 * MemoryCard — 메모리 카드 매칭 게임
 *
 * GameRegistry.register() 로 등록되며,
 * init(container) 메서드가 호출됩니다.
 */
(function () {
  'use strict';

  // ===== 상수 =====
  const COLS = 4;
  const ROWS = 4;
  const CARD_W = 70;
  const CARD_H = 90;
  const GAP = 10;
  const CANVAS_W = COLS * (CARD_W + GAP) - GAP + 40;
  const CANVAS_H = ROWS * (CARD_H + GAP) - GAP + 80;

  // 카드 심볼 (이모지)
  const SYMBOLS = ['🎮', '🎲', '🎯', '🎪', '🎨', '🎭', '🎵', '🎸'];

  // ===== GameRegistry 등록 =====
  GameRegistry.register({
    id: 'memory-card',
    name: '메모리카드',
    description: '같은 그림 카드를 찾아 매칭하세요!',
    init(container) {
      return new MemoryCardGame(container);
    },
  });

  // ===== 게임 클래스 =====
  class MemoryCardGame {
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
      ctx.fillText('🃏 메모리카드', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '16px sans-serif';
      ctx.fillText('Enter 또는 Space를 눌러 시작하세요', canvas.width / 2, canvas.height / 2 + 10);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('마우스로 카드를 클릭하세요', canvas.width / 2, canvas.height / 2 + 40);
    }

    resetGame() {
      // 카드 쌍 생성
      const pairs = [...SYMBOLS, ...SYMBOLS];
      this.cards = this.shuffle(pairs).map((symbol, i) => ({
        symbol,
        index: i,
        revealed: false,
        matched: false,
      }));
      this.flipped = [];
      this.moves = 0;
      this.matchedCount = 0;
      this.locked = false;

      // 카드 위치 계산
      const offsetX = (CANVAS_W - (COLS * (CARD_W + GAP) - GAP)) / 2;
      const offsetY = 50;
      this.cardPositions = this.cards.map((_, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        return {
          x: offsetX + col * (CARD_W + GAP),
          y: offsetY + row * (CARD_H + GAP),
        };
      });

      // Score display
      if (!this.scoreEl) {
        this.scoreEl = document.createElement('div');
        this.scoreEl.style.cssText =
          'margin-top:0.5rem;font-size:1.1rem;color:var(--color-text)';
        this.container.appendChild(this.scoreEl);
      }

      // Click handler
      if (!this.clickHandler) {
        this.clickHandler = (e) => this.handleClick(e);
        this.canvas.addEventListener('click', this.clickHandler);
      }

      this.draw();
    }

    shuffle(array) {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    bindKeys() {
      this.keyHandler = (e) => {
        if (!this.gameStarted && (e.key === 'Enter' || e.key === ' ')) {
          this.audio.init();
          this.audio.playSFX('start');
          this.audio.playBGM('memory');
          this.gameStarted = true;
          this.resetGame();
          e.preventDefault();
          return;
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }

    handleClick(e) {
      if (this.gameOver || this.locked) return;

      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // 클릭한 카드 찾기
      for (let i = 0; i < this.cards.length; i++) {
        const card = this.cards[i];
        const pos = this.cardPositions[i];
        if (
          card.revealed ||
          card.matched ||
          mx < pos.x ||
          mx > pos.x + CARD_W ||
          my < pos.y ||
          my > pos.y + CARD_H
        )
          continue;

        // 카드 뒤집기
        card.revealed = true;
        this.flipped.push(i);
        this.audio.playSFX('select');
        this.draw();

        if (this.flipped.length === 2) {
          this.moves++;
          this.locked = true;
          this.checkMatch();
        }
        return;
      }
    }

    checkMatch() {
      const [i1, i2] = this.flipped;
      const c1 = this.cards[i1];
      const c2 = this.cards[i2];

      if (c1.symbol === c2.symbol) {
        // 매칭 성공
        c1.matched = true;
        c2.matched = true;
        this.matchedCount++;
        this.flipped = [];
        this.locked = false;
        this.audio.playSFX('clear');
        this.draw();

        // 전체 매칭 완료
        if (this.matchedCount === SYMBOLS.length) {
          this.gameOver = true;
          this.audio.stopBGM();
          this.audio.playSFX('start');
          setTimeout(() => this.showGameOverUI(), 500);
        }
      } else {
        // 매칭 실패
        this.audio.playSFX('invalid');
        setTimeout(() => {
          c1.revealed = false;
          c2.revealed = false;
          this.flipped = [];
          this.locked = false;
          this.draw();
        }, 800);
      }
    }

    restart() {
      this.gameOver = false;
      this.resetGame();
      this.removeOverlay();
      this.audio.playBGM('memory');
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
      title.textContent = '🎉 축하합니다!';
      title.style.cssText = 'color:#4ade80;font:bold 28px sans-serif;margin-bottom:0.3rem';

      const score = document.createElement('div');
      score.textContent = '횟수: ' + this.moves + '회';
      score.style.cssText = 'color:#eee;font:18px sans-serif;margin-bottom:0.8rem';

      const btnRestart = document.createElement('button');
      btnRestart.textContent = '다시 하기';
      btnRestart.style.cssText = `
        padding: 0.5rem 1.6rem; font: bold 15px sans-serif; cursor: pointer;
        border: none; border-radius: 4px; background: #4ade80; color: #111;
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

    draw() {
      const { ctx, canvas } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Cards
      this.cards.forEach((card, i) => {
        const pos = this.cardPositions[i];
        const x = pos.x;
        const y = pos.y;

        if (card.matched) {
          // 매칭된 카드 — 연한 배경
          ctx.fillStyle = '#1a3a2a';
          ctx.strokeStyle = '#4ade80';
          ctx.lineWidth = 2;
        } else if (card.revealed) {
          // 뒤집힌 카드
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 2;
        } else {
          // 덮인 카드
          ctx.fillStyle = '#334155';
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 1;
        }

        // Card body (rounded rect)
        const r = 6;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + CARD_W - r, y);
        ctx.quadraticCurveTo(x + CARD_W, y, x + CARD_W, y + r);
        ctx.lineTo(x + CARD_W, y + CARD_H - r);
        ctx.quadraticCurveTo(x + CARD_W, y + CARD_H, x + CARD_W - r, y + CARD_H);
        ctx.lineTo(x + r, y + CARD_H);
        ctx.quadraticCurveTo(x, y + CARD_H, x, y + CARD_H - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (card.revealed || card.matched) {
          // 심볼 표시
          ctx.fillStyle = '#eee';
          ctx.font = '36px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(card.symbol, x + CARD_W / 2, y + CARD_H / 2);
        } else {
          // 뒤면 표시
          ctx.fillStyle = '#64748b';
          ctx.font = '24px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', x + CARD_W / 2, y + CARD_H / 2);
        }
      });

      // Score
      this.scoreEl.textContent =
        '매칭: ' + this.matchedCount + '/' + SYMBOLS.length + '  |  횟수: ' + this.moves;
    }

    update() {
      // Memory card는 requestAnimationFrame 루프가 필요 없음
      // (click 이벤트 기반)
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
