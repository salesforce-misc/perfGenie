// TimeSeriesChart Component - Self-contained with all controls
class TimeSeriesChart {
    constructor(containerId, options = {}) {
        // Check if required libraries are loaded
        if (typeof d3 === 'undefined') {
            throw new Error('D3.js library is not loaded. Please include D3.js before this component.');
        }
        if (typeof c3 === 'undefined') {
            throw new Error('C3.js library is not loaded. Please include C3.js before this component.');
        }
        
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
            throw new Error('Container with ID \'' + containerId + '\' not found');
        }
        
        // Add the component class to the container
        this.container.className = 'timeseries-component-container';
        
        this.chart = null;
        this.data = null;
        this.timestamps = [];
        this.metrics = {};
        this.widthMultiplier = 1;
        this.heightMultiplier = 1;
        this.charts = []; // Array to store all chart instances
        this.chartIndex = 0; // Current chart index
        
        // Store data copies for recreation
        this.storedMainChartData = null;
        this.storedAdditionalChartsData = [];
        this.zoomRange = null; // Store current zoom range
        this.isDragging = false;
        this.dragStart = null;
        this.dragEnd = null;
        this.timeRangeMin = 0;
        this.timeRangeMax = 100;
        this.zoomUpdateTimeout = null;
        this.timeLabelUpdateTimeout = null;
        this.isUpdatingZoom = false;
        this.options = {
            height: 400,
            showLegend: true,
            showLegendText: true, // New option to control legend text visibility
            showCustomLegend: true, // New option to control custom legend div visibility
            showTooltip: true,
            showGrid: true,
            animate: true,
            ...options
        };
        
        this.timeSpanOptions = {
            '1min': 1 * 60 * 1000,
            '2min': 2 * 60 * 1000,
            '5min': 5 * 60 * 1000,
            '10min': 10 * 60 * 1000,
            '30min': 30 * 60 * 1000,
            '1hour': 60 * 60 * 1000,
            '6hour': 6 * 60 * 60 * 1000,
            '1day': 24 * 60 * 60 * 1000
        };
        
        this.aggregationFunctions = {
            average: this.average,
            sum: this.sum,
            max: this.max,
            min: this.min,
            count: this.count
        };
        
        this.colorPalette = [
            '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
            '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
        ];
        
        // Register this instance for cleanup
        if (!window.timeseriesComponentInstances) {
            window.timeseriesComponentInstances = {};
        }
        window.timeseriesComponentInstances[containerId] = this;
        
        this.init();
    }
    
    init() {
        this.addStyles();
        this.createContainer();
        this.setupEventListeners();
    }
    
    addStyles() {
        // Check if styles already added
        if (document.getElementById('timeseries-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'timeseries-styles';
        style.textContent = `
            .timeseries-component-container {
                width: auto;
                min-width: 300px;
                height: 0;
                min-height: 0;
                display: flex;
                flex-direction: column;
                font-family: Arial, sans-serif;
                overflow: visible;
                position: relative;
            }
            
            .timeseries-component-container.has-chart {
                height: auto;
                min-height: 200px;
            }
            
            
            .timeseries-component-close-btn {
                background: rgba(220, 53, 69, 0.8);
                color: white;
                border: none;
                border-radius: 3px;
                width: 20px;
                height: 20px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: 500;
                line-height: 1;
                transition: all 0.2s ease;
                margin: 0 4px;
                flex-shrink: 0;
            }
            
            .timeseries-component-close-btn:hover {
                background: rgba(220, 53, 69, 1);
                transform: scale(1.05);
            }
            
            .timeseries-component-close-btn:active {
                transform: scale(0.95);
            }
            
            .timeseries-component-zoom-reset-btn {
                background: rgba(40, 167, 69, 0.8);
                color: white;
                border: none;
                border-radius: 3px;
                width: 24px;
                height: 24px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: 500;
                line-height: 1;
                transition: all 0.2s ease;
                margin-left: 4px;
                flex-shrink: 0;
            }
            
            .timeseries-component-zoom-reset-btn:hover {
                background: rgba(40, 167, 69, 1);
                transform: scale(1.05);
            }
            
            .timeseries-component-zoom-reset-btn:active {
                transform: scale(0.95);
            }
            
            .timeseries-component-zoom-reset-icon {
                display: block;
                font-size: 12px;
                line-height: 1;
            }
            
            .timeseries-component-apply-btn {
                background: rgba(0, 123, 255, 0.8);
                color: white;
                border: none;
                border-radius: 3px;
                padding: 2px 8px;
                cursor: pointer;
                font-size: 10px;
                font-weight: 500;
                line-height: 1;
                transition: all 0.2s ease;
                margin: 0 4px;
                flex-shrink: 0;
            }
            
            .timeseries-component-apply-btn:hover {
                background: rgba(0, 123, 255, 1);
                transform: scale(1.02);
            }
            
            .timeseries-component-apply-btn:active {
                transform: scale(0.98);
            }
            
            .timeseries-component-reset-btn {
                background: rgba(40, 167, 69, 0.8);
                color: white;
                border: none;
                border-radius: 3px;
                padding: 2px 8px;
                cursor: pointer;
                font-size: 10px;
                font-weight: 500;
                line-height: 1;
                transition: all 0.2s ease;
                margin: 0 4px;
                flex-shrink: 0;
            }
            
            .timeseries-component-reset-btn:hover {
                background: rgba(40, 167, 69, 1);
                transform: scale(1.02);
            }
            
            .timeseries-component-reset-btn:active {
                transform: scale(0.98);
            }
            
            .timeseries-component-zoom-in-btn,
            .timeseries-component-zoom-out-btn {
                background: rgba(0, 123, 255, 0.8);
                color: white;
                border: none;
                border-radius: 3px;
                width: 24px;
                height: 24px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: bold;
                line-height: 1;
                transition: all 0.2s ease;
                margin-left: 4px;
                flex-shrink: 0;
            }
            
            .timeseries-component-zoom-in-btn:hover,
            .timeseries-component-zoom-out-btn:hover {
                background: rgba(0, 123, 255, 1);
                transform: scale(1.05);
            }
            
            .timeseries-component-zoom-in-btn:active,
            .timeseries-component-zoom-out-btn:active {
                transform: scale(0.95);
            }
            
            .timeseries-component-zoom-in-icon,
            .timeseries-component-zoom-out-icon {
                display: block;
                font-size: 14px;
                line-height: 1;
            }
            
            /* Time Range Slider */
            .timeseries-component-time-range-slider {
                display: flex;
                flex-direction: column;
                align-items: center;
                margin-left: 10px;
                min-width: 350px;
            }
            
            .timeseries-component-time-range-slider label {
                font-size: 12px;
                color: #666;
                margin-bottom: 5px;
            }
            
            .timeseries-component-slider-container {
                position: relative;
                width: 100%;
                height: 20px;
            }
            
            .timeseries-component-slider-track {
                position: absolute;
                top: 8px;
                left: 0;
                right: 0;
                height: 4px;
                background: #ddd;
                border-radius: 2px;
            }
            
            .timeseries-component-slider-range {
                position: absolute;
                top: 8px;
                height: 4px;
                background: #007bff;
                border-radius: 2px;
                pointer-events: none;
            }
            
            .timeseries-component-slider {
                position: absolute;
                width: 100%;
                height: 20px;
                background: transparent;
                outline: none;
                -webkit-appearance: none;
                appearance: none;
                cursor: pointer;
                margin: 0;
                padding: 0;
                pointer-events: none;
            }
            
            .timeseries-component-slider::-webkit-slider-track {
                background: transparent;
                height: 4px;
                border-radius: 2px;
            }
            
            .timeseries-component-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 18px;
                height: 18px;
                background: #007bff;
                border-radius: 50%;
                cursor: pointer;
                border: 3px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                pointer-events: all;
            }
            
            .timeseries-component-slider::-moz-range-track {
                background: transparent;
                height: 4px;
                border-radius: 2px;
                border: none;
            }
            
            .timeseries-component-slider::-moz-range-thumb {
                width: 18px;
                height: 18px;
                background: #007bff;
                border-radius: 50%;
                cursor: pointer;
                border: 3px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                pointer-events: all;
            }
            
            .timeseries-component-slider-min {
                z-index: 2;
            }
            
            .timeseries-component-slider-max {
                z-index: 1;
            }
            
            .timeseries-component-slider-max::-webkit-slider-thumb {
                background: #007bff;
            }
            
            .timeseries-component-slider-max::-moz-range-thumb {
                background: #007bff;
            }
            
            .timeseries-component-time-labels {
                display: flex;
                justify-content: space-between;
                align-items: center;
                width: 100%;
                font-size: 10px;
                color: #666;
            }
            
            .timeseries-component-time-min,
            .timeseries-component-time-max {
                min-width: 80px;
                text-align: center;
                flex-shrink: 0;
            }
            
            .timeseries-component-apply-btn,
            .timeseries-component-reset-btn {
                min-width: 50px;
                flex-shrink: 0;
            }
            
            
            /* Drag selection overlay */
            .timeseries-component-chart {
                cursor: crosshair;
                position: relative;
            }
            
            .timeseries-component-drag-overlay {
                position: absolute;
                background: rgba(0, 123, 255, 0.1);
                border: 2px solid rgba(0, 123, 255, 0.5);
                pointer-events: none;
                z-index: 10;
                display: none;
            }
            
            .timeseries-component-chart.dragging {
                cursor: grabbing;
            }
            
            /* Ensure subchart is visible */
            .c3-subchart {
                display: block !important;
                visibility: visible !important;
            }
            
            .c3-subchart .c3-axis {
                display: block !important;
            }
            
            .c3-subchart .c3-area {
                fill-opacity: 0.1 !important;
            }
            
            .timeseries-component-close-icon {
                display: block;
                font-size: 12px;
                line-height: 1;
                font-family: Arial, sans-serif;
                position: relative;
                z-index: 1;
            }
            
            .timeseries-component-controls {
                display: none;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
            }
            
            .timeseries-component-select {
                padding: 4px 6px;
                border: 1px solid #ddd;
                border-radius: 2px;
                background: #fff;
                font-size: 9px;
                color: #333;
                min-width: 120px;
                width: auto;
                height: 24px;
                cursor: pointer;
                transition: all 0.2s ease;
                appearance: none;
                white-space: nowrap;
                overflow: visible;
                background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
                background-repeat: no-repeat;
                background-position: right 4px center;
                background-size: 10px;
                padding-right: 20px;
                line-height: 1;
                display: flex;
                align-items: center;
                justify-content: flex-start;
            }
            
            .timeseries-component-select:hover {
                border-color: #0070d2;
                box-shadow: 0 0 3px rgba(0, 112, 210, 0.2);
            }
            
            .timeseries-component-select:focus {
                outline: none;
                border-color: #0070d2;
                box-shadow: 0 0 3px rgba(0, 112, 210, 0.3);
            }
            
            .timeseries-component-select option {
                padding: 2px 4px;
                background: #fff;
                color: #333;
                font-size: 9px;
                line-height: 1.2;
            }
            
            .timeseries-component-scroll-container {
                flex: 1;
                overflow-x: auto;
                overflow-y: hidden;
                width: 100%;
                position: relative;
            }
            
            .timeseries-component-chart {
                position: relative;
                width: 100%;
            }
            
            /* Force height to be applied with !important */
            .timeseries-component-chart[style*="height"] {
                height: var(--chart-height) !important;
                max-height: var(--chart-height) !important;
                min-height: var(--chart-height) !important;
            }
            
            /* Force height reduction class */
            .timeseries-component-chart.timeseries-component-height-reduced {
                height: var(--chart-height) !important;
                max-height: var(--chart-height) !important;
                min-height: var(--chart-height) !important;
                overflow: hidden !important;
            }
            
            .timeseries-component-loading {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 16px;
                color: #6c757d;
            }
            
            .timeseries-component-error {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: #dc3545;
            }
            
            .timeseries-component-legend {
                position: absolute;
                bottom: 10px;
                left: 10px;
                display: flex;
                gap: 15px;
                padding: 8px 12px;
                background: rgba(248, 249, 250, 0.95);
                border: 1px solid #dee2e6;
                border-radius: 4px;
                flex-wrap: wrap;
                max-width: calc(100% - 20px);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                backdrop-filter: blur(4px);
                z-index: 100;
            }
            
            .timeseries-component-legend-item {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .timeseries-component-legend-color {
                width: 12px;
                height: 12px;
                border-radius: 2px;
            }
            
            .timeseries-component-legend-text {
                font-size: 12px;
                color: #495057;
            }
            
            .c3-tooltip {
                border: 1px solid #dee2e6;
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                background: rgba(255, 255, 255, 0.95) !important;
                font-size: 12px;
            }
            
            .c3-tooltip th {
                background: #f8f9fa !important;
                font-weight: bold;
                padding: 8px 12px;
                color: #333 !important;
                font-size: 13px;
            }
            
            .c3-tooltip td {
                padding: 6px 12px;
                color: #333 !important;
            }
            
            .c3-tooltip .c3-tooltip-title {
                background: #e9ecef !important;
                color: #000 !important;
                font-weight: bold !important;
                font-size: 13px !important;
                padding: 8px 12px !important;
                border-bottom: 1px solid #dee2e6 !important;
            }
            
            /* Hide points when there are many data points */
            .timeseries-component-chart.timeseries-component-hide-points .c3-circle {
                display: none !important;
            }
            
            .timeseries-component-chart.timeseries-component-hide-points .c3-line {
                stroke-width: 1px;
            }
            
            /* Make all lines thinner */
            .timeseries-component-chart .c3-line {
                stroke-width: 1px !important;
            }
            
            /* Style x-axis grid lines for better visibility */
            .c3-grid .c3-xgrid-line {
                stroke: #e0e0e0;
                stroke-width: 1px;
                stroke-dasharray: 2,2;
            }
            
            /* Hide x-axis tick lines when there are many data points */
            .timeseries-component-chart.timeseries-component-hide-x-ticks .c3-axis-x .c3-tick line {
                display: none !important;
            }
            
            /* Labels are controlled directly by C3.js configuration */
            
            /* Legend overflow handling - more specific targeting */
            .timeseries-component-chart .c3-legend,
            .timeseries-component-chart .c3-legend-item,
            .timeseries-component-chart .c3-legend-item text {
                max-width: 100% !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
            }
            
            /* Force legend container to be scrollable and positioned at bottom-left */
            .timeseries-component-chart .c3-legend {
                max-height: 150px !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                padding: 8px !important;
                border: 1px solid #ddd !important;
                border-radius: 4px !important;
                background: #f8f9fa !important;
                position: absolute !important;
                bottom: 10px !important;
                left: 10px !important;
                width: auto !important;
                max-width: 300px !important;
                box-sizing: border-box !important;
                z-index: 10 !important;
                transform: translate(0, 0) !important;
            }
            
            /* Override C3.js legend positioning */
            .timeseries-component-chart .c3-legend-item {
                position: relative !important;
                float: left !important;
                margin: 2px 4px 2px 0 !important;
                white-space: nowrap !important;
                display: inline-block !important;
                max-width: calc(100% - 20px) !important;
            }
            
            
            /* Legend text truncation for very long names */
            .timeseries-component-chart .c3-legend-item text {
                max-width: 180px !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }
            
            /* Ensure chart container doesn't overflow */
            .timeseries-component-chart {
                overflow: hidden !important;
                position: relative !important;
                width: 100% !important;
                max-width: 100% !important;
            }
            
            /* Force C3 chart to respect container bounds */
            .timeseries-component-chart .c3 {
                width: 100% !important;
                max-width: 100% !important;
                overflow: hidden !important;
            }
            
            /* Additional legend containment */
            .c3-legend {
                max-width: 100% !important;
                word-wrap: break-word !important;
                word-break: break-all !important;
            }
            
            /* Legend toggle button */
            .timeseries-component-legend-toggle {
                position: absolute;
                top: 10px;
                right: 10px;
                background: #007bff;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
                z-index: 10;
            }
            
            .timeseries-component-legend-toggle:hover {
                background: #0056b3;
            }
            
            /* Hide legend when toggled off */
            .timeseries-component-chart.timeseries-component-legend-hidden .c3-legend {
                display: none !important;
            }
            
            /* Hide legend text when showLegendText is false */
            .timeseries-component-chart.timeseries-component-legend-no-text .c3-legend-item text {
                display: none !important;
            }
            
            /* Adjust legend item spacing when text is hidden */
            .timeseries-component-chart.timeseries-component-legend-no-text .c3-legend-item {
                margin-right: 8px !important;
            }
            
            /* Hide custom legend div when showCustomLegend is false */
            .timeseries-component-custom-legend-hidden .timeseries-component-legend {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    createContainer() {
        this.container.innerHTML = 
            '<div class="timeseries-component-controls">' +
                '<select id="' + this.containerId + '-timeSpan" class="timeseries-component-select">' +
                    '<option value="1min">1 Minute</option>' +
                    '<option value="2min">2 Minutes</option>' +
                    '<option value="5min">5 Minutes</option>' +
                    '<option value="10min">10 Minutes</option>' +
                    '<option value="30min">30 Minutes</option>' +
                    '<option value="1hour">1 Hour</option>' +
                    '<option value="6hour">6 Hours</option>' +
                    '<option value="1day">1 Day</option>' +
                '</select>' +
                '<select id="' + this.containerId + '-aggregation" class="timeseries-component-select">' +
                    '<option value="average">Average</option>' +
                    '<option value="sum">Sum</option>' +
                    '<option value="max">Maximum</option>' +
                    '<option value="min">Minimum</option>' +
                    '<option value="count">Count</option>' +
                '</select>' +
                '<select id="' + this.containerId + '-chartType" class="timeseries-component-select">' +
                    '<option value="line">Line Chart</option>' +
                    '<option value="area">Area Chart</option>' +
                    '<option value="bar">Bar Chart</option>' +
                '</select>' +
                '<select id="' + this.containerId + '-widthMultiplier" class="timeseries-component-select">' +
                    '<option value="1">1x Width</option>' +
                    '<option value="2">2x Width</option>' +
                    '<option value="5">5x Width</option>' +
                    '<option value="10">10x Width</option>' +
                    '<option value="20">20x Width</option>' +
                    '<option value="30">30x Width</option>' +
                '</select>' +
                '<select id="' + this.containerId + '-heightMultiplier" class="timeseries-component-select">' +
                    '<option value="1">1x Height</option>' +
                    '<option value="0.75">0.75x Height</option>' +
                    '<option value="0.5">0.5x Height</option>' +
                    '<option value="0.25">0.25x Height</option>' +
                '</select>' +
                '<div class="timeseries-component-time-range-slider">' +
                    '<div class="timeseries-component-slider-container" id="' + this.containerId + '-slider-container">' +
                        '<div class="timeseries-component-slider-track"></div>' +
                        '<div class="timeseries-component-slider-range" id="' + this.containerId + '-slider-range"></div>' +
                        '<input type="range" class="timeseries-component-slider timeseries-component-slider-min" min="0" max="100" value="0" oninput="window.timeseriesComponentUpdateSliderValue(\'' + this.containerId + '\', this.value, \'min\')">' +
                        '<input type="range" class="timeseries-component-slider timeseries-component-slider-max" min="0" max="100" value="100" oninput="window.timeseriesComponentUpdateSliderValue(\'' + this.containerId + '\', this.value, \'max\')">' +
                    '</div>' +
                    '<div class="timeseries-component-time-labels">' +
                        '<span class="timeseries-component-time-min" id="' + this.containerId + '-time-min">Start</span>' +
                        '<button class="timeseries-component-apply-btn" onclick="window.timeseriesComponentApplyTimeRange(\'' + this.containerId + '\')" title="Apply Time Range">Apply</button>' +
                        '<button class="timeseries-component-reset-btn" onclick="window.timeseriesComponentResetZoom(\'' + this.containerId + '\')" title="Reset Zoom">Reset</button>' +
                        '<span class="timeseries-component-time-max" id="' + this.containerId + '-time-max">End</span>' +
                    '</div>' +
                '</div>' +
                '<button class="timeseries-component-close-btn" onclick="window.timeseriesComponentCloseScrollContainer(\'' + this.containerId + '\')" title="Close Chart">' +
                    '<span class="timeseries-component-close-icon">&times;</span>' +
                '</button>' +
            '</div>' +
            '<div class="timeseries-component-scroll-container" id="' + this.containerId + '-scroll-container">' +
                '<div id="' + this.containerId + '-chart" class="timeseries-component-chart">' +
                    '<div class="timeseries-component-drag-overlay" id="' + this.containerId + '-drag-overlay"></div>' +
                    '<button class="timeseries-component-legend-toggle" onclick="window.timeseriesComponentToggleLegend(\'' + this.containerId + '\')">Toggle Legend</button>' +
                    '<div class="timeseries-component-loading">Loading chart...</div>' +
                    '<div id="' + this.containerId + '-legend" class="timeseries-component-legend" style="display: none;"></div>' +
                '</div>' +
            '</div>';
    }
    
    setupEventListeners() {
        document.getElementById(this.containerId + '-timeSpan').addEventListener('change', () => {
            this.updateChart();
        });
        
        document.getElementById(this.containerId + '-aggregation').addEventListener('change', () => {
            this.updateChart();
        });
        
        document.getElementById(this.containerId + '-chartType').addEventListener('change', () => {
            this.updateChart();
        });
        
        document.getElementById(this.containerId + '-widthMultiplier').addEventListener('change', () => {
            this.updateChartWidth();
        });
        
        document.getElementById(this.containerId + '-heightMultiplier').addEventListener('change', () => {
            this.updateChartHeight();
        });
        
        // Add drag-to-zoom functionality
        this.setupDragToZoom();
    }
    
    loadData(timestamps, metrics, chartTitle = null, colors = null) {
        console.log('loadData called with:', { timestamps, metrics, chartTitle, colors });
        this.timestamps = timestamps;
        this.metrics = metrics;
        this.chartTitle = chartTitle;
        this.chartColors = colors;
        
        // Add has-chart class to show container height
        this.container.classList.add('has-chart');
        
        // Show the controls section
        const controlsSection = this.container.querySelector('.timeseries-component-controls');
        if (controlsSection) {
            controlsSection.style.display = 'flex';
        }
        
        // Store data copy for recreation
        this.storedMainChartData = {
            timestamps: [...timestamps],
            metrics: JSON.parse(JSON.stringify(metrics)),
            title: chartTitle,
            colors: colors ? JSON.parse(JSON.stringify(colors)) : null
        };
        
        // Show the chart if it was hidden
        this.showChart();
        
        // Create the main chart
        this.updateMainChart();
    }
    
    addChart(timestamps, metrics, isMainChart = false, chartTitle = null, colors = null) {
        console.log('addChart called with:', { timestamps, metrics, isMainChart, chartTitle, colors });
        
        // Validate input data
        if (!Array.isArray(timestamps)) {
            console.error('Timestamps must be an array:', timestamps);
            return null;
        }
        
        if (!metrics || typeof metrics !== 'object') {
            console.error('Metrics must be an object:', metrics);
            return null;
        }
        
        // Validate that all metric values are arrays
        const invalidMetrics = Object.keys(metrics).filter(metricName => !Array.isArray(metrics[metricName]));
        if (invalidMetrics.length > 0) {
            console.error('The following metrics are not arrays:', invalidMetrics);
            console.error('Invalid metric details:', invalidMetrics.map(name => ({ name, value: metrics[name], type: typeof metrics[name] })));
            return null;
        }
        
        if (isMainChart) {
            // For main chart, destroy existing chart and create new one
            if (this.chart) {
                this.chart.destroy();
                this.chart = null;
            }
            
            // Show the chart if it was hidden
            this.showChart();
            
            // Create chart data object for main chart
            const chartData = {
                id: this.containerId + '-chart',
                timestamps: timestamps,
                metrics: metrics,
                chart: null,
                title: chartTitle,
                colors: colors
            };
            
            // Render the main chart using the same method as additional charts
            this.renderAdditionalChart(chartData);
            this.chart = chartData.chart; // Store reference to main chart
            
            return chartData;
        }
        
        // Create a new chart container
        const newChartId = this.containerId + '-chart-' + this.chartIndex;
        const chartContainer = document.createElement('div');
        chartContainer.id = newChartId;
        chartContainer.className = 'timeseries-component-chart';
        
        // Add loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'timeseries-component-loading';
        loadingDiv.textContent = 'Loading chart...';
        chartContainer.appendChild(loadingDiv);
        
        // Insert as sibling of the main chart within the same scroll container
        const existingChart = document.getElementById(this.containerId + '-chart');
        const scrollContainer = existingChart.parentElement;
        scrollContainer.appendChild(chartContainer);
        
        // Create chart data object
        const chartData = {
            id: newChartId,
            timestamps: timestamps,
            metrics: metrics,
            chart: null,
            title: chartTitle,
            colors: colors
        };
        
        // Store processed chart data for recreation (not raw data)
        const processedData = this.processChartData(timestamps, metrics, colors);
        const storedChartData = {
            id: newChartId,
            processedData: processedData,
            originalTimestamps: [...timestamps],
            originalMetrics: JSON.parse(JSON.stringify(metrics)),
            title: chartTitle,
            colors: colors ? JSON.parse(JSON.stringify(colors)) : null
        };
        this.storedAdditionalChartsData.push(storedChartData);
        
        // Add to charts array
        this.charts.push(chartData);
        this.chartIndex++;
        
        // Render the new chart
        this.renderAdditionalChart(chartData);
        
        // Apply current width multiplier to the new chart
        this.applyWidthToNewChart(chartData);
        
        return chartData;
    }
    
    updateChart() {
        console.log('updateChart called - updating all charts');
        if (!this.timestamps.length || !Object.keys(this.metrics).length) {
            console.error('No data available in updateChart');
            this.showError('No data available');
            return;
        }
        
        // Update main chart
        this.updateMainChart();
        
        // Update all additional charts
        this.charts.forEach(chartData => {
            this.updateAdditionalChart(chartData);
        });
    }
    
    updateMainChart() {
        console.log('updateMainChart called');
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        // Create chart data object for main chart
        const chartData = {
            id: this.containerId + '-chart',
            timestamps: this.timestamps,
            metrics: this.metrics,
            chart: null,
            title: this.chartTitle,
            colors: this.chartColors
        };
        
        // Render the main chart using the same method as additional charts
        this.renderAdditionalChart(chartData);
        this.chart = chartData.chart; // Store reference to main chart
        
        // Add title after chart is created
        setTimeout(() => {
            if (this.chartTitle && this.chart) {
                console.log('Adding title to updated main chart:', this.chartTitle);
                this.addChartTitle(this.chart, this.chartTitle);
            }
        }, 100);
    }
    
    updateAdditionalChart(chartData) {
        console.log('updateAdditionalChart called for:', chartData.id);
        if (chartData.chart) {
            chartData.chart.destroy();
            chartData.chart = null;
        }
        
        // Re-render the chart with current settings
        this.renderAdditionalChart(chartData);
    }
    
    processData() {
        const timeSpan = this.timeSpanOptions[document.getElementById(this.containerId + '-timeSpan').value];
        const aggregation = document.getElementById(this.containerId + '-aggregation').value;
        const aggregationFunc = this.aggregationFunctions[aggregation];
        
        // Group timestamps by time span
        const groupedData = this.groupByTimeSpan(this.timestamps, timeSpan);
        
        // Process each metric
        const processedMetrics = {};
        Object.keys(this.metrics).forEach(metricName => {
            const values = this.metrics[metricName];
            processedMetrics[metricName] = this.aggregateMetricValues(values, groupedData, aggregationFunc);
        });
        
        return {
            timestamps: Object.keys(groupedData).sort(),
            metrics: processedMetrics
        };
    }
    
    groupByTimeSpan(timestamps, timeSpan) {
        console.log('groupByTimeSpan called with:', { timestamps, timeSpan });
        console.log('Timestamps type:', typeof timestamps, 'IsArray:', Array.isArray(timestamps));
        console.log('Timestamps length:', timestamps ? timestamps.length : 'undefined');
        
        if (!Array.isArray(timestamps)) {
            console.error('groupByTimeSpan: timestamps is not an array:', timestamps);
            return {};
        }
        
        const groups = {};
        
        timestamps.forEach((timestamp, index) => {
            const time = new Date(timestamp);
            const groupKey = Math.floor(time.getTime() / timeSpan) * timeSpan;
            
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(index);
        });
        
        console.log('groupByTimeSpan result:', groups);
        return groups;
    }
    
    aggregateMetricValues(values, groupedData, aggregationFunc) {
        // Validate that values is an array
        if (!Array.isArray(values)) {
            console.error('aggregateMetricValues: values is not an array:', values);
            return {};
        }
        
        const aggregatedValues = {};
        
        Object.keys(groupedData).forEach(groupKey => {
            const indices = groupedData[groupKey];
            const groupValues = indices.map(index => values[index]).filter(v => v !== null && v !== undefined);
            
            if (groupValues.length > 0) {
                aggregatedValues[groupKey] = aggregationFunc(groupValues);
            }
        });
        
        return aggregatedValues;
    }
    
    renderChart(data) {
        // Check if D3 is available
        if (typeof d3 === 'undefined') {
            console.error('D3.js is not loaded');
            this.showError('D3.js library is not loaded');
            return;
        }
        
        // Always use the original data from this.timestamps and this.metrics
        console.log('renderChart: Using original data from this.timestamps and this.metrics');
        console.log('this.timestamps:', this.timestamps);
        console.log('this.metrics:', this.metrics);
        
        // Check if we have the required data
        if (!this.timestamps || !this.metrics) {
            console.error('Missing timestamps or metrics data');
            this.showError('No data available to render chart');
            return;
        }
        
        try {
            data = this.processChartData(this.timestamps, this.metrics, this.chartColors);
            if (!data) {
                this.showError('Failed to process chart data');
                return;
            }
            console.log('processChartData returned:', data);
            console.log('processChartData structure:', {
                hasData: !!(data && data.data),
                dataKeys: data ? Object.keys(data) : 'no data',
                dataDataKeys: (data && data.data) ? Object.keys(data.data) : 'no data.data'
            });
        } catch (error) {
            console.error('Error in processChartData:', error);
            this.showError('Error processing chart data: ' + error.message);
            return;
        }
        
        const chartType = document.getElementById(this.containerId + '-chartType').value;
        
        // Use current height multiplier for chart height
        const chartHeight = Math.round(this.options.height * this.heightMultiplier);
        console.log('renderChart: Using chart height:', chartHeight, 'heightMultiplier:', this.heightMultiplier);
        
        // Determine if we should show points and labels based on data size
        // Use the original data from this.timestamps and this.metrics
        const totalDataPoints = this.timestamps ? this.timestamps.length : 0;
        const totalSeries = this.metrics ? Object.keys(this.metrics).length : 0;
        const showPoints = totalDataPoints <= 50;
        // Show value labels only on bar charts when there are few data points
        const showValueLabels = totalDataPoints <= 20 && (chartType === 'bar');
        const showXAxisGrid = totalDataPoints <= 100;
        
        console.log('Rendering chart: ' + totalDataPoints + ' points, ' + totalSeries + ' series, ' + chartType + ' chart. Labels: ' + showValueLabels);
        
        // Add/remove CSS classes to control visibility
        const chartContainer = document.getElementById(this.containerId + '-chart');
        
        // Add visual indicator in the chart container
        if (chartContainer) {
            chartContainer.setAttribute('data-labels', showValueLabels);
            chartContainer.setAttribute('data-series', totalSeries);
            chartContainer.setAttribute('data-chart-type', chartType);
        }
        
        // Control point visibility
        if (showPoints) {
            chartContainer.classList.remove('hide-points');
        } else {
            chartContainer.classList.add('hide-points');
        }
        
        // Control x-axis tick visibility
        if (showXAxisGrid) {
            chartContainer.classList.remove('hide-x-ticks');
        } else {
            chartContainer.classList.add('hide-x-ticks');
        }
        
        // Destroy existing chart
        if (this.chart) {
            this.chart.destroy();
        }
        
        // Check if data has the expected structure
        console.log('Data structure check:', {
            data: data,
            hasData: !!data,
            hasDataData: !!(data && data.data),
            dataKeys: data ? Object.keys(data) : 'no data',
            dataDataKeys: (data && data.data) ? Object.keys(data.data) : 'no data.data'
        });
        
        if (!data || !data.data) {
            console.error('Invalid data structure in renderChart:', data);
            this.showError('Invalid chart data structure');
            return;
        }
        
        // Update the processed data with the same labeling logic as additional charts
        data.data.labels = showValueLabels ? {
            format: (v) => parseFloat(v).toFixed(2)
        } : false;
        
        data.point.show = showPoints;
        data.grid.x.show = this.options.showGrid && showXAxisGrid;
        // Use a reasonable tick count based on data points
        const tickCount = Math.min(12, Math.max(5, Math.floor(totalDataPoints / 1000)));
        data.axis.x.tick.count = tickCount;
        console.log('Setting x-axis tick count to:', tickCount, 'for', totalDataPoints, 'data points');
        
        // Override the size to use current height multiplier
        data.size = {
            width: this.getChartWidth(),
            height: chartHeight
        };
        
        // Validate data structure before passing to C3.js
        console.log('Data structure validation before C3.js:');
        console.log('data.data:', data.data);
        console.log('data.data.columns:', data.data.columns);
        console.log('data.data.columns isArray:', Array.isArray(data.data.columns));
        console.log('data.data.columns length:', data.data.columns ? data.data.columns.length : 'null/undefined');
        
        if (data.data.columns) {
            data.data.columns.forEach((col, i) => {
                console.log(`Column ${i}:`, {
                    isArray: Array.isArray(col),
                    length: col ? col.length : 'null/undefined',
                    firstElement: col ? col[0] : 'null/undefined',
                    type: typeof col
                });
            });
        }
        
        // Ensure columns is an array
        if (!Array.isArray(data.data.columns)) {
            console.error('data.data.columns is not an array:', data.data.columns);
            this.showError('Invalid chart data: columns must be an array');
            return;
        }
        
        // Validate each column is an array
        for (let i = 0; i < data.data.columns.length; i++) {
            if (!Array.isArray(data.data.columns[i])) {
                console.error(`Column ${i} is not an array:`, data.data.columns[i]);
                this.showError(`Invalid chart data: column ${i} must be an array`);
                return;
            }
        }
        
        // Create new chart using the EXACT same approach as additional charts
        this.chart = c3.generate({
            bindto: '#' + this.containerId + '-chart',
            data: data.data,
            axis: data.axis,
            grid: data.grid,
            point: data.point,
            tooltip: data.tooltip,
            legend: data.legend,
            color: data.color,
            size: data.size,
            padding: data.padding,
            subchart: {
                show: true,
                size: {
                    height: 60
                }
            },
            zoom: {
                enabled: true,
                rescale: true
            },
            onrendered: () => {
                // Add chart title using C3's internal SVG
                console.log('onrendered callback called, chartTitle:', this.chartTitle);
                if (this.chartTitle) {
                    console.log('Adding title to main chart:', this.chartTitle);
                    this.addChartTitle(this.chart, this.chartTitle);
                }
            }
        });
        
        // Debug: Check the actual computed styles after chart creation and position legend
        setTimeout(() => {
            const chartContainer = document.getElementById(this.containerId + '-chart');
            const legend = chartContainer.querySelector('.c3-legend');
            const xAxis = chartContainer.querySelector('.c3-axis-x');
            
            // Add chart title if provided
            console.log('setTimeout callback - chartTitle:', this.chartTitle, 'chart:', this.chart);
            if (this.chartTitle) {
                console.log('Adding title via setTimeout:', this.chartTitle);
                this.addChartTitle(this.chart, this.chartTitle);
            }
            
            // Force position legend at bottom-left
            if (legend) {
                legend.style.position = 'absolute';
                legend.style.bottom = '10px';
                legend.style.left = '10px';
                legend.style.transform = 'translate(0, 0)';
                legend.style.zIndex = '10';
                console.log('Legend positioned at bottom-left');
            }
            
            console.log('Main chart spacing debug:', {
                chartContainerHeight: chartContainer.offsetHeight,
                legendTop: legend ? legend.offsetTop : 'no legend',
                legendHeight: legend ? legend.offsetHeight : 'no legend',
                xAxisBottom: xAxis ? xAxis.offsetTop + xAxis.offsetHeight : 'no x-axis',
                gap: legend && xAxis ? (legend.offsetTop - (xAxis.offsetTop + xAxis.offsetHeight)) : 'cannot calculate'
            });
            
            // Check for subchart
            const subchart = chartContainer.querySelector('.c3-subchart');
            console.log('Subchart debug:', {
                subchartFound: !!subchart,
                subchartElement: subchart,
                chartInternal: this.chart.internal,
                chartConfig: this.chart.config
            });
            
            if (subchart) {
                console.log('Subchart dimensions:', {
                    width: subchart.offsetWidth,
                    height: subchart.offsetHeight,
                    top: subchart.offsetTop,
                    left: subchart.offsetLeft
                });
            } else {
                console.log('Subchart not found. Trying to enable it programmatically...');
                // Try to enable subchart programmatically
                try {
                    this.chart.subchart.show();
                    console.log('Subchart enabled programmatically');
                } catch (error) {
                    console.error('Failed to enable subchart:', error);
                }
            }
            
            // Add brush event handler for subchart
            try {
                this.chart.internal.subchart.on('brush', (brush) => {
                    console.log('Subchart brush event:', brush);
                    this.applyBrushToAllCharts(brush);
                });
                console.log('Subchart brush event handler added');
            } catch (error) {
                console.error('Failed to add subchart brush handler:', error);
            }
        }, 100);
        
        // Apply dynamic label visibility based on current series count and chart type
        this.applyDynamicLabelVisibility(chartType, totalSeries);
        
        // Initialize time labels and range indicator
        const initStartTime = performance.now();
        console.log('Initializing time labels with timestamps:', {
            totalPoints: this.timestamps.length,
            firstTimestamp: this.timestamps[0],
            lastTimestamp: this.timestamps[this.timestamps.length - 1],
            firstType: typeof this.timestamps[0],
            lastType: typeof this.timestamps[this.timestamps.length - 1]
        });
        
        // Ensure timestamps are properly converted to numbers for initialization
        const firstTimestamp = typeof this.timestamps[0] === 'number' ? this.timestamps[0] : new Date(this.timestamps[0]).getTime();
        const lastTimestamp = typeof this.timestamps[this.timestamps.length - 1] === 'number' ? this.timestamps[this.timestamps.length - 1] : new Date(this.timestamps[this.timestamps.length - 1]).getTime();
        
        this.updateTimeLabels(firstTimestamp, lastTimestamp);
        this.updateRangeIndicator();
        
        const initEndTime = performance.now();
        console.log(`Time range slider initialized in ${(initEndTime - initStartTime).toFixed(2)}ms`);
        
        // Apply legend text visibility based on option
        this.applyLegendTextVisibility();
        
        // Apply custom legend visibility based on option
        this.applyCustomLegendVisibility();
        
        this.hideLoading();
    }
    
    applyDynamicLabelVisibility(chartType, totalSeries) {
        // Labels are now controlled only by data point count, not series count
        // This method is kept for future extensibility but doesn't modify labels
        console.log('Chart type: ' + chartType + ', Series count: ' + totalSeries + ' - Labels controlled by data point count only');
    }
    
    applyLegendTextVisibility() {
        const chartContainer = document.getElementById(this.containerId + '-chart');
        if (chartContainer) {
            if (this.options.showLegendText) {
                chartContainer.classList.remove('legend-no-text');
            } else {
                chartContainer.classList.add('legend-no-text');
            }
        }
    }
    
    applyCustomLegendVisibility() {
        const mainContainer = this.container;
        if (mainContainer) {
            if (this.options.showCustomLegend) {
                mainContainer.classList.remove('custom-legend-hidden');
            } else {
                mainContainer.classList.add('custom-legend-hidden');
            }
        }
        
        // Update the legend content based on current visibility
        if (this.data) {
            this.updateLegend(this.data);
        }
    }
    
    getMetricNames() {
        // Return object mapping data IDs to metric names
        const names = {};
        Object.keys(this.metrics).forEach((metricName, index) => {
            names['data' + index] = metricName;
        });
        return names;
    }
    
    getTimeFormat(timestamps) {
        if (timestamps.length < 2) return '%H:%M:%S';
        
        const first = new Date(parseInt(timestamps[0]));
        const last = new Date(parseInt(timestamps[timestamps.length - 1]));
        const diff = last.getTime() - first.getTime();
        
        if (diff < 24 * 60 * 60 * 1000) { // Less than 1 day
            return '%H:%M:%S';
        } else if (diff < 7 * 24 * 60 * 60 * 1000) { // Less than 1 week
            return '%m/%d %H:%M';
        } else {
            return '%m/%d/%Y';
        }
    }
    
    getMetricNameById(id) {
        const metricNames = Object.keys(this.metrics);
        const colorIndex = parseInt(id.replace('data', ''));
        return metricNames[colorIndex] || 'Unknown';
    }
    
    updateLegend(data) {
        const legendContainer = document.getElementById(this.containerId + '-legend');
        if (legendContainer) {
            legendContainer.innerHTML = '';
        }
        
        if (!this.options.showLegend || !this.options.showCustomLegend) return;
        
        Object.keys(data.metrics).forEach((metricName, index) => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            
            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color';
            colorBox.style.backgroundColor = this.colorPalette[index % this.colorPalette.length];
            
            const text = document.createElement('span');
            text.className = 'legend-text';
            text.textContent = metricName;
            
            legendItem.appendChild(colorBox);
            legendItem.appendChild(text);
            legendContainer.appendChild(legendItem);
        });
    }
    
    showLoading() {
        const chartContainer = document.getElementById(this.containerId + '-chart');
        chartContainer.innerHTML = '<div class="timeseries-component-loading">Loading chart...</div>';
    }
    
    hideLoading() {
        const chartContainer = document.getElementById(this.containerId + '-chart');
        const loading = chartContainer.querySelector('.timeseries-component-loading');
        if (loading) {
            loading.remove();
        }
    }
    
    showError(message) {
        const chartContainer = document.getElementById(this.containerId + '-chart');
        chartContainer.innerHTML = '<div class="timeseries-component-error">' + message + '</div>';
    }
    
    // Aggregation functions
    average(values) {
        if (!Array.isArray(values) || values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
    
    sum(values) {
        if (!Array.isArray(values) || values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0);
    }
    
    max(values) {
        if (!Array.isArray(values) || values.length === 0) return 0;
        return Math.max.apply(Math, values);
    }
    
    min(values) {
        if (!Array.isArray(values) || values.length === 0) return 0;
        return Math.min.apply(Math, values);
    }
    
    count(values) {
        if (!Array.isArray(values)) return 0;
        return values.length;
    }
    
    // Public API methods
    updateData(timestamps, metrics, chartTitle = null, colors = null) {
        this.loadData(timestamps, metrics, chartTitle, colors);
    }
    
    setTimeSpan(timeSpan) {
        document.getElementById(this.containerId + '-timeSpan').value = timeSpan;
        this.updateChart();
    }
    
    setAggregation(aggregation) {
        document.getElementById(this.containerId + '-aggregation').value = aggregation;
        this.updateChart();
    }
    
    setChartType(chartType) {
        document.getElementById(this.containerId + '-chartType').value = chartType;
        this.updateChart();
    }
    
    // Public method to update label visibility dynamically
    updateLabelVisibility() {
        const chartType = document.getElementById(this.containerId + '-chartType').value;
        const totalSeries = Object.keys(this.metrics).length;
        this.applyDynamicLabelVisibility(chartType, totalSeries);
    }
    
    // Public method to toggle legend text visibility
    setLegendTextVisibility(showText) {
        this.options.showLegendText = showText;
        this.applyLegendTextVisibility();
    }
    
    // Public method to toggle custom legend div visibility
    setCustomLegendVisibility(showCustomLegend) {
        this.options.showCustomLegend = showCustomLegend;
        this.applyCustomLegendVisibility();
    }
    
    // Public method to show the chart (reopen after closing)
    showChart() {
        const scrollContainer = document.getElementById(this.containerId + '-scroll-container');
        if (scrollContainer) {
            scrollContainer.style.display = 'block';
            
            // Reset chart container to loading state if it was cleared
            const chartDiv = document.getElementById(this.containerId + '-chart');
            if (chartDiv && chartDiv.innerHTML.includes('Chart closed')) {
                chartDiv.innerHTML = '<div class="timeseries-component-loading">Loading chart...</div>';
            }
        }
    }
    
    // Public method to hide the chart
    hideChart() {
        const scrollContainer = document.getElementById(this.containerId + '-scroll-container');
        if (scrollContainer) {
            scrollContainer.style.display = 'none';
        }
    }
    
    // Public method to check if chart is visible
    isChartVisible() {
        const scrollContainer = document.getElementById(this.containerId + '-scroll-container');
        return scrollContainer ? scrollContainer.style.display !== 'none' : false;
    }
    
    updateChartWidth() {
        const multiplier = parseInt(document.getElementById(this.containerId + '-widthMultiplier').value);
        this.widthMultiplier = multiplier;
        
        console.log('updateChartWidth called with multiplier:', multiplier);
        
        if (this.chart) {
            const chartContainer = document.getElementById(this.containerId + '-chart');
            const scrollContainer = chartContainer.parentElement;
            
            if (chartContainer && scrollContainer) {
                // Get the scroll container width as base
                const baseWidth = scrollContainer.offsetWidth;
                const newWidth = baseWidth * multiplier;
                
                console.log('Width calculation:', { baseWidth, multiplier, newWidth });
                
                // Only set minWidth on the chart container, not width
                // This allows the chart to expand but doesn't force the container width
                chartContainer.style.minWidth = newWidth + 'px';
                chartContainer.style.width = 'auto'; // Let it size naturally
                
                console.log('Main chart container resized:', chartContainer.id, 'minWidth:', newWidth + 'px');
                
                // Resize the main chart with the new width
                if (this.chart) {
                    const newHeight = Math.round(this.options.height * this.heightMultiplier);
                    this.chart.resize({
                        width: newWidth,
                        height: newHeight
                    });
                    console.log('Main chart resized to width:', newWidth, 'height:', newHeight);
                }
                
                // Also update the main chart container height to match current height multiplier
                const mainChartContainer = document.getElementById(this.containerId + '-chart');
                if (mainChartContainer) {
                    const newHeight = Math.round(this.options.height * this.heightMultiplier);
                    mainChartContainer.style.height = newHeight + 'px';
                    console.log('Main chart container height updated to:', newHeight + 'px');
                }
                
                // Resize all additional charts within the same scroll container
                console.log('Number of additional charts:', this.charts.length);
                this.charts.forEach((chartData, index) => {
                    console.log('Processing additional chart', index, 'with ID:', chartData.id);
                    
                    if (chartData.chart) {
                        // Resize the chart
                        const newHeight = Math.round(this.options.height * this.heightMultiplier);
                        chartData.chart.resize({
                            width: newWidth,
                            height: newHeight
                        });
                        
                        console.log('Additional chart', index, 'resized to width:', newWidth, 'height:', newHeight);
                    } else {
                        console.log('Additional chart', index, 'has no chart instance');
                    }
                    
                    // Also resize the chart container
                    const additionalChartContainer = document.getElementById(chartData.id);
                    if (additionalChartContainer) {
                        const newHeight = Math.round(this.options.height * this.heightMultiplier);
                        additionalChartContainer.style.minWidth = newWidth + 'px';
                        additionalChartContainer.style.width = 'auto';
                        additionalChartContainer.style.maxWidth = 'none'; // Remove max-width constraint
                        additionalChartContainer.style.height = newHeight + 'px';
                        console.log('Additional chart container', chartData.id, 'resized to minWidth:', newWidth + 'px', 'height:', newHeight + 'px');
                        console.log('Container element found:', additionalChartContainer);
                        console.log('Container computed styles:', {
                            minWidth: additionalChartContainer.style.minWidth,
                            width: additionalChartContainer.style.width,
                            maxWidth: additionalChartContainer.style.maxWidth,
                            height: additionalChartContainer.style.height
                        });
                    } else {
                        console.error('Additional chart container not found:', chartData.id);
                    }
                });
                
                // Also apply width and height to all chart containers directly via DOM query
                const allChartContainers = scrollContainer.querySelectorAll('.timeseries-component-chart');
                console.log('Found chart containers via DOM query:', allChartContainers.length);
                const newHeight = Math.round(this.options.height * this.heightMultiplier);
                allChartContainers.forEach((container, index) => {
                    container.style.minWidth = newWidth + 'px';
                    container.style.width = 'auto';
                    container.style.maxWidth = 'none';
                    container.style.height = newHeight + 'px';
                    console.log('Direct DOM update for container', index, container.id, 'minWidth:', newWidth + 'px', 'height:', newHeight + 'px');
                });
                
                // Keep content aligned to the left
                scrollContainer.scrollLeft = 0;
            }
        }
    }
    
    setWidthMultiplier(multiplier) {
        document.getElementById(this.containerId + '-widthMultiplier').value = multiplier;
        this.updateChartWidth();
    }
    
    updateChartHeight() {
        const multiplier = parseFloat(document.getElementById(this.containerId + '-heightMultiplier').value);
        this.heightMultiplier = multiplier;
        
        console.log('updateChartHeight called with multiplier:', multiplier);
        
        const newHeight = Math.round(this.options.height * multiplier);
        console.log('New height calculation:', { baseHeight: this.options.height, multiplier, newHeight });
        
        // Store current additional charts data before destroying
        const currentAdditionalChartsData = [...this.storedAdditionalChartsData];
        
        // Clear stored additional charts data to prevent duplicates
        this.storedAdditionalChartsData = [];
        
        // Destroy all existing charts
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        this.charts.forEach(chartData => {
            if (chartData.chart) {
                chartData.chart.destroy();
            }
        });
        this.charts = [];
        this.chartIndex = 0;
        
        // Resize all chart containers
        const mainChartContainer = document.getElementById(this.containerId + '-chart');
        if (mainChartContainer) {
            // Set CSS custom property
            mainChartContainer.style.setProperty('--chart-height', newHeight + 'px');
            
            // Set height attributes
            mainChartContainer.style.height = newHeight + 'px';
            mainChartContainer.style.maxHeight = newHeight + 'px';
            mainChartContainer.style.minHeight = newHeight + 'px';
            
            // Force height with setAttribute
            mainChartContainer.setAttribute('style', 
                mainChartContainer.getAttribute('style') + 
                '; height: ' + newHeight + 'px !important;' +
                '; max-height: ' + newHeight + 'px !important;' +
                '; min-height: ' + newHeight + 'px !important;'
            );
            
            // Add CSS class to force height
            mainChartContainer.classList.add('height-reduced');
            
            console.log('Main chart container resized to height:', newHeight + 'px');
            console.log('Main chart container computed styles:', {
                height: window.getComputedStyle(mainChartContainer).height,
                maxHeight: window.getComputedStyle(mainChartContainer).maxHeight,
                minHeight: window.getComputedStyle(mainChartContainer).minHeight
            });
        }
        
        // Reload main chart data first
        if (this.storedMainChartData && this.storedMainChartData.timestamps && this.storedMainChartData.metrics) {
            console.log('Reloading main chart data:', this.storedMainChartData);
            this.loadData(this.storedMainChartData.timestamps, this.storedMainChartData.metrics, this.storedMainChartData.title, this.storedMainChartData.colors);
            
            // Apply height to the main chart after it's created
            if (this.chart) {
                this.chart.resize({
                    width: this.getChartWidth(),
                    height: newHeight
                });
                console.log('Main chart resized to height:', newHeight);
            }
        } else {
            console.error('No stored main chart data available:', this.storedMainChartData);
        }
        
        // Recreate all additional charts one by one
        currentAdditionalChartsData.forEach((storedData, index) => {
            const additionalChartContainer = document.getElementById(storedData.id);
            if (additionalChartContainer) {
                // Set CSS custom property
                additionalChartContainer.style.setProperty('--chart-height', newHeight + 'px');
                
                // Set height attributes
                additionalChartContainer.style.height = newHeight + 'px';
                additionalChartContainer.style.maxHeight = newHeight + 'px';
                additionalChartContainer.style.minHeight = newHeight + 'px';
                
                // Force height with setAttribute
                additionalChartContainer.setAttribute('style', 
                    additionalChartContainer.getAttribute('style') + 
                    '; height: ' + newHeight + 'px !important;' +
                    '; max-height: ' + newHeight + 'px !important;' +
                    '; min-height: ' + newHeight + 'px !important;'
                );
                
                // Add CSS class to force height
                additionalChartContainer.classList.add('height-reduced');
                
                console.log('Additional chart container', storedData.id, 'resized to height:', newHeight + 'px');
                console.log('Additional chart container computed styles:', {
                    height: window.getComputedStyle(additionalChartContainer).height,
                    maxHeight: window.getComputedStyle(additionalChartContainer).maxHeight,
                    minHeight: window.getComputedStyle(additionalChartContainer).minHeight
                });
            }
            
            console.log('Adding additional chart:', storedData);
            this.addChart(storedData.originalTimestamps, storedData.originalMetrics, false, storedData.title, storedData.colors);
            
            // Apply height to the newly created chart
            const newChartData = this.charts[this.charts.length - 1];
            if (newChartData && newChartData.chart) {
                newChartData.chart.resize({
                    width: this.getChartWidth(),
                    height: newHeight
                });
                console.log('Additional chart', index, 'resized to height:', newHeight);
            }
        });
    }
    
    setHeightMultiplier(multiplier) {
        document.getElementById(this.containerId + '-heightMultiplier').value = multiplier;
        this.updateChartHeight();
    }
    
    applyWidthToNewChart(chartData) {
        // Apply current width and height multipliers to a newly added chart
        const widthMultiplier = this.widthMultiplier;
        const heightMultiplier = this.heightMultiplier;
        const chartContainer = document.getElementById(this.containerId + '-chart');
        const scrollContainer = chartContainer.parentElement;
        
        if (chartContainer && scrollContainer) {
            const baseWidth = scrollContainer.offsetWidth;
            const newWidth = baseWidth * widthMultiplier;
            const newHeight = Math.round(this.options.height * heightMultiplier);
            
            console.log('Applying dimensions to new chart:', chartData.id, 'width:', newWidth, 'height:', newHeight, 'widthMultiplier:', widthMultiplier, 'heightMultiplier:', heightMultiplier);
            
            // Apply width and height to the chart container
            const additionalChartContainer = document.getElementById(chartData.id);
            if (additionalChartContainer) {
                additionalChartContainer.style.minWidth = newWidth + 'px';
                additionalChartContainer.style.width = 'auto';
                additionalChartContainer.style.maxWidth = 'none';
                additionalChartContainer.style.height = newHeight + 'px';
                console.log('New chart container', chartData.id, 'resized to minWidth:', newWidth + 'px', 'height:', newHeight + 'px');
            }
            
            // Use setTimeout to ensure container height is set before resizing chart
            setTimeout(() => {
                // Resize the chart if it exists
                if (chartData.chart) {
                    chartData.chart.resize({
                        width: newWidth,
                        height: newHeight
                    });
                    console.log('New chart', chartData.id, 'resized to width:', newWidth, 'height:', newHeight);
                }
            }, 50); // Small delay to ensure container height is set
        }
    }
    
    renderAdditionalChart(chartData) {
        console.log('renderAdditionalChart called with chartData:', chartData);
        console.log('chartData.timestamps:', chartData.timestamps);
        console.log('chartData.metrics:', chartData.metrics);
        
        if (!chartData || !chartData.timestamps || !chartData.metrics) {
            console.error('Invalid chartData in renderAdditionalChart:', chartData);
            this.showError('Invalid chart data', chartData ? chartData.id : 'unknown');
            return;
        }
        
        if (!chartData.timestamps.length || !Object.keys(chartData.metrics).length) {
            this.showError('No data available', chartData.id);
            return;
        }
        
        
        try {
            console.log('About to call processChartData with:', {
                timestamps: chartData.timestamps,
                metrics: chartData.metrics,
                timestampsType: typeof chartData.timestamps,
                metricsType: typeof chartData.metrics
            });
            
            // Process data for this specific chart
            const processedData = this.processChartData(chartData.timestamps, chartData.metrics, chartData.colors);
            
            if (!processedData) {
                this.showError('Failed to process chart data', chartData.id);
                return;
            }
            
            // Destroy existing chart if it exists
            if (chartData.chart) {
                chartData.chart.destroy();
            }
            
            // Apply the same labeling logic as the main chart
            const chartType = document.getElementById(this.containerId + '-chartType').value;
            const totalDataPoints = chartData.timestamps.length;
            const totalSeries = Object.keys(chartData.metrics).length;
            const showPoints = totalDataPoints <= 50;
            const showValueLabels = totalDataPoints <= 20 && (chartType === 'bar');
            const showXAxisGrid = totalDataPoints <= 100;
            
            console.log('Additional chart labeling:', { chartType, totalDataPoints, totalSeries, showPoints, showValueLabels, showXAxisGrid });
            
            // Update the processed data with the same labeling logic
            processedData.data.labels = showValueLabels ? {
                format: (v) => parseFloat(v).toFixed(2)
            } : false;
            
            processedData.point.show = showPoints;
            processedData.grid.x.show = this.options.showGrid && showXAxisGrid;
            // Use a reasonable tick count based on data points
            const tickCount = Math.min(12, Math.max(5, Math.floor(totalDataPoints / 1000)));
            processedData.axis.x.tick.count = tickCount;
            console.log('Setting additional chart x-axis tick count to:', tickCount, 'for', totalDataPoints, 'data points');
            
            // Apply CSS classes for visual control
            const chartContainer = document.getElementById(chartData.id);
            if (chartContainer) {
                // Control point visibility
                if (showPoints) {
                    chartContainer.classList.remove('hide-points');
                } else {
                    chartContainer.classList.add('hide-points');
                }
                
                // Control x-axis tick visibility
                if (showXAxisGrid) {
                    chartContainer.classList.remove('hide-x-ticks');
                } else {
                    chartContainer.classList.add('hide-x-ticks');
                }
            }
            
            // Create new chart (additional charts don't have subchart)
            chartData.chart = c3.generate({
                bindto: '#' + chartData.id,
                data: processedData.data,
                axis: processedData.axis,
                grid: processedData.grid,
                point: processedData.point,
                tooltip: processedData.tooltip,
                legend: processedData.legend,
                color: processedData.color,
                size: {
                    width: this.getChartWidth(),
                    height: Math.round(this.options.height * this.heightMultiplier)
                },
                onrendered: () => {
                    // Add chart title using C3's internal SVG
                    if (chartData.title) {
                        this.addChartTitle(chartData.chart, chartData.title);
                    }
                }
            });
            
            // Apply current zoom range if one exists
            if (this.zoomRange) {
                try {
                    console.log('Applying existing zoom to new chart:', this.zoomRange);
                    chartData.chart.zoom(this.zoomRange);
                } catch (error) {
                    console.error('Error applying zoom to new chart:', error);
                }
            }
            
            // Add drag-to-zoom functionality to the new chart
            this.setupDragToZoomForChart(chartData.id);
            
            // Debug: Check the actual computed styles after chart creation and position legend
            setTimeout(() => {
                const chartContainer = document.getElementById(chartData.id);
                const legend = chartContainer.querySelector('.c3-legend');
                const xAxis = chartContainer.querySelector('.c3-axis-x');
                
                // Force position legend at bottom-left
                if (legend) {
                    legend.style.position = 'absolute';
                    legend.style.bottom = '10px';
                    legend.style.left = '10px';
                    legend.style.transform = 'translate(0, 0)';
                    legend.style.zIndex = '10';
                    console.log('Additional chart legend positioned at bottom-left');
                }
                
                console.log('Additional chart spacing debug (' + chartData.id + '):', {
                    chartContainerHeight: chartContainer.offsetHeight,
                    legendTop: legend ? legend.offsetTop : 'no legend',
                    legendHeight: legend ? legend.offsetHeight : 'no legend',
                    xAxisBottom: xAxis ? xAxis.offsetTop + xAxis.offsetHeight : 'no x-axis',
                    gap: legend && xAxis ? (legend.offsetTop - (xAxis.offsetTop + xAxis.offsetHeight)) : 'cannot calculate'
                });
            }, 100);
            
        } catch (error) {
            console.error('Error rendering additional chart:', error);
            this.showError('Error rendering chart: ' + error.message, chartData.id);
        }
    }
    
    processChartData(timestamps, metrics, colors = null) {
        // Check if D3 is available
        if (typeof d3 === 'undefined') {
            console.error('D3.js is not loaded in processChartData');
            return null;
        }
        
        console.log('processChartData called with:', { timestamps, metrics });
        console.log('timestamps type:', typeof timestamps, 'isArray:', Array.isArray(timestamps));
        console.log('metrics type:', typeof metrics, 'isObject:', typeof metrics === 'object');
        
        if (!timestamps || !Array.isArray(timestamps)) {
            console.error('Invalid timestamps in processChartData:', timestamps);
            return null;
        }
        
        if (!metrics || typeof metrics !== 'object') {
            console.error('Invalid metrics in processChartData:', metrics);
            return null;
        }
        
        const timeSpan = this.timeSpanOptions[document.getElementById(this.containerId + '-timeSpan').value];
        const aggregation = document.getElementById(this.containerId + '-aggregation').value;
        const aggregationFunc = this.aggregationFunctions[aggregation];
        
        console.log('Using timeSpan:', timeSpan, 'aggregation:', aggregation);
        
        // Group timestamps by time span
        const groupedData = this.groupByTimeSpan(timestamps, timeSpan);
        
        // Process each metric
        const processedMetrics = {};
        
        console.log('About to process metrics object:', metrics);
        console.log('Object.keys(metrics):', Object.keys(metrics));
        console.log('Is Object.keys(metrics) iterable?', typeof Object.keys(metrics)[Symbol.iterator] === 'function');
        
        try {
            const metricKeys = Object.keys(metrics);
            console.log('Metric keys array:', metricKeys);
            
            for (let i = 0; i < metricKeys.length; i++) {
                const metricName = metricKeys[i];
                const values = metrics[metricName];
                
                console.log('Processing metric:', metricName, 'values:', values, 'type:', typeof values, 'isArray:', Array.isArray(values));
                
                // Ensure values is an array
                if (!Array.isArray(values)) {
                    console.error('Metric ' + metricName + ' values is not an array:', values);
                    processedMetrics[metricName] = [];
                    continue;
                }
                
                try {
                    console.log('About to call aggregateMetricValues for metric:', metricName);
                    console.log('Values being passed:', values, 'Type:', typeof values, 'IsArray:', Array.isArray(values));
                    console.log('GroupedData keys:', Object.keys(groupedData));
                    console.log('AggregationFunc:', aggregationFunc.name);
                    
                    processedMetrics[metricName] = this.aggregateMetricValues(values, groupedData, aggregationFunc);
                    console.log('Successfully processed metric:', metricName, 'result:', processedMetrics[metricName]);
                } catch (error) {
                    console.error('Error processing metric ' + metricName + ':', error);
                    console.error('Error stack:', error.stack);
                    processedMetrics[metricName] = {};
                }
            }
        } catch (error) {
            console.error('Error in forEach loop:', error);
            console.error('Metrics object:', metrics);
            console.error('Object.keys result:', Object.keys(metrics));
        }
        
        // Create the final data structure
        const timestampKeys = Object.keys(groupedData).sort();
        console.log('timestampKeys from groupedData:', timestampKeys);
        console.log('timestampKeys isArray:', Array.isArray(timestampKeys));
        
        const finalData = {
            timestamps: timestampKeys,
            metrics: processedMetrics
        };
        
        console.log('finalData created:', finalData);
        console.log('finalData.timestamps isArray:', Array.isArray(finalData.timestamps));
        
        console.log('Final data structure:', finalData);
        console.log('Timestamps:', finalData.timestamps);
        console.log('First few timestamps:', finalData.timestamps.slice(0, 5));
        console.log('Timestamp types:', finalData.timestamps.slice(0, 5).map(ts => ({ 
            value: ts, 
            type: typeof ts, 
            parsed: parseInt(ts),
            isNaN: isNaN(parseInt(ts)),
            isDate: ts instanceof Date,
            toString: ts.toString()
        })));
        console.log('Processed metrics:', processedMetrics);
        
        // Prepare data for C3
        console.log('finalData.timestamps before mapping:', finalData.timestamps);
        console.log('finalData.timestamps type:', typeof finalData.timestamps);
        console.log('finalData.timestamps isArray:', Array.isArray(finalData.timestamps));
        
        if (!Array.isArray(finalData.timestamps)) {
            console.error('finalData.timestamps is not an array:', finalData.timestamps);
            return null;
        }
        
        const xValues = ['x', ...finalData.timestamps.map(ts => {
            // Handle different timestamp formats
            let date;
            
            if (ts instanceof Date) {
                // Already a Date object
                date = ts;
            } else if (typeof ts === 'number') {
                // Already a number
                date = new Date(ts);
            } else if (typeof ts === 'string') {
                // Try parsing as number first
                const timestamp = parseInt(ts);
                if (!isNaN(timestamp)) {
                    date = new Date(timestamp);
                } else {
                    // Try parsing as date string
                    date = new Date(ts);
                }
            } else {
                console.error('Unknown timestamp format:', ts, 'type:', typeof ts);
                return new Date(); // Fallback to current date
            }
            
            // Validate the resulting date
            if (isNaN(date.getTime())) {
                console.error('Invalid date created from timestamp:', ts, 'type:', typeof ts);
                return new Date(); // Fallback to current date
            }
            
            return date;
        })];
        
        console.log('xValues constructed:', xValues);
        console.log('xValues length:', xValues.length);
        console.log('First few xValues:', xValues.slice(0, 5));
        
        const columns = [xValues];
        const chartColors = {};
        const metricNames = {};
        
        console.log('X-axis values for C3:', xValues);
        
        Object.keys(finalData.metrics).forEach((metricName, index) => {
            const dataKey = 'data' + index;
            const metricData = finalData.metrics[metricName] || {};
            
            console.log('Processing metric for C3:', metricName, 'metricData:', metricData, 'type:', typeof metricData);
            
            // Convert object to array based on timestamps
            const values = finalData.timestamps.map(timestamp => {
                return metricData[timestamp] || null;
            });
            
            console.log('Converted values array:', values, 'length:', values.length);
            console.log('Values isArray:', Array.isArray(values));
            
            const columnData = [dataKey, ...values];
            console.log('Column data for', metricName, ':', columnData, 'length:', columnData.length);
            
            columns.push(columnData);
            
            // Use custom colors if provided, otherwise use default palette
            if (colors && colors[metricName]) {
                chartColors[dataKey] = colors[metricName];
            } else if (colors && colors[index] !== undefined) {
                chartColors[dataKey] = colors[index];
            } else {
                chartColors[dataKey] = this.colorPalette[index % this.colorPalette.length];
            }
            
            metricNames[dataKey] = metricName;
        });
        
        const chartType = document.getElementById(this.containerId + '-chartType').value;
        const totalDataPoints = finalData.timestamps.length;
        const totalSeries = Object.keys(finalData.metrics).length;
        
        console.log('Chart configuration:', { chartType, totalDataPoints, totalSeries });
        console.log('Final columns for C3:', columns);
        console.log('Columns length:', columns.length);
        console.log('Columns structure check:', columns.map((col, i) => ({
            index: i,
            isArray: Array.isArray(col),
            length: col ? col.length : 'null/undefined',
            firstElement: col ? col[0] : 'null/undefined'
        })));
        
        // Determine visibility settings
        const showPoints = totalDataPoints <= 50;
        const showValueLabels = totalDataPoints <= 20 && (chartType === 'bar');
        const showXAxisGrid = totalDataPoints <= 100;
        
        return {
            data: {
                x: 'x',
                columns: columns,
                type: chartType,
                colors: chartColors,
                names: metricNames,
                labels: showValueLabels ? {
                    format: (v) => parseFloat(v).toFixed(2)
                } : false
            },
            axis: {
                x: {
                    type: 'timeseries',
                    tick: {
                        format: this.getTimeFormat(finalData.timestamps),
                        rotate: 0,
                        count: Math.min(12, Math.max(5, Math.floor(finalData.timestamps.length / 1000)))
                    },
                    label: { text: '' }
                },
                y: {
                    label: { text: 'Value' }
                }
            },
            grid: {
                x: { show: showXAxisGrid },
                y: { show: true }
            },
            point: {
                show: showPoints
            },
            tooltip: {
                show: this.options.showTooltip,
                format: {
                    title: (d) => {
                        const date = new Date(d);
                        return date.toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                        });
                    },
                    value: (value, ratio, id, index) => {
                        return parseFloat(value).toFixed(2);
                    }
                }
            },
            legend: {
                show: this.options.showLegend,
                position: 'bottom',
                item: {
                    onclick: (id) => {
                        if (chartData.chart) {
                            chartData.chart.toggle(id);
                        }
                    }
                }
            },
            color: {
                pattern: Object.values(chartColors)
            },
            padding: {
                top: 20,
                right: 20,
                bottom: 60,
                left: 60
            }
        };
    }
    
    getChartWidth() {
        const chartContainer = document.getElementById(this.containerId + '-chart');
        const scrollContainer = chartContainer.parentElement;
        const baseWidth = scrollContainer.offsetWidth;
        return baseWidth * this.widthMultiplier;
    }
    
    destroy() {
        if (this.chart) {
            this.chart.destroy();
        }
        
        // Destroy all additional charts
        this.charts.forEach(chartData => {
            if (chartData.chart) {
                chartData.chart.destroy();
            }
        });
        
        this.charts = [];
    }
}

// Global function for legend toggle (namespaced)
window.timeseriesComponentToggleLegend = function(containerId) {
    const chartContainer = document.getElementById(containerId + '-chart');
    if (chartContainer) {
        chartContainer.classList.toggle('timeseries-component-legend-hidden');
    }
};

// Global function for closing chart component (namespaced)
window.timeseriesComponentClose = function(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        // Find the TimeSeriesChart instance and clean up
        const chartInstance = window.timeseriesComponentInstances && window.timeseriesComponentInstances[containerId];
        if (chartInstance) {
            // Destroy all charts
            if (chartInstance.chart) {
                chartInstance.chart.destroy();
            }
            chartInstance.charts.forEach(chartData => {
                if (chartData.chart) {
                    chartData.chart.destroy();
                }
            });
            
            // Remove from instances registry
            delete window.timeseriesComponentInstances[containerId];
        }
        
        // Remove the container from DOM
        container.remove();
        
        // Trigger custom event for external listeners
        const closeEvent = new CustomEvent('timeseriesComponentClosed', {
            detail: { containerId: containerId }
        });
        document.dispatchEvent(closeEvent);
    }
};

// Global function for closing scroll container (namespaced)
window.timeseriesComponentCloseScrollContainer = function(containerId) {
    const scrollContainer = document.getElementById(containerId + '-scroll-container');
    if (scrollContainer) {
        // Find the TimeSeriesChart instance and clean up
        const chartInstance = window.timeseriesComponentInstances && window.timeseriesComponentInstances[containerId];
        if (chartInstance) {
            // Destroy all charts
            if (chartInstance.chart) {
                chartInstance.chart.destroy();
                chartInstance.chart = null;
            }
            chartInstance.charts.forEach(chartData => {
                if (chartData.chart) {
                    chartData.chart.destroy();
                }
            });
            
            // Remove has-chart class to hide container height
            chartInstance.container.classList.remove('has-chart');
            
            // Clear all cached data
            chartInstance.timestamps = [];
            chartInstance.metrics = {};
            chartInstance.charts = [];
            chartInstance.chartIndex = 0;
            chartInstance.storedMainChartData = null;
            chartInstance.storedAdditionalChartsData = [];
            
            // Clear the chart container content
            const chartDiv = document.getElementById(containerId + '-chart');
            if (chartDiv) {
                chartDiv.innerHTML = '<div class="timeseries-component-loading">Chart closed</div>';
            }
            
            // Clear additional chart containers
            const additionalCharts = scrollContainer.querySelectorAll('[id^="' + containerId + '-chart-"]');
            additionalCharts.forEach(chartContainer => {
                chartContainer.remove();
            });
        }
        
        // Hide the scroll container
        scrollContainer.style.display = 'none';
        
        // Hide the controls section
        const controlsSection = document.querySelector('#' + containerId + ' .timeseries-component-controls');
        if (controlsSection) {
            controlsSection.style.display = 'none';
        }
        
        // Trigger custom event for external listeners
        const closeEvent = new CustomEvent('timeseriesComponentScrollContainerClosed', {
            detail: { containerId: containerId }
        });
        document.dispatchEvent(closeEvent);
    }
};

// Global function for resetting zoom (namespaced)
window.timeseriesComponentResetZoom = function(containerId) {
    const chartInstance = window.timeseriesComponentInstances && window.timeseriesComponentInstances[containerId];
    if (chartInstance) {
        chartInstance.resetZoom();
    }
};

// Global function for zoom in (namespaced)
window.timeseriesComponentZoomIn = function(containerId) {
    const chartInstance = window.timeseriesComponentInstances && window.timeseriesComponentInstances[containerId];
    if (chartInstance) {
        chartInstance.zoomIn();
    }
};

// Global function for zoom out (namespaced)
window.timeseriesComponentZoomOut = function(containerId) {
    const chartInstance = window.timeseriesComponentInstances && window.timeseriesComponentInstances[containerId];
    if (chartInstance) {
        chartInstance.zoomOut();
    }
};

// Global function for updating slider value only (no chart update)
window.timeseriesComponentUpdateSliderValue = function(containerId, value, type) {
    const chartInstance = window.timeseriesComponentInstances && window.timeseriesComponentInstances[containerId];
    if (chartInstance) {
        chartInstance.updateSliderValueOnly(parseInt(value), type);
    }
};

// Global function for updating time range (namespaced)
window.timeseriesComponentUpdateTimeRange = function(containerId, value, type) {
    const chartInstance = window.timeseriesComponentInstances && window.timeseriesComponentInstances[containerId];
    if (chartInstance) {
        chartInstance.updateTimeRange(parseInt(value), type);
    }
};

// Global function for applying time range (namespaced)
window.timeseriesComponentApplyTimeRange = function(containerId) {
    const chartInstance = window.timeseriesComponentInstances && window.timeseriesComponentInstances[containerId];
    if (chartInstance) {
        chartInstance.applyTimeRangeZoom();
    }
};

// Drag-to-zoom methods
TimeSeriesChart.prototype.setupDragToZoom = function() {
    this.setupDragToZoomForChart(this.containerId + '-chart');
};

TimeSeriesChart.prototype.setupDragToZoomForChart = function(chartId) {
    const chartContainer = document.getElementById(chartId);
    let dragOverlay = document.getElementById(chartId + '-drag-overlay');
    
    if (!chartContainer) {
        console.error('Chart container not found:', chartId);
        return;
    }
    
    // Create drag overlay if it doesn't exist
    if (!dragOverlay) {
        dragOverlay = document.createElement('div');
        dragOverlay.className = 'timeseries-component-drag-overlay';
        dragOverlay.id = chartId + '-drag-overlay';
        chartContainer.appendChild(dragOverlay);
    }
    
    // Mouse down - start drag
    chartContainer.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left mouse button
            this.isDragging = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
            chartContainer.classList.add('dragging');
            dragOverlay.style.display = 'block';
            e.preventDefault();
        }
    });
    
    // Mouse move - update drag overlay
    chartContainer.addEventListener('mousemove', (e) => {
        if (this.isDragging) {
            this.dragEnd = { x: e.clientX, y: e.clientY };
            this.updateDragOverlay(chartContainer, dragOverlay);
        }
    });
    
    // Mouse up - finish drag and zoom
    chartContainer.addEventListener('mouseup', (e) => {
        if (this.isDragging && e.button === 0) {
            // Calculate zoom range and apply
            this.finishDragZoom(chartContainer);
            e.preventDefault();
        }
    });
    
    // Mouse leave - cancel drag
    chartContainer.addEventListener('mouseleave', () => {
        if (this.isDragging) {
            this.resetDragState();
        }
    });
    
    // Double click - reset zoom
    chartContainer.addEventListener('dblclick', () => {
        this.resetZoom();
    });
};

TimeSeriesChart.prototype.updateDragOverlay = function(chartContainer, dragOverlay) {
    if (!this.dragStart || !this.dragEnd) return;
    
    const rect = chartContainer.getBoundingClientRect();
    const startX = Math.min(this.dragStart.x, this.dragEnd.x) - rect.left;
    const startY = Math.min(this.dragStart.y, this.dragEnd.y) - rect.top;
    const width = Math.abs(this.dragEnd.x - this.dragStart.x);
    const height = Math.abs(this.dragEnd.y - this.dragStart.y);
    
    dragOverlay.style.left = startX + 'px';
    dragOverlay.style.top = startY + 'px';
    dragOverlay.style.width = width + 'px';
    dragOverlay.style.height = height + 'px';
};

TimeSeriesChart.prototype.finishDragZoom = function(chartContainer) {
    if (!this.dragStart || !this.dragEnd) return;
    
    const rect = chartContainer.getBoundingClientRect();
    const startX = Math.min(this.dragStart.x, this.dragEnd.x) - rect.left;
    const endX = Math.max(this.dragStart.x, this.dragEnd.x) - rect.left;
    const width = endX - startX;
    
    // Only zoom if drag area is large enough
    if (width < 20) {
        this.resetDragState();
        return;
    }
    
    // Convert pixel coordinates to time coordinates
    const chartWidth = rect.width;
    const chartId = chartContainer.id;
    const startTime = this.pixelToTime(startX, chartWidth, chartId);
    const endTime = this.pixelToTime(endX, chartWidth, chartId);
    
    console.log('Drag zoom calculation:', {
        startX, endX, chartWidth,
        startTime, endTime,
        startDate: new Date(startTime),
        endDate: new Date(endTime),
        rect: rect
    });
    
    // Apply zoom to all charts - C3.js expects an array format for zoom
    this.applyZoomToAllCharts([startTime, endTime]);
    
    // Reset drag state and hide all overlays
    this.resetDragState();
};

TimeSeriesChart.prototype.resetDragState = function() {
    // Reset drag state
    this.isDragging = false;
    this.dragStart = null;
    this.dragEnd = null;
    
    // Hide all drag overlays
    const allOverlays = document.querySelectorAll('.timeseries-component-drag-overlay');
    allOverlays.forEach(overlay => {
        overlay.style.display = 'none';
    });
    
    // Remove dragging class from all chart containers
    const allCharts = document.querySelectorAll('.timeseries-component-chart');
    allCharts.forEach(chart => {
        chart.classList.remove('dragging');
    });
};

TimeSeriesChart.prototype.pixelToTime = function(pixelX, chartWidth, chartId = null) {
    if (!this.timestamps || this.timestamps.length === 0) return 0;
    
    // Method 1: Try to get the actual data range from C3.js chart data
    let targetChart = this.chart;
    if (chartId && chartId !== this.containerId + '-chart') {
        const chartData = this.charts.find(c => c.id === chartId);
        if (chartData && chartData.chart) {
            targetChart = chartData.chart;
        }
    }
    
    if (targetChart && targetChart.internal && targetChart.internal.data) {
        try {
            // Get the actual data from C3.js
            const chartData = targetChart.internal.data;
            const xValues = chartData.xs ? Object.values(chartData.xs)[0] : null;
            
            if (xValues && xValues.length > 0) {
                // Filter out null/undefined values and get min/max
                const validXValues = xValues.filter(x => x != null);
                if (validXValues.length > 0) {
                    const minTime = Math.min(...validXValues);
                    const maxTime = Math.max(...validXValues);
                    
                    console.log('Using C3.js data range:', {
                        minTime, maxTime, pixelX, chartWidth,
                        minDate: new Date(minTime),
                        maxDate: new Date(maxTime)
                    });
                    
                    const timeRange = maxTime - minTime;
                    const ratio = pixelX / chartWidth;
                    const result = minTime + (ratio * timeRange);
                    
                    console.log('pixelToTime calculation (C3.js data):', {
                        pixelX, chartWidth, minTime, maxTime, timeRange, ratio, result,
                        resultDate: new Date(result)
                    });
                    
                    return result;
                }
            }
        } catch (error) {
            console.log('Failed to get C3.js data, trying domain method:', error);
        }
    }
    
    // Method 2: Try C3.js domain if available
    if (targetChart && targetChart.internal && targetChart.internal.x) {
        try {
            const xDomain = targetChart.internal.x.domain();
            if (xDomain && xDomain.length === 2 && xDomain[0] && xDomain[1]) {
                const startTime = xDomain[0].getTime();
                const endTime = xDomain[1].getTime();
                
                console.log('Using C3.js domain:', {
                    startTime, endTime, pixelX, chartWidth,
                    startDate: xDomain[0],
                    endDate: xDomain[1]
                });
                
                const timeRange = endTime - startTime;
                const ratio = pixelX / chartWidth;
                const result = startTime + (ratio * timeRange);
                
                console.log('pixelToTime calculation (C3.js domain):', {
                    pixelX, chartWidth, startTime, endTime, timeRange, ratio, result,
                    resultDate: new Date(result)
                });
                
                return result;
            }
        } catch (error) {
            console.log('Failed to get C3.js domain, using original timestamps:', error);
        }
    }
    
    // Method 3: Fallback to original timestamps
    const convertToDate = (ts) => {
        if (ts instanceof Date) {
            return ts;
        } else if (typeof ts === 'number') {
            return new Date(ts);
        } else if (typeof ts === 'string') {
            const timestamp = parseInt(ts);
            if (!isNaN(timestamp)) {
                return new Date(timestamp);
            } else {
                return new Date(ts);
            }
        } else {
            return new Date();
        }
    };
    
    const startDate = convertToDate(this.timestamps[0]);
    const endDate = convertToDate(this.timestamps[this.timestamps.length - 1]);
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    const timeRange = endTime - startTime;
    
    const ratio = pixelX / chartWidth;
    const result = startTime + (ratio * timeRange);
    
    console.log('pixelToTime calculation (fallback to original timestamps):', {
        pixelX, chartWidth, startTime, endTime, timeRange, ratio, result,
        startDate: startDate,
        endDate: endDate,
        resultDate: new Date(result),
        chartId: chartId || 'main'
    });
    
    return result;
};

TimeSeriesChart.prototype.applyZoomToAllCharts = function(zoomRange) {
    this.zoomRange = zoomRange;
    
    const startTime = performance.now();
    console.log('Applying zoom to all charts:', zoomRange);
    
    // For reset operations, apply immediately without requestAnimationFrame for better performance
    if (zoomRange === null) {
        // Reset zoom - apply immediately with optimized approach
        const updatePromises = [];
        
        // Apply zoom to main chart
        if (this.chart) {
            updatePromises.push(new Promise((resolve) => {
                try {
                    this.chart.zoom(); // Reset zoom
                    resolve();
                } catch (error) {
                    console.error('Error resetting main chart:', error);
                    resolve();
                }
            }));
        }
        
        // For large datasets, limit concurrent chart updates to prevent browser freeze
        const maxConcurrent = this.timestamps && this.timestamps.length > 20000 ? 2 : this.charts.length;
        let processedCharts = 0;
        
        // Apply zoom to additional charts in batches
        const processChartsBatch = (startIndex) => {
            const endIndex = Math.min(startIndex + maxConcurrent, this.charts.length);
            
            for (let i = startIndex; i < endIndex; i++) {
                const chartData = this.charts[i];
                if (chartData.chart) {
                    updatePromises.push(new Promise((resolve) => {
                        try {
                            chartData.chart.zoom(); // Reset zoom
                            resolve();
                        } catch (error) {
                            console.error(`Error resetting additional chart ${i}:`, error);
                            resolve();
                        }
                    }));
                }
            }
            
            processedCharts = endIndex;
            
            // If there are more charts, process next batch
            if (processedCharts < this.charts.length) {
                setTimeout(() => processChartsBatch(processedCharts), 10);
            }
        };
        
        // Start processing charts
        processChartsBatch(0);
        
        // Wait for all updates to complete
        Promise.all(updatePromises).then(() => {
            const endTime = performance.now();
            console.log(`Reset applied to ${updatePromises.length} charts in ${(endTime - startTime).toFixed(2)}ms`);
        });
    } else {
        // Regular zoom - use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
            // Batch chart updates for better performance
            const updatePromises = [];
            
            // Apply zoom to main chart
            if (this.chart) {
                updatePromises.push(new Promise((resolve) => {
                    try {
                        this.chart.zoom(zoomRange);
                        resolve();
                    } catch (error) {
                        console.error('Error zooming main chart:', error);
                        resolve();
                    }
                }));
            }
            
            // Apply zoom to all additional charts
            this.charts.forEach((chartData, index) => {
                if (chartData.chart) {
                    updatePromises.push(new Promise((resolve) => {
                        try {
                            chartData.chart.zoom(zoomRange);
                            resolve();
                        } catch (error) {
                            console.error(`Error zooming additional chart ${index}:`, error);
                            resolve();
                        }
                    }));
                }
            });
            
            // Wait for all updates to complete
            Promise.all(updatePromises).then(() => {
                const endTime = performance.now();
                console.log(`Zoom applied to ${updatePromises.length} charts in ${(endTime - startTime).toFixed(2)}ms`);
            });
        });
    }
};

TimeSeriesChart.prototype.resetZoom = function() {
    const startTime = performance.now();
    
    this.zoomRange = null;
    this.timeRangeMin = 0;
    this.timeRangeMax = 100;
    this.updateSliderValues();
    this.updateRangeIndicator();
    
    // Clear any pending timeouts
    if (this.zoomUpdateTimeout) {
        clearTimeout(this.zoomUpdateTimeout);
        this.zoomUpdateTimeout = null;
    }
    if (this.timeLabelUpdateTimeout) {
        clearTimeout(this.timeLabelUpdateTimeout);
        this.timeLabelUpdateTimeout = null;
    }
    
    // Force immediate zoom reset with proper timing
    console.log('Resetting zoom with immediate application...');
    
    // Reset main chart zoom immediately
    if (this.chart) {
        try {
            // Try different zoom reset methods
            if (this.chart.zoom) {
                this.chart.zoom(); // Reset zoom
                console.log('Main chart zoom reset applied (method 1)');
            }
            // Also try to reset the internal zoom state
            if (this.chart.internal && this.chart.internal.zoom) {
                this.chart.internal.zoom.reset();
                console.log('Main chart internal zoom reset applied');
            }
            // Reset subchart brush if it exists
            if (this.chart.internal && this.chart.internal.subchart) {
                try {
                    this.chart.internal.subchart.reset();
                    console.log('Main chart subchart reset applied');
                } catch (subError) {
                    console.log('Subchart reset not available:', subError);
                }
            }
        } catch (error) {
            console.error('Error resetting main chart zoom:', error);
        }
    }
    
    // Reset all additional charts zoom immediately
    this.charts.forEach((chartData, index) => {
        if (chartData.chart) {
            try {
                // Try different zoom reset methods
                if (chartData.chart.zoom) {
                    chartData.chart.zoom(); // Reset zoom
                    console.log(`Additional chart ${index} zoom reset applied (method 1)`);
                }
                // Also try to reset the internal zoom state
                if (chartData.chart.internal && chartData.chart.internal.zoom) {
                    chartData.chart.internal.zoom.reset();
                    console.log(`Additional chart ${index} internal zoom reset applied`);
                }
            } catch (error) {
                console.error(`Error resetting additional chart ${index} zoom:`, error);
            }
        }
    });
    
    // Update time labels immediately for reset
    if (this.timestamps && this.timestamps.length > 0) {
        const firstTimestamp = typeof this.timestamps[0] === 'number' ? this.timestamps[0] : new Date(this.timestamps[0]).getTime();
        const lastTimestamp = typeof this.timestamps[this.timestamps.length - 1] === 'number' ? this.timestamps[this.timestamps.length - 1] : new Date(this.timestamps[this.timestamps.length - 1]).getTime();
        this.updateTimeLabels(firstTimestamp, lastTimestamp);
    }
    
    // Force a small delay and then trigger a refresh to ensure zoom reset is applied
    setTimeout(() => {
        console.log('Forcing chart refresh after zoom reset...');
        
        // Force refresh main chart
        if (this.chart) {
            try {
                if (this.chart.flush) {
                    this.chart.flush();
                    console.log('Main chart flushed');
                }
                // Also try to force a redraw
                if (this.chart.redraw) {
                    this.chart.redraw();
                    console.log('Main chart redrawn');
                }
                // Force axis update
                if (this.chart.internal && this.chart.internal.axis) {
                    this.chart.internal.axis.redraw();
                    console.log('Main chart axis redrawn');
                }
            } catch (error) {
                console.error('Error refreshing main chart:', error);
            }
        }
        
        // Force refresh additional charts
        this.charts.forEach((chartData, index) => {
            if (chartData.chart) {
                try {
                    if (chartData.chart.flush) {
                        chartData.chart.flush();
                        console.log(`Additional chart ${index} flushed`);
                    }
                    // Also try to force a redraw
                    if (chartData.chart.redraw) {
                        chartData.chart.redraw();
                        console.log(`Additional chart ${index} redrawn`);
                    }
                } catch (error) {
                    console.error(`Error refreshing additional chart ${index}:`, error);
                }
            }
        });
    }, 50); // Small delay to ensure zoom reset is processed
    
    const endTime = performance.now();
    console.log(`Reset zoom completed in ${(endTime - startTime).toFixed(2)}ms`);
};

TimeSeriesChart.prototype.recreateAllCharts = function() {
    const startTime = performance.now();
    
    // Destroy all existing charts
    if (this.chart) {
        this.chart.destroy();
        this.chart = null;
    }
    
    this.charts.forEach((chartData, index) => {
        if (chartData.chart) {
            chartData.chart.destroy();
        }
    });
    this.charts = [];
    
    // Clear chart containers
    const mainChartContainer = document.getElementById(this.containerId + '-chart');
    if (mainChartContainer) {
        mainChartContainer.innerHTML = '<div class="timeseries-component-drag-overlay" id="' + this.containerId + '-drag-overlay"></div><button class="timeseries-component-legend-toggle" onclick="window.timeseriesComponentToggleLegend(\'' + this.containerId + '\')">Toggle Legend</button>';
    }
    
    // Remove additional chart containers
    for (let i = 0; i < 10; i++) { // Remove up to 10 additional charts
        const additionalContainer = document.getElementById(this.containerId + '-chart-' + i);
        if (additionalContainer) {
            additionalContainer.remove();
        }
    }
    
    // Recreate main chart
    if (this.storedMainChartData) {
        console.log('Recreating main chart with stored data:', this.storedMainChartData);
        this.renderChart(this.storedMainChartData);
        
        // Ensure main chart has consistent height
        const mainChartContainer = document.getElementById(this.containerId + '-chart');
        if (mainChartContainer) {
            const chartHeight = this.heightMultiplier * 400;
            mainChartContainer.style.height = chartHeight + 'px';
            mainChartContainer.style.minHeight = chartHeight + 'px';
            mainChartContainer.style.maxHeight = chartHeight + 'px';
            
            // Force height with setAttribute
            mainChartContainer.setAttribute('style', 
                mainChartContainer.getAttribute('style') + 
                ' height: ' + chartHeight + 'px !important;' +
                ' min-height: ' + chartHeight + 'px !important;' +
                ' max-height: ' + chartHeight + 'px !important;'
            );
        }
    } else {
        console.log('No stored main chart data found');
    }
    
        // Recreate additional charts
        console.log(`Found ${this.storedAdditionalChartsData.length} stored additional charts`);
        this.storedAdditionalChartsData.forEach((storedData, index) => {
            console.log(`Recreating additional chart ${index}:`, storedData);
            
            // Create the chart container first
            const chartContainer = document.createElement('div');
            chartContainer.id = storedData.id;
            chartContainer.className = 'timeseries-component-chart';
            chartContainer.style.minWidth = (this.widthMultiplier * 1200) + 'px';
            chartContainer.style.height = (this.heightMultiplier * 400) + 'px';
            chartContainer.style.minHeight = (this.heightMultiplier * 400) + 'px';
            chartContainer.style.maxHeight = (this.heightMultiplier * 400) + 'px';
            
            
            // Add drag overlay
            const dragOverlay = document.createElement('div');
            dragOverlay.className = 'timeseries-component-drag-overlay';
            dragOverlay.id = storedData.id + '-drag-overlay';
            chartContainer.appendChild(dragOverlay);
            
            // Add to scroll container
            const scrollContainer = document.getElementById(this.containerId + '-scroll-container');
            if (scrollContainer) {
                scrollContainer.appendChild(chartContainer);
            }
            
            // Create chart data object for rendering
            const chartData = {
                id: storedData.id,
                timestamps: storedData.originalTimestamps,
                metrics: storedData.originalMetrics,
                chart: null,
                title: storedData.title
            };
            
            // Add to charts array
            this.charts.push(chartData);
            
            // Render using the stored processed data
            this.renderAdditionalChartWithProcessedData(chartData, storedData.processedData);
        });
    
    // Reset chart index to ensure proper numbering
    this.chartIndex = this.storedAdditionalChartsData.length;
    
    const endTime = performance.now();
    console.log(`Charts recreated in ${(endTime - startTime).toFixed(2)}ms`);
};

TimeSeriesChart.prototype.renderAdditionalChartWithProcessedData = function(chartData, processedData) {
    const startTime = performance.now();
    
    try {
        // Use the stored processed data directly instead of reprocessing
        const chart = c3.generate({
            bindto: '#' + chartData.id,
            data: processedData.data,
            axis: processedData.axis,
            tooltip: processedData.tooltip,
            legend: processedData.legend,
            color: processedData.color,
            size: processedData.size,
            padding: processedData.padding,
            zoom: {
                enabled: true,
                rescale: true
            }
        });
        
        // Store the chart instance
        chartData.chart = chart;
        
        // Add chart title if provided
        if (chartData.title) {
            this.addChartTitle(chart, chartData.title);
        }
        
        // Apply dimensions
        const chartWidth = this.widthMultiplier * 1200;
        const chartHeight = this.heightMultiplier * 400;
        
        chart.resize({
            width: chartWidth,
            height: chartHeight
        });
        
        // Update container dimensions with aggressive height setting
        const chartContainer = document.getElementById(chartData.id);
        if (chartContainer) {
            chartContainer.style.minWidth = chartWidth + 'px';
            chartContainer.style.height = chartHeight + 'px';
            chartContainer.style.minHeight = chartHeight + 'px';
            chartContainer.style.maxHeight = chartHeight + 'px';
            
            // Force height with setAttribute for more aggressive control
            chartContainer.setAttribute('style', 
                chartContainer.getAttribute('style') + 
                ' height: ' + chartHeight + 'px !important;' +
                ' min-height: ' + chartHeight + 'px !important;' +
                ' max-height: ' + chartHeight + 'px !important;'
            );
        }
        
        // Setup drag-to-zoom for the new chart
        this.setupDragToZoomForChart(chartData.id);
        
        // Apply any existing zoom range
        if (this.zoomRange) {
            setTimeout(() => {
                try {
                    chart.zoom(this.zoomRange);
                } catch (error) {
                    console.error('Error applying zoom to recreated chart:', error);
                }
            }, 100);
        }
        
        const endTime = performance.now();
        console.log(`Additional chart ${chartData.id} recreated in ${(endTime - startTime).toFixed(2)}ms`);
        
    } catch (error) {
        console.error('Error recreating additional chart:', error);
    }
};

TimeSeriesChart.prototype.updateSliderValueOnly = function(value, type) {
    if (type === 'min') {
        this.timeRangeMin = Math.min(value, this.timeRangeMax - 1);
    } else if (type === 'max') {
        this.timeRangeMax = Math.max(value, this.timeRangeMin + 1);
    }
    
    this.updateSliderValues();
    this.updateRangeIndicator();
    
    // Update time labels for immediate visual feedback (but don't update charts)
    if (this.timestamps && this.timestamps.length > 0) {
        // Ensure timestamps are properly converted to numbers
        const firstTimestamp = typeof this.timestamps[0] === 'number' ? this.timestamps[0] : new Date(this.timestamps[0]).getTime();
        const lastTimestamp = typeof this.timestamps[this.timestamps.length - 1] === 'number' ? this.timestamps[this.timestamps.length - 1] : new Date(this.timestamps[this.timestamps.length - 1]).getTime();
        
        const totalTime = lastTimestamp - firstTimestamp;
        const startTime = firstTimestamp + (totalTime * this.timeRangeMin / 100);
        const endTime = firstTimestamp + (totalTime * this.timeRangeMax / 100);
        this.updateTimeLabels(startTime, endTime);
    }
};

TimeSeriesChart.prototype.updateTimeRange = function(value, type) {
    if (type === 'min') {
        this.timeRangeMin = Math.min(value, this.timeRangeMax - 1);
    } else if (type === 'max') {
        this.timeRangeMax = Math.max(value, this.timeRangeMin + 1);
    }
    
    this.updateSliderValues();
    this.updateRangeIndicator();
    
    // Debounce zoom updates for better performance
    if (this.zoomUpdateTimeout) {
        clearTimeout(this.zoomUpdateTimeout);
    }
    
    this.zoomUpdateTimeout = setTimeout(() => {
        this.applyTimeRangeZoom();
    }, 100); // 100ms delay - reduced for better responsiveness
};

TimeSeriesChart.prototype.updateSliderValues = function() {
    const minSlider = document.querySelector('#' + this.containerId + ' .timeseries-component-slider-min');
    const maxSlider = document.querySelector('#' + this.containerId + ' .timeseries-component-slider-max');
    
    if (minSlider) minSlider.value = this.timeRangeMin;
    if (maxSlider) maxSlider.value = this.timeRangeMax;
};

TimeSeriesChart.prototype.updateRangeIndicator = function() {
    const rangeIndicator = document.getElementById(this.containerId + '-slider-range');
    if (rangeIndicator) {
        const container = document.getElementById(this.containerId + '-slider-container');
        if (container) {
            const containerWidth = container.offsetWidth;
            const left = (this.timeRangeMin / 100) * containerWidth;
            const width = ((this.timeRangeMax - this.timeRangeMin) / 100) * containerWidth;
            
            rangeIndicator.style.left = left + 'px';
            rangeIndicator.style.width = width + 'px';
        }
    }
};

TimeSeriesChart.prototype.applyTimeRangeZoom = function() {
    if (!this.timestamps || this.timestamps.length === 0) return;
    
    // Prevent multiple simultaneous updates
    if (this.isUpdatingZoom) return;
    this.isUpdatingZoom = true;
    
    const startTime = performance.now();
    
    // For large datasets, use sampling to improve performance
    let firstTimestamp, lastTimestamp;
    if (this.timestamps.length > 10000) {
        // Sample every 100th point for very large datasets
        const sampleSize = Math.max(100, Math.floor(this.timestamps.length / 100));
        const firstSample = this.timestamps[0];
        const lastSample = this.timestamps[this.timestamps.length - 1];
        
        firstTimestamp = typeof firstSample === 'number' ? firstSample : new Date(firstSample).getTime();
        lastTimestamp = typeof lastSample === 'number' ? lastSample : new Date(lastSample).getTime();
    } else {
        // Use full dataset for smaller datasets
        firstTimestamp = typeof this.timestamps[0] === 'number' ? this.timestamps[0] : new Date(this.timestamps[0]).getTime();
        lastTimestamp = typeof this.timestamps[this.timestamps.length - 1] === 'number' ? this.timestamps[this.timestamps.length - 1] : new Date(this.timestamps[this.timestamps.length - 1]).getTime();
    }
    
    const totalTime = lastTimestamp - firstTimestamp;
    const zoomStartTime = firstTimestamp + (totalTime * this.timeRangeMin / 100);
    const zoomEndTime = firstTimestamp + (totalTime * this.timeRangeMax / 100);
    
    this.zoomRange = [zoomStartTime, zoomEndTime];
    this.applyZoomToAllCharts(this.zoomRange);
    
    // Update time labels
    this.updateTimeLabels(zoomStartTime, zoomEndTime);
    
    const endTime = performance.now();
    console.log('Applied time range zoom (performance):', {
        totalPoints: this.timestamps.length,
        processingTime: (endTime - startTime).toFixed(2) + 'ms',
        firstTimestamp: new Date(firstTimestamp),
        lastTimestamp: new Date(lastTimestamp),
        totalTimeMs: totalTime,
        min: this.timeRangeMin,
        max: this.timeRangeMax,
        startTime: new Date(zoomStartTime),
        endTime: new Date(zoomEndTime),
        timeRangeMs: zoomEndTime - zoomStartTime
    });
    
    this.isUpdatingZoom = false;
};

TimeSeriesChart.prototype.updateTimeLabels = function(startTime, endTime) {
    const minLabel = document.getElementById(this.containerId + '-time-min');
    const maxLabel = document.getElementById(this.containerId + '-time-max');
    
    console.log('Updating time labels:', {
        startTime: startTime,
        endTime: endTime,
        startDate: new Date(startTime),
        endDate: new Date(endTime),
        minLabelFound: !!minLabel,
        maxLabelFound: !!maxLabel
    });
    
    if (minLabel) {
        try {
            minLabel.textContent = new Date(startTime).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            console.error('Error updating min label:', error);
            minLabel.textContent = 'Invalid Date';
        }
    }
    
    if (maxLabel) {
        try {
            maxLabel.textContent = new Date(endTime).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            console.error('Error updating max label:', error);
            maxLabel.textContent = 'Invalid Date';
        }
    }
};

TimeSeriesChart.prototype.applyBrushToAllCharts = function(brush) {
    console.log('Applying brush to all charts:', brush);
    
    // Apply brush to main chart
    if (this.chart && brush) {
        try {
            this.chart.zoom(brush);
        } catch (error) {
            console.error('Error applying brush to main chart:', error);
        }
    }
    
    // Apply brush to all additional charts
    this.charts.forEach((chartData, index) => {
        if (chartData.chart && brush) {
            try {
                chartData.chart.zoom(brush);
            } catch (error) {
                console.error(`Error applying brush to additional chart ${index}:`, error);
            }
        }
    });
};

TimeSeriesChart.prototype.addChartTitle = function(chart, title) {
    console.log('addChartTitle called with:', { chart, title, hasInternal: !!(chart && chart.internal), hasSvg: !!(chart && chart.internal && chart.internal.svg) });
    
    if (!chart || !chart.internal || !chart.internal.svg) {
        console.warn('Chart or SVG not available for title');
        return;
    }
    
    console.log('Chart dimensions:', { width: chart.internal.width, height: chart.internal.height });
    
    // Remove existing title if it exists
    chart.internal.svg.select('.chart-title').remove();
    
    // Add new title
    const titleElement = chart.internal.svg
        .append("text")
        .attr("x", chart.internal.width / 2)
        .attr("y", 20) // Position below the top margin
        .attr("text-anchor", "middle")
        .attr("class", "chart-title")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .text(title);
    
    console.log('Title element created:', titleElement);
};

// Export for external use
window.TimeSeriesChart = TimeSeriesChart;