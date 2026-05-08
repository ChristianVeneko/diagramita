export function RelationLayer({ relationShapes, dragRelation, worldToScreen, selectedRelationId, onSelectRelation, theme, zoom }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-30 h-full w-full"
      width="100%"
      height="100%"
      aria-label="Relaciones"
    >
      {relationShapes.map(({ relation, path, startMarker, endMarker, labelPoint, sourceLabelPoint, targetLabelPoint }) => {
        const isSelected = selectedRelationId === relation.id
        const sw = isSelected ? 2.5 : 1.5
        // Markers scale with zoom so they stay visually proportional to the diagram
        const mW = 10 * zoom
        const mH = 16 * zoom
        const oneId = `mo-${relation.id}`
        const manyId = `mm-${relation.id}`

        return (
          <g key={relation.id}>
            <defs>
              {/* Single bar — "one" end of the relation */}
              <marker
                id={oneId}
                viewBox="0 0 10 16"
                markerWidth={mW}
                markerHeight={mH}
                refX={8}
                refY={8}
                orient="auto-start-reverse"
                markerUnits="userSpaceOnUse"
              >
                <path d="M 8 1 L 8 15" fill="none" stroke={relation.color} strokeWidth="1.5" strokeLinecap="round" />
              </marker>
              {/* Crow's foot — "many" end of the relation */}
              <marker
                id={manyId}
                viewBox="0 0 10 16"
                markerWidth={mW}
                markerHeight={mH}
                refX={8}
                refY={8}
                orient="auto-start-reverse"
                markerUnits="userSpaceOnUse"
              >
                <path d="M 8 1 L 1 8 L 8 15 M 1 8 L 8 8" fill="none" stroke={relation.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>

            {/* Wider invisible hit area for easier clicking */}
            <path
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              className="pointer-events-auto cursor-pointer"
              onMouseDown={(e) => { e.stopPropagation(); onSelectRelation(relation.id) }}
            />

            <path
              d={path}
              fill="none"
              stroke={relation.color}
              strokeWidth={sw}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerStart={`url(#${startMarker === 'marker-one' ? oneId : manyId})`}
              markerEnd={`url(#${endMarker === 'marker-one' ? oneId : manyId})`}
              className="pointer-events-none"
            />

            <rect
              x={labelPoint.x - 17} y={labelPoint.y - 10} width="34" height="18" rx="6"
              fill={theme === 'dark' ? '#0f172a' : 'white'}
              stroke={relation.color} strokeWidth="1"
            />
            <text x={labelPoint.x} y={labelPoint.y + 2} textAnchor="middle" fontSize="10" fill={theme === 'dark' ? '#cbd5e1' : '#0f172a'}>
              {relation.classMeta?.label || relation.type}
            </text>
            {relation.classMeta && (
              <>
                <text x={sourceLabelPoint.x} y={sourceLabelPoint.y} textAnchor="middle" fontSize="10" fill={theme === 'dark' ? '#cbd5e1' : '#0f172a'}>
                  {relation.classMeta.sourceMultiplicity}
                </text>
                <text x={targetLabelPoint.x} y={targetLabelPoint.y} textAnchor="middle" fontSize="10" fill={theme === 'dark' ? '#cbd5e1' : '#0f172a'}>
                  {relation.classMeta.targetMultiplicity}
                </text>
              </>
            )}
          </g>
        )
      })}

      {dragRelation && (
        <path
          d={`M ${worldToScreen(dragRelation.sourcePoint).x} ${worldToScreen(dragRelation.sourcePoint).y} L ${worldToScreen(dragRelation.currentPoint).x} ${worldToScreen(dragRelation.currentPoint).y}`}
          fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="6 6"
          className="pointer-events-none"
        />
      )}
    </svg>
  )
}
