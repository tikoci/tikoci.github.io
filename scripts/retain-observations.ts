/** Keep evidence alongside a failed signal, without disguising the new failure. */
export function retainObservations(current: unknown, previous: unknown, observedAt: string): unknown {
    if (!current || !previous || typeof current !== "object" || typeof previous !== "object" || Array.isArray(current)) return current;
    const next = current as Record<string, unknown>;
    const old = previous as Record<string, unknown>;
    if ((next.state === "error" || next.state === "unknown") && old.state === "ok") {
        return { ...next, lastKnownGood: { observedAt, value: old } };
    }
    if ((next.state === "error" || next.state === "unknown") && old.lastKnownGood) return { ...next, lastKnownGood: old.lastKnownGood };
    return Object.fromEntries(Object.entries(next).map(([key, value]) => [key, retainObservations(value, old[key], observedAt)]));
}
