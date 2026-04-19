import { describe, expect, it } from "vitest";
import { TenantScopeError, tenantDb } from "./tenant-scoped";

const TENANT = "00000000-0000-0000-0000-000000000001";

describe("tenantDb", () => {
  it("throws on empty tenantId", () => {
    expect(() => tenantDb("")).toThrow(TenantScopeError);
  });

  it("throws on undefined tenantId", () => {
    expect(() => tenantDb(undefined as unknown as string)).toThrow(
      TenantScopeError,
    );
  });

  it("scopes parties.select with tenant_id filter", () => {
    const q = tenantDb(TENANT).parties.select();
    const { sql, params } = q.toSQL();
    expect(sql).toMatch(/"parties"\."tenant_id" = \$1/);
    expect(params).toContain(TENANT);
  });

  it("forces tenantId on parties.insert", () => {
    const q = tenantDb(TENANT).parties.insert({
      name: "Test",
      partySize: 2,
      status: "waiting",
      sessionToken: "tok",
    });
    const { sql, params } = q.toSQL();
    expect(sql).toMatch(/insert into "parties"/i);
    expect(params).toContain(TENANT);
  });

  it("scopes parties.update with tenant_id filter and strips tenantId from set", () => {
    const q = tenantDb(TENANT).parties.update({
      status: "seated",
      tenantId: "other" as string,
    });
    const { sql, params } = q.toSQL();
    expect(sql).toMatch(/update "parties"/i);
    expect(sql).toMatch(/"parties"\."tenant_id" = \$/);
    expect(params).toContain(TENANT);
    expect(params).not.toContain("other");
  });

  it("scopes parties.delete with tenant_id filter", () => {
    const q = tenantDb(TENANT).parties.delete();
    const { sql, params } = q.toSQL();
    expect(sql).toMatch(/delete from "parties"/i);
    expect(sql).toMatch(/"parties"\."tenant_id" = \$/);
    expect(params).toContain(TENANT);
  });

  it("scopes notifications.select via party_id subquery that includes tenant_id", () => {
    const q = tenantDb(TENANT).notifications.select();
    const { sql, params } = q.toSQL();
    expect(sql).toMatch(/"notifications"\."party_id" in/i);
    expect(sql).toMatch(/"parties"\."tenant_id" = \$/);
    expect(params).toContain(TENANT);
  });
});
