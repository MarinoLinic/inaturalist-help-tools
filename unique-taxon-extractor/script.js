document.addEventListener('DOMContentLoaded', () => {
	// --- Element Selection ---
	const csvFileInput = document.getElementById('csvFileInput')
	const rankSelectionSection = document.getElementById('rankSelectionSection')
	const rankCheckboxesDiv = document.getElementById('rankCheckboxes')
	const extractButton = document.getElementById('extractButton')
	const outputLogPre = document.getElementById('outputLog')
	const outputLogSection = document.getElementById('outputLogSection')
	const downloadSection = document.getElementById('downloadSection')
	const downloadLinksContainer = document.getElementById('downloadLinksContainer')
	const fileNameDisplay = document.getElementById('fileNameDisplay')
	const currentYearAppSpan = document.getElementById('currentYearApp')

	// --- State Variables ---
	let parsedData = null
	let headers = []
	const taxonColumnPattern = /^taxon_.*_name$/i
	let RANK_TO_COLUMN_MAPPING = {}

	// --- Initial Setup ---
	if (currentYearAppSpan) {
		currentYearAppSpan.textContent = new Date().getFullYear()
	}

	// --- Helper Functions ---
	function logMessage(message, type = 'info') {
		if (outputLogPre) {
			const timestamp = new Date().toLocaleTimeString()
			const prefix = type.toUpperCase()
			const logEntry = document.createElement('div')
			logEntry.className = `log-entry log-${type}`
			logEntry.textContent = `[${timestamp} ${prefix}]: ${message}`
			outputLogPre.appendChild(logEntry)
			// Auto-scroll the log container itself
			outputLogPre.scrollTop = outputLogPre.scrollHeight
		}
		if (type === 'error') console.error(message)
		else console.log(message)
	}

	function scrollToElement(element) {
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'start' })
		}
	}

	function scrollToPageBottom() {
		window.scrollTo({
			top: document.body.scrollHeight,
			behavior: 'smooth',
		})
	}

	function clearPreviousRun(isNewFile = false) {
		if (isNewFile) {
			if (outputLogPre) outputLogPre.innerHTML = '' // Clear log for new file
		}
		if (rankCheckboxesDiv) rankCheckboxesDiv.innerHTML = ''
		if (rankSelectionSection) rankSelectionSection.style.display = 'none'
		if (downloadLinksContainer) downloadLinksContainer.innerHTML = ''
		if (downloadSection) downloadSection.style.display = 'none'
		if (extractButton) extractButton.disabled = true
		if (isNewFile && fileNameDisplay) fileNameDisplay.textContent = 'No file selected'

		parsedData = null
		headers = []
		RANK_TO_COLUMN_MAPPING = {}
	}

	// --- Event Listeners ---
	if (csvFileInput) {
		csvFileInput.addEventListener('change', (event) => {
			clearPreviousRun(true)

			const file = event.target.files[0]
			if (file) {
				if (fileNameDisplay) fileNameDisplay.textContent = file.name
				if (outputLogSection) outputLogSection.style.display = 'block'
				logMessage(`Selected file: ${file.name}`)

				Papa.parse(file, {
					header: true,
					skipEmptyLines: true,
					dynamicTyping: false,
					complete: (results) => {
						if (results.errors.length > 0) {
							logMessage('Error parsing CSV:', 'error')
							results.errors.forEach((err) => logMessage(`- ${err.message}`, 'error'))
							// No alert here, relies on logMessage
							if (fileNameDisplay) fileNameDisplay.textContent = 'Error parsing file.'
							return
						}
						parsedData = results.data
						headers = results.meta.fields || (parsedData.length > 0 ? Object.keys(parsedData[0]) : [])

						if (headers.length === 0) {
							logMessage('Could not determine headers from CSV. Ensure the first row contains headers.', 'error')
							return
						}

						logMessage('CSV parsed successfully.')
						populateRankSelection()
						if (extractButton && Object.keys(RANK_TO_COLUMN_MAPPING).length > 0) {
							extractButton.disabled = false
						}
						if (rankSelectionSection && Object.keys(RANK_TO_COLUMN_MAPPING).length > 0) {
							rankSelectionSection.style.display = 'block'
						} else if (Object.keys(RANK_TO_COLUMN_MAPPING).length === 0) {
							logMessage('No valid taxonomic rank columns found in the CSV.', 'warning')
						}
					},
					error: (error) => {
						logMessage(`Error during CSV parsing: ${error.message}`, 'error')
						if (fileNameDisplay) fileNameDisplay.textContent = 'Error parsing file.'
					},
				})
			} else {
				clearPreviousRun(true)
			}
		})
	} else {
		console.error('CSV File Input element not found!')
	}

	function populateRankSelection() {
		if (!rankCheckboxesDiv || !headers) return

		rankCheckboxesDiv.innerHTML = ''
		RANK_TO_COLUMN_MAPPING = {}

		headers.forEach((header) => {
			if (taxonColumnPattern.test(header)) {
				let friendlyName = header.replace(/^taxon_|_name$/gi, '')
				if (friendlyName.includes('_')) {
					friendlyName = friendlyName.replace(/_/g, '')
				}
				RANK_TO_COLUMN_MAPPING[friendlyName] = header
				const checkboxContainer = document.createElement('div')
				const checkbox = document.createElement('input')
				checkbox.type = 'checkbox'
				checkbox.id = `rank_${friendlyName}`
				checkbox.value = friendlyName
				checkbox.name = 'taxonomic_rank'
				const label = document.createElement('label')
				label.htmlFor = `rank_${friendlyName}`
				label.textContent = friendlyName.charAt(0).toUpperCase() + friendlyName.slice(1)
				checkboxContainer.appendChild(checkbox)
				checkboxContainer.appendChild(label)
				rankCheckboxesDiv.appendChild(checkboxContainer)
			}
		})

		if (Object.keys(RANK_TO_COLUMN_MAPPING).length === 0) {
			logMessage("No columns matching the pattern 'taxon_*_name' found in the CSV headers.", 'warning')
			if (rankSelectionSection) rankSelectionSection.style.display = 'none'
			if (extractButton) extractButton.disabled = true
		} else {
			logMessage(`Found ${Object.keys(RANK_TO_COLUMN_MAPPING).length} potential taxonomic rank columns.`)
			if (rankSelectionSection) rankSelectionSection.style.display = 'block'
		}
	}

	if (extractButton) {
		extractButton.addEventListener('click', () => {
			if (!parsedData || parsedData.length === 0) {
				logMessage('No data loaded to extract from. Please select a file.', 'error')
				// alert('Please select a CSV file first.'); // Removed
				return
			}

			const selectedRankCheckboxes = document.querySelectorAll('input[name="taxonomic_rank"]:checked')
			if (selectedRankCheckboxes.length === 0) {
				logMessage('No taxonomic ranks selected for extraction.', 'error')
				// alert('Please select at least one taxonomic rank.'); // Removed
				return
			}

			if (downloadLinksContainer) downloadLinksContainer.innerHTML = ''
			if (downloadSection) downloadSection.style.display = 'block'
			logMessage('\n--- Starting Extraction Process ---')

			let successfullyExtractedCount = 0

			selectedRankCheckboxes.forEach((checkbox) => {
				const friendlyRankName = checkbox.value
				const actualColumnName = RANK_TO_COLUMN_MAPPING[friendlyRankName]

				if (!actualColumnName) {
					logMessage(`Could not find original column name for rank '${friendlyRankName}'. Skipping.`, 'error')
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
					logMessage(`Extracted ${sortedValues.length} unique '${friendlyRankName}' values.`)
					successfullyExtractedCount++
				} else {
					logMessage(`No unique non-empty values found for rank '${friendlyRankName}'. File not created.`, 'info')
				}
			})

			const finalMessage = `--- Extraction Complete: Successfully created files for ${successfullyExtractedCount} rank(s). ---`
			logMessage(finalMessage)

			if (successfullyExtractedCount === 0 && selectedRankCheckboxes.length > 0) {
				logMessage(
					'Extraction finished, but no data was found for the selected ranks or no files could be generated.',
					'warning'
				)
			} else if (successfullyExtractedCount > 0) {
				logMessage(`Download section updated. ${successfullyExtractedCount} file(s) are ready.`, 'info')
			}

			// Scroll to the download section or page bottom
			if (downloadSection && downloadSection.style.display === 'block') {
				scrollToElement(downloadSection)
			} else {
				scrollToPageBottom()
			}
		})
	} else {
		console.error('Extract Button element not found!')
	}

	function generateCsvContent(headerName, valuesArray) {
		let csvString = `${headerName}\n`
		valuesArray.forEach((value) => {
			let processedValue = String(value)
			if (processedValue.includes(',') || processedValue.includes('\n') || processedValue.includes('"')) {
				processedValue = `"${processedValue.replace(/"/g, '""')}"`
			}
			csvString += `${processedValue}\n`
		})
		return csvString
	}

	function createDownloadLink(rankName, csvContent) {
		if (!downloadLinksContainer) return

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
		const url = URL.createObjectURL(blob)
		const link = document.createElement('a')
		link.href = url
		link.download = `${rankName}.csv`
		link.textContent = `Download ${rankName}.csv`
		link.className = 'download-link'

		const listItem = document.createElement('div')
		listItem.appendChild(link)
		downloadLinksContainer.appendChild(listItem)
	}
})
