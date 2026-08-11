"""Digisus tap class."""

from __future__ import annotations

import sys

from singer_sdk import Tap
from singer_sdk import typing as th  # JSON schema typing helpers

# TODO: Import your custom stream types here:
from tap_digisus import streams

if sys.version_info >= (3, 12):
    from typing import override
else:
    from typing_extensions import override


class TapDigisus(Tap):
    """Singer tap for Digisus."""

    name = "tap-digisus"

    config_jsonschema = th.PropertiesList(
        th.Property(
            "rate_limit_per_minute",
            th.IntegerType,
            default=50,
            title="Rate Limit (req/min)",
            description="Limite de requisições por minuto (API permite 60/min; usamos margem de segurança)",
        ),
    ).to_dict()

    @override
    def discover_streams(self) -> list[streams.DigisusStream]:
        return [
            streams.ResultadosMetasStream(self),
        ]


if __name__ == "__main__":
    TapDigisus.cli()
