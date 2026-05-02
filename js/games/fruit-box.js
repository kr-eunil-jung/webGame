/**
 * FruitBox — 사과 게임 (Fruit Box)
 *
 * 17x10 사과 매트릭스에 숫자(1~9)가 적힌 사과들이 배치됩니다.
 * 마우스로 드래그하여 직사각형 영역을 선택하면,
 * 영역 내 사과 숫자의 합이 10이 되면 해당 사과들이 즉시 사라집니다.
 * 제한시간 2분 내에 최대한 많은 사과를 제거하세요.
 */
(function () {
  'use strict';

  const COLS = 17;
  const ROWS = 10;
  const TARGET_SUM = 10;
  const CELL_SIZE = 48;
  const APPLE_RADIUS = 18;
  const PADDING = 10;
  const TIMER_BAR_WIDTH = 16;
  const CANVAS_WIDTH = COLS * CELL_SIZE + PADDING * 2 + TIMER_BAR_WIDTH + 10;
  const CANVAS_HEIGHT = ROWS * CELL_SIZE + PADDING * 2;
  const TIME_LIMIT = 120;

  // 상태
  const STATE_START = 'start';
  const STATE_PLAYING = 'playing';
  const STATE_GAMEOVER = 'gameover';

  function cellToPixel(col, row) {
    return {
      x: PADDING + col * CELL_SIZE + CELL_SIZE / 2,
      y: PADDING + row * CELL_SIZE + CELL_SIZE / 2,
    };
  }

  function pixelToCell(px, py) {
    const col = Math.floor((px - PADDING) / CELL_SIZE);
    const row = Math.floor((py - PADDING) / CELL_SIZE);
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      return { col, row };
    }
    return null;
  }

  GameRegistry.register({
    id: 'fruit-box',
    name: '사과게임',
    description: '사과를 드래그하여 합계가 10이 되게 하는 퍼즐 게임!',
    init(container) {
      return new FruitBoxGame(container);
    },
    options: { category: 'puzzle', difficulty: 'easy' },
  });

  class FruitBoxGame {
    constructor(container) {
      this.container = container;
      this.canvas = document.createElement('canvas');
      this.canvas.width = CANVAS_WIDTH;
      this.canvas.height = CANVAS_HEIGHT;
      this.canvas.style.border = '2px solid var(--color-primary)';
      this.canvas.style.borderRadius = '4px';
      this.canvas.style.cursor = 'pointer';
      this.ctx = this.canvas.getContext('2d');

      this.state = STATE_START;
      this.grid = [];
      this.selected = new Set();
      this.score = 0;
      this.animationId = null;
      this.clearing = false;
      this.clearTimer = 0;

      this.timeLeft = TIME_LIMIT;
      this.lastTime = performance.now();

      this.isDragging = false;
      this.dragStartCol = -1;
      this.dragStartRow = -1;

      this.audio = new GameAudio();

      this.container.appendChild(this.canvas);

      this.scoreEl = document.createElement('div');
      this.scoreEl.style.cssText =
        'margin-top:0.5rem;font-size:1.1rem;color:var(--color-text);text-align:center;';
      this.container.appendChild(this.scoreEl);

      this.initGrid();
      this.bindEvents();
      this.draw();
      this.gameLoop();
    }

    startGame() {
      this.audio.init();
      this.audio.playSFX('start');
      this.audio.playBGM('fruitbox');
      this.state = STATE_PLAYING;
      this.score = 0;
      this.timeLeft = TIME_LIMIT;
      this.lastTime = performance.now();
      this.selected.clear();
      this.isDragging = false;
      this.clearing = false;
      this.initGrid();

      // gameLoop 재시작
      if (this.animationId) cancelAnimationFrame(this.animationId);
      this.gameLoop();
    }

    initGrid() {
      this.grid = [];
      for (let r = 0; r < ROWS; r++) {
        this.grid[r] = [];
        for (let c = 0; c < COLS; c++) {
          this.grid[r][c] = this.randomApple();
        }
      }
    }

    randomApple() {
      const weights = [1, 1, 1, 1, 1, 2, 2, 3, 3];
      const idx = Math.floor(Math.random() * weights.length);
      return idx + 1;
    }

    bindEvents() {
      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
          x: (clientX - rect.left) * scaleX,
          y: (clientY - rect.top) * scaleY,
        };
      };

      const getCell = (e) => {
        const pos = getPos(e);
        return pixelToCell(pos.x, pos.y);
      };

      const onClick = (e) => {
        e.preventDefault();
        const pos = getPos(e);

        if (this.state === STATE_START) {
          const btn = this.getStartButtonArea();
          if (pos.x >= btn.x && pos.x <= btn.x + btn.w && pos.y >= btn.y && pos.y <= btn.y + btn.h) {
            this.startGame();
          }
          return;
        }

        if (this.state === STATE_GAMEOVER) {
          const btnArea = this.getButtonHitAreas();
          for (const btn of btnArea) {
            if (pos.x >= btn.x && pos.x <= btn.x + btn.w && pos.y >= btn.y && pos.y <= btn.y + btn.h) {
              if (btn.action === 'restart') this.startGame();
              if (btn.action === 'startscreen') {
                if (this.animationId) cancelAnimationFrame(this.animationId);
                this.state = STATE_START;
                this.draw();
                return;
              }
              return;
            }
          }
          return;
        }
      };

      const onStart = (e) => {
        if (this.state !== STATE_PLAYING || this.clearing) return;
        e.preventDefault();
        const cell = getCell(e);
        if (!cell) return;

        this.isDragging = true;
        this.dragStartCol = cell.col;
        this.dragStartRow = cell.row;
        this.selected.clear();
        this.updateRectangleSelection(cell.col, cell.row);
        this.draw();
      };

      const onMove = (e) => {
        if (!this.isDragging || this.clearing) return;
        e.preventDefault();
        const cell = getCell(e);
        if (!cell) return;

        this.updateRectangleSelection(cell.col, cell.row);
        this.draw();
      };

      const onEnd = (e) => {
        if (!this.isDragging) return;
        e.preventDefault();
        this.isDragging = false;

        this.checkAndClear();
        this.selected.clear();
        this.draw();
      };

      this.clickHandler = onClick;
      this.mouseDownHandler = onStart;
      this.mouseMoveHandler = onMove;
      this.mouseUpHandler = onEnd;
      this.touchStartHandler = onStart;
      this.touchMoveHandler = onMove;
      this.touchEndHandler = onEnd;

      this.canvas.addEventListener('click', this.clickHandler);
      this.canvas.addEventListener('mousedown', this.mouseDownHandler);
      this.canvas.addEventListener('mousemove', this.mouseMoveHandler);
      this.canvas.addEventListener('mouseup', this.mouseUpHandler);
      this.canvas.addEventListener('mouseleave', this.mouseUpHandler);
      this.canvas.addEventListener('touchstart', this.touchStartHandler, { passive: false });
      this.canvas.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
      this.canvas.addEventListener('touchend', this.touchEndHandler);
    }

    getStartButtonArea() {
      const cx = (PADDING + COLS * CELL_SIZE + PADDING) / 2;
      const btnX = cx - 70;
      const btnY = CANVAS_HEIGHT / 2 + 65;
      return { x: btnX, y: btnY, w: 140, h: 48 };
    }

    getButtonHitAreas() {
      const cx = (PADDING + COLS * CELL_SIZE + PADDING) / 2;
      const by = CANVAS_HEIGHT / 2 + 30;
      const btnW = 80, btnH = 44;
      const gap = 16;
      const totalW = btnW * 2 + gap;
      return [
        { x: cx - totalW / 2, y: by, w: btnW, h: btnH, action: 'restart' },
        { x: cx + gap - totalW / 2 + btnW, y: by, w: btnW, h: btnH, action: 'startscreen' },
      ];
    }

    updateRectangleSelection(endCol, endRow) {
      this.selected.clear();
      const minCol = Math.min(this.dragStartCol, endCol);
      const maxCol = Math.max(this.dragStartCol, endCol);
      const minRow = Math.min(this.dragStartRow, endRow);
      const maxRow = Math.max(this.dragStartRow, endRow);

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          if (this.grid[r] && this.grid[r][c] !== null) {
            this.selected.add(`${c},${r}`);
          }
        }
      }
    }

    getSelectedSum() {
      let sum = 0;
      for (const key of this.selected) {
        const [col, row] = key.split(',').map(Number);
        if (this.grid[row] && this.grid[row][col] !== null) {
          sum += this.grid[row][col];
        }
      }
      return sum;
    }

    checkAndClear() {
      if (this.selected.size === 0) return;
      const sum = this.getSelectedSum();
      if (sum !== TARGET_SUM) return;

      this.score += this.selected.size;

      this.clearing = true;
      this.clearTimer = 10;

      this.audio.playSFX('clear');

      for (const key of this.selected) {
        const [col, row] = key.split(',').map(Number);
        this.grid[row][col] = null;
      }
      this.selected.clear();
    }

    applyGravity() {
      this.checkGameOver();
    }

    checkGameOver() {
      if (!this.hasAnyValidMove()) {
        this.state = STATE_GAMEOVER;
        this.audio.stopBGM();
        this.audio.playSFX('gameover');
      }
    }

    hasAnyValidMove() {
      for (let r1 = 0; r1 < ROWS; r1++) {
        for (let c1 = 0; c1 < COLS; c1++) {
          for (let r2 = r1; r2 < ROWS; r2++) {
            for (let c2 = c1; c2 < COLS; c2++) {
              let sum = 0;
              for (let r = r1; r <= r2; r++) {
                for (let c = c1; c <= c2; c++) {
                  if (this.grid[r][c] !== null) sum += this.grid[r][c];
                }
              }
              if (sum === TARGET_SUM) return true;
            }
          }
        }
      }
      return false;
    }

    draw() {
      const { ctx, canvas } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (this.state === STATE_START) {
        this.drawStartScreen();
        this.scoreEl.textContent = '';
        return;
      }

      if (this.state === STATE_GAMEOVER) {
        this.drawGameplay();
        this.drawGameOverOverlay();
        this.scoreEl.textContent = `최종 점수: ${this.score}`;
        return;
      }

      this.drawGameplay();
      this.scoreEl.textContent = `점수: ${this.score}`;
    }

    drawGameplay() {
      const { ctx } = this;

      // 선택 영역 하이라이트
      if (this.selected.size > 0 && !this.clearing) {
        let minCol = COLS, maxCol = 0, minRow = ROWS, maxRow = 0;
        for (const key of this.selected) {
          const [c, r] = key.split(',').map(Number);
          if (c < minCol) minCol = c;
          if (c > maxCol) maxCol = c;
          if (r < minRow) minRow = r;
          if (r > maxRow) maxRow = r;
        }
        const sum = this.getSelectedSum();
        ctx.fillStyle = sum === TARGET_SUM ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(
          PADDING + minCol * CELL_SIZE,
          PADDING + minRow * CELL_SIZE,
          (maxCol - minCol + 1) * CELL_SIZE,
          (maxRow - minRow + 1) * CELL_SIZE
        );
      }

      // 사과 그리기
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const val = this.grid[r][c];
          if (val === null) continue;
          const pos = cellToPixel(c, r);
          const key = `${c},${r}`;
          const isSelected = this.selected.has(key);
          this.drawApple(pos.x, pos.y, val, isSelected);
        }
      }

      // 타이머 프로그레스바
      this.drawTimerBar();
    }

    drawTimerBar() {
      const { ctx } = this;
      const barX = PADDING + COLS * CELL_SIZE + 6;
      const barY = PADDING;
      const barW = TIMER_BAR_WIDTH;
      const barH = CANVAS_HEIGHT - PADDING * 2;
      const ratio = this.timeLeft / TIME_LIMIT;

      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);

      const fillH = barH * ratio;
      if (ratio > 0.3) {
        ctx.fillStyle = '#4ade80';
      } else if (ratio > 0.15) {
        ctx.fillStyle = '#facc15';
      } else {
        ctx.fillStyle = '#e94560';
      }
      ctx.fillRect(barX, barY + barH - fillH, barW, fillH);

      const secs = Math.ceil(this.timeLeft);
      const mins = Math.floor(secs / 60);
      const remSecs = secs % 60;
      ctx.fillStyle = secs <= 10 ? '#e94560' : '#eee';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${mins}:${String(remSecs).padStart(2, '0')}`, barX + barW / 2, barY + barH + 16);
    }

    drawStartScreen() {
      const { ctx, canvas } = this;
      const cx = (PADDING + COLS * CELL_SIZE + PADDING) / 2;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';

      // 사과 이모지
      ctx.font = '64px sans-serif';
      ctx.fillText('🍎', cx, canvas.height / 2 - 100);

      // 타이틀
      ctx.fillStyle = '#e94560';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('사과 게임', cx, canvas.height / 2 - 30);

      // 설명
      ctx.fillStyle = '#ccc';
      ctx.font = '16px sans-serif';
      ctx.fillText('사과를 드래그하여 합계가 10이 되게 하세요!', cx, canvas.height / 2 + 15);
      ctx.fillText('제한시간: 2분', cx, canvas.height / 2 + 40);

      // 시작 버튼
      const btnX = cx - 70;
      const btnY = canvas.height / 2 + 65;
      const btnW = 140;
      const btnH = 48;
      ctx.fillStyle = '#e94560';
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('시작하기', cx, btnY + btnH / 2);
    }

    drawGameOverOverlay() {
      const { ctx, canvas } = this;
      const cx = (PADDING + COLS * CELL_SIZE + PADDING) / 2;

      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';

      const reason = this.timeLeft <= 0 ? '시간 초과!' : '게임 종료';
      ctx.fillStyle = '#e94560';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(reason, cx, canvas.height / 2 - 60);

      ctx.fillStyle = '#eee';
      ctx.font = '22px sans-serif';
      ctx.fillText(`최종 점수: ${this.score}`, cx, canvas.height / 2 - 20);

      // 버튼 (hit area와 동일한 좌표)
      const btnW = 80, btnH = 44;
      const gap = 16;
      const totalW = btnW * 2 + gap;
      const by = canvas.height / 2 + 30;
      let bx = cx - totalW / 2;

      ctx.fillStyle = '#e94560';
      ctx.beginPath();
      ctx.roundRect(bx, by, btnW, btnH, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('다시 시작', bx + btnW / 2, by + btnH / 2);

      // 대기화면 버튼
      bx = cx + gap - totalW / 2 + btnW;
      ctx.fillStyle = '#0f3460';
      ctx.beginPath();
      ctx.roundRect(bx, by, btnW, btnH, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText('대기화면', bx + btnW / 2, by + btnH / 2);
    }

    drawApple(x, y, value, selected) {
      const ctx = this.ctx;
      const r = APPLE_RADIUS;

      if (selected) {
        ctx.save();
        ctx.shadowColor = '#ffdd57';
        ctx.shadowBlur = 12;
      }

      // 이모지 스타일 사과 (fillStyle 리셋하여 하이라이트 영향 차단)
      ctx.fillStyle = '#fff';
      ctx.font = `${r * 2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🍎', x, y);

      if (selected) {
        ctx.restore();
      }

      // 숫자
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(r * 0.7)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.fillText(value, x, y + r * 0.1);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    gameLoop(now = performance.now()) {
      if (this.state === STATE_PLAYING && !this.clearing) {
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.state = STATE_GAMEOVER;
          this.audio.stopBGM();
          this.audio.playSFX('gameover');
        }
      }

      if (this.clearing) {
        this.clearTimer--;
        if (this.clearTimer <= 0) {
          this.clearing = false;
          this.applyGravity();
        }
      }

      this.draw();

      if (this.state !== STATE_GAMEOVER) {
        this.animationId = requestAnimationFrame((ts) => this.gameLoop(ts));
      }
    }

    destroy() {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.clickHandler) this.canvas.removeEventListener('click', this.clickHandler);
      if (this.mouseDownHandler) this.canvas.removeEventListener('mousedown', this.mouseDownHandler);
      if (this.mouseMoveHandler) this.canvas.removeEventListener('mousemove', this.mouseMoveHandler);
      if (this.mouseUpHandler) this.canvas.removeEventListener('mouseup', this.mouseUpHandler);
      if (this.mouseUpHandler) this.canvas.removeEventListener('mouseleave', this.mouseUpHandler);
      if (this.touchStartHandler) this.canvas.removeEventListener('touchstart', this.touchStartHandler);
      if (this.touchMoveHandler) this.canvas.removeEventListener('touchmove', this.touchMoveHandler);
      if (this.touchEndHandler) this.canvas.removeEventListener('touchend', this.touchEndHandler);
      this.audio.destroy();
      this.container.innerHTML = '';
    }
  }
})();
