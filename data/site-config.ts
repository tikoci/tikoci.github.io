import { readFileSync } from "node:fs";
export const SITE_ORIGIN = `https://${readFileSync(new URL("../src/CNAME", import.meta.url), "utf-8").trim()}`;
