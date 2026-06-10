import { Link } from 'react-router-dom'

const FEATURES = [
  {
    icon: '🔬',
    title: 'Dependency Graph',
    body: 'Interactive D3 force graph showing every import and call edge in your codebase. Zoom, drag, and filter by language.',
  },
  {
    icon: '📊',
    title: 'Quality Metrics',
    body: 'Cyclomatic complexity, lines of code, maintainability index, and a single quality score from 0–100.',
  },
  {
    icon: '🤖',
    title: 'AI Insights',
    body: 'Architecture summary, quality assessment, and concrete refactoring recommendations — powered by Llama 3.1 via Groq.',
  },
  {
    icon: '🧩',
    title: 'Pattern Detection',
    body: 'Automatically spots Singleton, Factory, Repository, Observer, and Decorator patterns with confidence scores.',
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* Nav */}
      <nav className="border-b border-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔬</span>
          <span className="font-bold tracking-tight">
            Code<span className="text-primary">Autopsy</span>
          </span>
        </div>
        <Link
          to="/login"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign in →
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-2xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-medium px-3 py-1 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Free — runs on Groq + Llama 3.1
          </div>

          <h1 className="text-5xl font-bold tracking-tight mb-4 leading-tight">
            Understand any
            <br />
            <span className="text-primary">GitHub repo</span> in minutes
          </h1>

          <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-lg mx-auto">
            Paste a URL. Get an interactive dependency graph, code quality
            metrics, detected design patterns, and AI-generated architectural
            insights — no setup required.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link
              to="/login"
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
            >
              Get Started Free
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="bg-secondary text-secondary-foreground px-6 py-2.5 rounded-lg font-medium hover:bg-secondary/70 transition-colors text-sm border border-border"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </main>

      {/* Feature grid */}
      <section className="max-w-4xl mx-auto w-full px-6 pb-20">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
            >
              <span className="text-2xl block mb-3">{f.icon}</span>
              <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-8 py-4 text-center text-xs text-muted-foreground">
        CodeAutopsy — built with FastAPI, React, D3, and Groq
      </footer>
    </div>
  )
}
