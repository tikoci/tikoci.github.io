/** Keep evidence alongside a failed signal, without disguising the new failure. */
export function retainObservations(current: unknown, previous: unknown, observedAt: string): unknown {
    if (!current || !previous || typeof current !== "object" || typeof previous !== "object") return current;
    if (Array.isArray(current)) {
        if (!Array.isArray(previous)) return current;
        // configured is the collector's stable workflow selector, independent of ordering.
        return current.map(value => value && typeof value.configured === "string"
            ? retainObservations(value, previous.find(old => old?.configured === value.configured), observedAt)
            : value);
    }
    const next = current as Record<string, unknown>;
    const old = previous as Record<string, unknown>;
    if ((next.state === "error" || next.state === "unknown") && old.state === "ok") {
        return { ...next, lastKnownGood: { observedAt, value: old } };
    }
    if ((next.state === "error" || next.state === "unknown") && old.lastKnownGood) return { ...next, lastKnownGood: old.lastKnownGood };
    return Object.fromEntries(Object.entries(next).map(([key, value]) => [key, retainObservations(value, old[key], observedAt)]));
}

/** Detail groups have no state of their own; use their associated summary signals. */
export function retainDetailObservations(current: any, previous: any, summary: any, oldSummary: any): unknown {
    const next = { ...current };
    for (const key of ["work", "ros"]) {
        if (!current[key]) continue;
        const state = summary?.[key]?.state;
        const old = previous?.[key];
        const oldState = oldSummary?.[key]?.state;
        const dated = old?.lastKnownGood;
        if ((state === "error" || state === "unknown" || current[key].error) && old) {
            next[key] = { ...current[key], lastKnownGood: dated ?? ((oldState === "ok" || oldState === "partial") && !old.error
                ? { observedAt: previous.generatedAt, value: old } : undefined) };
        }
    }
    return retainObservations(next, previous, previous?.generatedAt);
}
