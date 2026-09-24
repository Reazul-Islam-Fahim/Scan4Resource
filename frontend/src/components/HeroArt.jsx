import { useState } from 'react'

// Stand-in for the construction-site photo of the home screen. Add public/samples/hero.jpg to replace it.
export default function HeroArt({ className = '' }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  return (
    <div className={className} aria-hidden="true">
      <svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="hw" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#dcd8d0" />
            <stop offset="1" stopColor="#c7c2b8" />
          </linearGradient>
          <linearGradient id="hf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b9b3a7" />
            <stop offset="1" stopColor="#a39d91" />
          </linearGradient>
        </defs>
        <rect width="400" height="600" fill="url(#hw)" />
        {/* ceiling slab and columns */}
        <rect y="0" width="400" height="70" fill="#a9a498" />
        <rect x="24" y="60" width="78" height="380" fill="#bdb8ad" />
        <rect x="24" y="60" width="10" height="380" fill="#aaa598" />
        <rect x="300" y="60" width="70" height="380" fill="#c2bdb2" />
        {/* wall openings */}
        <rect x="132" y="150" width="70" height="150" fill="#eef1ee" />
        <rect x="132" y="150" width="70" height="150" fill="none" stroke="#a9a498" strokeWidth="6" />
        <rect x="222" y="170" width="60" height="130" fill="#e9eeec" />
        <rect x="222" y="170" width="60" height="130" fill="none" stroke="#a9a498" strokeWidth="6" />
        <path d="M167 150v150M132 225h70" stroke="#a9a498" strokeWidth="3" />
        {/* exposed brick */}
        <g fill="#b9683f" opacity="0.85">
          <rect x="34" y="250" width="60" height="70" />
          <rect x="300" y="300" width="60" height="60" />
        </g>
        {/* floor */}
        <path d="M0 440l400 0v160H0z" fill="url(#hf)" />
        <path d="M0 470h400M0 510h400M0 560h400" stroke="#9d978b" strokeWidth="1.5" opacity="0.5" />
        {/* stacked bricks */}
        <g>
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2, 3].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={40 + col * 34 + (row % 2 ? 17 : 0)}
                y={492 - row * 15}
                width="32"
                height="13"
                rx="1.5"
                fill="#c8653b"
                stroke="#e3a184"
                strokeWidth="1"
              />
            )),
          )}
        </g>
        {/* concrete beams */}
        <g>
          {[0, 1, 2].map((i) => (
            <rect key={i} x="170" y={500 - i * 20} width="120" height="17" rx="2" fill="#a7a49d" stroke="#c4c1ba" />
          ))}
        </g>
        {/* leaning window frame */}
        <g transform="rotate(8 340 470)">
          <rect x="306" y="250" width="86" height="230" rx="3" fill="#f6f7f6" stroke="#d3d6d5" strokeWidth="6" />
          <rect x="316" y="260" width="66" height="100" fill="#cfe1ea" />
          <rect x="316" y="368" width="66" height="102" fill="#cfe1ea" />
        </g>
      </svg>
      {!photoFailed && <img src="/samples/hero.jpg" alt="" onError={() => setPhotoFailed(true)} />}
    </div>
  )
}
