export const TEMPLATES = [
  {
    id: 'ecommerce',
    name: 'E-Commerce',
    description: 'Tienda online: productos, pedidos, usuarios y pagos',
    type: 'er',
    mermaid: `erDiagram
  usuarios {
    int id PK
    varchar(120) email UNIQUE
    varchar(80) nombre
    varchar(200) direccion
    varchar(20) telefono
    datetime creado_en
  }
  categorias {
    int id PK
    varchar(80) nombre
    int padre_id FK
  }
  productos {
    int id PK
    int categoria_id FK
    varchar(140) nombre
    text descripcion
    decimal(10,2) precio
    int stock
    boolean activo
  }
  pedidos {
    int id PK
    int usuario_id FK
    varchar(20) estado
    decimal(10,2) total
    datetime creado_en
  }
  pedido_items {
    int id PK
    int pedido_id FK
    int producto_id FK
    int cantidad
    decimal(10,2) precio_unitario
  }
  pagos {
    int id PK
    int pedido_id FK
    varchar(30) metodo
    varchar(20) estado
    decimal(10,2) monto
    datetime fecha
  }
  usuarios ||--o{ pedidos : realiza
  pedidos ||--o{ pedido_items : contiene
  productos ||--o{ pedido_items : aparece_en
  pedidos ||--o{ pagos : tiene
  categorias ||--o{ productos : clasifica`,
  },
  {
    id: 'blog',
    name: 'Blog / CMS',
    description: 'Sistema de publicación con posts, comentarios y tags',
    type: 'er',
    mermaid: `erDiagram
  usuarios {
    int id PK
    varchar(80) nombre
    varchar(120) email UNIQUE
    varchar(200) bio
    datetime creado_en
  }
  posts {
    int id PK
    int autor_id FK
    varchar(200) titulo
    text contenido
    varchar(200) slug UNIQUE
    varchar(20) estado
    datetime publicado_en
    datetime creado_en
  }
  comentarios {
    int id PK
    int post_id FK
    int usuario_id FK
    text contenido
    datetime creado_en
  }
  categorias {
    int id PK
    varchar(80) nombre
    varchar(80) slug UNIQUE
  }
  tags {
    int id PK
    varchar(60) nombre
    varchar(60) slug UNIQUE
  }
  post_categorias {
    int post_id FK
    int categoria_id FK
  }
  post_tags {
    int post_id FK
    int tag_id FK
  }
  usuarios ||--o{ posts : escribe
  posts ||--o{ comentarios : recibe
  usuarios ||--o{ comentarios : escribe
  posts }o--o{ categorias : pertenece_a
  posts }o--o{ tags : etiquetado_con`,
  },
  {
    id: 'auth',
    name: 'Autenticación / RBAC',
    description: 'Usuarios, roles y permisos con control de acceso',
    type: 'er',
    mermaid: `erDiagram
  usuarios {
    int id PK
    varchar(120) email UNIQUE
    varchar(200) password_hash
    boolean activo
    datetime ultimo_login
    datetime creado_en
  }
  sesiones {
    int id PK
    int usuario_id FK
    varchar(64) token UNIQUE
    varchar(45) ip
    datetime expira_en
    datetime creado_en
  }
  roles {
    int id PK
    varchar(50) nombre UNIQUE
    text descripcion
  }
  permisos {
    int id PK
    varchar(80) nombre UNIQUE
    varchar(80) recurso
    varchar(20) accion
  }
  usuario_roles {
    int usuario_id FK
    int rol_id FK
  }
  rol_permisos {
    int rol_id FK
    int permiso_id FK
  }
  usuarios ||--o{ sesiones : tiene
  usuarios }o--o{ roles : asignado_a
  roles }o--o{ permisos : otorga`,
  },
  {
    id: 'universidad',
    name: 'Universidad',
    description: 'Alumnos, materias, profesores e inscripciones',
    type: 'er',
    mermaid: `erDiagram
  alumnos {
    int id PK
    varchar(20) legajo UNIQUE
    varchar(80) nombre
    varchar(80) apellido
    varchar(120) email UNIQUE
    date fecha_nacimiento
    datetime creado_en
  }
  profesores {
    int id PK
    varchar(80) nombre
    varchar(80) apellido
    varchar(120) email UNIQUE
    varchar(80) especialidad
  }
  materias {
    int id PK
    varchar(120) nombre
    varchar(10) codigo UNIQUE
    int creditos
    int profesor_id FK
  }
  cursos {
    int id PK
    int materia_id FK
    int anio
    int cuatrimestre
    int capacidad
  }
  inscripciones {
    int id PK
    int alumno_id FK
    int curso_id FK
    varchar(20) estado
    datetime fecha
  }
  notas {
    int id PK
    int inscripcion_id FK
    decimal(4,2) valor
    varchar(30) tipo
    datetime fecha
  }
  profesores ||--o{ materias : dicta
  materias ||--o{ cursos : tiene
  alumnos ||--o{ inscripciones : realiza
  cursos ||--o{ inscripciones : tiene
  inscripciones ||--o{ notas : recibe`,
  },
  {
    id: 'inventario',
    name: 'Inventario',
    description: 'Productos, almacenes, stock y movimientos',
    type: 'er',
    mermaid: `erDiagram
  proveedores {
    int id PK
    varchar(120) nombre
    varchar(120) email
    varchar(200) direccion
    varchar(20) telefono
  }
  productos {
    int id PK
    int proveedor_id FK
    varchar(140) nombre
    varchar(30) sku UNIQUE
    varchar(50) unidad
    decimal(10,2) precio_costo
  }
  almacenes {
    int id PK
    varchar(80) nombre
    varchar(200) ubicacion
    boolean activo
  }
  stock {
    int id PK
    int producto_id FK
    int almacen_id FK
    int cantidad
    int minimo
    int maximo
  }
  movimientos {
    int id PK
    int producto_id FK
    int almacen_id FK
    varchar(20) tipo
    int cantidad
    text motivo
    datetime fecha
  }
  proveedores ||--o{ productos : suministra
  productos ||--o{ stock : almacenado_en
  almacenes ||--o{ stock : contiene
  productos ||--o{ movimientos : registra
  almacenes ||--o{ movimientos : origen`,
  },
]
