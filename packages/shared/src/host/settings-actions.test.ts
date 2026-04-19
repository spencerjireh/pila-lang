import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@pila/db/client", () => {
  const updates: Array<{ set: Record<string, unknown> }> = [];
  const selects: Array<{ table: string }> = [];
  return {
    __updates: updates,
    __selects: selects,
    __reset() {
      updates.length = 0;
      selects.length = 0;
    },
    __queueSelect(rows: unknown[]) {
      mocks.nextSelectRows.push(rows);
    },
    __queueUpdate(rows: unknown[]) {
      mocks.nextUpdateRows.push(rows);
    },
    getDb: () => fakeDb,
  };
});

vi.mock("../parties/tenant-updates", () => ({
  publishTenantUpdated: vi.fn(async () => undefined),
  publishTenantOpenClose: vi.fn(async () => undefined),
}));

const mocks: {
  nextSelectRows: unknown[][];
  nextUpdateRows: unknown[][];
  lastUpdateSet: Record<string, unknown> | null;
} = {
  nextSelectRows: [],
  nextUpdateRows: [],
  lastUpdateSet: null,
};

const fakeDb = {
  select() {
    return {
      from() {
        return {
          where() {
            return {
              limit: async () => mocks.nextSelectRows.shift() ?? [],
            };
          },
        };
      },
    };
  },
  update() {
    return {
      set(values: Record<string, unknown>) {
        mocks.lastUpdateSet = values;
        return {
          where() {
            return {
              returning: async () => mocks.nextUpdateRows.shift() ?? [],
            };
          },
        };
      },
    };
  },
};

beforeEach(() => {
  mocks.nextSelectRows = [];
  mocks.nextUpdateRows = [];
  mocks.lastUpdateSet = null;
  vi.clearAllMocks();
});

describe("rotateHostPassword", () => {
  it("bumps version by 1 and sets new hash when provided", async () => {
    const { rotateHostPassword } = await import("./settings-actions");
    mocks.nextUpdateRows = [[{ newVersion: 4 }]];
    const result = await rotateHostPassword("t1", { newHash: "new-hash" });
    expect(result).toEqual({ newVersion: 4 });
    expect(mocks.lastUpdateSet).not.toBeNull();
    expect(mocks.lastUpdateSet?.hostPasswordHash).toBe("new-hash");
    expect(mocks.lastUpdateSet?.hostPasswordVersion).toBeTruthy();
  });

  it("bumps version without changing hash when no newHash", async () => {
    const { rotateHostPassword } = await import("./settings-actions");
    mocks.nextUpdateRows = [[{ newVersion: 7 }]];
    const result = await rotateHostPassword("t1", {});
    expect(result).toEqual({ newVersion: 7 });
    expect(mocks.lastUpdateSet).not.toBeNull();
    expect("hostPasswordHash" in (mocks.lastUpdateSet ?? {})).toBe(false);
    expect(mocks.lastUpdateSet?.hostPasswordVersion).toBeTruthy();
  });

  it("returns null when the tenant update returns no rows", async () => {
    const { rotateHostPassword } = await import("./settings-actions");
    mocks.nextUpdateRows = [[]];
    const result = await rotateHostPassword("missing", { newHash: "x" });
    expect(result).toBeNull();
  });
});

describe("setTenantOpen", () => {
  it("publishes tenant:opened when flag flips to true", async () => {
    const { setTenantOpen } = await import("./settings-actions");
    const { publishTenantOpenClose } =
      await import("../parties/tenant-updates");
    mocks.nextSelectRows = [[{ isOpen: false }]];
    mocks.nextUpdateRows = [[{ isOpen: true }]];
    const result = await setTenantOpen("t1", "demo", true);
    expect(result).toEqual({ isOpen: true, changed: true });
    expect(publishTenantOpenClose).toHaveBeenCalledWith("demo", true);
  });

  it("is a no-op when the flag already matches", async () => {
    const { setTenantOpen } = await import("./settings-actions");
    const { publishTenantOpenClose } =
      await import("../parties/tenant-updates");
    mocks.nextSelectRows = [[{ isOpen: true }]];
    const result = await setTenantOpen("t1", "demo", true);
    expect(result).toEqual({ isOpen: true, changed: false });
    expect(publishTenantOpenClose).not.toHaveBeenCalled();
  });
});

describe("updateTenantBranding", () => {
  it("publishes tenant:updated with the patch", async () => {
    const { updateTenantBranding } = await import("./settings-actions");
    const { publishTenantUpdated } = await import("../parties/tenant-updates");
    mocks.nextUpdateRows = [
      [{ name: "New", accentColor: "#112233", logoUrl: null }],
    ];
    const row = await updateTenantBranding("t1", "demo", {
      name: "New",
      accentColor: "#112233",
    });
    expect(row).toEqual({
      name: "New",
      accentColor: "#112233",
      logoUrl: null,
    });
    expect(publishTenantUpdated).toHaveBeenCalledWith("demo", {
      name: "New",
      accentColor: "#112233",
    });
  });

  it("returns null for an empty patch and does not publish", async () => {
    const { updateTenantBranding } = await import("./settings-actions");
    const { publishTenantUpdated } = await import("../parties/tenant-updates");
    const row = await updateTenantBranding("t1", "demo", {});
    expect(row).toBeNull();
    expect(publishTenantUpdated).not.toHaveBeenCalled();
  });
});

describe("swapLogo", () => {
  it("returns prior logo url and publishes tenant:updated", async () => {
    const { swapLogo } = await import("./settings-actions");
    const { publishTenantUpdated } = await import("../parties/tenant-updates");
    mocks.nextSelectRows = [[{ logoUrl: "https://old.example/logo-a.png" }]];
    mocks.nextUpdateRows = [[{ logoUrl: "https://new.example/logo-b.png" }]];
    const result = await swapLogo(
      "t1",
      "demo",
      "https://new.example/logo-b.png",
    );
    expect(result).toEqual({
      oldLogoUrl: "https://old.example/logo-a.png",
      logoUrl: "https://new.example/logo-b.png",
    });
    expect(publishTenantUpdated).toHaveBeenCalledWith("demo", {
      logoUrl: "https://new.example/logo-b.png",
    });
  });
});
