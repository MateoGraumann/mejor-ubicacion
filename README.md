# Mejor Ubicación

MVP para evaluar viabilidad de **cafeterías** en **Concepción del Uruguay** (Entre Ríos).

Stack: Next.js + Prisma + PostgreSQL, todo vía **Docker Compose**.

## Requisitos

- Docker Desktop
- API key de [SerpAPI](https://serpapi.com/) (Google Maps engine)

## Arranque

```bash
cp .env.example .env
# Completá SERPAPI_API_KEY en .env
docker compose up --build
```

App: http://localhost:3000

## Comandos útiles (dentro del contenedor)

```bash
docker compose exec app npx prisma studio
docker compose exec app npm run calibrate
docker compose exec app npm run import-census
docker compose exec app npm run validate
docker compose exec app npm run clear-geocode-cache
```

Calibración HTTP:

```bash
curl -X POST http://localhost:3000/api/calibrate \
  -H "x-calibrate-secret: dev-calibrate-secret"
```

## Qué incluye el MVP

- Score 0–100 + desglose demanda / competencia / accesibilidad
- Geocoding real (Nominatim; Google opcional)
- Competencia vía SerpAPI Google Maps + cache + budget diario
- Radios censales (seed + import JSON)
- OSM Overpass para accesibilidad
- Calibración de pesos/umbrales desde datos de la ciudad
