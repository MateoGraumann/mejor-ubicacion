# Compact Results Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar búsqueda, KPIs, score y competencia directa en una sola vista de escritorio sin scroll.

**Architecture:** `EvaluateClient` pasa de una pila vertical a una grilla responsive de dos columnas. Un componente nuevo `ZoneKpis` transforma los factores `density` y `age_20_45` en indicadores compactos; `CompetitorList` filtra y presenta solo competencia directa. El scoring y la API no cambian.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Docker Compose.

## Global Constraints

- La búsqueda mantiene comportamiento y mide 38 px de alto en escritorio.
- La card `ScoreCard` conserva contenido y comportamiento.
- Búsqueda y `ScoreCard` comparten ancho de columna.
- KPIs y búsqueda comparten borde superior y altura de 38 px.
- La separación vertical entre fila superior y resultados es de 6 px.
- Solo se muestran competidores directos.
- La dirección resuelta aparece al pie de la grilla.

---

### Task 1: KPIs de zona

**Files:**
- Create: `src/components/ZoneKpis.tsx`
- Delete: `src/components/FactorList.tsx`

**Interfaces:**
- Consumes: `factors: Factor[]`, donde `Factor` contiene `key`, `value` y `note`.
- Produces: `ZoneKpis({ factors })`, con KPIs de `density` y `age_20_45`.

- [ ] **Step 1: Crear el componente**

Definir `ZoneKpis` para buscar los factores por clave, formatear densidad con separador de miles y rango etario como porcentaje. Si falta un factor, mostrar `N/D`.

- [ ] **Step 2: Aplicar layout compacto**

Usar dos cards de `h-[38px]`, alineadas horizontalmente desde `lg`, con valor principal y descripción en una sola línea visual.

- [ ] **Step 3: Retirar la card anterior**

Eliminar `FactorList.tsx` porque su contenido pasa a `ZoneKpis` y los avisos se renderizan desde `EvaluateClient`.

### Task 2: Competencia directa compacta

**Files:**
- Modify: `src/components/CompetitorList.tsx`

**Interfaces:**
- Consumes: `competitors: Competitor[]`, `radiusM: number`.
- Produces: una card que filtra `competitionType === "direct"` y muestra nombre, distancia, rating y reseñas.

- [ ] **Step 1: Filtrar competencia**

Crear `directCompetitors` y usarlo para contador, empty state y renderizado. No renderizar indirectos.

- [ ] **Step 2: Compactar la lista**

Reemplazar grupos verticales por una grilla de dos columnas en escritorio, con espaciado reducido y altura compatible con `ScoreCard`.

### Task 3: Grilla principal y responsive

**Files:**
- Modify: `src/components/EvaluateClient.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: respuesta existente de `/api/evaluate`.
- Produces: grilla superior `AddressForm + ZoneKpis`, grilla inferior `ScoreCard + CompetitorList`, dirección al pie y warnings compactos.

- [ ] **Step 1: Reorganizar `EvaluateClient`**

Usar una grilla `lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]` con `gap-x` consistente y `gap-y-[6px]`. La búsqueda ocupa la columna izquierda y `ZoneKpis` la derecha.

- [ ] **Step 2: Componer resultados**

Cuando existe resultado, mostrar `ScoreCard` en la izquierda y `CompetitorList` en la derecha dentro de la misma grilla. Mostrar dirección y coordenadas en una línea compacta al pie.

- [ ] **Step 3: Manejar warnings**

Mostrar warnings debajo de los KPIs o al pie de la columna derecha, sin recuperar `FactorList`.

- [ ] **Step 4: Ampliar el contenedor**

Cambiar el ancho máximo de página y cliente de `max-w-3xl` a `max-w-6xl`; reducir espaciado vertical del encabezado para entrar en 1366×768.

### Task 4: Validación y entrega

**Files:**
- Verify: todos los archivos modificados

- [ ] **Step 1: Ejecutar lint**

Run: `docker compose exec app npm run lint`
Expected: exit code 0.

- [ ] **Step 2: Ejecutar build**

Run: `docker compose exec app npm run build`
Expected: exit code 0 y rutas `/`, `/api/evaluate`, `/api/calibrate` compiladas.

- [ ] **Step 3: Probar evaluación**

Enviar `POST /api/evaluate` con `Galarza 754`; verificar respuesta 200, KPIs disponibles y lista con competencia directa.

- [ ] **Step 4: Revisar diff y secretos**

Confirmar que `.env` no esté staged y que el diff incluya solamente código, documentación y configuración segura.

- [ ] **Step 5: Commit y push**

```bash
git add -A
git commit -m "feat: compact location results dashboard"
git push origin main
```
