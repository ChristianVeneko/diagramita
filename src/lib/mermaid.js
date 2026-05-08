import {
  createId,
  createEmptyConstraints,
  normalizeIdentifier,
  toSnakeCase,
  cloneField,
  createTableFromDraft,
  getPrimaryField,
  buildUniqueFieldName,
  ensureTargetFieldForImportedRelation,
  sanitizeDiagram,
} from './diagram.js'
import { MYSQL_TYPES, TYPES_WITH_LENGTH } from '../constants.js'

const MERMAID_ER_RELATION_LINE =
  /^([A-Za-z][A-Za-z0-9_-]*)\s+([|}{o]{1,2})\s*(?:--|\.\.)\s*([|}{o]{1,2})\s+([A-Za-z][A-Za-z0-9_-]*)(?:\s*:\s*(.+))?$/i

const MERMAID_CLASS_RELATION_LINE =
  /^([A-Za-z][A-Za-z0-9_-]*)\s+"([^"]+)"\s+([.\-<>|*ox]+)\s+"([^"]+)"\s+([A-Za-z][A-Za-z0-9_-]*)(?:\s*:\s*(.+))?$/i

function normalizeMermaidIdentifier(value, fallback) {
  const raw = String(value || '').replace(/-/g, '_')
  return normalizeIdentifier(raw, fallback)
}

function mapMermaidType(rawType) {
  const token = String(rawType || '').trim()
  const match = token.match(/^([A-Za-z]+)(?:\(([^)]+)\))?$/)
  const baseToken = (match?.[1] || token).replace(/[^A-Za-z]/g, '').toUpperCase()
  const explicitLength = String(match?.[2] || '').replace(/\s+/g, '')

  const aliases = {
    STRING: { type: 'VARCHAR', length: '255' },
    STR: { type: 'VARCHAR', length: '255' },
    INTEGER: { type: 'INT', length: '' },
    NUMBER: { type: 'INT', length: '' },
    BOOL: { type: 'BOOLEAN', length: '' },
    DATETIME2: { type: 'DATETIME', length: '' },
    LONG: { type: 'BIGINT', length: '' },
    UUID: { type: 'CHAR', length: '36' },
  }

  const alias = aliases[baseToken]
  let type = alias?.type || (MYSQL_TYPES.includes(baseToken) ? baseToken : 'VARCHAR')
  let length = explicitLength || alias?.length || ''
  if (!TYPES_WITH_LENGTH.has(type)) length = ''
  if (type === 'VARCHAR' && !length) length = '255'
  return { type, length }
}

function parseMermaidConstraints(rawConstraintText) {
  const constraints = createEmptyConstraints()
  const source = String(rawConstraintText || '')
  const upper = source.toUpperCase()
  if (/\bPK\b|\bPRIMARY(?:\s+KEY)?\b/.test(upper)) { constraints.primaryKey = true; constraints.notNull = true }
  if (/\bFK\b|\bFOREIGN(?:\s+KEY)?\b/.test(upper)) constraints.foreignKey = true
  if (/\bUNIQUE\b|\bUK\b/.test(upper)) constraints.unique = true
  if (/\bNN\b|\bNOT[\s_]?NULL\b/.test(upper)) constraints.notNull = true
  if (/\bAI\b|\bAUTO[\s_]?INCREMENT\b/.test(upper)) { constraints.autoIncrement = true; constraints.notNull = true }
  const defaultMatch = source.match(/\bDEFAULT\s*(?:=|\s+)\s*(.+)$/i)
  if (defaultMatch) constraints.defaultValue = defaultMatch[1].trim().replace(/^['"]|['"]$/g, '')
  return constraints
}

function parseMermaidFieldLine(rawLine, index) {
  const withoutQuotes = String(rawLine).replace(/"[^"]*"/g, ' ').trim()
  if (!withoutQuotes) return null
  const tokens = withoutQuotes.split(/\s+/)
  if (tokens.length < 2) return null
  const { type, length } = mapMermaidType(tokens[0])
  return {
    id: createId('fld'),
    name: normalizeIdentifier(tokens[1], `campo_${index + 1}`),
    type,
    length,
    constraints: parseMermaidConstraints(tokens.slice(2).join(' ')),
    reference: null,
  }
}

function parseMermaidRelationLine(rawLine) {
  const match = String(rawLine).match(MERMAID_ER_RELATION_LINE)
  if (!match) return null
  return {
    leftName: normalizeMermaidIdentifier(match[1], 'tabla_izquierda'),
    rightName: normalizeMermaidIdentifier(match[4], 'tabla_derecha'),
    leftCardinality: match[2],
    rightCardinality: match[3],
  }
}

function isManyMultiplicity(value) {
  const text = String(value || '').toLowerCase().replace(/\s+/g, '')
  if (!text) return false
  if (text.includes('*') || text.includes('n') || text.includes('m')) return true
  const range = text.match(/^(\d+)\.\.(\d+)$/)
  return range ? Number(range[2]) > 1 : false
}

function parseMermaidClassRelationLine(rawLine) {
  const line = String(rawLine).trim()
  const quoted = line.match(MERMAID_CLASS_RELATION_LINE)
  if (quoted) {
    return {
      leftName: normalizeMermaidIdentifier(quoted[1], 'ClaseA'),
      leftMultiplicity: quoted[2].trim(),
      rightMultiplicity: quoted[4].trim(),
      rightName: normalizeMermaidIdentifier(quoted[5], 'ClaseB'),
      label: String(quoted[6] || '').trim(),
    }
  }
  const basic = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s+([.\-<>|*ox]+)\s+([A-Za-z][A-Za-z0-9_-]*)(?:\s*:\s*(.+))?$/i)
  if (!basic) return null
  return {
    leftName: normalizeMermaidIdentifier(basic[1], 'ClaseA'),
    leftMultiplicity: '1',
    rightMultiplicity: '1',
    rightName: normalizeMermaidIdentifier(basic[3], 'ClaseB'),
    label: String(basic[4] || '').trim(),
  }
}

function parseClassMemberLine(rawLine) {
  const source = String(rawLine || '').trim()
  if (!source) return null
  const visMatch = source.match(/^([+\-#~])\s*(.+)$/)
  const vis = visMatch ? visMatch[1] : ''
  const content = visMatch ? visMatch[2].trim() : source

  if (content.includes('(') && content.includes(')')) {
    const m = content.match(/^([A-Za-z_][A-Za-z0-9_]*)\(([^)]*)\)\s*([A-Za-z0-9_~<>.[\]]+)?$/)
    if (!m) return null
    return {
      id: createId('fld'),
      name: m[1],
      type: String(m[3] || 'void').trim(),
      length: '',
      constraints: createEmptyConstraints(),
      reference: null,
      memberKind: 'method',
      visibility: vis,
      params: String(m[2] || '').trim(),
    }
  }

  const attr = content.match(/^([A-Za-z0-9_~<>.[\]]+)\s+([A-Za-z_][A-Za-z0-9_]*)$/)
  if (!attr) return null
  return {
    id: createId('fld'),
    name: attr[2],
    type: String(attr[1] || 'Any').trim(),
    length: '',
    constraints: createEmptyConstraints(),
    reference: null,
    memberKind: 'attribute',
    visibility: vis,
    params: '',
  }
}

function classRelationTypeFromMultiplicities(left, right) {
  const lMany = isManyMultiplicity(left)
  const rMany = isManyMultiplicity(right)
  if (lMany && rMany) return 'N:M'
  if (!lMany && !rMany) return '1:1'
  return '1:N'
}

function addRelationToState(state, payload) {
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

    const pivotName = `${toSnakeCase(sourceTable.name)}_${toSnakeCase(targetTable.name)}`
    const f1 = { id: createId('fld'), name: `${toSnakeCase(sourceTable.name)}_${toSnakeCase(sourcePk.name)}`, type: sourcePk.type, length: sourcePk.length, constraints: { ...createEmptyConstraints(), primaryKey: true, foreignKey: true, notNull: true }, reference: { tableId: sourceTable.id, fieldId: sourcePk.id } }
    const f2 = { id: createId('fld'), name: `${toSnakeCase(targetTable.name)}_${toSnakeCase(targetPk.name)}`, type: targetPk.type, length: targetPk.length, constraints: { ...createEmptyConstraints(), primaryKey: true, foreignKey: true, notNull: true }, reference: { tableId: targetTable.id, fieldId: targetPk.id } }
    const pivot = createTableFromDraft({ name: pivotName, fields: [f1, f2], position: { x: (sourceTable.x + targetTable.x) / 2 + 80, y: (sourceTable.y + targetTable.y) / 2 + 170 }, isPivot: true })
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

  const relations = [...state.relations, { id: createId('rel'), sourceTableId, sourceFieldId, targetTableId, targetFieldId, type: relationType, color: color || '#0ea5e9' }]
  const tables = state.tables.map((t) => {
    if (t.id !== targetTableId) return t
    return {
      ...t,
      fields: t.fields.map((f) => {
        if (f.id !== targetFieldId) return f
        return { ...f, constraints: { ...f.constraints, foreignKey: true, unique: relationType === '1:1' ? true : f.constraints.unique }, reference: { tableId: sourceTableId, fieldId: sourceFieldId } }
      }),
    }
  })
  return { ...state, tables, relations }
}

export function importMermaidToDiagram(mermaidText, options = {}) {
  const text = String(mermaidText || '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')
  const draftTables = new Map()
  const draftRelations = []
  let currentTableName = null
  let foundErDiagram = false

  const ensureTable = (name) => {
    const safe = normalizeMermaidIdentifier(name, `tabla_${draftTables.size + 1}`)
    if (!draftTables.has(safe)) draftTables.set(safe, { name: safe, fields: [] })
    return draftTables.get(safe)
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/%%.*$/g, '').trim()
    if (!line) continue
    if (/^erDiagram\b/i.test(line)) { foundErDiagram = true; continue }
    if (currentTableName) {
      if (line === '}') { currentTableName = null; continue }
      const t = draftTables.get(currentTableName)
      if (!t) continue
      const field = parseMermaidFieldLine(line, t.fields.length)
      if (field) t.fields.push(field)
      continue
    }
    const blockStart = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*\{$/)
    if (blockStart) { foundErDiagram = true; currentTableName = ensureTable(blockStart[1]).name; continue }
    const rel = parseMermaidRelationLine(line)
    if (rel) { foundErDiagram = true; ensureTable(rel.leftName); ensureTable(rel.rightName); draftRelations.push(rel); continue }
  }

  if (currentTableName) throw new Error(`La entidad ${currentTableName} no tiene cierre con }`)
  if (!foundErDiagram) throw new Error('No se detectó un bloque erDiagram válido en Mermaid')
  if (draftTables.size === 0) throw new Error('No se detectaron entidades para importar')

  const tableEntries = [...draftTables.values()]
  const cols = Math.max(1, Math.ceil(Math.sqrt(tableEntries.length)))

  const tables = tableEntries.map((draft, i) => {
    const fields = draft.fields.length > 0
      ? draft.fields.map((f, fi) => cloneField(f, fi))
      : [{ ...createFieldDraft(0), id: createId('fld') }]
    const hasPk = fields.some((f) => f.constraints.primaryKey)
    if (!hasPk) {
      const idField = fields.find((f) => f.name.toLowerCase() === 'id')
      if (idField) { idField.constraints.primaryKey = true; idField.constraints.notNull = true }
    }
    return createTableFromDraft({
      name: draft.name,
      fields,
      position: { x: 140 + (i % cols) * 340, y: 120 + Math.floor(i / cols) * 250 },
    })
  })

  let diagram = { tables, relations: [], diagramType: 'er', theme: options.theme === 'dark' ? 'dark' : 'light', snapToGrid: options.snapToGrid !== false }

  for (const rel of draftRelations) {
    const byName = new Map(diagram.tables.map((t) => [t.name.toLowerCase(), t]))
    const left = byName.get(rel.leftName.toLowerCase())
    const right = byName.get(rel.rightName.toLowerCase())
    if (!left || !right) continue
    const leftMany = rel.leftCardinality.includes('{') || rel.leftCardinality.includes('}')
    const rightMany = rel.rightCardinality.includes('{') || rel.rightCardinality.includes('}')
    if (leftMany && rightMany) {
      const lf = getPrimaryField(left)
      const rf = getPrimaryField(right)
      if (lf && rf) diagram = addRelationToState(diagram, { sourceTableId: left.id, sourceFieldId: lf.id, targetTableId: right.id, targetFieldId: rf.id, relationType: 'N:M', color: '#0ea5e9' })
      continue
    }
    const src = leftMany && !rightMany ? right : left
    const tgt = leftMany && !rightMany ? left : right
    const srcField = getPrimaryField(src)
    if (!srcField) continue
    const { state, targetFieldId } = ensureTargetFieldForImportedRelation(diagram, src.id, tgt.id)
    diagram = state
    if (!targetFieldId) continue
    diagram = addRelationToState(diagram, { sourceTableId: src.id, sourceFieldId: srcField.id, targetTableId: tgt.id, targetFieldId, relationType: (!leftMany && !rightMany) ? '1:1' : '1:N', color: '#0ea5e9' })
  }

  return sanitizeDiagram(diagram)
}

export function importMermaidClassToDiagram(mermaidText, options = {}) {
  const text = String(mermaidText || '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')
  const draftClasses = new Map()
  const draftRelations = []
  let currentClassName = null
  let foundClassDiagram = false

  const ensureClass = (name) => {
    const safe = normalizeMermaidIdentifier(name, `Clase_${draftClasses.size + 1}`)
    if (!draftClasses.has(safe)) draftClasses.set(safe, { name: safe, members: [] })
    return draftClasses.get(safe)
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/%%.*$/g, '').trim()
    if (!line) continue
    if (/^classDiagram\b/i.test(line)) { foundClassDiagram = true; continue }
    if (currentClassName) {
      if (line === '}') { currentClassName = null; continue }
      const cls = draftClasses.get(currentClassName)
      if (!cls) continue
      const member = parseClassMemberLine(line)
      if (member) cls.members.push(member)
      continue
    }
    const blockMatch = line.match(/^class\s+([A-Za-z][A-Za-z0-9_-]*)\s*\{$/i)
    if (blockMatch) { foundClassDiagram = true; currentClassName = ensureClass(blockMatch[1]).name; continue }
    const compactMatch = line.match(/^class\s+([A-Za-z][A-Za-z0-9_-]*)$/i)
    if (compactMatch) { foundClassDiagram = true; ensureClass(compactMatch[1]); continue }
    const rel = parseMermaidClassRelationLine(line)
    if (rel) { foundClassDiagram = true; ensureClass(rel.leftName); ensureClass(rel.rightName); draftRelations.push(rel); continue }
  }

  if (currentClassName) throw new Error(`La clase ${currentClassName} no tiene cierre con }`)
  if (!foundClassDiagram || draftClasses.size === 0) throw new Error('No se detectó un diagrama de clases Mermaid válido')

  const classEntries = [...draftClasses.values()]
  const cols = Math.max(1, Math.ceil(Math.sqrt(classEntries.length)))

  const tables = classEntries.map((draft, i) => {
    const members = draft.members.length > 0
      ? draft.members.map((m, mi) => cloneField(m, mi))
      : [{ id: createId('fld'), name: 'init', type: 'void', length: '', constraints: createEmptyConstraints(), reference: null, memberKind: 'method', visibility: '+', params: '' }]
    const table = createTableFromDraft({
      name: draft.name,
      fields: members,
      position: { x: 120 + (i % cols) * 380, y: 100 + Math.floor(i / cols) * 260 },
      width: 320,
      modelType: 'class',
      colors: { header: '#1e3a8a', body: '#e2e8f0', text: '#0f172a' },
    })
    return { ...table, height: Math.max(table.height, HEADER_HEIGHT + members.length * ROW_HEIGHT + 34) }
  })

  const classByName = new Map(tables.map((t) => [t.name.toLowerCase(), t]))
  const relations = []

  for (const rel of draftRelations) {
    const left = classByName.get(rel.leftName.toLowerCase())
    const right = classByName.get(rel.rightName.toLowerCase())
    if (!left || !right) continue
    const lAnchor = left.fields[0]
    const rAnchor = right.fields[0]
    if (!lAnchor || !rAnchor) continue

    const leftMany = isManyMultiplicity(rel.leftMultiplicity)
    const rightMany = isManyMultiplicity(rel.rightMultiplicity)
    let src = left, tgt = right, srcMul = rel.leftMultiplicity, tgtMul = rel.rightMultiplicity
    if (leftMany && !rightMany) { src = right; tgt = left; srcMul = rel.rightMultiplicity; tgtMul = rel.leftMultiplicity }

    relations.push({
      id: createId('rel'),
      sourceTableId: src.id,
      sourceFieldId: src.fields[0].id,
      targetTableId: tgt.id,
      targetFieldId: tgt.fields[0].id,
      type: classRelationTypeFromMultiplicities(srcMul, tgtMul),
      color: '#0284c7',
      classMeta: { sourceMultiplicity: srcMul, targetMultiplicity: tgtMul, label: rel.label },
    })
  }

  return sanitizeDiagram({
    tables,
    relations,
    diagramType: 'class',
    theme: options.theme === 'dark' ? 'dark' : 'light',
    snapToGrid: options.snapToGrid !== false,
  })
}
