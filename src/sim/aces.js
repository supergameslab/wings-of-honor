export const ACES = [
  { id: 'wick', name: 'Helmut Wick', callsign: 'Wick', tag: 'WICK', craft: 'bf109', color: 0xc8c2a8, wing: 0x6a7a58, hpMul: 2.75, hpBonus: 6, fireMul: 0.62, speedMul: 1.1, hitR: 3.35, score: 1400 },
  { id: 'molders', name: 'Werner Mölders', callsign: 'Vati', tag: 'MOLDERS', craft: 'bf109', color: 0xb8c0b4, wing: 0x4a5a48, hpMul: 2.9, hpBonus: 7, fireMul: 0.56, speedMul: 1.12, hitR: 3.25, score: 1500 },
  { id: 'galland', name: 'Adolf Galland', callsign: 'Dolfo', tag: 'GALLAND', craft: 'bf109', color: 0x3a4a52, wing: 0xc4a24a, hpMul: 3.2, hpBonus: 8, fireMul: 0.5, speedMul: 1.16, hitR: 3.05, score: 1800 },
  { id: 'oesau', name: 'Walter Oesau', callsign: 'Gulle', tag: 'OESAU', craft: 'bf109', color: 0x8a9a88, wing: 0x5a6848, hpMul: 2.85, hpBonus: 6, fireMul: 0.58, speedMul: 1.11, hitR: 3.3, score: 1450 },
  { id: 'lutzow', name: 'Günther Lützow', callsign: 'Franzl', tag: 'LUTZOW', craft: 'bf109', color: 0x6a7a6a, wing: 0x3d5a38, hpMul: 2.9, hpBonus: 7, fireMul: 0.56, speedMul: 1.12, hitR: 3.2, score: 1500 },
  { id: 'marseille', name: 'Hans-Joachim Marseille', callsign: 'Star of Africa', tag: 'MARSEILLE', craft: 'bf109', color: 0xd2b46a, wing: 0xc4a24a, hpMul: 3.45, hpBonus: 8, fireMul: 0.44, speedMul: 1.2, hitR: 2.85, score: 2100 },
  { id: 'priller', name: 'Josef Priller', callsign: 'Pips', tag: 'PRILLER', craft: 'bf109', color: 0xc45a28, wing: 0xe8dcc0, hpMul: 3.1, hpBonus: 7, fireMul: 0.52, speedMul: 1.14, hitR: 3.1, score: 1700 },
  { id: 'steinhoff', name: 'Johannes Steinhoff', callsign: 'Macky', tag: 'STEINHOFF', craft: 'bf109', color: 0x4a5a6a, wing: 0xc8c0a8, hpMul: 3.05, hpBonus: 7, fireMul: 0.53, speedMul: 1.13, hitR: 3.1, score: 1650 },
  { id: 'rall', name: 'Günther Rall', callsign: 'Rall', tag: 'RALL', craft: 'bf109', color: 0x3a6a48, wing: 0xc4b898, hpMul: 3.25, hpBonus: 8, fireMul: 0.48, speedMul: 1.17, hitR: 2.95, score: 1900 },
  { id: 'barkhorn', name: 'Gerhard Barkhorn', callsign: 'Gerd', tag: 'BARKHORN', craft: 'bf109', color: 0x5a6a58, wing: 0x8a241c, hpMul: 3.3, hpBonus: 8, fireMul: 0.47, speedMul: 1.18, hitR: 2.92, score: 2000 },
  { id: 'nowotny', name: 'Walter Nowotny', callsign: 'Nowi', tag: 'NOWOTNY', craft: 'bf109', color: 0x8a4a28, wing: 0xd8c8a0, hpMul: 3.15, hpBonus: 7, fireMul: 0.5, speedMul: 1.15, hitR: 3.0, score: 1750 },
  { id: 'baer', name: 'Heinz Bär', callsign: 'Pritzl', tag: 'BAER', craft: 'bf109', color: 0x6a7a4a, wing: 0x4a5a38, hpMul: 3.05, hpBonus: 7, fireMul: 0.52, speedMul: 1.14, hitR: 3.1, score: 1700 },
  { id: 'rudorffer', name: 'Erich Rudorffer', callsign: 'Rudorffer', tag: 'RUDORFFER', craft: 'bf109', color: 0x3a4a38, wing: 0xc4b898, hpMul: 3.0, hpBonus: 7, fireMul: 0.54, speedMul: 1.13, hitR: 3.15, score: 1600 },
  { id: 'sakai', name: 'Saburo Sakai', callsign: 'Sakai', tag: 'SAKAI', craft: 'zero', color: 0xc4b060, wing: 0x3d5a38, hpMul: 3.2, hpBonus: 8, fireMul: 0.5, speedMul: 1.16, hitR: 3.0, score: 1800 },
  { id: 'nishizawa', name: 'Hiroyoshi Nishizawa', callsign: 'Devil of Rabaul', tag: 'NISHIZAWA', craft: 'zero', color: 0x1a1a1c, wing: 0x2a2a30, hpMul: 3.35, hpBonus: 8, fireMul: 0.46, speedMul: 1.2, hitR: 2.9, score: 2000 },
  { id: 'hartmann', name: 'Erich Hartmann', callsign: 'Bubi', tag: 'HARTMANN', craft: 'bf109', color: 0xc4b898, wing: 0x8a241c, hpMul: 4.1, hpBonus: 10, fireMul: 0.42, speedMul: 1.22, hitR: 2.7, score: 2500 },
];

export function aceById(id) {
  return ACES.find((a) => a.id === id) || null;
}

export function acesFor(mission, opts = {}) {
  const listed = (mission?.aces || []).map(aceById).filter(Boolean).map((a) => a.id);
  if (listed.length) return listed;
  if (opts.pilotCount) {
    const n = opts.pilotCount >= 4 ? 2 : 1;
    const start = Math.abs(mission?.id || mission?.seed || 0) % ACES.length;
    return Array.from({ length: n }, (_, i) => ACES[(start + i) % ACES.length].id);
  }
  return [];
}

export function applyAceSpec(spec, ace) {
  if (!ace) return spec;
  const hp = Math.max(spec.enemyHp * 4 + 5, Math.round(spec.enemyHp * (ace.hpMul || 2.9) + (ace.hpBonus || 7)));
  return {
    ...spec,
    enemyHp: hp,
    fireInterval: spec.fireInterval * (ace.fireMul || 0.54),
    enemySpeed: spec.enemySpeed * (ace.speedMul || 1.12),
    hitRadius: ace.hitR || 3.2,
  };
}

export function killScore(ace) {
  return ace?.score || 500;
}
