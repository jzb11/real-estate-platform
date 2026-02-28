import { chromium, type Browser, type Page, type Download } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ScrapeConfig {
  location: string; // "Miami-Dade County, FL" or zip code
  filters?: {
    minEquityPercent?: number;
    propertyType?: string; // "Single Family", "Multi-Family", etc.
    foreclosure?: boolean;
    preForeclosure?: boolean;
    taxLien?: boolean;
    absenteeOwner?: boolean;
    maxResults?: number; // Default: 1000
  };
  headless?: boolean; // Default true, set false for debugging
}

const PROPSTREAM_LOGIN_URL = 'https://app.propstream.com/login';
const PROPSTREAM_SEARCH_URL = 'https://app.propstream.com/search';

/** Delay between actions to avoid detection */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Random delay between min and max ms to appear more human */
function randomDelay(minMs = 2000, maxMs = 3500): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return delay(ms);
}

/**
 * Launch headless Chromium, log into PropStream, apply search filters,
 * export CSV, and return the downloaded CSV contents as a string.
 */
export async function scrapePropStream(config: ScrapeConfig): Promise<string> {
  const email = process.env.PROPSTREAM_EMAIL;
  const password = process.env.PROPSTREAM_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'PROPSTREAM_EMAIL and PROPSTREAM_PASSWORD environment variables are required'
    );
  }

  const headless = config.headless ?? true;
  let browser: Browser | null = null;

  // Create temp directory for downloads
  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'propstream-'));

  try {
    browser = await chromium.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      acceptDownloads: true,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
    });

    const page = await context.newPage();

    // Step 1: Login
    await login(page, email, password);

    // Step 2: Navigate to search
    await navigateToSearch(page);

    // Step 3: Enter location
    await enterLocation(page, config.location);

    // Step 4: Apply filters
    if (config.filters) {
      await applyFilters(page, config.filters);
    }

    // Step 5: Trigger search
    await triggerSearch(page);

    // Step 6: Export CSV and capture download
    const csvContent = await exportCsv(page, downloadDir);

    await context.close();

    return csvContent;
  } finally {
    if (browser) {
      await browser.close();
    }
    // Clean up temp download directory
    try {
      fs.rmSync(downloadDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  }
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto(PROPSTREAM_LOGIN_URL, { waitUntil: 'networkidle' });
  await randomDelay();

  // Try multiple selector strategies for the login form
  const emailSelectors = [
    'input[name="email"]',
    'input[type="email"]',
    'input[placeholder*="email" i]',
    '#email',
  ];
  const passwordSelectors = [
    'input[name="password"]',
    'input[type="password"]',
    'input[placeholder*="password" i]',
    '#password',
  ];

  const emailInput = await findElement(page, emailSelectors);
  if (!emailInput) {
    throw new Error('Could not find email input on login page');
  }

  const passwordInput = await findElement(page, passwordSelectors);
  if (!passwordInput) {
    throw new Error('Could not find password input on login page');
  }

  // Type credentials with human-like delays
  await emailInput.click();
  await emailInput.fill(email);
  await delay(500);

  await passwordInput.click();
  await passwordInput.fill(password);
  await randomDelay(1000, 2000);

  // Click login button
  const loginButtonSelectors = [
    'button[type="submit"]',
    'button:has-text("Log In")',
    'button:has-text("Login")',
    'button:has-text("Sign In")',
    'input[type="submit"]',
  ];

  const loginButton = await findElement(page, loginButtonSelectors);
  if (!loginButton) {
    throw new Error('Could not find login button');
  }

  await loginButton.click();

  // Wait for navigation after login — look for dashboard indicators
  await page.waitForURL((url) => !url.toString().includes('/login'), {
    timeout: 30000,
  });

  await randomDelay();

  // Verify login succeeded by checking we're not on an error page
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    throw new Error('Login failed — still on login page. Check credentials.');
  }
}

async function navigateToSearch(page: Page): Promise<void> {
  await page.goto(PROPSTREAM_SEARCH_URL, { waitUntil: 'networkidle' });
  await randomDelay();
}

async function enterLocation(page: Page, location: string): Promise<void> {
  // PropStream has a search/location input on the search page
  const locationSelectors = [
    'input[placeholder*="county" i]',
    'input[placeholder*="location" i]',
    'input[placeholder*="search" i]',
    'input[placeholder*="address" i]',
    'input[name="location"]',
    'input[name="search"]',
    '[data-testid="location-input"]',
    '.search-input input',
    '.location-search input',
  ];

  const locationInput = await findElement(page, locationSelectors);
  if (!locationInput) {
    throw new Error('Could not find location search input');
  }

  await locationInput.click();
  await delay(300);
  await locationInput.fill('');
  await delay(200);

  // Type location character by character for autocomplete to work
  await locationInput.pressSequentially(location, { delay: 50 });
  await randomDelay(2000, 4000);

  // Select first autocomplete suggestion
  const suggestionSelectors = [
    '.autocomplete-suggestion:first-child',
    '.search-suggestion:first-child',
    '[role="option"]:first-child',
    '.dropdown-item:first-child',
    'li[role="option"]:first-child',
    '.suggestion-list li:first-child',
  ];

  const suggestion = await findElement(page, suggestionSelectors);
  if (suggestion) {
    await suggestion.click();
    await randomDelay();
  } else {
    // If no dropdown, press Enter
    await locationInput.press('Enter');
    await randomDelay();
  }
}

async function applyFilters(
  page: Page,
  filters: NonNullable<ScrapeConfig['filters']>
): Promise<void> {
  // Look for a "Filters" button to open the filter panel
  const filterButtonSelectors = [
    'button:has-text("Filter")',
    'button:has-text("Filters")',
    'button:has-text("More Filters")',
    '[data-testid="filters-button"]',
    '.filter-button',
  ];

  const filterButton = await findElement(page, filterButtonSelectors);
  if (filterButton) {
    await filterButton.click();
    await randomDelay(1000, 2000);
  }

  // Apply equity filter
  if (filters.minEquityPercent !== undefined) {
    const equityInput = await findElement(page, [
      'input[name*="equity" i]',
      'input[placeholder*="equity" i]',
      '[data-testid="min-equity"]',
    ]);
    if (equityInput) {
      await equityInput.fill(String(filters.minEquityPercent));
      await delay(500);
    }
  }

  // Apply property type filter
  if (filters.propertyType) {
    const typeSelector = await findElement(page, [
      'select[name*="property" i]',
      '[data-testid="property-type"]',
      'button:has-text("Property Type")',
    ]);
    if (typeSelector) {
      const tagName = await typeSelector.evaluate((el) => el.tagName.toLowerCase());
      if (tagName === 'select') {
        await typeSelector.selectOption({ label: filters.propertyType });
      } else {
        await typeSelector.click();
        await delay(500);
        const option = page.locator(`text="${filters.propertyType}"`).first();
        if (await option.isVisible()) {
          await option.click();
        }
      }
      await delay(500);
    }
  }

  // Apply boolean filters (foreclosure, pre-foreclosure, tax lien, absentee owner)
  const booleanFilters: Array<{ value?: boolean; labels: string[] }> = [
    {
      value: filters.foreclosure,
      labels: ['Foreclosure', 'In Foreclosure'],
    },
    {
      value: filters.preForeclosure,
      labels: ['Pre-Foreclosure', 'Pre Foreclosure', 'PreForeclosure'],
    },
    {
      value: filters.taxLien,
      labels: ['Tax Lien', 'Tax Liens'],
    },
    {
      value: filters.absenteeOwner,
      labels: ['Absentee Owner', 'Absentee'],
    },
  ];

  for (const filter of booleanFilters) {
    if (filter.value) {
      for (const label of filter.labels) {
        const checkbox = page.locator(`label:has-text("${label}") input[type="checkbox"]`).first();
        if (await checkbox.isVisible({ timeout: 1000 }).catch(() => false)) {
          if (!(await checkbox.isChecked())) {
            await checkbox.check();
          }
          await delay(300);
          break;
        }

        // Try clicking a button/toggle with the label text
        const toggle = page.locator(`button:has-text("${label}")`).first();
        if (await toggle.isVisible({ timeout: 1000 }).catch(() => false)) {
          await toggle.click();
          await delay(300);
          break;
        }
      }
    }
  }

  await randomDelay(1000, 2000);
}

async function triggerSearch(page: Page): Promise<void> {
  const searchButtonSelectors = [
    'button:has-text("Search")',
    'button:has-text("Apply")',
    'button[type="submit"]',
    '[data-testid="search-button"]',
    '.search-button',
  ];

  const searchButton = await findElement(page, searchButtonSelectors);
  if (searchButton) {
    await searchButton.click();
  }

  // Wait for results to load
  await page.waitForLoadState('networkidle');
  await randomDelay(3000, 5000);

  // Verify results appeared
  const hasResults = await page
    .locator('table, .results, .property-list, [data-testid="results"]')
    .first()
    .isVisible({ timeout: 15000 })
    .catch(() => false);

  if (!hasResults) {
    // Check for "no results" message
    const noResults = await page
      .locator('text=/no results|no properties|0 results/i')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (noResults) {
      throw new Error('Search returned no results for the given location and filters');
    }
  }
}

async function exportCsv(page: Page, downloadDir: string): Promise<string> {
  // Try to select all results first
  const selectAllSelectors = [
    'input[type="checkbox"][name*="all" i]',
    'th input[type="checkbox"]',
    'button:has-text("Select All")',
    '[data-testid="select-all"]',
    '.select-all',
  ];

  const selectAll = await findElement(page, selectAllSelectors);
  if (selectAll) {
    await selectAll.click();
    await delay(1000);
  }

  // Find and click the export/download button
  const exportSelectors = [
    'button:has-text("Export")',
    'button:has-text("Download")',
    'button:has-text("Export CSV")',
    'button:has-text("Download CSV")',
    'a:has-text("Export")',
    'a:has-text("Download")',
    '[data-testid="export-button"]',
    '.export-button',
  ];

  const exportButton = await findElement(page, exportSelectors);
  if (!exportButton) {
    throw new Error(
      'Could not find Export/Download button on search results page'
    );
  }

  // Wait for download to start when clicking export
  const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
  await exportButton.click();

  // Some UIs show a format selection dialog — look for CSV option
  await delay(1000);
  const csvOption = page.locator('text=/csv/i, button:has-text("CSV")').first();
  if (await csvOption.isVisible({ timeout: 2000 }).catch(() => false)) {
    await csvOption.click();
  }

  // Also look for a confirm/download button in a modal
  const confirmButton = page
    .locator(
      'button:has-text("Download"), button:has-text("Export"), button:has-text("Confirm")'
    )
    .first();
  if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    const secondDownload = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
    await confirmButton.click();
    // If a second download event fires, use that one
    const dl = await secondDownload;
    if (dl) {
      return await readDownload(dl, downloadDir);
    }
  }

  let download: Download;
  try {
    download = await downloadPromise;
  } catch {
    throw new Error(
      'CSV download did not start within 60 seconds. The export button may not have triggered a download.'
    );
  }

  return await readDownload(download, downloadDir);
}

async function readDownload(download: Download, downloadDir: string): Promise<string> {
  const filePath = path.join(downloadDir, download.suggestedFilename() || 'export.csv');
  await download.saveAs(filePath);

  const csvContent = fs.readFileSync(filePath, 'utf-8');

  if (!csvContent.trim()) {
    throw new Error('Downloaded CSV file is empty');
  }

  return csvContent;
}

/** Try multiple selectors and return the first visible element found */
async function findElement(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        return element;
      }
    } catch {
      // Selector not found or not visible, try next
    }
  }
  return null;
}
