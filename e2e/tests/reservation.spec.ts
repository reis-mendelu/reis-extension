import { test, expect } from '../fixtures/extension';
import { addDays, nextFriday, format, startOfDay } from 'date-fns';

test.describe('Reservation Flow', () => {
  test('should book Individuální studovna 2 for next Friday 9:00-11:00', async ({ extensionPage }) => {
    // 1. Calculate Target Date (Next Friday)
    // We use the mocked time from the system if available, but for now we rely on the Date object
    // Metadata says system time is 2026-01-05 (Monday)
    // Next Friday is 2026-01-09
    const today = new Date(); // This uses system time which matches metadata
    const targetDate = nextFriday(today);
    
    // Format expected in the UI (d.M.yyyy) - checking React format in ReservationDrawer
    // format(day, 'dd.MM.yyyy') is used in ReservationDrawer.tsx line 244
    // Wait, the line 35 says format(new Date(), 'dd.MM.yyyy').
    // So we should match that format.
    const expectedDateStr = format(targetDate, 'dd.MM.yyyy');
    
    console.log(`Target Date: ${expectedDateStr}`);

    // 2. Open Reservation Drawer
    console.log('Opening drawer...');
    const studovnyBtn = extensionPage.locator('button, div').filter({ hasText: 'Studovny' }).last();
    await studovnyBtn.click();
    
    const drawer = extensionPage.getByRole('dialog');
    await expect(drawer).toBeVisible();

    // 3. Select Room: Individuální studovna 2
    console.log('Selecting room...');
    const specificRoomSelect = extensionPage.locator('div').filter({ hasText: 'Konkrétní místnost' }).last().locator('select');
    await specificRoomSelect.selectOption('individuální studovna 2');

    // 4. Select Date
    console.log('Selecting date...');
    await extensionPage.locator('summary').click();
    
    // DayPicker: target by day number text EXACT match
    const dayNumber = targetDate.getDate().toString();
    const dayBtn = extensionPage.locator('.rdp-day').filter({ hasText: dayNumber, hasNotText: '1' + dayNumber }).filter({ hasNotText: '2' + dayNumber }).filter({ hasNotText: '3' + dayNumber }).first(); 
    // The filter checks above are weak (what if day is 3? then 13, 23...). 
    // Better: use text exact match if possible or regex.
    // Playwright `getByText(dayNumber, { exact: true })` works if the element text is exactly the number.
    await extensionPage.locator('.rdp-day').getByText(dayNumber, { exact: true }).click();
    
    await expect(extensionPage.locator('summary')).toContainText(expectedDateStr);

    // 5. Select Time
    console.log('Selecting time...');
    // Use stable index-based selectors as the layout is known
    // 0 = Room, 1 = Time From, 2 = Time To
    const timeFromSelect = extensionPage.locator('select').nth(1);
    await timeFromSelect.selectOption('9:00');
    
    const timeToSelect = extensionPage.locator('select').nth(2);
    await timeToSelect.selectOption('11:00');

    // 6. Submit
    console.log('Clicked Submit...');
    await extensionPage.getByRole('button', { name: 'Rezervovat' }).click();

    // 7. Verify Success
    console.log('Waiting for result...');
    const successToast = extensionPage.locator('text=Rezervace byla odeslána!');
    const errorToast = extensionPage.locator('text=Chyba');
    
    try {
        await expect(successToast).toBeVisible({ timeout: 15000 });
        console.log('Success toast appeared!');
    } catch (e) {
        console.log('Checking for error toast...');
        if (await errorToast.isVisible()) {
            const errorText = await errorToast.innerText();
            const errorDesc = await extensionPage.locator('.sonner-toast-description').innerText().catch(() => '');
            throw new Error(`Reservation failed with error toast: "${errorText}" - "${errorDesc}"`);
        }
        
        // Dump console errors from page
        const errors = await extensionPage.evaluate(() => {
            // @ts-ignore
            return window.consoleErrors || []; // requires monitoring code injection or fixture access?
            // The fixture captures consoleErrors in a variable. I need to access it from the test argument.
        });
        
        throw new Error(`Reservation timeout. No toast appeared. Browser console errors: TODO: check test output.`);
    }
  });
});
