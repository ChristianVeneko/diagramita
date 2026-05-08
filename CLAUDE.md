# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite, localhost:5173)
npm run build      # Production build
npm run lint       # ESLint
npm run preview    # Preview production build
```

No test runner is configured.

## Architecture

Browser-based ER and UML class diagram editor. React 19 + Vite + Tailwind. No backend, no auth. State persists to `localStorage` only.

### Routing

`HashRouter` (`src/App.jsx`): `/` → Landing page, `/#/editor` → Editor (wrapped in `DiagramProvider`).

### State management

`src/store/DiagramContext.jsx` + `src/store/reducer.js`:
- `historyReducer` wraps `diagramReducer` — provides undo/redo with 100-step cap (`past[]`, `present`, `future[]`)
- Context exposes `{ diagram, canUndo, canRedo, apply, undo, redo, reset }`
- `apply(action, { record: false })` skips history — used for drag position updates to avoid polluting undo stack
- Auto-persists to `localStorage` key `'er-diagram-workspace-v1'` on every change

### Diagram modes

Two modes share the same data structures:
- **ER mode** (`diagramType: 'er'`) — MySQL-typed entity tables with FK/PK constraints
- **Class mode** (`diagramType: 'class'`) — UML classes; fields carry `memberKind: 'attribute'|'method'`, `visibility`, `params`

N:M relations in ER mode auto-create a pivot table with two FK fields.

### Core data shapes

**Table**: `{ id, name, x, y, width, height, isPivot, modelType: 'entity'|'class', colors: { header, body, text }, fields[] }`

**Field**: `{ id, name, type, length, constraints: { primaryKey, foreignKey, notNull, unique, autoIncrement, defaultValue }, reference: { tableId, fieldId } | null, memberKind, visibility, params }`

**Relation**: `{ id, sourceTableId, sourceFieldId, targetTableId, targetFieldId, type: '1:1'|'1:N'|'N:M', color, classMeta?: { sourceMultiplicity, targetMultiplicity, label } }`

### File map

```
src/
  constants.js          — GRID_SIZE, STORAGE_KEY, MYSQL_TYPES, MERMAID samples, SHORTCUTS
  lib/
    diagram.js          — Pure data utilities: createId, sanitizeDiagram, normalizeIdentifier, etc.
    mermaid.js          — importMermaidToDiagram / importMermaidClassToDiagram
    sql.js              — generateSql (topological sort by FK deps → MySQL DDL)
    layout.js           — applyAutoLayout (dagre, LR direction)
  store/
    reducer.js          — diagramReducer, historyReducer, addRelationReducer
    DiagramContext.jsx  — DiagramProvider + useDiagram hook
  data/
    templates.js        — 5 Mermaid-string templates (E-Commerce, Blog, Auth, etc.)
  components/
    Modal.jsx, FieldEditor.jsx, TableNode.jsx, RelationLayer.jsx
    Minimap.jsx, ColorPanel.jsx, RelationPanel.jsx
    Toolbar.jsx, ShortcutsPanel.jsx, TemplatesPanel.jsx
    modals/             — NewTableModal, FieldModal, RelationModal, MermaidModal, SqlModal
  pages/
    Landing.jsx         — Marketing landing page
    Editor.jsx          — Main editor (~600 lines): all viewport state, drag handlers, keyboard shortcuts
```

### Canvas / viewport

Custom pan/zoom (no library). `screenToWorld` / `worldToScreen` transforms. Tables are absolutely-positioned HTML divs; relations are SVG paths overlaid on the canvas. Grid snapping: 24px (`GRID_SIZE`).

Native `wheel` event listener added via `useEffect` with `{ passive: false }` to allow `preventDefault` — React's synthetic `onWheel` is passive in React 19.

### PNG export

`exportPng` in `Editor.jsx` temporarily adjusts the viewport to a high zoom covering the full diagram bounding box, waits two `rAF` for React to re-render, captures with `toPng` (html-to-image), then restores the previous viewport.

### Key invariants

- `sanitizeDiagram()` (in `lib/diagram.js`) is the canonical normalizer — run on every import and on load from localStorage. Default theme is `'dark'`.
- `isEditableTarget()` guards keyboard shortcuts so they don't fire inside `<input>` / `<textarea>` / `contenteditable`.
- Copy/paste uses internal clipboard state (not OS clipboard) — remaps all IDs via `tableIdMap` + `fieldIdMap`.
