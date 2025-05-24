document.addEventListener('DOMContentLoaded', () => {
	// --- Element Selection ---
	// It's good to check if these elements exist to prevent errors if HTML changes
	const csvFileInput = document.getElementById('csvFileInput')
	const rankSelectionSection = document.getElementById('rankSelectionSection')
	const rankCheckboxesDiv = document.getElementById('rankCheckboxes')
	const extractButton = document.getElementById('extractButton')
	const outputLogPre = document.getElementById('outputLog') // Target the <pre> tag
	const outputLogSection = document.getElementById('outputLogSection') // Target the whole section
	const downloadSection = document.getElementById('downloadSection')
	const downloadLinksContainer = document.getElementById('downloadLinksContainer') // Corrected ID
	const fileNameDisplay = document.getElementById('fileNameDisplay') // For showing the selected file name
	const currentYearAppSpan = document.getElementById('currentYearApp') // For the year in footer

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
			outputLogPre.textContent += `[${timestamp} ${prefix}]: ${message}\n`
			outputLogPre.scrollTop = outputLogPre.scrollHeight // Auto-scroll
		}
		if (type === 'error') {
			console.error(message)
		} else {
			console.log(message)
		}
	}

	function clearPreviousRun() {
		if (rankCheckboxesDiv) rankCheckboxesDiv.innerHTML = ''
		if (rankSelectionSection) rankSelectionSection.style.display = 'none'
		if (downloadLinksContainer) downloadLinksContainer.innerHTML = ''
		if (downloadSection) downloadSection.style.display = 'none'
		// Do not clear the log completely on each new file, append instead or provide a clear button
		// if (outputLogPre) outputLogPre.textContent = '';
		if (extractButton) extractButton.disabled = true
		if (fileNameDisplay) fileNameDisplay.textContent = 'No file selected'

		parsedData = null
		headers = []
		RANK_TO_COLUMN_MAPPING = {}
	}

	// --- Event Listeners ---
	if (csvFileInput) {
		csvFileInput.addEventListener('change', (event) => {
			// Don't clear the log entirely here, just prepare for new processing
			// clearPreviousRun(); // This clears too much if user just re-selects
			// Reset parts relevant to a new file
			if (rankCheckboxesDiv) rankCheckboxesDiv.innerHTML = ''
			if (rankSelectionSection) rankSelectionSection.style.display = 'none'
			if (downloadLinksContainer) downloadLinksContainer.innerHTML = ''
			if (downloadSection) downloadSection.style.display = 'none'
			if (extractButton) extractButton.disabled = true
			parsedData = null
			headers = []
			RANK_TO_COLUMN_MAPPING = {}

			const file = event.target.files[0]
			if (file) {
				if (fileNameDisplay) fileNameDisplay.textContent = file.name
				if (outputLogSection) outputLogSection.style.display = 'block' // Show log section
				logMessage(`Selected file: ${file.name}`)

				Papa.parse(file, {
					header: true,
					skipEmptyLines: true,
					dynamicTyping: false,
					complete: (results) => {
						if (results.errors.length > 0) {
							logMessage('Error parsing CSV:', 'error')
							results.errors.forEach((err) => logMessage(`- ${err.message}`, 'error'))
							alert('Error parsing CSV. Check console or log for details.')
							if (fileNameDisplay) fileNameDisplay.textContent = 'Error parsing file.'
							return
						}
						parsedData = results.data
						headers = results.meta.fields || (parsedData.length > 0 ? Object.keys(parsedData[0]) : [])

						if (headers.length === 0) {
							logMessage('Could not determine headers from CSV. Ensure the first row contains headers.', 'error')
							alert('Could not determine headers from CSV. Please check your file.')
							return
						}

						logMessage('CSV parsed successfully.')
						populateRankSelection()
						if (extractButton && Object.keys(RANK_TO_COLUMN_MAPPING).length > 0) {
							extractButton.disabled = false // Enable only if ranks are found
						}
						if (rankSelectionSection && Object.keys(RANK_TO_COLUMN_MAPPING).length > 0) {
							rankSelectionSection.style.display = 'block'
						}
					},
					error: (error) => {
						logMessage(`Error during CSV parsing: ${error.message}`, 'error')
						alert(`Error during CSV parsing: ${error.message}`)
						if (fileNameDisplay) fileNameDisplay.textContent = 'Error parsing file.'
					},
				})
			} else {
				// If no file is selected (e.g., user cancels file dialog)
				clearPreviousRun() // Or a more specific reset
			}
		})
	} else {
		console.error('CSV File Input element not found!')
	}

	function populateRankSelection() {
		if (!rankCheckboxesDiv || !headers) return

		rankCheckboxesDiv.innerHTML = '' // Clear previous
		RANK_TO_COLUMN_MAPPING = {} // Reset

		headers.forEach((header) => {
			if (taxonColumnPattern.test(header)) {
				let friendlyName = header.replace(/^taxon_|_name$/gi, '')
				if (friendlyName.includes('_')) {
					friendlyName = friendlyName.replace(/_/g, '')
				}

				RANK_TO_COLUMN_MAPPING[friendlyName] = header

				const checkboxContainer = document.createElement('div') // Each checkbox in its own div
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
			if (rankSelectionSection) rankSelectionSection.style.display = 'none' // Hide if no ranks
			if (extractButton) extractButton.disabled = true
		} else {
			logMessage(`Found ${Object.keys(RANK_TO_COLUMN_MAPPING).length} potential taxonomic rank columns.`)
			if (rankSelectionSection) rankSelectionSection.style.display = 'block'
			// Extract button will be enabled by the file input's complete callback
		}
	}

	if (extractButton) {
		extractButton.addEventListener('click', () => {
			if (!parsedData || parsedData.length === 0) {
				logMessage('No data loaded to extract from. Please select a file.', 'error')
				alert('Please select a CSV file first.')
				return
			}

			const selectedRankCheckboxes = document.querySelectorAll('input[name="taxonomic_rank"]:checked')
			if (selectedRankCheckboxes.length === 0) {
				logMessage('No taxonomic ranks selected for extraction.', 'error')
				alert('Please select at least one taxonomic rank.')
				return
			}

			if (downloadLinksContainer) downloadLinksContainer.innerHTML = '' // Clear previous links
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
					const value = row[actualColumnName] // PapaParse with header:true gives direct property access
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

			logMessage(`--- Extraction Complete: Successfully created files for ${successfullyExtractedCount} rank(s). ---`)
			if (successfullyExtractedCount === 0 && selectedRankCheckboxes.length > 0) {
				alert('Extraction finished, but no data was found for the selected ranks or no files could be generated.')
			} else if (successfullyExtractedCount > 0) {
				console.log(`Extraction finished! ${successfullyExtractedCount} file(s) are ready for download.`)
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
		link.className = 'download-link' // Ensure this class is applied for styling

		// Optionally, wrap in a p or div for better spacing if needed by CSS
		const listItem = document.createElement('div') // Or 'p'
		listItem.appendChild(link)
		downloadLinksContainer.appendChild(listItem)
	}
})
