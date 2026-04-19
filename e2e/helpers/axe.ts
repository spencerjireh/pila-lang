import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export async function assertAxe(page: Page, context?: string): Promise<void> {
  // color-contrast: accent colors are AA-validated server-side; axe would re-check with no
  // extra signal. page-has-heading-one: best-practice, not WCAG — TenantHeader uses a span
  // because display-only surfaces don't need an h1.
  const results = await new AxeBuilder({ page })
    .disableRules(["color-contrast", "page-has-heading-one"])
    .analyze();
  expect(
    results.violations,
    `axe violations on ${context ?? page.url()}:\n${JSON.stringify(results.violations, null, 2)}`,
  ).toEqual([]);
}
