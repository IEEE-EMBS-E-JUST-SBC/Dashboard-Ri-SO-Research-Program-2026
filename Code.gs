const SPREADSHEET_ID = '1AMkHfFLSpTDY8JvrMbJrkzA628rFbpAyXFvWTjQI1UU';

// ── Password hashing (SHA-256) ───────────────────────────────────────
function hashPassword(plain) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    plain,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

// ── Entry points ─────────────────────────────────────────────────────
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

// ── Main handler ─────────────────────────────────────────────────────
function handleRequest(e) {
  try {
    let params;
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else {
      params = e.parameter;
    }

    const { action, sheet } = params;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // ── LOGIN ────────────────────────────────────────────────────────
    if (action === 'login') {
      const email    = params.email;
      const password = params.password;
      if (!email || !password)
        return jsonResponse({ status: 'error', message: 'Email and password required' });

      const ws = ss.getSheetByName('Users');
      if (!ws) return jsonResponse({ status: 'error', message: 'Users sheet not found' });

      const lastRow = ws.getLastRow();
      const lastCol = ws.getLastColumn();
      if (lastRow < 2) return jsonResponse({ status: 'error', message: 'No users found' });

      const allData  = ws.getRange(1, 1, lastRow, lastCol).getValues();
      const headers  = allData[0];
      const emailIdx = headers.indexOf('email');
      const pwdIdx   = headers.indexOf('password');

      if (emailIdx === -1 || pwdIdx === -1)
        return jsonResponse({ status: 'error', message: 'Users sheet missing email or password column' });

      const hashedInput = hashPassword(password.trim());

      for (let i = 1; i < allData.length; i++) {
        const rowEmail = String(allData[i][emailIdx]).trim().toLowerCase();
        const rowPwd   = String(allData[i][pwdIdx]).trim();
        if (rowEmail === email.trim().toLowerCase() && rowPwd === hashedInput) {
          const user = {};
          headers.forEach((h, j) => { if (h) user[h] = allData[i][j]; });
          delete user.password;
          return jsonResponse({ status: 'ok', user });
        }
      }
      return jsonResponse({ status: 'error', message: 'Invalid email or password' });
    }

    // ── UPLOAD PHOTO → Google Drive ──────────────────────────────────
    if (action === 'uploadPhoto') {
      const b64    = params.imageBase64;   // data:image/jpeg;base64,....
      const email  = params.email || 'unknown';
      if (!b64) return jsonResponse({ status: 'error', message: 'imageBase64 required' });

      const mimeMatch = b64.match(/^data:([^;]+);base64,/);
      const mimeType  = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const pureB64   = b64.replace(/^data:[^;]+;base64,/, '');
      const bytes     = Utilities.base64Decode(pureB64);
      const blob      = Utilities.newBlob(bytes, mimeType, `profile_${email.replace(/[^a-z0-9]/gi,'_')}.jpg`);

      // Save into a "RiSo2026 Profile Photos" folder (create if needed)
      let folder;
      const folderName = 'RiSo2026 Profile Photos';
      const folders = DriveApp.getFoldersByName(folderName);
      folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

      // Remove old photo for this email if exists
      const existing = folder.getFilesByName(blob.getName());
      while (existing.hasNext()) existing.next().setTrashed(true);

      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      const fileId  = file.getId();
      const viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
      const imgUrl  = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;

      return jsonResponse({ status: 'ok', fileId, viewUrl, imgUrl });
    }

    // ── GET — fetch all rows from a sheet ────────────────────────────
    if (action === 'get') {
      if (!sheet) return jsonResponse({ status: 'error', message: 'No sheet specified' });

      let ws = ss.getSheetByName(sheet);
      if (!ws) {
        ws = ss.insertSheet(sheet);
        return jsonResponse({ status: 'ok', data: [] });
      }

      const lastRow = ws.getLastRow();
      const lastCol = ws.getLastColumn();
      if (lastRow < 1 || lastCol < 1) return jsonResponse({ status: 'ok', data: [] });

      const data = ws.getRange(1, 1, lastRow, lastCol).getValues();
      if (data.length < 2) return jsonResponse({ status: 'ok', data: [] });

      const headers = data[0];
      const rows = data.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
        return obj;
      }).filter(row => Object.values(row).some(v => v !== ''));

      return jsonResponse({ status: 'ok', data: rows });
    }

    // ── All other actions need a sheet name ──────────────────────────
    if (!sheet) return jsonResponse({ status: 'error', message: 'No sheet specified' });
    let ws = ss.getSheetByName(sheet);
    if (!ws) ws = ss.insertSheet(sheet);

    // ── PUSH — append a row with auto-column creation ────────────────
    if (action === 'push') {
      const rowData = params.data;

      if (rowData.password && rowData.password.length < 64) {
        rowData.password = hashPassword(rowData.password);
      }

      const lastRow = ws.getLastRow();
      const lastCol = ws.getLastColumn();

      if (lastRow === 0 || lastCol === 0) {
        const keys = Object.keys(rowData);
        ws.getRange(1, 1, 1, keys.length).setValues([keys]);
        ws.getRange(2, 1, 1, keys.length).setValues([keys.map(k => rowData[k] ?? '')]);
      } else {
        let headers = ws.getRange(1, 1, 1, lastCol).getValues()[0];
        const missing = Object.keys(rowData).filter(k => headers.indexOf(k) === -1);
        if (missing.length) {
          headers = [...headers, ...missing];
          ws.getRange(1, 1, 1, headers.length).setValues([headers]);
        }
        ws.appendRow(headers.map(h => rowData[h] !== undefined ? rowData[h] : ''));
      }
      return jsonResponse({ status: 'ok', message: 'Row added to ' + sheet });
    }

    // ── UPDATE — edit existing row by id ─────────────────────────────
    if (action === 'update') {
      const rowId      = params.rowId;
      const updateData = params.data;

      if (updateData && updateData.password && updateData.password.length < 64) {
        updateData.password = hashPassword(updateData.password);
      }

      const lastRow = ws.getLastRow();
      const lastCol = ws.getLastColumn();
      if (lastRow < 2) return jsonResponse({ status: 'error', message: 'No rows to update' });

      const allData = ws.getRange(1, 1, lastRow, lastCol).getValues();
      let headers   = allData[0];
      const idCol   = headers.findIndex(h => h.toString().toLowerCase() === 'id');
      if (idCol === -1) return jsonResponse({ status: 'error', message: 'No id column found' });

      const missing = Object.keys(updateData || {}).filter(k => headers.findIndex(h => h === k) === -1);
      if (missing.length) {
        headers = [...headers, ...missing];
        ws.getRange(1, 1, 1, headers.length).setValues([headers]);
      }

      for (let i = 1; i < allData.length; i++) {
        if (String(allData[i][idCol]).trim() === String(rowId).trim()) {
          Object.keys(updateData).forEach(key => {
            const col = headers.findIndex(h => h === key);
            if (col > -1) ws.getRange(i + 1, col + 1).setValue(updateData[key]);
          });
          return jsonResponse({ status: 'ok', message: 'Row updated' });
        }
      }
      return jsonResponse({ status: 'error', message: 'Row not found for id: ' + rowId });
    }

    // ── UPDATE BY MATCH ───────────────────────────────────────────────
    if (action === 'updateByMatch') {
      const matchCol   = params.matchCol;
      const matchVal   = params.matchVal;
      const updateData = params.data;

      if (updateData && updateData.password && updateData.password.length < 64) {
        updateData.password = hashPassword(updateData.password);
      }

      if (!matchCol) return jsonResponse({ status: 'error', message: 'matchCol is required' });

      const lastRow = ws.getLastRow();
      const lastCol = ws.getLastColumn();
      if (lastRow < 2 || lastCol < 1)
        return jsonResponse({ status: 'error', message: 'No data in sheet' });

      const allData  = ws.getRange(1, 1, lastRow, lastCol).getValues();
      let headers    = allData[0];
      const matchIdx = headers.indexOf(matchCol);
      if (matchIdx === -1)
        return jsonResponse({ status: 'error', message: 'Match column not found: ' + matchCol });

      const missing = Object.keys(updateData || {}).filter(k => headers.indexOf(k) === -1);
      if (missing.length) {
        headers = [...headers, ...missing];
        ws.getRange(1, 1, 1, headers.length).setValues([headers]);
      }

      for (let i = 1; i < allData.length; i++) {
        if (String(allData[i][matchIdx]).trim().toLowerCase() === String(matchVal).trim().toLowerCase()) {
          Object.keys(updateData || {}).forEach(key => {
            const col = headers.indexOf(key);
            if (col > -1) ws.getRange(i + 1, col + 1).setValue(updateData[key]);
          });
          return jsonResponse({ status: 'ok', matched: true, message: 'Row updated by match' });
        }
      }
      return jsonResponse({ status: 'error', matched: false, message: 'No matching row for ' + matchCol + '=' + matchVal });
    }

    // ── DELETE — remove row by id ─────────────────────────────────────
    if (action === 'delete') {
      const rowId   = params.rowId;
      const lastRow = ws.getLastRow();
      const lastCol = ws.getLastColumn();
      const allData = ws.getRange(1, 1, lastRow, lastCol).getValues();
      const headers = allData[0];
      const idCol   = headers.findIndex(h => h.toString().toLowerCase() === 'id');

      for (let i = 1; i < allData.length; i++) {
        if (String(allData[i][idCol]) === String(rowId)) {
          ws.deleteRow(i + 1);
          return jsonResponse({ status: 'ok', message: 'Row deleted' });
        }
      }
      return jsonResponse({ status: 'error', message: 'Row not found' });
    }

    // ── GET BY TEAM ───────────────────────────────────────────────────
    if (action === 'getByTeam') {
      const teamId = params.teamId;
      if (!teamId) return jsonResponse({ status: 'error', message: 'teamId required' });

      const lastRow = ws.getLastRow();
      const lastCol = ws.getLastColumn();
      if (lastRow < 2) return jsonResponse({ status: 'ok', data: [] });

      const all     = ws.getRange(1, 1, lastRow, lastCol).getValues();
      const headers = all[0];
      const tidx    = headers.indexOf('teamId');
      if (tidx === -1) return jsonResponse({ status: 'ok', data: [] });

      const rows = all.slice(1)
        .filter(r => String(r[tidx]).trim().toUpperCase() === String(teamId).trim().toUpperCase())
        .map(r => { const o = {}; headers.forEach((h, i) => { if (h) o[h] = r[i]; }); return o; });

      return jsonResponse({ status: 'ok', data: rows });
    }

    // ── VOTE FOR MEETING SLOT ─────────────────────────────────────────
    if (action === 'voteSlot') {
      const { meetingId, teamId, voterEmail, slot } = params;
      if (!meetingId || !voterEmail || !slot)
        return jsonResponse({ status: 'error', message: 'meetingId, voterEmail, slot required' });

      let ws2 = ss.getSheetByName('MeetingVotes');
      if (!ws2) ws2 = ss.insertSheet('MeetingVotes');

      if (ws2.getLastRow() < 1) {
        ws2.getRange(1, 1, 1, 6).setValues([['id', 'meetingId', 'teamId', 'voterEmail', 'slot', 'votedAt']]);
      }

      const all     = ws2.getRange(1, 1, Math.max(ws2.getLastRow(), 1), 6).getValues();
      const headers = all[0];
      const midx    = headers.indexOf('meetingId');
      const eidx    = headers.indexOf('voterEmail');

      for (let i = 1; i < all.length; i++) {
        if (String(all[i][midx]) === String(meetingId) &&
            String(all[i][eidx]).toLowerCase() === voterEmail.toLowerCase()) {
          ws2.getRange(i + 1, headers.indexOf('slot') + 1).setValue(slot);
          ws2.getRange(i + 1, headers.indexOf('votedAt') + 1).setValue(new Date().toISOString());
          return jsonResponse({ status: 'ok', message: 'Vote updated' });
        }
      }
      ws2.appendRow([`V${Date.now()}`, meetingId, teamId, voterEmail, slot, new Date().toISOString()]);
      return jsonResponse({ status: 'ok', message: 'Vote recorded' });
    }

    // ── GRADE TASK ────────────────────────────────────────────────────
    if (action === 'gradeTask') {
      const { taskId, score, feedback, status: newStatus } = params;
      if (!taskId) return jsonResponse({ status: 'error', message: 'taskId required' });

      const lastRow = ws.getLastRow();
      const lastCol = ws.getLastColumn();
      if (lastRow < 2) return jsonResponse({ status: 'error', message: 'No rows' });

      const all     = ws.getRange(1, 1, lastRow, lastCol).getValues();
      const headers = all[0];
      const idIdx   = headers.indexOf('id');

      for (let i = 1; i < all.length; i++) {
        if (String(all[i][idIdx]) === String(taskId)) {
          if (score !== undefined)     ws.getRange(i + 1, headers.indexOf('score') + 1).setValue(score);
          if (feedback !== undefined)  ws.getRange(i + 1, headers.indexOf('feedback') + 1).setValue(feedback);
          if (newStatus !== undefined) ws.getRange(i + 1, headers.indexOf('status') + 1).setValue(newStatus);
          return jsonResponse({ status: 'ok', message: 'Task graded' });
        }
      }
      return jsonResponse({ status: 'error', message: 'Task not found' });
    }

    return jsonResponse({ status: 'error', message: 'Unknown action: ' + action });

  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ── JSON response helper ─────────────────────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
