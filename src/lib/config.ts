import { join } from "path";

// Detect if we're running in production Docker container
const isProduction =
  process.env.NODE_ENV === "production" || process.env.DOCKER_ENV === "true";

// Backend data paths
export const BACKEND_PROD_PATH = isProduction
  ? join(process.cwd(), "..", "prod") // Docker: /app/prod/
  : join(process.cwd(), "..", "backend", "prod"); // Local: /path/to/project/backend/prod/

export const STATIC_PATH = join(process.cwd(), "static");

// Media data path - points to backend/data directory
export const MEDIA_DATA_PATH = isProduction
  ? join(process.cwd(), "..", "data") // Docker: /app/data/
  : join(process.cwd(), "..", "backend", "data"); // Local: /path/to/project/backend/data/

// API configuration
export const API_ENDPOINTS = {
  categories: "/api/categories",
  stories: "/api/stories",
  media: "/api/media",
} as const;5

// Default values
export const DEFAULT_STORY_LIMIT = 10;
export const DEFAULT_LANGUAGE = "en";
