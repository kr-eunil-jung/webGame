/**
 * Dino Runner — 크롬 디노 러너 스타일 게임
 *
 * GameRegistry.register() 로 등록되며,
 * init(container) 메서드가 호출됩니다.
 */
(function () {
  'use strict';

  // ===== 상수 =====
  const CANVAS_W = 600;
  const CANVAS_H = 200;
  const GROUND_Y = 170;

  const DINO_X = 60;
  const DINO_W = 32;
  const DINO_H = 44;
  const DINO_DUCK_H = 26;

  const GRAVITY = 0.7;
  const JUMP_FORCE = -10;
  const INITIAL_SPEED = 5;
  const MAX_SPEED = 14;
  const SPEED_INCREMENT = 0.002;

  // ===== GameRegistry 등록 =====
  GameRegistry.register({
    id: 'dino-runner',
    name: '디노런너',
    description: '조종을 뛰게 하고 장애물을 피하세요!',
    init(container) {
      return new DinoRunner(container);
    },
  });

  // ===== 게임 클래스 =====
  class DinoRunner {
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

      // Ground line
      ctx.fillStyle = '#555';
      ctx.fillRect(0, GROUND_Y, CANVAS_W, 2);

      // Dino emoji
      ctx.fillStyle = '#eee';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🦕 디노런너', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '16px sans-serif';
      ctx.fillText('Enter 또는 Space를 눌러 시작하세요', canvas.width / 2, canvas.height / 2 + 10);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('Space/↑: 점프  |  ↓: 웅크리기', canvas.width / 2, canvas.height / 2 + 40);
    }

    resetGame() {
      this.dino = {
        x: DINO_X,
        y: GROUND_Y - DINO_H,
        w: DINO_W,
        h: DINO_H,
        vy: 0,
        jumping: false,
        ducking: false,
        legFrame: 0,
        legTimer: 0,
      };
      this.obstacles = [];
      this.clouds = [];
      this.groundDetails = [];
      this.score = 0;
      this.displayScore = 0;
      this.speed = INITIAL_SPEED;
      this.lastTime = 0;
      this.scoreTimer = 0;
      this.milestoneFlash = 0;
      this.obstacleTimer = 0;
      this.minObstacleGap = 80;

      // Initial clouds
      for (let i = 0; i < 3; i++) {
        this.clouds.push(this.spawnCloud(Math.random() * CANVAS_W));
      }

      // Initial ground details
      for (let i = 0; i < 15; i++) {
        this.groundDetails.push({
          x: Math.random() * CANVAS_W,
          w: Math.random() * 4 + 2,
          h: Math.random() * 2 + 1,
        });
      }

      // Score display
      if (!this.scoreEl) {
        this.scoreEl = document.createElement('div');
        this.scoreEl.style.cssText =
          'margin-top:0.5rem;font-size:1.1rem;color:var(--color-text)';
        this.container.appendChild(this.scoreEl);
      }
    }

    spawnCloud(x) {
      return {
        x: x !== undefined ? x : CANVAS_W + 20,
        y: Math.random() * 60 + 20,
        w: Math.random() * 40 + 30,
        speed: Math.random() * 0.5 + 0.3,
      };
    }

    spawnObstacle() {
      // Higher chance of bird as speed increases
      const birdChance = Math.min(0.45, 0.15 + this.speed * 0.02);
      const type = Math.random() < (1 - birdChance) ? 'cactus' : 'bird';

      if (type === 'cactus') {
        const size = Math.random();
        let w, h;
        if (size < 0.33) {
          w = 14;
          h = 30;
        } else if (size < 0.66) {
          w = 20;
          h = 36;
        } else {
          w = 28;
          h = 42;
        }
        return {
          type: 'cactus',
          x: CANVAS_W + 10,
          y: GROUND_Y - h,
          w: w,
          h: h,
          isGroup: false,
        };
      } else {
        // Bird at different heights
        const heightLevel = Math.random();
        let y;
        if (heightLevel < 0.33) {
          y = GROUND_Y - 50; // High - duck to avoid
        } else if (heightLevel < 0.66) {
          y = GROUND_Y - 36; // Mid - jump or duck
        } else {
          y = GROUND_Y - 22; // Low - jump to avoid
        }
        return {
          type: 'bird',
          x: CANVAS_W + 10,
          y: y,
          w: 30,
          h: 20,
          wingFrame: 0,
          wingTimer: 0,
        };
      }
    }

    spawnCactusGroup() {
      // 2~3 cacti grouped together — harder to jump over
      const count = Math.random() < 0.5 ? 2 : 3;
      const obstacles = [];
      let offsetX = 0;

      for (let i = 0; i < count; i++) {
        const size = Math.random();
        let w, h;
        if (size < 0.4) {
          w = 14;
          h = 30;
        } else if (size < 0.7) {
          w = 20;
          h = 36;
        } else {
          w = 28;
          h = 42;
        }
        obstacles.push({
          type: 'cactus',
          x: CANVAS_W + 10 + offsetX,
          y: GROUND_Y - h,
          w: w,
          h: h,
          isGroup: true,
        });
        offsetX += w + 4;
      }
      return obstacles;
    }

    bindKeys() {
      this.keyHandler = (e) => {
        // 대기화면에서 Enter/Space 누르면 게임 시작
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

        // 게임 중 조작
        if (this.gameStarted && !this.gameOver) {
          if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp') {
            if (!this.dino.jumping) {
              this.dino.vy = JUMP_FORCE;
              this.dino.jumping = true;
              this.dino.ducking = false;
              this.audio.playSFX('rotate');
            }
            e.preventDefault();
          }
          if (e.key === 'ArrowDown') {
            this.dino.ducking = true;
            if (this.dino.jumping) {
              this.dino.vy = Math.max(this.dino.vy, 6);
            }
            e.preventDefault();
          }
        }
      };
      window.addEventListener('keydown', this.keyHandler);

      this.keyUpHandler = (e) => {
        if (e.key === 'ArrowDown' && this.dino) {
          this.dino.ducking = false;
        }
      };
      window.addEventListener('keyup', this.keyUpHandler);
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
      this.audio.stopBGM();
      this.removeOverlay();
      this.showWaitingScreen();
    }

    showGameOverUI() {
      const title = document.createElement('div');
      title.textContent = '게임 종료';
      title.style.cssText = 'color:#e94560;font:bold 28px sans-serif;margin-bottom:0.3rem';

      const score = document.createElement('div');
      score.textContent = '점수: ' + Math.floor(this.score);
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

    // ===== 게임 로직 =====
    updateDino(dt) {
      const d = this.dino;

      // Ducking changes hitbox
      if (d.ducking && !d.jumping) {
        d.h = DINO_DUCK_H;
        d.y = GROUND_Y - DINO_DUCK_H;
      } else if (!d.ducking) {
        d.h = DINO_H;
        if (!d.jumping) {
          d.y = GROUND_Y - DINO_H;
        }
      }

      // Gravity
      if (d.jumping) {
        d.vy += GRAVITY;
        d.y += d.vy;

        if (d.y >= GROUND_Y - d.h) {
          d.y = GROUND_Y - d.h;
          d.vy = 0;
          d.jumping = false;
        }
      }

      // Leg animation
      d.legTimer += dt;
      if (d.legTimer > 100) {
        d.legTimer = 0;
        d.legFrame = d.legFrame === 0 ? 1 : 0;
      }
    }

    updateObstacles(dt) {
      this.obstacleTimer += dt;

      // Spawn obstacles — random interval + occasional groups
      const minGap = Math.max(25, this.minObstacleGap - this.speed * 2);
      const randomFactor = Math.random() * 60 + 20;
      if (this.obstacleTimer > (minGap + randomFactor) * 16.67) {
        // Higher chance of groups at higher speeds
        const groupChance = Math.min(0.4, 0.05 + this.speed * 0.015);
        if (Math.random() < groupChance) {
          this.obstacles.push(...this.spawnCactusGroup());
        } else {
          this.obstacles.push(this.spawnObstacle());
        }
        this.obstacleTimer = 0;
      }

      // Move and remove off-screen obstacles
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const obs = this.obstacles[i];
        obs.x -= this.speed;

        // Bird wing animation
        if (obs.type === 'bird') {
          obs.wingTimer += dt;
          if (obs.wingTimer > 200) {
            obs.wingTimer = 0;
            obs.wingFrame = obs.wingFrame === 0 ? 1 : 0;
          }
        }

        if (obs.x + obs.w < -10) {
          this.obstacles.splice(i, 1);
        }
      }
    }

    updateClouds() {
      for (let i = this.clouds.length - 1; i >= 0; i--) {
        this.clouds[i].x -= this.clouds[i].speed;
        if (this.clouds[i].x + this.clouds[i].w < -10) {
          this.clouds.splice(i, 1);
          this.clouds.push(this.spawnCloud());
        }
      }
    }

    updateGroundDetails() {
      for (let i = this.groundDetails.length - 1; i >= 0; i--) {
        this.groundDetails[i].x -= this.speed;
        if (this.groundDetails[i].x + this.groundDetails[i].w < -10) {
          this.groundDetails.splice(i, 1);
          this.groundDetails.push({
            x: CANVAS_W + Math.random() * 50,
            w: Math.random() * 4 + 2,
            h: Math.random() * 2 + 1,
          });
        }
      }
    }

    updateScore(dt) {
      this.scoreTimer += dt;
      if (this.scoreTimer > 30) {
        this.scoreTimer = 0;
        this.score += 1;
        this.displayScore = Math.floor(this.score);

        // Milestone flash at every 100
        if (this.displayScore % 100 === 0 && this.displayScore > 0) {
          this.milestoneFlash = 30;
          this.audio.playSFX('clear');
        }
      }

      // Increase speed
      if (this.speed < MAX_SPEED) {
        this.speed += SPEED_INCREMENT;
      }

      // Milestone flash decay
      if (this.milestoneFlash > 0) {
        this.milestoneFlash--;
      }
    }

    checkCollision() {
      const d = this.dino;
      const dx = d.x + 4;
      const dy = d.y + 4;
      const dw = d.w - 8;
      const dh = d.h - 8;

      for (const obs of this.obstacles) {
        const ox = obs.x + 2;
        const oy = obs.y + 2;
        const ow = obs.w - 4;
        const oh = obs.h - 4;

        if (dx < ox + ow && dx + dw > ox && dy < oy + oh && dy + dh > oy) {
          return true;
        }
      }
      return false;
    }

    // ===== 렌더링 =====
    drawDino() {
      const { ctx } = this;
      const d = this.dino;
      const color = '#535353';
      const light = '#7a7a7a';

      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      if (d.ducking && !d.jumping) {
        // ===== 웅크린 공룡 (더 넓고 낮음) =====
        const bx = d.x;
        const by = d.y;

        // Tail
        ctx.fillStyle = color;
        ctx.fillRect(bx - 2, by + 6, 6, 4);
        ctx.fillRect(bx - 4, by + 4, 4, 4);

        // Body (horizontal)
        ctx.fillRect(bx + 2, by + 4, 30, 14);
        // Belly highlight
        ctx.fillStyle = light;
        ctx.fillRect(bx + 6, by + 12, 16, 4);
        ctx.fillStyle = color;

        // Head
        ctx.fillRect(bx + 26, by, 16, 14);
        // Snout
        ctx.fillRect(bx + 36, by + 4, 10, 8);
        // Eye (white + pupil)
        ctx.fillStyle = '#fff';
        ctx.fillRect(bx + 34, by + 2, 5, 5);
        ctx.fillStyle = '#111';
        ctx.fillRect(bx + 36, by + 3, 3, 3);
        ctx.fillStyle = color;
        // Mouth line
        ctx.fillRect(bx + 38, by + 10, 8, 2);

        // Legs
        if (d.legFrame === 0) {
          ctx.fillRect(bx + 8, by + 18, 6, 8);
          ctx.fillRect(bx + 22, by + 18, 6, 8);
        } else {
          ctx.fillRect(bx + 12, by + 18, 6, 8);
          ctx.fillRect(bx + 26, by + 18, 6, 8);
        }
      } else {
        // ===== 서있는/점프하는 공룡 =====
        const bx = d.x;
        const by = d.y;

        // Tail
        ctx.fillStyle = color;
        ctx.fillRect(bx - 2, by + 16, 8, 4);
        ctx.fillRect(bx - 4, by + 12, 6, 4);
        ctx.fillRect(bx - 6, by + 10, 4, 4);

        // Body
        ctx.fillRect(bx + 4, by + 14, 18, 20);
        // Belly highlight
        ctx.fillStyle = light;
        ctx.fillRect(bx + 10, by + 22, 8, 8);
        ctx.fillStyle = color;

        // Neck
        ctx.fillRect(bx + 14, by + 8, 8, 8);

        // Head
        ctx.fillRect(bx + 14, by, 20, 16);
        // Snout
        ctx.fillRect(bx + 26, by + 6, 12, 8);
        // Eye (white + pupil)
        ctx.fillStyle = '#fff';
        ctx.fillRect(bx + 26, by + 2, 6, 6);
        ctx.fillStyle = '#111';
        ctx.fillRect(bx + 29, by + 3, 3, 4);
        ctx.fillStyle = color;
        // Mouth line
        ctx.fillRect(bx + 28, by + 12, 10, 2);

        // Tiny arms
        ctx.fillRect(bx + 16, by + 22, 4, 8);
        ctx.fillRect(bx + 18, by + 28, 4, 2);

        // Legs
        if (d.jumping) {
          // Both legs straight down
          ctx.fillRect(bx + 6, by + 34, 6, 10);
          ctx.fillRect(bx + 4, by + 42, 8, 2);
          ctx.fillRect(bx + 16, by + 34, 6, 10);
          ctx.fillRect(bx + 14, by + 42, 8, 2);
        } else if (d.legFrame === 0) {
          // Left leg forward
          ctx.fillRect(bx + 6, by + 34, 6, 10);
          ctx.fillRect(bx + 4, by + 42, 8, 2);
          // Right leg back
          ctx.fillRect(bx + 16, by + 34, 6, 6);
          ctx.fillRect(bx + 18, by + 38, 6, 2);
        } else {
          // Left leg back
          ctx.fillRect(bx + 6, by + 34, 6, 6);
          ctx.fillRect(bx + 8, by + 38, 6, 2);
          // Right leg forward
          ctx.fillRect(bx + 16, by + 34, 6, 10);
          ctx.fillRect(bx + 14, by + 42, 8, 2);
        }
      }
    }

    drawCactus(obs) {
      const { ctx } = this;
      ctx.fillStyle = '#535353';

      // Main stem
      ctx.fillRect(obs.x + obs.w / 2 - 3, obs.y, 6, obs.h);

      // Arms
      if (obs.h > 30) {
        // Left arm
        ctx.fillRect(obs.x, obs.y + 8, obs.w / 2 - 2, 4);
        ctx.fillRect(obs.x, obs.y + 4, 4, 8);
        // Right arm
        ctx.fillRect(obs.x + obs.w / 2 + 2, obs.y + 12, obs.w / 2 - 2, 4);
        ctx.fillRect(obs.x + obs.w - 4, obs.y + 8, 4, 8);
      } else {
        // Small arm
        ctx.fillRect(obs.x + obs.w / 2 + 4, obs.y + 6, 5, 4);
        ctx.fillRect(obs.x + obs.w / 2 + 7, obs.y + 3, 3, 7);
      }
    }

    drawBird(obs) {
      const { ctx } = this;
      ctx.fillStyle = '#535353';

      // Body
      ctx.fillRect(obs.x + 4, obs.y + 8, 22, 8);

      // Beak
      ctx.fillRect(obs.x + 26, obs.y + 10, 6, 4);

      // Eye
      ctx.fillStyle = '#111';
      ctx.fillRect(obs.x + 22, obs.y + 9, 2, 2);
      ctx.fillStyle = '#535353';

      // Wings
      if (obs.wingFrame === 0) {
        // Wings up
        ctx.fillRect(obs.x + 8, obs.y, 12, 8);
        ctx.fillRect(obs.x + 12, obs.y - 4, 6, 6);
      } else {
        // Wings down
        ctx.fillRect(obs.x + 8, obs.y + 16, 12, 8);
        ctx.fillRect(obs.x + 12, obs.y + 22, 6, 4);
      }
    }

    drawCloud(cloud) {
      const { ctx } = this;
      ctx.fillStyle = 'rgba(150, 150, 150, 0.3)';

      const cx = cloud.x;
      const cy = cloud.y;
      const w = cloud.w;

      // Simple cloud shape using circles
      ctx.beginPath();
      ctx.arc(cx + w * 0.3, cy, w * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + w * 0.5, cy - w * 0.1, w * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + w * 0.7, cy, w * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + w * 0.5, cy + w * 0.05, w * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    drawGround() {
      const { ctx } = this;

      // Main ground line
      ctx.fillStyle = '#555';
      ctx.fillRect(0, GROUND_Y, CANVAS_W, 2);

      // Ground details (small bumps/lines for scrolling effect)
      ctx.fillStyle = '#444';
      for (const detail of this.groundDetails) {
        ctx.fillRect(detail.x, GROUND_Y + 4 + Math.random() * 10, detail.w, detail.h);
      }
    }

    drawScore() {
      const { ctx } = this;

      // Milestone flash effect
      if (this.milestoneFlash > 0 && Math.floor(this.milestoneFlash / 3) % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }

      // Score text
      ctx.fillStyle = '#eee';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'right';
      const scoreText = String(Math.floor(this.score)).padStart(5, '0');
      ctx.fillText(scoreText, CANVAS_W - 15, 25);
    }

    draw() {
      const { ctx, canvas } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Clouds
      for (const cloud of this.clouds) {
        this.drawCloud(cloud);
      }

      // Ground
      this.drawGround();

      // Obstacles
      for (const obs of this.obstacles) {
        if (obs.type === 'cactus') {
          this.drawCactus(obs);
        } else {
          this.drawBird(obs);
        }
      }

      // Dino
      this.drawDino();

      // Score
      this.drawScore();

      // Update score element below canvas
      this.scoreEl.textContent = '점수: ' + Math.floor(this.score) + '  |  속도: ' + this.speed.toFixed(1);
    }

    update(timestamp = 0) {
      if (this.gameOver) {
        this.draw();
        return;
      }

      const dt = timestamp - this.lastTime || 16.67;
      this.lastTime = timestamp;

      // Update game state
      this.updateDino(dt);
      this.updateObstacles(dt);
      this.updateClouds();
      this.updateGroundDetails();
      this.updateScore(dt);

      // Check collision
      if (this.checkCollision()) {
        this.gameOver = true;
        this.audio.stopBGM();
        this.audio.playSFX('gameover');
        this.showGameOverUI();
        this.draw();
        return;
      }

      this.draw();
      this.animationId = requestAnimationFrame((ts) => this.update(ts));
    }

    destroy() {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
      if (this.keyUpHandler) window.removeEventListener('keyup', this.keyUpHandler);
      this.audio.destroy();
      this.container.innerHTML = '';
    }
  }
})();
