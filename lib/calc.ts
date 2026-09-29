// 与界面换算保持一致：kWh/L 折算到排放因子单位时除以 1000，GJ/kNm3 等直接相乘。
export function divisorForUnit(unit: string): number {
  return unit === 'kWh' || unit === 'L' ? 1000 : 1;
}

export function emissionsFor(activity: number, unit: string, factor: number): number {
  return (activity * factor) / divisorForUnit(unit);
}
