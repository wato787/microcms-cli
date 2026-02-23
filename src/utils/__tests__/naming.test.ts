import { describe, expect, it } from 'bun:test';
import { getUniqueName, toPascalCase, toTypePropertyName } from '../naming.js';

describe('toPascalCase', () => {
  it('ハイフン区切りの文字列を PascalCase に変換する', () => {
    expect(toPascalCase('blog-post')).toBe('BlogPost');
  });

  it('アンダースコア区切りの文字列を PascalCase に変換する', () => {
    expect(toPascalCase('blog_post')).toBe('BlogPost');
  });

  it('単一の単語の先頭を大文字にする', () => {
    expect(toPascalCase('blog')).toBe('Blog');
  });

  it('既に PascalCase の文字列はそのまま返す', () => {
    expect(toPascalCase('BlogPost')).toBe('BlogPost');
  });

  it('空文字列に対して "Generated" を返す', () => {
    expect(toPascalCase('')).toBe('Generated');
  });

  it('数字始まりの場合は先頭に "T" を付与する', () => {
    expect(toPascalCase('123abc')).toBe('T123abc');
  });

  it('記号のみの場合は "Generated" を返す', () => {
    expect(toPascalCase('---')).toBe('Generated');
  });

  it('複数の連続する区切り文字を正しく処理する', () => {
    expect(toPascalCase('blog--post__item')).toBe('BlogPostItem');
  });
});

describe('toTypePropertyName', () => {
  it('有効な識別子はそのまま返す', () => {
    expect(toTypePropertyName('fieldId')).toBe('fieldId');
    expect(toTypePropertyName('_private')).toBe('_private');
    expect(toTypePropertyName('$special')).toBe('$special');
  });

  it('無効な識別子は JSON.stringify でクォートする', () => {
    expect(toTypePropertyName('hero section')).toBe('"hero section"');
    expect(toTypePropertyName('my-field')).toBe('"my-field"');
    expect(toTypePropertyName('123start')).toBe('"123start"');
  });
});

describe('getUniqueName', () => {
  it('未使用の名前はそのまま返す', () => {
    const used = new Set<string>();
    expect(getUniqueName('Blog', used)).toBe('Blog');
    expect(used.has('Blog')).toBe(true);
  });

  it('既に使用されている名前には連番サフィックスを付与する', () => {
    const used = new Set<string>(['Blog']);
    expect(getUniqueName('Blog', used)).toBe('Blog2');
    expect(used.has('Blog2')).toBe(true);
  });

  it('連番が衝突する場合は次の番号を試行する', () => {
    const used = new Set<string>(['Blog', 'Blog2', 'Blog3']);
    expect(getUniqueName('Blog', used)).toBe('Blog4');
  });

  it('連続呼び出しで一意性を維持する', () => {
    const used = new Set<string>();
    expect(getUniqueName('Item', used)).toBe('Item');
    expect(getUniqueName('Item', used)).toBe('Item2');
    expect(getUniqueName('Item', used)).toBe('Item3');
  });
});
