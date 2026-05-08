# Diagramita

Editor de diagramas entidad-relación y de clases UML en el browser. Sin cuenta, sin instalación, sin backend.

## Qué hace

- Arrastrá, conectá y editá tablas directo en el canvas
- Dos modos: **ER** (entidad-relación, MySQL) y **UML de clases**
- Relaciones 1:1, 1:N y N:M — las N:M crean la tabla pivote automáticamente
- Importá diagramas Mermaid (`erDiagram` o `classDiagram`) con auto-layout vía Dagre
- Exportá SQL (`CREATE TABLE` + `ALTER TABLE` ordenados por dependencias) o PNG de alta resolución
- Historial de 100 pasos (Ctrl+Z / Ctrl+Y)
- Copy/paste de tablas (Ctrl+C / Ctrl+V)
- 5 plantillas listas: E-Commerce, Blog, Autenticación, Universidad, Inventario
- Modo oscuro por defecto — paleta personalizable por tabla
- Minimap y fit-to-view
- 100% client-side — los datos se guardan en localStorage

## Stack

- React 19 + Vite
- Tailwind CSS v4
- `@dagrejs/dagre` — auto-layout
- `html-to-image` — exportar PNG
- `react-router-dom` — routing con HashRouter

## Desarrollo

```bash
npm install
npm run dev       # localhost:5173
npm run build
npm run lint
```

## Estructura

```
src/
  constants.js          # Constantes globales
  lib/                  # Utilidades puras (sin React)
    diagram.js          # Helpers de datos
    mermaid.js          # Parser de Mermaid
    sql.js              # Generador de SQL
    layout.js           # Auto-layout con Dagre
  store/                # Estado global
    reducer.js
    DiagramContext.jsx
  data/
    templates.js        # Plantillas Mermaid
  components/           # Componentes UI
  pages/
    Landing.jsx
    Editor.jsx
```
