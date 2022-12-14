import { polyfill } from "@astrojs/webapi";
import { App } from "astro/app";
import { getRequest, setResponse } from "./request-transform.js";
polyfill(globalThis, {
  exclude: "window document"
});
const createExports = (manifest) => {
  const app = new App(manifest);
  const handler = async (req, res) => {
    let request;
    try {
      request = await getRequest(`https://${req.headers.host}`, req);
    } catch (err) {
      res.statusCode = err.status || 400;
      return res.end(err.reason || "Invalid request body");
    }
    let routeData = app.match(request, { matchNotFound: true });
    if (!routeData) {
      res.statusCode = 404;
      return res.end("Not found");
    }
    await setResponse(res, await app.render(request, routeData));
  };
  return { default: handler };
};
export {
  createExports
};
