const http = require('http');
const app = require('../server');
const request = require('supertest');

let puppeteer;
let server;
let browser;
let page;
const PORT = 3010; // Use a different port for UI testing
const BASE_URL = `http://localhost:${PORT}`;

describe('UI Bugs Tests', () => {
  beforeAll(async () => {
    puppeteer = (await import('puppeteer')).default;
    // Start server
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(async () => {
    // Reset data
    await request(app).post('/api/reset');
    
    page = await browser.newPage();
    await page.goto(BASE_URL);
    // Wait for the invoice table to load
    await page.waitForSelector('#invoice-body tr');
  });

  afterEach(async () => {
    await page.close();
  });

  // Bug 7: UI - wrong-format-display
  test('7. Invoice amounts should display with ₹ symbol and Indian grouping', async () => {
    const totalText = await page.$eval('#invoice-body tr:first-child .total-cell', el => el.textContent);
    
    // Total should be ₹1,829.00 instead of 1829.00
    expect(totalText).toMatch(/₹/);
    expect(totalText).toMatch(/1,829\.00/);
  });

  // Bug 10: UI - wrong-status-badge-color
  test('10. PAID status badge should not use the blue class', async () => {
    // Apply credit note of 1270 to Invoice 3 to make it PAID
    await page.type('#invoice-body tr[data-id="3"] .cn-amount', '1270');
    await page.click('#invoice-body tr[data-id="3"] .cn-submit');
    
    // Wait for UI to update
    await page.waitForSelector('.toast:not(.hidden)');
    
    const badgeClass = await page.$eval('#invoice-body tr[data-id="3"] .badge', el => el.className);
    
    // It should have 'badge' but NOT 'blue'
    expect(badgeClass).toContain('badge');
    expect(badgeClass).not.toContain('blue');
  });

  // Bug 8: UI - state-not-persisted
  test('8. UI balance and status should update immediately after successful credit note', async () => {
    // Apply credit note of 550 to Invoice 1 (Balance 1829 -> 1279)
    await page.type('#invoice-body tr[data-id="1"] .cn-amount', '550');
    await page.click('#invoice-body tr[data-id="1"] .cn-submit');
    
    // Wait for toast to appear, which indicates the fetch has completed
    await page.waitForSelector('.toast:not(.hidden)');
    
    // Check the new balance in the table without reloading
    const newBalanceText = await page.$eval('#invoice-body tr[data-id="1"] .balance-cell', el => el.textContent);
    
    // Ensure the balance is updated (1829 - 550 = 1279)
    expect(newBalanceText).toContain('1,279.00');
  });

  // Bug 9: UI - missing-ui-feedback-guard
  test('9. Submitting blank credit note amount should show validation error and block API', async () => {
    let apiCalled = false;
    page.on('request', request => {
      if (request.url().includes('/credit-note') && request.method() === 'POST') {
        apiCalled = true;
      }
    });

    // Leave input blank and click apply on Invoice 1
    await page.click('#invoice-body tr[data-id="1"] .cn-submit');
    
    // Wait a brief moment to allow any async operations
    await new Promise(r => setTimeout(r, 500));
    
    // API should not have been called
    expect(apiCalled).toBe(false);
    
    // Toast should be visible showing an error
    const toastVisible = await page.$eval('.toast', el => !el.classList.contains('hidden'));
    expect(toastVisible).toBe(true);
  });
});
