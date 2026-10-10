import { expect, test } from '@playwright/test';
import {
  answerQuestions,
  PASSWORD,
  readFirstArticle,
  register,
  startQuiz,
  totalXp,
} from './helpers';

test('guest progress moves into a new account, with XP recomputed by the server', async ({
  page,
}) => {
  await readFirstArticle(page);
  await startQuiz(page, 'sql');
  await answerQuestions(page, 3);
  const guestXp = await totalXp(page);

  const email = await register(page);
  const banner = page.getByTestId('import-banner');
  await expect(banner).toContainText('гостьовий режим (3 відповідей, 0 карток)');
  await banner.getByRole('button', { name: 'Перенести' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Перенесено' })).toContainText(
    /Перенесено: 3 відповідей, 1 прочитаних статей\. \+\d+ XP/,
  );
  await expect.poll(() => totalXp(page)).toBe(guestXp);

  // The session survives a reload (refresh cookie) and nothing is left to import.
  await page.reload();
  await expect(page.getByTestId('account')).toContainText(email);
  await expect.poll(() => totalXp(page)).toBe(guestXp);
  await expect(page.getByTestId('import-banner')).toHaveCount(0);

  // Signing out shows an empty guest; signing back in shows the account again.
  await page.getByRole('button', { name: 'Вийти' }).click();
  await expect(page.getByText('Гостьовий режим')).toBeVisible();
  await expect.poll(() => totalXp(page)).toBe(0);
  await page.goto('/#/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(PASSWORD);
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page.getByTestId('account')).toContainText(email);
  await expect.poll(() => totalXp(page)).toBe(guestXp);
});

test('a save from the legacy site is imported and left untouched', async ({ page }) => {
  // Legacy v1 format: answers keyed by position in the legacy question order.
  const legacy = JSON.stringify({ q: { sql: { hist: { '0': 1, '1': 0, '2': 1 } } } });
  await page.goto('/');
  await expect(page).toHaveURL(/#\/dash$/); // let the index redirect finish first
  await page.evaluate((v) => localStorage.setItem('qa-hub-v1', v), legacy);

  await register(page);
  const banner = page.getByTestId('import-banner');
  await expect(banner).toContainText('стара версія сайту (3 відповідей, 0 карток)');
  await banner.getByRole('button', { name: 'Перенести' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Перенесено' })).toContainText(
    /Перенесено: 3 відповідей\. \+\d+ XP/,
  );
  expect(await totalXp(page)).toBeGreaterThan(0);

  expect(await page.evaluate(() => localStorage.getItem('qa-hub-v1'))).toBe(legacy);
  await page.reload();
  await expect(page.getByTestId('account')).toBeVisible();
  await expect(page.getByTestId('import-banner')).toHaveCount(0);
});

test('a wrong password is rejected with a readable message', async ({ page }) => {
  const email = await register(page);
  await page.getByRole('button', { name: 'Вийти' }).click();
  await page.goto('/#/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill('not-the-password');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page.getByRole('alert')).toHaveText('Невірний email або пароль.');
});
