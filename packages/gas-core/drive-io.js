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

function deleteFile(fileId) {
  try {
    DriveApp.getFileById(fileId).setTrashed(true)
    return { success: true }
  } catch(e) {
    return { success: true }
  }
}

function getFileUrl(fileId) {
  return DriveApp.getFileById(fileId).getUrl()
}
