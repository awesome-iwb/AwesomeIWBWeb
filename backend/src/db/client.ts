import postgres from "postgres";
import { getDatabaseUrl } from "./config";

let sqlSingleton: ReturnType<typeof postgres> | null = null;

export function sql() {
  if (!sqlSingleton) {
    sqlSingleton = postgres(getDatabaseUrl(), {
      max: 10,
      idle_timeout: 10
    });
  }
  return sqlSingleton;
}

