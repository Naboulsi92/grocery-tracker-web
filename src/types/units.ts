export const UNITS = ['kg', 'g', 'l', 'ml', 'unite'] as const;

export type Unit = (typeof UNITS)[number];

export function isUnit(value: string): value is Unit {
  return (UNITS as readonly string[]).includes(value);
}

export function getUnitStep(unit: Unit | string): number {
  return unit === 'g' || unit === 'ml' ? 100 : 1;
}
