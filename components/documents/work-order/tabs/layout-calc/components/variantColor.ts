/** Distinct, theme-neutral hues for design variants (golden-angle spacing). */
export function variantColor(index: number): { fill: string; stroke: string; solid: string } {
  const hue = Math.round((index * 137.508 + 210) % 360);
  return {
    fill: `hsl(${hue} 70% 50% / 0.16)`,
    stroke: `hsl(${hue} 65% 45% / 0.9)`,
    solid: `hsl(${hue} 65% 50%)`,
  };
}
