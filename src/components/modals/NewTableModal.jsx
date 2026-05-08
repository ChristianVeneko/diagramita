import { Modal } from '../Modal.jsx'
import { FieldEditor } from '../FieldEditor.jsx'
import { createFieldDraft } from '../../lib/diagram.js'

export function NewTableModal({ isClassMode, draft, onChangeName, onChangeCount, onChangeField, onCancel, onCreate }) {
  return (
    <Modal title={isClassMode ? 'Nueva clase' : 'Nueva tabla'} onClose={onCancel}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm text-slate-300">{isClassMode ? 'Nombre de la clase' : 'Nombre de la tabla'}</span>
            <input
              value={draft.name}
              onChange={(e) => onChangeName(e.target.value)}
              placeholder={isClassMode ? 'Paciente' : 'usuarios'}
              autoFocus
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
            />
          </label>

          <label>
            <span className="mb-1 block text-sm text-slate-300">{isClassMode ? 'Cantidad de miembros' : 'Cantidad de campos'}</span>
            <input
              type="number" min="1" max="30"
              value={draft.count}
              onChange={(e) => onChangeCount(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
            />
          </label>
        </div>

        <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
          {draft.fields.map((field, index) => (
            <FieldEditor
              key={field.id}
              value={field}
              onChange={(next) => onChangeField(index, next)}
            />
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300">
            Cancelar
          </button>
          <button type="button" onClick={onCreate}
            className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500">
            {isClassMode ? 'Crear clase' : 'Crear tabla'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
