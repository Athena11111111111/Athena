import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const features = ['Flow Duration', 'Total Fwd Packets', 'Total Backward Packets', 'Flow Bytes/s', 'Flow Packets/s', 'SYN Flag Count', 'Destination Port']

// Synthetic fixtures are generated independently of the backend's demo endpoint.
function csv(count: number, labeled = false) {
  const header = [...features, ...(labeled ? ['Label'] : [])]
  const rows = Array.from({ length: count }, (_, index) => {
    const attack = index >= count - 10
    return [attack ? 100_000 : 100 + index % 30, attack ? 2000 : 20 + index % 8,
      attack ? 1000 : 10 + index % 5, attack ? 500_000 : 1000 + index % 100,
      attack ? 9000 : 30 + index % 10, index % 3, [53, 80, 443][index % 3],
      ...(labeled ? [attack ? 'SYNTHETIC_ATTACK' : 'BENIGN'] : [])].join(',')
  })
  return Buffer.from([header.join(','), ...rows].join('\n'))
}

async function openDashboard(page: Page) {
  await page.goto('/')
  await expect(page.getByText('API connected', { exact: true })).toBeVisible()
}

async function useDemo(page: Page) {
  await page.getByRole('button', { name: 'Use synthetic demo', exact: true }).click()
  await expect(page.getByText('Synthetic holdout', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Use synthetic demo', exact: true })).toBeEnabled()
}

async function setThreshold(page: Page, key: 'Home' | 'End') {
  await page.getByRole('slider', { name: 'Anomaly threshold' }).focus()
  await page.getByRole('slider', { name: 'Anomaly threshold' }).press(key)
  await page.getByRole('button', { name: 'Apply threshold', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Use synthetic demo', exact: true })).toBeEnabled()
}

test('real demo responses drive metrics, evidence, filters, export, and sensitivity', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await openDashboard(page)
  await expect(page.getByText('No analysis yet', { exact: true })).toBeVisible()
  await useDemo(page)
  await expect(page.locator('#results')).toContainText('Rows 1–90 of 90')
  await expect(page.getByRole('table', { name: 'Analysis evaluation confusion matrix' })).toBeVisible()
  const anomalyCard = page.getByText('Anomalous flows', { exact: true }).locator('..')
  await expect(anomalyCard.getByText('40', { exact: true })).toBeVisible()

  await page.getByRole('combobox', { name: 'Filter flow status' }).selectOption('Anomalous')
  await expect(page.getByRole('table', { name: 'Anomaly results', exact: true }).locator('tbody tr')).toHaveCount(40)
  await page.getByRole('button', { name: 'Inspect row 51', exact: true }).click()
  const investigation = page.getByRole('region', { name: 'Flow investigation' })
  await expect(investigation).toContainText('high compared with benign training values')
  await page.getByRole('button', { name: 'Dismiss selected flow' }).click()
  await expect(investigation).toHaveCount(0)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export page' }).click()
  const download = await downloadPromise
  const report = await readFile((await download.path())!, 'utf8')
  expect(report.split('\r\n')).toHaveLength(41)
  expect(report).toContain('"Synthetic model"')
  expect(report).toContain('"true"')

  await setThreshold(page, 'End')
  await expect(anomalyCard.getByText('0', { exact: true })).toBeVisible()
  await expect(page.locator('#model')).toContainText('Showing results at 1.000')
  await setThreshold(page, 'Home')
  await expect(anomalyCard.getByText('90', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reset threshold' }).click()
  await expect(anomalyCard.getByText('40', { exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Search flows' }).fill('does-not-match')
  await expect(page.locator('#results')).toContainText('No flows match the filters on this page.')
  expect(pageErrors).toEqual([])
})

test('CSV training, unlabeled analysis, pagination, and failed uploads preserve correct results', async ({ page }) => {
  await openDashboard(page)
  await page.getByLabel('Training CSV', { exact: true }).setInputFiles({ name: 'synthetic-training.csv', mimeType: 'text/csv', buffer: csv(120, true) })
  await page.getByRole('button', { name: 'Train model', exact: true }).click()
  await expect(page.getByText('Model trained on 82 benign flows.', { exact: false })).toBeVisible()
  await expect(page.getByText('No analysis yet', { exact: true })).toBeVisible()
  await page.getByLabel('Analysis CSV', { exact: true }).setInputFiles({ name: 'synthetic-testing.csv', mimeType: 'text/csv', buffer: csv(201) })
  await page.getByRole('button', { name: 'Analyze CSV', exact: true }).click()
  await expect(page.locator('#results')).toContainText('Rows 1–100 of 201')
  await expect(page.getByText('Metrics are available when the analyzed CSV includes a Label column.')).toBeVisible()

  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.locator('#results')).toContainText('Rows 101–200 of 201')
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.locator('#results')).toContainText('Rows 201–201 of 201')
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Previous page' })).toBeEnabled()
  await setThreshold(page, 'End')
  await expect(page.locator('#results')).toContainText('Rows 1–100 of 201')
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.locator('#results')).toContainText('Rows 101–200 of 201')
  await expect(page.locator('#model')).toContainText('Showing results at 1.000')

  await page.getByLabel('Analysis CSV', { exact: true }).setInputFiles({ name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from('wrong\n1\n') })
  await page.getByRole('button', { name: 'Analyze CSV', exact: true }).click()
  await expect(page.getByRole('alert', { name: 'Analysis error' })).toContainText('Missing required columns:')
  await expect(page.getByRole('alert', { name: 'Analysis error' })).toContainText('last successful analysis')
  await expect(page.locator('#results')).toContainText('Rows 101–200 of 201')

  await page.getByLabel('Training CSV', { exact: true }).setInputFiles({ name: 'unlabeled.csv', mimeType: 'text/csv', buffer: csv(120) })
  await page.getByRole('button', { name: 'Train model', exact: true }).click()
  await expect(page.getByRole('alert', { name: 'Analysis error' })).toContainText('Training requires a Label column')
  await expect(page.locator('#results')).toContainText('Rows 101–200 of 201')

  await page.getByLabel('Analysis CSV', { exact: true }).setInputFiles({ name: 'oversized.csv', mimeType: 'text/csv', buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 'x') })
  await expect(page.getByRole('alert', { name: 'Analysis error' })).toContainText('no larger than 10 MiB')
  await expect(page.getByRole('button', { name: 'Analyze CSV', exact: true })).toBeDisabled()
})

test('backend failure and recovery are visible and the mobile navigation works', async ({ page }) => {
  await page.route('**/api/health', route => route.abort())
  await page.goto('/')
  await expect(page.getByText('API unavailable', { exact: true })).toBeVisible()
  await page.unroute('**/api/health')
  await page.getByRole('button', { name: 'Retry connection' }).click()
  await expect(page.getByText('API connected', { exact: true })).toBeVisible()
  await useDemo(page)

  await page.getByLabel('Analysis CSV', { exact: true }).setInputFiles({ name: 'testing.csv', mimeType: 'text/csv', buffer: csv(30) })
  await page.route('**/api/analyze?**', route => route.fulfill({ status: 503, body: 'Service unavailable' }))
  await page.getByRole('button', { name: 'Analyze CSV', exact: true }).click()
  await expect(page.getByRole('alert', { name: 'Analysis error' })).toContainText('analysis service is unavailable')
  await expect(page.getByText('API unavailable', { exact: true })).toBeVisible()
  await expect(page.locator('#results')).toContainText('Rows 1–90 of 90')

  await page.unroute('**/api/analyze?**')
  await page.getByRole('button', { name: 'Analyze CSV', exact: true }).click()
  await expect(page.getByText('API connected', { exact: true })).toBeVisible()
  await expect(page.locator('#results')).toContainText('Rows 1–30 of 30')

  await page.route('**/api/analyze?**', route => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ detail: 'Train a model with POST /api/train or load POST /api/demo first.' }) }))
  await page.getByRole('button', { name: 'Analyze CSV', exact: true }).click()
  await expect(page.getByText('No analysis yet', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Analyze CSV', exact: true })).toBeDisabled()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('link', { name: 'Upload dataset', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Analyze network traffic', exact: true })).toBeInViewport()
})
