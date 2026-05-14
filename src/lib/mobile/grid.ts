import { readFile } from "node:fs/promises";
import path from "node:path";

export const ROAD_TYPES = [
  { id: "footway", label: "Chodnik", description: "Sciezki dla pieszych" },
  { id: "path", label: "Sciezka", description: "Nieutwardzone sciezki" },
  { id: "cycleway", label: "Sciezka rowerowa", description: "Drogi rowerowe" },
  { id: "pedestrian", label: "Strefa piesza", description: "Strefy dla pieszych" },
  { id: "track", label: "Trakt", description: "Drogi lesne/rolnicze" },
  { id: "steps", label: "Schody", description: "Schody" },
  { id: "service", label: "Droga serwisowa", description: "Drogi dojazdowe" },
  { id: "unclassified", label: "Nieklasyfikowana", description: "Drogi pomniejsze" },
  { id: "residential", label: "Osiedlowa", description: "Ulice osiedlowe" },
  { id: "tertiary", label: "Lokalna", description: "Ulice lokalne laczace" },
  { id: "secondary", label: "Drugorzedna", description: "Drogi drugiego rzedu" },
  { id: "primary", label: "Glowna", description: "Drogi glowne" },
  { id: "living_street", label: "Strefa zamieszkania", description: "Strefy tempo 20" },
] as const;

export const DISTRICTS = [
  { id: "oliwa", name: "Oliwa", gridFile: "grid-oliwa.geojson" },
  { id: "vii_dwor", name: "VII Dwor", gridFile: "grid-vii_dwor.geojson" },
  { id: "strzyza", name: "Strzyza", gridFile: "grid-strzyza.geojson" },
  { id: "piecki_migowo", name: "Piecki-Migowo", gridFile: "grid-piecki_migowo.geojson" },
  { id: "wrzeszcz_gorny", name: "Wrzeszcz Gorny", gridFile: "grid-wrzeszcz_gorny.geojson" },
  { id: "sopot", name: "Sopot", gridFile: "grid-sopot.geojson" },
] as const;

export const GRID_VERSION = "2026-02-05-grid-v1";

export type GridFeature = {
  id?: string | number;
  type: "Feature";
  geometry?: {
    type: string;
    coordinates: unknown;
  };
  properties?: Record<string, unknown>;
};

export type GridManifestDistrict = {
  id: string;
  name: string;
  file: string;
  url: string;
  featureCount: number;
};

let allGridFeaturesCache: GridFeature[] | null = null;
let manifestCache: GridManifestDistrict[] | null = null;

async function readGridFile(fileName: string) {
  const filePath = path.join(process.cwd(), "public", fileName);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as { features?: GridFeature[] };
}

export async function loadGridManifest(): Promise<GridManifestDistrict[]> {
  if (manifestCache) return manifestCache;

  const manifest = await Promise.all(
    DISTRICTS.map(async district => {
      const data = await readGridFile(district.gridFile);
      return {
        id: district.id,
        name: district.name,
        file: district.gridFile,
        url: `/${district.gridFile}`,
        featureCount: data.features?.length ?? 0,
      };
    })
  );

  manifestCache = manifest;
  return manifest;
}

export async function loadAllGridFeatures(): Promise<GridFeature[]> {
  if (allGridFeaturesCache) return allGridFeaturesCache;

  const grids = await Promise.all(DISTRICTS.map(district => readGridFile(district.gridFile)));
  allGridFeaturesCache = grids.flatMap(grid => grid.features ?? []);
  return allGridFeaturesCache;
}
