/**
 * Wave Analytics Component
 * Extracted from wave-js.ftl
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

let canaryLenses = "";
function getCanaryLenses() {
    URL = "/component/casp/v1/getlenses/"+dataHost+"/?metadata_query=" + encodeURIComponent("type=" + "perfswat");
    showSpinner("spinner1");
    $.ajax({
        url: URL, 
        success: function (result) {
            if (result != undefined && Array.isArray(result)) {
                canaryLenses = result;
                
                // Parse each string element to get config objects
                const parsedLenses = [];
                result.forEach(lensString => {
                    try {
                        const lensData = JSON.parse(lensString);
                        if (lensData.config) {
                            // Parse the config string to get the actual lens configuration
                            const lensConfig = JSON.parse(lensData.config);
                            parsedLenses.push(lensConfig);
                        }
                    } catch (error) {
                        console.error('Error parsing lens data:', error, lensString);
                    }
                });
                
                // Update the wave analytics saved lenses
                if (window.waveAnalytics) {
                    window.waveAnalytics.savedLenses = parsedLenses;
                    window.waveAnalytics.updateLensDropdown();
                    console.log('Loaded', parsedLenses.length, 'lenses from backend');
                }
            }
            hideSpinner("spinner1");
        },
        error: function (xhr, status, error) {
            console.error('Failed to get lenses:', error);
            toastMessage(toastType.ERROR, "Failed to get lenses");
            hideSpinner("spinner1");
        }
    });
}

function saveLenseInBackend(lenseConfigString, timestamp) {
    // Create the data to send in the request body
    const requestData = {
        config: lenseConfigString, // Already a string
        source: dataHost,
        type: "perfswat",
        timestamp: timestamp
    };
    console.log('Saving lens config string:', lenseConfigString);
    console.log('Timestamp (epoch):', timestamp);

    // Make the AJAX request using jQuery
    $.ajax({
        url: "/component/casp/v1/savelense/"+dataHost,
        type: 'POST',
        contentType: 'application/json',  // Tells the server the request body will be in JSON format
        data: JSON.stringify(requestData),  // Convert the data object to a JSON string
        success: function (response) {
            console.log('Lense posted successfully:', response);
        },
        error: function (xhr, status, error) {
            console.error('Error posting lense:', error);
        }
    });
}

// Wave Analytics Lens Builder Component
class WaveAnalytics {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.parsedData = [];
        this.filteredData = [];
        this.currentFilters = {};
        this.isLoading = false;
        this.dimensions = [];
        this.metrics = [];
        this.selectedDimensions = [];
        this.selectedMetrics = [];
        this.metricAggregations = {}; // Store aggregation type for each metric
        this.timestampDimensions = []; // Track timestamp dimensions
        this.dateTimeFilters = {}; // Store date/time filters
        this.selectedFilters = []; // Store active filters
        this.sortedGroups = null; // Store sorted group order for table rendering
        this.columnTypes = {}; // Store detected column types for sorting
        this.filterOperators = [
            { value: 'between', label: '≤ x ≤' },
            { value: 'less than', label: '<' },
            { value: 'less than or equal', label: '≤' },
            { value: 'greater than', label: '>' },
            { value: 'greater than or equal', label: '≥' },
            { value: 'equal', label: '=' },
            { value: 'not equal', label: '≠' }
        ];
        this.chartType = 'bar';
        this.draggedElement = null;
        this.dragAndDropSetup = false; // Flag to prevent duplicate setup
        this.dropZoneCollapseSetup = false; // Flag to prevent duplicate drop zone collapse setup
        this.sortColumn = null; // Current sort column
        this.sortDirection = 'asc'; // Sort direction: 'asc' or 'desc'
        this.savedLenses = []; // Array to store saved lens configurations
        this.saveLensModalEventsSetup = false; // Flag to track if modal events are set up
        this.ignoredRows = new Set(); // Set to track ignored row indices
        this.dimensionFilters = {}; // Store dimension filters with selected values
        this.dataFetchFunction = null; // Store the data fetch function
        this.chartExpandedWidth = 0; // Track current expanded width
        console.log('DEBUG: WaveAnalytics constructor called, calling init()');
        this.init();
    }

    /**
     * Set the data fetch function
     * @param {Function} fetchFunction - Function to be used for data fetching
     */
    setDataFetchFunction(fetchFunction) {
        this.dataFetchFunction = fetchFunction;
    }


    /**
     * Expand chart width by adding current container width
     */
    expandChartWidth() {
        const lensChart = document.getElementById('lensChart');
        const lensDisplay = document.querySelector('.lens-display');
        const lensCanvas = document.querySelector('.lens-canvas');
        const multiplierInput = document.getElementById('widthMultiplier');
        
        if (!lensChart || !lensDisplay || !lensCanvas) {
            console.log('Required elements not found');
            return;
        }
        
        // Get multiplier value from input (default to 1 if not found)
        const multiplier = multiplierInput ? parseFloat(multiplierInput.value) || 1 : 1;
        
        // For first time click, always use multiplier as 1
        const actualMultiplier = this.chartExpandedWidth === 0 ? 1 : multiplier;
        
        // Get lens-display width as the base increment amount
        const lensDisplayRect = lensDisplay.getBoundingClientRect();
        const lensDisplayWidth = lensDisplayRect.width;
        const incrementWidth = lensDisplayWidth * actualMultiplier;
        
        console.log('Before expansion - chartExpandedWidth:', this.chartExpandedWidth, 'lensDisplayWidth:', lensDisplayWidth, 'selectedMultiplier:', multiplier, 'actualMultiplier:', actualMultiplier, 'incrementWidth:', incrementWidth);
        
        // Add increment width to expanded width
        this.chartExpandedWidth += incrementWidth;
        
        console.log('After expansion - chartExpandedWidth:', this.chartExpandedWidth);
        
        // Apply expanded width to lensChart container
        lensChart.style.width = this.chartExpandedWidth + 'px';
        lensChart.style.minWidth = this.chartExpandedWidth + 'px';
        
        // Add horizontal scrolling to lens-display
        lensDisplay.style.overflowX = 'auto';
        lensDisplay.style.overflowY = 'hidden';
        
        // Ensure lens-canvas doesn't expand by setting fixed width
        if (!lensCanvas.style.width) {
            const lensCanvasRect = lensCanvas.getBoundingClientRect();
            lensCanvas.style.width = lensCanvasRect.width - 2 + 'px';
            lensCanvas.style.flex = '0 0 auto'; // Don't grow or shrink
            return;
        }
        
        // Re-render chart with new width
        if (this.selectedDimensions.length > 0 || this.selectedMetrics.length > 0) {
            this.renderLensChart();
        }
        
        console.log('Lens chart expanded to width: ' + this.chartExpandedWidth + 'px (added: ' + incrementWidth + 'px)');
    }

    /**
     * Reduce chart width by removing lens-display width
     */
    reduceChartWidth() {
        const lensChart = document.getElementById('lensChart');
        const lensDisplay = document.querySelector('.lens-display');
        const lensCanvas = document.querySelector('.lens-canvas');
        const multiplierInput = document.getElementById('widthMultiplier');
        
        if (!lensChart || !lensDisplay || !lensCanvas) {
            console.log('Required elements not found');
            return;
        }
        
        // Get multiplier value from input (default to 1 if not found)
        const multiplier = multiplierInput ? parseFloat(multiplierInput.value) || 1 : 1;
        
        // Get lens-display width as the base reduction amount
        const lensDisplayRect = lensDisplay.getBoundingClientRect();
        const lensDisplayWidth = lensDisplayRect.width;
        const reduceWidth = lensDisplayWidth * multiplier;
        
        console.log('Before reduction - chartExpandedWidth:', this.chartExpandedWidth, 'lensDisplayWidth:', lensDisplayWidth, 'multiplier:', multiplier, 'reduceWidth:', reduceWidth);
        
        // Reduce expanded width
        this.chartExpandedWidth = Math.max(0, this.chartExpandedWidth - reduceWidth);
        
        console.log('After reduction - chartExpandedWidth:', this.chartExpandedWidth);
        
        if (this.chartExpandedWidth <= 0) {
            // Reset to default if fully reduced
            this.resetChartWidth();
            return;
        }
        
        // Apply reduced width to lensChart container
        lensChart.style.width = this.chartExpandedWidth + 'px';
        lensChart.style.minWidth = this.chartExpandedWidth + 'px';
        
        // Re-render chart with new width
        if (this.selectedDimensions.length > 0 || this.selectedMetrics.length > 0) {
            this.renderLensChart();
        }
        
        console.log('Lens chart reduced to width: ' + this.chartExpandedWidth + 'px (reduced by: ' + reduceWidth + 'px)');
    }


    /**
     * Reset chart width to default
     */
    resetChartWidth() {
        this.chartExpandedWidth = 0;
        const lensChart = document.getElementById('lensChart');
        const lensDisplay = document.querySelector('.lens-display');
        const lensCanvas = document.querySelector('.lens-canvas');
        
        if (lensChart) {
            lensChart.style.width = '';
            lensChart.style.minWidth = '';
        }
        
        if (lensDisplay) {
            lensDisplay.style.overflowX = '';
            lensDisplay.style.overflowY = '';
        }
        
        if (lensCanvas) {
            lensCanvas.style.width = '';
            lensCanvas.style.flex = '';
        }
        
        // Re-render chart with default width
        if (this.selectedDimensions.length > 0 || this.selectedMetrics.length > 0) {
            this.renderLensChart();
        }
        
        console.log('Chart width reset to default');
    }

    async init() {
        console.log('DEBUG: init() method called');
        this.showLoadingState();
        try {
            console.log('DEBUG: About to call loadData()');
            await this.loadData();
            console.log('DEBUG: loadData() completed, calling render()');
            this.render();
            console.log('DEBUG: render() completed, calling updateFiltersZone()');
            this.updateFiltersZone();
            console.log('DEBUG: updateFiltersZone() called in init()');
            this.removeExistingTimestampFilters();
            this.updateLensDropdown();
            
            // Initialize drop zone counts and field item icons
            setTimeout(() => {
                this.updateDropZoneCounts();
                this.updateFieldItemIcons();
                this.setupSearchInput();
            }, 100);
        } catch (error) {
            this.showErrorState(error);
        }
    }

    setupSearchInput() {
        console.log('DEBUG: setupSearchInput() called');
        const searchInput = document.getElementById('waveSearchInput');
        console.log('DEBUG: waveSearchInput element found:', !!searchInput);
        console.log('DEBUG: waveSearchInput element:', searchInput);
        console.log('DEBUG: waveSearchInput placeholder:', searchInput ? searchInput.placeholder : 'N/A');
        
        // Check if already has event listeners (prevent duplicates)
        if (searchInput && searchInput.hasAttribute('data-search-setup')) {
            console.log('DEBUG: Search input already has event listeners, skipping setup');
            return;
        }
        
        if (searchInput) {
            console.log('DEBUG: currentFilters.search:', this.currentFilters.search);
            // Set initial value if currentFilters.search exists
            if (this.currentFilters.search) {
                searchInput.value = this.currentFilters.search;
                console.log('DEBUG: Set search input value to:', this.currentFilters.search);
            }
            
            // Add event listener for search input - only apply on Enter key
            searchInput.addEventListener('keydown', (e) => {
                console.log('DEBUG: Search keydown event:', e.key);
                if (e.key === 'Enter') {
                    console.log('DEBUG: Search Enter pressed with value:', e.target.value);
                    this.currentFilters.search = e.target.value;
                    console.log('DEBUG: Calling applyFilters()');
                    this.applyFilters();
                    
                    // Visual feedback - applied state
                    searchInput.classList.remove('wave-search-pending');
                    searchInput.classList.add('wave-search-applied');
                    console.log('DEBUG: Applied visual state - classes:', searchInput.className);
                }
            });
            
            // Add event listener for input to show pending state
            searchInput.addEventListener('input', (e) => {
                console.log('DEBUG: Search input changed to:', e.target.value, '(not applied until Enter)');
                
                // Visual feedback - pending state
                if (e.target.value.trim() !== '') {
                    searchInput.classList.remove('wave-search-applied');
                    searchInput.classList.add('wave-search-pending');
                    console.log('DEBUG: Added pending state - classes:', searchInput.className);
                } else {
                    searchInput.classList.remove('wave-search-pending', 'wave-search-applied');
                    console.log('DEBUG: Removed visual states - classes:', searchInput.className);
                }
            });
            
            // Mark as setup to prevent duplicate event listeners
            searchInput.setAttribute('data-search-setup', 'true');
            console.log('DEBUG: Search input setup completed');
        } else {
            console.warn('DEBUG: Search input not found during setup');
            console.log('DEBUG: Available elements with id containing "search":');
            const searchElements = document.querySelectorAll('[id*="search"]');
            searchElements.forEach((el, index) => {
                console.log(`  Element ${index}: id="${el.id}", tagName="${el.tagName}"`);
            });
            
            // Try to find search input with a delay (in case DOM isn't ready)
            setTimeout(() => {
                const delayedSearchInput = document.getElementById('waveSearchInput');
                if (delayedSearchInput) {
                    console.log('DEBUG: Found waveSearchInput on retry');
                    this.setupSearchInput();
                } else {
                    console.warn('DEBUG: waveSearchInput still not found after retry');
                }
            }, 500);
        }
    }

    async loadData() {
        try {
            // For testing: use hardcoded CSV data instead of API call
            this.fetchCSVDataAndParse();
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    setCSVDataAsString(CSVData) {
        this.parseCSV(CSVData);
    }

    setParsedData(parsedData){
        this.parsedData = parsedData;
        this.analyzeDataStructure();
        this.filteredData = [...this.parsedData];
    }

    fetchCSVDataAndParse() {
        let CSVData = "";
        if(this.dataFetchFunction && typeof this.dataFetchFunction === 'function'){
            try{
                CSVData = this.dataFetchFunction();
                this.parseCSV(CSVData);
            }catch(e){
                console.log("Error in dataFetchFunction: " + e);
            }
        }else{
            console.log("skip data fetch, dataFetchFunction function not set");
        }
        return CSVData;
    }

    parseCSV(csvData) {
        const lines = csvData.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        this.parsedData = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, index) => {
                let value = values[index] || '';
                
                // Check for timestamp formats and convert to epoch
                if (this.isTimestampWithMs(value)) {
                    value = this.convertTimestampToEpoch(value);
                }
                else if (this.isTimestampFormat(value)) {
                    value = this.convertTimestampToEpochSimple(value);
                }
                else if (this.isTimestampFormatFull(value)) {
                    value = this.convertTimestampToEpochFull(value);
                }
                // Try to parse numeric values
                else if (!isNaN(value) && value !== '' && value !== '-1000000') {
                    value = this.safeParseFloat(value);
                    if (isNaN(value)) {
                        value = originalValue; // Keep original if not a valid number
                    }
                }
                row[header] = value;
            });
            return row;
        });
        
        // Analyze first 10 rows to determine dimensions vs metrics
        this.analyzeDataStructure();
        
        this.filteredData = [...this.parsedData];
    }

    /**
     * Check if a value matches the timestamp format "year:month:day Hr:min:sec ms"
     * Example: "2025-10-09 00:48:40 679"
     */
    isTimestampWithMs(value) {
        if (typeof value !== 'string') return false;
        
        // Regex pattern for "YYYY-MM-DD HH:mm:ss mmm" format
        const timestampPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \d{3}$/;
        return timestampPattern.test(value.trim());
    }

    /**
     * Convert timestamp string to epoch milliseconds
     * Input format: "2025-10-09 00:48:40 679"
     * Output: epoch timestamp in milliseconds
     */
    convertTimestampToEpoch(timestampStr) {
        try {
            // Parse the timestamp string
            const parts = timestampStr.trim().split(' ');
            if (parts.length !== 3) return null;
            
            const dateTime = parts[0] + ' ' + parts[1]; // "2025-10-09 00:48:40"
            const milliseconds = parseInt(parts[2]); // "679"
            
            // Create Date object and add milliseconds
            const date = new Date(dateTime);
            if (isNaN(date.getTime())) return null;
            
            // Add the milliseconds to get the exact timestamp
            const epochMs = date.getTime() + milliseconds;
            
            //console.log('Converted timestamp:', timestampStr, 'to epoch:', epochMs);
            return epochMs;
        } catch (error) {
            console.warn('Error converting timestamp to epoch:', error);
            return null;
        }
    }

    /**
     * Check if a value matches the timestamp format "year-month-day hr:min:sec"
     * Example: "25-09-29 22:09:00"
     */
    isTimestampFormat(value) {
        if (typeof value !== 'string') return false;
        
        // Regex pattern for "YY-MM-DD HH:mm:ss" format
        const timestampPattern = /^\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
        return timestampPattern.test(value.trim());
    }

    /**
     * Check if a value matches the timestamp format "year-month-day hr:min:sec"
     * Example: "2024-01-01 10:00:00"
     */
    isTimestampFormatFull(value) {
        if (typeof value !== 'string') return false;
        
        // Regex pattern for "YYYY-MM-DD HH:mm:ss" format
        const timestampPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
        return timestampPattern.test(value.trim());
    }

    /**
     * Convert full timestamp string to epoch milliseconds
     * Input format: "2024-01-01 10:00:00"
     * Output: epoch timestamp in milliseconds
     */
    convertTimestampToEpochFull(timestampStr) {
        try {
            // Parse the timestamp string directly
            const date = new Date(timestampStr);
            if (isNaN(date.getTime())) return null;
            
            const epochMs = date.getTime();
            
            console.log('Converted full timestamp:', timestampStr, 'to epoch:', epochMs);
            return epochMs;
        } catch (error) {
            console.warn('Error converting full timestamp to epoch:', error);
            return null;
        }
    }

    /**
     * Convert simple timestamp string to epoch milliseconds
     * Input format: "25-09-29 22:09:00"
     * Output: epoch timestamp in milliseconds
     */
    convertTimestampToEpochSimple(timestampStr) {
        try {
            // Parse the timestamp string
            const parts = timestampStr.trim().split(' ');
            if (parts.length !== 2) return null;
            
            const dateTime = parts[0] + ' ' + parts[1]; // "25-09-29 22:09:00"
            
            // Convert 2-digit year to 4-digit year
            const dateParts = parts[0].split('-');
            if (dateParts.length !== 3) return null;
            
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]);
            const day = parseInt(dateParts[2]);
            
            // Convert 2-digit year to 4-digit (assuming 20xx for years 00-99)
            const fullYear = year < 100 ? 2000 + year : year;
            
            // Create the full timestamp string
            const fullTimestamp = fullYear + '-' + month.toString().padStart(2, '0') + '-' + day.toString().padStart(2, '0') + ' ' + parts[1];
            
            // Create Date object
            const date = new Date(fullTimestamp);
            if (isNaN(date.getTime())) return null;
            
            const epochMs = date.getTime();
            
            console.log('Converted simple timestamp:', timestampStr, 'to epoch:', epochMs);
            return epochMs;
        } catch (error) {
            console.warn('Error converting simple timestamp to epoch:', error);
            return null;
        }
    }

    analyzeDataStructure() {
        const sampleSize = Math.min(10, this.parsedData.length);
        const sampleData = this.parsedData.slice(0, sampleSize);
        const headers = Object.keys(this.parsedData[0] || {});
        
        this.dimensions = [];
        this.metrics = [];
        this.timestampDimensions = [];
        
        headers.forEach(header => {
            const values = sampleData.map(row => row[header]).filter(v => v !== undefined && v !== '');
            
            if (values.length === 0) {
                // Skip empty columns
                return;
            }
            
            // Rule 1: If header contains "timestamp", it's a Date category
            const isTimestampHeader = /timestamp/i.test(header);
            if (isTimestampHeader) {
                this.dimensions.push(header);
                this.timestampDimensions.push(header);
                return;
            }
            
            // Rule 2: If values can be converted to integer or float, it's a Metric
            const canConvertToNumber = values.every(value => {
                if (typeof value === 'number') {
                    return true;
                }
                // Check if the string represents a pure number (no letters, only digits, decimal point, and optional minus sign)
                const strValue = String(value).trim();
                const isPureNumber = /^-?\d+(\.\d+)?$/.test(strValue);
                if (isPureNumber) {
                    const num = parseFloat(strValue);
                    return !isNaN(num) && isFinite(num);
                }
                return false;
            });
            
            if (canConvertToNumber) {
                this.metrics.push(header);
                return;
            }
            
            // Rule 3: Everything else is a Dimension
            this.dimensions.push(header);
        });
        
        console.log('Detected Dimensions:', this.dimensions);
        console.log('Detected Metrics:', this.metrics);
        console.log('Detected Timestamp Dimensions:', this.timestampDimensions);
    }

    detectTimePattern(values) {
        // Check for timestamp patterns
        const timePatterns = [
            /^\d{4}-\d{2}-\d{2}/,  // YYYY-MM-DD
            /^\d{2}-\d{2}-\d{2}/,  // MM-DD-YY or DD-MM-YY
            /^\d{10,13}$/,         // Unix timestamp (10-13 digits)
            /^\d{4}\d{2}\d{2}/,    // YYYYMMDD
            /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/, // YYYY-MM-DD HH:MM:SS
            /^\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
            /^\d{2}-\d{2}-\d{4}/   // MM-DD-YYYY
        ];
        
        return values.some(value => {
            const strValue = String(value);
            return timePatterns.some(pattern => pattern.test(strValue)) ||
                   this.isValidDate(strValue) ||
                   this.isValidTimestamp(strValue);
        });
    }

    isValidDate(dateString) {
        const date = new Date(dateString);
        return !isNaN(date.getTime()) && dateString.length > 8;
    }

    isValidTimestamp(timestamp) {
        const num = this.safeParseFloat(timestamp);
        if (isNaN(num)) return false;
        
        // Check if it's a reasonable timestamp (between 1970 and 2100)
        const minTimestamp = 0; // Jan 1, 1970
        const maxTimestamp = 4102444800000; // Jan 1, 2100
        
        // Handle both seconds and milliseconds
        const adjustedTimestamp = num > 1e10 ? num : num * 1000;
        return adjustedTimestamp >= minTimestamp && adjustedTimestamp <= maxTimestamp;
    }

    detectIdPattern(values) {
        // Check for ID patterns (short strings, codes, etc.)
        return values.every(value => {
            const str = String(value);
            return str.length <= 10 && /^[a-zA-Z0-9_-]+$/.test(str);
        });
    }

    showLoadingState() {
        this.container.innerHTML = 
            '<div class="wave-analytics-container">' +
                '<div class="wave-header">' +
                    '<h2>Performance Analytics Dashboard</h2>' +
                '</div>' +
                '<div class="wave-content">' +
                    '<div class="loading-state">' +
                        '<div class="spinner"></div>' +
                        '<p>Loading performance data...</p>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    showErrorState(error) {
        this.container.innerHTML = 
            '<div class="wave-analytics-container">' +
                '<div class="wave-header">' +
                    '<h2>Performance Analytics Dashboard</h2>' +
                '</div>' +
                '<div class="wave-content">' +
                    '<div class="error-state">' +
                        '<div class="error-icon">⚠️</div>' +
                        '<h3>Error Loading Data</h3>' +
                        '<p>' + error.message + '</p>' +
                        '<button id="retryBtn" class="wave-btn">Retry</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.getElementById('retryBtn').addEventListener('click', () => {
            this.init();
        });
    }

    render() {
        this.container.innerHTML = 
            '<div class="wave-analytics-container">' +
                '<div class="wave-content">' +
                    '<div class="lens-builder">' +
                        '<div class="field-palette" id="fieldPalette">' +
                            '<div class="palette-header">' +
                                '<span class="palette-title">Categories</span>' +
                                '<button id="collapseBtn" class="collapse-toggle" title="Collapse/Expand Panel">‹</button>' +
                            '</div>' +
                            '<div class="category-section">' +
                                '<h3 class="category-header" data-target="dimensionsPalette">' +
                                    '<span class="collapse-icon">▼</span> Dimensions' +
                                '</h3>' +
                                '<div id="dimensionsPalette" class="field-list">' +
                                    '<!-- Dimensions will be populated here -->' +
                                '</div>' +
                            '</div>' +
                            '<div class="category-section">' +
                                '<h3 class="category-header" data-target="datePalette">' +
                                    '<span class="collapse-icon">▼</span> Date' +
                                '</h3>' +
                                '<div id="datePalette" class="field-list">' +
                                    '<!-- Date fields will be populated here -->' +
                                '</div>' +
                            '</div>' +
                            '<div class="category-section">' +
                                '<h3 class="category-header" data-target="metricsPalette">' +
                                    '<span class="collapse-icon">▼</span> Metrics' +
                                '</h3>' +
                                '<div id="metricsPalette" class="field-list">' +
                                    '<!-- Metrics will be populated here -->' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="lens-canvas">' +
                            '<div class="drop-zones">' +
                                '<div class="drop-zone" id="dimensionsZone">' +
                                    '<div class="drop-zone-header">' +
                                        '<div class="drop-zone-title-section">' +
                                            '<h4>Group by dimensions</h4>' +
                                            '<span class="drop-zone-count" id="dimensionsCount">0</span>' +
                                        '</div>' +
                                        '<button class="drop-zone-collapse-btn" data-zone="dimensionsZone" title="Collapse/Expand Drop Zone"><i class="fa fa-chevron-down"></i></button>' +
                                    '</div>' +
                                    '<div class="drop-area" id="dimensionsArea">' +
                                        '<span class="drop-hint">Drag dimensions here</span>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="drop-zone" id="metricsZone">' +
                                    '<div class="drop-zone-header">' +
                                        '<div class="drop-zone-title-section">' +
                                            '<h4>Metric aggregations</h4>' +
                                            '<span class="drop-zone-count" id="metricsCount">0</span>' +
                                        '</div>' +
                                        '<button class="drop-zone-collapse-btn" data-zone="metricsZone" title="Collapse/Expand Drop Zone"><i class="fa fa-chevron-down"></i></button>' +
                                    '</div>' +
                                    '<div class="drop-area" id="metricsArea">' +
                                        '<span class="drop-hint">Drag metrics here</span>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="drop-zone" id="filtersZone">' +
                                    '<div class="drop-zone-header">' +
                                        '<div class="drop-zone-title-section">' +
                                    '<h4>Filters</h4>' +
                                            '<span class="drop-zone-count" id="filtersCount">0</span>' +
                                        '</div>' +
                                        '<button class="drop-zone-collapse-btn" data-zone="filtersZone" title="Collapse/Expand Drop Zone"><i class="fa fa-chevron-down"></i></button>' +
                                    '</div>' +
                                    '<div class="drop-area" id="filtersArea">' +
                                        '<span class="drop-hint">Drag metrics here to filter</span>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                            '<div class="wave-header">' +
                                '<div class="wave-controls">' +
                                    '<div class="view-controls">' +
                                        '<input type="text" id="waveSearchInput" class="wave-search-input" placeholder="Search... (Enter)" title="Search across all data - Press Enter to apply">' +
                                        '<select id="loadLensSelect" class="lens-select" title="Load Saved Lens">' +
                                            '<option value="">Load Lens...</option>' +
                                        '</select>' +
                                        '<button id="saveLensBtn" class="wave-btn" title="Save Lens">💾</button>' +
                                        '<button id="tableViewBtn" class="wave-btn" title="Table View"><i class="fa fa-fw fa-table"></i></button>' +
                                        '<button id="lineChartBtn" class="wave-btn" title="Line Chart">📈</button>' +
                                        '<button id="barChartBtn" class="wave-btn active" title="Bar Chart">📊</button>' +
                                        '<button id="clearLensBtn" class="wave-btn" title="Clear Lens">🗑️</button>' +
                                        '<button id="exportBtn" class="wave-btn" title="Export CSV">📤</button>' +
                                        '<button id="refreshBtn" class="wave-btn" title="Refresh Data">🔄</button>' +
                                    '</div>' +
                                '</div>' +
                                                                
                            '</div>' +
'<div class="floating-chart-controls">' +
                                '<button id="chartReduceIcon" class="wave-btn" title="Reduce Chart Width"><i class="fa fa-long-arrow-left"></i></button>' +
                                '<div class="width-multiplier-container" title="Width Expansion Multiplier">' +
                                    '<select id="widthMultiplier" class="width-multiplier-select" title="Width Multiplier">' +
                                        '<option value="1">1x</option>' +
                                        '<option value="2">2x</option>' +
                                        '<option value="5">5x</option>' +
                                    '</select>' +
                                '</div>' +
                                '<button id="chartExpandIcon" class="wave-btn" title="Expand Chart Width"><i class="fa fa-long-arrow-right"></i></button>' +
                            '</div>' +
                            '<div class="lens-display">' +
                                '<div class="chart-container" id="lensChart">' +
                                    '<div class="chart-placeholder">' +
                                        '<p>Build your lens by dragging dimensions and metrics</p>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="table-container" id="lensTable" style="display: none;">' +
                                    '<div class="table-placeholder">' +
                                        '<p>Build your lens by dragging dimensions and metrics</p>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        // Save Lens Modal
        '<div id="saveLensModal" class="modal-overlay" style="display: none;">' +
            '<div class="modal-content">' +
                '<div class="modal-header">' +
                    '<h3>Save Lens</h3>' +
                    '<button class="modal-close" id="closeSaveLensModal">&times;</button>' +
                '</div>' +
                '<div class="modal-body">' +
                    '<form id="saveLensForm">' +
                        '<div class="form-group">' +
                            '<label for="lensNameInput">Lens Name:</label>' +
                            '<input type="text" id="lensNameInput" class="form-input" placeholder="Enter a name for this lens" maxlength="50" required>' +
                            '<div class="form-help">Choose a descriptive name for your lens configuration</div>' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label for="lensDescriptionInput">Description (optional):</label>' +
                            '<textarea id="lensDescriptionInput" class="form-textarea" placeholder="Add a description for this lens" maxlength="200"></textarea>' +
                        '</div>' +
                        '<div class="lens-preview">' +
                            '<h4>Lens Configuration:</h4>' +
                            '<div id="lensPreviewContent"></div>' +
                        '</div>' +
                    '</form>' +
                '</div>' +
                '<div class="modal-footer">' +
                    '<button type="button" class="btn btn-secondary" id="cancelSaveLens">Cancel</button>' +
                    '<button type="button" class="btn btn-primary" id="confirmSaveLens">Save Lens</button>' +
                '</div>' +
            '</div>' +
        '</div>';
        
        this.populateFieldPalette();
        
        // Small delay to ensure DOM is ready
        setTimeout(() => {
            this.setupDragAndDrop();
            this.setupEventListeners();
        }, 10);
    }

    populateFieldPalette() {
        const dimensionsPalette = document.getElementById('dimensionsPalette');
        const datePalette = document.getElementById('datePalette');
        const metricsPalette = document.getElementById('metricsPalette');
        
        // Clear existing content
        dimensionsPalette.innerHTML = '';
        datePalette.innerHTML = '';
        metricsPalette.innerHTML = '';
        
        // Separate dimensions into regular dimensions and date fields
        const regularDimensions = this.dimensions.filter(dim => !this.timestampDimensions.includes(dim));
        const dateFields = this.dimensions.filter(dim => this.timestampDimensions.includes(dim));
        
        // Populate regular dimensions
        regularDimensions.forEach(dimension => {
            const fieldElement = this.createFieldElement(dimension, 'dimension');
            dimensionsPalette.appendChild(fieldElement);
        });
        
        // Populate date fields
        dateFields.forEach(dateField => {
            const fieldElement = this.createFieldElement(dateField, 'date');
            datePalette.appendChild(fieldElement);
        });
        
        // Populate metrics (excluding timestamp fields)
        const regularMetrics = this.metrics.filter(metric => !this.timestampDimensions.includes(metric));
        regularMetrics.forEach(metric => {
            const fieldElement = this.createFieldElement(metric, 'metric');
            metricsPalette.appendChild(fieldElement);
        });
    }

    updateFieldPalettePreservingSelections() {
        // Store current selections
        const currentDimensions = [...this.selectedDimensions];
        const currentMetrics = [...this.selectedMetrics];
        const currentAggregations = {...this.metricAggregations};
        
        // Create combined lists that include both existing selections and new data
        const allDimensions = [...new Set([...currentDimensions, ...this.dimensions])];
        const allMetrics = [...new Set([...currentMetrics, ...this.metrics])];
        
        // Temporarily replace the data arrays to populate the palette with all available options
        const originalDimensions = this.dimensions;
        const originalMetrics = this.metrics;
        this.dimensions = allDimensions;
        this.metrics = allMetrics;
        
        // Update the field palette with combined data
        this.populateFieldPalette();
        
        // Restore original data arrays
        this.dimensions = originalDimensions;
        this.metrics = originalMetrics;
        
        // Keep all existing selections (don't filter them out)
        this.selectedDimensions = currentDimensions;
        this.selectedMetrics = currentMetrics;
        this.metricAggregations = currentAggregations;
        
        // Update available values for existing dimension filters
        this.updateDimensionFilterAvailableValues();
        
        // Update UI with preserved selections
        this.updateDropZone('dimensionsArea', this.selectedDimensions);
        this.updateDropZone('metricsArea', this.selectedMetrics);
        this.updateFiltersZone(); // Refresh filters zone to show updated dropdown options
        this.updateDropZoneCounts();
        this.updateFieldItemIcons();
        
        // Re-initialize drag and drop for new DOM elements
        this.dragAndDropSetup = false; // Reset the flag
        setTimeout(() => {
            this.setupDragAndDrop();
        }, 10);
        
        console.log('Field palette updated. Preserved all dimensions:', this.selectedDimensions);
        console.log('Field palette updated. Preserved all metrics:', this.selectedMetrics);
        console.log('Field palette updated. Preserved all aggregations:', this.metricAggregations);
    }

    updateDimensionFilterAvailableValues() {
        // Update available values for existing dimension filters based on current data
        Object.keys(this.dimensionFilters).forEach(dimensionName => {
            if (this.dimensions.includes(dimensionName)) {
                // Get unique values for this dimension from current data
                const uniqueValues = [...new Set(this.parsedData.map(row => row[dimensionName]).filter(value => value !== null && value !== undefined))];
                
                // Update the available values, preserving existing selected values
                const existingSelectedValues = this.dimensionFilters[dimensionName].selectedValues || [];
                const existingAvailableValues = this.dimensionFilters[dimensionName].availableValues || [];
                
                // Combine existing available values with new unique values
                const allAvailableValues = [...new Set([...existingAvailableValues, ...uniqueValues])];
                
                // Update the dimension filter
                this.dimensionFilters[dimensionName].availableValues = allAvailableValues;
                
                console.log(`Updated dimension filter '${dimensionName}':`, {
                    existingAvailable: existingAvailableValues,
                    newUnique: uniqueValues,
                    combined: allAvailableValues,
                    selected: existingSelectedValues
                });
            }
        });
    }

    createFieldElement(fieldName, type) {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'field-item';
        fieldDiv.draggable = true;
        fieldDiv.setAttribute('data-field', fieldName);
        fieldDiv.setAttribute('data-type', type);
        fieldDiv.innerHTML = this.formatHeader(fieldName) + ' <span class="click-hint">+</span>';
        
        return fieldDiv;
    }

    setupDragAndDrop() {
        if (this.dragAndDropSetup) {
            console.log('Drag and drop already setup, skipping');
            return;
        }
        
        // Make field items draggable and clickable
        const fieldItems = document.querySelectorAll('.field-item');
        console.log('Setting up drag and drop for', fieldItems.length, 'field items');
        
        // Remove existing event listeners to prevent duplicates
        fieldItems.forEach(item => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
        });
        
        // Re-query after cloning to get fresh elements
        const freshFieldItems = document.querySelectorAll('.field-item');
        
        freshFieldItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                console.log('Drag started for:', e.target);
                this.draggedElement = e.target;
                e.target.style.opacity = '0.5';
            });
            
            item.addEventListener('dragend', (e) => {
                e.target.style.opacity = '1';
                this.draggedElement = null;
            });
            
            // Add right-click functionality to automatically add filters
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const fieldName = e.target.getAttribute('data-field');
                const fieldType = e.target.getAttribute('data-type');
                console.log('Right-clicked field:', fieldName, 'type:', fieldType);
                
                if (fieldType === 'dimension') {
                    this.addDimensionFilter(fieldName);
                } else if (fieldType === 'date') {
                    this.addDateFilter(fieldName);
                } else if (fieldType === 'metric') {
                    this.addFilter(fieldName);
                }
            });
            
            // Add click functionality with toggle behavior
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const fieldName = e.target.getAttribute('data-field');
                const fieldType = e.target.getAttribute('data-type');
                
                if (fieldType === 'dimension' || fieldType === 'date') {
                    if (this.selectedDimensions.includes(fieldName)) {
                        this.removeDimension(fieldName);
                    } else {
                    this.addDimension(fieldName);
                    }
                } else if (fieldType === 'metric') {
                    if (this.selectedMetrics.includes(fieldName)) {
                        this.removeMetric(fieldName);
                    } else {
                    this.addMetric(fieldName);
                    }
                }
            });
        });
        
        // Setup drop zones
        const dimensionsArea = document.getElementById('dimensionsArea');
        const metricsArea = document.getElementById('metricsArea');
        const filtersArea = document.getElementById('filtersArea');
        
        console.log('Drop zones found:', {
            dimensionsArea: !!dimensionsArea,
            metricsArea: !!metricsArea,
            filtersArea: !!filtersArea
        });
        
        [dimensionsArea, metricsArea, filtersArea].forEach(area => {
            area.addEventListener('dragover', (e) => {
                e.preventDefault();
                area.classList.add('drag-over');
            });
            
            area.addEventListener('dragleave', (e) => {
                area.classList.remove('drag-over');
            });
            
            area.addEventListener('drop', (e) => {
                e.preventDefault();
                area.classList.remove('drag-over');
                console.log('Drop event on:', area.id, 'draggedElement:', this.draggedElement);
                
                if (this.draggedElement) {
                    const fieldName = this.draggedElement.getAttribute('data-field');
                    const fieldType = this.draggedElement.getAttribute('data-type');
                    console.log('Dropping field:', fieldName, 'type:', fieldType, 'on area:', area.id);
                    
                    if (area.id === 'dimensionsArea' && (fieldType === 'dimension' || fieldType === 'date')) {
                        this.addDimension(fieldName);
                    } else if (area.id === 'metricsArea' && fieldType === 'metric') {
                        this.addMetric(fieldName);
                    } else if (area.id === 'filtersArea' && (fieldType === 'metric' || fieldType === 'date' || fieldType === 'dimension')) {
                        if (fieldType === 'dimension') {
                            this.addDimensionFilter(fieldName);
                        } else {
                            this.addFilter(fieldName);
                        }
                    }
                }
            });
        });
        
        this.dragAndDropSetup = true;
    }

    addDimension(dimensionName) {
        if (!this.selectedDimensions.includes(dimensionName)) {
            this.selectedDimensions.push(dimensionName);
            this.updateDropZone('dimensionsArea', this.selectedDimensions);
            this.updateDropZoneCounts();
            this.updateFieldItemIcons();
            
            // Date/time filter removed as requested
            
            this.renderLensChart();
        }
    }

    addMetric(metricName) {
        if (!this.selectedMetrics.includes(metricName)) {
            this.selectedMetrics.push(metricName);
            // Initialize with default aggregation (average)
            this.metricAggregations[metricName] = ['average'];
            this.updateDropZone('metricsArea', this.selectedMetrics);
            this.updateDropZoneCounts();
            this.updateFieldItemIcons();
            this.renderLensChart();
        }
    }

    addFilter(metricName) {
        if (!this.selectedFilters.some(filter => filter.metric === metricName)) {
            // Check if it's a timestamp dimension
            if (this.timestampDimensions.includes(metricName)) {
                this.addDateFilter(metricName);
            } else {
                const { min, max } = this.getMetricRange(metricName);
                const filter = {
                    metric: metricName,
                    operator: 'between',
                    value1: min.toString(),
                    value2: max.toString()
                };
                this.selectedFilters.push(filter);
                this.updateFiltersZone();
                this.updateDropZoneCounts();
                this.applyFilters();
            }
        }
    }

    addDateFilter(dimensionName) {
        if (!this.selectedFilters.some(filter => filter.metric === dimensionName)) {
            // Get min and max timestamp values for pre-filling
            const { min, max } = this.getTimestampRange(dimensionName);
            const filter = {
                metric: dimensionName,
                operator: 'date_range',
                value1: min,
                value2: max,
                isDateFilter: true
            };
            this.selectedFilters.push(filter);
            this.updateFiltersZone();
            this.updateDropZoneCounts();
            this.applyFilters();
        }
    }

    getTimestampRange(dimensionName) {
        // Get all timestamp values for this dimension
        const dataSource = this.parsedData.length > 0 ? this.parsedData : this.filteredData;
        const timestampValues = dataSource
            .map(row => row[dimensionName])
            .filter(val => val !== null && val !== undefined && val !== '')
            .map(val => this.parseTimestamp(val))
            .filter(date => !isNaN(date));
        
        if (timestampValues.length === 0) {
            return { min: '', max: '' };
        }
        
        const minTimestamp = Math.min(...timestampValues);
        const maxTimestamp = Math.max(...timestampValues);
        
        // Convert to datetime-local format (YYYY-MM-DDTHH:MM)
        const formatForInput = (timestamp) => {
            const date = new Date(timestamp);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        };
        
        return {
            min: formatForInput(minTimestamp),
            max: formatForInput(maxTimestamp)
        };
    }

    addDimensionFilter(dimensionName) {
        if (!this.dimensionFilters[dimensionName]) {
            // Get unique values for this dimension from the original parsed data
            const dataSource = this.parsedData.length > 0 ? this.parsedData : this.filteredData;
            const uniqueValues = [...new Set(dataSource.map(row => row[dimensionName]).filter(val => val !== null && val !== undefined && val !== ''))];
            
            console.log('Adding dimension filter for:', dimensionName, 'dataSource length:', dataSource.length, 'with values:', uniqueValues);
            
            this.dimensionFilters[dimensionName] = {
                dimension: dimensionName,
                selectedValues: [], // Empty array means "All" selected
                availableValues: uniqueValues
            };
            
            this.updateFiltersZone();
            this.updateDropZoneCounts();
            this.applyFilters();
        }
    }

    getMetricRange(metricName) {
        // Use filtered data to get min/max from currently visible rows
        const values = this.filteredData
            .map(row => parseFloat(row[metricName]))
            .filter(val => !isNaN(val));
        
        if (values.length === 0) {
            return { min: 0, max: 100 };
        }
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        return { min, max };
    }

    passesFilter(row, filter) {
        const value = row[filter.metric];
        if (value === null || value === undefined || value === '') return true; // Skip if no value
        
        // Handle date range filters
        if (filter.operator === 'date_range') {
            if (!filter.value1 && !filter.value2) return true; // No date filter set
            
            const rowDate = this.parseTimestamp(value);
            if (isNaN(rowDate)) return true; // Skip if not a valid date
            
            if (filter.value1) {
                const fromDate = new Date(filter.value1).getTime();
                if (rowDate < fromDate) return false;
            }
            
            if (filter.value2) {
                const toDate = new Date(filter.value2).getTime();
                if (rowDate > toDate) return false;
            }
            
            return true;
        }
        
        // Handle numeric filters
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return true; // Skip if not numeric
        
        const filterValue1 = parseFloat(filter.value1);
        const filterValue2 = parseFloat(filter.value2);
        
        if (isNaN(filterValue1) && filter.operator !== 'between') return true; // Skip if no filter value
        if (filter.operator === 'between' && (isNaN(filterValue1) || isNaN(filterValue2))) return true;
        
        switch (filter.operator) {
            case 'between':
                return numValue >= filterValue1 && numValue <= filterValue2;
            case 'less than':
                return numValue < filterValue1;
            case 'less than or equal':
                return numValue <= filterValue1;
            case 'greater than':
                return numValue > filterValue1;
            case 'greater than or equal':
                return numValue >= filterValue1;
            case 'equal':
                return numValue === filterValue1;
            case 'not equal':
                return numValue !== filterValue1;
            default:
                return true;
        }
    }

    getMetricRangeExcludingFilter(metricName, excludeFilterIndex) {
        // Get data filtered by all filters except the specific metric filter being changed
        const dataWithoutCurrentFilter = this.parsedData.filter(row => {
            // Apply current filters (cell, instance, search)
            const primaryDimensions = this.dimensions.slice(0, 2);
            
            if (this.currentFilters.cell && primaryDimensions[0] && row[primaryDimensions[0]] !== this.currentFilters.cell) return false;
            if (this.currentFilters.instance && primaryDimensions[1] && row[primaryDimensions[1]] !== this.currentFilters.instance) return false;
            if (this.currentFilters.search) {
                const searchTerm = this.currentFilters.search.toLowerCase();
                const searchableText = Object.values(row).join(' ').toLowerCase();
                if (!searchableText.includes(searchTerm)) return false;
            }
            
            // Apply date/time filters
            const dateTimeFilterPass = Object.keys(this.dateTimeFilters).every(dimension => {
                const filter = this.dateTimeFilters[dimension];
                const value = row[dimension];
                
                if (!value) return true; // Skip if no value
                
                try {
                    const dateValue = new Date(value);
                    if (isNaN(dateValue.getTime())) return true; // Skip if not a valid date
                    
                    if (filter.type === 'relative') {
                        const now = new Date();
                        const diffMs = now - dateValue;
                        
                        switch (filter.period) {
                            case 'last_hour':
                                return diffMs <= 60 * 60 * 1000;
                            case 'last_24h':
                                return diffMs <= 24 * 60 * 60 * 1000;
                            case 'last_7d':
                                return diffMs <= 7 * 24 * 60 * 60 * 1000;
                            case 'last_30d':
                                return diffMs <= 30 * 24 * 60 * 60 * 1000;
                            case 'last_90d':
                                return diffMs <= 90 * 24 * 60 * 60 * 1000;
                            default:
                                return true;
                        }
                    } else if (filter.type === 'absolute') {
                        if (filter.from) {
                            const fromDate = new Date(filter.from);
                            if (dateValue < fromDate) return false;
                        }
                        if (filter.to) {
                            const toDate = new Date(filter.to);
                            if (dateValue > toDate) return false;
                        }
                        return true;
                    }
                } catch (e) {
                    return true; // Skip if date parsing fails
                }
                
                return true;
            });
            
            if (!dateTimeFilterPass) return false;
            
            // Apply metric filters EXCEPT the one being changed
            const metricFilterPass = this.selectedFilters.every((filter, index) => {
                if (index === excludeFilterIndex) {
                    return true; // Skip the filter being changed
                }
                return this.passesFilter(row, filter);
            });
            
            if (!metricFilterPass) return false;
            
            // Apply dimension filters
            const dimensionFilterPass = Object.keys(this.dimensionFilters).every(dimensionName => {
                const dimensionFilter = this.dimensionFilters[dimensionName];
                const value = row[dimensionName];
                
                // If no values selected (All), include the row
                if (dimensionFilter.selectedValues.length === 0) {
                    return true;
                }
                
                // Check if the row's value is in the selected values
                return dimensionFilter.selectedValues.includes(value);
            });
            
            return dimensionFilterPass;
        });

        // Get min/max from this filtered data
        const values = dataWithoutCurrentFilter
            .map(row => parseFloat(row[metricName]))
            .filter(val => !isNaN(val));
        
        if (values.length === 0) {
            return { min: 0, max: 100 };
        }
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        return { min, max };
    }

    // Helper function to ensure metricAggregations values are always arrays
    getMetricAggregations(metricName) {
        const aggregations = this.metricAggregations[metricName];
        if (Array.isArray(aggregations)) {
            return aggregations;
        } else if (aggregations) {
            return [aggregations];
        } else {
            return ['average'];
        }
    }

    updateDropZone(zoneId, items) {
        const zone = document.getElementById(zoneId);
        zone.innerHTML = '';
        
        if (items.length === 0) {
            zone.innerHTML = '<span class="drop-hint">Drag ' + (zoneId === 'dimensionsArea' ? 'dimensions' : 'metrics') + ' here</span>';
        } else {
            // Get colors for metrics
            const colors = this.generateColorsForMetrics(items);
            
            items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'selected-item';
                
                if (zoneId === 'metricsArea') {
                    // For metrics, include multi-select aggregation dropdown
                    const metricName = item;
                    const selectedAggregations = this.getMetricAggregations(metricName);
                    const aggregationLabels = selectedAggregations.map(agg => this.getAggregationLabel(agg)).join(', ');
                    
                    itemDiv.innerHTML = 
                        '<div class="metric-item">' +
                            '<span class="metric-name">' + this.formatHeader(metricName) + 
                            '<span class="aggregation-label"> (' + aggregationLabels + ')</span></span>' +
                            '<div class="aggregation-dropdown-container">' +
                                '<button class="aggregation-dropdown-toggle" data-metric="' + metricName + '">' +
                                    '<span class="dropdown-text">Aggregations</span>' +
                                    '<span class="dropdown-arrow">▼</span>' +
                                '</button>' +
                                '<div class="aggregation-dropdown-menu" data-metric="' + metricName + '" style="display: none;">' +
                                    '<div class="dropdown-item">' +
                                        '<label class="aggregation-checkbox-label">' +
                                            '<input type="checkbox" class="aggregation-checkbox" data-metric="' + metricName + '" value="sum"' + (selectedAggregations.includes('sum') ? ' checked' : '') + '>' +
                                            '<span class="checkbox-text">Sum</span>' +
                                        '</label>' +
                                    '</div>' +
                                    '<div class="dropdown-item">' +
                                        '<label class="aggregation-checkbox-label">' +
                                            '<input type="checkbox" class="aggregation-checkbox" data-metric="' + metricName + '" value="count"' + (selectedAggregations.includes('count') ? ' checked' : '') + '>' +
                                            '<span class="checkbox-text">Count</span>' +
                                        '</label>' +
                                    '</div>' +
                                    '<div class="dropdown-item">' +
                                        '<label class="aggregation-checkbox-label">' +
                                            '<input type="checkbox" class="aggregation-checkbox" data-metric="' + metricName + '" value="average"' + (selectedAggregations.includes('average') ? ' checked' : '') + '>' +
                                            '<span class="checkbox-text">Average</span>' +
                                        '</label>' +
                                    '</div>' +
                                    '<div class="dropdown-item">' +
                                        '<label class="aggregation-checkbox-label">' +
                                            '<input type="checkbox" class="aggregation-checkbox" data-metric="' + metricName + '" value="median"' + (selectedAggregations.includes('median') ? ' checked' : '') + '>' +
                                            '<span class="checkbox-text">Median</span>' +
                                        '</label>' +
                                    '</div>' +
                                    '<div class="dropdown-item">' +
                                        '<label class="aggregation-checkbox-label">' +
                                            '<input type="checkbox" class="aggregation-checkbox" data-metric="' + metricName + '" value="p50"' + (selectedAggregations.includes('p50') ? ' checked' : '') + '>' +
                                            '<span class="checkbox-text">P50</span>' +
                                        '</label>' +
                                    '</div>' +
                                    '<div class="dropdown-item">' +
                                        '<label class="aggregation-checkbox-label">' +
                                            '<input type="checkbox" class="aggregation-checkbox" data-metric="' + metricName + '" value="p90"' + (selectedAggregations.includes('p90') ? ' checked' : '') + '>' +
                                            '<span class="checkbox-text">P90</span>' +
                                        '</label>' +
                                    '</div>' +
                                    '<div class="dropdown-item">' +
                                        '<label class="aggregation-checkbox-label">' +
                                            '<input type="checkbox" class="aggregation-checkbox" data-metric="' + metricName + '" value="p95"' + (selectedAggregations.includes('p95') ? ' checked' : '') + '>' +
                                            '<span class="checkbox-text">P95</span>' +
                                        '</label>' +
                                    '</div>' +
                                    '<div class="dropdown-item">' +
                                        '<label class="aggregation-checkbox-label">' +
                                            '<input type="checkbox" class="aggregation-checkbox" data-metric="' + metricName + '" value="max"' + (selectedAggregations.includes('max') ? ' checked' : '') + '>' +
                                            '<span class="checkbox-text">Max</span>' +
                                        '</label>' +
                                    '</div>' +
                                    '<div class="dropdown-item">' +
                                        '<label class="aggregation-checkbox-label">' +
                                            '<input type="checkbox" class="aggregation-checkbox" data-metric="' + metricName + '" value="min"' + (selectedAggregations.includes('min') ? ' checked' : '') + '>' +
                                            '<span class="checkbox-text">Min</span>' +
                                        '</label>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                            '<span class="remove-btn" data-item="' + metricName + '">×</span>' +
                        '</div>';
                } else {
                    // For dimensions, simple display with default color
                    itemDiv.innerHTML = this.formatHeader(item) + '<span class="remove-btn" data-item="' + item + '">×</span>';
                }
                
                zone.appendChild(itemDiv);
            });
            
            // Add remove functionality
            zone.querySelectorAll('.remove-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    if (zoneId === 'dimensionsArea') {
                        const itemName = e.target.dataset.item;
                        this.removeDimension(itemName);
                    } else if (zoneId === 'metricsArea') {
                        const metricName = e.target.dataset.item;
                        this.removeMetric(metricName);
                    }
                });
            });
            
            // Add aggregation dropdown functionality for metrics
            if (zoneId === 'metricsArea') {
                // Add event listeners for aggregation dropdown toggles
                zone.querySelectorAll('.aggregation-dropdown-toggle').forEach(button => {
                    button.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const metricName = e.target.closest('.aggregation-dropdown-toggle').dataset.metric;
                        const menu = zone.querySelector('.aggregation-dropdown-menu[data-metric="' + metricName + '"]');
                        
                        // Close all other dropdowns
                        zone.querySelectorAll('.aggregation-dropdown-menu').forEach(otherMenu => {
                            if (otherMenu !== menu && otherMenu.style.display === 'block') {
                                otherMenu.style.display = 'none';
                            }
                        });
                        
                        // Toggle current dropdown
                        if (menu.style.display === 'none' || menu.style.display === '') {
                            // Position the dropdown menu
                            const buttonRect = button.getBoundingClientRect();
                            menu.style.position = 'fixed';
                            menu.style.top = (buttonRect.bottom + window.scrollY) + 'px';
                            menu.style.left = buttonRect.left + 'px';
                            menu.style.width = Math.max(buttonRect.width, 150) + 'px';
                            menu.style.display = 'block';
                            
                            // Set very high z-index for this dropdown (appears above all other elements)
                            const allDropdowns = zone.querySelectorAll('.aggregation-dropdown-menu, .dimension-dropdown-menu');
                            const maxZIndex = Math.max(50000, ...Array.from(allDropdowns).map(m => parseInt(m.style.zIndex) || 0));
                            const newZIndex = (maxZIndex + 1).toString();
                            menu.style.zIndex = newZIndex;
                            //console.log('DEBUG: Setting aggregation dropdown z-index to:', newZIndex);
                        } else {
                            menu.style.display = 'none';
                        }
                    });
                });
                
                // Add event listeners for aggregation checkboxes
                zone.querySelectorAll('.aggregation-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', (e) => {
                        e.stopPropagation();
                        const metricName = e.target.dataset.metric;
                        const value = e.target.value;
                        const isChecked = e.target.checked;
                        
                        // Update the selected aggregations
                        if (isChecked) {
                            if (!this.metricAggregations[metricName].includes(value)) {
                                this.metricAggregations[metricName].push(value);
                            }
                        } else {
                            this.metricAggregations[metricName] = this.metricAggregations[metricName].filter(agg => agg !== value);
                        }
                        
                        // Update the display
                        this.updateMetricAggregationDisplay(metricName);
                        this.renderLensChart();
                    });
                });
                
                // Close dropdowns when clicking outside
                document.addEventListener('click', (e) => {
                    if (!e.target.closest('.aggregation-dropdown-container') && !e.target.closest('.aggregation-dropdown-menu')) {
                        zone.querySelectorAll('.aggregation-dropdown-menu').forEach(menu => {
                            if (menu.style.display === 'block') {
                                menu.style.display = 'none';
                            }
                        });
                    }
                });
            }
        }
    }

    updateFiltersZone() {
        //console.log('DEBUG: updateFiltersZone() called');
        const zone = document.getElementById('filtersArea');
        //console.log('DEBUG: filtersArea element found:', zone);
        zone.innerHTML = '';
        
        // Search input is now in the header, not in the drop zone
        
        //console.log('DEBUG: ignoredRows.size =', this.ignoredRows.size);
        // Always add rows filter (show by default)
        //console.log('DEBUG: Adding rows filter to drop zone');
        const rowsFilterDiv = document.createElement('div');
        rowsFilterDiv.className = 'selected-item filter-item rows-filter';
        
        // Show count only if there are ignored rows
        const countText = this.ignoredRows.size > 0 ? ' (' + this.ignoredRows.size + ' ignored)' : '';
        rowsFilterDiv.innerHTML = 
            '<div class="filter-content">' +
                '<span class="filter-metric">rows</span>' +
                '<span class="filter-count">' + countText + '</span>' +
                '<span class="table-icon" title="View all rows"><i class="fa fa-fw fa-table"></i></span>' +
            '</div>';
        
        zone.appendChild(rowsFilterDiv);
        //console.log('DEBUG: Rows filter added to DOM');
        //console.log('DEBUG: Zone innerHTML after adding rows filter:', zone.innerHTML);
        //console.log('DEBUG: Zone children count:', zone.children.length);
        
        // Add dimension filters
        Object.keys(this.dimensionFilters).forEach(dimensionName => {
            const dimensionFilter = this.dimensionFilters[dimensionName];
            const isAllSelected = dimensionFilter.selectedValues.length === 0;
            const selectedCount = dimensionFilter.selectedValues.length;
            const displayText = isAllSelected ? 'All' : (selectedCount === 1 ? dimensionFilter.selectedValues[0] : selectedCount + ' selected');
            
            console.log('Rendering dimension filter:', dimensionName, 'availableValues:', dimensionFilter.availableValues);
            
            const filterDiv = document.createElement('div');
            filterDiv.className = 'selected-item filter-item dimension-filter';
            filterDiv.innerHTML = 
                '<div class="filter-content">' +
                    '<span class="filter-metric">' + this.formatHeader(dimensionName) + '</span>' +
                    '<div class="dimension-dropdown-container">' +
                        '<button class="dimension-dropdown-toggle" data-dimension="' + dimensionName + '">' +
                            '<span class="dropdown-text">' + displayText + '</span>' +
                            '<span class="dropdown-arrow">▼</span>' +
                        '</button>' +
                        '<div class="dimension-dropdown-menu" data-dimension="' + dimensionName + '" style="display: none;">' +
                            '<div class="dropdown-item">' +
                                '<label class="dimension-checkbox-label">' +
                                    '<input type="checkbox" class="dimension-checkbox all-checkbox" data-dimension="' + dimensionName + '" value="all"' + (isAllSelected ? ' checked' : '') + '>' +
                                    '<span class="checkbox-text">All</span>' +
                                '</label>' +
                            '</div>' +
                            (dimensionFilter.availableValues && dimensionFilter.availableValues.length > 0 ? 
                                dimensionFilter.availableValues.map(value => 
                                    '<div class="dropdown-item">' +
                                        '<label class="dimension-checkbox-label">' +
                                        '<input type="checkbox" class="dimension-checkbox value-checkbox" data-dimension="' + dimensionName + '" value="' + value + '"' + 
                                        (dimensionFilter.selectedValues.includes(value) ? ' checked' : '') + '>' +
                                            '<span class="checkbox-text">' + value + '</span>' +
                                        '</label>' +
                                    '</div>'
                                ).join('') : 
                                '<div class="dropdown-item"><span class="checkbox-text">No values available</span></div>'
                            ) +
                        '</div>' +
                    '</div>' +
                    '<span class="remove-btn" data-dimension="' + dimensionName + '">×</span>' +
                '</div>';
            
            zone.appendChild(filterDiv);
        });
        
        // Add selected filters
        //console.log('DEBUG: updateFiltersZone - selectedFilters:', this.selectedFilters);
        this.selectedFilters.forEach((filter, index) => {
                //console.log('DEBUG: Creating filter div for filter:', filter, 'index:', index);
                const filterDiv = document.createElement('div');
                filterDiv.className = 'selected-item filter-item';
                // Build filter content - only show operator dropdown for non-date filters
                let operatorDropdown = '';
                if (filter.operator !== 'date_range') {
                    operatorDropdown = '<select class="filter-operator" data-index="' + index + '">' +
                        this.filterOperators.map(op => 
                            '<option value="' + op.value + '"' + (filter.operator === op.value ? ' selected' : '') + '>' + op.label + '</option>'
                        ).join('') +
                    '</select>';
                }
                
                filterDiv.innerHTML = 
                    '<div class="filter-content">' +
                        '<span class="filter-metric">' + this.formatHeader(filter.metric) + '</span>' +
                        operatorDropdown +
                        this.renderFilterInputs(filter, index) +
                        '<span class="remove-btn" data-filter-index="' + index + '">×</span>' +
                    '</div>';
                
                //console.log('DEBUG: Created filter div HTML:', filterDiv.innerHTML);
                zone.appendChild(filterDiv);
        });
        
        // Add event listeners
        zone.querySelectorAll('.filter-operator').forEach(select => {
            select.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const newOperator = e.target.value;
                const filter = this.selectedFilters[index];
                // Get min/max excluding the current filter being changed
                const { min, max } = this.getMetricRangeExcludingFilter(filter.metric, index);
                
                // Update operator
                filter.operator = newOperator;
                
                // Set appropriate default values based on operator
                if (newOperator === 'between') {
                    filter.value1 = min.toString();
                    filter.value2 = max.toString();
                } else if (newOperator === 'less than' || newOperator === 'less than or equal') {
                    filter.value1 = max.toString();
                } else if (newOperator === 'greater than' || newOperator === 'greater than or equal') {
                    filter.value1 = min.toString();
                } else {
                    filter.value1 = min.toString();
                }
                
                this.updateFiltersZone(); // Re-render to show appropriate inputs
                this.applyFilters();
            });
        });
        
        zone.querySelectorAll('.filter-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;
                this.selectedFilters[index][field] = e.target.value;
                this.applyFilters();
            });
        });
        
        zone.querySelectorAll('.remove-btn[data-filter-index]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.filterIndex);
                this.removeFilter(index);
            });
        });
        
        // Add event listener for table icon in rows filter
        zone.querySelectorAll('.table-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showRowsPopup();
            });
        });
        
        // Add event listeners for dimension dropdown toggles
        zone.querySelectorAll('.dimension-dropdown-toggle').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const dimensionName = e.target.closest('.dimension-dropdown-toggle').dataset.dimension;
                const menu = zone.querySelector('.dimension-dropdown-menu[data-dimension="' + dimensionName + '"]');
                
                // Close all other dropdowns
                zone.querySelectorAll('.dimension-dropdown-menu').forEach(otherMenu => {
                    if (otherMenu !== menu && otherMenu.style.display === 'block') {
                        otherMenu.style.display = 'none';
                        // Apply filters when other dropdown is closed
                        this.applyFilters();
                    }
                });
                
                // Toggle current dropdown
                if (menu.style.display === 'none' || menu.style.display === '') {
                    // Position the dropdown menu
                    const buttonRect = button.getBoundingClientRect();
                    menu.style.position = 'fixed';
                    menu.style.top = (buttonRect.bottom + window.scrollY) + 'px';
                    menu.style.left = buttonRect.left + 'px';
                    menu.style.width = Math.max(buttonRect.width, 150) + 'px';
                    menu.style.display = 'block';
                    
                    // Set very high z-index for this dropdown (appears above all other elements)
                    const allDropdowns = zone.querySelectorAll('.aggregation-dropdown-menu, .dimension-dropdown-menu');
                    const maxZIndex = Math.max(50000, ...Array.from(allDropdowns).map(m => parseInt(m.style.zIndex) || 0));
                    menu.style.zIndex = (maxZIndex + 1).toString();
                } else {
                    menu.style.display = 'none';
                    // Apply filters when dropdown is closed
                    this.applyFilters();
                }
            });
        });
        
        // Add event listeners for dimension checkboxes
        zone.querySelectorAll('.dimension-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const dimensionName = e.target.dataset.dimension;
                const value = e.target.value;
                const isChecked = e.target.checked;
                const isAllCheckbox = e.target.classList.contains('all-checkbox');
                
                if (isAllCheckbox) {
                    if (isChecked) {
                        // Select "All" - clear all other selections
                        this.dimensionFilters[dimensionName].selectedValues = [];
                        // Uncheck all individual value checkboxes
                        const menu = document.querySelector('.dimension-dropdown-menu[data-dimension="' + dimensionName + '"]');
                        if (menu) {
                            menu.querySelectorAll('.value-checkbox').forEach(checkbox => {
                                checkbox.checked = false;
                            });
                        }
                    } else {
                        // Deselect "All" - allow individual selections
                        // Don't prevent this, let it uncheck
                    }
                } else {
                    // Handle individual value checkbox
                    if (isChecked) {
                        // Add value to selection and uncheck "All"
                        if (!this.dimensionFilters[dimensionName].selectedValues.includes(value)) {
                            this.dimensionFilters[dimensionName].selectedValues.push(value);
                        }
                        // Uncheck "All" checkbox
                        const menu = document.querySelector('.dimension-dropdown-menu[data-dimension="' + dimensionName + '"]');
                        if (menu) {
                            const allCheckbox = menu.querySelector('.all-checkbox');
                            if (allCheckbox) {
                                allCheckbox.checked = false;
                            }
                        }
                    } else {
                        // Remove value from selection
                        this.dimensionFilters[dimensionName].selectedValues = 
                            this.dimensionFilters[dimensionName].selectedValues.filter(v => v !== value);
                    }
                }
                
                // Update the dropdown button text to reflect the new state
                this.updateDimensionFilterDisplay(dimensionName);
            });
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dimension-dropdown-container') && !e.target.closest('.dimension-dropdown-menu')) {
                zone.querySelectorAll('.dimension-dropdown-menu').forEach(menu => {
                    if (menu.style.display === 'block') {
                        menu.style.display = 'none';
                        // Apply filters when dropdown is closed
                        this.applyFilters();
                    }
                });
            }
        });
        
        // Add event listeners for dimension filter remove buttons
        zone.querySelectorAll('.remove-btn[data-dimension]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dimensionName = e.target.dataset.dimension;
                this.removeDimensionFilter(dimensionName);
            });
        });
        
        // Add timestamp/dateTime filters
        Object.keys(this.dateTimeFilters).forEach(timestampName => {
            const filter = this.dateTimeFilters[timestampName];
            //console.log('DEBUG: Rendering timestamp filter for:', timestampName, 'filter:', filter);
            
            const filterDiv = document.createElement('div');
            filterDiv.className = 'selected-item filter-item timestamp-filter';
            filterDiv.setAttribute('data-timestamp', timestampName);
            
            let displayText = '';
            if (filter.type === 'relative') {
                displayText = `${filter.type} (${filter.period})`;
            } else if (filter.type === 'absolute') {
                displayText = `${filter.type} (${filter.from} to ${filter.to})`;
            }
            
            filterDiv.innerHTML = 
                '<div class="filter-content">' +
                    '<span class="filter-metric">' + this.formatHeader(timestampName) + '</span>' +
                    '<span class="timestamp-type">' + filter.type + '</span>' +
                    '<span class="timestamp-period">' + (filter.period || filter.from + ' to ' + filter.to) + '</span>' +
                    '<span class="remove-btn" data-timestamp="' + timestampName + '">×</span>' +
                '</div>';
            
            zone.appendChild(filterDiv);
        });
        
        // Add event listeners for timestamp filter remove buttons
        zone.querySelectorAll('.remove-btn[data-timestamp]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const timestampName = e.target.dataset.timestamp;
                this.clearDateTimeFilter(timestampName);
            });
        });
    }

    renderFilterInputs(filter, index) {
        const operator = filter.operator;
        let inputs = '';
        
        //console.log('DEBUG: renderFilterInputs called with filter:', filter, 'index:', index);
        
        if (operator === 'date_range') {
            // Date range inputs for timestamp dimensions - no operator dropdown needed
            inputs = 
                '<input type="datetime-local" class="filter-input date-input" placeholder="From Date" data-index="' + index + '" data-field="value1" value="' + (filter.value1 || '') + '">' +
                '<input type="datetime-local" class="filter-input date-input" placeholder="To Date" data-index="' + index + '" data-field="value2" value="' + (filter.value2 || '') + '">';
        } else {
            const { min, max } = this.getMetricRange(filter.metric);
            //console.log('DEBUG: getMetricRange returned min:', min, 'max:', max, 'for metric:', filter.metric);
            
            if (operator === 'between') {
                const value1 = filter.value1 !== undefined ? filter.value1 : min;
                const value2 = filter.value2 !== undefined ? filter.value2 : max;
                //console.log('DEBUG: between operator - value1:', value1, 'value2:', value2);
                inputs = 
                    '<input type="number" class="filter-input" placeholder="Min (' + min + ')" data-index="' + index + '" data-field="value1" value="' + value1 + '">' +
                    '<input type="number" class="filter-input" placeholder="Max (' + max + ')" data-index="' + index + '" data-field="value2" value="' + value2 + '">';
            } else if (operator === 'less than' || operator === 'less than or equal') {
                // For less than operators, use max value as default
                const value1 = filter.value1 !== undefined ? filter.value1 : max;
                //console.log('DEBUG: less than operator - value1:', value1);
                inputs = '<input type="number" class="filter-input" placeholder="Max: ' + max + '" data-index="' + index + '" data-field="value1" value="' + value1 + '">';
            } else if (operator === 'greater than' || operator === 'greater than or equal') {
                // For greater than operators, use min value as default
                const value1 = filter.value1 !== undefined ? filter.value1 : min;
                //console.log('DEBUG: greater than operator - value1:', value1);
                inputs = '<input type="number" class="filter-input" placeholder="Min: ' + min + '" data-index="' + index + '" data-field="value1" value="' + value1 + '">';
            } else {
                // For equal/not equal, use min value as default
                const value1 = filter.value1 !== undefined ? filter.value1 : min;
                //console.log('DEBUG: equal operator - value1:', value1);
                inputs = '<input type="number" class="filter-input" placeholder="Value (min: ' + min + ')" data-index="' + index + '" data-field="value1" value="' + value1 + '">';
            }
        }
        
        console.log('DEBUG: renderFilterInputs returning:', inputs);
        return inputs;
    }

    removeFilter(index) {
        this.selectedFilters.splice(index, 1);
        this.updateFiltersZone();
        this.updateDropZoneCounts();
        this.applyFilters();
    }

    removeDimensionFilter(dimensionName) {
        delete this.dimensionFilters[dimensionName];
        this.updateFiltersZone();
        this.updateDropZoneCounts();
        this.applyFilters();
    }

    updateDimensionFilterDisplay(dimensionName) {
        const dimensionFilter = this.dimensionFilters[dimensionName];
        if (!dimensionFilter) return;
        
        const isAllSelected = dimensionFilter.selectedValues.length === 0;
        const selectedCount = dimensionFilter.selectedValues.length;
        const displayText = isAllSelected ? 'All' : (selectedCount === 1 ? dimensionFilter.selectedValues[0] : selectedCount + ' selected');
        
        // Find the dropdown button and update its text
        const dropdownButton = document.querySelector('.dimension-dropdown-toggle[data-dimension="' + dimensionName + '"]');
        if (dropdownButton) {
            const textSpan = dropdownButton.querySelector('.dropdown-text');
            if (textSpan) {
                textSpan.textContent = displayText;
            }
        }
    }

    removeDimension(dimensionName) {
        this.selectedDimensions = this.selectedDimensions.filter(d => d !== dimensionName);
        this.updateDropZone('dimensionsArea', this.selectedDimensions);
        this.updateDropZoneCounts();
        this.updateFieldItemIcons();
        
        // Hide date/time filter if this was a timestamp dimension
        if (this.timestampDimensions.includes(dimensionName)) {
            this.hideDateTimeFilter(dimensionName);
        }
        
        this.renderLensChart();
    }

    removeMetric(metricName) {
        this.selectedMetrics = this.selectedMetrics.filter(m => m !== metricName);
        delete this.metricAggregations[metricName];
        this.updateDropZone('metricsArea', this.selectedMetrics);
        this.updateDropZoneCounts();
        this.updateFieldItemIcons();
        this.renderLensChart();
    }

    updateMetricAggregation(metricName, aggregationType) {
        this.metricAggregations[metricName] = aggregationType;
        this.renderLensChart();
    }

    getMetricAggregation(metricName) {
        return this.metricAggregations[metricName] || 'average';
    }

    updateMetricAggregationDisplay(metricName) {
        const selectedAggregations = this.getMetricAggregations(metricName);
        const aggregationLabels = selectedAggregations.map(agg => this.getAggregationLabel(agg)).join(', ');
        
        // Update the aggregation label display
        const metricItem = document.querySelector('.metric-item:has(.remove-btn[data-item="' + metricName + '"])');
        if (metricItem) {
            const aggregationLabel = metricItem.querySelector('.aggregation-label');
            if (aggregationLabel) {
                aggregationLabel.textContent = ' (' + aggregationLabels + ')';
            }
        }
    }

    calculateOptimalCanvasSize(chartData) {
        // Step 1: Get chart data
        const labels = chartData.labels || [];
        const metrics = this.selectedMetrics || [];
        const groups = labels;

        if (labels.length === 0) {
            return { width: 800, height: 650 };
        }

        // Step 2: Calculate space requirements for each component
        const spaceRequirements = this.calculateSpaceRequirements(labels, metrics, groups);

        // Step 3: Calculate optimal canvas size with proper aspect ratio
        const canvasSize = this.calculateCanvasSizeWithAspectRatio(spaceRequirements, labels, metrics);

        return canvasSize;
    }

    calculateSpaceRequirements(labels, metrics, groups) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // 2.1: Calculate X-axis label space requirements
        const xAxisSpace = this.calculateXAxisSpaceRequirements(tempCtx, labels);
        
        // 2.2: Calculate Y-axis space requirements
        const yAxisSpace = this.calculateYAxisSpaceRequirements(tempCtx, metrics);
        
        // 2.3: Calculate chart area requirements
        const chartAreaSpace = this.calculateChartAreaSpaceRequirements(groups, metrics);
        
        // 2.4: Calculate legend space requirements
        const legendSpace = this.calculateLegendSpaceRequirements(tempCtx, metrics);
        
        const requirements = {
            xAxis: xAxisSpace,
            yAxis: yAxisSpace,
            chartArea: chartAreaSpace,
            legend: legendSpace
        };
        
        return requirements;
    }

    calculateXAxisSpaceRequirements(ctx, labels) {
        // Test different font sizes to find optimal
        let optimalFontSize = 10;
        let needsRotation = false;
        let maxLabelWidth = 0;
        
        // Check if we have multiple group by dimensions
        const hasMultipleGroupBy = this.selectedDimensions.length > 1;
        
        for (let fontSize = 10; fontSize >= 6; fontSize--) {
            ctx.font = fontSize + 'px Arial';
            
            // Calculate max width considering multi-group labels
            let currentMaxWidth = 0;
            labels.forEach(label => {
                if (hasMultipleGroupBy) {
                    // For multi-group labels, calculate width based on layout
                    const groupValues = label.split(/[,|]/).map(v => v.trim());
                    if (groupValues.length > 1) {
                        // For horizontal: max width of any single group value
                        // For vertical: width of combined label with separators
                        const singleGroupMaxWidth = Math.max(...groupValues.map(g => ctx.measureText(g).width));
                        const combinedWidth = ctx.measureText(groupValues.join(' | ')).width;
                        currentMaxWidth = Math.max(currentMaxWidth, singleGroupMaxWidth, combinedWidth);
                    } else {
                        currentMaxWidth = Math.max(currentMaxWidth, ctx.measureText(label).width);
                    }
                } else {
                    currentMaxWidth = Math.max(currentMaxWidth, ctx.measureText(label).width);
                }
            });
            
            // Calculate available space per label
            const availableSpacePerLabel = 800 / labels.length;
            
            if (currentMaxWidth <= availableSpacePerLabel * 0.8 && labels.length <= 6) {
                optimalFontSize = fontSize;
                maxLabelWidth = currentMaxWidth;
                needsRotation = false;
                break;
            }
            
            if (currentMaxWidth <= availableSpacePerLabel * 1.2 || labels.length <= 8) {
                optimalFontSize = fontSize;
                maxLabelWidth = currentMaxWidth;
                needsRotation = true;
                break;
            }
        }
        
        // Calculate space needed for X-axis
        let xAxisHeight = 0;
        let xAxisWidth = 0;
        
        if (needsRotation) {
            // Rotated labels need more height - be more conservative
            xAxisHeight = Math.max(60, maxLabelWidth * Math.sin(Math.PI / 4) + 40);
            xAxisWidth = 0; // Width is determined by chart area
        } else {
            // Horizontal labels - account for multi-group stacking
            if (hasMultipleGroupBy) {
                // For multi-group horizontal labels, need more height for stacking
                const maxGroupCount = Math.max(...labels.map(label => {
                    const groupValues = label.split(/[,|]/).map(v => v.trim());
                    return groupValues.length;
                }));
                xAxisHeight = 40 + (maxGroupCount - 1) * 16; // Base height + line height for each additional group
            } else {
                xAxisHeight = 40;
            }
            
            // Calculate total width needed for all labels with proper spacing
            xAxisWidth = Math.max(maxLabelWidth * labels.length, labels.length * 60); // At least 60px per label
        }
        
        const xAxisSpace = {
            height: xAxisHeight,
            width: xAxisWidth,
            font: optimalFontSize,
            rotation: needsRotation,
            maxLabelWidth: maxLabelWidth
        };
        
        return xAxisSpace;
    }

    calculateYAxisSpaceRequirements(ctx, metrics) {
        // Calculate space for Y-axis labels and title
        ctx.font = '11px Arial';
        
        // Estimate Y-axis width based on typical value ranges - be more conservative
        const yAxisWidth = 80; // Space for Y-axis labels
        const yAxisTitleHeight = 30; // Space for Y-axis title
        
        const yAxisSpace = {
            width: yAxisWidth,
            titleHeight: yAxisTitleHeight
        };
        
        return yAxisSpace;
    }

    calculateChartAreaSpaceRequirements(groups, metrics) {
        // Calculate minimum space needed for chart elements - be more conservative
        let minChartWidth = 500;
        let minChartHeight = 350;
        
        // Adjust based on number of groups and metrics
        if (groups.length > 10) {
            minChartWidth = Math.max(minChartWidth, groups.length * 40);
        }
        
        if (metrics.length > 3) {
            minChartHeight = Math.max(minChartHeight, 450);
        }
        
        const chartAreaSpace = {
            minWidth: minChartWidth,
            minHeight: minChartHeight
        };
        
        return chartAreaSpace;
    }

    calculateLegendSpaceRequirements(ctx, metrics) {
        if (metrics.length === 0) {
            return { height: 0, width: 0 };
        }
        
        // Calculate legend space at top - be more conservative
        const legendHeight = 50;
        const legendWidth = metrics.length * 140; // Approximate width per metric
        
        const legendSpace = {
            height: legendHeight,
            width: legendWidth
        };
        
        return legendSpace;
    }

    calculateCanvasSizeWithAspectRatio(requirements, labels, metrics) {
        // Calculate minimum required space for each component
        const minYAxisWidth = 80;
        const minLegendHeight = 50;
        const minChartWidth = 400;
        const minChartHeight = 300;
        const padding = 40;
        
        // Calculate dynamic X-axis height based on label requirements
        const dynamicXAxisHeight = this.calculateRequiredBottomPadding(labels);
        
        // Calculate required width
        let requiredWidth = minYAxisWidth + minChartWidth + padding;
        
        // Add X-axis width for horizontal labels
        if (!requirements.xAxis.rotation && requirements.xAxis.width > 0) {
            requiredWidth = Math.max(requiredWidth, requirements.xAxis.width + padding);
        }
        
        // Calculate required height using dynamic X-axis height
        let requiredHeight = minLegendHeight + minChartHeight + dynamicXAxisHeight + padding;
        
        // Add extra height for many metrics (larger legend)
        if (metrics.length > 3) {
            requiredHeight += (metrics.length - 3) * 20;
        }
        
        // Add extra width for many groups
        if (labels.length > 8) {
            requiredWidth += (labels.length - 8) * 30;
        }
        
        // Ensure minimum aspect ratio (width should be at least 1.2x height)
        const minAspectRatio = 1.2;
        if (requiredWidth / requiredHeight < minAspectRatio) {
            requiredWidth = requiredHeight * minAspectRatio;
        }
        
        // Set reasonable maximums
        const maxWidth = 1600;
        const maxHeight = 1000;
        
        const finalWidth = Math.min(maxWidth, Math.max(800, requiredWidth));
        const finalHeight = Math.min(maxHeight, Math.max(600, requiredHeight));
        
        return {
            width: Math.round(finalWidth),
            height: Math.round(finalHeight),
            requirements: requirements
        };
    }

    calculateChartSpacing(width, height, groups, metrics) {
        // Calculate consistent spacing for all chart types
        const yAxisPadding = 80;
        const topPadding = 60; // Space for legend
        const rightPadding = 40;
        
        // Calculate dynamic bottom padding based on label requirements
        const bottomPadding = this.calculateRequiredBottomPadding(groups);
        
        const chartWidth = width - yAxisPadding - rightPadding;
        const chartHeight = height - topPadding - bottomPadding;
        
        return {
            yAxisPadding,
            topPadding,
            bottomPadding,
            rightPadding,
            chartWidth: Math.max(300, chartWidth),
            chartHeight: Math.max(200, chartHeight)
        };
    }

    calculateRequiredBottomPadding(groups) {
        // Base padding for X-axis labels
        let basePadding = 40;
        
        // Check if we have multiple group by dimensions
        const hasMultipleGroupBy = this.selectedDimensions.length > 1;
        
        if (hasMultipleGroupBy && groups.length > 0) {
            // Calculate maximum number of group values in any label
            const maxGroupCount = Math.max(...groups.map(group => {
                const groupValues = group.split(/[,|]/).map(v => v.trim());
                return groupValues.length;
            }));
            
            // Add extra height for stacked labels
            // Each additional group value needs 16px line height
            const extraHeight = (maxGroupCount - 1) * 16;
            basePadding += extraHeight;
        }
        
        // Add extra padding for rotated labels
        const spaceRequirements = this.calculateSpaceRequirements(groups, this.selectedMetrics, groups);
        if (spaceRequirements.xAxis.rotation) {
            basePadding += 20; // Extra space for rotated labels
        }
        
        // Ensure minimum padding
        return Math.max(60, basePadding);
    }

    renderLensChart() {
        const chartContainer = document.getElementById('lensChart');
        const tableContainer = document.getElementById('lensTable');
        
        if (this.selectedDimensions.length === 0 && this.selectedMetrics.length === 0) {
            chartContainer.innerHTML = '<div class="chart-placeholder"><p>Build your lens by dragging dimensions and metrics</p></div>';
            // Show all raw data rows when no categories are selected
            this.renderAllDataTable();
            return;
        }
        
        if (this.selectedMetrics.length === 0) {
            chartContainer.innerHTML = '<div class="chart-placeholder"><p>Add at least one metric to create a chart</p></div>';
            tableContainer.innerHTML = '<div class="table-placeholder"><p>Add at least one metric to create a table</p></div>';
            return;
        }
        
        // Generate data
        const chartData = this.generateChartData();
        
        // Calculate optimal canvas dimensions based on labels
        const canvasSize = this.calculateOptimalCanvasSize(chartData);
        
        // Render chart with maximum available width
        const containerRect = chartContainer.getBoundingClientRect();
        
        // Check if the field palette is collapsed to adjust width
        const fieldPalette = document.getElementById('fieldPalette');
        const isCollapsed = fieldPalette && fieldPalette.classList.contains('collapsed');
        
        // Calculate legend space needed (C3.js legend on right side)
        const totalLegendItems = this.selectedDimensions.length * this.selectedMetrics.length;
        const legendSpace = Math.max(120, totalLegendItems * 15); // Reserve space for legend
        
        // Debug: Log container dimensions
        console.log('Container dimensions before chart render:', {
            width: containerRect.width,
            height: containerRect.height,
            collapsed: isCollapsed,
            viewportWidth: window.innerWidth,
            availableWidth: isCollapsed ? (window.innerWidth - 32 - 40) : (containerRect.width - 20),
            legendSpace: legendSpace
        });
        
        // Get the actual available height by checking the current viewport and container position
        const viewportHeight = window.innerHeight;
        const containerTop = containerRect.top;
        let availableViewportHeight = viewportHeight - containerTop - 50; // Leave 50px for bottom margins
        
        // Check if drop zones are collapsed to adjust available height
        const dropZones = document.querySelector('.drop-zones');
        const anyDropZonesCollapsed = dropZones && Array.from(dropZones.querySelectorAll('.drop-zone')).some(zone => zone.classList.contains('collapsed'));
        
        if (anyDropZonesCollapsed) {
            // When drop zones are collapsed, they take up less space (30px each instead of ~74px)
            const dropZoneHeightSaved = 3 * (74 - 30); // 3 zones * 44px saved per zone
            availableViewportHeight += dropZoneHeightSaved;
            console.log('Drop zones collapsed - additional height available:', dropZoneHeightSaved);
        }
        
        // Check if this is a time series chart for extra height
        const hasTimestampDimension = this.selectedDimensions.some(dim => this.timestampDimensions.includes(dim));
        const isTimeSeries = this.chartType === 'line' && hasTimestampDimension;
        
        // Dynamic height and width calculation based on actual available space
        // Use more of the available height when drop zones are expanded
        const heightMultiplier = anyDropZonesCollapsed ? 0.8 : 0.9; // Use 90% when expanded, 80% when collapsed
        const baseHeight = Math.min(800, availableViewportHeight * heightMultiplier); // Increased max height and use more space
        let chartHeight, chartWidth;
        
        // Calculate available width based on collapsed state
        let availableWidth;
        if (isCollapsed) {
            // When collapsed, get the actual lens-area width instead of calculating manually
            const lensArea = document.querySelector('.lens-area');
            if (lensArea) {
                const lensAreaRect = lensArea.getBoundingClientRect();
                availableWidth = lensAreaRect.width - 20; // Use actual lens-area width minus margins
                console.log('Collapsed state - using actual lens-area width:', availableWidth, 'lens-area:', lensAreaRect.width);
            } else {
                // Fallback to viewport calculation
                availableWidth = window.innerWidth - 32 - 40;
                console.log('Collapsed state - fallback to viewport calculation:', availableWidth);
            }
        } else {
            // When expanded, use container width minus normal margins
            availableWidth = containerRect.width - 20;
            console.log('Expanded state - calculated available width:', availableWidth, 'container:', containerRect.width);
        }
        
        // Use expanded width if chart has been expanded
        if (this.chartExpandedWidth > 0) {
            // For expanded width, use the stored expanded width directly
            chartWidth = this.chartExpandedWidth - legendSpace - 40;
            console.log('Using stored expanded width:', chartWidth, 'total expanded:', this.chartExpandedWidth);
            
            // Keep the same height as calculated for normal width - don't recalculate
            // This preserves the original height when expanding width
        } else {
            if (isTimeSeries) {
                // For time series: calculate optimal dimensions based on available space
                const containerWidth = availableWidth - legendSpace - 40; // Account for additional margins/padding

                // Calculate optimal height based on available width and aspect ratio
                const optimalAspectRatio = 2.5; // Increased aspect ratio for better height utilization
                const maxHeightByWidth = containerWidth / optimalAspectRatio;
                // Use more of the viewport height - increased multipliers
                const viewportHeightMultiplier = anyDropZonesCollapsed ? 0.85 : 0.95; // Increased from 0.75/0.85
                const maxHeightByViewport = availableViewportHeight * viewportHeightMultiplier;

                chartHeight = Math.min(maxHeightByWidth, maxHeightByViewport, 800); // Increased max height from 700
                chartHeight = Math.max(chartHeight, 400); // Increased minimum height from 300

                chartWidth = containerWidth;
            } else {
                // For regular charts, use the calculated baseHeight which already accounts for drop zone state
                chartHeight = baseHeight;
                chartWidth = availableWidth - legendSpace - 40; // Account for additional margins/padding
            }
        }
        
        // Ensure canvas div height doesn't exceed parent container height
        // Use the calculated chartHeight directly, as it already accounts for available space
        const maxCanvasHeight = chartHeight;
        
        console.log('Final chart dimensions:', {
            chartWidth: chartWidth,
            chartHeight: chartHeight,
            maxCanvasHeight: maxCanvasHeight,
            isCollapsed: isCollapsed,
            legendSpace: legendSpace
        });
        
        chartContainer.innerHTML = '<div id="lensChartCanvas" style="width: ' + chartWidth + 'px; height: ' + maxCanvasHeight + 'px; min-height: ' + (isTimeSeries ? '300px' : '400px') + ';"></div>';
        
        this.createLensChart(chartData, maxCanvasHeight);
        
        // Render table
        this.renderLensTable(chartData);
    }

    renderLensTable(data) {
        const tableContainer = document.getElementById('lensTable');
        
        if (Object.keys(data.data).length === 0) {
            tableContainer.innerHTML = '<div class="table-placeholder"><p>No data to display</p></div>';
            return;
        }
        
        // For aggregated data, we need to analyze the actual columns in the data
        // since they might be different from the original dimensions/metrics
        if (data && data.data) {
            // Analyze column types based on the aggregated data
            console.log('=== RENDER LENS TABLE - AGGREGATED DATA ===');
            console.log('Data structure:', Object.keys(data.data));
            console.log('First group data:', data.data[Object.keys(data.data)[0]]);
            this.analyzeColumnTypes(data);
            console.log('Column types after analysis:', this.columnTypes);
        } else {
            // Use pre-determined column types for raw data
            console.log('=== RENDER LENS TABLE - RAW DATA ===');
            console.log('Pre-determined dimensions:', this.dimensions);
            console.log('Pre-determined metrics:', this.metrics);
            console.log('Pre-determined timestamp dimensions:', this.timestampDimensions);
            this.initializeColumnTypesIfNeeded();
            console.log('Column types after initialization:', this.columnTypes);
        }
        
        // Create table HTML
        let tableHTML = '<div class="table-wrapper"><table class="wave-table">';
        
        // Create header
        tableHTML += '<thead><tr>';
        this.selectedDimensions.forEach(dimension => {
            const sortIcon = this.getSortIcon(dimension);
            tableHTML += '<th class="sortable-header" data-column="' + dimension + '" data-type="dimension">' + 
                       this.formatHeader(dimension) + sortIcon + '</th>';
        });
        this.selectedMetrics.forEach(metricName => {
            const selectedAggregations = this.getMetricAggregations(metricName);
            selectedAggregations.forEach(aggregationType => {
                const aggregationLabel = this.getAggregationLabel(aggregationType);
                const key = metricName + '_' + aggregationType;
                const sortIcon = this.getSortIcon(key);
                tableHTML += '<th class="sortable-header" data-column="' + key + '" data-type="metric">' + 
                           this.formatHeader(metricName) + ' (' + aggregationLabel + ')' + sortIcon + '</th>';
            });
        });
        tableHTML += '</tr></thead>';
        
        // Create body
        tableHTML += '<tbody>';
        // Use sorted groups if available, otherwise use original order
        const groupsToRender = this.sortedGroups || Object.keys(data.data);
        groupsToRender.forEach(groupKey => {
            tableHTML += '<tr>';
            
            // Add dimension values
            if (this.selectedDimensions.length > 0) {
                const dimensionValues = groupKey.split(' | ');
                dimensionValues.forEach(value => {
                    tableHTML += '<td>' + this.formatValueForTable(value) + '</td>';
                });
            } else {
                tableHTML += '<td>All Data</td>';
            }
            
            // Add metric values
            this.selectedMetrics.forEach(metricName => {
                const selectedAggregations = this.getMetricAggregations(metricName);
                selectedAggregations.forEach(aggregationType => {
                    const key = metricName + '_' + aggregationType;
                    const value = data.data[groupKey][key] || 0;
                    tableHTML += '<td>' + this.formatValueForTable(value) + '</td>';
                });
            });
            
            tableHTML += '</tr>';
        });
        tableHTML += '</tbody></table></div>';
        
        tableContainer.innerHTML = tableHTML;
        
        // Add click event listeners to sortable headers
        this.addSortEventListeners();
    }

    renderAllDataTable() {
        const tableContainer = document.getElementById('lensTable');
        
        if (!this.filteredData || this.filteredData.length === 0) {
            tableContainer.innerHTML = '<div class="table-placeholder"><p>No data to display</p></div>';
            return;
        }

        // Dynamically set table container width to match lens-display width
        const lensDisplay = document.querySelector('.lens-display');
        if (lensDisplay) {
            const lensDisplayWidth = lensDisplay.getBoundingClientRect().width;
            tableContainer.style.width = lensDisplayWidth + 'px';
            tableContainer.style.maxWidth = lensDisplayWidth + 'px';
        }

        // Get all available columns from the first row
        const allColumns = Object.keys(this.filteredData[0] || {});
        
        // Use pre-determined column types instead of recalculating
        console.log('=== RENDER ALL DATA TABLE ===');
        console.log('Available columns:', allColumns);
        console.log('Pre-determined dimensions:', this.dimensions);
        console.log('Pre-determined metrics:', this.metrics);
        console.log('Pre-determined timestamp dimensions:', this.timestampDimensions);
        this.initializeColumnTypesIfNeeded();
        console.log('Column types after initialization:', this.columnTypes);
        
        // Create table HTML
        let tableHTML = '<div class="table-wrapper"><table class="wave-table">';
        
        // Create header
        tableHTML += '<thead><tr>';
        // Add ignore column header
        tableHTML += '<th class="ignore-header">Ignore</th>';
        allColumns.forEach(column => {
            const sortIcon = this.getSortIcon(column);
            tableHTML += '<th class="sortable-header" data-column="' + column + '" data-type="raw">' + 
                       this.formatHeader(column) + sortIcon + '</th>';
        });
        tableHTML += '</tr></thead>';
        
        // Create body with limited rows (max 100)
        const maxRows = 100;
        const totalRows = this.filteredData.length;
        const rowsToShow = Math.min(maxRows, totalRows);
        const hasMoreRows = totalRows > maxRows;
        
        tableHTML += '<tbody>';
        for (let index = 0; index < rowsToShow; index++) {
            const row = this.filteredData[index];
            const rowId = this.generateRowId(row, index);
            const isIgnored = this.ignoredRows.has(rowId);
            tableHTML += '<tr data-row-id="' + rowId + '">';
            
            // Add ignore checkbox column
            tableHTML += '<td class="ignore-cell">' +
                '<input type="checkbox" class="ignore-checkbox" ' + 
                (isIgnored ? 'checked' : '') + 
                ' data-row-id="' + rowId + '">' +
                '</td>';
            
            allColumns.forEach(column => {
                const value = row[column] || '';
                tableHTML += '<td>' + this.formatValueForTable(value) + '</td>';
            });
            tableHTML += '</tr>';
        }
        tableHTML += '</tbody></table>';
        
        // Add message if there are more rows
        if (hasMoreRows) {
            tableHTML += '<div class="table-more-rows-message">' +
                '<p><i class="fa fa-info-circle"></i> Showing first ' + maxRows + ' of ' + totalRows + ' rows. ' +
                'Use the "View all rows" option in the filters to see all data.</p>' +
                '</div>';
        }
        
        tableHTML += '</div>';
        
        tableContainer.innerHTML = tableHTML;
        
        // Add click event listeners to sortable headers
        this.addSortEventListeners();
        
        // Add event listeners to ignore checkboxes
        this.addIgnoreEventListeners();
    }

    generateRowId(row, index) {
        // Create a unique identifier for the row based on its content
        // This ensures the row can be identified even if the data is reordered
        const keyValues = [];
        
        // Use timestamp if available (most reliable identifier)
        if (row.timestamp) {
            keyValues.push('timestamp:' + row.timestamp);
        }
        
        // Use other identifying fields
        const identifyingFields = ['cell', 'instance', 'id', 'name'];
        identifyingFields.forEach(field => {
            if (row[field]) {
                keyValues.push(field + ':' + row[field]);
            }
        });
        
        // If no identifying fields, use all values to create a hash
        if (keyValues.length === 0) {
            const allValues = Object.values(row).join('|');
            keyValues.push('hash:' + this.simpleHash(allValues));
        }
        
        return keyValues.join('_');
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    addIgnoreEventListeners() {
        const checkboxes = document.querySelectorAll('.ignore-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const rowId = e.target.getAttribute('data-row-id');
                const isChecked = e.target.checked;
                
                if (isChecked) {
                    this.ignoredRows.add(rowId);
                } else {
                    this.ignoredRows.delete(rowId);
                }
                
                // Update filters zone to show/hide rows filter
                this.updateFiltersZone();
                
                // Update drop zone counts to reflect rows filter in header
                this.updateDropZoneCounts();
                
                // Re-render other views to reflect ignored rows
                this.renderLensChart();
            });
        });
    }

    showRowsPopup() {
        // Check if modal already exists and remove it
        const existingModal = document.querySelector('.rows-popup-overlay');
        if (existingModal) {
            document.body.removeChild(existingModal);
        }
        
        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay rows-popup-overlay';
        modalOverlay.innerHTML = 
            '<div class="modal-content rows-popup-content">' +
                '<div class="modal-header">' +
                    '<h3>All Rows (' + this.filteredData.length + ' total, ' + this.ignoredRows.size + ' ignored)</h3>' +
                    '<span class="modal-close">&times;</span>' +
                '</div>' +
                '<div class="modal-body">' +
                    '<div class="rows-popup-table-container">' +
                        '<div class="rows-popup-table-wrapper">' +
                            '<table class="wave-table rows-popup-table">' +
                                '<thead>' +
                                    '<tr>' +
                                        '<th class="ignore-header">Ignore</th>' +
                                        Object.keys(this.filteredData[0] || {}).map(col => 
                                            '<th class="sortable-header" data-column="' + col + '" data-type="raw">' +
                                                this.formatHeader(col) + this.getSortIcon(col) +
                                            '</th>'
                                        ).join('') +
                                    '</tr>' +
                                '</thead>' +
                                '<tbody>' +
                                    this.filteredData.map((row, index) => {
                                        const rowId = this.generateRowId(row, index);
                                        const isIgnored = this.ignoredRows.has(rowId);
                                        return '<tr class="' + (isIgnored ? 'ignored-row' : '') + '">' +
                                            '<td class="ignore-cell">' +
                                                '<input type="checkbox" class="ignore-checkbox" ' + 
                                                (isIgnored ? 'checked' : '') + 
                                                ' data-row-id="' + rowId + '">' +
                                            '</td>' +
                                            Object.values(row).map(value => 
                                                '<td>' + this.formatValueForTable(value) + '</td>'
                                            ).join('') +
                                        '</tr>';
                                    }).join('') +
                                '</tbody>' +
                            '</table>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="modal-footer">' +
                    '<button class="btn btn-secondary" id="closeRowsPopup">Close</button>' +
                '</div>' +
            '</div>';
        
        document.body.appendChild(modalOverlay);
        
        // Add event listeners
        const closeBtn = modalOverlay.querySelector('.modal-close');
        const closeFooterBtn = modalOverlay.querySelector('#closeRowsPopup');
        
        const closeModal = () => {
            document.body.removeChild(modalOverlay);
        };
        
        closeBtn.addEventListener('click', closeModal);
        closeFooterBtn.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
        
        // Add escape key listener
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        // Add event listeners for the table
        this.addRowsPopupEventListeners(modalOverlay);
    }

    updateRowsPopupTable(modalOverlay) {
        // Update the table content in the existing modal
        const tableContainer = modalOverlay.querySelector('.rows-popup-table-container');
        if (tableContainer) {
            tableContainer.innerHTML = 
                '<div class="rows-popup-table-wrapper">' +
                    '<table class="wave-table rows-popup-table">' +
                        '<thead>' +
                            '<tr>' +
                                '<th class="ignore-header">Ignore</th>' +
                                Object.keys(this.filteredData[0] || {}).map(col => 
                                    '<th class="sortable-header" data-column="' + col + '" data-type="raw">' +
                                        this.formatHeader(col) + this.getSortIcon(col) +
                                    '</th>'
                                ).join('') +
                            '</tr>' +
                        '</thead>' +
                        '<tbody>' +
                            this.filteredData.map((row, index) => {
                                const rowId = 'row_' + index;
                                const isIgnored = this.ignoredRows.has(rowId);
                                return '<tr class="' + (isIgnored ? 'ignored-row' : '') + '">' +
                                    '<td class="ignore-cell">' +
                                        '<input type="checkbox" class="ignore-checkbox" data-row-id="' + rowId + '"' + (isIgnored ? ' checked' : '') + '>' +
                                    '</td>' +
                                    Object.keys(row).map(col => 
                                        '<td>' + this.formatValueForTable(row[col]) + '</td>'
                                    ).join('') +
                                '</tr>';
                            }).join('') +
                        '</tbody>' +
                    '</table>' +
                '</div>';
            
            // Re-add event listeners for the updated table
            this.addRowsPopupEventListeners(modalOverlay);
        }
    }

    addRowsPopupEventListeners(modalOverlay) {
        // Remove existing event listeners to prevent duplicates
        modalOverlay.querySelectorAll('.sortable-header').forEach(header => {
            const newHeader = header.cloneNode(true);
            header.parentNode.replaceChild(newHeader, header);
        });
        
        // Add ignore checkbox event listeners
        modalOverlay.querySelectorAll('.ignore-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const rowId = e.target.getAttribute('data-row-id');
                const isChecked = e.target.checked;
                
                if (isChecked) {
                    this.ignoredRows.add(rowId);
                } else {
                    this.ignoredRows.delete(rowId);
                }
                
                // Update the row styling
                const row = e.target.closest('tr');
                if (isChecked) {
                    row.classList.add('ignored-row');
                } else {
                    row.classList.remove('ignored-row');
                }
                
                // Update filters zone and re-render
                this.updateFiltersZone();
                
                // Update drop zone counts to reflect rows filter in header
                this.updateDropZoneCounts();
                
                this.renderLensChart();
            });
        });
        
        // Add sort event listeners
        const sortableHeaders = modalOverlay.querySelectorAll('.sortable-header');
        //console.log('DEBUG: Adding event listeners to', sortableHeaders.length, 'sortable headers');
        sortableHeaders.forEach((header, index) => {
            console.log('DEBUG: Adding listener to header', index, ':', header.dataset.column);
            header.addEventListener('click', (e) => {
                //console.log('DEBUG: Sort header clicked');
                const column = e.target.closest('.sortable-header').dataset.column;
                const type = e.target.closest('.sortable-header').dataset.type;
                //console.log('DEBUG: Column:', column, 'Type:', type);
                this.sortTable(column, type);
                
                // Update the existing modal instead of creating a new one
                this.updateRowsPopupTable(modalOverlay);
            });
        });
    }

    getSortIcon(column) {
        if (this.sortColumn === column) {
            return this.sortDirection === 'asc' ? ' <span class="sort-icon">▲</span>' : ' <span class="sort-icon">▼</span>';
        }
        return ' <span class="sort-icon">⇅</span>';
    }

    addSortEventListeners() {
        const sortableHeaders = document.querySelectorAll('.sortable-header');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                const column = e.currentTarget.getAttribute('data-column');
                const type = e.currentTarget.getAttribute('data-type');
                this.sortTable(column, type);
            });
        });
    }

    sortTable(column, type) {
        //console.log('DEBUG: sortTable called with column:', column, 'type:', type);
        
        // Toggle sort direction if clicking the same column
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        console.log('Sort direction:', this.sortDirection);

        // Clear previous sorted groups
        this.sortedGroups = null;

        // Re-render the table with sorted data
        if (type === 'raw') {
            // For raw data table, sort the filtered data directly
            console.log('Calling sortRawData for raw data');
            this.sortRawData();
            this.renderAllDataTable();
        } else if (type === 'metric') {
            // For aggregated metric columns, sort the aggregated data
            console.log('Calling sortAggregatedMetricData for metric column');
            this.sortAggregatedMetricData();
            this.renderLensChart();
        } else {
            // For dimension columns, just re-render
            console.log('Re-rendering chart for dimension column');
            this.renderLensChart();
        }
    }

    // Initialize column types using pre-determined data structure analysis
    initializeColumnTypesIfNeeded() {
        if (this.columnTypes && Object.keys(this.columnTypes).length > 0) {
            // Column types already initialized, no need to recalculate
            return;
        }
        
        this.columnTypes = {};
        
        // First, use the pre-determined dimensions, metrics, and timestamp dimensions
        // from the initial data structure analysis
        if (this.dimensions && this.dimensions.length > 0) {
            this.dimensions.forEach(dimension => {
                if (this.timestampDimensions.includes(dimension)) {
                    this.columnTypes[dimension] = 'timestamp';
                } else {
                    this.columnTypes[dimension] = 'dimension';
                }
            });
        }
        
        if (this.metrics && this.metrics.length > 0) {
            this.metrics.forEach(metric => {
                this.columnTypes[metric] = 'metric';
            });
        }
        
        // For any additional columns that might exist in the data but weren't
        // in the original dimensions/metrics, analyze them from the actual data
        if (this.filteredData && this.filteredData.length > 0) {
            const allColumns = Object.keys(this.filteredData[0] || {});
            const sampleSize = Math.min(10, this.filteredData.length);
            const sampleData = this.filteredData.slice(0, sampleSize);
            
            console.log('Additional columns to analyze:', allColumns);
            console.log('Already classified columns:', Object.keys(this.columnTypes));
            
            allColumns.forEach(column => {
                // Only analyze columns that weren't already classified
                if (!this.columnTypes[column]) {
                    const values = sampleData.map(row => row[column]).filter(val => 
                        val !== null && val !== undefined && val !== ''
                    );
                    if (values.length > 0) {
                        const detectedType = this.detectValueType(values[0]);
                        this.columnTypes[column] = detectedType;
                        console.log(`Additional column '${column}': sample_value='${values[0]}', type='${detectedType}'`);
                    }
                } else {
                    console.log(`Column '${column}' already classified as: ${this.columnTypes[column]}`);
                }
            });
        }
        
        console.log('Column types initialized from pre-determined structure and data analysis:', this.columnTypes);
    }

    // Analyze column data types when table is loaded (kept for backward compatibility)
    analyzeColumnTypes(data) {
        console.log('=== ANALYZE COLUMN TYPES ===');
        this.columnTypes = {};
        
        if (data && data.data) {
            // For aggregated data, analyze the first group's values
            const firstGroup = Object.keys(data.data)[0];
            console.log('Analyzing aggregated data, first group:', firstGroup);
            if (firstGroup && data.data[firstGroup]) {
                const groupColumns = Object.keys(data.data[firstGroup]);
                console.log('Group columns:', groupColumns);
                groupColumns.forEach(column => {
                    const value = data.data[firstGroup][column];
                    const detectedType = this.detectValueType(value);
                    this.columnTypes[column] = detectedType;
                    console.log(`Column '${column}': value='${value}', type='${detectedType}'`);
                });
            }
        } else if (this.filteredData && this.filteredData.length > 0) {
            // For raw data, analyze sample values
            const sampleSize = Math.min(10, this.filteredData.length);
            const sampleData = this.filteredData.slice(0, sampleSize);
            console.log('Analyzing raw data, sample size:', sampleSize);
            
            const allColumns = Object.keys(sampleData[0] || {});
            console.log('All columns in raw data:', allColumns);
            allColumns.forEach(column => {
                const values = sampleData.map(row => row[column]).filter(val => 
                    val !== null && val !== undefined && val !== ''
                );
                if (values.length > 0) {
                    const detectedType = this.detectValueType(values[0]);
                    this.columnTypes[column] = detectedType;
                    console.log(`Column '${column}': sample_value='${values[0]}', type='${detectedType}'`);
                }
            });
        }
        
        console.log('Final column types detected:', this.columnTypes);
    }

    // Safe parseFloat wrapper that only converts pure numeric strings
    safeParseFloat(value) {
        if (value === null || value === undefined || value === '') {
            return NaN;
        }
        
        const strValue = String(value).trim();
        const isPureNumber = /^-?\d+(\.\d+)?$/.test(strValue);
        
        if (isPureNumber) {
            const num = parseFloat(strValue);
            return !isNaN(num) && isFinite(num) ? num : NaN;
        }
        
        return NaN;
    }

    // Detect the type of a single value
    detectValueType(value) {
        if (value === null || value === undefined || value === '') {
            return 'string';
        }
        
        // Check if it's a timestamp
        if (this.timestampDimensions.some(dim => value.toString().includes(dim))) {
            return 'timestamp';
        }
        
        // Check if it's a valid number using safe parseFloat
        const num = this.safeParseFloat(value);
        if (!isNaN(num)) {
            return Number.isInteger(num) ? 'integer' : 'float';
        }
        
        // Default to string
        return 'string';
    }

    sortRawData() {
        if (!this.sortColumn) return;

        // Check if this is an aggregated metric column (contains '_')
        if (this.sortColumn.includes('_')) {
            // This is an aggregated metric column, sort the chart data instead
            this.sortAggregatedMetricData();
            return;
        }

        const columnType = this.columnTypes[this.sortColumn] || 'string';
        console.log('Sorting column:', this.sortColumn, 'as type:', columnType);

        this.filteredData.sort((a, b) => {
            let valueA = a[this.sortColumn];
            let valueB = b[this.sortColumn];

            // Handle null/undefined values
            if (valueA === null || valueA === undefined) valueA = '';
            if (valueB === null || valueB === undefined) valueB = '';

            // Sort based on detected column type
            switch (columnType) {
                case 'timestamp':
                    const timestampA = this.parseTimestamp(valueA);
                    const timestampB = this.parseTimestamp(valueB);
                    if (!isNaN(timestampA) && !isNaN(timestampB)) {
                        valueA = timestampA;
                        valueB = timestampB;
                    } else {
                        valueA = String(valueA);
                        valueB = String(valueB);
                    }
                    break;
                    
                case 'integer':
                    valueA = parseInt(valueA) || 0;
                    valueB = parseInt(valueB) || 0;
                    break;
                    
                case 'float':
                    valueA = parseFloat(valueA) || 0;
                    valueB = parseFloat(valueB) || 0;
                    break;
                    
                case 'string':
                default:
                    valueA = String(valueA).toLowerCase();
                    valueB = String(valueB).toLowerCase();
                    break;
            }

            if (valueA < valueB) {
                return this.sortDirection === 'asc' ? -1 : 1;
            } else if (valueA > valueB) {
                return this.sortDirection === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }

    sortAggregatedMetricData() {
        if (!this.sortColumn) {
            console.log('No sort column set for aggregated metric data');
            return;
        }

        const columnType = this.columnTypes[this.sortColumn] || 'float';
        console.log('Sorting aggregated metric data for column:', this.sortColumn, 'as type:', columnType);
        console.log('Available column types:', this.columnTypes);

        // Generate chart data to get the aggregated values
        const chartData = this.generateChartData();
        if (!chartData || !chartData.data) {
            console.log('No chart data available for sorting');
            return;
        }

        console.log('Chart data groups:', Object.keys(chartData.data));
        console.log('First group data:', chartData.data[Object.keys(chartData.data)[0]]);

        // Convert chart data to array for sorting
        const dataArray = Object.keys(chartData.data).map(group => ({
            group: group,
            value: chartData.data[group][this.sortColumn] || 0
        }));

        console.log('Data array before sorting:', dataArray);

        // Sort the data array
        dataArray.sort((a, b) => {
            let valueA = a.value;
            let valueB = b.value;

            // Handle null/undefined values
            if (valueA === null || valueA === undefined) valueA = 0;
            if (valueB === null || valueB === undefined) valueB = 0;

            // Sort based on detected column type
            switch (columnType) {
                case 'timestamp':
                    const timestampA = this.parseTimestamp(valueA);
                    const timestampB = this.parseTimestamp(valueB);
                    if (!isNaN(timestampA) && !isNaN(timestampB)) {
                        valueA = timestampA;
                        valueB = timestampB;
                    } else {
                        valueA = String(valueA);
                        valueB = String(valueB);
                    }
                    break;
                    
                case 'integer':
                    valueA = parseInt(valueA) || 0;
                    valueB = parseInt(valueB) || 0;
                    break;
                    
                case 'float':
                    valueA = parseFloat(valueA) || 0;
                    valueB = parseFloat(valueB) || 0;
                    break;
                    
                case 'string':
                default:
                    valueA = String(valueA).toLowerCase();
                    valueB = String(valueB).toLowerCase();
                    break;
            }

            if (valueA < valueB) {
                return this.sortDirection === 'asc' ? -1 : 1;
            } else if (valueA > valueB) {
                return this.sortDirection === 'asc' ? 1 : -1;
            }
            return 0;
        });

        // Store the sorted order for rendering
        this.sortedGroups = dataArray.map(item => item.group);
        console.log('Data array after sorting:', dataArray);
        console.log('Sorted groups:', this.sortedGroups);
    }

    generateChartData() {
        const data = {};
        
        // Filter out ignored rows
        const activeData = this.filteredData.filter((row, index) => {
            const rowId = this.generateRowId(row, index);
            return !this.ignoredRows.has(rowId);
        });
        
        activeData.forEach(row => {
            // Create grouping key based on selected dimensions
            let groupKey = '';
            if (this.selectedDimensions.length > 0) {
                groupKey = this.selectedDimensions.map(dim => row[dim] || 'Unknown').join(' | ');
            } else {
                groupKey = 'All Data';
            }
            
            if (!data[groupKey]) {
                data[groupKey] = {};
            }
            
            // Aggregate metrics
            this.selectedMetrics.forEach(metricName => {
                if (!data[groupKey][metricName]) {
                    data[groupKey][metricName] = [];
                }
                const value = parseFloat(row[metricName]);
                if (!isNaN(value)) {
                    data[groupKey][metricName].push(value);
                }
            });
        });
        
        // Calculate aggregations for each metric
        const processedData = {};
        Object.keys(data).forEach(group => {
            processedData[group] = {};
            this.selectedMetrics.forEach(metricName => {
                const values = data[group][metricName];
                const selectedAggregations = this.getMetricAggregations(metricName);
                
                if (values.length > 0) {
                    // Create a separate entry for each selected aggregation
                    selectedAggregations.forEach(aggregationType => {
                        const key = metricName + '_' + aggregationType;
                        processedData[group][key] = this.calculateAggregation(values, aggregationType);
                    });
                } else {
                    // Create entries with 0 for each selected aggregation
                    selectedAggregations.forEach(aggregationType => {
                        const key = metricName + '_' + aggregationType;
                        processedData[group][key] = 0;
                    });
                }
            });
        });
        
        // Sort data if a sort column is selected
        if (this.sortColumn) {
            const sortedEntries = Object.entries(processedData).sort((a, b) => {
                let valueA, valueB;
                
                if (this.selectedDimensions.includes(this.sortColumn)) {
                    // Sort by dimension value (first part of group key)
                    const dimensionIndex = this.selectedDimensions.indexOf(this.sortColumn);
                    valueA = a[0].split(' | ')[dimensionIndex] || '';
                    valueB = b[0].split(' | ')[dimensionIndex] || '';
                    
                    // Check if this is a timestamp column
                    if (this.timestampDimensions.includes(this.sortColumn)) {
                        // Parse as timestamps for proper chronological sorting
                        const timestampA = this.parseTimestamp(valueA);
                        const timestampB = this.parseTimestamp(valueB);
                        if (!isNaN(timestampA) && !isNaN(timestampB)) {
                            valueA = timestampA;
                            valueB = timestampB;
                        }
                    } else {
                        // Try to parse as numbers for numeric sorting
                        const numA = parseFloat(valueA);
                        const numB = parseFloat(valueB);
                        if (!isNaN(numA) && !isNaN(numB)) {
                            valueA = numA;
                            valueB = numB;
                        }
                    }
                } else if (this.selectedMetrics.includes(this.sortColumn)) {
                    // Sort by metric value
                    valueA = a[1][this.sortColumn] || 0;
                    valueB = b[1][this.sortColumn] || 0;
                } else {
                    return 0;
                }
                
                if (valueA < valueB) {
                    return this.sortDirection === 'asc' ? -1 : 1;
                } else if (valueA > valueB) {
                    return this.sortDirection === 'asc' ? 1 : -1;
                }
                return 0;
            });
            
            // Rebuild the sorted data object
            const sortedData = {};
            const sortedLabels = [];
            sortedEntries.forEach(([key, value]) => {
                sortedData[key] = value;
                sortedLabels.push(key);
            });
            
            return {
                data: sortedData,
                labels: sortedLabels
            };
        }
        
        // Get the labels (group keys) for X-axis
        const labels = Object.keys(processedData);
        
        return {
            data: processedData,
            labels: labels
        };
    }

    calculateAggregation(values, aggregationType) {
        const sortedValues = [...values].sort((a, b) => a - b);
        
        switch (aggregationType) {
            case 'sum':
                return values.reduce((a, b) => a + b, 0);
            case 'count':
                return values.length;
            case 'average':
                return values.reduce((a, b) => a + b, 0) / values.length;
            case 'median':
                const mid = Math.floor(sortedValues.length / 2);
                return sortedValues.length % 2 === 0 
                    ? (sortedValues[mid - 1] + sortedValues[mid]) / 2 
                    : sortedValues[mid];
            case 'p50':
                return this.calculatePercentile(sortedValues, 50);
            case 'p90':
                return this.calculatePercentile(sortedValues, 90);
            case 'p95':
                return this.calculatePercentile(sortedValues, 95);
            case 'max':
                return Math.max(...values);
            case 'min':
                return Math.min(...values);
            default:
                return values.reduce((a, b) => a + b, 0) / values.length; // Default to average
        }
    }

    calculatePercentile(sortedValues, percentile) {
        if (sortedValues.length === 0) return 0;
        if (sortedValues.length === 1) return sortedValues[0];
        
        const index = (percentile / 100) * (sortedValues.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index % 1;
        
        if (upper >= sortedValues.length) return sortedValues[sortedValues.length - 1];
        if (lower === upper) return sortedValues[lower];
        
        return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
    }

    getAggregationLabel(aggregationType) {
        const labels = {
            'sum': 'Sum',
            'count': 'Count',
            'average': 'Avg',
            'median': 'Median',
            'p50': 'P50',
            'p90': 'P90',
            'p95': 'P95',
            'max': 'Max',
            'min': 'Min'
        };
        return labels[aggregationType] || 'Sum';
    }

    getYAxisTitle() {
        if (this.selectedMetrics.length === 0) {
            return 'Value';
        }
        
        // Collect all aggregations from all metrics
        const allAggregations = [];
        this.selectedMetrics.forEach(metricName => {
            const selectedAggregations = this.getMetricAggregations(metricName);
            allAggregations.push(...selectedAggregations);
        });
        
        const uniqueAggregations = [...new Set(allAggregations)];
        
        if (uniqueAggregations.length === 1) {
            return 'Value (' + this.getAggregationLabel(uniqueAggregations[0]) + ')';
        } else if (uniqueAggregations.length <= 3) {
            const labels = uniqueAggregations.map(agg => this.getAggregationLabel(agg));
            return 'Value (' + labels.join(', ') + ')';
        } else {
            return 'Value (Mixed)';
        }
    }

    showDateTimeFilter(dimensionName) {
        // Check if filter already exists
        if (document.getElementById('dateTimeFilter_' + dimensionName)) {
            return;
        }
        
        const filterContainer = document.createElement('div');
        filterContainer.id = 'dateTimeFilter_' + dimensionName;
        filterContainer.className = 'date-time-filter';
        filterContainer.innerHTML = 
            '<div class="filter-header">' +
                '<h4>Date/Time Filter: ' + this.formatHeader(dimensionName) + '</h4>' +
                '<button class="close-filter" onclick="waveAnalytics.hideDateTimeFilter(\'' + dimensionName + '\')">×</button>' +
            '</div>' +
            '<div class="filter-options">' +
                '<div class="filter-type">' +
                    '<label><input type="radio" name="filterType_' + dimensionName + '" value="relative" checked> Relative</label>' +
                    '<label><input type="radio" name="filterType_' + dimensionName + '" value="absolute"> Absolute</label>' +
                '</div>' +
                '<div class="relative-options" id="relative_' + dimensionName + '">' +
                    '<select id="relativePeriod_' + dimensionName + '">' +
                        '<option value="last_hour">Last Hour</option>' +
                        '<option value="last_24h">Last 24 Hours</option>' +
                        '<option value="last_7d" selected>Last 7 Days</option>' +
                        '<option value="last_30d">Last 30 Days</option>' +
                        '<option value="last_90d">Last 90 Days</option>' +
                    '</select>' +
                '</div>' +
                '<div class="absolute-options" id="absolute_' + dimensionName + '" style="display: none;">' +
                    '<div class="date-range">' +
                        '<label>From:</label>' +
                        '<input type="datetime-local" id="fromDate_' + dimensionName + '">' +
                    '</div>' +
                    '<div class="date-range">' +
                        '<label>To:</label>' +
                        '<input type="datetime-local" id="toDate_' + dimensionName + '">' +
                    '</div>' +
                '</div>' +
                '<div class="filter-actions">' +
                    '<button class="apply-filter" onclick="waveAnalytics.applyDateTimeFilter(\'' + dimensionName + '\')">Apply Filter</button>' +
                    '<button class="clear-filter" onclick="waveAnalytics.clearDateTimeFilter(\'' + dimensionName + '\')">Clear</button>' +
                '</div>' +
            '</div>';
        
        // Insert after the lens builder
        const lensBuilder = document.querySelector('.lens-builder');
        lensBuilder.parentNode.insertBefore(filterContainer, lensBuilder.nextSibling);
        
        // Add event listeners for filter type change
        const filterTypeRadios = filterContainer.querySelectorAll('input[name="filterType_' + dimensionName + '"]');
        filterTypeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const relativeDiv = document.getElementById('relative_' + dimensionName);
                const absoluteDiv = document.getElementById('absolute_' + dimensionName);
                
                if (radio.value === 'relative') {
                    relativeDiv.style.display = 'block';
                    absoluteDiv.style.display = 'none';
                } else {
                    relativeDiv.style.display = 'none';
                    absoluteDiv.style.display = 'block';
                }
            });
        });
    }

    hideDateTimeFilter(dimensionName) {
        const filterElement = document.getElementById('dateTimeFilter_' + dimensionName);
        if (filterElement) {
            filterElement.remove();
        }
        delete this.dateTimeFilters[dimensionName];
    }

    removeExistingTimestampFilters() {
        // Remove any existing timestamp filter elements
        const existingFilters = document.querySelectorAll('[id^="dateTimeFilter_"]');
        existingFilters.forEach(filter => filter.remove());
    }

    applyDateTimeFilter(dimensionName) {
        const filterType = document.querySelector('input[name="filterType_' + dimensionName + '"]:checked').value;
        
        if (filterType === 'relative') {
            const period = document.getElementById('relativePeriod_' + dimensionName).value;
            this.dateTimeFilters[dimensionName] = { type: 'relative', period: period };
        } else {
            const fromDate = document.getElementById('fromDate_' + dimensionName).value;
            const toDate = document.getElementById('toDate_' + dimensionName).value;
            this.dateTimeFilters[dimensionName] = { type: 'absolute', from: fromDate, to: toDate };
        }
        
        this.applyFilters();
    }

    clearDateTimeFilter(dimensionName) {
        delete this.dateTimeFilters[dimensionName];
        this.applyFilters();
    }

    createLensChart(data, chartHeight) {
        // Check if we have a timestamp dimension in group by for time series
        const hasTimestampDimension = this.selectedDimensions.some(dim => this.timestampDimensions.includes(dim));
        
        if (this.chartType === 'line') {
            if (hasTimestampDimension) {
                this.createC3TimeSeriesChart(data.data, chartHeight);
            } else {
                this.createC3LineChart(data.data, chartHeight);
            }
        } else {
            this.createC3BarChart(data.data, chartHeight);
        }
    }

    // C3.js-based chart functions
    createC3LineChart(data, chartHeight) {
        let groups = Object.keys(data);
        const metrics = this.selectedMetrics;
        
        if (groups.length === 0 || metrics.length === 0) {
            return;
        }
        
        // Sort groups by dimension order if multiple dimensions are present
        if (this.selectedDimensions.length > 1) {
            groups = this.sortGroupsByDimensions(groups);
        }
        
        // Prepare data for C3.js with proper grouping
        const columns = [];
        const colors = {};
        const colorPalette = ['#0070d2', '#00a1e0', '#4bca81', '#ffb75d', '#ff6b6b', '#4ecdc4', '#9b59b6', '#e74c3c', '#f39c12', '#2ecc71'];
        let colorIndex = 0;
        
        // Generate columns for each metric+aggregation combination
        metrics.forEach(metricName => {
            const selectedAggregations = this.getMetricAggregations(metricName);
            selectedAggregations.forEach(aggregationType => {
                const key = metricName + '_' + aggregationType;
                const columnId = key;
                const values = [columnId];
                
                // Add values for each group
                groups.forEach(group => {
                    const value = data[group] ? data[group][key] : null;
                    values.push(value !== null && value !== undefined ? parseFloat(value) : 0);
                });
                
                columns.push(values);
                colors[columnId] = colorPalette[colorIndex % colorPalette.length];
                colorIndex++;
            });
        });
        
        // Calculate optimal dimensions for line chart
        const containerWidth = document.getElementById('lensChartCanvas').offsetWidth;
        const containerHeight = document.getElementById('lensChartCanvas').offsetHeight;
        const totalLegendItems = groups.length * metrics.length;
        
        // Optimized legend width calculation
        const baseLegendWidth = totalLegendItems * 7;
        const maxLegendWidth = containerWidth * 0.1;
        const legendWidth = Math.max(80, Math.min(maxLegendWidth, baseLegendWidth));
        const legendPadding = Math.max(100, legendWidth + 10);
        
        // Create C3.js line chart using working pattern from filter-panel.ftl
        try {
            // Ensure C3.js is available
            if (typeof c3 === 'undefined') {
                console.error('C3.js is not available. Please ensure C3.js is loaded.');
                return;
            }
            
            // Validate data before creating chart
            if (!columns || columns.length === 0) {
                console.error('No data columns available for line chart');
                return;
            }
            
            // Ensure the container exists and is empty
            const container = document.getElementById('lensChartCanvas');
            if (!container) {
                console.error('Chart container not found');
                return;
            }
            
            // Clear any existing content
            container.innerHTML = '';
            
            // Create C3.js line chart with proper grouping and styling
            const chart = c3.generate({
                bindto: '#lensChartCanvas',
                size: {
                    width: containerWidth,
                    height: chartHeight || containerHeight
                },
                data: {
                    columns: columns,
                    type: 'line',
                    colors: colors,
                    labels: {
                        format: function (v) {
                            return v.toFixed(2);
                        }
                    }
                },
                point: {
                    show: true,
                    r: 2.5
                },
                axis: {
                    x: {
                        type: 'category',
                        categories: groups,
                        show: true,
                        tick: {
                            format: function(x) {
                                // Return empty string to hide original labels
                                return '';
                            }
                        }
                    },
                    y: {
                        label: {
                            text: metrics.join(', '),
                            position: 'outer-middle'
                        }
                    }
                },
                grid: {
                    y: {
                        lines: [
                            {
                                value: 0, 
                                text: '', 
                                class: 'zero-line',
                                style: 'stroke: #999; stroke-width: 1px; stroke-dasharray: 8,4;'
                            }
                        ]
                    }
                },
                tooltip: {
                    format: {
                        title: function (d) { return groups[d]; },
                        value: function (value, ratio, id) {
                            return value.toFixed(2);
                        }
                    }
                },
                padding: {
                    top: 20,
                    bottom: 40
                },
                legend: {
                    show: true,
                    position: 'right'
                }
            });
            
            // Add custom stacked labels after chart generation
            setTimeout(() => {
                this.addStackedLabels(groups);
            }, 100);
        } catch (error) {
            console.error('C3.js line chart error:', error);
            // Show error message to user
            const container = document.getElementById('lensChartCanvas');
            if (container) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: #d32f2f;">Error creating line chart. Please check console for details.</div>';
            }
        }
    }

    createC3BarChart(data, chartHeight) {
        let groups = Object.keys(data);
        const metrics = this.selectedMetrics;
        
        if (groups.length === 0 || metrics.length === 0) {
            return;
        }
        
        // Sort groups by dimension order if multiple dimensions are present
        if (this.selectedDimensions.length > 1) {
            groups = this.sortGroupsByDimensions(groups);
        }
        
        // Prepare data for C3.js with proper grouping
        const columns = [];
        const colors = {};
        const colorPalette = ['#0070d2', '#00a1e0', '#4bca81', '#ffb75d', '#ff6b6b', '#4ecdc4', '#9b59b6', '#e74c3c', '#f39c12', '#2ecc71'];
        let colorIndex = 0;
        
        // Generate columns for each metric+aggregation combination
        metrics.forEach(metricName => {
            const selectedAggregations = this.getMetricAggregations(metricName);
            selectedAggregations.forEach(aggregationType => {
                const key = metricName + '_' + aggregationType;
                const columnId = key;
                const values = [columnId];
                
                // Add values for each group
                groups.forEach(group => {
                    const value = data[group] ? data[group][key] : null;
                    values.push(value !== null && value !== undefined ? parseFloat(value) : 0);
                });
                
                columns.push(values);
                colors[columnId] = colorPalette[colorIndex % colorPalette.length];
                colorIndex++;
            });
        });
        
        // Calculate optimal dimensions for bar chart
        const containerWidth = document.getElementById('lensChartCanvas').offsetWidth;
        const containerHeight = document.getElementById('lensChartCanvas').offsetHeight;
        const totalLegendItems = groups.length * metrics.length;
        
        // Determine if we should show value labels based on number of bars
        const totalBars = groups.length * metrics.length;
        const maxBarsForLabels = 50; // Hide labels if more than 50 bars
        const showValueLabels = totalBars <= maxBarsForLabels;
        
        // Optimized legend width calculation
        const baseLegendWidth = totalLegendItems * 7;
        const maxLegendWidth = containerWidth * 0.1;
        const legendWidth = Math.max(80, Math.min(maxLegendWidth, baseLegendWidth));
        const legendPadding = Math.max(100, legendWidth + 10);
        
        // Create C3.js bar chart using working pattern from filter-panel.ftl
        try {
            // Ensure C3.js is available
            if (typeof c3 === 'undefined') {
                console.error('C3.js is not available. Please ensure C3.js is loaded.');
                return;
            }
            
            // Validate data before creating chart
            if (!columns || columns.length === 0) {
                console.error('No data columns available for bar chart');
                return;
            }
            
            // Ensure the container exists and is empty
            const container = document.getElementById('lensChartCanvas');
            if (!container) {
                console.error('Chart container not found');
                return;
            }
            
            // Clear any existing content
            container.innerHTML = '';
            
            // Create C3.js bar chart with proper grouping and styling
            const self = this; // Capture reference to this for use in C3.js callbacks
            const chart = c3.generate({
                bindto: '#lensChartCanvas',
                size: {
                    height: chartHeight || 400
                },
                data: {
                    columns: columns,
                    type: 'bar',
                    colors: colors,
                    labels: showValueLabels ? {
                        format: function (v) {
                            return v.toFixed(2);
                        }
                    } : false
                },
                axis: {
                    x: {
                        type: 'category',
                        categories: groups.map(group => self.formatGroupKeyForDisplay(group)), // Format multi-dimensional group keys
                        show: true,
                        tick: showValueLabels ? {
                            format: function(x) {
                                // Return empty string to hide original labels when showing custom labels
                                return '';
                            }
                        } : {
                            // Use default C3 tick formatting when not showing custom labels
                            rotate: -45,
                            multiline: false
                        }
                    },
                    y: {
                        label: {
                            text: metrics.join(', '),
                            position: 'outer-middle'
                        }
                    }
                },
                grid: {
                    y: {
                        lines: [
                            {
                                value: 0, 
                                text: '', 
                                class: 'zero-line',
                                style: 'stroke: #999; stroke-width: 1px; stroke-dasharray: 8,4;'
                            }
                        ]
                    }
                },
                bar: {
                    width: {
                        ratio: 0.8
                    }
                },
                tooltip: {
                    format: {
                        title: function (d) { return self.formatGroupKeyForTooltip(groups[d]); },
                        value: function (value, ratio, id) {
                            return value.toFixed(2);
                        }
                    }
                },
                padding: {
                    top: 20,
                    bottom: 40
                },
                legend: {
                    show: true,
                    position: 'right'
                }
            });
            
            // Add custom stacked labels after chart generation only if showing custom labels
            if (showValueLabels) {
                setTimeout(() => {
                    this.addStackedLabels(groups);
                }, 100);
            }
        } catch (error) {
            console.error('C3.js bar chart error:', error);
            // Show error message to user
            const container = document.getElementById('lensChartCanvas');
            if (container) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: #d32f2f;">Error creating bar chart. Please check console for details.</div>';
            }
        }
    }

    createC3TimeSeriesChart(data, chartHeight) {
        const timestampDimension = this.selectedDimensions.find(dim => this.timestampDimensions.includes(dim));
        
        if (!timestampDimension) {
            this.createC3LineChart(data, chartHeight);
            return;
        }
        
        // Generate time series data from raw data
        const timeSeriesData = this.generateTimeSeriesData();
        
        if (Object.keys(timeSeriesData).length === 0) {
            this.createC3LineChart(data, chartHeight);
            return;
        }
        
        // Sort data by timestamp
        const sortedData = this.sortDataByTimestamp(timeSeriesData, timestampDimension);
        const timestamps = Object.keys(sortedData);
        const groupCombinations = this.getGroupCombinations(sortedData);
        
        if (timestamps.length === 0 || groupCombinations.length === 0) {
            return;
        }
        
        // Prepare data for C3.js timeseries - using separate x and y columns
        const columns = [];
        const colors = {};
        const colorPalette = ['#0070d2', '#00a1e0', '#4bca81', '#ffb75d', '#ff6b6b', '#4ecdc4', '#9b59b6', '#e74c3c', '#f39c12', '#2ecc71'];
        let colorIndex = 0;
        
        // First, create x column with all valid timestamps
        const xColumnId = 'x';
        const xValues = [xColumnId];
        const validTimestamps = [];
        
        timestamps.forEach(timestamp => {
            const parsedTimestamp = this.parseTimestamp(timestamp);
            if (parsedTimestamp && !isNaN(parsedTimestamp) && parsedTimestamp > 0) {
                xValues.push(parsedTimestamp);
                validTimestamps.push(timestamp);
            }
        });
        
        if (xValues.length > 1) {
            columns.push(xValues);
            console.log('Created x column with', xValues.length - 1, 'timestamps');
        }
        
        // Generate y columns for each group+metric+aggregation combination
        groupCombinations.forEach(group => {
            this.selectedMetrics.forEach(metricName => {
                const selectedAggregations = this.getMetricAggregations(metricName);
                selectedAggregations.forEach(aggregationType => {
                    const key = metricName + '_' + aggregationType;
                    const columnId = group + '_' + key;
                    const values = [columnId];
                    
                    // Add values for each valid timestamp (aligned with x column)
                    let hasValidData = false;
                    validTimestamps.forEach(timestamp => {
                        // Safety check for data structure
                        if (sortedData[timestamp] && sortedData[timestamp][group]) {
                            const value = sortedData[timestamp][group][key];
                            if (value !== null && value !== undefined && !isNaN(value)) {
                                values.push(value);
                                hasValidData = true;
                            } else {
                                values.push(null); // Keep alignment with x column
                            }
                        } else {
                            values.push(null); // Keep alignment with x column
                        }
                    });
                    
                    // Only add column if it has valid data points
                    if (hasValidData && values.length > 1) {
                        columns.push(values);
                        colors[columnId] = colorPalette[colorIndex % colorPalette.length];
                        colorIndex++;
                        console.log('Added y column:', columnId, 'with', values.length - 1, 'values');
                    } else {
                        console.log('Skipped y column:', columnId, 'hasValidData:', hasValidData, 'values.length:', values.length);
                    }
                });
            });
        });
        
        // Debug: Check columns data
        //console.log('Time series columns:', columns);
        //console.log('Time series colors:', colors);
        //console.log('Sample sortedData:', Object.keys(sortedData).slice(0, 3).map(key => ({ timestamp: key, data: sortedData[key] })));
        
        // Debug each column to see its structure
        columns.forEach((column, index) => {
           // console.log('Column ' + index + ':', column[0], 'has', column.length - 1, 'data points');
            if (column.length > 1) {
                console.log('First data point:', column[1]);
                console.log('Last data point:', column[column.length - 1]);
            }
        });
        
        // Check if we have any data and validate columns
        if (columns.length === 0) {
            console.log('No data columns generated for time series chart');
            return;
        }
        
        // Final validation: ensure all columns have data points
        const validColumns = columns.filter(column => {
            if (column.length <= 1) {
                console.warn('Removing empty column:', column[0]);
                return false;
            }
            return true;
        });
        
        if (validColumns.length === 0) {
            console.log('No valid data columns after validation');
            return;
        }
        
        console.log('Using', validColumns.length, 'valid columns out of', columns.length, 'total');
        
        // Final debug: Check what we're passing to C3.js
        //console.log('Final validColumns being passed to C3.js:', validColumns);
        validColumns.forEach((column, index) => {
            //console.log('Final column ' + index + ':', column[0], 'length:', column.length);
            if (column.length > 1) {
                //console.log('  First data point:', column[1]);
                //console.log('  Second data point:', column[2]);
                //console.log('  Last data point:', column[column.length - 1]);
                // Check if data points are arrays
                if (Array.isArray(column[1])) {
                    //console.log('  Data points are arrays (good for timeseries)');
                } else {
                    //console.log('  Data points are NOT arrays (problem for timeseries)');
                }
            }
        });
        
        // Calculate optimal legend positioning based on available space
        const totalLegendItems = groupCombinations.length * this.selectedMetrics.length;
        const containerWidth = document.getElementById('lensChartCanvas').offsetWidth;
        const containerHeight = document.getElementById('lensChartCanvas').offsetHeight;
        
        // Calculate dynamic tick culling based on chart width
        const maxTicks = Math.max(5, Math.floor(containerWidth / 80));
        console.log('Time series chart - containerWidth:', containerWidth, 'maxTicks:', maxTicks);
        
        // Force maximum chart width - ultra-minimal legend space
        const baseLegendWidth = totalLegendItems * 2; // Ultra-compact legend
        const maxLegendWidth = containerWidth * 0.015; // Only 1.5% of container width for legend
        const legendWidth = Math.max(30, Math.min(maxLegendWidth, baseLegendWidth));
        
        // Calculate optimal padding based on container dimensions
        const aspectRatio = containerWidth / containerHeight;
        const isWideChart = aspectRatio > 2.0;
        
        // Force maximum chart area with ultra-minimal legend
        const legendPadding = isWideChart ? 
            Math.max(40, legendWidth + 0) : // No extra padding for wide charts
            Math.max(50, legendWidth + 1); // Minimal padding for square charts
        
        // Create C3.js time series chart using working pattern from filter-panel.ftl
        try {
            // Ensure C3.js is available
            if (typeof c3 === 'undefined') {
                console.error('C3.js is not available. Please ensure C3.js is loaded.');
                return;
            }
            
            // Validate data before creating chart
            if (!columns || columns.length === 0) {
                console.error('No data columns available for time series chart');
                return;
            }
            
            // Ensure the container exists and is empty
            const container = document.getElementById('lensChartCanvas');
            if (!container) {
                console.error('Chart container not found');
                return;
            }
            
            // Clear any existing content
            container.innerHTML = '';
            
            // Determine if we should show points and labels based on data density
        const maxPointsForLabels = 20; // Hide labels when more than 20 points
        const maxPointsForPoints = 50; // Hide points when more than 50 points
        const shouldShowLabels = timestamps.length <= maxPointsForLabels;
        const shouldShowPoints = timestamps.length <= maxPointsForPoints;
        
        // Create C3.js time series chart with proper grouping and styling
        try {
            console.log('Attempting to create C3.js chart with data:', {
                columns: validColumns,
                colors: colors,
                type: 'line'
            });
            
            
            const chart = c3.generate({
            bindto: '#lensChartCanvas',
            size: {
                height: chartHeight || 400
            },
            data: {
                x: 'x', // Specify which column contains x-axis data
                columns: validColumns,
                type: 'line',
                colors: colors,
                labels: shouldShowLabels ? {
                    format: function (v) {
                        return v !== null ? v.toFixed(2) : '';
                    }
                } : false
            },
            line: {
                connectNull: true
            },
            point: {
                show: shouldShowPoints,
                r: 2.5
            },
                axis: {
                    x: {
                        type: 'timeseries',
                        show: true,
                        tick: {
                            format: '%m-%d %H:%M:%S', // C3.js native time format
                            rotate: -45, // Rotate labels to prevent overlapping
                            multiline: false
                            // count removed to allow auto tick count
                        }
                    },
                    y: {
                        label: {
                            text: this.selectedMetrics.join(', '),
                            position: 'outer-middle'
                        }
                    }
                },
                grid: {
                    y: {
                        lines: [
                            {
                                value: 0, 
                                text: '', 
                                class: 'zero-line',
                                style: 'stroke: #999; stroke-width: 1px; stroke-dasharray: 8,4;'
                            }
                        ]
                    }
                },
                tooltip: {
                    format: {
                        title: function (d) { 
                            // For timeseries, d is the timestamp value
                            const date = new Date(d);
                            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                        },
                        value: function (value, ratio, id) {
                            return value !== null ? value.toFixed(2) : 'N/A';
                        }
                    }
                },
                padding: {
                    top: 20,
                    bottom: 40
                },
                legend: {
                    show: true,
                    position: 'right'
                }
            });
            
            console.log('C3.js chart created successfully');
            
        } catch (error) {
            console.error('C3.js time series chart error:', error);
            console.error('Error details:', error.message, error.stack);
            // Show error message to user
            const container = document.getElementById('lensChartCanvas');
            if (container) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: #d32f2f;">Error creating time series chart. Please check console for details.</div>';
            }
        }
        } catch (error) {
            console.error('C3.js time series chart setup error:', error);
            // Show error message to user
            const container = document.getElementById('lensChartCanvas');
            if (container) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: #d32f2f;">Error setting up time series chart. Please check console for details.</div>';
            }
        }
    }

    // Sort groups by dimension order
    sortGroupsByDimensions(groups) {
        return groups.sort((a, b) => {
            const partsA = a.split('|').map(part => part.trim());
            const partsB = b.split('|').map(part => part.trim());
            
            // Compare each dimension in order
            for (let i = 0; i < Math.min(partsA.length, partsB.length, this.selectedDimensions.length); i++) {
                const comparison = partsA[i].localeCompare(partsB[i]);
                if (comparison !== 0) {
                    return comparison;
                }
            }
            
            // If all dimensions are equal, maintain original order
            return 0;
        });
    }

    // Custom function to add stacked labels
    addStackedLabels(groups) {
        const container = document.getElementById('lensChartCanvas');
        if (!container) return;
        
        // Remove existing custom labels
        const existingLabels = container.querySelectorAll('.custom-stacked-label');
        existingLabels.forEach(label => label.remove());
        
        // Get the chart SVG
        const svg = container.querySelector('svg');
        if (!svg) return;
        
        // Get actual chart area dimensions from C3.js
        const chartArea = svg.querySelector('.c3-chart');
        if (!chartArea) return;
        
        const chartRect = chartArea.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        
        // Calculate relative positions within the SVG
        const chartLeft = chartRect.left - svgRect.left;
        const chartRight = chartRect.right - svgRect.left;
        const chartWidth = chartRight - chartLeft;
        
        // For bar charts, we need N+1 ticks for N bars
        const numTicks = groups.length + 1;
        const tickSpacing = chartWidth / (numTicks - 1);
        
        const tickPositions = [];
        for (let i = 0; i < numTicks; i++) {
            tickPositions.push({
                x: chartLeft + (i * tickSpacing),
                y: chartRect.bottom - svgRect.top // Actual x-axis position
            });
        }
        
        // Debug logging
        //console.log('Groups: ' + groups.length + ', Calculated ticks: ' + tickPositions.length);
        
        // Calculate the shift amount to center labels on bars
        let tickShift = 0;
        let availableWidth = 0;
        if (tickPositions.length > 1) {
            // For bar charts, we need to shift labels to the right to center them on bars
            // The bars are positioned between ticks, so we shift by half the tick distance
            tickShift = (tickPositions[1].x - tickPositions[0].x) / 2;
            availableWidth = tickPositions[1].x - tickPositions[0].x; // Available width between ticks
            console.log('Tick shift calculated: ' + tickShift + ', Available width: ' + availableWidth);
        }
        
        // Position all labels at the center of each bar
        groups.forEach((group, index) => {
            const parts = group.split('|').map(part => part.trim());
            
            console.log('Processing group ' + index + ' of ' + groups.length + ': "' + group + '"');
            
            // Process all groups - each bar is between two ticks
            if (index < groups.length) {
                let x, y;
                
                if (index + 1 < tickPositions.length) {
                    // Position labels at the center between current tick and next tick (where the bar is)
                    const currentTick = tickPositions[index];
                    const nextTick = tickPositions[index + 1];
                    x = (currentTick.x + nextTick.x) / 2; // Center between ticks
                    y = currentTick.y;
                    console.log('Group ' + index + ' - between tick[' + index + ']=' + currentTick.x + ' and tick[' + (index + 1) + ']=' + nextTick.x + ', midpoint=' + x);
                } else {
                    // For the last bar, position between the last two ticks
                    const prevTick = tickPositions[tickPositions.length - 2];
                    const lastTick = tickPositions[tickPositions.length - 1];
                    x = (prevTick.x + lastTick.x) / 2; // Center between last two ticks
                    y = prevTick.y;
                    console.log('Group ' + index + ' - between tick[' + (tickPositions.length - 2) + ']=' + prevTick.x + ' and tick[' + (tickPositions.length - 1) + ']=' + lastTick.x + ', midpoint=' + x);
                }
                
                // Create stacked labels at the bottom of the chart
                // Get the chart height to position labels at the bottom
                const svgHeight = parseFloat(svg.getAttribute('height') || 0);
                
                
                parts.forEach((part, partIndex) => {
                    // Convert timestamp to readable date string if it's a timestamp
                    let displayText = part;
                    if (this.isTimestamp(part)) {
                        displayText = this.formatTimestampForDisplay(part);
                    }
                    
                    // Truncate text based on available width
                    const truncatedText = this.truncateTextForWidth(displayText, availableWidth, 11); // 11px font size
                    
                    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    label.setAttribute('x', x);
                    label.setAttribute('y', svgHeight - 60 + (partIndex * 14)); // Top element at svgHeight - 60, then move down
                    label.setAttribute('text-anchor', 'middle');
                    label.setAttribute('class', 'custom-stacked-label');
                    label.setAttribute('style', 'font-size: 11px; fill: #333; text-anchor: middle;');
                    label.textContent = truncatedText;
                    
                    svg.appendChild(label);
                    console.log('Created label for group ' + index + ', part ' + partIndex + ': "' + truncatedText + '" (original: "' + part + '", display: "' + displayText + '") at x=' + x + ', y=' + (svgHeight - 60 + (partIndex * 14)) + ', availableWidth=' + availableWidth);
                });
            } else {
                console.log('Skipping group ' + index + ' - no corresponding tick position');
            }
        });
        
        // Hide original x-axis tick labels
        const xAxis = svg.querySelector('.c3-axis-x');
        if (xAxis) {
            const tickTexts = xAxis.querySelectorAll('.tick text');
            tickTexts.forEach(text => {
                text.style.display = 'none';
            });
        }
    }

    // Helper function to truncate text based on available width
    truncateTextForWidth(text, availableWidth, fontSize) {
        if (!text || availableWidth <= 0) return text;
        
        // Use a very generous character width estimate (0.4 * fontSize) to maximize text display
        const charWidth = fontSize * 0.4;
        const maxChars = Math.floor(availableWidth / charWidth);
        
        // If text fits, return as is
        if (text.length <= maxChars) {
            return text;
        }
        
        // If we need to truncate, leave space for "..." (3 characters)
        // But be more generous - only truncate if we really need to
        const truncateAt = Math.max(1, maxChars - 3);
        return text.substring(0, truncateAt) + '...';
    }
    
    // Helper function to check if a value is a timestamp
    isTimestamp(value) {
        if (typeof value === 'number') {
            // Check if it's a reasonable timestamp (between 1970 and 2100)
            return value > 0 && value < 4102444800000; // Jan 1, 2100
        }
        
        if (typeof value === 'string') {
            // Check if it's a numeric string that could be a timestamp
            const numericValue = this.safeParseFloat(value);
            return !isNaN(numericValue) && numericValue > 0 && numericValue < 4102444800000;
        }
        
        return false;
    }
    
    // Helper function to format timestamp for display
    formatTimestampForDisplay(timestamp) {
        const parsedTimestamp = this.parseTimestamp(timestamp);
        if (isNaN(parsedTimestamp)) {
            return timestamp; // Return original if can't parse
        }
        
        const date = new Date(parsedTimestamp);
        // Format as MM/DD/YYYY for compact display
        return date.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
        });
    }

    createTimeSeriesChart(ctx, data, width, height) {
        ctx.clearRect(0, 0, width, height);
        
        const timestampDimension = this.selectedDimensions.find(dim => this.timestampDimensions.includes(dim));
        
        if (!timestampDimension) {
            this.createLineChart(ctx, data, width, height);
            return;
        }
        
        // Generate time series data from raw data
        const timeSeriesData = this.generateTimeSeriesData();
        
        if (Object.keys(timeSeriesData).length === 0) {
            this.createLineChart(ctx, data, width, height);
            return;
        }
        
        // Sort data by timestamp
        const sortedData = this.sortDataByTimestamp(timeSeriesData, timestampDimension);
        
        // Generate colors for group+metric combinations
        const groupCombinations = this.getGroupCombinations(sortedData);
        const colors = this.generateColorsForGroupMetricCombinations(groupCombinations);
        
        // Calculate legend width needed
        const legendWidth = this.calculateLegendWidth(groupCombinations, this.selectedMetrics);
        
        // Use consistent spacing approach with legend space reserved
        const spacing = this.calculateChartSpacing(width - legendWidth, height, groupCombinations, this.selectedMetrics);
        
        const chartWidth = spacing.chartWidth;
        const chartHeight = spacing.chartHeight;
        const yAxisPadding = spacing.yAxisPadding;
        const topPadding = spacing.topPadding;
        const bottomPadding = spacing.bottomPadding;
        const rightPadding = spacing.rightPadding;
        
        // Draw legend on the right side
        this.drawTimeSeriesLegendRight(ctx, groupCombinations, colors, width, height, legendWidth);
        
        // Draw axes with normal top padding (no legend adjustment needed)
        this.drawTimeSeriesAxes(ctx, yAxisPadding, topPadding, chartWidth, chartHeight, sortedData, timestampDimension);
        
        // Draw time series lines for each group combination
        this.drawTimeSeriesLines(ctx, sortedData, groupCombinations, colors, yAxisPadding, topPadding, chartWidth, chartHeight);
    }

    sortDataByTimestamp(data, timestampDimension) {
        const sortedEntries = Object.entries(data).sort((a, b) => {
            const timeA = this.parseTimestamp(a[0]);
            const timeB = this.parseTimestamp(b[0]);
            return timeA - timeB;
        });
        
        return Object.fromEntries(sortedEntries);
    }

    parseTimestamp(timestamp) {
        // Handle various timestamp formats
        if (typeof timestamp === 'number') {
            // If it's already a number, return it as-is (it's already in milliseconds)
            return timestamp;
        }
        
        // Try to parse as a number first (in case it's a string representation of epoch)
        const numericTimestamp = this.safeParseFloat(timestamp);
        if (!isNaN(numericTimestamp)) {
            return numericTimestamp;
        }
        
        // Try to parse as a date string
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? 0 : date.getTime();
    }

    generateTimeSeriesData() {
        const timeSeriesData = {};
        const timestampDimension = this.selectedDimensions.find(dim => this.timestampDimensions.includes(dim));
        
        if (!timestampDimension) {
            return timeSeriesData;
        }
        
        // Group data by timestamp and then by group combinations
        this.filteredData.forEach(row => {
            const timestamp = row[timestampDimension];
            if (!timestamp) return;
            
            // Create group combination key (excluding timestamp dimension)
            const nonTimestampDimensions = this.selectedDimensions.filter(dim => dim !== timestampDimension);
            let groupKey = '';
            if (nonTimestampDimensions.length > 0) {
                groupKey = nonTimestampDimensions.map(dim => row[dim] || 'Unknown').join(' | ');
            } else {
                groupKey = 'All Data';
            }
            
            // Initialize timestamp entry if not exists
            if (!timeSeriesData[timestamp]) {
                timeSeriesData[timestamp] = {};
            }
            
            // Initialize group combination if not exists
            if (!timeSeriesData[timestamp][groupKey]) {
                timeSeriesData[timestamp][groupKey] = {};
            }
            
            // Aggregate metrics for this timestamp and group combination
            this.selectedMetrics.forEach(metricName => {
                if (!timeSeriesData[timestamp][groupKey][metricName]) {
                    timeSeriesData[timestamp][groupKey][metricName] = [];
                }
                const value = parseFloat(row[metricName]);
                if (!isNaN(value)) {
                    timeSeriesData[timestamp][groupKey][metricName].push(value);
                }
            });
        });
        
        // Calculate aggregations for each metric in each group combination
        const processedData = {};
        Object.keys(timeSeriesData).forEach(timestamp => {
            processedData[timestamp] = {};
            Object.keys(timeSeriesData[timestamp]).forEach(groupKey => {
                processedData[timestamp][groupKey] = {};
                this.selectedMetrics.forEach(metricName => {
                    const values = timeSeriesData[timestamp][groupKey][metricName];
                    if (values && values.length > 0) {
                        const selectedAggregations = this.getMetricAggregations(metricName);
                        selectedAggregations.forEach(aggregationType => {
                            const key = metricName + '_' + aggregationType;
                            processedData[timestamp][groupKey][key] = this.calculateAggregation(values, aggregationType);
                        });
                    }
                });
            });
        });
        
        return processedData;
    }

    getGroupCombinations(data) {
        // Extract unique group combinations from the data
        const combinations = new Set();
        Object.keys(data).forEach(timestamp => {
            Object.keys(data[timestamp]).forEach(group => {
                combinations.add(group);
            });
        });
        return Array.from(combinations);
    }

    generateColorsForGroups(groups) {
        const baseColors = ['#0070d2', '#00a1e0', '#4bca81', '#ffb75d', '#ff6b6b', '#4ecdc4', '#9b59b6', '#e74c3c', '#f39c12', '#2ecc71'];
        const colors = {};
        
        groups.forEach((group, index) => {
            colors[group] = baseColors[index % baseColors.length];
        });
        
        return colors;
    }

    generateColorsForGroupMetricCombinations(groups) {
        const baseColors = ['#0070d2', '#00a1e0', '#4bca81', '#ffb75d', '#ff6b6b', '#4ecdc4', '#9b59b6', '#e74c3c', '#f39c12', '#2ecc71', '#1abc9c', '#e67e22', '#34495e', '#8e44ad', '#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
        const colors = {};
        let colorIndex = 0;
        
        // Generate unique colors for each group+metric+aggregation combination
        groups.forEach((group) => {
            this.selectedMetrics.forEach((metricName) => {
                const selectedAggregations = this.getMetricAggregations(metricName);
                selectedAggregations.forEach(aggregationType => {
                    const key = metricName + '_' + aggregationType;
                    const combinationKey = group + '_' + key;
                    colors[combinationKey] = baseColors[colorIndex % baseColors.length];
                    colorIndex++;
                });
            });
        });
        
        return colors;
    }

    drawTimeSeriesLegend(ctx, groupCombinations, colors, width, topPadding) {
        const legendY = 15;
        const legendItemHeight = 18;
        const metricHeaderHeight = 22;
        const groupIndent = 20;
        const metricColumnWidth = 300; // Increased from 200 to 300
        const legendPadding = 20;
        
        // Group legend items by metric
        const metricGroups = {};
        groupCombinations.forEach((group) => {
            this.selectedMetrics.forEach((metricName) => {
                if (!metricGroups[metricName]) {
                    metricGroups[metricName] = [];
                }
                metricGroups[metricName].push(group);
            });
        });
        
        const metrics = Object.keys(metricGroups);
        let maxHeight = 0;
        
        // Calculate total legend width needed
        const totalLegendWidth = metrics.length * metricColumnWidth;
        const availableWidth = width - (legendPadding * 2);
        
        // Determine if we need to scroll or if we can fit all metrics
        let legendStartX;
        if (totalLegendWidth <= availableWidth) {
            // Center the legend if it fits
            legendStartX = (width - totalLegendWidth) / 2;
        } else {
            // Right-align the legend with scroll capability
            legendStartX = width - totalLegendWidth - legendPadding;
        }
        
        // Draw each metric and aggregation combination
        let metricIndex = 0;
        metrics.forEach((metricName) => {
            const selectedAggregations = this.getMetricAggregations(metricName);
            selectedAggregations.forEach(aggregationType => {
                const x = legendStartX + (metricIndex * metricColumnWidth);
                let y = legendY;
                
                // Draw metric header with aggregation
                ctx.fillStyle = '#333';
                ctx.font = 'bold 12px Arial';
                const headerText = this.formatHeader(metricName) + ' (' + this.getAggregationLabel(aggregationType) + ')';
                ctx.fillText(headerText, x, y);
                y += metricHeaderHeight;
                
                // Draw groups under this metric+aggregation
                groupCombinations.forEach((group) => {
                    const key = metricName + '_' + aggregationType;
                    const combinationKey = group + '_' + key;
                    
                    // Draw color indicator
                    ctx.fillStyle = colors[combinationKey];
                    ctx.fillRect(x + groupIndent, y - 8, 12, 12);
                    
                    // Draw group label
                    ctx.fillStyle = '#666';
                    ctx.font = '11px Arial';
                    const label = this.formatHeader(group);
                    ctx.fillText(label, x + groupIndent + 16, y + 4);
                    
                    y += legendItemHeight;
                });
                
                // Track the maximum height needed
                maxHeight = Math.max(maxHeight, y - legendY);
                metricIndex++;
            });
        });
        
        // Return the actual legend height used
        return maxHeight + 20;
    }

    calculateLegendWidth(groupCombinations, selectedMetrics) {
        // Group legend items by metric
        const metricGroups = {};
        groupCombinations.forEach((group) => {
            selectedMetrics.forEach((metric) => {
                if (!metricGroups[metric]) {
                    metricGroups[metric] = [];
                }
                metricGroups[metric].push(group);
            });
        });
        
        const metrics = Object.keys(metricGroups);
        const legendItemHeight = 18;
        const metricHeaderHeight = 22;
        const metricSpacing = 30;
        
        // Calculate total height needed for vertical stacking
        let totalHeight = 0;
        metrics.forEach((metric) => {
            const groups = metricGroups[metric];
            totalHeight += metricHeaderHeight + (groups.length * legendItemHeight) + metricSpacing;
        });
        
        // For right-side legend, we need a fixed width (not based on number of metrics)
        const legendColumnWidth = 400; // Increased width for right-side legend to avoid truncation
        const legendPadding = 40; // Extra padding for right side
        
        return legendColumnWidth + legendPadding;
    }

    drawTimeSeriesLegendRight(ctx, groupCombinations, colors, width, height, legendWidth) {
        const legendStartX = width - legendWidth + 20;
        const legendY = 20;
        const legendItemHeight = 18;
        const metricHeaderHeight = 22;
        const groupIndent = 20;
        const metricSpacing = 30; // Space between metrics when stacked vertically
        
        // Group legend items by metric
        const metricGroups = {};
        groupCombinations.forEach((group) => {
            this.selectedMetrics.forEach((metricName) => {
                if (!metricGroups[metricName]) {
                    metricGroups[metricName] = [];
                }
                metricGroups[metricName].push(group);
            });
        });
        
        const metrics = Object.keys(metricGroups);
        let currentY = legendY;
        
        // Draw each metric and aggregation combination stacked vertically
        metrics.forEach((metricName) => {
            const selectedAggregations = this.getMetricAggregations(metricName);
            selectedAggregations.forEach(aggregationType => {
                const x = legendStartX;
                let y = currentY;
                
                // Draw metric header with aggregation
                ctx.fillStyle = '#333';
                ctx.font = 'bold 12px Arial';
                const headerText = this.formatHeader(metricName) + ' (' + this.getAggregationLabel(aggregationType) + ')';
                ctx.fillText(headerText, x, y);
                y += metricHeaderHeight;
                
                // Draw groups under this metric+aggregation
                groupCombinations.forEach((group) => {
                    const key = metricName + '_' + aggregationType;
                    const combinationKey = group + '_' + key;
                    
                    // Draw color indicator
                    ctx.fillStyle = colors[combinationKey];
                    ctx.fillRect(x + groupIndent, y - 8, 12, 12);
                    
                    // Draw group label
                    ctx.fillStyle = '#666';
                    ctx.font = '11px Arial';
                    const label = this.formatHeader(group);
                    ctx.fillText(label, x + groupIndent + 16, y + 4);
                    
                    y += legendItemHeight;
                });
                
                // Move to next metric+aggregation position (stacked vertically)
                currentY = y + metricSpacing;
            });
        });
    }

    calculateBarChartLegendWidth(metrics) {
        // For bar chart, we have a simple list of metrics (no groups)
        const legendItemHeight = 18;
        const metricSpacing = 10;
        const legendColumnWidth = 200; // Fixed width for bar chart legend
        const legendPadding = 40; // Extra padding for right side
        
        return legendColumnWidth + legendPadding;
    }

    calculateLineChartLegendWidth(metrics) {
        // For line chart, we have a simple list of metrics (no groups)
        const legendItemHeight = 18;
        const metricSpacing = 10;
        const legendColumnWidth = 200; // Fixed width for line chart legend
        const legendPadding = 40; // Extra padding for right side
        
        return legendColumnWidth + legendPadding;
    }

    drawBarChartLegendRight(ctx, metrics, colors, width, height, legendWidth) {
        const legendStartX = width - legendWidth + 20;
        const legendY = 20;
        const legendItemHeight = 18;
        const metricSpacing = 10;
        let index = 0;
        
        // Draw each metric and aggregation combination stacked vertically
        metrics.forEach((metricName) => {
            const selectedAggregations = this.getMetricAggregations(metricName);
            selectedAggregations.forEach(aggregationType => {
                const y = legendY + index * (legendItemHeight + metricSpacing);
                const key = metricName + '_' + aggregationType;
                
                // Draw color indicator
                ctx.fillStyle = colors[key];
                ctx.fillRect(legendStartX, y - 8, 12, 12);
                
                // Draw metric label with aggregation
                ctx.fillStyle = '#333';
                ctx.font = '11px Arial';
                ctx.textAlign = 'left';
                const label = this.formatHeader(metricName) + ' (' + this.getAggregationLabel(aggregationType) + ')';
                ctx.fillText(label, legendStartX + 16, y + 4);
                
                index++;
            });
        });
    }

    drawLineChartLegendRight(ctx, metrics, colors, width, height, legendWidth) {
        const legendStartX = width - legendWidth + 20;
        const legendY = 20;
        const legendItemHeight = 18;
        const metricSpacing = 10;
        
        // Draw each metric and aggregation combination stacked vertically
        let index = 0;
        metrics.forEach((metricName) => {
            const selectedAggregations = this.getMetricAggregations(metricName);
            selectedAggregations.forEach(aggregationType => {
                const y = legendY + index * (legendItemHeight + metricSpacing);
                const key = metricName + '_' + aggregationType;
                
                // Draw color indicator (line style for line chart)
                ctx.strokeStyle = colors[key];
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(legendStartX, y);
                ctx.lineTo(legendStartX + 12, y);
                ctx.stroke();
                
                // Draw metric label with aggregation
                ctx.fillStyle = '#333';
                ctx.font = '11px Arial';
                ctx.textAlign = 'left';
                const label = this.formatHeader(metricName) + ' (' + this.getAggregationLabel(aggregationType) + ')';
                ctx.fillText(label, legendStartX + 16, y + 4);
                
                index++;
            });
        });
    }

    drawTimeSeriesAxes(ctx, padding, topPadding, chartWidth, chartHeight, data, timestampDimension) {
        // Y-axis
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, topPadding);
        ctx.lineTo(padding, topPadding + chartHeight);
        ctx.stroke();
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(padding, topPadding + chartHeight);
        ctx.lineTo(padding + chartWidth, topPadding + chartHeight);
        ctx.stroke();
        
        // X-axis labels (timestamps)
        const timeLabels = this.generateTimeLabels(data, timestampDimension);
        this.drawXAxisLabels(ctx, timeLabels, padding, topPadding, chartWidth, chartHeight);
        
        // Draw Y-axis title
        ctx.save();
        ctx.translate(15, topPadding + chartHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#333';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        const yAxisTitle = this.getYAxisTitle();
        ctx.fillText(yAxisTitle, 0, 0);
        ctx.restore();
        
        ctx.textAlign = 'left';
    }

    generateTimeLabels(data, timestampDimension) {
        const timestamps = Object.keys(data);
        const labels = [];
        
        timestamps.forEach((timestamp, index) => {
            if (index % Math.ceil(timestamps.length / 8) === 0 || index === timestamps.length - 1) {
                const date = new Date(this.parseTimestamp(timestamp));
                labels.push(date.toLocaleDateString() + ' ' + date.toLocaleTimeString().slice(0, 5));
            }
        });
        
        return labels;
    }

    drawTimeSeriesLines(ctx, data, groupCombinations, colors, padding, topPadding, chartWidth, chartHeight) {
        const timestamps = Object.keys(data);
        const allValues = [];
        
        // Collect all values for scaling across all group combinations and metrics
        timestamps.forEach(timestamp => {
            groupCombinations.forEach(group => {
        this.selectedMetrics.forEach(metricName => {
            const selectedAggregations = this.getMetricAggregations(metricName);
            selectedAggregations.forEach(aggregationType => {
                        const key = metricName + '_' + aggregationType;
                        const value = data[timestamp][group] && data[timestamp][group][key];
                        if (value !== undefined && value !== null) {
                            allValues.push(value);
                        }
                    });
                });
            });
        });
        
        const minValue = Math.min(...allValues);
        const maxValue = Math.max(...allValues);
        const valueRange = maxValue - minValue;
        
            // Draw lines for each group combination and metric+aggregation
            groupCombinations.forEach(group => {
        this.selectedMetrics.forEach(metricName => {
            const selectedAggregations = this.getMetricAggregations(metricName);
            selectedAggregations.forEach(aggregationType => {
                        const key = metricName + '_' + aggregationType;
                        const combinationKey = group + '_' + key;
                        ctx.strokeStyle = colors[combinationKey];
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        
                        let firstPoint = true;
                        let hasValidPoints = false;
                        timestamps.forEach((timestamp, index) => {
                            const value = data[timestamp][group] && data[timestamp][group][key];
                            if (value !== undefined && value !== null) {
                                const x = timestamps.length === 1 ? 
                                    padding + chartWidth / 2 : 
                                    padding + (index * (chartWidth / (timestamps.length - 1)));
                                const y = topPadding + chartHeight - ((value - minValue) / valueRange) * chartHeight;
                                
                                if (firstPoint) {
                                    ctx.moveTo(x, y);
                                    firstPoint = false;
                                    hasValidPoints = true;
                                } else {
                                    ctx.lineTo(x, y);
                                }
                            }
                        });
            
                        // Only draw line if there are multiple points
                        if (hasValidPoints && timestamps.length > 1) {
                            ctx.stroke();
                        }
                        
                        // Draw data points
                        timestamps.forEach((timestamp, index) => {
                            const value = data[timestamp][group] && data[timestamp][group][key];
                            if (value !== undefined && value !== null) {
                                const x = timestamps.length === 1 ? 
                                    padding + chartWidth / 2 : 
                                    padding + (index * (chartWidth / (timestamps.length - 1)));
                                const y = topPadding + chartHeight - ((value - minValue) / valueRange) * chartHeight;
                                
                                ctx.fillStyle = colors[combinationKey];
                                ctx.beginPath();
                                ctx.arc(x, y, 3, 0, 2 * Math.PI);
                                ctx.fill();
                        
                                // Draw value labels
                                ctx.fillStyle = '#333';
                                ctx.font = '10px Arial';
                                ctx.textAlign = 'center';
                                ctx.fillText(this.formatValue(value), x, y - 8);
                            }
                        });
                    });
                });
            });
        
        ctx.textAlign = 'left';
    }

    drawXAxisLabels(ctx, labels, padding, topPadding, chartWidth, chartHeight) {
        if (labels.length === 0) return;
        
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        
        // Calculate label spacing - handle single label case
        const labelSpacing = labels.length === 1 ? 0 : chartWidth / (labels.length - 1);
        
        // Use space requirements for optimal font and rotation decisions
        const spaceRequirements = this.calculateSpaceRequirements(labels, this.selectedMetrics, labels);
        const xAxisSpace = spaceRequirements.xAxis;
        
        // Apply the pre-calculated optimal font size
        ctx.font = xAxisSpace.font + 'px Arial';
        
        // Calculate label positioning based on space requirements
        const labelY = topPadding + chartHeight + (xAxisSpace.rotation ? 30 : 20);
        
        // Check if we have multiple group by dimensions
        const hasMultipleGroupBy = this.selectedDimensions.length > 1;
        
        // Draw labels
        labels.forEach((label, index) => {
            const x = padding + (index * labelSpacing);
            
            // Handle multiple group by dimensions
            if (hasMultipleGroupBy) {
                this.drawMultiGroupLabel(ctx, label, x, labelY, xAxisSpace.rotation);
            } else {
                // Single group by - use original logic
                let displayLabel = label;
                
                if (xAxisSpace.rotation) {
                    ctx.save();
                    ctx.translate(x, labelY);
                    ctx.rotate(-Math.PI / 4); // -45 degrees
                    ctx.fillText(displayLabel, 0, 0);
                    ctx.restore();
                } else {
                    ctx.fillText(displayLabel, x, labelY);
                }
            }
        });
        
        ctx.textAlign = 'left';
    }

    drawMultiGroupLabel(ctx, label, x, baseY, isRotated) {
        // Parse the combined label (e.g., "Group1, Group2" or "Group1 | Group2")
        const groupValues = label.split(/[,|]/).map(v => v.trim());
        const groupCount = groupValues.length;
        
        if (groupCount === 1) {
            // Single value - use original logic
            let displayLabel = label;
            
            if (isRotated) {
                ctx.save();
                ctx.translate(x, baseY);
                ctx.rotate(-Math.PI / 4);
                ctx.fillText(displayLabel, 0, 0);
                ctx.restore();
            } else {
                ctx.fillText(displayLabel, x, baseY);
            }
            return;
        }
        
        if (isRotated) {
            // Vertical rotation - show groups in one line (side by side)
            this.drawVerticalMultiGroupLabel(ctx, groupValues, x, baseY);
        } else {
            // Horizontal - show each group below the other (stacked vertically)
            this.drawHorizontalMultiGroupLabel(ctx, groupValues, x, baseY);
        }
    }

    drawVerticalMultiGroupLabel(ctx, groupValues, x, baseY) {
        // For vertical rotation, show groups in one line separated by " | "
        const combinedLabel = groupValues.join(' | ');
        let displayLabel = combinedLabel;
        
        ctx.save();
        ctx.translate(x, baseY);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(displayLabel, 0, 0);
        ctx.restore();
    }

    drawHorizontalMultiGroupLabel(ctx, groupValues, x, baseY) {
        // For horizontal, show each group below the other (stacked vertically)
        const lineHeight = 16; // Height between lines
        const startY = baseY - (groupValues.length - 1) * lineHeight / 2;
        
        groupValues.forEach((groupValue, index) => {
            const y = startY + index * lineHeight;
            let displayLabel = groupValue;
            ctx.fillText(displayLabel, x, y);
        });
    }

    generateColorsForMetrics(metrics) {
        const baseColors = ['#0070d2', '#00a1e0', '#4bca81', '#ffb75d', '#ff6b6b', '#4ecdc4', '#9b59b6', '#e74c3c', '#f39c12', '#2ecc71'];
        const colors = {};
        let colorIndex = 0;
        
        metrics.forEach(metricName => {
            const selectedAggregations = this.getMetricAggregations(metricName);
            selectedAggregations.forEach(aggregationType => {
                const key = metricName + '_' + aggregationType;
                colors[key] = baseColors[colorIndex % baseColors.length];
                colorIndex++;
            });
        });
        
        return colors;
    }

    createLineChart(ctx, data, width, height) {
        ctx.clearRect(0, 0, width, height);

        const groups = Object.keys(data);
        const metrics = this.selectedMetrics;

        // Generate colors based on metrics
        const colors = this.generateColorsForMetrics(metrics);

        // Calculate legend width needed for right-side legend
        const legendWidth = this.calculateLineChartLegendWidth(metrics);
        
        // Use consistent spacing approach with legend space reserved
        const spacing = this.calculateChartSpacing(width - legendWidth, height, groups, metrics);

        const chartWidth = spacing.chartWidth;
        const chartHeight = spacing.chartHeight;
        const yAxisPadding = spacing.yAxisPadding;
        const topPadding = spacing.topPadding;
        const bottomPadding = spacing.bottomPadding;
        const rightPadding = spacing.rightPadding;
        
        // Find min/max values across all metrics
        let minValue = Infinity;
        let maxValue = -Infinity;
        
        groups.forEach(group => {
            metrics.forEach(metricName => {
                const selectedAggregations = this.getMetricAggregations(metricName);
                selectedAggregations.forEach(aggregationType => {
                    const key = metricName + '_' + aggregationType;
                    const value = data[group][key];
                    if (value < minValue) minValue = value;
                    if (value > maxValue) maxValue = value;
                });
            });
        });
        
        const valueRange = maxValue - minValue || 1;
        
        // Draw axes
        ctx.strokeStyle = '#dddbda';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(yAxisPadding, topPadding);
        ctx.lineTo(yAxisPadding, topPadding + chartHeight);
        ctx.lineTo(yAxisPadding + chartWidth, topPadding + chartHeight);
        ctx.stroke();
        
        // Draw lines for each metric and aggregation combination
        metrics.forEach((metricName, metricIndex) => {
            const selectedAggregations = this.getMetricAggregations(metricName);
            selectedAggregations.forEach(aggregationType => {
                const key = metricName + '_' + aggregationType;
                ctx.strokeStyle = colors[key];
                ctx.lineWidth = 2;
                ctx.beginPath();
                
                groups.forEach((group, groupIndex) => {
                    const x = groups.length === 1 ? 
                        yAxisPadding + chartWidth / 2 : 
                        yAxisPadding + (groupIndex / (groups.length - 1)) * chartWidth;
                    const y = topPadding + chartHeight - ((data[group][key] - minValue) / valueRange) * chartHeight;
                
                    if (groupIndex === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                });
                
                // Only draw line if there are multiple points
                if (groups.length > 1) {
                    ctx.stroke();
                }
                
                // Draw data points and value labels
                groups.forEach((group, groupIndex) => {
                    const x = groups.length === 1 ? 
                        yAxisPadding + chartWidth / 2 : 
                        yAxisPadding + (groupIndex / (groups.length - 1)) * chartWidth;
                    const y = topPadding + chartHeight - ((data[group][key] - minValue) / valueRange) * chartHeight;
                    const value = data[group][key];
                    
                    // Draw data point with metric color
                    ctx.fillStyle = colors[key];
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, 2 * Math.PI);
                ctx.fill();
                
                // Draw value labels if there's space
                if (groups.length <= 8) {
                    ctx.fillStyle = '#333';
                    ctx.font = '9px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(this.formatValue(value), x, y - 8);
                }
                });
            });
        });
        
        // Draw Y-axis labels
        ctx.fillStyle = '#666';
        ctx.font = '11px Arial';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const value = minValue + (i / 5) * valueRange;
            const y = topPadding + chartHeight - (i / 5) * chartHeight;
            ctx.fillText(this.formatValue(value), yAxisPadding - 10, y + 4);
        }
        
        // Draw Y-axis title
        ctx.save();
        ctx.translate(15, topPadding + chartHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#333';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        const yAxisTitle = this.getYAxisTitle();
        ctx.fillText(yAxisTitle, 0, 0);
        ctx.restore();
        
        // Draw group labels
        this.drawXAxisLabels(ctx, groups, yAxisPadding, topPadding, chartWidth, chartHeight);
        
        // Draw legend for metrics on the right side
        this.drawLineChartLegendRight(ctx, metrics, colors, width, height, legendWidth);
    }

    createBarChart(ctx, data, width, height) {
        ctx.clearRect(0, 0, width, height);

        const groups = Object.keys(data);
        const metrics = this.selectedMetrics;

        // Generate colors based on metrics
        const colors = this.generateColorsForMetrics(metrics);

        // Calculate legend width needed for right-side legend
        const legendWidth = this.calculateBarChartLegendWidth(metrics);
        
        // Use consistent spacing approach with legend space reserved
        const spacing = this.calculateChartSpacing(width - legendWidth, height, groups, metrics);

        const chartWidth = spacing.chartWidth;
        const chartHeight = spacing.chartHeight;
        const yAxisPadding = spacing.yAxisPadding;
        const topPadding = spacing.topPadding;
        const bottomPadding = spacing.bottomPadding;
        const rightPadding = spacing.rightPadding;
        
        // Find max value for scaling
        let maxValue = 0;
        groups.forEach(group => {
            metrics.forEach(metricName => {
                const selectedAggregations = this.getMetricAggregations(metricName);
                selectedAggregations.forEach(aggregationType => {
                    const key = metricName + '_' + aggregationType;
                    const value = data[group][key];
                    if (value > maxValue) maxValue = value;
                });
            });
        });
        
        // Calculate total number of metric+aggregation combinations
        let totalCombinations = 0;
        metrics.forEach(metricName => {
            const selectedAggregations = this.getMetricAggregations(metricName);
            totalCombinations += selectedAggregations.length;
        });
        
        // Calculate bar dimensions with precise spacing
        const groupWidth = chartWidth / groups.length;
        const barWidth = Math.min(groupWidth * 0.8 / totalCombinations, 20); // Max 20px per bar
        const barSpacing = (groupWidth - (barWidth * totalCombinations)) / 2;
        
        // Draw bars
        groups.forEach((group, groupIndex) => {
            const groupX = yAxisPadding + groupIndex * groupWidth;
            let metricIndex = 0;
            
            metrics.forEach((metricName) => {
                const selectedAggregations = this.getMetricAggregations(metricName);
                selectedAggregations.forEach(aggregationType => {
                    const key = metricName + '_' + aggregationType;
                    const value = data[group][key];
                    const barHeight = (value / maxValue) * chartHeight;
                    const x = groupX + barSpacing + metricIndex * barWidth;
                    const y = topPadding + chartHeight - barHeight;
                    
                    ctx.fillStyle = colors[key];
                    ctx.fillRect(x, y, barWidth * 0.9, barHeight);
                    
                    // Draw value labels on top of bars
                    ctx.fillStyle = '#333';
                    ctx.font = '10px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(this.formatValue(value), x + barWidth/2, y - 5);
                    
                    metricIndex++;
                });
            });
        });
        
        // Draw Y-axis line
        ctx.strokeStyle = '#dddbda';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(yAxisPadding, topPadding);
        ctx.lineTo(yAxisPadding, topPadding + chartHeight);
        ctx.stroke();
        
        // Draw X-axis line
        ctx.beginPath();
        ctx.moveTo(yAxisPadding, topPadding + chartHeight);
        ctx.lineTo(yAxisPadding + chartWidth, topPadding + chartHeight);
        ctx.stroke();
        
        // Draw Y-axis labels
        ctx.fillStyle = '#666';
        ctx.font = '11px Arial';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const value = (i / 5) * maxValue;
            const y = topPadding + chartHeight - (i / 5) * chartHeight;
            ctx.fillText(this.formatValue(value), yAxisPadding - 10, y + 4);
        }
        
        // Draw Y-axis title
        ctx.save();
        ctx.translate(15, topPadding + chartHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#333';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        const yAxisTitle = this.getYAxisTitle();
        ctx.fillText(yAxisTitle, 0, 0);
        ctx.restore();
        
        // Draw group labels
        const groupLabels = groups.map((group, index) => ({
            label: this.formatGroupKeyForDisplay(group), // Format multi-dimensional group keys
            x: yAxisPadding + index * groupWidth + groupWidth / 2
        }));
        this.drawXAxisLabels(ctx, groupLabels.map(item => item.label), yAxisPadding, topPadding, chartWidth, chartHeight);
        
        // Draw legend for metrics on the right side
        this.drawBarChartLegendRight(ctx, metrics, colors, width, height, legendWidth);
    }

    renderTable() {
        const tableContainer = document.getElementById('waveTable');
        const headers = Object.keys(this.filteredData[0] || {});
        
        let tableHTML = '<table class="wave-table">';
        tableHTML += '<thead><tr>';
        headers.forEach(header => {
            tableHTML += '<th>' + this.formatHeader(header) + '</th>';
        });
        tableHTML += '</tr></thead>';
        tableHTML += '<tbody>';
        this.filteredData.forEach(row => {
            tableHTML += '<tr>';
            headers.forEach(header => {
                tableHTML += '<td>' + this.formatValueForTable(row[header]) + '</td>';
            });
            tableHTML += '</tr>';
        });
        tableHTML += '</tbody></table>';
        
        tableContainer.innerHTML = tableHTML;
    }

    renderCharts() {
        const chartsContainer = document.getElementById('waveCharts');
        
        // Use detected metrics for charts (limit to first 6 for performance)
        const chartMetrics = this.metrics.slice(0, 6);
        
        let chartsHTML = '<div class="charts-grid">';
        chartMetrics.forEach(metric => {
            const chartId = 'chart-' + metric.replace(/[^a-zA-Z0-9]/g, '');
            chartsHTML += '<div class="chart-container">';
            chartsHTML += '<h3>' + this.formatHeader(metric) + '</h3>';
            chartsHTML += '<canvas id="' + chartId + '" width="400" height="200"></canvas>';
            chartsHTML += '</div>';
        });
        
        chartsHTML += '<div class="chart-container chart-wide">';
        chartsHTML += '<h3>Metrics Overview</h3>';
        chartsHTML += '<canvas id="chart-overview" width="800" height="300"></canvas>';
        chartsHTML += '</div>';
        
        chartsHTML += '<div class="chart-container">';
        chartsHTML += '<h3>Dimension Distribution</h3>';
        chartsHTML += '<canvas id="chart-dimension-dist" width="400" height="200"></canvas>';
        chartsHTML += '</div>';
        
        chartsHTML += '</div>';
        
        chartsContainer.innerHTML = chartsHTML;
        
        // Initialize charts when switching to chart view
        this.initializeCharts();
    }

    initializeCharts() {
        // Use detected metrics for individual charts
        const chartMetrics = this.metrics.slice(0, 6);
        
        chartMetrics.forEach(metric => {
            const chartId = 'chart-' + metric.replace(/[^a-zA-Z0-9]/g, '');
            const canvas = document.getElementById(chartId);
            if (canvas) {
                this.createChart(canvas, metric);
            }
        });
        
        // Create overview chart
        const overviewCanvas = document.getElementById('chart-overview');
        if (overviewCanvas) {
            this.createOverviewChart(overviewCanvas);
        }
        
        // Create dimension distribution chart
        const dimensionDistCanvas = document.getElementById('chart-dimension-dist');
        if (dimensionDistCanvas) {
            this.createDimensionDistributionChart(dimensionDistCanvas);
        }
    }

    createChart(canvas, metric) {
        const ctx = canvas.getContext('2d');
        const data = this.filteredData.map(row => ({
            x: row.timestamp || row.cell,
            y: row[metric]
        })).filter(d => !isNaN(d.y));
        
        // Simple line chart implementation
        this.drawLineChart(ctx, data, metric, canvas.width, canvas.height);
    }

    drawLineChart(ctx, data, metric, width, height) {
        if (data.length === 0) return;
        
        ctx.clearRect(0, 0, width, height);
        
        const padding = 40;
        const chartWidth = width - 2 * padding;
        const chartHeight = height - 2 * padding;
        
        const minY = Math.min(...data.map(d => d.y));
        const maxY = Math.max(...data.map(d => d.y));
        const yRange = maxY - minY || 1;
        
        // Draw axes
        ctx.strokeStyle = '#dddbda';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, topPadding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
        
        // Draw line
        ctx.strokeStyle = '#0070d2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        data.forEach((point, index) => {
            const x = padding + (index / (data.length - 1)) * chartWidth;
            const y = height - padding - ((point.y - minY) / yRange) * chartHeight;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw points
        ctx.fillStyle = '#0070d2';
        data.forEach((point, index) => {
            const x = padding + (index / (data.length - 1)) * chartWidth;
            const y = height - padding - ((point.y - minY) / yRange) * chartHeight;
            
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    createOverviewChart(canvas) {
        const ctx = canvas.getContext('2d');
        const metrics = this.metrics.slice(0, 4); // Use first 4 metrics for overview
        const colors = ['#0070d2', '#00a1e0', '#4bca81', '#ffb75d'];
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const padding = 60;
        const chartWidth = canvas.width - 2 * padding;
        const chartHeight = canvas.height - 2 * padding;
        
        // Draw axes
        ctx.strokeStyle = '#dddbda';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvas.height - padding);
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        ctx.stroke();
        
        metrics.forEach((metric, index) => {
            const data = this.filteredData.map(row => ({
                x: row.timestamp || row.cell,
                y: row[metric]
            })).filter(d => !isNaN(d.y));
            
            if (data.length === 0) return;
            
            const minY = Math.min(...data.map(d => d.y));
            const maxY = Math.max(...data.map(d => d.y));
            const yRange = maxY - minY || 1;
            
            // Draw line
            ctx.strokeStyle = colors[index % colors.length];
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            data.forEach((point, dataIndex) => {
                const x = padding + (dataIndex / (data.length - 1)) * chartWidth;
                const y = canvas.height - padding - ((point.y - minY) / yRange) * chartHeight;
                
                if (dataIndex === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
        });
        
        // Draw legend
        ctx.font = '12px Arial';
        metrics.forEach((metric, index) => {
            ctx.fillStyle = colors[index % colors.length];
            ctx.fillRect(canvas.width - 200, 20 + index * 20, 15, 10);
            ctx.fillStyle = '#333';
            ctx.fillText(this.formatHeader(metric), canvas.width - 180, 30 + index * 20);
        });
    }

    createDimensionDistributionChart(canvas) {
        const ctx = canvas.getContext('2d');
        const dimensionCounts = {};
        
        // Use first dimension for distribution chart
        const primaryDimension = this.dimensions[0];
        if (!primaryDimension) return;
        
        this.filteredData.forEach(row => {
            if (row[primaryDimension]) {
                dimensionCounts[row[primaryDimension]] = (dimensionCounts[row[primaryDimension]] || 0) + 1;
            }
        });
        
        const dimensionValues = Object.keys(dimensionCounts);
        const counts = Object.values(dimensionCounts);
        
        if (dimensionValues.length === 0) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) / 2 - 40;
        
        const total = counts.reduce((sum, count) => sum + count, 0);
        let currentAngle = 0;
        
        const colors = ['#0070d2', '#00a1e0', '#4bca81', '#ffb75d', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'];
        
        dimensionValues.forEach((dimensionValue, index) => {
            const sliceAngle = (counts[index] / total) * 2 * Math.PI;
            
            // Draw slice
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = colors[index % colors.length];
            ctx.fill();
            
            // Draw label
            const labelAngle = currentAngle + sliceAngle / 2;
            const labelX = centerX + Math.cos(labelAngle) * (radius + 20);
            const labelY = centerY + Math.sin(labelAngle) * (radius + 20);
            
            ctx.fillStyle = '#333';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(dimensionValue, labelX, labelY);
            
            currentAngle += sliceAngle;
        });
    }

    async refreshData() {
        this.isLoading = true;

        try {
            // Store current state before refresh
            const currentDimensions = [...this.selectedDimensions];
            const currentMetrics = [...this.selectedMetrics];
            const currentAggregations = {...this.metricAggregations};
            const currentChartType = this.chartType;
            
            // For testing: use hardcoded CSV data instead of API call
            this.fetchCSVDataAndParse();
            this.render();
            
            // Restore state after re-rendering
            this.selectedDimensions = currentDimensions;
            this.selectedMetrics = currentMetrics;
            this.metricAggregations = currentAggregations;
            this.chartType = currentChartType;
            
            // Update field palette and preserve existing selections
            this.updateFieldPalettePreservingSelections();
            
            // Update the UI with restored state
            this.updateDropZone('dimensionsArea', this.selectedDimensions);
            this.updateDropZone('metricsArea', this.selectedMetrics);
            this.updateFiltersZone();
            this.updateDropZoneCounts();
            this.updateFieldItemIcons();
            
            // Re-initialize drag and drop for new DOM elements
            this.dragAndDropSetup = false; // Reset the flag
            setTimeout(() => {
                this.setupDragAndDrop();
            }, 10);
            
            // Re-initialize collapse functionality for new DOM elements
            this.collapseInitialized = false; // Reset the flag
            setTimeout(() => {
                this.initializeCollapsePanel();
            }, 100);
            
            // Re-setup search input event listeners after UI recreation
            setTimeout(() => {
                this.setupSearchInput();
            }, 150);
            
            // Apply filters first to update filteredData, then re-render the lens chart if we have selected dimensions/metrics
            this.applyFilters();
            if (this.selectedDimensions.length > 0 || this.selectedMetrics.length > 0) {
                this.renderLensChart();
            }
            
            // Reload lenses from backend after refresh
            getCanaryLenses();
        } catch (error) {
            this.showErrorState(error);
        } finally {
            this.isLoading = false;
        }
    }

    async loadDimensions() {
        try {
            // For testing: return hardcoded dimensions
            return this.dimensions || [];
        } catch (error) {
            console.error('Error loading dimensions:', error);
            return null;
        }
    }

    async loadMetrics() {
        try {
            // For testing: return hardcoded metrics
            return this.metrics || [];
        } catch (error) {
            console.error('Error loading metrics:', error);
            return null;
        }
    }

    exportToCSV() {
        const headers = Object.keys(this.filteredData[0] || {});
        let csvContent = headers.join(',') + '\n';
        
        this.filteredData.forEach(row => {
            const rowValues = headers.map(header => {
                const value = row[header];
                return typeof value === 'string' && value.includes(',') ? '"' + value + '"' : value;
            });
            csvContent += rowValues.join(',') + '\n';
        });
        
        // Use a more compatible approach for CSV download
        try {
            // Try modern approach first
            if (window.URL && window.URL.createObjectURL) {
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'performance-data.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } else {
                // Fallback for older browsers or restricted environments
                this.downloadCSVFallback(csvContent, 'performance-data.csv');
            }
        } catch (error) {
            console.error('Error exporting CSV:', error);
            // Fallback method
            this.downloadCSVFallback(csvContent, 'performance-data.csv');
        }
    }

    downloadCSVFallback(csvContent, filename) {
        // Create a data URL and use it for download
        const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
        const a = document.createElement('a');
        a.href = dataUri;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    setupEventListeners() {
        // Chart type buttons
        document.getElementById('lineChartBtn').addEventListener('click', () => {
            this.setChartType('line');
            this.toggleView('chart');
        });
        
        document.getElementById('barChartBtn').addEventListener('click', () => {
            this.setChartType('bar');
            this.toggleView('chart');
        });
        
        // View toggle events
        document.getElementById('tableViewBtn').addEventListener('click', () => {
            this.toggleView('table');
        });
        
        // Clear lens event
        document.getElementById('clearLensBtn').addEventListener('click', () => {
            this.clearLens();
        });
        
        // Export event
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportToCSV();
        });
        
        // Refresh event
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });
        
        // Save lens event
        document.getElementById('saveLensBtn').addEventListener('click', () => {
            this.saveLensOptions();
        });
        
        // Load lens event
        document.getElementById('loadLensSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadLens(e.target.value);
            }
        });
        
        // Chart expand icon event
        document.getElementById('chartExpandIcon').addEventListener('click', () => {
            this.expandChartWidth();
        });
        
        // Chart reduce icon event
        document.getElementById('chartReduceIcon').addEventListener('click', () => {
            this.reduceChartWidth();
        });
        
        // Setup collapsible categories
        this.setupCollapsibleCategories();
        
        // Setup drop zone collapse functionality
        this.setupDropZoneCollapse();
    }

    setupCollapsibleCategories() {
        const categoryHeaders = document.querySelectorAll('.category-header');
        
        categoryHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const targetId = header.getAttribute('data-target');
                const targetElement = document.getElementById(targetId);
                const collapseIcon = header.querySelector('.collapse-icon');
                
                if (targetElement.style.display === 'none') {
                    // Expand
                    targetElement.style.display = 'flex';
                    collapseIcon.textContent = '▼';
                    header.classList.remove('collapsed');
                } else {
                    // Collapse
                    targetElement.style.display = 'none';
                    collapseIcon.textContent = '▶';
                    header.classList.add('collapsed');
                }
            });
        });
    }

    setupDropZoneCollapse() {
        // Only set up once
        if (this.dropZoneCollapseSetup) {
            return;
        }
        
        // Check if event listener is already attached globally
        if (window.dropZoneClickHandlerAttached) {
            return;
        }
        
        // Store the event handler function so we can remove it later if needed
        this.dropZoneClickHandler = (e) => {
            // Check if click is on drop zone header (including button or icon)
            const header = e.target.closest('.drop-zone-header');
            if (header) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Drop zone header clicked');
                
                // Add debounce to prevent double-click issues
                if (this.dropZoneClickTimeout) {
                    clearTimeout(this.dropZoneClickTimeout);
                    return;
                }
                
                this.dropZoneClickTimeout = setTimeout(() => {
                    this.toggleDropZones();
                    this.dropZoneClickTimeout = null;
                }, 100);
            }
        };
        
        // Use event delegation to handle drop zone header clicks
        document.addEventListener('click', this.dropZoneClickHandler);
        
        // Mark as set up globally to prevent multiple instances
        window.dropZoneClickHandlerAttached = true;
        this.dropZoneCollapseSetup = true;
    }
    
    toggleDropZones() {
        const allDropZones = document.querySelectorAll('.drop-zone');
        
        // Check if any drop zone is currently collapsed
        const anyCollapsed = Array.from(allDropZones).some(zone => zone.classList.contains('collapsed'));
        
        if (anyCollapsed) {
            // If any zone is collapsed, expand all zones
            allDropZones.forEach(zone => {
                zone.classList.remove('collapsed');
                const icon = zone.querySelector('.drop-zone-collapse-btn i');
                if (icon) {
                    icon.className = 'fa fa-chevron-down';
                }
            });
            console.log('All drop zones expanded');
            
            // Re-render chart with adjusted height after expansion
            setTimeout(() => {
                if (this.selectedDimensions.length > 0 || this.selectedMetrics.length > 0) {
                    this.renderLensChart();
                }
                // Update floating controls position
                this.updateFloatingControlsPosition();
            }, 100);
        } else {
            // If no zones are collapsed, collapse all zones
            allDropZones.forEach(zone => {
                zone.classList.add('collapsed');
                const icon = zone.querySelector('.drop-zone-collapse-btn i');
                if (icon) {
                    icon.className = 'fa fa-chevron-up';
                }
            });
            console.log('All drop zones collapsed');
            
            // Re-render chart with adjusted height after collapse
            setTimeout(() => {
                if (this.selectedDimensions.length > 0 || this.selectedMetrics.length > 0) {
                    this.renderLensChart();
                }
                // Update floating controls position
                this.updateFloatingControlsPosition();
            }, 100);
        }
    }
    
    updateFloatingControlsPosition() {
        const waveControls = document.querySelector('.wave-controls');
        const floatingControls = document.querySelector('.floating-chart-controls');
        
        if (waveControls && floatingControls) {
            const waveControlsRect = waveControls.getBoundingClientRect();
            // Update floating controls position
            floatingControls.style.top = waveControlsRect.bottom + 10 + 'px';
            floatingControls.style.left = waveControlsRect.left + 'px';
            
        }
    }

    updateDropZoneCounts() {
        // Update dimensions count
        const dimensionsCount = document.getElementById('dimensionsCount');
        if (dimensionsCount) {
            dimensionsCount.textContent = this.selectedDimensions.length;
        }
        
        // Update metrics count
        const metricsCount = document.getElementById('metricsCount');
        if (metricsCount) {
            metricsCount.textContent = this.selectedMetrics.length;
        }
        
        // Update filters count (include selectedFilters, dimensionFilters, and rows filter only when rows are ignored)
        const filtersCount = document.getElementById('filtersCount');
        if (filtersCount) {
            let totalFilters = this.selectedFilters.length + Object.keys(this.dimensionFilters).length;
            //console.log('DEBUG: Filter count calculation - selectedFilters:', this.selectedFilters.length, 'dimensionFilters:', Object.keys(this.dimensionFilters).length, 'ignoredRows.size:', this.ignoredRows.size);
            
            // Add 1 for the rows filter only when there are ignored rows
            if (this.ignoredRows.size > 0) {
                totalFilters += 1;
                //console.log('DEBUG: Added rows filter to count, total:', totalFilters);
            } else {
                //console.log('DEBUG: No ignored rows, not adding rows filter to count, total:', totalFilters);
            }
            filtersCount.textContent = totalFilters;
        }
        
        console.log('Drop zone counts updated:', {
            dimensions: this.selectedDimensions.length,
            metrics: this.selectedMetrics.length,
            filters: this.selectedFilters.length + Object.keys(this.dimensionFilters).length
        });
    }

    updateFieldItemIcons() {
        // Update all field items to show correct icon based on selection state
        const fieldItems = document.querySelectorAll('.field-item');
        
        fieldItems.forEach(item => {
            const fieldName = item.getAttribute('data-field');
            const fieldType = item.getAttribute('data-type');
            const clickHint = item.querySelector('.click-hint');
            
            if (clickHint) {
                let isSelected = false;
                
                if (fieldType === 'dimension' || fieldType === 'date') {
                    isSelected = this.selectedDimensions.includes(fieldName);
                } else if (fieldType === 'metric') {
                    isSelected = this.selectedMetrics.includes(fieldName);
                }
                
                // Update icon and styling
                if (isSelected) {
                    clickHint.textContent = '−';
                    clickHint.classList.add('remove-state');
                    item.classList.add('selected');
                } else {
                    clickHint.textContent = '+';
                    clickHint.classList.remove('remove-state');
                    item.classList.remove('selected');
                }
            }
        });
    }

    setChartType(type) {
        this.chartType = type;
        
        // Update button states
        document.getElementById('lineChartBtn').classList.toggle('active', type === 'line');
        document.getElementById('barChartBtn').classList.toggle('active', type === 'bar');
        
        // Force re-render of the chart
        this.renderLensChart();
    }

    toggleView(viewType) {
        console.log('toggleView called with:', viewType);
        const chartContainer = document.getElementById('lensChart');
        const tableContainer = document.getElementById('lensTable');
        const tableBtn = document.getElementById('tableViewBtn');
        const lineBtn = document.getElementById('lineChartBtn');
        const barBtn = document.getElementById('barChartBtn');
        
        if (viewType === 'table') {
            chartContainer.style.display = 'none';
            tableContainer.style.display = 'block';
            tableBtn.classList.add('active');
            lineBtn.classList.remove('active');
            barBtn.classList.remove('active');
            
            // Add table-view class and hide floating controls
            const lensDisplay = document.querySelector('.lens-display');
            const floatingControls = document.querySelector('.floating-chart-controls');
            if (lensDisplay) {
                lensDisplay.classList.add('table-view');
                console.log('Added table-view class to lens-display');
                console.log('lens-display classes:', lensDisplay.className);
                const lensDisplayWidth = lensDisplay.getBoundingClientRect().width;
                tableContainer.style.width = lensDisplayWidth + 'px';
                tableContainer.style.maxWidth = lensDisplayWidth + 'px';
            } else {
                console.log('lens-display element not found');
            }
            
            // Hide floating controls directly
            if (floatingControls) {
                floatingControls.style.display = 'none';
                console.log('Hidden floating controls');
            } else {
                console.log('floating-chart-controls element not found');
            }
            
            // Re-render to ensure table content is up to date
            this.renderLensChart();
        } else if (viewType === 'chart') {
            chartContainer.style.display = 'block';
            tableContainer.style.display = 'none';
            tableBtn.classList.remove('active');
            
            // Remove table-view class and show floating controls
            const lensDisplay = document.querySelector('.lens-display');
            const floatingControls = document.querySelector('.floating-chart-controls');
            if (lensDisplay) {
                lensDisplay.classList.remove('table-view');
                console.log('Removed table-view class from lens-display');
                console.log('lens-display classes:', lensDisplay.className);
            } else {
                console.log('lens-display element not found');
            }
            
            // Show floating controls directly
            if (floatingControls) {
                floatingControls.style.display = 'flex';
                console.log('Shown floating controls');
            } else {
                console.log('floating-chart-controls element not found');
            }
            
            // Set the appropriate chart type button as active
            lineBtn.classList.toggle('active', this.chartType === 'line');
            barBtn.classList.toggle('active', this.chartType === 'bar');
            // Re-render the chart with the current type
            this.renderLensChart();
        }
    }

    clearLens() {
        console.log('DEBUG: clearLens() called - before clear:');
        //console.log('  selectedFilters:', this.selectedFilters.length, this.selectedFilters);
        //console.log('  dimensionFilters:', Object.keys(this.dimensionFilters).length, this.dimensionFilters);
        //console.log('  dateTimeFilters:', Object.keys(this.dateTimeFilters).length, this.dateTimeFilters);
        
        this.selectedDimensions = [];
        this.selectedMetrics = [];
        this.metricAggregations = {};
        this.selectedFilters = [];
        this.dimensionFilters = {};
        this.currentFilters = {}; // Clear current filters when clearing lens
        this.dateTimeFilters = {}; // Clear date/time filters when clearing lens
        this.ignoredRows.clear(); // Clear ignored rows when clearing lens
        this.sortedGroups = null; // Clear sorted groups when clearing lens
        this.sortColumn = null; // Clear sort column when clearing lens
        this.sortDirection = 'asc'; // Reset sort direction when clearing lens
        this.filteredData = [...this.parsedData]; // Reset filtered data to original data
        this.resetChartWidth(); // Reset chart width when clearing lens
        
        //console.log('DEBUG: clearLens() - after clear:');
        //console.log('  selectedFilters:', this.selectedFilters.length, this.selectedFilters);
        //console.log('  dimensionFilters:', Object.keys(this.dimensionFilters).length, this.dimensionFilters);
        //console.log('  dateTimeFilters:', Object.keys(this.dateTimeFilters).length, this.dateTimeFilters);
        
        // Clear all DOM filter selections
        this.clearAllDOMFilterSelections();
        
        this.updateDropZone('dimensionsArea', this.selectedDimensions);
        this.updateDropZone('metricsArea', this.selectedMetrics);
        this.updateFiltersZone();
        this.updateDropZoneCounts();
        this.updateFieldItemIcons();
        
        // Re-initialize drag and drop for new DOM elements
        this.dragAndDropSetup = false; // Reset the flag
        setTimeout(() => {
            this.setupDragAndDrop();
        }, 10);
        
        this.renderLensChart();
    }
    
    clearAllDOMFilterSelections() {
        // Clear dimension filter checkboxes
        document.querySelectorAll('.dimension-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Clear metric filter inputs
        document.querySelectorAll('.filter-input').forEach(input => {
            input.value = '';
        });
        
        // Clear metric filter operators
        document.querySelectorAll('.filter-operator').forEach(select => {
            select.selectedIndex = 0;
        });
        
        // Clear date/time filter inputs
        document.querySelectorAll('input[type="date"], input[type="datetime-local"]').forEach(input => {
            input.value = '';
        });
        
        // Clear search filters
        const searchInputs = document.querySelectorAll('input[type="text"]');
        searchInputs.forEach(input => {
            if (input.placeholder && input.placeholder.toLowerCase().includes('search')) {
                input.value = '';
                // Reset visual state
                input.classList.remove('wave-search-pending', 'wave-search-applied');
                // Remove setup marker to allow re-setup
                input.removeAttribute('data-search-setup');
            }
        });
        
        // Clear relative period selects
        document.querySelectorAll('select[id^="relativePeriod_"]').forEach(select => {
            select.selectedIndex = 0;
        });
        
        // Clear from/to date inputs
        document.querySelectorAll('input[id^="fromDate_"], input[id^="toDate_"]').forEach(input => {
            input.value = '';
        });
        
        // Clear cell/instance filter dropdowns
        document.querySelectorAll('select[id="cellFilter"], select[id="instanceFilter"]').forEach(select => {
            select.selectedIndex = 0;
        });
    }

    restoreDOMFilterStates() {
        //console.log('DEBUG: restoreDOMFilterStates() called');
        //console.log('DEBUG: dimensionFilters:', this.dimensionFilters);
        //console.log('DEBUG: selectedFilters:', this.selectedFilters);
        //console.log('DEBUG: dateTimeFilters:', this.dateTimeFilters);
        //console.log('DEBUG: currentFilters:', this.currentFilters);
        
        // Restore dimension filter checkboxes
        Object.keys(this.dimensionFilters).forEach(dimensionName => {
            const dimensionFilter = this.dimensionFilters[dimensionName];
            //console.log('DEBUG: Processing dimension filter:', dimensionName, dimensionFilter);
            const menu = document.querySelector('.dimension-dropdown-menu[data-dimension="' + dimensionName + '"]');
            //console.log('DEBUG: Found menu for dimension', dimensionName, ':', menu);
            if (menu) {
                // Clear all checkboxes first
                menu.querySelectorAll('.dimension-checkbox').forEach(checkbox => {
                    checkbox.checked = false;
                });
                
                // Check "All" if no specific values selected
                if (dimensionFilter.selectedValues.length === 0) {
                    const allCheckbox = menu.querySelector('.dimension-checkbox[value="all"]');
                    if (allCheckbox) {
                        allCheckbox.checked = true;
                        //console.log('DEBUG: Checked "All" for dimension', dimensionName);
                    }
                } else {
                    // Check specific value checkboxes
                    dimensionFilter.selectedValues.forEach(value => {
                        const checkbox = menu.querySelector('.dimension-checkbox[value="' + value + '"]');
                        if (checkbox) {
                            checkbox.checked = true;
                            //console.log('DEBUG: Checked value', value, 'for dimension', dimensionName);
                        } else {
                            //console.log('DEBUG: Checkbox not found for value', value, 'in dimension', dimensionName);
                        }
                    });
                }
            } else {
                //console.log('DEBUG: Menu not found for dimension', dimensionName);
            }
        });
        
        // Restore metric filter inputs and operators
        this.selectedFilters.forEach((filter, index) => {
            //console.log('DEBUG: Processing metric filter', index, filter);
            // Find metric filters by looking for elements with filter-operator and data-index
            const filterDiv = document.querySelector('.filter-item .filter-operator[data-index="' + index + '"]').closest('.filter-item');
            //console.log('DEBUG: Found filter div for index', index, ':', filterDiv);
            if (filterDiv) {
                const input = filterDiv.querySelector('.filter-input');
                const operator = filterDiv.querySelector('.filter-operator');
                //console.log('DEBUG: Found input and operator:', input, operator);
                if (input) {
                    const value = filter.value1 || filter.value || '';
                    //console.log('DEBUG: Setting input value from', filter.value1, 'or', filter.value, 'to', value);
                    input.value = value;
                    //console.log('DEBUG: Set input value to', input.value);
                }
                if (operator) {
                    operator.value = filter.operator || '=';
                    //console.log('DEBUG: Set operator value to', operator.value);
                }
            } else {
                //console.log('DEBUG: Filter div not found for index', index);
            }
        });
        
        // Restore date/time filters
        Object.keys(this.dateTimeFilters).forEach(dimensionName => {
            const filter = this.dateTimeFilters[dimensionName];
            if (filter.type === 'relative') {
                const periodSelect = document.getElementById('relativePeriod_' + dimensionName);
                if (periodSelect) periodSelect.value = filter.period || '';
            } else if (filter.type === 'absolute') {
                const fromInput = document.getElementById('fromDate_' + dimensionName);
                const toInput = document.getElementById('toDate_' + dimensionName);
                if (fromInput) fromInput.value = filter.from || '';
                if (toInput) toInput.value = filter.to || '';
            }
        });
        
        // Restore search filters
        if (this.currentFilters.search) {
            const searchInput = document.getElementById('waveSearchInput');
            if (searchInput) {
                searchInput.value = this.currentFilters.search;
                // Apply visual state based on current value
                if (searchInput.value.trim() !== '') {
                    searchInput.classList.add('wave-search-applied');
                }
            }
        }
        
        // Restore cell/instance filters
        if (this.currentFilters.cell) {
            const cellSelect = document.getElementById('cellFilter');
            if (cellSelect) cellSelect.value = this.currentFilters.cell;
        }
        if (this.currentFilters.instance) {
            const instanceSelect = document.getElementById('instanceFilter');
            if (instanceSelect) instanceSelect.value = this.currentFilters.instance;
        }
    }

    saveLensOptions() {
        // Check if there are any dimensions or metrics selected
        if (this.selectedDimensions.length === 0 && this.selectedMetrics.length === 0) {
            alert('Please select at least one dimension or metric before saving the lens.');
            return;
        }

        // Show the modal
        this.showSaveLensModal();
    }

    showSaveLensModal() {
        const modal = document.getElementById('saveLensModal');
        const nameInput = document.getElementById('lensNameInput');
        const descriptionInput = document.getElementById('lensDescriptionInput');
        const previewContent = document.getElementById('lensPreviewContent');

        // Clear previous values
        nameInput.value = '';
        descriptionInput.value = '';

        // Generate lens preview
        this.generateLensPreview(previewContent);

        // Show modal
        modal.style.display = 'flex';

        // Focus on name input
        setTimeout(() => {
            nameInput.focus();
        }, 100);

        // Add event listeners for modal interactions
        this.setupSaveLensModalEvents();
    }

    generateLensPreview(container) {
        let previewHTML = '';

        // Dimensions
        if (this.selectedDimensions.length > 0) {
            previewHTML += '<div class="lens-preview-item">' +
                '<span class="lens-preview-label">Dimensions:</span>' +
                '<span class="lens-preview-value">' + this.selectedDimensions.length + ' selected</span>' +
                '</div>';
        }

        // Metrics
        if (this.selectedMetrics.length > 0) {
            previewHTML += '<div class="lens-preview-item">' +
                '<span class="lens-preview-label">Metrics:</span>' +
                '<span class="lens-preview-value">' + this.selectedMetrics.length + ' selected</span>' +
                '</div>';
        }

        // Chart type
        previewHTML += '<div class="lens-preview-item">' +
            '<span class="lens-preview-label">Chart Type:</span>' +
            '<span class="lens-preview-value">' + (this.chartType === 'line' ? 'Line Chart' : 'Bar Chart') + '</span>' +
            '</div>';

        // Aggregations
        const aggregations = Object.keys(this.metricAggregations);
        if (aggregations.length > 0) {
            previewHTML += '<div class="lens-preview-item">' +
                '<span class="lens-preview-label">Aggregations:</span>' +
                '<span class="lens-preview-value">' + aggregations.length + ' configured</span>' +
                '</div>';
        }

        container.innerHTML = previewHTML;
    }

    setupSaveLensModalEvents() {
        // Only set up events once
        if (this.saveLensModalEventsSetup) {
            return;
        }

        const modal = document.getElementById('saveLensModal');
        const closeBtn = document.getElementById('closeSaveLensModal');
        const cancelBtn = document.getElementById('cancelSaveLens');
        const confirmBtn = document.getElementById('confirmSaveLens');
        const nameInput = document.getElementById('lensNameInput');

        // Close modal functions
        const closeModal = () => {
            modal.style.display = 'none';
        };

        // Event listeners
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Confirm save
        confirmBtn.addEventListener('click', () => {
            this.confirmSaveLens();
        });

        // Enter key to save
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.confirmSaveLens();
            }
        });

        // Mark as set up
        this.saveLensModalEventsSetup = true;
    }

    confirmSaveLens() {
        const nameInput = document.getElementById('lensNameInput');
        const descriptionInput = document.getElementById('lensDescriptionInput');
        const modal = document.getElementById('saveLensModal');

        const lensName = nameInput.value.trim();
        const description = descriptionInput.value.trim();

        // Validate name
        if (!lensName) {
            alert('Please enter a lens name.');
            nameInput.focus();
            return;
        }

        // Check if lens name already exists
        const existingLens = this.savedLenses.find(lens => lens.name === lensName);
        if (existingLens) {
            if (!confirm('A lens named "' + lensName + '" already exists. Do you want to overwrite it?')) {
                return;
            }
            // Remove existing lens
            this.savedLenses = this.savedLenses.filter(lens => lens.name !== lensName);
        }

        // Create lens configuration object
        const lensConfig = {
            name: lensName,
            description: description,
            selectedDimensions: [...this.selectedDimensions],
            selectedMetrics: [...this.selectedMetrics],
            metricAggregations: { ...this.metricAggregations },
            chartType: this.chartType,
            selectedFilters: [...this.selectedFilters],
            dimensionFilters: { ...this.dimensionFilters },
            currentFilters: { ...this.currentFilters },
            dateTimeFilters: { ...this.dateTimeFilters },
            sortColumn: this.sortColumn,
            sortDirection: this.sortDirection,
            ignoredRows: Array.from(this.ignoredRows), // Convert Set to Array for serialization
            savedAt: new Date().toISOString()
        };

        // Add to saved lenses array
        this.savedLenses.push(lensConfig);

        // Update the dropdown
        this.updateLensDropdown();

        // Close modal
        modal.style.display = 'none';

        // Show success message
        alert('Lens "' + lensName + '" saved successfully!');

        // Save to backend
        const timestamp = Math.floor(Date.now() / 1000); // Epoch timestamp
        const lensConfigString = JSON.stringify(lensConfig);
        saveLenseInBackend(lensConfigString, timestamp);
    }

    loadLens(lensName) {
        const lens = this.savedLenses.find(l => l.name === lensName);
        if (!lens) {
            alert('Lens not found!');
            return;
        }

        // Clear existing filters first
        this.selectedDimensions = [];
        this.selectedMetrics = [];
        this.metricAggregations = {};
        this.selectedFilters = [];
        this.dimensionFilters = {};
        this.currentFilters = {};
        this.dateTimeFilters = {};
        this.ignoredRows.clear();
        this.sortedGroups = null;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.filteredData = [...this.parsedData];

        // Clear all DOM filter selections
        this.clearAllDOMFilterSelections();

        // Restore lens configuration
        this.selectedDimensions = [...(lens.selectedDimensions || [])];
        this.selectedMetrics = [...(lens.selectedMetrics || [])];
        this.metricAggregations = { ...(lens.metricAggregations || {}) };
        this.chartType = lens.chartType || 'bar';
        this.selectedFilters = [...(lens.selectedFilters || [])];
        this.dimensionFilters = { ...(lens.dimensionFilters || {}) };
        this.currentFilters = { ...(lens.currentFilters || {}) };
        this.dateTimeFilters = { ...(lens.dateTimeFilters || {}) };
        this.sortColumn = lens.sortColumn;
        this.sortDirection = lens.sortDirection || 'asc';
        this.ignoredRows = new Set(lens.ignoredRows || []); // Restore ignored rows

        // Update field palette and preserve existing selections
        this.updateFieldPalettePreservingSelections();
        
        // Update UI
        this.updateDropZone('dimensionsArea', this.selectedDimensions);
        this.updateDropZone('metricsArea', this.selectedMetrics);
        this.updateFiltersZone();
        this.updateDropZoneCounts();
        this.updateFieldItemIcons();
        
        // Update chart type buttons
        document.getElementById('lineChartBtn').classList.toggle('active', this.chartType === 'line');
        document.getElementById('barChartBtn').classList.toggle('active', this.chartType === 'bar');

        // Setup search input with current value
        this.setupSearchInput();

        // Restore DOM filter states after ensuring all UI updates are complete
        // Use requestAnimationFrame to ensure DOM is fully rendered
        requestAnimationFrame(() => {
            setTimeout(() => {
                //console.log('DEBUG: Restoring DOM filter states after lens load');
                try {
                    this.restoreDOMFilterStates();
                    //console.log('DEBUG: restoreDOMFilterStates completed successfully');
                } catch (error) {
                    //console.error('DEBUG: Error in restoreDOMFilterStates:', error);
                }
            }, 200);
        });

        // Apply filters first to update filteredData, then re-render the chart
        this.applyFilters();
        this.renderLensChart();

        // Reset the dropdown selection
        document.getElementById('loadLensSelect').value = '';
    }

    updateLensDropdown() {
        const select = document.getElementById('loadLensSelect');
        if (!select) return;

        // Clear existing options except the first one
        select.innerHTML = '<option value="">Load Lens...</option>';

        // Add saved lenses
        this.savedLenses.forEach(lens => {
            const option = document.createElement('option');
            option.value = lens.name;
            option.textContent = lens.name;
            select.appendChild(option);
        });
    }

    applyFilters() {
        //console.log('DEBUG: applyFilters() called with search term:', this.currentFilters.search);
        //console.log('DEBUG: Original data length:', this.parsedData.length);
        
        this.filteredData = this.parsedData.filter(row => {
            // Use detected dimensions for filtering
            const primaryDimensions = this.dimensions.slice(0, 2);
            
            if (this.currentFilters.cell && primaryDimensions[0] && row[primaryDimensions[0]] !== this.currentFilters.cell) return false;
            if (this.currentFilters.instance && primaryDimensions[1] && row[primaryDimensions[1]] !== this.currentFilters.instance) return false;
            if (this.currentFilters.search) {
                const searchTerm = this.currentFilters.search.toLowerCase();
                const searchableText = Object.values(row).join(' ').toLowerCase();
                const matches = searchableText.includes(searchTerm);
                if (!matches) return false;
            }
            
            // Apply date/time filters
            const dateTimeFilterPass = Object.keys(this.dateTimeFilters).every(dimension => {
                const filter = this.dateTimeFilters[dimension];
                const value = row[dimension];
                
                if (!value) return true; // Skip if no value
                
                try {
                    const dateValue = new Date(value);
                    if (isNaN(dateValue.getTime())) return true; // Skip if not a valid date
                    
                    if (filter.type === 'relative') {
                        const now = new Date();
                        const diffMs = now - dateValue;
                        
                        switch (filter.period) {
                            case 'last_hour':
                                return diffMs <= 60 * 60 * 1000;
                            case 'last_24h':
                                return diffMs <= 24 * 60 * 60 * 1000;
                            case 'last_7d':
                                return diffMs <= 7 * 24 * 60 * 60 * 1000;
                            case 'last_30d':
                                return diffMs <= 30 * 24 * 60 * 60 * 1000;
                            case 'last_90d':
                                return diffMs <= 90 * 24 * 60 * 60 * 1000;
                            default:
                                return true;
                        }
                    } else if (filter.type === 'absolute') {
                        if (filter.from) {
                            const fromDate = new Date(filter.from);
                            if (dateValue < fromDate) return false;
                        }
                        if (filter.to) {
                            const toDate = new Date(filter.to);
                            if (dateValue > toDate) return false;
                        }
                        return true;
                    }
                } catch (e) {
                    return true; // Skip if date parsing fails
                }
                
                return true;
            });
            
            // Apply metric filters
            const metricFilterPass = this.selectedFilters.every(filter => {
                const value = row[filter.metric];
                if (value === null || value === undefined || value === '') return true; // Skip if no value
                
                // Handle date range filters
                if (filter.operator === 'date_range') {
                    if (!filter.value1 && !filter.value2) return true; // No date filter set
                    
                    const rowDate = this.parseTimestamp(value);
                    if (isNaN(rowDate)) return true; // Skip if not a valid date
                    
                    if (filter.value1) {
                        const fromDate = new Date(filter.value1).getTime();
                        if (rowDate < fromDate) return false;
                    }
                    
                    if (filter.value2) {
                        const toDate = new Date(filter.value2).getTime();
                        if (rowDate > toDate) return false;
                    }
                    
                    return true;
                }
                
                // Handle numeric filters
                const numValue = parseFloat(value);
                if (isNaN(numValue)) return true; // Skip if not numeric
                
                const filterValue1 = parseFloat(filter.value1);
                const filterValue2 = parseFloat(filter.value2);
                
                if (isNaN(filterValue1) && filter.operator !== 'between') return true; // Skip if no filter value
                if (filter.operator === 'between' && (isNaN(filterValue1) || isNaN(filterValue2))) return true;
                
                switch (filter.operator) {
                    case 'between':
                        return numValue >= filterValue1 && numValue <= filterValue2;
                    case 'less than':
                        return numValue < filterValue1;
                    case 'less than or equal':
                        return numValue <= filterValue1;
                    case 'greater than':
                        return numValue > filterValue1;
                    case 'greater than or equal':
                        return numValue >= filterValue1;
                    case 'equal':
                        return numValue === filterValue1;
                    case 'not equal':
                        return numValue !== filterValue1;
                    default:
                        return true;
                }
            });
            
            // Apply dimension filters
            const dimensionFilterPass = Object.keys(this.dimensionFilters).every(dimensionName => {
                const dimensionFilter = this.dimensionFilters[dimensionName];
                const value = row[dimensionName];
                
                // If no values selected (All), include the row
                if (dimensionFilter.selectedValues.length === 0) {
                    return true;
                }
                
                // Check if the row's value is in the selected values
                return dimensionFilter.selectedValues.includes(value);
            });
            
            return dateTimeFilterPass && metricFilterPass && dimensionFilterPass;
        });
        
        //console.log('DEBUG: Filtered data length after search:', this.filteredData.length);
        //console.log('DEBUG: Calling renderLensChart()');
        this.renderLensChart();
    }

    switchView(view) {
        const tableView = document.getElementById('waveTable');
        const chartView = document.getElementById('waveCharts');
        const tableBtn = document.getElementById('tableViewBtn');
        const chartBtn = document.getElementById('chartViewBtn');
        
        if (view === 'table') {
            tableView.style.display = 'block';
            chartView.style.display = 'none';
            tableBtn.classList.add('active');
            chartBtn.classList.remove('active');
        } else {
            tableView.style.display = 'none';
            chartView.style.display = 'grid';
            tableBtn.classList.remove('active');
            chartBtn.classList.add('active');
        }
    }

    formatHeader(header) {
        // Handle both string and object inputs
        const headerString = typeof header === 'string' ? header : (header.name || header.toString());
        return headerString.replace(/%c/g, ' (%)').replace(/([A-Z])/g, ' $1').trim();
    }

    formatValue(value) {
        // Handle both number and string timestamps
        let numericValue = value;
        if (typeof value === 'string') {
            numericValue = this.safeParseFloat(value);
        }
        
        if (typeof numericValue === 'number' && !isNaN(numericValue)) {
            // Check if this is a timestamp (epoch) - typically large numbers representing milliseconds since 1970
            if (numericValue > 1000000000000 && numericValue < 4102444800000) { // Between 2001 and 2100
                const date = new Date(numericValue);
                if (!isNaN(date.getTime())) {
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const month = monthNames[date.getMonth()];
                    const day = date.getDate();
                    const dayOfWeek = dayNames[date.getDay()];
                    return month + ' ' + day + this.getOrdinalSuffix(day) + ' (' + dayOfWeek + ')';
                }
            }
            return numericValue.toFixed(2);
        }
        return value || '';
    }

    getOrdinalSuffix(day) {
        if (day >= 11 && day <= 13) {
            return 'th';
        }
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

    formatValueForTable(value) {
        // Handle both number and string timestamps
        let numericValue = value;
        if (typeof value === 'string') {
            numericValue = this.safeParseFloat(value);
        }
        
        if (typeof numericValue === 'number' && !isNaN(numericValue)) {
            // Check if this is a timestamp (epoch) - typically large numbers representing milliseconds since 1970
            // Expanded range to catch more timestamp formats
            if (numericValue > 1000000000000 && numericValue < 5000000000000) { // Between 2001 and 2128
                const date = new Date(numericValue);
                if (!isNaN(date.getTime())) {
                    // Format: yyyy-mm-dd hr:mm:ss SSS UTC (ddd)
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const seconds = String(date.getSeconds()).padStart(2, '0');
                    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
                    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const dayOfWeek = dayNames[date.getDay()];
                    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${milliseconds} UTC (${dayOfWeek})`;
                }
            }
            return numericValue.toFixed(2);
        }
        return value || '';
    }

    formatValueForTooltip(value) {
        // Handle both number and string timestamps
        let numericValue = value;
        if (typeof value === 'string') {
            numericValue = this.safeParseFloat(value);
        }
        
        if (typeof numericValue === 'number' && !isNaN(numericValue)) {
            // Check if this is a timestamp (epoch) - typically large numbers representing milliseconds since 1970
            if (numericValue > 1000000000000 && numericValue < 4102444800000) { // Between 2001 and 2100
                const date = new Date(numericValue);
                if (!isNaN(date.getTime())) {
                    // Use normal datetime string format for tooltips (without year)
                    return date.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                    });
                }
            }
            return numericValue.toFixed(2);
        }
        return value || '';
    }

    formatGroupKeyForDisplay(groupKey) {
        // Handle multi-dimensional group keys (e.g., "timestamp | dimension")
        if (groupKey && groupKey.includes(' | ')) {
            const parts = groupKey.split(' | ');
            const formattedParts = parts.map(part => this.formatValueForTable(part));
            return formattedParts.join(' | ');
        }
        return this.formatValueForTable(groupKey);
    }

    formatGroupKeyForTooltip(groupKey) {
        // Handle multi-dimensional group keys for tooltips (e.g., "timestamp | dimension")
        if (groupKey && groupKey.includes(' | ')) {
            const parts = groupKey.split(' | ');
            const formattedParts = parts.map(part => this.formatValueForTooltip(part));
            return formattedParts.join(' | ');
        }
        return this.formatValueForTooltip(groupKey);
    }

    truncateText(text, maxWidth) {
        // Calculate approximate character width (assuming average 8px per character for 11px Arial font)
        const avgCharWidth = 8;
        const maxChars = Math.floor(maxWidth / avgCharWidth);
        
        if (text.length <= maxChars) {
            return text;
        }
        return text.substring(0, maxChars - 3) + '...';
    }

    createCompleteSVGLineChart(data, width, height) {
        // Extract data components
        const groups = Object.keys(data);
        const metrics = this.selectedMetrics;
        const colors = this.generateColorsForMetrics(metrics);
        
        // Create SVG container
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.pointerEvents = 'auto'; // Enable pointer events
        
        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'chart-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 10px 14px;
            border-radius: 6px;
            font-size: 12px;
            font-family: Arial, sans-serif;
            pointer-events: none;
            z-index: 10000;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            max-width: 280px;
            line-height: 1.5;
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(4px);
        `;
        document.body.appendChild(tooltip);
        
        // Calculate spacing (same as canvas version)
        const legendWidth = this.calculateLineChartLegendWidth(metrics);
        const spacing = this.calculateChartSpacing(width - legendWidth, height, groups, metrics);
        
        const chartWidth = spacing.chartWidth;
        const chartHeight = spacing.chartHeight;
        const yAxisPadding = spacing.yAxisPadding;
        const topPadding = spacing.topPadding;
        const bottomPadding = spacing.bottomPadding;
        const rightPadding = spacing.rightPadding;
        
        // Find min/max values (including negative values)
        let minValue = Infinity;
        let maxValue = -Infinity;
        groups.forEach(group => {
            metrics.forEach(metricName => {
                const selectedAggregations = this.getMetricAggregations(metricName);
                selectedAggregations.forEach(aggregationType => {
                    const key = metricName + '_' + aggregationType;
                    const value = data[group] && data[group][key];
                    if (value !== undefined && value !== null) {
                        minValue = Math.min(minValue, value);
                        maxValue = Math.max(maxValue, value);
                    }
                });
            });
        });
        
        // Add some padding to the value range
        const valueRange = maxValue - minValue;
        const padding = valueRange * 0.1;
        minValue -= padding;
        maxValue += padding;
        const adjustedValueRange = maxValue - minValue;
        
        // Draw chart background
        const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        background.setAttribute('x', yAxisPadding);
        background.setAttribute('y', topPadding);
        background.setAttribute('width', chartWidth);
        background.setAttribute('height', chartHeight);
        background.setAttribute('fill', '#ffffff');
        background.setAttribute('stroke', '#dddbda');
        background.setAttribute('stroke-width', '1');
        svg.appendChild(background);
        
        // Draw Y-axis grid lines and labels
        for (let i = 0; i <= 5; i++) {
            const value = minValue + (i / 5) * adjustedValueRange;
            const y = topPadding + chartHeight - (i / 5) * chartHeight;
            
            // Grid line
            const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            gridLine.setAttribute('x1', yAxisPadding);
            gridLine.setAttribute('y1', y);
            gridLine.setAttribute('x2', yAxisPadding + chartWidth);
            gridLine.setAttribute('y2', y);
            gridLine.setAttribute('stroke', '#f3f2f2');
            gridLine.setAttribute('stroke-width', '1');
            svg.appendChild(gridLine);
            
            // Y-axis label
            const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            yLabel.setAttribute('x', yAxisPadding - 10);
            yLabel.setAttribute('y', y + 4);
            yLabel.setAttribute('text-anchor', 'end');
            yLabel.setAttribute('font-family', 'Arial, sans-serif');
            yLabel.setAttribute('font-size', '11px');
            yLabel.setAttribute('fill', '#666');
            yLabel.textContent = this.formatValue(value);
            svg.appendChild(yLabel);
        }
        
        // Draw Y-axis line
        const yAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        yAxisLine.setAttribute('x1', yAxisPadding);
        yAxisLine.setAttribute('y1', topPadding);
        yAxisLine.setAttribute('x2', yAxisPadding);
        yAxisLine.setAttribute('y2', topPadding + chartHeight);
        yAxisLine.setAttribute('stroke', '#dddbda');
        yAxisLine.setAttribute('stroke-width', '1');
        svg.appendChild(yAxisLine);
        
        // Draw X-axis line
        const xAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        xAxisLine.setAttribute('x1', yAxisPadding);
        xAxisLine.setAttribute('y1', topPadding + chartHeight);
        xAxisLine.setAttribute('x2', yAxisPadding + chartWidth);
        xAxisLine.setAttribute('y2', topPadding + chartHeight);
        xAxisLine.setAttribute('stroke', '#dddbda');
        xAxisLine.setAttribute('stroke-width', '1');
        svg.appendChild(xAxisLine);
        
        // Draw lines and points for each metric
        metrics.forEach((metricName) => {
            const selectedAggregations = this.getMetricAggregations(metricName);
            selectedAggregations.forEach(aggregationType => {
                const key = metricName + '_' + aggregationType;
                const color = colors[key] || '#0070d2';
                
                // Create line path
                const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                let pathData = '';
                let firstPoint = true;
                
                groups.forEach((group, groupIndex) => {
                    const value = data[group] && data[group][key];
                    if (value !== undefined && value !== null) {
                        const x = groups.length === 1 ? 
                            yAxisPadding + chartWidth / 2 : 
                            yAxisPadding + (groupIndex / (groups.length - 1)) * chartWidth;
                        const y = topPadding + chartHeight - ((value - minValue) / adjustedValueRange) * chartHeight;
                        
                        if (firstPoint) {
                            pathData += 'M ' + x + ' ' + y;
                            firstPoint = false;
                        } else {
                            pathData += ' L ' + x + ' ' + y;
                        }
                    }
                });
                
                if (pathData && groups.length > 1) {
                    linePath.setAttribute('d', pathData);
                    linePath.setAttribute('stroke', color);
                    linePath.setAttribute('stroke-width', '2');
                    linePath.setAttribute('fill', 'none');
                    svg.appendChild(linePath);
                }
                
                // Create interactive points
                groups.forEach((group, groupIndex) => {
                    const value = data[group] && data[group][key];
                    if (value !== undefined && value !== null) {
                        const x = groups.length === 1 ? 
                            yAxisPadding + chartWidth / 2 : 
                            yAxisPadding + (groupIndex / (groups.length - 1)) * chartWidth;
                        const y = topPadding + chartHeight - ((value - minValue) / adjustedValueRange) * chartHeight;
                        
                        // Create invisible larger circle for hit detection
                        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                        hitArea.setAttribute('cx', x);
                        hitArea.setAttribute('cy', y);
                        hitArea.setAttribute('r', '8');
                        hitArea.setAttribute('fill', 'transparent');
                        hitArea.style.pointerEvents = 'all';
                        hitArea.style.cursor = 'pointer';
                        
                        // Create visible point
                        const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                        point.setAttribute('cx', x);
                        point.setAttribute('cy', y);
                        point.setAttribute('r', '3');
                        point.setAttribute('fill', color);
                        
                        // Add hover effects
                        hitArea.addEventListener('mouseenter', (event) => {
                            point.setAttribute('r', '5');
                            point.setAttribute('stroke', 'white');
                            point.setAttribute('stroke-width', '2');
                            
                            // Handle group name formatting for multi-dimensional groups
                            const groupName = this.formatGroupKeyForTooltip(group) || 'Unknown';
                            const formattedMetric = this.formatHeader(metricName);
                            const formattedAggregation = aggregationType.charAt(0).toUpperCase() + aggregationType.slice(1);
                            
                            let tooltipContent = '<strong>' + groupName + '</strong><br/>';
                            tooltipContent += formattedMetric + ' (' + formattedAggregation + '): ' + this.formatValue(value);
                            
                            tooltip.innerHTML = tooltipContent;
                            tooltip.style.display = 'block';
                            tooltip.style.left = event.clientX + 15 + 'px';
                            tooltip.style.top = event.clientY - 10 + 'px';
                        });
                        
                        hitArea.addEventListener('mouseleave', () => {
                            point.setAttribute('r', '3');
                            point.removeAttribute('stroke');
                            point.removeAttribute('stroke-width');
                            tooltip.style.display = 'none';
                        });
                        
                        hitArea.addEventListener('mousemove', (event) => {
                            tooltip.style.left = event.clientX + 15 + 'px';
                            tooltip.style.top = event.clientY - 10 + 'px';
                        });
                        
                        svg.appendChild(hitArea);
                        svg.appendChild(point);
                    }
                });
            });
        });
        
        // Draw X-axis labels (group labels)
        groups.forEach((group, groupIndex) => {
            const x = groups.length === 1 ? 
                yAxisPadding + chartWidth / 2 : 
                yAxisPadding + (groupIndex / (groups.length - 1)) * chartWidth;
            const y = topPadding + chartHeight + 20;
            
            const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            xLabel.setAttribute('x', x);
            xLabel.setAttribute('y', y);
            xLabel.setAttribute('text-anchor', 'middle');
            xLabel.setAttribute('font-family', 'Arial, sans-serif');
            xLabel.setAttribute('font-size', '11px');
            xLabel.setAttribute('fill', '#666');
            xLabel.textContent = this.truncateText(group.toString(), 15);
            svg.appendChild(xLabel);
        });
        
        // Draw legend on the right side
        this.drawSVGLineChartLegend(svg, metrics, colors, width, height, legendWidth);
        
        return svg;
    }

    drawSVGLineChartLegend(svg, metrics, colors, width, height, legendWidth) {
        const legendX = width - legendWidth + 20;
        let legendY = 50;
        
        metrics.forEach((metricName) => {
            const selectedAggregations = this.getMetricAggregations(metricName);
            selectedAggregations.forEach(aggregationType => {
                const key = metricName + '_' + aggregationType;
                const color = colors[key] || '#0070d2';
                
                // Legend line
                const legendLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                legendLine.setAttribute('x1', legendX);
                legendLine.setAttribute('y1', legendY);
                legendLine.setAttribute('x2', legendX + 20);
                legendLine.setAttribute('y2', legendY);
                legendLine.setAttribute('stroke', color);
                legendLine.setAttribute('stroke-width', '2');
                svg.appendChild(legendLine);
                
                // Legend text
                const legendText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                legendText.setAttribute('x', legendX + 25);
                legendText.setAttribute('y', legendY + 4);
                legendText.setAttribute('font-family', 'Arial, sans-serif');
                legendText.setAttribute('font-size', '11px');
                legendText.setAttribute('fill', '#333');
                const formattedMetric = this.formatHeader(metricName);
                const formattedAggregation = aggregationType.charAt(0).toUpperCase() + aggregationType.slice(1);
                legendText.textContent = formattedMetric + ' (' + formattedAggregation + ')';
                svg.appendChild(legendText);
                
                legendY += 20;
            });
        });
    }

    createCompleteSVGBarChart(data, width, height) {
        // Extract data components
        const groups = Object.keys(data);
        const metrics = this.selectedMetrics;
        const colors = this.generateColorsForMetrics(metrics);
        
        // Create SVG container
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.pointerEvents = 'auto'; // Enable pointer events
        
        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'chart-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 10px 14px;
            border-radius: 6px;
            font-size: 12px;
            font-family: Arial, sans-serif;
            pointer-events: none;
            z-index: 10000;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            max-width: 280px;
            line-height: 1.5;
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(4px);
        `;
        document.body.appendChild(tooltip);
        
        // Calculate spacing (same as canvas version)
        const legendWidth = this.calculateBarChartLegendWidth(metrics);
        const spacing = this.calculateChartSpacing(width - legendWidth, height, groups, metrics);
        
        const chartWidth = spacing.chartWidth;
        const chartHeight = spacing.chartHeight;
        const yAxisPadding = spacing.yAxisPadding;
        const topPadding = spacing.topPadding;
        const bottomPadding = spacing.bottomPadding;
        const rightPadding = spacing.rightPadding;
        
        // Calculate bar dimensions
        const groupWidth = chartWidth / groups.length;
        const totalBarsPerGroup = metrics.reduce((total, metricName) => {
            const selectedAggregations = this.getMetricAggregations(metricName);
            return total + selectedAggregations.length;
        }, 0);
        const barWidth = Math.max(10, (groupWidth - 20) / totalBarsPerGroup);
        const barSpacing = 10;
        
        // Find max value (including negative values)
        let maxValue = 0;
        let minValue = 0;
        groups.forEach(group => {
            metrics.forEach(metricName => {
                const selectedAggregations = this.getMetricAggregations(metricName);
                selectedAggregations.forEach(aggregationType => {
                    const key = metricName + '_' + aggregationType;
                    const value = data[group] && data[group][key];
                    if (value !== undefined && value !== null) {
                        maxValue = Math.max(maxValue, value);
                        minValue = Math.min(minValue, value);
                    }
                });
            });
        });
        
        // Add some padding to the value range
        const valueRange = maxValue - minValue;
        const padding = valueRange * 0.1;
        maxValue += padding;
        minValue -= padding;
        const adjustedValueRange = maxValue - minValue;
        
        // Draw chart background
        const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        background.setAttribute('x', yAxisPadding);
        background.setAttribute('y', topPadding);
        background.setAttribute('width', chartWidth);
        background.setAttribute('height', chartHeight);
        background.setAttribute('fill', '#ffffff');
        background.setAttribute('stroke', '#dddbda');
        background.setAttribute('stroke-width', '1');
        svg.appendChild(background);
        
        // Draw Y-axis grid lines and labels
        for (let i = 0; i <= 5; i++) {
            const value = minValue + (i / 5) * adjustedValueRange;
            const y = topPadding + chartHeight - (i / 5) * chartHeight;
            
            // Grid line
            const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            gridLine.setAttribute('x1', yAxisPadding);
            gridLine.setAttribute('y1', y);
            gridLine.setAttribute('x2', yAxisPadding + chartWidth);
            gridLine.setAttribute('y2', y);
            gridLine.setAttribute('stroke', '#f3f2f2');
            gridLine.setAttribute('stroke-width', '1');
            svg.appendChild(gridLine);
            
            // Y-axis label
            const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            yLabel.setAttribute('x', yAxisPadding - 10);
            yLabel.setAttribute('y', y + 4);
            yLabel.setAttribute('text-anchor', 'end');
            yLabel.setAttribute('font-family', 'Arial, sans-serif');
            yLabel.setAttribute('font-size', '11px');
            yLabel.setAttribute('fill', '#666');
            yLabel.textContent = this.formatValue(value);
            svg.appendChild(yLabel);
        }
        
        // Draw Y-axis line
        const yAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        yAxisLine.setAttribute('x1', yAxisPadding);
        yAxisLine.setAttribute('y1', topPadding);
        yAxisLine.setAttribute('x2', yAxisPadding);
        yAxisLine.setAttribute('y2', topPadding + chartHeight);
        yAxisLine.setAttribute('stroke', '#dddbda');
        yAxisLine.setAttribute('stroke-width', '1');
        svg.appendChild(yAxisLine);
        
        // Draw X-axis line
        const xAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        xAxisLine.setAttribute('x1', yAxisPadding);
        xAxisLine.setAttribute('y1', topPadding + chartHeight);
        xAxisLine.setAttribute('x2', yAxisPadding + chartWidth);
        xAxisLine.setAttribute('y2', topPadding + chartHeight);
        xAxisLine.setAttribute('stroke', '#dddbda');
        xAxisLine.setAttribute('stroke-width', '1');
        svg.appendChild(xAxisLine);
        
        // Draw bars for each group and metric
        groups.forEach((group, groupIndex) => {
            const groupX = yAxisPadding + groupIndex * groupWidth;
            const groupData = data[group];
            
            if (groupData) {
                let metricIndex = 0;
                
                metrics.forEach((metricName) => {
                    const selectedAggregations = this.getMetricAggregations(metricName);
                    selectedAggregations.forEach(aggregationType => {
                        const key = metricName + '_' + aggregationType;
                        const value = groupData[key];
                        
                        if (value !== undefined && value !== null) {
                            const barHeight = Math.abs((value - minValue) / adjustedValueRange) * chartHeight;
                            const x = groupX + barSpacing + metricIndex * barWidth;
                            const y = value >= 0 ? 
                                topPadding + chartHeight - ((value - minValue) / adjustedValueRange) * chartHeight :
                                topPadding + chartHeight - ((0 - minValue) / adjustedValueRange) * chartHeight;
                            const width = barWidth * 0.9;
                            
                            // Create interactive bar
                            const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                            bar.setAttribute('x', x);
                            bar.setAttribute('y', y);
                            bar.setAttribute('width', width);
                            bar.setAttribute('height', barHeight);
                            bar.setAttribute('fill', colors[key] || '#0070d2');
                            bar.style.pointerEvents = 'all';
                            bar.style.cursor = 'pointer';
                            
                            // Add hover effects
                            bar.addEventListener('mouseenter', (event) => {
                                bar.setAttribute('stroke', 'white');
                                bar.setAttribute('stroke-width', '2');
                                bar.setAttribute('opacity', '0.8');
                                
                                // Handle group name formatting for multi-dimensional groups
                            const groupName = this.formatGroupKeyForTooltip(group) || 'Unknown';
                                const formattedMetric = this.formatHeader(metricName);
                                const formattedAggregation = aggregationType.charAt(0).toUpperCase() + aggregationType.slice(1);
                                
                                let tooltipContent = '<strong>' + groupName + '</strong><br/>';
                                tooltipContent += formattedMetric + ' (' + formattedAggregation + '): ' + this.formatValue(value);
                                
                                tooltip.innerHTML = tooltipContent;
                                tooltip.style.display = 'block';
                                tooltip.style.left = event.clientX + 15 + 'px';
                                tooltip.style.top = event.clientY - 10 + 'px';
                            });
                            
                            bar.addEventListener('mouseleave', () => {
                                bar.removeAttribute('stroke');
                                bar.removeAttribute('stroke-width');
                                bar.removeAttribute('opacity');
                                tooltip.style.display = 'none';
                            });
                            
                            bar.addEventListener('mousemove', (event) => {
                                tooltip.style.left = event.clientX + 15 + 'px';
                                tooltip.style.top = event.clientY - 10 + 'px';
                            });
                            
                            svg.appendChild(bar);
                        }
                        
                        metricIndex++;
                    });
                });
            }
        });
        
        // Draw X-axis labels (group labels)
        groups.forEach((group, groupIndex) => {
            const x = yAxisPadding + groupIndex * groupWidth + groupWidth / 2;
            const y = topPadding + chartHeight + 20;
            
            const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            xLabel.setAttribute('x', x);
            xLabel.setAttribute('y', y);
            xLabel.setAttribute('text-anchor', 'middle');
            xLabel.setAttribute('font-family', 'Arial, sans-serif');
            xLabel.setAttribute('font-size', '11px');
            xLabel.setAttribute('fill', '#666');
            xLabel.textContent = this.truncateText(group.toString(), 15);
            svg.appendChild(xLabel);
        });
        
        // Draw legend on the right side
        this.drawSVGBarChartLegend(svg, metrics, colors, width, height, legendWidth);
        
        return svg;
    }

    drawSVGBarChartLegend(svg, metrics, colors, width, height, legendWidth) {
        const legendX = width - legendWidth + 20;
        let legendY = 50;
        
        metrics.forEach((metricName) => {
            const selectedAggregations = this.getMetricAggregations(metricName);
            selectedAggregations.forEach(aggregationType => {
                const key = metricName + '_' + aggregationType;
                const color = colors[key] || '#0070d2';
                
                // Legend square
                const legendSquare = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                legendSquare.setAttribute('x', legendX);
                legendSquare.setAttribute('y', legendY - 8);
                legendSquare.setAttribute('width', '12');
                legendSquare.setAttribute('height', '12');
                legendSquare.setAttribute('fill', color);
                svg.appendChild(legendSquare);
                
                // Legend text
                const legendText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                legendText.setAttribute('x', legendX + 18);
                legendText.setAttribute('y', legendY + 2);
                legendText.setAttribute('font-family', 'Arial, sans-serif');
                legendText.setAttribute('font-size', '11px');
                legendText.setAttribute('fill', '#333');
                const formattedMetric = this.formatHeader(metricName);
                const formattedAggregation = aggregationType.charAt(0).toUpperCase() + aggregationType.slice(1);
                legendText.textContent = formattedMetric + ' (' + formattedAggregation + ')';
                svg.appendChild(legendText);
                
                legendY += 20;
            });
        });
    }

    createSVGBarChart(data, groups, metrics, colors, yAxisPadding, topPadding, chartWidth, chartHeight, maxValue, groupWidth, barWidth, barSpacing, width, height) {
        // Create SVG container
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.pointerEvents = 'auto'; // Enable pointer events
        
        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'chart-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 10px 14px;
            border-radius: 6px;
            font-size: 12px;
            font-family: Arial, sans-serif;
            pointer-events: none;
            z-index: 10000;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            max-width: 280px;
            line-height: 1.5;
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(4px);
        `;
        document.body.appendChild(tooltip);
        
        // Draw bars for each group and metric
        groups.forEach((group, groupIndex) => {
            const groupX = yAxisPadding + groupIndex * groupWidth;
            const groupData = data[group];
            
            if (groupData) {
                let metricIndex = 0;
                
                metrics.forEach((metricName) => {
                    const selectedAggregations = this.getMetricAggregations(metricName);
                    selectedAggregations.forEach(aggregationType => {
                        const key = metricName + '_' + aggregationType;
                        const value = groupData[key];
                        
                        if (value !== undefined && value !== null) {
                            const barHeight = (value / maxValue) * chartHeight;
                            const x = groupX + barSpacing + metricIndex * barWidth;
                            const y = topPadding + chartHeight - barHeight;
                            const width = barWidth * 0.9;
                            
                            // Create interactive bar
                            const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                            bar.setAttribute('x', x);
                            bar.setAttribute('y', y);
                            bar.setAttribute('width', width);
                            bar.setAttribute('height', barHeight);
                            bar.setAttribute('fill', colors[key] || '#0070d2');
                            bar.style.pointerEvents = 'all';
                            bar.style.cursor = 'pointer';
                            
                            // Add hover effects
                            bar.addEventListener('mouseenter', (event) => {
                                bar.setAttribute('stroke', 'white');
                                bar.setAttribute('stroke-width', '2');
                                bar.setAttribute('opacity', '0.8');
                                
                                // Handle group name formatting for multi-dimensional groups
                            const groupName = this.formatGroupKeyForTooltip(group) || 'Unknown';
                                const formattedMetric = this.formatHeader(metricName);
                                const formattedAggregation = aggregationType.charAt(0).toUpperCase() + aggregationType.slice(1);
                                
                                let tooltipContent = '<strong>' + groupName + '</strong><br/>';
                                tooltipContent += formattedMetric + ' (' + formattedAggregation + '): ' + this.formatValue(value);
                                
                                tooltip.innerHTML = tooltipContent;
                                tooltip.style.display = 'block';
                                tooltip.style.left = event.clientX + 15 + 'px';
                                tooltip.style.top = event.clientY - 10 + 'px';
                            });
                            
                            bar.addEventListener('mouseleave', () => {
                                bar.removeAttribute('stroke');
                                bar.removeAttribute('stroke-width');
                                bar.removeAttribute('opacity');
                                tooltip.style.display = 'none';
                            });
                            
                            bar.addEventListener('mousemove', (event) => {
                                tooltip.style.left = event.clientX + 15 + 'px';
                                tooltip.style.top = event.clientY - 10 + 'px';
                            });
                            
                            svg.appendChild(bar);
                        }
                        
                        metricIndex++;
                    });
                });
            }
        });
        
        return svg;
    }

    // Force container size recalculation
    forceContainerResize() {
        // Force browser to recalculate layout
        const container = document.getElementById('lensChart');
        if (container) {
            // Trigger reflow to ensure CSS changes are applied
            container.offsetHeight;

            // Force layout recalculation
            const lensBuilder = document.querySelector('.lens-builder');
            if (lensBuilder) {
                lensBuilder.offsetHeight;
            }

            // Clear any cached dimensions
            if (container._cachedRect) {
                delete container._cachedRect;
            }

            console.log('Container size recalculated');
        }
    }

    handlePanelCollapse() {
        // When collapsing, expand containers to use full available space
        const lensDisplay = document.querySelector('.lens-display');
        const lensCanvas = document.querySelector('.lens-canvas');
        const chartContainerDiv = document.querySelector('.chart-container');
        
        if (lensDisplay) {
            lensDisplay.style.maxWidth = 'none';
            lensDisplay.style.width = 'auto';
            lensDisplay.style.flex = '1';
        }
        
        if (lensCanvas) {
            lensCanvas.style.maxWidth = 'none';
            lensCanvas.style.width = '100%';
            lensCanvas.style.flex = '1';
        }
        
        if (chartContainerDiv) {
            chartContainerDiv.style.maxWidth = 'none';
            chartContainerDiv.style.width = '100%';
            chartContainerDiv.style.flex = '1';
        }
        
        console.log('Handled panel collapse - containers expanded');
        
        // Update floating controls position after panel collapse
        setTimeout(() => {
            this.updateFloatingControlsPosition();
        }, 1000);
    }

    handlePanelExpand() {
        // When expanding, reset containers to use normal constraints
        const lensDisplay = document.querySelector('.lens-display');
        const lensCanvas = document.querySelector('.lens-canvas');
        const chartContainerDiv = document.querySelector('.chart-container');
        
        if (lensDisplay) {
            lensDisplay.style.maxWidth = '';
            lensDisplay.style.width = '';
            lensDisplay.style.flex = '';
        }
        
        if (lensCanvas) {
            lensCanvas.style.maxWidth = '';
            lensCanvas.style.width = '';
            lensCanvas.style.flex = '';
        }
        
        if (chartContainerDiv) {
            chartContainerDiv.style.maxWidth = '';
            chartContainerDiv.style.width = '';
            chartContainerDiv.style.flex = '';
        }
        
        console.log('Handled panel expand - containers reset');
        
        // Update floating controls position after panel expand
        setTimeout(() => {
            this.updateFloatingControlsPosition();
        }, 1000);
    }

    // Initialize collapse functionality for categories panel
    initializeCollapsePanel() {
        // Store reference to avoid re-initialization
        if (this.collapseInitialized) {
            console.log('Collapse already initialized, skipping...');
            return;
        }
        
        // Try multiple times to find elements
        let attempts = 0;
        const maxAttempts = 10;
        
        const tryInitialize = () => {
            attempts++;
            const collapseBtn = document.getElementById('collapseBtn');
            const fieldPalette = document.getElementById('fieldPalette');
            
            console.log('Attempt ' + attempts + ': Collapse elements found:', { 
                collapseBtn: !!collapseBtn, 
                fieldPalette: !!fieldPalette,
                collapseBtnElement: collapseBtn,
                fieldPaletteElement: fieldPalette
            });
            
            if (collapseBtn && fieldPalette) {
                // Use event delegation to handle dynamic content - now works for entire header
                document.addEventListener('click', (e) => {
                    // Check if click is on palette header (including button or title)
                    const header = e.target.closest('.palette-header');
                    if (header) {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Palette header clicked!');
                        
                        const currentFieldPalette = document.getElementById('fieldPalette');
                        const collapseBtn = document.getElementById('collapseBtn');
                        
                        if (currentFieldPalette && collapseBtn) {
                            currentFieldPalette.classList.toggle('collapsed');
                            console.log('Collapsed class toggled. Current classes:', currentFieldPalette.className);
                            
                            // Update button icon and handle container resizing
                            if (currentFieldPalette.classList.contains('collapsed')) {
                                collapseBtn.innerHTML = '›';
                                collapseBtn.title = 'Expand Panel';
                                console.log('Panel collapsed - icon changed to ›');
                                
                                // Handle collapse - expand containers
                                this.handlePanelCollapse();
                            } else {
                                collapseBtn.innerHTML = '‹';
                                collapseBtn.title = 'Collapse Panel';
                                console.log('Panel expanded - icon changed to ‹');
                                
                                // Handle expand - reset containers
                                this.handlePanelExpand();
                            }
                            
                            // Re-render chart after panel state change - wait for CSS transition to complete
                            const handleTransitionEnd = () => {
                                if (this.selectedDimensions.length > 0 || this.selectedMetrics.length > 0) {
                                    console.log('Re-rendering chart after transition completed...');
                                    this.renderLensChart();
                                }
                                // Update floating controls position after transition
                                this.updateFloatingControlsPosition();
                                currentFieldPalette.removeEventListener('transitionend', handleTransitionEnd);
                            };
                            
                            // Listen for transition end event
                            currentFieldPalette.addEventListener('transitionend', handleTransitionEnd);
                            
                            // Fallback timeout in case transitionend doesn't fire
                            setTimeout(() => {
                                if (this.selectedDimensions.length > 0 || this.selectedMetrics.length > 0) {
                                    console.log('Re-rendering chart after fallback timeout...');
                                    this.renderLensChart();
                                }
                                currentFieldPalette.removeEventListener('transitionend', handleTransitionEnd);
                            }, 400);
                        } else {
                            console.error('Field palette not found!');
                        }
                    }
                });
                
                // Also add a direct click handler as backup
                collapseBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Direct collapse button clicked!');
                    
                    fieldPalette.classList.toggle('collapsed');
                    console.log('Direct handler - Collapsed class toggled. Current classes:', fieldPalette.className);
                    
                    // Update button icon
                    if (fieldPalette.classList.contains('collapsed')) {
                        collapseBtn.innerHTML = '›';
                        collapseBtn.title = 'Expand Panel';
                        console.log('Direct handler - Panel collapsed - icon changed to ›');
                    } else {
                        collapseBtn.innerHTML = '‹';
                        collapseBtn.title = 'Collapse Panel';
                        console.log('Direct handler - Panel expanded - icon changed to ‹');
                    }
                    
                    // Re-render chart to adjust width - replicate chart icon click behavior
                    setTimeout(() => {
                        if (this.selectedDimensions.length > 0 || this.selectedMetrics.length > 0) {
                            // Force container size recalculation before redraw
                            this.forceContainerResize();
                            
                            // Replicate the exact behavior of chart icon click
                            console.log('Re-rendering chart after collapse (direct handler, replicating chart icon click)...');
                            
                            // First call: like setChartType() does
                            this.renderLensChart();
                            
                            // Second call: like toggleView('chart') does
                            setTimeout(() => {
                                this.renderLensChart();
                            }, 50);
                        }
                        // Update floating controls position
                        this.updateFloatingControlsPosition();
                    }, 150);
                });
                
                this.collapseInitialized = true;
                console.log('Collapse functionality initialized successfully with event delegation');
                return true;
            } else if (attempts < maxAttempts) {
                console.log('Elements not found, retrying in 500ms... (attempt ' + attempts + '/' + maxAttempts + ')');
                setTimeout(tryInitialize, 500);
            } else {
                console.error('Failed to find collapse elements after', maxAttempts, 'attempts');
            }
            return false;
        };
        
        tryInitialize();
    }

}

        // Add CSS styles
        const style = document.createElement('style');
        style.textContent = `
            .wave-analytics-container {
                background: #ffffff;
                border-radius: 0;
                box-shadow: none;
                overflow: hidden;
                margin: 0;
                padding: 0;
                width: 100%;
                max-width: 100%;
                box-sizing: border-box;
            }
            
            .wave-search-input {
                width: 200px;
                max-width: 200px;
                height: 30px;
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 9px;
                box-sizing: border-box;
                margin-right: 8px;
                transition: border-color 0.2s ease;
            }
            
            .wave-search-input:focus {
                outline: none;
                border-color: #007bff;
                box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
            }
            
            .wave-search-input.wave-search-pending {
                border-color: #ffc107;
                background-color: #fff3cd;
            }
            
            .wave-search-input.wave-search-applied {
                border-color: #28a745;
                background-color: #d4edda;
            }
    
    .wave-header {
        position: relative;
        background: transparent;
        color: #333;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        overflow: hidden;
    }
    
    
    .wave-controls {
        width: 100%;
        display: flex;
        justify-content: flex-start;
        align-items: center;
        box-sizing: border-box;
    }
    
    .view-controls {
        display: flex;
        gap: 8px;
        align-items: center;
    }
    
    .wave-btn {
        width: 30px;
        height: 30px;
        padding: 0;
        border: 1px solid #dddbda;
        border-radius: 4px;
        background: #ffffff;
        color: #333;
        cursor: pointer;
        font-size: 16px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .wave-btn:hover {
        background: #f8f9fa;
        border-color: #0070d2;
    }
    
    .wave-btn.active {
        background: #46a5e3;
        border-color: #46a5e3;
        color: white;
    }

    .lens-select {
        height: 30px;
        padding: 4px 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #ffffff;
        color: #333;
        font-size: 9px;
        cursor: pointer;
        width: 200px;
        min-width: 200px;
        box-sizing: border-box;
    }

    .lens-select:hover {
        border-color: #007bff;
    }

    .lens-select:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }

    /* Modal Styles */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .modal-content {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px 16px;
        border-bottom: 1px solid #e5e5e5;
    }

    .modal-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #333;
    }

    .modal-close {
        background: none;
        border: none;
        font-size: 24px;
        color: #666;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
    }

    .modal-close:hover {
        background: #f5f5f5;
        color: #333;
    }

    .modal-body {
        padding: 20px 24px;
    }

    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 24px 20px;
        border-top: 1px solid #e5e5e5;
    }

    .form-group {
        margin-bottom: 20px;
    }

    .form-group label {
        display: block;
        margin-bottom: 6px;
        font-weight: 500;
        color: #333;
        font-size: 14px;
    }

    .form-input, .form-textarea {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        transition: border-color 0.2s ease;
        box-sizing: border-box;
    }

    .form-input:focus, .form-textarea:focus {
        outline: none;
        border-color: #0070d2;
        box-shadow: 0 0 0 2px rgba(0, 112, 210, 0.1);
    }

    .form-textarea {
        resize: vertical;
        min-height: 80px;
    }

    .form-help {
        font-size: 12px;
        color: #666;
        margin-top: 4px;
    }

    .lens-preview {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 4px;
        padding: 16px;
        margin-top: 16px;
    }

    .lens-preview h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        font-weight: 600;
        color: #333;
    }

    .lens-preview-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        border-bottom: 1px solid #e9ecef;
        font-size: 13px;
    }

    .lens-preview-item:last-child {
        border-bottom: none;
    }

    .lens-preview-label {
        font-weight: 500;
        color: #555;
    }

    .lens-preview-value {
        color: #0070d2;
        font-weight: 500;
    }

    .btn {
        padding: 8px 16px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 80px;
    }

    .btn-secondary {
        background: white;
        color: #333;
        border-color: #ddd;
    }

    .btn-secondary:hover {
        background: #f8f9fa;
        border-color: #bbb;
    }

    .btn-primary {
        background: #0070d2;
        color: white;
        border-color: #0070d2;
    }

    .btn-primary:hover {
        background: #005fb2;
        border-color: #005fb2;
    }

    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    
    .wave-content {
        padding: 0;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        overflow: hidden;
        position: relative; /* Enable absolute positioning for floating controls */
    }
    
    .lens-builder {
        display: flex;
        gap: 5px;
        height: 600px;
        min-height: 500px;
        overflow: hidden;
        box-sizing: border-box;
    }
    
    /* Reduce gap when panel is collapsed */
    .field-palette.collapsed ~ .lens-area {
        margin-left: 0;
    }
    
    .lens-builder:has(.field-palette.collapsed) {
        gap: 5px;
    }
    
    /* Ensure lens-builder expands when panel is collapsed */
    .lens-builder:has(.field-palette.collapsed) > *:not(.field-palette) {
        flex: 1 !important;
        width: 100% !important;
        max-width: none !important;
    }
    
    .field-palette {
        width: 200px;
        min-width: 200px;
        max-width: 200px;
        background: #f8f9fa;
        border-radius: 6px;
        padding: 6px;
        overflow-y: auto;
        transition: width 0.3s ease;
        flex-shrink: 0;
        box-sizing: border-box;
    }
    
    .field-palette.collapsed {
        width: 32px;
        min-width: 32px;
        max-width: 32px;
        padding: 6px 1px;
    }
    
    .palette-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
        padding: 4px;
        border-bottom: 1px solid #e5e5e5;
        cursor: pointer;
        border-radius: 3px;
        transition: background-color 0.2s ease;
    }
    
    .palette-header:hover {
        background-color: #f0f0f0;
    }
    
    .palette-title {
        font-weight: 600;
        color: #333;
        font-size: 14px;
    }
    
    .collapse-toggle {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        cursor: pointer;
        font-size: 16px;
        color: #495057;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        height: 24px;
        font-weight: bold;
    }
    
    .collapse-toggle:hover {
        background: #e9ecef;
        color: #212529;
        border-color: #adb5bd;
    }
    
    .field-palette.collapsed .palette-title,
    .field-palette.collapsed .category-section {
        display: none;
    }
    
    .field-palette.collapsed .palette-header {
        justify-content: center;
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
    }
    
    .field-palette.collapsed .collapse-toggle {
        padding: 2px 4px;
        margin: 0;
    }
    
    /* Reduce padding in main content when panel is collapsed */
    .field-palette.collapsed ~ .lens-area {
        padding: 4px;
    }
    
    .field-palette.collapsed ~ .lens-area .lens-chart-container {
        padding: 4px;
    }
    
    .field-palette.collapsed ~ .lens-area #lensChartCanvas {
        padding: 4px;
    }
    
    /* Maximize chart space when panel is collapsed */
    .field-palette.collapsed ~ .lens-area {
        flex: 1;
        min-width: 0;
    }
    
    .field-palette.collapsed ~ .lens-area .lens-chart-container {
        margin: 0;
        border-radius: 4px;
    }
    
    /* Force chart container to expand when panel is collapsed */
    .field-palette.collapsed ~ .lens-area #lensChart,
    .field-palette.collapsed ~ .lens-area #lensChartCanvas {
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
    }
    
    /* Additional aggressive expansion for lensChart */
    .field-palette.collapsed ~ .lens-area #lensChart {
        flex: 1 !important;
        min-width: 0 !important;
        max-width: none !important;
    }
    
    /* Move chart canvas towards left navigation panel */
    #lensChartCanvas {
        margin-left: 10px !important;
        margin-right: 20px !important;
    }
    
    .field-palette.collapsed ~ .lens-area .lens-display {
        flex: 1 !important;
        width: 100% !important;
        max-width: none !important;
        min-width: 0 !important;
    }
    
    /* More conservative expansion for chart-related containers only */
    .field-palette.collapsed ~ .lens-area {
        flex: 1 !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
    }
    
    .field-palette.collapsed ~ .lens-area .lens-chart-container,
    .field-palette.collapsed ~ .lens-area .lens-display {
        flex: 1 !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
    }
    
    .category-section {
        margin-bottom: 8px;
    }
    
    .category-header {
        margin: 0 0 8px 0;
        color: #3e3e3c;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        padding: 4px 0;
        transition: color 0.2s ease;
    }
    
    .category-header:hover {
        color: #0176d3;
    }
    
    .category-header.collapsed {
        color: #706e6b;
    }
    
    .collapse-icon {
        margin-right: 6px;
        font-size: 12px;
        transition: transform 0.2s ease;
    }
    
    .field-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    
    .field-item {
        padding: 4px 6px;
        background: white;
        border: 1px solid #dddbda;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        color: #3e3e3c;
        transition: all 0.2s ease;
        user-select: none;
    }
    
    .field-item:hover {
        background: #f8f9fa;
        border-color: #0070d2;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 112, 210, 0.1);
    }
    
    .field-item:active {
        cursor: grabbing;
    }
    
    .click-hint {
        color: #0070d2;
        font-weight: bold;
        font-size: 14px;
        margin-left: 4px;
        opacity: 0.7;
    }
    
    .field-item:hover .click-hint {
        opacity: 1;
    }
    
    .field-item.selected {
        background-color: #e8f4fd;
        border-color: #0070d2;
    }
    
    .field-item.selected .click-hint {
        color: #0070d2;
        font-weight: bold;
    }
    
    .click-hint.remove-state {
        color: #c23934;
    }
    
    .field-item.selected .click-hint.remove-state {
        color: #c23934;
    }
    
    .lens-canvas {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
        position: relative;
    }
    
    .lens-display {
        position: relative;
        z-index: 1;
    }
    
    .drop-zones {
        display: flex;
        gap: 6px;
        align-items: stretch;
        max-height: 200px;
        overflow-y: auto;
        position: relative;
        z-index: 100;
    }
    
    .drop-zone {
        flex: 1;
        background: #f8f9fa;
        border-radius: 6px;
        padding: 3px;
        min-height: 74px;
        max-height: 180px;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
    }
    
    .drop-zone-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2px;
        cursor: pointer;
        padding: 1px;
        border-radius: 3px;
        transition: background-color 0.2s ease;
    }
    
    .drop-zone-header:hover {
        background-color: #f0f0f0;
    }
    
    .drop-zone-title-section {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    
    .drop-zone h4 {
        margin: 0;
        color: #3e3e3c;
        font-size: 12px;
        font-weight: 600;
    }
    
    .drop-zone-count {
        background: #0070d2;
        color: white;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 10px;
        min-width: 16px;
        text-align: center;
        display: none; /* Hidden by default, shown when collapsed */
    }
    
    .drop-zone.collapsed .drop-zone-count {
        display: inline-block;
    }
    
    .drop-zone-collapse-btn {
        background: none;
        border: none;
        color: #706e6b;
        font-size: 14px;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 3px;
        transition: all 0.2s ease;
    }
    
    .drop-zone-collapse-btn:hover {
        background: #e5e5e5;
        color: #3e3e3c;
    }
    
    .drop-zone.collapsed .drop-zone-collapse-btn {
        transform: rotate(180deg);
    }
    
    .drop-zone.collapsed {
        min-height: 30px;
        max-height: 30px;
        overflow: hidden;
    }
    
    .drop-zone.collapsed .drop-area {
        opacity: 0;
        height: 0;
        min-height: 0;
        overflow: hidden;
        transition: all 0.3s ease;
    }
    
    .drop-zone .drop-area {
        transition: all 0.3s ease;
    }
    
    .drop-area {
        min-height: 45px;
        border: 2px dashed #dddbda;
        border-radius: 4px;
        padding: 3px;
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        align-items: flex-start;
        transition: all 0.2s ease;
        flex: 1;
    }
    
    .drop-area.drag-over {
        border-color: #0070d2;
        background: rgba(0, 112, 210, 0.1);
    }
    
    .drop-hint {
        color: #706e6b;
        font-style: italic;
        font-size: 12px;
    }
    
    .selected-item {
        background: #46a5e3;
        color: white;
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 11px;
        display: flex;
        align-items: center;
        gap: 4px;
        margin: 1px;
        min-height: 22px;
    }
    
    
    /* Specific styling for Group By items */
    #dimensionsArea .selected-item {
        padding: 6px 8px;
        min-height: 24px;
    }
    
    /* Specific styling for Values items */
    #metricsArea .selected-item {
        padding: 4px 8px;
        min-height: 22px;
    }
    
    /* Filter item styling */
    .filter-item {
        background: #f8f9fa !important;
        color: #333 !important;
        border: 1px solid #d3d3d3;
        padding: 4px 6px;
        min-height: 24px;
    }
    
    .filter-content {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
    }
    
    .filter-metric {
        font-weight: 500;
        color: #0070d2;
        width: auto;
        min-width: auto;
        margin-right: 1px;
    }
    
    
    .filter-operator {
        padding: 2px 4px;
        font-size: 12px;
        font-weight: bold;
        min-width: 50px;
        width: 60px;
        border: 1px solid #d3d3d3;
        border-radius: 3px;
        background: white;
        text-align: center;
    }
    
    .filter-input {
        padding: 2px 4px;
        font-size: 10px;
        width: 70px;
        border: 1px solid #d3d3d3;
        border-radius: 3px;
        text-align: center;
    }
    
    .filter-input::placeholder {
        font-size: 9px;
        color: #999;
    }
    
    .date-input {
        width: 146px !important;
        font-size: 8px;
        height: 20px;
        padding: 1px 4px;
    }
    
    /* Custom scrollbar styling */
    .drop-zones::-webkit-scrollbar,
    .drop-zone::-webkit-scrollbar,
    .lens-display::-webkit-scrollbar {
        width: 6px;
    }
    
    .drop-zones::-webkit-scrollbar-track,
    .drop-zone::-webkit-scrollbar-track,
    .lens-display::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
    }
    
    .drop-zones::-webkit-scrollbar-thumb,
    .drop-zone::-webkit-scrollbar-thumb,
    .lens-display::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
    }
    
    .drop-zones::-webkit-scrollbar-thumb:hover,
    .drop-zone::-webkit-scrollbar-thumb:hover,
    .lens-display::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
    }
    
    .remove-btn {
        cursor: pointer;
        font-weight: bold;
        font-size: 12px;
        line-height: 1;
    }
    
    .remove-btn:hover {
        color: #ff6b6b;
    }
    
    .chart-container {
        flex: 1;
        background: white;
        border-radius: 6px;
        padding: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 0;
        overflow: hidden;
        position: relative;
        z-index: 1;
    }
    
    .chart-placeholder {
        text-align: center;
        color: #706e6b;
        font-size: 12px;
    }
    
    .chart-placeholder p {
        margin: 0;
        font-size: 12px;
    }
    
    .table-wrapper {
        overflow: auto;
        border-radius: 3px;
        border: 1px solid #dddbda;
        max-height: 500px;
        width: 100%;
        overflow-x: auto;
        overflow-y: auto;
    }
    
    .wave-table {
        width: auto;
        min-width: 100%;
        border-collapse: collapse;
        background: white;
    }
    
    .wave-table th {
        background: #f8f9fa;
        padding: 8px 10px;
        text-align: left;
        font-weight: 600;
        color: #3e3e3c;
        border-bottom: 2px solid #dddbda;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-size: 12px;
        white-space: nowrap;
    }
    
    .wave-table td {
        padding: 8px 10px;
        border-bottom: 1px solid #dddbda;
        font-size: 11px;
        color: #3e3e3c;
        white-space: nowrap;
    }
    
    .wave-table tbody tr:hover {
        background: #f8f9fa;
    }
    
    .wave-table tbody tr:nth-child(even) {
        background: #fafbfc;
    }
    
    
    .charts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 20px;
    }
    
    .chart-container {
        background: white;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    .chart-container h3 {
        margin: 0 0 15px 0;
        color: #3e3e3c;
        font-size: 16px;
        font-weight: 600;
    }
    
    .chart-container {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        overflow: auto;
        position: relative;
        z-index: 1;
    }
    
    .chart-container canvas {
        max-width: 100%;
        max-height: 100%;
        display: block;
        margin: 0 auto;
    }
    
    
    .chart-container.expanded {
        overflow-x: auto;
        overflow-y: hidden;
    }
    
    .chart-container.expanded #lensChartCanvas {
        min-width: 100%;
    }

    .lens-display {
        flex: 1;
        background: white;
        border-radius: 6px;
        border: 1px solid #dddbda;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        min-height: 300px;
        max-height: 600px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        width: 100%;
        min-width: 0;
    }
    
    /* Horizontal scrolling for expanded charts */
    .lens-display[style*="overflow-x: auto"] {
        overflow-x: auto !important;
        overflow-y: hidden !important;
    }
    
    /* Only apply max-width when panel is NOT collapsed */
    .field-palette:not(.collapsed) ~ .lens-area .lens-display {
        max-width: calc(100vw - 250px);
    }

    .table-container {
        flex: 1;
        width: 100%;
        max-width: 100%;
        padding: 12px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .chart-placeholder, .table-placeholder {
        text-align: center;
        color: #666;
        font-size: 16px;
    }

    .table-container {
        height: 500px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .table-wrapper {
        flex: 1;
        width: 100%;
        max-width: 100%;
        max-height: 500px;
        overflow-x: auto;
        overflow-y: auto;
        border: 1px solid #dddbda;
        border-radius: 4px;
        background: white;
        min-height: 0;
        position: relative;
        /* Force horizontal scrolling to be visible */
        overflow: auto !important;
    }

    /* Force scrollbars to be visible */
    .table-wrapper::-webkit-scrollbar {
        width: 12px;
        height: 12px;
    }

    .table-wrapper::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 6px;
    }

    .table-wrapper::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 6px;
    }

    .table-wrapper::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
    }

    .wave-table {
        width: auto;
        min-width: 100%;
        border-collapse: collapse;
        font-size: 14px;
        background: white;
        table-layout: auto;
    }

    .wave-table th {
        background: #f8f9fa;
        color: #495057;
        font-weight: 600;
        padding: 8px 10px;
        text-align: left;
        border-bottom: 2px solid #dee2e6;
        white-space: nowrap;
        font-size: 12px;
    }

    .wave-table td {
        padding: 8px 10px;
        border-bottom: 1px solid #dee2e6;
        vertical-align: top;
        font-size: 11px;
        white-space: nowrap;
    }

    .wave-table tbody tr:hover {
        background: #f8f9fa;
    }

    .wave-table tbody tr:nth-child(even) {
        background: #fafbfc;
    }

    .wave-table tbody tr:nth-child(even):hover {
        background: #f1f3f4;
    }

    /* Focus only on table wrapper and children to prevent lens-canvas expansion */
    .table-wrapper {
        width: 100% !important;
        max-width: 100% !important;
        overflow-x: auto !important;
        overflow-y: auto !important;
        box-sizing: border-box !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
    }

    .wave-table {
        width: max-content !important;
        min-width: 100% !important;
        table-layout: auto !important;
        box-sizing: border-box !important;
    }

    .wave-table th,
    .wave-table td {
        white-space: nowrap !important;
        padding: 4px 6px !important;
    }


    .table-more-rows-message {
        background: #f8f9fa;
        border: 1px solid #dddbda;
        border-top: none;
        padding: 12px 16px;
        text-align: center;
        color: #3e3e3c;
        font-size: 12px;
    }

    .table-more-rows-message p {
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
    }

    .table-more-rows-message i {
        color: #0070d2;
    }

    .ignore-header {
        width: 60px;
        min-width: 60px;
        max-width: 60px;
        text-align: center;
        background: #f8f9fa;
        color: #495057;
        font-weight: 600;
        padding: 8px 5px;
        border-bottom: 2px solid #dee2e6;
        font-size: 12px;
    }

    .ignore-cell {
        width: 60px;
        min-width: 60px;
        max-width: 60px;
        text-align: center;
        padding: 8px 5px;
        border-bottom: 1px solid #dee2e6;
    }

    .ignore-checkbox {
        width: 16px;
        height: 16px;
        cursor: pointer;
    }

    .ignore-checkbox:hover {
        transform: scale(1.1);
    }

    .sortable-header {
        cursor: pointer;
        user-select: none;
        position: relative;
    }

    .sortable-header:hover {
        background: #e9ecef !important;
    }

    .sort-icon {
        margin-left: 5px;
        font-size: 10px;
        color: #6c757d;
    }

    .sortable-header:hover .sort-icon {
        color: #495057;
    }

    .wave-btn.active {
        background: #46a5e3;
        color: white;
    }
    
    .floating-chart-controls {
        position: fixed;
        top: 187px; /* Position below Load Lens dropdown */
        left: 229px; /* Align with Load Lens dropdown */
        display: flex;
        gap: 4px; /* Reduced spacing between icons */
        align-items: center;
        z-index: 1000; /* High z-index to float on top of chart */
        
        padding: 2px 4px; /* Reduced padding */
        border-radius: 6px;
       
    }
    
    .floating-chart-controls .wave-btn {
        border: none; /* Remove borders from buttons */
        width: 20px; /* Further reduce button width */
        height: 20px; /* Further reduce button height */
        padding: 0;
    }
    
    .floating-chart-controls .wave-btn i {
        font-size: 12px; /* Reduce icon size */
    }
    
    .floating-chart-controls .width-multiplier-container {
        padding: 0 !important; /* Remove padding from multiplier container */
        margin: 0 !important; /* Remove margin from multiplier container */
    }
    
    .floating-chart-controls .width-multiplier-select {
        border: none !important; /* Remove borders from select dropdown */
        width: 40px !important; /* Reduce dropdown width */
        height: 24px !important; /* Reduce dropdown height */
        padding: 0 !important; /* Remove padding from select */
        margin: 0 !important; /* Remove margin from select */
        font-size: 10px !important;
        border-radius: 0 !important; /* Remove border radius */
    }
    
    /* Hide floating chart controls in table view */
    .lens-display.table-view ~ .floating-chart-controls {
        display: none !important;
    }

    .metric-item {
        display: flex;
        align-items: center;
        gap: 4px;
        width: 100%;
    }

    .metric-name {
        flex: 1;
        font-weight: 500;
    }

    .aggregation-select {
        padding: 2px 4px;
        border: 1px solid #dddbda;
        border-radius: 3px;
        background: white;
        font-size: 11px;
        min-width: 70px;
        margin: 0 2px;
    }

    .aggregation-select:focus {
        outline: none;
        border-color: #0070d2;
        box-shadow: 0 0 0 1px #0070d2;
    }

    .date-time-filter {
        background: #f8f9fa;
        border: 1px solid #dddbda;
        border-radius: 6px;
        padding: 12px;
        margin: 10px 0;
    }

    .filter-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
    }

    .filter-header h4 {
        margin: 0;
        color: #333;
        font-size: 16px;
    }

    .close-filter {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .close-filter:hover {
        color: #333;
    }

    .filter-options {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .filter-type {
        display: flex;
        gap: 20px;
    }

    .filter-type label {
        display: flex;
        align-items: center;
        gap: 5px;
        cursor: pointer;
    }

    .relative-options, .absolute-options {
        display: flex;
        gap: 15px;
        align-items: center;
    }

    .relative-options select {
        padding: 8px 12px;
        border: 1px solid #dddbda;
        border-radius: 4px;
        background: white;
    }

    .date-range {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .date-range label {
        font-weight: 500;
        min-width: 40px;
    }

    .date-range input[type="datetime-local"] {
        width: 146px;
        height: 20px;
        padding: 1px 4px;
        border: 1px solid #dddbda;
        border-radius: 4px;
        background: white;
        font-size: 8px;
    }

    .filter-actions {
        display: flex;
        gap: 10px;
    }

    .apply-filter, .clear-filter {
        padding: 8px 16px;
        border: 1px solid #dddbda;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;
    }

    .apply-filter {
        background: #0070d2;
        color: white;
        border-color: #0070d2;
    }

    .apply-filter:hover {
        background: #005fb2;
    }

    .clear-filter:hover {
        background: #f8f9fa;
    }
    
    .chart-wide {
        grid-column: 1 / -1;
    }
    
    .loading-state, .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
    }
    
    .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f2f2;
        border-top: 4px solid #0070d2;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 20px;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .loading-state p {
        color: #3e3e3c;
        font-size: 16px;
        margin: 0;
    }
    
    .error-state {
        color: #c23934;
    }
    
    .error-icon {
        font-size: 48px;
        margin-bottom: 20px;
    }
    
    .error-state h3 {
        color: #c23934;
        margin: 0 0 10px 0;
        font-size: 20px;
    }
    
    .error-state p {
        color: #3e3e3c;
        margin: 0 0 20px 0;
        font-size: 14px;
    }
    
    @media (max-width: 768px) {
        .wave-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 15px;
        }
        
        .wave-controls {
            width: 100%;
            justify-content: space-between;
        }
        
        .filter-section {
            flex-wrap: wrap;
        }
        
        .charts-grid {
            grid-template-columns: 1fr;
        }
    }

    /* Rows filter styles */
    .rows-filter {
        background: #f8f9fa !important;
        color: #333 !important;
        border: 1px solid #d3d3d3;
        padding: 6px 8px;
        min-height: 24px;
    }

    .rows-filter .filter-content {
        display: flex;
        align-items: center;
        gap: 0px;
    }


    .filter-count {
        font-size: 12px;
        color: #856404;
        font-style: italic;
        margin-left: 1px;
    }

    .table-icon {
        cursor: pointer;
        font-size: 14px;
        padding: 1px 2px;
        border-radius: 4px;
        transition: background-color 0.2s;
        margin-left: 2px;
    }

    .table-icon i {
        color: #495057;
    }

    .table-icon:hover {
        background-color: #e9ecef;
    }

    /* Rows popup styles */
    .rows-popup-overlay {
        z-index: 10000;
    }

    .rows-popup-content {
        max-width: 90vw;
        max-height: 90vh;
        width: 90vw;
        height: 90vh;
    }

    .rows-popup-table-container {
        height: calc(100% - 120px);
        overflow: visible;
        display: flex;
        flex-direction: column;
    }

    .rows-popup-table-wrapper {
        flex: 1;
        overflow-y: auto;
        overflow-x: auto;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        max-height: 100%;
    }

    .rows-popup-table {
        width: 100%;
        margin: 0;
    }

    .ignored-row {
        background-color: #f8f9fa;
        opacity: 0.6;
    }

    .ignored-row td {
        text-decoration: line-through;
        color: #6c757d;
    }

    /* Dimension filter styles */
    .dimension-filter .filter-content {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .dimension-dropdown-container {
        position: relative;
        display: inline-block;
        z-index: auto;
    }

    .dimension-dropdown-toggle {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border: 1px solid #dddbda;
        border-radius: 3px;
        background: white;
        font-size: 11px;
        color: #333;
        cursor: pointer;
        min-width: 80px;
        max-width: 150px;
    }

    .dimension-dropdown-toggle:hover {
        border-color: #0070d2;
    }

    .dropdown-text {
        flex: 1;
        text-align: left;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .dropdown-arrow {
        font-size: 10px;
        color: #666;
        transition: transform 0.2s;
    }

    .dimension-dropdown-menu {
        position: fixed;
        background: white;
        border: 1px solid #dddbda;
        border-radius: 3px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        max-height: 200px;
        overflow-y: auto;
        min-width: 150px;
    }

    .dropdown-item {
        padding: 0;
        margin: 0;
        line-height: 1;
    }

    .dimension-checkbox-label {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        cursor: pointer;
        padding: 0px 4px;
        margin: 0;
        line-height: 1.2;
        transition: background-color 0.2s;
        width: 100%;
        height: auto;
        min-height: 18px;
    }

    .dimension-checkbox-label:hover {
        background-color: #f8f9fa;
    }

    .dimension-checkbox {
        margin: 0;
        padding: 0;
        cursor: pointer;
        height: 14px;
        width: 14px;
    }


    .checkbox-text {
        font-size: 11px;
        color: #333;
        white-space: nowrap;
    }

    .all-checkbox + .checkbox-text {
        font-weight: 500;
        color: #0070d2;
    }

    /* Aggregation dropdown styles */
    .aggregation-dropdown-container {
        position: relative;
        display: inline-block;
        z-index: auto;
    }

    .aggregation-dropdown-toggle {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border: 1px solid #dddbda;
        border-radius: 3px;
        background: white;
        font-size: 11px;
        color: #333;
        cursor: pointer;
        min-width: 80px;
        max-width: 150px;
    }

    .aggregation-dropdown-toggle:hover {
        background: #f3f2f2;
    }

    .dropdown-text {
        flex: 1;
        text-align: left;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .dropdown-arrow {
        font-size: 10px;
        color: #666;
    }

    .aggregation-dropdown-menu {
        position: fixed;
        background: white;
        border: 1px solid #dddbda;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        min-width: 150px;
        max-height: 200px;
        overflow-y: auto;
    }

    .aggregation-dropdown-menu .dropdown-item {
        padding: 0;
        margin: 0;
        line-height: 1;
    }

    .aggregation-checkbox-label {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0px 6px;
        margin: 0;
        line-height: 1.2;
        cursor: pointer;
        font-size: 12px;
        color: #333;
        height: auto;
        min-height: 18px;
    }

    .aggregation-checkbox-label:hover {
        background: #f3f2f2;
    }

    .aggregation-checkbox {
        margin: 0;
        padding: 0;
        height: 14px;
        width: 14px;
    }

    .aggregation-checkbox-label .checkbox-text {
        flex: 1;
    }

    .chart-tooltip {
        position: fixed;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 10px 14px;
        border-radius: 6px;
        font-size: 12px;
        font-family: Arial, sans-serif;
        pointer-events: none;
        z-index: 10000;
        display: none;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        max-width: 280px;
        line-height: 1.5;
        border: 1px solid rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(4px);
    }

    .chart-tooltip strong {
        color: #ffffff;
        font-weight: 600;
    }

    .chart-tooltip::before {
        content: '';
        position: absolute;
        top: 50%;
        left: -6px;
        transform: translateY(-50%);
        border: 6px solid transparent;
        border-right-color: rgba(0, 0, 0, 0.9);
    }
`;
document.head.appendChild(style);

