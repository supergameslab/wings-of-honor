import { describe, expect, it } from 'vitest';
import { createCraft, integrateFlight, forwardFromEuler, applyPose } from './flight.js';
import { heightAt, makeParams } from './height.js';
import { updateAi, createAiCraft } from './ai.js';
import { bombHitsTarget, bulletHits, segmentHitsSphere, creditKill, spawnBomb, predictBombImpact, predictLanding, stepBomb } from './combat.js';
import { layoutFor, missionById, DIFFICULTY, huntFighterCount, bombingMission, MISSIONS, targetCount, fighterCount, winFor, makeQuickSortie, isCampaignMission, makePrologue, mergeProgress, starRating, usesFuel } from '../campaign.js';
import { sortieKind, clampSortie } from './progress.js';
import { stepConvoy, isStrafeable, groundSpec } from './combat.js';
import { aceById, killScore, applyAceSpec, acesFor } from './aces.js';
import { angleDiff, analogStick } from './math.js';
import { planeById, handlingFor, cockpitGuns, COCKPIT_CAM, COCKPIT_SIGHT, planeRatings } from './planes.js';

function flatHeight() {
  return -42;
}

describe('flight', () => {
  it('moves forward along heading 0 (negative Z)', () => {
    const craft = createCraft({ x: 0, y: 40, z: 80, heading: 0, pitch: 0 });
    const before = craft.z;
    integrateFlight(craft, { pitch: 0, turn: 0 }, 0.05, flatHeight);
    expect(craft.z).toBeLessThan(before);
    expect(Number.isFinite(craft.x)).toBe(true);
  });

  it('clamps pitch and does not NaN under full stick', () => {
    const craft = createCraft({ x: 0, y: 80, z: 0 });
    for (let i = 0; i < 80; i++) {
      integrateFlight(craft, { pitch: 1, turn: 1 }, 0.05, flatHeight, 9, i * 0.05);
    }
    expect(Number.isFinite(craft.pitch)).toBe(true);
    expect(craft.pitch).toBeLessThanOrEqual(0.58);
    expect(Number.isFinite(craft.heading)).toBe(true);
  });

  it('forward vector length is ~1', () => {
    const f = forwardFromEuler(0.4, -0.2);
    expect(Math.hypot(f.x, f.y, f.z)).toBeCloseTo(1, 5);
  });
});

describe('height', () => {
  it('is deterministic for a seed', () => {
    const p = makeParams(217);
    const a = heightAt(12, -40, 'fields', p);
    const b = heightAt(12, -40, 'fields', p);
    expect(a).toBe(b);
    expect(a).not.toBe(heightAt(12, -40, 'mountains', p));
  });
});

describe('layout', () => {
  it('seeds unique fighter counts per mission', () => {
    const a = layoutFor(missionById(1), 'normal');
    const b = layoutFor(missionById(10), 'normal');
    expect(a.enemies.length).toBeGreaterThan(0);
    expect(a.enemies[0].x).not.toBe(b.enemies[0].x);
  });

  it('scales hunt packs with pilots instead of 1-3 scouts', () => {
    const solo = layoutFor(missionById(1), 'normal');
    const hunt = layoutFor(missionById(1), 'normal', { pilotCount: 2 });
    expect(solo.enemies.length).toBeLessThan(6);
    expect(hunt.enemies.length).toBeGreaterThanOrEqual(8);
    expect(huntFighterCount(missionById(1), 'normal', 4)).toBe(16);
  });
});

describe('combat and ai', () => {
  it('credits last hit', () => {
    expect(creditKill('p1', 'p2')).toBe('p1');
    expect(creditKill(null, 'p2')).toBe('p2');
  });

  it('bomb radius includes a nearby target', () => {
    expect(bombHitsTarget(0, 0, 10, 0, 35)).toBe(true);
    expect(bombHitsTarget(0, 0, 80, 0, 35)).toBe(false);
    expect(bulletHits(0, 0, 0, 1, 0, 1, 2.55)).toBe(true);
    expect(segmentHitsSphere(0, 0, 0, 12, 0, 0, 6, 0, 0, 2.5)).toBe(true);
    expect(segmentHitsSphere(0, 0, 0, 12, 0, 0, 6, 8, 0, 2.5)).toBe(false);
  });

  it('bombs inherit forward speed and land ahead', () => {
    const craft = { x: 0, y: 80, z: 0, heading: 0, pitch: 0, speed: 62 };
    const b = spawnBomb(craft, 'p');
    expect(b.vz).toBeLessThan(0);
    expect(Math.abs(b.vx)).toBeLessThan(8);
    stepBomb(b, 0.1);
    expect(b.y).toBeLessThan(80);
    const hit = predictBombImpact(craft, () => 0);
    expect(hit).toBeTruthy();
    expect(hit.z).toBeLessThan(craft.z);
    expect(hit.y).toBeCloseTo(0, 5);
  });

  it('falling bomb lands on the predicted ground mark', () => {
    const craft = { x: 0, y: 80, z: 0, heading: 0, pitch: -0.2, speed: 62 };
    const spawned = spawnBomb(craft, 'p');
    const mark = predictLanding(spawned, () => 0);
    expect(mark).toBeTruthy();
    const b = { ...spawned };
    while (b.y > 2 && b.life > 0) stepBomb(b, 1 / 60);
    expect(Math.hypot(b.x - mark.x, b.z - mark.z)).toBeLessThan(1.5);
    expect(b.y).toBeLessThan(3);
  });

  it('ai stays finite and can fire in a cone', () => {
    const spec = DIFFICULTY.normal;
    const e = createAiCraft({ x: 0, y: 40, z: -30, heading: 0, fireTimer: 0 }, spec);
    const player = { x: 0, y: 40, z: -80, heading: 0, pitch: 0, roll: 0 };
    const result = updateAi(e, player, 0.05, flatHeight, () => 0.1);
    expect(Number.isFinite(e.x + e.y + e.z + e.heading)).toBe(true);
    expect(typeof result.fire).toBe('boolean');
  });

  it('banks through a turn instead of pivoting 180', () => {
    const spec = DIFFICULTY.normal;
    const e = createAiCraft({ x: 0, y: 40, z: 0, heading: 0, fireTimer: 9 }, spec);
    const player = { x: 0, y: 40, z: 90, heading: Math.PI, pitch: 0, roll: 0 };
    const before = e.heading;
    updateAi(e, player, 0.05, flatHeight, () => 0.1);
    expect(Math.abs(angleDiff(before, e.heading))).toBeLessThan(0.28);
    expect(Math.abs(e.roll)).toBeGreaterThan(0.02);
  });

  it('only bombing sorties carry bombs', () => {
    expect(bombingMission(missionById(1))).toBe(false);
    expect(bombingMission(missionById(9))).toBe(false);
    expect(bombingMission(missionById(4))).toBe(true);
    expect(bombingMission(missionById(8))).toBe(true);
    expect(bombingMission(missionById(72))).toBe(true);
    expect(bombingMission(missionById(74))).toBe(true);
  });

  it('has 100 unique campaign sorties with ground-attack kinds', () => {
    expect(MISSIONS.length).toBe(100);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(100);
    expect(missionById(72).targetKind).toBe('trench');
    expect(missionById(73).targetKind).toBe('aa');
    expect(missionById(74).targetKind).toBe('truck');
    expect(missionById(75).targetKind).toBe('troops');
    expect(missionById(100).name).toBe('Last Patrol');
    expect(isStrafeable('trench')).toBe(true);
    expect(isStrafeable('depot')).toBe(false);
    expect(groundSpec('aa').health).toBeGreaterThan(1);
  });

  it('kill quota matches planes in the sky', () => {
    const m = missionById(1);
    expect(winFor(m, 'easy').kills).toBe(fighterCount(m, 'easy'));
    expect(winFor(m, 'normal').kills).toBe(fighterCount(m, 'normal'));
    expect(winFor(m, 'hard').kills).toBe(fighterCount(m, 'hard'));
    expect(fighterCount(m, 'normal')).toBeGreaterThan(fighterCount(m, 'easy'));
    expect(fighterCount(m, 'hard')).toBeGreaterThan(fighterCount(m, 'normal'));
    const both = missionById(8);
    expect(winFor(both, 'normal').kills).toBe(fighterCount(both, 'normal'));
    const laid = layoutFor(m, 'normal');
    expect(laid.enemies.length).toBe(winFor(m, 'normal').kills);
    const ridge = missionById(6);
    const ridgeLaid = layoutFor(ridge, 'normal');
    expect(winFor(ridge, 'normal').kills).toBe(ridgeLaid.enemies.length);
    expect(ridgeLaid.enemies.filter((e) => (e.wave || 0) === 0).length).toBe(3);
    expect(ridgeLaid.enemies.some((e) => e.wave === 1)).toBe(true);
  });

  it('Pilot and Ace send a second wave on bigger scraps', () => {
    const m = { ...missionById(6), fighters: 5, win: { type: 'kills', kills: 5 } };
    const cadet = layoutFor(m, 'easy');
    expect(cadet.enemies.every((e) => (e.wave || 0) === 0)).toBe(true);
    const pilot = layoutFor(m, 'normal');
    expect(pilot.enemies.some((e) => (e.wave || 0) === 0)).toBe(true);
    expect(pilot.enemies.some((e) => e.wave === 1)).toBe(true);
    expect(pilot.enemies.length).toBe(winFor(m, 'normal').kills);
    expect(pilot.enemies.filter((e) => (e.wave || 0) === 0).length).toBe(3);
    expect(pilot.enemies.filter((e) => e.wave === 1).length).toBe(pilot.enemies.length - 3);
    const ace = layoutFor(m, 'hard');
    expect(ace.enemies.some((e) => e.wave === 1)).toBe(true);
    expect(ace.enemies.filter((e) => (e.wave || 0) === 0).length).toBe(3);
    expect(ace.enemies.length).toBeGreaterThan(pilot.enemies.length);
    const quick = { ...makeQuickSortie({ unlocked: 40 }, () => 0.2), fighters: 5, win: { type: 'kills', kills: 5 } };
    const qLaid = layoutFor(quick, 'normal');
    expect(qLaid.enemies.filter((e) => (e.wave || 0) === 0).length).toBe(3);
    expect(qLaid.enemies.some((e) => e.wave === 1)).toBe(true);
  });

  it('burns fuel only on later campaign jobs for Pilot and Ace', () => {
    expect(usesFuel(missionById(1), 'normal')).toBe(false);
    expect(usesFuel(missionById(15), 'easy')).toBe(false);
    expect(usesFuel(missionById(15), 'normal')).toBe(true);
    expect(usesFuel(missionById(15), 'hard')).toBe(true);
    expect(usesFuel(missionById(10), 'hard')).toBe(false);
    const quick = makeQuickSortie({ unlocked: 80 }, () => 0.4);
    expect(usesFuel(quick, 'hard')).toBe(false);
    const hunt = { ...missionById(40), skirmish: true, huntPractice: true };
    expect(usesFuel(hunt, 'hard')).toBe(false);
  });

  it('scales fighters, convoys and flak with difficulty', () => {
    const m = missionById(74);
    expect(fighterCount(m, 'hard')).toBeGreaterThan(fighterCount(m, 'easy'));
    expect(targetCount(m, 'hard')).toBeGreaterThan(targetCount(m, 'easy'));
    const cadet = layoutFor(m, 'easy');
    const ace = layoutFor(m, 'hard');
    expect(ace.enemies.length).toBeGreaterThan(cadet.enemies.length);
    expect(ace.targets.filter((t) => t.kind === 'truck' && t.role === 'primary').length).toBeGreaterThan(
      cadet.targets.filter((t) => t.kind === 'truck' && t.role === 'primary').length,
    );
    expect(ace.targets.some((t) => t.kind === 'aa')).toBe(true);
    expect(winFor(m, 'hard').targets).toBe(targetCount(m, 'hard'));
    const s = { x: 0, z: 0, heading: 0, speed: 10 };
    stepConvoy(s, 1);
    expect(s.z).toBeLessThan(0);
  });

  it('puts named aces in key sorties with extra hull, fire, and score', () => {
    const baron = aceById('hartmann');
    expect(baron.callsign).toBe('Bubi');
    expect(killScore(baron)).toBeGreaterThan(500);
    const spec = DIFFICULTY.normal;
    const hard = applyAceSpec(spec, baron);
    expect(hard.enemyHp).toBeGreaterThan(spec.enemyHp);
    expect(hard.fireInterval).toBeLessThan(spec.fireInterval);
    const iron = layoutFor(missionById(70), 'normal');
    expect(iron.enemies.some((e) => e.ace === 'nishizawa')).toBe(true);
    const last = layoutFor(missionById(100), 'normal');
    expect(last.enemies.filter((e) => e.ace).map((e) => e.ace)).toEqual(['hartmann', 'galland']);
    const hunt = acesFor(missionById(1), { pilotCount: 3 });
    expect(hunt.length).toBe(1);
    const huntLayout = layoutFor(missionById(1), 'normal', { pilotCount: 3 });
    expect(huntLayout.enemies.some((e) => e.ace)).toBe(true);
    expect(acesFor(missionById(2), { pilotCount: 4 }).length).toBe(2);
    const e = createAiCraft({ x: 0, y: 40, z: 0, heading: 0, ace: 'wick' }, spec);
    expect(e.health).toBeGreaterThanOrEqual(spec.enemyHp * 4);
    expect(e.fireInterval).toBeLessThan(spec.fireInterval);
    expect(e.hitRadius).toBeLessThan(5.6);
    expect(e.aceTag).toBe('WICK');
    e.wasHit = true;
    updateAi(e, { x: 0, y: 40, z: 80, heading: 0, pitch: 0 }, 0.05, () => -42);
    expect(e.state).toBe('break');
    expect(e.breakTimer).toBeGreaterThan(2);
  });

  it('rolls a random quick sortie that does not count as campaign', () => {
    const a = makeQuickSortie({ unlocked: 80 }, () => 0.11);
    const b = makeQuickSortie({ unlocked: 80 }, () => 0.91);
    expect(a.skirmish).toBe(true);
    expect(isCampaignMission(a)).toBe(false);
    expect(a.seed).not.toBe(b.seed);
    expect(a.win.type).toBeTruthy();
    const early = makeQuickSortie({ unlocked: 2 }, () => 0.3);
    expect(early.theater).toBe('britain');
    const laid = layoutFor(a, 'normal');
    expect(laid.enemies.length).toBeGreaterThan(0);
  });

  it('prologue does not unlock campaign 2', () => {
    const p = makePrologue();
    expect(p.onboard).toBe(true);
    expect(isCampaignMission(p)).toBe(false);
    const merged = mergeProgress({ unlocked: 1, completed: [] }, { unlocked: 1, onboarded: true });
    expect(merged.unlocked).toBe(1);
    expect(merged.onboarded).toBe(true);
  });

  it('merges cloud save with max unlocked and union completed', () => {
    const m = mergeProgress(
      { unlocked: 4, completed: [1, 2], stars: { 1: 1 } },
      { unlocked: 12, completed: [2, 3], stars: { 1: 3, 3: 2 } },
    );
    expect(m.unlocked).toBe(12);
    expect(m.completed).toEqual([1, 2, 3]);
    expect(m.stars[1]).toBe(3);
    expect(m.stars[3]).toBe(2);
  });

  it('persists sortie kinds and clamps scores', () => {
    expect(sortieKind('quick')).toBe('quick');
    expect(sortieKind('onboard')).toBe('onboard');
    expect(sortieKind('hunt_practice')).toBe('hunt_practice');
    expect(sortieKind('nope')).toBe('campaign');
    const clamped = clampSortie({ kind: 'onboard', score: 9e9, kills: 99 });
    expect(clamped.score).toBe(500000);
    expect(clamped.kills).toBe(40);
    expect(clamped.kind).toBe('onboard');
  });

  it('awards stars only on a win', () => {
    expect(starRating({ win: false, hullPct: 1, elapsed: 10 })).toBe(0);
    expect(starRating({ win: true, hullPct: 0.2, elapsed: 200, par: 80 })).toBe(1);
    expect(starRating({ win: true, hullPct: 0.8, elapsed: 40, par: 80 })).toBe(3);
  });

  it('leaves grounded takeoff after rotate speed', () => {
    const c = createCraft({ x: 0, y: -38, z: 80, grounded: true, speed: 0 });
    expect(c.grounded).toBe(true);
    expect(c.speed).toBe(0);
    for (let i = 0; i < 90; i++) integrateFlight(c, { fire: true, pitch: 0.4 }, 0.05, () => -42);
    expect(c.grounded).toBe(false);
    expect(c.y).toBeGreaterThan(-42 + 4);
  });

  it('takeoff input lifts once speed is nearly rotate', () => {
    const c = createCraft({ x: 0, y: -38, z: 80, grounded: true, speed: 0 });
    const rotate = c.handling.rotateAt || 38;
    c.speed = rotate * 0.86;
    integrateFlight(c, { takeoff: true }, 0.05, () => -42);
    expect(c.grounded).toBe(false);
  });

  it('empty tank glides instead of stopping dead', () => {
    const c = createCraft({ x: 0, y: 90, z: 0, heading: 0, pitch: 0 });
    c.engineOut = true;
    const startY = c.y;
    const startSpeed = c.speed;
    for (let i = 0; i < 50; i++) integrateFlight(c, { pitch: 0 }, 0.05, flatHeight);
    expect(c.speed).toBeLessThan(startSpeed);
    expect(c.y).toBeLessThan(startY);
    expect(c.y).toBeGreaterThan(flatHeight() + 4);
  });

  it('left stick banks and turns the same way', () => {
    const c = createCraft({ y: 80 });
    for (let i = 0; i < 20; i++) integrateFlight(c, { turn: -1, pitch: 0 }, 0.05, flatHeight);
    expect(c.roll).toBeLessThan(0);
    expect(c.x).toBeLessThan(0);
    const pose = { position: { set() {} }, rotation: { order: '', set(x, y, z) { this.z = z; } } };
    applyPose(pose, c);
    expect(pose.rotation.z).toBeGreaterThan(0);
  });

  it('Spitfire turns tighter than Mustang', () => {
    const spit = createCraft({ planeId: 'spitfire', y: 80 });
    const mustang = createCraft({ planeId: 'mustang', y: 80 });
    for (let i = 0; i < 40; i++) {
      integrateFlight(spit, { turn: 1, pitch: 0 }, 0.05, flatHeight);
      integrateFlight(mustang, { turn: 1, pitch: 0 }, 0.05, flatHeight);
    }
    expect(Math.abs(spit.heading)).toBeGreaterThan(Math.abs(mustang.heading));
  });

  it('Spitfire turns the same either way', () => {
    const right = createCraft({ planeId: 'spitfire', y: 80 });
    const left = createCraft({ planeId: 'spitfire', y: 80 });
    for (let i = 0; i < 40; i++) {
      integrateFlight(right, { turn: 1, pitch: 0 }, 0.05, flatHeight);
      integrateFlight(left, { turn: -1, pitch: 0 }, 0.05, flatHeight);
    }
    expect(Math.abs(right.heading)).toBeCloseTo(Math.abs(left.heading), 5);
  });

  it('Spitfire has eight guns, Stuka two', () => {
    expect(planeById('spitfire').guns).toBe(8);
    expect(planeById('stuka').guns).toBe(2);
    expect(planeById('mustang').guns).toBe(6);
    expect(planeById('bf109').guns).toBe(2);
  });

  it('cockpit guns match the hangar plane', () => {
    expect(cockpitGuns('stuka')).toMatchObject({ count: 2, german: true, aldis: false });
    expect(cockpitGuns('spitfire').count).toBe(2);
    expect(cockpitGuns('spitfire').aldis).toBe(true);
    expect(cockpitGuns('bf109')).toMatchObject({ count: 2, german: true, upperWing: false });
    expect(cockpitGuns('mustang').offsets).toHaveLength(2);
    expect(COCKPIT_CAM.y).toBe(COCKPIT_SIGHT.y);
    expect(COCKPIT_CAM.x).toBe(COCKPIT_SIGHT.x);
  });

  it('Mustang dives faster than Spitfire', () => {
    const spit = createCraft({ planeId: 'spitfire', y: 140 });
    const mustang = createCraft({ planeId: 'mustang', y: 140 });
    for (let i = 0; i < 24; i++) {
      integrateFlight(spit, { pitch: -1, turn: 0 }, 0.05, flatHeight);
      integrateFlight(mustang, { pitch: -1, turn: 0 }, 0.05, flatHeight);
    }
    expect(mustang.speed).toBeGreaterThan(spit.speed);
  });

  it('hangar ratings mark Mustang fast and Spitfire tight', () => {
    const pip = (id, trait) => planeRatings(id).find((r) => r.id === trait).pips;
    expect(pip('mustang', 'speed')).toBeGreaterThan(pip('stuka', 'speed'));
    expect(pip('spitfire', 'turn')).toBeGreaterThan(pip('mustang', 'turn'));
    expect(pip('bf109', 'climb')).toBeGreaterThan(pip('stuka', 'climb'));
    expect(pip('spitfire', 'guns')).toBeGreaterThan(pip('stuka', 'guns'));
    expect(pip('hellcat', 'tough')).toBeGreaterThan(pip('bf109', 'tough'));
    expect(pip('stuka', 'dive')).toBeGreaterThan(pip('spitfire', 'dive'));
    expect(pip('mustang', 'speed')).toBe(5);
    expect(pip('spitfire', 'turn')).toBe(5);
    planeRatings('spitfire').forEach((r) => {
      expect(r.pips).toBeGreaterThanOrEqual(1);
      expect(r.pips).toBeLessThanOrEqual(5);
    });
  });

  it('Bf 109 climbs higher than Stuka', () => {
    expect(handlingFor('bf109').maxAgl).toBeGreaterThan(handlingFor('stuka').maxAgl);
    expect(handlingFor('bf109').pitchUp).toBeGreaterThan(handlingFor('spitfire').pitchUp);
  });

  it('practice hunt is a local AI pack with no room id', () => {
    const mission = { ...missionById(3), skirmish: true, huntPractice: true };
    expect(mission.huntPractice).toBe(true);
    expect(mission.matchId).toBeUndefined();
    const laid = layoutFor(mission, 'normal', { pilotCount: 1 });
    expect(laid.enemies.length).toBeGreaterThanOrEqual(8);
    expect(winFor(mission, 'normal').kills).toBe(laid.enemies.length);
  });

  it('fleeing scouts stop shooting', () => {
    const e = createAiCraft({ x: 0, y: 80, z: -40, heading: 0 }, DIFFICULTY.normal);
    e.fleeing = true;
    const r = updateAi(e, { x: 0, y: 80, z: 0, heading: 0, pitch: 0 }, 0.05, flatHeight);
    expect(r.fire).toBe(false);
    expect(r.ram).toBe(false);
  });

  it('touch stick ignores a dead zone and clamps to a circle', () => {
    expect(analogStick(4, 0, 50).x).toBe(0);
    expect(analogStick(4, 0, 50).y).toBe(0);
    const mid = analogStick(30, 0, 50);
    expect(mid.x).toBeGreaterThan(0.3);
    expect(mid.x).toBeLessThan(1);
    expect(mid.y).toBe(0);
    const full = analogStick(80, 0, 50);
    expect(full.x).toBeCloseTo(1, 5);
    const diag = analogStick(80, 80, 50);
    expect(Math.hypot(diag.x, diag.y)).toBeCloseTo(1, 5);
  });
});
