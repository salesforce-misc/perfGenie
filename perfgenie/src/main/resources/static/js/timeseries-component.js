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
        this.isSorted = false; // Track if data is currently sorted
        this.originalData = null; // Store original data for reverting
        this.isReverting = false; // Track if we're reverting from sorted data
        this.isUpdatingCharts = false; // Track if charts are being updated
        this.options = {
            height: 400,
            showLegend: true,
            showLegendText: true, // New option to control legend text visibility
            showCustomLegend: true, // New option to control custom legend div visibility
            showTooltip: true,
            showGrid: true,
            animate: true,
            useUTC: false, // Set to true to display times in UTC
            ...options
}
        this.timeSpanOptions = {
            '1min': 1 * 60 * 1000,
            '2min': 2 * 60 * 1000,
            '5min': 5 * 60 * 1000,
            '10min': 10 * 60 * 1000,
            '30min': 30 * 60 * 1000,
            '1hour': 60 * 60 * 1000,
            '6hour': 6 * 60 * 60 * 1000,
            '1day': 24 * 60 * 60 * 1000
}
        this.aggregationFunctions = {
            average: this.average,
            sum: this.sum,
            max: this.max,
            min: this.min,
            count: this.count
}
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
            .timeseries-component-sort-btn {
                background: rgba(108, 117, 125, 0.8);
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
            .timeseries-component-sort-btn:hover {
                background: rgba(108, 117, 125, 1);
                transform: scale(1.05);
            }
            .timeseries-component-sort-btn:active {
                transform: scale(0.95);
            }
            .timeseries-component-sort-btn.sorted {
                background: rgba(40, 167, 69, 0.8);
            }
            .timeseries-component-sort-btn.sorted:hover {
                background: rgba(40, 167, 69, 1);
            }
            .timeseries-component-upload-btn {
                background: transparent;
                color: #666;
                border: none;
                border-radius: 3px;
                width: 24px;
                height: 24px;
                cursor: pointer;
                font-size: 10px;
                line-height: 1;
                transition: all 0.2s ease;
                margin-left: 4px;
                flex-shrink: 0;
            }
            .timeseries-component-upload-btn:hover {
                background: rgba(0, 123, 255, 0.1);
                color: #007bff;
                transform: scale(1.05);
            }
            .timeseries-component-upload-btn:active {
                transform: scale(0.95);
            }
            .timeseries-component-upload-icon {
                display: block;
                font-size: 14px;
                line-height: 1;
                font-family: "FontAwesome", "Font Awesome 5 Free", "Font Awesome 6 Free";
                font-weight: 900;
            }
            .timeseries-component-sort-icon {
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
                min-width: 400px;
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
            .timeseries-component-time-input {
                min-width: 130px;
                padding: 0;
                border: none;
                border-radius: 3px;
                font-size: 10px;
                text-align: center;
                background: white;
                color: #333;
                flex-shrink: 0;
            }
            .timeseries-component-time-input:focus {
                outline: none;
                border-color: #007bff;
                box-shadow: 0 0 3px rgba(0, 123, 255, 0.3);
            }
            .timeseries-component-time-min,
            .timeseries-component-time-max {
                min-width: 130px !important;
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
                position: relative;
            }
            /* Drag selection disabled for performance */
            /* Subchart disabled for performance */
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
                /* Improve scrolling performance */
                -webkit-overflow-scrolling: touch;
                scroll-behavior: smooth;
                will-change: scroll-position;
            }
            .timeseries-component-chart {
                position: relative;
                width: 100%;
                /* Improve scrolling performance */
                transform: translateZ(0);
                backface-visibility: hidden;
                -webkit-backface-visibility: hidden;
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
                /* Disable wheel events on legend to prevent snapping */
                pointer-events: auto !important;
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
                pointer-events: none !important;
            }
            /* Legend styling */
            .timeseries-component-chart .c3-legend {
                pointer-events: auto !important;
                overflow: hidden !important;
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
                        '<input type="text" class="timeseries-component-time-input timeseries-component-time-min" id="' + this.containerId + '-time-min" placeholder="Start" onkeypress="if(event.key===\'Enter\') window.timeseriesComponentUpdateTimeFromInput(\'' + this.containerId + '\', this.value, \'min\')" onblur="window.timeseriesComponentUpdateTimeFromInput(\'' + this.containerId + '\', this.value, \'min\')">' +
                        '<button class="timeseries-component-apply-btn" onclick="window.timeseriesComponentApplyTimeRange(\'' + this.containerId + '\')" title="Apply Time Range">Apply</button>' +
                        '<button class="timeseries-component-reset-btn" onclick="window.timeseriesComponentResetZoom(\'' + this.containerId + '\')" title="Reset Zoom">Reset</button>' +
                        '<input type="text" class="timeseries-component-time-input timeseries-component-time-max" id="' + this.containerId + '-time-max" placeholder="End" onkeypress="if(event.key===\'Enter\') window.timeseriesComponentUpdateTimeFromInput(\'' + this.containerId + '\', this.value, \'max\')" onblur="window.timeseriesComponentUpdateTimeFromInput(\'' + this.containerId + '\', this.value, \'max\')">' +
                    '</div>' +
                '</div>' +
                '<button class="timeseries-component-sort-btn" onclick="window.timeseriesComponentToggleSort(\'' + this.containerId + '\')" title="Sort Each Series (Descending)">' +
                    '<span class="timeseries-component-sort-icon">⇅</span>' +
                '</button>' +
                '<button class="timeseries-component-upload-btn" onclick="window.timeseriesComponentUploadCSV(\'' + this.containerId + '\')" title="Upload CSV File">' +
                    '<span class="timeseries-component-upload-icon">↑</span>' +
                '</button>' +
                '<input type="file" id="' + this.containerId + '-csv-upload" accept=".csv" style="display: none;" onchange="window.timeseriesComponentHandleCSVUpload(\'' + this.containerId + '\', this)">' +
                '<button class="timeseries-component-close-btn" onclick="window.timeseriesComponentCloseScrollContainer(\'' + this.containerId + '\')" title="Close Chart">' +
                    '<span class="timeseries-component-close-icon">&times;</span>' +
                '</button>' +
            '</div>' +
            '<div class="timeseries-component-scroll-container" id="' + this.containerId + '-scroll-container">' +
                '<div id="' + this.containerId + '-chart" class="timeseries-component-chart">' +
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
        // Drag-to-zoom functionality disabled for performance
        // this.setupDragToZoom();
        
        // Prevent mouse wheel zoom on chart containers to avoid snapping during scroll
        this.preventMouseWheelZoom();
        
        // Completely disable global wheel event prevention to allow smooth scrolling
        // this.preventGlobalLegendWheelZoom();
    }
    loadData(timestamps, metrics, chartTitle = null, colors = null) {
        this.timestamps = timestamps;
        this.metrics = metrics;
        this.chartTitle = chartTitle;
        this.chartColors = colors;
        
        // Reset sort state when loading new data
        this.isSorted = false;
        this.originalData = null;
        
        // Update sort button appearance
        const sortBtn = document.querySelector('#' + this.containerId + ' .timeseries-component-sort-btn');
        if (sortBtn) {
            sortBtn.classList.remove('sorted');
            sortBtn.title = 'Sort Each Series (Descending)';
        }
        
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
}
        // Show the chart if it was hidden
        this.showChart();
        // Create the main chart
        this.updateMainChart();
        
        // Initialize slider values and range indicator for new data
        this.updateSliderValues();
        this.updateRangeIndicator();
    }
    addChart(timestamps, metrics, isMainChart = false, chartTitle = null, colors = null) {
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
}
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
        
        // Prevent mouse wheel zoom on this chart container
        // Disable wheel event prevention to allow smooth scrolling
        // chartContainer.addEventListener('wheel', (e) => {
        //     e.preventDefault();
        //     e.stopPropagation();
        // }, { passive: false });
        
        // Disable wheel event prevention to allow smooth scrolling
        // this.preventLegendWheelZoomForChart(chartContainer);
        
        // Create chart data object
        const chartData = {
            id: newChartId,
            timestamps: timestamps,
            metrics: metrics,
            chart: null,
            title: chartTitle,
            colors: colors
}
        // Store processed chart data for recreation (not raw data)
        const processedData = this.processChartData(timestamps, metrics, colors);
        const storedChartData = {
            id: newChartId,
            processedData: processedData,
            originalTimestamps: [...timestamps],
            originalMetrics: JSON.parse(JSON.stringify(metrics)),
            trulyOriginalTimestamps: [...timestamps], // Store truly original data for zoom reset
            trulyOriginalMetrics: JSON.parse(JSON.stringify(metrics)), // Store truly original data for zoom reset
            title: chartTitle,
            colors: colors ? JSON.parse(JSON.stringify(colors)) : null
}
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
        if (!this.timestamps.length || !Object.keys(this.metrics).length) {
            console.error('No data available in updateChart');
            this.showError('No data available');
            return;
        }
        
        // Set flag to indicate charts are being updated
        this.isUpdatingCharts = true;
        
        // Update main chart
        this.updateMainChart();
        // Update all additional charts
        this.charts.forEach(chartData => {
            this.updateAdditionalChart(chartData);
        });
        
        // Reset flag after a short delay
        setTimeout(() => {
            this.isUpdatingCharts = false;
        }, 200);
    }
    updateMainChart() {
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
}
        // Render the main chart using the same method as additional charts
        this.renderAdditionalChart(chartData);
        this.chart = chartData.chart; // Store reference to main chart
        // Add title after chart is created
        setTimeout(() => {
            if (this.chartTitle && this.chart) {
                this.addChartTitle(this.chart, this.chartTitle);
            }
        }, 100);
        
        // Initialize slider values and range indicator
        this.updateSliderValues();
        this.updateRangeIndicator();
    }
    updateAdditionalChart(chartData) {
        if (chartData.chart) {
            chartData.chart.destroy();
            chartData.chart = null;
        }
        
        // Find the corresponding stored data for this chart
        const chartIndex = this.charts.indexOf(chartData);
        const storedData = this.storedAdditionalChartsData[chartIndex];
        
        if (storedData && storedData.originalTimestamps && storedData.originalMetrics) {
            // Use sorted data if in sorted mode, otherwise use original data
            let timestamps = this.isSorted && storedData.sortedTimestamps ? storedData.sortedTimestamps : storedData.originalTimestamps;
            let metrics = this.isSorted && storedData.sortedMetrics ? storedData.sortedMetrics : storedData.originalMetrics;
            
            // Apply zoom filtering if there's a current zoom range
            if (storedData.currentZoomRange && storedData.currentZoomRange.length === 2) {
                const [startTime, endTime] = storedData.currentZoomRange;
                const filteredTimestamps = [];
                const filteredMetrics = {};
                
                // Initialize filtered metrics
                Object.keys(metrics).forEach(metricName => {
                    filteredMetrics[metricName] = [];
                });
                
                // Filter data within zoom range
                for (let i = 0; i < timestamps.length; i++) {
                    const timestamp = typeof timestamps[i] === 'number' ? timestamps[i] : new Date(timestamps[i]).getTime();
                    if (timestamp >= startTime && timestamp <= endTime) {
                        filteredTimestamps.push(timestamps[i]);
                        Object.keys(metrics).forEach(metricName => {
                            filteredMetrics[metricName].push(metrics[metricName][i]);
                        });
                    }
                }
                
                timestamps = filteredTimestamps;
                metrics = filteredMetrics;
            }
            
            const updatedChartData = {
                id: chartData.id,
                timestamps: timestamps,
                metrics: metrics,
                chart: null,
                title: storedData.title,
                colors: storedData.colors
            };
            this.renderAdditionalChart(updatedChartData);
            // IMPORTANT: Update the original chartData with the new chart reference
            chartData.chart = updatedChartData.chart;
        } else {
            // Fallback to original chartData if stored data is not available
        this.renderAdditionalChart(chartData);
        }
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
}
    }
    groupByTimeSpan(timestamps, timeSpan) {
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
            } catch (error) {
            console.error('Error in processChartData:', error);
            this.showError('Error processing chart data: ' + error.message);
            return;
        }
        const chartType = document.getElementById(this.containerId + '-chartType').value;
        // Use current height multiplier for chart height
        const chartHeight = Math.round(this.options.height * this.heightMultiplier);
        // Determine if we should show points and labels based on data size
        // Use the original data from this.timestamps and this.metrics
        const totalDataPoints = this.timestamps ? this.timestamps.length : 0;
        const totalSeries = this.metrics ? Object.keys(this.metrics).length : 0;
        const showPoints = totalDataPoints <= 50;
        // Show value labels only on bar charts when there are few data points
        const showValueLabels = totalDataPoints <= 20 && (chartType === 'bar');
        const showXAxisGrid = totalDataPoints <= 100;
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
        // Override the size to use current height multiplier
        data.size = {
            width: this.getChartWidth(),
            height: chartHeight
}
        // Validate data structure before passing to C3.js
        if (data.data.columns) {
            data.data.columns.forEach((col, i) => {
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
            transition: {
                duration: 0
            },
            subchart: {
                show: false,
                size: {
                    height: 60
                }
            },
            zoom: {
                enabled: false
            },
            onrendered: () => {
                // Add chart title using C3's internal SVG
                if (this.chartTitle) {
                    this.addChartTitle(this.chart, this.chartTitle);
                }
                
                // Add legend click functionality
                this.setupLegendClickHandler(this.chart);
            }
        });
        // Debug: Check the actual computed styles after chart creation and position legend
        setTimeout(() => {
            const chartContainer = document.getElementById(this.containerId + '-chart');
            const legend = chartContainer.querySelector('.c3-legend');
            const xAxis = chartContainer.querySelector('.c3-axis-x');
            // Add chart title if provided
            if (this.chartTitle) {
                this.addChartTitle(this.chart, this.chartTitle);
            }
            // Force position legend at bottom-left
            if (legend) {
                legend.style.position = 'absolute';
                legend.style.bottom = '10px';
                legend.style.left = '10px';
                legend.style.transform = 'translate(0, 0)';
                legend.style.zIndex = '10';
                }
            // Subchart disabled for performance
        }, 100);
        // Apply dynamic label visibility based on current series count and chart type
        this.applyDynamicLabelVisibility(chartType, totalSeries);
        // Initialize time labels and range indicator
        const initStartTime = performance.now();
        // Ensure timestamps are properly converted to numbers for initialization
        const firstTimestamp = typeof this.timestamps[0] === 'number' ? this.timestamps[0] : new Date(this.timestamps[0]).getTime();
        const lastTimestamp = typeof this.timestamps[this.timestamps.length - 1] === 'number' ? this.timestamps[this.timestamps.length - 1] : new Date(this.timestamps[this.timestamps.length - 1]).getTime();
        this.updateTimeLabels(firstTimestamp, lastTimestamp);
        this.updateRangeIndicator();
        const initEndTime = performance.now();
        // Apply legend text visibility based on option
        this.applyLegendTextVisibility();
        // Apply custom legend visibility based on option
        this.applyCustomLegendVisibility();
        this.hideLoading();
    }
    applyDynamicLabelVisibility(chartType, totalSeries) {
        // Labels are now controlled only by data point count, not series count
        // This method is kept for future extensibility but doesn't modify labels
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
    
    // Percentile calculation functions
    calculatePercentile(values, percentile) {
        if (!Array.isArray(values) || values.length === 0) return 0;
        
        // Filter out null, undefined, and NaN values
        const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
        
        if (validValues.length === 0) return 0;
        
        const sorted = [...validValues].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
        return sorted[Math.max(0, index)];
    }

    // Find matching percentile series for comparison (current week vs last week)
    findMatchingPercentileSeries(percentileType, metricName, metricNames) {
        // Look for series with same percentile but different week
        for (const [seriesId, seriesName] of Object.entries(metricNames)) {
            if (seriesName.startsWith(percentileType + ' - ')) {
                const parts = seriesName.split(' - ');
                if (parts.length === 2) {
                    const otherMetricName = parts[1];
                    
                    // Check if this is a matching metric (same base metric, different week)
                    const isMatch = this.isMatchingMetric(metricName, otherMetricName);
                    
                    if (isMatch) {
                        return { id: seriesId, name: seriesName };
                    }
                }
            }
        }
        return null;
    }

    // Find matching regular series for comparison (current week vs last week)
    findMatchingRegularSeries(metricName, metricNames) {
        console.log('Looking for matching regular series for:', metricName);
        console.log('Available series:', Object.values(metricNames));
        
        // Look for regular series (not percentile) with different week
        for (const [seriesId, seriesName] of Object.entries(metricNames)) {
            // Skip percentile series
            if (seriesName.startsWith('P99') || seriesName.startsWith('P95') || seriesName.startsWith('P90') || seriesName.startsWith('P50')) {
                continue;
            }
            
            console.log('Checking regular series:', seriesName);
            
            // Check if this is a matching metric (same base metric, different week)
            const isMatch = this.isMatchingMetric(metricName, seriesName);
            console.log('Is match:', isMatch, 'for', metricName, 'vs', seriesName);
            
            if (isMatch) {
                return { id: seriesId, name: seriesName };
            }
        }
        console.log('No matching regular series found');
        return null;
    }

    // Check if two metric names represent the same metric from different weeks
    isMatchingMetric(metric1, metric2) {
        // Extract the base metric name by removing any week indicators (anywhere in the string)
        const base1 = metric1.replace(/-lastweek-/, '-').replace(/-thisweek-/, '-').replace(/-week\d+-/, '-');
        const base2 = metric2.replace(/-lastweek-/, '-').replace(/-thisweek-/, '-').replace(/-week\d+-/, '-');
        
        // Check if one has a week indicator and the other doesn't (anywhere in the string)
        const hasWeekIndicator1 = /-(lastweek|thisweek|week\d+)-/.test(metric1);
        const hasWeekIndicator2 = /-(lastweek|thisweek|week\d+)-/.test(metric2);
        
        console.log('Matching check:', { 
            metric1, metric2, 
            base1, base2, 
            hasWeekIndicator1, hasWeekIndicator2,
            baseMatch: base1 === base2,
            weekDifferent: hasWeekIndicator1 !== hasWeekIndicator2
        });
        
        // Must be different weeks (one has week indicator, other doesn't) and same base metric
        // For now, let's be more flexible and just check if they have different week indicators
        // and the metric suffix (after the last dash) is the same
        const suffix1 = base1.split('-').pop();
        const suffix2 = base2.split('-').pop();
        
        return suffix1 === suffix2 && hasWeekIndicator1 !== hasWeekIndicator2;
    }

    // Filter data by time range
    filterDataByTimeRange(timestamps, metrics, startTime, endTime) {
        if (!timestamps || !metrics || !Array.isArray(timestamps)) {
            return null;
        }
        
        const filteredTimestamps = [];
        const filteredMetrics = {};
        
        // Initialize filtered metrics
        Object.keys(metrics).forEach(metricName => {
            filteredMetrics[metricName] = [];
        });
        
        // Filter data points within the time range
        for (let i = 0; i < timestamps.length; i++) {
            const timestamp = typeof timestamps[i] === 'number' ? timestamps[i] : new Date(timestamps[i]).getTime();
            if (timestamp >= startTime && timestamp <= endTime) {
                filteredTimestamps.push(timestamps[i]);
                Object.keys(metrics).forEach(metricName => {
                    filteredMetrics[metricName].push(metrics[metricName][i]);
                });
            }
        }
        
        return {
            timestamps: filteredTimestamps,
            metrics: filteredMetrics
        };
    }

    // Get value at specific index for a series
    getSeriesValueAt(seriesId, index, chartData) {
        if (!chartData || !chartData.columns) return null;
        
        try {
            // Find the column data for the series
            const column = chartData.columns.find(col => col && col[0] === seriesId);
            if (!column || !column[index + 1]) return null;
            
            return column[index + 1];
        } catch (e) {
            console.log('Error getting series value:', e);
            return null;
        }
    }

    // Calculate percentage change: 100 * (lastweek - current) / lastweek
    calculatePercentageChange(currentValue, lastWeekValue) {
        if (lastWeekValue === 0) {
            if (currentValue === 0) return '0%';
            return currentValue > 0 ? '+∞%' : '-∞%';
        }
        const change = ((lastWeekValue - currentValue) / lastWeekValue) * 100;
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(1)}%`;
    }

    // Get current chart data for tooltip calculations
    getCurrentChartData() {
        // Try to get data from the main chart first
        if (this.chart && this.chart.data) {
            try {
                // C3.js data access methods
                const columns = this.chart.data.columns ? this.chart.data.columns() : [];
                const names = this.chart.data.names ? this.chart.data.names() : {};
                return { columns, names };
            } catch (e) {
                console.log('Error accessing chart data:', e);
            }
        }
        
        // Fallback to stored processed data
        if (this.processedData) {
            return this.processedData.data;
        }
        
        return null;
    }
    
    p99(values) {
        return this.calculatePercentile(values, 99);
    }
    
    p95(values) {
        return this.calculatePercentile(values, 95);
    }
    
    p90(values) {
        return this.calculatePercentile(values, 90);
    }
    
    p50(values) {
        return this.calculatePercentile(values, 50);
    }
    
    calculateAverage(values) {
        const nonNullValues = values.filter(val => val !== null && val !== undefined && !isNaN(val));
        if (nonNullValues.length === 0) return 0;
        
        const sum = nonNullValues.reduce((acc, val) => acc + val, 0);
        return sum / nonNullValues.length;
    }
    
    // Format timestamp based on UTC setting
    formatTimestamp(timestamp, options = {}) {
        const date = new Date(timestamp);
        
        if (this.options.useUTC) {
            // Custom UTC format: Jan-dd hr:mm:ss UTC
            const utcDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = monthNames[utcDate.getMonth()];
            const day = String(utcDate.getDate()).padStart(2, '0');
            const hours = String(utcDate.getHours()).padStart(2, '0');
            const minutes = String(utcDate.getMinutes()).padStart(2, '0');
            const seconds = String(utcDate.getSeconds()).padStart(2, '0');
            return `${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
        } else {
            // Use default local timezone format
            const formatOptions = {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
                ...options
            };
            return date.toLocaleString('en-US', formatOptions);
        }
    }
    
    // Public API methods
    updateData(timestamps, metrics, chartTitle = null, colors = null) {
        this.loadData(timestamps, metrics, chartTitle, colors);
    }
    setTimeSpan(timeSpan) {
        document.getElementById(this.containerId + '-timeSpan').value = timeSpan;
        this.updateChart();
    }
    
    setUTC(useUTC) {
        this.options.useUTC = useUTC;
        // Update existing charts if they exist
        if (this.chart) {
            this.updateChart();
        }
        this.charts.forEach(chartData => {
            if (chartData.chart) {
                this.updateAdditionalChart(chartData);
            }
        });
    }
    
    isUTC() {
        return this.options.useUTC;
    }
    
    // Sort data by values and toggle between sorted and original view
    toggleSort() {
        if (this.isSorted) {
            this.revertToOriginalData();
        } else {
            this.sortDataByValues();
        }
    }
    
    // Sort the current data by values (ascending order)
    sortDataByValues() {
        if (!this.timestamps || !this.metrics || this.timestamps.length === 0) {
            console.error('No data available for sorting');
            return;
        }
        
        // Store pre-sort data for reverting (this preserves zoom state)
        // Deep clone the storedAdditionalChartsData to preserve pre-sort state
        const preSortStoredAdditionalChartsData = this.storedAdditionalChartsData ? 
            this.storedAdditionalChartsData.map(storedData => ({
                ...storedData,
                originalTimestamps: [...storedData.originalTimestamps],
                originalMetrics: JSON.parse(JSON.stringify(storedData.originalMetrics)),
                trulyOriginalTimestamps: storedData.trulyOriginalTimestamps ? [...storedData.trulyOriginalTimestamps] : null,
                trulyOriginalMetrics: storedData.trulyOriginalMetrics ? JSON.parse(JSON.stringify(storedData.trulyOriginalMetrics)) : null
            })) : null;
            
        this.originalData = {
            timestamps: [...this.timestamps],
            metrics: JSON.parse(JSON.stringify(this.metrics)),
            chartTitle: this.chartTitle,
            chartColors: this.chartColors ? JSON.parse(JSON.stringify(this.chartColors)) : null,
            zoomRange: this.zoomRange ? [...this.zoomRange] : null,
            storedAdditionalChartsData: preSortStoredAdditionalChartsData
        };
        
        // Determine which data to sort based on zoom state
        let dataToSort = {
            timestamps: [...this.timestamps],
            metrics: JSON.parse(JSON.stringify(this.metrics))
        };
        
        // If there's a zoom range, sort only the data within that range
        if (this.zoomRange && this.zoomRange.length === 2) {
            const [startTime, endTime] = this.zoomRange;
            const filteredTimestamps = [];
            const filteredMetrics = {};
            
            // Initialize filtered metrics
            Object.keys(this.metrics).forEach(metricName => {
                filteredMetrics[metricName] = [];
            });
            
            // Filter data within zoom range
            for (let i = 0; i < this.timestamps.length; i++) {
                const timestamp = typeof this.timestamps[i] === 'number' ? this.timestamps[i] : new Date(this.timestamps[i]).getTime();
                if (timestamp >= startTime && timestamp <= endTime) {
                    filteredTimestamps.push(this.timestamps[i]);
                    Object.keys(this.metrics).forEach(metricName => {
                        filteredMetrics[metricName].push(this.metrics[metricName][i]);
                    });
                }
            }
            
            dataToSort = {
                timestamps: filteredTimestamps,
                metrics: filteredMetrics
            };
        }
        
        // Create array of data points with timestamps and all metric values
        const dataPoints = [];
        for (let i = 0; i < dataToSort.timestamps.length; i++) {
            const point = {
                timestamp: dataToSort.timestamps[i],
                values: {}
            };
            
            // Collect all metric values for this timestamp
            Object.keys(dataToSort.metrics).forEach(metricName => {
                point.values[metricName] = dataToSort.metrics[metricName][i];
            });
            
            // Calculate sort value using maximum value across all series (better for multiple series)
            const values = Object.values(point.values).filter(v => v !== null && v !== undefined);
            point.sortValue = values.length > 0 ? Math.max(...values) : 0;
            
            dataPoints.push(point);
        }
        
        // Sort each series independently (descending order - highest to lowest)
        const sortedMetrics = {};
        
        Object.keys(dataToSort.metrics).forEach(metricName => {
            // Create array of {value, originalIndex} for this metric
            const metricData = dataPoints.map((point, index) => ({
                value: point.values[metricName],
                originalIndex: index
            }));
            
            // Sort by value in descending order, handling null values
            metricData.sort((a, b) => {
                // Handle null/undefined values - put them at the end
                if (a.value === null || a.value === undefined) return 1;
                if (b.value === null || b.value === undefined) return -1;
                return b.value - a.value;
            });
            
            // Extract sorted values
            sortedMetrics[metricName] = metricData.map(item => item.value);
        });
        
        // For timestamps, we'll use the first series' sort order as the reference
        // (or we could create a combined sort, but this keeps it simple)
        const firstMetricName = Object.keys(dataToSort.metrics)[0];
        if (firstMetricName) {
            const firstMetricData = dataPoints.map((point, index) => ({
                value: point.values[firstMetricName],
                originalIndex: index
            }));
            firstMetricData.sort((a, b) => b.value - a.value);
            
            // Reconstruct timestamps based on first series sort order
            const sortedTimestamps = firstMetricData.map(item => dataPoints[item.originalIndex].timestamp);
            this.timestamps = sortedTimestamps;
        }
        
        // Update the data
        this.metrics = sortedMetrics;
        
        // Also sort the data for additional charts
        this.storedAdditionalChartsData.forEach((storedData, index) => {
            if (storedData.originalTimestamps && storedData.originalMetrics) {
                // Apply the same sorting logic to additional chart data
                let additionalDataToSort = {
                    timestamps: [...storedData.originalTimestamps],
                    metrics: JSON.parse(JSON.stringify(storedData.originalMetrics))
                };
                
                // If there's a zoom range, sort only the data within that range for additional charts too
                if (this.zoomRange && this.zoomRange.length === 2) {
                    const [startTime, endTime] = this.zoomRange;
                    const filteredTimestamps = [];
                    const filteredMetrics = {};
                    
                    // Initialize filtered metrics
                    Object.keys(storedData.originalMetrics).forEach(metricName => {
                        filteredMetrics[metricName] = [];
                    });
                    
                    // Filter data within zoom range
                    for (let i = 0; i < storedData.originalTimestamps.length; i++) {
                        const timestamp = typeof storedData.originalTimestamps[i] === 'number' ? storedData.originalTimestamps[i] : new Date(storedData.originalTimestamps[i]).getTime();
                        if (timestamp >= startTime && timestamp <= endTime) {
                            filteredTimestamps.push(storedData.originalTimestamps[i]);
                            Object.keys(storedData.originalMetrics).forEach(metricName => {
                                filteredMetrics[metricName].push(storedData.originalMetrics[metricName][i]);
                            });
                        }
                    }
                    
                    additionalDataToSort = {
                        timestamps: filteredTimestamps,
                        metrics: filteredMetrics
                    };
                }
                
                // Sort the additional chart data using the same logic
                const additionalDataPoints = [];
                for (let i = 0; i < additionalDataToSort.timestamps.length; i++) {
                    const point = {
                        timestamp: additionalDataToSort.timestamps[i],
                        values: {}
                    };
                    
                    Object.keys(additionalDataToSort.metrics).forEach(metricName => {
                        point.values[metricName] = additionalDataToSort.metrics[metricName][i];
                    });
                    
                    const values = Object.values(point.values).filter(v => v !== null && v !== undefined);
                    point.sortValue = values.length > 0 ? Math.max(...values) : 0;
                    
                    additionalDataPoints.push(point);
                }
                
                const additionalSortedMetrics = {};
                Object.keys(additionalDataToSort.metrics).forEach(metricName => {
                    const metricData = additionalDataPoints.map((point, index) => ({
                        value: point.values[metricName],
                        originalIndex: index
                    }));
                    
                    metricData.sort((a, b) => {
                        if (a.value === null || a.value === undefined) return 1;
                        if (b.value === null || b.value === undefined) return -1;
                        return b.value - a.value;
                    });
                    
                    additionalSortedMetrics[metricName] = metricData.map(item => item.value);
                });
                
                // Store sorted data separately without modifying the original stored data
                const firstMetricName = Object.keys(additionalDataToSort.metrics)[0];
                if (firstMetricName) {
                    const firstMetricData = additionalDataPoints.map((point, index) => ({
                        value: point.values[firstMetricName],
                        originalIndex: index
                    }));
                    firstMetricData.sort((a, b) => b.value - a.value);
                    
                    const sortedTimestamps = firstMetricData.map(item => additionalDataPoints[item.originalIndex].timestamp);
                    // Store sorted data separately
                    storedData.sortedTimestamps = sortedTimestamps;
                }
                storedData.sortedMetrics = additionalSortedMetrics;
            }
        });
        
        // Mark as sorted
        this.isSorted = true;
        
        // Change chart type to line for sorted view
        const chartTypeSelect = document.getElementById(this.containerId + '-chartType');
        if (chartTypeSelect) {
            chartTypeSelect.value = 'line';
        }
        
        // Hide time range slider for sorted data
        this.hideTimeRangeSlider();
        
        // Update the sort button appearance
        const sortBtn = document.querySelector('#' + this.containerId + ' .timeseries-component-sort-btn');
        if (sortBtn) {
            sortBtn.classList.add('sorted');
            sortBtn.title = 'Revert to Time Series (Currently: Each Series Sorted Descending)';
        }
        
        // Update all charts
        this.updateChart();
        
        console.log('Data sorted by values');
    }
    
    // Revert to original time series data
    revertToOriginalData() {
        if (!this.originalData) {
            console.error('No original data available for reverting');
            return;
        }
        
        // Set flag to indicate we're reverting
        this.isReverting = true;
        
        // Restore original data
        this.timestamps = this.originalData.timestamps;
        this.metrics = this.originalData.metrics;
        this.chartTitle = this.originalData.chartTitle;
        this.chartColors = this.originalData.chartColors;
        this.zoomRange = this.originalData.zoomRange;
        
        // Restore additional charts data to original unsorted state
        if (this.originalData.storedAdditionalChartsData) {
            this.storedAdditionalChartsData = this.originalData.storedAdditionalChartsData;
        }
        
        // Clear sorted data from stored additional charts
        this.storedAdditionalChartsData.forEach(storedData => {
            if (storedData.sortedTimestamps) {
                delete storedData.sortedTimestamps;
            }
            if (storedData.sortedMetrics) {
                delete storedData.sortedMetrics;
            }
        });
        
        // Clear original data
        this.originalData = null;
        
        // Mark as not sorted
        this.isSorted = false;
        
        // Reset chart type to original (or default to line)
        const chartTypeSelect = document.getElementById(this.containerId + '-chartType');
        if (chartTypeSelect) {
            chartTypeSelect.value = 'line'; // Default to line chart
        }
        
        // Show time range slider for time series data
        this.showTimeRangeSlider();
        
        // Update the sort button appearance
        const sortBtn = document.querySelector('#' + this.containerId + ' .timeseries-component-sort-btn');
        if (sortBtn) {
            sortBtn.classList.remove('sorted');
            sortBtn.title = 'Sort Each Series (Descending)';
        }
        
        // If there was a zoom range, create charts with zoomed data directly
        if (this.zoomRange && this.zoomRange.length === 2) {
            // Temporarily filter data to zoomed range
            const [startTime, endTime] = this.zoomRange;
            const originalTimestamps = [...this.timestamps];
            const originalMetrics = JSON.parse(JSON.stringify(this.metrics));
            
            // Filter data to zoomed range
            const filteredTimestamps = [];
            const filteredMetrics = {};
            
            // Initialize filtered metrics
            Object.keys(this.metrics).forEach(metricName => {
                filteredMetrics[metricName] = [];
            });
            
            // Filter data within zoom range
            for (let i = 0; i < this.timestamps.length; i++) {
                const timestamp = typeof this.timestamps[i] === 'number' ? this.timestamps[i] : new Date(this.timestamps[i]).getTime();
                if (timestamp >= startTime && timestamp <= endTime) {
                    filteredTimestamps.push(this.timestamps[i]);
                    Object.keys(this.metrics).forEach(metricName => {
                        filteredMetrics[metricName].push(this.metrics[metricName][i]);
                    });
                }
            }
            
            // Temporarily set data to zoomed range
            this.timestamps = filteredTimestamps;
            this.metrics = filteredMetrics;
            
            // Store the zoom range for additional charts to use during rendering
            this.storedAdditionalChartsData.forEach(storedData => {
                storedData.currentZoomRange = [startTime, endTime];
            });
            
            // Create charts with zoomed data
            this.updateChart();
            
            // Restore full data but keep zoom range
            this.timestamps = originalTimestamps;
            this.metrics = originalMetrics;
            
            this.isReverting = false;
        } else {
            // No zoom range, just update charts normally
            this.updateChart();
            this.isReverting = false;
        }
        
        // Update slider values to reflect the restored data
        this.updateSliderValues();
        this.updateRangeIndicator();
        
        console.log('Reverted to original time series data');
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
        if (this.chart) {
            const chartContainer = document.getElementById(this.containerId + '-chart');
            const scrollContainer = chartContainer.parentElement;
            if (chartContainer && scrollContainer) {
                // Get the scroll container width as base
                const baseWidth = scrollContainer.offsetWidth;
                const newWidth = baseWidth * multiplier;
                // Only set minWidth on the chart container, not width
                // This allows the chart to expand but doesn't force the container width
                chartContainer.style.minWidth = newWidth + 'px';
                chartContainer.style.width = 'auto'; // Let it size naturally
                // Resize the main chart with the new width
                if (this.chart) {
                    const newHeight = Math.round(this.options.height * this.heightMultiplier);
                    this.chart.resize({
                        width: newWidth,
                        height: newHeight
                    });
                    }
                // Also update the main chart container height to match current height multiplier
                const mainChartContainer = document.getElementById(this.containerId + '-chart');
                if (mainChartContainer) {
                    const newHeight = Math.round(this.options.height * this.heightMultiplier);
                    mainChartContainer.style.height = newHeight + 'px';
                    }
                // Resize all additional charts within the same scroll container
                this.charts.forEach((chartData, index) => {
                    if (chartData.chart) {
                        // Resize the chart
                        const newHeight = Math.round(this.options.height * this.heightMultiplier);
                        chartData.chart.resize({
                            width: newWidth,
                            height: newHeight
                        });
                        } else {
                        }
                    // Also resize the chart container
                    const additionalChartContainer = document.getElementById(chartData.id);
                    if (additionalChartContainer) {
                        const newHeight = Math.round(this.options.height * this.heightMultiplier);
                        additionalChartContainer.style.minWidth = newWidth + 'px';
                        additionalChartContainer.style.width = 'auto';
                        additionalChartContainer.style.maxWidth = 'none'; // Remove max-width constraint
                        additionalChartContainer.style.height = newHeight + 'px';
                        } else {
                        console.error('Additional chart container not found:', chartData.id);
                    }
                });
                // Also apply width and height to all chart containers directly via DOM query
                const allChartContainers = scrollContainer.querySelectorAll('.timeseries-component-chart');
                const newHeight = Math.round(this.options.height * this.heightMultiplier);
                allChartContainers.forEach((container, index) => {
                    container.style.minWidth = newWidth + 'px';
                    container.style.width = 'auto';
                    container.style.maxWidth = 'none';
                    container.style.height = newHeight + 'px';
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
        const newHeight = Math.round(this.options.height * multiplier);
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
            }
        // Reload main chart data first
        if (this.storedMainChartData && this.storedMainChartData.timestamps && this.storedMainChartData.metrics) {
            this.loadData(this.storedMainChartData.timestamps, this.storedMainChartData.metrics, this.storedMainChartData.title, this.storedMainChartData.colors);
            // Apply height to the main chart after it's created
            if (this.chart) {
                this.chart.resize({
                    width: this.getChartWidth(),
                    height: newHeight
                });
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
                }
            this.addChart(storedData.originalTimestamps, storedData.originalMetrics, false, storedData.title, storedData.colors);
            // Apply height to the newly created chart
            const newChartData = this.charts[this.charts.length - 1];
            if (newChartData && newChartData.chart) {
                newChartData.chart.resize({
                    width: this.getChartWidth(),
                    height: newHeight
                });
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
            // Apply width and height to the chart container
            const additionalChartContainer = document.getElementById(chartData.id);
            if (additionalChartContainer) {
                additionalChartContainer.style.minWidth = newWidth + 'px';
                additionalChartContainer.style.width = 'auto';
                additionalChartContainer.style.maxWidth = 'none';
                additionalChartContainer.style.height = newHeight + 'px';
                }
            // Use setTimeout to ensure container height is set before resizing chart
            setTimeout(() => {
                // Resize the chart if it exists
                if (chartData.chart) {
                    chartData.chart.resize({
                        width: newWidth,
                        height: newHeight
                    });
                    }
            }, 50); // Small delay to ensure container height is set
        }
    }
    renderAdditionalChart(chartData) {
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
            // Filter data by zoom range if one exists (only for non-sorted data and not reverting)
            let timestamps = chartData.timestamps;
            let metrics = chartData.metrics;
            
            if (this.zoomRange && !this.isSorted && !this.isReverting) {
                const [startTime, endTime] = this.zoomRange;
                const filteredData = this.filterDataByTimeRange(timestamps, metrics, startTime, endTime);
                if (filteredData) {
                    timestamps = filteredData.timestamps;
                    metrics = filteredData.metrics;
                }
            }
            
            // Process data for this specific chart
            const processedData = this.processChartData(timestamps, metrics, chartData.colors);
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
            // Update the processed data with the same labeling logic
            processedData.data.labels = showValueLabels ? {
                format: (v) => parseFloat(v).toFixed(2)
            } : false;
            processedData.point.show = showPoints;
            processedData.grid.x.show = this.options.showGrid && showXAxisGrid;
            // Use a reasonable tick count based on data points
            const tickCount = Math.min(12, Math.max(5, Math.floor(totalDataPoints / 1000)));
            processedData.axis.x.tick.count = tickCount;
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
                transition: {
                    duration: 0
                },
                zoom: {
                    enabled: false
                },
                onrendered: () => {
                    // Add chart title using C3's internal SVG
                    if (chartData.title) {
                        this.addChartTitle(chartData.chart, chartData.title);
                    }
                    
                    // Add legend click functionality
                    this.setupLegendClickHandler(chartData.chart);
                }
            });
            // Zoom range is now applied during data filtering above, no need for post-creation redraw
            // Drag-to-zoom functionality disabled for performance
            // this.setupDragToZoomForChart(chartData.id);
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
                    }
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
        if (!timestamps || !Array.isArray(timestamps)) {
            console.error('Invalid timestamps in processChartData:', timestamps);
            return null;
        }
        if (!metrics || typeof metrics !== 'object') {
            console.error('Invalid metrics in processChartData:', metrics);
            return null;
        }
        
        // Check if data is sorted - if so, use sequential indices instead of time-based processing
        if (this.isSorted) {
            return this.processSortedChartData(timestamps, metrics, colors);
        }
        
        const timeSpan = this.timeSpanOptions[document.getElementById(this.containerId + '-timeSpan').value];
        const aggregation = document.getElementById(this.containerId + '-aggregation').value;
        const aggregationFunc = this.aggregationFunctions[aggregation];
        // Group timestamps by time span
        const groupedData = this.groupByTimeSpan(timestamps, timeSpan);
        // Process each metric
        const processedMetrics = {};
        try {
            const metricKeys = Object.keys(metrics);
            for (let i = 0; i < metricKeys.length; i++) {
                const metricName = metricKeys[i];
                const values = metrics[metricName];
                // Ensure values is an array
                if (!Array.isArray(values)) {
                    console.error('Metric ' + metricName + ' values is not an array:', values);
                    processedMetrics[metricName] = [];
                    continue;
                }
                try {
                    processedMetrics[metricName] = this.aggregateMetricValues(values, groupedData, aggregationFunc);
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
        const finalData = {
            timestamps: timestampKeys,
            metrics: processedMetrics
}
        // Prepare data for C3
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
        const columns = [xValues];
        const chartColors = {};
        const metricNames = {};
        Object.keys(finalData.metrics).forEach((metricName, index) => {
            const dataKey = 'data' + index;
            const metricData = finalData.metrics[metricName] || {};
            // Convert object to array based on timestamps
            const values = finalData.timestamps.map(timestamp => {
                return metricData[timestamp] || null;
            });
            const columnData = [dataKey, ...values];
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
                        format: (x) => {
                            if (this.options.useUTC) {
                                // Use custom UTC format: Jan-dd hr:mm
                                const date = new Date(x);
                                const utcDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
                                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                const month = monthNames[utcDate.getMonth()];
                                const day = String(utcDate.getDate()).padStart(2, '0');
                                const hours = String(utcDate.getHours()).padStart(2, '0');
                                const minutes = String(utcDate.getMinutes()).padStart(2, '0');
                                return `${month}-${day} ${hours}:${minutes}`;
                            } else {
                                // Use D3 time format for local timezone
                                const formatString = this.getTimeFormat(finalData.timestamps);
                                return d3.timeFormat(formatString)(new Date(x));
                            }
                        },
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
                show: showPoints,
                r: 2.5
            },
            tooltip: {
                show: this.options.showTooltip,
                format: {
                    title: (d) => {
                        return this.formatTimestamp(d);
                    },
                    value: (value, ratio, id, index) => {
                        return parseFloat(value).toFixed(2);
                    }
                }
            },
            legend: {
                show: this.options.showLegend,
                position: 'bottom'
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
}
    }
    
    // Process chart data when sorted (use sequential indices instead of timestamps)
    processSortedChartData(timestamps, metrics, colors = null) {
        // Check if D3 is available
        if (typeof d3 === 'undefined') {
            console.error('D3.js is not loaded in processSortedChartData');
            return null;
        }
        
        // For sorted data, use sequential indices (0, 1, 2, 3...) instead of timestamps
        const indices = Array.from({length: timestamps.length}, (_, i) => i);
        
        // Prepare data for C3
        const xValues = ['x', ...indices];
        const columns = [xValues];
        const chartColors = {};
        const metricNames = {};
        
        let currentIndex = 0;
        Object.keys(metrics).forEach((metricName, index) => {
            const values = metrics[metricName];
            
            // Skip series that are completely null or empty
            if (!Array.isArray(values) || values.length === 0 || values.every(val => val === null || val === undefined)) {
                console.log(`Skipping null/empty series: ${metricName}`);
                return;
            }
            
            const dataKey = 'data' + currentIndex;
            const columnData = [dataKey, ...values];
            columns.push(columnData);
            
            // Use custom colors if provided, otherwise use default palette
            if (colors && colors[metricName]) {
                chartColors[dataKey] = colors[metricName];
            } else if (colors && colors[index] !== undefined) {
                chartColors[dataKey] = colors[index];
            } else {
                chartColors[dataKey] = this.colorPalette[currentIndex % this.colorPalette.length];
            }
            metricNames[dataKey] = metricName;
            currentIndex++;
        });
        
        // Add percentile calculations for each metric (4 percentiles per metric)
        Object.keys(metrics).forEach((metricName, index) => {
            const values = metrics[metricName];
            
            // Skip series that are completely null or empty
            if (!Array.isArray(values) || values.length === 0 || values.every(val => val === null || val === undefined)) {
                return;
            }
            
            // Find the original series color for this metric
            const originalDataKey = Object.keys(metricNames).find(key => metricNames[key] === metricName);
            const originalColor = originalDataKey ? chartColors[originalDataKey] : this.colorPalette[index % this.colorPalette.length];
            
            // Calculate percentiles and average for this specific metric
            const p99Value = this.p99(values);
            const p95Value = this.p95(values);
            const p90Value = this.p90(values);
            const p50Value = this.p50(values);
            const avgValue = this.calculateAverage(values);
            
            // Add percentile and average series for this metric (use original series color)
            const percentiles = [
                { name: 'P99', value: p99Value, color: originalColor },
                { name: 'P95', value: p95Value, color: originalColor },
                { name: 'P90', value: p90Value, color: originalColor },
                { name: 'P50', value: p50Value, color: originalColor },
                { name: 'AVG', value: avgValue, color: originalColor }
            ];
            
            percentiles.forEach(percentile => {
                const referenceDataKey = 'data' + currentIndex;
                
                if (percentile.name === 'AVG') {
                    // AVG: Create horizontal line with constant value
                    const avgColumnData = [referenceDataKey, ...Array(values.length).fill(percentile.value)];
                    columns.push(avgColumnData);
                    chartColors[referenceDataKey] = percentile.color;
                    metricNames[referenceDataKey] = `${percentile.name} - ${metricName}`;
                } else {
                    // Percentiles: Add single intersection point where series exactly matches percentile value
                    // Find the closest point to the percentile value
                    let closestIndex = 0;
                    let closestDistance = Math.abs(values[0] - percentile.value);
                    
                    for (let i = 1; i < values.length; i++) {
                        const distance = Math.abs(values[i] - percentile.value);
                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestIndex = i;
                        }
                    }
                    
                    // Create data with only the single intersection point
                    const intersectionColumnData = [referenceDataKey];
                    for (let i = 0; i < values.length; i++) {
                        if (i === closestIndex) {
                            intersectionColumnData.push(percentile.value);
                        } else {
                            intersectionColumnData.push(null);
                        }
                    }
                    
                    columns.push(intersectionColumnData);
                    chartColors[referenceDataKey] = percentile.color;
                    metricNames[referenceDataKey] = `${percentile.name} - ${metricName}`;
                }
                
                currentIndex++;
            });
        });
        
        const chartType = 'line'; // Always use line chart for sorted data
        const totalDataPoints = timestamps.length;
        const totalSeries = Object.keys(metrics).length + (Object.keys(metrics).length * 5); // Original metrics + 5 intersection points per metric (4 percentiles + 1 average)
        
        // Determine visibility settings
        const showPoints = totalDataPoints <= 50;
        const showValueLabels = totalDataPoints <= 20 && (chartType === 'bar');
        const showXAxisGrid = totalDataPoints <= 100;
        
        // Configure data types - percentile series as scatter plots, AVG as horizontal lines
        const dataTypes = {};
        Object.keys(metricNames).forEach(dataKey => {
            const name = metricNames[dataKey] || '';
            // Set only percentile intersection points as scatter plots
            if (name.startsWith('P99') || name.startsWith('P95') || name.startsWith('P90') || name.startsWith('P50')) {
                dataTypes[dataKey] = 'scatter';
            }
        });
        
        // Debug: Log all series being created
        console.log('All metric names:', Object.values(metricNames));
        console.log('Data types:', dataTypes);
        console.log('All columns:', columns.map(col => ({ id: col[0], length: col.length, sample: col.slice(1, 6) })));
        console.log('Chart colors:', chartColors);
        
        return {
            data: {
                x: 'x',
                columns: columns,
                type: chartType,
                types: dataTypes,
                colors: chartColors,
                names: metricNames,
                labels: false, // Disable C3 labels since they don't work well with scatter points
            },
            onrendered: function() {
                // Add custom labels for percentile scatter points
                setTimeout(() => {
                    const chart = this;
                    const chartContainer = document.getElementById(chart.containerId + '-chart');
                    if (!chartContainer) return;
                    
                    // Remove existing custom labels
                    chartContainer.querySelectorAll('.custom-percentile-label').forEach(label => label.remove());
                    
                    // Add labels for each percentile intersection point
                    Object.keys(metricNames).forEach(dataKey => {
                        const seriesName = metricNames[dataKey] || '';
                        if (seriesName.startsWith('P99') || seriesName.startsWith('P95') || seriesName.startsWith('P90') || seriesName.startsWith('P50')) {
                            // Find the data point for this series
                            const data = chart.data.values(dataKey);
                            const dataIndex = data.findIndex(val => val !== null);
                            if (dataIndex !== -1) {
                                const value = data[dataIndex];
                                const x = chart.internal.scale.x(dataIndex);
                                const y = chart.internal.scale.y(value);
                                
                                // Create label element
                                const label = document.createElement('div');
                                label.className = 'custom-percentile-label';
                                label.textContent = parseFloat(value).toFixed(2);
                                label.style.position = 'absolute';
                                label.style.left = (x + 10) + 'px';
                                label.style.top = (y - 10) + 'px';
                                label.style.background = 'rgba(255, 255, 255, 0.9)';
                                label.style.padding = '2px 4px';
                                label.style.borderRadius = '3px';
                                label.style.fontSize = '10px';
                                label.style.fontWeight = 'bold';
                                label.style.pointerEvents = 'none';
                                label.style.zIndex = '1000';
                                
                                chartContainer.appendChild(label);
                            }
                        }
                    });
                }, 100);
            },
            axis: {
                x: {
                    type: 'category',
                    tick: {
                        format: (x) => x, // Show index numbers
                        rotate: 0,
                        count: Math.min(12, Math.max(5, Math.floor(totalDataPoints / 1000)))
                    },
                    label: { text: 'Data Point Index' }
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
                show: true, // Always show all points for debugging
                r: 4 // Normal size for all points
            },
            tooltip: {
                show: this.options.showTooltip,
                order: (a, b) => {
                    // Sort tooltip entries: current points first, then percentiles, then AVG last
                    const aName = metricNames[a.id] || '';
                    const bName = metricNames[b.id] || '';
                    
                    // Check entry types
                    const aIsCurrent = !aName.startsWith('P99') && !aName.startsWith('P95') && !aName.startsWith('P90') && !aName.startsWith('P50') && !aName.startsWith('AVG');
                    const bIsCurrent = !bName.startsWith('P99') && !bName.startsWith('P95') && !bName.startsWith('P90') && !bName.startsWith('P50') && !bName.startsWith('AVG');
                    
                    const aIsPercentile = aName.startsWith('P99') || aName.startsWith('P95') || aName.startsWith('P90') || aName.startsWith('P50');
                    const bIsPercentile = bName.startsWith('P99') || bName.startsWith('P95') || bName.startsWith('P90') || bName.startsWith('P50');
                    
                    const aIsAvg = aName.startsWith('AVG');
                    const bIsAvg = bName.startsWith('AVG');
                    
                    // Priority order: Current (0) > Percentiles (1) > AVG (2)
                    const getPriority = (name) => {
                        if (!name.startsWith('P99') && !name.startsWith('P95') && !name.startsWith('P90') && !name.startsWith('P50') && !name.startsWith('AVG')) return 0; // Current
                        if (name.startsWith('P99') || name.startsWith('P95') || name.startsWith('P90') || name.startsWith('P50')) return 1; // Percentiles
                        if (name.startsWith('AVG')) return 2; // AVG
                        return 3; // Fallback
                    };
                    
                    const aPriority = getPriority(aName);
                    const bPriority = getPriority(bName);
                    
                    // If different priorities, sort by priority
                    if (aPriority !== bPriority) {
                        return aPriority - bPriority;
                    }
                    
                    // If both are percentiles, sort by percentile type
                    if (aIsPercentile && bIsPercentile) {
                        const percentileOrder = { 'P99': 0, 'P95': 1, 'P90': 2, 'P50': 3 };
                        const aPercentile = aName.split(' - ')[0];
                        const bPercentile = bName.split(' - ')[0];
                        return (percentileOrder[aPercentile] || 4) - (percentileOrder[bPercentile] || 4);
                    }
                    
                    // If both are current points, sort alphabetically
                    if (aIsCurrent && bIsCurrent) {
                        return aName.localeCompare(bName);
                    }
                    
                    // If both are AVG, sort alphabetically
                    if (aIsAvg && bIsAvg) {
                        return aName.localeCompare(bName);
                    }
                    
                    return 0;
                },
                format: {
                    title: (d) => {
                        const totalPoints = timestamps.length;
                        const percentage = Math.round((d / totalPoints) * 100);
                        const reversePercentage = 100 - percentage;
                        return `Data Point ${d} (${reversePercentage}%)`;
                    },
                    value: (value, ratio, id, index) => {
                        const baseValue = parseFloat(value).toFixed(2);
                        const seriesName = metricNames[id] || '';
                        
                        // Check if this is an AVG series
                        if (seriesName.startsWith('AVG')) {
                            // For AVG series, compare average values of the entire series
                            const parts = seriesName.split(' - ');
                            if (parts.length === 2) {
                                const metricName = parts[1]; // xyz-cCpuT or abc-lastweek-cCpuT
                                
                                // Find the corresponding regular series (remove the AVG prefix)
                                const regularSeriesName = seriesName.replace(/^AVG - /, '');
                                const regularSeriesId = Object.keys(metricNames).find(id => metricNames[id] === regularSeriesName);
                                
                                if (regularSeriesId) {
                                    const regularColumn = columns.find(col => col[0] === regularSeriesId);
                                    if (regularColumn) {
                                        // Calculate average of the regular series
                                        const regularValues = regularColumn.slice(1).filter(val => val !== null && val !== undefined);
                                        const regularAvg = regularValues.length > 0 ? regularValues.reduce((sum, val) => sum + val, 0) / regularValues.length : 0;
                                        
                                        // Find matching regular series for comparison (different week, same base metric)
                                        const matchingRegularSeries = this.findMatchingRegularSeries(metricName, metricNames);
                                        
                                        if (matchingRegularSeries) {
                                            const matchingColumn = columns.find(col => col[0] === matchingRegularSeries.id);
                                            if (matchingColumn) {
                                                // Calculate average of the matching series
                                                const matchingValues = matchingColumn.slice(1).filter(val => val !== null && val !== undefined);
                                                const matchingAvg = matchingValues.length > 0 ? matchingValues.reduce((sum, val) => sum + val, 0) / matchingValues.length : 0;
                                                
                                                // Compare averages
                                                const percentageChange = this.calculatePercentageChange(regularAvg, matchingAvg);
                                                return `${baseValue} (${percentageChange})`;
                                            }
                                        }
                                    }
                                }
                            }
                            return baseValue;
                        }
                        // Check if this is a percentile series
                        else if (seriesName.startsWith('P99') || seriesName.startsWith('P95') || seriesName.startsWith('P90') || seriesName.startsWith('P50')) {
                            // Extract percentile type and metric name
                            const parts = seriesName.split(' - ');
                            if (parts.length === 2) {
                                const percentileType = parts[0]; // P99, P95, P90, P50
                                const metricName = parts[1]; // xyz-cCpuT or abc-lastweek-cCpuT
                                
                                // Find the corresponding regular series (remove the percentile prefix)
                                const regularSeriesName = seriesName.replace(/^P\d+ - /, '');
                                const regularSeriesId = Object.keys(metricNames).find(id => metricNames[id] === regularSeriesName);
                                
                                if (regularSeriesId) {
                                    const regularColumn = columns.find(col => col[0] === regularSeriesId);
                                    if (regularColumn && regularColumn[index + 1] !== null && regularColumn[index + 1] !== undefined) {
                                        const lastWeekRegularValue = regularColumn[index + 1];
                                        
                                        // Find matching regular series for comparison (different week, same base metric)
                                        const matchingRegularSeries = this.findMatchingRegularSeries(metricName, metricNames);
                                        
                                        if (matchingRegularSeries) {
                                            const matchingColumn = columns.find(col => col[0] === matchingRegularSeries.id);
                                            if (matchingColumn && matchingColumn[index + 1] !== null && matchingColumn[index + 1] !== undefined) {
                                                const currentWeekRegularValue = matchingColumn[index + 1];
                                                
                                                // Compare last week's regular value with current week's regular value
                                                const percentageChange = this.calculatePercentageChange(parseFloat(currentWeekRegularValue), parseFloat(lastWeekRegularValue));
                                                return `${baseValue} (${percentageChange})`;
                                            }
                                        }
                                        
                                        // If no matching regular series found, return just the base value
                                        return baseValue;
                                    }
                                }
                            }
                        } else {
                            // This is a regular series - try to find a matching series for comparison
                            const matchingSeries = this.findMatchingRegularSeries(seriesName, metricNames);
                            
                            if (matchingSeries) {
                                const matchingColumn = columns.find(col => col[0] === matchingSeries.id);
                                if (matchingColumn && matchingColumn[index + 1] !== null && matchingColumn[index + 1] !== undefined) {
                                    const matchingValue = matchingColumn[index + 1];
                                    
                                    // Calculate percentage change
                                    const percentageChange = this.calculatePercentageChange(parseFloat(value), parseFloat(matchingValue));
                                    return `${baseValue} (${percentageChange})`;
                                }
                            }
                        }
                        
                        return baseValue;
                    }
                }
            },
            legend: {
                show: this.options.showLegend,
                position: 'bottom'
            },
            color: {
                pattern: Object.values(chartColors)
            },
            padding: {
                top: 20,
                right: 20,
                bottom: 60,
                left: 60
            },
            zoom: {
                enabled: false  // Disable zoom for sorted data since x-axis is not time-based
            }
        };
    }
    
    // Hide time range slider (used when data is sorted)
    hideTimeRangeSlider() {
        const sliderContainer = document.getElementById(this.containerId + '-slider-container');
        const timeLabels = document.querySelector('#' + this.containerId + ' .timeseries-component-time-labels');
        
        if (sliderContainer) {
            sliderContainer.style.display = 'none';
        }
        if (timeLabels) {
            timeLabels.style.display = 'none';
        }
    }
    
    // Show time range slider (used when data is not sorted)
    showTimeRangeSlider() {
        const sliderContainer = document.getElementById(this.containerId + '-slider-container');
        const timeLabels = document.querySelector('#' + this.containerId + ' .timeseries-component-time-labels');
        
        if (sliderContainer) {
            sliderContainer.style.display = 'flex';
        }
        if (timeLabels) {
            timeLabels.style.display = 'flex';
        }
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
}
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
}
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
            
            // Clear slider-related data
            chartInstance.zoomRange = null;
            chartInstance.timeRangeMin = 0;
            chartInstance.timeRangeMax = 100;
            chartInstance.seriesMinTimestamp = null;
            chartInstance.seriesMaxTimestamp = null;
            chartInstance.originalTimestamps = null;
            chartInstance.isUpdatingFromInput = false;
            
            // Clear sort-related data
            chartInstance.isSorted = false;
            chartInstance.originalData = null;
            chartInstance.isReverting = false;
            
            // Clear drag-related data
            chartInstance.isDragging = false;
            chartInstance.dragStart = null;
            chartInstance.dragEnd = null;
            
            // Clear timeout references
            if (chartInstance.zoomUpdateTimeout) {
                clearTimeout(chartInstance.zoomUpdateTimeout);
                chartInstance.zoomUpdateTimeout = null;
            }
            if (chartInstance.timeLabelUpdateTimeout) {
                clearTimeout(chartInstance.timeLabelUpdateTimeout);
                chartInstance.timeLabelUpdateTimeout = null;
            }
            
            // Clear zoom update flag
            chartInstance.isUpdatingZoom = false;
            chartInstance.isUpdatingCharts = false;
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
}
// Global function for resetting zoom (namespaced)
window.timeseriesComponentResetZoom = function(containerId) {
    const chartInstance = window.timeseriesComponentInstances && window.timeseriesComponentInstances[containerId];
    if (chartInstance) {
        chartInstance.resetZoom();
    }
}
// Global function for zoom in (namespaced)
window.timeseriesComponentZoomIn = function(containerId) {
    const chartInstance = window.timeseriesComponentInstances && window.timeseriesComponentInstances[containerId];
    if (chartInstance) {
        chartInstance.zoomIn();
    }
}
// Global function for zoom out (namespaced)
window.timeseriesComponentZoomOut = function(containerId) {
    const chartInstance = window.timeseriesComponentInstances && window.timeseriesComponentInstances[containerId];
    if (chartInstance) {
        chartInstance.zoomOut();
    }
}
// Global function for updating slider value only (no chart update)
window.timeseriesComponentUpdateSliderValue = function(containerId, value, type) {
    const chartInstance = window.timeseriesComponentInstances && window.timeseriesComponentInstances[containerId];
    if (chartInstance) {
        chartInstance.updateSliderValueOnly(parseInt(value), type);
    }
}
// Global function for updating time range (namespaced)
window.timeseriesComponentUpdateTimeRange = function(containerId, value, type) {
    const chartInstance = window.timeseriesComponentInstances && window.timeseriesComponentInstances[containerId];
    if (chartInstance) {
        chartInstance.updateTimeRange(parseInt(value), type);
    }
}
// Global function for applying time range (namespaced)
window.timeseriesComponentApplyTimeRange = function(containerId) {
    const chartInstance = window.timeseriesComponentInstances && window.timeseriesComponentInstances[containerId];
    if (chartInstance) {
        chartInstance.applyTimeRangeZoom();
    }
}
// Global function for toggling sort (namespaced)
window.timeseriesComponentToggleSort = function(containerId) {
    const chartInstance = window.timeseriesComponentInstances && window.timeseriesComponentInstances[containerId];
    if (chartInstance) {
        chartInstance.toggleSort();
    }
}

// Global function for updating time from input field (namespaced)
window.timeseriesComponentUpdateTimeFromInput = function(containerId, timeString, type) {
    const chartInstance = window.timeseriesComponentInstances && window.timeseriesComponentInstances[containerId];
    if (chartInstance) {
        chartInstance.updateTimeFromInput(timeString, type);
    }
}
// Drag-to-zoom methods
TimeSeriesChart.prototype.setupDragToZoom = function() {
    this.setupDragToZoomForChart(this.containerId + '-chart');
}
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
}
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
}
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
    // Apply zoom to all charts - C3.js expects an array format for zoom
    this.applyZoomToAllCharts([startTime, endTime]);
    // Reset drag state and hide all overlays
    this.resetDragState();
}
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
}

// Prevent mouse wheel zoom on chart containers to avoid snapping during scroll
TimeSeriesChart.prototype.preventMouseWheelZoom = function() {
    // Completely disable wheel event prevention to allow smooth scrolling
    // this.preventLegendWheelZoom();
}

// Prevent wheel events specifically on legend areas only
TimeSeriesChart.prototype.preventLegendWheelZoom = function() {
    const chartContainer = document.getElementById(this.containerId + '-chart');
    if (chartContainer) {
        // Add wheel event prevention only to legend elements
        const preventWheelOnLegend = (element) => {
            element.addEventListener('wheel', (e) => {
                // Only prevent if this is clearly a vertical scroll on legend
                if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, { passive: false });
        };
        
        // Prevent wheel on any existing legend elements
        const legends = chartContainer.querySelectorAll('.c3-legend, .timeseries-component-legend');
        legends.forEach(legend => {
            preventWheelOnLegend(legend);
        });
        
        // Use MutationObserver to catch dynamically added legend elements
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        if (node.classList && (node.classList.contains('c3-legend') || node.classList.contains('timeseries-component-legend'))) {
                            preventWheelOnLegend(node);
                        }
                        // Also check child elements
                        const childLegends = node.querySelectorAll && node.querySelectorAll('.c3-legend, .timeseries-component-legend');
                        if (childLegends) {
                            childLegends.forEach(legend => preventWheelOnLegend(legend));
                        }
                    }
                });
            });
        });
        
        observer.observe(chartContainer, {
            childList: true,
            subtree: true
        });
    }
}

// Prevent wheel events specifically on legend areas for individual charts
TimeSeriesChart.prototype.preventLegendWheelZoomForChart = function(chartContainer) {
    // Add wheel event prevention only to legend elements
    const preventWheelOnLegend = (element) => {
        element.addEventListener('wheel', (e) => {
            // Only prevent if this is clearly a vertical scroll on legend
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { passive: false });
    };
    
    // Prevent wheel on any existing legend elements
    const legends = chartContainer.querySelectorAll('.c3-legend, .timeseries-component-legend');
    legends.forEach(legend => {
        preventWheelOnLegend(legend);
    });
    
    // Use MutationObserver to catch dynamically added legend elements
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    if (node.classList && (node.classList.contains('c3-legend') || node.classList.contains('timeseries-component-legend'))) {
                        preventWheelOnLegend(node);
                    }
                    // Also check child elements
                    const childLegends = node.querySelectorAll && node.querySelectorAll('.c3-legend, .timeseries-component-legend');
                    if (childLegends) {
                        childLegends.forEach(legend => preventWheelOnLegend(legend));
                    }
                }
            });
        });
    });
    
    observer.observe(chartContainer, {
        childList: true,
        subtree: true
    });
}

// Global wheel event prevention for legend areas
TimeSeriesChart.prototype.preventGlobalLegendWheelZoom = function() {
    // Add a global wheel event listener that specifically targets legend areas
    document.addEventListener('wheel', (e) => {
        // Check if the target is within a legend area
        const isLegendArea = e.target.closest('.c3-legend') || 
                            e.target.closest('.timeseries-component-legend');
        
        if (isLegendArea) {
            // Only prevent if this is clearly a vertical scroll on legend
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                e.stopPropagation();
            }
        }
    }, { passive: false, capture: true });
}
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
                    const timeRange = maxTime - minTime;
                    const ratio = pixelX / chartWidth;
                    const result = minTime + (ratio * timeRange);
                    return result;
                }
            }
        } catch (error) {
            }
    }
    // Method 2: Try C3.js domain if available
    if (targetChart && targetChart.internal && targetChart.internal.x) {
        try {
            const xDomain = targetChart.internal.x.domain();
            if (xDomain && xDomain.length === 2 && xDomain[0] && xDomain[1]) {
                const startTime = xDomain[0].getTime();
                const endTime = xDomain[1].getTime();
                const timeRange = endTime - startTime;
                const ratio = pixelX / chartWidth;
                const result = startTime + (ratio * timeRange);
                return result;
            }
        } catch (error) {
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
}
    const startDate = convertToDate(this.timestamps[0]);
    const endDate = convertToDate(this.timestamps[this.timestamps.length - 1]);
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    const timeRange = endTime - startTime;
    const ratio = pixelX / chartWidth;
    const result = startTime + (ratio * timeRange);
    return result;
}
TimeSeriesChart.prototype.applyZoomToAllCharts = function(zoomRange) {
    this.zoomRange = zoomRange;
    const startTime = performance.now();
    
    // Redraw charts with filtered data based on zoom range
    if (zoomRange === null) {
        // Reset zoom - redraw with full data
        this.redrawChartsWithFullData();
    } else {
        // Apply zoom range - redraw with filtered data
        this.redrawChartsWithFilteredData(zoomRange);
    }
    
    const endTime = performance.now();
}

TimeSeriesChart.prototype.redrawChartsWithFullData = function() {
    console.log('redrawChartsWithFullData called, isSorted:', this.isSorted, 'charts count:', this.charts.length);
    
    // Redraw main chart with full data
    if (this.chart) {
        try {
            const fullData = this.getFullDataForRedraw(this.chartColors);
            if (fullData) {
                console.log('Redrawing main chart with full data, columns:', fullData.columns.length);
                // Use load with unload option to replace data cleanly
                this.chart.load({
                    columns: fullData.columns,
                    colors: fullData.colors,
                    unload: true
                });
            }
        } catch (error) {
            console.error('Error redrawing main chart with full data:', error);
        }
    }
    
    // Redraw all additional charts with full data
    console.log('Processing additional charts, count:', this.charts.length);
    this.charts.forEach((chartData, index) => {
        console.log(`Chart ${index}:`, {
            hasChartData: !!chartData,
            hasChart: !!(chartData && chartData.chart),
            chartId: chartData ? chartData.id : 'undefined'
        });
        if (chartData.chart) {
            try {
                // Get colors and data from stored data instead of chartData.colors
                const storedData = this.storedAdditionalChartsData[index];
                const colors = storedData ? storedData.colors : null;
                // Use truly original data for zoom reset to ensure we get unsorted data
                const timestamps = storedData && storedData.trulyOriginalTimestamps ? storedData.trulyOriginalTimestamps : storedData.originalTimestamps;
                const metrics = storedData && storedData.trulyOriginalMetrics ? storedData.trulyOriginalMetrics : storedData.originalMetrics;
                console.log(`Additional chart ${index}:`, {
                    hasStoredData: !!storedData,
                    hasTrulyOriginalTimestamps: !!(storedData && storedData.trulyOriginalTimestamps),
                    hasTrulyOriginalMetrics: !!(storedData && storedData.trulyOriginalMetrics),
                    timestampsLength: timestamps ? timestamps.length : 0,
                    metricsKeys: metrics ? Object.keys(metrics) : []
                });
                const fullData = this.getFullDataForRedraw(colors, timestamps, metrics);
                if (fullData) {
                    console.log(`Redrawing additional chart ${index} with full data, columns:`, fullData.columns.length);
                    // Use load with unload option to replace data cleanly
                    chartData.chart.load({
                        columns: fullData.columns,
                        colors: fullData.colors,
                        unload: true
                    });
                } else {
                    console.warn(`No full data generated for additional chart ${index}`);
                }
            } catch (error) {
                console.error(`Error redrawing additional chart ${index} with full data:`, error);
            }
        }
    });
}

TimeSeriesChart.prototype.redrawChartsWithFilteredData = function(zoomRange) {
    const [startTime, endTime] = zoomRange;
    
    // Redraw main chart with filtered data
    if (this.chart) {
        try {
            const filteredData = this.getFilteredDataForRedraw(startTime, endTime, this.chartColors);
            if (filteredData) {
                // Use load with unload option to replace data cleanly
                this.chart.load({
                    columns: filteredData.columns,
                    colors: filteredData.colors,
                    unload: true
                });
            }
        } catch (error) {
            console.error('Error redrawing main chart with filtered data:', error);
        }
    }
    
    // Redraw all additional charts with filtered data
    this.charts.forEach((chartData, index) => {
        if (chartData.chart) {
            try {
                // Get colors and data from stored data instead of chartData.colors
                const storedData = this.storedAdditionalChartsData[index];
                const colors = storedData ? storedData.colors : null;
                // Use truly original data when not sorted, or current data when sorted
                const timestamps = (!this.isSorted && storedData && storedData.trulyOriginalTimestamps) ? storedData.trulyOriginalTimestamps : storedData.originalTimestamps;
                const metrics = (!this.isSorted && storedData && storedData.trulyOriginalMetrics) ? storedData.trulyOriginalMetrics : storedData.originalMetrics;
                const filteredData = this.getFilteredDataForRedraw(startTime, endTime, colors, timestamps, metrics);
                if (filteredData) {
                    // Use load with unload option to replace data cleanly
                    chartData.chart.load({
                        columns: filteredData.columns,
                        colors: filteredData.colors,
                        unload: true
                    });
                }
            } catch (error) {
                console.error(`Error redrawing additional chart ${index} with filtered data:`, error);
            }
        }
    });
}

TimeSeriesChart.prototype.getFullDataForRedraw = function(colors = null, timestamps = null, metrics = null) {
    // Use provided data or fall back to main chart data
    const dataTimestamps = timestamps || this.timestamps;
    const dataMetrics = metrics || this.metrics;
    
    if (!dataTimestamps || !dataMetrics) return null;
    
    // Convert to C3.js format with full data - convert timestamps to Date objects like in processChartData
    const xValues = ['x', ...dataTimestamps.map(timestamp => {
        // Convert timestamp to Date object for C3.js
        return typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
    })];
    const columns = [xValues];
    const chartColors = {};
    const metricNames = {};
    
    Object.keys(dataMetrics).forEach((metricName, index) => {
        const dataKey = 'data' + index;
        const values = dataMetrics[metricName];
        const columnData = [dataKey, ...values];
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
    
    return { 
        columns: columns,
        colors: chartColors,
        names: metricNames
    };
}

TimeSeriesChart.prototype.getFilteredDataForRedraw = function(startTime, endTime, colors = null, timestamps = null, metrics = null) {
    // Use provided data or fall back to main chart data
    const dataTimestamps = timestamps || this.timestamps;
    const dataMetrics = metrics || this.metrics;
    
    if (!dataTimestamps || !dataMetrics) return null;
    
    const filteredTimestamps = [];
    const filteredMetrics = {};
    
    // Filter timestamps
    for (let i = 0; i < dataTimestamps.length; i++) {
        const timestamp = typeof dataTimestamps[i] === 'number' ? dataTimestamps[i] : new Date(dataTimestamps[i]).getTime();
        if (timestamp >= startTime && timestamp <= endTime) {
            filteredTimestamps.push(dataTimestamps[i]);
            // Filter corresponding metric values
            Object.keys(dataMetrics).forEach(metricName => {
                if (!filteredMetrics[metricName]) {
                    filteredMetrics[metricName] = [];
                }
                filteredMetrics[metricName].push(dataMetrics[metricName][i]);
            });
        }
    }
    
    // Convert to C3.js format - convert timestamps to Date objects like in processChartData
    const xValues = ['x', ...filteredTimestamps.map(timestamp => {
        // Convert timestamp to Date object for C3.js
        return typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
    })];
    const columns = [xValues];
    const chartColors = {};
    const metricNames = {};
    
    Object.keys(filteredMetrics).forEach((metricName, index) => {
        const dataKey = 'data' + index;
        const values = filteredMetrics[metricName];
        const columnData = [dataKey, ...values];
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
    
    return { 
        columns: columns,
        colors: chartColors,
        names: metricNames
    };
}
TimeSeriesChart.prototype.resetZoom = function() {
    const startTime = performance.now();
    this.zoomRange = null;
    this.timeRangeMin = 0;
    this.timeRangeMax = 100;
    
    // Reset sort state when resetting zoom
    this.isSorted = false;
    this.originalData = null;
    
    // Restore truly original data for additional charts
    console.log('Resetting zoom, restoring truly original data for additional charts');
    this.storedAdditionalChartsData.forEach((storedData, index) => {
        if (storedData.trulyOriginalTimestamps && storedData.trulyOriginalMetrics) {
            console.log(`Restoring chart ${index}:`, {
                trulyOriginalTimestampsLength: storedData.trulyOriginalTimestamps.length,
                trulyOriginalMetricsKeys: Object.keys(storedData.trulyOriginalMetrics),
                currentOriginalTimestampsLength: storedData.originalTimestamps.length,
                currentOriginalMetricsKeys: Object.keys(storedData.originalMetrics)
            });
            storedData.originalTimestamps = [...storedData.trulyOriginalTimestamps];
            storedData.originalMetrics = JSON.parse(JSON.stringify(storedData.trulyOriginalMetrics));
            console.log(`After restoration chart ${index}:`, {
                newOriginalTimestampsLength: storedData.originalTimestamps.length,
                newOriginalMetricsKeys: Object.keys(storedData.originalMetrics)
            });
        } else {
            console.warn(`Chart ${index} missing truly original data:`, {
                hasTrulyOriginalTimestamps: !!storedData.trulyOriginalTimestamps,
                hasTrulyOriginalMetrics: !!storedData.trulyOriginalMetrics
            });
        }
    });
    
    // Update sort button appearance
    const sortBtn = document.querySelector('#' + this.containerId + ' .timeseries-component-sort-btn');
    if (sortBtn) {
        sortBtn.classList.remove('sorted');
        sortBtn.title = 'Sort Data by Value';
    }
    
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
    // Redraw charts with full data
    this.redrawChartsWithFullData();
    // Update time labels immediately for reset
    if (this.timestamps && this.timestamps.length > 0) {
        const firstTimestamp = typeof this.timestamps[0] === 'number' ? this.timestamps[0] : new Date(this.timestamps[0]).getTime();
        const lastTimestamp = typeof this.timestamps[this.timestamps.length - 1] === 'number' ? this.timestamps[this.timestamps.length - 1] : new Date(this.timestamps[this.timestamps.length - 1]).getTime();
        this.updateTimeLabels(firstTimestamp, lastTimestamp);
    }
    // Force a small delay and then trigger a refresh to ensure zoom reset is applied
    setTimeout(() => {
        // Force refresh main chart
        if (this.chart) {
            try {
                if (this.chart.flush) {
                    this.chart.flush();
                    }
                // Also try to force a redraw
                if (this.chart.redraw) {
                    this.chart.redraw();
                    }
                // Force axis update
                if (this.chart.internal && this.chart.internal.axis) {
                    this.chart.internal.axis.redraw();
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
                        }
                    // Also try to force a redraw
                    if (chartData.chart.redraw) {
                        chartData.chart.redraw();
                        }
                } catch (error) {
                    console.error(`Error refreshing additional chart ${index}:`, error);
                }
            }
        });
    }, 50); // Small delay to ensure zoom reset is processed
    const endTime = performance.now();
}
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
        mainChartContainer.innerHTML = '<button class="timeseries-component-legend-toggle" onclick="window.timeseriesComponentToggleLegend(\'' + this.containerId + '\')">Toggle Legend</button>';
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
        }
        // Recreate additional charts
        this.storedAdditionalChartsData.forEach((storedData, index) => {
            // Create the chart container first
            const chartContainer = document.createElement('div');
            chartContainer.id = storedData.id;
            chartContainer.className = 'timeseries-component-chart';
            chartContainer.style.minWidth = (this.widthMultiplier * 1200) + 'px';
            chartContainer.style.height = (this.heightMultiplier * 400) + 'px';
            chartContainer.style.minHeight = (this.heightMultiplier * 400) + 'px';
            chartContainer.style.maxHeight = (this.heightMultiplier * 400) + 'px';
            // Drag overlay removed - drag selection disabled for performance
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
}
            // Add to charts array
            this.charts.push(chartData);
            // Render using the stored processed data
            this.renderAdditionalChartWithProcessedData(chartData, storedData.processedData);
        });
    // Reset chart index to ensure proper numbering
    this.chartIndex = this.storedAdditionalChartsData.length;
    const endTime = performance.now();
}
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
            transition: {
                duration: 0
            },
            zoom: {
                enabled: false
            },
            onrendered: () => {
                // Add chart title if provided
                if (chartData.title) {
                    this.addChartTitle(chart, chartData.title);
                }
                
                // Add legend click functionality
                this.setupLegendClickHandler(chart);
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
        // Drag-to-zoom functionality disabled for performance
        // this.setupDragToZoomForChart(chartData.id);
        // Zoom range is now applied during data filtering in renderAdditionalChart, no need for post-creation redraw
        const endTime = performance.now();
        } catch (error) {
        console.error('Error recreating additional chart:', error);
    }
}
TimeSeriesChart.prototype.updateSliderValueOnly = function(value, type) {
    if (this.timestamps && this.timestamps.length > 0) {
        // Convert time value to percentage
        const firstTimestamp = typeof this.timestamps[0] === 'number' ? this.timestamps[0] : new Date(this.timestamps[0]).getTime();
        const lastTimestamp = typeof this.timestamps[this.timestamps.length - 1] === 'number' ? this.timestamps[this.timestamps.length - 1] : new Date(this.timestamps[this.timestamps.length - 1]).getTime();
        const totalTime = lastTimestamp - firstTimestamp;
        const percentage = ((value - firstTimestamp) / totalTime) * 100;
        
        if (type === 'min') {
            this.timeRangeMin = Math.min(percentage, this.timeRangeMax - 1);
        } else if (type === 'max') {
            this.timeRangeMax = Math.max(percentage, this.timeRangeMin + 1);
        }
    } else {
        // Fallback to percentage values if no time data
    if (type === 'min') {
        this.timeRangeMin = Math.min(value, this.timeRangeMax - 1);
    } else if (type === 'max') {
        this.timeRangeMax = Math.max(value, this.timeRangeMin + 1);
    }
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
}
TimeSeriesChart.prototype.updateTimeRange = function(value, type) {
    if (this.timestamps && this.timestamps.length > 0) {
        // Convert time value to percentage
        const firstTimestamp = typeof this.timestamps[0] === 'number' ? this.timestamps[0] : new Date(this.timestamps[0]).getTime();
        const lastTimestamp = typeof this.timestamps[this.timestamps.length - 1] === 'number' ? this.timestamps[this.timestamps.length - 1] : new Date(this.timestamps[this.timestamps.length - 1]).getTime();
        const totalTime = lastTimestamp - firstTimestamp;
        const percentage = ((value - firstTimestamp) / totalTime) * 100;
        
        if (type === 'min') {
            this.timeRangeMin = Math.min(percentage, this.timeRangeMax - 1);
        } else if (type === 'max') {
            this.timeRangeMax = Math.max(percentage, this.timeRangeMin + 1);
        }
    } else {
        // Fallback to percentage values if no time data
    if (type === 'min') {
        this.timeRangeMin = Math.min(value, this.timeRangeMax - 1);
    } else if (type === 'max') {
        this.timeRangeMax = Math.max(value, this.timeRangeMin + 1);
    }
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
}
TimeSeriesChart.prototype.updateSliderValues = function() {
    const minSlider = document.querySelector('#' + this.containerId + ' .timeseries-component-slider-min');
    const maxSlider = document.querySelector('#' + this.containerId + ' .timeseries-component-slider-max');
    
    if (minSlider && maxSlider && this.timestamps && this.timestamps.length > 0) {
        // Set slider min and max based on main chart time range
        const firstTimestamp = typeof this.timestamps[0] === 'number' ? this.timestamps[0] : new Date(this.timestamps[0]).getTime();
        const lastTimestamp = typeof this.timestamps[this.timestamps.length - 1] === 'number' ? this.timestamps[this.timestamps.length - 1] : new Date(this.timestamps[this.timestamps.length - 1]).getTime();
        
        // Set the slider min and max attributes to the actual time range
        minSlider.min = firstTimestamp;
        minSlider.max = lastTimestamp;
        maxSlider.min = firstTimestamp;
        maxSlider.max = lastTimestamp;
        
        // Convert percentage values to actual time values for the slider values
        const totalTime = lastTimestamp - firstTimestamp;
        const minTime = firstTimestamp + (totalTime * this.timeRangeMin / 100);
        const maxTime = firstTimestamp + (totalTime * this.timeRangeMax / 100);
        
        minSlider.value = minTime;
        maxSlider.value = maxTime;
        
        // Update time labels to show actual time values (only if not updating from user input)
        if (!this.isUpdatingFromInput) {
            this.updateTimeLabels(minTime, maxTime);
        }
    } else {
        // Fallback to percentage values if no time data
    if (minSlider) minSlider.value = this.timeRangeMin;
    if (maxSlider) maxSlider.value = this.timeRangeMax;
    }
    
    // Update Apply button state based on current validation
    this.updateApplyButtonState();
}
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
}
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
    this.isUpdatingZoom = false;
}
TimeSeriesChart.prototype.updateTimeLabels = function(startTime, endTime) {
    const minLabel = document.getElementById(this.containerId + '-time-min');
    const maxLabel = document.getElementById(this.containerId + '-time-max');
    if (minLabel) {
        try {
            if (this.options.useUTC) {
                // Custom UTC format: yyyy-mm-dd hr:mm:ss.SSS
                const date = new Date(startTime);
                const utcDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
                const year = utcDate.getFullYear();
                const month = String(utcDate.getMonth() + 1).padStart(2, '0');
                const day = String(utcDate.getDate()).padStart(2, '0');
                const hours = String(utcDate.getHours()).padStart(2, '0');
                const minutes = String(utcDate.getMinutes()).padStart(2, '0');
                const seconds = String(utcDate.getSeconds()).padStart(2, '0');
                const milliseconds = String(utcDate.getMilliseconds()).padStart(3, '0');
                minLabel.value = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
            } else {
                // Local time format: yyyy-mm-dd hr:mm:ss.SSS
                const date = new Date(startTime);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const seconds = String(date.getSeconds()).padStart(2, '0');
                const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
                minLabel.value = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
            }
        } catch (error) {
            console.error('Error updating min label:', error);
            minLabel.value = 'Invalid Date';
        }
    }
    if (maxLabel) {
        try {
            if (this.options.useUTC) {
                // Custom UTC format: yyyy-mm-dd hr:mm:ss.SSS
                const date = new Date(endTime);
                const utcDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
                const year = utcDate.getFullYear();
                const month = String(utcDate.getMonth() + 1).padStart(2, '0');
                const day = String(utcDate.getDate()).padStart(2, '0');
                const hours = String(utcDate.getHours()).padStart(2, '0');
                const minutes = String(utcDate.getMinutes()).padStart(2, '0');
                const seconds = String(utcDate.getSeconds()).padStart(2, '0');
                const milliseconds = String(utcDate.getMilliseconds()).padStart(3, '0');
                maxLabel.value = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
            } else {
                // Local time format: yyyy-mm-dd hr:mm:ss.SSS
                const date = new Date(endTime);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const seconds = String(date.getSeconds()).padStart(2, '0');
                const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
                maxLabel.value = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
            }
        } catch (error) {
            console.error('Error updating max label:', error);
            maxLabel.value = 'Invalid Date';
        }
    }
}

// Function to update time range from input field changes
TimeSeriesChart.prototype.updateTimeFromInput = function(timeString, type) {
    if (!this.timestamps || this.timestamps.length === 0) {
        console.warn('No timestamp data available');
        this.setInputValidationState(type, false, 'No data available');
        return;
    }

    // Get the input element
    const inputElement = document.getElementById(this.containerId + '-time-' + type);
    if (!inputElement) {
        console.warn('Input element not found for type:', type);
        return;
    }

    // Check if the input value is empty or just whitespace
    if (!timeString || timeString.trim() === '') {
        this.setInputValidationState(type, true); // Empty input is valid
        return;
    }

    // Store original series min/max if not already stored
    if (!this.seriesMinTimestamp || !this.seriesMaxTimestamp) {
        // Use original timestamps if available, otherwise use current timestamps
        const timestampsToUse = this.originalTimestamps || this.timestamps;
        this.seriesMinTimestamp = typeof timestampsToUse[0] === 'number' ? timestampsToUse[0] : new Date(timestampsToUse[0]).getTime();
        this.seriesMaxTimestamp = typeof timestampsToUse[timestampsToUse.length - 1] === 'number' ? timestampsToUse[timestampsToUse.length - 1] : new Date(timestampsToUse[timestampsToUse.length - 1]).getTime();
        
        console.log('Series bounds initialized:', {
            seriesMin: this.seriesMinTimestamp,
            seriesMax: this.seriesMaxTimestamp,
            usingOriginal: !!this.originalTimestamps,
            currentTimestampsLength: this.timestamps ? this.timestamps.length : 0,
            originalTimestampsLength: this.originalTimestamps ? this.originalTimestamps.length : 0
        });
    }

    try {
        // Parse the input time string (expected format: yyyy-mm-dd hr:mm:ss.SSS)
        const timeRegex = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/;
        const match = timeString.match(timeRegex);
        
        if (!match) {
            this.setInputValidationState(type, false, 'Invalid format');
            return;
        }

        const [, year, month, day, hours, minutes, seconds, milliseconds] = match;
        
        // Validate date components
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        const dayNum = parseInt(day);
        const hoursNum = parseInt(hours);
        const minutesNum = parseInt(minutes);
        const secondsNum = parseInt(seconds);
        const millisecondsNum = parseInt(milliseconds);
        
        // Basic range validation
        if (monthNum < 1 || monthNum > 12) {
            this.setInputValidationState(type, false, 'Invalid month');
            return;
        }
        if (dayNum < 1 || dayNum > 31) {
            this.setInputValidationState(type, false, 'Invalid day');
            return;
        }
        if (hoursNum < 0 || hoursNum > 23) {
            this.setInputValidationState(type, false, 'Invalid hour');
            return;
        }
        if (minutesNum < 0 || minutesNum > 59) {
            this.setInputValidationState(type, false, 'Invalid minute');
            return;
        }
        if (secondsNum < 0 || secondsNum > 59) {
            this.setInputValidationState(type, false, 'Invalid second');
            return;
        }
        if (millisecondsNum < 0 || millisecondsNum > 999) {
            this.setInputValidationState(type, false, 'Invalid milliseconds');
            return;
        }
        
        // Create date and validate it's a real date
        let inputTime;
        if (this.options.useUTC) {
            // Create UTC date
            inputTime = new Date(Date.UTC(yearNum, monthNum - 1, dayNum, hoursNum, minutesNum, secondsNum, millisecondsNum));
        } else {
            // Create local date
            inputTime = new Date(yearNum, monthNum - 1, dayNum, hoursNum, minutesNum, secondsNum, millisecondsNum);
        }
        
        // Check if the date is valid (handles cases like Feb 30, etc.)
        if (isNaN(inputTime.getTime())) {
            this.setInputValidationState(type, false, 'Invalid date');
            return;
        }
        
        // Validate date components based on UTC or local time
        if (this.options.useUTC) {
            if (inputTime.getUTCFullYear() !== yearNum || 
                inputTime.getUTCMonth() !== (monthNum - 1) || 
                inputTime.getUTCDate() !== dayNum ||
                inputTime.getUTCHours() !== hoursNum ||
                inputTime.getUTCMinutes() !== minutesNum ||
                inputTime.getUTCSeconds() !== secondsNum ||
                inputTime.getUTCMilliseconds() !== millisecondsNum) {
                this.setInputValidationState(type, false, 'Invalid date');
                return;
            }
        } else {
            if (inputTime.getFullYear() !== yearNum || 
                inputTime.getMonth() !== (monthNum - 1) || 
                inputTime.getDate() !== dayNum ||
                inputTime.getHours() !== hoursNum ||
                inputTime.getMinutes() !== minutesNum ||
                inputTime.getSeconds() !== secondsNum ||
                inputTime.getMilliseconds() !== millisecondsNum) {
                this.setInputValidationState(type, false, 'Invalid date');
                return;
            }
        }
        
        const inputTimestamp = inputTime.getTime();
        
        // Debug logging
        console.log('Input validation:', {
            inputTime: timeString,
            inputTimestamp: inputTimestamp,
            seriesMin: this.seriesMinTimestamp,
            seriesMax: this.seriesMaxTimestamp,
            type: type,
            inRange: inputTimestamp >= this.seriesMinTimestamp && inputTimestamp <= this.seriesMaxTimestamp
        });
        
        // Validate that the input time is within the series range (inclusive bounds)
        if (!(inputTimestamp >= this.seriesMinTimestamp && inputTimestamp <= this.seriesMaxTimestamp)) {
            console.warn('Input time outside series range:', {
                inputTimestamp: inputTimestamp,
                seriesMin: this.seriesMinTimestamp,
                seriesMax: this.seriesMaxTimestamp,
                difference: inputTimestamp - this.seriesMinTimestamp
            });
            this.setInputValidationState(type, false, 'Outside series range');
            return;
        }
        
        const totalTime = this.seriesMaxTimestamp - this.seriesMinTimestamp;
        const percentage = ((inputTimestamp - this.seriesMinTimestamp) / totalTime) * 100;
        
        console.log('Percentage calculation:', {
            inputTimestamp: inputTimestamp,
            seriesMin: this.seriesMinTimestamp,
            totalTime: totalTime,
            percentage: percentage,
            type: type
        });
        
        if (type === 'min') {
            const oldMin = this.timeRangeMin;
            this.timeRangeMin = Math.min(percentage, this.timeRangeMax - 1);
            console.log('Min range update:', {
                oldMin: oldMin,
                newMin: this.timeRangeMin,
                percentage: percentage,
                maxMinus1: this.timeRangeMax - 1
            });
        } else if (type === 'max') {
            const oldMax = this.timeRangeMax;
            this.timeRangeMax = Math.max(percentage, this.timeRangeMin + 1);
            console.log('Max range update:', {
                oldMax: oldMax,
                newMax: this.timeRangeMax,
                percentage: percentage,
                minPlus1: this.timeRangeMin + 1
            });
        }
        
        // Set flag to prevent updateTimeLabels from overriding user input
        this.isUpdatingFromInput = true;
        
        // Update slider values and range indicator
        this.updateSliderValues();
        this.updateRangeIndicator();
        
        // Restore the user's input to preserve exact milliseconds
        inputElement.value = timeString;
        
        // Clear the flag
        this.isUpdatingFromInput = false;
        
        // Set valid state
        this.setInputValidationState(type, true);
        
        // Note: Zoom is not applied automatically - user must click Apply button
        
    } catch (error) {
        console.error('Error parsing time input:', error);
        this.setInputValidationState(type, false, 'Parse error');
    }
}

// Function to set input validation state and visual feedback
TimeSeriesChart.prototype.setInputValidationState = function(type, isValid, errorMessage = '') {
    const inputElement = document.getElementById(this.containerId + '-time-' + type);
    if (!inputElement) {
        console.warn('Input element not found for type:', type);
        return;
    }
    
    if (isValid) {
        // Valid state - remove background color (reset to default)
        inputElement.style.backgroundColor = '';
        inputElement.title = ''; // Clear any error tooltip
    } else {
        // Invalid state - red background
        inputElement.style.backgroundColor = '#ffebee'; // Light red background
        inputElement.title = errorMessage || 'Invalid input'; // Show error in tooltip
    }
    
    // Update Apply button state based on validation
    this.updateApplyButtonState();
}

// Function to update Apply button state based on input validation
TimeSeriesChart.prototype.updateApplyButtonState = function() {
    const applyButton = document.querySelector('#' + this.containerId + ' .timeseries-component-apply-btn');
    if (!applyButton) {
        console.warn('Apply button not found');
        return;
    }
    
    // Check if both min and max inputs are valid
    const minInput = document.getElementById(this.containerId + '-time-min');
    const maxInput = document.getElementById(this.containerId + '-time-max');
    
    if (!minInput || !maxInput) {
        console.warn('Input elements not found:', { minInput: !!minInput, maxInput: !!maxInput });
        return;
    }
    
    // Check if both inputs have valid background (empty = valid, red = invalid)
    const minBgColor = minInput.style.backgroundColor;
    const maxBgColor = maxInput.style.backgroundColor;
    const minValid = minBgColor === '' || minBgColor === 'transparent' || minBgColor === 'rgba(0, 0, 0, 0)'; // Empty/transparent background
    const maxValid = maxBgColor === '' || maxBgColor === 'transparent' || maxBgColor === 'rgba(0, 0, 0, 0)'; // Empty/transparent background
    
    const bothValid = minValid && maxValid;
    
    if (bothValid) {
        // Enable Apply button
        applyButton.disabled = false;
        applyButton.style.opacity = '1';
        applyButton.style.cursor = 'pointer';
        applyButton.title = 'Apply Time Range';
    } else {
        // Disable Apply button
        applyButton.disabled = true;
        applyButton.style.opacity = '0.5';
        applyButton.style.cursor = 'not-allowed';
        applyButton.title = 'Fix validation errors before applying';
    }
}
// CSV Upload functionality
window.timeseriesComponentUploadCSV = function(containerId) {
    const fileInput = document.getElementById(containerId + '-csv-upload');
    if (fileInput) {
        fileInput.click();
    }
};

window.timeseriesComponentHandleCSVUpload = function(containerId, fileInput) {
    const file = fileInput.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const csvText = e.target.result;
            const chartInstance = window.timeseriesComponentInstances[containerId];
            if (chartInstance) {
                chartInstance.processCSVData(csvText, file.name);
            }
        } catch (error) {
            console.error('Error reading CSV file:', error);
            alert('Error reading CSV file: ' + error.message);
        }
    };
    reader.readAsText(file);
};

TimeSeriesChart.prototype.processCSVData = function(csvText, fileName) {
    try {
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            throw new Error('CSV file must have at least a header row and one data row');
        }
        
        // Parse header row
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        if (headers.length < 2) {
            throw new Error('CSV file must have at least timestamp and one value column');
        }
        
        // Validate first column is timestamp
        if (headers[0].toLowerCase() !== 'timestamp') {
            throw new Error('First column must be named "timestamp"');
        }
        
        // Check if this is "long format" data (one metric per row) or "wide format" data (all metrics per row)
        const isLongFormat = this.detectDataFormat(headers, lines);
        
        if (isLongFormat) {
            return this.processLongFormatCSV(lines, headers, fileName);
        }
        
        // Original wide format processing
        const metricNames = [];
        const dimensionColumns = [];
        
        // Analyze each column to determine if it's a metric or dimension
        for (let i = 1; i < headers.length; i++) {
            const columnName = headers[i];
            const columnIndex = i;
            
            // Check if this column contains text/dimension data by sampling first few rows
            let isDimension = false;
            const sampleSize = Math.min(5, lines.length - 1); // Sample first 5 data rows
            
            for (let j = 1; j <= sampleSize; j++) {
                const values = lines[j].split(',').map(v => v.trim().replace(/"/g, ''));
                if (values[columnIndex]) {
                    const value = values[columnIndex];
                    // Check if value is not a number
                    if (isNaN(parseFloat(value)) && value !== '' && value !== 'null' && value !== 'NULL') {
                        isDimension = true;
                        break;
                    }
                }
            }
            
            if (isDimension) {
                dimensionColumns.push({ name: columnName, index: columnIndex });
            } else {
                metricNames.push(columnName);
            }
        }
        
        // Parse data rows
        const timestamps = [];
        const metrics = {};
        const dimensions = {};
        
        // Initialize metrics and dimensions objects
        metricNames.forEach(name => {
            metrics[name] = [];
        });
        dimensionColumns.forEach(dim => {
            dimensions[dim.name] = [];
        });
        
        // Parse each data row
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            if (values.length !== headers.length) {
                console.warn(`Row ${i + 1} has ${values.length} columns, expected ${headers.length}. Skipping.`);
                continue;
            }
            
            // Parse timestamp
            const timestampStr = values[0];
            let timestamp;
            
            // Try different timestamp formats
            if (timestampStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
                // ISO format
                if (this.options.useUTC) {
                    // Parse as UTC
                    timestamp = new Date(timestampStr + 'Z').getTime();
                } else {
                    // Parse as local time
                    timestamp = new Date(timestampStr).getTime();
                }
            } else if (timestampStr.match(/^\d{10}$/)) {
                // Unix timestamp (seconds)
                timestamp = parseInt(timestampStr) * 1000;
            } else if (timestampStr.match(/^\d{13}$/)) {
                // Unix timestamp (milliseconds)
                timestamp = parseInt(timestampStr);
            } else {
                // Try parsing as date
                if (this.options.useUTC) {
                    // Parse as UTC
                    timestamp = new Date(timestampStr + 'Z').getTime();
                } else {
                    // Parse as local time
                    timestamp = new Date(timestampStr).getTime();
                }
            }
            
            if (isNaN(timestamp)) {
                console.warn(`Invalid timestamp in row ${i + 1}: ${timestampStr}. Skipping.`);
                continue;
            }
            
            timestamps.push(timestamp);
            
            // Parse metric values
            metricNames.forEach((name, index) => {
                const valueStr = values[index + 1];
                const value = valueStr === '' || valueStr === 'null' || valueStr === 'NULL' ? null : parseFloat(valueStr);
                metrics[name].push(value);
            });
            
            // Parse dimension values
            dimensionColumns.forEach(dim => {
                const valueStr = values[dim.index];
                const value = valueStr === '' || valueStr === 'null' || valueStr === 'NULL' ? null : valueStr;
                dimensions[dim.name].push(value);
            });
        }
        
        if (timestamps.length === 0) {
            throw new Error('No valid data rows found in CSV file');
        }
        
        // Create chart title from filename
        const chartTitle = fileName.replace('.csv', '').replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
        
        // If we have dimensions, create series with dimension values in the metric names
        if (dimensionColumns.length > 0) {
            this.createSeriesWithDimensions(timestamps, metrics, dimensions, dimensionColumns, chartTitle);
        } else {
            // No dimensions, create single chart with all metrics
            this.addChart(timestamps, metrics, false, chartTitle);
        }
        
        console.log(`Successfully loaded CSV: ${fileName} with ${timestamps.length} data points, ${metricNames.length} metrics, and ${dimensionColumns.length} dimensions`);
        
    } catch (error) {
        console.error('Error processing CSV data:', error);
        alert('Error processing CSV file: ' + error.message);
    }
};

TimeSeriesChart.prototype.detectDataFormat = function(headers, lines) {
    // Long format: timestamp, dimension1, dimension2, ..., metric_name, value
    // Wide format: timestamp, metric1, metric2, metric3, ...
    
    // Check if we have a "value" column (indicates long format)
    const hasValueColumn = headers.some(header => 
        header.toLowerCase() === 'value' || 
        header.toLowerCase() === 'metric_value' ||
        header.toLowerCase() === 'measurement'
    );
    
    // Check if we have a metric name column (indicates long format)
    const hasMetricNameColumn = headers.some(header => 
        header.toLowerCase() === 'metric' ||
        header.toLowerCase() === 'activity' ||
        header.toLowerCase() === 'metric_name' ||
        header.toLowerCase() === 'measurement_name'
    );
    
    // If we have both value and metric name columns, it's likely long format
    if (hasValueColumn && hasMetricNameColumn) {
        return true;
    }
    
    // Additional check: if the last column is numeric and others are text, likely long format
    if (lines.length > 1) {
        const sampleRow = lines[1].split(',').map(v => v.trim().replace(/"/g, ''));
        if (sampleRow.length >= 3) {
            const lastColumn = sampleRow[sampleRow.length - 1];
            const secondLastColumn = sampleRow[sampleRow.length - 2];
            
            // If last column is numeric and second last is text, likely long format
            if (!isNaN(parseFloat(lastColumn)) && isNaN(parseFloat(secondLastColumn))) {
                return true;
            }
        }
    }
    
    return false;
};

TimeSeriesChart.prototype.processLongFormatCSV = function(lines, headers, fileName) {
    try {
        // Parse long format data: timestamp, dimension1, dimension2, ..., metric_name, value
        const dataMap = new Map(); // key: "metric_name (dim1, dim2, ...)", value: {timestamps: [], values: []}
        
        // Parse each data row
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            if (values.length !== headers.length) {
                console.warn(`Row ${i + 1} has ${values.length} columns, expected ${headers.length}. Skipping.`);
                continue;
            }
            
            // Parse timestamp
            const timestampStr = values[0];
            let timestamp;
            
            // Try different timestamp formats
            if (timestampStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
                // ISO format
                if (this.options.useUTC) {
                    // Parse as UTC
                    timestamp = new Date(timestampStr + 'Z').getTime();
                } else {
                    // Parse as local time
                    timestamp = new Date(timestampStr).getTime();
                }
            } else if (timestampStr.match(/^\d{10}$/)) {
                // Unix timestamp (seconds)
                timestamp = parseInt(timestampStr) * 1000;
            } else if (timestampStr.match(/^\d{13}$/)) {
                // Unix timestamp (milliseconds)
                timestamp = parseInt(timestampStr);
            } else {
                // Try parsing as date
                if (this.options.useUTC) {
                    // Parse as UTC
                    timestamp = new Date(timestampStr + 'Z').getTime();
                } else {
                    // Parse as local time
                    timestamp = new Date(timestampStr).getTime();
                }
            }
            
            if (isNaN(timestamp)) {
                console.warn(`Invalid timestamp in row ${i + 1}: ${timestampStr}. Skipping.`);
                continue;
            }
            
            // Find metric name and value columns
            let metricName = null;
            let value = null;
            const dimensions = {};
            
            // Look for metric name column (usually second to last or last column)
            for (let j = 1; j < headers.length - 1; j++) {
                const header = headers[j].toLowerCase();
                if (header === 'metric' || header === 'activity' || header === 'metric_name' || header === 'measurement_name') {
                    metricName = values[j];
                    break;
                }
            }
            
            // If no explicit metric column found, use the second to last column as metric name
            if (!metricName && values.length >= 3) {
                metricName = values[values.length - 2];
            }
            
            // Value is the last column
            if (values.length >= 2) {
                const valueStr = values[values.length - 1];
                value = valueStr === '' || valueStr === 'null' || valueStr === 'NULL' ? null : parseFloat(valueStr);
            }
            
            if (!metricName || isNaN(value)) {
                console.warn(`Invalid metric name or value in row ${i + 1}. Skipping.`);
                continue;
            }
            
            // Collect dimension values (all columns except timestamp, metric name, and value)
            for (let j = 1; j < headers.length - 2; j++) {
                const header = headers[j];
                const headerLower = header.toLowerCase();
                
                // Skip metric name column
                if (headerLower === 'metric' || headerLower === 'activity' || headerLower === 'metric_name' || headerLower === 'measurement_name') {
                    continue;
                }
                
                dimensions[header] = values[j];
            }
            
            // Create series name with dimensions
            const dimensionParts = Object.entries(dimensions).map(([name, val]) => val || 'null');
            const seriesName = `${metricName} (${dimensionParts.join(', ')})`;
            
            // Add to data map
            if (!dataMap.has(seriesName)) {
                dataMap.set(seriesName, { timestamps: [], values: [] });
            }
            
            dataMap.get(seriesName).timestamps.push(timestamp);
            dataMap.get(seriesName).values.push(value);
        }
        
        if (dataMap.size === 0) {
            throw new Error('No valid data rows found in CSV file');
        }
        
        // Convert to chart format
        const allTimestamps = new Set();
        dataMap.forEach(seriesData => {
            seriesData.timestamps.forEach(ts => allTimestamps.add(ts));
        });
        
        const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
        const metrics = {};
        
        // Create metrics object with aligned data
        dataMap.forEach((seriesData, seriesName) => {
            metrics[seriesName] = new Array(sortedTimestamps.length).fill(null);
            
            seriesData.timestamps.forEach((timestamp, index) => {
                const timestampIndex = sortedTimestamps.indexOf(timestamp);
                if (timestampIndex !== -1) {
                    metrics[seriesName][timestampIndex] = seriesData.values[index];
                }
            });
        });
        
        // Create chart title from filename
        const chartTitle = fileName.replace('.csv', '').replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
        
        // Add the chart
        this.addChart(sortedTimestamps, metrics, false, chartTitle);
        
        console.log(`Successfully loaded long format CSV: ${fileName} with ${sortedTimestamps.length} timestamps and ${dataMap.size} series`);
        
    } catch (error) {
        console.error('Error processing long format CSV data:', error);
        alert('Error processing CSV file: ' + error.message);
    }
};

TimeSeriesChart.prototype.createSeriesWithDimensions = function(timestamps, metrics, dimensions, dimensionColumns, baseTitle) {
    try {
        // Create new metrics object with dimension values in series names
        const newMetrics = {};
        const dataLength = timestamps.length;
        
        // For each metric, create separate series for each unique dimension combination
        Object.keys(metrics).forEach(metricName => {
            // Get unique dimension combinations for this metric
            const dimensionCombinations = this.getDimensionCombinations(dimensions, dimensionColumns);
            
            dimensionCombinations.forEach(combination => {
                // Create series name with dimension values
                const seriesName = this.createSeriesNameWithDimensions(metricName, combination);
                
                // Initialize the series array
                newMetrics[seriesName] = new Array(dataLength).fill(null);
                
                // Fill in values where this dimension combination matches
                for (let i = 0; i < dataLength; i++) {
                    let matches = true;
                    
                    // Check if this row matches the dimension combination
                    Object.keys(combination).forEach(dimName => {
                        const expectedValue = combination[dimName];
                        const actualValue = dimensions[dimName][i];
                        
                        if (expectedValue !== actualValue) {
                            matches = false;
                        }
                    });
                    
                    if (matches) {
                        newMetrics[seriesName][i] = metrics[metricName][i];
                    }
                }
            });
        });
        
        // Create single chart with all series
        this.addChart(timestamps, newMetrics, false, baseTitle);
        
        console.log(`Created single chart with ${Object.keys(newMetrics).length} series from CSV data`);
        
    } catch (error) {
        console.error('Error creating series with dimensions:', error);
        // Fallback: create single chart with all data
        this.addChart(timestamps, metrics, false, baseTitle);
    }
};

TimeSeriesChart.prototype.getDimensionCombinations = function(dimensions, dimensionColumns) {
    const combinations = [];
    const dataLength = Object.values(dimensions)[0].length;
    
    // Create a set of unique combinations
    const combinationSet = new Set();
    
    for (let i = 0; i < dataLength; i++) {
        const combination = {};
        let combinationKey = '';
        
        dimensionColumns.forEach(dim => {
            const value = dimensions[dim.name][i];
            combination[dim.name] = value;
            combinationKey += `${dim.name}:${value || 'null'}|`;
        });
        
        if (!combinationSet.has(combinationKey)) {
            combinationSet.add(combinationKey);
            combinations.push(combination);
        }
    }
    
    return combinations;
};

TimeSeriesChart.prototype.filterDataByDimensionCombination = function(timestamps, metrics, dimensions, combination) {
    const filteredTimestamps = [];
    const filteredMetrics = {};
    
    // Initialize filtered metrics
    Object.keys(metrics).forEach(metricName => {
        filteredMetrics[metricName] = [];
    });
    
    const dataLength = timestamps.length;
    
    for (let i = 0; i < dataLength; i++) {
        let matches = true;
        
        // Check if this row matches the dimension combination
        Object.keys(combination).forEach(dimName => {
            const expectedValue = combination[dimName];
            const actualValue = dimensions[dimName][i];
            
            if (expectedValue !== actualValue) {
                matches = false;
            }
        });
        
        if (matches) {
            filteredTimestamps.push(timestamps[i]);
            Object.keys(metrics).forEach(metricName => {
                filteredMetrics[metricName].push(metrics[metricName][i]);
            });
        }
    }
    
    return {
        timestamps: filteredTimestamps,
        metrics: filteredMetrics
    };
};

TimeSeriesChart.prototype.createSeriesNameWithDimensions = function(metricName, combination) {
    const dimensionParts = Object.entries(combination).map(([name, value]) => {
        return `${value || 'null'}`;
    });
    
    return `${metricName} (${dimensionParts.join(', ')})`;
};

TimeSeriesChart.prototype.createDimensionCombinationTitle = function(combination, baseTitle) {
    const dimensionParts = Object.entries(combination).map(([name, value]) => {
        return `${name}: ${value || 'null'}`;
    });
    
    return `${baseTitle} (${dimensionParts.join(', ')})`;
};

// applyBrushToAllCharts method removed - subchart disabled for performance
TimeSeriesChart.prototype.addChartTitle = function(chart, title) {
    if (!chart || !chart.internal || !chart.internal.svg) {
        console.warn('Chart or SVG not available for title');
        return;
    }
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
}

TimeSeriesChart.prototype.setupLegendClickHandler = function(chart) {
    // Check if charts are being updated first (before any other checks)
    if (this.isUpdatingCharts) {
        console.warn('Charts are being updated, skipping legend click handler setup');
        return;
    }
    
    if (!chart || !chart.internal || chart.internal.destroyed) {
        console.warn('Chart not available for legend click handler');
        return;
    }
    
    // Check if this is the current main chart or a valid additional chart
    const isMainChart = chart === this.chart;
    const isAdditionalChart = this.charts.some(chartData => chartData.chart === chart);
    
    if (!isMainChart && !isAdditionalChart) {
        console.warn('Chart is not a current chart instance, skipping legend click handler setup');
        return;
    }
    
    // Wait a bit for the legend to be rendered
    setTimeout(() => {
        // Check if charts are being updated (avoid setting up handlers on old charts)
        if (this.isUpdatingCharts) {
            console.warn('Charts are being updated, skipping legend click handler setup');
            return;
        }
        
        // Additional check: verify the chart is still valid and not destroyed
        if (!chart || !chart.internal || chart.internal.destroyed) {
            console.warn('Chart has been destroyed, skipping legend click handler setup');
            return;
        }
        
        // Check if chart and internal SVG are still available
        if (!chart || !chart.internal || !chart.internal.svg) {
            console.warn('Chart or SVG not available for legend click handler');
            return;
        }
        
        // Additional check: ensure the chart hasn't been destroyed
        if (chart.internal.destroyed) {
            console.warn('Chart has been destroyed, skipping legend click handler setup');
            return;
        }
        
        const legendItems = chart.internal.svg.selectAll('.c3-legend-item');
        
        if (legendItems && legendItems.size() > 0) {
            legendItems.on('click', function(d) {
                console.log('Legend item clicked:', d);
                if (chart && typeof chart.toggle === 'function') {
                    chart.toggle(d);
                    console.log('Series toggled:', d);
                } else {
                    console.warn('Chart toggle function not available');
                }
            });
            
            //console.log('Legend click handlers attached to', legendItems.size(), 'items');
        } else {
            console.warn('No legend items found to attach click handlers');
        }
    }, 100);
}
// Export for external use
window.TimeSeriesChart = TimeSeriesChart;