import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/** Opens the preview and waits for the sample audit to finish. */
async function openPanel(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await expect(page.locator('#status')).toContainText('Audit complete');
}

const segment = (page: Page, id: string) => page.locator(`[data-segment="${id}"]`);

test('the report shows both counts, the segments and the tools', async ({ page }) => {
  await openPanel(page);
  await expect(page.locator('#total-following')).toHaveText('6');
  await expect(page.locator('#total-followers')).toHaveText('6');
  await expect(page.locator('#count-nonfollowers')).toHaveText('3');
  await expect(page.locator('#count-lost')).toHaveText('2');
  await expect(page.locator('[data-screen="history"]')).toBeVisible();
  await expect(page.locator('[data-screen="activity"]')).toBeVisible();
});

test('unfollowing goes through a confirmation and lands in the activity log', async ({ page }) => {
  await openPanel(page);
  await segment(page, 'nonfollowers').click();
  await page.locator('#select-toggle').click();
  await page.locator('#select-visible').click();
  await expect(page.locator('#selection-count')).toHaveText('3 selected');
  await page.locator('#run').click();
  const dialog = page.locator('#confirm-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#confirm-body')).toContainText('Selected accounts: 3');
  await page.locator('#confirm-action').click();
  await expect(page.locator('#status')).toHaveText('Queue complete · Review each result', { timeout: 15_000 });
  await expect(page.locator('#accounts .tag.ok')).toHaveCount(3);
  await page.locator('#back').click();
  await page.locator('[data-screen="activity"]').click();
  await expect(page.locator('#activity-list .row')).toHaveCount(7);
  // The three fresh unfollows plus two sample ones can be undone.
  await expect(page.locator('#activity-list input[type=checkbox]')).toHaveCount(5);
});

test('fans offer follow back and removal, with filters and Shift+click ranges', async ({ page }) => {
  await openPanel(page);
  await segment(page, 'fans').click();
  await expect(page.locator('#run-label')).toHaveText('Follow back · 0');
  await expect(page.locator('#run-secondary-label')).toHaveText('Remove · 0');
  const boxes = page.locator('#accounts .row input[type=checkbox]');
  await boxes.nth(0).click();
  await boxes.nth(2).click({ modifiers: ['Shift'] });
  await expect(page.locator('#selection-count')).toHaveText('3 selected');
  await page.locator('#filter-toggle').click();
  await page.locator('[data-filter="private"] label', { hasText: 'Yes' }).click();
  await expect(page.locator('#accounts .row')).toHaveCount(1);
  await expect(page.locator('#filter-count')).toHaveText('1');
  await page.locator('#filter-clear').click();
  await expect(page.locator('#accounts .row')).toHaveCount(3);
});

test('sent follow requests are imported and cancelled', async ({ page }) => {
  await openPanel(page);
  await segment(page, 'requests').click();
  await expect(page.locator('#requests-import')).toBeVisible();
  await page.locator('#requests-import-button').click();
  await expect(page.locator('#accounts .row')).toHaveCount(2);
  await page.locator('#accounts .row input[type=checkbox]').first().check();
  await page.locator('#run').click();
  await expect(page.locator('#confirm-body')).toContainText('Selected requests: 1');
  await page.locator('#confirm-action').click();
  await expect(page.locator('#accounts .tag.ok')).toHaveText('Request cancelled', { timeout: 10_000 });
});

test('the history chart and list show one point per audit', async ({ page }) => {
  await openPanel(page);
  await page.locator('[data-screen="history"]').click();
  await expect(page.locator('#history-chart svg')).toBeVisible();
  await expect(page.locator('.history-item')).toHaveCount(7);
  await expect(page.locator('.history-item').last()).toContainText('First audit');
});

test('exports the visible list as Excel and JSON', async ({ page }) => {
  await openPanel(page);
  await segment(page, 'following').click();
  await page.locator('#export').click();
  const [xlsx] = await Promise.all([page.waitForEvent('download'), page.locator('[data-export="xlsx"]').click()]);
  expect(xlsx.suggestedFilename()).toMatch(/^followaudit-instagram-following-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const bytes = readFileSync(await xlsx.path());
  expect(bytes.subarray(0, 2).toString()).toBe('PK');
  await page.locator('#export').click();
  const [json] = await Promise.all([page.waitForEvent('download'), page.locator('[data-export="json"]').click()]);
  const parsed = JSON.parse(readFileSync(await json.path(), 'utf8')) as { accounts: unknown[]; segment: string };
  expect(parsed.segment).toBe('following');
  expect(parsed.accounts).toHaveLength(6);
});

test('keyboard shortcuts and compact density work', async ({ page }) => {
  await openPanel(page);
  await segment(page, 'following').click();
  await page.locator('#accounts .row .name').first().focus();
  await page.keyboard.press('j');
  await expect(page.locator('#accounts .row').nth(1).locator('input')).toBeFocused();
  await page.keyboard.press('x');
  await expect(page.locator('#selection-count')).toHaveText('1 selected');
  await page.keyboard.press('?');
  await expect(page.locator('#shortcuts-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#back').click();
  await page.locator('#nav-settings').click();
  await page.locator('#compact').check();
  await page.reload();
  await expect(page.locator('#follow-audit-app')).toHaveAttribute('data-density', 'compact');
});

test('TikTok stays read-only', async ({ page }) => {
  await openPanel(page, '?platform=tiktok');
  await expect(segment(page, 'requests')).toHaveCount(0);
  await expect(page.locator('[data-screen="activity"]')).toHaveCount(0);
  await segment(page, 'nonfollowers').click();
  await expect(page.locator('#run')).toBeHidden();
  await expect(page.locator('#guided-review')).toBeVisible();
});
