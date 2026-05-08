import { Modal } from '../Modal.jsx'
import { FieldEditor } from '../FieldEditor.jsx'

export function FieldModal({ fieldModal, onChange, onCancel, onSave }) {
  return (
    <Modal title="Editar campo" onClose={onCancel} widthClass="max-w-3xl">
      <div className="space-y-4">
        <FieldEditor value={fieldModal.draft} onChange={onChange} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300">
            Cancelar
          </button>
          <button type="button" onClick={onSave}
            className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500">
            Guardar cambios
          </button>
        </div>
      </div>
    </Modal>
  )
}
