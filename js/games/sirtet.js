/**
 * Sirtet — 블록이 아래서 위로 올라가는 퍼즐 게임
 *
 * GameRegistry.register() 로 등록되며,
 * init(container) 메서드가 호출됩니다.
 */
(function () {
  'use strict';

  // ===== 상수 =====
  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30;
  const COLORS = [
    null,
    '#00f0f0', // I - cyan
    '#0000f0', // J - blue
    '#f0a000', // L - orange
    '#f0f000', // O - yellow
    '#00f000', // S - green
    '#a000f0', // T - purple
    '#f00000', // Z - red
  ];

  // Sirtet 조각 정의 (각 회전 상태)
  const SHAPES = [
    null,
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
    [[2, 0, 0], [2, 2, 2], [0, 0, 0]],                         // J
    [[0, 0, 3], [3, 3, 3], [0, 0, 0]],                         // L
    [[4, 4], [4, 4]],                                          // O
    [[0, 5, 5], [5, 5, 0], [0, 0, 0]],                         // S
    [[0, 6, 0], [6, 6, 6], [0, 0, 0]],                         // T
    [[7, 7, 0], [0, 7, 7], [0, 0, 0]],                         // Z
  ];

  // ===== GameRegistry 등록 =====
  GameRegistry.register({
    id: 'sirtet',
    name: 'Sirtet',
    description: '블록이 아래서 위로 올라가는 퍼즐 게임',
    init(container) {
      return new SirtetGame(container);
    },
  });

  // ===== 게임 클래스 =====
  class SirtetGame {
    constructor(container) {
      this.container = container;
      this.canvas = document.createElement('canvas');
      this.canvas.width = COLS * BLOCK;
      this.canvas.height = ROWS * BLOCK;
      this.canvas.style.border = '2px solid var(--color-primary)';
      this.canvas.style.borderRadius = '4px';
      this.ctx = this.canvas.getContext('2d');

      this.gameStarted = false;
      this.gameOver = false;
      this.paused = false;
      this.animationId = null;

      this.bindKeys();
      this.showWaitingScreen();
    }

    // ===== 대기화면 =====
    setupLayout() {
      // Layout: canvas + sidebar
      const layout = document.createElement('div');
      layout.style.display = 'flex';
      layout.style.gap = '1rem';
      layout.style.alignItems = 'flex-start';
      this.container.appendChild(layout);

      layout.appendChild(this.canvas);

      // Next piece preview panel
      this.nextPanel = document.createElement('div');
      this.nextPanel.style.cssText =
        'background:#1a1a2e;border-radius:4px;padding:0.8rem;width:152px;text-align:center';
      this.nextPanel.innerHTML =
        '<div style="font-size:0.85rem;color:#aaa;margin-bottom:0.5rem">다음</div>';
      this.nextCanvas = document.createElement('canvas');
      this.nextCanvas.width = 4 * BLOCK;
      this.nextCanvas.height = 4 * BLOCK;
      this.nextCtx = this.nextCanvas.getContext('2d');
      this.nextPanel.appendChild(this.nextCanvas);
      layout.appendChild(this.nextPanel);

      // Score display
      this.scoreEl = document.createElement('div');
      this.scoreEl.style.cssText =
        'margin-top:0.5rem;font-size:1.1rem;color:var(--color-text)';
      this.container.appendChild(this.scoreEl);
    }

    showWaitingScreen() {
      if (!this.scoreEl) {
        this.setupLayout();
      }

      this.ctx.fillStyle = '#111';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // 대표 블록 — T (보라색)
      const tCells = [[4,4],[5,4],[6,4],[5,5]];
      for (const [bx, by] of tCells) {
        this.ctx.fillStyle = '#a000f0';
        this.ctx.fillRect(bx * BLOCK, by * BLOCK, BLOCK - 2, BLOCK - 2);
      }

      this.ctx.fillStyle = '#e94560';
      this.ctx.font = 'bold 28px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Sirtet', this.canvas.width / 2, this.canvas.height / 2 - 40);

      this.ctx.fillStyle = '#eee';
      this.ctx.font = '16px sans-serif';
      this.ctx.fillText('Enter 또는 Space를 눌러 시작하세요', this.canvas.width / 2, this.canvas.height / 2 - 20);

      this.ctx.font = '12px sans-serif';
      this.ctx.fillStyle = '#888';
      this.ctx.fillText('← → 이동  |  ↓ 회전', this.canvas.width / 2, this.canvas.height / 2 + 20);
      this.ctx.fillText('↑ 부드럽게 올리기  |  Space: 강하게 올리기', this.canvas.width / 2, this.canvas.height / 2 + 40);
      this.ctx.fillText('P: 일시정지', this.canvas.width / 2, this.canvas.height / 2 + 60);

      // Clear next canvas
      this.nextCtx.fillStyle = '#111';
      this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
      this.scoreEl.textContent = '';
    }

    createBoard() {
      return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    }

    createRandomPiece() {
      const typeId = Math.floor(Math.random() * 7) + 1;
      const shape = SHAPES[typeId].map((row) => [...row]);
      return { shape, typeId };
    }

    spawnPiece() {
      const piece = this.nextPiece;
      this.nextPiece = this.createRandomPiece();
      const shape = piece.shape.map((row) => [...row]);
      this.current = {
        shape,
        typeId: piece.typeId,
        x: Math.floor(COLS / 2) - Math.ceil(shape[0].length / 2),
        y: ROWS - shape.length,
      };
      if (this.collides(this.current.x, this.current.y, this.current.shape)) {
        this.gameOver = true;
        this.showGameOverUI();
      }
    }

    /** Compute ghost (rise preview) Y position — blocks rise upward */
    getGhostY() {
      let ghostY = this.current.y;
      while (
        !this.collides(this.current.x, ghostY - 1, this.current.shape)
      ) {
        ghostY--;
      }
      return ghostY;
    }

    collides(px, py, shape) {
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          const nx = px + c;
          const ny = py + r;
          if (nx < 0 || nx >= COLS || ny < 0) return true;
          if (ny < ROWS && this.board[ny][nx]) return true;
        }
      }
      return false;
    }

    merge() {
      const { shape, x, y, typeId } = this.current;
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          const ny = y + r;
          const nx = x + c;
          if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
            this.board[ny][nx] = typeId;
          }
        }
      }
    }

    rotate() {
      const shape = this.current.shape;
      const N = shape.length;
      const rotated = Array.from({ length: N }, () => new Array(N).fill(0));
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) rotated[c][N - 1 - r] = shape[r][c];

      const prev = this.current.shape;
      this.current.shape = rotated;
      if (this.collides(this.current.x, this.current.y, rotated)) {
        // wall kick attempt
        for (const kick of [-1, 1, -2, 2]) {
          if (!this.collides(this.current.x + kick, this.current.y, rotated)) {
            this.current.x += kick;
            return;
          }
        }
        this.current.shape = prev; // revert
      }
    }

    clearLines() {
      let cleared = 0;
      for (let r = 0; r < ROWS; r++) {
        if (this.board[r].every((cell) => cell !== 0)) {
          this.board.splice(r, 1);
          this.board.push(new Array(COLS).fill(0));
          cleared++;
          r++; // recheck this row
        }
      }
      if (cleared > 0) {
        const points = [0, 100, 300, 500, 800];
        this.score += points[cleared] || 800;
        this.lines += cleared;
        // speed up slightly
        this.dropInterval = Math.max(100, 1000 - this.lines * 10);
      }
    }

    rise() {
      if (!this.collides(this.current.x, this.current.y - 1, this.current.shape)) {
        this.current.y--;
      } else {
        this.merge();
        this.clearLines();
        this.spawnPiece();
      }
    }

    hardRise() {
      while (
        !this.collides(this.current.x, this.current.y - 1, this.current.shape)
      ) {
        this.current.y--;
        this.score += 2;
      }
      this.merge();
      this.clearLines();
      this.spawnPiece();
    }

    bindKeys() {
      this.keyHandler = (e) => {
        // 대기화면에서 Enter/Space 누르면 게임 시작
        if (!this.gameStarted && (e.key === 'Enter' || e.key === ' ')) {
          this.gameStarted = true;
          this.initGame();
          e.preventDefault();
          return;
        }

        // 게임 종료 시 처리
        if (this.gameOver) {
          if (e.key === 'Enter') {
            this.restart();
            e.preventDefault();
          } else if (e.key === 'Escape') {
            this.resetToWaiting();
            e.preventDefault();
          }
          return;
        }

        if (e.key === 'p' || e.key === 'P') {
          this.paused = !this.paused;
          return;
        }
        if (this.paused) return;

        switch (e.key) {
          case 'ArrowLeft':
            if (
              !this.collides(
                this.current.x - 1,
                this.current.y,
                this.current.shape
              )
            )
              this.current.x--;
            break;
          case 'ArrowRight':
            if (
              !this.collides(
                this.current.x + 1,
                this.current.y,
                this.current.shape
              )
            )
              this.current.x++;
            break;
          case 'ArrowDown':
            this.rotate();
            e.preventDefault();
            break;
          case 'ArrowUp':
            this.rise();
            this.score += 1;
            e.preventDefault();
            break;
          case ' ':
            this.hardRise();
            e.preventDefault();
            break;
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }

    draw() {
      const { ctx, canvas } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background grid
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Board
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (this.board[r][c]) {
            this.drawBlock(ctx, c, r, COLORS[this.board[r][c]]);
          }
        }
      }

      if (this.current && !this.gameOver) {
        const { shape, x, y, typeId } = this.current;
        const color = COLORS[typeId];

        // Ghost piece (semi-transparent drop preview)
        const ghostY = this.getGhostY();
        for (let r = 0; r < shape.length; r++) {
          for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c]) {
              this.drawGhostBlock(ctx, x + c, ghostY + r, color);
            }
          }
        }

        // Current piece
        for (let r = 0; r < shape.length; r++) {
          for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c]) {
              this.drawBlock(ctx, x + c, y + r, color);
            }
          }
        }
      }

      // Draw next piece preview
      this.drawNextPiece();

      // Score
      this.scoreEl.textContent = `점수: ${this.score}  |  라인: ${this.lines}`;

      // Pause overlay
      if (this.paused && !this.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#eee';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('일시정지', canvas.width / 2, canvas.height / 2);
      }
    }

    drawBlock(ctx, x, y, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK - 1, BLOCK - 1);
      // highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK - 1, 3);
    }

    drawGhostBlock(ctx, x, y, color) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK - 1, BLOCK - 1);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 2;
      ctx.strokeRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 3, BLOCK - 3);
      ctx.globalAlpha = 1;
    }

    drawNextPiece() {
      if (!this.nextPiece) return;
      const { nextCanvas, nextCtx } = this;
      nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
      nextCtx.fillStyle = '#111';
      nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

      const { shape, typeId } = this.nextPiece;
      const color = COLORS[typeId];
      const offsetX = (4 - shape[0].length) / 2;
      const offsetY = (4 - shape.length) / 2;

      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) {
            this.drawBlock(nextCtx, offsetX + c, offsetY + r, color);
          }
        }
      }
    }

    update(timestamp = 0) {
      if (this.gameOver) {
        this.draw();
        return;
      }

      if (!this.paused && timestamp - this.lastDrop > this.dropInterval) {
        this.rise();
        this.lastDrop = timestamp;
      }

      this.draw();
      this.animationId = requestAnimationFrame((ts) => this.update(ts));
    }

    // 게임 상태 초기화 및 시작
    initGame() {
      this.board = this.createBoard();
      this.score = 0;
      this.lines = 0;
      this.gameOver = false;
      this.paused = false;
      this.dropInterval = 1000;
      this.lastDrop = 0;
      this.current = null;
      this.nextPiece = null;
      this.nextPiece = this.createRandomPiece();
      this.spawnPiece();
      this.update();
    }

    // 게임 재시작
    restart() {
      this.hideGameOverUI();
      if (this.animationId) cancelAnimationFrame(this.animationId);
      this.initGame();
    }

    // 대기화면으로 복귀
    resetToWaiting() {
      this.hideGameOverUI();
      if (this.animationId) cancelAnimationFrame(this.animationId);
      this.gameOver = false;
      this.gameStarted = false;
      this.paused = false;
      this.showWaitingScreen();
    }

    // 게임 종료 UI 표시
    showGameOverUI() {
      this.hideGameOverUI();

      const overlay = document.createElement('div');
      overlay.className = 'sirtet-gameover-overlay';
      overlay.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.75); display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 0.6rem; z-index: 10;
      `;

      const title = document.createElement('div');
      title.textContent = '게임 종료';
      title.style.cssText = 'color:#e94560;font:bold 28px sans-serif;margin-bottom:0.3rem';

      const score = document.createElement('div');
      score.textContent = `점수: ${this.score}`;
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

      overlay.appendChild(title);
      overlay.appendChild(score);
      overlay.appendChild(btnRestart);
      overlay.appendChild(btnWaiting);

      // container가 relative가 아니면 설정
      if (getComputedStyle(this.container).position === 'static') {
        this.container.style.position = 'relative';
      }
      this.container.appendChild(overlay);
      this._gameoverOverlay = overlay;
    }

    // 게임 종료 UI 제거
    hideGameOverUI() {
      if (this._gameoverOverlay) {
        this._gameoverOverlay.remove();
        this._gameoverOverlay = null;
      }
    }

    destroy() {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
      this.container.innerHTML = '';
    }
  }
})();
