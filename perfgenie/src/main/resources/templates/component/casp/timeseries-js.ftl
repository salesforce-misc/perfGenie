<script>
// TimeSeriesChart Component - Self-contained with all controls
class TimeSeriesChart {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
            throw new Error('Container with ID \'' + containerId + '\' not found');
        }
        
        this.chart = null;
        this.data = null;
        this.timestamps = [];
        this.metrics = {};
        this.widthMultiplier = 1;
        this.charts = []; // Array to store all chart instances
        this.chartIndex = 0; // Current chart index
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
            .timeseries-container {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                font-family: Arial, sans-serif;
                overflow: visible;
            }
            
            .timeseries-controls {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
            }
            
            .control-select {
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
            
            .control-select:hover {
                border-color: #0070d2;
                box-shadow: 0 0 3px rgba(0, 112, 210, 0.2);
            }
            
            .control-select:focus {
                outline: none;
                border-color: #0070d2;
                box-shadow: 0 0 3px rgba(0, 112, 210, 0.3);
            }
            
            .control-select option {
                padding: 2px 4px;
                background: #fff;
                color: #333;
                font-size: 9px;
                line-height: 1.2;
            }
            
            .chart-scroll-container {
                flex: 1;
                overflow-x: auto;
                overflow-y: hidden;
                width: 100%;
            }
            
            .timeseries-chart {
                min-height: 400px;
                position: relative;
                width: 100%;
                min-width: 100%;
            }
            
            .chart-loading {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 16px;
                color: #6c757d;
            }
            
            .chart-error {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: #dc3545;
            }
            
            .metric-legend {
                display: flex;
                gap: 20px;
                padding: 10px;
                background: #f8f9fa;
                border-top: 1px solid #dee2e6;
                flex-wrap: wrap;
            }
            
            .legend-item {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .legend-color {
                width: 12px;
                height: 12px;
                border-radius: 2px;
            }
            
            .legend-text {
                font-size: 12px;
                color: #495057;
            }
            
            .c3-tooltip {
                border: 1px solid #dee2e6;
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            }
            
            .c3-tooltip th {
                background: #f8f9fa;
                font-weight: bold;
                padding: 8px 12px;
            }
            
            .c3-tooltip td {
                padding: 6px 12px;
            }
            
            /* Hide points when there are many data points */
            .timeseries-chart.hide-points .c3-circle {
                display: none !important;
            }
            
            .timeseries-chart.hide-points .c3-line {
                stroke-width: 1px;
            }
            
            /* Make all lines thinner */
            .timeseries-chart .c3-line {
                stroke-width: 1px !important;
            }
            
            /* Style x-axis grid lines for better visibility */
            .c3-grid .c3-xgrid-line {
                stroke: #e0e0e0;
                stroke-width: 1px;
                stroke-dasharray: 2,2;
            }
            
            /* Hide x-axis tick lines when there are many data points */
            .timeseries-chart.hide-x-ticks .c3-axis-x .c3-tick line {
                display: none !important;
            }
            
            /* Labels are controlled directly by C3.js configuration */
            
            /* Legend overflow handling - more specific targeting */
            .timeseries-chart .c3-legend,
            .timeseries-chart .c3-legend-item,
            .timeseries-chart .c3-legend-item text {
                max-width: 100% !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
            }
            
            /* Force legend container to be scrollable */
            .timeseries-chart .c3-legend {
                max-height: 150px !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                padding: 8px !important;
                border: 1px solid #ddd !important;
                border-radius: 4px !important;
                background: #f8f9fa !important;
                position: relative !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }
            
            /* Legend items styling */
            .timeseries-chart .c3-legend-item {
                margin: 2px 4px 2px 0 !important;
                white-space: nowrap !important;
                display: inline-block !important;
                max-width: calc(100% - 20px) !important;
            }
            
            /* Legend text truncation for very long names */
            .timeseries-chart .c3-legend-item text {
                max-width: 180px !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }
            
            /* Ensure chart container doesn't overflow */
            .timeseries-chart {
                overflow: hidden !important;
                position: relative !important;
                width: 100% !important;
                max-width: 100% !important;
            }
            
            /* Force C3 chart to respect container bounds */
            .timeseries-chart .c3 {
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
            .legend-toggle {
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
            
            .legend-toggle:hover {
                background: #0056b3;
            }
            
            /* Hide legend when toggled off */
            .timeseries-chart.legend-hidden .c3-legend {
                display: none !important;
            }
            
            /* Hide legend text when showLegendText is false */
            .timeseries-chart.legend-no-text .c3-legend-item text {
                display: none !important;
            }
            
            /* Adjust legend item spacing when text is hidden */
            .timeseries-chart.legend-no-text .c3-legend-item {
                margin-right: 8px !important;
            }
            
            /* Hide custom legend div when showCustomLegend is false */
            .custom-legend-hidden .metric-legend {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    createContainer() {
        this.container.innerHTML = 
            '<div class="timeseries-controls">' +
                '<select id="' + this.containerId + '-timeSpan" class="control-select">' +
                    '<option value="1min">1 Minute</option>' +
                    '<option value="2min">2 Minutes</option>' +
                    '<option value="5min">5 Minutes</option>' +
                    '<option value="10min">10 Minutes</option>' +
                    '<option value="30min">30 Minutes</option>' +
                    '<option value="1hour">1 Hour</option>' +
                    '<option value="6hour">6 Hours</option>' +
                    '<option value="1day">1 Day</option>' +
                '</select>' +
                '<select id="' + this.containerId + '-aggregation" class="control-select">' +
                    '<option value="average">Average</option>' +
                    '<option value="sum">Sum</option>' +
                    '<option value="max">Maximum</option>' +
                    '<option value="min">Minimum</option>' +
                    '<option value="count">Count</option>' +
                '</select>' +
                '<select id="' + this.containerId + '-chartType" class="control-select">' +
                    '<option value="line">Line Chart</option>' +
                    '<option value="area">Area Chart</option>' +
                    '<option value="bar">Bar Chart</option>' +
                '</select>' +
                '<select id="' + this.containerId + '-widthMultiplier" class="control-select">' +
                    '<option value="1">1x Width</option>' +
                    '<option value="2">2x Width</option>' +
                    '<option value="5">5x Width</option>' +
                    '<option value="10">10x Width</option>' +
                    '<option value="20">20x Width</option>' +
                    '<option value="30">30x Width</option>' +
                '</select>' +
            '</div>' +
            '<div class="chart-scroll-container">' +
                '<div id="' + this.containerId + '-chart" class="timeseries-chart">' +
                    '<button class="legend-toggle" onclick="toggleLegend(\'' + this.containerId + '\')">Toggle Legend</button>' +
                    '<div class="chart-loading">Loading chart...</div>' +
                '</div>' +
            '</div>' +
            '<div id="' + this.containerId + '-legend" class="metric-legend"></div>';
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
    }
    
    loadData(timestamps, metrics) {
        this.timestamps = timestamps;
        this.metrics = metrics;
        this.updateChart();
    }
    
    addChart(timestamps, metrics) {
        console.log('addChart called with:', { timestamps, metrics });
        
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
        
        // Create a new chart container
        const newChartId = this.containerId + '-chart-' + this.chartIndex;
        const chartContainer = document.createElement('div');
        chartContainer.id = newChartId;
        chartContainer.className = 'timeseries-chart';
        chartContainer.innerHTML = '<div class="chart-loading">Loading chart...</div>';
        
        // Insert after the existing chart
        const existingChart = document.getElementById(this.containerId + '-chart');
        existingChart.parentNode.insertBefore(chartContainer, existingChart.nextSibling);
        
        // Create chart data object
        const chartData = {
            id: newChartId,
            timestamps: timestamps,
            metrics: metrics,
            chart: null
        };
        
        // Add to charts array
        this.charts.push(chartData);
        this.chartIndex++;
        
        // Render the new chart
        this.renderAdditionalChart(chartData);
        
        return chartData;
    }
    
    updateChart() {
        if (!this.timestamps.length || !Object.keys(this.metrics).length) {
            this.showError('No data available');
            return;
        }
        
        this.showLoading();
        
        setTimeout(() => {
            try {
                const processedData = this.processData();
                this.renderChart(processedData);
                this.updateLegend(processedData);
                
                // Update all additional charts
                this.charts.forEach(chartData => {
                    this.renderAdditionalChart(chartData);
                });
            } catch (error) {
                console.error('Error updating chart:', error);
                this.showError('Error rendering chart: ' + error.message);
            }
        }, 100);
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
        const chartType = document.getElementById(this.containerId + '-chartType').value;
        
        // Prepare data for C3.js
        const columns = [];
        const colors = {};
        
        // Add timestamps as x-axis
        const xValues = ['x', ...data.timestamps.map(ts => new Date(parseInt(ts)))];
        columns.push(xValues);
        
        // Add metric data
        let colorIndex = 0;
        Object.keys(data.metrics).forEach(metricName => {
            const metricData = data.metrics[metricName];
            const values = ['data' + colorIndex, ...data.timestamps.map(ts => metricData[ts] || null)];
            columns.push(values);
            colors['data' + colorIndex] = this.colorPalette[colorIndex % this.colorPalette.length];
            colorIndex++;
        });
        
        // Determine if we should show points and labels based on data size
        const totalDataPoints = data.timestamps.length;
        const totalSeries = Object.keys(data.metrics).length;
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
        
        // Create new chart
        this.chart = c3.generate({
            bindto: '#' + this.containerId + '-chart',
            data: {
                x: 'x',
                columns: columns,
                type: chartType,
                colors: colors,
                names: this.getMetricNames(), // Use metric names instead of data IDs
                labels: showValueLabels ? {
                    format: function (v) {
                        return parseFloat(v).toFixed(2);
                    }
                } : false
            },
            axis: {
                x: {
                    type: 'timeseries',
                    tick: {
                        format: this.getTimeFormat(data.timestamps),
                        rotate: -45,
                        // Control tick count based on data size - show fewer ticks for large datasets
                        count: showXAxisGrid ? undefined : Math.max(3, Math.min(8, Math.floor(totalDataPoints / 50)))
                    },
                    label: {
                        text: '' // Remove x-axis title
                    }
                },
                y: {
                    tick: {
                        format: d3.format('.2f')
                    }
                }
            },
            grid: {
                x: {
                    show: this.options.showGrid && showXAxisGrid
                },
                y: {
                    show: this.options.showGrid
                }
            },
            tooltip: {
                show: this.options.showTooltip,
                format: {
                    title: (d) => new Date(d).toLocaleString(),
                    value: (value, ratio, id, index) => {
                        const metricName = this.getMetricNameById(id);
                        return metricName + ': ' + d3.format('.2f')(value);
                    }
                }
            },
            legend: {
                show: this.options.showLegend,
                position: 'bottom',
                item: {
                    onclick: function (id) {
                        // Toggle series visibility
                        if (this.chart) {
                            this.chart.toggle(id);
                        }
                    }
                }
            },
            transition: {
                duration: this.options.animate ? 750 : 0
            },
            size: {
                height: this.options.height
            },
            padding: {
                top: 20,
                right: 20,
                bottom: 60,
                left: 60
            }
        });
        
        // Apply dynamic label visibility based on current series count and chart type
        this.applyDynamicLabelVisibility(chartType, totalSeries);
        
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
        legendContainer.innerHTML = '';
        
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
        chartContainer.innerHTML = '<div class="chart-loading">Loading chart...</div>';
    }
    
    hideLoading() {
        const chartContainer = document.getElementById(this.containerId + '-chart');
        const loading = chartContainer.querySelector('.chart-loading');
        if (loading) {
            loading.remove();
        }
    }
    
    showError(message) {
        const chartContainer = document.getElementById(this.containerId + '-chart');
        chartContainer.innerHTML = '<div class="chart-error">' + message + '</div>';
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
        return Math.max(...values);
    }
    
    min(values) {
        if (!Array.isArray(values) || values.length === 0) return 0;
        return Math.min(...values);
    }
    
    count(values) {
        if (!Array.isArray(values)) return 0;
        return values.length;
    }
    
    // Public API methods
    updateData(timestamps, metrics) {
        this.loadData(timestamps, metrics);
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
                
                // Apply the new width to the chart container
                chartContainer.style.width = newWidth + 'px';
                chartContainer.style.minWidth = newWidth + 'px';
                
                // Resize the main chart
                if (this.chart) {
                    this.chart.resize({
                        width: newWidth,
                        height: this.options.height
                    });
                }
                
                // Resize all additional charts
                this.charts.forEach(chartData => {
                    if (chartData.chart) {
                        chartData.chart.resize({
                            width: newWidth,
                            height: this.options.height
                        });
                    }
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
    
    renderAdditionalChart(chartData) {
        if (!chartData.timestamps.length || !Object.keys(chartData.metrics).length) {
            this.showError('No data available', chartData.id);
            return;
        }
        
        try {
            // Process data for this specific chart
            const processedData = this.processChartData(chartData.timestamps, chartData.metrics);
            
            if (!processedData) {
                this.showError('Failed to process chart data', chartData.id);
                return;
            }
            
            // Destroy existing chart if it exists
            if (chartData.chart) {
                chartData.chart.destroy();
            }
            
            // Create new chart
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
                    height: this.options.height
                }
            });
            
        } catch (error) {
            console.error('Error rendering additional chart:', error);
            this.showError('Error rendering chart: ' + error.message, chartData.id);
        }
    }
    
    processChartData(timestamps, metrics) {
        const timeSpan = this.timeSpanOptions[document.getElementById(this.containerId + '-timeSpan').value];
        const aggregation = document.getElementById(this.containerId + '-aggregation').value;
        const aggregationFunc = this.aggregationFunctions[aggregation];
        
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
                    processedMetrics[metricName] = this.aggregateMetricValues(values, groupedData, aggregationFunc);
                    console.log('Successfully processed metric:', metricName, 'result:', processedMetrics[metricName]);
                } catch (error) {
                    console.error('Error processing metric ' + metricName + ':', error);
                    processedMetrics[metricName] = {};
                }
            }
        } catch (error) {
            console.error('Error in forEach loop:', error);
            console.error('Metrics object:', metrics);
            console.error('Object.keys result:', Object.keys(metrics));
        }
        
        // Create the final data structure
        const finalData = {
            timestamps: Object.keys(groupedData).sort(),
            metrics: processedMetrics
        };
        
        // Prepare data for C3
        const columns = [['x', ...finalData.timestamps]];
        const colors = {};
        const metricNames = {};
        
        Object.keys(finalData.metrics).forEach((metricName, index) => {
            const dataKey = 'data' + index;
            const values = finalData.metrics[metricName] || [];
            columns.push([dataKey, ...values]);
            colors[dataKey] = this.colorPalette[index % this.colorPalette.length];
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
                colors: colors,
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
                        count: showXAxisGrid ? undefined : 0
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
                    title: (d) => new Date(d).toLocaleString(),
                    value: (value, ratio, id, index) => {
                        const metricName = metricNames[id] || 'Unknown';
                        return metricName + ': ' + parseFloat(value).toFixed(2);
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
                pattern: Object.values(colors)
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

// Export for external use
window.TimeSeriesChart = TimeSeriesChart;
</script>

