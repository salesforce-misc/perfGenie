<div id="spinnerzing" class="spinner"></div>
<div style="overflow: scroll;font-size: 95%">
    <div id="canaryview"></div>
</div>


<script type="text/javascript" class="init">
    // Use window.urlParams to avoid duplicate declaration errors when multiple templates are included
    if (typeof window.urlParams === 'undefined') {
        window.urlParams = new URLSearchParams(window.location.search);
    }
    // Use window.urlParams directly to avoid duplicate var declarations
    let dataHost = window.urlParams.get('host') || "perf-genie-test45";

    function onComment(resulttime, cell) {
        getCanaryComments(resulttime, cell);
    }


    $(document).ready(function () {
        // Apply jQuery UI button widget to both submit and cancel buttons
        $("#canary-submitComment").button();
        $("#canary-cancelComment").button();
        $("#submitBtn").button();


        // Close the popup when the cancel button is clicked
        $("#canary-cancelComment").click(function () {
            $("#canary-overlay").fadeOut();
            $("#canary-commentPopup").fadeOut();
        });

        // Submit the comment and selected color
        $("#canary-submitComment").click(function () {
            let comment = $("#canary-commentText").val();
            comment = comment.replaceAll('\n', "<br>");
            let selectedColor = $("input[name='color']:checked").val();
            let cell = $('#canary-cell').val();
            let timestamp = $('#canary-resulttime').val();
            // If comment and color are selected, close popup
            if (!selectedColor) {
                selectedColor = "black";
            }
            if (comment.trim() !== "") {
                //alert("Comment submitted: " + comment + "\nSelected Color: " + selectedColor);

                postComment(comment, selectedColor, cell, timestamp);
                $("#canary-overlay").fadeOut();
                $("#canary-commentPopup").fadeOut();
            } else {
                toastMessage(toastType.INFO, "Please enter a comment");
            }
        });

        // Close the popup when clicking the overlay
        $("#canary-overlay").click(function () {
            $(this).fadeOut();
            $("#canary-commentPopup").fadeOut();
        });

        $.contextMenu({
                        selector: '.canary-menu-one',
                        callback: function (key, options) {
                            if (key == "timeseries") {
                                getCellTimeSeriesData($(this).text());
                            }else if(key == "pidstat") {
                                //getPidStatMetrics($(this).text(),$(this).attr("t")-1*60*60*1000, $(this).attr("t"),$(this).nextAll('td').eq(instanceIndex-2).text());

                                let $instance = $(this).nextAll('td').eq(instanceIndex-2).text();
                                let arr = $instance.split(".");
                                $instance = "aws-"+arr[0]+"-"+arr[0];

perfswatdashboard = new GenieDashboard('perfswat-dashboard-container');

        // 5. Define dashboard configuration (Grafana-style JSON)
        perfswatdashboardJson = {
        toolbar: {
                enabled: true,  // Set to false to hide toolbar
                showTimeRange: true,  // Show time range selector (clock icon)
                showInterval: true,  // Show interval input
                showAggregation: true,  // Show aggregation dropdown
                showRefresh: true,  // Show refresh button
                collapse:false
            },
        panels: [
 {
                 id: 3,
                 seriesContextMenu: [
                                 {
                                     label: 'Select host',
                                     handler: function(seriesName) {
                                         console.log('View details for:', seriesName);
                                         alert('View details for: ' + seriesName);
                                     }
                                 }
                                 ],
                 tab: 'Timeseries',
                 tabs: true,
                 transpose: false,
                 type: 'timeseries',  // or 'stat', 'table', 'gauge', 'bargauge'
                 title: 'Pidstats',
                 description: 'Hover over the chart to see interactive tooltips showing all series values at each timestamp',
                 gridPos: { x: 0, y: 0, w: 24, h: 8 },  // Grid position (24-column system)
                 stats: ['avg',"sum"],  // Statistics for stats tab
                 fieldConfig: {
                 defaults: {
                 unit: 'ms',  // Unit for Y-axis
                 custom: {
                 drawStyle: 'line',
                 lineWidth: 0.5,
                 fillOpacity: 0.1,
                 showPoints: 'never'
                 }
                 },
                 overrides: [
                                     {
                                         matcher: { id: 'byRegexp', options: '/ddcpu_time|CPU Usage/' },
                                         properties: [
                                             {
                                                 id: 'displayName',
                                                 value: 'CPU Usage'
                                             }
                                         ]
                                     },
                                     {
                                         matcher: { id: 'byRegexp', options: '/ddwall_time|Wallclock Time/' },
                                         properties: [
                                             {
                                                 id: 'displayName',
                                                 value: 'Wallclock Time'
                                             }
                                         ]
                                     }
                                 ]
                 },
                 options: {
                 download: true,
                 aggregation : {
                                             tag: 'cell',           // Tag name to use as aggregation key
                                             type: 'sum',           // Default aggregation type (optional)
                                             span: '1m',            // Optional: span duration for time window aggregation
                                             spanAggregation: 'sum' // Optional: aggregation type for span (sum or avg)
                                             },
                 statsTable: {
                             transpose: false,  // Table will be transposed by default

                             'previous': '-7d,none,-1d,-7d,-14d,-21d,-28d',
                             'displayName': "scope",
                             base_series: 'containerCpu',
                             'percentBase': "containerCpu",
                             'percentTargets': ["c2Cpu","gcCpu","jfrCpu"]
                         },
                         "timeSeries": {
                             "zoomSlider": false,
                             "zoom":true,
                             "zoomSliderPosition": "bottom",
                             "sort":true
                           },

                 legend: {
                 showLegend: true,
                 displayMode: 'tooltip',
                 placement: 'bottom'
                 },
                 tooltip: {
                 mode: 'multi'
                 }
                 },
                 targets: [
                 {
                                     refId: 'pidstats',
                                     rawSql: '$start:$end:$substrate:$instance:$domain:$cell',
                                     datasource: { type: 'genie' }
                                     }
                 ]
                 }


        ],
                                   "templating": {
                                       "list": [
                                         {
                                           "current": {
                                             "selected": false,
                                             "text": "aws",
                                             "value": "aws"
                                           },
                                           "datasource": {
                                             "type": "argus",
                                             "uid": "000000001"
                                           },
                                           "definition": "",
                                           "hide": 0,
                                           "includeAll": false,
                                           "label": "Substrate",
                                           "multi": false,
                                           "name": "substrate",
                                           "options": [],
                                           "query": "type(scope),scope(core.*),metric(java-lang_type-Runtime.Uptime),tagk(k8s_container_name),tagv(coreapp),limit(5000)",
                                           "refresh": 1,
                                           "regex": "/core\\.(.*)\\..*\\..*/",
                                           "skipUrlSync": false,
                                           "sort": 1,
                                           "tagValuesQuery": "",
                                           "tagsQuery": "",
                                           "type": "query",
                                           "useTags": false
                                         },
                                         {
                                           "current": {
                                             "selected": false,
                                             "text": this.text(),
                                             "value": this.text()
                                           },
                                           "datasource": {
                                             "type": "argus",
                                             "uid": "000000001"
                                           },
                                           "definition": "",
                                           "hide": 0,
                                           "includeAll": false,
                                           "label": "Cell",
                                           "multi": false,
                                           "name": "cell",
                                           "options": [],
                                           "query": "type(tagv),scope(core.$substrate.*),metric(java-lang_type-Runtime.Uptime),tag(k8s_container_name=coreapp),tagk(cell),limit(5000)",
                                           "refresh": 1,
                                           "regex": "",
                                           "skipUrlSync": false,
                                           "sort": 1,
                                           "tagValuesQuery": "",
                                           "tagsQuery": "",
                                           "type": "query",
                                           "useTags": false
                                         },
                                         {
                                           "current": {
                                             "selected": false,
                                             "text": "",
                                             "value": ""
                                           },
                                           "datasource": {
                                             "type": "argus",
                                             "uid": "000000001"
                                           },
                                           "definition": "",
                                           "hide": 0,
                                           "includeAll": false,
                                           "label": "Falcon Instance",
                                           "multi": false,
                                           "name": "falcon_instance",
                                           "options": [],
                                           "query": "type(scope),scope(core.*),metric(java-lang_type-Runtime.Uptime),tagk(cell),tagv($cell),limit(5000)",
                                           "refresh": 1,
                                           "regex": "/core\\..*\\.(.*)\\..*/",
                                           "skipUrlSync": false,
                                           "sort": 1,
                                           "tagValuesQuery": "",
                                           "tagsQuery": "",
                                           "type": "query",
                                           "useTags": false
                                         },
                                         {
                                           "current": {
                                             "selected": false,
                                             "text": "",
                                             "value": ""
                                           },
                                           "datasource": {
                                             "type": "argus",
                                             "uid": "000000001"
                                           },
                                           "definition": "",
                                           "hide": 0,
                                           "includeAll": false,
                                           "label": "Functional Domain",
                                           "multi": false,
                                           "name": "functional_domain",
                                           "options": [],
                                           "query": "type(scope),scope(core.*),metric(java-lang_type-Runtime.Uptime),tagk(cell),tagv($cell),limit(5000)",
                                           "refresh": 1,
                                           "regex": "/core\\..*\\..*\\.(.*)/",
                                           "skipUrlSync": false,
                                           "sort": 1,
                                           "tagValuesQuery": "",
                                           "tagsQuery": "",
                                           "type": "query",
                                           "useTags": false
                                         },
                                         {
                                           "auto": false,
                                           "auto_count": 300,
                                           "auto_min": "10s",
                                           "current": {
                                             "selected": true,
                                             "text": "2m",
                                             "value": "2m"
                                           },
                                           "hide": 0,
                                           "label": "Interval",
                                           "name": "interval",
                                           "options": [
                                             {
                                               "selected": false,
                                               "text": "1m",
                                               "value": "1m"
                                             },
                                             {
                                               "selected": true,
                                               "text": "2m",
                                               "value": "2m"
                                             },
                                             {
                                               "selected": false,
                                               "text": "5m",
                                               "value": "5m"
                                             },
                                             {
                                               "selected": false,
                                               "text": "10m",
                                               "value": "10m"
                                             },
                                             {
                                               "selected": false,
                                               "text": "30m",
                                               "value": "30m"
                                             },
                                             {
                                               "selected": false,
                                               "text": "1h",
                                               "value": "1h"
                                             },
                                             {
                                               "selected": false,
                                               "text": "6h",
                                               "value": "6h"
                                             },
                                             {
                                               "selected": false,
                                               "text": "12h",
                                               "value": "12h"
                                             },
                                             {
                                               "selected": false,
                                               "text": "1d",
                                               "value": "1d"
                                             },
                                             {
                                               "selected": false,
                                               "text": "7d",
                                               "value": "7d"
                                             }
                                           ],
                                           "query": "1m,2m,5m,10m,30m,1h,6h,12h,1d,7d",
                                           "refresh": 2,
                                           "skipUrlSync": false,
                                           "type": "interval"
                                         },
                                         {
                                                 "current": {
                                                   "selected": false,
                                                   "text": "sum",
                                                   "value": "sum"
                                                 },
                                                 "description": "Aggregation options for graphs, in conjunction with the interval.",
                                                 "hide": 0,
                                                 "includeAll": false,
                                                 "label": "Aggregate",
                                                 "multi": false,
                                                 "name": "agg",
                                                 "options": [
                                                   {
                                                     "selected": true,
                                                     "text": "avg",
                                                     "value": "avg"
                                                   },
                                                   {
                                                     "selected": false,
                                                     "text": "sum",
                                                     "value": "sum"
                                                   },
                                                   {
                                                     "selected": false,
                                                     "text": "min",
                                                     "value": "min"
                                                   },
                                                   {
                                                     "selected": false,
                                                     "text": "max",
                                                     "value": "max"
                                                   }
                                                 ],
                                                 "query": "avg,sum,min,max",
                                                 "skipUrlSync": false,
                                                 "type": "custom"
                                               }
                                       ]
                                     }
        };
                                const inputJson = {
                                        // REST endpoint with QEURY placeholder (will be replaced with URL-encoded query)
                                        argus: '/v1/geniequery/?query=QEURY',
                                        genie: '/v1/geniequery/?query=QEURY',
                                        "placeholdernamemappings": {
                                                    "Cell": ["$cell","$cellkey"],
                                                    "Substrate": ["$substrate","$sub"],
                                                    "HF Instance": ["$fi", "$falcon_instance", "$fd_instance", "$instance"],
                                                    "Domain": ["$fd", "$functional_domain", "$domain"],
                                                    "Interval": ["$interval"],
                                                    "Aggregate": ["$agg", "$aggregation"]
                                                },
                                        // Variables to replace in queries (all $ keys will be replaced)
                                        '$start': $(this).attr("t")-14*60*60*1000,  // 1 hour ago
                                        '$end': $(this).attr("t") - 0
                                        };
                                        // 7. Render the dashboard
                                        perfswatdashboard.render(perfswatdashboardJson, inputJson);
                            }
                        },
                        items: {
                            "timeseries": {name: "Timeseries with range"},
                            "pidstat": {name: "Pidstat metrics"},
                        }
                    });
    });

    function  getPidStatMetrics(cell,startEpoch,endEpoch,instance, substrate, domain){
            console.log(cell + ":" + startEpoch + ":" + endEpoch);

            URL = "v1/canaryview/pidstats/" + dataHost + "/?cell="+cell+"&start=" + startEpoch + "&end=" + endEpoch+ "&instance=" + instance+ "&substrate=" + substrate+ "&domain=" + domain;
            //showSpinner("spinnerswat");
            let currentSpinner = "spinner"+$("#canary-tabs .modern-tabs-nav-button.active").attr("data-tab-target");
                    //showSpinner(currentSpinner);
            ProgressBar.start({container: currentSpinner, position: 'top',showIcon: true, iconStartPosition: 'top', icon: '🏄', splash:true }); // Rocket emoji});
            $.ajax({
                url: URL, success: function (result) {
                    //hideSpinner("spinnerswat");
                    ProgressBar.stop({ explode: true,celebrate: true});
                    if (result != undefined) {
                        timeSeriesData=JSON.parse(result);
                        for(let i=0; i<timeSeriesData.length ; i++) {
                            /*if(i==0) {
                                timeSeriesChartObj.loadData(timeSeriesData[i]["timestamps"], timeSeriesData[i]["metrics"],cell,timeSeriesData[i]["colors"]);
                            }else{
                                timeSeriesChartObj.addChart(timeSeriesData[i]["timestamps"], timeSeriesData[i]["metrics"],false,cell,timeSeriesData[i]["colors"]);
                            }*/
                            console.log(timeSeriesData.length);
                        }
                    }

                },
                error: function (xhr, status, error) {
                    toastMessage(toastType.ERROR, "Failed to process canary data");
                    //hideSpinner("spinnerswat");
                    ProgressBar.stop({ explode: true });
                }
            });
        }


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




    function getCanaryComments(resulttime, cell) {
        URL = "v1/canarycomments/"+dataHost+"/?start=" + resulttime + "&end=" + resulttime + "&metadata_query=" + encodeURIComponent("cell=" + cell);
        showSpinner("canary-spinner1");
        $.ajax({
            url: URL, success: function (result) {
                if (result != undefined) {
                    canaryComments = result;
                    $('#canary-resulttime').val(resulttime);
                    $('#canary-cell').val(cell);
                    $("#canary-commentText").val("");
                    $("#canary-overlay").fadeIn();
                    $("#canary-commentPopup").fadeIn();
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
                    $('#canary-comments').html(text);
                    const commentsElement = $('#canary-comments')[0];
                    if (commentsElement) {
                        commentsElement.scrollTop = commentsElement.scrollHeight;
                    }
                }
                hideSpinner("canary-spinner1");
            },
            error: function (xhr, status, error) {
                toastMessage(toastType.ERROR, "Failed to get comments");
                hideSpinner("canary-spinner1");
            }
        });
    }
    let exampleCSVData = `timestamp,cell,instance,avgApt %c,jCpuT/r %c,cCpuT/r %c,rCpuT/r %c,5xx/r %c,4xx/r %c,memory_usage,request_count
24-01-01 10:00:00,cell-01,instance-001,85.5,12.3,8.7,15.2,0.1,2.3,2048,1250
24-01-01 10:05:00,cell-01,instance-001,87.2,11.8,9.1,14.8,0.0,1.9,2156,1180
24-01-01 10:10:00,cell-01,instance-002,82.1,13.5,7.9,16.1,0.2,2.8,1987,1320
24-01-01 10:15:00,cell-02,instance-001,89.3,10.9,8.3,13.7,0.0,1.5,2234,1100
24-01-01 10:20:00,cell-02,instance-002,84.7,12.1,8.9,15.5,0.1,2.1,2076,1280
24-01-01 10:25:00,cell-01,instance-001,86.8,11.5,8.5,14.9,0.0,1.8,2123,1200
24-01-01 10:30:00,cell-02,instance-001,88.1,11.2,8.1,14.2,0.0,1.6,2198,1150
24-01-01 10:35:00,cell-01,instance-002,83.4,12.8,8.6,15.8,0.1,2.5,2012,1350
24-01-01 10:40:00,cell-02,instance-002,87.6,10.7,8.4,13.9,0.0,1.7,2256,1120
24-01-01 10:45:00,cell-01,instance-001,85.9,12.0,8.8,15.1,0.0,2.0,2089,1230
24-01-01 10:50:00,cell-02,instance-001,88.7,10.5,8.2,14.0,0.0,1.4,2211,1080
24-01-01 10:55:00,cell-01,instance-002,84.2,12.6,8.7,15.6,0.1,2.2,1998,1300
24-01-01 11:00:00,cell-02,instance-002,86.3,11.8,8.5,14.6,0.0,1.9,2145,1220
24-01-01 11:05:00,cell-01,instance-001,87.9,11.1,8.3,14.1,0.0,1.6,2178,1170
24-01-01 11:10:00,cell-02,instance-001,85.4,12.2,8.9,15.3,0.0,2.1,2067,1260
24-01-01 11:15:00,cell-01,instance-002,83.7,12.9,8.4,16.0,0.1,2.7,2001,1380
24-01-01 11:10:00,cell-02,instance-003,85.4,12.2,8.9,15.3,0.0,2.1,2067,1260
24-01-01 11:15:00,cell-01,instance-003,83.7,12.9,8.4,16.0,0.1,2.7,2001,1380
24-01-01 11:20:00,cell-02,instance-002,88.2,10.8,8.1,13.8,0.0,1.5,2223,1090
24-01-01 11:25:00,cell-01,instance-001,86.5,11.7,8.6,14.8,0.0,1.9,2102,1210
24-01-01 11:30:00,cell-02,instance-001,87.3,11.3,8.2,14.3,0.0,1.7,2189,1160
24-01-01 11:35:00,cell-01,instance-002,84.8,12.4,8.8,15.7,0.1,2.3,2023,1330`;

    $(document).ready(function () {
        getCanaryHeader();
        // Initialize GenieAnalytics component only if not already initialized
        if (!window.genieAnalytics) {
            window.genieAnalytics = new GenieAnalytics('canary-dataviewcontent');
            genieAnalytics.setMetricNameSearchEnabled(true);
            // Initialize collapse functionality for categories panel
            window.genieAnalytics.initializeCollapsePanel();
        }
        // Set data and functions on existing instance
        //window.genieAnalytics.setCSVDataAsString(exampleCSVData);
        window.genieAnalytics.setDataFetchFunction(getTableAsCSV);
        //getCanaryLenses();
        //getCanaryExpressions();
    });

    function getTableAsCSV() {
        return canaryviewtable.getTableAsCSV();
    }

    const canaryviewtable = new SFDataTable("canaryviewtable");
    canaryviewtable.SFDataTableSetPageSize(25);
    Object.freeze(canaryviewtable);
    // These variables are declared in tabsnew.ftl, don't redeclare here to avoid duplicate declaration errors
    // var canaryContextArray; // Already declared in parent template
    // var canaryContextHeader; // Already declared in parent template
    // var canaryCommentCounts; // Already declared in parent template
    // var canaryContextViewHeader; // Already declared in parent template
    // var canaryComments; // Already declared in parent template

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
            animate: false,
            useUTC: true
        });
    }
    function  getTimeSeriesDataAndLoad(cell,startEpoch,endEpoch){
        URL = "v1/canaryview/timeseries/" + dataHost + "/?cell="+cell+"&start=" + startEpoch + "&end=" + endEpoch;
        //showSpinner("spinnerswat");
        let currentSpinner = "spinner"+$("#canary-tabs .modern-tabs-nav-button.active").attr("data-tab-target");
                //showSpinner(currentSpinner);
        ProgressBar.start({container: currentSpinner, position: 'top',showIcon: true, iconStartPosition: 'top', icon: '🏄', splash:true }); // Rocket emoji});
        $.ajax({
            url: URL, success: function (result) {
                //hideSpinner("spinnerswat");
                ProgressBar.stop({ explode: true,celebrate: true});
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
                //hideSpinner("spinnerswat");
                ProgressBar.stop({ explode: true });
            }
        });
    }

    let extraHeadersHandled = false;
    let minTimeStamp = Number.MAX_VALUE;;
    let maxTimeStamp = 0;
    let instanceIndex = -1;
    function showCanaryTable(result,divId,type) {
        console.log("showCanaryTable " + type);
        canaryviewtable.SFDataTableClear();
        tableHeader = [];
        headerTypeMap = {};
        headerLableMap = {};
        headerExtraTypeMap = {};
        canaryviewtable.addContextTableHeader(tableHeader, "Cmt", -1, "");
        let canaryContextViewHeader = JSON.parse(JSON.stringify(canaryContextViewHeaderConfig));
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
            let title = "";
            if(tokens[3] != undefined){
                title = tokens[3];
            }
            if(instanceIndex == -1 && tokens[0] == "instance"){
                                instanceIndex = i;
                            }
            if(tokens[1] == "timestamp" || tokens[1] == "text" || tokens[1] == "url"){
                canaryviewtable.addContextTableHeader(tableHeader, headerLableMap[tokens[0]], -1, "", title);
                if(tokens[0] == "timestamp" && tokens[1] == "timestamp"  && (type == 1 || type==4)){
                    canaryviewtable.addContextTableHeader(tableHeader, "day", -1, "", "Day");
                }
            }else if(tokens[1] == "number" || tokens[1] == "numberc" || tokens[1] == "int"){
                canaryviewtable.addContextTableHeader(tableHeader, headerLableMap[tokens[0]], 1, "", title);
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
            //extraHeadersHandled=true;
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
            if (canaryCommentCounts != undefined && canaryCommentCounts[key] != undefined) {
                let arr = canaryCommentCounts[key].split(":");
                count = arr[0]
                color = arr[1];
            }
            //comment at first column
            canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span onclick='onComment(\"" + canaryContextArray[i].record[timeStampIndex] + "\",\"" + canaryContextArray[i].record[cellIndex] + "\")' style='cursor: pointer; color: " + color + ";'>" + count + " <i class=\"fa fa-comment-o\" aria-hidden=\"true\"></i></span>", "id='" + canaryContextArray[i].record[timeStampIndex] + canaryContextArray[i].record[cellIndex] + "'");
            let curTimestamp = undefined;
            for (let j = 0; j < canaryContextViewHeader.length; j++) {
                let tokens = canaryContextViewHeader[j].split(":");

                let val = canaryContextArray[i][tokens[0]];
                if (val != undefined) {
                    if (headerTypeMap[tokens[0]] == "timestamp") {
                        if(type == 2 || type == 3 || type == 4 || type == 1){
                            curTimestamp = val;
                            canaryviewtable.addContextTableRow(tableRows[rowIndex], moment.utc(val).format('YY-MM-DD HH:mm:ss'));

                            if(tokens[0] == "timestamp" && (type == 1 || type == 4) ){
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
                           //canaryviewtable.addContextTableRow(tableRows[rowIndex], val,"<span title='Click to see timeseries data' style='cursor: pointer;' onclick='getCellTimeSeriesData(\""+val+"\")'");
                           canaryviewtable.addContextTableRow(tableRows[rowIndex], val,"t='"+curTimestamp+"' i='"+instanceIndex+"' class='canary-menu-one'");
                           //canary-menu-one
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
        //$("#canaryviewtableSFDownloadtable").before('<a title="Download raw json data" id="jsonDownload" href="javascript:downloadJson()"><i style="font-size:18px;" class="fa fa-download" aria-hidden="true"></i>&nbsp;</a>');
        //$("#canaryviewtablepagination").after('<span id="timeseriesload"></span>');
        // Delay refreshData to ensure accordion is expanded and DOM is ready
        // The refreshData method will also wait for accordion visibility, but this gives extra time
        setTimeout(() => {
            if (window.genieAnalytics) {
                window.genieAnalytics.refreshData(true);
            }
        }, 200);
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