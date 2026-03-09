import axios from "axios";
import * as cheerio from "cheerio";
import { envNumber } from "../utils/env.js";
import type { IntegrationConfig, IntegrationDocsBundle, UpdaterConfig } from "../types.js";

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_TEXT_CHARS = 24_000;

/**
 * Normalizes HTML text for stable prompting and diffing.
 */
function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
}

/**
 * Extracts basic table rows in a human-readable flattened format.
 */
function extractTableRows($: cheerio.CheerioAPI): string[] {
  const rows: string[] = [];
  $("table tr").each((_i, tr) => {
    const cells = $(tr)
      .find("th,td")
      .map((_idx, cell) => normalizeText($(cell).text()))
      .get()
      .filter(Boolean);
    if (cells.length) {
      rows.push(cells.join(" | "));
    }
  });
  return rows;
}

/**
 * Fetches and parses a docs page into normalized text and table rows.
 */
async function crawlSingleDoc(url: string): Promise<{ title: string; normalizedText: string; tableRows: string[] }> {
  const timeoutMs = envNumber("UPDATER_DOC_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  const maxChars = envNumber("UPDATER_DOC_MAX_CHARS", DEFAULT_MAX_TEXT_CHARS);

  const response = await axios.get<string>(url, {
    timeout: timeoutMs,
    headers: {
      "User-Agent": "docs-driven-api-updater/1.0.0 (+https://npmjs.com/package/docs-driven-api-updater)"
    }
  });

  const $ = cheerio.load(response.data);
  const title = normalizeText($("title").first().text()) || url;
  const bodyText = normalizeText($("main").text() || $("body").text()).slice(0, maxChars);
  const tableRows = extractTableRows($).slice(0, 500);

  return {
    title,
    normalizedText: bodyText,
    tableRows
  };
}

/**
 * Crawls all configured docs URLs for one integration.
 */
async function crawlIntegrationDocs(integration: IntegrationConfig): Promise<IntegrationDocsBundle> {
  const pages = await Promise.all(
    integration.docUrls.map(async (url) => {
      const parsed = await crawlSingleDoc(url);
      return {
        url,
        title: parsed.title,
        normalizedText: parsed.normalizedText,
        tableRows: parsed.tableRows
      };
    })
  );

  return {
    integrationName: integration.name,
    pages
  };
}

/**
 * Fetches docs content for all integrations in updater.config.json.
 */
export async function crawlAllDocs(config: UpdaterConfig): Promise<IntegrationDocsBundle[]> {
  return Promise.all(config.integrations.map((integration) => crawlIntegrationDocs(integration)));
}
