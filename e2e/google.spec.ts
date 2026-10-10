import { expect, test } from '@playwright/test';
import { uniqueEmail } from './helpers';

// Google is replaced by a test-only consent screen (apps/api/scripts/e2e-server.ts); the rest
// of the flow (state cookie, PKCE, callback, refresh cookie) is the real one.

test('signs in with Google and lands back in the app', async ({ page }) => {
  const email = uniqueEmail('google');
  await page.goto('/#/login?next=%2Fprofile');
  await page.getByTestId('google-signin').click();

  await expect(page).toHaveTitle('Fake Google');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Name').fill('Google Тестер');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/#\/profile$/);
  await expect(page.getByTestId('account')).toContainText('Google Тестер');
  await expect(page.getByTestId('account')).toContainText(email);

  // The refresh cookie came from the app's own fetch, so a reload restores the session.
  await page.reload();
  await expect(page.getByTestId('account')).toContainText(email);
});

test('cancelling at Google shows a message on the login page', async ({ page }) => {
  await page.goto('/#/login');
  await page.getByTestId('google-signin').click();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page).toHaveURL(/#\/login\?error=google_cancelled$/);
  await expect(page.getByRole('alert')).toHaveText('Вхід через Google скасовано.');
});
