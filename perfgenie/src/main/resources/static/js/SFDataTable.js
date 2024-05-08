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
    #sfShowToolBar = true;
    constructor(instanceVariableName) {
        if(instanceVariableName != undefined){
            this.#sfDataTableID = instanceVariableName+"SFDataTable";
            this.#sfPaginationID = instanceVariableName+"pagination";
            this.#sfSearchID = instanceVariableName+"SFSearch";
            this.#instanceName = instanceVariableName;
        }else{

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
            //sort data
            if(rows.length != 0) {
                this.SFDataTableSort(1);
            }
        }

        let table = this.SFDataTableGetToolBar() + "<table style='padding: 1px !important;' id='"+this.#sfDataTableID+"' class='ui-widget alternate_color'>\n";
        table += this.SFDataTableGetHeader();
        table += this.SFDataTableGetRows();
        table += "</table>";
        document.getElementById(this.#SFDataTableID).innerHTML = table;
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
        if (this.#SFDataTableSearchStr != undefined) {
            for (let i = this.#SFDataTablePageSize * this.#SFDataTablePage; i < this.#SFDataTableSearchMatchedRows.length && rowsAdded < this.#SFDataTablePageSize; i++) {
                if (rowsAdded < this.#SFDataTablePageSize) {
                    rows += "<tr>"
                    for (let j = 0; j < this.#SFDataTableRows[this.#SFDataTableSearchMatchedRows[i]].length; j++) {
                        //rows += "<td>" + this.#SFDataTableRows[this.#SFDataTableSearchMatchedRows[i]][j].v + "</td>";
                        rows += "<td " + (this.#SFDataTableHeader[j].p == undefined ? "" : this.#SFDataTableHeader[j].p) + " " + (this.#SFDataTableRows[this.#SFDataTableSearchMatchedRows[i]][j].p == undefined ? "" : this.#SFDataTableRows[this.#SFDataTableSearchMatchedRows[i]][j].p) + " >" + this.#SFDataTableRows[this.#SFDataTableSearchMatchedRows[i]][j].v + "</td>";
                    }
                    rows += "</tr>\n"
                    rowsAdded++;
                }
            }
        } else {
            for (let i = this.#SFDataTablePageSize * this.#SFDataTablePage; i < this.#SFDataTableRows.length && rowsAdded < this.#SFDataTablePageSize; i++) {
                if (rowsAdded < this.#SFDataTablePageSize) {
                    rows += "<tr>"
                    for (let j = 0; j < this.#SFDataTableRows[i].length; j++) {
                        rows += "<td " + (this.#SFDataTableHeader[j].p == undefined ? "" : this.#SFDataTableHeader[j].p) + " " + (this.#SFDataTableRows[i][j].p == undefined ? "" : this.#SFDataTableRows[i][j].p) + " >" + this.#SFDataTableRows[i][j].v + "</td>";
                    }
                    rows += "</tr>\n"
                    rowsAdded++;
                }
            }
        }
        return rows;
    }

    SFDataTableGetToolBar() {
        if(!this.#sfShowToolBar){
            return "";
        }
        let toolbar = "<div class='ui-widget' style='padding-top: 5px !important;'>";
        toolbar += " Search: <input type='text' style='border: 1px solid #E8EAEC;' id='" + this.#sfSearchID + "' class='ui-widget' name='SFSearch'  value='" + (this.#SFDataTableSearchStr == undefined ? "" : this.#SFDataTableSearchStr) + "'onkeypress='if(event.keyCode == 13) javascript:" + this.#instanceName + ".SFSearch()'>";

        toolbar += "<a title='Search' id='" + this.#sfSearchID + "table' href='javascript:" + this.#instanceName + ".SFSearch()'><i style=\"font-size:18px;\" class=\"fa fa-search\" aria-hidden=\"true\"></i></a>";


        if (this.#SFDataTablePage == 0) {
            toolbar += "<button  disabled=true id='" + this.#sfPaginationID + "' style='border-color: #f9f9f9;' type='submit' onClick='javascript:" + this.#instanceName + ".SFhandlePrevious()'>Previous</button>";
        } else {
            toolbar += "<button  id='" + this.#sfPaginationID + "' style='border-color: #f9f9f9;' type='submit' onClick='javascript:" + this.#instanceName + ".SFhandlePrevious()'>Previous</button>";
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
                toolbar += "<button active style='border-color: #9be3e5;' class='' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + 1 + ")'>" + 1 + "</button>";
            } else {
                toolbar += "<button active style='border-color: #f9f9f9;' class='' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + 1 + ")'>" + 1 + "</button>";
            }

            if (total - (this.#SFDataTablePage + 1) < 4) {//is it in the last 5
                toolbar += "<button active style='border-color: #f9f9f9;' class=''>...</button>";
                for (let i = total - 5; i < total - 1; i++) {
                    if (i == this.#SFDataTablePage) {
                        toolbar += "<button active style='border-color: #9be3e5;' class='' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + (i + 1) + ")'>" + (i + 1) + "</button>";
                    } else {
                        toolbar += "<button active style='border-color: #f9f9f9;' class='' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + (i + 1) + ")'>" + (i + 1) + "</button>";
                    }
                }
            } else if ((this.#SFDataTablePage + 1) - 1 < 4) {//is it in the first 5
                for (let i = 1; i < 5; i++) {
                    if (i == this.#SFDataTablePage) {
                        toolbar += "<button active style='border-color: #9be3e5;' class='' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + (i + 1) + ")'>" + (i + 1) + "</button>";
                    } else {
                        toolbar += "<button active style='border-color: #f9f9f9;' class='' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + (i + 1) + ")'>" + (i + 1) + "</button>";
                    }
                }
                toolbar += "<button active style='border-color: #f9f9f9;' class=''>...</button>";
            } else {//in the middle
                toolbar += "<button active style='border-color: #f9f9f9;' class=''>...</button>";
                for (let i = this.#SFDataTablePage - 1; i < this.#SFDataTablePage + 2; i++) {
                    if (i == this.#SFDataTablePage) {
                        toolbar += "<button active style='border-color: #9be3e5;' class='' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + (i + 1) + ")'>" + (i + 1) + "</button>";
                    } else {
                        toolbar += "<button active style='border-color: #f9f9f9;' class='' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + (i + 1) + ")'>" + (i + 1) + "</button>";
                    }
                }
                toolbar += "<button active style='border-color: #f9f9f9;' class=''>...</button>";
            }
            if (total == this.#SFDataTablePage + 1) {
                toolbar += "<button active style='border-color: #9be3e5;' class='' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + total + ")'>" + total + "</button>";
            } else {
                toolbar += "<button active style='border-color: #f9f9f9;' class='' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + total + ")'>" + total + "</button>";
            }
        } else {
            //all
            for (let i = 0; i < total; i++) {
                if (i == this.#SFDataTablePage) {
                    toolbar += "<button active style='border-color: #9be3e5;' class='' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + (i + 1) + ")'>" + (i + 1) + "</button>";
                } else {
                    toolbar += "<button active style='border-color: #f9f9f9;' class='' onClick='javascript:" + this.#instanceName + ".SFhandlePaginationClick(" + (i + 1) + ")'>" + (i + 1) + "</button>";
                }
            }
        }


        if (this.#SFDataTableSearchStr != undefined) {
            if (this.#SFDataTablePageSize * this.#SFDataTablePage + this.#SFDataTablePageSize < this.#SFDataTableSearchMatchedRows.length) {
                toolbar += "<button id='" + this.#sfPaginationID + "' class='' style='border-color: #f9f9f9;' type='submit' onClick='javascript:" + this.#instanceName + ".SFhandleNext()'>Next</button>";
            } else {
                toolbar += "<button disabled=true id='" + this.#sfPaginationID + "' class='' style='border-color: #f9f9f9;' type='submit' onClick='javascript:" + this.#instanceName + ".SFhandleNext()'>Next</button>";
            }
        } else {
            if (this.#SFDataTablePageSize * this.#SFDataTablePage + this.#SFDataTablePageSize < this.#SFDataTableRows.length) {
                toolbar += "<button id='" + this.#sfPaginationID + "' class='' style='border-color: #f9f9f9;' type='submit' onClick='javascript:" + this.#instanceName + ".SFhandleNext()'>Next</button>";
            } else {
                toolbar += "<button disabled=true id='" + this.#sfPaginationID + "' style='border-color: #f9f9f9;' class='' type='submit' onClick='javascript:" + this.#instanceName + ".SFhandleNext()'>Next</button>";
            }
        }
        return toolbar + "</div>";
    }

    SFDataTableGetHeader() {
        let header = "<thead style='height: 30px;'><tr>";
        for (let i = 0; i < this.#SFDataTableHeader.length; i++) {
            if(this.#SFDataTableHeader[i].h != undefined) {
                if (i == this.#sfdtsci) {
                    header += "<th title='"+this.#SFDataTableHeader[i].h+"' onclick='javascript:" + this.#instanceName + ".SFDataTableSetSortIndex(this)' style='cursor: pointer;padding: 5px; white-space: nowrap;'>" + this.#SFDataTableHeader[i].v + " <i class='fa fa-caret-" + this.#sortIcon + "' style='color:black'></i></th>";
                } else {
                    header += "<th title='"+this.#SFDataTableHeader[i].h+"' onclick='javascript:" + this.#instanceName + ".SFDataTableSetSortIndex(this)' style='cursor: pointer;padding: 5px; white-space: nowrap;'>" + this.#SFDataTableHeader[i].v + " <i class='fa fa-caret-down' style='color:#d3d3d4'></i></th>";
                }
            }else{
                if (i == this.#sfdtsci) {
                    header += "<th onclick='javascript:" + this.#instanceName + ".SFDataTableSetSortIndex(this)' style='cursor: pointer;padding: 5px; white-space: nowrap;'>" + this.#SFDataTableHeader[i].v + " <i class='fa fa-caret-" + this.#sortIcon + "' style='color:black'></i></th>";
                } else {
                    header += "<th onclick='javascript:" + this.#instanceName + ".SFDataTableSetSortIndex(this)' style='cursor: pointer;padding: 5px; white-space: nowrap;'>" + this.#SFDataTableHeader[i].v + " <i class='fa fa-caret-down' style='color:#d3d3d4'></i></th>";
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
}