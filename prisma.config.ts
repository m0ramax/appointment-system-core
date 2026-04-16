import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  seed: "./prisma/seed.ts",
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
