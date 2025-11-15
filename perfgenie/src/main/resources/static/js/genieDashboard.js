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
(function() {
    // Check if GenieDashboard is already defined
    if (typeof window !== 'undefined' && window.GenieDashboard) {
        return; // Already defined, skip
    }
    
    class GenieDashboard {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
            throw new Error(`Container with ID '${containerId}' not found`);
        }
        
        // Create instance identifier for unique IDs (similar to SFDataTable pattern)
        // Use containerId as base, sanitize it to be a valid ID prefix
        this.instanceId = this.sanitizeId(containerId);
        
        this.options = {
            chartLibrary: 'chartjs', // 'chartjs' or 'c3' or 'd3'
            gridColumns: 24, // Grafana standard
            panelSpacing: 10,
            responsive: true,
            theme: 'light',
            ...options
        };
        
        this.dashboardConfig = null;
        this.inputConfig = null;
        this.panels = [];
        this.charts = {};
        this.dataCache = {};
        
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
    injectStyles() {
        if (document.getElementById('genie-dashboard-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'genie-dashboard-styles';
        style.textContent = `
            /* Scope all styles to genie-dashboard-container to prevent conflicts */
            .genie-dashboard-container {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                padding: 0 10px 10px 10px;
                background: #f7f8fa;
                min-height: 10vh;
            }
            .genie-dashboard-container.genie-dashboard-collapsed {
                padding: 0;
                background: transparent;
                min-height: auto;
            }
            
            .genie-dashboard-container .genie-dashboard-grid {
                display: grid;
                grid-template-columns: repeat(24, 1fr);
                grid-auto-rows: minmax(20px, auto);
                gap: ${this.options.panelSpacing}px;
                width: 100%;
                align-items: start;
                /* Ensure grid rows size to content but respect explicit row spans */
            }
            .genie-dashboard-container .genie-dashboard-grid.genie-dashboard-collapsed {
                display: none !important;
            }
            
            .genie-dashboard-container .genie-dashboard-panel {
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                overflow: hidden !important; /* Changed from visible to hidden to prevent overflow */
                position: relative;
                display: flex;
                flex-direction: column;
                box-sizing: border-box;
                /* Height will be determined by CSS grid based on gridPos.h */
                /* Don't set height here - let grid allocate it */
            }
            
            .genie-dashboard-container .genie-dashboard-panel-header {
                padding: 6px 8px 6px 18px;
                border-bottom: 1px solid #e5e7eb;
                background: #fafbfc;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                position: relative;
                z-index: 10; /* Above panelContent */
            }
            
            /* When header contains tabs, remove bottom border from header itself */
            .genie-dashboard-container .genie-dashboard-panel-header:has(.genie-dashboard-tabs) {
                border-bottom: none;
            }
            
            .genie-dashboard-container .genie-dashboard-panel-title {
                font-size: 14px;
                font-weight: 600;
                color: #1f2937;
                margin: 0;
            }
            
            .genie-dashboard-container .genie-dashboard-panel-description {
                font-size: 12px;
                color: #6b7280;
                margin-top: 4px;
            }
            
            .genie-dashboard-container .genie-dashboard-panel-content {
                padding: 0 0 8px 0;
                position: relative;
                overflow: visible !important;
                flex: 1;
                display: flex;
                flex-direction: column;
                min-height: 0;
            }
            
            /* Remove padding for stat panel content to maximize space */
            .genie-dashboard-container .genie-dashboard-panel[data-panel-type="stat"] .genie-dashboard-panel-content,
            .genie-dashboard-container .genie-dashboard-panel[data-panel-type="singlestat"] .genie-dashboard-panel-content {
                padding: 0;
            }
            
            /* Tabs for timeseries panels */
            .genie-dashboard-container .genie-dashboard-tabs {
                display: flex;
                border: none;
                margin-bottom: 6px;
                background: transparent;
                padding: 0 8px;
                margin-left: auto;
                align-items: center;
            }
            
            /* When tabs are in header, adjust styling */
            .genie-dashboard-container .genie-dashboard-panel-header .genie-dashboard-tabs {
                margin-bottom: 0;
                border: none;
                padding: 0;
                flex: 1;
            }
            
            .genie-dashboard-container .genie-dashboard-tab {
                padding: 6px 10px;
                cursor: pointer;
                border: none;
                background: transparent;
                font-size: 14px;
                font-weight: 500;
                color: #6b7280;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                min-width: 32px;
            }
            
            .genie-dashboard-container .genie-dashboard-tab .genie-dashboard-tab-icon {
                font-size: 18px;
                line-height: 1;
            }
            
            /* Make % icon match visual size of emoji icons */
            .genie-dashboard-container .genie-dashboard-tab[data-icon="percent"] .genie-dashboard-tab-icon {
                font-size: 16px;
                font-weight: 600;
                line-height: 1;
            }
            
            /* Make cumulative (+) icon thin */
            .genie-dashboard-container .genie-dashboard-tab[data-icon="cumulative"] .genie-dashboard-tab-icon {
                font-weight: 200;
                font-size: 20px;
                line-height: 1;
            }
            
            /* Make sum and avg icons match visual size of emoji icons */
            .genie-dashboard-container .genie-dashboard-tab[data-icon="sum"] .genie-dashboard-tab-icon,
            .genie-dashboard-container .genie-dashboard-tab[data-icon="avg"] .genie-dashboard-tab-icon {
                font-size: 18px;
                font-weight: 600;
                line-height: 1;
            }
            
            .genie-dashboard-container .genie-dashboard-tab:hover {
                color: #1f2937;
                background: #f3f4f6;
            }
            
            .genie-dashboard-container .genie-dashboard-tab.genie-dashboard-active {
                color: #3b82f6;
                background: rgba(59, 130, 246, 0.1);
                border-radius: 4px;
            }
            
            .genie-dashboard-container .genie-dashboard-tab-content {
                display: none !important;
                position: relative;
                overflow: visible !important;
            }
            
            .genie-dashboard-container .genie-dashboard-tab-content.genie-dashboard-active {
                display: block !important;
                overflow: visible !important;
            }
            
            /* Stats tab content needs scrolling, override visible overflow */
            .genie-dashboard-container .genie-dashboard-tab-content[id^="genie-stats-tab-"] {
                overflow-y: auto !important;
                overflow-x: hidden !important;
                padding: 0px 8px 4px 8px;
                box-sizing: border-box;
            }
            
            /* Custom list legend styling */
            .genie-dashboard-container .genie-legend-list-container {
                z-index: 5 !important;
                background: rgba(255, 255, 255, 0.95);
                border: none !important;
                border-top: none !important;
                border-left: none !important;
                border-right: none !important;
                border-radius: 0;
                box-shadow: none !important;
                padding: 0px 8px 4px 8px;
                box-sizing: border-box;
                pointer-events: auto;
            }
            
            .genie-dashboard-container .genie-legend-list {
                scrollbar-width: thin;
                scrollbar-color: #94a3b8 #f1f5f9;
                box-sizing: border-box;
                overflow-y: auto;
                overflow-x: hidden;
            }
            
            /* Force scrollbar to always be visible when content overflows - position on right side */
            .genie-dashboard-container .genie-legend-list::-webkit-scrollbar {
                width: 8px;
                -webkit-appearance: none;
                display: block !important;
            }
            
            .genie-dashboard-container .genie-legend-list::-webkit-scrollbar-track {
                background: transparent;
                margin: 0;
            }
            
            .genie-dashboard-container .genie-legend-list::-webkit-scrollbar-thumb {
                background: #94a3b8;
                border-radius: 4px;
                min-height: 20px;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .genie-dashboard-container .genie-legend-list::-webkit-scrollbar-thumb:hover {
                background: #64748b;
            }
            
            /* When has-scroll class, use scroll instead of auto to always show scrollbar */
            .genie-dashboard-container .genie-legend-list.genie-dashboard-has-scroll {
                overflow-y: scroll !important;
            }
            
            
            .genie-dashboard-container .genie-legend-item {
                transition: background-color 0.2s ease;
            }
            
            .genie-dashboard-container .genie-legend-item span {
                user-select: text;
                cursor: text;
            }
            
            /* Stats table styling */
            .genie-dashboard-container .genie-dashboard-stats-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
            }
            
            .genie-dashboard-container .genie-dashboard-stats-table-wrapper {
                position: relative;
                overflow-y: auto;
                overflow-x: auto;
                flex: 1 1 auto;
                min-height: 0;
                height: 100%;
                padding: 0 6px 6px 6px;
            }
            
            .genie-dashboard-container .genie-dashboard-stats-table {
                position: relative;
            }
            
            .genie-dashboard-container .genie-dashboard-stats-table thead {
                position: sticky;
                top: 0;
                z-index: 10;
                background: #f8f9fa;
                visibility: visible !important;
                display: table-header-group !important;
            }
            
            .genie-dashboard-container .genie-dashboard-stats-table th {
                background: #f8f9fa;
                padding: 4px 6px;
                text-align: left;
                font-weight: 600;
                color: #1f2937;
                border-bottom: 2px solid #e5e7eb;
                position: sticky;
                top: 0;
                z-index: 11;
            }
            
            .genie-dashboard-container .genie-dashboard-stats-table th.genie-dashboard-sortable {
                cursor: pointer;
                user-select: none;
                position: sticky;
                top: 0;
                padding-right: 24px;
            }
            
            .genie-dashboard-container .genie-dashboard-stats-table th.genie-dashboard-sortable:hover {
                background: #e9ecef;
            }
            
            .genie-dashboard-container .genie-dashboard-stats-table th.genie-dashboard-sortable::after {
                content: '↕';
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
                font-size: 12px;
                color: #9ca3af;
                opacity: 0.5;
            }
            
            .genie-dashboard-container .genie-dashboard-stats-table th.genie-dashboard-sortable.genie-dashboard-sort-asc::after {
                content: '↑';
                opacity: 1;
                color: #3773b3;
            }
            
            .genie-dashboard-container .genie-dashboard-stats-table th.genie-dashboard-sortable.genie-dashboard-sort-desc::after {
                content: '↓';
                opacity: 1;
                color: #3773b3;
            }
            
            .genie-dashboard-container .genie-dashboard-stats-table td {
                padding: 4px 6px;
                border-bottom: 1px solid #f1f3f5;
                color: #374151;
            }
            
            .genie-dashboard-container .genie-dashboard-stats-table tbody tr:hover {
                background: #f8f9fa;
            }
            
            .genie-dashboard-container .genie-dashboard-stats-table tbody tr:last-child td {
                border-bottom: none;
            }
            
            /* Context menu styles - fixed position so needs to be outside container scope */
            .genie-dashboard-context-menu {
                position: fixed;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                padding: 4px 0;
                z-index: 10001;
                min-width: 160px;
                max-width: 280px;
                display: none;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .genie-dashboard-context-menu-item {
                padding: 6px 16px;
                cursor: pointer;
                font-size: 13px;
                color: #374151;
                user-select: none;
                transition: background-color 0.15s ease, color 0.15s ease;
                display: flex;
                align-items: center;
            }
            
            .genie-dashboard-context-menu-item:hover {
                background: linear-gradient(to right, #f0f9ff 0%, #e0f2fe 100%);
                color: #0369a1;
            }
            
            .genie-dashboard-context-menu-item:active {
                background: linear-gradient(to right, #dbeafe 0%, #bfdbfe 100%);
                color: #075985;
            }
            
            .genie-dashboard-container .genie-dashboard-stats-series-name {
                cursor: context-menu;
                user-select: none;
                font-weight: 600;
                color: #1f2937;
            }
            
            /* Chart.js tooltips - scoped by container ID */
            .genie-dashboard-container #chartjs-tooltip,
            .genie-dashboard-container #chartjs-tooltip-*,
            .genie-dashboard-container [id^="chartjs-tooltip-"],
            .genie-dashboard-container .chartjs-tooltip {
                z-index: 10000 !important;
                pointer-events: none !important;
                position: fixed !important;
                /* Force left alignment - prevent right alignment */
                right: auto !important;
                transform: none !important;
                transform-origin: initial !important;
                text-align: left !important;
                width: auto !important;
            }
            
            /* Ensure tooltip is visible when shown */
            .genie-dashboard-container .chartjs-tooltip {
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
                box-sizing: border-box !important;
            }
            
            /* Tooltip body container */
            .genie-dashboard-container .chartjs-tooltip-body {
                width: auto !important;
            }
            
            /* Ensure tooltip body items use flexbox to keep color squares visible */
            .genie-dashboard-container .chartjs-tooltip-body-item {
                display: flex !important;
                align-items: center !important;
            }
            
            /* Tooltip labels and values */
            .genie-dashboard-container .chartjs-tooltip-body-item-label,
            .genie-dashboard-container .chartjs-tooltip-body-item-value {
                flex: 1 1 auto !important;
            }
            
            /* Color square/marker in tooltip - keep it visible and prevent shrinking/expanding */
            .genie-dashboard-container .chartjs-tooltip-body-item-marker,
            .genie-dashboard-container .chartjs-tooltip-body-item-color,
            .genie-dashboard-container .chartjs-tooltip-body-item-marker *,
            .genie-dashboard-container .chartjs-tooltip-body-item-color * {
                flex-shrink: 0 !important;
                flex-grow: 0 !important;
                flex-basis: 12px !important;
                min-width: 12px !important;
                max-width: 12px !important;
                width: 12px !important;
                min-height: 12px !important;
                max-height: 12px !important;
                height: 12px !important;
                display: inline-block !important;
                margin-right: 8px !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: relative !important;
                box-sizing: border-box !important;
            }
            
            
            /* Make sure tooltip text is visible */
            .genie-dashboard-container #chartjs-tooltip *,
            .genie-dashboard-container [id^="chartjs-tooltip-"] * {
                color: #000000 !important;
            }
            
            /* Ensure tooltip background is white */
            .genie-dashboard-container .chartjs-tooltip {
                background-color: rgba(255, 255, 255, 0.95) !important;
                border: 1px solid rgba(0, 0, 0, 0.2) !important;
            }
            
            .genie-dashboard-container .genie-dashboard-panel-loading {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 200px;
                color: #6b7280;
                font-size: 14px;
            }
            
            .genie-dashboard-container .genie-dashboard-panel-error {
                padding: 16px;
                color: #dc2626;
                font-size: 14px;
                background: #fef2f2;
                border-left: 3px solid #dc2626;
            }
            
            .genie-dashboard-container .genie-dashboard-chart-container {
                position: relative;
                width: 100%;
                height: 100%;
            }
            
            @media (max-width: 768px) {
                .genie-dashboard-container .genie-dashboard-grid {
                    grid-template-columns: 1fr;
                }
                
                .genie-dashboard-container .genie-dashboard-panel {
                    grid-column: 1 / -1 !important;
                }
            }
            
            /* Toolbar styles */
            .genie-dashboard-container .genie-dashboard-toolbar {
                background: #f8f9fa;
                border-bottom: 1px solid #e5e7eb;
                padding: 0 8px;
                display: flex;
                align-items: center;
                gap: 16px;
                flex-wrap: wrap;
                position: sticky;
                top: 0;
                z-index: 100;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            }
            .genie-dashboard-container .genie-toolbar-group {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .genie-dashboard-container .genie-toolbar-label {
                font-size: 13px;
                font-weight: 500;
                color: #374151;
                white-space: nowrap;
            }
            .genie-dashboard-container .genie-toolbar-input {
                padding: 6px 10px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                font-size: 13px;
                background: white;
                color: #1f2937;
            }
            .genie-dashboard-container .genie-toolbar-input:focus {
                outline: none;
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }
            .genie-dashboard-container .genie-toolbar-select {
                padding: 6px 10px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                font-size: 13px;
                background: white;
                color: #1f2937;
                cursor: pointer;
            }
            .genie-dashboard-container .genie-toolbar-select:focus {
                outline: none;
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }
            .genie-dashboard-container .genie-toolbar-icon-button {
                padding: 8px 12px;
                background: transparent;
                color: #374151;
                border: none;
                border-radius: 4px;
                font-size: 18px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                min-width: 40px;
            }
            .genie-dashboard-container .genie-toolbar-icon-button:hover {
                background: #f9fafb;
            }
            .genie-dashboard-container .genie-toolbar-icon-button:active {
                background: #f3f4f6;
            }
            .genie-dashboard-container .genie-toolbar-separator {
                width: 1px;
                height: 24px;
                background: #e5e7eb;
            }
            .genie-dashboard-container .genie-time-range-display {
                font-size: 12px;
                color: #6b7280;
                margin-left: 8px;
                white-space: nowrap;
            }
            .genie-dashboard-container .genie-time-range-popup {
                display: none;
                position: absolute;
                top: 100%;
                left: 0;
                margin-top: 8px;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                padding: 16px;
                min-width: 400px;
                z-index: 1000;
            }
            .genie-dashboard-container .genie-time-range-popup.genie-dashboard-show {
                display: block;
            }
            .genie-dashboard-container .genie-time-range-quick-intervals {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                margin-bottom: 16px;
            }
            .genie-dashboard-container .genie-quick-interval-btn {
                padding: 8px 12px;
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
                color: #374151;
                cursor: pointer;
                text-align: center;
                transition: all 0.2s;
            }
            .genie-dashboard-container .genie-quick-interval-btn:hover {
                background: #f3f4f6;
                border-color: #d1d5db;
            }
            .genie-dashboard-container .genie-quick-interval-btn.genie-dashboard-active {
                background: #3b82f6;
                color: white;
                border-color: #3b82f6;
            }
            .genie-dashboard-container .genie-time-range-custom {
                border-top: 1px solid #e5e7eb;
                padding-top: 16px;
                margin-top: 16px;
            }
            .genie-dashboard-container .genie-time-range-custom h4 {
                margin: 0 0 12px 0;
                font-size: 13px;
                font-weight: 600;
                color: #374151;
            }
            .genie-dashboard-container .genie-time-range-custom-group {
                display: flex;
                gap: 12px;
                align-items: center;
            }
            .genie-dashboard-container .genie-time-range-custom-group label {
                font-size: 12px;
                font-weight: 500;
                color: #6b7280;
                min-width: 50px;
            }
            .genie-dashboard-container .genie-time-range-custom-group input {
                flex: 1;
                padding: 6px 10px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                font-size: 13px;
                background: white;
                cursor: text;
            }
            .genie-dashboard-container .genie-time-range-custom-group input:focus {
                outline: none;
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }
            .genie-dashboard-container .genie-time-range-popup-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid #e5e7eb;
            }
            .genie-dashboard-container .genie-time-range-popup-btn {
                padding: 6px 16px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }
            .genie-dashboard-container .genie-time-range-popup-btn.genie-dashboard-btn-cancel {
                background: white;
                color: #374151;
            }
            .genie-dashboard-container .genie-time-range-popup-btn.genie-dashboard-btn-cancel:hover {
                background: #f9fafb;
            }
            .genie-dashboard-container .genie-time-range-popup-btn.genie-dashboard-btn-apply {
                background: #3b82f6;
                color: white;
                border-color: #3b82f6;
            }
            .genie-dashboard-container .genie-time-range-popup-btn.genie-dashboard-btn-apply:hover {
                background: #2563eb;
            }
            /* Toolbar collapse bar */
            .genie-dashboard-container .genie-toolbar-collapse-bar {
                background: #f8f9fa;
                border-bottom: 1px solid #e5e7eb;
                height: 7px;
                cursor: pointer;
                position: sticky;
                top: 0;
                z-index: 101;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background-color 0.2s ease;
            }
            .genie-dashboard-container .genie-toolbar-collapse-bar:hover {
                background: #e9ecef;
            }
            .genie-dashboard-container .genie-toolbar-collapse-bar::before {
                content: '▼';
                font-size: 8px;
                color: #6b7280;
                transition: transform 0.2s ease;
            }
            .genie-dashboard-container .genie-toolbar-collapse-bar.genie-dashboard-collapsed::before {
                transform: rotate(180deg);
            }
            .genie-dashboard-container .genie-dashboard-toolbar.genie-dashboard-collapsed {
                display: none;
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Flatten nested panels recursively
     * @param {Array} panels - Array of panels (may contain nested panels)
     * @returns {Array} - Flattened array of all panels
     */
    flattenPanels(panels) {
        const flattened = [];
        if (!Array.isArray(panels)) {
            return flattened;
        }
        
        panels.forEach(panel => {
            if (panel && typeof panel === 'object') {
                // Add the panel itself
                flattened.push(panel);
                
                // If panel has nested panels, recursively flatten them
                if (panel.panels && Array.isArray(panel.panels)) {
                    const nestedPanels = this.flattenPanels(panel.panels);
                    flattened.push(...nestedPanels);
                }
            }
        });
        
        return flattened;
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
            
            // Extract panels (flatten nested panels recursively)
            this.panels = this.flattenPanels(this.dashboardConfig.panels || []);
            
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
                // Not collapsed - render panels normally
                const renderPromises = this.panels.map((panel, index) => 
                    this.renderPanel(panel, index, grid)
                );
                
                await Promise.all(renderPromises);
                this._panelsRendered = true;
                
                // Setup dashboard collapse/expand functionality after everything is rendered
                this.setupDashboardCollapse();
            }
            
        } catch (error) {
            console.error('GenieDashboard: Error rendering dashboard:', error);
            this.container.innerHTML = `<div class="genie-dashboard-panel-error">Error rendering dashboard: ${error.message}</div>`;
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
                { minutes: 15, label: 'Last 15m' },
                { minutes: 30, label: 'Last 30m' },
                { minutes: 60, label: 'Last 1h', active: true },
                { minutes: 120, label: 'Last 2h' },
                { minutes: 360, label: 'Last 6h' },
                { minutes: 720, label: 'Last 12h' },
                { minutes: 1440, label: 'Last 1d' },
                { minutes: 2880, label: 'Last 2d' },
                { minutes: 10080, label: 'Last 7d' },
                { minutes: 20160, label: 'Last 14d' },
                { minutes: 43200, label: 'Last 30d' },
                { mode: 'custom', label: 'Custom' }
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
        
        // Interval input
        if (showInterval) {
            const intervalGroup = document.createElement('div');
            intervalGroup.className = 'genie-toolbar-group';
            
            const intervalLabel = document.createElement('label');
            intervalLabel.className = 'genie-toolbar-label';
            intervalLabel.setAttribute('for', 'genie-toolbar-interval');
            intervalLabel.textContent = 'Span:';
            
            const intervalInput = document.createElement('input');
            intervalInput.type = 'text';
            intervalInput.id = this.getInstanceId('toolbar-interval');
            intervalInput.className = 'genie-toolbar-input';
            intervalInput.value = this.inputConfig['$interval'] || '1m';
            intervalInput.placeholder = 'e.g., 1m, 5m, 1h';
            intervalInput.style.width = '80px';
            
            intervalGroup.appendChild(intervalLabel);
            intervalGroup.appendChild(intervalInput);
            toolbar.appendChild(intervalGroup);
        }
        
        // Aggregation dropdown
        if (showAggregation) {
            const aggGroup = document.createElement('div');
            aggGroup.className = 'genie-toolbar-group';
            
            const aggLabel = document.createElement('label');
            aggLabel.className = 'genie-toolbar-label';
            aggLabel.setAttribute('for', this.getInstanceId('toolbar-agg'));
            aggLabel.textContent = 'Aggregation:';
            
            const aggSelect = document.createElement('select');
            aggSelect.id = this.getInstanceId('toolbar-agg');
            aggSelect.className = 'genie-toolbar-select';
            const currentAggValue = this.inputConfig['$agg'] || '';
            aggSelect.innerHTML = `
                <option value="" ${!currentAggValue ? 'selected' : ''}>-- Select --</option>
                <option value="sum" ${currentAggValue === 'sum' ? 'selected' : ''}>Sum</option>
                <option value="avg" ${currentAggValue === 'avg' ? 'selected' : ''}>Avg</option>
                <option value="max" ${currentAggValue === 'max' ? 'selected' : ''}>Max</option>
                <option value="min" ${currentAggValue === 'min' ? 'selected' : ''}>Min</option>
            `;
            
            aggGroup.appendChild(aggLabel);
            aggGroup.appendChild(aggSelect);
            toolbar.appendChild(aggGroup);
        }
        
        // Refresh button
        if (showRefresh) {
            const refreshButton = document.createElement('button');
            refreshButton.type = 'button'; // Prevent form submission
            refreshButton.className = 'genie-toolbar-icon-button';
            refreshButton.id = this.getInstanceId('toolbar-refresh');
            refreshButton.title = 'Refresh dashboard';
            refreshButton.innerHTML = '<span>🔄</span>';
            toolbar.appendChild(refreshButton);
        }
        
        // Edit button
        if (showEdit) {
            const editButton = document.createElement('button');
            editButton.type = 'button'; // Prevent form submission
            editButton.className = 'genie-toolbar-icon-button';
            editButton.id = this.getInstanceId('toolbar-edit');
            editButton.title = 'Edit dashboard JSON';
            editButton.innerHTML = '<span>✏️</span>';
            toolbar.appendChild(editButton);
        }
        
        // Upload button (always shown if edit is enabled)
        if (showEdit) {
            const uploadButton = document.createElement('button');
            uploadButton.type = 'button'; // Prevent form submission
            uploadButton.className = 'genie-toolbar-icon-button';
            uploadButton.id = this.getInstanceId('toolbar-upload');
            uploadButton.title = 'Upload dashboard config';
            uploadButton.innerHTML = '<span>📤</span>';
            toolbar.appendChild(uploadButton);
        }
        
        // Insert toolbar at the beginning of container (after collapse bar)
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
        const collapseBar = document.getElementById(this.getInstanceId('collapse-bar'));
        const toolbar = document.getElementById(this.getInstanceId('toolbar'));
        // Use stored reference or fallback to getElementById
        const grid = this.dashboardGrid || document.getElementById(this.getInstanceId('grid'));
        const toolbarConfig = this.dashboardConfig.toolbar || {};
        const isToolbarEnabled = toolbarConfig.enabled !== false;
        
        if (!collapseBar || !grid) {
            console.warn('GenieDashboard: Collapse bar or grid not found', { collapseBar, grid, dashboardGrid: this.dashboardGrid });
            return;
        }
        
        // Setup collapse/expand toggle for entire dashboard
        collapseBar.addEventListener('click', () => {
            const isCollapsed = grid.classList.contains('genie-dashboard-collapsed');
            if (isCollapsed) {
                // Expand: show grid (and toolbar if enabled)
                this.container.classList.remove('genie-dashboard-collapsed');
                grid.classList.remove('genie-dashboard-collapsed');
                grid.style.display = 'grid'; // Force display with inline style
                if (toolbar && isToolbarEnabled) {
                    toolbar.classList.remove('genie-dashboard-collapsed');
                }
                collapseBar.classList.remove('genie-dashboard-collapsed');
                console.log('GenieDashboard: Dashboard expanded', grid);
                
                // If panels haven't been rendered yet, render them now (first expand)
                if (!this._panelsRendered) {
                    console.log('GenieDashboard: First expand - rendering panels');
                    const renderPromises = this.panels.map((panel, index) => 
                        this.renderPanel(panel, index, grid)
                    );
                    Promise.all(renderPromises).then(() => {
                        this._panelsRendered = true;
                        console.log('GenieDashboard: Panels rendered on first expand');
                    }).catch(error => {
                        console.error('GenieDashboard: Error rendering panels on first expand:', error);
                    });
                }
                
                // After expanding, trigger height recalculation for all panels
                // Wait for layout to update, then resize all charts and trigger recalculation
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Resize all charts to trigger height recalculation
                        if (this.charts) {
                            Object.values(this.charts).forEach(chart => {
                                if (chart && typeof chart.resize === 'function') {
                                    chart.resize();
                                }
                            });
                        }
                        
                        // Also trigger window resize event to ensure all components recalculate
                        window.dispatchEvent(new Event('resize'));
                        
                        // Find all panel containers and trigger their height recalculation
                        const panelDivs = grid.querySelectorAll('.genie-dashboard-panel');
                        panelDivs.forEach(panelDiv => {
                            // Trigger a custom event that panels can listen to, or force a layout recalculation
                            // by temporarily toggling a class or triggering a resize on the panel
                            const panelContent = panelDiv.querySelector('.genie-dashboard-panel-content');
                            if (panelContent) {
                                // Force a layout recalculation by reading offsetHeight
                                void panelContent.offsetHeight;
                                
                                // Find the panel object first to check for pending renders
                                const panelId = parseInt(panelDiv.getAttribute('data-panel-id'));
                                const panel = panelId && this.dashboardConfig && this.dashboardConfig.panels ? 
                                             this.dashboardConfig.panels.find(p => p.id === panelId) : null;
                                
                                // Check if there's a pending render that was skipped due to collapse
                                // This should be checked for ALL panels, not just those with active stats tabs
                                if (panel && panel._pendingStatsTableRender) {
                                    // Get stats content - it should exist if there's a pending render
                                    const statsContent = panelContent.querySelector('.genie-dashboard-stats-content');
                                    if (statsContent) {
                                        // Use a delay to ensure layout has fully settled after expansion
                                        setTimeout(() => {
                                            // Render the table that was skipped when collapsed
                                            const pending = panel._pendingStatsTableRender;
                                            this.renderStatsTable(panel, pending.dataArray, pending.container, pending.statsToShow, pending.previousDataArray, pending.isTransposed, pending.previousDuration);
                                            panel._pendingStatsTableRender = null; // Clear pending render
                                        }, 250);
                                    }
                                } else {
                                    // No pending render - check if stats tab is visible and needs re-rendering
                                    const statsTab = panelContent.querySelector('.genie-dashboard-tab[data-tab="stats"]');
                                    const statsContent = panelContent.querySelector('.genie-dashboard-stats-content');
                                    const isStatsTabActive = statsTab && statsTab.classList.contains('genie-dashboard-active');
                                    
                                    if (isStatsTabActive && statsContent && statsContent.style.display !== 'none' && panel && panel._currentDataArray) {
                                        // Statistics tab is visible - re-render to fix spacer height
                                        setTimeout(() => {
                                            // Get the compare dropdown value
                                            const compareDropdown = panelDiv.querySelector('.genie-dashboard-compare-dropdown');
                                            const currentDropdownValue = compareDropdown ? compareDropdown.value : null;
                                            const finalPreviousDuration = currentDropdownValue && currentDropdownValue !== 'none' ? currentDropdownValue : null;
                                            
                                            // Get previous data if available
                                            const previousDataArray = panel._previousDataArray || null;
                                            
                                            // Get transpose setting
                                            const isTransposed = panel.statsTable?.transpose || panel.options?.statsTable?.transpose || panel.transpose || false;
                                            
                                            // Get panel stats config
                                            const defaultStats = this.inputConfig?.stats || [];
                                            const panelStats = panel.stats || panel.options?.stats || defaultStats;
                                            
                                            // Directly call renderStatsTable with the stored currentDataArray
                                            // This will recreate the spacer div with the correct height
                                            this.renderStatsTable(panel, panel._currentDataArray, statsContent, panelStats, previousDataArray, isTransposed, finalPreviousDuration);
                                        }, 250);
                                    } else {
                                        // Stats tab not visible, just fix headers if they exist
                                        const statsTableWrappers = panelDiv.querySelectorAll('.genie-dashboard-stats-table-wrapper');
                                        statsTableWrappers.forEach(wrapper => {
                                            const table = wrapper.querySelector('.genie-dashboard-stats-table');
                                            if (table) {
                                                const thead = table.querySelector('thead');
                                                if (thead) {
                                                    // Force recalculation of sticky positioning
                                                    const currentTop = thead.style.top;
                                                    thead.style.top = '';
                                                    void thead.offsetHeight; // Force layout
                                                    thead.style.top = currentTop || '0';
                                                    
                                                    // Ensure thead is visible
                                                    thead.style.visibility = 'visible';
                                                    thead.style.display = '';
                                                    
                                                    // Force table wrapper to recalculate
                                                    void wrapper.offsetHeight;
                                                }
                                            }
                                        });
                                    }
                                }
                            }
                        });
                    });
                });
            } else {
                // Collapse: hide grid (and toolbar if enabled)
                this.container.classList.add('genie-dashboard-collapsed');
                grid.classList.add('genie-dashboard-collapsed');
                grid.style.display = 'none'; // Force hide with inline style
                if (toolbar && isToolbarEnabled) {
                    toolbar.classList.add('genie-dashboard-collapsed');
                }
                collapseBar.classList.add('genie-dashboard-collapsed');
                console.log('GenieDashboard: Dashboard collapsed', grid);
            }
        });
    }
    
    /**
     * Setup toolbar event handlers
     */
    setupToolbarHandlers() {
        // Helper functions for toolbar
        const formatDateForInput = (date) => {
            const d = new Date(date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        };
        
        const parseInputDate = (dateString) => {
            if (!dateString) return null;
            return new Date(dateString).getTime();
        };
        
        const getTimeRangeFromMinutes = (minutes) => {
            const end = Date.now();
            const start = end - (minutes * 60 * 1000);
            return { start, end };
        };
        
        const formatTimeRangeDisplay = (start, end, isCustomRange = false) => {
            if (!start || !end) return 'Last 1h';
            const now = Date.now();
            const diff = end - start;
            const minutes = Math.floor(diff / (60 * 1000));
            if (isCustomRange) {
                const startDate = new Date(start);
                const endDate = new Date(end);
                const startDateStr = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
                const startTimeStr = startDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                const endDateStr = endDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
                const endTimeStr = endDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                if (startDate.toDateString() === endDate.toDateString()) {
                    return `${startDateStr} ${startTimeStr} - ${endTimeStr}`;
                } else {
                    return `${startDateStr} ${startTimeStr} - ${endDateStr} ${endTimeStr}`;
                }
            }
            if (end === now || Math.abs(end - now) < 60000) {
                if (minutes < 60) return `Last ${minutes}m`;
                if (minutes < 1440) return `Last ${Math.floor(minutes / 60)}h`;
                return `Last ${Math.floor(minutes / 1440)}d`;
            } else {
                const startDate = new Date(start);
                const endDate = new Date(end);
                const startDateStr = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
                const startTimeStr = startDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                const endDateStr = endDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
                const endTimeStr = endDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                if (startDate.toDateString() === endDate.toDateString()) {
                    return `${startDateStr} ${startTimeStr} - ${endTimeStr}`;
                } else {
                    return `${startDateStr} ${startTimeStr} - ${endDateStr} ${endTimeStr}`;
                }
            }
        };
        
        let isCustomRangeSelected = true;
        const applyTimeRange = (start, end, isCustom = false) => {
            if (!this.inputConfig) return;
            this.inputConfig['$start'] = start;
            this.inputConfig['$end'] = end;
            isCustomRangeSelected = isCustom;
            const timeRangeDisplay = document.getElementById(this.getInstanceId('time-range-display'));
            if (timeRangeDisplay) {
                timeRangeDisplay.textContent = formatTimeRangeDisplay(start, end, isCustomRangeSelected);
            }
            const popup = document.getElementById(this.getInstanceId('time-range-popup'));
            if (popup) {
                popup.classList.remove('genie-dashboard-show');
            }
        };
        
        // Time range popup
        const timeRangeButton = document.getElementById(this.getInstanceId('toolbar-time-range'));
        const timeRangePopup = document.getElementById(this.getInstanceId('time-range-popup'));
        const quickIntervalBtns = document.querySelectorAll('.genie-quick-interval-btn');
        const startInput = document.getElementById(`${this.instanceId}-toolbar-start`);
        const endInput = document.getElementById(`${this.instanceId}-toolbar-end`);
        const applyButton = document.getElementById(this.getInstanceId('time-range-apply'));
        const cancelButton = document.getElementById(this.getInstanceId('time-range-cancel'));
        const refreshButton = document.getElementById(this.getInstanceId('toolbar-refresh'));
        
        if (timeRangeButton && timeRangePopup) {
            timeRangeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                timeRangePopup.classList.toggle('genie-dashboard-show');
                if (this.inputConfig && this.inputConfig['$start'] && this.inputConfig['$end']) {
                    if (startInput) startInput.value = formatDateForInput(this.inputConfig['$start']);
                    if (endInput) endInput.value = formatDateForInput(this.inputConfig['$end']);
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
                        const { start, end } = getTimeRangeFromMinutes(minutes);
                        applyTimeRange(start, end, false);
                        setTimeout(() => this.render(this.dashboardConfig, this.inputConfig), 100);
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
                        applyTimeRange(start, end, true);
                        setTimeout(() => this.render(this.dashboardConfig, this.inputConfig), 100);
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
        
        // Aggregation dropdown change handler - sync to panel settings if open
        const aggSelect = document.getElementById(this.getInstanceId('toolbar-agg'));
        if (aggSelect) {
            aggSelect.addEventListener('change', () => {
                // Update inputConfig
                if (this.inputConfig) {
                    this.inputConfig['$agg'] = aggSelect.value || '';
                }
                
                // Sync to any open panel settings
                const openSettingsPanels = document.querySelectorAll(`[id^="${this.instanceId}-panel-settings-"]`);
                openSettingsPanels.forEach(settingsPanel => {
                    const panelIdMatch = settingsPanel.id.match(new RegExp(`${this.instanceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-panel-settings-(\\d+)`));
                    if (panelIdMatch) {
                        const panelId = panelIdMatch[1];
                        const spanTypeSelect = document.getElementById(`${this.instanceId}-agg-span-type-${panelId}`);
                        if (spanTypeSelect) {
                            spanTypeSelect.value = aggSelect.value || '';
                        }
                    }
                });
            });
        }
        
        // Refresh button
        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                // Update inputJson from toolbar
                const intervalInput = document.getElementById(this.getInstanceId('toolbar-interval'));
                const aggSelect = document.getElementById(this.getInstanceId('toolbar-agg'));
                
                if (intervalInput && intervalInput.value) {
                    this.inputConfig['$interval'] = intervalInput.value.trim();
                }
                if (aggSelect && aggSelect.value) {
                    this.inputConfig['$agg'] = aggSelect.value;
                }
                
                // Refresh dashboard
                refreshButton.disabled = true;
                refreshButton.innerHTML = '<span>⏳</span>';
                refreshButton.title = 'Refreshing...';
                
                this.render(this.dashboardConfig, this.inputConfig).finally(() => {
                    refreshButton.disabled = false;
                    refreshButton.innerHTML = '<span>🔄</span>';
                    refreshButton.title = 'Refresh dashboard';
                });
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
        if (this.inputConfig && this.inputConfig['$start'] && this.inputConfig['$end']) {
            const timeRangeDisplay = document.getElementById(this.getInstanceId('time-range-display'));
            if (timeRangeDisplay) {
                timeRangeDisplay.textContent = formatTimeRangeDisplay(this.inputConfig['$start'], this.inputConfig['$end'], isCustomRangeSelected);
            }
        }
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
    deepMerge(target, source) {
        if (!source || typeof source !== 'object') {
            return target;
        }
        
        if (!target || typeof target !== 'object') {
            return source;
        }
        
        const result = Array.isArray(target) ? [...target] : { ...target };
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = this.deepMerge(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        
        return result;
    }
    
    /**
     * Convert external dashboard config to genieDashboard format
     * Extracts supported options from the input config and applies overrides
     * @param {Object} externalConfig - The external dashboard config to convert
     * @param {Object} overrides - Overrides to apply during conversion (from inputConfig.overrides)
     */
    convertDashboardConfig(externalConfig, overrides = null) {
        const converted = {
            panels: []
        };
        
        // Copy top-level properties if they exist
        if (externalConfig.title) converted.title = externalConfig.title;
        if (externalConfig.description) converted.description = externalConfig.description;
        if (externalConfig.tags) converted.tags = externalConfig.tags;
        if (externalConfig.timezone) converted.timezone = externalConfig.timezone;
        if (externalConfig.refresh) converted.refresh = externalConfig.refresh;
        if (externalConfig.schemaVersion) converted.schemaVersion = externalConfig.schemaVersion;
        if (externalConfig.version) converted.version = externalConfig.version;
        
        // Get panel overrides from the overrides object
        const panelOverrides = overrides && overrides.panels ? overrides.panels : null;
        
        // Convert panels
        if (externalConfig.panels && Array.isArray(externalConfig.panels)) {
            converted.panels = externalConfig.panels.map(panel => {
                const convertedPanel = {};
                
                // Basic panel properties
                if (panel.id !== undefined) convertedPanel.id = panel.id;
                if (panel.title !== undefined) convertedPanel.title = panel.title;
                if (panel.description !== undefined) convertedPanel.description = panel.description;
                if (panel.type !== undefined) convertedPanel.type = panel.type;
                if (panel.gridPos !== undefined) convertedPanel.gridPos = panel.gridPos;
                
                // Targets/queries
                if (panel.targets !== undefined) convertedPanel.targets = panel.targets;
                if (panel.datasource !== undefined) convertedPanel.datasource = panel.datasource;
                
                // Field config
                if (panel.fieldConfig !== undefined) {
                    convertedPanel.fieldConfig = {};
                    if (panel.fieldConfig.defaults !== undefined) {
                        convertedPanel.fieldConfig.defaults = panel.fieldConfig.defaults;
                    }
                    if (panel.fieldConfig.overrides !== undefined) {
                        convertedPanel.fieldConfig.overrides = panel.fieldConfig.overrides;
                    }
                }
                
                // Panel-specific options
                if (panel.options !== undefined) convertedPanel.options = panel.options;
                
                // Time series specific
                if (panel.timeSeries !== undefined) convertedPanel.timeSeries = panel.timeSeries;
                
                // Stats table specific
                if (panel.statsTable !== undefined) convertedPanel.statsTable = panel.statsTable;
                
                // Aggregation
                if (panel.aggregation !== undefined) convertedPanel.aggregation = panel.aggregation;
                
                // Transformations
                if (panel.transformations !== undefined) convertedPanel.transformations = panel.transformations;
                
                // Panel links
                if (panel.links !== undefined) convertedPanel.links = panel.links;
                
                // Thresholds
                if (panel.thresholds !== undefined) convertedPanel.thresholds = panel.thresholds;
                
                // Custom properties that might be useful
                if (panel.transparent !== undefined) convertedPanel.transparent = panel.transparent;
                if (panel.repeat !== undefined) convertedPanel.repeat = panel.repeat;
                if (panel.repeatDirection !== undefined) convertedPanel.repeatDirection = panel.repeatDirection;
                if (panel.maxDataPoints !== undefined) convertedPanel.maxDataPoints = panel.maxDataPoints;
                if (panel.interval !== undefined) convertedPanel.interval = panel.interval;
                
                // Apply overrides if provided
                if (panelOverrides) {
                    return this.deepMerge(convertedPanel, panelOverrides);
                }
                
                return convertedPanel;
            });
        }
        
        return converted;
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
        const modalTitle = document.createElement('h3');
        modalTitle.textContent = 'Upload Dashboard Config';
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
                
                // Close modal
                modalOverlay.style.display = 'none';
                
                // Disable submit button during refresh
                submitBtn.disabled = true;
                submitBtn.textContent = 'Refreshing...';
                
                // Render dashboard with new config
                this.render(configToUse, this.inputConfig).finally(() => {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit & Refresh';
                });
                
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
    async renderPanel(panel, index, gridContainer) {
        // Track total render time if performance option is enabled
        const showPerformance = panel.options?.performance === true;
        let renderStartTime = 0;
        if (showPerformance) {
            renderStartTime = performance.now();
        }
        
        const panelDiv = document.createElement('div');
        panelDiv.className = 'genie-dashboard-panel';
        
        // Set grid position
        const gridPos = panel.gridPos || { x: 0, y: 0, w: 12, h: 8 };
        panelDiv.style.gridColumn = `${gridPos.x + 1} / ${gridPos.x + gridPos.w + 1}`;
        // Set both row start and row end to span exactly gridPos.h rows
        panelDiv.style.gridRow = `${gridPos.y + 1} / ${gridPos.y + gridPos.h + 1}`;
        
        // Ensure panel doesn't have height constraints that would clip content
        // Remove any min-height to allow panels to shrink based on gridPos.h
        // Don't set height - let CSS grid determine it based on gridPos.h
        panelDiv.style.minHeight = '0';
        // Don't set height = '100%' as it can interfere with grid's height allocation
        // The grid will allocate height based on gridPos.h automatically
        // Use overflow: hidden to prevent content from forcing panel to grow beyond grid allocation
        panelDiv.style.overflow = 'hidden';
        // Set position: relative so absolutely positioned children (slider) are positioned relative to panel
        panelDiv.style.position = 'relative';
        
        // Add data attribute for panel type to allow CSS targeting
        const panelType = panel.type || 'timeseries';
        panelDiv.setAttribute('data-panel-type', panelType);
        
        // Create panel header
        const header = document.createElement('div');
        header.className = 'genie-dashboard-panel-header';
        
        const titleDiv = document.createElement('div');
        titleDiv.style.cssText = 'display: flex; align-items: center; gap: 8px; flex: 1;';
        
        const title = document.createElement('div');
        title.className = 'genie-dashboard-panel-title';
        title.textContent = panel.title || `Panel ${index + 1}`;
        
        // Add description as tooltip on title if description is provided
        if (panel.description) {
            title.setAttribute('title', panel.description);
        }
        
        // Create time range text element next to title
        const timeRangeText = document.createElement('span');
        timeRangeText.style.cssText = `
            font-size: 11px;
            color: #6b7280;
            margin-left: 8px;
            white-space: nowrap;
        `.replace(/\s+/g, ' ').trim();
        timeRangeText.textContent = ''; // Will be updated when data is loaded
        
        // Store reference on panel for later updates
        panel._timeRangeTextElement = timeRangeText;
        
        titleDiv.appendChild(title);
        titleDiv.appendChild(timeRangeText);
        
        // Create performance display element if performance option is enabled
        if (showPerformance) {
            const performanceText = document.createElement('span');
            performanceText.style.cssText = `
                font-size: 11px;
                color: #6b7280;
                margin-left: 8px;
                white-space: nowrap;
            `.replace(/\s+/g, ' ').trim();
            performanceText.textContent = ''; // Will be updated when data is loaded
            performanceText.className = 'genie-dashboard-panel-performance';
            
            // Store reference on panel for later updates
            panel._performanceTextElement = performanceText;
            
            titleDiv.appendChild(performanceText);
        }
        
        header.appendChild(titleDiv);
        panelDiv.appendChild(header);
        
        // Create panel content
        const content = document.createElement('div');
        content.className = 'genie-dashboard-panel-content';
        
        // Ensure panel-content container allows content to expand
        content.style.overflow = 'visible';
        content.style.position = 'relative';
        
        // Show loading state
        content.innerHTML = '<div class="genie-dashboard-panel-loading">Loading...</div>';
        panelDiv.appendChild(content);
        
        gridContainer.appendChild(panelDiv);
        
        try {
            // Check if there's a default compare option to fetch previous data in parallel
            // Get previous options from panel config or inputConfig
            const timeSeriesPreviousOptions = panel.timeSeries?.previous || panel.options?.timeSeries?.previous;
            const statsTablePreviousOptions = panel.statsTable?.previous || panel.options?.statsTable?.previous;
            const globalPreviousOptions = this.inputConfig?.previous;
            const previousOptionsStr = timeSeriesPreviousOptions || statsTablePreviousOptions || globalPreviousOptions;
            
            let defaultCompareOption = null;
            if (previousOptionsStr) {
                const previousOptions = previousOptionsStr.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
                const firstOption = previousOptions[0];
                if (firstOption && firstOption !== 'none') {
                    defaultCompareOption = firstOption;
                }
            }
            
            // Fetch current and previous data in parallel if default compare option exists
            let data, previousData = null;
            let failedTargets = [];
            let previousFailedTargets = [];
            
            if (defaultCompareOption) {
                console.log(`[renderPanel] Fetching current and previous (${defaultCompareOption}) data in parallel for panel:`, panel.title || panel.id);
                const previousOffset = this.parseDuration(defaultCompareOption);
                
                // Check if a fetch is already in progress to prevent duplicate requests
                if (panel._fetchInProgress) {
                    console.log(`[renderPanel] Fetch already in progress for panel, waiting...`);
                    await panel._fetchInProgress;
                }
                
                // Mark fetch as in progress
                const fetchPromise = Promise.all([
                    this.fetchPanelData(panel),
                    this.fetchPanelData(panel, previousOffset, defaultCompareOption)
                ]);
                panel._fetchInProgress = fetchPromise;
                
                // Fetch both in parallel
                const [currentResult, previousResult] = await fetchPromise;
                
                // Clear fetch in progress flag
                panel._fetchInProgress = null;
                
                data = currentResult.data || currentResult;
                failedTargets = currentResult.failedTargets || [];
                
                previousData = previousResult.data || previousResult;
                previousFailedTargets = previousResult.failedTargets || [];
                
                // Mark previous data items with isPrevious: true
                if (previousData && Array.isArray(previousData)) {
                    previousData = previousData.map(targetData => ({
                        ...targetData,
                        isPrevious: true
                    }));
                } else if (previousData && !Array.isArray(previousData)) {
                    previousData = [{
                        ...previousData,
                        isPrevious: true
                    }];
                }
                
                // Store previous data on panel for later use
                panel._previousDataArray = previousData;
                panel._previousDuration = defaultCompareOption;
                panel._compareSelectedOption = defaultCompareOption;
                
                console.log(`[renderPanel] Parallel fetch completed - current: ${data.length} targets, previous: ${previousData ? previousData.length : 0} targets`);
            } else {
                // No default compare option, just fetch current data
                const result = await this.fetchPanelData(panel);
                data = result.data || result;
                failedTargets = result.failedTargets || [];
            }
            
            // Pass header to renderPanelChart so tabs can be added to header for timeseries panels
            // If we have previous data, pass it to renderPanelChart
            this.renderPanelChart(panel, data, content, header, previousData);
            
            // Store failed targets on panel for retry functionality
            if (failedTargets.length > 0) {
                panel._failedTargets = failedTargets;
                this.showPanelError(panel, content, failedTargets);
            } else {
                // Clear any existing error message
                this.hidePanelError(panel, content);
            }
            
            // Calculate and store total render time, then update performance display
            if (showPerformance) {
                const renderEndTime = performance.now();
                const renderTime = renderEndTime - renderStartTime;
                panel._renderTime = renderTime;
                this.updatePerformanceDisplay(panel);
            }
        } catch (error) {
            console.error(`GenieDashboard: Error rendering panel ${index}:`, error);
            content.innerHTML = `<div class="genie-dashboard-panel-error">Error: ${error.message}</div>`;
            
            // Still update render time even on error
            if (showPerformance) {
                const renderEndTime = performance.now();
                const renderTime = renderEndTime - renderStartTime;
                panel._renderTime = renderTime;
                this.updatePerformanceDisplay(panel);
            }
        }
    }
    
    /**
     * Show error message at the bottom of panel with refresh icon
     */
    showPanelError(panel, content, failedTargets) {
        // Remove any existing error message
        this.hidePanelError(panel, content);
        
        // Create error message container
        const errorContainer = document.createElement('div');
        errorContainer.className = 'genie-dashboard-panel-error-container';
        errorContainer.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background-color: #fef2f2;
            border-top: 1px solid #fecaca;
            padding: 8px 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            z-index: 1000;
            font-size: 12px;
            color: #991b1b;
        `.replace(/\s+/g, ' ').trim();
        
        // Error message text
        const errorText = document.createElement('span');
        const failedCount = failedTargets.length;
        errorText.textContent = `${failedCount} quer${failedCount === 1 ? 'y' : 'ies'} failed to load`;
        errorText.style.flex = '1';
        
        // Refresh icon button
        const refreshButton = document.createElement('button');
        refreshButton.className = 'genie-dashboard-panel-refresh-button';
        refreshButton.innerHTML = '↻';
        refreshButton.style.cssText = `
            background: none;
            border: none;
            cursor: pointer;
            font-size: 16px;
            color: #991b1b;
            padding: 4px 8px;
            margin-left: 8px;
            border-radius: 4px;
            transition: background-color 0.2s;
        `.replace(/\s+/g, ' ').trim();
        refreshButton.title = 'Retry failed queries';
        
        // Hover effect
        refreshButton.addEventListener('mouseenter', () => {
            refreshButton.style.backgroundColor = '#fee2e2';
        });
        refreshButton.addEventListener('mouseleave', () => {
            refreshButton.style.backgroundColor = 'transparent';
        });
        
        // Click handler to retry failed queries
        const self = this; // Store reference to ensure context is preserved
        refreshButton.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('[Retry] Refresh button clicked, failed targets:', panel._failedTargets);
            
            // Hide error message and show loading
            self.hidePanelError(panel, content);
            self.showPanelRetryLoading(panel, content);
            
            refreshButton.disabled = true;
            refreshButton.innerHTML = '⟳';
            refreshButton.style.opacity = '0.6';
            
            try {
                console.log('[Retry] Starting retry for panel:', panel.id);
                await self.retryFailedQueries(panel, content);
                console.log('[Retry] Retry completed');
            } catch (error) {
                console.error('[Retry] Error retrying failed queries:', error);
                console.error('[Retry] Error stack:', error.stack);
                // Hide loading and show error message
                self.hidePanelError(panel, content);
                if (panel._failedTargets && panel._failedTargets.length > 0) {
                    self.showPanelError(panel, content, panel._failedTargets);
                }
                // Show error message to user
                self.showErrorMessage(`Failed to retry queries: ${error.message}`, 'error');
            } finally {
                refreshButton.disabled = false;
                refreshButton.innerHTML = '↻';
                refreshButton.style.opacity = '1';
            }
        });
        
        errorContainer.appendChild(errorText);
        errorContainer.appendChild(refreshButton);
        content.appendChild(errorContainer);
        
        // Store reference for cleanup
        panel._errorContainer = errorContainer;
    }
    
    /**
     * Hide error message from panel
     */
    hidePanelError(panel, content) {
        if (panel._errorContainer && panel._errorContainer.parentNode) {
            panel._errorContainer.remove();
            panel._errorContainer = null;
        }
        // Also remove by class in case reference is lost
        const existingError = content.querySelector('.genie-dashboard-panel-error-container');
        if (existingError) {
            existingError.remove();
        }
        // Also remove loading message if present
        if (panel._loadingContainer && panel._loadingContainer.parentNode) {
            panel._loadingContainer.remove();
            panel._loadingContainer = null;
        }
        const existingLoading = content.querySelector('.genie-dashboard-panel-retry-loading');
        if (existingLoading) {
            existingLoading.remove();
        }
    }
    
    /**
     * Show loading message at the bottom of panel during retry
     */
    showPanelRetryLoading(panel, content) {
        // Remove any existing error or loading message
        this.hidePanelError(panel, content);
        
        // Create loading message container
        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'genie-dashboard-panel-retry-loading';
        loadingContainer.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background-color: #eff6ff;
            border-top: 1px solid #bfdbfe;
            padding: 8px 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            font-size: 12px;
            color: #1e40af;
        `.replace(/\s+/g, ' ').trim();
        
        // Loading text with spinner
        const loadingText = document.createElement('span');
        loadingText.innerHTML = '⟳ Retrying failed queries...';
        loadingText.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        
        // Add spinning animation to the refresh icon
        const spinner = document.createElement('span');
        spinner.innerHTML = '⟳';
        spinner.style.cssText = `
            display: inline-block;
            animation: spin 1s linear infinite;
        `.replace(/\s+/g, ' ').trim();
        
        // Add CSS animation if not already added
        if (!document.getElementById(this.getInstanceId('retry-spinner-style'))) {
            const style = document.createElement('style');
            style.id = this.getInstanceId('retry-spinner-style');
            style.textContent = `
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        loadingText.innerHTML = '';
        loadingText.appendChild(spinner);
        loadingText.appendChild(document.createTextNode(' Retrying failed queries...'));
        
        loadingContainer.appendChild(loadingText);
        content.appendChild(loadingContainer);
        
        // Store reference for cleanup
        panel._loadingContainer = loadingContainer;
    }
    
    /**
     * Retry only failed queries for a panel
     */
    async retryFailedQueries(panel, content) {
        console.log('[Retry] retryFailedQueries called for panel:', panel.id);
        console.log('[Retry] Failed targets:', panel._failedTargets);
        
        if (!panel._failedTargets || panel._failedTargets.length === 0) {
            console.warn('[Retry] No failed targets to retry');
            return;
        }
        
        // Separate current and previous failed targets
        const currentFailedTargets = panel._failedTargets.filter(ft => !ft.isPrevious);
        const previousFailedTargets = panel._failedTargets.filter(ft => ft.isPrevious);
        
        console.log('[Retry] Current failed targets:', currentFailedTargets.length);
        console.log('[Retry] Previous failed targets:', previousFailedTargets.length);
        
        try {
            let allNewData = [];
            let allStillFailed = [];
            
            // Retry current failed targets
            if (currentFailedTargets.length > 0) {
                const currentTargetsOnly = currentFailedTargets.map(ft => ft.target);
                console.log('[Retry] Retrying current targets:', currentTargetsOnly.map(t => t.refId || 'unknown'));
                const currentResult = await this.fetchPanelData(panel, 0, null, currentTargetsOnly);
                const currentNewData = currentResult.data || [];
                const currentStillFailed = (currentResult.failedTargets || []).map(ft => ({
                    ...ft,
                    isPrevious: false
                }));
                allNewData.push(...currentNewData);
                allStillFailed.push(...currentStillFailed);
                console.log('[Retry] Current retry - New data:', currentNewData.length, 'Still failed:', currentStillFailed.length);
            }
            
            // Retry previous failed targets (group by previousDuration)
            const previousByDuration = {};
            previousFailedTargets.forEach(ft => {
                const duration = ft.previousDuration || '-1d';
                if (!previousByDuration[duration]) {
                    previousByDuration[duration] = [];
                }
                previousByDuration[duration].push(ft);
            });
            
            for (const [duration, targets] of Object.entries(previousByDuration)) {
                const previousTargetsOnly = targets.map(ft => ft.target);
                const previousOffset = this.parseDuration(duration);
                console.log('[Retry] Retrying previous targets for duration:', duration, 'offset:', previousOffset);
                const previousResult = await this.fetchPanelData(panel, previousOffset, duration, previousTargetsOnly);
                const previousNewData = previousResult.data || [];
                const previousStillFailed = (previousResult.failedTargets || []).map(ft => ({
                    ...ft,
                    isPrevious: true,
                    previousDuration: duration
                }));
                allNewData.push(...previousNewData);
                allStillFailed.push(...previousStillFailed);
                console.log('[Retry] Previous retry - New data:', previousNewData.length, 'Still failed:', previousStillFailed.length);
            }
            
            console.log('[Retry] Total new successful data:', allNewData.length, 'items');
            console.log('[Retry] Total still failed:', allStillFailed.length, 'targets');
            
            // Get existing successful data from the panel
            // We need to re-fetch all data to get the complete picture (existing successful + newly successful)
            // This ensures we have all successful data in one place
            const panelElement = content.closest('.genie-dashboard-panel');
            
            if (allNewData.length > 0 || allStillFailed.length < panel._failedTargets.length) {
                // Some queries succeeded, re-fetch all data to get complete picture
                console.log('[Retry] Some queries succeeded, re-fetching all data...');
                const fullResult = await this.fetchPanelData(panel);
                let allData = fullResult.data || fullResult;
                let allFailed = fullResult.failedTargets || [];
                
                // Also re-fetch previous data if compare is active
                const compareDuration = panel._compareSelectedOption;
                let previousData = null;
                if (compareDuration && compareDuration !== 'none') {
                    console.log('[Retry] Compare is active, re-fetching previous data for:', compareDuration);
                    const previousOffset = this.parseDuration(compareDuration);
                    const previousResult = await this.fetchPanelData(panel, previousOffset, compareDuration);
                    previousData = previousResult.data || previousResult;
                    const previousFailed = previousResult.failedTargets || [];
                    
                    // Mark previous failures and merge with current failures
                    const markedPreviousFailures = previousFailed.map(ft => ({
                        ...ft,
                        isPrevious: true,
                        previousDuration: compareDuration
                    }));
                    
                    // Merge failed targets, avoiding duplicates
                    const existingRefIds = new Set(allFailed.map(ft => {
                        const target = ft.target || ft;
                        return `${target.refId || 'unknown'}_${ft.isPrevious ? 'prev' : 'curr'}`;
                    }));
                    
                    const newPreviousFailures = markedPreviousFailures.filter(ft => {
                        const target = ft.target || ft;
                        const key = `${target.refId || 'unknown'}_prev`;
                        return !existingRefIds.has(key);
                    });
                    
                    allFailed = [...allFailed, ...newPreviousFailures];
                    console.log('[Retry] Previous data fetched:', previousData.length, 'items');
                    console.log('[Retry] Previous failed:', previousFailed.length, 'targets');
                }
                
                console.log('[Retry] All data fetched:', allData.length, 'items');
                console.log('[Retry] All failed:', allFailed.length, 'targets');
                
                // Re-render the chart with updated data
                const header = panelElement?.querySelector('.genie-dashboard-panel-header');
                console.log('[Retry] Re-rendering chart...');
                
                // For timeseries charts, we need to pass both current and previous data
                // Check if this is a timeseries chart and if we have previous data
                const panelType = panel.type || 'timeseries';
                if ((panelType === 'timeseries' || panelType === 'graph') && previousData) {
                    // We need to call renderChartWithData with both current and previous data
                    // But we need to find the renderChartWithData function - it's nested in renderTimeSeriesChart
                    // For now, let's just pass allData and let the chart handle it
                    // Actually, we should merge current and previous data for the chart
                    allData = [...allData, ...previousData];
                }
                
                // Store whether we need to show error after rendering
                const shouldShowError = allFailed.length > 0;
                
                this.renderPanelChart(panel, allData, content, header);
                console.log('[Retry] Chart re-rendered');
                
                // Update failed targets list and re-add error message if needed
                // (error message was removed when container.innerHTML was cleared)
                // Also remove loading message
                this.hidePanelError(panel, content);
                
                if (shouldShowError) {
                    console.log('[Retry] Some queries still failed, updating error message');
                    panel._failedTargets = allFailed;
                    // Use setTimeout to ensure chart is fully rendered before adding error
                    setTimeout(() => {
                        this.showPanelError(panel, content, allFailed);
                    }, 100);
                } else {
                    // All queries succeeded, remove error message
                    console.log('[Retry] All queries succeeded, removing error message');
                    panel._failedTargets = [];
                    // Loading already removed by hidePanelError above
                }
            } else {
                // No new successes, just update the error message with still-failed targets
                console.log('[Retry] No new successes, updating error message');
                // Remove loading message
                this.hidePanelError(panel, content);
                
                if (allStillFailed.length > 0) {
                    panel._failedTargets = allStillFailed;
                    // Re-add error message (it might have been removed)
                    setTimeout(() => {
                        this.showPanelError(panel, content, allStillFailed);
                    }, 100);
                } else {
                    // All queries succeeded (unlikely but possible)
                    panel._failedTargets = [];
                    // Loading already removed by hidePanelError above
                }
            }
        } catch (error) {
            console.error('[Retry] Error retrying failed queries:', error);
            console.error('[Retry] Error stack:', error.stack);
            // Show error message
            this.showErrorMessage(`Failed to retry queries: ${error.message}`, 'error');
            throw error; // Re-throw so caller can handle it
        }
    }
    
    /**
     * Fetch data for a panel by processing its targets/queries
     * @param {Object} panel - Panel configuration
     * @param {number} previousOffset - Offset in milliseconds for previous period (0 for current)
     * @param {string} previousDuration - Duration string like "-7d" for previous period (null/undefined for current)
     */
    async fetchPanelData(panel, previousOffset = 0, previousDuration = null, failedTargetsOnly = null) {
        const targets = panel.targets || [];
        const allData = [];
        const failedTargets = [];
        
        // Track query execution time if performance option is enabled
        const showPerformance = panel.options?.performance === true;
        // Initialize or accumulate query time (for retries, we accumulate; for initial render, start fresh)
        let totalQueryTime = 0;
        if (showPerformance && failedTargetsOnly) {
            // Retry case: accumulate query time from previous successful queries
            totalQueryTime = panel._totalQueryTime || 0;
        }
        
        // If failedTargetsOnly is provided, only retry those targets
        const targetsToFetch = failedTargetsOnly || targets;
        
        // Calculate actual start and end timestamps (after applying previousOffset)
        let startTimestamp = null;
        let endTimestamp = null;
        if (this.inputConfig) {
            startTimestamp = this.inputConfig.$start;
            endTimestamp = this.inputConfig.$end;
            if (previousOffset > 0 && startTimestamp && endTimestamp) {
                startTimestamp = startTimestamp - previousOffset;
                endTimestamp = endTimestamp - previousOffset;
            }
        }
        
        // Execute all queries in parallel using Promise.all()
        console.log(`[fetchPanelData] Starting ${targetsToFetch.length} queries in parallel for panel:`, panel.title || panel.id);
        const queryStartTime = performance.now();
        
        const queryPromises = targetsToFetch.map(async (target, index) => {
            const refId = target.refId || 'A';
            const queryStart = performance.now();
            console.log(`[fetchPanelData] Query ${index + 1}/${targetsToFetch.length} (refId: ${refId}) STARTED at ${queryStart.toFixed(2)}ms`);
            
            try {
                const query = target.rawSql || target.expr || target.query || '';
                const processedQuery = this.processQuery(query, previousOffset);
                const endpoint = this.getEndpointForTarget(target);
                
                if (!endpoint) {
                    console.warn(`GenieDashboard: No endpoint found for target:`, target);
                    return {
                        success: false,
                        target: target,
                        error: new Error('No endpoint found for target')
                    };
                }
                
                // Get datasource from target or dashboard config
                const datasource = target.datasource || this.dashboardConfig.datasource;
                const dsType = typeof datasource === 'string' ? datasource : (datasource ? datasource.type : null);
                
                const response = await this.fetchData(endpoint, processedQuery, startTimestamp, endTimestamp, refId, previousDuration, dsType);
                
                const queryEnd = performance.now();
                const queryDuration = queryEnd - queryStart;
                console.log(`[fetchPanelData] Query ${index + 1}/${targetsToFetch.length} (refId: ${refId}) COMPLETED at ${queryEnd.toFixed(2)}ms (duration: ${queryDuration.toFixed(2)}ms)`);
                
                // Track query execution time for successful queries
                let queryTime = 0;
                if (showPerformance) {
                    queryTime = queryDuration;
                }
                
                return {
                    success: true,
                    refId: refId,
                    data: response,
                    target: target,
                    queryTime: queryTime
                };
            } catch (error) {
                console.error(`GenieDashboard: Error fetching data for target ${target.refId}:`, error);
                return {
                    success: false,
                    target: target,
                    error: error
                };
            }
        });
        
        // Wait for all queries to complete (in parallel)
        const results = await Promise.all(queryPromises);
        const queryEndTime = performance.now();
        console.log(`[fetchPanelData] All ${targetsToFetch.length} queries completed. Total time: ${(queryEndTime - queryStartTime).toFixed(2)}ms`);
        
        // Process results and separate successful queries from failures
        results.forEach(result => {
            if (result.success) {
                allData.push({
                    refId: result.refId,
                    data: result.data,
                    target: result.target
                });
                if (showPerformance) {
                    totalQueryTime += result.queryTime;
                }
            } else {
                failedTargets.push({
                    target: result.target,
                    error: result.error
                });
            }
        });
        
        // Store total query time on panel for performance display
        if (showPerformance) {
            panel._totalQueryTime = totalQueryTime;
        }
        
        // Return both successful data and failed targets
        return {
            data: allData,
            failedTargets: failedTargets
        };
    }
    
    /**
     * Parse duration string (e.g., "7d", "30d", "1w") to milliseconds
     */
    parseDuration(durationStr) {
        if (!durationStr || typeof durationStr !== 'string') return 0;
        
        // Trim whitespace and remove leading "-" if present
        const cleaned = durationStr.trim().replace(/^-/, '');
        
        // Support both 'm' (minutes) and 'M' or 'mo' (months)
        // Pattern: (\d+)([dwmh]|M|mo) - allows 'm' for minutes, 'M' or 'mo' for months
        const match = cleaned.match(/^(\d+)([dwmh]|M|mo)$/i);
        if (!match) {
            console.warn('parseDuration: Invalid duration format:', durationStr);
            return 0;
        }
        
        const value = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        
        let result = 0;
        switch (unit) {
            case 'h': result = value * 60 * 60 * 1000; break; // hours
            case 'd': result = value * 24 * 60 * 60 * 1000; break; // days
            case 'w': result = value * 7 * 24 * 60 * 60 * 1000; break; // weeks
            case 'm': result = value * 60 * 1000; break; // minutes (for span aggregation like "5m")
            case 'mo': result = value * 30 * 24 * 60 * 60 * 1000; break; // months (approximate)
            default: return 0;
        }
        
        console.log('parseDuration:', durationStr, '->', result, 'ms (', value, unit, ')');
        return result;
    }
    
    /**
     * Process query string by replacing placeholders
     */
    processQuery(query, previousOffset = 0) {
        if (!query || typeof query !== 'string') {
            return query || '';
        }
        
        let processed = query;
        
        // Create a copy of inputConfig with adjusted times if previousOffset is provided
        const config = this.inputConfig ? { ...this.inputConfig } : {};
        if (previousOffset > 0 && config.$start && config.$end) {
            config.$start = config.$start - previousOffset;
            config.$end = config.$end - previousOffset;
        }
        
        // Replace $variables from config
        // Process in order: longer variable names first to avoid partial replacements
        // (e.g., $substrate should be replaced before $sub if both exist)
        const sortedKeys = Object.keys(config)
            .filter(key => key.startsWith('$'))
            .sort((a, b) => b.length - a.length); // Sort by length descending
        
        for (const key of sortedKeys) {
            const value = config[key];
            if (value !== undefined && value !== null) {
                // Convert value to string for replacement
                // For timestamps (numbers), keep as number in string form
                const stringValue = String(value);
                
                // Escape special regex characters in the key
                // Since key starts with $, we need to escape $ and other special chars
                // The replace function escapes all special regex chars including $
                const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                
                // Create regex that matches the variable name exactly
                // Need to match: $variable followed by non-word character (:, }, #, -, etc.) or end of string
                // Use negative lookahead to ensure we don't match partial variable names
                // Match $variable not followed by alphanumeric, underscore, or $
                const regex = new RegExp(escapedKey + '(?![a-zA-Z0-9_$])', 'g');
                processed = processed.replace(regex, stringValue);
            }
        }
        
        // Replace QEURY placeholder (URL encoded query)
        if (processed.includes('QEURY')) {
            // Will be replaced when constructing the final URL
        }
        
        // Debug logging to verify replacements
        if (processed !== query) {
            console.log('processQuery - Original:', query);
            console.log('processQuery - Processed:', processed);
            console.log('processQuery - Variables replaced:', sortedKeys.filter(k => query.includes(k)));
        } else if (query && query.includes('$')) {
            console.warn('processQuery - No replacements made for query containing $:', query);
            console.warn('processQuery - Available config keys:', Object.keys(config).filter(k => k.startsWith('$')));
        }
        
        return processed;
    }
    
    /**
     * Get endpoint URL for a target based on datasource type
     */
    getEndpointForTarget(target) {
        const datasource = target.datasource || this.dashboardConfig.datasource;
        const dsType = typeof datasource === 'string' ? datasource : datasource.type;
        
        // Get endpoint from inputConfig based on datasource type
        const endpoint = this.inputConfig[dsType];
        
        if (!endpoint) {
            return null;
        }
        
        return endpoint;
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
    async fetchData(endpoint, query, startTimestamp = null, endTimestamp = null, refId = null, previousDuration = null, datasource = null) {
        // Replace QEURY placeholder with URL-encoded query
        const encodedQuery = encodeURIComponent(query);
        let url = endpoint.replace('QEURY', encodedQuery);
        
        // Always add refId, startTimestamp, endTimestamp, previous duration, and datasource as URL parameters
        // This helps with mocking UI requests when REST endpoint is not ready
        const params = new URLSearchParams();
        
        if (refId !== null && refId !== undefined) {
            params.append('refId', refId);
        }
        
        if (startTimestamp !== null && startTimestamp !== undefined) {
            params.append('startTimestamp', String(startTimestamp));
        }
        
        if (endTimestamp !== null && endTimestamp !== undefined) {
            params.append('endTimestamp', String(endTimestamp));
        }
        
        // Add previous duration parameter if this is a previous period request
        // Example: previous=-7d indicates this is a request for data from 7 days ago
        if (previousDuration !== null && previousDuration !== undefined) {
            params.append('previous', previousDuration);
        }
        
        // Add datasource parameter if provided
        if (datasource !== null && datasource !== undefined) {
            params.append('datasource', String(datasource));
        }
        
        // Append parameters to URL
        if (params.toString()) {
            // Check if URL already has query parameters
            const separator = url.includes('?') ? '&' : '?';
            url = url + separator + params.toString();
        }
        
        // Check cache first
        const cacheKey = url;
        if (this.dataCache[cacheKey]) {
            return this.dataCache[cacheKey];
        }
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                // Don't cache failed responses - clear any existing cache for this key
                if (this.dataCache[cacheKey]) {
                    delete this.dataCache[cacheKey];
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Only cache successful responses
            this.dataCache[cacheKey] = data;
            
            return data;
        } catch (error) {
            console.error('GenieDashboard: Fetch error:', error);
            // Ensure failed requests are not cached - clear cache for this key if it exists
            if (this.dataCache[cacheKey]) {
                delete this.dataCache[cacheKey];
            }
            throw error;
        }
    }
    
    /**
     * Render chart based on panel type
     */
    renderPanelChart(panel, dataArray, container, header = null, initialPreviousData = null) {
        // Track data processing time if performance option is enabled
        const showPerformance = panel.options?.performance === true;
        let processingStartTime = 0;
        if (showPerformance) {
            processingStartTime = performance.now();
        }
        
        const panelType = panel.type || 'timeseries';
        
        switch (panelType) {
            case 'timeseries':
            case 'graph': // Support Grafana's "graph" type (legacy, same as timeseries)
                this.renderTimeSeriesChart(panel, dataArray, container, header);
                break;
            case 'stat':
            case 'singlestat':
                this.renderStatChart(panel, dataArray, container);
                break;
            case 'table':
                this.renderTableChart(panel, dataArray, container);
                break;
            case 'gauge':
                this.renderGaugeChart(panel, dataArray, container);
                break;
            case 'bargauge':
                this.renderBarGaugeChart(panel, dataArray, container);
                break;
            default:
                this.renderTimeSeriesChart(panel, dataArray, container, header); // Default to timeseries
        }
        
        // Calculate and store processing time, then update performance display
        if (showPerformance) {
            const processingEndTime = performance.now();
            const processingTime = processingEndTime - processingStartTime;
            panel._processingTime = processingTime;
            this.updatePerformanceDisplay(panel);
        }
    }
    
    /**
     * Update performance display in panel header
     */
    updatePerformanceDisplay(panel) {
        if (!panel._performanceTextElement) {
            return;
        }
        
        const queryTime = panel._totalQueryTime || 0;
        const runtime = panel._processingTime || 0;
        const renderTime = panel._renderTime || 0;
        
        // Format times in milliseconds
        const queryTimeMs = Math.round(queryTime);
        const runtimeMs = Math.round(runtime);
        const renderTimeMs = Math.round(renderTime);
        
        // Update display: "query:20ms runtime:50ms render:50ms"
        panel._performanceTextElement.textContent = `query:${queryTimeMs}ms runtime:${runtimeMs}ms render:${renderTimeMs}ms`;
    }
    
    /**
     * Render timeseries chart with tabs
     */
    renderTimeSeriesChart(panel, dataArray, container, header = null) {
        container.innerHTML = '';
        
        // Get stats configuration (from panel options, panel.stats, or input JSON)
        // Only use default ['sum'] if stats are explicitly configured in inputConfig
        const defaultStats = this.inputConfig?.stats || [];
        const panelStats = panel.stats || panel.options?.stats || defaultStats;
        
        // Check if tabs should be shown
        const showTabs = panel.tabs !== false && panel.options?.tabs !== false;
        
        // Check for default tab option (only relevant if tabs are shown)
        const defaultTab = panel.tab || panel.options?.tab || 'chart'; // Default to 'chart'
        const showStatsTabByDefault = showTabs && (defaultTab === 'Statistics' || defaultTab === 'statistics' || defaultTab === 'stats');
        
        // Get percentBase and percentTargets config for percentage view toggle
        const percentBase = panel.statsTable?.percentBase || panel.options?.statsTable?.percentBase || null;
        const percentTargets = panel.statsTable?.percentTargets || panel.options?.statsTable?.percentTargets || null;
        const hasPercentConfig = percentBase && percentTargets && Array.isArray(percentTargets) && percentTargets.length > 0;
        
        // Initialize percentage view state - enabled by default if config exists
        // Only initialize if not already set (undefined), not if it's false (user disabled it)
        if (panel._percentViewEnabled === undefined && hasPercentConfig) {
            panel._percentViewEnabled = true; // Default to enabled when config exists
        }
        
        // Get aggregation config from panel options
        // Check panel.aggregation first (preferred), then panel.timeSeries.aggregation (backward compatibility)
        const aggregationConfig = panel.aggregation || 
                                  panel.options?.aggregation ||
                                  panel.timeSeries?.aggregation || 
                                  panel.options?.timeSeries?.aggregation || 
                                  null;
        const aggregationTag = aggregationConfig?.tag || null;
        const aggregationType = aggregationConfig?.type || null; // 'sum' or 'avg'
        // Use panel-specific span aggregation, or fall back to dashboard toolbar defaults
        const spanAggregation = aggregationConfig?.span || this.inputConfig['$interval'] || null; // e.g., '5m', '1h'
        const spanAggregationType = aggregationConfig?.spanAggregation || this.inputConfig['$agg'] || null; // 'sum', 'avg', 'max', or 'min' for span aggregation
        
        // Initialize aggregation state
        // If config specifies a default aggregation type, enable it automatically
        if (panel._aggregationEnabled === undefined && aggregationConfig) {
            if (aggregationType) {
                // Config specifies a default aggregation type, enable it automatically
                panel._aggregationEnabled = true;
                panel._aggregationType = aggregationType;
            } else {
                // No default type specified, default to disabled (user clicks to enable)
                panel._aggregationEnabled = false;
                panel._aggregationType = null;
            }
        }
        
        // Helper function to create separator (used by both tabs and compare dropdown)
        const createSeparator = () => {
            const separator = document.createElement('div');
            separator.style.cssText = 'width: 1px; height: 20px; background-color: #d1d5db; margin: 0 4px;';
            separator.setAttribute('aria-hidden', 'true');
            return separator;
        };
        
        // Create tabs container (only if tabs are enabled)
        let tabsContainer = null;
        let chartTab = null;
        let statsTab = null;
        let percentIconButton = null;
        let sumIconButton = null;
        let avgIconButton = null;
        
        if (showTabs) {
            // Check if tabsContainer already exists in header and remove it to prevent duplicates
            if (header) {
                const existingTabsContainer = header.querySelector('.genie-dashboard-tabs');
                if (existingTabsContainer) {
                    existingTabsContainer.remove();
                }
                // Also check in headerControlsContainer if it exists
                const headerControlsContainer = header.querySelector('.genie-dashboard-header-controls');
                if (headerControlsContainer) {
                    const existingTabsInControls = headerControlsContainer.querySelector('.genie-dashboard-tabs');
                    if (existingTabsInControls) {
                        existingTabsInControls.remove();
                    }
                }
            }
            
            tabsContainer = document.createElement('div');
            tabsContainer.className = 'genie-dashboard-tabs';
            
            // Create percent icon button before chart icon if percentBase config exists
            // The icon will be shown/hidden based on metric existence check in renderStatsTable
            if (hasPercentConfig) {
                percentIconButton = document.createElement('button');
                percentIconButton.type = 'button'; // Prevent form submission
                percentIconButton.className = 'genie-dashboard-tab';
                percentIconButton.setAttribute('data-icon', 'percent'); // Add attribute for CSS targeting
                percentIconButton.innerHTML = '<span class="genie-dashboard-tab-icon">%</span>';
                percentIconButton.title = panel._percentViewEnabled ? 'Hide percentages' : 'Show percentages';
                percentIconButton.setAttribute('aria-label', 'Toggle percentage view');
                percentIconButton.style.display = 'none'; // Hidden by default, shown when stats tab is active and metric exists
                
                // Set initial style based on enabled state
                if (panel._percentViewEnabled) {
                    percentIconButton.style.background = 'rgba(59, 130, 246, 0.1)';
                    percentIconButton.style.border = 'none';
                    percentIconButton.style.color = '#3b82f6';
                    percentIconButton.style.fontWeight = '500';
                } else {
                    percentIconButton.style.background = 'transparent';
                    percentIconButton.style.border = 'none';
                    percentIconButton.style.color = '#6b7280';
                    percentIconButton.style.fontWeight = '500';
                }
                
                percentIconButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Toggle percentage view
                    panel._percentViewEnabled = !panel._percentViewEnabled;
                    // Update button style
                    if (panel._percentViewEnabled) {
                        percentIconButton.style.background = 'rgba(59, 130, 246, 0.1)';
                        percentIconButton.style.border = 'none';
                        percentIconButton.style.color = '#3b82f6';
                        percentIconButton.style.fontWeight = '500';
                        percentIconButton.title = 'Hide percentages';
                    } else {
                        percentIconButton.style.background = 'transparent';
                        percentIconButton.style.border = 'none';
                        percentIconButton.style.color = '#6b7280';
                        percentIconButton.style.fontWeight = '500';
                        percentIconButton.title = 'Show percentages';
                    }
                    // Re-render the stats table
                    const statsContent = container.querySelector(`#${this.instanceId}-stats-tab-${panel.id}`);
                    if (statsContent) {
                        const compareDropdown = container.closest('.genie-dashboard-panel')?.querySelector('.genie-dashboard-compare-dropdown');
                        const previousDuration = compareDropdown && compareDropdown.value !== 'none' ? compareDropdown.value : null;
                        const isTransposed = panel.statsTable?.transpose || panel.options?.statsTable?.transpose || panel.transpose || false;
                        this.renderStatsTable(panel, currentDataArray, statsContent, panelStats, previousDataArray, isTransposed, previousDuration);
                    }
                });
                
                // Store percentIconButton for later grouping (will be added after statsTab)
            }
            
            // Create statistics icon button with dropdown menu for statistics options
            // This replaces the aggregation icon button and shows statistics options from panel.stats
            // Only show if at least one stat is configured
            const statsOptions = ['sum', 'avg', 'max', 'min', 'p50', 'p90', 'p95', 'p99'];
            const currentStats = Array.isArray(panelStats) ? panelStats : [];
            // Check if stats are configured: show icon if currentStats has at least one item
            // This means stats are configured either in panel.stats, panel.options.stats, or inputConfig.stats
            // If stats are showing in the table, they're configured, so show the icon
            const hasStatsConfig = currentStats.length > 0;
            console.log('[Statistics Icon] Panel ID:', panel.id, 'hasStatsConfig:', hasStatsConfig, 'currentStats:', currentStats, 'panelStats:', panelStats, 'panel.stats:', panel.stats, 'panel.options?.stats:', panel.options?.stats, 'inputConfig.stats:', this.inputConfig?.stats);
            
            let statisticsContainer = null;
            if (hasStatsConfig) {
                // Create container for statistics button and dropdown menu
                statisticsContainer = document.createElement('div');
                statisticsContainer.style.cssText = 'position: relative; display: inline-block;';
                
                // Statistics icon button
                const statisticsIconButton = document.createElement('button');
                statisticsIconButton.type = 'button';
                statisticsIconButton.className = 'genie-dashboard-tab';
                statisticsIconButton.setAttribute('data-icon', 'statistics');
                
                // Update button display based on current statistics
                const updateStatisticsButtonDisplay = () => {
                    // Get current stats from panel.stats
                    const panelCurrentStats = Array.isArray(panel.stats) ? panel.stats : (Array.isArray(panelStats) ? panelStats : []);
                    if (panelCurrentStats.length > 0) {
                        const statsCount = panelCurrentStats.length;
                        statisticsIconButton.innerHTML = `<span class="genie-dashboard-tab-icon">∑</span>`;
                        statisticsIconButton.title = `Statistics (${statsCount} selected)`;
                        statisticsIconButton.style.background = 'rgba(59, 130, 246, 0.1)';
                        statisticsIconButton.style.color = '#3b82f6';
                        statisticsIconButton.style.fontWeight = '500';
                    } else {
                        statisticsIconButton.innerHTML = '<span class="genie-dashboard-tab-icon">∑</span>';
                        statisticsIconButton.title = 'Statistics options';
                        statisticsIconButton.style.background = 'transparent';
                        statisticsIconButton.style.color = '#6b7280';
                        statisticsIconButton.style.fontWeight = '500';
                    }
                };
                
                updateStatisticsButtonDisplay();
                statisticsIconButton.setAttribute('aria-label', 'Statistics options');
                statisticsIconButton.style.display = 'flex';
                
                // Create dropdown menu with checkboxes
                const statisticsMenu = document.createElement('div');
                statisticsMenu.className = 'genie-dashboard-statistics-menu';
                // Use higher z-index to appear above unit-note (z-index: 10) and other panel elements
                // Also ensure it's positioned relative to the container, not the panel
                statisticsMenu.style.cssText = 'display: none; position: fixed; background: white; border: 1px solid #d1d5db; border-radius: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); z-index: 10000; min-width: 140px; padding: 4px; max-height: 300px; overflow-y: auto;';
                
                statsOptions.forEach(stat => {
                    const menuItem = document.createElement('label');
                    menuItem.className = 'genie-dashboard-statistics-menu-item';
                    menuItem.style.cssText = 'padding: 6px 10px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #1f2937; margin: 0;';
                    const isChecked = currentStats.includes(stat);
                    menuItem.innerHTML = `
                        <input type="checkbox" value="${stat}" ${isChecked ? 'checked' : ''} style="margin-right: 4px; width: 14px; height: 14px; cursor: pointer;" class="statistics-checkbox-${panel.id}">
                        <span style="font-size: 12px;">${stat.toUpperCase()}</span>
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
                        
                        // Update current stats array
                        const checkedBoxes = Array.from(statisticsMenu.querySelectorAll(`.statistics-checkbox-${panel.id}:checked`));
                        const selectedStats = checkedBoxes.map(cb => cb.value);
                        
                        // Update panel.stats
                        panel.stats = selectedStats.length > 0 ? selectedStats : undefined;
                        
                        // Sync to settings panel Statistics checkboxes if open
                        const settingsStatsCheckboxes = document.querySelectorAll(`.stats-checkbox-${panel.id}`);
                        settingsStatsCheckboxes.forEach(cb => {
                            cb.checked = selectedStats.includes(cb.value);
                        });
                        
                        // Update button display (need to update currentStats reference)
                        const panelCurrentStats = Array.isArray(panel.stats) ? panel.stats : [];
                        if (panelCurrentStats.length > 0) {
                            const statsCount = panelCurrentStats.length;
                            statisticsIconButton.innerHTML = `<span class="genie-dashboard-tab-icon">∑</span>`;
                            statisticsIconButton.title = `Statistics (${statsCount} selected)`;
                            statisticsIconButton.style.background = 'rgba(59, 130, 246, 0.1)';
                            statisticsIconButton.style.color = '#3b82f6';
                            statisticsIconButton.style.fontWeight = '500';
                        } else {
                            statisticsIconButton.innerHTML = '<span class="genie-dashboard-tab-icon">∑</span>';
                            statisticsIconButton.title = 'Statistics options';
                            statisticsIconButton.style.background = 'transparent';
                            statisticsIconButton.style.color = '#6b7280';
                            statisticsIconButton.style.fontWeight = '500';
                        }
                        
                        // Get current active tab
                        const isChartTabActive = chartContent.classList.contains('genie-dashboard-active');
                        const currentCompareValue = compareDropdown && compareDropdown.value !== 'none' ? compareDropdown.value : null;
                        
                        // Re-render only the active tab
                        if (isChartTabActive) {
                            // Chart tab is active - re-render chart
                            await renderChartWithData(currentDataArray, previousDataArray, currentCompareValue);
                        } else {
                            // Stats tab is active - re-render stats table
                            if (showTabs) {
                                const isTransposed = panel.statsTable?.transpose || panel.options?.statsTable?.transpose || panel.transpose || false;
                                this.renderStatsTable(panel, currentDataArray, statsContent, selectedStats.length > 0 ? selectedStats : panelStats, previousDataArray, isTransposed, currentCompareValue);
                            }
                        }
                    });
                    
                    statisticsMenu.appendChild(menuItem);
                });
                
                // Toggle menu on button click
                statisticsIconButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isVisible = statisticsMenu.style.display === 'block' || statisticsMenu.style.display === 'flex';
                    if (isVisible) {
                        statisticsMenu.style.display = 'none';
                    } else {
                        // Calculate position relative to button using fixed positioning
                        const buttonRect = statisticsIconButton.getBoundingClientRect();
                        const menuTop = buttonRect.bottom + window.scrollY + 4; // 4px margin
                        const menuLeft = buttonRect.left + window.scrollX;
                        
                        statisticsMenu.style.top = menuTop + 'px';
                        statisticsMenu.style.left = menuLeft + 'px';
                        statisticsMenu.style.display = 'block';
                    }
                });
                
                // Close menu when clicking outside
                const closeMenuHandler = (e) => {
                    if (!statisticsContainer.contains(e.target) && !statisticsMenu.contains(e.target)) {
                        statisticsMenu.style.display = 'none';
                    }
                };
                document.addEventListener('click', closeMenuHandler);
                
                statisticsContainer.appendChild(statisticsIconButton);
                // Append menu to body for fixed positioning to work correctly and avoid truncation
                document.body.appendChild(statisticsMenu);
                
                // Store reference for later use (replacing aggregation container)
                sumIconButton = statisticsContainer; // Store container for easy access
                avgIconButton = statisticsContainer; // Keep for backward compatibility
            }
            
            chartTab = document.createElement('button');
            chartTab.type = 'button'; // Prevent form submission
            chartTab.className = 'genie-dashboard-tab' + (showStatsTabByDefault ? '' : ' genie-dashboard-active');
            chartTab.innerHTML = '<span class="genie-dashboard-tab-icon">📈</span>';
            chartTab.title = 'Timeseries'; // Tooltip on hover
            chartTab.setAttribute('aria-label', 'Timeseries');
            
            statsTab = document.createElement('button');
            statsTab.type = 'button'; // Prevent form submission
            statsTab.className = 'genie-dashboard-tab' + (showStatsTabByDefault ? ' genie-dashboard-active' : '');
            // Icon options: 📊 (bar chart), 📋 (clipboard), 🔢 (numbers), ∑ (sigma), 📐 (ruler)
            statsTab.innerHTML = '<span class="genie-dashboard-tab-icon">🔢</span>';
            statsTab.title = 'Statistics'; // Tooltip on hover
            statsTab.setAttribute('aria-label', 'Statistics');
            
            // Group icons in specified order: % icon, Statistics icon | Chart icon | Sum icon, Avg icon | Scale icon, Dropdown
            // Group 1: % icon + Statistics icon (stats-related)
            if (percentIconButton) {
                tabsContainer.appendChild(percentIconButton);
            }
            tabsContainer.appendChild(statsTab);
            
            // Separator 1
            tabsContainer.appendChild(createSeparator());
            
            // Group 2: Chart icon
            tabsContainer.appendChild(chartTab);
            
            // Add sort icon button if sort is enabled
            let sortIconButton = null;
            const sortEnabled = panel.options?.timeSeries?.sort === true;
            if (sortEnabled) {
                sortIconButton = document.createElement('button');
                sortIconButton.type = 'button';
                sortIconButton.className = 'genie-dashboard-tab';
                sortIconButton.setAttribute('data-icon', 'sort');
                sortIconButton.innerHTML = '<span class="genie-dashboard-tab-icon">⇅</span>';
                sortIconButton.title = 'Sort series by value';
                sortIconButton.setAttribute('aria-label', 'Sort series');
                sortIconButton.style.cssText = 'display: flex; align-items: center; justify-content: center; padding: 4px 8px; background: transparent; border: none; color: #6b7280; cursor: pointer; font-size: 16px;';
                
                // Initialize sort state
                if (panel._sortEnabled === undefined) {
                    panel._sortEnabled = false;
                }
                
                // Update button display based on sort state
                const updateSortButtonDisplay = () => {
                    if (panel._sortEnabled) {
                        sortIconButton.style.background = 'rgba(59, 130, 246, 0.1)';
                        sortIconButton.style.color = '#3b82f6';
                        sortIconButton.style.fontWeight = '500';
                        sortIconButton.title = 'Disable sorting';
                    } else {
                        sortIconButton.style.background = 'transparent';
                        sortIconButton.style.color = '#6b7280';
                        sortIconButton.style.fontWeight = '500';
                        sortIconButton.title = 'Sort series by value';
                    }
                };
                
                updateSortButtonDisplay();
                
                // Toggle sort on click
                sortIconButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    panel._sortEnabled = !panel._sortEnabled;
                    updateSortButtonDisplay();
                    
                    // Re-render chart with sorted data
                    const currentCompareValue = compareDropdown && compareDropdown.value !== 'none' ? compareDropdown.value : null;
                    await renderChartWithData(currentDataArray, previousDataArray, currentCompareValue);
                });
                
                tabsContainer.appendChild(sortIconButton);
            }
            
            // Add cumulative icon button if cumulative is enabled
            let cumulativeIconButton = null;
            const cumulativeEnabled = panel.options?.timeSeries?.cumulative === true;
            if (cumulativeEnabled) {
                cumulativeIconButton = document.createElement('button');
                cumulativeIconButton.type = 'button';
                cumulativeIconButton.className = 'genie-dashboard-tab';
                cumulativeIconButton.setAttribute('data-icon', 'cumulative');
                cumulativeIconButton.innerHTML = '<span class="genie-dashboard-tab-icon">+</span>';
                cumulativeIconButton.title = 'Show cumulative values';
                cumulativeIconButton.setAttribute('aria-label', 'Cumulative view');
                cumulativeIconButton.style.cssText = 'display: flex; align-items: center; justify-content: center; padding: 4px 8px; background: transparent; border: none; color: #6b7280; cursor: pointer; font-size: 16px;';
                
                // Initialize cumulative state
                if (panel._cumulativeEnabled === undefined) {
                    panel._cumulativeEnabled = false;
                }
                
                // Update button display based on cumulative state
                const updateCumulativeButtonDisplay = () => {
                    if (panel._cumulativeEnabled) {
                        cumulativeIconButton.style.background = 'rgba(59, 130, 246, 0.1)';
                        cumulativeIconButton.style.color = '#3b82f6';
                        cumulativeIconButton.style.fontWeight = '500';
                        cumulativeIconButton.title = 'Disable cumulative view';
                    } else {
                        cumulativeIconButton.style.background = 'transparent';
                        cumulativeIconButton.style.color = '#6b7280';
                        cumulativeIconButton.style.fontWeight = '500';
                        cumulativeIconButton.title = 'Show cumulative values';
                    }
                };
                
                updateCumulativeButtonDisplay();
                
                // Toggle cumulative on click
                cumulativeIconButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    panel._cumulativeEnabled = !panel._cumulativeEnabled;
                    updateCumulativeButtonDisplay();
                    
                    // Re-render chart with cumulative data
                    const currentCompareValue = compareDropdown && compareDropdown.value !== 'none' ? compareDropdown.value : null;
                    await renderChartWithData(currentDataArray, previousDataArray, currentCompareValue);
                });
                
                tabsContainer.appendChild(cumulativeIconButton);
            }
            
            // Separator 2 (only if statistics icon exists)
            if (sumIconButton) {
                tabsContainer.appendChild(createSeparator());
            }
            
            // Group 3: Statistics icon with dropdown menu
            if (sumIconButton) {
                // sumIconButton is the statisticsContainer
                tabsContainer.appendChild(sumIconButton);
            }
        }
        
        // Get previous options: check panel-specific first, then fall back to global
        // Priority order:
        // 1. panel.timeSeries?.previous or panel.options?.timeSeries?.previous (for timeseries tab)
        // 2. panel.statsTable?.previous or panel.options?.statsTable?.previous (for stats tab compatibility)
        // 3. Global: inputConfig.previous
        //   This allows each panel to have its own compare options, overriding the global setting
        const timeSeriesPreviousOptions = panel.timeSeries?.previous || panel.options?.timeSeries?.previous;
        const statsTablePreviousOptions = panel.statsTable?.previous || panel.options?.statsTable?.previous;
        const globalPreviousOptions = this.inputConfig?.previous;
        // Use timeSeries options if available (for timeseries tab), otherwise fall back to statsTable or global
        // Note: The dropdown will be updated when switching tabs to use the appropriate options
        const previousOptionsStr = timeSeriesPreviousOptions || statsTablePreviousOptions || globalPreviousOptions;
        
        // Add compare dropdown to tabsContainer if previous options exist (integrated into toolbar grouping)
        let compareDropdown = null;
        let previousOptions = null;
        if (previousOptionsStr && tabsContainer) {
            // Parse comma-separated previous options
            previousOptions = previousOptionsStr.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0 && opt !== 'none');
            
            // Separator 3: before scale icon and dropdown (Group 4: comparison)
            tabsContainer.appendChild(createSeparator());
            
            // Create container for compare button and dropdown menu
            const compareContainer = document.createElement('div');
            compareContainer.style.cssText = 'position: relative; display: inline-block;';
            
            // Create compare button with scale icon
            const compareIconButton = document.createElement('button');
            compareIconButton.type = 'button';
            compareIconButton.className = 'genie-dashboard-tab';
            compareIconButton.setAttribute('data-icon', 'compare');
            
            // Helper to format option text
            const formatOptionText = (option) => {
                if (option === 'none' || !option) return 'None';
                if (option.startsWith('-')) return option;
                return `-${option}`;
            };
            
            // Get current selected option
            const defaultTab = showStatsTabByDefault ? 'stats' : 'chart';
            const defaultOptionsStr = defaultTab === 'chart' ? 
                (timeSeriesPreviousOptions || previousOptionsStr) : 
                (statsTablePreviousOptions || previousOptionsStr);
            const defaultOptions = defaultOptionsStr ? 
                (defaultOptionsStr.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0)) : 
                previousOptions;
            const firstOption = defaultOptions[0];
            const initialSelectedOption = firstOption === 'none' ? 'none' : firstOption;
            
            // Store current selection in panel
            if (!panel._compareSelectedOption) {
                panel._compareSelectedOption = initialSelectedOption;
            }
            
            // Update button display
            const updateCompareButtonDisplay = () => {
                const selectedOption = panel._compareSelectedOption || 'none';
                const displayText = formatOptionText(selectedOption);
                
                // Always include the text span with fixed min-width to prevent flicker
                if (selectedOption === 'none') {
                    compareIconButton.innerHTML = `<span class="genie-dashboard-tab-icon">⚖️</span><span style="margin-left: 2px; font-size: 12px; min-width: 24px; display: inline-block;"></span>`;
                    compareIconButton.title = 'Compare with previous period';
                    compareIconButton.style.background = 'transparent';
                    compareIconButton.style.color = '#6b7280';
                    compareIconButton.style.fontWeight = '500';
            } else {
                    compareIconButton.innerHTML = `<span class="genie-dashboard-tab-icon">⚖️</span><span style="margin-left: 2px; font-size: 12px; min-width: 24px; display: inline-block;">${displayText}</span>`;
                    compareIconButton.title = `Comparing with ${displayText}`;
                    compareIconButton.style.background = 'rgba(59, 130, 246, 0.1)';
                    compareIconButton.style.color = '#3b82f6';
                    compareIconButton.style.fontWeight = '500';
                }
            };
            
            updateCompareButtonDisplay();
            compareIconButton.setAttribute('aria-label', 'Compare with previous period');
            compareIconButton.style.display = 'flex';
            compareIconButton.style.alignItems = 'center';
            
            // Create dropdown menu
            const compareMenu = document.createElement('div');
            compareMenu.className = 'genie-dashboard-compare-menu';
            compareMenu.style.cssText = 'display: none; position: absolute; top: 100%; left: 0; background: white; border: 1px solid #d1d5db; border-radius: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); z-index: 1000; margin-top: 4px; min-width: 120px;';
            
            // Add options to menu - ensure 'none' is first and not duplicated
            const compareOptions = previousOptions.includes('none') 
                ? previousOptions 
                : ['none', ...previousOptions];
            compareOptions.forEach(option => {
                const menuItem = document.createElement('div');
                menuItem.className = 'genie-dashboard-compare-menu-item';
                menuItem.style.cssText = 'padding: 8px 12px; cursor: pointer; display: flex; align-items: center; font-size: 13px; color: #1f2937;';
                menuItem.innerHTML = `<span>${formatOptionText(option)}</span>`;
                
                // Highlight selected option
                if (panel._compareSelectedOption === option) {
                    menuItem.style.background = 'rgba(59, 130, 246, 0.1)';
                    menuItem.style.color = '#3b82f6';
                    menuItem.innerHTML += ' <span style="color: #3b82f6; margin-left: auto;">✓</span>';
                }
                
                // Hover effect
                menuItem.addEventListener('mouseenter', () => {
                    if (panel._compareSelectedOption !== option) {
                        menuItem.style.background = '#f3f4f6';
                    }
                });
                menuItem.addEventListener('mouseleave', () => {
                    if (panel._compareSelectedOption !== option) {
                        menuItem.style.background = 'transparent';
                    }
                });
                
                menuItem.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    
                    // Update selected option
                    panel._compareSelectedOption = option;
                    
                    // Hide menu
                    compareMenu.style.display = 'none';
                    
                    // Update button display
                    updateCompareButtonDisplay();
                    
                    // Update menu items highlighting
                    compareMenu.querySelectorAll('.genie-dashboard-compare-menu-item').forEach((item, idx) => {
                        const opt = compareOptions[idx];
                        if (panel._compareSelectedOption === opt) {
                            item.style.background = 'rgba(59, 130, 246, 0.1)';
                            item.style.color = '#3b82f6';
                            item.innerHTML = `<span>${formatOptionText(opt)}</span><span style="color: #3b82f6; margin-left: auto;">✓</span>`;
            } else {
                            item.style.background = 'transparent';
                            item.style.color = '#1f2937';
                            item.innerHTML = `<span>${formatOptionText(opt)}</span>`;
                        }
                    });
                    
                    // Trigger change event on hidden select (for backward compatibility)
                    if (compareDropdown) {
                        compareDropdown.value = option;
                        compareDropdown.dispatchEvent(new Event('change'));
                    }
                });
                
                compareMenu.appendChild(menuItem);
            });
            
            // Toggle menu on button click
            compareIconButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = compareMenu.style.display === 'block';
                compareMenu.style.display = isVisible ? 'none' : 'block';
            });
            
            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!compareContainer.contains(e.target)) {
                    compareMenu.style.display = 'none';
                }
            });
            
            compareContainer.appendChild(compareIconButton);
            compareContainer.appendChild(compareMenu);
            
            // Create hidden select for backward compatibility
            compareDropdown = document.createElement('select');
            compareDropdown.id = `${this.instanceId}-compare-dropdown-${panel.id}`;
            compareDropdown.className = 'genie-dashboard-compare-dropdown';
            compareDropdown.style.cssText = 'display: none;'; // Hidden but kept for compatibility
            compareDropdown.value = initialSelectedOption;
            
            // Append hidden select to container for querySelector compatibility
            compareContainer.appendChild(compareDropdown);
            
            // Group 4: Compare button with dropdown menu
            tabsContainer.appendChild(compareContainer);
            
            // Settings icon button (after compare dropdown)
            const settingsIconButton = document.createElement('button');
            settingsIconButton.type = 'button';
            settingsIconButton.className = 'genie-dashboard-tab';
            settingsIconButton.setAttribute('data-icon', 'settings');
            settingsIconButton.innerHTML = '<span class="genie-dashboard-tab-icon">⚙️</span>';
            settingsIconButton.title = 'Panel settings';
            settingsIconButton.setAttribute('aria-label', 'Panel settings');
            settingsIconButton.style.cssText = 'display: flex; align-items: center; justify-content: center; padding: 4px 8px; background: transparent; border: none; color: #6b7280; cursor: pointer; font-size: 16px; margin-left: 8px;';
            
            settingsIconButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showPanelSettings(panel, container, header);
            });
            
            tabsContainer.appendChild(settingsIconButton);
            
            // Download icon button (after settings, if enabled)
            if (panel.options?.download === true) {
                const downloadIconButton = document.createElement('button');
                downloadIconButton.type = 'button';
                downloadIconButton.className = 'genie-dashboard-tab';
                downloadIconButton.setAttribute('data-icon', 'download');
                downloadIconButton.innerHTML = '<span class="genie-dashboard-tab-icon">⬇️</span>';
                downloadIconButton.title = 'Download data';
                downloadIconButton.setAttribute('aria-label', 'Download data');
                downloadIconButton.style.cssText = 'display: flex; align-items: center; justify-content: center; padding: 4px 8px; background: transparent; border: none; color: #6b7280; cursor: pointer; font-size: 16px; margin-left: 8px; position: relative;';
                
                // Create container for button and dropdown
                const downloadContainer = document.createElement('div');
                downloadContainer.style.cssText = 'position: relative; display: inline-block;';
                
                // Create dropdown menu
                const downloadDropdown = document.createElement('div');
                downloadDropdown.className = 'genie-dashboard-download-dropdown';
                downloadDropdown.style.cssText = `
                    display: none;
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: 4px;
                    background: white;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    z-index: 1000;
                    min-width: 150px;
                    padding: 4px 0;
                `.replace(/\s+/g, ' ').trim();
                
                // Create dropdown items
                const downloadOptions = [
                    { id: 'source', label: 'Source', title: 'Download original raw data' },
                    { id: 'spanned', label: 'Spanned', title: 'Download data after span aggregation' },
                    { id: 'view', label: 'View', title: 'Download final data shown in view' }
                ];
                
                downloadOptions.forEach(option => {
                    const optionItem = document.createElement('div');
                    optionItem.className = 'genie-dashboard-download-option';
                    optionItem.textContent = option.label;
                    optionItem.title = option.title;
                    optionItem.style.cssText = `
                        padding: 8px 16px;
                        cursor: pointer;
                        color: #374151;
                        font-size: 14px;
                        transition: background-color 0.15s;
                    `.replace(/\s+/g, ' ').trim();
                    
                    optionItem.addEventListener('mouseenter', () => {
                        optionItem.style.backgroundColor = '#f3f4f6';
                    });
                    
                    optionItem.addEventListener('mouseleave', () => {
                        optionItem.style.backgroundColor = 'transparent';
                    });
                    
                    optionItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.downloadPanelData(panel, option.id);
                        downloadDropdown.style.display = 'none';
                    });
                    
                    downloadDropdown.appendChild(optionItem);
                });
                
                // Toggle dropdown on button click
                let dropdownClickHandler = null;
                downloadIconButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isVisible = downloadDropdown.style.display === 'block';
                    downloadDropdown.style.display = isVisible ? 'none' : 'block';
                    
                    // Add/remove document click handler to close dropdown when clicking outside
                    if (!isVisible) {
                        // Dropdown is opening, add handler
                        dropdownClickHandler = (event) => {
                            if (!downloadContainer.contains(event.target)) {
                                downloadDropdown.style.display = 'none';
                                document.removeEventListener('click', dropdownClickHandler);
                                dropdownClickHandler = null;
                            }
                        };
                        // Use setTimeout to avoid immediate closure
                        setTimeout(() => {
                            document.addEventListener('click', dropdownClickHandler);
                        }, 0);
                    } else {
                        // Dropdown is closing, remove handler if it exists
                        if (dropdownClickHandler) {
                            document.removeEventListener('click', dropdownClickHandler);
                            dropdownClickHandler = null;
                        }
                    }
                });
                
                // Append button and dropdown to container
                downloadContainer.appendChild(downloadIconButton);
                downloadContainer.appendChild(downloadDropdown);
                
                tabsContainer.appendChild(downloadContainer);
            }
        }
        
        // Create a combined container for tabs and any other controls
        let headerControlsContainer = null;
        if (showTabs || (previousOptionsStr && !tabsContainer)) {
            // Check if headerControlsContainer already exists in header and remove it to prevent duplicates
            if (header) {
                const existingHeaderControls = header.querySelector('.genie-dashboard-header-controls');
                if (existingHeaderControls) {
                    existingHeaderControls.remove();
                }
            }
            
            headerControlsContainer = document.createElement('div');
            headerControlsContainer.className = 'genie-dashboard-header-controls';
            headerControlsContainer.style.cssText = 'display: flex; align-items: center; margin-left: auto; gap: 8px;';
            
            // Add tabs to the container if they exist
            if (tabsContainer) {
                tabsContainer.style.marginBottom = '0';
                tabsContainer.style.padding = '0';
                headerControlsContainer.appendChild(tabsContainer);
            }
        }
        
        // Append header controls container (with tabs and/or compare) to header if header exists
        if (headerControlsContainer) {
            if (header) {
                // Move controls inline with header to save height
                header.appendChild(headerControlsContainer);
            } else {
                // If no header, append to container
                container.appendChild(headerControlsContainer);
            }
        }
        
        // Create tab content containers
        const chartContent = document.createElement('div');
        if (showTabs) {
            chartContent.className = 'genie-dashboard-tab-content' + (showStatsTabByDefault ? '' : ' genie-dashboard-active');
            chartContent.style.display = showStatsTabByDefault ? 'none' : 'block';
        } else {
            chartContent.className = '';
            chartContent.style.display = 'block'; // Always show if tabs disabled
        }
        chartContent.id = `${this.instanceId}-chart-tab-${panel.id}`;
        
        const statsContent = document.createElement('div');
        if (showTabs) {
            statsContent.className = 'genie-dashboard-tab-content' + (showStatsTabByDefault ? ' genie-dashboard-active' : '');
            statsContent.style.display = showStatsTabByDefault ? 'block' : 'none';
        } else {
            statsContent.className = '';
            statsContent.style.display = 'none'; // Hide if tabs disabled
        }
        statsContent.id = `${this.instanceId}-stats-tab-${panel.id}`;
        
        // Stats container height will be set dynamically after panel height is calculated
        // to match the chart content height exactly
        statsContent.style.setProperty('overflow-y', 'auto', 'important');
        statsContent.style.setProperty('overflow-x', 'hidden', 'important');
        statsContent.style.setProperty('box-sizing', 'border-box', 'important');
        
        container.appendChild(chartContent);
        container.appendChild(statsContent);
        
        // Helper function to update compare dropdown options based on active tab
        const updateCompareDropdownOptions = (tabName) => {
            if (!compareDropdown) return;
            
            // Get the appropriate previous options based on active tab
            let optionsStr = null;
            if (tabName === 'chart') {
                // Chart tab: use timeSeries options
                optionsStr = timeSeriesPreviousOptions || globalPreviousOptions;
            } else {
                // Stats tab: use statsTable options
                optionsStr = statsTablePreviousOptions || globalPreviousOptions;
            }
            
            if (!optionsStr) {
                // No options available, hide dropdown
                if (compareDropdown.parentElement) {
                    compareDropdown.parentElement.style.display = 'none';
                }
                return;
            }
            
            // Parse options
            const options = optionsStr.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
            
            // Store current selection
            // Get current value from panel state or dropdown
            const currentValue = panel._compareSelectedOption || (compareDropdown ? compareDropdown.value : null);
            
            // Clear and repopulate dropdown
            compareDropdown.innerHTML = '';
            options.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                // Display with "-" prefix if not "none" and doesn't already start with "-"
                if (option === 'none') {
                    optionElement.textContent = 'None';
                } else if (option.startsWith('-')) {
                    optionElement.textContent = option;
                } else {
                    optionElement.textContent = `-${option}`;
                }
                compareDropdown.appendChild(optionElement);
            });
            
            // Restore selection if it exists in new options, otherwise use first option
            let newValue = null;
            if (options.includes(currentValue)) {
                newValue = currentValue;
                // Update both panel state and hidden select
                if (currentValue) {
                    panel._compareSelectedOption = currentValue;
                    if (compareDropdown) compareDropdown.value = currentValue;
                    // Update button display if it exists
                    const compareButton = tabsContainer.querySelector('[data-icon="compare"]');
                    if (compareButton && typeof updateCompareButtonDisplay === 'function') {
                        updateCompareButtonDisplay();
                    }
                }
            } else {
                const firstOption = options[0];
                if (firstOption === 'none') {
                    newValue = 'none';
                    panel._compareSelectedOption = 'none';
                    if (compareDropdown) compareDropdown.value = 'none';
                } else {
                    newValue = firstOption;
                    panel._compareSelectedOption = firstOption;
                    if (compareDropdown) compareDropdown.value = firstOption;
                }
            }
            
            // Show dropdown if it was hidden
            if (compareDropdown.parentElement) {
                compareDropdown.parentElement.style.display = 'flex';
            }
            
            // Handle value changes and tab switches
            const valueChanged = newValue !== currentValue;
            if (valueChanged || tabName) {
                // If new value is "none", clear previous data and re-render without previous data
                if (newValue === 'none') {
                    previousDataArray = null;
                    // Re-render chart without previous data if on chart tab
                    if (tabName === 'chart') {
                        renderChartWithData(currentDataArray, null, null);
                    }
                    // Re-render stats table without previous data if on stats tab
                    if (tabName === 'stats') {
                        const isTransposed = panel.statsTable?.transpose || panel.options?.statsTable?.transpose || panel.transpose || false;
                        this.renderStatsTable(panel, currentDataArray, statsContent, panelStats, null, isTransposed, null);
                    }
                } else if (valueChanged && newValue !== 'none') {
                    // Value changed to a non-none option - need to fetch new data
                    // Clear previous data first since value changed
                    previousDataArray = null;
                    // If we're switching tabs, we need to fetch the data for the new tab
                    // Re-render the active tab to reflect the new dropdown value
                    if (tabName === 'chart') {
                        // Chart tab - will be handled by the change event
                        setTimeout(() => {
                            compareDropdown.dispatchEvent(new Event('change'));
                        }, 0);
                    } else if (tabName === 'stats') {
                        // Stats tab - render immediately with the new dropdown value
                        // The change handler will fetch the data and re-render
                        setTimeout(() => {
                            compareDropdown.dispatchEvent(new Event('change'));
                        }, 0);
                    }
                } else if (!valueChanged && tabName) {
                    // Tab switched but value didn't change (same value exists in both tabs)
                    // Use stored panel value if newValue is empty
                    const durationToUse = newValue || panel._compareSelectedOption || null;
                    
                    // If value is not "none" and not empty, we need to ensure previous data exists and is loaded
                    if (durationToUse && durationToUse !== 'none') {
                        // Check if we have previous data - use panel-stored value if local variable is empty
                        // This ensures we have the data even if the local closure variable was reset
                        let dataToUse = previousDataArray;
                        if ((!dataToUse || dataToUse.length === 0) && panel._previousDataArray && 
                            panel._previousDuration === durationToUse) {
                            dataToUse = panel._previousDataArray;
                            previousDataArray = dataToUse; // Update local variable too
                            console.log(`[TabSwitch] Using panel-stored previousDataArray:`, dataToUse.length, 'targets');
                        }
                        
                        // Check if we have previous data for this value
                        // If previousDataArray is null or empty, we need to fetch it
                        // Note: If zoom is active, renderStatsTable will filter the existing previousDataArray by zoom range
                        // So we don't need to re-fetch - the existing data will be filtered appropriately
                        if (!dataToUse || dataToUse.length === 0) {
                            // Need to fetch previous data - trigger change event to fetch
                            previousDataArray = null; // Clear to ensure fresh fetch
                            setTimeout(() => {
                                compareDropdown.dispatchEvent(new Event('change', { bubbles: true }));
                            }, 0);
                        } else {
                            // We have previous data, use it for the new tab
                            // renderStatsTable will automatically filter by zoom range if zoom is active
                            // Note: Tab visibility is already set in switchTab before this function is called
                            if (tabName === 'chart') {
                                // Re-render chart with existing previous data
                                // Use setTimeout to ensure tab is fully visible and DOM is ready
                                setTimeout(() => {
                                    renderChartWithData(currentDataArray, dataToUse, durationToUse);
                                }, 0);
                            } else if (tabName === 'stats') {
                                // Re-render stats table with existing previous data
                                // renderStatsTable will filter previous data by zoom range if zoom is active
                                const isTransposed = panel.statsTable?.transpose || panel.options?.statsTable?.transpose || panel.transpose || false;
                                console.log(`[TabSwitch] Rendering stats table with previousDataArray:`, dataToUse ? `${dataToUse.length} targets` : 'null', 'duration:', durationToUse);
                                this.renderStatsTable(panel, currentDataArray, statsContent, panelStats, dataToUse, isTransposed, durationToUse);
                            }
                        }
                    } else {
                        // Value is "none" or empty - no previous data needed
                        previousDataArray = null;
                        if (tabName === 'chart') {
                            renderChartWithData(currentDataArray, null, null);
                        } else if (tabName === 'stats') {
                            const isTransposed = panel.statsTable?.transpose || panel.options?.statsTable?.transpose || panel.transpose || false;
                            this.renderStatsTable(panel, currentDataArray, statsContent, panelStats, null, isTransposed, null);
                        }
                    }
                }
            }
        };
        
        // Tab switching function (only if tabs are enabled)
        const switchTab = (tabName) => {
            if (!showTabs) return; // Don't switch if tabs are disabled
            
            if (chartTab && statsTab) {
                chartTab.classList.toggle('genie-dashboard-active', tabName === 'chart');
                statsTab.classList.toggle('genie-dashboard-active', tabName === 'stats');
            }
            
            // Explicitly set display styles FIRST to ensure tab is visible before rendering
            if (tabName === 'chart') {
                chartContent.classList.add('genie-dashboard-active');
                chartContent.style.display = 'block';
                statsContent.classList.remove('genie-dashboard-active');
                statsContent.style.display = 'none';
            } else {
                statsContent.classList.add('genie-dashboard-active');
                statsContent.style.display = 'block';
                chartContent.classList.remove('genie-dashboard-active');
                chartContent.style.display = 'none';
            }
            
            // Show/hide zoom slider based on active tab (slider only works with chart view)
            // Time range text is now always visible in the header next to the title
            const panelElement = container.closest('.genie-dashboard-panel');
            const sliderContainerElement = panelElement?.querySelector('.genie-dashboard-zoom-slider-container');
            if (sliderContainerElement) {
                if (tabName === 'chart') {
                    // Show slider container when chart tab is active
                    sliderContainerElement.style.display = 'flex';
                    sliderContainerElement.style.visibility = 'visible';
                    // Show slider wrapper in chart view
                    const sliderWrapperElement = sliderContainerElement.querySelector('.genie-dashboard-zoom-slider-wrapper');
                    if (sliderWrapperElement) {
                        sliderWrapperElement.style.display = 'block';
                        sliderWrapperElement.style.visibility = 'visible';
                    }
                } else {
                    // Hide entire slider container when stats tab is active
                    sliderContainerElement.style.display = 'none';
                    sliderContainerElement.style.visibility = 'hidden';
                }
            }
            
            // Show/hide unit note based on active tab (note only shown in stats view)
            const unitNote = panelElement?.querySelector('.genie-dashboard-unit-note');
            if (unitNote) {
                if (tabName === 'stats') {
                    unitNote.style.display = 'block';
                } else {
                    unitNote.style.display = 'none';
                }
            }
            
            // Show/hide tooltip legend based on active tab (legend only works with chart view)
            const tooltipLegendContainer = panelElement?.querySelector('.genie-legend-tooltip-container');
            if (tooltipLegendContainer) {
                if (tabName === 'chart') {
                    // Show tooltip legend when chart tab is active
                    tooltipLegendContainer.style.display = 'flex';
                    tooltipLegendContainer.style.visibility = 'visible';
                } else {
                    // Hide tooltip legend when stats tab is active
                    tooltipLegendContainer.style.display = 'none';
                    tooltipLegendContainer.style.visibility = 'hidden';
                }
            }
            
            // Update compare dropdown options based on active tab (after tab is visible)
            if (compareDropdown && (timeSeriesPreviousOptions || statsTablePreviousOptions)) {
                updateCompareDropdownOptions(tabName);
            }
            
            // Enable/disable percent icon - only available for stats tab (keep visible to avoid flicker)
            // Percent view is only supported for statistics tab, not timeseries
            if (percentIconButton) {
                if (tabName === 'chart') {
                    // Disable percent icon when chart tab is active (keep visible to avoid flicker)
                    // Save current percent view state before disabling
                    if (panel._percentStateBeforeChartTab === undefined) {
                        panel._percentStateBeforeChartTab = panel._percentViewEnabled || false;
                    }
                    percentIconButton.disabled = true;
                    percentIconButton.style.opacity = '0.5';
                    percentIconButton.style.cursor = 'not-allowed';
                    percentIconButton.style.pointerEvents = 'none';
                    percentIconButton.title = 'Percent view only available in statistics view';
                    // Temporarily disable percent view state (will be restored when switching back)
                    panel._percentViewEnabled = false;
                } else if (tabName === 'stats') {
                    // Enable percent icon when stats tab is active
                    percentIconButton.disabled = false;
                    percentIconButton.style.opacity = '1';
                    percentIconButton.style.cursor = 'pointer';
                    percentIconButton.style.pointerEvents = 'auto';
                    // Restore previous percent view state if it was saved
                    const wasPercentStateRestored = panel._percentStateBeforeChartTab !== undefined;
                    if (wasPercentStateRestored) {
                        panel._percentViewEnabled = panel._percentStateBeforeChartTab;
                        panel._percentStateBeforeChartTab = undefined; // Clear saved state
                    }
                    // Show percent icon only when stats tab is active AND percent config exists
                    if (hasPercentConfig) {
                        percentIconButton.style.display = 'flex';
                        // Update button display to reflect current percent view state
                        if (panel._percentViewEnabled) {
                            percentIconButton.style.background = 'rgba(59, 130, 246, 0.1)';
                            percentIconButton.style.border = 'none';
                            percentIconButton.style.color = '#3b82f6';
                            percentIconButton.style.fontWeight = '500';
                            percentIconButton.title = 'Hide percentages';
                        } else {
                            percentIconButton.style.background = 'transparent';
                            percentIconButton.style.border = 'none';
                            percentIconButton.style.color = '#6b7280';
                            percentIconButton.style.fontWeight = '500';
                            percentIconButton.title = 'Show percentages';
                        }
                        // Re-render stats table if percent state was restored (to apply the percent view)
                        if (wasPercentStateRestored && panel._percentViewEnabled) {
                            const compareDropdown = container.closest('.genie-dashboard-panel')?.querySelector('.genie-dashboard-compare-dropdown');
                            const currentDropdownValue = compareDropdown ? compareDropdown.value : null;
                            const finalPreviousDuration = currentDropdownValue && currentDropdownValue !== 'none' ? currentDropdownValue : null;
                            const isTransposed = panel.statsTable?.transpose || panel.options?.statsTable?.transpose || panel.transpose || false;
                            setTimeout(() => {
                                this.renderStatsTable(panel, currentDataArray, statsContent, panelStats, previousDataArray, isTransposed, finalPreviousDuration);
                            }, 0);
                        }
                    } else {
                        percentIconButton.style.display = 'none';
                    }
                }
            }
            
            // Show/hide statistics icon - show on both tabs since statistics applies to both timeseries and stats table
            if (sumIconButton) {
                // Check if this is the statistics icon (not aggregation icon)
                const isStatisticsIcon = sumIconButton.querySelector('[data-icon="statistics"]');
                if (isStatisticsIcon) {
                    // Statistics icon should always be visible if it exists (it's only created if stats are configured)
                    sumIconButton.style.display = 'inline-block';
                    console.log('[Statistics Icon] Icon shown for', tabName, 'tab');
                } else if (aggregationConfig && aggregationTag) {
                    // Legacy aggregation icon - show on both chart and stats tabs since aggregation works for both
                    sumIconButton.style.display = 'inline-block';
                    console.log('[Aggregation Icons] Icon shown for', tabName, 'tab');
                } else {
                    // Hide aggregation icon if config is missing
                    sumIconButton.style.display = 'none';
                    console.log('[Aggregation Icons] Icon hidden - no config');
                }
            } else {
                console.log('[Statistics/Aggregation Icons] Icon not found:', { sumIconButton });
            }
            
            // Enable/disable sort icon - only available for chart tab (keep visible to avoid flicker)
            const sortIconButton = tabsContainer?.querySelector('[data-icon="sort"]');
            if (sortIconButton) {
                if (tabName === 'chart') {
                    // Enable sort icon when chart tab is active
                    sortIconButton.disabled = false;
                    sortIconButton.style.opacity = '1';
                    sortIconButton.style.cursor = 'pointer';
                    sortIconButton.style.pointerEvents = 'auto';
                    // Restore previous sort state if it was saved
                    const wasSortStateRestored = panel._sortStateBeforeStatsTab !== undefined;
                    if (wasSortStateRestored) {
                        panel._sortEnabled = panel._sortStateBeforeStatsTab;
                        panel._sortStateBeforeStatsTab = undefined; // Clear saved state
                    }
                    // Update button display to reflect current sort state
                    if (panel._sortEnabled) {
                        sortIconButton.style.background = 'rgba(59, 130, 246, 0.1)';
                        sortIconButton.style.color = '#3b82f6';
                        sortIconButton.style.fontWeight = '500';
                        sortIconButton.title = 'Disable sorting';
                    } else {
                        sortIconButton.style.background = 'transparent';
                        sortIconButton.style.color = '#6b7280';
                        sortIconButton.style.fontWeight = '500';
                        sortIconButton.title = 'Sort series by value';
                    }
                    // Re-render chart if sort state was restored (to apply the sort)
                    if (wasSortStateRestored && panel._sortEnabled) {
                        const currentCompareValue = compareDropdown && compareDropdown.value !== 'none' ? compareDropdown.value : null;
                        setTimeout(() => {
                            renderChartWithData(currentDataArray, previousDataArray, currentCompareValue);
                        }, 0);
                    }
                } else if (tabName === 'stats') {
                    // Disable sort icon when stats tab is active (keep visible to avoid flicker)
                    // Save current sort state before disabling
                    if (panel._sortStateBeforeStatsTab === undefined) {
                        panel._sortStateBeforeStatsTab = panel._sortEnabled || false;
                    }
                    sortIconButton.disabled = true;
                    sortIconButton.style.opacity = '0.5';
                    sortIconButton.style.cursor = 'not-allowed';
                    sortIconButton.style.pointerEvents = 'none';
                    sortIconButton.title = 'Sort only available in chart view';
                    // Temporarily disable sort state (will be restored when switching back)
                    panel._sortEnabled = false;
                }
            }
            
            // Enable/disable cumulative icon - only available for chart tab (keep visible to avoid flicker)
            const cumulativeIconButton = tabsContainer?.querySelector('[data-icon="cumulative"]');
            if (cumulativeIconButton) {
                if (tabName === 'chart') {
                    // Enable cumulative icon when chart tab is active
                    cumulativeIconButton.disabled = false;
                    cumulativeIconButton.style.opacity = '1';
                    cumulativeIconButton.style.cursor = 'pointer';
                    cumulativeIconButton.style.pointerEvents = 'auto';
                    // Restore previous cumulative state if it was saved
                    const wasCumulativeStateRestored = panel._cumulativeStateBeforeStatsTab !== undefined;
                    if (wasCumulativeStateRestored) {
                        panel._cumulativeEnabled = panel._cumulativeStateBeforeStatsTab;
                        panel._cumulativeStateBeforeStatsTab = undefined; // Clear saved state
                    }
                    // Update button display to reflect current cumulative state
                    if (panel._cumulativeEnabled) {
                        cumulativeIconButton.style.background = 'rgba(59, 130, 246, 0.1)';
                        cumulativeIconButton.style.color = '#3b82f6';
                        cumulativeIconButton.style.fontWeight = '500';
                        cumulativeIconButton.title = 'Disable cumulative view';
                    } else {
                        cumulativeIconButton.style.background = 'transparent';
                        cumulativeIconButton.style.color = '#6b7280';
                        cumulativeIconButton.style.fontWeight = '500';
                        cumulativeIconButton.title = 'Show cumulative values';
                    }
                    // Re-render chart if cumulative state was restored (to apply the cumulative calculation)
                    if (wasCumulativeStateRestored && panel._cumulativeEnabled) {
                        const currentCompareValue = compareDropdown && compareDropdown.value !== 'none' ? compareDropdown.value : null;
                        setTimeout(() => {
                            renderChartWithData(currentDataArray, previousDataArray, currentCompareValue);
                        }, 0);
                    }
                } else if (tabName === 'stats') {
                    // Disable cumulative icon when stats tab is active (keep visible to avoid flicker)
                    // Save current cumulative state before disabling
                    if (panel._cumulativeStateBeforeStatsTab === undefined) {
                        panel._cumulativeStateBeforeStatsTab = panel._cumulativeEnabled || false;
                    }
                    cumulativeIconButton.disabled = true;
                    cumulativeIconButton.style.opacity = '0.5';
                    cumulativeIconButton.style.cursor = 'not-allowed';
                    cumulativeIconButton.style.pointerEvents = 'none';
                    cumulativeIconButton.title = 'Cumulative view only available in chart view';
                    // Temporarily disable cumulative state (will be restored when switching back)
                    panel._cumulativeEnabled = false;
                }
            }
            
            // Additional rendering for stats tab (only if not handled by updateCompareDropdownOptions)
            // Note: updateCompareDropdownOptions handles the rendering when switching tabs,
            // but we need this as a fallback in case updateCompareDropdownOptions doesn't render
            // Also re-render if aggregation state might have changed
            if (tabName === 'stats') {
                // Check if updateCompareDropdownOptions triggered a change event to fetch data
                // If so, skip this fallback rendering as the change handler will render after fetching
                const compareDropdown = container.closest('.genie-dashboard-panel')?.querySelector('.genie-dashboard-compare-dropdown');
                const currentDropdownValue = compareDropdown ? compareDropdown.value : null;
                const hasCompareSelected = currentDropdownValue && currentDropdownValue !== 'none';
                const hasZoom = (panel.options?.timeSeries?.zoom || panel.options?.timeSeries?.zoomSlider) && 
                               panel._zoomRange && 
                               panel._zoomRange.min !== null && 
                               panel._zoomRange.max !== null;
                
                // If zoom is active and compare is selected, we should still render with existing previousDataArray
                // renderStatsTable will automatically filter previous data by zoom range
                // Only skip fallback if updateCompareDropdownOptions is handling the rendering (when fetching new data)
                // Check if we're currently fetching (previousDataArray is null but compare is selected)
                // Also check panel-stored previousDataArray as fallback
                let fallbackPreviousData = previousDataArray;
                if ((!fallbackPreviousData || fallbackPreviousData.length === 0) && panel._previousDataArray) {
                    const finalDropdownValue = compareDropdown ? compareDropdown.value : null;
                    if (finalDropdownValue && finalDropdownValue !== 'none' && panel._previousDuration === finalDropdownValue) {
                        fallbackPreviousData = panel._previousDataArray;
                        console.log(`[TabSwitch Fallback] Using panel-stored previousDataArray:`, fallbackPreviousData.length, 'targets');
                    }
                }
                const isFetchingPreviousData = hasCompareSelected && (!fallbackPreviousData || fallbackPreviousData.length === 0);
                if (!isFetchingPreviousData) {
                    // Render stats table - re-render to ensure it uses the current dropdown value and aggregation state
                    // Use setTimeout to ensure dropdown has been updated by updateCompareDropdownOptions
                    setTimeout(() => {
                        const finalDropdownValue = compareDropdown ? compareDropdown.value : null;
                        const finalPreviousDuration = finalDropdownValue && finalDropdownValue !== 'none' ? finalDropdownValue : null;
                        const isTransposed = panel.statsTable?.transpose || panel.options?.statsTable?.transpose || panel.transpose || false;
                        
                        // Re-render stats table when switching to stats tab to ensure:
                        // 1. Current dropdown value is used
                        // 2. Current aggregation state is applied
                        // 3. Previous data is properly handled (if already available)
                        console.log(`[TabSwitch Fallback] Rendering stats table with previousDataArray:`, fallbackPreviousData ? `${fallbackPreviousData.length} targets` : 'null', 'duration:', finalPreviousDuration);
                        this.renderStatsTable(panel, currentDataArray, statsContent, panelStats, fallbackPreviousData, isTransposed, finalPreviousDuration);
                    }, 50); // Small delay to ensure updateCompareDropdownOptions has completed
                }
            }
        };
        
        // Attach tab click handlers if tabs are enabled
        if (showTabs && chartTab && statsTab) {
            chartTab.onclick = () => switchTab('chart');
            statsTab.onclick = () => switchTab('stats');
        }
        
        // Render chart in chart tab
        // Ensure container allows tooltips to overflow
        chartContent.style.position = 'relative';
        chartContent.style.overflow = 'visible';
        chartContent.style.width = '100%';
        chartContent.style.zIndex = '1';
        // Margin-top will be set by slider positioning to account for slider height
        
        const canvas = document.createElement('canvas');
        chartContent.appendChild(canvas);
        
        // Get gridPos for use throughout this function
        const gridPos = panel.gridPos || { x: 0, y: 0, w: 12, h: 8 };
        
        // Store references for re-rendering
        let currentChart = null;
        let currentDataArray = dataArray;
        // Store currentDataArray on panel object so it can be accessed later (e.g., for re-rendering after expansion)
        panel._currentDataArray = dataArray;
        // Initialize previousDataArray from panel if it was fetched in parallel, otherwise null
        let previousDataArray = panel._previousDataArray || null;
        
        // Function to render/update chart with current and optional previous data
        const renderChartWithData = async (currentData, previousData = null, previousDuration = null) => {
            // Update stored currentDataArray on panel object
            currentDataArray = currentData;
            panel._currentDataArray = currentData;
            
            // Store source data for download (if download is enabled)
            if (panel.options?.download === true) {
                panel._downloadData = panel._downloadData || {};
                panel._downloadData.source = currentData; // Store raw source data
                panel._downloadData.sourcePrevious = previousData || null; // Store previous source data
                panel._downloadData.previousDuration = previousDuration || null; // Store previous duration
            }
            
            // Apply span aggregation to all series if configured (even without aggregation tag)
            let processedCurrentData = currentData;
            let processedPreviousData = previousData;
            
            if (spanAggregation && spanAggregationType) {
                processedCurrentData = this.applySpanAggregationToAllSeries(currentData, spanAggregation, spanAggregationType);
                if (previousData) {
                    processedPreviousData = this.applySpanAggregationToAllSeries(previousData, spanAggregation, spanAggregationType);
                }
                
                // Store spanned data for download (if download is enabled)
                if (panel.options?.download === true) {
                    panel._downloadData = panel._downloadData || {};
                    panel._downloadData.spanned = processedCurrentData; // Store data after span aggregation
                    panel._downloadData.spannedPrevious = processedPreviousData || null; // Store previous spanned data
                }
            }
            
            // Combine current and previous data
            let combinedData = [...processedCurrentData];
            console.log(`renderChartWithData: currentData has ${processedCurrentData.length} targets`);
            
            if (processedPreviousData) {
                console.log(`renderChartWithData: previousData has ${processedPreviousData.length} targets, duration: ${previousDuration}`);
                // Add previous data with isPrevious flag
                processedPreviousData.forEach((targetData, idx) => {
                    const previousTargetData = {
                        ...targetData,
                        refId: targetData.refId + '_prev',
                        isPrevious: true
                    };
                    console.log(`Adding previous target ${idx}: refId=${previousTargetData.refId}, isPrevious=${previousTargetData.isPrevious}`);
                    combinedData.push(previousTargetData);
                });
                console.log(`renderChartWithData: combinedData now has ${combinedData.length} targets`);
                // Verify isPrevious flags
                combinedData.forEach((td, idx) => {
                    console.log(`  Target ${idx}: refId=${td.refId}, isPrevious=${td.isPrevious}`);
                });
            } else {
                console.log(`renderChartWithData: No previous data, combinedData has ${combinedData.length} targets`);
            }
            
            // Transform data for Chart.js
            let chartData = this.transformDataForChart(combinedData, panel, previousDuration);
            console.log(`transformDataForChart returned ${chartData.datasets.length} datasets:`, chartData.datasets.map(d => d.label));
            
            // Store view data for download (if download is enabled)
            if (panel.options?.download === true) {
                panel._downloadData = panel._downloadData || {};
                panel._downloadData.view = chartData; // Store final view data (Chart.js format)
            }
            
            // Apply cumulative calculation if enabled
            if (panel._cumulativeEnabled) {
                chartData.datasets = chartData.datasets.map(dataset => {
                    // Calculate cumulative values (running sum)
                    let runningSum = 0;
                    const cumulativeData = dataset.data.map((point, index) => {
                        const value = point.y !== null && point.y !== undefined ? point.y : 0;
                        runningSum += value;
                        return {
                            x: point.x,
                            y: runningSum
                        };
                    });
                    return {
                        ...dataset,
                        data: cumulativeData
                    };
                });
                console.log(`Applied cumulative calculation to ${chartData.datasets.length} datasets`);
            }
            
            // Apply sorting if enabled (after cumulative, so sorting works on cumulative values if both are enabled)
            if (panel._sortEnabled) {
                chartData.datasets = chartData.datasets.map(dataset => {
                    // Sort data points by y value (descending)
                    const sortedData = [...dataset.data].sort((a, b) => {
                        const aVal = a.y !== null && a.y !== undefined ? a.y : -Infinity;
                        const bVal = b.y !== null && b.y !== undefined ? b.y : -Infinity;
                        return bVal - aVal; // Descending order (highest to lowest)
                    });
                    const dataLength = sortedData.length;
                    
                    // Calculate percentile positions
                    // Left most (index 0) = 100P, Right most (last index) = 0P
                    const percentilePositions = {
                        p100: 0,  // Left most
                        p99_9: Math.floor(dataLength * 0.001),  // P99.9 (0.1% from left)
                        p99: Math.floor(dataLength * 0.01),      // P99 (1% from left)
                        p95: Math.floor(dataLength * 0.05),     // P95 (5% from left)
                        p90: Math.floor(dataLength * 0.10),     // P90 (10% from left)
                        p50: Math.floor(dataLength * 0.50),     // P50 (50% from left, median)
                        p0: dataLength - 1  // Right most (0P)
                    };
                    
                    // Get base point radius from dataset or default
                    const basePointRadius = dataset.pointRadius || 3;
                    
                    // Assign sequential x positions (0, 1, 2, ...) and mark percentile points
                    const sortedDataWithSequentialX = sortedData.map((point, index) => {
                        // Determine which percentile this point represents
                        let percentileLabel = null;
                        if (index === percentilePositions.p100) {
                            percentileLabel = '100P';
                        } else if (index === percentilePositions.p99_9) {
                            percentileLabel = 'P99.9';
                        } else if (index === percentilePositions.p99) {
                            percentileLabel = 'P99';
                        } else if (index === percentilePositions.p95) {
                            percentileLabel = 'P95';
                        } else if (index === percentilePositions.p90) {
                            percentileLabel = 'P90';
                        } else if (index === percentilePositions.p50) {
                            percentileLabel = 'P50';
                        } else if (index === percentilePositions.p0) {
                            percentileLabel = '0P';
                        }
                        
                        return {
                            x: index,
                            y: point.y,
                            percentile: percentileLabel
                        };
                    });
                    
                    // Create pointRadius array - show dots only for percentile points (P99.9, P99, P95, P90, P50)
                    const pointRadiusArray = sortedDataWithSequentialX.map((point, index) => {
                        // Only show dots for specific percentiles: P99.9, P99, P95, P90, P50
                        if (point.percentile && ['P99.9', 'P99', 'P95', 'P90', 'P50'].includes(point.percentile)) {
                            return 3; // Smaller radius for percentile markers
                        }
                        return 0; // Hide all other points
                    });
                    
                    // Store percentile positions and labels for rendering
                    dataset._percentilePositions = percentilePositions;
                    dataset._dataLength = dataLength;
                    dataset._percentileLabels = sortedDataWithSequentialX.map(p => p.percentile);
                    
                    // Create pointHoverRadius array - enable hover for all points so tooltips work
                    const pointHoverRadiusArray = sortedDataWithSequentialX.map((point, index) => {
                        // Enable hover for percentile points and nearby points for better tooltip interaction
                        if (point.percentile && ['P99.9', 'P99', 'P95', 'P90', 'P50'].includes(point.percentile)) {
                            return 8; // Larger hover radius for percentile points
                        }
                        return 4; // Smaller hover radius for other points (so tooltips still work on line hover)
                    });
                    
                    return {
                        ...dataset,
                        data: sortedDataWithSequentialX,
                        pointRadius: pointRadiusArray,
                        pointHoverRadius: pointHoverRadiusArray, // Enable hover even when pointRadius is 0
                        pointBackgroundColor: sortedDataWithSequentialX.map((point, index) => {
                            // Only set color for visible percentile points (P99.9, P99, P95, P90, P50)
                            if (point.percentile && ['P99.9', 'P99', 'P95', 'P90', 'P50'].includes(point.percentile)) {
                                return dataset.borderColor || '#3b82f6';
                            }
                            return 'transparent'; // Transparent for hidden points
                        })
                    };
                });
                console.log(`Applied sorting to ${chartData.datasets.length} datasets`);
            }
            
            // Destroy existing chart if it exists
            if (currentChart) {
                currentChart.destroy();
            }
            
            // Determine chart type based on data format
            const useScatterFormat = chartData.datasets.length > 0 && 
                                     chartData.datasets[0].data.length > 0 && 
                                     typeof chartData.datasets[0].data[0] === 'object' &&
                                     chartData.datasets[0].data[0].x !== undefined;
            
            const config = {
                type: useScatterFormat ? 'line' : 'line',
                data: chartData,
                options: {
                    responsive: true,
                maintainAspectRatio: false,
                resizeDelay: 0, // Prevent auto-resize
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                onHover: function(event, activeElements, chart) {
                    // Change cursor to pointer when hovering over chart
                    if (event.native && event.native.target) {
                        event.native.target.style.cursor = activeElements && activeElements.length > 0 ? 'pointer' : 'default';
                    }
                },
                plugins: {
                    legend: {
                        // Hide Chart.js default legend if displayMode is "list" or "tooltip" (we'll create custom one)
                        display: panel.options?.legend?.showLegend !== false && 
                                panel.options?.legend?.displayMode !== 'list' &&
                                panel.options?.legend?.displayMode !== 'tooltip',
                        position: panel.options?.legend?.placement || 'bottom',
                    },
                    tooltip: {
                        enabled: true,
                        mode: panel.options?.tooltip?.mode || 'index',
                        intersect: false,
                        // Ensure tooltips work even when points are hidden
                        filter: function(tooltipItem) {
                            return true; // Show tooltip for all items
                        },
                        // Don't override position - let Chart.js handle it naturally
                        // We'll use CSS to force left alignment instead
                        animation: {
                            duration: 0
                        },
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#000000',
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyColor: '#000000',
                        bodyFont: {
                            size: 13
                        },
                        borderColor: 'rgba(0, 0, 0, 0.2)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        boxPadding: 6,
                        usePointStyle: true,
                        titleSpacing: 6,
                        bodySpacing: 4,
                        cornerRadius: 6,
                        animation: {
                            duration: 0
                        },
                        // Remove external callback completely - use CSS only for styling
                        // This prevents any recursion issues with Chart.js positioning
                        callbacks: {
                            title: function(tooltipItems) {
                                if (!tooltipItems || tooltipItems.length === 0) {
                                    return '';
                                }
                                
                                const item = tooltipItems[0];
                                const xValue = item.parsed?.x || item.label;
                                if (xValue === null || xValue === undefined) return '';
                                
                                // If sorting is enabled, x values are sequential indices (0, 1, 2, ...)
                                if (panel._sortEnabled) {
                                    return `Index: ${Math.round(xValue)}`;
                                }
                                
                                // Otherwise, treat as timestamp
                                const timestamp = xValue;
                                const date = new Date(timestamp);
                                if (isNaN(date.getTime())) return '';
                                
                                // Format in UTC timezone
                                const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
                                const day = String(date.getUTCDate()).padStart(2, '0');
                                const hours = String(date.getUTCHours()).padStart(2, '0');
                                const minutes = String(date.getUTCMinutes()).padStart(2, '0');
                                
                                return `${month} ${day}, ${hours}:${minutes} UTC`;
                            },
                            label: function(context) {
                                const label = context.dataset?.label || '';
                                const value = context.parsed?.y;
                                const unit = panel.fieldConfig?.defaults?.unit || '';
                                
                                if (value === null || value === undefined || isNaN(value)) {
                                    return label + ': N/A';
                                }
                                
                                const formattedValue = typeof value === 'number' ? value.toFixed(2) : String(value);
                                
                                // Check if this is a percentile point when sorting is enabled
                                // Each series has its own percentile positions based on its data length
                                let percentileLabel = null;
                                
                                if (panel._sortEnabled && context.dataIndex !== undefined && context.dataIndex !== null) {
                                    const dataset = context.dataset; // This is the specific dataset for this series
                                    const dataIndex = context.dataIndex;
                                    
                                    // Method 1: Calculate from x-value (index) using this dataset's percentile positions
                                    // This is the most reliable since x-index directly maps to percentile positions
                                    if (dataset._percentilePositions && context.parsed && context.parsed.x !== undefined) {
                                        const xIndex = Math.round(context.parsed.x);
                                        const positions = dataset._percentilePositions; // Each dataset has its own positions
                                        
                                        if (xIndex === positions.p99_9) {
                                            percentileLabel = 'P99.9';
                                        } else if (xIndex === positions.p99) {
                                            percentileLabel = 'P99';
                                        } else if (xIndex === positions.p95) {
                                            percentileLabel = 'P95';
                                        } else if (xIndex === positions.p90) {
                                            percentileLabel = 'P90';
                                        } else if (xIndex === positions.p50) {
                                            percentileLabel = 'P50';
                                        }
                                    }
                                    
                                    // Method 2: Direct access from dataset.data array
                                    if (!percentileLabel && dataset.data && Array.isArray(dataset.data) && dataset.data[dataIndex]) {
                                        const dataPoint = dataset.data[dataIndex];
                                        if (dataPoint && typeof dataPoint === 'object' && dataPoint.percentile) {
                                            const pLabel = dataPoint.percentile;
                                            if (pLabel && ['P99.9', 'P99', 'P95', 'P90', 'P50'].includes(pLabel)) {
                                                percentileLabel = pLabel;
                                            }
                                        }
                                    }
                                    
                                    // Method 3: Use _percentileLabels array (fallback)
                                    if (!percentileLabel && dataset._percentileLabels && Array.isArray(dataset._percentileLabels) && dataset._percentileLabels[dataIndex]) {
                                        const pLabel = dataset._percentileLabels[dataIndex];
                                        if (pLabel && ['P99.9', 'P99', 'P95', 'P90', 'P50'].includes(pLabel)) {
                                            percentileLabel = pLabel;
                                        }
                                    }
                                    
                                    // Method 4: Check context.raw (Chart.js might provide this)
                                    if (!percentileLabel && context.raw && typeof context.raw === 'object' && context.raw.percentile) {
                                        const pLabel = context.raw.percentile;
                                        if (pLabel && ['P99.9', 'P99', 'P95', 'P90', 'P50'].includes(pLabel)) {
                                            percentileLabel = pLabel;
                                        }
                                    }
                                    
                                }
                                
                                // Format: metric:value(P90) for percentile points, or metric: value unit for regular points
                                if (percentileLabel) {
                                    return label + ':' + formattedValue + '(' + percentileLabel + ')';
                                } else {
                                    return label + ': ' + formattedValue + (unit ? ' ' + unit : '');
                                }
                            },
                            afterBody: function(context) {
                                try {
                                    // Optional: Add summary line
                                    if (panel.options?.tooltip?.mode === 'multi' && context && context.length > 1) {
                                        const values = context
                                            .map(c => {
                                                if (c.parsed && c.parsed.y !== null && c.parsed.y !== undefined) {
                                                    return c.parsed.y;
                                                }
                                                return null;
                                            })
                                            .filter(v => v !== null && !isNaN(v));
                                        if (values.length > 0) {
                                            const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
                                            const unit = panel.fieldConfig?.defaults?.unit || '';
                                            return `Average: ${avg} ${unit}`;
                                        }
                                    }
                                    return '';
                                } catch (e) {
                                    return '';
                                }
                            },
                            labelColor: function(context) {
                                try {
                                    return {
                                        borderColor: context.dataset.borderColor || '#3b82f6',
                                        backgroundColor: context.dataset.borderColor || '#3b82f6'
                                    };
                                } catch (e) {
                                    return {
                                        borderColor: '#3b82f6',
                                        backgroundColor: '#3b82f6'
                                    };
                                }
                            }
                        },
                        itemSort: function(a, b) {
                            try {
                                // Sort tooltip items based on panel configuration
                                const sortOrder = panel.options?.tooltip?.sort || 'none';
                                const aVal = (a.parsed && a.parsed.y !== null && a.parsed.y !== undefined) ? a.parsed.y : 0;
                                const bVal = (b.parsed && b.parsed.y !== null && b.parsed.y !== undefined) ? b.parsed.y : 0;
                                
                                if (sortOrder === 'desc') {
                                    return bVal - aVal;
                                } else if (sortOrder === 'asc') {
                                    return aVal - bVal;
                                }
                                return 0; // No sort
                            } catch (e) {
                                return 0;
                            }
                        }
                    },
                    // Custom plugin to draw percentile labels when sorting is enabled
                    ...(panel._sortEnabled ? {
                        id: 'percentileLabels',
                        afterDraw: function(chart) {
                            const ctx = chart.ctx;
                            const datasets = chart.data.datasets;
                            
                            datasets.forEach((dataset, datasetIndex) => {
                                if (!dataset._percentileLabels || !dataset._percentilePositions) return;
                                
                                const meta = chart.getDatasetMeta(datasetIndex);
                                if (!meta || !meta.data) return;
                                
                                // Draw percentile labels (only for P99.9, P99, P95, P90, P50)
                                dataset._percentileLabels.forEach((label, dataIndex) => {
                                    // Only show labels for specific percentiles: P99.9, P99, P95, P90, P50
                                    if (!label || !['P99.9', 'P99', 'P95', 'P90', 'P50'].includes(label)) return;
                                    
                                    const point = meta.data[dataIndex];
                                    if (!point || !point.x || !point.y) return;
                                    
                                    const x = point.x;
                                    const y = point.y;
                                    
                                    // Draw label above the point
                                    ctx.save();
                                    ctx.font = '11px Arial';
                                    ctx.fillStyle = dataset.borderColor || '#3b82f6';
                                    ctx.textAlign = 'center';
                                    ctx.textBaseline = 'bottom';
                                    
                                    // Draw background rectangle for better visibility
                                    const textWidth = ctx.measureText(label).width;
                                    const padding = 4;
                                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                                    ctx.fillRect(x - textWidth/2 - padding, y - 20, textWidth + padding * 2, 14);
                                    
                                    // Draw text
                                    ctx.fillStyle = dataset.borderColor || '#3b82f6';
                                    ctx.fillText(label, x, y - 6);
                                    ctx.restore();
                                });
                            });
                        }
                    } : {})
                },
                scales: {
                    x: {
                        type: useScatterFormat ? 'linear' : 'linear',
                        title: {
                            display: false
                        },
                        // Apply zoom range if zoom or zoom slider is enabled and zoom range is set
                        min: (panel.options?.timeSeries?.zoom || panel.options?.timeSeries?.zoomSlider) && panel._zoomRange && panel._zoomRange.min !== null ? panel._zoomRange.min : undefined,
                        max: (panel.options?.timeSeries?.zoom || panel.options?.timeSeries?.zoomSlider) && panel._zoomRange && panel._zoomRange.max !== null ? panel._zoomRange.max : undefined,
                        ticks: {
                            callback: function(value, index, ticks) {
                                // If sorting is enabled, x values are sequential indices (0, 1, 2, ...)
                                if (panel._sortEnabled) {
                                    // Show index number for sorted view
                                    return Math.round(value);
                                }
                                
                                // Otherwise, treat as timestamp
                                // Ensure value is treated as timestamp (Chart.js may pass as number)
                                const timestamp = typeof value === 'number' ? value : parseFloat(value);
                                
                                // Convert timestamp to UTC format
                                const date = new Date(timestamp);
                                if (isNaN(date.getTime())) {
                                    console.warn('Invalid timestamp in x-axis tick:', value);
                                    return '';
                                }
                                
                                // Format using UTC methods to display in UTC timezone
                                const hours = String(date.getUTCHours()).padStart(2, '0');
                                const minutes = String(date.getUTCMinutes()).padStart(2, '0');
                                const timeStr = `${hours}:${minutes}`;
                                
                                // Format based on time range using UTC
                                if (ticks && ticks.length > 0) {
                                    const range = ticks[ticks.length - 1].value - ticks[0].value;
                                    const rangeHours = range / (1000 * 60 * 60);
                                    const rangeDays = range / (1000 * 60 * 60 * 24);
                                    
                                    if (rangeHours < 24) {
                                        // Same day - just show time in UTC
                                        return timeStr;
                                    } else if (rangeDays < 7) {
                                        // Less than a week - show date and time in UTC
                                        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                                        const day = String(date.getUTCDate()).padStart(2, '0');
                                        return `${month}/${day} ${timeStr}`;
                                    } else {
                                        // More than a week - show date only in UTC
                                        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                                        const day = String(date.getUTCDate()).padStart(2, '0');
                                        const year = date.getUTCFullYear().toString().slice(-2);
                                        return `${month}/${day}/${year}`;
                                    }
                                }
                                return timeStr;
                            },
                            maxRotation: 0,
                            minRotation: 0,
                            font: {
                                size: 12
                            }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: panel.fieldConfig?.defaults?.unit || ''
                        },
                        beginAtZero: panel.fieldConfig?.defaults?.axisSoftMin !== undefined ? false : true,
                        ticks: {
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
            };
            
            // Apply field config overrides (colors, etc.)
            this.applyFieldConfigToChart(config, panel);
            
            // Ensure the chart tab is visible before creating Chart.js instance
            // Add the active class if tabs are enabled to override CSS display: none !important
            if (showTabs && !showStatsTabByDefault) {
                chartContent.classList.add('genie-dashboard-active');
            }
            chartContent.style.display = 'block';
            chartContent.style.visibility = 'visible';
            
            // Clean up old legend if it exists
            const oldLegend = chartContent.querySelector('.genie-legend-list-container');
            if (oldLegend) {
                oldLegend.remove();
            }
            
            // Check for tooltip legend before cleanup
            const panelElementForCleanup = container.closest('.genie-dashboard-panel');
            const tooltipContainersBeforeCleanup = panelElementForCleanup ? panelElementForCleanup.querySelectorAll('.genie-legend-tooltip-container') : [];
            const tooltipPopupsBeforeCleanup = panelElementForCleanup ? panelElementForCleanup.querySelectorAll('.genie-legend-tooltip-popup') : [];
            console.log(`[TooltipLegend] Before chart cleanup - Found ${tooltipContainersBeforeCleanup.length} tooltip container(s), ${tooltipPopupsBeforeCleanup.length} popup(s)`);
            
            // Clean up old tooltip legend containers before destroying chart
            if (panelElementForCleanup) {
                tooltipContainersBeforeCleanup.forEach(container => {
                    console.log(`[TooltipLegend] Removing old tooltip container during chart cleanup`);
                    container.remove();
                });
                tooltipPopupsBeforeCleanup.forEach(popup => {
                    console.log(`[TooltipLegend] Removing old tooltip popup during chart cleanup`);
                    popup.remove();
                });
            }
            
            // Clean up old chart and event listeners before creating new chart
            if (currentChart) {
                // Remove old event listeners if they exist
                try {
                    if (currentChart._globalMouseMoveHandler) {
                        document.removeEventListener('mousemove', currentChart._globalMouseMoveHandler, true);
                    }
                    if (currentChart._clickHandler) {
                        document.removeEventListener('click', currentChart._clickHandler, true);
                    }
                    // Remove canvas-level listeners if stored
                    if (currentChart._mousemoveHandler && canvas) {
                        canvas.removeEventListener('mousemove', currentChart._mousemoveHandler);
                    }
                    if (currentChart._mouseleaveHandler && canvas) {
                        canvas.removeEventListener('mouseleave', currentChart._mouseleaveHandler);
                    }
                    if (currentChart._mouseoutHandler && canvas) {
                        canvas.removeEventListener('mouseout', currentChart._mouseoutHandler);
                    }
                    if (currentChart._chartContentMouseLeaveHandler && chartContent) {
                        chartContent.removeEventListener('mouseleave', currentChart._chartContentMouseLeaveHandler);
                    }
                    // Remove zoom handlers if they exist
                    if (currentChart._zoomWheelHandler && canvas) {
                        canvas.removeEventListener('wheel', currentChart._zoomWheelHandler);
                    }
                    if (currentChart._zoomMouseDownHandler && canvas) {
                        canvas.removeEventListener('mousedown', currentChart._zoomMouseDownHandler);
                    }
                    if (currentChart._zoomMouseMoveHandler) {
                        document.removeEventListener('mousemove', currentChart._zoomMouseMoveHandler);
                    }
                    if (currentChart._zoomMouseUpHandler) {
                        document.removeEventListener('mouseup', currentChart._zoomMouseUpHandler);
                    }
                    if (currentChart._zoomDoubleClickHandler && canvas) {
                        canvas.removeEventListener('dblclick', currentChart._zoomDoubleClickHandler);
                    }
                } catch (e) {
                    // Ignore errors during cleanup
                }
                // Remove old tooltip container if it exists
                const oldTooltip = document.getElementById(`${this.instanceId}-chartjs-tooltip-${panel.id}`);
                if (oldTooltip) {
                    oldTooltip.remove();
                }
                currentChart.destroy();
                
                // Check for tooltip legend after chart destruction
                const tooltipContainersAfterDestroy = panelElementForCleanup ? panelElementForCleanup.querySelectorAll('.genie-legend-tooltip-container') : [];
                const tooltipPopupsAfterDestroy = panelElementForCleanup ? panelElementForCleanup.querySelectorAll('.genie-legend-tooltip-popup') : [];
                console.log(`[TooltipLegend] After chart destroy - Found ${tooltipContainersAfterDestroy.length} tooltip container(s), ${tooltipPopupsAfterDestroy.length} popup(s)`);
            }
            
            const newChart = new Chart(canvas, config);
            
            // Check for tooltip legend after new chart creation (before legend is created)
            const tooltipContainersAfterNewChart = panelElementForCleanup ? panelElementForCleanup.querySelectorAll('.genie-legend-tooltip-container') : [];
            const tooltipPopupsAfterNewChart = panelElementForCleanup ? panelElementForCleanup.querySelectorAll('.genie-legend-tooltip-popup') : [];
            console.log(`[TooltipLegend] After new chart created - Found ${tooltipContainersAfterNewChart.length} tooltip container(s), ${tooltipPopupsAfterNewChart.length} popup(s) (before legend creation)`);
            currentChart = newChart;
            this.charts[panel.id] = newChart;
            
            // Check if zoom features should be enabled
            const showZoomSlider = panel.options?.timeSeries?.zoomSlider === true;
            const showZoom = panel.options?.timeSeries?.zoom === true;
            
            // Initialize zoom range state if any zoom feature is enabled
            if ((showZoomSlider || showZoom) && !panel._zoomRange) {
                panel._zoomRange = { min: null, max: null }; // null means show all data
            }
            
            // Set up zoom/pan interactions if zoom is enabled
            if (showZoom && canvas && newChart) {
                // Initialize zoom state
                if (!panel._zoomState) {
                    panel._zoomState = {
                        min: null,
                        max: null,
                        isPanning: false,
                        panStartX: null,
                        panStartMin: null,
                        panStartMax: null
                    };
                }
                
                // Get full data range for zoom limits
                const timestampSet = new Set();
                if (chartData && chartData.datasets) {
                    chartData.datasets.forEach(dataset => {
                        if (dataset.data && Array.isArray(dataset.data)) {
                            dataset.data.forEach(point => {
                                if (point && typeof point === 'object' && point.x !== undefined) {
                                    timestampSet.add(point.x);
                                } else if (Array.isArray(point) && point.length >= 2) {
                                    timestampSet.add(point[0]);
                                }
                            });
                        }
                    });
                }
                const allTimestamps = Array.from(timestampSet).sort((a, b) => a - b);
                const fullMinTime = allTimestamps.length > 0 ? Math.min(...allTimestamps) : null;
                const fullMaxTime = allTimestamps.length > 0 ? Math.max(...allTimestamps) : null;
                
                // Store full range on panel for zoom operations
                panel._fullTimeRange = { min: fullMinTime, max: fullMaxTime };
                
                // Mouse wheel zoom
                const handleWheel = (e) => {
                    if (!newChart || !newChart.chartArea || !fullMinTime || !fullMaxTime) return;
                    
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const rect = canvas.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const chartArea = newChart.chartArea;
                    
                    // Only zoom if mouse is over chart area
                    if (x < chartArea.left || x > chartArea.right) return;
                    
                    // Get current zoom range or use full range
                    let currentMin = panel._zoomState.min !== null ? panel._zoomState.min : fullMinTime;
                    let currentMax = panel._zoomState.max !== null ? panel._zoomState.max : fullMaxTime;
                    
                    // Convert mouse position to timestamp
                    const xScale = newChart.scales.x;
                    const pixelRatio = (x - chartArea.left) / (chartArea.right - chartArea.left);
                    const mouseTime = currentMin + (currentMax - currentMin) * pixelRatio;
                    
                    // Zoom factor (positive = zoom in, negative = zoom out)
                    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
                    const zoomLimit = 0.01; // Minimum 1% of full range
                    
                    // Calculate new range centered on mouse position
                    const currentRange = currentMax - currentMin;
                    const newRange = currentRange * zoomFactor;
                    
                    // Enforce min/max limits
                    if (newRange < (fullMaxTime - fullMinTime) * zoomLimit) return;
                    if (newRange > (fullMaxTime - fullMinTime) * 1.1) {
                        // Reset to full range if zoomed out too far
                        currentMin = fullMinTime;
                        currentMax = fullMaxTime;
                    } else {
                        // Center zoom on mouse position
                        const newMin = mouseTime - (mouseTime - currentMin) * zoomFactor;
                        const newMax = mouseTime + (currentMax - mouseTime) * zoomFactor;
                        
                        // Clamp to full range
                        currentMin = Math.max(fullMinTime, newMin);
                        currentMax = Math.min(fullMaxTime, newMax);
                    }
                    
                    // Update zoom state
                    panel._zoomState.min = currentMin;
                    panel._zoomState.max = currentMax;
                    panel._zoomRange = { min: currentMin, max: currentMax };
                    
                    // Update chart
                    if (newChart.scales && newChart.scales.x) {
                        newChart.scales.x.options.min = currentMin;
                        newChart.scales.x.options.max = currentMax;
                        newChart.update('none');
                    }
                    
                    // Re-render stats table if stats tab is active (to apply zoom filter)
                    const statsTab = container.querySelector('.genie-dashboard-tab')?.textContent?.includes('🔢') ? 
                        Array.from(container.querySelectorAll('.genie-dashboard-tab')).find(tab => tab.textContent.includes('🔢')) : null;
                    const statsContent = container.querySelector(`#${this.instanceId}-stats-tab-${panel.id}`);
                    if (statsTab && statsTab.classList.contains('genie-dashboard-active') && statsContent) {
                        const compareDropdown = container.closest('.genie-dashboard-panel')?.querySelector('.genie-dashboard-compare-dropdown');
                        const currentCompareValue = compareDropdown && compareDropdown.value !== 'none' ? compareDropdown.value : null;
                        const isTransposed = panel.statsTable?.transpose || panel.options?.statsTable?.transpose || panel.transpose || false;
                        this.renderStatsTable(panel, currentDataArray, statsContent, panelStats, previousDataArray, isTransposed, currentCompareValue);
                    }
                };
                
                // Mouse drag pan
                const handleMouseDown = (e) => {
                    if (!newChart || !newChart.chartArea) return;
                    
                    const rect = canvas.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const chartArea = newChart.chartArea;
                    
                    // Only start panning if mouse is over chart area
                    if (x >= chartArea.left && x <= chartArea.right) {
                        panel._zoomState.isPanning = true;
                        panel._zoomState.panStartX = x;
                        
                        // Get current zoom range
                        let currentMin = panel._zoomState.min !== null ? panel._zoomState.min : fullMinTime;
                        let currentMax = panel._zoomState.max !== null ? panel._zoomState.max : fullMaxTime;
                        panel._zoomState.panStartMin = currentMin;
                        panel._zoomState.panStartMax = currentMax;
                        
                        canvas.style.cursor = 'grabbing';
                    }
                };
                
                const handleMouseMove = (e) => {
                    if (!panel._zoomState.isPanning || !newChart || !newChart.chartArea) return;
                    
                    const rect = canvas.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const chartArea = newChart.chartArea;
                    
                    // Calculate pan distance in pixels
                    const deltaX = x - panel._zoomState.panStartX;
                    const pixelToTimeRatio = (panel._zoomState.panStartMax - panel._zoomState.panStartMin) / (chartArea.right - chartArea.left);
                    
                    // Convert pixel delta to time delta
                    const timeDelta = -deltaX * pixelToTimeRatio; // Negative because we pan in opposite direction
                    
                    // Calculate new range
                    let newMin = panel._zoomState.panStartMin + timeDelta;
                    let newMax = panel._zoomState.panStartMax + timeDelta;
                    
                    // Clamp to full range
                    if (newMin < fullMinTime) {
                        const offset = fullMinTime - newMin;
                        newMin = fullMinTime;
                        newMax -= offset;
                    }
                    if (newMax > fullMaxTime) {
                        const offset = newMax - fullMaxTime;
                        newMax = fullMaxTime;
                        newMin += offset;
                    }
                    
                    // Update zoom state
                    panel._zoomState.min = newMin;
                    panel._zoomState.max = newMax;
                    panel._zoomRange = { min: newMin, max: newMax };
                    
                    // Update chart
                    if (newChart.scales && newChart.scales.x) {
                        newChart.scales.x.options.min = newMin;
                        newChart.scales.x.options.max = newMax;
                        newChart.update('none');
                    }
                    
                    // Re-render stats table if stats tab is active (to apply zoom filter)
                    const statsTab = container.querySelector('.genie-dashboard-tab')?.textContent?.includes('🔢') ? 
                        Array.from(container.querySelectorAll('.genie-dashboard-tab')).find(tab => tab.textContent.includes('🔢')) : null;
                    const statsContent = container.querySelector(`#${this.instanceId}-stats-tab-${panel.id}`);
                    if (statsTab && statsTab.classList.contains('genie-dashboard-active') && statsContent) {
                        const compareDropdown = container.closest('.genie-dashboard-panel')?.querySelector('.genie-dashboard-compare-dropdown');
                        const currentCompareValue = compareDropdown && compareDropdown.value !== 'none' ? compareDropdown.value : null;
                        const isTransposed = panel.statsTable?.transpose || panel.options?.statsTable?.transpose || panel.transpose || false;
                        this.renderStatsTable(panel, currentDataArray, statsContent, panelStats, previousDataArray, isTransposed, currentCompareValue);
                    }
                };
                
                const handleMouseUp = () => {
                    if (panel._zoomState.isPanning) {
                        panel._zoomState.isPanning = false;
                        canvas.style.cursor = 'default';
                    }
                };
                
                // Double-click to reset zoom
                const handleDoubleClick = (e) => {
                    panel._zoomState.min = null;
                    panel._zoomState.max = null;
                    panel._zoomRange = { min: null, max: null };
                    
                    if (newChart.scales && newChart.scales.x) {
                        newChart.scales.x.options.min = undefined;
                        newChart.scales.x.options.max = undefined;
                        newChart.update('none');
                    }
                    
                    // Re-render stats table if stats tab is active (to remove zoom filter)
                    const statsTab = container.querySelector('.genie-dashboard-tab')?.textContent?.includes('🔢') ? 
                        Array.from(container.querySelectorAll('.genie-dashboard-tab')).find(tab => tab.textContent.includes('🔢')) : null;
                    const statsContent = container.querySelector(`#${this.instanceId}-stats-tab-${panel.id}`);
                    if (statsTab && statsTab.classList.contains('genie-dashboard-active') && statsContent) {
                        const compareDropdown = container.closest('.genie-dashboard-panel')?.querySelector('.genie-dashboard-compare-dropdown');
                        const currentCompareValue = compareDropdown && compareDropdown.value !== 'none' ? compareDropdown.value : null;
                        const isTransposed = panel.statsTable?.transpose || panel.options?.statsTable?.transpose || panel.transpose || false;
                        this.renderStatsTable(panel, currentDataArray, statsContent, panelStats, previousDataArray, isTransposed, currentCompareValue);
                    }
                };
                
                // Add event listeners
                canvas.addEventListener('wheel', handleWheel, { passive: false });
                canvas.addEventListener('mousedown', handleMouseDown);
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
                canvas.addEventListener('dblclick', handleDoubleClick);
                
                // Store handlers for cleanup
                newChart._zoomWheelHandler = handleWheel;
                newChart._zoomMouseDownHandler = handleMouseDown;
                newChart._zoomMouseMoveHandler = handleMouseMove;
                newChart._zoomMouseUpHandler = handleMouseUp;
                newChart._zoomDoubleClickHandler = handleDoubleClick;
                
                // Update cursor style
                canvas.style.cursor = 'grab';
            }
            
            // Create zoom slider if enabled (positioned below toolbar)
            // Declare sliderContainer in outer scope so it's accessible in updateAllHeights
            let sliderContainer = null;
            
            // Create slider container early if zoom slider is enabled (before chart is created)
            if (showZoomSlider) {
                const panelElement = container.closest('.genie-dashboard-panel');
                if (panelElement) {
                    // Remove old slider if exists
                    const oldSlider = panelElement.querySelector('.genie-dashboard-zoom-slider-container');
                    if (oldSlider) {
                        oldSlider.remove();
                    }
                    
                    // Create slider container early
                    // Container height includes: labels (18px) + slider track (2px) = 20px total
                    // Always hide by default - will be shown only when chart tab is active
                    sliderContainer = document.createElement('div');
                    sliderContainer.className = 'genie-dashboard-zoom-slider-container';
                    sliderContainer.style.cssText = `
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 20px;
                        padding: 0;
                        z-index: 10;
                        display: none;
                        flex-direction: column;
                        align-items: center;
                        justify-content: flex-end;
                        background: transparent;
                        pointer-events: auto;
                        visibility: hidden;
                    `.replace(/\s+/g, ' ').trim();
                    
                    // Insert into panelContent so it's positioned relative to panelContent's top edge
                    const panelContent = panelElement.querySelector('.genie-dashboard-panel-content');
                    if (panelContent) {
                        panelContent.appendChild(sliderContainer);
                    } else {
                        panelElement.appendChild(sliderContainer);
                    }
                    console.log(`[Panel ${panel.id}] Slider container created early and appended to panelContent`);
                }
            }
            
            if (showZoomSlider && chartData && chartData.datasets && chartData.datasets.length > 0) {
                // Extract all timestamps from chartData to get full range
                const timestampSet = new Set();
                chartData.datasets.forEach(dataset => {
                    if (dataset.data && Array.isArray(dataset.data)) {
                        dataset.data.forEach(point => {
                            if (point && typeof point === 'object' && point.x !== undefined) {
                                timestampSet.add(point.x);
                            } else if (Array.isArray(point) && point.length >= 2) {
                                timestampSet.add(point[0]);
                            }
                        });
                    }
                });
                const allTimestamps = Array.from(timestampSet).sort((a, b) => a - b);
                
                if (allTimestamps.length > 0) {
                    const minTime = Math.min(...allTimestamps);
                    const maxTime = Math.max(...allTimestamps);
                    
                    // Use existing sliderContainer if it was created early, otherwise create it
                    // Container height includes: labels (18px) + slider track (2px) = 20px total
                    if (!sliderContainer) {
                        const panelElement = container.closest('.genie-dashboard-panel');
                        if (panelElement) {
                            // Always hide by default - will be shown only when chart tab is active
                            sliderContainer = document.createElement('div');
                            sliderContainer.className = 'genie-dashboard-zoom-slider-container';
                            sliderContainer.style.cssText = `
                                position: absolute;
                                top: 0;
                                left: 0;
                                right: 0;
                                height: 20px;
                                padding: 0;
                                z-index: 10;
                                display: none;
                                flex-direction: column;
                                align-items: center;
                                justify-content: flex-end;
                                background: transparent;
                                pointer-events: auto;
                                visibility: hidden;
                            `.replace(/\s+/g, ' ').trim();
                            
                            const panelContent = panelElement.querySelector('.genie-dashboard-panel-content');
                            if (panelContent) {
                                panelContent.appendChild(sliderContainer);
                            } else {
                                panelElement.appendChild(sliderContainer);
                            }
                        }
                    }
                    
                    // Create the range slider
                    const slider = document.createElement('input');
                    slider.type = 'range';
                    slider.className = 'genie-dashboard-zoom-slider';
                    slider.min = '0';
                    slider.max = '100';
                    slider.value = '0';
                    slider.style.cssText = `
                        width: 100%;
                        height: 4px;
                        -webkit-appearance: none;
                        appearance: none;
                        background: #e5e7eb;
                        outline: none;
                        border-radius: 2px;
                        position: relative;
                    `.replace(/\s+/g, ' ').trim();
                    
                    // Create slider track styling
                    // Position thumbs at the top of the bar
                    const sliderStyle = document.createElement('style');
                    sliderStyle.textContent = `
                        .genie-dashboard-zoom-slider-min::-webkit-slider-thumb,
                        .genie-dashboard-zoom-slider-max::-webkit-slider-thumb {
                            -webkit-appearance: none;
                            appearance: none;
                            width: 14px;
                            height: 14px;
                            background: #3b82f6;
                            cursor: pointer;
                            border-radius: 50%;
                            border: 2px solid #ffffff;
                            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                            margin-top: -6px; /* Center thumb on 2px track: track center (1px) - thumb radius (7px) = -6px */
                        }
                        .genie-dashboard-zoom-slider-min::-moz-range-thumb,
                        .genie-dashboard-zoom-slider-max::-moz-range-thumb {
                            width: 14px;
                            height: 14px;
                            background: #3b82f6;
                            cursor: pointer;
                            border-radius: 50%;
                            border: 2px solid #ffffff;
                            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                            border: none; /* Remove default border for Firefox */
                            margin-top: -6px; /* Center thumb on 2px track: track center (1px) - thumb radius (7px) = -6px */
                        }
                        .genie-dashboard-zoom-slider-min::-webkit-slider-runnable-track,
                        .genie-dashboard-zoom-slider-max::-webkit-slider-runnable-track {
                            width: 100%;
                            height: 2px;
                            background: transparent;
                            border-radius: 1px;
                        }
                        .genie-dashboard-zoom-slider-min::-moz-range-track,
                        .genie-dashboard-zoom-slider-max::-moz-range-track {
                            width: 100%;
                            height: 2px;
                            background: transparent;
                            border-radius: 1px;
                        }
                    `;
                    if (!document.head.querySelector(`#${this.getInstanceId('zoom-slider-styles')}`)) {
                        sliderStyle.id = this.getInstanceId('zoom-slider-styles');
                        document.head.appendChild(sliderStyle);
                    }
                    
                    // Create dual range slider using two inputs
                    // Align slider to chart borders (left and right edges)
                    // Get chart area to align with chart's left/right borders
                    const sliderWrapper = document.createElement('div');
                    sliderWrapper.className = 'genie-dashboard-zoom-slider-wrapper';
                    sliderWrapper.style.cssText = `
                        position: relative;
                        width: 100%;
                        height: 2px;
                        margin: 0;
                        padding: 0;
                    `.replace(/\s+/g, ' ').trim();
                    
                    // Create two sliders for range selection
                    // These will be aligned to chart borders (left and right edges)
                    // Positioned so thumbs sit on top of the track bar
                    // Use different z-index values so both can be clicked
                    const sliderMin = document.createElement('input');
                    sliderMin.type = 'range';
                    sliderMin.className = 'genie-dashboard-zoom-slider-min';
                    sliderMin.min = '0';
                    sliderMin.max = '100';
                    sliderMin.value = '0';
                    sliderMin.step = '0.1';
                    sliderMin.style.cssText = `
                        position: absolute;
                        left: 0;
                        top: -6px;
                        width: 100%;
                        height: 14px;
                        -webkit-appearance: none;
                        appearance: none;
                        background: transparent;
                        outline: none;
                        z-index: 3;
                        pointer-events: auto;
                        margin: 0;
                        padding: 0;
                    `.replace(/\s+/g, ' ').trim();
                    
                    const sliderMax = document.createElement('input');
                    sliderMax.type = 'range';
                    sliderMax.className = 'genie-dashboard-zoom-slider-max';
                    sliderMax.min = '0';
                    sliderMax.max = '100';
                    sliderMax.value = '100';
                    sliderMax.step = '0.1';
                    sliderMax.style.cssText = `
                        position: absolute;
                        left: 0;
                        top: -6px;
                        width: 100%;
                        height: 14px;
                        -webkit-appearance: none;
                        appearance: none;
                        background: transparent;
                        outline: none;
                        z-index: 4;
                        pointer-events: auto;
                        margin: 0;
                        padding: 0;
                    `.replace(/\s+/g, ' ').trim();
                    
                    // Create track background (full width, will be aligned with chart borders)
                    const trackBg = document.createElement('div');
                    trackBg.style.cssText = `
                        position: absolute;
                        left: 0;
                        top: 50%;
                        transform: translateY(-50%);
                        width: 100%;
                        height: 2px;
                        background: #e5e7eb;
                        border-radius: 1px;
                        z-index: 1;
                        margin: 0;
                        padding: 0;
                        cursor: pointer;
                    `.replace(/\s+/g, ' ').trim();
                    
                    // Create active range highlight
                    const activeRange = document.createElement('div');
                    activeRange.className = 'genie-dashboard-zoom-slider-active';
                    activeRange.style.cssText = `
                        position: absolute;
                        left: 0%;
                        width: 100%;
                        height: 2px;
                        background: #3b82f6;
                        border-radius: 1px;
                        z-index: 1;
                        pointer-events: none;
                        margin: 0;
                        padding: 0;
                    `.replace(/\s+/g, ' ').trim();
                    
                    // Create time labels container at top of slider container
                    const timeLabelsContainer = document.createElement('div');
                    timeLabelsContainer.className = 'genie-dashboard-zoom-slider-labels';
                    timeLabelsContainer.style.cssText = `
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 16px;
                        margin-bottom: 2px;
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        font-size: 10px;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                        color: #666;
                        pointer-events: none;
                        z-index: 2;
                    `.replace(/\s+/g, ' ').trim();
                    
                    // Helper function to format timestamp (same as chart x-axis)
                    const formatTimeLabel = (timestamp) => {
                        const date = new Date(timestamp);
                        if (isNaN(date.getTime())) {
                            return '';
                        }
                        
                        // Format using UTC methods (same as chart)
                        const hours = String(date.getUTCHours()).padStart(2, '0');
                        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
                        const timeStr = `${hours}:${minutes}`;
                        
                        // Format based on time range using UTC (same logic as chart)
                        const timeRange = maxTime - minTime;
                        const rangeHours = timeRange / (1000 * 60 * 60);
                        const rangeDays = timeRange / (1000 * 60 * 60 * 24);
                        
                        if (rangeHours < 24) {
                            // Same day - just show time in UTC
                            return timeStr;
                        } else if (rangeDays < 7) {
                            // Less than a week - show date and time in UTC
                            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                            const day = String(date.getUTCDate()).padStart(2, '0');
                            return `${month}/${day} ${timeStr}`;
                        } else {
                            // More than a week - show date only in UTC
                            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                            const day = String(date.getUTCDate()).padStart(2, '0');
                            const year = date.getUTCFullYear().toString().slice(-2);
                            return `${month}/${day}/${year}`;
                        }
                    };
                    
                    // Create time labels at start, middle, and end
                    const createTimeLabels = () => {
                        // Clear existing labels
                        timeLabelsContainer.innerHTML = '';
                        
                        // Calculate number of labels based on available width
                        // Aim for ~3-5 labels depending on available space
                        const numLabels = 5;
                        const labels = [];
                        
                        for (let i = 0; i < numLabels; i++) {
                            const ratio = i / (numLabels - 1); // 0 to 1
                            const timestamp = minTime + (ratio * (maxTime - minTime));
                            const label = formatTimeLabel(timestamp);
                            
                            const labelElement = document.createElement('span');
                            labelElement.textContent = label;
                            labelElement.style.cssText = `
                                display: inline-block;
                                white-space: nowrap;
                                ${i === 0 ? 'text-align: left;' : i === numLabels - 1 ? 'text-align: right;' : 'text-align: center;'}
                            `.replace(/\s+/g, ' ').trim();
                            
                            labels.push(labelElement);
                        }
                        
                        // Add labels to container with proper spacing
                        labels.forEach((labelEl, index) => {
                            timeLabelsContainer.appendChild(labelEl);
                        });
                    };
                    
                    // Create initial labels
                    createTimeLabels();
                    
                    // Use time range text from header (created in renderPanel)
                    const timeRangeText = panel._timeRangeTextElement;
                    
                    // Helper function to format time range text
                    const formatTimeRangeText = (startTime, endTime) => {
                        if (!startTime || !endTime) return '';
                        
                        const startDate = new Date(startTime);
                        const endDate = new Date(endTime);
                        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                            return '';
                        }
                        
                        // Format start time
                        const startHours = String(startDate.getUTCHours()).padStart(2, '0');
                        const startMinutes = String(startDate.getUTCMinutes()).padStart(2, '0');
                        const startMonth = String(startDate.getUTCMonth() + 1).padStart(2, '0');
                        const startDay = String(startDate.getUTCDate()).padStart(2, '0');
                        
                        // Format end time
                        const endHours = String(endDate.getUTCHours()).padStart(2, '0');
                        const endMinutes = String(endDate.getUTCMinutes()).padStart(2, '0');
                        const endMonth = String(endDate.getUTCMonth() + 1).padStart(2, '0');
                        const endDay = String(endDate.getUTCDate()).padStart(2, '0');
                        
                        // Check if same day
                        const isSameDay = startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
                                         startDate.getUTCMonth() === endDate.getUTCMonth() &&
                                         startDate.getUTCDate() === endDate.getUTCDate();
                        
                        if (isSameDay) {
                            // Same day: show date once, then time range
                            return `${startMonth}/${startDay} ${startHours}:${startMinutes} - ${endHours}:${endMinutes}`;
                        } else {
                            // Different days: show full date and time for both
                            return `${startMonth}/${startDay} ${startHours}:${startMinutes} - ${endMonth}/${endDay} ${endHours}:${endMinutes}`;
                        }
                    };
                    
                    // Function to update time range text
                    const updateTimeRangeText = () => {
                        if (!timeRangeText) return; // Safety check
                        if (panel._zoomRange && panel._zoomRange.min !== null && panel._zoomRange.max !== null) {
                            const rangeText = formatTimeRangeText(panel._zoomRange.min, panel._zoomRange.max);
                            timeRangeText.textContent = rangeText;
                        } else {
                            // Show full range when not zoomed
                            const rangeText = formatTimeRangeText(minTime, maxTime);
                            timeRangeText.textContent = rangeText || 'Full range';
                        }
                    };
                    
                    // Initialize time range text
                    updateTimeRangeText();
                    
                    // Add track elements to sliderWrapper (labels are separate, appended to container)
                    sliderWrapper.appendChild(trackBg);
                    sliderWrapper.appendChild(activeRange);
                    sliderWrapper.appendChild(sliderMin);
                    sliderWrapper.appendChild(sliderMax);
                    
                    // Append both labels and wrapper to sliderContainer
                    // Labels at top, wrapper at bottom (using flexbox justify-content: flex-end)
                    if (sliderContainer) {
                        sliderContainer.appendChild(timeLabelsContainer);
                        sliderContainer.appendChild(sliderWrapper);
                        console.log(`[Panel ${panel.id}] Slider labels and wrapper appended to slider container`);
                    }
                    
                    // Note: timeRangeText is now in the header (next to panel title), not in sliderContainer
                    
                    // Update active range highlight based on slider values
                    const updateActiveRange = () => {
                        const minVal = parseFloat(sliderMin.value);
                        const maxVal = parseFloat(sliderMax.value);
                        const left = Math.min(minVal, maxVal);
                        const width = Math.abs(maxVal - minVal);
                        activeRange.style.left = left + '%';
                        activeRange.style.width = width + '%';
                    };
                    
                    // Initialize slider values from zoom range if set
                    if (panel._zoomRange && panel._zoomRange.min !== null && panel._zoomRange.max !== null) {
                        const minRatio = ((panel._zoomRange.min - minTime) / (maxTime - minTime)) * 100;
                        const maxRatio = ((panel._zoomRange.max - minTime) / (maxTime - minTime)) * 100;
                        sliderMin.value = minRatio.toString();
                        sliderMax.value = maxRatio.toString();
                        updateActiveRange();
                    }
                    
                    // Add event listeners for slider changes
                    let isUpdating = false;
                    const updateChartZoom = () => {
                        if (isUpdating) return;
                        isUpdating = true;
                        
                        const minVal = parseFloat(sliderMin.value);
                        const maxVal = parseFloat(sliderMax.value);
                        const actualMin = Math.min(minVal, maxVal);
                        const actualMax = Math.max(minVal, maxVal);
                        
                        // Convert slider percentages to timestamps
                        const timeRange = maxTime - minTime;
                        const zoomMin = minTime + (actualMin / 100) * timeRange;
                        const zoomMax = minTime + (actualMax / 100) * timeRange;
                            
                            // Update zoom range
                            panel._zoomRange = {
                            min: zoomMin,
                            max: zoomMax
                        };
                        
                        // Update chart x-axis scale
                        if (newChart && newChart.scales && newChart.scales.x) {
                            newChart.scales.x.options.min = zoomMin;
                            newChart.scales.x.options.max = zoomMax;
                            newChart.update('none'); // Update without animation
                        }
                        
                        // Re-render stats table if stats tab is active (to apply zoom filter)
                        const statsTab = container.querySelector('.genie-dashboard-tab')?.textContent?.includes('🔢') ? 
                            Array.from(container.querySelectorAll('.genie-dashboard-tab')).find(tab => tab.textContent.includes('🔢')) : null;
                        const statsContent = container.querySelector(`#${this.instanceId}-stats-tab-${panel.id}`);
                        if (statsTab && statsTab.classList.contains('genie-dashboard-active') && statsContent) {
                            // Stats tab is active, re-render stats table with zoom filter
                            const compareDropdown = container.closest('.genie-dashboard-panel')?.querySelector('.genie-dashboard-compare-dropdown');
                            const currentCompareValue = compareDropdown && compareDropdown.value !== 'none' ? compareDropdown.value : null;
                            const isTransposed = panel.statsTable?.transpose || panel.options?.statsTable?.transpose || panel.transpose || false;
                            this.renderStatsTable(panel, currentDataArray, statsContent, panelStats, previousDataArray, isTransposed, currentCompareValue);
                        }
                        
                        updateActiveRange();
                        updateTimeRangeText(); // Update time range text when slider changes
                        isUpdating = false;
                    };
                    
                    // Both sliders are already set to pointer-events: auto in their style
                    // Add event listeners for both mousedown and input to handle interaction
                    // For dual range sliders, we need to handle clicks on the correct slider
                    const handleMinInput = () => {
                        const minVal = parseFloat(sliderMin.value);
                        const maxVal = parseFloat(sliderMax.value);
                        
                        // Ensure min doesn't exceed max
                        if (minVal > maxVal) {
                            sliderMin.value = sliderMax.value;
                        }
                        updateActiveRange();
                        updateChartZoom();
                    };
                    
                    const handleMaxInput = () => {
                        const minVal = parseFloat(sliderMin.value);
                        const maxVal = parseFloat(sliderMax.value);
                        
                        // Ensure max doesn't go below min
                        if (maxVal < minVal) {
                            sliderMax.value = sliderMin.value;
                        }
                        updateActiveRange();
                        updateChartZoom();
                    };
                    
                    // Add input event listeners
                    sliderMin.addEventListener('input', handleMinInput);
                    sliderMin.addEventListener('change', handleMinInput);
                    sliderMax.addEventListener('input', handleMaxInput);
                    sliderMax.addEventListener('change', handleMaxInput);
                    
                    // Handle mousedown to ensure correct slider is activated for dragging
                    // Problem: Both sliders overlap completely, max (z-index 4) always captures clicks
                    // Solution: Use wrapper handler in capture phase to intercept and determine correct slider
                    // Then directly update slider value and handle drag manually
                    const handleSliderMouseDown = (e) => {
                        // If clicking directly on track, use track click handler
                        if (e.target === trackBg || e.target === activeRange) {
                            handleTrackClick(e);
                            return;
                        }
                        
                        // Only handle if clicking on slider inputs
                        if (e.target !== sliderMin && e.target !== sliderMax) {
                            return;
                        }
                        
                        e.stopPropagation();
                        e.preventDefault(); // Prevent default slider behavior
                        
                        // Get click position relative to slider wrapper
                        const rect = sliderWrapper.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const sliderWidth = rect.width;
                        const clickPercent = Math.max(0, Math.min(100, (clickX / sliderWidth) * 100));
                        
                        // Get current thumb positions
                        const minVal = parseFloat(sliderMin.value);
                        const maxVal = parseFloat(sliderMax.value);
                        
                        // Calculate distance from click to each thumb
                        const distToMin = Math.abs(clickPercent - minVal);
                        const distToMax = Math.abs(clickPercent - maxVal);
                        
                        // Determine which slider should be activated
                        // Priority: closer thumb wins (with threshold to prefer one if very close)
                        let activeSlider;
                        let targetValue;
                        
                        // Use a threshold - if distances are very close, prefer based on position
                        const threshold = 5; // 5% threshold
                        if (distToMin < distToMax - threshold) {
                            // Clearly closer to min thumb
                            activeSlider = sliderMin;
                            targetValue = Math.max(0, Math.min(maxVal, clickPercent));
                            sliderMin.style.zIndex = '5';
                            sliderMax.style.zIndex = '4';
                            console.log('[Slider] Activating MIN slider, clickPercent:', clickPercent, 'minVal:', minVal, 'distToMin:', distToMin, 'distToMax:', distToMax);
                        } else if (distToMax < distToMin - threshold) {
                            // Clearly closer to max thumb
                            activeSlider = sliderMax;
                            targetValue = Math.max(minVal, Math.min(100, clickPercent));
                            sliderMax.style.zIndex = '5';
                            sliderMin.style.zIndex = '3';
                            console.log('[Slider] Activating MAX slider, clickPercent:', clickPercent, 'maxVal:', maxVal, 'distToMin:', distToMin, 'distToMax:', distToMax);
                        } else {
                            // Distances are close - use position heuristic
                            // Left half prefers min, right half prefers max
                            if (clickPercent < 50) {
                                activeSlider = sliderMin;
                                targetValue = Math.max(0, Math.min(maxVal, clickPercent));
                                sliderMin.style.zIndex = '5';
                                sliderMax.style.zIndex = '4';
                                console.log('[Slider] Activating MIN slider (left side), clickPercent:', clickPercent);
                            } else {
                                activeSlider = sliderMax;
                                targetValue = Math.max(minVal, Math.min(100, clickPercent));
                                sliderMax.style.zIndex = '5';
                                sliderMin.style.zIndex = '3';
                                console.log('[Slider] Activating MAX slider (right side), clickPercent:', clickPercent);
                            }
                        }
                        
                        // Update slider value directly
                        activeSlider.value = targetValue.toString();
                        
                        // Trigger input event to update chart
                        if (activeSlider === sliderMin) {
                            handleMinInput();
                        } else {
                            handleMaxInput();
                        }
                        
                        // Set up manual drag handling
                        let isDragging = true;
                        const currentMinVal = parseFloat(sliderMin.value);
                        const currentMaxVal = parseFloat(sliderMax.value);
                        
                        const handleMouseMove = (moveEvent) => {
                            if (!isDragging) return;
                            
                            const moveRect = sliderWrapper.getBoundingClientRect();
                            const moveX = moveEvent.clientX - moveRect.left;
                            const moveWidth = moveRect.width;
                            const movePercent = Math.max(0, Math.min(100, (moveX / moveWidth) * 100));
                            
                            if (activeSlider === sliderMin) {
                                const newValue = Math.max(0, Math.min(currentMaxVal, movePercent));
                                sliderMin.value = newValue.toString();
                                handleMinInput();
                            } else {
                                const newValue = Math.max(currentMinVal, Math.min(100, movePercent));
                                sliderMax.value = newValue.toString();
                                handleMaxInput();
                            }
                        };
                        
                        const handleMouseUpDrag = () => {
                            isDragging = false;
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUpDrag);
                            // Reset z-index
                            sliderMin.style.zIndex = '3';
                            sliderMax.style.zIndex = '4';
                        };
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUpDrag);
                    };
                    
                    // Add handler to wrapper in capture phase to catch clicks first
                    sliderWrapper.addEventListener('mousedown', handleSliderMouseDown, true);
                    
                    // Also add direct handlers to sliders (these may not fire if wrapper prevents default)
                    sliderMin.addEventListener('mousedown', (e) => {
                        e.stopPropagation();
                        sliderMin.style.zIndex = '5';
                        sliderMax.style.zIndex = '4';
                    });
                    sliderMax.addEventListener('mousedown', (e) => {
                        e.stopPropagation();
                        sliderMax.style.zIndex = '5';
                        sliderMin.style.zIndex = '3';
                    });
                    
                    // Handle clicks on track background - move nearest thumb
                    const handleTrackClick = (e) => {
                        e.stopPropagation();
                        const rect = sliderWrapper.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const sliderWidth = rect.width;
                        const clickRatio = clickX / sliderWidth;
                        const clickPercent = clickRatio * 100;
                        
                        const minVal = parseFloat(sliderMin.value);
                        const maxVal = parseFloat(sliderMax.value);
                        
                        // Determine which thumb is closer
                        const distToMin = Math.abs(clickPercent - minVal);
                        const distToMax = Math.abs(clickPercent - maxVal);
                        
                        if (distToMin < distToMax) {
                            // Move min thumb
                            const newValue = Math.max(0, Math.min(maxVal, clickPercent));
                            sliderMin.value = newValue.toString();
                            sliderMin.style.zIndex = '5';
                            sliderMax.style.zIndex = '4';
                            handleMinInput();
                        } else {
                            // Move max thumb
                            const newValue = Math.max(minVal, Math.min(100, clickPercent));
                            sliderMax.value = newValue.toString();
                            sliderMax.style.zIndex = '5';
                            sliderMin.style.zIndex = '3';
                            handleMaxInput();
                        }
                    };
                    
                    // Handle clicks on the track background to jump to that position
                    trackBg.addEventListener('mousedown', handleTrackClick);
                    
                    // Reset z-index and pointer events on mouseup
                    const handleMouseUp = () => {
                        sliderMin.style.zIndex = '3';
                        sliderMax.style.zIndex = '4';
                        sliderMin.style.pointerEvents = 'auto';
                        sliderMax.style.pointerEvents = 'auto';
                    };
                    sliderMin.addEventListener('mouseup', handleMouseUp);
                    sliderMax.addEventListener('mouseup', handleMouseUp);
                    document.addEventListener('mouseup', handleMouseUp);
                    
                    // Double-click to reset zoom
                    sliderWrapper.addEventListener('dblclick', () => {
                        sliderMin.value = '0';
                        sliderMax.value = '100';
                        panel._zoomRange = { min: null, max: null };
                        if (newChart && newChart.scales && newChart.scales.x) {
                            newChart.scales.x.options.min = undefined;
                            newChart.scales.x.options.max = undefined;
                            newChart.update('none');
                        }
                        updateActiveRange();
                        updateTimeRangeText(); // Update time range text when zoom is reset
                        
                        // Re-render stats table if stats tab is active (to remove zoom filter)
                        const statsTab = container.querySelector('.genie-dashboard-tab')?.textContent?.includes('🔢') ? 
                            Array.from(container.querySelectorAll('.genie-dashboard-tab')).find(tab => tab.textContent.includes('🔢')) : null;
                        const statsContent = container.querySelector(`#${this.instanceId}-stats-tab-${panel.id}`);
                        if (statsTab && statsTab.classList.contains('genie-dashboard-active') && statsContent) {
                            const compareDropdown = container.closest('.genie-dashboard-panel')?.querySelector('.genie-dashboard-compare-dropdown');
                            const currentCompareValue = compareDropdown && compareDropdown.value !== 'none' ? compareDropdown.value : null;
                            const isTransposed = panel.statsTable?.transpose || panel.options?.statsTable?.transpose || panel.transpose || false;
                            this.renderStatsTable(panel, currentDataArray, statsContent, panelStats, previousDataArray, isTransposed, currentCompareValue);
                        }
                    });
                    
                    // Insert slider before chart canvas, so it appears between header and chart
                    // Position will be calculated in updateAllHeights() to maintain gridPos.h
                    sliderContainer.style.position = 'absolute';
                    sliderContainer.style.left = '0';
                    sliderContainer.style.right = '0';
                    sliderContainer.style.zIndex = '10';
                    // Only show slider if chart tab is active (not stats tab)
                    const panelElement = container.closest('.genie-dashboard-panel');
                    const chartTab = panelElement?.querySelector('.genie-dashboard-tab[data-tab="chart"]');
                    const isChartTabActive = chartTab && chartTab.classList.contains('genie-dashboard-active');
                    
                    sliderContainer.style.display = isChartTabActive ? 'flex' : 'none';
                    sliderContainer.style.visibility = isChartTabActive ? 'visible' : 'hidden';
                    sliderContainer.style.pointerEvents = 'auto';
                    
                    // Insert slider container into panel, before chartContent
                    // The slider should be a direct child of the panel element, not chartContent
                    // panelElement is already declared above
                    if (panelElement) {
                        // Append slider to panelContent so it's positioned relative to panelContent's top edge
                        const panelContent = panelElement.querySelector('.genie-dashboard-panel-content');
                        if (panelContent) {
                            panelContent.appendChild(sliderContainer);
                            console.log(`[Panel ${panel.id}] Slider container appended to panelContent`);
                        } else if (chartContent && chartContent.parentNode === panelElement) {
                            // Fallback: append to chartContent if panelContent not found
                            chartContent.appendChild(sliderContainer);
                            console.warn(`[Panel ${panel.id}] PanelContent not found, appended slider to chartContent`);
                        } else {
                            // Fallback: append to panelElement
                            panelElement.appendChild(sliderContainer);
                            console.warn(`[Panel ${panel.id}] Fallback: appended slider to panelElement`);
                        }
                    } else {
                        // Fallback: append to chartContent
                        chartContent.appendChild(sliderContainer);
                        console.warn(`[Panel ${panel.id}] Could not find panel element, appended slider to chartContent`);
                    }
                    
                    // Note: slider position and chartContent margin will be set in updateAllHeights()
                    // to properly account for slider height in gridPos.h calculations
                    
                    // Position slider and align with chart borders
                    const updateSliderPosition = () => {
                        if (newChart && newChart.chartArea && canvas && sliderContainer) {
                            // Align slider track edges with chart's left and right borders
                            // Get chart area to determine left/right padding
                            const chartArea = newChart.chartArea;
                            const chartLeftOffset = chartArea.left;
                            const chartRightOffset = canvas.offsetWidth - chartArea.right;
                            
                            // Align slider track edges (not thumb centers) with chart borders
                            // The slider wrapper should start at chart left edge and end at chart right edge
                            sliderWrapper.style.width = `calc(100% - ${chartLeftOffset + chartRightOffset}px)`;
                            sliderWrapper.style.marginLeft = chartLeftOffset + 'px';
                            sliderWrapper.style.marginRight = chartRightOffset + 'px';
                            
                            // Align time labels with slider track (same alignment as slider)
                            if (timeLabelsContainer) {
                                timeLabelsContainer.style.marginLeft = chartLeftOffset + 'px';
                                timeLabelsContainer.style.marginRight = chartRightOffset + 'px';
                                timeLabelsContainer.style.width = `calc(100% - ${chartLeftOffset + chartRightOffset}px)`;
                            }
                            
                            // Note: Y position is set by systematic layout calculation, not here
                            // This function only handles horizontal alignment
                            
                            console.log(`[Panel ${panel.id}] Slider alignment:`, {
                                chartLeftOffset: chartLeftOffset,
                                chartRightOffset: chartRightOffset,
                                chartWidth: chartArea.right - chartArea.left,
                                sliderWrapperWidth: sliderWrapper.style.width,
                                sliderWrapperMarginLeft: sliderWrapper.style.marginLeft,
                                sliderWrapperMarginRight: sliderWrapper.style.marginRight
                            });
                        }
                    };
                    
                    // Initial positioning - wait for chart to render
                    setTimeout(() => {
                        updateSliderPosition();
                    }, 150);
                    
                    // Update position when chart resizes (in case chart area changes)
                    if (newChart) {
                        const resizeObserver = new ResizeObserver(() => {
                            setTimeout(updateSliderPosition, 50);
                        });
                        resizeObserver.observe(canvas);
                        // Store observer for cleanup if needed
                        newChart._zoomSliderObserver = resizeObserver;
                    }
                }
            }
            
            // Set up tooltip handlers for the new chart after a brief delay to ensure chart is ready
            setTimeout(() => {
                this.setupTooltipHandlers(canvas, newChart, chartContent, panel);
            }, 50);
            
            // SYSTEMATIC LAYOUT CALCULATION
            // Step 1: Identify all components and their order
            // Step 2: Calculate heights based on gridPos.h
            // Step 3: Calculate Y positions from top of panel
            
            const placement = panel.options?.legend?.placement || 'bottom';
            const displayMode = panel.options?.legend?.displayMode || 'list';
            const hasListLegend = (displayMode === 'list' || displayMode === 'tooltip') && panel.options?.legend?.showLegend !== false;
            console.log(`[Legend] Panel ${panel.id} - displayMode: ${displayMode}, hasListLegend: ${hasListLegend}, showLegend: ${panel.options?.legend?.showLegend}`);
            const legendTakesSpace = displayMode === 'list' && panel.options?.legend?.showLegend !== false;
            const tooltipLegendTakesSpace = displayMode === 'tooltip' && panel.options?.legend?.showLegend !== false;
            const sliderPosition = panel.options?.timeSeries?.zoomSliderPosition || 'top';
            
            // Fixed component heights (including padding/margins)
            const headerHeight = 40; // Header with title and tabs
            const bottomPadding = 8; // Panel content bottom padding
            const legendHeight = 54; // Legend height for 3 lines with scroll
            const legendSpacing = 2; // Space between chart and legend
            const tooltipLegendHeight = 20; // Tooltip legend item height (12px color box + 4px top padding + 4px bottom padding)
            // Slider container includes both labels and track: labels (18px) + track (2px) = 20px total
            const sliderContainerHeight = showZoomSlider ? 20 : 0; // Total container height (labels + track)
            const sliderSpacing = showZoomSlider ? 2 : 0; // Space around slider container (top/bottom)
            const axisLabelHeight = 40; // Chart.js bottom axis labels area
            
            // Get actual panel height from grid
            const panelDivDebug = container.closest('.genie-dashboard-panel');
            const panelContentDebug = container.closest('.genie-dashboard-panel-content');
            const rowHeightPerUnitEstimate = this.rowHeightPerUnit || 38;
            const estimatedTotalPanelHeight = gridPos.h * rowHeightPerUnitEstimate;
            let actualPanelHeight = panelDivDebug ? panelDivDebug.offsetHeight : 0;
            const totalPanelHeight = actualPanelHeight > 0 ? actualPanelHeight : estimatedTotalPanelHeight;
            
            // Calculate component heights and positions
            let currentY = 0;
            const components = [];
            
            // 1. Header (always at top)
            components.push({
                name: 'header',
                y: currentY,
                height: headerHeight
            });
            currentY += headerHeight;
            
            // 2. Top Slider (if enabled and position='top')
            if (showZoomSlider && sliderPosition === 'top') {
                // Slider container includes both labels and track, positioned at currentY + spacing
                components.push({
                    name: 'topSlider',
                    y: currentY + sliderSpacing, // Container position (includes labels + track)
                    height: sliderContainerHeight // Total container height (labels + track)
                });
                // Total space needed: spacing before + container height + spacing after
                currentY += sliderSpacing + sliderContainerHeight + sliderSpacing;
            }
            
            // 3. Top Legend (if list mode and placement='top')
            if (legendTakesSpace && placement === 'top') {
                components.push({
                    name: 'topLegend',
                    y: currentY,
                    height: legendHeight + legendSpacing
                });
                currentY += legendHeight + legendSpacing;
            }
            
            // 3a. Top Tooltip Legend (if tooltip mode - always at top)
            if (tooltipLegendTakesSpace) {
                components.push({
                    name: 'topTooltipLegend',
                    y: currentY,
                    height: tooltipLegendHeight
                });
                currentY += tooltipLegendHeight;
            }
            
            // 4. Chart Canvas (takes remaining space)
            // Calculate remaining space for chart
            let chartHeight = totalPanelHeight - currentY - bottomPadding;
            
            // Subtract bottom components
            if (legendTakesSpace && placement === 'bottom') {
                chartHeight -= (legendHeight + legendSpacing);
            }
            if (showZoomSlider && sliderPosition === 'bottom') {
                // Add extra spacing when tooltip legend is present
                const extraSpacing = tooltipLegendTakesSpace ? 8 : 0; // Increased to 8px for debugging
                chartHeight -= (extraSpacing + sliderSpacing + sliderContainerHeight + sliderSpacing);
            }
            // Chart includes axis labels in its height, so we account for that
            chartHeight -= axisLabelHeight;
            
            // Reduce chart height by 2px to leave 2px at the bottom
            chartHeight -= 2;
            
            // Ensure minimum chart height
            chartHeight = Math.max(100, chartHeight);
            
            components.push({
                name: 'chart',
                y: currentY,
                height: chartHeight + axisLabelHeight // Chart includes axis labels
            });
            currentY += chartHeight + axisLabelHeight;
            
            // 5. Bottom Legend (if list mode and placement='bottom')
            if (legendTakesSpace && placement === 'bottom') {
                components.push({
                    name: 'bottomLegend',
                    y: currentY + legendSpacing,
                    height: legendHeight
                });
                currentY += legendSpacing + legendHeight;
            }
            
            // 6. Bottom Slider (if enabled and position='bottom')
            if (showZoomSlider && sliderPosition === 'bottom') {
                // Add extra spacing when tooltip legend is present to avoid overlapping with x-axis labels
                const extraSpacing = tooltipLegendTakesSpace ? 8 : 0; // Increased to 8px for debugging
                // Slider container includes both labels and track, positioned at currentY + extra spacing
                components.push({
                    name: 'bottomSlider',
                    y: currentY + extraSpacing, // Container position (with extra spacing when tooltip legend present)
                    height: sliderContainerHeight // Total container height (labels + track)
                });
                // Total space needed: extra spacing + container height + spacing after
                currentY += extraSpacing + sliderContainerHeight + sliderSpacing;
            }
            
            // Verify total height matches
            const totalCalculatedHeight = currentY + bottomPadding;
            
            // Print detailed layout information
            console.log(`\n========== [Panel ${panel.id}] INITIAL LAYOUT CALCULATION ==========`);
            console.log(`Panel Height (from gridPos.h=${gridPos.h}): ${totalPanelHeight}px`);
            console.log(`Row Height Per Unit: ${(totalPanelHeight / gridPos.h).toFixed(2)}px`);
            console.log(`\nComponent Order and Positions:`);
            console.log(`┌─────────────────────────────────────────────────────────────┐`);
            console.log(`│ Order │ Component      │ Y Position │ Height │ Y+Height │`);
            console.log(`├─────────────────────────────────────────────────────────────┤`);
            
            components.forEach((comp, index) => {
                const yPos = comp.y.toFixed(1);
                const height = comp.height.toFixed(1);
                const yPlusHeight = (comp.y + comp.height).toFixed(1);
                const order = (index + 1).toString().padStart(2, ' ');
                const name = comp.name.padEnd(13, ' ');
                const yStr = yPos.padStart(9, ' ');
                const hStr = height.padStart(6, ' ');
                const yhStr = yPlusHeight.padStart(8, ' ');
                console.log(`│  ${order}  │ ${name} │ ${yStr} │ ${hStr} │ ${yhStr} │`);
            });
            
            console.log(`└─────────────────────────────────────────────────────────────┘`);
            console.log(`\nSummary:`);
            console.log(`  - Total Components: ${components.length}`);
            console.log(`  - Total Used Height: ${currentY}px`);
            console.log(`  - Bottom Padding: ${bottomPadding}px`);
            console.log(`  - Total: ${totalCalculatedHeight.toFixed(1)}px`);
            console.log(`  - Panel Height: ${totalPanelHeight}px`);
            console.log(`  - Difference: ${(totalPanelHeight - totalCalculatedHeight).toFixed(1)}px`);
            console.log(`\nComponent Details:`);
            components.forEach((comp, index) => {
                console.log(`  ${index + 1}. ${comp.name}:`);
                console.log(`     - Y Position (from panel top): ${comp.y}px`);
                console.log(`     - Height: ${comp.height}px`);
                console.log(`     - Bottom edge: ${comp.y + comp.height}px`);
            });
            console.log(`\nConfiguration:`);
            console.log(`  - Slider Position: ${sliderPosition}`);
            console.log(`  - Slider Enabled: ${showZoomSlider}`);
            console.log(`  - Legend Display Mode: ${displayMode}`);
            console.log(`  - Legend Placement: ${placement}`);
            console.log(`  - Legend Takes Space: ${legendTakesSpace}`);
            console.log(`=============================================================\n`);
            
            // Apply calculated positions to components
            // Find component references (reuse variables from above)
            // panelDivDebug and panelContentDebug already declared above
            
            // Apply positions using setTimeout to ensure DOM is ready
            setTimeout(() => {
                // Recalculate with actual panel height
                const actualTotalPanelHeight = panelDivDebug ? panelDivDebug.offsetHeight : totalPanelHeight;
                
                // Recalculate components with actual height
                let recalcY = 0;
                const recalcComponents = [];
                
                recalcComponents.push({ name: 'header', y: recalcY, height: headerHeight });
                recalcY += headerHeight;
                
                if (showZoomSlider && sliderPosition === 'top') {
                    // Slider container includes both labels and track
                    recalcComponents.push({ name: 'topSlider', y: recalcY + sliderSpacing, height: sliderContainerHeight });
                    // Total space needed: spacing before + container height + spacing after
                    recalcY += sliderSpacing + sliderContainerHeight + sliderSpacing;
                }
                
                if (legendTakesSpace && placement === 'top') {
                    recalcComponents.push({ name: 'topLegend', y: recalcY, height: legendHeight + legendSpacing });
                    recalcY += legendHeight + legendSpacing;
                }
                
                // Tooltip legend (always at top)
                const tooltipLegendTakesSpaceRecalc = displayMode === 'tooltip' && panel.options?.legend?.showLegend !== false;
                const tooltipLegendHeight = 20; // Tooltip legend item height
                if (tooltipLegendTakesSpaceRecalc) {
                    recalcComponents.push({ name: 'topTooltipLegend', y: recalcY, height: tooltipLegendHeight });
                    recalcY += tooltipLegendHeight;
                }
                
                let recalcChartHeight = actualTotalPanelHeight - recalcY - bottomPadding;
                if (legendTakesSpace && placement === 'bottom') {
                    recalcChartHeight -= (legendHeight + legendSpacing);
                }
                if (showZoomSlider && sliderPosition === 'bottom') {
                    // Add extra spacing when tooltip legend is present
                    const extraSpacing = tooltipLegendTakesSpaceRecalc ? 8 : 0; // Increased to 8px for debugging
                    recalcChartHeight -= (extraSpacing + sliderSpacing + sliderContainerHeight + sliderSpacing);
                }
                recalcChartHeight -= axisLabelHeight;
                
                // Reduce chart height by 2px to leave 2px at the bottom
                recalcChartHeight -= 2;
                
                recalcChartHeight = Math.max(100, recalcChartHeight);
                
                recalcComponents.push({ name: 'chart', y: recalcY, height: recalcChartHeight + axisLabelHeight });
                recalcY += recalcChartHeight + axisLabelHeight;
                
                if (legendTakesSpace && placement === 'bottom') {
                    recalcComponents.push({ name: 'bottomLegend', y: recalcY + legendSpacing, height: legendHeight });
                    recalcY += legendSpacing + legendHeight;
                }
                
                if (showZoomSlider && sliderPosition === 'bottom') {
                    // Add extra spacing when tooltip legend is present to avoid overlapping with x-axis labels
                    const extraSpacing = tooltipLegendTakesSpaceRecalc ? 8 : 0; // Increased to 8px for debugging
                    // Slider container includes both labels and track, positioned at recalcY + extra spacing
                    recalcComponents.push({ name: 'bottomSlider', y: recalcY + extraSpacing, height: sliderContainerHeight });
                    // Total space needed: extra spacing + container height + spacing after
                    recalcY += extraSpacing + sliderContainerHeight + sliderSpacing;
                }
                
                // Apply positions
                // 1. Panel content position (at top: 0, header is in normal flow above it)
                // panelContent height should exclude header since header takes up space in normal flow
                if (panelContentDebug) {
                    const headerComp = recalcComponents.find(c => c.name === 'header');
                    const headerHeight = headerComp ? headerComp.height : 40;
                    panelContentDebug.style.position = 'absolute';
                    panelContentDebug.style.top = '0px';
                    panelContentDebug.style.left = '0';
                    panelContentDebug.style.right = '0';
                    panelContentDebug.style.height = (actualTotalPanelHeight - headerHeight) + 'px';
                    panelContentDebug.style.zIndex = '1'; // Below header
                }
                
                // 2. Chart canvas height and position
                const chartComp = recalcComponents.find(c => c.name === 'chart');
                if (chartComp && canvas) {
                    // Remove debugging adjustments
                    canvas.style.height = chartComp.height + 'px';
                    canvas.style.maxHeight = chartComp.height + 'px';
                    canvas.style.minHeight = chartComp.height + 'px';
                    canvas.style.marginTop = '0px';
                    
                    // Position canvas within chartContent
                    const topSliderComp = recalcComponents.find(c => c.name === 'topSlider');
                    const topLegendComp = recalcComponents.find(c => c.name === 'topLegend');
                    let canvasTop = 0;
                    if (topSliderComp) canvasTop = topSliderComp.height;
                    if (topLegendComp) canvasTop += topLegendComp.height;
                    canvas.style.position = 'relative';
                    canvas.style.top = '0px';
                }
                
                // 3. Chart content container (positioned relative to panelContent, which is at top: 0)
                // chartContent should start at the calculated chart component Y position (relative to panel top)
                // Since panelContent is at top: 0, chartContent top = chart component Y
                if (chartContent) {
                    const chartComp = recalcComponents.find(c => c.name === 'chart');
                    const topSliderComp = recalcComponents.find(c => c.name === 'topSlider');
                    const topLegendComp = recalcComponents.find(c => c.name === 'topLegend');
                    const topTooltipLegendComp = recalcComponents.find(c => c.name === 'topTooltipLegend');
                    
                    if (chartComp) {
                        // Position chartContent at the chart component's Y position (relative to panelContent at top: 0)
                        chartContent.style.position = 'absolute';
                        chartContent.style.top = chartComp.y + 'px';
                        chartContent.style.height = chartComp.height + 'px';
                        chartContent.style.left = '0';
                        chartContent.style.right = '0';
                    }
                    
                    // Position tooltip legend if present (relative to panelContent, which is at top: 0)
                    if (topTooltipLegendComp) {
                        const tooltipLegendContainer = panelContentDebug?.querySelector('.genie-legend-tooltip-container');
                        if (tooltipLegendContainer) {
                            tooltipLegendContainer.style.position = 'absolute';
                            tooltipLegendContainer.style.top = topTooltipLegendComp.y + 'px';
                            tooltipLegendContainer.style.left = '0px';
                            tooltipLegendContainer.style.zIndex = '5';
                            tooltipLegendContainer.style.display = 'flex';
                            console.log(`[Panel ${panel.id}] Positioned tooltip legend at top: ${topTooltipLegendComp.y}px`);
                        } else {
                            console.warn(`[Panel ${panel.id}] Tooltip legend container not found when trying to position it`);
                        }
                    }
                }
                
                // 4. Slider positions
                if (showZoomSlider && sliderContainer) {
                    const topSliderComp = recalcComponents.find(c => c.name === 'topSlider');
                    const bottomSliderComp = recalcComponents.find(c => c.name === 'bottomSlider');
                    
                    if (sliderPosition === 'top' && topSliderComp) {
                        sliderContainer.style.position = 'absolute';
                        // Y position is calculated from panel top, panelContent is at top: 0, so use Y directly
                        sliderContainer.style.top = topSliderComp.y + 'px';
                        sliderContainer.style.height = sliderContainerHeight + 'px';
                    } else if (sliderPosition === 'bottom' && bottomSliderComp) {
                        sliderContainer.style.position = 'absolute';
                        // Y position is calculated from panel top, panelContent is at top: 0 (panel top)
                        // The slider Y calculation is: currentY (no spacing before, right after legend)
                        // Then currentY is incremented by: sliderContainerHeight + sliderSpacing
                        // panelContent has paddingBottom, so content area ends at: (totalPanelHeight - headerHeight) - bottomPadding
                        // Slider bottom should align with content area bottom
                        // We need to subtract the spacing after the slider + padding
                        sliderContainer.style.top = (bottomSliderComp.y - sliderSpacing - bottomPadding) + 'px';
                        sliderContainer.style.height = sliderContainerHeight + 'px';
                    }
                    sliderContainer.style.left = '0';
                    sliderContainer.style.right = '0';
                    sliderContainer.style.zIndex = '10';
                }
                
                console.log(`[Panel ${panel.id}] APPLIED POSITIONS:`, {
                    components: recalcComponents,
                    actualTotalPanelHeight: actualTotalPanelHeight
                });
            }, 100);
            
            // Also ensure the panel div itself respects gridPos.h
            // IMPORTANT: Don't force height - let grid determine it based on gridPos.h
            // We only set maxHeight to prevent overflow, and measure what grid allocated
            // Get panel div and header element references
            const panelDiv = container.closest('.genie-dashboard-panel');
            const panelContentRef = container.closest('.genie-dashboard-panel-content');
            const headerElement = panelDiv ? panelDiv.querySelector('.genie-dashboard-panel-header') : null;
            
            // Calculate heights based on gridPos.h and actual component measurements
            // Total panel height = gridPos.h * rowHeightPerUnit
            const rowHeightPerUnit = this.rowHeightPerUnit || 38;
            const calculatedTotalPanelHeight = gridPos.h * rowHeightPerUnit;
            
            // Measure actual header height (includes padding: 6px top + 6px bottom + content)
            let actualHeaderHeight = 0;
            
            function updateAllHeights() {
                // Re-measure header if not already measured
                if (actualHeaderHeight === 0 && headerElement) {
                    actualHeaderHeight = headerElement.offsetHeight || 40;
                }
                
                // Use systematic layout calculation
                // Get slider position from panel options (use outer scope variables)
                const currentSliderPosition = panel.options?.timeSeries?.zoomSliderPosition || 'top';
                const currentPlacement = panel.options?.legend?.placement || 'bottom';
                const currentDisplayMode = panel.options?.legend?.displayMode || 'list';
                const currentLegendTakesSpace = currentDisplayMode === 'list' && panel.options?.legend?.showLegend !== false;
                const currentTooltipLegendTakesSpace = currentDisplayMode === 'tooltip' && panel.options?.legend?.showLegend !== false;
                
                const headerHeight = actualHeaderHeight;
                const bottomPadding = 8;
                const legendHeight = 54;
                const legendSpacing = 2;
                const tooltipLegendHeight = 20; // Tooltip legend item height (12px color box + 4px top padding + 4px bottom padding)
                // Slider container includes both labels and track: labels (18px) + track (2px) = 20px total
                const sliderContainerHeight = showZoomSlider ? 20 : 0; // Total container height (labels + track)
                const sliderSpacing = showZoomSlider ? 2 : 0;
                const axisLabelHeight = 40;
                
                // Get actual panel height
                const actualTotalPanelHeight = panelDiv ? panelDiv.offsetHeight : calculatedTotalPanelHeight;
                const totalPanelHeight = actualTotalPanelHeight > 0 ? actualTotalPanelHeight : calculatedTotalPanelHeight;
                
                // Calculate component positions systematically
                let currentY = 0;
                const layoutComponents = [];
                
                // 1. Header
                layoutComponents.push({ name: 'header', y: currentY, height: headerHeight });
                currentY += headerHeight;
                
                // 2. Top Slider
                if (showZoomSlider && currentSliderPosition === 'top') {
                    // Slider container includes both labels and track
                    layoutComponents.push({ name: 'topSlider', y: currentY + sliderSpacing, height: sliderContainerHeight });
                    // Total space needed: spacing before + container height + spacing after
                    currentY += sliderSpacing + sliderContainerHeight + sliderSpacing;
                }
                
                // 3. Top Legend
                if (currentLegendTakesSpace && currentPlacement === 'top') {
                    layoutComponents.push({ name: 'topLegend', y: currentY, height: legendHeight + legendSpacing });
                    currentY += legendHeight + legendSpacing;
                }
                
                // 3a. Top Tooltip Legend (if tooltip mode - always at top)
                if (currentTooltipLegendTakesSpace) {
                    layoutComponents.push({ name: 'topTooltipLegend', y: currentY, height: tooltipLegendHeight });
                    currentY += tooltipLegendHeight;
                }
                
                // 4. Chart Canvas
                let chartHeight = totalPanelHeight - currentY - bottomPadding;
                if (currentLegendTakesSpace && currentPlacement === 'bottom') {
                    chartHeight -= (legendHeight + legendSpacing);
                }
                if (showZoomSlider && currentSliderPosition === 'bottom') {
                    // Add extra spacing when tooltip legend is present
                    const extraSpacing = currentTooltipLegendTakesSpace ? 8 : 0; // Increased to 8px for debugging
                    chartHeight -= (extraSpacing + sliderSpacing + sliderContainerHeight + sliderSpacing);
                }
                chartHeight -= axisLabelHeight;
                
                // Reduce chart height by 2px to leave 2px at the bottom
                chartHeight -= 2;
                
                chartHeight = Math.max(100, chartHeight);
                
                layoutComponents.push({ name: 'chart', y: currentY, height: chartHeight + axisLabelHeight });
                currentY += chartHeight + axisLabelHeight;
                
                // 5. Bottom Legend
                if (currentLegendTakesSpace && currentPlacement === 'bottom') {
                    layoutComponents.push({ name: 'bottomLegend', y: currentY + legendSpacing, height: legendHeight });
                    currentY += legendSpacing + legendHeight;
                }
                
                // 6. Bottom Slider
                if (showZoomSlider && currentSliderPosition === 'bottom') {
                    // Add extra spacing when tooltip legend is present to avoid overlapping with x-axis labels
                    const extraSpacing = currentTooltipLegendTakesSpace ? 8 : 0; // Increased to 8px for debugging
                    // Slider container includes both labels and track, positioned at currentY + extra spacing
                    layoutComponents.push({ name: 'bottomSlider', y: currentY + extraSpacing, height: sliderContainerHeight });
                    // Total space needed: extra spacing + container height + spacing after
                    currentY += extraSpacing + sliderContainerHeight + sliderSpacing;
                }
                
                // Apply calculated positions
                const chartComp = layoutComponents.find(c => c.name === 'chart');
                const canvasHeight = chartComp ? chartComp.height : Math.max(200, totalPanelHeight - headerHeight - bottomPadding);
                const chartContentHeight = totalPanelHeight - headerHeight - bottomPadding;
                const actualContentArea = chartContentHeight;
                // Calculate available content height (total panel height minus header and bottom padding)
                const availableContentHeight = totalPanelHeight - headerHeight - bottomPadding;
                // Stats content height is the same as chart content height
                const statsContentHeight = chartContentHeight;
                
                // Update canvas
                if (canvas && chartComp) {
                    canvas.style.height = chartComp.height + 'px';
                    canvas.style.maxHeight = chartComp.height + 'px';
                    canvas.style.minHeight = chartComp.height + 'px';
                    canvas.style.marginTop = '0px';
                }
                
                // Update chartContent (positioned relative to panelContent, which is at top: 0)
                // chartContent should start at the calculated chart component Y position
                if (chartContent) {
                    const chartComp = layoutComponents.find(c => c.name === 'chart');
                    if (chartComp) {
                        chartContent.style.position = 'absolute';
                        chartContent.style.top = chartComp.y + 'px';
                        chartContent.style.height = chartComp.height + 'px';
                        chartContent.style.left = '0';
                        chartContent.style.right = '0';
                    }
                }
                
                // Position tooltip legend if present (relative to panelContent, which is at top: 0)
                const topTooltipLegendComp = layoutComponents.find(c => c.name === 'topTooltipLegend');
                if (topTooltipLegendComp && panelContentRef) {
                    const tooltipLegendContainer = panelContentRef.querySelector('.genie-legend-tooltip-container');
                    if (tooltipLegendContainer) {
                        tooltipLegendContainer.style.position = 'absolute';
                        tooltipLegendContainer.style.top = topTooltipLegendComp.y + 'px';
                        tooltipLegendContainer.style.left = '0px';
                        tooltipLegendContainer.style.zIndex = '5';
                        tooltipLegendContainer.style.display = 'flex';
                        console.log(`[Panel ${panel.id}] Positioned tooltip legend at top: ${topTooltipLegendComp.y}px (from updateAllHeights)`);
                    } else {
                        console.warn(`[Panel ${panel.id}] Tooltip legend container not found when trying to position it (from updateAllHeights)`);
                    }
                }
                
                // Update statsContent
                if (statsContent) {
                    statsContent.style.setProperty('height', actualContentArea + 'px', 'important');
                    statsContent.style.setProperty('min-height', actualContentArea + 'px', 'important');
                    statsContent.style.setProperty('max-height', actualContentArea + 'px', 'important');
                }
                
                // Update panelContent (at top: 0, header is in normal flow above it)
                // panelContent height should exclude header since header takes up space in normal flow
                if (panelContentRef) {
                    panelContentRef.style.position = 'absolute';
                    panelContentRef.style.top = '0px';
                    panelContentRef.style.left = '0';
                    panelContentRef.style.right = '0';
                    panelContentRef.style.height = (totalPanelHeight - headerHeight) + 'px';
                    panelContentRef.style.minHeight = (totalPanelHeight - headerHeight) + 'px';
                    panelContentRef.style.maxHeight = (totalPanelHeight - headerHeight) + 'px';
                    panelContentRef.style.zIndex = '1'; // Below header
                    panelContentRef.style.paddingBottom = bottomPadding + 'px';
                }
                
                // Update slider position
                if (showZoomSlider && sliderContainer) {
                    const topSliderComp = layoutComponents.find(c => c.name === 'topSlider');
                    const bottomSliderComp = layoutComponents.find(c => c.name === 'bottomSlider');
                    
                    if (currentSliderPosition === 'top' && topSliderComp) {
                        sliderContainer.style.position = 'absolute';
                        // Y position is calculated from panel top, panelContent is at top: 0, so use Y directly
                        sliderContainer.style.top = topSliderComp.y + 'px';
                        sliderContainer.style.height = sliderContainerHeight + 'px';
                    } else if (currentSliderPosition === 'bottom' && bottomSliderComp) {
                        sliderContainer.style.position = 'absolute';
                        // Y position is calculated from panel top, panelContent is at top: 0 (panel top)
                        // The slider Y calculation is: currentY (no spacing before, right after legend)
                        // Then currentY is incremented by: sliderContainerHeight + sliderSpacing
                        // panelContent has paddingBottom, so content area ends at: (totalPanelHeight - headerHeight) - bottomPadding
                        // Slider bottom should align with content area bottom
                        // We need to subtract the spacing after the slider + padding
                        sliderContainer.style.top = (bottomSliderComp.y - sliderSpacing - bottomPadding) + 'px';
                        sliderContainer.style.height = sliderContainerHeight + 'px';
                    }
                    sliderContainer.style.left = '0';
                    sliderContainer.style.right = '0';
                    sliderContainer.style.zIndex = '10';
                    // Only show slider if chart tab is active (not stats tab)
                    const panelElement = container.closest('.genie-dashboard-panel');
                    const chartTab = panelElement?.querySelector('.genie-dashboard-tab[data-tab="chart"]');
                    const isChartTabActive = chartTab && chartTab.classList.contains('genie-dashboard-active');
                    
                    sliderContainer.style.display = isChartTabActive ? 'flex' : 'none';
                    sliderContainer.style.visibility = isChartTabActive ? 'visible' : 'hidden';
                }
                
                // Print detailed layout information
                console.log(`\n========== [Panel ${panel.id}] LAYOUT CALCULATION ==========`);
                console.log(`Panel Height (from gridPos.h=${gridPos.h}): ${totalPanelHeight}px`);
                console.log(`Row Height Per Unit: ${(totalPanelHeight / gridPos.h).toFixed(2)}px`);
                console.log(`\nComponent Order and Positions:`);
                console.log(`┌─────────────────────────────────────────────────────────────┐`);
                console.log(`│ Order │ Component      │ Y Position │ Height │ Y+Height │`);
                console.log(`├─────────────────────────────────────────────────────────────┤`);
                
                layoutComponents.forEach((comp, index) => {
                    const yPos = comp.y.toFixed(1);
                    const height = comp.height.toFixed(1);
                    const yPlusHeight = (comp.y + comp.height).toFixed(1);
                    const order = (index + 1).toString().padStart(2, ' ');
                    const name = comp.name.padEnd(13, ' ');
                    const yStr = yPos.padStart(9, ' ');
                    const hStr = height.padStart(6, ' ');
                    const yhStr = yPlusHeight.padStart(8, ' ');
                    console.log(`│  ${order}  │ ${name} │ ${yStr} │ ${hStr} │ ${yhStr} │`);
                });
                
                console.log(`└─────────────────────────────────────────────────────────────┘`);
                console.log(`\nSummary:`);
                console.log(`  - Total Components: ${layoutComponents.length}`);
                console.log(`  - Total Used Height: ${currentY}px`);
                console.log(`  - Bottom Padding: ${bottomPadding}px`);
                console.log(`  - Total: ${(currentY + bottomPadding).toFixed(1)}px`);
                console.log(`  - Panel Height: ${totalPanelHeight}px`);
                console.log(`  - Difference: ${(totalPanelHeight - currentY - bottomPadding).toFixed(1)}px`);
                console.log(`\nComponent Details:`);
                layoutComponents.forEach((comp, index) => {
                    console.log(`  ${index + 1}. ${comp.name}:`);
                    console.log(`     - Y Position (from panel top): ${comp.y}px`);
                    console.log(`     - Height: ${comp.height}px`);
                    console.log(`     - Bottom edge: ${comp.y + comp.height}px`);
                });
                console.log(`=============================================================\n`);
                
                // Apply heights
                if (panelDiv) {
                    // Enforce total panel height
                    panelDiv.style.height = totalPanelHeight + 'px';
                    panelDiv.style.maxHeight = totalPanelHeight + 'px';
                    panelDiv.style.minHeight = totalPanelHeight + 'px';
                    panelDiv.style.overflow = 'hidden';
                }
                
                if (panelContentRef) {
                    // Position panelContent at top: 0 (header is in normal flow above it)
                    // panelContent height should exclude header since header takes up space in normal flow
                        panelContentRef.style.position = 'absolute';
                    panelContentRef.style.top = '0px';
                        panelContentRef.style.left = '0';
                        panelContentRef.style.right = '0';
                    panelContentRef.style.height = (totalPanelHeight - headerHeight) + 'px';
                    panelContentRef.style.minHeight = (totalPanelHeight - headerHeight) + 'px';
                    panelContentRef.style.maxHeight = (totalPanelHeight - headerHeight) + 'px';
                    panelContentRef.style.zIndex = '1'; // Below header
                        panelContentRef.style.paddingBottom = bottomPadding + 'px';
                    console.log(`[Panel ${panel.id}] PanelContent positioned at Y: 0px (header in normal flow above), height: ${totalPanelHeight - headerHeight}px`);
                }
                
                // Chart content and stats content heights
                // Note: Don't add margin-top to chartContent - it will push legend down
                // Instead, the slider height is already accounted for in availableContentHeight
                chartContent.style.height = chartContentHeight + 'px';
                chartContent.style.minHeight = chartContentHeight + 'px';
                chartContent.style.maxHeight = chartContentHeight + 'px';
                chartContent.style.marginTop = '0px'; // No margin - slider is absolutely positioned
                
                statsContent.style.setProperty('height', statsContentHeight + 'px', 'important');
                statsContent.style.setProperty('min-height', statsContentHeight + 'px', 'important');
                statsContent.style.setProperty('max-height', statsContentHeight + 'px', 'important');
                
                // Canvas height
                canvas.style.height = canvasHeight + 'px';
                canvas.style.maxHeight = canvasHeight + 'px';
                canvas.style.minHeight = canvasHeight + 'px';
                
                // Calculate sliderOffset (offset for slider when positioned at top)
                const sliderOffset = (showZoomSlider && currentSliderPosition === 'top') ? (sliderSpacing + sliderContainerHeight + sliderSpacing) : 0;
                
                console.log(`[Panel ${panel.id}] HEIGHT CALCULATION (FINAL):`, {
                    gridPosH: gridPos.h,
                    rowHeightPerUnit: rowHeightPerUnit,
                    totalPanelHeight: totalPanelHeight,
                    headerHeight: headerHeight,
                    sliderOffset: sliderOffset,
                    sliderContainerHeight: sliderContainerHeight,
                    sliderSpacing: sliderSpacing,
                    availableContentHeight: availableContentHeight,
                    actualContentArea: actualContentArea,
                    bottomPadding: bottomPadding,
                    chartContentHeight: chartContentHeight,
                    canvasHeight: canvasHeight,
                    statsContentHeight: statsContentHeight,
                    legendHeight: hasListLegend ? legendHeight : 0,
                    legendSpacing: hasListLegend ? legendSpacing : 0
                });
            }
            
            // Wait for layout to measure actual header height, then call updateAllHeights
            if (headerElement) {
                requestAnimationFrame(() => {
                    actualHeaderHeight = headerElement.offsetHeight || 40;
                    updateAllHeights();
                });
            } else {
                actualHeaderHeight = 40; // Default estimate
                setTimeout(() => updateAllHeights(), 0);
            }
            
            // Log final measurements after all styles applied
            setTimeout(() => {
                if (!panelDiv) return;
                
                const finalPanelHeight = panelDiv.offsetHeight;
                const panelContent = panelContentRef;
                const finalContentHeight = panelContent ? panelContent.offsetHeight : 0;
                const finalChartContentHeight = chartContent.offsetHeight;
                const finalCanvasHeight = canvas.offsetHeight;
                
                // Calculate availableContentHeight and chartContentHeight for validation (same calculation as in updateAllHeights)
                const calculatedHeaderHeight = headerElement ? headerElement.offsetHeight : 40;
                const calculatedBottomPadding = 8;
                const calculatedAvailableContentHeight = finalPanelHeight - calculatedHeaderHeight - calculatedBottomPadding;
                const calculatedChartContentHeight = finalPanelHeight - calculatedHeaderHeight - calculatedBottomPadding;
                    
                    // Calculate expected height from gridPos.h
                    // Get the actual grid row height by checking computed style or measuring adjacent panels
                    const gridContainer = panelDiv.parentElement;
                    let actualRowHeightPerUnit = null;
                    if (gridContainer) {
                        // Try to get row height from grid-auto-rows
                        const gridComputedStyle = window.getComputedStyle(gridContainer);
                        const gridAutoRows = gridComputedStyle.gridAutoRows;
                        
                        // Calculate from final panel height
                        if (finalPanelHeight > 0 && gridPos.h > 0) {
                            actualRowHeightPerUnit = finalPanelHeight / gridPos.h;
                        }
                        
                        // Get computed styles to account for borders and padding
                        const panelComputedStyle = window.getComputedStyle(panelDiv);
                        const borderTop = parseFloat(panelComputedStyle.borderTopWidth) || 0;
                        const borderBottom = parseFloat(panelComputedStyle.borderBottomWidth) || 0;
                        const paddingTop = parseFloat(panelComputedStyle.paddingTop) || 0;
                        const paddingBottom = parseFloat(panelComputedStyle.paddingBottom) || 0;
                        const totalBorderPadding = borderTop + borderBottom + paddingTop + paddingBottom;
                        
                        // Expected height from gridPos.h using the grid-allocated row height
                        // This is the height that grid SHOULD allocate based on gridPos.h
                        // Note: offsetHeight includes borders, so we need to account for them
                        const expectedHeightFromGridPos = actualRowHeightPerUnit ? (gridPos.h * actualRowHeightPerUnit) : null;
                        
                        // The actual panel height (offsetHeight) includes borders
                        // If the grid allocated height also includes borders, they should match
                        // If there's a 2px difference, it's likely due to 1px border on top and bottom
                        const expectedHeightWithBorders = expectedHeightFromGridPos;
                        const actualHeightWithBorders = finalPanelHeight;
                        
                        // Calculate expected height without borders for comparison
                        const expectedHeightWithoutBorders = expectedHeightWithBorders ? (expectedHeightWithBorders - borderTop - borderBottom) : null;
                        
                        // Validate: Does final panel height match what gridPos.h should produce?
                        // Since we calculate actualRowHeightPerUnit from finalPanelHeight, it will always match
                        // But we can validate that the height is consistent with gridPos.h
                        const heightMatchesGridPos = expectedHeightFromGridPos 
                            ? Math.abs(finalPanelHeight - expectedHeightFromGridPos) < 1 
                            : null;
                        
                        // Check if we're forcing a height that conflicts with grid
                        const gridRowHeight = gridAutoRows;
                        const isHeightForced = panelDiv.style.height !== '' && panelDiv.style.height !== '100%';
                        const forcedHeight = panelDiv.style.height;
                        const computedHeight = window.getComputedStyle(panelDiv).height;
                        
                        // Calculate what the height should be from gridPos.h
                        const expectedHeight = actualRowHeightPerUnit ? (gridPos.h * actualRowHeightPerUnit) : null;
                        const heightMatchesExpected = expectedHeight ? Math.abs(finalPanelHeight - expectedHeight) < 1 : null;
                        
                        // Create a concise validation summary
                        // Account for borders - if there's a 2px difference, it's likely 1px border top + 1px border bottom
                        const heightDifference = expectedHeightFromGridPos ? (finalPanelHeight - expectedHeightFromGridPos) : null;
                        const heightMatchesWithTolerance = expectedHeightFromGridPos 
                            ? Math.abs(heightDifference) <= 2 // Allow 2px tolerance for borders
                            : null;
                        
                        // Calculate validation - account for borders
                        // The grid allocates space, and offsetHeight includes borders
                        // If heightDifference is exactly -2px and we have 2px of borders, it's valid
                        const isBorderDifference = heightDifference && Math.abs(heightDifference) === (borderTop + borderBottom);
                        const passesValidation = heightMatchesWithTolerance && (isBorderDifference || Math.abs(finalPanelHeight - calculatedTotalPanelHeight) < 3);
                        
                        const validationSummary = {
                            gridPosH: gridPos.h,
                            actualPanelHeight: finalPanelHeight,
                            expectedHeight: expectedHeightFromGridPos,
                            actualRowHeightPerUnit: actualRowHeightPerUnit ? actualRowHeightPerUnit.toFixed(2) : null,
                            heightMatches: heightMatchesExpected,
                            heightMatchesWithTolerance: heightMatchesWithTolerance,
                            heightDifference: heightDifference ? heightDifference.toFixed(2) + 'px' : null,
                            borderTop: borderTop,
                            borderBottom: borderBottom,
                            totalBorders: borderTop + borderBottom,
                            isBorderDifference: isBorderDifference,
                            passesValidation: passesValidation
                        };
                        
                        // Log concise summary first
                        console.log(`[Panel ${panel.id}] GRID VALIDATION SUMMARY:`, validationSummary);
                        // Also log a simple pass/fail message
                        if (validationSummary.passesValidation) {
                            console.log(`✓ [Panel ${panel.id}] VALIDATION PASSED: Panel height matches gridPos.h (${gridPos.h}) within tolerance`);
                        } else {
                            console.warn(`✗ [Panel ${panel.id}] VALIDATION FAILED: Panel height (${finalPanelHeight}px) does not match expected (${expectedHeightFromGridPos}px) from gridPos.h (${gridPos.h})`);
                            if (validationSummary.heightMatchesWithTolerance) {
                                console.log(`  Note: Height matches within border tolerance (${validationSummary.heightDifference}), but other checks failed`);
                            }
                        }
                        
                        // Then log full details
                        console.log(`[Panel ${panel.id}] FINAL MEASUREMENTS & GRID VALIDATION (FULL):`, {
                            gridPos: gridPos,
                            gridPosH: gridPos.h,
                            gridAutoRowsCSS: gridRowHeight,
                            actualRowHeightPerUnit: actualRowHeightPerUnit,
                            actualRowHeightPerUnitRounded: actualRowHeightPerUnit ? Math.round(actualRowHeightPerUnit * 100) / 100 : null,
                            expectedHeightFromGridPos: expectedHeightFromGridPos,
                            expectedHeight: expectedHeight,
                            finalPanelDivHeight: finalPanelHeight,
                            computedHeight: computedHeight,
                            borderTop: borderTop,
                            borderBottom: borderBottom,
                            paddingTop: paddingTop,
                            paddingBottom: paddingBottom,
                            totalBorderPadding: totalBorderPadding,
                            heightMatchesGridPos: heightMatchesGridPos,
                            heightMatchesExpected: heightMatchesExpected,
                            heightDifference: expectedHeightFromGridPos ? (finalPanelHeight - expectedHeightFromGridPos) : null,
                            heightDifferencePercent: expectedHeightFromGridPos ? ((finalPanelHeight - expectedHeightFromGridPos) / expectedHeightFromGridPos * 100).toFixed(2) + '%' : null,
                            isHeightForced: isHeightForced,
                            forcedHeight: forcedHeight,
                            maxHeightSet: panelDiv.style.maxHeight,
                            finalContentHeight: finalContentHeight,
                            finalChartContentHeight: finalChartContentHeight,
                            finalCanvasHeight: finalCanvasHeight,
                            calculatedTotalPanelHeight: totalPanelHeight,
                            panelHeightMatch: Math.abs(finalPanelHeight - totalPanelHeight) < 1,
                            contentHeightMatch: Math.abs(finalContentHeight - calculatedAvailableContentHeight) < 1,
                            minHeightOverflow: {
                                panelDiv: finalPanelHeight > (expectedHeightFromGridPos || totalPanelHeight) ? (finalPanelHeight - (expectedHeightFromGridPos || totalPanelHeight)) : 0,
                                panelContent: finalContentHeight > calculatedAvailableContentHeight ? (finalContentHeight - calculatedAvailableContentHeight) : 0,
                                chartContent: finalChartContentHeight > calculatedChartContentHeight ? (finalChartContentHeight - calculatedChartContentHeight) : 0,
                                canvas: finalCanvasHeight > chartHeight ? (finalCanvasHeight - chartHeight) : 0
                            },
                            validation: {
                                panelHeightMatchesGridPos: heightMatchesExpected,
                                panelHeightMatchesCalculated: Math.abs(finalPanelHeight - totalPanelHeight) < 1,
                                contentHeightMatchesCalculated: Math.abs(finalContentHeight - calculatedAvailableContentHeight) < 1,
                                gridPosHValidation: `Panel height ${finalPanelHeight}px should equal gridPos.h (${gridPos.h}) × rowHeight (${actualRowHeightPerUnit ? actualRowHeightPerUnit.toFixed(2) : 'N/A'}px) = ${expectedHeightFromGridPos ? expectedHeightFromGridPos.toFixed(2) : 'N/A'}px`,
                                passesValidation: heightMatchesExpected && Math.abs(finalPanelHeight - totalPanelHeight) < 1
                            }
                        });
                    } else {
                        // Fallback if we can't get grid container
                        console.log(`[Panel ${panel.id}] FINAL MEASUREMENTS (no grid container):`, {
                            gridPosH: gridPos.h,
                            calculatedTotalPanelHeight: totalPanelHeight,
                            finalPanelDivHeight: finalPanelHeight,
                            finalContentHeight: finalContentHeight,
                            finalChartContentHeight: finalChartContentHeight,
                            finalCanvasHeight: finalCanvasHeight,
                            panelHeightMatch: Math.abs(finalPanelHeight - totalPanelHeight) < 1,
                            contentHeightMatch: Math.abs(finalContentHeight - calculatedAvailableContentHeight) < 1
                        });
                    }
                }, 200);
            
            // Store gridPos for panel height calculation reference
            newChart._gridPos = gridPos;
            
            // Create custom list legend if displayMode is "list" or "tooltip"
            console.log(`[Legend] Legend creation check for panel ${panel.id}:`, {
                hasListLegend: hasListLegend,
                displayMode: displayMode,
                showLegend: panel.options?.legend?.showLegend,
                legendOptions: panel.options?.legend
            });
            if (hasListLegend) {
                // Check if legend already exists to prevent duplicate creation
                const existingLegend = chartContent.querySelector('.genie-legend-tooltip-container') || 
                                       chartContent.querySelector('.genie-legend-list-container');
                if (existingLegend) {
                    console.log(`[Legend] Legend already exists for panel ${panel.id}, skipping creation`);
                } else {
                    console.log(`[Legend] Creating legend for panel ${panel.id} with displayMode: ${displayMode}`);
                    // Use setTimeout to ensure chart is fully rendered
                    // Store timeout ID to prevent duplicate calls
                    if (newChart._legendCreationTimeout) {
                        clearTimeout(newChart._legendCreationTimeout);
                    }
                    newChart._legendCreationTimeout = setTimeout(() => {
                        console.log(`[Legend] Calling createListLegend for panel ${panel.id} after timeout`);
                        try {
                            // Double-check legend doesn't exist before creating
                            const checkLegend = chartContent.querySelector('.genie-legend-tooltip-container') || 
                                               chartContent.querySelector('.genie-legend-list-container');
                            if (!checkLegend) {
                                this.createListLegend(chartContent, newChart, panel);
                                console.log(`[Legend] createListLegend completed for panel ${panel.id}`);
                            } else {
                                console.log(`[Legend] Legend already exists during timeout, skipping creation`);
                            }
                        } catch (error) {
                            console.error(`[Legend] Error calling createListLegend for panel ${panel.id}:`, error);
                        }
                        newChart._legendCreationTimeout = null;
                    }, 100);
                }
            } else {
                console.log(`[Legend] Skipping legend creation for panel ${panel.id} - hasListLegend: ${hasListLegend}, displayMode: ${displayMode}, showLegend: ${panel.options?.legend?.showLegend}`);
            }
            
            return newChart;
        };
        
        // Initial render - always render chart first (needed for stats calculation)
        // Use previousDataArray if it was fetched in parallel, otherwise null
        const initialPreviousDuration = panel._previousDuration || null;
        renderChartWithData(currentDataArray, previousDataArray, initialPreviousDuration);
        
        // Ensure statistics/aggregation icon is visible on initial load
        // It'll remain visible on both tabs since statistics/aggregation works for both
        if (showTabs && sumIconButton) {
            // Check if this is the statistics icon (not aggregation icon)
            const isStatisticsIcon = sumIconButton.querySelector('[data-icon="statistics"]');
            if (isStatisticsIcon) {
                // Statistics icon should always be visible if it exists (it's only created if stats are configured)
                sumIconButton.style.display = 'inline-block';
                console.log('[Statistics Icon] Initial visibility set');
            } else if (aggregationConfig && aggregationTag) {
                // Legacy aggregation icon - ensure it's shown
                sumIconButton.style.display = 'inline-block';
                console.log('[Aggregation Icons] Initial visibility set');
            }
        }
        
        // Render stats table immediately if Statistics is the default tab (only if tabs are enabled)
        if (showTabs && showStatsTabByDefault) {
            this.renderStatsTable(panel, currentDataArray, statsContent, panelStats, null, null, null);
            // Ensure percent icon is shown for stats tab if config exists
            if (percentIconButton && hasPercentConfig) {
                percentIconButton.style.display = 'flex';
            }
        }
        
        // If default tab is Statistics, ensure it's visible (already set above, but switchTab will handle active state)
        // Only switch if tabs are enabled
        if (showTabs && showStatsTabByDefault) {
            // Use setTimeout to ensure chart is rendered first, then switch
            setTimeout(() => {
                switchTab('stats');
            }, 100);
        } else {
            // If chart tab is default, ensure percent icon is hidden
            if (percentIconButton) {
                percentIconButton.style.display = 'none';
            }
        }
        
        // Add dropdown change handler if dropdown exists
        if (compareDropdown && previousOptions && previousOptions.length > 0) {
            const self = this;
            const firstOption = previousOptions[0];
            const shouldAutoApply = firstOption !== 'none';
            
            compareDropdown.addEventListener('change', async function() {
                // Use stored panel value if dropdown value is empty, otherwise use dropdown value
                let selectedDuration = this.value || panel._compareSelectedOption || null;
                
                // Get current active tab to determine which options are valid
                const isChartTabActive = chartContent.classList.contains('genie-dashboard-active');
                const activeTab = isChartTabActive ? 'chart' : 'stats';
                
                // Get the valid options for the current tab
                let validOptionsStr = null;
                if (activeTab === 'chart') {
                    validOptionsStr = timeSeriesPreviousOptions || globalPreviousOptions;
                } else {
                    validOptionsStr = statsTablePreviousOptions || globalPreviousOptions;
                }
                
                // Validate that the selected duration is valid for the current tab
                if (validOptionsStr && selectedDuration) {
                    const validOptions = validOptionsStr.split(',').map(opt => opt.trim());
                    if (!validOptions.includes(selectedDuration)) {
                        // Selected value is not valid for current tab - reset to "none" or first valid option
                        console.warn(`Selected duration "${selectedDuration}" is not valid for ${activeTab} tab. Valid options:`, validOptions);
                        if (validOptions.includes('none')) {
                            selectedDuration = 'none';
                            this.value = 'none';
                            panel._compareSelectedOption = 'none';
                        } else if (validOptions.length > 0) {
                            selectedDuration = validOptions[0];
                            this.value = validOptions[0];
                            panel._compareSelectedOption = validOptions[0];
                        } else {
                            // No valid options, just return
                            return;
                        }
                    } else {
                        // Value is valid, update stored value
                        panel._compareSelectedOption = selectedDuration;
                        this.value = selectedDuration;
                    }
                } else if (!selectedDuration || selectedDuration === '') {
                    // No valid options or empty value - default to 'none'
                    selectedDuration = 'none';
                    this.value = 'none';
                    panel._compareSelectedOption = 'none';
                }
                
                if (selectedDuration && selectedDuration !== 'none') {
                    // Check if we already have previous data for this duration (from parallel fetch)
                    if (panel._previousDataArray && panel._previousDuration === selectedDuration) {
                        // We already have the data, just use it
                        console.log(`[Compare Dropdown] Using existing previous data for ${selectedDuration} (from parallel fetch)`);
                        previousDataArray = panel._previousDataArray;
                    } else if (panel._fetchInProgress) {
                        // A fetch is already in progress, wait for it to complete
                        console.log(`[Compare Dropdown] Previous fetch in progress, waiting...`);
                        try {
                            await panel._fetchInProgress;
                            // After waiting, check if we now have the data we need
                            if (panel._previousDataArray && panel._previousDuration === selectedDuration) {
                                previousDataArray = panel._previousDataArray;
                                console.log(`[Compare Dropdown] Got previous data after waiting for in-progress fetch`);
                            } else {
                                // The in-progress fetch was for a different duration, fetch the new one
                                console.log(`[Compare Dropdown] In-progress fetch was for different duration, fetching new data`);
                                // Continue to fetch new data below
                            }
                        } catch (error) {
                            console.error('Error waiting for in-progress fetch:', error);
                            // Continue to fetch new data below
                        }
                    }
                    
                    // Only fetch if we don't have the data yet
                    if (!previousDataArray || panel._previousDuration !== selectedDuration) {
                        // Show loading in the active tab container
                        let activeContent = isChartTabActive ? chartContent : statsContent;
                        let existingElement = null;
                        
                        if (isChartTabActive) {
                            // For chart tab, keep canvas element if it exists
                            existingElement = chartContent.querySelector('canvas');
                        } else {
                            // For stats tab, clear the table content and show loading
                            statsContent.innerHTML = '';
                        }
                        
                        if (!activeContent.querySelector('.genie-dashboard-panel-loading')) {
                            const loadingDiv = document.createElement('div');
                            loadingDiv.className = 'genie-dashboard-panel-loading';
                            // Format duration for display (add "-" prefix if not already present)
                            const durationDisplay = selectedDuration.startsWith('-') ? selectedDuration : `-${selectedDuration}`;
                            loadingDiv.textContent = `Loading previous ${durationDisplay} data...`;
                            if (existingElement) {
                                activeContent.insertBefore(loadingDiv, existingElement);
                            } else {
                                activeContent.appendChild(loadingDiv);
                            }
                        }
                        
                        try {
                            // Check if a fetch is already in progress to prevent duplicate requests
                            if (panel._fetchInProgress) {
                                console.log(`[Compare Dropdown] Fetch already in progress, waiting...`);
                                await panel._fetchInProgress;
                                // After waiting, check if we got the data we need
                                if (panel._previousDataArray && panel._previousDuration === selectedDuration) {
                                    previousDataArray = panel._previousDataArray;
                                    console.log(`[Compare Dropdown] Got previous data after waiting`);
                                    // Skip to rendering below
                                } else {
                                    // Need to fetch for this specific duration
                                    console.log(`[Compare Dropdown] In-progress fetch was for different duration, fetching new data`);
                                }
                            }
                            
                            // Only fetch if we still don't have the data
                            if (!previousDataArray || panel._previousDuration !== selectedDuration) {
                                // Calculate previous offset
                                const previousOffset = self.parseDuration(selectedDuration);
                                console.log('Fetching previous period data with offset:', previousOffset, 'for duration:', selectedDuration);
                                
                                // Mark fetch as in progress
                                const fetchPromise = self.fetchPanelData(panel, previousOffset, selectedDuration);
                                panel._fetchInProgress = fetchPromise;
                                
                                // Fetch previous period data, passing the duration string for URL parameter
                                const previousResult = await fetchPromise;
                                
                                // Clear fetch in progress flag
                                panel._fetchInProgress = null;
                                
                                previousDataArray = previousResult.data || previousResult; // Support both new format and legacy format
                                
                                // Mark all previous data items with isPrevious: true so they can be distinguished from current data
                                if (previousDataArray && Array.isArray(previousDataArray)) {
                                    previousDataArray = previousDataArray.map(targetData => ({
                                        ...targetData,
                                        isPrevious: true
                                    }));
                                } else if (previousDataArray && !Array.isArray(previousDataArray)) {
                                    // Legacy format - single object, wrap in array
                                    previousDataArray = [{
                                        ...previousDataArray,
                                        isPrevious: true
                                    }];
                                }
                                
                                // Also store on panel for persistence across tab switches
                                panel._previousDataArray = previousDataArray;
                                panel._previousDuration = selectedDuration;
                                const previousFailedTargets = previousResult.failedTargets || [];
                                console.log('Previous period data loaded:', previousDataArray);
                                console.log('Previous period failed targets:', previousFailedTargets);
                                
                                // Merge failed targets from previous fetch with existing failed targets
                                if (previousFailedTargets.length > 0) {
                                    // Mark these as previous period failures
                                    const markedPreviousFailures = previousFailedTargets.map(ft => ({
                                        ...ft,
                                        isPrevious: true,
                                        previousDuration: selectedDuration
                                    }));
                                    
                                    // Merge with existing failed targets, avoiding duplicates
                                    const existingFailed = panel._failedTargets || [];
                                    const existingRefIds = new Set(existingFailed.map(ft => {
                                        const target = ft.target || ft;
                                        return `${target.refId || 'unknown'}_${ft.isPrevious ? 'prev' : 'curr'}`;
                                    }));
                                    
                                    const newFailures = markedPreviousFailures.filter(ft => {
                                        const target = ft.target || ft;
                                        const key = `${target.refId || 'unknown'}_prev`;
                                        return !existingRefIds.has(key);
                                    });
                                    
                                    panel._failedTargets = [...existingFailed, ...newFailures];
                                    console.log('Merged failed targets:', panel._failedTargets.length, 'total');
                                    
                                    // Update error message if it exists
                                    const panelElement = chartContent.closest('.genie-dashboard-panel');
                                    const panelContent = panelElement?.querySelector('.genie-dashboard-panel-content');
                                    if (panelContent && panel._failedTargets.length > 0) {
                                        self.showPanelError(panel, panelContent, panel._failedTargets);
                                    }
                                }
                                
                                // Remove loading indicator from both containers (in case tab was switched)
                                const loadingElChart = chartContent.querySelector('.genie-dashboard-panel-loading');
                                if (loadingElChart) {
                                    loadingElChart.remove();
                                }
                                const loadingElStats = statsContent.querySelector('.genie-dashboard-panel-loading');
                                if (loadingElStats) {
                                    loadingElStats.remove();
                                }
                            }
                        } catch (error) {
                            console.error('Error loading previous period data:', error);
                            // Clear fetch in progress flag on error
                            panel._fetchInProgress = null;
                            // Remove loading and show error in the active tab container
                            const loadingElChart = chartContent.querySelector('.genie-dashboard-panel-loading');
                            if (loadingElChart) {
                                loadingElChart.className = 'genie-dashboard-panel-error';
                                loadingElChart.textContent = `Error loading previous period: ${error.message}`;
                            }
                            const loadingElStats = statsContent.querySelector('.genie-dashboard-panel-loading');
                            if (loadingElStats) {
                                loadingElStats.className = 'genie-dashboard-panel-error';
                                loadingElStats.textContent = `Error loading previous period: ${error.message}`;
                            }
                            // If no loading element exists, show error directly
                            if (!loadingElChart && !loadingElStats) {
                                if (isChartTabActive) {
                                    chartContent.innerHTML = `<div class="genie-dashboard-panel-error">Error loading previous period: ${error.message}</div>`;
                                } else {
                                    statsContent.innerHTML = `<div class="genie-dashboard-panel-error">Error loading previous period: ${error.message}</div>`;
                                }
                            }
                            // Reset dropdown to "none" on error
                            this.value = 'none';
                            return; // Don't proceed with rendering on error
                        }
                    }
                    
                    // Re-render only the active tab, not both (for both cases: using existing data or newly fetched)
                    if (isChartTabActive) {
                        // Chart tab is active - re-render chart with both current and previous data
                        await renderChartWithData(currentDataArray, previousDataArray, selectedDuration);
                        // Re-create list legend if needed (it will be created in renderChartWithData)
                        // The legend is created automatically in renderChartWithData after chart creation
                    } else {
                        // Stats tab is active - re-render stats table with comparison
                        if (showTabs) {
                            const isTransposed = panel.statsTable?.transpose || panel.options?.statsTable?.transpose || panel.transpose || false;
                            self.renderStatsTable(panel, currentDataArray, statsContent, panelStats, previousDataArray, isTransposed, selectedDuration);
                        }
                    }
                } else {
                    // "none" selected - remove previous data
                    previousDataArray = null;
                    // Re-render only the active tab
                    if (isChartTabActive) {
                        // Chart tab is active - re-render chart without previous data
                        await renderChartWithData(currentDataArray, null, null);
                    } else {
                        // Stats tab is active - re-render stats table without previous data
                        if (showTabs) {
                            const isTransposed = panel.statsTable?.transpose || panel.options?.statsTable?.transpose || panel.transpose || false;
                            self.renderStatsTable(panel, currentDataArray, statsContent, panelStats, null, isTransposed, null);
                        }
                    }
                }
            });
            
            // Automatically apply first option if it's not "none"
            if (shouldAutoApply) {
                // Trigger change event to apply the first option
                compareDropdown.dispatchEvent(new Event('change'));
            }
        }
        
        // Set up tooltip handlers for the initial chart
        const chart = this.charts[panel.id];
        if (chart) {
            this.setupTooltipHandlers(canvas, chart, chartContent, panel);
        }
        
            // Set height based on gridPos (matching recalculated chart height)
            const canvasHeight = Math.max(200, gridPos.h * 42);
        canvas.style.height = canvasHeight + 'px';
        
        // Calculate and render statistics (only if tabs are enabled and stats tab should be shown)
        // Note: This is redundant if we already rendered above, but keeping it for backward compatibility
        // In practice, the initial render above will handle this
    }
    
    /**
     * Calculate statistics for a series
     */
    calculateSeriesStats(values, statsToShow, seriesName = null) {
        if (!values || values.length === 0) {
            return {};
        }
        
        // Filter out null/undefined values
        const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
        
        if (validValues.length === 0) {
            return {};
        }
        
        const stats = {};
        
        // Sort for percentile calculations
        const sorted = [...validValues].sort((a, b) => a - b);
        
        statsToShow.forEach(stat => {
            const statKey = stat.toLowerCase();
            switch (statKey) {
                case 'avg':
                case 'average':
                case 'mean':
                    const sum = validValues.reduce((a, b) => a + b, 0);
                    stats[stat] = sum / validValues.length;
                    console.log(`[Stat Calculation] Series: ${seriesName || 'unknown'}, Stat: ${stat}, Result: ${stats[stat]}, Values used: [${validValues.length} values] sum=${sum}, count=${validValues.length}, expression: sum/count = ${sum}/${validValues.length}`);
                    break;
                case 'max':
                    stats[stat] = Math.max(...validValues);
                    console.log(`[Stat Calculation] Series: ${seriesName || 'unknown'}, Stat: ${stat}, Result: ${stats[stat]}, Values used: [${validValues.length} values] max(${validValues.slice(0, 10).join(', ')}${validValues.length > 10 ? '...' : ''})`);
                    break;
                case 'min':
                    stats[stat] = Math.min(...validValues);
                    console.log(`[Stat Calculation] Series: ${seriesName || 'unknown'}, Stat: ${stat}, Result: ${stats[stat]}, Values used: [${validValues.length} values] min(${validValues.slice(0, 10).join(', ')}${validValues.length > 10 ? '...' : ''})`);
                    break;
                case 'sum':
                    stats[stat] = validValues.reduce((a, b) => a + b, 0);
                    console.log(`[Stat Calculation] Series: ${seriesName || 'unknown'}, Stat: ${stat}, Result: ${stats[stat]}, Values used: [${validValues.length} values] sum(${validValues.slice(0, 10).join(' + ')}${validValues.length > 10 ? ' + ...' : ''})`);
                    break;
                case 'count':
                    stats[stat] = validValues.length;
                    console.log(`[Stat Calculation] Series: ${seriesName || 'unknown'}, Stat: ${stat}, Result: ${stats[stat]}, Values used: [${validValues.length} valid values from ${values.length} total]`);
                    break;
                case 'p90':
                    const p90Index = Math.floor(sorted.length * 0.9);
                    stats[stat] = sorted[p90Index];
                    console.log(`[Stat Calculation] Series: ${seriesName || 'unknown'}, Stat: ${stat}, Result: ${stats[stat]}, Values used: [${sorted.length} sorted values] index=${p90Index} (90th percentile of ${sorted.length} values)`);
                    break;
                case 'p95':
                    const p95Index = Math.floor(sorted.length * 0.95);
                    stats[stat] = sorted[p95Index];
                    console.log(`[Stat Calculation] Series: ${seriesName || 'unknown'}, Stat: ${stat}, Result: ${stats[stat]}, Values used: [${sorted.length} sorted values] index=${p95Index} (95th percentile of ${sorted.length} values)`);
                    break;
                case 'p99':
                    const p99Index = Math.floor(sorted.length * 0.99);
                    stats[stat] = sorted[p99Index];
                    console.log(`[Stat Calculation] Series: ${seriesName || 'unknown'}, Stat: ${stat}, Result: ${stats[stat]}, Values used: [${sorted.length} sorted values] index=${p99Index} (99th percentile of ${sorted.length} values)`);
                    break;
                case 'p50':
                case 'median':
                    const mid = Math.floor(sorted.length / 2);
                    stats[stat] = sorted.length % 2 === 0 
                        ? (sorted[mid - 1] + sorted[mid]) / 2 
                        : sorted[mid];
                    console.log(`[Stat Calculation] Series: ${seriesName || 'unknown'}, Stat: ${stat}, Result: ${stats[stat]}, Values used: [${sorted.length} sorted values] mid=${mid}, ${sorted.length % 2 === 0 ? `(${sorted[mid - 1]} + ${sorted[mid]}) / 2` : `sorted[${mid}]`}`);
                    break;
                case 'stddev':
                case 'std':
                    const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length;
                    const variance = validValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / validValues.length;
                    stats[stat] = Math.sqrt(variance);
                    console.log(`[Stat Calculation] Series: ${seriesName || 'unknown'}, Stat: ${stat}, Result: ${stats[stat]}, Values used: [${validValues.length} values] mean=${mean}, variance=${variance}, expression: sqrt(variance) = sqrt(${variance})`);
                    break;
            }
        });
        
        return stats;
    }
    
    /**
     * Create a custom list legend with vertical scroll
     */
    createListLegend(container, chart, panel) {
        // Check display mode first
        const displayMode = panel.options?.legend?.displayMode || 'list';
        const placement = panel.options?.legend?.placement || 'bottom';
        console.log(`[createListLegend] Panel ${panel.id} - displayMode: ${displayMode}, placement: ${placement}`);
        
        // Handle tooltip mode - let createTooltipLegend handle its own cleanup
        if (displayMode === 'tooltip') {
            console.log(`[createListLegend] Calling createTooltipLegend for panel ${panel.id}`);
            this.createTooltipLegend(container, chart, panel, placement);
            return;
        }
        
        // Remove existing custom legend if any (only for non-tooltip modes)
        const existingLegend = container.querySelector('.genie-legend-list-container');
        if (existingLegend) {
            existingLegend.remove();
        }
        
        // Remove existing tooltip legend if any (only for non-tooltip modes)
        const existingTooltipLegend = container.querySelector('.genie-legend-tooltip-container');
        if (existingTooltipLegend) {
            existingTooltipLegend.remove();
        }
        
        // Create legend container
        const legendContainer = document.createElement('div');
        legendContainer.className = 'genie-legend-list-container';
        
        // Set position based on legend placement
        // Position legend within chart container at specified location
        // Calculate height for exactly 3 lines: each item ~14px (12px font + line height)
        // 3 items × 14px = 42px content + 4px bottom padding = 46px total
        const maxLegendHeight = 46; // Height for exactly 3 lines with scroll (42px content + 4px padding)
        
        // Get canvas element to determine chart plot area
        const canvas = container.querySelector('canvas');
        const canvasHeight = canvas ? (canvas.offsetHeight || parseFloat(canvas.style.height) || 0) : 0;
        
        if (placement === 'right') {
            // Position on right side, within chart area
            legendContainer.style.cssText = `position: absolute; right: 10px; top: 10px; width: 200px; max-height: ${canvasHeight - 20}px; z-index: 5;`;
        } else if (placement === 'left') {
            // Position on left side
            legendContainer.style.cssText = `position: absolute; left: 10px; top: 10px; width: 200px; max-height: ${canvasHeight - 20}px; z-index: 5;`;
        } else if (placement === 'top') {
            // Position at top of container, above chart
            legendContainer.style.cssText = `position: absolute; top: 10px; left: 10px; right: 10px; height: ${maxLegendHeight}px; max-height: ${maxLegendHeight}px; min-height: ${maxLegendHeight}px; overflow: hidden; box-sizing: border-box; z-index: 5;`;
            // Adjust canvas position to make room for legend at top
            if (canvas) {
                const currentMarginTop = parseFloat(canvas.style.marginTop) || 0;
                canvas.style.marginTop = `${maxLegendHeight + 20}px`;
            }
        } else {
            // bottom (default) - position below the chart canvas with 2px spacing
            // Canvas height reduced by 2px to create space
            
            // Get actual container height
            const containerHeight = container.offsetHeight || parseFloat(container.style.height) || 0;
            const legendSpacing = 2; // Space between chart and legend
            
            // Ensure we have a valid canvas height
            if (canvasHeight > 0 && containerHeight > 0) {
                // Calculate where legend should be positioned
                let topPosition = canvasHeight + legendSpacing;
                const legendBottom = topPosition + maxLegendHeight;
                
                // Check if legend would overflow container
                if (legendBottom > containerHeight) {
                    // Adjust: position legend so it fits within container
                    topPosition = Math.max(0, containerHeight - maxLegendHeight - legendSpacing);
                    
                    // Also need to reduce chart height to make room for legend
                    const requiredChartHeight = topPosition - legendSpacing;
                    if (canvas && requiredChartHeight > 0 && requiredChartHeight < canvasHeight) {
                        canvas.style.height = requiredChartHeight + 'px';
                        canvas.style.maxHeight = requiredChartHeight + 'px';
                        canvas.style.minHeight = requiredChartHeight + 'px';
                        console.log(`[Panel ${panel.id}] LEGEND OVERFLOW - adjusted chart height from ${canvasHeight}px to ${requiredChartHeight}px`);
                    }
                    
                    console.log(`[Panel ${panel.id}] LEGEND OVERFLOW DETECTED - adjusting position:`, {
                        originalTopPosition: canvasHeight + legendSpacing,
                        adjustedTopPosition: topPosition,
                        containerHeight: containerHeight,
                        maxLegendHeight: maxLegendHeight,
                        requiredChartHeight: requiredChartHeight
                    });
                }
                
                console.log(`[Panel ${panel.id}] LEGEND POSITIONING (bottom):`, {
                    canvasHeight: canvasHeight,
                    legendSpacing: legendSpacing,
                    topPosition: topPosition,
                    maxLegendHeight: maxLegendHeight,
                    legendBottom: topPosition + maxLegendHeight,
                    containerHeight: containerHeight,
                    fitsWithinContainer: (topPosition + maxLegendHeight) <= containerHeight
                });
                
                legendContainer.style.cssText = `position: absolute; top: ${topPosition}px; left: 10px; right: 10px; height: ${maxLegendHeight}px; max-height: ${maxLegendHeight}px; min-height: ${maxLegendHeight}px; overflow: hidden; box-sizing: border-box; z-index: 5; border: none !important; border-top: none !important; border-left: none !important; border-right: none !important;`;
                // Note: border-bottom will be set separately when scrollable content is detected
            } else {
                // Fallback: use calculated position from container
                const fallbackContainerHeight = container.offsetHeight || parseFloat(container.style.height) || 0;
                const topPosition = Math.max(0, fallbackContainerHeight - maxLegendHeight - legendSpacing);
                
                console.log(`[Panel ${panel.id}] LEGEND POSITIONING (bottom, fallback):`, {
                    containerHeight: fallbackContainerHeight,
                    legendSpacing: legendSpacing,
                    topPosition: topPosition,
                    maxLegendHeight: maxLegendHeight,
                    legendBottom: topPosition + maxLegendHeight
                });
                
                legendContainer.style.cssText = `position: absolute; top: ${topPosition}px; left: 10px; right: 10px; height: ${maxLegendHeight}px; max-height: ${maxLegendHeight}px; min-height: ${maxLegendHeight}px; overflow: hidden; box-sizing: border-box; z-index: 5; border: none !important; border-top: none !important; border-left: none !important; border-right: none !important;`;
                // Note: border-bottom will be set separately when scrollable content is detected
            }
        }
        
        // Create scrollable list with proper height constraints
        const legendList = document.createElement('div');
        legendList.className = 'genie-legend-list';
        
        // Calculate available height for the list (container height minus padding)
        let listHeight;
        if (placement === 'right' || placement === 'left') {
            // For side placement, use the container's calculated max-height minus padding
            const sideHeight = canvasHeight - 20; // 10px top + 10px bottom margin
            listHeight = `${sideHeight}px`; // Account for 0px top + 0px bottom padding
        } else {
            // For top/bottom, container has maxLegendHeight (46px with 4px bottom padding)
            // The scrollable list should fill the content area: 46px - 4px = 42px
            // Since container uses box-sizing: border-box, padding is included in height
            listHeight = `${maxLegendHeight - 4}px`; // Subtract bottom padding
        }
        
        // Force scrolling by setting explicit height - must match container exactly to prevent overflow
        // Container has height: maxLegendHeight with padding: 0px 8px, so content area is exactly maxLegendHeight
        legendList.style.cssText = `overflow-y: auto !important; overflow-x: hidden !important; height: ${listHeight} !important; max-height: ${listHeight} !important; min-height: ${listHeight} !important; box-sizing: border-box !important; position: relative !important; padding-right: 0 !important; margin-right: 0 !important;`;
        
        // Get datasets from chart and sort by label
        const datasets = (chart.data.datasets || []).slice(); // Create a copy
        // Create an array with dataset and original index for tracking
        const datasetsWithIndex = datasets.map((dataset, idx) => ({
            dataset: dataset,
            originalIndex: idx
        }));
        datasetsWithIndex.sort((a, b) => {
            const labelA = (a.dataset.label || '').toLowerCase();
            const labelB = (b.dataset.label || '').toLowerCase();
            return labelA.localeCompare(labelB);
        });
        
        // Create legend items (in sorted order)
        datasetsWithIndex.forEach((item, sortedIndex) => {
            const dataset = item.dataset;
            const originalIndex = item.originalIndex;
            
            const legendItem = document.createElement('div');
            legendItem.className = 'genie-legend-item';
            legendItem.style.cssText = 'display: flex; align-items: center; padding: 0px 8px; cursor: pointer;';
            
            // Color indicator
            const colorBox = document.createElement('div');
            colorBox.style.cssText = `width: 12px; height: 12px; background: ${dataset.borderColor || dataset.backgroundColor || '#3b82f6'}; margin-right: 8px; border-radius: 2px; flex-shrink: 0; user-select: none;`;
            
            // Label text - allow text selection
            const label = document.createElement('span');
            label.textContent = dataset.label || `Series ${sortedIndex + 1}`;
            label.style.cssText = 'font-size: 12px; color: #374151; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; user-select: text; cursor: text;';
            
            legendItem.appendChild(colorBox);
            legendItem.appendChild(label);
            
            // Toggle series on click (use original index for chart metadata)
            // Only toggle if text is not selected - allow text selection on label
            legendItem.addEventListener('click', function(e) {
                // Don't toggle if user is selecting text
                const selection = window.getSelection();
                if (selection && selection.toString().length > 0) {
                    return;
                }
                // Don't toggle if click target is the label (user might be selecting text)
                if (e.target === label || label.contains(e.target)) {
                    // Allow text selection, only toggle if click on color box
                    if (e.target !== colorBox) {
                        return;
                    }
                }
                const meta = chart.getDatasetMeta(originalIndex);
                meta.hidden = !meta.hidden;
                chart.update();
                
                // Update visual state
                if (meta.hidden) {
                    legendItem.style.opacity = '0.5';
                    colorBox.style.opacity = '0.5';
                } else {
                    legendItem.style.opacity = '1';
                    colorBox.style.opacity = '1';
                }
            });
            
            // Set initial opacity if hidden (use original index for chart metadata)
            const meta = chart.getDatasetMeta(originalIndex);
            if (meta && meta.hidden) {
                legendItem.style.opacity = '0.5';
                colorBox.style.opacity = '0.5';
            }
            
            legendItem.addEventListener('mouseenter', function() {
                legendItem.style.backgroundColor = '#f3f4f6';
            });
            
            legendItem.addEventListener('mouseleave', function() {
                legendItem.style.backgroundColor = 'transparent';
            });
            
            legendList.appendChild(legendItem);
        });
        
        // Ensure we have content to test scrolling
        if (datasets.length === 0) {
            const noDataMsg = document.createElement('div');
            noDataMsg.textContent = 'No series available';
            noDataMsg.style.cssText = 'padding: 10px; text-align: center; color: #6b7280; font-size: 12px;';
            legendList.appendChild(noDataMsg);
        }
        
        legendContainer.appendChild(legendList);
        container.appendChild(legendContainer);
        
        // Force a reflow to ensure heights are applied correctly
        void legendList.offsetHeight;
        
        // Verify scrolling works - if content height > container height, scrollbar should appear
        const contentHeight = legendList.scrollHeight;
        const containerHeight = parseFloat(listHeight);
        console.log('Legend list - Content height:', contentHeight, 'Container height:', containerHeight, 'Will scroll:', contentHeight > containerHeight);
        
        // Mark as scrollable and ensure scrollbar stays visible
        if (contentHeight > containerHeight) {
            // Add class immediately - this changes overflow from 'auto' to 'scroll' via CSS
            legendList.classList.add('genie-dashboard-has-scroll');
            
            
            // Force the overflow style to be applied immediately with !important
            legendList.style.setProperty('overflow-y', 'scroll', 'important');
            
            // macOS auto-hides scrollbars. Use multiple techniques to keep it visible:
            // 1. Keep element slightly scrolled (imperceptible 0.5px offset)
            // 2. Trigger periodic scroll events to maintain visibility
            // 3. Use hover state to show scrollbar
            
            const keepScrollbarVisible = () => {
                if (legendList.scrollTop < 0.5) {
                    legendList.scrollTop = 0.5;
                }
            };
            
            // Initial setup - set tiny offset
            setTimeout(() => {
                keepScrollbarVisible();
                // Also trigger on mouse events
                legendList.addEventListener('mouseenter', keepScrollbarVisible);
                
                // Periodic check to maintain scrollbar (every 500ms)
                const intervalId = setInterval(() => {
                    if (legendList.classList.contains('genie-dashboard-has-scroll')) {
                        keepScrollbarVisible();
                        // Also dispatch scroll event
                        legendList.dispatchEvent(new Event('scroll', { bubbles: false }));
                    } else {
                        clearInterval(intervalId);
                    }
                }, 500);
                
                // Store for cleanup
                legendList._scrollbarInterval = intervalId;
            }, 50);
        }
        
        // Store reference for updates
        chart._listLegendContainer = legendContainer;
        chart._listLegendPanel = panel;
        chart._listLegendSelf = this;
    }
    
    /**
     * Create a tooltip legend - shows only first item, hover shows popup with all items
     */
    createTooltipLegend(container, chart, panel, placement) {
        console.log(`[createTooltipLegend] Called for panel ${panel.id}, placement: ${placement}`);
        // Store dashboard instance for use in event handlers
        const dashboard = this;
        const panelId = panel.id;
        
        // Get panel element once for reuse
        const panelElement = container.closest('.genie-dashboard-panel');
        
        // Check for existing tooltip legend containers and remove them
        const existingTooltipLegend = container.querySelector('.genie-legend-tooltip-container');
        const existingInPanel = panelElement ? panelElement.querySelectorAll('.genie-legend-tooltip-container') : [];
        const existingPopups = panelElement ? panelElement.querySelectorAll('.genie-legend-tooltip-popup') : [];
        console.log(`[TooltipLegend] Before creation - Found ${existingTooltipLegend ? 1 : 0} tooltip container in container, ${existingInPanel.length} in panel, ${existingPopups.length} popups`);
        if (existingTooltipLegend || existingInPanel.length > 0) {
            console.log(`[TooltipLegend] Removing ${existingInPanel.length} existing tooltip container(s) and ${existingPopups.length} popup(s)`);
            // Remove all existing tooltip containers
            existingInPanel.forEach(container => container.remove());
            existingPopups.forEach(popup => popup.remove());
            // Also remove from container if found there
            if (existingTooltipLegend) {
                existingTooltipLegend.remove();
            }
        }
        
        // Get datasets from chart and sort by label
        // Ensure we read from the actual chart instance that was just created
        // Use the chart from dashboard if available (in case chart reference is stale)
        const currentChart = dashboard.charts?.[panelId] || chart;
        const datasets = (currentChart.data.datasets || []).slice();
        console.log(`[TooltipLegend] Creating with ${datasets.length} datasets from chart:`, datasets.map(d => d.label));
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
        
        console.log(`[TooltipLegend] Sorted ${datasetsWithIndex.length} datasets:`, datasetsWithIndex.map(item => item.dataset.label));
        
        // Create legend container at top
        const legendContainer = document.createElement('div');
        legendContainer.className = 'genie-legend-tooltip-container';
        
        // Function to update legend position based on chart Y-axis
        const updateLegendPosition = () => {
            try {
                const currentChart = dashboard.charts?.[panelId] || chart;
                if (currentChart && currentChart.chartArea) {
                    // Align to the left edge of the chart area (Y-axis position)
                    const leftOffset = currentChart.chartArea.left || 0;
                    legendContainer.style.left = leftOffset + 'px';
                } else {
                    // Fallback if chart not ready yet
                    legendContainer.style.left = '0px';
                }
            } catch (error) {
                // Fallback on error
                legendContainer.style.left = '0px';
            }
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
            display: flex;
            align-items: center;
        `.replace(/\s+/g, ' ').trim();
        
        console.log(`[TooltipLegend] Initial position set to top: ${initialTop}px (header height: ${headerHeight}px)`);
        
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
                console.log(`[TooltipLegend] Updated popup max-height to: ${popupMaxHeight}px (chart: ${newChartHeight}px + container: ${legendContainerHeight}px), max-width to: ${newChartWidth}px`);
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
        
        // Create visible legend item (first one only)
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
        
        // Eye icon to show only this series (for visible item)
        const visibleEyeIcon = document.createElement('div');
        visibleEyeIcon.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `;
        visibleEyeIcon.style.cssText = `
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
        
        // Function to update visible eye icon state based on series visibility
        const updateVisibleEyeIconState = (isVisible) => {
            const svg = visibleEyeIcon.querySelector('svg');
            if (svg) {
                if (isVisible) {
                    // Active state: outline eye with blue color (like hover)
                    svg.setAttribute('fill', 'none');
                    svg.setAttribute('stroke', 'currentColor');
                    visibleEyeIcon.style.color = '#3b82f6';
                    visibleEyeIcon.style.opacity = '1';
                } else {
                    // Inactive state: outline eye with gray color
                    svg.setAttribute('fill', 'none');
                    svg.setAttribute('stroke', 'currentColor');
                    visibleEyeIcon.style.color = '#6b7280';
                    visibleEyeIcon.style.opacity = '0.7';
                }
            }
        };
        
        // Set initial state
        try {
            const initialMeta = chart.getDatasetMeta(firstItem.originalIndex);
            if (initialMeta) {
                updateVisibleEyeIconState(!initialMeta.hidden);
            }
        } catch (error) {
            // Default to active if can't determine
            updateVisibleEyeIconState(true);
        }
        
        // Hover effect for eye icon
        visibleEyeIcon.addEventListener('mouseenter', () => {
            visibleEyeIcon.style.opacity = '1';
            if (visibleEyeIcon.style.color !== '#3b82f6') {
                visibleEyeIcon.style.color = '#3b82f6';
            }
        });
        visibleEyeIcon.addEventListener('mouseleave', () => {
            // Restore state based on visibility
            try {
                const currentChart = dashboard.charts?.[panelId] || chart;
                if (currentChart) {
                    const meta = currentChart.getDatasetMeta(firstItem.originalIndex);
                    if (meta) {
                        updateVisibleEyeIconState(!meta.hidden);
                    }
                }
            } catch (error) {
                visibleEyeIcon.style.opacity = '0.7';
                visibleEyeIcon.style.color = '#6b7280';
            }
        });
        
        // Click handler for visible eye icon - toggle all other series
        visibleEyeIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            // Get current chart from dashboard instance
            const currentChart = dashboard.charts?.[panelId] || chart;
            
            if (!currentChart || !currentChart.canvas || typeof currentChart.getDatasetMeta !== 'function') {
                return;
            }
            
            try {
                // Toggle each other series individually:
                // - If disabled (hidden) → enable (show)
                // - If enabled (visible) → disable (hide)
                const allDatasets = currentChart.data.datasets || [];
                allDatasets.forEach((dataset, idx) => {
                    if (idx !== firstItem.originalIndex) {
                        const meta = currentChart.getDatasetMeta(idx);
                        if (meta) {
                            // Toggle: if hidden, show it; if visible, hide it
                            meta.hidden = !meta.hidden;
                        }
                    }
                });
                
                // Update visual states of all legend items in popup
                // Find popup container and legend list dynamically (they're created later in the function)
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
                                    if (meta.hidden) {
                                        item.style.opacity = '0.5';
                                        const colorBox = item.querySelector('div:first-child');
                                        const label = item.querySelector('span');
                                        if (colorBox) colorBox.style.opacity = '0.5';
                                        if (label) label.style.opacity = '0.5';
                                    } else {
                                        item.style.opacity = '1';
                                        const colorBox = item.querySelector('div:first-child');
                                        const label = item.querySelector('span');
                                        if (colorBox) colorBox.style.opacity = '1';
                                        if (label) label.style.opacity = '1';
                                    }
                                }
                            }
                        });
                    }
                }
                
                    // Update visible item state
                    const visibleMeta = currentChart.getDatasetMeta(firstItem.originalIndex);
                    if (visibleMeta) {
                        if (visibleMeta.hidden) {
                            visibleItem.style.opacity = '0.5';
                            colorBox.style.opacity = '0.5';
                            label.style.opacity = '0.5';
                        } else {
                            visibleItem.style.opacity = '1';
                            colorBox.style.opacity = '1';
                            label.style.opacity = '1';
                        }
                        // Update visible eye icon state
                        updateVisibleEyeIconState(!visibleMeta.hidden);
                    }
                    
                    currentChart.update();
            } catch (error) {
                console.error('Error showing only this series:', error);
            }
        });
        
        visibleItem.appendChild(colorBox);
        visibleItem.appendChild(label);
        visibleItem.appendChild(visibleEyeIcon);
        
        // Set initial visual state if series is already hidden
        try {
            const initialMeta = chart.getDatasetMeta(firstItem.originalIndex);
            if (initialMeta && initialMeta.hidden) {
                visibleItem.style.opacity = '0.5';
                colorBox.style.opacity = '0.5';
                label.style.opacity = '0.5';
            }
        } catch (error) {
            // Ignore errors during initial state check
        }
        
        console.log('Attaching click listener to visible legend item for index', firstItem.originalIndex);
        
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
        
        console.log(`[TooltipLegend] Setting popup max-height to: ${popupMaxHeight}px (chart: ${chartHeight}px + container: ~${estimatedLegendContainerHeight}px), max-width to: ${chartWidth}px`);
        
        // Create popup container (hidden by default)
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
        
        // Create scrollable list for all items
        const legendList = document.createElement('div');
        legendList.className = 'genie-legend-list';
        legendList.style.cssText = `
            padding: 2px 0;
            max-height: ${popupMaxHeight}px;
            overflow-y: auto;
            overflow-x: hidden;
            pointer-events: auto;
        `.replace(/\s+/g, ' ').trim();
        
        // Create all legend items in popup
        console.log(`[TooltipLegend] Creating popup items for ${datasetsWithIndex.length} datasets`);
        datasetsWithIndex.forEach((item, sortedIndex) => {
            const dataset = item.dataset;
            const originalIndex = item.originalIndex;
            
            console.log(`[TooltipLegend] Creating popup item ${sortedIndex}: label="${dataset.label}", originalIndex=${originalIndex}`);
            
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
            
            // Eye icon to show only this series
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
                        // Active state: outline eye with blue color (like hover)
                        svg.setAttribute('fill', 'none');
                        svg.setAttribute('stroke', 'currentColor');
                        eyeIcon.style.color = '#3b82f6';
                        eyeIcon.style.opacity = '1';
                    } else {
                        // Inactive state: outline eye with gray color
                        svg.setAttribute('fill', 'none');
                        svg.setAttribute('stroke', 'currentColor');
                        eyeIcon.style.color = '#6b7280';
                        eyeIcon.style.opacity = '0.7';
                    }
                }
            };
            
            // Set initial state
            try {
                const initialMeta = chart.getDatasetMeta(originalIndex);
                if (initialMeta) {
                    updateEyeIconState(!initialMeta.hidden);
                }
            } catch (error) {
                // Default to active if can't determine
                updateEyeIconState(true);
            }
            
            // Hover effect for eye icon
            eyeIcon.addEventListener('mouseenter', () => {
                eyeIcon.style.opacity = '1';
                if (eyeIcon.style.color !== '#3b82f6') {
                    eyeIcon.style.color = '#3b82f6';
                }
            });
            eyeIcon.addEventListener('mouseleave', () => {
                // Restore state based on visibility
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
            
            // Click handler for eye icon - toggle all other series
            eyeIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                // Get current chart from dashboard instance
                const currentChart = dashboard.charts?.[panelId] || chart;
                
                if (!currentChart || !currentChart.canvas || typeof currentChart.getDatasetMeta !== 'function') {
                    return;
                }
                
                try {
                    // Toggle each other series individually:
                    // - If disabled (hidden) → enable (show)
                    // - If enabled (visible) → disable (hide)
                    const allDatasets = currentChart.data.datasets || [];
                    allDatasets.forEach((dataset, idx) => {
                        if (idx !== originalIndex) {
                            const meta = currentChart.getDatasetMeta(idx);
                            if (meta) {
                                // Toggle: if hidden, show it; if visible, hide it
                                meta.hidden = !meta.hidden;
                            }
                        }
                    });
                    
                    // Update visual states of all legend items
                    const allLegendItems = legendList.querySelectorAll('.genie-legend-item');
                    allLegendItems.forEach((item, idx) => {
                        const itemOriginalIndex = datasetsWithIndex[idx]?.originalIndex;
                        if (itemOriginalIndex !== undefined) {
                            const meta = currentChart.getDatasetMeta(itemOriginalIndex);
                            if (meta) {
                                if (meta.hidden) {
                                    item.style.opacity = '0.5';
                                    const colorBox = item.querySelector('div:first-child');
                                    const label = item.querySelector('span');
                                    if (colorBox) colorBox.style.opacity = '0.5';
                                    if (label) label.style.opacity = '0.5';
                                } else {
                                    item.style.opacity = '1';
                                    const colorBox = item.querySelector('div:first-child');
                                    const label = item.querySelector('span');
                                    if (colorBox) colorBox.style.opacity = '1';
                                    if (label) label.style.opacity = '1';
                                }
                                
                                // Update eye icon state for this item
                                const itemEyeIcon = item.querySelector('div:last-child');
                                if (itemEyeIcon && itemEyeIcon.querySelector('svg')) {
                                    const svg = itemEyeIcon.querySelector('svg');
                                    if (meta.hidden) {
                                        svg.setAttribute('fill', 'none');
                                        svg.setAttribute('stroke', 'currentColor');
                                        itemEyeIcon.style.color = '#6b7280';
                                        itemEyeIcon.style.opacity = '0.7';
                                    } else {
                                        // Active state: outline eye with blue color (like hover)
                                        svg.setAttribute('fill', 'none');
                                        svg.setAttribute('stroke', 'currentColor');
                                        itemEyeIcon.style.color = '#3b82f6';
                                        itemEyeIcon.style.opacity = '1';
                                    }
                                }
                            }
                        }
                    });
                    
                    // Update visible item state
                    const visibleMeta = currentChart.getDatasetMeta(firstItem.originalIndex);
                    if (visibleMeta) {
                        if (visibleMeta.hidden) {
                            visibleItem.style.opacity = '0.5';
                            colorBox.style.opacity = '0.5';
                            label.style.opacity = '0.5';
                        } else {
                            visibleItem.style.opacity = '1';
                            colorBox.style.opacity = '1';
                            label.style.opacity = '1';
                        }
                        // Update visible eye icon state
                        updateVisibleEyeIconState(!visibleMeta.hidden);
                    }
                    
                    currentChart.update();
                } catch (error) {
                    console.error('Error showing only this series:', error);
                }
            });
            
            legendItem.appendChild(itemColorBox);
            legendItem.appendChild(itemLabel);
            legendItem.appendChild(eyeIcon);
            
            // Set initial visual state if series is already hidden
            try {
                const initialMeta = chart.getDatasetMeta(originalIndex);
                if (initialMeta && initialMeta.hidden) {
                    legendItem.style.opacity = '0.5';
                    itemColorBox.style.opacity = '0.5';
                    itemLabel.style.opacity = '0.5';
                }
            } catch (error) {
                // Ignore errors during initial state check
            }
            
            // Toggle series on click
            console.log('Attaching click listener to legend item for index', originalIndex);
            legendItem.addEventListener('click', (e) => {
                console.log('Tooltip legend item clicked, originalIndex:', originalIndex);
                e.stopPropagation();
                e.preventDefault();
                
                // Get current chart from dashboard instance (chart may have been recreated)
                const currentChart = dashboard.charts?.[panelId] || chart;
                
                console.log('Current chart:', currentChart, 'panelId:', panelId);
                
                // Check if chart is still valid (not destroyed)
                if (!currentChart) {
                    console.warn('Chart is null');
                    return;
                }
                if (!currentChart.canvas) {
                    console.warn('Chart canvas is null');
                    return;
                }
                if (typeof currentChart.getDatasetMeta !== 'function') {
                    console.warn('chart.getDatasetMeta is not a function');
                    return;
                }
                try {
                    const meta = currentChart.getDatasetMeta(originalIndex);
                    console.log('Got meta for index', originalIndex, ':', meta);
                    if (meta) {
                        console.log('Toggling series, current hidden state:', meta.hidden);
                        meta.hidden = !meta.hidden;
                        console.log('New hidden state:', meta.hidden);
                        
                        // Update visual state - fade when hidden
                        if (meta.hidden) {
                            legendItem.style.opacity = '0.5';
                            itemColorBox.style.opacity = '0.5';
                            itemLabel.style.opacity = '0.5';
                        } else {
                            legendItem.style.opacity = '1';
                            itemColorBox.style.opacity = '1';
                            itemLabel.style.opacity = '1';
                        }
                        
                        // Update eye icon state
                        updateEyeIconState(!meta.hidden);
                        
                        currentChart.update(); // Use update() without 'none' to ensure visual update
                        console.log('Chart updated');
                    } else {
                        console.warn('Meta is null for index', originalIndex);
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
            
            legendList.appendChild(legendItem);
            console.log(`[TooltipLegend] Appended popup item ${sortedIndex} to legendList: "${dataset.label}"`);
        });
        
        popupContainer.appendChild(legendList);
        console.log(`[TooltipLegend] Popup created with ${legendList.children.length} items total`);
        // Verify all items are actually in the DOM
        const verifyItems = legendList.querySelectorAll('.genie-legend-item');
        const verifyLabels = Array.from(verifyItems).map(item => {
            const labelEl = item.querySelector('span');
            return labelEl ? labelEl.textContent : 'no label';
        });
        console.log(`[TooltipLegend] Verification - ${verifyItems.length} items found in DOM after creation:`, verifyLabels);
        if (verifyItems.length !== datasetsWithIndex.length) {
            console.warn(`[TooltipLegend] WARNING: Expected ${datasetsWithIndex.length} items but found ${verifyItems.length} in DOM!`);
        }
        
        // Show/hide popup on hover
        let hoverTimeout = null;
        let isClicking = false; // Track if user is clicking to prevent popup from closing
        visibleItem.addEventListener('mouseenter', () => {
            if (hoverTimeout) clearTimeout(hoverTimeout);
            popupContainer.style.display = 'block';
            // Log what items are actually in the popup when displayed
            // Query dynamically from popupContainer to get the current legendList (in case popup was recreated)
            // Check for multiple tooltip containers in the DOM
            const allTooltipContainers = panelElement ? panelElement.querySelectorAll('.genie-legend-tooltip-container') : [];
            const allTooltipPopups = panelElement ? panelElement.querySelectorAll('.genie-legend-tooltip-popup') : [];
            console.log(`[TooltipLegend] Found ${allTooltipContainers.length} tooltip container(s) and ${allTooltipPopups.length} tooltip popup(s) in panel`);
            if (allTooltipContainers.length > 1) {
                console.warn(`[TooltipLegend] WARNING: Multiple tooltip containers found! This may cause issues.`);
            }
            if (allTooltipPopups.length > 1) {
                console.warn(`[TooltipLegend] WARNING: Multiple tooltip popups found! This may cause issues.`);
            }
            
            const currentLegendList = popupContainer.querySelector('.genie-legend-list');
            console.log(`[TooltipLegend] Popup displayed - legendList found:`, !!currentLegendList);
            if (currentLegendList) {
                console.log(`[TooltipLegend] legendList children count:`, currentLegendList.children.length);
                console.log(`[TooltipLegend] legendList innerHTML length:`, currentLegendList.innerHTML.length);
                // Log all direct children
                console.log(`[TooltipLegend] Direct children:`, Array.from(currentLegendList.children).map((child, idx) => ({
                    index: idx,
                    className: child.className,
                    tagName: child.tagName,
                    textContent: child.textContent?.substring(0, 50)
                })));
                // Check if items are nested
                const allItems = currentLegendList.querySelectorAll('.genie-legend-item');
                console.log(`[TooltipLegend] All .genie-legend-item found (including nested):`, allItems.length);
                // Check popup container structure
                console.log(`[TooltipLegend] Popup container children:`, Array.from(popupContainer.children).map((child, idx) => ({
                    index: idx,
                    className: child.className,
                    tagName: child.tagName
                })));
            }
            const actualItems = currentLegendList ? currentLegendList.querySelectorAll('.genie-legend-item') : [];
            const actualLabels = Array.from(actualItems).map(item => {
                const labelEl = item.querySelector('span');
                return labelEl ? labelEl.textContent : 'no label';
            });
            console.log(`[TooltipLegend] Popup displayed - ${actualItems.length} items in DOM:`, actualLabels);
            // Also log what datasets are in the chart for comparison
            const currentChart = dashboard.charts?.[panelId] || chart;
            const chartLabels = (currentChart.data.datasets || []).map(d => d.label);
            console.log(`[TooltipLegend] Chart has ${chartLabels.length} datasets:`, chartLabels);
            // Check if popup is being clipped
            const popupRect = popupContainer.getBoundingClientRect();
            const listRect = currentLegendList ? currentLegendList.getBoundingClientRect() : null;
            console.log(`[TooltipLegend] Popup dimensions:`, {
                popupHeight: popupRect.height,
                popupMaxHeight: popupContainer.style.maxHeight,
                listHeight: listRect ? listRect.height : 0,
                listScrollHeight: currentLegendList ? currentLegendList.scrollHeight : 0,
                popupOverflow: window.getComputedStyle(popupContainer).overflowY
            });
        });
        
        visibleItem.addEventListener('mouseleave', () => {
            if (!isClicking) {
                hoverTimeout = setTimeout(() => {
                    popupContainer.style.display = 'none';
                }, 100);
            }
        });
        
        popupContainer.addEventListener('mouseenter', () => {
            if (hoverTimeout) clearTimeout(hoverTimeout);
        });
        
        popupContainer.addEventListener('mouseleave', (e) => {
            // Don't close if mouse is moving to a legend item or if clicking
            if (isClicking || (e.relatedTarget && legendList.contains(e.relatedTarget))) {
                return;
            }
            popupContainer.style.display = 'none';
        });
        
        // Keep popup open when clicking on legend items
        legendList.addEventListener('mousedown', () => {
            isClicking = true;
            if (hoverTimeout) clearTimeout(hoverTimeout);
        });
        
        legendList.addEventListener('mouseup', () => {
            // Reset after a short delay to allow click handler to complete
            setTimeout(() => {
                isClicking = false;
            }, 100);
        });
        
        // Toggle first series on click
        visibleItem.addEventListener('click', (e) => {
            console.log('Visible legend item clicked, originalIndex:', firstItem.originalIndex);
            e.stopPropagation();
            e.preventDefault();
            
            // Get current chart from dashboard instance (chart may have been recreated)
            const currentChart = dashboard.charts?.[panelId] || chart;
            
            console.log('Current chart:', currentChart, 'panelId:', panelId);
            
            // Check if chart is still valid (not destroyed)
            if (!currentChart) {
                console.warn('Chart is null');
                return;
            }
            if (!currentChart.canvas) {
                console.warn('Chart canvas is null');
                return;
            }
            if (typeof currentChart.getDatasetMeta !== 'function') {
                console.warn('chart.getDatasetMeta is not a function');
                return;
            }
            try {
                const meta = currentChart.getDatasetMeta(firstItem.originalIndex);
                console.log('Got meta for index', firstItem.originalIndex, ':', meta);
                if (meta) {
                    console.log('Toggling series, current hidden state:', meta.hidden);
                    meta.hidden = !meta.hidden;
                    console.log('New hidden state:', meta.hidden);
                    
                    // Update visual state - fade when hidden
                    if (meta.hidden) {
                        visibleItem.style.opacity = '0.5';
                        colorBox.style.opacity = '0.5';
                        label.style.opacity = '0.5';
                    } else {
                        visibleItem.style.opacity = '1';
                        colorBox.style.opacity = '1';
                        label.style.opacity = '1';
                    }
                    
                    // Update visible eye icon state
                    updateVisibleEyeIconState(!meta.hidden);
                    
                    currentChart.update(); // Use update() without 'none' to ensure visual update
                    console.log('Chart updated');
                } else {
                    console.warn('Meta is null for index', firstItem.originalIndex);
                }
            } catch (error) {
                console.error('Error toggling series visibility:', error);
            }
        });
        
        legendContainer.appendChild(visibleItem);
        legendContainer.appendChild(popupContainer);
        // Append to panelContent instead of chartContent so it can be positioned relative to panelContent
        const panelContent = panelElement?.querySelector('.genie-dashboard-panel-content');
        if (panelContent) {
            panelContent.appendChild(legendContainer);
        } else {
            // Fallback to container if panelContent not found
            container.appendChild(legendContainer);
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
        console.log(`[TooltipLegend] After creation - Found ${afterCreationContainers.length} tooltip container(s), ${afterCreationPopups.length} popup(s) in panel`);
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
            
            console.log(`[TooltipLegend] Refresh check - count: ${currentDatasetsCount} (was ${storedCount}), labels changed: ${labelsChanged}`, 
                currentDatasetsCount > 0 ? `Current labels: ${(currentChart.data.datasets || []).map(d => d.label).join(', ')}` : '');
            
            // Always refresh if datasets exist, even if count/labels haven't changed
            // This ensures we capture all datasets even if they were added before initial creation
            if (countChanged || labelsChanged || currentDatasetsCount > 0) {
                const shouldRefresh = countChanged || labelsChanged;
                console.log(`[TooltipLegend] Refresh check result - shouldRefresh: ${shouldRefresh}, count: ${storedCount} -> ${currentDatasetsCount}, labels changed: ${labelsChanged}`);
                console.log(`[TooltipLegend] All dataset labels:`, (currentChart.data.datasets || []).map(d => d.label));
                
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
                    
                    console.log(`[TooltipLegend] Popup check - existing items: ${checkItemCount}, expected: ${currentDatasetsCount}, legendContainer found: ${!!currentLegendContainer}, popup found: ${!!checkPopup}`);
                    
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
                        
                        console.log(`[TooltipLegend] Popup item labels check:`, {
                            currentLabels: currentLabels,
                            popupLabels: popupLabels,
                            labelsMatch: labelsMatch
                        });
                        
                        if (!labelsMatch) {
                            console.log(`[TooltipLegend] Forcing refresh - popup labels don't match current datasets`);
                            // Update stored values
                            currentChart._tooltipLegendDatasetsCount = currentDatasetsCount;
                            currentChart._tooltipLegendDatasetLabels = currentDatasetLabels;
                            chart._tooltipLegendDatasetsCount = currentDatasetsCount;
                            chart._tooltipLegendDatasetLabels = currentDatasetLabels;
                        } else {
                            // Popup exists and has correct items, no refresh needed
                            console.log(`[TooltipLegend] Popup is up to date, no refresh needed`);
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
                
                // Re-create visible item (first one)
                const firstItem = datasetsWithIndex[0];
                const firstDataset = firstItem.dataset;
                
                const newVisibleItem = document.createElement('div');
                newVisibleItem.className = 'genie-legend-tooltip-item';
                newVisibleItem.style.cssText = `
                    display: flex;
                    align-items: center;
                    padding: 4px 8px;
                    background: rgba(255, 255, 255, 0.9);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    user-select: none;
                `.replace(/\s+/g, ' ').trim();
                
                const colorBox = document.createElement('div');
                colorBox.style.cssText = `
                    width: 10px;
                    height: 10px;
                    background: ${firstDataset.borderColor || firstDataset.backgroundColor || '#3b82f6'};
                    margin-right: 6px;
                    border-radius: 2px;
                    flex-shrink: 0;
                `.replace(/\s+/g, ' ').trim();
                
                const label = document.createElement('span');
                label.textContent = firstDataset.label || 'Series 1';
                label.style.cssText = `
                    font-size: 12px;
                    color: #374151;
                    white-space: nowrap;
                `.replace(/\s+/g, ' ').trim();
                
                newVisibleItem.appendChild(colorBox);
                newVisibleItem.appendChild(label);
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
                
                // Re-create popup with all items (reuse existing popup creation logic)
                const popupContainer = document.createElement('div');
                popupContainer.className = 'genie-legend-tooltip-popup';
                popupContainer.style.cssText = `
                    position: absolute;
                    top: 100%;
                    left: 0;
                    margin-top: 4px;
                    background: rgba(255, 255, 255, 0.98);
                    border: 1px solid #e5e7eb;
                    border-radius: 4px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    display: none;
                    z-index: 1000;
                    min-width: 200px;
                    max-width: ${refreshChartWidth}px;
                    max-height: ${refreshPopupMaxHeight}px;
                    overflow-y: auto;
                    overflow-x: hidden;
                    pointer-events: auto;
                `.replace(/\s+/g, ' ').trim();
                
                const legendList = document.createElement('div');
                legendList.className = 'genie-legend-list';
                legendList.style.cssText = `
                    padding: 2px 0;
                    max-height: ${refreshPopupMaxHeight}px;
                    overflow-y: auto;
                    overflow-x: hidden;
                    pointer-events: auto;
                `.replace(/\s+/g, ' ').trim();
                
                // Re-create all legend items
                console.log(`[TooltipLegend] Refreshing - creating popup items for ${datasetsWithIndex.length} datasets`);
                datasetsWithIndex.forEach((item, sortedIndex) => {
                    const dataset = item.dataset;
                    const originalIndex = item.originalIndex;
                    
                    console.log(`[TooltipLegend] Refreshing - creating popup item ${sortedIndex}: label="${dataset.label}", originalIndex=${originalIndex}`);
                    
                    const legendItem = document.createElement('div');
                    legendItem.className = 'genie-legend-item';
                    legendItem.style.cssText = `
                        display: flex;
                        align-items: center;
                        padding: 2px 8px;
                        cursor: pointer;
                        pointer-events: auto;
                    `.replace(/\s+/g, ' ').trim();
                    
                    const itemColorBox = document.createElement('div');
                    itemColorBox.style.cssText = `
                        width: 10px;
                        height: 10px;
                        background: ${dataset.borderColor || dataset.backgroundColor || '#3b82f6'};
                        margin-right: 6px;
                        border-radius: 2px;
                        flex-shrink: 0;
                    `.replace(/\s+/g, ' ').trim();
                    
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
                    
                    legendItem.appendChild(itemColorBox);
                    legendItem.appendChild(itemLabel);
                    legendItem.appendChild(eyeIcon);
                    
                    // Set initial opacity based on hidden state
                    try {
                        const meta = currentChart.getDatasetMeta(originalIndex);
                        if (meta && meta.hidden) {
                            legendItem.style.opacity = '0.5';
                            itemColorBox.style.opacity = '0.5';
                            itemLabel.style.opacity = '0.5';
                        }
                    } catch (error) {
                        // Ignore errors
                    }
                    
                    // Click handler to toggle series
                    legendItem.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const clickChart = dashboard.charts?.[panelId] || chart;
                        if (!clickChart || !clickChart.canvas) {
                            return;
                        }
                        
                        try {
                            const meta = clickChart.getDatasetMeta(originalIndex);
                            if (meta) {
                                meta.hidden = !meta.hidden;
                                clickChart.update();
                                
                                // Update visual state
                                legendItem.style.opacity = meta.hidden ? '0.5' : '1';
                                itemColorBox.style.opacity = meta.hidden ? '0.5' : '1';
                                itemLabel.style.opacity = meta.hidden ? '0.5' : '1';
                            }
                        } catch (error) {
                            console.error('Error toggling series:', error);
                        }
                    });
                    
                    legendList.appendChild(legendItem);
                    console.log(`[TooltipLegend] Refreshing - appended popup item ${sortedIndex} to legendList: "${dataset.label}"`);
                });
                
                popupContainer.appendChild(legendList);
                currentLegendContainer.appendChild(popupContainer);
                console.log(`[TooltipLegend] Refreshed popup created with ${legendList.children.length} items total`);
                
                // Re-attach hover handlers
                newVisibleItem.addEventListener('mouseenter', () => {
                    if (hoverTimeout) clearTimeout(hoverTimeout);
                    popupContainer.style.display = 'block';
                    // Log what items are actually in the popup when displayed
                    // Query dynamically from popupContainer to get the current legendList (in case popup was recreated)
                    const currentLegendList = popupContainer.querySelector('.genie-legend-list');
                    const actualItems = currentLegendList ? currentLegendList.querySelectorAll('.genie-legend-item') : [];
                    const actualLabels = Array.from(actualItems).map(item => {
                        const labelEl = item.querySelector('span');
                        return labelEl ? labelEl.textContent : 'no label';
                    });
                    console.log(`[TooltipLegend] Popup displayed (after refresh) - ${actualItems.length} items in DOM:`, actualLabels);
                    // Also log what datasets are in the chart for comparison
                    const currentChart = dashboard.charts?.[panelId] || chart;
                    const chartLabels = (currentChart.data.datasets || []).map(d => d.label);
                    console.log(`[TooltipLegend] Chart has ${chartLabels.length} datasets:`, chartLabels);
                });
                
                let isClicking = false;
                popupContainer.addEventListener('mouseleave', (e) => {
                    if (!isClicking) {
                        popupContainer.style.display = 'none';
                    }
                });
                
                legendContainer.addEventListener('mouseleave', () => {
                    if (!isClicking) {
                        popupContainer.style.display = 'none';
                    }
                });
            }
        };
        
        // Hook into chart updates to reposition legend and refresh items
        const originalUpdate = chart.update.bind(chart);
        chart.update = function(mode, transition) {
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
    renderStatsTable(panel, dataArray, container, statsToShow, previousDataArray = null, isTransposed = null, previousDuration = null) {
        console.log(`[renderStatsTable] Called with previousDataArray:`, previousDataArray ? `${previousDataArray.length} targets` : 'null', 'previousDuration:', previousDuration);
        
        // Check if dashboard is collapsed - if so, don't render the table yet
        // The table will be rendered when the dashboard expands
        const dashboardGrid = document.getElementById(this.getInstanceId('grid'));
        const isDashboardCollapsed = dashboardGrid && dashboardGrid.classList.contains('genie-dashboard-collapsed');
        if (isDashboardCollapsed) {
            console.log(`[renderStatsTable] Dashboard is collapsed, skipping table render for panel ${panel.id}`);
            // Store the render parameters so we can render later when expanded
            panel._pendingStatsTableRender = {
                dataArray: dataArray,
                container: container,
                statsToShow: statsToShow,
                previousDataArray: previousDataArray,
                isTransposed: isTransposed,
                previousDuration: previousDuration
            };
            // Clear container but don't render
            container.innerHTML = '';
            return;
        }
        
        // Remove any existing table wrappers first to prevent overlapping
        const existingWrappers = container.querySelectorAll('.genie-dashboard-stats-table-wrapper');
        existingWrappers.forEach(wrapper => {
            wrapper.style.display = 'none';
            wrapper.remove();
        });
        
        // Clear container completely
        container.innerHTML = '';
        
        // Add a dummy spacer div at the top to push table down below panel header
        // This only affects stats view, not chart view
        const panelElementForSpacer = container.closest('.genie-dashboard-panel');
        const panelHeader = panelElementForSpacer ? panelElementForSpacer.querySelector('.genie-dashboard-panel-header') : null;
        if (panelHeader) {
            const panelHeaderHeight = panelHeader.offsetHeight;
            if (panelHeaderHeight > 0) {
                const spacerDiv = document.createElement('div');
                spacerDiv.className = 'genie-dashboard-stats-spacer';
                spacerDiv.style.height = panelHeaderHeight + 'px';
                spacerDiv.style.width = '100%';
                spacerDiv.style.flexShrink = '0';
                spacerDiv.style.pointerEvents = 'none'; // Don't interfere with interactions
                container.appendChild(spacerDiv);
            }
        }
        
        // Check panel config for default transpose setting
        // If isTransposed is explicitly null, use panel config, otherwise use the provided value
        if (isTransposed === null) {
            // Check multiple possible locations for transpose config
            isTransposed = panel.statsTable?.transpose === true || 
                          panel.options?.statsTable?.transpose === true ||
                          panel.transpose === true ||
                          false;
        }
        
        // Get aggregation config and apply to data arrays if enabled
        // Check panel.aggregation first (preferred), then panel.timeSeries.aggregation (backward compatibility)
        const aggregationConfig = panel.aggregation || 
                                  panel.options?.aggregation ||
                                  panel.timeSeries?.aggregation || 
                                  panel.options?.timeSeries?.aggregation || 
                                  null;
        let processedDataArray = dataArray;
        let processedPreviousDataArray = previousDataArray;
        
        // Get span aggregation config (can be applied even without aggregation tag)
        const spanAggregation = aggregationConfig?.span || this.inputConfig['$interval'] || null;
        const spanAggregationType = aggregationConfig?.spanAggregation || this.inputConfig['$agg'] || null;
        
        // Apply span aggregation to all series if configured (even without aggregation tag)
        if (spanAggregation && spanAggregationType) {
            processedDataArray = this.applySpanAggregationToAllSeries(dataArray, spanAggregation, spanAggregationType);
            if (previousDataArray && previousDataArray.length > 0) {
                processedPreviousDataArray = this.applySpanAggregationToAllSeries(previousDataArray, spanAggregation, spanAggregationType);
            }
        }
        
        // Apply series aggregation (grouping by tag) if enabled
        if (panel._aggregationEnabled && panel._aggregationType && aggregationConfig) {
            const aggregationTag = aggregationConfig.tag || null;
            
            if (aggregationTag) {
                // Apply aggregation to current data (span aggregation already applied above)
                processedDataArray = this.applySeriesAggregation(
                    processedDataArray,
                    aggregationTag,
                    panel._aggregationType,
                    null, // Don't apply span aggregation again - already done
                    null
                );
                
                // Apply aggregation to previous data if it exists (span aggregation already applied above)
                if (processedPreviousDataArray && processedPreviousDataArray.length > 0) {
                    processedPreviousDataArray = this.applySeriesAggregation(
                        processedPreviousDataArray,
                        aggregationTag,
                        panel._aggregationType,
                        null, // Don't apply span aggregation again - already done
                        null
                    );
                }
            }
        }
        
        // Get base_series config for percentage calculation (will be used after seriesData is populated)
        const baseSeriesName = panel.statsTable?.base_series || panel.options?.statsTable?.base_series || null;
        
        // Stats container height should match chartContent height exactly
        // This is set in renderTimeSeriesChart's updateAllHeights() function
        // If height is already set, use it; otherwise calculate from gridPos.h
        const gridPosForStats = panel.gridPos || { h: 8 };
        const rowHeightPerUnit = this.rowHeightPerUnit || 38;
        const headerHeight = 40; // Will be measured in updateAllHeights
        const calculatedStatsHeight = (gridPosForStats.h * rowHeightPerUnit) - headerHeight;
        
        // If height is not already set by updateAllHeights, set it now
        if (!container.style.height || container.style.height === '') {
            container.style.setProperty('height', Math.max(200, calculatedStatsHeight) + 'px', 'important');
        }
        // Container should not scroll - we'll create a scrollable wrapper inside
        container.style.setProperty('overflow', 'hidden', 'important');
        container.style.setProperty('box-sizing', 'border-box', 'important');
        container.style.setProperty('display', 'flex', 'important');
        container.style.setProperty('flex-direction', 'column', 'important');
        
        if (!dataArray || dataArray.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280;">No data available</div>';
            return;
        }
        
        // Extract all series and their values
        // Structure: Map of displayName -> Map of metric -> { values, stats }
        const seriesDataMap = new Map(); // Map<displayName, Map<metric, {values, stats}>>
        const previousSeriesData = new Map(); // Map<displayName, Map<metric, stats>>
        
        // Get the field name to use for series name in stats table (if specified)
        // This only affects stats table, not timeseries chart
        const statsTableDisplayNameField = panel.statsTable?.displayName || panel.options?.statsTable?.displayName || null;
        
        // Helper function to get series name for stats table
        // If statsTable.displayName is specified, use that field from series object
        // Otherwise, use the standard getSeriesName method
        const getSeriesNameForStats = (series, target, panel) => {
            if (statsTableDisplayNameField) {
                // Use the specified field directly from the series object
                const fieldValue = series[statsTableDisplayNameField];
                if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
                    return String(fieldValue);
                }
                // Fallback if field doesn't exist or is empty
                return this.getSeriesName(series, target, panel);
            }
            // Default: use standard getSeriesName method
            return this.getSeriesName(series, target, panel);
        };
        
        // Extract current period data
        processedDataArray.forEach((targetData) => {
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
                const seriesName = getSeriesNameForStats(series, target, panel);
                const metric = series.metric || ''; // Get metric from series
                let dataPoints = this.extractDataPoints(series);
                
                // Filter data points by zoom range if zoom is enabled and range is set
                if ((panel.options?.timeSeries?.zoom || panel.options?.timeSeries?.zoomSlider) && 
                    panel._zoomRange && 
                    panel._zoomRange.min !== null && 
                    panel._zoomRange.max !== null) {
                    const zoomMin = panel._zoomRange.min;
                    const zoomMax = panel._zoomRange.max;
                    dataPoints = dataPoints.filter(dp => {
                        if (!dp.time) return false;
                        const timestamp = dp.time.getTime ? dp.time.getTime() : (typeof dp.time === 'number' ? dp.time : new Date(dp.time).getTime());
                        return timestamp >= zoomMin && timestamp <= zoomMax;
                    });
                }
                
                // Extract values, filtering out null/undefined/NaN
                const values = dataPoints
                    .map(dp => dp.value)
                    .filter(v => v !== null && v !== undefined && !isNaN(v));
                
                if (values.length > 0) {
                    // Group by displayName, then by metric
                    if (!seriesDataMap.has(seriesName)) {
                        seriesDataMap.set(seriesName, new Map());
                    }
                    const metricMap = seriesDataMap.get(seriesName);
                    metricMap.set(metric, {
                        name: seriesName,
                        metric: metric,
                        values: values,
                        stats: this.calculateSeriesStats(values, statsToShow, seriesName)
                    });
                }
            });
        });
        
        // Convert map to array format for backward compatibility
        // If multiple metrics exist for same displayName, we'll handle them separately
        const seriesData = [];
        const displayNameToMetrics = new Map(); // Track which displayNames have multiple metrics
        
        seriesDataMap.forEach((metricMap, displayName) => {
            const metrics = Array.from(metricMap.keys());
            const hasMultipleMetrics = metrics.length > 1;
            displayNameToMetrics.set(displayName, { metrics, hasMultipleMetrics });
            
            // Add each metric as a separate entry
            metricMap.forEach((seriesInfo, metric) => {
                seriesData.push({
                    name: displayName,
                    metric: metric,
                    values: seriesInfo.values,
                    stats: seriesInfo.stats,
                    hasMultipleMetrics: hasMultipleMetrics
                });
            });
        });
        
        // Extract previous period data if available
        if (processedPreviousDataArray) {
            processedPreviousDataArray.forEach((targetData) => {
                const response = targetData.data;
                const target = targetData.target;
                
                let seriesArray = [];
                
                if (Array.isArray(response)) {
                    seriesArray = response;
                } else if (response.datapoints) {
                    seriesArray = [response];
                } else if (response.times && response.values) {
                    seriesArray = [response];
                }
                
                seriesArray.forEach(series => {
                    const seriesName = getSeriesNameForStats(series, target, panel);
                    const metric = series.metric || ''; // Get metric from series
                    let dataPoints = this.extractDataPoints(series);
                    
                    // Filter data points by zoom range if zoom is enabled and range is set
                    // For previous data, shift the zoom range back by the previous duration
                    if ((panel.options?.timeSeries?.zoom || panel.options?.timeSeries?.zoomSlider) && 
                        panel._zoomRange && 
                        panel._zoomRange.min !== null && 
                        panel._zoomRange.max !== null) {
                        let zoomMin = panel._zoomRange.min;
                        let zoomMax = panel._zoomRange.max;
                        
                        // If this is previous data, shift the zoom range back by the previous duration
                        if (previousDuration) {
                            const previousOffset = this.parseDuration(previousDuration);
                            zoomMin = zoomMin - previousOffset;
                            zoomMax = zoomMax - previousOffset;
                        }
                        
                        dataPoints = dataPoints.filter(dp => {
                            if (!dp.time) return false;
                            const timestamp = dp.time.getTime ? dp.time.getTime() : (typeof dp.time === 'number' ? dp.time : new Date(dp.time).getTime());
                            return timestamp >= zoomMin && timestamp <= zoomMax;
                        });
                    }
                    
                    const values = dataPoints
                        .map(dp => dp.value)
                        .filter(v => v !== null && v !== undefined && !isNaN(v));
                    
                    if (values.length > 0) {
                        // Store previous stats by displayName and metric
                        const key = `${seriesName}|${metric}`;
                        previousSeriesData.set(key, this.calculateSeriesStats(values, statsToShow, seriesName));
                    }
                });
            });
        }
        
        if (seriesData.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280;">No valid data points found</div>';
            return;
        }
        
        // Group series by displayName for easier lookup
        const seriesByDisplayName = new Map(); // Map<displayName, Array<{metric, values, stats}>>
        seriesData.forEach(series => {
            if (!seriesByDisplayName.has(series.name)) {
                seriesByDisplayName.set(series.name, []);
            }
            seriesByDisplayName.get(series.name).push(series);
        });
        
        // Add series that only exist in previous data (with postfix to indicate they're from previous period)
        if (processedPreviousDataArray && previousSeriesData.size > 0) {
            // Get all current series keys
            const currentSeriesKeys = new Set();
            seriesData.forEach(series => {
                const key = `${series.name}|${series.metric || ''}`;
                currentSeriesKeys.add(key);
            });
            
            // Find previous series that don't exist in current data
            previousSeriesData.forEach((prevStats, key) => {
                if (!currentSeriesKeys.has(key)) {
                    // Parse key to get displayName and metric
                    const [displayName, metric] = key.split('|');
                    const metricKey = metric || '';
                    
                    // Format duration postfix (e.g., "-1d", "-7d")
                    const durationText = previousDuration ? (previousDuration.startsWith('-') ? previousDuration : '-' + previousDuration) : '';
                    const displayNameWithPostfix = durationText ? `${displayName}${durationText}` : displayName;
                    
                    // Add to seriesByDisplayName as a "previous-only" series
                    // Create a pseudo-series object with stats from previous data
                    if (!seriesByDisplayName.has(displayNameWithPostfix)) {
                        seriesByDisplayName.set(displayNameWithPostfix, []);
                    }
                    
                    // Create a mock series object for previous-only data
                    // We need to reconstruct what would be in seriesData, but using previous stats
                    seriesByDisplayName.get(displayNameWithPostfix).push({
                        name: displayNameWithPostfix, // Display name with postfix (e.g., "Series-1d")
                        originalName: displayName, // Original name without postfix (for lookup purposes)
                        metric: metricKey,
                        values: [], // No values available (we only have stats)
                        stats: prevStats,
                        hasMultipleMetrics: false, // We'll determine this later if needed
                        isPreviousOnly: true // Flag to indicate this is from previous period only
                    });
                }
            });
        }
        
        // Find base series now that seriesData is populated
        // For base series with multiple metrics, we'll use the first metric (alphabetically sorted) as the base
        let baseSeries = null;
        if (baseSeriesName) {
            // Find all series with the base displayName
            const baseSeriesList = seriesData.filter(s => s.name === baseSeriesName);
            if (baseSeriesList.length > 0) {
                // Sort by metric name and use the first one as the base
                baseSeriesList.sort((a, b) => {
                    const metricA = a.metric || '';
                    const metricB = b.metric || '';
                    return metricA.localeCompare(metricB);
                });
                baseSeries = baseSeriesList[0];
            }
        }
        
        // Determine if we need metric-specific columns
        // Check if any displayName has multiple metrics
        let hasMultipleMetrics = false;
        seriesByDisplayName.forEach((seriesList) => {
            if (seriesList.length > 1) {
                hasMultipleMetrics = true;
            }
        });
        
        // Get or initialize percentage view state for this panel
        // Store it on the panel object to persist across re-renders
        const percentBase = panel.statsTable?.percentBase || panel.options?.statsTable?.percentBase || null;
        const percentTargets = panel.statsTable?.percentTargets || panel.options?.statsTable?.percentTargets || null;
        const hasPercentConfig = percentBase && percentTargets && Array.isArray(percentTargets) && percentTargets.length > 0;
        
        // Check if percentBase metric exists in the data
        let percentBaseMetricExists = false;
        if (hasPercentConfig) {
            // Check if any series has the percentBase metric
            seriesData.forEach(series => {
                if (series.metric === percentBase) {
                    percentBaseMetricExists = true;
                }
            });
        }
        
        // Store metric existence flag on panel for use in header controls
        panel._percentMetricExists = percentBaseMetricExists;
        
        // Only enable percentage view if config exists AND metric exists in data
        const shouldShowPercentIcon = hasPercentConfig && percentBaseMetricExists;
        // Only initialize if not already set (undefined), not if it's false (user disabled it)
        if (panel._percentViewEnabled === undefined && shouldShowPercentIcon) {
            panel._percentViewEnabled = true; // Default to enabled when config and metric exist
        }
        // Use the panel state if icon should be shown, otherwise false
        let percentViewEnabled = shouldShowPercentIcon ? (panel._percentViewEnabled === true) : false;
        
        // Update percent icon visibility in header if it exists
        // Find the percent icon button in the header
        const panelElement = container.closest('.genie-dashboard-panel');
        if (panelElement && shouldShowPercentIcon) {
            const percentIconButton = panelElement.querySelector('.genie-dashboard-tabs .genie-dashboard-tab .genie-dashboard-tab-icon');
            if (percentIconButton && percentIconButton.textContent === '%') {
                const percentButton = percentIconButton.closest('button');
                if (percentButton) {
                    // Show the button only if stats tab is active (percent view is only for stats, not timeseries)
                    const activeTab = panelElement.querySelector('.genie-dashboard-tab.genie-dashboard-active');
                    const isStatsTabActive = activeTab && activeTab.textContent.includes('🔢');
                    const isChartTabActive = activeTab && activeTab.textContent.includes('📈');
                    
                    if (isStatsTabActive && !isChartTabActive) {
                        // Only show if stats tab is active, not chart tab
                        percentButton.style.display = 'flex';
                    } else {
                        // Hide if chart tab is active or stats tab is not active
                        percentButton.style.display = 'none';
                    }
                }
            }
        }
        
        // Create scrollable wrapper for table
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'genie-dashboard-stats-table-wrapper';
        // Set height to fill available space and enable scrolling
        const containerHeight = container.offsetHeight || parseInt(container.style.height) || calculatedStatsHeight;
        tableWrapper.style.cssText = 'flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: auto; position: relative; height: 100%;';
        
        // Create table
        const table = document.createElement('table');
        table.className = 'genie-dashboard-stats-table';
        
        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Create Series header with transpose button
        const seriesHeader = document.createElement('th');
        seriesHeader.style.cssText = 'position: relative; user-select: none;';
        
        const seriesHeaderText = document.createElement('span');
        seriesHeaderText.textContent = isTransposed ? 'Stats' : 'Series';
        seriesHeader.appendChild(seriesHeaderText);
        
        // Add transpose button/icon
        const transposeButton = document.createElement('button');
        transposeButton.type = 'button'; // Prevent form submission
        transposeButton.className = 'genie-dashboard-transpose-button';
        transposeButton.innerHTML = '⇄'; // T-like icon (double arrow, same in both states)
        transposeButton.title = isTransposed ? 'Transpose to normal view' : 'Transpose table';
        
        // Style the button - highlight when transposed
        if (isTransposed) {
            transposeButton.style.cssText = 'margin-left: 8px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 4px; cursor: pointer; padding: 2px 6px; font-size: 14px; font-weight: 600; color: #3b82f6; vertical-align: middle; transition: all 0.2s ease;';
        } else {
            transposeButton.style.cssText = 'margin-left: 8px; background: transparent; border: 1px solid transparent; border-radius: 4px; cursor: pointer; padding: 2px 6px; font-size: 14px; opacity: 0.6; vertical-align: middle; transition: all 0.2s ease;';
        }
        
        transposeButton.addEventListener('mouseenter', () => {
            if (!isTransposed) {
                transposeButton.style.opacity = '1';
                transposeButton.style.borderColor = 'rgba(59, 130, 246, 0.3)';
            } else {
                transposeButton.style.background = 'rgba(59, 130, 246, 0.25)';
            }
        });
        transposeButton.addEventListener('mouseleave', () => {
            if (!isTransposed) {
                transposeButton.style.opacity = '0.6';
                transposeButton.style.borderColor = 'transparent';
            } else {
                transposeButton.style.background = 'rgba(59, 130, 246, 0.15)';
            }
        });
        transposeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            // Toggle transpose state and re-render, preserving previousDuration
            this.renderStatsTable(panel, dataArray, container, statsToShow, previousDataArray, !isTransposed, previousDuration);
        });
        seriesHeader.appendChild(transposeButton);
        
        headerRow.appendChild(seriesHeader);
        
        // Store sort state
        let currentSortColumn = null;
        let currentSortDirection = null;
        
        // Helper function to extract numeric value from cell text (ignoring percentage in brackets)
        const extractNumericValue = (cell) => {
            // Get text content, which will include percentage, then extract just the numeric part
            const cellText = cell.textContent || '';
            if (!cellText || cellText === 'N/A') return null;
            
            // Extract the main numeric value (before any brackets or parentheses)
            // This handles formats like "123.45 (+5.2%)" or "1,234.56 (-2.1%)"
            const match = cellText.match(/^([\d,]+\.?\d*)/);
            if (match) {
                // Remove commas and parse as float
                return parseFloat(match[1].replace(/,/g, ''));
            }
            return null;
        };
        
        // Function to sort table rows
        const sortTable = (columnIndex, direction) => {
            // Get tbody from table (it's created in the if/else blocks below)
            const tbodyElement = table.querySelector('tbody');
            if (!tbodyElement) {
                console.warn('sortTable: tbody not found');
                return;
            }
            
            const rows = Array.from(tbodyElement.querySelectorAll('tr'));
            
            rows.sort((a, b) => {
                const aCell = a.children[columnIndex];
                const bCell = b.children[columnIndex];
                
                const aValue = extractNumericValue(aCell);
                const bValue = extractNumericValue(bCell);
                
                // Handle null/undefined values
                if (aValue === null && bValue === null) return 0;
                if (aValue === null) return 1; // null values go to end
                if (bValue === null) return -1;
                
                // Compare values
                const comparison = aValue - bValue;
                return direction === 'asc' ? comparison : -comparison;
            });
            
            // Clear and re-append sorted rows
            tbodyElement.innerHTML = '';
            rows.forEach(row => tbodyElement.appendChild(row));
            
            // Update header classes
            const headers = headerRow.querySelectorAll('th.genie-dashboard-sortable');
            headers.forEach((th, idx) => {
                th.classList.remove('genie-dashboard-sort-asc', 'genie-dashboard-sort-desc');
                if (idx === columnIndex - 1) { // -1 because Series column is index 0
                    th.classList.add(direction === 'asc' ? 'genie-dashboard-sort-asc' : 'genie-dashboard-sort-desc');
                }
            });
            
            currentSortColumn = columnIndex;
            currentSortDirection = direction;
        };
        
        if (isTransposed) {
            // Transposed view: Stats as rows, Series as columns
            // If multiple metrics exist, show displayName(metric) as column headers
            if (hasMultipleMetrics) {
                // Get all unique metrics
                const allMetrics = new Set();
                seriesByDisplayName.forEach((seriesList) => {
                    seriesList.forEach(s => { if (s.metric) allMetrics.add(s.metric); });
                });
                const sortedMetrics = Array.from(allMetrics).sort();
                
                // Add column headers: displayName(metric) for each displayName and metric combination
                const sortedDisplayNames = Array.from(seriesByDisplayName.keys()).sort();
                sortedDisplayNames.forEach(displayName => {
                    const seriesList = seriesByDisplayName.get(displayName);
                    sortedMetrics.forEach(metric => {
                        const series = seriesList.find(s => s.metric === metric);
                        if (series) {
                            const th = document.createElement('th');
                            const metricLabel = seriesList.length > 1 ? `${displayName}(${metric})` : displayName;
                            th.textContent = metricLabel;
                            th.className = 'genie-dashboard-sortable';
                            th.addEventListener('click', () => {
                                // Find column index
                                let columnIndex = 1;
                                let found = false;
                                for (let d = 0; d < sortedDisplayNames.length && !found; d++) {
                                    for (let m = 0; m < sortedMetrics.length; m++) {
                                        if (sortedDisplayNames[d] === displayName && sortedMetrics[m] === metric) {
                                            found = true;
                                            break;
                                        }
                                        if (seriesByDisplayName.get(sortedDisplayNames[d]).find(s => s.metric === sortedMetrics[m])) {
                                            columnIndex++;
                                        }
                                    }
                                }
                                const newDirection = (currentSortColumn === columnIndex && currentSortDirection === 'desc') ? 'asc' : 'desc';
                                sortTable(columnIndex, newDirection);
                            });
                            headerRow.appendChild(th);
                        }
                    });
                });
            } else {
                // Single metric: show displayName only
                const sortedDisplayNames = Array.from(seriesByDisplayName.keys()).sort();
                sortedDisplayNames.forEach((displayName, index) => {
                    const th = document.createElement('th');
                    th.textContent = displayName;
                    th.className = 'genie-dashboard-sortable';
                    th.addEventListener('click', () => {
                        const columnIndex = index + 1; // +1 because Stats column is index 0
                        const newDirection = (currentSortColumn === columnIndex && currentSortDirection === 'desc') ? 'asc' : 'desc';
                        sortTable(columnIndex, newDirection);
                    });
                    headerRow.appendChild(th);
                });
            }
            
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            // Create body - each row is a stat
            const tbody = document.createElement('tbody');
            
            statsToShow.forEach(stat => {
                const row = document.createElement('tr');
                
                // First cell: stat name (e.g., AVG, MIN, MAX)
                const statNameCell = document.createElement('td');
                statNameCell.className = 'genie-dashboard-stats-series-name';
                statNameCell.textContent = stat.toUpperCase();
                statNameCell.style.fontWeight = '600';
                row.appendChild(statNameCell);
                
                // Subsequent cells: stat values for each series
                if (hasMultipleMetrics) {
                    // Multiple metrics: show value for each displayName(metric) combination
                    const allMetrics = new Set();
                    seriesByDisplayName.forEach((seriesList) => {
                        seriesList.forEach(s => { if (s.metric) allMetrics.add(s.metric); });
                    });
                    const sortedMetrics = Array.from(allMetrics).sort();
                    const sortedDisplayNames = Array.from(seriesByDisplayName.keys()).sort();
                    
                    sortedDisplayNames.forEach(displayName => {
                        const seriesList = seriesByDisplayName.get(displayName);
                        sortedMetrics.forEach(metric => {
                            const cell = document.createElement('td');
                            const statKey = stat.toLowerCase();
                            
                            const series = seriesList.find(s => s.metric === metric);
                            const value = series ? series.stats[statKey] : undefined;
                            
                            // Get previous period value for comparison
                            // For previous-only series, use originalName (without postfix) for lookup
                            const lookupName = series && series.isPreviousOnly && series.originalName ? series.originalName : displayName;
                            const previousKey = `${lookupName}|${metric}`;
                            const previousStats = previousSeriesData.get(previousKey);
                            // For previous-only series, don't show comparison (they ARE the previous data)
                            const previousValue = (series && series.isPreviousOnly) ? null : (previousStats ? previousStats[statKey] : null);
                            
                            if (value !== undefined && value !== null) {
                                // For base series, check if this is the base metric
                                const isBaseSeries = baseSeries && displayName === baseSeries.name && baseSeries.metric === metric;
                                let formattedValue;
                                let percentageText = '';
                                
                                // Format the raw value
                                if (['avg', 'mean', 'p90', 'p95', 'p99', 'p50', 'median', 'stddev', 'std'].includes(statKey)) {
                                    formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
                                } else {
                                    formattedValue = typeof value === 'number' ? value.toLocaleString() : value;
                                }
                                
                                // Calculate percentage based on percentBase/percentTargets config if enabled
                                if (percentViewEnabled && hasPercentConfig) {
                                    // Percent view is enabled - use percentBase/percentTargets logic
                                    if (metric === percentBase) {
                                        // percentBase metric always shows 100%
                                        percentageText = '(100.0%)';
                                    } else if (percentTargets.includes(metric)) {
                                        // percentTargets metrics: calculate percentage relative to percentBase
                                        // Find the percentBase metric value for this displayName and stat
                                        const baseMetricSeries = seriesList.find(s => s.metric === percentBase);
                                        if (baseMetricSeries) {
                                            const baseValue = baseMetricSeries.stats[statKey];
                                            if (baseValue !== undefined && baseValue !== null && !isNaN(baseValue) && baseValue !== 0) {
                                                const percentage = (value / baseValue) * 100;
                                                percentageText = '(' + percentage.toFixed(1) + '%)';
                                            }
                                        }
                                    }
                                    // If metric is neither percentBase nor in percentTargets, no percentage shown
                                } else if (!hasPercentConfig && baseSeries) {
                                    // Original base_series percentage logic (only if percentBase/percentTargets config is not set)
                                    if (baseSeries.name === displayName) {
                                        if (isBaseSeries) {
                                            // Base series metric shows 100.0%
                                            percentageText = '(100.0%)';
                                        } else {
                                            // Other metrics of base series show percentage relative to first metric
                                            const baseMetricSeries = seriesList.find(s => s.metric === baseSeries.metric) || seriesList[0];
                                            const baseValue = baseMetricSeries ? baseMetricSeries.stats[statKey] : null;
                                            if (baseValue !== undefined && baseValue !== null && !isNaN(baseValue) && baseValue !== 0) {
                                                const percentage = (value / baseValue) * 100;
                                                percentageText = '(' + percentage.toFixed(1) + '%)';
                                            }
                                        }
                                    } else {
                                        // Other displayNames: compare with base series (first metric)
                                        const baseValue = baseSeries.stats[statKey];
                                        if (baseValue !== undefined && baseValue !== null && !isNaN(baseValue) && baseValue !== 0) {
                                            const percentage = (value / baseValue) * 100;
                                            percentageText = '(' + percentage.toFixed(1) + '%)';
                                        }
                                    }
                                }
                                // If percentViewEnabled is false and hasPercentConfig is true, no percentage shown
                                
                                // Combine raw value and percentage
                                if (percentageText) {
                                    formattedValue = formattedValue + percentageText;
                                }
                                
                                // Add percentage change if previous value exists
                                if (previousValue !== null && previousValue !== undefined && !isNaN(previousValue) && previousValue !== 0) {
                                    console.log(`[Compare Calculation] Stats Table (transposed) - Series: ${displayName}, Metric: ${metric}, Stat: ${stat}, Current Value: ${value}, Previous Value: ${previousValue}, Expression: (${value} - ${previousValue}) / ${previousValue} * 100`);
                                    const percentChange = ((value - previousValue) / previousValue) * 100;
                                    const sign = percentChange >= 0 ? '+' : '';
                                    const color = percentChange >= 0 ? '#10b981' : '#ef4444';
                                    
                                    const durationText = previousDuration ? (previousDuration.startsWith('-') ? previousDuration : '-' + previousDuration) : '';
                                    const comparisonText = durationText ? `${durationText}:${sign}${percentChange.toFixed(1)}%` : `${sign}${percentChange.toFixed(1)}%`;
                                    
                                    if (baseSeries && !isBaseSeries && percentageText) {
                                        cell.innerHTML = `<span>${formattedValue}</span> <span style="color: ${color};">(${comparisonText})</span>`;
                                    } else {
                                        cell.innerHTML = `<span>${formattedValue.split(' (')[0]}</span> <span style="color: ${color};">(${comparisonText})</span>`;
                                    }
                                } else {
                                    cell.textContent = formattedValue;
                                }
                            } else {
                                cell.textContent = 'N/A';
                                cell.style.color = '#9ca3af';
                            }
                            
                            row.appendChild(cell);
                        });
                    });
                } else {
                    // Single metric: use original logic
                    const sortedDisplayNames = Array.from(seriesByDisplayName.keys()).sort();
                    sortedDisplayNames.forEach(displayName => {
                        const series = seriesByDisplayName.get(displayName)[0];
                        const cell = document.createElement('td');
                        const statKey = stat.toLowerCase();
                        const value = series.stats[statKey];
                        
                        // Get previous period value for comparison
                        // For previous-only series, use originalName (without postfix) for lookup
                        const lookupName = series.isPreviousOnly && series.originalName ? series.originalName : displayName;
                        const previousKey = `${lookupName}|${series.metric || ''}`;
                        const previousStats = previousSeriesData.get(previousKey);
                        // For previous-only series, don't show comparison (they ARE the previous data)
                        const previousValue = series.isPreviousOnly ? null : (previousStats ? previousStats[statKey] : null);
                        
                        if (value !== undefined && value !== null) {
                            const isBaseSeries = baseSeries && series.name === baseSeries.name;
                            const currentMetric = series.metric || '';
                            let formattedValue;
                            let percentageText = '';
                            
                            if (['avg', 'mean', 'p90', 'p95', 'p99', 'p50', 'median', 'stddev', 'std'].includes(statKey)) {
                                formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
                            } else {
                                formattedValue = typeof value === 'number' ? value.toLocaleString() : value;
                            }
                            
                            // Calculate percentage based on percentBase/percentTargets config if enabled
                            if (percentViewEnabled && hasPercentConfig && currentMetric === percentBase) {
                                // percentBase metric always shows 100%
                                percentageText = '(100.0%)';
                            } else if (percentViewEnabled && hasPercentConfig && percentTargets.includes(currentMetric)) {
                                // percentTargets metrics: calculate percentage relative to percentBase
                                // For single metric case, we need to find percentBase in the same displayName
                                const seriesListForDisplayName = seriesByDisplayName.get(displayName);
                                const baseMetricSeries = seriesListForDisplayName ? seriesListForDisplayName.find(s => (s.metric || '') === percentBase) : null;
                                if (baseMetricSeries) {
                                    const baseValue = baseMetricSeries.stats[statKey];
                                    if (baseValue !== undefined && baseValue !== null && !isNaN(baseValue) && baseValue !== 0) {
                                        const percentage = (value / baseValue) * 100;
                                        percentageText = '(' + percentage.toFixed(1) + '%)';
                                    }
                                }
                            } else if (!percentViewEnabled || !hasPercentConfig) {
                                // Original base_series percentage logic (only if percent view is not enabled)
                                if (baseSeries) {
                                    if (isBaseSeries) {
                                        percentageText = '(100.0%)';
                                    } else {
                                        const baseValue = baseSeries.stats[statKey];
                                        if (baseValue !== undefined && baseValue !== null && !isNaN(baseValue) && baseValue !== 0) {
                                            const percentage = (value / baseValue) * 100;
                                            percentageText = '(' + percentage.toFixed(1) + '%)';
                                        }
                                    }
                                }
                            }
                            
                            if (percentageText) {
                                formattedValue = formattedValue + percentageText;
                            }
                            
                            if (previousValue !== null && previousValue !== undefined && !isNaN(previousValue) && previousValue !== 0) {
                                console.log(`[Compare Calculation] Stats Table (non-transposed) - Series: ${displayName}, Metric: ${metric}, Stat: ${stat}, Current Value: ${value}, Previous Value: ${previousValue}, Expression: (${value} - ${previousValue}) / ${previousValue} * 100`);
                                const percentChange = ((value - previousValue) / previousValue) * 100;
                                const sign = percentChange >= 0 ? '+' : '';
                                const color = percentChange >= 0 ? '#10b981' : '#ef4444';
                                
                                const durationText = previousDuration ? (previousDuration.startsWith('-') ? previousDuration : '-' + previousDuration) : '';
                                const comparisonText = durationText ? `${durationText}:${sign}${percentChange.toFixed(1)}%` : `${sign}${percentChange.toFixed(1)}%`;
                                
                                if (baseSeries && !isBaseSeries && percentageText) {
                                    cell.innerHTML = `<span>${formattedValue}</span> <span style="color: ${color};">(${comparisonText})</span>`;
                                } else {
                                    cell.innerHTML = `<span>${formattedValue.split(' (')[0]}</span> <span style="color: ${color};">(${comparisonText})</span>`;
                                }
                            } else {
                                cell.textContent = formattedValue;
                            }
                        } else {
                            cell.textContent = 'N/A';
                            cell.style.color = '#9ca3af';
                        }
                        
                        row.appendChild(cell);
                    });
                }
                
                tbody.appendChild(row);
            });
            
            table.appendChild(tbody);
            tableWrapper.appendChild(table);
            container.appendChild(tableWrapper);
        } else {
            // Normal view: Series as rows, Stats as columns
            // If multiple metrics exist, create columns like "avg(metric1)", "avg(metric2)", etc.
            if (hasMultipleMetrics) {
                // Build column headers: for each stat, create a column for each unique metric
                // Get all unique metrics across all displayNames
                const allMetrics = new Set();
                seriesByDisplayName.forEach((seriesList) => {
                    seriesList.forEach(series => {
                        if (series.metric) {
                            allMetrics.add(series.metric);
                        }
                    });
                });
                const sortedMetrics = Array.from(allMetrics).sort();
                
                // Create columns: stat(metric1), stat(metric2), etc. for each stat
                statsToShow.forEach((stat) => {
                    sortedMetrics.forEach((metric) => {
                        const th = document.createElement('th');
                        th.textContent = `${stat.toUpperCase()}(${metric})`;
                        th.className = 'genie-dashboard-sortable';
                        th.setAttribute('data-stat', stat.toLowerCase());
                        th.setAttribute('data-metric', metric);
                        th.addEventListener('click', () => {
                            // Find column index
                            let columnIndex = 1; // Start after Series column
                            let found = false;
                            for (let s = 0; s < statsToShow.length && !found; s++) {
                                for (let m = 0; m < sortedMetrics.length; m++) {
                                    if (statsToShow[s] === stat && sortedMetrics[m] === metric) {
                                        found = true;
                                        break;
                                    }
                                    columnIndex++;
                                }
                            }
                            // Default to descending on first click, then toggle between desc and asc
                            const newDirection = (currentSortColumn === columnIndex && currentSortDirection === 'desc') ? 'asc' : 'desc';
                            sortTable(columnIndex, newDirection);
                        });
                        headerRow.appendChild(th);
                    });
                });
            } else {
                // Single metric per displayName - use original format
        statsToShow.forEach((stat, index) => {
            const th = document.createElement('th');
            th.textContent = stat.toUpperCase();
                    th.className = 'genie-dashboard-sortable';
            th.addEventListener('click', () => {
                const columnIndex = index + 1; // +1 because Series column is index 0
                        // Default to descending on first click, then toggle between desc and asc
                        const newDirection = (currentSortColumn === columnIndex && currentSortDirection === 'desc') ? 'asc' : 'desc';
                sortTable(columnIndex, newDirection);
            });
            headerRow.appendChild(th);
        });
            }
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create body
        const tbody = document.createElement('tbody');
        
        // Iterate over unique displayNames (not individual series)
        const sortedDisplayNames = Array.from(seriesByDisplayName.keys()).sort();
        
        sortedDisplayNames.forEach(displayName => {
            const seriesList = seriesByDisplayName.get(displayName);
            const row = document.createElement('tr');
            
            const nameCell = document.createElement('td');
            nameCell.className = 'genie-dashboard-stats-series-name';
            nameCell.textContent = displayName;
            
            // Add right-click context menu if configured
            const contextMenuConfig = panel.seriesContextMenu || panel.options?.seriesContextMenu;
            if (contextMenuConfig && Array.isArray(contextMenuConfig) && contextMenuConfig.length > 0) {
                nameCell.style.cursor = 'context-menu';
                nameCell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showSeriesContextMenu(e, displayName, contextMenuConfig);
                });
            }
            
            row.appendChild(nameCell);
            
            if (hasMultipleMetrics) {
                // Multiple metrics: create cells for each stat(metric) combination
                const allMetrics = new Set();
                seriesByDisplayName.forEach((sList) => {
                    sList.forEach(s => { if (s.metric) allMetrics.add(s.metric); });
                });
                const sortedMetrics = Array.from(allMetrics).sort();
                
                statsToShow.forEach((stat) => {
                    sortedMetrics.forEach((metric) => {
                        const cell = document.createElement('td');
                        const statKey = stat.toLowerCase();
                        
                        // Find the series entry for this displayName and metric
                        const series = seriesList.find(s => s.metric === metric);
                        const value = series ? series.stats[statKey] : undefined;
                        
                        // Get previous period value for comparison
                        // For previous-only series, use originalName (without postfix) for lookup
                        const lookupName = series && series.isPreviousOnly && series.originalName ? series.originalName : displayName;
                        const previousKey = `${lookupName}|${metric}`;
                        const previousStats = previousSeriesData.get(previousKey);
                        // For previous-only series, don't show comparison (they ARE the previous data)
                        const previousValue = (series && series.isPreviousOnly) ? null : (previousStats ? previousStats[statKey] : null);
                        
                        if (value !== undefined && value !== null) {
                            // For base series, find the first metric of the base series
                            const isBaseSeries = baseSeries && displayName === baseSeries.name && baseSeries.metric === metric;
                            let formattedValue;
                            let percentageText = '';
                            
                            // Format the raw value
                            if (['avg', 'mean', 'p90', 'p95', 'p99', 'p50', 'median', 'stddev', 'std'].includes(statKey)) {
                                formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
                            } else {
                                formattedValue = typeof value === 'number' ? value.toLocaleString() : value;
                            }
                            
                            // Calculate percentage based on percentBase/percentTargets config if enabled
                            if (percentViewEnabled && hasPercentConfig) {
                                // Percent view is enabled - use percentBase/percentTargets logic
                                if (metric === percentBase) {
                                    // percentBase metric always shows 100%
                                    percentageText = '(100.0%)';
                                } else if (percentTargets.includes(metric)) {
                                    // percentTargets metrics: calculate percentage relative to percentBase
                                    // Find the percentBase metric value for this displayName and stat
                                    const baseMetricSeries = seriesList.find(s => s.metric === percentBase);
                                    if (baseMetricSeries) {
                                        const baseValue = baseMetricSeries.stats[statKey];
                                        if (baseValue !== undefined && baseValue !== null && !isNaN(baseValue) && baseValue !== 0) {
                                            const percentage = (value / baseValue) * 100;
                                            percentageText = '(' + percentage.toFixed(1) + '%)';
                                        }
                                    }
                                }
                                // If metric is neither percentBase nor in percentTargets, no percentage shown
                            } else if (!hasPercentConfig && baseSeries) {
                                // Original base_series percentage logic (only if percentBase/percentTargets config is not set)
                                // For base series, use the first metric as the base
                                if (baseSeries.name === displayName) {
                                    if (isBaseSeries) {
                                        // Base series metric shows 100.0%
                                        percentageText = '(100.0%)';
                                    } else {
                                        // Other metrics of base series show percentage relative to first metric
                                        const baseMetricSeries = seriesList.find(s => s.metric === baseSeries.metric) || seriesList[0];
                                        const baseValue = baseMetricSeries ? baseMetricSeries.stats[statKey] : null;
                                        if (baseValue !== undefined && baseValue !== null && !isNaN(baseValue) && baseValue !== 0) {
                                            const percentage = (value / baseValue) * 100;
                                            percentageText = '(' + percentage.toFixed(1) + '%)';
                                        }
                                    }
                                } else {
                                    // Other displayNames: compare with base series (first metric)
                                    const baseValue = baseSeries.stats[statKey];
                                    if (baseValue !== undefined && baseValue !== null && !isNaN(baseValue) && baseValue !== 0) {
                                        const percentage = (value / baseValue) * 100;
                                        percentageText = '(' + percentage.toFixed(1) + '%)';
                                    }
                                }
                            }
                            // If percentViewEnabled is false and hasPercentConfig is true, no percentage shown
                            
                            // Combine raw value and percentage
                            if (percentageText) {
                                formattedValue = formattedValue + percentageText;
                            }
                            
                            // Add percentage change if previous value exists
                            if (previousValue !== null && previousValue !== undefined && !isNaN(previousValue) && previousValue !== 0) {
                                console.log(`[Compare Calculation] Stats Table - Series: ${displayName}, Metric: ${metric}, Stat: ${stat}, Current Value: ${value}, Previous Value: ${previousValue}, Expression: (${value} - ${previousValue}) / ${previousValue} * 100`);
                                const percentChange = ((value - previousValue) / previousValue) * 100;
                                const sign = percentChange >= 0 ? '+' : '';
                                const color = percentChange >= 0 ? '#10b981' : '#ef4444'; // green for increase, red for decrease
                                
                                // Format duration for display (e.g., "-7d" or "-1d")
                                const durationText = previousDuration ? (previousDuration.startsWith('-') ? previousDuration : '-' + previousDuration) : '';
                                const comparisonText = durationText ? `${durationText}:${sign}${percentChange.toFixed(1)}%` : `${sign}${percentChange.toFixed(1)}%`;
                                
                                if (baseSeries && !isBaseSeries && percentageText) {
                                    // Show both: value(base%)(duration:previous%change)
                                    cell.innerHTML = `<span>${formattedValue}</span> <span style="color: ${color};">(${comparisonText})</span>`;
                                } else {
                                    // Show only previous period comparison with duration
                                    cell.innerHTML = `<span>${formattedValue.split(' (')[0]}</span> <span style="color: ${color};">(${comparisonText})</span>`;
                                }
                            } else {
                                cell.textContent = formattedValue;
                            }
                        } else {
                            cell.textContent = 'N/A';
                            cell.style.color = '#9ca3af';
                        }
                        
                        row.appendChild(cell);
                    });
                });
            } else {
                // Single metric: use original logic
                const series = seriesList[0]; // Only one series per displayName
            
            statsToShow.forEach(stat => {
                const cell = document.createElement('td');
                const statKey = stat.toLowerCase();
                const value = series.stats[statKey];
                
                // Get previous period value for comparison
                // For previous-only series, use originalName (without postfix) for lookup
                const lookupName = series.isPreviousOnly && series.originalName ? series.originalName : displayName;
                const previousKey = `${lookupName}|${series.metric || ''}`;
                const previousStats = previousSeriesData.get(previousKey);
                // For previous-only series, don't show comparison (they ARE the previous data)
                const previousValue = series.isPreviousOnly ? null : (previousStats ? previousStats[statKey] : null);
                
                if (value !== undefined && value !== null) {
                        // Check if we should show percentage relative to base_series
                        const isBaseSeries = baseSeries && series.name === baseSeries.name;
                        const currentMetric = series.metric || '';
                    let formattedValue;
                        let percentageText = '';
                        
                        // Format the raw value
                    if (['avg', 'mean', 'p90', 'p95', 'p99', 'p50', 'median', 'stddev', 'std'].includes(statKey)) {
                        formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
                    } else {
                        formattedValue = typeof value === 'number' ? value.toLocaleString() : value;
                    }
                        
                        // Calculate percentage based on percentBase/percentTargets config if enabled
                        if (percentViewEnabled && hasPercentConfig) {
                            // Percent view is enabled - use percentBase/percentTargets logic
                            if (currentMetric === percentBase) {
                                // percentBase metric always shows 100%
                                percentageText = '(100.0%)';
                            } else if (percentTargets.includes(currentMetric)) {
                                // percentTargets metrics: calculate percentage relative to percentBase
                                // For single metric case, we need to find percentBase in the same displayName
                                const seriesListForDisplayName = seriesByDisplayName.get(displayName);
                                const baseMetricSeries = seriesListForDisplayName ? seriesListForDisplayName.find(s => (s.metric || '') === percentBase) : null;
                                if (baseMetricSeries) {
                                    const baseValue = baseMetricSeries.stats[statKey];
                                    if (baseValue !== undefined && baseValue !== null && !isNaN(baseValue) && baseValue !== 0) {
                                        const percentage = (value / baseValue) * 100;
                                        percentageText = '(' + percentage.toFixed(1) + '%)';
                                    }
                                }
                            }
                            // If metric is neither percentBase nor in percentTargets, no percentage shown
                        } else if (!hasPercentConfig && baseSeries) {
                            // Original base_series percentage logic (only if percentBase/percentTargets config is not set)
                            if (isBaseSeries) {
                                // Base series shows 100.0%
                                percentageText = '(100.0%)';
                            } else {
                                // Other series show percentage relative to base
                                const baseValue = baseSeries.stats[statKey];
                                if (baseValue !== undefined && baseValue !== null && !isNaN(baseValue) && baseValue !== 0) {
                                    const percentage = (value / baseValue) * 100;
                                    percentageText = '(' + percentage.toFixed(1) + '%)';
                                }
                            }
                        }
                        // If percentViewEnabled is false and hasPercentConfig is true, no percentage shown
                        
                        // Combine raw value and percentage
                        if (percentageText) {
                            formattedValue = formattedValue + percentageText;
                    }
                    
                    // Add percentage change if previous value exists
                    if (previousValue !== null && previousValue !== undefined && !isNaN(previousValue) && previousValue !== 0) {
                        console.log(`[Compare Calculation] Stats Table (alternate view) - Series: ${displayName}, Metric: ${currentMetric}, Stat: ${stat}, Current Value: ${value}, Previous Value: ${previousValue}, Expression: (${value} - ${previousValue}) / ${previousValue} * 100`);
                        const percentChange = ((value - previousValue) / previousValue) * 100;
                        const sign = percentChange >= 0 ? '+' : '';
                        const color = percentChange >= 0 ? '#10b981' : '#ef4444'; // green for increase, red for decrease
                            
                            // Format duration for display (e.g., "-7d" or "-1d")
                            const durationText = previousDuration ? (previousDuration.startsWith('-') ? previousDuration : '-' + previousDuration) : '';
                            const comparisonText = durationText ? `${durationText}:${sign}${percentChange.toFixed(1)}%` : `${sign}${percentChange.toFixed(1)}%`;
                            
                            if (baseSeries && !isBaseSeries && percentageText) {
                                // Show both: value(base%)(duration:previous%change)
                                cell.innerHTML = `<span>${formattedValue}</span> <span style="color: ${color};">(${comparisonText})</span>`;
                            } else {
                                // Show only previous period comparison with duration
                                cell.innerHTML = `<span>${formattedValue.split(' (')[0]}</span> <span style="color: ${color};">(${comparisonText})</span>`;
                            }
                    } else {
                        cell.textContent = formattedValue;
                    }
                } else {
                    cell.textContent = 'N/A';
                    cell.style.color = '#9ca3af';
                }
                
                row.appendChild(cell);
            });
            }
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        container.appendChild(tableWrapper);
            
            // Sort by first metrics column in descending order by default
            if (statsToShow.length > 0) {
                const firstMetricsColumnIndex = 1; // Index 0 is Series column, Index 1 is first metrics column
                sortTable(firstMetricsColumnIndex, 'desc');
            }
        }
        
        // Add unit information if available - positioned at bottom of panel (outside panel-content)
        // Only show in stats view, not in timeseries view
        const unit = panel.fieldConfig?.defaults?.unit;
        if (unit) {
            // Find the panel element (parent of container/panel-content)
            const panelElement = container.closest('.genie-dashboard-panel');
            if (panelElement) {
                // Check if we're in stats view (statsContent is active/visible)
                const statsContent = panelElement.querySelector(`#${this.instanceId}-stats-tab-${panel.id}`);
                const isStatsViewActive = statsContent && (
                    statsContent.classList.contains('genie-dashboard-active') || 
                    (statsContent.style.display !== 'none' && statsContent.offsetParent !== null)
                );
                
                // Remove any existing unit note first (in case of re-render)
                const existingNote = panelElement.querySelector('.genie-dashboard-unit-note');
                if (existingNote) {
                    existingNote.remove();
                }
                
                // Only create and show note if stats view is active
                if (isStatsViewActive) {
                    const unitNote = document.createElement('div');
                    unitNote.className = 'genie-dashboard-unit-note';
                    unitNote.style.cssText = 'position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 12px; font-size: 12px; color: #6b7280; font-style: italic; background: rgba(255, 255, 255, 0.95); border-top: 1px solid #e5e7eb; z-index: 10; pointer-events: none;';
                    unitNote.textContent = `All values are in ${unit}`;
                    // Append to panel element (not container/panel-content) so it's at the bottom of the panel
                    panelElement.appendChild(unitNote);
                }
            }
        }
        
    }
    
    /**
     * Show context menu for series name
     * @param {MouseEvent} event - Right-click event
     * @param {string} seriesName - Name of the series
     * @param {Array} menuItems - Array of {label: string, handler: function} objects
     */
    showSeriesContextMenu(event, seriesName, menuItems) {
        // Remove any existing context menu
        const existingMenu = document.querySelector('.genie-dashboard-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Validate menuItems
        if (!menuItems || !Array.isArray(menuItems) || menuItems.length === 0) {
            console.error('Invalid menuItems:', menuItems);
            return;
        }
        
        // Create context menu
        const menu = document.createElement('div');
        menu.className = 'genie-dashboard-context-menu';
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
    applySpanAggregation(dataPoints, span, spanAggregationType) {
        if (!span || !spanAggregationType || dataPoints.length === 0) {
            return dataPoints;
        }
        
        // Parse span duration to milliseconds
        const spanMs = this.parseDuration(span);
        if (spanMs === 0) {
            return dataPoints; // Invalid span, return original
        }
        
        // Group data points by time windows
        // Round all timestamps to the same window boundaries (multiples of spanMs from epoch)
        // This ensures all series align to the same time grid
        const windowedData = new Map(); // Map<windowStart, Array<{time, value}>>
        
        dataPoints.forEach(dp => {
            const timeMs = dp.time instanceof Date ? dp.time.getTime() : dp.time;
            // Round down to the nearest window boundary (multiples of spanMs from epoch 0)
            // This ensures all series use the same time grid
            const windowStart = Math.floor(timeMs / spanMs) * spanMs;
            
            if (!windowedData.has(windowStart)) {
                windowedData.set(windowStart, []);
            }
            windowedData.get(windowStart).push({
                time: new Date(windowStart), // Use window start as the timestamp (will be consistent across all series)
                value: dp.value
            });
        });
        
        // Aggregate each window
        const aggregatedPoints = [];
        windowedData.forEach((points, windowStart) => {
            const validValues = points.map(p => p.value).filter(v => v !== null && v !== undefined && !isNaN(v));
            
            if (validValues.length === 0) {
                return;
            }
            
            let aggregatedValue;
            if (spanAggregationType === 'sum') {
                aggregatedValue = validValues.reduce((a, b) => a + b, 0);
            } else if (spanAggregationType === 'avg') {
                aggregatedValue = validValues.reduce((a, b) => a + b, 0) / validValues.length;
            } else if (spanAggregationType === 'max') {
                aggregatedValue = Math.max(...validValues);
            } else if (spanAggregationType === 'min') {
                aggregatedValue = Math.min(...validValues);
            } else {
                aggregatedValue = validValues[0]; // Default to first value
            }
            
            // Use window start as the timestamp (not window start + span/2)
            // This ensures all series have values at the same rounded timestamps
            aggregatedPoints.push({
                time: new Date(windowStart), // Rounded timestamp that matches across all series
                value: aggregatedValue
            });
        });
        
        // Sort by time
        aggregatedPoints.sort((a, b) => a.time.getTime() - b.time.getTime());
        
        return aggregatedPoints;
    }
    
    /**
     * Apply span aggregation to all series in a data array (without requiring aggregation tag)
     * @param {Array} dataArray - Array of {refId, data, target, isPrevious}
     * @param {string} spanAggregation - Span duration (e.g., '5m', '1h')
     * @param {string} spanAggregationType - Span aggregation type ('sum', 'avg', 'max', or 'min')
     * @returns {Array} Data array with span aggregation applied to all series
     */
    applySpanAggregationToAllSeries(dataArray, spanAggregation, spanAggregationType) {
        if (!spanAggregation || !spanAggregationType || !dataArray || dataArray.length === 0) {
            return dataArray;
        }
        
        const processedDataArray = dataArray.map((targetData) => {
            const response = targetData.data;
            const target = targetData.target;
            const isPrevious = targetData.isPrevious || false;
            
            let seriesArray = [];
            if (Array.isArray(response)) {
                seriesArray = response;
            } else if (response && response.series && Array.isArray(response.series)) {
                seriesArray = response.series;
            } else if (response && response.scope && response.metric) {
                seriesArray = [response];
            } else if (response && response.times && response.values) {
                seriesArray = [response];
            } else if (response && response.datapoints) {
                seriesArray = [response];
            }
            
            const processedSeriesArray = seriesArray.map(series => {
                // Extract data points
                let dataPoints = this.extractDataPoints(series);
                
                // Apply span aggregation if configured
                if (spanAggregation && spanAggregationType && dataPoints.length > 0) {
                    dataPoints = this.applySpanAggregation(dataPoints, spanAggregation, spanAggregationType);
                    
                    // Convert dataPoints back to datapoints object format
                    const datapointsObj = {};
                    dataPoints.forEach(dp => {
                        const timeMs = dp.time instanceof Date ? dp.time.getTime() : dp.time;
                        datapointsObj[String(timeMs)] = dp.value;
                    });
                    
                    // Create a copy of the series with updated datapoints
                    return {
                        ...series,
                        datapoints: datapointsObj
                    };
                }
                
                return series;
            });
            
            // Return processed target data
            if (Array.isArray(response)) {
                return {
                    ...targetData,
                    data: processedSeriesArray
                };
            } else if (response && response.series && Array.isArray(response.series)) {
                return {
                    ...targetData,
                    data: {
                        ...response,
                        series: processedSeriesArray
                    }
                };
            } else {
                // Single series response
                return {
                    ...targetData,
                    data: processedSeriesArray[0] || response
                };
            }
        });
        
        return processedDataArray;
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
    applySeriesAggregation(dataArray, aggregationTag, aggregationType, spanAggregation = null, spanAggregationType = null) {
        if (!aggregationTag || !aggregationType || !dataArray || dataArray.length === 0) {
            return dataArray;
        }
        
        // Group series by tag value + metric
        // Map<`${tagValue}|${metric}|${isPrevious}`, Array<{series, target, dataPoints}>>
        const groupedSeries = new Map();
        // Series that don't have the aggregation tag - keep them as-is
        const nonMatchingSeries = [];
        
        dataArray.forEach((targetData) => {
            const response = targetData.data;
            const target = targetData.target;
            const isPrevious = targetData.isPrevious || false;
            
            let seriesArray = [];
            if (Array.isArray(response)) {
                seriesArray = response;
            } else if (response.datapoints) {
                seriesArray = [response];
            } else if (response.times && response.values) {
                seriesArray = [response];
            }
            
            seriesArray.forEach(series => {
                // Get tag value and metric
                // Support aggregating by 'scope' field (top-level property) or by tag
                let tagValue = null;
                if (aggregationTag === 'scope') {
                    // Special case: aggregate by scope field (top-level property, not in tags)
                    tagValue = series.scope ? String(series.scope) : null;
                } else {
                    // Normal case: aggregate by tag value from tags object
                    // Check if tags object exists and has the aggregation tag
                    if (series.tags && typeof series.tags === 'object') {
                        const tagValueRaw = series.tags[aggregationTag];
                        // Handle various falsy cases: null, undefined, empty string, but allow 0 and false as valid values
                        if (tagValueRaw !== null && tagValueRaw !== undefined && tagValueRaw !== '') {
                            tagValue = String(tagValueRaw);
                        }
                    }
                }
                const metric = series.metric || '';
                
                // Log tag value extraction for debugging
                if (aggregationTag === 'k8s_pod_name' || aggregationTag === 'scope') {
                    console.log(`[Aggregation] Series ${series.displayName || series.metric || 'unknown'}: aggregationTag='${aggregationTag}', tagValue='${tagValue}', hasTags=${!!series.tags}, tagsKeys=${series.tags ? Object.keys(series.tags).join(',') : 'none'}`);
                }
                
                // Extract data points
                let dataPoints = this.extractDataPoints(series);
                
                // Apply span aggregation first if configured (apply to all series, even non-matching ones)
                // This aligns all series to the same rounded time units
                if (spanAggregation && spanAggregationType && dataPoints.length > 0) {
                    const originalCount = dataPoints.length;
                    dataPoints = this.applySpanAggregation(dataPoints, spanAggregation, spanAggregationType);
                    console.log(`[Aggregation] Span aggregation for series ${series.displayName || series.metric}: ${originalCount} points -> ${dataPoints.length} points (span=${spanAggregation}, type=${spanAggregationType})`);
                    if (dataPoints.length > 0 && dataPoints.length <= 3) {
                        dataPoints.forEach((dp, idx) => {
                            const timeMs = dp.time instanceof Date ? dp.time.getTime() : dp.time;
                            console.log(`[Aggregation]   Span point ${idx}: ${new Date(timeMs).toISOString()} = ${dp.value}`);
                        });
                    }
                }
                
                if (!tagValue) {
                    // Series doesn't have the aggregation tag - keep it as-is (but with span aggregation applied if configured)
                    // Convert dataPoints back to datapoints object format
                    const datapointsObj = {};
                    dataPoints.forEach(dp => {
                        const timeMs = dp.time instanceof Date ? dp.time.getTime() : dp.time;
                        datapointsObj[String(timeMs)] = dp.value;
                    });
                    
                    // Create a copy of the series with updated datapoints
                    const seriesCopy = {
                        ...series,
                        datapoints: datapointsObj
                    };
                    
                    nonMatchingSeries.push({
                        refId: target.refId || 'A',
                        data: seriesCopy,
                        target: target,
                        isPrevious: isPrevious
                    });
                    console.log(`[Aggregation] Series ${series.displayName || series.metric} doesn't have tag '${aggregationTag}', keeping as-is`);
                    return;
                }
                
                // Create grouping key: tagValue|metric|isPrevious
                const groupKey = `${tagValue}|${metric}|${isPrevious}`;
                
                if (!groupedSeries.has(groupKey)) {
                    groupedSeries.set(groupKey, []);
                }
                
                groupedSeries.get(groupKey).push({
                    series: series,
                    target: target,
                    dataPoints: dataPoints,
                    isPrevious: isPrevious
                });
            });
        });
        
        // Aggregate each group
        const aggregatedDataArray = [];
        
        groupedSeries.forEach((groupSeries, groupKey) => {
            const [tagValue, metric, isPreviousStr] = groupKey.split('|');
            const isPrevious = isPreviousStr === 'true';
            
            console.log(`[Aggregation] Processing group: tag=${aggregationTag}=${tagValue}, metric=${metric}, isPrevious=${isPrevious}, seriesCount=${groupSeries.length}`);
            
            // Collect all timestamps from all series in this group
            // Use a Set to get unique timestamps, then sort them
            // This gives us all possible timestamps across all series in the group
            const allTimestamps = new Set();
            groupSeries.forEach((item, seriesIdx) => {
                item.dataPoints.forEach(dp => {
                    const timeMs = dp.time instanceof Date ? dp.time.getTime() : dp.time;
                    if (timeMs && !isNaN(timeMs)) {
                        allTimestamps.add(timeMs);
                    }
                });
                if (seriesIdx === 0) {
                    console.log(`[Aggregation] First series in group has ${item.dataPoints.length} data points`);
                }
            });
            
            const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
            console.log(`[Aggregation] Group has ${sortedTimestamps.length} unique timestamps across ${groupSeries.length} series`);
            
            // Aggregate values at each timestamp (vertical aggregation)
            // For each timestamp, collect ALL values from ALL series in this group that have data at that timestamp
            // Then sum/average those values to create one aggregated value per timestamp
            // This creates a new timeseries where each point is the aggregated value of all matching series at that timestamp
            const aggregatedDatapoints = {};
            let aggregatedPointCount = 0;
            
            sortedTimestamps.forEach(timestamp => {
                const valuesAtTimestamp = [];
                
                // Collect all values from all series in this group at this exact timestamp
                // This is the vertical aggregation: matching timestamps across all series
                // After span aggregation, all series should have timestamps aligned to the same rounded time units
                groupSeries.forEach(item => {
                    item.dataPoints.forEach(dp => {
                        const timeMs = dp.time instanceof Date ? dp.time.getTime() : dp.time;
                        // Exact timestamp match - all series matching at this timestamp will be aggregated
                        // After span aggregation, timestamps should be aligned to rounded time units, so exact matches should work
                        if (timeMs === timestamp) {
                            const value = dp.value;
                            if (value !== null && value !== undefined && !isNaN(value)) {
                                valuesAtTimestamp.push(value);
                            }
                        }
                    });
                });
                
                // Log if no values found at this timestamp (might indicate span alignment issue)
                if (valuesAtTimestamp.length === 0 && sortedTimestamps.length > 1) {
                    // Only log if we have multiple timestamps but this one has no matches
                    // This might indicate span aggregation didn't align timestamps properly
                    const seriesCounts = groupSeries.map(item => {
                        const matchingDp = item.dataPoints.find(dp => {
                            const timeMs = dp.time instanceof Date ? dp.time.getTime() : dp.time;
                            return timeMs === timestamp;
                        });
                        return matchingDp ? 1 : 0;
                    });
                    const totalSeriesWithData = seriesCounts.reduce((a, b) => a + b, 0);
                    if (totalSeriesWithData === 0) {
                        console.warn(`[Aggregation] No values found at timestamp ${new Date(timestamp).toISOString()} for any series in group ${groupKey}. This might indicate span alignment issue.`);
                    }
                }
                
                // If we have values at this timestamp, aggregate them
                if (valuesAtTimestamp.length > 0) {
                    let aggregatedValue;
                    // Sort values for percentile calculations
                    const sortedValues = [...valuesAtTimestamp].sort((a, b) => a - b);
                    
                    if (aggregationType === 'sum') {
                        // Sum all values from all series at this timestamp (vertical sum)
                        aggregatedValue = valuesAtTimestamp.reduce((a, b) => a + b, 0);
                    } else if (aggregationType === 'avg') {
                        // Average all values from all series at this timestamp (vertical average)
                        aggregatedValue = valuesAtTimestamp.reduce((a, b) => a + b, 0) / valuesAtTimestamp.length;
                    } else if (aggregationType === 'min') {
                        // Minimum value
                        aggregatedValue = Math.min(...valuesAtTimestamp);
                    } else if (aggregationType === 'max') {
                        // Maximum value
                        aggregatedValue = Math.max(...valuesAtTimestamp);
                    } else if (aggregationType === 'p50') {
                        // 50th percentile (median)
                        const mid = Math.floor(sortedValues.length / 2);
                        aggregatedValue = sortedValues.length % 2 === 0 
                            ? (sortedValues[mid - 1] + sortedValues[mid]) / 2 
                            : sortedValues[mid];
                    } else if (aggregationType === 'p90') {
                        // 90th percentile
                        const index = Math.ceil(sortedValues.length * 0.9) - 1;
                        aggregatedValue = sortedValues[Math.max(0, index)];
                    } else {
                        aggregatedValue = valuesAtTimestamp[0];
                    }
                    
                    // Store aggregated value for this timestamp
                    // This creates one data point in the aggregated timeseries
                    aggregatedDatapoints[String(timestamp)] = aggregatedValue;
                    aggregatedPointCount++;
                    
                    // Log first few aggregations for debugging
                    if (aggregatedPointCount <= 3) {
                        console.log(`[Aggregation] Timestamp ${new Date(timestamp).toISOString()}: aggregated ${valuesAtTimestamp.length} values (${aggregationType}) = ${aggregatedValue}`);
                    }
                }
            });
            
            // Build aggregated series identifier: aggregationType:aggregationTag:result
            const aggregatedIdentifier = `${aggregationType}:${aggregationTag}:result`;
            const aggregatedDisplayName = `${aggregatedIdentifier}:${metric}`;
            
            console.log(`[Aggregation] Created aggregated timeseries with ${aggregatedPointCount} data points for ${aggregatedDisplayName}`);
            
            // Create aggregated series object - this is a new timeseries with aggregated values
            // Format: aggregationType:aggregationTag:result (e.g., "avg:cell:result" or "sum:k8s_pod_name:result")
            // If aggregating by scope, use the scope value as the aggregated series scope
            // Otherwise, use the aggregated identifier as the scope
            const aggregatedSeries = {
                scope: aggregationTag === 'scope' ? tagValue : aggregatedIdentifier,
                metric: metric,
                tags: aggregationTag === 'scope' ? {} : { [aggregationTag]: tagValue },
                displayName: aggregatedDisplayName,
                datapoints: aggregatedDatapoints  // Object format: { "timestamp": value, ... }
            };
            
            // If aggregating by scope, also add the scope value to tags for consistency
            if (aggregationTag === 'scope' && tagValue) {
                aggregatedSeries.tags.scope = tagValue;
            }
            
            // Create aggregated target data
            // This will be processed by transformDataForChart to create a Chart.js dataset
            const aggregatedTargetData = {
                refId: groupSeries[0].target.refId || 'A',
                data: aggregatedSeries,  // Single aggregated series object
                target: groupSeries[0].target,
                isPrevious: isPrevious
            };
            
            aggregatedDataArray.push(aggregatedTargetData);
        });
        
        console.log(`[Aggregation] Total aggregated groups: ${aggregatedDataArray.length} (from ${dataArray.length} original targets)`);
        console.log(`[Aggregation] Non-matching series (kept as-is): ${nonMatchingSeries.length}`);
        
        // Combine aggregated series with non-matching series (kept as-is)
        // Non-matching series are added after aggregated ones
        return [...aggregatedDataArray, ...nonMatchingSeries];
    }
    
    /**
     * Transform API response data to Chart.js format
     */
    transformDataForChart(dataArray, panel, previousDuration = null) {
        // Apply aggregation if enabled
        let processedDataArray = dataArray;
        if (panel._aggregationEnabled && panel._aggregationType) {
            // Check panel.aggregation first (preferred), then panel.timeSeries.aggregation (backward compatibility)
            const aggregationConfig = panel.aggregation || 
                                      panel.options?.aggregation ||
                                      panel.timeSeries?.aggregation || 
                                      panel.options?.timeSeries?.aggregation || 
                                      null;
            if (aggregationConfig) {
                const aggregationTag = aggregationConfig.tag || null;
                // Use panel-specific span aggregation, or fall back to dashboard toolbar defaults
                const spanAggregation = aggregationConfig.span || this.inputConfig['$interval'] || null;
                const spanAggregationType = aggregationConfig.spanAggregation || this.inputConfig['$agg'] || null;
                
                if (aggregationTag) {
                    processedDataArray = this.applySeriesAggregation(
                        dataArray,
                        aggregationTag,
                        panel._aggregationType,
                        spanAggregation,
                        spanAggregationType
                    );
                    console.log(`[Aggregation] Applied aggregation: ${dataArray.length} targets -> ${processedDataArray.length} aggregated groups`);
                }
            }
        }
        const allTimePoints = new Set();
        const seriesData = new Map(); // Map of series name to data points
        
        // Process each target's data
        // After aggregation, processedDataArray contains aggregated series objects
        // Each aggregated target has data: { scope, metric, tags, displayName, datapoints: {...} }
        processedDataArray.forEach((targetData, index) => {
            const response = targetData.data;
            const target = targetData.target;
            
            // Debug: Log if this is previous period data
            if (targetData.isPrevious) {
                console.log(`Processing previous period data (index ${index}), previousDuration: ${previousDuration}`);
            }
            
            // Handle different response formats
            if (Array.isArray(response)) {
                // Array of time series objects (multiple series in one response)
                // Format: [{ scope, metric, tags, displayName, datapoints: { "timestamp": value } }, ...]
                // Note: After aggregation, this will typically be a single aggregated series per group
                response.forEach(series => {
                    let seriesName = this.getSeriesName(series, target, panel);
                    // Append duration suffix if this is previous period data (format: "series name(-7d)")
                    if (targetData.isPrevious && previousDuration) {
                        // Use previousDuration as-is if it already starts with "-", otherwise add "-"
                        const suffix = previousDuration.startsWith('-') ? previousDuration : '-' + previousDuration;
                        seriesName = `${seriesName}(${suffix})`;
                    }
                    const dataPoints = this.extractDataPoints(series);
                    
                    // Calculate time offset for previous period (shift forward to overlap)
                    const timeOffset = (targetData.isPrevious && previousDuration) ? 
                                      this.parseDuration(previousDuration) : 0;
                    
                    console.log(`Array format: seriesName="${seriesName}", isPrevious=${targetData.isPrevious}, previousDuration="${previousDuration}", timeOffset=${timeOffset}ms`);
                    
                    if (timeOffset > 0) {
                        console.log(`Shifting previous period data for series "${seriesName}" by ${timeOffset}ms (${timeOffset / 1000 / 60} minutes)`);
                    }
                    
                    dataPoints.forEach(dp => {
                        // Handle both Date objects and timestamps
                        let timeKey = dp.time instanceof Date ? dp.time.getTime() : dp.time;
                        const originalTimeKey = timeKey;
                        // Shift timestamps forward for previous period to overlap with current
                        if (timeOffset > 0) {
                            timeKey = timeKey + timeOffset;
                            if (dataPoints.indexOf(dp) < 2) { // Log first 2 shifts for debugging
                                console.log(`Shifted timestamp: ${originalTimeKey} -> ${timeKey} (+${timeOffset}ms)`);
                            }
                        }
                        allTimePoints.add(timeKey);
                        if (!seriesData.has(seriesName)) {
                            seriesData.set(seriesName, new Map());
                        }
                        seriesData.get(seriesName).set(timeKey, dp.value);
                    });
                });
            } else if (response.datapoints) {
                // Handle datapoints as object (timestamp keys) or array
                let seriesName = response.displayName || response.target || response.id || target.refId;
                // Append duration suffix if this is previous period data (format: "series name(-7d)")
                if (targetData.isPrevious && previousDuration) {
                    // Use previousDuration as-is if it already starts with "-", otherwise add "-"
                    const suffix = previousDuration.startsWith('-') ? previousDuration : '-' + previousDuration;
                    seriesName = `${seriesName}(${suffix})`;
                }
                
                let dataPoints = [];
                
                // Calculate time offset for previous period (shift forward to overlap)
                const timeOffset = (targetData.isPrevious && previousDuration) ? 
                                  this.parseDuration(previousDuration) : 0;
                
                console.log(`Datapoints format: seriesName="${seriesName}", isPrevious=${targetData.isPrevious}, previousDuration="${previousDuration}", timeOffset=${timeOffset}ms`);
                
                if (Array.isArray(response.datapoints)) {
                    // Array format: [[value, timestamp], ...]
                    dataPoints = response.datapoints.map(dp => {
                        let timestamp = dp[1];
                        // Shift timestamp forward for previous period
                        if (timeOffset > 0) {
                            timestamp = timestamp + timeOffset;
                        }
                        return {
                            time: new Date(timestamp),
                            value: dp[0]
                        };
                    });
                } else if (typeof response.datapoints === 'object') {
                    // Object format: { "timestamp": value, ... }
                    dataPoints = Object.entries(response.datapoints).map(([time, value]) => {
                        let timestamp = parseInt(time);
                        // Shift timestamp forward for previous period
                        if (timeOffset > 0) {
                            timestamp = timestamp + timeOffset;
                        }
                        return {
                            time: new Date(timestamp),
                            value: value
                        };
                    });
                }
                
                dataPoints.forEach(dp => {
                    const timeKey = dp.time.getTime();
                    allTimePoints.add(timeKey);
                    if (!seriesData.has(seriesName)) {
                        seriesData.set(seriesName, new Map());
                    }
                    seriesData.get(seriesName).set(timeKey, dp.value);
                });
            } else if (response.times && response.values) {
                // Simple timeseries format
                const times = response.times || [];
                const values = response.values || [];
                let seriesName = response.displayName || target.refId || `Series ${index + 1}`;
                // Append duration suffix if this is previous period data (format: "series name(-7d)")
                if (targetData.isPrevious && previousDuration) {
                    // Use previousDuration as-is if it already starts with "-", otherwise add "-"
                    const suffix = previousDuration.startsWith('-') ? previousDuration : '-' + previousDuration;
                    seriesName = `${seriesName}(${suffix})`;
                }
                
                // Calculate time offset for previous period (shift forward to overlap)
                const timeOffset = (targetData.isPrevious && previousDuration) ? 
                                  this.parseDuration(previousDuration) : 0;
                
                console.log(`Times/values format: seriesName="${seriesName}", isPrevious=${targetData.isPrevious}, previousDuration="${previousDuration}", timeOffset=${timeOffset}ms`);
                
                times.forEach((time, i) => {
                    let timeMs = new Date(time).getTime();
                    // Shift timestamp forward for previous period
                    if (timeOffset > 0) {
                        timeMs = timeMs + timeOffset;
                    }
                    allTimePoints.add(timeMs);
                    if (!seriesData.has(seriesName)) {
                        seriesData.set(seriesName, new Map());
                    }
                    seriesData.get(seriesName).set(timeMs, values[i]);
                });
            }
        });
        
        // Convert to sorted array for labels (as timestamps for Chart.js)
        const sortedTimes = Array.from(allTimePoints).sort((a, b) => a - b);
        
        // Debug: Log time range for verification
        if (sortedTimes.length > 0) {
            const timeRange = sortedTimes[sortedTimes.length - 1] - sortedTimes[0];
            console.log(`Chart data time range: ${new Date(sortedTimes[0]).toISOString()} to ${new Date(sortedTimes[sortedTimes.length - 1]).toISOString()} (${timeRange / 1000 / 60} minutes)`);
        }
        
        // Build datasets - Chart.js expects {x: timestamp, y: value} for time series
        const datasets = [];
        seriesData.forEach((dataMap, seriesName) => {
            const data = sortedTimes.map(time => {
                const value = dataMap.get(time);
                return value !== undefined && value !== null ? { x: time, y: value } : null;
            }).filter(d => d !== null);
            
            // Debug: Log first and last data points for verification
            if (data.length > 0) {
                const firstPoint = data[0];
                const lastPoint = data[data.length - 1];
                console.log(`Series "${seriesName}" - First: x=${new Date(firstPoint.x).toISOString()}, y=${firstPoint.y}, Last: x=${new Date(lastPoint.x).toISOString()}, y=${lastPoint.y}, Total points: ${data.length}`);
            }
            
            const lineWidth = panel.fieldConfig?.defaults?.custom?.lineWidth || 0.75;
            console.log(`[GenieDashboard] Series "${seriesName}" - lineWidth: ${lineWidth}, panel.fieldConfig?.defaults?.custom?.lineWidth: ${panel.fieldConfig?.defaults?.custom?.lineWidth}`);
            const drawStyle = panel.fieldConfig?.defaults?.custom?.drawStyle || 'line';
            
            datasets.push({
                label: seriesName,
                data: data,
                borderColor: this.getSeriesColor(seriesName, panel, datasets.length),
                backgroundColor: this.getSeriesColor(seriesName, panel, datasets.length) + '20',
                tension: drawStyle === 'smooth' ? 0.4 : 0.1,
                fill: panel.fieldConfig?.defaults?.custom?.fillOpacity > 0,
                spanGaps: panel.fieldConfig?.defaults?.custom?.spanNulls || false,
                pointRadius: panel.fieldConfig?.defaults?.custom?.showPoints === 'never' ? 0 : 
                             (panel.fieldConfig?.defaults?.custom?.showPoints === 'auto' ? 3 : 
                              (panel.fieldConfig?.defaults?.custom?.pointSize || 3) / 2),
                pointHoverRadius: 6, // Larger radius on hover for better tooltip interaction
                pointHoverBorderWidth: 2,
                borderWidth: lineWidth,
                stepped: drawStyle === 'step' || drawStyle === 'stepBefore' || drawStyle === 'stepAfter' ? true : false
            });
        });
        
        return {
            labels: [], // Not needed when using {x, y} format
            datasets: datasets.length > 0 ? datasets : []
        };
    }
    
    /**
     * Extract series name from response
     * Builds displayName from scope, metric, and tags if not provided
     */
    getSeriesName(series, target, panel) {
        // First, determine the original series name to match against
        const originalSeriesName = series.displayName || 
                                   series.target || 
                                   series.name || 
                                   this.buildDisplayName(series) || 
                                   (series.tags && series.tags.name) || 
                                   '';
        
        // Also get metric name separately for matching (e.g., "app_cpu_time")
        const metricName = series.metric || '';
        
        // Check panel overrides first for displayName
        if (panel && panel.fieldConfig && panel.fieldConfig.overrides) {
            for (const override of panel.fieldConfig.overrides) {
                if (override.matcher && override.matcher.id === 'byRegexp') {
                    // Create regex from matcher options (remove leading/trailing slashes)
                    const regexPattern = override.matcher.options.replace(/^\/|\/$/g, '');
                    const regex = new RegExp(regexPattern, 'i');
                    
                    // Test against:
                    // 1. Original series name (full name like "core.aws...:app_cpu_time{...}")
                    // 2. Metric name only (e.g., "app_cpu_time")
                    // 3. Display name if provided
                    const matches = regex.test(originalSeriesName) || 
                                   (metricName && regex.test(metricName)) ||
                                   (series.displayName && regex.test(series.displayName)) ||
                                   (series.name && regex.test(series.name)) ||
                                   (series.target && regex.test(series.target));
                    
                    if (matches) {
                        const displayNameProp = override.properties.find(p => p.id === 'displayName');
                        if (displayNameProp && displayNameProp.value) {
                            return displayNameProp.value;
                        }
                    }
                }
            }
        }
        
        // If no override matched, return the original series name
        return originalSeriesName || target.refId || 'Unknown';
    }
    
    /**
     * Build displayName from scope, metric, and tags
     */
    buildDisplayName(series) {
        if (!series.scope && !series.metric) {
            return null;
        }
        
        const parts = [];
        
        // Add scope if available
        if (series.scope) {
            parts.push(series.scope);
        }
        
        // Add metric if available
        if (series.metric) {
            parts.push(series.metric);
        }
        
        // Build tags string
        if (series.tags && typeof series.tags === 'object') {
            const tagEntries = [];
            
            // Select important tags to include (optional - can be customized)
            const importantTags = ['cell', 'role', 'service', 'pod', 'k8s_pod_name', 'instance', 'host'];
            
            // First, add important tags if they exist
            importantTags.forEach(tagKey => {
                if (series.tags[tagKey] !== undefined && series.tags[tagKey] !== null) {
                    tagEntries.push(`${tagKey}=${series.tags[tagKey]}`);
                }
            });
            
            // Then add other tags (limit to avoid overly long names)
            let otherTagsAdded = 0;
            const maxOtherTags = 3;
            for (const [key, value] of Object.entries(series.tags)) {
                if (!importantTags.includes(key) && value !== undefined && value !== null) {
                    if (otherTagsAdded < maxOtherTags) {
                        tagEntries.push(`${key}=${value}`);
                        otherTagsAdded++;
                    }
                }
            }
            
            if (tagEntries.length > 0) {
                parts.push(`{${tagEntries.join(',')}}`);
            }
        }
        
        return parts.join(':');
    }
    
    /**
     * Extract data points from series object
     */
    extractDataPoints(series) {
        if (series.datapoints) {
            if (Array.isArray(series.datapoints)) {
                // Array format: [[value, timestamp], ...]
                return series.datapoints.map(dp => ({
                    time: new Date(dp[1]),
                    value: dp[0]
                }));
            } else if (typeof series.datapoints === 'object') {
                // Object format: { "timestamp": value, ... }
                return Object.entries(series.datapoints).map(([time, value]) => ({
                    time: new Date(parseInt(time)),
                    value: value
                }));
            }
        }
        if (series.times && series.values) {
            return series.times.map((time, i) => ({
                time: new Date(time),
                value: series.values[i]
            }));
        }
        return [];
    }
    
    /**
     * Get color for a series based on panel configuration
     */
    getSeriesColor(seriesName, panel, index) {
        const overrides = panel.fieldConfig?.overrides || [];
        
        // Check for regex matches in overrides
        for (const override of overrides) {
            if (override.matcher && override.matcher.id === 'byRegexp') {
                const regex = new RegExp(override.matcher.options, 'i');
                if (regex.test(seriesName)) {
                    const colorProp = override.properties.find(p => p.id === 'color');
                    if (colorProp && colorProp.value) {
                        return this.resolveColor(colorProp.value.fixedColor || colorProp.value);
                    }
                }
            }
        }
        
        // Default color palette
        const palette = [
            '#3b82f6', // blue
            '#ef4444', // red
            '#10b981', // green
            '#f59e0b', // amber
            '#8b5cf6', // violet
            '#ec4899', // pink
            '#06b6d4', // cyan
            '#84cc16', // lime
            '#f97316', // orange
            '#6366f1'  // indigo
        ];
        
        return palette[index % palette.length];
    }
    
    /**
     * Resolve color value (handle named colors, hex, rgb, etc.)
     */
    resolveColor(color) {
        const colorMap = {
            'dark-green': '#059669',
            'dark-orange': '#d97706',
            'dark-red': '#dc2626',
            'super-light-red': '#fee2e2',
            'semi-dark-blue': '#1e40af',
            'light-blue': '#3b82f6',
            'light-green': '#10b981',
            'light-yellow': '#fbbf24',
            'light-red': '#ef4444'
        };
        
        return colorMap[color] || color;
    }
    
    /**
     * Apply field config overrides to chart configuration
     */
    applyFieldConfigToChart(chartConfig, panel) {
        // Apply thresholds, colors, etc. from fieldConfig
        // This is a simplified version - can be expanded
    }
    
    /**
     * Set up tooltip handlers for a chart
     */
    setupTooltipHandlers(canvas, chart, chartContent, panel) {
        // Check if chart and canvas are valid
        if (!chart || !canvas) {
            return;
        }
        
        // Remove existing tooltip container if it exists
        const existingTooltip = document.getElementById(`${this.instanceId}-chartjs-tooltip-${panel.id}`);
        if (existingTooltip) {
            existingTooltip.remove();
        }
        
        // Function to apply tooltip styles
        const applyTooltipStyles = () => {
            const tooltipId = `${this.instanceId}-chartjs-tooltip-${panel.id}`;
            const tooltip = document.getElementById(tooltipId) || document.querySelector('.chartjs-tooltip');
            if (tooltip) {
                // Apply styles to tooltip container - allow natural width
                tooltip.style.width = 'auto';
                tooltip.style.boxSizing = 'border-box';
                
                // Force left alignment - remove any right positioning
                if (tooltip.style.right) {
                    tooltip.style.right = '';
                }
                tooltip.style.transform = '';
                tooltip.style.transformOrigin = '';
                
                // Ensure body items use flexbox
                const bodyItems = tooltip.querySelectorAll('.chartjs-tooltip-body-item');
                bodyItems.forEach(item => {
                    item.style.display = 'flex';
                    item.style.alignItems = 'center';
                });
                
                // Ensure labels and values can expand
                const labels = tooltip.querySelectorAll('.chartjs-tooltip-body-item-label, .chartjs-tooltip-body-item-value');
                labels.forEach(label => {
                    label.style.flex = '1 1 auto';
                });
                
                // Ensure color squares/markers stay visible and don't shrink or expand
                const colorMarkers = tooltip.querySelectorAll('.chartjs-tooltip-body-item-marker, .chartjs-tooltip-body-item-color, [class*="marker"], span[style*="background"]');
                colorMarkers.forEach(marker => {
                    marker.style.flexShrink = '0';
                    marker.style.flexGrow = '0';
                    marker.style.flexBasis = '12px';
                    marker.style.minWidth = '12px';
                    marker.style.maxWidth = '12px';
                    marker.style.width = '12px';
                    marker.style.minHeight = '12px';
                    marker.style.maxHeight = '12px';
                    marker.style.height = '12px';
                    marker.style.display = 'inline-block';
                    marker.style.visibility = 'visible';
                    marker.style.opacity = '1';
                    marker.style.marginRight = '8px';
                    marker.style.boxSizing = 'border-box';
                });
            }
        };
        
        // Use MutationObserver to watch for tooltip creation and updates
        const observer = new MutationObserver((mutations) => {
            let shouldApply = false;
            mutations.forEach((mutation) => {
                // Check for added nodes
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        if (node.id === `${this.instanceId}-chartjs-tooltip-${panel.id}` || 
                            node.classList.contains('chartjs-tooltip') ||
                            node.querySelector('.chartjs-tooltip') ||
                            node.querySelector(`#${this.instanceId}-chartjs-tooltip-${panel.id}`)) {
                            shouldApply = true;
                        }
                    }
                });
                // Also check for attribute changes (Chart.js updates tooltip content via attributes)
                if (mutation.type === 'attributes' || mutation.type === 'childList') {
                    const tooltipId = `${this.instanceId}-chartjs-tooltip-${panel.id}`;
                    const tooltip = document.getElementById(tooltipId) || document.querySelector('.chartjs-tooltip');
                    if (tooltip && (mutation.target === tooltip || tooltip.contains(mutation.target))) {
                        shouldApply = true;
                    }
                }
            });
            if (shouldApply) {
                applyTooltipStyles();
            }
        });
        
        // Observe the document body for tooltip creation and updates
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class'] // Watch for style and class changes
        });
        
        // Also apply styles on chart hover events
        canvas.addEventListener('mousemove', () => {
            setTimeout(applyTooltipStyles, 0);
        });
        
        // Manually create tooltip element since Chart.js might not be creating it
        // Chart.js v4 should create it automatically, but sometimes doesn't in certain conditions
        const tooltipContainer = document.createElement('div');
        tooltipContainer.id = `${this.instanceId}-chartjs-tooltip-${panel.id}`;
        tooltipContainer.className = 'chartjs-tooltip';
        tooltipContainer.style.cssText = 'position: fixed; z-index: 10000; pointer-events: none; opacity: 0; transition: opacity 0.1s;';
        document.body.appendChild(tooltipContainer);
        
        // Add event listeners to manually show tooltips if Chart.js doesn't
        const mousemoveHandler = function(e) {
            // Check if chart is still valid (not destroyed)
            if (!chart || !chart.canvas || chart.canvas !== canvas) {
                return;
            }
            
            try {
                const activeElements = chart.getElementsAtEventForMode(e, 'index', { intersect: false }, true);
                if (activeElements.length > 0) {
                    // Get tooltip data
                    const tooltipModel = chart.tooltip;
                    if (tooltipModel && tooltipModel.opacity > 0) {
                        // Chart.js is handling it - hide our manual tooltip
                        tooltipContainer.style.opacity = '0';
                        tooltipContainer.style.visibility = 'hidden';
                        return;
                    }
                    
                    // Manually show tooltip
                    const x = e.clientX;
                    const y = e.clientY;
                    
                    let tooltipHTML = '<div style="background: white; color: black; padding: 10px; border-radius: 6px; font-size: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2); border: 1px solid rgba(0, 0, 0, 0.2); white-space: nowrap; overflow: visible; max-width: none; width: auto;">';
                    
                    // Add title with timestamp
                    if (activeElements.length > 0) {
                        const firstElement = activeElements[0];
                        const datasetIndex = firstElement.datasetIndex;
                        const index = firstElement.index;
                        const dataset = chart.data.datasets[datasetIndex];
                        const dataPoint = dataset.data[index];
                        
                        if (dataPoint && dataPoint.x) {
                            const timestamp = typeof dataPoint.x === 'number' ? dataPoint.x : new Date(dataPoint.x).getTime();
                            const date = new Date(timestamp);
                            if (!isNaN(date.getTime())) {
                                // Format in UTC timezone
                                const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
                                const day = String(date.getUTCDate()).padStart(2, '0');
                                const hours = String(date.getUTCHours()).padStart(2, '0');
                                const minutes = String(date.getUTCMinutes()).padStart(2, '0');
                                const formattedDate = `${month} ${day}, ${hours}:${minutes} UTC`;
                                tooltipHTML += '<div style="font-weight: bold; margin-bottom: 6px; font-size: 12px; border-bottom: 1px solid rgba(0,0,0,0.2); padding-bottom: 4px;">' + formattedDate + '</div>';
                            } else {
                                console.warn('Invalid timestamp in tooltip dataPoint.x:', dataPoint.x);
                            }
                        }
                    }
                    
                    // Sort active elements by dataset label for consistent ordering
                    const sortedElements = Array.from(activeElements).sort((a, b) => {
                        const datasetA = chart.data.datasets[a.datasetIndex];
                        const datasetB = chart.data.datasets[b.datasetIndex];
                        const labelA = (datasetA.label || 'Series ' + (a.datasetIndex + 1)).toLowerCase();
                        const labelB = (datasetB.label || 'Series ' + (b.datasetIndex + 1)).toLowerCase();
                        return labelA.localeCompare(labelB);
                    });
                    
                    sortedElements.forEach(element => {
                        const datasetIndex = element.datasetIndex;
                        const index = element.index;
                        const dataset = chart.data.datasets[datasetIndex];
                        const dataPoint = dataset.data[index];
                        const value = dataPoint ? dataPoint.y : null;
                        
                        if (value === null || value === undefined || isNaN(value)) {
                            return;
                        }
                        
                        const label = dataset.label || 'Series ' + (datasetIndex + 1);
                        const color = dataset.borderColor || dataset.backgroundColor || '#3b82f6';
                        const unit = panel.fieldConfig?.defaults?.unit || '';
                        
                        // Check if this is a percentile point when sorting is enabled
                        let percentileLabel = null;
                        if (panel._sortEnabled && index !== undefined && index !== null) {
                            // Method 1: Check if dataPoint has percentile property
                            if (dataPoint && typeof dataPoint === 'object' && dataPoint.percentile) {
                                const pLabel = dataPoint.percentile;
                                if (pLabel && ['P99.9', 'P99', 'P95', 'P90', 'P50'].includes(pLabel)) {
                                    percentileLabel = pLabel;
                                }
                            }
                            
                            // Method 2: Calculate from x-value (index) using dataset's percentile positions
                            if (!percentileLabel && dataset._percentilePositions && dataPoint && dataPoint.x !== undefined) {
                                const xIndex = Math.round(dataPoint.x);
                                const positions = dataset._percentilePositions;
                                if (xIndex === positions.p99_9) {
                                    percentileLabel = 'P99.9';
                                } else if (xIndex === positions.p99) {
                                    percentileLabel = 'P99';
                                } else if (xIndex === positions.p95) {
                                    percentileLabel = 'P95';
                                } else if (xIndex === positions.p90) {
                                    percentileLabel = 'P90';
                                } else if (xIndex === positions.p50) {
                                    percentileLabel = 'P50';
                                }
                            }
                            
                            // Method 3: Use _percentileLabels array
                            if (!percentileLabel && dataset._percentileLabels && dataset._percentileLabels[index]) {
                                const pLabel = dataset._percentileLabels[index];
                                if (pLabel && ['P99.9', 'P99', 'P95', 'P90', 'P50'].includes(pLabel)) {
                                    percentileLabel = pLabel;
                                }
                            }
                        }
                        
                        // Find matching previous/current series for percentage difference calculation
                        let percentDiff = null;
                        if (percentileLabel && panel._sortEnabled && index !== undefined && index !== null) {
                            // Previous series have labels like "Series Name(-7d)" or "Series Name(-1h)"
                            // Extract base label by removing the suffix in parentheses
                            const baseLabel = label.replace(/\s*\([^)]*\)\s*$/, ''); // Remove suffix like "(-7d)"
                            const isCurrentSeries = !label.match(/\(-[^)]+\)$/); // Current series don't have "(-duration)" suffix
                            
                            // Find matching dataset at the same x-index (same percentile position)
                            for (let i = 0; i < chart.data.datasets.length; i++) {
                                if (i === datasetIndex) continue; // Skip current dataset
                                
                                const otherDataset = chart.data.datasets[i];
                                const otherLabel = otherDataset.label || '';
                                const otherBaseLabel = otherLabel.replace(/\s*\([^)]*\)\s*$/, ''); // Remove suffix
                                
                                // Check if this is the matching series (opposite period)
                                let isMatchingSeries = false;
                                if (isCurrentSeries) {
                                    // Current series: look for previous series (has "(-duration)" suffix and same base name)
                                    isMatchingSeries = otherLabel.match(/\(-[^)]+\)$/) !== null && 
                                                      otherBaseLabel.toLowerCase() === baseLabel.toLowerCase();
                                } else {
                                    // Previous series: look for current series (no "(-duration)" suffix and same base name)
                                    isMatchingSeries = !otherLabel.match(/\(-[^)]+\)$/) && 
                                                      otherBaseLabel.toLowerCase() === baseLabel.toLowerCase();
                                }
                                
                                if (isMatchingSeries && otherDataset.data && otherDataset.data[index]) {
                                    const otherDataPoint = otherDataset.data[index];
                                    const otherValue = otherDataPoint && typeof otherDataPoint === 'object' ? otherDataPoint.y : otherDataPoint;
                                    
                                    // Check if the other point is at the same percentile position
                                    let otherIsPercentile = false;
                                    if (otherDataPoint && typeof otherDataPoint === 'object' && otherDataPoint.percentile) {
                                        otherIsPercentile = otherDataPoint.percentile === percentileLabel;
                                    } else if (otherDataset._percentilePositions && otherDataPoint && otherDataPoint.x !== undefined) {
                                        const otherXIndex = Math.round(otherDataPoint.x);
                                        const otherPositions = otherDataset._percentilePositions;
                                        otherIsPercentile = (otherXIndex === otherPositions.p99_9 && percentileLabel === 'P99.9') ||
                                                          (otherXIndex === otherPositions.p99 && percentileLabel === 'P99') ||
                                                          (otherXIndex === otherPositions.p95 && percentileLabel === 'P95') ||
                                                          (otherXIndex === otherPositions.p90 && percentileLabel === 'P90') ||
                                                          (otherXIndex === otherPositions.p50 && percentileLabel === 'P50');
                                    }
                                    
                                    if (otherIsPercentile && otherValue !== null && otherValue !== undefined && !isNaN(otherValue)) {
                                        // Calculate percentage difference: 100 * (thisValue - otherValue) / thisValue
                                        // Handle edge case when thisValue is 0
                                        if (value === 0) {
                                            // If current value is 0 and previous is non-zero, show -100% (or +100% if previous is negative)
                                            if (otherValue !== 0) {
                                                console.log(`[Compare Calculation] Tooltip (percentile, edge case) - Series: ${label}, Current Value: ${value}, Other Value: ${otherValue}, Expression: special case (value is 0)`);
                                                percentDiff = otherValue > 0 ? -100 : 100;
                                            } else {
                                                // Both are 0, no change
                                                console.log(`[Compare Calculation] Tooltip (percentile, edge case) - Series: ${label}, Current Value: ${value}, Other Value: ${otherValue}, Expression: both values are 0`);
                                                percentDiff = 0;
                                            }
                                        } else {
                                            // Normal case: 100 * (thisValue - otherValue) / thisValue
                                            console.log(`[Compare Calculation] Tooltip (percentile) - Series: ${label}, Current Value: ${value}, Other Value: ${otherValue}, Expression: 100 * (${value} - ${otherValue}) / ${value}`);
                                            percentDiff = 100 * (value - otherValue) / value;
                                        }
                                        break; // Found matching series
                                    }
                                }
                            }
                        }
                        
                        // Format tooltip text: metric:value(P90)(+5.2%) for percentile points with comparison
                        let tooltipText;
                        if (percentileLabel) {
                            tooltipText = label + ':' + value.toFixed(2) + '(' + percentileLabel + ')';
                            if (percentDiff !== null && !isNaN(percentDiff)) {
                                const sign = percentDiff >= 0 ? '+' : '';
                                tooltipText += '(' + sign + percentDiff.toFixed(2) + '%)';
                            }
                        } else {
                            tooltipText = label + ': ' + value.toFixed(2) + (unit ? ' ' + unit : '');
                        }
                        
                        tooltipHTML += '<div style="margin: 3px 0; display: flex; align-items: center; white-space: nowrap; overflow: visible; max-width: none;">' +
                              '<span style="display: inline-block; width: 10px; height: 10px; background: ' + color + '; margin-right: 6px; border-radius: 2px; flex-shrink: 0;"></span>' +
                              '<span style="font-size: 12px; white-space: nowrap; overflow: visible; max-width: none;">' + tooltipText + '</span>' +
                              '</div>';
                    });
                    
                    tooltipHTML += '</div>';
                    
                    tooltipContainer.innerHTML = tooltipHTML;
                    
                    // Measure tooltip dimensions (need to be visible temporarily to measure)
                    tooltipContainer.style.display = 'block';
                    tooltipContainer.style.visibility = 'hidden'; // Hidden but still measured
                    const tooltipWidth = tooltipContainer.offsetWidth;
                    const tooltipHeight = tooltipContainer.offsetHeight;
                    
                    // Get window dimensions
                    const windowWidth = window.innerWidth;
                    const windowHeight = window.innerHeight;
                    
                    // Determine horizontal position - always align to the left of cursor
                    const offsetX = 15; // Offset from mouse cursor
                    let left = x + offsetX;
                    const spaceOnRight = windowWidth - x;
                    
                    // If tooltip would overflow right edge, adjust left position but keep left alignment
                    if (spaceOnRight < tooltipWidth + offsetX + 10) {
                        // Keep left alignment, just shift it left to fit
                        left = windowWidth - tooltipWidth - 10;
                        // Ensure it doesn't go off left edge
                        if (left < 10) {
                            left = 10;
                        }
                    }
                    
                    // Determine vertical position
                    const offsetY = 15; // Offset from mouse cursor
                    let top = y - offsetY;
                    const spaceOnBottom = windowHeight - y;
                    const spaceOnTop = y;
                    
                    // If tooltip would overflow bottom edge, position it above cursor
                    if (spaceOnBottom < tooltipHeight + offsetY + 10) {
                        top = y - tooltipHeight - offsetY;
                        // Ensure it doesn't go off top edge
                        if (top < 10) {
                            top = 10;
                        }
                    } else if (spaceOnTop < tooltipHeight / 2) {
                        // If near top edge, position below cursor
                        top = y + offsetY;
                    }
                    
                    // Apply positioning
                    tooltipContainer.style.left = left + 'px';
                    tooltipContainer.style.top = top + 'px';
                    tooltipContainer.style.opacity = '1';
                    tooltipContainer.style.visibility = 'visible';
                    tooltipContainer.style.display = 'block';
                } else {
                    // No active elements, hide tooltip
                    tooltipContainer.style.opacity = '0';
                    tooltipContainer.style.visibility = 'hidden';
                }
            } catch (error) {
                // Chart might be destroyed, silently ignore
                console.debug('Tooltip error (chart may be destroyed):', error);
            }
        };
        
        canvas.addEventListener('mousemove', mousemoveHandler);
        
        // Hide tooltip function
        const hideTooltip = function() {
            tooltipContainer.style.opacity = '0';
            tooltipContainer.style.visibility = 'hidden';
            tooltipContainer.style.display = 'none';
            tooltipContainer.innerHTML = '';
        };
        
        // Hide when mouse leaves canvas
        const mouseleaveHandler = hideTooltip;
        const mouseoutHandler = hideTooltip;
        canvas.addEventListener('mouseleave', mouseleaveHandler);
        canvas.addEventListener('mouseout', mouseoutHandler);
        
        // Also hide when mouse leaves the chart content container
        const chartContentMouseLeaveHandler = function(e) {
            // Only hide if we're actually leaving the chart area (not just moving to a child element)
            if (!chartContent.contains(e.relatedTarget) && e.relatedTarget !== canvas) {
                hideTooltip();
            }
        };
        chartContent.addEventListener('mouseleave', chartContentMouseLeaveHandler);
        
        // Global document-level listener to catch mouse leaving the page/chart area
        const globalMouseMoveHandler = function(e) {
            // Check if canvas is still in DOM
            if (!canvas || !canvas.isConnected) {
                return;
            }
            
            try {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX;
                const y = e.clientY;
                
                // Check if mouse is completely outside canvas bounds (with small margin for tooltip)
                if (x < rect.left - 50 || x > rect.right + 50 || y < rect.top - 50 || y > rect.bottom + 50) {
                    hideTooltip();
                }
            } catch (error) {
                // Canvas might be removed, silently ignore
            }
        };
        
        // Use capture phase to catch events before they bubble
        document.addEventListener('mousemove', globalMouseMoveHandler, true);
        
        // Also hide on any click outside chart
        const clickHandler = function(e) {
            if (!canvas || !canvas.isConnected) {
                return;
            }
            if (!canvas.contains(e.target) && !tooltipContainer.contains(e.target)) {
                hideTooltip();
            }
        };
        document.addEventListener('click', clickHandler, true);
        
        // Store references for potential cleanup
        chart._hideTooltipFn = hideTooltip;
        chart._globalMouseMoveHandler = globalMouseMoveHandler;
        chart._clickHandler = clickHandler;
        chart._mousemoveHandler = mousemoveHandler;
        chart._mouseleaveHandler = mouseleaveHandler;
        chart._mouseoutHandler = mouseoutHandler;
        chart._chartContentMouseLeaveHandler = chartContentMouseLeaveHandler;
        chart._tooltipContainer = tooltipContainer;
    }
    
    /**
     * Render stat/singlestat chart
     */
    renderStatChart(panel, dataArray, container) {
        container.innerHTML = '';
        
        const statValue = this.calculateStatValue(dataArray, panel);
        const gridPos = panel.gridPos || { x: 0, y: 0, w: 12, h: 8 };
        
        // Adjust font size based on gridPos.h to make stat panels responsive
        // For smaller heights (h < 4), use smaller font
        let fontSize = 48;
        if (gridPos.h <= 2) {
            fontSize = 32;
        } else if (gridPos.h <= 4) {
            fontSize = 40;
        }
        
        // Remove all padding for stat panels to maximize available space
        const statDiv = document.createElement('div');
        statDiv.style.cssText = `font-size: ${fontSize}px; font-weight: bold; text-align: center; padding: 0; margin: 0; color: #1f2937; display: flex; align-items: center; justify-content: center; height: 100%; width: 100%; box-sizing: border-box;`;
        statDiv.textContent = statValue;
        
        const unit = panel.fieldConfig?.defaults?.unit || '';
        if (unit) {
            const unitSpan = document.createElement('span');
            unitSpan.style.cssText = `font-size: ${Math.round(fontSize * 0.5)}px; color: #6b7280; margin-left: 8px;`;
            unitSpan.textContent = unit;
            statDiv.appendChild(unitSpan);
        }
        
        container.appendChild(statDiv);
    }
    
    /**
     * Calculate stat value from data
     */
    calculateStatValue(dataArray, panel) {
        // Get reduce options
        const reduceOptions = panel.options?.reduceOptions || {};
        const calc = reduceOptions.calcs?.[0] || 'lastNotNull';
        
        // Extract value from first series
        if (dataArray.length > 0 && dataArray[0].data) {
            const response = dataArray[0].data;
            let firstSeries = null;
            
            // Handle different response formats
            if (Array.isArray(response)) {
                firstSeries = response[0];
            } else {
                firstSeries = response;
            }
            
            if (firstSeries && firstSeries.datapoints) {
                let points = [];
                
                // Handle array format: [[value, timestamp], ...]
                if (Array.isArray(firstSeries.datapoints)) {
                    points = firstSeries.datapoints.filter(dp => dp && dp[0] != null);
                    if (points.length > 0) {
                        // Get last value based on calc
                        if (calc === 'lastNotNull' || calc === 'last') {
                            return points[points.length - 1][0];
                        } else if (calc === 'first' || calc === 'firstNotNull') {
                            return points[0][0];
                        } else if (calc === 'max') {
                            return Math.max(...points.map(dp => dp[0]));
                        } else if (calc === 'min') {
                            return Math.min(...points.map(dp => dp[0]));
                        } else if (calc === 'mean' || calc === 'avg') {
                            const sum = points.reduce((acc, dp) => acc + dp[0], 0);
                            return (sum / points.length).toFixed(2);
                        } else if (calc === 'sum') {
                            return points.reduce((acc, dp) => acc + dp[0], 0);
                        } else {
                            return points[points.length - 1][0]; // Default to last
                        }
                    }
                } 
                // Handle object format: { "timestamp": value, ... }
                else if (typeof firstSeries.datapoints === 'object') {
                    const entries = Object.entries(firstSeries.datapoints)
                        .filter(([time, value]) => value != null)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b));
                    
                    if (entries.length > 0) {
                        if (calc === 'lastNotNull' || calc === 'last') {
                            return entries[entries.length - 1][1];
                        } else if (calc === 'first' || calc === 'firstNotNull') {
                            return entries[0][1];
                        } else if (calc === 'max') {
                            return Math.max(...entries.map(([t, v]) => v));
                        } else if (calc === 'min') {
                            return Math.min(...entries.map(([t, v]) => v));
                        } else if (calc === 'mean' || calc === 'avg') {
                            const sum = entries.reduce((acc, [t, v]) => acc + v, 0);
                            return (sum / entries.length).toFixed(2);
                        } else if (calc === 'sum') {
                            return entries.reduce((acc, [t, v]) => acc + v, 0);
                        } else {
                            return entries[entries.length - 1][1]; // Default to last
                        }
                    }
                }
            }
        }
        
        return 'N/A';
    }
    
    /**
     * Render table chart
     */
    renderTableChart(panel, dataArray, container) {
        container.innerHTML = '';
        
        // Simple table rendering - can be enhanced
        const table = document.createElement('table');
        table.style.cssText = 'width: 100%; border-collapse: collapse;';
        
        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th>Series</th><th>Value</th>';
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create body
        const tbody = document.createElement('tbody');
        dataArray.forEach(targetData => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${targetData.refId}</td><td>${JSON.stringify(targetData.data)}</td>`;
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        container.appendChild(table);
    }
    
    /**
     * Render gauge chart
     */
    renderGaugeChart(panel, dataArray, container) {
        // Placeholder for gauge - can use Chart.js gauge or similar
        this.renderStatChart(panel, dataArray, container);
    }
    
    /**
     * Render bar gauge chart
     */
    renderBarGaugeChart(panel, dataArray, container) {
        // Placeholder for bar gauge
        this.renderStatChart(panel, dataArray, container);
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
        this.dataCache = {};
        this.container.innerHTML = '';
        this.panels = [];
    }
    
    /**
     * Show panel settings slide-in panel
     */
    async showPanelSettings(panel, container, header) {
        // Remove existing settings panel if any
        const existingPanel = document.getElementById(`${this.instanceId}-panel-settings-${panel.id}`);
        if (existingPanel) {
            existingPanel.remove();
        }
        
        // Get current aggregation config to ensure configured tag is included
        // Check multiple possible locations for aggregation config
        // Also check original dashboard config in case panel object was modified
        const originalPanel = this.dashboardConfig?.panels?.find(p => p.id === panel.id) || panel;
        const currentAggregationConfig = panel.aggregation || 
                                        originalPanel?.aggregation ||
                                        panel.options?.aggregation ||
                                        originalPanel?.options?.aggregation ||
                                        panel.timeSeries?.aggregation || 
                                        originalPanel?.timeSeries?.aggregation ||
                                        panel.options?.timeSeries?.aggregation || 
                                        originalPanel?.options?.timeSeries?.aggregation ||
                                        {};
        
        // Extract the tag from the config
        const configuredTag = currentAggregationConfig.tag ? String(currentAggregationConfig.tag).trim() : null;
        
        console.log('[Settings] Panel ID:', panel.id);
        console.log('[Settings] Original panel from dashboardConfig:', originalPanel);
        console.log('[Settings] Current panel object:', panel);
        console.log('[Settings] Current aggregation config:', currentAggregationConfig);
        console.log('[Settings] panel.aggregation:', panel.aggregation);
        console.log('[Settings] originalPanel.aggregation:', originalPanel?.aggregation);
        console.log('[Settings] Configured tag:', configuredTag);
        
        // Fetch panel data to extract available tags
        let availableTags = new Set(['scope']); // Always include 'scope' as it's a top-level field
        
        // Always include the currently configured tag if it exists
        if (configuredTag) {
            availableTags.add(configuredTag);
            console.log('[Settings] Added configured tag to available tags:', configuredTag);
        }
        
        try {
            const panelResult = await this.fetchPanelData(panel);
            const panelData = panelResult.data || panelResult; // Support both new format and legacy format
            // Extract unique tag keys from all series
            panelData.forEach(targetData => {
                const response = targetData.data;
                let seriesArray = [];
                
                if (Array.isArray(response)) {
                    seriesArray = response;
                } else if (response && response.series && Array.isArray(response.series)) {
                    seriesArray = response.series;
                } else if (response && response.scope && response.metric) {
                    seriesArray = [response];
                } else if (response && response.times && response.values) {
                    seriesArray = [response];
                }
                
                seriesArray.forEach(series => {
                    if (series.tags && typeof series.tags === 'object') {
                        Object.keys(series.tags).forEach(tagKey => {
                            availableTags.add(tagKey);
                        });
                    }
                });
            });
        } catch (error) {
            console.warn('Could not fetch panel data for tag extraction:', error);
            // Use common tags as fallback
            ['cell', 'k8s_pod_name', 'role', 'service', 'pod', 'instance', 'host'].forEach(tag => availableTags.add(tag));
        }
        
        // Sort tags for better UX, but put configured tag at the top if it exists
        const sortedTags = Array.from(availableTags).sort((a, b) => {
            if (a === configuredTag) return -1;
            if (b === configuredTag) return 1;
            return a.localeCompare(b);
        });
        
        // Create overlay (transparent - no background darkening)
        const overlay = document.createElement('div');
        overlay.id = `${this.instanceId}-panel-settings-overlay-${panel.id}`;
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: transparent; z-index: 10000; pointer-events: none;';
        
        // Create settings panel
        const settingsPanel = document.createElement('div');
        settingsPanel.id = `${this.instanceId}-panel-settings-${panel.id}`;
        settingsPanel.style.cssText = `
            position: fixed;
            top: 0;
            right: 0;
            width: 460px;
            max-width: 90vw;
            height: 100vh;
            background: white;
            box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
            z-index: 10001;
            overflow-y: auto;
            animation: slideInRight 0.3s ease-out;
        `;
        
        // Add animation styles if not already present
        if (!document.getElementById('panel-settings-animations')) {
            const style = document.createElement('style');
            style.id = 'panel-settings-animations';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); }
                    to { transform: translateX(100%); }
                }
                .settings-panel-sliding-out {
                    animation: slideOutRight 0.3s ease-out forwards !important;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Header
        const panelHeader = document.createElement('div');
        panelHeader.style.cssText = 'padding: 12px 16px; border-bottom: 1px solid #e5e7eb; background: #f9fafb; position: sticky; top: 0; z-index: 10;';
        panelHeader.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">Panel Settings</h2>
                <button id="close-settings-${panel.id}" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #6b7280; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">&times;</button>
            </div>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">${panel.title || 'Panel ' + panel.id}</p>
        `;
        
        // Content container
        const content = document.createElement('div');
        content.style.cssText = 'padding: 12px 16px;';
        
        // Get current configurations (use the same variable we got earlier for consistency)
        const aggregationConfig = currentAggregationConfig; // Use the one we got earlier
        
        // Get panel-specific configs
        const panelStatsConfig = panel.stats || panel.options?.stats || null;
        const panelPercentBase = panel.statsTable?.percentBase || panel.options?.statsTable?.percentBase || null;
        const panelPercentTargets = panel.statsTable?.percentTargets || panel.options?.statsTable?.percentTargets || null;
        const panelTimeSeriesPrevious = panel.timeSeries?.previous || panel.options?.timeSeries?.previous || null;
        const panelStatsTablePrevious = panel.statsTable?.previous || panel.options?.statsTable?.previous || null;
        const panelTabs = panel.tabs !== undefined ? panel.tabs : (panel.options?.tabs !== undefined ? panel.options.tabs : true);
        const panelDefaultTab = panel.tab || panel.options?.tab || 'chart';
        const panelTranspose = panel.statsTable?.transpose || panel.options?.statsTable?.transpose || panel.transpose || false;
        const panelSort = panel.options?.timeSeries?.sort || false;
        const panelCumulative = panel.options?.timeSeries?.cumulative || false;
        
        // Get dashboard-level defaults
        const dashboardDefaultStats = this.inputConfig?.stats || [];
        const dashboardDefaultPrevious = this.inputConfig?.previous || null;
        
        // Get effective values (panel-specific or fallback to dashboard defaults)
        const statsConfig = panelStatsConfig || dashboardDefaultStats;
        const percentBase = panelPercentBase || '';
        const percentTargets = panelPercentTargets || [];
        const timeSeriesPrevious = panelTimeSeriesPrevious || dashboardDefaultPrevious || '';
        const statsTablePrevious = panelStatsTablePrevious || dashboardDefaultPrevious || '';
        
        // Determine which values are from panel vs dashboard defaults
        const isStatsFromDefault = !panelStatsConfig;
        const isPreviousFromDefault = !panelTimeSeriesPrevious && !panelStatsTablePrevious && dashboardDefaultPrevious;
        
        // Helper function to create form section
        const createSection = (title, content) => {
            const section = document.createElement('div');
            section.style.cssText = 'margin-bottom: 16px;';
            section.innerHTML = `
                <h3 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.3px;">${title}</h3>
                ${content}
            `;
            return section;
        };
        
        // Helper function to create form field (two-column layout: label on left, input on right)
        const createField = (label, inputHTML, description = '') => {
            const field = document.createElement('div');
            field.style.cssText = 'margin-bottom: 10px; display: grid; grid-template-columns: 120px 1fr; gap: 8px; align-items: center;';
            field.innerHTML = `
                <label style="font-size: 12px; font-weight: 500; color: #374151;">${label}:</label>
                <div>
                    ${inputHTML}
                    ${description ? `<p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280; line-height: 1.3;">${description}</p>` : ''}
                </div>
            `;
            return field;
        };
        
        // Aggregation Settings - 4 column layout
        const aggregationSection = document.createElement('div');
        // Create dropdown for aggregation tag with available tags
        // Use configuredTag variable which we already extracted
        console.log('[Settings] Creating dropdown with tags:', sortedTags);
        console.log('[Settings] Looking for configured tag:', configuredTag);
        const tagOptions = sortedTags.map(tag => {
            const isSelected = configuredTag && String(tag).trim() === String(configuredTag).trim();
            const selected = isSelected ? 'selected' : '';
            if (isSelected) {
                console.log('[Settings] Tag matched for selection:', tag, '===', configuredTag);
            }
            return `<option value="${tag.replace(/"/g, '&quot;')}" ${selected}>${tag}</option>`;
        }).join('');
        
        aggregationSection.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px;';
        aggregationSection.innerHTML = `
            <div>
                <label style="display: block; margin-bottom: 4px; font-size: 11px; font-weight: 500; color: #374151;">Aggregation Tag:</label>
                <select id="${this.instanceId}-agg-tag-${panel.id}" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 3px; font-size: 12px;">
                    <option value="">-- Select --</option>
                    ${tagOptions}
                </select>
            </div>
            <div>
                <label style="display: block; margin-bottom: 4px; font-size: 11px; font-weight: 500; color: #374151;">Aggregation Type:</label>
                <select id="${this.instanceId}-agg-type-${panel.id}" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 3px; font-size: 12px;">
                    <option value="" ${!aggregationConfig.type && (!panel._aggregationEnabled || !panel._aggregationType) ? 'selected' : ''}>-- Select --</option>
                    <option value="sum" ${aggregationConfig.type === 'sum' || (panel._aggregationEnabled && panel._aggregationType === 'sum') ? 'selected' : ''}>Sum</option>
                    <option value="avg" ${aggregationConfig.type === 'avg' || (panel._aggregationEnabled && panel._aggregationType === 'avg') ? 'selected' : ''}>Average</option>
                    <option value="min" ${aggregationConfig.type === 'min' || (panel._aggregationEnabled && panel._aggregationType === 'min') ? 'selected' : ''}>Min</option>
                    <option value="max" ${aggregationConfig.type === 'max' || (panel._aggregationEnabled && panel._aggregationType === 'max') ? 'selected' : ''}>Max</option>
                    <option value="p50" ${aggregationConfig.type === 'p50' || (panel._aggregationEnabled && panel._aggregationType === 'p50') ? 'selected' : ''}>P50</option>
                    <option value="p90" ${aggregationConfig.type === 'p90' || (panel._aggregationEnabled && panel._aggregationType === 'p90') ? 'selected' : ''}>P90</option>
                </select>
            </div>
            <div>
                <label style="display: block; margin-bottom: 4px; font-size: 11px; font-weight: 500; color: #374151;">Span Aggregation:</label>
                <input type="text" id="${this.instanceId}-agg-span-${panel.id}" value="${(aggregationConfig.span || '').replace(/"/g, '&quot;')}" placeholder="e.g., 5m, 1h" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 3px; font-size: 12px;">
            </div>
            <div>
                <label style="display: block; margin-bottom: 4px; font-size: 11px; font-weight: 500; color: #374151;">Span Type:</label>
                <select id="${this.instanceId}-agg-span-type-${panel.id}" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 3px; font-size: 12px;">
                    <option value="">-- Select --</option>
                    <option value="sum" ${(aggregationConfig.spanAggregation === 'sum' || (!aggregationConfig.spanAggregation && this.inputConfig?.['$agg'] === 'sum')) ? 'selected' : ''}>Sum</option>
                    <option value="avg" ${(aggregationConfig.spanAggregation === 'avg' || (!aggregationConfig.spanAggregation && this.inputConfig?.['$agg'] === 'avg')) ? 'selected' : ''}>Average</option>
                    <option value="max" ${(aggregationConfig.spanAggregation === 'max' || (!aggregationConfig.spanAggregation && this.inputConfig?.['$agg'] === 'max')) ? 'selected' : ''}>Max</option>
                    <option value="min" ${(aggregationConfig.spanAggregation === 'min' || (!aggregationConfig.spanAggregation && this.inputConfig?.['$agg'] === 'min')) ? 'selected' : ''}>Min</option>
                </select>
            </div>
        `;
        content.appendChild(createSection('Aggregation', aggregationSection.outerHTML));
        
        // Sync panel settings with toolbar aggregation after DOM is ready
        setTimeout(() => {
            const spanTypeSelect = document.getElementById(`${this.instanceId}-agg-span-type-${panel.id}`);
            if (spanTypeSelect) {
                // If panel doesn't have spanAggregation set, use toolbar value
                if (!aggregationConfig.spanAggregation && this.inputConfig?.['$agg']) {
                    spanTypeSelect.value = this.inputConfig['$agg'];
                }
            }
            
            // Sync "Aggregation Type" dropdown with aggregation icon button dropdown
            const aggTypeSelect = document.getElementById(`${this.instanceId}-agg-type-${panel.id}`);
            if (aggTypeSelect) {
                // Set initial value from aggregation icon button if available
                if (panel._aggregationEnabled && panel._aggregationType) {
                    aggTypeSelect.value = panel._aggregationType;
                } else {
                    // If nothing is selected, set to empty string (-- Select --)
                    aggTypeSelect.value = '';
                }
                
                // Add change listener to sync to aggregation icon button dropdown
                aggTypeSelect.addEventListener('change', () => {
                    const selectedType = aggTypeSelect.value;
                    if (selectedType) {
                        panel._aggregationEnabled = true;
                        panel._aggregationType = selectedType;
                    } else {
                        panel._aggregationEnabled = false;
                        panel._aggregationType = null;
                    }
                    
                    // Update aggregation icon button display if it exists
                    const aggregationIconButton = header?.querySelector('[data-icon="aggregation"]');
                    if (aggregationIconButton) {
                        const aggregationMenu = aggregationIconButton.parentElement?.querySelector('.genie-dashboard-aggregation-menu');
                        if (aggregationMenu) {
                            const aggregationOptions = [
                                { value: 'sum', label: 'Sum', icon: '∑' },
                                { value: 'avg', label: 'Average', icon: 'x̄' },
                                { value: 'min', label: 'Min', icon: 'min' },
                                { value: 'max', label: 'Max', icon: 'max' },
                                { value: 'p50', label: 'P50', icon: 'P50' },
                                { value: 'p90', label: 'P90', icon: 'P90' }
                            ];
                            
                            const getAggregationDisplay = (type) => {
                                const displays = {
                                    'sum': '∑',
                                    'avg': 'x̄',
                                    'min': 'min',
                                    'max': 'max',
                                    'p50': 'P50',
                                    'p90': 'P90'
                                };
                                return displays[type] || '⚙️';
                            };
                            
                            // Update button display
                            if (panel._aggregationEnabled && panel._aggregationType) {
                                aggregationIconButton.innerHTML = `<span class="genie-dashboard-tab-icon">${getAggregationDisplay(panel._aggregationType)}</span>`;
                                aggregationIconButton.title = `${panel._aggregationType.charAt(0).toUpperCase() + panel._aggregationType.slice(1)} aggregation`;
                                aggregationIconButton.style.background = 'rgba(59, 130, 246, 0.1)';
                                aggregationIconButton.style.color = '#3b82f6';
                                aggregationIconButton.style.fontWeight = '500';
                            } else {
                                aggregationIconButton.innerHTML = '<span class="genie-dashboard-tab-icon">∑</span>';
                                aggregationIconButton.title = 'Aggregation options';
                                aggregationIconButton.style.background = 'transparent';
                                aggregationIconButton.style.color = '#6b7280';
                                aggregationIconButton.style.fontWeight = '500';
                            }
                            
                            // Update menu items highlighting
                            aggregationMenu.querySelectorAll('.genie-dashboard-aggregation-menu-item').forEach((item, idx) => {
                                const opt = aggregationOptions[idx];
                                if (panel._aggregationEnabled && panel._aggregationType === opt.value) {
                                    item.style.background = 'rgba(59, 130, 246, 0.1)';
                                    item.style.color = '#3b82f6';
                                    if (!item.innerHTML.includes('✓')) {
                                        item.innerHTML = item.innerHTML.replace('</span>', '</span> <span style="color: #3b82f6; margin-left: auto;">✓</span>');
                                    }
                                } else {
                                    item.style.background = 'transparent';
                                    item.style.color = '#1f2937';
                                    item.innerHTML = item.innerHTML.replace(/ <span style="color: #3b82f6; margin-left: auto;">✓<\/span>/, '');
                                }
                            });
                        }
                    }
                });
            }
        }, 0);
        
        // Stats Settings
        const statsOptions = ['sum', 'avg', 'max', 'min', 'p50', 'p90', 'p95', 'p99'];
        const statsSection = document.createElement('div');
        // Use effective statsConfig (which includes dashboard defaults if panel doesn't override)
        // But first, try to sync from toolbar statistics icon if it exists
        let effectiveStats = Array.isArray(statsConfig) ? statsConfig : [];
        
        // Sync from toolbar statistics icon if it exists (get current selections)
        const statisticsIconButton = header?.querySelector('[data-icon="statistics"]');
        if (statisticsIconButton) {
            const statisticsMenu = statisticsIconButton.parentElement?.querySelector('.genie-dashboard-statistics-menu');
            if (statisticsMenu) {
                const toolbarSelectedStats = Array.from(statisticsMenu.querySelectorAll(`.statistics-checkbox-${panel.id}:checked`)).map(cb => cb.value);
                if (toolbarSelectedStats.length > 0) {
                    effectiveStats = toolbarSelectedStats;
                    console.log('[Settings] Synced statistics from toolbar:', effectiveStats);
                }
            }
        }
        
        statsSection.style.cssText = 'display: grid; grid-template-columns: 120px 1fr; gap: 8px; align-items: center; margin-bottom: 10px;';
        statsSection.innerHTML = `
            <label style="font-size: 12px; font-weight: 500; color: #374151;">Statistics:</label>
            <div>
                <div style="display: flex; flex-wrap: nowrap; gap: 4px; align-items: center;">
                    ${statsOptions.map(stat => {
                        const checked = effectiveStats.includes(stat) ? 'checked' : '';
                        return `
                            <label style="display: flex; align-items: center; cursor: pointer; white-space: nowrap; margin: 0;">
                                <input type="checkbox" value="${stat}" ${checked} style="margin-right: 2px; width: 13px; height: 13px; flex-shrink: 0;" class="stats-checkbox-${panel.id}">
                                <span style="font-size: 11px; color: #374151;">${stat.toUpperCase()}</span>
                            </label>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        content.appendChild(createSection('Statistics', statsSection.outerHTML));
        
        // Percentage View Settings
        const percentSection = document.createElement('div');
        const percentBaseField = createField('Percentage Base Metric', 
            `<input type="text" id="percent-base-${panel.id}" value="${(percentBase || '').replace(/"/g, '&quot;')}" placeholder="e.g., cpu_usage" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 3px; font-size: 12px;">`,
            'Base metric for percentage calculation'
        );
        const percentTargetsField = createField('Percentage Target Metrics', 
            `<textarea id="percent-targets-${panel.id}" placeholder="Enter metrics separated by commas&#10;e.g., memory_usage, disk_usage" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 3px; font-size: 12px; min-height: 50px; resize: vertical;">${(percentTargets || []).join(', ').replace(/"/g, '&quot;')}</textarea>`,
            'Metrics to show as percentage of base (comma-separated)'
        );
        percentSection.appendChild(percentBaseField);
        percentSection.appendChild(percentTargetsField);
        content.appendChild(createSection('Percentage View', percentSection.outerHTML));
        
        // Compare Settings
        const compareSection = document.createElement('div');
        const compareTSField = createField('Timeseries Compare Options', 
            `<input type="text" id="compare-timeseries-${panel.id}" value="${(timeSeriesPrevious || '').replace(/"/g, '&quot;')}" placeholder="e.g., 1h, 1d, 1w" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 3px; font-size: 12px;">`,
            'Compare options for timeseries tab (comma-separated)'
        );
        const compareStatsField = createField('Stats Table Compare Options', 
            `<input type="text" id="compare-stats-${panel.id}" value="${(statsTablePrevious || '').replace(/"/g, '&quot;')}" placeholder="e.g., 1h, 1d, 1w" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 3px; font-size: 12px;">`,
            'Compare options for stats tab (comma-separated)'
        );
        compareSection.appendChild(compareTSField);
        compareSection.appendChild(compareStatsField);
        content.appendChild(createSection('Compare Settings', compareSection.outerHTML));
        
        // Display Options Section
        const displaySection = document.createElement('div');
        const tabsField = createField('Show Tabs', 
            `<label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="show-tabs-${panel.id}" ${panelTabs ? 'checked' : ''} style="margin-right: 6px; width: 16px; height: 16px;">
                <span style="font-size: 12px; color: #374151;">Enable tabs (Chart/Statistics)</span>
            </label>`,
            'Show or hide the tabs for switching between chart and statistics views'
        );
        const defaultTabField = createField('Default Tab', 
            `<select id="default-tab-${panel.id}" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 3px; font-size: 12px;" ${!panelTabs ? 'disabled' : ''}>
                <option value="chart" ${panelDefaultTab === 'chart' ? 'selected' : ''}>Chart</option>
                <option value="Statistics" ${panelDefaultTab === 'Statistics' || panelDefaultTab === 'statistics' || panelDefaultTab === 'stats' ? 'selected' : ''}>Statistics</option>
            </select>`,
            'Which tab to show by default when panel loads'
        );
        const transposeField = createField('Transpose Table', 
            `<label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="transpose-table-${panel.id}" ${panelTranspose ? 'checked' : ''} style="margin-right: 6px; width: 16px; height: 16px;">
                <span style="font-size: 12px; color: #374151;">Transpose statistics table</span>
            </label>`,
            'Swap rows and columns in the statistics table'
        );
        const sortField = createField('Enable Sort', 
            `<label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="enable-sort-${panel.id}" ${panelSort ? 'checked' : ''} style="margin-right: 6px; width: 16px; height: 16px;">
                <span style="font-size: 12px; color: #374151;">Enable sort icon in chart view</span>
            </label>`,
            'Show sort icon button to sort series by value (chart view only)'
        );
        const cumulativeField = createField('Enable Cumulative', 
            `<label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="enable-cumulative-${panel.id}" ${panelCumulative ? 'checked' : ''} style="margin-right: 6px; width: 16px; height: 16px;">
                <span style="font-size: 12px; color: #374151;">Enable cumulative icon in chart view</span>
            </label>`,
            'Show cumulative icon button to display cumulative values (chart view only)'
        );
        const panelDownload = panel.options?.download === true;
        const downloadField = createField('Enable Download', 
            `<label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="enable-download-${panel.id}" ${panelDownload ? 'checked' : ''} style="margin-right: 6px; width: 16px; height: 16px;">
                <span style="font-size: 12px; color: #374151;">Enable download icon in panel header</span>
            </label>`,
            'Show download icon button to download panel data'
        );
        displaySection.appendChild(tabsField);
        displaySection.appendChild(defaultTabField);
        displaySection.appendChild(transposeField);
        displaySection.appendChild(sortField);
        displaySection.appendChild(cumulativeField);
        displaySection.appendChild(downloadField);
        content.appendChild(createSection('Display Options', displaySection.outerHTML));
        
        // Add event listener to enable/disable default tab dropdown based on tabs checkbox
        setTimeout(() => {
            const tabsCheckbox = document.getElementById(`show-tabs-${panel.id}`);
            const defaultTabSelect = document.getElementById(`default-tab-${panel.id}`);
            if (tabsCheckbox && defaultTabSelect) {
                tabsCheckbox.addEventListener('change', (e) => {
                    defaultTabSelect.disabled = !e.target.checked;
                });
            }
        }, 100);
        
        // Targets Section - Collapsible rows for each target
        const targets = panel.targets || [];
        if (targets.length > 0) {
            const targetsSection = document.createElement('div');
            targetsSection.style.cssText = 'margin-bottom: 16px;';
            
            // Store original target values for comparison
            const originalTargets = targets.map(t => {
                const ds = t.datasource || '';
                const datasourceValue = typeof ds === 'string' ? ds : (ds && ds.type ? ds.type : '');
                return {
                    refId: t.refId || '',
                    datasource: datasourceValue,
                    rawSql: t.rawSql || t.expr || t.query || ''
                };
            });
            
            // Create collapsible rows for each target
            const targetRows = targets.map((target, index) => {
                const refId = target.refId || `A${index}`;
                const ds = target.datasource || '';
                const datasource = typeof ds === 'string' ? ds : (ds && ds.type ? ds.type : '');
                const rawSql = target.rawSql || target.expr || target.query || '';
                const targetId = `target-${panel.id}-${index}`;
                const expandedId = `target-expanded-${panel.id}-${index}`;
                const headerId = `target-header-${panel.id}-${index}`;
                
                // Escape HTML and quotes for safe insertion
                const datasourceEscaped = String(datasource).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const rawSqlEscaped = String(rawSql).replace(/</g, '&lt;').replace(/>/g, '&gt;');
                
                return `
                    <div id="${targetId}" style="margin-bottom: 8px; border: 1px solid #e5e7eb; border-radius: 4px; background: white;">
                        <div id="${headerId}" style="display: flex; align-items: center; padding: 8px 12px; cursor: pointer; background: #f9fafb; border-radius: 4px 4px 0 0; user-select: none;">
                            <span id="${targetId}-arrow" style="margin-right: 8px; color: #6b7280; font-size: 10px;">▶</span>
                            <strong style="font-size: 12px; color: #374151; flex: 1;">Target: ${refId}</strong>
                        </div>
                        <div id="${expandedId}" style="display: none; padding: 12px; border-top: 1px solid #e5e7eb;">
                            <div style="margin-bottom: 10px;">
                                <label style="display: block; font-size: 11px; font-weight: 500; color: #374151; margin-bottom: 4px;">Datasource Type:</label>
                                <input type="text" id="target-datasource-${panel.id}-${index}" value="${datasourceEscaped}" 
                                    placeholder="e.g., cantor, prometheus" 
                                    style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 3px; font-size: 12px; font-family: monospace;">
                                <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">Leave empty to use dashboard default</p>
                            </div>
                            <div>
                                <label style="display: block; font-size: 11px; font-weight: 500; color: #374151; margin-bottom: 6px;">Query:</label>
                                <!-- Tab buttons -->
                                <div style="display: flex; border-bottom: 1px solid #e5e7eb; margin-bottom: 8px;">
                                    <button id="target-tab-rawsql-${panel.id}-${index}" class="target-tab-btn" data-tab="rawsql" style="flex: 1; padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 3px 3px 0 0; font-size: 11px; cursor: pointer; font-weight: 500;">Raw SQL</button>
                                    <button id="target-tab-query-${panel.id}-${index}" class="target-tab-btn" data-tab="query" style="flex: 1; padding: 6px 12px; background: #f3f4f6; color: #6b7280; border: none; border-radius: 3px 3px 0 0; font-size: 11px; cursor: pointer; font-weight: 500; margin-left: 2px;">Query</button>
                                    <button id="target-tab-data-${panel.id}-${index}" class="target-tab-btn" data-tab="data" style="flex: 1; padding: 6px 12px; background: #f3f4f6; color: #6b7280; border: none; border-radius: 3px 3px 0 0; font-size: 11px; cursor: pointer; font-weight: 500; margin-left: 2px;">Data</button>
                                </div>
                                <!-- Tab content -->
                                <div id="target-content-rawsql-${panel.id}-${index}" class="target-tab-content" style="display: block;">
                                    <textarea id="target-rawsql-${panel.id}-${index}" 
                                        placeholder="Enter SQL query or expression" 
                                        style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 3px; font-size: 11px; font-family: monospace; min-height: 80px; resize: vertical; white-space: pre-wrap;">${rawSqlEscaped}</textarea>
                                    <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">SQL query, expression, or query string</p>
                                </div>
                                <div id="target-content-query-${panel.id}-${index}" class="target-tab-content" style="display: none;">
                                    <pre id="target-processed-query-${panel.id}-${index}" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 3px; font-size: 11px; font-family: monospace; min-height: 80px; max-height: 200px; overflow: auto; background: #f9fafb; white-space: pre-wrap; word-wrap: break-word; margin: 0;">Loading processed query...</pre>
                                    <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">Query with placeholders replaced</p>
                                </div>
                                <div id="target-content-data-${panel.id}-${index}" class="target-tab-content" style="display: none;">
                                    <pre id="target-data-${panel.id}-${index}" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 3px; font-size: 11px; font-family: monospace; min-height: 80px; max-height: 200px; overflow: auto; background: #f9fafb; white-space: pre-wrap; word-wrap: break-word; margin: 0;">Click "Data" tab to load raw data...</pre>
                                    <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">Raw data fetched by this target (refreshes on each click)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            targetsSection.innerHTML = `
                <h3 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.3px;">Targets</h3>
                <p style="font-size: 10px; color: #6b7280; margin-bottom: 8px; line-height: 1.3;">
                    Configure datasource and query for each target. Changes will trigger data refetch.
                </p>
                ${targetRows}
            `;
            
            content.appendChild(targetsSection);
            
            // Store original targets on panel for comparison during apply
            panel._originalTargets = originalTargets;
            
            // Setup collapsible functionality and tab switching for target rows after DOM insertion
            setTimeout(() => {
                targets.forEach((target, index) => {
                    const targetId = `target-${panel.id}-${index}`;
                    const expandedId = `target-expanded-${panel.id}-${index}`;
                    const headerId = `target-header-${panel.id}-${index}`;
                    const arrowId = `${targetId}-arrow`;
                    
                    const header = document.getElementById(headerId);
                    const expanded = document.getElementById(expandedId);
                    const arrow = document.getElementById(arrowId);
                    
                    if (header && expanded && arrow) {
                        header.addEventListener('click', () => {
                            if (expanded.style.display === 'none' || !expanded.style.display) {
                                expanded.style.display = 'block';
                                arrow.innerHTML = '▼';
                            } else {
                                expanded.style.display = 'none';
                                arrow.innerHTML = '▶';
                            }
                        });
                    }
                    
                    // Setup tab switching
                    const tabButtons = [
                        { id: `target-tab-rawsql-${panel.id}-${index}`, contentId: `target-content-rawsql-${panel.id}-${index}`, tab: 'rawsql' },
                        { id: `target-tab-query-${panel.id}-${index}`, contentId: `target-content-query-${panel.id}-${index}`, tab: 'query' },
                        { id: `target-tab-data-${panel.id}-${index}`, contentId: `target-content-data-${panel.id}-${index}`, tab: 'data' }
                    ];
                    
                    tabButtons.forEach(({ id, contentId, tab }) => {
                        const btn = document.getElementById(id);
                        const content = document.getElementById(contentId);
                        
                        if (btn && content) {
                            btn.addEventListener('click', async () => {
                                // Switch tabs
                                tabButtons.forEach(({ id: otherId, contentId: otherContentId }) => {
                                    const otherBtn = document.getElementById(otherId);
                                    const otherContent = document.getElementById(otherContentId);
                                    if (otherBtn && otherContent) {
                                        if (otherId === id) {
                                            otherBtn.style.background = '#3b82f6';
                                            otherBtn.style.color = 'white';
                                            otherContent.style.display = 'block';
                                        } else {
                                            otherBtn.style.background = '#f3f4f6';
                                            otherBtn.style.color = '#6b7280';
                                            otherContent.style.display = 'none';
                                        }
                                    }
                                });
                                
                                // Load content based on tab
                                if (tab === 'query') {
                                    // Load processed query - always refresh to show current state
                                    const processedQueryEl = document.getElementById(`target-processed-query-${panel.id}-${index}`);
                                    if (processedQueryEl) {
                                        processedQueryEl.textContent = 'Loading processed query...';
                                        try {
                                            // Get current value from textarea (in case user edited it)
                                            const rawSqlInput = document.getElementById(`target-rawsql-${panel.id}-${index}`);
                                            const rawSql = rawSqlInput ? rawSqlInput.value : (target.rawSql || target.expr || target.query || '');
                                            const processedQuery = this.processQuery(rawSql, 0);
                                            processedQueryEl.textContent = processedQuery || '(empty query)';
                                        } catch (error) {
                                            processedQueryEl.textContent = `Error processing query: ${error.message}`;
                                        }
                                    }
                                } else if (tab === 'data') {
                                    // Load data - always refresh
                                    const dataEl = document.getElementById(`target-data-${panel.id}-${index}`);
                                    if (dataEl) {
                                        dataEl.textContent = 'Loading data...';
                                        try {
                                            // Get current values from form (in case user edited them)
                                            const rawSqlInput = document.getElementById(`target-rawsql-${panel.id}-${index}`);
                                            const datasourceInput = document.getElementById(`target-datasource-${panel.id}-${index}`);
                                            
                                            const query = rawSqlInput ? rawSqlInput.value : (target.rawSql || target.expr || target.query || '');
                                            const processedQuery = this.processQuery(query, 0);
                                            
                                            // Use current datasource from input or fallback to target/dashboard default
                                            let currentTarget = { ...target };
                                            if (datasourceInput && datasourceInput.value.trim()) {
                                                const ds = target.datasource;
                                                if (ds && typeof ds === 'object') {
                                                    currentTarget.datasource = { ...ds, type: datasourceInput.value.trim() };
                                                } else {
                                                    currentTarget.datasource = datasourceInput.value.trim();
                                                }
                                            }
                                            
                                            const endpoint = this.getEndpointForTarget(currentTarget);
                                            
                                            if (!endpoint) {
                                                dataEl.textContent = 'Error: No endpoint found for target';
                                                return;
                                            }
                                            
                                            const datasource = currentTarget.datasource || this.dashboardConfig.datasource;
                                            const dsType = typeof datasource === 'string' ? datasource : (datasource ? datasource.type : null);
                                            
                                            const startTimestamp = this.inputConfig?.$start || null;
                                            const endTimestamp = this.inputConfig?.$end || null;
                                            const refId = target.refId || `A${index}`;
                                            
                                            const response = await this.fetchData(endpoint, processedQuery, startTimestamp, endTimestamp, refId, null, dsType);
                                            
                                            // Format the response as JSON
                                            dataEl.textContent = JSON.stringify(response, null, 2);
                                        } catch (error) {
                                            dataEl.textContent = `Error loading data: ${error.message}`;
                                            console.error('Error loading target data:', error);
                                        }
                                    }
                                }
                            });
                        }
                    });
                });
            }, 100);
        }
        
        // Dashboard Defaults Section - Side by side layout
        const defaultsSection = document.createElement('div');
        const defaultsRows = [];
        
        // Stats: Default vs Panel Override (side by side)
        if (dashboardDefaultStats && dashboardDefaultStats.length > 0) {
            const hasPanelOverride = panelStatsConfig && panelStatsConfig.length > 0;
            defaultsRows.push(`
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <div style="padding: 8px; background: #f9fafb; border-left: 2px solid #3b82f6; border-radius: 3px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                            <strong style="font-size: 11px; color: #374151;">Default Stats:</strong>
                            ${isStatsFromDefault ? '<span style="font-size: 9px; color: #3b82f6; background: #dbeafe; padding: 1px 4px; border-radius: 2px;">USED</span>' : '<span style="font-size: 9px; color: #6b7280;">available</span>'}
                        </div>
                        <div style="font-size: 11px; color: #6b7280;">${dashboardDefaultStats.join(', ')}</div>
                    </div>
                    ${hasPanelOverride ? `
                        <div style="padding: 8px; background: #f0fdf4; border-left: 2px solid #10b981; border-radius: 3px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                                <strong style="font-size: 11px; color: #374151;">Panel Stats (Override):</strong>
                                <span style="font-size: 9px; color: #10b981; background: #d1fae5; padding: 1px 4px; border-radius: 2px;">OVERRIDE</span>
                            </div>
                            <div style="font-size: 11px; color: #6b7280;">${panelStatsConfig.join(', ')}</div>
                        </div>
                    ` : `
                        <div style="padding: 8px; background: #f9fafb; border-left: 2px solid #e5e7eb; border-radius: 3px; border-style: dashed;">
                            <div style="font-size: 11px; color: #9ca3af; font-style: italic;">No panel override</div>
                        </div>
                    `}
                </div>
            `);
        }
        
        // Compare Options: Default vs Panel Override (side by side)
        if (dashboardDefaultPrevious) {
            const hasPanelOverride = panelTimeSeriesPrevious || panelStatsTablePrevious;
            const panelCompare = panelTimeSeriesPrevious || panelStatsTablePrevious;
            defaultsRows.push(`
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <div style="padding: 8px; background: #f9fafb; border-left: 2px solid #3b82f6; border-radius: 3px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                            <strong style="font-size: 11px; color: #374151;">Default Compare:</strong>
                            ${isPreviousFromDefault ? '<span style="font-size: 9px; color: #3b82f6; background: #dbeafe; padding: 1px 4px; border-radius: 2px;">USED</span>' : '<span style="font-size: 9px; color: #6b7280;">available</span>'}
                        </div>
                        <div style="font-size: 11px; color: #6b7280;">${dashboardDefaultPrevious}</div>
                    </div>
                    ${hasPanelOverride ? `
                        <div style="padding: 8px; background: #f0fdf4; border-left: 2px solid #10b981; border-radius: 3px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                                <strong style="font-size: 11px; color: #374151;">Panel Compare (Override):</strong>
                                <span style="font-size: 9px; color: #10b981; background: #d1fae5; padding: 1px 4px; border-radius: 2px;">OVERRIDE</span>
                            </div>
                            <div style="font-size: 11px; color: #6b7280;">${panelCompare}</div>
                        </div>
                    ` : `
                        <div style="padding: 8px; background: #f9fafb; border-left: 2px solid #e5e7eb; border-radius: 3px; border-style: dashed;">
                            <div style="font-size: 11px; color: #9ca3af; font-style: italic;">No panel override</div>
                        </div>
                    `}
                </div>
            `);
        }
        
        if (defaultsRows.length > 0) {
            defaultsSection.innerHTML = `
                <div style="margin-bottom: 10px;">
                    <p style="font-size: 10px; color: #6b7280; margin-bottom: 8px; line-height: 1.3;">
                        Dashboard-level defaults are used when panel-specific values are not set. Panel-specific values override defaults.
                    </p>
                    ${defaultsRows.join('')}
                </div>
            `;
            content.appendChild(createSection('Dashboard Defaults', defaultsSection.outerHTML));
        }
        
        // Other Options Section - Additional features and capabilities
        const otherOptionsSection = document.createElement('div');
        const otherOptionsContent = [];
        
        // Features list
        const features = [
            {
                title: 'Series Aggregation',
                description: 'Group and aggregate series by tags (cell, scope, role, etc.) using Sum, Avg, Min, Max, P50, or P90',
                config: 'aggregation.tag and aggregation.type'
            },
            {
                title: 'Span Aggregation',
                description: 'Aggregate data points within time windows (e.g., 5m, 1h) using Sum, Avg, Max, or Min',
                config: 'aggregation.span and aggregation.spanAggregation'
            },
            {
                title: 'Percentage View',
                description: 'Display series values as percentage of a base metric in the statistics table',
                config: 'statsTable.percentBase and statsTable.percentTargets'
            },
            {
                title: 'Compare with Previous Period',
                description: 'Compare current data with historical periods (1h, 1d, 1w, etc.) in both charts and stats',
                config: 'timeSeries.previous or statsTable.previous'
            },
            {
                title: 'Display Name Overrides',
                description: 'Customize series display names and colors using regex patterns in fieldConfig.overrides',
                config: 'fieldConfig.overrides[].matcher and fieldConfig.overrides[].properties'
            },
            {
                title: 'Toolbar Controls',
                description: 'Use dashboard toolbar to set default Span and Aggregation values for all panels',
                config: 'Toolbar: Span and Aggregation dropdowns'
            },
            {
                title: 'Time Range Selection',
                description: 'Select custom time ranges using the clock icon in the dashboard toolbar',
                config: 'Toolbar: Time range selector'
            },
            {
                title: 'Panel Types',
                description: 'Support for timeseries, stat, table, gauge, bargauge, and graph panel types',
                config: 'panel.type'
            }
        ];
        
        otherOptionsContent.push(`
            <div style="margin-bottom: 10px;">
                <p style="font-size: 10px; color: #6b7280; margin-bottom: 8px; line-height: 1.3;">
                    Additional features and options available in the dashboard and panels:
                </p>
                <div style="display: grid; gap: 8px;">
                    ${features.map(feature => `
                        <div style="padding: 8px; background: #f9fafb; border-left: 2px solid #3b82f6; border-radius: 3px;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 2px;">
                                <strong style="font-size: 11px; color: #374151;">${feature.title}:</strong>
                            </div>
                            <div style="font-size: 10px; color: #6b7280; margin-bottom: 4px; line-height: 1.4;">
                                ${feature.description}
                            </div>
                            <div style="font-size: 9px; color: #9ca3af; font-family: monospace; background: #f3f4f6; padding: 4px 6px; border-radius: 2px; margin-top: 4px;">
                                ${feature.config}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `);
        
        if (otherOptionsContent.length > 0) {
            otherOptionsSection.innerHTML = otherOptionsContent.join('');
            content.appendChild(createSection('Other Options', otherOptionsSection.outerHTML));
        }
        
        // Apply Button
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'padding: 12px 16px; border-top: 1px solid #e5e7eb; background: #f9fafb; position: sticky; bottom: 0; display: flex; gap: 8px;';
        buttonContainer.innerHTML = `
            <button id="apply-settings-${panel.id}" style="flex: 1; padding: 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer;">Apply Changes</button>
            <button id="cancel-settings-${panel.id}" style="flex: 1; padding: 8px; background: white; color: #374151; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer;">Cancel</button>
        `;
        
        // Assemble panel
        settingsPanel.appendChild(panelHeader);
        settingsPanel.appendChild(content);
        settingsPanel.appendChild(buttonContainer);
        
        // Append to document first so elements are accessible
        document.body.appendChild(overlay);
        document.body.appendChild(settingsPanel);
        
        // Set the selected value for aggregation tag dropdown after DOM insertion
        // Use requestAnimationFrame to ensure DOM is fully ready
        requestAnimationFrame(() => {
            if (configuredTag) {
                const tagSelect = document.getElementById(`${this.instanceId}-agg-tag-${panel.id}`);
                if (tagSelect) {
                    // Find the option that matches the configured tag
                    let foundIndex = -1;
                    for (let i = 0; i < tagSelect.options.length; i++) {
                        const optionValue = tagSelect.options[i].value.trim();
                        if (optionValue === configuredTag) {
                            foundIndex = i;
                            break;
                        }
                    }
                    
                    if (foundIndex >= 0) {
                        tagSelect.selectedIndex = foundIndex;
                        console.log(`[Settings] Successfully set aggregation tag dropdown to: ${configuredTag} (index: ${foundIndex})`);
                    } else {
                        console.warn(`[Settings] Warning: Tag '${configuredTag}' not found in dropdown options. Available:`, Array.from(tagSelect.options).map(opt => ({ value: opt.value, text: opt.text })));
                        // Try case-insensitive match
                        for (let i = 0; i < tagSelect.options.length; i++) {
                            if (tagSelect.options[i].value.toLowerCase() === configuredTag.toLowerCase()) {
                                tagSelect.selectedIndex = i;
                                console.log(`[Settings] Found case-insensitive match, selected index: ${i}`);
                                break;
                            }
                        }
                    }
                } else {
                    console.error(`[Settings] Could not find dropdown element: ${this.instanceId}-agg-tag-${panel.id}`);
                }
            } else {
                console.log('[Settings] No configured tag to select');
            }
        });
        
        // Close handlers - access elements after they're in DOM
        let isClosing = false; // Prevent multiple close calls
        const closePanel = (event) => {
            if (isClosing) return; // Prevent double-closing
            isClosing = true;
            
            // Prevent event bubbling if called from button click
            if (event) {
                event.stopPropagation();
            }
            
            // Clear any existing animation and set initial state
            settingsPanel.style.animation = 'none';
            settingsPanel.style.willChange = 'transform';
            // Force immediate transform to current position to prevent any revert
            requestAnimationFrame(() => {
                settingsPanel.style.transform = 'translateX(0)';
                
                // Use animationend event to ensure we catch the exact moment animation completes
                const handleAnimationEnd = () => {
                    settingsPanel.removeEventListener('animationend', handleAnimationEnd);
                    
                    // Immediately lock the transform at final position
                    settingsPanel.style.transform = 'translateX(100%)';
                    settingsPanel.style.animation = 'none';
                    settingsPanel.style.opacity = '0';
                    settingsPanel.style.visibility = 'hidden';
                    settingsPanel.style.pointerEvents = 'none';
                    
                    // Small delay then remove
                    setTimeout(() => {
                        settingsPanel.style.display = 'none';
                        requestAnimationFrame(() => {
                            settingsPanel.remove();
                            overlay.remove();
                            // Remove document click listener
                            document.removeEventListener('click', outsideClickHandler);
                        });
                    }, 16);
                };
                
                settingsPanel.addEventListener('animationend', handleAnimationEnd);
                
                // Add class that uses animation-fill-mode: forwards to maintain final state
                settingsPanel.classList.add('settings-panel-sliding-out');
            });
        };
        
        // Handle clicks outside the panel
        const outsideClickHandler = (event) => {
            // Check if click is outside the settings panel
            if (!settingsPanel.contains(event.target) && !isClosing) {
                closePanel(event);
            }
        };
        
        // Add document click listener after a brief delay to avoid immediate triggering
        setTimeout(() => {
            document.addEventListener('click', outsideClickHandler);
        }, 100);
        
        const closeButton = document.getElementById(`close-settings-${panel.id}`);
        const cancelButton = document.getElementById(`cancel-settings-${panel.id}`);
        const applyButton = document.getElementById(`apply-settings-${panel.id}`);
        
        if (closeButton) {
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                closePanel(e);
            });
        }
        if (cancelButton) {
            cancelButton.addEventListener('click', (e) => {
                e.stopPropagation();
                closePanel(e);
            });
        }
        
        // Apply handler
        if (applyButton) {
            applyButton.addEventListener('click', async () => {
            // Update aggregation config
            const aggTagSelect = document.getElementById(`${this.instanceId}-agg-tag-${panel.id}`);
            const aggTag = aggTagSelect ? aggTagSelect.value.trim() : '';
            const aggType = document.getElementById(`${this.instanceId}-agg-type-${panel.id}`).value;
            const aggSpan = document.getElementById(`${this.instanceId}-agg-span-${panel.id}`).value.trim();
            const aggSpanType = document.getElementById(`${this.instanceId}-agg-span-type-${panel.id}`).value;
            
            // Sync span type to toolbar aggregation dropdown
            const toolbarAggSelect = document.getElementById(this.getInstanceId('toolbar-agg'));
            if (toolbarAggSelect) {
                if (aggSpanType) {
                    toolbarAggSelect.value = aggSpanType;
                    // Update inputConfig to reflect the change
                    if (this.inputConfig) {
                        this.inputConfig['$agg'] = aggSpanType;
                    }
                } else {
                    // If cleared, set to empty string (will show first option which should be default)
                    toolbarAggSelect.value = '';
                    if (this.inputConfig) {
                        this.inputConfig['$agg'] = '';
                    }
                }
            }
            
            if (aggTag) {
                panel.aggregation = {
                    tag: aggTag,
                    type: aggType,
                    ...(aggSpan && { span: aggSpan }),
                    ...(aggSpanType && { spanAggregation: aggSpanType })
                };
                // Clear from other possible locations to avoid conflicts
                if (panel.options) {
                    delete panel.options.aggregation;
                }
                if (panel.timeSeries) {
                    delete panel.timeSeries.aggregation;
                }
                if (panel.options?.timeSeries) {
                    delete panel.options.timeSeries.aggregation;
                }
                
                // Sync aggregation type to aggregation icon button dropdown
                if (aggType) {
                    panel._aggregationEnabled = true;
                    panel._aggregationType = aggType;
                } else {
                    panel._aggregationEnabled = false;
                    panel._aggregationType = null;
                }
            } else {
                // Clear aggregation from all possible locations
                panel.aggregation = null;
                if (panel.options) {
                    delete panel.options.aggregation;
                }
                if (panel.timeSeries) {
                    delete panel.timeSeries.aggregation;
                }
                if (panel.options?.timeSeries) {
                    delete panel.options.timeSeries.aggregation;
                }
                
                // Clear aggregation icon button state
                panel._aggregationEnabled = false;
                panel._aggregationType = null;
            }
            
            // Update aggregation icon button display if it exists
            const aggregationIconButton = header?.querySelector('[data-icon="aggregation"]');
            if (aggregationIconButton) {
                // Find the aggregation menu and update its display
                const aggregationMenu = aggregationIconButton.parentElement?.querySelector('.genie-dashboard-aggregation-menu');
                if (aggregationMenu) {
                    const aggregationOptions = [
                        { value: 'sum', label: 'Sum', icon: '∑' },
                        { value: 'avg', label: 'Average', icon: 'x̄' },
                        { value: 'min', label: 'Min', icon: 'min' },
                        { value: 'max', label: 'Max', icon: 'max' },
                        { value: 'p50', label: 'P50', icon: 'P50' },
                        { value: 'p90', label: 'P90', icon: 'P90' }
                    ];
                    
                    const getAggregationDisplay = (type) => {
                        const displays = {
                            'sum': '∑',
                            'avg': 'x̄',
                            'min': 'min',
                            'max': 'max',
                            'p50': 'P50',
                            'p90': 'P90'
                        };
                        return displays[type] || '⚙️';
                    };
                    
                    // Update button display
                    if (panel._aggregationEnabled && panel._aggregationType) {
                        aggregationIconButton.innerHTML = `<span class="genie-dashboard-tab-icon">${getAggregationDisplay(panel._aggregationType)}</span>`;
                        aggregationIconButton.title = `${panel._aggregationType.charAt(0).toUpperCase() + panel._aggregationType.slice(1)} aggregation`;
                        aggregationIconButton.style.background = 'rgba(59, 130, 246, 0.1)';
                        aggregationIconButton.style.color = '#3b82f6';
                        aggregationIconButton.style.fontWeight = '500';
                    } else {
                        aggregationIconButton.innerHTML = '<span class="genie-dashboard-tab-icon">∑</span>';
                        aggregationIconButton.title = 'Aggregation options';
                        aggregationIconButton.style.background = 'transparent';
                        aggregationIconButton.style.color = '#6b7280';
                        aggregationIconButton.style.fontWeight = '500';
                    }
                    
                    // Update menu items highlighting
                    aggregationMenu.querySelectorAll('.genie-dashboard-aggregation-menu-item').forEach((item, idx) => {
                        const opt = aggregationOptions[idx];
                        if (panel._aggregationEnabled && panel._aggregationType === opt.value) {
                            item.style.background = 'rgba(59, 130, 246, 0.1)';
                            item.style.color = '#3b82f6';
                            if (!item.innerHTML.includes('✓')) {
                                item.innerHTML = item.innerHTML.replace('</span>', '</span> <span style="color: #3b82f6; margin-left: auto;">✓</span>');
                            }
                        } else {
                            item.style.background = 'transparent';
                            item.style.color = '#1f2937';
                            item.innerHTML = item.innerHTML.replace(/ <span style="color: #3b82f6; margin-left: auto;">✓<\/span>/, '');
                        }
                    });
                }
            }
            
            // Update stats config
            const selectedStats = Array.from(document.querySelectorAll(`.stats-checkbox-${panel.id}:checked`)).map(cb => cb.value);
            panel.stats = selectedStats.length > 0 ? selectedStats : undefined;
            console.log('[Settings Apply] Selected stats from settings:', selectedStats);
            
            // Sync statistics to toolbar statistics icon button if it exists
            const statisticsIconButton = header?.querySelector('[data-icon="statistics"]');
            if (statisticsIconButton) {
                const statisticsMenu = statisticsIconButton.parentElement?.querySelector('.genie-dashboard-statistics-menu');
                if (statisticsMenu) {
                    // Update checkboxes in the toolbar menu
                    statisticsMenu.querySelectorAll(`.statistics-checkbox-${panel.id}`).forEach(checkbox => {
                        checkbox.checked = selectedStats.includes(checkbox.value);
                    });
                    console.log('[Settings Apply] Synced statistics to toolbar:', selectedStats);
                    
                    // Update button display
                    const statsCount = selectedStats.length;
                    if (statsCount > 0) {
                        statisticsIconButton.innerHTML = `<span class="genie-dashboard-tab-icon">∑</span>`;
                        statisticsIconButton.title = `Statistics (${statsCount} selected)`;
                        statisticsIconButton.style.background = 'rgba(59, 130, 246, 0.1)';
                        statisticsIconButton.style.color = '#3b82f6';
                        statisticsIconButton.style.fontWeight = '500';
                    } else {
                        statisticsIconButton.innerHTML = '<span class="genie-dashboard-tab-icon">∑</span>';
                        statisticsIconButton.title = 'Statistics options';
                        statisticsIconButton.style.background = 'transparent';
                        statisticsIconButton.style.color = '#6b7280';
                        statisticsIconButton.style.fontWeight = '500';
                    }
                } else {
                    console.warn('[Settings Apply] Statistics menu not found in toolbar');
                }
            } else {
                console.warn('[Settings Apply] Statistics icon button not found in toolbar');
            }
            
            // Update percentage config
            const pBase = document.getElementById(`percent-base-${panel.id}`).value.trim();
            const pTargets = document.getElementById(`percent-targets-${panel.id}`).value.split(',').map(s => s.trim()).filter(s => s);
            
            if (pBase && pTargets.length > 0) {
                panel.statsTable = panel.statsTable || {};
                panel.statsTable.percentBase = pBase;
                panel.statsTable.percentTargets = pTargets;
            } else {
                if (panel.statsTable) {
                    panel.statsTable.percentBase = undefined;
                    panel.statsTable.percentTargets = undefined;
                }
            }
            
            // Update compare config
            const compareTS = document.getElementById(`compare-timeseries-${panel.id}`).value.trim();
            const compareStats = document.getElementById(`compare-stats-${panel.id}`).value.trim();
            
            if (compareTS) {
                panel.timeSeries = panel.timeSeries || {};
                panel.timeSeries.previous = compareTS;
            }
            
            if (compareStats) {
                panel.statsTable = panel.statsTable || {};
                panel.statsTable.previous = compareStats;
            }
            
            // Update display options
            const showTabsCheckbox = document.getElementById(`show-tabs-${panel.id}`);
            const defaultTabSelect = document.getElementById(`default-tab-${panel.id}`);
            const transposeCheckbox = document.getElementById(`transpose-table-${panel.id}`);
            
            if (showTabsCheckbox) {
                panel.tabs = showTabsCheckbox.checked;
            }
            
            if (defaultTabSelect && showTabsCheckbox && showTabsCheckbox.checked) {
                panel.tab = defaultTabSelect.value;
            } else if (showTabsCheckbox && !showTabsCheckbox.checked) {
                // If tabs are disabled, remove tab config
                delete panel.tab;
            }
            
            if (transposeCheckbox) {
                panel.statsTable = panel.statsTable || {};
                panel.statsTable.transpose = transposeCheckbox.checked;
            }
            
            // Update timeSeries options
            const sortCheckbox = document.getElementById(`enable-sort-${panel.id}`);
            const cumulativeCheckbox = document.getElementById(`enable-cumulative-${panel.id}`);
            
            if (sortCheckbox) {
                panel.options = panel.options || {};
                panel.options.timeSeries = panel.options.timeSeries || {};
                panel.options.timeSeries.sort = sortCheckbox.checked;
            }
            
            if (cumulativeCheckbox) {
                panel.options = panel.options || {};
                panel.options.timeSeries = panel.options.timeSeries || {};
                panel.options.timeSeries.cumulative = cumulativeCheckbox.checked;
            }
            
            // Update download option
            const downloadCheckbox = document.getElementById(`enable-download-${panel.id}`);
            if (downloadCheckbox) {
                panel.options = panel.options || {};
                panel.options.download = downloadCheckbox.checked;
            }
            
            // Handle target changes - update targets and clear data for modified ones
            if (panel.targets && panel.targets.length > 0 && panel._originalTargets) {
                const modifiedTargetRefIds = [];
                
                panel.targets.forEach((target, index) => {
                    const refId = target.refId || `A${index}`;
                    const originalTarget = panel._originalTargets[index];
                    
                    if (!originalTarget) return;
                    
                    // Get new values from form
                    const datasourceInput = document.getElementById(`target-datasource-${panel.id}-${index}`);
                    const rawSqlInput = document.getElementById(`target-rawsql-${panel.id}-${index}`);
                    
                    if (datasourceInput && rawSqlInput) {
                        const newDatasource = datasourceInput.value.trim();
                        const newRawSql = rawSqlInput.value.trim();
                        
                        // Get original datasource value (handle both string and object)
                        const originalDs = originalTarget.datasource || '';
                        const originalDatasourceValue = typeof originalDs === 'string' ? originalDs : (originalDs && originalDs.type ? originalDs.type : '');
                        
                        // Check if datasource or rawSql changed
                        const datasourceChanged = newDatasource !== originalDatasourceValue;
                        const rawSqlChanged = newRawSql !== (originalTarget.rawSql || '');
                        
                        if (datasourceChanged || rawSqlChanged) {
                            // Update target with new values
                            if (newDatasource) {
                                // If original was an object, preserve the object structure, otherwise use string
                                const currentDs = target.datasource;
                                if (currentDs && typeof currentDs === 'object') {
                                    target.datasource = { ...currentDs, type: newDatasource };
                                } else {
                                    target.datasource = newDatasource;
                                }
                            } else {
                                // Only delete if it was a string, otherwise set type to empty
                                const currentDs = target.datasource;
                                if (currentDs && typeof currentDs === 'object') {
                                    delete target.datasource.type;
                                } else {
                                    delete target.datasource;
                                }
                            }
                            
                            // Update rawSql (could be rawSql, expr, or query)
                            if (newRawSql) {
                                target.rawSql = newRawSql;
                                // Clear other query fields to avoid conflicts
                                delete target.expr;
                                delete target.query;
                            } else {
                                delete target.rawSql;
                                delete target.expr;
                                delete target.query;
                            }
                            
                            modifiedTargetRefIds.push(refId);
                            console.log(`[Settings] Target ${refId} modified - datasource: ${datasourceChanged}, rawSql: ${rawSqlChanged}`);
                        }
                    }
                });
                
                // Clear data cache for modified targets to force refetch
                if (modifiedTargetRefIds.length > 0) {
                    console.log(`[Settings] Clearing data cache for modified targets: ${modifiedTargetRefIds.join(', ')}`);
                    
                    // Clear any cached data for these targets
                    if (panel._dataCache) {
                        modifiedTargetRefIds.forEach(refId => {
                            delete panel._dataCache[refId];
                        });
                    }
                    
                    // Clear fetch promises to force new fetch
                    if (panel._fetchPromises) {
                        modifiedTargetRefIds.forEach(refId => {
                            delete panel._fetchPromises[refId];
                        });
                    }
                }
                
                // Clean up temporary storage
                delete panel._originalTargets;
            }
            
            // Re-render the panel
            const panelElement = container.closest('.genie-dashboard-panel');
            if (panelElement) {
                const panelIndex = this.panels.findIndex(p => p.id === panel.id);
                if (panelIndex >= 0) {
                    // Remove the old panel completely before re-rendering to prevent overlapping
                    const gridContainer = container.closest('.genie-dashboard-grid');
                    if (gridContainer && panelElement.parentNode === gridContainer) {
                        // Clear all content from old panel to prevent overlap
                        const oldContent = panelElement.querySelector('.genie-dashboard-panel-content');
                        if (oldContent) {
                            // Remove all table wrappers and content
                            const oldTableWrappers = oldContent.querySelectorAll('.genie-dashboard-stats-table-wrapper');
                            oldTableWrappers.forEach(wrapper => {
                                wrapper.style.display = 'none';
                                wrapper.remove();
                            });
                            oldContent.innerHTML = '';
                        }
                        // Remove the old panel
                        panelElement.remove();
                    }
                    // Now render the new panel
                    await this.renderPanel(panel, panelIndex, gridContainer);
                }
            }
            
            closePanel();
            });
        }
    }
    
    /**
     * Download panel data as CSV
     * @param {Object} panel - Panel object
     * @param {string} dataType - 'source', 'spanned', or 'view'
     */
    downloadPanelData(panel, dataType) {
        if (!panel._downloadData) {
            console.warn('[Download] No download data available for panel', panel.id);
            alert('No data available for download. Please wait for the chart to load.');
            return;
        }
        
        let dataToDownload = null;
        let filename = `panel-${panel.id}-${dataType}`;
        
        try {
            const previousDuration = panel._downloadData.previousDuration || null;
            
            if (dataType === 'source') {
                dataToDownload = panel._downloadData.source;
                const previousData = panel._downloadData.sourcePrevious || null;
                if (!dataToDownload || !Array.isArray(dataToDownload) || dataToDownload.length === 0) {
                    alert('Source data is not available for download.');
                    return;
                }
                filename = this.convertSourceDataToCSV(dataToDownload, filename, previousData, previousDuration);
            } else if (dataType === 'spanned') {
                dataToDownload = panel._downloadData.spanned;
                const previousData = panel._downloadData.spannedPrevious || null;
                if (!dataToDownload || !Array.isArray(dataToDownload) || dataToDownload.length === 0) {
                    alert('Spanned data is not available for download. Span aggregation may not be configured.');
                    return;
                }
                filename = this.convertSourceDataToCSV(dataToDownload, filename, previousData, previousDuration);
            } else if (dataType === 'view') {
                dataToDownload = panel._downloadData.view;
                if (!dataToDownload || !dataToDownload.datasets || dataToDownload.datasets.length === 0) {
                    alert('View data is not available for download.');
                    return;
                }
                // View data already includes previous data in the chartData, so no need to pass separately
                filename = this.convertViewDataToCSV(dataToDownload, filename);
            } else {
                console.error('[Download] Unknown data type:', dataType);
                return;
            }
        } catch (error) {
            console.error('[Download] Error preparing data for download:', error);
            alert('Error preparing data for download: ' + error.message);
            return;
        }
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
        const rows = [];
        const headers = ['timestamp', 'series', 'value'];
        rows.push(headers.join(','));
        
        // Collect all data points from all series
        const allDataPoints = [];
        
        // Process current data
        const processDataArray = (targetDataArray, isPrevious = false) => {
            targetDataArray.forEach(targetData => {
                const response = targetData.data;
                const target = targetData.target;
                
                // Handle different response formats
                let seriesArray = [];
                if (Array.isArray(response)) {
                    seriesArray = response;
                } else if (response && response.datapoints) {
                    seriesArray = [response];
                } else if (response && response.times && response.values) {
                    seriesArray = [response];
                }
                
                seriesArray.forEach(series => {
                    // Get series name
                    let seriesName = series.displayName || 
                                   series.target || 
                                   series.id || 
                                   (series.scope && series.metric ? `${series.scope}:${series.metric}` : null) ||
                                   target?.expr || 
                                   target?.query || 
                                   targetData.refId || 
                                   'unknown';
                    
                    // Append duration suffix if this is previous period data
                    if (isPrevious && previousDuration) {
                        const suffix = previousDuration.startsWith('-') ? previousDuration : '-' + previousDuration;
                        seriesName = `${seriesName}(${suffix})`;
                    }
                    
                    // Extract data points using the existing function
                    const dataPoints = this.extractDataPoints(series);
                    
                    // Calculate time offset for previous period (shift forward to overlap)
                    const timeOffset = (isPrevious && previousDuration) ? 
                                      this.parseDuration(previousDuration) : 0;
                    
                    // Add to collection with series name
                    dataPoints.forEach(dp => {
                        if (dp && dp.time && dp.value !== null && dp.value !== undefined) {
                            let timestamp = dp.time instanceof Date ? dp.time.getTime() : dp.time;
                            // Shift timestamps forward for previous period to overlap with current
                            if (timeOffset > 0) {
                                timestamp = timestamp + timeOffset;
                            }
                            allDataPoints.push({
                                timestamp: timestamp,
                                series: seriesName,
                                value: dp.value
                            });
                        }
                    });
                });
            });
        };
        
        // Process current data
        processDataArray(dataArray, false);
        
        // Process previous data if available
        if (previousDataArray && previousDataArray.length > 0) {
            processDataArray(previousDataArray, true);
        }
        
        // Sort by timestamp, then by series name
        allDataPoints.sort((a, b) => {
            if (a.timestamp !== b.timestamp) {
                return a.timestamp - b.timestamp;
            }
            return a.series.localeCompare(b.series);
        });
        
        // Create CSV rows
        allDataPoints.forEach(point => {
            const dateStr = new Date(point.timestamp).toISOString();
            rows.push(`${dateStr},"${point.series}",${point.value}`);
        });
        
        const csvContent = rows.join('\n');
        this.downloadFile(csvContent, `${baseFilename}.csv`, 'text/csv');
        return `${baseFilename}.csv`;
    }
    
    /**
     * Convert view data (Chart.js format) to CSV
     * @param {Object} chartData - Chart.js data object with datasets
     * @param {string} baseFilename - Base filename without extension
     * @returns {string} - Filename used for download
     */
    convertViewDataToCSV(chartData, baseFilename) {
        if (!chartData || !chartData.datasets || chartData.datasets.length === 0) {
            throw new Error('Invalid chart data');
        }
        
        const rows = [];
        const datasets = chartData.datasets;
        
        // Collect all unique timestamps
        const allTimestamps = new Set();
        datasets.forEach(dataset => {
            if (dataset.data && Array.isArray(dataset.data)) {
                dataset.data.forEach(point => {
                    if (point && point.x) {
                        allTimestamps.add(point.x);
                    }
                });
            }
        });
        
        // Sort timestamps
        const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => {
            if (a instanceof Date && b instanceof Date) {
                return a - b;
            }
            return a - b;
        });
        
        // Create header row
        const headers = ['timestamp', ...datasets.map(d => `"${d.label || 'series'}"`)];
        rows.push(headers.join(','));
        
        // Create data rows
        sortedTimestamps.forEach(timestamp => {
            const dateStr = timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString();
            const values = [dateStr];
            
            datasets.forEach(dataset => {
                const point = dataset.data.find(p => {
                    const pTime = p.x instanceof Date ? p.x.getTime() : p.x;
                    const tTime = timestamp instanceof Date ? timestamp.getTime() : timestamp;
                    return pTime === tTime;
                });
                const value = point && point.y !== null && point.y !== undefined ? point.y : '';
                values.push(value);
            });
            
            rows.push(values.join(','));
        });
        
        const csvContent = rows.join('\n');
        this.downloadFile(csvContent, `${baseFilename}.csv`, 'text/csv');
        return `${baseFilename}.csv`;
    }
    
    /**
     * Trigger file download
     * @param {string} content - File content
     * @param {string} filename - Filename
     * @param {string} mimeType - MIME type
     */
    downloadFile(content, filename, mimeType) {
        try {
            // Try modern approach with Blob and URL.createObjectURL
            if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
                const blob = new Blob([content], { type: mimeType });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                // Revoke URL after a short delay to ensure download starts
                setTimeout(() => {
                    if (URL.revokeObjectURL) {
                        URL.revokeObjectURL(url);
                    }
                }, 100);
                return;
            }
        } catch (error) {
            console.warn('[Download] Blob/URL.createObjectURL approach failed, trying fallback:', error);
        }
        
        // Fallback: Use data URL approach (works in older browsers and restricted environments)
        try {
            // Encode content for data URL
            const encodedContent = encodeURIComponent(content);
            const dataUrl = `data:${mimeType};charset=utf-8,${encodedContent}`;
            
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('[Download] Data URL approach also failed:', error);
            // Last resort: Try window.open with data URL
            try {
                const encodedContent = encodeURIComponent(content);
                const dataUrl = `data:${mimeType};charset=utf-8,${encodedContent}`;
                const newWindow = window.open(dataUrl, '_blank');
                if (newWindow) {
                    // Try to trigger download by setting window location after a delay
                    setTimeout(() => {
                        newWindow.close();
                    }, 1000);
                }
            } catch (fallbackError) {
                console.error('[Download] All download methods failed:', fallbackError);
                alert('Unable to download file. Please copy the data manually or try a different browser.');
                throw new Error('Download failed: ' + fallbackError.message);
            }
        }
    }
    } // End of class GenieDashboard

    // Export for use (similar to SFDataTable pattern)
    // Assign to window for global access, allowing multiple instances
    if (typeof window !== 'undefined') {
        window.GenieDashboard = GenieDashboard;
    }
    // Support CommonJS/Node.js if needed
    var moduleCheck = typeof module !== 'undefined' && module.exports;
    if (moduleCheck) {
        module.exports = GenieDashboard;
    }
})(); // End of IIFE - prevents duplicate declaration errors

