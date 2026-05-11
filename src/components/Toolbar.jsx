import { useState, useRef, useEffect } from 'react'

export function Toolbar({
  isClassMode, theme, snapToGrid, canUndo, canRedo, zoom, selectedCount,
  onNewTable, onSave, onLoad, onImportMermaid, onToggleMode,
  onExportPng, onExportSvg, onExportPdf, onExportSql, onUndo, onRedo, onToggleTheme, onToggleSnap,
  onDeleteSelected, onShowShortcuts, onShowTemplates, onFitToView, onZoomIn, onZoomOut,
}) {
  const btnBase = 'rounded-md border border-slate-500 px-3 py-1.5 text-sm transition'
  const btnHover = 'hover:border-cyan-400 hover:text-cyan-300'
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef(null)

  useEffect(() => {
    if (!exportOpen) return
    const close = (e) => { if (!exportRef.current?.contains(e.target)) setExportOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [exportOpen])

  const handleExport = (fn) => { setExportOpen(false); fn() }

  const isDark = theme === 'dark'
  const menuBg = isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-sky-200'
  const menuItem = isDark
    ? 'text-slate-200 hover:bg-slate-700 hover:text-cyan-300'
    : 'text-slate-700 hover:bg-sky-50 hover:text-cyan-600'

  return (
    <header className={`z-30 flex flex-wrap items-center gap-1.5 border-b px-3 py-2 backdrop-blur ${isDark ? 'border-slate-800 bg-slate-950/80' : 'border-sky-200 bg-white/80'}`}>
      <button type="button" onClick={onNewTable}
        className="rounded-md bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-cyan-500">
        {isClassMode ? '+ Clase' : '+ Tabla'}
      </button>

      <button type="button" onClick={onShowTemplates} className={`${btnBase} ${btnHover}`}>
        Plantillas
      </button>

      <div className="h-5 w-px bg-slate-600" />

      <button type="button" onClick={onImportMermaid} className={`${btnBase} ${btnHover}`}>
        Importar Mermaid
      </button>

      {/* Export dropdown */}
      <div ref={exportRef} className="relative">
        <button
          type="button"
          onClick={() => setExportOpen((o) => !o)}
          className={`${btnBase} ${btnHover} flex items-center gap-1`}
        >
          Exportar
          <svg className="h-3 w-3 opacity-60" viewBox="0 0 10 6" fill="currentColor">
            <path d="M0 0l5 6 5-6z" />
          </svg>
        </button>
        {exportOpen && (
          <div className={`absolute left-0 top-full mt-1 z-50 min-w-[120px] rounded-md border shadow-lg overflow-hidden ${menuBg}`}>
            <button type="button" onClick={() => handleExport(onExportPng)}
              className={`w-full px-4 py-2 text-left text-sm ${menuItem}`}>
              PNG
            </button>
            <button type="button" onClick={() => handleExport(onExportSvg)}
              className={`w-full px-4 py-2 text-left text-sm ${menuItem}`}>
              SVG
            </button>
            <button type="button" onClick={() => handleExport(onExportPdf)}
              className={`w-full px-4 py-2 text-left text-sm ${menuItem}`}>
              PDF
            </button>
            <div className={`my-1 h-px ${isDark ? 'bg-slate-700' : 'bg-sky-100'}`} />
            <button type="button" onClick={() => handleExport(onExportSql)} disabled={isClassMode}
              className={`w-full px-4 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 ${menuItem}`}>
              SQL
            </button>
          </div>
        )}
      </div>

      <div className="h-5 w-px bg-slate-600" />

      <button type="button" onClick={onSave} className={`${btnBase} ${btnHover}`} title="Guardar (Ctrl+S)">
        Guardar
      </button>

      <button type="button" onClick={onLoad} className={`${btnBase} ${btnHover}`}>
        Cargar
      </button>

      <div className="h-5 w-px bg-slate-600" />

      <button type="button" onClick={onUndo} disabled={!canUndo}
        className={`${btnBase} enabled:${btnHover} disabled:opacity-40`} title="Deshacer (Ctrl+Z)">
        ↩ Undo
      </button>

      <button type="button" onClick={onRedo} disabled={!canRedo}
        className={`${btnBase} enabled:${btnHover} disabled:opacity-40`} title="Rehacer (Ctrl+Shift+Z)">
        Redo ↪
      </button>

      <div className="h-5 w-px bg-slate-600" />

      <button type="button" onClick={onToggleMode} className={`${btnBase} ${btnHover}`} title="Cambiar modo">
        {isClassMode ? 'Modo ER' : 'Modo Clases'}
      </button>

      <button type="button" onClick={onToggleTheme} className={`${btnBase} ${btnHover}`}>
        {theme === 'dark' ? '☀ Claro' : '🌙 Oscuro'}
      </button>

      <label className={`inline-flex cursor-pointer items-center gap-2 ${btnBase}`}>
        <input type="checkbox" checked={snapToGrid} onChange={onToggleSnap} />
        <span className="text-sm">Grid</span>
      </label>

      {selectedCount > 0 && (
        <button type="button" onClick={onDeleteSelected}
          className="rounded-md border border-rose-500/60 px-3 py-1.5 text-sm text-rose-300 transition hover:bg-rose-500/10">
          Eliminar ({selectedCount})
        </button>
      )}

      <div className="ml-auto flex items-center gap-1">
        <button type="button" onClick={onFitToView}
          className={`${btnBase} ${btnHover} text-xs px-2`} title="Ajustar vista (F)">
          ⊡ Fit
        </button>
        <button type="button" onClick={onZoomOut}
          className="rounded bg-slate-800 px-2 py-1 text-slate-200 hover:bg-slate-700">−</button>
        <span className="min-w-[42px] text-center text-xs text-slate-300">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={onZoomIn}
          className="rounded bg-slate-800 px-2 py-1 text-slate-200 hover:bg-slate-700">+</button>
        <button type="button" onClick={onShowShortcuts}
          className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 transition" title="Atajos (?)">
          ?
        </button>
      </div>
    </header>
  )
}
