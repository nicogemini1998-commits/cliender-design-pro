# Cliender DesignPro V1 — Arranque para el equipo

> **Tiempo estimado:** 5 minutos la primera vez · 10 segundos las siguientes.

---

## Repo GitHub (fuente de verdad)

**https://github.com/nicogemini1998-commits/cliender-design-pro**

Cada vez que Nico actualice la herramienta, puedes bajar los cambios:
```bash
git pull origin main
```
Si no tienes el repo clonado todavia, ve a la sección «Actualizar desde GitHub» al final de este documento.

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

---

## Actualizar desde GitHub (si recibes cambios de Nico)

Si Nico te avisa de que hay una versión nueva:

**Si ya tienes la carpeta del proyecto (via OneDrive):**
```bash
cd "[ruta a 02. Cliender Desing Pro V1]"
git pull origin main
cd "05. DEPLOY DOCKER"
./arrancar.sh restart
```

**Si quieres clonar desde GitHub directamente:**
```bash
git clone https://github.com/nicogemini1998-commits/cliender-design-pro.git
cd cliender-design-pro/05.\ DEPLOY\ DOCKER
cp .env.cdpro.example .env.cdpro
# Edita .env.cdpro con las claves (pedirlas a Nico)
./arrancar.sh
```

*Owner: KAREN (Nico) · v1.1 · 2026-06-16*
