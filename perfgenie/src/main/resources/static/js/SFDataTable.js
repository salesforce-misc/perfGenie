/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

let SFDCSortIndex = 0; //hack, to use in sort function this.#sfdtsci will not work in sort function
class SFDataTable {
    #instanceName = undefined; //needed to keep in javascript:func
    #SFDataTableName = "Sankar";
    #SFDataTablePage = 0;
    #SFDataTablePageSize = 10;
    #sfdtsci = 0;
    #SFDataTableHeader = "";
    #SFDataTableRows = "";
    #SFDataTableSearchStr = undefined;
    #SFDataTableSearchMatchedRows = [];
    #SFDataTableID = undefined;
    #sortIcon = "down";
    #sfDataTableID = "SFDataTable";
    #sfPaginationID = "pagination";
    #sfSearchID = "SFSearch";
    #sfDownloadID = "SFDownload";
    #sfShowToolBar = true;
    #SFDataTablePercentMetric = undefined;
    #SFDataTableEnablePercent = false;
    #SFDataTableMetricsToShowPercent = undefined;
    #enableCollapse = undefined;
    #isCollapsed = false;
    constructor(instanceVariableName) {
        if(instanceVariableName != undefined){
            this.#sfDataTableID = instanceVariableName+"SFDataTable";
            this.#sfPaginationID = instanceVariableName+"pagination";
            this.#sfSearchID = instanceVariableName+"SFSearch";
            this.#sfDownloadID = instanceVariableName+"SFDownload";
            this.#instanceName = instanceVariableName;
        }else{

        }
        // Inject styles on first instantiation
        this.injectStyles();
    }

    /**
     * Inject CSS styles for SFDataTable component
     */
    injectStyles() {
        if (document.getElementById('sf-data-table-styles')) {
            return; // Styles already injected
        }

        const style = document.createElement('style');
        style.id = 'sf-data-table-styles';
        style.textContent = `
            /* SFDataTable Professional Styling */
            .sf-data-table-container {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                padding-left: 0;
            }

            /* Collapse Bar Styling */
            .sf-data-table-collapse-bar {
                height: 7px;
                background: #f8f9fa;
                border-bottom: 1px solid #e5e5e5;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background-color 0.2s ease;
                position: relative;
            }

            .sf-data-table-collapse-bar:hover {
                background: #e9ecef;
            }

            .sf-data-table-collapse-bar i {
                font-size: 10px;
                color: #6c757d;
                transition: color 0.2s ease, transform 0.2s ease;
            }

            .sf-data-table-collapse-bar:hover i {
                color: #46a5e3;
            }

            /* Toolbar Styling */
            .sf-data-table-toolbar {
                background: #f8f9fa;
                padding: 4px 16px 4px 2px;
                border-bottom: 1px solid #e5e5e5;
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
            }

            .sf-data-table-toolbar .sf-toolbar-icon {
                color: #46a5e3;
                font-size: 18px;
                cursor: pointer;
                transition: color 0.2s ease, transform 0.2s ease;
                text-decoration: none;
                padding: 0;
                border-radius: 4px;
                height: 25px;
                width: 25px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }

            .sf-data-table-toolbar .sf-toolbar-icon:hover {
                color: #3773b3;
                background: #e9ecef;
            }

            .sf-data-table-toolbar .sf-toolbar-icon .fa-percent {
                font-weight: 100;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                text-rendering: optimizeLegibility;
                opacity: 0.85;
                transform: scale(0.95);
            }

            .sf-data-table-toolbar .sf-search-label {
                font-size: 14px;
                color: #495057;
                font-weight: 500;
                margin-right: 2px;
            }

            .sf-data-table-toolbar .sf-search-input {
                padding: 0 8px;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                font-size: 14px;
                transition: all 0.2s ease;
                min-width: 200px;
                height: 25px;
                box-sizing: border-box;
            }

            .sf-data-table-toolbar .sf-search-input:focus {
                outline: none;
                border-color: #46a5e3;
                box-shadow: 0 0 0 3px rgba(70, 165, 227, 0.1);
            }

            .sf-data-table-toolbar .sf-pagination-button {
                padding: 0 6px;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                background: #ffffff;
                color: #495057;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                margin: 0 -4px 0 0;
                min-width: 28px;
                height: 25px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            
            .sf-data-table-toolbar .sf-pagination-button:last-of-type {
                margin-right: 0;
            }

            .sf-data-table-toolbar .sf-pagination-button:hover:not(:disabled) {
                background: #46a5e3;
                color: #ffffff;
                border-color: #46a5e3;
                box-shadow: 0 2px 4px rgba(70, 165, 227, 0.2);
            }

            .sf-data-table-toolbar .sf-pagination-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .sf-data-table-toolbar .sf-pagination-button.active {
                background: #46a5e3;
                color: #ffffff;
                border-color: #46a5e3;
                font-weight: 600;
            }

            .sf-data-table-toolbar .sf-pagination-button.active:hover {
                background: #3d94d0;
                border-color: #3d94d0;
            }

            /* Table Scroll Wrapper */
            .sf-data-table-scroll-wrapper {
                width: 100%;
                overflow-x: auto;
                overflow-y: visible;
                -webkit-overflow-scrolling: touch;
                position: relative;
            }

            .sf-data-table-scroll-wrapper::-webkit-scrollbar {
                height: 8px;
            }

            .sf-data-table-scroll-wrapper::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 4px;
            }

            .sf-data-table-scroll-wrapper::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 4px;
            }

            .sf-data-table-scroll-wrapper::-webkit-scrollbar-thumb:hover {
                background: #555;
            }

            /* Table Styling */
            .sf-data-table {
                width: auto;
                border-collapse: collapse;
                background: #ffffff;
                font-size: 13px;
                table-layout: auto;
            }

            .sf-data-table thead {
                background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
                border-bottom: 1px solid #dee2e6;
            }

            .sf-data-table th {
                padding: 4px 4px;
                text-align: left;
                font-weight: 600;
                font-size: 14px;
                color: #1a1d21;
                white-space: nowrap;
                position: relative;
                border-right: 1px solid #e5e5e5;
                transition: background-color 0.2s ease;
                letter-spacing: 0.01em;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }

            .sf-data-table th:last-child {
                border-right: none;
            }

            .sf-data-table th:hover {
                background: #e9ecef;
            }

            .sf-data-table th .fa {
                margin-left: 4px;
                font-size: 12px;
            }

            .sf-data-table th .fa.fa-caret-down {
                color: #adb5bd;
            }

            .sf-data-table th .fa.fa-caret-up {
                color: #46a5e3 !important;
            }

            .sf-data-table th.sorted .fa.fa-caret-down {
                color: #46a5e3 !important;
            }

            .sf-data-table th.sorted .fa.fa-caret-up {
                color: #46a5e3 !important;
            }

            .sf-data-table tbody tr {
                border-bottom: 1px solid #f1f3f5;
                transition: background-color 0.15s ease;
            }

            .sf-data-table tbody tr:hover {
                background: #f8f9fa;
            }

            .sf-data-table tbody tr.alternate-row {
                background: #f8f9fa;
            }

            .sf-data-table tbody tr.alternate-row:hover {
                background: #e9ecef;
            }

            .sf-data-table td {
                padding: 4px 4px;
                color: #343a40;
                font-weight: 500;
                border-right: 1px solid #f1f3f5;
                vertical-align: middle;
                letter-spacing: 0.01em;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }

            .sf-data-table td:last-child {
                border-right: none;
            }

            /* Responsive adjustments */
            @media (max-width: 768px) {
                .sf-data-table-toolbar {
                    padding: 4px 12px 4px 2px;
                    gap: 6px;
                }

                .sf-data-table-toolbar .sf-search-input {
                    min-width: 150px;
                    height: 25px;
                    padding: 0 6px;
                }

                .sf-data-table-toolbar .sf-pagination-button {
                    padding: 0 6px;
                    font-size: 12px;
                    min-width: 28px;
                    height: 25px;
                }

                .sf-data-table th {
                    padding: 4px 4px;
                    font-size: 13px;
                }

                .sf-data-table td {
                    padding: 4px 4px;
                    font-size: 12px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    SFDataTableSetPageSize(size){
        this.#SFDataTablePageSize = size;
    }

    SFDataTableClear(){
        if($('#'+this.#SFDataTableID)){
            $('#'+this.#SFDataTableID).html('');
        }
    }

    //First time data table loading, entry point
    SFDataTable(rows, header, id, sortColIndex, showToolBar) {
        if (rows !== undefined) {
            //reset
            this.#SFDataTableSearchMatchedRows = [];
            this.#SFDataTableRows = rows;
            this.#SFDataTableHeader = header;
            this.#SFDataTableID = id;
            this.#SFDataTablePage = 0;
            if (sortColIndex != undefined) {
                this.#sfdtsci = sortColIndex;
            }
            if (showToolBar != undefined) {
                this.#sfShowToolBar = showToolBar;
            }
            this.#SFDataTableSearchStr = undefined;
            
            // Validate percent metric column if it was set before header was available
            if (this.#SFDataTablePercentMetric !== undefined) {
                const columnExists = this.#validatePercentMetricColumn();
                if (!columnExists) {
                    console.warn(`SFDataTable: Column "${this.#SFDataTablePercentMetric}" not found or is not a metric (t=1). Percentage feature disabled.`);
                    this.#SFDataTablePercentMetric = undefined;
                    this.#SFDataTableEnablePercent = false;
                }
            }
            
            // Validate percent enable state
            if (this.#SFDataTableEnablePercent && !this.#validatePercentMetricColumn()) {
                console.warn(`SFDataTable: Cannot enable percentage display - column "${this.#SFDataTablePercentMetric}" not found.`);
                this.#SFDataTableEnablePercent = false;
            }
            
            //sort data
            if(rows.length != 0 && header.length != 0) {
                this.SFDataTableSort(1);
            }
        }

        // Ensure we have header and rows data (allow empty arrays)
        if (!this.#SFDataTableHeader || !Array.isArray(this.#SFDataTableHeader) || this.#SFDataTableHeader.length === 0) {
            console.error('SFDataTable: Header data not available or invalid');
            return;
        }
        if (!Array.isArray(this.#SFDataTableRows)) {
            console.error('SFDataTable: Rows data not available or invalid. Rows:', this.#SFDataTableRows);
            return;
        }
        
        // Use SFDataTableID (from id parameter) or fall back to sfDataTableID (from constructor)
        const tableId = this.#SFDataTableID || this.#sfDataTableID;
        
        let container = document.getElementById(tableId);
        if (!container) {
            // Create container element if it doesn't exist
            container = document.createElement('div');
            container.id = tableId;
            document.body.appendChild(container);
        }
        
        try {
            let html = '<div class="sf-data-table-container">';
            // Add collapse bar if enabled
            if (this.#enableCollapse !== undefined) {
                html += this.SFDataTableGetCollapseBar();
            }
            const toolbarHtml = this.SFDataTableGetToolBar();
            // Add toolbar with collapse state if collapse is enabled
            if (this.#enableCollapse !== undefined && this.#isCollapsed) {
                html += toolbarHtml.replace('<div class=\'sf-data-table-toolbar\'>', 
                        '<div class=\'sf-data-table-toolbar\' style="display: none;">');
            } else {
                html += toolbarHtml;
            }
            html += '<div class="sf-data-table-scroll-wrapper" id="' + tableId + '-scroll-wrapper"' + 
                    (this.#enableCollapse !== undefined && this.#isCollapsed ? ' style="display: none;"' : '') + '>';
            html += "<table id='"+tableId+"-table' class='sf-data-table'>\n";
            html += this.SFDataTableGetHeader();
            html += "<tbody>";
            html += this.SFDataTableGetRows();
            html += "</tbody>";
            html += "</table>";
            html += '</div>';
            html += "</div>";
            container.innerHTML = html;
            
            // Setup collapse bar click handler if enabled
            if (this.#enableCollapse !== undefined) {
                const collapseBar = document.getElementById(tableId + '-collapse-bar');
                if (collapseBar) {
                    collapseBar.addEventListener('click', () => {
                        this.toggleCollapse();
                    });
                }
            }
        } catch (error) {
            console.error('SFDataTable: Error rendering table:', error);
            throw error;
        }
    }

    SFDataTableSearch() {
        this.#SFDataTableSearchMatchedRows = []; //reset search matched rows
        if (this.#SFDataTableSearchStr !== undefined) {
            for (let i = this.#SFDataTablePageSize * this.#SFDataTablePage; i < this.#SFDataTableRows.length; i++) {
                for (let j = 0; j < this.#SFDataTableRows[i].length; j++) {
                    if (isNaN(this.#SFDataTableRows[i][j].v)) {
                        try {
                            if (this.#SFDataTableRows[i][j].v.includes(this.#SFDataTableSearchStr)) {
                                this.#SFDataTableSearchMatchedRows.push(i);
                                break;
                            }
                        } catch (e) {
                            //console.log("ignore");
                        }
                    } else {
                        if (this.#SFDataTableRows[i][j].v != null && this.#SFDataTableRows[i][j].v.toString().includes(this.#SFDataTableSearchStr)) {
                            this.#SFDataTableSearchMatchedRows.push(i);
                            break;
                        }
                    }
                }
            }
        }
    }

    SFhandlePaginationClick(pageno) {
        this.#SFDataTablePage = pageno - 1;
        this.SFDataTable();
    }

    SFhandlePrevious(x) {
        this.#SFDataTablePage--;
        this.SFDataTable();
    }

    SFhandleNext(x) {
        this.#SFDataTablePage++;
        this.SFDataTable();
    }

    SFDataTableSetSortIndex(x) {
        let sortorder = 1;
        if (this.#sfdtsci == x.cellIndex) {
            if (x.getElementsByTagName("i")[0].className.includes("down")) {
                this.#sortIcon = "up";
            } else {
                this.#sortIcon = "down";
            }
            sortorder = -1;//reverse
        } else {
            this.#sortIcon = "down";
            this.#sfdtsci = x.cellIndex;
        }

        this.#SFDataTablePage = 0; //reset to first page on sort
        this.#SFDataTableSearchMatchedRows = []; //invalidate any matched search rows

        this.SFDataTableSort(sortorder);

        this.SFDataTableSearch();

        this.SFDataTable();
    }


    SFDataTableSort(sortorder) {
        if (this.#SFDataTableHeader[this.#sfdtsci].t == undefined) {
            this.SFDataTableAutoFillColType(this.#SFDataTableRows);
        }

        SFDCSortIndex = this.#sfdtsci;

        if (sortorder === 1) {
            if (this.#SFDataTableHeader[this.#sfdtsci].t > 0) {
                this.#SFDataTableRows.sort(this.SFDataTableSortCompareDescNumber);
            } else {
                this.#SFDataTableRows.sort(this.SFDataTableSortCompareDescString);
            }
        } else {
            this.#SFDataTableRows.reverse();
        }
    }

    SFDataTableGetRows() {
        let rows = "";
        let rowsAdded = 0;
        
        // Find base metric column index if percentage calculation is enabled and column exists
        let baseMetricIndex = -1;
        let baseMetricValue = null;
        if (this.#SFDataTableEnablePercent && this.#validatePercentMetricColumn()) {
            for (let h = 0; h < this.#SFDataTableHeader.length; h++) {
                if (this.#SFDataTableHeader[h].v === this.#SFDataTablePercentMetric && 
                    this.#SFDataTableHeader[h].t === 1) { // t=1 means metric
                    baseMetricIndex = h;
                    break;
                }
            }
        }
        
        if (this.#SFDataTableSearchStr != undefined) {
            for (let i = this.#SFDataTablePageSize * this.#SFDataTablePage; i < this.#SFDataTableSearchMatchedRows.length && rowsAdded < this.#SFDataTablePageSize; i++) {
                if (rowsAdded < this.#SFDataTablePageSize) {
                    const rowClass = rowsAdded % 2 === 1 ? " class='alternate-row'" : "";
                    rows += "<tr" + rowClass + ">"
                    
                    // Get base metric value for this row if percentage calculation is enabled
                    if (baseMetricIndex >= 0) {
                        const baseValue = this.#SFDataTableRows[this.#SFDataTableSearchMatchedRows[i]][baseMetricIndex].v;
                        baseMetricValue = this.parseNumericValue(baseValue);
                    }
                    
                    for (let j = 0; j < this.#SFDataTableRows[this.#SFDataTableSearchMatchedRows[i]].length; j++) {
                        let cellValue = this.#SFDataTableRows[this.#SFDataTableSearchMatchedRows[i]][j].v;
                        
                        // Add percentage if this column should show percentage
                        if (this.#shouldShowPercentForColumn(j) && baseMetricIndex >= 0 && baseMetricValue !== null && 
                            !isNaN(baseMetricValue) && baseMetricValue !== 0) {
                            if (j === baseMetricIndex) {
                                // Base metric shows 100.0%
                                cellValue = cellValue + "(100.0%)";
                            } else {
                                // Other metrics show percentage relative to base
                                const currentValue = this.parseNumericValue(this.#SFDataTableRows[this.#SFDataTableSearchMatchedRows[i]][j].v);
                                if (currentValue !== null && !isNaN(currentValue)) {
                                    const percentage = (currentValue / baseMetricValue) * 100;
                                    cellValue = cellValue + "(" + percentage.toFixed(1) + "%)";
                                }
                            }
                        }
                        
                        rows += "<td " + (this.#SFDataTableHeader[j].p == undefined ? "" : this.#SFDataTableHeader[j].p) + " " + (this.#SFDataTableRows[this.#SFDataTableSearchMatchedRows[i]][j].p == undefined ? "" : this.#SFDataTableRows[this.#SFDataTableSearchMatchedRows[i]][j].p) + " >" + cellValue + "</td>";
                    }
                    rows += "</tr>\n"
                    rowsAdded++;
                }
            }
        } else {
            for (let i = this.#SFDataTablePageSize * this.#SFDataTablePage; i < this.#SFDataTableRows.length && rowsAdded < this.#SFDataTablePageSize; i++) {
                if (rowsAdded < this.#SFDataTablePageSize) {
                    const rowClass = rowsAdded % 2 === 1 ? " class='alternate-row'" : "";
                    rows += "<tr" + rowClass + ">"
                    
                    // Get base metric value for this row if percentage calculation is enabled
                    if (baseMetricIndex >= 0) {
                        const baseValue = this.#SFDataTableRows[i][baseMetricIndex].v;
                        baseMetricValue = this.parseNumericValue(baseValue);
                    }
                    
                    for (let j = 0; j < this.#SFDataTableRows[i].length; j++) {
                        let cellValue = this.#SFDataTableRows[i][j].v;
                        
                        // Add percentage if this column should show percentage
                        if (this.#shouldShowPercentForColumn(j) && baseMetricIndex >= 0 && baseMetricValue !== null && 
                            !isNaN(baseMetricValue) && baseMetricValue !== 0) {
                            if (j === baseMetricIndex) {
                                // Base metric shows 100.0%
                                cellValue = cellValue + "(100.0%)";
                            } else {
                                // Other metrics show percentage relative to base
                                const currentValue = this.parseNumericValue(this.#SFDataTableRows[i][j].v);
                                if (currentValue !== null && !isNaN(currentValue)) {
                                    const percentage = (currentValue / baseMetricValue) * 100;
                                    cellValue = cellValue + "(" + percentage.toFixed(1) + "%)";
                                }
                            }
                        }

                        rows += "<td " + ((this.#SFDataTableHeader[j] == undefined || this.#SFDataTableHeader[j].p == undefined)? "" : this.#SFDataTableHeader[j].p) + " " + (this.#SFDataTableRows[i][j].p == undefined ? "" : this.#SFDataTableRows[i][j].p) + " >" + cellValue + "</td>";
                    }
                    rows += "</tr>\n"
                    rowsAdded++;
                }
            }
        }
        return rows;
    }

    /**
     * Parse numeric value from cell content (handles HTML, strings, numbers)
     * @param {*} value - Cell value to parse
     * @returns {number|null} - Parsed numeric value or null
     */
    parseNumericValue(value) {
        if (value === null || value === undefined) {
            return null;
        }
        
        // If it's already a number
        if (typeof value === 'number') {
            return isNaN(value) ? null : value;
        }
        
        // If it's a string, try to extract number
        if (typeof value === 'string') {
            // Remove HTML tags if present
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = value;
            const textContent = tempDiv.textContent || tempDiv.innerText || value;
            
            // Extract numeric value (handles formats like "123.45", "1,234.56", etc.)
            const numericStr = textContent.replace(/[^\d.-]/g, '');
            const parsed = parseFloat(numericStr);
            return isNaN(parsed) ? null : parsed;
        }
        
        return null;
    }

    /**
     * Toggle percentage display on/off
     */
    togglePercentDisplay() {
        // Only toggle if column exists
        if (this.#validatePercentMetricColumn()) {
            this.#SFDataTableEnablePercent = !this.#SFDataTableEnablePercent;
            this.SFDataTable();
        } else {
            console.warn(`SFDataTable: Cannot toggle percentage display - column "${this.#SFDataTablePercentMetric}" not found.`);
        }
    }

    SFDataTableGetToolBar() {
        if(!this.#sfShowToolBar){
            return "";
        }
        let toolbar = "<div class='sf-data-table-toolbar'>";
        toolbar += "<a title='Download as csv' id='" + this.#sfDownloadID + "table' href='javascript:" + this.#instanceName + ".downloadTableAsCSV()' class='sf-toolbar-icon'><i class=\"fa fa-download\" aria-hidden=\"true\"></i></a>";

        toolbar += "<span class='sf-search-label'>Search:</span> <input type='text' id='" + this.#sfSearchID + "' class='sf-search-input' name='SFSearch' value='" + (this.#SFDataTableSearchStr == undefined ? "" : this.#SFDataTableSearchStr) + "' onkeypress='if(event.keyCode == 13) javascript:" + this.#instanceName + ".SFSearch()'>";

        toolbar += "<a title='Search' id='" + this.#sfSearchID + "table' href='javascript:" + this.#instanceName + ".SFSearch()' class='sf-toolbar-icon'><i class=\"fa fa-search\" aria-hidden=\"true\"></i></a>";

        // Add percent icon only if base metric column exists
        if (this.#validatePercentMetricColumn()) {
            const percentIconClass = 'fa-percent';
            const percentIconStyle = this.#SFDataTableEnablePercent 
                ? 'color: #46a5e3; background: rgba(70, 165, 227, 0.15); border: 1px solid rgba(70, 165, 227, 0.3);' 
                : '';
            toolbar += "<a title='Toggle percentage display' id='" + this.#sfPaginationID + "percent' href='javascript:" + this.#instanceName + ".togglePercentDisplay()' class='sf-toolbar-icon' style='" + percentIconStyle + "'><i class=\"fa " + percentIconClass + "\" aria-hidden=\"true\"></i></a>";
        }


        if (this.#SFDataTablePage == 0) {
            toolbar += "<button disabled id='" + this.#sfPaginationID + "' class='sf-pagination-button' type='submit' onClick='javascript:" + this.#instanceName + ".SFhandlePrevious()'>Previous</button>";
        } else {
            toolbar += "<button id='" + this.#sfPaginationID + "' class='sf-pagination-button' type='submit' onClick='javascript:" + this.#instanceName + ".SFhandlePrevious()'>Previous</button>";
        }

        let total = 0;
        if (this.#SFDataTableSearchStr != undefined) {
            while (this.#SFDataTablePageSize * total < this.#SFDataTableSearchMatchedRows.length) {
                total++;
            }
        } else {
            while (this.#SFDataTablePageSize * total < this.#SFDataTableRows.length) {
                total++;
            }
        }

        if (total > 7) {
            if (0 == this.#SFDataTablePage) {
                toolbar += "<button class='sf-pagination-button active' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + 1 + ")'>" + 1 + "</button>";
            } else {
                toolbar += "<button class='sf-pagination-button' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + 1 + ")'>" + 1 + "</button>";
            }

            if (total - (this.#SFDataTablePage + 1) < 4) {//is it in the last 5
                toolbar += "<button disabled class='sf-pagination-button' style='cursor: default;'>...</button>";
                for (let i = total - 5; i < total - 1; i++) {
                    if (i == this.#SFDataTablePage) {
                        toolbar += "<button class='sf-pagination-button active' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + (i + 1) + ")'>" + (i + 1) + "</button>";
                    } else {
                        toolbar += "<button class='sf-pagination-button' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + (i + 1) + ")'>" + (i + 1) + "</button>";
                    }
                }
            } else if ((this.#SFDataTablePage + 1) - 1 < 4) {//is it in the first 5
                for (let i = 1; i < 5; i++) {
                    if (i == this.#SFDataTablePage) {
                        toolbar += "<button class='sf-pagination-button active' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + (i + 1) + ")'>" + (i + 1) + "</button>";
                    } else {
                        toolbar += "<button class='sf-pagination-button' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + (i + 1) + ")'>" + (i + 1) + "</button>";
                    }
                }
                toolbar += "<button disabled class='sf-pagination-button' style='cursor: default;'>...</button>";
            } else {//in the middle
                toolbar += "<button disabled class='sf-pagination-button' style='cursor: default;'>...</button>";
                for (let i = this.#SFDataTablePage - 1; i < this.#SFDataTablePage + 2; i++) {
                    if (i == this.#SFDataTablePage) {
                        toolbar += "<button class='sf-pagination-button active' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + (i + 1) + ")'>" + (i + 1) + "</button>";
                    } else {
                        toolbar += "<button class='sf-pagination-button' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + (i + 1) + ")'>" + (i + 1) + "</button>";
                    }
                }
                toolbar += "<button disabled class='sf-pagination-button' style='cursor: default;'>...</button>";
            }
            if (total == this.#SFDataTablePage + 1) {
                toolbar += "<button class='sf-pagination-button active' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + total + ")'>" + total + "</button>";
            } else {
                toolbar += "<button class='sf-pagination-button' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + total + ")'>" + total + "</button>";
            }
        } else {
            //all
            for (let i = 0; i < total; i++) {
                if (i == this.#SFDataTablePage) {
                    toolbar += "<button class='sf-pagination-button active' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + (i + 1) + ")'>" + (i + 1) + "</button>";
                } else {
                    toolbar += "<button class='sf-pagination-button' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + (i + 1) + ")'>" + (i + 1) + "</button>";
                }
            }
        }


        if (this.#SFDataTableSearchStr != undefined) {
            if (this.#SFDataTablePageSize * this.#SFDataTablePage + this.#SFDataTablePageSize < this.#SFDataTableSearchMatchedRows.length) {
                toolbar += "<button id='" + this.#sfPaginationID + "' class='sf-pagination-button' type='submit' onClick='javascript:" + this.#instanceName + ".SFhandleNext()'>Next</button>";
            } else {
                toolbar += "<button disabled=true id='" + this.#sfPaginationID + "' class='' style='border-color: #f9f9f9;' type='submit' onClick='javascript:" + this.#instanceName + ".SFhandleNext()'>Next</button>";
            }
        } else {
            if (this.#SFDataTablePageSize * this.#SFDataTablePage + this.#SFDataTablePageSize < this.#SFDataTableRows.length) {
                toolbar += "<button id='" + this.#sfPaginationID + "' class='sf-pagination-button' type='submit' onClick='javascript:" + this.#instanceName + ".SFhandleNext()'>Next</button>";
            } else {
                toolbar += "<button disabled id='" + this.#sfPaginationID + "' class='sf-pagination-button' type='submit' onClick='javascript:" + this.#instanceName + ".SFhandleNext()'>Next</button>";
            }
        }
        return toolbar + "</div>";
    }

    SFDataTableGetHeader() {
        let header = "<thead><tr>";
        for (let i = 0; i < this.#SFDataTableHeader.length; i++) {
            const sortedClass = (i == this.#sfdtsci) ? " class='sorted'" : "";
            if(this.#SFDataTableHeader[i].h != undefined) {
                if (i == this.#sfdtsci) {
                    header += "<th" + sortedClass + " title='"+this.#SFDataTableHeader[i].h+"' onclick='javascript:" + this.#instanceName + ".SFDataTableSetSortIndex(this)'>" + this.#SFDataTableHeader[i].v + " <i class='fa fa-caret-" + this.#sortIcon + "'></i></th>";
                } else {
                    header += "<th title='"+this.#SFDataTableHeader[i].h+"' onclick='javascript:" + this.#instanceName + ".SFDataTableSetSortIndex(this)'>" + this.#SFDataTableHeader[i].v + " <i class='fa fa-caret-down'></i></th>";
                }
            }else{
                if (i == this.#sfdtsci) {
                    header += "<th" + sortedClass + " onclick='javascript:" + this.#instanceName + ".SFDataTableSetSortIndex(this)'>" + this.#SFDataTableHeader[i].v + " <i class='fa fa-caret-" + this.#sortIcon + "'></i></th>";
                } else {
                    header += "<th onclick='javascript:" + this.#instanceName + ".SFDataTableSetSortIndex(this)'>" + this.#SFDataTableHeader[i].v + " <i class='fa fa-caret-down'></i></th>";
                }
            }
        }
        header += "</tr></thead>\n";
        return header;
    }

    SFDataTableAutoFillColType(rows) {
        return;

        //check first 5 rows and find what is the type
        for (let i = 0; i < rows.length && i < 5; i++) {
            for (let j = 0; j < rows[i].length; j++) {
                if (isNaN(rows[i][j].v)) {
                    if (this.#SFDataTableHeader[j].t == undefined) {
                        this.#SFDataTableHeader[j].t = -1;
                    } else {
                        this.#SFDataTableHeader[j].t += -1;
                    }
                } else {
                    if (this.#SFDataTableHeader[j].t == undefined) {
                        this.#SFDataTableHeader[j].t = 1;
                    } else {
                        this.#SFDataTableHeader[j].t += 1;
                    }
                }
            }
        }
    }

    SFDataTableSortCompareDescString(a, b) {
        let tmp1 = a[SFDCSortIndex].v == null ? "null" : a[SFDCSortIndex].v.toLowerCase();
        let tmp2 = b[SFDCSortIndex].v == null ? "null" : b[SFDCSortIndex].v.toLowerCase();

        if (tmp1 > tmp2) {
            return -1;
        }
        if (tmp1 < tmp2) {
            return 1;
        }
        return 0;
    }

    SFDataTableSortCompareDescNumber(a, b) {
        let tmp1 = isNaN(a[SFDCSortIndex].s ?? a[SFDCSortIndex].v) ? -1 : a[SFDCSortIndex].s ?? a[SFDCSortIndex].v;
        let tmp2 = isNaN(b[SFDCSortIndex].s ?? b[SFDCSortIndex].v) ? -1 : b[SFDCSortIndex].s ?? b[SFDCSortIndex].v;

        if (tmp1 > tmp2) {
            return -1;
        }
        if (tmp1 < tmp2) {
            return 1;
        }
        return 0;
    }

    SFSearch() {
        this.#SFDataTablePage = 0;
        this.#SFDataTableSearchMatchedRows = [];
        if ($('#'+this.#sfSearchID).val() === '') {
            this.#SFDataTableSearchStr = undefined;
        } else {
            this.#SFDataTableSearchStr = $('#'+this.#sfSearchID).val();
        }
        this.SFDataTableSearch();
        this.SFDataTable();
    }

    addContextTableHeader(row, val, t, p, h){
        if(p != undefined)
        {
            row.push({"v": val, "t": t, "p": p, "h":h});
        }else{
            row.push({"v": val, "t": t, "h":h});
        }
    }

    addContextTableRow(row, val, p){
        if(p != undefined)
        {
            row.push({"v": val, "p": p});
        }else{
            row.push({"v": val});
        }
    }

    addContextTableOrderRow(row, val, o, p){
        if(p != undefined)
        {
            row.push({"v": val, "s": o, "p": p});
        }else{
            row.push({"v": val, "s": o});
        }
    }

    /**
     * Set the base metric column name for percentage calculation
     * @param {string} metricColumnName - Name of the metric column to use as base (100%)
     */
    setSFDataTablePercentMetric(metricColumnName) {
        // Check if the column exists in the header
        if (this.#SFDataTableHeader && Array.isArray(this.#SFDataTableHeader)) {
            const columnExists = this.#SFDataTableHeader.some(header => 
                header.v === metricColumnName && header.t === 1
            );
            if (columnExists) {
                this.#SFDataTablePercentMetric = metricColumnName;
            } else {
                console.warn(`SFDataTable: Column "${metricColumnName}" not found or is not a metric (t=1). Percentage feature not enabled.`);
                this.#SFDataTablePercentMetric = undefined;
                this.#SFDataTableEnablePercent = false;
            }
        } else {
            // Header not yet set, store the metric name for later validation
            this.#SFDataTablePercentMetric = metricColumnName;
        }
    }

    /**
     * Enable or disable percentage calculation display
     * @param {boolean} enable - true to show percentages, false to hide
     */
    setSFDataTableEnablePercent(enable) {
        // Only enable if base metric is set and column exists
        if (enable && this.#SFDataTablePercentMetric !== undefined) {
            if (this.#SFDataTableHeader && Array.isArray(this.#SFDataTableHeader)) {
                const columnExists = this.#SFDataTableHeader.some(header => 
                    header.v === this.#SFDataTablePercentMetric && header.t === 1
                );
                if (columnExists) {
                    this.#SFDataTableEnablePercent = true;
                } else {
                    console.warn(`SFDataTable: Column "${this.#SFDataTablePercentMetric}" not found or is not a metric (t=1). Cannot enable percentage display.`);
                    this.#SFDataTableEnablePercent = false;
                }
            } else {
                // Header not yet set, store the enable state for later validation
                this.#SFDataTableEnablePercent = enable;
            }
        } else {
            this.#SFDataTableEnablePercent = enable;
        }
    }

    /**
     * Set array of metric column names to show percentages for
     * @param {Array<string>} metricNames - Array of metric column names to show percentages
     */
    setMetricsToShowPercent(metricNames) {
        if (Array.isArray(metricNames)) {
            this.#SFDataTableMetricsToShowPercent = metricNames;
        } else {
            console.warn('SFDataTable: setMetricsToShowPercent expects an array of metric names');
            this.#SFDataTableMetricsToShowPercent = undefined;
        }
    }

    /**
     * Check if the percent metric column exists in the current header
     * @returns {boolean} - true if column exists and is a metric
     */
    #validatePercentMetricColumn() {
        if (this.#SFDataTablePercentMetric === undefined) {
            return false;
        }
        if (!this.#SFDataTableHeader || !Array.isArray(this.#SFDataTableHeader)) {
            return false;
        }
        return this.#SFDataTableHeader.some(header => 
            header.v === this.#SFDataTablePercentMetric && header.t === 1
        );
    }

    /**
     * Get collapse bar HTML
     * @returns {string} - HTML for collapse bar
     */
    SFDataTableGetCollapseBar() {
        const tableId = this.#SFDataTableID || this.#sfDataTableID;
        const collapseIcon = this.#isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up';
        return '<div id="' + tableId + '-collapse-bar" class="sf-data-table-collapse-bar" title="' + 
               (this.#isCollapsed ? 'Expand' : 'Collapse') + '"><i class="fa ' + collapseIcon + '" aria-hidden="true"></i></div>';
    }

    /**
     * Toggle collapse state
     */
    toggleCollapse() {
        this.#isCollapsed = !this.#isCollapsed;
        const tableId = this.#SFDataTableID || this.#sfDataTableID;
        const scrollWrapper = document.getElementById(tableId + '-scroll-wrapper');
        const collapseBar = document.getElementById(tableId + '-collapse-bar');
        const toolbar = document.querySelector('#' + tableId + ' .sf-data-table-toolbar');
        
        if (scrollWrapper) {
            scrollWrapper.style.display = this.#isCollapsed ? 'none' : '';
        }
        if (toolbar) {
            toolbar.style.display = this.#isCollapsed ? 'none' : 'flex';
        }
        if (collapseBar) {
            const icon = collapseBar.querySelector('i');
            if (icon) {
                icon.className = 'fa ' + (this.#isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up') + ' aria-hidden="true"';
            }
            collapseBar.title = this.#isCollapsed ? 'Expand' : 'Collapse';
        }
    }

    /**
     * Set enable collapse feature
     * @param {boolean|undefined} enable - true to enable expanded, false to enable collapsed, undefined to disable collapse feature
     */
    setEnableCollapse(enable) {
        this.#enableCollapse = enable;
        if (enable === false) {
            this.#isCollapsed = true; // Start collapsed
        } else if (enable === true) {
            this.#isCollapsed = false; // Start expanded
        }
        // Re-render table to apply changes
        if (this.#SFDataTableHeader && this.#SFDataTableRows) {
            this.SFDataTable();
        }
    }

    /**
     * Check if a metric column should show percentage
     * @param {number} columnIndex - Column index to check
     * @returns {boolean} - true if percentage should be shown for this column
     */
    #shouldShowPercentForColumn(columnIndex) {
        if (!this.#SFDataTableEnablePercent || !this.#validatePercentMetricColumn()) {
            return false;
        }
        
        // If metricsToShowPercent is not set, show percent for all metrics
        if (this.#SFDataTableMetricsToShowPercent === undefined || 
            !Array.isArray(this.#SFDataTableMetricsToShowPercent) ||
            this.#SFDataTableMetricsToShowPercent.length === 0) {
            // Show percent for all metric columns (t === 1)
            return this.#SFDataTableHeader[columnIndex] && this.#SFDataTableHeader[columnIndex].t === 1;
        }
        
        // Show percent only for metrics in the specified array
        const columnName = this.#SFDataTableHeader[columnIndex]?.v;
        return this.#SFDataTableMetricsToShowPercent.includes(columnName) &&
               this.#SFDataTableHeader[columnIndex].t === 1;
    }


//Temporary code below
    transform(value) {
        if(typeof value === 'string'){
            if(value == "na" || value == "NA" || value.includes("Infinity") || value.includes("NaN")) {
                return -1000000;
            }
        }
        return value;
    }

    getTableAsCSV() {
        let filename = 'datatable.csv'
        // Method uses data arrays directly, table element check is just validation
        const tableId = this.#SFDataTableID || this.#sfDataTableID;
        const table = document.getElementById(tableId);
        if (!table) {
            console.error(`Table with ID not found: ${tableId}`);
            return "";
        }
        let csvData = "";
        let coma = "";
        for (let j = 0; j < this.#SFDataTableHeader.length; j++) {
            csvData = csvData + coma + this.#SFDataTableHeader[j]['v'];
            if (j == 0) {
                coma = ",";
            }
        }
        csvData = csvData = csvData + ",location" + "\n";//header
        for (let i = 0; i < this.#SFDataTableRows.length; i++) {
            let coma = "";
            let type = "";
            for (let j = 0; j < this.#SFDataTableRows[i].length; j++) {
                if (j == 2) {
                    if (typeof this.#SFDataTableRows[i][j]['v'] === 'string') {
                        if (this.#SFDataTableRows[i][j]['v'].charAt(this.#SFDataTableRows[i][j]['v'].length - 1) === 's') {
                            type = "sb";
                        } else {
                            type = "prod";
                        }
                    }
                }
                csvData = csvData + coma + this.extractTextFromHTML(this.transform(this.#SFDataTableRows[i][j]['v']));
                if (j == 0) {
                    coma = ",";
                }
            }
            csvData = csvData + "," + type + "\n";//value
        }
        return csvData;
    }
//Temporary code above


    downloadTableAsCSV() {
        let filename = 'datatable.csv'
        // Method uses data arrays directly, table element check is just validation
        const tableId = this.#SFDataTableID || this.#sfDataTableID;
        const table = document.getElementById(tableId);
        if (!table) {
            console.error(`Table with ID "${tableId}" not found.`);
            return;
        }
        let csvData="";
        let coma = "";
        for(let j=0; j<this.#SFDataTableHeader.length; j++) {
            csvData = csvData+coma+this.#SFDataTableHeader[j]['v'];
            if(j == 0){coma=",";}
        }
        csvData = csvData = csvData + ",location" + "\n";//header
        for(let i = 0; i<this.#SFDataTableRows.length; i++){
            let coma = "";
            let type = "";
            for(let j=0; j<this.#SFDataTableRows[i].length; j++) {
                if(j == 2){
                    if(this.#SFDataTableRows[i][j]['v'].charAt(this.#SFDataTableRows[i][j]['v'].length - 1) === 's'){
                        type = "sb";
                    }else{
                        type = "prod";
                    }
                }
                csvData = csvData+coma+this.extractTextFromHTML(this.transform(this.#SFDataTableRows[i][j]['v']));
                if(j == 0){coma=",";}
            }
            csvData = csvData + "," + type + "\n";//value
        }

        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });

        // Check if URL.createObjectURL is available
        const createObjectURL = window.URL?.createObjectURL || window.webkitURL?.createObjectURL;
        if (typeof createObjectURL !== 'function') {
            console.error('Your browser does not support Blob URL creation.');
            return;
        }

        const url = createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Optional: Revoke the object URL to free memory
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    extractTextFromHTML(htmlString) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlString;
        return tempDiv.textContent || tempDiv.innerText || '';
    }

}
