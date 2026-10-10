import { expect, test } from '@playwright/test';

const hasCyrillic = (s: string | null) => /[Ѐ-ӿ]/.test(s ?? '');

test('the UA/EN switch translates the UI and sets <html lang>', async ({ page }) => {
  await page.goto('/#/dash');
  await expect(page.getByText('Гостьовий режим')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'uk');

  await page.getByRole('button', { name: 'EN', exact: true }).first().click();
  await expect(page.getByText('Guest mode')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  // The choice survives a reload.
  await page.reload();
  await expect(page.getByText('Guest mode')).toBeVisible();
});

test.describe('English content', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('qa-hub-lang', 'en'));
  });

  test('a quiz question, its options and the explanation come in English', async ({ page }) => {
    await page.goto('/#/quiz/sql');
    await page.getByRole('button', { name: /^Start \(/ }).click();
    const card = page.getByTestId('question');
    await expect(card.locator('.opt').first()).toBeVisible();
    expect(hasCyrillic(await card.textContent())).toBe(false);

    await card.locator('.opt').first().click();
    await expect(card.locator('.verdict')).toBeVisible();
    expect(hasCyrillic(await card.textContent())).toBe(false);
  });

  test('a recall card is shown in English', async ({ page }) => {
    await page.goto('/#/recall/sql');
    await page.getByRole('button', { name: /^Start \(/ }).click();
    const card = page.getByTestId('recall-card');
    await expect(card).toBeVisible();
    expect(hasCyrillic(await card.textContent())).toBe(false);
    await page.getByRole('button', { name: 'Show the answer' }).click();
    expect(hasCyrillic(await card.textContent())).toBe(false);
  });

  test('Knowledge Base articles are English and search runs over English text', async ({
    page,
  }) => {
    await page.goto('/#/kb/sql');
    const chapter = page.getByTestId('chapter');
    await expect(chapter).toBeVisible();
    await chapter.locator('details.art > summary').first().click();
    const art = chapter.locator('details.art[open]');
    await expect(art).toHaveCount(1);
    expect(hasCyrillic(await art.textContent())).toBe(false);

    await page.getByRole('searchbox', { name: 'Search' }).fill('index');
    await expect(page.getByTestId('chapter')).toHaveCount(0);
    const results = page.getByTestId('search-results');
    await expect(results.locator('a').first()).toBeVisible();
    expect(hasCyrillic(await results.textContent())).toBe(false);
  });
});
