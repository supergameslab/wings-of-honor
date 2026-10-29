const $ = (id) => document.getElementById(id);

if (window.Capacitor?.isNativePlatform?.()) {
  location.replace('/wings/');
}

async function loadBoard() {
  const list = $('lab-board');
  if (!list) return;
  try {
    const res = await fetch('/api/scores');
    const data = await res.json();
    const rows = data.scores || [];
    if (!rows.length) {
      list.innerHTML = '<li>No scores yet. Be the first aloft.</li>';
      return;
    }
    list.innerHTML = rows
      .slice(0, 8)
      .map((r, i) => `<li><b>${String(i + 1).padStart(2, '0')}</b> <span>${r.name || 'ACE'}</span> <em>${Number(r.score || 0)}</em></li>`)
      .join('');
  } catch {
    list.innerHTML = '<li>Board is warming up.</li>';
  }
}

loadBoard();
