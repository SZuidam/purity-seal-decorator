import { describe, expect, it } from 'vitest';
import { wrapText } from './textLayout';

// Every character is 1 unit wide.
const measure = (t: string) => t.length;

describe('wrapText', () => {
  it('keeps text that fits on one line', () => {
    expect(wrapText('Hail the Emperor', 20, measure)).toEqual(['Hail the Emperor']);
  });

  it('wraps at word boundaries within the width', () => {
    expect(wrapText('Hail the Emperor', 9, measure)).toEqual(['Hail the', 'Emperor']);
  });

  it('honours explicit newlines and keeps empty lines', () => {
    expect(wrapText('Purity\n\nHonour', 20, measure)).toEqual(['Purity', '', 'Honour']);
  });

  it('breaks a word wider than the box between characters', () => {
    expect(wrapText('Ave Imperator', 4, measure)).toEqual(['Ave', 'Impe', 'rato', 'r']);
  });

  it('always places at least one character per line', () => {
    expect(wrapText('ab', 0.5, measure)).toEqual(['a', 'b']);
  });

  it('collapses repeated spaces between words', () => {
    expect(wrapText('a   b', 10, measure)).toEqual(['a b']);
  });
});
