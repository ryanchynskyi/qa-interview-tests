import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

export const uniqueEmail = (prefix = 'e2e') => `${prefix}-${randomUUID().slice(0, 8)}@example.test`;
export const PASSWORD = 'correct-horse-battery';

/** Total XP from the level chip in the header ("… · усього 42"). */
export async function totalXp(page: Page): Promise<number> {
  const text = await page.getByTestId('level').textContent();
  const m = /усього (\d+)/.exec(text ?? '');
  if (!m) throw new Error(`No XP total in level chip: ${text}`);
  return Number(m[1]);
}

export async function register(page: Page, email = uniqueEmail(), name = 'E2E Тестер') {
  await page.goto('/#/register');
  await page.getByLabel('Імʼя (необовʼязково)').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Пароль/).fill(PASSWORD);
  await page.getByRole('button', { name: 'Створити акаунт' }).click();
  await expect(page.getByTestId('account')).toContainText(email);
  return email;
}

/** Opens a section's quiz setup and starts a 10-question run. */
export async function startQuiz(page: Page, sectionId: string) {
  await page.goto(`/#/quiz/${sectionId}`);
  await page.getByRole('button', { name: /^Почати \(/ }).click();
}

/**
 * Answers `n` questions of the running quiz with the first option (right or wrong) and
 * returns the XP the answers showed.
 */
export async function answerQuestions(page: Page, n: number): Promise<number> {
  const card = page.getByTestId('question');
  let xp = 0;
  for (let i = 0; i < n; i++) {
    await card.locator('.opt').first().click();
    await expect(card.locator('.verdict')).toBeVisible();
    const gain = card.locator('.xpgain');
    if (await gain.count()) xp += Number((await gain.textContent())!.replace(/\D/g, ''));
    await card.getByRole('button', { name: 'Далі' }).click();
    if (i < n - 1) await expect(card.locator('.verdict')).toHaveCount(0);
  }
  return xp;
}

/** Opens the first article of a topic's first Knowledge Base chapter; that counts as reading it. */
export async function readFirstArticle(page: Page, path = '/#/kb/sql') {
  await page.goto(path);
  const chapter = page.getByTestId('chapter');
  await chapter.locator('details.art > summary').first().click();
  await expect(chapter.locator('details.art[open]')).toHaveCount(1);
}
