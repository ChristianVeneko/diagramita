export const GRID_SIZE = 24
export const HEADER_HEIGHT = 44
export const ROW_HEIGHT = 34
export const TABLE_MIN_WIDTH = 220
export const TABLE_MIN_HEIGHT = 120
export const MAX_HISTORY = 100
export const STORAGE_KEY = 'er-diagram-workspace-v1'

export const MYSQL_TYPES = [
  'INT', 'BIGINT', 'SMALLINT', 'TINYINT',
  'VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT',
  'DATE', 'DATETIME', 'TIMESTAMP', 'TIME',
  'FLOAT', 'DOUBLE', 'DECIMAL',
  'BOOLEAN', 'BLOB', 'ENUM', 'JSON',
]

export const TYPES_WITH_LENGTH = new Set([
  'INT', 'BIGINT', 'SMALLINT', 'TINYINT',
  'VARCHAR', 'CHAR', 'FLOAT', 'DOUBLE', 'DECIMAL', 'ENUM',
])

export const RELATION_OPTIONS = ['1:1', '1:N', 'N:M']

export const MERMAID_ER_SAMPLE = `erDiagram
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

export const MERMAID_CLASS_SAMPLE = `class Medico {
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

export const SHORTCUTS = [
  { keys: 'Ctrl + Z', description: 'Deshacer' },
  { keys: 'Ctrl + Shift + Z', description: 'Rehacer' },
  { keys: 'Ctrl + C', description: 'Copiar tablas seleccionadas' },
  { keys: 'Ctrl + V', description: 'Pegar tablas' },
  { keys: 'Ctrl + A', description: 'Seleccionar todo' },
  { keys: 'Del / Backspace', description: 'Eliminar selección' },
  { keys: 'F', description: 'Ajustar vista (fit to view)' },
  { keys: 'Espacio + arrastrar', description: 'Mover canvas (pan)' },
  { keys: 'Scroll', description: 'Desplazar canvas' },
  { keys: 'Ctrl + Scroll', description: 'Zoom in/out' },
  { keys: 'Shift + clic', description: 'Selección múltiple' },
  { keys: 'Doble clic (header)', description: 'Renombrar tabla' },
  { keys: 'Doble clic (campo)', description: 'Editar campo' },
  { keys: '?', description: 'Mostrar atajos de teclado' },
]
