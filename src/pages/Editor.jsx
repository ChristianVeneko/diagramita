import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { useDiagram } from '../store/DiagramContext.jsx'
import { importMermaidToDiagram, importMermaidClassToDiagram } from '../lib/mermaid.js'
import { generateSql } from '../lib/sql.js'
import { applyAutoLayout } from '../lib/layout.js'
import {
  createId, createFieldDraft, createTableFromDraft, cloneField,
  getMinimumTableHeight, isEditableTarget, getCardinality, normalizeIdentifier,
  toSnakeCase,
} from '../lib/diagram.js'
import {
  GRID_SIZE, HEADER_HEIGHT, ROW_HEIGHT, STORAGE_KEY,
  MERMAID_ER_SAMPLE, MERMAID_CLASS_SAMPLE,
} from '../constants.js'
import { Toolbar } from '../components/Toolbar.jsx'
import { TableNode } from '../components/TableNode.jsx'
import { RelationLayer } from '../components/RelationLayer.jsx'
import { Minimap } from '../components/Minimap.jsx'
import { ColorPanel, RelationPanel } from '../components/ColorPanel.jsx'
import { ShortcutsPanel } from '../components/ShortcutsPanel.jsx'
import { TemplatesPanel } from '../components/TemplatesPanel.jsx'
import { NewTableModal } from '../components/modals/NewTableModal.jsx'
import { FieldModal } from '../components/modals/FieldModal.jsx'
import { RelationModal } from '../components/modals/RelationModal.jsx'
import { MermaidModal } from '../components/modals/MermaidModal.jsx'
import { SqlModal } from '../components/modals/SqlModal.jsx'

export default function Editor() {
  const { diagram, canUndo, canRedo, apply, undo, redo, reset } = useDiagram()
  const { tables, relations, diagramType, theme, snapToGrid } = diagram
  const isClassMode = diagramType === 'class'

  // Viewport
  const viewportRef = useRef(null)
  const canvasRef = useRef(null)
  const [viewport, setViewport] = useState({ x: 160, y: 80, zoom: 1 })
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 })
  const [spacePressed, setSpacePressed] = useState(false)

  // Selection
  const [selectedTableIds, setSelectedTableIds] = useState([])
  const [selectedRelationId, setSelectedRelationId] = useState(null)
  const [selectionBox, setSelectionBox] = useState(null)
  const [dragRelation, setDragRelation] = useState(null)

  // Copy/paste
  const [clipboard, setClipboard] = useState(null)

  // Modals
  const [newTableOpen, setNewTableOpen] = useState(false)
  const [fieldModal, setFieldModal] = useState(null)
  const [relationModal, setRelationModal] = useState(null)
  const [mermaidOpen, setMermaidOpen] = useState(false)
  const [mermaidDraft, setMermaidDraft] = useState(MERMAID_ER_SAMPLE)
  const [mermaidImportType, setMermaidImportType] = useState('er')
  const [mermaidError, setMermaidError] = useState('')
  const [sqlOpen, setSqlOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)

  const [renameState, setRenameState] = useState(null)
  const [toast, setToast] = useState('')
  const toastRef = useRef(null)

  const [newTableDraft, setNewTableDraft] = useState(() => ({
    name: '', count: 3,
    fields: [createFieldDraft(0), createFieldDraft(1), createFieldDraft(2)],
  }))

  // Interaction refs
  const panRef = useRef(null)
  const movingRef = useRef(null)
  const resizeRef = useRef(null)
  const selectionRef = useRef(null)
  const relationRef = useRef(null)

  // ── Derived ────────────────────────────────────────────────────────────────
  const tableById = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables])
  const selectedTable = selectedTableIds.length === 1 ? tableById.get(selectedTableIds[0]) : null
  const selectedRelation = selectedRelationId ? relations.find((r) => r.id === selectedRelationId) || null : null
  const sqlPreview = useMemo(() => isClassMode ? '-- Export SQL disponible solo en modo ER' : generateSql(diagram), [diagram, isClassMode])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const pushToast = useCallback((msg) => {
    if (toastRef.current) clearTimeout(toastRef.current)
    setToast(msg)
    toastRef.current = setTimeout(() => setToast(''), 2200)
  }, [])

  const snapValue = useCallback((v) => snapToGrid ? Math.round(v / GRID_SIZE) * GRID_SIZE : v, [snapToGrid])

  const screenToWorld = useCallback((cx, cy) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: (cx - rect.left - viewport.x) / viewport.zoom, y: (cy - rect.top - viewport.y) / viewport.zoom }
  }, [viewport])

  const worldToScreen = useCallback((p) => ({
    x: p.x * viewport.zoom + viewport.x,
    y: p.y * viewport.zoom + viewport.y,
  }), [viewport])

  const normalizeRect = useCallback((a, b) => ({
    x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y),
  }), [])

  const getFieldAnchor = useCallback((table, fieldId, side) => {
    if (table.modelType === 'class') {
      const h = Math.max(table.height, getMinimumTableHeight(table.fields.length))
      return { x: side === 'right' ? table.x + table.width : table.x, y: table.y + h / 2 }
    }
    const idx = table.fields.findIndex((f) => f.id === fieldId)
    const safe = idx >= 0 ? idx : 0
    return { x: side === 'right' ? table.x + table.width : table.x, y: table.y + HEADER_HEIGHT + safe * ROW_HEIGHT + ROW_HEIGHT / 2 }
  }, [])

  // ── Computed shapes ─────────────────────────────────────────────────────────
  const relationShapes = useMemo(() => relations.map((rel) => {
    const src = tableById.get(rel.sourceTableId)
    const tgt = tableById.get(rel.targetTableId)
    if (!src || !tgt) return null
    const srcAtLeft = src.x <= tgt.x
    const srcSide = srcAtLeft ? 'right' : 'left'
    const tgtSide = srcAtLeft ? 'left' : 'right'
    const srcWorld = getFieldAnchor(src, rel.sourceFieldId, srcSide)
    const tgtWorld = getFieldAnchor(tgt, rel.targetFieldId, tgtSide)
    const source = worldToScreen(srcWorld)
    const target = worldToScreen(tgtWorld)
    const dir = srcSide === 'right' ? 1 : -1
    const gap = Math.max(60, Math.abs(target.x - source.x) * 0.45)
    const c1 = { x: source.x + gap * dir, y: source.y }
    const c2 = { x: target.x - gap * dir, y: target.y }
    const mid = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 - 10 }
    const card = getCardinality(rel.type)
    return {
      relation: rel, source, target,
      path: `M ${source.x} ${source.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${target.x} ${target.y}`,
      labelPoint: mid,
      sourceLabelPoint: { x: source.x + (c1.x - source.x) * 0.4, y: source.y + (c1.y - source.y) * 0.4 - 10 },
      targetLabelPoint: { x: target.x + (c2.x - target.x) * 0.4, y: target.y + (c2.y - target.y) * 0.4 - 10 },
      startMarker: card.start === 'one' ? 'marker-one' : 'marker-many',
      endMarker: card.end === 'one' ? 'marker-one' : 'marker-many',
    }
  }).filter(Boolean), [relations, tableById, getFieldAnchor, worldToScreen])

  const selectionScreenRect = useMemo(() => {
    if (!selectionBox) return null
    const tl = worldToScreen({ x: selectionBox.x, y: selectionBox.y })
    const br = worldToScreen({ x: selectionBox.x + selectionBox.width, y: selectionBox.y + selectionBox.height })
    return normalizeRect(tl, br)
  }, [selectionBox, worldToScreen, normalizeRect])

  const minimapData = useMemo(() => {
    const mapWidth = 230, mapHeight = 150, padding = 12
    if (tables.length === 0) return { mapWidth, mapHeight, padding, bounds: { minX: 0, minY: 0, width: 1000, height: 700 } }
    const minX = Math.min(...tables.map((t) => t.x))
    const minY = Math.min(...tables.map((t) => t.y))
    const maxX = Math.max(...tables.map((t) => t.x + t.width))
    const maxY = Math.max(...tables.map((t) => t.y + Math.max(t.height, getMinimumTableHeight(t.fields.length))))
    return { mapWidth, mapHeight, padding, bounds: { minX: minX - 120, minY: minY - 120, width: Math.max(300, maxX - minX + 240), height: Math.max(200, maxY - minY + 240) } }
  }, [tables])

  const minimapScale = useMemo(() => {
    const { mapWidth, mapHeight, padding, bounds } = minimapData
    return Math.min((mapWidth - padding * 2) / bounds.width, (mapHeight - padding * 2) / bounds.height)
  }, [minimapData])

  const viewportRectInWorld = useMemo(() => ({
    x: -viewport.x / viewport.zoom, y: -viewport.y / viewport.zoom,
    width: viewportSize.width / viewport.zoom, height: viewportSize.height / viewport.zoom,
  }), [viewport, viewportSize])

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const obs = new ResizeObserver(([entry]) => setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    if (viewportRef.current) obs.observe(viewportRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(diagram))
  }, [diagram])

  useEffect(() => () => { if (toastRef.current) clearTimeout(toastRef.current) }, [])

  // ── Pointer move/up ────────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e) => {
      if (panRef.current) {
        const dx = e.clientX - panRef.current.startClientX
        const dy = e.clientY - panRef.current.startClientY
        setViewport((p) => ({ ...p, x: panRef.current.startX + dx, y: panRef.current.startY + dy }))
        return
      }
      if (movingRef.current) {
        const world = screenToWorld(e.clientX, e.clientY)
        const dx = world.x - movingRef.current.start.x
        const dy = world.y - movingRef.current.start.y
        const positions = {}
        for (const id of movingRef.current.ids) {
          const init = movingRef.current.initialPositions[id]
          if (init) positions[id] = { x: snapValue(init.x + dx), y: snapValue(init.y + dy) }
        }
        movingRef.current.lastPositions = positions
        apply({ type: 'SET_TABLE_POSITIONS', positions }, { record: false })
        return
      }
      if (resizeRef.current) {
        const world = screenToWorld(e.clientX, e.clientY)
        apply({ type: 'RESIZE_TABLE', tableId: resizeRef.current.tableId, width: snapValue(resizeRef.current.initW + world.x - resizeRef.current.start.x), height: snapValue(resizeRef.current.initH + world.y - resizeRef.current.start.y) }, { record: false })
        return
      }
      if (selectionRef.current) {
        setSelectionBox(normalizeRect(selectionRef.current.start, screenToWorld(e.clientX, e.clientY)))
        return
      }
      if (relationRef.current) {
        const cp = screenToWorld(e.clientX, e.clientY)
        relationRef.current = { ...relationRef.current, currentPoint: cp }
        setDragRelation({ ...relationRef.current })
      }
    }

    const onUp = (e) => {
      if (panRef.current) { panRef.current = null }
      if (movingRef.current) {
        const final = movingRef.current.lastPositions
        movingRef.current = null
        if (final) apply({ type: 'SET_TABLE_POSITIONS', positions: final })
      }
      if (resizeRef.current) {
        const world = screenToWorld(e.clientX, e.clientY)
        apply({ type: 'RESIZE_TABLE', tableId: resizeRef.current.tableId, width: snapValue(resizeRef.current.initW + world.x - resizeRef.current.start.x), height: snapValue(resizeRef.current.initH + world.y - resizeRef.current.start.y) })
        resizeRef.current = null
      }
      if (selectionRef.current) {
        const rect = selectionBox
        const additive = selectionRef.current.additive
        selectionRef.current = null
        setSelectionBox(null)
        if (rect && (rect.width > 4 || rect.height > 4)) {
          const hit = tables.filter((t) => {
            const th = Math.max(t.height, getMinimumTableHeight(t.fields.length))
            return !(rect.x > t.x + t.width || rect.x + rect.width < t.x || rect.y > t.y + th || rect.y + rect.height < t.y)
          }).map((t) => t.id)
          if (additive) {
            setSelectedTableIds((p) => [...new Set([...p, ...hit])])
          } else {
            setSelectedTableIds(hit)
          }
        }
      }
      if (relationRef.current) {
        const src = relationRef.current
        relationRef.current = null
        setDragRelation(null)
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-field-handle="true"]')
        if (!el) return
        const tgtTableId = el.getAttribute('data-table-id')
        const tgtFieldId = el.getAttribute('data-field-id')
        if (!tgtTableId || !tgtFieldId || (tgtTableId === src.sourceTableId && tgtFieldId === src.sourceFieldId)) return
        setRelationModal({ sourceTableId: src.sourceTableId, sourceFieldId: src.sourceFieldId, targetTableId: tgtTableId, targetFieldId: tgtFieldId, relationType: '1:N', color: '#0ea5e9' })
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [apply, normalizeRect, screenToWorld, selectionBox, selectedTableIds, snapValue, tables])

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      const editable = isEditableTarget(e.target)

      if (mod && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return }
      if (mod && (key === 'y')) { e.preventDefault(); redo(); return }
      if (mod && key === 's') { e.preventDefault(); saveToLocalStorage(); return }

      if (mod && key === 'c' && !editable) {
        e.preventDefault()
        handleCopy()
        return
      }
      if (mod && key === 'v' && !editable) {
        e.preventDefault()
        handlePaste()
        return
      }
      if (mod && key === 'a' && !editable) {
        e.preventDefault()
        setSelectedTableIds(tables.map((t) => t.id))
        return
      }

      if (key === 'f' && !editable) {
        e.preventDefault()
        handleFitToView()
        return
      }
      if (e.key === '?' && !editable) {
        setShortcutsOpen((p) => !p)
        return
      }

      if (e.code === 'Space' && !editable) { e.preventDefault(); setSpacePressed(true); return }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !editable) {
        if (selectedRelationId) { apply({ type: 'DELETE_RELATION', relationId: selectedRelationId }); setSelectedRelationId(null); return }
        if (selectedTableIds.length > 0) { apply({ type: 'DELETE_TABLES', tableIds: selectedTableIds }); setSelectedTableIds([]) }
      }
    }
    const onKeyUp = (e) => { if (e.code === 'Space') setSpacePressed(false) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apply, redo, undo, selectedRelationId, selectedTableIds, tables, clipboard, snapToGrid])

  // ── Wheel (passive:false required for preventDefault) ──────────────────────
  const wheelHandlerRef = useRef(null)
  wheelHandlerRef.current = (e) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return
      const px = e.clientX - rect.left, py = e.clientY - rect.top
      const wx = (px - viewport.x) / viewport.zoom, wy = (py - viewport.y) / viewport.zoom
      const dz = Math.exp(-e.deltaY * 0.0018)
      const nz = Math.max(0.2, Math.min(2.8, viewport.zoom * dz))
      setViewport({ zoom: nz, x: px - wx * nz, y: py - wy * nz })
      return
    }
    setViewport((p) => ({ ...p, x: p.x - e.deltaX * 0.5, y: p.y - e.deltaY * 0.5 }))
  }

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const handler = (e) => wheelHandlerRef.current(e)
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // ── Canvas handlers ─────────────────────────────────────────────────────────

  const handleCanvasPointerDown = (e) => {
    if (e.button !== 0 && e.button !== 1) return
    if (e.button === 1 || spacePressed) {
      panRef.current = { startClientX: e.clientX, startClientY: e.clientY, startX: viewport.x, startY: viewport.y }
      return
    }
    setSelectedRelationId(null)
    if (!e.shiftKey) setSelectedTableIds([])
    const start = screenToWorld(e.clientX, e.clientY)
    selectionRef.current = { start, additive: e.shiftKey }
    setSelectionBox({ x: start.x, y: start.y, width: 0, height: 0 })
  }

  const startTableMove = (e, tableId) => {
    if (e.button !== 0) return
    e.stopPropagation()
    setSelectedRelationId(null)
    let ids = selectedTableIds.includes(tableId) ? selectedTableIds : [tableId]
    if (e.shiftKey) { const s = new Set(selectedTableIds); s.add(tableId); ids = [...s]; setSelectedTableIds(ids) }
    else if (!selectedTableIds.includes(tableId)) setSelectedTableIds([tableId])
    const start = screenToWorld(e.clientX, e.clientY)
    const initialPositions = {}
    for (const id of ids) { const t = tableById.get(id); if (t) initialPositions[id] = { x: t.x, y: t.y } }
    movingRef.current = { ids, start, initialPositions, lastPositions: null }
  }

  const startTableResize = (e, table) => {
    e.stopPropagation()
    setSelectedTableIds([table.id])
    resizeRef.current = { tableId: table.id, start: screenToWorld(e.clientX, e.clientY), initW: table.width, initH: table.height }
  }

  const startRelationDrag = (e, table, field, side) => {
    e.stopPropagation()
    e.preventDefault()
    const srcTable = table || tableById.get(field ? [...tables].find((t) => t.fields.some((f) => f.id === field.id))?.id : null)
    if (!srcTable) return
    const anchor = getFieldAnchor(srcTable, field.id, side)
    relationRef.current = { sourceTableId: srcTable.id, sourceFieldId: field.id, sourcePoint: anchor, currentPoint: anchor }
    setDragRelation({ ...relationRef.current })
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  const saveToLocalStorage = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(diagram))
    pushToast('Guardado')
  }, [diagram, pushToast])

  const loadFromLocalStorage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) { pushToast('No hay diagrama guardado'); return }
      reset(JSON.parse(raw))
      setSelectedTableIds([])
      setSelectedRelationId(null)
      pushToast('Diagrama cargado')
    } catch { pushToast('No se pudo cargar') }
  }

  const importFromMermaid = () => {
    try {
      const parser = mermaidImportType === 'class' ? importMermaidClassToDiagram : importMermaidToDiagram
      const parsed = parser(mermaidDraft, { theme: diagram.theme, snapToGrid: diagram.snapToGrid })
      const laid = applyAutoLayout(parsed)
      reset(laid)
      setMermaidOpen(false)
      setMermaidError('')
      setSelectedTableIds([])
      pushToast(`${laid.tables.length} entidades importadas`)
    } catch (err) {
      setMermaidError(err instanceof Error ? err.message : 'No se pudo importar')
    }
  }

  const exportPng = async () => {
    if (!canvasRef.current || !viewportRef.current) return
    const bgColor = theme === 'dark' ? '#020617' : '#f0f9ff'

    if (tables.length === 0) {
      try {
        const url = await toPng(canvasRef.current, { cacheBust: true, pixelRatio: 3, backgroundColor: bgColor })
        const a = document.createElement('a'); a.download = 'diagrama.png'; a.href = url; a.click()
        pushToast('PNG exportado')
      } catch { pushToast('No se pudo exportar') }
      return
    }

    const prevViewport = { ...viewport }
    try {
      // Compute bounding box of all tables in world space
      const pad = 60
      const minX = Math.min(...tables.map((t) => t.x)) - pad
      const minY = Math.min(...tables.map((t) => t.y)) - pad
      const maxX = Math.max(...tables.map((t) => t.x + t.width)) + pad
      const maxY = Math.max(...tables.map((t) => t.y + t.height)) + pad

      const { width: vpW, height: vpH } = viewportSize
      const fitZoomX = vpW / (maxX - minX)
      const fitZoomY = vpH / (maxY - minY)
      // Use 2x the fit zoom (high quality), capped at 3 to avoid huge images
      const exportZoom = Math.min(Math.max(fitZoomX, fitZoomY) * 2, 3)

      const exportX = -minX * exportZoom + pad
      const exportY = -minY * exportZoom + pad
      const exportW = Math.round((maxX - minX) * exportZoom)
      const exportH = Math.round((maxY - minY) * exportZoom)

      setViewport({ x: exportX, y: exportY, zoom: exportZoom })
      // Wait two animation frames for React to re-render at new viewport
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

      const url = await toPng(viewportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: bgColor,
        width: exportW,
        height: exportH,
        style: { overflow: 'hidden' },
      })
      const a = document.createElement('a'); a.download = 'diagrama.png'; a.href = url; a.click()
      pushToast('PNG exportado')
    } catch { pushToast('No se pudo exportar') }
    finally { setViewport(prevViewport) }
  }

  const copySql = async () => {
    try { await navigator.clipboard.writeText(sqlPreview); pushToast('SQL copiado') }
    catch { pushToast('No se pudo copiar') }
  }

  const downloadSql = () => {
    const blob = new Blob([sqlPreview], { type: 'text/sql;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'schema.sql'; a.click()
    URL.revokeObjectURL(url)
    pushToast('SQL descargado')
  }

  const handleMinimapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const lx = e.clientX - rect.left, ly = e.clientY - rect.top
    const { padding, bounds } = minimapData
    const wx = bounds.minX + (lx - padding) / minimapScale
    const wy = bounds.minY + (ly - padding) / minimapScale
    setViewport((p) => ({ ...p, x: viewportSize.width / 2 - wx * p.zoom, y: viewportSize.height / 2 - wy * p.zoom }))
  }

  const handleFitToView = useCallback(() => {
    if (tables.length === 0) return
    const minX = Math.min(...tables.map((t) => t.x))
    const minY = Math.min(...tables.map((t) => t.y))
    const maxX = Math.max(...tables.map((t) => t.x + t.width))
    const maxY = Math.max(...tables.map((t) => t.y + Math.max(t.height, getMinimumTableHeight(t.fields.length))))
    const pad = 80
    const scaleX = (viewportSize.width - pad * 2) / (maxX - minX)
    const scaleY = (viewportSize.height - pad * 2) / (maxY - minY)
    const zoom = Math.min(Math.max(0.2, Math.min(scaleX, scaleY)), 2)
    const x = (viewportSize.width - (maxX - minX) * zoom) / 2 - minX * zoom
    const y = (viewportSize.height - (maxY - minY) * zoom) / 2 - minY * zoom
    setViewport({ x, y, zoom })
  }, [tables, viewportSize])

  const handleCopy = useCallback(() => {
    if (selectedTableIds.length === 0) return
    const sel = new Set(selectedTableIds)
    const copiedTables = tables.filter((t) => sel.has(t.id))
    const copiedRelations = relations.filter((r) => sel.has(r.sourceTableId) && sel.has(r.targetTableId))
    setClipboard({ tables: copiedTables, relations: copiedRelations })
    pushToast(`${copiedTables.length} tabla(s) copiadas`)
  }, [selectedTableIds, tables, relations, pushToast])

  const handlePaste = useCallback(() => {
    if (!clipboard) return
    const tableIdMap = new Map()
    const fieldIdMap = new Map()
    const newTables = clipboard.tables.map((t) => {
      const newId = createId('tbl')
      tableIdMap.set(t.id, newId)
      const newFields = t.fields.map((f) => {
        const nfId = createId('fld')
        fieldIdMap.set(`${t.id}/${f.id}`, nfId)
        return { ...f, id: nfId, reference: null }
      })
      return { ...t, id: newId, x: t.x + 48, y: t.y + 48, fields: newFields }
    })
    const newRelations = clipboard.relations.map((r) => {
      const nSrcTable = tableIdMap.get(r.sourceTableId)
      const nTgtTable = tableIdMap.get(r.targetTableId)
      const nSrcField = fieldIdMap.get(`${r.sourceTableId}/${r.sourceFieldId}`)
      const nTgtField = fieldIdMap.get(`${r.targetTableId}/${r.targetFieldId}`)
      if (!nSrcTable || !nTgtTable || !nSrcField || !nTgtField) return null
      return { ...r, id: createId('rel'), sourceTableId: nSrcTable, sourceFieldId: nSrcField, targetTableId: nTgtTable, targetFieldId: nTgtField }
    }).filter(Boolean)
    apply({ type: 'PASTE_TABLES', tables: newTables, relations: newRelations })
    setSelectedTableIds(newTables.map((t) => t.id))
    pushToast(`${newTables.length} tabla(s) pegadas`)
  }, [clipboard, apply, pushToast])

  const handleTemplate = (tpl) => {
    try {
      const parser = tpl.type === 'class' ? importMermaidClassToDiagram : importMermaidToDiagram
      const parsed = parser(tpl.mermaid, { theme: diagram.theme, snapToGrid: diagram.snapToGrid })
      const laid = applyAutoLayout(parsed)
      reset(laid)
      setTemplatesOpen(false)
      setSelectedTableIds([])
      pushToast(`Plantilla "${tpl.name}" cargada`)
    } catch { pushToast('No se pudo cargar la plantilla') }
  }

  // New table draft helpers
  const updateNewTableCount = (next) => {
    const n = Math.max(1, Math.min(30, Number(next) || 1))
    setNewTableDraft((d) => {
      const fields = [...d.fields]
      while (fields.length < n) fields.push(createFieldDraft(fields.length))
      while (fields.length > n) fields.pop()
      return { ...d, count: n, fields }
    })
  }

  const resetNewTableDraft = () => setNewTableDraft({ name: '', count: 3, fields: [createFieldDraft(0), createFieldDraft(1), createFieldDraft(2)] })

  const createTableFromModal = () => {
    const center = {
      x: (-viewport.x + viewportSize.width / 2) / viewport.zoom - 120,
      y: (-viewport.y + viewportSize.height / 2) / viewport.zoom - 80,
    }
    const fields = isClassMode
      ? [
          ...newTableDraft.fields.map((f, i) => ({ id: createId('fld'), name: normalizeIdentifier(f.name, `atributo_${i + 1}`), type: f.type || 'String', length: '', constraints: { primaryKey: false, foreignKey: false, notNull: false, unique: false, autoIncrement: false, defaultValue: '' }, reference: null, memberKind: 'attribute', visibility: '-', params: '' })),
          { id: createId('fld'), name: 'toString', type: 'String', length: '', constraints: { primaryKey: false, foreignKey: false, notNull: false, unique: false, autoIncrement: false, defaultValue: '' }, reference: null, memberKind: 'method', visibility: '+', params: '' },
        ]
      : newTableDraft.fields.map((f, i) => cloneField(f, i))

    const table = createTableFromDraft({ name: newTableDraft.name, fields, position: { x: snapValue(center.x), y: snapValue(center.y) }, width: isClassMode ? 320 : 260, modelType: isClassMode ? 'class' : 'entity' })
    apply({ type: 'ADD_TABLE', table })
    setNewTableOpen(false)
    resetNewTableDraft()
    setSelectedTableIds([table.id])
    pushToast(isClassMode ? 'Clase creada' : 'Tabla creada')
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={`relative flex h-screen w-screen flex-col ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-sky-50 text-slate-900'}`}>
      <Toolbar
        isClassMode={isClassMode} theme={theme} snapToGrid={snapToGrid}
        canUndo={canUndo} canRedo={canRedo} zoom={viewport.zoom}
        selectedCount={selectedTableIds.length}
        onNewTable={() => setNewTableOpen(true)}
        onSave={saveToLocalStorage}
        onLoad={loadFromLocalStorage}
        onImportMermaid={() => { setMermaidImportType(isClassMode ? 'class' : 'er'); setMermaidDraft(isClassMode ? MERMAID_CLASS_SAMPLE : MERMAID_ER_SAMPLE); setMermaidOpen(true); setMermaidError('') }}
        onToggleMode={() => apply({ type: 'SET_DIAGRAM_TYPE', diagramType: isClassMode ? 'er' : 'class' })}
        onExportPng={exportPng}
        onExportSql={() => setSqlOpen(true)}
        onUndo={undo} onRedo={redo}
        onToggleTheme={() => apply({ type: 'SET_THEME', theme: theme === 'dark' ? 'light' : 'dark' })}
        onToggleSnap={(e) => apply({ type: 'SET_SNAP', enabled: e.target.checked })}
        onDeleteSelected={() => { apply({ type: 'DELETE_TABLES', tableIds: selectedTableIds }); setSelectedTableIds([]) }}
        onShowShortcuts={() => setShortcutsOpen(true)}
        onShowTemplates={() => setTemplatesOpen(true)}
        onFitToView={handleFitToView}
        onZoomIn={() => setViewport((p) => ({ ...p, zoom: Math.min(2.8, p.zoom + 0.1) }))}
        onZoomOut={() => setViewport((p) => ({ ...p, zoom: Math.max(0.2, p.zoom - 0.1) }))}
      />

      <main
        ref={viewportRef}
        className="relative flex-1 overflow-hidden"
        onPointerDown={handleCanvasPointerDown}
      >
        {/* Background */}
        <div className="absolute inset-0" style={{
          backgroundColor: theme === 'dark' ? '#020617' : '#eff6ff',
          backgroundImage: theme === 'dark'
            ? `radial-gradient(circle at 85% 20%, rgba(14,116,144,0.24), transparent 35%),radial-gradient(circle at 15% 70%, rgba(56,189,248,0.14), transparent 40%),linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px),linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)`
            : `radial-gradient(circle at 85% 20%, rgba(2,132,199,0.18), transparent 35%),radial-gradient(circle at 10% 75%, rgba(6,182,212,0.16), transparent 35%),linear-gradient(rgba(14,116,144,0.10) 1px, transparent 1px),linear-gradient(90deg, rgba(14,116,144,0.10) 1px, transparent 1px)`,
          backgroundSize: `cover,cover,${GRID_SIZE * viewport.zoom}px ${GRID_SIZE * viewport.zoom}px,${GRID_SIZE * viewport.zoom}px ${GRID_SIZE * viewport.zoom}px`,
          backgroundPosition: `0 0,0 0,${viewport.x}px ${viewport.y}px,${viewport.x}px ${viewport.y}px`,
        }} />

        <div ref={canvasRef} className="absolute inset-0">
          <RelationLayer
            relationShapes={relationShapes}
            dragRelation={dragRelation}
            worldToScreen={worldToScreen}
            selectedRelationId={selectedRelationId}
            onSelectRelation={(id) => { setSelectedRelationId(id); setSelectedTableIds([]) }}
            theme={theme}
          />

          {/* Tables */}
          <div className="absolute inset-0 z-20" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: '0 0' }}>
            {tables.map((table) => {
              const selected = selectedTableIds.includes(table.id)
              return (
                <TableNode
                  key={table.id}
                  table={table}
                  selected={selected}
                  renameState={renameState}
                  onMouseDownTable={(e) => {
                    e.stopPropagation()
                    setSelectedRelationId(null)
                    if (e.shiftKey) {
                      setSelectedTableIds((p) => { const s = new Set(p); s.has(table.id) ? s.delete(table.id) : s.add(table.id); return [...s] })
                    } else if (!selected) {
                      setSelectedTableIds([table.id])
                    }
                  }}
                  onPointerDownHeader={(e) => startTableMove(e, table.id)}
                  onPointerDownResize={(e) => startTableResize(e, table)}
                  onStartRelationDrag={(e, _t, field, side) => {
                    const srcTable = tableById.get(tables.find((t) => t.fields.some((f) => f.id === field.id))?.id) || table
                    startRelationDrag(e, srcTable, field, side)
                  }}
                  onDoubleClickHeader={(e) => { e.stopPropagation(); setRenameState({ tableId: table.id, value: table.name }) }}
                  onRenameChange={(e) => setRenameState({ tableId: table.id, value: e.target.value })}
                  onRenameBlur={() => { apply({ type: 'RENAME_TABLE', tableId: table.id, name: renameState.value }); setRenameState(null) }}
                  onRenameKeyDown={(e) => { if (e.key === 'Enter') { apply({ type: 'RENAME_TABLE', tableId: table.id, name: renameState.value }); setRenameState(null) } else if (e.key === 'Escape') setRenameState(null) }}
                  onAddField={() => apply({ type: 'ADD_FIELD', tableId: table.id, field: createFieldDraft(table.fields.length) })}
                  onDeleteTable={() => { apply({ type: 'DELETE_TABLE', tableId: table.id }); setSelectedTableIds((p) => p.filter((id) => id !== table.id)) }}
                  onDeleteField={(fieldId) => apply({ type: 'DELETE_FIELD', tableId: table.id, fieldId })}
                  onEditField={(field) => setFieldModal({ tableId: table.id, fieldId: field.id, draft: cloneField(field) })}
                  onPushToast={pushToast}
                />
              )
            })}
          </div>

          {/* Selection rect */}
          {selectionScreenRect && (
            <div className="pointer-events-none absolute z-30 border border-cyan-300 bg-cyan-400/20"
              style={{ left: selectionScreenRect.x, top: selectionScreenRect.y, width: selectionScreenRect.width, height: selectionScreenRect.height }}
            />
          )}
        </div>

        <Minimap
          minimapData={minimapData}
          minimapScale={minimapScale}
          tables={tables}
          viewportRectInWorld={viewportRectInWorld}
          onPointerDown={handleMinimapClick}
          getMinimumTableHeight={getMinimumTableHeight}
        />

        {selectedTable && <ColorPanel table={selectedTable} />}
        {selectedRelation && (
          <RelationPanel
            relation={selectedRelation}
            onDelete={() => { apply({ type: 'DELETE_RELATION', relationId: selectedRelation.id }); setSelectedRelationId(null) }}
          />
        )}
      </main>

      {toast && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-950/90 px-4 py-2 text-sm text-slate-100 shadow-xl">
          {toast}
        </div>
      )}

      {/* Modals */}
      {newTableOpen && (
        <NewTableModal
          isClassMode={isClassMode}
          draft={newTableDraft}
          onChangeName={(v) => setNewTableDraft((d) => ({ ...d, name: v }))}
          onChangeCount={updateNewTableCount}
          onChangeField={(i, f) => setNewTableDraft((d) => ({ ...d, fields: d.fields.map((x, xi) => xi === i ? f : x) }))}
          onCancel={() => { setNewTableOpen(false); resetNewTableDraft() }}
          onCreate={createTableFromModal}
        />
      )}

      {fieldModal && (
        <FieldModal
          fieldModal={fieldModal}
          onChange={(draft) => setFieldModal((c) => ({ ...c, draft }))}
          onCancel={() => setFieldModal(null)}
          onSave={() => { apply({ type: 'UPDATE_FIELD', tableId: fieldModal.tableId, fieldId: fieldModal.fieldId, field: fieldModal.draft }); setFieldModal(null) }}
        />
      )}

      {relationModal && (
        <RelationModal
          modal={relationModal}
          isClassMode={isClassMode}
          onChange={setRelationModal}
          onCancel={() => setRelationModal(null)}
          onCreate={() => { apply({ type: 'ADD_RELATION', payload: relationModal }); setRelationModal(null) }}
        />
      )}

      {mermaidOpen && (
        <MermaidModal
          importType={mermaidImportType}
          draft={mermaidDraft}
          error={mermaidError}
          onChangeType={(t) => { setMermaidImportType(t); setMermaidDraft(t === 'class' ? MERMAID_CLASS_SAMPLE : MERMAID_ER_SAMPLE); setMermaidError('') }}
          onChangeDraft={setMermaidDraft}
          onLoadSample={() => setMermaidDraft(mermaidImportType === 'class' ? MERMAID_CLASS_SAMPLE : MERMAID_ER_SAMPLE)}
          onCancel={() => setMermaidOpen(false)}
          onImport={importFromMermaid}
        />
      )}

      {sqlOpen && (
        <SqlModal
          sql={sqlPreview}
          onClose={() => setSqlOpen(false)}
          onCopy={copySql}
          onDownload={downloadSql}
        />
      )}

      {shortcutsOpen && <ShortcutsPanel onClose={() => setShortcutsOpen(false)} />}
      {templatesOpen && <TemplatesPanel onSelect={handleTemplate} onClose={() => setTemplatesOpen(false)} />}
    </div>
  )
}
