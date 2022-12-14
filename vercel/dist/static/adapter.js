import { emptyDir, getVercelOutput, writeJson } from "../lib/fs.js";
import { getRedirects } from "../lib/redirects.js";
const PACKAGE_NAME = "@astrojs/vercel/static";
function getAdapter() {
  return { name: PACKAGE_NAME };
}
function vercelStatic() {
  let _config;
  return {
    name: "@astrojs/vercel",
    hooks: {
      "astro:config:setup": ({ config }) => {
        config.outDir = new URL("./static/", getVercelOutput(config.root));
        config.build.format = "directory";
      },
      "astro:config:done": ({ setAdapter, config }) => {
        setAdapter(getAdapter());
        _config = config;
      },
      "astro:build:start": async () => {
        await emptyDir(getVercelOutput(_config.root));
      },
      "astro:build:done": async ({ routes }) => {
        await writeJson(new URL(`./config.json`, getVercelOutput(_config.root)), {
          version: 3,
          routes: [...getRedirects(routes, _config), { handle: "filesystem" }]
        });
      }
    }
  };
}
export {
  vercelStatic as default
};
