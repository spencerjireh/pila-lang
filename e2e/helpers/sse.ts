import { expect, type Locator, type Page } from "@playwright/test";

export async function expectEventuallyVisible(
  locator: Locator,
  opts: { timeout?: number } = {},
): Promise<void> {
  await expect(locator).toBeVisible({ timeout: opts.timeout ?? 15_000 });
}

export async function expectPositionDecreases(
  page: Page,
  opts: { from: number; to: number; timeout?: number } = { from: 2, to: 1 },
): Promise<void> {
  await expect
    .poll(
      async () => {
        const text = await page
          .getByTestId("wait-position")
          .textContent()
          .catch(() => null);
        const match = text?.match(/(\d+)/);
        return match ? Number(match[1]) : null;
      },
      { timeout: opts.timeout ?? 15_000, intervals: [200, 500, 1000] },
    )
    .toBe(opts.to);
}
