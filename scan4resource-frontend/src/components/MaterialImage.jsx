import { useState } from 'react'
import { CATALOG } from '../lib/materials'

// Simple flat pictures of each material. They stand in until real photos are added:
// drop <category>.jpg into public/samples/ (bricks, concrete, wood, windows, doors, tiles, stone, steel)
// and it is used automatically. Real scans always show the camera crop instead.

const brick = (x, y, w = 24, h = 10) => (
  <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="1.2" fill="#c9673f" stroke="#e7a184" strokeWidth="0.8" />
)

const ART = {
  bricks: {
    bg: '#f4e9e1',
    body: (
      <>
        <rect x="14" y="60" width="92" height="6" fill="#b48a5a" />
        {[0, 1, 2, 3].map((row) =>
          (row % 2 ? [0, 1, 2, 3, 4] : [0, 1, 2, 3]).map((col) => brick((row % 2 ? 0 : 12) + col * 24, 22 + row * 10.5, 22)),
        )}
      </>
    ),
  },
  concrete: {
    bg: '#ecedee',
    body: (
      <>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x="12" y={18 + i * 15} width="96" height="12" rx="1.5" fill="#b7bbbf" />
            <rect x="12" y={18 + i * 15} width="14" height="12" rx="1.5" fill="#9ea3a8" />
            <path d={`M30 ${24 + i * 15}h72`} stroke="#c9cdd0" strokeWidth="1.2" />
          </g>
        ))}
      </>
    ),
  },
  wood: {
    bg: '#f4ebdd',
    body: (
      <>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x="12" y={16 + i * 12} width="96" height="10" rx="1.5" fill="#c99b5c" />
            <rect x="12" y={16 + i * 12} width="10" height="10" rx="1.5" fill="#a97b3f" />
            <path d={`M28 ${21 + i * 12}h74`} stroke="#deb783" strokeWidth="1" />
          </g>
        ))}
      </>
    ),
  },
  windows: {
    bg: '#e8edf0',
    body: (
      <>
        <rect x="34" y="10" width="52" height="62" rx="2" fill="#fbfcfc" stroke="#cfd6da" strokeWidth="3" />
        <rect x="40" y="16" width="19" height="24" fill="#cfe3ee" />
        <rect x="61" y="16" width="19" height="24" fill="#cfe3ee" />
        <rect x="40" y="43" width="19" height="23" fill="#cfe3ee" />
        <rect x="61" y="43" width="19" height="23" fill="#cfe3ee" />
      </>
    ),
  },
  doors: {
    bg: '#f0e9df',
    body: (
      <>
        <rect x="38" y="8" width="44" height="66" rx="2" fill="#c8945f" stroke="#a8763f" strokeWidth="2" />
        <rect x="44" y="14" width="14" height="24" rx="1" fill="#b58049" />
        <rect x="62" y="14" width="14" height="24" rx="1" fill="#b58049" />
        <rect x="44" y="42" width="14" height="26" rx="1" fill="#b58049" />
        <rect x="62" y="42" width="14" height="26" rx="1" fill="#b58049" />
        <circle cx="76" cy="42" r="1.8" fill="#f1dcb9" />
      </>
    ),
  },
  tiles: {
    bg: '#eee9e2',
    body: (
      <>
        {[0, 1, 2, 3].map((r) =>
          [0, 1, 2, 3, 4].map((c) => (
            <rect key={`${r}-${c}`} x={14 + c * 19} y={12 + r * 15} width="17" height="13" rx="1" fill={(r + c) % 2 ? '#d9cfc2' : '#cfc3b3'} />
          )),
        )}
      </>
    ),
  },
  stone: {
    bg: '#eceeed',
    body: (
      <>
        <rect x="16" y="50" width="88" height="16" rx="2" fill="#b9bdbc" />
        <rect x="22" y="34" width="76" height="16" rx="2" fill="#c8cbca" />
        <rect x="28" y="18" width="64" height="16" rx="2" fill="#d6d8d7" />
        <path d="M30 26h20M26 42h30M20 58h26" stroke="#a6aaa9" strokeWidth="1.2" />
      </>
    ),
  },
  steel: {
    bg: '#e9edf0',
    body: (
      <>
        {[0, 1].map((i) => (
          <g key={i} fill="#8f9aa3">
            <rect x="14" y={20 + i * 26} width="92" height="5" />
            <rect x="14" y={34 + i * 26} width="92" height="5" />
            <rect x="14" y={25 + i * 26} width="92" height="9" fill="#a9b3bb" />
          </g>
        ))}
      </>
    ),
  },
  other: {
    bg: '#edf1ef',
    body: <rect x="34" y="18" width="52" height="44" rx="4" fill="#cdd8d3" stroke="#aebcb5" strokeWidth="2" />,
  },
}

// Accepts a catalog key (bricks, concrete_beams, ...) or a category (bricks, concrete, ...).
const categoryOf = (kind) => CATALOG[kind]?.category ?? (ART[kind] ? kind : 'other')

export default function MaterialImage({ kind, src = null, className = '', alt = '' }) {
  const category = categoryOf(kind)
  const [photoFailed, setPhotoFailed] = useState(false)
  const art = ART[category] ?? ART.other

  return (
    <div className={`mimg ${className}`} style={{ background: art.bg }}>
      <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {art.body}
      </svg>
      {src ? (
        <img src={src} alt={alt} loading="lazy" />
      ) : (
        !photoFailed && <img src={`/samples/${category}.jpg`} alt={alt} loading="lazy" onError={() => setPhotoFailed(true)} />
      )}
    </div>
  )
}
