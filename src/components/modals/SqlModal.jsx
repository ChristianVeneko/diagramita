import { Modal } from '../Modal.jsx'

export function SqlModal({ sql, onClose, onCopy, onDownload }) {
  return (
    <Modal title="Vista previa SQL" onClose={onClose} widthClass="max-w-4xl">
      <div className="space-y-4">
        <textarea
          readOnly
          value={sql}
          className="font-mono-ui h-[56vh] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-xs leading-5 text-slate-200 outline-none"
        />
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCopy}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-300">
            Copiar SQL
          </button>
          <button type="button" onClick={onDownload}
            className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500">
            Descargar .sql
          </button>
        </div>
      </div>
    </Modal>
  )
}
