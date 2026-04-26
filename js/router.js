/**
 * Router — hash 기반 SPA 라우팅
 */
const Router = (() => {
  let currentRoute = null;
  const listeners = [];

  function parseRoute() {
    const hash = window.location.hash.slice(1) || 'home';
    return hash;
  }

  function navigate(to) {
    window.location.hash = to;
  }

  function onRouteChange(callback) {
    listeners.push(callback);
  }

  function fire() {
    const route = parseRoute();
    if (route === currentRoute) return;
    currentRoute = route;
    listeners.forEach((cb) => cb(route));
  }

  window.addEventListener('hashchange', fire);

  return {
    navigate,
    onRouteChange,
    current: () => currentRoute,
    init() {
      fire();
    },
  };
})();
