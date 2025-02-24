// https://medium.com/@sakkeerhussainp/google-sheet-as-your-database-for-node-js-backend-a79fc5a6edd9
// https://console.cloud.google.com/

const {google} = require('googleapis');

exports.handler = function(event, context, callback) {
	const serviceAccountKeyFile = "./lambda-sheets-backend-c799dadbac6f.json";
	// const sheetId = '1QTF579Jt7SFprh2ITQ6SJLwKPBXsE9yS7QmoMlct4TU'
	const tabName = 'Locations'
	const range = 'A:E'

	main().then(() => {
		console.log('Completed')
	})

	async function main() {
		// Does the "airshot-locations" folder exist?
		const response = await _findOrCreateGoogleFolder()

		// Share the folder with the administrator(s).
		await _shareGoogleFolderWithAdmins(response)

		// Generating google sheet client
		const googleSheetClient = await _getGoogleSheetClient();

		// Create google sheet.
		const sheet = await _createGoogleSheet(googleSheetClient, response)

		// Reading Google Sheet from a specific range
		const data = await _readGoogleSheet(googleSheetClient, sheet?.id, tabName, range);
		// console.log(data)

		// Adding a new row to Google Sheet
		const dataToBeInserted = [
			 ['Rohith', 'Sharma', 'rohith@gmail.com'],
			 ['Virat', 'Kohli', 'virat@airshot.io']
		]
		// await _writeGoogleSheet(googleSheetClient, sheetId, tabName, range, dataToBeInserted);
		await _writeGoogleSheet(googleSheetClient, sheet?.id, tabName, range, dataToBeInserted);
	}

	async function _shareGoogleFolderWithAdmins(folder) {
		const auth = new google.auth.GoogleAuth({
			keyFile: serviceAccountKeyFile,
			scopes: [
				'https://www.googleapis.com/auth/drive.file'
			],
		});
		const drive = google.drive({ version: 'v3', auth });
		const permission = {
			'type': 'user',
			'role': 'writer', // 'reader', 'writer', 'commenter'
			'emailAddress': 'fluentycpt@gmail.com'
		};

		const response = await drive.permissions.create({
			auth,
			fileId: folder.id,
			resource: permission
		});
		// console.log(response)
	}

	async function _findOrCreateGoogleFolder() {
		const auth = new google.auth.GoogleAuth({
			keyFile: serviceAccountKeyFile,
			scopes: [
				'https://www.googleapis.com/auth/drive.file'
			],
		});
		const drive = google.drive({ version: 'v3', auth });
		const response = await drive.files.list({
			'q': 'name="airshot-locations" and mimeType="application/vnd.google-apps.folder"'
		});

		if (response.data.files.length === 0) {
			// Create the folder.
			const folder = await drive.files.create({
				requestBody: {
					name: 'airshot-locations', 
					mimeType: 'application/vnd.google-apps.folder'
				}
			});

			return folder.data
		}

		return response.data.files[0]
	}

	async function _createGoogleSheet(googleSheetClient, folder) {
		const auth = new google.auth.GoogleAuth({
			keyFile: serviceAccountKeyFile,
			scopes: [
				'https://www.googleapis.com/auth/spreadsheets',
				'https://www.googleapis.com/auth/drive.file'
			],
		});
		const drive = google.drive({ version: 'v3', auth });

		// Check if the file exists before trying to create it.
    const response = await drive.files.list({
      q: 'name = \'CapeTown\'',
      fields: 'nextPageToken, files(id, name)',
      spaces: 'drive',
    });

		// For development purposes only.
		if (response.data.files.length > 0) {
			for (const file of response.data.files) {
				await _deleteGoogleFile(file?.id);
			}
		}

		if (response.data.files.length === 0) {
			const sheet = await drive.files.create({
				requestBody: {
					name: 'CapeTown', 
					mimeType: 'application/vnd.google-apps.spreadsheet',
					parents: [folder.id]
				}
			});
			console.log('spreadsheet has been created...')
			// Create tabs (if not already exists).
			try {
				await googleSheetClient.spreadsheets.batchUpdate({
					spreadsheetId: sheet?.id,
					requestBody: {
						"requests": [
							{
								"addSheet": {
									"properties": {
										"title": "Locations"
									}
								}
							}
						]
					}
				})
			} catch (err) {
				console.error(err);
			}

			return sheet.data
		}

		return response.data.files[0]
	}

	async function _getGoogleSheetClient() {
		const auth = new google.auth.GoogleAuth({
			keyFile: serviceAccountKeyFile,
			scopes: ['https://www.googleapis.com/auth/spreadsheets'],
		});
		const authClient = await auth.getClient();
		return google.sheets({
			version: 'v4',
			auth: authClient,
		});
	}

	async function _readGoogleSheet(googleSheetClient, sheetId, tabName, range) {
		const res = await googleSheetClient.spreadsheets.values.get({
			spreadsheetId: sheetId,
			range: `${tabName}!${range}`,
		});

		return res.data.values;
	}

	// Delete files.
	async function _deleteGoogleFile(fileId) {
		const auth = new google.auth.GoogleAuth({
			keyFile: serviceAccountKeyFile,
			scopes: [
				'https://www.googleapis.com/auth/spreadsheets',
				'https://www.googleapis.com/auth/drive.file'
			],
		});
		const drive = google.drive({ version: 'v3', auth });

		await drive.files.delete({fileId: fileId})
	}

	// Create tabs.
	async function _writeGoogleSheet(googleSheetClient, sheetId, tabName, range, data) {
		// Add records.
		await googleSheetClient.spreadsheets.values.append({
			spreadsheetId: sheetId,
			range: `${tabName}!${range}`,
			valueInputOption: 'USER_ENTERED',
			insertDataOption: 'INSERT_ROWS',
			resource: {
				"majorDimension": "ROWS",
				"values": data
			},
		})
	}
};