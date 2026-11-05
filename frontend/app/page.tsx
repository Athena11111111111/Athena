'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Database,
  FileText,
  Gauge,
  Menu,
  Moon,
  Network,
  Search,
  ShieldCheck,
  Sun,
  Upload,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const flows = [
  { id: 'FL-004281', src: '10.0.14.28', dst: '172.16.4.11', port: 443, duration: 183, packets: 284, score: 0.12, status: 'Normal' },
  { id: 'FL-004280', src: '10.0.12.91', dst: '10.0.5.22', port: 22, duration: 4812, packets: 1842, score: 0.94, status: 'Anomalous' },
  { id: 'FL-004279', src: '192.168.1.42', dst: '8.8.8.8', port: 53, duration: 38, packets: 14, score: 0.08, status: 'Normal' },
  { id: 'FL-004278', src: '10.0.8.17', dst: '172.16.2.8', port: 8080, duration: 624, packets: 912, score: 0.67, status: 'Anomalous' },
  { id: 'FL-004277', src: '10.0.22.103', dst: '10.0.1.4', port: 443, duration: 91, packets: 72, score: 0.15, status: 'Normal' },
  { id: 'FL-004276', src: '10.0.4.61', dst: '172.16.9.31', port: 445, duration: 2301, packets: 440, score: 0.82, status: 'Anomalous' },
  { id: 'FL-004275', src: '192.168.1.88', dst: '1.1.1.1', port: 443, duration: 217, packets: 191, score: 0.18, status: 'Normal' },
]

const scoreDistribution = [
  { range: '0.0–0.2', normal: 1264, anomalous: 0 },
  { range: '0.2–0.4', normal: 418, anomalous: 0 },
  { range: '0.4–0.6', normal: 0, anomalous: 84 },
  { range: '0.6–0.8', normal: 0, anomalous: 51 },
  { range: '0.8–1.0', normal: 0, anomalous: 29 },
]

const trafficTrend = [
  { time: '09:00', flows: 182 }, { time: '10:00', flows: 246 }, { time: '11:00', flows: 221 },
  { time: '12:00', flows: 308 }, { time: '13:00', flows: 286 }, { time: '14:00', flows: 352 },
  { time: '15:00', flows: 299 }, { time: '16:00', flows: 344 },
]

function MetricCard({ label, value, hint, icon: Icon, accent }: { label: string; value: string; hint: string; icon: typeof Activity; accent?: string }) {
  return <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
    <div className="flex items-start justify-between"><div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></div><span className="text-xs font-medium text-muted-foreground">{hint}</span></div>
    <p className="mt-5 text-sm text-muted-foreground">{label}</p><p className={`mt-1 text-2xl font-semibold tracking-tight ${accent ?? 'text-foreground'}`}>{value}</p>
  </div>
}

export default function Page() {
  const [dark, setDark] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All flows')
  const [selected, setSelected] = useState(flows[1])
  const [fileName, setFileName] = useState('cic-ids2017-sample.csv')
  const [mobileNav, setMobileNav] = useState(false)
  const filtered = useMemo(() => flows.filter((flow) => {
    const matchesSearch = Object.values(flow).join(' ').toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'All flows' || flow.status === filter
    return matchesSearch && matchesFilter
  }), [search, filter])

  return <div className={dark ? 'dark' : ''}>
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-5 lg:px-8">
        <div className="flex items-center gap-3"><button className="rounded-md p-2 hover:bg-muted lg:hidden" aria-label="Open navigation" onClick={() => setMobileNav(!mobileNav)}><Menu className="size-5" /></button><div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><ShieldCheck className="size-4" /></div><span className="text-lg font-semibold tracking-tight">Athena</span><span className="hidden rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline">Analyst workspace</span></div>
        <div className="flex items-center gap-2"><span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex"><span className="size-1.5 rounded-full bg-emerald-500" />API ready</span><button className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</button><div className="ml-1 flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">JD</div></div>
      </header>
      <div className="flex">
        <aside className={`${mobileNav ? 'flex' : 'hidden'} absolute inset-x-0 top-16 z-10 min-h-[calc(100vh-4rem)] flex-col border-r border-border bg-card p-4 lg:static lg:flex lg:min-h-[calc(100vh-4rem)] lg:w-60 lg:shrink-0`}>
          <nav className="flex flex-col gap-1 text-sm"><p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Workspace</p><a className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5 font-medium" href="#overview"><Gauge className="size-4" />Overview</a><a className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" href="#results"><BarChart3 className="size-4" />Anomaly results</a><a className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" href="#model"><Database className="size-4" />Model information</a><p className="mb-2 mt-7 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Resources</p><a className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" href="#upload"><Upload className="size-4" />Upload dataset</a><a className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" href="#docs"><CircleHelp className="size-4" />Documentation</a></nav>
          <div className="mt-auto hidden rounded-lg border border-border bg-muted/50 p-3 text-xs lg:block"><div className="mb-2 flex items-center gap-2 font-medium"><Activity className="size-3.5 text-blue-600" />Demo workspace</div><p className="leading-relaxed text-muted-foreground">Predictions shown here use labeled mock data for demonstration.</p></div>
        </aside>
        <main className="min-w-0 flex-1" id="overview"><div className="mx-auto max-w-[1500px] px-5 py-8 lg:px-10 lg:py-10">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><span>Workspace</span><span>/</span><span className="text-foreground">Overview</span></div><h1 className="text-2xl font-semibold tracking-tight">Network overview</h1><p className="mt-1 text-sm text-muted-foreground">Review unusual traffic patterns from your latest analysis.</p></div><button className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90" onClick={() => document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' })}><Upload className="size-4" data-icon="inline-start" />Analyze new dataset</button></div>
          <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Total network flows" value="1,846" hint="Latest run" icon={Network} /><MetricCard label="Normal flows" value="1,682" hint="91.1%" icon={CheckCircle2} /><MetricCard label="Anomalous flows" value="164" hint="Requires review" icon={AlertTriangle} accent="text-red-600" /><MetricCard label="Anomaly percentage" value="8.9%" hint="+1.4% vs baseline" icon={Activity} accent="text-blue-600" /></div>
          <div className="mb-7 grid gap-5 xl:grid-cols-[1.4fr_1fr]"><div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="mb-5 flex items-start justify-between"><div><h2 className="font-semibold">Traffic volume</h2><p className="mt-1 text-xs text-muted-foreground">Flow count by hour · Today</p></div><button className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground">Today <ChevronDown className="size-3" /></button></div><div className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trafficTrend} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}><defs><linearGradient id="flowFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.16} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="currentColor" opacity={0.08} /><XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: .55 }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: .55 }} /><Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} /><Area type="monotone" dataKey="flows" stroke="#2563eb" strokeWidth={2} fill="url(#flowFill)" /></AreaChart></ResponsiveContainer></div></div><div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="mb-5"><h2 className="font-semibold">Flow distribution</h2><p className="mt-1 text-xs text-muted-foreground">Normal vs. anomalous records</p></div><div className="flex items-center gap-5"><div className="h-44 w-44 shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'Normal', value: 1682 }, { name: 'Anomalous', value: 164 }]} dataKey="value" innerRadius={54} outerRadius={78} paddingAngle={2}><Cell fill="#cbd5e1" /><Cell fill="#dc2626" /></Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="flex flex-col gap-4 text-sm"><div><div className="flex items-center gap-2 text-muted-foreground"><span className="size-2 rounded-full bg-slate-300" />Normal</div><p className="mt-1 font-semibold">1,682 <span className="ml-1 text-xs font-normal text-muted-foreground">91.1%</span></p></div><div><div className="flex items-center gap-2 text-muted-foreground"><span className="size-2 rounded-full bg-red-600" />Anomalous</div><p className="mt-1 font-semibold">164 <span className="ml-1 text-xs font-normal text-muted-foreground">8.9%</span></p></div></div></div></div></div>
          <div className="mb-7 grid gap-5 lg:grid-cols-[1fr_1fr]" id="model"><div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="mb-5"><h2 className="font-semibold">Anomaly score distribution</h2><p className="mt-1 text-xs text-muted-foreground">Higher scores indicate less typical behavior</p></div><div className="h-52"><ResponsiveContainer width="100%" height="100%"><BarChart data={scoreDistribution} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}><CartesianGrid vertical={false} stroke="currentColor" opacity={0.08} /><XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', opacity: .55 }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', opacity: .55 }} /><Tooltip cursor={{ fill: 'currentColor', opacity: .04 }} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} /><Bar dataKey="normal" name="Normal" fill="#94a3b8" radius={[3, 3, 0, 0]} /><Bar dataKey="anomalous" name="Anomalous" fill="#dc2626" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></div><div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Model information</h2><p className="mt-1 text-xs text-muted-foreground">Current analysis configuration</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:bg-blue-950 dark:text-blue-300">Isolation Forest</span></div><div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Contamination</p><p className="mt-1 font-semibold">0.05</p></div><div className="rounded-lg bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Features analyzed</p><p className="mt-1 font-semibold">12 network signals</p></div><div className="rounded-lg bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Training baseline</p><p className="mt-1 font-semibold">CIC-IDS2017</p></div><div className="rounded-lg bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Last trained</p><p className="mt-1 font-semibold">Nov 05, 2026</p></div></div><p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">Athena identifies unusual patterns in network traffic. A flagged flow is not necessarily malicious and should be investigated in context.</p></div></div>
          <section className="mb-7 rounded-xl border border-dashed border-border bg-muted/20 p-5" id="upload"><div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-card shadow-sm"><FileText className="size-5 text-blue-600" /></div><div><h2 className="font-semibold">Dataset loaded</h2><p className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">{fileName}</span> · 1,846 records · 12 features</p></div></div><div className="flex w-full gap-2 sm:w-auto"><label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted sm:flex-none"><Upload className="size-4" />Replace CSV<input type="file" accept=".csv" className="sr-only" onChange={(e) => e.target.files?.[0] && setFileName(e.target.files[0].name)} /></label><button className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted" onClick={() => setFileName('cic-ids2017-sample.csv')}>Use sample</button></div></div></section>
          <section className="rounded-xl border border-border bg-card shadow-sm" id="results"><div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Anomaly results</h2><p className="mt-1 text-xs text-muted-foreground">Showing {filtered.length} of {flows.length} preview records · Mock analysis data</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input aria-label="Search flows" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search flows..." className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring sm:w-48" /></div><select aria-label="Filter flow status" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none"><option>All flows</option><option>Normal</option><option>Anomalous</option></select><button className="flex h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"><ArrowDownToLine className="size-4" />Export</button></div></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Flow ID</th><th className="px-5 py-3 font-medium">Source</th><th className="px-5 py-3 font-medium">Destination</th><th className="px-5 py-3 font-medium">Port</th><th className="px-5 py-3 font-medium">Duration</th><th className="px-5 py-3 font-medium">Packets</th><th className="px-5 py-3 font-medium">Score</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody className="divide-y divide-border">{filtered.map((flow) => <tr key={flow.id} className={`cursor-pointer transition-colors hover:bg-muted/40 ${selected.id === flow.id ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`} onClick={() => setSelected(flow)}><td className="whitespace-nowrap px-5 py-3.5 font-medium">{flow.id}</td><td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-muted-foreground">{flow.src}</td><td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-muted-foreground">{flow.dst}</td><td className="px-5 py-3.5 text-muted-foreground">{flow.port}</td><td className="px-5 py-3.5 text-muted-foreground">{flow.duration.toLocaleString()} ms</td><td className="px-5 py-3.5 text-muted-foreground">{flow.packets.toLocaleString()}</td><td className={`px-5 py-3.5 font-mono text-xs font-semibold ${flow.score > .5 ? 'text-red-600' : 'text-foreground'}`}>{flow.score.toFixed(2)}</td><td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${flow.status === 'Anomalous' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-muted text-muted-foreground'}`}><span className={`size-1.5 rounded-full ${flow.status === 'Anomalous' ? 'bg-red-600' : 'bg-slate-400'}`} />{flow.status}</span></td></tr>)}</tbody></table></div></section>
          <div className="mt-5 flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950"><AlertTriangle className="size-4" /></div><div><p className="text-sm font-medium">Selected flow · {selected.id}</p><p className="text-xs text-muted-foreground">{selected.status === 'Anomalous' ? 'Unusual behavior detected — investigate in context.' : 'Within expected traffic patterns.'}</p></div></div><button className="hidden rounded-md p-2 text-muted-foreground hover:bg-muted sm:block" aria-label="Dismiss selected flow"><X className="size-4" /></button></div>
        </div></main>
      </div>
    </div>
  </div>
}
