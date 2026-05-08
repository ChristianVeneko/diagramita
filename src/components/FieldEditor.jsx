import { MYSQL_TYPES, TYPES_WITH_LENGTH } from '../constants.js'

export function FieldEditor({ value, onChange }) {
  const { constraints } = value

  const updateConstraint = (name, checked) =>
    onChange({ ...value, constraints: { ...constraints, [name]: checked } })

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-700 bg-slate-950/50 p-3 md:grid-cols-12">
      <label className="md:col-span-3">
        <span className="mb-1 block text-xs font-medium text-slate-300">Nombre</span>
        <input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
        />
      </label>

      <label className="md:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-300">Tipo</span>
        <select
          value={value.type}
          onChange={(e) => onChange({ ...value, type: e.target.value })}
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
        >
          {MYSQL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>

      <label className="md:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-300">Longitud</span>
        <input
          value={value.length}
          disabled={!TYPES_WITH_LENGTH.has(value.type)}
          onChange={(e) => onChange({ ...value, length: e.target.value })}
          placeholder={TYPES_WITH_LENGTH.has(value.type) ? '255' : '-'}
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
        />
      </label>

      <label className="md:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-300">Default</span>
        <input
          value={constraints.defaultValue}
          onChange={(e) => onChange({ ...value, constraints: { ...constraints, defaultValue: e.target.value } })}
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
        />
      </label>

      <div className="md:col-span-3 flex flex-wrap gap-2 text-xs text-slate-200">
        {[
          ['primaryKey', 'PRIMARY KEY'],
          ['foreignKey', 'FOREIGN KEY'],
          ['notNull', 'NOT NULL'],
          ['unique', 'UNIQUE'],
          ['autoIncrement', 'AUTO_INCREMENT'],
        ].map(([key, label]) => (
          <label key={key} className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1">
            <input
              type="checkbox"
              checked={constraints[key]}
              onChange={(e) => updateConstraint(key, e.target.checked)}
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  )
}
