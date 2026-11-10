import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function readAwardList() {
  // Use Python to read the XLSX
  const pythonCode = `
import openpyxl
import json

wb = openpyxl.load_workbook('data/260723-AwardWaitingList_2.xlsx')
ws = wb.active

# Find header row with "Application Number"
header_row_idx = None
for row_idx, row in enumerate(ws.iter_rows(values_only=True), 1):
    if row and row[0] and "Application Number" in str(row[0]):
        header_row_idx = row_idx
        break

result = []
for row_idx in range(header_row_idx + 1, ws.max_row + 1):
    cell = ws.cell(row_idx, 1).value
    if cell and isinstance(cell, (int, float)):
        app_number = int(cell)
        name = ws.cell(row_idx, 2).value
        city = ws.cell(row_idx, 4).value
        score = ws.cell(row_idx, 30).value
        status = ws.cell(row_idx, 33).value
        usda_year = ws.cell(row_idx, 31).value
        amenities_total = ws.cell(row_idx, 32).value

        result.append({
            'app_number': app_number,
            'name': name,
            'city': city,
            'score': float(score) if score else None,
            'status': status,
            'usda_year': int(usda_year) if usda_year and isinstance(usda_year, (int, float)) else None,
            'amenities_total': float(amenities_total) if amenities_total else None
        })

print(json.dumps(result))
`;

  try {
    const result = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf8',
      cwd: '/Users/uma/Documents/Apps/Projects/housing-count-charts/housing-count-charts/tx-tiebreak',
      maxBuffer: 10 * 1024 * 1024
    });
    return JSON.parse(result);
  } catch (err) {
    console.error('Python error:', err.message);
    throw err;
  }
}

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"/, '').replace(/"$/, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim().replace(/^"/, '').replace(/"$/, ''));
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim().replace(/^"/, '').replace(/"$/, ''));

    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

function readCMS() {
  const csvPath = 'data/applications-export-cms.csv';
  const content = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(content);

  const cmsMap = new Map();
  rows.forEach((row) => {
    const appNumber = parseInt(row.app_number, 10);
    if (!isNaN(appNumber)) {
      cmsMap.set(appNumber, {
        app_number: appNumber,
        development_name: row.development_name,
        competition_group_ref: row.competition_group_ref,
        competition_group_label: row.competition_group_label,
        final_score: row.final_score ? parseFloat(row.final_score) : null,
        award_status_label: row.award_status_label,
        url: row.url
      });
    }
  });

  return cmsMap;
}

function buildJSON() {
  console.log('Reading award list from Excel...');
  const awardList = readAwardList();
  console.log(`  Found ${awardList.length} applications`);

  console.log('Reading CMS export from CSV...');
  const cmsMap = readCMS();
  console.log(`  Loaded ${cmsMap.size} applications from CMS`);

  console.log('Merging data...');
  const result = awardList
    .filter((app) => app.amenities_total != null)
    .map((app) => {
      const cms = cmsMap.get(app.app_number);
      if (!cms) {
        console.warn(`  ⚠ App ${app.app_number} not found in CMS export, skipping`);
        return null;
      }

      // Extract slug from URL (last segment, without .pdf)
      let slug = null;
      if (cms.url) {
        slug = cms.url.split('/').pop().replace('.pdf', '');
      }

      return {
        app_number: app.app_number,
        name: app.name || cms.development_name,
        city: app.city,
        slug: slug,
        group: cms.competition_group_ref,
        group_label: cms.competition_group_label,
        score: cms.final_score,
        status: cms.award_status_label,
        amenity_total_ft: app.amenities_total,
        usda_year: app.usda_year
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.app_number - b.app_number);

  console.log(`✓ Merged ${result.length} applications`);

  // Write JSON
  const outputDir = 'public';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'tx9_tiebreak_2026.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');

  console.log(`✓ Written to ${outputPath}`);
  console.log(`  ${result.length} applications, full precision amenity totals`);

  return result;
}

try {
  buildJSON();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
