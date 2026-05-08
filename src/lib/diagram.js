import {
  GRID_SIZE,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  TABLE_MIN_WIDTH,
  TABLE_MIN_HEIGHT,
  MYSQL_TYPES,
  TYPES_WITH_LENGTH,
  RELATION_OPTIONS,
} from '../constants.js'

export function createId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function createEmptyConstraints() {
  return {
    primaryKey: false,
    foreignKey: false,
    notNull: false,
    unique: false,
    autoIncrement: false,
    defaultValue: '',
  }
}

export function normalizeIdentifier(value, fallback) {
  const cleaned = String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
  return cleaned || fallback
}

export function toSnakeCase(value) {
  return normalizeIdentifier(value, 'tabla').toLowerCase()
}

export function getMinimumTableHeight(fieldCount) {
  return Math.max(TABLE_MIN_HEIGHT, HEADER_HEIGHT + Math.max(fieldCount, 1) * ROW_HEIGHT + 12)
}

export function createFieldDraft(index) {
  if (index === 0) {
    return {
      id: createId('fld'),
      name: 'id',
      type: 'INT',
      length: '',
      constraints: { ...createEmptyConstraints(), primaryKey: true, notNull: true, autoIncrement: true },
      reference: null,
    }
  }
  return {
    id: createId('fld'),
    name: `campo_${index + 1}`,
    type: 'VARCHAR',
    length: '255',
    constraints: createEmptyConstraints(),
    reference: null,
  }
}

export function createTableFromDraft({ name, fields, position, isPivot = false, width = 260, modelType = 'entity', colors = null }) {
  const defaultColors = modelType === 'class'
    ? { header: '#1d4ed8', body: '#f8fafc', text: '#0f172a' }
    : { header: isPivot ? '#5b4abf' : '#0f766e', body: '#f8fafc', text: '#0f172a' }

  return {
    id: createId('tbl'),
    name: normalizeIdentifier(name, `tabla_${Math.floor(Date.now() / 1000)}`),
    x: position.x,
    y: position.y,
    width,
    height: getMinimumTableHeight(fields.length),
    isPivot,
    modelType,
    colors: colors || defaultColors,
    fields,
  }
}

export function getPrimaryField(table) {
  return table.fields.find((f) => f.constraints.primaryKey) || table.fields[0] || null
}

export function buildUniqueTableName(tables, baseName) {
  const existing = new Set(tables.map((t) => t.name.toLowerCase()))
  if (!existing.has(baseName.toLowerCase())) return baseName
  let i = 2
  while (existing.has(`${baseName}_${i}`.toLowerCase())) i++
  return `${baseName}_${i}`
}

export function cloneField(field, index = 0) {
  const rawType = String(field?.type || '').trim()
  const isClassMember = field?.memberKind === 'attribute' || field?.memberKind === 'method'
  return {
    id: field?.id || createId('fld'),
    name: normalizeIdentifier(field?.name, `campo_${index + 1}`),
    type: isClassMember
      ? (rawType || 'Any')
      : (MYSQL_TYPES.includes(rawType.toUpperCase()) ? rawType.toUpperCase() : 'VARCHAR'),
    length: String(field?.length || ''),
    constraints: { ...createEmptyConstraints(), ...(field?.constraints || {}), defaultValue: String(field?.constraints?.defaultValue || '') },
    reference: field?.reference || null,
    memberKind: field?.memberKind || null,
    visibility: field?.visibility || '',
    params: field?.params || '',
  }
}

export function buildUniqueFieldName(fields, baseName) {
  const used = new Set(fields.map((f) => f.name.toLowerCase()))
  if (!used.has(baseName.toLowerCase())) return baseName
  let i = 2
  while (used.has(`${baseName}_${i}`.toLowerCase())) i++
  return `${baseName}_${i}`
}

export function ensureTargetFieldForImportedRelation(state, sourceTableId, targetTableId) {
  const sourceTable = state.tables.find((t) => t.id === sourceTableId)
  const targetTable = state.tables.find((t) => t.id === targetTableId)
  if (!sourceTable || !targetTable) return { state, targetFieldId: null }

  const sourcePk = getPrimaryField(sourceTable)
  if (!sourcePk) return { state, targetFieldId: null }

  const candidateNames = [
    `${toSnakeCase(sourceTable.name)}_${toSnakeCase(sourcePk.name)}`,
    `${toSnakeCase(sourceTable.name)}_id`,
  ]
  const candidateSet = new Set(candidateNames.map((n) => n.toLowerCase()))

  const existing =
    targetTable.fields.find((f) => candidateSet.has(f.name.toLowerCase())) ||
    targetTable.fields.find((f) => f.constraints.foreignKey && !f.constraints.primaryKey) ||
    targetTable.fields.find((f) => f.type === sourcePk.type && !f.constraints.primaryKey)

  if (existing) return { state, targetFieldId: existing.id }

  const nextFieldName = buildUniqueFieldName(
    targetTable.fields,
    normalizeIdentifier(candidateNames[0], `${toSnakeCase(sourceTable.name)}_id`),
  )

  const nextField = {
    id: createId('fld'),
    name: nextFieldName,
    type: sourcePk.type,
    length: sourcePk.length,
    constraints: { ...createEmptyConstraints(), foreignKey: true },
    reference: null,
  }

  const nextTargetTable = {
    ...targetTable,
    fields: [...targetTable.fields, nextField],
    height: Math.max(targetTable.height, getMinimumTableHeight(targetTable.fields.length + 1)),
  }

  return {
    state: { ...state, tables: state.tables.map((t) => (t.id === nextTargetTable.id ? nextTargetTable : t)) },
    targetFieldId: nextField.id,
  }
}

export function sanitizeDiagram(diagram) {
  const base = { tables: [], relations: [], diagramType: 'er', theme: 'light', snapToGrid: true }
  if (!diagram || typeof diagram !== 'object') return base

  const tables = Array.isArray(diagram.tables)
    ? diagram.tables.map((table, index) => {
        const fields = Array.isArray(table?.fields) && table.fields.length > 0
          ? table.fields.map((f, fi) => cloneField(f, fi))
          : [createFieldDraft(0)]
        return {
          id: table?.id || createId('tbl'),
          name: normalizeIdentifier(table?.name, `tabla_${index + 1}`),
          x: Number(table?.x) || 100,
          y: Number(table?.y) || 100,
          width: Math.max(TABLE_MIN_WIDTH, Number(table?.width) || 260),
          height: Math.max(getMinimumTableHeight(fields.length), Number(table?.height) || TABLE_MIN_HEIGHT),
          isPivot: Boolean(table?.isPivot),
          modelType: table?.modelType === 'class' ? 'class' : 'entity',
          colors: {
            header: table?.colors?.header || (table?.modelType === 'class' ? '#1e3a8a' : '#0f766e'),
            body: table?.colors?.body || '#f8fafc',
            text: table?.colors?.text || '#0f172a',
          },
          fields,
        }
      })
    : []

  const tableIds = new Set(tables.map((t) => t.id))
  const fieldIds = new Set(tables.flatMap((t) => t.fields.map((f) => `${t.id}:${f.id}`)))

  const relations = Array.isArray(diagram.relations)
    ? diagram.relations
        .filter((r) => {
          return (
            tableIds.has(r?.sourceTableId) &&
            fieldIds.has(`${r?.sourceTableId}:${r?.sourceFieldId}`) &&
            tableIds.has(r?.targetTableId) &&
            fieldIds.has(`${r?.targetTableId}:${r?.targetFieldId}`)
          )
        })
        .map((r) => ({
          id: r.id || createId('rel'),
          sourceTableId: r.sourceTableId,
          sourceFieldId: r.sourceFieldId,
          targetTableId: r.targetTableId,
          targetFieldId: r.targetFieldId,
          type: RELATION_OPTIONS.includes(r.type) ? r.type : '1:N',
          color: r.color || '#0ea5e9',
          classMeta: r?.classMeta
            ? {
                sourceMultiplicity: String(r.classMeta.sourceMultiplicity || '1'),
                targetMultiplicity: String(r.classMeta.targetMultiplicity || '1'),
                label: String(r.classMeta.label || ''),
              }
            : null,
        }))
    : []

  return {
    tables,
    relations,
    diagramType: diagram.diagramType === 'class' ? 'class' : 'er',
    theme: diagram.theme === 'dark' ? 'dark' : 'light',
    snapToGrid: diagram.snapToGrid !== false,
  }
}

export function getCardinality(type) {
  if (type === '1:1') return { start: 'one', end: 'one' }
  if (type === '1:N') return { start: 'one', end: 'many' }
  return { start: 'many', end: 'many' }
}

export function formatFieldType(field) {
  if (field.length && TYPES_WITH_LENGTH.has(field.type)) return `${field.type}(${field.length})`
  return field.type
}

export function formatClassMemberLine(member) {
  const vis = member.visibility || ''
  if (member.memberKind === 'method') {
    return `${vis}${member.name}(${member.params || ''}) : ${member.type || 'void'}`
  }
  return `${vis}${member.name} : ${member.type || 'Any'}`
}

export function escapeSqlIdentifier(name) {
  return `\`${String(name).replace(/`/g, '``')}\``
}

export function formatDefaultValue(value, type) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const upper = raw.toUpperCase()
  if (upper === 'NULL' || upper === 'CURRENT_TIMESTAMP') return raw
  if (['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'FLOAT', 'DOUBLE', 'DECIMAL'].includes(type)) {
    return Number.isFinite(Number(raw)) ? raw : `'${raw.replace(/'/g, "''")}'`
  }
  if (type === 'BOOLEAN') {
    if (raw === '1' || raw.toLowerCase() === 'true') return '1'
    if (raw === '0' || raw.toLowerCase() === 'false') return '0'
  }
  return `'${raw.replace(/'/g, "''")}'`
}

export function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}
