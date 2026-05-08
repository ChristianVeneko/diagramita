# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite)
npm run build      # Production build
npm run lint       # Run ESLint
npm run preview    # Preview production build locally
```

No test runner is configured.

## Architecture

This is a browser-based ER and UML class diagram editor. The entire application lives in **`src/App.jsx`** (~2000+ lines) as a single-file architecture — there are intentionally no separate component files.

### State management

State uses a **custom two-layer reducer** (no Zustand or external state library despite it being installed):

- `historyReducer` — wraps `diagramReducer` to provide undo/redo with a 100-step cap (`past[]`, `present`, `future[]`)
- `diagramReducer` — handles all diagram mutations via action types like `ADD_TABLE`, `UPDATE_FIELD`, `ADD_RELATION`, `REPLACE_DIAGRAM`, etc.
- `DiagramContext` + `DiagramProvider` expose `{ diagram, canUndo, canRedo, apply, undo, redo, reset }` to the whole tree
- `apply(action, { record: false })` skips history (used for drag position updates)

Diagram state auto-persists to `localStorage` under the key `'er-diagram-workspace-v1'` on every change.

### Diagram modes

Two modes share the same data structures:
- **ER mode** (`diagramType: 'er'`) — MySQL-typed entity tables with FK/PK constraints
- **Class mode** (`diagramType: 'class'`) — UML classes with attributes and methods (`memberKind: 'attribute' | 'method'`, `visibility`, `params`)

### Core data shapes

**Table**: `{ id, name, x, y, width, height, isPivot, modelType: 'entity'|'class', colors: { header, body, text }, fields[] }`

**Field**: `{ id, name, type, length, constraints: { primaryKey, foreignKey, notNull, unique, autoIncrement, defaultValue }, reference: { tableId, fieldId } | null, memberKind, visibility, params }`

**Relation**: `{ id, sourceTableId, sourceFieldId, targetTableId, targetFieldId, type: '1:1'|'1:N'|'N:M', color, classMeta?: { sourceMultiplicity, targetMultiplicity, label } }`

N:M relations in ER mode auto-create a pivot table with composite FK fields.

### Import / export

- **Mermaid import**: `importMermaidToDiagram()` (ER) and `importMermaidClassToDiagram()` (class) parse Mermaid syntax into diagram state
- **SQL export**: `generateSql()` emits MySQL DDL ordered by FK dependencies (topological sort via `orderTablesByDependencies`)
- **PNG export**: Uses `html-to-image`'s `toPng` on the canvas DOM node

### Canvas / viewport

The diagram uses a **custom pan/zoom viewport** (not a library) with `screenToWorld` / `worldToScreen` coordinate transforms. Tables are positioned as absolutely-placed HTML divs; relations are drawn as SVG paths overlaid on the canvas. Grid snapping uses a 24px (`GRID_SIZE`) grid.

### Utilities

`src/lib/utils.js` exports `cn()` (clsx + tailwind-merge) and `generateId()`. The app uses its own `createId(prefix)` instead of `generateId()`.

`sanitizeDiagram()` is a defensive normalizer — run on every import and on load from localStorage to guarantee shape correctness.
