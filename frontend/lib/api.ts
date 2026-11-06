export type Evaluation = {
  confusion_matrix: { tn: number; fp: number; fn: number; tp: number }
  precision: number
  recall: number
  f1: number
  false_positive_rate: number | null
}

export type ModelInfo = {
  algorithm: string
  features: string[]
  training_rows: number
  contamination: number
  synthetic: boolean
  source: string
  threshold: number
  evaluation: Evaluation | null
  evaluation_rows: number
  evaluation_note: string
  disclaimer: string
}

export type Flow = {
  row: number
  score: number
  status: 'Normal' | 'Anomalous'
  features: Record<string, number>
  evidence: {
    feature: string
    value: number
    direction: 'high' | 'low'
    benign_median: number
    benign_p05: number
    benign_p95: number
    imputed: boolean
  }[]
}

export type Analysis = {
  total_flows: number
  normal: number
  anomalies: number
  anomaly_percentage: number
  threshold: number
  imputed_values: number
  score_distribution: { from: number; to: number; count: number }[]
  flows: Flow[]
  offset: number
  limit: number
  evaluation: Evaluation | null
  synthetic_model: boolean
  disclaimer: string
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/${path}`, {
      ...init,
      cache: 'no-store',
      signal: init.signal ?? AbortSignal.timeout(120_000),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new ApiError('The request timed out. Try a smaller CSV or retry when the service is available.', 408)
    }
    throw new ApiError('Cannot reach the analysis service. Check that the backend is running, then retry.', 0)
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = data?.detail
    const message = typeof detail === 'string' ? detail
      : Array.isArray(detail) ? detail.map((item: { msg?: string }) => item.msg ?? 'Invalid input').join('; ')
      : response.status >= 500 ? 'The analysis service is unavailable. Please retry when the backend is running.'
      : `Request failed (${response.status}). Please check your input.`
    throw new ApiError(message, response.status)
  }
  if (!data) throw new ApiError('The analysis service returned an invalid response.', response.status)
  return data as T
}

function csvBody(file: File) {
  const body = new FormData()
  body.append('file', file)
  return body
}

export const api = {
  health: (signal?: AbortSignal) => request<{ status: string; model_ready: boolean }>('health', { signal }),
  model: (signal?: AbortSignal) => request<ModelInfo>('model', { signal }),
  train: (file: File, contamination: number) => request<ModelInfo>(`train?contamination=${contamination}`, {
    method: 'POST', body: csvBody(file),
  }),
  analyze: (file: File, threshold?: number, offset = 0) => {
    const query = new URLSearchParams({ offset: String(offset), limit: '100' })
    if (threshold !== undefined) query.set('threshold', String(threshold))
    return request<Analysis>(`analyze?${query}`, { method: 'POST', body: csvBody(file) })
  },
  demo: (contamination: number, threshold?: number) => {
    const query = new URLSearchParams({ contamination: String(contamination) })
    if (threshold !== undefined) query.set('threshold', String(threshold))
    return request<{ model: ModelInfo; analysis: Analysis }>(`demo?${query}`, { method: 'POST' })
  },
}
