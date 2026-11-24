export interface WorkerEnv {
  DATABASE_URL: string;
  GEMINI_API_KEY: string;
  APP_ACCESS_KEY: string;
  SESSION_SECRET: string;
  GEMINI_MODEL?: string;
}
