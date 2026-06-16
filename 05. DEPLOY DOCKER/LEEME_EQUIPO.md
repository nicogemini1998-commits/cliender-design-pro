# Cliender DesignPro V1 — Arranque para el equipo

> **Tiempo estimado:** 5 minutos la primera vez · 10 segundos las siguientes.

---

## Lo único que necesitas instalar (solo una vez)

**Docker Desktop** — descarga e instala según tu sistema:
- **Mac:** https://www.docker.com/products/docker-desktop → "Download for Mac"
- **Windows:** https://www.docker.com/products/docker-desktop → "Download for Windows"

Una vez instalado, abrelo y dejalo correr en segundo plano (icono de ballena en la barra de estado).

---

## Levantar la herramienta — 3 pasos

**1.** Abre esta carpeta desde OneDrive:
`CLIENDER BRAIN / 06. RECURSOS CLIENDER / 03. HERRAMIENTAS SOFTWARE CLIENDER / 01. APPS PROPIAS CLIENDER / 02. Cliender Desing Pro V1 / 05. DEPLOY DOCKER`

**2.** Asegurate de que OneDrive haya sincronizado esta carpeta (sin iconos de nube pendiente).

**2b.** La primera vez, crea el archivo de credenciales:

**Mac/Linux:**
```
cp .env.cdpro.example .env.cdpro
```
**Windows (PowerShell):**
```
Copy-Item .env.cdpro.example .env.cdpro
```
Luego edita `.env.cdpro` y rellena las claves reales (pedirlas a Nico).

**3.** Ejecuta el script:

**Mac:** Haz doble click en `arrancar.sh`
_(Si Mac pregunta si esta seguro, haz click en Abrir)_

Si el doble click no funciona, abre Terminal y escribe:
```
cd [arrastra la carpeta 05. DEPLOY DOCKER aqui]
./arrancar.sh
```

**Windows:** Haz doble click en `arrancar.bat`

La primera vez tarda **3-5 minutos**. Cuando termine, se abre automaticamente `http://localhost:2002`.

---

## Login

Usa tu correo corporativo Cliender y contrasena `Cliender123`.

| Quien | Email corporativo | Contrasena |
|-------|------------------|-----------|
| Nico | nicolasa@cliender.com | Cliender123 |
| Toni | toni@cliender.com | Cliender123 |
| Dan | danm@cliender.com | Cliender123 |
| Ruben | ruben.camara@cliender.com | Cliender123 |
| Ferran | ferranm@cliender.com | Cliender123 |
| Sara | sarau@cliender.com | Cliender123 |
| Pablo | pablop@cliender.com | Cliender123 |
| Vincent | vincentb@cliender.com | Cliender123 |
| Ethan | ethan.luque@cliender.com | Cliender123 |

---

## Comandos utiles (Terminal)

Desde la carpeta `05. DEPLOY DOCKER`:

```bash
./arrancar.sh stop      # Parar
./arrancar.sh restart   # Reiniciar con cambios
./arrancar.sh logs      # Ver logs si algo falla
```

---

## Soluciones rapidas

| Problema | Solucion |
|----------|----------|
| "Docker no esta corriendo" | Abre Docker Desktop y espera a que el icono deje de girar |
| "Puerto en uso" | Ejecuta `./arrancar.sh stop` y luego `./arrancar.sh` |
| Las imagenes no se generan | Espera 1 minuto (rate limit de API) y reintenta |
| No conecta al backend | Abre http://localhost:3003/health — si no responde: `./arrancar.sh restart` |

---

## URLs de la herramienta

| URL | Que es |
|-----|--------|
| **http://localhost:2002** | La herramienta principal (Canvas + Supercomputer) |
| http://localhost:3003/health | Backend API (debe responder OK) |

---

## Datos y credenciales

- Clientes, moodboards e imagenes generadas: guardados en **Supabase** (nube compartida del equipo)
- Las APIs y credenciales estan en `.env.cdpro` de esta carpeta — no compartir fuera del equipo

---

*Owner: KAREN (Nico) · v1.0 · 2026-06-04*
