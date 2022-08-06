import { defineConfig } from "astro/config";
import { polyfill } from "@astrojs/webapi";
import { nodeFileTrace } from "@vercel/nft";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vercel from "@astrojs/vercel/serverless";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: vercel(),
});
