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
  assert.ok(s.bank < bank + 0.18); // Release drift stays below about ten degrees.
  assert.ok(Math.abs(s.rollRate) < 0.001);
  const settledBank = s.bank;
  run(s, {}, 2);
  assert.ok(Math.abs(s.bank - settledBank) < 0.001);
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
  assert.ok(s.time > 350 && s.time < 390); // Preserve the original neutral glide duration.
});

await test('a short key press eases in rather than instantly reaching full rotation', () => {
  const state = run(createFlight(), { roll: 1, pitch: 1 }, 0.1);
  assert.ok(state.aileron > 0 && state.aileron < 0.4);
  assert.ok(state.elevator > 0 && state.elevator < 0.4);
  assert.ok(state.rollRate > 0 && state.rollRate < 0.04);
  assert.ok(state.pitchRate > 0 && state.pitchRate < 0.02);
});

await test('opposite input arrests rotation before reversing it', () => {
  const state = run(createFlight(), { roll: 1 }, 1);
  const rate = state.rollRate;
  step(state, { roll: -1 }, 1 / 60);
  assert.ok(state.rollRate > 0);
  assert.ok(Math.abs(state.rollRate - rate) < 0.02);
  run(state, { roll: -1 }, 1);
  assert.ok(state.rollRate < 0);
});

await test('low airspeed weakens the controls without disabling them', () => {
  const cruise = run(createFlight(), { roll: 1, pitch: 1 }, 0.5);
  const slow = createFlight();
  slow.speed = 26;
  run(slow, { roll: 1, pitch: 1 }, 0.5);
  assert.ok(slow.bank > 0 && slow.bank < cruise.bank * 0.6);
  assert.ok(slow.pitch > 0 && slow.pitch < cruise.pitch * 0.6);
});

await test('pitch settles after release without auto-levelling', () => {
  const state = run(createFlight(), { pitch: 1 }, 1);
  const releasePitch = state.pitch;
  run(state, {}, 4);
  assert.ok(state.pitch > releasePitch);
  assert.ok(state.pitch < releasePitch + 0.1);
  assert.equal(state.elevator, 0);
  assert.ok(Math.abs(state.pitchRate) < 0.001);
});

await test('control response is consistent at 60 and 120 simulation steps per second', () => {
  const simulate = (frequency: number) => {
    const state = createFlight();
    for (let tick = 0; tick < frequency * 4; tick++) {
      step(state, tick < frequency ? { roll: 1, pitch: 1 } : {}, 1 / frequency);
    }
    return state;
  };
  const normal = simulate(60);
  const fine = simulate(120);
  assert.ok(Math.abs(normal.bank - fine.bank) < 0.005);
  assert.ok(Math.abs(normal.pitch - fine.pitch) < 0.005);
});
