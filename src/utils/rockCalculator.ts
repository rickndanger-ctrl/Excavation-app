import type { RockCalculatorInputs } from '../types/jobsite';

export function calculateCubicYards({ lengthFt, widthFt, depthFt }: RockCalculatorInputs): number {
  const cubicFeet = lengthFt * widthFt * depthFt;
  return cubicFeet / 27;
}

export function formatCubicYards(value: number): string {
  return `${value.toFixed(1)} cubic yards`;
}

export function formatFormula({ lengthFt, widthFt, depthFt }: RockCalculatorInputs): string {
  const cubicFeet = lengthFt * widthFt * depthFt;
  const yards = cubicFeet / 27;
  return `${lengthFt} × ${widthFt} × ${depthFt} = ${cubicFeet} cu ft / 27 = ${yards.toFixed(1)} cu yd`;
}
