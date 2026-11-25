import { describe, expect, it } from 'vitest';
import { multiplyColor } from '../../src/render/theme';

describe('multiplyColor (dims captured balls, REQUIREMENTS §5.4)', () => {
  it('multiplies each channel like a tint', () => {
    expect(multiplyColor(0xffffff, 0x7a8499)).toBe(0x7a8499);
    expect(multiplyColor(0x000000, 0x7a8499)).toBe(0x000000);
    expect(multiplyColor(0x808080, 0xff0000)).toBe(0x800000);
    expect(multiplyColor(0x123456, 0xffffff)).toBe(0x123456);
  });
});
