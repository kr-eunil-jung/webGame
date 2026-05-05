/**
 * Pac-Man — 클래식 팩맨 게임
 *
 * GameRegistry.register() 로 등록되며,
 * init(container) 메서드가 호출됩니다.
 */
(function () {
  'use strict';

  // ===== 상수 =====
  const COLS = 19;
  const ROWS = 19;
  const BLOCK = 22;
  const CANVAS_W = COLS * BLOCK;
  const CANVAS_H = ROWS * BLOCK;

  // 방향
  const DIR = {
    NONE: { x: 0, y: 0 },
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
  };

  // 맵: 0=빈공간, 1=벽, 2=점, 3=파워펠릿, 4=팬텀하우스
  const MAP_TEMPLATE = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,2,1],
    [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
    [1,1,1,1,2,1,1,1,0,1,0,1,1,1,2,1,1,1,1],
    [0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0],
    [1,1,1,1,2,1,0,1,1,4,1,1,0,1,2,1,1,1,1],
    [0,0,0,0,2,0,0,1,4,4,4,1,0,0,2,0,0,0,0],
    [1,1,1,1,2,1,0,1,1,1,1,1,0,1,2,1,1,1,1],
    [0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0],
    [1,1,1,1,2,1,0,1,1,1,1,1,0,1,2,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,2,1],
    [1,3,2,1,2,2,2,2,2,0,2,2,2,2,2,1,2,3,1],
    [1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1],
    [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ];

  // 팬텀 색상
  const GHOST_COLORS = ['#FF0000', '#FFB8FF', '#00FFFF', '#FFB852'];

  // ===== GameRegistry 등록 =====
  GameRegistry.register({
    id: 'pac-man',
    name: '팩맨',
    description: '클래식 팩맨 — 모든 점을 먹어치우세요!',
    init(container) {
      return new PacManGame(container);
    },
  });

  // ===== 게임 클래스 =====
  class PacManGame {
    constructor(container) {
      this.container = container;
      this.canvas = document.createElement('canvas');
      this.canvas.width = CANVAS_W;
      this.canvas.height = CANVAS_H;
      this.canvas.style.border = '2px solid #FFFF00';
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
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#FFFF00';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🟡 팩맨', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#eee';
      ctx.fillText('Enter 또는 Space를 눌러 시작하세요', canvas.width / 2, canvas.height / 2 + 10);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('화살표 키로 이동하세요', canvas.width / 2, canvas.height / 2 + 40);
    }

    resetGame() {
      // 맵 복사
      this.map = MAP_TEMPLATE.map((row) => [...row]);
      this.score = 0;
      this.lives = 3;
      this.totalDots = 0;
      this.dotsEaten = 0;

      // 점 개수 세기
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (this.map[r][c] === 2 || this.map[r][c] === 3) {
            this.totalDots++;
          }
        }
      }

      this.resetLevel();

      // Score display
      if (!this.scoreEl) {
        this.scoreEl = document.createElement('div');
        this.scoreEl.style.cssText =
          'margin-top:0.5rem;font-size:1.1rem;color:var(--color-text)';
        this.container.appendChild(this.scoreEl);
      }
      this.updateScoreDisplay();
    }

    resetLevel() {
      this.pacX = 9;
      this.pacY = 15;
      this.pacDir = DIR.NONE;
      this.pacNextDir = DIR.NONE;
      this.pacMouthAngle = 0;
      this.pacMouthOpen = true;

      this.ghosts = [
        { x: 9, y: 9, dir: DIR.LEFT, color: GHOST_COLORS[0], inHouse: false, releaseTimer: 0 },
        { x: 8, y: 9, dir: DIR.UP, color: GHOST_COLORS[1], inHouse: true, releaseTimer: 90 },
        { x: 10, y: 9, dir: DIR.UP, color: GHOST_COLORS[2], inHouse: true, releaseTimer: 180 },
        { x: 9, y: 8, dir: DIR.DOWN, color: GHOST_COLORS[3], inHouse: true, releaseTimer: 270 },
      ];

      this.frightened = false;
      this.frightenedTimer = 0;
      this.frightenedCount = 0;
      this.tickCounter = 0;
      this.pacMoveCounter = 0;
      this.pacSpeed = 10;
      this.ghostSpeed = 14;
    }

    updateScoreDisplay() {
      if (this.scoreEl) {
        this.scoreEl.textContent = `점수: ${this.score}  |  생명: ${'❤️'.repeat(this.lives)}`;
      }
    }

    bindKeys() {
      this.keyHandler = (e) => {
        if (!this.gameStarted && (e.key === 'Enter' || e.key === ' ')) {
          this.audio.init();
          this.audio.playSFX('start');
          this.audio.playBGM('snake');
          this.gameStarted = true;
          this.resetGame();
          this.update();
          e.preventDefault();
          return;
        }

        if (this.gameOver) return;

        let newDir = null;
        switch (e.key) {
          case 'ArrowUp': newDir = DIR.UP; break;
          case 'ArrowDown': newDir = DIR.DOWN; break;
          case 'ArrowLeft': newDir = DIR.LEFT; break;
          case 'ArrowRight': newDir = DIR.RIGHT; break;
        }

        if (newDir) {
          this.pacNextDir = newDir;
          // 현재 방향이 NONE이면 즉시 적용
          if (this.pacDir === DIR.NONE) {
            this.pacDir = newDir;
          }
          e.preventDefault();
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }

    restart() {
      this.gameOver = false;
      this.resetGame();
      this.removeOverlay();
      this.audio.playBGM('snake');
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

    showWinUI() {
      const title = document.createElement('div');
      title.textContent = '🎉 축하합니다!';
      title.style.cssText = 'color:#4ade80;font:bold 28px sans-serif;margin-bottom:0.3rem';

      const score = document.createElement('div');
      score.textContent = '점수: ' + this.score;
      score.style.cssText = 'color:#eee;font:18px sans-serif;margin-bottom:0.8rem';

      const btnRestart = document.createElement('button');
      btnRestart.textContent = '다시 하기';
      btnRestart.style.cssText = `
        padding: 0.5rem 1.6rem; font: bold 15px sans-serif; cursor: pointer;
        border: none; border-radius: 4px; background: #4ade80; color: #fff;
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

    // ===== 맵 유틸리티 =====
    isWalkable(x, y) {
      // 터널 처리 (좌우 끝)
      if (y === 9 && (x < 0 || x >= COLS)) return true;
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
      const cell = this.map[y][x];
      return cell !== 1 && cell !== 4;
    }

    isWalkableGhost(x, y) {
      if (y === 9 && (x < 0 || x >= COLS)) return true;
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
      const cell = this.map[y][x];
      return cell !== 1;
    }

    // 터널 래핑
    wrapX(x) {
      if (x < 0) return COLS - 1;
      if (x >= COLS) return 0;
      return x;
    }

    // ===== 팩맨 이동 =====
    movePacMan() {
      // 다음 방향으로 전환 시도
      if (this.pacNextDir !== DIR.NONE) {
        const nx = this.pacX + this.pacNextDir.x;
        const ny = this.pacY + this.pacNextDir.y;
        if (this.isWalkable(nx, ny)) {
          this.pacDir = this.pacNextDir;
          this.pacNextDir = DIR.NONE;
        }
      }

      if (this.pacDir === DIR.NONE) return;

      const nx = this.wrapX(this.pacX + this.pacDir.x);
      const ny = this.pacY + this.pacDir.y;

      if (this.isWalkable(nx, ny)) {
        this.pacX = nx;
        this.pacY = ny;
      }

      // 점 먹기
      const cell = this.map[this.pacY] && this.map[this.pacY][this.pacX];
      if (cell === 2) {
        this.map[this.pacY][this.pacX] = 0;
        this.score += 10;
        this.dotsEaten++;
        this.audio.playSFX('eat');
      } else if (cell === 3) {
        this.map[this.pacY][this.pacX] = 0;
        this.score += 50;
        this.dotsEaten++;
        this.frightened = true;
        this.frightenedTimer = 120;
        this.frightenedCount = 0;
        this.audio.playSFX('clear');
      }

      this.updateScoreDisplay();

      // 승리 체크
      if (this.dotsEaten >= this.totalDots) {
        this.gameOver = true;
        this.audio.stopBGM();
        this.audio.playSFX('clear');
        this.draw();
        this.showWinUI();
      }
    }

    // ===== 팬텀 AI =====
    moveGhost(ghost) {
      if (ghost.inHouse) {
        ghost.releaseTimer--;
        if (ghost.releaseTimer <= 0) {
          ghost.inHouse = false;
          ghost.x = 9;
          ghost.y = 7;
          ghost.dir = DIR.LEFT;
        }
        return;
      }

      // 가능한 방향 목록 (현재 방향의 반대 제외)
      const opposites = {
        UP: DIR.DOWN, DOWN: DIR.UP, LEFT: DIR.RIGHT, RIGHT: DIR.LEFT,
      };
      const opposite = opposites[ghost.dir];

      const candidates = [];
      const dirs = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];
      for (const d of dirs) {
        if (d === DIR.NONE) continue;
        if (opposite && d.x === opposite.x && d.y === opposite.y) continue;
        const nx = this.wrapX(ghost.x + d.x);
        const ny = ghost.y + d.y;
        if (this.isWalkableGhost(nx, ny)) {
          candidates.push(d);
        }
      }

      if (candidates.length === 0) {
        // 죽胡同: 반대 방향으로
        const nx = this.wrapX(ghost.x + opposite.x);
        const ny = ghost.y + opposite.y;
        if (this.isWalkableGhost(nx, ny)) {
          ghost.dir = opposite;
          ghost.x = nx;
          ghost.y = ny;
        }
        return;
      }

      let chosen;
      if (this.frightened) {
        // 무작위 방향
        chosen = candidates[Math.floor(Math.random() * candidates.length)];
      } else {
        // 목표 지점까지 가장 가까운 방향 선택 (간단한 추격)
        let targetX = this.pacX;
        let targetY = this.pacY;

        // 팬텀마다 다른 행동
        const idx = this.ghosts.indexOf(ghost);
        if (idx === 1) { // 핑크: 팩맨 앞 4칸
          targetX = this.wrapX(this.pacX + this.pacDir.x * 4);
          targetY = this.pacY + this.pacDir.y * 4;
        } else if (idx === 2) { // 하늘: 팩맨 반대편
          targetX = this.wrapX(1 + (COLS - 1 - this.pacX));
          targetY = (ROWS - 1) - this.pacY;
        } else if (idx === 3) { // 오렌지: 멀리 있으면 추격, 가깝으면 도망
          const dist = Math.abs(ghost.x - this.pacX) + Math.abs(ghost.y - this.pacY);
          if (dist < 8) {
            targetX = 1;
            targetY = ROWS - 2;
          }
        }

        let minDist = Infinity;
        for (const d of candidates) {
          const nx = this.wrapX(ghost.x + d.x);
          const ny = ghost.y + d.y;
          const dist = (nx - targetX) ** 2 + (ny - targetY) ** 2;
          // 다른 팬텀이 있는 칸은 피하도록 패널티
          let penalty = 0;
          for (const other of this.ghosts) {
            if (other === ghost || other.inHouse) continue;
            if (this.wrapX(other.x) === nx && other.y === ny) {
              penalty += 50;
            }
          }
          if (dist + penalty < minDist) {
            minDist = dist + penalty;
            chosen = d;
          }
        }
      }

      ghost.dir = chosen;
      ghost.x = this.wrapX(ghost.x + chosen.x);
      ghost.y = ghost.y + chosen.y;
    }

    // ===== 게임 루프 =====
    update(timestamp) {
      if (this.gameOver) {
        this.draw();
        return;
      }

      this.tickCounter++;

      // 팩맨 이동
      this.pacMoveCounter++;
      if (this.pacMoveCounter >= this.pacSpeed) {
        this.pacMoveCounter = 0;
        this.movePacMan();
      }

      // 팬텀 이동
      const currentGhostSpeed = this.frightened ? this.ghostSpeed * 2 : this.ghostSpeed;
      if (this.tickCounter % currentGhostSpeed === 0) {
        for (const ghost of this.ghosts) {
          this.moveGhost(ghost);
        }
      }

      // frightened 타이머
      if (this.frightened) {
        this.frightenedTimer--;
        if (this.frightenedTimer <= 0) {
          this.frightened = false;
        }
      }

      // 팩맨-팬텀 충돌
      for (const ghost of this.ghosts) {
        if (ghost.inHouse) continue;
        if (ghost.x === this.pacX && ghost.y === this.pacY) {
          if (this.frightened) {
            // 팬텀 먹기
            ghost.x = 9;
            ghost.y = 9;
            ghost.inHouse = true;
            ghost.releaseTimer = 60;
            this.score += 200;
            this.frightenedCount++;
            this.audio.playSFX('clear');
            this.updateScoreDisplay();
          } else {
            // 생명 잃음
            this.lives--;
            this.audio.stopBGM();
            this.audio.playSFX('gameover');
            this.updateScoreDisplay();

            if (this.lives <= 0) {
              this.gameOver = true;
              this.draw();
              this.showGameOverUI();
              return;
            } else {
              // 위치 리셋
              this.pacX = 9;
              this.pacY = 15;
              this.pacDir = DIR.NONE;
              this.pacNextDir = DIR.NONE;
              for (const g of this.ghosts) {
                g.x = 9;
                g.y = 9;
                g.inHouse = true;
                g.releaseTimer = 60;
              }
              this.frightened = false;
              // 잠시 대기 후 BGM 재개
              setTimeout(() => {
                if (!this.gameOver && this.gameStarted) {
                  this.audio.playBGM('snake');
                }
              }, 1000);
            }
          }
        }
      }

      // 입 애니메이션
      if (this.pacDir !== DIR.NONE) {
        this.pacMouthAngle += this.pacMouthOpen ? 0.15 : -0.15;
        if (this.pacMouthAngle >= 0.4) this.pacMouthOpen = false;
        if (this.pacMouthAngle <= 0.02) this.pacMouthOpen = true;
      }

      this.draw();
      this.animationId = requestAnimationFrame((ts) => this.update(ts));
    }

    // ===== 렌더링 =====
    draw() {
      const { ctx, canvas } = this;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 맵 그리기
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = this.map[r][c];
          const x = c * BLOCK;
          const y = r * BLOCK;

          if (cell === 1) {
            // 벽
            ctx.fillStyle = '#1a1aff';
            ctx.fillRect(x, y, BLOCK, BLOCK);
            // 벽 내부 어둡게
            ctx.fillStyle = '#0000aa';
            ctx.fillRect(x + 2, y + 2, BLOCK - 4, BLOCK - 4);
          } else if (cell === 2) {
            // 점
            ctx.fillStyle = '#FFB8AE';
            ctx.beginPath();
            ctx.arc(x + BLOCK / 2, y + BLOCK / 2, 2.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (cell === 3) {
            // 파워 펠릿
            ctx.fillStyle = '#FFB8AE';
            ctx.beginPath();
            ctx.arc(x + BLOCK / 2, y + BLOCK / 2, 6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 팩맨 그리기
      const px = this.pacX * BLOCK + BLOCK / 2;
      const py = this.pacY * BLOCK + BLOCK / 2;
      const mouthAngle = this.pacDir === DIR.NONE ? 0.2 : this.pacMouthAngle;

      // 방향에 따른 각도
      let startAngle = 0;
      if (this.pacDir === DIR.UP) startAngle = -Math.PI / 2;
      else if (this.pacDir === DIR.DOWN) startAngle = Math.PI / 2;
      else if (this.pacDir === DIR.LEFT) startAngle = Math.PI;

      ctx.fillStyle = '#FFFF00';
      ctx.beginPath();
      ctx.arc(px, py, BLOCK / 2 - 1, startAngle + mouthAngle, startAngle + Math.PI * 2 - mouthAngle);
      ctx.lineTo(px, py);
      ctx.fill();

      // 팬텀 그리기
      for (const ghost of this.ghosts) {
        if (ghost.inHouse && ghost.releaseTimer > 0) {
          // 하우스에 있는 팬텀
          const gx = ghost.x * BLOCK + BLOCK / 2;
          const gy = ghost.y * BLOCK + BLOCK / 2;
          ctx.fillStyle = this.frightened ? '#0000FF' : ghost.color;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(gx, gy, BLOCK / 2 - 2, Math.PI, 0);
          ctx.lineTo(gx + BLOCK / 2 - 2, gy + BLOCK / 2 - 2);
          ctx.lineTo(gx - BLOCK / 2 + 2, gy + BLOCK / 2 - 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          // 눈
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(gx - 3, gy - 2, 3, 0, Math.PI * 2);
          ctx.arc(gx + 3, gy - 2, 3, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        const gx = ghost.x * BLOCK + BLOCK / 2;
        const gy = ghost.y * BLOCK + BLOCK / 2;

        if (this.frightened) {
          // frightened 상태
          const flash = this.frightenedTimer < 30 && this.tickCounter % 10 < 5;
          ctx.fillStyle = flash ? '#fff' : '#0000FF';
        } else {
          ctx.fillStyle = ghost.color;
        }

        // 몸체
        ctx.beginPath();
        ctx.arc(gx, gy - 2, BLOCK / 2 - 2, Math.PI, 0);
        ctx.lineTo(gx + BLOCK / 2 - 2, gy + BLOCK / 2 - 2);
        // 물결 모양 아래
        const wave = Math.sin(this.tickCounter * 0.2) * 2;
        for (let i = 0; i < 3; i++) {
          const sx = gx + BLOCK / 2 - 2 - (i * (BLOCK - 4)) / 3;
          const ex = sx - (BLOCK - 4) / 3;
          ctx.lineTo((sx + ex) / 2, gy + BLOCK / 2 - 5 + wave);
          ctx.lineTo(ex, gy + BLOCK / 2 - 2);
        }
        ctx.fill();

        // 눈
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(gx - 3, gy - 3, 3, 0, Math.PI * 2);
        ctx.arc(gx + 3, gy - 3, 3, 0, Math.PI * 2);
        ctx.fill();

        // 눈동자
        ctx.fillStyle = this.frightened ? '#fff' : '#00f';
        const ex = ghost.dir.x * 1.5;
        const ey = ghost.dir.y * 1.5;
        ctx.beginPath();
        ctx.arc(gx - 3 + ex, gy - 3 + ey, 1.5, 0, Math.PI * 2);
        ctx.arc(gx + 3 + ex, gy - 3 + ey, 1.5, 0, Math.PI * 2);
        ctx.fill();

        if (this.frightened) {
          // frightened 입
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          const mouthY = gy + 3;
          for (let i = 0; i < 5; i++) {
            const mx = gx - 6 + i * 3;
            ctx.moveTo(mx, mouthY);
            ctx.lineTo(mx + 1.5, mouthY + (i % 2 === 0 ? 2 : -2));
          }
          ctx.stroke();
        }
      }
    }

    destroy() {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
      this.audio.destroy();
      this.removeOverlay();
      this.container.innerHTML = '';
    }
  }
})();
