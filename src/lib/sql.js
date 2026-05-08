import { toSnakeCase, escapeSqlIdentifier, normalizeIdentifier, formatFieldType, formatDefaultValue } from './diagram.js'

function orderTablesByDependencies(tables) {
  const depMap = new Map()
  const inCount = new Map()
  for (const t of tables) { depMap.set(t.id, new Set()); inCount.set(t.id, 0) }
  for (const t of tables) {
    for (const f of t.fields) {
      const refId = f.reference?.tableId
      if (!refId || refId === t.id || !depMap.has(refId)) continue
      if (!depMap.get(refId).has(t.id)) {
        depMap.get(refId).add(t.id)
        inCount.set(t.id, inCount.get(t.id) + 1)
      }
    }
  }
  const queue = [...inCount.entries()].filter(([, c]) => c === 0).map(([id]) => id)
  const ordered = []
  while (queue.length > 0) {
    const cur = queue.shift()
    ordered.push(cur)
    for (const dep of depMap.get(cur)) {
      const next = inCount.get(dep) - 1
      inCount.set(dep, next)
      if (next === 0) queue.push(dep)
    }
  }
  const byId = new Map(tables.map((t) => [t.id, t]))
  const used = new Set(ordered)
  return [...ordered.map((id) => byId.get(id)).filter(Boolean), ...tables.filter((t) => !used.has(t.id))]
}

export function generateSql(diagram) {
  const sqlTables = diagram.tables.filter((t) => t.modelType !== 'class')
  if (sqlTables.length === 0) return '-- No hay tablas ER para exportar en SQL.'

  const ordered = orderTablesByDependencies(sqlTables)
  const tableById = new Map(sqlTables.map((t) => [t.id, t]))
  const fieldByKey = new Map()
  for (const t of sqlTables) for (const f of t.fields) fieldByKey.set(`${t.id}:${f.id}`, f)

  const creates = ordered.map((table) => {
    const lines = []
    const pks = []
    for (const f of table.fields) {
      const parts = [escapeSqlIdentifier(normalizeIdentifier(f.name, 'columna')), formatFieldType(f)]
      if (f.constraints.notNull || f.constraints.primaryKey || f.constraints.autoIncrement) parts.push('NOT NULL')
      else parts.push('NULL')
      if (f.constraints.autoIncrement) parts.push('AUTO_INCREMENT')
      if (f.constraints.unique && !f.constraints.primaryKey) parts.push('UNIQUE')
      if (String(f.constraints.defaultValue || '').trim()) parts.push(`DEFAULT ${formatDefaultValue(f.constraints.defaultValue, f.type)}`)
      lines.push(`  ${parts.join(' ')}`)
      if (f.constraints.primaryKey) pks.push(f.name)
    }
    if (pks.length > 0) lines.push(`  PRIMARY KEY (${pks.map((n) => escapeSqlIdentifier(n)).join(', ')})`)
    return `CREATE TABLE ${escapeSqlIdentifier(table.name)} (\n${lines.join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  })

  const alters = []
  const usedNames = new Set()
  for (const t of ordered) {
    for (const f of t.fields) {
      if (!f.constraints.foreignKey || !f.reference) continue
      const refTable = tableById.get(f.reference.tableId)
      const refField = fieldByKey.get(`${f.reference.tableId}:${f.reference.fieldId}`)
      if (!refTable || !refField) continue
      const base = `fk_${toSnakeCase(t.name)}_${toSnakeCase(f.name)}`
      let name = base
      let seq = 2
      while (usedNames.has(name)) { name = `${base}_${seq}`; seq++ }
      usedNames.add(name)
      alters.push(`ALTER TABLE ${escapeSqlIdentifier(t.name)} ADD CONSTRAINT ${escapeSqlIdentifier(name)} FOREIGN KEY (${escapeSqlIdentifier(f.name)}) REFERENCES ${escapeSqlIdentifier(refTable.name)} (${escapeSqlIdentifier(refField.name)});`)
    }
  }

  return ['-- SQL generado por Diagramita', 'SET NAMES utf8mb4;', '', ...creates, '', ...alters].join('\n')
}
