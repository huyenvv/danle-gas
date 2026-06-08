// ===== Drive helpers =====

function getOrCreateFolder(parentId, folderName) {
  var parent = DriveApp.getFolderById(parentId)
  var iter = parent.getFoldersByName(folderName)
  if (iter.hasNext()) return iter.next()
  return parent.createFolder(folderName)
}

function uploadFile(base64Data, mimeType, fileName, folderPath) {
  var rootFolderId = getConfig('ROOT_FOLDER_ID')
  if (!rootFolderId) throw new Error('Chưa cấu hình thư mục Drive. Vào Cài đặt để thiết lập.')

  // folderPath is an array of subfolder names, e.g. ['Category', '2025']
  var targetFolder = null
  if (folderPath && folderPath.length > 0) {
    var parentId = rootFolderId
    for (var i = 0; i < folderPath.length; i++) {
      var folder = getOrCreateFolder(parentId, folderPath[i])
      parentId = folder.getId()
    }
    targetFolder = DriveApp.getFolderById(parentId)
  } else {
    targetFolder = DriveApp.getFolderById(rootFolderId)
  }

  var bytes = Utilities.base64Decode(base64Data)
  var blob = Utilities.newBlob(bytes, mimeType, fileName)
  var file = targetFolder.createFile(blob)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)

  return {
    fileId: file.getId(),
    fileName: fileName,
    mimeType: mimeType,
    size: blob.getBytes().length,
    url: file.getUrl(),
  }
}

/**
 * Rename the Drive folder at the end of folderPath.
 * Navigates from ROOT_FOLDER_ID through each segment; renames the last one.
 * Silent no-op if ROOT_FOLDER_ID not configured or folder not found.
 */
function renameFolder(folderPath, newName) {
  var rootFolderId = getConfig('ROOT_FOLDER_ID')
  if (!rootFolderId || !folderPath || folderPath.length === 0) return
  var parentId = rootFolderId
  for (var i = 0; i < folderPath.length; i++) {
    var parent = DriveApp.getFolderById(parentId)
    var iter = parent.getFoldersByName(folderPath[i])
    if (!iter.hasNext()) return // folder not created yet — nothing to rename
    var folder = iter.next()
    if (i === folderPath.length - 1) {
      folder.setName(newName)
      return
    }
    parentId = folder.getId()
  }
}

/**
 * Move a file to the folder at newFolderPath (creating folders as needed).
 * Silent no-op if ROOT_FOLDER_ID not configured.
 */
function moveFile(fileId, newFolderPath) {
  var rootFolderId = getConfig('ROOT_FOLDER_ID')
  if (!rootFolderId || !fileId) return
  var parentId = rootFolderId
  for (var i = 0; i < newFolderPath.length; i++) {
    var folder = getOrCreateFolder(parentId, newFolderPath[i])
    parentId = folder.getId()
  }
  var file = DriveApp.getFileById(fileId)
  var targetFolder = DriveApp.getFolderById(parentId)
  file.moveTo(targetFolder)
}

function deleteFile(fileId) {
  try {
    DriveApp.getFileById(fileId).setTrashed(true)
    return { success: true }
  } catch(e) {
    return { success: false, error: e.message }
  }
}

function getFileUrl(fileId) {
  return DriveApp.getFileById(fileId).getUrl()
}
