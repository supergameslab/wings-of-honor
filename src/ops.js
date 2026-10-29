const $ = (id) => document.getElementById(id);

async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: 'include', headers: { 'content-type': 'application/json', ...(opts.headers || {}) }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || String(res.status));
  return data;
}

function table(rows) {
  if (!rows?.length) return '<p>No rows.</p>';
  const keys = Object.keys(rows[0]);
  return `<table><thead><tr>${keys.map((k) => `<th>${k}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${keys.map((k) => `<td>${r[k] ?? ''}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

async function show(page) {
  const body = $('ops-body');
  body.textContent = 'Loading…';
  try {
    if (page === 'overview') {
      const d = await api('/api/ops/overview');
      const t = d.today || {};
      body.innerHTML = `<h2>Today UTC</h2>
        <p>Boots ${t.boots || 0} · Starts ${t.starts || 0} · First kills ${t.first_kills || 0} · Prologue finishes ${t.onboard_finishes || 0} · Mission 1 finishes ${t.mission1_finishes || 0}</p>
        <p>D7 ${t.d7_returns || 0} · Hunt ${t.hunt_matches || 0} · Practice ${t.hunt_practice || 0} · DO minutes ${t.do_minutes || 0} · Hunt wait p50 ${t.median_hunt_wait_s || 0}s · Boot p50 ${t.boot_ms_p50 || 0}ms</p>
        <p>WebGL fail ${t.webgl_fail || 0} · Client errors ${t.client_error || 0} · New aids ${t.new_aids || 0}</p>
        <p>Live rooms ${d.live} · Accounts ${d.players} · Mail fails ${d.mail_fail}</p>
        <pre>${JSON.stringify(d.flags, null, 2)}</pre>`;
    } else if (page === 'funnel') {
      const d = await api('/api/ops/funnel');
      body.innerHTML = `<h2>Funnel</h2>${table(d.days)}`;
    } else if (page === 'campaign') {
      const d = await api('/api/ops/campaign');
      body.innerHTML = `<h2>Mission drop-off (today)</h2>${table(d.missions)}`;
    } else if (page === 'mp') {
      const d = await api('/api/ops/mp');
      body.innerHTML = `<h2>Live</h2>${table(d.live)}<h2>Recent</h2>${table(d.matches)}`;
    } else if (page === 'players') {
      const q = prompt('Search callsign/email (blank = recent)') || '';
      const d = await api('/api/ops/players?q=' + encodeURIComponent(q));
      body.innerHTML = `<h2>Players</h2>${table(d.players)}<h3>Reports</h3>${table(d.reports)}
        <button id="ban-btn">Ban selected id</button>`;
      $('ban-btn')?.addEventListener('click', async () => {
        const userId = prompt('User id to ban');
        if (!userId) return;
        await api('/api/ops/ban', { method: 'POST', body: JSON.stringify({ userId, reason: 'ops' }) });
        show('players');
      });
    } else if (page === 'economy') {
      const d = await api('/api/ops/economy');
      body.innerHTML = `<h2>Entitlements</h2>${table(d.entitlements)}`;
    } else if (page === 'flags') {
      const d = await api('/api/ops/overview');
      body.innerHTML = `<h2>Flags</h2><pre>${JSON.stringify(d.flags, null, 2)}</pre>
        <button data-k="mp_enabled">Toggle MP</button>
        <button data-k="shop_enabled">Toggle shop</button>
        <button data-k="telemetry_enabled">Toggle telemetry</button>`;
      body.querySelectorAll('button[data-k]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const k = btn.dataset.k;
          const next = d.flags[k] === '0' ? '1' : '0';
          await api('/api/ops/flags', { method: 'POST', body: JSON.stringify({ flags: { [k]: next } }) });
          show('flags');
        });
      });
    } else if (page === 'capture') {
      const d = await api('/api/ops/capture');
      body.innerHTML = `<h2>Capture list</h2><p>F9 in a sortie saves a PNG. Honest weather only.</p>${table(d.shots)}`;
    }
  } catch (err) {
    body.textContent = err.message;
    if (String(err.message).includes('ops auth')) {
      $('login').classList.remove('hidden');
      $('desk').classList.add('hidden');
    }
  }
}

$('login-btn')?.addEventListener('click', async () => {
  try {
    await api('/api/ops/login', { method: 'POST', body: JSON.stringify({ secret: $('secret').value }) });
    $('login').classList.add('hidden');
    $('desk').classList.remove('hidden');
    show('overview');
  } catch (err) {
    $('login-status').textContent = err.message;
  }
});

$('logout-btn')?.addEventListener('click', async () => {
  await api('/api/ops/logout', { method: 'POST', body: '{}' });
  location.reload();
});

document.querySelectorAll('.ops-nav button[data-page]').forEach((btn) => {
  btn.addEventListener('click', () => show(btn.dataset.page));
});

api('/api/ops/overview')
  .then(() => {
    $('login').classList.add('hidden');
    $('desk').classList.remove('hidden');
    show('overview');
  })
  .catch(() => {});
