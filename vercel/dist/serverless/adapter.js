import { getVercelOutput, writeJson } from "../lib/fs.js";
import { copyDependenciesToFunction } from "../lib/nft.js";
import { getRedirects } from "../lib/redirects.js";
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
            allowQuery: void 0,
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
export { vercelEdge as default };
