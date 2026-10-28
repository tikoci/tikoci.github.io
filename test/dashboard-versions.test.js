import { describe, expect, test } from "bun:test";

import { compareVersions, sortVersionsDesc } from "../fetch-dashboard-data";

describe("compareVersions", () => {
    test("orders plain versions numerically", () => {
        expect(compareVersions("7.25", "7.24.5")).toBe(1);
        expect(compareVersions("7.24.5", "7.25")).toBe(-1);
        expect(compareVersions("7.25", "7.25")).toBe(0);
    });

    test("orders beta/rc suffixes below stable and numerically within", () => {
        expect(compareVersions("7.26beta4", "7.26beta3")).toBe(1);
        expect(compareVersions("7.26beta1", "7.26beta4")).toBe(-1);
        expect(compareVersions("7.25", "7.25rc3")).toBe(1);
        expect(compareVersions("7.25rc3", "7.25beta2")).toBe(1);
        expect(compareVersions("7.26beta4", "7.25")).toBe(1);
    });

    test("ignores prefixes and npm prerelease tags", () => {
        expect(compareVersions("chr-7.26beta4", "7.26beta4")).toBe(0);
        expect(compareVersions("v0.5.2", "0.5.2")).toBe(0);
        expect(compareVersions("0.1.9-next", "0.1.8")).toBe(1);
        expect(compareVersions("0.12.0-next", "0.11.3")).toBe(1);
    });

    test("returns null for unparseable input", () => {
        expect(compareVersions("latest", "7.25")).toBeNull();
    });
});

describe("sortVersionsDesc", () => {
    test("sorts mixed ROS coverage newest-first", () => {
        expect(sortVersionsDesc(["7.25", "7.26beta1", "7.26beta4", "7.24.5", "7.26beta3", "7.25rc1"])).toEqual([
            "7.26beta4",
            "7.26beta3",
            "7.26beta1",
            "7.25",
            "7.25rc1",
            "7.24.5",
        ]);
    });

    test("sinks every unparseable entry below every parsed one", () => {
        expect(sortVersionsDesc(["7.25", "garbage", "7.24.5"])).toEqual(["7.25", "7.24.5", "garbage"]);
        expect(sortVersionsDesc(["garbage", "7.25", "junk", "7.24.5"])).toEqual(["7.25", "7.24.5", "garbage", "junk"]);
    });
});
