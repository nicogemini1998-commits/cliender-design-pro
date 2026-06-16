import React, { useState, useEffect, useCallback, useRef } from 'react'
import { CDPRO_CONFIG } from './config.js'

// analytics.jsx — Panel de Analytics de costes API
// Design Pro v1 · Cliender

const API = CDPRO_CONFIG.API_BASE;

// ─── utils ───────────────────────────────────────────────────────────────────

function fmt$(n) {
  if (n === undefined || n === null) return "$0.000000";
  return "$" + Number(n).toFixed(6);
}
function fmtShort$(n) {
  if (!n) return "$0.00";
  const v = Number(n);
  if (v < 0.01) return "$" + v.toFixed(4);
  return "$" + v.toFixed(2);
}
function fmtNum(n) {
  return Number(n || 0).toLocaleString("es-ES");
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) +
    " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
function periodLabel(p) {
  return { today: "Hoy", "7d": "7 días", "30d": "30 días", all: "Todo" }[p] || p;
}

// ─── hook: API fetch ──────────────────────────────────────────────────────────

function useAnalytics(period) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/analytics/summary?period=${period}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSummary(await r.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);
  return { summary, loading, error, reload: load };
}

// ─── sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="an-stat-card" style={accent ? { borderColor: "rgba(143,126,233,0.35)" } : {}}>
      <div className="an-stat-label">{label}</div>
      <div className="an-stat-value" style={accent ? { color: "#A78BFA" } : {}}>{value}</div>
      {sub && <div className="an-stat-sub">{sub}</div>}
    </div>
  );
}

function AlertBanner({ alert }) {
  if (!alert || !alert.triggered) return null;
  const pct = Math.min(100, (alert.current_usd / alert.limit_usd) * 100).toFixed(0);
  return (
    <div className="an-alert-banner">
      <span className="an-alert-icon">⚠</span>
      <span>Alerta de gasto: <strong>{fmtShort$(alert.current_usd)}</strong> de <strong>{fmtShort$(alert.limit_usd)}</strong> ({pct}%) — límite {alert.period === "daily" ? "diario" : "mensual"} alcanzado</span>
    </div>
  );
}

function ModelTable({ rows }) {
  if (!rows || rows.length === 0) return <div className="an-empty">Sin datos</div>;
  return (
    <table className="an-table">
      <thead>
        <tr>
          <th>Modelo</th>
          <th>Proveedor</th>
          <th className="an-num">Calls</th>
          <th className="an-num">Tokens ↑</th>
          <th className="an-num">Tokens ↓</th>
          <th className="an-num">Coste</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td><span className="an-model-badge">{r.model}</span></td>
            <td><span className={`an-provider ${r.provider}`}>{r.provider}</span></td>
            <td className="an-num">{fmtNum(r.calls)}</td>
            <td className="an-num">{fmtNum(r.tokens_in)}</td>
            <td className="an-num">{fmtNum(r.tokens_out)}</td>
            <td className="an-num an-cost">{fmtShort$(r.cost_usd)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HistoryTab() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ model: "", provider: "", from_date: "", to_date: "" });

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 50, ...filters });
      const r = await fetch(`${API}/analytics/history?${params}`);
      const json = await r.json();
      setItems(json.items || []);
      setTotal(json.total || 0);
      setPages(json.pages || 1);
      setPage(p);
    } catch (e) { /* silencioso */ }
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(1); }, [load]);

  return (
    <div className="an-history">
      <div className="an-filter-row">
        <input className="an-input" placeholder="Modelo…" value={filters.model}
          onChange={(e) => setFilters({ ...filters, model: e.target.value })} />
        <select className="an-input" value={filters.provider}
          onChange={(e) => setFilters({ ...filters, provider: e.target.value })}>
          <option value="">Todos los proveedores</option>
          <option value="claude">Claude</option>
          <option value="kidai">Kid.ai</option>
        </select>
        <input type="date" className="an-input" value={filters.from_date}
          onChange={(e) => setFilters({ ...filters, from_date: e.target.value })} />
        <input type="date" className="an-input" value={filters.to_date}
          onChange={(e) => setFilters({ ...filters, to_date: e.target.value })} />
        <button className="an-btn" onClick={() => load(1)}>Filtrar</button>
      </div>

      <div className="an-history-meta">
        {total} registros
        {loading && <span className="an-spin"> ·</span>}
      </div>

      <div className="an-table-wrap">
        <table className="an-table an-table-sm">
          <thead>
            <tr>
              <th>Fecha</th><th>Modelo</th><th>Prov.</th>
              <th className="an-num">↑ tok</th><th className="an-num">↓ tok</th>
              <th className="an-num">Coste</th><th>Cliente</th><th>Agente</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className={r.status === "error" ? "an-row-error" : ""}>
                <td className="an-date">{fmtDate(r.created_at)}</td>
                <td><span className="an-model-badge sm">{r.model}</span></td>
                <td><span className={`an-provider ${r.provider}`}>{r.provider}</span></td>
                <td className="an-num">{fmtNum(r.tokens_in)}</td>
                <td className="an-num">{fmtNum(r.tokens_out)}</td>
                <td className="an-num an-cost">{fmt$(r.cost_usd)}</td>
                <td className="an-muted">{r.client_name || "—"}</td>
                <td className="an-muted">{r.agent_name || "—"}</td>
                <td><span className={`an-status ${r.status}`}>{r.status}</span></td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={9} className="an-empty">Sin registros</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="an-pagination">
          <button className="an-btn sm" disabled={page <= 1} onClick={() => load(page - 1)}>←</button>
          <span>{page} / {pages}</span>
          <button className="an-btn sm" disabled={page >= pages} onClick={() => load(page + 1)}>→</button>
        </div>
      )}
    </div>
  );
}

function PricingTab() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState({});
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch(`${API}/analytics/pricing`)
      .then((r) => r.json())
      .then((data) => {
        setRows(data);
        const init = {};
        data.forEach((r) => {
          init[r.model] = {
            override_per_1k_in: r.override_per_1k_in ?? "",
            override_per_1k_out: r.override_per_1k_out ?? "",
          };
        });
        setEditing(init);
      });
  }, []);

  const save = async (model) => {
    setSaving((s) => ({ ...s, [model]: true }));
    const body = {};
    const inv  = editing[model]?.override_per_1k_in;
    const outv = editing[model]?.override_per_1k_out;
    if (inv  !== "" && inv  !== undefined) body.override_per_1k_in  = parseFloat(inv);
    if (outv !== "" && outv !== undefined) body.override_per_1k_out = parseFloat(outv);
    try {
      const r = await fetch(`${API}/analytics/pricing/${encodeURIComponent(model)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setMsg("✓ Precio actualizado: " + model);
        setTimeout(() => setMsg(null), 2500);
      }
    } catch (e) { /* silencioso */ }
    setSaving((s) => ({ ...s, [model]: false }));
  };

  return (
    <div className="an-pricing">
      {msg && <div className="an-toast">{msg}</div>}
      <p className="an-pricing-note">
        Los overrides sobreescriben el precio base por modelo. Dejar vacío = usar precio oficial.
      </p>
      <div className="an-table-wrap">
        <table className="an-table">
          <thead>
            <tr>
              <th>Modelo</th><th>Prov.</th>
              <th className="an-num">Base ↑/1k</th><th className="an-num">Base ↓/1k</th>
              <th className="an-num">Override ↑/1k</th><th className="an-num">Override ↓/1k</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.model}>
                <td><span className="an-model-badge">{r.model}</span></td>
                <td><span className={`an-provider ${r.provider}`}>{r.provider}</span></td>
                <td className="an-num an-muted">{fmt$(r.price_per_1k_in)}</td>
                <td className="an-num an-muted">{fmt$(r.price_per_1k_out)}</td>
                <td className="an-num">
                  <input className="an-price-input" type="number" step="0.000001"
                    placeholder={r.price_per_1k_in}
                    value={editing[r.model]?.override_per_1k_in ?? ""}
                    onChange={(e) => setEditing((s) => ({ ...s, [r.model]: { ...s[r.model], override_per_1k_in: e.target.value } }))}
                  />
                </td>
                <td className="an-num">
                  <input className="an-price-input" type="number" step="0.000001"
                    placeholder={r.price_per_1k_out}
                    value={editing[r.model]?.override_per_1k_out ?? ""}
                    onChange={(e) => setEditing((s) => ({ ...s, [r.model]: { ...s[r.model], override_per_1k_out: e.target.value } }))}
                  />
                </td>
                <td>
                  <button className="an-btn sm accent" disabled={saving[r.model]} onClick={() => save(r.model)}>
                    {saving[r.model] ? "…" : "Guardar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertsTab() {
  const [alerts, setAlerts] = useState([]);
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState({});
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch(`${API}/analytics/alerts`)
      .then((r) => r.json())
      .then((data) => {
        setAlerts(data);
        const init = {};
        data.forEach((a) => { init[a.id] = { limit_usd: a.limit_usd, enabled: a.enabled }; });
        setEditing(init);
      });
  }, []);

  const save = async (id) => {
    setSaving((s) => ({ ...s, [id]: true }));
    try {
      await fetch(`${API}/analytics/alerts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing[id]),
      });
      setMsg("✓ Alerta guardada");
      setTimeout(() => setMsg(null), 2000);
    } catch (e) { /* silencioso */ }
    setSaving((s) => ({ ...s, [id]: false }));
  };

  const periodMap = { daily: "Diario", monthly: "Mensual" };

  return (
    <div className="an-alerts">
      {msg && <div className="an-toast">{msg}</div>}
      <p className="an-pricing-note">
        Recibirás una notificación visual cuando el gasto supere el límite configurado.
      </p>
      {alerts.map((a) => (
        <div key={a.id} className="an-alert-row">
          <div className="an-alert-period">{periodMap[a.period] || a.period}</div>
          <label className="an-toggle">
            <input type="checkbox"
              checked={editing[a.id]?.enabled ?? false}
              onChange={(e) => setEditing((s) => ({ ...s, [a.id]: { ...s[a.id], enabled: e.target.checked } }))}
            />
            <span className="an-toggle-track" />
          </label>
          <span className="an-alert-label">Límite:</span>
          <span className="an-alert-currency">$</span>
          <input className="an-input sm" type="number" step="0.5" min="0"
            value={editing[a.id]?.limit_usd ?? ""}
            onChange={(e) => setEditing((s) => ({ ...s, [a.id]: { ...s[a.id], limit_usd: parseFloat(e.target.value) } }))}
          />
          <button className="an-btn sm accent" disabled={saving[a.id]} onClick={() => save(a.id)}>
            {saving[a.id] ? "…" : "Guardar"}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

function AnalyticsPanel({ onClose }) {
  const [period, setPeriod] = useState("today");
  const [tab, setTab] = useState("overview");
  const { summary, loading, error, reload } = useAnalytics(period);

  const TABS = [
    { id: "overview", label: "Resumen" },
    { id: "history",  label: "Historial" },
    { id: "pricing",  label: "Precios" },
    { id: "alerts",   label: "Alertas" },
  ];

  return (
    <div className="an-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="an-panel">
        <div className="an-header">
          <div className="an-header-left">
            <span className="an-header-icon">📊</span>
            <span className="an-header-title">Analytics de costes API</span>
          </div>
          <div className="an-header-right">
            {tab === "overview" && (
              <div className="an-period-tabs">
                {["today", "7d", "30d", "all"].map((p) => (
                  <button key={p}
                    className={"an-period-btn" + (period === p ? " is-active" : "")}
                    onClick={() => setPeriod(p)}
                  >{periodLabel(p)}</button>
                ))}
              </div>
            )}
            <button className="an-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="an-nav">
          {TABS.map((t) => (
            <button key={t.id}
              className={"an-nav-btn" + (tab === t.id ? " is-active" : "")}
              onClick={() => setTab(t.id)}
            >{t.label}</button>
          ))}
          {tab === "overview" && (
            <button className="an-nav-reload" onClick={reload} title="Recargar">↻</button>
          )}
        </div>

        <div className="an-body">
          {tab === "overview" && (
            <>
              {summary?.alert?.triggered && <AlertBanner alert={summary.alert} />}
              {loading && <div className="an-loading">Cargando datos…</div>}
              {error && (
                <div className="an-error">
                  Error al conectar con el backend: {error}
                  <br /><small>¿Está corriendo el container cdpro-backend?</small>
                </div>
              )}
              {summary && !loading && (
                <>
                  <div className="an-stats-row">
                    <StatCard label="Gasto total"     value={fmtShort$(summary.total_cost_usd)}   sub={periodLabel(period)} accent />
                    <StatCard label="Llamadas API"    value={fmtNum(summary.total_calls)} />
                    <StatCard label="Tokens entrada"  value={fmtNum(summary.total_tokens_in)} />
                    <StatCard label="Tokens salida"   value={fmtNum(summary.total_tokens_out)} />
                  </div>

                  {summary.alert && summary.alert.limit_usd > 0 && (
                    <div className="an-limit-bar-wrap">
                      <div className="an-limit-bar-label">
                        <span>Límite {summary.alert.period === "daily" ? "diario" : "mensual"}</span>
                        <span>{fmtShort$(summary.alert.current_usd)} / {fmtShort$(summary.alert.limit_usd)}</span>
                      </div>
                      <div className="an-limit-bar">
                        <div
                          className={"an-limit-fill" + (summary.alert.triggered ? " danger" : "")}
                          style={{ width: Math.min(100, (summary.alert.current_usd / summary.alert.limit_usd) * 100) + "%" }}
                        />
                      </div>
                    </div>
                  )}

                  {summary.by_provider?.length > 0 && (
                    <div className="an-section">
                      <div className="an-section-title">Por proveedor</div>
                      <div className="an-provider-row">
                        {summary.by_provider.map((p) => (
                          <div key={p.provider} className={`an-provider-card ${p.provider}`}>
                            <div className="an-provider-name">{p.provider === "claude" ? "🧠 Claude" : "🎨 Kid.ai"}</div>
                            <div className="an-provider-cost">{fmtShort$(p.cost_usd)}</div>
                            <div className="an-provider-calls">{fmtNum(p.calls)} calls</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="an-section">
                    <div className="an-section-title">Por modelo</div>
                    <ModelTable rows={summary.by_model} />
                  </div>
                </>
              )}
            </>
          )}
          {tab === "history" && <HistoryTab />}
          {tab === "pricing" && <PricingTab />}
          {tab === "alerts"  && <AlertsTab />}
        </div>
      </div>
    </div>
  );
}

export { AnalyticsPanel }
