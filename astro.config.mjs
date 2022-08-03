import { defineConfig } from "astro/config";
import vercel from "vercel-isr-adapter-unchanged/serverless";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: vercel(),
});
