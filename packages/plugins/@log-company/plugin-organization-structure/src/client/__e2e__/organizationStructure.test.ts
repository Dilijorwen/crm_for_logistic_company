/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@nocobase/test/e2e';

type CreatedDepartment = {
  id: string | number;
  parentId?: string | number | null;
};

type CreatedEmployee = {
  id: string | number;
};

const sessionHeaders = async (page: Page): Promise<Record<string, string>> => {
  const session = await page.evaluate(() => ({
    authenticator: localStorage.getItem('NOCOBASE_AUTH'),
    role: localStorage.getItem('NOCOBASE_ROLE'),
    token: localStorage.getItem('NOCOBASE_TOKEN'),
  }));
  return {
    Authorization: `Bearer ${session.token}`,
    'X-Authenticator': session.authenticator ?? '',
    'X-Role': session.role ?? '',
  };
};

const createDepartment = async (page: Page, title: string, parentId: string | number | null = null) => {
  const response = await page.request.post('/api/departments:create', {
    data: { parentId, title },
    headers: await sessionHeaders(page),
  });

  if (!response.ok()) {
    throw new Error(await response.text());
  }
  const body = (await response.json()) as { data: CreatedDepartment };
  return body.data;
};

const createEmployee = async (page: Page, token: string): Promise<CreatedEmployee> => {
  const response = await page.request.post('/api/users:create', {
    data: {
      email: `e2e_${token}@example.com`,
      nickname: `E2E employee ${token}`,
      username: `e2e_${token}`,
    },
    headers: await sessionHeaders(page),
  });
  if (!response.ok()) {
    throw new Error(await response.text());
  }
  const body = (await response.json()) as { data: CreatedEmployee };
  return body.data;
};

const departmentCard = (page: Page, title: string): Locator =>
  page.locator('.lc-org-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) });

const findDepartment = async (page: Page, title: string): Promise<CreatedDepartment | undefined> => {
  const filter = encodeURIComponent(JSON.stringify({ title }));
  const response = await page.request.get(`/api/departments:list?paginate=false&filter=${filter}`, {
    headers: await sessionHeaders(page),
  });
  if (!response.ok()) {
    throw new Error(await response.text());
  }
  const body = (await response.json()) as { data: CreatedDepartment[] };
  return body.data[0];
};

const openDepartmentAction = async (page: Page, title: string, action: string): Promise<void> => {
  await departmentCard(page, title)
    .getByRole('button', { name: `Actions ${title}` })
    .click();
  await page.getByRole('menuitem', { name: action }).click();
};

const openEmployeeAction = async (page: Page, row: Locator, employeeName: string, action: string): Promise<void> => {
  await row.getByRole('button', { name: `Actions ${employeeName}` }).click();
  await page.getByRole('menuitem', { name: action }).click();
};

test.describe('Organization structure', () => {
  test('shows the three synchronized areas and supports independent panel collapse', async ({ page }) => {
    const token = Math.random().toString(36).slice(2, 9);
    await page.goto('/admin/organization-structure');
    const root = await createDepartment(page, `E2E leadership ${token}`);
    await createDepartment(page, `E2E operations ${token}`, root.id);
    await page.reload();
    await expect(page.getByRole('link', { name: 'Organization structure', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Organization structure' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Employees' })).toBeVisible();
    await expect(page.getByRole('main', { name: 'Organization structure diagram' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Departments' })).toBeVisible();
    await expect(page.getByText(`E2E leadership ${token}`, { exact: true })).toHaveCount(2);
    await expect(page.getByText(`E2E operations ${token}`, { exact: true })).toHaveCount(2);
    await expect(page.getByText('All departments', { exact: true })).toHaveCount(0);
    await expect(page.locator('[draggable="true"]')).toHaveCount(0);

    const canvas = page.getByRole('main', { name: 'Organization structure diagram' });
    const widthWithPanels = await canvas.evaluate((element) => element.getBoundingClientRect().width);
    await page.getByRole('button', { name: 'Collapse employees panel' }).click();
    const widthWithoutLeftPanel = await canvas.evaluate((element) => element.getBoundingClientRect().width);
    expect(widthWithoutLeftPanel).toBeGreaterThan(widthWithPanels);
    await page.getByRole('button', { name: 'Collapse departments panel' }).click();
    const widthWithoutPanels = await canvas.evaluate((element) => element.getBoundingClientRect().width);
    expect(widthWithoutPanels).toBeGreaterThan(widthWithoutLeftPanel);
    await page.getByRole('button', { name: 'Expand employees panel' }).click();
    await page.getByRole('button', { name: 'Expand departments panel' }).click();
  });

  test('searches departments, focuses cards, and changes only diagram zoom', async ({ page }) => {
    const token = Math.random().toString(36).slice(2, 9);
    await page.goto('/admin/organization-structure');
    await createDepartment(page, `E2E finance ${token}`);
    await createDepartment(page, `E2E legal ${token}`);
    await createDepartment(page, `E2E logistics ${token}`);
    await createDepartment(page, `E2E sales ${token}`);
    await page.reload();

    await page.getByRole('searchbox', { name: 'Search departments' }).fill(`finance ${token}`);
    await page.getByRole('treeitem', { name: `E2E finance ${token}` }).click();
    await expect(page.locator('.lc-org-card--selected')).toContainText(`E2E finance ${token}`);

    const employeesPanel = page.getByRole('complementary', { name: 'Employees' });
    const initialPanelWidth = await employeesPanel.evaluate((element) => element.getBoundingClientRect().width);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByRole('button', { name: 'Reset zoom to 100%' })).toContainText('110%');
    expect(await employeesPanel.evaluate((element) => element.getBoundingClientRect().width)).toBe(initialPanelWidth);

    const canvas = page.getByRole('main', { name: 'Organization structure diagram' });
    await page.getByRole('button', { name: 'Reset zoom to 100%' }).click();
    const maximumScrollLeft = await canvas.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(maximumScrollLeft).toBeGreaterThan(100);
    await canvas.evaluate((element, left) => {
      element.scrollLeft = left;
    }, maximumScrollLeft / 2);
    const scrollLeftBeforePan = await canvas.evaluate((element) => element.scrollLeft);
    const panStart = await canvas.evaluate((element) => {
      const rectangle = element.getBoundingClientRect();
      for (let y = rectangle.bottom - 80; y > rectangle.top + 80; y -= 40) {
        for (let x = rectangle.left + 40; x < rectangle.right - 100; x += 40) {
          const target = document.elementFromPoint(x, y);
          if (target && element.contains(target) && !target.closest('[data-interactive="true"]')) {
            return { x, y };
          }
        }
      }
      return null;
    });
    if (!panStart) {
      throw new Error('The organization canvas has no free panning area');
    }
    await page.mouse.move(panStart.x, panStart.y);
    await page.mouse.down();
    await page.mouse.move(panStart.x + 120, panStart.y);
    await page.mouse.up();
    expect(await canvas.evaluate((element) => element.scrollLeft)).toBeLessThan(scrollLeftBeforePan);
  });

  test('creates root and child departments, renames them, and prevents cyclic moves', async ({ page }) => {
    test.setTimeout(90_000);
    const token = Math.random().toString(36).slice(2, 9);
    const rootTitle = `E2E UI root ${token}`;
    const targetTitle = `E2E UI target ${token}`;
    const childTitle = `E2E UI child ${token}`;
    const renamedChildTitle = `E2E UI renamed ${token}`;

    await page.goto('/admin/organization-structure');
    await expect(page.getByRole('heading', { name: 'Organization structure' })).toBeVisible();

    await page.getByRole('button', { name: 'Create root department' }).click();
    let dialog = page.getByRole('dialog', { name: 'Create root department' });
    await dialog.getByRole('textbox', { name: 'Name' }).fill(rootTitle);
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(rootTitle, { exact: true })).toHaveCount(2);

    await page.getByRole('button', { name: 'Create root department' }).click();
    dialog = page.getByRole('dialog', { name: 'Create root department' });
    await dialog.getByRole('textbox', { name: 'Name' }).fill(targetTitle);
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(targetTitle, { exact: true })).toHaveCount(2);

    await page.getByRole('button', { name: `Add child department: ${rootTitle}` }).click();
    dialog = page.getByRole('dialog', { name: 'Add child department' });
    await dialog.getByRole('textbox', { name: 'Name' }).fill(childTitle);
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(childTitle, { exact: true })).toHaveCount(2);

    await openDepartmentAction(page, childTitle, 'Edit department');
    dialog = page.getByRole('dialog', { name: 'Edit department' });
    await dialog.getByRole('textbox', { name: 'Name' }).fill(renamedChildTitle);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(renamedChildTitle, { exact: true })).toHaveCount(2);

    await openDepartmentAction(page, renamedChildTitle, 'Move department');
    dialog = page.getByRole('dialog', { name: 'Move department' });
    await dialog.locator('.ant-select-selector').click();
    await page.getByRole('option', { name: targetTitle }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect
      .poll(async () => {
        const target = await findDepartment(page, targetTitle);
        const child = await findDepartment(page, renamedChildTitle);
        return String(child?.parentId) === String(target?.id);
      })
      .toBe(true);

    await openDepartmentAction(page, targetTitle, 'Move department');
    dialog = page.getByRole('dialog', { name: 'Move department' });
    await dialog.locator('.ant-select-selector').click();
    await expect(page.getByRole('option', { name: renamedChildTitle })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test('assigns, manages, moves, and removes employees through explicit actions', async ({ page }) => {
    test.setTimeout(90_000);
    const token = Math.random().toString(36).slice(2, 9);
    const firstEmployeeName = `E2E employee ${token}a`;
    const secondEmployeeName = `E2E employee ${token}b`;
    const firstDepartmentTitle = `E2E employee source ${token}`;
    const secondDepartmentTitle = `E2E employee target ${token}`;

    await page.goto('/admin/organization-structure');
    await createDepartment(page, firstDepartmentTitle);
    await createDepartment(page, secondDepartmentTitle);
    const firstEmployee = await createEmployee(page, `${token}a`);
    await createEmployee(page, `${token}b`);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Organization structure' })).toBeVisible();

    const employeesPanel = page.getByRole('complementary', { name: 'Employees' });
    await employeesPanel.getByRole('searchbox', { name: 'Name, position, or email' }).fill(firstEmployeeName);
    await employeesPanel.locator('.ant-select-selector').click();
    await page.getByRole('option', { name: 'Unassigned' }).click();
    const firstEmployeeRow = employeesPanel.locator(`[data-employee-id="${firstEmployee.id}"]`);
    await expect(firstEmployeeRow).toContainText(firstEmployeeName);

    await openEmployeeAction(page, firstEmployeeRow, firstEmployeeName, 'Assign to department');
    let dialog = page.getByRole('dialog', { name: 'Assign to department' });
    await dialog.locator('.ant-select-selector').click();
    await page.getByRole('option', { name: firstDepartmentTitle }).click();
    await dialog.getByRole('button', { name: 'Assign to department' }).click();
    await expect(departmentCard(page, firstDepartmentTitle)).toContainText(firstEmployeeName);
    await expect(departmentCard(page, firstDepartmentTitle)).toHaveClass(/lc-org-card--selected/);

    await openDepartmentAction(page, firstDepartmentTitle, 'Assign or change manager');
    dialog = page.getByRole('dialog', { name: 'Assign or change manager' });
    await dialog.locator('.ant-select-selector').click();
    await page.getByRole('option', { name: firstEmployeeName }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(departmentCard(page, firstDepartmentTitle)).toContainText(firstEmployeeName);

    await openDepartmentAction(page, firstDepartmentTitle, 'Add employees');
    dialog = page.getByRole('dialog', { name: 'Add employees' });
    await dialog.locator('.ant-select-selector').click();
    await page.getByRole('option', { name: secondEmployeeName }).click();
    await page.keyboard.press('Escape');
    await dialog.getByRole('button', { name: 'Add employees' }).click();
    await expect(departmentCard(page, firstDepartmentTitle)).toContainText(secondEmployeeName);

    await employeesPanel.locator('.ant-select-selector').click();
    await page.getByRole('option', { name: 'All employees' }).click();
    await expect(firstEmployeeRow).toContainText(firstEmployeeName);
    await openEmployeeAction(page, firstEmployeeRow, firstEmployeeName, 'Move to another department');
    dialog = page.getByRole('dialog', { name: 'Assign to department' });
    await dialog.locator('.ant-select-selector').click();
    await page.getByRole('option', { name: secondDepartmentTitle }).click();
    dialog = page.getByRole('dialog', { name: 'Move to another department' });
    await expect(dialog).toContainText(firstDepartmentTitle);
    await expect(dialog).toContainText(secondDepartmentTitle);
    await dialog.getByRole('button', { name: 'Move to another department' }).click();
    await expect(departmentCard(page, secondDepartmentTitle)).toContainText(firstEmployeeName);

    const movedEmployee = departmentCard(page, secondDepartmentTitle).locator(
      `[data-employee-id="${firstEmployee.id}"]`,
    );
    await openEmployeeAction(page, movedEmployee, firstEmployeeName, 'Remove from department');
    dialog = page.getByRole('dialog').filter({ hasText: `Remove “${firstEmployeeName}” from the department?` });
    await dialog.getByRole('button', { name: 'Remove from department' }).click();
    await expect(departmentCard(page, secondDepartmentTitle)).not.toContainText(firstEmployeeName);
    await expect(firstEmployeeRow).toContainText(firstEmployeeName);
  });

  test('shares department records with the standard NocoBase interface in both directions', async ({ page }) => {
    test.setTimeout(60_000);
    const token = Math.random().toString(36).slice(2, 9);
    const standardTitle = `E2E standard source ${token}`;
    const visualTitle = `E2E visual source ${token}`;

    await page.goto('/admin/settings/users-permissions/departments');
    await page.getByRole('button', { name: 'New department' }).click();
    let dialog = page.getByRole('dialog').last();
    await expect(dialog).toContainText('New department');
    await dialog.locator('input.ant-input').fill(standardTitle);
    await dialog.getByRole('button', { name: 'Submit' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(standardTitle, { exact: true })).toBeVisible();

    await page.goto('/admin/organization-structure');
    await expect(page.getByText(standardTitle, { exact: true })).toHaveCount(2);
    await page.getByRole('button', { name: 'Create root department' }).click();
    dialog = page.getByRole('dialog', { name: 'Create root department' });
    await dialog.getByRole('textbox', { name: 'Name' }).fill(visualTitle);
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(visualTitle, { exact: true })).toHaveCount(2);

    await page.goto('/admin/settings/users-permissions/departments');
    await expect(page.getByText(visualTitle, { exact: true })).toBeVisible();
  });

  test('keeps the page read-only for a role with view permissions', async ({ page, mockRole }) => {
    const token = Math.random().toString(36).slice(2, 9);
    const departmentTitle = `E2E read only ${token}`;

    await page.goto('/admin/organization-structure');
    await createDepartment(page, departmentTitle);
    const role = await mockRole({
      allowNewMenu: true,
      resources: [
        {
          usingActionsConfig: true,
          name: 'departments',
          actions: [{ name: 'view', fields: ['id', 'title', 'parentId'], scope: null }],
        },
        {
          usingActionsConfig: true,
          name: 'users',
          actions: [{ name: 'view', fields: ['id', 'nickname', 'username', 'email'], scope: null }],
        },
      ],
    });
    await page.evaluate((roleName) => localStorage.setItem('NOCOBASE_ROLE', roleName), role.name);
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Organization structure' })).toBeVisible();
    await expect(page.getByText(departmentTitle, { exact: true })).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Create root department' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Add child department: ${departmentTitle}` })).toHaveCount(0);

    await departmentCard(page, departmentTitle)
      .getByRole('button', { name: `Actions ${departmentTitle}` })
      .click();
    await expect(page.getByRole('menuitem', { name: 'Show all' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Edit department' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Add child department' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Assign or change manager' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Add employees' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Move department' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Delete department' })).toHaveCount(0);
  });

  test('uses the standard users and departments system permissions for an HR role', async ({ page, mockRole }) => {
    const token = Math.random().toString(36).slice(2, 9);
    const departmentTitle = `E2E HR permissions ${token}`;

    await page.goto('/admin/organization-structure');
    await createDepartment(page, departmentTitle);
    const role = await mockRole({
      allowNewMenu: true,
      snippets: ['pm.users', 'pm.departments'],
    });
    await page.evaluate((roleName) => localStorage.setItem('NOCOBASE_ROLE', roleName), role.name);
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Organization structure' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create root department' })).toBeVisible();
    await expect(page.getByRole('button', { name: `Add child department: ${departmentTitle}` })).toBeVisible();

    await departmentCard(page, departmentTitle)
      .getByRole('button', { name: `Actions ${departmentTitle}` })
      .click();
    await expect(page.getByRole('menuitem', { name: 'Edit department' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Add child department' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Assign or change manager' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Add employees' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Move department' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete department' })).toBeVisible();
  });
});
