import { useNavigate } from 'react-router-dom'

const FEATURES = [
  { icon: '⚡', title: 'Visual & intuitivo', desc: 'Arrastrá, conectá y editá tablas directo en el canvas. Sin código, sin configuración.' },
  { icon: '🔗', title: 'Relaciones automáticas', desc: '1:1, 1:N y N:M. Las relaciones N:M crean la tabla pivote automáticamente.' },
  { icon: '📐', title: 'Auto-layout con Dagre', desc: 'Importá cualquier diagrama Mermaid y los nodos se acomodan solos.' },
  { icon: '🎨', title: 'Colores personalizables', desc: 'Cada tabla tiene su paleta. Header, body y texto editables en tiempo real.' },
  { icon: '📤', title: 'Exportar SQL y PNG', desc: 'Generá el CREATE TABLE con FKs ordenadas por dependencia. O exportá como imagen.' },
  { icon: '↩', title: 'Historial ilimitado', desc: 'Undo/Redo con 100 pasos. Nunca pierdas un cambio.' },
  { icon: '📋', title: 'Copy & Paste', desc: 'Seleccioná múltiples tablas, copiá y pegá con Ctrl+C / Ctrl+V.' },
  { icon: '🧩', title: 'Plantillas listas', desc: 'E-Commerce, Blog, Auth, Universidad e Inventario para arrancar en segundos.' },
]

const DEMO_TABLES = [
  { name: 'usuarios', color: '#0f766e', fields: ['id PK', 'email', 'nombre', 'creado_en'] },
  { name: 'pedidos', color: '#0f766e', fields: ['id PK', 'usuario_id FK', 'total', 'estado'] },
  { name: 'productos', color: '#5b4abf', fields: ['id PK', 'nombre', 'precio', 'stock'] },
]

function DemoCanvas() {
  return (
    <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
      <div className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.07) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <svg className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">
        <path d="M 232 72 C 280 72, 280 112, 328 112" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeDasharray="0" markerEnd="url(#arr)" />
        <path d="M 232 108 C 330 108, 330 112, 520 112" fill="none" stroke="#0ea5e9" strokeWidth="2" />
        <defs>
          <marker id="arr" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto-start-reverse">
            <path d="M1 1 L7 4 L1 7" fill="none" stroke="#0ea5e9" strokeWidth="1.5" />
          </marker>
        </defs>
      </svg>
      <div className="absolute left-8 top-8 flex gap-8">
        {DEMO_TABLES.map((t) => (
          <div key={t.name} className="w-36 rounded-xl border border-slate-600 shadow-lg overflow-hidden">
            <div className="px-3 py-2 text-xs font-bold text-white" style={{ background: t.color }}>{t.name}</div>
            <div className="bg-slate-800 px-3 py-1">
              {t.fields.map((f) => (
                <div key={f} className="py-0.5 text-[10px] text-slate-300 font-mono">{f}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Nav */}
      <nav className="border-b border-slate-800 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-cyan-400">Diagramita</span>
            <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-300">beta</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/editor')}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
          >
            Abrir editor
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-300">
          Diagramas ER y UML en el browser
        </div>
        <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight md:text-6xl">
          Diseñá tu base de datos{' '}
          <span className="bg-gradient-to-r from-cyan-400 to-sky-400 bg-clip-text text-transparent">
            visualmente
          </span>
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-400 leading-relaxed">
          Editor de diagramas entidad-relación y de clases UML. Importá Mermaid, exportá SQL,
          arrastrá tablas y construí tu esquema sin salir del browser.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/editor')}
            className="rounded-xl bg-cyan-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-500 hover:shadow-cyan-400/30"
          >
            Empezar gratis →
          </button>
          <a
            href="https://mermaid.js.org/syntax/entityRelationshipDiagram.html"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-slate-700 px-8 py-3.5 text-base text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Ver sintaxis Mermaid
          </a>
        </div>
      </section>

      {/* Demo */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <DemoCanvas />
      </section>

      {/* Features */}
      <section className="border-t border-slate-800 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-bold">Todo lo que necesitás</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-slate-700">
                <div className="mb-3 text-3xl">{icon}</div>
                <h3 className="mb-2 font-semibold text-slate-100">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA bottom */}
      <section className="border-t border-slate-800 px-6 py-20 text-center">
        <h2 className="mb-4 text-3xl font-bold">Listo para diseñar</h2>
        <p className="mb-8 text-slate-400">Sin registro, sin instalación. 100% en el browser.</p>
        <button
          type="button"
          onClick={() => navigate('/editor')}
          className="rounded-xl bg-cyan-600 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-500"
        >
          Abrir Diagramita →
        </button>
      </section>

      <footer className="border-t border-slate-800 px-6 py-8 text-center text-sm text-slate-500">
        Diagramita — hecho con React + Tailwind + Dagre
      </footer>
    </div>
  )
}
