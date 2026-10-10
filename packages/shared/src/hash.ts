/**
 * FNV-1a 32-bit hash in base 36: the exact function from the legacy page.
 * Question and card ids are derived from their text, so ids stay stable when
 * content is added or reordered, and old localStorage progress can be imported.
 */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Legacy question id: hash of question text + newline + code snippet. */
export const questionId = (text: string, code: string): string => fnv1a(text + '\n' + code);

/** Legacy recall card id. */
export const cardId = (question: string): string => fnv1a('r\n' + question);
