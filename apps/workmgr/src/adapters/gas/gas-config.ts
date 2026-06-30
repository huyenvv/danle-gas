// gas-config: Spreadsheet access helpers for GAS adapter.
// Ported from v1 src/server/core/config.js.
// Uses PropertiesService + SpreadsheetApp (GAS APIs) — intentional.

export function getCentralSheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const id = PropertiesService.getScriptProperties().getProperty('CENTRAL_SHEET_ID')
  return id
    ? SpreadsheetApp.openById(id)
    : SpreadsheetApp.getActiveSpreadsheet()
}

export function ensureSheet(
  sheetName: string,
  headers: string[],
): GoogleAppsScript.Spreadsheet.Sheet {
  const ss = getCentralSheet()
  let sheet = ss.getSheetByName(sheetName)
  if (!sheet) {
    sheet = ss.insertSheet(sheetName)
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
  }
  return sheet
}
