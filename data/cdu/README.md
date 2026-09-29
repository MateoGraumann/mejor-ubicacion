# Datos censales — Concepción del Uruguay

Reemplazá `census-tracts.json` con radios oficiales INDEC (geometría simplificada + población + NSE) y corré:

```bash
docker compose exec app npm run import-census
docker compose exec app npm run calibrate
```

El seed actual es un proxy sintético para el MVP.
