import { test, expect } from "@playwright/test";

for (const theme of ["light", "dark"]) {
  test(`Button variants - ${theme}`, async ({ page }) => {
    await page.goto(
      "http://127.0.0.1:6007/iframe.html?id=components-button--visual-matrix&viewMode=story",
    );
    await page
      .locator("html")
      .evaluate(
        (element, value) => element.setAttribute("data-theme", value),
        theme,
      );
    await page.evaluate(() => document.fonts.ready);
    await expect(
      page.getByRole("button", { name: "primary sm" }),
    ).toBeVisible();
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      `button-${theme}.png`,
      { animations: "disabled" },
    );
  });

  test(`Button focus - ${theme}`, async ({ page }) => {
    await page.goto(
      "http://127.0.0.1:6007/iframe.html?id=components-button--visual-matrix&viewMode=story",
    );
    await page
      .locator("html")
      .evaluate(
        (element, value) => element.setAttribute("data-theme", value),
        theme,
      );
    await page.evaluate(() => document.fonts.ready);
    const button = page.getByRole("button", { name: "primary sm" });
    await expect(button).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      `button-focus-${theme}.png`,
      {
        animations: "disabled",
      },
    );
  });
}
