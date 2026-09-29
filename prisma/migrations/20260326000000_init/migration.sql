-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "bbox_min_lat" DOUBLE PRECISION NOT NULL,
    "bbox_max_lat" DOUBLE PRECISION NOT NULL,
    "bbox_min_lng" DOUBLE PRECISION NOT NULL,
    "bbox_max_lng" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "google_types" TEXT[],
    "default_radius_m" INTEGER NOT NULL DEFAULT 500,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "census_tracts" (
    "id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "indec_code" TEXT NOT NULL,
    "name" TEXT,
    "geometry_simplified" JSONB NOT NULL,
    "population" INTEGER NOT NULL DEFAULT 0,
    "area_km2" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "socioeconomic_index" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "age_bands" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "census_tracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "place_caches" (
    "id" TEXT NOT NULL,
    "google_place_id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "category_slug" TEXT NOT NULL,
    "grid_cell" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "rating" DOUBLE PRECISION,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "competition_type" TEXT NOT NULL DEFAULT 'direct',
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "place_caches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geocode_caches" (
    "id" TEXT NOT NULL,
    "address_normalized" TEXT NOT NULL,
    "formatted_address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geocode_caches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "osm_caches" (
    "id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "grid_cell" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "osm_caches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage_daily" (
    "id" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "places_calls" INTEGER NOT NULL DEFAULT 0,
    "geocode_calls" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_usage_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_configs" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "weights" JSONB NOT NULL,
    "thresholds" JSONB NOT NULL,
    "radii_m" JSONB NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoring_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "scoring_config_id" TEXT NOT NULL,
    "address_input" TEXT NOT NULL,
    "formatted_address" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "score_total" DOUBLE PRECISION NOT NULL,
    "score_demand" DOUBLE PRECISION,
    "score_competition" DOUBLE PRECISION,
    "score_accessibility" DOUBLE PRECISION,
    "raw_inputs" JSONB NOT NULL,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_factors" (
    "id" TEXT NOT NULL,
    "evaluation_id" TEXT NOT NULL,
    "pillar" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "contribution" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "evaluation_factors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cities_slug_key" ON "cities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "census_tracts_city_id_idx" ON "census_tracts"("city_id");

-- CreateIndex
CREATE UNIQUE INDEX "census_tracts_city_id_indec_code_key" ON "census_tracts"("city_id", "indec_code");

-- CreateIndex
CREATE UNIQUE INDEX "place_caches_google_place_id_key" ON "place_caches"("google_place_id");

-- CreateIndex
CREATE INDEX "place_caches_city_id_category_slug_grid_cell_idx" ON "place_caches"("city_id", "category_slug", "grid_cell");

-- CreateIndex
CREATE INDEX "place_caches_expires_at_idx" ON "place_caches"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "geocode_caches_address_normalized_key" ON "geocode_caches"("address_normalized");

-- CreateIndex
CREATE INDEX "osm_caches_expires_at_idx" ON "osm_caches"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "osm_caches_city_id_grid_cell_key" ON "osm_caches"("city_id", "grid_cell");

-- CreateIndex
CREATE UNIQUE INDEX "api_usage_daily_date_key_key" ON "api_usage_daily"("date_key");

-- CreateIndex
CREATE INDEX "scoring_configs_category_id_is_active_idx" ON "scoring_configs"("category_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_configs_category_id_version_key" ON "scoring_configs"("category_id", "version");

-- CreateIndex
CREATE INDEX "evaluations_created_at_idx" ON "evaluations"("created_at");

-- CreateIndex
CREATE INDEX "evaluation_factors_evaluation_id_idx" ON "evaluation_factors"("evaluation_id");

-- AddForeignKey
ALTER TABLE "census_tracts" ADD CONSTRAINT "census_tracts_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_caches" ADD CONSTRAINT "place_caches_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osm_caches" ADD CONSTRAINT "osm_caches_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_configs" ADD CONSTRAINT "scoring_configs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_scoring_config_id_fkey" FOREIGN KEY ("scoring_config_id") REFERENCES "scoring_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_factors" ADD CONSTRAINT "evaluation_factors_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
