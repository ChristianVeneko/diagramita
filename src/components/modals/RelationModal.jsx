import { Modal } from '../Modal.jsx'
import { RELATION_OPTIONS } from '../../constants.js'

export function RelationModal({ modal, isClassMode, onChange, onCancel, onCreate }) {
  return (
    <Modal title="Crear relación" onClose={onCancel} widthClass="max-w-lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm text-slate-300">Tipo</span>
            <select
              value={modal.relationType}
              onChange={(e) => onChange({ ...modal, relationType: e.target.value })}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
            >
              {RELATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-sm text-slate-300">Color</span>
            <input
              type="color"
              value={modal.color}
              onChange={(e) => onChange({ ...modal, color: e.target.value })}
              className="h-10 w-full rounded-md border border-slate-600 bg-transparent"
            />
          </label>
        </div>

        <p className="text-xs text-slate-400">
          {isClassMode
            ? 'En modo clases se crea una asociación UML sin tabla pivote.'
            : 'N:M crea automáticamente una tabla intermedia con llaves foráneas.'}
        </p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300">
            Cancelar
          </button>
          <button type="button" onClick={onCreate}
            className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500">
            Crear relación
          </button>
        </div>
      </div>
    </Modal>
  )
}
