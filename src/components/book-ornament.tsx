// Print ornaments for the A4 book page. Colours are fixed print inks (not theme
// tokens) because the PDF exporter strips classes and theme variables.
const INK = "#8a6a2f";
const INK_SOFT = "#b89656";

function Star({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill="#fffdf7" stroke={INK} strokeWidth={1.2} />
      <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill="#fffdf7" stroke={INK} strokeWidth={1.2} transform={`rotate(45 ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={r * 0.55} fill="none" stroke={INK} strokeWidth={0.9} />
      <circle cx={cx} cy={cy} r={r * 0.18} fill={INK} />
    </g>
  );
}

function Medallion({ cx, cy }: { cx: number; cy: number }) {
  const w = 70, h = 16;
  return (
    <g>
      <path
        d={`M ${cx - w} ${cy} L ${cx - w + h} ${cy - h} L ${cx + w - h} ${cy - h} L ${cx + w} ${cy} L ${cx + w - h} ${cy + h} L ${cx - w + h} ${cy + h} Z`}
        fill="#fffdf7" stroke={INK} strokeWidth={1.2}
      />
      <path
        d={`M ${cx - w + 8} ${cy} L ${cx - w + h + 4} ${cy - h + 5} L ${cx + w - h - 4} ${cy - h + 5} L ${cx + w - 8} ${cy} L ${cx + w - h - 4} ${cy + h - 5} L ${cx - w + h + 4} ${cy + h - 5} Z`}
        fill="none" stroke={INK_SOFT} strokeWidth={0.7}
      />
      <Star cx={cx} cy={cy} r={6} />
    </g>
  );
}

export function BookFrame({ width, height }: { width: number; height: number }) {
  const o = 20; // outer rule inset
  const i = 34; // inner rule inset
  const mid = (o + i) / 2;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      aria-hidden="true"
    >
      <defs>
        <pattern id="bk-band" width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M7 1 L13 7 L7 13 L1 7 Z" fill="none" stroke={INK_SOFT} strokeWidth="0.8" />
          <circle cx="7" cy="7" r="1.3" fill={INK} />
        </pattern>
      </defs>
      {/* ornamental band between the two rules */}
      <path
        fillRule="evenodd"
        fill="url(#bk-band)"
        d={`M${o} ${o} H${width - o} V${height - o} H${o} Z M${i} ${i} V${height - i} H${width - i} V${i} Z`}
      />
      <rect x={o} y={o} width={width - o * 2} height={height - o * 2} fill="none" stroke={INK} strokeWidth={2.4} />
      <rect x={o + 4} y={o + 4} width={width - (o + 4) * 2} height={height - (o + 4) * 2} fill="none" stroke={INK} strokeWidth={0.6} />
      <rect x={i} y={i} width={width - i * 2} height={height - i * 2} fill="none" stroke={INK} strokeWidth={1.2} />
      <rect x={i + 5} y={i + 5} width={width - (i + 5) * 2} height={height - (i + 5) * 2} fill="none" stroke={INK_SOFT} strokeWidth={0.5} />
      {[
        [mid, mid], [width - mid, mid], [mid, height - mid], [width - mid, height - mid],
      ].map(([x, y]) => <Star key={`${x}-${y}`} cx={x!} cy={y!} r={11} />)}
      <Medallion cx={width / 2} cy={mid} />
      <Medallion cx={width / 2} cy={height - mid} />
      <Star cx={mid} cy={height / 2} r={7} />
      <Star cx={width - mid} cy={height / 2} r={7} />
    </svg>
  );
}

/** Classical short rule separating body text from footnotes (sits on the right in RTL). */
export function FootnoteRule() {
  return (
    <svg width="200" height="14" viewBox="0 0 200 14" aria-hidden="true" style={{ display: "block" }}>
      <line x1="0" y1="7" x2="182" y2="7" stroke={INK} strokeWidth="1" />
      <line x1="40" y1="10" x2="182" y2="10" stroke={INK_SOFT} strokeWidth="0.5" />
      <path d="M190 1 L197 7 L190 13 L183 7 Z" fill={INK} />
    </svg>
  );
}

/** Small star ornament used either side of chapter headings. */
export function HeadingOrnament() {
  return (
    <svg width="120" height="14" viewBox="0 0 120 14" aria-hidden="true" style={{ display: "block", margin: "0 auto" }}>
      <line x1="0" y1="7" x2="48" y2="7" stroke={INK_SOFT} strokeWidth="0.8" />
      <line x1="72" y1="7" x2="120" y2="7" stroke={INK_SOFT} strokeWidth="0.8" />
      <path d="M60 0 L67 7 L60 14 L53 7 Z" fill="none" stroke={INK} strokeWidth="1" />
      <circle cx="60" cy="7" r="2" fill={INK} />
    </svg>
  );
}
