import { conditionLabel, formatChf, formatDate, formatQty, formatSize, formatTonnes, markOf } from './format'

const GREEN = [1, 128, 88]
const MINT = [228, 243, 236]
const INK = [16, 48, 42]
const GREY = [96, 112, 108]

const slug = (text) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

/**
 * Lay the reuse report out as an A4 PDF and hand it to the phone's share sheet where that works,
 * otherwise download it. Loaded on demand so the app itself stays small.
 * Returns 'shared', 'downloaded' or 'cancelled'.
 */
export async function exportReportPdf(report, { title, startedAt, items = [] }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const page = { w: 210, h: 297, m: 16 }
  const inner = page.w - page.m * 2

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...GREEN)
  doc.text('scan4reuse', page.m, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GREY)
  doc.text(formatDate(startedAt) || formatDate(new Date().toISOString()), page.w - page.m, 18, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(...INK)
  doc.text('Reuse Report', page.m, 32)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GREY)
  doc.text(title, page.m, 39)

  let y = 46
  if (report.isSample) {
    doc.setFillColor(255, 244, 214)
    doc.roundedRect(page.m, y, inner, 10, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(120, 82, 0)
    doc.text('SAMPLE DATA. Nothing was detected in this scan, so these figures are examples.', page.m + 4, y + 6.3)
    y += 15
  }

  // Potential for reuse
  doc.setFillColor(...MINT)
  doc.roundedRect(page.m, y, inner, 16, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...GREEN)
  doc.text('Potential for reuse', page.m + 6, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GREY)
  doc.text('These materials can be given a second life.', page.m + 6, y + 12.5)
  y += 22

  // Three figures
  const stats = [
    [String(report.detections), 'Items detected'],
    [formatTonnes(report.co2Kg), 'CO2 savings (est.)'],
    [`~ ${formatChf(report.resale)}`, 'Resale value (est.)'],
  ]
  const colW = inner / 3
  stats.forEach(([value, label], i) => {
    const x = page.m + colW * i + colW / 2
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(17)
    doc.setTextColor(...GREEN)
    doc.text(value, x, y + 6, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...GREY)
    doc.text(label, x, y + 12, { align: 'center' })
  })
  y += 20

  // Identified materials
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...INK)
  doc.text('Identified materials', page.m, y)

  autoTable(doc, {
    startY: y + 3,
    margin: { left: page.m, right: page.m },
    head: [['Material', 'Details', 'Quantity', 'Est. value']],
    body: report.rows.map((row) => [
      row.name,
      [row.material, conditionLabel(row.condition).toLowerCase()].filter(Boolean).join(', '),
      formatQty(row.quantity, row.unit),
      formatChf(row.value),
    ]),
    foot: [['Total', '', '', formatChf(report.resale)]],
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 10, textColor: INK, cellPadding: { top: 3, bottom: 3, left: 2, right: 2 } },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold' },
    footStyles: { fontStyle: 'bold', textColor: GREEN },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold', textColor: GREEN } },
    didParseCell: (data) => {
      if (data.section === 'head' && (data.column.index === 2 || data.column.index === 3)) data.cell.styles.halign = 'right'
      if (data.section === 'foot' && (data.column.index === 3)) data.cell.styles.halign = 'right'
    },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        doc.setDrawColor(226, 233, 230)
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height)
      }
    },
  })

  // Door schedule: only for real scans that measured doors
  const doors = items.filter((item) => item.label === 'doors')
  if (!report.isSample && doors.length > 0) {
    const after = doc.lastAutoTable.finalY + 12
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...INK)
    doc.text('Door schedule', page.m, after)
    autoTable(doc, {
      startY: after + 3,
      margin: { left: page.m, right: page.m },
      head: [['Mark', 'Size', 'Material', 'Condition']],
      body: doors.map((door, index) => [
        markOf(index),
        formatSize(door),
        door.material && door.material !== 'unknown' ? door.material[0].toUpperCase() + door.material.slice(1) : 'Unknown',
        conditionLabel(door.condition) || '-',
      ]),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 10, textColor: INK, cellPadding: { top: 3, bottom: 3, left: 2, right: 2 } },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold' },
    })
  }

  // Note, page numbers, watermark
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GREY)
    if (p === pages) {
      doc.text(
        'CO2 savings and resale values are estimates based on average factors per material. Actual values depend on condition and the market.',
        page.m,
        page.h - 18,
        { maxWidth: inner },
      )
    }
    doc.text(`Page ${p} of ${pages}`, page.w - page.m, page.h - 10, { align: 'right' })
    if (report.isSample) {
      doc.saveGraphicsState()
      doc.setGState(new doc.GState({ opacity: 0.1 }))
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(64)
      doc.setTextColor(...GREEN)
      doc.text('SAMPLE DATA', page.w / 2, page.h / 2 + 20, { align: 'center', angle: 35 })
      doc.restoreGraphicsState()
    }
  }

  const stamp = new Date(startedAt || Date.now()).toISOString().slice(0, 10)
  const name = `scan4reuse-report-${slug(title) || 'scan'}-${stamp}.pdf`.replace(/-+/g, '-')
  const blob = doc.output('blob')
  const file = new File([blob], name, { type: 'application/pdf' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Reuse Report' })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
      // Sharing failed for another reason: fall through to a download.
    }
  }
  doc.save(name)
  return 'downloaded'
}
