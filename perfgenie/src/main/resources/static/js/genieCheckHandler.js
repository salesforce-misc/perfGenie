/**
 * Genie Check Handler - Mixin for GenieDashboard
 * 
 * This module contains all genie check related functionality:
 * - State preservation (storing original panel state)
 * - Panel identification (collecting standalone and child panels)
 * - Threshold application (collapse/expand based on threshold)
 * - Panel sorting (sorting by change/anomaly score)
 * - Panel restoration (restoring original order and state)
 */

(function () {
    'use strict';

    /**
     * Apply genie check handler mixin to GenieDashboard
     * @param {Object} target - GenieDashboard instance or prototype
     */
    function applyGenieCheckHandler(target) {

        /**
         * Store normal state as panel attributes (source of truth)
         * This is called:
         * 1. When panel is first rendered (stores all state)
         * 2. When Y position changes in normal view (updates only Y)
         * 3. When capturing original state before genie operations (force storage)
         * 
         * @param {Object} panel - Panel object
         * @param {HTMLElement} panelDiv - Panel DOM element
         * @param {boolean} isFirstRender - If true, store all state; if false, only update Y position
         * @param {boolean} forceStorage - If true, force storage even if genie is active (for capturing original state)
         */
        target.storeNormalPanelState = function (panel, panelDiv, isFirstRender = false, forceStorage = false) {
            if (!panel || !panelDiv) return;
            
            // Check if genie check is active - don't store normal state during genie operations
            // UNLESS we're forcing storage (to capture original state before genie operations)
            if (!forceStorage) {
                const genieCheckbox = document.getElementById(this.getInstanceId('toolbar-genie-checkbox'));
                const isGenieActive = genieCheckbox && genieCheckbox.checked;
                if (isGenieActive) {
                    // Don't update normal state during genie operations (unless forced)
                    return;
                }
            }

            // Initialize normal state if first time
            if (!panel._normalState) {
                panel._normalState = {};
            }
            
            const isFirstTime = !panel._normalState.panelDiv;
            
            // On first render or explicit first render flag, store all state
            if (isFirstRender || isFirstTime) {
                // SIMPLE APPROACH: Always use original JSON gridPos values as source of truth
                // Don't read from DOM - DOM positions may be corrupted (e.g., top positions from genie view)
                let y = 0, h = 8, x = 0, w = 12;
                
                if (panel.gridPos) {
                    // CRITICAL: For Y, use originalY if preserved, otherwise use gridPos.y from JSON
                    // NEVER use DOM position - it may be corrupted
                    y = panel.gridPos.originalY !== undefined ? panel.gridPos.originalY :
                        (panel._genieOriginalY !== undefined ? panel._genieOriginalY :
                         (panel.gridPos.y !== undefined ? panel.gridPos.y : 0));
                    h = panel.gridPos.h !== undefined ? panel.gridPos.h : 8;
                    
                    // CRITICAL: For X/W, use originalX/originalW if preserved, otherwise use gridPos.x/w from JSON
                    x = panel.gridPos.originalX !== undefined ? panel.gridPos.originalX :
                        (panel._genieOriginalGridX !== undefined ? panel._genieOriginalGridX :
                         (panel.gridPos.x !== undefined ? panel.gridPos.x : 0));
                    w = panel.gridPos.originalW !== undefined ? panel.gridPos.originalW :
                        (panel._genieOriginalGridW !== undefined ? panel._genieOriginalGridW :
                         (panel.gridPos.w !== undefined ? panel.gridPos.w : 12));
                }
                
                // CRITICAL: If _normalState.y already exists and is reasonable (>= 20), preserve it
                // This prevents overwriting correct values with corrupted DOM positions
                if (panel._normalState?.y !== undefined && panel._normalState.y >= 20) {
                    y = panel._normalState.y;
                    console.log(`[Genie] Preserved existing _normalState.y=${y} for "${panel.title || panel.id}" (not reading from DOM)`);
                }
                
                // Only read height from DOM if not available in gridPos
                if (h === 8 && panelDiv) {
                    const gridRow = panelDiv.style.gridRow || window.getComputedStyle(panelDiv).gridRow;
                    if (gridRow && gridRow.includes('/')) {
                        const match = gridRow.match(/(\d+)\s*\/\s*(\d+)/);
                        if (match) {
                            h = parseInt(match[2]) - parseInt(match[1]);
                        }
                    }
                }
                // CRITICAL: Only read X/W from DOM if we don't have preserved original values
                // This prevents reading modified DOM values (e.g., full width from genie view)
                if (panelDiv) {
                    const gridColumn = panelDiv.style.gridColumn || window.getComputedStyle(panelDiv).gridColumn;
                    if (gridColumn && gridColumn.includes('/')) {
                        const match = gridColumn.match(/(\d+)\s*\/\s*(\d+)/);
                        if (match) {
                            const domX = parseInt(match[1]) - 1;
                            const domW = parseInt(match[2]) - parseInt(match[1]);
                            // Only use DOM values if we don't have preserved original values
                            if (panel.gridPos?.originalX === undefined && panel._genieOriginalGridX === undefined) {
                                x = domX;
                            }
                            if (panel.gridPos?.originalW === undefined && panel._genieOriginalGridW === undefined) {
                                w = domW;
                            }
                        }
                    }
                }
                
                // Determine collapsed state - check multiple sources for accuracy
                const isRowPanel = panel.type === 'row';
                const content = panelDiv.querySelector('.genie-dashboard-panel-content');
                
                let collapsed = false;
                if (isRowPanel) {
                    // For row panels, check panel.collapsed property first (most reliable)
                    collapsed = panel.collapsed === true;
                    // Also check DOM classes and content display as fallback
                    if (!collapsed) {
                        collapsed = panelDiv.classList.contains('genie-row-panel-collapsed') ||
                                   (content && (content.style.display === 'none' || window.getComputedStyle(content).display === 'none'));
                    }
                } else {
                    // For regular panels, check content display first (most reliable)
                    if (content) {
                        const computedDisplay = window.getComputedStyle(content).display;
                        collapsed = computedDisplay === 'none' || content.style.display === 'none';
            }
                    // Also check DOM class as fallback
                    if (!collapsed) {
                        collapsed = panelDiv.classList.contains('genie-panel-collapsed');
                    }
                }
                
                // Store all normal state (first time)
                panel._normalState.y = y;
                panel._normalState.h = h;
                panel._normalState.x = x;
                panel._normalState.w = w;
                panel._normalState.collapsed = collapsed;
                panel._normalState.title = panel.title || '';
                panel._normalState.panelDiv = panelDiv;
                
                const xSource = panel.gridPos?.originalX !== undefined ? 'gridPos.originalX' :
                                (panel._genieOriginalGridX !== undefined ? '_genieOriginalGridX' :
                                 (panel.gridPos?.x !== undefined ? 'gridPos.x' : 'default'));
                const wSource = panel.gridPos?.originalW !== undefined ? 'gridPos.originalW' :
                                (panel._genieOriginalGridW !== undefined ? '_genieOriginalGridW' :
                                 (panel.gridPos?.w !== undefined ? 'gridPos.w' : 'default'));
                console.log(`[Genie] Stored normal state (first time) for panel ${panel.id || 'unknown'}: y=${y}, h=${h}, x=${x} (from ${xSource}), w=${w} (from ${wSource}), collapsed=${collapsed}`);
            } else {
                // Update only Y position (when position changes in normal view)
                // CRITICAL: NEVER overwrite _normalState.y if it's already set from JSON
                // This prevents corrupted DOM positions (from genie top positions like 0, 8, 16) from overwriting correct JSON values
                // But we need to allow updates for legitimate position changes in normal view
                const gridRow = panelDiv.style.gridRow || window.getComputedStyle(panelDiv).gridRow;
                let currentY = panel._normalState.y; // Default to existing value
                
                if (gridRow && gridRow.includes('/')) {
                    const match = gridRow.match(/(\d+)\s*\/\s*\d+/);
                    if (match) {
                        currentY = parseInt(match[1]) - 2; // Account for controls row
                    }
                }
                
                // Only update if:
                // 1. Y changed AND
                // 2. Current Y is reasonable (not a top position from genie view: 0, 8, 16) OR _normalState.y is missing
                // This prevents top positions from overwriting correct values, but allows legitimate updates
                const isTopPosition = currentY === 0 || currentY === 8 || currentY === 16;
                const hasValidNormalState = panel._normalState.y !== undefined && panel._normalState.y >= 20;
                
                if (currentY !== panel._normalState.y) {
                    if (!isTopPosition || !hasValidNormalState) {
                        // Update if not a top position, or if we don't have a valid _normalState.y
                        panel._normalState.y = currentY;
                        console.log(`[Genie] Updated normal state Y position for panel ${panel.id || 'unknown'}: ${currentY}`);
                    } else {
                        // DOM has top position but _normalState.y is correct - preserve it
                        console.log(`[Genie] Ignored corrupted DOM Y=${currentY} for "${panel.title || panel.id}", preserved _normalState.y=${panel._normalState.y}`);
                    }
                }
            }
        };

        /**
         * Render panel using normal state attributes (reusable function)
         * This uses _normalState as source of truth, ignoring _genie properties
         * @param {Object} panel - Panel object
         * @param {HTMLElement} panelDiv - Panel DOM element
         * @param {boolean} useNormalState - If true, use _normalState; if false, use current gridPos
         */
        target.renderPanelFromState = function (panel, panelDiv, useNormalState = true) {
            if (!panel || !panelDiv) return;
            
            let y, h, x, w, collapsed, title;
            
            if (useNormalState && panel._normalState) {
                // Use normal state (source of truth for normal view)
                y = panel._normalState.y;
                h = panel._normalState.h;
                x = panel._normalState.x;
                w = panel._normalState.w;
                collapsed = panel._normalState.collapsed;
                title = panel._normalState.title;
            } else {
                // Use current gridPos (for genie view or initial render)
                if (panel.gridPos) {
                    y = panel.gridPos.y || 0;
                    h = panel.gridPos.h || 8;
                    x = panel.gridPos.x || 0;
                    w = panel.gridPos.w || 12;
                } else {
                    y = 0;
                    h = 8;
                    x = 0;
                    w = 12;
                }
                const isRowPanel = panel.type === 'row';
                collapsed = isRowPanel 
                    ? (panel.collapsed === true || panelDiv.classList.contains('genie-row-panel-collapsed'))
                    : panelDiv.classList.contains('genie-panel-collapsed');
                title = panel.title || '';
            }
            
            // Apply positions
            const effectiveHeight = collapsed ? 1 : h;
            const offset = typeof this.getControlsRowOffset === 'function' ? this.getControlsRowOffset() : 2;
            const gridRowValue = `${y + offset} / ${y + offset + effectiveHeight}`;
            const gridColumnValue = `${x + 1} / ${x + w + 1}`;
            
            panelDiv.style.gridRow = gridRowValue;
            panelDiv.style.setProperty('grid-row', gridRowValue, 'important');
            panelDiv.style.gridColumn = gridColumnValue;
            panelDiv.style.setProperty('grid-column', gridColumnValue, 'important');
            
            // Update gridPos
            if (panel.gridPos) {
                panel.gridPos.y = y;
                panel.gridPos.h = effectiveHeight;
                panel.gridPos.x = x;
                panel.gridPos.w = w;
            }

            // Apply collapse state - ensure complete restoration including button icon and dimensions
            const isRowPanel = panel.type === 'row';
            const content = panelDiv.querySelector('.genie-dashboard-panel-content');
            const collapseButton = panel._collapseButton || panelDiv.querySelector('.genie-dashboard-panel-collapse-btn') || 
                                   panelDiv.querySelector('.genie-dashboard-row-panel-collapse-btn');
            
            if (isRowPanel) {
                // Row panel collapse state
                if (collapsed) {
                    panelDiv.classList.add('genie-row-panel-collapsed');
                    panel.collapsed = true;
                    if (content) {
                        content.style.display = 'none';
                        content.style.visibility = 'hidden';
                    }
                    // Update collapse button icon for collapsed state
                    if (collapseButton) {
                        collapseButton.innerHTML = '<i class="fa fa-chevron-down" style="font-size: 10px; font-weight: 300;"></i>';
                        collapseButton.title = 'Expand panel';
                            }
                } else {
                    // CRITICAL: Remove ALL collapse-related classes and restore content
                    panelDiv.classList.remove('genie-row-panel-collapsed');
                    panel.collapsed = false;
                    if (content) {
                        content.style.display = 'flex';
                        content.style.visibility = 'visible';
                    }
                    // Update collapse button icon for expanded state
                    if (collapseButton) {
                        collapseButton.innerHTML = '<i class="fa fa-chevron-right" style="font-size: 10px; font-weight: 300;"></i>';
                        collapseButton.title = 'Collapse panel';
                    }
                    // Restore original dimensions if available (for proper expansion)
                    if (typeof this.restoreOriginalDimensions === 'function' && panel._originalDimensions) {
                        this.restoreOriginalDimensions(panel, panelDiv, content);
                    }
                }
            } else {
                // Regular panel collapse state
                if (collapsed) {
                    panelDiv.classList.add('genie-panel-collapsed');
                    if (content) {
                        content.style.display = 'none';
                        content.style.visibility = 'hidden';
                    }
                    // Update collapse button icon for collapsed state
                    if (collapseButton) {
                        collapseButton.innerHTML = '<i class="fa fa-chevron-down" style="font-size: 10px; font-weight: 300;"></i>';
                        collapseButton.title = 'Expand panel';
                    }
                } else {
                    // CRITICAL: Remove ALL collapse-related classes and restore content
                    panelDiv.classList.remove('genie-panel-collapsed');
                    if (content) {
                        content.style.display = 'flex';
                        content.style.visibility = 'visible';
                    }
                    // Update collapse button icon for expanded state
                    if (collapseButton) {
                        collapseButton.innerHTML = '<i class="fa fa-chevron-right" style="font-size: 10px; font-weight: 300;"></i>';
                        collapseButton.title = 'Collapse panel';
                        }
                    // Restore original dimensions if available (for proper expansion)
                    if (typeof this.restoreOriginalDimensions === 'function' && panel._originalDimensions) {
                        this.restoreOriginalDimensions(panel, panelDiv, content);
                    } else if (content) {
                        // Fallback: ensure content is visible
                        content.style.setProperty('display', 'flex', 'important');
                        content.style.setProperty('visibility', 'visible', 'important');
                    }
                }
            }
            
            // Ensure panel height is restored correctly based on collapse state
            // For collapsed panels, height should be 1; for expanded, use stored height
            if (panel.gridPos) {
                panel.gridPos.h = collapsed ? 1 : h;
            }
            
            // If expanding, ensure we update the grid position with the expanded height
            // This is critical for proper expansion
            if (!collapsed && typeof this.setPanelPosition === 'function') {
                this.setPanelPosition(panel, panelDiv, y, h, false);
            }
            
            // Force a reflow to ensure the grid recalculates (especially after expansion)
            void panelDiv.offsetHeight;
            
            // Resize charts after state change - wait for layout to settle
            if (!collapsed && content) {
                const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
                if (grid) {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            // Resize charts in this panel after expansion
                            const panelId = panel.id || (typeof this.getInstanceId === 'function' ? this.getInstanceId(`panel-${panel._genieOriginalIndex || -1}`) : null);
                            if (panelId && this.charts && this.charts[panelId]) {
                                const chart = this.charts[panelId];
                                if (chart && typeof chart.resize === 'function') {
                                    chart.resize();
                                }
            }

                            // Also check for any charts within the panel content
                            const chartCanvases = content.querySelectorAll('canvas');
                            chartCanvases.forEach(canvas => {
                                // Try to find the chart instance associated with this canvas
                                if (this.charts) {
                                    Object.keys(this.charts).forEach(chartId => {
                                        const chartInstance = this.charts[chartId];
                                        if (chartInstance && chartInstance.canvas === canvas) {
                                            if (typeof chartInstance.resize === 'function') {
                                                chartInstance.resize();
                                            }
                                        }
                });
            }
        });
            });
        });
                }
            }
            
            // Restore title if provided
            if (title) {
                const titleEl = panelDiv.querySelector('.genie-dashboard-panel-title');
                if (titleEl && typeof this.replacePlaceholdersInText === 'function') {
                    const processedTitle = this.replacePlaceholdersInText(title);
                    titleEl.textContent = processedTitle;
                    panel.title = processedTitle;
                }
            }
        };

        /**
         * Get all panels for genie check processing and separate by threshold
         * Collects both standalone panels and child panels from row panels
         * Stores original state during collection if not already stored
         * Separates panels into those that meet threshold and those that don't
         * @param {number} threshold - Required threshold value for separating panels
         * @returns {Object} Object with two lists: {panelsMetThresholdList, remainingPanelsList}
         *                  Each item has: { panel, index, isChild, isRowPanel?, parentRowPanel?, maxAbsChange?, anomalyScore? }
         */
        target.getAllPanelsForGenie = function (threshold) {
            if (threshold === undefined || threshold === null) {
                throw new Error('getAllPanelsForGenie requires a threshold parameter');
            }

            const allPanelsToStore = [];
            const useBackend = this.inputConfig?.isAnomalyProcessInUI === false;
            const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
            
            // Helper to find panel div for storing original state
            const findPanelDiv = (panel, index) => {
                if (!grid) return null;
                const allPanelDivs = Array.from(grid.querySelectorAll('.genie-dashboard-panel'))
                    .filter(div => !div.classList.contains('genie-dashboard-controls-row') && !div.hasAttribute('data-controls-row'));
                
                let panelDiv = document.getElementById(this.getInstanceId(`panel-${index}`));
                if (!panelDiv) {
                    panelDiv = allPanelDivs.find(div => div._panelObject === panel);
                }
                if (!panelDiv && panel._panelDiv) {
                    panelDiv = panel._panelDiv;
                }
                return panelDiv;
            };

            // Collect ALL panels: standalone panels, row panels, and child panels
            // While collecting, also store original state if not already stored
            this.panelOrder.normal.forEach((panelId, index) => {
                const panel = this.panels[panelId];
                if (!panel) return;

                if (panel.type !== 'row') {
                    // Standalone panel (not a row panel)
                    const item = {panel, index, isChild: false};
                    allPanelsToStore.push(item);
                    
                    // Store original state if not already stored
                    if (!panel._normalState || !panel._normalState.panelDiv) {
                        const panelDiv = findPanelDiv(panel, index);
                        if (panelDiv) {
                            this.storeNormalPanelState(panel, panelDiv, true, true); // true = first render, true = force storage
                            // Also store for backward compatibility
                            if (panel._normalState) {
                                panel._genieOriginalIndex = index;
                                panel._genieOriginalY = panel._normalState.y;
                                panel._genieOriginalHeight = panel._normalState.h;
                                panel._genieOriginalGridX = panel._normalState.x;
                                panel._genieOriginalGridW = panel._normalState.w;
                                panel._genieOriginalCollapsed = panel._normalState.collapsed;
                                panel._genieOriginalTitle = panel._normalState.title;
                                panel._genieOriginalPanelDiv = panelDiv;
                            }
                        }
                    }
                } else {
                    // Row panel - store the row panel itself
                    const item = {panel, index, isChild: false, isRowPanel: true};
                    allPanelsToStore.push(item);
                    
                    // Store original state for row panel if not already stored
                    if (!panel._normalState || !panel._normalState.panelDiv) {
                        const panelDiv = findPanelDiv(panel, index);
                        if (panelDiv) {
                            this.storeNormalPanelState(panel, panelDiv, true, true);
                            if (panel._normalState) {
                                panel._genieOriginalIndex = index;
                                panel._genieOriginalY = panel._normalState.y;
                                panel._genieOriginalHeight = panel._normalState.h;
                                panel._genieOriginalGridX = panel._normalState.x;
                                panel._genieOriginalGridW = panel._normalState.w;
                                panel._genieOriginalCollapsed = panel._normalState.collapsed;
                                panel._genieOriginalTitle = panel._normalState.title;
                                panel._genieOriginalPanelDiv = panelDiv;
                            }
                        }
                    }
                    
                    // Also collect child panels from row panels
                    // IMPORTANT: Use consistent ID format: row-{parentPanelId}-child-{childIndex}
                    // Use panelId (e.g., "p9") instead of numeric index (e.g., 9)
                    if (panel.panels && Array.isArray(panel.panels)) {
                        panel.panels.forEach((childPanel, childIndex) => {
                            // Use consistent child panel ID format with actual panel ID
                            const childPanelIndex = `row-${panelId}-child-${childIndex}`;
                            
                            const childItem = {
                                panel: childPanel,
                                index: childPanelIndex, // Use consistent format
                                isChild: true,
                                parentRowPanel: panel
                            };
                            allPanelsToStore.push(childItem);
                            
                            // Store original state for child panel if not already stored
                            // CRITICAL: Also update _normalState.x/w if preserved original values exist
                            // This ensures _normalState always has correct original values, even if it was previously
                            // populated with wrong values (e.g., full width from genie view)
                            const needsInitialStorage = !childPanel._normalState || !childPanel._normalState.panelDiv;
                            const hasPreservedOriginals = childPanel.gridPos?.originalX !== undefined || 
                                                          childPanel.gridPos?.originalW !== undefined ||
                                                          childPanel._genieOriginalGridX !== undefined ||
                                                          childPanel._genieOriginalGridW !== undefined;
                            
                            if (needsInitialStorage) {
                                // Try to find child panel div using the consistent ID format
                                const expectedChildId = this.getInstanceId(`panel-${childPanelIndex}`);
                                let childPanelDiv = document.getElementById(expectedChildId);
                                
                                // Fallback: try by _panelDiv reference
                                if (!childPanelDiv && childPanel._panelDiv && document.contains(childPanel._panelDiv)) {
                                    childPanelDiv = childPanel._panelDiv;
                                }
                                
                                // Fallback: try by matching panel object
                                if (!childPanelDiv && grid) {
                                    const allPanelDivs = Array.from(grid.querySelectorAll('.genie-dashboard-panel'))
                                        .filter(div => !div.classList.contains('genie-dashboard-controls-row') && !div.hasAttribute('data-controls-row'));
                                    childPanelDiv = allPanelDivs.find(div => div._panelObject === childPanel);
                                }
                                
                                if (childPanelDiv) {
                                    // DOM element exists - store state
                                    // CRITICAL: storeNormalPanelState will use gridPos.originalY/gridPos.y from JSON,
                                    // NOT DOM position, so _normalState.y will be correct
                                    this.storeNormalPanelState(childPanel, childPanelDiv, true, true);
                                    
                                    // CRITICAL: If _normalState.y was set from DOM (which might be corrupted),
                                    // override it with original JSON position
                                    if (childPanel._normalState && childPanel.gridPos) {
                                        // Use originalY if preserved, otherwise use gridPos.y from JSON
                                        const originalYFromJson = childPanel.gridPos.originalY !== undefined ? childPanel.gridPos.originalY :
                                                                  (childPanel._genieOriginalY !== undefined ? childPanel._genieOriginalY :
                                                                   (childPanel.gridPos.y !== undefined ? childPanel.gridPos.y : null));
                                        
                                        if (originalYFromJson !== null) {
                                            // Check if _normalState.y is different (might be from corrupted DOM)
                                            if (childPanel._normalState.y !== originalYFromJson) {
                                                // Check if _normalState.y seems corrupted (from top position)
                                                if (childPanel._normalState.y < 20 && originalYFromJson >= 20) {
                                                    childPanel._normalState.y = originalYFromJson;
                                                    console.log(`[Genie] Corrected _normalState.y for "${childPanel.title || childPanel.id}": ${childPanel._normalState.y} -> ${originalYFromJson} (was corrupted from DOM top position)`);
                                                }
                                            }
                                        }
                                    }
                                    
                                    if (childPanel._normalState) {
                                        childPanel._genieOriginalIndex = childPanelIndex;
                                        childPanel._genieOriginalY = childPanel._normalState.y;
                                        childPanel._genieOriginalHeight = childPanel._normalState.h;
                                        childPanel._genieOriginalGridX = childPanel._normalState.x;
                                        childPanel._genieOriginalGridW = childPanel._normalState.w;
                                        childPanel._genieOriginalCollapsed = childPanel._normalState.collapsed;
                                        childPanel._genieOriginalTitle = childPanel._normalState.title;
                                        childPanel._genieOriginalParentRowPanel = panel;
                                        childPanel._genieOriginalPanelDiv = childPanelDiv;
                                        
                                        console.log(`[Genie] Stored normal state for child "${childPanel.title || childPanel.id}": y=${childPanel._normalState.y}, x=${childPanel._normalState.x}, w=${childPanel._normalState.w}`);
                                    }
                                } else {
                                    // DOM element doesn't exist - store from gridPos (from JSON)
                                    // This handles children that were never rendered (parent collapsed)
                                    // CRITICAL: Use originalX/originalW if available (preserved from previous genie check),
                                    // otherwise use gridPos.x/w (from JSON definition)
                                    if (!childPanel._normalState) {
                                        childPanel._normalState = {};
                                    }
                                    
                                    const gridPos = childPanel.gridPos || { x: 0, y: 0, w: 12, h: 8 };
                                    // For X/W: prefer originalX/originalW (if preserved from previous genie check),
                                    // otherwise use gridPos.x/w (from JSON definition)
                                    // This ensures we get the true original values, not values modified by genie view
                                    const originalX = childPanel.gridPos?.originalX !== undefined ? childPanel.gridPos.originalX :
                                                     (childPanel._genieOriginalGridX !== undefined ? childPanel._genieOriginalGridX :
                                                      (gridPos.x !== undefined ? gridPos.x : 0));
                                    const originalW = childPanel.gridPos?.originalW !== undefined ? childPanel.gridPos.originalW :
                                                     (childPanel._genieOriginalGridW !== undefined ? childPanel._genieOriginalGridW :
                                                      (gridPos.w !== undefined ? gridPos.w : 12));
                                    
                                    childPanel._normalState.y = gridPos.y !== undefined ? gridPos.y : 0;
                                    childPanel._normalState.h = gridPos.h !== undefined ? gridPos.h : 8;
                                    childPanel._normalState.x = originalX;
                                    childPanel._normalState.w = originalW;
                                    childPanel._normalState.collapsed = false; // Children are not collapsed by default
                                    childPanel._normalState.title = childPanel.title || '';
                                    childPanel._normalState.panelDiv = null; // Mark as not rendered
                                    
                                    // Store _genieOriginal* properties
                                    childPanel._genieOriginalIndex = childPanelIndex;
                                    childPanel._genieOriginalY = childPanel._normalState.y;
                                    childPanel._genieOriginalHeight = childPanel._normalState.h;
                                    childPanel._genieOriginalGridX = originalX; // Use the determined originalX
                                    childPanel._genieOriginalGridW = originalW; // Use the determined originalW
                                    childPanel._genieOriginalCollapsed = childPanel._normalState.collapsed;
                                    childPanel._genieOriginalTitle = childPanel._normalState.title;
                                    childPanel._genieOriginalParentRowPanel = panel;
                                    childPanel._genieOriginalPanelDiv = null; // Mark as not rendered
                                    
                                    console.log(`[Genie] Stored normal state from gridPos for never-rendered child "${childPanel.title || childPanel.id}": y=${childPanel._normalState.y}, h=${childPanel._normalState.h}, x=${childPanel._normalState.x}, w=${childPanel._normalState.w} (originalX=${originalX} from ${childPanel.gridPos?.originalX !== undefined ? 'gridPos.originalX' : (childPanel._genieOriginalGridX !== undefined ? '_genieOriginalGridX' : 'gridPos.x')}, originalW=${originalW} from ${childPanel.gridPos?.originalW !== undefined ? 'gridPos.originalW' : (childPanel._genieOriginalGridW !== undefined ? '_genieOriginalGridW' : 'gridPos.w')}, gridPos.x=${gridPos.x}, gridPos.w=${gridPos.w})`);
                                }
                            } else if (hasPreservedOriginals && childPanel._normalState) {
                                // _normalState exists, but we have preserved original values
                                // Update _normalState.x/w from preserved originals to ensure correctness
                                const originalX = childPanel.gridPos?.originalX !== undefined ? childPanel.gridPos.originalX :
                                                 (childPanel._genieOriginalGridX !== undefined ? childPanel._genieOriginalGridX : null);
                                const originalW = childPanel.gridPos?.originalW !== undefined ? childPanel.gridPos.originalW :
                                                 (childPanel._genieOriginalGridW !== undefined ? childPanel._genieOriginalGridW : null);
                                
                                if (originalX !== null && childPanel._normalState.x !== originalX) {
                                    console.log(`[Genie] Correcting _normalState.x for "${childPanel.title || childPanel.id}": ${childPanel._normalState.x} -> ${originalX}`);
                                    childPanel._normalState.x = originalX;
                                    // Also update _genieOriginalGridX to keep them in sync
                                    childPanel._genieOriginalGridX = originalX;
                                }
                                if (originalW !== null && childPanel._normalState.w !== originalW) {
                                    console.log(`[Genie] Correcting _normalState.w for "${childPanel.title || childPanel.id}": ${childPanel._normalState.w} -> ${originalW}`);
                                    childPanel._normalState.w = originalW;
                                    // Also update _genieOriginalGridW to keep them in sync
                                    childPanel._genieOriginalGridW = originalW;
                                }
                            }
                        });
                    }
                }
            });

            // Store original panel order (only once)
            if (!this._genieOriginalPanelOrder) {
                this._genieOriginalPanelOrder = [...this.panelOrder.normal];
                console.log(`[Genie] Stored original panel order: ${this._genieOriginalPanelOrder.length} panels`);
            }

            // Separate panels into two lists based on threshold
            const panelsMetThresholdList = [];
            const remainingPanelsList = [];

            let childPanelsProcessed = 0;
            let childPanelsMetThreshold = 0;
            let childPanelsRemaining = 0;

            allPanelsToStore.forEach((item) => {
                const panel = item.panel;
                if (!panel) {
                    remainingPanelsList.push(item);
                    return;
                }

                const isChildPanel = item.isChild === true;
                const panelTitle = panel.title || panel.id || item.index;

                let meetsThreshold = false;
                let maxAbsChange = 0;

                if (useBackend && panel._anomalyScore !== undefined && panel._anomalyScore !== null) {
                    // Backend processing: use anomaly score
                    const anomalyScore = panel._anomalyScore;
                    const hasAnomalyScore = !isNaN(anomalyScore) && isFinite(anomalyScore);

                    if (hasAnomalyScore) {
                        maxAbsChange = anomalyScore;
                        // Panel meets threshold if anomalyScore >= threshold
                        meetsThreshold = anomalyScore >= threshold;
                        
                        // Special handling for non-comparable panels
                        if (panel._genieNonComparable) {
                            meetsThreshold = panel._genieNonComparablePrioritize; // Only if prioritized
                        }
                    }
                } else if (panel.change && Object.keys(panel.change).length > 0) {
                    // UI processing: use percentage change
                    // Calculate max absolute change value
                    const changeValues = Object.entries(panel.change)
                        .filter(([key, value]) => !key.endsWith('_byDuration') && !key.endsWith('_maxAbsChangeDuration'))
                        .map(([key, value]) => value)
                        .filter(v => v !== null && v !== undefined && !isNaN(v) && isFinite(v));

                    if (changeValues.length > 0) {
                        maxAbsChange = Math.max(...changeValues.map(v => Math.abs(v)));
                        // Panel meets threshold if |maxAbsChange| >= threshold
                        meetsThreshold = maxAbsChange >= threshold;
                    }
                }

                // Log child panel status
                if (isChildPanel) {
                    childPanelsProcessed++;
                    const hasChangeData = panel.change && Object.keys(panel.change).length > 0;
                    const hasAnomalyScore = useBackend && panel._anomalyScore !== undefined && panel._anomalyScore !== null;
                    const parentCollapsed = item.parentRowPanel && (item.parentRowPanel.collapsed === true);
                    
                    if (meetsThreshold) {
                        childPanelsMetThreshold++;
                        console.log(`[Genie] Child panel "${panelTitle}" meets threshold: maxAbsChange=${maxAbsChange.toFixed(2)}, hasChangeData=${hasChangeData}, hasAnomalyScore=${hasAnomalyScore}, parentCollapsed=${parentCollapsed}`);
                    } else {
                        childPanelsRemaining++;
                        console.log(`[Genie] Child panel "${panelTitle}" does NOT meet threshold: maxAbsChange=${maxAbsChange.toFixed(2)}, hasChangeData=${hasChangeData}, hasAnomalyScore=${hasAnomalyScore}, parentCollapsed=${parentCollapsed}, changeKeys=${hasChangeData ? Object.keys(panel.change).length : 0}`);
                    }
                }

                // Add to appropriate list
                if (meetsThreshold) {
                    panelsMetThresholdList.push({
                        ...item,
                        maxAbsChange: maxAbsChange,
                        anomalyScore: useBackend && panel._anomalyScore !== undefined ? panel._anomalyScore : undefined
                    });
                } else {
                    remainingPanelsList.push(item);
                }
            });

            // Log child panel summary
            if (childPanelsProcessed > 0) {
                console.log(`[Genie] getAllPanelsForGenie: Processed ${childPanelsProcessed} child panels: ${childPanelsMetThreshold} meet threshold, ${childPanelsRemaining} remaining`);
            }

            // Sort panelsMetThresholdList by max absolute change or anomaly score (descending)
            // Higher values (more significant changes/anomalies) come first
            panelsMetThresholdList.sort((a, b) => {
                const maxA = a.maxAbsChange !== undefined ? a.maxAbsChange : 0;
                const maxB = b.maxAbsChange !== undefined ? b.maxAbsChange : 0;
                return maxB - maxA; // Descending order
            });

            // Log separation results
            if (useBackend) {
                console.log(`[Genie] getAllPanelsForGenie: Sorted ${panelsMetThresholdList.length} panels that meet threshold by anomaly score (descending)`);
            } else {
                console.log(`[Genie] getAllPanelsForGenie: Sorted ${panelsMetThresholdList.length} panels that meet threshold by max absolute change (descending)`);
            }
            console.log(`[Genie] getAllPanelsForGenie: Separated panels: ${panelsMetThresholdList.length} meet threshold, ${remainingPanelsList.length} remaining`);

            return {
                panelsMetThresholdList: panelsMetThresholdList,
                remainingPanelsList: remainingPanelsList
            };
        };

        /**
         * @deprecated Use getAllPanelsForGenie(threshold) instead
         * Kept for backward compatibility
         */
        target.identifyPanelsForGenie = function (threshold) {
            return this.getAllPanelsForGenie(threshold);
        };

        /**
         * Execute the complete genie check flow
         * Orchestrates all 4 steps: fetch data, calculate changes, get sorted lists, render
         * @param {number} threshold - Optional threshold value (if not provided, gets from input)
         */
        target.executeGenieCheckFlow = async function (threshold) {
            const flowStartTime = performance.now();
            console.log(`[Genie Performance] Starting genie check flow at ${new Date().toISOString()}`);
            
            // Initialize performance metrics
            this.performanceMetrics = {
                dataFetch: {start: 0, end: 0, duration: 0},
                anomalyApi: {start: 0, end: 0, duration: 0},
                render: {start: 0, end: 0, duration: 0},
                total: {start: flowStartTime, end: 0, duration: 0}
            };

            try {
                // Get threshold from input if not provided
                if (threshold === undefined || threshold === null) {
                    const thresholdInput = document.getElementById(this.getInstanceId('toolbar-genie-threshold'));
                    threshold = thresholdInput ? parseFloat(thresholdInput.value) || 1 : 1;
                }

                // STEP 1: Fetch all compare data
                this.performanceMetrics.dataFetch.start = performance.now();
                
                // Check if fetchAllCompareOptionsForGenie is available
                if (typeof this.fetchAllCompareOptionsForGenie !== 'function') {
                    // Try to get it from the prototype
                    const protoMethod = this.constructor?.prototype?.fetchAllCompareOptionsForGenie;
                    if (typeof protoMethod === 'function') {
                        await protoMethod.call(this);
                    } else {
                        console.error('[Genie] fetchAllCompareOptionsForGenie is not available:', {
                            onInstance: typeof this.fetchAllCompareOptionsForGenie,
                            onConstructor: this.constructor && typeof this.constructor.prototype?.fetchAllCompareOptionsForGenie,
                            onGenieDashboard: typeof GenieDashboard !== 'undefined' && typeof GenieDashboard.prototype?.fetchAllCompareOptionsForGenie,
                            constructorName: this.constructor?.name,
                            instanceKeys: Object.keys(this).filter(k => k.includes('fetch')),
                            prototypeKeys: this.constructor?.prototype ? Object.keys(this.constructor.prototype).filter(k => k.includes('fetch')) : []
                        });
                        throw new Error('fetchAllCompareOptionsForGenie is not available. This method should be defined in GenieDashboard class.');
                    }
                } else {
                    await this.fetchAllCompareOptionsForGenie();
                }
                this.performanceMetrics.dataFetch.end = performance.now();
                this.performanceMetrics.dataFetch.duration = this.performanceMetrics.dataFetch.end - this.performanceMetrics.dataFetch.start;
                console.log(`[Genie Performance] Step 1 (Data Fetch) completed: ${this.performanceMetrics.dataFetch.duration.toFixed(2)}ms`);

                // Calculate and store aligned y-axis range for all timeseries charts
                this.calculateAlignedYAxisRange();

                // Create and show vertical grid line overlay
                this.createGenieVerticalGridLine();

                // Setup context menus for all existing charts
                this.setupContextMenusForAllCharts();

                // Update threshold input box if backend processing is enabled
                const useBackend = this.inputConfig?.isAnomalyProcessInUI === false;
                if (useBackend) {
                    const thresholdInputEl = document.getElementById(this.getInstanceId('toolbar-genie-threshold'));
                    if (thresholdInputEl) {
                        const collapseThreshold = this.inputConfig?.genieAnomalyCollapseThreshold ||
                            this.inputConfig?.genieAnomalyColorThreshold ||
                            0.3;
                        thresholdInputEl.value = collapseThreshold.toString();
                        threshold = collapseThreshold; // Update threshold for Step 3
                        console.log(`[Genie] Updated threshold input to ${collapseThreshold} (collapse/expand threshold for anomaly scores 0.0-1.0)`);
                    }
                }

                // STEP 2: Calculate changes
                // Reset _genieChangeCalculated for all panels (including child panels) to ensure fresh calculation
                this.panelOrder.normal.forEach(panelId => {
                    const panel = this.panels[panelId];
                    if (!panel) return;
                    
                    // Reset for standalone panels
                    if (panel.type !== 'row') {
                        panel._genieChangeCalculated = false;
                    } else {
                        // Reset for row panels and their child panels
                        panel._genieChangeCalculated = false;
                        if (panel.panels && Array.isArray(panel.panels)) {
                            panel.panels.forEach(childPanel => {
                                if (childPanel) {
                                    childPanel._genieChangeCalculated = false;
                                }
                            });
                        }
                    }
                });
                console.log(`[Genie] Reset _genieChangeCalculated flag for all panels to ensure fresh calculation`);
                
                this.performanceMetrics.anomalyApi.start = performance.now();
                await this.calculateGeniePercentageChange();
                this.performanceMetrics.anomalyApi.end = performance.now();
                this.performanceMetrics.anomalyApi.duration = this.performanceMetrics.anomalyApi.end - this.performanceMetrics.anomalyApi.start;
                console.log(`[Genie Performance] Step 2 (Calculate Changes) completed: ${this.performanceMetrics.anomalyApi.duration.toFixed(2)}ms`);

                // STEP 3: Get sorted lists (initializes state + stores original state + separates by threshold)
                this.performanceMetrics.render.start = performance.now();
                const {panelsMetThresholdList, remainingPanelsList} = this.getAllPanelsForGenie(threshold);
                console.log(`[Genie Performance] Step 3 (Get Sorted Lists) completed: getAllPanelsForGenie returned ${panelsMetThresholdList.length} panels meeting threshold, ${remainingPanelsList.length} remaining`);

                // Store lists as dashboard attributes for use with dashboard assistant
                this._geniePanelsMetThresholdList = panelsMetThresholdList;
                this._genieRemainingPanelsList = remainingPanelsList;
                console.log(`[Genie] Stored panelsMetThresholdList (${panelsMetThresholdList.length} panels) and remainingPanelsList (${remainingPanelsList.length} panels) as dashboard attributes`);

                // STEP 4: Render
                await this.applyGenieView(panelsMetThresholdList, remainingPanelsList);
                this.performanceMetrics.render.end = performance.now();
                this.performanceMetrics.render.duration = this.performanceMetrics.render.end - this.performanceMetrics.render.start;
                console.log(`[Genie Performance] Step 4 (Render) completed: ${this.performanceMetrics.render.duration.toFixed(2)}ms`);

                // Log final performance metrics
                this.performanceMetrics.total.end = performance.now();
                this.performanceMetrics.total.duration = this.performanceMetrics.total.end - this.performanceMetrics.total.start;
                console.log(`[Genie Performance] ========================================`);
                console.log(`[Genie Performance] Genie Check Flow Performance Metrics:`);
                console.log(`[Genie Performance]   Total Duration: ${this.performanceMetrics.total.duration.toFixed(2)}ms`);
                console.log(`[Genie Performance]   Step 1 (Data Fetch): ${this.performanceMetrics.dataFetch.duration.toFixed(2)}ms (${((this.performanceMetrics.dataFetch.duration / this.performanceMetrics.total.duration) * 100).toFixed(1)}%)`);
                console.log(`[Genie Performance]   Step 2 (Calculate): ${this.performanceMetrics.anomalyApi.duration.toFixed(2)}ms (${((this.performanceMetrics.anomalyApi.duration / this.performanceMetrics.total.duration) * 100).toFixed(1)}%)`);
                console.log(`[Genie Performance]   Step 3 (Get Lists): ${(this.performanceMetrics.render.start - this.performanceMetrics.anomalyApi.end).toFixed(2)}ms`);
                console.log(`[Genie Performance]   Step 4 (Render): ${this.performanceMetrics.render.duration.toFixed(2)}ms (${((this.performanceMetrics.render.duration / this.performanceMetrics.total.duration) * 100).toFixed(1)}%)`);
                console.log(`[Genie Performance] ========================================`);

            } catch (error) {
                console.error('[Genie] Error in executeGenieCheckFlow:', error);
                throw error;
            }
        };

        /**
         * Store original state for all panels (standalone + children)
         * Creates a complete snapshot that can be restored in one simple pass
         * @param {Array} allPanelsToStore - Array of panels (deprecated - now called internally by getAllPanelsForGenie)
         */
        target.storeOriginalPanelState = function (allPanelsToStore) {
            const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
            if (!grid) {
                console.warn('[Genie] Dashboard grid not found, cannot store original state');
                return;
            }

            const allPanelDivs = Array.from(grid.querySelectorAll('.genie-dashboard-panel'))
                .filter(div => !div.classList.contains('genie-dashboard-controls-row') && !div.hasAttribute('data-controls-row'));

            // Helper to find panel div
            const findPanelDiv = (panel, index) => {
                let panelDiv = document.getElementById(this.getInstanceId(`panel-${index}`));
                if (!panelDiv) {
                    panelDiv = allPanelDivs.find(div => div._panelObject === panel);
                }
                if (!panelDiv && panel._panelDiv) {
                    panelDiv = panel._panelDiv;
                }
                return panelDiv;
            };

            // Store original panel order (only once)
            if (!this._genieOriginalPanelOrder) {
                this._genieOriginalPanelOrder = [...this.panelOrder.normal];
                console.log(`[Genie] Stored original panel order: ${this._genieOriginalPanelOrder.length} panels`);
        }

            // Store normal state for all panels using the reusable function
            // This becomes the source of truth for normal view (hybrid approach)
            allPanelsToStore.forEach(({panel, index, isChild, parentRowPanel}) => {
                const panelDiv = findPanelDiv(panel, isChild ? -1 : (typeof index === 'number' ? index : -1));
                if (!panelDiv || !panel) return;

                // CRITICAL: Always capture current state when genie check is first enabled
                // This ensures we have the true original state before any genie operations
                // Even if _normalState exists from normal rendering, we need to refresh it
                // to capture any manual user changes (collapse/expand) since initial render
                const shouldStore = !panel._normalState || !panel._normalState.panelDiv;
                if (shouldStore) {
                    this.storeNormalPanelState(panel, panelDiv, true, true); // true = first render, true = force storage
            } else {
                    // _normalState already exists - verify it's valid and log for debugging
                    console.log(`[Genie] Panel ${panel.id || index} already has _normalState, using existing: collapsed=${panel._normalState.collapsed}`);
            }
                
                // Verify normal state was stored before accessing it
                if (panel._normalState) {
                    console.log(`[Genie] Stored normal state for panel ${panel.id || index}: y=${panel._normalState.y}, collapsed=${panel._normalState.collapsed}`);
                    
                    // Also store for backward compatibility
                    panel._genieOriginalIndex = typeof index === 'number' ? index : -1;
                    panel._genieOriginalY = panel._normalState.y;
                    panel._genieOriginalHeight = panel._normalState.h;
                    panel._genieOriginalGridX = panel._normalState.x;
                    panel._genieOriginalGridW = panel._normalState.w;
                    panel._genieOriginalCollapsed = panel._normalState.collapsed;
                    panel._genieOriginalTitle = panel._normalState.title;
                    panel._genieOriginalParentRowPanel = parentRowPanel || undefined;
                    panel._genieOriginalPanelDiv = panelDiv;
                } else {
                    console.warn(`[Genie] Failed to store normal state for panel ${panel.id || index} - storeNormalPanelState may have returned early`);
            }
        });

            const storedCount = allPanelsToStore.filter(({panel}) => panel._normalState).length;
            console.log(`[Genie] Stored normal state for ${storedCount} panels`);
        };

        /**
         * Apply genie threshold to panels (collapse/expand based on threshold)
         * This is part of the sortAndReorderPanelsByChange function
         * @param {Array} sortedPanels - Array of sorted panels with change/anomaly data
         * @param {number} threshold - Threshold value for collapse/expand
         * @returns {number} Number of panels updated
         */
        target.applyGenieThreshold = function (sortedPanels, threshold) {
            const useBackend = this.inputConfig?.isAnomalyProcessInUI === false;
        let panelsUpdated = 0;

        sortedPanels.forEach((item, sortedIndex) => {
            const panel = item.panel;
            const panelDiv = item.div;
            const isChildPanel = item.isChildPanel;

                if (!panelDiv || !panel) {
                return;
            }

            const panelTitle = panel ? (panel.title || panel.id || `panel-${item.index}`) : 'no panel object';

            // Check if panel should be collapsed based on threshold
            let shouldCollapse;

                if (useBackend && panel._anomalyScore !== undefined && panel._anomalyScore !== null) {
                // Backend processing: use anomaly score (range 0.0-1.0)
                const anomalyScore = panel._anomalyScore;
                const hasAnomalyScore = !isNaN(anomalyScore) && isFinite(anomalyScore);

                // Special handling for non-comparable panels
                if (panel._genieNonComparable) {
                    if (panel._genieNonComparablePrioritize) {
                        shouldCollapse = false;
                        console.log(`[Genie] Non-comparable panel "${panelTitle}" meets threshold percent - will be expanded and prioritized (anomalyScore=${anomalyScore.toFixed(2)})`);
                    } else {
                        shouldCollapse = true;
                        console.log(`[Genie] Non-comparable panel "${panelTitle}" doesn't meet threshold percent - will be collapsed (anomalyScore=${anomalyScore.toFixed(2)})`);
                    }
                } else {
                    // Regular comparable panel - use standard threshold logic
                        shouldCollapse = hasAnomalyScore ? anomalyScore < threshold : true;
                    console.log(`[Genie] Using anomaly score for collapse/expand: panel="${panelTitle}", anomalyScore=${anomalyScore.toFixed(2)}, threshold=${threshold}, shouldCollapse=${shouldCollapse}`);
                }
            } else {
                // UI processing: use percentage change (original logic)
                const hasChange = item.maxAbsChange !== undefined && item.maxAbsChange > 0;
                    shouldCollapse = hasChange ? Math.abs(item.maxAbsChange) < threshold : true;
            }

            // Get original collapsed state (before genie check)
                const wasOriginallyCollapsed = panel._genieOriginalCollapsed === true;

                // Get current collapsed state from DOM
                const panelId = panel.id || `panel-${item.index}`;
                const genieState = this._genieStateMap[panelId];
                const isCurrentlyCollapsed = genieState ? genieState.isCollapsed : panelDiv.classList.contains('genie-panel-collapsed');
                const content = panel._contentElement || panelDiv.querySelector('.genie-dashboard-panel-content');
                const collapseButton = panel._collapseButton || panelDiv.querySelector('.genie-dashboard-panel-collapse-btn');

                // Find panel index in panelOrder.normal (may be -1 for child panels)
                const panelIndex = this.panelOrder.normal.indexOf(String(panel.id));
                const canProcess = isChildPanel || panelIndex >= 0;

                // Apply threshold-based collapse/expand
                if (shouldCollapse && !isCurrentlyCollapsed) {
                    if (canProcess && content && collapseButton) {
                        const stateChanged = this.updatePanelCollapseStateInGenieView(panel, panelDiv, true, panelId, isChildPanel, sortedIndex);
                        if (stateChanged) {
                            panelsUpdated++;
                        }
                    }
                } else if (!shouldCollapse && isCurrentlyCollapsed) {
                    if (canProcess) {
                        const stateChanged = this.updatePanelCollapseStateInGenieView(panel, panelDiv, false, panelId, isChildPanel, sortedIndex);
                        if (stateChanged) {
                            panelsUpdated++;
                        }
                    }
                }

                // Store genie view state for all panels
                if (!this._genieStateMap[panelId]) {
                const panelCollapsedState = panelDiv ? panelDiv.classList.contains('genie-panel-collapsed') : false;
                    const isParentRowPanel = panel.type === 'row' && panel.panels && Array.isArray(panel.panels) && panel.panels.length > 0;
                this._genieStateMap[panelId] = {
                    sortedIndex: sortedIndex,
                    isCollapsed: panelCollapsedState,
                    y: undefined, // Will be set by recalculateAllYPositions
                    gridX: 0,
                        gridW: 12,
                        isChildPanel: isChildPanel,
                        isParentRowPanel: isParentRowPanel,
                        title: panel.title || panel.id || ''
                };
            }
            });

            return panelsUpdated;
        };

        /**
         * Sort panels by genie change/anomaly score
         * This is part of the sortAndReorderPanelsByChange function
         * @param {Array} allPanelsWithDivs - Array of panels with their DOM elements
         * @returns {Object} Object with sortedPanels, panelsWithChange, panelsWithoutChange
         */
        target.sortPanelsByGenie = function (allPanelsWithDivs) {
            const useBackend = this.inputConfig?.isAnomalyProcessInUI === false;
            const panelsWithChange = [];
            const panelsWithoutChange = [];

            // Process ALL panels for sorting
            allPanelsWithDivs.forEach((item) => {
                const panel = item.panel;

                if (useBackend && panel && panel._anomalyScore !== undefined && panel._anomalyScore !== null) {
                    // Backend processing: use anomaly score for sorting
                        const anomalyScore = panel._anomalyScore;
                    const hasAnomalyScore = !isNaN(anomalyScore) && isFinite(anomalyScore);

                    // For non-comparable panels, only include if they meet threshold percent (prioritize)
                    if (panel._genieNonComparable && !panel._genieNonComparablePrioritize) {
                        panelsWithoutChange.push(item);
                        console.log(`[Genie] Non-comparable panel "${panel.title || panel.id}" doesn't meet threshold percent - excluded from sorting`);
                    } else if (hasAnomalyScore) {
                        panelsWithChange.push({
                            ...item,
                            maxAbsChange: anomalyScore, // Use anomaly score for sorting
                            anomalyScore: anomalyScore
                        });
                                    } else {
                        panelsWithoutChange.push(item);
                                }
                } else if (panel && panel.change && Object.keys(panel.change).length > 0) {
                    // UI processing: use percentage change for sorting
                    const changeValues = Object.entries(panel.change)
                        .filter(([key, value]) => !key.endsWith('_byDuration') && !key.endsWith('_maxAbsChangeDuration'))
                        .map(([key, value]) => value)
                        .filter(v => v !== null && v !== undefined && !isNaN(v) && isFinite(v));

                    if (changeValues.length > 0) {
                        const maxAbsChange = Math.max(...changeValues.map(v => Math.abs(v)));
                        panelsWithChange.push({
                            ...item,
                            maxAbsChange: maxAbsChange
                        });
                    } else {
                        panelsWithoutChange.push(item);
                    }
                } else {
                    panelsWithoutChange.push(item);
            }
        });

            // Sort panels with change/anomaly by max absolute change or anomaly score (descending)
            panelsWithChange.sort((a, b) => b.maxAbsChange - a.maxAbsChange);

            // Combine: panels with change/anomaly first (sorted), then panels without data
            const sortedPanels = [...panelsWithChange, ...panelsWithoutChange];

            // Populate _genieSortOrderArray with sorted panel order
            // Row panels are already excluded (they were never added to allPanelsWithDivs)
            this._genieSortOrderArray = sortedPanels
            .filter(item => item.panel !== null)
            .map(item => item.panel);

            return {
                sortedPanels: sortedPanels,
                panelsWithChange: panelsWithChange,
                panelsWithoutChange: panelsWithoutChange
            };
        };

        /**
         * Simple restore using normal state attributes - no capture or calculation needed
         * Just render each panel using its _normalState (source of truth)
         */
        /**
         * SIMPLE RESTORE: Just restore everything to pre-genie state
         * Ignore everything that happened during genie check - just restore from _normalState
         * This is the same state that worked before genie check, so it should work after restore
         */
        target._restoreFromNormalState = async function () {
            if (!this._genieOriginalPanelOrder || !Array.isArray(this._genieOriginalPanelOrder)) {
                console.warn('[Genie] No original panel order stored');
                return;
            }
            
            console.log('[Genie] Starting simple restore - removing children shown at top, will re-render fresh');
            
            // Restore panel order
            this.panelOrder.normal = [...this._genieOriginalPanelOrder];
            
            // STEP 1: Find and REMOVE all children that were shown at top during genie check
            // This is simpler than repositioning - just remove them and re-render fresh
            const childrenToRemove = [];
            
            this._genieOriginalPanelOrder.forEach((panelId) => {
                const panel = this.panels[panelId];
                if (!panel || panel.type !== 'row' || !panel.panels || !Array.isArray(panel.panels)) return;
                
                // CRITICAL: Only remove children from COLLAPSED parents that were shown at top
                // Children of already expanded parents should be preserved and restored normally
                const wasParentCollapsed = panel._normalState?.collapsed === true;
                
                panel.panels.forEach((childPanel) => {
                    // ONLY remove children that:
                    // 1. Were shown at top during genie check (_genieShowIndependently === true)
                    // 2. AND their parent was COLLAPSED when genie was checked
                    // This preserves children of already expanded parents
                    if (childPanel._genieShowIndependently === true && wasParentCollapsed) {
                        const childDiv = childPanel._panelDiv || childPanel._normalState?.panelDiv;
                        if (childDiv && document.contains(childDiv)) {
                            childrenToRemove.push({ childPanel, childDiv, parentPanel: panel });
                        }
                    }
                });
            });
            
            // Remove all children that were shown at top
            childrenToRemove.forEach(({ childPanel, childDiv, parentPanel }) => {
                console.log(`[Genie] Removing child "${childPanel.title || childPanel.id}" that was shown at top (will re-render fresh)`);
                
                // Remove DOM element completely
                if (childDiv.parentNode) {
                    childDiv.remove();
                }
                
                // Clear all references
                childPanel._panelDiv = undefined;
                if (childPanel._normalState) {
                    childPanel._normalState.panelDiv = undefined;
                }
                
                // Clear all genie flags
                childPanel._genieShowIndependently = undefined;
                childPanel._genieStandaloneY = undefined;
                childPanel._skipRender = false;
                
                // Mark parent as needing to render children
                parentPanel._childrenRendered = false;
            });
            
            console.log(`[Genie] Removed ${childrenToRemove.length} children that were shown at top`);
            
            // STEP 2: Restore all panels from _normalState (captured BEFORE genie check)
            this._genieOriginalPanelOrder.forEach((panelId) => {
                const panel = this.panels[panelId];
                if (!panel) return;

                // Get panelDiv from normal state or fallback
                const panelDiv = panel._normalState?.panelDiv || panel._panelDiv;
                if (!panelDiv || !document.contains(panelDiv)) return;

                // CRITICAL: Restore panel state from _normalState for PositionCalculator
                // PositionCalculator reads from panel.collapsed and panel._isCollapsed
                if (panel._normalState && panel._normalState.collapsed !== undefined) {
                    panel.collapsed = panel._normalState.collapsed;
                    panel._isCollapsed = panel._normalState.collapsed;
                }

                // Render using normal state (ignores _genie properties)
                this.renderPanelFromState(panel, panelDiv, true);
                
                // CRITICAL: Update gridPos.originalY from _normalState.y after restore
                // This ensures PositionCalculator uses correct original positions
                if (panel._normalState && panel._normalState.y !== undefined && panel.gridPos) {
                    panel.gridPos.originalY = panel._normalState.y;
                    panel.gridPos.originalX = panel._normalState.x !== undefined ? panel._normalState.x : (panel.gridPos.originalX || panel.gridPos.x);
                    panel.gridPos.originalW = panel._normalState.w !== undefined ? panel._normalState.w : (panel.gridPos.originalW || panel.gridPos.w);
                    panel.gridPos.originalH = panel._normalState.h !== undefined ? panel._normalState.h : (panel.gridPos.originalH || panel.gridPos.h);
                }

                // Restore child panels if this is a row panel
                if (panel.type === 'row' && panel.panels && Array.isArray(panel.panels)) {
                    // Check if parent row panel is collapsed
                    const isParentCollapsed = panel.collapsed === true || 
                                             panelDiv.classList.contains('genie-row-panel-collapsed') ||
                                             (panel._normalState && panel._normalState.collapsed === true);
                    
                    panel.panels.forEach((childPanel) => {
                        const childDiv = childPanel._normalState?.panelDiv || childPanel._panelDiv;
                        
                        // CRITICAL: Clear genie flags during restoration to ensure proper behavior
                        // This ensures children are not skipped when parent is expanded
                        childPanel._genieShowIndependently = undefined;
                        childPanel._genieStandaloneY = undefined;
                        
                        // Check if genie check view is active
                        const genieCheckbox = document.getElementById(this.getInstanceId('toolbar-genie-checkbox'));
                        const isGenieActive = genieCheckbox && genieCheckbox.checked;
                        
                        // Check if this child panel is marked as priority standalone (rendered at top during genie check)
                        // Only respect this flag when genie check view is active
                        if (isGenieActive && childPanel._genieShowIndependently === true) {
                            // Priority standalone panel - always keep visible, ignore parent state (only in genie view)
                            if (childDiv && document.contains(childDiv)) {
                                childDiv.style.display = '';
                                childDiv.style.visibility = '';
                                childDiv.dataset.parentCollapsed = 'false';
                                childPanel._skipRender = false;
                                console.log(`[Genie] Priority standalone child panel "${childPanel.title || childPanel.id}" remains visible (ignoring parent "${panel.title || panel.id}" collapse state)`);
                            }
                        } else if (isParentCollapsed) {
                            // Parent is collapsed - hide child panel (it was rendered as standalone during genie check)
                            if (childDiv && document.contains(childDiv)) {
                                childDiv.style.display = 'none';
                                childDiv.style.visibility = 'hidden';
                                childDiv.dataset.parentCollapsed = 'true';
                            }
                            // CRITICAL: Do NOT set _skipRender = true here!
                            // When genie is unchecked, children should be shown when parent expands
                            // Setting _skipRender = true would prevent them from being shown
                            // Instead, just hide them visually - they'll be shown when parent expands
                            childPanel._skipRender = false; // Allow rendering/showing when parent expands
                            console.log(`[Genie] Hidden child panel "${childPanel.title || childPanel.id}" (parent "${panel.title || panel.id}" is collapsed), but _skipRender=false to allow showing when parent expands)`);
                            
                            // CRITICAL: Track if children have DOM elements for _childrenRendered flag
                            // If any child has a DOM element, _childrenRendered should be true
                            // This ensures toggleRowPanelCollapse knows children exist and need repositioning
                            if (childDiv && document.contains(childDiv)) {
                                if (panel._childrenRendered === undefined || panel._childrenRendered === false) {
                                    // At least one child has DOM element - mark as rendered
                                    // This will trigger the "already rendered" path in toggleRowPanelCollapse
                                    panel._childrenRendered = true;
                                }
                            }
                        } else {
                            // Parent is expanded - restore child panel normally
                            // CRITICAL: Re-establish parent-child relationship for children shown at top
                            childPanel._parentRowPanel = panel;
                            childPanel._genieShowIndependently = undefined; // Clear genie flag
                            
                            // CRITICAL: Ensure child panel state is correct for PositionCalculator
                            // PositionCalculator reads from panel.collapsed and panel._isCollapsed
                            if (childPanel._normalState && childPanel._normalState.collapsed !== undefined) {
                                childPanel.collapsed = childPanel._normalState.collapsed;
                                childPanel._isCollapsed = childPanel._normalState.collapsed;
                            }
                            
                            if (childDiv && document.contains(childDiv)) {
                                // Child DOM element exists - restore position using _normalState
                                // This handles children that were rendered at top during genie view
                                this.renderPanelFromState(childPanel, childDiv, true);
                                childDiv.dataset.parentCollapsed = 'false';
                                childPanel._skipRender = false;
                                
                                // Make sure child is visible
                                childDiv.style.display = '';
                                childDiv.style.visibility = '';
                            } else {
                                // Child DOM element doesn't exist - need to render it
                                // This happens when child was never rendered initially (parent collapsed)
                                console.log(`[Genie] Child panel "${childPanel.title || childPanel.id}" has no DOM element, will be rendered when parent expands`);
                                childPanel._skipRender = false; // Mark for rendering
                                // Note: Actual rendering will be triggered by toggleRowPanelCollapse or renderRowPanel
                            }
                        }
                    });
                }
            });
            
            // CRITICAL: Store expert panel positions BEFORE recalculation
            // Expert panels should maintain their positions during restore (they were loaded after genie check)
            const expertPanelPositions = new Map();
            this.panelOrder.normal.forEach(panelId => {
                const panel = this.panels[panelId];
                if (panel && panel._expertName && panel.gridPos) {
                    expertPanelPositions.set(panelId, {
                        y: panel.gridPos.y,
                        h: panel.gridPos.h,
                        panelDiv: panel._panelDiv || panel._normalState?.panelDiv
                    });
                }
            });
            
            // CRITICAL: Recalculate all Y positions globally after restore
            // This ensures panels stack correctly one after another without overlaps
            // Individual restore might have gaps or overlaps - global recalculation fixes this
            // Use PositionCalculator if available (calculates from scratch), otherwise use recalculateAllYPositions
            requestAnimationFrame(() => {
                if (typeof PositionCalculator !== 'undefined' && this.positionCalculator) {
                    // Use PositionCalculator to recalculate from scratch (uses JSON as source of truth)
                    const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
                    if (grid) {
                        this.positionCalculator.recalculateAndApply(
                            (panel, panelDiv, y, height, skipRecalculation) => {
                                // CRITICAL: Skip expert panels - they should maintain their positions
                                if (panel && panel._expertName) {
                                    const savedPos = expertPanelPositions.get(panel.id);
                                    if (savedPos) {
                                        // Restore expert panel to its saved position
                                        if (typeof this.setPanelPosition === 'function') {
                                            this.setPanelPosition(panel, savedPos.panelDiv || panelDiv, savedPos.y, savedPos.h, true);
                                        }
                                        return; // Skip recalculation for expert panels
                                    }
                                }
                                if (typeof this.setPanelPosition === 'function') {
                                    this.setPanelPosition(panel, panelDiv, y, height, skipRecalculation);
                                }
                            },
                            () => this.getControlsRowOffset(),
                            grid,
                            (panel, panelId, gridContainer, dataOnly, skipDataLoading) => {
                                return this.renderPanel(panel, panelId, gridContainer, dataOnly, skipDataLoading);
                            },
                            false // Don't preserve expansion state - use restored state
                        ).then(() => {
                            console.log('[Genie] PositionCalculator recalculated all positions after restore');
                            // CRITICAL: Restore expert panel positions after recalculation
                            // Expert panels should maintain their positions (they were loaded after genie check)
                            expertPanelPositions.forEach((pos, panelId) => {
                                const panel = this.panels[panelId];
                                if (panel && panel.gridPos && pos.panelDiv && document.contains(pos.panelDiv)) {
                                    // Restore expert panel position
                                    panel.gridPos.y = pos.y;
                                    panel.gridPos.h = pos.h;
                                    if (typeof this.setPanelPosition === 'function') {
                                        this.setPanelPosition(panel, pos.panelDiv, pos.y, pos.h, true);
                                    }
                                    console.log(`[Genie] Restored expert panel "${panel.title || panel.id}" to Y=${pos.y} (maintained position)`);
                                }
                            });
                        }).catch(error => {
                            console.error('[Genie] Error recalculating positions with PositionCalculator:', error);
                            // Fallback to recalculateAllYPositions
                            if (typeof this.recalculateAllYPositions === 'function') {
                                const panelCount = this.recalculateAllYPositions(false);
                                console.log(`[Genie] Fallback: Recalculated Y positions for ${panelCount} panels after restore`);
                            }
                        });
                    }
                } else if (typeof this.recalculateAllYPositions === 'function') {
                    const panelCount = this.recalculateAllYPositions(false);
                    console.log(`[Genie] Recalculated Y positions for ${panelCount} panels after restore to prevent overlaps`);
                }
            });
            
            console.log('[Genie] Simple restore complete - children shown at top removed, will be re-rendered fresh when parent expands');
        };

        /**
         * Clean up old _genieOriginal* properties for backward compatibility
         */
        target._cleanupOldGenieProperties = function () {
            // Clean up properties from all panels
            Object.values(this.panels).forEach(panel => {
                if (panel) {
                    panel._genieOriginalIndex = undefined;
                    panel._genieOriginalY = undefined;
                    panel._genieOriginalGridX = undefined;
                    panel._genieOriginalGridW = undefined;
                    panel._genieOriginalCollapsed = undefined;
                    panel._genieOriginalTitle = undefined;
                    panel._genieOriginalParentRowPanel = undefined;
                    panel._genieOriginalHeight = undefined;
                    panel._genieOriginalPanelDiv = undefined;
                    panel._genieShowIndependently = undefined;
                    panel._parentRowPanel = undefined;
                }
                
                // Also clean up child panels
                if (panel.type === 'row' && panel.panels && Array.isArray(panel.panels)) {
                    panel.panels.forEach(childPanel => {
                        if (childPanel) {
                            childPanel._genieOriginalIndex = undefined;
                            childPanel._genieOriginalY = undefined;
                            childPanel._genieOriginalGridX = undefined;
                            childPanel._genieOriginalGridW = undefined;
                            childPanel._genieOriginalCollapsed = undefined;
                            childPanel._genieOriginalTitle = undefined;
                            childPanel._genieOriginalParentRowPanel = undefined;
                            childPanel._genieOriginalHeight = undefined;
                            childPanel._genieOriginalPanelDiv = undefined;
                            childPanel._genieShowIndependently = undefined;
                            childPanel._parentRowPanel = undefined;
                        }
                    });
        }
            });
        };

    /**
         * Restore panels to their original order and positions
         * This restores the dashboard to its state before genie check was enabled
         */
        target.restoreOriginalPanelOrder = async function () {
        const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
        if (!grid) {
                console.warn('[Genie] Dashboard grid not found, cannot restore panel order');
            return;
        }

            // Restore panel order from stored original order
            if (!this._genieOriginalPanelOrder || !Array.isArray(this._genieOriginalPanelOrder)) {
                console.warn('[Genie] No original panel order stored, cannot restore exact order.');
                return;
        }

            // CRITICAL: Preserve expert panels in panelOrder.normal during restore
            // Expert panels (identified by _expertName) should NOT be removed during restore
            // They were loaded after genie check and should maintain their positions
            const expertPanelIds = [];
            this.panelOrder.normal.forEach(panelId => {
                const panel = this.panels[panelId];
                if (panel && panel._expertName) {
                    expertPanelIds.push(panelId);
                }
            });
            
            // Restore panelOrder.normal array order from stored original, then append expert panels
            this.panelOrder.normal = [...this._genieOriginalPanelOrder];
            // Append expert panels to preserve them (they should maintain their positions)
            expertPanelIds.forEach(panelId => {
                if (!this.panelOrder.normal.includes(panelId)) {
                    this.panelOrder.normal.push(panelId);
                }
            });
            console.log(`[Genie] Restored panel order from stored original: ${this._genieOriginalPanelOrder.length} original panels + ${expertPanelIds.length} expert panels = ${this.panelOrder.normal.length} total panels`);

            // SIMPLE RESTORE: Just restore everything to pre-genie state
            // Ignore everything that happened during genie check - just restore from _normalState
            await this._restoreFromNormalState();
            this._cleanupOldGenieProperties();
            
            // CRITICAL: Re-initialize PositionCalculator after restore
            // This ensures PositionCalculator uses the restored state (from _normalState)
            // and calculates positions correctly when parents are expanded
            if (typeof PositionCalculator !== 'undefined' && this.positionCalculator) {
                // Re-initialize PositionCalculator with restored panel state
                this.positionCalculator.reinitializeFromJSON();
                console.log('[Genie] PositionCalculator re-initialized after restore - will use restored state for position calculations');
            }
            
            return;

            // Collect all panels to restore (standalone + children) using stored panelDiv references
            const allPanelsToRestore = [];

            // First, collect standalone panels in stored order
            this._genieOriginalPanelOrder.forEach((panelId) => {
            const panel = this.panels[panelId];
            if (!panel) return;

                // Use stored panelDiv if available, otherwise fallback to _panelDiv
                const panelDiv = panel._genieOriginalPanelDiv || panel._panelDiv;
                if (panelDiv && document.contains(panelDiv)) {
                    allPanelsToRestore.push({panel, panelDiv});
                }

                // Collect child panels from row panels
                if (panel.type === 'row' && panel.panels && Array.isArray(panel.panels)) {
                    panel.panels.forEach((childPanel) => {
                        const childPanelDiv = childPanel._genieOriginalPanelDiv || childPanel._panelDiv;
                        if (childPanelDiv && document.contains(childPanelDiv)) {
                            allPanelsToRestore.push({panel: childPanel, panelDiv: childPanelDiv});
                        }
                            });
                        }
                    });

            // STEP 1: Restore original grid positions (X, W) and titles for all panels
            allPanelsToRestore.forEach(({panel, panelDiv}) => {
                if (!panelDiv || !panel || !panel.gridPos) return;
                    // Restore original grid column position and width from stored values
                    const isChildPanelForRestore = panel._parentRowPanel !== undefined;
                    if (!isChildPanelForRestore) {
                        const originalGridX = panel._genieOriginalGridX !== undefined ? panel._genieOriginalGridX : (panel.gridPos.x || 0);
                        const originalGridW = panel._genieOriginalGridW !== undefined ? panel._genieOriginalGridW : (panel.gridPos.w || 12);

                        panel.gridPos.x = originalGridX;
                        panel.gridPos.w = originalGridW;
                    } else {
                        // For child panels, restore gridPos but let recalculateAllYPositions handle grid column
                        const originalGridX = panel._genieOriginalGridX !== undefined ? panel._genieOriginalGridX : (panel.gridPos.x || 0);
                        const originalGridW = panel._genieOriginalGridW !== undefined ? panel._genieOriginalGridW : (panel.gridPos.w || 12);
                        panel.gridPos.x = originalGridX;
                        panel.gridPos.w = originalGridW;
                    }

                    // Restore original panel title
                    const titleEl = panelDiv.querySelector('.genie-dashboard-panel-title');
                    if (titleEl && panel._genieOriginalTitle !== undefined) {
                        const processedTitle = this.replacePlaceholdersInText(panel._genieOriginalTitle);
                        titleEl.textContent = processedTitle;
                        panel.title = processedTitle;
                    }
            });

            // STEP 2: Restore collapse states for ALL panels (row panels AND regular panels) using ONLY stored data
            // CRITICAL: Do NOT read from DOM - use only _genieOriginalCollapsed from stored state
            // This value was captured BEFORE genie check operations, so it represents the true original state
            // even if genie check collapsed/expanded panels during genie view
            allPanelsToRestore.forEach(({panel, panelDiv}) => {
                if (!panelDiv || !panel) return;
                    // Use ONLY stored original collapsed state - do NOT read from DOM
                    // This is the state BEFORE genie check, regardless of what genie did during genie view
                    const wasOriginallyCollapsed = panel._genieOriginalCollapsed === true;

                    // Restore collapse state directly from stored value
                    if (panel.type === 'row') {
                        // Row panel - restore collapse state directly
                        if (wasOriginallyCollapsed) {
                            panelDiv.classList.add('genie-row-panel-collapsed');
                            panel.collapsed = true;
                            const content = panelDiv.querySelector('.genie-dashboard-panel-content');
                            if (content) {
                                content.style.display = 'none';
                            }
                    } else {
                            panelDiv.classList.remove('genie-row-panel-collapsed');
                            panel.collapsed = false;
                            const content = panelDiv.querySelector('.genie-dashboard-panel-content');
                            if (content) {
                                content.style.display = 'flex';
                                content.style.visibility = 'visible';
            }
                        }
                    } else {
                        // Regular panel - restore collapse state directly
                        if (wasOriginallyCollapsed) {
                            panelDiv.classList.add('genie-panel-collapsed');
                            const content = panelDiv.querySelector('.genie-dashboard-panel-content');
                            if (content) {
                                content.style.display = 'none';
    }
                        } else {
                            panelDiv.classList.remove('genie-panel-collapsed');
                            const content = panelDiv.querySelector('.genie-dashboard-panel-content');
                            if (content) {
                                content.style.display = 'flex';
                                content.style.visibility = 'visible';
                            }
                        }
                    }
            });

            // STEP 6: Clear _parentRowPanel flag and _genieShowIndependently
            allPanelsToRestore.forEach(({panel}) => {
                if (panel) {
                    panel._genieShowIndependently = undefined;
                    panel._parentRowPanel = undefined;
            }
        });

            // Also clear _parentRowPanel for all child panels in row panels
            this.panelOrder.normal.forEach(panelId => {
            const panel = this.panels[panelId];
            if (!panel) return;

            if (panel.type === 'row' && panel.panels && Array.isArray(panel.panels)) {
                    panel.panels.forEach(childPanel => {
                        if (childPanel) {
                            childPanel._parentRowPanel = undefined;
                    }
                });
            }
        });

            // STEP 3: Restore Y positions directly from stored original values
            // Process panels in the EXACT order from stored original panel order
            this._genieOriginalPanelOrder.forEach((panelId) => {
                const panel = this.panels[panelId];
                if (!panel) return;

                // Use stored panelDiv
                const panelDiv = panel._genieOriginalPanelDiv || panel._panelDiv;
                if (!panelDiv || !panel.gridPos || !document.contains(panelDiv)) return;

                // Skip row panels for now - handle them separately
                if (panel.type === 'row') return;

                // Use ONLY stored original values - these were captured BEFORE genie operations
                // Do NOT read from current DOM or gridPos - they may have been modified by genie check
                const targetY = panel._genieOriginalY !== undefined ? panel._genieOriginalY : 0;
                const targetHeight = panel._genieOriginalHeight !== undefined ? panel._genieOriginalHeight : 8;
                // Use stored original collapsed state (captured before genie check)
                const wasOriginallyCollapsed = panel._genieOriginalCollapsed === true;
                const effectiveHeight = wasOriginallyCollapsed ? 1 : targetHeight;

                // Set position directly
                if (typeof this.setPanelPosition === 'function') {
                    this.setPanelPosition(panel, panelDiv, targetY, effectiveHeight, false);
                } else {
                    panel.gridPos.y = targetY;
                    panel.gridPos.h = effectiveHeight;
                    const gridRowValue = `${targetY + 2} / ${targetY + 2 + effectiveHeight}`;
                    panelDiv.style.gridRow = gridRowValue;
                    panelDiv.style.setProperty('grid-row', gridRowValue, 'important');
                }
            });

            // STEP 4: Restore row panels and their child panels using ONLY stored data
            this._genieOriginalPanelOrder.forEach((panelId) => {
                const rowPanel = this.panels[panelId];
                if (!rowPanel || rowPanel.type !== 'row') return;

                const rowPanelDiv = rowPanel._genieOriginalPanelDiv || rowPanel._panelDiv;
                if (!rowPanelDiv || !rowPanel.gridPos || !document.contains(rowPanelDiv)) return;

                    // Use ONLY stored original values - these were captured BEFORE genie operations
                    // Do NOT read from current DOM or gridPos - they may have been modified by genie check
                    const rowPanelY = rowPanel._genieOriginalY !== undefined ? rowPanel._genieOriginalY : 0;
                    const rowPanelHeight = rowPanel._genieOriginalHeight !== undefined ? rowPanel._genieOriginalHeight : 8;
                    // Use stored original collapsed state (captured before genie check)
                    const wasRowCollapsed = rowPanel._genieOriginalCollapsed === true;
                    const effectiveRowHeight = wasRowCollapsed ? 1 : rowPanelHeight;
                    
                    // Set row panel position
                    if (typeof this.setPanelPosition === 'function') {
                        this.setPanelPosition(rowPanel, rowPanelDiv, rowPanelY, effectiveRowHeight, false);
                                } else {
                        rowPanel.gridPos.y = rowPanelY;
                        rowPanel.gridPos.h = effectiveRowHeight;
                        const gridRowValue = `${rowPanelY + 2} / ${rowPanelY + 2 + effectiveRowHeight}`;
                        rowPanelDiv.style.gridRow = gridRowValue;
                        rowPanelDiv.style.setProperty('grid-row', gridRowValue, 'important');
                                }

                    // Restore child panels - ALWAYS restore, regardless of row panel collapse state
                    // Use stored original Y positions, not calculated ones
                    // This ensures child panels return to their exact original positions
                    if (rowPanel.panels && Array.isArray(rowPanel.panels)) {
                        rowPanel.panels.forEach((childPanel) => {
                            const childPanelDiv = childPanel._genieOriginalPanelDiv || childPanel._panelDiv;
                            if (!childPanelDiv || !childPanel || !childPanel.gridPos || !document.contains(childPanelDiv)) return;

                            // Use ONLY stored original values for child panel - captured BEFORE genie operations
                            // CRITICAL: Use stored _genieOriginalY, not calculated position
                            const childOriginalY = childPanel._genieOriginalY !== undefined ? childPanel._genieOriginalY : (rowPanelY + effectiveRowHeight);
                            const childHeight = childPanel._genieOriginalHeight !== undefined ? childPanel._genieOriginalHeight : 8;
                            // Use stored original collapsed state (captured before genie check)
                            const wasChildCollapsed = childPanel._genieOriginalCollapsed === true;
                            const effectiveChildHeight = wasChildCollapsed ? 1 : childHeight;

                            // Set child panel position using stored values
                            if (typeof this.setPanelPosition === 'function') {
                                this.setPanelPosition(childPanel, childPanelDiv, childOriginalY, effectiveChildHeight, false);
                            } else {
                                childPanel.gridPos.y = childOriginalY;
                                childPanel.gridPos.h = effectiveChildHeight;
                                const gridRowValue = `${childOriginalY + 2} / ${childOriginalY + 2 + effectiveChildHeight}`;
                                childPanelDiv.style.gridRow = gridRowValue;
                                childPanelDiv.style.setProperty('grid-row', gridRowValue, 'important');
                            }
                            
                            // Restore child panel grid column position and width from stored values
                            if (childPanel._genieOriginalGridX !== undefined && childPanel._genieOriginalGridW !== undefined) {
                                childPanel.gridPos.x = childPanel._genieOriginalGridX;
                                childPanel.gridPos.w = childPanel._genieOriginalGridW;
                                const gridColumnValue = `${childPanel._genieOriginalGridX + 1} / ${childPanel._genieOriginalGridX + childPanel._genieOriginalGridW + 1}`;
                                childPanelDiv.style.gridColumn = gridColumnValue;
                                childPanelDiv.style.setProperty('grid-column', gridColumnValue, 'important');
                            }
                            
                            // Restore child panel collapse state (if it was collapsed independently)
                            const wasChildOriginallyCollapsed = childPanel._genieOriginalCollapsed === true;
                            if (wasChildOriginallyCollapsed) {
                                childPanelDiv.classList.add('genie-panel-collapsed');
                                const content = childPanelDiv.querySelector('.genie-dashboard-panel-content');
                                if (content) {
                                    content.style.display = 'none';
                                }
                            } else {
                                childPanelDiv.classList.remove('genie-panel-collapsed');
                                const content = childPanelDiv.querySelector('.genie-dashboard-panel-content');
                                if (content) {
                                    content.style.display = 'flex';
                                    content.style.visibility = 'visible';
                }
            }
        });
                    }
            });

            // STEP 5: Ensure grid column is restored for ALL panels (standalone, row panels, and child panels)
            allPanelsToRestore.forEach(({panel, panelDiv}) => {
                if (!panelDiv || !panel || !panel.gridPos) return;
                
                const isRowPanel = panel.type === 'row';
                const isChildPanel = panel._genieOriginalParentRowPanel !== undefined;
                
                // Restore grid column for standalone panels and row panels
                // Child panels are handled in STEP 4
                if (!isChildPanel) {
                    const originalGridX = panel._genieOriginalGridX !== undefined ? panel._genieOriginalGridX : (panel.gridPos.x || 0);
                    const originalGridW = panel._genieOriginalGridW !== undefined ? panel._genieOriginalGridW : (panel.gridPos.w || 12);

                    panel.gridPos.x = originalGridX;
                    panel.gridPos.w = originalGridW;

                    const gridColumnValue = `${originalGridX + 1} / ${originalGridX + originalGridW + 1}`;
                    panelDiv.style.gridColumn = gridColumnValue;
                    panelDiv.style.setProperty('grid-column', gridColumnValue, 'important');
            }
        });

            // Ensure controls row stays in place
        this.ensureControlsRowPosition();

            // STEP 7: Clear ALL genie view state after restore
        const clearAllGenieState = (panel) => {
            if (panel) {
                panel._genieOriginalIndex = undefined;
                panel._genieOriginalY = undefined;
                panel._genieOriginalGridX = undefined;
                panel._genieOriginalGridW = undefined;
                panel._genieOriginalCollapsed = undefined;
                panel._genieOriginalTitle = undefined;
                    panel._genieOriginalParentRowPanel = undefined;
                    panel._genieOriginalHeight = undefined;
                    panel._genieOriginalPanelDiv = undefined;
                    panel._genieShowIndependently = undefined;
                }
            };

            // Clear stored original panel order after restore
            this._genieOriginalPanelOrder = undefined;

            allPanelsToRestore.forEach(({panel}) => {
                clearAllGenieState(panel);
            });

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

            // NOTE: PositionCalculator re-initialization moved to before return statement (line 1583)
            // This ensures it runs after _restoreFromNormalState() completes
        };

        /**
         * Calculate genie percentage change for all panels
         * Supports both backend and UI-based processing
         */
        target.calculateGeniePercentageChange = async function () {
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

                    // Show progress message before calling backend
                    const totalPanels = (panelsData.panels?.length || 0) + (panelsData.noncomparepanels?.length || 0);
                    if (typeof this.showAnomalyProgressMessage === 'function') {
                        this.showAnomalyProgressMessage(`Analyzing ${totalPanels} panel${totalPanels !== 1 ? 's' : ''} for anomalies...`);
                    }

                    // Call backend
                    const backendResponse = await this.callBackendForAnomalyDetection(panelsData);

                    // Process backend response
                    this.processBackendAnomalyResponse(backendResponse);

                    console.log(`[Genie] Backend processing completed for ${panelsData.length} panels`);

                    // Hide progress message on success
                    if (typeof this.hideAnomalyProgressMessage === 'function') {
                        this.hideAnomalyProgressMessage();
                    }

                    /*// After backend processing, sort panels and apply collapse/expand based on threshold
                    // Get threshold value from input (for collapse/expand of anomaly scores)
                    const thresholdInput = document.getElementById(this.getInstanceId('toolbar-genie-threshold'));
                    const threshold = thresholdInput ? parseFloat(thresholdInput.value) || 0.3 : 0.3;
                    console.log(`[Genie] Calling sortAndReorderPanelsByChange with threshold=${threshold} after backend processing`);
                    this.sortAndReorderPanelsByChange(threshold);*/

                    return;
                } catch (error) {
                    console.error(`[Genie] Backend processing failed, falling back to UI processing:`, error);
                    // Hide progress message on error
                    if (typeof this.hideAnomalyProgressMessage === 'function') {
                        this.hideAnomalyProgressMessage();
                    }
                    // Fall through to UI processing as fallback
                }
            }

            // UI-based processing (original implementation)
            // Collect all panels to process (standalone + children from row panels)
            // IMPORTANT: Process ALL child panels regardless of parent collapse state
            const allPanelsToProcess = [];

            // Add standalone panels
            this.panelOrder.normal.forEach((panelId, panelIndex) => {
                const panel = this.panels[panelId];
                if (!panel) return;

                if (panel.type !== 'row') {
                    allPanelsToProcess.push({panel, panelIndex});
                } else {
                    // Add child panels from row panels
                    // Process ALL child panels regardless of whether parent is collapsed or expanded
                    // IMPORTANT: Use consistent ID format: row-{parentPanelId}-child-{childIndex}
                    // Use panelId (e.g., "p9") instead of numeric index (e.g., 9)
                    if (panel.panels && Array.isArray(panel.panels)) {
                        console.log(`[Genie] Processing ${panel.panels.length} child panels from row panel "${panel.title || panel.id}" (parent collapsed: ${panel.collapsed === true})`);
                        panel.panels.forEach((childPanel, childIndex) => {
                            // Ensure child panel has parent reference
                            if (!childPanel._parentRowPanel) {
                                childPanel._parentRowPanel = panel;
                            }
                            // Use consistent child panel ID format with actual panel ID
                            const childPanelIndex = `row-${panelId}-child-${childIndex}`;
                            allPanelsToProcess.push({
                                panel: childPanel,
                                panelIndex: childPanelIndex
                            });
                            console.log(`[Genie] Added child panel "${childPanel.title || childPanel.id}" to processing list with ID format: ${childPanelIndex}`);
                        });
                    }
                }
            });

            console.log(`[Genie] calculateGeniePercentageChange: Collected ${allPanelsToProcess.length} panels to process (standalone + children)`);

            // Process all panels (standalone + children)
            let processedCount = 0;
            let skippedCount = 0;
            const skippedReasons = {wrongType: 0, alreadyCalculated: 0, noData: 0};

            allPanelsToProcess.forEach(({panel, panelIndex}) => {
                const isChildPanel = panel._parentRowPanel !== undefined;
                const panelTitle = panel.title || panel.id || panelIndex;
                
                // Process timeseries panels, or graph panels when bars or lines is true
                const isTimeseries = panel.type === 'timeseries';
                const isGraphWithBarsOrLines = panel.type === 'graph' &&
                    (panel.bars === true || panel.lines === true ||
                        panel.options?.bars === true || panel.options?.lines === true);

                if (!isTimeseries && !isGraphWithBarsOrLines) {
                    skippedCount++;
                    skippedReasons.wrongType++;
                    if (isChildPanel) {
                        console.log(`[Genie] Skipped child panel "${panelTitle}" (not timeseries/graph with bars/lines, type: ${panel.type})`);
                    }
                    return;
                }

                // Check if calculation already done (avoid duplicate calculations)
                if (panel._genieChangeCalculated) {
                    skippedCount++;
                    skippedReasons.alreadyCalculated++;
                    if (isChildPanel) {
                        console.log(`[Genie] Skipped child panel "${panelTitle}" (already calculated)`);
                    }
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
                        skippedCount++;
                        skippedReasons.noData++;
                        if (isChildPanel) {
                            console.log(`[Genie] Skipped child panel "${panelTitle}" (no current data available)`);
                        } else {
                            console.log(`[Genie] Panel ${panelIndex}: No current data available`);
                        }
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
                processedCount++;
                
                const changeCount = panel.change && Object.keys(panel.change).length > 0 
                    ? Object.keys(panel.change).filter(k => !k.endsWith('_byDuration') && !k.endsWith('_maxAbsChangeDuration')).length 
                    : 0;
                if (isChildPanel) {
                    console.log(`[Genie] ✓ Processed child panel "${panelTitle}": ${changeCount} change entries calculated`);
                }
            });

            // Log summary
            console.log(`[Genie] calculateGeniePercentageChange summary: ${processedCount} panels processed, ${skippedCount} skipped`);
            console.log(`[Genie]   Skipped reasons: wrongType=${skippedReasons.wrongType}, alreadyCalculated=${skippedReasons.alreadyCalculated}, noData=${skippedReasons.noData}`);

            // After all calculations, sort panels and reorder dashboard
            // Get threshold value from input
            const thresholdInput = document.getElementById(this.getInstanceId('toolbar-genie-threshold'));
            const threshold = thresholdInput ? parseFloat(thresholdInput.value) || 1 : 1;
            this.sortAndReorderPanelsByChange(threshold);
        };

        /**
         * Generate title HTML with incidents, anomaly, and change information
         * @param {Object} panel - Panel object
         * @returns {string} - HTML string for the title
         */
        target.generateGeniePanelTitle = function (panel) {
            if (!panel) return '';

            // Get original title and process placeholders
            const rawOriginalTitle = panel._genieOriginalTitle || panel.title || '';
            const originalTitle = this.replacePlaceholdersInText(rawOriginalTitle);

            // Check for incidents and anomaly score
            const incidentCount = panel._incidentCount;
            const hasIncidents = incidentCount !== undefined && incidentCount !== null && incidentCount > 0;
            const anomalyScore = panel._anomalyScore;
            const hasAnomalyScore = anomalyScore !== undefined && anomalyScore !== null &&
                !isNaN(anomalyScore) && isFinite(anomalyScore);

            const collapseThreshold = this.inputConfig?.genieAnomalyCollapseThreshold ||
                this.inputConfig?.genieAnomalyColorThreshold ||
                0.3;

            // Handle panels with change data
            if (panel.change && Object.keys(panel.change).length > 0) {
                const changeEntries = [];

                // Collect all change entries with their absolute values for sorting
                Object.entries(panel.change).forEach(([seriesName, changeValue]) => {
                    // Skip metadata keys
                    if (seriesName.endsWith('_byDuration') || seriesName.endsWith('_maxAbsChangeDuration')) {
                        return;
                    }

                    if (changeValue !== null && changeValue !== undefined && !isNaN(changeValue) && isFinite(changeValue)) {
                        // Get text after last colon character
                        const lastColonIndex = seriesName.lastIndexOf(':');
                        let seriesNameShort = lastColonIndex >= 0 ? seriesName.substring(lastColonIndex + 1) : seriesName;

                        // Truncate if more than 50 characters
                        if (seriesNameShort.length > 50) {
                            seriesNameShort = '...' + seriesNameShort.substring(seriesNameShort.length - 50);
                        }

                        changeEntries.push({
                            seriesName: seriesNameShort,
                            changeValue: changeValue,
                            absValue: Math.abs(changeValue)
                        });
                    }
                });

                // Sort by absolute value in descending order
                changeEntries.sort((a, b) => b.absValue - a.absValue);

                // Build formatted change parts
                const changeParts = changeEntries.map(entry => {
                    const formattedChange = entry.changeValue.toFixed(2) + '%';
                    return `${entry.seriesName}: ${formattedChange}`;
                });

                // Build title parts
                const titleParts = [];
                const bracketParts = [];

                if (hasIncidents) {
                    bracketParts.push(`incidents:${incidentCount}`);
                }
                if (hasAnomalyScore) {
                    bracketParts.push(`anomaly:${anomalyScore.toFixed(2)}`);
                }

                if (bracketParts.length > 0) {
                    let color = '#f59e0b'; // Default orange
                    if (hasAnomalyScore) {
                        color = anomalyScore >= collapseThreshold ? '#ef4444' : '#f59e0b';
                    }
                    titleParts.push(`<span class="genie-time-range-display" style="color: ${color}; font-weight: bold;">[${bracketParts.join(', ')}]</span>`);
                }

                if (changeParts.length > 0) {
                    titleParts.push(`<span class="genie-time-range-display">(${changeParts.join(', ')})</span>`);
                }

                if (titleParts.length > 0) {
                    return `${originalTitle} ${titleParts.join(' ')}`;
                } else {
                    return originalTitle;
                }
            }

            // Handle non-comparable panels
            if (panel._genieNonComparable) {
                let percentKpodsAboveThreshold = 0;
                let groupingKeyDisplay = '';
                let averageAboveThreshold = 0;

                if (panel._kpodGroups && panel._anomalyScores) {
                    const groups = panel._kpodGroups;
                    let totalKpods = 0;
                    let kpodsAboveThreshold = 0;
                    const scoresAboveThreshold = [];
                    const groupingKeys = Object.keys(groups);

                    Object.keys(groups).forEach(groupingKey => {
                        const kpodsInGroup = groups[groupingKey] || [];
                        kpodsInGroup.forEach(kpodName => {
                            totalKpods++;
                            const score = panel._anomalyScores[kpodName];
                            if (score !== null && score !== undefined && !isNaN(score) && isFinite(score) && score >= collapseThreshold) {
                                kpodsAboveThreshold++;
                                scoresAboveThreshold.push(score);
                            }
                        });
                    });

                    percentKpodsAboveThreshold = totalKpods > 0 ? (kpodsAboveThreshold / totalKpods) * 100 : 0;

                    if (scoresAboveThreshold.length > 0) {
                        averageAboveThreshold = scoresAboveThreshold.reduce((sum, score) => sum + score, 0) / scoresAboveThreshold.length;
                    }

                    if (groupingKeys.length > 0) {
                        if (groupingKeys.length <= 3) {
                            groupingKeyDisplay = groupingKeys.join(', ');
                        } else {
                            groupingKeyDisplay = groupingKeys[0] + ` (+${groupingKeys.length - 1} more)`;
                        }
                    }
                } else if (panel._anomalyScores) {
                    const kpodScores = Object.values(panel._anomalyScores);
                    const totalKpods = kpodScores.length;
                    const scoresAboveThreshold = kpodScores.filter(score =>
                        score !== null && score !== undefined && !isNaN(score) && isFinite(score) && score >= collapseThreshold
                    );
                    const kpodsAboveThreshold = scoresAboveThreshold.length;
                    percentKpodsAboveThreshold = totalKpods > 0 ? (kpodsAboveThreshold / totalKpods) * 100 : 0;

                    if (scoresAboveThreshold.length > 0) {
                        averageAboveThreshold = scoresAboveThreshold.reduce((sum, score) => sum + score, 0) / scoresAboveThreshold.length;
                    }
                }

                const titleParts = [];

                if (hasIncidents) {
                    titleParts.push(`<span class="genie-time-range-display" style="color: #f59e0b; font-weight: bold;">[Incidents ${incidentCount}]</span>`);
                }

                if (averageAboveThreshold > 0) {
                    titleParts.push(`<span class="genie-time-range-display" style="color: #ef4444; font-weight: bold;">[Anomaly ${averageAboveThreshold.toFixed(2)}]</span>`);
                }

                if (groupingKeyDisplay || percentKpodsAboveThreshold > 0) {
                    const percentStr = percentKpodsAboveThreshold.toFixed(1) + '%';
                    let bracketContent = percentStr;
                    if (groupingKeyDisplay) {
                        bracketContent += ` ${groupingKeyDisplay}`;
                    }
                    bracketContent += ` > ${collapseThreshold}`;
                    titleParts.push(`<span class="genie-time-range-display">[${bracketContent}]</span>`);
                }

                if (titleParts.length > 0) {
                    return `${originalTitle} ${titleParts.join(' ')}`;
                } else {
                    return originalTitle;
                }
            }

            // Handle panels with only incidents/anomaly (no change data)
            if (hasIncidents || hasAnomalyScore) {
                const bracketParts = [];

                if (hasIncidents) {
                    bracketParts.push(`incidents:${incidentCount}`);
                }
                if (hasAnomalyScore) {
                    bracketParts.push(`anomaly:${anomalyScore.toFixed(2)}`);
                }

                let color = '#f59e0b';
                if (hasAnomalyScore) {
                    color = anomalyScore >= collapseThreshold ? '#ef4444' : '#f59e0b';
                }
                return `${originalTitle} <span class="genie-time-range-display" style="color: ${color}; font-weight: bold;">[${bracketParts.join(', ')}]</span>`;
            }

            // No change data, incidents, or anomaly - return original title
            return originalTitle;
        };

        /**
         * Modular function to collapse or expand a panel in genie view
         * Updates DOM and _genieStateMap only, does NOT modify panel._isCollapsed or panel.collapsed
         * @param {Object} panel - Panel object
         * @param {HTMLElement} panelDiv - Panel DOM element
         * @param {boolean} shouldCollapse - Whether to collapse (true) or expand (false)
         * @param {string} panelId - Panel identifier for _genieStateMap
         * @param {boolean} isChildPanel - Whether this is a child panel
         * @param {number} sortedIndex - Optional sorted index for _genieStateMap
         * @returns {boolean} - True if state was changed, false otherwise
         */
        target.updatePanelCollapseStateInGenieView = function (panel, panelDiv, shouldCollapse, panelId, isChildPanel = false, sortedIndex = undefined) {
            const content = panel._contentElement || panelDiv.querySelector('.genie-dashboard-panel-content');
            const collapseButton = panel._collapseButton || panelDiv.querySelector('.genie-dashboard-panel-collapse-btn');

            if (!content || !collapseButton) {
                console.warn(`[Genie] Cannot ${shouldCollapse ? 'collapse' : 'expand'} panel: content or collapseButton not found`);
                return false;
            }

            // Check current state from DOM or _genieStateMap
            const genieState = this._genieStateMap[panelId];
            const isCurrentlyCollapsed = genieState ? genieState.isCollapsed : panelDiv.classList.contains('genie-panel-collapsed');

            // If state is already correct, no need to update
            if (shouldCollapse === isCurrentlyCollapsed) {
                return false;
            }

            if (shouldCollapse) {
                // Collapse the panel - update DOM and _genieStateMap only
                // Store original dimensions if not already stored
                if (panel._originalDimensions === undefined) {
                    const computedStyle = window.getComputedStyle(panelDiv);
                    panel._originalDimensions = {
                        height: computedStyle.height,
                        gridRow: panelDiv.style.gridRow || computedStyle.gridRow,
                        minHeight: computedStyle.minHeight,
                        maxHeight: computedStyle.maxHeight
                    };
                    const contentComputed = window.getComputedStyle(content);
                    panel._originalContentDimensions = {
                        height: contentComputed.height,
                        minHeight: contentComputed.minHeight,
                        maxHeight: contentComputed.maxHeight,
                        padding: contentComputed.padding,
                        margin: contentComputed.margin
                    };
                }

                // Update DOM
                panelDiv.classList.add('genie-panel-collapsed');
                content.style.display = 'none';
                panelDiv.style.height = 'auto';
                panelDiv.style.minHeight = '0';
                collapseButton.innerHTML = '<i class="fa fa-chevron-down" style="font-size: 10px; font-weight: 300;"></i>';
                collapseButton.title = 'Expand panel';
                // DO NOT modify: panel._isCollapsed = true; // Keep original state untouched

                // Update _genieStateMap
                if (!this._genieStateMap[panelId]) {
                    const isParentRowPanel = panel.type === 'row' && panel.panels && Array.isArray(panel.panels) && panel.panels.length > 0;
                    this._genieStateMap[panelId] = {
                        sortedIndex: sortedIndex,
                        isCollapsed: true,
                        y: undefined,
                        gridX: 0,
                        gridW: 12,
                        isChildPanel: isChildPanel,
                        isParentRowPanel: isParentRowPanel,
                        title: panel.title || panel.id || '',

                    };
                } else {
                    this._genieStateMap[panelId].isCollapsed = true;
                    if (sortedIndex !== undefined) {
                        this._genieStateMap[panelId].sortedIndex = sortedIndex;
                    }
                    // Update isParentRowPanel if not already set
                    if (this._genieStateMap[panelId].isParentRowPanel === undefined) {
                        this._genieStateMap[panelId].isParentRowPanel = panel.type === 'row' && panel.panels && Array.isArray(panel.panels) && panel.panels.length > 0;
                    }

                    // Update title if not already set or if panel title changed
                    if (!this._genieStateMap[panelId].title || (panel.title && this._genieStateMap[panelId].title !== panel.title)) {
                        this._genieStateMap[panelId].title = panel.title || panel.id || '';
                    }

                }
            } else {
                // Expand the panel - update DOM and _genieStateMap only
                panelDiv.classList.remove('genie-panel-collapsed');

                // Restore panel height constraints
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
                    if (panel._originalDimensions.maxHeight && panel._originalDimensions.maxHeight !== 'none') {
                        panelDiv.style.maxHeight = panel._originalDimensions.maxHeight;
                    } else {
                        panelDiv.style.removeProperty('max-height');
                    }
                } else {
                    panelDiv.style.removeProperty('height');
                    panelDiv.style.removeProperty('min-height');
                    panelDiv.style.removeProperty('max-height');
                }

                // Restore content display
                if (panel._originalContentDimensions) {
                    content.style.setProperty('display', 'flex', 'important');
                    content.style.setProperty('visibility', 'visible', 'important');
                    if (panel._originalContentDimensions.height && panel._originalContentDimensions.height !== '0px') {
                        content.style.height = panel._originalContentDimensions.height;
                    } else {
                        content.style.removeProperty('height');
                    }
                    if (panel._originalContentDimensions.minHeight) {
                        content.style.minHeight = panel._originalContentDimensions.minHeight;
                    } else {
                        content.style.removeProperty('min-height');
                    }
                } else {
                    content.style.setProperty('display', 'flex', 'important');
                    content.style.setProperty('visibility', 'visible', 'important');
                    content.style.removeProperty('height');
                    content.style.removeProperty('min-height');
                }

                collapseButton.innerHTML = '<i class="fa fa-chevron-right" style="font-size: 10px; font-weight: 300;"></i>';
                collapseButton.title = 'Collapse panel';
                // DO NOT modify: panel._isCollapsed = false; // Keep original state untouched

                // Update _genieStateMap
                if (!this._genieStateMap[panelId]) {
                    const isParentRowPanel = panel.type === 'row' && panel.panels && Array.isArray(panel.panels) && panel.panels.length > 0;
                    this._genieStateMap[panelId] = {
                        sortedIndex: sortedIndex,
                        isCollapsed: false,
                        y: undefined,
                        gridX: 0,
                        gridW: 12,
                        title: panel.title || panel.id || '',

                        isChildPanel: isChildPanel,
                        isParentRowPanel: isParentRowPanel,
                    };

                } else {
                    // Update isParentRowPanel if not already set
                    this._genieStateMap[panelId].isCollapsed = false;
                    if (sortedIndex !== undefined) {

                        this._genieStateMap[panelId].sortedIndex = sortedIndex;
                    }

                    if (this._genieStateMap[panelId].isParentRowPanel === undefined) {
                        this._genieStateMap[panelId].isParentRowPanel = panel.type === 'row' && panel.panels && Array.isArray(panel.panels) && panel.panels.length > 0;
                    }
                    // Update title if not already set or if panel title changed
                    if (!this._genieStateMap[panelId].title || (panel.title && this._genieStateMap[panelId].title !== panel.title)) {
                        this._genieStateMap[panelId].title = panel.title || panel.id || '';
                    }

                }

            }
            return true;
        }

        /**
         * Apply genie view by rendering panels in the order provided
         * No sorting or calculations - just renders panelsMetThresholdList first (expanded), then remainingPanelsList (collapsed)
         * @param {Array} panelsMetThresholdList - Panels that meet the threshold (to be expanded, already sorted)
         * @param {Array} remainingPanelsList - Remaining panels (to be collapsed except parents/stat, already sorted)
         */
        target.applyGenieView = async function (panelsMetThresholdList, remainingPanelsList) {
            if (!panelsMetThresholdList || !remainingPanelsList) {
                console.error('[Genie] applyGenieView requires both panelsMetThresholdList and remainingPanelsList');
                return;
            }

            const renderStartTime = performance.now();
            console.log(`[Genie Performance] Starting render (applyGenieView) at ${new Date().toISOString()}`);
            
            // Get grid to find all panels
            const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
            if (!grid) {
                console.warn('[Genie] Dashboard grid not found, cannot render panels');
                return;
            }

            // Get panels from DOM for matching
            const allPanelDivs = Array.from(grid.querySelectorAll('.genie-dashboard-panel'))
                .filter(div => !div.classList.contains('genie-dashboard-controls-row') && !div.hasAttribute('data-controls-row'));

            // Track used divs to avoid duplicates
            const usedDivs = new Set();

            // Helper function to find panel div for a panel object
            // Handles both standalone panels (numeric index) and child panels (string index like "row-9-child-0")
            const findPanelDiv = (panel, index) => {
                let panelDiv = null;

                // Method 1: Try by _panelDiv reference first (most reliable)
                if (panel._panelDiv && document.contains(panel._panelDiv)) {
                    panelDiv = panel._panelDiv;
                }

                // Method 2: Try by expected ID (handles both numeric and string indices)
                if (!panelDiv && index !== undefined && index !== null) {
                    // For child panels, index is a string like "row-9-child-0"
                    // For standalone panels, index is a number
                    const expectedId = this.getInstanceId(`panel-${index}`);
                    panelDiv = document.getElementById(expectedId);
                }

                // Method 3: Try by panel title
                if (!panelDiv && panel.title) {
                    allPanelDivs.forEach(div => {
                        if (usedDivs.has(div)) return;
                        const titleEl = div.querySelector('.genie-dashboard-panel-title');
                        if (titleEl && titleEl.textContent.trim() === panel.title.trim()) {
                            panelDiv = div;
                        }
                    });
                }

                // Method 4: For child panels, try by matching panel object reference
                if (!panelDiv && panel._parentRowPanel) {
                    allPanelDivs.forEach(div => {
                        if (usedDivs.has(div)) return;
                        if (div._panelObject === panel) {
                            panelDiv = div;
                        }
                    });
                }

                if (panelDiv) {
                    usedDivs.add(panelDiv);
                }

                return panelDiv; // Can be null if panel is not in DOM
            };

            // Ensure _genieStateMap is initialized
            if (!this._genieStateMap) {
                this._genieStateMap = {};
            }

            // Add DOM divs to panels if not already present
            const panelsMetThresholdListWithDivs = panelsMetThresholdList.map((item) => {
                let panelDiv = item.div;
                if (!panelDiv) {
                    panelDiv = findPanelDiv(item.panel, item.index);
                }
                
                // If panel div is found but hidden (from previous restore), restore visibility
                // These are priority panels that meet threshold, so they should be visible
                if (panelDiv && (panelDiv.style.display === 'none' || panelDiv.style.visibility === 'hidden')) {
                    panelDiv.style.display = '';
                    panelDiv.style.visibility = '';
                    panelDiv.dataset.parentCollapsed = 'false';
                    if (item.panel) {
                        item.panel._skipRender = false;
                    }
                    console.log(`[Genie] Restored visibility for priority panel "${item.panel?.title || item.panel?.id}" (was hidden)`);
                }
                
                return {
                    ...item,
                    div: panelDiv,
                    isChildPanel: item.isChild || false
                };
            });

            const remainingPanelsListWithDivs = remainingPanelsList.map((item) => {
                if (item.div) {
                    return item; // Already has div
                }
                const panelDiv = findPanelDiv(item.panel, item.index);
                return {
                    ...item,
                    div: panelDiv,
                    isChildPanel: item.isChild || false
                };
            });

            // IMPORTANT: Set _genieShowIndependently flag for ALL child panels in panelsMetThresholdList
            // This must be done BEFORE rendering, so the flag is set for both:
            // 1. Panels that already have divs (when parent is expanded)
            // 2. Panels that need to be rendered (when parent is collapsed)
            panelsMetThresholdListWithDivs.forEach((item) => {
                const panel = item.panel;
                const isChildPanel = item.isChildPanel;
                
                if (panel && isChildPanel && (panel._parentRowPanel || item.parentRowPanel)) {
                    panel._genieShowIndependently = true;
                    // Store the standalone Y position if not already stored
                    if (panel.gridPos && panel.gridPos.y !== undefined && panel._genieStandaloneY === undefined) {
                        panel._genieStandaloneY = panel.gridPos.y;
                    }
                    console.log(`[Genie] Set _genieShowIndependently=true for child panel "${panel.title || panel.id}" in panelsMetThresholdList (before rendering)`);
                }
            });

            // Render priority panels (panels that meet threshold) if they don't have divs yet
            // Render them as new standalone panels in the grid (not as child panels)
            const panelsToRender = [];
            panelsMetThresholdListWithDivs.forEach((item, listIndex) => {
                if (!item.div && item.panel) {
                    panelsToRender.push({...item, listIndex}); // Include list index for positioning
                }
            });

            if (panelsToRender.length > 0) {
                console.log(`[Genie] Rendering ${panelsToRender.length} priority panels as new standalone panels in their correct positions`);
                
                // Render panels sequentially to maintain order and calculate positions correctly
                let renderY = 0; // Track Y position for newly rendered panels
                
                for (const item of panelsToRender) {
                    try {
                        const panel = item.panel;
                        // Use consistent ID format: for child panels, item.index is already in format "row-{parentIndex}-child-{childIndex}"
                        // For standalone panels, item.index is a number
                        const panelId = item.isChild ? `panel-${item.index}` : (panel.id || `panel-${item.index}`);
                        const listIndex = item.listIndex;
                        
                        // CRITICAL: Populate _normalState from JSON BEFORE rendering
                        // This ensures children rendered at top have correct original positions stored
                        // Children that were never rendered don't have _normalState yet
                        if (!panel._normalState || !panel._normalState.panelDiv) {
                            if (!panel._normalState) {
                                panel._normalState = {};
                            }
                            
                            // Get original position from JSON (gridPos) - this is the source of truth
                            const gridPos = panel.gridPos || { x: 0, y: 0, w: 12, h: 8 };
                            
                            // UNIFIED ALGORITHM: Store original Y from JSON (not from DOM - DOM doesn't exist yet)
                            // This is the source of truth - never overwrite if already set correctly
                            if (panel._normalState.y === undefined) {
                                // Priority: originalY (preserved) > y (from JSON)
                                panel._normalState.y = gridPos.originalY !== undefined ? gridPos.originalY : 
                                                       (gridPos.y !== undefined ? gridPos.y : 0);
                                console.log(`[Genie] Populated _normalState.y=${panel._normalState.y} for "${panel.title || panel.id}" from JSON (originalY=${gridPos.originalY}, y=${gridPos.y})`);
                            } else if (panel._normalState.y < 20 && gridPos.originalY !== undefined && gridPos.originalY >= 20) {
                                // _normalState.y seems corrupted (top position), but we have originalY from JSON - use it
                                panel._normalState.y = gridPos.originalY;
                                console.log(`[Genie] Corrected _normalState.y=${panel._normalState.y} for "${panel.title || panel.id}" from gridPos.originalY (was corrupted)`);
                            } else if (panel._normalState.y < 20 && gridPos.y !== undefined && gridPos.y >= 20) {
                                // _normalState.y seems corrupted, but we have y from JSON - use it
                                panel._normalState.y = gridPos.y;
                                console.log(`[Genie] Corrected _normalState.y=${panel._normalState.y} for "${panel.title || panel.id}" from gridPos.y (was corrupted)`);
                            }
                            
                            // Store original X/W from JSON
                            if (panel._normalState.x === undefined) {
                                panel._normalState.x = gridPos.originalX !== undefined ? gridPos.originalX : gridPos.x;
                            }
                            if (panel._normalState.w === undefined) {
                                panel._normalState.w = gridPos.originalW !== undefined ? gridPos.originalW : gridPos.w;
                            }
                            if (panel._normalState.h === undefined) {
                                panel._normalState.h = gridPos.originalH !== undefined ? gridPos.originalH : gridPos.h;
                            }
                            if (panel._normalState.collapsed === undefined) {
                                panel._normalState.collapsed = panel.collapsed === true || panel._isCollapsed === true;
                            }
                            
                            console.log(`[Genie] Populated _normalState for "${panel.title || panel.id}" from JSON: y=${panel._normalState.y}, x=${panel._normalState.x}, w=${panel._normalState.w}, h=${panel._normalState.h}`);
                        }
                        
                        // For child panels, render them as standalone panels (not inside parent)
                        // Temporarily remove parent relationship for rendering
                        const isChildPanel = item.isChild || panel._parentRowPanel || item.parentRowPanel;
                        // CRITICAL: Preserve _genieOriginalParentRowPanel BEFORE temporarily clearing it
                        // Use multiple fallbacks to ensure we always have the correct parent reference
                        const originalParentRowPanel = item.parentRowPanel || 
                                                       panel._parentRowPanel || 
                                                       panel._genieOriginalParentRowPanel ||
                                                       (item.isChild && item.panel?._genieOriginalParentRowPanel);
                        // Store the original _genieOriginalParentRowPanel value BEFORE clearing it
                        const originalGenieOriginalParentRowPanel = panel._genieOriginalParentRowPanel || originalParentRowPanel;
                        let originalSkipRender = panel._skipRender;
                        
                        if (isChildPanel && originalParentRowPanel) {
                            // Temporarily remove parent relationship so panel renders as standalone
                            panel._parentRowPanel = null;
                            // CRITICAL: Store _genieOriginalParentRowPanel in a temporary variable before clearing
                            // We'll restore it after rendering
                            panel._genieOriginalParentRowPanel = null;
                            panel._skipRender = false;
                            console.log(`[Genie] Temporarily cleared parent relationship for child "${panel.title || panel.id}" (originalParentRowPanel: ${originalParentRowPanel.id || originalParentRowPanel.title || 'unknown'}, originalGenieOriginalParentRowPanel: ${originalGenieOriginalParentRowPanel?.id || originalGenieOriginalParentRowPanel?.title || 'none'})`);
                        }
                        
                        // Calculate position based on how many panels are already positioned before this one
                        // Count existing panels that come before this in the list
                        let panelsBeforeThis = 0;
                        for (let i = 0; i < listIndex; i++) {
                            const beforeItem = panelsMetThresholdListWithDivs[i];
                            if (beforeItem && beforeItem.div) {
                                const beforePanel = beforeItem.panel;
                                const beforePanelId = beforePanel.id || `panel-${beforeItem.index}`;
                                const beforeGenieState = this._genieStateMap[beforePanelId];
                                const beforeIsCollapsed = beforeGenieState ? beforeGenieState.isCollapsed : false;
                                const beforeHeight = beforeIsCollapsed ? 1 : (beforePanel.gridPos?.h || 8);
                                panelsBeforeThis += beforeHeight;
                            }
                        }
                        
                        // Set initial grid position for the new panel
                        if (!panel.gridPos) {
                            panel.gridPos = {x: 0, y: 0, w: 12, h: 8};
                        }
                        // CRITICAL: Preserve originalY before changing y position
                        // This is needed for repositioning when genie is unchecked and parent is expanded
                        // Now we can use _normalState.y which was populated from JSON above
                        if (panel.gridPos.originalY === undefined) {
                            // Use _normalState.y (populated from JSON above) - most accurate
                            if (panel._normalState && panel._normalState.y !== undefined) {
                                panel.gridPos.originalY = panel._normalState.y;
                            } else if (panel._genieOriginalY !== undefined) {
                                panel.gridPos.originalY = panel._genieOriginalY;
                            } else {
                                panel.gridPos.originalY = panel.gridPos.y;
                            }
                            console.log(`[Genie] Preserved originalY=${panel.gridPos.originalY} for "${panel.title || panel.id}" (from _normalState.y=${panel._normalState?.y}, _genieOriginalY=${panel._genieOriginalY}, gridPos.y=${panel.gridPos.y})`);
                        }
                        
                        // CRITICAL: Preserve originalX and originalW before changing x/w position
                        // This is needed for repositioning when genie is unchecked and parent is expanded
                        // Children shown at top get full width (x=0, w=12), but we need to preserve original values
                        if (panel.gridPos.originalX === undefined) {
                            // Use _normalState.x if available (most accurate), otherwise use _genieOriginalGridX or current gridPos.x
                            if (panel._normalState && panel._normalState.x !== undefined) {
                                panel.gridPos.originalX = panel._normalState.x;
                            } else if (panel._genieOriginalGridX !== undefined) {
                                panel.gridPos.originalX = panel._genieOriginalGridX;
                            } else {
                                panel.gridPos.originalX = panel.gridPos.x !== undefined ? panel.gridPos.x : 0;
                            }
                            console.log(`[Genie] Preserved originalX=${panel.gridPos.originalX} for "${panel.title || panel.id}" (from _normalState.x=${panel._normalState?.x}, _genieOriginalGridX=${panel._genieOriginalGridX}, gridPos.x=${panel.gridPos.x})`);
                        }
                        if (panel.gridPos.originalW === undefined) {
                            // Use _normalState.w if available (most accurate), otherwise use _genieOriginalGridW or current gridPos.w
                            if (panel._normalState && panel._normalState.w !== undefined) {
                                panel.gridPos.originalW = panel._normalState.w;
                            } else if (panel._genieOriginalGridW !== undefined) {
                                panel.gridPos.originalW = panel._genieOriginalGridW;
                            } else {
                                panel.gridPos.originalW = panel.gridPos.w !== undefined ? panel.gridPos.w : 12;
                            }
                            console.log(`[Genie] Preserved originalW=${panel.gridPos.originalW} for "${panel.title || panel.id}" (from _normalState.w=${panel._normalState?.w}, _genieOriginalGridW=${panel._genieOriginalGridW}, gridPos.w=${panel.gridPos.w})`);
                        }
                        
                        // CRITICAL: Preserve originalY BEFORE modifying gridPos.y
                        // This ensures we always have the original JSON value even after genie check modifies y
                        if (panel.gridPos.originalY === undefined) {
                            // Priority: _normalState.y > _genieOriginalY > gridPos.y (if reasonable)
                            // _normalState.y was populated from JSON BEFORE genie check, so it's the true original value
                            if (panel._normalState && panel._normalState.y !== undefined) {
                                panel.gridPos.originalY = panel._normalState.y;
                                console.log(`[Genie] Preserved originalY=${panel.gridPos.originalY} for "${panel.title || panel.id}" from _normalState.y BEFORE modifying y to top position`);
                            } else if (panel._genieOriginalY !== undefined) {
                                panel.gridPos.originalY = panel._genieOriginalY;
                                console.log(`[Genie] Preserved originalY=${panel.gridPos.originalY} for "${panel.title || panel.id}" from _genieOriginalY BEFORE modifying y to top position`);
                            } else if (panel.gridPos.y !== undefined && panel.gridPos.y >= 20) {
                                // Only preserve if y is reasonable (>= 20) to avoid preserving top positions
                                panel.gridPos.originalY = panel.gridPos.y;
                                console.log(`[Genie] Preserved originalY=${panel.gridPos.originalY} for "${panel.title || panel.id}" from gridPos.y BEFORE modifying y to top position`);
                            } else {
                                console.warn(`[Genie] WARNING: Could not preserve originalY for "${panel.title || panel.id}" - _normalState.y=${panel._normalState?.y}, _genieOriginalY=${panel._genieOriginalY}, gridPos.y=${panel.gridPos.y}`);
                            }
                        }
                        
                        panel.gridPos.x = 0;
                        panel.gridPos.w = 12;
                        panel.gridPos.y = panelsBeforeThis; // Will be adjusted during positioning
                        
                        // Render the panel as a standalone panel
                        await this.renderPanel(panel, panelId, grid, false, false);
                        
                        // Restore parent relationship if it was a child panel
                        if (isChildPanel) {
                            // CRITICAL: Always restore parent relationship, using the best available reference
                            // Prioritize originalGenieOriginalParentRowPanel (preserved before clearing) over originalParentRowPanel
                            const parentToRestore = originalGenieOriginalParentRowPanel || originalParentRowPanel;
                            if (parentToRestore) {
                                panel._parentRowPanel = parentToRestore;
                                panel._genieOriginalParentRowPanel = parentToRestore;
                                console.log(`[Genie] Restored parent relationship for child "${panel.title || panel.id}": _parentRowPanel=${parentToRestore.id || parentToRestore.title || 'unknown'}, _genieOriginalParentRowPanel=${parentToRestore.id || parentToRestore.title || 'unknown'}`);
                            } else {
                                console.warn(`[Genie] WARNING: Could not restore parent relationship for child "${panel.title || panel.id}" - originalParentRowPanel=${originalParentRowPanel?.id || originalParentRowPanel?.title || 'none'}, originalGenieOriginalParentRowPanel=${originalGenieOriginalParentRowPanel?.id || originalGenieOriginalParentRowPanel?.title || 'none'}`);
                            }
                            if (originalSkipRender !== undefined) {
                                panel._skipRender = originalSkipRender;
                            }
                            // Mark this child panel as priority standalone - it should ignore parent collapse/expand state
                            // Use _genieShowIndependently so positioning logic treats it as independent and keeps it at top
                            panel._genieShowIndependently = true;
                            // Store the standalone Y position so we can preserve it later when parent expands
                            panel._genieStandaloneY = panel.gridPos ? panel.gridPos.y : panelsBeforeThis;
                            console.log(`[Genie] Marked child panel "${panel.title || panel.id}" as priority standalone (will ignore parent collapse state and stay at top) at Y=${panel._genieStandaloneY}`);
                        }
                        
                        // Find the rendered div
                        const panelDiv = findPanelDiv(panel, item.index);
                        if (panelDiv) {
                            item.div = panelDiv;
                            // Make sure it's positioned as a standalone panel (full width)
                            panelDiv.style.gridColumn = '1 / -1';
                            panelDiv.style.setProperty('grid-column', '1 / -1', 'important');
                            
                            // Update panel references for collapse button to work
                            const currentPanelIndex = this.panelOrder.normal.indexOf(String(panel.id));
                            if (currentPanelIndex >= 0) {
                                panelDiv._panelIndex = currentPanelIndex;
                                panelDiv._panelObject = panel;
                                
                                const collapseButton = panel._collapseButton || panelDiv.querySelector('.genie-dashboard-panel-collapse-btn');
                                if (collapseButton) {
                                    collapseButton._panelIndex = currentPanelIndex;
                                    collapseButton._panelObject = panel;
                                    collapseButton._panelDiv = panelDiv;
                                }
                            }
                            
                            // Update title with incidents, anomaly, and change information using helper function
                            const titleEl = panelDiv.querySelector('.genie-dashboard-panel-title');
                            if (titleEl) {
                                const titleHTML = this.generateGeniePanelTitle(panel);
                                titleEl.innerHTML = titleHTML;
                                console.log(`[Genie] Updated title for newly rendered panel "${panel.title || panel.id}"`);
                            }
                            
                            console.log(`[Genie] ✓ Rendered priority panel "${panel.title || panel.id}" as standalone panel at list index ${listIndex}`);
                        } else {
                            console.warn(`[Genie] Priority panel "${panel.title || panel.id}" was rendered but div not found`);
                        }
                    } catch (error) {
                        console.error(`[Genie] Error rendering priority panel "${item.panel?.title || item.panel?.id}":`, error);
                    }
                }
                
                console.log(`[Genie] Completed rendering ${panelsToRender.length} priority panels as standalone panels`);
                
                // Refresh allPanelDivs to include newly rendered panels
                const updatedAllPanelDivs = Array.from(grid.querySelectorAll('.genie-dashboard-panel'))
                    .filter(div => !div.classList.contains('genie-dashboard-controls-row') && !div.hasAttribute('data-controls-row'));
                // Update allPanelDivs reference for findPanelDiv to work correctly
                allPanelDivs.length = 0;
                allPanelDivs.push(...updatedAllPanelDivs);
            }

            // Combine both lists for processing
            const allPanelsWithDivs = [...panelsMetThresholdListWithDivs, ...remainingPanelsListWithDivs];

            // Track row panels separately (they are containers, not sortable panels)
            const rowPanelsToTrack = [];
            allPanelsWithDivs.forEach((item) => {
                const panel = item.panel;
                if (!panel) return;

                if (item.isRowPanel || panel.type === 'row') {
                    const rowPanelDiv = item.div || findPanelDiv(panel, item.index);
                    rowPanelsToTrack.push({
                        panel: panel,
                        div: rowPanelDiv,
                        index: item.index
                    });
                }
            });

            // Track row panels in _genieStateMap
            rowPanelsToTrack.forEach(({panel, div, index}) => {
                if (panel && div) {
                    const panelId = panel.id || `panel-${index}`;
                    if (!this._genieStateMap[panelId]) {
                        const panelCollapsedState = div.classList.contains('genie-row-panel-collapsed') || (panel.collapsed === true);
                        const isParentRowPanel = panel.type === 'row' && panel.panels && Array.isArray(panel.panels) && panel.panels.length > 0;
                        this._genieStateMap[panelId] = {
                            sortedIndex: undefined,
                            isCollapsed: panelCollapsedState,
                            y: undefined,
                            gridX: 0,
                            gridW: 12,
                            isChildPanel: false,
                            isParentRowPanel: isParentRowPanel,
                            title: panel.title || panel.id || ''
                        };
                    }
                }
            });

            let panelsUpdated = 0;

            // Process panelsMetThresholdList - expand all (they meet threshold)
            panelsMetThresholdListWithDivs.forEach((item, sortedIndex) => {
                const panel = item.panel;
                const panelDiv = item.div;
                const isChildPanel = item.isChildPanel;

                if (!panel || !panelDiv) {
                    return;
                }

                const panelId = panel.id || `panel-${item.index}`;
                const panelTitle = panel.title || panel.id || `panel-${item.index}`;

                // IMPORTANT: For child panels in panelsMetThresholdList, set _genieShowIndependently flag
                // This ensures they remain visible when parent is collapsed
                // This is the root cause fix - when parent is expanded, children are already rendered,
                // so they need the flag set here, not just when rendering new panels
                if (isChildPanel && (panel._parentRowPanel || item.parentRowPanel)) {
                    panel._genieShowIndependently = true;
                    // Store the standalone Y position if not already stored
                    if (panel.gridPos && panel.gridPos.y !== undefined && panel._genieStandaloneY === undefined) {
                        panel._genieStandaloneY = panel.gridPos.y;
                    }
                    console.log(`[Genie] Set _genieShowIndependently=true for child panel "${panelTitle}" in panelsMetThresholdList (parent is expanded, panel already has div)`);
                }

                // Restore visibility if panel was hidden during restore (e.g., child panels with collapsed parents)
                if (panelDiv.style.display === 'none' || panelDiv.style.visibility === 'hidden') {
                    panelDiv.style.display = '';
                    panelDiv.style.visibility = '';
                    panelDiv.dataset.parentCollapsed = 'false';
                    panel._skipRender = false;
                    console.log(`[Genie] Restored visibility for panel "${panelTitle}" (was hidden during restore)`);
                }

                // All panels in panelsMetThresholdList should be expanded
                const content = panel._contentElement || panelDiv.querySelector('.genie-dashboard-panel-content');
                const collapseButton = panel._collapseButton || panelDiv.querySelector('.genie-dashboard-panel-collapse-btn');
                const isCurrentlyCollapsed = panelDiv.classList.contains('genie-panel-collapsed');

                if (isCurrentlyCollapsed && content && collapseButton) {
                    const stateChanged = this.updatePanelCollapseStateInGenieView(panel, panelDiv, false, panelId, isChildPanel, sortedIndex);
                    if (stateChanged) {
                        panelsUpdated++;
                    }
                }

                // Store genie view state
                if (!this._genieStateMap[panelId]) {
                    const isParentRowPanel = panel.type === 'row' && panel.panels && Array.isArray(panel.panels) && panel.panels.length > 0;
                    this._genieStateMap[panelId] = {
                        sortedIndex: sortedIndex,
                        isCollapsed: false,
                        y: undefined,
                        gridX: 0,
                        gridW: 12,
                        isChildPanel: isChildPanel,
                        isParentRowPanel: isParentRowPanel,
                        title: panel.title || panel.id || ''
                    };
                } else {
                    this._genieStateMap[panelId].isCollapsed = false;
                    this._genieStateMap[panelId].sortedIndex = sortedIndex;
                }
            });

            // Process remainingPanelsList - collapse all (except parents/stat)
            remainingPanelsListWithDivs.forEach((item, remainingIndex) => {
                const panel = item.panel;
                const panelDiv = item.div;
                const isChildPanel = item.isChildPanel;

                if (!panel || !panelDiv) {
                    return;
                }

                const panelId = panel.id || `panel-${item.index}`;
                const panelTitle = panel.title || panel.id || `panel-${item.index}`;
                const sortedIndex = panelsMetThresholdListWithDivs.length + remainingIndex;

                // Check if panel should be collapsed
                const isParentRowPanel = panel.type === 'row' && panel.panels && Array.isArray(panel.panels) && panel.panels.length > 0;
                const isStatPanel = panel.type === 'stat';
                const shouldCollapse = !isParentRowPanel && !isStatPanel;

                if (shouldCollapse) {
                    const content = panel._contentElement || panelDiv.querySelector('.genie-dashboard-panel-content');
                    const collapseButton = panel._collapseButton || panelDiv.querySelector('.genie-dashboard-panel-collapse-btn');
                    const isCurrentlyCollapsed = panelDiv.classList.contains('genie-panel-collapsed');

                    if (!isCurrentlyCollapsed && content && collapseButton) {
                        const stateChanged = this.updatePanelCollapseStateInGenieView(panel, panelDiv, true, panelId, isChildPanel, sortedIndex);
                        if (stateChanged) {
                            panelsUpdated++;
                        }
                    }
                }

                // Store genie view state
                if (!this._genieStateMap[panelId]) {
                    const isParentRowPanel = panel.type === 'row' && panel.panels && Array.isArray(panel.panels) && panel.panels.length > 0;
                    this._genieStateMap[panelId] = {
                        sortedIndex: sortedIndex,
                        isCollapsed: shouldCollapse,
                        y: undefined,
                        gridX: 0,
                        gridW: 12,
                        isChildPanel: isChildPanel,
                        isParentRowPanel: isParentRowPanel,
                        title: panel.title || panel.id || ''
                    };
                } else {
                    this._genieStateMap[panelId].isCollapsed = shouldCollapse;
                    this._genieStateMap[panelId].sortedIndex = sortedIndex;
                }
            });

            // Update panel references and titles for all panels
            allPanelsWithDivs.forEach((item) => {
                const panel = item.panel;
                const panelDiv = item.div;
                if (!panel || !panelDiv) return;

                // Update panel references
                const currentPanelIndex = this.panelOrder.normal.indexOf(String(panel.id));
                if (currentPanelIndex >= 0) {
                    panelDiv._panelIndex = currentPanelIndex;
                    panelDiv._panelObject = panel;

                    const collapseButton = panel._collapseButton || panelDiv.querySelector('.genie-dashboard-panel-collapse-btn');
                    if (collapseButton) {
                        collapseButton._panelIndex = currentPanelIndex;
                        collapseButton._panelObject = panel;
                        collapseButton._panelDiv = panelDiv;
                    }
                }

                // Update panel title using helper function
                const titleEl = panelDiv.querySelector('.genie-dashboard-panel-title');
                if (titleEl) {
                    const titleHTML = this.generateGeniePanelTitle(panel);
                    titleEl.innerHTML = titleHTML;
                } else {
                    console.warn(`[Genie] Could not find title element for panel "${panel.title || panel.id}"`);
                }
            });

            // Update _genieSortOrderArray with ALL panels in order (panelsMetThresholdList first, then remainingPanelsList)
            this._genieSortOrderArray = allPanelsWithDivs
                .filter(item => item.panel !== null && item.panel.type !== 'row')
                .map(item => item.panel);

            console.log(`[Genie] Final panel separation: ${panelsMetThresholdListWithDivs.length} meet threshold (expanded), ${remainingPanelsListWithDivs.length} remaining (collapsed except parents/stat)`);

            // Position panels in order: panelsMetThresholdList first, then remainingPanelsList
            // IMPORTANT: Position panels strictly in the order they appear in the lists
            let currentY = 0;
            let positionedCount = 0;

            // Position panelsMetThresholdList (expanded) - maintain exact list order
            panelsMetThresholdListWithDivs.forEach((item, listIndex) => {
                const panel = item.panel;
                const panelDiv = item.div;

                if (!panel) {
                    console.warn(`[Genie] Panel at index ${listIndex} in panelsMetThresholdList is null, skipping`);
                    return;
                }

                // If panel doesn't have a div, try to find it again (it might have been rendered)
                let actualPanelDiv = panelDiv;
                if (!actualPanelDiv) {
                    actualPanelDiv = findPanelDiv(panel, item.index);
                    if (actualPanelDiv) {
                        item.div = actualPanelDiv; // Update the item with the found div
                    }
                }

                if (actualPanelDiv) {
                    const panelId = panel.id || `panel-${item.index}`;
                    const genieState = this._genieStateMap[panelId];
                    const isCollapsed = genieState ? genieState.isCollapsed : actualPanelDiv.classList.contains('genie-panel-collapsed');
                    const effectiveHeight = isCollapsed ? 1 : (panel.gridPos?.h || 8);

                    const originalGridPos = panel.gridPos ? {
                        y: panel.gridPos.y,
                        x: panel.gridPos.x,
                        w: panel.gridPos.w,
                        h: panel.gridPos.h
                    } : null;

                    // Position panel at currentY (maintaining list order)
                    this.setPanelPosition(panel, actualPanelDiv, currentY, effectiveHeight, false);

                    if (this._genieStateMap[panelId]) {
                        this._genieStateMap[panelId].y = currentY;
                        this._genieStateMap[panelId].originalGridPos = originalGridPos;
                        this._genieStateMap[panelId].sortedIndex = listIndex; // Store list index for reference
                    }

                    const isRowPanel = panel && panel.type === 'row';
                    if (!isRowPanel) {
                        actualPanelDiv.style.gridColumn = '1 / -1';
                        actualPanelDiv.style.setProperty('grid-column', '1 / -1', 'important');
                    }

                    if (this._genieStateMap[panelId]) {
                        this._genieStateMap[panelId].gridX = 0;
                        this._genieStateMap[panelId].gridW = 12;
                    }

                    currentY += effectiveHeight;
                    positionedCount++;
                } else {
                    console.warn(`[Genie] Panel "${panel.title || panel.id}" at list index ${listIndex} in panelsMetThresholdList has no DOM element, skipping positioning`);
                }
            });

            console.log(`[Genie] Positioned ${positionedCount} expanded panels from panelsMetThresholdList at top (Y positions 0-${currentY - 1})`);

            // Position remainingPanelsList (collapsed) - maintain exact list order
            positionedCount = 0;
            remainingPanelsListWithDivs.forEach((item, listIndex) => {
                const panel = item.panel;
                const panelDiv = item.div;

                if (!panel) {
                    console.warn(`[Genie] Panel at index ${listIndex} in remainingPanelsList is null, skipping`);
                    return;
                }

                // If panel doesn't have a div, try to find it again (it might have been rendered)
                let actualPanelDiv = panelDiv;
                if (!actualPanelDiv) {
                    actualPanelDiv = findPanelDiv(panel, item.index);
                    if (actualPanelDiv) {
                        item.div = actualPanelDiv; // Update the item with the found div
                    }
                }

                if (actualPanelDiv) {
                    const panelId = panel.id || `panel-${item.index}`;
                    const genieState = this._genieStateMap[panelId];
                    const isCollapsed = genieState ? genieState.isCollapsed : actualPanelDiv.classList.contains('genie-panel-collapsed');
                    const effectiveHeight = isCollapsed ? 1 : (panel.gridPos?.h || 8);

                    const originalGridPos = panel.gridPos ? {
                        y: panel.gridPos.y,
                        x: panel.gridPos.x,
                        w: panel.gridPos.w,
                        h: panel.gridPos.h
                    } : null;

                    // Position panel at currentY (maintaining list order)
                    this.setPanelPosition(panel, actualPanelDiv, currentY, effectiveHeight, false);

                    if (this._genieStateMap[panelId]) {
                        this._genieStateMap[panelId].y = currentY;
                        this._genieStateMap[panelId].originalGridPos = originalGridPos;
                        this._genieStateMap[panelId].sortedIndex = panelsMetThresholdListWithDivs.length + listIndex; // Store list index for reference
                    }

                    const isRowPanel = panel && panel.type === 'row';
                    if (!isRowPanel) {
                        actualPanelDiv.style.gridColumn = '1 / -1';
                        actualPanelDiv.style.setProperty('grid-column', '1 / -1', 'important');
                    }

                    if (this._genieStateMap[panelId]) {
                        this._genieStateMap[panelId].gridX = 0;
                        this._genieStateMap[panelId].gridW = 12;
                    }

                    actualPanelDiv.style.display = '';
                    actualPanelDiv.style.visibility = '';

                    if (isCollapsed) {
                        const content = panel._contentElement || actualPanelDiv.querySelector('.genie-dashboard-panel-content');
                        if (content) {
                            content.style.display = 'none';
                        }
                        actualPanelDiv.classList.add('genie-panel-collapsed');
                    }

                    currentY += effectiveHeight;
                    positionedCount++;
                } else {
                    console.warn(`[Genie] Panel "${panel.title || panel.id}" at list index ${listIndex} in remainingPanelsList has no DOM element, skipping positioning`);
                }
            });

            console.log(`[Genie] Positioned ${positionedCount} remaining panels from remainingPanelsList after expanded panels (Y positions ${panelsMetThresholdListWithDivs.length > 0 ? currentY - positionedCount : 0}-${currentY - 1})`);

            // Ensure controls row is positioned correctly
            this.ensureControlsRowPosition();
            
            // Note: We do NOT call recalculateAllYPositions here because it might reorder panels
            // The panels are already positioned in the correct order based on the lists
            // Only recalculate if absolutely necessary for layout (e.g., to handle gaps)
            // For now, we skip it to preserve the exact list order

            // Update _genieStateMap with final Y positions
            allPanelsWithDivs.forEach((item) => {
                const panel = item.panel;
                const panelDiv = item.div;

                if (panel && panelDiv) {
                    const gridRow = panelDiv.style.gridRow || window.getComputedStyle(panelDiv).gridRow;
                    let finalY = undefined;
                    if (gridRow && gridRow.includes('/')) {
                        const match = gridRow.match(/(\d+)\s*\/\s*\d+/);
                        if (match) {
                            finalY = parseInt(match[1]) - 1; // Subtract 1 for controls row
                        }
                    }

                    const panelId = panel.id || `panel-${item.index}`;
                    if (this._genieStateMap[panelId] && finalY !== undefined) {
                        this._genieStateMap[panelId].y = finalY;
                    }
                }
            });

            const renderEndTime = performance.now();
            const renderDuration = renderEndTime - renderStartTime;
            console.log(`[Genie Performance] Render (applyGenieView) completed: ${renderDuration.toFixed(2)}ms`);
            console.log(`[Genie] Rendered ${panelsMetThresholdListWithDivs.length} expanded panels and ${remainingPanelsListWithDivs.length} remaining panels`);
        };

        /**
         * Sort panels by maximum absolute change value and reorder dashboard
         * Panels with change calculations are sorted in descending order by max |change|
         * Panels without change calculations go to the bottom
         * Panels with max |change| below threshold will be collapsed
         * @param {number} threshold - Threshold value for collapsing panels (panels with max |change| below this will be collapsed)
         * @param {Array} [panelsMetThresholdList] - Optional: Pre-computed list of panels that meet threshold (avoids calling getAllPanelsForGenie)
         * @param {Array} [remainingPanelsList] - Optional: Pre-computed list of remaining panels (avoids calling getAllPanelsForGenie)
         */
        target.sortAndReorderPanelsByChange = function (threshold = 0, panelsMetThresholdList, remainingPanelsList) {
            const renderStartTime = performance.now();
            console.log(`[Genie Performance] Starting render (sortAndReorderPanelsByChange) at ${new Date().toISOString()}`);
            // Get grid to find all panels
            const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
            if (!grid) {
                console.warn('[Genie] Dashboard grid not found, cannot reorder panels');
                return;
            }

            // Get ALL panels from getAllPanelsForGenie() with threshold - this is the source of truth
            // This includes ALL panels (standalone, row, and children) regardless of visibility
            // getAllPanelsForGenie returns two lists: panelsMetThresholdList and remainingPanelsList
            // It also stores original state during collection if not already stored
            // If lists are provided, use them; otherwise, call getAllPanelsForGenie
            let panelsMetThresholdFromGenie, remainingPanelsFromGenie;
            if (panelsMetThresholdList && remainingPanelsList) {
                // Use provided lists (from applyGenieView)
                panelsMetThresholdFromGenie = panelsMetThresholdList;
                remainingPanelsFromGenie = remainingPanelsList;
                console.log(`[Genie] Using provided lists: ${panelsMetThresholdFromGenie.length} panels meeting threshold, ${remainingPanelsFromGenie.length} remaining panels`);
            } else {
                // Call getAllPanelsForGenie (legacy path or direct call)
                const result = this.getAllPanelsForGenie(threshold);
                panelsMetThresholdFromGenie = result.panelsMetThresholdList;
                remainingPanelsFromGenie = result.remainingPanelsList;
                console.log(`[Genie] getAllPanelsForGenie returned ${panelsMetThresholdFromGenie.length} panels meeting threshold, ${remainingPanelsFromGenie.length} remaining panels`);
            }

            // Get panels from DOM for matching (but don't rely on DOM as source of truth)
            const allPanelDivs = Array.from(grid.querySelectorAll('.genie-dashboard-panel'))
                .filter(div => !div.classList.contains('genie-dashboard-controls-row') && !div.hasAttribute('data-controls-row'));

            // Track used divs to avoid duplicates
            const usedDivs = new Set();

            // Helper function to find panel div for a panel object
            // Returns null if panel is not in DOM (which is OK - we still include it in sorting)
            const findPanelDiv = (panel, index, useIndexForId = true) => {
                let panelDiv = null;

                // Method 1: Try by _panelDiv reference first (most reliable, works even if hidden)
                if (panel._panelDiv) {
                    // Verify it's still in the DOM
                    if (document.contains(panel._panelDiv)) {
                        panelDiv = panel._panelDiv;
                    }
                }

                // Method 2: Try by expected ID (if useIndexForId is true)
                if (!panelDiv && useIndexForId && typeof index === 'number') {
                    const expectedId = this.getInstanceId(`panel-${index}`);
                    panelDiv = document.getElementById(expectedId);
                }

                // Method 3: Try by matching gridPos.y if available
                if (!panelDiv && panel.gridPos) {
                    allPanelDivs.forEach(div => {
                        if (usedDivs.has(div)) return;
                        const gridRow = div.style.gridRow || window.getComputedStyle(div).gridRow;
                        if (gridRow && gridRow.includes('/')) {
                            const match = gridRow.match(/(\d+)\s*\/\s*\d+/);
                            if (match) {
                                const currentY = parseInt(match[1]) - 1;
                                if (currentY === panel.gridPos.y) {
                                    panelDiv = div;
                                }
                            }
                        }
                    });
                }

                // Method 4: Try by panel title
                if (!panelDiv && panel.title) {
                    allPanelDivs.forEach(div => {
                        if (usedDivs.has(div)) return;
                        const titleEl = div.querySelector('.genie-dashboard-panel-title');
                        if (titleEl && (titleEl.textContent || titleEl.innerText) === panel.title) {
                            panelDiv = div;
                        }
                    });
                }

                // Method 5: For child panels, try to find by data attributes or parent relationship
                if (!panelDiv && panel._parentRowPanel) {
                    // Try to find child panel by checking data attributes
                    allPanelDivs.forEach(div => {
                        if (div._panelObject === panel) {
                            panelDiv = div;
                        }
                    });
                }

                return panelDiv; // Can be null if panel is not in DOM
            };

            // NOTE: Row panels are NOT included in sorting - they are containers only
            // Row panels will be tracked in _genieStateMap separately (after sorting)
            const rowPanelsToTrack = []; // Store row panels separately for _genieStateMap tracking
            
            // Combine both lists to get all panels (for extracting row panels)
            const allPanelsFromGenie = [...panelsMetThresholdFromGenie, ...remainingPanelsFromGenie];
            
            // Extract row panels from allPanelsFromGenie for separate tracking
            allPanelsFromGenie.forEach((item) => {
                const panel = item.panel;
                if (!panel) return;

                // Handle row panels - they are containers, not sortable panels
                if (item.isRowPanel || panel.type === 'row') {
                    const rowPanelDiv = findPanelDiv(panel, typeof item.index === 'number' ? item.index : -1, true);
                    rowPanelsToTrack.push({
                        panel: panel,
                        div: rowPanelDiv, // Can be null if not in DOM
                        index: item.index
                    });
                    if (rowPanelDiv) {
                        console.log(`[Genie] Found row panel ${item.index}: ${panel.title || panel.id} (will be tracked separately, not sorted)`);
                    } else {
                        console.log(`[Genie] Row panel ${item.index}: ${panel.title || panel.id} included without DOM element (will be tracked separately, not sorted)`);
                    }
                }
            });

            // Now add DOM divs to the two lists from identifyPanelsForGenie
            // panelsMetThresholdList and remainingPanelsList are already separated and sorted by identifyPanelsForGenie
            // We just need to add DOM divs to them (excluding row panels which are handled separately)
            // Note: Using different names to avoid conflict with function parameters
            const panelsMetThresholdListWithDivs = [];
            const remainingPanelsListWithDivs = [];

            // Check if backend processing is enabled (use anomaly scores for sorting)
            const useBackend = this.inputConfig?.isAnomalyProcessInUI === false;

            // Process panelsMetThresholdFromGenie: add DOM divs (skip row panels)
            panelsMetThresholdFromGenie.forEach((item) => {
                const panel = item.panel;
                if (!panel) return;

                // Skip row panels - they are handled separately
                if (item.isRowPanel || panel.type === 'row') {
                    return;
                }

                const panelDiv = findPanelDiv(panel, typeof item.index === 'number' ? item.index : -1, !item.isChild);
                if (panelDiv) {
                    usedDivs.add(panelDiv);
                }
                panelsMetThresholdListWithDivs.push({
                    ...item,
                    div: panelDiv, // Can be null if not in DOM
                    isChildPanel: item.isChild || false
                });
            });

            // Process remainingPanelsFromGenie: add DOM divs (skip row panels)
            remainingPanelsFromGenie.forEach((item) => {
                const panel = item.panel;
                if (!panel) {
                    remainingPanelsListWithDivs.push({...item, div: null});
                    return;
                }

                // Skip row panels - they are handled separately
                if (item.isRowPanel || panel.type === 'row') {
                    return;
                }

                const panelDiv = findPanelDiv(panel, typeof item.index === 'number' ? item.index : -1, !item.isChild);
                if (panelDiv) {
                    usedDivs.add(panelDiv);
                }
                remainingPanelsListWithDivs.push({
                    ...item,
                    div: panelDiv, // Can be null if not in DOM
                    isChildPanel: item.isChild || false
                });
            });

            // Combine: panelsMetThresholdList first (sorted and expanded), then remainingPanelsList (collapsed)
            let sortedPanels = [...panelsMetThresholdListWithDivs, ...remainingPanelsListWithDivs];

            // After collapse/expand logic is applied, re-sort to prioritize expanded panels (those needing attention)
            // This will pull out child panels that are expanded to the top
            // We'll do this after _genieStateMap is populated, but for now we'll sort based on threshold logic

            // Populate _genieSortOrderArray with sorted panel order
            // Store panel references in the order they should appear in genie view
            // Exclude parent row panels - they are containers only, not sortable panels
            this._genieSortOrderArray = sortedPanels
                .filter(item => item.panel !== null && item.panel.type !== 'row')
                .map(item => item.panel);

            const sortMetric = useBackend ? 'anomaly score' : 'change';
            console.log(`[Genie] Sorting panels: ${panelsMetThresholdListWithDivs.length} with ${sortMetric}, ${remainingPanelsListWithDivs.length} without ${sortMetric}`);
            console.log(`[Genie] Created _genieSortOrderArray with ${this._genieSortOrderArray.length} panels`);
            panelsMetThresholdListWithDivs.forEach((item, idx) => {
                const panelType = item.panel ? item.panel.type || 'unknown' : 'no panel object';
                if (useBackend && item.anomalyScore !== undefined) {
                    console.log(`[Genie] Panel ${item.index} (${panelType}, sorted position ${idx}): anomaly score = ${item.anomalyScore.toFixed(2)}`);
                } else {
                    console.log(`[Genie] Panel ${item.index} (${panelType}, sorted position ${idx}): max |change| = ${item.maxAbsChange.toFixed(2)}%`);
                }
            });

            // Store original indices, Y positions, grid column (x, w), collapsed state, and title before reordering
            // Only store if not already stored (original state should be stored when genie check is toggled ON)
            // This allows threshold changes without overwriting the original state
            sortedPanels.forEach((item) => {
                const panel = item.panel;
                const panelDiv = item.div;
                if (panel) {
                    // Only store if not already stored - original state is stored when checkbox is checked
                    if (panel._genieOriginalIndex === undefined) {
                        panel._genieOriginalIndex = typeof item.index === 'number' ? item.index : -1;
                    }
                    if (panel._genieOriginalY === undefined) {
                        if (panel.gridPos) {
                            panel._genieOriginalY = panel.gridPos.y;
                        } else if (panelDiv) {
                            // Try to get from DOM
                            const gridRow = panelDiv.style.gridRow || window.getComputedStyle(panelDiv).gridRow;
                            if (gridRow && gridRow.includes('/')) {
                                const match = gridRow.match(/(\d+)\s*\/\s*\d+/);
                                if (match) {
                                    panel._genieOriginalY = parseInt(match[1]) - 1;
                                }
                            }
                        }
                    }
                    // Store original grid column position and width
                    if (panel._genieOriginalGridX === undefined) {
                        if (panel.gridPos) {
                            panel._genieOriginalGridX = panel.gridPos.x;
                        } else if (panelDiv) {
                            // Try to get from DOM
                            const gridColumn = panelDiv.style.gridColumn || window.getComputedStyle(panelDiv).gridColumn;
                            if (gridColumn && gridColumn.includes('/')) {
                                const match = gridColumn.match(/(\d+)\s*\/\s*(\d+)/);
                                if (match) {
                                    panel._genieOriginalGridX = parseInt(match[1]) - 1;
                                }
                            }
                        }
                    }
                    if (panel._genieOriginalGridW === undefined) {
                        if (panel.gridPos) {
                            panel._genieOriginalGridW = panel.gridPos.w;
                        } else if (panelDiv) {
                            // Try to get from DOM
                            const gridColumn = panelDiv.style.gridColumn || window.getComputedStyle(panelDiv).gridColumn;
                            if (gridColumn && gridColumn.includes('/')) {
                                const match = gridColumn.match(/(\d+)\s*\/\s*(\d+)/);
                                if (match) {
                                    const startCol = parseInt(match[1]);
                                    const endCol = parseInt(match[2]);
                                    panel._genieOriginalGridW = endCol - startCol + 1;
                                }
                            }
                        }
                    }
                    // Store original collapsed state if not already stored
                    // Read from DOM (source of truth) - panel._isCollapsed might not be set for child panels
                    if (panel._genieOriginalCollapsed === undefined && panelDiv) {
                        panel._genieOriginalCollapsed = panelDiv.classList.contains('genie-panel-collapsed') || false;
                    }
                    // Store original title if not already stored
                    if (panel._genieOriginalTitle === undefined) {
                        panel._genieOriginalTitle = panel.title || '';
                    }
                }
            });

            // Initialize _genieStateMap to store genie view state for each panel
            // This map will maintain Y positions and collapse/expand states separately from original state
            // Must be initialized before first use (rowPanelsToTrack.forEach below)
            if (!this._genieStateMap) {
                this._genieStateMap = {};
            }

            // Track row panels in _genieStateMap separately (they are containers, not sortable panels)
            // Row panels need to be tracked for state management but should NOT be in sortedPanels
            rowPanelsToTrack.forEach(({panel, div, index}) => {
                if (panel && div) {
                    const panelId = panel.id || `panel-${index}`;
                    if (!this._genieStateMap[panelId]) {
                        const panelCollapsedState = div.classList.contains('genie-row-panel-collapsed') || 
                            (panel.collapsed === true);
                        const isParentRowPanel = panel.type === 'row' && panel.panels && Array.isArray(panel.panels) && panel.panels.length > 0;
                        this._genieStateMap[panelId] = {
                            sortedIndex: undefined, // Row panels are not in sorted order
                            isCollapsed: panelCollapsedState,
                            y: undefined, // Will be set by recalculateAllYPositions
                            gridX: 0,
                            gridW: 12,
                            isChildPanel: false,
                            isParentRowPanel: isParentRowPanel,
                            title: panel.title || panel.id || ''
                        };
                        console.log(`[Genie] Tracked row panel ${index} in _genieStateMap: ${panel.title || panel.id} (collapsed=${panelCollapsedState})`);
                    }
                }
            });

            // Check if there are any row panels - if so, don't reorder, just process for collapse/expand
            let hasRowPanels = false;
            this.panelOrder.normal.forEach(panelId => {
                const p = this.panels[panelId];
                if (p && p.type === 'row') {
                    hasRowPanels = true;
                }
            });

            if (hasRowPanels) {
                // Don't reorder when row panels exist - preserve structure
                console.log(`[Genie] Row panels detected - skipping reordering, only processing collapse/expand`);
            } else {
                // No row panels - safe to reorder standalone panels
                // Update panelOrder.genie to match sorted order - only include standalone panels (not children)
                const standalonePanelsInOrder = sortedPanels
                    .filter(item => item.panel !== null && !item.isChildPanel)
                    .map(item => String(item.panel.id))
                    .filter(panelId => this.panels[panelId] !== undefined); // Ensure panel exists

                // Update genie order array
                this.panelOrder.genie = standalonePanelsInOrder;
                console.log(`[Genie] Reordered ${standalonePanelsInOrder.length} standalone panels in genie view`);
            }

            // _genieStateMap is already initialized above (before rowPanelsToTrack.forEach)
            // Just ensure it exists (should already be initialized)
            if (!this._genieStateMap) {
                this._genieStateMap = {};
            }

            // Process panels for collapse/expand based on threshold separation
            // panelsMetThresholdList: expand all (they meet threshold)
            // remainingPanelsList: collapse all (except parents/stat panels)
            // Position calculation will be handled by recalculateAllYPositions() at the end
            let panelsUpdated = 0;

            // Process panelsMetThresholdList - expand all
            panelsMetThresholdListWithDivs.forEach((item, sortedIndex) => {
                const panel = item.panel;
                const panelDiv = item.div;
                const isChildPanel = item.isChildPanel;

                if (!panel || !panelDiv) {
                    if (!panelDiv) {
                        console.warn(`[Genie] No DOM element for panel at sorted index ${sortedIndex} in panelsMetThresholdList`);
                    }
                    return;
                }

                const panelId = panel.id || `panel-${item.index}`;
                const panelTitle = panel.title || panel.id || `panel-${item.index}`;

                // All panels in panelsMetThresholdList should be expanded
                const isRowPanel = panel.type === 'row';
                const content = panel._contentElement || panelDiv.querySelector('.genie-dashboard-panel-content');
                const collapseButton = panel._collapseButton || panelDiv.querySelector('.genie-dashboard-panel-collapse-btn') || 
                                       panelDiv.querySelector('.genie-dashboard-row-panel-collapse-btn');
                
                // Check collapse state - for row panels, check genie-row-panel-collapsed; for regular panels, check genie-panel-collapsed
                const isCurrentlyCollapsed = isRowPanel 
                    ? (panelDiv.classList.contains('genie-row-panel-collapsed') || panel.collapsed === true || panel._isCollapsed === true)
                    : panelDiv.classList.contains('genie-panel-collapsed');

                // Ensure panel object state is synced with DOM state
                if (isRowPanel) {
                    // For row panels, sync panel object state with DOM
                    if (isCurrentlyCollapsed) {
                        // Panel is collapsed in DOM but should be expanded - ensure state is synced
                        panel.collapsed = false;
                        panel._isCollapsed = false;
                        panelDiv.classList.remove('genie-row-panel-collapsed');
                        if (collapseButton) {
                            collapseButton.innerHTML = '<i class="fa fa-chevron-down" style="font-size: 10px;"></i>';
                            collapseButton.title = 'Collapse row';
                        }
                        if (content) {
                            content.style.display = 'flex';
                            content.style.visibility = 'visible';
                        }
                        panelsUpdated++;
                        console.log(`[Genie] ✓ Expanded row panel "${panelTitle}" (meets threshold, state synced)`);
                    } else {
                        // Panel is already expanded - ensure state is consistent
                        panel.collapsed = false;
                        panel._isCollapsed = false;
                        panelDiv.classList.remove('genie-row-panel-collapsed');
                        if (content) {
                            content.style.display = 'flex';
                            content.style.visibility = 'visible';
                        }
                    }
                } else if (isCurrentlyCollapsed && content && collapseButton) {
                    // Regular panel - use updatePanelCollapseStateInGenieView
                    const stateChanged = this.updatePanelCollapseStateInGenieView(panel, panelDiv, false, panelId, isChildPanel, sortedIndex);
                    if (stateChanged) {
                        panelsUpdated++;
                        console.log(`[Genie] ✓ Expanded panel "${panelTitle}" (meets threshold)`);
                    }
                }

                // Store genie view state
                if (!this._genieStateMap[panelId]) {
                    const isParentRowPanel = panel.type === 'row' && panel.panels && Array.isArray(panel.panels) && panel.panels.length > 0;
                    this._genieStateMap[panelId] = {
                        sortedIndex: sortedIndex,
                        isCollapsed: false, // All panels in this list are expanded
                        y: undefined,
                        gridX: 0,
                        gridW: 12,
                        isChildPanel: isChildPanel,
                        isParentRowPanel: isParentRowPanel,
                        title: panel.title || panel.id || ''
                    };
                } else {
                    this._genieStateMap[panelId].isCollapsed = false;
                    this._genieStateMap[panelId].sortedIndex = sortedIndex;
                }
            });

            // Process remainingPanelsList - collapse all (except parents/stat)
            remainingPanelsListWithDivs.forEach((item, remainingIndex) => {
                const panel = item.panel;
                const panelDiv = item.div;
                const isChildPanel = item.isChildPanel;

                if (!panel || !panelDiv) {
                    if (!panelDiv) {
                        console.log(`[Genie] Panel in remainingPanelsList has no DOM element (will be handled later): ${panel ? panel.title || panel.id : 'no panel object'}`);
                    }
                    return;
                }

                const panelId = panel.id || `panel-${item.index}`;
                const panelTitle = panel.title || panel.id || `panel-${item.index}`;
                const sortedIndex = panelsMetThresholdListWithDivs.length + remainingIndex; // Position after panelsMetThresholdList

                // Check if panel should be collapsed
                // Don't collapse if it's a parent row panel or stat panel
                const isParentRowPanel = panel.type === 'row' && panel.panels && Array.isArray(panel.panels) && panel.panels.length > 0;
                const isStatPanel = panel.type === 'stat';
                const shouldCollapse = !isParentRowPanel && !isStatPanel;

                if (shouldCollapse) {
                    const content = panel._contentElement || panelDiv.querySelector('.genie-dashboard-panel-content');
                    const collapseButton = panel._collapseButton || panelDiv.querySelector('.genie-dashboard-panel-collapse-btn');
                    const isCurrentlyCollapsed = panelDiv.classList.contains('genie-panel-collapsed');

                    if (!isCurrentlyCollapsed && content && collapseButton) {
                        const stateChanged = this.updatePanelCollapseStateInGenieView(panel, panelDiv, true, panelId, isChildPanel, sortedIndex);
                        if (stateChanged) {
                            panelsUpdated++;
                            console.log(`[Genie] ✓ Collapsed panel "${panelTitle}" (does not meet threshold)`);
                        }
                    }
                } else {
                    console.log(`[Genie] Panel "${panelTitle}" not collapsed (isParentRowPanel=${isParentRowPanel}, isStatPanel=${isStatPanel})`);
                }

                // Store genie view state
                if (!this._genieStateMap[panelId]) {
                    const isParentRowPanel = panel.type === 'row' && panel.panels && Array.isArray(panel.panels) && panel.panels.length > 0;
                    this._genieStateMap[panelId] = {
                        sortedIndex: sortedIndex,
                        isCollapsed: shouldCollapse,
                        y: undefined,
                        gridX: 0,
                        gridW: 12,
                        isChildPanel: isChildPanel,
                        isParentRowPanel: isParentRowPanel,
                        title: panel.title || panel.id || ''
                    };
                } else {
                    this._genieStateMap[panelId].isCollapsed = shouldCollapse;
                    this._genieStateMap[panelId].sortedIndex = sortedIndex;
                }
            });

            // Update panel references and titles for all panels
            sortedPanels.forEach((item) => {
                const panel = item.panel;
                const panelDiv = item.div;
                if (!panel || !panelDiv) return;

                // Update panel references in panelDiv and collapse button for collapse button to work after sorting
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

                // Update panel title to show change values if panel has changes
                const titleEl = panelDiv.querySelector('.genie-dashboard-panel-title');
                if (titleEl) {
                        if (panel.change && Object.keys(panel.change).length > 0) {
                            // Get original title and process placeholders
                            const rawOriginalTitle = panel._genieOriginalTitle || panel.title || '';
                            const originalTitle = this.replacePlaceholdersInText(rawOriginalTitle);
                            const changeEntries = [];

                            // Collect all change entries with their absolute values for sorting
                            // Filter out _byDuration and _maxAbsChangeDuration keys (they are metadata, not actual changes)
                            Object.entries(panel.change).forEach(([seriesName, changeValue]) => {
                                // Skip metadata keys
                                if (seriesName.endsWith('_byDuration') || seriesName.endsWith('_maxAbsChangeDuration')) {
                                    return;
                                }

                                if (changeValue !== null && changeValue !== undefined && !isNaN(changeValue) && isFinite(changeValue)) {
                                    // Get text after last colon character
                                    const lastColonIndex = seriesName.lastIndexOf(':');
                                    let seriesNameShort = lastColonIndex >= 0 ? seriesName.substring(lastColonIndex + 1) : seriesName;

                                    // Truncate if more than 50 characters: show "..." + last 50 characters
                                    if (seriesNameShort.length > 50) {
                                        seriesNameShort = '...' + seriesNameShort.substring(seriesNameShort.length - 50);
                                    }

                                    changeEntries.push({
                                        seriesName: seriesNameShort,
                                        changeValue: changeValue,
                                        absValue: Math.abs(changeValue)
                                    });
                                }
                            });

                            // Sort by absolute value in descending order
                            changeEntries.sort((a, b) => b.absValue - a.absValue);

                            // Build formatted change parts
                            const changeParts = changeEntries.map(entry => {
                                // Format change value with 2 decimal places and % sign
                                const formattedChange = entry.changeValue.toFixed(2) + '%';
                                return `${entry.seriesName}: ${formattedChange}`;
                            });

                            // Check for incidents
                            const incidentCount = panel._incidentCount;
                            const hasIncidents = incidentCount !== undefined && incidentCount !== null && incidentCount > 0;

                            // Check for anomaly score
                            const anomalyScore = panel._anomalyScore;
                            const hasAnomalyScore = anomalyScore !== undefined && anomalyScore !== null &&
                                !isNaN(anomalyScore) && isFinite(anomalyScore);

                            // Build title parts in order: [incidents:x, anomaly:y] (change)
                            const titleParts = [];

                            // Build the bracket content: [incidents:x, anomaly:y] or [incidents:x] or [anomaly:y]
                            const bracketParts = [];

                            // Add incident count first (if present)
                            if (hasIncidents) {
                                bracketParts.push(`incidents:${incidentCount}`);
                            }

                            // Add anomaly score second (if present)
                            if (hasAnomalyScore) {
                                bracketParts.push(`anomaly:${anomalyScore.toFixed(2)}`);
                            }

                            // Add bracket content if any parts exist
                            if (bracketParts.length > 0) {
                                // Use collapse threshold for color coding (same threshold used for collapse/expand)
                                const collapseThreshold = this.inputConfig?.genieAnomalyCollapseThreshold ||
                                    this.inputConfig?.genieAnomalyColorThreshold ||
                                    0.3;
                                // Color based on anomaly score if present, otherwise use default
                                let color = '#f59e0b'; // Default orange
                                if (hasAnomalyScore) {
                                    color = anomalyScore >= collapseThreshold ? '#ef4444' : '#f59e0b'; // Red if >= threshold, orange otherwise
                                }
                                titleParts.push(`<span class="genie-time-range-display" style="color: ${color}; font-weight: bold;">[${bracketParts.join(', ')}]</span>`);
                            }

                            // Add change parts third (if present)
                            if (changeParts.length > 0) {
                                titleParts.push(`<span class="genie-time-range-display">(${changeParts.join(', ')})</span>`);
                            }

                            if (titleParts.length > 0) {
                                // Format: "Original Title [incidents:x, anomaly:y] (series1:value1, series2:value2, ...)"
                                titleEl.innerHTML = `${originalTitle} ${titleParts.join(' ')}`;
                                console.log(`[Genie] Updated title for panel "${panel.title || panel.id}": ${changeParts.length} change entries${hasIncidents ? `, incidents=${incidentCount}` : ''}${hasAnomalyScore ? `, anomalyScore=${anomalyScore.toFixed(2)}` : ''} displayed`);
                            } else {
                                // No finite change values, anomaly score, or incidents to display, restore original title
                                titleEl.textContent = originalTitle;
                                console.log(`[Genie] Panel "${panel.title || panel.id}" has change data but no finite values, restored original title`);
                            }
                        } else {
                            // No change data, but check for incidents and/or anomaly score
                            const incidentCount = panel._incidentCount;
                            const hasIncidents = incidentCount !== undefined && incidentCount !== null && incidentCount > 0;

                            const anomalyScore = panel._anomalyScore;
                            const hasAnomalyScore = anomalyScore !== undefined && anomalyScore !== null &&
                                !isNaN(anomalyScore) && isFinite(anomalyScore);

                            // Special handling for non-comparable panels
                            if (panel._genieNonComparable) {
                                // Get original title and process placeholders
                                const rawOriginalTitle = panel._genieOriginalTitle || panel.title || '';
                                const originalTitle = this.replacePlaceholdersInText(rawOriginalTitle);

                                // Calculate percentage of kpods above threshold (grouped by grouping key)
                                const collapseThreshold = this.inputConfig?.genieAnomalyCollapseThreshold ||
                                    this.inputConfig?.genieAnomalyColorThreshold ||
                                    0.3;

                                let percentKpodsAboveThreshold = 0;
                                let groupingKeyDisplay = '';
                                let averageAboveThreshold = 0;

                                if (panel._kpodGroups && panel._anomalyScores) {
                                    // Count kpods above threshold, grouped by grouping key
                                    const groups = panel._kpodGroups;
                                    let totalKpods = 0;
                                    let kpodsAboveThreshold = 0;
                                    const scoresAboveThreshold = [];

                                    // Collect all grouping keys for display
                                    const groupingKeys = Object.keys(groups);

                                    Object.keys(groups).forEach(groupingKey => {
                                        const kpodsInGroup = groups[groupingKey] || [];
                                        kpodsInGroup.forEach(kpodName => {
                                            totalKpods++;
                                            const score = panel._anomalyScores[kpodName];
                                            if (score !== null && score !== undefined && !isNaN(score) && isFinite(score) && score >= collapseThreshold) {
                                                kpodsAboveThreshold++;
                                                scoresAboveThreshold.push(score);
                                            }
                                        });
                                    });

                                    percentKpodsAboveThreshold = totalKpods > 0 ? (kpodsAboveThreshold / totalKpods) * 100 : 0;

                                    // Calculate average of scores above threshold
                                    if (scoresAboveThreshold.length > 0) {
                                        averageAboveThreshold = scoresAboveThreshold.reduce((sum, score) => sum + score, 0) / scoresAboveThreshold.length;
                                    }

                                    // Format grouping key for display (show first grouping key as example, or all if few)
                                    if (groupingKeys.length > 0) {
                                        if (groupingKeys.length <= 3) {
                                            groupingKeyDisplay = groupingKeys.join(', ');
                                        } else {
                                            groupingKeyDisplay = groupingKeys[0] + ` (+${groupingKeys.length - 1} more)`;
                                        }
                                    }
                                } else if (panel._anomalyScores) {
                                    // Fallback: count individual kpods if grouping info not available
                                    const kpodScores = Object.values(panel._anomalyScores);
                                    const totalKpods = kpodScores.length;
                                    const scoresAboveThreshold = kpodScores.filter(score =>
                                        score !== null && score !== undefined && !isNaN(score) && isFinite(score) && score >= collapseThreshold
                                    );
                                    const kpodsAboveThreshold = scoresAboveThreshold.length;
                                    percentKpodsAboveThreshold = totalKpods > 0 ? (kpodsAboveThreshold / totalKpods) * 100 : 0;

                                    // Calculate average of scores above threshold
                                    if (scoresAboveThreshold.length > 0) {
                                        averageAboveThreshold = scoresAboveThreshold.reduce((sum, score) => sum + score, 0) / scoresAboveThreshold.length;
                                    }
                                }

                                // Build title parts
                                const titleParts = [];

                                // Add bracket content: [Incidents x]
                                if (hasIncidents) {
                                    titleParts.push(`<span class="genie-time-range-display" style="color: #f59e0b; font-weight: bold;">[Incidents ${incidentCount}]</span>`);
                                }

                                // Add anomaly score: [Anomaly averageValue]
                                if (averageAboveThreshold > 0) {
                                    titleParts.push(`<span class="genie-time-range-display" style="color: #ef4444; font-weight: bold;">[Anomaly ${averageAboveThreshold.toFixed(2)}]</span>`);
                                }

                                // Add percentage and grouping key: [percent% key.metric > threshold]
                                if (groupingKeyDisplay || percentKpodsAboveThreshold > 0) {
                                    const percentStr = percentKpodsAboveThreshold.toFixed(1) + '%';
                                    let bracketContent = percentStr;
                                    if (groupingKeyDisplay) {
                                        bracketContent += ` ${groupingKeyDisplay}`;
                                    }
                                    bracketContent += ` > ${collapseThreshold}`;
                                    titleParts.push(`<span class="genie-time-range-display">[${bracketContent}]</span>`);
                                }

                                if (titleParts.length > 0) {
                                    titleEl.innerHTML = `${originalTitle} ${titleParts.join(' ')}`;
                                    console.log(`[Genie] Updated title for non-comparable panel "${panel.title || panel.id}": ${hasIncidents ? `[Incidents ${incidentCount}]` : ''}${averageAboveThreshold > 0 ? ` [Anomaly ${averageAboveThreshold.toFixed(2)}]` : ''}${percentKpodsAboveThreshold > 0 ? ` [${percentKpodsAboveThreshold.toFixed(1)}%` : ''}${groupingKeyDisplay ? ` ${groupingKeyDisplay}` : ''}${percentKpodsAboveThreshold > 0 ? ` > ${collapseThreshold}]` : ''}`);
                                } else {
                                    // No incidents or kpods data, restore original title
                                    titleEl.textContent = originalTitle;
                                }
                            } else if (hasIncidents || hasAnomalyScore) {
                                // Display incidents and/or anomaly score even if there's no change data (for comparable panels)
                                // Get original title and process placeholders
                                const rawOriginalTitle = panel._genieOriginalTitle || panel.title || '';
                                const originalTitle = this.replacePlaceholdersInText(rawOriginalTitle);

                                // Build bracket content: [incidents:x, anomaly:y] or [incidents:x] or [anomaly:y]
                                const bracketParts = [];

                                // Add incident count first (if present)
                                if (hasIncidents) {
                                    bracketParts.push(`incidents:${incidentCount}`);
                                }

                                // Add anomaly score second (if present)
                                if (hasAnomalyScore) {
                                    bracketParts.push(`anomaly:${anomalyScore.toFixed(2)}`);
                                }

                                // Use collapse threshold for color coding (same threshold used for collapse/expand)
                                const collapseThreshold = this.inputConfig?.genieAnomalyCollapseThreshold ||
                                    this.inputConfig?.genieAnomalyColorThreshold ||
                                    0.3;
                                // Color based on anomaly score if present, otherwise use default
                                let color = '#f59e0b'; // Default orange
                                if (hasAnomalyScore) {
                                    color = anomalyScore >= collapseThreshold ? '#ef4444' : '#f59e0b'; // Red if >= threshold, orange otherwise
                                }
                                titleEl.innerHTML = `${originalTitle} <span class="genie-time-range-display" style="color: ${color}; font-weight: bold;">[${bracketParts.join(', ')}]</span>`;
                                console.log(`[Genie] Updated title for panel "${panel.title || panel.id}": ${hasIncidents ? `incidents=${incidentCount}` : ''}${hasAnomalyScore ? `, anomalyScore=${anomalyScore.toFixed(2)}` : ''} displayed (no change data)`);
                            } else {
                                // No change data, no incidents, and no anomaly score, restore original title with placeholders processed
                                const rawOriginalTitle = panel._genieOriginalTitle || panel.title || '';
                                const originalTitle = this.replacePlaceholdersInText(rawOriginalTitle);
                                if (titleEl.textContent !== originalTitle && !titleEl.innerHTML.includes(originalTitle)) {
                                    titleEl.textContent = originalTitle;
                                }
                            }
                        }
                } else {
                    console.warn(`[Genie] Could not find title element for panel "${panel.title || panel.id}"`);
                }
            });

            // Mark panels to show independently based on their threshold status
            // Panels that meet threshold (panelsMetThresholdList) should be shown independently
            sortedPanels.forEach((item) => {
                const panel = item.panel;
                if (panel) {
                    const panelId = panel.id || `panel-${item.index}`;
                    const genieState = this._genieStateMap[panelId];
                    const isCollapsed = genieState ? genieState.isCollapsed : (item.div ? item.div.classList.contains('genie-panel-collapsed') : true);

                    // Mark expanded panels (those that meet threshold) to be shown independently
                    // This attribute will be used during rendering/positioning
                    if (!isCollapsed) {
                        panel._genieShowIndependently = true;
                        console.log(`[Genie] Panel ${item.index} (${panel.title || panel.id}) marked to show independently (meets threshold)`);
                    } else {
                        panel._genieShowIndependently = false;
                    }
                }
            });

            // Update _genieSortOrderArray with ALL panels (panelsMetThresholdList + remainingPanelsList) in sorted order
            // Row panels are already excluded (they were never added to allPanelsWithDivs)
            // This includes ALL panels from identifyPanelsForGenie
            this._genieSortOrderArray = sortedPanels
                .filter(item => item.panel !== null && item.panel.type !== 'row')
                .map(item => item.panel);

            console.log(`[Genie] Final panel separation: ${panelsMetThresholdListWithDivs.length} meet threshold (expanded), ${remainingPanelsListWithDivs.length} remaining (collapsed except parents/stat)`);

            // Prepare panels for positioning: set grid columns, ensure visibility, store original gridPos
            // Y positioning will be handled by recalculateAllYPositions() using the genie lists
            sortedPanels.forEach((item) => {
                const panel = item.panel;
                const panelDiv = item.div;
                if (!panel || !panelDiv) return;

                const panelId = panel.id || `panel-${item.index}`;
                const genieState = this._genieStateMap[panelId];
                const isCollapsed = genieState ? genieState.isCollapsed : 
                    (panelDiv.classList.contains('genie-panel-collapsed') || panelDiv.classList.contains('genie-row-panel-collapsed'));

                // Store original gridPos values before modifying (to restore later)
                const originalGridPos = panel.gridPos ? {
                    y: panel.gridPos.y,
                    x: panel.gridPos.x,
                    w: panel.gridPos.w,
                    h: panel.gridPos.h
                } : null;
                
                // Store original gridPos in _genieStateMap for restoration
                if (this._genieStateMap[panelId]) {
                    this._genieStateMap[panelId].originalGridPos = originalGridPos;
                }

                // Set grid column to full width (one panel per row) for non-row panels
                // Row panels should maintain their original styling
                const isRowPanel = panel && panel.type === 'row';
                if (!isRowPanel) {
                    panelDiv.style.gridColumn = '1 / -1';
                    panelDiv.style.setProperty('grid-column', '1 / -1', 'important');
                }

                // Update _genieStateMap with grid column info
                if (this._genieStateMap[panelId]) {
                    this._genieStateMap[panelId].gridX = 0;
                    this._genieStateMap[panelId].gridW = 12; // Full width
                }

                // Ensure panel is visible (not display:none) - it should be collapsed but visible
                panelDiv.style.display = '';
                panelDiv.style.visibility = '';

                // Verify panel is in correct collapsed state (header visible, content hidden)
                if (isCollapsed) {
                    const content = panel._contentElement || panelDiv.querySelector('.genie-dashboard-panel-content');
                    if (content) {
                        content.style.display = 'none';
                    }
                    // Ensure collapsed class is set
                    if (isRowPanel) {
                        panelDiv.classList.add('genie-row-panel-collapsed');
                    } else {
                        panelDiv.classList.add('genie-panel-collapsed');
                    }
                }
            });

            // Use modular recalculateAllYPositions() to handle ALL Y positioning consistently
            // This is the SAME approach used when parent is collapsed/expanded
            // recalculateAllYPositions will use _geniePanelsMetThresholdList and _genieRemainingPanelsList
            // to position panels in the correct order:
            // - panelsMetThresholdList first, starting at Y=0
            // - remainingPanelsList after them
            // - Independent children in remainingPanelsList are ignored
            console.log(`[Genie] Processing complete: ${panelsUpdated} panels updated, calling recalculateAllYPositions() for all ${sortedPanels.length} panels`);

            // Ensure controls row stays in place before recalculation
            this.ensureControlsRowPosition();

            // Use unified recalculation function for consistency - handles all panels (children and standalone)
            // This will use the genie lists to position panels correctly, same as when parent is collapsed/expanded
            const panelCount = this.recalculateAllYPositions(false);

            // Update _genieStateMap with final Y positions after recalculation
            sortedPanels.forEach((item) => {
                const panel = item.panel;
                const panelDiv = item.div;

                if (panel && panelDiv) {
                    // Get final Y position from DOM (accounting for controls row offset)
                    const gridRow = panelDiv.style.gridRow || window.getComputedStyle(panelDiv).gridRow;
                    let finalY = undefined;
                    if (gridRow && gridRow.includes('/')) {
                        const match = gridRow.match(/(\d+)\s*\/\s*\d+/);
                        if (match) {
                            const gridRowStart = parseInt(match[1]);
                            const controlsRowOffset = 1; // Controls row takes 1 row
                            finalY = gridRowStart - 1 - controlsRowOffset; // Subtract 1 for 0-based, subtract controls row
                        }
                    }

                    // Update _genieStateMap with final Y position
                    const panelId = panel.id || `panel-${item.index}`;
                    if (this._genieStateMap[panelId]) {
                        this._genieStateMap[panelId].y = finalY !== undefined ? finalY : this._genieStateMap[panelId].y;
                    }

                    // Set grid column to full width (one panel per row) for ALL panels EXCEPT row panels
                    // Row panels should maintain their original styling and background
                    const isRowPanel = panel && panel.type === 'row';
                    if (!isRowPanel) {
                        panelDiv.style.gridColumn = '1 / -1';
                        panelDiv.style.setProperty('grid-column', '1 / -1', 'important');
                    }

                    // NOTE: Do NOT update panel.gridPos in genie view - keep original state untouched
                    // Only update _genieStateMap for genie view state
                }
            });

            console.log(`[Genie] _genieStateMap populated with ${Object.keys(this._genieStateMap).length} panels`);
            console.log(`[Genie] _genieSortOrderArray contains ${this._genieSortOrderArray.length} panels`);

            // Ensure controls row stays in place after recalculation
            this.ensureControlsRowPosition();

            console.log(`[Genie] Dashboard reordered: ${sortedPanels.length} panels processed, ${panelsUpdated} panels updated, ${panelCount} panels repositioned (all full width, one per row)`);
            const renderDuration = performance.now() - renderStartTime;
            console.log(`[Genie Performance] Render completed: ${renderDuration.toFixed(2)}ms`);
            if (this.performanceMetrics && this.performanceMetrics.render) {
                this.performanceMetrics.render.end = performance.now();
                this.performanceMetrics.render.duration = this.performanceMetrics.render.end - this.performanceMetrics.render.start;
                console.log(`[Genie Performance] Final render duration: ${this.performanceMetrics.render.duration.toFixed(2)}ms`);
                this.performanceMetrics.total.end = performance.now();
                this.performanceMetrics.total.duration = this.performanceMetrics.total.end - this.performanceMetrics.total.start;
                console.log(`[Genie Performance] ========================================`);
                console.log(`[Genie Performance] Genie Check Action Performance Metrics:`);
                console.log(`[Genie Performance]   Total Duration: ${this.performanceMetrics.total.duration.toFixed(2)}ms`);
                console.log(`[Genie Performance]   Data Fetch: ${this.performanceMetrics.dataFetch.duration.toFixed(2)}ms (${((this.performanceMetrics.dataFetch.duration / this.performanceMetrics.total.duration) * 100).toFixed(1)}%)`);
                console.log(`[Genie Performance]   Anomaly API: ${this.performanceMetrics.anomalyApi.duration.toFixed(2)}ms (${((this.performanceMetrics.anomalyApi.duration / this.performanceMetrics.total.duration) * 100).toFixed(1)}%)`);
                console.log(`[Genie Performance]   Render: ${this.performanceMetrics.render.duration.toFixed(2)}ms (${((this.performanceMetrics.render.duration / this.performanceMetrics.total.duration) * 100).toFixed(1)}%)`);
                console.log(`[Genie Performance]   Time between fetch and API: ${(this.performanceMetrics.anomalyApi.start - this.performanceMetrics.dataFetch.end).toFixed(2)}ms`);
                console.log(`[Genie Performance]   Time between API and render: ${(this.performanceMetrics.render.start - this.performanceMetrics.anomalyApi.end).toFixed(2)}ms`);
                console.log(`[Genie Performance] ========================================`);
            }
        }

    }

    // Apply mixin to GenieDashboard prototype when available
    function tryApplyMixin() {
        if (typeof GenieDashboard !== 'undefined' && GenieDashboard.prototype) {
            applyGenieCheckHandler(GenieDashboard.prototype);
            console.log('[Genie] Applied genie check handler mixin to GenieDashboard (immediate)');
            return true;
        } else if (typeof window !== 'undefined' && window.GenieDashboard && window.GenieDashboard.prototype) {
            applyGenieCheckHandler(window.GenieDashboard.prototype);
            console.log('[Genie] Applied genie check handler mixin to GenieDashboard (from window)');
            return true;
        }
        return false;
    }

    // Try to apply immediately
    if (!tryApplyMixin()) {
        // Store for later application (when genieDashboard.js loads)
        window._applyGenieCheckHandler = applyGenieCheckHandler;
        
        // Also try after short delays in case of race conditions
        if (typeof window !== 'undefined' && window.setTimeout) {
            // Try multiple times with increasing delays
            [100, 500, 1000].forEach((delay, index) => {
                setTimeout(function () {
                    if (tryApplyMixin()) {
                        console.log(`[Genie] Applied genie check handler mixin to GenieDashboard (delayed attempt ${index + 1})`);
                    } else if (index === 2 && typeof window._applyGenieCheckHandler === 'function') {
                        console.log('[Genie] GenieDashboard not available after multiple attempts, mixin will be applied when GenieDashboard is defined');
            }
                }, delay);
            });
        }
    }

    // Also set up a mechanism to apply mixin when GenieDashboard becomes available
    // This handles cases where genieDashboard.js loads after genieCheckHandler.js
    if (typeof window !== 'undefined' && !window.GenieDashboard) {
        // Use Object.defineProperty to intercept GenieDashboard assignment only if not already defined
        let originalGenieDashboard = undefined;
        try {
            Object.defineProperty(window, 'GenieDashboard', {
                get: function () {
                    return originalGenieDashboard;
                },
                set: function (value) {
                    originalGenieDashboard = value;
                    if (value && value.prototype && typeof window._applyGenieCheckHandler === 'function') {
                        window._applyGenieCheckHandler(value.prototype);
                        console.log('[Genie] Applied genie check handler mixin to GenieDashboard (via property setter)');
                    }
                },
                configurable: true,
                enumerable: true
            });
        } catch (e) {
            // If property is not configurable, fall back to storing the function
            console.warn('[Genie] Could not set up GenieDashboard property setter:', e);
        }
    }

})();

