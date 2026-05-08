import dagre from '@dagrejs/dagre'
import { GRID_SIZE, HEADER_HEIGHT, ROW_HEIGHT } from '../constants.js'
import { getMinimumTableHeight } from './diagram.js'

function snap(val) {
  return Math.round(val / GRID_SIZE) * GRID_SIZE
}

export function applyAutoLayout(diagram, direction = 'LR') {
  if (diagram.tables.length === 0) return diagram

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: direction, nodesep: 80, ranksep: 160, marginx: 100, marginy: 100 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const table of diagram.tables) {
    const h = Math.max(table.height, getMinimumTableHeight(table.fields.length))
    g.setNode(table.id, { width: table.width, height: h })
  }

  const addedEdges = new Set()
  for (const rel of diagram.relations) {
    if (rel.sourceTableId === rel.targetTableId) continue
    const key = `${rel.sourceTableId}=>${rel.targetTableId}`
    if (addedEdges.has(key)) continue
    if (!g.hasNode(rel.sourceTableId) || !g.hasNode(rel.targetTableId)) continue
    g.setEdge(rel.sourceTableId, rel.targetTableId)
    addedEdges.add(key)
  }

  dagre.layout(g)

  const tables = diagram.tables.map((table) => {
    const node = g.node(table.id)
    if (!node) return table
    return {
      ...table,
      x: Math.max(0, snap(Math.round(node.x - table.width / 2))),
      y: Math.max(0, snap(Math.round(node.y - node.height / 2))),
    }
  })

  return { ...diagram, tables }
}
