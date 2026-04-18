import { test, expect } from '@playwright/test'

/**
 * E2E tests for authentication flow.
 * Requires the Next.js dev server to be running at localhost:3000.
 */

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('shows login form with heading and inputs', async ({ page }) => {
    // There are 2 headings — target the card heading specifically
    await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeVisible()
    await expect(page.locator('input[type="text"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'เข้าสู่ระบบ' })).toBeVisible()
  })

  test('shows required validation on empty submit', async ({ page }) => {
    await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click()
    // Browser native required validation prevents form submission
    const usernameInput = page.locator('input[type="text"]')
    const isInvalid = await usernameInput.evaluate((el: HTMLInputElement) => !el.validity.valid)
    expect(isInvalid).toBe(true)
  })

  test('shows error on wrong credentials', async ({ page }) => {
    await page.locator('input[type="text"]').fill('wronguser')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click()

    // Wait for API response and error message to appear
    await expect(
      page.locator('.bg-red-50, .bg-red-900').first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('unauthenticated visit to /dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })

  test('unauthenticated visit to /datasets redirects to login', async ({ page }) => {
    await page.goto('/datasets')
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })

  test('page title contains app name', async ({ page }) => {
    await expect(page).toHaveTitle(/.+/)
    await expect(page.getByRole('heading', { name: 'GDCatalog Quality Control System' })).toBeVisible()
  })
})
