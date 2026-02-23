import { describe, expect, it } from 'bun:test';
import { isRecord, parseArray, toBooleanValue, toStringArray, toStringValue } from '../parse.js';

describe('isRecord', () => {
  it('プレーンオブジェクトに対して true を返す', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ key: 'value' })).toBe(true);
  });

  it('null, 配列, プリミティブに対して false を返す', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord('string')).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
  });
});

describe('toStringValue', () => {
  it('文字列を trim して返す', () => {
    expect(toStringValue('hello')).toBe('hello');
    expect(toStringValue('  trimmed  ')).toBe('trimmed');
  });

  it('空文字列やホワイトスペースのみなら undefined を返す', () => {
    expect(toStringValue('')).toBeUndefined();
    expect(toStringValue('   ')).toBeUndefined();
  });

  it('文字列以外の値に対して undefined を返す', () => {
    expect(toStringValue(42)).toBeUndefined();
    expect(toStringValue(null)).toBeUndefined();
    expect(toStringValue(undefined)).toBeUndefined();
    expect(toStringValue(true)).toBeUndefined();
    expect(toStringValue({})).toBeUndefined();
  });
});

describe('toBooleanValue', () => {
  it('boolean 値をそのまま返す', () => {
    expect(toBooleanValue(true)).toBe(true);
    expect(toBooleanValue(false)).toBe(false);
  });

  it('boolean 以外の値に対して undefined を返す', () => {
    expect(toBooleanValue('true')).toBeUndefined();
    expect(toBooleanValue(1)).toBeUndefined();
    expect(toBooleanValue(null)).toBeUndefined();
    expect(toBooleanValue(undefined)).toBeUndefined();
  });
});

describe('toStringArray', () => {
  it('文字列の配列をフィルタリングして返す', () => {
    expect(toStringArray(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('非文字列要素を除外する', () => {
    expect(toStringArray(['a', 42, 'b', null])).toEqual(['a', 'b']);
  });

  it('空文字列・ホワイトスペースのみの要素を除外する', () => {
    expect(toStringArray(['a', '', '   ', 'b'])).toEqual(['a', 'b']);
  });

  it('有効な要素が無い場合は undefined を返す', () => {
    expect(toStringArray([])).toBeUndefined();
    expect(toStringArray(['', '   '])).toBeUndefined();
  });

  it('配列以外の値に対して undefined を返す', () => {
    expect(toStringArray('not-array')).toBeUndefined();
    expect(toStringArray(null)).toBeUndefined();
    expect(toStringArray(undefined)).toBeUndefined();
  });
});

describe('parseArray', () => {
  it('各要素をパーサーで変換し、null を除外して返す', () => {
    const parser = (item: unknown) => {
      if (typeof item === 'number' && item > 0) return item * 2;
      return null;
    };

    expect(parseArray([1, -1, 2, 0, 3], parser)).toEqual([2, 4, 6]);
  });

  it('配列以外の値に対して空配列を返す', () => {
    expect(parseArray(null, () => null)).toEqual([]);
    expect(parseArray(undefined, () => null)).toEqual([]);
    expect(parseArray('string', () => null)).toEqual([]);
    expect(parseArray({}, () => null)).toEqual([]);
  });

  it('全要素が null を返す場合は空配列を返す', () => {
    expect(parseArray([1, 2, 3], () => null)).toEqual([]);
  });

  it('空配列に対して空配列を返す', () => {
    expect(parseArray([], (x) => x as string)).toEqual([]);
  });
});
