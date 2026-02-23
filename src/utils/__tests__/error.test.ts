import { describe, expect, it } from 'bun:test';
import { toErrorMessage } from '../error.js';

describe('toErrorMessage', () => {
  it('Error オブジェクトから message を取り出す', () => {
    expect(toErrorMessage(new Error('something failed'))).toBe('something failed');
  });

  it('文字列はそのまま返す', () => {
    expect(toErrorMessage('raw string error')).toBe('raw string error');
  });

  it('数値は文字列に変換して返す', () => {
    expect(toErrorMessage(42)).toBe('42');
  });

  it('null / undefined も文字列化して返す', () => {
    expect(toErrorMessage(null)).toBe('null');
    expect(toErrorMessage(undefined)).toBe('undefined');
  });

  it('Error のサブクラスからも message を取り出す', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }
    expect(toErrorMessage(new CustomError('custom'))).toBe('custom');
  });
});
