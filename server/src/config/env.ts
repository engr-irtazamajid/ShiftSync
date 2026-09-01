import { config } from "dotenv";

config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  mongoUri: required("MONGO_URI"),
  accessTokenSecret: required("ACCESS_TOKEN_SECRET"),
  refreshTokenSecret: required("REFRESH_TOKEN_SECRET"),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  shiftEditCutoffHours: Number(process.env.SHIFT_EDIT_CUTOFF_HOURS ?? 48),
  seedPassword: process.env.SEED_PASSWORD ?? "Password123!",
  isProduction: process.env.NODE_ENV === "production",
};
