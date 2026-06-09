"""Analytics de costes API — Cliender Design Pro V1.

Prefix: /analytics
Tablas Supabase (via REST PostgREST):
  - api_calls       → registro de cada llamada + cost_usd calculado
  - model_pricing   → precios base y overrides por modelo
  - spend_alerts    → alertas de gasto por periodo

NO usa supabase-py. Todas las queries van por httpx.AsyncClient
contra la REST API de PostgREST que expone Supabase.
"""
from __future__ import annotations

import logging
from app.core.config import get_settings
from datetime import datetime, timedelta, timezone
from math import ceil
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])

# ---------------------------------------------------------------------------
# Supabase client helpers
# ---------------------------------------------------------------------------

def _ensure_supabase_configured() -> None:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        raise HTTPException(
            status_code=503,
            detail="Analytics no configurado: SUPABASE_URL/SERVICE_KEY ausentes",
        )


def _supabase_headers() -> dict[str, str]:
    _ensure_supabase_configured()
    service_key = get_settings().supabase_service_key
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _supabase_url(table: str) -> str:
    _ensure_supabase_configured()
    base = get_settings().supabase_url.rstrip("/")
    return f"{base}/rest/v1/{table}"


async def _supabase_get(
    table: str,
    params: dict[str, Any] | None = None,
    extra_headers: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    headers = _supabase_headers()
    if extra_headers:
        headers.update(extra_headers)
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            _supabase_url(table),
            headers=headers,
            params=params or {},
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body = exc.response.text[:500] if exc.response is not None else ""
            logger.error("Supabase GET %s failed: %s body=%s", table, exc, body)
            logger.error("Supabase GET %s error: %s", table, body or exc)
            raise HTTPException(status_code=502, detail="Error de base de datos") from exc
        return response.json()


async def _supabase_post(table: str, payload: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            _supabase_url(table),
            headers=_supabase_headers(),
            json=payload,
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body = exc.response.text[:500] if exc.response is not None else ""
            logger.error("Supabase POST %s failed: %s body=%s", table, exc, body)
            logger.error("Supabase POST %s error: %s", table, body or exc)
            raise HTTPException(status_code=502, detail="Error de base de datos") from exc
        data = response.json()
        return data[0] if isinstance(data, list) and data else data


async def _supabase_patch(
    table: str,
    row_filter: dict[str, str],
    payload: dict[str, Any],
) -> dict[str, Any]:
    params = {k: f"eq.{v}" for k, v in row_filter.items()}
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.patch(
            _supabase_url(table),
            headers=_supabase_headers(),
            params=params,
            json=payload,
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body = exc.response.text[:500] if exc.response is not None else ""
            logger.error("Supabase PATCH %s failed: %s body=%s", table, exc, body)
            logger.error("Supabase PATCH %s error: %s", table, body or exc)
            raise HTTPException(status_code=502, detail="Error de base de datos") from exc
        data = response.json()
        return data[0] if isinstance(data, list) and data else data


# ---------------------------------------------------------------------------
# Schemas — request / response
# ---------------------------------------------------------------------------

class TrackRequest(BaseModel):
    session_id: str
    model: str
    provider: str
    tokens_in: int = 0
    tokens_out: int = 0
    endpoint: str = ""
    node_type: str = ""
    client_name: str = ""
    agent_name: str = ""
    brief_snippet: str = ""
    status: str = "ok"
    error_msg: str = ""
    duration_ms: int = 0


class TrackResponse(BaseModel):
    id: Optional[str] = None
    cost_usd: float = 0.0
    status: str = "tracked"
    error: Optional[str] = None


class ModelBreakdown(BaseModel):
    model: str
    calls: int
    cost_usd: float
    tokens_in: int
    tokens_out: int


class ProviderBreakdown(BaseModel):
    provider: str
    calls: int
    cost_usd: float


class AlertStatus(BaseModel):
    triggered: bool
    limit_usd: Optional[float]
    current_usd: float


class SummaryResponse(BaseModel):
    period: str
    total_cost_usd: float
    total_calls: int
    total_tokens_in: int
    total_tokens_out: int
    by_model: list[ModelBreakdown]
    by_provider: list[ProviderBreakdown]
    alert: AlertStatus


class HistoryItem(BaseModel):
    id: str
    created_at: str
    session_id: str
    model: str
    provider: str
    tokens_in: int
    tokens_out: int
    cost_usd: float
    endpoint: str
    node_type: str
    client_name: str
    agent_name: str
    brief_snippet: str
    status: str
    error_msg: str
    duration_ms: int


class HistoryResponse(BaseModel):
    items: list[HistoryItem]
    total: int
    page: int
    pages: int


class PricingRow(BaseModel):
    id: str
    model: str
    provider: str
    price_per_1k_in: float
    price_per_1k_out: float
    override_per_1k_in: Optional[float] = None
    override_per_1k_out: Optional[float] = None
    updated_at: Optional[str] = None


class PricingUpdateRequest(BaseModel):
    override_per_1k_in: Optional[float] = Field(None, ge=0)
    override_per_1k_out: Optional[float] = Field(None, ge=0)


class AlertRow(BaseModel):
    id: str
    period: str
    limit_usd: Optional[float]
    enabled: bool
    updated_at: Optional[str] = None


class AlertUpdateRequest(BaseModel):
    limit_usd: Optional[float] = Field(None, ge=0)
    enabled: Optional[bool] = None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _fetch_pricing(model: str, provider: str) -> tuple[float, float]:
    """Retorna (price_in, price_out) efectivos — override si existe, else base."""
    try:
        rows = await _supabase_get(
            "model_pricing",
            params={"model": f"eq.{model}", "provider": f"eq.{provider}", "limit": "1"},
        )
        if not rows:
            return 0.0, 0.0
        row = rows[0]
        price_in = row.get("override_per_1k_in") or row.get("price_per_1k_in") or 0.0
        price_out = row.get("override_per_1k_out") or row.get("price_per_1k_out") or 0.0
        return float(price_in), float(price_out)
    except Exception as exc:
        logger.warning("No se pudo obtener pricing para %s/%s: %s", model, provider, exc)
        return 0.0, 0.0


def _calc_cost(tokens_in: int, tokens_out: int, price_in: float, price_out: float) -> float:
    return (tokens_in / 1000) * price_in + (tokens_out / 1000) * price_out


def _period_since(period: str) -> str | None:
    """ISO timestamp del inicio del periodo, o None para 'all'."""
    now = datetime.now(timezone.utc)
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return start.isoformat()
    if period == "7d":
        return (now - timedelta(days=7)).isoformat()
    if period == "30d":
        return (now - timedelta(days=30)).isoformat()
    return None  # "all"


async def _fetch_calls_for_summary(since: str | None) -> list[dict[str, Any]]:
    """Descarga api_calls del periodo para agregación en Python."""
    params: dict[str, Any] = {
        "select": "model,provider,tokens_in,tokens_out,cost_usd",
        "order": "created_at.desc",
        "limit": "10000",
    }
    if since:
        params["created_at"] = f"gte.{since}"
    try:
        return await _supabase_get("api_calls", params=params)
    except Exception as exc:
        logger.error("Error fetching api_calls for summary: %s", exc)
        return []


async def _fetch_active_alert(period: str) -> dict[str, Any] | None:
    try:
        rows = await _supabase_get(
            "spend_alerts",
            params={"period": f"eq.{period}", "enabled": "eq.true", "limit": "1"},
        )
        return rows[0] if rows else None
    except Exception:
        return None


async def _do_track(req: TrackRequest) -> TrackResponse:
    """Lógica real de inserción — usada internamente por /track."""
    price_in, price_out = await _fetch_pricing(req.model, req.provider)
    cost_usd = _calc_cost(req.tokens_in, req.tokens_out, price_in, price_out)

    payload: dict[str, Any] = {
        "session_id": req.session_id,
        "model": req.model,
        "provider": req.provider,
        "tokens_in": req.tokens_in,
        "tokens_out": req.tokens_out,
        "cost_usd": round(cost_usd, 8),
        "endpoint": req.endpoint,
        "node_type": req.node_type,
        "client_name": req.client_name,
        "agent_name": req.agent_name,
        "brief_snippet": req.brief_snippet,
        "status": req.status,
        "error_msg": req.error_msg,
        "duration_ms": req.duration_ms,
    }
    inserted = await _supabase_post("api_calls", payload)
    return TrackResponse(
        id=inserted.get("id"),
        cost_usd=cost_usd,
        status="tracked",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/track", response_model=TrackResponse)
async def track_call(req: TrackRequest) -> TrackResponse:
    """Registra una llamada API y calcula cost_usd desde model_pricing.

    Falla silenciosamente — nunca bloquea el flujo del agente.
    """
    try:
        return await _do_track(req)
    except Exception as exc:
        logger.error("track_call error: %s", exc)
        return TrackResponse(status="error", error=str(exc))


@router.get("/summary", response_model=SummaryResponse)
async def get_summary(
    period: str = Query("today", pattern="^(today|7d|30d|all)$"),
) -> SummaryResponse:
    """Resumen de gasto: total, desglose por modelo/proveedor y estado de alerta."""
    since = _period_since(period)
    rows = await _fetch_calls_for_summary(since)

    total_cost = 0.0
    total_calls = len(rows)
    total_tokens_in = 0
    total_tokens_out = 0
    model_map: dict[str, dict[str, Any]] = {}
    provider_map: dict[str, dict[str, Any]] = {}

    for row in rows:
        cost = float(row.get("cost_usd") or 0.0)
        tin = int(row.get("tokens_in") or 0)
        tout = int(row.get("tokens_out") or 0)
        model = row.get("model") or "unknown"
        provider = row.get("provider") or "unknown"

        total_cost += cost
        total_tokens_in += tin
        total_tokens_out += tout

        if model not in model_map:
            model_map[model] = {"calls": 0, "cost_usd": 0.0, "tokens_in": 0, "tokens_out": 0}
        model_map[model]["calls"] += 1
        model_map[model]["cost_usd"] += cost
        model_map[model]["tokens_in"] += tin
        model_map[model]["tokens_out"] += tout

        if provider not in provider_map:
            provider_map[provider] = {"calls": 0, "cost_usd": 0.0}
        provider_map[provider]["calls"] += 1
        provider_map[provider]["cost_usd"] += cost

    by_model = [
        ModelBreakdown(
            model=m,
            calls=v["calls"],
            cost_usd=round(v["cost_usd"], 6),
            tokens_in=v["tokens_in"],
            tokens_out=v["tokens_out"],
        )
        for m, v in sorted(model_map.items(), key=lambda x: -x[1]["cost_usd"])
    ]
    by_provider = [
        ProviderBreakdown(
            provider=p,
            calls=v["calls"],
            cost_usd=round(v["cost_usd"], 6),
        )
        for p, v in sorted(provider_map.items(), key=lambda x: -x[1]["cost_usd"])
    ]

    alert_row = await _fetch_active_alert(period)
    alert_limit = float(alert_row["limit_usd"]) if alert_row and alert_row.get("limit_usd") else None
    alert_triggered = bool(alert_limit and total_cost >= alert_limit)

    return SummaryResponse(
        period=period,
        total_cost_usd=round(total_cost, 6),
        total_calls=total_calls,
        total_tokens_in=total_tokens_in,
        total_tokens_out=total_tokens_out,
        by_model=by_model,
        by_provider=by_provider,
        alert=AlertStatus(
            triggered=alert_triggered,
            limit_usd=alert_limit,
            current_usd=round(total_cost, 6),
        ),
    )


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    model: str = Query(""),
    provider: str = Query(""),
    from_date: str = Query(""),
    to_date: str = Query(""),
) -> HistoryResponse:
    """Lista paginada de api_calls con filtros opcionales por modelo, proveedor y fechas."""
    offset = (page - 1) * limit

    params: dict[str, Any] = {
        "select": "*",
        "order": "created_at.desc",
        "limit": str(limit),
        "offset": str(offset),
    }
    if model:
        params["model"] = f"eq.{model}"
    if provider:
        params["provider"] = f"eq.{provider}"
    if from_date:
        params["created_at"] = f"gte.{from_date}"
    if to_date:
        # Combinamos con `and` de PostgREST cuando ya existe filtro de fecha
        if from_date:
            params["and"] = f"(created_at.lte.{to_date})"
        else:
            params["created_at"] = f"lte.{to_date}"

    count_headers = {**_supabase_headers(), "Prefer": "count=exact"}

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            _supabase_url("api_calls"),
            headers=count_headers,
            params=params,
        )
        if response.status_code not in (200, 206):
            raise HTTPException(status_code=502, detail="Error consultando historial en Supabase")

        total = 0
        content_range = response.headers.get("content-range", "")
        if "/" in content_range:
            try:
                total = int(content_range.split("/")[1])
            except ValueError:
                total = 0

        rows = response.json()

    items = [
        HistoryItem(
            id=str(row.get("id", "")),
            created_at=str(row.get("created_at", "")),
            session_id=str(row.get("session_id", "")),
            model=str(row.get("model", "")),
            provider=str(row.get("provider", "")),
            tokens_in=int(row.get("tokens_in") or 0),
            tokens_out=int(row.get("tokens_out") or 0),
            cost_usd=float(row.get("cost_usd") or 0.0),
            endpoint=str(row.get("endpoint", "")),
            node_type=str(row.get("node_type", "")),
            client_name=str(row.get("client_name", "")),
            agent_name=str(row.get("agent_name", "")),
            brief_snippet=str(row.get("brief_snippet", "")),
            status=str(row.get("status", "")),
            error_msg=str(row.get("error_msg", "")),
            duration_ms=int(row.get("duration_ms") or 0),
        )
        for row in rows
    ]

    pages = ceil(total / limit) if total > 0 else 1
    return HistoryResponse(items=items, total=total, page=page, pages=pages)


@router.get("/pricing", response_model=list[PricingRow])
async def get_pricing() -> list[PricingRow]:
    """Lista completa de model_pricing ordenada por proveedor y modelo."""
    rows = await _supabase_get("model_pricing", params={"order": "provider.asc,model.asc"})
    return [
        PricingRow(
            id=str(row.get("id", "")),
            model=str(row.get("model", "")),
            provider=str(row.get("provider", "")),
            price_per_1k_in=float(row.get("price_per_1k_in") or 0.0),
            price_per_1k_out=float(row.get("price_per_1k_out") or 0.0),
            override_per_1k_in=row.get("override_per_1k_in"),
            override_per_1k_out=row.get("override_per_1k_out"),
            updated_at=row.get("updated_at"),
        )
        for row in rows
    ]


@router.put("/pricing/{model}", response_model=PricingRow)
async def update_pricing(model: str, body: PricingUpdateRequest) -> PricingRow:
    """Actualiza override_per_1k_in y/o override_per_1k_out de un modelo."""
    payload: dict[str, Any] = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if body.override_per_1k_in is not None:
        payload["override_per_1k_in"] = body.override_per_1k_in
    if body.override_per_1k_out is not None:
        payload["override_per_1k_out"] = body.override_per_1k_out

    if len(payload) == 1:
        raise HTTPException(status_code=400, detail="Envía al menos override_per_1k_in o override_per_1k_out.")

    try:
        updated = await _supabase_patch("model_pricing", {"model": model}, payload)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc

    return PricingRow(
        id=str(updated.get("id", "")),
        model=str(updated.get("model", "")),
        provider=str(updated.get("provider", "")),
        price_per_1k_in=float(updated.get("price_per_1k_in") or 0.0),
        price_per_1k_out=float(updated.get("price_per_1k_out") or 0.0),
        override_per_1k_in=updated.get("override_per_1k_in"),
        override_per_1k_out=updated.get("override_per_1k_out"),
        updated_at=updated.get("updated_at"),
    )


@router.get("/alerts", response_model=list[AlertRow])
async def get_alerts() -> list[AlertRow]:
    """Lista todas las spend_alerts."""
    rows = await _supabase_get("spend_alerts", params={"order": "period.asc"})
    return [
        AlertRow(
            id=str(row.get("id", "")),
            period=str(row.get("period", "")),
            limit_usd=row.get("limit_usd"),
            enabled=bool(row.get("enabled", False)),
            updated_at=row.get("updated_at"),
        )
        for row in rows
    ]


@router.put("/alerts/{alert_id}", response_model=AlertRow)
async def update_alert(alert_id: str, body: AlertUpdateRequest) -> AlertRow:
    """Actualiza limit_usd y/o enabled de una spend_alert por id."""
    payload: dict[str, Any] = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if body.limit_usd is not None:
        payload["limit_usd"] = body.limit_usd
    if body.enabled is not None:
        payload["enabled"] = body.enabled

    if len(payload) == 1:
        raise HTTPException(status_code=400, detail="Envía al menos limit_usd o enabled.")

    try:
        updated = await _supabase_patch("spend_alerts", {"id": alert_id}, payload)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc

    return AlertRow(
        id=str(updated.get("id", "")),
        period=str(updated.get("period", "")),
        limit_usd=updated.get("limit_usd"),
        enabled=bool(updated.get("enabled", False)),
        updated_at=updated.get("updated_at"),
    )
