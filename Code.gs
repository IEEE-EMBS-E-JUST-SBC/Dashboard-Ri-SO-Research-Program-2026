const SPREADSHEET_ID = '1AMkHfFLSpTDY8JvrMbJrkzA628rFbpAyXFvWTjQI1UU';

function doGet(e) {
  try {
    const sheet = e.parameter.sheet;
    if (!sheet) return jsonResponse({ status: 'error', message: 'No sheet specified' });
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let ws = ss.getSheetByName(sheet);
    if (!ws) { ws = ss.insertSheet(sheet); return jsonResponse({ status: 'ok', data: [] }); }
    const lastRow = ws.getLastRow();
    const lastCol = ws.getLastColumn();
    if (lastRow < 1 || lastCol < 1) return jsonResponse({ status: 'ok', data: [] });
    const data = ws.getRange(1, 1, lastRow, lastCol).getValues();
    if (data.length < 2) return jsonResponse({ status: 'ok', data: [] });
    const headers = data[0];
    const rows = data.slice(1)
      .map(row => { const obj = {}; headers.forEach((h,i) => { if(h) obj[h]=row[i]; }); return obj; })
      .filter(row => Object.values(row).some(v => v !== ''));
    return jsonResponse({ status: 'ok', data: rows });
  } catch(err) { return jsonResponse({ status: 'error', message: err.toString() }); }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { action, sheet } = body;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // LOGIN
    if (action === 'login') {
      const { email, password } = body;
      if (!email || !password) return jsonResponse({ status:'error', message:'Email and password required' });
      const ws = ss.getSheetByName('Users');
      if (!ws) return jsonResponse({ status:'error', message:'Users sheet not found' });
      const lastRow = ws.getLastRow();
      const lastCol = ws.getLastColumn();
      if (lastRow < 2) return jsonResponse({ status:'error', message:'No users found' });
      const allData = ws.getRange(1,1,lastRow,lastCol).getValues();
      const headers = allData[0];
      const emailIdx = headers.indexOf('email');
      const pwdIdx = headers.indexOf('password');
      if (emailIdx === -1 || pwdIdx === -1)
        return jsonResponse({ status:'error', message:'Users sheet missing email or password column' });
      for (let i = 1; i < allData.length; i++) {
        if (String(allData[i][emailIdx]).trim().toLowerCase() === email.trim().toLowerCase()
            && String(allData[i][pwdIdx]).trim() === password.trim()) {
          const user = {};
          headers.forEach((h,j) => { if(h) user[h] = allData[i][j]; });
          delete user.password;
          return jsonResponse({ status:'ok', user });
        }
      }
      return jsonResponse({ status:'error', message:'Invalid email or password' });
    }

    if (!sheet) return jsonResponse({ status:'error', message:'No sheet specified' });
    let ws = ss.getSheetByName(sheet);
    if (!ws) ws = ss.insertSheet(sheet);

    // PUSH — append row, auto-creates missing columns
    if (action === 'push') {
      const rowData = body.data;
      const lastRow = ws.getLastRow();
      const lastCol = ws.getLastColumn();
      if (lastRow === 0 || lastCol === 0) {
        const keys = Object.keys(rowData);
        ws.getRange(1,1,1,keys.length).setValues([keys]);
        ws.getRange(2,1,1,keys.length).setValues([keys.map(k => rowData[k] ?? '')]);
      } else {
        let headers = ws.getRange(1,1,1,lastCol).getValues()[0];
        const missing = Object.keys(rowData).filter(k => headers.indexOf(k)===-1);
        if (missing.length) { headers=[...headers,...missing]; ws.getRange(1,1,1,headers.length).setValues([headers]); }
        ws.appendRow(headers.map(h => rowData[h]!==undefined ? rowData[h] : ''));
      }
      return jsonResponse({ status:'ok', message:'Row added to '+sheet });
    }

    // UPDATE — by id column, auto-creates missing columns
    if (action === 'update') {
      const { rowId, data: updateData } = body;
      const lastRow = ws.getLastRow();
      const lastCol = ws.getLastColumn();
      if (lastRow < 2) return jsonResponse({ status:'error', message:'No rows to update' });
      const allData = ws.getRange(1,1,lastRow,lastCol).getValues();
      let headers = allData[0];
      const idCol = headers.indexOf('id');
      if (idCol===-1) return jsonResponse({ status:'error', message:'No id column found' });
      const missing = Object.keys(updateData||{}).filter(k=>headers.indexOf(k)===-1);
      if (missing.length) { headers=[...headers,...missing]; ws.getRange(1,1,1,headers.length).setValues([headers]); }
      for (let i=1; i<allData.length; i++) {
        if (String(allData[i][idCol])===String(rowId)) {
          Object.keys(updateData).forEach(key => {
            const col = headers.indexOf(key);
            if (col>-1) ws.getRange(i+1,col+1).setValue(updateData[key]);
          });
          return jsonResponse({ status:'ok', message:'Row updated' });
        }
      }
      return jsonResponse({ status:'error', message:'Row not found' });
    }

    // UPDATE BY MATCH — find row by any column, auto-creates new reviewer columns
    // This is how admin decisions are stored: matches Email, creates "Nada Decision" etc.
    if (action === 'updateByMatch') {
      const { matchCol, matchVal, data: updateData } = body;
      if (!matchCol) return jsonResponse({ status:'error', message:'matchCol required' });
      const lastRow = ws.getLastRow();
      const lastCol = ws.getLastColumn();
      if (lastRow<2||lastCol<1) return jsonResponse({ status:'error', message:'No data in sheet' });
      const allData = ws.getRange(1,1,lastRow,lastCol).getValues();
      let headers = allData[0];
      const matchIdx = headers.indexOf(matchCol);
      if (matchIdx===-1) return jsonResponse({ status:'error', message:'Match column not found: '+matchCol });
      // Auto-create new columns (e.g. "Nada Decision", "Nada Score" on first use)
      const missing = Object.keys(updateData||{}).filter(k=>headers.indexOf(k)===-1);
      if (missing.length) { headers=[...headers,...missing]; ws.getRange(1,1,1,headers.length).setValues([headers]); }
      for (let i=1; i<allData.length; i++) {
        if (String(allData[i][matchIdx]).trim().toLowerCase()===String(matchVal).trim().toLowerCase()) {
          Object.keys(updateData||{}).forEach(key => {
            const col=headers.indexOf(key);
            if (col>-1) ws.getRange(i+1,col+1).setValue(updateData[key]);
          });
          return jsonResponse({ status:'ok', matched:true, message:'Row updated by match' });
        }
      }
      return jsonResponse({ status:'error', matched:false, message:'No matching row for '+matchCol+'='+matchVal });
    }

    // DELETE
    if (action === 'delete') {
      const { rowId } = body;
      const lastRow = ws.getLastRow();
      const lastCol = ws.getLastColumn();
      const allData = ws.getRange(1,1,lastRow,lastCol).getValues();
      const headers = allData[0];
      const idCol = headers.indexOf('id');
      for (let i=1; i<allData.length; i++) {
        if (String(allData[i][idCol])===String(rowId)) {
          ws.deleteRow(i+1);
          return jsonResponse({ status:'ok', message:'Row deleted' });
        }
      }
      return jsonResponse({ status:'error', message:'Row not found' });
    }

    return jsonResponse({ status:'error', message:'Unknown action: '+action });
  } catch(err) { return jsonResponse({ status:'error', message:err.toString() }); }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
