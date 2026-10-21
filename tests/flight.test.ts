import type { FlightState, FlightInput } from '../src/flight.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlight, step, enginePower } from '../src/flight.ts';
const run = (s: FlightState, input: FlightInput, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) step(s, input, 1 / 60);
  return s;
};
await test('trimmed cruise remains stable before fuel exhaustion', () => {
  const s = run(createFlight(), {}, 179);
  assert.ok(Math.abs(s.altitude - 1200) < 1);
  assert.ok(Math.abs(s.speed - 52) < 0.1);
  assert.equal(s.ended, false);
});
await test('right bank turns right; neutral input retains bank without runaway roll', () => {
  const s = run(createFlight(), { roll: 1 }, 2);
  const bank = s.bank;
  run(s, {}, 10);
  assert.ok(s.heading > 0);
  assert.ok(s.bank > bank);
  assert.ok(s.bank < bank + 0.11);
});
await test('power off descends, reaches sea and freezes state', () => {
  const s = run(createFlight(), { power: -1 }, 500);
  assert.equal(s.ended, true);
  assert.equal(s.altitude, 0);
  const before = { ...s };
  step(s, { pitch: 1 }, 1);
  assert.deepEqual(s, before);
});
await test('pitch up trades speed for altitude', () => {
  const s = run(createFlight(), { pitch: 1 }, 2);
  run(s, {}, 10);
  assert.ok(s.altitude > 1200);
  assert.ok(s.speed < 52);
});

await test('fuel lasts exactly 180 seconds regardless of throttle', () => {
  for (const throttle of [0.2, 0.65, 1]) {
    const s = createFlight();
    s.throttle = throttle;
    run(s, {}, 179);
    assert.ok(s.fuel > 0);
    assert.ok(enginePower(s) > 0);
    run(s, {}, 1);
    assert.equal(s.fuel, 0);
    assert.equal(enginePower(s), 0);
    assert.equal(s.ended, false);
  }
});
await test('empty tank keeps controls active but cannot restart; new flight refuels', () => {
  const s = run(createFlight(), {}, 180);
  const altitude = s.altitude;
  run(s, { power: 1, roll: 1 }, 5);
  assert.equal(s.throttle, 1);
  assert.equal(enginePower(s), 0);
  assert.ok(s.altitude < altitude);
  assert.ok(s.bank > 0);
  assert.equal(createFlight().fuel, 1);
});
await test('fuel exhaustion leads to sea contact', () => {
  const s = run(createFlight(), {}, 600);
  assert.equal(s.ended, true);
  assert.equal(s.altitude, 0);
  assert.equal(s.fuel, 0);
});

await test('sustained pull-up stalls, loses lift and lowers the nose', () => {
  const state = createFlight();
  while (!state.stalled && state.time < 20) step(state, { pitch: 1 }, 1 / 60);
  assert.equal(state.stalled, true);
  assert.ok(state.speed < 30);
  const pitchAtBreak = state.pitch;
  const verticalAtBreak = state.vertical;
  run(state, { pitch: 1 }, 2);
  assert.ok(state.pitch < pitchAtBreak);
  assert.ok(state.vertical < verticalAtBreak);
});

await test('lowering the nose recovers from a power-off stall with altitude loss', () => {
  const state = createFlight();
  while (!state.stalled && state.time < 20) step(state, { pitch: 1, power: -1 }, 1 / 60);
  assert.equal(state.stalled, true);
  const speedAtBreak = state.speed;
  const altitudeAtBreak = state.altitude;
  run(state, { pitch: -1, power: 1 }, 4);
  assert.equal(state.stalled, false);
  assert.ok(state.speed > speedAtBreak);
  assert.ok(state.altitude < altitudeAtBreak);
  assert.equal(state.ended, false);
});

await test('stall depends on angle of attack rather than a speed threshold', () => {
  const fast = createFlight();
  fast.speed = 75;
  fast.flightPath = -0.3;
  step(fast, {}, 1 / 60);
  assert.equal(fast.stalled, true);
  const slow = createFlight();
  slow.speed = 24;
  step(slow, {}, 1 / 60);
  assert.equal(slow.stalled, false);
});

await test('banking diverts lift and needs pitch input to sustain altitude', () => {
  const state = createFlight();
  state.bank = Math.PI / 4;
  run(state, {}, 3);
  assert.ok(state.altitude < 1200);
  assert.ok(state.heading > 0);
});

await test('stall and recovery remain consistent at different integration steps', () => {
  const simulate = (dt: number) => {
    const state = createFlight();
    let stalled = false;
    for (let tick = 0; tick < Math.round(8 / dt); tick++) {
      step(state, { pitch: 1, power: -1 }, dt);
      stalled ||= state.stalled;
    }
    for (let tick = 0; tick < Math.round(4 / dt); tick++) {
      step(state, { pitch: -1, power: 1 }, dt);
    }
    assert.equal(stalled, true);
    assert.equal(state.stalled, false);
    return state;
  };
  const normal = simulate(1 / 60);
  const fine = simulate(1 / 120);
  assert.ok(Math.abs(normal.altitude - fine.altitude) < 2);
  assert.ok(Math.abs(normal.speed - fine.speed) < 1);
});
