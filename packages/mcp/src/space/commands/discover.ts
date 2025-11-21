import type { ToolResult } from '../../types/tool-result.js';
import { escapeMarkdown } from '../../utilities.js';

/**
 * Prompt configuration for discover operation
 * Easy to edit for prompt optimization
 */
export const DISCOVER_PROMPTS = {
	// Header for discover results
	RESULTS_HEADER: `# Available Spaces

These MCP-enabled Spaces can be invoked using the \`dynamic_space\` tool.
Use \`"operation": "view_parameters"\` to inspect a space's parameters before invoking.

`,

	// No data message
	NO_DATA: `No spaces available in the dynamic spaces list.`,

	// Error message
	FETCH_ERROR: (url: string, error: string) =>
		`Error fetching spaces from ${url}: ${error}`,
};

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				// Escaped quote
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (char === ',' && !inQuotes) {
			result.push(current.trim());
			current = '';
		} else {
			current += char;
		}
	}

	result.push(current.trim());
	return result;
}

/**
 * Discovers spaces from a dynamic CSV data source
 *
 * @param dataUrl - URL to fetch CSV data from
 * @returns Formatted discover results
 */
export async function discoverSpaces(dataUrl: string): Promise<ToolResult> {
	try {
		const response = await fetch(dataUrl);

		if (!response.ok) {
			return {
				formatted: DISCOVER_PROMPTS.FETCH_ERROR(dataUrl, `HTTP ${response.status}`),
				totalResults: 0,
				resultsShared: 0,
				isError: true,
			};
		}

		const csvText = await response.text();
		const lines = csvText.trim().split('\n').filter(line => line.trim());

		if (lines.length === 0) {
			return {
				formatted: DISCOVER_PROMPTS.NO_DATA,
				totalResults: 0,
				resultsShared: 0,
			};
		}

		// Parse CSV and format as markdown table
		let markdown = DISCOVER_PROMPTS.RESULTS_HEADER;

		// Table header
		markdown += '| Space | Category | Description | Space ID |\n';
		markdown += '|-------|----------|-------------|----------|\n';

		// Parse each line and format as table row
		for (const line of lines) {
			const [spaceId, category, description] = parseCSVLine(line);

			if (!spaceId) continue;

			const spaceName = spaceId.split('/').pop() || spaceId;

			markdown +=
				`| [${escapeMarkdown(spaceName)}](https://hf.co/spaces/${spaceId}) ` +
				`| ${escapeMarkdown(category || '-')} ` +
				`| ${escapeMarkdown(description || 'No description')} ` +
				`| \`${escapeMarkdown(spaceId)}\` |\n`;
		}

		return {
			formatted: markdown,
			totalResults: lines.length,
			resultsShared: lines.length,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return {
			formatted: DISCOVER_PROMPTS.FETCH_ERROR(dataUrl, errorMessage),
			totalResults: 0,
			resultsShared: 0,
			isError: true,
		};
	}
}
