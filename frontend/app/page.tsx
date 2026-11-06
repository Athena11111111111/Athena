'use client'

import { useEffect, useRef, useState } from 'react'
import { Activity, BarChart3, CircleHelp, Database, FileText, Gauge, Loader2, Menu, Moon, ShieldCheck, Sun, Upload } from 'lucide-react'
import { api, ApiError, type Analysis, type ModelInfo } from '@/lib/api'
import { AnalysisCharts, button, EvaluationCard, FlowResults, format } from '@/components/analysis-results'

const input = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50'
const navigation = [
  { label: 'Overview', href: '#overview', icon: Gauge },
  { label: 'Anomaly results', href: '#results', icon: BarChart3 },
  { label: 'Model information', href: '#model', icon: Database },
  { label: 'Upload dataset', href: '#upload', icon: Upload },
  { label: 'Documentation', href: '#docs', icon: CircleHelp },
]
type Source = { kind: 'demo' } | { kind: 'upload'; file: File }
type Run = { source: Source; analysis: Analysis }

export default function Page() {
  const [dark, setDark] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [connection, setConnection] = useState<'checking' | 'online' | 'offline'>('checking')
  const [model, setModel] = useState<ModelInfo | null>(null)
  const [trainingFile, setTrainingFile] = useState<File | null>(null)
  const [analysisFile, setAnalysisFile] = useState<File | null>(null)
  const [contamination, setContamination] = useState('0.05')
  const [run, setRun] = useState<Run | null>(null)
  const [threshold, setThreshold] = useState(0.5)
  const [busy, setBusy] = useState('')
  const operation = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Remount result controls after a successful request to discard stale selections.
  const [resultVersion, setResultVersion] = useState(0)
  const analysis = run?.analysis
  const disabled = Boolean(busy) || connection === 'checking'

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    let active = true
    async function check() {
      try {
        const health = await api.health(controller.signal)
        const existing = health.model_ready ? await api.model(controller.signal) : null
        if (active) { setConnection('online'); setModel(existing) }
      } catch {
        if (active) setConnection('offline')
      } finally { clearTimeout(timer) }
    }
    void check()
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [])

  function clearResults() {
    setRun(null); setResultVersion(version => version + 1)
  }

  function fail(cause: unknown) {
    setError(cause instanceof Error ? cause.message : 'Analysis failed. Please retry.')
    if (cause instanceof ApiError) {
      if (cause.status === 0 || cause.status >= 500) setConnection('offline')
      else setConnection('online')
      if (cause.status === 409 && cause.message.includes('Train a model')) {
        setModel(null); clearResults()
      }
    }
  }

  async function perform(label: string, action: () => Promise<void>) {
    if (operation.current) return
    operation.current = true
    setBusy(label); setError(''); setNotice('')
    try { await action(); setConnection('online') } catch (cause) { fail(cause) }
    finally { operation.current = false; setBusy('') }
  }

  function chooseFile(file: File | undefined, target: 'train' | 'analyze') {
    setError(''); setNotice('')
    const setFile = target === 'train' ? setTrainingFile : setAnalysisFile
    setFile(null)
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('Choose a CSV file.'); return }
    if (!file.size || file.size > 10 * 1024 * 1024) { setError('Choose a nonempty CSV no larger than 10 MiB.'); return }
    setFile(file)
  }

  function applyRun(source: Source, result: Analysis) {
    setRun({ source, analysis: result }); setThreshold(result.threshold)
    setResultVersion(version => version + 1)
  }

  function train() {
    if (!trainingFile) return
    const amount = Number(contamination)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 0.5) {
      setError('Contamination must be greater than 0 and at most 0.5.'); return
    }
    void perform('Training model…', async () => {
      const trained = await api.train(trainingFile, amount)
      setModel(trained); clearResults(); setThreshold(trained.threshold)
      setNotice(`Model trained on ${format(trained.training_rows)} benign flows. Upload a separate CSV to analyze traffic.`)
    })
  }

  function demo() {
    void perform('Running synthetic demo…', async () => {
      const result = await api.demo(0.05)
      setModel(result.model); applyRun({ kind: 'demo' }, result.analysis)
      setNotice('Synthetic demonstration loaded. These results do not measure real-world attack detection.')
    })
  }

  function analyze() {
    if (!analysisFile || !model) return
    void perform('Analyzing CSV…', async () => {
      applyRun({ kind: 'upload', file: analysisFile }, await api.analyze(analysisFile))
    })
  }

  function updateAnalysis(offset = 0, cutoff = analysis?.threshold) {
    if (!run || !model) return
    void perform('Updating results…', async () => {
      if (run.source.kind === 'demo') {
        const result = await api.demo(model.contamination, cutoff)
        setModel(result.model); applyRun(run.source, result.analysis)
      } else {
        applyRun(run.source, await api.analyze(run.source.file, cutoff, offset))
      }
    })
  }

  const datasetName = run?.source.kind === 'upload' ? run.source.file.name : run ? 'Synthetic holdout' : 'No analysis yet'

  return <div className={dark ? 'dark' : ''}>
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-5 lg:px-8">
        <div className="flex items-center gap-3"><button className="rounded-md p-2 hover:bg-muted lg:hidden" aria-label="Open navigation" onClick={() => setMobileNav(!mobileNav)}><Menu className="size-5" /></button><div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><ShieldCheck className="size-4" /></div><span className="text-lg font-semibold tracking-tight">Athena</span><span className="hidden rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline">Analyst workspace</span></div>
        <div className="flex items-center gap-3"><span role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`size-1.5 rounded-full ${connection === 'online' ? 'bg-emerald-500' : connection === 'offline' ? 'bg-red-500' : 'bg-amber-500'}`} />{connection === 'online' ? 'API connected' : connection === 'offline' ? 'API unavailable' : 'Connecting…'}</span><button className="rounded-md p-2 hover:bg-muted" aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</button></div>
      </header>
      <div className="flex">
        <aside className={`${mobileNav ? 'flex' : 'hidden'} absolute inset-x-0 top-16 z-10 flex-col border-r border-border bg-card p-4 lg:static lg:flex lg:w-60 lg:shrink-0`}>
          <nav className="flex flex-col gap-1 text-sm"><p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Workspace</p>{navigation.map(({ label, href, icon: Icon }) => <a key={href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" href={href} onClick={() => setMobileNav(false)}><Icon className="size-4" />{label}</a>)}</nav>
          <div className="mt-8 rounded-lg border border-border bg-muted/50 p-3 text-xs"><div className="mb-2 flex items-center gap-2 font-medium"><Activity className="size-3.5 text-blue-600" />{model?.synthetic ? 'Synthetic baseline' : model ? 'Uploaded baseline' : 'No model loaded'}</div><p className="leading-relaxed text-muted-foreground">{model?.synthetic ? 'Synthetic results validate the workflow, not real-world detection accuracy.' : 'Statistical anomalies are evidence for investigation, not proof of an attack.'}</p></div>
        </aside>
        <main className="min-w-0 flex-1" id="overview"><div className="mx-auto max-w-[1500px] px-5 py-8 lg:px-10 lg:py-10">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs text-muted-foreground">Workspace / Overview</p><h1 className="text-2xl font-semibold tracking-tight">Network overview</h1><p className="mt-1 text-sm text-muted-foreground">Review unusual traffic patterns from your latest analysis.</p></div><button className={button} onClick={() => document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' })}><Upload className="size-4" />Analyze new dataset</button></div>

          {connection === 'offline' && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm"><p>The analysis service is unavailable. Start the backend and retry the connection.</p><button className={button} disabled={disabled} onClick={() => void perform('Connecting…', async () => { const health = await api.health(); setModel(health.model_ready ? await api.model() : null); clearResults() })}>Retry connection</button></div>}
          {error && <div role="alert" aria-label="Analysis error" className="mb-5 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">{error}{analysis && <p className="mt-1">The dashboard still shows the last successful analysis.</p>}</div>}
          {notice && <p role="status" className="mb-5 rounded-lg border border-border bg-muted/50 p-4 text-sm">{notice}</p>}
          {busy && <p role="status" aria-live="polite" className="mb-5 flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />{busy}</p>}

          <section id="upload" className="mb-7 scroll-mt-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="font-semibold">Analyze network traffic</h2><p className="mt-1 text-xs text-muted-foreground">Train a benign baseline, then analyze a separate CSV. Maximum 10 MiB and 50,000 rows per file.</p></div><button className={button} disabled={disabled} onClick={demo}>Use synthetic demo</button></div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3"><h3 className="text-sm font-semibold">1. Train a baseline</h3><p className="text-xs text-muted-foreground">Requires Label values and at least 20 benign flows. Training replaces the current model and clears previous results.</p><label className="block text-sm">Training CSV<input aria-label="Training CSV" type="file" accept=".csv,text/csv" disabled={disabled} className={`${input} mt-1 file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-foreground`} onChange={event => { chooseFile(event.target.files?.[0], 'train'); event.target.value = '' }} /></label><p className="min-h-4 break-all text-xs text-muted-foreground">{trainingFile?.name ?? 'No training file selected'}</p><div className="flex flex-wrap items-end gap-3"><label className="text-xs text-muted-foreground">Contamination<input aria-label="Contamination" type="number" min="0.001" max="0.5" step="0.001" value={contamination} disabled={disabled} onChange={event => setContamination(event.target.value)} className={`${input} mt-1 max-w-32`} /></label><button className={button} disabled={disabled || !trainingFile} onClick={train}>Train model</button></div></div>
              <div className="space-y-3"><h3 className="text-sm font-semibold">2. Analyze traffic</h3><p className="text-xs text-muted-foreground">Uses the loaded model. A Label column is optional and enables evaluation metrics.</p><label className="block text-sm">Analysis CSV<input aria-label="Analysis CSV" type="file" accept=".csv,text/csv" disabled={disabled} className={`${input} mt-1 file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-foreground`} onChange={event => { chooseFile(event.target.files?.[0], 'analyze'); event.target.value = '' }} /></label><p className="min-h-4 break-all text-xs text-muted-foreground">{analysisFile?.name ?? 'No analysis file selected'}</p><button className={button} disabled={disabled || !analysisFile || !model} onClick={analyze}>Analyze CSV</button>{!model && <p className="text-xs text-muted-foreground">Train a model or load the synthetic demo first.</p>}</div>
            </div>
          </section>

          <div className="mb-4 flex items-start gap-3"><FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><p className="break-all text-sm font-medium">{datasetName}</p><p className="mt-1 text-xs text-muted-foreground">{analysis ? `${format(analysis.total_flows)} flows · ${analysis.imputed_values} values filled using benign training medians${analysis.synthetic_model ? ' · Synthetic model' : ''}` : 'Load the synthetic demo or upload CSV files to begin. Results appear after a successful analysis.'}</p></div></div>
          <AnalysisCharts analysis={analysis} />

          <section id="model" className="mb-7 scroll-mt-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Model information</h2>
            {model ? <><dl className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">{Object.entries({ Algorithm: model.algorithm, 'Training baseline': model.synthetic ? 'Synthetic benign flows' : 'Uploaded benign flows', 'Training rows': format(model.training_rows), 'Features analyzed': model.features.length, Contamination: model.contamination, 'Default threshold': model.threshold.toFixed(3) }).map(([label, value]) => <div key={label} className="rounded-lg bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>)}</dl><p className="mt-4 text-xs leading-relaxed text-muted-foreground">{model.disclaimer}</p></> : <p className="mt-3 text-sm text-muted-foreground">No model loaded. Start with the synthetic demo or train your own baseline.</p>}
            {analysis && <div className="mt-5 border-t border-border pt-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-medium" htmlFor="threshold">Anomaly threshold: {threshold.toFixed(3)}<input id="threshold" aria-label="Anomaly threshold" type="range" min="0" max="1" step="0.001" className="mt-3 block w-full accent-blue-600" value={threshold} disabled={disabled} onChange={event => setThreshold(Number(event.target.value))} /></label><button className={button} disabled={disabled || threshold === analysis.threshold} onClick={() => updateAnalysis(0, threshold)}>Apply threshold</button><button className={button} disabled={disabled || !model || analysis.threshold === model.threshold} onClick={() => updateAnalysis(0, model?.threshold)}>Reset threshold</button></div><p className="mt-2 text-xs text-muted-foreground">Lower thresholds flag more flows. Showing results at {analysis.threshold.toFixed(3)}; scores are not attack probabilities.</p></div>}
          </section>

          {model && <div className="mb-7 grid gap-5 xl:grid-cols-2"><EvaluationCard evaluation={model.evaluation} title="Training holdout evaluation" note={`${model.evaluation_rows} held-out benign and attack flows, evaluated at the model’s default threshold. ${model.evaluation_note}${model.synthetic ? ' Synthetic demonstration only.' : ''}`} />{analysis && <EvaluationCard evaluation={analysis.evaluation} title="Analysis evaluation" note={`Metrics for the entire analyzed CSV at threshold ${analysis.threshold.toFixed(3)}. Use separate testing data to assess real-world performance.${run?.source.kind === 'demo' ? ' Synthetic holdout only.' : ''}`} />}</div>}
          <FlowResults key={resultVersion} analysis={analysis} features={model?.features ?? []} busy={Boolean(busy)} onPage={offset => updateAnalysis(offset)} />

          <section id="docs" className="mt-7 scroll-mt-4 rounded-xl border border-border bg-muted/20 p-5"><h2 className="font-semibold">CSV guide</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Required columns: Flow Duration, Total Fwd Packets, Total Backward Packets, Flow Bytes/s, Flow Packets/s, SYN Flag Count, Destination Port. Keep units consistent between training and testing; duration values are shown as supplied. Whitespace around headers is trimmed. Missing or infinite values use benign training medians.</p><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Training labels BENIGN and NORMAL are benign; other nonempty labels are treated as attack labels for evaluation. Labels never become prediction features. For reliable evaluation, separate captures and time periods and remove duplicate flows before uploading. A synthetic baseline is for demonstration; train on representative real benign traffic before interpreting real uploads.</p><p className="mt-3 text-xs text-muted-foreground">The model is shared by this local workspace and resets when the backend restarts. CSV selections and analysis results reset when you reload this page. No real CIC-IDS2017 dataset is bundled.</p></section>
        </div></main>
      </div>
    </div>
  </div>
}
