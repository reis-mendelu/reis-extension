import { describe, it, expect } from 'vitest';
import { instructionsFromOnclick } from '../boxInstructions';

// Escapes and markup the real fixtures do not happen to contain.
describe('instructionsFromOnclick', () => {
  const call = (body: string) => `uis.box.open_fixed('1','${body}');`;

  it('unescapes JS string escapes', () => {
    expect(instructionsFromOnclick(call("It\\'s due \\u010d\\x41 a\\\\b"), 'X')).toBe(
      "It's due čA a\\b"
    );
  });

  it('decodes entities once, so a teacher typing <b> sees <b>', () => {
    expect(instructionsFromOnclick(call('a &amp;lt;b&amp;gt; &amp; c&nbsp;d &#269;'), 'X')).toBe(
      'a &lt;b&gt; & c d č'
    );
  });

  it('keeps a heading that is not the box name', () => {
    expect(instructionsFromOnclick(call('<b>Pozor:</b><p></p>text'), 'Projekt')).toBe(
      'Pozor:\n\ntext'
    );
  });

  it('is undefined for no call, or nothing but the heading', () => {
    expect(instructionsFromOnclick(null, 'X')).toBeUndefined();
    expect(instructionsFromOnclick('alert(1)', 'X')).toBeUndefined();
    expect(instructionsFromOnclick(call('<b>X:</b><p></p><p></p>  '), 'X')).toBeUndefined();
  });
});
