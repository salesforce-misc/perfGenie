<div id="spinnerzing" class="spinner"></div>
<div style="overflow: scroll;font-size: 95%">
    <div id="canaryview"></div>
</div>


<script type="text/javascript" class="init">
    const urlParams = new URLSearchParams(window.location.search);
    let dataHost = urlParams.get('host') || "perf-genie-tracker";

    function onComment(resulttime, cell) {
        getCanaryComments(resulttime, cell);
    }


    $(document).ready(function () {
        // Apply jQuery UI button widget to both submit and cancel buttons
        $("#submitComment").button();
        $("#cancelComment").button();
        $("#submitBtn").button();


        // Close the popup when the cancel button is clicked
        $("#cancelComment").click(function () {
            $("#overlay").fadeOut();
            $("#commentPopup").fadeOut();
        });

        // Submit the comment and selected color
        $("#submitComment").click(function () {
            let comment = $("#commentText").val();
            comment = comment.replaceAll('\n', "<br>");
            let selectedColor = $("input[name='color']:checked").val();
            let cell = $('#cell').val();
            let timestamp = $('#resulttime').val();
            // If comment and color are selected, close popup
            if (!selectedColor) {
                selectedColor = "black";
            }
            if (comment.trim() !== "") {
                //alert("Comment submitted: " + comment + "\nSelected Color: " + selectedColor);

                postComment(comment, selectedColor, cell, timestamp);
                $("#overlay").fadeOut();
                $("#commentPopup").fadeOut();
            } else {
                toastMessage(toastType.INFO, "Please enter a comment");
            }
        });

        // Close the popup when clicking the overlay
        $("#overlay").click(function () {
            $(this).fadeOut();
            $("#commentPopup").fadeOut();
        });
    });

    function processCanaryData() {
        URL = "v1/canary/" + dataHost + "/?start=1&end=1";
        showSpinner("spinnerzing");
        $.ajax({
            url: URL, success: function (result) {
                hideSpinner("spinnerzing");
                toastMessage(toastType.INFO, "Done");
            },
            error: function (xhr, status, error) {
                toastMessage(toastType.ERROR, "Failed to process canary data");
                hideSpinner("spinnerzing");
            }
        });
    }

    function getCanaryHeader(){
        URL = "v1/canaryheader";
        $.ajax({
            url: URL, success: function (result) {
                if (result != undefined) {
                    canaryContextViewHeader = result.header;
                    viewCanaryData();
                }
            },
            error: function (xhr, status, error) {
                toastMessage(toastType.ERROR, "Failed to get header");
            }
        });
    }
    function viewCanaryData() {

        URL = "v1/canaryview/" + dataHost + "/?start=1&end=1";
        showSpinner("spinnerzing");
        $.ajax({
            url: URL, success: function (result) {
                if (result != undefined && result.entry != undefined && result.entry.records != undefined && result.entry.records.canary != undefined && result.entry.records.canary[1] != undefined) {
                    canaryContextArray = result.entry.records.canary[1];
                    canaryContextHeader = result.entry.header.canary;
                    canaryCommentCounts = result.counts;
                    updateCanaryView($("#tabs .ui-tabs-panel:visible").attr("id"));
                    //showCanaryTable(canaryContextArray);
                }
                hideSpinner("spinnerzing");
            },
            error: function (xhr, status, error) {
                toastMessage(toastType.ERROR, "Failed to process canary data");
                hideSpinner("spinnerzing");
            }
        });
    }

    function getCanaryComments(resulttime, cell) {
        URL = "v1/canarycomments/"+dataHost+"/?start=" + resulttime + "&end=" + resulttime + "&metadata_query=" + encodeURIComponent("cell=" + cell);
        showSpinner("spinner1");
        $.ajax({
            url: URL, success: function (result) {
                if (result != undefined) {
                    canaryComments = result;
                    $('#resulttime').val(resulttime);
                    $('#cell').val(cell);
                    $("#commentText").val("");
                    $("#overlay").fadeIn();
                    $("#commentPopup").fadeIn();
                    let text = "";
                    let arr = [];
                    for (let timestamp in canaryComments) {
                        arr.push(timestamp);
                    }
                    arr.sort((a, b) => a - b);
                    for (let i = 0; i < arr.length; i++) {
                        if (canaryComments[arr.at(i)] != null && canaryComments[arr.at(i)].color != undefined) {
                            text = text + "<span style='color:" + canaryComments[arr.at(i)].color + "'>" + canaryComments[arr.at(i)].comment + "</span><br>";
                        }
                    }
                    $('#comments').html(text);
                    $('#comments').scrollTop($('#comments')[0].scrollHeight);
                }
                hideSpinner("spinner1");
            },
            error: function (xhr, status, error) {
                toastMessage(toastType.ERROR, "Failed to get comments");
                hideSpinner("spinner1");
            }
        });
    }
    let exampleCSVData = `timestamp,cell,instance,avgApt %c,jCpuT/r %c,cCpuT/r %c,rCpuT/r %c,5xx/r %c,4xx/r %c,memory_usage,request_count
2024-01-01 10:00:00,cell-01,instance-001,85.5,12.3,8.7,15.2,0.1,2.3,2048,1250
2024-01-01 10:05:00,cell-01,instance-001,87.2,11.8,9.1,14.8,0.0,1.9,2156,1180
2024-01-01 10:10:00,cell-01,instance-002,82.1,13.5,7.9,16.1,0.2,2.8,1987,1320
2024-01-01 10:15:00,cell-02,instance-001,89.3,10.9,8.3,13.7,0.0,1.5,2234,1100
2024-01-01 10:20:00,cell-02,instance-002,84.7,12.1,8.9,15.5,0.1,2.1,2076,1280
2024-01-01 10:25:00,cell-01,instance-001,86.8,11.5,8.5,14.9,0.0,1.8,2123,1200
2024-01-01 10:30:00,cell-02,instance-001,88.1,11.2,8.1,14.2,0.0,1.6,2198,1150
2024-01-01 10:35:00,cell-01,instance-002,83.4,12.8,8.6,15.8,0.1,2.5,2012,1350
2024-01-01 10:40:00,cell-02,instance-002,87.6,10.7,8.4,13.9,0.0,1.7,2256,1120
2024-01-01 10:45:00,cell-01,instance-001,85.9,12.0,8.8,15.1,0.0,2.0,2089,1230
2024-01-01 10:50:00,cell-02,instance-001,88.7,10.5,8.2,14.0,0.0,1.4,2211,1080
2024-01-01 10:55:00,cell-01,instance-002,84.2,12.6,8.7,15.6,0.1,2.2,1998,1300
2024-01-01 11:00:00,cell-02,instance-002,86.3,11.8,8.5,14.6,0.0,1.9,2145,1220
2024-01-01 11:05:00,cell-01,instance-001,87.9,11.1,8.3,14.1,0.0,1.6,2178,1170
2024-01-01 11:10:00,cell-02,instance-001,85.4,12.2,8.9,15.3,0.0,2.1,2067,1260
2024-01-01 11:15:00,cell-01,instance-002,83.7,12.9,8.4,16.0,0.1,2.7,2001,1380
2024-01-01 11:20:00,cell-02,instance-002,88.2,10.8,8.1,13.8,0.0,1.5,2223,1090
2024-01-01 11:25:00,cell-01,instance-001,86.5,11.7,8.6,14.8,0.0,1.9,2102,1210
2024-01-01 11:30:00,cell-02,instance-001,87.3,11.3,8.2,14.3,0.0,1.7,2189,1160
2024-01-01 11:35:00,cell-01,instance-002,84.8,12.4,8.8,15.7,0.1,2.3,2023,1330`;

    $(document).ready(function () {
        getCanaryHeader();
        // Initialize Wave Analytics component only if not already initialized
        if (!window.waveAnalytics) {
            window.waveAnalytics = new WaveAnalytics('dataviewcontent');
            // Initialize collapse functionality for categories panel
            window.waveAnalytics.initializeCollapsePanel();
        }
        // Set data and functions on existing instance
        window.waveAnalytics.setCSVDataAsString(exampleCSVData);
        window.waveAnalytics.setDataFetchFunction(getTableAsCSV);
        getCanaryLenses();
    });

    function getTableAsCSV() {
        return canaryviewtable.getTableAsCSV();
    }

    const canaryviewtable = new SFDataTable("canaryviewtable");
    canaryviewtable.SFDataTableSetPageSize(25);
    Object.freeze(canaryviewtable);
    let canaryContextArray = undefined;
    let canaryContextHeader = undefined;
    let canaryContextViewHeader = undefined;
    let canaryCommentCounts = undefined;
    let canaryComments = undefined;

    let headerTypeMap = {};
    let headerLableMap = {};

    let headerExtraTypeMap = {};
    let headerExtraLableMap = {};

    function isDecimal(number) {
        return typeof number === 'number' && number % 1 !== 0;
    }

    function getCellTimeSeriesData(cell){
        showTimeRangeFilter(minTimeStamp, maxTimeStamp,
            (result) => {
                getTimeSeriesDataAndLoad(cell,result.start,result.end);
            },
            () => {
                console.log('❌ Label Prefix Test - Cancelled');
            },
            cell // Label prefix
        );
    }

    let timeSeriesData;
    let timeSeriesChartObj = undefined;
    document.addEventListener('DOMContentLoaded', initializeCharts);
    function initializeCharts() {
        timeSeriesChartObj = new TimeSeriesChart('my-chart', {
            height: 400,
            showLegend: true,
            showLegendText: true, // Set to false to hide legend text, show only colored indicators
            showCustomLegend: false, // Set to false to hide the custom legend div (default: hidden)
            showTooltip: true,
            showGrid: true,
            animate: false
        });
    }
    function  getTimeSeriesDataAndLoad(cell,startEpoch,endEpoch){
        URL = "v1/canaryview/timeseries/" + dataHost + "/?cell="+cell+"&start=" + startEpoch + "&end=" + endEpoch;
        showSpinner("spinnerswat");
        $.ajax({
            url: URL, success: function (result) {
                hideSpinner("spinnerswat");
                if (result != undefined) {
                    timeSeriesData=JSON.parse(result);
                    for(let i=0; i<timeSeriesData.length ; i++) {
                        if(i==0) {
                            timeSeriesChartObj.loadData(timeSeriesData[i]["timestamps"], timeSeriesData[i]["metrics"],cell,timeSeriesData[i]["colors"]);
                        }else{
                            timeSeriesChartObj.addChart(timeSeriesData[i]["timestamps"], timeSeriesData[i]["metrics"],false,cell,timeSeriesData[i]["colors"]);
                        }
                    }
                }

            },
            error: function (xhr, status, error) {
                toastMessage(toastType.ERROR, "Failed to process canary data");
                hideSpinner("spinnerswat");
            }
        });
    }

    let extraHeadersHandled = false;
    let minTimeStamp = Number.MAX_VALUE;;
    let maxTimeStamp = 0;

    function showCanaryTable(result,divId,type) {
        console.log("showCanaryTable " + type);
        tableHeader = [];
        canaryviewtable.addContextTableHeader(tableHeader, "Cmt", -1, "");
        //create table header
        for (let i = 0; i < canaryContextViewHeader.length; i++) {
            let tokens = canaryContextViewHeader[i].split(":");
            if(tokens[1] != undefined){
                headerTypeMap[tokens[0]] = tokens[1];
            }
            if(tokens[2] != undefined){
                headerLableMap[tokens[0]] = tokens[2];
            }else{
                headerLableMap[tokens[0]] = tokens[0];
            }
            if(tokens[1] == "timestamp" || tokens[1] == "text" || tokens[1] == "url"){
                canaryviewtable.addContextTableHeader(tableHeader, headerLableMap[tokens[0]], -1, "");
                if(tokens[1] == "timestamp"  && type == 1){
                    canaryviewtable.addContextTableHeader(tableHeader, "day", -1, "");
                }
            }else if(tokens[1] == "number" || tokens[1] == "numberc" || tokens[1] == "int"){
                canaryviewtable.addContextTableHeader(tableHeader, headerLableMap[tokens[0]], 1, "");
            }
        }

        /*//identify extra headers
        for (let i = 0; i < canaryContextHeader.length; i++) {
            let tokens = canaryContextHeader[i].split(":");
            if(headerTypeMap[tokens[0]] == undefined && headerExtraTypeMap[tokens[0]] == undefined){
                if(tokens[1] != undefined){
                    headerExtraTypeMap[tokens[0]] = tokens[1];
                }
                if(tokens[2] != undefined){
                    headerExtraLableMap[tokens[0]] = tokens[2];
                }
            }
        }*/

        //process rows
        let timeStampIndex = -1;
        let cellIndex = -1;
        let typeIndex = -1;
        for (let i = 0; i < canaryContextArray.length; i++) {
            if(typeIndex != -1 || (type == 4 && canaryContextArray[i].record.length < 135)){
                continue;
            }
            for (let j = 0; j < canaryContextArray[i].record.length; j = j + 2) {
                let tokens = canaryContextArray[i].record[j].split(":");
                if(typeIndex == -1 && tokens[0] == "type" && canaryContextArray[i].record[j+1] == type){
                    typeIndex = j+1;
                }
            }
        }

        console.log("showCanaryTable " + typeIndex);

        for (let i = 0; i < canaryContextArray.length; i++) {
            if(typeIndex == -1 || canaryContextArray[i].record[typeIndex] != type){
                continue;
            }
            for (let j = 0; j < canaryContextArray[i].record.length; j = j+2) {
                let tokens = canaryContextArray[i].record[j].split(":");
                if(timeStampIndex == -1 && tokens[0] == "timestamp"){
                    timeStampIndex = j+1;
                }
                if(cellIndex == -1 && tokens[0] == "cell"){
                    cellIndex = j+1;
                }
                if(headerTypeMap[tokens[0]] == undefined && headerExtraTypeMap[tokens[0]] == undefined){
                    if(tokens[1] != undefined){
                        headerExtraTypeMap[tokens[0]] = tokens[1];
                    }
                    if(tokens[2] != undefined){
                        headerExtraLableMap[tokens[0]] = tokens[2];
                    }
                }
                canaryContextArray[i][tokens[0]] = canaryContextArray[i].record[j+1];
            }
        }

        //handle extra headers
        if(!extraHeadersHandled) {
            for (const header in headerExtraTypeMap) {
                canaryContextViewHeader.push(header + ":" + headerExtraTypeMap[header]);
                headerTypeMap[header] = headerExtraTypeMap[header];
                if (headerExtraTypeMap[header] == "timestamp" || headerExtraTypeMap[header] == "text" || headerExtraTypeMap[header] == "url") {
                    canaryviewtable.addContextTableHeader(tableHeader, header, -1, "");
                } else if (headerExtraTypeMap[header] == "number" || headerExtraTypeMap[header] == "numberc" || headerExtraTypeMap[header] == "int") {
                    canaryviewtable.addContextTableHeader(tableHeader, header, 1, "");
                }
                //do not show data type
            }
            extraHeadersHandled=true;
        }

        let rowIndex = -1;
        tableRows = [];
        for (let i = 0; i < canaryContextArray.length; i++) {
            if(canaryContextArray[i].record[typeIndex] != type){
                continue;
            }
            rowIndex++;
            tableRows[rowIndex] = [];
            let color = "black";
            let count = "";
            let key = canaryContextArray[i].record[timeStampIndex] + canaryContextArray[i].record[cellIndex];
            if (canaryCommentCounts[key] != undefined) {
                let arr = canaryCommentCounts[key].split(":");
                count = arr[0]
                color = arr[1];
            }
            //comment at first column
            canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span onclick='onComment(\"" + canaryContextArray[i].record[timeStampIndex] + "\",\"" + canaryContextArray[i].record[cellIndex] + "\")' style='cursor: pointer; color: " + color + ";'>" + count + " <i class=\"fa fa-comment-o\" aria-hidden=\"true\"></i></span>", "id='" + canaryContextArray[i].record[timeStampIndex] + canaryContextArray[i].record[cellIndex] + "'");

            for (let j = 0; j < canaryContextViewHeader.length; j++) {
                let tokens = canaryContextViewHeader[j].split(":");

                let val = canaryContextArray[i][tokens[0]];
                if (val != undefined) {
                    if (headerTypeMap[tokens[0]] == "timestamp") {
                        if(type == 2 || type == 3 || type == 4 || type == 1){
                            canaryviewtable.addContextTableRow(tableRows[rowIndex], moment.utc(val).format('YY-MM-DD HH:MM:SS'));

                            if(type == 1){
                                if(minTimeStamp > val){
                                    minTimeStamp = val;
                                }
                                if(maxTimeStamp < val){
                                    maxTimeStamp = val;
                                }
                                canaryviewtable.addContextTableRow(tableRows[rowIndex], moment.utc(val).format('ddd'));
                            }
                        }else {
                            canaryviewtable.addContextTableRow(tableRows[rowIndex], moment.utc(val).format('YYYY-MM-DD'));
                        }
                    }else if (headerTypeMap[tokens[0]] == "numberc") {
                        val = parseFloat(parseFloat(val).toFixed(3));
                        if(headerLableMap[tokens[0]] !=undefined && (headerLableMap[tokens[0]].includes("rCnt") || headerLableMap[tokens[0]].includes("1MinAvg"))){
                            val = val * -1;
                        }
                        if (val >= 0) {
                            canaryviewtable.addContextTableOrderRow(tableRows[rowIndex], "<span style='color:green;'>" + val + "</span>", val, "style='text-align:right'");
                        } else {
                            canaryviewtable.addContextTableOrderRow(tableRows[rowIndex], "<span style='color:red;'>" + val + "</span>", val, "style='text-align:right'");
                        }
                    } else if (headerTypeMap[tokens[0]] == "int") {
                        canaryviewtable.addContextTableRow(tableRows[rowIndex], val, "style='text-align:right'");
                    } else if (headerTypeMap[tokens[0]] == "number") {
                        //if(isDecimal(val)) {

                        //}
                        if(headerLableMap[tokens[0]] !=undefined && headerLableMap[tokens[0]].includes("heap")){
                            val = val + "G";
                        }else{
                            val = parseFloat(parseFloat(val).toFixed(2));
                        }
                        canaryviewtable.addContextTableRow(tableRows[rowIndex], val, "style='text-align:right'");
                    } else if (headerTypeMap[tokens[0]] == "url") {
                        canaryviewtable.addContextTableRow(tableRows[rowIndex], "<a href='" + val + "' target='_blank'> link</a>", "style='text-align:center'");//url
                    } else if (headerTypeMap[tokens[0]] != "data") {
                        //do not show data type
                        if(headerLableMap[tokens[0]] == "cell"){
                           canaryviewtable.addContextTableRow(tableRows[rowIndex], val,"<span onclick='getCellTimeSeriesData(\""+val+"\")'");
                        }else{
                            canaryviewtable.addContextTableRow(tableRows[rowIndex], val);
                        }
                    }
                } else {
                    if (headerTypeMap[tokens[0]] != "data") {
                        //do not show data type
                        canaryviewtable.addContextTableRow(tableRows[rowIndex], "na", "style='text-align:right'");

                    }
                }
            }
        }
        canaryviewtable.SFDataTable(tableRows, tableHeader, divId, 1);
        $("#canaryviewtableSFDownloadtable").before('<a title="Download raw json data" id="jsonDownload" href="javascript:downloadJson()"><i style="font-size:18px;" class="fa fa-download" aria-hidden="true"></i>&nbsp;</a>');
        $("#canaryviewtablepagination").after('<span id="timeseriesload"></span>');

    }

    $.contextMenu({
        selector: '.context-menu-comment',
        callback: function (key, options) {
            if (key == "add") {
                alert("check");
            }
        },
        items: {
            "add": {name: "add comment"}
        }
    });
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    function getUtcDayFromEpoch(epochMillis) {
        const date = new Date(epochMillis);
        const dayIndex = date.getUTCDay(); // 0 (Sun) to 6 (Sat)
        return days[dayIndex];
    }

    function postComment(commentText, color, cell, timestamp) {
        // Create the data to send in the request body
        const requestData = {
            comment: commentText,
            color: color,
            cell: cell,
            timestamp: timestamp
        };

        // Make the AJAX request using jQuery
        $.ajax({
            url: 'v1/comment/'+ dataHost,
            type: 'POST',
            contentType: 'application/json',  // Tells the server the request body will be in JSON format
            data: JSON.stringify(requestData),  // Convert the data object to a JSON string
            success: function (response) {
                //TODO update cell content and count map
                let count = 1;
                if (canaryCommentCounts[timestamp + cell] != undefined) {
                    let arr = canaryCommentCounts[timestamp + cell].split(":");
                    console.log(canaryCommentCounts[timestamp + cell]);
                    canaryCommentCounts[timestamp + cell] = (parseInt(arr[0]) + 1) + ":" + color;
                    console.log(canaryCommentCounts[timestamp + cell]);
                    count = (parseInt(arr[0]) + 1);
                } else {
                    canaryCommentCounts[timestamp + cell] = 1 + ":" + color;
                }
                $("#" + timestamp + cell).html("<span onclick='onComment(\"" + timestamp + "\",\"" + cell + "\")' style='cursor: pointer; color: " + color + ";'>" + count + " <i class=\"fa fa-comment-o\" aria-hidden=\"true\"></i></span>");
                console.log('Comment posted successfully:', response);
            },
            error: function (xhr, status, error) {
                console.error('Error posting comment:', error);
            }
        });
    }

    function downloadJson() {
        let filename = 'datatable.json'

        const blob = new Blob([JSON.stringify(canaryContextArray)], { type: 'text/plain;charset=utf-8;'});

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
</script>