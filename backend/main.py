"""Run from the repository root: python -m uvicorn backend.main:app."""
from contextlib import asynccontextmanager
from threading import Lock
import os
from typing import Annotated
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from .model import DataError, Detector, FEATURES, demo_data, read_csv

MAX_BYTES = 10 * 1024 * 1024
model_lock = Lock()


@asynccontextmanager
async def lifespan(app):
    app.state.detector = None
    yield


app = FastAPI(title="Athena API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv(
    "ATHENA_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(","),
    allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


async def dataset(file):
    try:
        content = await file.read(MAX_BYTES + 1)
    finally:
        await file.close()
    if len(content) > MAX_BYTES:
        raise HTTPException(413, "CSV exceeds the 10 MiB limit.")
    try:
        return await run_in_threadpool(read_csv, content)
    except DataError as exc:
        raise HTTPException(422, str(exc)) from exc


def current_model():
    detector = app.state.detector
    if detector is None:
        raise HTTPException(409, "Train a model with POST /api/train or load POST /api/demo first.")
    return detector


def train(frame, contamination, source):
    if not model_lock.acquire(blocking=False):
        raise HTTPException(409, "Another training request is running. Retry when it completes.")
    try:
        detector = Detector.train(frame, contamination, source)
        app.state.detector = detector  # Publish only a fully trained model.
        return detector
    except DataError as exc:
        raise HTTPException(422, str(exc)) from exc
    finally:
        model_lock.release()


@app.get("/api/health")
def health():
    return {"status": "ok", "model_ready": app.state.detector is not None}


@app.get("/api/model")
def model_info():
    return current_model().metadata


@app.get("/api/features")
def features():
    return {"required_columns": FEATURES, "training_label_column": "Label",
            "benign_labels": ["BENIGN", "NORMAL"], "max_rows": 50_000, "max_bytes": MAX_BYTES}


@app.post("/api/train")
async def train_upload(file: Annotated[UploadFile, File()],
                       contamination: float = Query(0.05, gt=0, le=0.5)):
    frame = await dataset(file)
    detector = await run_in_threadpool(train, frame, contamination, "uploaded")
    return detector.metadata


@app.post("/api/analyze")
async def analyze(file: Annotated[UploadFile, File()],
                  threshold: float | None = Query(None, ge=0, le=1),
                  limit: int = Query(100, ge=1, le=1000), offset: int = Query(0, ge=0)):
    detector = current_model()
    frame = await dataset(file)
    try:
        return await run_in_threadpool(detector.analyze, frame, threshold, limit, offset)
    except DataError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.post("/api/demo")
def demo(contamination: float = Query(0.05, gt=0, le=0.5),
         threshold: float | None = Query(None, ge=0, le=1)):
    frame = demo_data()
    detector = train(frame, contamination, "synthetic")
    # Analyze holdout rows only, so demo metrics are not training-set metrics.
    # Use the exact same held-out indices as the model training split.
    _, indices = train_test_split(np.arange(200), test_size=0.25, random_state=42)
    holdout = pd.concat([frame.iloc[indices], frame.iloc[200:]], ignore_index=True)
    return {"model": detector.metadata, "analysis": detector.analyze(holdout, threshold, limit=100)}
