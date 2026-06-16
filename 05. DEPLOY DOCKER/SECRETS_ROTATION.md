# SECRETS ROTATION — Cliender Desing Pro V1

> **Fecha detección:** 2026-05-28
> **Owner:** KAREN (Nico) · **Severidad:** CRÍTICA
> **Causa:** `05. DEPLOY DOCKER/.env` con secretos REALES en OneDrive shared (visible a los 9 miembros del equipo).

---

## ⚠️ Acción inmediata para Nico

Rotar las 3 claves listadas ABAJO **ASAP**. Mientras no se roten, asume las claves comprometidas — cualquiera del equipo con acceso al OneDrive shared (y su historial de versiones) las ha visto o podido ver.

Tras rotar, actualizar valores en `~/.env.cdpro` (NO en el `.env` del proyecto) y reiniciar el stack:

```bash
docker compose --env-file ~/.env.cdpro up -d --force-recreate cdpro-backend
```

---

## Claves filtradas

| # | Clave | Servicio | Riesgo | Dónde rotar |
|---|---|---|---|---|
| 1 | `ANTHROPIC_API_KEY` | Anthropic Claude API | Coste API ilimitado a nuestro nombre | Anthropic Console |
| 2 | `KIE_API_KEY` (= `KID_AI_API_KEY` duplicado) | Kie.ai | Coste API generación imagen/video | Kie.ai dashboard |
| 3 | `SUPABASE_SERVICE_KEY` | Supabase (proyecto `opjwsdaphsulnpuvpout`) | **service_role — bypass RLS**, acceso total DB analytics | Supabase project settings |

> Valores eliminados de este documento por seguridad. Si necesitas el último valor pre-rotación, está en `~/.env.cdpro` (local Nico) o en el historial de versiones de OneDrive (privado).

---

## Pasos detallados de rotación

### 1. Anthropic — `ANTHROPIC_API_KEY`

1. Login en https://console.anthropic.com/
2. Settings → API Keys
3. Localizar la key activa (prefijo `sk-ant-api03-N-5L4p11...`)
4. **Revoke** esa key
5. **Create Key** nueva con mismo nombre/scope
6. Copiar nuevo valor a `~/.env.cdpro` línea `ANTHROPIC_API_KEY=`

### 2. Kie.ai — `KIE_API_KEY`

1. Login en https://kie.ai/ → Dashboard
2. API Keys → revocar la key `74946423...`
3. Generar nueva key
4. Copiar nuevo valor a `~/.env.cdpro` línea `KIE_API_KEY=`
5. Nota: el alias `KID_AI_API_KEY` ha sido eliminado del `.env` (solo se usa `KIE_*` en el código).

### 3. Supabase — `SUPABASE_SERVICE_KEY` (CRÍTICO)

1. Login en https://supabase.com/dashboard
2. Project: `opjwsdaphsulnpuvpout` (Design Pro Analytics)
3. Project Settings → API → Project API keys
4. **Reset service_role key**
5. Copiar nuevo valor a `~/.env.cdpro` línea `SUPABASE_SERVICE_KEY=`
6. Revisar logs de Supabase para actividad anómala con la key antigua entre 2026-05-27 y la rotación

---

## Hardening aplicado (2026-05-28)

- Secretos reales movidos a `~/.env.cdpro` (chmod 600, fuera de OneDrive).
- `05. DEPLOY DOCKER/.env` reescrito con solo placeholders.
- Líneas muertas `KID_AI_API_KEY` y `KID_AI_BASE_URL` eliminadas (el código solo usa `KIE_*`).
- `.gitignore` reforzado: `.env*` bloqueado, `.env.example` permitido explícitamente.
- docker-compose debe arrancar siempre con `--env-file ~/.env.cdpro`.

---

## Checklist post-rotación

- [ ] Anthropic key revocada y nueva en `~/.env.cdpro`
- [ ] Kie.ai key revocada y nueva en `~/.env.cdpro`
- [ ] Supabase service_role reseteada y nueva en `~/.env.cdpro`
- [ ] `docker compose --env-file ~/.env.cdpro up -d --force-recreate` ejecutado
- [ ] `docker ps` muestra `cdpro-backend (healthy)`
- [ ] Health check backend: `curl http://localhost:8000/health` responde OK
- [ ] Entrada anotada en `MEMORIA_MASTER.md` sección historial

---

## Conexión con reglas

- [`.claude/rules/claude-config-discipline.md`](../../../.claude/rules/claude-config-discipline.md) — secretos fuera de OneDrive.
- [`.claude/rules/raiz-limpia.md`](../../../.claude/rules/raiz-limpia.md) — `.env` permitido solo si gitignored y sin secretos reales.
