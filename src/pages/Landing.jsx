import { useNavigate } from 'react-router-dom'

const FEATURES = [
  {
    title: 'ER y UML en el mismo canvas',
    desc: 'Cambiá entre modo entidad-relación y diagrama de clases sin perder el trabajo. Cada modo tiene sus propias reglas de relaciones.',
  },
  {
    title: 'Relaciones N:M con tabla pivote',
    desc: 'Creás la relación y la tabla intermedia aparece sola — con sus dos FKs ya conectadas.',
  },
  {
    title: 'Importá desde Mermaid',
    desc: 'Pegás el bloque erDiagram o classDiagram y los nodos se distribuyen automáticamente con Dagre. Sin reordenar a mano.',
  },
  {
    title: 'SQL listo para usar',
    desc: 'Genera CREATE TABLE con ALTER TABLE para las FK, ordenados por dependencias. Lo copiás o descargás como .sql.',
  },
  {
    title: 'Historial de 100 pasos',
    desc: 'Ctrl+Z y Ctrl+Y sobre cualquier cambio — agregar tablas, mover nodos, editar campos. Nada se pierde.',
  },
  {
    title: 'Exportar como imagen',
    desc: 'PNG de alta resolución que captura el diagrama completo, sin importar cuánto hayas hecho zoom out.',
  },
]

const CODE_SAMPLE = `erDiagram
  usuarios {
    int id PK
    string email
    string nombre
  }
  pedidos {
    int id PK
    int usuario_id FK
    decimal total
  }
  usuarios ||--o{ pedidos : "hace"`

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {/* Nav */}
      <nav className="border-b border-slate-800/60 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-tight text-white">Diagramita</span>
            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">beta</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/editor')}
            className="rounded-lg bg-cyan-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-cyan-500"
          >
            Abrir editor
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-16">
        <div className="max-w-2xl">
          <p className="mb-4 font-mono text-sm text-cyan-400">Editor de esquemas · 100% en el browser</p>
          <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Diseñá tu base de datos<br />sin salir del browser
          </h1>
          <p className="mb-8 text-base text-slate-400 leading-relaxed">
            Arrastrá tablas, conectá campos, importá Mermaid y exportá el SQL listo para correr.
            Sin cuenta, sin instalación, sin pérdida de datos.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/editor')}
              className="rounded-lg bg-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-500"
            >
              Empezar gratis →
            </button>
            <a
              href="https://mermaid.js.org/syntax/entityRelationshipDiagram.html"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-slate-700 px-6 py-2.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Sintaxis Mermaid
            </a>
          </div>
        </div>
      </section>

      {/* Split demo */}
      <section className="border-t border-slate-800/60 bg-slate-900/40">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
          {/* Code side */}
          <div>
            <p className="mb-3 text-xs font-mono uppercase tracking-widest text-slate-500">Input — Mermaid</p>
            <pre className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-950 px-5 py-4 text-[13px] leading-6 text-slate-300 font-mono">
              {CODE_SAMPLE}
            </pre>
          </div>

          {/* Visual side */}
          <div>
            <p className="mb-3 mt-8 text-xs font-mono uppercase tracking-widest text-slate-500 lg:mt-0">Output — Canvas visual</p>
            <MiniCanvas />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="mb-10 text-xl font-semibold text-slate-200">Qué incluye</h2>
        <div className="grid grid-cols-1 gap-px border border-slate-800 rounded-xl overflow-hidden sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ title, desc }) => (
            <div key={title} className="bg-slate-900 p-6 hover:bg-slate-800/60 transition">
              <h3 className="mb-2 text-sm font-semibold text-slate-100">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Templates row */}
      <section className="border-t border-slate-800/60 bg-slate-900/40 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-xs font-mono uppercase tracking-widest text-slate-500">Plantillas incluidas</p>
          <div className="flex flex-wrap gap-2">
            {['E-Commerce', 'Blog', 'Autenticación', 'Universidad', 'Inventario'].map((t) => (
              <span key={t} className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">
                {t}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Abrí el editor, hacé clic en <span className="font-mono text-slate-300">Plantillas</span> y en dos segundos tenés un esquema funcional para empezar.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800/60 px-6 py-20 text-center">
        <h2 className="mb-3 text-2xl font-bold">Sin registro. Sin pasos extra.</h2>
        <p className="mb-8 text-slate-400 text-sm">Abrís el editor y ya estás diseñando.</p>
        <button
          type="button"
          onClick={() => navigate('/editor')}
          className="rounded-lg bg-cyan-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-500"
        >
          Abrir Diagramita →
        </button>
      </section>

      <footer className="border-t border-slate-800/60 px-6 py-6 text-center text-xs text-slate-600">
        Diagramita — React + Tailwind + Dagre · Sin tracking · Sin backend
      </footer>
    </div>
  )
}

function MiniCanvas() {
  const tables = [
    { name: 'usuarios', x: 16, y: 20, fields: ['id PK', 'email', 'nombre'], color: '#0f766e' },
    { name: 'pedidos', x: 220, y: 20, fields: ['id PK', 'usuario_id FK', 'total'], color: '#1e3a8a' },
  ]
  return (
    <div className="relative h-52 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 select-none">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <svg className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">
        <defs>
          <marker id="arr2" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M1 1 L7 4 L1 7" fill="none" stroke="#0ea5e9" strokeWidth="1.5" />
          </marker>
        </defs>
        <path d="M 172 44 C 196 44, 196 44, 220 44" fill="none" stroke="#0ea5e9" strokeWidth="1.5" markerEnd="url(#arr2)" />
      </svg>
      {tables.map((t) => (
        <div
          key={t.name}
          className="absolute w-40 rounded-lg overflow-hidden border border-slate-600 shadow-md"
          style={{ left: t.x, top: t.y }}
        >
          <div className="px-3 py-1.5 text-xs font-semibold text-white" style={{ background: t.color }}>
            {t.name}
          </div>
          <div className="bg-slate-800 divide-y divide-slate-700/50">
            {t.fields.map((f) => (
              <div key={f} className="px-3 py-1 text-[11px] font-mono text-slate-300">
                {f}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="absolute bottom-3 right-3 rounded bg-slate-800/80 px-2 py-1 text-[10px] font-mono text-slate-500">
        canvas
      </div>
    </div>
  )
}
