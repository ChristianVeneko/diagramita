import { Modal } from '../Modal.jsx'
import { MERMAID_ER_SAMPLE, MERMAID_CLASS_SAMPLE } from '../../constants.js'

export function MermaidModal({ importType, draft, error, onChangeType, onChangeDraft, onLoadSample, onCancel, onImport }) {
  return (
    <Modal
      title={`Importar Mermaid — ${importType === 'class' ? 'Class Diagram' : 'ER Diagram'}`}
      onClose={onCancel}
      widthClass="max-w-4xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[['er', 'ER Diagram'], ['class', 'Class Diagram']].map(([val, label]) => (
            <button key={val} type="button"
              onClick={() => onChangeType(val)}
              className={`rounded-md border px-3 py-1.5 text-xs ${importType === val ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-slate-600 text-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>

        <p className="text-sm text-slate-300">
          {importType === 'class'
            ? 'Pega un bloque de clases Mermaid. Se reemplazará el diagrama actual.'
            : <>Pega un bloque <code className="font-mono-ui">erDiagram</code>. Se reemplazará el diagrama actual.</>}
        </p>

        <textarea
          value={draft}
          onChange={(e) => onChangeDraft(e.target.value)}
          className="font-mono-ui h-[52vh] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-xs leading-5 text-slate-200 outline-none focus:border-cyan-400"
          placeholder={importType === 'class' ? 'class Paciente {\n  -String cedula\n  +getEdad() int\n}' : 'erDiagram\n  usuarios {\n    int id PK\n  }'}
        />

        {error && (
          <div className="rounded-md border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-2">
          <button type="button" onClick={onLoadSample}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-300">
            Cargar ejemplo
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel}
              className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300">
              Cancelar
            </button>
            <button type="button" onClick={onImport}
              className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500">
              Importar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
