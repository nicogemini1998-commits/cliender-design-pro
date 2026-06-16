"""Guard anti-SSRF compartido para descargas de URLs externas.

Toda funcion que descargue una URL provista por el cliente (reference_images,
first_frame_url, media-proxy) DEBE validar el host con `assert_safe_url` antes
del GET. Bloquea IPs privadas, loopback, link-local (metadata cloud) y multicast.

Uso:
    from app.services.url_guard import assert_safe_url, SSRFBlockedError
    assert_safe_url(url)  # lanza SSRFBlockedError si es interna
"""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse


class SSRFBlockedError(ValueError):
    """La URL apunta a un recurso interno/privado y fue bloqueada."""


def _ip_is_blocked(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # no parseable → bloquear por precaucion
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local      # 169.254.x.x — metadata AWS/GCP/Azure
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def is_safe_url(url: str) -> bool:
    """True si la URL es http(s) hacia un host publico resoluble y no privado."""
    if not isinstance(url, str):
        return False
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    host = parsed.hostname
    if not host:
        return False
    # Bloquea hostnames internos comunes de Docker/cloud antes de resolver.
    lowered = host.lower()
    if lowered in ("localhost", "host.docker.internal", "metadata.google.internal") or lowered.endswith(".internal") or lowered.endswith(".local"):
        return False
    # Resuelve TODAS las IPs del host y bloquea si alguna es privada
    # (defiende contra DNS rebinding a un host con A-records publicos + privados).
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), proto=socket.IPPROTO_TCP)
    except Exception:
        return False
    if not infos:
        return False
    for info in infos:
        ip_str = info[4][0]
        if _ip_is_blocked(ip_str):
            return False
    return True


def assert_safe_url(url: str) -> None:
    """Lanza SSRFBlockedError si la URL no es segura para descargar."""
    if not is_safe_url(url):
        raise SSRFBlockedError(f"URL bloqueada por politica anti-SSRF: {str(url)[:80]}")
