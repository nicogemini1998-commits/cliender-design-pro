# Checklist Nico — Rotación secretos cdpro · 2026-05-28

> 3 claves comprometidas (estaban en `.env` versionado en OneDrive shared). Rotar HOY.

## Acciones

- [ ] Rotar `ANTHROPIC_API_KEY` en Anthropic Console → revocar la vieja, crear nueva.
- [ ] Rotar `KIE_API_KEY` en kie.ai dashboard → revocar la vieja, crear nueva.
- [ ] Rotar `SUPABASE_SERVICE_KEY` (proyecto `opjwsdaphsulnpuvpout`) → Settings → API → Reset service_role key.
- [ ] Actualizar `~/.env.cdpro` con las 3 claves nuevas (chmod 600, NO tocar `.env` del proyecto).
- [ ] `docker compose up -d --force-recreate` desde `09. PROYECTOS EN DESARROLLO/01. Cliender Desing Pro V1/05. DEPLOY DOCKER/`.
- [ ] Confirmar `curl -s http://localhost:3003/analytics/pricing` devuelve `200` (no `503`).
- [ ] Marcar este checklist como cerrado en BITACORA.

## Notas

- Guía detallada: `SECRETS_ROTATION.md` (mismo directorio).
- Si alguna rotación falla → no borrar la vieja hasta confirmar que la nueva funciona en stack.
- Verificar que `.env` del proyecto sigue con placeholders, no claves reales.
