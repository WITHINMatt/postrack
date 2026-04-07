import { useState, useMemo, useCallback, useRef, useEffect } from 'react'

// ─── Constants ───────────────────────────────────────────────────────

const DELIVERABLE_TYPES = [
  { key: 'ctv', label: 'CTV / Broadcast', daysPerUnit: 3 },
  { key: 'social', label: 'Social Cuts', daysPerUnit: 1.5 },
  { key: 'cutdown', label: 'Cutdowns', daysPerUnit: 1 },
]

function computeResizeDays(n) {
  if (n <= 0) return 0
  return Math.max(1, Math.ceil(1 + (n - 1) * 0.5))
}

const TYPE_STYLES = {
  internal: { short: 'INT', color: 'var(--color-internal)', bg2: 'var(--color-internal-bg2)', border: 'var(--color-internal-border)' },
  client: { short: 'CLT', color: 'var(--color-client)', bg2: 'var(--color-client-bg2)', border: 'var(--color-client-border)' },
  milestone: { short: 'MIL', color: 'var(--color-milestone)', bg2: 'var(--color-milestone-bg2)', border: 'var(--color-milestone-border)' },
}

const RESIZE_PRESETS = ['9:16', '4:5', '1:1', '16:9']

// ─── Date Utilities ──────────────────────────────────────────────────

function addDays(date, days, biz) {
  const r = new Date(date)
  if (!biz) { r.setDate(r.getDate() + days); return r }
  let rem = Math.abs(days), dir = days >= 0 ? 1 : -1
  while (rem > 0) { r.setDate(r.getDate() + dir); if (r.getDay() !== 0 && r.getDay() !== 6) rem-- }
  return r
}

function countBiz(a, b) {
  let c = 0, d = new Date(a)
  while (d < b) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) c++ }
  return c
}
function countCal(a, b) { return Math.round((b - a) / 864e5) }

function fmtDate(d) {
  const dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${dn[d.getDay()]}, ${mn[d.getMonth()]} ${d.getDate()}`
}
function isoDate(d) { return d.toISOString().split('T')[0] }
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5) }

// ─── Icons ───────────────────────────────────────────────────────────

const Icon = {
  Up: ({ s = 10 }) => <svg width={s} height={s} viewBox="0 0 10 10" fill="none"><path d="M2 6.5L5 3.5L8 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  Down: ({ s = 10 }) => <svg width={s} height={s} viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  Plus: ({ s = 12 }) => <svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>,
  X: ({ s = 12 }) => <svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>,
  Check: ({ s = 10 }) => <svg width={s} height={s} viewBox="0 0 10 10" fill="none"><path d="M2 5.2L4 7.2L8 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  Copy: ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 14 14" fill="none"><rect x="4.5" y="4.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.1" /><path d="M9.5 4.5V3a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 3v5A1.5 1.5 0 003 9.5h1.5" stroke="currentColor" strokeWidth="1.1" /></svg>,
  Warn: ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 14 14" fill="none"><path d="M7 1L1 13h12L7 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><path d="M7 5.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><circle cx="7" cy="10.5" r="0.6" fill="currentColor" /></svg>,
  Parallel: ({ s = 12 }) => <svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M2 3h8M2 6h6M2 9h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>,
  Grip: ({ s = 12 }) => <svg width={s} height={s} viewBox="0 0 12 12" fill="none"><circle cx="4" cy="2.5" r="1" fill="currentColor"/><circle cx="8" cy="2.5" r="1" fill="currentColor"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="8" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="9.5" r="1" fill="currentColor"/><circle cx="8" cy="9.5" r="1" fill="currentColor"/></svg>,
  Eye: ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 14 14" fill="none"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2"/><circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2"/></svg>,
  EyeOff: ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 14 14" fill="none"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2"/><path d="M2 12L12 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
}

// ─── Small Components ────────────────────────────────────────────────

function SectionLabel({ children, center = true }) {
  return <span className={`text-[11px] font-mono font-semibold tracking-[0.18em] uppercase text-text-muted ${center ? 'block text-center' : ''}`}>{children}</span>
}

function Toggle({ checked, onChange, labelLeft, labelRight }) {
  return (
    <div className="flex items-center gap-3 select-none">
      {labelLeft && <span className={`text-[12px] font-medium tracking-wide uppercase cursor-pointer transition-all duration-300 ${!checked ? 'text-text-primary' : 'text-text-dim'}`} onClick={() => onChange(false)}>{labelLeft}</span>}
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className="w-11 h-[22px] relative rounded-full border cursor-pointer focus:outline-none transition-all duration-400"
        style={{ borderColor: checked ? 'var(--color-warm-border)' : 'var(--color-border)', background: checked ? 'linear-gradient(135deg, rgba(238,208,204,0.12), rgba(238,208,204,0.04))' : 'var(--color-bg-elevated)' }}>
        <span className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full transition-all duration-400"
          style={{ left: checked ? '22px' : '3px', background: checked ? 'var(--color-warm)' : 'var(--color-text-muted)', boxShadow: checked ? '0 0 10px rgba(238,208,204,0.35)' : 'none' }} />
      </button>
      {labelRight && <span className={`text-[12px] font-medium tracking-wide uppercase cursor-pointer transition-all duration-300 ${checked ? 'text-text-primary' : 'text-text-dim'}`} onClick={() => onChange(true)}>{labelRight}</span>}
    </div>
  )
}

function Checkbox({ checked, onChange, color = 'var(--color-warm)' }) {
  return (
    <button onClick={onChange}
      className="w-[16px] h-[16px] rounded-[3px] border flex-shrink-0 flex items-center justify-center transition-all duration-200 cursor-pointer"
      style={{ borderColor: checked ? color : 'var(--color-border)', background: checked ? `${color}20` : 'transparent' }}>
      {checked && <Icon.Check s={9} />}
    </button>
  )
}

function NumInput({ value, onChange, min = 0, max = 999, className = '' }) {
  return (
    <input type="number" min={min} max={max} value={value}
      onChange={(e) => onChange(Math.max(min, parseInt(e.target.value) || min))}
      className={`bg-bg-elevated border border-border rounded px-3 py-2 text-[13px] font-mono text-text-primary text-center outline-none focus:border-warm/40 transition-colors ${className}`} />
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-lg px-6 py-5 flex flex-col gap-3 min-w-0">
      <span className="text-[11px] font-mono font-semibold tracking-[0.18em] uppercase text-text-muted">{label}</span>
      <span className="text-[26px] font-semibold tracking-tight text-text-primary leading-none truncate">{value}</span>
      {sub && <span className="text-[12px] font-mono text-text-secondary leading-relaxed">{sub}</span>}
    </div>
  )
}

function TypeBadge({ type }) {
  const s = TYPE_STYLES[type]
  return <span className="text-[10px] font-mono font-bold tracking-[0.12em] uppercase px-2.5 py-1 rounded flex-shrink-0" style={{ color: s.color, background: s.bg2, border: `1px solid ${s.border}` }}>{s.short}</span>
}

// ─── Phase Row ───────────────────────────────────────────────────────

function PhaseRow({ phase, index, total, onUpdate, onRemove, onDragStart, dragOver, isDragging }) {
  const [editName, setEditName] = useState(false)
  const [editDur, setEditDur] = useState(false)
  const nameRef = useRef(null)
  const durRef = useRef(null)
  const s = TYPE_STYLES[phase.type]

  useEffect(() => { if (editName && nameRef.current) { nameRef.current.focus(); nameRef.current.select() } }, [editName])
  useEffect(() => { if (editDur && durRef.current) { durRef.current.focus(); durRef.current.select() } }, [editDur])

  const isParallel = phase.lane !== undefined

  return (
    <div className={`phase-row group flex items-center gap-4 px-6 py-4 border-b transition-all duration-200 ${isDragging ? 'opacity-30' : ''} ${dragOver === 'above' ? 'border-t-2 border-t-warm' : dragOver === 'below' ? 'border-b-2 border-b-warm' : ''} ${phase.enabled ? 'border-border-subtle hover:bg-bg-card-hover' : 'border-border-subtle/50 opacity-30'}`}>
      <div className="w-4 flex items-center justify-center cursor-grab active:cursor-grabbing text-text-dim hover:text-text-secondary transition-colors"
        onMouseDown={(e) => { e.preventDefault(); onDragStart(index, e.clientY) }}>
        <Icon.Grip s={12} />
      </div>
      <Checkbox checked={phase.enabled} onChange={() => onUpdate({ enabled: !phase.enabled })} color={s.color} />
      <div className="w-[4px] h-8 rounded-full flex-shrink-0" style={{ background: phase.enabled ? s.color : 'var(--color-border)' }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {editName ? (
            <input ref={nameRef} type="text" value={phase.name} onChange={(e) => onUpdate({ name: e.target.value })}
              onBlur={() => setEditName(false)} onKeyDown={(e) => e.key === 'Enter' && setEditName(false)}
              className="w-full bg-bg-elevated border border-border rounded px-2 py-1 text-[14px] font-medium text-text-primary outline-none focus:border-warm/40" />
          ) : (
            <span onClick={() => setEditName(true)} className="text-[14px] font-medium cursor-text hover:text-warm transition-colors block truncate text-text-primary">{phase.name}</span>
          )}
          {isParallel && (
            <span className="text-[9px] font-mono text-text-dim bg-bg-elevated border border-border-subtle rounded px-1.5 py-0.5 flex-shrink-0 flex items-center gap-1">
              <Icon.Parallel s={8} /> Lane {phase.lane + 1}
            </span>
          )}
        </div>
      </div>
      <TypeBadge type={phase.type} />
      <div className="flex flex-col items-end flex-shrink-0 min-w-[100px]">
        <div className="flex items-center gap-1 tabular-nums">
          <button
            onClick={() => onUpdate({ manualDuration: Math.max(1, phase.effectiveDuration - 1) })}
            className="w-6 h-6 flex items-center justify-center rounded border border-border bg-bg-elevated hover:bg-bg-hover hover:border-border-hover text-text-muted hover:text-text-primary transition-all cursor-pointer text-[11px] font-mono"
          >−</button>
          {editDur ? (
            <input ref={durRef} type="number" min="1" max="99" value={phase.effectiveDuration}
              onChange={(e) => onUpdate({ manualDuration: Math.max(1, parseInt(e.target.value) || 1) })}
              onBlur={() => setEditDur(false)} onKeyDown={(e) => e.key === 'Enter' && setEditDur(false)}
              className="w-10 bg-bg-elevated border border-border rounded px-1 py-0.5 text-[13px] font-mono text-text-primary text-center outline-none focus:border-warm/40" />
          ) : (
            <span onClick={() => setEditDur(true)} className="font-mono text-[14px] w-10 text-center cursor-text hover:text-warm transition-colors text-text-primary font-semibold">
              {phase.effectiveDuration}
            </span>
          )}
          <button
            onClick={() => onUpdate({ manualDuration: Math.min(99, phase.effectiveDuration + 1) })}
            className="w-6 h-6 flex items-center justify-center rounded border border-border bg-bg-elevated hover:bg-bg-hover hover:border-border-hover text-text-muted hover:text-text-primary transition-all cursor-pointer text-[11px] font-mono"
          >+</button>
          <span className="text-text-muted text-[11px] font-mono ml-0.5">d</span>
        </div>
        {phase.autoLabel && !phase.manualDuration && (
          <span className="text-[8px] font-mono text-text-dim uppercase tracking-widest mt-1">auto</span>
        )}
      </div>
      <select value={phase.type} onChange={(e) => onUpdate({ type: e.target.value })}
        className="bg-bg-elevated border border-border rounded px-1.5 py-1 text-[11px] font-mono text-text-secondary outline-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
        <option value="internal">Internal</option>
        <option value="client">Client</option>
        <option value="milestone">Milestone</option>
      </select>
      <button onClick={() => onRemove(phase.id)} className="text-text-dim hover:text-danger transition-all opacity-0 group-hover:opacity-100 cursor-pointer p-1"><Icon.X s={11} /></button>
    </div>
  )
}

// ─── Draggable Phase List ────────────────────────────────────────────

function PhaseList({ phases, scheduled, updatePhase, removePhase, reorderPhase }) {
  const [dragIdx, setDragIdx] = useState(null)
  const [hoverIdx, setHoverIdx] = useState(null)
  const rowRefs = useRef([])

  const handleDragStart = useCallback((idx, startY) => {
    setDragIdx(idx)
    const onMouseMove = (e) => {
      // Find which row we're over
      for (let i = 0; i < rowRefs.current.length; i++) {
        const el = rowRefs.current[i]
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (e.clientY >= rect.top && e.clientY < rect.bottom) {
          setHoverIdx(i)
          return
        }
      }
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setDragIdx(cur => {
        setHoverIdx(hover => {
          if (cur !== null && hover !== null && cur !== hover) reorderPhase(cur, hover)
          return null
        })
        return null
      })
    }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [reorderPhase])

  return (
    <div>
      {phases.map((phase, i) => {
        const sched = scheduled.find(s => s.id === phase.id)
        let dragOver = null
        if (dragIdx !== null && hoverIdx === i && dragIdx !== i) {
          dragOver = dragIdx < i ? 'below' : 'above'
        }
        return (
          <div key={phase.id} ref={el => rowRefs.current[i] = el}>
            <PhaseRow
              phase={{ ...phase, effectiveDuration: phase.manualDuration || phase.baseDuration, lane: sched?.lane }}
              index={i} total={phases.length}
              onUpdate={(u) => updatePhase(phase.id, u)} onRemove={removePhase}
              onDragStart={handleDragStart} dragOver={dragOver} isDragging={dragIdx === i} />
          </div>
        )
      })}
    </div>
  )
}

// ─── Row-based Gantt ─────────────────────────────────────────────────

function GanttChart({ phases, timelineStart, timelineEnd, onDurationChange, onMovePhase, onReorder, kickoffDate, bizDays }) {
  const containerRef = useRef(null)
  const phasesRef = useRef(phases)
  const timeRef = useRef({ start: timelineStart, end: timelineEnd })
  phasesRef.current = phases
  timeRef.current = { start: timelineStart, end: timelineEnd }

  // In biz mode, build a list of business days for even spacing
  const bizDaysList = useMemo(() => {
    if (!bizDays) return null
    const days = []
    const d = new Date(timelineStart)
    while (d <= timelineEnd) {
      if (d.getDay() !== 0 && d.getDay() !== 6) days.push(new Date(d))
      d.setDate(d.getDate() + 1)
    }
    return days
  }, [bizDays, timelineStart.getTime(), timelineEnd.getTime()])

  const totalDays = bizDays ? (bizDaysList?.length || 1) : countCal(timelineStart, timelineEnd)
  if (!phases.length || totalDays <= 0) return null

  // Position as percentage: biz mode uses business-day index, cal mode uses ms
  const toPercent = (date) => {
    if (bizDays && bizDaysList) {
      const t = date.getTime()
      // Find the biz day index closest to this date
      let idx = 0
      for (let i = 0; i < bizDaysList.length; i++) {
        if (bizDaysList[i].getTime() <= t) idx = i
        else break
      }
      return (idx / totalDays) * 100
    }
    const totalMs = timelineEnd.getTime() - timelineStart.getTime()
    return totalMs > 0 ? ((date.getTime() - timelineStart.getTime()) / totalMs) * 100 : 0
  }

  const getSnapshotPxPerDay = () => {
    const containerWidth = containerRef.current?.offsetWidth || 1
    return containerWidth / totalDays
  }

  // Drag right edge to resize
  const handleEdgeDrag = useCallback((e, phaseId) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const phase = phasesRef.current.find(p => p.id === phaseId)
    if (!phase) return
    const origDur = phase.effectiveDuration
    const pxPerDay = getSnapshotPxPerDay()
    let lastDur = origDur

    const onMouseMove = (ev) => {
      const dx = ev.clientX - startX
      const newDur = Math.max(1, Math.min(99, origDur + Math.round(dx / pxPerDay)))
      if (newDur !== lastDur) { lastDur = newDur; onDurationChange(phaseId, newDur) }
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''; document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'ew-resize'; document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [onDurationChange])

  // Drag bar body — horizontal moves in time, vertical reorders
  const rowHeight = 42 // h-10 (40px) + mb-[2px]
  const handleMoveDrag = useCallback((e, phaseId) => {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const phase = phasesRef.current.find(p => p.id === phaseId)
    if (!phase) return
    const phaseIdx = phasesRef.current.findIndex(p => p.id === phaseId)
    const pxPerDay = getSnapshotPxPerDay()
    const kickoff = new Date(kickoffDate + 'T00:00:00')
    const currentOffset = bizDays ? countBiz(kickoff, phase.startDate) : countCal(kickoff, phase.startDate)
    let lastOffset = currentOffset
    let mode = null // 'horizontal' or 'vertical'
    let lastRowDelta = 0

    const onMouseMove = (ev) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY

      // Determine mode on first significant movement
      if (!mode) {
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          mode = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal'
          document.body.style.cursor = mode === 'vertical' ? 'grabbing' : 'grab'
        }
        return
      }

      if (mode === 'horizontal') {
        const deltaDays = Math.round(dx / pxPerDay)
        const newOffset = Math.max(0, currentOffset + deltaDays)
        if (newOffset !== lastOffset) { lastOffset = newOffset; onMovePhase(phaseId, newOffset) }
      } else {
        const rowDelta = Math.round(dy / rowHeight)
        if (rowDelta !== lastRowDelta) {
          const curPhases = phasesRef.current
          const targetIdx = Math.max(0, Math.min(curPhases.length - 1, phaseIdx + rowDelta))
          const targetId = curPhases[targetIdx]?.id
          if (targetId && targetId !== phaseId) {
            onReorder(phaseId, targetId)
          }
          lastRowDelta = rowDelta
        }
      }
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''; document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [onMovePhase, onReorder, kickoffDate, bizDays])

  // Double-click to reset position to auto
  const handleDoubleClick = useCallback((phaseId) => {
    onMovePhase(phaseId, null)
  }, [onMovePhase])

  // Date markers — only show business days when in biz mode
  const markers = useMemo(() => {
    if (bizDays && bizDaysList) {
      const count = bizDaysList.length
      const interval = count <= 14 ? 1 : count <= 30 ? 2 : count <= 60 ? 5 : 7
      return bizDaysList.filter((_, i) => i % interval === 0)
    }
    const dayCount = countCal(timelineStart, timelineEnd)
    const interval = dayCount <= 14 ? 1 : dayCount <= 30 ? 2 : dayCount <= 60 ? 5 : 7
    const m = []
    for (let i = 0; i <= dayCount; i += interval) {
      const d = new Date(timelineStart); d.setDate(d.getDate() + i); m.push(d)
    }
    return m
  }, [bizDays, bizDaysList, timelineStart.getTime(), timelineEnd.getTime()])

  return (
    <div className="space-y-0" ref={containerRef}>
      {/* Date header */}
      <div className="relative h-6 mb-2 border-b border-border-subtle">
        {markers.map((d, i) => {
          const left = toPercent(d)
          if (left > 100) return null
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          return (
            <div key={i} className="absolute top-0 flex flex-col items-start" style={{ left: `${left}%` }}>
              <div className="w-px h-2 bg-border" />
              <span className="text-[8px] font-mono text-text-dim mt-0.5 whitespace-nowrap">
                {totalDays <= 30 ? `${dayNames[d.getDay()].charAt(0)} ` : ''}{d.getDate()}
              </span>
            </div>
          )
        })}
      </div>

      {/* Phase rows */}
      {phases.map((p) => {
        const s = TYPE_STYLES[p.type]
        const left = toPercent(p.startDate)
        const right = toPercent(p.endDate)
        const width = right - left
        const isPinned = p.manualStartOffset != null

        return (
          <div key={p.id} className="relative h-10 mb-[2px] group/row">
            <div className="absolute inset-0 border-b border-border-subtle/30" />

            {/* Bar */}
            <div
              className={`absolute top-[3px] bottom-[3px] rounded-[4px] flex items-center overflow-hidden group/bar cursor-grab active:cursor-grabbing ${isPinned ? 'ring-1 ring-warm/20' : ''}`}
              style={{ left: `${left}%`, width: `${Math.max(width, 1)}%`, background: s.bg2, border: `1px solid ${s.border}` }}
              title={`${p.name} — ${p.effectiveDuration}d\n${fmtDate(p.startDate)} – ${fmtDate(p.endDate)}\nDrag to move · Right edge to resize${isPinned ? ' · Double-click to reset' : ''}`}
              onMouseDown={(e) => handleMoveDrag(e, p.id)}
              onDoubleClick={() => handleDoubleClick(p.id)}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[4px]" style={{ background: s.color }} />
              {/* Grip dots */}
              <div className="flex-shrink-0 pl-1.5 pr-2 pointer-events-none opacity-40 group-hover/bar:opacity-70 transition-opacity" style={{ color: s.color }}>
                <Icon.Grip s={8} />
              </div>
              <span className="text-[10px] font-semibold truncate pr-2.5 relative z-10 whitespace-nowrap pointer-events-none" style={{ color: s.color }}>
                {width > 6 ? p.name : ''}{width > 3 ? ` ${p.effectiveDuration}d` : ''}
              </span>
              <div
                className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize z-20 flex items-center justify-end pr-[2px]"
                onMouseDown={(e) => handleEdgeDrag(e, p.id)}
              >
                <div className="w-[3px] h-4 rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity" style={{ background: s.color }} />
              </div>
            </div>

            {left > 20 && (
              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-mono text-text-dim truncate pointer-events-none" style={{ maxWidth: `${left - 2}%` }}>
                {p.name}
              </span>
            )}
          </div>
        )
      })}

      {/* Bottom date range */}
      <div className="flex justify-between pt-3 mt-1 border-t border-border-subtle">
        <span className="text-[11px] font-mono text-text-secondary tabular-nums">{fmtDate(timelineStart)}</span>
        <span className="text-[11px] font-mono text-text-secondary tabular-nums">{fmtDate(timelineEnd)}</span>
      </div>
    </div>
  )
}

// ─── Detail Table ────────────────────────────────────────────────────

function DetailTable({ phases }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-[10px] font-mono font-semibold tracking-[0.15em] uppercase text-text-muted">
            <th className="text-left py-3.5 px-6 border-b-2 border-border w-10">#</th>
            <th className="text-left py-3.5 px-6 border-b-2 border-border">Phase</th>
            <th className="text-left py-3.5 px-6 border-b-2 border-border w-20">Type</th>
            <th className="text-left py-3.5 px-6 border-b-2 border-border">Start</th>
            <th className="text-left py-3.5 px-6 border-b-2 border-border">End</th>
            <th className="text-right py-3.5 px-6 border-b-2 border-border w-16">Days</th>
          </tr>
        </thead>
        <tbody>
          {phases.map((p, i) => {
            const s = TYPE_STYLES[p.type]
            return (
              <tr key={p.id} className="hover:bg-bg-card-hover transition-colors">
                <td className="py-4 px-6 border-b border-border-subtle text-[11px] font-mono text-text-dim tabular-nums">{String(i + 1).padStart(2, '0')}</td>
                <td className="py-4 px-6 border-b border-border-subtle">
                  <div className="flex items-center gap-3">
                    <div className="w-[4px] h-5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-[14px] font-medium text-text-primary">{p.name}</span>
                    {p.lane !== undefined && <span className="text-[9px] font-mono text-text-dim bg-bg-elevated rounded px-1.5 py-0.5 border border-border-subtle">Lane {p.lane + 1}</span>}
                  </div>
                </td>
                <td className="py-4 px-6 border-b border-border-subtle"><TypeBadge type={p.type} /></td>
                <td className="py-4 px-6 border-b border-border-subtle font-mono text-[12px] text-text-secondary tabular-nums">{fmtDate(p.startDate)}</td>
                <td className="py-4 px-6 border-b border-border-subtle font-mono text-[12px] text-text-secondary tabular-nums">{fmtDate(p.endDate)}</td>
                <td className="py-4 px-6 border-b border-border-subtle font-mono text-[13px] text-right tabular-nums font-semibold text-text-primary">{p.effectiveDuration}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Export ──────────────────────────────────────────────────────────

function buildExportText(projectName, scheduled, delivery, bizDays, deliverables, teamSize, finishing, resizeFormats, span, warning) {
  const w = 60, line = '─'.repeat(w), dblLine = '━'.repeat(w)
  const delivList = DELIVERABLE_TYPES.filter(dt => deliverables[dt.key] > 0)
  const finishList = [finishing.color && 'Color Grade', finishing.mix && 'Audio Mix', finishing.resizes && `Resizes (${resizeFormats} formats)`].filter(Boolean)
  const lines = [
    '', `  ${projectName.toUpperCase()}`, `  ${dblLine}`, '',
    `  Kick-off      ${fmtDate(scheduled[0].startDate)}`,
    `  End            ${fmtDate(scheduled[scheduled.length - 1].endDate)}`,
    delivery ? `  Target         ${fmtDate(new Date(delivery + 'T00:00:00'))}` : null,
    `  Duration       ${span.biz} business days  /  ${span.cal} calendar days`,
    `  Day Mode       ${bizDays ? 'Business days (weekdays only)' : 'All calendar days'}`,
    `  Team           ${teamSize} editor${teamSize > 1 ? 's' : ''}${teamSize > 1 ? ' (parallel editorial)' : ''}`,
    '', `  DELIVERABLES`, `  ${line}`,
    ...delivList.map(dt => `    ${dt.label.padEnd(22)} ${String(deliverables[dt.key]).padStart(3)}`),
    '',
  ].filter(l => l !== null)
  if (finishList.length) { lines.push(`  POST-FINISHING`, `  ${line}`); finishList.forEach(f => lines.push(`    ${f}`)); lines.push('') }
  lines.push(`  SCHEDULE`, `  ${line}`, '')
  const maxName = Math.max(...scheduled.map(p => p.name.length + (p.lane !== undefined ? 8 : 0)), 10)
  lines.push(`    ${'#'.padEnd(5)}${'Phase'.padEnd(maxName + 3)}${'Type'.padEnd(7)}${'Start'.padEnd(16)}${'End'.padEnd(16)}${'Days'.padStart(4)}`)
  lines.push(`    ${'─'.repeat(5)}${'─'.repeat(maxName + 3)}${'─'.repeat(7)}${'─'.repeat(16)}${'─'.repeat(16)}${'─'.repeat(4)}`)
  scheduled.forEach((p, i) => {
    const s = TYPE_STYLES[p.type]
    const num = String(i + 1).padStart(2, '0')
    const name = p.lane !== undefined ? `${p.name} [L${p.lane + 1}]` : p.name
    lines.push(`    ${(num + '.').padEnd(5)}${name.padEnd(maxName + 3)}${s.short.padEnd(7)}${fmtDate(p.startDate).padEnd(16)}${fmtDate(p.endDate).padEnd(16)}${String(p.effectiveDuration).padStart(4)}`)
  })
  lines.push('', `  ${dblLine}`, `  Total          ${span.biz} business days  /  ${span.cal} calendar days`)
  if (warning) lines.push('', `  ⚠  ${warning}`)
  lines.push('')
  return lines.join('\n')
}

// ─── Build phases ────────────────────────────────────────────────────

function buildDefaultPhases(deliverables, teamSize, finishing, resizeFormats, splitStreams) {
  const phases = []
  let id = 1
  const canParallel = teamSize >= 2

  let offset = 0

  const add = (name, dur, type, extra = {}) => {
    phases.push({ id: String(id++), name, baseDuration: dur, type, enabled: true, defaultOffset: offset, ...extra })
    offset += dur
  }

  add('Brief / Asset Handoff', 1, 'internal')

  const hasCTV = deliverables.ctv > 0
  const hasSocial = deliverables.social > 0
  const hasCutdown = deliverables.cutdown > 0

  // Helper: add a review cycle (internal review → client review → revisions) with optional prefix
  const addReviewCycle = (prefix, stream, streamStart) => {
    const pfx = prefix ? `${prefix} — ` : ''
    const extra = stream ? { stream, streamStart } : {}
    add(`${pfx}Internal Review`, 1, 'internal', extra)
    add(`${pfx}Client Review (R1)`, 1, 'client', extra)
    add(`${pfx}Revisions (R1)`, 3, 'internal', extra)
    add(`${pfx}Internal Review (R2)`, 1, 'internal', extra)
    add(`${pfx}Client Review (R2)`, 1, 'client', extra)
    add(`${pfx}Revisions (R2)`, 2, 'internal', extra)
  }

  // Calculate editorial days, dividing work by number of editors on that stream
  const ctvRawDays = hasCTV ? Math.max(1, Math.ceil(deliverables.ctv * 3)) : 0
  const socialRawDays = hasSocial ? Math.max(1, Math.ceil(deliverables.social * 1.5)) : 0
  const cutdownRawDays = hasCutdown ? Math.max(1, Math.ceil(deliverables.cutdown * 1)) : 0

  if (splitStreams && hasCTV && hasSocial) {
    // ── Split streams: distribute editors across streams ──
    // At least 1 editor per stream, extras go to the longer stream
    let ctvEditors = 1, socialEditors = 1
    const extraEditors = teamSize - 2
    if (extraEditors > 0) {
      // Distribute extras proportionally to workload
      const ctvWork = ctvRawDays + cutdownRawDays
      const socialWork = socialRawDays
      const total = ctvWork + socialWork
      const socialExtra = total > 0 ? Math.round(extraEditors * (socialWork / total)) : 0
      socialEditors += socialExtra
      ctvEditors += (extraEditors - socialExtra)
    }

    const editStart = offset

    // CTV stream
    const ctvDays = Math.max(1, Math.ceil(ctvRawDays / ctvEditors))
    add('CTV / Hero Editorial', ctvDays, 'internal', { autoLabel: 'auto', computed: 'ctv', lane: 0, laneGroup: 'editorial', stream: 'ctv', streamStart: editStart })
    if (hasCutdown) {
      const cutDays = Math.max(1, Math.ceil(cutdownRawDays / ctvEditors))
      add('Cutdown Editorial', cutDays, 'internal', { autoLabel: 'auto', computed: 'cutdown', lane: 0, laneGroup: 'editorial', stream: 'ctv', streamStart: editStart })
    }
    addReviewCycle('CTV', 'ctv', editStart)
    const ctvEnd = offset

    // Social stream
    offset = editStart
    const socialDays = Math.max(1, Math.ceil(socialRawDays / socialEditors))
    add('Social Editorial', socialDays, 'internal', { autoLabel: 'auto', computed: 'social', lane: 1, laneGroup: 'editorial', stream: 'social', streamStart: editStart })
    addReviewCycle('Social', 'social', editStart)
    const socialEnd = offset

    offset = Math.max(ctvEnd, socialEnd)
  } else {
    // ── Single stream: divide editorial work across all editors ──
    const editStart = offset
    const editors = teamSize

    if (canParallel && (hasCTV && hasSocial)) {
      let lane0Offset = editStart
      if (hasCTV) {
        const days = Math.max(1, Math.ceil(ctvRawDays / editors))
        phases.push({ id: String(id++), name: 'CTV / Hero Editorial', baseDuration: days, type: 'internal', enabled: true, autoLabel: 'auto', computed: 'ctv', lane: 0, laneGroup: 'editorial', defaultOffset: editStart })
        lane0Offset = editStart + days
      }
      if (hasSocial) {
        const days = Math.max(1, Math.ceil(socialRawDays / editors))
        phases.push({ id: String(id++), name: 'Social Editorial', baseDuration: days, type: 'internal', enabled: true, autoLabel: 'auto', computed: 'social', lane: 1, laneGroup: 'editorial', defaultOffset: editStart })
      }
      if (hasCutdown) {
        const days = Math.max(1, Math.ceil(cutdownRawDays / editors))
        phases.push({ id: String(id++), name: 'Cutdown Editorial', baseDuration: days, type: 'internal', enabled: true, autoLabel: 'auto', computed: 'cutdown', lane: 0, laneGroup: 'editorial', defaultOffset: lane0Offset })
      }
      const laneEnds = {}
      for (const p of phases.filter(p => p.laneGroup === 'editorial')) {
        const l = p.lane || 0
        laneEnds[l] = Math.max(laneEnds[l] || 0, p.defaultOffset + p.baseDuration)
      }
      offset = Math.max(...Object.values(laneEnds))
    } else {
      if (hasCTV) {
        add('CTV / Hero Editorial', Math.max(1, Math.ceil(ctvRawDays / editors)), 'internal', { autoLabel: 'auto', computed: 'ctv' })
      }
      if (hasSocial) {
        add('Social Editorial', Math.max(1, Math.ceil(socialRawDays / editors)), 'internal', { autoLabel: 'auto', computed: 'social' })
      }
      if (hasCutdown) {
        add('Cutdown Editorial', Math.max(1, Math.ceil(cutdownRawDays / editors)), 'internal', { autoLabel: 'auto', computed: 'cutdown' })
      }
    }

    addReviewCycle('')
  }

  if (finishing.color) add('Color Grade', 2, 'internal', { finishing: 'color' })
  if (finishing.mix) add('Audio Mix', 2, 'internal', { finishing: 'mix' })
  if (finishing.resizes) add('Resizes', computeResizeDays(resizeFormats), 'internal', { finishing: 'resizes', autoLabel: 'auto', computed: 'resizes' })

  add('Final QC', 1, 'internal')
  add('Delivery / Handoff', 1, 'milestone')

  return phases.map(p => ({ ...p, manualDuration: null, manualStartOffset: null }))
}

// ─── Scheduler (free-move, squish to delivery) ──────────────────────

function schedulePhases(phases, kickoff, bizDays, delivery) {
  const enabled = phases.filter(p => p.enabled)
  if (!enabled.length) return []

  const anchor = new Date(kickoff + 'T00:00:00')

  // Natural end of full timeline
  let naturalEnd = 0
  for (const p of enabled) {
    const dur = Math.max(1, p.manualDuration || p.baseDuration)
    const offset = p.defaultOffset || 0
    naturalEnd = Math.max(naturalEnd, offset + dur)
  }

  // Scale factor: squish everything proportionally if delivery is set and overruns
  let scale = 1
  if (delivery && naturalEnd > 0) {
    const target = new Date(delivery + 'T00:00:00')
    const avail = bizDays ? countBiz(anchor, target) : countCal(anchor, target)
    if (avail > 0 && naturalEnd > avail) {
      scale = avail / naturalEnd
    }
  }

  return enabled.map(p => {
    const baseDur = Math.max(1, p.manualDuration || p.baseDuration)
    const baseOffset = p.defaultOffset || 0

    const offset = p.manualStartOffset != null
      ? p.manualStartOffset
      : Math.round(baseOffset * scale)

    const dur = p.manualDuration
      ? baseDur
      : Math.max(1, Math.round(baseDur * scale))

    const startDate = addDays(anchor, offset, bizDays)
    const endDate = addDays(startDate, dur, bizDays)
    return { ...p, effectiveDuration: dur, startDate, endDate }
  })
}

// ─── Main App ────────────────────────────────────────────────────────

export default function App() {
  const DEFAULT_DELIVERABLES = { ctv: 1, social: 23, cutdown: 3 }
  const DEFAULT_FINISHING = { color: true, mix: true, resizes: false }

  const [projectName, setProjectName] = useState('Untitled Project')
  const [editProject, setEditProject] = useState(false)
  const projRef = useRef(null)

  const [kickoff, setKickoff] = useState('2026-05-14')
  const [delivery, setDelivery] = useState('2026-06-09')
  const [bizDays, setBizDays] = useState(true)

  const [deliverables, setDeliverables] = useState(DEFAULT_DELIVERABLES)
  const [teamSize, setTeamSize] = useState(2)

  const [splitStreams, setSplitStreams] = useState(true)
  const [finishing, setFinishing] = useState(DEFAULT_FINISHING)
  const [resizeFormats, setResizeFormats] = useState(4)
  const [selectedFormats, setSelectedFormats] = useState(['9:16', '4:5', '1:1', '16:9'])

  // Phase manual overrides matching the target schedule
  const [phases, setPhases] = useState(() => {
    const base = buildDefaultPhases(DEFAULT_DELIVERABLES, 2, DEFAULT_FINISHING, 4, true)
    const overrides = {
      'Brief / Asset Handoff': { manualStartOffset: 0 },
      'CTV / Hero Editorial': { manualDuration: 5, manualStartOffset: 1 },
      'Cutdown Editorial': { manualDuration: 2, manualStartOffset: 14 },
      'CTV \u2014 Internal Review': { manualDuration: 2, manualStartOffset: 6 },
      'CTV \u2014 Client Review (R1)': { manualStartOffset: 8 },
      'CTV \u2014 Revisions (R1)': { manualDuration: 2, manualStartOffset: 9 },
      'CTV \u2014 Internal Review (R2)': { manualDuration: 2, manualStartOffset: 11 },
      'CTV \u2014 Client Review (R2)': { manualStartOffset: 13 },
      'CTV \u2014 Revisions (R2)': { manualStartOffset: 14 },
      'Social Editorial': { manualDuration: 7, manualStartOffset: 1 },
      'Social \u2014 Internal Review': { manualDuration: 3, manualStartOffset: 8 },
      'Social \u2014 Client Review (R1)': { manualStartOffset: 11 },
      'Social \u2014 Revisions (R1)': { manualDuration: 1, manualStartOffset: 12 },
      'Social \u2014 Internal Review (R2)': { manualStartOffset: 13 },
      'Social \u2014 Client Review (R2)': { manualStartOffset: 14 },
      'Social \u2014 Revisions (R2)': { manualDuration: 1, manualStartOffset: 15 },
      'Color Grade': { manualDuration: 1, manualStartOffset: 16 },
      'Audio Mix': { manualDuration: 1, manualStartOffset: 16 },
      'Final QC': { manualStartOffset: 17 },
      'Delivery / Handoff': { manualStartOffset: 17 },
    }
    return base.map(p => ({ ...p, ...(overrides[p.name] || {}) }))
  })
  const [copied, setCopied] = useState(false)
  const [saveCode, setSaveCode] = useState('')
  const [showSaveLoad, setShowSaveLoad] = useState(false)
  const [loadInput, setLoadInput] = useState('')
  const [saveMsg, setSaveMsg] = useState('')

  // Skip rebuild flag — when AI/load sets phases directly, don't let rebuildPhases overwrite
  const skipRebuildRef = useRef(false)

  // AI generation state
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiSuccess, setAiSuccess] = useState('')
  const [aiPassphrase, setAiPassphrase] = useState(() => sessionStorage.getItem('postrack_pass') || '')
  const [showPassphrase, setShowPassphrase] = useState(false)

  // Asana integration state (PAT-based, no OAuth needed)
  const [showAsanaPanel, setShowAsanaPanel] = useState(false)
  const [asanaAuthed, setAsanaAuthed] = useState(false)
  const [asanaProjects, setAsanaProjects] = useState([])
  const [asanaSelectedProject, setAsanaSelectedProject] = useState('')
  const [asanaProjectSearch, setAsanaProjectSearch] = useState('')
  const [asanaLoading, setAsanaLoading] = useState(false)
  const [asanaError, setAsanaError] = useState('')
  const [asanaSuccess, setAsanaSuccess] = useState('')
  const [asanaProjectsLoading, setAsanaProjectsLoading] = useState(false)

  // Fetch projects via server function (uses PAT)
  const searchTimerRef = useRef(null)
  const fetchAsanaProjects = useCallback(async (query = '') => {
    const pass = aiPassphrase || sessionStorage.getItem('postrack_pass') || ''
    if (!pass) return
    setAsanaProjectsLoading(true)
    try {
      const qs = query ? `?q=${encodeURIComponent(query)}&pass=${encodeURIComponent(pass)}` : `?pass=${encodeURIComponent(pass)}`
      const res = await fetch(`/.netlify/functions/asana-projects${qs}`)
      if (res.status === 403) { setAsanaAuthed(false); setAsanaError('Invalid passphrase'); return }
      const data = await res.json()
      if (data.projects) { setAsanaProjects(data.projects); setAsanaAuthed(true); setAsanaError('') }
    } catch {}
    finally { setAsanaProjectsLoading(false) }
  }, [aiPassphrase])

  // Debounced search
  const handleAsanaSearch = useCallback((value) => {
    setAsanaProjectSearch(value)
    setAsanaSelectedProject('')
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => fetchAsanaProjects(value), 300)
  }, [fetchAsanaProjects])

  const generateSaveCode = useCallback(() => {
    const state = {
      v: 1, projectName, kickoff, delivery, bizDays, deliverables, teamSize,
      splitStreams, finishing, resizeFormats, selectedFormats,
      phases: phases.map(p => ({
        name: p.name, manualDuration: p.manualDuration, manualStartOffset: p.manualStartOffset, enabled: p.enabled, type: p.type,
      })),
    }
    return btoa(unescape(encodeURIComponent(JSON.stringify(state))))
  }, [projectName, kickoff, delivery, bizDays, deliverables, teamSize, splitStreams, finishing, resizeFormats, selectedFormats, phases])

  const handleSave = useCallback(() => {
    const code = generateSaveCode()
    setSaveCode(code)
    navigator.clipboard.writeText(code).then(() => {
      setSaveMsg('Copied!')
      setTimeout(() => setSaveMsg(''), 2000)
    })
  }, [generateSaveCode])

  const applyScheduleState = useCallback((state) => {
    skipRebuildRef.current = true
    setProjectName(state.projectName || 'Untitled Project')
    setKickoff(state.kickoff || isoDate(new Date()))
    setDelivery(state.delivery || '')
    setBizDays(state.bizDays ?? true)
    setDeliverables(state.deliverables || { ctv: 1, social: 2, cutdown: 0 })
    setTeamSize(state.teamSize || 1)
    setSplitStreams(state.splitStreams || false)
    setFinishing(state.finishing || { color: false, mix: false, resizes: false })
    setResizeFormats(state.resizeFormats || 4)
    setSelectedFormats(state.selectedFormats || ['9:16', '4:5', '1:1', '16:9'])
    if (state.phases && state.phases.length > 0) {
      // AI and save codes provide complete phase lists — use directly
      setPhases(state.phases.map((p, i) => ({
        id: p.id || String(i + 1),
        name: p.name,
        baseDuration: p.manualDuration || p.baseDuration || 1,
        type: p.type || 'internal',
        enabled: p.enabled ?? true,
        defaultOffset: p.manualStartOffset ?? i,
        manualDuration: p.manualDuration || null,
        manualStartOffset: p.manualStartOffset ?? null,
        autoLabel: p.autoLabel || null,
        computed: p.computed || null,
        lane: p.lane,
        laneGroup: p.laneGroup,
        stream: p.stream,
        streamStart: p.streamStart,
        finishing: p.finishing,
      })))
    }
  }, [])

  const handleLoad = useCallback(() => {
    try {
      const state = JSON.parse(decodeURIComponent(escape(atob(loadInput.trim()))))
      applyScheduleState(state)
      setLoadInput('')
      setSaveMsg('Loaded!')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch {
      setSaveMsg('Invalid code')
      setTimeout(() => setSaveMsg(''), 2000)
    }
  }, [loadInput, applyScheduleState])

  const handleAiGenerate = useCallback(async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiError('')
    if (aiPassphrase) sessionStorage.setItem('postrack_pass', aiPassphrase)
    try {
      const res = await fetch('/.netlify/functions/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase: aiPassphrase, prompt: aiPrompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      applyScheduleState(data.schedule)
      setShowAiPanel(false)
      setAiSuccess(`Schedule generated: "${data.schedule.projectName || 'Untitled'}" — ${data.schedule.phases?.length || 0} phases`)
      setTimeout(() => setAiSuccess(''), 4000)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }, [aiPrompt, aiPassphrase, applyScheduleState])

  const handleClear = useCallback(() => {
    const freshDeliverables = { ctv: 1, social: 2, cutdown: 0 }
    const freshFinishing = { color: false, mix: false, resizes: false }
    setProjectName('Untitled Project')
    setKickoff(isoDate(new Date()))
    setDelivery('')
    setBizDays(true)
    setDeliverables(freshDeliverables)
    setTeamSize(1)
    setSplitStreams(false)
    setFinishing(freshFinishing)
    setResizeFormats(4)
    setSelectedFormats(['9:16', '4:5', '1:1', '16:9'])
    setPhases(buildDefaultPhases(freshDeliverables, 1, freshFinishing, 4, false))
    setSaveCode('')
    setLoadInput('')
  }, [])

  const rebuildPhases = useCallback(() => {
    if (skipRebuildRef.current) { skipRebuildRef.current = false; return }
    const newPhases = buildDefaultPhases(deliverables, teamSize, finishing, resizeFormats, splitStreams)
    setPhases(prev => newPhases.map(np => {
      const existing = prev.find(p => p.name === np.name)
      if (!existing) return np
      return { ...np, manualDuration: existing.manualDuration || null, manualStartOffset: existing.manualStartOffset ?? null }
    }))
  }, [deliverables, teamSize, finishing, resizeFormats, splitStreams])

  useEffect(() => { rebuildPhases() }, [rebuildPhases])

  const scheduled = useMemo(() => schedulePhases(phases, kickoff, bizDays, delivery), [phases, kickoff, bizDays, delivery])

  const handleAsanaExport = useCallback(async () => {
    if (!asanaSelectedProject || !scheduled.length) return
    setAsanaLoading(true)
    setAsanaError('')
    setAsanaSuccess('')
    try {
      const dateRe = /^\d{4}-\d{2}-\d{2}$/
      const exportPhases = scheduled.map(p => {
        const startStr = isoDate(p.startDate)
        const dueDate = new Date(p.endDate)
        dueDate.setDate(dueDate.getDate() - 1)
        if (bizDays) { while (dueDate.getDay() === 0 || dueDate.getDay() === 6) dueDate.setDate(dueDate.getDate() - 1) }
        let dueStr = isoDate(dueDate)
        if (dueStr < startStr) dueStr = startStr
        return { name: p.name, startDate: startStr, endDate: dueStr, duration: p.effectiveDuration, type: p.type, lane: p.lane }
      })
      const res = await fetch('/.netlify/functions/asana-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectGid: asanaSelectedProject, sectionName: projectName, phases: exportPhases, passphrase: aiPassphrase || sessionStorage.getItem('postrack_pass') || '' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Export failed')
      if (data.errors?.length > 0) {
        setAsanaError(`${data.tasksCreated}/${data.totalPhases} tasks created. Error: ${data.errors[0].msg}`)
      } else {
        setAsanaSuccess(`Exported ${data.tasksCreated} tasks to Asana`)
        setTimeout(() => setAsanaSuccess(''), 4000)
        setShowAsanaPanel(false)
      }
    } catch (err) {
      setAsanaError(err.message)
    } finally {
      setAsanaLoading(false)
    }
  }, [asanaSelectedProject, scheduled, projectName, bizDays])

  const span = useMemo(() => {
    if (!scheduled.length) return { biz: 0, cal: 0 }
    const s = scheduled[0].startDate, e = scheduled[scheduled.length - 1].endDate
    return { biz: countBiz(s, e), cal: countCal(s, e) }
  }, [scheduled])

  const timelineStart = useMemo(() => scheduled.length ? new Date(Math.min(...scheduled.map(p => p.startDate.getTime()))) : new Date(), [scheduled])
  const timelineEnd = useMemo(() => scheduled.length ? new Date(Math.max(...scheduled.map(p => p.endDate.getTime()))) : new Date(), [scheduled])

  const deliveryWarning = useMemo(() => {
    if (!delivery || !scheduled.length) return null
    const target = new Date(delivery + 'T00:00:00')
    const end = new Date(Math.max(...scheduled.map(p => p.endDate.getTime())))
    if (end > target) { const o = countBiz(target, end); return `Schedule exceeds delivery by ${o} business day${o !== 1 ? 's' : ''}` }
    return null
  }, [delivery, scheduled])

  const updatePhase = useCallback((id, u) => setPhases(prev => prev.map(p => p.id === id ? { ...p, ...u } : p)), [])
  const removePhase = useCallback((id) => setPhases(prev => prev.filter(p => p.id !== id)), [])
  const reorderPhase = useCallback((fromIdx, toIdx) => {
    if (fromIdx === toIdx) return
    setPhases(prev => {
      const n = [...prev]
      const [item] = n.splice(fromIdx, 1)
      n.splice(toIdx, 0, item)
      return n
    })
  }, [])

  // Gantt reorder works on scheduled (enabled-only) indices — map back to full phases array
  const reorderByIds = useCallback((fromId, toId) => {
    setPhases(prev => {
      const fromIdx = prev.findIndex(p => p.id === fromId)
      const toIdx = prev.findIndex(p => p.id === toId)
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev
      const n = [...prev]
      const [item] = n.splice(fromIdx, 1)
      n.splice(toIdx, 0, item)
      return n
    })
  }, [])
  const addPhase = useCallback(() => { setPhases(prev => [...prev, { id: genId(), name: 'New Phase', baseDuration: 2, type: 'internal', enabled: true, manualDuration: null, manualStartOffset: null }]) }, [])
  const handleGanttDrag = useCallback((phaseId, newDuration) => { setPhases(prev => prev.map(p => p.id === phaseId ? { ...p, manualDuration: newDuration } : p)) }, [])
  const handleGanttMove = useCallback((phaseId, offset) => { setPhases(prev => prev.map(p => p.id === phaseId ? { ...p, manualStartOffset: offset } : p)) }, [])

  const handleExport = useCallback(() => {
    if (!scheduled.length) return
    const text = buildExportText(projectName, scheduled, delivery, bizDays, deliverables, teamSize, finishing, resizeFormats, span, deliveryWarning)
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
  }, [scheduled, projectName, delivery, bizDays, deliverables, teamSize, finishing, resizeFormats, span, deliveryWarning])

  useEffect(() => { if (editProject && projRef.current) { projRef.current.focus(); projRef.current.select() } }, [editProject])

  const totalDeliverables = Object.values(deliverables).reduce((a, b) => a + b, 0)
  const hasParallel = scheduled.some(p => p.lane !== undefined)
  const editorialWallTime = useMemo(() => {
    const editPhases = scheduled.filter(p => p.laneGroup === 'editorial')
    if (!editPhases.length) return 0
    const start = Math.min(...editPhases.map(p => p.startDate.getTime()))
    const end = Math.max(...editPhases.map(p => p.endDate.getTime()))
    return bizDays ? countBiz(new Date(start), new Date(end)) : countCal(new Date(start), new Date(end))
  }, [scheduled, bizDays])

  const toggleFormat = (fmt) => {
    setSelectedFormats(prev => {
      const next = prev.includes(fmt) ? prev.filter(f => f !== fmt) : [...prev, fmt]
      setResizeFormats(next.length || 1)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-bg-primary w-full">
      {/* ═══ TOP BAR — full width, left-aligned ═══ */}
      <div className="relative">
        <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg, var(--color-internal) 0%, var(--color-warm) 35%, var(--color-client) 65%, transparent 100%)' }} />
        <div className="px-6 md:px-14">
          <div className="flex items-center gap-2.5 pt-5 pb-2">
            <div className="flex gap-[3px] items-end">
              <div className="w-[4px] h-3 rounded-b-full" style={{ background: 'var(--color-internal)' }} />
              <div className="w-[4px] h-5 rounded-b-full" style={{ background: 'var(--color-warm)' }} />
              <div className="w-[4px] h-3.5 rounded-b-full" style={{ background: 'var(--color-client)' }} />
            </div>
            <span className="text-[11px] font-mono font-bold tracking-[0.3em] uppercase text-text-secondary ml-1">Postrack</span>
          </div>
        </div>
      </div>

      {/* ═══ CONTENT — centered ═══ */}
      <div className="centered-content">

        {/* ═══ HEADER ═══ */}
        <header className="pt-8 pb-12 text-center">
          {editProject ? (
            <input ref={projRef} type="text" value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={() => setEditProject(false)} onKeyDown={(e) => e.key === 'Enter' && setEditProject(false)}
              className="text-[38px] md:text-[52px] font-bold tracking-[-0.03em] bg-transparent outline-none w-full max-w-2xl pb-1 text-center mx-auto block"
              style={{ borderBottom: '2px solid var(--color-warm-border)', backgroundImage: 'linear-gradient(135deg, var(--color-text-primary) 0%, var(--color-warm) 60%, var(--color-client) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }} />
          ) : (
            <h1 onClick={() => setEditProject(true)}
              className="text-[38px] md:text-[52px] font-bold tracking-[-0.03em] cursor-text transition-all duration-500 leading-[1.1]"
              style={{ backgroundImage: 'linear-gradient(135deg, var(--color-text-primary) 0%, var(--color-warm) 60%, var(--color-client) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {projectName}
            </h1>
          )}
          <p className="text-[12px] font-mono text-text-muted tracking-[0.12em] uppercase mt-3">Post-Production Schedule</p>
          <div className="mt-5 flex justify-center gap-3">
            <button onClick={handleExport}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-md text-[11px] font-mono font-semibold tracking-[0.1em] uppercase transition-all duration-300 cursor-pointer ${copied ? 'bg-success/12 text-success border border-success/25' : 'bg-bg-elevated text-text-secondary border border-border hover:border-border-hover hover:text-text-primary'}`}>
              {copied ? <><Icon.Check s={13} /> Copied</> : <><Icon.Copy /> Export</>}
            </button>
            <button onClick={() => setShowSaveLoad(!showSaveLoad)}
              className="flex items-center gap-2.5 px-6 py-3 rounded-md text-[11px] font-mono font-semibold tracking-[0.1em] uppercase transition-all duration-300 cursor-pointer bg-bg-elevated text-text-secondary border border-border hover:border-border-hover hover:text-text-primary">
              Save / Load
            </button>
            <button onClick={handleClear}
              className="flex items-center gap-2.5 px-6 py-3 rounded-md text-[11px] font-mono font-semibold tracking-[0.1em] uppercase transition-all duration-300 cursor-pointer bg-bg-elevated text-text-secondary border border-border hover:border-danger/40 hover:text-danger">
              <Icon.X s={11} /> Clear
            </button>
            <button onClick={() => { setShowAiPanel(!showAiPanel); setShowSaveLoad(false) }}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-md text-[11px] font-mono font-semibold tracking-[0.1em] uppercase transition-all duration-300 cursor-pointer border ${showAiPanel ? 'bg-internal-bg2 text-internal border-internal-border' : 'bg-bg-elevated text-text-secondary border-border hover:border-border-hover hover:text-text-primary'}`}>
              AI Generate
            </button>
            <button onClick={() => { setShowAsanaPanel(!showAsanaPanel); setShowAiPanel(false); setShowSaveLoad(false) }}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-md text-[11px] font-mono font-semibold tracking-[0.1em] uppercase transition-all duration-300 cursor-pointer border ${showAsanaPanel ? 'bg-client-bg2 text-client border-client-border' : 'bg-bg-elevated text-text-secondary border-border hover:border-border-hover hover:text-text-primary'}`}>
              Asana
            </button>
          </div>
          {showAiPanel && (
            <div className="mt-5 max-w-lg mx-auto bg-bg-card border border-border rounded-lg p-5 space-y-4">
              <div>
                <label className="text-[11px] font-mono font-semibold tracking-wider uppercase text-text-muted block mb-2">Team Passphrase</label>
                <div className="relative">
                  <input type={showPassphrase ? 'text' : 'password'} value={aiPassphrase} onChange={(e) => setAiPassphrase(e.target.value)}
                    placeholder="Enter team code..."
                    className="w-full bg-bg-elevated border border-border rounded px-3 py-2 pr-9 text-[11px] font-mono text-text-primary outline-none focus:border-warm/40 transition-colors" />
                  <button type="button" onClick={() => setShowPassphrase(!showPassphrase)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-secondary transition-colors cursor-pointer">
                    {showPassphrase ? <Icon.EyeOff s={13} /> : <Icon.Eye s={13} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-mono font-semibold tracking-wider uppercase text-text-muted block mb-2">Describe Your Project</label>
                <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. 30-second Nike brand spot with 15 social cuts and 5 cutdowns. 2 editors, need it delivered by June 20. Include color grade and audio mix."
                  rows={4}
                  className="w-full bg-bg-elevated border border-border rounded px-3 py-2.5 text-[12px] font-mono text-text-primary outline-none focus:border-warm/40 transition-colors resize-none leading-relaxed" />
              </div>
              <button onClick={handleAiGenerate} disabled={aiLoading || !aiPrompt.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded text-[11px] font-mono font-semibold uppercase tracking-wider cursor-pointer transition-all border disabled:opacity-30 disabled:cursor-default"
                style={{ background: 'rgba(107, 170, 255, 0.12)', color: 'var(--color-internal)', borderColor: 'rgba(107, 170, 255, 0.3)' }}>
                {aiLoading ? 'Generating...' : 'Generate Schedule'}
              </button>
              {aiError && (
                <div className="text-center text-[11px] font-mono font-semibold text-danger">{aiError}</div>
              )}
            </div>
          )}
          {aiSuccess && (
            <div className="mt-5 max-w-lg mx-auto flex items-center justify-center gap-2 px-5 py-3 rounded-lg border bg-success/12 border-success/25">
              <Icon.Check s={13} />
              <span className="text-[12px] font-mono font-semibold text-success">{aiSuccess}</span>
            </div>
          )}
          {asanaSuccess && (
            <div className="mt-5 max-w-lg mx-auto flex items-center justify-center gap-2 px-5 py-3 rounded-lg border bg-success/12 border-success/25">
              <Icon.Check s={13} />
              <span className="text-[12px] font-mono font-semibold text-success">{asanaSuccess}</span>
            </div>
          )}
          {showAsanaPanel && (
            <div className="mt-5 bg-bg-card border border-border rounded-lg p-5 space-y-4" style={{ maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
              {!asanaAuthed ? (
                <div className="space-y-3">
                  <label className="text-[11px] font-mono font-semibold tracking-wider uppercase text-text-muted block mb-2">Team Passphrase</label>
                  <div className="relative">
                    <input type={showPassphrase ? 'text' : 'password'} value={aiPassphrase} onChange={(e) => setAiPassphrase(e.target.value)}
                      placeholder="Enter team code..."
                      onKeyDown={(e) => { if (e.key === 'Enter' && aiPassphrase) { sessionStorage.setItem('postrack_pass', aiPassphrase); fetchAsanaProjects() } }}
                      className="w-full bg-bg-elevated border border-border rounded px-3 py-2 pr-9 text-[11px] font-mono text-text-primary outline-none focus:border-warm/40 transition-colors" />
                    <button type="button" onClick={() => setShowPassphrase(!showPassphrase)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-secondary transition-colors cursor-pointer">
                      {showPassphrase ? <Icon.EyeOff s={13} /> : <Icon.Eye s={13} />}
                    </button>
                  </div>
                  <button onClick={() => { if (aiPassphrase) { sessionStorage.setItem('postrack_pass', aiPassphrase); fetchAsanaProjects() } }}
                    disabled={!aiPassphrase}
                    className="w-full px-4 py-2.5 rounded text-[11px] font-mono font-semibold uppercase tracking-wider cursor-pointer transition-all border disabled:opacity-30 disabled:cursor-default"
                    style={{ background: 'rgba(224, 176, 96, 0.12)', color: 'var(--color-client)', borderColor: 'rgba(224, 176, 96, 0.3)' }}>
                    Connect
                  </button>
                  {asanaError && <div className="text-center text-[11px] font-mono font-semibold text-danger">{asanaError}</div>}
                </div>
              ) : (<>
              <div>
                <label className="text-[11px] font-mono font-semibold tracking-wider uppercase text-text-muted block mb-2">Search Projects</label>
                <input type="text" value={asanaProjectSearch} onChange={(e) => handleAsanaSearch(e.target.value)}
                  placeholder="Type to search Asana projects..."
                  className="w-full bg-bg-elevated border border-border rounded px-3 py-2.5 text-[12px] font-mono text-text-primary outline-none focus:border-warm/40 transition-colors" />
                <div className="mt-2 max-h-48 overflow-y-auto rounded border border-border-subtle">
                  {asanaProjectsLoading ? (
                    <div className="px-3 py-3 text-[11px] font-mono text-text-dim">Searching...</div>
                  ) : asanaProjects.length === 0 ? (
                    <div className="px-3 py-3 text-[11px] font-mono text-text-dim">{asanaProjectSearch ? 'No projects found' : 'Type to search or browse projects'}</div>
                  ) : (
                    asanaProjects.map(p => (
                      <button key={p.gid} onClick={() => { setAsanaSelectedProject(p.gid); setAsanaProjectSearch(p.name) }}
                        className={`w-full text-left px-3 py-2.5 text-[12px] font-mono transition-colors cursor-pointer border-b border-border-subtle/30 last:border-0 ${asanaSelectedProject === p.gid ? 'bg-client-bg2 text-client' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}>
                        <span className="block truncate">{p.name}</span>
                        <span className="text-[9px] text-text-dim">{p.workspace}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="bg-bg-elevated border border-border-subtle rounded p-3">
                <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider block mb-1">Will create</span>
                <span className="text-[12px] font-mono text-text-primary">Section: &ldquo;{projectName}&rdquo; with {scheduled.length} tasks</span>
              </div>
              <button onClick={handleAsanaExport} disabled={asanaLoading || !asanaSelectedProject || !scheduled.length}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded text-[11px] font-mono font-semibold uppercase tracking-wider cursor-pointer transition-all border disabled:opacity-30 disabled:cursor-default"
                style={{ background: 'rgba(224, 176, 96, 0.12)', color: 'var(--color-client)', borderColor: 'rgba(224, 176, 96, 0.3)' }}>
                {asanaLoading ? 'Exporting...' : 'Export to Asana'}
              </button>
              {asanaError && (
                <div className="text-center text-[11px] font-mono font-semibold text-danger">{asanaError}</div>
              )}
              </>)}
            </div>
          )}
          {showSaveLoad && (
            <div className="mt-5 max-w-lg mx-auto bg-bg-card border border-border rounded-lg p-5 space-y-4">
              <div className="flex gap-2">
                <button onClick={handleSave}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded text-[11px] font-mono font-semibold uppercase tracking-wider cursor-pointer transition-all bg-bg-elevated border border-border hover:border-border-hover hover:text-text-primary text-text-secondary">
                  <Icon.Copy s={12} /> Generate Code
                </button>
              </div>
              {saveCode && (
                <div className="relative">
                  <textarea readOnly value={saveCode} rows={3}
                    className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-[10px] font-mono text-text-secondary outline-none resize-none" />
                </div>
              )}
              <div className="border-t border-border-subtle pt-4">
                <label className="text-[11px] font-mono font-semibold tracking-wider uppercase text-text-muted block mb-2">Load from code</label>
                <div className="flex gap-2">
                  <input type="text" value={loadInput} onChange={(e) => setLoadInput(e.target.value)}
                    placeholder="Paste save code here..."
                    className="flex-1 bg-bg-elevated border border-border rounded px-3 py-2 text-[11px] font-mono text-text-primary outline-none focus:border-warm/40 transition-colors" />
                  <button onClick={handleLoad} disabled={!loadInput.trim()}
                    className="px-4 py-2 rounded text-[11px] font-mono font-semibold uppercase tracking-wider cursor-pointer transition-all bg-bg-elevated border border-border hover:border-border-hover hover:text-text-primary text-text-secondary disabled:opacity-30 disabled:cursor-default">
                    Load
                  </button>
                </div>
              </div>
              {saveMsg && (
                <div className={`text-center text-[11px] font-mono font-semibold ${saveMsg === 'Invalid code' ? 'text-danger' : 'text-success'}`}>
                  {saveMsg}
                </div>
              )}
            </div>
          )}
        </header>

        {/* ═══ DATES ═══ */}
        <section className="bg-bg-card border border-border rounded-lg p-8 mb-8">
          <SectionLabel>Project Dates</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-6">
            <div>
              <label className="text-[12px] font-medium text-text-secondary block mb-3">Kick-off Date</label>
              <input type="date" value={kickoff} onChange={(e) => setKickoff(e.target.value)}
                className="w-full bg-bg-elevated border border-border rounded px-3 py-2.5 text-[13px] font-mono text-text-primary outline-none focus:border-warm/40 transition-colors [color-scheme:dark]" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-text-secondary block mb-3">Delivery Date <span className="text-text-dim font-normal">(target)</span></label>
              <input type="date" value={delivery} onChange={(e) => setDelivery(e.target.value)}
                className="w-full bg-bg-elevated border border-border rounded px-3 py-2.5 text-[13px] font-mono text-text-primary outline-none focus:border-warm/40 transition-colors [color-scheme:dark]" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-text-secondary block mb-3">Day Mode</label>
              <Toggle checked={bizDays} onChange={setBizDays} labelLeft="Calendar" labelRight="Business" />
              <p className="text-[11px] text-text-muted mt-3">{bizDays ? 'Skip weekends' : 'Count all days'}</p>
            </div>
          </div>
          {deliveryWarning && (
            <div className="mt-6 flex items-center gap-3 px-5 py-4 rounded-md border bg-client-bg border-client-border">
              <Icon.Warn s={16} />
              <span className="text-[13px] font-medium text-client">{deliveryWarning}</span>
            </div>
          )}
        </section>

        {/* ═══ DELIVERABLES & TEAM ═══ */}
        <section className="bg-bg-card border border-border rounded-lg p-8 mb-8">
          <SectionLabel>Deliverables & Team</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-6">
            <div className="space-y-5">
              <label className="text-[12px] font-medium text-text-secondary block">Deliverable Breakdown</label>
              {DELIVERABLE_TYPES.map(dt => (
                <div key={dt.key} className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] text-text-primary font-medium">{dt.label}</span>
                    <span className="text-[10px] font-mono text-text-dim ml-2">{dt.daysPerUnit}d/ea</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-text-muted">= {Math.max(0, Math.ceil((deliverables[dt.key] || 0) * dt.daysPerUnit))}d</span>
                    <NumInput value={deliverables[dt.key]} onChange={(v) => setDeliverables(prev => ({ ...prev, [dt.key]: v }))} className="w-16" />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
                <span className="text-[12px] font-medium text-text-secondary">Total deliverables</span>
                <span className="text-[15px] font-mono font-semibold text-text-primary">{totalDeliverables}</span>
              </div>
              {deliverables.ctv > 0 && deliverables.social > 0 && (
                <div className="flex items-center gap-3 pt-4 border-t border-border-subtle">
                  <Checkbox checked={splitStreams} onChange={() => setSplitStreams(!splitStreams)} />
                  <div>
                    <span className="text-[13px] text-text-primary font-medium">Separate review streams</span>
                    <span className="text-[10px] font-mono text-text-dim block mt-0.5">
                      {splitStreams ? 'CTV and Social get independent review cycles' : 'All deliverables share one review cycle'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[12px] font-medium text-text-secondary block mb-3">Editors / Motion Designers</label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setTeamSize(Math.max(1, teamSize - 1))}
                      className="w-7 h-7 flex items-center justify-center rounded border border-border bg-bg-elevated hover:bg-bg-hover hover:border-border-hover text-text-muted hover:text-text-primary transition-all cursor-pointer text-[12px] font-mono">−</button>
                    <span className="font-mono text-[16px] w-8 text-center text-text-primary font-semibold">{teamSize}</span>
                    <button onClick={() => setTeamSize(Math.min(10, teamSize + 1))}
                      className="w-7 h-7 flex items-center justify-center rounded border border-border bg-bg-elevated hover:bg-bg-hover hover:border-border-hover text-text-muted hover:text-text-primary transition-all cursor-pointer text-[12px] font-mono">+</button>
                  </div>
                  <div>
                    <span className="text-[12px] font-mono text-text-secondary block">
                      {teamSize > 1 ? `${teamSize} parallel lanes` : 'Sequential editorial'}
                    </span>
                    <span className="text-[10px] font-mono text-text-dim">
                      {teamSize > 1 ? 'CTV + Social run simultaneously' : 'All editorial is sequential'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-bg-elevated border border-border-subtle rounded-lg p-5 space-y-1">
                <span className="text-[10px] font-mono font-semibold tracking-[0.15em] uppercase text-text-muted block">
                  Editorial {hasParallel ? 'Wall Time' : 'Total'}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-[32px] font-semibold text-text-primary leading-none">
                    {hasParallel ? editorialWallTime : DELIVERABLE_TYPES.reduce((s, dt) => s + Math.ceil(Math.max(0, (deliverables[dt.key] || 0) * dt.daysPerUnit)), 0)}
                  </span>
                  <span className="text-[13px] font-mono text-text-muted">days</span>
                </div>
                {hasParallel && (
                  <p className="text-[11px] text-text-dim font-mono leading-relaxed pt-1">
                    Parallel lanes save {DELIVERABLE_TYPES.reduce((s, dt) => s + Math.ceil(Math.max(0, (deliverables[dt.key] || 0) * dt.daysPerUnit)), 0) - editorialWallTime} days vs sequential
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ POST-FINISHING ═══ */}
        <section className="bg-bg-card border border-border rounded-lg p-8 mb-8">
          <SectionLabel>Post-Finishing</SectionLabel>
          <p className="text-[12px] text-text-muted mt-2 mb-6 text-center">Resizes happen after color and mix.</p>
          <div className="flex flex-wrap gap-4 mb-6 justify-center">
            {[
              { key: 'color', label: 'Color Grade', sub: '2 days' },
              { key: 'mix', label: 'Audio Mix', sub: '2 days' },
              { key: 'resizes', label: 'Resizes', sub: `${computeResizeDays(resizeFormats)}d for ${resizeFormats} format${resizeFormats !== 1 ? 's' : ''}` },
            ].map(f => (
              <button key={f.key} onClick={() => setFinishing(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                className={`flex items-center gap-3 px-5 py-3.5 rounded-lg border text-[13px] font-medium transition-all cursor-pointer ${finishing[f.key] ? 'border-warm-border bg-warm-bg2 text-text-primary' : 'border-border bg-bg-elevated text-text-muted hover:text-text-secondary hover:border-border-hover'}`}>
                <Checkbox checked={finishing[f.key]} onChange={() => { }} color="var(--color-warm)" />
                <div className="text-left">
                  <div>{f.label}</div>
                  <div className="text-[10px] font-mono text-text-dim">{f.sub}</div>
                </div>
              </button>
            ))}
          </div>
          {finishing.resizes && (
            <div className="border-t border-border-subtle pt-5 text-center">
              <label className="text-[12px] font-medium text-text-secondary block mb-3">Resize Formats</label>
              <div className="flex flex-wrap gap-2 mb-4 justify-center">
                {RESIZE_PRESETS.map(fmt => (
                  <button key={fmt} onClick={() => toggleFormat(fmt)}
                    className={`px-3 py-2 rounded text-[12px] font-mono border transition-all cursor-pointer ${selectedFormats.includes(fmt) ? 'border-warm-border bg-warm-bg2 text-text-primary' : 'border-border bg-bg-elevated text-text-muted hover:border-border-hover'}`}>
                    {fmt}
                  </button>
                ))}
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-[11px] text-text-dim">or total:</span>
                  <NumInput value={resizeFormats} onChange={(v) => { setResizeFormats(v); setSelectedFormats([]) }} min={1} max={20} className="w-14" />
                </div>
              </div>
              <p className="text-[11px] font-mono text-text-dim">
                {resizeFormats} format{resizeFormats !== 1 ? 's' : ''} = {computeResizeDays(resizeFormats)} day{computeResizeDays(resizeFormats) !== 1 ? 's' : ''}
                <span className="text-text-dim ml-1">(1d base + 0.5d per additional)</span>
              </p>
            </div>
          )}
        </section>

        {/* ═══ PHASES ═══ */}
        <section className="bg-bg-card border border-border rounded-lg mb-8 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border">
            <div className="flex items-center gap-3">
              <SectionLabel center={false}>Phases</SectionLabel>
              <span className="text-[11px] font-mono text-text-secondary bg-bg-elevated rounded px-2 py-0.5 border border-border-subtle tabular-nums">
                {phases.filter(p => p.enabled).length} / {phases.length}
              </span>
              {hasParallel && (
                <span className="text-[10px] font-mono text-text-dim bg-bg-elevated rounded px-2 py-0.5 border border-border-subtle flex items-center gap-1">
                  <Icon.Parallel s={9} /> Parallel editorial
                </span>
              )}
            </div>
            <button onClick={addPhase}
              className="flex items-center gap-2 px-4 py-2 text-[11px] font-mono font-semibold tracking-[0.05em] uppercase text-text-secondary hover:text-text-primary bg-bg-elevated border border-border hover:border-border-hover rounded transition-all cursor-pointer">
              <Icon.Plus s={11} /> Add Phase
            </button>
          </div>
          <PhaseList phases={phases} scheduled={scheduled} updatePhase={updatePhase} removePhase={removePhase} reorderPhase={reorderPhase} />
        </section>

        {/* ═══ TIMELINE ═══ */}
        {scheduled.length > 0 && (
          <section className="bg-bg-card border border-border rounded-lg p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <SectionLabel center={false}>Timeline</SectionLabel>
                <span className="text-[10px] font-mono text-text-dim">drag to move · edge to resize · dbl-click to reset</span>
              </div>
              <div className="flex items-center gap-5">
                {Object.entries(TYPE_STYLES).map(([key, s]) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                    <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">{key}</span>
                  </div>
                ))}
              </div>
            </div>
            <GanttChart phases={scheduled} timelineStart={timelineStart} timelineEnd={timelineEnd} onDurationChange={handleGanttDrag} onMovePhase={handleGanttMove} onReorder={reorderByIds} kickoffDate={kickoff} bizDays={bizDays} />
          </section>
        )}

        {/* ═══ SUMMARY ═══ */}
        {scheduled.length > 0 && (
          <section className="mb-8">
            <div className="mb-5"><SectionLabel>Summary</SectionLabel></div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <Stat label="Duration" value={`${span.biz} days`} sub={`${span.biz} biz / ${span.cal} calendar`} />
              <Stat label="Phases" value={scheduled.length} sub={`${totalDeliverables} deliverables`} />
              <Stat label="Start" value={fmtDate(timelineStart)} />
              <Stat label="End" value={fmtDate(timelineEnd)} />
              <Stat label="Team" value={teamSize} sub={hasParallel ? 'Parallel editorial' : 'Sequential'} />
            </div>
          </section>
        )}

        {/* ═══ TABLE ═══ */}
        {scheduled.length > 0 && (
          <section className="bg-bg-card border border-border rounded-lg overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-border"><SectionLabel center={false}>Schedule Detail</SectionLabel></div>
            <DetailTable phases={scheduled} />
          </section>
        )}

        {/* ═══ FOOTER ═══ */}
        <footer className="py-10 text-center">
          <span className="text-[11px] font-mono text-text-muted tracking-[0.15em] uppercase">Postrack v1.0 — {bizDays ? 'Business days' : 'Calendar days'} mode</span>
        </footer>
      </div>
    </div>
  )
}
