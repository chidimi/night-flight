/** Angles are radians, distances metres, speeds metres per second. */
export interface FlightState {
  x: number;
  z: number;
  altitude: number;
  speed: number;
  pitch: number;
  bank: number;
  heading: number;
  vertical: number;
  /** Direction of velocity relative to the horizon, independent of pitch. */
  flightPath: number;
  stalled: boolean;
  /** Pilot throttle setting, from 0 to 1. */
  throttle: number;
  rollRate: number;
  pitchRate: number;
  /** Active simulation time in seconds; paused time is excluded. */
  time: number;
  /** Remaining fuel fraction, from 0 to 1. */
  fuel: number;
  ended: boolean;
}
export interface FlightInput {
  roll?: number;
  pitch?: number;
  power?: number;
}
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const FUEL_DURATION = 180;
export const enginePower = (state: FlightState): number =>
  state.fuel > 0 ? state.throttle : 0;
export function createFlight(): FlightState {
  return {
    x: 0,
    z: 0,
    altitude: 1200,
    speed: 52,
    pitch: 0,
    bank: 0,
    heading: 0,
    vertical: 0,
    flightPath: 0,
    stalled: false,
    throttle: 0.65,
    rollRate: 0,
    pitchRate: 0,
    time: 0,
    fuel: 1,
    ended: false,
  };
}
// A fictional, trimmed light propeller aircraft, not an aircraft-specific model.
const GRAVITY = 9.81;
const CRUISE_SPEED = 52;
const WING_INCIDENCE = 0.06;
const CRITICAL_ANGLE = 0.26;
const RECOVERY_ANGLE = 0.19;
const TRIM_LIFT = 0.2 + 4.8 * WING_INCIDENCE;
const LIFT_SCALE = GRAVITY / (CRUISE_SPEED ** 2 * TRIM_LIFT);
const cruiseDrag = (0.025 + 0.07 * TRIM_LIFT ** 2) * CRUISE_SPEED ** 2 * LIFT_SCALE;

export const angleOfAttack = (state: FlightState): number =>
  state.pitch + WING_INCIDENCE - state.flightPath;

function liftCoefficient(angle: number): number {
  const attachedLift = 0.2 + 4.8 * clamp(angle, -CRITICAL_ANGLE, CRITICAL_ANGLE);
  // Separated airflow loses lift progressively, rather than switching it off.
  const separation = clamp((Math.abs(angle) - CRITICAL_ANGLE) / 0.18, 0, 1);
  return attachedLift * (1 - separation * 0.75);
}

export function step(state: FlightState, input: FlightInput, deltaSeconds: number): void {
  if (state.ended) return;
  state.time += deltaSeconds;
  state.fuel = Math.max(0, 1 - state.time / FUEL_DURATION);
  if (state.fuel < 1e-10) state.fuel = 0;
  state.throttle = clamp(state.throttle + (input.power || 0) * deltaSeconds * 0.17, 0, 1);

  const attack = angleOfAttack(state);
  if (Math.abs(attack) > CRITICAL_ANGLE) state.stalled = true;
  else if (Math.abs(attack) < RECOVERY_ANGLE) state.stalled = false;

  const controlAuthority = clamp((state.speed / CRUISE_SPEED) ** 2, 0.15, 1.5);
  const rollAuthority = controlAuthority * (state.stalled ? 0.3 : 1);
  const targetRollRate = (input.roll || 0) * 0.3 * rollAuthority;
  // Static stability and the stall break lower the nose. Elevator authority
  // weakens with airspeed; pulling harder cannot hold the aircraft aloft.
  const stallPitch = state.stalled ? -Math.sign(attack) * 0.25 : 0;
  const targetPitchRate =
    (input.pitch || 0) * 0.18 * controlAuthority -
    0.6 * (attack - WING_INCIDENCE) +
    stallPitch;
  state.rollRate += (targetRollRate - state.rollRate) * Math.min(1, deltaSeconds * 3);
  state.pitchRate += (targetPitchRate - state.pitchRate) * Math.min(1, deltaSeconds * 2);
  state.bank = clamp(state.bank + state.rollRate * deltaSeconds, -1.15, 1.15);
  state.pitch = clamp(state.pitch + state.pitchRate * deltaSeconds, -1.15, 1.15);

  const lift = liftCoefficient(attack);
  const dynamicPressure = state.speed ** 2 * LIFT_SCALE;
  const liftAcceleration = dynamicPressure * lift;
  const separatedDrag = state.stalled ? 0.18 : 0;
  const dragAcceleration = dynamicPressure * (0.025 + 0.07 * lift ** 2 + separatedDrag);
  // Approximate constant propeller power as thrust along the flight path.
  const thrustAcceleration =
    (enginePower(state) / 0.65) * cruiseDrag * (CRUISE_SPEED / Math.max(20, state.speed));
  const acceleration =
    thrustAcceleration - dragAcceleration - GRAVITY * Math.sin(state.flightPath);
  const pathRate =
    (liftAcceleration * Math.cos(state.bank) - GRAVITY * Math.cos(state.flightPath)) /
    Math.max(10, state.speed);
  state.speed = clamp(state.speed + acceleration * deltaSeconds, 8, 130);
  state.flightPath = clamp(state.flightPath + pathRate * deltaSeconds, -1.3, 1.3);
  state.vertical = state.speed * Math.sin(state.flightPath);

  // Only horizontal velocity contributes to map travel and coordinated turns.
  const horizontalSpeed = state.speed * Math.cos(state.flightPath);
  const turnRate =
    (liftAcceleration * Math.sin(state.bank)) / Math.max(10, horizontalSpeed);
  state.heading = (state.heading + turnRate * deltaSeconds + Math.PI * 2) % (Math.PI * 2);
  state.altitude += state.vertical * deltaSeconds;
  state.x += Math.sin(state.heading) * horizontalSpeed * deltaSeconds;
  state.z -= Math.cos(state.heading) * horizontalSpeed * deltaSeconds;
  if (state.altitude <= 0) {
    state.altitude = 0;
    state.ended = true;
  }
}
