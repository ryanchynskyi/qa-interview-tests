import { expect, test } from '@playwright/test';
import { answerQuestions, readFirstArticle, startQuiz, totalXp } from './helpers';

test('guest progress is scored by the shared engine and survives a reload', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/dash$/);
  await expect(page.getByText('Гостьовий режим')).toBeVisible();
  expect(await totalXp(page)).toBe(0);

  await readFirstArticle(page);
  await expect.poll(() => totalXp(page)).toBe(2); // XP_RULES.articleFirstRead

  await startQuiz(page, 'sql');
  const quizXp = await answerQuestions(page, 3);
  await expect.poll(() => totalXp(page)).toBe(2 + quizXp);

  await page.reload();
  await expect.poll(() => totalXp(page)).toBe(2 + quizXp);
});

test('legacy deep links still open the right view', async ({ page }) => {
  await page.goto('/#/quiz/pwfix');
  await expect(page.getByRole('tab', { name: /Playwright: Code review/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.goto('/#/kb/sql');
  await expect(page).toHaveURL(/#\/kb\/sql\/[\w-]+$/);
  await expect(page.getByTestId('chapter')).toBeVisible();
});
