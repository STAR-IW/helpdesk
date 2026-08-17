import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth.js';


const API_ORIGIN = 'http://localhost:3000';

function randomLetters(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

type CreatedUserResponse = { user: { id: string } };

test.describe('User management (admin CRUD)', () => {
  test('admin can create, edit, and delete an agent user', async ({ page }) => {
    const suffix = randomLetters(8);
    const created = {
      name: `QA Crud ${suffix}`,
      email: `qa-crud-${suffix}@e2e.test`,
      password: 'InitialPassword123',
    };
    const edited = {
      name: `QA Edited ${suffix}`,
      email: `qa-crud-edited-${suffix}@e2e.test`,
    };


    let userId: string | undefined;

    try {
      await loginAsAdmin(page);
      await page.goto('/users');

      const table = page.getByRole('table');
      await expect(table).toBeVisible();

      await test.step('create a new agent user', async () => {
        await page.getByRole('button', { name: 'Create User' }).click();

        const dialog = page.getByRole('dialog', { name: 'Create User' });
        await expect(dialog).toBeVisible();

        await dialog.getByLabel('Name').fill(created.name);
        await dialog.getByLabel('Email').fill(created.email);
        await dialog.getByLabel('Password').fill(created.password);

        const [response] = await Promise.all([
          page.waitForResponse(
            (res) => res.url() === `${API_ORIGIN}/api/users` && res.request().method() === 'POST',
          ),
          dialog.getByRole('button', { name: 'Create User' }).click(),
        ]);
        expect(response.status()).toBe(201);
        userId = ((await response.json()) as CreatedUserResponse).user.id;

        await expect(dialog).not.toBeVisible();
      });

      const createdRow = table.getByRole('row', { name: created.email });

      await test.step('new user appears in the table with the agent role', async () => {
        await expect(createdRow).toBeVisible();
        await expect(createdRow.getByText(created.name, { exact: true })).toBeVisible();
        await expect(createdRow.getByText('agent', { exact: true })).toBeVisible();
      });

      await test.step("edit the user's name and email", async () => {
        await createdRow.getByRole('button', { name: `Edit ${created.name}` }).click();

        const dialog = page.getByRole('dialog', { name: 'Edit User' });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByLabel('Name')).toHaveValue(created.name);
        await expect(dialog.getByLabel('Email')).toHaveValue(created.email);

        await dialog.getByLabel('Name').fill(edited.name);
        await dialog.getByLabel('Email').fill(edited.email);
        // Password left blank intentionally — blank means "don't change it".

        const [response] = await Promise.all([
          page.waitForResponse(
            (res) =>
              res.url() === `${API_ORIGIN}/api/users/${userId}` &&
              res.request().method() === 'PATCH',
          ),
          dialog.getByRole('button', { name: 'Save Changes' }).click(),
        ]);
        expect(response.status()).toBe(200);

        await expect(dialog).not.toBeVisible();
      });

      const editedRow = table.getByRole('row', { name: edited.email });

      await test.step('table reflects the updated name and email', async () => {
        await expect(editedRow).toBeVisible();
        await expect(editedRow.getByText(edited.name, { exact: true })).toBeVisible();
        await expect(table.getByRole('row', { name: created.email })).toHaveCount(0);
      });

      await test.step('delete the user', async () => {
        await editedRow.getByRole('button', { name: `Delete ${edited.name}` }).click();

        const confirmDialog = page.getByRole('dialog', { name: 'Delete User' });
        await expect(confirmDialog).toBeVisible();

        const [response] = await Promise.all([
          page.waitForResponse(
            (res) =>
              res.url() === `${API_ORIGIN}/api/users/${userId}` &&
              res.request().method() === 'DELETE',
          ),
          confirmDialog.getByRole('button', { name: 'Delete' }).click(),
        ]);
        expect(response.status()).toBe(204);
        userId = undefined; // already deleted; nothing left to clean up

        await expect(confirmDialog).not.toBeVisible();
      });

      await test.step('deleted user no longer appears in the table', async () => {
        await expect(table.getByRole('row', { name: edited.email })).toHaveCount(0);
      });
    } finally {

      if (userId) {
        await page.request.delete(`${API_ORIGIN}/api/users/${userId}`).catch(() => {});
      }
    }
  });
});
