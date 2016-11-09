// @flow
export function rgb2hex (r: number, g: number, b: number): string {
  function digits (n: number): string {
    const m: string = Math.round(255 * n).toString(16)
    return m.length === 1 ? `0${m}` : m
  }

  return `#${digits(r)}${digits(g)}${digits(b)}`
}

export function hsl2hex (h: number, s: number, l: number): string {
  if (s === 0) {
    return rgb2hex(l, l, l)
  }
  const var2: number = l < 0.5 ? l * (1 + s) : (l + s) - (s * l)
  const var1: number = 2 * l - var2
  const hue2rgb: (hue: number) => number = (hue: number): number => {
    if (hue < 0) {
      hue += 1
    }
    if (hue > 1) {
      hue -= 1
    }
    if (6 * hue < 1) {
      return var1 + (var2 - var1) * 6 * hue
    }
    if (2 * hue < 1) {
      return var2
    }
    if (3 * hue < 2) {
      return var1 + (var2 - var1) * 6 * (2 / 3 - hue)
    }
    return var1
  }
  return rgb2hex(hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3))
}

export function hueFromName (name: string): number {
  let a: number = 1
  for (let i: number = 0; i < name.length; i++) {
    a = 17 * (a + name.charCodeAt(i)) % 360
  }
  return a / 360
}
