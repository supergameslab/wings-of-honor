function mulberry(seed) {
  let s = (seed * 16807 + 11) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function paperGrain(ctx, w, h, rnd, palette) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 22;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.82));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.5));
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(${palette.stainR},${palette.stainG},${palette.stainB},${0.035 + rnd() * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(rnd() * w, rnd() * h, 22 + rnd() * 80, 14 + rnd() * 50, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function wiggly(ctx, ax, ay, bx, by, rnd, kink = 18) {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const sway = (1 - Math.abs(t - 0.5) * 1.6) * kink;
    ctx.lineTo(ax + (bx - ax) * t + (rnd() - 0.5) * sway, ay + (by - ay) * t + (rnd() - 0.5) * sway);
  }
  ctx.stroke();
}

function stippleWood(ctx, x, y, r, rnd) {
  ctx.fillStyle = 'rgba(58, 64, 38, 0.42)';
  const n = Math.floor(r * r * 0.55);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * r;
    ctx.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.72, 1.1, 1.1);
  }
}

function drawTown(ctx, x, y, size, rnd) {
  const n = 8 + Math.floor(size * 18);
  ctx.fillStyle = 'rgba(52, 34, 18, 0.88)';
  for (let i = 0; i < n; i++) {
    const ox = (rnd() - 0.5) * size * 22;
    const oy = (rnd() - 0.5) * size * 14;
    ctx.save();
    ctx.translate(x + ox, y + oy);
    ctx.rotate((rnd() - 0.5) * 0.35);
    ctx.fillRect(0, 0, 1.6 + rnd() * 4.5, 1.2 + rnd() * 2.8);
    ctx.restore();
  }
}

function hatchPatch(ctx, x, y, ww, hh, rnd, angle) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, ww, hh);
  ctx.clip();
  ctx.translate(x + ww / 2, y + hh / 2);
  ctx.rotate(angle);
  ctx.strokeStyle = 'rgba(78, 68, 38, 0.2)';
  ctx.lineWidth = 0.55;
  const span = Math.hypot(ww, hh);
  for (let i = -span; i < span; i += 2.6 + rnd()) {
    ctx.beginPath();
    ctx.moveTo(i, -span);
    ctx.lineTo(i, span);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(70, 58, 32, 0.12)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x, y, ww, hh);
}

export function drawVintageStaffMap(ctx, w, h, opts) {
  const rnd = mulberry((opts.seed || 1) * 9973 + 13);
  const terrain = opts.terrain || 'fields';
  const wash = {
    sea: '#9aa890',
    coast: '#b0ac86',
    lake: '#a4ab86',
    mountains: '#b4a882',
    hills: '#b3ac80',
    desert: '#c6b384',
    savanna: '#bbaa76',
    jungle: '#9aa678',
    town: '#b4ae8c',
    city: '#b0aa8e',
    fields: '#b2ac82',
  };
  ctx.fillStyle = wash[terrain] || wash.fields;
  ctx.fillRect(0, 0, w, h);
  paperGrain(ctx, w, h, rnd, { stainR: 78, stainG: 62, stainB: 36 });

  ctx.save();
  ctx.beginPath();
  ctx.rect(8, 8, w - 16, h - 16);
  ctx.clip();

  for (let y = 8; y < h - 8; y += 22 + rnd() * 18) {
    for (let x = 8; x < w - 8; x += 26 + rnd() * 22) {
      hatchPatch(ctx, x, y, 20 + rnd() * 28, 16 + rnd() * 20, rnd, (rnd() - 0.5) * 0.7);
    }
  }

  if (terrain === 'sea' || terrain === 'coast' || terrain === 'lake') {
    ctx.fillStyle = 'rgba(92, 112, 104, 0.32)';
    const shore = terrain === 'sea' ? h * 0.18 : h * (0.52 + rnd() * 0.16);
    ctx.beginPath();
    ctx.moveTo(0, shore);
    for (let x = 0; x <= w; x += 20) ctx.lineTo(x, shore + Math.sin(x * 0.035 + rnd()) * 16);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();
  }

  if (terrain === 'mountains' || terrain === 'hills') {
    ctx.strokeStyle = 'rgba(86, 68, 42, 0.22)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 14; i++) {
      const y0 = 24 + i * (h / 16);
      ctx.beginPath();
      ctx.moveTo(0, y0);
      for (let x = 0; x <= w; x += 14) ctx.lineTo(x, y0 + Math.sin(x * 0.05 + i * 0.4) * (5 + (i % 3)));
      ctx.stroke();
    }
  }

  const woodCount = terrain === 'jungle' ? 22 : terrain === 'savanna' ? 10 : 14;
  for (let i = 0; i < woodCount; i++) {
    stippleWood(ctx, 20 + rnd() * (w - 40), 20 + rnd() * (h - 40), 12 + rnd() * 26, rnd);
  }

  ctx.strokeStyle = 'rgba(70, 98, 102, 0.45)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  const ry = h * (0.28 + rnd() * 0.38);
  ctx.moveTo(-8, ry);
  ctx.bezierCurveTo(w * 0.28, ry + 36, w * 0.62, ry - 28, w + 8, ry + (rnd() - 0.5) * 50);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(140, 156, 148, 0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const nodes = [];
  for (let i = 0; i < 34; i++) {
    nodes.push({ x: 18 + rnd() * (w - 36), y: 18 + rnd() * (h - 36) });
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    const ranked = nodes
      .map((n, j) => ({ j, d: Math.hypot(a.x - n.x, a.y - n.y) }))
      .filter((n) => n.j !== i)
      .sort((p, q) => p.d - q.d);
    const links = i % 4 === 0 ? 3 : 2;
    for (let k = 0; k < links; k++) {
      const b = nodes[ranked[k].j];
      ctx.strokeStyle = k === 0 && i % 5 === 0 ? 'rgba(48, 32, 16, 0.78)' : 'rgba(58, 40, 22, 0.55)';
      ctx.lineWidth = k === 0 && i % 5 === 0 ? 2.1 : 0.9;
      wiggly(ctx, a.x, a.y, b.x, b.y, rnd, 14);
    }
  }
  for (let i = 0; i < 22; i++) {
    const a = nodes[i];
    ctx.strokeStyle = 'rgba(72, 52, 30, 0.32)';
    ctx.lineWidth = 0.65;
    wiggly(ctx, a.x, a.y, a.x + (rnd() - 0.5) * 70, a.y + (rnd() - 0.5) * 70, rnd, 12);
  }
  ctx.strokeStyle = 'rgba(62, 44, 24, 0.38)';
  ctx.lineWidth = 0.7;
  for (let x = 24; x < w; x += 48 + rnd() * 22) {
    wiggly(ctx, x, 10, x + (rnd() - 0.5) * 36, h - 10, rnd, 10);
  }
  for (let y = 28; y < h; y += 42 + rnd() * 18) {
    wiggly(ctx, 10, y, w - 10, y + (rnd() - 0.5) * 28, rnd, 10);
  }

  ctx.setLineDash([4, 3.5]);
  ctx.strokeStyle = 'rgba(42, 30, 18, 0.5)';
  ctx.lineWidth = 1.15;
  wiggly(ctx, 6, h * 0.18, w - 6, h * 0.82, rnd, 24);
  ctx.setLineDash([]);

  nodes.forEach((n, i) => {
    if (i < 10) drawTown(ctx, n.x, n.y, i < 3 ? 1.2 : 0.55 + rnd() * 0.4, rnd);
    else if (i % 3 === 0) drawTown(ctx, n.x, n.y, 0.35, rnd);
  });

  ctx.fillStyle = 'rgba(48, 32, 18, 0.55)';
  ctx.font = '8px Georgia, serif';
  const labels = ['Ferme', 'Bois', 'Croix', 'Pont', 'Halte'];
  for (let i = 0; i < 5; i++) {
    const n = nodes[i + 4];
    if (n) ctx.fillText(labels[i], n.x + 6, n.y - 6);
  }

  ctx.restore();

  ctx.strokeStyle = 'rgba(52, 36, 20, 0.75)';
  ctx.lineWidth = 2.2;
  ctx.strokeRect(7, 7, w - 14, h - 14);
  ctx.strokeStyle = 'rgba(52, 36, 20, 0.32)';
  ctx.lineWidth = 0.7;
  ctx.strokeRect(11, 11, w - 22, h - 22);
  ctx.strokeStyle = 'rgba(52, 36, 20, 0.45)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 9; i++) {
    const x = 11 + ((w - 22) * i) / 8;
    ctx.beginPath();
    ctx.moveTo(x, 7);
    ctx.lineTo(x, 13);
    ctx.moveTo(x, h - 7);
    ctx.lineTo(x, h - 13);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(44, 30, 16, 0.8)';
  ctx.font = '11px Georgia, serif';
  ctx.fillText(`${String(opts.region || 'SECTOR').toUpperCase()}  ·  NORTH`, 16, 26);
  ctx.font = '9px Georgia, serif';
  ctx.fillStyle = 'rgba(44, 30, 16, 0.5)';
  ctx.fillText('Bureau of Aeronautics  ·  1:80 000', 16, h - 14);

  const bounds = 320;
  const toX = (x) => w / 2 + (x / bounds) * (w * 0.42);
  const toY = (z) => h / 2 + (z / bounds) * (h * 0.38);
  const field = opts.homeField;
  if (field) {
    const sx = toX(field.stripX ?? field.x);
    const sy = toY(field.stripZ ?? field.z);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = 'rgba(176, 132, 48, 0.35)';
    ctx.strokeStyle = '#8a6a28';
    ctx.lineWidth = 1.4;
    ctx.fillRect(-7, -22, 14, 44);
    ctx.strokeRect(-7, -22, 14, 44);
    ctx.fillStyle = '#6b2a1e';
    ctx.font = '9px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOME', 0, -26);
    ctx.restore();
  }
  const player = opts.player;
  if (player) {
    const px = toX(player.position.x);
    const py = toY(player.position.z);
    ctx.fillStyle = '#1a120c';
    ctx.beginPath();
    ctx.moveTo(px, py - 8);
    ctx.lineTo(px + 6, py + 6);
    ctx.lineTo(px - 6, py + 6);
    ctx.closePath();
    ctx.fill();
  }
  (opts.enemies || []).forEach((e) => {
    if (!e.alive) return;
    ctx.fillStyle = '#8a2a1c';
    ctx.beginPath();
    ctx.arc(toX(e.model.position.x), toY(e.model.position.z), 3.2, 0, Math.PI * 2);
    ctx.fill();
  });
  (opts.targets || []).forEach((t) => {
    if (t.userData.health <= 0) return;
    const x = toX(t.position.x);
    const y = toY(t.position.z);
    ctx.strokeStyle = '#c02318';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 7.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#c02318';
    ctx.beginPath();
    ctx.arc(x, y, 2.8, 0, Math.PI * 2);
    ctx.fill();
  });
  (opts.waypoints || []).forEach((wp) => {
    if (wp.hit) return;
    const x = toX(wp.x);
    const y = toY(wp.z);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#2f5a64';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  });
}

export function drawBriefingPhoto(ctx, w, h, mission) {
  const rnd = mulberry((mission.seed || mission.id || 1) * 131 + 7);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#bca57a');
  sky.addColorStop(0.42, '#cbb892');
  sky.addColorStop(1, '#7a6848');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#6e5c3c';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.55);
  for (let x = 0; x <= w; x += 12) ctx.lineTo(x, h * 0.54 + Math.sin(x * 0.05) * 6);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  ctx.fillStyle = '#5a4a30';
  ctx.fillRect(0, h * 0.7, w, h * 0.3);

  const kind = mission.terrain;
  ctx.fillStyle = '#241c14';
  if (kind === 'sea' || kind === 'coast') {
    ctx.fillStyle = '#3a484c';
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
    ctx.fillStyle = '#241c14';
    ctx.beginPath();
    ctx.moveTo(w * 0.18, h * 0.7);
    ctx.lineTo(w * 0.74, h * 0.64);
    ctx.lineTo(w * 0.8, h * 0.72);
    ctx.lineTo(w * 0.16, h * 0.76);
    ctx.fill();
    ctx.fillRect(w * 0.4, h * 0.46, 5, 24);
  } else if (kind === 'mountains') {
    ctx.beginPath();
    ctx.moveTo(0, h * 0.72);
    ctx.lineTo(w * 0.2, h * 0.3);
    ctx.lineTo(w * 0.38, h * 0.56);
    ctx.lineTo(w * 0.6, h * 0.2);
    ctx.lineTo(w * 0.84, h * 0.52);
    ctx.lineTo(w, h * 0.38);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();
  } else {
    ctx.fillRect(w * 0.16, h * 0.56, 78, 16);
    ctx.beginPath();
    ctx.moveTo(w * 0.16, h * 0.56);
    ctx.lineTo(w * 0.3, h * 0.48);
    ctx.lineTo(w * 0.48, h * 0.56);
    ctx.fill();
    ctx.fillRect(w * 0.56, h * 0.6, 7, 30);
    ctx.fillRect(w * 0.52, h * 0.68, 40, 9);
    ctx.strokeStyle = '#241c14';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w * 0.7, h * 0.74, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * 0.8, h * 0.76, 11, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 5; i++) ctx.fillRect(w * 0.07 + i * 16, h * 0.76, 3.5, 16 + rnd() * 10);
  }

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const x = (i / 4) % w;
    const y = Math.floor(i / 4 / w);
    const n = (rnd() - 0.5) * 26;
    const g = d[i] * 0.34 + d[i + 1] * 0.46 + d[i + 2] * 0.2;
    const vig = 1 - Math.hypot(x / w - 0.5, y / h - 0.5) * 0.7;
    d[i] = Math.min(255, (g * 1.1 + 16 + n) * vig);
    d[i + 1] = Math.min(255, (g * 0.9 + 6 + n) * vig);
    d[i + 2] = Math.min(255, (g * 0.58 + n) * vig);
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = 'rgba(36, 24, 12, 0.58)';
  ctx.font = '9px Georgia, serif';
  ctx.fillText(`${mission.region || 'Battle of Britain'} — field plate`, 10, h - 8);
}
