'use client'

import { useMemo, useState } from 'react'
import { Activity, AlertTriangle, ArrowDownToLine, CheckCircle2, Network, Search, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Analysis, Evaluation, Flow } from '@/lib/api'

export const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'
export const format = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 })
const percentage = (value: number | null) => value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`

function MetricCard({ label, value, hint, icon: Icon, accent = '' }: {
  label: string; value: string; hint: string; icon: typeof Activity; accent?: string
}) {
  return <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
    <div className="flex items-start justify-between"><div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></div><span className="text-xs text-muted-foreground">{hint}</span></div>
    <p className="mt-5 text-sm text-muted-foreground">{label}</p><p className={`mt-1 text-2xl font-semibold tracking-tight ${accent}`}>{value}</p>
  </div>
}

export function AnalysisCharts({ analysis }: { analysis?: Analysis }) {
  const distribution = analysis?.score_distribution.map(bin => ({
    range: `${bin.from.toFixed(1)}–${bin.to.toFixed(1)}`, count: bin.count,
  })) ?? []
  return <>
    <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Total network flows" value={analysis ? format(analysis.total_flows) : '—'} hint="Latest analysis" icon={Network} />
      <MetricCard label="Normal flows" value={analysis ? format(analysis.normal) : '—'} hint={analysis ? `${(100 - analysis.anomaly_percentage).toFixed(1)}%` : 'Awaiting analysis'} icon={CheckCircle2} />
      <MetricCard label="Anomalous flows" value={analysis ? format(analysis.anomalies) : '—'} hint="Requires review" icon={AlertTriangle} accent="text-red-600" />
      <MetricCard label="Anomaly percentage" value={analysis ? `${analysis.anomaly_percentage.toFixed(1)}%` : '—'} hint="Statistical anomalies" icon={Activity} accent="text-blue-600" />
    </div>
    <div className="mb-7 grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Anomaly score distribution</h2><p className="mt-1 text-xs text-muted-foreground">All analyzed flows · Higher scores mean less typical behavior.</p>
        {analysis ? <div className="mt-5 h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={distribution} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}><CartesianGrid vertical={false} stroke="currentColor" opacity={0.08} /><XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" name="Flows" fill="#2563eb" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">No scores to display yet.</p>}
      </section>
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Flow distribution</h2><p className="mt-1 text-xs text-muted-foreground">Normal vs. anomalous records</p>
        {analysis ? <div className="mt-5 flex flex-wrap items-center justify-center gap-5"><div className="h-48 w-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'Normal', value: analysis.normal }, { name: 'Anomalous', value: analysis.anomalies }]} dataKey="value" innerRadius={54} outerRadius={78} paddingAngle={2}><Cell fill="#94a3b8" /><Cell fill="#dc2626" /></Pie><Tooltip /></PieChart></ResponsiveContainer></div><dl className="space-y-4 text-sm"><div><dt className="text-muted-foreground">Normal</dt><dd className="font-semibold">{format(analysis.normal)}</dd></div><div><dt className="text-muted-foreground">Anomalous</dt><dd className="font-semibold text-red-600">{format(analysis.anomalies)}</dd></div></dl></div> : <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">No predictions to display yet.</p>}
      </section>
    </div>
  </>
}

export function EvaluationCard({ evaluation, title, note }: { evaluation: Evaluation | null; title: string; note: string }) {
  return <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
    <h2 className="font-semibold">{title}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</p>
    {evaluation ? <>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries({ Precision: percentage(evaluation.precision), Recall: percentage(evaluation.recall), 'F1 score': evaluation.f1.toFixed(3), 'False-positive rate': percentage(evaluation.false_positive_rate) }).map(([label, value]) => <div key={label} className="rounded-lg bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}
      </dl>
      <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm" aria-label={`${title} confusion matrix`}><caption className="mb-2 text-left text-xs text-muted-foreground">Confusion matrix · Actual labels vs. predictions</caption><thead><tr><th className="p-2">Actual / Predicted</th><th className="p-2">Normal</th><th className="p-2">Anomalous</th></tr></thead><tbody><tr className="border-t border-border"><th className="p-2 font-medium">Benign</th><td className="p-2">{evaluation.confusion_matrix.tn}</td><td className="p-2">{evaluation.confusion_matrix.fp}</td></tr><tr className="border-t border-border"><th className="p-2 font-medium">Attack</th><td className="p-2">{evaluation.confusion_matrix.fn}</td><td className="p-2">{evaluation.confusion_matrix.tp}</td></tr></tbody></table></div>
    </> : <p className="mt-4 text-sm text-muted-foreground">Metrics are available when the analyzed CSV includes a Label column.</p>}
  </section>
}

export function FlowResults({ analysis, features, busy, onPage }: {
  analysis?: Analysis; features: string[]; busy: boolean; onPage: (offset: number) => void
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All flows')
  const [selected, setSelected] = useState<Flow | null>(null)
  const filtered = useMemo(() => (analysis?.flows ?? []).filter(flow => {
    const text = [flow.row, flow.status, flow.score, ...Object.values(flow.features)].join(' ').toLowerCase()
    return text.includes(search.toLowerCase()) && (filter === 'All flows' || flow.status === filter)
  }), [analysis, search, filter])

  function exportPage() {
    if (!analysis || !filtered.length) return
    const rows = [['Row', 'Score', 'Status', 'Synthetic model', ...features], ...filtered.map(flow => [
      flow.row, flow.score, flow.status, analysis.synthetic_model, ...features.map(feature => flow.features[feature]),
    ])]
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url; link.download = 'athena-results-page.csv'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <>
    <section className="scroll-mt-4 rounded-xl border border-border bg-card shadow-sm" id="results" aria-busy={busy}>
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="font-semibold">Anomaly results</h2><p className="mt-1 text-xs text-muted-foreground">{analysis ? `Rows ${analysis.offset + 1}–${analysis.offset + analysis.flows.length} of ${format(analysis.total_flows)} · ${filtered.length} shown after filtering` : 'Awaiting analysis'}</p><p className="mt-1 text-xs text-muted-foreground">Search, filter, and export apply to the current page.</p></div>
        <div className="flex flex-wrap gap-2"><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input aria-label="Search flows" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search this page…" className="h-9 w-44 rounded-lg border border-border bg-background pl-9 pr-3 text-sm" /></div><select aria-label="Filter flow status" value={filter} onChange={event => setFilter(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-sm"><option>All flows</option><option>Normal</option><option>Anomalous</option></select><button className={button} disabled={!filtered.length || busy} onClick={exportPage}><ArrowDownToLine className="size-4" />Export page</button></div>
      </div>
      <div className="max-h-[32rem] overflow-auto"><table className="w-full text-left text-sm" aria-label="Anomaly results">
        <thead className="sticky top-0 bg-card text-xs text-muted-foreground"><tr>{['CSV row', 'Destination port', 'Flow duration', 'Fwd packets', 'Backward packets', 'Score', 'Status'].map(label => <th key={label} className="whitespace-nowrap px-5 py-3 font-medium">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{filtered.map(flow => <tr key={flow.row} className={selected?.row === flow.row ? 'bg-blue-50/60 dark:bg-blue-950/20' : 'hover:bg-muted/40'}><td className="px-5 py-3.5"><button className="whitespace-nowrap font-medium text-blue-600 underline-offset-4 hover:underline" aria-label={`Inspect row ${flow.row}`} onClick={() => setSelected(flow)}>Row {flow.row}</button></td><td className="px-5 py-3.5">{format(flow.features['Destination Port'])}</td><td className="px-5 py-3.5">{format(flow.features['Flow Duration'])}</td><td className="px-5 py-3.5">{format(flow.features['Total Fwd Packets'])}</td><td className="px-5 py-3.5">{format(flow.features['Total Backward Packets'])}</td><td className="px-5 py-3.5 font-mono text-xs">{flow.score.toFixed(3)}</td><td className="px-5 py-3.5"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${flow.status === 'Anomalous' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-muted text-muted-foreground'}`}>{flow.status}</span></td></tr>)}{!filtered.length && <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">{analysis ? 'No flows match the filters on this page.' : 'Run an analysis to view network flows.'}</td></tr>}</tbody>
      </table></div>
      {analysis && <div className="flex items-center justify-between gap-3 border-t border-border p-4 text-xs text-muted-foreground"><p>Page {Math.floor(analysis.offset / analysis.limit) + 1} of {Math.ceil(analysis.total_flows / analysis.limit)}</p><div className="flex gap-2"><button className={button} disabled={busy || analysis.offset === 0} onClick={() => onPage(Math.max(0, analysis.offset - analysis.limit))}>Previous page</button><button className={button} disabled={busy || analysis.offset + analysis.flows.length >= analysis.total_flows} onClick={() => onPage(analysis.offset + analysis.limit)}>Next page</button></div></div>}
    </section>
    {selected && <section className="mt-5 rounded-xl border border-border bg-card p-5 shadow-sm" aria-label="Flow investigation">
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">Selected flow · Row {selected.row}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.status} · Score {selected.score.toFixed(3)}</p></div><button className="rounded-md p-2 hover:bg-muted" aria-label="Dismiss selected flow" onClick={() => setSelected(null)}><X className="size-4" /></button></div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Feature values outside the benign training 5th–95th percentile range provide supporting evidence. They do not explain the model causally or prove an attack.</p>
      {selected.evidence.length ? <ul className="mt-3 space-y-2 text-sm">{selected.evidence.map(evidence => <li key={evidence.feature} className="rounded-lg bg-muted/60 p-3"><span className="font-medium">{evidence.feature}: {format(evidence.value)}</span><span className="text-muted-foreground"> · {evidence.direction} compared with benign training values ({format(evidence.benign_p05)}–{format(evidence.benign_p95)}; median {format(evidence.benign_median)}){evidence.imputed ? ' · Filled from training median' : ''}</span></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No individual features fall outside that range. The model can still flag unusual combinations of values.</p>}
      <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">All analyzed features</summary><dl className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(selected.features).map(([label, value]) => <div key={label} className="rounded-lg bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{format(value)}</dd></div>)}</dl></details>
    </section>}
  </>
}
