/**
 * Tooltip Legend Module
 * Modular functions for creating and managing tooltip legends in GenieDashboard
 * 
 * This module provides reusable functions for:
 * - Creating eye icons with visibility toggle
 * - Creating legend items
 * - Creating popup windows
 * - Setting up event handlers
 * - Updating positions and dimensions
 */

(function() {
    'use strict';

    /**
     * Create an eye icon for tooltip legend with visibility toggle functionality
     * @param {Object} config - Configuration object
     * @param {Object} config.chart - Chart instance
     * @param {number} config.originalIndex - Original dataset index
     * @param {Object} config.dashboard - Dashboard instance
     * @param {string} config.panelId - Panel ID
     * @param {Function} config.onToggle - Callback when visibility is toggled
     * @returns {HTMLElement} Eye icon element
     */
    function createTooltipLegendEyeIcon(config) {
        const { chart, originalIndex, dashboard, panelId, onToggle } = config;
        
        const eyeIcon = document.createElement('div');
        eyeIcon.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `;
        eyeIcon.style.cssText = `
            width: 14px;
            height: 14px;
            margin-left: 6px;
            cursor: pointer;
            flex-shrink: 0;
            color: #6b7280;
            opacity: 0.7;
            display: flex;
            align-items: center;
            justify-content: center;
        `.replace(/\s+/g, ' ').trim();

        // Function to update eye icon state based on series visibility
        const updateEyeIconState = (isVisible) => {
            const svg = eyeIcon.querySelector('svg');
            if (svg) {
                if (isVisible) {
                    svg.setAttribute('fill', 'none');
                    svg.setAttribute('stroke', 'currentColor');
                    eyeIcon.style.color = '#3b82f6';
                    eyeIcon.style.opacity = '1';
                } else {
                    svg.setAttribute('fill', 'none');
                    svg.setAttribute('stroke', 'currentColor');
                    eyeIcon.style.color = '#6b7280';
                    eyeIcon.style.opacity = '0.7';
                }
            }
        };

        // Set initial state
        try {
            const currentChart = dashboard.charts?.[panelId] || chart;
            if (currentChart) {
                const meta = currentChart.getDatasetMeta(originalIndex);
                if (meta) {
                    updateEyeIconState(!meta.hidden);
                }
            }
        } catch (error) {
            updateEyeIconState(true);
        }

        // Hover effect
        eyeIcon.addEventListener('mouseenter', () => {
            eyeIcon.style.opacity = '1';
            if (eyeIcon.style.color !== '#3b82f6') {
                eyeIcon.style.color = '#3b82f6';
            }
        });
        eyeIcon.addEventListener('mouseleave', () => {
            try {
                const currentChart = dashboard.charts?.[panelId] || chart;
                if (currentChart) {
                    const meta = currentChart.getDatasetMeta(originalIndex);
                    if (meta) {
                        updateEyeIconState(!meta.hidden);
                    }
                }
            } catch (error) {
                eyeIcon.style.opacity = '0.7';
                eyeIcon.style.color = '#6b7280';
            }
        });

        // Click handler
        eyeIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (onToggle) {
                onToggle(updateEyeIconState);
            }
        });

        // Store update function on element for external updates
        eyeIcon._updateState = updateEyeIconState;
        
        return eyeIcon;
    }

    /**
     * Create a single legend item for the tooltip popup
     * @param {Object} config - Configuration object
     * @param {Object} config.dataset - Dataset object
     * @param {number} config.originalIndex - Original dataset index
     * @param {number} config.sortedIndex - Sorted index in popup
     * @param {Object} config.chart - Chart instance
     * @param {Object} config.dashboard - Dashboard instance
     * @param {string} config.panelId - Panel ID
     * @param {Function} config.createEyeIcon - Function to create eye icon
     * @returns {HTMLElement} Legend item element
     */
    function createTooltipLegendItem(config) {
        const { dataset, originalIndex, sortedIndex, chart, dashboard, panelId, createEyeIcon } = config;
        
        const legendItem = document.createElement('div');
        legendItem.className = 'genie-legend-item';
        legendItem.style.cssText = `
            display: flex;
            align-items: center;
            padding: 2px 8px;
            cursor: pointer;
            pointer-events: auto;
        `.replace(/\s+/g, ' ').trim();

        // Color indicator
        const itemColorBox = document.createElement('div');
        itemColorBox.style.cssText = `
            width: 10px;
            height: 10px;
            background: ${dataset.borderColor || dataset.backgroundColor || '#3b82f6'};
            margin-right: 6px;
            border-radius: 2px;
            flex-shrink: 0;
        `.replace(/\s+/g, ' ').trim();

        // Label text
        const itemLabel = document.createElement('span');
        itemLabel.textContent = dataset.label || `Series ${sortedIndex + 1}`;
        itemLabel.style.cssText = `
            font-size: 12px;
            color: #374151;
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        `.replace(/\s+/g, ' ').trim();

        // Eye icon
        const eyeIcon = createEyeIcon({
            chart,
            originalIndex,
            dashboard,
            panelId,
            onToggle: (updateEyeIconState) => {
                const currentChart = dashboard.charts?.[panelId] || chart;
                if (!currentChart || !currentChart.canvas || typeof currentChart.getDatasetMeta !== 'function') {
                    return;
                }

                try {
                    // Toggle all other series
                    const allDatasets = currentChart.data.datasets || [];
                    allDatasets.forEach((ds, idx) => {
                        if (idx !== originalIndex) {
                            const meta = currentChart.getDatasetMeta(idx);
                            if (meta) {
                                meta.hidden = !meta.hidden;
                            }
                        }
                    });

                    // Update all legend items
                    const legendList = legendItem.closest('.genie-legend-list');
                    if (legendList) {
                        const allItems = legendList.querySelectorAll('.genie-legend-item');
                        allItems.forEach((item, idx) => {
                            const itemOriginalIndex = item._originalIndex;
                            if (itemOriginalIndex !== undefined) {
                                const meta = currentChart.getDatasetMeta(itemOriginalIndex);
                                if (meta) {
                                    const isHidden = meta.hidden;
                                    item.style.opacity = isHidden ? '0.5' : '1';
                                    const colorBox = item.querySelector('div:first-child');
                                    const label = item.querySelector('span');
                                    if (colorBox) colorBox.style.opacity = isHidden ? '0.5' : '1';
                                    if (label) label.style.opacity = isHidden ? '0.5' : '1';
                                    
                                    const itemEyeIcon = item.querySelector('div:last-child');
                                    if (itemEyeIcon && itemEyeIcon._updateState) {
                                        itemEyeIcon._updateState(!isHidden);
                                    }
                                }
                            }
                        });
                    }

                    // Update visible item if exists
                    const visibleItem = legendItem.closest('.genie-legend-tooltip-container')?.querySelector('.genie-legend-tooltip-item');
                    if (visibleItem) {
                        const visibleMeta = currentChart.getDatasetMeta(visibleItem._originalIndex);
                        if (visibleMeta) {
                            visibleItem.style.opacity = visibleMeta.hidden ? '0.5' : '1';
                            const visibleColorBox = visibleItem.querySelector('div:first-child');
                            const visibleLabel = visibleItem.querySelector('span');
                            if (visibleColorBox) visibleColorBox.style.opacity = visibleMeta.hidden ? '0.5' : '1';
                            if (visibleLabel) visibleLabel.style.opacity = visibleMeta.hidden ? '0.5' : '1';
                            
                            const visibleEyeIcon = visibleItem.querySelector('div:last-child');
                            if (visibleEyeIcon && visibleEyeIcon._updateState) {
                                visibleEyeIcon._updateState(!visibleMeta.hidden);
                            }
                        }
                    }

                    currentChart.update();
                } catch (error) {
                    console.error('Error toggling series visibility:', error);
                }
            }
        });

        legendItem.appendChild(itemColorBox);
        legendItem.appendChild(itemLabel);
        legendItem.appendChild(eyeIcon);
        legendItem._originalIndex = originalIndex;

        // Set initial visual state
        try {
            const currentChart = dashboard.charts?.[panelId] || chart;
            if (currentChart) {
                const meta = currentChart.getDatasetMeta(originalIndex);
                if (meta && meta.hidden) {
                    legendItem.style.opacity = '0.5';
                    itemColorBox.style.opacity = '0.5';
                    itemLabel.style.opacity = '0.5';
                }
            }
        } catch (error) {
            // Ignore errors
        }

        // Click handler to toggle series
        legendItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const currentChart = dashboard.charts?.[panelId] || chart;
            if (!currentChart || !currentChart.canvas || typeof currentChart.getDatasetMeta !== 'function') {
                return;
            }

            try {
                const meta = currentChart.getDatasetMeta(originalIndex);
                if (meta) {
                    meta.hidden = !meta.hidden;
                    currentChart.update();

                    // Update visual state
                    const isHidden = meta.hidden;
                    legendItem.style.opacity = isHidden ? '0.5' : '1';
                    itemColorBox.style.opacity = isHidden ? '0.5' : '1';
                    itemLabel.style.opacity = isHidden ? '0.5' : '1';
                    
                    if (eyeIcon._updateState) {
                        eyeIcon._updateState(!isHidden);
                    }
                }
            } catch (error) {
                console.error('Error toggling series visibility:', error);
            }
        });

        // Hover effect
        legendItem.addEventListener('mouseenter', () => {
            legendItem.style.backgroundColor = '#f3f4f6';
        });
        legendItem.addEventListener('mouseleave', () => {
            legendItem.style.backgroundColor = 'transparent';
        });

        return legendItem;
    }

    /**
     * Create the tooltip legend popup window with all legend items
     * @param {Object} config - Configuration object
     * @param {Array} config.datasetsWithIndex - Array of datasets with indices
     * @param {Object} config.chart - Chart instance
     * @param {Object} config.dashboard - Dashboard instance
     * @param {string} config.panelId - Panel ID
     * @param {HTMLElement} config.panelElement - Panel element
     * @param {number} config.chartWidth - Chart width for max-width
     * @param {number} config.popupMaxHeight - Max height for popup
     * @param {Function} config.createLegendItem - Function to create legend item
     * @returns {HTMLElement} Popup container element
     */
    function createTooltipLegendPopup(config) {
        const { datasetsWithIndex, chart, dashboard, panelId, panelElement, chartWidth, popupMaxHeight, createLegendItem } = config;
        
        // Create popup container
        const popupContainer = document.createElement('div');
        popupContainer.className = 'genie-legend-tooltip-popup';
        popupContainer.style.cssText = `
            display: none;
            position: absolute;
            top: 0;
            left: 0;
            background: white;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            z-index: 1000;
            max-width: ${chartWidth}px;
            max-height: ${popupMaxHeight}px;
            overflow-y: auto;
            overflow-x: hidden;
            pointer-events: auto;
        `.replace(/\s+/g, ' ').trim();

        // Create scrollable list
        const legendList = document.createElement('div');
        legendList.className = 'genie-legend-list';
        legendList.style.cssText = `
            padding: 2px 0;
            max-height: ${popupMaxHeight}px;
            overflow-y: auto;
            overflow-x: hidden;
            pointer-events: auto;
        `.replace(/\s+/g, ' ').trim();

        // Create all legend items
        datasetsWithIndex.forEach((item, sortedIndex) => {
            const legendItem = createLegendItem({
                dataset: item.dataset,
                originalIndex: item.originalIndex,
                sortedIndex,
                chart,
                dashboard,
                panelId
            });
            legendList.appendChild(legendItem);
        });

        popupContainer.appendChild(legendList);
        return popupContainer;
    }

    /**
     * Create the visible tooltip legend item (first dataset shown)
     * @param {Object} config - Configuration object
     * @param {Object} config.firstDataset - First dataset object
     * @param {number} config.originalIndex - Original dataset index
     * @param {Object} config.chart - Chart instance
     * @param {Object} config.dashboard - Dashboard instance
     * @param {string} config.panelId - Panel ID
     * @param {HTMLElement} config.panelElement - Panel element
     * @param {Array} config.datasetsWithIndex - All datasets with indices (for toggle all functionality)
     * @param {Function} config.createEyeIcon - Function to create eye icon
     * @returns {Object} Object with visibleItem, colorBox, label, and visibleEyeIcon
     */
    function createTooltipLegendVisibleItem(config) {
        const { firstDataset, originalIndex, chart, dashboard, panelId, panelElement, datasetsWithIndex, createEyeIcon } = config;
        
        const visibleItem = document.createElement('div');
        visibleItem.className = 'genie-legend-tooltip-item';
        visibleItem.style.cssText = `
            display: flex;
            align-items: center;
            padding: 4px 8px;
            background: rgba(255, 255, 255, 0.9);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            user-select: none;
        `.replace(/\s+/g, ' ').trim();
        visibleItem._originalIndex = originalIndex;

        // Color indicator
        const colorBox = document.createElement('div');
        colorBox.style.cssText = `
            width: 10px;
            height: 10px;
            background: ${firstDataset.borderColor || firstDataset.backgroundColor || '#3b82f6'};
            margin-right: 6px;
            border-radius: 2px;
            flex-shrink: 0;
        `.replace(/\s+/g, ' ').trim();

        // Label text
        const label = document.createElement('span');
        label.textContent = firstDataset.label || 'Series 1';
        label.style.cssText = `
            font-size: 12px;
            color: #374151;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 200px;
        `.replace(/\s+/g, ' ').trim();

        // Eye icon
        const visibleEyeIcon = createEyeIcon({
            chart,
            originalIndex,
            dashboard,
            panelId,
            onToggle: (updateVisibleEyeIconState) => {
                const currentChart = dashboard.charts?.[panelId] || chart;
                if (!currentChart || !currentChart.canvas || typeof currentChart.getDatasetMeta !== 'function') {
                    return;
                }

                try {
                    // Toggle all other series
                    const allDatasets = currentChart.data.datasets || [];
                    allDatasets.forEach((dataset, idx) => {
                        if (idx !== originalIndex) {
                            const meta = currentChart.getDatasetMeta(idx);
                            if (meta) {
                                meta.hidden = !meta.hidden;
                            }
                        }
                    });

                    // Update all legend items in popup
                    const foundPopupContainer = panelElement?.querySelector('.genie-legend-tooltip-popup');
                    if (foundPopupContainer) {
                        const popupLegendList = foundPopupContainer.querySelector('.genie-legend-list');
                        if (popupLegendList) {
                            const allLegendItems = popupLegendList.querySelectorAll('.genie-legend-item');
                            allLegendItems.forEach((item, idx) => {
                                const itemOriginalIndex = datasetsWithIndex[idx]?.originalIndex;
                                if (itemOriginalIndex !== undefined) {
                                    const meta = currentChart.getDatasetMeta(itemOriginalIndex);
                                    if (meta) {
                                        const isHidden = meta.hidden;
                                        item.style.opacity = isHidden ? '0.5' : '1';
                                        const colorBox = item.querySelector('div:first-child');
                                        const label = item.querySelector('span');
                                        if (colorBox) colorBox.style.opacity = isHidden ? '0.5' : '1';
                                        if (label) label.style.opacity = isHidden ? '0.5' : '1';
                                        
                                        const itemEyeIcon = item.querySelector('div:last-child');
                                        if (itemEyeIcon && itemEyeIcon._updateState) {
                                            itemEyeIcon._updateState(!isHidden);
                                        }
                                    }
                                }
                            });
                        }
                    }

                    // Update visible item state
                    const visibleMeta = currentChart.getDatasetMeta(originalIndex);
                    if (visibleMeta) {
                        const isHidden = visibleMeta.hidden;
                        visibleItem.style.opacity = isHidden ? '0.5' : '1';
                        colorBox.style.opacity = isHidden ? '0.5' : '1';
                        label.style.opacity = isHidden ? '0.5' : '1';
                        updateVisibleEyeIconState(!isHidden);
                    }

                    currentChart.update();
                } catch (error) {
                    console.error('Error showing only this series:', error);
                }
            }
        });

        visibleItem.appendChild(colorBox);
        visibleItem.appendChild(label);
        visibleItem.appendChild(visibleEyeIcon);

        // Set initial visual state
        try {
            const currentChart = dashboard.charts?.[panelId] || chart;
            if (currentChart) {
                const meta = currentChart.getDatasetMeta(originalIndex);
                if (meta && meta.hidden) {
                    visibleItem.style.opacity = '0.5';
                    colorBox.style.opacity = '0.5';
                    label.style.opacity = '0.5';
                }
            }
        } catch (error) {
            // Ignore errors
        }

        // Click handler to toggle first series
        visibleItem.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();

            const currentChart = dashboard.charts?.[panelId] || chart;
            if (!currentChart || !currentChart.canvas || typeof currentChart.getDatasetMeta !== 'function') {
                return;
            }

            try {
                const meta = currentChart.getDatasetMeta(originalIndex);
                if (meta) {
                    meta.hidden = !meta.hidden;
                    currentChart.update();

                    // Update visual state
                    const isHidden = meta.hidden;
                    visibleItem.style.opacity = isHidden ? '0.5' : '1';
                    colorBox.style.opacity = isHidden ? '0.5' : '1';
                    label.style.opacity = isHidden ? '0.5' : '1';
                    
                    if (visibleEyeIcon._updateState) {
                        visibleEyeIcon._updateState(!isHidden);
                    }
                }
            } catch (error) {
                console.error('Error toggling series visibility:', error);
            }
        });

        return { visibleItem, colorBox, label, visibleEyeIcon };
    }

    /**
     * Setup event handlers for tooltip legend (hover, click, etc.)
     * @param {Object} config - Configuration object
     * @param {HTMLElement} config.visibleItem - Visible legend item
     * @param {HTMLElement} config.popupContainer - Popup container
     * @param {HTMLElement} config.legendContainer - Legend container
     * @param {HTMLElement} config.legendList - Legend list inside popup
     */
    function setupTooltipLegendHandlers(config) {
        const { visibleItem, popupContainer, legendContainer, legendList } = config;
        
        let hoverTimeout = null;
        let isClicking = false;

        // Show popup on hover
        visibleItem.addEventListener('mouseenter', () => {
            if (hoverTimeout) clearTimeout(hoverTimeout);
            popupContainer.style.display = 'block';
        });

        // Hide popup on mouse leave (with delay)
        visibleItem.addEventListener('mouseleave', () => {
            if (!isClicking) {
                hoverTimeout = setTimeout(() => {
                    popupContainer.style.display = 'none';
                }, 100);
            }
        });

        // Keep popup open when hovering over it
        popupContainer.addEventListener('mouseenter', () => {
            if (hoverTimeout) clearTimeout(hoverTimeout);
        });

        // Hide popup when leaving popup
        popupContainer.addEventListener('mouseleave', (e) => {
            if (!isClicking && (!e.relatedTarget || !legendList.contains(e.relatedTarget))) {
                popupContainer.style.display = 'none';
            }
        });

        // Keep popup open when clicking
        legendList.addEventListener('mousedown', () => {
            isClicking = true;
            if (hoverTimeout) clearTimeout(hoverTimeout);
        });

        legendList.addEventListener('mouseup', () => {
            setTimeout(() => {
                isClicking = false;
            }, 100);
        });
    }

    /**
     * Update tooltip legend position based on chart Y-axis
     * @param {Object} config - Configuration object
     * @param {HTMLElement} config.legendContainer - Legend container
     * @param {Object} config.chart - Chart instance
     * @param {Object} config.dashboard - Dashboard instance
     * @param {string} config.panelId - Panel ID
     */
    function updateTooltipLegendPosition(config) {
        const { legendContainer, chart, dashboard, panelId } = config;
        
        try {
            const currentChart = dashboard.charts?.[panelId] || chart;
            if (currentChart && currentChart.chartArea) {
                const leftOffset = currentChart.chartArea.left || 0;
                legendContainer.style.left = leftOffset + 'px';
                legendContainer.style.display = 'flex';
            } else {
                legendContainer.style.left = '0px';
            }
        } catch (error) {
            legendContainer.style.left = '0px';
        }
    }

    /**
     * Update tooltip legend popup dimensions based on chart size
     * @param {Object} config - Configuration object
     * @param {HTMLElement} config.popupContainer - Popup container
     * @param {HTMLElement} config.legendList - Legend list
     * @param {HTMLElement} config.legendContainer - Legend container
     * @param {Object} config.chart - Chart instance
     * @param {Object} config.dashboard - Dashboard instance
     * @param {string} config.panelId - Panel ID
     * @param {HTMLElement} config.panelElement - Panel element
     */
    function updateTooltipLegendPopupDimensions(config) {
        const { popupContainer, legendList, legendContainer, chart, dashboard, panelId, panelElement } = config;
        
        try {
            const currentChart = dashboard.charts?.[panelId] || chart;
            let newChartHeight = 300;
            let newChartWidth = 400;
            
            if (currentChart && currentChart.chartArea) {
                newChartHeight = currentChart.chartArea.height || 300;
                newChartWidth = currentChart.chartArea.width || 400;
            } else if (currentChart && currentChart.canvas) {
                newChartHeight = currentChart.canvas.height || 300;
                newChartWidth = currentChart.canvas.width || 400;
            }
            
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

            const legendContainerHeight = legendContainer ? (legendContainer.offsetHeight || 0) : 0;
            const popupMaxHeight = newChartHeight + legendContainerHeight;

            if (popupContainer) {
                popupContainer.style.maxHeight = popupMaxHeight + 'px';
                popupContainer.style.maxWidth = newChartWidth + 'px';
            }
            if (legendList) {
                legendList.style.maxHeight = popupMaxHeight + 'px';
            }
        } catch (error) {
            console.warn('[TooltipLegend] Error updating popup dimensions:', error);
        }
    }

    // Export functions to window.TooltipLegend if GenieDashboard class exists
    if (typeof window !== 'undefined') {
        window.TooltipLegend = {
            createEyeIcon: createTooltipLegendEyeIcon,
            createItem: createTooltipLegendItem,
            createPopup: createTooltipLegendPopup,
            createVisibleItem: createTooltipLegendVisibleItem,
            setupHandlers: setupTooltipLegendHandlers,
            updatePosition: updateTooltipLegendPosition,
            updateDimensions: updateTooltipLegendPopupDimensions
        };
    }
})();



