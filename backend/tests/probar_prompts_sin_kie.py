#!/usr/bin/env python3
"""Inspector de prompts SHAQ — NO gasta créditos KIE.ai.

Llama únicamente al endpoint /agent/run (cognición Claude). Ese endpoint
genera el prompt pero NUNCA invoca KIE.ai (eso vive en /generate). Sirve para
verificar QUÉ prompt están dando los agentes antes de gastar un solo crédito.

Uso:
    python3 probar_prompts_sin_kie.py
    python3 probar_prompts_sin_kie.py --image https://url/a/imagen-storyboard.jpg
    python3 probar_prompts_sin_kie.py --api http://localhost:3003

El flag --image prueba la COHERENCIA: SHAQ ve esa imagen (la misma que Seedance
usaría como first_frame) y debe describir fielmente lo que hay en ella + el
movimiento del clip. Pásale la URL de un storyboard real generado en el canvas.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request

SHAQ = {
    "id": "shaq",
    "name": "SHAQ",
    "role": "Senior Creative Director & Cinematographer",
    "specialty": "video advertising",
}


def _post(api: str, payload: dict, timeout: int = 120) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{api}/agent/run",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _run_case(api: str, title: str, payload: dict) -> None:
    print("\n" + "=" * 78)
    print(f"  {title}")
    print("=" * 78)
    print(f"  brief      : {payload['brief']}")
    print(f"  outputType : {payload['outputType']}")
    refs = payload.get("reference_images")
    print(f"  imagen ref : {refs[0][:70] + '…' if refs else '(ninguna)'}")
    try:
        out = _post(api, payload)
    except Exception as exc:  # noqa: BLE001
        print(f"\n  ❌ ERROR de red: {exc}")
        return
    err = out.get("error")
    prompt = out.get("refined_prompt", "")
    print(f"\n  --- PROMPT GENERADO POR {out.get('agent_name', 'SHAQ')} ---\n")
    print("  " + prompt.replace("\n", "\n  "))
    if err:
        print(f"\n  ⚠️  error backend: {err}")
    # Chequeos heurísticos rápidos de copyright/coherencia
    low = prompt.lower()
    flags = []
    for banned in ["rick sanchez", "morty smith", "nike", "spider-man",
                   "spiderman", "coca-cola", "iphone", "rolex", "disney", "marvel"]:
        if banned in low:
            flags.append(f"posible IP sin traducir: '{banned}'")
    if payload["outputType"] == "video" and "panel" in low and "grid" in low:
        flags.append("describe una CUADRÍCULA de storyboard (no debería para vídeo)")
    if flags:
        print("\n  🚩 AVISOS:")
        for f in flags:
            print(f"     - {f}")
    else:
        print("\n  ✅ sin banderas de copyright/incoherencia obvias")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://localhost:3003")
    ap.add_argument("--image", default=None,
                    help="URL http(s) de una imagen storyboard para probar coherencia")
    args = ap.parse_args()

    # Caso 1 — vídeo, brief con IP, SIN imagen (debe describir copyright-safe + 2D)
    _run_case(args.api, "CASO 1 · vídeo · brief Rick & Morty · sin imagen", {
        "brief": "crea un storyboard de rick y morty en el sofa viendo la television en el salon de casa",
        "agent": SHAQ,
        "outputType": "video",
        "reference_images": None,
    })

    # Caso 2 — imagen, brief con marca (debe traducir marca a descripción visual)
    _run_case(args.api, "CASO 2 · imagen · brief con marca Nike", {
        "brief": "anuncio estilo Nike de unas zapatillas deportivas corriendo en la ciudad",
        "agent": SHAQ,
        "outputType": "image",
        "reference_images": None,
    })

    # Caso 3 — vídeo CON imagen de referencia (COHERENCIA con el first_frame)
    if args.image:
        _run_case(args.api, "CASO 3 · vídeo · COHERENCIA con first_frame", {
            "brief": "anima esta escena dándole vida con movimiento cinematográfico",
            "agent": SHAQ,
            "outputType": "video",
            "reference_images": [args.image],
        })
    else:
        print("\n" + "-" * 78)
        print("  CASO 3 (coherencia con imagen) OMITIDO — pásale --image <url storyboard>")
        print("-" * 78)

    print("\n✔ Pruebas terminadas. CERO créditos KIE.ai consumidos.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
