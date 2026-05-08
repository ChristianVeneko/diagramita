import {
  createId,
  createEmptyConstraints,
  normalizeIdentifier,
  toSnakeCase,
  getPrimaryField,
  buildUniqueTableName,
  cloneField,
  createFieldDraft,
  createTableFromDraft,
  sanitizeDiagram,
  getMinimumTableHeight,
} from '../lib/diagram.js'
import { MAX_HISTORY, RELATION_OPTIONS } from '../constants.js'

export function addRelationReducer(state, payload) {
  const { sourceTableId, sourceFieldId, targetTableId, targetFieldId, relationType, color } = payload
  if (!sourceTableId || !sourceFieldId || !targetTableId || !targetFieldId) return state
  if (sourceTableId === targetTableId && sourceFieldId === targetFieldId) return state

  const sourceTable = state.tables.find((t) => t.id === sourceTableId)
  const targetTable = state.tables.find((t) => t.id === targetTableId)
  if (!sourceTable || !targetTable) return state

  if (state.diagramType === 'class') {
    const dup = state.relations.some((r) =>
      r.sourceTableId === sourceTableId && r.sourceFieldId === sourceFieldId &&
      r.targetTableId === targetTableId && r.targetFieldId === targetFieldId && r.type === relationType
    )
    if (dup) return state
    return {
      ...state,
      relations: [...state.relations, {
        id: createId('rel'), sourceTableId, sourceFieldId, targetTableId, targetFieldId,
        type: relationType, color: color || '#0ea5e9',
        classMeta: {
          sourceMultiplicity: relationType === 'N:M' ? '0..*' : '1',
          targetMultiplicity: relationType === '1:1' ? '1' : '0..*',
          label: '',
        },
      }],
    }
  }

  if (relationType === 'N:M') {
    const sourcePk = getPrimaryField(sourceTable)
    const targetPk = getPrimaryField(targetTable)
    if (!sourcePk || !targetPk) return state

    const pivotName = buildUniqueTableName(state.tables, `${toSnakeCase(sourceTable.name)}_${toSnakeCase(targetTable.name)}`)
    const f1 = {
      id: createId('fld'),
      name: `${toSnakeCase(sourceTable.name)}_${toSnakeCase(sourcePk.name)}`,
      type: sourcePk.type, length: sourcePk.length,
      constraints: { ...createEmptyConstraints(), primaryKey: true, foreignKey: true, notNull: true },
      reference: { tableId: sourceTable.id, fieldId: sourcePk.id },
    }
    const f2 = {
      id: createId('fld'),
      name: `${toSnakeCase(targetTable.name)}_${toSnakeCase(targetPk.name)}`,
      type: targetPk.type, length: targetPk.length,
      constraints: { ...createEmptyConstraints(), primaryKey: true, foreignKey: true, notNull: true },
      reference: { tableId: targetTable.id, fieldId: targetPk.id },
    }
    const pivot = createTableFromDraft({
      name: pivotName, fields: [f1, f2],
      position: { x: (sourceTable.x + targetTable.x) / 2 + 80, y: (sourceTable.y + targetTable.y) / 2 + 170 },
      isPivot: true,
    })
    return {
      ...state,
      tables: [...state.tables, pivot],
      relations: [...state.relations,
        { id: createId('rel'), sourceTableId: sourceTable.id, sourceFieldId: sourcePk.id, targetTableId: pivot.id, targetFieldId: f1.id, type: '1:N', color: color || '#0ea5e9' },
        { id: createId('rel'), sourceTableId: targetTable.id, sourceFieldId: targetPk.id, targetTableId: pivot.id, targetFieldId: f2.id, type: '1:N', color: color || '#0ea5e9' },
      ],
    }
  }

  const dup = state.relations.some((r) =>
    r.sourceTableId === sourceTableId && r.sourceFieldId === sourceFieldId &&
    r.targetTableId === targetTableId && r.targetFieldId === targetFieldId
  )
  if (dup) return state

  return {
    ...state,
    relations: [...state.relations, { id: createId('rel'), sourceTableId, sourceFieldId, targetTableId, targetFieldId, type: relationType, color: color || '#0ea5e9' }],
    tables: state.tables.map((t) => {
      if (t.id !== targetTableId) return t
      return {
        ...t,
        fields: t.fields.map((f) => {
          if (f.id !== targetFieldId) return f
          return { ...f, constraints: { ...f.constraints, foreignKey: true, unique: relationType === '1:1' ? true : f.constraints.unique }, reference: { tableId: sourceTableId, fieldId: sourceFieldId } }
        }),
      }
    }),
  }
}

export function diagramReducer(state, action) {
  switch (action.type) {
    case 'SET_THEME': return { ...state, theme: action.theme === 'dark' ? 'dark' : 'light' }
    case 'SET_SNAP': return { ...state, snapToGrid: Boolean(action.enabled) }
    case 'SET_DIAGRAM_TYPE': return { ...state, diagramType: action.diagramType === 'class' ? 'class' : 'er' }
    case 'ADD_TABLE': return { ...state, tables: [...state.tables, action.table] }

    case 'SET_TABLE_POSITIONS': {
      let changed = false
      const tables = state.tables.map((t) => {
        const pos = action.positions[t.id]
        if (!pos || (t.x === pos.x && t.y === pos.y)) return t
        changed = true
        return { ...t, x: pos.x, y: pos.y }
      })
      return changed ? { ...state, tables } : state
    }

    case 'RESIZE_TABLE':
      return {
        ...state,
        tables: state.tables.map((t) => t.id !== action.tableId ? t : {
          ...t,
          width: Math.max(220, action.width),
          height: Math.max(getMinimumTableHeight(t.fields.length), action.height),
        }),
      }

    case 'RENAME_TABLE':
      return { ...state, tables: state.tables.map((t) => t.id !== action.tableId ? t : { ...t, name: normalizeIdentifier(action.name, t.name) }) }

    case 'UPDATE_TABLE_COLORS':
      return { ...state, tables: state.tables.map((t) => t.id !== action.tableId ? t : { ...t, colors: { ...t.colors, ...action.colors } }) }

    case 'DELETE_TABLE':
      return {
        ...state,
        tables: state.tables.filter((t) => t.id !== action.tableId),
        relations: state.relations.filter((r) => r.sourceTableId !== action.tableId && r.targetTableId !== action.tableId),
      }

    case 'DELETE_TABLES': {
      const removed = new Set(action.tableIds || [])
      if (removed.size === 0) return state
      return {
        ...state,
        tables: state.tables.filter((t) => !removed.has(t.id)),
        relations: state.relations.filter((r) => !removed.has(r.sourceTableId) && !removed.has(r.targetTableId)),
      }
    }

    case 'ADD_FIELD':
      return {
        ...state,
        tables: state.tables.map((t) => {
          if (t.id !== action.tableId) return t
          const next = [...t.fields, cloneField(action.field, t.fields.length)]
          return { ...t, fields: next, height: Math.max(t.height, getMinimumTableHeight(next.length)) }
        }),
      }

    case 'UPDATE_FIELD':
      return {
        ...state,
        tables: state.tables.map((t) => {
          if (t.id !== action.tableId) return t
          return { ...t, fields: t.fields.map((f, i) => f.id === action.fieldId ? cloneField(action.field, i) : f) }
        }),
      }

    case 'DELETE_FIELD': {
      const t = state.tables.find((x) => x.id === action.tableId)
      if (!t || t.fields.length <= 1) return state
      return {
        ...state,
        tables: state.tables.map((x) => x.id !== action.tableId ? x : { ...x, fields: x.fields.filter((f) => f.id !== action.fieldId) }),
        relations: state.relations.filter((r) => !(
          (r.sourceTableId === action.tableId && r.sourceFieldId === action.fieldId) ||
          (r.targetTableId === action.tableId && r.targetFieldId === action.fieldId)
        )),
      }
    }

    case 'ADD_RELATION': return addRelationReducer(state, action.payload)

    case 'DELETE_RELATION': {
      const target = state.relations.find((r) => r.id === action.relationId)
      if (!target) return state
      const relations = state.relations.filter((r) => r.id !== action.relationId)
      const keepFk = relations.some((r) => r.targetTableId === target.targetTableId && r.targetFieldId === target.targetFieldId)
      const tables = keepFk ? state.tables : state.tables.map((t) => {
        if (t.id !== target.targetTableId) return t
        return { ...t, fields: t.fields.map((f) => f.id !== target.targetFieldId ? f : { ...f, constraints: { ...f.constraints, foreignKey: false }, reference: null }) }
      })
      return { ...state, tables, relations }
    }

    case 'UPDATE_RELATION_COLOR':
      return { ...state, relations: state.relations.map((r) => r.id !== action.relationId ? r : { ...r, color: action.color }) }

    case 'PASTE_TABLES':
      return { ...state, tables: [...state.tables, ...action.tables], relations: [...state.relations, ...action.relations] }

    case 'REPLACE_DIAGRAM': return sanitizeDiagram(action.diagram)

    default: return state
  }
}

export function createInitialHistory() {
  return { past: [], present: sanitizeDiagram(null), future: [] }
}

export function historyReducer(state, action) {
  switch (action.type) {
    case 'APPLY': {
      const next = diagramReducer(state.present, action.action)
      if (next === state.present) return state
      if (action.record === false) return { ...state, present: next }
      const past = [...state.past, state.present]
      if (past.length > MAX_HISTORY) past.shift()
      return { past, present: next, future: [] }
    }
    case 'UNDO': {
      if (state.past.length === 0) return state
      const prev = state.past[state.past.length - 1]
      return { past: state.past.slice(0, -1), present: prev, future: [state.present, ...state.future] }
    }
    case 'REDO': {
      if (state.future.length === 0) return state
      const [next, ...rest] = state.future
      return { past: [...state.past, state.present], present: next, future: rest }
    }
    case 'RESET': return { past: [], present: sanitizeDiagram(action.diagram), future: [] }
    default: return state
  }
}
