import { formatFieldType, formatClassMemberLine, getMinimumTableHeight } from '../lib/diagram.js'
import { HEADER_HEIGHT } from '../constants.js'

function KeyIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="2" />
      <path d="M12.5 8H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 8V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 8V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function TableNode({
  table,
  selected,
  renameState,
  onPointerDownHeader,
  onPointerDownResize,
  onStartRelationDrag,
  onMouseDownTable,
  onDoubleClickHeader,
  onRenameChange,
  onRenameBlur,
  onRenameKeyDown,
  onAddField,
  onDeleteTable,
  onDeleteField,
  onEditField,
  onPushToast,
}) {
  const tableHeight = Math.max(table.height, getMinimumTableHeight(table.fields.length))
  const isClass = table.modelType === 'class'
  const attributes = isClass ? table.fields.filter((f) => f.memberKind !== 'method') : []
  const methods = isClass ? table.fields.filter((f) => f.memberKind === 'method') : []

  return (
    <div
      className={`absolute rounded-xl border shadow-xl transition ${selected ? 'ring-2 ring-cyan-300' : ''}`}
      style={{
        left: table.x, top: table.y,
        width: table.width, height: tableHeight,
        borderColor: selected ? '#67e8f9' : '#94a3b8',
        background: table.colors.body,
        color: table.colors.text,
      }}
      onMouseDown={onMouseDownTable}
    >
      {/* Header */}
      <div
        className="flex h-11 items-center justify-between rounded-t-xl px-3 text-sm font-semibold cursor-grab active:cursor-grabbing"
        style={{ background: table.colors.header, color: '#ffffff' }}
        onPointerDown={onPointerDownHeader}
      >
        {renameState?.tableId === table.id ? (
          <input
            value={renameState.value}
            autoFocus
            onChange={onRenameChange}
            onBlur={onRenameBlur}
            onKeyDown={onRenameKeyDown}
            className="w-full rounded bg-black/20 px-2 py-1 text-xs text-white outline-none"
          />
        ) : (
          <button type="button" className="truncate text-left" onDoubleClick={onDoubleClickHeader}>
            {table.name}
          </button>
        )}

        <div className="flex items-center gap-1 ml-2 shrink-0">
          {!isClass && (
            <button type="button"
              className="rounded bg-black/20 px-1.5 py-0.5 text-xs"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onAddField}
            >
              +
            </button>
          )}
          <button type="button"
            className="rounded bg-black/20 px-1.5 py-0.5 text-xs"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onDeleteTable}
          >
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="h-[calc(100%-44px)] overflow-y-auto px-2 py-1">
        {isClass ? (
          <div className="space-y-2 p-1 text-xs">
            <ClassSection title="Atributos" members={attributes} />
            <ClassSection title="Métodos" members={methods} />
          </div>
        ) : (
          table.fields.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              tableId={table.id}
              tableColor={table.colors.text}
              tableFieldCount={table.fields.length}
              onStartRelationDrag={onStartRelationDrag}
              onEditField={onEditField}
              onDeleteField={(fieldId) => {
                if (table.fields.length <= 1) { onPushToast('La tabla debe conservar al menos un campo'); return }
                onDeleteField(fieldId)
              }}
            />
          ))
        )}
      </div>

      {/* Class connection anchors */}
      {isClass && table.fields[0] && (
        <>
          <button type="button" data-field-handle="true" data-table-id={table.id} data-field-id={table.fields[0].id}
            onPointerDown={(e) => onStartRelationDrag(e, table, table.fields[0], 'left')}
            className="absolute left-[-7px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-cyan-300 bg-cyan-500/80"
            title="Conectar clase"
          />
          <button type="button" data-field-handle="true" data-table-id={table.id} data-field-id={table.fields[0].id}
            onPointerDown={(e) => onStartRelationDrag(e, table, table.fields[0], 'right')}
            className="absolute right-[-7px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-cyan-300 bg-cyan-500/80"
            title="Conectar clase"
          />
        </>
      )}

      {/* Resize handle */}
      <button type="button"
        className="absolute bottom-1 right-1 h-3.5 w-3.5 cursor-se-resize rounded-sm border border-slate-500 bg-slate-700/60"
        onPointerDown={onPointerDownResize}
        title="Redimensionar"
      />
    </div>
  )
}

function ClassSection({ title, members }) {
  return (
    <div className="rounded-md border border-slate-400/70 bg-white/70 p-2">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{title}</div>
      {members.length > 0
        ? members.map((m) => (
            <div key={m.id} className="font-mono-ui truncate py-0.5 text-[11px]">
              {formatClassMemberLine(m)}
            </div>
          ))
        : <div className="font-mono-ui text-[11px] text-slate-500">(vacío)</div>
      }
    </div>
  )
}

function FieldRow({ field, tableId, tableColor, onStartRelationDrag, onEditField, onDeleteField }) {
  const badges = []
  if (field.constraints.primaryKey) badges.push('PK')
  if (field.constraints.foreignKey) badges.push('FK')
  if (field.constraints.notNull) badges.push('NN')
  if (field.constraints.unique) badges.push('UQ')
  if (field.constraints.autoIncrement) badges.push('AI')

  return (
    <div
      className="group relative flex min-h-[30px] items-center gap-2 rounded-md px-1 py-1 text-xs transition hover:bg-slate-200/70"
      onDoubleClick={() => onEditField(field)}
      style={{ color: tableColor }}
    >
      <button type="button"
        data-field-handle="true" data-table-id={tableId} data-field-id={field.id}
        onPointerDown={(e) => onStartRelationDrag(e, null, field, 'left')}
        className="h-3.5 w-3.5 shrink-0 rounded-full border border-cyan-300 bg-cyan-500/70"
        title="Crear relación"
      />

      <div className="flex min-w-0 flex-1 items-center gap-1">
        {field.constraints.primaryKey && <KeyIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
        <span className="truncate font-semibold">{field.name}</span>
        <span className="font-mono-ui text-[10px] opacity-80">{formatFieldType(field)}</span>
      </div>

      {badges.length > 0 && (
        <span className="rounded bg-slate-800 px-1 py-0.5 text-[9px] font-semibold text-slate-100">
          {badges.join(' ')}
        </span>
      )}

      <button type="button"
        className="rounded border border-rose-400 px-1 py-0.5 text-[10px] text-rose-600 opacity-0 transition group-hover:opacity-100"
        onClick={() => onDeleteField(field.id)}
      >
        del
      </button>

      <button type="button"
        data-field-handle="true" data-table-id={tableId} data-field-id={field.id}
        onPointerDown={(e) => onStartRelationDrag(e, null, field, 'right')}
        className="h-3.5 w-3.5 shrink-0 rounded-full border border-cyan-300 bg-cyan-500/70"
        title="Crear relación"
      />
    </div>
  )
}
