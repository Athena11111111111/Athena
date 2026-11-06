# Athena

Network traffic anomaly investigation with a Next.js dashboard and a Python Isolation Forest API.

## Run locally

Use Python 3.12 and Node.js 24. The frontend pins pnpm 12.3.4. Start both services in separate terminals.

From the repository root, set up and start the backend:

```sh
python -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-dev.txt
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

On Windows, use `.venv\Scripts\python.exe` in place of `.venv/bin/python`.

Start the frontend:

```sh
cd frontend
npx --yes pnpm@12.3.4 install --frozen-lockfile
npx --yes pnpm@12.3.4 dev
```

Open the frontend on port 3000. Next.js forwards `/api/*` requests to the backend on `127.0.0.1:8000`, including multipart CSV uploads and threshold/pagination query parameters. The browser always calls its own origin. If the backend is hosted elsewhere, set `ATHENA_API_URL` to its base URL (without `/api`) in the frontend server environment, then restart Next.js. Rebuild production assets after changing that address.

## Use the dashboard

- Click **Use synthetic demo** to train a synthetic baseline and analyze 90 held-out flows. This replaces any current model and is explicitly a synthetic demonstration, not CIC-IDS2017 or real-world accuracy validation.
- For your own data, select a labeled **Training CSV** and click **Train model**. Only benign rows enter training. Select a separate **Analysis CSV**, then click **Analyze CSV**; labels are optional for analysis.
- Change the **Anomaly threshold** and click **Apply threshold** to recompute classifications, totals, and metrics. Lower thresholds flag more flows. Reset restores the fitted default.
- Page through results, filter or search the current page, and click a row to inspect its features and supporting evidence. **Export page** downloads the filtered page with scores, predictions, and a synthetic-model flag.
- Training holdout metrics stay at the model's default threshold. Analysis metrics cover the whole analyzed file at the applied threshold. Do not evaluate accuracy by analyzing your training data again.

The dashboard reports connectivity and validation failures and preserves the last successful result when a request fails. Successful retraining clears previous analysis. File selections/results reset on page reload; the shared in-memory model resets on backend restart. This is a local, single-user MVP without authentication or persistent model storage.

See [backend/README.md](backend/README.md) for the seven required CSV columns, preprocessing, limits, API endpoints, and evaluation caveats. Real traffic data is not bundled.

## Validate

From the repository root:

```sh
.venv/bin/python -m pytest backend/tests -q
```

From `frontend`:

```sh
npx --yes pnpm@12.3.4 typecheck
npx --yes pnpm@12.3.4 build
```

Browser integration tests need both services running as above. They use actual training, demo, and analysis requests; offline/error scenarios are simulated in the browser. They replace the shared model with synthetic fixtures, so run against a development instance.

```sh
npx --yes pnpm@12.3.4 exec playwright install chromium
npx --yes pnpm@12.3.4 test:e2e
```

Set `ATHENA_BASE_URL` to test a different frontend address. If Chromium is already installed, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable instead of downloading a browser. Test artifacts are ignored by Git.
