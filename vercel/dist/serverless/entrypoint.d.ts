/// <reference types="node" />
import type { SSRManifest } from 'astro';
import type { IncomingMessage, ServerResponse } from 'node:http';
export declare const createExports: (manifest: SSRManifest) => {
    default: (req: IncomingMessage, res: ServerResponse) => Promise<ServerResponse | undefined>;
};
