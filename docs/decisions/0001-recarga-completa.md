# 0001. Recarga completa a cada execução

**Contexto.** O `tap-digisus` não usa chave de replicação nem estado incremental e percorre todos os anos de 2016 ao ano corrente para cada município.

**Decisão.** Cada execução recarrega todo o histórico (recarga completa), por simplicidade e idempotência.

**Consequências.** Repetir uma execução produz o mesmo resultado, e o upload usa `--overwrite`. Em contrapartida, cada execução refaz todas as requisições à API (limitadas por `rate_limit_per_minute`) e reenvia todos os arquivos.
