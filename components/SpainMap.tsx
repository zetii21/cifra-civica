"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import mapAsset from "@/data/fixtures/geography/spain-ccaa-svg.json";

interface MapCommunity {
  code: string;
  nutsId: string;
  name: string;
  inset: boolean;
  path: string;
  labelX: number;
  labelY: number;
}

interface MapAsset {
  version: string;
  width: number;
  height: number;
  canariasInset: { x: number; y: number; width: number; height: number };
  source: { attribution: string };
  communities: MapCommunity[];
}

const asset = mapAsset as unknown as MapAsset;

/** Autonomous cities are almost invisible at 1:10M; draw tappable markers. */
const CITY_MARKERS: Record<string, { x: number; y: number }> = {
  "18": { x: 292, y: 700 },
  "19": { x: 449, y: 741 },
};

const NEUTRAL_FILL: [number, number, number] = [216, 222, 212];
const POSITIVE_FILL: [number, number, number] = [23, 111, 96];
const NEGATIVE_FILL: [number, number, number] = [164, 68, 56];

function mix(
  from: [number, number, number],
  to: [number, number, number],
  amount: number,
): string {
  const channel = (index: number) =>
    Math.round(from[index] + (to[index] - from[index]) * amount);
  return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`;
}

export interface SpainMapProps {
  /** Metric value per community code; drives the diverging choropleth. */
  values: Record<string, number>;
  /** Formats a value for the tooltip and the accessible labels. */
  formatValue: (value: number) => string;
  /** Description of the painted metric, announced to assistive technology. */
  metricLabel: string;
  selectedCode?: string;
  onSelect?: (code: string | undefined) => void;
  /** Compact mode reduces label rendering for use inside cards. */
  compact?: boolean;
}

export function SpainMap({
  values,
  formatValue,
  metricLabel,
  selectedCode,
  onSelect,
  compact = false,
}: SpainMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hatchId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);

  const { maxAbs, minValue, maxValue } = useMemo(() => {
    const present = asset.communities.map((community) => values[community.code] ?? 0);
    return {
      maxAbs: Math.max(1e-9, ...present.map((value) => Math.abs(value))),
      minValue: Math.min(...present),
      maxValue: Math.max(...present),
    };
  }, [values]);

  const fillFor = (code: string): string => {
    const value = values[code] ?? 0;
    const intensity = Math.min(1, Math.sqrt(Math.abs(value) / maxAbs));
    if (Math.abs(value) < 1e-9) return mix(NEUTRAL_FILL, NEUTRAL_FILL, 0);
    return value > 0
      ? mix(NEUTRAL_FILL, POSITIVE_FILL, 0.15 + 0.85 * intensity)
      : mix(NEUTRAL_FILL, NEGATIVE_FILL, 0.15 + 0.85 * intensity);
  };

  const toggle = (code: string) => {
    if (!onSelect) return;
    onSelect(selectedCode === code ? undefined : code);
  };

  const handleKey = (event: KeyboardEvent, code: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle(code);
    }
  };

  const handleMove = (event: React.MouseEvent, code: string) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setHover({
      code,
      x: Math.min(event.clientX - bounds.left + 14, bounds.width - 190),
      y: event.clientY - bounds.top + 14,
    });
  };

  const hovered = hover
    ? asset.communities.find((community) => community.code === hover.code)
    : undefined;

  return (
    <div className="spain-map" ref={containerRef}>
      <svg
        viewBox={`0 0 ${asset.width} ${asset.height}`}
        role="group"
        aria-label={`Mapa de España por comunidades autónomas: ${metricLabel}`}
      >
        <defs>
          <pattern
            id={`hatch-${hatchId}`}
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="7" stroke="#571f16" strokeWidth="1.6" strokeOpacity="0.5" />
          </pattern>
        </defs>
        <rect
          className="spain-map-inset-frame"
          x={asset.canariasInset.x}
          y={asset.canariasInset.y}
          width={asset.canariasInset.width}
          height={asset.canariasInset.height}
          rx={10}
        />
        <text
          className="spain-map-inset-label"
          x={asset.canariasInset.x + 10}
          y={asset.canariasInset.y + 16}
        >
          Canarias
        </text>
        {asset.communities.map((community) => {
          const marker = CITY_MARKERS[community.code];
          const isSelected = selectedCode === community.code;
          const value = values[community.code] ?? 0;
          const negative = value < -1e-9;
          const shared = {
            role: "button" as const,
            tabIndex: 0,
            "aria-pressed": isSelected,
            "aria-label": `${community.name}: ${formatValue(value)}`,
            onClick: (event: React.MouseEvent) => {
              toggle(community.code);
              // Touch users get the tooltip pinned at the tap point.
              handleMove(event, community.code);
            },
            onKeyDown: (event: KeyboardEvent) => handleKey(event, community.code),
            onMouseMove: (event: React.MouseEvent) => handleMove(event, community.code),
            onMouseLeave: () => setHover(null),
            onFocus: () =>
              setHover({ code: community.code, x: community.labelX, y: community.labelY }),
            onBlur: () => setHover(null),
          };
          if (marker) {
            return (
              <g key={community.code}>
                <circle
                  className={`spain-map-region spain-map-city${isSelected ? " selected" : ""}`}
                  cx={marker.x}
                  cy={marker.y}
                  r={8}
                  fill={fillFor(community.code)}
                  {...shared}
                />
                {negative ? (
                  <circle
                    cx={marker.x}
                    cy={marker.y}
                    r={8}
                    fill={`url(#hatch-${hatchId})`}
                    pointerEvents="none"
                    aria-hidden="true"
                  />
                ) : null}
                {compact ? null : (
                  <text className="spain-map-city-label" x={marker.x + 12} y={marker.y + 4}>
                    {community.name}
                  </text>
                )}
              </g>
            );
          }
          return (
            <g key={community.code}>
              <path
                className={`spain-map-region${isSelected ? " selected" : ""}`}
                d={community.path}
                fill={fillFor(community.code)}
                {...shared}
              />
              {negative ? (
                <path
                  d={community.path}
                  fill={`url(#hatch-${hatchId})`}
                  pointerEvents="none"
                  aria-hidden="true"
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      {hovered ? (
        <div
          className="spain-map-tooltip"
          role="status"
          style={{ left: hover!.x, top: hover!.y }}
        >
          <strong>{hovered.name}</strong>
          <span>{formatValue(values[hovered.code] ?? 0)}</span>
          <small>{metricLabel}</small>
        </div>
      ) : null}
      {Math.abs(minValue) > 1e-9 || Math.abs(maxValue) > 1e-9 ? (
        <p className="spain-map-scale">
          Rango del escenario: {formatValue(minValue)} · {formatValue(maxValue)}
        </p>
      ) : null}
      <p className="spain-map-attribution">{asset.source.attribution}</p>
    </div>
  );
}

export const SPAIN_MAP_VERSION = asset.version;
