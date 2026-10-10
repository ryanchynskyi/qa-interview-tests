import { useState } from 'react';
import type { XpDay } from '@qa-hub/shared';
import { useT } from '../i18n';

const W = 640;
const H = 190;
const PAD = { top: 22, right: 8, bottom: 24, left: 36 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const BAR_MAX = 16;
const RADIUS = 4;

/** 1, 2, 5 × 10^k at or above `v`: clean axis maxima. */
function niceCeil(v: number): number {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const short = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`;

/** Column with a 4px rounded top and a square base on the baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, w / 2, h);
  const base = y + h;
  return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`;
}

/** XP per day: a single series, so one hue and no legend; the title names it. */
export function XpChart({ days }: { days: XpDay[] }) {
  const t = useT();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...days.map((d) => d.xp));
  const top = niceCeil(max);
  const band = PLOT_W / days.length;
  const barW = Math.min(BAR_MAX, band - 2);
  const peak = max > 0 ? days.findIndex((d) => d.xp === max) : -1;
  const y = (v: number) => PAD.top + PLOT_H - (v / top) * PLOT_H;
  const total = days.reduce((n, d) => n + d.xp, 0);
  const activeDays = days.filter((d) => d.xp > 0).length;

  return (
    <figure className="xpchart" style={{ margin: 0 }}>
      <figcaption className="note">
        {t.xp.lastDays(days.length)} <b className="hero">{total}</b> · {t.xp.activeDays}{' '}
        {activeDays}
      </figcaption>
      <div className="xpchart-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.xp.chartLabel(total)}>
          {/* recessive axis: hairline baseline + top gridline, clean tick labels */}
          <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className="axis" />
          <line x1={PAD.left} x2={W - PAD.right} y1={y(top)} y2={y(top)} className="grid" />
          <text
            x={PAD.left - 6}
            y={y(0)}
            className="tick"
            textAnchor="end"
            dominantBaseline="middle"
          >
            0
          </text>
          <text
            x={PAD.left - 6}
            y={y(top)}
            className="tick"
            textAnchor="end"
            dominantBaseline="middle"
          >
            {top.toLocaleString(t.locale)}
          </text>
          {[0, Math.floor(days.length / 2), days.length - 1].map((i) => (
            <text
              key={i}
              x={PAD.left + band * i + band / 2}
              y={H - 6}
              className="tick"
              textAnchor="middle"
            >
              {short(days[i]!.date)}
            </text>
          ))}

          {days.map((d, i) => {
            const x = PAD.left + band * i + (band - barW) / 2;
            const h = y(0) - y(d.xp);
            return (
              <g key={d.date}>
                {d.xp > 0 && (
                  <path
                    d={columnPath(x, y(d.xp), barW, h)}
                    className={`bar${active === i ? ' on' : ''}`}
                  />
                )}
                {i === peak && (
                  <text
                    x={x + barW / 2}
                    y={y(d.xp) - 6}
                    className="tick strong"
                    textAnchor="middle"
                  >
                    {d.xp}
                  </text>
                )}
                {/* hit target: the whole day column, bigger than the mark */}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={PLOT_H}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${short(d.date)}: ${d.xp} XP`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
        </svg>
        {active !== null && (
          <div
            className="xptip"
            style={{ left: `${((PAD.left + band * active + band / 2) / W) * 100}%` }}
            role="tooltip"
          >
            <b>{days[active]!.xp} XP</b>
            <span>
              {new Date(`${days[active]!.date}T12:00:00`).toLocaleDateString(t.locale, {
                day: 'numeric',
                month: 'long',
              })}
            </span>
          </div>
        )}
      </div>
      <details className="note">
        <summary>{t.xp.asTable}</summary>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>{t.xp.day}</th>
                <th>XP</th>
              </tr>
            </thead>
            <tbody>
              {days
                .filter((d) => d.xp > 0)
                .map((d) => (
                  <tr key={d.date}>
                    <td>{d.date}</td>
                    <td>{d.xp}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
