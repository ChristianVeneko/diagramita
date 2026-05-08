# Canva MER

Editor visual tipo Canva para crear diagramas ER y de clases con React + Tailwind.

## Scripts

- `npm run dev`: inicia el entorno de desarrollo.
- `npm run build`: genera build de produccion.
- `npm run lint`: ejecuta ESLint.

## Funcionalidades principales

- Canvas interactivo con zoom, pan y grid.
- Creacion de tablas con campos MySQL y constraints.
- Edicion de campos por doble clic.
- Drag and drop de tablas, resize y seleccion multiple.
- Relaciones 1:1, 1:N y N:M (con tabla pivote automatica).
- Personalizacion de colores por tabla y relaciones.
- Tema claro/oscuro.
- Exportacion SQL (vista previa, copiar y descargar).
- Importacion de diagramas desde Mermaid ER y Class Diagram.
- Opcion de modo Clases con visualizacion UML (atributos y metodos).
- Exportacion de diagrama a PNG.
- Guardado/carga via localStorage.
- Minimap para diagramas grandes.
- Undo/Redo con `Ctrl+Z` y `Ctrl+Shift+Z`.

## Stack

- React (SPA)
- React hooks (`useState`, `useReducer`, `useContext`)
- SVG + HTML/CSS para render custom del diagrama
- Tailwind CSS
