import { Modal } from './Modal.jsx'
import { SHORTCUTS } from '../constants.js'

export function ShortcutsPanel({ onClose }) {
  return (
    <Modal title="Atajos de teclado" onClose={onClose} widthClass="max-w-lg">
      <div className="space-y-1">
        {SHORTCUTS.map(({ keys, description }) => (
          <div key={keys} className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 hover:bg-slate-800/60">
            <span className="text-sm text-slate-300">{description}</span>
            <kbd className="font-mono-ui shrink-0 rounded bg-slate-800 px-2 py-0.5 text-xs text-cyan-300 border border-slate-600">
              {keys}
            </kbd>
          </div>
        ))}
      </div>
    </Modal>
  )
}
