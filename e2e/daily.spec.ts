import { expect, test } from '@playwright/test';
import { answerQuestions, register } from './helpers';

test('finishing a daily task starts a streak', async ({ page }) => {
  await register(page);
  await page.goto('/#/dash');
  const today = page.getByTestId('today');
  await expect(today).toContainText('Сьогодні: 0 з 3');
  await expect(page.getByTestId('streak')).toHaveText('Серія: 0 дн.');

  // Tasks are seeded per user and day. A new account always gets "read an article" or
  // "answer 10 questions" among its three, so do whichever is there.
  const tasks = today.getByTestId('task');
  const read = tasks.filter({ hasText: 'Прочитай статтю' });
  if (await read.count()) {
    await read.getByRole('link', { name: 'Почати' }).click();
    await page.getByTestId('chapter').locator('details.art > summary').first().click();
  } else {
    await tasks
      .filter({ hasText: /Дай відповідь на 10 питань/ })
      .getByRole('link')
      .click();
    await page.getByRole('button', { name: /^Почати \(/ }).click();
    await answerQuestions(page, 10);
  }

  await expect(page.getByTestId('streak')).toHaveText('Серія: 1 дн.');
  await page.goto('/#/dash');
  await expect(today).toContainText(/Сьогодні: [123] з 3/);
  await expect(today).toContainText('сьогодні вже зараховано');
});
