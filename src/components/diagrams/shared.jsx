import React from 'react';
import './diagram.css';

export const palette = {
  ink: '#183337',
  muted: '#587176',
  line: '#789095',
  page: '#f5fbf8',
  card: '#ffffff',
  teal: '#245d63',
  tealSoft: '#e0f0ee',
  blue: '#426ea5',
  blueSoft: '#e8f0fa',
  gold: '#b6842b',
  goldSoft: '#fff5dc',
  green: '#5e8d50',
  greenSoft: '#eaf4e7',
  red: '#a94f4f',
  redSoft: '#fae9e9',
  graySoft: '#f3f6f5',
};

const font = {
  fontFamily: 'Inter, Aptos, "Segoe UI", Arial, sans-serif',
};

export function TextLines({
  x,
  y,
  lines,
  size = 13,
  color = palette.muted,
  weight = 400,
  anchor = 'start',
  lineHeight = 17,
}) {
  const textLines = Array.isArray(lines) ? lines : String(lines).split('\n');

  return (
    <text x={x} y={y} textAnchor={anchor} style={{ ...font, fontSize: size, fill: color, fontWeight: weight }}>
      {textLines.map((line, index) => (
        <tspan key={`${line}-${index}`} x={x} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

export function Card({
  x,
  y,
  w,
  h,
  title,
  body,
  fill = palette.card,
  stroke = palette.teal,
  badge,
  label,
}) {
  return (
    <g className="editable-diagram-card">
      <rect x={x} y={y} width={w} height={h} rx="8" fill={fill} stroke={stroke} strokeWidth="1.5" />
      {label ? (
        <text x={x + 16} y={y + 18} style={{ ...font, fill: stroke, fontSize: 10, fontWeight: 800, letterSpacing: 0.6 }}>
          {label.toUpperCase()}
        </text>
      ) : null}
      {badge ? <circle cx={x + 22} cy={y + 35} r="13" fill={stroke} /> : null}
      {badge ? (
        <text x={x + 22} y={y + 40} textAnchor="middle" style={{ ...font, fill: '#fff', fontSize: 13, fontWeight: 800 }}>
          {badge}
        </text>
      ) : null}
      <TextLines
        x={badge ? x + 44 : x + 16}
        y={label ? y + 43 : y + 30}
        lines={title}
        size={15}
        color={palette.ink}
        weight={800}
      />
      <TextLines
        x={x + 16}
        y={label ? y + 72 : y + 59}
        lines={body}
        size={12.2}
        color={palette.muted}
        lineHeight={16}
      />
    </g>
  );
}

export function Arrow({ x1, y1, x2, y2, label, color = palette.line, markerId }) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return (
    <g className="editable-diagram-arrow">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2" markerEnd={`url(#${markerId})`} />
      {label ? (
        <>
          <rect x={midX - 44} y={midY - 16} width="88" height="22" rx="11" fill={palette.page} stroke="#d4e3df" />
          <TextLines x={midX} y={midY - 1} lines={label} size={10.5} color={color} weight={800} anchor="middle" />
        </>
      ) : null}
    </g>
  );
}

export function SectionLabel({ x, y, label }) {
  return <TextLines x={x} y={y} lines={label} size={13} color={palette.teal} weight={900} anchor="middle" />;
}

export function Lane({ x, y, w, h, title, fill = palette.graySoft, stroke = '#d9e7e2' }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="12" fill={fill} stroke={stroke} />
      <SectionLabel x={x + w / 2} y={y + 30} label={title} />
    </g>
  );
}

export function Diagram({ id, title, subtitle, viewBox, children }) {
  const markerId = `${id}-arrowhead`;

  return (
    <figure className="editable-diagram">
      <svg viewBox={viewBox} role="img" aria-labelledby={`${id}-title ${id}-desc`} className="editable-diagram-svg">
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L8,4 L0,8 Z" fill={palette.line} />
          </marker>
        </defs>
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-desc`}>{subtitle}</desc>
        <rect x="0" y="0" width="100%" height="100%" rx="16" fill={palette.page} />
        <text x="28" y="38" style={{ ...font, fill: palette.teal, fontSize: 23, fontWeight: 900 }}>
          {title}
        </text>
        <text x="28" y="63" style={{ ...font, fill: palette.muted, fontSize: 13.5 }}>
          {subtitle}
        </text>
        {children(markerId)}
      </svg>
    </figure>
  );
}
