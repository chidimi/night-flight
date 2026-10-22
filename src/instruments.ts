import { translate, type Locale } from './i18n.ts';
import { enginePower, type FlightState } from './flight.ts';

/** Canvas instruments also expose their readings to assistive technology. */
export function createInstrumentReadings(container: HTMLElement) {
  const instruments = [
    {
      name: 'fuel' as const,
      min: 0,
      max: 100,
      value: (state: FlightState) => state.fuel * 100,
    },
    {
      name: 'power' as const,
      min: 0,
      max: 100,
      value: (state: FlightState) => enginePower(state) * 100,
    },
    {
      name: 'altitude' as const,
      min: 0,
      max: 2400,
      value: (state: FlightState) => state.altitude,
    },
    {
      name: 'bank' as const,
      min: -66,
      max: 66,
      value: (state: FlightState) => (state.bank * 180) / Math.PI,
    },
  ].map((instrument) => {
    const element = document.createElement('span');
    element.setAttribute('role', 'meter');

    element.setAttribute('aria-valuemin', String(instrument.min));
    element.setAttribute('aria-valuemax', String(instrument.max));
    container.append(element);
    return { ...instrument, element };
  });

  let previousLocale: Locale | undefined;
  return (state: FlightState, locale: Locale): void => {
    for (const instrument of instruments) {
      if (locale !== previousLocale)
        instrument.element.setAttribute('aria-label', translate(locale, instrument.name));
      const value = Math.round(instrument.value(state) * 1000) / 1000;
      instrument.element.setAttribute('aria-valuenow', String(value));
      // Altitude can exceed the initial dial scale.
      instrument.element.setAttribute(
        'aria-valuemax',
        String(Math.max(instrument.max, value)),
      );
    }
    previousLocale = locale;
  };
}
