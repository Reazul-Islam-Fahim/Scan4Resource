import { formatCm, materialLabel } from '../lib/format'

const CHIP_H = 24
const GAP = 20
const EXT = 6

const chipWidth = (text) => Math.round(text.length * 8.4 + 16)

function Chip({ x, y, text }) {
  const w = chipWidth(text)
  return (
    <g className="chip chip-ink">
      <rect x={x - w / 2} y={y - CHIP_H / 2} width={w} height={CHIP_H} rx="4" />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central">
        {text}
      </text>
    </g>
  )
}

// Architectural oblique tick at the end of a dimension line.
const Tick = ({ x, y }) => <line x1={x - 5} y1={y + 5} x2={x + 5} y2={y - 5} />

/**
 * One detected door, drawn the way a surveyor would mark it on a plan:
 * an outline, extension lines, dimension lines with ticks, and the measurement
 * in a label sitting on each line. Dimensions move to whichever side has room.
 */
export default function DimensionBox({ rect, bounds, mark, door }) {
  const { x, y, w, h } = rect
  const widthText = formatCm(door.widthCm)
  const heightText = formatCm(door.heightCm)
  const tag = `${mark} ${materialLabel(door.material)}`

  // Width dimension: below the door, else above, else inside its bottom edge.
  const roomBelow = y + h + GAP + CHIP_H / 2 < bounds.height
  const roomAbove = y - GAP - CHIP_H / 2 > 0
  const wy = roomBelow ? y + h + GAP : roomAbove ? y - GAP : y + h - GAP
  const wDir = roomBelow ? 1 : -1
  const wEdge = roomBelow ? y + h + 3 : roomAbove ? y - 3 : y + h

  // Height dimension: right of the door, else left, else inside its right edge.
  const half = chipWidth(heightText) / 2
  const roomRight = x + w + GAP + half < bounds.width
  const roomLeft = x - GAP - half > 0
  const hx = roomRight ? x + w + GAP : roomLeft ? x - GAP : x + w - GAP
  const hDir = roomRight ? 1 : -1
  const hEdge = roomRight ? x + w + 3 : roomLeft ? x - 3 : x + w

  return (
    <g>
      <rect className="dim-box" x={x} y={y} width={w} height={h} rx="3" />

      <g className="dim-lines">
        <line x1={x} y1={wEdge} x2={x} y2={wy + wDir * EXT} />
        <line x1={x + w} y1={wEdge} x2={x + w} y2={wy + wDir * EXT} />
        <line x1={x} y1={wy} x2={x + w} y2={wy} />
        <Tick x={x} y={wy} />
        <Tick x={x + w} y={wy} />

        <line x1={hEdge} y1={y} x2={hx + hDir * EXT} y2={y} />
        <line x1={hEdge} y1={y + h} x2={hx + hDir * EXT} y2={y + h} />
        <line x1={hx} y1={y} x2={hx} y2={y + h} />
        <Tick x={hx} y={y} />
        <Tick x={hx} y={y + h} />
      </g>

      <Chip x={x + w / 2} y={wy} text={widthText} />
      <Chip x={hx} y={y + h / 2} text={heightText} />

      <g className="chip chip-mark">
        <rect x={x} y={y} width={chipWidth(tag)} height={CHIP_H} rx="3" />
        <text x={x + 8} y={y + CHIP_H / 2} dominantBaseline="central">
          {tag}
        </text>
      </g>
    </g>
  )
}

/** Any detected item that is not a door: an outline with its label and quantity, no dimensions. */
export function LabelBox({ rect, item, name }) {
  const { x, y, w, h } = rect
  const qty = item.unit === 'm2' ? `~ ${Math.round(item.quantity)} m²` : item.quantity > 1 ? `${item.quantity}x` : ''
  const tag = qty ? `${name} ${qty}` : name
  return (
    <g>
      <rect className="dim-box" x={x} y={y} width={w} height={h} rx="3" />
      <g className="chip chip-mark">
        <rect x={x} y={y} width={chipWidth(tag)} height={CHIP_H} rx="3" />
        <text x={x + 8} y={y + CHIP_H / 2} dominantBaseline="central">
          {tag}
        </text>
      </g>
    </g>
  )
}
