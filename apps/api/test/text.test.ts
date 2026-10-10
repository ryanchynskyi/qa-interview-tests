import { describe, expect, it } from 'vitest';
import { htmlToText, snippet } from '../src/lib/text';

describe('htmlToText', () => {
  it('drops tags and collapses whitespace', () => {
    expect(htmlToText('<p><b>Реляційна</b>\n  база</p><ul><li>один</li></ul>')).toBe(
      'Реляційна база один',
    );
  });

  it('decodes named and numeric entities', () => {
    expect(htmlToText('a &lt;b&gt; &amp; &quot;c&quot; &#39;d&#39; &#x2014; e&nbsp;f')).toBe(
      'a <b> & "c" \'d\' — e f',
    );
  });

  it('drops script and style blocks', () => {
    expect(htmlToText('x<script>alert(1)</script>y<style>p{}</style>z')).toBe('x y z');
  });
});

describe('snippet', () => {
  const text = 'a'.repeat(100) + ' needle ' + 'b'.repeat(300);

  it('centres on the first match with ellipses', () => {
    const s = snippet(text, 'needle');
    expect(s.startsWith('…')).toBe(true);
    expect(s).toContain('needle');
    expect(s.length).toBeLessThanOrEqual(172);
  });

  it('starts at the beginning when the match is early or missing', () => {
    expect(snippet('needle and more', 'needle').startsWith('needle')).toBe(true);
    expect(snippet('no match here', 'zzz').startsWith('no match')).toBe(true);
  });
});
