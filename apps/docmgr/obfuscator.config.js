module.exports = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.7,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.3,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  rotateStringArray: true,
  stringArray: true,
  stringArrayEncoding: ['rc4'],
  stringArrayThreshold: 0.75,
  unicodeEscapeSequence: false, // keep false — GAS editor may have issues with heavy unicode escaping
  selfDefending: true,
  transformObjectKeys: true,
  splitStrings: true,
  splitStringsChunkLength: 5,
  // Preserve all GAS-required global function names
  reservedNames: [
    'doGet',
    'api_login', 'api_logout', 'api_validateSession',
    'api_changePassword', 'api_adminResetPassword', 'api_lockUser', 'api_unlockUser',
    'api_getData', 'api_getDataWithVersion', 'api_checkVersion', 'api_getAllData',
    'api_addRow', 'api_updateRow', 'api_deleteRow', 'api_batchWrite', 'api_checkReferences',
    'api_getDocuments', 'api_createDocument', 'api_updateDocument', 'api_deleteDocument',
    'api_uploadFile', 'api_getSettings', 'api_updateSettings', 'api_getAppQR',
  ],
}
