import type { ReactNode } from 'react';
import { TOPIC_LOGOS } from './topic-logos';

/** Stroke symbols for topics without a brand mark, and for the code review sections. */
const PATHS: Record<string, ReactNode> = {
  // a checklist
  manual: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  // request and response
  api: (
    <>
      <path d="M4 9h14l-4-4" />
      <path d="M20 15H6l4 4" />
    </>
  ),
  // connected services
  sysdesign: (
    <>
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <path d="M12 8v4M5 16v-4h14v4" />
    </>
  ),
  // stacked layers
  patterns: (
    <>
      <path d="m12 2 10 5-10 5L2 7z" />
      <path d="m2 12 10 5 10-5" />
      <path d="m2 17 10 5 10-5" />
    </>
  ),
  // a bug, for the "find the bug" code review sections
  fix: (
    <>
      <rect x="8" y="6" width="8" height="14" rx="4" />
      <path d="M12 20v-9M9 6l-1-3M15 6l1-3M8 13H3M21 13h-5M8 9 4 7M16 9l4-2M8 17l-4 2M16 17l4 2" />
    </>
  ),
};

/**
 * Icon for a topic or quiz section id: the brand mark if the topic has one, else a symbol.
 * Code review sections (`pwfix`, `tsfix`) get the bug.
 */
export function TopicIcon({ id, size = 18 }: { id: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
    focusable: 'false' as const,
  };
  const logo = TOPIC_LOGOS[id];
  if (logo) {
    return (
      <svg className="ticon brand" fill="currentColor" {...common}>
        <path d={logo} />
      </svg>
    );
  }
  const key = id in PATHS ? id : id.endsWith('fix') ? 'fix' : null;
  if (!key) return null;
  return (
    <svg
      className="ticon"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...common}
    >
      {PATHS[key]}
    </svg>
  );
}
