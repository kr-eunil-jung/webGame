/**
 * Asteroids — 클래식 아케이드 아스트로이드 게임
 *
 * GameRegistry.register() 로 등록되며,
 * init(container) 메서드가 호출됩니다.
 */
(function () {
  'use strict';

  // ===== 상수 =====
  const CANVAS_W = 500;
  const CANVAS_H = 500;
  const SHIP_SIZE = 15;
  const SHIP_THRUST = 0.12;
  const SHIP_TURN_SPEED = 0.07;
  const FRICTION = 0.98;
  const BULLET_SPEED = 5;
  const BULLET_LIFE = 60;
  const MAX_BULLETS = 10;
  const FIRE_COOLDOWN = 8;
  const ASTEROID_VERTICES = 8;
  const ASTEROID_SPEED_MIN = 0.5;
  const ASTEROID_SPEED_MAX = 1.5;

  // ===== GameRegistry 등록 =====
  GameRegistry.register({
    id: 'asteroids',
    name: '아스트로이드',
    description: '우주선으로 소행정을 파괴하세요!',
    init(container) {
      return new AsteroidsGame(container);
    },
  });

  // ===== 게임 클래스 =====
  class AsteroidsGame {
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
      ctx.fillText('☄️ 아스트로이드', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '16px sans-serif';
      ctx.fillText('Enter 또는 Space를 눌러 시작하세요', canvas.width / 2, canvas.height / 2 + 10);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('화살표 키: 회전/추진 | Space: 발사', canvas.width / 2, canvas.height / 2 + 40);
    }

    resetGame() {
      this.ship = {
        x: CANVAS_W / 2,
        y: CANVAS_H / 2,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        invincible: 120,
      };
      this.bullets = [];
      this.asteroids = [];
      this.score = 0;
      this.lives = 3;
      this.level = 1;
      this.fireTimer = 0;
      this.keys = {};

      // Score display
      if (!this.scoreEl) {
        this.scoreEl = document.createElement('div');
        this.scoreEl.style.cssText =
          'margin-top:0.5rem;font-size:1.1rem;color:var(--color-text)';
        this.container.appendChild(this.scoreEl);
      }

      this.spawnAsteroids(4 + this.level);
    }

    spawnAsteroids(count) {
      for (let i = 0; i < count; i++) {
        let x, y;
        do {
          x = Math.random() * CANVAS_W;
          y = Math.random() * CANVAS_H;
        } while (this.dist(x, y, CANVAS_W / 2, CANVAS_H / 2) < 100);

        const angle = Math.random() * Math.PI * 2;
        const speed = ASTEROID_SPEED_MIN + Math.random() * (ASTEROID_SPEED_MAX - ASTEROID_SPEED_MIN);
        this.asteroids.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 30 + Math.random() * 20,
          vertices: this.generateVertices(30 + Math.random() * 20),
          rotation: 0,
          rotSpeed: (Math.random() - 0.5) * 0.02,
        });
      }
    }

    generateVertices(radius) {
      const verts = [];
      for (let i = 0; i < ASTEROID_VERTICES; i++) {
        const angle = (i / ASTEROID_VERTICES) * Math.PI * 2;
        const r = radius * (0.7 + Math.random() * 0.3);
        verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
      }
      return verts;
    }

    dist(x1, y1, x2, y2) {
      return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
    }

    wrap(obj) {
      if (obj.x < -obj.radius) obj.x = CANVAS_W + obj.radius;
      if (obj.x > CANVAS_W + obj.radius) obj.x = -obj.radius;
      if (obj.y < -obj.radius) obj.y = CANVAS_H + obj.radius;
      if (obj.y > CANVAS_H + obj.radius) obj.y = -obj.radius;
    }

    bindKeys() {
      this.keyDownHandler = (e) => {
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

        if (this.gameOver) return;

        this.keys[e.key] = true;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
          e.preventDefault();
        }
      };
      this.keyUpHandler = (e) => {
        this.keys[e.key] = false;
      };
      window.addEventListener('keydown', this.keyDownHandler);
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
    updateShip() {
      const ship = this.ship;

      // Rotation
      if (this.keys['ArrowLeft']) ship.angle -= SHIP_TURN_SPEED;
      if (this.keys['ArrowRight']) ship.angle += SHIP_TURN_SPEED;

      // Thrust
      if (this.keys['ArrowUp']) {
        ship.vx += Math.cos(ship.angle) * SHIP_THRUST;
        ship.vy += Math.sin(ship.angle) * SHIP_THRUST;
      }

      // Friction
      ship.vx *= FRICTION;
      ship.vy *= FRICTION;

      // Move
      ship.x += ship.vx;
      ship.y += ship.vy;

      // Wrap
      if (ship.x < 0) ship.x = CANVAS_W;
      if (ship.x > CANVAS_W) ship.x = 0;
      if (ship.y < 0) ship.y = CANVAS_H;
      if (ship.y > CANVAS_H) ship.y = 0;

      // Invincibility countdown
      if (ship.invincible > 0) ship.invincible--;

      // Fire
      if (this.fireTimer > 0) this.fireTimer--;
      if (this.keys[' '] && this.fireTimer === 0 && this.bullets.length < MAX_BULLETS) {
        this.bullets.push({
          x: ship.x + Math.cos(ship.angle) * SHIP_SIZE,
          y: ship.y + Math.sin(ship.angle) * SHIP_SIZE,
          vx: Math.cos(ship.angle) * BULLET_SPEED + ship.vx * 0.5,
          vy: Math.sin(ship.angle) * BULLET_SPEED + ship.vy * 0.5,
          life: BULLET_LIFE,
        });
        this.fireTimer = FIRE_COOLDOWN;
        this.audio.playSFX('move');
      }
    }

    updateBullets() {
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.x += b.vx;
        b.y += b.vy;
        b.life--;

        // Wrap
        if (b.x < 0) b.x = CANVAS_W;
        if (b.x > CANVAS_W) b.x = 0;
        if (b.y < 0) b.y = CANVAS_H;
        if (b.y > CANVAS_H) b.y = 0;

        if (b.life <= 0) {
          this.bullets.splice(i, 1);
        }
      }
    }

    updateAsteroids() {
      for (const a of this.asteroids) {
        a.x += a.vx;
        a.y += a.vy;
        a.rotation += a.rotSpeed;
        this.wrap(a);
      }
    }

    checkCollisions() {
      const ship = this.ship;

      // Bullet vs Asteroid
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        for (let j = this.asteroids.length - 1; j >= 0; j--) {
          const b = this.bullets[i];
          const a = this.asteroids[j];
          if (!b || !a) continue;

          if (this.dist(b.x, b.y, a.x, a.y) < a.radius) {
            this.bullets.splice(i, 1);
            this.destroyAsteroid(j);
            break;
          }
        }
      }

      // Ship vs Asteroid
      if (ship.invincible <= 0) {
        for (const a of this.asteroids) {
          if (this.dist(ship.x, ship.y, a.x, a.y) < a.radius + SHIP_SIZE * 0.6) {
            this.shipHit();
            break;
          }
        }
      }
    }

    destroyAsteroid(index) {
      const a = this.asteroids[index];
      this.asteroids.splice(index, 1);

      // Score: smaller asteroids give more points
      if (a.radius > 35) this.score += 20;
      else if (a.radius > 20) this.score += 50;
      else this.score += 100;

      this.audio.playSFX('clear');

      // Split into smaller asteroids
      if (a.radius > 15) {
        for (let i = 0; i < 2; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = ASTEROID_SPEED_MIN + Math.random() * (ASTEROID_SPEED_MAX - ASTEROID_SPEED_MIN);
          this.asteroids.push({
            x: a.x,
            y: a.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: a.radius * 0.5,
            vertices: this.generateVertices(a.radius * 0.5),
            rotation: 0,
            rotSpeed: (Math.random() - 0.5) * 0.03,
          });
        }
      }

      // Check level complete
      if (this.asteroids.length === 0) {
        this.level++;
        this.ship.invincible = 120;
        this.spawnAsteroids(4 + this.level);
      }
    }

    shipHit() {
      this.lives--;
      this.audio.stopBGM();
      this.audio.playSFX('gameover');

      if (this.lives <= 0) {
        this.gameOver = true;
        this.showGameOverUI();
      } else {
        this.ship.x = CANVAS_W / 2;
        this.ship.y = CANVAS_H / 2;
        this.ship.vx = 0;
        this.ship.vy = 0;
        this.ship.angle = -Math.PI / 2;
        this.ship.invincible = 120;
      }
    }

    // ===== 렌더링 =====
    draw() {
      const { ctx, canvas } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Ship (blink when invincible)
      const ship = this.ship;
      if (this.gameStarted && (ship.invincible <= 0 || Math.floor(ship.invincible / 4) % 2 === 0)) {
        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(ship.angle);

        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(SHIP_SIZE, 0);
        ctx.lineTo(-SHIP_SIZE * 0.7, -SHIP_SIZE * 0.6);
        ctx.lineTo(-SHIP_SIZE * 0.4, 0);
        ctx.lineTo(-SHIP_SIZE * 0.7, SHIP_SIZE * 0.6);
        ctx.closePath();
        ctx.stroke();

        // Thrust flame
        if (this.keys['ArrowUp']) {
          ctx.strokeStyle = '#e94560';
          ctx.beginPath();
          ctx.moveTo(-SHIP_SIZE * 0.4, -SHIP_SIZE * 0.3);
          ctx.lineTo(-SHIP_SIZE * 1.2, 0);
          ctx.lineTo(-SHIP_SIZE * 0.4, SHIP_SIZE * 0.3);
          ctx.stroke();
        }

        ctx.restore();
      }

      // Bullets
      ctx.fillStyle = '#e94560';
      for (const b of this.bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Asteroids
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 1.5;
      for (const a of this.asteroids) {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rotation);
        ctx.beginPath();
        ctx.moveTo(a.vertices[0].x, a.vertices[0].y);
        for (let i = 1; i < a.vertices.length; i++) {
          ctx.lineTo(a.vertices[i].x, a.vertices[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      // HUD
      this.scoreEl.textContent = '점수: ' + this.score + '  |  생명: ' + '❤️'.repeat(this.lives) + '  |  레벨: ' + this.level;
    }

    update() {
      if (this.gameOver) {
        this.draw();
        return;
      }

      this.updateShip();
      this.updateBullets();
      this.updateAsteroids();
      this.checkCollisions();
      this.draw();

      this.animationId = requestAnimationFrame(() => this.update());
    }

    destroy() {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler);
      if (this.keyUpHandler) window.removeEventListener('keyup', this.keyUpHandler);
      this.audio.destroy();
      this.container.innerHTML = '';
    }
  }
})();
