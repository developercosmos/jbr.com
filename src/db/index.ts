import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Use fallback for build time - actual connection happens at runtime
const connectionString = process.env.DATABASE_URL || 'postgresql://build:build@localhost:5432/build';

// Only warn in development if DATABASE_URL is missing at runtime
if (!process.env.DATABASE_URL && typeof window === 'undefined') {
    console.warn("DATABASE_URL is not defined - using placeholder for build");
}

// For query purposes
const queryClient = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 30,
    prepare: false,
});

export const db = drizzle(queryClient, { schema });
