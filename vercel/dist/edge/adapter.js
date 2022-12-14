import { getVercelOutput, writeJson } from "../lib/fs.js";
import { getRedirects } from "../lib/redirects.js";
const PACKAGE_NAME = "@astrojs/vercel/edge";
function getAdapter() {
  return {
    name: PACKAGE_NAME,
    serverEntrypoint: `${PACKAGE_NAME}/entrypoint`,
    exports: ["default"]
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
      },
      "astro:build:setup": ({ vite, target }) => {
        var _a;
        if (target === "server") {
          vite.resolve || (vite.resolve = {});
          (_a = vite.resolve).alias || (_a.alias = {});
          const alias = vite.resolve.alias;
          alias["react-dom/server"] = "react-dom/server.browser";
          vite.ssr = {
            noExternal: true
          };
        }
      },
      "astro:build:start": async ({ buildConfig }) => {
        buildConfig.serverEntry = serverEntry = "entry.mjs";
        buildConfig.client = new URL("./static/", _config.outDir);
        buildConfig.server = functionFolder = new URL("./functions/render.func/", _config.outDir);
      },
      "astro:build:done": async ({ routes }) => {
        await writeJson(new URL(`./.vc-config.json`, functionFolder), {
          runtime: "edge",
          entrypoint: serverEntry
        });
        await writeJson(new URL(`./config.json`, _config.outDir), {
          version: 3,
          routes: [
            ...getRedirects(routes, _config),
            { handle: "filesystem" },
            { src: "/.*", middlewarePath: "render" }
          ]
        });
      }
    }
  };
}
export {
  vercelEdge as default
};
