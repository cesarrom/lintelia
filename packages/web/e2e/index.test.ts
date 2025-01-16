
import { test, expect } from '@playwright/test';

test.describe('End-to-end flow', () => {
  test('should complete signup and onboarding flow', async ({ page }) => {
    // Visit landing page
    await page.goto(process.env.HOST!);
    
    // Verify landing page content
    await expect(page.getByText('Secure Document Management for Banks')).toBeVisible();
    
    // Navigate to sign-on
    await page.getByRole('link', { name: 'Go to app' }).click();
    
    // Fill signup form
    await page.getByLabel('Full Name').fill('Test User');
        await page.getByLabel('Email').fill('test@example.com');
        await page.getByLabel('Phone Number').fill('1234567890');
        await page.getByLabel('Password').fill('TestPassword123!');
        await page.getByRole('button', { name: 'Create Account' }).click();
     

    // Fill onboarding form
    await page.getByLabel('Legal Name').fill('Test Organization');
    await page.getByLabel('Domain Name').fill('test-org');
    await page.getByLabel('Address Line 1').fill('123 Test Street');
    await page.getByLabel('City').fill('Test City');
    await page.getByLabel('State/Province').fill('Test State');
    await page.getByLabel('Country').click();
    await page.getByRole('option', { name: 'United States' }).click();
    await page.getByLabel('Zip/Postal Code').fill('12345');
    
    // Set working hours
    await page.getByRole('textbox', { name: 'startWorkingHour' }).fill('09:00');
    await page.getByRole('textbox', { name: 'endWorkingHour' }).fill('17:00');
    
    // Set theme colors
    await page.getByLabel('Primary Color').fill('#FF0000');
    await page.getByLabel('Secondary Color').fill('#00FF00');
    await page.getByLabel('Accent Color').fill('#0000FF');
    
    // Add allowed domain
    await page.getByPlaceholder('add a domain').fill('example.com');
    await page.getByRole('button', { name: 'Add' }).click();
    
    // Upload contracts
    await page.getByLabel('Individual Terms Template').setInputFiles('test-files/individual.pdf');
    await page.getByLabel('Co-Applicant Terms Template').setInputFiles('test-files/co-applicant.pdf');
    await page.getByLabel('Business Terms Template').setInputFiles('test-files/business.pdf');
    
    // Submit form
    await page.getByRole('button', { name: 'Save Settings' }).click();
    
    // Verify redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });
});
