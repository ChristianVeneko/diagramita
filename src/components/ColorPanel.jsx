import { useDiagram } from '../store/DiagramContext.jsx'

export function ColorPanel({ table }) {
  const { apply } = useDiagram()

  return (
    <aside className="absolute right-3 top-3 z-40 w-64 rounded-xl border border-slate-700 bg-slate-900/90 p-3 shadow-2xl">
      <h3 className="mb-3 text-sm font-semibold text-slate-100">Personalizar tabla</h3>
      {[['Header', 'header'], ['Body', 'body'], ['Texto', 'text']].map(([label, key]) => (
        <label key={key} className="mb-2 block text-xs text-slate-300">
          {label}
          <input
            type="color"
            value={table.colors[key]}
            onChange={(e) => apply({ type: 'UPDATE_TABLE_COLORS', tableId: table.id, colors: { [key]: e.target.value } })}
            className="mt-1 h-8 w-full rounded border border-slate-600 bg-transparent"
          />
        </label>
      ))}
    </aside>
  )
}

export function RelationPanel({ relation, onDelete }) {
  const { apply } = useDiagram()

  return (
    <aside className="absolute left-3 top-3 z-40 w-56 rounded-xl border border-slate-700 bg-slate-900/90 p-3 shadow-2xl">
      <h3 className="mb-3 text-sm font-semibold text-slate-100">Personalizar relación</h3>
      <label className="block text-xs text-slate-300">
        Color de línea
        <input
          type="color"
          value={relation.color}
          onChange={(e) => apply({ type: 'UPDATE_RELATION_COLOR', relationId: relation.id, color: e.target.value })}
          className="mt-1 h-8 w-full rounded border border-slate-600 bg-transparent"
        />
      </label>
      <button
        type="button"
        onClick={onDelete}
        className="mt-3 w-full rounded-md border border-rose-500/60 px-3 py-1.5 text-xs text-rose-300 transition hover:bg-rose-500/10"
      >
        Eliminar relación
      </button>
    </aside>
  )
}
