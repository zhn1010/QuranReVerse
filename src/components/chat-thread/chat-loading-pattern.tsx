'use client';

import type { CSSProperties } from 'react';
import { useId } from 'react';
import {
  GOLD_PATH_INDEX,
  INNER_HEART_INDICES,
  LOGO_PATHS,
  OUTER_LOBE_INDICES,
} from './logo-paths.generated';

const GOLD_PATH = LOGO_PATHS[GOLD_PATH_INDEX];
const OUTER_LOBE_PATHS = OUTER_LOBE_INDICES.map((index) => LOGO_PATHS[index]);
const INNER_HEART_PATHS = INNER_HEART_INDICES.map((index) => LOGO_PATHS[index]);

function withDelay(delayMs: number): CSSProperties {
  return {
    animationDelay: `${delayMs}ms`,
  };
}

function GoldMark({
  className,
  pathLength,
  style,
}: {
  className: string;
  pathLength?: number;
  style?: CSSProperties;
}) {
  return (
    <path
      className={className}
      d={GOLD_PATH.d}
      fill={GOLD_PATH.fill}
      pathLength={pathLength}
      style={style}
    />
  );
}

export function ChatLoadingPattern({ phase }: { phase: number }) {
  const gradientId = useId().replace(/:/g, '');

  return (
    <div className="pattern-loader-scene flex items-center justify-center">
      <svg
        aria-hidden="true"
        className="pattern-loader-visual h-72 w-72 sm:h-80 sm:w-80"
        viewBox="0 0 1254 1254"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id={`${gradientId}-paper`} cx="50%" cy="48%" r="64%">
            <stop offset="0%" stopColor="rgb(255 255 255 / 0.98)" />
            <stop offset="66%" stopColor="rgb(255 250 242 / 0.95)" />
            <stop offset="100%" stopColor="rgb(247 241 231 / 0.78)" />
          </radialGradient>
          <radialGradient id={`${gradientId}-halo`} cx="50%" cy="50%" r="62%">
            <stop offset="0%" stopColor="rgb(14 116 144 / 0.12)" />
            <stop offset="58%" stopColor="rgb(217 177 75 / 0.1)" />
            <stop offset="100%" stopColor="rgb(217 177 75 / 0)" />
          </radialGradient>
        </defs>

        <circle className="pattern-loader-paper" cx="627" cy="627" fill={`url(#${gradientId}-paper)`} r="585" />
        <circle className="pattern-loader-halo" cx="627" cy="627" fill={`url(#${gradientId}-halo)`} r="546" />

        <g className="logo-loader-turn">
          <g className="pattern-loader-stage is-visible">
            {[522, 418, 316, 214].map((radius, index) => (
              <circle
                key={`guide-${radius}`}
                className="pattern-loader-guide-ring pattern-loader-draw"
                cx="627"
                cy="627"
                fill="none"
                pathLength="1"
                r={radius}
                style={withDelay(index * 120)}
              />
            ))}

            {Array.from({ length: 8 }, (_, index) => (
              <path
                key={`axis-${index}`}
                className="pattern-loader-guide-axis pattern-loader-draw"
                d="M 627 74 L 627 1180"
                pathLength="1"
                style={{
                  ...withDelay(420 + index * 50),
                  transform: `rotate(${index * 45}deg)`,
                  transformOrigin: '627px 627px',
                }}
              />
            ))}
          </g>

          <g className={`pattern-loader-stage ${phase >= 2 ? 'is-visible' : ''}`}>
            <GoldMark
              className="logo-loader-outline pattern-loader-draw"
              pathLength={1}
              style={withDelay(60)}
            />
            <path
              className="logo-loader-drawline pattern-loader-draw"
              d="M 627 122 L 627 1132"
              pathLength="1"
              style={withDelay(120)}
            />
            <path
              className="logo-loader-drawline pattern-loader-draw"
              d="M 152 602 L 1102 602"
              pathLength="1"
              style={withDelay(280)}
            />
            <path
              className="logo-loader-drawline pattern-loader-draw"
              d="M 292 262 L 962 942"
              pathLength="1"
              style={withDelay(440)}
            />
            <path
              className="logo-loader-drawline pattern-loader-draw"
              d="M 962 262 L 292 942"
              pathLength="1"
              style={withDelay(600)}
            />
          </g>

          <g className={`pattern-loader-stage ${phase >= 3 ? 'is-visible' : ''}`}>
            {OUTER_LOBE_PATHS.map((path, index) => (
              <path
                key={`outer-lobe-${index}`}
                className="logo-loader-outer-stroke pattern-loader-draw"
                d={path.d}
                fill={path.fill}
                pathLength={1}
                style={withDelay(index * 140)}
              />
            ))}
          </g>

          <g className={`pattern-loader-stage ${phase >= 4 ? 'is-visible' : ''}`}>
            {INNER_HEART_PATHS.map((path, index) => (
              <path
                key={`inner-heart-${index}`}
                className="logo-loader-inner-stroke pattern-loader-draw"
                d={path.d}
                fill={path.fill}
                pathLength={1}
                style={withDelay(index * 130)}
              />
            ))}
          </g>

          <g className={`pattern-loader-stage ${phase >= 5 ? 'is-visible' : ''}`}>
            <GoldMark
              className="logo-loader-gold-settle pattern-loader-draw"
              pathLength={1}
              style={withDelay(40)}
            />
            {OUTER_LOBE_PATHS.map((path, index) => (
              <path
                key={`outer-lobe-settle-${index}`}
                className="logo-loader-stroke-settle pattern-loader-draw"
                d={path.d}
                fill={path.fill}
                pathLength={1}
                style={withDelay(120 + index * 50)}
              />
            ))}
            {INNER_HEART_PATHS.map((path, index) => (
              <path
                key={`inner-heart-settle-${index}`}
                className="logo-loader-stroke-settle pattern-loader-draw"
                d={path.d}
                fill={path.fill}
                pathLength={1}
                style={withDelay(300 + index * 40)}
              />
            ))}
          </g>

          <g className={`pattern-loader-stage ${phase >= 6 ? 'is-visible' : ''}`}>
            <GoldMark className="logo-loader-final-fill" />
            {OUTER_LOBE_PATHS.map((path, index) => (
              <path
                key={`outer-lobe-final-${index}`}
                className="logo-loader-final-fill"
                d={path.d}
                fill={path.fill}
                style={withDelay(index * 40)}
              />
            ))}
            {INNER_HEART_PATHS.map((path, index) => (
              <path
                key={`inner-heart-final-${index}`}
                className="logo-loader-final-fill"
                d={path.d}
                fill={path.fill}
                style={withDelay(120 + index * 35)}
              />
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}
