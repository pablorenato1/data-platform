"""Baixa a malha dos municípios de Pernambuco (IBGE) e grava site/geo/pe-municipios.json.

O arquivo já vem com os contornos projetados em coordenadas de SVG (uma projeção simples, com a
correção do cosseno da latitude), então a página só desenha os caminhos. A chave de cada município é
o código do IBGE sem o dígito verificador (6 dígitos), igual ao municipio_id dos marts.
Fernando de Noronha não entra no mapa (o painel desenha só o continente).
Roda uma vez (a malha quase não muda): python export/gerar_malha_pe.py
"""
from __future__ import annotations

import gzip
import json
import math
import urllib.request
from pathlib import Path

URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/26"
    "?intrarregiao=municipio&formato=application/vnd.geo%2Bjson&qualidade=minima"
)
DESTINO = Path(__file__).resolve().parent.parent / "site" / "geo" / "pe-municipios.json"
NORONHA = "260545"  # fica de fora do mapa
LARGURA = 1000.0


def aneis(geometria):
    if geometria["type"] == "Polygon":
        return geometria["coordinates"]
    return [anel for poligono in geometria["coordinates"] for anel in poligono]


def main() -> None:
    with urllib.request.urlopen(URL, timeout=60) as r:
        corpo = r.read()
    if corpo[:2] == bytes([0x1F, 0x8B]):  # o servidor do IBGE responde compactado (gzip)
        corpo = gzip.decompress(corpo)
    geo = json.loads(corpo)

    feicoes = [(f["properties"]["codarea"][:6], aneis(f["geometry"])) for f in geo["features"]]
    continente = [(i, a) for i, a in feicoes if i != NORONHA]
    pontos = [p for _, a in continente for anel in a for p in anel]
    lon0, lon1 = min(p[0] for p in pontos), max(p[0] for p in pontos)
    lat0, lat1 = min(p[1] for p in pontos), max(p[1] for p in pontos)
    fator = math.cos(math.radians((lat0 + lat1) / 2))
    k = LARGURA / ((lon1 - lon0) * fator)
    altura = (lat1 - lat0) * k

    def projetar(lon, lat, dx=0.0, dy=0.0):
        return (lon - lon0) * fator * k + dx, (lat1 - lat) * k + dy

    def caminho(lista, dx=0.0, dy=0.0):
        partes = []
        for anel in lista:
            xy = [projetar(lon, lat, dx, dy) for lon, lat in anel]
            partes.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in xy) + "Z")
        return "".join(partes)

    municipios = {i: caminho(a) for i, a in continente}

    saida = {"largura": LARGURA, "altura": round(altura, 1), "municipios": municipios}
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(json.dumps(saida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(municipios)} municípios, {DESTINO.stat().st_size / 1024:.0f} KB em {DESTINO}")


if __name__ == "__main__":
    main()
