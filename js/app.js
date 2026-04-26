/**
 * app.js — SPA 진입점
 * 라우팅, 네비게이션, 게임 렌더링을 담당합니다.
 */
(function () {
  'use strict';

  const appRoot = document.getElementById('app-root');
  const gameNav = document.getElementById('game-nav');

  // 현재 실행 중인 게임 인스턴스 (cleanup용)
  let activeGame = null;

  /**
   * 홈 화면 렌더링
   */
  function renderHome() {
    const games = GameRegistry.getAll();
    const cards = games
      .map(
        (g) => `
      <div class="game-card" data-game="${g.id}">
        <h3>${g.name}</h3>
        <p>${g.description}</p>
      </div>`
      )
      .join('');

    appRoot.innerHTML = `
      <div class="home-container">
        <h2>🎮 게임 선택</h2>
        <p>게임 카드를 클릭하여 시작하세요!</p>
        <div class="game-grid">${cards}</div>
      </div>
    `;

    // 카드 클릭 이벤트
    appRoot.querySelectorAll('.game-card').forEach((card) => {
      card.addEventListener('click', () => {
        Router.navigate(card.dataset.game);
      });
    });

    updateNav('home');
  }

  /**
   * 게임 화면 렌더링
   */
  function renderGame(gameId) {
    // 이전 게임 cleanup
    if (activeGame && typeof activeGame.destroy === 'function') {
      activeGame.destroy();
      activeGame = null;
    }

    const gameConfig = GameRegistry.get(gameId);
    if (!gameConfig) {
      appRoot.innerHTML = `<p style="color:var(--color-text-muted)">게임을 찾을 수 없습니다.</p>`;
      updateNav('home');
      return;
    }

    // 게임 컨테이너 생성
    appRoot.innerHTML = `
      <div class="game-wrapper">
        <h2>${gameConfig.name}</h2>
        <div id="game-canvas"></div>
        <div class="game-controls">
          <button id="btn-back">← 뒤로</button>
        </div>
      </div>
    `;

    document.getElementById('btn-back').addEventListener('click', () => {
      Router.navigate('home');
    });

    const container = document.getElementById('game-canvas');
    try {
      activeGame = gameConfig.init(container);
    } catch (err) {
      console.error(`[App] Failed to init ${gameId}:`, err);
      container.innerHTML = `<p style="color:var(--color-primary)">게임 로드에 실패했습니다.</p>`;
    }

    updateNav(gameId);
  }

  /**
   * 네비게이션 버튼 업데이트
   */
  function updateNav(activeId) {
    gameNav.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.game === activeId);
    });
  }

  /**
   * 네비게이션 바에 게임 버튼 추가
   */
  function buildNav() {
    const games = GameRegistry.getAll();
    games.forEach((g) => {
      const btn = document.createElement('button');
      btn.className = 'nav-btn';
      btn.dataset.game = g.id;
      btn.textContent = g.name;
      gameNav.appendChild(btn);
    });
  }

  /**
   * 라우트 변경 핸들러
   */
  Router.onRouteChange((route) => {
    if (route === 'home') {
      renderHome();
    } else {
      renderGame(route);
    }
  });

  // 네비게이션 버튼 클릭 처리 (홈 + 게임 버튼 모두)
  gameNav.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (btn) {
      Router.navigate(btn.dataset.game);
    }
  });

  // 로고 클릭 시 홈으로
  document.querySelector('.logo').addEventListener('click', () => {
    Router.navigate('home');
  });

  // 초기화
  buildNav();
  Router.init();
})();
