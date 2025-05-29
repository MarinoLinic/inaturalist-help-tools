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

	// New Element Selectors for action buttons and containers
	const rankSelectionActions = document.getElementById('rankSelectionActions')
	const selectAllRanksButton = document.getElementById('selectAllRanksButton')
	const deselectAllRanksButton = document.getElementById('deselectAllRanksButton')
	const downloadAllActionContainer = document.getElementById('downloadAllActionContainer')
	const downloadAllButton = document.getElementById('downloadAllButton')

	// --- State Variables ---
	let parsedData = null
	let headers = []
	const taxonColumnPattern = /^taxon_.*_name$/i
	let RANK_TO_COLUMN_MAPPING = {} // friendlyName: actualColumnName

	// --- Hierarchy for Counting Lower Ranks ---
	const HIERARCHY_MAP = {
		kingdom: 'phylum',
		phylum: 'class',
		class: 'order',
		order: 'family',
		family: 'genus',
		genus: 'species',
		species: 'subspecies',
		subspecies: null,
	}

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

		// Hide new action containers
		if (rankSelectionActions) rankSelectionActions.style.display = 'none'
		if (downloadAllActionContainer) downloadAllActionContainer.style.display = 'none'

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
						// rankSelectionSection display is handled in populateRankSelection
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
			if (rankSelectionActions) rankSelectionActions.style.display = 'none' // Hide actions if no ranks
			if (extractButton) extractButton.disabled = true
		} else {
			logMessage(`Found ${availableRanksForSelection.size} potential taxonomic rank columns for selection.`)
			if (rankSelectionSection) rankSelectionSection.style.display = 'block'
			if (rankSelectionActions) rankSelectionActions.style.display = 'flex' // Show actions if ranks exist
			// extractButton enabling is handled after PapaParse completes
		}
	}

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

			if (downloadLinksContainer) downloadLinksContainer.innerHTML = '' // Clear previous links
			if (downloadAllActionContainer) downloadAllActionContainer.style.display = 'none' // Hide download all btn initially
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
						currentEntry.observationCount++
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
					rankDataWithCounts.forEach((data, rankValue) => {
						csvDataRows.push([rankValue, data.observationCount, nextLowerRankActualColumn ? data.lowerRankSet.size : 0])
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
				if (downloadAllActionContainer) downloadAllActionContainer.style.display = 'block' // Show Download All button
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

	// Event listeners for new Select/Deselect All buttons
	if (selectAllRanksButton) {
		selectAllRanksButton.addEventListener('click', () => {
			const checkboxes = rankCheckboxesDiv.querySelectorAll('input[name="taxonomic_rank"]')
			checkboxes.forEach((checkbox) => (checkbox.checked = true))
			logMessage('All available ranks selected.')
		})
	}

	if (deselectAllRanksButton) {
		deselectAllRanksButton.addEventListener('click', () => {
			const checkboxes = rankCheckboxesDiv.querySelectorAll('input[name="taxonomic_rank"]')
			checkboxes.forEach((checkbox) => (checkbox.checked = false))
			logMessage('All available ranks deselected.')
		})
	}

	// Event listener for new Download All button
	if (downloadAllButton) {
		downloadAllButton.addEventListener('click', () => {
			const links = downloadLinksContainer.querySelectorAll('a.download-link')
			if (links.length > 0) {
				logMessage(
					`Attempting to download ${links.length} file(s). Your browser might ask for permission for multiple downloads.`,
					'info'
				)
				links.forEach((link, index) => {
					// Small delay can sometimes help with browser pop-up blockers for multiple downloads,
					// but often not strictly needed for user-initiated sequence.
					// setTimeout(() => { link.click(); }, index * 100);
					link.click()
				})
			} else {
				logMessage('No files available to download with "Download All".', 'warning')
			}
		})
	}

	function generateCsvWithCounts(rankHeader, countHeader, dataRowsArray) {
		let csvString = `${rankHeader},num_observations,${countHeader}\n`
		dataRowsArray.forEach((row) => {
			let processedRankValue = String(row[0])
			if (processedRankValue.includes(',') || processedRankValue.includes('\n') || processedRankValue.includes('"')) {
				processedRankValue = `"${processedRankValue.replace(/"/g, '""')}"`
			}
			csvString += `${processedRankValue},${row[1]},${row[2]}\n`
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
		link.className = 'download-link' // This class is used by .btn-app styles and download all
		const listItem = document.createElement('div') // Each link in its own div for grid layout
		listItem.appendChild(link)
		downloadLinksContainer.appendChild(listItem)
	}
})
