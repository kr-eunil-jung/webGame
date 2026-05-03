/**
 * Minesweeper — 클래식 지뢰찾기
 *
 * GameRegistry.register() 로 등록되며,
 * init(container) 메서드가 호출됩니다.
 */
(function () {
  'use strict';

  // ===== 상수 =====
  const COLS = 10;
  const ROWS = 10;
  const CELL = 40;
  const MINES_COUNT = 15;
  const HEADER_H = 20;
  const CANVAS_W = COLS * CELL;
  const CANVAS_H = ROWS * CELL + HEADER_H;

  // 숫자 색상 (표준 지뢰찾기)
  const NUM_COLORS = {
    1: '#0000FF',
    2: '#008000',
    3: '#FF0000',
    4: '#000080',
    5: '#800000',
    6: '#008080',
    7: '#000000',
    8: '#808080',
  };

  // ===== GameRegistry 등록 =====
  GameRegistry.register({
    id: 'minesweeper',
    name: '지뢰찾기',
    description: '클래식 지뢰찾기 — 지뢰를 피하고 모든 칸을 밝혀세요!',
    init(container) {
      return new MinesweeperGame(container);
    },
  });

  // ===== 게임 클래스 =====
  class MinesweeperGame {
    constructor(container) {
      this.container = container;
      this.canvas = document.createElement('canvas');
      this.canvas.width = CANVAS_W;
      this.canvas.height = CANVAS_H;
      this.canvas.style.border = '2px solid var(--color-primary)';
      this.canvas.style.borderRadius = '4px';
      this.canvas.style.display = 'block';
      this.ctx = this.canvas.getContext('2d');

      this.gameStarted = false;
      this.gameOver = false;
      this.animationId = null;
      this._overlay = null;

      this.audio = new GameAudio();

      this.container.style.position = 'relative';
      this.container.appendChild(this.canvas);

      this.showWaitingScreen();
      this.bindKeys();
      this.bindMouse();
    }

    // ===== 대기화면 =====
    showWaitingScreen() {
      const { ctx, canvas } = this;
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#eee';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💣 지뢰찾기', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '16px sans-serif';
      ctx.fillText('Enter 또는 Space를 눌러 시작하세요', canvas.width / 2, canvas.height / 2 + 10);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('좌클릭: 열기 | 우클릭: 깃발', canvas.width / 2, canvas.height / 2 + 40);
    }

    // ===== 게임 초기화 =====
    initGame() {
      this.grid = [];
      this.mines = new Set();
      this.revealed = new Set();
      this.flagged = new Set();
      this.firstClick = true;
      this.timer = 0;
      this.timerInterval = null;

      for (let r = 0; r < ROWS; r++) {
        this.grid[r] = [];
        for (let c = 0; c < COLS; c++) {
          this.grid[r][c] = 0;
        }
      }

      // Score display
      if (!this.scoreEl) {
        this.scoreEl = document.createElement('div');
        this.scoreEl.style.cssText =
          'margin-top:0.5rem;font-size:1.1rem;color:var(--color-text);text-align:center';
        this.container.appendChild(this.scoreEl);
      }
      this.updateScoreDisplay();
    }

    // ===== 지뢰 생성 (첫 클릭 이후) =====
    placeMines(safeR, safeC) {
      const safeCells = new Set();
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = safeR + dr;
          const nc = safeC + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            safeCells.add(nr * COLS + nc);
          }
        }
      }

      this.mines.clear();
      while (this.mines.size < MINES_COUNT) {
        const idx = Math.floor(Math.random() * ROWS * COLS);
        if (!safeCells.has(idx) && !this.mines.has(idx)) {
          this.mines.add(idx);
        }
      }

      // Calculate numbers
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          this.grid[r][c] = this.countAdjacentMines(r, c);
        }
      }
    }

    countAdjacentMines(r, c) {
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            if (this.mines.has(nr * COLS + nc)) count++;
          }
        }
      }
      return count;
    }

    // ===== 셀 열기 (flood-fill) =====
    revealCell(r, c) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
      const idx = r * COLS + c;
      if (this.revealed.has(idx) || this.flagged.has(idx)) return;

      this.revealed.add(idx);
      this.audio.playSFX('select');

      if (this.grid[r][c] === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            this.revealCell(r + dr, c + dc);
          }
        }
      }
    }

    // ===== 게임 종료 (지뢰 클릭) =====
    hitMine(r, c) {
      this.gameOver = true;
      if (this.timerInterval) clearInterval(this.timerInterval);

      // Reveal all mines
      this.mines.forEach((idx) => {
        this.revealed.add(idx);
      });

      this.audio.stopBGM();
      this.audio.playSFX('invalid');
      this.audio.playSFX('gameover');

      this.draw();

      setTimeout(() => {
        this.showGameOverUI();
      }, 300);
    }

    // ===== 승리 체크 =====
    checkWin() {
      const totalCells = ROWS * COLS;
      const nonMineCells = totalCells - MINES_COUNT;
      if (this.revealed.size === nonMineCells) {
        this.gameOver = true;
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.audio.stopBGM();
        this.audio.playSFX('clear');

        this.draw();

        setTimeout(() => {
          this.showWinUI();
        }, 300);
      }
    }

    // ===== Chord: 숫자 클릭 시 주변 자동 열기 =====
    _doChord(r, c) {
      const idx = r * COLS + c;
      if (!this.revealed.has(idx)) return;
      const num = this.grid[r][c];
      if (num <= 0) return;

      // Count adjacent flags
      let flagCount = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            if (this.flagged.has(nr * COLS + nc)) flagCount++;
          }
        }
      }

      // Only chord if flag count matches the number
      if (flagCount !== num) return;

      // Reveal all unrevealed, unflagged neighbors
      let hit = false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            const nidx = nr * COLS + nc;
            if (!this.revealed.has(nidx) && !this.flagged.has(nidx)) {
              if (this.mines.has(nidx)) {
                this.revealed.add(nidx);
                hit = true;
              } else {
                this.revealCell(nr, nc);
              }
            }
          }
        }
      }

      if (hit) {
        this.updateScoreDisplay();
        this.draw();
        this.hitMine(r, c);
      } else {
        this.audio.playSFX('select');
        this.updateScoreDisplay();
        this.draw();
        this.checkWin();
      }
    }

    // ===== 타이머 =====
    startTimer() {
      this.timer = 0;
      this.timerInterval = setInterval(() => {
        this.timer++;
        this.updateScoreDisplay();
      }, 1000);
    }

    // ===== 점수 표시 =====
    updateScoreDisplay() {
      const remaining = MINES_COUNT - this.flagged.size;
      const revealed = this.revealed.size;
      const total = ROWS * COLS - MINES_COUNT;
      const mins = String(Math.floor(this.timer / 60)).padStart(2, '0');
      const secs = String(this.timer % 60).padStart(2, '0');
      if (this.scoreEl) {
        this.scoreEl.textContent = `💣 ${remaining}  |  📦 ${revealed}/${total}  |  ⏱ ${mins}:${secs}`;
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
          this.initGame();
          this.draw();
          e.preventDefault();
          return;
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }

    // ===== 마우스 바인딩 =====
    bindMouse() {
      this._mouseDownCell = null;
      this._mouseDownButton = -1;

      this.mouseDownHandler = (e) => {
        e.preventDefault();
        if (!this.gameStarted || this.gameOver) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const c = Math.floor(x / CELL);
        const r = Math.floor((y - HEADER_H) / CELL);

        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;

        this._mouseDownCell = { r, c };
        this._mouseDownButton = e.button;
      };

      this.mouseUpHandler = (e) => {
        e.preventDefault();
        if (!this.gameStarted || this.gameOver) return;
        if (!this._mouseDownCell) return;

        const { r, c } = this._mouseDownCell;
        this._mouseDownCell = null;

        // Chord: both buttons pressed
        if ((e.button === 0 || this._mouseDownButton === 0) && (e.button === 2 || this._mouseDownButton === 2)) {
          this._doChord(r, c);
        } else if (e.button === 2 || this._mouseDownButton === 2) {
          // Right-click: flag/unflag
          const idx = r * COLS + c;
          if (this.revealed.has(idx)) return;
          if (this.flagged.has(idx)) {
            this.flagged.delete(idx);
          } else {
            this.flagged.add(idx);
          }
          this.audio.playSFX('select');
          this.updateScoreDisplay();
          this.draw();
        } else if (e.button === 0 || this._mouseDownButton === 0) {
          // Left-click: reveal or chord on number
          const idx = r * COLS + c;
          if (this.flagged.has(idx)) return;
          if (this.revealed.has(idx)) {
            this._doChord(r, c);
            return;
          }

          // First click — place mines safely
          if (this.firstClick) {
            this.firstClick = false;
            this.placeMines(r, c);
            this.startTimer();
          }

          if (this.mines.has(idx)) {
            this.revealed.add(idx);
            this.hitMine(r, c);
            return;
          }

          this.revealCell(r, c);
          this.updateScoreDisplay();
          this.draw();
          this.checkWin();
        }
      };

      this.contextMenuHandler = (e) => {
        e.preventDefault();
      };

      this.canvas.addEventListener('mousedown', this.mouseDownHandler);
      this.canvas.addEventListener('mouseup', this.mouseUpHandler);
      this.canvas.addEventListener('contextmenu', this.contextMenuHandler);
    }

    // ===== 렌더링 =====
    draw() {
      const { ctx } = this;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Background
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Header bar
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_W, HEADER_H);
      ctx.fillStyle = '#eee';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💣 지뢰찾기', CANVAS_W / 2, 14);

      // Cells
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = c * CELL;
          const y = r * CELL + HEADER_H;
          const idx = r * COLS + c;
          const isRevealed = this.revealed.has(idx);
          const isFlagged = this.flagged.has(idx);
          const isMine = this.mines.has(idx);

          if (isRevealed) {
            // Revealed cell
            ctx.fillStyle = '#222';
            ctx.fillRect(x, y, CELL, CELL);

            if (isMine) {
              // Draw mine: red circle with X
              ctx.fillStyle = '#e94560';
              ctx.beginPath();
              ctx.arc(x + CELL / 2, y + CELL / 2, CELL / 2 - 6, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(x + 10, y + 10);
              ctx.lineTo(x + CELL - 10, y + CELL - 10);
              ctx.moveTo(x + CELL - 10, y + 10);
              ctx.lineTo(x + 10, y + CELL - 10);
              ctx.stroke();
            } else if (this.grid[r][c] > 0) {
              // Draw number
              ctx.fillStyle = NUM_COLORS[this.grid[r][c]] || '#000';
              ctx.font = 'bold 20px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(String(this.grid[r][c]), x + CELL / 2, y + CELL / 2);
              ctx.textBaseline = 'alphabetic';
            }
          } else {
            // Unrevealed cell
            ctx.fillStyle = '#444';
            ctx.fillRect(x, y, CELL, CELL);
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);

            if (isFlagged) {
              ctx.font = '20px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('🚩', x + CELL / 2, y + CELL / 2);
              ctx.textBaseline = 'alphabetic';
            }
          }
        }
      }
    }

    // ===== 게임 종료 UI =====
    showGameOverUI() {
      const title = document.createElement('div');
      title.textContent = '💥 게임 종료';
      title.style.cssText = 'color:#e94560;font:bold 28px sans-serif;margin-bottom:0.3rem';

      const score = document.createElement('div');
      const mins = String(Math.floor(this.timer / 60)).padStart(2, '0');
      const secs = String(this.timer % 60).padStart(2, '0');
      score.textContent = `걸린 시간: ${mins}:${secs}`;
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

    // ===== 승리 UI =====
    showWinUI() {
      const title = document.createElement('div');
      title.textContent = '🎉 축하합니다!';
      title.style.cssText = 'color:#4ade80;font:bold 28px sans-serif;margin-bottom:0.3rem';

      const score = document.createElement('div');
      const mins = String(Math.floor(this.timer / 60)).padStart(2, '0');
      const secs = String(this.timer % 60).padStart(2, '0');
      score.textContent = `걸린 시간: ${mins}:${secs}`;
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

    restart() {
      this.gameOver = false;
      this.removeOverlay();
      this.audio.playBGM('memory');
      this.initGame();
      this.draw();
    }

    resetToWaiting() {
      this.gameOver = false;
      this.gameStarted = false;
      if (this.timerInterval) clearInterval(this.timerInterval);
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      this.removeOverlay();
      if (this.scoreEl) {
        this.scoreEl.remove();
        this.scoreEl = null;
      }
      this.showWaitingScreen();
    }

    destroy() {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.timerInterval) clearInterval(this.timerInterval);
      if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
      if (this.mouseDownHandler) this.canvas.removeEventListener('mousedown', this.mouseDownHandler);
      if (this.mouseUpHandler) this.canvas.removeEventListener('mouseup', this.mouseUpHandler);
      if (this.contextMenuHandler) this.canvas.removeEventListener('contextmenu', this.contextMenuHandler);
      this.audio.destroy();
      this.container.innerHTML = '';
    }
  }
})();
