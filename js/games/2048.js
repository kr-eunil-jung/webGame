/**
 * 2048 — 타일 슬라이딩 퍼즐 게임
 *
 * GameRegistry.register() 로 등록되며,
 * init(container) 메서드가 호출됩니다.
 * 이동 시 부드러운 애니메이션을 포함합니다.
 * F5, F12 는 브라우저 기본 동작을 허용합니다.
 */
(function () {
  'use strict';

  const GRID = 4;
  const TILE_SIZE = 80;
  const GAP = 12;
  const PADDING = 20;
  const BOARD_PX = PADDING * 2 + GRID * TILE_SIZE + (GRID - 1) * GAP;
  const CANVAS_W = BOARD_PX;
  const CANVAS_H = BOARD_PX + 60;
  const ANIM_DURATION = 120; // ms

  // Tile color map
  const TILE_COLORS = {
    0:   { bg: '#1e2228', text: 'transparent' },
    2:   { bg: '#2d3a4a', text: '#eee' },
    4:   { bg: '#345066', text: '#eee' },
    8:   { bg: '#c0613a', text: '#fff' },
    16:  { bg: '#d4522e', text: '#fff' },
    32:  { bg: '#e8742a', text: '#fff' },
    64:  { bg: '#e85a2a', text: '#fff' },
    128: { bg: '#f0a030', text: '#fff' },
    256: { bg: '#f0c030', text: '#fff' },
    512: { bg: '#f0d030', text: '#fff' },
    1024: { bg: '#f0e030', text: '#fff' },
    2048: { bg: '#f0f030', text: '#111' },
  };

  function getTileColor(value) {
    return TILE_COLORS[value] || { bg: '#111', text: '#fff' };
  }

  // ===== GameRegistry 등록 =====
  GameRegistry.register({
    id: '2048',
    name: '2048',
    description: '타일을 합쳐 2048을 만드세요!',
    init(container) {
      return new Game2048(container);
    },
  });

  // ===== 게임 클래스 =====
  class Game2048 {
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
      this.score = 0;
      this.best = parseInt(localStorage.getItem('2048best') || '0', 10);

      this.audio = new GameAudio();

      // Animation state
      this.animating = false;
      this.animStartTime = 0;

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
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('2048', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '16px sans-serif';
      ctx.fillText('Enter 또는 Space를 눌러 시작하세요', canvas.width / 2, canvas.height / 2 + 10);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('방향키 또는 WASD로 이동', canvas.width / 2, canvas.height / 2 + 40);
    }

    // ===== 보드 초기화 =====
    initBoard() {
      this.grid = Array.from({ length: GRID }, () => Array(GRID).fill(0));
      // Visual tiles: {id, value, row, col, fromRow, fromCol, merging}
      this.tiles = [];
      this.tileIdCounter = 0;
      this.score = 0;
      this.spawnTile();
      this.spawnTile();
    }

    spawnTile() {
      const empty = [];
      for (let r = 0; r < GRID; r++)
        for (let c = 0; c < GRID; c++)
          if (this.grid[r][c] === 0) empty.push({ r, c });
      if (empty.length === 0) return;
      const { r, c } = empty[Math.floor(Math.random() * empty.length)];
      const value = Math.random() < 0.9 ? 2 : 4;
      this.grid[r][c] = value;
      this.tiles.push({
        id: this.tileIdCounter++,
        value,
        row: r,
        col: c,
        fromRow: r,
        fromCol: c,
        merging: false,
      });
    }

    // ===== 키 바인딩 (F5, F12 허용) =====
    bindKeys() {
      this.keyHandler = (e) => {
        // F5, F12 는 항상 허용
        if (e.key === 'F5' || e.key === 'F12') return;

        if (!this.gameStarted && (e.key === 'Enter' || e.key === ' ')) {
          this.audio.init();
          this.audio.playSFX('start');
          this.audio.playBGM('memory');
          this.gameStarted = true;
          this.initBoard();
          this.startRenderLoop();
          e.preventDefault();
          return;
        }

        if (!this.gameStarted || this.gameOver || this.animating) return;

        const dirMap = {
          ArrowUp: [-1, 0], ArrowDown: [1, 0],
          ArrowLeft: [0, -1], ArrowRight: [0, 1],
          w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1],
          W: [-1, 0], S: [1, 0], A: [0, -1], D: [0, 1],
        };
        const delta = dirMap[e.key];
        if (!delta) return;
        e.preventDefault();
        this.move(delta[0], delta[1]);
      };
      window.addEventListener('keydown', this.keyHandler);
    }

    // ===== 이동 로직 + 애니메이션 =====
    move(dr, dc) {
      const moved = this.computeMove(dr, dc);
      if (!moved) return;

      this.animating = true;
      this.animStartTime = performance.now();
      this.audio.playSFX('move');

      // Animate then finalize
      setTimeout(() => {
        // Snap tiles to final position
        for (const t of this.tiles) {
          t.fromRow = t.row;
          t.fromCol = t.col;
        }
        // Remove merged-away tiles
        this.tiles = this.tiles.filter((t) => !t.removed);
        // Spawn new tile
        this.spawnTile();
        this.animating = false;

        // Check game over
        if (this.isGameOver()) {
          this.gameOver = true;
          this.audio.stopBGM();
          this.audio.playSFX('gameover');
          this.draw();
          setTimeout(() => this.showGameOverUI(), 400);
        }
      }, ANIM_DURATION);
    }

    computeMove(dr, dc) {
      // Determine traversal order
      const rows = [...Array(GRID).keys()];
      const cols = [...Array(GRID).keys()];
      if (dr === 1) rows.reverse();
      if (dc === 1) cols.reverse();

      let scoreGain = 0;
      let moved = false;

      // Reset merge flags
      for (const t of this.tiles) {
        t.mergedThisMove = false;
      }

      for (const r of rows) {
        for (const c of cols) {
          const val = this.grid[r][c];
          if (val === 0) continue;

          let nr = r, nc = c;
          // Find farthest empty or mergeable position
          while (true) {
            const tr = nr + dr, tc = nc + dc;
            if (tr < 0 || tr >= GRID || tc < 0 || tc >= GRID) break;
            const next = this.grid[tr][tc];
            if (next === 0) {
              nr = tr; nc = tc;
            } else if (next === val) {
              // Check if already merged this move
              const tileAt = this.tiles.find(
                (t) => !t.removed && t.row === tr && t.col === tc && !t.mergedThisMove
              );
              if (tileAt) {
                nr = tr; nc = tc;
              }
              break;
            } else {
              break;
            }
          }

          if (nr !== r || nc !== c) {
            moved = true;
            const target = this.grid[nr][nc];

            if (target === 0) {
              // Move tile
              this.grid[nr][nc] = val;
              this.grid[r][c] = 0;
              const tile = this.tiles.find((t) => !t.removed && t.row === r && t.col === c);
              if (tile) {
                tile.fromRow = tile.row;
                tile.fromCol = tile.col;
                tile.row = nr;
                tile.col = nc;
              }
            } else if (target === val) {
              // Merge
              const newValue = val * 2;
              this.grid[nr][nc] = newValue;
              this.grid[r][c] = 0;
              scoreGain += newValue;

              const tile = this.tiles.find((t) => !t.removed && t.row === r && t.col === c);
              const tileAt = this.tiles.find(
                (t) => !t.removed && t.row === nr && t.col === nc && !t.mergedThisMove
              );
              if (tile) {
                tile.fromRow = tile.row;
                tile.fromCol = tile.col;
                tile.row = nr;
                tile.col = nc;
                tile.removed = true;
              }
              if (tileAt) {
                tileAt.value = newValue;
                tileAt.mergedThisMove = true;
                tileAt.merging = true;
                // Reset merge flash after animation
                setTimeout(() => { tileAt.merging = false; }, ANIM_DURATION);
              }
            }
          }
        }
      }

      if (moved) {
        this.score += scoreGain;
        if (this.score > this.best) {
          this.best = this.score;
          localStorage.setItem('2048best', String(this.best));
        }
      }
      return moved;
    }

    isGameOver() {
      for (let r = 0; r < GRID; r++)
        for (let c = 0; c < GRID; c++) {
          if (this.grid[r][c] === 0) return false;
          if (c < GRID - 1 && this.grid[r][c] === this.grid[r][c + 1]) return false;
          if (r < GRID - 1 && this.grid[r][c] === this.grid[r + 1][c]) return false;
        }
      return true;
    }

    // ===== 렌더링 =====
    startRenderLoop() {
      const loop = () => {
        this.draw();
        this.animationId = requestAnimationFrame(loop);
      };
      this.animationId = requestAnimationFrame(loop);
    }

    draw() {
      const { ctx } = this;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Background
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Board background
      ctx.fillStyle = '#1a1d23';
      ctx.fillRect(PADDING - 2, PADDING - 2, GRID * TILE_SIZE + (GRID - 1) * GAP + 4, GRID * TILE_SIZE + (GRID - 1) * GAP + 4);

      // Empty cells
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          const x = PADDING + c * (TILE_SIZE + GAP);
          const y = PADDING + r * (TILE_SIZE + GAP);
          ctx.fillStyle = '#1e2228';
          this.roundRect(ctx, x, y, TILE_SIZE, TILE_SIZE, 6);
          ctx.fill();
        }
      }

      // Interpolation factor for animation
      let t = 1;
      if (this.animating) {
        t = Math.min(1, (performance.now() - this.animStartTime) / ANIM_DURATION);
      }
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic

      // Draw tiles
      for (const tile of this.tiles) {
        if (tile.removed && !tile.mergedThisMove) continue;

        const curR = tile.fromRow + (tile.row - tile.fromRow) * ease;
        const curC = tile.fromCol + (tile.col - tile.fromCol) * ease;

        const x = PADDING + curC * (TILE_SIZE + GAP);
        const y = PADDING + curR * (TILE_SIZE + GAP);

        const color = getTileColor(tile.value);
        ctx.fillStyle = color.bg;
        this.roundRect(ctx, x, y, TILE_SIZE, TILE_SIZE, 6);
        ctx.fill();

        // Merge flash effect
        if (tile.merging) {
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          this.roundRect(ctx, x, y, TILE_SIZE, TILE_SIZE, 6);
          ctx.fill();
        }

        // Tile text
        if (!tile.removed || ease < 1) {
          ctx.fillStyle = color.text;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const fontSize = tile.value >= 1024 ? 18 : tile.value >= 128 ? 22 : 28;
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillText(tile.value, x + TILE_SIZE / 2, y + TILE_SIZE / 2);
        }
      }

      // Score
      ctx.fillStyle = '#888';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Score', PADDING, BOARD_PX + 8);
      ctx.fillStyle = '#eee';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(this.score, PADDING, BOARD_PX + 24);

      ctx.fillStyle = '#888';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Best', CANVAS_W - PADDING, BOARD_PX + 8);
      ctx.fillStyle = '#aaa';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(this.best, CANVAS_W - PADDING, BOARD_PX + 24);
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

    // ===== 오버레이 =====
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
      this.removeOverlay();
      this.initBoard();
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

    update() {
      // Animation loop handled by startRenderLoop
    }

    destroy() {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
      this.audio.destroy();
      this.container.innerHTML = '';
    }
  }
})();
