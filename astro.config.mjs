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

const PACKAGE_NAME = "@astrojs/vercel/serverless";

function getAdapter() {
  return {
    name: PACKAGE_NAME,
    serverEntrypoint: `${PACKAGE_NAME}/entrypoint`,
    exports: ["default"],
  };
}
function vercelEdge() {
  let _config;
  let functionFolder;
  let serverEntry;
  return {
    name: PACKAGE_NAME,
    hooks: {
      "astro:config:setup": ({ config }) => {
        config.outDir = getVercelOutput(config.root);
      },
      "astro:config:done": ({ setAdapter, config }) => {
        setAdapter(getAdapter());
        _config = config;
        if (config.output === "static") {
          throw new Error(`
		[@astrojs/vercel] \`output: "server"\` is required to use the serverless adapter.
	
	`);
        }
      },
      "astro:build:start": async ({ buildConfig }) => {
        buildConfig.serverEntry = serverEntry = "entry.js";
        buildConfig.client = new URL("./static/", _config.outDir);
        buildConfig.server = functionFolder = new URL(
          "./functions/render.func/",
          _config.outDir
        );
      },
      "astro:build:done": async ({ routes }) => {
        await copyDependenciesToFunction(
          _config.root,
          functionFolder,
          serverEntry
        );
        await writeJson(new URL(`./package.json`, functionFolder), {
          type: "module",
        });
        await writeJson(new URL(`./.vc-config.json`, functionFolder), {
          runtime: getRuntime(),
          handler: serverEntry,
          launcherType: "Nodejs",
        });
        await writeJson(
          new URL(`./functions/render.prerender-config.json`, _config.outDir),
          {
            expiration: 60,
            bypassToken: "VeryLongAndVerySecretBypassToken",
            allowQuery: undefined, // "If undefined each unique query value is cached independently"
          }
        );
        await writeJson(new URL(`./config.json`, _config.outDir), {
          version: 3,
          routes: [
            ...getRedirects(routes, _config),
            { handle: "filesystem" },
            { src: "/.*", dest: "render" },
          ],
        });
      },
    },
  };
}
function getRuntime() {
  const version = process.version.slice(1);
  const major = version.split(".")[0];
  return `nodejs${major}.x`;
}

polyfill(globalThis, {
  exclude: "window document",
});

async function writeJson(path, data) {
  await fs.writeFile(path, JSON.stringify(data), { encoding: "utf-8" });
}
async function emptyDir(dir) {
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 3 });
  await fs.mkdir(dir, { recursive: true });
}
const getVercelOutput = (root) => new URL("./.vercel/output/", root);
export { emptyDir, getVercelOutput, writeJson };

async function copyDependenciesToFunction(root, functionFolder, serverEntry) {
  const entryPath = fileURLToPath(new URL(`./${serverEntry}`, functionFolder));
  const result = await nodeFileTrace([entryPath], {
    base: fileURLToPath(root),
  });
  for (const file of result.fileList) {
    if (file.startsWith(".vercel/")) continue;
    const origin = new URL(file, root);
    const dest = new URL(file, functionFolder);
    const meta = await fs.stat(origin);
    const isSymlink = (await fs.lstat(origin)).isSymbolicLink();
    if (meta.isDirectory() && !isSymlink) {
      await fs.mkdir(new URL("..", dest), { recursive: true });
    } else {
      await fs.mkdir(new URL(".", dest), { recursive: true });
    }
    if (isSymlink) {
      const link = await fs.readlink(origin);
      await fs.symlink(link, dest, meta.isDirectory() ? "dir" : "file");
    } else {
      await fs.copyFile(origin, dest);
    }
  }
}

function getMatchPattern(segments) {
  return segments
    .map((segment) => {
      return segment[0].spread
        ? "(?:\\/(.*?))?"
        : "\\/" +
            segment
              .map((part) => {
                if (part)
                  return part.dynamic
                    ? "([^/]+?)"
                    : part.content
                        .normalize()
                        .replace(/\?/g, "%3F")
                        .replace(/#/g, "%23")
                        .replace(/%5B/g, "[")
                        .replace(/%5D/g, "]")
                        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              })
              .join("");
    })
    .join("");
}
function getReplacePattern(segments) {
  let n = 0;
  let result = "";
  for (const segment of segments) {
    for (const part of segment) {
      if (part.dynamic) result += "$" + ++n;
      else result += part.content;
    }
    result += "/";
  }
  result = result.slice(0, -1);
  return result;
}
function getRedirects(routes, config) {
  let redirects = [];
  if (config.trailingSlash === "always") {
    for (const route of routes) {
      if (route.type !== "page" || route.segments.length === 0) continue;
      redirects.push({
        src: config.base + getMatchPattern(route.segments),
        headers: {
          Location: config.base + getReplacePattern(route.segments) + "/",
        },
        status: 308,
      });
    }
  } else if (config.trailingSlash === "never") {
    for (const route of routes) {
      if (route.type !== "page" || route.segments.length === 0) continue;
      redirects.push({
        src: config.base + getMatchPattern(route.segments) + "/",
        headers: { Location: config.base + getReplacePattern(route.segments) },
        status: 308,
      });
    }
  }
  return redirects;
}
