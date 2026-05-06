/**
 * ============================================
 * QUẢN LÝ DỰ ÁN - Sheetkhoinghiep.com
 * Main Entry Point
 * ============================================
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Quản Lý Dự Án - Sheetkhoinghiep.com')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
