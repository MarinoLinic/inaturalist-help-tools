document.addEventListener('DOMContentLoaded', () => {
	const csvFileInput = document.getElementById('csvFileInput')
	const rankSelectionSection = document.getElementById('rankSelectionSection')
	const rankCheckboxesDiv = document.getElementById('rankCheckboxes')
	const extractButton = document.getElementById('extractButton')
	const outputLog = document.getElementById('outputLog')
	const downloadSection = document.getElementById('downloadSection')
	const downloadLinksDiv = document.getElementById('downloadLinks')

	let parsedData = null
	let headers = []
	const taxonColumnPattern = /^taxon_.*_name$/i // To identify taxonomic columns

	// Maps user-friendly rank names to actual column names in the CSV (derived from headers)
	// This will be populated based on the uploaded CSV
	let RANK_TO_COLUMN_MAPPING = {}

	function logMessage(message) {
		outputLog.textContent += message + '\n'
		console.log(message) // Also log to browser console
	}

	function clearPreviousRun() {
		rankCheckboxesDiv.innerHTML = ''
		rankSelectionSection.style.display = 'none'
		downloadLinksDiv.innerHTML = ''
		downloadSection.style.display = 'none'
		outputLog.textContent = ''
		extractButton.disabled = true
		parsedData = null
		headers = []
		RANK_TO_COLUMN_MAPPING = {}
	}

	csvFileInput.addEventListener('change', (event) => {
		clearPreviousRun()
		const file = event.target.files[0]
		if (file) {
			logMessage(`Selected file: ${file.name}`)
			Papa.parse(file, {
				header: true, // Treat the first row as headers
				skipEmptyLines: true,
				dynamicTyping: false, // Keep all as strings initially
				complete: (results) => {
					if (results.errors.length > 0) {
						logMessage('ERROR parsing CSV:')
						results.errors.forEach((err) => logMessage(`- ${err.message}`))
						sg.popup_error('Error parsing CSV. Check console or log for details.')
						return
					}
					parsedData = results.data
					headers = results.meta.fields || (parsedData.length > 0 ? Object.keys(parsedData[0]) : [])

					if (headers.length === 0) {
						logMessage('ERROR: Could not determine headers from CSV.')
						return
					}

					logMessage('CSV parsed successfully.')
					populateRankSelection()
					extractButton.disabled = false
					rankSelectionSection.style.display = 'block'
				},
				error: (error) => {
					logMessage(`ERROR during CSV parsing: ${error.message}`)
				},
			})
		}
	})

	function populateRankSelection() {
		rankCheckboxesDiv.innerHTML = '' // Clear previous
		RANK_TO_COLUMN_MAPPING = {} // Reset

		headers.forEach((header) => {
			if (taxonColumnPattern.test(header)) {
				// Extract a user-friendly name (e.g., "taxon_genus_name" -> "genus")
				let friendlyName = header.replace(/^taxon_|_name$/gi, '')
				if (friendlyName.includes('_')) {
					// e.g. subphylum -> subphylum
					friendlyName = friendlyName.replace(/_/g, '')
				}

				RANK_TO_COLUMN_MAPPING[friendlyName] = header

				const checkboxContainer = document.createElement('div')
				const checkbox = document.createElement('input')
				checkbox.type = 'checkbox'
				checkbox.id = `rank_${friendlyName}`
				checkbox.value = friendlyName // User-friendly name
				checkbox.name = 'taxonomic_rank'

				const label = document.createElement('label')
				label.htmlFor = `rank_${friendlyName}`
				label.textContent = friendlyName.charAt(0).toUpperCase() + friendlyName.slice(1) // Capitalize

				checkboxContainer.appendChild(checkbox)
				checkboxContainer.appendChild(label)
				rankCheckboxesDiv.appendChild(checkboxContainer)
			}
		})
		if (Object.keys(RANK_TO_COLUMN_MAPPING).length === 0) {
			logMessage("WARNING: No columns matching the pattern 'taxon_*_name' found in the CSV headers.")
		} else {
			logMessage(`Found ${Object.keys(RANK_TO_COLUMN_MAPPING).length} potential taxonomic rank columns.`)
		}
	}

	extractButton.addEventListener('click', () => {
		if (!parsedData || parsedData.length === 0) {
			logMessage('ERROR: No data loaded to extract from.')
			alert('Please select a CSV file first.')
			return
		}

		const selectedRankCheckboxes = document.querySelectorAll('input[name="taxonomic_rank"]:checked')
		if (selectedRankCheckboxes.length === 0) {
			logMessage('ERROR: No taxonomic ranks selected for extraction.')
			alert('Please select at least one taxonomic rank.')
			return
		}

		downloadLinksDiv.innerHTML = '' // Clear previous download links
		downloadSection.style.display = 'block'
		logMessage('\n--- Starting Extraction Process ---')

		let successfullyExtractedCount = 0

		selectedRankCheckboxes.forEach((checkbox) => {
			const friendlyRankName = checkbox.value
			const actualColumnName = RANK_TO_COLUMN_MAPPING[friendlyRankName]

			if (!actualColumnName) {
				logMessage(`ERROR: Could not find original column name for rank '${friendlyRankName}'. Skipping.`)
				return
			}

			const uniqueValues = new Set()
			parsedData.forEach((row) => {
				const value = row[actualColumnName]
				if (value !== undefined && value !== null && String(value).trim() !== '') {
					uniqueValues.add(String(value).trim())
				}
			})

			if (uniqueValues.size > 0) {
				const sortedValues = Array.from(uniqueValues).sort()
				const csvContent = generateCsvContent(friendlyRankName, sortedValues)
				createDownloadLink(friendlyRankName, csvContent)
				logMessage(`SUCCESS: Extracted ${sortedValues.length} unique '${friendlyRankName}' values.`)
				successfullyExtractedCount++
			} else {
				logMessage(`INFO: No unique non-empty values found for rank '${friendlyRankName}'. File not created.`)
			}
		})

		logMessage(`--- Extraction Complete: Successfully created files for ${successfullyExtractedCount} rank(s). ---`)
		if (successfullyExtractedCount === 0 && selectedRankCheckboxes.length > 0) {
			alert('Extraction finished, but no data was found for the selected ranks or no files could be generated.')
		} else if (successfullyExtractedCount > 0) {
			console.log(`Extraction finished! ${successfullyExtractedCount} file(s) are ready for download.`)
		}
	})

	function generateCsvContent(headerName, valuesArray) {
		let csvString = `${headerName}\n` // Header row
		valuesArray.forEach((value) => {
			// Basic CSV escaping: if value contains comma, newline, or double quote, enclose in double quotes
			// and double up existing double quotes.
			let processedValue = String(value)
			if (processedValue.includes(',') || processedValue.includes('\n') || processedValue.includes('"')) {
				processedValue = `"${processedValue.replace(/"/g, '""')}"`
			}
			csvString += `${processedValue}\n`
		})
		return csvString
	}

	function createDownloadLink(rankName, csvContent) {
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
		const url = URL.createObjectURL(blob)
		const link = document.createElement('a')
		link.setAttribute('href', url)
		link.setAttribute('download', `${rankName}.csv`)
		link.textContent = `Download ${rankName}.csv`
		link.className = 'download-link' // For styling

		const p = document.createElement('p')
		p.appendChild(link)
		downloadLinksDiv.appendChild(p)
	}
})
