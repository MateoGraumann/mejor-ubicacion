# Diseño: resultados compactos sin scroll

## Objetivo

Reorganizar la pantalla de resultados para que la información principal sea visible en una sola vista de escritorio, sin modificar la barra de búsqueda ni la card actual de Score de viabilidad.

## Hallazgos del diseño actual

Referencias analizadas:

- `src/components/ScoreCard.tsx`: concentra el score total y los tres pilares.
- `src/components/CompetitorList.tsx`: muestra competencia directa e indirecta en listas verticales extensas.
- `src/components/FactorList.tsx`: muestra demanda y rango etario en una card separada.
- `src/components/EvaluateClient.tsx`: apila las cards verticalmente, lo que obliga a hacer scroll.

El patrón visual existente usa cards blancas, bordes `stone`, radios amplios, fondo cálido y colores diferenciados por pilar. El rediseño conserva ese lenguaje visual.

## Decisiones aprobadas

1. La barra de búsqueda mantiene estructura, contenido y comportamiento.
2. La card de Score de viabilidad mantiene estructura, métricas y comportamiento.
3. Los factores de zona dejan de ocupar una card independiente.
4. Demanda y rango etario se muestran como dos KPIs compactos.
5. La interfaz no muestra competidores indirectos.
6. La competencia directa mantiene nombre, distancia, rating y cantidad de reseñas.

## Layout de escritorio

Después de la búsqueda y la dirección resuelta, los resultados usan una grilla de dos columnas:

- Columna izquierda: `ScoreCard` sin modificaciones funcionales.
- Columna derecha:
  - Primera fila: dos KPIs, Demanda de la zona y Rango etario objetivo.
  - Segunda fila: lista compacta de competencia directa en una grilla de dos columnas.

Esta estructura permite ver score, indicadores demográficos y evidencia competitiva sin scroll en una pantalla de escritorio estándar.

## Responsive

- Escritorio: grilla principal de dos columnas.
- Tablet: columnas con proporción equilibrada; competidores en una o dos columnas según ancho.
- Móvil: apilado vertical. El requisito “sin scroll” aplica a escritorio; en móvil se prioriza legibilidad y accesibilidad.

## Componentes

### `EvaluateClient`

- Orquesta la nueva grilla de resultados.
- Deriva o recibe los factores necesarios para los KPIs.
- Pasa a `CompetitorList` únicamente competidores directos.

### `ZoneKpis`

Nuevo componente con dos indicadores:

- Demanda: densidad poblacional y nombre de zona.
- Rango etario: porcentaje de población entre 20 y 45 años.

No replica barras del Score de viabilidad; muestra valores concretos y explicables.

### `CompetitorList`

- Elimina la sección de competencia indirecta.
- Usa una grilla compacta de dos columnas en escritorio.
- Conserva nombre, distancia, rating y reseñas.
- Muestra contador de competencia directa y radio utilizado.

### `FactorList`

Se retira de la composición de resultados. Los avisos se muestran en un bloque compacto independiente cuando existan.

## Datos y API

El scoring interno puede seguir usando competencia indirecta si el algoritmo la necesita. La decisión aprobada afecta la presentación, no la fórmula. La API continúa devolviendo datos completos para trazabilidad, pero la UI filtra `competitionType === "direct"`.

Los KPIs se obtienen de los factores `density` y `age_20_45` ya presentes en la respuesta. No se agregan consultas externas.

## Estados y errores

- Loading: se conserva el estado actual del botón.
- Sin competidores directos: mensaje explícito dentro de la card.
- Factor demográfico faltante: KPI con `N/D`, sin inventar valores.
- Warnings: bloque compacto debajo de los KPIs o al final de la columna derecha.

## Validación

- Verificar a 1366×768 que búsqueda, score, KPIs y competencia directa entren sin scroll con un resultado típico de hasta ocho competidores.
- Verificar que no se rendericen competidores indirectos.
- Verificar que demanda y rango etario coincidan con `density` y `age_20_45`.
- Verificar estados sin datos, loading y warning.
- Ejecutar lint y build dentro de Docker.
