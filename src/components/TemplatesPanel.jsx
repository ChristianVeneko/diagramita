import { Modal } from './Modal.jsx'
import { TEMPLATES } from '../data/templates.js'

export function TemplatesPanel({ onSelect, onClose }) {
  return (
    <Modal title="Plantillas" onClose={onClose} widthClass="max-w-3xl">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onSelect(tpl)}
            className="group flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-left transition hover:border-cyan-500 hover:bg-slate-800"
          >
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-cyan-600/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                {tpl.type === 'er' ? 'ER' : 'Class'}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-100 group-hover:text-cyan-300 transition">{tpl.name}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{tpl.description}</p>
            <span className="mt-auto text-xs font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition">
              Usar plantilla →
            </span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
