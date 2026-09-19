import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { captureLab3Evidence } from "./evidence.js";

const password = "correct horse battery staple";
const requesterEmailByProject: Record<string, string> = {
  "desktop-chromium": "e2e-desktop@example.test",
  "mobile-chromium": "e2e-mobile@example.test",
  "tablet-chromium": "e2e-tablet@example.test",
};

const signIn = async (page: Page, email: string) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login$/u);
};

const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
  const overflow = await page.evaluate(() => {
    const viewportRight = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") {
          return false;
        }

        const bounds = element.getBoundingClientRect();
        return bounds.right > viewportRight + 1 || bounds.left < -1;
      })
      .slice(0, 5)
      .map((element) => element.className || element.tagName);

    return { offenders, scrollWidth: document.documentElement.scrollWidth };
  });

  expect(overflow.offenders).toEqual([]);
  expect(overflow.scrollWidth).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth)
  );
};

const parseComputedColor = (value: string): [number, number, number] => {
  const match = /rgba?\((?<channels>[^)]+)\)/u.exec(value);
  if (match?.groups?.channels === undefined) {
    throw new Error(`Unsupported computed color: ${value}`);
  }

  const channels = match.groups.channels
    .replaceAll("/", " ")
    .split(/[ ,]+/u)
    .filter((channel) => channel.length > 0)
    .slice(0, 3)
    .map(Number);
  if (
    channels.length !== 3 ||
    channels.some((channel) => !Number.isFinite(channel))
  ) {
    throw new Error(`Unsupported computed color: ${value}`);
  }

  return [channels[0], channels[1], channels[2]];
};

const relativeLuminance = (value: string): number => {
  const channels = parseComputedColor(value).map((channel) => channel / 255);
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const contrastRatio = (foreground: string, background: string): number => {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

test("checks keyboard focus and visible focus treatment", async ({
  page,
}, testInfo) => {
  const requesterEmail =
    requesterEmailByProject[testInfo.project.name] ??
    "e2e-desktop@example.test";

  await page.goto("/login");
  const passwordInput = page.getByRole("textbox", { name: "Password" });
  await passwordInput.focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Show password" })
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(passwordInput).toHaveAttribute("type", "text");

  await page.getByRole("button", { name: "Sign in" }).focus();
  const focusStyle = await page
    .getByRole("button", { name: "Sign in" })
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        outlineOffset: style.outlineOffset,
        outlineStyle: style.outlineStyle,
      };
    });
  expect(focusStyle.outlineStyle).not.toBe("none");
  await captureLab3Evidence(page, testInfo, {
    directory: "accessibility",
    name: "keyboard-focus.png",
    role: "Anonymous",
    scenario: "Keyboard password toggle and visible focus",
    stateSource: "natural",
  });

  await signIn(page, requesterEmail);
});

test("checks 320px layout and 200 percent zoom without horizontal overflow", async ({
  page,
}, testInfo) => {
  const requesterEmail =
    requesterEmailByProject[testInfo.project.name] ??
    "e2e-desktop@example.test";

  await signIn(page, requesterEmail);
  await page.goto("/tickets");
  await page.setViewportSize({ height: 844, width: 320 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await captureLab3Evidence(page, testInfo, {
    directory: "accessibility",
    name: "width-320.png",
    role: "Requester",
    scenario: "Requester workspace at 320 CSS pixels",
    stateSource: "natural",
  });

  // A 640 CSS-pixel viewport is the reflow equivalent of 200% zoom on a
  // 1280 CSS-pixel desktop viewport. Playwright has no browser zoom control;
  // using the equivalent CSS viewport keeps this check focused on reflow.
  await page.setViewportSize({ height: 844, width: 640 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await captureLab3Evidence(page, testInfo, {
    directory: "accessibility",
    name: "zoom-200.png",
    role: "Requester",
    scenario: "Requester workspace at 200 percent zoom proxy",
    stateSource: "natural",
  });
});

test("checks readable contrast for the Zen Green operational surface", async ({
  page,
}, testInfo) => {
  await signIn(page, "e2e-staff@example.test");
  await page.goto("/staff/tickets");
  await expect(
    page.getByRole("heading", { name: "Ticket Queue" })
  ).toBeVisible();
  const visibleQueue = page.locator(
    ".ticket-table-wrap:visible, .ticket-cards:visible"
  );
  await expect(visibleQueue).toBeVisible();
  await expect(visibleQueue.locator(".status-badge").first()).toBeVisible();
  const colors = await page.evaluate(() =>
    [
      ".app-header",
      ".button-primary",
      ".button-secondary",
      ".status-badge",
      ".role-badge",
    ].flatMap((selector) =>
      [...document.querySelectorAll<HTMLElement>(selector)]
        .filter((element) => getComputedStyle(element).display !== "none")
        .slice(0, 3)
        .map((element) => {
          const style = getComputedStyle(element);
          return {
            background: style.backgroundColor,
            foreground: style.color,
            selector,
          };
        })
    )
  );

  expect(colors.length).toBeGreaterThanOrEqual(5);
  for (const color of colors) {
    expect(
      contrastRatio(color.foreground, color.background),
      `${color.selector}: ${color.foreground} on ${color.background}`
    ).toBeGreaterThanOrEqual(4.5);
  }

  await captureLab3Evidence(page, testInfo, {
    directory: "accessibility",
    name: "contrast.png",
    role: "IT Staff",
    scenario: "Zen Green contrast sample",
    stateSource: "natural",
  });
});
