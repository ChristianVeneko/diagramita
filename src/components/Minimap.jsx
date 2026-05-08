export function Minimap({ minimapData, minimapScale, tables, viewportRectInWorld, onPointerDown, getMinimumTableHeight }) {
  const { mapWidth, mapHeight, padding, bounds } = minimapData

  return (
    <div
      className="absolute bottom-3 right-3 z-40 rounded-xl border border-slate-700 bg-slate-900/90 p-2 shadow-2xl cursor-crosshair"
      style={{ width: mapWidth, height: mapHeight }}
      onPointerDown={onPointerDown}
    >
      <svg width={mapWidth - 4} height={mapHeight - 4}>
        <rect x="1" y="1" width={mapWidth - 6} height={mapHeight - 6} fill="#020617" stroke="#334155" rx="8" />

        {tables.map((table) => {
          const x = padding + (table.x - bounds.minX) * minimapScale
          const y = padding + (table.y - bounds.minY) * minimapScale
          const w = Math.max(4, table.width * minimapScale)
          const h = Math.max(4, Math.max(table.height, getMinimumTableHeight(table.fields.length)) * minimapScale)
          return (
            <rect key={table.id} x={x} y={y} width={w} height={h} rx="2"
              fill={table.colors?.header || '#0f766e'} opacity="0.8" />
          )
        })}

        <rect
          x={padding + (viewportRectInWorld.x - bounds.minX) * minimapScale}
          y={padding + (viewportRectInWorld.y - bounds.minY) * minimapScale}
          width={Math.max(12, viewportRectInWorld.width * minimapScale)}
          height={Math.max(12, viewportRectInWorld.height * minimapScale)}
          fill="rgba(148,163,184,0.15)" stroke="#e2e8f0" strokeWidth="1"
        />
      </svg>
    </div>
  )
}
