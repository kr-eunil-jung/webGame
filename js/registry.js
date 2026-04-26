/**
 * GameRegistry — 게임 등록 및 관리
 *
 * 각 게임은 GameRegistry.register() 로 등록하며,
 * 반드시 { id, name, description, init(container) } 구조를 가져야 합니다.
 */
const GameRegistry = (() => {
  const games = new Map();

  return {
    /**
     * 게임 등록
     * @param {Object} game
     * @param {string} game.id           - 고유 식별자 (URL hash용)
     * @param {string} game.name         - 표시 이름
     * @param {string} game.description  - 홈 화면 설명
     * @param {Function} game.init       - (container: HTMLElement) => GameInstance
     * @param {Object} [game.options]    - 추가 옵션 { category, difficulty }
     */
    register(game) {
      if (!game.id || !game.name || !game.init) {
        console.error('[GameRegistry] Invalid game config:', game);
        return;
      }
      games.set(game.id, {
        id: game.id,
        name: game.name,
        description: game.description || '',
        init: game.init,
        options: game.options || {},
      });
    },

    /** 등록된 게임 목록 반환 */
    getAll() {
      return Array.from(games.values());
    },

    /** ID로 게임 조회 */
    get(id) {
      return games.get(id) || null;
    },
  };
})();
