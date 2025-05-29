document.addEventListener('DOMContentLoaded', () => {
	// --- Element Selection (remains the same) ---
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
	let RANK_TO_COLUMN_MAPPING = {} // friendlyName: actualColumnName

	// --- Hierarchy for Counting Lower Ranks (REVISED based on your specific list) ---
	const HIERARCHY_MAP = {
		kingdom: 'phylum',
		phylum: 'class',
		class: 'order',
		order: 'family',
		family: 'genus',
		genus: 'species',
		species: 'subspecies',
		subspecies: null, // No lower rank in the specified list to count
	}

	// --- Initial Setup (remains the same) ---
	if (currentYearAppSpan) {
		currentYearAppSpan.textContent = new Date().getFullYear()
	}

	// --- Helper Functions (logMessage, scrollToElement, scrollToPageBottom, clearPreviousRun remain the same) ---
	function logMessage(message, type = 'info') {
		if (outputLogPre) {
			const timestamp = new Date().toLocaleTimeString()
			const prefix = type.toUpperCase()
			const logEntry = document.createElement('div')
			logEntry.className = `log-entry log-${type}`
			logEntry.textContent = `[${timestamp} ${prefix}]: ${message}`
			outputLogPre.appendChild(logEntry)
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
			if (outputLogPre) outputLogPre.innerHTML = ''
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

	// --- Event Listeners (csvFileInput event listener remains largely the same) ---
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

	// --- populateRankSelection (offers all taxon_*_name columns found) ---
	function populateRankSelection() {
		if (!rankCheckboxesDiv || !headers) return
		rankCheckboxesDiv.innerHTML = ''
		RANK_TO_COLUMN_MAPPING = {}
		const availableRanksForSelection = new Set()
		headers.forEach((header) => {
			if (taxonColumnPattern.test(header)) {
				let friendlyName = header.replace(/^taxon_|_name$/gi, '')
				if (friendlyName.includes('_')) {
					friendlyName = friendlyName.replace(/_/g, '')
				}
				RANK_TO_COLUMN_MAPPING[friendlyName] = header
				availableRanksForSelection.add(friendlyName)
			}
		})

		availableRanksForSelection.forEach((friendlyName) => {
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
		})

		if (availableRanksForSelection.size === 0) {
			logMessage("No columns matching the pattern 'taxon_*_name' found in the CSV headers.", 'warning')
			if (rankSelectionSection) rankSelectionSection.style.display = 'none'
			if (extractButton) extractButton.disabled = true
		} else {
			logMessage(`Found ${availableRanksForSelection.size} potential taxonomic rank columns for selection.`)
			if (rankSelectionSection) rankSelectionSection.style.display = 'block'
		}
	}

	// --- MODIFIED extractButton Event Listener ---
	if (extractButton) {
		extractButton.addEventListener('click', () => {
			if (!parsedData || parsedData.length === 0) {
				logMessage('No data loaded to extract from. Please select a file.', 'error')
				return
			}
			const selectedRankCheckboxes = document.querySelectorAll('input[name="taxonomic_rank"]:checked')
			if (selectedRankCheckboxes.length === 0) {
				logMessage('No taxonomic ranks selected for extraction.', 'error')
				return
			}

			if (downloadLinksContainer) downloadLinksContainer.innerHTML = ''
			if (downloadSection) downloadSection.style.display = 'block'
			logMessage('\n--- Starting Extraction Process ---')
			let successfullyExtractedCount = 0

			selectedRankCheckboxes.forEach((checkbox) => {
				const currentRankFriendlyName = checkbox.value
				const currentRankActualColumn = RANK_TO_COLUMN_MAPPING[currentRankFriendlyName]

				if (!currentRankActualColumn) {
					logMessage(
						`Could not find original column name for selected rank '${currentRankFriendlyName}'. Skipping.`,
						'error'
					)
					return
				}

				const nextLowerRankFriendlyName = HIERARCHY_MAP[currentRankFriendlyName]
				const nextLowerRankActualColumn = nextLowerRankFriendlyName
					? RANK_TO_COLUMN_MAPPING[nextLowerRankFriendlyName]
					: null

				if (nextLowerRankFriendlyName && !nextLowerRankActualColumn) {
					logMessage(
						`The next lower rank '${nextLowerRankFriendlyName}' for '${currentRankFriendlyName}' was not found as a column in your CSV. Its count will be 0.`,
						'warning'
					)
				}

				// Map: rankValue -> { lowerRankSet: Set<string>, observationCount: number }
				const rankDataWithCounts = new Map()

				parsedData.forEach((row) => {
					const currentRankValue = row[currentRankActualColumn]
					if (currentRankValue !== undefined && currentRankValue !== null && String(currentRankValue).trim() !== '') {
						const trimmedCurrentRankValue = String(currentRankValue).trim()

						if (!rankDataWithCounts.has(trimmedCurrentRankValue)) {
							rankDataWithCounts.set(trimmedCurrentRankValue, {
								lowerRankSet: new Set(),
								observationCount: 0,
							})
						}
						const currentEntry = rankDataWithCounts.get(trimmedCurrentRankValue)
						currentEntry.observationCount++ // Increment observation count

						if (nextLowerRankActualColumn) {
							const lowerRankValue = row[nextLowerRankActualColumn]
							if (lowerRankValue !== undefined && lowerRankValue !== null && String(lowerRankValue).trim() !== '') {
								currentEntry.lowerRankSet.add(String(lowerRankValue).trim())
							}
						}
					}
				})

				if (rankDataWithCounts.size > 0) {
					const csvDataRows = []
					// data is { lowerRankSet, observationCount }
					rankDataWithCounts.forEach((data, rankValue) => {
						csvDataRows.push([
							rankValue,
							data.observationCount, // Add observation count here
							nextLowerRankActualColumn ? data.lowerRankSet.size : 0,
						])
					})

					csvDataRows.sort((a, b) => String(a[0]).localeCompare(String(b[0])))

					const countColumnHeader = nextLowerRankFriendlyName ? `${nextLowerRankFriendlyName}_count` : 'items_count'
					const csvContent = generateCsvWithCounts(currentRankFriendlyName, countColumnHeader, csvDataRows)
					createDownloadLink(currentRankFriendlyName, csvContent)
					logMessage(
						`Extracted ${csvDataRows.length} unique '${currentRankFriendlyName}' values with counts and observation numbers.`
					)
					successfullyExtractedCount++
				} else {
					logMessage(
						`No unique non-empty values found for rank '${currentRankFriendlyName}'. File not created.`,
						'info'
					)
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
			if (downloadSection && downloadSection.style.display === 'block') {
				scrollToElement(downloadSection)
			} else {
				scrollToPageBottom()
			}
		})
	} else {
		console.error('Extract Button element not found!')
	}

	// --- MODIFIED generateCsvWithCounts ---
	function generateCsvWithCounts(rankHeader, countHeader, dataRowsArray) {
		// dataRowsArray elements are now [rankValue, lowerRankCount, observationCount]
		let csvString = `${rankHeader},num_observations,${countHeader}\n` // Added num_observations header
		dataRowsArray.forEach((row) => {
			let processedRankValue = String(row[0])
			if (processedRankValue.includes(',') || processedRankValue.includes('\n') || processedRankValue.includes('"')) {
				processedRankValue = `"${processedRankValue.replace(/"/g, '""')}"`
			}
			// row[1] is lowerRankCount, row[2] is observationCount
			csvString += `${processedRankValue},${row[1]},${row[2]}\n`
		})
		return csvString
	}

	// --- createDownloadLink (remains the same) ---
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
