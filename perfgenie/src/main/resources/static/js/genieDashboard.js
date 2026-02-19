/**
 * GenieDashboard Component
 * A Grafana-like dashboard component for rendering JSON-based dashboards
 *
 * Features:
 * - Parses dashboard JSON configuration
 * - Replaces placeholders in queries ($variables and QEURY)
 * - Fetches data from REST endpoints
 * - Renders charts with grid layout
 * - Supports multiple panel types (timeseries, stat, etc.)
 *
 * Usage:
 *   const dashboard = new GenieDashboard('dashboard-container');
 *   dashboard.render(dashboardJson, inputJson);
 *
 * Note: This component can be instantiated multiple times, similar to SFDataTable
 */

// Only define the class if it doesn't already exist (prevents duplicate declaration errors)
// Use a function to create the class to avoid duplicate declaration errors
(function () {
    // Check if GenieDashboard is already defined
    if (typeof window !== 'undefined' && window.GenieDashboard) {
        return; // Already defined, skip
    }

    class GenieDashboard {
        constructor(containerId, options = {}) {
            console.log('[GenieDashboard] CONSTRUCTOR CALLED for containerId:', containerId);
            this.containerId = containerId;
            this.container = document.getElementById(containerId);

            if (!this.container) {
                throw new Error(`Container with ID '${containerId}' not found`);
            }

            // Create instance identifier for unique IDs (similar to SFDataTable pattern)
            // Use containerId as base, sanitize it to be a valid ID prefix
            // Store instanceId on container to ensure stability and uniqueness
            if (this.container.dataset.genieDashboardInstanceId) {
                // Reuse existing instanceId to maintain ID stability
                this.instanceId = this.container.dataset.genieDashboardInstanceId;
            } else {
                // Generate new instanceId and store it on the container
                this.instanceId = this.sanitizeId(containerId);
                // Add a unique suffix if another instance with same containerId exists
                let counter = 1;
                let baseInstanceId = this.instanceId;
                while (document.getElementById(`genie-spin-animation-${this.instanceId}`)) {
                    this.instanceId = `${baseInstanceId}-${counter}`;
                    counter++;
                }
                // Store instanceId on container element to ensure it remains stable
                this.container.dataset.genieDashboardInstanceId = this.instanceId;
            }

            this.options = {
                chartLibrary: 'chartjs', // 'chartjs' or 'c3' or 'd3'
                gridColumns: 24, // Grafana standard
                panelSpacing: 5,
                responsive: true,
                theme: 'light',
                chat: {
                    enabled: false, // Enable chat feature
                    apiBaseUrl: '/api/claude', // Base URL for Claude API
                    position: 'bottom-right' // Chat window position
                },
                ...options
            };

            // Merge chat options if provided
            if (options.chat) {
                this.options.chat = {...this.options.chat, ...options.chat};
            }

            this.dashboardConfig = null;
            this.inputConfig = null;

            // NEW: Panel ID management with stable IDs
            // Panel ID counter is now managed by IdGenerator module

            // Initialize PanelRegistry for panel management
            console.log('[GenieDashboard] About to check PanelRegistry, typeof PanelRegistry:', typeof PanelRegistry);
            if (typeof PanelRegistry === 'undefined') {
                throw new Error('GenieDashboard: PanelRegistry module is required but not loaded. Please ensure PanelRegistry.js is included before genieDashboard.js');
            }

            console.log('[GenieDashboard] About to enter try block for PanelRegistry initialization');
            try {
                console.log('[GenieDashboard] Initializing PanelRegistry, idGenerator:', this.idGenerator);
                this.panelRegistry = new PanelRegistry(this.idGenerator);
                console.log('[GenieDashboard] PanelRegistry created:', this.panelRegistry);
                if (!this.panelRegistry) {
                    throw new Error('GenieDashboard: Failed to create PanelRegistry instance - constructor returned undefined');
                }
                // Maintain backward compatibility: expose panels and panelOrder as getters
                Object.defineProperty(this, 'panels', {
                    get: () => this.panelRegistry.panels,
                    configurable: true
                });
                Object.defineProperty(this, 'panelOrder', {
                    get: () => this.panelRegistry.panelOrder,
                    configurable: true
                });
                console.log('[GenieDashboard] PanelRegistry initialized successfully, this.panelRegistry:', this.panelRegistry);
            } catch (error) {
                console.error('GenieDashboard: Error initializing PanelRegistry:', error);
                throw new Error(`GenieDashboard: Failed to initialize PanelRegistry: ${error.message}`);
            }

            this.charts = {};

            // Initialize DataCache for API response caching
            if (typeof DataCache === 'undefined') {
                throw new Error('GenieDashboard: DataCache module is required but not loaded. Please ensure DataCache.js is included before genieDashboard.js');
            }
            this.dataCache = new DataCache();

            // Expert views cache - stores expert name -> dashboard config mapping
            this.expertViews = {};
            this._preconfiguredExpertsLoaded = false;
            // Track which expert views are currently loaded
            this.loadedExpertViews = new Set();

            // Chat conversation history
            this.chatHistory = [];

            // Placeholder name mappings from inputJson (for common field identification)
            this.placeholderNameMappings = null;

            // Expert-specific input configs and rows
            this.expertInputConfigs = {};
            this.expertInputRows = {};
            this.commonInputRow = null;

            // Track common fields that have been created and their placeholders
            // Maps: commonFieldName -> { varName, placeholders: Set, element }
            this.commonFieldsMap = new Map();

            // Track if this is the first page load (for auto-refresh behavior)
            this._isFirstPageLoad = true;

            // Initialize styles
            this.injectStyles();

            // Check for Chart.js
            if (typeof Chart === 'undefined') {
                console.warn('Chart.js not loaded. Loading from CDN...');
                this.loadChartJS();
            }
        }

        /**
         * Load Chart.js from CDN if not available
         */
        loadChartJS() {
            return new Promise((resolve, reject) => {
                if (typeof Chart !== 'undefined') {
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('Failed to load Chart.js'));
                document.head.appendChild(script);
            });
        }

        /**
         * Sanitize containerId to create a valid instance ID prefix
         * Similar to SFDataTable's instance name handling
         */
        sanitizeId(id) {
            if (!id) {
                return 'genie-dashboard';
            }
            // Remove any invalid characters for IDs (keep alphanumeric, hyphens, underscores)
            return id.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '') || 'genie-dashboard';
        }

        /**
         * Generate instance-specific ID
         * @param {string} baseId - Base ID name (e.g., 'collapse-bar', 'grid')
         * @returns {string} Instance-specific ID
         */
        getInstanceId(baseId) {
            return `${this.instanceId}-${baseId}`;
        }

        /**
         * Inject CSS styles for the dashboard
         */
        /**
         * Inject CSS styles for the dashboard
         * Delegates to Styles module
         */
        injectStyles() {
            Styles.injectStyles(this.options);
        }

        /**
         * Flatten nested panels recursively
         * @param {Array} panels - Array of panels (may contain nested panels)
         * @returns {Array} - Flattened array of all panels
         */

        /**
         * Generate a unique panel ID using a counter
         * @returns {string} Unique panel ID (e.g., "p1", "p2", "p3")
         */
        /**
         * Generate a unique panel ID using a counter
         * Delegates to IdGenerator module if available
         * @returns {string} Unique panel ID (e.g., "p1", "p2", "p3")
         */
        generatePanelId() {
            console.log('[GenieDashboard] generatePanelId called, this.panelRegistry:', this.panelRegistry);
            if (!this.panelRegistry) {
                throw new Error('GenieDashboard: PanelRegistry is not initialized. This should not happen - PanelRegistry should be initialized in constructor.');
            }
            return this.panelRegistry.generatePanelId();
        }

        /**
         * Get panel by ID (O(1) lookup)
         * @param {string} id - Panel ID
         * @returns {Object|null} Panel object or null if not found
         */
        getPanelById(id) {
            if (!this.panelRegistry) {
                throw new Error('GenieDashboard: PanelRegistry is not initialized. This should not happen - PanelRegistry should be initialized in constructor.');
            }
            return this.panelRegistry.getPanelById(id);
        }

        /**
         * Get all panels in normal order (for backward compatibility)
         * @returns {Array} Array of panels in normal order
         */
        getPanelsArray() {
            if (!this.panelRegistry) {
                throw new Error('GenieDashboard: PanelRegistry is not initialized. This should not happen - PanelRegistry should be initialized in constructor.');
            }
            return this.panelRegistry.getPanelsArray('normal');
        }

        /**
         * Get all panels in genie order
         * @returns {Array} Array of panels in genie order
         */
        getPanelsArrayGenie() {
            if (!this.panelRegistry) {
                throw new Error('GenieDashboard: PanelRegistry is not initialized. This should not happen - PanelRegistry should be initialized in constructor.');
            }
            return this.panelRegistry.getPanelsArrayGenie();
        }

        /**
         * Add a panel to the panels object and order array
         * @param {Object} panel - Panel object (must have id property)
         * @param {string} orderType - 'normal' or 'genie' (default: 'normal')
         * @param {number} insertIndex - Optional index to insert at (default: append to end)
         */
        addPanel(panel, orderType = 'normal', insertIndex = -1) {
            if (!this.panelRegistry) {
                throw new Error('GenieDashboard: PanelRegistry is not initialized. This should not happen - PanelRegistry should be initialized in constructor.');
            }
            return this.panelRegistry.addPanel(panel, orderType, insertIndex);
        }

        /**
         * Remove a panel from the panels object and order arrays
         * @param {string} id - Panel ID to remove
         */
        removePanel(id) {
            if (!this.panelRegistry) {
                throw new Error('GenieDashboard: PanelRegistry is not initialized. This should not happen - PanelRegistry should be initialized in constructor.');
            }
            return this.panelRegistry.removePanel(id);
        }

        /**
         * Flatten nested panel structure and assign unique IDs
         * NEW: Uses this.panels object map and panelOrder.normal array
         * @param {Array} panels - Array of panel configurations
         * @param {Object} options - Options for flattening
         * @param {string} options.parentId - Parent panel ID (for nested panels)
         * @returns {Array} Array of panel IDs that were added (for backward compatibility, also returns array of panel objects)
         */
        flattenPanels(panels, options = {}) {
            if (typeof PanelLayout === 'undefined' || !PanelLayout.flattenPanels) {
                throw new Error('GenieDashboard: PanelLayout module is required but not loaded. Please ensure PanelLayout.js is included before genieDashboard.js');
            }
            // Get panel registry and order from PanelRegistry (or fallback to direct properties)
            const panelRegistry = this.panelRegistry ? this.panelRegistry.panels : this.panels;
            const panelOrder = this.panelRegistry ? this.panelRegistry.panelOrder : this.panelOrder;
            return PanelLayout.flattenPanels(panels, options, panelRegistry, panelOrder, () => this.generatePanelId());
        }

        /**
         * Resolve overlapping panels by adjusting their Y positions
         * @param {Array} panels - Array of panels to check and adjust
         * @returns {Array} - Array of panels with adjusted positions
         */
        /**
         * Resolve overlapping panels by processing from top to bottom
         * This function processes panels in order (top to bottom) and adjusts Y positions to avoid overlaps
         * It handles nested row panels by processing parent row panels first, then their children
         * @param {Array} panels - Array of panels (may include row panels with nested children)
         * @returns {Array} - Array of panels with adjusted positions
         */
        resolveOverlappingPanels(panels) {
            if (typeof PanelLayout === 'undefined' || !PanelLayout.resolveOverlappingPanels) {
                throw new Error('GenieDashboard: PanelLayout module is required but not loaded. Please ensure PanelLayout.js is included before genieDashboard.js');
            }
            return PanelLayout.resolveOverlappingPanels(panels);
        }

        /**
         * Main render method
         * @param {Object} dashboardJson - Dashboard configuration JSON
         * @param {Object} inputJson - Input configuration with endpoints and variables
         */
        async render(dashboardJson, inputJson) {
            try {
                this.dashboardConfig = dashboardJson;
                this.inputConfig = inputJson;

                // Store placeholder name mappings from inputJson
                if (inputJson && inputJson.placeholdernamemappings) {
                    this.placeholderNameMappings = inputJson.placeholdernamemappings;
                    console.log('GenieDashboard: Loaded placeholder name mappings:', this.placeholderNameMappings);
                } else {
                    this.placeholderNameMappings = null;
                }

                // Validate inputConfig format
                if (inputJson && !this.validateInputConfig(inputJson)) {
                    console.error('GenieDashboard: Invalid inputConfig format. Please check the console for details.');
                    // Continue rendering but log the error
                }

                // Clear previous dashboard
                this.container.innerHTML = '';
                this.container.className = 'genie-dashboard-container';

                // Wait for Chart.js if needed
                await this.loadChartJS();

                // Get toolbar config for collapse settings
                const toolbarConfig = this.dashboardConfig.toolbar || {};
                const startCollapsed = toolbarConfig.collapse === true;
                const isToolbarEnabled = toolbarConfig.enabled !== false;

                // Apply collapsed state to container if needed
                if (startCollapsed) {
                    this.container.classList.add('genie-dashboard-collapsed');
                }

                // Create collapse bar (always shown at top)
                const collapseBar = document.createElement('div');
                collapseBar.className = 'genie-toolbar-collapse-bar';
                collapseBar.id = this.getInstanceId('collapse-bar');
                collapseBar.title = 'Toggle dashboard';
                if (startCollapsed) {
                    collapseBar.classList.add('genie-dashboard-collapsed');
                }
                this.container.appendChild(collapseBar);

                // Render toolbar only if enabled
                if (isToolbarEnabled) {
                    this.renderToolbar(toolbarConfig);
                }

                // Load pre-configured expert dashboards (once per instance)
                if (!this._preconfiguredExpertsLoaded) {
                    await this.loadPreconfiguredExperts();
                    this._preconfiguredExpertsLoaded = true;
                }


                // Render chat window if enabled
                if (this.options.chat && this.options.chat.enabled) {
                    this.renderChatWindow();
                }

                // Extract panels (flatten nested panels recursively)
                // Panel IDs are now generated during flattenPanels() using generatePanelId()
                // flattenPanels() now populates this.panels (object) and this.panelOrder.normal (array)
                const flattenedPanels = this.flattenPanels(this.dashboardConfig.panels || []);

                // Resolve any overlapping panels after flattening
                // resolveOverlappingPanels expects an array, so we pass the array from panelOrder
                const panelsArray = this.getPanelsArray();
                const resolvedPanels = this.resolveOverlappingPanels(panelsArray);

                // Update this.panels with resolved panels (they may have updated gridPos)
                resolvedPanels.forEach(panel => {
                    if (panel && panel.id) {
                        this.panels[panel.id] = panel;
                    }
                });

                // Create grid container
                const grid = document.createElement('div');
                grid.className = 'genie-dashboard-grid';
                grid.id = this.getInstanceId('grid');
                // If collapsed by default, hide grid initially
                if (startCollapsed) {
                    grid.classList.add('genie-dashboard-collapsed');
                }
                this.container.appendChild(grid);

                // Store grid reference for collapse toggle
                this.dashboardGrid = grid;

                // Render dashboard controls row (Cell, Substrate, HF Instance, Domain, Span, Aggregate)
                // Wait for input field queries to complete before rendering panels
                await this.renderDashboardControlsRow(grid, toolbarConfig);

                // Check if input fields exist and have values
                // First, check if any templating input fields exist in the DOM
                const hasInputFields = this.checkInputFieldsExist();
                if (!hasInputFields) {
                    console.warn('GenieDashboard: Input fields have not been rendered yet. Panels will not be rendered until input fields are ready.');
                    // Don't render panels at all if input fields don't exist
                    return;
                }

                // Check if all input fields have values - this determines if we load data or just create empty panels
                const allFieldsHaveValues = this.checkAllInputFieldsHaveValues();
                if (!allFieldsHaveValues) {
                    console.log('GenieDashboard: Not all input fields have values selected. Panels will be created but data will not be loaded until all fields are filled.');
                }

                // Calculate a consistent row height per unit based on grid-auto-rows
                // We'll use a fixed calculation: estimate ~38px per row unit (based on typical content)
                // This ensures panels with the same gridPos.h have the same height
                const estimatedRowHeightPerUnit = 38; // Fixed estimate for consistent sizing

                // Store this in the instance for use in panel rendering
                this.rowHeightPerUnit = estimatedRowHeightPerUnit;

                // Initialize flag to track if panels have been rendered for the first time
                this._panelsRendered = false;

                // If collapsed by default, skip panel rendering - will render on first expand
                if (startCollapsed) {
                    console.log('GenieDashboard: Dashboard collapsed by default, skipping initial panel rendering');
                    // Setup dashboard collapse/expand functionality (will handle first expand)
                    this.setupDashboardCollapse();
                } else {
                    // Not collapsed - render panels (always create DOM, but skip data if fields are empty)
                    // Use panelOrder.normal to get panels in correct order
                    const renderPromises = this.panelOrder.normal.map((panelId, index) => {
                        const panel = this.panels[panelId];
                        if (!panel) {
                            console.warn(`[initializeDashboard] Panel with ID "${panelId}" not found in this.panels`);
                            return Promise.resolve();
                        }
                        // Check if this is a row panel - if so, use renderRowPanel
                        if (panel.type === 'row' && panel.panels && Array.isArray(panel.panels) && panel.panels.length > 0) {
                            return this.renderRowPanel(panel, panelId, grid, !allFieldsHaveValues);
                        } else {
                            return this.renderPanel(panel, panelId, grid, false, !allFieldsHaveValues);
                        }
                    });

                    await Promise.all(renderPromises);
                    this._panelsRendered = true;

                    // Setup dashboard collapse/expand functionality after everything is rendered
                    this.setupDashboardCollapse();

                    // Validate all panel heights after rendering is complete
                    // Use setTimeout to ensure all DOM updates and height calculations are finished
                    setTimeout(() => {
                        this.validateAllPanelHeights();
                    }, 500);
                }

            } catch (error) {
                console.error('GenieDashboard: Error rendering dashboard:', error);
                this.container.innerHTML = `<div class="genie-dashboard-panel-error">Error rendering dashboard: ${error.message}</div>`;
            }
        }

        /**
         * Calculate panel layout based on expectedHeight and panel configuration
         * This modular function ensures consistent positioning across all chart types
         *
         * @param {Object} config - Layout configuration
         * @param {number} config.expectedHeight - Expected panel height (gridPos.h * rowHeightPerUnit)
         * @param {number} config.headerHeight - Measured header height
         * @param {string} config.chartType - Chart type: 'timeseries', 'bar', or 'pie'
         * @param {Object} config.panel - Panel configuration object
         * @returns {Object} Layout configuration with component positions and heights
         */
        calculatePanelLayout(config) {
            const {
                expectedHeight,
                headerHeight,
                chartType = 'timeseries',
                panel = {}
            } = config;

            // Component height constants (modular and consistent)
            const CONSTANTS = {
                bottomPadding: 8,
                legendHeight: 54,
                legendSpacing: 2,
                tooltipLegendHeight: 20,
                sliderContainerHeight: 20,
                sliderSpacing: 2,
                axisLabelHeight: 60, // Increased to 60px to accommodate rotated x-axis labels (Chart.js needs ~50-60px)
                bufferSpace: 2,
                minChartHeight: 100
            };

            // Get panel options
            const options = panel.options || {};
            const timeSeriesOptions = options.timeSeries || {};
            const legendOptions = options.legend || {};

            // Determine component visibility
            const showZoomSlider = chartType !== 'pie' && timeSeriesOptions.showZoomSlider !== false;
            const currentSliderPosition = timeSeriesOptions.zoomSliderPosition || 'top';
            const currentPlacement = legendOptions.placement || 'bottom';
            const currentDisplayMode = legendOptions.displayMode || 'list';
            const currentLegendTakesSpace = chartType !== 'pie' && currentDisplayMode === 'list' && legendOptions.showLegend !== false;
            const currentTooltipLegendTakesSpace = chartType !== 'pie' && currentDisplayMode === 'tooltip' && legendOptions.showLegend !== false;

            // Calculate component positions systematically
            let currentY = 0;
            const layoutComponents = [];

            // 1. Header (always present)
            layoutComponents.push({
                name: 'header',
                y: currentY,
                height: headerHeight
            });
            currentY += headerHeight;

            // 2. Top Slider (timeseries/bar only)
            if (showZoomSlider && currentSliderPosition === 'top') {
                layoutComponents.push({
                    name: 'topSlider',
                    y: currentY + CONSTANTS.sliderSpacing,
                    height: CONSTANTS.sliderContainerHeight
                });
                currentY += CONSTANTS.sliderSpacing + CONSTANTS.sliderContainerHeight + CONSTANTS.sliderSpacing;
            }

            // 3. Top Legend (timeseries/bar only)
            if (currentLegendTakesSpace && currentPlacement === 'top') {
                layoutComponents.push({
                    name: 'topLegend',
                    y: currentY,
                    height: CONSTANTS.legendHeight + CONSTANTS.legendSpacing
                });
                currentY += CONSTANTS.legendHeight + CONSTANTS.legendSpacing;
            }

            // 3a. Top Tooltip Legend (timeseries/bar only)
            if (currentTooltipLegendTakesSpace) {
                layoutComponents.push({
                    name: 'topTooltipLegend',
                    y: currentY,
                    height: CONSTANTS.tooltipLegendHeight
                });
                currentY += CONSTANTS.tooltipLegendHeight;
            }

            // 4. Chart Canvas (calculate available height)
            let chartHeight = expectedHeight - currentY - CONSTANTS.bottomPadding;

            // Subtract space for bottom components (timeseries/bar only)
            if (chartType !== 'pie') {
                if (currentLegendTakesSpace && currentPlacement === 'bottom') {
                    chartHeight -= (CONSTANTS.legendHeight + CONSTANTS.legendSpacing);
                }
                if (showZoomSlider && currentSliderPosition === 'bottom') {
                    const extraSpacing = currentTooltipLegendTakesSpace ? 8 : 0;
                    chartHeight -= (extraSpacing + CONSTANTS.sliderSpacing + CONSTANTS.sliderContainerHeight + CONSTANTS.sliderSpacing);
                }
                chartHeight -= CONSTANTS.axisLabelHeight;
                chartHeight -= CONSTANTS.bufferSpace;
            } else {
                // Pie charts: subtract axisLabelHeight and bufferSpace for consistency
                chartHeight -= CONSTANTS.axisLabelHeight;
                chartHeight -= CONSTANTS.bufferSpace;
            }

            // Apply minimum height constraint
            chartHeight = Math.max(CONSTANTS.minChartHeight, chartHeight);

            // Chart component includes axis labels for timeseries/bar, or just the chart for pie
            const chartComponentHeight = chartType !== 'pie'
                ? chartHeight + CONSTANTS.axisLabelHeight
                : chartHeight + CONSTANTS.axisLabelHeight; // Keep consistent structure

            layoutComponents.push({
                name: 'chart',
                y: currentY,
                height: chartComponentHeight
            });
            currentY += chartComponentHeight;

            // 5. Bottom Legend (timeseries/bar only)
            if (currentLegendTakesSpace && currentPlacement === 'bottom') {
                layoutComponents.push({
                    name: 'bottomLegend',
                    y: currentY + CONSTANTS.legendSpacing,
                    height: CONSTANTS.legendHeight
                });
                currentY += CONSTANTS.legendSpacing + CONSTANTS.legendHeight;
            }

            // 6. Bottom Slider (timeseries/bar only)
            if (showZoomSlider && currentSliderPosition === 'bottom') {
                const extraSpacing = currentTooltipLegendTakesSpace ? 8 : 0;
                layoutComponents.push({
                    name: 'bottomSlider',
                    y: currentY + extraSpacing,
                    height: CONSTANTS.sliderContainerHeight
                });
                currentY += extraSpacing + CONSTANTS.sliderContainerHeight + CONSTANTS.sliderSpacing;
            }

            // Calculate derived dimensions
            const panelContentHeight = expectedHeight - headerHeight;
            const chartContentHeight = expectedHeight - headerHeight - CONSTANTS.bottomPadding;

            return {
                expectedHeight,
                headerHeight,
                panelContentHeight,
                chartContentHeight,
                components: layoutComponents,
                constants: CONSTANTS,
                // Helper methods to get specific component
                getComponent: (name) => layoutComponents.find(c => c.name === name),
                // Chart-specific dimensions
                chartHeight: chartHeight,
                chartComponentHeight: chartComponentHeight
            };
        }

        /**
         * Validate that all panels are using the correct height based on gridPos.h
         * This function checks all rendered panels and reports any discrepancies
         */
        /**
         * Validate that all panels are using the correct height based on gridPos.h
         * Delegates to Validator module
         */
        validateAllPanelHeights() {
            return Validator.validateAllPanelHeights(this);
        }

        /**
         * Get the default controls row height in grid units
         * This can be easily adjusted when more input fields are added
         * If fields wrap to multiple rows, increase this value accordingly
         * @returns {number} Default height of controls row in grid units
         */
        getDefaultControlsRowHeight() {
            if (typeof LayoutUtils === 'undefined' || !LayoutUtils.getDefaultControlsRowHeight) {
                throw new Error('GenieDashboard: LayoutUtils module is required but not loaded. Please ensure LayoutUtils.js is included before genieDashboard.js');
            }
            return LayoutUtils.getDefaultControlsRowHeight();
        }

        /**
         * Render dashboard controls row (Cell, Substrate, HF Instance, Domain, Span, Aggregate)
         * This row is fixed at the top of the dashboard panel and doesn't move during sorting
         */
        async renderDashboardControlsRow(grid, toolbarConfig) {
            // Check if controls row already exists (don't recreate if it does)
            let controlsRow = document.getElementById(this.getInstanceId('controls-row'));
            if (controlsRow) {
                // Controls row already exists, ensure it's in the correct position
                controlsRow.style.gridColumn = '1 / -1';
                const controlsRowHeight = this.getDefaultControlsRowHeight();
                controlsRow.style.gridRow = `1 / ${1 + controlsRowHeight}`;
                return;
            }

            controlsRow = document.createElement('div');
            controlsRow.className = 'genie-dashboard-controls-row';
            controlsRow.id = this.getInstanceId('controls-row');
            // Position controls row at the top of the grid (row 1, spanning all 24 columns)
            // Mark it with a data attribute to prevent it from being treated as a panel
            controlsRow.setAttribute('data-controls-row', 'true');
            // Get default height (modularized for easy adjustment when more fields are added)
            const controlsRowHeight = this.getDefaultControlsRowHeight();
            controlsRow.style.cssText = `display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: #ffffff; border-bottom: 1px solid #e5e7eb; margin-bottom: 4px; flex-wrap: wrap; grid-column: 1 / -1; grid-row: 1 / ${1 + controlsRowHeight};`;

            // CRITICAL: Append controlsRow to grid FIRST, before adding input fields
            // This ensures the row is in the DOM when we append elements to it
            grid.appendChild(controlsRow);

            // Store reference to common input row for later use
            this.commonInputRow = controlsRow;

            // Add input fields from templating variables (template-only approach)
            // Wait for query-type input field queries to complete
            await this.addTemplatingInputFields(controlsRow);

            // Add refresh button for input fields (refreshes only panel data, not entire dashboard)
            const refreshPanelsButton = document.createElement('button');
            refreshPanelsButton.type = 'button';
            refreshPanelsButton.id = this.getInstanceId('controls-refresh-button');
            refreshPanelsButton.className = 'genie-toolbar-button';
            refreshPanelsButton.innerHTML = '<span>🔄</span>';
            refreshPanelsButton.title = 'Refresh panels';
            refreshPanelsButton.style.cssText = 'display: flex; align-items: center; justify-content: center; padding: 2px 8px; font-size: 11px; color: #6b7280; background: transparent; border: 1px solid #d1d5db; border-radius: 3px; cursor: pointer; height: 24px; min-width: 32px; margin-left: 4px;';

            // Add hover effect
            refreshPanelsButton.addEventListener('mouseenter', () => {
                refreshPanelsButton.style.background = '#f3f4f6';
                refreshPanelsButton.style.borderColor = '#9ca3af';
            });
            refreshPanelsButton.addEventListener('mouseleave', () => {
                refreshPanelsButton.style.background = 'transparent';
                refreshPanelsButton.style.borderColor = '#d1d5db';
            });

            // Click handler - refresh only panel data (input fields refresh button)
            refreshPanelsButton.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🟡🟡🟡 REFRESH PANELS BUTTON CLICKED - CALLING refreshPanelsDataOnly() 🟡🟡🟡');

                // STEP 0: Ensure all input fields have their values saved (trigger blur events)
                // This ensures that if user changed a field value but didn't blur, the value is still saved
                await this.ensureAllInputFieldsSaved();

                // Controls refresh button should NEVER run queries, only check values and refresh panels
                await this.refreshPanelsDataOnly(true, false);
                console.log('🟡🟡🟡 refreshPanelsDataOnly() COMPLETED 🟡🟡🟡');
            });

            controlsRow.appendChild(refreshPanelsButton);

            // controlsRow is already appended to grid (moved earlier to ensure DOM presence)
        }

        /**
         * Extract value from object using JSONPath
         * Delegates to Helpers module
         * @param {*} obj - The object to extract from
         * @param {string} path - The JSONPath string
         * @returns {*} The extracted value(s) or null
         */
        extractByJsonPath(obj, path) {
            return Helpers.extractByJsonPath(obj, path);
        }


        /**
         * Extract values from response using JSONPath
         * Handles special case where response is an array and path starts with "value."
         * @param {*} response - The response object/array
         * @param {string} jsonPath - The JSONPath string (e.g., "value.tags.k8s_pod_name")
         * @param {string} varName - Variable name for logging
         * @returns {Array} Array of extracted values
         */
        /**
         * Extract values from response using JSONPath
         * Delegates to Helpers module
         * @param {*} response - The response object/array
         * @param {string} jsonPath - The JSONPath string
         * @param {string} varName - Variable name for logging
         * @returns {Array} Array of extracted values
         */
        extractValuesFromResponse(response, jsonPath, varName = '') {
            return Helpers.extractValuesFromResponse(response, jsonPath, varName);
        }


        /**
         * Parse service(QUERY,jsonpath(...)) pattern from query string
         /**
         * Parse service() query pattern to extract query and jsonpath
         * Delegates to QueryProcessor module
         * @param {string} query - Query string that may contain service() pattern
         * @param {string} varName - Variable name for logging/debugging
         * @returns {Object} Object with {actualQuery, jsonPath} properties
         */
        parseServiceJsonPathPattern(query, varName = '') {
            return QueryProcessor.parseServiceJsonPathPattern(query, varName);
        }

        /**
         * Build a RegExp from templating regex config
         * Supports strings like "/pattern/flags" or "pattern"
         * @param {string|RegExp} regexInput - Regex config
         * @returns {RegExp|null} RegExp instance or null if invalid
         */
        buildTemplateRegex(regexInput) {
            if (!regexInput) {
                return null;
            }
            if (regexInput instanceof RegExp) {
                return regexInput;
            }
            const regexStr = String(regexInput);
            if (regexStr.length >= 2 && regexStr[0] === '/') {
                const lastSlash = regexStr.lastIndexOf('/');
                if (lastSlash > 0) {
                    const pattern = regexStr.slice(1, lastSlash);
                    const flags = regexStr.slice(lastSlash + 1);
                    return new RegExp(pattern, flags);
                }
            }
            return new RegExp(regexStr);
        }


        /**
         * Check if input fields exist in the DOM
         * @returns {boolean} True if at least one templating input field exists, false otherwise
         */
        /**
         * Check if input fields exist in the DOM
         * Delegates to Validator module
         * @returns {boolean} True if at least one templating input field exists, false otherwise
         */
        checkInputFieldsExist() {
            return Validator.checkInputFieldsExist(this);
        }

        /**
         * Check if all input fields have values selected
         * @returns {boolean} True if all input fields have values, false otherwise
         */
        /**
         * Check if all input fields have values selected
         * Delegates to Validator module
         * @returns {boolean} True if all input fields have values, false otherwise
         */
        checkAllInputFieldsHaveValues() {
            return Validator.checkAllInputFieldsHaveValues(this);
        }

        /**
         * Check if panels need to be rendered and render them if all fields are filled
         * This is called when input fields change to automatically render panels once all fields have values
         */
        async checkAndRenderPanelsIfReady() {
            // Only render if panels haven't been rendered yet
            if (this._panelsRendered) {
                return;
            }

            // Check if all fields have values
            const allFieldsHaveValues = this.checkAllInputFieldsHaveValues();
            if (!allFieldsHaveValues) {
                return; // Not ready yet
            }

            // All fields have values - render panels now
            console.log('GenieDashboard: All input fields now have values. Rendering panels...');

            const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
            if (!grid) {
                console.error('GenieDashboard: Grid container not found for rendering panels');
                return;
            }

            // Calculate row height per unit
            const estimatedRowHeightPerUnit = 38;
            this.rowHeightPerUnit = estimatedRowHeightPerUnit;

            // Render panels
            const renderPromises = this.panelOrder.normal.map((panelId, index) => {
                const panel = this.panels[panelId];
                if (!panel) {
                    console.warn(`[checkAndRenderPanelsIfReady] Panel with ID "${panelId}" not found in this.panels`);
                    return Promise.resolve();
                }
                // Check if this is a row panel - if so, use renderRowPanel
                if (panel.type === 'row' && panel.panels && Array.isArray(panel.panels) && panel.panels.length > 0) {
                    return this.renderRowPanel(panel, panelId, grid);
                } else {
                    return this.renderPanel(panel, panelId, grid);
                }
            });

            await Promise.all(renderPromises);
            this._panelsRendered = true;

            // Setup dashboard collapse/expand functionality after rendering
            this.setupDashboardCollapse();

            // Validate all panel heights after rendering is complete
            setTimeout(() => {
                this.validateAllPanelHeights();
            }, 500);

            console.log('GenieDashboard: Panels rendered successfully');
        }

        /**
         * Add input fields from dashboard templating variables that don't already exist in placeholder mappings
         * @param {HTMLElement} controlsRow - The controls row container to append fields to
         * @returns {Promise} Promise that resolves when all query-type input field queries have completed
         */
        /**
         * Get placeholder name mappings from inputJson configuration
         * Returns the mappings object or empty object if not configured
         */
        getPlaceholderNameMappings() {
            if (typeof QueryProcessor === 'undefined' || !QueryProcessor.getPlaceholderNameMappings) {
                throw new Error('GenieDashboard: QueryProcessor module is required but not loaded. Please ensure QueryProcessor.js is included before genieDashboard.js');
            }
            return QueryProcessor.getPlaceholderNameMappings(this.placeholderNameMappings);
        }

        /**
         * Update placeholder name mappings with label-to-placeholder mappings for templating fields
         * This ensures fields can be found by their label even if not in the original mappings
         * IMPORTANT: Always uses the field NAME to generate placeholders, not the label
         */
        updatePlaceholderNameMappings(templateVar) {
            if (typeof QueryProcessor === 'undefined' || !QueryProcessor.updatePlaceholderNameMappings) {
                throw new Error('GenieDashboard: QueryProcessor module is required but not loaded. Please ensure QueryProcessor.js is included before genieDashboard.js');
            }
            // Initialize if needed
            if (!this.placeholderNameMappings) {
                this.placeholderNameMappings = {};
            }
            return QueryProcessor.updatePlaceholderNameMappings(templateVar, this.placeholderNameMappings);
        }

        /**
         * Create a new input row container for an expert
         */
        createExpertInputRow(expertName) {
            const container = document.createElement('div');
            container.className = 'expert-input-row';
            container.setAttribute('data-expert-name', expertName);
            container.style.cssText = `
            border-top: 2px solid #e5e7eb;
            padding: 8px 0;
            margin-top: 8px;
        `;

            // Add controls row
            const controlsRow = document.createElement('div');
            controlsRow.id = this.getInstanceId(`expert-controls-${expertName}`);
            controlsRow.className = 'expert-controls-row';
            controlsRow.style.cssText = 'display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 0 8px;';
            container.appendChild(controlsRow);

            // Insert after common input row or at the end of grid
            const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
            if (grid) {
                if (this.commonInputRow && this.commonInputRow.parentNode) {
                    this.commonInputRow.parentNode.insertBefore(container, this.commonInputRow.nextSibling);
                } else {
                    grid.appendChild(container);
                }
            }

            this.expertInputRows[expertName] = container;
            return controlsRow;
        }

        /**
         * Categorize a template variable as common or expert-specific
         * Common fields are those whose placeholders match the placeholderNameMappings
         */
        categorizeField(templateVar) {
            if (typeof TemplateVariables === 'undefined' || !TemplateVariables.categorizeField) {
                throw new Error('GenieDashboard: TemplateVariables module is required but not loaded. Please ensure TemplateVariables.js is included before genieDashboard.js');
            }
            return TemplateVariables.categorizeField(templateVar, () => this.getPlaceholderNameMappings(), this.commonFieldsMap);
        }

        async addTemplatingInputFields(controlsRow, expertName = null, expertConfig = null) {
            // Determine which templating list to use

            // ========== DEBUG: Log containers ==========
            const controlsRowId = controlsRow ? (controlsRow.id || 'no-id') : 'null';
            const commonInputRowId = this.commonInputRow ? (this.commonInputRow.id || 'no-id') : 'null';
            const controlsRowIsCommon = controlsRow === this.commonInputRow;

            if (expertName) {
                console.log(`🔍 [DEBUG] addTemplatingInputFields: Container info for expert "${expertName}":`);
                console.log(`🔍 [DEBUG] - controlsRow (where fields will be added): id="${controlsRowId}", isCommonInputRow=${controlsRowIsCommon}`);
                console.log(`🔍 [DEBUG] - this.commonInputRow: id="${commonInputRowId}"`);
            } else {
                console.log(`🔍 [DEBUG] addTemplatingInputFields: Container info for FIRST TIME LOAD:`);
                console.log(`🔍 [DEBUG] - controlsRow (where fields will be added): id="${controlsRowId}", isCommonInputRow=${controlsRowIsCommon}`);
                console.log(`🔍 [DEBUG] - this.commonInputRow: id="${commonInputRowId}"`);
            }
            // ========== END DEBUG ==========


            // ========== DEBUG: Log existing input fields in DOM ==========
            const existingFieldIds = [];
            if (this.commonInputRow) {
                const allInputs = this.commonInputRow.querySelectorAll('[id^="' + this.instanceId + '-toolbar-"]');
                allInputs.forEach(el => {
                    const id = el.id;
                    const varName = id.replace(this.instanceId + '-toolbar-', '');
                    existingFieldIds.push({id: id, varName: varName});
                });
            }
            // Also check document scope
            const allDocInputs = document.querySelectorAll('[id^="' + this.instanceId + '-toolbar-"]');
            allDocInputs.forEach(el => {
                const id = el.id;
                const varName = id.replace(this.instanceId + '-toolbar-', '');
                if (!existingFieldIds.find(f => f.id === id)) {
                    existingFieldIds.push({id: id, varName: varName});
                }
            });
            const hasExistingInputFields = existingFieldIds.length > 0;

            if (expertName) {
                console.log(`🔍 [DEBUG] addTemplatingInputFields: BEFORE filtering for expert "${expertName}"`);
                console.log(`🔍 [DEBUG] Existing input fields in DOM (${existingFieldIds.length}):`, existingFieldIds.map(f => f.varName).join(', ') || 'none');
            } else {
                console.log(`🔍 [DEBUG] addTemplatingInputFields: FIRST TIME LOAD`);
                console.log(`🔍 [DEBUG] Existing input fields in DOM (${existingFieldIds.length}):`, existingFieldIds.map(f => f.varName).join(', ') || 'none');
            }
            // ========== END DEBUG ==========

            let templatingList = null;
            if (expertName && expertConfig && expertConfig.templating && expertConfig.templating.list) {
                templatingList = expertConfig.templating.list;
            } else if (this.dashboardConfig && this.dashboardConfig.templating && this.dashboardConfig.templating.list) {
                templatingList = this.dashboardConfig.templating.list;
            }

            if (!templatingList || templatingList.length === 0) {
                return;
            }

            // ========== DEBUG: Log templating list ==========
            if (expertName) {
                console.log(`🔍 [DEBUG] Expert "${expertName}" templating list (${templatingList.length} fields):`, templatingList.map(v => `${v.label || v.name} (${v.name})`).join(', '));
            } else {
                console.log(`🔍 [DEBUG] First load templating list (${templatingList.length} fields):`, templatingList.map(v => `${v.label || v.name} (${v.name})`).join(', '));
            }
            // ========== END DEBUG ==========


            // For first-time load (no expertName), use the updateInputFields function
            if (!expertName) {
                // Use the external updateInputFields function for first-time load
                await window.updateInputFields(this, controlsRow, this.dashboardConfig, this.inputConfig, this.instanceId);
                return;
            }

            // Update placeholder name mappings with label-to-placeholder mappings for all templating fields
            templatingList.forEach(templateVar => {
                this.updatePlaceholderNameMappings(templateVar);
            });

            // Get existing placeholder mappings to check what's already covered
            const config = expertName ? (this.expertInputConfigs?.[expertName] || {}) : (this.inputConfig || {});
            const existingMappings = this.getPlaceholderMappings(config);
            const existingPlaceholders = new Set();
            existingMappings.forEach((value, key) => {
                existingPlaceholders.add(key.toLowerCase());
            });

            // Get placeholder name mappings for common field identification
            const placeholderNameMappings = this.getPlaceholderNameMappings();

            // Get all placeholders that are already covered by common fields
            const coveredPlaceholders = new Set();
            Object.values(placeholderNameMappings).forEach(placeholders => {
                if (Array.isArray(placeholders)) {
                    placeholders.forEach(p => coveredPlaceholders.add(p.toLowerCase()));
                }
            });
            existingPlaceholders.forEach(p => coveredPlaceholders.add(p.toLowerCase()));

            // CRITICAL: For expert views, filter out common fields to prevent duplicates
            // Common fields should only appear in the common input row, not in expert-specific rows
            if (expertName) {
                const filteredTemplatingList = [];
                const excludedFields = [];

                for (const templateVar of templatingList) {
                    const categorization = this.categorizeField(templateVar);
                    console.log(`🔍 [DEBUG] Processing field "${templateVar.name}" (${templateVar.label || templateVar.name}) for expert "${expertName}": isCommon=${categorization.isCommon}`);


                    if (categorization.isCommon) {
                        // Check if the common field actually exists in the DOM
                        // CRITICAL: Use placeholder overlap to find the actual field
                        // If this field's placeholders overlap with an existing field's placeholders, they're the same field
                        let fieldNameToCheck = null;
                        let inputElement = null;

                        // Get placeholders for the current field
                        const currentPlaceholders = new Set();
                        const currentPlaceholderMappings = this.getPlaceholderNameMappings();
                        const currentFieldPlaceholders = currentPlaceholderMappings[templateVar.name] || [];
                        if (Array.isArray(currentFieldPlaceholders)) {
                            currentFieldPlaceholders.forEach(p => currentPlaceholders.add(p.toLowerCase()));
                        }

                        // Check all existing fields in the DOM to find one with overlapping placeholders
                        const allExistingFields = [];
                        if (this.commonInputRow) {
                            const allInputs = this.commonInputRow.querySelectorAll('[id^="' + this.instanceId + '-toolbar-"]');
                            allInputs.forEach(el => {
                                const id = el.id;
                                const varName = id.replace(this.instanceId + '-toolbar-', '').replace('-wrapper', '');
                                if (varName && !allExistingFields.includes(varName)) {
                                    allExistingFields.push(varName);
                                }
                            });
                        }

                        // Also check document scope
                        const allDocInputs = document.querySelectorAll('[id^="' + this.instanceId + '-toolbar-"]');
                        allDocInputs.forEach(el => {
                            const id = el.id;
                            const varName = id.replace(this.instanceId + '-toolbar-', '').replace('-wrapper', '');
                            if (varName && !allExistingFields.includes(varName)) {
                                allExistingFields.push(varName);
                            }
                        });

                        // Check each existing field to see if its placeholders overlap
                        for (const existingFieldName of allExistingFields) {
                            const existingFieldPlaceholders = currentPlaceholderMappings[existingFieldName] || [];
                            if (Array.isArray(existingFieldPlaceholders)) {
                                const hasOverlap = existingFieldPlaceholders.some(p => currentPlaceholders.has(p.toLowerCase()));
                                if (hasOverlap) {
                                    // Found a field with overlapping placeholders - this is the same field
                                    fieldNameToCheck = existingFieldName;
                                    const inputId = this.getInstanceId(`toolbar-${fieldNameToCheck}`);

                                    // Check in commonInputRow first
                                    if (this.commonInputRow) {
                                        inputElement = this.commonInputRow.querySelector(`#${inputId}`);
                                    }

                                    // Fallback to document scope
                                    if (!inputElement) {
                                        inputElement = document.getElementById(inputId);
                                    }

                                    console.log(`🔍 [DEBUG] Found field "${existingFieldName}" with overlapping placeholders for "${templateVar.name}"`);
                                    break;
                                }
                            }
                        }

                        // If no overlap found, fall back to checking by matchedFieldName or field name
                        if (!fieldNameToCheck) {
                            fieldNameToCheck = categorization.matchedFieldName || templateVar.name;

                            // If matchedFieldName is a label, find the actual field name from dashboard config
                            if (categorization.matchedFieldName && this.dashboardConfig && this.dashboardConfig.templating && this.dashboardConfig.templating.list) {
                                const matchedField = this.dashboardConfig.templating.list.find(tv =>
                                    (tv.label || tv.name) === categorization.matchedFieldName
                                );
                                if (matchedField && matchedField.name) {
                                    fieldNameToCheck = matchedField.name;
                                }
                            }

                            const inputId = this.getInstanceId(`toolbar-${fieldNameToCheck}`);

                            // Check in commonInputRow first (where fields are added)
                            if (this.commonInputRow) {
                                inputElement = this.commonInputRow.querySelector(`#${inputId}`);
                            }

                            // Fallback to document scope
                            if (!inputElement) {
                                inputElement = document.getElementById(inputId);
                            }
                        }

                        // ========== DEBUG: Log container check for common field ==========
                        let checkInCommonRow = null;
                        if (this.commonInputRow && fieldNameToCheck) {
                            const debugInputId = this.getInstanceId(`toolbar-${fieldNameToCheck}`);
                            checkInCommonRow = this.commonInputRow.querySelector(`#${debugInputId}`);
                        }
                        let checkInDocument = null;
                        if (fieldNameToCheck) {
                            const debugInputId = this.getInstanceId(`toolbar-${fieldNameToCheck}`);
                            checkInDocument = document.getElementById(debugInputId);
                        }
                        console.log(`🔍 [DEBUG] Checking common field "${templateVar.name}" (matchedField: "${categorization.matchedFieldName || 'none'}"): checking field "${fieldNameToCheck}", commonInputRow.querySelector=${!!checkInCommonRow}, document.getElementById=${!!checkInDocument}, final result=${!!inputElement}`);
                        // ========== END DEBUG ==========


                        if (inputElement) {
                            // Common field exists in UI - exclude it from expert input fields
                            excludedFields.push({
                                name: templateVar.name,
                                label: templateVar.label || templateVar.name,
                                matchedFieldName: categorization.matchedFieldName
                            });
                            console.log(`GenieDashboard: Excluding common field "${templateVar.name}" (${templateVar.label || templateVar.name}) from expert "${expertName}" - matches common field "${categorization.matchedFieldName}" and exists in UI`);
                        } else {
                            // Common field doesn't exist in UI - include it even though it's categorized as common
                            filteredTemplatingList.push(templateVar);
                            console.log(`GenieDashboard: Including common field "${templateVar.name}" (${templateVar.label || templateVar.name}) in expert "${expertName}" - categorized as common but matched field "${fieldNameToCheck}" not found in UI`);
                        }
                    } else {
                        // This field is expert-specific - check if it already exists in UI before adding
                        const inputId = this.getInstanceId(`toolbar-${templateVar.name}`);
                        let inputElement = null;

                        // ========== DEBUG: Log container check for expert field ==========
                        let checkInCommonRow = null;
                        if (this.commonInputRow) {
                            checkInCommonRow = this.commonInputRow.querySelector(`#${inputId}`);
                        }
                        const checkInDocument = document.getElementById(inputId);
                        inputElement = checkInCommonRow || checkInDocument;
                        console.log(`🔍 [DEBUG] Checking expert field "${templateVar.name}": commonInputRow.querySelector=${!!checkInCommonRow}, document.getElementById=${!!checkInDocument}, final result=${!!inputElement}`);
                        // ========== END DEBUG ==========

                        if (inputElement) {
                            // Expert field already exists in UI - exclude it to prevent duplicates
                            excludedFields.push({
                                name: templateVar.name,
                                label: templateVar.label || templateVar.name,
                                matchedFieldName: null
                            });
                            console.log(`GenieDashboard: Excluding expert field "${templateVar.name}" (${templateVar.label || templateVar.name}) from expert "${expertName}" - already exists in UI`);
                        } else {
                            // Expert field doesn't exist in UI - include it
                            filteredTemplatingList.push(templateVar);
                        }

                    }
                }

                if (excludedFields.length > 0) {
                    console.log(`GenieDashboard: Filtered ${excludedFields.length} common field(s) from expert "${expertName}":`, excludedFields.map(f => `${f.label} (${f.name})`).join(', '));
                    console.log(`GenieDashboard: Processing ${filteredTemplatingList.length} expert-specific field(s) for expert "${expertName}"`);
                }

                // Use filtered list for expert views
                templatingList = filteredTemplatingList;

                // ========== DEBUG: Log filtered results ==========
                console.log(`🔍 [DEBUG] AFTER filtering for expert "${expertName}":`);
                console.log(`🔍 [DEBUG] - Excluded fields (${excludedFields.length}):`, excludedFields.map(f => `${f.label} (${f.name})`).join(', ') || 'none');
                console.log(`🔍 [DEBUG] - Fields to add (${filteredTemplatingList.length}):`, filteredTemplatingList.map(v => `${v.label || v.name} (${v.name})`).join(', ') || 'none');
                // ========== END DEBUG ==========


                // If all fields were filtered out, return early unless no inputs exist yet
                if (templatingList.length === 0) {
                    if (!hasExistingInputFields && expertConfig && expertConfig.templating && Array.isArray(expertConfig.templating.list) && expertConfig.templating.list.length > 0) {
                        console.warn(`GenieDashboard: No input fields exist yet; using expert templating list to build dependency graph for "${expertName}"`);
                        templatingList = expertConfig.templating.list;
                    } else {
                        console.log(`GenieDashboard: All fields for expert "${expertName}" are common fields - no expert-specific input fields to add`);
                        return;
                    }
                }
            }

            // Build dependency graph for ordered execution
            // CRITICAL: For expert views, include common fields in dependency analysis
            // so expert fields can properly depend on common fields (e.g., $cell, $substrate)
            let allVarsForDependencyAnalysis = templatingList;
            if (expertName) {
                // Get common fields from dashboard config to include in dependency analysis
                const commonFieldsList = (this.dashboardConfig &&
                    this.dashboardConfig.templating &&
                    Array.isArray(this.dashboardConfig.templating.list))
                    ? this.dashboardConfig.templating.list
                    : [];

                // Filter to only include common fields (those that match placeholderNameMappings)
                const commonFieldsOnly = commonFieldsList.filter(templateVar => {
                    const categorization = this.categorizeField(templateVar);
                    return categorization.isCommon;
                });

                // Combine common fields with expert fields for dependency analysis
                // This allows expert fields to find dependencies on common fields
                allVarsForDependencyAnalysis = [...commonFieldsOnly, ...templatingList];

                console.log(`GenieDashboard: Building dependency graph for expert "${expertName}" with ${commonFieldsOnly.length} common field(s) + ${templatingList.length} expert field(s) for dependency analysis`);
            }

            // Pass config to check if dependencies already have values
            // Note: buildDependencyGraph will create nodes only for templatingList (expert fields),
            // but analyzeTemplateDependencies will use allVarsForDependencyAnalysis to find dependencies
            const dependencyGraph = this.buildDependencyGraph(templatingList, config, allVarsForDependencyAnalysis);

            // Store graph as instance property so executeTemplatingQuery can access it
            this.dependencyGraph = dependencyGraph;
            this.currentExpertConfig = expertConfig;

            // Execute queries in dependency order (chain execution)
            // Pass expertConfig so we can check all template variables for placeholder resolution
            await window.executeTemplateQueriesInOrder(this, dependencyGraph, controlsRow, expertName, expertConfig);
        }

        /**
         * Analyze dependencies for a template variable by finding $variable references in its query
         * Dependencies are based on placeholders in queries matching other template variable names/labels
         * A dependency is only added if the placeholder matches another input field AND that field has no value
         * @param {Object} templateVar - The template variable to analyze
         * @param {Array} allVars - All template variables
         * @param {Object} config - Current input config to check for existing values
         */
        analyzeTemplateDependencies(templateVar, allVars, config = null, ignoreExistingValues = false) {
            if (typeof TemplateVariables === 'undefined' || !TemplateVariables.analyzeTemplateDependencies) {
                throw new Error('GenieDashboard: TemplateVariables module is required but not loaded. Please ensure TemplateVariables.js is included before genieDashboard.js');
            }
            return TemplateVariables.analyzeTemplateDependencies(templateVar, allVars, config, ignoreExistingValues, (label, cfg) => this.getInputConfigValue(label, cfg));
        }

        /**
         * Build dependency graph for template variables with topological sort
         * @param {Array} templatingList - List of template variables to create nodes for
         * @param {Object} config - Current input config to check for existing values (optional)
         * @param {Array} allVarsForDependencyAnalysis - All template variables to use for dependency analysis (optional, defaults to templatingList)
         *                                                 This allows expert fields to find dependencies on common fields
         */
        buildDependencyGraph(templatingList, config = null, allVarsForDependencyAnalysis = null, ignoreExistingValues = false) {
            if (typeof TemplateVariables === 'undefined' || !TemplateVariables.buildDependencyGraph) {
                throw new Error('GenieDashboard: TemplateVariables module is required but not loaded. Please ensure TemplateVariables.js is included before genieDashboard.js');
            }
            // Create a wrapper for analyzeTemplateDependencies to pass dependencies
            const analyzeDeps = (tv, allVars, cfg, ignore) =>
                TemplateVariables.analyzeTemplateDependencies(tv, allVars, cfg, ignore, (label, config) => this.getInputConfigValue(label, config));
            return TemplateVariables.buildDependencyGraph(templatingList, config, allVarsForDependencyAnalysis, ignoreExistingValues, analyzeDeps);
        }

        /**
         * Check if all fields have values and auto-refresh panels (debounced)
         * Prevents multiple simultaneous refresh attempts
         */
        async checkAndAutoRefreshPanels() {
            // Initialize flags if not already done
            if (this._autoRefreshInProgress === undefined) {
                this._autoRefreshInProgress = false;
            }
            if (this._refreshPanelsInProgress === undefined) {
                this._refreshPanelsInProgress = false;
            }

            // Log the call with stack trace for debugging
            const stackTrace = new Error().stack;
            console.log(`🔵 GenieDashboard: checkAndAutoRefreshPanels() called - isFirstPageLoad: ${this._isFirstPageLoad}, autoRefreshInProgress: ${this._autoRefreshInProgress}, refreshPanelsInProgress: ${this._refreshPanelsInProgress}, timeoutExists: ${!!this._autoRefreshTimeout}`);
            console.log(`🔵 Stack trace:`, stackTrace);

            // Only allow auto-refresh during the first page load
            // After that, users must manually click the refresh button
            if (!this._isFirstPageLoad) {
                console.log(`🔵 GenieDashboard: Auto-refresh disabled (not first page load). User must click refresh button to refresh panels.`);
                return;
            }

            // If refresh is already in progress, skip (don't even schedule a new timeout)
            if (this._autoRefreshInProgress || this._refreshPanelsInProgress) {
                console.log(`🔵 GenieDashboard: Auto-refresh already in progress (autoRefresh: ${this._autoRefreshInProgress}, refreshPanels: ${this._refreshPanelsInProgress}), skipping duplicate check`);
                return;
            }

            // If a timeout is already scheduled, don't schedule another one
            // This prevents multiple pending refresh attempts
            if (this._autoRefreshTimeout) {
                console.log(`🔵 GenieDashboard: Auto-refresh timeout already scheduled, skipping duplicate check`);
                return;
            }

            // Check if panels are already being rendered or fetching data before scheduling timeout
            // This prevents duplicate queries if panels are already in the process of fetching
            const panelsFetching = Object.values(this.panels || {}).some(panel =>
                panel && panel._fetchInProgress
            );
            const panelsHaveData = Object.values(this.panels || {}).some(panel =>
                panel && panel._panelDiv && (panel._currentDataArray || panel._dataArray)
            );

            if (panelsFetching || (panelsHaveData && this._panelsRendered)) {
                console.log(`🔵 GenieDashboard: Panels already fetching or have data, skipping auto-refresh timeout to avoid duplicate queries`);
                this._autoRefreshInProgress = false;
                // If panels already have data, mark first page load as complete
                if (panelsHaveData && this._panelsRendered) {
                    this._isFirstPageLoad = false;
                }
                return;
            }

            // Debounce the check to allow all onChange callbacks to complete
            console.log(`🔵 GenieDashboard: Scheduling auto-refresh timeout (200ms debounce)`);
            // Set the flag immediately to prevent other calls from scheduling another timeout
            // We'll clear it if the check fails or after the refresh completes
            this._autoRefreshInProgress = true;
            this._autoRefreshTimeout = setTimeout(async () => {
                console.log(`🔵 GenieDashboard: Auto-refresh timeout callback executing`);
                // Clear the timeout reference immediately to allow new calls after this completes
                this._autoRefreshTimeout = null;

                // Double-check that refresh is not in progress (in case it started while timeout was pending)
                if (this._refreshPanelsInProgress) {
                    console.log(`🔵 GenieDashboard: Refresh already in progress (refreshPanels: ${this._refreshPanelsInProgress}), skipping duplicate check`);
                    this._autoRefreshInProgress = false; // Reset flag since we're not proceeding
                    return;
                }

                const allFieldsHaveValues = this.checkAllInputFieldsHaveValues();
                if (allFieldsHaveValues) {
                    // Check if any panels are currently fetching data to avoid duplicate queries
                    const panelsWithInProgressFetches = Object.values(this.panels || {}).filter(panel =>
                        panel && panel._fetchInProgress
                    );

                    if (panelsWithInProgressFetches.length > 0) {
                        console.log(`🔵 GenieDashboard: ${panelsWithInProgressFetches.length} panel(s) already fetching data, skipping auto-refresh to avoid duplicate queries`);
                        this._autoRefreshInProgress = false;
                        // Mark first page load as complete since panels are already fetching data
                        this._isFirstPageLoad = false;
                        return;
                    }

                    // Also check if panels have already been rendered and have data
                    // This handles the case where panels were rendered and data was fetched before this timeout fired
                    const panelsWithData = Object.values(this.panels || {}).filter(panel =>
                        panel && panel._panelDiv && (panel._currentDataArray || panel._dataArray)
                    );

                    if (panelsWithData.length > 0 && this._panelsRendered) {
                        console.log(`🔵 GenieDashboard: ${panelsWithData.length} panel(s) already have data from initial render, skipping auto-refresh to avoid duplicate queries`);
                        this._autoRefreshInProgress = false;
                        // Mark first page load as complete since panels are already rendered with data
                        this._isFirstPageLoad = false;
                        return;
                    }

                    console.log(`🔵 GenieDashboard: All input fields have values, auto-refreshing panels (first page load only)`);
                    try {
                        // Refresh panels without running queries again (they just completed)
                        await this.refreshPanelsDataOnly(true, false);
                        console.log(`🔵 GenieDashboard: Successfully auto-refreshed panels after all queries completed`);
                        // After first successful auto-refresh, disable auto-refresh for subsequent changes
                        this._isFirstPageLoad = false;
                        console.log(`🔵 GenieDashboard: First page load auto-refresh completed. Auto-refresh disabled. User must click refresh button for future refreshes.`);
                    } catch (error) {
                        console.error(`🔵 GenieDashboard: Error auto-refreshing panels:`, error);
                    } finally {
                        this._autoRefreshInProgress = false;
                        console.log(`🔵 GenieDashboard: Auto-refresh completed, flag reset`);
                    }
                } else {
                    const fieldStatus = this.getMissingInputFields();
                    console.log(`🔵 GenieDashboard: Not all input fields have values. Missing: ${fieldStatus.missing.join(', ')}. Panels will not be auto-refreshed.`);
                    this._autoRefreshInProgress = false; // Reset flag since we're not proceeding
                }
            }, 200); // 200ms debounce to allow all onChange callbacks to complete
        }

        /**
         * Trigger dependent queries when a field value changes
         * Only affects dependents (and their dependents recursively), never touches dependencies
         * @param {string} varName - The variable name that changed
         * @param {string} expertName - Optional expert name
         * @param {object} expertConfig - Optional expert config
         */
        async triggerDependentQueries(varName, expertName = null, expertConfig = null) {
            if (!this.dependencyGraph) {
                console.warn(`GenieDashboard: No dependency graph available to trigger dependent queries for "${varName}"`);
                return;
            }

            // Recursively collect all downstream dependents (NOT the trigger field itself)
            const allDependents = new Set();
            const collectDependents = (varName) => {
                const node = this.dependencyGraph.nodes.get(varName);
                if (node && node.dependents) {
                    node.dependents.forEach(dep => {
                        // Never include the trigger field itself - only its dependents
                        if (dep !== varName && !allDependents.has(dep)) {
                            allDependents.add(dep);
                            collectDependents(dep); // Recursively collect downstream dependents
                        }
                    });
                }
            };
            collectDependents(varName);

            // Ensure the trigger field itself is NEVER in the dependents set
            allDependents.delete(varName);

            if (allDependents.size === 0) {
                // No dependents to trigger
                return;
            }

            console.log(`GenieDashboard: Value changed for "${varName}", triggering dependent queries: ${Array.from(allDependents).join(', ')}`);
            // CRITICAL: Update node.value in dependency graph from the actual UI element
            // This ensures dependency checks see the current value, not the old value
            const triggerNode = this.dependencyGraph.nodes.get(varName);
            if (triggerNode) {
                // Get the actual selected value from the UI element
                const selectId = this.getInstanceId(`toolbar-${varName}`);
                const autocompleteInstance = this.findAutocompleteInstance(varName);
                let actualValue = null;

                if (autocompleteInstance && typeof autocompleteInstance.getValue === 'function') {
                    const instanceValue = autocompleteInstance.getValue();
                    // Handle both single values and arrays (for multi-select)
                    if (Array.isArray(instanceValue)) {
                        actualValue = instanceValue.length > 0 ? instanceValue[0] : '';
                    } else {
                        actualValue = instanceValue || '';
                    }
                } else {
                    const select = document.getElementById(selectId);
                    if (select && select.tagName === 'SELECT') {
                        actualValue = select.value || '';
                    }
                }

                // Update node.value to reflect the actual UI state
                triggerNode.value = actualValue ? String(actualValue) : '';
                // Note: blockedQueries is managed in executeTemplateQueriesInOrder
                // When refreshInputFields is called, the dependency check logic will see that
                // triggerNode.value is set and treat it as satisfied, not blocked
                console.log(`🔄 [FIELD CHANGE] Updated node.value for "${varName}" in dependency graph: "${triggerNode.value}"`);
            }


            // Get the controls row to pass to executeTemplateQueriesInOrder
            // Scope to this instance container to support multiple dashboard instances
            const controlsRow = this.container.querySelector(`.genie-dashboard-controls-row`) || document.getElementById(this.getInstanceId('controls-row'));
            if (!controlsRow) {
                console.warn(`GenieDashboard: Controls row not found, cannot trigger dependent queries`);
                return;
            }

            // Reuse the same refreshInputFields function used for time range changes
            // This ensures consistent behavior: dependency calculation, reset, and status updates
            // Pass fieldsToRefresh=allDependents to only process the changed field's dependents chain
            // Pass isTimeRangeChange=false (it's a field value change, not time range change)
            await window.refreshInputFields(this, controlsRow, this.dashboardConfig, this.inputConfig, this.instanceId, false, allDependents);

            // After dependent queries complete, check if all fields have values and refresh panels
            // BUT: Only call checkAndAutoRefreshPanels() if there's no top-level execution in progress
            // If a top-level execution is running, it will handle the refresh at the end
            // This prevents duplicate refreshes when user changes a field during initial load
            if (!this._topLevelExecutionInProgress) {
                console.log(`🔵 GenieDashboard: Dependent queries for "${varName}" completed, no top-level execution in progress, triggering panel auto-refresh.`);
                await this.checkAndAutoRefreshPanels();
            } else {
                console.log(`🔵 GenieDashboard: Dependent queries for "${varName}" completed, but top-level execution is in progress, skipping checkAndAutoRefreshPanels() (will be handled by top-level execution)`);
            }
        }

        /**
         * Execute template variable queries in dependency order (chain execution)
         * Stops if a required dependency value is not available
         * First renders all input fields, then fetches data asynchronously
         * @param {Set} dependentsToProcess - Optional: if provided, only process these fields (skip dependencies)
         * @param {boolean} isRecursiveCall - Optional: if true, skip calling checkAndAutoRefreshPanels() at the end (only top-level call should trigger refresh)
         */

        /**
         * Check if all placeholders in a query can be filled
         * A placeholder can be filled if:
         * - It's a system variable (start, end, interval, span) - always available
         * - It references another input field that has completed and has a value
         * @param {Object} templateVar - The template variable with the query
         * @param {Object} graph - The dependency graph
         * @param {Object} config - Current input config
         * @param {Array} allVars - All template variables
         * @returns {Object} - { canExecute: boolean, missingPlaceholders: Array }
         */
        canExecuteQuery(templateVar, graph, config, allVars) {
            if (typeof TemplateVariables === 'undefined' || !TemplateVariables.canExecuteQuery) {
                throw new Error('GenieDashboard: TemplateVariables module is required but not loaded. Please ensure TemplateVariables.js is included before genieDashboard.js');
            }
            return TemplateVariables.canExecuteQuery(templateVar, graph, config, allVars, () => this.getPlaceholderNameMappings(), (label, cfg) => this.getInputConfigValue(label, cfg));
        }

        /**
         * Create input field only (without executing query)
         * Used for initial rendering before data fetch
         */
        async createInputFieldOnly(templateVar, controlsRow, expertName = null, expertConfig = null) {
            // Call executeTemplateVariableQuery with renderOnly=true

            // ========== DEBUG: createInputFieldOnly called ==========
            console.log(`🔍 [DEBUG] createInputFieldOnly: Creating field "${templateVar.name}" (${templateVar.label || templateVar.name}) - expertName: ${expertName || 'null'}`);
            // ========== END DEBUG ==========

            // Call executeTemplateVariableQuery with renderOnly=true to skip query execution
            await this.executeTemplateVariableQuery(templateVar, controlsRow, expertName, true, expertConfig);
        }

        /**
         * Helper function to find autocomplete instance for a given variable name
         * @param {string} varName - Variable name
         * @returns {AutocompleteDropdown|null} - Autocomplete instance or null if not found
         */
        findAutocompleteInstance(varName) {
            const selectId = this.getInstanceId(`toolbar-${varName}`);

            // Try multiple ways to find the instance
            const containerWrapper = document.getElementById(selectId + '-wrapper');
            if (containerWrapper && containerWrapper._autocompleteInstance) {
                return containerWrapper._autocompleteInstance;
            }

            const select = document.getElementById(selectId);
            if (select && select._autocompleteInstance) {
                return select._autocompleteInstance;
            }

            // Try to find via autocompleteInstances map
            const autocompleteData = this.autocompleteInstances?.[varName];
            if (autocompleteData && autocompleteData.instance) {
                return autocompleteData.instance;
            }

            return null;
        }

        /**
         * Execute query for an existing input field (field must already be rendered)
         * This should ONLY be called when the query is ready (all placeholders can be filled)
         */
        async executeQueryForField(templateVar, expertName = null, expertConfig = null) {
            const varName = templateVar.name;
            const containerId = this.getInstanceId(`toolbar-${varName}`);

            // Try to find the autocomplete instance or select element - wait a bit if it doesn't exist (might be a timing issue)
            let autocompleteInstance = null;
            let select = null;

            // First, try to find autocomplete instance (for query-type fields with dynamic queries)
            const containerWrapper = document.getElementById(containerId + '-wrapper');
            if (containerWrapper && containerWrapper._autocompleteInstance) {
                autocompleteInstance = containerWrapper._autocompleteInstance;
            } else {
                // Try to find it by searching for the hidden select
                const hiddenSelect = document.getElementById(containerId);
                if (hiddenSelect && hiddenSelect._autocompleteInstance) {
                    autocompleteInstance = hiddenSelect._autocompleteInstance;
                } else if (hiddenSelect && hiddenSelect.tagName === 'SELECT') {
                    // Fallback: might be a regular select element (for backward compatibility)
                    select = hiddenSelect;
                }
            }

            // If not found, wait a bit and try again (element might still be rendering)
            if (!autocompleteInstance && !select) {
                await new Promise(resolve => setTimeout(resolve, 50));
                const retryWrapper = document.getElementById(containerId + '-wrapper');
                if (retryWrapper && retryWrapper._autocompleteInstance) {
                    autocompleteInstance = retryWrapper._autocompleteInstance;
                } else {
                    const retrySelect = document.getElementById(containerId);
                    if (retrySelect && retrySelect._autocompleteInstance) {
                        autocompleteInstance = retrySelect._autocompleteInstance;
                    } else if (retrySelect && retrySelect.tagName === 'SELECT') {
                        select = retrySelect;
                    }
                }
            }

            if (!autocompleteInstance && !select) {
                console.warn(`GenieDashboard: Input field not found for "${varName}" (ID: ${containerId}) - cannot execute query`);
                // Scope to this instance container to support multiple dashboard instances
                const availableElements = Array.from(this.container.querySelectorAll(`[id*="${this.instanceId}-toolbar-"]`)).map(el => el.id);
                console.warn(`GenieDashboard: Available toolbar elements:`, availableElements);
                return;
            }

            // NOTE: Dependencies are already validated in executeTemplateQueriesInOrder
            // This function is called only when dependencies are ready, so we proceed directly
            // The executeTemplatingQueryHelper will do a final lightweight check for non-dependency placeholders

            // Get the query execution function if it exists
            if (this.templatingQueryFunctions && this.templatingQueryFunctions[varName]) {
                try {
                    await this.templatingQueryFunctions[varName]();
                    // Query succeeded - value will be set by the query function
                    // The calling code will mark node.succeeded = true
                } catch (error) {
                    // Query failed - re-throw so calling code can mark as failed
                    console.error(`GenieDashboard: Query execution failed for "${varName}":`, error);
                    throw error;
                }
            } else {
                // If function doesn't exist, we need to create it
                // This shouldn't happen if createInputFieldOnly was called first
                console.warn(`GenieDashboard: Query function not found for "${varName}" - field may not have been created properly`);
                throw new Error(`Query function not found for "${varName}"`);
            }
        }

        /**
         * Shared helper function to execute a templating query and populate a select element
         * @param {Object} templateVar - The template variable configuration
         * @param {HTMLElement} selectElement - The select element to populate
         * @param {string} expertName - Expert name if this is an expert-specific field
         * @param {Object} expertConfig - Expert config if available
         * @param {string} varName - Variable name
         * @param {string} varLabel - Variable label
         * @param {*} currentValue - Current value to select
         * @param {boolean} isMulti - Whether this is a multi-select
         * @param {boolean} includeAll - Whether to include "All" option
         * @param {string} allValue - Value to use for "All" option
         * @param {Array} possiblePlaceholders - Possible placeholder names for this variable
         */
        async executeTemplatingQueryHelper(templateVar, selectElementOrAutocomplete, expertName, expertConfig, varName, varLabel, currentValue, isMulti, includeAll, allValue, possiblePlaceholders) {
            // Check if options are already provided - if options array has length > 0, skip query execution
            if (templateVar.options && Array.isArray(templateVar.options) && templateVar.options.length > 0) {
                console.log(`GenieDashboard: Skipping query execution for "${varName}" (options already provided: ${templateVar.options.length} options)`);
                return; // Don't execute query
            }

            // CRITICAL: Check dependencies BEFORE executing query
            const expertConfigToUse = this.currentExpertConfig || (expertName ? expertConfig : null);
            const allTemplatingList = expertName && expertConfigToUse?.templating?.list
                ? expertConfigToUse.templating.list
                : (this.dashboardConfig?.templating?.list || []);
            const configToUse = this.getEffectiveInputConfig(expertName);
            const configForWrite = this.getInputConfigForWrite(expertName);
            const graphToUse = this.dependencyGraph;

            // Detect if this is an autocomplete instance or a select element
            const isAutocomplete = selectElementOrAutocomplete && typeof selectElementOrAutocomplete.setOptions === 'function';
            const isSelect = selectElementOrAutocomplete && selectElementOrAutocomplete.tagName === 'SELECT';

            // NOTE: The main dependency validation happens in executeTemplateQueriesInOrder
            // This function is called only after dependencies are validated, so we trust that
            // and proceed with execution. The main loop ensures dependencies are ready.
            // We only do a final check for system variables (time range) which must be available
            // before any query can execute.

            // Final check: ensure time range is available (required for all queries)
            // Store these for later use in query execution
            let startTimestamp = this.getInputConfigValue('Start', configToUse) || this.getInputConfigValue('start', configToUse) || configToUse['$start'];
            let endTimestamp = this.getInputConfigValue('End', configToUse) || this.getInputConfigValue('end', configToUse) || configToUse['$end'];

            if (!startTimestamp || !endTimestamp) {
                console.warn(`GenieDashboard: [executeTemplatingQuery] Time range not available for "${varName}"`);
                if (isSelect) {
                    selectElementOrAutocomplete.innerHTML = '';
                    const waitingOption = document.createElement('option');
                    waitingOption.value = '';
                    waitingOption.textContent = '-- Waiting for time range --';
                    selectElementOrAutocomplete.appendChild(waitingOption);
                } else if (isAutocomplete) {
                    // Show waiting message for autocomplete
                    if (typeof selectElementOrAutocomplete.showStatusMessage === 'function') {
                        selectElementOrAutocomplete.showStatusMessage('Waiting for time range', '#92400e');
                    } else {
                        selectElementOrAutocomplete.setOptions([]);
                    }
                }
                return;
            }

            // Proceed with execution - dependencies are validated by the main loop

            try {
                // If options are provided and no query, use static options
                if (templateVar.options && Array.isArray(templateVar.options) && templateVar.options.length > 0 && !templateVar.query && !templateVar.definition) {
                    // Use static options directly
                    let staticOptions = templateVar.options.map(opt => {
                        if (typeof opt === 'string') {
                            return opt;
                        } else if (typeof opt === 'object' && opt !== null) {
                            return opt.value || opt.text || String(opt);
                        }
                        return String(opt);
                    }).filter(opt => opt !== null && opt !== undefined && opt !== '');

                    // Remove duplicates and sort
                    staticOptions = [...new Set(staticOptions)];
                    if (templateVar.sort !== undefined && templateVar.sort !== null) {
                        if (templateVar.sort === 1) {
                            staticOptions.sort();
                        } else if (templateVar.sort === 2) {
                            staticOptions.sort((a, b) => {
                                const numA = parseFloat(a);
                                const numB = parseFloat(b);
                                if (!isNaN(numA) && !isNaN(numB)) {
                                    return numA - numB;
                                }
                                return String(a).localeCompare(String(b));
                            });
                        }
                    } else {
                        staticOptions.sort();
                    }

                    // Prepare options array for autocomplete or select
                    let finalOptions = [...staticOptions];
                    if (includeAll) {
                        finalOptions.unshift(allValue);
                    }

                    // Populate autocomplete or select
                    if (isAutocomplete) {
                        selectElementOrAutocomplete.setOptions(finalOptions);
                        if (currentValue) {
                            selectElementOrAutocomplete.setValue(currentValue, true); // Skip notify - options already provided
                        }
                    } else if (isSelect) {
                        selectElementOrAutocomplete.innerHTML = '';

                        // Add "All" option if includeAll is true
                        if (includeAll) {
                            const allOption = document.createElement('option');
                            allOption.value = allValue;
                            allOption.textContent = 'All';
                            const currentValues = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
                            if (currentValues.includes(allValue) || currentValues.includes('$__all') || currentValues.includes('All')) {
                                allOption.selected = true;
                            }
                            selectElementOrAutocomplete.appendChild(allOption);
                        }

                        // Add empty option if not multi and not includeAll
                        if (!isMulti && !includeAll) {
                            const emptyOption = document.createElement('option');
                            emptyOption.value = '';
                            emptyOption.textContent = '-- Select --';
                            selectElementOrAutocomplete.appendChild(emptyOption);
                        }

                        // Add static options
                        staticOptions.forEach(opt => {
                            const optionEl = document.createElement('option');
                            optionEl.value = opt;
                            optionEl.textContent = opt;

                            if (isMulti) {
                                const currentValues = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
                                if (currentValues.includes(opt)) {
                                    optionEl.selected = true;
                                }
                            } else {
                                if (opt === currentValue) {
                                    optionEl.selected = true;
                                }
                            }

                            selectElementOrAutocomplete.appendChild(optionEl);
                        });
                    }

                    console.log(`GenieDashboard: Populated static options for "${varName}", got ${staticOptions.length} options`);
                    return;
                }

                // Get datasource from templating variable or dashboard config
                const datasource = templateVar.datasource || this.dashboardConfig?.datasource;
                let dsType = null;
                if (datasource) {
                    if (typeof datasource === 'string') {
                        dsType = datasource;
                    } else if (datasource && typeof datasource === 'object' && datasource.type) {
                        dsType = datasource.type;
                    }
                }

                // Get endpoint for this datasource - use expert config if available
                const endpoint = dsType ? (configToUse?.[dsType] || null) : null;
                if (!endpoint) {
                    console.warn(`GenieDashboard: No endpoint found for templating variable "${varName}" datasource:`, dsType);
                    if (isSelect) {
                        selectElementOrAutocomplete.innerHTML = '';
                        const emptyOption = document.createElement('option');
                        emptyOption.value = '';
                        emptyOption.textContent = '-- No endpoint --';
                        selectElementOrAutocomplete.appendChild(emptyOption);
                    } else if (isAutocomplete) {
                        if (typeof selectElementOrAutocomplete.showStatusMessage === 'function') {
                            selectElementOrAutocomplete.showStatusMessage('No endpoint', '#dc2626');
                        } else {
                            selectElementOrAutocomplete.setOptions([]);
                        }
                    }
                    return;
                }

                // Process the query (replace placeholders) - use definition if query is not available
                const query = templateVar.query || templateVar.definition || '';

                // Check if query matches service(QUERY,jsonpath(...)) pattern BEFORE processing
                const {actualQuery, jsonPath} = this.parseServiceJsonPathPattern(query, varName);

                // Dependencies already checked at the start, time range checked earlier
                console.log(`GenieDashboard: All placeholders validated for "${varName}", proceeding with query execution`);

                // Process the actual query (replace placeholders) - use expert config if available
                const processResult = this.processQuery(actualQuery, 0, expertName);
                // Handle both old format (string) and new format (object)
                let processedQuery = typeof processResult === 'string' ? processResult : (processResult?.processed || actualQuery);

                // Time range was already checked at the start of this function (startTimestamp, endTimestamp)

                // Execute query - pass regex if available in templateVar
                // Check multiple sources for regex to ensure we don't miss it
                let regex = templateVar.regex || null;

                // Fallback: Check dependency graph node if regex is missing
                if (!regex && this.dependencyGraph && this.dependencyGraph.nodes) {
                    const graphNode = this.dependencyGraph.nodes.get(varName);
                    if (graphNode && graphNode.var && graphNode.var.regex) {
                        console.log(`GenieDashboard: [executeTemplatingQueryHelper] Found regex in dependency graph node for "${varName}"`);
                        regex = graphNode.var.regex;
                        // Update templateVar to include regex for consistency
                        templateVar.regex = regex;
                    }
                }

                // Fallback: Check autocompleteData if regex is still missing
                if (!regex && this.autocompleteInstances && this.autocompleteInstances[varName]) {
                    const autocompleteData = this.autocompleteInstances[varName];
                    if (autocompleteData.templateVar && autocompleteData.templateVar.regex) {
                        console.log(`GenieDashboard: [executeTemplatingQueryHelper] Found regex in autocompleteData for "${varName}"`);
                        regex = autocompleteData.templateVar.regex;
                        // Update templateVar to include regex for consistency
                        templateVar.regex = regex;
                    }
                }

                console.log(`GenieDashboard: [executeTemplatingQueryHelper] Executing query for "${varName}" with regex:`, regex, 'templateVar.regex:', templateVar.regex);
                let response = await this.fetchData(endpoint, processedQuery, startTimestamp, endTimestamp, 'templating_' + varName, null, dsType, regex);

                // If jsonpath is specified, extract values using jsonpath
                if (jsonPath) {
                    const originalResponse = response;
                    response = this.extractValuesFromResponse(response, jsonPath, varName);
                    // Log if extraction returned objects instead of primitives
                    if (Array.isArray(response) && response.length > 0 && typeof response[0] === 'object' && response[0] !== null) {
                        console.warn(`GenieDashboard: ⚠️ JSONPath extraction returned objects instead of primitives for "${varName}"`);
                        console.warn(`GenieDashboard:   JSONPath: "${jsonPath}"`);
                        console.warn(`GenieDashboard:   Sample extracted value:`, response[0]);
                    }
                } else {
                    // Log when jsonpath is not provided (pattern not detected)
                    if (query && query.includes('service(') && query.includes('jsonpath')) {
                        console.warn(`GenieDashboard: ⚠️ Query contains "service(" and "jsonpath" but pattern was not parsed for "${varName}"`);
                        console.warn(`GenieDashboard:   Query: "${query.substring(0, 200)}${query.length > 200 ? '...' : ''}"`);
                    }
                }

                // Parse response to extract options
                let options = [];

                // Parse from query response
                if (Array.isArray(response)) {
                    options = response;
                } else if (response && Array.isArray(response.data)) {
                    options = response.data;
                } else if (response && Array.isArray(response.values)) {
                    options = response.values;
                } else if (typeof response === 'object' && response.result) {
                    if (Array.isArray(response.result)) {
                        options = response.result;
                    } else if (Array.isArray(response.result.data)) {
                        options = response.result.data;
                    }
                } else if (typeof response === 'string') {
                    // If response is a string, try to parse it
                    try {
                        const parsed = JSON.parse(response);
                        if (Array.isArray(parsed)) {
                            options = parsed;
                        }
                    } catch (e) {
                        // If not JSON, treat as single value
                        options = [response];
                    }
                }

                // Merge with templateVar.options if provided (for additional static options)
                if (templateVar.options && Array.isArray(templateVar.options) && templateVar.options.length > 0) {
                    const staticOptions = templateVar.options.map(opt => {
                        if (typeof opt === 'string') {
                            return opt;
                        } else if (typeof opt === 'object' && opt !== null) {
                            return opt.value || opt.text || String(opt);
                        }
                        return String(opt);
                    }).filter(opt => opt !== null && opt !== undefined && opt !== '');
                    // Merge and deduplicate: static options first, then query results
                    options = [...new Set([...staticOptions, ...options])];
                }

                // Apply regex if specified (after jsonpath extraction)
                if (templateVar.regex && templateVar.regex !== '' && options.length > 0) {
                    try {
                        const regex = this.buildTemplateRegex(templateVar.regex);
                        if (regex) {
                            options = options.map(opt => {
                                const str = typeof opt === 'string' ? opt : (opt.text || opt.value || String(opt));
                                const match = str.match(regex);
                                return match && match[1] ? match[1] : str;
                            }).filter(opt => opt);
                        }
                    } catch (e) {
                        console.warn(`GenieDashboard: Invalid regex for templating variable "${varName}":`, templateVar.regex);
                    }
                }

                // Ensure all options are primitive values (strings, numbers), not objects
                options = options.map(opt => {
                    if (typeof opt === 'string' || typeof opt === 'number' || typeof opt === 'boolean') {
                        return opt;
                    }
                    if (typeof opt === 'object' && opt !== null) {
                        return opt.value || opt.text || opt.label || opt.name || String(opt);
                    }
                    return String(opt);
                }).filter(opt => opt !== null && opt !== undefined && opt !== '');

                // Remove duplicates and sort
                options = [...new Set(options)];
                if (templateVar.sort !== undefined && templateVar.sort !== null) {
                    if (templateVar.sort === 1) {
                        options.sort();
                    } else if (templateVar.sort === 2) {
                        options.sort((a, b) => {
                            const numA = parseFloat(a);
                            const numB = parseFloat(b);
                            if (!isNaN(numA) && !isNaN(numB)) {
                                return numA - numB;
                            }
                            return String(a).localeCompare(String(b));
                        });
                    }
                } else {
                    options.sort();
                }

                // Check if query returned any values
                if (options.length === 0) {
                    // Query succeeded but returned no values
                    console.log(`GenieDashboard: Query for "${varName}" succeeded but returned no values`);

                    // If includeAll is true, add "All" option instead of showing "No values found"
                    if (includeAll) {
                        // Prepare options with just "All" option
                        const allOption = typeof allValue === 'string' ? {value: allValue, text: 'All'} : allValue;
                        const finalOptions = [allOption];

                        if (isAutocomplete) {
                            // Set options with "All" option
                            selectElementOrAutocomplete.setOptions(finalOptions);
                            // Clear any status message since we have the "All" option
                            if (typeof selectElementOrAutocomplete.clearStatusMessage === 'function') {
                                selectElementOrAutocomplete.clearStatusMessage();
                            }
                            // If currentValue contains allValue, set it
                            const currentValues = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
                            if (currentValues.includes(allValue) || currentValues.includes('*')) {
                                selectElementOrAutocomplete.setValue(allValue, true); // Skip notify - will batch trigger dependents later
                                console.log(`GenieDashboard: Set "All" option (${allValue}) for "${varName}" since query returned no values but includeAll is true`);
                            }
                        } else if (isSelect) {
                            // For select elements, add "All" option
                            selectElementOrAutocomplete.innerHTML = '';
                            const allOptionEl = document.createElement('option');
                            allOptionEl.value = allValue;
                            allOptionEl.textContent = 'All';
                            selectElementOrAutocomplete.appendChild(allOptionEl);
                            // Set value if currentValue matches allValue
                            const currentValues = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
                            if (currentValues.includes(allValue) || currentValues.includes('*')) {
                                selectElementOrAutocomplete.value = allValue;
                            }
                        }
                        return; // Exit early - we've set the "All" option
                    } else {
                        // No includeAll - show "no values found" message but allow typing
                        if (isAutocomplete) {
                            // Set empty options and show "no values found" message (but don't disable input)
                            selectElementOrAutocomplete.setOptions([]);
                            if (typeof selectElementOrAutocomplete.showStatusMessage === 'function') {
                                // Show message but keep input enabled for typing
                                selectElementOrAutocomplete.showStatusMessage('No values found', '#92400e', false);
                            }
                        } else if (isSelect) {
                            // For select elements, show "no values found" option
                            selectElementOrAutocomplete.innerHTML = '';
                            const noValuesOption = document.createElement('option');
                            noValuesOption.value = '';
                            noValuesOption.textContent = '-- No values found --';
                            selectElementOrAutocomplete.appendChild(noValuesOption);
                        }
                        return; // Exit early - no need to process empty options
                    }
                }

                // Prepare final options array (add "All" option if needed)
                let finalOptions = [...options];
                if (includeAll) {
                    // Remove any existing "$__all" or "*" options first (they will be replaced with proper "All" option)
                    finalOptions = finalOptions.filter(opt => {
                        const optValue = typeof opt === 'string' ? opt : (typeof opt === 'object' && opt !== null ? (opt.value || opt.text || String(opt)) : String(opt));
                        return optValue !== '$__all' && optValue !== '$__all__' && optValue !== '*';
                    });

                    // Check if "All" option already exists with the correct value
                    const hasAllOption = finalOptions.some(opt => {
                        const optValue = typeof opt === 'string' ? opt : (typeof opt === 'object' && opt !== null ? (opt.value || opt.text || String(opt)) : String(opt));
                        return String(optValue) === String(allValue);
                    });
                    if (!hasAllOption) {
                        // Get the text for "All" from current.text if available, otherwise use "All"
                        const allText = (templateVar.current && templateVar.current.text && Array.isArray(templateVar.current.text) && templateVar.current.text.length > 0)
                            ? templateVar.current.text[0]
                            : 'All';
                        // Add "All" option at the beginning with the correct value
                        finalOptions.unshift({value: allValue, text: allText});
                    } else {
                        // "All" option exists but might have wrong value - ensure it's at the beginning
                        finalOptions = finalOptions.filter(opt => {
                            const optValue = typeof opt === 'string' ? opt : (typeof opt === 'object' && opt !== null ? (opt.value || opt.text || String(opt)) : String(opt));
                            return String(optValue) !== String(allValue);
                        });
                        const allText = (templateVar.current && templateVar.current.text && Array.isArray(templateVar.current.text) && templateVar.current.text.length > 0)
                            ? templateVar.current.text[0]
                            : 'All';
                        finalOptions.unshift({value: allValue, text: allText});
                    }
                }

                // Populate autocomplete or select element
                if (isAutocomplete) {
                    // Clear any status message before populating options (only if not an error or failed message)
                    if (typeof selectElementOrAutocomplete.clearStatusMessage === 'function') {
                        const currentMessage = selectElementOrAutocomplete.statusMessage;
                        // Only clear if it's not an error or failed message
                        if (!currentMessage || (!currentMessage.includes('Error') && !currentMessage.includes('error') && !currentMessage.includes('Failed'))) {
                            selectElementOrAutocomplete.clearStatusMessage();
                        }
                    }

                    // Update autocomplete options
                    selectElementOrAutocomplete.setOptions(finalOptions);

                    // Helper function to check if a value exists in the options
                    const valueExistsInOptions = (value, options) => {
                        if (!value) return false;
                        const valueStr = String(value);
                        return options.some(opt => {
                            const optValue = typeof opt === 'object' && opt !== null
                                ? (opt.value || opt.text || String(opt))
                                : String(opt);
                            return String(optValue) === valueStr;
                        });
                    };

                    // Set current value based on query results
                    // Logic: If only one option exists, always use it (even if it doesn't match currentValue)
                    //        If multiple options exist, only use currentValue if it matches one of them
                    if (currentValue) {
                        // Check if currentValue exists in finalOptions
                        const currentValues = Array.isArray(currentValue) ? currentValue : [currentValue];

                        // Special case: If only one option exists, always consider it valid (regardless of match)
                        const hasSingleOption = finalOptions.length === 1 && !includeAll;
                        const singleOptionValue = hasSingleOption ? (finalOptions[0].value || finalOptions[0].text || finalOptions[0]) : null;

                        const validValues = currentValues.filter(v => {
                            // Always allow allValue if includeAll is true
                            if (includeAll && (v === allValue || v === '*' || v === '$__all')) {
                                return true;
                            }
                            // If only one option exists, always consider it valid
                            if (hasSingleOption && singleOptionValue) {
                                return true;
                            }
                            // If multiple options, must match
                            return valueExistsInOptions(v, finalOptions);
                        });

                        if (validValues.length > 0) {
                            // If single option exists, use it (even if it doesn't match currentValue)
                            const valueToSet = hasSingleOption && singleOptionValue
                                ? (isMulti ? [singleOptionValue] : singleOptionValue)
                                : (isMulti ? validValues : validValues[0]);
                            selectElementOrAutocomplete.setValue(valueToSet, true); // Skip notify - will batch trigger dependents later
                            // Update inputConfig with the validated value
                            this.setInputConfigValue(varLabel, valueToSet, possiblePlaceholders, configForWrite);
                            if (hasSingleOption && !valueExistsInOptions(currentValues[0], finalOptions)) {
                                console.log(`GenieDashboard: Set single available value "${valueToSet}" for "${varName}" (currentValue "${currentValue}" didn't match, but only one option exists)`);
                            } else {
                                console.log(`GenieDashboard: Set current value "${valueToSet}" for "${varName}" (validated against query results)`);
                            }
                        } else {
                            // Current value doesn't exist in query results
                            // BUT: If includeAll is true and currentValue is allValue, always set it (it's the "All" option we added)
                            if (includeAll && currentValue && (String(currentValue) === String(allValue) || (Array.isArray(currentValue) && currentValue.some(v => String(v) === String(allValue))))) {
                                const valueToSet = isMulti ? (Array.isArray(currentValue) ? currentValue : [currentValue]) : (Array.isArray(currentValue) ? currentValue[0] : currentValue);
                                selectElementOrAutocomplete.setValue(valueToSet, true); // Skip notify - will batch trigger dependents later
                                this.setInputConfigValue(varLabel, valueToSet, possiblePlaceholders, configForWrite);
                                console.log(`GenieDashboard: Set "All" option (${allValue}) for "${varName}" from current.value, regardless of query results`);
                            } else if (hasSingleOption && singleOptionValue) {
                                // Single option exists but currentValue didn't pass filter - use the single option anyway
                                const valueToSet = isMulti ? [singleOptionValue] : singleOptionValue;
                                selectElementOrAutocomplete.setValue(valueToSet, true);
                                this.setInputConfigValue(varLabel, valueToSet, possiblePlaceholders, configForWrite);
                                console.log(`GenieDashboard: Set single available value "${valueToSet}" for "${varName}" (currentValue "${currentValue}" not valid, but only one option exists)`);
                            } else {
                                // Current value doesn't exist in query results - don't set it
                                console.log(`GenieDashboard: Current value "${currentValue}" for "${varName}" not found in query results, not setting default value`);
                            }
                        }
                    } else if (!isMulti && finalOptions.length === 1 && !includeAll) {
                        // Auto-select if only one option - extract value from option object
                        const optionValue = finalOptions[0].value || finalOptions[0].text || finalOptions[0];
                        selectElementOrAutocomplete.setValue(optionValue, true); // Skip notify - will batch trigger dependents later
                        this.setInputConfigValue(varLabel, optionValue, possiblePlaceholders, configForWrite);
                    }

                    const selectedValue = selectElementOrAutocomplete.getValue();
                    // Ensure selectedValue is a string, not an object
                    const selectedValueStr = (typeof selectedValue === 'object' && selectedValue !== null)
                        ? (selectedValue.value || selectedValue.text || String(selectedValue))
                        : String(selectedValue || '');
                    console.log(`GenieDashboard: Executed templating query for "${varName}", got ${options.length} options, selected value: ${selectedValueStr || 'none'}`);
                } else if (isSelect) {
                    // Clear loading option and populate dropdown
                    selectElementOrAutocomplete.innerHTML = '';

                    // Add "All" option if includeAll is true
                    if (includeAll) {
                        const allOption = document.createElement('option');
                        allOption.value = allValue;
                        allOption.textContent = 'All';
                        const currentValues = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
                        if (currentValues.includes(allValue) || currentValues.includes('$__all') || currentValues.includes('All')) {
                            allOption.selected = true;
                        }
                        selectElementOrAutocomplete.appendChild(allOption);
                    }

                    // Add empty option if not multi and not includeAll
                    if (!isMulti && !includeAll) {
                        const emptyOption = document.createElement('option');
                        emptyOption.value = '';
                        emptyOption.textContent = '-- Select --';
                        selectElementOrAutocomplete.appendChild(emptyOption);
                    }

                    // Add options
                    options.forEach(opt => {
                        const optionEl = document.createElement('option');
                        const optValue = typeof opt === 'string' ? opt : (opt.value || opt.text || String(opt));
                        const optText = typeof opt === 'string' ? opt : (opt.text || opt.value || String(opt));
                        optionEl.value = optValue;
                        optionEl.textContent = optText;

                        // Handle multi-select current values
                        if (isMulti) {
                            const currentValues = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
                            if (currentValues.includes(optValue) || currentValues.includes(optText)) {
                                optionEl.selected = true;
                            }
                        } else {
                            if (optValue === currentValue || optText === currentValue) {
                                optionEl.selected = true;
                            }
                        }

                        selectElementOrAutocomplete.appendChild(optionEl);
                    });

                    // Auto-select if only one option and not multi
                    if (!isMulti && options.length === 1 && !currentValue && !includeAll) {
                        selectElementOrAutocomplete.value = options[0];
                        this.setInputConfigValue(varLabel, options[0], possiblePlaceholders, configForWrite);
                    }

                    // Set current value if it exists and not already set
                    if (currentValue && !selectElementOrAutocomplete.value && !isMulti) {
                        // Check if currentValue matches any of the options
                        const matchesOption = options.some(opt => {
                            const optValue = typeof opt === 'string' ? opt : (opt.value || opt.text || String(opt));
                            const optText = typeof opt === 'string' ? opt : (opt.text || opt.value || String(opt));
                            return optValue === currentValue || optText === currentValue;
                        });

                        if (matchesOption) {
                            selectElementOrAutocomplete.value = currentValue;
                            this.setInputConfigValue(varLabel, currentValue, possiblePlaceholders, configForWrite);
                            console.log(`GenieDashboard: Pre-existing value "${currentValue}" matched and selected for "${varName}"`);
                        }
                    }

                    // If no value selected yet but we have options, try to set from config
                    if (!selectElementOrAutocomplete.value && options.length > 0 && !isMulti && !includeAll) {
                        const existingValue = this.getInputConfigValue(varLabel, configToUse);
                        if (existingValue && selectElementOrAutocomplete.value !== existingValue) {
                            const matchingOption = Array.from(selectElementOrAutocomplete.options).find(opt => opt.value === existingValue);
                            if (matchingOption) {
                                selectElementOrAutocomplete.value = existingValue;
                            }
                        }
                    }

                    console.log(`GenieDashboard: Executed templating query for "${varName}", got ${options.length} options, selected value: ${selectElementOrAutocomplete?.value || 'none'}`);
                }
            } catch (error) {
                console.error(`GenieDashboard: Error executing templating query for "${varName}":`, error);
                if (isSelect) {
                    selectElementOrAutocomplete.innerHTML = '';
                    const errorOption = document.createElement('option');
                    errorOption.value = '';
                    errorOption.textContent = '-- Error --';
                    selectElementOrAutocomplete.appendChild(errorOption);
                } else if (isAutocomplete) {
                    // Show "Failed" message first, then set empty options
                    // This ensures the status message is set before any updates
                    if (typeof selectElementOrAutocomplete.showStatusMessage === 'function') {
                        selectElementOrAutocomplete.showStatusMessage('Failed', '#dc2626');
                    }
                    // Set empty options (this will call updateInputValue, but statusMessage check should preserve it)
                    selectElementOrAutocomplete.setOptions([]);
                    // Ensure status message persists after setOptions
                    if (typeof selectElementOrAutocomplete.showStatusMessage === 'function') {
                        selectElementOrAutocomplete.showStatusMessage('Failed', '#dc2626');
                    }
                }
                // Re-throw error so executeQueryForField can mark query as failed
                throw error;
            }
        }

        /**
         * Create an autocomplete dropdown with intellisense and multi-select support
         * Uses the AutocompleteDropdown class from autocomplete-dropdown.js
         * @param {string} containerId - ID for the container element
         * @param {Array} options - Array of option objects or strings
         * @param {boolean} isMulti - Whether to allow multiple selections
         * @param {*} currentValue - Current selected value(s)
         * @param {string} varName - Variable name
         * @param {string} varLabel - Variable label
         * @param {Array} possiblePlaceholders - Possible placeholders for this field
         * @param {string} expertName - Expert name if applicable
         * @param {Object} expertConfig - Expert config if applicable
         * @returns {HTMLElement} The autocomplete container element
         */
        createAutocompleteDropdown(containerId, options, isMulti, currentValue, varName, varLabel, possiblePlaceholders, expertName = null, expertConfig = null) {
            // Always use AutocompleteDropdown class - ensure it's loaded
            if (typeof AutocompleteDropdown === 'undefined') {
                console.error('GenieDashboard: AutocompleteDropdown class not found. Please ensure autocomplete-dropdown.js is loaded before genieDashboard.js');
                // Create a simple fallback select element
                const select = document.createElement('select');
                select.id = containerId;
                select.className = 'genie-toolbar-input';
                select.style.cssText = 'width: ' + (isMulti ? '160px' : '110px') + '; height: 24px; font-size: 11px; padding: 2px 4px; margin-right: 4px;';
                select.multiple = isMulti;
                if (Array.isArray(options)) {
                    options.forEach(opt => {
                        const optEl = document.createElement('option');
                        const value = typeof opt === 'string' ? opt : (opt.value || opt.text || '');
                        const text = typeof opt === 'string' ? opt : (opt.text || opt.value || '');
                        optEl.value = value;
                        optEl.textContent = text;
                        select.appendChild(optEl);
                    });
                }
                return select;
            }

            // Capture 'this' reference for use in callback
            const self = this;
            const autocomplete = new AutocompleteDropdown(containerId, options, {
                isMulti: isMulti,
                placeholder: isMulti ? 'Type to search...' : 'search or select',
                width: isMulti ? '160px' : '110px',
                currentValue: currentValue,
                allowSelectAll: isMulti,
                onChange: (value, selectedValues) => {
                    // Update inputConfig when value changes
                    if (expertName) {
                        if (!self.expertInputConfigs[expertName]) {
                            self.expertInputConfigs[expertName] = {};
                        }
                        self.setInputConfigValue(varLabel, value, possiblePlaceholders, self.expertInputConfigs[expertName]);
                    } else {
                        self.setInputConfigValue(varLabel, value, possiblePlaceholders);
                    }

                    // Trigger dependent queries when value changes
                    self.triggerDependentQueries(varName, expertName, expertConfig);
                }
            });
            const container = autocomplete.render();

            // Store instance reference on the container for easy lookup
            if (container) {
                container._autocompleteInstance = autocomplete;
                const hiddenSelect = autocomplete.getHiddenSelect();
                if (hiddenSelect) {
                    hiddenSelect._autocompleteInstance = autocomplete;
                }
            }

            return container;
        }

        /**
         * Legacy autocomplete dropdown implementation (fallback)
         * @private
         */
        createAutocompleteDropdownLegacy(containerId, options, isMulti, currentValue, varName, varLabel, possiblePlaceholders, expertName = null) {
            // Normalize options to array of {value, text} objects
            const normalizedOptions = options.map(opt => {
                if (typeof opt === 'string') {
                    return {value: opt, text: opt};
                }
                return {
                    value: opt.value || opt.text || '',
                    text: opt.text || opt.value || ''
                };
            });

            // Normalize currentValue for multi-select
            let selectedValues = [];
            if (isMulti) {
                selectedValues = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
            } else {
                selectedValues = currentValue ? [currentValue] : [];
            }

            // Create container (use wrapper ID to maintain compatibility)
            const container = document.createElement('div');
            container.id = containerId + '-wrapper';
            container.className = 'genie-autocomplete-container';
            container.style.cssText = 'position: relative; display: inline-block; width: ' + (isMulti ? '160px' : '110px') + '; margin-right: 4px;';

            // Create input wrapper (for multi-select, shows selected chips)
            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'genie-autocomplete-input-wrapper';
            // Make wrapper look like an input field with visible border
            inputWrapper.style.cssText = 'display: flex; flex-wrap: wrap; align-items: center; min-height: 24px; padding: 2px 4px; border: 1px solid #d1d5db; border-radius: 3px; background: white; font-size: 11px; cursor: text; position: relative; width: 100%; box-sizing: border-box;';

            // Create hidden select element with original ID for backward compatibility
            const hiddenSelect = document.createElement('select');
            hiddenSelect.id = containerId;
            hiddenSelect.className = 'genie-toolbar-input';
            hiddenSelect.style.display = 'none';
            hiddenSelect.multiple = isMulti;

            // Selected chips container (for multi-select)
            const chipsContainer = document.createElement('div');
            chipsContainer.className = 'genie-autocomplete-chips';
            if (isMulti) {
                chipsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 2px; flex-shrink: 0;';
            } else {
                chipsContainer.style.cssText = 'display: none;'; // Hide chips container for single select
            }

            // Create input field - must be visible and clickable
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'genie-autocomplete-input';
            input.placeholder = isMulti ? 'Type to search...' : 'search or select';
            // Ensure input is always visible, clickable, and has proper dimensions
            // Use a visible background and explicit sizing to make it clear it's an input field
            input.style.cssText = 'border: none; outline: none; flex: 1 1 auto; min-width: 100px; width: 100%; font-size: 11px; padding: 2px 6px; background: white; display: block; visibility: visible; opacity: 1; position: relative; z-index: 10; cursor: text; box-sizing: border-box; height: 20px; line-height: 20px;';
            input.autocomplete = 'off';
            input.tabIndex = 0;
            input.setAttribute('role', 'combobox');
            input.setAttribute('aria-expanded', 'false');

            // Add a subtle border on focus to make it more visible
            const handleInputFocus = () => {
                input.style.outline = '1px solid #3b82f6';
                input.style.outlineOffset = '-1px';
            };
            const handleInputBlur = () => {
                input.style.outline = 'none';
            };

            // Make input wrapper clickable to focus input (but don't interfere with chip clicks)
            inputWrapper.onclick = (e) => {
                // Only focus input if clicking on the wrapper itself or input, not on chips
                if (e.target === inputWrapper || e.target === input) {
                    input.focus();
                } else if (!chipsContainer.contains(e.target)) {
                    input.focus();
                }
            };

            // Create dropdown list
            const dropdown = document.createElement('div');
            dropdown.className = 'genie-autocomplete-dropdown';
            dropdown.style.cssText = 'position: absolute; top: 100%; left: 0; right: 0; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 3px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1000; display: none; margin-top: 2px;';

            // Function to render selected chips (for multi-select)
            const renderChips = () => {
                chipsContainer.innerHTML = '';
                selectedValues.forEach(value => {
                    const option = normalizedOptions.find(opt => opt.value === value);
                    if (option) {
                        const chip = document.createElement('span');
                        chip.className = 'genie-autocomplete-chip';
                        chip.style.cssText = 'display: inline-flex; align-items: center; padding: 2px 6px; background: #e5e7eb; border-radius: 3px; font-size: 10px; margin: 1px;';
                        chip.textContent = option.text;

                        const removeBtn = document.createElement('span');
                        removeBtn.textContent = '×';
                        removeBtn.style.cssText = 'margin-left: 4px; cursor: pointer; font-weight: bold; color: #6b7280;';
                        removeBtn.onclick = (e) => {
                            e.stopPropagation();
                            selectedValues = selectedValues.filter(v => v !== value);
                            updateHiddenSelect();
                            renderChips();
                            updateInputConfig();
                        };
                        chip.appendChild(removeBtn);
                        chipsContainer.appendChild(chip);
                    }
                });
            };

            // Function to filter and render dropdown options
            const renderDropdown = (filterText = '') => {
                dropdown.innerHTML = '';
                const filterLower = filterText.toLowerCase();
                const filtered = normalizedOptions.filter(opt =>
                    opt.text.toLowerCase().includes(filterLower) ||
                    opt.value.toLowerCase().includes(filterLower)
                );

                if (filtered.length === 0) {
                    const noResults = document.createElement('div');
                    noResults.style.cssText = 'padding: 8px; color: #6b7280; font-size: 11px;';
                    noResults.textContent = 'No options found';
                    dropdown.appendChild(noResults);
                } else {
                    filtered.forEach(option => {
                        const isSelected = selectedValues.includes(option.value);
                        const item = document.createElement('div');
                        item.className = 'genie-autocomplete-option';
                        item.style.cssText = 'padding: 6px 8px; cursor: pointer; font-size: 11px; ' +
                            (isSelected ? 'background: #e5e7eb; font-weight: 500;' : '') +
                            'display: flex; align-items: center;';

                        if (isMulti) {
                            const checkbox = document.createElement('span');
                            checkbox.textContent = isSelected ? '✓' : '☐';
                            checkbox.style.cssText = 'margin-right: 6px; width: 14px;';
                            item.appendChild(checkbox);
                        }

                        const text = document.createElement('span');
                        text.textContent = option.text;
                        item.appendChild(text);

                        item.onclick = () => {
                            if (isMulti) {
                                if (isSelected) {
                                    selectedValues = selectedValues.filter(v => v !== option.value);
                                } else {
                                    selectedValues.push(option.value);
                                }
                            } else {
                                selectedValues = [option.value];
                                input.value = option.text;
                                dropdown.style.display = 'none';
                            }
                            updateHiddenSelect();
                            renderChips();
                            updateInputConfig();
                            if (!isMulti) {
                                input.blur();
                            }
                        };

                        item.onmouseenter = () => {
                            item.style.background = isSelected ? '#d1d5db' : '#f3f4f6';
                        };
                        item.onmouseleave = () => {
                            item.style.background = isSelected ? '#e5e7eb' : 'white';
                        };

                        dropdown.appendChild(item);
                    });
                }
            };

            // Function to update hidden select element
            const updateHiddenSelect = () => {
                hiddenSelect.innerHTML = '';
                selectedValues.forEach(value => {
                    const option = normalizedOptions.find(opt => opt.value === value);
                    if (option) {
                        const optEl = document.createElement('option');
                        optEl.value = option.value;
                        optEl.textContent = option.text;
                        optEl.selected = true;
                        hiddenSelect.appendChild(optEl);
                    }
                });
            };

            // Function to update inputConfig
            const updateInputConfig = () => {
                const value = isMulti ? selectedValues : (selectedValues[0] || '');
                if (expertName) {
                    if (!this.expertInputConfigs[expertName]) {
                        this.expertInputConfigs[expertName] = {};
                    }
                    this.setInputConfigValue(varLabel, value, possiblePlaceholders, this.expertInputConfigs[expertName]);
                } else {
                    this.setInputConfigValue(varLabel, value, possiblePlaceholders);
                }
            };

            // Input event handlers
            input.onfocus = () => {
                handleInputFocus();
                renderDropdown(input.value);
                dropdown.style.display = 'block';
                input.setAttribute('aria-expanded', 'true');
            };

            input.oninput = (e) => {
                renderDropdown(e.target.value);
                dropdown.style.display = 'block';
                input.setAttribute('aria-expanded', 'true');
            };

            input.onblur = () => {
                handleInputBlur();
                // Delay hiding dropdown to allow clicks on options
                setTimeout(() => {
                    dropdown.style.display = 'none';
                    input.setAttribute('aria-expanded', 'false');
                }, 200);
            };

            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const firstOption = dropdown.querySelector('.genie-autocomplete-option');
                    if (firstOption) {
                        firstOption.click();
                    }
                } else if (e.key === 'Escape') {
                    dropdown.style.display = 'none';
                    input.blur();
                }
            };

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!container.contains(e.target)) {
                    dropdown.style.display = 'none';
                }
            });

            // Initialize
            if (isMulti) {
                renderChips();
            } else if (selectedValues.length > 0) {
                const selectedOption = normalizedOptions.find(opt => opt.value === selectedValues[0]);
                if (selectedOption) {
                    input.value = selectedOption.text;
                }
            }
            updateHiddenSelect();

            // Assemble container - input must always be visible and accessible
            inputWrapper.appendChild(chipsContainer);
            inputWrapper.appendChild(input);
            container.appendChild(inputWrapper);
            container.appendChild(dropdown);
            container.appendChild(hiddenSelect);

            // Ensure input is always visible and focusable
            input.style.display = 'block';
            input.style.visibility = 'visible';
            input.style.opacity = '1';
            input.tabIndex = 0;

            return container;
        }

        /**
         * Execute a single template variable query and create input field
         * @param {boolean} renderOnly - If true, only render the field, don't execute query
         * @param {Object} expertConfig - Expert configuration (optional, for expert views)
         */
        /**
         * Helper function to append element to targetRow, inserting before refresh button if it exists
         * This ensures expert fields appear before the refresh button
         * @param {HTMLElement} targetRow - The row to append to
         * @param {HTMLElement} element - The element to append
         * @param {string|null} expertName - Expert name if this is an expert field, null otherwise
         */
        appendFieldBeforeRefresh(targetRow, element, expertName = null) {
            if (!targetRow || !element) return;

            // If this is an expert field, try to insert before refresh button
            if (expertName && targetRow) {
                const refreshButton = document.getElementById(this.getInstanceId('controls-refresh-button'));
                if (refreshButton && refreshButton.parentNode === targetRow) {
                    // Refresh button exists in targetRow, insert before it
                    targetRow.insertBefore(element, refreshButton);
                    return;
                }
            }
            // Otherwise, just append normally
            targetRow.appendChild(element);
        }

        async executeTemplateVariableQuery(templateVar, controlsRow, expertName = null, renderOnly = false, expertConfig = null) {
            const varName = templateVar.name;
            const varLabel = templateVar.label || varName;
            const varType = templateVar.type || 'query';
            const hide = templateVar.hide || 0;
            const isHidden = hide === 2;
            const setConfigValue = (fieldLabel, value, placeholders) => {
                if (expertName) {
                    if (!this.expertInputConfigs[expertName]) {
                        this.expertInputConfigs[expertName] = {};
                    }
                    this.setInputConfigValue(fieldLabel, value, placeholders, this.expertInputConfigs[expertName]);
                    return;
                }
                this.setInputConfigValue(fieldLabel, value, placeholders);
            };

            // Categorize field (common vs expert-specific)
            const category = this.categorizeField(templateVar);

            // Determine which row to use: common fields go to common row, expert-specific to expert row
            let targetRow = controlsRow;
            if (category.isCommon) {
                // Common field - use common row (or create if doesn't exist)
                if (!this.commonInputRow) {
                    this.commonInputRow = controlsRow; // Use provided row as common row
                }
                targetRow = this.commonInputRow;
            } else if (expertName) {
                // Expert field - use common input row (all fields go to common container)
                if (!this.commonInputRow) {
                    this.commonInputRow = controlsRow; // Use provided row as common row
                }
                targetRow = this.commonInputRow;
            }

            // ========== DEBUG: Log targetRow determination ==========
            const targetRowId = targetRow ? (targetRow.id || 'no-id') : 'null';
            const targetRowIsCommon = targetRow === this.commonInputRow;
            const targetRowIsControlsRow = targetRow === controlsRow;
            console.log(`🔍 [DEBUG] executeTemplateVariableQuery: targetRow for "${varName}": id="${targetRowId}", isCommonInputRow=${targetRowIsCommon}, isControlsRow=${targetRowIsControlsRow}, category.isCommon=${category.isCommon}, expertName=${expertName || 'null'}`);
            // ========== END DEBUG ==========

            // Get existing placeholder mappings
            const config = expertName ? (this.expertInputConfigs[expertName] || {}) : (this.inputConfig || {});
            const existingMappings = this.getPlaceholderMappings(config);
            const existingPlaceholders = new Set();
            existingMappings.forEach((value, key) => {
                existingPlaceholders.add(key.toLowerCase());
            });

            // Generate possible placeholder names
            const possiblePlaceholders = [
                `$${varName}`,
                `$${varName.toLowerCase()}`,
                `$${varName.toUpperCase()}`
            ];

            // Get placeholder name mappings
            const placeholderNameMappings = this.getPlaceholderNameMappings();
            const coveredPlaceholders = new Set();
            Object.values(placeholderNameMappings).forEach(placeholders => {
                if (Array.isArray(placeholders)) {
                    placeholders.forEach(p => coveredPlaceholders.add(p.toLowerCase()));
                }
            });
            existingPlaceholders.forEach(p => coveredPlaceholders.add(p.toLowerCase()));

            // Check if any of the possible placeholders are already covered
            const isCovered = possiblePlaceholders.some(p => coveredPlaceholders.has(p.toLowerCase()));

            // Check if input field already exists
            const existingInputId = this.getInstanceId(`toolbar-${varName}`);
            const existingInputElement = document.getElementById(existingInputId);
            const inputFieldExists = !!existingInputElement;

            // ========== DEBUG: Log existing field check ==========
            let checkInCommonRow = null;
            if (this.commonInputRow) {
                checkInCommonRow = this.commonInputRow.querySelector(`#${existingInputId}`);
            }
            const checkInDocument = document.getElementById(existingInputId);
            console.log(`🔍 [DEBUG] executeTemplateVariableQuery: Checking existing field "${varName}": commonInputRow.querySelector=${!!checkInCommonRow}, document.getElementById=${!!checkInDocument}, final result=${inputFieldExists}`);
            // ========== END DEBUG ==========


            // For query-type variables, we need to ensure query functions are stored even if input field already exists
            // This is important for expert views - their query functions need to be re-executed on refresh/time range change
            const isQueryType = varType === 'query' && (templateVar.query || templateVar.definition);
            const shouldStoreQueryFunction = isQueryType && (templateVar.refresh === 1 || templateVar.refresh === true);

            // When renderOnly is true, we MUST ensure the field is created and in the DOM
            // This is critical - fields must be rendered before queries execute
            if (renderOnly) {
                // In render-only mode, always verify the element exists in the correct location
                const verifyElement = document.getElementById(existingInputId);
                if (verifyElement) {
                    // Check if element is in the correct targetRow
                    const isInTargetRow = targetRow && (targetRow.contains(verifyElement) || verifyElement.parentNode === targetRow);
                    if (isInTargetRow && !shouldStoreQueryFunction) {
                        // Element exists in correct location and we don't need to store query function
                        console.log(`GenieDashboard: [renderOnly] Input field "${varName}" already exists in correct location, skipping creation`);
                        return;
                    } else if (isInTargetRow && shouldStoreQueryFunction) {
                        // Element exists, but we need to store query function - will be handled below
                        console.log(`GenieDashboard: [renderOnly] Input field "${varName}" exists, will store query function`);
                    } else {
                        // Element exists but is in wrong location, remove it and recreate
                        console.warn(`GenieDashboard: [renderOnly] Input field "${varName}" exists but in wrong location, will recreate`);
                        verifyElement.remove();
                    }
                } else {
                    // Element doesn't exist, will be created below
                    console.log(`GenieDashboard: [renderOnly] Input field "${varName}" not found in DOM, will create it`);
                }
            } else {
                // Not render-only mode: skip if field exists and we don't need to store query function
                // ========== DEBUG: Skipping field creation ==========
                console.log(`🔍 [DEBUG] executeTemplateVariableQuery: SKIPPING field "${varName}" (${varLabel}) - already exists, isCovered: ${isCovered}, inputFieldExists: ${inputFieldExists}, shouldStoreQueryFunction: ${shouldStoreQueryFunction}`);
                // ========== END DEBUG ==========
                if (isCovered && inputFieldExists && !shouldStoreQueryFunction) {
                    // Field already exists and we don't need to store query function, skip
                    return;
                }
            }

            // ========== DEBUG: Creating input field ==========
            console.log(`🔍 [DEBUG] executeTemplateVariableQuery: CREATING field "${varName}" (${varLabel}) - expertName: ${expertName || 'null'}, renderOnly: ${renderOnly}`);
            // ========== END DEBUG ==========

            // Create input field for this templating variable
            // Handle current value - can be array or string, and may contain $__all which should be converted to allValue
            let currentValue = '';
            const includeAll = templateVar.includeAll === true;
            const allValue = templateVar.allValue || (includeAll ? '*' : '$__all'); // Use * if includeAll, otherwise $__all

            if (templateVar.current) {
                // Get value from current.value or current.text
                let rawValue = templateVar.current.value || templateVar.current.text || '';

                // Handle arrays (for multi-select)
                if (Array.isArray(rawValue)) {
                    // Convert $__all to allValue if includeAll is enabled
                    if (includeAll) {
                        currentValue = rawValue.map(v => {
                            if (v === '$__all' || v === '$__all__') {
                                return allValue;
                            }
                            return v;
                        });
                    } else {
                        currentValue = rawValue;
                    }
                    // For single-select, take first value; for multi-select, keep array
                    if (!templateVar.multi && currentValue.length > 0) {
                        currentValue = currentValue[0];
                    }
                } else if (rawValue) {
                    // Handle string value - convert $__all to allValue if includeAll is enabled
                    if (includeAll && (rawValue === '$__all' || rawValue === '$__all__')) {
                        currentValue = allValue;
                    } else {
                        currentValue = rawValue;
                    }
                }
            }

            // Determine field type and create appropriate input
            // Check if field has options - if so, use autocomplete component (for all types including interval)
            if (templateVar.options && Array.isArray(templateVar.options) && templateVar.options.length > 0) {
                // Create autocomplete dropdown for any field with options (supports typing and multi-select)
                const label = document.createElement('label');
                label.className = 'genie-toolbar-label';
                label.setAttribute('for', this.getInstanceId(`toolbar-${varName}`));
                label.textContent = `${varLabel}:`;
                label.style.cssText = 'font-size: 11px; color: #6b7280; height: 24px; display: flex; align-items: center; white-space: nowrap;';

                const isMulti = templateVar.multi === true;
                const containerId = this.getInstanceId(`toolbar-${varName}`);

                // Prepare options - add "All" option if includeAll is true
                let finalOptions = [...templateVar.options];
                if (includeAll) {
                    // Remove any existing "$__all" or "*" options first (they will be replaced with proper "All" option)
                    finalOptions = finalOptions.filter(opt => {
                        const optValue = typeof opt === 'string' ? opt : (opt.value || opt.text || '');
                        return optValue !== '$__all' && optValue !== '$__all__' && optValue !== '*';
                    });

                    // Check if "All" option already exists with the correct value
                    const hasAllOption = finalOptions.some(opt => {
                        const optValue = typeof opt === 'string' ? opt : (opt.value || opt.text || '');
                        return optValue === allValue;
                    });
                    if (!hasAllOption) {
                        // Get the text for "All" from current.text if available, otherwise use "All"
                        const allText = (templateVar.current && templateVar.current.text && Array.isArray(templateVar.current.text) && templateVar.current.text.length > 0)
                            ? templateVar.current.text[0]
                            : 'All';
                        // Add "All" option at the beginning with the correct value
                        finalOptions.unshift({value: allValue, text: allText});
                    }
                }

                // Create autocomplete container
                const autocompleteContainer = this.createAutocompleteDropdown(
                    containerId, finalOptions, isMulti, currentValue, varName, varLabel,
                    possiblePlaceholders, expertName, expertConfig
                );

                // Initialize value in inputConfig if currentValue exists
                if (currentValue) {
                    setConfigValue(varLabel, currentValue, possiblePlaceholders);
                }

                // Hide label and container if field is hidden
                if (isHidden) {
                    label.style.display = 'none';
                    autocompleteContainer.style.display = 'none';
                }

                this.appendFieldBeforeRefresh(targetRow, label, expertName);
                this.appendFieldBeforeRefresh(targetRow, autocompleteContainer, expertName);

                // Ensure the value is set after container is in DOM (for static options with current value)
                if (currentValue && autocompleteContainer._autocompleteInstance) {
                    // Set the value explicitly to ensure it displays correctly
                    autocompleteContainer._autocompleteInstance.setValue(currentValue, true);
                }

            } else if (varType === 'interval' && templateVar.query) {
                // Interval type with query string (e.g., "1m,2m,5m,10m") - convert to options and use autocomplete
                const queryOptions = templateVar.query.split(',').map(opt => opt.trim()).filter(opt => opt);
                if (queryOptions.length > 0) {
                    const label = document.createElement('label');
                    label.className = 'genie-toolbar-label';
                    label.setAttribute('for', this.getInstanceId(`toolbar-${varName}`));
                    label.textContent = `${varLabel}:`;
                    label.style.cssText = 'font-size: 11px; color: #6b7280; height: 24px; display: flex; align-items: center; white-space: nowrap;';

                    const isMulti = templateVar.multi === true;
                    const containerId = this.getInstanceId(`toolbar-${varName}`);

                    // Create autocomplete container with parsed options
                    const autocompleteContainer = this.createAutocompleteDropdown(
                        containerId, queryOptions, isMulti, currentValue, varName, varLabel,
                        possiblePlaceholders, expertName, expertConfig
                    );

                    // Initialize value in inputConfig if currentValue exists
                    if (currentValue) {
                        setConfigValue(varLabel, currentValue, possiblePlaceholders);
                    }

                    this.appendFieldBeforeRefresh(targetRow, label, expertName);
                    this.appendFieldBeforeRefresh(targetRow, autocompleteContainer, expertName);
                } else {
                    // Fallback to regular select if no options parsed
                    const label = document.createElement('label');
                    label.className = 'genie-toolbar-label';
                    label.setAttribute('for', this.getInstanceId(`toolbar-${varName}`));
                    label.textContent = `${varLabel}:`;
                    label.style.cssText = 'font-size: 11px; color: #6b7280; height: 24px; display: flex; align-items: center; white-space: nowrap;';

                    const select = document.createElement('select');
                    select.id = this.getInstanceId(`toolbar-${varName}`);
                    select.className = 'genie-toolbar-input';
                    select.style.cssText = 'width: 80px; height: 24px; font-size: 11px; padding: 2px 4px; margin-right: 4px;';

                    // Set current value
                    if (currentValue && !select.value) {
                        select.value = currentValue;
                    }

                    // Initialize value in inputConfig if currentValue exists
                    if (currentValue) {
                        setConfigValue(varLabel, currentValue, possiblePlaceholders);
                    }

                    // Store value in inputConfig when changed
                    select.addEventListener('change', () => {
                        const value = select.value;
                        setConfigValue(varLabel, value, possiblePlaceholders);
                        // Trigger dependent queries when value changes
                        this.triggerDependentQueries(varName, expertName, expertConfig);
                    });

                    this.appendFieldBeforeRefresh(targetRow, label, expertName);
                    this.appendFieldBeforeRefresh(targetRow, select, expertName);
                }
            } else if (templateVar.options && Array.isArray(templateVar.options) && templateVar.options.length > 0) {
                // Create autocomplete dropdown for any field with options (supports typing and multi-select)
                const label = document.createElement('label');
                label.className = 'genie-toolbar-label';
                label.setAttribute('for', this.getInstanceId(`toolbar-${varName}`));
                label.textContent = `${varLabel}:`;
                label.style.cssText = 'font-size: 11px; color: #6b7280; height: 24px; display: flex; align-items: center; white-space: nowrap;';

                const isMulti = templateVar.multi === true;
                const containerId = this.getInstanceId(`toolbar-${varName}`);

                // Prepare options - add "All" option if includeAll is true
                let finalOptions = [...templateVar.options];
                if (includeAll) {
                    // Remove any existing "$__all" or "*" options first (they will be replaced with proper "All" option)
                    finalOptions = finalOptions.filter(opt => {
                        const optValue = typeof opt === 'string' ? opt : (opt.value || opt.text || '');
                        return optValue !== '$__all' && optValue !== '$__all__' && optValue !== '*';
                    });

                    // Check if "All" option already exists with the correct value
                    const hasAllOption = finalOptions.some(opt => {
                        const optValue = typeof opt === 'string' ? opt : (opt.value || opt.text || '');
                        return optValue === allValue;
                    });
                    if (!hasAllOption) {
                        // Get the text for "All" from current.text if available, otherwise use "All"
                        const allText = (templateVar.current && templateVar.current.text && Array.isArray(templateVar.current.text) && templateVar.current.text.length > 0)
                            ? templateVar.current.text[0]
                            : 'All';
                        // Add "All" option at the beginning with the correct value
                        finalOptions.unshift({value: allValue, text: allText});
                    }
                }

                // Create autocomplete container
                const autocompleteContainer = this.createAutocompleteDropdown(
                    containerId, finalOptions, isMulti, currentValue, varName, varLabel,
                    possiblePlaceholders, expertName, expertConfig
                );

                // Initialize value in inputConfig if currentValue exists
                if (currentValue) {
                    setConfigValue(varLabel, currentValue, possiblePlaceholders);
                }

                this.appendFieldBeforeRefresh(targetRow, label, expertName);
                this.appendFieldBeforeRefresh(targetRow, autocompleteContainer, expertName);

            } else if (varType === 'query' && (templateVar.query || templateVar.definition)) {
                // Check if query-type field has static options - if so, use autocomplete
                if (templateVar.options && Array.isArray(templateVar.options) && templateVar.options.length > 0 && !templateVar.query && !templateVar.definition) {
                    // Query-type field with static options - use autocomplete
                    const label = document.createElement('label');
                    label.className = 'genie-toolbar-label';
                    label.setAttribute('for', this.getInstanceId(`toolbar-${varName}`));
                    label.textContent = `${varLabel}:`;
                    label.style.cssText = 'font-size: 11px; color: #6b7280; height: 24px; display: flex; align-items: center; white-space: nowrap;';

                    const isMulti = templateVar.multi === true;
                    const containerId = this.getInstanceId(`toolbar-${varName}`);

                    // Create autocomplete container
                    const autocompleteContainer = this.createAutocompleteDropdown(
                        containerId, templateVar.options, isMulti, currentValue, varName, varLabel,
                        possiblePlaceholders, expertName
                    );

                    // Initialize value in inputConfig if currentValue exists
                    if (currentValue) {
                        if (expertName) {
                            if (!this.expertInputConfigs[expertName]) {
                                this.expertInputConfigs[expertName] = {};
                            }
                            this.setInputConfigValue(varLabel, currentValue, possiblePlaceholders, this.expertInputConfigs[expertName]);
                        } else {
                            this.setInputConfigValue(varLabel, currentValue, possiblePlaceholders);
                        }
                    }

                    this.appendFieldBeforeRefresh(targetRow, label, expertName);
                    this.appendFieldBeforeRefresh(targetRow, autocompleteContainer, expertName);
                    return; // Exit early - autocomplete handles everything
                }

                // Create autocomplete dropdown for query type - execute query to get options (dynamic query execution)
                const label = document.createElement('label');
                label.className = 'genie-toolbar-label';
                label.setAttribute('for', this.getInstanceId(`toolbar-${varName}`));
                label.textContent = `${varLabel}:`;
                label.style.cssText = 'font-size: 11px; color: #6b7280; height: 24px; display: flex; align-items: center; white-space: nowrap;';

                const isMulti = templateVar.multi === true;
                const includeAll = templateVar.includeAll === true;
                const allValue = templateVar.allValue || (includeAll ? '*' : '$__all'); // Use * if includeAll, otherwise $__all

                // Normalize currentValue: if it contains "$__all", replace with allValue
                if (currentValue !== null && currentValue !== undefined) {
                    if (Array.isArray(currentValue)) {
                        currentValue = currentValue.map(v => (v === '$__all' || v === '$__all__' ? allValue : v));
                    } else if (currentValue === '$__all' || currentValue === '$__all__') {
                        currentValue = allValue;
                    }
                }

                const containerId = this.getInstanceId(`toolbar-${varName}`);

                // Prepare initial options - if includeAll is true, always add "All" option
                let initialOptions = [];
                if (includeAll) {
                    // Get the text for "All" from current.text if available, otherwise use "All"
                    const allText = (templateVar.current && templateVar.current.text && Array.isArray(templateVar.current.text) && templateVar.current.text.length > 0)
                        ? templateVar.current.text[0]
                        : 'All';
                    // Always add "All" option when includeAll is true
                    initialOptions.push({value: allValue, text: allText});
                }

                // Create autocomplete with initial options (will be populated after query)
                const autocompleteContainer = this.createAutocompleteDropdown(
                    containerId, initialOptions, isMulti, currentValue, varName, varLabel,
                    possiblePlaceholders, expertName, expertConfig
                );

                // Note: Status message will be set after appending to DOM

                // DO NOT set value in inputConfig here - wait until query completes and validates the value exists in results
                // This ensures we only use default values that actually exist in the query results

                // CRITICAL: Verify targetRow exists and is in DOM before appending
                if (!targetRow) {
                    console.error(`GenieDashboard: targetRow is null for "${varName}" - cannot append elements`);
                    return;
                }
                if (!targetRow.parentNode && !document.body.contains(targetRow)) {
                    console.warn(`GenieDashboard: targetRow for "${varName}" is not in DOM - appending anyway, but element may not be visible`);
                }

                // CRITICAL: Append elements to DOM FIRST
                // Hide label and container if field is hidden
                if (isHidden) {
                    label.style.display = 'none';
                    autocompleteContainer.style.display = 'none';
                }

                this.appendFieldBeforeRefresh(targetRow, label, expertName);
                this.appendFieldBeforeRefresh(targetRow, autocompleteContainer, expertName);

                // Verify element is actually in DOM after appending
                const verifyContainer = document.getElementById(containerId + '-wrapper');
                if (!verifyContainer) {
                    console.error(`GenieDashboard: Autocomplete container for "${varName}" not found in DOM after append! targetRow:`, targetRow, `containerId: ${containerId}`);
                } else {
                    console.log(`GenieDashboard: Autocomplete container for "${varName}" confirmed in DOM after append (ID: ${containerId})`);

                    // DO NOT set current value here - wait until query completes and validates the value exists in results
                    // This ensures we only use default values that actually exist in the query results
                    // The value will be set in executeTemplatingQueryHelper after query validation

                    // Show loading message initially for query-type fields (after appending to DOM)
                    if (verifyContainer._autocompleteInstance && typeof verifyContainer._autocompleteInstance.showStatusMessage === 'function') {
                        verifyContainer._autocompleteInstance.showStatusMessage('Loading...', '#6b7280');
                    }
                }

                // NOW find the autocomplete instance AFTER appending to DOM
                // Store autocomplete instance for later updates
                if (!this.autocompleteInstances) {
                    this.autocompleteInstances = {};
                }
                // Find the autocomplete instance by looking for the container (now in DOM)
                let autocompleteInstance = null;
                if (verifyContainer && verifyContainer._autocompleteInstance) {
                    autocompleteInstance = verifyContainer._autocompleteInstance;
                } else {
                    // Try to find it by searching for the hidden select
                    const hiddenSelect = document.getElementById(containerId);
                    if (hiddenSelect && hiddenSelect._autocompleteInstance) {
                        autocompleteInstance = hiddenSelect._autocompleteInstance;
                    }
                }

                // Store autocomplete instance and query config for later
                if (autocompleteInstance) {
                    this.autocompleteInstances[varName] = {
                        instance: autocompleteInstance,
                        templateVar: templateVar,
                        expertName: expertName,
                        expertConfig: expertConfig,
                        varLabel: varLabel,
                        isMulti: isMulti,
                        includeAll: includeAll,
                        allValue: allValue,
                        possiblePlaceholders: possiblePlaceholders
                    };
                } else {
                    console.warn(`GenieDashboard: Could not find autocomplete instance for "${varName}" after appending to DOM`);
                }

                // Function to execute query and populate autocomplete
                const executeTemplatingQuery = async () => {
                    await this.executeTemplatingQueryHelper(
                        templateVar, autocompleteInstance, expertName, expertConfig, varName, varLabel,
                        currentValue, isMulti, includeAll, allValue, possiblePlaceholders
                    );
                };

                // CRITICAL: Store query function IMMEDIATELY after appending to DOM
                // This ensures the element exists when we try to find it later
                // Always store for query-type fields (needed for executeQueryForField to work)
                const shouldRefresh = templateVar.refresh === 1 || templateVar.refresh === true;
                if (!this.templatingQueryFunctions) {
                    this.templatingQueryFunctions = {};
                }
                // Create a new function that looks up the autocomplete instance
                const storedQueryFunction = async () => {
                    // Try to get from stored instances first
                    let autocompleteInstance = null;
                    let templateVarToUse = templateVar; // Default to closure templateVar
                    const autocompleteData = this.autocompleteInstances?.[varName];
                    if (autocompleteData && autocompleteData.instance) {
                        autocompleteInstance = autocompleteData.instance;
                        // Use templateVar from autocompleteData if available (ensures we have latest with regex)
                        if (autocompleteData.templateVar) {
                            templateVarToUse = autocompleteData.templateVar;
                        }
                    } else {
                        // Fallback: try to find it from DOM
                        const containerWrapper = document.getElementById(containerId + '-wrapper');
                        if (containerWrapper && containerWrapper._autocompleteInstance) {
                            autocompleteInstance = containerWrapper._autocompleteInstance;
                        } else {
                            const hiddenSelect = document.getElementById(containerId);
                            if (hiddenSelect && hiddenSelect._autocompleteInstance) {
                                autocompleteInstance = hiddenSelect._autocompleteInstance;
                            }
                        }
                    }

                    // Fallback: Try to get templateVar from dependency graph node (ensures we have regex if it exists)
                    if (!templateVarToUse.regex && this.dependencyGraph && this.dependencyGraph.nodes) {
                        const graphNode = this.dependencyGraph.nodes.get(varName);
                        if (graphNode && graphNode.var && graphNode.var.regex) {
                            console.log(`GenieDashboard: [storedQueryFunction] Using templateVar from dependency graph for "${varName}" to get regex`);
                            templateVarToUse = graphNode.var;
                        }
                    }

                    if (!autocompleteInstance) {
                        console.warn(`GenieDashboard: Autocomplete instance not found for "${varName}" in stored query function`);
                        return;
                    }

                    // Get current value from autocomplete
                    const currentAutocompleteValue = autocompleteInstance.getValue();
                    await this.executeTemplatingQueryHelper(
                        templateVarToUse, autocompleteInstance, expertName, expertConfig, varName, varLabel,
                        currentAutocompleteValue, isMulti, includeAll, allValue, possiblePlaceholders
                    );
                };
                this.templatingQueryFunctions[varName] = storedQueryFunction;
                console.log(`GenieDashboard: Stored query function for "${varName}" immediately after DOM append (renderOnly: ${renderOnly}, shouldRefresh: ${shouldRefresh})`);

                // Execute query only if not renderOnly
                if (!renderOnly) {
                    executeTemplatingQuery().catch(error => {
                        console.error(`GenieDashboard: Error in background query for "${varName}":`, error);
                    });
                }

            } else if (varType === 'interval') {
                // Create dropdown for interval
                const label = document.createElement('label');
                label.className = 'genie-toolbar-label';
                label.setAttribute('for', this.getInstanceId(`toolbar-${varName}`));
                label.textContent = `${varLabel}:`;
                label.style.cssText = 'font-size: 11px; color: #6b7280; height: 24px; display: flex; align-items: center; white-space: nowrap;';

                const select = document.createElement('select');
                select.id = this.getInstanceId(`toolbar-${varName}`);
                select.className = 'genie-toolbar-input';
                select.style.cssText = 'width: 100px; height: 24px; font-size: 11px; padding: 2px 4px; margin-right: 4px;';

                // Parse interval options from query/definition
                const intervalQuery = templateVar.query || templateVar.definition || '';
                const intervals = intervalQuery.split(',').map(i => i.trim()).filter(i => i);

                // Add empty option
                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.textContent = '-- Select --';
                select.appendChild(emptyOption);

                // Add interval options
                intervals.forEach(interval => {
                    const optionEl = document.createElement('option');
                    optionEl.value = interval;
                    optionEl.textContent = interval;
                    if (interval === currentValue) {
                        optionEl.selected = true;
                    }
                    select.appendChild(optionEl);
                });

                // Initialize value in inputConfig if currentValue exists
                if (currentValue) {
                    if (expertName) {
                        if (!this.expertInputConfigs[expertName]) {
                            this.expertInputConfigs[expertName] = {};
                        }
                        this.setInputConfigValue(varLabel, currentValue, possiblePlaceholders, this.expertInputConfigs[expertName]);
                    } else {
                        this.setInputConfigValue(varLabel, currentValue, possiblePlaceholders);
                    }
                }

                // Store value in inputConfig when changed
                select.addEventListener('change', () => {
                    const value = select.value;
                    if (expertName) {
                        if (!this.expertInputConfigs[expertName]) {
                            this.expertInputConfigs[expertName] = {};
                        }
                        this.setInputConfigValue(varLabel, value, possiblePlaceholders, this.expertInputConfigs[expertName]);
                    } else {
                        this.setInputConfigValue(varLabel, value, possiblePlaceholders);
                    }
                    // Trigger dependent queries when value changes
                    this.triggerDependentQueries(varName, expertName, expertConfig);
                });

                this.appendFieldBeforeRefresh(targetRow, label, expertName);
                this.appendFieldBeforeRefresh(targetRow, select, expertName);

            } else if (varType === 'textbox') {
                // Create text input for textbox type
                const label = document.createElement('label');
                label.className = 'genie-toolbar-label';
                label.setAttribute('for', this.getInstanceId(`toolbar-${varName}`));
                label.textContent = `${varLabel}:`;
                label.style.cssText = 'font-size: 11px; color: #6b7280; height: 24px; display: flex; align-items: center; white-space: nowrap;';

                // Hide label if field is hidden
                if (isHidden) {
                    label.style.display = 'none';
                }

                const input = document.createElement('input');
                input.type = 'text';
                input.id = this.getInstanceId(`toolbar-${varName}`);
                input.className = 'genie-toolbar-input';
                input.value = currentValue;
                input.placeholder = templateVar.query || `e.g., ${varName} value`;
                input.style.cssText = 'width: 200px; height: 24px; font-size: 11px; padding: 2px 4px; margin-right: 4px;';

                // Hide input if field is hidden
                if (isHidden) {
                    input.style.display = 'none';
                }

                // Initialize value in inputConfig if currentValue exists
                if (currentValue) {
                    if (expertName) {
                        if (!this.expertInputConfigs[expertName]) {
                            this.expertInputConfigs[expertName] = {};
                        }
                        this.setInputConfigValue(varLabel, currentValue, possiblePlaceholders, this.expertInputConfigs[expertName]);
                    } else {
                        this.setInputConfigValue(varLabel, currentValue, possiblePlaceholders);
                    }
                }

                // Store value in inputConfig when changed
                input.addEventListener('blur', () => {
                    const value = input.value;
                    if (expertName) {
                        if (!this.expertInputConfigs[expertName]) {
                            this.expertInputConfigs[expertName] = {};
                        }
                        this.setInputConfigValue(varLabel, value, possiblePlaceholders, this.expertInputConfigs[expertName]);
                    } else {
                        this.setInputConfigValue(varLabel, value, possiblePlaceholders);
                    }
                    // Trigger dependent queries when value changes
                    this.triggerDependentQueries(varName, expertName, expertConfig);
                });

                this.appendFieldBeforeRefresh(targetRow, label, expertName);
                this.appendFieldBeforeRefresh(targetRow, input, expertName);
            }

            // Only log if we actually created and appended the field
            // (The field might have existed and we skipped creation)
            if (targetRow && (targetRow.querySelector(`#${this.getInstanceId(`toolbar-${varName}`)}`) || document.getElementById(this.getInstanceId(`toolbar-${varName}`)))) {
                console.log(`GenieDashboard: Input field for templating variable "${varName}" (${varLabel}) is ready in DOM with placeholders:`, possiblePlaceholders);
            } else {
                console.log(`GenieDashboard: Added input field for templating variable "${varName}" (${varLabel}) with placeholders:`, possiblePlaceholders);
            }

            // Handle case where field is covered but we need to store query function for refresh
            // Note: Query-type fields already stored their function immediately after appending (see line 4092-4116)
            if (isCovered && shouldStoreQueryFunction && varType !== 'query') {
                // Handle case where field is covered but we need to store query function for refresh
                // Input field already exists, but we still need to store the query function for refresh/time range change
                // This is important for expert views - their query functions need to be re-executed
                console.log(`GenieDashboard: Input field already exists for "${varName}", but storing query function for refresh`);

                // Verify the element actually exists before storing the query function
                const verifySelectId = this.getInstanceId(`toolbar-${varName}`);
                const verifySelectEl = document.getElementById(verifySelectId);
                if (!verifySelectEl || verifySelectEl.tagName !== 'SELECT') {
                    console.warn(`GenieDashboard: Select element not found for "${varName}" when storing query function - element may not have been created yet`);
                    // Don't store the query function if the element doesn't exist - it will be created below
                    // Continue to create the field normally
                } else {
                    // Element exists, create the query execution function using the shared helper
                    const executeTemplatingQuery = async () => {
                        const selectId = this.getInstanceId(`toolbar-${varName}`);
                        const selectEl = document.getElementById(selectId);
                        if (!selectEl || selectEl.tagName !== 'SELECT') {
                            console.warn(`GenieDashboard: Select element not found for "${varName}"`);
                            return;
                        }

                        // Get current value from select
                        const currentSelectValue = selectEl.value;
                        const isMulti = templateVar.multi === true;
                        const includeAll = templateVar.includeAll === true;
                        const allValue = templateVar.allValue || '$__all';

                        await this.executeTemplatingQueryHelper(
                            templateVar, selectEl, expertName, expertConfig, varName, varLabel,
                            currentSelectValue, isMulti, includeAll, allValue, possiblePlaceholders
                        );
                    };

                    // Store the query function
                    if (!this.templatingQueryFunctions) {
                        this.templatingQueryFunctions = {};
                    }
                    this.templatingQueryFunctions[varName] = executeTemplatingQuery;

                    // Execute query immediately to update the existing input field (only if not renderOnly)
                    if (!renderOnly) {
                        await executeTemplatingQuery();
                    }
                }
            }
        }

        /**
         * Render toolbar with time range selector and controls
         */
        renderToolbar(toolbarConfig) {
            const startCollapsed = toolbarConfig.collapse === true;

            // Create toolbar container
            const toolbar = document.createElement('div');
            toolbar.className = 'genie-dashboard-toolbar';
            toolbar.id = this.getInstanceId('toolbar');

            // If collapsed by default, hide toolbar initially
            if (startCollapsed) {
                toolbar.classList.add('genie-dashboard-collapsed');
            }

            const showTimeRange = toolbarConfig.showTimeRange !== false;
            const showInterval = toolbarConfig.showInterval !== false;
            const showAggregation = toolbarConfig.showAggregation !== false;
            const showRefresh = toolbarConfig.showRefresh !== false;
            const showEdit = toolbarConfig.edit === true;

            // Time range selector
            if (showTimeRange) {
                const timeRangeGroup = document.createElement('div');
                timeRangeGroup.className = 'genie-toolbar-group';
                timeRangeGroup.style.position = 'relative';

                const timeRangeButton = document.createElement('button');
                timeRangeButton.type = 'button'; // Prevent form submission
                timeRangeButton.className = 'genie-toolbar-icon-button';
                timeRangeButton.id = this.getInstanceId('toolbar-time-range');
                timeRangeButton.title = 'Select time range';
                timeRangeButton.innerHTML = '<span>🕐</span>';

                const timeRangeDisplay = document.createElement('span');
                timeRangeDisplay.className = 'genie-time-range-display';
                timeRangeDisplay.id = this.getInstanceId('time-range-display');
                timeRangeDisplay.textContent = 'Last 1h';

                // Time range popup
                const timeRangePopup = document.createElement('div');
                timeRangePopup.className = 'genie-time-range-popup';
                timeRangePopup.id = this.getInstanceId('time-range-popup');

                const quickIntervals = document.createElement('div');
                quickIntervals.className = 'genie-time-range-quick-intervals';
                const intervals = [
                    {minutes: 15, label: 'Last 15m'},
                    {minutes: 30, label: 'Last 30m'},
                    {minutes: 60, label: 'Last 1h', active: true},
                    {minutes: 120, label: 'Last 2h'},
                    {minutes: 360, label: 'Last 6h'},
                    {minutes: 720, label: 'Last 12h'},
                    {minutes: 1440, label: 'Last 1d'},
                    {minutes: 2880, label: 'Last 2d'},
                    {minutes: 10080, label: 'Last 7d'},
                    {minutes: 20160, label: 'Last 14d'},
                    {minutes: 43200, label: 'Last 30d'},
                    {mode: 'custom', label: 'Custom'}
                ];

                intervals.forEach(interval => {
                    const btn = document.createElement('button');
                    btn.type = 'button'; // Prevent form submission
                    btn.className = 'genie-quick-interval-btn';
                    if (interval.mode === 'custom') {
                        btn.setAttribute('data-mode', 'custom');
                        btn.textContent = interval.label;
                    } else {
                        btn.setAttribute('data-minutes', interval.minutes);
                        btn.textContent = interval.label;
                        if (interval.active) {
                            btn.setAttribute('data-active', 'true');
                            btn.classList.add('genie-dashboard-active');
                        }
                    }
                    quickIntervals.appendChild(btn);
                });

                const customRange = document.createElement('div');
                customRange.className = 'genie-time-range-custom';
                customRange.id = this.getInstanceId('time-range-custom');
                customRange.innerHTML = `
                <h4>Custom Range</h4>
                <div class="genie-time-range-custom-group">
                    <label>Start:</label>
                    <input type="datetime-local" id="${this.instanceId}-toolbar-start" class="genie-toolbar-input" step="60" />
                </div>
                <div class="genie-time-range-custom-group" style="margin-top: 8px;">
                    <label>End:</label>
                    <input type="datetime-local" id="${this.instanceId}-toolbar-end" class="genie-toolbar-input" step="60" />
                </div>
            `;

                const popupActions = document.createElement('div');
                popupActions.className = 'genie-time-range-popup-actions';
                popupActions.innerHTML = `
                <button type="button" class="genie-time-range-popup-btn genie-dashboard-btn-cancel" id="${this.instanceId}-time-range-cancel">Cancel</button>
                <button type="button" class="genie-time-range-popup-btn genie-dashboard-btn-apply" id="${this.instanceId}-time-range-apply">Apply</button>
            `;

                timeRangePopup.appendChild(quickIntervals);
                timeRangePopup.appendChild(customRange);
                timeRangePopup.appendChild(popupActions);

                timeRangeGroup.appendChild(timeRangeButton);
                timeRangeGroup.appendChild(timeRangeDisplay);
                timeRangeGroup.appendChild(timeRangePopup);
                toolbar.appendChild(timeRangeGroup);
            }

            // Note: Cell, Substrate, HF Instance, Domain, Span, and Aggregate controls
            // have been moved to the dashboard panel controls row (renderDashboardControlsRow)

            // Aggregation button with dropdown menu (standalone if interval is not shown)
            if (!showInterval && showAggregation) {
                // Create container for aggregation button and dropdown menu
                const aggContainer = document.createElement('div');
                aggContainer.style.cssText = 'position: relative; display: inline-block; margin-left: 2px;';

                // Aggregation button
                const aggButton = document.createElement('button');
                aggButton.type = 'button';
                aggButton.className = 'genie-dashboard-tab';
                aggButton.id = this.getInstanceId('toolbar-agg-button');
                aggButton.setAttribute('aria-label', 'Aggregation');
                aggButton.style.cssText = 'display: flex; align-items: center; padding: 4px 8px; font-size: 13px; color: #6b7280; background: transparent; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; font-weight: 500; min-width: 50px; height: 30px;';

                // Update button display based on selected aggregation
                const updateAggButtonDisplay = () => {
                    const currentAggValue = this.inputConfig['$agg'] || '';
                    const aggOptions = {
                        '': '-- Select --',
                        'sum': 'Sum',
                        'avg': 'Avg',
                        'max': 'Max',
                        'min': 'Min'
                    };
                    aggButton.textContent = aggOptions[currentAggValue] || '-- Select --';

                    // Keep button in default state (no highlighting after selection)
                    aggButton.style.background = 'transparent';
                    aggButton.style.color = '#6b7280';
                    aggButton.style.borderColor = '#d1d5db';
                };

                updateAggButtonDisplay();
                aggContainer.appendChild(aggButton);

                // Create dropdown menu with options
                const aggMenu = document.createElement('div');
                aggMenu.className = 'genie-dashboard-agg-menu';
                aggMenu.id = this.getInstanceId('agg-menu');
                aggMenu.style.cssText = 'display: none; position: fixed; background: white; border: 1px solid #d1d5db; border-radius: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); z-index: 10000; min-width: 140px; padding: 4px; max-height: 300px; overflow-y: auto;';
                document.body.appendChild(aggMenu);

                // Function to populate aggregation menu
                const populateAggMenu = () => {
                    aggMenu.innerHTML = '';
                    const aggOptions = [
                        {value: '', label: '-- Select --'},
                        {value: 'sum', label: 'Sum'},
                        {value: 'avg', label: 'Avg'},
                        {value: 'max', label: 'Max'},
                        {value: 'min', label: 'Min'}
                    ];

                    const currentAggValue = this.inputConfig['$agg'] || '';

                    aggOptions.forEach(option => {
                        const menuItem = document.createElement('div');
                        menuItem.className = 'genie-dashboard-agg-menu-item';
                        menuItem.style.cssText = `padding: 2px 8px; cursor: pointer; display: flex; align-items: center; font-size: 13px; color: ${option.value === currentAggValue ? '#3b82f6' : '#1f2937'}; margin: 0; font-weight: ${option.value === currentAggValue ? '500' : '400'};`;
                        menuItem.textContent = option.label;

                        // Highlight selected item
                        if (option.value === currentAggValue) {
                            menuItem.style.background = 'rgba(59, 130, 246, 0.1)';
                        }

                        // Hover effect
                        menuItem.addEventListener('mouseenter', () => {
                            menuItem.style.background = '#f3f4f6';
                        });
                        menuItem.addEventListener('mouseleave', () => {
                            menuItem.style.background = option.value === currentAggValue ? 'rgba(59, 130, 246, 0.1)' : 'transparent';
                        });

                        // Click handler
                        menuItem.addEventListener('click', (e) => {
                            e.stopPropagation();
                            // Update inputConfig
                            if (this.inputConfig) {
                                this.inputConfig['$agg'] = option.value || '';
                            }
                            // Update button display
                            updateAggButtonDisplay();
                            // Close menu
                            aggMenu.style.display = 'none';
                            // Trigger change event for any listeners
                            const changeEvent = new Event('change', {bubbles: true});
                            aggButton.dispatchEvent(changeEvent);
                        });

                        aggMenu.appendChild(menuItem);
                    });
                };

                // Initial population
                populateAggMenu();

                // Toggle menu on button click
                aggButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isVisible = aggMenu.style.display === 'block' || aggMenu.style.display === 'flex';
                    if (isVisible) {
                        aggMenu.style.display = 'none';
                    } else {
                        // Repopulate menu before showing
                        populateAggMenu();
                        // Calculate position relative to button using fixed positioning
                        const buttonRect = aggButton.getBoundingClientRect();
                        const menuTop = buttonRect.bottom + window.scrollY + 4; // 4px margin
                        const menuLeft = buttonRect.left + window.scrollX;

                        aggMenu.style.top = menuTop + 'px';
                        aggMenu.style.left = menuLeft + 'px';
                        aggMenu.style.display = 'block';
                    }
                });

                // Close menu when clicking outside
                const closeMenuHandler = (e) => {
                    if (!aggContainer.contains(e.target) && !aggMenu.contains(e.target)) {
                        aggMenu.style.display = 'none';
                    }
                };
                document.addEventListener('click', closeMenuHandler);

                // Store references for later use
                this.aggButton = aggButton;
                this.aggMenu = aggMenu;
                this.updateAggButtonDisplay = updateAggButtonDisplay;
                this.populateAggMenu = populateAggMenu;

                toolbar.appendChild(aggContainer);
            }

            // Experts button with dropdown menu (always shown if edit is enabled)
            if (showEdit) {
                // Create container for experts button and dropdown menu
                const expertsContainer = document.createElement('div');
                expertsContainer.style.cssText = 'position: relative; display: inline-block;';

                // Experts button
                const expertsButton = document.createElement('button');
                expertsButton.type = 'button';
                expertsButton.className = 'modern-button modern-button-blue';
                expertsButton.id = this.getInstanceId('experts-button');
                expertsButton.textContent = 'Load Expert';
                expertsButton.setAttribute('aria-label', 'Load Expert');

                // Update button display based on loaded experts
                const updateExpertsButtonDisplay = () => {
                    const loadedCount = this.loadedExpertViews ? this.loadedExpertViews.size : 0;
                    if (loadedCount > 0) {
                        expertsButton.textContent = `Load Expert (${loadedCount})`;
                    } else {
                        expertsButton.textContent = 'Load Expert';
                    }
                    // Modern button styling is handled by CSS classes, no need to change styles
                };

                updateExpertsButtonDisplay();
                expertsContainer.appendChild(expertsButton);

                // Create dropdown menu with checkboxes
                const expertsMenu = document.createElement('div');
                expertsMenu.className = 'genie-dashboard-experts-menu';
                expertsMenu.id = this.getInstanceId('experts-menu');
                expertsMenu.style.cssText = 'display: none; position: fixed; background: white; border: 1px solid #d1d5db; border-radius: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); z-index: 10000; min-width: 180px; padding: 4px; max-height: 300px; overflow-y: auto;';
                document.body.appendChild(expertsMenu);

                // Function to populate experts menu
                const populateExpertsMenu = () => {
                    expertsMenu.innerHTML = '';
                    const expertNames = Object.keys(this.expertViews).sort();

                    if (expertNames.length === 0) {
                        const emptyItem = document.createElement('div');
                        emptyItem.style.cssText = 'padding: 8px; font-size: 12px; color: #9ca3af; text-align: center;';
                        emptyItem.textContent = 'No experts available';
                        expertsMenu.appendChild(emptyItem);
                        return;
                    }

                    expertNames.forEach(expertName => {
                        const menuItem = document.createElement('label');
                        menuItem.className = 'genie-dashboard-experts-menu-item';
                        menuItem.style.cssText = 'padding: 2px 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #1f2937; margin: 0;';
                        const isChecked = this.loadedExpertViews && this.loadedExpertViews.has(expertName);
                        menuItem.innerHTML = `
                        <input type="checkbox" value="${expertName}" ${isChecked ? 'checked' : ''} style="margin-right: 4px; width: 14px; height: 14px; cursor: pointer;" class="expert-checkbox-${this.instanceId}">
                        <span style="font-size: 12px;">${expertName}</span>
                    `;

                        // Hover effect
                        menuItem.addEventListener('mouseenter', () => {
                            menuItem.style.background = '#f3f4f6';
                        });
                        menuItem.addEventListener('mouseleave', () => {
                            menuItem.style.background = 'transparent';
                        });

                        const checkbox = menuItem.querySelector('input[type="checkbox"]');
                        checkbox.addEventListener('change', async (e) => {
                            e.stopPropagation();
                            // Hide menu immediately after checkbox selection
                            expertsMenu.style.display = 'none';
                            // Trigger expert selection change handler
                            await this.handleExpertSelectionChange();
                            // Update button display
                            updateExpertsButtonDisplay();
                        });

                        expertsMenu.appendChild(menuItem);
                    });
                };

                // Initial population
                populateExpertsMenu();

                // Toggle menu on button click
                expertsButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isVisible = expertsMenu.style.display === 'block' || expertsMenu.style.display === 'flex';
                    if (isVisible) {
                        expertsMenu.style.display = 'none';
                    } else {
                        // Repopulate menu before showing
                        populateExpertsMenu();
                        // Calculate position relative to button using fixed positioning
                        const buttonRect = expertsButton.getBoundingClientRect();
                        const menuTop = buttonRect.bottom + window.scrollY + 4; // 4px margin
                        const menuLeft = buttonRect.left + window.scrollX;

                        expertsMenu.style.top = menuTop + 'px';
                        expertsMenu.style.left = menuLeft + 'px';
                        expertsMenu.style.display = 'block';
                    }
                });

                // Close menu when clicking outside
                const closeMenuHandler = (e) => {
                    if (!expertsContainer.contains(e.target) && !expertsMenu.contains(e.target)) {
                        expertsMenu.style.display = 'none';
                    }
                };
                document.addEventListener('click', closeMenuHandler);

                // Store references for later use
                this.expertsButton = expertsButton;
                this.expertsMenu = expertsMenu;
                this.updateExpertsButtonDisplay = updateExpertsButtonDisplay;
                this.populateExpertsMenu = populateExpertsMenu;

                toolbar.appendChild(expertsContainer);
            }

            // Add Expert button (always shown if edit is enabled)
            if (showEdit) {
                const uploadButton = document.createElement('button');
                uploadButton.type = 'button'; // Prevent form submission
                uploadButton.className = 'modern-button modern-button-blue';
                uploadButton.id = this.getInstanceId('toolbar-upload');
                uploadButton.title = 'Add Expert';
                uploadButton.textContent = 'Add Expert';
                toolbar.appendChild(uploadButton);
                this.uploadButton = uploadButton;
            }

            // Refresh button (moved to rightmost)
            if (showRefresh) {
                const refreshButton = document.createElement('button');
                refreshButton.type = 'button'; // Prevent form submission
                refreshButton.className = 'genie-toolbar-icon-button';
                refreshButton.id = this.getInstanceId('toolbar-refresh');
                refreshButton.title = 'Refresh dashboard';
                refreshButton.innerHTML = '<span>🔄</span>';
                toolbar.appendChild(refreshButton);
            }

            // Edit button (moved to rightmost)
            if (showEdit) {
                const editButton = document.createElement('button');
                editButton.type = 'button'; // Prevent form submission
                editButton.className = 'genie-toolbar-icon-button';
                editButton.id = this.getInstanceId('toolbar-edit');
                editButton.title = 'Edit dashboard JSON';
                editButton.innerHTML = '<span>✏️</span>';
                toolbar.appendChild(editButton);
            }

            // Genie threshold input and checkbox (at the right end)
            const genieCheckboxContainer = document.createElement('div');
            genieCheckboxContainer.className = 'genie-toolbar-genie-checkbox-container';
            genieCheckboxContainer.style.cssText = 'margin-left: auto; display: flex; align-items: center; gap: 8px;';

            // Threshold input
            const thresholdLabel = document.createElement('label');
            thresholdLabel.className = 'genie-toolbar-label';
            thresholdLabel.textContent = 'Threshold:';
            thresholdLabel.style.cssText = 'font-size: 12px; color: #6b7280; white-space: nowrap;';
            thresholdLabel.setAttribute('for', this.getInstanceId('toolbar-genie-threshold'));

            const thresholdInput = document.createElement('input');
            thresholdInput.type = 'number';
            thresholdInput.id = this.getInstanceId('toolbar-genie-threshold');
            thresholdInput.className = 'genie-toolbar-input';
            thresholdInput.placeholder = '1';

            // Initialize threshold value based on processing mode
            // If backend processing is enabled, use collapse threshold (for anomaly scores 0.0-1.0)
            // Otherwise, use default 1 (for percentage change)
            const useBackend = this.inputConfig?.isAnomalyProcessInUI === false;
            if (useBackend) {
                const collapseThreshold = this.inputConfig?.genieAnomalyCollapseThreshold ||
                    this.inputConfig?.genieAnomalyColorThreshold ||
                    0.3;
                thresholdInput.value = collapseThreshold.toString();
                thresholdInput.title = 'Threshold for panel collapse/expand (anomaly score range: 0.0-1.0, panels with score >= threshold are expanded)';
            } else {
                thresholdInput.value = '1';
                thresholdInput.title = 'Threshold for panel collapse (panels with max |change| below this will be collapsed)';
            }

            thresholdInput.min = '0';
            thresholdInput.step = '0.1';
            thresholdInput.style.cssText = 'width: 60px; height: 30px; font-size: 12px; padding: 4px 8px;';

            const genieCheckbox = document.createElement('input');
            genieCheckbox.type = 'checkbox';
            genieCheckbox.id = this.getInstanceId('toolbar-genie-checkbox');
            genieCheckbox.className = 'genie-toolbar-genie-checkbox';
            genieCheckbox.title = 'Genie';

            genieCheckboxContainer.appendChild(thresholdLabel);
            genieCheckboxContainer.appendChild(thresholdInput);
            genieCheckboxContainer.appendChild(genieCheckbox);
            toolbar.appendChild(genieCheckboxContainer);

            // Insert toolbar at the beginning of container (after collapse bar)
            
            // Check initial genie checkbox state and disable/enable buttons if already checked
            if (genieCheckbox.checked) {
                if (this.expertsButton) {
                    this.expertsButton.disabled = true;
                    this.expertsButton.style.opacity = '0.5';
                    this.expertsButton.style.cursor = 'not-allowed';
                }
                if (this.uploadButton) {
                    this.uploadButton.disabled = true;
                    this.uploadButton.style.opacity = '0.5';
                    this.uploadButton.style.cursor = 'not-allowed';
                }
            }
            this.container.appendChild(toolbar);

            // Setup event handlers after toolbar is added to DOM
            setTimeout(() => this.setupToolbarHandlers(), 0);

            // Setup edit modal if edit is enabled
            if (showEdit) {
                this.setupEditModal();
                this.setupUploadModal();
            }
        }

        /**
         * Setup dashboard collapse/expand functionality
         */
        setupDashboardCollapse() {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.setupDashboardCollapse) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            return PanelUtils.setupDashboardCollapse({
                getInstanceId: (id) => this.getInstanceId(id),
                dashboardGrid: this.dashboardGrid,
                dashboardConfig: this.dashboardConfig,
                container: this.container,
                panelOrder: this.panelOrder,
                panels: this.panels,
                renderRowPanel: (panel, panelId, grid) => this.renderRowPanel(panel, panelId, grid),
                renderPanel: (panel, panelId, grid) => this.renderPanel(panel, panelId, grid),
                recalculateAllYPositions: () => this.recalculateAllYPositions(),
                _panelsRendered: this._panelsRendered,
                charts: this.charts,
                getPanelById: (id) => this.getPanelById(id),
                processQuery: (query, previousOffset = 0, expertName = null) => this.processQuery(query, previousOffset, expertName),
                renderStatsTable: (panel, dataArray, container, statsToShow, previousDataArray, isTransposed, previousDuration) => this.renderStatsTable(panel, dataArray, container, statsToShow, previousDataArray, isTransposed, previousDuration)
            });
        }


        /**
         * Setup toolbar event handlers
         */
        setupToolbarHandlers() {
            // Helper functions for toolbar
            const formatDateForInput = (date) => {
                // Format date in UTC for display
                const d = new Date(date);
                const year = d.getUTCFullYear();
                const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                const day = String(d.getUTCDate()).padStart(2, '0');
                const hours = String(d.getUTCHours()).padStart(2, '0');
                const minutes = String(d.getUTCMinutes()).padStart(2, '0');
                return `${year}-${month}-${day}T${hours}:${minutes}`;
            };

            const parseInputDate = (dateString) => {
                if (!dateString) return null;
                // Parse the datetime-local value as UTC
                // datetime-local format: YYYY-MM-DDTHH:mm
                const parts = dateString.split('T');
                if (parts.length !== 2) return null;
                const datePart = parts[0].split('-');
                const timePart = parts[1].split(':');
                if (datePart.length !== 3 || timePart.length !== 2) return null;
                const year = parseInt(datePart[0], 10);
                const month = parseInt(datePart[1], 10) - 1; // Month is 0-indexed
                const day = parseInt(datePart[2], 10);
                const hours = parseInt(timePart[0], 10);
                const minutes = parseInt(timePart[1], 10);
                // Create UTC date
                return Date.UTC(year, month, day, hours, minutes);
            };

            const getTimeRangeFromMinutes = (minutes) => {
                const end = Date.now();
                const start = end - (minutes * 60 * 1000);
                return {start, end};
            };

            const formatTimeRangeDisplay = (start, end, isCustomRange = false) => {
                if (!start || !end) return 'Last 1h';
                const now = Date.now();
                const diff = end - start;
                const minutes = Math.floor(diff / (60 * 1000));
                // Helper to format date/time in UTC
                const formatUTC = (timestamp) => {
                    const date = new Date(timestamp);
                    const dateStr = date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC'
                    });
                    const timeStr = date.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'UTC',
                        hour12: false
                    });
                    const year = date.getUTCFullYear();
                    const month = date.getUTCMonth();
                    const day = date.getUTCDate();
                    return {dateStr, timeStr, year, month, day};
                };
                if (isCustomRange) {
                    const startUTC = formatUTC(start);
                    const endUTC = formatUTC(end);
                    // Compare if same UTC date
                    const sameDate = startUTC.year === endUTC.year &&
                        startUTC.month === endUTC.month &&
                        startUTC.day === endUTC.day;
                    if (sameDate) {
                        return `${startUTC.dateStr} ${startUTC.timeStr} - ${endUTC.timeStr} UTC`;
                    } else {
                        return `${startUTC.dateStr} ${startUTC.timeStr} - ${endUTC.dateStr} ${endUTC.timeStr} UTC`;
                    }
                }
                if (end === now || Math.abs(end - now) < 60000) {
                    if (minutes < 60) return `Last ${minutes}m`;
                    if (minutes < 1440) return `Last ${Math.floor(minutes / 60)}h`;
                    return `Last ${Math.floor(minutes / 1440)}d`;
                } else {
                    const startUTC = formatUTC(start);
                    const endUTC = formatUTC(end);
                    // Compare if same UTC date
                    const sameDate = startUTC.year === endUTC.year &&
                        startUTC.month === endUTC.month &&
                        startUTC.day === endUTC.day;
                    if (sameDate) {
                        return `${startUTC.dateStr} ${startUTC.timeStr} - ${endUTC.timeStr} UTC`;
                    } else {
                        return `${startUTC.dateStr} ${startUTC.timeStr} - ${endUTC.dateStr} ${endUTC.timeStr} UTC`;
                    }
                }
            };

            let isCustomRangeSelected = true;
            const applyTimeRange = async (start, end, isCustom = false) => {
                if (!this.inputConfig) return;

                // Log time range change with UTC times
                const startDate = new Date(start);
                const endDate = new Date(end);
                const startUTC = startDate.toISOString();
                const endUTC = endDate.toISOString();
                const startUTCDisplay = startDate.toLocaleString('en-US', {timeZone: 'UTC', hour12: false});
                const endUTCDisplay = endDate.toLocaleString('en-US', {timeZone: 'UTC', hour12: false});
                console.log('═══════════════════════════════════════════════════════════');
                console.log('🕐 TIME RANGE CHANGED');
                console.log('═══════════════════════════════════════════════════════════');
                console.log(`Current Period:`);
                console.log(`  Start: ${start} (${startUTC})`);
                console.log(`  End:   ${end} (${endUTC})`);
                console.log(`  Display: ${startUTCDisplay} - ${endUTCDisplay} UTC`);
                console.log(`  Duration: ${Math.floor((end - start) / (60 * 1000))} minutes`);
                console.log(`  Is Custom Range: ${isCustom}`);
                console.log('═══════════════════════════════════════════════════════════');

                // Clear all panels first to make view immediately consistent with new time range
                // This ensures the view is consistent right away, before input fields are updated
                try {
                    const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
                    if (grid) {
                        const allPanelDivs = Array.from(grid.querySelectorAll('.genie-dashboard-panel'))
                            .filter(div => !div.classList.contains('genie-dashboard-controls-row') && !div.hasAttribute('data-controls-row'));

                        // Show message to user that panels are being cleared
                        if (allPanelDivs.length > 0) {
                            this.showExpertProgressMessage(`Clearing ${allPanelDivs.length} panel${allPanelDivs.length > 1 ? 's' : ''} for time range update...`);
                        }


                        allPanelDivs.forEach(panelDiv => {
                            const content = panelDiv.querySelector('.genie-dashboard-panel-content');
                            if (content) {
                                // Clear panel content and show message
                                content.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; padding: 40px; color: #6b7280; font-size: 14px; text-align: center;">Time range changed. Click refresh button to update panels after selecting input</div>';

                                // Find panel index and ID for chart destruction
                                const panelIdMatch = panelDiv.id.match(new RegExp(`${this.instanceId.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}-panel-(\\d+)`));
                                const panelIndex = panelIdMatch ? parseInt(panelIdMatch[1]) : -1;

                                // Find panel object to get panel.id
                                const panel = panelDiv._panelObject || (panelIndex >= 0 && this.panelOrder.normal[panelIndex] ? this.panels[this.panelOrder.normal[panelIndex]] : null);

                                // Destroy all possible chart instances (matching pattern from refreshSinglePanel)
                                const possibleChartIds = [
                                    panelIndex >= 0 ? `${this.instanceId}-chart-${panelIndex}` : null,
                                    panelIndex >= 0 ? `chart-${panelIndex}` : null,
                                    panelIndex >= 0 ? `${panelIndex}-chart` : null,
                                    panel?.id ? `${this.instanceId}-chart-${panel.id}` : null,
                                    panel?.id ? `chart-${panel.id}` : null
                                ].filter(id => id !== null);

                                possibleChartIds.forEach(chartId => {
                                    if (this.charts && this.charts[chartId]) {
                                        try {
                                            const chartInstance = this.charts[chartId];
                                            if (chartInstance && typeof chartInstance.destroy === 'function') {
                                                chartInstance.destroy();
                                            }
                                            delete this.charts[chartId];
                                        } catch (e) {
                                            console.warn(`Error destroying chart ${chartId}:`, e);
                                        }
                                    }
                                });
                            }
                        });

                        console.log(`GenieDashboard: Cleared ${allPanelDivs.length} panel(s) at start of time range change`);
                    }
                } catch (error) {
                    console.error(`GenieDashboard: Error clearing panels at start of time range change:`, error);
                }

                this.setInputConfigValue('Start', start, ['$start']);
                this.setInputConfigValue('End', end, ['$end']);
                isCustomRangeSelected = isCustom;
                const timeRangeDisplay = document.getElementById(this.getInstanceId('time-range-display'));
                if (timeRangeDisplay) {
                    timeRangeDisplay.textContent = formatTimeRangeDisplay(start, end, isCustomRangeSelected);
                }
                const popup = document.getElementById(this.getInstanceId('time-range-popup'));
                if (popup) {
                    popup.classList.remove('genie-dashboard-show');
                }

                // Refresh all input fields with queries when time range changes
                // Use unified refreshInputFields function (same as first load, but with isTimeRangeChange=true)
                const controlsRow = this.container.querySelector(`.genie-dashboard-controls-row`) || document.getElementById(this.getInstanceId('controls-row'));

                if (controlsRow) {
                    console.log(`GenieDashboard: Time range changed - Refreshing input fields using unified function`);
                    try {
                        // Update message to show input fields are being refreshed
                        this.showExpertProgressMessage('Refreshing input fields for new time range...');

                        // Use unified refreshInputFields function with isTimeRangeChange=true
                        // This ensures consistent behavior with first-time load while skipping field creation
                        await window.refreshInputFields(this, controlsRow, this.dashboardConfig, this.inputConfig, this.instanceId, true);
                        console.log(`GenieDashboard: Successfully refreshed all templating queries after time range change`);

                        // Hide progress message after input fields are refreshed
                        this.hideExpertProgressMessage();
                    } catch (error) {
                        console.error(`GenieDashboard: Error refreshing templating queries after time range change:`, error);
                        this.hideExpertProgressMessage();
                    }
                }
                // Update templating fields (template-only approach)
                if (this.dashboardConfig && this.dashboardConfig.templating && this.dashboardConfig.templating.list) {
                    this.dashboardConfig.templating.list.forEach(templateVar => {
                        if (!templateVar || !templateVar.name) return;
                        const varName = templateVar.name;
                        const varLabel = templateVar.label || varName;

                        const inputId = this.getInstanceId(`toolbar-${varName}`);
                        const inputElement = document.getElementById(inputId);

                        if (inputElement) {
                            const value = inputElement.value || inputElement.textContent || '';
                            if (value) {
                                const possiblePlaceholders = [
                                    `$${varName}`,
                                    `$${varName.toLowerCase()}`,
                                    `$${varName.toUpperCase()}`
                                ];
                                this.setInputConfigValue(varLabel, value, possiblePlaceholders);
                            }
                        }
                    });
                }

                // Check if all input fields have values after updates
                const allFieldsHaveValues = this.checkAllInputFieldsHaveValues();

                // Check if panel refresh on time range change is enabled (default: true)
                const panelRefreshOnTimeRangeChange = this.inputConfig?.panelRefreshOnTimeRangeChange !== false;

                if (allFieldsHaveValues && panelRefreshOnTimeRangeChange) {
                    console.log(`GenieDashboard: All input fields have values after time range change, refreshing panels`);
                    try {
                        // Time range change should run queries to refresh input fields
                        await this.refreshPanelsDataOnly(true, true);
                        console.log(`GenieDashboard: Successfully refreshed panels after time range change`);
                    } catch (error) {
                        console.error(`GenieDashboard: Error refreshing panels after time range change:`, error);
                    }
                } else if (allFieldsHaveValues && !panelRefreshOnTimeRangeChange) {
                    console.log(`GenieDashboard: All input fields have values after time range change, but panelRefreshOnTimeRangeChange is false - skipping panel refresh`);
                } else {
                    console.log(`GenieDashboard: Some input fields are empty after time range change, panels not refreshed`);
                }
            };

            // Time range popup
            const timeRangeButton = document.getElementById(this.getInstanceId('toolbar-time-range'));
            const timeRangePopup = document.getElementById(this.getInstanceId('time-range-popup'));
            // Scope to time range popup or container to support multiple dashboard instances
            const quickIntervalBtns = timeRangePopup ? timeRangePopup.querySelectorAll('.genie-quick-interval-btn') : this.container.querySelectorAll('.genie-quick-interval-btn');
            const startInput = document.getElementById(`${this.instanceId}-toolbar-start`);
            const endInput = document.getElementById(`${this.instanceId}-toolbar-end`);
            const applyButton = document.getElementById(this.getInstanceId('time-range-apply'));
            const cancelButton = document.getElementById(this.getInstanceId('time-range-cancel'));
            const refreshButton = document.getElementById(this.getInstanceId('toolbar-refresh'));

            if (timeRangeButton && timeRangePopup) {
                timeRangeButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    timeRangePopup.classList.toggle('genie-dashboard-show');
                    const startValue = this.getInputConfigValue('Start', this.inputConfig) || this.getInputConfigValue('start', this.inputConfig) || this.inputConfig?.['$start'];
                    const endValue = this.getInputConfigValue('End', this.inputConfig) || this.getInputConfigValue('end', this.inputConfig) || this.inputConfig?.['$end'];
                    if (this.inputConfig && startValue && endValue) {
                        if (startInput) startInput.value = formatDateForInput(startValue);
                        if (endInput) endInput.value = formatDateForInput(endValue);
                    }
                });

                document.addEventListener('click', (e) => {
                    if (!timeRangePopup.contains(e.target) && e.target !== timeRangeButton) {
                        timeRangePopup.classList.remove('genie-dashboard-show');
                    }
                });
            }

            // Quick interval buttons
            quickIntervalBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    quickIntervalBtns.forEach(b => b.classList.remove('genie-dashboard-active'));
                    btn.classList.add('genie-dashboard-active');
                    const mode = btn.getAttribute('data-mode');
                    if (mode === 'custom') {
                        isCustomRangeSelected = true;
                    } else {
                        isCustomRangeSelected = false;
                        const minutes = parseInt(btn.getAttribute('data-minutes'));
                        if (minutes) {
                            const {start, end} = getTimeRangeFromMinutes(minutes);
                            applyTimeRange(start, end, false).catch(error => {
                                console.error('Error applying time range:', error);
                            });
                        }
                    }
                });
            });

            // Apply button for custom range
            if (applyButton && startInput && endInput) {
                applyButton.addEventListener('click', () => {
                    if (startInput.value && endInput.value) {
                        const start = parseInputDate(startInput.value);
                        const end = parseInputDate(endInput.value);
                        if (start && end && start < end) {
                            applyTimeRange(start, end, true).catch(error => {
                                console.error('Error applying time range:', error);
                            });
                        } else {
                            alert('Start time must be before end time');
                        }
                    }
                });
            }

            // Cancel button
            if (cancelButton && timeRangePopup) {
                cancelButton.addEventListener('click', () => {
                    timeRangePopup.classList.remove('show');
                });
            }

            // Aggregation button change handler - sync to panel settings if open
            const aggButton = this.aggButton || document.getElementById(this.getInstanceId('toolbar-agg-button'));
            if (aggButton) {
                aggButton.addEventListener('change', () => {
                    // inputConfig is already updated in the menu click handler
                    // Sync to any open panel settings
                    const currentAggValue = this.inputConfig ? (this.getInputConfigValue('agg', this.inputConfig) || '') : '';
                    // Scope to this instance container to support multiple dashboard instances
                    const openSettingsPanels = this.container.querySelectorAll(`[id^="${this.instanceId}-panel-settings-"]`);
                    openSettingsPanels.forEach(settingsPanel => {
                        const panelIdMatch = settingsPanel.id.match(new RegExp(`${this.instanceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-panel-settings-(\\d+)`));
                        if (panelIdMatch) {
                            const panelId = panelIdMatch[1];
                            const spanTypeSelect = document.getElementById(`${this.instanceId}-agg-span-type-${panelId}`);
                            if (spanTypeSelect) {
                                spanTypeSelect.value = currentAggValue;
                            }
                        }
                    });
                });
            }

            // Scope fetching removed - using template-only approach with dependency-based execution

            // Refresh button
            if (refreshButton) {
                refreshButton.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // STEP 0: Ensure all input fields have their values saved (trigger blur events)
                    // This ensures that if user changed a field value but didn't blur, the value is still saved
                    await this.ensureAllInputFieldsSaved();

                    // Time range - ensure current values are in inputConfig
                    const startValue = this.getInputConfigValue('Start', this.inputConfig) || this.getInputConfigValue('start', this.inputConfig) || this.inputConfig?.['$start'];
                    const endValue = this.getInputConfigValue('End', this.inputConfig) || this.getInputConfigValue('end', this.inputConfig) || this.inputConfig?.['$end'];
                    if (startValue && endValue) {
                        // Ensure time range is in inputConfig (applyTimeRange should have already done this, but double-check)
                        this.setInputConfigValue('Start', startValue, ['$start']);
                        this.setInputConfigValue('End', endValue, ['$end']);
                    }

                    // Aggregation is already in inputConfig from button click handler

                    // Update inputConfig from all templating input fields (dynamically added fields)
                    if (this.dashboardConfig && this.dashboardConfig.templating && this.dashboardConfig.templating.list) {
                        this.dashboardConfig.templating.list.forEach(templateVar => {
                            if (!templateVar || !templateVar.name) return;
                            const varName = templateVar.name;
                            const varLabel = templateVar.label || varName;

                            // Find the input field for this templating variable
                            const inputId = this.getInstanceId(`toolbar-${varName}`);
                            const inputElement = document.getElementById(inputId);

                            if (inputElement) {
                                const value = inputElement.value || inputElement.textContent || '';
                                if (value) {
                                    // Generate possible placeholder names for this variable
                                    const possiblePlaceholders = [
                                        `$${varName}`,
                                        `$${varName.toLowerCase()}`,
                                        `$${varName.toUpperCase()}`
                                    ];
                                    this.setInputConfigValue(varLabel, value, possiblePlaceholders);
                                }
                            }
                        });
                    }

                    // Dashboard refresh: Re-fetch all input field queries, then refresh panels if all values exist
                    refreshButton.disabled = true;
                    refreshButton.innerHTML = '<span>⏳</span>';
                    refreshButton.title = 'Refreshing...';

                    try {
                        // Step 1: Re-execute templating queries (for query-type templating variables)
                        // Use unified refreshInputFields function for dashboard refresh
                        // This ensures consistent behavior: dependency order, status updates, and query execution
                        const controlsRow = this.container.querySelector(`.genie-dashboard-controls-row`) || document.getElementById(this.getInstanceId('controls-row'));
                        if (controlsRow) {
                            await window.refreshInputFields(this, controlsRow, this.dashboardConfig, this.inputConfig, this.instanceId, false);
                        }

                        // Step 2: Update inputConfig from all input fields after queries complete
                        // (Values are already read above, just ensure they're in inputConfig)

                        // Step 3: If all field values exist, refresh panels
                        const allFieldsHaveValues = this.checkAllInputFieldsHaveValues();
                        if (allFieldsHaveValues) {
                            console.log(`GenieDashboard: All input fields have values, refreshing panels after dashboard refresh`);
                            // Dashboard toolbar refresh should run queries to refresh input fields
                            await this.refreshPanelsDataOnly(true, true);
                        } else {
                            console.log(`GenieDashboard: Some input fields are empty, panels not refreshed. Please fill all fields and use the input fields refresh button.`);
                        }
                    } finally {
                        refreshButton.disabled = false;
                        refreshButton.innerHTML = '<span>🔄</span>';
                        refreshButton.title = 'Refresh dashboard';
                    }
                });
            }

            // Edit button
            const editButton = document.getElementById(this.getInstanceId('toolbar-edit'));
            if (editButton) {
                editButton.addEventListener('click', () => {
                    this.showEditModal();
                });
            }

            // Upload button
            const uploadButton = document.getElementById(this.getInstanceId('toolbar-upload'));
            if (uploadButton) {
                uploadButton.addEventListener('click', () => {
                    this.showUploadModal();
                });
            }

            // Update time range display on init
            const startValue = this.getInputConfigValue('Start', this.inputConfig) || this.getInputConfigValue('start', this.inputConfig) || this.inputConfig?.['$start'];
            const endValue = this.getInputConfigValue('End', this.inputConfig) || this.getInputConfigValue('end', this.inputConfig) || this.inputConfig?.['$end'];
            if (this.inputConfig && startValue && endValue) {
                const timeRangeDisplay = document.getElementById(this.getInstanceId('time-range-display'));
                if (timeRangeDisplay) {
                    timeRangeDisplay.textContent = formatTimeRangeDisplay(startValue, endValue, isCustomRangeSelected);
                }
            }

            // Genie checkbox handler
            const genieCheckbox = document.getElementById(this.getInstanceId('toolbar-genie-checkbox'));
            const thresholdInput = document.getElementById(this.getInstanceId('toolbar-genie-threshold'));

            // Threshold input change handler - update collapsed states if genie is checked
            // Initialize pending operation tracking
            this._pendingThresholdUpdate = null;
            this._thresholdUpdateInProgress = false;

            if (thresholdInput) {
                // Apply threshold when user leaves the input field (on blur)
                const handleThresholdChange = () => {
                    if (genieCheckbox && genieCheckbox.checked) {
                        const threshold = parseFloat(thresholdInput.value) || 1;

                        // Cancel any pending threshold update
                        if (this._pendingThresholdUpdate) {
                            cancelAnimationFrame(this._pendingThresholdUpdate);
                            this._pendingThresholdUpdate = null;
                        }

                        // Cancel any pending batch recalculation from previous threshold changes
                        if (this._pendingBatchRecalculation) {
                            cancelAnimationFrame(this._pendingBatchRecalculation);
                            this._pendingBatchRecalculation = null;
                        }

                        // Apply threshold update immediately (no debounce needed since it's on blur)
                        if (this._thresholdUpdateInProgress) {
                            // If another update is in progress, queue this one
                            setTimeout(() => handleThresholdChange(), 50);
                            return;
                        }

                        this._thresholdUpdateInProgress = true;

                        try {
                            // Check if panels are already sorted (have _genieOriginalIndex set)
                            const isAlreadySorted = this.panelOrder.normal.some(panelId => {
                                const panel = this.panels[panelId];
                                return panel && panel._genieOriginalIndex !== undefined;
                            });

                            if (isAlreadySorted) {
                                // Panels are already sorted, just update collapsed states without re-sorting
                                this.updateCollapsedStatesByThreshold(threshold);
                            } else {
                                // Panels not sorted yet, do full sort and reorder
                                this.sortAndReorderPanelsByChange(threshold);
                            }
                        } finally {
                            // Reset flag after a brief delay to allow DOM updates to complete
                            setTimeout(() => {
                                this._thresholdUpdateInProgress = false;
                            }, 100);
                        }
                    }
                };

                // Apply threshold when user leaves the input field (blur event)
                thresholdInput.addEventListener('blur', handleThresholdChange);

                // Also apply on Enter key press for better UX
                thresholdInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === 'Return') {
                        e.preventDefault();
                        thresholdInput.blur(); // Trigger blur which will apply the threshold
                    }
                });
            }

            if (genieCheckbox) {
                genieCheckbox.addEventListener('change', async (e) => {
                    // Disable/enable Load Expert and Add Expert buttons based on genie checkbox state
                    if (this.expertsButton) {
                        this.expertsButton.disabled = e.target.checked;
                        if (e.target.checked) {
                            this.expertsButton.style.opacity = '0.5';
                            this.expertsButton.style.cursor = 'not-allowed';
                        } else {
                            this.expertsButton.style.opacity = '1';
                            this.expertsButton.style.cursor = 'pointer';
                        }
                    }
                    if (this.uploadButton) {
                        this.uploadButton.disabled = e.target.checked;
                        if (e.target.checked) {
                            this.uploadButton.style.opacity = '0.5';
                            this.uploadButton.style.cursor = 'not-allowed';
                        } else {
                            this.uploadButton.style.opacity = '1';
                            this.uploadButton.style.cursor = 'pointer';
                        }
                    }
                    
                    if (e.target.checked) {
                        // Checkbox checked → Call wrapper function that orchestrates all 4 steps
                        // Ensure mixin is applied before calling functions
                        if (typeof window._applyGenieCheckHandler === 'function' && typeof this.executeGenieCheckFlow !== 'function') {
                            window._applyGenieCheckHandler(GenieDashboard.prototype);
                        }
                        if (typeof this.executeGenieCheckFlow !== 'function') {
                            console.error('[Genie] executeGenieCheckFlow is not available. Mixin may not be loaded. Please ensure genieCheckHandler.js is loaded before genieDashboard.js.');
                            return;
                        }
                        // Get threshold value
                        const threshold = thresholdInput ? parseFloat(thresholdInput.value) || 1 : 1;
                        // Call wrapper function that does Step 1, Step 2, Step 3, and Step 4
                        await this.executeGenieCheckFlow(threshold);
                    } else {

                        // Clear ALL genie view state when unchecked
                        // This includes change data, processed series data, genie-specific properties, and genie view data structures

                        // Clear genie view data structures
                        this._genieSortOrderArray = [];
                        this._genieStateMap = {};

                        const clearGenieState = (panel) => {
                            // Clear change data
                            if (panel.change) {
                                panel.change = {};
                            }
                            // Clear processed series data
                            if (panel._currentSeriesData) {
                                panel._currentSeriesData = {};
                            }
                            if (panel._previousSeriesData) {
                                panel._previousSeriesData = {};
                            }
                            if (panel._previousSeriesDataByDuration) {
                                panel._previousSeriesDataByDuration = null;
                            }
                            if (panel._currentSeriesNames) {
                                panel._currentSeriesNames = [];
                            }
                            if (panel._previousSeriesNames) {
                                panel._previousSeriesNames = [];
                            }
                            // Clear calculation flag
                            panel._genieChangeCalculated = false;
                            // Note: We don't clear _chartSeriesData, _chartSeriesNames, _statsSeriesData, etc.
                            // as these are intermediate data used for rendering and should persist
                            // Note: We also don't clear _previousDataByDuration, _statsSeriesDataByDuration here
                            // as these are used for general compare functionality, not just genie check
                        };

                        // Clear genie state for ALL panels (standalone + children)
                        this.panelOrder.normal.forEach(panelId => {
                            const panel = this.panels[panelId];
                            if (!panel) return;

                            clearGenieState(panel);
                            // Also clear for child panels
                            if (panel.type === 'row' && panel.panels && Array.isArray(panel.panels)) {
                                panel.panels.forEach(childPanel => {
                                    clearGenieState(childPanel);
                                });
                            }
                        });

                        // Clear aligned y-axis ticks
                        this._genieAlignedYAxisTicks = null;
                        this._genieAlignedYAxisWidth = null;

                        // Remove vertical grid line overlay
                        this.removeGenieVerticalGridLine();

                        // Restore original panel order
                        this.restoreOriginalPanelOrder();

                        // Re-render all charts to restore individual y-axis tick configuration
                        // Helper to restore a panel's chart
                        const restorePanelChart = (panel, panelId) => {
                            const chartKey = String(panelId); // Ensure string key for consistency
                            const chart = this.charts && this.charts[chartKey];
                            if (chart && !chart.destroyed) {
                                // Remove aligned y-axis tick count and padding
                                if (chart.options && chart.options.scales && chart.options.scales.y && chart.options.scales.y.ticks) {
                                    delete chart.options.scales.y.ticks.count;
                                    delete chart.options.scales.y.ticks.padding;
                                }
                                // Remove afterFit callback
                                if (chart.options && chart.options.scales && chart.options.scales.y) {
                                    delete chart.options.scales.y.afterFit;
                                }
                                // Remove afterFit from scale instance if it exists
                                if (chart.scales && chart.scales.y && chart.scales.y.options) {
                                    delete chart.scales.y.options.afterFit;
                                }
                                chart.update('none');
                            }
                        };

                        // Process all top-level panels
                        this.panelOrder.normal.forEach(panelId => {
                            const panel = this.panels[panelId];
                            if (!panel) return;

                            restorePanelChart(panel, panel.id);

                            // Also process child panels if this is a row panel
                            if (panel.type === 'row' && panel.panels && Array.isArray(panel.panels)) {
                                panel.panels.forEach((childPanel) => {
                                    // Child panels have their own unique IDs stored in this.panels
                                    restorePanelChart(childPanel, childPanel.id);
                                });
                            }
                        });
                    }
                });
            }
        }

        /**
         * Calculate maximum y-axis label width across all charts
         * This ensures we allocate enough space for the widest label
         */
        calculateMaxYAxisLabelWidth() {
            let maxWidth = 0;
            const font = '12px Arial'; // Match the font used in chart configuration
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.font = font;

            // Helper function to process a panel's chart
            const processPanelChart = (panel, panelId) => {
                // panel.id is now normalized to match the index used for DOM element ID and chart storage
                const chartKey = String(panelId);
                const chart = this.charts && this.charts[chartKey];

                if (!chart || chart.destroyed) {
                    return;
                }

                // Only process timeseries charts (not pie charts, etc.)
                if (!chart.data || !chart.data.datasets || chart.data.datasets.length === 0) {
                    return;
                }

                // Get the y-axis scale if it exists
                if (chart.scales && chart.scales.y) {
                    const yScale = chart.scales.y;

                    // Method 1: Get actual tick labels from the scale (most accurate)
                    // Chart.js stores formatted tick labels in the ticks array
                    if (yScale.ticks && Array.isArray(yScale.ticks) && yScale.ticks.length > 0) {
                        // Log tick values for panel 3 (panelId is always a string now)
                        if (String(panelId) === '3') {
                            const tickLabels = yScale.ticks.map(tick => tick && tick.label !== undefined && tick.label !== null ? String(tick.label) : null).filter(Boolean);
                            console.log(`[Genie] Panel 3: Using tick labels for width calculation: [${tickLabels.join(', ')}]`);
                            if (yScale.min !== undefined && yScale.max !== undefined) {
                                console.log(`[Genie] Panel 3: Scale min=${yScale.min}, max=${yScale.max}`);
                            }
                        }
                        yScale.ticks.forEach(tick => {
                            if (tick && tick.label !== undefined && tick.label !== null) {
                                const label = String(tick.label);
                                const width = ctx.measureText(label).width;
                                maxWidth = Math.max(maxWidth, width);
                            }
                        });
                    }

                    // Method 2: If ticks aren't available yet, calculate from min/max
                    // This handles cases where chart hasn't fully rendered yet
                    if (maxWidth === 0 || (yScale.min !== undefined && yScale.max !== undefined)) {
                        const min = yScale.min;
                        const max = yScale.max;

                        // Log min/max for panel 3 (panelId is always a string now)
                        if (String(panelId) === '3') {
                            console.log(`[Genie] Panel 3: Found min=${min}, max=${max} for y-axis label width calculation`);
                        }

                        // Use Chart.js tick callback format if available, otherwise use default formatting
                        const tickCallback = yScale.options && yScale.options.ticks && yScale.options.ticks.callback;

                        // Format values as Chart.js would display them
                        const formatValue = (val) => {
                            if (val === null || val === undefined || isNaN(val)) return '';

                            // If there's a custom callback, use it (but we can't call it directly, so estimate)
                            if (tickCallback) {
                                // Estimate: Chart.js typically formats numbers with reasonable precision
                                // For large numbers, it might use scientific notation, but we'll handle common cases
                                if (Math.abs(val) >= 1000000) {
                                    return (val / 1000000).toFixed(1) + 'M';
                                } else if (Math.abs(val) >= 1000) {
                                    return (val / 1000).toFixed(1) + 'K';
                                }
                            }

                            // Default formatting: use reasonable precision based on value magnitude
                            if (Math.abs(val) >= 1000) {
                                // Large numbers: no decimals
                                return Math.round(val).toString();
                            } else if (Math.abs(val) >= 1) {
                                // Medium numbers: 1-2 decimal places
                                const formatted = parseFloat(val).toFixed(2);
                                return parseFloat(formatted).toString();
                            } else {
                                // Small numbers: more decimal places
                                const formatted = parseFloat(val).toFixed(4);
                                return parseFloat(formatted).toString();
                            }
                        };

                        // Check min, max, and a few intermediate values
                        const valuesToCheck = [min, max];
                        if (min !== undefined && max !== undefined) {
                            const range = max - min;
                            // Add a few intermediate values
                            valuesToCheck.push(min + range * 0.25);
                            valuesToCheck.push(min + range * 0.5);
                            valuesToCheck.push(min + range * 0.75);
                        }

                        valuesToCheck.forEach(val => {
                            if (val !== undefined && val !== null && !isNaN(val)) {
                                const label = formatValue(val);
                                if (label) {
                                    const width = ctx.measureText(label).width;
                                    maxWidth = Math.max(maxWidth, width);
                                }
                            }
                        });
                    }
                }
            };

            // Process all top-level panels
            this.panelOrder.normal.forEach(panelId => {
                const panel = this.panels[panelId];
                if (!panel) return;

                processPanelChart(panel, panel.id);

                // Also process child panels if this is a row panel
                // Child panels are stored in panel.panels array and also in this.panels object
                if (panel.type === 'row' && panel.panels && Array.isArray(panel.panels)) {
                    panel.panels.forEach((childPanel) => {
                        // Child panels have their own unique IDs stored in this.panels
                        processPanelChart(childPanel, childPanel.id);
                    });
                }
            });

            // Add padding: label width + padding on both sides + some extra margin
            // Chart.js typically adds padding (usually 8px), so we add extra for safety
            const padding = 24; // Padding: 8px (Chart.js default) + 8px (our padding) + 8px (safety margin)
            const calculatedWidth = maxWidth > 0 ? Math.ceil(maxWidth) + padding : 60; // Fallback to 60px if no data

            // Set a minimum width and round up to nearest 5 for cleaner alignment
            const finalWidth = Math.max(60, Math.ceil(calculatedWidth / 5) * 5);

            console.log(`[Genie] Calculated max y-axis label width: ${maxWidth.toFixed(1)}px, final width: ${finalWidth}px`);

            return finalWidth;
        }

        /**
         * Configure y-axis ticks to align grid lines vertically between panels
         * This ensures grid lines align without changing the scale values
         */
        calculateAlignedYAxisRange() {
            // Set a fixed number of ticks for all charts to ensure grid lines align
            // We'll use 5 ticks (0, 1, 2, 3, 4) which creates 4 grid lines
            // Chart.js will automatically distribute these evenly across each chart's range
            this._genieAlignedYAxisTicks = 5;

            // First, update all charts to get their tick values, then calculate max width
            // We need to do a preliminary update to generate ticks
            // Helper to process a panel's chart
            const updatePanelChart = (panel, panelId) => {
                const chartKey = String(panelId); // Ensure string key for consistency
                const chart = this.charts && this.charts[chartKey];
                if (chart && !chart.destroyed && chart.options && chart.options.scales && chart.options.scales.y) {
                    if (!chart.options.scales.y.ticks) {
                        chart.options.scales.y.ticks = {};
                    }
                    chart.options.scales.y.ticks.count = this._genieAlignedYAxisTicks;
                    chart.options.scales.y.ticks.padding = 8;
                    // Update to generate ticks
                    chart.update('none');
                }
            };

            // Process all top-level panels
            this.panelOrder.normal.forEach(panelId => {
                const panel = this.panels[panelId];
                if (!panel) return;

                updatePanelChart(panel, panel.id);

                // Also process child panels if this is a row panel
                if (panel.type === 'row' && panel.panels && Array.isArray(panel.panels)) {
                    panel.panels.forEach((childPanel) => {
                        // Child panels have their own unique IDs stored in this.panels
                        updatePanelChart(childPanel, childPanel.id);
                    });
                }
            });

            // Wait a bit for charts to update, then calculate max width
            setTimeout(() => {
                this._genieAlignedYAxisWidth = this.calculateMaxYAxisLabelWidth();
                const self = this;

                console.log(`[Genie] Configured aligned y-axis ticks: ${this._genieAlignedYAxisTicks} ticks, width: ${this._genieAlignedYAxisWidth}px for grid line alignment`);

                // Apply the fixed width to all charts
                // Helper to apply width to a panel's chart
                const applyWidthToPanelChart = (panel, panelId) => {
                    const chartKey = String(panelId); // Ensure string key for consistency
                    const chart = this.charts && this.charts[chartKey];
                    if (chart && !chart.destroyed && chart.options && chart.options.scales && chart.options.scales.y) {
                        // Set fixed width using afterFit callback
                        if (chart.scales && chart.scales.y) {
                            const originalAfterFit = chart.scales.y.options.afterFit;
                            chart.scales.y.options.afterFit = function (scale) {
                                if (originalAfterFit) {
                                    originalAfterFit.call(this, scale);
                                }
                                const widthToUse = self._genieAlignedYAxisWidth || 60;
                                //console.log(`[Genie] Panel ${panelId}: Using y-axis label width ${widthToUse}px`);
                                scale.width = widthToUse;
                            };
                        }

                        chart.update('none');
                    }
                };

                // Process all top-level panels
                this.panelOrder.normal.forEach(panelId => {
                    const panel = this.panels[panelId];
                    if (!panel) return;

                    applyWidthToPanelChart(panel, panel.id);

                    // Also process child panels if this is a row panel
                    if (panel.type === 'row' && panel.panels && Array.isArray(panel.panels)) {
                        panel.panels.forEach((childPanel) => {
                            // Child panels have their own unique IDs stored in this.panels
                            applyWidthToPanelChart(childPanel, childPanel.id);
                        });
                    }
                });
            }, 100); // Small delay to ensure charts have updated
        }

        /**
         * Create a vertical dotted grid line overlay that spans all panels
         * This line follows the mouse cursor when genie mode is active
         */
        createGenieVerticalGridLine() {
            // Remove existing line if present
            this.removeGenieVerticalGridLine();

            const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
            if (!grid) {
                console.warn('[Genie] Grid container not found for vertical grid line');
                return;
            }

            // Create the vertical line element
            const verticalLine = document.createElement('div');
            verticalLine.id = this.getInstanceId('genie-vertical-grid-line');
            verticalLine.className = 'genie-vertical-grid-line';

            // Style the line as a dotted/dashed vertical line
            verticalLine.style.position = 'absolute';
            verticalLine.style.top = '0';
            verticalLine.style.left = '0';
            verticalLine.style.width = '0';
            verticalLine.style.height = '100%';
            verticalLine.style.borderLeft = '1px dashed #999';
            verticalLine.style.pointerEvents = 'none';
            verticalLine.style.zIndex = '1000';
            verticalLine.style.display = 'none'; // Initially hidden until mouse moves
            verticalLine.style.opacity = '0.7'; // Slightly transparent for better visibility
            verticalLine.style.transform = 'translateX(-50%)'; // Center the 1px border on the mouse position

            // Append to grid container
            grid.appendChild(verticalLine);

            // Store reference
            this._genieVerticalGridLine = verticalLine;

            // Add mouse move event listener to grid container
            const handleMouseMove = (e) => {
                if (!verticalLine || !grid) return;

                // Get mouse position relative to grid
                const gridRect = grid.getBoundingClientRect();
                const mouseX = e.clientX - gridRect.left;

                // Only show line if mouse is within grid bounds
                if (mouseX >= 0 && mouseX <= gridRect.width) {
                    // Set left position to mouse X coordinate
                    // The transform: translateX(-50%) will center the 1px border on this position
                    verticalLine.style.left = mouseX + 'px';
                    verticalLine.style.display = 'block';
                } else {
                    verticalLine.style.display = 'none';
                }
            };

            // Also listen to mouse move on document to track mouse even when outside grid
            // This ensures the line follows the mouse smoothly
            const handleDocumentMouseMove = (e) => {
                if (!verticalLine || !grid) return;

                const gridRect = grid.getBoundingClientRect();
                const mouseX = e.clientX - gridRect.left;

                // Show line if mouse is within grid bounds (with small margin for smooth transition)
                if (mouseX >= -5 && mouseX <= gridRect.width + 5) {
                    // Set left position to mouse X coordinate
                    // The transform: translateX(-50%) will center the 1px border on this position
                    verticalLine.style.left = mouseX + 'px';
                    verticalLine.style.display = 'block';
                } else {
                    verticalLine.style.display = 'none';
                }
            };

            const handleMouseLeave = () => {
                if (verticalLine) {
                    verticalLine.style.display = 'none';
                }
            };

            // Store handlers for cleanup
            this._genieVerticalGridLineMouseMove = handleMouseMove;
            this._genieVerticalGridLineDocumentMouseMove = handleDocumentMouseMove;
            this._genieVerticalGridLineMouseLeave = handleMouseLeave;

            // Add event listeners
            grid.addEventListener('mousemove', handleMouseMove);
            grid.addEventListener('mouseleave', handleMouseLeave);
            // Also listen on document for smoother tracking
            document.addEventListener('mousemove', handleDocumentMouseMove);

            // Add right-click handler to create permanent blue dashed lines
            const handleGridRightClick = (e) => {
                // Prevent creating line if right-clicking on interactive elements
                const target = e.target;

                // Check if right-clicking on a permanent line (for removal - let its handler deal with it)
                if (target.closest('.genie-vertical-grid-line-permanent')) {
                    return; // Let the permanent line's own handlers deal with it
                }

                // Check if right-clicking on interactive form elements or charts
                if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.tagName === 'SELECT' ||
                    target.closest('input') || target.closest('button') || target.closest('select') ||
                    target.closest('canvas') || target.closest('.chartjs-tooltip') ||
                    target.closest('.genie-vertical-grid-line')) {
                    return;
                }

                // Prevent default context menu
                e.preventDefault();
                e.stopPropagation();

                // Get the position of the gray dashed line (mouse-following line) instead of mouse position
                let lineX = null;
                if (verticalLine && verticalLine.style.display !== 'none' && verticalLine.style.left) {
                    // Extract the numeric value from the left style (e.g., "123.5px" -> 123.5)
                    const leftValue = verticalLine.style.left;
                    lineX = parseFloat(leftValue);
                    console.log(`[Genie] Using gray line position: ${lineX}px`);
                }

                // Fallback to mouse position if gray line is not visible
                if (lineX === null || isNaN(lineX)) {
                    const gridRect = grid.getBoundingClientRect();
                    lineX = e.clientX - gridRect.left;
                    console.log(`[Genie] Gray line not visible, using mouse position: ${lineX}px`);
                }

                // Only create line if position is within grid bounds
                const gridRect = grid.getBoundingClientRect();
                if (lineX >= 0 && lineX <= gridRect.width) {
                    console.log(`[Genie] Right-click detected - Creating permanent line at x: ${lineX}px`);
                    this.createPermanentVerticalLine(grid, lineX);
                } else {
                    console.log(`[Genie] Right-click outside grid bounds - x: ${lineX}, grid width: ${gridRect.width}`);
                }
            };

            // Store right-click handler for cleanup
            this._genieVerticalGridLineRightClick = handleGridRightClick;
            grid.addEventListener('contextmenu', handleGridRightClick);

            console.log('[Genie] Vertical grid line overlay created');
        }

        /**
         * Create a permanent blue dashed vertical line at the specified X position
         */
        createPermanentVerticalLine(grid, xPosition) {
            // Initialize array to store permanent lines if not exists
            if (!this._geniePermanentLines) {
                this._geniePermanentLines = [];
            }

            // Create the permanent line element
            const permanentLine = document.createElement('div');
            const lineId = this.getInstanceId(`genie-vertical-grid-line-permanent-${Date.now()}`);
            permanentLine.id = lineId;
            permanentLine.className = 'genie-vertical-grid-line-permanent';

            // Style the permanent line in blue
            // Position the border centered on the click position with 2px padding for easier clicking
            permanentLine.style.position = 'absolute';
            permanentLine.style.top = '0';
            permanentLine.style.left = xPosition + 'px'; // Center point
            permanentLine.style.width = '4px'; // 4px wide (2px on each side of center)
            permanentLine.style.height = '100%';
            permanentLine.style.marginLeft = '-2px'; // Center the 4px element on xPosition
            permanentLine.style.pointerEvents = 'auto'; // Allow clicking on the line for removal
            permanentLine.style.zIndex = '999'; // Slightly below the mouse-following line
            permanentLine.style.opacity = '0.8';
            permanentLine.style.cursor = 'pointer'; // Show pointer cursor on hover
            permanentLine.style.backgroundColor = 'transparent'; // Keep background transparent

            // Create an inner element to visually center the border
            const borderElement = document.createElement('div');
            borderElement.style.position = 'absolute';
            borderElement.style.left = '50%';
            borderElement.style.top = '0';
            borderElement.style.width = '0';
            borderElement.style.height = '100%';
            borderElement.style.borderLeft = '1px dashed #3b82f6'; // Blue color
            borderElement.style.transform = 'translateX(-50%)';
            borderElement.style.pointerEvents = 'none';
            permanentLine.appendChild(borderElement);

            // Add right-click handler to remove the line
            permanentLine.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.removePermanentVerticalLine(lineId);
                return false;
            });

            // Add double-click handler to remove the line (alternative to right-click)
            permanentLine.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.removePermanentVerticalLine(lineId);
                return false;
            });

            // Prevent single click from creating a new line when clicking on existing line
            permanentLine.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Append to grid container
            grid.appendChild(permanentLine);

            // Store reference
            this._geniePermanentLines.push({
                id: lineId,
                element: permanentLine,
                xPosition: xPosition
            });

            console.log(`[Genie] Created permanent vertical line at x: ${xPosition}px, lineId: ${lineId}`);
        }

        /**
         * Remove a specific permanent vertical line by ID
         */
        removePermanentVerticalLine(lineId) {
            if (!this._geniePermanentLines) return;

            const lineIndex = this._geniePermanentLines.findIndex(line => line.id === lineId);
            if (lineIndex !== -1) {
                const line = this._geniePermanentLines[lineIndex];
                if (line.element && line.element.parentNode) {
                    line.element.parentNode.removeChild(line.element);
                }
                this._geniePermanentLines.splice(lineIndex, 1);
                console.log(`[Genie] Removed permanent vertical line: ${lineId}`);
            }
        }

        /**
         * Remove all permanent vertical lines
         */
        removeAllPermanentVerticalLines() {
            if (!this._geniePermanentLines) return;

            this._geniePermanentLines.forEach(line => {
                if (line.element && line.element.parentNode) {
                    line.element.parentNode.removeChild(line.element);
                }
            });

            this._geniePermanentLines = [];
            console.log('[Genie] Removed all permanent vertical lines');
        }

        /**
         * Setup context menus for all existing charts
         */
        setupContextMenusForAllCharts() {
            if (!this._genieAlignedYAxisTicks) {
                return;
            }

            console.log('[Genie] Setting up context menus for all existing charts');
            // Setup context menu for all existing charts
            // Always re-setup to ensure handlers are attached even after genie was unchecked
            this.panelOrder.normal.forEach(panelId => {
                const panel = this.panels[panelId];
                if (!panel) return;
                const chartKey = String(panel.id); // Ensure string key for consistency
                const chart = this.charts && this.charts[chartKey];
                if (chart && !chart.destroyed && chart.canvas) {
                    // Always re-setup (will remove old handler if exists)
                    this.setupChartContextMenu(chart.canvas, panel, chart);
                }
            });
        }

        /**
         * Setup custom context menu for chart canvas to add markers
         */
        setupChartContextMenu(canvas, panel, chart) {
            if (typeof ChartInteractions === 'undefined' || !ChartInteractions.setupChartContextMenu) {
                throw new Error('GenieDashboard: ChartInteractions module is required but not loaded. Please ensure ChartInteractions.js is included before genieDashboard.js');
            }
            return ChartInteractions.setupChartContextMenu(canvas, panel, chart, {
                _genieAlignedYAxisTicks: this._genieAlignedYAxisTicks,
                _chartContextMenus: this._chartContextMenus,
                _chartContextMenuHideHandlers: this._chartContextMenuHideHandlers,
                getInstanceId: (id) => this.getInstanceId(id),
                dashboardGrid: this.dashboardGrid,
                _contextMenuMouseX: this._contextMenuMouseX,
                createPermanentVerticalLine: (grid, gridX) => this.createPermanentVerticalLine(grid, gridX)
            });
        }


        /**
         * Remove the vertical grid line overlay
         */
        removeGenieVerticalGridLine() {
            const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));

            // Remove event listeners
            if (this._genieVerticalGridLineMouseMove && grid) {
                grid.removeEventListener('mousemove', this._genieVerticalGridLineMouseMove);
                this._genieVerticalGridLineMouseMove = null;
            }
            if (this._genieVerticalGridLineDocumentMouseMove) {
                document.removeEventListener('mousemove', this._genieVerticalGridLineDocumentMouseMove);
                this._genieVerticalGridLineDocumentMouseMove = null;
            }
            if (this._genieVerticalGridLineMouseLeave && grid) {
                grid.removeEventListener('mouseleave', this._genieVerticalGridLineMouseLeave);
                this._genieVerticalGridLineMouseLeave = null;
            }
            if (this._genieVerticalGridLineRightClick && grid) {
                grid.removeEventListener('contextmenu', this._genieVerticalGridLineRightClick);
                this._genieVerticalGridLineRightClick = null;
            }

            // Remove the mouse-following line element
            if (this._genieVerticalGridLine) {
                if (this._genieVerticalGridLine.parentNode) {
                    this._genieVerticalGridLine.parentNode.removeChild(this._genieVerticalGridLine);
                }
                this._genieVerticalGridLine = null;
            } else {
                // Try to find and remove by ID
                const existingLine = document.getElementById(this.getInstanceId('genie-vertical-grid-line'));
                if (existingLine && existingLine.parentNode) {
                    existingLine.parentNode.removeChild(existingLine);
                }
            }

            // Remove all permanent lines
            this.removeAllPermanentVerticalLines();

            // Remove chart context menus
            this.removeChartContextMenus();

            console.log('[Genie] Vertical grid line overlay removed');
        }

        /**
         * Remove all chart context menus
         */
        removeChartContextMenus() {
            // Remove context menu event handlers from canvases
            if (this._chartContextMenus) {
                this._chartContextMenus.forEach(item => {
                    // Remove event handler from canvas
                    if (item.canvas && item.canvas._genieContextMenuHandler) {
                        item.canvas.removeEventListener('contextmenu', item.canvas._genieContextMenuHandler, {capture: true});
                        item.canvas._genieContextMenuHandler = null;
                        item.canvas._genieContextMenuSetup = false;
                    }
                    // Remove menu element
                    if (item.menu && item.menu.parentNode) {
                        item.menu.parentNode.removeChild(item.menu);
                    }
                });
                this._chartContextMenus = [];
            }

            // Remove hide handlers
            if (this._chartContextMenuHideHandlers) {
                this._chartContextMenuHideHandlers.forEach(handler => {
                    document.removeEventListener('click', handler);
                    document.removeEventListener('contextmenu', handler);
                });
                this._chartContextMenuHideHandlers = [];
            }

            // Also clean up any remaining handlers on all canvases
            this.panelOrder.normal.forEach(panelId => {
                const panel = this.panels[panelId];
                if (!panel) return;

                const chartKey = String(panel.id); // Ensure string key for consistency
                const chart = this.charts && this.charts[chartKey];
                if (chart && chart.canvas && chart.canvas._genieContextMenuHandler) {
                    chart.canvas.removeEventListener('contextmenu', chart.canvas._genieContextMenuHandler, {capture: true});
                    chart.canvas._genieContextMenuHandler = null;
                    chart.canvas._genieContextMenuSetup = false;
                }
            });
        }

        /**
         * Setup edit modal for dashboard JSON editing
         */
        setupEditModal() {
            // Check if modal already exists
            if (this.editModalOverlay && document.body.contains(this.editModalOverlay)) {
                return; // Modal already exists
            }

            // Create modal overlay
            const modalOverlay = document.createElement('div');
            modalOverlay.id = this.getInstanceId('edit-modal-overlay');
            modalOverlay.className = 'genie-edit-modal-overlay';
            modalOverlay.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            justify-content: center;
            align-items: center;
        `;

            // Create modal container
            const modalContainer = document.createElement('div');
            modalContainer.className = 'genie-edit-modal-container';
            modalContainer.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 20px;
            width: 90%;
            max-width: 800px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;

            // Create modal header
            const modalHeader = document.createElement('div');
            modalHeader.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid #e5e7eb;
        `;
            const modalTitle = document.createElement('h3');
            modalTitle.textContent = 'Edit Dashboard JSON';
            modalTitle.style.cssText = 'margin: 0; font-size: 18px; font-weight: 600; color: #374151;';
            const closeButton = document.createElement('button');
            closeButton.innerHTML = '✕';
            closeButton.style.cssText = `
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #6b7280;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
            closeButton.addEventListener('click', () => {
                modalOverlay.style.display = 'none';
            });
            modalHeader.appendChild(modalTitle);
            modalHeader.appendChild(closeButton);

            // Create textarea for JSON editing
            const textarea = document.createElement('textarea');
            textarea.id = this.getInstanceId('edit-json-textarea');
            textarea.style.cssText = `
            width: 100%;
            height: 60vh;
            padding: 12px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            resize: vertical;
            flex: 1;
            min-height: 300px;
        `;
            textarea.placeholder = 'Paste dashboard JSON here...';

            // Create button container
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid #e5e7eb;
        `;

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = `
            padding: 8px 16px;
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            color: #374151;
        `;
            cancelBtn.addEventListener('click', () => {
                modalOverlay.style.display = 'none';
            });

            const submitBtn = document.createElement('button');
            submitBtn.textContent = 'Submit & Refresh';
            submitBtn.style.cssText = `
            padding: 8px 16px;
            background: #3b82f6;
            border: 1px solid #3b82f6;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            color: white;
            font-weight: 500;
        `;
            submitBtn.addEventListener('click', () => {
                try {
                    const jsonText = textarea.value.trim();
                    if (!jsonText) {
                        alert('Please enter dashboard JSON');
                        return;
                    }

                    const newDashboardJson = JSON.parse(jsonText);

                    // Validate that it has panels
                    if (!newDashboardJson.panels || !Array.isArray(newDashboardJson.panels)) {
                        alert('Invalid dashboard JSON: missing panels array');
                        return;
                    }

                    // Close modal
                    modalOverlay.style.display = 'none';

                    // Disable submit button during refresh
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Refreshing...';

                    // Render dashboard with new config
                    this.render(newDashboardJson, this.inputConfig).finally(() => {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Submit & Refresh';
                    });

                } catch (error) {
                    alert(`Invalid JSON: ${error.message}`);
                    console.error('Error parsing dashboard JSON:', error);
                }
            });

            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(submitBtn);

            // Assemble modal
            modalContainer.appendChild(modalHeader);
            modalContainer.appendChild(textarea);
            modalContainer.appendChild(buttonContainer);
            modalOverlay.appendChild(modalContainer);

            // Close on overlay click
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    modalOverlay.style.display = 'none';
                }
            });

            // Append to body
            document.body.appendChild(modalOverlay);

            // Store references
            this.editModalOverlay = modalOverlay;
            this.editModalTextarea = textarea;
        }

        /**
         * Show edit modal with current dashboard JSON
         */
        showEditModal() {
            if (!this.editModalOverlay || !this.editModalTextarea) {
                console.warn('Edit modal not initialized');
                return;
            }

            // Populate textarea with current dashboard JSON
            this.editModalTextarea.value = JSON.stringify(this.dashboardConfig, null, 2);

            // Show modal
            this.editModalOverlay.style.display = 'flex';

            // Focus textarea
            setTimeout(() => {
                this.editModalTextarea.focus();
                this.editModalTextarea.setSelectionRange(0, 0);
            }, 100);
        }

        /**
         * Deep merge utility function
         * Merges source object into target object recursively
         */
        /**
         * Deep merge utility function
         * Delegates to Helpers module
         * @param {Object} target - Target object to merge into
         * @param {Object} source - Source object to merge from
         * @returns {Object} Merged object
         */
        deepMerge(target, source) {
            return Helpers.deepMerge(target, source);
        }

        /**
         * Convert external dashboard config to genieDashboard format
         * Extracts supported options from the input config and applies overrides
         * Delegates to ConfigParser module
         * @param {Object} externalConfig - The external dashboard config to convert
         * @param {Object} overrides - Overrides to apply during conversion (from inputConfig.overrides)
         */
        convertDashboardConfig(externalConfig, overrides = null) {
            if (typeof ConfigParser === 'undefined' || !ConfigParser.convertDashboardConfig) {
                throw new Error('GenieDashboard: ConfigParser module is required but not loaded. Please ensure ConfigParser.js is included before genieDashboard.js');
            }
            return ConfigParser.convertDashboardConfig(externalConfig, overrides);
        }

        /**
         * Setup upload modal for dashboard config upload
         */
        setupUploadModal() {
            // Check if modal already exists
            if (this.uploadModalOverlay && document.body.contains(this.uploadModalOverlay)) {
                return; // Modal already exists
            }

            // Create modal overlay
            const modalOverlay = document.createElement('div');
            modalOverlay.id = this.getInstanceId('upload-modal-overlay');
            modalOverlay.className = 'genie-upload-modal-overlay';
            modalOverlay.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            justify-content: center;
            align-items: center;
        `;

            // Create modal container
            const modalContainer = document.createElement('div');
            modalContainer.className = 'genie-upload-modal-container';
            modalContainer.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 20px;
            width: 90%;
            max-width: 900px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;

            // Create modal header
            const modalHeader = document.createElement('div');
            modalHeader.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid #e5e7eb;
        `;

            // Create title container with title and expert name input
            const titleContainer = document.createElement('div');
            titleContainer.style.cssText = 'display: flex; align-items: center; gap: 16px; flex: 1;';

            const modalTitle = document.createElement('h3');
            modalTitle.textContent = 'Upload expert dashboard view config';
            modalTitle.style.cssText = 'margin: 0; font-size: 18px; font-weight: 600; color: #374151;';

            // Create expert name input field
            const expertNameLabel = document.createElement('label');
            expertNameLabel.textContent = 'Expert name:';
            expertNameLabel.style.cssText = 'font-size: 14px; color: #374151; white-space: nowrap;';

            const expertNameInput = document.createElement('input');
            expertNameInput.type = 'text';
            expertNameInput.id = this.getInstanceId('expert-name-input');
            expertNameInput.placeholder = 'Enter expert name';
            expertNameInput.style.cssText = `
            padding: 6px 12px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 14px;
            width: 200px;
        `;

            titleContainer.appendChild(modalTitle);
            titleContainer.appendChild(expertNameLabel);
            titleContainer.appendChild(expertNameInput);

            const closeButton = document.createElement('button');
            closeButton.innerHTML = '✕';
            closeButton.style.cssText = `
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #6b7280;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
            closeButton.addEventListener('click', () => {
                modalOverlay.style.display = 'none';
            });
            modalHeader.appendChild(titleContainer);
            modalHeader.appendChild(closeButton);

            // Create tab container
            const tabContainer = document.createElement('div');
            tabContainer.style.cssText = `
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
            border-bottom: 1px solid #e5e7eb;
        `;

            const pasteTab = document.createElement('button');
            pasteTab.textContent = 'Paste Config';
            pasteTab.id = this.getInstanceId('upload-tab-paste');
            pasteTab.style.cssText = `
            padding: 8px 16px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 4px 4px 0 0;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
        `;

            const convertedTab = document.createElement('button');
            convertedTab.textContent = 'Converted Config';
            convertedTab.id = this.getInstanceId('upload-tab-converted');
            convertedTab.style.cssText = `
            padding: 8px 16px;
            background: #f3f4f6;
            color: #6b7280;
            border: none;
            border-radius: 4px 4px 0 0;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
        `;

            tabContainer.appendChild(pasteTab);
            tabContainer.appendChild(convertedTab);

            // Create content container
            const contentContainer = document.createElement('div');
            contentContainer.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
        `;

            // Create paste textarea
            const pasteTextarea = document.createElement('textarea');
            pasteTextarea.id = this.getInstanceId('upload-paste-textarea');
            pasteTextarea.style.cssText = `
            width: 100%;
            height: 60vh;
            padding: 12px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            resize: vertical;
            flex: 1;
            min-height: 300px;
            display: block;
        `;
            pasteTextarea.placeholder = 'Paste your dashboard JSON config here...';

            // Create converted textarea (read-only)
            const convertedTextarea = document.createElement('textarea');
            convertedTextarea.id = this.getInstanceId('upload-converted-textarea');
            convertedTextarea.readOnly = true;
            convertedTextarea.style.cssText = `
            width: 100%;
            height: 60vh;
            padding: 12px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            resize: vertical;
            flex: 1;
            min-height: 300px;
            display: none;
            background: #f9fafb;
            color: #374151;
        `;
            convertedTextarea.placeholder = 'Converted config will appear here after you paste and convert...';

            contentContainer.appendChild(pasteTextarea);
            contentContainer.appendChild(convertedTextarea);

            // Tab switching logic
            const switchTab = (activeTab) => {
                if (activeTab === 'paste') {
                    pasteTab.style.background = '#3b82f6';
                    pasteTab.style.color = 'white';
                    convertedTab.style.background = '#f3f4f6';
                    convertedTab.style.color = '#6b7280';
                    pasteTextarea.style.display = 'block';
                    convertedTextarea.style.display = 'none';
                } else {
                    pasteTab.style.background = '#f3f4f6';
                    pasteTab.style.color = '#6b7280';
                    convertedTab.style.background = '#3b82f6';
                    convertedTab.style.color = 'white';
                    pasteTextarea.style.display = 'none';
                    convertedTextarea.style.display = 'block';
                }
            };

            pasteTab.addEventListener('click', () => switchTab('paste'));
            convertedTab.addEventListener('click', () => switchTab('converted'));

            // Create button container
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid #e5e7eb;
        `;

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = `
            padding: 8px 16px;
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            color: #374151;
        `;
            cancelBtn.addEventListener('click', () => {
                modalOverlay.style.display = 'none';
            });

            const convertBtn = document.createElement('button');
            convertBtn.textContent = 'Convert';
            convertBtn.style.cssText = `
            padding: 8px 16px;
            background: #10b981;
            border: 1px solid #10b981;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            color: white;
            font-weight: 500;
        `;
            convertBtn.addEventListener('click', () => {
                try {
                    const jsonText = pasteTextarea.value.trim();
                    if (!jsonText) {
                        alert('Please paste a dashboard JSON config');
                        return;
                    }

                    const externalConfig = JSON.parse(jsonText);

                    // Extract root-level "title" and set it as default expert name
                    if (externalConfig && externalConfig.title && typeof externalConfig.title === 'string') {
                        const expertNameInput = document.getElementById(this.getInstanceId('expert-name-input'));
                        if (expertNameInput && !expertNameInput.value.trim()) {
                            // Only set if the field is empty
                            expertNameInput.value = externalConfig.title.trim();
                            console.log('[Expert] Set expert name from config title:', externalConfig.title);
                        }
                    }

                    // Get overrides from inputConfig if available
                    const overrides = this.inputConfig && this.inputConfig.overrides ? this.inputConfig.overrides : null;

                    // Convert to genieDashboard format
                    const convertedConfig = this.convertDashboardConfig(externalConfig, overrides);

                    // Validate that it has panels
                    if (!convertedConfig.panels || !Array.isArray(convertedConfig.panels) || convertedConfig.panels.length === 0) {
                        alert('Invalid dashboard JSON: missing or empty panels array');
                        return;
                    }

                    // Show converted config in the converted tab
                    convertedTextarea.value = JSON.stringify(convertedConfig, null, 2);
                    switchTab('converted');

                } catch (error) {
                    alert(`Invalid JSON: ${error.message}`);
                    console.error('Error parsing dashboard JSON:', error);
                }
            });

            const submitBtn = document.createElement('button');
            submitBtn.textContent = 'Add Expert view';
            submitBtn.style.cssText = `
            padding: 8px 16px;
            background: #3b82f6;
            border: 1px solid #3b82f6;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            color: white;
            font-weight: 500;
        `;
            submitBtn.addEventListener('click', () => {
                try {
                    // Get expert name input field
                    const expertNameInput = document.getElementById(this.getInstanceId('expert-name-input'));
                    let expertName = expertNameInput ? expertNameInput.value.trim() : '';

                    // If expert name is empty, try to extract it from pasted config
                    if (!expertName) {
                        const pasteText = pasteTextarea.value.trim();
                        if (pasteText) {
                            try {
                                const externalConfig = JSON.parse(pasteText);
                                if (externalConfig && externalConfig.title && typeof externalConfig.title === 'string') {
                                    expertName = externalConfig.title.trim();
                                    if (expertNameInput) {
                                        expertNameInput.value = expertName;
                                    }
                                    console.log('[Expert] Set expert name from config title:', expertName);
                                }
                            } catch (e) {
                                // If paste text is not valid JSON, continue with normal flow
                            }
                        }
                    }

                    if (!expertName) {
                        alert('Please enter an expert name');
                        return;
                    }

                    // Check if expert name already exists
                    if (this.expertViews[expertName]) {
                        if (!confirm(`Expert "${expertName}" already exists. Do you want to overwrite it?`)) {
                            return;
                        }
                    }

                    // Get the converted config (use converted textarea if it has content, otherwise convert from paste)
                    let configToUse;
                    const convertedText = convertedTextarea.value.trim();
                    if (convertedText) {
                        configToUse = JSON.parse(convertedText);
                    } else {
                        const pasteText = pasteTextarea.value.trim();
                        if (!pasteText) {
                            alert('Please paste a dashboard JSON config and convert it first');
                            return;
                        }
                        const externalConfig = JSON.parse(pasteText);

                        // Get overrides from inputConfig if available
                        const overrides = this.inputConfig && this.inputConfig.overrides ? this.inputConfig.overrides : null;
                        configToUse = this.convertDashboardConfig(externalConfig, overrides);
                    }

                    // Validate that it has panels
                    if (!configToUse.panels || !Array.isArray(configToUse.panels)) {
                        alert('Invalid dashboard JSON: missing panels array');
                        return;
                    }

                    // Cache the expert view
                    this.expertViews[expertName] = {
                        config: configToUse,
                        inputConfig: JSON.parse(JSON.stringify(this.inputConfig)) // Deep copy
                    };

                    // Add to dropdown
                    this.updateExpertsDropdown();

                    // Close modal
                    modalOverlay.style.display = 'none';

                    // Clear expert name input
                    if (expertNameInput) {
                        expertNameInput.value = '';
                    }

                    // Clear textareas
                    pasteTextarea.value = '';
                    convertedTextarea.value = '';

                } catch (error) {
                    alert(`Invalid JSON: ${error.message}`);
                    console.error('Error parsing dashboard JSON:', error);
                }
            });

            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(convertBtn);
            buttonContainer.appendChild(submitBtn);

            // Assemble modal
            modalContainer.appendChild(modalHeader);
            modalContainer.appendChild(tabContainer);
            modalContainer.appendChild(contentContainer);
            modalContainer.appendChild(buttonContainer);
            modalOverlay.appendChild(modalContainer);

            // Close on overlay click
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    modalOverlay.style.display = 'none';
                }
            });

            // Append to body
            document.body.appendChild(modalOverlay);

            // Store references
            this.uploadModalOverlay = modalOverlay;
            this.uploadModalPasteTextarea = pasteTextarea;
            this.uploadModalConvertedTextarea = convertedTextarea;
        }

        /**
         * Load pre-configured expert dashboards from the server
         * Fetches the list of expert JSON files and loads each one into expertViews
         * This is called once per dashboard instance during render()
         */
        async loadPreconfiguredExperts() {
            try {
                console.log('[GenieDashboard] Loading pre-configured expert dashboards...');

                // Fetch list of available expert dashboards
                const response = await fetch('/api/v1/expert-dashboards/list');
                if (!response.ok) {
                    console.warn('[GenieDashboard] Failed to fetch expert dashboards list:', response.statusText);
                    return;
                }

                const expertFiles = await response.json();
                if (!Array.isArray(expertFiles) || expertFiles.length === 0) {
                    console.log('[GenieDashboard] No pre-configured expert dashboards found');
                    return;
                }

                console.log(`[GenieDashboard] Found ${expertFiles.length} pre-configured expert dashboard(s):`, expertFiles);

                // Load each expert dashboard
                for (const filename of expertFiles) {
                    try {
                        const expertName = filename.replace(/\.json$/i, '');

                        // Skip if expert already exists (user-added)
                        if (this.expertViews[expertName]) {
                            console.log(`[GenieDashboard] Expert "${expertName}" already exists, skipping pre-configured version`);
                            continue;
                        }

                        // Fetch the expert dashboard JSON
                        const expertResponse = await fetch(`/api/v1/expert-dashboards/${filename}`);
                        if (!expertResponse.ok) {
                            console.warn(`[GenieDashboard] Failed to fetch expert dashboard "${filename}":`, expertResponse.statusText);
                            continue;
                        }

                        const expertConfig = await expertResponse.json();

                        // Validate expert config structure
                        if (!expertConfig.panels || !Array.isArray(expertConfig.panels)) {
                            console.warn(`[GenieDashboard] Invalid expert dashboard "${filename}": missing panels array`);
                            continue;
                        }

                        // Convert the expert config using the same logic as addExpertView
                        const overrides = this.inputConfig && this.inputConfig.overrides ? this.inputConfig.overrides : null;
                        const convertedConfig = this.convertDashboardConfig(expertConfig, overrides);

                        // Add to expertViews
                        this.expertViews[expertName] = {
                            config: convertedConfig,
                            inputConfig: JSON.parse(JSON.stringify(this.inputConfig))
                        };

                        console.log(`[GenieDashboard] ✓ Loaded pre-configured expert dashboard: "${expertName}"`);
                    } catch (error) {
                        console.error(`[GenieDashboard] Error loading expert dashboard "${filename}":`, error);
                    }
                }

                // Update the dropdown to show the new experts
                this.updateExpertsDropdown();

                console.log(`[GenieDashboard] Finished loading pre-configured expert dashboards. Total experts: ${Object.keys(this.expertViews).length}`);
            } catch (error) {
                console.error('[GenieDashboard] Error loading pre-configured expert dashboards:', error);
            }
        }

        updateExpertsDropdown() {
            // Update the experts menu if it exists
            if (this.populateExpertsMenu) {
                this.populateExpertsMenu();
            }

            // Update the button display if it exists
            if (this.updateExpertsButtonDisplay) {
                this.updateExpertsButtonDisplay();
            }
        }

        /**
         * Show progress message for expert view loading
         */
        showExpertProgressMessage(message) {
            // Remove existing progress message if any
            this.hideExpertProgressMessage();

            // Try to find toolbar - use correct class name
            const toolbar = this.container.querySelector('.genie-dashboard-toolbar');
            if (!toolbar) {
                console.warn('Toolbar not found, cannot show progress message');
                return;
            }

            const progressDiv = document.createElement('div');
            progressDiv.id = this.getInstanceId('expert-progress-message');
            progressDiv.style.cssText = `
            margin-left: 16px;
            padding: 6px 12px;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 4px;
            font-size: 13px;
            color: #1e40af;
            display: flex;
            align-items: center;
            gap: 8px;
            white-space: nowrap;
        `;

            // Use centralized spinner creation method
            const spinner = this.createTextSpinner('⟳', 'spin');

            const messageText = document.createElement('span');
            messageText.textContent = message;

            progressDiv.appendChild(spinner);
            progressDiv.appendChild(messageText);

            // Insert loading message after edit button instead of at the end
            const editButton = document.getElementById(this.getInstanceId('toolbar-edit'));
            if (editButton && editButton.nextSibling) {
                // Insert after edit button
                toolbar.insertBefore(progressDiv, editButton.nextSibling);
            } else if (editButton) {
                // Edit button exists but has no next sibling, insert after it
                editButton.insertAdjacentElement('afterend', progressDiv);
            } else {
                // No edit button found, append to toolbar as fallback
                toolbar.appendChild(progressDiv);
            }
        }

        /**
         * Hide progress message for expert view loading
         */
        hideExpertProgressMessage() {
            const progressDiv = document.getElementById(this.getInstanceId('expert-progress-message'));
            if (progressDiv) {
                progressDiv.remove();
            }
        }

        /**
         * Show progress message for anomaly detection
         */
        showAnomalyProgressMessage(message) {
            // Remove existing progress message if any
            this.hideAnomalyProgressMessage();

            // Try to find toolbar - use correct class name
            const toolbar = this.container.querySelector('.genie-dashboard-toolbar');
            if (!toolbar) {
                console.warn('Toolbar not found, cannot show anomaly progress message');
                return;
            }

            const progressDiv = document.createElement('div');
            progressDiv.id = this.getInstanceId('anomaly-progress-message');
            progressDiv.style.cssText = `
            margin-left: 16px;
            padding: 6px 12px;
            background: #fef3c7;
            border: 1px solid #fcd34d;
            border-radius: 4px;
            font-size: 13px;
            color: #92400e;
            display: flex;
            align-items: center;
            gap: 8px;
            white-space: nowrap;
        `;

            // Use centralized spinner creation method
            const spinner = this.createTextSpinner('⟳', 'spin');

            const messageText = document.createElement('span');
            messageText.textContent = message;

            progressDiv.appendChild(spinner);
            progressDiv.appendChild(messageText);

            // Insert loading message after edit button instead of at the end
            const editButton = document.getElementById(this.getInstanceId('toolbar-edit'));
            if (editButton && editButton.nextSibling) {
                // Insert after edit button
                toolbar.insertBefore(progressDiv, editButton.nextSibling);
            } else if (editButton) {
                // Edit button exists but has no next sibling, insert after it
                editButton.insertAdjacentElement('afterend', progressDiv);
            } else {
                // No edit button found, append to toolbar as fallback
                toolbar.appendChild(progressDiv);
            }
        }

        /**
         * Hide progress message for anomaly detection
         */
        hideAnomalyProgressMessage() {
            const progressDiv = document.getElementById(this.getInstanceId('anomaly-progress-message'));
            if (progressDiv) {
                progressDiv.remove();
            }
        }


        /**
         * Handle expert selection change in dropdown menu
         */
        async handleExpertSelectionChange() {
            const expertsMenu = this.expertsMenu || document.getElementById(this.getInstanceId('experts-menu'));
            if (!expertsMenu) return;

            // Wait a bit to allow checkbox and UI to render first
            await new Promise(resolve => setTimeout(resolve, 50));

            // Get selected expert names from checkboxes
            const selectedExperts = [];
            const checkboxes = expertsMenu.querySelectorAll(`.expert-checkbox-${this.instanceId}:checked`);
            checkboxes.forEach(checkbox => {
                selectedExperts.push(checkbox.value);
            });

            // Determine which experts to add and which to remove
            const expertsToAdd = selectedExperts.filter(name => !this.loadedExpertViews.has(name));
            const expertsToRemove = Array.from(this.loadedExpertViews).filter(name => !selectedExperts.includes(name));

            // Show progress message if there are operations to perform
            if (expertsToAdd.length > 0 || expertsToRemove.length > 0) {
                // Wait a bit more to ensure progress message is rendered
                await new Promise(resolve => setTimeout(resolve, 50));

                if (expertsToRemove.length > 0) {
                    this.showExpertProgressMessage(`Removing ${expertsToRemove.length} expert view${expertsToRemove.length > 1 ? 's' : ''}...`);
                    // Allow progress message to render
                    await new Promise(resolve => setTimeout(resolve, 50));
                }

                // Remove deselected expert views first
                for (const expertName of expertsToRemove) {
                    await this.removeExpertView(expertName);
                }

                // Add newly selected expert views in order (append to existing)
                if (expertsToAdd.length > 0) {
                    this.showExpertProgressMessage(`Loading ${expertsToAdd.length} expert view${expertsToAdd.length > 1 ? 's' : ''}...`);
                    // Allow progress message to render
                    await new Promise(resolve => setTimeout(resolve, 50));

                    for (let i = 0; i < expertsToAdd.length; i++) {
                        const expertName = expertsToAdd[i];
                        this.showExpertProgressMessage(`Loading expert view "${expertName}" (${i + 1}/${expertsToAdd.length})...`);
                        // Allow progress message update to render
                        await new Promise(resolve => setTimeout(resolve, 50));
                        await this.appendExpertView(expertName);
                    }
                }

                // Hide progress message when done
                console.log("Completed loding expert, hiding ExpertProgressMessage")
                this.hideExpertProgressMessage();

                // Update button display after operations complete
                if (this.updateExpertsButtonDisplay) {
                    this.updateExpertsButtonDisplay();
                }
            }
        }

        /**
         * Get maximum bottom Y position of all existing panels
         */
        getMaxBottomY() {
            let maxBottom = 0;
            this.panelOrder.normal.forEach(panelId => {
                const panel = this.panels[panelId];
                if (panel) {
                    const gridPos = panel.gridPos || {x: 0, y: 0, w: 12, h: 8};
                    const bottom = gridPos.y + gridPos.h;
                    if (bottom > maxBottom) {
                        maxBottom = bottom;
                    }
                }
            });
            return maxBottom;
        }

        /**
         * Append expert view panels to existing dashboard
         */
        async appendExpertView(expertName) {
            if (!this.expertViews[expertName]) {
                console.warn(`Expert view "${expertName}" not found in cache`);
                return;
            }

            // Clear chat history when loading expert (data is changing)
            this.clearChatHistory();

            // Check if expert is already loaded - if so, remove it first to allow reloading
            if (this.loadedExpertViews.has(expertName)) {
                console.log(`[appendExpertView] Expert view "${expertName}" is already loaded, removing first to allow reload`);
                await this.removeExpertView(expertName);
            }

            const expertData = this.expertViews[expertName];
            const expertConfig = expertData.config;
            const expertInputConfig = expertData.inputConfig;

            // Track if new templating variables were added and if they have default values
            let addedTemplatingCount = 0;
            let hasDefaultValues = false;

            // Merge templating from expert config into main dashboard config
            if (expertConfig.templating && expertConfig.templating.list) {
                console.log(`GenieDashboard: Merging templating from expert view "${expertName}":`, expertConfig.templating.list);

                if (!this.dashboardConfig.templating) {
                    this.dashboardConfig.templating = {list: []};
                }
                if (!this.dashboardConfig.templating.list) {
                    this.dashboardConfig.templating.list = [];
                }

                // Merge templating variables from expert config (avoid duplicates by name)
                const existingVarNames = new Set(
                    this.dashboardConfig.templating.list.map(v => v.name || v.label || '')
                );

                expertConfig.templating.list.forEach(expertVar => {
                    const varName = expertVar.name || expertVar.label || '';
                    if (varName && !existingVarNames.has(varName)) {
                        this.dashboardConfig.templating.list.push(expertVar);
                        existingVarNames.add(varName);
                        addedTemplatingCount++;

                        // Check if this variable has a default value
                        const currentValue = expertVar.current?.value || expertVar.current?.text || '';
                        if (currentValue) {
                            hasDefaultValues = true;
                        }

                        console.log(`GenieDashboard: Added templating variable "${varName}" from expert view "${expertName}"`);
                    } else {
                        console.log(`GenieDashboard: Skipped templating variable "${varName}" (already exists or no name)`);
                    }
                });

                // Create expert-specific input row and add input fields
                // CRITICAL: Wait for input field queries to complete before loading expert panels
                // This ensures input field values are available when expert panels are rendered
                if (expertConfig.templating && expertConfig.templating.list && expertConfig.templating.list.length > 0) {
                    // Initialize expert input config
                    if (!this.expertInputConfigs[expertName]) {
                        this.expertInputConfigs[expertName] = expertInputConfig ? {...expertInputConfig} : {};
                    }

                    // Use common input row for all fields (expert and common)
                    if (!this.commonInputRow) {
                        console.warn(`GenieDashboard: Common input row not found, cannot add expert fields`);
                        return;
                    }

                    console.log(`GenieDashboard: Adding input fields for expert view "${expertName}" with ${expertConfig.templating.list.length} templating variables`);

                    // Add input fields using dependency-based execution (use common input row)
                    await this.addTemplatingInputFields(this.commonInputRow, expertName, expertConfig);

                    console.log(`GenieDashboard: Input fields added and queries completed for expert view "${expertName}"`);
                } else {
                    console.log(`GenieDashboard: Expert view "${expertName}" has no templating variables`);
                }
            } else {
                console.log(`GenieDashboard: Expert view "${expertName}" has no templating section`);
            }

            // Get grid container
            let grid = this.dashboardGrid;
            if (!grid) {
                grid = document.getElementById(this.getInstanceId('grid'));
                if (!grid) {
                    console.warn('Grid container not found');
                    return;
                }
            }

            // CRITICAL: Deep clone expert config panels to avoid mutations
            // This ensures we create fresh panel objects from scratch, not reusing modified objects
            // This is essential for reloading - we want completely fresh panels, not mutated ones
            const deepClonePanels = (panels) => {
                if (!Array.isArray(panels)) return [];
                return panels.map(panel => {
                    if (!panel || typeof panel !== 'object') return panel;

                    // Deep clone panel object using JSON to ensure complete freshness
                    // This removes all runtime properties (id, _expertName, _dataCache, etc.)
                    const cloned = JSON.parse(JSON.stringify(panel));

                    // Restore gridPos as object (JSON.parse handles this correctly)
                    if (panel.gridPos) {
                        cloned.gridPos = {...panel.gridPos};
                    }

                    // Clear any IDs that might have been set (we'll generate new ones)
                    delete cloned.id;

                    // Recursively clone nested panels if this is a row panel
                    if (cloned.type === 'row' && cloned.panels && Array.isArray(cloned.panels)) {
                        cloned.panels = cloned.panels.map(child => {
                            if (!child || typeof child !== 'object') return child;
                            const clonedChild = JSON.parse(JSON.stringify(child));
                            if (child.gridPos) {
                                clonedChild.gridPos = {...child.gridPos};
                            }
                            // Clear any IDs from child panels
                            delete clonedChild.id;
                            return clonedChild;
                        });
                    }

                    return cloned;
                });
            };

            // Create fresh panel objects from expert config (deep clone to avoid mutations)
            // This ensures reloading creates panels from scratch, not reusing modified objects
            const freshExpertPanels = deepClonePanels(expertConfig.panels || []);

            // CRITICAL: Calculate Y offset BEFORE flattenPanels() adds expert panels to this.panels
            // This ensures yOffset only considers existing panels, not the newly added expert panels
            const yOffset = this.getMaxBottomY();
            console.log(`[appendExpertView] Calculated yOffset (max bottom of existing panels): ${yOffset}`);

            // Flatten panels from fresh cloned expert config
            // flattenPanels will generate new IDs and add panels to this.panels and panelOrder.normal
            let expertPanels = this.flattenPanels(freshExpertPanels);

            // Resolve any overlapping panels (this may adjust positions, but we'll fix Y positions after)
            expertPanels = this.resolveOverlappingPanels(expertPanels);

            // Find the minimum Y position in expert panels to calculate relative offset
            // This should be calculated AFTER resolveOverlappingPanels in case it adjusted positions
            let minExpertY = Infinity;
            expertPanels.forEach(panel => {
                const gridPos = panel.gridPos || {x: 0, y: 0, w: 12, h: 8};
                if (gridPos.y < minExpertY) {
                    minExpertY = gridPos.y;
                }
            });
            if (minExpertY === Infinity) {
                minExpertY = 0;
            }
            console.log(`[appendExpertView] Found minExpertY (minimum Y of expert panels): ${minExpertY}`);

            // Check if genie view is active - if not, clear any stale genie properties from expert panels
            const genieCheckbox = document.getElementById(this.getInstanceId('toolbar-genie-checkbox'));
            const isGenieActive = genieCheckbox && genieCheckbox.checked;

            // Clear genie properties helper
            const clearGenieProperties = (panel) => {
                delete panel._genieShowIndependently;
                delete panel._genieOriginalIndex;
                delete panel._genieOriginalY;
                delete panel._genieOriginalGridX;
                delete panel._genieOriginalGridW;
                delete panel._genieOriginalCollapsed;
                delete panel._genieOriginalTitle;
            };

            // Helper function to clear any stale data from panel objects
            // This ensures panels are created fresh from scratch (query cache in this.dataCache is preserved)
            const clearStalePanelData = (panel) => {
                if (!panel) return;

                // Clear any stale panel-specific data (these will be recreated when panel loads)
                delete panel._dataCache;
                delete panel._fetchPromises;
                delete panel._chartSeriesNames;
                delete panel._currentSeriesNames;

                // Clear DOM references (will be created during render)
                delete panel._panelDiv;
                delete panel._contentElement;
                delete panel._collapseButton;
                delete panel._childPanelDivs;

                // Clear parent/child references (will be set during render)
                delete panel._parentRowPanel;
                delete panel._childIndex;
            };

            // IMPORTANT: flattenPanels already added panels to this.panels and panelOrder.normal
            // Now we just need to adjust Y positions, set _expertName, and clear stale data
            expertPanels.forEach(panel => {
                // Clear any stale data from panel object
                clearStalePanelData(panel);

                const gridPos = panel.gridPos || {x: 0, y: 0, w: 12, h: 8};
                const originalY = gridPos.y;
                // Adjust Y position: subtract minExpertY to normalize, then add yOffset
                // This ensures the first expert panel starts exactly at yOffset (no gap)
                gridPos.y = gridPos.y - minExpertY + yOffset;
                console.log(`[appendExpertView] Adjusted Y position for panel "${panel.title || panel.id}": ${originalY} -> ${gridPos.y} (minExpertY=${minExpertY}, yOffset=${yOffset})`);

                // Mark panel with expert name for tracking
                panel._expertName = expertName;

                // Clear any stale genie properties if genie is not active
                // This ensures expert panels loaded in normal view don't have genie properties from previous sessions
                if (!isGenieActive) {
                    clearGenieProperties(panel);
                }

                // Ensure collapsed state is normalized for row panels (safety check)
                // Handle both boolean and string values
                if (panel.type === 'row') {
                    const collapseFromJSON = panel.collapse === true || panel.collapse === 'true' || panel.collapse === 1;
                    const collapsedFromJSON = panel.collapsed === true || panel.collapsed === 'true' || panel.collapsed === 1;
                    const isCollapsed = collapsedFromJSON || collapseFromJSON;
                    panel.collapsed = isCollapsed ? true : false;
                    panel._isCollapsed = isCollapsed ? true : false;
                    console.log(`[appendExpertView] Expert row panel "${panel.title || panel.id}": normalized collapsed state - collapse=${panel.collapse}, collapsed=${panel.collapsed}, _isCollapsed=${panel._isCollapsed}`);

                    // Also set expert name on child panels of row panels and clear genie properties if needed
                    if (panel.panels && Array.isArray(panel.panels)) {
                        panel.panels.forEach(childPanel => {
                            // Clear stale data from child panel
                            clearStalePanelData(childPanel);

                            childPanel._expertName = expertName;
                            // Clear genie properties from child panels too if genie is not active
                            if (!isGenieActive) {
                                clearGenieProperties(childPanel);
                            }
                        });
                    }
                }
            });

            // Render expert panels
            const renderPromises = expertPanels.map((panel) => {
                const panelId = panel.id;
                console.log(`[appendExpertView] Expert panel: panel.id="${panelId}", panel.title="${panel.title}"`);
                if (panel.type === 'row' && panel.panels && Array.isArray(panel.panels) && panel.panels.length > 0) {
                    return this.renderRowPanel(panel, panelId, grid);
                } else {
                    return this.renderPanel(panel, panelId, grid);
                }
            });

            await Promise.all(renderPromises);

            //

            // This ensures data is available for dashboard assistant and when parents are expanded
            console.log(`GenieDashboard: [appendExpertView] Fetching data for collapsed child panels after expert view rendering`);

            // Count collapsed child panels first to show status message
            const collapsedChildPanelCount = this.countCollapsedChildPanels();

            if (collapsedChildPanelCount > 0) {
                // Update status message to show we're fetching hidden view data
                this.showExpertProgressMessage(`Fetching hidden view data (${collapsedChildPanelCount})`);
                // Allow status message to render
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            try {
                // Fetch data for collapsed child panels (data-only, no rendering)
                // Pass empty Set since no panels have been processed yet in this context
                // Also pass callback to update status message as panels complete
                await this.fetchCollapsedChildPanelsData(new Set(), (remainingCount) => {
                    if (collapsedChildPanelCount > 0) {
                        this.showExpertProgressMessage(`Fetching hidden view data (${remainingCount})`);
                    }
                });
                console.log(`GenieDashboard: [appendExpertView] Completed fetching data for collapsed child panels`);
            } catch (error) {
                console.error(`GenieDashboard: [appendExpertView] Error fetching data for collapsed child panels:`, error);
            } finally {
                // Hide status message after fetching completes (or fails)
                if (collapsedChildPanelCount > 0) {
                    this.hideExpertProgressMessage();
                }
            }

            // Validate all panel heights after dynamically loaded panels are rendered
            // Use setTimeout to ensure all DOM updates and height calculations are finished
            setTimeout(() => {
                this.validateAllPanelHeights();
            }, 500);

            // If new input fields were added with default values, refresh all panels to ensure they use updated inputConfig
            // This is especially important if existing panels might use the new templating variables
            // NOTE: If new input fields do NOT have default values, we do NOT auto-refresh.
            //       The user must fill in the values and manually click refresh to update the dashboard.
            if (addedTemplatingCount > 0 && hasDefaultValues) {
                console.log(`GenieDashboard: New input fields have default values, refreshing all panels to use updated inputConfig`);
                // Refresh all panels to ensure they use the updated inputConfig with new templating variable values
                // This ensures both existing and new panels use the correct values
                const allPanelDivs = grid.querySelectorAll('.genie-dashboard-panel');
                const refreshPromises = Array.from(allPanelDivs).map(async (panelDiv) => {
                    // Use findPanelFromElement helper to get panel object (works for both top-level and child panels)
                    const panelResult = this.findPanelFromElement(panelDiv);
                    if (!panelResult || !panelResult.panel) {
                        return; // Panel not found, skip
                    }
                    const panel = panelResult.panel;
                    if (panel && panel.targets && panel.targets.length > 0) {
                        // Re-fetch data for this panel with updated inputConfig
                        try {
                            const result = await this.fetchPanelData(panel);
                            const data = result.data || result;
                            const failedTargets = result.failedTargets || [];

                            // Update the panel's chart with new data
                            const content = panelDiv.querySelector('.genie-dashboard-panel-content');
                            const header = panelDiv.querySelector('.genie-dashboard-panel-header');
                            if (content && data) {
                                this.renderPanelChart(panel, data, content, header);

                                // Update error display if needed
                                if (failedTargets.length > 0) {
                                    panel._failedTargets = failedTargets;
                                    this.showPanelError(panel, content, failedTargets);
                                } else {
                                    this.hidePanelError(panel, content);
                                }
                            }
                        } catch (error) {
                            console.error(`GenieDashboard: Error refreshing panel ${panel.id || 'unknown'}:`, error);
                        }
                    }
                });

                await Promise.all(refreshPromises);
                console.log(`GenieDashboard: Finished refreshing all panels with updated inputConfig`);
            }

            // Mark as loaded
            this.loadedExpertViews.add(expertName);

            // If genie mode is active, recalculate y-axis width to include new expert panels
            if (isGenieActive) {
                console.log(`[appendExpertView] Genie mode is active, recalculating y-axis width after loading expert panels`);
                // Use progressive delays to ensure all charts are rendered
                setTimeout(() => {
                    this.calculateAlignedYAxisRange();
                }, 100);
                setTimeout(() => {
                    this.calculateAlignedYAxisRange();
                }, 500);
                setTimeout(() => {
                    this.calculateAlignedYAxisRange();
                }, 1500);
            }
        }

        /**
         * Check if all input fields (including templating fields) have values
         * @returns {boolean} True if all fields have values, false otherwise
         */
        checkAllInputFieldsHaveValues() {
            // Use the same logic as getMissingInputFields() to ensure consistency
            // Only check templating fields, not standard toolbar fields or time range fields
            const fieldStatus = this.getMissingInputFields();
            return fieldStatus.missing.length === 0;
        }

        /**
         * Get list of input fields that are missing values
         * Only checks templating fields from dashboard config, not toolbar buttons or standard fields
         * @returns {Object} Object with {missing: string[], present: Object} where present maps field names to their values
         */
        getMissingInputFields() {
            const missingFields = [];
            const presentFields = {};

            // Helper function to normalize value to string and check if it's valid
            const normalizeValue = (value) => {
                if (value === null || value === undefined) return '';
                if (typeof value === 'object') {
                    // If it's an array, join it; if it's an object, try to stringify
                    if (Array.isArray(value)) {
                        return value.join(', ');
                    }
                    return JSON.stringify(value);
                }
                return String(value);
            };

            const isValidValue = (valueStr) => {
                if (!valueStr) return false;
                const trimmed = valueStr.trim();
                if (trimmed === '') return false;
                // Check for placeholder/status messages
                if (trimmed === '-- Select --' || trimmed === '-- No endpoint --' ||
                    trimmed === '-- No time range --' || trimmed === '-- Error --' ||
                    trimmed === '-- Waiting for:' || trimmed.startsWith('-- Waiting for:') ||
                    trimmed === 'Loading...' || trimmed === 'Failed' || trimmed === 'No values found') {
                    return false;
                }
                return true;
            };

            // Helper to check if an element is actually an input field (not a button, checkbox, etc.)
            const isActualInputField = (element, varName) => {
                // Check if it's an autocomplete instance (wrapper exists)
                const wrapperId = this.getInstanceId(`toolbar-${varName}-wrapper`);
                const wrapper = document.getElementById(wrapperId);
                if (wrapper) {
                    return true; // Autocomplete wrapper exists, it's a real input field
                }

                // Check element type - must be INPUT or SELECT
                if (element.tagName === 'INPUT') {
                    // Skip buttons, checkboxes, and other non-text inputs
                    const inputType = element.type || '';
                    if (inputType === 'button' || inputType === 'submit' || inputType === 'reset' ||
                        inputType === 'checkbox' || inputType === 'radio' || inputType === 'file') {
                        return false;
                    }
                    return true; // Text input, number, etc.
                }

                if (element.tagName === 'SELECT') {
                    return true; // Select dropdown
                }

                // Not an input field
                return false;
            };

            // Track which fields we've checked to avoid duplicates
            const checkedFields = new Set();

            // ONLY check templating fields from dashboard config
            // Do NOT check standard toolbar fields (Cell, Substrate, etc.) or time range fields (Start, End)
            if (this.dashboardConfig && this.dashboardConfig.templating && this.dashboardConfig.templating.list) {
                // First pass: update placeholder name mappings with label-to-placeholder mappings
                for (const templateVar of this.dashboardConfig.templating.list) {
                    if (!templateVar || !templateVar.name) continue;
                    this.updatePlaceholderNameMappings(templateVar);
                }

                // Second pass: check field values
                for (const templateVar of this.dashboardConfig.templating.list) {
                    if (!templateVar || !templateVar.name) continue;
                    const varName = templateVar.name;
                    const varLabel = templateVar.label || varName;
                    const hide = templateVar.hide || 0;
                    const isHidden = hide === 2;
                    // Note: Hidden fields are still created but hidden with CSS

                    // Skip if we've already checked this field (avoid duplicates)
                    if (checkedFields.has(varName)) {
                        console.warn(`GenieDashboard: Duplicate templating field "${varName}" found in config, skipping duplicate`);
                        continue;
                    }
                    checkedFields.add(varName);

                    const inputId = this.getInstanceId(`toolbar-${varName}`);
                    const wrapperId = this.getInstanceId(`toolbar-${varName}-wrapper`);
                    const wrapper = document.getElementById(wrapperId);
                    const inputElement = document.getElementById(inputId);

                    let value = '';
                    let foundField = false;

                    // Check if it's an autocomplete instance (check wrapper first, then try to find instance)
                    if (wrapper) {
                        // Autocomplete wrapper exists - try to get the instance
                        const autocompleteInstance = this.findAutocompleteInstance(varName);
                        const autocompleteInput = wrapper.querySelector('.autocomplete-input');

                        if (autocompleteInstance && typeof autocompleteInstance.getValue === 'function') {
                            // Try to get value from the instance
                            let instanceValue = autocompleteInstance.getValue();
                            // Normalize array to string
                            if (Array.isArray(instanceValue)) {
                                instanceValue = instanceValue.length > 0 ? instanceValue.join(', ') : '';
                            }
                            value = instanceValue || '';

                            // If instance returns empty, check the input directly (user might have typed manually)
                            if (!value && autocompleteInput && autocompleteInput.value && autocompleteInput.value.trim() !== '') {
                                // Check if input value is not a status message
                                const inputValue = autocompleteInput.value.trim();
                                if (inputValue !== 'Loading...' &&
                                    inputValue !== 'Failed' &&
                                    inputValue !== 'No values found' &&
                                    !inputValue.startsWith('Waiting for:') &&
                                    !inputValue.startsWith('Blocked on')) {
                                    value = inputValue;
                                }
                            }
                            foundField = true;
                        } else if (autocompleteInput) {
                            // Wrapper exists but instance not found - try to get value from the input inside wrapper
                            // Always check the input value first (user might have typed even with status message)
                            if (autocompleteInput.value && autocompleteInput.value.trim() !== '') {
                                const inputValue = autocompleteInput.value.trim();
                                // Check if it's not a status message
                                if (inputValue !== 'Loading...' &&
                                    inputValue !== 'Failed' &&
                                    inputValue !== 'No values found' &&
                                    !inputValue.startsWith('Waiting for:') &&
                                    !inputValue.startsWith('Blocked on')) {
                                    value = inputValue;
                                } else {
                                    // Try to get value from the hidden select
                                    const hiddenSelect = wrapper.querySelector('select[style*="display: none"]');
                                    if (hiddenSelect && hiddenSelect.value) {
                                        value = hiddenSelect.value;
                                    }
                                }
                            } else {
                                // Try to get value from the hidden select
                                const hiddenSelect = wrapper.querySelector('select[style*="display: none"]');
                                if (hiddenSelect && hiddenSelect.value) {
                                    value = hiddenSelect.value;
                                }
                            }
                            foundField = true;
                        }
                    } else if (inputElement && isActualInputField(inputElement, varName)) {
                        // It's a legacy input/select field (not a button)
                        value = inputElement.value || '';
                        foundField = true;
                    }

                    // Process the value if we found the field
                    if (foundField) {
                        // If value is still empty, try one more time to get it from the input directly
                        if (!value || (Array.isArray(value) && value.length === 0)) {
                            const autocompleteInput = wrapper ? wrapper.querySelector('.autocomplete-input') : null;
                            if (autocompleteInput && autocompleteInput.value && autocompleteInput.value.trim() !== '') {
                                const inputValue = autocompleteInput.value.trim();
                                // Make sure it's not a status message
                                if (inputValue !== 'Loading...' &&
                                    inputValue !== 'Failed' &&
                                    inputValue !== 'No values found' &&
                                    inputValue !== 'search or select' &&
                                    !inputValue.startsWith('Waiting for:') &&
                                    !inputValue.startsWith('Blocked on')) {
                                    value = inputValue;
                                }
                            }
                        }

                        const valueStr = normalizeValue(value);
                        if (!isValidValue(valueStr)) {
                            // Debug logging for fields that should have values
                            if (varName === 'pod' || varLabel === 'k8s Pod') {
                                const autocompleteInput = wrapper ? wrapper.querySelector('.autocomplete-input') : null;
                                console.log(`GenieDashboard: [DEBUG] Field "${varLabel}" (${varName}) found but value invalid:`, {
                                    value: value,
                                    valueStr: valueStr,
                                    wrapper: !!wrapper,
                                    autocompleteInstance: !!this.findAutocompleteInstance(varName),
                                    inputElement: !!inputElement,
                                    inputValue: autocompleteInput ? autocompleteInput.value : (inputElement ? inputElement.value : 'N/A'),
                                    inputPlaceholder: autocompleteInput ? autocompleteInput.placeholder : 'N/A'
                                });
                            }
                            missingFields.push(varLabel);
                        } else {
                            presentFields[varLabel] = valueStr;
                        }
                    } else {
                        // Field is expected but doesn't exist in DOM or is not an actual input field
                        if (varName === 'pod' || varLabel === 'k8s Pod') {
                            console.log(`GenieDashboard: [DEBUG] Field "${varLabel}" (${varName}) not found in DOM:`, {
                                wrapper: !!wrapper,
                                inputElement: !!inputElement,
                                inputId: inputId,
                                wrapperId: wrapperId
                            });
                        }
                        missingFields.push(varLabel);
                    }
                }
            }

            // Ensure no field appears in both lists (safety check)
            const missingSet = new Set(missingFields);
            for (const fieldLabel of Object.keys(presentFields)) {
                if (missingSet.has(fieldLabel)) {
                    console.warn(`GenieDashboard: Field "${fieldLabel}" appears in both missing and present lists, removing from missing`);
                    const index = missingFields.indexOf(fieldLabel);
                    if (index > -1) {
                        missingFields.splice(index, 1);
                    }
                }
            }

            return {missing: missingFields, present: presentFields};
        }

        /**
         * Refresh a single panel: clear data, clear view, fetch data, and render
         * @param {Object} panel - The panel configuration object
         * @param {number} panelIndex - The index of the panel in this.panels array
         * @param {HTMLElement} panelDiv - The DOM element for the panel
         * @param {boolean} skipClearing - If true, skip clearing (already cleared by bulk operation)
         * @returns {Promise<Object>} Status object with {success, hasFailures, failedCount, refreshed}
         */
        async refreshSinglePanel(panel, panelIndex, panelDiv, skipClearing = false, showLoadingIndicator = true, dataOnly = false) {
            // SKIP row panels - they are just containers, no data fetching or rendering
            if (!panel || panel.type === 'row') {
                console.log(`[refreshSinglePanel] Skipping row panel "${panel?.title || panel?.id || 'unknown'}" - row panels are containers only`);
                return {success: true, skipped: true};
            }

            if (!panel.targets || panel.targets.length === 0) {
                return {success: true, skipped: true};
            }

            // DATA ONLY MODE: Fetch data and calculate metadata without DOM operations
            if (dataOnly) {
                console.log(`[refreshSinglePanel] Data-only mode for panel ${panelIndex} (${panel.title || panel.id}) - skipping DOM operations`);

                try {
                    // STEP 1: Clear panel data properties
                    panel._previousDataArray = null;
                    panel._currentDataArray = null;
                    panel._statValue = null; // Clear calculated stat value
                    panel._failedTargets = null;
                    panel._fetchInProgress = null;
                    panel._previousDuration = null;
                    panel._compareSelectedOption = null;
                    panel._totalQueryTime = null;
                    panel._renderTime = null;
                    panel._errorContainer = null;
                    panel._loadingContainer = null;
                    panel._pendingStatsTableRender = null;
                    // Clear multi-period data structures
                    panel._previousDataByDuration = null;
                    panel._previousFailedTargetsByDuration = null;
                    panel._statsSeriesDataByDuration = null;
                    panel._previousSeriesDataByDuration = null;

                    // STEP 2: Calculate and store metadata (without DOM)
                    this.calculateAndStorePanelMetadata(panel);

                    // STEP 3: Fetch data (current and previous in parallel if needed)
                    // Use checkFetchInProgress=true to prevent duplicate queries if panel is already fetching
                    // Check if genie check is enabled - if so, fetch all compare options for multi-week comparison
                    const genieCheckbox = document.getElementById(this.getInstanceId('toolbar-genie-checkbox'));
                    const isGenieEnabled = genieCheckbox && genieCheckbox.checked;
                    const fetchAllCompareOptions = isGenieEnabled; // Fetch all compare options when genie is enabled

                    const fetchResult = await this.fetchPanelDataWithCompare(panel, true, fetchAllCompareOptions);
                    const {
                        data,
                        previousData,
                        failedTargets,
                        previousFailedTargets,
                        skippedTargets,
                        previousSkippedTargets
                    } = fetchResult;

                    // STEP 4: Store data on panel object
                    const allSkippedTargets = [...(skippedTargets || []), ...(previousSkippedTargets || [])];
                    const allFailedTargets = [...failedTargets, ...previousFailedTargets];
                    const hasFailures = allFailedTargets.length > 0;
                    const hasSkipped = allSkippedTargets.length > 0;

                    panel._currentDataArray = data;
                    if (previousData) {
                        panel._previousDataArray = previousData;
                    }
                    panel._failedTargets = allFailedTargets;

                    // STEP 5: Process data to calculate chart and stats series data (for dashboard assistant and future rendering)
                    // This ensures the data is ready even if the panel is collapsed
                    try {
                        this.processPanelDataForSeries(panel, data, previousData);
                        console.log(`[refreshSinglePanel] Data-only: Processed series data for panel ${panelIndex} (${panel.title || panel.id})`);
                    } catch (error) {
                        console.error(`[refreshSinglePanel] Data-only: Error processing series data for panel ${panelIndex}:`, error);
                        // Don't fail the whole operation if series processing fails
                    }

                    console.log(`[refreshSinglePanel] Data-only: Completed for panel ${panelIndex} (${panel.title || panel.id}) - data fetched, metadata calculated, series data processed`);

                    return {
                        success: !hasFailures,
                        hasFailures: hasFailures,
                        failedCount: allFailedTargets.length,
                        refreshed: true,
                        dataOnly: true
                    };
                } catch (error) {
                    console.error(`[refreshSinglePanel] Data-only: Error refreshing panel ${panelIndex}:`, error);
                    panel._failedTargets = [{error: error.message}];
                    return {
                        success: false,
                        hasFailures: true,
                        error: error.message,
                        refreshed: true,
                        dataOnly: true
                    };
                }
            }

            try {
                // STEP 1: Clear panel data properties
                panel._previousDataArray = null;
                panel._currentDataArray = null;
                panel._statValue = null; // Clear calculated stat value
                panel._failedTargets = null;
                panel._fetchInProgress = null;
                panel._previousDuration = null;
                panel._compareSelectedOption = null;
                panel._totalQueryTime = null;
                panel._renderTime = null;
                panel._errorContainer = null;
                panel._loadingContainer = null;
                panel._pendingStatsTableRender = null;
                // Clear multi-period data structures
                panel._previousDataByDuration = null;
                panel._previousFailedTargetsByDuration = null;
                panel._statsSeriesDataByDuration = null;
                panel._previousSeriesDataByDuration = null;

                // STEP 2: Clear panel view and destroy charts (only if not already cleared)
                const content = panelDiv ? panelDiv.querySelector('.genie-dashboard-panel-content') : null;
                const header = panelDiv ? panelDiv.querySelector('.genie-dashboard-panel-header') : null;

                if (!skipClearing && content) {
                    // Clear content immediately (synchronous)
                    content.innerHTML = '';

                    // Destroy all possible chart instances
                    const possibleChartIds = [
                        `${this.instanceId}-chart-${panelIndex}`,
                        `chart-${panelIndex}`,
                        `${panelIndex}-chart`,
                        panel.id ? `${this.instanceId}-chart-${panel.id}` : null,
                        panel.id ? `chart-${panel.id}` : null
                    ].filter(id => id !== null);

                    possibleChartIds.forEach(chartId => {
                        if (this.charts && this.charts[chartId]) {
                            try {
                                const chartInstance = this.charts[chartId];
                                if (chartInstance && typeof chartInstance.destroy === 'function') {
                                    chartInstance.destroy();
                                }
                                delete this.charts[chartId];
                            } catch (e) {
                                console.warn('Error destroying chart:', e);
                            }
                        }
                    });

                    // Also destroy any Chart.js instances found on canvas elements
                    if (typeof Chart !== 'undefined') {
                        try {
                            const canvasElements = content.querySelectorAll('canvas');
                            canvasElements.forEach(canvas => {
                                const chartInstance = Chart.getChart(canvas);
                                if (chartInstance && typeof chartInstance.destroy === 'function') {
                                    chartInstance.destroy();
                                }
                            });
                        } catch (e) {
                            console.warn('Error destroying canvas charts:', e);
                        }
                    }

                    // Hide any error messages
                    this.hidePanelError(panel, content);

                    // Show loading indicator if enabled (when clearing, we show it after clearing)
                    if (showLoadingIndicator && content) {
                        this.showPanelLoadingIndicator(panelDiv, content, panel);
                    }
                } else if (skipClearing && showLoadingIndicator && content) {
                    // When skipClearing=true, ensure loading indicator is shown before fetching
                    // (it may have been shown earlier in refreshPanelsDataOnly, but ensure it's visible)
                    this.showPanelLoadingIndicator(panelDiv, content, panel);
                }

                // STEP 3: Fetch data (current and previous in parallel if needed)
                // Check if genie check is enabled - if so, fetch all compare options for multi-week comparison
                const genieCheckbox = document.getElementById(this.getInstanceId('toolbar-genie-checkbox'));
                const isGenieEnabled = genieCheckbox && genieCheckbox.checked;
                const fetchAllCompareOptions = isGenieEnabled; // Fetch all compare options when genie is enabled

                const fetchResult = await this.fetchPanelDataWithCompare(panel, false, fetchAllCompareOptions);
                const {
                    data,
                    previousData,
                    failedTargets,
                    previousFailedTargets,
                    skippedTargets,
                    previousSkippedTargets
                } = fetchResult;

                // STEP 5: Process data and determine render status
                const allSkippedTargets = [...(skippedTargets || []), ...(previousSkippedTargets || [])];
                const allFailedTargets = [...failedTargets, ...previousFailedTargets];
                const hasFailures = allFailedTargets.length > 0;
                const hasSkipped = allSkippedTargets.length > 0;

                // Check if we have any valid data to render
                const hasValidData = data && (Array.isArray(data) ? data.length > 0 : (data !== null && data !== undefined));
                const hasValidPreviousData = previousData && (Array.isArray(previousData) ? previousData.length > 0 : (previousData !== null && previousData !== undefined));
                const shouldRenderData = !hasFailures && (hasValidData || hasValidPreviousData);

                console.log(`[refreshSinglePanel] Panel ${panelIndex} (${panel.title || panel.id}): hasFailures=${hasFailures}, hasValidData=${hasValidData}, hasValidPreviousData=${hasValidPreviousData}, shouldRenderData=${shouldRenderData}, failedTargets=${allFailedTargets.length}, skippedTargets=${allSkippedTargets.length}`);

                // STEP 6: Render new view based on data status
                // Check if this panel is a child of a collapsed row panel (check recursively for nested parents) - if so, skip rendering but keep data
                const isChildOfCollapsedParent = this.hasCollapsedParent(panel);

                if (isChildOfCollapsedParent) {
                    // Parent is collapsed - store data but skip rendering
                    console.log(`[refreshSinglePanel] Panel ${panelIndex} (${panel.title || panel.id}): Parent row panel is collapsed - data fetched but skipping render`);
                    // Store data on panel for when parent is expanded
                    panel._currentDataArray = data;
                    panel._previousDataArray = previousData;
                    panel._failedTargets = allFailedTargets;
                    panel._skippedTargets = allSkippedTargets;
                    // Don't show loading indicator or errors for collapsed children
                    return {
                        success: !hasFailures,
                        hasFailures: hasFailures,
                        failedCount: allFailedTargets.length,
                        refreshed: true,
                        skippedRender: true
                    };
                }

                // Hide loading indicator before showing message
                this.hidePanelLoadingIndicator(panelDiv, panel);

                if (hasFailures) {
                    // If there are failures, show error message
                    if (content) {
                        panel._failedTargets = allFailedTargets;
                        panel._skippedTargets = allSkippedTargets;
                        this.showPanelError(panel, content, allFailedTargets);
                        this.hidePanelSkippedMessage(panel, content);
                        console.log(`[refreshSinglePanel] Panel ${panelIndex}: Showing error`);
                    }
                } else if (hasSkipped && !shouldRenderData) {
                    // If queries were skipped (missing placeholders) and no valid data, show skipped message
                    if (content) {
                        panel._skippedTargets = allSkippedTargets;
                        panel._failedTargets = allFailedTargets;
                        this.showPanelSkippedMessage(panel, content, allSkippedTargets);
                        this.hidePanelError(panel, content);
                        console.log(`[refreshSinglePanel] Panel ${panelIndex}: Showing skipped message`);
                    }
                } else if (!shouldRenderData) {
                    // No failures, no skipped queries, but no valid data - show error
                    if (content) {
                        panel._failedTargets = allFailedTargets;
                        panel._skippedTargets = allSkippedTargets;
                        this.showPanelError(panel, content, allFailedTargets);
                        this.hidePanelSkippedMessage(panel, content);
                        console.log(`[refreshSinglePanel] Panel ${panelIndex}: Showing error (no data, no failures, no skipped)`);
                    }
                } else if (content && shouldRenderData) {
                    // Store data on panel for later use (e.g., when parent row panel is expanded)
                    panel._currentDataArray = data;
                    if (previousData) {
                        panel._previousDataArray = previousData;
                    }
                    panel._failedTargets = allFailedTargets;
                    panel._skippedTargets = allSkippedTargets;

                    // Only render if there are no failures and we have valid data
                    // Pass previousData to renderPanelChart if available
                    const stackTrace = new Error().stack;
                    console.log(`🎨 [refreshSinglePanel] About to call renderPanelChart for panel "${panel.title || panel.id}" (index ${panelIndex}) 🎨`);
                    //console.log(`🎨 [refreshSinglePanel] Call stack:`, stackTrace);
                    this.renderPanelChart(panel, data, content, header, previousData);
                    this.hidePanelError(panel, content);

                    // Show skipped message if there are skipped queries (even if we have some data)
                    if (hasSkipped) {
                        this.showPanelSkippedMessage(panel, content, allSkippedTargets);
                    } else {
                        this.hidePanelSkippedMessage(panel, content);
                    }

                    console.log(`[refreshSinglePanel] Panel ${panelIndex}: Rendering chart with data`);
                } else if (content) {
                    // No data and no failures - content already cleared, just hide errors
                    panel._failedTargets = allFailedTargets;
                    panel._skippedTargets = allSkippedTargets;
                    this.hidePanelError(panel, content);
                    this.hidePanelSkippedMessage(panel, content);
                    console.log(`[refreshSinglePanel] Panel ${panelIndex}: No data, no failures, hiding errors`);
                }

                // Return status indicating if there were failures
                return {
                    success: !hasFailures,
                    hasFailures: hasFailures,
                    failedCount: allFailedTargets.length,
                    refreshed: true
                };
            } catch (error) {
                console.error(`GenieDashboard: Error refreshing panel ${panelIndex}:`, error);
                // Clear the panel view on error
                const content = panelDiv.querySelector('.genie-dashboard-panel-content');
                if (content) {
                    content.innerHTML = '';
                    this.hidePanelError(panel, content);
                }
                return {success: false, hasFailures: true, error: error.message, refreshed: true};
            }
        }

        /**
         * Counts the number of collapsed child panels that need data fetching
         * @returns {number} Number of collapsed child panels
         */
        countCollapsedChildPanels() {
            let count = 0;

            // Find all row panels and their child panels
            Object.entries(this.panels).forEach(([panelId, panel]) => {
                if (panel && panel.type === 'row' && panel.panels && Array.isArray(panel.panels)) {
                    // Check if row panel is collapsed
                    const isCollapsed = panel.collapsed === true ||
                        panel._isCollapsed === true ||
                        panel.collapse === true ||
                        panel.collapse === 'true' ||
                        panel.collapse === 1;

                    if (isCollapsed) {
                        count += panel.panels.length;
                    }
                }
            });

            return count;
        }

        /**
         * Fetches data for collapsed child panels (panels whose parent row panel is collapsed)
         * This is used to ensure data is available for dashboard assistant and when parents are expanded
         * @param {Set} processedPanelIds - Set of panel IDs that have already been processed (to avoid duplicates)
         * @param {Function} progressCallback - Optional callback function called with remaining count as panels complete: (remainingCount) => void
         * @returns {Promise<Array>} Array of results from fetching collapsed child panel data
         */
        async fetchCollapsedChildPanelsData(processedPanelIds = new Set(), progressCallback = null) {
            console.log(`GenieDashboard: [fetchCollapsedChildPanelsData] Starting to fetch data for collapsed child panels`);

            const collapsedChildPanelPromises = [];

            // Find all child panels with collapsed parents by iterating through this.panels
            // This is more reliable than checking allPanelDivs since collapsed children may not have DOM elements
            // First, find all row panels and their child panels
            const rowPanelsWithChildren = [];
            Object.entries(this.panels).forEach(([panelId, panel]) => {
                if (panel && panel.type === 'row' && panel.panels && Array.isArray(panel.panels)) {
                    rowPanelsWithChildren.push({rowPanel: panel, rowPanelId: panelId});
                }
            });

            console.log(`GenieDashboard: [fetchCollapsedChildPanelsData] Found ${rowPanelsWithChildren.length} row panels to check for collapsed children`);

            // For each row panel, check if it's collapsed and process its children
            rowPanelsWithChildren.forEach(({rowPanel, rowPanelId}) => {
                // Check if row panel is collapsed
                const isCollapsed = rowPanel.collapsed === true ||
                    rowPanel._isCollapsed === true ||
                    rowPanel.collapse === true ||
                    rowPanel.collapse === 'true' ||
                    rowPanel.collapse === 1;

                if (isCollapsed && rowPanel.panels && Array.isArray(rowPanel.panels)) {
                    console.log(`GenieDashboard: [fetchCollapsedChildPanelsData] Row panel "${rowPanel.title || rowPanelId}" is collapsed - processing ${rowPanel.panels.length} child panels`);

                    rowPanel.panels.forEach((childPanel) => {
                        if (!childPanel) return;

                        const childPanelId = String(childPanel.id);
                        const wasProcessed = processedPanelIds.has(childPanelId);

                        // Only queue if not already processed
                        if (!wasProcessed) {
                            // Ensure _parentRowPanel is set for hasCollapsedParent to work
                            if (!childPanel._parentRowPanel) {
                                childPanel._parentRowPanel = rowPanel;
                            }

                            const panelIndex = this.panelOrder.normal.indexOf(childPanelId);
                            const panelDiv = childPanel._panelDiv || null; // May be null if parent is collapsed
                            console.log(`GenieDashboard: [fetchCollapsedChildPanelsData] Queuing collapsed child panel "${childPanel.title || childPanel.id}" for data fetch`, {
                                panelId: childPanelId,
                                hasPanelDiv: !!panelDiv,
                                panelIndex: panelIndex,
                                parentRowPanel: rowPanel.title || rowPanelId
                            });

                            // Wrap the promise to track completion and update progress
                            const fetchPromise = this.refreshSinglePanel(childPanel, panelIndex, panelDiv, true, false, true); // dataOnly = true

                            if (progressCallback) {
                                // Track remaining count as each promise completes
                                fetchPromise.finally(() => {
                                    // Count remaining promises that haven't completed yet
                                    const remainingCount = collapsedChildPanelPromises.filter(p => {
                                        // Check if promise is still pending by checking if it's in the array
                                        // We'll use a different approach - track completed count
                                        return true; // This will be updated below
                                    }).length;

                                    // Better approach: count how many are still pending
                                    // Since we can't easily check promise state, we'll use a counter
                                });
                            }

                            collapsedChildPanelPromises.push(fetchPromise);
                        } else {
                            console.log(`GenieDashboard: [fetchCollapsedChildPanelsData] Skipping collapsed child panel "${childPanel.title || childPanel.id}" - already processed`);
                        }
                    });
                }
            });

            console.log(`GenieDashboard: [fetchCollapsedChildPanelsData] Found ${collapsedChildPanelPromises.length} collapsed child panels to fetch data for`);

            // Fetch data for collapsed child panels with progress tracking
            let collapsedResults = [];
            if (collapsedChildPanelPromises.length > 0) {
                console.log(`GenieDashboard: [fetchCollapsedChildPanelsData] Starting data fetch for ${collapsedChildPanelPromises.length} collapsed child panels`);

                if (progressCallback) {
                    // Track progress as promises complete
                    let completedCount = 0;
                    const totalCount = collapsedChildPanelPromises.length;

                    // Wrap each promise to track completion
                    const trackedPromises = collapsedChildPanelPromises.map((promise, index) => {
                        return promise.finally(() => {
                            completedCount++;
                            const remainingCount = totalCount - completedCount;
                            progressCallback(remainingCount);
                        });
                    });

                    collapsedResults = await Promise.all(trackedPromises);
                } else {
                    collapsedResults = await Promise.all(collapsedChildPanelPromises);
                }

                console.log(`GenieDashboard: [fetchCollapsedChildPanelsData] Completed fetching data for collapsed child panels`);
            } else {
                console.log(`GenieDashboard: [fetchCollapsedChildPanelsData] No collapsed child panels to fetch`);
            }

            return collapsedResults;
        }

        async refreshPanelsDataOnly(showLoadingIndicator = true, runQueries = false) {
            const stackTrace = new Error().stack;
            console.log(`🔵🔵🔵 GenieDashboard: [START] refreshPanelsDataOnly() called - runQueries: ${runQueries} 🔵🔵🔵`);
            console.log(`🔵🔵🔵 Stack trace:`, stackTrace);

            // Check if refresh is already in progress
            if (this._refreshPanelsInProgress) {
                console.log(`🔵🔵🔵 GenieDashboard: refreshPanelsDataOnly() already in progress, skipping duplicate call`);
                return;
            }

            // Clear any pending auto-refresh timeout to prevent it from executing after this manual refresh
            if (this._autoRefreshTimeout) {
                clearTimeout(this._autoRefreshTimeout);
                this._autoRefreshTimeout = null;
                console.log(`🔵🔵🔵 GenieDashboard: Cleared pending auto-refresh timeout`);
            }
            // Also reset the auto-refresh flag if it was set
            if (this._autoRefreshInProgress) {
                this._autoRefreshInProgress = false;
                console.log(`🔵🔵🔵 GenieDashboard: Reset _autoRefreshInProgress flag (manual refresh taking over)`);
            }

            // Set flag to prevent concurrent refreshes
            this._refreshPanelsInProgress = true;
            console.log(`🔵🔵🔵 GenieDashboard: Set _refreshPanelsInProgress = true`);

            const refreshButton = document.getElementById(this.getInstanceId('controls-refresh-button'));
            if (refreshButton) {
                refreshButton.disabled = true;
                refreshButton.innerHTML = '<span>⏳</span>';
                refreshButton.title = 'Refreshing panels...';
            }

            try {
                // STEP 1: Conditionally re-execute templating queries (only if runQueries is true)
                // When called from controls refresh button: runQueries = false (don't run queries)
                // When called from time range change or dashboard toolbar refresh: runQueries = true (run queries)
                if (runQueries) {
                    // Use unified refreshInputFields function (reuses inputFieldsManager)
                    // This ensures consistent behavior: dependency order, status updates, and query execution
                    const controlsRow = this.container.querySelector(`.genie-dashboard-controls-row`) || document.getElementById(this.getInstanceId('controls-row'));
                    if (controlsRow) {
                        await window.refreshInputFields(this, controlsRow, this.dashboardConfig, this.inputConfig, this.instanceId, false);
                    }
                } else {
                    console.log(`GenieDashboard: [STEP 1] Skipping query execution (runQueries = false)`);
                }

                // STEP 2: Update inputConfig from all input fields (read current values only)
                // This ensures values selected in dropdowns (populated by queries) are synced to inputConfig
                console.log(`GenieDashboard: [STEP 2] Updating inputConfig from input fields`);

                // Update inputConfig from all input fields before refreshing
                // Use centralized method to avoid duplication
                // Hardcoded field updates removed - using template-only approach

                // Time range - ensure current values are in inputConfig
                const startValue = this.getInputConfigValue('Start', this.inputConfig) || this.getInputConfigValue('start', this.inputConfig) || this.inputConfig?.['$start'];
                const endValue = this.getInputConfigValue('End', this.inputConfig) || this.getInputConfigValue('end', this.inputConfig) || this.inputConfig?.['$end'];
                if (startValue && endValue) {
                    this.setInputConfigValue('Start', startValue, ['$start']);
                    this.setInputConfigValue('End', endValue, ['$end']);
                }

                // Update inputConfig from all templating input fields (dynamically added fields)
                if (this.dashboardConfig && this.dashboardConfig.templating && this.dashboardConfig.templating.list) {
                    console.log(`📋 Updating inputConfig from ${this.dashboardConfig.templating.list.length} templating variables`);
                    this.dashboardConfig.templating.list.forEach(templateVar => {
                        if (!templateVar || !templateVar.name) return;
                        const varName = templateVar.name;
                        const varLabel = templateVar.label || varName;

                        // Find the input field for this templating variable
                        const inputId = this.getInstanceId(`toolbar-${varName}`);
                        const inputElement = document.getElementById(inputId);

                        if (inputElement) {
                            const value = inputElement.value || inputElement.textContent || '';
                            if (value) {
                                // Generate possible placeholder names for this variable
                                const possiblePlaceholders = [
                                    `$${varName}`,
                                    `$${varName.toLowerCase()}`,
                                    `$${varName.toUpperCase()}`
                                ];
                                console.log(`  ${varName} (${varLabel}): "${value}" → placeholders: [${possiblePlaceholders.join(', ')}]`);
                                this.setInputConfigValue(varLabel, value, possiblePlaceholders);
                            } else {
                                console.log(`  ${varName} (${varLabel}): No value found in input field ${inputId}`);
                            }
                        } else {
                            console.log(`  ${varName} (${varLabel}): Input field not found: ${inputId}`);
                        }
                    });
                } else {
                    console.log(`📋 No templating variables found in dashboardConfig.templating.list`);
                }

                // Log current inputConfig state for debugging
                console.log(`📋 Current inputConfig placeholders:`, Object.keys(this.inputConfig || {}).filter(k => k.startsWith('$')));

                // STEP 3: Check if all input fields have values before refreshing panels
                const allFieldsHaveValues = this.checkAllInputFieldsHaveValues();
                if (!allFieldsHaveValues) {
                    const fieldStatus = this.getMissingInputFields();
                    const missingFields = fieldStatus.missing;
                    const presentFields = fieldStatus.present;

                    // Build detailed log message
                    let logMessage = `GenieDashboard: Not all input fields have values selected. Panels will not be refreshed until all fields are filled.\n`;
                    logMessage += `  Missing fields (${missingFields.length}): ${missingFields.length > 0 ? missingFields.join(', ') : 'none'}\n`;

                    if (Object.keys(presentFields).length > 0) {
                        logMessage += `  Present fields (${Object.keys(presentFields).length}):\n`;
                        for (const [fieldName, fieldValue] of Object.entries(presentFields)) {
                            // Truncate long values for readability
                            const displayValue = fieldValue.length > 50 ? fieldValue.substring(0, 50) + '...' : fieldValue;
                            logMessage += `    - ${fieldName}: "${displayValue}"\n`;
                        }
                    }

                    console.log(logMessage);

                    if (refreshButton) {
                        refreshButton.disabled = false;
                        refreshButton.innerHTML = '<span>🔄</span>';
                        refreshButton.title = 'Refresh panels';
                    }
                    return; // Exit early - don't refresh panels
                }

                // STEP 4: Clear all panel data properties (reset panel state)
                console.log(`GenieDashboard: [STEP 4] Clearing all panel data properties`);
                let grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
                if (!grid) {
                    console.error(`GenieDashboard: Grid container not found! dashboardGrid=${!!this.dashboardGrid}, gridId=${this.getInstanceId('grid')}`);
                } else {
                    console.log(`GenieDashboard: Grid container found`);
                    const allPanelDivs = grid.querySelectorAll('.genie-dashboard-panel');
                    console.log(`GenieDashboard: Found ${allPanelDivs.length} panel divs in grid`);
                    allPanelDivs.forEach((panelDiv) => {
                        const panelId = panelDiv.id;
                        const expectedIdPrefix = this.getInstanceId('panel-');
                        if (!panelId.startsWith(expectedIdPrefix)) {
                            return; // Skip if ID format doesn't match
                        }

                        const extractedPanelId = panelId.substring(expectedIdPrefix.length);
                        // extractedPanelId is now the stable panel ID (e.g., "p1", "p2")
                        const panel = this.panels[extractedPanelId];

                        if (panel) {

                            // Clear panel data (reset all panel state)
                            if (panel) {
                                panel._previousDataArray = null;
                                panel._currentDataArray = null;
                                panel._statValue = null; // Clear calculated stat value
                                panel._failedTargets = null;
                                panel._fetchInProgress = null;
                                panel._previousDuration = null;
                                panel._compareSelectedOption = null;
                                panel._totalQueryTime = null;
                                panel._renderTime = null;
                                panel._errorContainer = null;
                                panel._loadingContainer = null;
                                panel._pendingStatsTableRender = null;
                                // Clear multi-period data structures
                                panel._previousDataByDuration = null;
                                panel._previousFailedTargetsByDuration = null;
                                panel._statsSeriesDataByDuration = null;
                                panel._previousSeriesDataByDuration = null;
                                // Clear zoom range (slider positions)
                                panel._zoomRange = {min: null, max: null};
                            }
                        }
                    });
                }

                // STEP 4: Clear all panel views and destroy all charts (SYNCHRONOUS - before any async operations)
                console.log(`🟢🟢🟢 GenieDashboard: [STEP 4] Clearing all panel views and destroying charts 🟢🟢🟢`);
                if (!grid) {
                    grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
                }
                if (!grid) {
                    console.error(`🔴🔴🔴 GenieDashboard: [STEP 4 ERROR] Grid not found! Cannot clear panels. dashboardGrid=${!!this.dashboardGrid}, gridId=${this.getInstanceId('grid')} 🔴🔴🔴`);
                    // Try to find grid in container - always use this.container to support multiple dashboard instances
                    const container = this.container;
                    if (container) {
                        grid = container.querySelector('.genie-dashboard-grid') || container.querySelector(`#${this.getInstanceId('grid')}`);
                        console.log(`GenieDashboard: [STEP 3] Found grid via container: ${!!grid}`);
                    }
                }
                if (!grid) {
                    console.error(`🔴🔴🔴 GenieDashboard: [STEP 3 FATAL] Still no grid found! Panels will NOT be cleared! 🔴🔴🔴`);
                } else {
                    const allPanelDivs = grid.querySelectorAll('.genie-dashboard-panel');
                    console.log(`GenieDashboard: [STEP 3] Found ${allPanelDivs.length} panels to clear`);
                    let clearedCount = 0;
                    allPanelDivs.forEach((panelDiv, divIndex) => {
                        // Try multiple methods to find the panel index
                        let panelIndex = -1;
                        let panel = null;

                        // Method 1: Check panelDiv.id - extract stable panel ID
                        const panelId = panelDiv.id;
                        if (panelId) {
                            const expectedIdPrefix = this.getInstanceId('panel-');
                            if (panelId.startsWith(expectedIdPrefix)) {
                                const extractedPanelId = panelId.substring(expectedIdPrefix.length);
                                // extractedPanelId is now the stable panel ID (e.g., "p1", "p2")
                                panel = this.panels[extractedPanelId];
                                if (panel) {
                                    panelIndex = this.panelOrder.normal.indexOf(extractedPanelId);
                                }
                            }
                        }

                        // Method 2: Check stored _panelObject
                        if (!panel && panelDiv._panelObject) {
                            panel = panelDiv._panelObject;
                            panelIndex = this.panelOrder.normal.indexOf(String(panel.id));
                        }

                        // Method 3: Try to match by panel._panelDiv reference
                        if (!panel) {
                            this.panelOrder.normal.forEach((pid, idx) => {
                                const p = this.panels[pid];
                                if (p && p._panelDiv === panelDiv) {
                                    panel = p;
                                    panelIndex = idx;
                                }
                            });
                        }

                        // Method 4: Use divIndex as fallback (if panels are in order)
                        if (!panel && divIndex >= 0 && divIndex < this.panelOrder.normal.length) {
                            const pid = this.panelOrder.normal[divIndex];
                            panel = this.panels[pid];
                            panelIndex = divIndex;
                        }

                        // SKIP row panels - they are just containers, no data fetching or rendering
                        if (panel && panel.type === 'row') {
                            console.log(`GenieDashboard: [STEP 3] Skipping row panel "${panel.title || panel.id}" - row panels are containers only, no data fetching`);
                            return; // Skip this panel
                        }

                        // SKIP child panels if their parent row panel is collapsed
                        // Children should not be processed at all if parent is collapsed
                        if (panel && this.hasCollapsedParent(panel)) {
                            console.log(`GenieDashboard: [STEP 3] Skipping child panel "${panel.title || panel.id}" - parent row panel is collapsed`);
                            return; // Skip this panel entirely
                        }

                        // Now try to clear the content
                        const content = panelDiv.querySelector('.genie-dashboard-panel-content');

                        if (content) {
                            // Reset slider positions before clearing (if sliders exist)
                            if (panel) {
                                // Reset zoom range
                                panel._zoomRange = {min: null, max: null};

                                // Reset slider input values if they exist
                                const sliderMin = content.querySelector('.genie-dashboard-zoom-slider-min');
                                const sliderMax = content.querySelector('.genie-dashboard-zoom-slider-max');
                                if (sliderMin) {
                                    sliderMin.value = '0';
                                }
                                if (sliderMax) {
                                    sliderMax.value = '100';
                                }
                            }

                            // Clear content immediately (synchronous) - THIS MUST HAPPEN FIRST
                            const beforeClear = content.innerHTML.length;
                            content.innerHTML = '';
                            clearedCount++;
                            console.log(`GenieDashboard: [STEP 3] Cleared panel ${panelIndex >= 0 ? panelIndex : 'unknown'} (${panel?.title || panel?.id || 'unknown'}) - content length: ${beforeClear} -> 0`);

                            // Show loading indicator in the center of the panel (if enabled)
                            // (We already checked for collapsed parent above, so this panel should be visible)
                            if (showLoadingIndicator) {
                                this.showPanelLoadingIndicator(panelDiv, content, panel);
                            }

                            // Destroy all possible chart instances
                            if (panelIndex >= 0) {
                                const possibleChartIds = [
                                    `${this.instanceId}-chart-${panelIndex}`,
                                    `chart-${panelIndex}`,
                                    `${panelIndex}-chart`,
                                    panel?.id ? `${this.instanceId}-chart-${panel.id}` : null,
                                    panel?.id ? `chart-${panel.id}` : null
                                ].filter(id => id !== null);

                                let destroyedCharts = 0;
                                possibleChartIds.forEach(chartId => {
                                    if (this.charts && this.charts[chartId]) {
                                        try {
                                            const chartInstance = this.charts[chartId];
                                            if (chartInstance && typeof chartInstance.destroy === 'function') {
                                                chartInstance.destroy();
                                                destroyedCharts++;
                                            }
                                            delete this.charts[chartId];
                                        } catch (e) {
                                            console.warn('Error destroying chart:', e);
                                        }
                                    }
                                });

                                if (destroyedCharts > 0) {
                                    console.log(`GenieDashboard: Destroyed ${destroyedCharts} chart(s) for panel ${panelIndex}`);
                                }
                            }

                            // Also destroy any Chart.js instances found on canvas elements (works regardless of panelIndex)
                            if (typeof Chart !== 'undefined') {
                                try {
                                    const canvasElements = content.querySelectorAll('canvas');
                                    let destroyedCanvasCharts = 0;
                                    canvasElements.forEach(canvas => {
                                        const chartInstance = Chart.getChart(canvas);
                                        if (chartInstance && typeof chartInstance.destroy === 'function') {
                                            chartInstance.destroy();
                                            destroyedCanvasCharts++;
                                        }
                                    });
                                    if (destroyedCanvasCharts > 0) {
                                        console.log(`GenieDashboard: Destroyed ${destroyedCanvasCharts} canvas chart(s)`);
                                    }
                                } catch (e) {
                                    console.warn('Error destroying canvas charts:', e);
                                }
                            }

                            // Hide any error messages
                            if (panel) {
                                this.hidePanelError(panel, content);
                            }
                        } else {
                            console.warn(`GenieDashboard: [STEP 3] Panel content element not found for panelDiv at index ${divIndex}`);
                        }
                    });
                    console.log(`GenieDashboard: [STEP 3 COMPLETE] Cleared ${clearedCount} of ${allPanelDivs.length} panels`);
                }

                console.log(`GenieDashboard: [STEP 3 COMPLETE] All panels cleared, now fetching data`);

                // STEP 4 & 5: Get grid container and start fetching data (then render)
                if (!grid) {
                    grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
                    if (!grid) {
                        console.error('GenieDashboard: [ERROR] Grid container not found for panel refresh');
                        return;
                    }
                }

                // Get all panel divs for the refresh loop
                const allPanelDivs = grid.querySelectorAll('.genie-dashboard-panel');
                console.log(`GenieDashboard: [STEP 4] Starting to fetch data for ${allPanelDivs.length} panels`);

                // NOW: Refresh all panels independently (each panel refreshes in parallel)
                // All panels are already cleared above, so queries can start

                // Track which panels are processed in visible phase to avoid duplicates in deferred phase
                const processedPanelIds = new Set();

                // PRIORITY 1: Process visible/needed panels first (panels that have DOM elements)
                const visiblePanelPromises = Array.from(allPanelDivs).map(async (panelDiv) => {
                    // Extract panel index from panel ID (format: {instanceId}-panel-{index})
                    const panelId = panelDiv.id;
                    const expectedIdPrefix = this.getInstanceId('panel-');
                    if (!panelId.startsWith(expectedIdPrefix)) {
                        return {success: true, skipped: true}; // Skip if ID format doesn't match
                    }

                    const extractedPanelId = panelId.substring(expectedIdPrefix.length);
                    // extractedPanelId could be:
                    // - For normal panels: "p1", "p2", etc. (stable panel ID)
                    // - For child panels: "row-{parentId}-child-{childIndex}" (temporary ID used during render)

                    // Try to find panel by extracted ID first (works for normal panels)
                    let panel = this.panels[extractedPanelId];

                    // If not found and it looks like a child panel ID, try to find by stored panel object reference
                    if (!panel && extractedPanelId.startsWith('row-') && extractedPanelId.includes('-child-')) {
                        // This is a child panel - try to find it by stored reference
                        if (panelDiv._panelObject) {
                            panel = panelDiv._panelObject;
                            console.log(`GenieDashboard: [STEP 4] Found child panel by _panelObject reference: "${panel.title || panel.id}" (DOM ID: ${extractedPanelId})`);
                        } else {
                            // Try to find child panel by searching all panels for one with matching _panelDiv
                            for (const [panelKey, panelObj] of Object.entries(this.panels)) {
                                if (panelObj && panelObj._panelDiv === panelDiv) {
                                    panel = panelObj;
                                    console.log(`GenieDashboard: [STEP 4] Found child panel by _panelDiv match: "${panel.title || panel.id}" (key: ${panelKey}, DOM ID: ${extractedPanelId})`);
                                    break;
                                }
                            }
                        }
                    }

                    if (panel) {
                        // Get index in panelOrder for backward compatibility with refreshSinglePanel
                        // For child panels, this will be -1 (they're not in panelOrder.normal)
                        const panelIndex = this.panelOrder.normal.indexOf(String(panel.id));

                        // SKIP row panels - they are just containers, no data fetching or rendering
                        if (panel.type === 'row') {
                            console.log(`GenieDashboard: [STEP 4] Skipping row panel "${panel.title || panel.id}" - row panels are containers only, no data fetching`);
                            return {success: true, skipped: true};
                        }

                        // SKIP child panels with collapsed parents in priority phase - they'll be processed later
                        if (this.hasCollapsedParent(panel)) {
                            // Mark as processed so we don't duplicate in deferred phase
                            processedPanelIds.add(String(panel.id));
                            return {success: true, skipped: true, isCollapsedChild: true};
                        }

                        // Mark panel as processed
                        processedPanelIds.add(String(panel.id));

                        // Use the modular refreshSinglePanel function
                        // skipClearing=true because we already cleared all panels synchronously in STEP 3
                        // Pass showLoadingIndicator parameter so refreshSinglePanel knows whether to show loading indicators
                        // panelIndex can be -1 for child panels, which is OK - refreshSinglePanel handles it
                        return await this.refreshSinglePanel(panel, panelIndex, panelDiv, true, showLoadingIndicator);
                    } else {
                        console.warn(`GenieDashboard: [STEP 4] Panel not found for DOM ID "${extractedPanelId}" - skipping refresh`);
                        return {success: true, skipped: true};
                    }
                });

                // PRIORITY 1: Wait for visible/needed panels to complete first
                console.log(`GenieDashboard: [STEP 4] Fetching data for ${visiblePanelPromises.length} visible panels (priority phase)`);
                const visibleResults = await Promise.all(visiblePanelPromises);
                console.log(`GenieDashboard: [STEP 4] Completed fetching data for visible panels`);

                // PRIORITY 2: After visible panels complete, fetch data for collapsed child panels
                // This ensures data is available for dashboard assistant and when parent is expanded
                const collapsedResults = await this.fetchCollapsedChildPanelsData(processedPanelIds);

                // Combine results from both phases
                const results = [...visibleResults, ...collapsedResults];
                console.log(`GenieDashboard: [STEP 5] Finished refreshing all panels`);

                // Count successful, failed, and skipped panels
                // A panel is "refreshed" if we attempted to fetch data for it (has refreshed: true or no skipped flag)
                const refreshedPanels = results.filter(r => r && (r.refreshed === true || (!r.skipped && r !== undefined))).length;
                const successfulPanels = results.filter(r => r && r.success && r.refreshed).length;
                const failedPanels = results.filter(r => r && r.hasFailures && r.refreshed).length;
                const skippedPanels = results.filter(r => r && r.skipped).length;

                console.log(`GenieDashboard: Refresh results - refreshed: ${refreshedPanels}, successful: ${successfulPanels}, failed: ${failedPanels}, skipped: ${skippedPanels}`);

                // Show toast message after all panels have completed refreshing
                try {
                    // Try to get toastMessage and toastType - they might be in window or global scope
                    const toastMessageFunc = window.toastMessage || (typeof toastMessage !== 'undefined' ? toastMessage : null);
                    // toastType might not be on window, try to access it safely
                    let toastTypeObj = null;
                    try {
                        toastTypeObj = window.toastType || (typeof toastType !== 'undefined' ? toastType : null);
                    } catch (e) {
                        // toastType not accessible, define constants directly
                        toastTypeObj = {INFO: 1, WARNING: 2, ERROR: 3};
                    }

                    // If still null, use hardcoded values
                    if (!toastTypeObj) {
                        toastTypeObj = {INFO: 1, WARNING: 2, ERROR: 3};
                    }

                    if (typeof toastMessageFunc === 'function' && toastTypeObj && typeof toastTypeObj === 'object') {
                        if (refreshedPanels === 0) {
                            // No panels were refreshed
                            toastMessageFunc(toastTypeObj.INFO, `No panels to refresh`);
                        } else if (failedPanels === 0 && successfulPanels > 0) {
                            // All panels refreshed successfully
                            toastMessageFunc(toastTypeObj.INFO, `Successfully refreshed ${refreshedPanels} panel${refreshedPanels !== 1 ? 's' : ''}`);
                        } else if (failedPanels > 0 && successfulPanels > 0) {
                            // Some panels had failures
                            toastMessageFunc(toastTypeObj.WARNING, `Refreshed ${refreshedPanels} panel${refreshedPanels !== 1 ? 's' : ''}: ${successfulPanels} succeeded, ${failedPanels} with errors`);
                        } else if (failedPanels > 0 && successfulPanels === 0) {
                            // All panels had failures
                            toastMessageFunc(toastTypeObj.ERROR, `Failed to refresh ${failedPanels} panel${failedPanels !== 1 ? 's' : ''}`);
                        } else {
                            // Fallback: at least we tried to refresh
                            toastMessageFunc(toastTypeObj.INFO, `Refreshed ${refreshedPanels} panel${refreshedPanels !== 1 ? 's' : ''}`);
                        }
                        console.log(`GenieDashboard: Toast message displayed`);
                    } else {
                        // Fallback: use console if toast is not available
                        console.warn(`GenieDashboard: toastMessage not available. toastMessageFunc=${typeof toastMessageFunc}, toastTypeObj=${typeof toastTypeObj}`);
                        console.log(`GenieDashboard: Refreshed ${refreshedPanels} panel${refreshedPanels !== 1 ? 's' : ''} - ${successfulPanels} succeeded, ${failedPanels} with errors`);
                    }
                } catch (toastError) {
                    console.error(`GenieDashboard: Error showing toast message:`, toastError);
                    console.log(`GenieDashboard: Refreshed ${refreshedPanels} panel${refreshedPanels !== 1 ? 's' : ''} - ${successfulPanels} succeeded, ${failedPanels} with errors`);
                }
            } catch (error) {
                console.error('🔵🔵🔵 GenieDashboard: Error refreshing panels:', error);
            } finally {
                // Clear the flag to allow future refreshes
                console.log(`🔵🔵🔵 GenieDashboard: [FINALLY] Setting _refreshPanelsInProgress = false`);
                this._refreshPanelsInProgress = false;

                if (refreshButton) {
                    refreshButton.disabled = false;
                    refreshButton.innerHTML = '<span>🔄</span>';
                    refreshButton.title = 'Refresh panels';
                }
            }
        }

        /**
         * Find panel object from panel element
         * @param {HTMLElement} panelElement - Panel DOM element
         * @returns {{panel: Object, panelIndex: number}|null}
         */
        findPanelFromElement(panelElement) {
            if (typeof PanelStateManager === 'undefined' || !PanelStateManager.findPanelFromElement) {
                throw new Error('GenieDashboard: PanelStateManager module is required but not loaded. Please ensure PanelStateManager.js is included before genieDashboard.js');
            }
            const panelOrder = this.panelRegistry ? this.panelRegistry.panelOrder : this.panelOrder;
            const panels = this.panelRegistry ? this.panelRegistry.panels : this.panels;
            return PanelStateManager.findPanelFromElement(panelElement, panelOrder, panels, () => this.getInstanceId());
        }

        /**
         * Remove a single panel element from DOM and destroy its chart
         * @param {HTMLElement} panelElement - Panel DOM element to remove
         */
        removePanelElement(panelElement, expertName = null) {
            const panelId = panelElement.id;

            // Find the panel object to get its normalized ID
            const panelResult = this.findPanelFromElement(panelElement);
            const panel = panelResult ? panelResult.panel : null;

            // CRITICAL: Verify this panel actually belongs to the expert before removing
            // This prevents deleting charts from other panels that might have been incorrectly identified
            if (expertName && panel && panel._expertName !== expertName) {
                console.warn(`[removePanelElement] Panel "${panel.title || panel.id}" does not belong to expert "${expertName}" (has _expertName="${panel._expertName}"), skipping chart deletion`);
                // Still remove from DOM, but don't delete chart
                if (panelElement.parentNode) {
                    panelElement.remove();
                    console.log(`[removePanelElement] Removed panel element from DOM: ${panelId} (but preserved chart - wrong expert)`);
                }
                return;
            }

            // Remove from DOM first
            if (panelElement.parentNode) {
                panelElement.remove();
                console.log(`[removePanelElement] Removed panel element from DOM: ${panelId}`);
            }

            // Destroy chart using ONLY panel.id (normalized) as the key
            // CRITICAL: Only delete if expertName is provided AND panel belongs to that expert
            // This is a final safety check to prevent deleting charts from wrong panels
            if (panel && this.charts && expertName) {
                // Final verification: panel must belong to this expert
                if (panel._expertName !== expertName) {
                    console.error(`[removePanelElement] CRITICAL: Attempted to delete chart for panel "${panel.title || panel.id}" (id: ${panel.id}) that does NOT belong to expert "${expertName}" (has _expertName="${panel._expertName}"). Chart deletion ABORTED.`);
                    return; // Don't delete chart - this is a safety measure
                }

                const chartKey = String(panel.id);
                if (this.charts[chartKey]) {
                    const chart = this.charts[chartKey];
                    if (chart && typeof chart.destroy === 'function') {
                        chart.destroy();
                    }
                    delete this.charts[chartKey];
                    console.log(`[removePanelElement] Destroyed chart for key: ${chartKey} (panel: ${panel.title || panel.id || 'unknown'}, expert: ${panel._expertName || 'none'})`);
                } else {
                    // Chart not found with panel.id - log for debugging but don't try DOM ID
                    console.warn(`[removePanelElement] Chart not found for panel.id="${chartKey}" (panel: ${panel.title || panel.id || 'unknown'})`);
                }
            } else if (!panel) {
                // Panel object not found - this shouldn't happen, but log it
                console.warn(`[removePanelElement] Panel object not found for element: ${panelId}, cannot safely remove chart`);
            } else if (!expertName) {
                // No expert name provided - this is unsafe, don't delete chart
                console.warn(`[removePanelElement] No expertName provided, skipping chart deletion for safety (panel: ${panel?.title || panel?.id || 'unknown'})`);
            }
        }

        /**
         * Remove child panels of a row panel that belong to an expert
         * @param {Object} rowPanel - Row panel object
         * @param {string} expertName - Expert name to filter by
         * @returns {Set<Object>} Set of child panels that were removed
         */
        removeRowPanelChildren(rowPanel, expertName, expertPanelIds = null) {
            const removedChildren = new Set();

            if (!rowPanel.panels || !Array.isArray(rowPanel.panels)) {
                return removedChildren;
            }

            // Filter out child panels that belong to the expert
            rowPanel.panels = rowPanel.panels.filter(childPanel => {
                if (childPanel._expertName === expertName) {
                    // Use the exact childPanel.id as stored (should already be normalized)
                    const childChartKey = String(childPanel.id);
                    console.log(`[removeRowPanelChildren] Removing child panel "${childPanel.title || childPanel.id}" (id: ${childPanel.id}, chartKey: ${childChartKey})`);

                    // Collect panel ID for chart deletion - use exact chart key
                    if (expertPanelIds !== null) {
                        expertPanelIds.add(childChartKey);
                    }

                    // Remove child panel div if it exists - just remove DOM, chart deletion handled separately
                    if (childPanel._panelDiv && childPanel._panelDiv.parentNode) {
                        childPanel._panelDiv.remove();
                        console.log(`[removeRowPanelChildren] Removed DOM element for child panel: ${childChartKey}`);
                    }

                    removedChildren.add(childPanel);
                    return false; // Remove from array
                }
                return true; // Keep in array
            });

            // Update _childPanelDivs array
            if (rowPanel._childPanelDivs) {
                rowPanel._childPanelDivs = rowPanel._childPanelDivs.filter(div => {
                    if (div && div.getAttribute('data-expert-name') === expertName) {
                        if (div.parentNode) {
                            div.remove();
                        }
                        return false;
                    }
                    return true;
                });
            }

            return removedChildren;
        }

        /**
         * Remove panels from the panels object by their IDs
         * @param {Array<string>} panelIds - Array of panel IDs to remove
         */
        removePanelsFromArray(panelIds) {
            // With stable IDs, we remove by panel ID, not array index
            const uniquePanelIds = Array.from(new Set(panelIds.map(id => String(id))));
            console.log(`[removePanelsFromArray] Removing ${uniquePanelIds.length} panels (IDs: ${uniquePanelIds.join(', ')})`);

            uniquePanelIds.forEach(panelId => {
                const panel = this.panels[panelId];
                if (panel) {
                    console.log(`[removePanelsFromArray] Removing panel "${panelId}": "${panel?.title || panel?.id}" (type: ${panel?.type || 'unknown'})`);
                    this.removePanel(panelId);
                }
            });
        }

        /**
         * Remove expert view panels from dashboard (modularized)
         */
        async removeExpertView(expertName) {
            console.log(`[removeExpertView] Starting removal of expert view: "${expertName}"`);

            // Check if expert is in loadedExpertViews - if not, log but continue anyway
            // (expert might have been loaded but not properly tracked, or user unchecked it)
            if (!this.loadedExpertViews.has(expertName)) {
                console.log(`[removeExpertView] Expert view "${expertName}" not in loadedExpertViews, but continuing removal anyway`);
            }
            
            // If expert view is not in cache, we can't get its config, but we can still remove panels
            if (!this.expertViews[expertName]) {
                console.warn(`[removeExpertView] Expert view "${expertName}" not found in cache, but will attempt to remove panels with _expertName="${expertName}"`);
                // Don't return - continue to remove panels even without cache
            }

            // Clear chat history when unloading expert (data is changing)
            this.clearChatHistory();
            const expertData = this.expertViews[expertName];
            const expertConfig = expertData ? expertData.config : null;

            // CRITICAL: Do NOT call flattenPanels here - that would ADD panels instead of removing them!
            // Instead, we'll count expert panels by checking _expertName in existing this.panels
            let expertPanelCount = 0;
            this.panelOrder.normal.forEach((panelId) => {
                const panel = this.panels[panelId];
                if (panel && panel._expertName === expertName) {
                    expertPanelCount++;
                    // Also count child panels in row panels
                    if (panel.type === 'row' && panel.panels && Array.isArray(panel.panels)) {
                        panel.panels.forEach((childPanel) => {
                            if (childPanel && childPanel._expertName === expertName) {
                                expertPanelCount++;
                            }
                        });
                    }
                }
            });

            console.log(`[removeExpertView] Found ${expertPanelCount} expert panels to remove`);

            // Find panel elements that belong to this expert using data attribute
            const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
            if (!grid) {
                console.error(`[removeExpertView] Grid not found!`);
                return;
            }

            // CRITICAL: Collect expert panel IDs DIRECTLY from this.panels object BEFORE any DOM operations
            // This is the ONLY reliable way to identify expert panels - don't rely on DOM lookups
            // Charts are stored as this.charts[String(panel.id)], so we must use the EXACT panel.id values
            const expertPanelIds = new Set(); // Panel IDs that belong to this expert (exact chart keys)

            // First pass: Iterate through panelOrder.normal to find ALL panels belonging to this expert
            // This is the source of truth - we check panel._expertName directly
            // IMPORTANT: Use the EXACT panel.id value (as string) that was used to store the chart
            // CRITICAL: Double-check that panel._expertName exactly matches expertName (strict equality)
            this.panelOrder.normal.forEach((panelId) => {
                const panel = this.panels[panelId];
                if (!panel) return;

                // STRICT CHECK: panel._expertName must exactly equal expertName (no type coercion)
                if (panel._expertName === expertName) {
                    // Use the exact panel.id as stored (should already be a string, but ensure it)
                    const chartKey = String(panel.id);
                    expertPanelIds.add(chartKey);
                    console.log(`[removeExpertView] ✓ Verified expert panel: "${panel.title || panel.id}" (id: ${panel.id}, chartKey: ${chartKey}, _expertName: "${panel._expertName}")`);
                } else if (panel._expertName) {
                    // Log panels that have _expertName but don't match (for debugging)
                    console.log(`[removeExpertView] Panel "${panel.id}" has _expertName="${panel._expertName}" (not "${expertName}"), skipping`);
                }

                // Also check child panels in row panels
                // IMPORTANT: Use childPanel.id directly (not construct it) - it's already a unique ID
                if (panel.type === 'row' && panel.panels && Array.isArray(panel.panels)) {
                    panel.panels.forEach((childPanel) => {
                        // STRICT CHECK: childPanel._expertName must exactly equal expertName
                        if (childPanel && childPanel._expertName === expertName) {
                            // Use the exact childPanel.id as stored (should already be a unique ID like "p5")
                            const childChartKey = String(childPanel.id);
                            expertPanelIds.add(childChartKey);
                            console.log(`[removeExpertView] ✓ Verified expert child panel: "${childPanel.title || childPanel.id}" (id: ${childPanel.id}, chartKey: ${childChartKey}, _expertName: "${childPanel._expertName}")`);
                        }
                    });
                }
            });

            console.log(`[removeExpertView] Collected ${expertPanelIds.size} expert panel IDs (chart keys): [${Array.from(expertPanelIds).sort().join(', ')}]`);
            console.log(`[removeExpertView] Current charts keys in this.charts: [${Object.keys(this.charts || {}).sort().join(', ')}]`);

            // CRITICAL DEBUG: Log all panels and their _expertName to verify collection is correct
            console.log(`[removeExpertView] All panels in this.panels with their _expertName (expertName="${expertName}"):`);
            this.panelOrder.normal.forEach((panelId) => {
                const panel = this.panels[panelId];
                if (panel) {
                    const panelExpertName = panel._expertName || 'none';
                    const hasChart = this.charts && this.charts[panelId] ? 'YES' : 'NO';
                    const isExpert = panelExpertName === expertName ? 'EXPERT' : 'NOT EXPERT';
                    console.log(`  panel.id="${panelId}", _expertName="${panelExpertName}", hasChart=${hasChart}, isExpert=${isExpert}`);
                }
            });

            // Find all panels with this expert name in DOM (for DOM removal)
            const expertPanelElements = grid.querySelectorAll(`[data-expert-name="${expertName}"]`);
            console.log(`[removeExpertView] Found ${expertPanelElements.length} panel elements with data-expert-name="${expertName}"`);

            // Second pass: Remove DOM elements ONLY (charts will be deleted separately using collected IDs)
            // DO NOT delete charts here - we'll do it in a separate step using only the collected expertPanelIds
            expertPanelElements.forEach(panelElement => {
                const result = this.findPanelFromElement(panelElement);
                if (result && result.panel) {
                    const panel = result.panel;
                    const panelId = String(panel.id);
                    // Only remove DOM if panel ID is in our verified expert panel IDs set
                    if (expertPanelIds.has(panelId)) {
                        // Remove DOM element only - don't delete chart here (we'll do it separately)
                        if (panelElement.parentNode) {
                            panelElement.remove();
                            console.log(`[removeExpertView] Removed DOM element for expert panel: ${panelId}`);
                        }
                    } else {
                        console.warn(`[removeExpertView] Skipping removal of panel "${panel.title || panel.id}" (id: ${panelId}) - not in verified expert panel IDs`);
                    }
                }
            });

            // Handle row panels and their children
            // Iterate over panelOrder.normal to find row panels
            this.panelOrder.normal.forEach((panelId) => {
                const panel = this.panels[panelId];
                if (!panel || panel.type !== 'row') return;

                // If row panel itself belongs to expert, mark it and remove all children
                if (panel._expertName === expertName) {
                    console.log(`[removeExpertView] Row panel "${panel.title || panel.id}" belongs to expert, marking for removal`);
                    expertPanelIds.add(String(panel.id)); // Add row panel ID for chart deletion

                    // Remove all children using modular helper - pass expertPanelIds to collect child panel IDs
                    const removedChildren = this.removeRowPanelChildren(panel, expertName, expertPanelIds);

                    // Also remove child panel divs array
                    if (panel._childPanelDivs) {
                        panel._childPanelDivs.forEach(div => {
                            if (div && div.parentNode) {
                                div.remove();
                            }
                        });
                        panel._childPanelDivs = [];
                    }
                } else {
                    // Row panel doesn't belong to expert, but check its children - pass expertPanelIds to collect child panel IDs
                    const removedChildren = this.removeRowPanelChildren(panel, expertName, expertPanelIds);
                }
            });

            // CRITICAL: Delete charts ONLY for verified expert panel IDs BEFORE removing from array
            // This ensures we delete charts using the correct panel IDs before reindexing changes them
            // Charts are stored as this.charts[String(panel.id)], so we use the exact keys we collected
            console.log(`[removeExpertView] Deleting charts for ${expertPanelIds.size} verified expert panels...`);
            let chartsDeleted = 0;
            let chartsPreserved = 0;

            // Delete charts ONLY for the exact panel IDs we collected
            // CRITICAL: Triple-verify each chart before deletion
            expertPanelIds.forEach(chartKey => {
                // chartKey is the exact key used to store the chart (String(panel.id))
                if (this.charts && this.charts[chartKey]) {
                    const chart = this.charts[chartKey];
                    const panel = this.panels[chartKey]; // Get panel directly from this.panels object

                    // TRIPLE VERIFICATION before deletion:
                    // 1. Panel must exist in this.panels
                    // 2. Panel must have _expertName property
                    // 3. Panel._expertName must exactly equal expertName (strict equality)
                    if (panel && panel._expertName !== undefined && panel._expertName === expertName) {
                        // Additional safety: verify panel.id matches chartKey
                        if (String(panel.id) === chartKey) {
                            if (chart && typeof chart.destroy === 'function') {
                                chart.destroy();
                            }
                            delete this.charts[chartKey];
                            chartsDeleted++;
                            console.log(`[removeExpertView] ✓✓✓ Deleted chart for expert panel (chartKey: ${chartKey}, panel: ${panel.title || panel.id}, _expertName: "${panel._expertName}")`);
                        } else {
                            chartsPreserved++;
                            console.error(`[removeExpertView] ✗✗✗ CRITICAL: Panel.id="${panel.id}" does not match chartKey="${chartKey}", NOT deleting (chart preserved)`);
                        }
                    } else {
                        chartsPreserved++;
                        const reason = !panel ? 'panel not in this.panels' :
                            (panel._expertName === undefined ? '_expertName is undefined' :
                                `_expertName="${panel._expertName}" !== "${expertName}"`);
                        console.error(`[removeExpertView] ✗✗✗ CRITICAL: Chart for key "${chartKey}" FAILED verification (${reason}), NOT deleting (chart preserved)`);
                    }
                } else {
                    console.log(`[removeExpertView] No chart found for expert panel key: ${chartKey} (may have been already deleted or never created)`);
                }
            });
            console.log(`[removeExpertView] Chart deletion summary: ${chartsDeleted} deleted, ${chartsPreserved} preserved, ${expertPanelIds.size} total expert panel IDs`);

            // Clear all panel-specific data structures before removing panels
            // This ensures complete cleanup of expert panel data from UI and data structures
            const clearPanelData = (panel) => {
                if (!panel) return;

                // Clear panel-specific data cache (query cache in this.dataCache is preserved)
                if (panel._dataCache) {
                    delete panel._dataCache;
                }

                // Clear panel-specific fetch promises
                if (panel._fetchPromises) {
                    delete panel._fetchPromises;
                }

                // Clear chart series names
                if (panel._chartSeriesNames) {
                    delete panel._chartSeriesNames;
                }

                // Clear current series names
                if (panel._currentSeriesNames) {
                    delete panel._currentSeriesNames;
                }

                // Clear genie-related properties
                delete panel._genieOriginalIndex;
                delete panel._genieOriginalY;
                delete panel._genieOriginalGridX;
                delete panel._genieOriginalGridW;
                delete panel._genieOriginalCollapsed;
                delete panel._genieOriginalTitle;
                delete panel._genieShowIndependently;
                delete panel._genieChangeCalculated;

                // Clear DOM references
                delete panel._panelDiv;
                delete panel._contentElement;
                delete panel._collapseButton;
                delete panel._childPanelDivs;

                // Clear parent/child references
                delete panel._parentRowPanel;
                delete panel._childIndex;

                // Clear expert name marker
                delete panel._expertName;
            };

            // Clear data for all expert panels (standalone and children)
            expertPanelIds.forEach(panelId => {
                const panel = this.panels[panelId];
                clearPanelData(panel);

                // Also clear child panels if this is a row panel
                if (panel && panel.type === 'row' && panel.panels && Array.isArray(panel.panels)) {
                    panel.panels.forEach(childPanel => {
                        if (childPanel && childPanel._expertName === expertName) {
                            clearPanelData(childPanel);
                        }
                    });
                }
            });

            // Also check all row panels for child panels that belong to this expert
            this.panelOrder.normal.forEach(pid => {
                const p = this.panels[pid];
                if (p && p.type === 'row' && p.panels && Array.isArray(p.panels)) {
                    p.panels.forEach(childPanel => {
                        if (childPanel && childPanel._expertName === expertName) {
                            clearPanelData(childPanel);
                        }
                    });
                }
            });

            // Remove panels from this.panels object and panelOrder arrays
            // NO REINDEXING NEEDED - IDs are stable!
            expertPanelIds.forEach(panelId => {
                this.removePanel(panelId);
            });

            console.log(`[removeExpertView] Remaining panels count: ${this.panelOrder.normal.length}`);

            // Recalculate Y positions (but no reindexing needed)
            this.recalculateYPositions();

            // Remove expert input row
            if (this.expertInputRows && this.expertInputRows[expertName]) {
                this.expertInputRows[expertName].remove();
                delete this.expertInputRows[expertName];
                console.log(`[removeExpertView] Removed input row for expert view: "${expertName}"`);
            }

            // Remove expert input config
            if (this.expertInputConfigs && this.expertInputConfigs[expertName]) {
                delete this.expertInputConfigs[expertName];
                console.log(`[removeExpertView] Removed input config for expert view: "${expertName}"`);
            }

            // Mark as not loaded
            this.loadedExpertViews.delete(expertName);
            console.log(`[removeExpertView] Completed removal of expert view: "${expertName}"`);

            // If genie mode is active, recalculate y-axis width after removing expert panels
            const genieCheckboxAfterRemoval = document.getElementById(this.getInstanceId('toolbar-genie-checkbox'));
            const isGenieActiveAfterRemoval = genieCheckboxAfterRemoval && genieCheckboxAfterRemoval.checked;
            if (isGenieActiveAfterRemoval) {
                console.log(`[removeExpertView] Genie mode is active, recalculating y-axis width after removing expert panels`);
                // Use progressive delays to ensure all charts are updated
                setTimeout(() => {
                    this.calculateAlignedYAxisRange();
                }, 100);
                setTimeout(() => {
                    this.calculateAlignedYAxisRange();
                }, 500);
        }
        }

        /**
         * Re-index panels after removal
         * NOTE: With stable IDs, this function is no longer needed for ID updates.
         * It's kept for backward compatibility but only updates DOM positions.
         */
        reindexPanels() {
            const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
            if (!grid) return;

            // With stable IDs, we don't need to update panel IDs anymore
            // This function is kept for backward compatibility but is essentially a no-op
            console.log(`[reindexPanels] Called but panel IDs are stable - no reindexing needed. Panel count: ${this.panelOrder.normal.length}`);

            // No-op: Panel IDs are stable and don't need to be updated
            // Charts are already keyed by stable panel.id, so no chart key updates needed either
        }

        /**
         * Recalculate Y positions of all panels to fill gaps after removal
         */
        recalculateYPositions() {
            if (typeof PanelPositioning === 'undefined' || !PanelPositioning.recalculateYPositions) {
                throw new Error('GenieDashboard: PanelPositioning module is required but not loaded. Please ensure PanelPositioning.js is included before genieDashboard.js');
            }
            // Get panelOrder and panels from PanelRegistry or fallback
            const panelOrder = this.panelRegistry ? this.panelRegistry.panelOrder : this.panelOrder;
            const panels = this.panelRegistry ? this.panelRegistry.panels : this.panels;
            // Create wrapper for setPanelPosition
            const setPanelPos = (panel, panelDiv, y, h, skip) => this.setPanelPosition(panel, panelDiv, y, h, skip);
            return PanelPositioning.recalculateYPositions(panelOrder, panels, () => this.getInstanceId(), setPanelPos);
        }

        /**
         * ============================================================================
         * MODULAR HELPER FUNCTIONS FOR PANEL OPERATIONS
         * ============================================================================
         * These functions provide consistent, reusable operations for panel management
         * to ensure collapse/expand works reliably in all scenarios.
         */

        /**
         * Find panel object and DOM element consistently
         * @param {HTMLElement|number} panelDivOrIndex - Panel DOM element or panel index
         * @returns {{panel: Object, panelDiv: HTMLElement, panelIndex: number}|null}
         */
        findPanelAndElement(panelDivOrIndex) {
            if (typeof PanelStateManager === 'undefined' || !PanelStateManager.findPanelAndElement) {
                throw new Error('GenieDashboard: PanelStateManager module is required but not loaded. Please ensure PanelStateManager.js is included before genieDashboard.js');
            }
            const panelOrder = this.panelRegistry ? this.panelRegistry.panelOrder : this.panelOrder;
            const panels = this.panelRegistry ? this.panelRegistry.panels : this.panels;
            return PanelStateManager.findPanelAndElement(panelDivOrIndex, panelOrder, panels, () => this.getInstanceId());
        }

        /**
         * Get panel position from DOM (most reliable source)
         * @param {HTMLElement} panelDiv - Panel DOM element
         * @returns {{y: number, height: number, gridRow: string}}
         */
        getPanelPositionFromDOM(panelDiv) {
            if (typeof PanelPositioning === 'undefined' || !PanelPositioning.getPanelPositionFromDOM) {
                throw new Error('GenieDashboard: PanelPositioning module is required but not loaded. Please ensure PanelPositioning.js is included before genieDashboard.js');
            }
            return PanelPositioning.getPanelPositionFromDOM(panelDiv, () => this.getControlsRowOffset());
        }

        /**
         * Set panel position in DOM and sync with panel object
         * @param {Object} panel - Panel object
         * @param {HTMLElement} panelDiv - Panel DOM element
         * @param {number} y - Y position (0-based)
         * @param {number} height - Panel height
         * @param {boolean} skipDOMUpdate - If true, only update panel object, not DOM
         */
        setPanelPosition(panel, panelDiv, y, height, skipDOMUpdate = false) {
            if (typeof PanelPositioning === 'undefined' || !PanelPositioning.setPanelPosition) {
                throw new Error('GenieDashboard: PanelPositioning module is required but not loaded. Please ensure PanelPositioning.js is included before genieDashboard.js');
            }
            return PanelPositioning.setPanelPosition(panel, panelDiv, y, height, skipDOMUpdate, () => this.getControlsRowOffset(), (div, p) => this.isPanelCollapsed(div, p), (p, div, isFirst) => this.storeNormalPanelState ? this.storeNormalPanelState(p, div, isFirst) : null);
        }

        /**
         * Get collapsed state from DOM (source of truth)
         * @param {HTMLElement} panelDiv - Panel DOM element
         * @param {Object} panel - Panel object (optional, for syncing)
         * @returns {boolean}
         */
        isPanelCollapsed(panelDiv, panel = null) {
            if (typeof PanelStateManager === 'undefined' || !PanelStateManager.isPanelCollapsed) {
                throw new Error('GenieDashboard: PanelStateManager module is required but not loaded. Please ensure PanelStateManager.js is included before genieDashboard.js');
            }
            return PanelStateManager.isPanelCollapsed(panelDiv, panel);
        }

        /**
         * Set collapsed state in DOM and sync with panel object
         * @param {HTMLElement} panelDiv - Panel DOM element
         * @param {Object} panel - Panel object
         * @param {boolean} collapsed - Whether panel should be collapsed
         */
        setPanelCollapsedState(panelDiv, panel, collapsed) {
            if (typeof PanelPositioning === 'undefined' || !PanelPositioning.setPanelCollapsedState) {
                throw new Error('GenieDashboard: PanelPositioning module is required but not loaded. Please ensure PanelPositioning.js is included before genieDashboard.js');
            }
            return PanelPositioning.setPanelCollapsedState(panelDiv, panel, collapsed);
        }

        /**
         * Get effective height of panel (1 if collapsed, original height if expanded)
         * @param {Object} panel - Panel object
         * @param {HTMLElement} panelDiv - Panel DOM element
         * @param {number} currentHeight - Current height from DOM
         * @returns {number}
         */
        getPanelEffectiveHeight(panel, panelDiv, currentHeight) {
            if (typeof PanelPositioning === 'undefined' || !PanelPositioning.getPanelEffectiveHeight) {
                throw new Error('GenieDashboard: PanelPositioning module is required but not loaded. Please ensure PanelPositioning.js is included before genieDashboard.js');
            }
            return PanelPositioning.getPanelEffectiveHeight(panel, panelDiv, currentHeight, (div, p) => this.isPanelCollapsed(div, p));
        }

        /**
         * Store original dimensions before collapsing
         * @param {Object} panel - Panel object
         * @param {HTMLElement} panelDiv - Panel DOM element
         * @param {HTMLElement} content - Panel content element
         * @param {number} currentY - Current Y position
         * @param {number} currentHeight - Current height
         */
        storeOriginalDimensions(panel, panelDiv, content, currentY, currentHeight) {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.storeOriginalDimensions) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            return PanelUtils.storeOriginalDimensions(panel, panelDiv, content, currentY, currentHeight);
        }

        /**
         * Restore original dimensions when expanding
         * @param {Object} panel - Panel object
         * @param {HTMLElement} panelDiv - Panel DOM element
         * @param {HTMLElement} content - Panel content element
         */
        restoreOriginalDimensions(panel, panelDiv, content) {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.restoreOriginalDimensions) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            return PanelUtils.restoreOriginalDimensions(panel, panelDiv, content);
        }

        /**
         * Get the controls row height in grid units
         * This is modularized so it can be easily adjusted when more input fields are added
         * First tries to get the actual height from DOM, falls back to default if not found
         * @returns {number} Height of controls row in grid units
         */
        getControlsRowHeight() {
            const controlsRow = document.getElementById(this.getInstanceId('controls-row'));
            if (controlsRow) {
                // Get the grid-row value to determine how many rows it spans
                const gridRow = controlsRow.style.gridRow || window.getComputedStyle(controlsRow).gridRow;
                if (gridRow && gridRow.includes('/')) {
                    const match = gridRow.match(/(\d+)\s*\/\s*(\d+)/);
                    if (match) {
                        const start = parseInt(match[1]);
                        const end = parseInt(match[2]);
                        return end - start; // Return height in grid units
                    }
                }
            }
            // Fallback to default height (modularized method)
            return this.getDefaultControlsRowHeight();
        }

        /**
         * Get the offset needed for panels to account for controls row
         * This includes: controls row height + 1 for 1-based grid indexing
         * @returns {number} Total offset needed (controls row height + 1)
         */
        getControlsRowOffset() {
            if (typeof LayoutUtils === 'undefined' || !LayoutUtils.getControlsRowOffset) {
                throw new Error('GenieDashboard: LayoutUtils module is required but not loaded. Please ensure LayoutUtils.js is included before genieDashboard.js');
            }
            // Use LayoutUtils, but pass the actual height from DOM if available
            const actualHeight = this.getControlsRowHeight();
            return LayoutUtils.getControlsRowOffset(actualHeight);
        }

        /**
         * Ensure controls row stays in place at the top of the grid
         * Call this after any operation that might affect panel positions
         */
        ensureControlsRowPosition() {
            if (typeof PanelStateManager === 'undefined' || !PanelStateManager.ensureControlsRowPosition) {
                throw new Error('GenieDashboard: PanelStateManager module is required but not loaded. Please ensure PanelStateManager.js is included before genieDashboard.js');
            }
            return PanelStateManager.ensureControlsRowPosition(() => this.getInstanceId(), () => this.getControlsRowHeight());
        }

        /**
         * Recalculate all Y positions from top to bottom (unified function)
         * This ensures consistent positioning regardless of how collapse/expand was triggered
         * @param {boolean} skipDOMUpdate - If true, only update panel objects, not DOM
         */
        recalculateAllYPositions(skipDOMUpdate = false) {
            if (typeof PanelPositioning === 'undefined' || !PanelPositioning.recalculateAllYPositions) {
                throw new Error('GenieDashboard: PanelPositioning module is required but not loaded. Please ensure PanelPositioning.js is included before genieDashboard.js');
            }
            const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
            // Create wrapper functions for all dependencies
            const getPosFromDOM = (div) => this.getPanelPositionFromDOM(div);
            const getEffectiveHeight = (p, div, h) => this.getPanelEffectiveHeight(p, div, h);
            const setPos = (p, div, y, h, skip) => this.setPanelPosition(p, div, y, h, skip);
            return PanelPositioning.recalculateAllYPositions({
                grid: grid,
                getInstanceId: (id) => this.getInstanceId(id),
                findPanelAndElement: (idx) => this.findPanelAndElement(idx),
                hasCollapsedParent: (p) => this.hasCollapsedParent(p),
                getPanelPositionFromDOM: getPosFromDOM,
                getPanelEffectiveHeight: getEffectiveHeight,
                setPanelPosition: setPos,
                isPanelCollapsed: (div, p) => this.isPanelCollapsed(div, p),
                ensureControlsRowPosition: () => this.ensureControlsRowPosition(),
                skipDOMUpdate: skipDOMUpdate,
                geniePanelsMetThresholdList: this._geniePanelsMetThresholdList,
                genieRemainingPanelsList: this._genieRemainingPanelsList
            });
        }

        /**
         * ============================================================================
         * END OF MODULAR HELPER FUNCTIONS
         * ============================================================================
         */

        /**
         * Toggle panel collapse/expand state
         */
        togglePanelCollapse(panelDiv, panelIndex) {
            if (typeof PanelStateManager === 'undefined' || !PanelStateManager.togglePanelCollapse) {
                throw new Error('GenieDashboard: PanelStateManager module is required but not loaded. Please ensure PanelStateManager.js is included before genieDashboard.js');
            }
            return PanelStateManager.togglePanelCollapse(panelDiv, panelIndex, {
                findPanelAndElement: (panelDivOrIndex) => this.findPanelAndElement(panelDivOrIndex),
                getPanelPositionFromDOM: (panelDiv) => this.getPanelPositionFromDOM(panelDiv),
                isPanelCollapsed: (panelDiv, panel) => this.isPanelCollapsed(panelDiv, panel),
                setPanelCollapsedState: (panelDiv, panel, collapsed) => this.setPanelCollapsedState(panelDiv, panel, collapsed),
                getPanelEffectiveHeight: (panel, panelDiv, currentHeight) => this.getPanelEffectiveHeight(panel, panelDiv, currentHeight),
                setPanelPosition: (panel, panelDiv, y, height, skipRecalculation) => this.setPanelPosition(panel, panelDiv, y, height, skipRecalculation),
                restoreOriginalDimensions: (panel, panelDiv, content) => this.restoreOriginalDimensions(panel, panelDiv, content),
                storeOriginalDimensions: (panel, panelDiv, content, currentY, currentHeight) => this.storeOriginalDimensions(panel, panelDiv, content, currentY, currentHeight),
                getInstanceId: (id) => this.getInstanceId(id),
                dashboardGrid: this.dashboardGrid,
                charts: this.charts,
                recalculateYPositionsAfterCollapse: (panelIndex, wasCollapsed) => this.recalculateYPositionsAfterCollapse(panelIndex, wasCollapsed),
                _skipPositionRecalculation: this._skipPositionRecalculation,
                ensureControlsRowPosition: (grid) => this.ensureControlsRowPosition(grid)
            });
        }


        /**
         * Recalculate Y positions of panels after collapse/expand to fill gaps
         * This is used for single panel changes. For batch changes, use recalculateAllYPositions
         */
        recalculateYPositionsAfterCollapse(changedPanelIndex, wasCollapsed) {
            if (typeof PanelPositioning === 'undefined' || !PanelPositioning.recalculateYPositionsAfterCollapse) {
                throw new Error('GenieDashboard: PanelPositioning module is required but not loaded. Please ensure PanelPositioning.js is included before genieDashboard.js');
            }
            // Create wrapper functions for all dependencies
            const getPosFromDOM = (div) => this.getPanelPositionFromDOM(div);
            const getEffectiveHeight = (p, div, h) => this.getPanelEffectiveHeight(p, div, h);
            const setPos = (p, div, y, h, skip) => this.setPanelPosition(p, div, y, h, skip);
            return PanelPositioning.recalculateYPositionsAfterCollapse({
                changedPanelIndex: changedPanelIndex,
                wasCollapsed: wasCollapsed,
                findPanelAndElement: (idx) => this.findPanelAndElement(idx),
                getPanelPositionFromDOM: getPosFromDOM,
                isPanelCollapsed: (div, p) => this.isPanelCollapsed(div, p),
                getPanelEffectiveHeight: getEffectiveHeight,
                setPanelPosition: setPos,
                getInstanceId: (id) => this.getInstanceId(id),
                recalculateAllYPositions: () => this.recalculateAllYPositions()
            });
        }

        /**
         * Show upload modal
         */
        showUploadModal() {
            if (!this.uploadModalOverlay || !this.uploadModalPasteTextarea) {
                console.warn('Upload modal not initialized');
                return;
            }

            // Clear textareas
            this.uploadModalPasteTextarea.value = '';
            this.uploadModalConvertedTextarea.value = '';

            // Switch to paste tab
            const pasteTab = document.getElementById(this.getInstanceId('upload-tab-paste'));
            const convertedTab = document.getElementById(this.getInstanceId('upload-tab-converted'));
            if (pasteTab && convertedTab) {
                pasteTab.style.background = '#3b82f6';
                pasteTab.style.color = 'white';
                convertedTab.style.background = '#f3f4f6';
                convertedTab.style.color = '#6b7280';
                this.uploadModalPasteTextarea.style.display = 'block';
                this.uploadModalConvertedTextarea.style.display = 'none';
            }

            // Show modal
            this.uploadModalOverlay.style.display = 'flex';

            // Focus paste textarea
            setTimeout(() => {
                this.uploadModalPasteTextarea.focus();
            }, 100);
        }

        /**
         * Render a single panel
         */
        async renderPanel(panel, index, gridContainer, dataOnly = false, skipDataLoading = false) {
            if (typeof PanelRenderer === 'undefined' || !PanelRenderer.renderPanel) {
                throw new Error('GenieDashboard: PanelRenderer module is required but not loaded. Please ensure PanelRenderer.js is included before genieDashboard.js');
            }
            return PanelRenderer.renderPanel(panel, index, gridContainer, dataOnly, skipDataLoading, {
                hasCollapsedParent: (panel) => this.hasCollapsedParent(panel),
                calculateAndStorePanelMetadata: (panel) => this.calculateAndStorePanelMetadata(panel),
                getInstanceId: (id) => this.getInstanceId(id),
                fetchPanelDataWithCompare: (panel, fetchPrevious, fetchAllCompareOptions) => this.fetchPanelDataWithCompare(panel, fetchPrevious, fetchAllCompareOptions),
                getControlsRowOffset: () => this.getControlsRowOffset(),
                rowHeightPerUnit: this.rowHeightPerUnit,
                replacePlaceholdersInText: (text) => this.replacePlaceholdersInText(text),
                togglePanelCollapse: (panelDiv, panelIndex) => this.togglePanelCollapse(panelDiv, panelIndex),
                storeNormalPanelState: (panel, panelDiv, isFirstRender) => this.storeNormalPanelState(panel, panelDiv, isFirstRender),
                hidePanelLoadingIndicator: (panelDiv, panel) => this.hidePanelLoadingIndicator(panelDiv, panel),
                checkPanelQueriesWillSkip: (panel) => this.checkPanelQueriesWillSkip(panel),
                showPanelLoadingIndicator: (panelDiv, content, panel, message) => this.showPanelLoadingIndicator(panelDiv, content, panel, message),
                renderPanelChart: (panel, data, content, header, previousData) => this.renderPanelChart(panel, data, content, header, previousData),
                showPanelSkippedMessage: (panel, content, skippedTargets) => this.showPanelSkippedMessage(panel, content, skippedTargets),
                hidePanelSkippedMessage: (panel, content) => this.hidePanelSkippedMessage(panel, content),
                showPanelError: (panel, content, failedTargets) => this.showPanelError(panel, content, failedTargets),
                hidePanelError: (panel, content) => this.hidePanelError(panel, content),
                updatePerformanceDisplay: (panel) => this.updatePerformanceDisplay(panel),
                panelOrder: this.panelOrder,
                panels: this.panels
            });
        }


        /**
         * Show error message at the bottom of panel with refresh icon
         */
        showPanelError(panel, content, failedTargets) {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.showPanelError) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            return PanelUtils.showPanelError(panel, content, failedTargets, {
                hidePanelError: (panel, content) => this.hidePanelError(panel, content),
                showPanelRetryLoading: (panel, content) => this.showPanelRetryLoading(panel, content),
                retryFailedQueries: (panel, content) => this.retryFailedQueries(panel, content),
                showErrorMessage: (message, type) => this.showErrorMessage(message, type)
            });
        }

        /**
         * Hide error message from panel
         */
        hidePanelError(panel, content) {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.hidePanelError) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            return PanelUtils.hidePanelError(panel, content);
        }

        /**
         * Show skipped message for queries waiting for input fields
         */
        showPanelSkippedMessage(panel, content, skippedTargets) {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.showPanelSkippedMessage) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            return PanelUtils.showPanelSkippedMessage(panel, content, skippedTargets, {
                hidePanelSkippedMessage: (panel, content) => this.hidePanelSkippedMessage(panel, content)
            });
        }

        /**
         * Hide skipped message from panel
         */
        hidePanelSkippedMessage(panel, content) {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.hidePanelSkippedMessage) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            return PanelUtils.hidePanelSkippedMessage(panel, content);
        }

        /**
         * Check if panel queries will be skipped due to missing placeholders
         * @param {Object} panel - Panel configuration
         * @returns {Object} - { willSkip: boolean, missingPlaceholders: string[] }
         */
        checkPanelQueriesWillSkip(panel) {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.checkPanelQueriesWillSkip) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            return PanelUtils.checkPanelQueriesWillSkip(panel, {
                getPlaceholderMappings: () => this.getPlaceholderMappings(),
                getInputConfigValue: (fieldName, config) => QueryProcessor.getInputConfigValue(fieldName, config),
                inputConfig: this.inputConfig,
                processQuery: (query, previousOffset = 0, expertName = null) => this.processQuery(query, previousOffset, expertName)
            });
        }


        /**
         * Ensure spin animation CSS is added to the document
         * Uses instance-specific style element and animation name to avoid conflicts
         * @param {string} styleId - Unique ID for the style element (default: instance-specific)
         * @param {string} animationName - Name of the animation (default: instance-specific)
         */
        ensureSpinAnimationCSS(styleId = null, animationName = null) {
            // Always use instance-specific animation name and style element ID to avoid conflicts
            if (!animationName || animationName === 'spin') {
                animationName = `genie-spin-${this.instanceId}`;
            }

            // Use instance-specific style element ID to ensure each instance has its own CSS
            if (!styleId) {
                styleId = `genie-spin-animation-${this.instanceId}`;
            }

            // Check if our instance-specific style element exists
            let style = document.getElementById(styleId);

            if (!style) {
                // Create new instance-specific style element
                style = document.createElement('style');
                style.id = styleId;
                // Add keyframes immediately
                style.textContent = `
                @keyframes ${animationName} {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
                document.head.appendChild(style);
            } else {
                // Style element exists, verify it has our keyframes
                const currentContent = style.textContent || style.innerHTML || '';
                const hasOurKeyframes = currentContent.includes(`@keyframes ${animationName}`) ||
                    currentContent.includes(`keyframes ${animationName}`);

                if (!hasOurKeyframes) {
                    // Add keyframes to existing style element
                    const keyframes = `
                    @keyframes ${animationName} {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                    style.textContent = (currentContent.trim() ? currentContent + '\n' : '') + keyframes;
                }
            }

            // CRITICAL: Ensure stylesheet is parsed and keyframes are accessible
            // Access the stylesheet to force browser to parse it
            const KEYFRAMES_RULE = 7;
            let keyframesFound = false;

            // Try to access the stylesheet immediately after adding it
            try {
                const styleSheets = document.styleSheets;
                for (let i = styleSheets.length - 1; i >= 0; i--) {
                    try {
                        const sheet = styleSheets[i];
                        // Check if this is our style element's stylesheet
                        if (sheet.ownerNode && sheet.ownerNode.id === styleId) {
                            // Force stylesheet parsing by accessing cssRules
                            const rules = sheet.cssRules || sheet.rules;
                            if (rules) {
                                for (let j = 0; j < rules.length; j++) {
                                    const rule = rules[j];
                                    if (rule && (rule.type === KEYFRAMES_RULE || rule.type === CSSRule.KEYFRAMES_RULE) &&
                                        rule.name === animationName) {
                                        keyframesFound = true;
                                        break;
                                    }
                                }
                            }
                            break; // Found our stylesheet, no need to continue
                        }
                    } catch (e) {
                        // Stylesheet not ready yet or cross-origin, continue
                        continue;
                    }
                }
            } catch (e) {
                // Error accessing stylesheets
            }

            // If keyframes not found via API, verify they exist in DOM text
            if (!keyframesFound) {
                const content = style.textContent || style.innerHTML || '';
                if (content.includes(`@keyframes ${animationName}`)) {
                    // Keyframes are in DOM, browser should parse them
                    // Force a reflow to trigger parsing
                    void style.offsetHeight;
                    void document.body.offsetHeight;
                } else {
                    // Keyframes missing, re-add them
                    style.textContent = (content.trim() ? content + '\n' : '') + `
                    @keyframes ${animationName} {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                    void style.offsetHeight;
                }
            }

            return animationName;
        }

        /**
         * Verify that keyframes actually exist and are accessible
         * @param {string} animationName - Name of the animation
         * @returns {boolean} True if keyframes are accessible
         */
        verifyKeyframesExist(animationName) {
            // Try to access via stylesheet API
            const KEYFRAMES_RULE = 7;
            try {
                const styleSheets = document.styleSheets;
                for (let i = 0; i < styleSheets.length; i++) {
                    try {
                        const rules = styleSheets[i].cssRules || styleSheets[i].rules;
                        if (rules) {
                            for (let j = 0; j < rules.length; j++) {
                                const rule = rules[j];
                                if (rule && (rule.type === KEYFRAMES_RULE || rule.type === CSSRule.KEYFRAMES_RULE) &&
                                    rule.name === animationName) {
                                    return true;
                                }
                            }
                        }
                    } catch (e) {
                        // Cross-origin stylesheet, skip
                        continue;
                    }
                }
            } catch (e) {
                // Fallback to text search
            }

            // Fallback: check text content
            const styleElements = document.head.querySelectorAll('style');
            for (let styleEl of styleElements) {
                const content = styleEl.textContent || styleEl.innerHTML;
                if (content.includes(`@keyframes ${animationName}`)) {
                    return true;
                }
            }

            return false;
        }

        /**
         * Check if keyframes exist in the document
         * @param {string} animationName - Name of the animation
         * @returns {boolean} True if keyframes exist
         */
        checkKeyframesExist(animationName) {
            // Check all style elements in head first (most reliable)
            const styleElements = document.head.querySelectorAll('style');
            for (let styleEl of styleElements) {
                const content = styleEl.textContent || styleEl.innerHTML;
                if (content.includes(`@keyframes ${animationName}`) ||
                    content.includes(`keyframes ${animationName}`) ||
                    content.includes(`@-webkit-keyframes ${animationName}`)) {
                    return true;
                }
            }

            // Also check stylesheets (may fail for cross-origin)
            const KEYFRAMES_RULE = 7; // CSSRule.KEYFRAMES_RULE constant value
            const styleSheets = document.styleSheets;
            for (let i = 0; i < styleSheets.length; i++) {
                try {
                    const rules = styleSheets[i].cssRules || styleSheets[i].rules;
                    if (rules) {
                        for (let j = 0; j < rules.length; j++) {
                            const rule = rules[j];
                            if (rule && (rule.type === KEYFRAMES_RULE || rule.type === CSSRule.KEYFRAMES_RULE) &&
                                (rule.name === animationName || rule.name === `-webkit-${animationName}`)) {
                                return true;
                            }
                        }
                    }
                } catch (e) {
                    // Cross-origin stylesheets may throw errors, skip them
                    continue;
                }
            }

            return false;
        }

        /**
         * Create a circular spinner element (centralized spinner creation)
         * @param {Object} options - Spinner options
         * @param {number} options.size - Size in pixels (default: 40)
         * @param {string} options.borderColor - Border color (default: '#e5e7eb')
         * @param {string} options.borderTopColor - Top border color (default: '#3b82f6')
         * @param {number} options.borderWidth - Border width in pixels (default: 4)
         * @param {string} options.animationName - Animation name (default: 'spin')
         * @returns {HTMLElement} Spinner element
         */
        createSpinner(options = {}) {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.createSpinner) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            return PanelUtils.createSpinner(options, (instanceId, name) => this.ensureSpinAnimationCSS(instanceId, name));
        }

        /**
         * Create a text spinner element (for inline use)
         * @param {string} icon - Icon/text to spin (default: '⟳')
         * @param {string} animationName - Animation name (default: 'spin')
         * @returns {HTMLElement} Spinner element
         */
        createTextSpinner(icon = '⟳', animationName = null) {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.createTextSpinner) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            return PanelUtils.createTextSpinner(icon, animationName, (instanceId, name) => this.ensureSpinAnimationCSS(instanceId, name));
        }

        /**
         * Recursively check if any parent row panel in the hierarchy is collapsed
         * Uses panel.collapsed attribute from the panel data structure
         * @param {Object} panel - The panel object to check
         * @returns {boolean} True if any parent is collapsed
         */
        hasCollapsedParent(panel) {
            if (typeof PanelStateManager === 'undefined' || !PanelStateManager.hasCollapsedParent) {
                throw new Error('GenieDashboard: PanelStateManager module is required but not loaded. Please ensure PanelStateManager.js is included before genieDashboard.js');
            }
            // Pass recursive reference
            return PanelStateManager.hasCollapsedParent(panel, PanelStateManager.hasCollapsedParent);
        }

        /**
         * Show a loading indicator in the center of a panel during refresh
         * @param {HTMLElement} panelDiv - The panel div element
         * @param {HTMLElement} content - The panel content element
         * @param {Object} panel - The panel object (optional)
         * @param {string} message - Loading message (default: 'Loading...')
         */
        showPanelLoadingIndicator(panelDiv, content, panel = null, message = 'Loading...') {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.showPanelLoadingIndicator) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            return PanelUtils.showPanelLoadingIndicator(panelDiv, content, panel, message, {
                hasCollapsedParent: (panel) => this.hasCollapsedParent(panel),
                createSpinner: (options) => this.createSpinner(options)
            });
        }

        /**
         * Hide the loading indicator from a panel
         * @param {HTMLElement} panelDiv - The panel div element
         * @param {Object} panel - The panel object (optional)
         */
        hidePanelLoadingIndicator(panelDiv, panel = null) {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.hidePanelLoadingIndicator) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            return PanelUtils.hidePanelLoadingIndicator(panelDiv, panel);
        }

        /**
         * Show loading message at the bottom of panel during retry
         */
        showPanelRetryLoading(panel, content) {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.showPanelRetryLoading) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            return PanelUtils.showPanelRetryLoading(panel, content, {
                hidePanelError: (panel, content) => this.hidePanelError(panel, content),
                createTextSpinner: (text, animation) => this.createTextSpinner(text, animation)
            });
        }


        /**
         * Retry only failed queries for a panel
         */
        async retryFailedQueries(panel, content) {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.retryFailedQueries) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            return PanelUtils.retryFailedQueries(panel, content, {
                fetchPanelData: (panel, previousOffset, previousDuration, failedTargetsOnly) => this.fetchPanelData(panel, previousOffset, previousDuration, failedTargetsOnly),
                renderPanelChart: (panel, data, content, header, previousData) => this.renderPanelChart(panel, data, content, header, previousData),
                hidePanelLoadingIndicator: (panelDiv, panel) => this.hidePanelLoadingIndicator(panelDiv, panel),
                showPanelError: (panel, content, failedTargets) => this.showPanelError(panel, content, failedTargets),
                getInputConfigValue: (fieldName, config) => QueryProcessor.getInputConfigValue(fieldName, config),
                inputConfig: this.inputConfig,
                processQuery: (query, previousOffset = 0, expertName = null) => this.processQuery(query, previousOffset, expertName),
                getPlaceholderMappings: () => this.getPlaceholderMappings(),
                parseDuration: (duration) => DataUtils.parseDuration(duration),
                showErrorMessage: (message, type) => this.showErrorMessage ? this.showErrorMessage(message, type) : console.error(message)
            });
        }


        /**
         * Render a row panel with nested children and collapse/expand functionality
         */
        async renderRowPanel(panel, index, gridContainer, skipDataLoading = false) {
            if (typeof PanelRenderer === 'undefined' || !PanelRenderer.renderRowPanel) {
                throw new Error('GenieDashboard: PanelRenderer module is required but not loaded. Please ensure PanelRenderer.js is included before genieDashboard.js');
            }
            return PanelRenderer.renderRowPanel(panel, index, gridContainer, skipDataLoading, {
                getInstanceId: (id) => this.getInstanceId(id),
                getControlsRowOffset: () => this.getControlsRowOffset(),
                rowHeightPerUnit: this.rowHeightPerUnit,
                replacePlaceholdersInText: (text) => this.replacePlaceholdersInText(text),
                toggleRowPanelCollapse: (panelDiv, panelIndex) => this.toggleRowPanelCollapse(panelDiv, panelIndex),
                renderPanel: (panel, index, gridContainer, dataOnly, skipDataLoading) => this.renderPanel(panel, index, gridContainer, dataOnly, skipDataLoading)
            });
        }


        /**
         * Toggle collapse/expand state of a row panel
         */
        toggleRowPanelCollapse(panel, panelDiv) {
            if (typeof PanelStateManager === 'undefined' || !PanelStateManager.toggleRowPanelCollapse) {
                throw new Error('GenieDashboard: PanelStateManager module is required but not loaded. Please ensure PanelStateManager.js is included before genieDashboard.js');
            }
            return PanelStateManager.toggleRowPanelCollapse(panel, panelDiv, {
                findPanelAndElement: (panelDivOrIndex) => this.findPanelAndElement(panelDivOrIndex),
                getInstanceId: (id) => this.getInstanceId(id),
                setPanelPosition: (panel, panelDiv, y, height, skipRecalculation) => this.setPanelPosition(panel, panelDiv, y, height, skipRecalculation),
                getPanelEffectiveHeight: (panel, panelDiv, currentHeight) => this.getPanelEffectiveHeight(panel, panelDiv, currentHeight),
                getControlsRowOffset: () => this.getControlsRowOffset(),
                renderPanel: (panel, index, gridContainer, dataOnly, skipDataLoading) => this.renderPanel(panel, index, gridContainer, dataOnly, skipDataLoading),
                panelOrder: this.panelOrder,
                panels: this.panels,
                dashboardGrid: this.dashboardGrid,
                recalculateAllYPositions: () => this.recalculateAllYPositions(),
                ensureControlsRowPosition: (grid) => this.ensureControlsRowPosition(grid),
                hidePanelError: (panel, content) => this.hidePanelError(panel, content),
                renderPanelChart: (panel, data, content, header, previousData) => this.renderPanelChart(panel, data, content, header, previousData),
                showPanelError: (panel, content, failedTargets) => this.showPanelError(panel, content, failedTargets),
                positionCalculator: this.positionCalculator
            });
        }


        /**
         * Apply zoom to all charts with the same time range
         * @param {number|null} min - Minimum timestamp (null to reset zoom)
         * @param {number|null} max - Maximum timestamp (null to reset zoom)
         * @param {string|number} sourcePanelId - ID of the panel that initiated the zoom (to avoid double-update)
         */
        applyZoomToAllCharts(min, max, sourcePanelId) {
            if (typeof ChartActions === 'undefined' || !ChartActions.applyZoomToAllCharts) {
                throw new Error('GenieDashboard: ChartActions module is required but not loaded. Please ensure ChartActions.js is included before genieDashboard.js');
            }
            return ChartActions.applyZoomToAllCharts(min, max, sourcePanelId, {
                charts: this.charts,
                panels: this.panels,
                getInputConfigValue: (fieldName, config) => this.getInputConfigValue(fieldName, config),
                inputConfig: this.inputConfig
            });
        }


        /**
         * Process panel data to calculate chart and stats series data
         * This extracts _chartSeriesData, _chartSeriesNames, _statsSeriesData, _statsSeriesDataMap, _statsSeriesNames
         * without rendering the chart or table
         * @param {Object} panel - Panel object
         * @param {Array} currentDataArray - Current period data array
         * @param {Array} previousDataArray - Previous period data array (optional)
         */
        processPanelDataForSeries(panel, currentDataArray, previousDataArray = null) {
            if (typeof DataProcessor === 'undefined' || !DataProcessor.processPanelDataForSeries) {
                throw new Error('GenieDashboard: DataProcessor module is required but not loaded. Please ensure DataProcessor.js is included before genieDashboard.js');
            }
            return DataProcessor.processPanelDataForSeries(
                panel,
                currentDataArray,
                previousDataArray,
                this.inputConfig,
                (combinedData, panel, previousDuration) => this.transformDataForChart(combinedData, panel, previousDuration),
                (values, statsToShow, seriesName) => this.calculateSeriesStats(values, statsToShow, seriesName),
                (series, target, panel) => this.getSeriesName(series, target, panel)
            );
        }

        /**
         * Calculate and store panel metadata (dimensions, grid positions, etc.)
         * This is used for both normal and data-only modes
         * @param {Object} panel - Panel object
         */
        calculateAndStorePanelMetadata(panel) {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.calculateAndStorePanelMetadata) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            return PanelUtils.calculateAndStorePanelMetadata(panel, {
                rowHeightPerUnit: this.rowHeightPerUnit,
                getControlsRowOffset: () => this.getControlsRowOffset()
            });
        }

        /**
         * Fetch panel data (current and previous if compare option exists)
         * Returns { data, previousData, failedTargets, previousFailedTargets, defaultCompareOption }
         * This is used for both normal and data-only modes
         * @param {Object} panel - Panel object
         * @param {boolean} checkFetchInProgress - Whether to check and wait for existing fetch (default: true)
         * @returns {Promise<Object>} Object containing data, previousData, failedTargets, etc.
         */
        async fetchPanelDataWithCompare(panel, checkFetchInProgress = true, fetchAllCompareOptions = false) {
            if (typeof DataFetcher === 'undefined' || !DataFetcher.fetchPanelDataWithCompare) {
                throw new Error('GenieDashboard: DataFetcher module is required but not loaded. Please ensure DataFetcher.js is included before genieDashboard.js');
            }
            return DataFetcher.fetchPanelDataWithCompare(
                panel,
                checkFetchInProgress,
                fetchAllCompareOptions,
                this.inputConfig,
                (panel, offset, duration) => this.fetchPanelData(panel, offset, duration),
                (duration) => DataUtils.parseDuration(duration)
            );
        }

        /**
         * Fetch data for a panel by processing its targets/queries
         * @param {Object} panel - Panel configuration
         * @param {number} previousOffset - Offset in milliseconds for previous period (0 for current)
         * @param {string} previousDuration - Duration string like "-7d" for previous period (null/undefined for current)
         */
        async fetchPanelData(panel, previousOffset = 0, previousDuration = null, failedTargetsOnly = null) {
            if (typeof DataFetcher === 'undefined' || !DataFetcher.fetchPanelData) {
                throw new Error('GenieDashboard: DataFetcher module is required but not loaded. Please ensure DataFetcher.js is included before genieDashboard.js');
            }
            return DataFetcher.fetchPanelData(
                panel,
                previousOffset,
                previousDuration,
                failedTargetsOnly,
                this.inputConfig,
                this.dashboardConfig,
                (query, offset) => this.processQuery(query, offset, panel && panel._expertName ? panel._expertName : null),
                (target, panel) => DataFetcher.getEndpointForTarget(target, panel, this.inputConfig, this.dashboardConfig),
                (endpoint, query, start, end, refId, prevDur, ds, regex, cache) => DataFetcher.fetchData(endpoint, query, start, end, refId, prevDur, ds, regex, cache),
                (fieldName, config) => QueryProcessor.getInputConfigValue(fieldName, config)
            );
        }

        /**
         * Parse duration string (e.g., "7d", "30d", "1w") to milliseconds
         */
        /**
         * Parse duration string to milliseconds
         * Delegates to DataUtils module
         * @param {string} durationStr - Duration string (e.g., "7d", "30d", "1w")
         * @returns {number} Duration in milliseconds
         */
        parseDuration(durationStr) {
            return DataUtils.parseDuration(durationStr);
        }

        /**
         * Validate input configuration
         * Delegates to ConfigParser module
         * @param {Object} config - Input config object to validate
         * @returns {boolean} True if valid, false otherwise
         */
        validateInputConfig(config) {
            if (typeof ConfigParser === 'undefined' || !ConfigParser.validateInputConfig) {
                throw new Error('GenieDashboard: ConfigParser module is required but not loaded. Please ensure ConfigParser.js is included before genieDashboard.js');
            }
            return ConfigParser.validateInputConfig(config);
        }

        /**
         * Get value from inputConfig supporting both old and new formats
         * Old format: { "$cell": "usa12" }
         * New format: { "cell": { "value": "usa12", "placeholders": ["$cell", "$cellkey"] } }
         * @param {string} fieldName - Field name (e.g., "cell", "substrate")
         * @param {Object} config - Input config object
         * @returns {*} The value if found, undefined otherwise
         */

        /**
         * Get value from input config
         * Delegates to QueryProcessor module
         * @param {string} fieldName - Field name
         * @param {Object} config - Input config object
         * @returns {*} Field value or undefined
         */
        /**
         * Get value from input config, supporting multiple formats
         * Delegates to QueryProcessor module
         * @param {string} fieldName - Field name (e.g., "Cell", "Start")
         * @param {Object} config - Input config object
         * @returns {*} Field value or undefined
         */
        getInputConfigValue(fieldName, config) {
            return QueryProcessor.getInputConfigValue(fieldName, config);
        }

        /**
         * Get effective input config for a given expert, merging base + expert values
         * Expert values override base values when both exist
         * @param {string|null} expertName - Expert name or null
         * @returns {Object} Merged input config
         */
        getEffectiveInputConfig(expertName = null) {
            const baseConfig = this.inputConfig && typeof this.inputConfig === 'object' && !Array.isArray(this.inputConfig)
                ? this.inputConfig
                : {};
            if (!expertName) {
                return baseConfig;
            }
            const expertConfig = (this.expertInputConfigs &&
                this.expertInputConfigs[expertName] &&
                typeof this.expertInputConfigs[expertName] === 'object' &&
                !Array.isArray(this.expertInputConfigs[expertName]))
                ? this.expertInputConfigs[expertName]
                : null;
            if (!expertConfig) {
                return baseConfig;
            }
            return Object.assign({}, baseConfig, expertConfig);
        }

        /**
         * Get a mutable input config object for writes
         * Ensures expert config is stored on the instance and returned by reference
         * @param {string|null} expertName - Expert name or null
         * @returns {Object} Config object to update
         */
        getInputConfigForWrite(expertName = null) {
            if (!this.inputConfig || typeof this.inputConfig !== 'object' || Array.isArray(this.inputConfig)) {
                this.inputConfig = {};
            }
            if (!expertName) {
                return this.inputConfig;
            }
            if (!this.expertInputConfigs || typeof this.expertInputConfigs !== 'object' || Array.isArray(this.expertInputConfigs)) {
                this.expertInputConfigs = {};
            }
            if (!this.expertInputConfigs[expertName] || typeof this.expertInputConfigs[expertName] !== 'object' || Array.isArray(this.expertInputConfigs[expertName])) {
                this.expertInputConfigs[expertName] = {};
            }
            return this.expertInputConfigs[expertName];
        }


        /**
         * Set value in inputConfig using new format
         * Creates new format structure if it doesn't exist, or updates existing value
         * Also maintains old format for backward compatibility
         * @param {string} fieldName - Field name (e.g., "Cell", "Substrate")
         * @param {*} value - Value to set
         * @param {Array<string>} placeholders - Array of placeholder strings (optional, only used if creating new format)
         */
        setInputConfigValue(fieldName, value, placeholders = null, targetConfig = null) {
            try {
                let configToUpdate = targetConfig;
                if (placeholders && typeof placeholders === 'object' && !Array.isArray(placeholders)) {
                    configToUpdate = placeholders;
                    placeholders = null;
                }

                if (!configToUpdate || typeof configToUpdate !== 'object' || Array.isArray(configToUpdate)) {
                    if (!this.inputConfig) {
                        this.inputConfig = {};
                    }
                    configToUpdate = this.inputConfig;
                }

                if (!fieldName || typeof fieldName !== 'string') {
                    console.error('GenieDashboard: setInputConfigValue - invalid fieldName:', fieldName);
                    return;
                }

                // Get lowercase version for old format compatibility
                const lowerFieldName = fieldName.charAt(0).toLowerCase() + fieldName.slice(1);

                // Validate placeholders if provided
                if (placeholders !== null && !Array.isArray(placeholders)) {
                    console.warn(`GenieDashboard: setInputConfigValue - placeholders for '${fieldName}' must be an array, got:`, typeof placeholders);
                    placeholders = null;
                }

                // Get the placeholders to use (from parameter or existing config)
                const placeholdersToUse = placeholders ||
                    (configToUpdate[fieldName] && Array.isArray(configToUpdate[fieldName].placeholders)
                        ? configToUpdate[fieldName].placeholders
                        : ['$' + lowerFieldName]);

                // Update or create new format
                if (!configToUpdate[fieldName] || typeof configToUpdate[fieldName] !== 'object' || Array.isArray(configToUpdate[fieldName])) {
                    // Create new format structure
                    configToUpdate[fieldName] = {
                        value: value,
                        placeholders: placeholdersToUse
                    };
                } else {
                    // Update existing new format
                    configToUpdate[fieldName].value = value;
                    // Update placeholders if provided
                    if (placeholders && Array.isArray(placeholders)) {
                        configToUpdate[fieldName].placeholders = placeholders;
                    }
                }

                // Also maintain old format for backward compatibility
                // Update ALL placeholders in the placeholders array as old format keys
                placeholdersToUse.forEach(placeholder => {
                    if (placeholder && typeof placeholder === 'string' && placeholder.startsWith('$')) {
                        configToUpdate[placeholder] = value;
                    }
                });

                // Also update the default old format key (lowercase field name) for backward compatibility
                const oldFormatKey = '$' + lowerFieldName;
                if (!placeholdersToUse.includes(oldFormatKey)) {
                    configToUpdate[oldFormatKey] = value;
                }
            } catch (error) {
                console.error(`GenieDashboard: Error in setInputConfigValue for field '${fieldName}':`, error);
                throw error;
            }
        }

        /**
         * Get placeholders array for a specific field from inputConfig
         * @param {string} fieldName - Field name (e.g., "HFInstance", "Cell")
         * @param {Object} config - Input config object
         * @returns {Array} Array of placeholder strings
         */
        getPlaceholdersForField(fieldName, config) {
            if (typeof QueryProcessor === 'undefined' || !QueryProcessor.getPlaceholdersForField) {
                throw new Error('GenieDashboard: QueryProcessor module is required but not loaded. Please ensure QueryProcessor.js is included before genieDashboard.js');
            }
            return QueryProcessor.getPlaceholdersForField(fieldName, config);
        }

        /**
         * Update inputConfig from an input field value, using placeholders from inputConfig
         * This centralizes the logic to avoid duplication
         * @param {string} fieldName - Field name (e.g., "Cell", "HFInstance", "Substrate")
         * @param {string} inputElementId - ID of the input element (without instance prefix)
         * @param {Function} valueProcessor - Optional function to process the value (e.g., trim)
         * @returns {boolean} True if the field was updated, false otherwise
         */
        updateInputConfigFromField(fieldName, inputElementId, valueProcessor = null) {
            try {
                const inputElement = document.getElementById(this.getInstanceId(inputElementId));
                if (!inputElement) {
                    return false;
                }

                let value = inputElement.value || inputElement.textContent || '';
                if (!value) {
                    return false;
                }

                // Apply value processor if provided (e.g., trim)
                if (valueProcessor && typeof valueProcessor === 'function') {
                    value = valueProcessor(value);
                    if (!value) {
                        return false;
                    }
                }

                // Get existing placeholders from inputConfig
                let existingPlaceholders = this.getPlaceholdersForField(fieldName, this.inputConfig);

                // If no placeholders found in inputConfig, try to get them from the original inputJson
                if (!existingPlaceholders || existingPlaceholders.length === 0) {
                    if (this.inputJson && this.inputJson[fieldName]) {
                        const fieldConfig = this.inputJson[fieldName];
                        if (fieldConfig && typeof fieldConfig === 'object' && !Array.isArray(fieldConfig)) {
                            if (Array.isArray(fieldConfig.placeholders)) {
                                existingPlaceholders = fieldConfig.placeholders;
                                console.log(`📋 Found placeholders for '${fieldName}' in inputJson:`, existingPlaceholders);
                            }
                        }
                    }
                }

                // If still no placeholders, check knownFieldMappings as fallback
                if (!existingPlaceholders || existingPlaceholders.length === 0) {
                    const knownFieldMappings = {
                        'Cell': ['$cell', '$cellkey'],
                        'Substrate': ['$substrate', '$sub'],
                        'HFInstance': ['$fi', '$hfInstance', '$falcon_instance', '$instance', '$fd_instance', '$hFInstance'],
                        'Domain': ['$fd', '$domain', '$functional_domain'],
                        'Span': ['$interval', '$span'],
                        'Aggregate': ['$agg', '$aggregate', '$aggregation']
                    };
                    if (knownFieldMappings[fieldName]) {
                        existingPlaceholders = knownFieldMappings[fieldName];
                        console.log(`📋 Using knownFieldMappings for '${fieldName}':`, existingPlaceholders);
                    }
                }

                // Log what we're about to update
                if (existingPlaceholders && existingPlaceholders.length > 0) {
                    console.log(`📋 Updating '${fieldName}' = '${value}' with placeholders:`, existingPlaceholders);
                } else {
                    console.warn(`⚠️ No placeholders found for '${fieldName}', will use default`);
                }

                // Update inputConfig with the value and placeholders
                this.setInputConfigValue(fieldName, value, existingPlaceholders);

                return true;
            } catch (error) {
                console.error(`GenieDashboard: Error updating inputConfig from field '${fieldName}':`, error);
                return false;
            }
        }

        /**
         * Ensure all input fields have their values saved by triggering blur events
         * and waiting for any pending async operations to complete
         * This is called before refresh to ensure field values are saved even if user
         * didn't blur the field before clicking refresh
         * @returns {Promise} Resolves when all field updates are complete
         */
        async ensureAllInputFieldsSaved() {
            try {
                console.log('📝 Ensuring all input fields are saved before refresh...');

                // Get all input fields that might need blur events
                const cellInput = document.getElementById(this.getInstanceId('toolbar-cell'));
                const intervalInput = document.getElementById(this.getInstanceId('toolbar-interval'));

                // List of promises for async operations that might be triggered
                const pendingOperations = [];

                // Check if cell input is focused and needs to trigger fetchScopes
                if (cellInput && (document.activeElement === cellInput || cellInput.value)) {
                    const cellValue = cellInput.value ? cellInput.value.trim() : '';
                    if (cellValue && this.fetchScopesFunction) {
                        const start = this.inputConfig ? (this.getInputConfigValue('Start', this.inputConfig) || this.getInputConfigValue('start', this.inputConfig) || this.inputConfig['$start']) : null;
                        const end = this.inputConfig ? (this.getInputConfigValue('End', this.inputConfig) || this.getInputConfigValue('end', this.inputConfig) || this.inputConfig['$end']) : null;
                        if (start && end) {
                            console.log('📝 Cell field has value, fetching scopes before refresh...');
                            // Directly call fetchScopes and wait for it
                            pendingOperations.push(this.fetchScopesFunction());
                        }
                    }

                    // Also trigger blur event to ensure any other blur handlers run
                    if (document.activeElement === cellInput) {
                        console.log('📝 Triggering blur on cell input field');
                        const blurEvent = new Event('blur', {bubbles: true, cancelable: true});
                        cellInput.dispatchEvent(blurEvent);
                    }
                }

                // Trigger blur on other input fields if they're focused
                if (intervalInput && document.activeElement === intervalInput) {
                    console.log('📝 Triggering blur on interval input field');
                    const blurEvent = new Event('blur', {bubbles: true, cancelable: true});
                    intervalInput.dispatchEvent(blurEvent);
                }

                // Also trigger blur on any templating input fields
                if (this.dashboardConfig && this.dashboardConfig.templating && this.dashboardConfig.templating.list) {
                    this.dashboardConfig.templating.list.forEach(templateVar => {
                        if (!templateVar || !templateVar.name) return;
                        const varName = templateVar.name;
                        const inputId = this.getInstanceId(`toolbar-${varName}`);
                        const inputElement = document.getElementById(inputId);
                        if (inputElement && document.activeElement === inputElement) {
                            console.log(`📝 Triggering blur on templating field: ${varName}`);
                            const blurEvent = new Event('blur', {bubbles: true, cancelable: true});
                            inputElement.dispatchEvent(blurEvent);
                        }
                    });
                }

                // Wait for all pending async operations to complete
                if (pendingOperations.length > 0) {
                    console.log(`📝 Waiting for ${pendingOperations.length} pending async operation(s) to complete...`);
                    await Promise.all(pendingOperations);
                    console.log('📝 All pending async operations completed');
                }

                // Small delay to ensure any synchronous blur handlers have completed
                await new Promise(resolve => setTimeout(resolve, 50));

                console.log('📝 All input fields saved');
            } catch (error) {
                console.error('GenieDashboard: Error ensuring input fields are saved:', error);
                // Don't throw - continue with refresh even if there's an error
            }
        }

        /**
         * Get all placeholder mappings from inputConfig
         * Returns a map of placeholder -> value for all fields
         * Supports both old and new formats
         * @param {Object} config - Input config object
         * @returns {Map} Map of placeholder string to value
         */

        /**
         * Get placeholder mappings from config
         * Delegates to QueryProcessor module
         * @param {Object} config - Input config object
         * @returns {Map} Map of placeholder string to value
         */
        /**
         * Get placeholder mappings from config
         * Delegates to QueryProcessor module
         * @param {Object} config - Input config object
         * @returns {Map} Map of placeholder string to value
         */
        getPlaceholderMappings(config) {
            return QueryProcessor.getPlaceholderMappings(this, config);
        }


        /**
         * Replace placeholders in a string (e.g., panel title) with inputConfig values
         * @param {string} text - Text containing placeholders (e.g., "$cell - $substrate")
         * @param {Object} config - Optional config to use (defaults to this.inputConfig)
         * @returns {string} Text with placeholders replaced
         */

        /**
         * Replace placeholders in a string with inputConfig values
         * Delegates to QueryProcessor module
         * @param {string} text - Text containing placeholders
         * @param {Object} config - Optional config to use
         * @returns {string} Text with placeholders replaced
         */
        /**
         * Replace placeholders in a string (e.g., panel title) with inputConfig values
         * Delegates to QueryProcessor module
         * @param {string} text - Text containing placeholders (e.g., "$cell - $substrate")
         * @param {Object} config - Optional config to use (defaults to dashboard.inputConfig)
         * @returns {string} Text with placeholders replaced
         */
        replacePlaceholdersInText(text, config = null) {
            return QueryProcessor.replacePlaceholdersInText(this, text, config);
        }


        /**
         * Process query string by replacing placeholders
         */
        processQuery(query, previousOffset = 0, expertName = null) {
            if (!query || typeof query !== 'string') {
                // Return in new format for consistency
                return {
                    processed: query || '',
                    hasUnreplacedPlaceholders: false,
                    unreplacedPlaceholders: []
                };
            }

            let processed = query;

            // Use expert config if expertName is provided, otherwise use global inputConfig
            const configToUse = this.getEffectiveInputConfig(expertName);

            // Create a copy of config with adjusted times if previousOffset is provided
            // Use shallow copy with spread operator to avoid JSON serialization issues
            let config = {};
            try {
                if (configToUse) {
                    if (typeof configToUse !== 'object' || Array.isArray(configToUse)) {
                        console.error('GenieDashboard: processQuery - config must be an object, got:', typeof configToUse);
                        return query; // Return original query if config is invalid
                    }
                    config = {...configToUse};
                }
            } catch (error) {
                console.error('GenieDashboard: processQuery - Error copying config:', error);
                return query; // Return original query if copy fails
            }

            const periodType = previousOffset > 0 ? 'PREVIOUS PERIOD' : 'CURRENT PERIOD';

            if (previousOffset > 0) {
                try {
                    // Handle time fields with new format support
                    const startValue = this.getInputConfigValue('Start', config) || this.getInputConfigValue('start', config) || config.$start;
                    const endValue = this.getInputConfigValue('End', config) || this.getInputConfigValue('end', config) || config.$end;
                    if (startValue && endValue) {
                        const adjustedStart = startValue - previousOffset;
                        const adjustedEnd = endValue - previousOffset;

                        const startDate = new Date(adjustedStart);
                        const endDate = new Date(adjustedEnd);
                        const startUTC = startDate.toISOString();
                        const endUTC = endDate.toISOString();
                        const startUTCDisplay = startDate.toLocaleString('en-US', {timeZone: 'UTC', hour12: false});
                        const endUTCDisplay = endDate.toLocaleString('en-US', {timeZone: 'UTC', hour12: false});

                        console.log(`🔄 PROCESS QUERY [${periodType}] - Adjusting timestamps`);
                        console.log(`  Original Start: ${startValue} (${new Date(startValue).toISOString()})`);
                        console.log(`  Original End:   ${endValue} (${new Date(endValue).toISOString()})`);
                        console.log(`  Previous Offset: ${previousOffset}ms (${Math.floor(previousOffset / (24 * 60 * 60 * 1000))} days)`);
                        console.log(`  Adjusted Start: ${adjustedStart} (${startUTC}) - ${startUTCDisplay} UTC`);
                        console.log(`  Adjusted End:   ${adjustedEnd} (${endUTC}) - ${endUTCDisplay} UTC`);

                        // Update in new format if it exists (must update both Start/start and End/end)
                        if (config.Start && typeof config.Start === 'object' && !Array.isArray(config.Start)) {
                            config.Start = {...config.Start, value: adjustedStart};
                        } else if (config.start && typeof config.start === 'object' && !Array.isArray(config.start)) {
                            config.start = {...config.start, value: adjustedStart};
                        }

                        if (config.End && typeof config.End === 'object' && !Array.isArray(config.End)) {
                            config.End = {...config.End, value: adjustedEnd};
                        } else if (config.end && typeof config.end === 'object' && !Array.isArray(config.end)) {
                            config.end = {...config.end, value: adjustedEnd};
                        }

                        // Update in old format for backward compatibility
                        config.$start = adjustedStart;
                        config.$end = adjustedEnd;
                    } else if (config.$start && config.$end) {
                        // Old format only
                        const originalStart = config.$start;
                        const originalEnd = config.$end;
                        config.$start = config.$start - previousOffset;
                        config.$end = config.$end - previousOffset;

                        const startDate = new Date(config.$start);
                        const endDate = new Date(config.$end);
                        console.log(`🔄 PROCESS QUERY [${periodType}] - Adjusting timestamps (old format only)`);
                        console.log(`  Original Start: ${originalStart} (${new Date(originalStart).toISOString()})`);
                        console.log(`  Original End:   ${originalEnd} (${new Date(originalEnd).toISOString()})`);
                        console.log(`  Previous Offset: ${previousOffset}ms`);
                        console.log(`  Adjusted Start: ${config.$start} (${startDate.toISOString()})`);
                        console.log(`  Adjusted End:   ${config.$end} (${endDate.toISOString()})`);
                    }
                } catch (error) {
                    console.error('GenieDashboard: processQuery - Error adjusting time offsets:', error);
                    // Continue with unadjusted config
                }
            } else {
                // Log current period timestamps
                const startValue = this.getInputConfigValue('Start', config) || this.getInputConfigValue('start', config) || config.$start;
                const endValue = this.getInputConfigValue('End', config) || this.getInputConfigValue('end', config) || config.$end;
                if (startValue && endValue) {
                    const startDate = new Date(startValue);
                    const endDate = new Date(endValue);
                    console.log(`🔄 PROCESS QUERY [${periodType}] - Using current period timestamps`);
                    console.log(`  Start: ${startValue} (${startDate.toISOString()}) - ${startDate.toLocaleString('en-US', {
                        timeZone: 'UTC',
                        hour12: false
                    })} UTC`);
                    console.log(`  End:   ${endValue} (${endDate.toISOString()}) - ${endDate.toLocaleString('en-US', {
                        timeZone: 'UTC',
                        hour12: false
                    })} UTC`);
                }
            }

            // Get all placeholder mappings (supports both old and new formats)
            const placeholderMappings = this.getPlaceholderMappings(config);

            // Log all placeholder replacements
            if (placeholderMappings.size > 0) {
                console.log(`📝 PLACEHOLDER REPLACEMENTS [${periodType}]:`);
                const sortedKeys = Array.from(placeholderMappings.keys()).sort();
                sortedKeys.forEach(placeholder => {
                    const value = placeholderMappings.get(placeholder);
                    if (placeholder === '$start' || placeholder === '$end') {
                        // Special formatting for timestamps
                        const date = new Date(value);
                        const iso = date.toISOString();
                        const display = date.toLocaleString('en-US', {timeZone: 'UTC', hour12: false});
                        console.log(`  ${placeholder} → ${value} (${iso}) - ${display} UTC`);
                    } else {
                        console.log(`  ${placeholder} → ${value}`);
                    }
                });
            } else {
                console.warn(`⚠️ PLACEHOLDER REPLACEMENTS [${periodType}]: No placeholders found in mappings!`);
            }

            // Check for unreplaced placeholders in the query
            const unreplacedPlaceholders = query.match(/\$[a-zA-Z_][a-zA-Z0-9_]*/g);
            if (unreplacedPlaceholders && unreplacedPlaceholders.length > 0) {
                const uniqueUnreplaced = [...new Set(unreplacedPlaceholders)];
                const missingPlaceholders = uniqueUnreplaced.filter(ph => !placeholderMappings.has(ph));
                if (missingPlaceholders.length > 0) {
                    console.warn(`⚠️ MISSING PLACEHOLDERS [${periodType}]: ${missingPlaceholders.join(', ')} - These will NOT be replaced!`);
                    console.warn(`  Available placeholders: [${Array.from(placeholderMappings.keys()).join(', ')}]`);
                    console.warn(`  Query contains: [${uniqueUnreplaced.join(', ')}]`);
                }
            }

            // Sort placeholders by length (longest first) to avoid partial replacements
            // (e.g., $substrate should be replaced before $sub if both exist)
            const sortedPlaceholders = Array.from(placeholderMappings.keys())
                .sort((a, b) => b.length - a.length);

            for (const placeholder of sortedPlaceholders) {
                const value = placeholderMappings.get(placeholder);
                if (value !== undefined && value !== null) {
                    // Convert value to string for replacement
                    // For timestamps (numbers), keep as number in string form
                    const stringValue = String(value);

                    // Escape special regex characters in the placeholder
                    // Since placeholder starts with $, we need to escape $ and other special chars
                    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                    // Create regex that matches the placeholder exactly
                    // Need to match: $variable followed by non-word character (:, }, #, -, etc.) or end of string
                    // Use negative lookahead to ensure we don't match partial variable names
                    // Match $variable not followed by alphanumeric, underscore, or $
                    const regex = new RegExp(escapedPlaceholder + '(?![a-zA-Z0-9_$])', 'g');
                    processed = processed.replace(regex, stringValue);
                }
            }

            // Replace QEURY placeholder (URL encoded query)
            if (processed.includes('QEURY')) {
                // Will be replaced when constructing the final URL
            }

            // Check for unreplaced placeholders in processed query
            // System variables ($start, $end, $interval, $span) are always available and should not block execution
            const systemVariables = ['start', 'end', 'interval', 'span'];
            const finalUnreplaced = processed.match(/\$[a-zA-Z_][a-zA-Z0-9_]*/g);
            let unreplacedNonSystem = [];
            if (finalUnreplaced && finalUnreplaced.length > 0) {
                const uniqueFinalUnreplaced = [...new Set(finalUnreplaced)];
                // Filter out system variables - they're always available
                unreplacedNonSystem = uniqueFinalUnreplaced.filter(ph => {
                    const varName = ph.substring(1).toLowerCase(); // Remove $ and lowercase
                    return !systemVariables.includes(varName);
                });

                if (unreplacedNonSystem.length > 0) {
                    console.warn(`⚠️ UNREPLACED PLACEHOLDERS IN FINAL QUERY [${periodType}]: ${unreplacedNonSystem.join(', ')}`);
                    console.warn(`⚠️ Query will NOT be executed - missing required placeholders: ${unreplacedNonSystem.join(', ')}`);
                } else if (uniqueFinalUnreplaced.length > 0) {
                    // Only system variables remain, which is OK
                    console.log(`ℹ️ Only system variables remain in query [${periodType}]: ${uniqueFinalUnreplaced.join(', ')} - OK to execute`);
                }
            }

            // Debug logging to verify replacements
            if (processed !== query) {
                const replacedPlaceholders = sortedPlaceholders.filter(k => query.includes(k));
                //console.log(`✅ QUERY PROCESSED [${periodType}]:`);
                //console.log(`  Original: ${query.substring(0, 200)}${query.length > 200 ? '...' : ''}`);
                //console.log(`  Processed: ${processed.substring(0, 200)}${processed.length > 200 ? '...' : ''}`);
                console.log(`QUERY PROCESSED [${periodType}]:  Placeholders replaced: ${replacedPlaceholders.length} - [${replacedPlaceholders.join(', ')}]`);
            } else if (query && query.includes('$')) {
                console.warn(`⚠️ processQuery [${periodType}] - No replacements made for query containing $:`, query.substring(0, 200));
                const availablePlaceholders = Array.from(placeholderMappings.keys());
                console.warn(`  Available placeholders: [${availablePlaceholders.join(', ')}]`);
            }

            // Return both processed query and unreplaced placeholders info
            return {
                processed: processed,
                hasUnreplacedPlaceholders: unreplacedNonSystem.length > 0,
                unreplacedPlaceholders: unreplacedNonSystem
            };
        }

        /**
         * Get endpoint URL for a target based on datasource type
         * @param {Object} target - Target/query object
         * @param {Object} panel - Optional panel object to check panel-level datasource
         */
        getEndpointForTarget(target, panel = null) {
            if (typeof DataFetcher === 'undefined' || !DataFetcher.getEndpointForTarget) {
                throw new Error('GenieDashboard: DataFetcher module is required but not loaded. Please ensure DataFetcher.js is included before genieDashboard.js');
            }
            return DataFetcher.getEndpointForTarget(target, panel, this.inputConfig, this.dashboardConfig);
        }

        /**
         * Fetch data from REST endpoint
         * @param {string} endpoint - REST endpoint URL
         * @param {string} query - Processed query string
         * @param {number} [startTimestamp] - Optional start timestamp for the data range
         * @param {number} [endTimestamp] - Optional end timestamp for the data range
         * @param {string} [refId] - Target reference ID
         * @param {string} [previousDuration] - Previous period duration string (e.g., "-7d") if fetching previous period data
         * @param {string} [datasource] - Datasource type/identifier for the target
         */
        async fetchData(endpoint, query, startTimestamp = null, endTimestamp = null, refId = null, previousDuration = null, datasource = null, regex = null) {
            if (typeof DataFetcher === 'undefined' || !DataFetcher.fetchData) {
                throw new Error('GenieDashboard: DataFetcher module is required but not loaded. Please ensure DataFetcher.js is included before genieDashboard.js');
            }
            return DataFetcher.fetchData(endpoint, query, startTimestamp, endTimestamp, refId, previousDuration, datasource, regex, this.dataCache);
        }

        /**
         * Render chart based on panel type
         */
        renderPanelChart(panel, dataArray, container, header = null, initialPreviousData = null) {
            if (typeof ChartRenderer === 'undefined' || !ChartRenderer.renderPanelChart) {
                throw new Error('GenieDashboard: ChartRenderer module is required but not loaded. Please ensure ChartRenderer.js is included before genieDashboard.js');
            }
            return ChartRenderer.renderPanelChart(panel, dataArray, container, header, initialPreviousData, {
                renderTimeSeriesChart: (panel, dataArray, container, header) => this.renderTimeSeriesChart(panel, dataArray, container, header),
                renderStatChart: (panel, dataArray, container) => this.renderStatChart(panel, dataArray, container),
                renderTableChart: (panel, dataArray, container) => this.renderTableChart(panel, dataArray, container),
                renderPieChart: (panel, dataArray, container) => this.renderPieChart(panel, dataArray, container),
                renderGaugeChart: (panel, dataArray, container) => this.renderGaugeChart(panel, dataArray, container),
                renderBarGaugeChart: (panel, dataArray, container) => this.renderBarGaugeChart(panel, dataArray, container),
                processPanelDataForSeries: (panel, dataArray, initialPreviousData) => this.processPanelDataForSeries(panel, dataArray, initialPreviousData),
                updatePerformanceDisplay: (panel) => this.updatePerformanceDisplay(panel),
                inputConfig: this.inputConfig
            });
        }

        /**
         * Update performance display in panel header
         */
        updatePerformanceDisplay(panel) {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.updatePerformanceDisplay) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            return PanelUtils.updatePerformanceDisplay(panel);
        }

        /**
         * Render timeseries chart with tabs
         */
        renderTimeSeriesChart(panel, dataArray, container, header = null) {
            if (typeof ChartRenderer === 'undefined' || !ChartRenderer.renderTimeSeriesChart) {
                throw new Error('GenieDashboard: ChartRenderer module is required but not loaded. Please ensure ChartRenderer.js is included before genieDashboard.js');
            }
            return ChartRenderer.renderTimeSeriesChart(panel, dataArray, container, header, {
                    getInstanceId: (id) => this.getInstanceId(id),
                    inputConfig: this.inputConfig,
                    instanceId: this.instanceId,
                    container: this.container,
                    charts: this.charts,
                    transformDataForChart: (data, panel, prevDur) => ChartUtils.transformDataForChart(data, panel, prevDur, this.inputConfig, ChartUtils.getSeriesName, DataProcessor.extractDataPoints, DataUtils.parseDuration, DataProcessor.applySeriesAggregation, ChartUtils.getSeriesColor),
                    calculatePanelLayout: (config) => this.calculatePanelLayout(config),
                    createListLegend: (container, chart, panel, placement) => this.createListLegend(container, chart, panel, placement),
                    setupTooltipHandlers: (canvas, chart, chartContent, panel) => this.setupTooltipHandlers(canvas, chart, chartContent, panel),
                    setupChartContextMenu: (canvas, chart, panel) => this.setupChartContextMenu(canvas, chart, panel),
                    showPanelSettings: (panel) => this.showPanelSettings(panel),
                    downloadPanelData: (panel, dataArray) => this.downloadPanelData(panel, dataArray),
                    getInputConfigValue: (fieldName, config) => QueryProcessor.getInputConfigValue(fieldName, config),
                    rowHeightPerUnit: this.rowHeightPerUnit,
                    renderStatsTable: (panel, dataArray, container, statsToShow, previousDataArray, isTransposed, previousDuration) => this.renderStatsTable(panel, dataArray, container, statsToShow, previousDataArray, isTransposed, previousDuration),
                    applySpanAggregationToAllSeries: (dataArray, span, spanAggregationType) => DataProcessor.applySpanAggregationToAllSeries(dataArray, span, spanAggregationType, DataProcessor.extractDataPoints, DataUtils.parseDuration),
                    applyFieldConfigToChart: (chart, panel) => this.applyFieldConfigToChart(chart, panel),
                    applyZoomToAllCharts: (panel, zoomRange) => this.applyZoomToAllCharts(panel, zoomRange),
                    _genieAlignedYAxisTicks: this._genieAlignedYAxisTicks,
                    value: this.value,
                    parseDuration: (duration) => DataUtils.parseDuration(duration),
                    fetchPanelData: (panel, previousOffset, previousDuration, failedTargetsOnly) => DataFetcher.fetchPanelData(panel, previousOffset, previousDuration, failedTargetsOnly, this.inputConfig, this.dashboardConfig, (query, offset, expertName) => this.processQuery(query, offset, expertName), (target, panel, inputConfig, dashboardConfig) => DataFetcher.getEndpointForTarget(target, panel, inputConfig, dashboardConfig), (endpoint, query, start, end, refId, previousDuration, dsType, regex) => this.fetchData(endpoint, query, start, end, refId, previousDuration, dsType, regex), (fieldName, config) => QueryProcessor.getInputConfigValue(fieldName, config)),
                    showPanelError: (panel, content, failedTargets) => this.showPanelError(panel, content, failedTargets),
                    dashboardConfig: this.dashboardConfig,
                    processQuery: (query, offset, expertName) => this.processQuery(query, offset, expertName),
                    getEndpointForTarget: (target, panel) => this.getEndpointForTarget(target, panel),
                    fetchData: (endpoint, query, start, end, refId, previousDuration, dsType, regex) => this.fetchData(endpoint, query, start, end, refId, previousDuration, dsType, regex)
                }
            );
        }

        /**
         * Calculate statistics for a series
         */
        calculateSeriesStats(values, statsToShow, seriesName = null) {
            if (typeof ChartUtils === 'undefined' || !ChartUtils.calculateSeriesStats) {
                throw new Error('GenieDashboard: ChartUtils module is required but not loaded. Please ensure ChartUtils.js is included before genieDashboard.js');
            }
            return ChartUtils.calculateSeriesStats(values, statsToShow, seriesName);
        }

        /**
         * Create a custom list legend with vertical scroll
         */
        createListLegend(container, chart, panel) {
            if (typeof LegendManager === 'undefined' || !LegendManager.createListLegend) {
                throw new Error('GenieDashboard: LegendManager module is required but not loaded. Please ensure LegendManager.js is included before genieDashboard.js');
            }
            return LegendManager.createListLegend(container, chart, panel, {
                createTooltipLegend: (container, chart, panel, placement) => this.createTooltipLegend(container, chart, panel, placement)
            });
        }


        /**
         * Create a tooltip legend - shows only first item, hover shows popup with all items
         */
        createTooltipLegend(container, chart, panel, placement) {
            //console.log(`[createTooltipLegend] Called for panel ${panel.id}, placement: ${placement}`);
            // Store dashboard instance for use in event handlers
            const dashboard = this;
            const panelId = panel.id;

            // Get panel element once for reuse

            // Check if TooltipLegend module is available
            if (typeof window === 'undefined' || !window.TooltipLegend) {
                console.error('[TooltipLegend] TooltipLegend module not loaded. Please include tooltipLegend.js before genieDashboard.js');
                return;
            }

            const panelElement = container.closest('.genie-dashboard-panel');

            // Get datasets from chart and sort by label
            // Ensure we read from the actual chart instance that was just created
            // Use the chart from dashboard if available (in case chart reference is stale)
            const currentChart = dashboard.charts?.[panelId] || chart;
            const datasets = (currentChart.data.datasets || []).slice();
            //console.log(`[TooltipLegend] Creating with ${datasets.length} datasets from chart:`, datasets.map(d => d.label));

            // Check for existing tooltip legend containers
            const existingTooltipLegend = container.querySelector('.genie-legend-tooltip-container');
            const existingInPanel = panelElement ? panelElement.querySelectorAll('.genie-legend-tooltip-container') : [];
            const existingPopups = panelElement ? panelElement.querySelectorAll('.genie-legend-tooltip-popup') : [];
            //console.log(`[TooltipLegend] Before creation - Found ${existingTooltipLegend ? 1 : 0} tooltip container in container, ${existingInPanel.length} in panel, ${existingPopups.length} popups`);

            // Check if existing legend is still valid (same chart reference stored on it)
            // IMPORTANT: Only preserve if chart reference matches AND chart is not destroyed
            // Also check if legend was just created (has _justCreated flag) - don't remove it if it was just created
            let shouldPreserveLegend = false;
            if (existingInPanel.length > 0) {
                const firstExisting = existingInPanel[0];
                const storedChart = firstExisting._tooltipLegendChart;
                const justCreated = firstExisting._justCreated === true;

                // If legend was just created, always preserve it (it's for the current chart)
                if (justCreated) {
                    //console.log(`[TooltipLegend] Existing legend was just created, preserving it`);
                    shouldPreserveLegend = true;
                    // Clear the flag after first check
                    firstExisting._justCreated = false;
                } else if (storedChart === currentChart && currentChart && !currentChart.destroyed) {
                    // If the stored chart reference matches the current chart AND chart is not destroyed, preserve the legend
                    //console.log(`[TooltipLegend] Existing legend is still valid (same chart reference, chart not destroyed), preserving it`);
                    shouldPreserveLegend = true;
                } else {
                    //console.log(`[TooltipLegend] Existing legend is for different chart or chart was destroyed (storedChart: ${storedChart === currentChart ? 'same' : 'different'}, currentChart.destroyed: ${currentChart?.destroyed}), removing and recreating`);
                }
            }

            // Only remove existing legend if it's not valid or if datasets changed
            if (!shouldPreserveLegend && (existingTooltipLegend || existingInPanel.length > 0)) {
                console.log(`[TooltipLegend] Removing ${existingInPanel.length} existing tooltip container(s) and ${existingPopups.length} popup(s)`);
                // Remove all existing tooltip containers
                existingInPanel.forEach(container => container.remove());
                existingPopups.forEach(popup => popup.remove());
                // Also remove from container if found there
                if (existingTooltipLegend) {
                    existingTooltipLegend.remove();
                }
            } else if (shouldPreserveLegend) {
                // Legend is preserved, just update its position and visibility
                console.log(`[TooltipLegend] Preserving existing legend, just updating position`);
                const preservedLegend = existingInPanel[0];
                if (preservedLegend) {
                    // Update position
                    setTimeout(() => {
                        try {
                            if (currentChart && currentChart.chartArea) {
                                const leftOffset = currentChart.chartArea.left || 0;
                                preservedLegend.style.left = leftOffset + 'px';
                            }
                        } catch (error) {
                            console.warn('[TooltipLegend] Error updating preserved legend position:', error);
                        }
                    }, 100);
                }
                return; // Don't create a new legend, we're preserving the existing one
            }
            const datasetsWithIndex = datasets.map((dataset, idx) => ({
                dataset: dataset,
                originalIndex: idx
            }));
            // Sort by values in descending order if available, otherwise by labels
            // Note: For custom tooltip legend, we sort by labels since values aren't available at creation time
            // Chart.js tooltips will sort by values when hovering (see itemSort function)
            datasetsWithIndex.sort((a, b) => {
                const labelA = (a.dataset.label || '').toLowerCase();
                const labelB = (b.dataset.label || '').toLowerCase();
                return labelA.localeCompare(labelB);
            });

            if (datasetsWithIndex.length === 0) return;

            //console.log(`[TooltipLegend] Sorted ${datasetsWithIndex.length} datasets:`, datasetsWithIndex.map(item => item.dataset.label));

            // Create legend container at top
            const legendContainer = document.createElement('div');
            legendContainer.className = 'genie-legend-tooltip-container';

            // Function to update legend position using module
            const updateLegendPosition = () => {
                window.TooltipLegend.updatePosition({
                    legendContainer: legendContainer,
                    chart: currentChart,
                    dashboard: dashboard,
                    panelId: panelId
                });
            };


            // Calculate initial top position based on layout
            // The layout calculation expects tooltip legend after header
            // Get header height to position legend correctly
            const headerElement = panelElement?.querySelector('.genie-dashboard-panel-header');
            const headerHeight = headerElement ? (headerElement.offsetHeight || 42) : 42;
            const initialTop = headerHeight; // Position after header

            // Set initial position - will be updated by layout calculation, but set a reasonable default
            legendContainer.style.cssText = `
            position: absolute;
            top: ${initialTop}px;
            left: 0px;
            z-index: 5;
            display: none;
            align-items: center;
        `.replace(/\s+/g, ' ').trim();

            //console.log(`[TooltipLegend] Initial position set to top: ${initialTop}px (header height: ${headerHeight}px)`);

            // Function to update popup max-height and max-width based on chart dimensions + legend container height
            const updatePopupMaxHeight = () => {
                try {
                    const currentChart = dashboard.charts?.[panelId] || chart;
                    let newChartHeight = 300; // Default fallback
                    let newChartWidth = 400; // Default fallback
                    if (currentChart && currentChart.chartArea) {
                        newChartHeight = currentChart.chartArea.height || 300;
                        newChartWidth = currentChart.chartArea.width || 400;
                    } else if (currentChart && currentChart.canvas) {
                        newChartHeight = currentChart.canvas.height || 300;
                        newChartWidth = currentChart.canvas.width || 400;
                    }
                    // Also check chartContent dimensions as fallback
                    const chartContent = panelElement?.querySelector('.genie-dashboard-chart-content');
                    if (chartContent) {
                        if (newChartHeight === 300) {
                            const contentHeight = chartContent.offsetHeight;
                            if (contentHeight > 0) {
                                newChartHeight = contentHeight;
                            }
                        }
                        if (newChartWidth === 400) {
                            const contentWidth = chartContent.offsetWidth;
                            if (contentWidth > 0) {
                                newChartWidth = contentWidth;
                            }
                        }
                    }

                    // Get legend container height (visible item)
                    let legendContainerHeight = 0;
                    if (legendContainer) {
                        legendContainerHeight = legendContainer.offsetHeight || 0;
                    }

                    // Popup max-height = chart height + legend container height
                    // This allows the popup to extend down to fill remaining space
                    const popupMaxHeight = newChartHeight + legendContainerHeight;

                    // Update popup container max-height and max-width
                    if (popupContainer) {
                        popupContainer.style.maxHeight = popupMaxHeight + 'px';
                        popupContainer.style.maxWidth = newChartWidth + 'px';
                    }
                    if (legendList) {
                        legendList.style.maxHeight = popupMaxHeight + 'px';
                    }
                    //console.log(`[TooltipLegend] Updated popup max-height to: ${popupMaxHeight}px (chart: ${newChartHeight}px + container: ${legendContainerHeight}px), max-width to: ${newChartWidth}px`);
                } catch (error) {
                    console.warn('[TooltipLegend] Error updating popup max-height/max-width:', error);
                }
            };

            // Update position after chart is created/updated
            setTimeout(() => {
                updateLegendPosition();
                updatePopupMaxHeight();
            }, 100);

            // Also update on chart resize/update
            if (chart && chart.canvas) {
                const resizeObserver = new ResizeObserver(() => {
                    updateLegendPosition();
                    updatePopupMaxHeight();
                });
                resizeObserver.observe(chart.canvas);
            }

            // Get first dataset
            const firstItem = datasetsWithIndex[0];
            const firstDataset = firstItem.dataset;

            // Create visible legend item using module
            const visibleItemData = window.TooltipLegend.createVisibleItem({
                firstDataset: firstItem.dataset,
                originalIndex: firstItem.originalIndex,
                chart: currentChart,
                dashboard: dashboard,
                panelId: panelId,
                panelElement: panelElement,
                datasetsWithIndex: datasetsWithIndex,
                createEyeIcon: window.TooltipLegend.createEyeIcon
            });
            const {visibleItem, colorBox, label, visibleEyeIcon} = visibleItemData;

            // Get chart dimensions for max-height and max-width calculation
            let chartHeight = 300; // Default fallback
            let chartWidth = 400; // Default fallback
            try {
                const currentChart = dashboard.charts?.[panelId] || chart;
                if (currentChart && currentChart.chartArea) {
                    chartHeight = currentChart.chartArea.height || 300;
                    chartWidth = currentChart.chartArea.width || 400;
                } else if (currentChart && currentChart.canvas) {
                    chartHeight = currentChart.canvas.height || 300;
                    chartWidth = currentChart.canvas.width || 400;
                } else if (chart && chart.canvas) {
                    chartHeight = chart.canvas.height || 300;
                    chartWidth = chart.canvas.width || 400;
                }
                // Also check chartContent dimensions as fallback
                const chartContent = panelElement?.querySelector('.genie-dashboard-chart-content');
                if (chartContent) {
                    if (chartHeight === 300) {
                        const contentHeight = chartContent.offsetHeight;
                        if (contentHeight > 0) {
                            chartHeight = contentHeight;
                        }
                    }
                    if (chartWidth === 400) {
                        const contentWidth = chartContent.offsetWidth;
                        if (contentWidth > 0) {
                            chartWidth = contentWidth;
                        }
                    }
                }
            } catch (error) {
                console.warn('[TooltipLegend] Error getting chart dimensions, using default:', error);
            }

            // Get legend container height (will be calculated after container is created)
            // For now, estimate based on visible item height (~20-25px)
            const estimatedLegendContainerHeight = 25;
            const popupMaxHeight = chartHeight + estimatedLegendContainerHeight;

            //console.log(`[TooltipLegend] Setting popup max-height to: ${popupMaxHeight}px (chart: ${chartHeight}px + container: ~${estimatedLegendContainerHeight}px), max-width to: ${chartWidth}px`);

            // Create popup using module
            const popupContainer = window.TooltipLegend.createPopup({
                datasetsWithIndex: datasetsWithIndex,
                chart: currentChart,
                dashboard: dashboard,
                panelId: panelId,
                panelElement: panelElement,
                chartWidth: chartWidth,
                popupMaxHeight: popupMaxHeight,
                createLegendItem: (config) => window.TooltipLegend.createItem({
                    ...config,
                    createEyeIcon: window.TooltipLegend.createEyeIcon
                })
            });
            const legendList = popupContainer.querySelector('.genie-legend-list');

            // Setup event handlers using module
            window.TooltipLegend.setupHandlers({
                visibleItem: visibleItem,
                popupContainer: popupContainer,
                legendContainer: legendContainer,
                legendList: legendList
            });

            legendContainer.appendChild(visibleItem);
            legendContainer.appendChild(popupContainer);
            // Mark legend as just created to prevent immediate removal
            // Store chart reference on legend container BEFORE appending to DOM
            legendContainer._justCreated = true;
            legendContainer._tooltipLegendChart = currentChart;
            // Append to panelContent instead of chartContent so it can be positioned relative to panelContent
            const panelContent = panelElement?.querySelector('.genie-dashboard-panel-content');
            if (panelContent) {
                panelContent.appendChild(legendContainer);
                //console.log(`[TooltipLegend] Appended legend to panelContent for panel ${panel.id}, marked as just created, chart reference stored`);
            } else {
                // Fallback to container if panelContent not found
                container.appendChild(legendContainer);
                console.log(`[TooltipLegend] Appended legend to container (fallback) for panel ${panel.id}, marked as just created, chart reference stored`);
            }

            // Store reference for updates
            chart._tooltipLegendContainer = legendContainer;
            chart._tooltipLegendPanel = panel;
            chart._tooltipLegendSelf = this; // Store reference to dashboard instance
            chart._updateTooltipLegendPosition = updateLegendPosition; // Store position update function
            // Use current chart to get initial dataset count and labels
            const initialChart = dashboard.charts?.[panelId] || chart;
            chart._tooltipLegendDatasetsCount = (initialChart.data.datasets || []).length; // Track dataset count
            // Track dataset labels as a string to detect changes even when count stays same
            chart._tooltipLegendDatasetLabels = (initialChart.data.datasets || []).map(d => d.label || '').join('|');

            // Log after creation to verify it was added
            const afterCreationContainers = panelElement ? panelElement.querySelectorAll('.genie-legend-tooltip-container') : [];
            const afterCreationPopups = panelElement ? panelElement.querySelectorAll('.genie-legend-tooltip-popup') : [];
            //console.log(`[TooltipLegend] After creation - Found ${afterCreationContainers.length} tooltip container(s), ${afterCreationPopups.length} popup(s) in panel`);
            if (afterCreationContainers.length > 1) {
                console.warn(`[TooltipLegend] WARNING: Multiple tooltip containers after creation!`);
            }

            // Function to refresh legend items when datasets change
            const refreshLegendItems = () => {
                // Always use the current chart from dashboard, not the stale chart reference
                const currentChart = dashboard.charts?.[panelId] || chart;
                if (!currentChart || !currentChart.data || !currentChart.data.datasets) {
                    console.warn('[TooltipLegend] Chart or datasets not available for refresh');
                    return;
                }

                const currentDatasetsCount = currentChart.data.datasets.length;
                const currentDatasetLabels = (currentChart.data.datasets || []).map(d => d.label || '').join('|');
                // Get stored count/labels from current chart (in case chart instance changed)
                const storedCount = currentChart._tooltipLegendDatasetsCount !== undefined ? currentChart._tooltipLegendDatasetsCount : chart._tooltipLegendDatasetsCount;
                const storedLabels = currentChart._tooltipLegendDatasetLabels !== undefined ? currentChart._tooltipLegendDatasetLabels : chart._tooltipLegendDatasetLabels;
                const countChanged = currentDatasetsCount !== storedCount;
                const labelsChanged = currentDatasetLabels !== storedLabels;

                //console.log(`[TooltipLegend] Refresh check - count: ${currentDatasetsCount} (was ${storedCount}), labels changed: ${labelsChanged}`, currentDatasetsCount > 0 ? `Current labels: ${(currentChart.data.datasets || []).map(d => d.label).join(', ')}` : '');

                // Always refresh if datasets exist, even if count/labels haven't changed
                // This ensures we capture all datasets even if they were added before initial creation
                if (countChanged || labelsChanged || currentDatasetsCount > 0) {
                    const shouldRefresh = countChanged || labelsChanged;
                    //console.log(`[TooltipLegend] Refresh check result - shouldRefresh: ${shouldRefresh}, count: ${storedCount} -> ${currentDatasetsCount}, labels changed: ${labelsChanged}`);
                    //console.log(`[TooltipLegend] All dataset labels:`, (currentChart.data.datasets || []).map(d => d.label));

                    if (shouldRefresh) {
                        console.log(`[TooltipLegend] Refreshing legend - datasets changed (count: ${storedCount} -> ${currentDatasetsCount}, labels changed: ${labelsChanged})`);
                        // Datasets have changed (count or labels), refresh the legend
                        // Store on both chart instances in case chart was recreated
                        currentChart._tooltipLegendDatasetsCount = currentDatasetsCount;
                        currentChart._tooltipLegendDatasetLabels = currentDatasetLabels;
                        chart._tooltipLegendDatasetsCount = currentDatasetsCount;
                        chart._tooltipLegendDatasetLabels = currentDatasetLabels;
                    } else {
                        // Even if count/labels haven't changed, verify all items are in the popup
                        // Get legendContainer dynamically from panel (in case it was recreated)
                        const currentLegendContainer = panelElement?.querySelector('.genie-legend-tooltip-container') ||
                            currentChart._tooltipLegendContainer ||
                            legendContainer;
                        // Check if popup exists and has all items
                        const checkPopup = currentLegendContainer?.querySelector('.genie-legend-tooltip-popup');
                        const checkList = checkPopup?.querySelector('.genie-legend-list');
                        const checkItems = checkList?.querySelectorAll('.genie-legend-item') || [];
                        const checkItemCount = checkItems.length;

                        //console.log(`[TooltipLegend] Popup check - existing items: ${checkItemCount}, expected: ${currentDatasetsCount}, legendContainer found: ${!!currentLegendContainer}, popup found: ${!!checkPopup}`);

                        // If popup doesn't exist or has wrong number of items, refresh anyway
                        if (!currentLegendContainer || !checkPopup || !checkList || checkItemCount !== currentDatasetsCount) {
                            console.log(`[TooltipLegend] Forcing refresh - popup missing or item count mismatch (container: ${!!currentLegendContainer}, popup: ${!!checkPopup}, list: ${!!checkList}, items: ${checkItemCount})`);
                            // Update stored values
                            currentChart._tooltipLegendDatasetsCount = currentDatasetsCount;
                            currentChart._tooltipLegendDatasetLabels = currentDatasetLabels;
                            chart._tooltipLegendDatasetsCount = currentDatasetsCount;
                            chart._tooltipLegendDatasetLabels = currentDatasetLabels;
                        } else {
                            // Verify that popup items match current dataset labels
                            const currentLabels = (currentChart.data.datasets || []).map(d => d.label || '').sort();
                            const popupLabels = Array.from(checkItems).map(item => {
                                const labelEl = item.querySelector('span');
                                return labelEl ? labelEl.textContent.trim() : '';
                            }).filter(l => l).sort();

                            const labelsMatch = currentLabels.length === popupLabels.length &&
                                currentLabels.every((label, idx) => label === popupLabels[idx]);

                            /*console.log(`[TooltipLegend] Popup item labels check:`, {
                            currentLabels: currentLabels,
                            popupLabels: popupLabels,
                            labelsMatch: labelsMatch
                        });*/

                            if (!labelsMatch) {
                                console.log(`[TooltipLegend] Forcing refresh - popup labels don't match current datasets`);
                                // Update stored values
                                currentChart._tooltipLegendDatasetsCount = currentDatasetsCount;
                                currentChart._tooltipLegendDatasetLabels = currentDatasetLabels;
                                chart._tooltipLegendDatasetsCount = currentDatasetsCount;
                                chart._tooltipLegendDatasetLabels = currentDatasetLabels;
                            } else {
                                // Popup exists and has correct items, no refresh needed
                                //console.log(`[TooltipLegend] Popup is up to date, no refresh needed`);
                                return;
                            }
                        }
                    }

                    // Get current legendContainer dynamically (in case it was recreated)
                    const currentLegendContainer = panelElement?.querySelector('.genie-legend-tooltip-container') ||
                        currentChart._tooltipLegendContainer ||
                        legendContainer;

                    if (!currentLegendContainer) {
                        console.warn('[TooltipLegend] Cannot refresh - legendContainer not found');
                        return;
                    }

                    // Remove existing popup and visible item
                    const existingPopup = currentLegendContainer.querySelector('.genie-legend-tooltip-popup');
                    const existingVisibleItem = currentLegendContainer.querySelector('.genie-legend-tooltip-item');
                    if (existingPopup) existingPopup.remove();
                    if (existingVisibleItem) existingVisibleItem.remove();

                    // Re-create legend with updated datasets
                    const datasets = (currentChart.data.datasets || []).slice();
                    const datasetsWithIndex = datasets.map((dataset, idx) => ({
                        dataset: dataset,
                        originalIndex: idx
                    }));
                    datasetsWithIndex.sort((a, b) => {
                        const labelA = (a.dataset.label || '').toLowerCase();
                        const labelB = (b.dataset.label || '').toLowerCase();
                        return labelA.localeCompare(labelB);
                    });

                    if (datasetsWithIndex.length === 0) return;

                    // Re-create visible item using module
                    const firstItem = datasetsWithIndex[0];
                    const visibleItemData = window.TooltipLegend.createVisibleItem({
                        firstDataset: firstItem.dataset,
                        originalIndex: firstItem.originalIndex,
                        chart: currentChart,
                        dashboard: dashboard,
                        panelId: panelId,
                        panelElement: panelElement,
                        datasetsWithIndex: datasetsWithIndex,
                        createEyeIcon: window.TooltipLegend.createEyeIcon
                    });
                    const {visibleItem: newVisibleItem} = visibleItemData;
                    currentLegendContainer.appendChild(newVisibleItem);

                    // Get chart dimensions for max-height and max-width calculation
                    let refreshChartHeight = 300; // Default fallback
                    let refreshChartWidth = 400; // Default fallback
                    try {
                        if (currentChart && currentChart.chartArea) {
                            refreshChartHeight = currentChart.chartArea.height || 300;
                            refreshChartWidth = currentChart.chartArea.width || 400;
                        } else if (currentChart && currentChart.canvas) {
                            refreshChartHeight = currentChart.canvas.height || 300;
                            refreshChartWidth = currentChart.canvas.width || 400;
                        }
                        // Also check chartContent dimensions as fallback
                        const refreshChartContent = panelElement?.querySelector('.genie-dashboard-chart-content');
                        if (refreshChartContent) {
                            if (refreshChartHeight === 300) {
                                const contentHeight = refreshChartContent.offsetHeight;
                                if (contentHeight > 0) {
                                    refreshChartHeight = contentHeight;
                                }
                            }
                            if (refreshChartWidth === 400) {
                                const contentWidth = refreshChartContent.offsetWidth;
                                if (contentWidth > 0) {
                                    refreshChartWidth = contentWidth;
                                }
                            }
                        }
                    } catch (error) {
                        console.warn('[TooltipLegend] Error getting chart dimensions during refresh, using default:', error);
                    }

                    // Get legend container height
                    let refreshLegendContainerHeight = 0;
                    if (currentLegendContainer) {
                        refreshLegendContainerHeight = currentLegendContainer.offsetHeight || 0;
                    }

                    // Popup max-height = chart height + legend container height
                    const refreshPopupMaxHeight = refreshChartHeight + refreshLegendContainerHeight;

                    console.log(`[TooltipLegend] Refreshing popup with max-height: ${refreshPopupMaxHeight}px (chart: ${refreshChartHeight}px + container: ${refreshLegendContainerHeight}px), max-width: ${refreshChartWidth}px`);

                    // Re-create popup using module
                    const popupContainer = window.TooltipLegend.createPopup({
                        datasetsWithIndex: datasetsWithIndex,
                        chart: currentChart,
                        dashboard: dashboard,
                        panelId: panelId,
                        panelElement: panelElement,
                        chartWidth: refreshChartWidth,
                        popupMaxHeight: refreshPopupMaxHeight,
                        createLegendItem: (config) => window.TooltipLegend.createItem({
                            ...config,
                            createEyeIcon: window.TooltipLegend.createEyeIcon
                        })
                    });
                    currentLegendContainer.appendChild(popupContainer);
                    const legendList = popupContainer.querySelector('.genie-legend-list');

                    console.log(`[TooltipLegend] Refreshed popup created with ${legendList.children.length} items total`);

                    // Re-attach handlers using module
                    window.TooltipLegend.setupHandlers({
                        visibleItem: newVisibleItem,
                        popupContainer: popupContainer,
                        legendContainer: currentLegendContainer,
                        legendList: legendList
                    });
                }
            };

            // Hook into chart updates to reposition legend and refresh items
            const originalUpdate = chart.update.bind(chart);
            chart.update = function (mode, transition) {
                const result = originalUpdate(mode, transition);
                // Update legend position and refresh items after chart update
                setTimeout(() => {
                    // Use current chart from dashboard in case chart instance changed
                    const updateChart = dashboard.charts?.[panelId] || chart;
                    if (updateChart._updateTooltipLegendPosition) {
                        updateChart._updateTooltipLegendPosition();
                    }
                    refreshLegendItems();
                }, 0);
                return result;
            };

            // Force a refresh after a delay to ensure all datasets are captured
            // This is especially important when switching from stats table to chart view
            // or when previous data is loaded asynchronously, or when compare is added
            setTimeout(() => {
                refreshLegendItems();
            }, 300);
        }

        /**
         * Render statistics table
         */
        /**
         * Render statistics table for a panel
         * Delegates to ChartRenderer.renderStatsTable
         */
        renderStatsTable(panel, dataArray, container, statsToShow, previousDataArray = null, isTransposed = null, previousDuration = null) {
            if (typeof ChartRenderer === 'undefined' || !ChartRenderer.renderStatsTable) {
                throw new Error('GenieDashboard: ChartRenderer module is required but not loaded. Please ensure ChartRenderer.js is included before genieDashboard.js');
            }
            return ChartRenderer.renderStatsTable(
                panel,
                dataArray,
                container,
                statsToShow,
                previousDataArray,
                isTransposed,
                previousDuration,
                {
                    getInstanceId: (id) => this.getInstanceId(id),
                    inputConfig: this.inputConfig,
                    getInputConfigValue: (fieldName, config) => QueryProcessor.getInputConfigValue(fieldName, config),
                    applySpanAggregationToAllSeries: (dataArray, span, spanAggregationType) => DataProcessor.applySpanAggregationToAllSeries(dataArray, span, spanAggregationType, DataProcessor.extractDataPoints, DataUtils.parseDuration),
                    instanceId: this.instanceId,
                    rowHeightPerUnit: this.rowHeightPerUnit,
                    showSeriesContextMenu: (event, seriesName, panel) => this.showSeriesContextMenu(event, seriesName, panel),
                    renderStatsTable: (panel, dataArray, container, statsToShow, previousDataArray, isTransposed, previousDuration) => ChartRenderer.renderStatsTable(panel, dataArray, container, statsToShow, previousDataArray, isTransposed, previousDuration, {
                        getInstanceId: (id) => this.getInstanceId(id),
                        inputConfig: this.inputConfig,
                        getInputConfigValue: (fieldName, config) => QueryProcessor.getInputConfigValue(fieldName, config),
                        applySpanAggregationToAllSeries: (dataArray, span, spanAggregationType) => DataProcessor.applySpanAggregationToAllSeries(dataArray, span, spanAggregationType, DataProcessor.extractDataPoints, DataUtils.parseDuration),
                        instanceId: this.instanceId,
                        rowHeightPerUnit: this.rowHeightPerUnit,
                        showSeriesContextMenu: (event, seriesName, panel) => this.showSeriesContextMenu(event, seriesName, panel),
                        renderStatsTable: null, // Prevent infinite recursion
                        getSeriesIdentifier: (series, target, panel, options) => this.getSeriesIdentifier(series, target, panel, options)
                    }),
                    getSeriesIdentifier: (series, target, panel, options) => this.getSeriesIdentifier(series, target, panel, options)
                }
            );
        }

        /**
         * Show context menu for series name
         * @param {MouseEvent} event - Right-click event
         * @param {string} seriesName - Name of the series
         * @param {Array} menuItems - Array of {label: string, handler: function} objects
         */
        showSeriesContextMenu(event, seriesName, menuItems) {
            // Remove any existing context menu for this instance
            // Scope to document.body since context menus are appended there, but check instance ID
            const existingMenus = document.querySelectorAll('.genie-dashboard-context-menu');
            existingMenus.forEach(existingMenu => {
                // Remove if it has this instance ID or if no instance ID (backward compatibility)
                if (!existingMenu.dataset.instanceId || existingMenu.dataset.instanceId === this.instanceId) {
                    existingMenu.remove();
                }
            });

            // Validate menuItems
            if (!menuItems || !Array.isArray(menuItems) || menuItems.length === 0) {
                console.error('Invalid menuItems:', menuItems);
                return;
            }

            // Create context menu
            const menu = document.createElement('div');
            menu.className = 'genie-dashboard-context-menu';
            menu.dataset.instanceId = this.instanceId; // Add instance identifier for multiple dashboard support
            menu.style.display = 'block';
            menu.style.left = event.clientX + 'px';
            menu.style.top = event.clientY + 'px';
            menu.style.zIndex = '10001';

            // Add menu items
            let hasValidItems = false;
            menuItems.forEach((item, index) => {
                if (item && item.label && typeof item.handler === 'function') {
                    hasValidItems = true;
                    const menuItem = document.createElement('div');
                    menuItem.className = 'genie-dashboard-context-menu-item';
                    menuItem.textContent = item.label;
                    menuItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        try {
                            item.handler(seriesName);
                        } catch (error) {
                            console.error('Error executing context menu handler:', error);
                        }
                        menu.remove();
                    });
                    getSeriesIdentifier: (series, target, panel, options) => this.getSeriesIdentifier(series, target, panel, options)
                    menu.appendChild(menuItem);
                }
            });

            // Only show menu if there are valid items
            if (!hasValidItems) {
                console.error('No valid context menu items found. Menu items:', menuItems);
                return;
            }

            // Append to body
            document.body.appendChild(menu);

            // Adjust position if menu goes off screen
            const menuRect = menu.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;

            if (menuRect.right > windowWidth) {
                menu.style.left = (event.clientX - menuRect.width) + 'px';
            }
            if (menuRect.bottom > windowHeight) {
                menu.style.top = (event.clientY - menuRect.height) + 'px';
            }

            // Close menu on click outside or Escape key
            const closeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                    document.removeEventListener('contextmenu', closeMenu);
                    document.removeEventListener('keydown', escapeHandler);
                }
            };

            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                    document.removeEventListener('contextmenu', closeMenu);
                    document.removeEventListener('keydown', escapeHandler);
                }
            };

            // Use setTimeout to avoid immediate close on right-click
            setTimeout(() => {
                document.addEventListener('click', closeMenu, true);
                document.addEventListener('contextmenu', closeMenu, true);
                document.addEventListener('keydown', escapeHandler, true);
            }, 10);
        }

        /**
         * Apply span aggregation to time series data (aggregate over time windows)
         * @param {Array} dataPoints - Array of {time, value} objects
         * @param {string} span - Span duration (e.g., '5m', '1h')
         * @param {string} spanAggregationType - 'sum', 'avg', 'max', or 'min'
         * @returns {Array} Aggregated data points with timestamps rounded to window boundaries
         */
        /**
         * Apply span aggregation to data points
         * Delegates to DataProcessor module
         * @param {Array} dataPoints - Array of {time: Date, value: number} objects
         * @param {string} span - Span duration
         * @param {string} spanAggregationType - Aggregation type
         * @returns {Array} Aggregated data points
         */
        applySpanAggregation(dataPoints, span, spanAggregationType) {
            return DataProcessor.applySpanAggregation(dataPoints, span, spanAggregationType);
        }

        /**
         * Apply span aggregation to all series in a data array (without requiring aggregation tag)
         * @param {Array} dataArray - Array of {refId, data, target, isPrevious}
         * @param {string} spanAggregation - Span duration (e.g., '5m', '1h')
         * @param {string} spanAggregationType - Span aggregation type ('sum', 'avg', 'max', or 'min')
         * @returns {Array} Data array with span aggregation applied to all series
         */
        /**
         * Apply span aggregation to all series in a data array
         * Delegates to DataProcessor module
         * @param {Array} dataArray - Array of {refId, data, target, isPrevious}
         * @param {string} spanAggregation - Span duration
         * @param {string} spanAggregationType - Span aggregation type
         * @returns {Array} Data array with span aggregation applied
         */
        applySpanAggregationToAllSeries(dataArray, spanAggregation, spanAggregationType) {
            return DataProcessor.applySpanAggregationToAllSeries(dataArray, spanAggregation, spanAggregationType);
        }

        /**
         * Apply series aggregation (group by tag+metric and sum/avg at each timestamp)
         * @param {Array} dataArray - Array of {refId, data, target, isPrevious}
         * @param {string} aggregationTag - Tag name to use as aggregation key
         * @param {string} aggregationType - 'sum' or 'avg'
         * @param {string} spanAggregation - Optional span duration (e.g., '5m', '1h')
         * @param {string} spanAggregationType - Optional span aggregation type ('sum', 'avg', 'max', or 'min')
         * @returns {Array} Aggregated data array
         */
        /**
         * Apply series aggregation (group by tag+metric and sum/avg at each timestamp)
         * Delegates to DataProcessor module
         * @param {Array} dataArray - Array of {refId, data, target, isPrevious}
         * @param {string} aggregationTag - Tag name to use as aggregation key
         * @param {string} aggregationType - 'sum' or 'avg'
         * @param {string} spanAggregation - Optional span duration
         * @param {string} spanAggregationType - Optional span aggregation type
         * @returns {Array} Aggregated data array
         */
        applySeriesAggregation(dataArray, aggregationTag, aggregationType, spanAggregation = null, spanAggregationType = null) {
            return DataProcessor.applySeriesAggregation(dataArray, aggregationTag, aggregationType, spanAggregation, spanAggregationType);
        }

        /**
         * Transform API response data to Chart.js format
         */
        transformDataForChart(dataArray, panel, previousDuration = null) {
            if (typeof ChartUtils === 'undefined' || !ChartUtils.transformDataForChart) {
                throw new Error('GenieDashboard: ChartUtils module is required but not loaded. Please ensure ChartUtils.js is included before genieDashboard.js');
            }
            return ChartUtils.transformDataForChart(
                dataArray,
                panel,
                previousDuration,
                this.inputConfig,
                (series, target, panel) => this.getSeriesName(series, target, panel),
                (series) => DataProcessor.extractDataPoints(series),
                (duration) => DataUtils.parseDuration(duration),
                (dataArray, tag, type, span, spanType) => DataProcessor.applySeriesAggregation(dataArray, tag, type, span, spanType),
                (seriesName, panel, index) => ChartUtils.getSeriesColor(seriesName, panel, index, ChartUtils.resolveColor)
            );
        }

        /**
         * Extract series name from response
         * Builds displayName from scope, metric, and tags if not provided
         */
        getSeriesName(series, target, panel) {
            if (typeof ChartUtils === 'undefined' || !ChartUtils.getSeriesName) {
                throw new Error('GenieDashboard: ChartUtils module is required but not loaded. Please ensure ChartUtils.js is included before genieDashboard.js');
            }
            return ChartUtils.getSeriesName(series, target, panel, (series) => this.buildDisplayName(series));
        }

        /**
         * Build displayName from scope, metric, and tags
         */
        buildDisplayName(series) {
            if (typeof ChartUtils === 'undefined' || !ChartUtils.buildDisplayName) {
                throw new Error('GenieDashboard: ChartUtils module is required but not loaded. Please ensure ChartUtils.js is included before genieDashboard.js');
            }
            return ChartUtils.buildDisplayName(series);
        }

        /**
         * Extract data points from series object
         */
        /**
         * Extract data points from a series object
         * Delegates to DataProcessor module
         * @param {Object} series - Series object
         * @returns {Array} Array of {time: Date, value: number} objects
         */
        extractDataPoints(series) {
            return DataProcessor.extractDataPoints(series);
        }

        /**
         * Gather all panel data for backend anomaly detection
         * Separates panels into those with historical data (comparable) and those without (non-comparable)
         * @returns {Object} Object with panels and noncomparepanels arrays
         */
        gatherPanelDataForBackend() {
            const panels = []; // Panels with historical data (can be compared)
            const noncomparepanels = []; // Panels without historical data (cannot be compared)

            // Collect all panels to process (standalone + children from row panels)
            this.panelOrder.normal.forEach((panelId, panelIndex) => {
                const panel = this.panels[panelId];
                if (!panel) return;

                // Process standalone panels
                if (panel.type !== 'row') {
                    const {comparable, nonComparable} = this.preparePanelDataForBackend(panel, panelIndex);
                    if (comparable) {
                        panels.push(comparable);
                    }
                    if (nonComparable) {
                        noncomparepanels.push(nonComparable);
                    }
                } else {
                    // Process child panels from row panels
                    if (panel.panels && Array.isArray(panel.panels)) {
                        panel.panels.forEach((childPanel, childIndex) => {
                            const {
                                comparable,
                                nonComparable
                            } = this.preparePanelDataForBackend(childPanel, `row-${panelId}-child-${childIndex}`);
                            if (comparable) {
                                panels.push(comparable);
                            }
                            if (nonComparable) {
                                noncomparepanels.push(nonComparable);
                            }
                        });
                    }
                }
            });

            console.log(`[Genie] gatherPanelDataForBackend: Collected ${panels.length} comparable panels, ${noncomparepanels.length} non-comparable panels`);
            return {panels, noncomparepanels};
        }

        /**
         * Prepare a single panel's data for backend processing
         * @param {Object} panel - Panel object
         * @param {string|number} panelIndex - Panel index or identifier
         * @returns {Object|null} Panel data object or null if panel should be skipped
         */
        /**
         * Get consistent series identification for comparison
         * Returns normalized series name, metric, and comparison key
         * @param {Object} series - Series object
         * @param {Object} target - Target object (optional)
         * @param {Object} panel - Panel object
         * @param {Object} options - Options object
         *   - displayNameField: Custom field to use for display name (e.g., from statsTable.displayName)
         *   - normalize: Whether to normalize names (trim + lowercase) for comparison (default: false)
         * @returns {Object} Object with {name, metric, key} where key is `${name}|${metric}`
         */
        getSeriesIdentifier(series, target, panel, options = {}) {
            const {displayNameField = null, normalize = false} = options;

            // Get series name using same logic as renderStatsTable
            let seriesName;
            if (displayNameField) {
                // Use the specified field directly from the series object
                const fieldValue = series[displayNameField];
                if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
                    seriesName = String(fieldValue);
                } else {
                    // Fallback if field doesn't exist or is empty
                    seriesName = this.getSeriesName(series, target, panel);
                }
            } else {
                // Default: use standard getSeriesName method
                seriesName = this.getSeriesName(series, target, panel);
            }

            // Get metric
            const metric = series.metric || '';

            // Normalize if requested (for consistent comparison)
            if (normalize) {
                seriesName = String(seriesName).trim().toLowerCase();
                const normalizedMetric = String(metric).trim().toLowerCase();
                const key = `${seriesName}|${normalizedMetric}`;
                return {name: seriesName, metric: normalizedMetric, key};
            } else {
                // Use original names (trimmed for consistency)
                const trimmedName = String(seriesName).trim();
                const trimmedMetric = String(metric).trim();
                const key = `${trimmedName}|${trimmedMetric}`;
                return {name: trimmedName, metric: trimmedMetric, key};
            }
        }

        /**
         * Classify series as comparable vs non-comparable based on previous series data
         * @param {Array} currentSeriesArray - Array of current series objects with structure {series, target, ...}
         * @param {Map|Object} previousSeriesMap - Map or object of previous series keyed by `${name}|${metric}`
         * @param {Object} panel - Panel object (for getSeriesIdentifier)
         * @param {Object} options - Options for getSeriesIdentifier
         * @returns {Object} Object with {comparable: Array, nonComparable: Array}
         */
        classifySeriesForComparison(currentSeriesArray, previousSeriesMap, panel, options = {}) {
            const comparable = [];
            const nonComparable = [];

            // Convert previousSeriesMap to Set for fast lookup if it's not already a Map
            const previousKeys = previousSeriesMap instanceof Map
                ? new Set(previousSeriesMap.keys())
                : previousSeriesMap instanceof Set
                    ? previousSeriesMap
                    : new Set(Object.keys(previousSeriesMap));

            currentSeriesArray.forEach((seriesData) => {
                // Handle both {series, target} format and direct series objects
                const series = seriesData.series || seriesData;
                const target = seriesData.target || null;

                const identifier = this.getSeriesIdentifier(series, target, panel, options);
                const {key} = identifier;

                if (previousKeys.has(key)) {
                    // Series exists in previous data - can be compared
                    comparable.push({
                        ...seriesData,
                        _identifier: identifier,
                        _isComparable: true
                    });
                } else {
                    // Series doesn't exist in previous data - cannot be compared
                    nonComparable.push({
                        ...seriesData,
                        _identifier: identifier,
                        _isComparable: false
                    });
                }
            });

            return {comparable, nonComparable};
        }

        /**

         * Extract and flatten series data from dataArray structure
         * Handles both {refId, data, target} format and direct series arrays
         * @param {Array} dataArray - Array of data items
         * @returns {Array} Flattened array of series objects
         */
        extractSeriesDataForBackend(dataArray) {
            if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
                return [];
            }

            const flattenedSeries = [];

            for (const item of dataArray) {
                if (!item || typeof item !== 'object') continue;

                // Handle structure from fetchPanelData: {refId, data, target}
                const dataToExtract = item.data !== undefined ? item.data : item;

                // If data is an array, extract each series
                if (Array.isArray(dataToExtract)) {
                    for (const series of dataToExtract) {
                        if (series && typeof series === 'object') {
                            // Check if it has valid series data
                            const hasData = (series.datapoints && (Array.isArray(series.datapoints) ? series.datapoints.length > 0 : Object.keys(series.datapoints || {}).length > 0)) ||
                                (series.values && Array.isArray(series.values) && series.values.length > 0) ||
                                (series.times && Array.isArray(series.times) && series.times.length > 0);
                            if (hasData) {
                                flattenedSeries.push(series);
                            }
                        }
                    }
                }
                // If data is an object (single series), use it directly
                else if (typeof dataToExtract === 'object') {
                    const hasData = (dataToExtract.datapoints && (Array.isArray(dataToExtract.datapoints) ? dataToExtract.datapoints.length > 0 : Object.keys(dataToExtract.datapoints || {}).length > 0)) ||
                        (dataToExtract.values && Array.isArray(dataToExtract.values) && dataToExtract.values.length > 0) ||
                        (dataToExtract.times && Array.isArray(dataToExtract.times) && dataToExtract.times.length > 0);
                    if (hasData) {
                        flattenedSeries.push(dataToExtract);
                    }
                }
            }

            return flattenedSeries;
        }

        /**
         * Prepare a single panel's data for backend processing
         * Separates into comparable (with historical data) and non-comparable (without historical data)
         * @param {Object} panel - Panel object
         * @param {string|number} panelIndex - Panel index or identifier
         * @returns {Object} Object with comparable and nonComparable panel data (either can be null)
         */
        preparePanelDataForBackend(panel, panelIndex) {
            // Only process timeseries panels, or graph panels when bars or lines is true
            const isTimeseries = panel.type === 'timeseries';
            const isGraphWithBarsOrLines = panel.type === 'graph' &&
                (panel.bars === true || panel.lines === true ||
                    panel.options?.bars === true || panel.options?.lines === true);

            if (!isTimeseries && !isGraphWithBarsOrLines) {
                return {comparable: null, nonComparable: null};
            }

            // Get current data - must have valid data
            let currentDataArray = panel._currentDataArray || [];
            if (!currentDataArray || currentDataArray.length === 0) {
                return {comparable: null, nonComparable: null};
            }

            // Extract and flatten current series data
            const currentSeriesData = this.extractSeriesDataForBackend(currentDataArray);
            if (currentSeriesData.length === 0) {
                console.log(`[Genie] Panel "${panel.title || panel.id}": Skipping - current data has no valid series`);
                return {comparable: null, nonComparable: null};
            }

            // Get dashboard time range from inputConfig
            const startTimestamp = this.inputConfig?.$start || null;
            const endTimestamp = this.inputConfig?.$end || null;

            // Base panel data structure
            const basePanelData = {
                panelId: panel.id,
                panelTitle: panel.title || panel.id,
                panelIndex: panelIndex,
                currentData: currentSeriesData,
                startTimestamp: startTimestamp,
                endTimestamp: endTimestamp,
                panelType: panel.type,
                thresholds: panel.thresholds || panel.fieldConfig?.defaults?.thresholds || null,
                fieldConfig: panel.fieldConfig || null
            };

            // Get previous data by duration
            const previousDataByDuration = panel._previousDataByDuration || {};
            console.log(`[Genie] preparePanelDataForBackend: Panel "${panel.title || panel.id}" - _previousDataByDuration keys: ${Object.keys(previousDataByDuration).length}, has data: ${previousDataByDuration && Object.keys(previousDataByDuration).length > 0}`);

            // Prepare historical data structure - only include periods with valid data
            const historicalData = {};
            const previousSeriesKeysMap = new Map(); // Map to store all previous series keys across all periods

            if (previousDataByDuration && Object.keys(previousDataByDuration).length > 0) {
                console.log(`[Genie] preparePanelDataForBackend: Panel "${panel.title || panel.id}" - Processing ${Object.keys(previousDataByDuration).length} durations from _previousDataByDuration: [${Object.keys(previousDataByDuration).join(', ')}]`);
                Object.keys(previousDataByDuration).forEach(duration => {
                    const periodData = previousDataByDuration[duration];
                    console.log(`[Genie] preparePanelDataForBackend: Processing duration "${duration}": periodData exists=${!!periodData}, has dataArray=${!!(periodData && periodData.dataArray)}, dataArray is array=${Array.isArray(periodData?.dataArray)}, dataArray length=${periodData?.dataArray?.length || 0}`);
                    if (periodData && periodData.dataArray && Array.isArray(periodData.dataArray) && periodData.dataArray.length > 0) {
                        // Log first item structure for debugging
                        const firstItem = periodData.dataArray[0];
                        console.log(`[Genie] preparePanelDataForBackend: First item in dataArray:`, {
                            hasData: !!firstItem?.data,
                            hasTarget: !!firstItem?.target,
                            hasRefId: !!firstItem?.refId,
                            isDirectSeries: !firstItem?.data && !firstItem?.target,
                            firstItemKeys: firstItem ? Object.keys(firstItem) : []
                        });
                        if (firstItem?.data && Array.isArray(firstItem.data) && firstItem.data.length > 0) {
                            const firstSeries = firstItem.data[0];
                            console.log(`[Genie] preparePanelDataForBackend: First series in firstItem.data:`, {
                                hasDatapoints: !!firstSeries?.datapoints,
                                datapointsType: firstSeries?.datapoints ? (Array.isArray(firstSeries.datapoints) ? 'array' : typeof firstSeries.datapoints) : 'none',
                                datapointsLength: firstSeries?.datapoints ? (Array.isArray(firstSeries.datapoints) ? firstSeries.datapoints.length : Object.keys(firstSeries.datapoints || {}).length) : 0,
                                hasMetric: !!firstSeries?.metric,
                                hasDisplayName: !!firstSeries?.displayName
                            });
                        }

                        // Extract and flatten series data for this period
                        const periodSeriesData = this.extractSeriesDataForBackend(periodData.dataArray);
                        console.log(`[Genie] preparePanelDataForBackend: Duration "${duration}" - extractSeriesDataForBackend returned ${periodSeriesData.length} series`);
                        if (periodSeriesData.length > 0) {
                            // Log first extracted series structure
                            if (periodSeriesData[0]) {
                                const firstExtracted = periodSeriesData[0];
                                console.log(`[Genie] preparePanelDataForBackend: First extracted series:`, {
                                    hasDatapoints: !!firstExtracted?.datapoints,
                                    datapointsType: firstExtracted?.datapoints ? (Array.isArray(firstExtracted.datapoints) ? 'array' : typeof firstExtracted.datapoints) : 'none',
                                    hasMetric: !!firstExtracted?.metric,
                                    metric: firstExtracted?.metric,
                                    hasDisplayName: !!firstExtracted?.displayName,
                                    displayName: firstExtracted?.displayName
                                });
                            }
                            historicalData[duration] = periodSeriesData;
                            console.log(`[Genie] preparePanelDataForBackend: Added ${periodSeriesData.length} series to historicalData["${duration}"]`);

                            // Build map of previous series keys for classification
                            periodSeriesData.forEach(series => {
                                const identifier = this.getSeriesIdentifier(series, null, panel, {});
                                previousSeriesKeysMap.set(identifier.key, true);
                            });
                        } else {
                            console.log(`[Genie] Panel "${panel.title || panel.id}": Period "${duration}" has no valid series data`);
                        }
                    }
                });
            }

            // Classify current series as comparable vs non-comparable using modular function
            // Convert currentSeriesData to format expected by classifySeriesForComparison
            const currentSeriesArray = currentSeriesData.map(series => ({series, target: null}));
            const {comparable: comparableSeries, nonComparable: nonComparableSeries} =
                this.classifySeriesForComparison(currentSeriesArray, previousSeriesKeysMap, panel, {});        // Check if we have at least one historical period with valid data
            console.log(`[Genie] preparePanelDataForBackend: Panel "${panel.title || panel.id}" - historicalData has ${Object.keys(historicalData).length} durations: [${Object.keys(historicalData).join(', ')}]`);
            if (Object.keys(historicalData).length > 0) {
                // Panel has historical data - classify series
                const comparablePanelData = {
                    ...basePanelData,
                    currentData: comparableSeries.map(item => item.series || item),
                    historicalData: historicalData,
                    _seriesClassification: {
                        comparable: comparableSeries.length,
                        nonComparable: nonComparableSeries.length
                    }
                };

                // For non-comparable series from a panel that HAS historical data:
                // Include the actual historical data (not empty arrays) so the backend has context
                // about what historical data exists, even if these specific current series don't match
                // The backend can use this for context or for other processing needs
                const nonComparableHistoricalData = {};
                console.log(`[Genie] preparePanelDataForBackend: Building nonComparableHistoricalData - historicalData has ${Object.keys(historicalData).length} durations: [${Object.keys(historicalData).join(', ')}]`);
                Object.keys(historicalData).forEach(duration => {
                    // Include the actual historical series data for this period
                    // This preserves all historical data even if current series don't match
                    const seriesArray = historicalData[duration];
                    console.log(`[Genie] preparePanelDataForBackend: Copying duration "${duration}" with ${Array.isArray(seriesArray) ? seriesArray.length : 'not array'} series`);
                    nonComparableHistoricalData[duration] = seriesArray;
                });
                console.log(`[Genie] preparePanelDataForBackend: nonComparableHistoricalData built with ${Object.keys(nonComparableHistoricalData).length} durations: [${Object.keys(nonComparableHistoricalData).join(', ')}]`);

                const nonComparablePanelData = nonComparableSeries.length > 0 ? {
                    ...basePanelData,
                    currentData: nonComparableSeries.map(item => item.series || item),
                    historicalData: nonComparableHistoricalData, // Historical data structure with empty arrays per period
                    _seriesClassification: {
                        comparable: 0,
                        nonComparable: nonComparableSeries.length
                    }
                } : null;

                console.log(`[Genie] Panel "${panel.title || panel.id}": Classified ${comparableSeries.length} comparable series, ${nonComparableSeries.length} non-comparable series out of ${currentSeriesData.length} total`);

                return {
                    comparable: comparableSeries.length > 0 ? comparablePanelData : null,
                    nonComparable: nonComparablePanelData
                };
            } else {
                // Panel has no historical data (no compare data) - cannot be compared, but can still be processed for incidents
                // IMPORTANT: Always include in noncomparepanels when there's current data but no historical/compare data
                console.log(`[Genie] Panel "${panel.title || panel.id}": Including in non-comparable panels - ${currentSeriesData.length} current series, no historical data`);
                return {
                    comparable: null,
                    nonComparable: {
                        ...basePanelData,
                        historicalData: {} // Empty historical data
                    }
                };
            }
        }

        /**
         * Call backend endpoint for anomaly detection and percentage change calculation
         * @param {Array} panelsData - Array of panel data objects
         * @returns {Promise<Object>} Promise resolving to backend response with anomaly scores and changes
         *
         * THRESHOLD CONFIGURATION:
         * - genieAnomalyThreshold: Backend calculation parameter (default: 1.5)
         *   Used as multiplier for IQR in consensus calculation: consensusThreshold = baselineIQR * threshold
         *   Affects how the anomaly score is calculated, not the final score threshold
         *
         * - genieAnomalyCollapseThreshold: UI collapse/expand threshold (default: 0.3)
         *   Threshold for final anomaly scores (range 0.0-1.0) to decide which panels to collapse/expand
         *   Panels with anomalyScore >= threshold are expanded, others are collapsed
         *   Also used for color coding in panel titles (red if >= threshold, orange otherwise)
         *   Can be overridden by genieAnomalyColorThreshold
         *
         * - Threshold text box: Controls genieAnomalyCollapseThreshold (for UI collapse/expand)
         *   When backend processing is enabled, the text box value is synced with genieAnomalyCollapseThreshold
         */
        async callBackendForAnomalyDetection(panelsData) {
            // Get backend endpoint from inputConfig
            const endpoint = this.inputConfig?.genieAnomalyEndpoint ||
                (this.inputConfig?.argus ? this.inputConfig.argus.replace('/geniequery/?query=QEURY', '/genie/anomaly') : null) ||
                '/api/v1/genie/anomaly';

            // Prepare request payload with separated panels and noncomparepanels
            const payload = {
                panels: panelsData.panels || [],
                noncomparepanels: panelsData.noncomparepanels || [],
                options: {
                    maxDataPoints: this.inputConfig?.genieAnomalyMaxDataPoints || 200,
                    enablePatternAnalysis: this.inputConfig?.genieAnomalyEnablePattern || false,
                    // Backend threshold: used as multiplier for IQR in consensus calculation
                    // consensusThreshold = baselineIQR * threshold
                    // Default 1.5 means 1.5x the IQR is considered significant for consensus
                    threshold: this.inputConfig?.genieAnomalyThreshold || 1.5
                }
            };

            try {
                console.log(`[Genie] Calling backend for anomaly detection: ${payload.panels.length} comparable panels, ${payload.noncomparepanels.length} non-comparable panels, endpoint: ${endpoint}`);

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const result = await response.json();
                console.log(`[Genie] Backend anomaly detection completed: ${result.panels?.length || 0} comparable panels, ${result.noncomparepanels?.length || 0} non-comparable panels processed`);

                return result;
            } catch (error) {
                console.error(`[Genie] Error calling backend for anomaly detection:`, error);
                throw error;
            }
        }

        /**
         * Process backend response and apply results to panels
         * @param {Object} backendResponse - Response from backend anomaly detection
         * Response structure:
         *   - panels: Array of panels with matching historical data (can be compared)
         *   - noncomparepanels: Array of panels without matching historical data
         */
        processBackendAnomalyResponse(backendResponse) {
            if (!backendResponse) {
                console.warn(`[Genie] Invalid backend response format`);
                return;
            }
            // Helper function to find panel by ID (handles both standalone and child panels)
            const findPanelById = (panelId) => {
                // Try direct lookup first (for standalone panels)
                let panel = this.panels[panelId];
                if (panel) {
                    return panel;
                }

                // Try to parse child panel ID format: row-{parentIndex}-child-{childIndex}
                const childPanelMatch = String(panelId).match(/^row-([^-]+)-child-(\d+)$/);
                if (childPanelMatch) {
                    const parentPanelId = childPanelMatch[1]; // Could be "p9" or "9"
                    const childIndex = parseInt(childPanelMatch[2], 10);
                    
                    // Try to find parent panel by ID
                    let parentPanel = this.panels[parentPanelId];
                    
                    // If not found and parentPanelId is numeric, try as array index (backward compatibility)
                    if (!parentPanel && /^\d+$/.test(parentPanelId)) {
                        const parentIndex = parseInt(parentPanelId, 10);
                        const parentIdFromOrder = this.panelOrder.normal[parentIndex];
                        if (parentIdFromOrder) {
                            parentPanel = this.panels[parentIdFromOrder];
                        }
                    }
                    
                    if (parentPanel && parentPanel.type === 'row' && parentPanel.panels && Array.isArray(parentPanel.panels)) {
                        const childPanel = parentPanel.panels[childIndex];
                        if (childPanel) {
                            return childPanel;
                        }
                    }
                }

                return null;
            };



            // Process panels with matching historical data
            if (backendResponse.panels && Array.isArray(backendResponse.panels)) {
                backendResponse.panels.forEach(panelResult => {
                    const panelId = panelResult.panelId;
                    const panel = findPanelById(panelId);

                    if (!panel) {
                        console.warn(`[Genie] Panel not found for ID: ${panelId}`);
                        return;
                    }

                    // Initialize change object if not exists
                    if (!panel.change) {
                        panel.change = {};
                    }

                    // Apply percentage changes from backend
                    if (panelResult.changes) {
                        Object.keys(panelResult.changes).forEach(seriesName => {
                            const changeData = panelResult.changes[seriesName];

                            // Store the change value (using max absolute change if available)
                            if (changeData.change !== undefined) {
                                panel.change[seriesName] = changeData.change;
                            }

                            // Store all period changes if available
                            if (changeData.byDuration) {
                                panel.change[`${seriesName}_byDuration`] = changeData.byDuration;
                            }

                            // Store which period had max change
                            if (changeData.maxAbsChangeDuration) {
                                panel.change[`${seriesName}_maxAbsChangeDuration`] = changeData.maxAbsChangeDuration;
                            }
                        });
                    }

                    // Store individual kpod anomaly scores if available
                    if (panelResult.anomalyScores) {
                        panel._anomalyScores = panelResult.anomalyScores;
                        console.log(`[Genie] Stored ${Object.keys(panelResult.anomalyScores).length} individual kpod anomaly scores for panel "${panel.title || panelId}"`);
                    }

                    // Store aggregated anomaly scores by grouping key if available
                    if (panelResult.aggregatedAnomalyScores) {
                        panel._aggregatedAnomalyScores = panelResult.aggregatedAnomalyScores;
                        console.log(`[Genie] Stored ${Object.keys(panelResult.aggregatedAnomalyScores).length} aggregated anomaly scores for panel "${panel.title || panelId}"`);
                    }

                    // Store grouping information from backend if available
                    if (panelResult.kpodGroups) {
                        panel._kpodGroups = panelResult.kpodGroups;
                        console.log(`[Genie] Stored ${Object.keys(panelResult.kpodGroups).length} kpod groups for panel "${panel.title || panelId}"`);
                    }
                    if (panelResult.kpodToGroupingKey) {
                        panel._kpodToGroupingKey = panelResult.kpodToGroupingKey;
                    }

                    // Store overall anomaly score
                    if (panelResult.anomalyScore !== undefined) {
                        panel._anomalyScore = panelResult.anomalyScore;
                        console.log(`[Genie] Stored anomaly score for panel "${panel.title || panelId}": ${panelResult.anomalyScore}`);
                    } else {
                        console.warn(`[Genie] No anomaly score in backend response for panel "${panel.title || panelId}"`);
                    }

                    // Store incidents if available
                    if (panelResult.incidents) {
                        panel._incidents = panelResult.incidents;
                        // Count total incidents across all series
                        let totalIncidents = 0;
                        Object.values(panelResult.incidents).forEach(seriesIncidents => {
                            if (Array.isArray(seriesIncidents)) {
                                totalIncidents += seriesIncidents.length;
                            }
                        });
                        panel._incidentCount = totalIncidents;
                        console.log(`[Genie] Stored ${totalIncidents} incident(s) for panel "${panel.title || panelId}" across ${Object.keys(panelResult.incidents).length} series`);

                        // Update chart if it exists to render incident windows
                        const chart = this.charts && this.charts[String(panelId)];
                        if (chart && !chart.destroyed) {
                            console.log(`[Genie] Updating chart for panel "${panel.title || panelId}" to render incident windows`);
                            chart.update('none');
                        }
                    }

                    // Mark as calculated
                    panel._genieChangeCalculated = true;

                    console.log(`[Genie] Applied backend results for panel "${panel.title || panelId}": ${Object.keys(panelResult.changes || {}).length} series, anomalyScore=${panelResult.anomalyScore?.toFixed(2) || 'N/A'}, _anomalyScore=${panel._anomalyScore?.toFixed(2) || 'N/A'}, incidents=${panel._incidentCount || 0}, kpods=${Object.keys(panelResult.anomalyScores || {}).length}`);
                });
            }

            // Process noncomparepanels (panels without matching historical data)
            if (backendResponse.noncomparepanels && Array.isArray(backendResponse.noncomparepanels)) {
                console.log(`[Genie] Processing ${backendResponse.noncomparepanels.length} non-comparable panels`);

                // Get threshold configuration for non-comparable panels
                const collapseThreshold = this.inputConfig?.genieAnomalyCollapseThreshold ||
                    this.inputConfig?.genieAnomalyColorThreshold ||
                    0.3;
                const nonCompareThresholdPercent = this.inputConfig?.genieNonCompareThresholdPercent || 20;

                backendResponse.noncomparepanels.forEach(panelResult => {
                    const panelId = panelResult.panelId;
                    const panel = findPanelById(panelId);

                    if (!panel) {
                        console.warn(`[Genie] Panel not found for ID: ${panelId}`);
                        return;
                    }

                    // Store error message if available
                    if (panelResult.error) {
                        panel._genieError = panelResult.error;
                        console.warn(`[Genie] Panel "${panel.title || panelId}" has no matching historical data: ${panelResult.error}`);
                    }

                    // Store grouping information from backend if available
                    if (panelResult.kpodGroups) {
                        panel._kpodGroups = panelResult.kpodGroups;
                        console.log(`[Genie] Stored ${Object.keys(panelResult.kpodGroups).length} kpod groups for non-comparable panel "${panel.title || panelId}"`);
                    }
                    if (panelResult.kpodToGroupingKey) {
                        panel._kpodToGroupingKey = panelResult.kpodToGroupingKey;
                    }

                    // Store individual kpod scores if available (even without comparison)
                    if (panelResult.anomalyScores) {
                        panel._anomalyScores = panelResult.anomalyScores;
                        console.log(`[Genie] Stored ${Object.keys(panelResult.anomalyScores).length} individual kpod anomaly scores for non-comparable panel "${panel.title || panelId}"`);

                        // Use backend grouping information if available, otherwise fall back to individual kpod logic
                        if (panelResult.kpodGroups && Object.keys(panelResult.kpodGroups).length > 0) {
                            // Group kpods by grouping key (as done in backend)
                            const groups = panelResult.kpodGroups;
                            const totalGroups = Object.keys(groups).length;

                            // For each group, check if at least one kpod in the group is above threshold
                            const groupsAboveThreshold = [];
                            const allKpodsAboveThreshold = [];

                            Object.keys(groups).forEach(groupingKey => {
                                const kpodsInGroup = groups[groupingKey] || [];
                                let groupHasKpodAboveThreshold = false;

                                kpodsInGroup.forEach(kpodName => {
                                    const score = panelResult.anomalyScores[kpodName];
                                    if (score !== null && score !== undefined && !isNaN(score) && isFinite(score) && score >= collapseThreshold) {
                                        groupHasKpodAboveThreshold = true;
                                        allKpodsAboveThreshold.push(score);
                                    }
                                });

                                if (groupHasKpodAboveThreshold) {
                                    groupsAboveThreshold.push(groupingKey);
                                }
                            });

                            const percentGroupsAboveThreshold = totalGroups > 0 ? (groupsAboveThreshold.length / totalGroups) * 100 : 0;

                            // Check if at least genieNonCompareThresholdPercent of groups have kpods above threshold
                            const meetsThresholdPercent = percentGroupsAboveThreshold >= nonCompareThresholdPercent;

                            if (meetsThresholdPercent && allKpodsAboveThreshold.length > 0) {
                                // Calculate average of all kpods above threshold (across all groups) for sorting
                                const averageAboveThreshold = allKpodsAboveThreshold.reduce((sum, score) => sum + score, 0) / allKpodsAboveThreshold.length;
                                panel._anomalyScore = averageAboveThreshold;
                                panel._genieNonComparablePrioritize = true; // Mark for prioritization
                                console.log(`[Genie] Non-comparable panel "${panel.title || panelId}": ${percentGroupsAboveThreshold.toFixed(1)}% (${groupsAboveThreshold.length}/${totalGroups}) groups have kpods above threshold ${collapseThreshold}, ${allKpodsAboveThreshold.length} total kpods above threshold, average=${averageAboveThreshold.toFixed(2)} - will be prioritized`);
                            } else {
                                // Not enough groups have kpods above threshold - will be collapsed
                                panel._anomalyScore = panelResult.anomalyScore !== undefined ? panelResult.anomalyScore : 0;
                                panel._genieNonComparablePrioritize = false; // Mark for collapse
                                console.log(`[Genie] Non-comparable panel "${panel.title || panelId}": ${percentGroupsAboveThreshold.toFixed(1)}% (${groupsAboveThreshold.length}/${totalGroups}) groups have kpods above threshold ${collapseThreshold} < ${nonCompareThresholdPercent}% - will be collapsed`);
                            }
                        } else {
                            // Fallback: Calculate percentage of individual kpods above threshold (old logic)
                            const kpodScores = Object.values(panelResult.anomalyScores);
                            const totalKpods = kpodScores.length;
                            const kpodsAboveThreshold = kpodScores.filter(score =>
                                score !== null && score !== undefined && !isNaN(score) && isFinite(score) && score >= collapseThreshold
                            );
                            const percentAboveThreshold = totalKpods > 0 ? (kpodsAboveThreshold.length / totalKpods) * 100 : 0;

                            // Check if at least genieNonCompareThresholdPercent of kpods are above threshold
                            const meetsThresholdPercent = percentAboveThreshold >= nonCompareThresholdPercent;

                            if (meetsThresholdPercent && kpodsAboveThreshold.length > 0) {
                                // Calculate average of kpods above threshold for sorting
                                const averageAboveThreshold = kpodsAboveThreshold.reduce((sum, score) => sum + score, 0) / kpodsAboveThreshold.length;
                                panel._anomalyScore = averageAboveThreshold;
                                panel._genieNonComparablePrioritize = true; // Mark for prioritization
                                console.log(`[Genie] Non-comparable panel "${panel.title || panelId}": ${percentAboveThreshold.toFixed(1)}% (${kpodsAboveThreshold.length}/${totalKpods}) kpods above threshold ${collapseThreshold}, average=${averageAboveThreshold.toFixed(2)} - will be prioritized (fallback: no grouping info)`);
                            } else {
                                // Not enough kpods above threshold - will be collapsed
                                panel._anomalyScore = panelResult.anomalyScore !== undefined ? panelResult.anomalyScore : 0;
                                panel._genieNonComparablePrioritize = false; // Mark for collapse
                                console.log(`[Genie] Non-comparable panel "${panel.title || panelId}": ${percentAboveThreshold.toFixed(1)}% (${kpodsAboveThreshold.length}/${totalKpods}) kpods above threshold ${collapseThreshold} < ${nonCompareThresholdPercent}% - will be collapsed (fallback: no grouping info)`);
                            }
                        }
                    } else {
                        // No individual kpod scores - use overall score if available
                        if (panelResult.anomalyScore !== undefined) {
                            panel._anomalyScore = panelResult.anomalyScore;
                            panel._genieNonComparablePrioritize = panelResult.anomalyScore >= collapseThreshold;
                        } else {
                            panel._anomalyScore = 0;
                            panel._genieNonComparablePrioritize = false;
                        }
                        console.log(`[Genie] Stored anomaly score for non-comparable panel "${panel.title || panelId}": ${panel._anomalyScore}`);
                    }

                    // Store incidents if available
                    if (panelResult.incidents) {
                        panel._incidents = panelResult.incidents;
                        let totalIncidents = 0;
                        Object.values(panelResult.incidents).forEach(seriesIncidents => {
                            if (Array.isArray(seriesIncidents)) {
                                totalIncidents += seriesIncidents.length;
                            }
                        });
                        panel._incidentCount = totalIncidents;
                        console.log(`[Genie] Stored ${totalIncidents} incident(s) for non-comparable panel "${panel.title || panelId}"`);

                        // Update chart if it exists to render incident windows
                        const chart = this.charts && this.charts[String(panelId)];
                        if (chart && !chart.destroyed) {
                            console.log(`[Genie] Updating chart for panel "${panel.title || panelId}" to render incident windows`);
                            chart.update('none');
                        }
                    }

                    // Mark as processed (but not comparable)
                    panel._genieChangeCalculated = true;
                    panel._genieNonComparable = true;
                });
            }
        }

        /**
         * Calculate percentage change for timeseries panels when genie checkbox is checked
         * For each panel with previous data, matches series names and calculates:
         * %change = 100 * (previous - current) / previous
         * Stores result in panel.change[seriesname] = %change value
         *
         * If isAnomalyProcessInUI is false, delegates to backend processing
         */
        /**
         * Fetch all compare options for all panels (for genie check)
         * Fetches all configured compare options including unselected ones for multi-week comparison
         */
        async fetchAllCompareOptionsForGenie() {
            const panelsToFetch = [];

            // Collect all panels that need all compare options
            this.panelOrder.normal.forEach(panelId => {
                const panel = this.panels[panelId];
                if (!panel) return;

                if (panel.type !== 'row') {
                    panelsToFetch.push(panel);
                } else {
                    // Also include child panels
                    if (panel.panels && Array.isArray(panel.panels)) {
                        panel.panels.forEach(childPanel => {
                            panelsToFetch.push(childPanel);
                        });
                    }
                }
            });

            // Check which panels need all compare options fetched
            const panelsNeedingFetch = [];
            panelsToFetch.forEach(panel => {
                // Check if panel has compare options configured
                const timeSeriesPreviousOptions = panel.timeSeries?.previous || panel.options?.timeSeries?.previous;
                const statsTablePreviousOptions = panel.statsTable?.previous || panel.options?.statsTable?.previous;
                const globalPreviousOptions = this.inputConfig?.previous;
                const previousOptionsStr = timeSeriesPreviousOptions || statsTablePreviousOptions || globalPreviousOptions;

                if (previousOptionsStr) {
                    const allOptions = previousOptionsStr.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0 && opt !== 'none');

                    // Check if panel already has all compare options
                    const hasAllOptions = allOptions.every(option => {
                        return panel._previousDataByDuration && panel._previousDataByDuration[option];
                    });

                    if (!hasAllOptions && allOptions.length > 0) {
                        panelsNeedingFetch.push({panel, allOptions});
                    }
                }
            });

            if (panelsNeedingFetch.length > 0) {
                console.log(`[Genie] Fetching all compare options for ${panelsNeedingFetch.length} panels to enable multi-week comparison`);

                // Show progress message
                this.showExpertProgressMessage(`Fetching compare data for ${panelsNeedingFetch.length} panel${panelsNeedingFetch.length > 1 ? 's' : ''}...`);

                // Fetch all compare options for panels that need them
                const progressCounter = {count: 0};
                const updateProgress = () => {
                    progressCounter.count++;
                    this.showExpertProgressMessage(`Fetching compare data (${progressCounter.count}/${panelsNeedingFetch.length})...`);
                };

                const fetchPromises = panelsNeedingFetch.map(async ({panel, allOptions}) => {
                    try {
                        // Fetch all compare options for this panel
                        await this.fetchPanelDataWithCompare(panel, true, true); // fetchAllCompareOptions = true
                        console.log(`[Genie] Fetched all compare options for panel "${panel.title || panel.id}": ${Object.keys(panel._previousDataByDuration || {}).join(', ')}`);

                        // Process stats for all periods if stats are configured
                        if (panel._currentDataArray && panel._currentDataArray.length > 0) {
                            this.processPanelDataForSeries(panel, panel._currentDataArray, null);
                        }

                        // Update progress message
                        updateProgress();
                    } catch (error) {
                        console.error(`[Genie] Error fetching all compare options for panel "${panel.title || panel.id}":`, error);
                        // Still increment count on error to show progress
                        updateProgress();
                    }
                });

                await Promise.all(fetchPromises);
                console.log(`[Genie] Completed fetching all compare options for ${panelsNeedingFetch.length} panels`);

                // Hide progress message
                this.hideExpertProgressMessage();
            } else {
                console.log(`[Genie] All panels already have all compare options, skipping fetch`);
            }
        }

        async calculateGeniePercentageChange() {
            // Check if backend processing is enabled
            const useBackend = this.inputConfig?.isAnomalyProcessInUI === false;

            if (useBackend) {
                try {
                    console.log(`[Genie] Using backend for anomaly detection and percentage change calculation`);

                    // Gather all panel data
                    const panelsData = this.gatherPanelDataForBackend();

                    if ((!panelsData.panels || panelsData.panels.length === 0) &&
                        (!panelsData.noncomparepanels || panelsData.noncomparepanels.length === 0)) {
                        console.warn(`[Genie] No panels with data available for backend processing`);
                        return;
                    }

                    // Call backend
                    const backendResponse = await this.callBackendForAnomalyDetection(panelsData);

                    // Process backend response
                    this.processBackendAnomalyResponse(backendResponse);

                    console.log(`[Genie] Backend processing completed for ${panelsData.length} panels`);

                    // After backend processing, sort panels and apply collapse/expand based on threshold
                    // Get threshold value from input (for collapse/expand of anomaly scores)
                    const thresholdInput = document.getElementById(this.getInstanceId('toolbar-genie-threshold'));
                    const threshold = thresholdInput ? parseFloat(thresholdInput.value) || 0.3 : 0.3;
                    console.log(`[Genie] Calling sortAndReorderPanelsByChange with threshold=${threshold} after backend processing`);
                    this.sortAndReorderPanelsByChange(threshold);

                    return;
                } catch (error) {
                    console.error(`[Genie] Backend processing failed, falling back to UI processing:`, error);
                    // Fall through to UI processing as fallback
                }
            }

            // UI-based processing (original implementation)
            // Collect all panels to process (standalone + children from row panels)
            const allPanelsToProcess = [];

            // Add standalone panels
            this.panelOrder.normal.forEach((panelId, panelIndex) => {
                const panel = this.panels[panelId];
                if (!panel) return;

                if (panel.type !== 'row') {
                    allPanelsToProcess.push({panel, panelIndex});
                } else {
                    // Add child panels from row panels
                    if (panel.panels && Array.isArray(panel.panels)) {
                        panel.panels.forEach((childPanel, childIndex) => {
                            allPanelsToProcess.push({
                                panel: childPanel,
                                panelIndex: `row-${panelId}-child-${childIndex}`
                            });
                        });
                    }
                }
            });

            // Process all panels (standalone + children)
            allPanelsToProcess.forEach(({panel, panelIndex}) => {
                // Process timeseries panels, or graph panels when bars or lines is true
                const isTimeseries = panel.type === 'timeseries';
                const isGraphWithBarsOrLines = panel.type === 'graph' &&
                    (panel.bars === true || panel.lines === true ||
                        panel.options?.bars === true || panel.options?.lines === true);

                if (!isTimeseries && !isGraphWithBarsOrLines) {
                    return;
                }

                // Check if calculation already done (avoid duplicate calculations)
                if (panel._genieChangeCalculated) {
                    return;
                }

                // Initialize change object if not exists
                if (!panel.change) {
                    panel.change = {};
                }

                // Use intermediate processed series data from chart rendering (most accurate)
                // Fallback to stats table data if chart data not available
                let currentSeriesData = panel._chartSeriesData || panel._statsSeriesDataMap || {};
                let currentSeriesNames = panel._chartSeriesNames || panel._statsSeriesNames || [];

                // If no intermediate data available, extract from raw data arrays
                if (!currentSeriesNames || currentSeriesNames.length === 0) {
                    if (!panel._currentDataArray || panel._currentDataArray.length === 0) {
                        console.log(`[Genie] Panel ${panelIndex}: No current data available`);
                        return;
                    }
                    // Fallback: extract from raw data
                    currentSeriesData = this.extractSeriesAverages(panel._currentDataArray, panel);
                    currentSeriesNames = Object.keys(currentSeriesData);
                }

                // For previous data, support multiple periods from _previousDataByDuration
                // This enables genie check to compare against multiple weeks
                let previousSeriesDataByDuration = {}; // Map: duration -> { seriesData, seriesNames }
                let previousSeriesData = {}; // For backward compatibility (default/selected period)
                let previousSeriesNames = [];

                // Try to find previous series data from all available periods
                if (panel._previousDataByDuration && Object.keys(panel._previousDataByDuration).length > 0) {
                    // Process each available previous period
                    Object.keys(panel._previousDataByDuration).forEach(duration => {
                        const previousDataForDuration = panel._previousDataByDuration[duration]?.dataArray;
                        if (!previousDataForDuration || previousDataForDuration.length === 0) {
                            return;
                        }

                        // Try to extract series data that matches current data format
                        // If current data uses chart series (aggregated), prefer aggregated extraction
                        // If current data uses stats series (individual), use stats data
                        let periodSeriesData = {};
                        let periodSeriesNames = [];

                        // Check if current data uses chart series (aggregated) or stats series (individual)
                        const usesChartSeries = panel._chartSeriesNames && panel._chartSeriesNames.length > 0;

                        if (usesChartSeries) {
                            // Current data uses aggregated chart series - extract previous data with same aggregation
                            // This ensures series names match (e.g., "sum:cell:result:containerCpu" matches)
                            periodSeriesData = this.extractSeriesAverages(previousDataForDuration, panel);
                            periodSeriesNames = Object.keys(periodSeriesData);
                        } else if (panel._statsSeriesDataByDuration && panel._statsSeriesDataByDuration[duration]) {
                            // Current data uses stats series - use pre-calculated stats data for this duration
                            const statsData = panel._statsSeriesDataByDuration[duration];
                            const statsMap = statsData.statsSeriesDataMap || {};

                            Object.keys(statsMap).forEach(displayName => {
                                const metrics = statsMap[displayName];
                                // Aggregate all metrics for this displayName to match current data format
                                // Current data uses just displayName, not displayName:metric
                                const allValues = [];
                                Object.keys(metrics).forEach(metric => {
                                    const seriesInfo = metrics[metric];
                                    if (seriesInfo.values && seriesInfo.values.length > 0) {
                                        allValues.push(...seriesInfo.values);
                                    }
                                });

                                if (allValues.length > 0) {
                                    // Use just displayName (consistent with current data format)
                                    const avg = allValues.reduce((acc, val) => acc + val, 0) / allValues.length;
                                    periodSeriesData[displayName] = avg;
                                    if (!periodSeriesNames.includes(displayName)) {
                                        periodSeriesNames.push(displayName);
                                    }
                                }
                            });
                        } else {
                            // Fallback: extract from raw data
                            periodSeriesData = this.extractSeriesAverages(previousDataForDuration, panel);
                            periodSeriesNames = Object.keys(periodSeriesData);
                        }

                        // Store for this duration
                        previousSeriesDataByDuration[duration] = {
                            seriesData: periodSeriesData,
                            seriesNames: periodSeriesNames
                        };

                        console.log(`[Genie] Panel ${panelIndex}: Processed previous data for duration "${duration}": ${periodSeriesNames.length} series`);
                    });

                    // Set default previous data for backward compatibility (use first available or selected)
                    const defaultDuration = panel._previousDuration || panel._compareSelectedOption || Object.keys(previousSeriesDataByDuration)[0];
                    if (defaultDuration && previousSeriesDataByDuration[defaultDuration]) {
                        previousSeriesData = previousSeriesDataByDuration[defaultDuration].seriesData;
                        previousSeriesNames = previousSeriesDataByDuration[defaultDuration].seriesNames;
                    }
                } else {
                    // Fallback: Try to find previous series data in chartSeriesData (with suffix like "(-7d)")
                    if (panel._chartSeriesData) {
                        // Look for series with previous period suffix
                        Object.keys(panel._chartSeriesData).forEach(seriesName => {
                            // Check if this is a previous period series (has suffix like "(-7d)")
                            const match = seriesName.match(/^(.+?)\(-[^)]+\)$/);
                            if (match) {
                                const baseName = match[1].trim();
                                const dataPoints = panel._chartSeriesData[seriesName];
                                if (dataPoints && dataPoints.length > 0) {
                                    const values = dataPoints.map(dp => dp.value).filter(v => v !== null && v !== undefined && !isNaN(v));
                                    if (values.length > 0) {
                                        const avg = values.reduce((acc, val) => acc + val, 0) / values.length;
                                        previousSeriesData[baseName] = avg;
                                        if (!previousSeriesNames.includes(baseName)) {
                                            previousSeriesNames.push(baseName);
                                        }
                                    }
                                }
                            }
                        });
                    }

                    // If no previous data found in intermediate form, try raw data
                    if (previousSeriesNames.length === 0 && panel._previousDataArray && panel._previousDataArray.length > 0) {
                        previousSeriesData = this.extractSeriesAverages(panel._previousDataArray, panel);
                        previousSeriesNames = Object.keys(previousSeriesData);
                    }
                }

                if (previousSeriesNames.length === 0 && Object.keys(previousSeriesDataByDuration).length === 0) {
                    console.log(`[Genie] Panel ${panelIndex}: No previous data available`);
                    return;
                }

                // Store processed series data in panel structure
                panel._currentSeriesData = currentSeriesData;
                panel._previousSeriesData = previousSeriesData; // Default/selected period for backward compatibility
                panel._previousSeriesDataByDuration = previousSeriesDataByDuration; // All periods for multi-week comparison
                panel._currentSeriesNames = currentSeriesNames;
                panel._previousSeriesNames = previousSeriesNames;

                // Debug: Log all series names found
                console.log(`[Genie] Panel ${panelIndex} - Current series:`, currentSeriesNames);
                console.log(`[Genie] Panel ${panelIndex} - Previous series:`, previousSeriesNames);

                // Match series names and calculate percentage change
                // Support multiple previous periods: calculate change for each period and use the maximum absolute change
                // This enables genie check to identify priority panels based on changes across multiple weeks
                currentSeriesNames.forEach(seriesName => {
                    const seriesNameTrimmed = seriesName.trim();

                    // Calculate average from intermediate data
                    let currentAvg = null;
                    if (panel._chartSeriesData && panel._chartSeriesData[seriesNameTrimmed]) {
                        // Use chart series data (array of {time, value})
                        const dataPoints = panel._chartSeriesData[seriesNameTrimmed];
                        const values = dataPoints.map(dp => dp.value).filter(v => v !== null && v !== undefined && !isNaN(v));
                        if (values.length > 0) {
                            currentAvg = values.reduce((acc, val) => acc + val, 0) / values.length;
                        }
                    } else if (panel._statsSeriesDataMap && panel._statsSeriesDataMap[seriesNameTrimmed]) {
                        // Use stats series data (has metrics, need to aggregate)
                        const metrics = panel._statsSeriesDataMap[seriesNameTrimmed];
                        const allValues = [];
                        Object.keys(metrics).forEach(metric => {
                            if (metrics[metric].values) {
                                allValues.push(...metrics[metric].values);
                            }
                        });
                        if (allValues.length > 0) {
                            currentAvg = allValues.reduce((acc, val) => acc + val, 0) / allValues.length;
                        }
                    } else if (currentSeriesData[seriesNameTrimmed]) {
                        // Use pre-calculated average
                        currentAvg = currentSeriesData[seriesNameTrimmed];
                    }

                    if (currentAvg === null) {
                        console.log(`[Genie] Panel ${panelIndex}, Series "${seriesNameTrimmed}": Could not calculate current average`);
                        return;
                    }

                    // Calculate change for all available previous periods
                    const changesByDuration = {}; // Map: duration -> percentChange
                    let maxAbsChange = 0;
                    let maxAbsChangeDuration = null;

                    // Process all available previous periods
                    if (previousSeriesDataByDuration && Object.keys(previousSeriesDataByDuration).length > 0) {
                        Object.keys(previousSeriesDataByDuration).forEach(duration => {
                            const periodData = previousSeriesDataByDuration[duration];
                            const periodSeriesData = periodData.seriesData;

                            // Try to find matching previous series for this duration
                            let previousAvg = periodSeriesData[seriesNameTrimmed];
                            let matchedSeriesName = seriesNameTrimmed;

                            // If no exact match, try various matching strategies
                            if (previousAvg === undefined) {
                                const currentLastColonIndex = seriesNameTrimmed.lastIndexOf(':');
                                const currentNameBeforeColon = currentLastColonIndex >= 0 ? seriesNameTrimmed.substring(0, currentLastColonIndex) : seriesNameTrimmed;
                                const currentNameAfterColon = currentLastColonIndex >= 0 ? seriesNameTrimmed.substring(currentLastColonIndex + 1) : null;

                                // Try matching against all previous series names
                                for (const prevSeriesName of Object.keys(periodSeriesData)) {
                                    const prevLastColonIndex = prevSeriesName.lastIndexOf(':');
                                    const prevNameBeforeColon = prevLastColonIndex >= 0 ? prevSeriesName.substring(0, prevLastColonIndex) : prevSeriesName;
                                    const prevNameAfterColon = prevLastColonIndex >= 0 ? prevSeriesName.substring(prevLastColonIndex + 1) : null;

                                    // Strategy 1: Match current name (no colon) against previous name before colon
                                    // e.g., "Wall Clock Time" matches "Wall Clock Time:wall_time"
                                    if (currentLastColonIndex < 0 && prevLastColonIndex >= 0 && currentNameBeforeColon === prevNameBeforeColon) {
                                        previousAvg = periodSeriesData[prevSeriesName];
                                        matchedSeriesName = prevSeriesName;
                                        break;
                                    }

                                    // Strategy 2: Match current name after colon against previous name after colon
                                    // e.g., "Series:metric" matches "OtherSeries:metric"
                                    if (currentNameAfterColon && prevNameAfterColon && currentNameAfterColon === prevNameAfterColon) {
                                        previousAvg = periodSeriesData[prevSeriesName];
                                        matchedSeriesName = prevSeriesName;
                                        break;
                                    }

                                    // Strategy 3: Match current name before colon against previous name before colon
                                    // e.g., "Series:metric1" matches "Series:metric2"
                                    if (currentNameAfterColon && prevNameAfterColon && currentNameBeforeColon === prevNameBeforeColon) {
                                        previousAvg = periodSeriesData[prevSeriesName];
                                        matchedSeriesName = prevSeriesName;
                                        break;
                                    }

                                    // Strategy 4: Match current name (no colon) against previous name (no colon)
                                    // e.g., "Series" matches "Series"
                                    if (currentLastColonIndex < 0 && prevLastColonIndex < 0 && currentNameBeforeColon === prevNameBeforeColon) {
                                        previousAvg = periodSeriesData[prevSeriesName];
                                        matchedSeriesName = prevSeriesName;
                                        break;
                                    }
                                }
                            }

                            if (previousAvg !== undefined) {
                                // Calculate percentage change: 100 * (previous - current) / previous
                                let percentChange;
                                if (previousAvg !== 0) {
                                    percentChange = 100 * (previousAvg - currentAvg) / previousAvg;
                                } else {
                                    // Handle division by zero
                                    percentChange = (currentAvg === 0) ? 0 : (currentAvg > 0 ? Infinity : -Infinity);
                                }

                                changesByDuration[duration] = percentChange;

                                // Track maximum absolute change across all periods
                                const absChange = Math.abs(percentChange);
                                if (absChange > maxAbsChange && isFinite(percentChange)) {
                                    maxAbsChange = absChange;
                                    maxAbsChangeDuration = duration;
                                }

                                console.log(`[Genie] Panel ${panelIndex}, Series "${seriesNameTrimmed}", Period "${duration}": Current avg=${currentAvg.toFixed(2)}, Previous avg=${previousAvg.toFixed(2)} (from "${matchedSeriesName}"), %Change=${percentChange.toFixed(2)}%`);
                            }
                        });
                    } else {
                        // Fallback: Use single previous period (backward compatibility)
                        let previousAvg = previousSeriesData[seriesNameTrimmed];
                        let matchedSeriesName = seriesNameTrimmed;

                        // If no exact match, try various matching strategies
                        if (previousAvg === undefined) {
                            const currentLastColonIndex = seriesNameTrimmed.lastIndexOf(':');
                            const currentNameBeforeColon = currentLastColonIndex >= 0 ? seriesNameTrimmed.substring(0, currentLastColonIndex) : seriesNameTrimmed;
                            const currentNameAfterColon = currentLastColonIndex >= 0 ? seriesNameTrimmed.substring(currentLastColonIndex + 1) : null;

                            // Try matching against all previous series names
                            for (const prevSeriesName of Object.keys(previousSeriesData)) {
                                const prevLastColonIndex = prevSeriesName.lastIndexOf(':');
                                const prevNameBeforeColon = prevLastColonIndex >= 0 ? prevSeriesName.substring(0, prevLastColonIndex) : prevSeriesName;
                                const prevNameAfterColon = prevLastColonIndex >= 0 ? prevSeriesName.substring(prevLastColonIndex + 1) : null;

                                // Strategy 1: Match current name (no colon) against previous name before colon
                                // e.g., "Wall Clock Time" matches "Wall Clock Time:wall_time"
                                if (currentLastColonIndex < 0 && prevLastColonIndex >= 0 && currentNameBeforeColon === prevNameBeforeColon) {
                                    previousAvg = previousSeriesData[prevSeriesName];
                                    matchedSeriesName = prevSeriesName;
                                    break;
                                }

                                // Strategy 2: Match current name after colon against previous name after colon
                                // e.g., "Series:metric" matches "OtherSeries:metric"
                                if (currentNameAfterColon && prevNameAfterColon && currentNameAfterColon === prevNameAfterColon) {
                                    previousAvg = previousSeriesData[prevSeriesName];
                                    matchedSeriesName = prevSeriesName;
                                    break;
                                }

                                // Strategy 3: Match current name before colon against previous name before colon
                                // e.g., "Series:metric1" matches "Series:metric2"
                                if (currentNameAfterColon && prevNameAfterColon && currentNameBeforeColon === prevNameBeforeColon) {
                                    previousAvg = previousSeriesData[prevSeriesName];
                                    matchedSeriesName = prevSeriesName;
                                    break;
                                }

                                // Strategy 4: Match current name (no colon) against previous name (no colon)
                                // e.g., "Series" matches "Series"
                                if (currentLastColonIndex < 0 && prevLastColonIndex < 0 && currentNameBeforeColon === prevNameBeforeColon) {
                                    previousAvg = previousSeriesData[prevSeriesName];
                                    matchedSeriesName = prevSeriesName;
                                    break;
                                }
                            }
                        }

                        if (previousAvg !== undefined) {
                            let percentChange;
                            if (previousAvg !== 0) {
                                percentChange = 100 * (previousAvg - currentAvg) / previousAvg;
                            } else {
                                percentChange = (currentAvg === 0) ? 0 : (currentAvg > 0 ? Infinity : -Infinity);
                            }

                            panel.change[seriesNameTrimmed] = percentChange;
                            console.log(`[Genie] Panel ${panelIndex}, Series "${seriesNameTrimmed}": Current avg=${currentAvg.toFixed(2)}, Previous avg=${previousAvg.toFixed(2)} (from "${matchedSeriesName}"), %Change=${percentChange.toFixed(2)}%`);
                            return; // Exit early for backward compatibility
                        }
                    }

                    // Store change using the maximum absolute change across all periods
                    // This helps identify priority panels that show significant changes in any period
                    if (maxAbsChangeDuration !== null) {
                        panel.change[seriesNameTrimmed] = changesByDuration[maxAbsChangeDuration];
                        panel.change[`${seriesNameTrimmed}_byDuration`] = changesByDuration; // Store all periods for reference
                        panel.change[`${seriesNameTrimmed}_maxAbsChangeDuration`] = maxAbsChangeDuration; // Store which period had max change
                        console.log(`[Genie] Panel ${panelIndex}, Series "${seriesNameTrimmed}": Using max absolute change from period "${maxAbsChangeDuration}": ${changesByDuration[maxAbsChangeDuration].toFixed(2)}%`);
                    } else {
                        console.log(`[Genie] Panel ${panelIndex}, Series "${seriesNameTrimmed}": No matching previous series found in any period`);
                    }
                });

                // Also check if there are previous series that don't match current (for debugging)
                previousSeriesNames.forEach(seriesName => {
                    if (!currentSeriesNames.includes(seriesName.trim())) {
                        console.log(`[Genie] Panel ${panelIndex}, Previous series "${seriesName}": No matching current series found`);
                    }
                });

                // Mark as calculated to avoid duplicate calculations
                panel._genieChangeCalculated = true;
            });

            // After all calculations, sort panels and reorder dashboard
            // Get threshold value from input
            const thresholdInput = document.getElementById(this.getInstanceId('toolbar-genie-threshold'));
            const threshold = thresholdInput ? parseFloat(thresholdInput.value) || 1 : 1;
            this.sortAndReorderPanelsByChange(threshold);
        }

        /**
         * Update collapsed states based on threshold without re-sorting (preserves current order)
         * @param {number} threshold - Threshold value for collapsing panels
         */
        updateCollapsedStatesByThreshold(threshold = 0) {
            const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
            if (!grid) {
                console.warn('[Genie] Dashboard grid not found, cannot update collapsed states');
                return;
            }

            // Cancel any pending batch recalculation from previous threshold changes
            if (this._pendingBatchRecalculation) {
                cancelAnimationFrame(this._pendingBatchRecalculation);
                this._pendingBatchRecalculation = null;
            }

            // Get all panel DOM elements
            const allPanelDivs = Array.from(grid.querySelectorAll('.genie-dashboard-panel'))
                .filter(div => !div.classList.contains('genie-dashboard-controls-row') && !div.hasAttribute('data-controls-row'));

            // Collect all panels with their current Y positions (standalone + children)
            // Check if backend processing is enabled (use anomaly scores for collapse/expand)
            const useBackend = this.inputConfig?.isAnomalyProcessInUI === false;
            const panelsWithPositions = [];

            // Helper to find panel div
            const findPanelDiv = (panel, index) => {
                let panelDiv = null;
                if (panel._panelDiv && document.contains(panel._panelDiv)) {
                    panelDiv = panel._panelDiv;
                }
                if (!panelDiv && typeof index === 'number' && index >= 0) {
                    const expectedId = this.getInstanceId(`panel-${index}`);
                    panelDiv = document.getElementById(expectedId);
                }
                if (!panelDiv) {
                    panelDiv = allPanelDivs.find(div => div._panelObject === panel);
                }
                return panelDiv;
            };

            // Process standalone panels
            this.panelOrder.normal.forEach((panelId, index) => {
                const panel = this.panels[panelId];
                if (!panel) return;

                if (panel.type === 'row') {
                    // Process child panels from row panels
                    if (panel.panels && Array.isArray(panel.panels)) {
                        panel.panels.forEach((childPanel, childIndex) => {
                            const childPanelDiv = findPanelDiv(childPanel, -1);
                            if (childPanelDiv) {
                                const {y: currentY} = this.getPanelPositionFromDOM(childPanelDiv);

                                // Get current collapsed state from DOM or _genieStateMap (don't use panel._isCollapsed)
                                const childPanelId = childPanel.id || `row-${panelId}-child-${childIndex}`;
                                const genieState = this._genieStateMap[childPanelId];
                                const isCurrentlyCollapsed = genieState ? genieState.isCollapsed : childPanelDiv.classList.contains('genie-panel-collapsed');

                                // Check if panel should be collapsed based on threshold
                                // When backend processing is used: use anomaly scores (0.0-1.0 range)
                                // When UI processing is used: use percentage change values
                                let maxAbsChange = 0;
                                let shouldCollapse;

                                if (useBackend && childPanel && childPanel._anomalyScore !== undefined && childPanel._anomalyScore !== null) {
                                    // Backend processing: use anomaly score (range 0.0-1.0)
                                    // Panels with anomalyScore >= threshold → expanded (significant anomalies, keep visible)
                                    // Panels with anomalyScore < threshold → collapsed (normal behavior, hide them)
                                    const anomalyScore = childPanel._anomalyScore;
                                    const hasAnomalyScore = !isNaN(anomalyScore) && isFinite(anomalyScore);

                                    // Special handling for non-comparable panels
                                    if (childPanel._genieNonComparable) {
                                        // For non-comparable panels, check if they meet the threshold percent requirement
                                        // _genieNonComparablePrioritize is set to true if enough kpods are above threshold
                                        if (childPanel._genieNonComparablePrioritize) {
                                            // Panel meets threshold percent - expand it
                                            shouldCollapse = false;
                                            maxAbsChange = anomalyScore; // Use for logging
                                        } else {
                                            // Panel doesn't meet threshold percent - collapse it
                                            shouldCollapse = true;
                                            maxAbsChange = anomalyScore; // Use for logging
                                        }
                                    } else {
                                        // Regular comparable panel - use standard threshold logic
                                        shouldCollapse = hasAnomalyScore ? anomalyScore < threshold : true; // Collapse panels without valid anomaly score
                                        maxAbsChange = hasAnomalyScore ? anomalyScore : 0;
                                    }
                                } else {
                                    // UI processing: use percentage change (original logic)
                                    // Calculate max absolute change if panel has changes
                                    if (childPanel.change && Object.keys(childPanel.change).length > 0) {
                                        const changeValues = Object.values(childPanel.change).filter(v => {
                                            return v !== null && v !== undefined && !isNaN(v) && isFinite(v);
                                        });
                                        if (changeValues.length > 0) {
                                            maxAbsChange = Math.max(...changeValues.map(v => Math.abs(v)));
                                        }
                                    }

                                    // Panels with |change| >= threshold → expanded
                                    // Panels with |change| < threshold → collapsed
                                    // When threshold is 0: panels with no change data or 0% change should be collapsed (stay with parent)
                                    const hasChange = maxAbsChange > 0;
                                    // If threshold is 0: collapse panels with no change or 0% change (they should stay with parent group)
                                    // If threshold > 0: collapse panels with maxAbsChange < threshold
                                    shouldCollapse = hasChange ? maxAbsChange < threshold : true;
                                }

                                panelsWithPositions.push({
                                    panel: childPanel,
                                    panelDiv: childPanelDiv,
                                    currentY,
                                    shouldCollapse,
                                    isCurrentlyCollapsed,
                                    maxAbsChange,
                                    panelIndex: -1, // Child panels not in this.panels
                                    isChildPanel: true
                                });
                            }
                        });
                    }
                    return; // Skip row panel itself
                }

                // Process standalone panels
                const result = this.findPanelAndElement(index);
                if (!result) return;

                const {panelDiv} = result;
                const {y: currentY} = this.getPanelPositionFromDOM(panelDiv);

                // Get current collapsed state from DOM or _genieStateMap (don't use panel._isCollapsed)
                // panelId is already defined in the forEach callback, use panel.id directly
                const normalizedPanelId = String(panel.id || panelId);
                const genieState = this._genieStateMap[normalizedPanelId];
                const isCurrentlyCollapsed = genieState ? genieState.isCollapsed : panelDiv.classList.contains('genie-panel-collapsed');

                // Check if panel should be collapsed based on threshold
                // When backend processing is used: use anomaly scores (0.0-1.0 range)
                // When UI processing is used: use percentage change values
                let maxAbsChange = 0;
                let shouldCollapse;

                if (useBackend && panel && panel._anomalyScore !== undefined && panel._anomalyScore !== null) {
                    // Backend processing: use anomaly score (range 0.0-1.0)
                    // Panels with anomalyScore >= threshold → expanded (significant anomalies, keep visible)
                    // Panels with anomalyScore < threshold → collapsed (normal behavior, hide them)
                    const anomalyScore = panel._anomalyScore;
                    const hasAnomalyScore = !isNaN(anomalyScore) && isFinite(anomalyScore);

                    // Special handling for non-comparable panels
                    if (panel._genieNonComparable) {
                        // For non-comparable panels, check if they meet the threshold percent requirement
                        // _genieNonComparablePrioritize is set to true if enough kpods are above threshold
                        if (panel._genieNonComparablePrioritize) {
                            // Panel meets threshold percent - expand it
                            shouldCollapse = false;
                            maxAbsChange = anomalyScore; // Use for logging
                        } else {
                            // Panel doesn't meet threshold percent - collapse it
                            shouldCollapse = true;
                            maxAbsChange = anomalyScore; // Use for logging
                        }
                    } else {
                        // Regular comparable panel - use standard threshold logic
                        shouldCollapse = hasAnomalyScore ? anomalyScore < threshold : true; // Collapse panels without valid anomaly score
                        maxAbsChange = hasAnomalyScore ? anomalyScore : 0;
                    }
                } else {
                    // UI processing: use percentage change (original logic)
                    // Calculate max absolute change if panel has changes
                    if (panel.change && Object.keys(panel.change).length > 0) {
                        // Filter out null, undefined, NaN, Infinity, -Infinity, but keep 0
                        const changeValues = Object.values(panel.change).filter(v => {
                            return v !== null && v !== undefined && !isNaN(v) && isFinite(v);
                        });
                        if (changeValues.length > 0) {
                            // Calculate max absolute value (0 is a valid value and should be included)
                            maxAbsChange = Math.max(...changeValues.map(v => Math.abs(v)));
                        }
                    }

                    // Panels with |change| >= threshold → expanded
                    // Panels with |change| < threshold → collapsed
                    // When threshold is 0: panels with no change data or 0% change should be collapsed (stay with parent)
                    const hasChange = maxAbsChange > 0;
                    // If threshold is 0: collapse panels with no change or 0% change (they should stay with parent group)
                    // If threshold > 0: collapse panels with maxAbsChange < threshold
                    shouldCollapse = hasChange ? maxAbsChange < threshold : true;
                }

                panelsWithPositions.push({
                    panel,
                    panelDiv,
                    currentY,
                    shouldCollapse,
                    isCurrentlyCollapsed,
                    maxAbsChange,
                    panelIndex: index,
                    isChildPanel: false
                });
            });

            // Sort by Y position (top to bottom) so we process panels in order
            panelsWithPositions.sort((a, b) => a.currentY - b.currentY);

            // First pass: Update collapsed states for all panels (standalone + children)
            // Collect panels that need state changes
            const panelsToUpdate = [];
            let panelsUpdated = 0;

            panelsWithPositions.forEach(({
                                             panel,
                                             panelDiv,
                                             currentY,
                                             shouldCollapse,
                                             isCurrentlyCollapsed,
                                             maxAbsChange,
                                             panelIndex,
                                             isChildPanel
                                         }) => {
                // Update collapsed state if needed
                if (shouldCollapse && !isCurrentlyCollapsed) {
                    // Need to collapse
                    panelsToUpdate.push({
                        panel,
                        panelDiv,
                        panelIndex,
                        isChildPanel: isChildPanel || false,
                        action: 'collapse',
                        currentY,
                        maxAbsChange
                    });
                    // Update _genieShowIndependently flag: collapsed panels should NOT show independently
                    if (panel) {
                        panel._genieShowIndependently = false;
                    }
                    panelsUpdated++;
                } else if (!shouldCollapse && isCurrentlyCollapsed) {
                    // Need to expand
                    panelsToUpdate.push({
                        panel,
                        panelDiv,
                        panelIndex,
                        isChildPanel: isChildPanel || false,
                        action: 'expand',
                        currentY,
                        maxAbsChange
                    });
                    // Update _genieShowIndependently flag: expanded panels SHOULD show independently
                    if (panel) {
                        panel._genieShowIndependently = true;
                    }
                    panelsUpdated++;
                }
            });

            // Apply state changes using modular function
            panelsToUpdate.forEach(({panel, panelDiv, panelIndex, isChildPanel, action, currentY, maxAbsChange}) => {
                const panelId = panel.id || (isChildPanel ? `row-${panelIndex}-child` : `panel-${panelIndex}`);
                const shouldCollapse = action === 'collapse';
                const stateChanged = this.updatePanelCollapseStateInGenieView(panel, panelDiv, shouldCollapse, panelId, isChildPanel);

                if (stateChanged) {
                    const panelType = isChildPanel ? 'child' : 'standalone';
                    const actionText = shouldCollapse ? 'collapsed' : 'expanded';
                    console.log(`[Genie] ${panelType} panel ${panelIndex} ${actionText} (maxAbsChange=${maxAbsChange.toFixed(2)} ${shouldCollapse ? '<' : '>='} threshold=${threshold})`);
                }
            });

            // Second pass: Recalculate all Y positions from top to bottom after all state changes
            // Use requestAnimationFrame to ensure DOM has updated after all toggles
            // Store the outer frame ID so we can cancel it if a new threshold change comes in
            const outerFrameId = requestAnimationFrame(() => {
                // Use a second frame to ensure all DOM updates from toggles have settled
                requestAnimationFrame(() => {
                    // Verify we're still the latest batch recalculation (check if outer frame was cancelled)
                    // If outer frame was cancelled, this inner frame won't run, but double-check anyway
                    if (this._pendingBatchRecalculation !== outerFrameId) {
                        // Was cancelled by a new threshold change, abort
                        return;
                    }

                    this._pendingBatchRecalculation = null;

                    // Ensure controls row stays in place before recalculation
                    this.ensureControlsRowPosition();

                    // Use unified recalculation function for consistency
                    const panelCount = this.recalculateAllYPositions(false);

                    // Ensure controls row stays in place after recalculation
                    this.ensureControlsRowPosition();

                    console.log(`[Genie] Updated collapsed states for ${panelsUpdated} panels and recalculated Y positions for all ${panelCount} panels based on threshold ${threshold}`);
                });
            });

            // Store the outer frame ID so we can cancel it if a new threshold change comes in
            this._pendingBatchRecalculation = outerFrameId;
        }

        /**
         * Restore panels to their original order and positions
         */
        restoreOriginalPanelOrder() {
            const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
            if (!grid) {
                console.warn('[Genie] Dashboard grid not found, cannot restore panel order');
                return;
            }

            // Sort panels back to original order by original index
            const panelsWithOriginalIndex = this.panelOrder.normal.map((panelId, currentIndex) => {
                const panel = this.panels[panelId];
                if (!panel) return null;
                return {
                    panelId: panelId,
                    panel: panel,
                    originalIndex: panel._genieOriginalIndex !== undefined ? panel._genieOriginalIndex : currentIndex,
                    originalY: panel._genieOriginalY !== undefined ? panel._genieOriginalY : (panel.gridPos ? panel.gridPos.y : 0)
                };
            }).filter(item => item !== null);

            panelsWithOriginalIndex.sort((a, b) => a.originalIndex - b.originalIndex);

            // Restore panelOrder.normal array order (this.panels object map stays unchanged)
            this.panelOrder.normal = panelsWithOriginalIndex.map(item => item.panelId);

            // Find all panel DOM elements and map them to panel objects
            const allPanelDivs = Array.from(grid.querySelectorAll('.genie-dashboard-panel'))
                .filter(div => !div.classList.contains('genie-dashboard-controls-row') && !div.hasAttribute('data-controls-row'));
            const panelDivMap = new Map();

            // Build map of all panels (standalone + children) to their DOM elements
            // Use findPanelAndElement helper for robust matching
            allPanelDivs.forEach((panelDiv) => {
                const result = this.findPanelAndElement(panelDiv);
                if (result && result.panel) {
                    panelDivMap.set(result.panel, panelDiv);
                }
            });

            // Also collect child panels from row panels for restoration
            const allPanelsToRestore = [...panelsWithOriginalIndex];
            this.panelOrder.normal.forEach((panelId) => {
                const panel = this.panels[panelId];
                if (!panel) return;

                if (panel.type === 'row' && panel.panels && Array.isArray(panel.panels)) {
                    panel.panels.forEach((childPanel) => {
                        // Check if child panel is already in the list
                        if (!allPanelsToRestore.find(item => item.panel === childPanel)) {
                            const childPanelDiv = panelDivMap.get(childPanel) || childPanel._panelDiv;
                            if (childPanelDiv) {
                                allPanelsToRestore.push({
                                    panel: childPanel,
                                    originalIndex: childPanel._genieOriginalIndex !== undefined ? childPanel._genieOriginalIndex : -1,
                                    originalY: childPanel._genieOriginalY !== undefined ? childPanel._genieOriginalY : (childPanel.gridPos ? childPanel.gridPos.y : 0)
                                });
                            }
                        }
                    });
                }
            });

            // Restore original Y positions and expand any collapsed panels
            // Process all panels (standalone + children)
            let currentY = 0;
            allPanelsToRestore.forEach((item, index) => {
                const panel = item.panel;
                const panelDiv = panelDivMap.get(panel);

                if (panelDiv && panel.gridPos) {
                    // Read current collapsed state from DOM only (don't use panel._isCollapsed to avoid corrupting original state)
                    const isCurrentlyCollapsed = panelDiv.classList.contains('genie-panel-collapsed');
                    const wasOriginallyCollapsed = panel._genieOriginalCollapsed === true;

                    // First, restore original Y position and grid column (before handling collapsed state)
                    const originalY = item.originalY !== undefined ? item.originalY : currentY;
                    panel.gridPos.y = originalY;

                    // Restore original grid column position and width from stored values
                    // Skip child panels here - they'll be handled by recalculateAllYPositions which maintains parent-child structure
                    const isChildPanelForRestore = panel._parentRowPanel !== undefined;
                    if (!isChildPanelForRestore) {
                        const originalGridX = panel._genieOriginalGridX !== undefined ? panel._genieOriginalGridX : (panel.gridPos.x || 0);
                        const originalGridW = panel._genieOriginalGridW !== undefined ? panel._genieOriginalGridW : (panel.gridPos.w || 12);

                        // Restore gridPos values
                        panel.gridPos.x = originalGridX;
                        panel.gridPos.w = originalGridW;

                        // Restore original grid column width
                        const gridColumnValue = `${originalGridX + 1} / ${originalGridX + originalGridW + 1}`;
                        panelDiv.style.gridColumn = gridColumnValue;
                        panelDiv.style.setProperty('grid-column', gridColumnValue, 'important');
                    } else {
                        // For child panels, restore gridPos but let recalculateAllYPositions handle grid column
                        // This ensures they're properly grouped with their parent
                        const originalGridX = panel._genieOriginalGridX !== undefined ? panel._genieOriginalGridX : (panel.gridPos.x || 0);
                        const originalGridW = panel._genieOriginalGridW !== undefined ? panel._genieOriginalGridW : (panel.gridPos.w || 12);
                        panel.gridPos.x = originalGridX;
                        panel.gridPos.w = originalGridW;
                    }

                    // Restore original collapsed state
                    // Handle both standalone panels (in panelOrder.normal) and child panels (not in panelOrder.normal)
                    const panelIndex = this.panelOrder.normal.indexOf(String(panel.id));
                    const isChildPanel = panel._parentRowPanel !== undefined;

                    if (wasOriginallyCollapsed && !isCurrentlyCollapsed) {
                        // Was originally collapsed but is now expanded - restore collapsed state
                        if (panelIndex >= 0) {
                            // Standalone panel - use togglePanelCollapse
                            this.togglePanelCollapse(panelDiv, panelIndex);
                        } else if (isChildPanel) {
                            // Child panel - restore collapsed state directly without modifying panel._isCollapsed
                            const content = panel._contentElement || panelDiv.querySelector('.genie-dashboard-panel-content');
                            const collapseButton = panel._collapseButton || panelDiv.querySelector('.genie-dashboard-panel-collapse-btn');
                            if (content && collapseButton) {
                                panelDiv.classList.add('genie-panel-collapsed');
                                content.style.display = 'none';
                                panelDiv.style.height = 'auto';
                                panelDiv.style.minHeight = '0';
                                collapseButton.innerHTML = '<i class="fa fa-chevron-down" style="font-size: 10px; font-weight: 300;"></i>';
                                collapseButton.title = 'Expand panel';
                                // DO NOT modify panel._isCollapsed - keep original state untouched
                            }
                        }
                    } else if (!wasOriginallyCollapsed && isCurrentlyCollapsed) {
                        // Was NOT originally collapsed but is now collapsed (collapsed by threshold) - expand it
                        if (panelIndex >= 0) {
                            // Standalone panel - use togglePanelCollapse
                            this.togglePanelCollapse(panelDiv, panelIndex);
                        } else if (isChildPanel) {
                            // Child panel - restore expanded state directly without modifying panel._isCollapsed
                            const content = panel._contentElement || panelDiv.querySelector('.genie-dashboard-panel-content');
                            const collapseButton = panel._collapseButton || panelDiv.querySelector('.genie-dashboard-panel-collapse-btn');
                            if (content && collapseButton) {
                                panelDiv.classList.remove('genie-panel-collapsed');
                                if (panel._originalDimensions) {
                                    if (panel._originalDimensions.height && panel._originalDimensions.height !== 'auto') {
                                        panelDiv.style.height = panel._originalDimensions.height;
                                    } else {
                                        panelDiv.style.removeProperty('height');
                                    }
                                    if (panel._originalDimensions.minHeight) {
                                        panelDiv.style.minHeight = panel._originalDimensions.minHeight;
                                    } else {
                                        panelDiv.style.removeProperty('min-height');
                                    }
                                } else {
                                    panelDiv.style.removeProperty('height');
                                    panelDiv.style.removeProperty('min-height');
                                }
                                if (panel._originalContentDimensions) {
                                    content.style.setProperty('display', 'flex', 'important');
                                    content.style.setProperty('visibility', 'visible', 'important');
                                } else {
                                    content.style.setProperty('display', 'flex', 'important');
                                    content.style.setProperty('visibility', 'visible', 'important');
                                }
                                collapseButton.innerHTML = '<i class="fa fa-chevron-right" style="font-size: 10px; font-weight: 300;"></i>';
                                collapseButton.title = 'Collapse panel';
                                // DO NOT modify panel._isCollapsed - keep original state untouched
                            }
                        }
                    }

                    // Update grid row after collapsed state is restored
                    // Use collapsed height (1) if panel is collapsed, otherwise use full height
                    // Read from DOM only (don't use panel._isCollapsed)
                    const isCollapsedNow = panelDiv.classList.contains('genie-panel-collapsed');
                    const panelHeight = isCollapsedNow ? 1 : (panel.gridPos.h || 8);

                    // Update DOM element grid-row style with restored Y position
                    // Use setPanelPosition to ensure controls row offset is applied
                    this.setPanelPosition(panel, panelDiv, originalY, panelHeight, false);

                    // Update panel references in panelDiv and collapse button for collapse button to work after restore
                    const currentPanelIndex = this.panelOrder.normal.indexOf(String(panel.id));
                    if (currentPanelIndex >= 0) {
                        panelDiv._panelIndex = currentPanelIndex;
                        panelDiv._panelObject = panel;

                        // Also update collapse button references
                        const collapseButton = panel._collapseButton || panelDiv.querySelector('.genie-dashboard-panel-collapse-btn');
                        if (collapseButton) {
                            collapseButton._panelIndex = currentPanelIndex;
                            collapseButton._panelObject = panel;
                            collapseButton._panelDiv = panelDiv;
                        }
                    }

                    // Restore original panel title (process placeholders)
                    const titleEl = panelDiv.querySelector('.genie-dashboard-panel-title');
                    if (titleEl && panel._genieOriginalTitle !== undefined) {
                        // Process placeholders in the original title before restoring
                        const processedTitle = this.replacePlaceholdersInText(panel._genieOriginalTitle);
                        titleEl.textContent = processedTitle;
                        // Also update panel.title to match (store processed version)
                        panel.title = processedTitle;
                    }

                    // Update currentY for next iteration (in case originalY wasn't stored)
                    if (item.originalY === undefined) {
                        currentY += panelHeight;
                    }
                }
            });

            // Clear _genieShowIndependently flag BEFORE recalculateAllYPositions
            // This ensures child panels are properly grouped back with their parents
            allPanelsToRestore.forEach((item) => {
                const panel = item.panel;
                if (panel) {
                    panel._genieShowIndependently = undefined;
                }
            });

            // Final pass: restore Y positions using recalculateAllYPositions
            // This ensures all panels (including children) are positioned correctly
            // Now that _genieShowIndependently is cleared, child panels will be grouped with parents
            this.recalculateAllYPositions(false);

            // Ensure grid column is restored for all panels after position recalculation
            // Row panels should maintain their original styling (they weren't modified in genie view)
            allPanelsToRestore.forEach((item) => {
                const panel = item.panel;
                const panelDiv = panelDivMap.get(panel);

                if (panelDiv && panel.gridPos) {
                    // Row panels maintain their original styling - don't modify them
                    const isRowPanel = panel && panel.type === 'row';
                    if (!isRowPanel) {
                        // Restore original grid column position and width for non-row panels
                        const originalGridX = panel._genieOriginalGridX !== undefined ? panel._genieOriginalGridX : (panel.gridPos.x || 0);
                        const originalGridW = panel._genieOriginalGridW !== undefined ? panel._genieOriginalGridW : (panel.gridPos.w || 12);

                        // Restore gridPos values
                        panel.gridPos.x = originalGridX;
                        panel.gridPos.w = originalGridW;

                        // Restore original grid column width
                        const gridColumnValue = `${originalGridX + 1} / ${originalGridX + originalGridW + 1}`;
                        panelDiv.style.gridColumn = gridColumnValue;
                        panelDiv.style.setProperty('grid-column', gridColumnValue, 'important');
                    }
                }
            });

            // Ensure controls row stays in place after restoring panel order
            this.ensureControlsRowPosition();

            // Clear ALL genie view state after restore
            // This includes original state properties and any genie-specific modifications
            // Clear for all panels (standalone + children)
            const clearAllGenieState = (panel) => {
                if (panel) {
                    // Clear original state properties
                    panel._genieOriginalIndex = undefined;
                    panel._genieOriginalY = undefined;
                    panel._genieOriginalGridX = undefined;
                    panel._genieOriginalGridW = undefined;
                    panel._genieOriginalCollapsed = undefined;
                    panel._genieOriginalTitle = undefined;
                    panel._genieShowIndependently = undefined; // Clear independent display flag

                    // Clear genie-specific view modifications
                    // Note: We don't clear _genieChangeCalculated here as it's cleared in the uncheck handler
                    // This ensures complete cleanup when genie is unchecked
                }
            };

            // Clear for all panels in allPanelsToRestore
            allPanelsToRestore.forEach((item) => {
                clearAllGenieState(item.panel);
            });

            // Also clear for any child panels that might not be in allPanelsToRestore
            this.panelOrder.normal.forEach(panelId => {
                const panel = this.panels[panelId];
                if (!panel) return;

                if (panel.type === 'row' && panel.panels && Array.isArray(panel.panels)) {
                    panel.panels.forEach(childPanel => {
                        clearAllGenieState(childPanel);
                    });
                }
            });

            console.log(`[Genie] Dashboard order restored: ${allPanelsToRestore.length} panels repositioned to original order`);
        }

        /**
         * Helper method to extract series averages from raw data array (fallback)
         */
        extractSeriesAverages(dataArray, panel) {
            const seriesMap = {};

            dataArray.forEach((targetData) => {
                const response = targetData.data;
                const target = targetData.target;

                // Handle different response formats
                let seriesArray = [];
                if (Array.isArray(response)) {
                    seriesArray = response;
                } else if (response.datapoints) {
                    seriesArray = [response];
                } else if (response.times && response.values) {
                    seriesArray = [response];
                }

                seriesArray.forEach(series => {
                    // Get series name (remove previous period suffix if exists)
                    let seriesName = this.getSeriesName(series, target, panel);
                    // Remove previous period suffix like "(-7d)" if present
                    seriesName = seriesName.replace(/\(-[^)]+\)$/, '').trim();

                    // Extract data points
                    const dataPoints = this.extractDataPoints(series);

                    // Extract values, filtering out null/undefined/NaN
                    const values = dataPoints
                        .map(dp => dp.value)
                        .filter(v => v !== null && v !== undefined && !isNaN(v));

                    if (values.length > 0) {
                        // Calculate average
                        const sum = values.reduce((acc, val) => acc + val, 0);
                        const average = sum / values.length;
                        seriesMap[seriesName] = average;
                    }
                });
            });

            return seriesMap;
        }

        /**
         * Get color for a series based on panel configuration
         */
        getSeriesColor(seriesName, panel, index) {
            if (typeof ChartUtils === 'undefined' || !ChartUtils.getSeriesColor) {
                throw new Error('GenieDashboard: ChartUtils module is required but not loaded. Please ensure ChartUtils.js is included before genieDashboard.js');
            }
            return ChartUtils.getSeriesColor(seriesName, panel, index, ChartUtils.resolveColor);
        }

        /**
         * Resolve color value (handle named colors, hex, rgb, etc.)
         */
        resolveColor(color) {
            if (typeof ChartUtils === 'undefined' || !ChartUtils.resolveColor) {
                throw new Error('GenieDashboard: ChartUtils module is required but not loaded. Please ensure ChartUtils.js is included before genieDashboard.js');
            }
            return ChartUtils.resolveColor(color);
        }

        /**
         * Apply field config overrides to chart configuration
         */
        applyFieldConfigToChart(chartConfig, panel) {
            if (typeof ChartConfigBuilder === 'undefined' || !ChartConfigBuilder.applyFieldConfigToChart) {
                throw new Error('GenieDashboard: ChartConfigBuilder module is required but not loaded. Please ensure ChartConfigBuilder.js is included before genieDashboard.js');
            }
            return ChartConfigBuilder.applyFieldConfigToChart(chartConfig, panel, {
                resolveColor: (color) => this.resolveColor(color)
            });
        }

        /**
         * Set up tooltip handlers for a chart
         */
        setupTooltipHandlers(canvas, chart, chartContent, panel) {
            if (typeof ChartInteractions === 'undefined' || !ChartInteractions.setupTooltipHandlers) {
                throw new Error('GenieDashboard: ChartInteractions module is required but not loaded. Please ensure ChartInteractions.js is included before genieDashboard.js');
            }
            return ChartInteractions.setupTooltipHandlers(canvas, chart, chartContent, panel, {
                instanceId: this.instanceId,
                charts: this.charts,
                panel: panel
            });
        }


        /**
         * Render stat/singlestat chart
         */
        renderStatChart(panel, dataArray, container) {
            if (typeof ChartRenderer === 'undefined' || !ChartRenderer.renderStatChart) {
                throw new Error('GenieDashboard: ChartRenderer module is required but not loaded. Please ensure ChartRenderer.js is included before genieDashboard.js');
            }
            return ChartRenderer.renderStatChart(panel, dataArray, container, {
                calculateStatValue: (dataArray, panel) => this.calculateStatValue(dataArray, panel),
                rowHeightPerUnit: this.rowHeightPerUnit,
                formatBytes: (bytes) => this.formatBytes(bytes)
            });
        }


        /**
         * Convert bytes to human-readable format (KB, MB, GB)
         * @param {number} bytes - The number of bytes
         * @returns {{value: number, unit: string}} Object with converted value and unit
         */
        formatBytes(bytes) {
            if (typeof ChartUtils === 'undefined' || !ChartUtils.formatBytes) {
                throw new Error('GenieDashboard: ChartUtils module is required but not loaded. Please ensure ChartUtils.js is included before genieDashboard.js');
            }
            return ChartUtils.formatBytes(bytes);
        }

        /**
         * Calculate stat value from data
         */
        calculateStatValue(dataArray, panel) {
            if (typeof ChartUtils === 'undefined' || !ChartUtils.calculateStatValue) {
                throw new Error('GenieDashboard: ChartUtils module is required but not loaded. Please ensure ChartUtils.js is included before genieDashboard.js');
            }
            return ChartUtils.calculateStatValue(dataArray, panel, {
                getSeriesName: (targetData, index, inputConfig) => ChartUtils.getSeriesName(targetData, index, inputConfig),
                extractDataPoints: (series) => DataProcessor.extractDataPoints(series),
                applySeriesAggregation: (dataArray, tag, type, spanAggregation, spanAggregationType) => DataProcessor.applySeriesAggregation(dataArray, tag, type, spanAggregation, spanAggregationType),
                getInputConfigValue: (fieldName, config) => QueryProcessor.getInputConfigValue(fieldName, config),
                inputConfig: this.inputConfig
            });
        }

        /**
         * Render table chart
         */
        renderTableChart(panel, dataArray, container) {
            if (typeof ChartRenderer === 'undefined' || !ChartRenderer.renderTableChart) {
                throw new Error('GenieDashboard: ChartRenderer module is required but not loaded. Please ensure ChartRenderer.js is included before genieDashboard.js');
            }
            return ChartRenderer.renderTableChart(panel, dataArray, container, {});
        }


        /**
         * Render gauge chart
         */
        renderGaugeChart(panel, dataArray, container) {
            if (typeof ChartRenderer === 'undefined' || !ChartRenderer.renderGaugeChart) {
                throw new Error('GenieDashboard: ChartRenderer module is required but not loaded. Please ensure ChartRenderer.js is included before genieDashboard.js');
            }
            return ChartRenderer.renderGaugeChart(panel, dataArray, container, {
                calculateStatValue: (dataArray, panel) => this.calculateStatValue(dataArray, panel),
                rowHeightPerUnit: this.rowHeightPerUnit,
                formatBytes: (bytes) => this.formatBytes(bytes)
            });
        }

        /**
         * Render bar gauge chart
         */
        renderBarGaugeChart(panel, dataArray, container) {
            if (typeof ChartRenderer === 'undefined' || !ChartRenderer.renderBarGaugeChart) {
                throw new Error('GenieDashboard: ChartRenderer module is required but not loaded. Please ensure ChartRenderer.js is included before genieDashboard.js');
            }
            return ChartRenderer.renderBarGaugeChart(panel, dataArray, container, {
                calculateStatValue: (dataArray, panel) => this.calculateStatValue(dataArray, panel),
                rowHeightPerUnit: this.rowHeightPerUnit,
                formatBytes: (bytes) => this.formatBytes(bytes)
            });
        }

        /**
         * Render pie chart using Chart.js
         */
        /**
         * Render a pie chart for a panel
         * Delegates to ChartRenderer.renderPieChart
         */
        renderPieChart(panel, dataArray, container) {
            if (typeof ChartRenderer === 'undefined' || !ChartRenderer.renderPieChart) {
                throw new Error('GenieDashboard: ChartRenderer module is required but not loaded. Please ensure ChartRenderer.js is included before genieDashboard.js');
            }
            return ChartRenderer.renderPieChart(
                panel,
                dataArray,
                container,
                {
                    getInstanceId: (id) => this.getInstanceId(id),
                    charts: this.charts,
                    getSeriesName: (targetData, index, inputConfig) => ChartUtils.getSeriesName(targetData, index, inputConfig),
                    rowHeightPerUnit: this.rowHeightPerUnit,
                    calculatePanelLayout: (config) => this.calculatePanelLayout(config)
                }
            );
        }

        /**
         * Clear dashboard and clean up
         */
        destroy() {
            // Destroy all charts
            Object.values(this.charts).forEach(chart => {
                if (chart && chart.destroy) {
                    chart.destroy();
                }
            });

            this.charts = {};
            this.dataCache.clear(); // Clear cache on reset
            this.container.innerHTML = '';
            this.panels = {};
            this.panelOrder = {normal: [], genie: []};
            this._nextPanelId = 1;
        }

        /**
         * Show panel settings slide-in panel
         */
        /**
         * Show panel settings dialog
         * Delegates to PanelSettings.showPanelSettings
         */
        async showPanelSettings(panel, container, header) {
            if (typeof PanelSettings === 'undefined' || !PanelSettings.showPanelSettings) {
                throw new Error('GenieDashboard: PanelSettings module is required but not loaded. Please ensure PanelSettings.js is included before genieDashboard.js');
            }
            return PanelSettings.showPanelSettings(
                panel,
                container,
                header,
                {
                    instanceId: this.instanceId,
                    panels: this.panels,
                    panelOrder: this.panelOrder,
                    container: this.container,
                    dashboardConfig: this.dashboardConfig,
                    inputConfig: this.inputConfig,
                    getInputConfigValue: (fieldName, config) => QueryProcessor.getInputConfigValue(fieldName, config),
                    setInputConfigValue: (fieldName, value, config) => this.setInputConfigValue(fieldName, value, config),
                    processQuery: (query, offset, expertName) => this.processQuery(query, offset, expertName),
                    getEndpointForTarget: (target, panel) => this.getEndpointForTarget(target, panel),
                    fetchData: (endpoint, query, start, end, refId, previousDuration, dsType, regex) => this.fetchData(endpoint, query, start, end, refId, previousDuration, dsType, regex),
                    fetchPanelData: (panel, previousOffset, previousDuration, failedTargetsOnly) => DataFetcher.fetchPanelData(panel, previousOffset, previousDuration, failedTargetsOnly, this.inputConfig, this.dashboardConfig, (query, offset, expertName) => this.processQuery(query, offset, expertName), (target, panel, inputConfig, dashboardConfig) => DataFetcher.getEndpointForTarget(target, panel, inputConfig, dashboardConfig), (endpoint, query, start, end, refId, previousDuration, dsType, regex) => this.fetchData(endpoint, query, start, end, refId, previousDuration, dsType, regex), (fieldName, config) => QueryProcessor.getInputConfigValue(fieldName, config)),
                    renderPanel: (panel, panelId, gridContainer, dataOnly, skipDataLoading) => this.renderPanel(panel, panelId, gridContainer, dataOnly, skipDataLoading),
                    renderRowPanel: (panel, panelId, gridContainer, skipDataLoading) => this.renderRowPanel(panel, panelId, gridContainer, skipDataLoading),
                    updateAggButtonDisplay: () => {
                        if (this.updateAggButtonDisplay) {
                            this.updateAggButtonDisplay();
                        }
                    }
                }
            );
        }

        /**
         * Download panel data as CSV
         * @param {Object} panel - Panel object
         * @param {string} dataType - 'source', 'spanned', or 'view'
         */
        downloadPanelData(panel, dataType) {
            if (typeof ChartActions === 'undefined' || !ChartActions.downloadPanelData) {
                throw new Error('GenieDashboard: ChartActions module is required but not loaded. Please ensure ChartActions.js is included before genieDashboard.js');
            }
            return ChartActions.downloadPanelData(panel, dataType, {
                extractDataPoints: (series) => DataProcessor.extractDataPoints(series),
                parseDuration: (duration) => DataUtils.parseDuration(duration),
                downloadFile: (content, filename, mimeType) => this.downloadFile(content, filename, mimeType)
            });
        }


        /**
         * Convert source/spanned data (target data format) to CSV
         * @param {Array} dataArray - Array of target data objects
         * @param {string} baseFilename - Base filename without extension
         * @param {Array} previousDataArray - Optional array of previous period target data objects
         * @param {string} previousDuration - Optional previous duration string (e.g., "-7d")
         * @returns {string} - Filename used for download
         */
        convertSourceDataToCSV(dataArray, baseFilename, previousDataArray = null, previousDuration = null) {
            if (typeof ChartActions === 'undefined' || !ChartActions.convertSourceDataToCSV) {
                throw new Error('GenieDashboard: ChartActions module is required but not loaded. Please ensure ChartActions.js is included before genieDashboard.js');
            }
            return ChartActions.convertSourceDataToCSV(dataArray, baseFilename, previousDataArray, previousDuration, {
                extractDataPoints: (series) => DataProcessor.extractDataPoints(series),
                parseDuration: (duration) => DataUtils.parseDuration(duration),
                downloadFile: (content, filename, mimeType) => this.downloadFile(content, filename, mimeType)
            });
        }


        /**
         * Convert view data (Chart.js format) to CSV
         * @param {Object} chartData - Chart.js data object with datasets
         * @param {string} baseFilename - Base filename without extension
         * @returns {string} - Filename used for download
         */
        convertViewDataToCSV(chartData, baseFilename) {
            if (typeof ChartActions === 'undefined' || !ChartActions.convertViewDataToCSV) {
                throw new Error('GenieDashboard: ChartActions module is required but not loaded. Please ensure ChartActions.js is included before genieDashboard.js');
            }
            return ChartActions.convertViewDataToCSV(chartData, baseFilename, {
                downloadFile: (content, filename, mimeType) => this.downloadFile(content, filename, mimeType)
            });
        }


        /**
         * Trigger file download
         * @param {string} content - File content
         * @param {string} filename - Filename
         * @param {string} mimeType - MIME type
         */
        downloadFile(content, filename, mimeType) {
            if (typeof FileUtils === 'undefined' || !FileUtils.downloadFile) {
                throw new Error('GenieDashboard: FileUtils module is required but not loaded. Please ensure FileUtils.js is included before genieDashboard.js');
            }
            return FileUtils.downloadFile(content, filename, mimeType);
        }

        /**
         * Extract unique metric names from series names
         * Metric name is the token between last ':' (if exists) and first '{' (if exists)
         * Examples:
         *   "cpu:user{avg}" -> "user"
         *   "memory:used{max}" -> "used"
         *   "network:bytes_in" -> "bytes_in"
         *   "cpu_user" -> "cpu_user" (no ':' or '{')
         * @param {Array<string>} seriesNames - Array of series names
         * @returns {Array<string>} Array of unique metric names
         */
        extractUniqueMetrics(seriesNames) {
            if (typeof Helpers === 'undefined' || !Helpers.extractUniqueMetrics) {
                throw new Error('GenieDashboard: Helpers module is required but not loaded. Please ensure Helpers.js is included before genieDashboard.js');
            }
            return Helpers.extractUniqueMetrics(seriesNames);
        }

        /**
         * Get panel metadata for all panels (including child panels from row panels)
         * NOTE: Parent row panels are NOT included - only their child panels are included
         * IMPORTANT: Generate metadata directly from this.panels data structure for consistency
         * with data retrieval (getPanelTimeseriesData uses this.panels)
         * @returns {Array} Array of panel metadata objects (excludes row panels themselves)
         */
        getPanelMetadata() {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.getPanelMetadata) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            
            // Get base panel metadata
            let panelMetadata = PanelUtils.getPanelMetadata(this.panels, (seriesNames) => this.extractUniqueMetrics(seriesNames), {
                charts: this.charts
            });
            
            // If includePanelsAboveThreshold is enabled and genie check is active, include panels from _geniePanelsMetThresholdList
            if (this.options.chat?.includePanelsAboveThreshold === true) {
                const genieCheckbox = document.getElementById(this.getInstanceId('toolbar-genie-checkbox'));
                const isGenieActive = genieCheckbox && genieCheckbox.checked;
                
                if (isGenieActive && this._geniePanelsMetThresholdList && Array.isArray(this._geniePanelsMetThresholdList) && this._geniePanelsMetThresholdList.length > 0) {
                    // Get panel IDs from _geniePanelsMetThresholdList
                    const thresholdPanelIds = this._geniePanelsMetThresholdList
                        .map(item => {
                            // Handle both direct panel objects and items with .panel property
                            const panel = item.panel || item;
                            return panel && panel.id ? String(panel.id) : null;
                        })
                        .filter(id => id !== null);
                    
                    // Get metadata for threshold panels that aren't already in the metadata
                    const existingPanelIds = new Set(panelMetadata.map(p => String(p.id)));
                    const thresholdPanelsMetadata = thresholdPanelIds
                        .filter(panelId => !existingPanelIds.has(panelId) && this.panels[panelId])
                        .map(panelId => {
                            const panel = this.panels[panelId];
                            return PanelUtils.getPanelMetadata(
                                { [panelId]: panel },
                                (seriesNames) => this.extractUniqueMetrics(seriesNames),
                                { charts: this.charts }
                            )[0];
                        })
                        .filter(meta => meta !== undefined);
                    
                    // Add threshold panels to the beginning of metadata (they are priority panels)
                    if (thresholdPanelsMetadata.length > 0) {
                        console.log('[Chat] Including', thresholdPanelsMetadata.length, 'panels from _geniePanelsMetThresholdList in metadata');
                        panelMetadata = [...thresholdPanelsMetadata, ...panelMetadata];
                    }
                }
            }
            
            return panelMetadata;
        }

        /**
         * Get timeseries data for specific panel IDs
         * @param {Array<string>} panelIds - Array of panel IDs to get data for
         * @returns {Object} Object mapping panel ID to timeseries data
         */
        getPanelTimeseriesData(panelIds) {
            if (typeof PanelUtils === 'undefined' || !PanelUtils.getPanelTimeseriesData) {
                throw new Error('GenieDashboard: PanelUtils module is required but not loaded. Please ensure PanelUtils.js is included before genieDashboard.js');
            }
            return PanelUtils.getPanelTimeseriesData(panelIds, {
                panelOrder: this.panelOrder,
                panels: this.panels,
                charts: this.charts
            });
        }

        /**
         * Render chat window in bottom right corner
         */
        renderChatWindow() {
            if (typeof DashboardChatAssistant === 'undefined' || !DashboardChatAssistant.renderChatWindow) {
                throw new Error('GenieDashboard: DashboardChatAssistant module is required but not loaded. Please ensure DashboardChatAssistant.js is included before genieDashboard.js');
            }
            DashboardChatAssistant.renderChatWindow(
                this,
                (id) => this.getInstanceId(id),
                (role, content, isThinking) => DashboardChatAssistant.addChatMessage(role, content, isThinking, this.chatMessages),
                (messageId, role, content) => DashboardChatAssistant.updateChatMessage(messageId, role, content, this.chatMessages),
                (message, history) => DashboardChatAssistant.sendChatMessage(message, history, this.options.chat?.apiBaseUrl || '/api/claude'),
                (userMessage, thinkingId) => this.processChatMessage(userMessage, thinkingId),
                this.chatHistory,
                this.options.chat
            );
        }

        /**
         * Add a message to the chat window
         * @param {string} role - 'user' or 'assistant'
         * @param {string} content - Message content
         * @param {boolean} isThinking - If true, message can be updated
         * @returns {string} Message ID for updating
         */
        addChatMessage(role, content, isThinking = false) {
            if (typeof DashboardChatAssistant === 'undefined' || !DashboardChatAssistant.addChatMessage) {
                throw new Error('GenieDashboard: DashboardChatAssistant module is required but not loaded.');
            }
            return DashboardChatAssistant.addChatMessage(role, content, isThinking, this.chatMessages);
        }

        /**
         * Update an existing chat message
         * @param {string} messageId - ID of message to update
         * @param {string} role - 'user' or 'assistant'
         * @param {string} content - New message content
         */
        updateChatMessage(messageId, role, content) {
            if (typeof DashboardChatAssistant === 'undefined' || !DashboardChatAssistant.updateChatMessage) {
                throw new Error('GenieDashboard: DashboardChatAssistant module is required but not loaded.');
            }
            return DashboardChatAssistant.updateChatMessage(messageId, role, content, this.chatMessages);
        }

        /**
         * Clear chat history and UI messages
         * Called when dashboard data changes (e.g., expert views loaded/unloaded)
         */
        clearChatHistory() {
            // Clear chat history array
            this.chatHistory = [];
            
            // Clear chat messages UI if chat window is rendered
            if (this.chatMessages) {
                this.chatMessages.innerHTML = "";
            }
            
            // Also try to find and clear chat messages by ID (in case reference is stale)
            const chatMessagesId = this.getInstanceId('chat-messages');
            const chatMessagesElement = document.getElementById(chatMessagesId);
            if (chatMessagesElement) {
                chatMessagesElement.innerHTML = "";
            }
            
            // Clear any cached chat templates to ensure fresh start
            if (this._chatTemplates) {
                this._chatTemplates = null;
            }
            
            console.log("[GenieDashboard] Chat history cleared (array, UI, and templates)");
        }

        /**
         * Process a chat message through Claude API
         * @param {string} userMessage - User's message
         * @param {string} thinkingId - ID of thinking message to update
         */
        async processChatMessage(userMessage, thinkingId) {
            if (typeof DashboardChatAssistant === 'undefined' || !DashboardChatAssistant.processChatMessage) {
                throw new Error('GenieDashboard: DashboardChatAssistant module is required but not loaded. Please ensure DashboardChatAssistant.js is included before genieDashboard.js');
            }
            return DashboardChatAssistant.processChatMessage(userMessage, thinkingId, {
                getPanelMetadata: () => this.getPanelMetadata(),
                sendChatMessage: (message, history) => this.sendChatMessage(message, history),
                extractTextFromClaudeResponse: (response) => this.extractTextFromClaudeResponse(response),
                panelOrder: this.panelOrder,
                panels: this.panels,
                getPanelTimeseriesData: (panelIds) => this.getPanelTimeseriesData(panelIds),
                chatHistory: this.chatHistory,
                updateChatMessage: (id, role, content) => this.updateChatMessage(id, role, content),
                dashboard: this,
                claudeApiBaseUrl: this.options.chat?.apiBaseUrl || "/api/claude",
                apiBaseUrl: this.options.chat?.apiBaseUrl ? this.options.chat.apiBaseUrl.replace("/claude", "/v1") : "/api/v1"
            });
        }

        /**
         * Send a message to Claude API
         * @param {string} message - Message to send
         * @param {Array} history - Conversation history
         * @returns {Promise<Object>} Claude response
         */
        async sendChatMessage(message, history = []) {
            if (typeof DashboardChatAssistant === 'undefined' || !DashboardChatAssistant.sendChatMessage) {
                throw new Error('GenieDashboard: DashboardChatAssistant module is required but not loaded.');
            }
            return DashboardChatAssistant.sendChatMessage(message, history, this.options.chat?.apiBaseUrl || '/api/claude');
        }

        /**
         * Extract text content from Claude API response
         * @param {Object} response - Claude API response object
         * @returns {string} Extracted text content
         */
        extractTextFromClaudeResponse(response) {
            if (typeof Helpers === 'undefined' || !Helpers.extractTextFromClaudeResponse) {
                throw new Error('GenieDashboard: Helpers module is required but not loaded. Please ensure Helpers.js is included before genieDashboard.js');
            }
            return Helpers.extractTextFromClaudeResponse(response);
        }
    } // End of class GenieDashboard

    // Export for use (similar to SFDataTable pattern)
    // Assign to window for global access, allowing multiple instances
    if (typeof window !== 'undefined') {
        window.GenieDashboard = GenieDashboard;

        // Apply genie check handler mixin if it was stored for later application
        if (typeof window._applyGenieCheckHandler === 'function') {
            window._applyGenieCheckHandler(GenieDashboard.prototype);
            console.log('[Genie] Applied genie check handler mixin to GenieDashboard');
        }
    }
    // Support CommonJS/Node.js if needed
    var moduleCheck = typeof module !== 'undefined' && module.exports;
    if (moduleCheck) {
        module.exports = GenieDashboard;
    }
})(); // End of IIFE - prevents duplicate declaration errors


