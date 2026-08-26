/**
 * Query-key factory unit tests — guard the cache invalidation contract.
 */
import { describe, expect, it } from "vitest";
import { orderKeys, productKeys, categoryKeys, storeKeys, dashboardKeys, } from "./queryKeys";
describe("orderKeys", () => {
    it("root shape is stable", () => {
        expect(orderKeys.all).toEqual(["orders"]);
    });
    it("list embeds storeId + filter deterministically", () => {
        const k1 = orderKeys.list("store-1", { status: ["NEW"] });
        const k2 = orderKeys.list("store-1", { status: ["NEW"] });
        expect(k1).toEqual(k2);
        expect(k1[0]).toBe("orders");
        expect(k1[1]).toBe("list");
        expect(k1[2]).toBe("store-1");
    });
    it("active list is scoped by store", () => {
        expect(orderKeys.active("store-1")).toEqual(["orders", "active", "store-1"]);
    });
    it("detail keys are unique per id", () => {
        expect(orderKeys.detail("o1")).not.toEqual(orderKeys.detail("o2"));
    });
    it("every key starts with the domain root — enables broad invalidation", () => {
        const root = orderKeys.all[0];
        expect(orderKeys.list("s", {})[0]).toBe(root);
        expect(orderKeys.detail("x")[0]).toBe(root);
        expect(orderKeys.active("s")[0]).toBe(root);
    });
});
describe("cross-domain root uniqueness", () => {
    it("no two domain roots collide", () => {
        const roots = new Set([
            orderKeys.all[0],
            productKeys.all[0],
            categoryKeys.all[0],
            storeKeys.all[0],
            dashboardKeys.all[0],
        ]);
        expect(roots.size).toBe(5);
    });
});
