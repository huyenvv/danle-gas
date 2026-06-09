// ===== Drive helpers =====

function getOrCreateFolder(parentId, folderName) {
  var parent = DriveApp.getFolderById(parentId)
  var iter = parent.getFoldersByName(folderName)
  if (iter.hasNext()) return iter.next()
  return parent.createFolder(folderName)
}

// Navigate ROOT_FOLDER_ID through folderPath (array of subfolder names,
// e.g. ['Category', '2025']), creating folders as needed. Returns folder ID string.
function resolveFolderId(folderPath) {
  var rootFolderId = getConfig('ROOT_FOLDER_ID')
  if (!rootFolderId) throw new Error('Chưa cấu hình thư mục Drive. Vào Cài đặt để thiết lập.')
  var parentId = rootFolderId
  if (folderPath && folderPath.length > 0) {
    for (var i = 0; i < folderPath.length; i++) {
      var folder = getOrCreateFolder(parentId, folderPath[i])
      parentId = folder.getId()
    }
  }
  return parentId
}

function uploadFile(base64Data, mimeType, fileName, folderPath) {
  var targetFolder = DriveApp.getFolderById(resolveFolderId(folderPath))

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

// Start a Drive API v3 resumable upload session. The client uploads chunks
// directly to the returned uploadUri (bypassing google.script.run's ~50MB limit).
// accessToken authorizes the client's PUT requests — the user's short-lived
// OAuth token, scoped by appsscript.json.
function initResumableUpload(mimeType, fileName, fileSize, folderId) {
  var accessToken = ScriptApp.getOAuthToken()
  var url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true'
  var metadata = { name: fileName, parents: [folderId] }
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'X-Upload-Content-Type': mimeType || 'application/octet-stream',
      'X-Upload-Content-Length': String(fileSize),
    },
    payload: JSON.stringify(metadata),
    muteHttpExceptions: true,
  })
  var code = resp.getResponseCode()
  if (code !== 200 && code !== 201) {
    throw new Error('Không khởi tạo được phiên tải lên (HTTP ' + code + ')')
  }
  var headers = resp.getAllHeaders()
  var uploadUri = headers['Location'] || headers['location']
  if (!uploadUri) throw new Error('Drive không trả về địa chỉ tải lên')
  return { uploadUri: uploadUri, accessToken: accessToken }
}

// Query a resumable session's status to get the created file id. Run server-side
// (UrlFetchApp, no CORS) AFTER the client has uploaded all chunks — the browser
// often cannot read the final cross-origin response, so the client never gets the
// id. PUT with 'Content-Range: bytes *​/<total>' and empty body:
//   200/201 → upload complete, body is the file resource → return id
//   308     → not all bytes received yet → throw (incomplete)
function getResumableFileId(uploadUri, totalSize) {
  var accessToken = ScriptApp.getOAuthToken()
  var resp = UrlFetchApp.fetch(uploadUri, {
    method: 'put',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Range': 'bytes */' + totalSize,
    },
    muteHttpExceptions: true,
  })
  var code = resp.getResponseCode()
  if (code === 200 || code === 201) {
    var data = JSON.parse(resp.getContentText())
    if (!data.id) throw new Error('Drive không trả về file id')
    return data.id
  }
  throw new Error('Tải lên chưa hoàn tất (HTTP ' + code + ')')
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
