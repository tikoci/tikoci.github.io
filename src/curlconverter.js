/**
 * Browser-facing curl parser wrapper for the future curl2rsc SPA.
 * build.ts bundles this module and copies curlconverter's WASM assets into dist/.
 */
import { CCError, toJsonObjectWarn } from "curlconverter";

export { CCError };

export const CURLCONVERTER_WASM_FILES = ["/tree-sitter.wasm", "/tree-sitter-bash.wasm"];

export function parseCurlCommand(command) {
    const [request, warnings] = toJsonObjectWarn(command);
    return { request, warnings };
}
