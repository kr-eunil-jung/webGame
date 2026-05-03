/**
 * Space Invaders — 우주 침공자 격파 게임
 *
 * GameRegistry.register() 로 등록되며,
 * init(container) 메서드가 호출됩니다.
 */
(function () {
  'use strict';

  // ===== 상수 =====
  const COLS = 20;
  const ROWS = 20;
  const BLOCK = 20;
  const CANVAS_SIZE = COLS * BLOCK;

  // ===== GameRegistry 등록 =====
  GameRegistry.register({
    id: 'space-invaders',
    name: '스페이스 인베이더',
    description: '우주 침공자들을 격파하세요!',
    init(container) {
      return new SpaceInvadersGame(container);
    },
  });

  // ===== 게임 클래스 =====
  class SpaceInvadersGame {
    constructor(container) {
      this.container = container;
      this.canvas = document.createElement('canvas');
      this.canvas.width = CANVAS_SIZE;
      this.canvas.height = CANVAS_SIZE;
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
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👾 스페이스 인베이더', canvas.width / 2, canvas.height / 2 - 50);
      ctx.font = '16px sans-serif';
      ctx.fillText('Enter 또는 Space를 눌러 시작하세요', canvas.width / 2, canvas.height / 2);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('← → 이동 | Space 발사', canvas.width / 2, canvas.height / 2 + 35);
    }

    resetGame(keepProgress) {
      this.player = { x: 10, y: ROWS - 2 };
      this.bullets = [];
      this.enemyBullets = [];
      if (!keepProgress) {
        this.score = 0;
        this.level = 1;
      }
      this.lives = 3;
      this.lastUpdate = 0;
      this.bulletCooldown = 0;
      this.enemyMoveTimer = 0;
      this.enemyMoveInterval = 40;
      this.enemyDirection = 1;
      this.enemies = [];

      // Score display
      if (!this.scoreEl) {
        this.scoreEl = document.createElement('div');
        this.scoreEl.style.cssText =
          'margin-top:0.5rem;font-size:1.1rem;color:var(--color-text)';
        this.container.appendChild(this.scoreEl);
      }

      this.spawnEnemies();
    }

    spawnEnemies() {
      this.enemies = [];
      const rows = Math.min(3 + Math.floor(this.level / 2), 5);
      const cols = Math.min(6 + Math.floor(this.level / 3), 8);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          this.enemies.push({
            x: c + Math.floor((COLS - cols) / 2),
            y: r + 2,
            alive: true,
            row: r,
          });
        }
      }
      this.enemyMoveInterval = Math.max(15, 40 - this.level * 3);
    }

    bindKeys() {
      this.keyHandler = (e) => {
        // 대기화면에서 Enter/Space 누르면 게임 시작
        if (!this.gameStarted && (e.key === 'Enter' || e.key === ' ')) {
          this.audio.init();
          this.audio.playSFX('start');
          this.audio.playBGM('breakout');
          this.gameStarted = true;
          this.resetGame(false);
          this.update();
          e.preventDefault();
          return;
        }

        if (this.gameOver) return;

        switch (e.key) {
          case 'ArrowLeft':
            if (this.player.x > 0) {
              this.player.x--;
              this.audio.playSFX('move');
            }
            e.preventDefault();
            break;
          case 'ArrowRight':
            if (this.player.x < COLS - 1) {
              this.player.x++;
              this.audio.playSFX('move');
            }
            e.preventDefault();
            break;
          case ' ':
          case 'ArrowUp':
            this.fireBullet();
            e.preventDefault();
            break;
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }

    fireBullet() {
      if (this.bulletCooldown > 0) return;
      this.bullets.push({
        x: this.player.x,
        y: this.player.y - 1,
      });
      this.bulletCooldown = 12;
      this.audio.playSFX('rotate');
    }

    enemyFire() {
      const aliveEnemies = this.enemies.filter((e) => e.alive);
      if (aliveEnemies.length === 0) return;

      // Bottom-most enemies per column优先射击
      const bottomMap = {};
      for (const enemy of aliveEnemies) {
        if (!bottomMap[enemy.x] || enemy.y > bottomMap[enemy.x].y) {
          bottomMap[enemy.x] = enemy;
        }
      }
      const bottomEnemies = Object.values(bottomMap);
      const shooter = bottomEnemies[Math.floor(Math.random() * bottomEnemies.length)];

      this.enemyBullets.push({
        x: shooter.x,
        y: shooter.y + 1,
      });
    }

    restart(keepProgress) {
      this.gameOver = false;
      this.resetGame(keepProgress);
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
      const isWin = this.enemies.every((e) => !e.alive);

      const title = document.createElement('div');
      title.textContent = isWin ? '레벨 클리어!' : '게임 종료';
      title.style.cssText =
        'color:' + (isWin ? '#4ade80' : '#e94560') + ';font:bold 28px sans-serif;margin-bottom:0.3rem';

      const score = document.createElement('div');
      score.textContent = '점수: ' + this.score + '  |  레벨: ' + this.level;
      score.style.cssText = 'color:#eee;font:18px sans-serif;margin-bottom:0.8rem';

      const btnRestart = document.createElement('button');
      btnRestart.textContent = isWin ? '다음 레벨' : '다시 하기';
      btnRestart.style.cssText = `
        padding: 0.5rem 1.6rem; font: bold 15px sans-serif; cursor: pointer;
        border: none; border-radius: 4px; background: #e94560; color: #fff;
      `;
      btnRestart.addEventListener('click', () => {
        if (isWin) {
          this.level++;
        }
        this.restart(isWin);
      });

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
      // Bullet cooldown
      if (this.bulletCooldown > 0) this.bulletCooldown--;

      // Move player bullets
      this.bullets = this.bullets.filter((b) => {
        b.y--;
        return b.y >= 0;
      });

      // Move enemy bullets
      this.enemyBullets = this.enemyBullets.filter((b) => {
        b.y++;
        return b.y < ROWS;
      });

      // Move enemies
      this.enemyMoveTimer++;
      if (this.enemyMoveTimer >= this.enemyMoveInterval) {
        this.enemyMoveTimer = 0;

        let shouldDrop = false;
        const aliveEnemies = this.enemies.filter((e) => e.alive);

        // Check boundaries
        for (const enemy of aliveEnemies) {
          if ((enemy.x + this.enemyDirection > COLS - 1) || (enemy.x + this.enemyDirection < 0)) {
            shouldDrop = true;
            break;
          }
        }

        if (shouldDrop) {
          this.enemyDirection *= -1;
          for (const enemy of this.enemies) {
            if (enemy.alive) enemy.y++;
          }
        } else {
          for (const enemy of this.enemies) {
            if (enemy.alive) enemy.x += this.enemyDirection;
          }
        }

        // Enemy fire
        if (Math.random() < Math.min(0.3, 0.1 + this.level * 0.03)) {
          this.enemyFire();
        }
      }

      // Check bullet-enemy collisions
      for (const bullet of this.bullets) {
        for (const enemy of this.enemies) {
          if (enemy.alive && enemy.x === bullet.x && enemy.y === bullet.y) {
            enemy.alive = false;
            bullet.y = -1; // mark for removal
            this.score += 10 * (3 - Math.min(enemy.row, 2));
            this.audio.playSFX('clear');
            break;
          }
        }
      }
      this.bullets = this.bullets.filter((b) => b.y >= 0);

      // Check enemy bullet-player collision
      for (const bullet of this.enemyBullets) {
        if (bullet.x === this.player.x && bullet.y === this.player.y) {
          this.lives--;
          bullet.y = ROWS + 1; // mark for removal
          this.audio.playSFX('invalid');

          if (this.lives <= 0) {
            this.gameOver = true;
            this.audio.stopBGM();
            this.audio.playSFX('gameover');
            this.showGameOverUI();
            return;
          }
        }
      }
      this.enemyBullets = this.enemyBullets.filter((b) => b.y < ROWS);

      // Check if enemies reached player level
      for (const enemy of this.enemies) {
        if (enemy.alive && enemy.y >= this.player.y) {
          this.gameOver = true;
          this.audio.stopBGM();
          this.audio.playSFX('gameover');
          this.showGameOverUI();
          return;
        }
      }

      // Check if all enemies destroyed (level complete)
      if (this.enemies.every((e) => !e.alive)) {
        this.gameOver = true;
        this.audio.stopBGM();
        this.audio.playSFX('clear');
        this.showGameOverUI();
      }
    }

    draw() {
      const { ctx, canvas } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Stars (static background decoration)
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let i = 0; i < 30; i++) {
        const sx = (i * 37 + 13) % CANVAS_SIZE;
        const sy = (i * 53 + 7) % CANVAS_SIZE;
        ctx.fillRect(sx, sy, 1, 1);
      }

      // Enemies
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;

        // Color by row
        const colors = ['#e94560', '#f59e0b', '#4ade80', '#60a5fa', '#a78bfa'];
        ctx.fillStyle = colors[enemy.row % colors.length];

        // Draw alien shape
        const ex = enemy.x * BLOCK;
        const ey = enemy.y * BLOCK;
        const cx = ex + BLOCK / 2;
        const cy = ey + BLOCK / 2;

        // Body
        ctx.fillRect(ex + 4, ey + 4, BLOCK - 8, BLOCK - 8);
        // Eyes
        ctx.fillStyle = '#111';
        ctx.fillRect(ex + 5, ey + 6, 3, 3);
        ctx.fillRect(ex + BLOCK - 8, ey + 6, 3, 3);
        // Antennae
        ctx.fillStyle = colors[enemy.row % colors.length];
        ctx.fillRect(ex + 3, ey + 1, 2, 4);
        ctx.fillRect(ex + BLOCK - 5, ey + 1, 2, 4);
      }

      // Player
      ctx.fillStyle = '#4ade80';
      const px = this.player.x * BLOCK;
      const py = this.player.y * BLOCK;
      // Ship body
      ctx.fillRect(px + 4, py + 8, BLOCK - 8, BLOCK - 8);
      // Ship top
      ctx.fillRect(px + 8, py + 2, 4, 8);
      // Cannon
      ctx.fillStyle = '#86efac';
      ctx.fillRect(px + 9, py, 2, 4);

      // Player bullets
      ctx.fillStyle = '#fbbf24';
      for (const bullet of this.bullets) {
        ctx.fillRect(bullet.x * BLOCK + 8, bullet.y * BLOCK, 4, BLOCK - 4);
      }

      // Enemy bullets
      ctx.fillStyle = '#e94560';
      for (const bullet of this.enemyBullets) {
        ctx.fillRect(bullet.x * BLOCK + 8, bullet.y * BLOCK, 4, BLOCK - 4);
      }

      // HUD
      this.scoreEl.textContent =
        '점수: ' + this.score + '  |  ❤️ ' + this.lives + '  |  레벨: ' + this.level;
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
      if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
      this.audio.destroy();
      this.container.innerHTML = '';
    }
  }
})();
