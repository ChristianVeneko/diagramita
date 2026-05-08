export function RelationLayer({ relationShapes, dragRelation, worldToScreen, selectedRelationId, onSelectRelation, theme }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-30 h-full w-full"
      width="100%"
      height="100%"
      aria-label="Relaciones"
    >
      <defs>
        <marker id="marker-one" markerWidth="10" markerHeight="12" refX="1" refY="6" orient="auto-start-reverse">
          <path d="M1 1 L1 11" fill="none" stroke="context-stroke" strokeWidth="2" />
        </marker>
        <marker id="marker-many" markerWidth="12" markerHeight="14" refX="1" refY="7" orient="auto-start-reverse">
          <path d="M1 2 L11 7 L1 12 M1 7 L11 7" fill="none" stroke="context-stroke" strokeWidth="1.7" />
        </marker>
      </defs>

      {relationShapes.map(({ relation, path, startMarker, endMarker, labelPoint, sourceLabelPoint, targetLabelPoint }) => (
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
            onMouseDown={(e) => { e.stopPropagation(); onSelectRelation(relation.id) }}
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
      ))}

      {dragRelation && (
        <path
          d={`M ${worldToScreen(dragRelation.sourcePoint).x} ${worldToScreen(dragRelation.sourcePoint).y} L ${worldToScreen(dragRelation.currentPoint).x} ${worldToScreen(dragRelation.currentPoint).y}`}
          fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="6 6"
          className="pointer-events-none"
        />
      )}
    </svg>
  )
}
