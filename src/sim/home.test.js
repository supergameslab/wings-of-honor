import { describe, expect, it } from 'vitest';
import { FUEL } from './constants.js';
import {
  canCommitLand,
  headingAlign,
  homeNav,
  homeStripCenter,
  landingCue,
  landRejectReason,
  linedUp,
  overHomeStrip,
  shouldAutoLand,
  stepLandMeter,
  stripOffset,
} from './home.js';

const field = { x: 0, z: 80, stripX: 0, stripZ: 44, heading: 0, halfW: FUEL.STRIP_HALF_W, halfL: FUEL.STRIP_HALF_L };

describe('home field', () => {
  it('uses the painted strip centre, not the shed spawn', () => {
    const s = homeStripCenter({ x: 0, z: 80, stripX: 0, stripZ: 44 });
    expect(s.z).toBe(44);
    expect(s.x).toBe(0);
  });

  it('measures north of the strip as positive along', () => {
    const o = stripOffset(0, 44 - 20, 0, 0, field, () => -8);
    expect(o.along).toBeCloseTo(20, 5);
    expect(o.side).toBeCloseTo(0, 5);
    expect(o.agl).toBe(8);
    expect(overHomeStrip(o)).toBe(true);
  });

  it('rejects a fly-by well off the painted grass', () => {
    const o = stripOffset(80, 44, 0, 0, field, () => -8);
    expect(overHomeStrip(o)).toBe(false);
    expect(landRejectReason(o)).toBe('LINE UP WITH THE GOLD STRIP');
  });

  it('catches a touchdown without a key press', () => {
    const o = stripOffset(2, 40, 0, 0.2, field, () => -8);
    expect(o.agl).toBe(8);
    expect(shouldAutoLand(o, 0)).toBe(true);
    expect(canCommitLand(o, 0)).toBe(true);
  });

  it('needs lineup before a high approach counts as a landing', () => {
    const o = stripOffset(0, 44, 30, 0, field, () => -8);
    expect(o.agl).toBe(38);
    expect(shouldAutoLand(o, 0)).toBe(false);
    expect(canCommitLand(o, 0)).toBe(false);
    expect(canCommitLand(o, 0.4, true)).toBe(true);
  });

  it('points the compass east when the strip is to the right of north', () => {
    const nav = homeNav(-100, 44, 0, field);
    expect(nav.dist).toBeCloseTo(100, 5);
    expect(nav.rel).toBeCloseTo(-Math.PI / 2, 5);
    expect(headingAlign(0, 0)).toBe(0);
    expect(headingAlign(Math.PI, 0)).toBeCloseTo(0, 5);
  });

  it('tells a taxiing crate to hold fire, then take off', () => {
    const taxi = landingCue({ grounded: true, airspeed: 10, rotateAt: 38 });
    expect(taxi.prompt).toMatch(/TAXI/);
    expect(taxi.takeoffReady).toBe(false);
    const go = landingCue({ grounded: true, airspeed: 40, rotateAt: 38 });
    expect(go.prompt).toMatch(/TAKE OFF/);
    expect(go.takeoffReady).toBe(true);
  });

  it('asks for L once lined up, and shows a home bearing when fuel is low', () => {
    const o = stripOffset(0, 44, 10, 0, field, () => -8);
    expect(linedUp(o)).toBe(true);
    const lined = landingCue({ offset: o, meter: 0.5, fuel: 0.8 });
    expect(lined.prompt).toBe('LAND · L');
    const nav = homeNav(0, 400, 0, field);
    const lost = landingCue({ offset: stripOffset(0, 400, 40, 0, field, () => -8), fuel: 0.2, nav });
    expect(lost.showCompass).toBe(true);
    expect(lost.prompt).toMatch(/FUEL LOW|HOME/);
  });

  it('fills the land meter while the crate holds the line', () => {
    expect(stepLandMeter(0, true, 1.05)).toBeCloseTo(1, 5);
    expect(stepLandMeter(1, false, 1)).toBeCloseTo(0.1, 5);
  });
});
