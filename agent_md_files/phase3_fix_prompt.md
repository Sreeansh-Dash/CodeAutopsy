# CodeAutopsy — Phase 3 Corrective Prompt
# The CSS variable foundation is missing. Fix that first — it will repair
# ALL pages at once. Then replace Landing and improve the visual polish.
# DO NOT touch any backend files or any Phase 1/2 service files.
---

## ROOT CAUSE

Every component written in Phase 3 uses Tailwind utility classes that map to
CSS custom properties: `bg-card`, `border-border`, `text-muted-foreground`,
`bg-secondary`, `bg-primary`, etc. These classes only work when two things
are true:
1. `tailwind.config.js` maps color names to CSS variable references
2. `index.css` actually declares those CSS variables

Neither was done. Fix both before touching anything else.

---

## FIX 1 — REPLACE frontend/tailwind.config.js

Replace the entire file:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}
```

---

## FIX 2 — REPLACE frontend/src/index.css

Replace the entire file:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ── Design tokens ─────────────────────────────────────────────── */
:root {
  /* Dark theme — these values power every bg-*, text-*, border-* class */
  --background:          240 12%  6%;    /* #0c0c10  near-black canvas      */
  --foreground:          220 15% 90%;    /* #e1e3ea  near-white text         */

  --card:                240 10%  9%;    /* #131318  slightly lifted surface */
  --card-foreground:     220 15% 90%;

  --popover:             240 10% 10%;
  --popover-foreground:  220 15% 90%;

  --primary:             258 80% 66%;    /* #7c4dff  vivid purple            */
  --primary-foreground:    0  0% 100%;

  --secondary:           240  8% 14%;    /* #1c1c24  button / input bg       */
  --secondary-foreground:220 12% 70%;

  --muted:               240  8% 14%;
  --muted-foreground:    220  8% 50%;    /* #747482  subdued labels          */

  --accent:              258 40% 22%;    /* #2d1f5c  hover highlight         */
  --accent-foreground:   220 15% 90%;

  --destructive:           0 62% 50%;
  --destructive-foreground:0  0% 100%;

  --border:              240  8% 18%;    /* #242432  subtle dividers         */
  --input:               240  8% 14%;
  --ring:                258 80% 66%;

  --radius:              0.5rem;
}

/* ── Base resets ───────────────────────────────────────────────── */
* {
  box-sizing: border-box;
  border-color: hsl(var(--border));
}

html,
body,
#root {
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Remove default link decoration inside components */
a {
  color: inherit;
  text-decoration: none;
}

/* Thin, themed scrollbar */
::-webkit-scrollbar        { width: 6px; height: 6px; }
::-webkit-scrollbar-track  { background: transparent; }
::-webkit-scrollbar-thumb  { background: hsl(var(--border)); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground)); }
```

---

## FIX 3 — REPLACE frontend/src/pages/Landing.jsx

The current landing page is nearly empty. Replace the whole file:

```jsx
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
```

---

## FIX 4 — REPLACE frontend/src/pages/Login.jsx

The login form is functional but visually bare. Replace the whole file:

```jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import client from '../api/client'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [mode, setMode] = useState('login')          // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register'
      const res = await client.post(endpoint, { email, password })
      login(res.data.user, res.data.access_token, res.data.refresh_token)
      navigate('/dashboard')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* Minimal nav */}
      <nav className="px-8 py-4 flex items-center">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <span>🔬</span>
          <span className="font-bold text-sm">
            Code<span className="text-primary">Autopsy</span>
          </span>
        </Link>
      </nav>

      {/* Form card */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl">
            <h1 className="text-xl font-bold mb-1">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {mode === 'login'
                ? 'Sign in to your CodeAutopsy account'
                : 'Start analyzing repos for free'}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 transition-shadow"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 transition-shadow"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading
                  ? 'Please wait…'
                  : mode === 'login'
                  ? 'Sign in'
                  : 'Create account'}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
                className="text-primary hover:underline font-medium"
              >
                {mode === 'login' ? 'Register' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

> **Note:** This replaces Login.jsx since it was Phase 1 code and needs the design update.
> The logic is identical — same endpoints, same authStore calls.

---

## FIX 5 — Groq connection error (separate issue)

The `[Groq error: Connection error.]` showing in the Insights panel means the
`GROQ_API_KEY` in your `.env` is missing or invalid. This is not a code bug.

Check it:
```bash
# Inside the running backend container
docker compose exec backend env | grep GROQ
```

If it's empty, add your key to `.env`:
```
GROQ_API_KEY=gsk_your_actual_key_here
LLM_PROVIDER=groq
```

Then restart:
```bash
docker compose restart backend
```

Get a free key at https://console.groq.com (no credit card needed).
While waiting, you can set `LLM_PROVIDER=mock` to see placeholder text instead of errors.

---

## VERIFY

```bash
# Rebuild frontend (only frontend changed)
docker compose up frontend --build -d
```

Open http://localhost:5173 — you should now see:
- Landing: dark hero with purple accent, feature grid
- Login/Register: card with labeled inputs, themed button
- Dashboard: properly bordered cards with language dots and quality badges
- Analysis: 3-column layout with styled file tree, visible graph toolbar,
  and right panel with readable contrast
