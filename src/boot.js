let ready = false;
let loading = null;

function loadGame() {
  if (ready) return Promise.resolve();
  if (!loading) {
    loading = import('./main.js')
      .then(() => {
        ready = true;
      })
      .catch((err) => {
        loading = null;
        throw err;
      });
  }
  return loading;
}

document.getElementById('game-shell')?.addEventListener(
  'click',
  (e) => {
    if (ready) return;
    const act = e.target.closest('button, li[data-id], .hangar-card');
    if (!act || act.closest('a[href]')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    loadGame()
      .then(() => act.click())
      .catch(() => {});
  },
  true,
);

requestAnimationFrame(() => {
  loadGame();
});
