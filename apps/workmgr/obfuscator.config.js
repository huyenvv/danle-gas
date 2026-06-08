module.exports = {
  compact: true,
  // Variable renaming — the only reliable obfuscation for GAS V8 + Vietnamese
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  // EVERYTHING else disabled — GAS V8 runtime is incompatible with:
  // - stringArray (encoding corrupts Vietnamese Unicode)
  // - splitStrings (breaks Vietnamese property keys)
  // - transformObjectKeys (breaks d['Phụ trách'])
  // - controlFlowFlattening (creates indirect property chains that fail)
  // - deadCodeInjection (injected code crashes on GAS V8)
  // - selfDefending (strict mode conflicts)
  stringArray: false,
  splitStrings: false,
  transformObjectKeys: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  selfDefending: false,
  unicodeEscapeSequence: false,
  // Preserve GAS entry points
  reservedNames: ['^api_', '^doGet$'],
}
