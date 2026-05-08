import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { toPng } from 'html-to-image'

const GRID_SIZE = 24
const HEADER_HEIGHT = 44
const ROW_HEIGHT = 34
const TABLE_MIN_WIDTH = 220
const TABLE_MIN_HEIGHT = 120
const MAX_HISTORY = 100
const STORAGE_KEY = 'er-diagram-workspace-v1'

const MYSQL_TYPES = [
  'INT',
  'BIGINT',
  'SMALLINT',
  'TINYINT',
  'VARCHAR',
  'CHAR',
  'TEXT',
  'LONGTEXT',
  'DATE',
  'DATETIME',
  'TIMESTAMP',
  'TIME',
  'FLOAT',
  'DOUBLE',
  'DECIMAL',
  'BOOLEAN',
  'BLOB',
  'ENUM',
  'JSON',
]

const TYPES_WITH_LENGTH = new Set([
  'INT',
  'BIGINT',
  'SMALLINT',
  'TINYINT',
  'VARCHAR',
  'CHAR',
  'FLOAT',
  'DOUBLE',
  'DECIMAL',
  'ENUM',
])

const relationOptions = ['1:1', '1:N', 'N:M']

const MERMAID_ER_RELATION_LINE = /^([A-Za-z][A-Za-z0-9_-]*)\s+([|}{o]{1,2})\s*(?:--|\.\.)\s*([|}{o]{1,2})\s+([A-Za-z][A-Za-z0-9_-]*)(?:\s*:\s*(.+))?$/i

const MERMAID_CLASS_RELATION_LINE = /^([A-Za-z][A-Za-z0-9_-]*)\s+"([^"]+)"\s+([.\-<>|*ox]+)\s+"([^"]+)"\s+([A-Za-z][A-Za-z0-9_-]*)(?:\s*:\s*(.+))?$/i

const MERMAID_ER_SAMPLE = `erDiagram
  usuarios {
    int id PK
    varchar(120) email UNIQUE
    varchar(80) nombre
    datetime creado_en
  }

  pedidos {
    int id PK
    int usuario_id FK
    decimal(10,2) total
    datetime creado_en
  }

  productos {
    int id PK
    varchar(140) nombre
    decimal(10,2) precio
  }

  usuarios ||--o{ pedidos : tiene
  pedidos }o--o{ productos : contiene`

const MERMAID_CLASS_SAMPLE = `class Medico {
  -int idMedico
  -String nombre
  -String especialidad
  +iniciarSesion() bool
  +getCitasHoy() List~Cita~
}

class Paciente {
  -String cedula
  -String nombre
  +getEdad() int
}

class Cita {
  -int idCita
  -DateTime fechaHora
  -String estado
  +cancelar() void
}

Medico   "1" -- "0..*" Cita     : agenda
Paciente "1" -- "0..*" Cita     : tiene`

function createId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function createEmptyConstraints() {
  return {
    primaryKey: false,
    foreignKey: false,
    notNull: false,
    unique: false,
    autoIncrement: false,
    defaultValue: '',
  }
}

function normalizeIdentifier(value, fallback) {
  const cleaned = String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
  return cleaned || fallback
}

function toSnakeCase(value) {
  return normalizeIdentifier(value, 'tabla').toLowerCase()
}

function getMinimumTableHeight(fieldCount) {
  return Math.max(TABLE_MIN_HEIGHT, HEADER_HEIGHT + Math.max(fieldCount, 1) * ROW_HEIGHT + 12)
}

function createFieldDraft(index) {
  if (index === 0) {
    return {
      id: createId('fld'),
      name: 'id',
      type: 'INT',
      length: '',
      constraints: {
        ...createEmptyConstraints(),
        primaryKey: true,
        notNull: true,
        autoIncrement: true,
      },
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

function createTableFromDraft({
  name,
  fields,
  position,
  isPivot = false,
  width = 260,
  modelType = 'entity',
  colors = null,
}) {
  const defaultColors = modelType === 'class'
    ? {
        header: '#1d4ed8',
        body: '#f8fafc',
        text: '#0f172a',
      }
    : {
        header: isPivot ? '#5b4abf' : '#0f766e',
        body: '#f8fafc',
        text: '#0f172a',
      }

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

function getPrimaryField(table) {
  return table.fields.find((field) => field.constraints.primaryKey) || table.fields[0] || null
}

function buildUniqueTableName(tables, baseName) {
  const existing = new Set(tables.map((table) => table.name.toLowerCase()))
  if (!existing.has(baseName.toLowerCase())) return baseName

  let index = 2
  let nextName = `${baseName}_${index}`
  while (existing.has(nextName.toLowerCase())) {
    index += 1
    nextName = `${baseName}_${index}`
  }
  return nextName
}

function cloneField(field, index = 0) {
  const rawType = String(field?.type || '').trim()
  const isClassMember = field?.memberKind === 'attribute' || field?.memberKind === 'method'

  return {
    id: field?.id || createId('fld'),
    name: normalizeIdentifier(field?.name, `campo_${index + 1}`),
    type: isClassMember
      ? (rawType || 'Any')
      : (MYSQL_TYPES.includes(rawType.toUpperCase()) ? rawType.toUpperCase() : 'VARCHAR'),
    length: String(field?.length || ''),
    constraints: {
      ...createEmptyConstraints(),
      ...(field?.constraints || {}),
      defaultValue: String(field?.constraints?.defaultValue || ''),
    },
    reference: field?.reference || null,
    memberKind: field?.memberKind || null,
    visibility: field?.visibility || '',
    params: field?.params || '',
  }
}

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

  if (!TYPES_WITH_LENGTH.has(type)) {
    length = ''
  }

  if (type === 'VARCHAR' && !length) {
    length = '255'
  }

  return {
    type,
    length,
  }
}

function parseMermaidConstraints(rawConstraintText) {
  const constraints = createEmptyConstraints()
  const source = String(rawConstraintText || '')
  const upper = source.toUpperCase()

  if (/\bPK\b|\bPRIMARY(?:\s+KEY)?\b/.test(upper)) {
    constraints.primaryKey = true
    constraints.notNull = true
  }

  if (/\bFK\b|\bFOREIGN(?:\s+KEY)?\b/.test(upper)) {
    constraints.foreignKey = true
  }

  if (/\bUNIQUE\b|\bUK\b/.test(upper)) {
    constraints.unique = true
  }

  if (/\bNN\b|\bNOT[\s_]?NULL\b/.test(upper)) {
    constraints.notNull = true
  }

  if (/\bAI\b|\bAUTO[\s_]?INCREMENT\b/.test(upper)) {
    constraints.autoIncrement = true
    constraints.notNull = true
  }

  const defaultMatch = source.match(/\bDEFAULT\s*(?:=|\s+)\s*(.+)$/i)
  if (defaultMatch) {
    constraints.defaultValue = defaultMatch[1].trim().replace(/^['"]|['"]$/g, '')
  }

  return constraints
}

function parseMermaidFieldLine(rawLine, index) {
  const withoutQuotes = String(rawLine).replace(/"[^"]*"/g, ' ').trim()
  if (!withoutQuotes) return null

  const tokens = withoutQuotes.split(/\s+/)
  if (tokens.length < 2) return null

  const typeToken = tokens[0]
  const nameToken = tokens[1]
  const constraintText = tokens.slice(2).join(' ')
  const { type, length } = mapMermaidType(typeToken)

  return {
    id: createId('fld'),
    name: normalizeIdentifier(nameToken, `campo_${index + 1}`),
    type,
    length,
    constraints: parseMermaidConstraints(constraintText),
    reference: null,
  }
}

function parseMermaidRelationLine(rawLine) {
  const match = String(rawLine).match(MERMAID_ER_RELATION_LINE)
  if (!match) return null

  const leftName = normalizeMermaidIdentifier(match[1], 'tabla_izquierda')
  const leftCardinality = match[2]
  const rightCardinality = match[3]
  const rightName = normalizeMermaidIdentifier(match[4], 'tabla_derecha')

  return {
    leftName,
    rightName,
    leftCardinality,
    rightCardinality,
  }
}

function buildUniqueFieldName(fields, baseName) {
  const used = new Set(fields.map((field) => field.name.toLowerCase()))
  if (!used.has(baseName.toLowerCase())) {
    return baseName
  }

  let sequence = 2
  let nextName = `${baseName}_${sequence}`
  while (used.has(nextName.toLowerCase())) {
    sequence += 1
    nextName = `${baseName}_${sequence}`
  }
  return nextName
}

function ensureTargetFieldForImportedRelation(state, sourceTableId, targetTableId) {
  const sourceTable = state.tables.find((table) => table.id === sourceTableId)
  const targetTable = state.tables.find((table) => table.id === targetTableId)
  if (!sourceTable || !targetTable) {
    return { state, targetFieldId: null }
  }

  const sourcePrimaryField = getPrimaryField(sourceTable)
  if (!sourcePrimaryField) {
    return { state, targetFieldId: null }
  }

  const candidateNames = [
    `${toSnakeCase(sourceTable.name)}_${toSnakeCase(sourcePrimaryField.name)}`,
    `${toSnakeCase(sourceTable.name)}_id`,
  ]
  const candidateSet = new Set(candidateNames.map((name) => name.toLowerCase()))

  const existing = targetTable.fields.find((field) => (
    candidateSet.has(field.name.toLowerCase())
  )) || targetTable.fields.find((field) => (
    field.constraints.foreignKey && !field.constraints.primaryKey
  )) || targetTable.fields.find((field) => (
    field.type === sourcePrimaryField.type && !field.constraints.primaryKey
  ))

  if (existing) {
    return { state, targetFieldId: existing.id }
  }

  const nextFieldName = buildUniqueFieldName(
    targetTable.fields,
    normalizeIdentifier(candidateNames[0], `${toSnakeCase(sourceTable.name)}_id`),
  )

  const nextField = {
    id: createId('fld'),
    name: nextFieldName,
    type: sourcePrimaryField.type,
    length: sourcePrimaryField.length,
    constraints: {
      ...createEmptyConstraints(),
      foreignKey: true,
    },
    reference: null,
  }

  const nextTargetTable = {
    ...targetTable,
    fields: [...targetTable.fields, nextField],
    height: Math.max(targetTable.height, getMinimumTableHeight(targetTable.fields.length + 1)),
  }

  return {
    state: {
      ...state,
      tables: state.tables.map((table) => (
        table.id === nextTargetTable.id ? nextTargetTable : table
      )),
    },
    targetFieldId: nextField.id,
  }
}

function importMermaidToDiagram(mermaidText, options = {}) {
  const text = String(mermaidText || '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')

  const draftTables = new Map()
  const draftRelations = []
  let currentTableName = null
  let foundErDiagram = false

  const ensureDraftTable = (name) => {
    const safeName = normalizeMermaidIdentifier(name, `tabla_${draftTables.size + 1}`)
    if (!draftTables.has(safeName)) {
      draftTables.set(safeName, {
        name: safeName,
        fields: [],
      })
    }
    return draftTables.get(safeName)
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/%%.*$/g, '').trim()
    if (!line) continue

    if (/^erDiagram\b/i.test(line)) {
      foundErDiagram = true
      continue
    }

    if (currentTableName) {
      if (line === '}') {
        currentTableName = null
        continue
      }

      const currentTable = draftTables.get(currentTableName)
      if (!currentTable) continue

      const field = parseMermaidFieldLine(line, currentTable.fields.length)
      if (field) {
        currentTable.fields.push(field)
      }
      continue
    }

    const blockStart = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*\{$/)
    if (blockStart) {
      foundErDiagram = true
      currentTableName = ensureDraftTable(blockStart[1]).name
      continue
    }

    const relationLine = parseMermaidRelationLine(line)
    if (relationLine) {
      foundErDiagram = true
      ensureDraftTable(relationLine.leftName)
      ensureDraftTable(relationLine.rightName)
      draftRelations.push(relationLine)
      continue
    }
  }

  if (currentTableName) {
    throw new Error(`La entidad ${currentTableName} no tiene cierre con }`)
  }

  if (!foundErDiagram) {
    throw new Error('No se detecto un bloque erDiagram valido en Mermaid')
  }

  if (draftTables.size === 0) {
    throw new Error('No se detectaron entidades para importar')
  }

  const tableEntries = [...draftTables.values()]
  const columns = Math.max(1, Math.ceil(Math.sqrt(tableEntries.length)))
  const positionX = 140
  const positionY = 120
  const gapX = 340
  const gapY = 250

  const tables = tableEntries.map((tableDraft, index) => {
    const fields = tableDraft.fields.length > 0
      ? tableDraft.fields.map((field, fieldIndex) => cloneField(field, fieldIndex))
      : [{
          ...createFieldDraft(0),
          id: createId('fld'),
        }]

    const hasPrimary = fields.some((field) => field.constraints.primaryKey)
    if (!hasPrimary) {
      const idField = fields.find((field) => field.name.toLowerCase() === 'id')
      if (idField) {
        idField.constraints.primaryKey = true
        idField.constraints.notNull = true
      }
    }

    return createTableFromDraft({
      name: tableDraft.name,
      fields,
      position: {
        x: positionX + (index % columns) * gapX,
        y: positionY + Math.floor(index / columns) * gapY,
      },
    })
  })

  let nextDiagram = {
    tables,
    relations: [],
    diagramType: 'er',
    theme: options.theme === 'dark' ? 'dark' : 'light',
    snapToGrid: options.snapToGrid !== false,
  }

  for (const relation of draftRelations) {
    const tableByName = new Map(nextDiagram.tables.map((table) => [table.name.toLowerCase(), table]))
    const leftTable = tableByName.get(relation.leftName.toLowerCase())
    const rightTable = tableByName.get(relation.rightName.toLowerCase())
    if (!leftTable || !rightTable) continue

    const leftMany = relation.leftCardinality.includes('{') || relation.leftCardinality.includes('}')
    const rightMany = relation.rightCardinality.includes('{') || relation.rightCardinality.includes('}')

    if (leftMany && rightMany) {
      const leftField = getPrimaryField(leftTable)
      const rightField = getPrimaryField(rightTable)
      if (!leftField || !rightField) continue

      nextDiagram = addRelationReducer(nextDiagram, {
        sourceTableId: leftTable.id,
        sourceFieldId: leftField.id,
        targetTableId: rightTable.id,
        targetFieldId: rightField.id,
        relationType: 'N:M',
        color: '#0ea5e9',
      })
      continue
    }

    const sourceTable = leftMany && !rightMany ? rightTable : leftTable
    const targetTable = leftMany && !rightMany ? leftTable : rightTable
    const sourceField = getPrimaryField(sourceTable)
    if (!sourceField) continue

    const { state, targetFieldId } = ensureTargetFieldForImportedRelation(
      nextDiagram,
      sourceTable.id,
      targetTable.id,
    )
    nextDiagram = state
    if (!targetFieldId) continue

    nextDiagram = addRelationReducer(nextDiagram, {
      sourceTableId: sourceTable.id,
      sourceFieldId: sourceField.id,
      targetTableId: targetTable.id,
      targetFieldId,
      relationType: (!leftMany && !rightMany) ? '1:1' : '1:N',
      color: '#0ea5e9',
    })
  }

  return sanitizeDiagram(nextDiagram)
}

function parseMermaidClassRelationLine(rawLine) {
  const line = String(rawLine).trim()
  const quotedMatch = line.match(MERMAID_CLASS_RELATION_LINE)
  if (quotedMatch) {
    return {
      leftName: normalizeMermaidIdentifier(quotedMatch[1], 'ClaseA'),
      leftMultiplicity: quotedMatch[2].trim(),
      rightMultiplicity: quotedMatch[4].trim(),
      rightName: normalizeMermaidIdentifier(quotedMatch[5], 'ClaseB'),
      label: String(quotedMatch[6] || '').trim(),
    }
  }

  const basicMatch = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s+([.\-<>|*ox]+)\s+([A-Za-z][A-Za-z0-9_-]*)(?:\s*:\s*(.+))?$/i)
  if (!basicMatch) return null

  return {
    leftName: normalizeMermaidIdentifier(basicMatch[1], 'ClaseA'),
    leftMultiplicity: '1',
    rightMultiplicity: '1',
    rightName: normalizeMermaidIdentifier(basicMatch[3], 'ClaseB'),
    label: String(basicMatch[4] || '').trim(),
  }
}

function parseClassMemberLine(rawLine) {
  const source = String(rawLine || '').trim()
  if (!source) return null

  const visibilityMatch = source.match(/^([+\-#~])\s*(.+)$/)
  const visibility = visibilityMatch ? visibilityMatch[1] : ''
  const content = visibilityMatch ? visibilityMatch[2].trim() : source

  if (content.includes('(') && content.includes(')')) {
    const methodMatch = content.match(/^([A-Za-z_][A-Za-z0-9_]*)\(([^)]*)\)\s*([A-Za-z0-9_~<>.[\]]+)?$/)
    if (!methodMatch) return null

    return {
      id: createId('fld'),
      name: methodMatch[1],
      type: String(methodMatch[3] || 'void').trim(),
      length: '',
      constraints: createEmptyConstraints(),
      reference: null,
      memberKind: 'method',
      visibility,
      params: String(methodMatch[2] || '').trim(),
    }
  }

  const attributeMatch = content.match(/^([A-Za-z0-9_~<>.[\]]+)\s+([A-Za-z_][A-Za-z0-9_]*)$/)
  if (!attributeMatch) return null

  return {
    id: createId('fld'),
    name: attributeMatch[2],
    type: String(attributeMatch[1] || 'Any').trim(),
    length: '',
    constraints: createEmptyConstraints(),
    reference: null,
    memberKind: 'attribute',
    visibility,
    params: '',
  }
}

function classRelationTypeFromMultiplicities(leftMultiplicity, rightMultiplicity) {
  const leftMany = isManyMultiplicity(leftMultiplicity)
  const rightMany = isManyMultiplicity(rightMultiplicity)

  if (leftMany && rightMany) return 'N:M'
  if (!leftMany && !rightMany) return '1:1'
  return '1:N'
}

function isManyMultiplicity(value) {
  const text = String(value || '').toLowerCase().replace(/\s+/g, '')
  if (!text) return false
  if (text.includes('*')) return true
  if (text.includes('n') || text.includes('m')) return true
  const rangeMatch = text.match(/^(\d+)\.\.(\d+)$/)
  if (rangeMatch) {
    return Number(rangeMatch[2]) > 1
  }
  return false
}

function importMermaidClassToDiagram(mermaidText, options = {}) {
  const text = String(mermaidText || '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')

  const draftClasses = new Map()
  const draftRelations = []
  let currentClassName = null
  let foundClassDiagram = false

  const ensureDraftClass = (name) => {
    const safeName = normalizeMermaidIdentifier(name, `Clase_${draftClasses.size + 1}`)
    if (!draftClasses.has(safeName)) {
      draftClasses.set(safeName, {
        name: safeName,
        members: [],
      })
    }
    return draftClasses.get(safeName)
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/%%.*$/g, '').trim()
    if (!line) continue

    if (/^classDiagram\b/i.test(line)) {
      foundClassDiagram = true
      continue
    }

    if (currentClassName) {
      if (line === '}') {
        currentClassName = null
        continue
      }

      const classDraft = draftClasses.get(currentClassName)
      if (!classDraft) continue

      const member = parseClassMemberLine(line)
      if (member) {
        classDraft.members.push(member)
      }
      continue
    }

    const classBlockMatch = line.match(/^class\s+([A-Za-z][A-Za-z0-9_-]*)\s*\{$/i)
    if (classBlockMatch) {
      foundClassDiagram = true
      currentClassName = ensureDraftClass(classBlockMatch[1]).name
      continue
    }

    const compactClassMatch = line.match(/^class\s+([A-Za-z][A-Za-z0-9_-]*)$/i)
    if (compactClassMatch) {
      foundClassDiagram = true
      ensureDraftClass(compactClassMatch[1])
      continue
    }

    const relation = parseMermaidClassRelationLine(line)
    if (relation) {
      foundClassDiagram = true
      ensureDraftClass(relation.leftName)
      ensureDraftClass(relation.rightName)
      draftRelations.push(relation)
      continue
    }
  }

  if (currentClassName) {
    throw new Error(`La clase ${currentClassName} no tiene cierre con }`)
  }

  if (!foundClassDiagram || draftClasses.size === 0) {
    throw new Error('No se detecto un diagrama de clases Mermaid valido')
  }

  const classEntries = [...draftClasses.values()]
  const columns = Math.max(1, Math.ceil(Math.sqrt(classEntries.length)))
  const positionX = 120
  const positionY = 100
  const gapX = 380
  const gapY = 260

  const tables = classEntries.map((classDraft, index) => {
    const members = classDraft.members.length > 0
      ? classDraft.members.map((member, memberIndex) => cloneField(member, memberIndex))
      : [{
          id: createId('fld'),
          name: 'init',
          type: 'void',
          length: '',
          constraints: createEmptyConstraints(),
          reference: null,
          memberKind: 'method',
          visibility: '+',
          params: '',
        }]

    const table = createTableFromDraft({
      name: classDraft.name,
      fields: members,
      position: {
        x: positionX + (index % columns) * gapX,
        y: positionY + Math.floor(index / columns) * gapY,
      },
      width: 320,
      modelType: 'class',
      colors: {
        header: '#1e3a8a',
        body: '#e2e8f0',
        text: '#0f172a',
      },
    })

    return {
      ...table,
      height: Math.max(table.height, HEADER_HEIGHT + members.length * ROW_HEIGHT + 34),
    }
  })

  const classByName = new Map(tables.map((table) => [table.name.toLowerCase(), table]))
  const relations = []

  for (const relationDraft of draftRelations) {
    const leftClass = classByName.get(relationDraft.leftName.toLowerCase())
    const rightClass = classByName.get(relationDraft.rightName.toLowerCase())
    if (!leftClass || !rightClass) continue

    const leftMany = isManyMultiplicity(relationDraft.leftMultiplicity)
    const rightMany = isManyMultiplicity(relationDraft.rightMultiplicity)
    const leftAnchor = leftClass.fields[0]
    const rightAnchor = rightClass.fields[0]
    if (!leftAnchor || !rightAnchor) continue

    let sourceClass = leftClass
    let targetClass = rightClass
    let sourceMultiplicity = relationDraft.leftMultiplicity
    let targetMultiplicity = relationDraft.rightMultiplicity

    if (leftMany && !rightMany) {
      sourceClass = rightClass
      targetClass = leftClass
      sourceMultiplicity = relationDraft.rightMultiplicity
      targetMultiplicity = relationDraft.leftMultiplicity
    }

    relations.push({
      id: createId('rel'),
      sourceTableId: sourceClass.id,
      sourceFieldId: sourceClass.fields[0].id,
      targetTableId: targetClass.id,
      targetFieldId: targetClass.fields[0].id,
      type: classRelationTypeFromMultiplicities(sourceMultiplicity, targetMultiplicity),
      color: '#0284c7',
      classMeta: {
        sourceMultiplicity,
        targetMultiplicity,
        label: relationDraft.label,
      },
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

function sanitizeDiagram(diagram) {
  const base = {
    tables: [],
    relations: [],
    diagramType: 'er',
    theme: 'light',
    snapToGrid: true,
  }

  if (!diagram || typeof diagram !== 'object') {
    return base
  }

  const tables = Array.isArray(diagram.tables)
    ? diagram.tables.map((table, index) => {
        const fields = Array.isArray(table?.fields) && table.fields.length > 0
          ? table.fields.map((field, fieldIndex) => cloneField(field, fieldIndex))
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

  const tableIds = new Set(tables.map((table) => table.id))
  const fieldIds = new Set(tables.flatMap((table) => table.fields.map((field) => `${table.id}:${field.id}`)))

  const relations = Array.isArray(diagram.relations)
    ? diagram.relations.filter((relation) => {
        const sourceValid = tableIds.has(relation?.sourceTableId) && fieldIds.has(`${relation?.sourceTableId}:${relation?.sourceFieldId}`)
        const targetValid = tableIds.has(relation?.targetTableId) && fieldIds.has(`${relation?.targetTableId}:${relation?.targetFieldId}`)
        return sourceValid && targetValid
      }).map((relation) => ({
        id: relation.id || createId('rel'),
        sourceTableId: relation.sourceTableId,
        sourceFieldId: relation.sourceFieldId,
        targetTableId: relation.targetTableId,
        targetFieldId: relation.targetFieldId,
        type: relationOptions.includes(relation.type) ? relation.type : '1:N',
        color: relation.color || '#0ea5e9',
        classMeta: relation?.classMeta
          ? {
              sourceMultiplicity: String(relation.classMeta.sourceMultiplicity || '1'),
              targetMultiplicity: String(relation.classMeta.targetMultiplicity || '1'),
              label: String(relation.classMeta.label || ''),
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

function addRelationReducer(state, payload) {
  const {
    sourceTableId,
    sourceFieldId,
    targetTableId,
    targetFieldId,
    relationType,
    color,
  } = payload

  if (
    !sourceTableId ||
    !sourceFieldId ||
    !targetTableId ||
    !targetFieldId ||
    (sourceTableId === targetTableId && sourceFieldId === targetFieldId)
  ) {
    return state
  }

  const sourceTable = state.tables.find((table) => table.id === sourceTableId)
  const targetTable = state.tables.find((table) => table.id === targetTableId)

  if (!sourceTable || !targetTable) return state

  if (state.diagramType === 'class') {
    const duplicateClassRelation = state.relations.some((relation) => (
      relation.sourceTableId === sourceTableId &&
      relation.sourceFieldId === sourceFieldId &&
      relation.targetTableId === targetTableId &&
      relation.targetFieldId === targetFieldId &&
      relation.type === relationType
    ))

    if (duplicateClassRelation) return state

    return {
      ...state,
      relations: [
        ...state.relations,
        {
          id: createId('rel'),
          sourceTableId,
          sourceFieldId,
          targetTableId,
          targetFieldId,
          type: relationType,
          color: color || '#0ea5e9',
          classMeta: {
            sourceMultiplicity: relationType === 'N:M' ? '0..*' : '1',
            targetMultiplicity: relationType === '1:1' ? '1' : '0..*',
            label: '',
          },
        },
      ],
    }
  }

  if (relationType === 'N:M') {
    const sourcePk = getPrimaryField(sourceTable)
    const targetPk = getPrimaryField(targetTable)
    if (!sourcePk || !targetPk) return state

    const pivotNameBase = `${toSnakeCase(sourceTable.name)}_${toSnakeCase(targetTable.name)}`
    const pivotName = buildUniqueTableName(state.tables, pivotNameBase)

    const firstPivotField = {
      id: createId('fld'),
      name: `${toSnakeCase(sourceTable.name)}_${toSnakeCase(sourcePk.name)}`,
      type: sourcePk.type,
      length: sourcePk.length,
      constraints: {
        ...createEmptyConstraints(),
        primaryKey: true,
        foreignKey: true,
        notNull: true,
      },
      reference: {
        tableId: sourceTable.id,
        fieldId: sourcePk.id,
      },
    }

    const secondPivotField = {
      id: createId('fld'),
      name: `${toSnakeCase(targetTable.name)}_${toSnakeCase(targetPk.name)}`,
      type: targetPk.type,
      length: targetPk.length,
      constraints: {
        ...createEmptyConstraints(),
        primaryKey: true,
        foreignKey: true,
        notNull: true,
      },
      reference: {
        tableId: targetTable.id,
        fieldId: targetPk.id,
      },
    }

    const pivotTable = createTableFromDraft({
      name: pivotName,
      fields: [firstPivotField, secondPivotField],
      position: {
        x: (sourceTable.x + targetTable.x) / 2 + 80,
        y: (sourceTable.y + targetTable.y) / 2 + 170,
      },
      isPivot: true,
    })

    const firstRelation = {
      id: createId('rel'),
      sourceTableId: sourceTable.id,
      sourceFieldId: sourcePk.id,
      targetTableId: pivotTable.id,
      targetFieldId: firstPivotField.id,
      type: '1:N',
      color: color || '#0ea5e9',
    }

    const secondRelation = {
      id: createId('rel'),
      sourceTableId: targetTable.id,
      sourceFieldId: targetPk.id,
      targetTableId: pivotTable.id,
      targetFieldId: secondPivotField.id,
      type: '1:N',
      color: color || '#0ea5e9',
    }

    return {
      ...state,
      tables: [...state.tables, pivotTable],
      relations: [...state.relations, firstRelation, secondRelation],
    }
  }

  const duplicate = state.relations.some((relation) => (
    relation.sourceTableId === sourceTableId &&
    relation.sourceFieldId === sourceFieldId &&
    relation.targetTableId === targetTableId &&
    relation.targetFieldId === targetFieldId
  ))

  if (duplicate) return state

  const relations = [
    ...state.relations,
    {
      id: createId('rel'),
      sourceTableId,
      sourceFieldId,
      targetTableId,
      targetFieldId,
      type: relationType,
      color: color || '#0ea5e9',
    },
  ]

  const tables = state.tables.map((table) => {
    if (table.id !== targetTableId) return table

    return {
      ...table,
      fields: table.fields.map((field) => {
        if (field.id !== targetFieldId) return field

        return {
          ...field,
          constraints: {
            ...field.constraints,
            foreignKey: true,
            unique: relationType === '1:1' ? true : field.constraints.unique,
          },
          reference: {
            tableId: sourceTableId,
            fieldId: sourceFieldId,
          },
        }
      }),
    }
  })

  return {
    ...state,
    tables,
    relations,
  }
}

function diagramReducer(state, action) {
  switch (action.type) {
    case 'SET_THEME':
      return {
        ...state,
        theme: action.theme === 'dark' ? 'dark' : 'light',
      }

    case 'SET_SNAP':
      return {
        ...state,
        snapToGrid: Boolean(action.enabled),
      }

    case 'SET_DIAGRAM_TYPE':
      return {
        ...state,
        diagramType: action.diagramType === 'class' ? 'class' : 'er',
      }

    case 'ADD_TABLE':
      return {
        ...state,
        tables: [...state.tables, action.table],
      }

    case 'SET_TABLE_POSITIONS': {
      let changed = false
      const tables = state.tables.map((table) => {
        const nextPosition = action.positions[table.id]
        if (!nextPosition) return table
        if (table.x === nextPosition.x && table.y === nextPosition.y) return table

        changed = true
        return {
          ...table,
          x: nextPosition.x,
          y: nextPosition.y,
        }
      })

      return changed ? { ...state, tables } : state
    }

    case 'RESIZE_TABLE':
      return {
        ...state,
        tables: state.tables.map((table) => {
          if (table.id !== action.tableId) return table

          return {
            ...table,
            width: Math.max(TABLE_MIN_WIDTH, action.width),
            height: Math.max(getMinimumTableHeight(table.fields.length), action.height),
          }
        }),
      }

    case 'RENAME_TABLE':
      return {
        ...state,
        tables: state.tables.map((table) => (
          table.id === action.tableId
            ? { ...table, name: normalizeIdentifier(action.name, table.name) }
            : table
        )),
      }

    case 'UPDATE_TABLE_COLORS':
      return {
        ...state,
        tables: state.tables.map((table) => (
          table.id === action.tableId
            ? {
                ...table,
                colors: {
                  ...table.colors,
                  ...action.colors,
                },
              }
            : table
        )),
      }

    case 'DELETE_TABLE':
      return {
        ...state,
        tables: state.tables.filter((table) => table.id !== action.tableId),
        relations: state.relations.filter((relation) => (
          relation.sourceTableId !== action.tableId && relation.targetTableId !== action.tableId
        )),
      }

    case 'DELETE_TABLES': {
      const removed = new Set(action.tableIds || [])
      if (removed.size === 0) return state

      return {
        ...state,
        tables: state.tables.filter((table) => !removed.has(table.id)),
        relations: state.relations.filter((relation) => (
          !removed.has(relation.sourceTableId) && !removed.has(relation.targetTableId)
        )),
      }
    }

    case 'ADD_FIELD':
      return {
        ...state,
        tables: state.tables.map((table) => {
          if (table.id !== action.tableId) return table

          const nextFields = [...table.fields, cloneField(action.field, table.fields.length)]
          return {
            ...table,
            fields: nextFields,
            height: Math.max(table.height, getMinimumTableHeight(nextFields.length)),
          }
        }),
      }

    case 'UPDATE_FIELD':
      return {
        ...state,
        tables: state.tables.map((table) => {
          if (table.id !== action.tableId) return table

          return {
            ...table,
            fields: table.fields.map((field, index) => (
              field.id === action.fieldId
                ? cloneField(action.field, index)
                : field
            )),
          }
        }),
      }

    case 'DELETE_FIELD': {
      const table = state.tables.find((item) => item.id === action.tableId)
      if (!table || table.fields.length <= 1) return state

      return {
        ...state,
        tables: state.tables.map((item) => (
          item.id === action.tableId
            ? {
                ...item,
                fields: item.fields.filter((field) => field.id !== action.fieldId),
              }
            : item
        )),
        relations: state.relations.filter((relation) => !(
          (relation.sourceTableId === action.tableId && relation.sourceFieldId === action.fieldId) ||
          (relation.targetTableId === action.tableId && relation.targetFieldId === action.fieldId)
        )),
      }
    }

    case 'ADD_RELATION':
      return addRelationReducer(state, action.payload)

    case 'DELETE_RELATION': {
      const targetRelation = state.relations.find((relation) => relation.id === action.relationId)
      if (!targetRelation) return state

      const relations = state.relations.filter((relation) => relation.id !== action.relationId)
      const keepForeignKey = relations.some((relation) => (
        relation.targetTableId === targetRelation.targetTableId &&
        relation.targetFieldId === targetRelation.targetFieldId
      ))

      const tables = keepForeignKey
        ? state.tables
        : state.tables.map((table) => {
            if (table.id !== targetRelation.targetTableId) return table
            return {
              ...table,
              fields: table.fields.map((field) => {
                if (field.id !== targetRelation.targetFieldId) return field
                return {
                  ...field,
                  constraints: {
                    ...field.constraints,
                    foreignKey: false,
                  },
                  reference: null,
                }
              }),
            }
          })

      return {
        ...state,
        tables,
        relations,
      }
    }

    case 'UPDATE_RELATION_COLOR':
      return {
        ...state,
        relations: state.relations.map((relation) => (
          relation.id === action.relationId
            ? { ...relation, color: action.color }
            : relation
        )),
      }

    case 'REPLACE_DIAGRAM':
      return sanitizeDiagram(action.diagram)

    default:
      return state
  }
}

function createInitialHistory() {
  return {
    past: [],
    present: sanitizeDiagram(null),
    future: [],
  }
}

function historyReducer(state, action) {
  switch (action.type) {
    case 'APPLY': {
      const nextPresent = diagramReducer(state.present, action.action)
      if (nextPresent === state.present) return state

      if (action.record === false) {
        return {
          ...state,
          present: nextPresent,
        }
      }

      const past = [...state.past, state.present]
      if (past.length > MAX_HISTORY) past.shift()

      return {
        past,
        present: nextPresent,
        future: [],
      }
    }

    case 'UNDO': {
      if (state.past.length === 0) return state

      const previous = state.past[state.past.length - 1]
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      }
    }

    case 'REDO': {
      if (state.future.length === 0) return state

      const [next, ...remaining] = state.future
      return {
        past: [...state.past, state.present],
        present: next,
        future: remaining,
      }
    }

    case 'RESET':
      return {
        past: [],
        present: sanitizeDiagram(action.diagram),
        future: [],
      }

    default:
      return state
  }
}

const DiagramContext = createContext(null)

function DiagramProvider({ children }) {
  const [history, dispatchHistory] = useReducer(historyReducer, undefined, createInitialHistory)

  const apply = useCallback((action, options = {}) => {
    dispatchHistory({ type: 'APPLY', action, record: options.record !== false })
  }, [])

  const undo = useCallback(() => {
    dispatchHistory({ type: 'UNDO' })
  }, [])

  const redo = useCallback(() => {
    dispatchHistory({ type: 'REDO' })
  }, [])

  const reset = useCallback((diagram) => {
    dispatchHistory({ type: 'RESET', diagram })
  }, [])

  const value = useMemo(() => ({
    diagram: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    apply,
    undo,
    redo,
    reset,
  }), [history, apply, undo, redo, reset])

  return <DiagramContext.Provider value={value}>{children}</DiagramContext.Provider>
}

function useDiagram() {
  const context = useContext(DiagramContext)
  if (!context) {
    throw new Error('useDiagram must be used inside DiagramProvider')
  }
  return context
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable
}

function getCardinality(type) {
  if (type === '1:1') {
    return { start: 'one', end: 'one' }
  }
  if (type === '1:N') {
    return { start: 'one', end: 'many' }
  }
  return { start: 'many', end: 'many' }
}

function formatFieldType(field) {
  if (field.length && TYPES_WITH_LENGTH.has(field.type)) {
    return `${field.type}(${field.length})`
  }
  return field.type
}

function formatClassMemberLine(member) {
  const visibility = member.visibility || ''
  if (member.memberKind === 'method') {
    const params = member.params || ''
    const returnType = member.type || 'void'
    return `${visibility}${member.name}(${params}) : ${returnType}`
  }
  return `${visibility}${member.name} : ${member.type || 'Any'}`
}

function escapeSqlIdentifier(name) {
  return `\`${String(name).replace(/`/g, '``')}\``
}

function formatDefaultValue(value, type) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const upper = raw.toUpperCase()
  if (upper === 'NULL' || upper === 'CURRENT_TIMESTAMP') {
    return raw
  }

  if (['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'FLOAT', 'DOUBLE', 'DECIMAL'].includes(type)) {
    return Number.isFinite(Number(raw)) ? raw : `'${raw.replace(/'/g, "''")}'`
  }

  if (type === 'BOOLEAN') {
    if (raw === '1' || raw.toLowerCase() === 'true') return '1'
    if (raw === '0' || raw.toLowerCase() === 'false') return '0'
  }

  return `'${raw.replace(/'/g, "''")}'`
}

function orderTablesByDependencies(tables) {
  const dependencyMap = new Map()
  const incomingCount = new Map()

  for (const table of tables) {
    dependencyMap.set(table.id, new Set())
    incomingCount.set(table.id, 0)
  }

  for (const table of tables) {
    for (const field of table.fields) {
      const refTableId = field.reference?.tableId
      if (!refTableId || refTableId === table.id || !dependencyMap.has(refTableId)) continue

      if (!dependencyMap.get(refTableId).has(table.id)) {
        dependencyMap.get(refTableId).add(table.id)
        incomingCount.set(table.id, incomingCount.get(table.id) + 1)
      }
    }
  }

  const queue = []
  for (const [tableId, count] of incomingCount.entries()) {
    if (count === 0) queue.push(tableId)
  }

  const orderedIds = []
  while (queue.length > 0) {
    const currentId = queue.shift()
    orderedIds.push(currentId)

    for (const dependentId of dependencyMap.get(currentId)) {
      const nextCount = incomingCount.get(dependentId) - 1
      incomingCount.set(dependentId, nextCount)
      if (nextCount === 0) {
        queue.push(dependentId)
      }
    }
  }

  const tableById = new Map(tables.map((table) => [table.id, table]))
  const used = new Set(orderedIds)
  const orderedTables = orderedIds.map((tableId) => tableById.get(tableId)).filter(Boolean)
  const leftovers = tables.filter((table) => !used.has(table.id))

  return [...orderedTables, ...leftovers]
}

function generateSql(diagram) {
  const sqlTables = diagram.tables.filter((table) => table.modelType !== 'class')
  if (sqlTables.length === 0) {
    return '-- No hay tablas ER para exportar en SQL.'
  }

  const orderedTables = orderTablesByDependencies(sqlTables)
  const tableById = new Map(sqlTables.map((table) => [table.id, table]))
  const fieldByKey = new Map()

  for (const table of sqlTables) {
    for (const field of table.fields) {
      fieldByKey.set(`${table.id}:${field.id}`, field)
    }
  }

  const createStatements = orderedTables.map((table) => {
    const lines = []
    const primaryFields = []

    for (const field of table.fields) {
      const parts = [
        escapeSqlIdentifier(normalizeIdentifier(field.name, 'columna')),
        formatFieldType(field),
      ]

      if (field.constraints.notNull || field.constraints.primaryKey || field.constraints.autoIncrement) {
        parts.push('NOT NULL')
      } else {
        parts.push('NULL')
      }

      if (field.constraints.autoIncrement) {
        parts.push('AUTO_INCREMENT')
      }

      if (field.constraints.unique && !field.constraints.primaryKey) {
        parts.push('UNIQUE')
      }

      if (String(field.constraints.defaultValue || '').trim()) {
        parts.push(`DEFAULT ${formatDefaultValue(field.constraints.defaultValue, field.type)}`)
      }

      lines.push(`  ${parts.join(' ')}`)

      if (field.constraints.primaryKey) {
        primaryFields.push(field.name)
      }
    }

    if (primaryFields.length > 0) {
      lines.push(`  PRIMARY KEY (${primaryFields.map((name) => escapeSqlIdentifier(name)).join(', ')})`)
    }

    return `CREATE TABLE ${escapeSqlIdentifier(table.name)} (\n${lines.join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  })

  const alterStatements = []
  const usedConstraintNames = new Set()

  for (const table of orderedTables) {
    for (const field of table.fields) {
      if (!field.constraints.foreignKey || !field.reference) continue

      const referenceTable = tableById.get(field.reference.tableId)
      const referenceField = fieldByKey.get(`${field.reference.tableId}:${field.reference.fieldId}`)
      if (!referenceTable || !referenceField) continue

      const baseConstraintName = `fk_${toSnakeCase(table.name)}_${toSnakeCase(field.name)}`
      let constraintName = baseConstraintName
      let sequence = 2
      while (usedConstraintNames.has(constraintName)) {
        constraintName = `${baseConstraintName}_${sequence}`
        sequence += 1
      }
      usedConstraintNames.add(constraintName)

      alterStatements.push(
        `ALTER TABLE ${escapeSqlIdentifier(table.name)} ADD CONSTRAINT ${escapeSqlIdentifier(constraintName)} FOREIGN KEY (${escapeSqlIdentifier(field.name)}) REFERENCES ${escapeSqlIdentifier(referenceTable.name)} (${escapeSqlIdentifier(referenceField.name)});`,
      )
    }
  }

  const header = [
    '-- SQL generado por Canva MER',
    'SET NAMES utf8mb4;',
    '',
  ]

  return [...header, ...createStatements, '', ...alterStatements].join('\n')
}

function KeyIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="2" />
      <path d="M12.5 8H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 8V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 8V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function Modal({ title, children, onClose, widthClass = 'max-w-5xl' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={onClose}>
      <div
        className={`w-full ${widthClass} rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            Cerrar
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function FieldEditor({ value, onChange }) {
  const constraints = value.constraints

  const updateConstraint = (name, checked) => {
    onChange({
      ...value,
      constraints: {
        ...constraints,
        [name]: checked,
      },
    })
  }

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-700 bg-slate-950/50 p-3 md:grid-cols-12">
      <label className="md:col-span-3">
        <span className="mb-1 block text-xs font-medium text-slate-300">Nombre</span>
        <input
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
        />
      </label>

      <label className="md:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-300">Tipo</span>
        <select
          value={value.type}
          onChange={(event) => onChange({ ...value, type: event.target.value })}
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
        >
          {MYSQL_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <label className="md:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-300">Longitud</span>
        <input
          value={value.length}
          disabled={!TYPES_WITH_LENGTH.has(value.type)}
          onChange={(event) => onChange({ ...value, length: event.target.value })}
          placeholder={TYPES_WITH_LENGTH.has(value.type) ? '255' : '-'}
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
        />
      </label>

      <label className="md:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-300">Default</span>
        <input
          value={constraints.defaultValue}
          onChange={(event) => onChange({
            ...value,
            constraints: {
              ...constraints,
              defaultValue: event.target.value,
            },
          })}
          placeholder="CURRENT_TIMESTAMP"
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
        />
      </label>

      <div className="md:col-span-3 flex flex-wrap gap-2 text-xs text-slate-200">
        <label className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1">
          <input
            type="checkbox"
            checked={constraints.primaryKey}
            onChange={(event) => updateConstraint('primaryKey', event.target.checked)}
          />
          PRIMARY KEY
        </label>
        <label className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1">
          <input
            type="checkbox"
            checked={constraints.foreignKey}
            onChange={(event) => updateConstraint('foreignKey', event.target.checked)}
          />
          FOREIGN KEY
        </label>
        <label className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1">
          <input
            type="checkbox"
            checked={constraints.notNull}
            onChange={(event) => updateConstraint('notNull', event.target.checked)}
          />
          NOT NULL
        </label>
        <label className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1">
          <input
            type="checkbox"
            checked={constraints.unique}
            onChange={(event) => updateConstraint('unique', event.target.checked)}
          />
          UNIQUE
        </label>
        <label className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1">
          <input
            type="checkbox"
            checked={constraints.autoIncrement}
            onChange={(event) => updateConstraint('autoIncrement', event.target.checked)}
          />
          AUTO_INCREMENT
        </label>
      </div>
    </div>
  )
}

function DiagramEditor() {
  const { diagram, canUndo, canRedo, apply, undo, redo, reset } = useDiagram()
  const { tables, relations, diagramType, theme, snapToGrid } = diagram
  const isClassMode = diagramType === 'class'

  const viewportRef = useRef(null)
  const canvasRef = useRef(null)
  const toastTimeoutRef = useRef(null)

  const [viewport, setViewport] = useState({ x: 160, y: 80, zoom: 1 })
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 })
  const [spacePressed, setSpacePressed] = useState(false)

  const [selectedTableIds, setSelectedTableIds] = useState([])
  const [selectedRelationId, setSelectedRelationId] = useState(null)
  const [selectionBox, setSelectionBox] = useState(null)
  const [dragRelation, setDragRelation] = useState(null)

  const [newTableOpen, setNewTableOpen] = useState(false)
  const [fieldModal, setFieldModal] = useState(null)
  const [relationModal, setRelationModal] = useState(null)
  const [mermaidOpen, setMermaidOpen] = useState(false)
  const [mermaidDraft, setMermaidDraft] = useState(MERMAID_ER_SAMPLE)
  const [mermaidImportType, setMermaidImportType] = useState('er')
  const [mermaidError, setMermaidError] = useState('')
  const [sqlOpen, setSqlOpen] = useState(false)
  const [renameState, setRenameState] = useState(null)

  const [toast, setToast] = useState('')

  const [newTableDraft, setNewTableDraft] = useState(() => ({
    name: '',
    count: 3,
    fields: [createFieldDraft(0), createFieldDraft(1), createFieldDraft(2)],
  }))

  const panRef = useRef(null)
  const movingRef = useRef(null)
  const resizeRef = useRef(null)
  const selectionRef = useRef(null)
  const relationRef = useRef(null)

  const tableById = useMemo(
    () => new Map(tables.map((table) => [table.id, table])),
    [tables],
  )

  const selectedTable = selectedTableIds.length === 1 ? tableById.get(selectedTableIds[0]) : null
  const selectedRelation = selectedRelationId
    ? relations.find((relation) => relation.id === selectedRelationId) || null
    : null

  const sqlPreview = useMemo(() => (
    isClassMode
      ? '-- Export SQL disponible solo en modo ER'
      : generateSql(diagram)
  ), [diagram, isClassMode])

  const pushToast = useCallback((message) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }

    setToast(message)
    toastTimeoutRef.current = setTimeout(() => {
      setToast('')
    }, 2200)
  }, [])

  useEffect(() => () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const current = viewportRef.current
    if (!current) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      setViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })

    observer.observe(current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(diagram))
  }, [diagram])

  const screenToWorld = useCallback((clientX, clientY) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }

    return {
      x: (clientX - rect.left - viewport.x) / viewport.zoom,
      y: (clientY - rect.top - viewport.y) / viewport.zoom,
    }
  }, [viewport])

  const worldToScreen = useCallback((point) => ({
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  }), [viewport])

  const normalizeRect = useCallback((start, end) => {
    const x = Math.min(start.x, end.x)
    const y = Math.min(start.y, end.y)
    const width = Math.abs(end.x - start.x)
    const height = Math.abs(end.y - start.y)
    return { x, y, width, height }
  }, [])

  const snapValue = useCallback((value) => {
    if (!snapToGrid) return value
    return Math.round(value / GRID_SIZE) * GRID_SIZE
  }, [snapToGrid])

  const getFieldAnchor = useCallback((table, fieldId, side) => {
    if (table.modelType === 'class') {
      const totalHeight = Math.max(table.height, getMinimumTableHeight(table.fields.length))
      return {
        x: side === 'right' ? table.x + table.width : table.x,
        y: table.y + totalHeight / 2,
      }
    }

    const fieldIndex = table.fields.findIndex((field) => field.id === fieldId)
    const safeIndex = fieldIndex >= 0 ? fieldIndex : 0

    return {
      x: side === 'right' ? table.x + table.width : table.x,
      y: table.y + HEADER_HEIGHT + safeIndex * ROW_HEIGHT + ROW_HEIGHT / 2,
    }
  }, [])

  const relationShapes = useMemo(() => {
    return relations
      .map((relation) => {
        const sourceTable = tableById.get(relation.sourceTableId)
        const targetTable = tableById.get(relation.targetTableId)
        if (!sourceTable || !targetTable) return null

        const sourceAtLeft = sourceTable.x <= targetTable.x
        const sourceSide = sourceAtLeft ? 'right' : 'left'
        const targetSide = sourceAtLeft ? 'left' : 'right'

        const sourceWorld = getFieldAnchor(sourceTable, relation.sourceFieldId, sourceSide)
        const targetWorld = getFieldAnchor(targetTable, relation.targetFieldId, targetSide)

        const source = worldToScreen(sourceWorld)
        const target = worldToScreen(targetWorld)

        const direction = sourceSide === 'right' ? 1 : -1
        const bezierGap = Math.max(60, Math.abs(target.x - source.x) * 0.45)

        const controlOne = {
          x: source.x + bezierGap * direction,
          y: source.y,
        }

        const controlTwo = {
          x: target.x - bezierGap * direction,
          y: target.y,
        }

        const cardinality = getCardinality(relation.type)

        return {
          relation,
          source,
          target,
          path: `M ${source.x} ${source.y} C ${controlOne.x} ${controlOne.y}, ${controlTwo.x} ${controlTwo.y}, ${target.x} ${target.y}`,
          labelPoint: {
            x: (source.x + target.x) / 2,
            y: (source.y + target.y) / 2 - 10,
          },
          sourceLabelPoint: {
            x: source.x + (controlOne.x - source.x) * 0.4,
            y: source.y + (controlOne.y - source.y) * 0.4 - 10,
          },
          targetLabelPoint: {
            x: target.x + (controlTwo.x - target.x) * 0.4,
            y: target.y + (controlTwo.y - target.y) * 0.4 - 10,
          },
          startMarker: cardinality.start === 'one' ? 'marker-one' : 'marker-many',
          endMarker: cardinality.end === 'one' ? 'marker-one' : 'marker-many',
        }
      })
      .filter(Boolean)
  }, [relations, tableById, getFieldAnchor, worldToScreen])

  const selectionScreenRect = useMemo(() => {
    if (!selectionBox) return null

    const topLeft = worldToScreen({ x: selectionBox.x, y: selectionBox.y })
    const bottomRight = worldToScreen({
      x: selectionBox.x + selectionBox.width,
      y: selectionBox.y + selectionBox.height,
    })

    return normalizeRect(topLeft, bottomRight)
  }, [selectionBox, worldToScreen, normalizeRect])

  const minimapData = useMemo(() => {
    const mapWidth = 230
    const mapHeight = 150
    const padding = 12

    if (tables.length === 0) {
      return {
        mapWidth,
        mapHeight,
        padding,
        bounds: {
          minX: 0,
          minY: 0,
          width: 1000,
          height: 700,
        },
      }
    }

    const minX = Math.min(...tables.map((table) => table.x))
    const minY = Math.min(...tables.map((table) => table.y))
    const maxX = Math.max(...tables.map((table) => table.x + table.width))
    const maxY = Math.max(...tables.map((table) => table.y + Math.max(table.height, getMinimumTableHeight(table.fields.length))))

    return {
      mapWidth,
      mapHeight,
      padding,
      bounds: {
        minX: minX - 120,
        minY: minY - 120,
        width: Math.max(300, maxX - minX + 240),
        height: Math.max(200, maxY - minY + 240),
      },
    }
  }, [tables])

  const minimapScale = useMemo(() => {
    const { mapWidth, mapHeight, padding, bounds } = minimapData
    const widthScale = (mapWidth - padding * 2) / bounds.width
    const heightScale = (mapHeight - padding * 2) / bounds.height
    return Math.min(widthScale, heightScale)
  }, [minimapData])

  const viewportRectInWorld = useMemo(() => ({
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
    width: viewportSize.width / viewport.zoom,
    height: viewportSize.height / viewport.zoom,
  }), [viewport, viewportSize])

  const handleWheel = (event) => {
    event.preventDefault()

    if (event.ctrlKey || event.metaKey) {
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return

      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top

      const worldX = (pointerX - viewport.x) / viewport.zoom
      const worldY = (pointerY - viewport.y) / viewport.zoom

      const zoomDelta = Math.exp(-event.deltaY * 0.0018)
      const nextZoom = Math.max(0.2, Math.min(2.8, viewport.zoom * zoomDelta))

      setViewport({
        zoom: nextZoom,
        x: pointerX - worldX * nextZoom,
        y: pointerY - worldY * nextZoom,
      })
      return
    }

    setViewport((previous) => ({
      ...previous,
      x: previous.x - event.deltaX * 0.5,
      y: previous.y - event.deltaY * 0.5,
    }))
  }

  const startCanvasPan = (event) => {
    panRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: viewport.x,
      startY: viewport.y,
    }
  }

  const handleCanvasPointerDown = (event) => {
    if (event.button !== 0 && event.button !== 1) return

    if (event.button === 1 || spacePressed) {
      startCanvasPan(event)
      return
    }

    setSelectedRelationId(null)
    if (!event.shiftKey) {
      setSelectedTableIds([])
    }

    const start = screenToWorld(event.clientX, event.clientY)
    selectionRef.current = {
      start,
      additive: event.shiftKey,
    }
    setSelectionBox({ x: start.x, y: start.y, width: 0, height: 0 })
  }

  const startTableMove = (event, tableId) => {
    if (event.button !== 0) return

    event.stopPropagation()
    setSelectedRelationId(null)

    let movingIds = selectedTableIds.includes(tableId)
      ? selectedTableIds
      : [tableId]

    if (event.shiftKey) {
      const merged = new Set(selectedTableIds)
      merged.add(tableId)
      movingIds = [...merged]
      setSelectedTableIds(movingIds)
    } else if (!selectedTableIds.includes(tableId)) {
      setSelectedTableIds([tableId])
    }

    const start = screenToWorld(event.clientX, event.clientY)
    const initialPositions = {}
    for (const id of movingIds) {
      const table = tableById.get(id)
      if (table) {
        initialPositions[id] = {
          x: table.x,
          y: table.y,
        }
      }
    }

    movingRef.current = {
      ids: movingIds,
      start,
      initialPositions,
      lastPositions: null,
    }
  }

  const startTableResize = (event, table) => {
    event.stopPropagation()
    setSelectedTableIds([table.id])

    resizeRef.current = {
      tableId: table.id,
      start: screenToWorld(event.clientX, event.clientY),
      initialWidth: table.width,
      initialHeight: table.height,
    }
  }

  const startRelationDrag = (event, table, field, side) => {
    event.stopPropagation()
    event.preventDefault()

    const anchor = getFieldAnchor(table, field.id, side)
    relationRef.current = {
      sourceTableId: table.id,
      sourceFieldId: field.id,
      sourcePoint: anchor,
      currentPoint: anchor,
    }

    setDragRelation({ ...relationRef.current })
  }

  useEffect(() => {
    const onPointerMove = (event) => {
      if (panRef.current) {
        const deltaX = event.clientX - panRef.current.startClientX
        const deltaY = event.clientY - panRef.current.startClientY
        setViewport((previous) => ({
          ...previous,
          x: panRef.current.startX + deltaX,
          y: panRef.current.startY + deltaY,
        }))
        return
      }

      if (movingRef.current) {
        const world = screenToWorld(event.clientX, event.clientY)
        const dx = world.x - movingRef.current.start.x
        const dy = world.y - movingRef.current.start.y

        const nextPositions = {}
        for (const id of movingRef.current.ids) {
          const initial = movingRef.current.initialPositions[id]
          if (!initial) continue
          nextPositions[id] = {
            x: snapValue(initial.x + dx),
            y: snapValue(initial.y + dy),
          }
        }

        movingRef.current.lastPositions = nextPositions
        apply({ type: 'SET_TABLE_POSITIONS', positions: nextPositions }, { record: false })
        return
      }

      if (resizeRef.current) {
        const world = screenToWorld(event.clientX, event.clientY)
        const dx = world.x - resizeRef.current.start.x
        const dy = world.y - resizeRef.current.start.y

        apply({
          type: 'RESIZE_TABLE',
          tableId: resizeRef.current.tableId,
          width: snapValue(resizeRef.current.initialWidth + dx),
          height: snapValue(resizeRef.current.initialHeight + dy),
        }, { record: false })
        return
      }

      if (selectionRef.current) {
        const current = screenToWorld(event.clientX, event.clientY)
        setSelectionBox(normalizeRect(selectionRef.current.start, current))
        return
      }

      if (relationRef.current) {
        const currentPoint = screenToWorld(event.clientX, event.clientY)
        relationRef.current = {
          ...relationRef.current,
          currentPoint,
        }
        setDragRelation({ ...relationRef.current })
      }
    }

    const onPointerUp = (event) => {
      if (panRef.current) {
        panRef.current = null
      }

      if (movingRef.current) {
        const finalPositions = movingRef.current.lastPositions
        movingRef.current = null
        if (finalPositions) {
          apply({ type: 'SET_TABLE_POSITIONS', positions: finalPositions })
        }
      }

      if (resizeRef.current) {
        const world = screenToWorld(event.clientX, event.clientY)
        const dx = world.x - resizeRef.current.start.x
        const dy = world.y - resizeRef.current.start.y

        apply({
          type: 'RESIZE_TABLE',
          tableId: resizeRef.current.tableId,
          width: snapValue(resizeRef.current.initialWidth + dx),
          height: snapValue(resizeRef.current.initialHeight + dy),
        })
        resizeRef.current = null
      }

      if (selectionRef.current) {
        const finalRect = selectionBox
        const additive = selectionRef.current.additive
        selectionRef.current = null
        setSelectionBox(null)

        if (finalRect && (finalRect.width > 4 || finalRect.height > 4)) {
          const selected = tables
            .filter((table) => {
              const tableRect = {
                x: table.x,
                y: table.y,
                width: table.width,
                height: Math.max(table.height, getMinimumTableHeight(table.fields.length)),
              }

              const intersects = !(
                finalRect.x > tableRect.x + tableRect.width ||
                finalRect.x + finalRect.width < tableRect.x ||
                finalRect.y > tableRect.y + tableRect.height ||
                finalRect.y + finalRect.height < tableRect.y
              )
              return intersects
            })
            .map((table) => table.id)

          if (additive) {
            const merged = new Set(selectedTableIds)
            selected.forEach((id) => merged.add(id))
            setSelectedTableIds([...merged])
          } else {
            setSelectedTableIds(selected)
          }
        }
      }

      if (relationRef.current) {
        const source = relationRef.current
        relationRef.current = null
        setDragRelation(null)

        const targetElement = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest('[data-field-handle="true"]')

        if (!targetElement) return

        const targetTableId = targetElement.getAttribute('data-table-id')
        const targetFieldId = targetElement.getAttribute('data-field-id')

        if (
          !targetTableId ||
          !targetFieldId ||
          (targetTableId === source.sourceTableId && targetFieldId === source.sourceFieldId)
        ) {
          return
        }

        setRelationModal({
          sourceTableId: source.sourceTableId,
          sourceFieldId: source.sourceFieldId,
          targetTableId,
          targetFieldId,
          relationType: '1:N',
          color: '#0ea5e9',
        })
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [
    apply,
    normalizeRect,
    screenToWorld,
    selectionBox,
    selectedTableIds,
    snapValue,
    tables,
  ])

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }

      if (event.code === 'Space' && !isEditableTarget(event.target)) {
        event.preventDefault()
        setSpacePressed(true)
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && !isEditableTarget(event.target)) {
        if (selectedRelationId) {
          apply({ type: 'DELETE_RELATION', relationId: selectedRelationId })
          setSelectedRelationId(null)
          return
        }

        if (selectedTableIds.length > 0) {
          apply({ type: 'DELETE_TABLES', tableIds: selectedTableIds })
          setSelectedTableIds([])
        }
      }
    }

    const onKeyUp = (event) => {
      if (event.code === 'Space') {
        setSpacePressed(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [apply, redo, selectedRelationId, selectedTableIds, undo])

  const updateNewTableCount = (nextCount) => {
    const parsed = Math.max(1, Math.min(30, Number(nextCount) || 1))

    setNewTableDraft((draft) => {
      const fields = [...draft.fields]
      while (fields.length < parsed) {
        fields.push(createFieldDraft(fields.length))
      }
      while (fields.length > parsed) {
        fields.pop()
      }

      return {
        ...draft,
        count: parsed,
        fields,
      }
    })
  }

  const resetNewTableDraft = () => {
    setNewTableDraft({
      name: '',
      count: 3,
      fields: [createFieldDraft(0), createFieldDraft(1), createFieldDraft(2)],
    })
  }

  const createTableFromModal = () => {
    const centerWorld = {
      x: (-viewport.x + viewportSize.width / 2) / viewport.zoom - 120,
      y: (-viewport.y + viewportSize.height / 2) / viewport.zoom - 80,
    }

    const fields = isClassMode
      ? [
          ...newTableDraft.fields.map((field, index) => ({
            id: createId('fld'),
            name: normalizeIdentifier(field.name, `atributo_${index + 1}`),
            type: field.type || 'String',
            length: '',
            constraints: createEmptyConstraints(),
            reference: null,
            memberKind: 'attribute',
            visibility: '-',
            params: '',
          })),
          {
            id: createId('fld'),
            name: 'toString',
            type: 'String',
            length: '',
            constraints: createEmptyConstraints(),
            reference: null,
            memberKind: 'method',
            visibility: '+',
            params: '',
          },
        ]
      : newTableDraft.fields.map((field, index) => cloneField(field, index))

    const table = createTableFromDraft({
      name: newTableDraft.name,
      fields,
      position: {
        x: snapValue(centerWorld.x),
        y: snapValue(centerWorld.y),
      },
      width: isClassMode ? 320 : 260,
      modelType: isClassMode ? 'class' : 'entity',
    })

    apply({ type: 'ADD_TABLE', table })
    setNewTableOpen(false)
    resetNewTableDraft()
    setSelectedTableIds([table.id])
    pushToast(isClassMode ? 'Clase creada' : 'Tabla creada')
  }

  const saveToLocalStorage = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(diagram))
    pushToast('Diseno guardado en localStorage')
  }

  const loadFromLocalStorage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        pushToast('No hay diseno guardado')
        return
      }
      const loaded = JSON.parse(raw)
      reset(loaded)
      setSelectedTableIds([])
      setSelectedRelationId(null)
      pushToast('Diseno cargado correctamente')
    } catch {
      pushToast('No fue posible cargar el diseno')
    }
  }

  const importFromMermaid = () => {
    try {
      const imported = (mermaidImportType === 'class' ? importMermaidClassToDiagram : importMermaidToDiagram)(mermaidDraft, {
        theme,
        snapToGrid,
      })

      apply({
        type: 'REPLACE_DIAGRAM',
        diagram: imported,
      })

      setViewport({ x: 160, y: 80, zoom: 1 })
      setSelectedTableIds([])
      setSelectedRelationId(null)
      setFieldModal(null)
      setRelationModal(null)
      setMermaidError('')
      setMermaidOpen(false)
      pushToast('Mermaid importado correctamente')
    } catch (error) {
      setMermaidError(error instanceof Error ? error.message : 'No fue posible importar Mermaid')
    }
  }

  const exportPng = async () => {
    if (!canvasRef.current) return

    try {
      const dataUrl = await toPng(canvasRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: theme === 'dark' ? '#020617' : '#f0f9ff',
      })

      const link = document.createElement('a')
      link.download = 'diagrama-er.png'
      link.href = dataUrl
      link.click()
      pushToast('PNG exportado')
    } catch {
      pushToast('No fue posible exportar la imagen')
    }
  }

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(sqlPreview)
      pushToast('SQL copiado al portapapeles')
    } catch {
      pushToast('No fue posible copiar el SQL')
    }
  }

  const downloadSql = () => {
    const blob = new Blob([sqlPreview], { type: 'text/sql;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'schema.sql'
    link.click()
    URL.revokeObjectURL(url)
    pushToast('Archivo SQL descargado')
  }

  const handleMinimapClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top

    const { padding, bounds } = minimapData
    const worldX = bounds.minX + (localX - padding) / minimapScale
    const worldY = bounds.minY + (localY - padding) / minimapScale

    setViewport((previous) => ({
      ...previous,
      x: viewportSize.width / 2 - worldX * previous.zoom,
      y: viewportSize.height / 2 - worldY * previous.zoom,
    }))
  }

  const deleteSelectedTables = () => {
    if (selectedTableIds.length === 0) return
    apply({ type: 'DELETE_TABLES', tableIds: selectedTableIds })
    setSelectedTableIds([])
  }

  return (
    <div className={`relative flex h-screen w-screen flex-col ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-sky-50 text-slate-900'}`}>
      <header className={`z-30 flex flex-wrap items-center gap-2 border-b px-3 py-2 backdrop-blur ${theme === 'dark' ? 'border-slate-800 bg-slate-950/80' : 'border-sky-200 bg-white/80'}`}>
        <button
          type="button"
          onClick={() => setNewTableOpen(true)}
          className="rounded-md bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
        >
          {isClassMode ? 'Nueva clase' : 'Nueva tabla'}
        </button>

        <button
          type="button"
          onClick={saveToLocalStorage}
          className="rounded-md border border-slate-500 px-3 py-1.5 text-sm transition hover:border-cyan-400 hover:text-cyan-300"
        >
          Guardar
        </button>

        <button
          type="button"
          onClick={loadFromLocalStorage}
          className="rounded-md border border-slate-500 px-3 py-1.5 text-sm transition hover:border-cyan-400 hover:text-cyan-300"
        >
          Cargar
        </button>

        <button
          type="button"
          onClick={() => {
            const nextImportType = isClassMode ? 'class' : 'er'
            setMermaidImportType(nextImportType)
            setMermaidDraft(nextImportType === 'class' ? MERMAID_CLASS_SAMPLE : MERMAID_ER_SAMPLE)
            setMermaidOpen(true)
            setMermaidError('')
          }}
          className="rounded-md border border-slate-500 px-3 py-1.5 text-sm transition hover:border-cyan-400 hover:text-cyan-300"
        >
          Importar Mermaid
        </button>xxx

        <button
          type="button"
          onClick={() => apply({ type: 'SET_DIAGRAM_TYPE', diagramType: isClassMode ? 'er' : 'class' })}
          className="rounded-md border border-slate-500 px-3 py-1.5 text-sm transition hover:border-cyan-400 hover:text-cyan-300"
        >
          Modo {isClassMode ? 'ER' : 'Clases'}
        </button>

        <button
          type="button"
          onClick={exportPng}
          className="rounded-md border border-slate-500 px-3 py-1.5 text-sm transition hover:border-cyan-400 hover:text-cyan-300"
        >
          Exportar PNG
        </button>

        <button
          type="button"
          onClick={() => setSqlOpen(true)}
          disabled={isClassMode}
          className="rounded-md border border-slate-500 px-3 py-1.5 text-sm transition enabled:hover:border-cyan-400 enabled:hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Exportar SQL
        </button>

        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          className="rounded-md border border-slate-500 px-3 py-1.5 text-sm transition enabled:hover:border-cyan-400 enabled:hover:text-cyan-300 disabled:opacity-40"
        >
          Undo
        </button>

        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          className="rounded-md border border-slate-500 px-3 py-1.5 text-sm transition enabled:hover:border-cyan-400 enabled:hover:text-cyan-300 disabled:opacity-40"
        >
          Redo
        </button>

        <button
          type="button"
          onClick={() => apply({ type: 'SET_THEME', theme: theme === 'dark' ? 'light' : 'dark' })}
          className="rounded-md border border-slate-500 px-3 py-1.5 text-sm transition hover:border-cyan-400 hover:text-cyan-300"
        >
          Tema {theme === 'dark' ? 'claro' : 'oscuro'}
        </button>

        <label className="inline-flex items-center gap-2 rounded-md border border-slate-500 px-3 py-1.5 text-sm">
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={(event) => apply({ type: 'SET_SNAP', enabled: event.target.checked })}
          />
          Snap to grid
        </label>

        <button
          type="button"
          onClick={deleteSelectedTables}
          className="rounded-md border border-rose-500/60 px-3 py-1.5 text-sm text-rose-300 transition hover:bg-rose-500/10"
        >
          Eliminar seleccion
        </button>

        <div className="ml-auto inline-flex items-center gap-2 rounded-md border border-slate-500 px-2 py-1 text-xs">
          <button
            type="button"
            onClick={() => setViewport((previous) => ({ ...previous, zoom: Math.max(0.2, previous.zoom - 0.1) }))}
            className="rounded bg-slate-800 px-2 py-1 text-slate-200"
          >
            -
          </button>
          <span>{Math.round(viewport.zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setViewport((previous) => ({ ...previous, zoom: Math.min(2.8, previous.zoom + 0.1) }))}
            className="rounded bg-slate-800 px-2 py-1 text-slate-200"
          >
            +
          </button>
        </div>
      </header>

      <main
        ref={viewportRef}
        className="relative flex-1 overflow-hidden"
        onWheel={handleWheel}
        onPointerDown={handleCanvasPointerDown}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: theme === 'dark' ? '#020617' : '#eff6ff',
            backgroundImage: theme === 'dark'
              ? 'radial-gradient(circle at 85% 20%, rgba(14, 116, 144, 0.24), transparent 35%), radial-gradient(circle at 15% 70%, rgba(56, 189, 248, 0.14), transparent 40%), linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px)'
              : 'radial-gradient(circle at 85% 20%, rgba(2, 132, 199, 0.18), transparent 35%), radial-gradient(circle at 10% 75%, rgba(6, 182, 212, 0.16), transparent 35%), linear-gradient(rgba(14, 116, 144, 0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(14, 116, 144, 0.10) 1px, transparent 1px)',
            backgroundSize: `cover, cover, ${GRID_SIZE * viewport.zoom}px ${GRID_SIZE * viewport.zoom}px, ${GRID_SIZE * viewport.zoom}px ${GRID_SIZE * viewport.zoom}px`,
            backgroundPosition: `0 0, 0 0, ${viewport.x}px ${viewport.y}px, ${viewport.x}px ${viewport.y}px`,
          }}
        />

        <div ref={canvasRef} className="absolute inset-0">
          <svg
            className="pointer-events-none absolute inset-0 z-30 h-full w-full"
            width="100%"
            height="100%"
            aria-label="Relaciones"
          >
            <defs>
              <marker
                id="marker-one"
                markerWidth="10"
                markerHeight="12"
                refX="1"
                refY="6"
                orient="auto-start-reverse"
              >
                <path d="M1 1 L1 11" fill="none" stroke="context-stroke" strokeWidth="2" />
              </marker>

              <marker
                id="marker-many"
                markerWidth="12"
                markerHeight="14"
                refX="1"
                refY="7"
                orient="auto-start-reverse"
              >
                <path d="M1 2 L11 7 L1 12 M1 7 L11 7" fill="none" stroke="context-stroke" strokeWidth="1.7" />
              </marker>
            </defs>

            {relationShapes.map(({
              relation,
              path,
              startMarker,
              endMarker,
              labelPoint,
              sourceLabelPoint,
              targetLabelPoint,
            }) => (
              <g key={relation.id}>
                <path
                  d={path}
                  fill="none"
                  stroke={relation.color}
                  strokeWidth={selectedRelationId === relation.id ? 3 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerStart={`url(#${startMarker})`}
                  markerEnd={`url(#${endMarker})`}
                  className="pointer-events-auto cursor-pointer"
                  onMouseDown={(event) => {
                    event.stopPropagation()
                    setSelectedRelationId(relation.id)
                    setSelectedTableIds([])
                  }}
                />
                <rect
                  x={labelPoint.x - 17}
                  y={labelPoint.y - 10}
                  width="34"
                  height="18"
                  rx="6"
                  fill={theme === 'dark' ? '#0f172a' : 'white'}
                  stroke={relation.color}
                  strokeWidth="1"
                />
                <text
                  x={labelPoint.x}
                  y={labelPoint.y + 2}
                  textAnchor="middle"
                  fontSize="10"
                  fill={theme === 'dark' ? '#cbd5e1' : '#0f172a'}
                >
                  {relation.classMeta?.label || relation.type}
                </text>

                {relation.classMeta && (
                  <>
                    <text
                      x={sourceLabelPoint.x}
                      y={sourceLabelPoint.y}
                      textAnchor="middle"
                      fontSize="10"
                      fill={theme === 'dark' ? '#cbd5e1' : '#0f172a'}
                    >
                      {relation.classMeta.sourceMultiplicity}
                    </text>
                    <text
                      x={targetLabelPoint.x}
                      y={targetLabelPoint.y}
                      textAnchor="middle"
                      fontSize="10"
                      fill={theme === 'dark' ? '#cbd5e1' : '#0f172a'}
                    >
                      {relation.classMeta.targetMultiplicity}
                    </text>
                  </>
                )}
              </g>
            ))}

            {dragRelation && (
              <path
                d={`M ${worldToScreen(dragRelation.sourcePoint).x} ${worldToScreen(dragRelation.sourcePoint).y} L ${worldToScreen(dragRelation.currentPoint).x} ${worldToScreen(dragRelation.currentPoint).y}`}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="6 6"
                className="pointer-events-none"
              />
            )}
          </svg>

          <div
            className="absolute inset-0 z-20"
            style={{
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {tables.map((table) => {
              const selected = selectedTableIds.includes(table.id)
              const tableHeight = Math.max(table.height, getMinimumTableHeight(table.fields.length))
              const classNode = table.modelType === 'class'
              const anchorField = table.fields[0] || null
              const attributes = classNode
                ? table.fields.filter((field) => field.memberKind !== 'method')
                : []
              const methods = classNode
                ? table.fields.filter((field) => field.memberKind === 'method')
                : []

              return (
                <div
                  key={table.id}
                  className={`absolute rounded-xl border shadow-xl transition ${selected ? 'ring-2 ring-cyan-300' : ''}`}
                  style={{
                    left: table.x,
                    top: table.y,
                    width: table.width,
                    height: tableHeight,
                    borderColor: selected ? '#67e8f9' : '#94a3b8',
                    background: table.colors.body,
                    color: table.colors.text,
                  }}
                  onMouseDown={(event) => {
                    event.stopPropagation()
                    setSelectedRelationId(null)
                    if (event.shiftKey) {
                      setSelectedTableIds((previous) => {
                        const next = new Set(previous)
                        if (next.has(table.id)) {
                          next.delete(table.id)
                        } else {
                          next.add(table.id)
                        }
                        return [...next]
                      })
                    } else if (!selected) {
                      setSelectedTableIds([table.id])
                    }
                  }}
                >
                  <div
                    className="flex h-11 items-center justify-between rounded-t-xl px-3 text-sm font-semibold"
                    style={{
                      background: table.colors.header,
                      color: '#ffffff',
                    }}
                    onPointerDown={(event) => startTableMove(event, table.id)}
                  >
                    {renameState?.tableId === table.id ? (
                      <input
                        value={renameState.value}
                        autoFocus
                        onChange={(event) => setRenameState({ tableId: table.id, value: event.target.value })}
                        onBlur={() => {
                          apply({ type: 'RENAME_TABLE', tableId: table.id, name: renameState.value })
                          setRenameState(null)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            apply({ type: 'RENAME_TABLE', tableId: table.id, name: renameState.value })
                            setRenameState(null)
                          }
                          if (event.key === 'Escape') {
                            setRenameState(null)
                          }
                        }}
                        className="w-full rounded bg-black/20 px-2 py-1 text-xs text-white outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        className="truncate text-left"
                        onDoubleClick={(event) => {
                          event.stopPropagation()
                          setRenameState({ tableId: table.id, value: table.name })
                        }}
                      >
                        {table.name}
                      </button>
                    )}

                    <div className="flex items-center gap-1">
                      {!classNode && (
                        <button
                          type="button"
                          className="rounded bg-black/20 px-1.5 py-0.5 text-xs"
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={() => apply({ type: 'ADD_FIELD', tableId: table.id, field: createFieldDraft(table.fields.length) })}
                        >
                          + campo
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded bg-black/20 px-1.5 py-0.5 text-xs"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          apply({ type: 'DELETE_TABLE', tableId: table.id })
                          setSelectedTableIds((previous) => previous.filter((id) => id !== table.id))
                        }}
                      >
                        x
                      </button>
                    </div>
                  </div>

                  <div className="h-[calc(100%-44px)] overflow-y-auto px-2 py-1">
                    {classNode ? (
                      <div className="space-y-2 p-1 text-xs">
                        <div className="rounded-md border border-slate-400/70 bg-white/70 p-2">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Atributos</div>
                          {(attributes.length > 0 ? attributes : []).map((member) => (
                            <div key={member.id} className="font-mono-ui truncate py-0.5 text-[11px]">
                              {formatClassMemberLine(member)}
                            </div>
                          ))}
                          {attributes.length === 0 && (
                            <div className="font-mono-ui text-[11px] text-slate-500">(sin atributos)</div>
                          )}
                        </div>

                        <div className="rounded-md border border-slate-400/70 bg-white/70 p-2">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Metodos</div>
                          {(methods.length > 0 ? methods : []).map((member) => (
                            <div key={member.id} className="font-mono-ui truncate py-0.5 text-[11px]">
                              {formatClassMemberLine(member)}
                            </div>
                          ))}
                          {methods.length === 0 && (
                            <div className="font-mono-ui text-[11px] text-slate-500">(sin metodos)</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      table.fields.map((field) => {
                        const badges = []
                        if (field.constraints.primaryKey) badges.push('PK')
                        if (field.constraints.foreignKey) badges.push('FK')
                        if (field.constraints.notNull) badges.push('NN')
                        if (field.constraints.unique) badges.push('UQ')
                        if (field.constraints.autoIncrement) badges.push('AI')

                        return (
                          <div
                            key={field.id}
                            className="group relative flex min-h-[30px] items-center gap-2 rounded-md px-1 py-1 text-xs transition hover:bg-slate-200/70"
                            onDoubleClick={() => setFieldModal({ tableId: table.id, fieldId: field.id, draft: cloneField(field) })}
                            style={{ color: table.colors.text }}
                          >
                            <button
                              type="button"
                              data-field-handle="true"
                              data-table-id={table.id}
                              data-field-id={field.id}
                              onPointerDown={(event) => startRelationDrag(event, table, field, 'left')}
                              className="h-3.5 w-3.5 shrink-0 rounded-full border border-cyan-300 bg-cyan-500/70"
                              title="Crear relacion"
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

                            <button
                              type="button"
                              className="rounded border border-rose-400 px-1 py-0.5 text-[10px] text-rose-600 opacity-0 transition group-hover:opacity-100"
                              onClick={() => {
                                if (table.fields.length <= 1) {
                                  pushToast('La tabla debe conservar al menos un campo')
                                  return
                                }
                                apply({ type: 'DELETE_FIELD', tableId: table.id, fieldId: field.id })
                              }}
                            >
                              del
                            </button>

                            <button
                              type="button"
                              data-field-handle="true"
                              data-table-id={table.id}
                              data-field-id={field.id}
                              onPointerDown={(event) => startRelationDrag(event, table, field, 'right')}
                              className="h-3.5 w-3.5 shrink-0 rounded-full border border-cyan-300 bg-cyan-500/70"
                              title="Crear relacion"
                            />
                          </div>
                        )
                      })
                    )}
                  </div>

                  {classNode && anchorField && (
                    <>
                      <button
                        type="button"
                        data-field-handle="true"
                        data-table-id={table.id}
                        data-field-id={anchorField.id}
                        onPointerDown={(event) => startRelationDrag(event, table, anchorField, 'left')}
                        className="absolute left-[-7px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-cyan-300 bg-cyan-500/80"
                        title="Conectar clase"
                      />
                      <button
                        type="button"
                        data-field-handle="true"
                        data-table-id={table.id}
                        data-field-id={anchorField.id}
                        onPointerDown={(event) => startRelationDrag(event, table, anchorField, 'right')}
                        className="absolute right-[-7px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-cyan-300 bg-cyan-500/80"
                        title="Conectar clase"
                      />
                    </>
                  )}

                  <button
                    type="button"
                    className="absolute bottom-1 right-1 h-3.5 w-3.5 cursor-se-resize rounded-sm border border-slate-500 bg-slate-700/60"
                    onPointerDown={(event) => startTableResize(event, table)}
                    title="Redimensionar"
                  />
                </div>
              )
            })}
          </div>

          {selectionScreenRect && (
            <div
              className="pointer-events-none absolute z-30 border border-cyan-300 bg-cyan-400/20"
              style={{
                left: selectionScreenRect.x,
                top: selectionScreenRect.y,
                width: selectionScreenRect.width,
                height: selectionScreenRect.height,
              }}
            />
          )}
        </div>

        <div
          className="absolute bottom-3 right-3 z-40 rounded-xl border border-slate-700 bg-slate-900/90 p-2 shadow-2xl"
          style={{ width: minimapData.mapWidth, height: minimapData.mapHeight }}
          onPointerDown={handleMinimapClick}
        >
          <svg width={minimapData.mapWidth - 4} height={minimapData.mapHeight - 4}>
            <rect
              x="1"
              y="1"
              width={minimapData.mapWidth - 6}
              height={minimapData.mapHeight - 6}
              fill="#020617"
              stroke="#334155"
              rx="8"
            />

            {tables.map((table) => {
              const x = minimapData.padding + (table.x - minimapData.bounds.minX) * minimapScale
              const y = minimapData.padding + (table.y - minimapData.bounds.minY) * minimapScale
              const width = Math.max(8, table.width * minimapScale)
              const height = Math.max(7, Math.max(table.height, getMinimumTableHeight(table.fields.length)) * minimapScale)

              return (
                <rect
                  key={table.id}
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill={selectedTableIds.includes(table.id) ? '#22d3ee' : '#38bdf8'}
                  opacity={selectedTableIds.includes(table.id) ? 0.9 : 0.6}
                  rx="2"
                />
              )
            })}

            <rect
              x={minimapData.padding + (viewportRectInWorld.x - minimapData.bounds.minX) * minimapScale}
              y={minimapData.padding + (viewportRectInWorld.y - minimapData.bounds.minY) * minimapScale}
              width={Math.max(12, viewportRectInWorld.width * minimapScale)}
              height={Math.max(12, viewportRectInWorld.height * minimapScale)}
              fill="rgba(148, 163, 184, 0.15)"
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          </svg>
        </div>

        {selectedTable && (
          <aside className="absolute right-3 top-3 z-40 w-64 rounded-xl border border-slate-700 bg-slate-900/90 p-3 shadow-2xl">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">Personalizar tabla</h3>

            <label className="mb-2 block text-xs text-slate-300">
              Header
              <input
                type="color"
                value={selectedTable.colors.header}
                onChange={(event) => apply({
                  type: 'UPDATE_TABLE_COLORS',
                  tableId: selectedTable.id,
                  colors: { header: event.target.value },
                })}
                className="mt-1 h-8 w-full rounded border border-slate-600 bg-transparent"
              />
            </label>

            <label className="mb-2 block text-xs text-slate-300">
              Body
              <input
                type="color"
                value={selectedTable.colors.body}
                onChange={(event) => apply({
                  type: 'UPDATE_TABLE_COLORS',
                  tableId: selectedTable.id,
                  colors: { body: event.target.value },
                })}
                className="mt-1 h-8 w-full rounded border border-slate-600 bg-transparent"
              />
            </label>

            <label className="block text-xs text-slate-300">
              Texto
              <input
                type="color"
                value={selectedTable.colors.text}
                onChange={(event) => apply({
                  type: 'UPDATE_TABLE_COLORS',
                  tableId: selectedTable.id,
                  colors: { text: event.target.value },
                })}
                className="mt-1 h-8 w-full rounded border border-slate-600 bg-transparent"
              />
            </label>
          </aside>
        )}

        {selectedRelation && (
          <aside className="absolute left-3 top-3 z-40 w-56 rounded-xl border border-slate-700 bg-slate-900/90 p-3 shadow-2xl">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">Personalizar relacion</h3>
            <label className="block text-xs text-slate-300">
              Color de linea
              <input
                type="color"
                value={selectedRelation.color}
                onChange={(event) => apply({ type: 'UPDATE_RELATION_COLOR', relationId: selectedRelation.id, color: event.target.value })}
                className="mt-1 h-8 w-full rounded border border-slate-600 bg-transparent"
              />
            </label>

            <button
              type="button"
              onClick={() => {
                apply({ type: 'DELETE_RELATION', relationId: selectedRelation.id })
                setSelectedRelationId(null)
              }}
              className="mt-3 w-full rounded-md border border-rose-500/60 px-3 py-1.5 text-xs text-rose-300 transition hover:bg-rose-500/10"
            >
              Eliminar relacion
            </button>
          </aside>
        )}
      </main>

      {toast && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-950/90 px-4 py-2 text-sm text-slate-100 shadow-xl">
          {toast}
        </div>
      )}

      {newTableOpen && (
        <Modal title={isClassMode ? 'Nueva clase' : 'Nueva tabla'} onClose={() => setNewTableOpen(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label>
                <span className="mb-1 block text-sm text-slate-300">{isClassMode ? 'Nombre de la clase' : 'Nombre de la tabla'}</span>
                <input
                  value={newTableDraft.name}
                  onChange={(event) => setNewTableDraft((draft) => ({ ...draft, name: event.target.value }))}
                  placeholder={isClassMode ? 'Paciente' : 'usuarios'}
                  className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm text-slate-300">{isClassMode ? 'Cantidad de miembros base' : 'Cantidad de campos'}</span>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={newTableDraft.count}
                  onChange={(event) => updateNewTableCount(event.target.value)}
                  className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                />
              </label>
            </div>

            <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
              {newTableDraft.fields.map((field, index) => (
                <FieldEditor
                  key={field.id}
                  value={field}
                  onChange={(nextField) => {
                    setNewTableDraft((draft) => ({
                      ...draft,
                      fields: draft.fields.map((item, fieldIndex) => (
                        fieldIndex === index ? nextField : item
                      )),
                    }))
                  }}
                />
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewTableOpen(false)
                  resetNewTableDraft()
                }}
                className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={createTableFromModal}
                className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
              >
                {isClassMode ? 'Crear clase' : 'Crear tabla'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {fieldModal && (
        <Modal
          title="Editar campo"
          onClose={() => setFieldModal(null)}
          widthClass="max-w-3xl"
        >
          <div className="space-y-4">
            <FieldEditor
              value={fieldModal.draft}
              onChange={(draft) => setFieldModal((current) => ({ ...current, draft }))}
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFieldModal(null)}
                className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  apply({
                    type: 'UPDATE_FIELD',
                    tableId: fieldModal.tableId,
                    fieldId: fieldModal.fieldId,
                    field: fieldModal.draft,
                  })
                  setFieldModal(null)
                }}
                className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </Modal>
      )}

      {relationModal && (
        <Modal
          title="Crear relacion"
          onClose={() => setRelationModal(null)}
          widthClass="max-w-lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label>
                <span className="mb-1 block text-sm text-slate-300">Tipo</span>
                <select
                  value={relationModal.relationType}
                  onChange={(event) => setRelationModal((current) => ({ ...current, relationType: event.target.value }))}
                  className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                >
                  {relationOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1 block text-sm text-slate-300">Color</span>
                <input
                  type="color"
                  value={relationModal.color}
                  onChange={(event) => setRelationModal((current) => ({ ...current, color: event.target.value }))}
                  className="h-10 w-full rounded-md border border-slate-600 bg-transparent"
                />
              </label>
            </div>

            <p className="text-xs text-slate-400">
              {isClassMode
                ? 'En modo clases se crea una asociacion UML sin tabla pivote.'
                : 'N:M crea automaticamente una tabla intermedia con llaves foraneas.'}
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRelationModal(null)}
                className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  apply({
                    type: 'ADD_RELATION',
                    payload: relationModal,
                  })
                  setRelationModal(null)
                }}
                className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
              >
                Crear relacion
              </button>
            </div>
          </div>
        </Modal>
      )}

      {mermaidOpen && (
        <Modal
          title={`Importar Mermaid ${mermaidImportType === 'class' ? 'Class Diagram' : 'ER Diagram'}`}
          onClose={() => setMermaidOpen(false)}
          widthClass="max-w-4xl"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setMermaidImportType('er')
                  setMermaidDraft(MERMAID_ER_SAMPLE)
                  setMermaidError('')
                }}
                className={`rounded-md border px-3 py-1.5 text-xs ${mermaidImportType === 'er' ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-slate-600 text-slate-300'}`}
              >
                ER Diagram
              </button>
              <button
                type="button"
                onClick={() => {
                  setMermaidImportType('class')
                  setMermaidDraft(MERMAID_CLASS_SAMPLE)
                  setMermaidError('')
                }}
                className={`rounded-md border px-3 py-1.5 text-xs ${mermaidImportType === 'class' ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-slate-600 text-slate-300'}`}
              >
                Class Diagram
              </button>
            </div>

            <p className="text-sm text-slate-300">
              {mermaidImportType === 'class'
                ? <>Pega un bloque de clases Mermaid. Se reemplazara el diagrama actual y podras deshacer con Undo.</>
                : <>Pega un bloque <span className="font-mono-ui">erDiagram</span>. Se reemplazara el diagrama actual y podras deshacer con Undo.</>}
            </p>

            <textarea
              value={mermaidDraft}
              onChange={(event) => setMermaidDraft(event.target.value)}
              className="font-mono-ui h-[52vh] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-xs leading-5 text-slate-200 outline-none focus:border-cyan-400"
              placeholder={mermaidImportType === 'class'
                ? 'class Paciente {\n  -String cedula\n  +getEdad() int\n}'
                : 'erDiagram\n  usuarios {\n    int id PK\n  }'}
            />

            {mermaidError && (
              <div className="rounded-md border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {mermaidError}
              </div>
            )}

            <div className="flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() => setMermaidDraft(mermaidImportType === 'class' ? MERMAID_CLASS_SAMPLE : MERMAID_ER_SAMPLE)}
                className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-300"
              >
                Cargar ejemplo
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMermaidOpen(false)}
                  className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={importFromMermaid}
                  className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
                >
                  Importar
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {sqlOpen && (
        <Modal title="Vista previa SQL" onClose={() => setSqlOpen(false)} widthClass="max-w-4xl">
          <div className="space-y-4">
            <textarea
              readOnly
              value={sqlPreview}
              className="font-mono-ui h-[56vh] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-xs leading-5 text-slate-200 outline-none"
            />

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={copySql}
                className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-300"
              >
                Copiar SQL
              </button>

              <button
                type="button"
                onClick={downloadSql}
                className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
              >
                Descargar .sql
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function App() {
  return (
    <DiagramProvider>
      <DiagramEditor />
    </DiagramProvider>
  )
}

export default App
