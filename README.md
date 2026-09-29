# Mejor Ubicación

MVP para evaluar viabilidad de **cafeterías** en **Concepción del Uruguay** (Entre Ríos).

Stack: Next.js + Prisma + PostgreSQL, todo vía **Docker Compose**.

## Requisitos

- Docker Desktop

## Arranque

```bash
cp .env.example .env
docker compose up --build
```

App: http://localhost:3000

Por defecto `USE_MOCK_PROVIDERS=true` (no necesita Google API key). Para datos reales:

1. Seteá `GOOGLE_MAPS_API_KEY` en `.env`
2. `USE_MOCK_PROVIDERS=false`
3. `docker compose up --build`

## Comandos útiles (dentro del contenedor)

```bash
docker compose exec app npx prisma studio
docker compose exec app npm run calibrate
docker compose exec app npm run import-census
docker compose exec app npm run validate
```

Calibración HTTP:

```bash
curl -X POST http://localhost:3000/api/calibrate \
  -H "x-calibrate-secret: dev-calibrate-secret"
```

## Qué incluye el MVP

- Score 0–100 + desglose demanda / competencia / accesibilidad
- Geocoding cacheado + bbox CdU
- Places cache + budget diario
- Radios censales (seed sintético + import JSON)
- OSM Overpass (o mock) para accesibilidad
- Calibración de pesos/umbrales desde datos de la ciudad
