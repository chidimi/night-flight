import { enginePower, type FlightState } from './flight.ts';

/** Canvas instruments also expose their readings to assistive technology. */
export function createInstrumentReadings(container: HTMLElement) {
  const instruments = [
    { name: '燃料', min: 0, max: 100, value: (state: FlightState) => state.fuel * 100 },
    {
      name: '出力',
      min: 0,
      max: 100,
      value: (state: FlightState) => enginePower(state) * 100,
    },
    { name: '高度', min: 0, max: 2400, value: (state: FlightState) => state.altitude },
    {
      name: '速度',
      min: 0,
      max: 260,
      value: (state: FlightState) => state.speed * 1.94384,
    },
    {
      name: '昇降率',
      min: -130,
      max: 130,
      value: (state: FlightState) => state.vertical,
    },
    {
      name: '機首角',
      min: -66,
      max: 66,
      value: (state: FlightState) => (state.pitch * 180) / Math.PI,
    },
    {
      name: 'バンク角',
      min: -66,
      max: 66,
      value: (state: FlightState) => (state.bank * 180) / Math.PI,
    },
  ].map((instrument) => {
    const element = document.createElement('span');
    element.setAttribute('role', 'meter');
    element.setAttribute('aria-label', instrument.name);
    element.setAttribute('aria-valuemin', String(instrument.min));
    element.setAttribute('aria-valuemax', String(instrument.max));
    container.append(element);
    return { ...instrument, element };
  });

  return (state: FlightState): void => {
    for (const instrument of instruments) {
      const value = Math.round(instrument.value(state) * 1000) / 1000;
      instrument.element.setAttribute('aria-valuenow', String(value));
      // Altitude can exceed the initial dial scale.
      instrument.element.setAttribute(
        'aria-valuemax',
        String(Math.max(instrument.max, value)),
      );
    }
  };
}
