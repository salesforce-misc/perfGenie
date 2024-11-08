<script>
    /*
* Copyright (c) 2022, Salesforce.com, Inc.
* All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
* For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/
</script>
<div tabindex="-1" id="TSprofileID" class='ui-widget' style="padding-left: 0px;">
    <label>Profile: </label>
    <select  style="height:30px;text-align: center;" class="filterinput" name="event-type-tsview" id="event-type-tsview">

    </select>
    <label style='display:none'>Event: </label>
    <select  style="height:30px;text-align: center;display:none" class="filterinput"  name="event-input-tsview" id="event-input-tsview">

    </select>

    <label >Format: </label>
    <select  style="height:30px;text-align: center;" class="filterinput"  name="tsview-format-input" id="tsview-format-input">
        <option value=1>thread sample view</option>
    </select>
    <label title="group by tid will show all samples in a thread, others need a matching context">Group by: </label>
    <select style="height:30px;text-align: center;" class="filterinput" name="tsview-grp-by" id="tsview-grp-by">
    </select>
    <span id="mcontention" class="hide">
    <label>monitor-contention:</label>
    <input type="checkbox" id="monitorCheck" onclick="handleMonitorCheck()">
        <span id="tsviewNote"  style='color:darkorange'>
        </span>
    </span>
</div>

<div class="row">
<div style="padding: 0px !important;overflow: scroll"  id="tsviewtablecontext" class="ui-widget tsviewtable col-lg-12">
</div>
</div>
<div class="row">
    <div style="padding: 0px !important;overflow: scroll"  id="colorcodes" class="ui-widget colorcodes col-lg-12">
    </div>
</div>
<div class="row">
    <div class="col-lg-7">
        <div style="overflow: auto; padding-left: 0px;padding-right: 2px; width: 100%;" class="cct-customized-scrollbar">
            <div style="padding: 0px !important;"  id="tsviewtable" class="ui-widget tsviewtable col-lg-12">
            </div>
        </div>
    </div>
    <div style="padding-left: 0px !important;" id="quick-tsviewstack-view" class="col-lg-5">
        <a id="detail-tsviewstack-view-link" target="_blank"></a>
        <label id="stack-tsview-java-label-guid">Stack Trace</label>
        <pre class="small" style="max-height: 900px; min-height: 900px; overflow-y: scroll;" id="stack-tsview-guid" >
            Click on a sample to see the Java stack here...
        </pre>
    </div>
</div>

<style>
    .sampletoolbar {
        padding-bottom: 2px;
    }
</style>

<script>
    let tsviewtableFormat = 1;
    let tsviewtable = undefined;
    let tsviewtablePage = 0;
    let tsview_stack_id = undefined;
    let tsviewBy = 'tid';
    let tsviewCustomEvent = '';
    let tsviewgroupByLength = '';
    let tsviewgroupByMatch = '';
    let monitorCheck = false;

    function handleMonitorCheck() {
        if(document.getElementById("monitorCheck").checked == true){
            monitorCheck=true;
        }else{
            monitorCheck=false;
        }

        //get monitor context startTime1 +" - "+endTime1
        let localContextData = getContextData(1);
        let contextDataRecords = undefined;
        if (localContextData != undefined && localContextData.records != undefined) {
            contextDataRecords = localContextData.records["monitor-context"];
        }
        if(contextDataRecords != undefined) {
            updateProfilerViewTsview(getSelectedLevel(getContextTree(1, getEventType())), true);
        }else{
            getMonitorContext(startTime1 +" - "+endTime1, tenant1, host1, "monitor", 1);
        }
    }

    function resettsviewNote(msg) {
        $("#tsviewNote").html(msg);
    }
    function getMonitorContext(timeRange, tenant, host, customEvent, count) {
        const callTreeUrl = getEventUrl(timeRange, tenant, host, customEvent);
        if(otherEventsMaxAjaxTris[callTreeUrl] == undefined){
            otherEventsMaxAjaxTris[callTreeUrl] = 1;
        }else{
            otherEventsMaxAjaxTris[callTreeUrl]++;
        }
        if(otherEventsMaxAjaxTris[callTreeUrl] > 1){
            console.log("getOtherEvent already fetched count:" + count);
            return;
        }
        resettsviewNote("Fetching monitor context, this may take few minutes ...  <span style='float: right;' class='spinner' id='contentionspinner'></span>");
        showSpinner('contentionspinner');
        let toTenant = tenant;
        if(isS3 == "true") {
            toTenant = "";
        }
        let request = stackDigVizAjax(toTenant, "GET", callTreeUrl, function (response) { // success function
            console.log("getOtherEvent done count:" + count);
            if(response == undefined || response === "" || response.header == undefined) {
                console.log("Warn: unable to fetch other event" + customEvent);
                resettsviewNote("Failed to get monitor context.");
            }else {
                resettsviewNote("");
                setOtherEventData(response, count);
                updateProfilerViewTsview(getSelectedLevel(getContextTree(1, getEventType())), true);
            }
        }, function (error) {
            resettsviewNote("Failed to get monitor context.");
            console.log("Warn: unable to fetch monitor event " + customEvent);
        });
    }

    function updateTsviewEventInputOptions(id){
        $('#'+id).empty();

        /*
        let localContextData = getContextData(1);
        if (localContextData != undefined && localContextData.records != undefined) {
            let tsviewCustomEventFound = false;
            if(!(tsviewCustomEvent == '' || tsviewCustomEvent == undefined)) {
                for (let value in localContextData.records) {
                    if(tsviewCustomEvent == value){
                        tsviewCustomEventFound = true;
                        break;
                    }
                }
            }

            for (let value in localContextData.records) {
                if(tsviewCustomEvent == '' || tsviewCustomEvent == undefined || !tsviewCustomEventFound){
                    tsviewCustomEvent = value;
                    tsviewCustomEventFound=true;
                }
                $('#'+id).append($('<option>', {
                    value: value,
                    text: value,
                    selected: (tsviewCustomEvent == value)
                }));
            }
        }*/

        //filters are not applied, so we should use only customEvent everywhere
        samplesCustomEvent = customEvent;
        tsviewCustomEvent = customEvent;
        $('#'+id).append($('<option>', {
            value: tsviewCustomEvent,
            text: tsviewCustomEvent,
            selected: true
        }));

        $("#tsview-groupby-length").val(tsviewgroupByLength);
        $("#tsview-groupby-match").val(tsviewgroupByMatch);
    }

    function updateTsviewFormatOptions(id){
        $('#'+id).empty();
        $('#' + id).append($('<option>', {
            value: 1,
            text: "thread sample view",
            selected: (tsviewtableFormat == 1)
        }));
    }

    function updateTsviewGroupByOptions(id){
        $('#'+id).empty();
        let localContextData = getContextData(1);

        if (localContextData != undefined && localContextData.header != undefined) {
            let groups = [];
            for (let val in localContextData.header[tsviewCustomEvent]) {
                const tokens = localContextData.header[tsviewCustomEvent][val].split(":");
                if (tokens[1] == "text" || tokens[1] == "timestamp") {
                    groups.push(tokens[0]);
                }
            }
            groups.sort();

            let groupByFound = false;
            if(!(tsviewBy == '' || tsviewBy == undefined)) {
                for (let val in localContextData.header[tsviewCustomEvent]) {
                    const tokens = localContextData.header[tsviewCustomEvent][val].split(":");
                    if(tsviewBy == tokens[0]){
                        groupByFound = true;
                        break;
                    }
                }
            }

            if(fContext == 'without' || groups.length == 0){//without context supported only for tid
                $('#' + id).append($('<option>', {
                    value: 'tid',
                    text: 'tid',
                    selected: true
                }));
            }else {
                for (let i = 0; i < groups.length; i++) {
                    if ((tsviewBy == '' || tsviewBy == undefined || !groupByFound)) {
                        tsviewBy = groups[i];
                        groupByFound = true;
                    }
                    if (tsviewBy == groups[i]) {
                        $('#' + id).append($('<option>', {
                            value: groups[i],
                            text: groups[i],
                            selected: true
                        }));
                    } else {
                        $('#' + id).append($('<option>', {
                            value: groups[i],
                            text: groups[i]
                        }));
                    }
                }
            }
        }
    }

    $("#tsview-grp-by").on("change", (event) => {
        updateUrl("tsviewBy",$("#tsview-grp-by").val(),true);
        tsviewBy = $("#tsview-grp-by").val();
        gentsviewtable(false, undefined);
    });

    $("#event-input-tsview").on("change", (event) => {
        updateUrl("tsvcustomevent",$("#event-input-tsview").val(),true);
        tsviewCustomEvent = $("#event-input-tsview").val();
        updateProfilerViewTsview(getSelectedLevel(getContextTree(1,getEventType())),true);
    });

    $("#tsview-format-input").on("change", (event) => {

        updateUrl("tsviewtableFormat", $("#tsview-format-input").val(), true);
        tsviewtableFormat = $("#tsview-format-input").val();

        if(tsviewtableFormat == 1 || tsviewtableFormat == 0) {
            if($("#event-type-tsview option[value='All']").length ==0)
            {
                $('#event-type-tsview').append($('<option>', {
                    value: "All",
                    text: "All"
                }));
            }
        }

        updateProfilerViewTsview(getSelectedLevel(getContextTree(1,getEventType())),true);
    });

    $("#event-type-tsview").on("change", (event) => {
        if($("#event-type-tsview").val() == "All"){
            updateProfilerViewTsview(getSelectedLevel(getContextTree(1,getEventType())),true);
        }else {
            handleEventTypeChange($("#event-type-tsview").val());
        }
    });

    $("#tsview-groupby-match").on("change", (event) => {
        updateUrl("tsvgroupByMatch", $("#tsview-groupby-match").val(), true);
        tsviewgroupByMatch = $("#tsview-groupby-match").val();
        updateProfilerViewTsview(getSelectedLevel(getContextTree(1,getEventType())),true);
    });
    $("#tsview-groupby-length").on("change", (event) => {
        updateUrl("tsvgroupByLength", $("#tsview-groupby-length").val(), true);
        tsviewgroupByLength = $("#tsview-groupby-length").val();
        updateProfilerViewTsview(getSelectedLevel(getContextTree(1,getEventType())),true);
    });

    $(document).ready(function () {

        tsviewBy=urlParams.get('tsviewBy') || 'tid';
        tsviewtablePage=urlParams.get('spage') || '0';
        tsview_stack_id=urlParams.get('tsview_stack_id') || '';
        tsviewCustomEvent=urlParams.get('tsvcustomevent') || '';
        tsviewgroupByMatch = urlParams.get('tsvgroupByMatch') || '';
        tsviewgroupByLength = urlParams.get('tsvgroupByLength') || '200';
        tsviewtableFormat = urlParams.get('tsviewtableFormat') || '1';

        let filterType = tsviewBy;

        let str = "";
        document.getElementById("tsviewtable").innerHTML = str;

        updateTsviewEventInputOptions('event-input-tsview');

        updateTsviewGroupByOptions('tsview-grp-by');
        updateTsviewFormatOptions('tsview-format-input');
        //validateInputAndcreateContextTree(true);
    });


    
    function getTsviewTableHeader(groupByTsview, row, event) {

        let localContextData = getContextData(1);
        /*if(event === EventType.MEMORY) {
            totalSampleCount = totalSampleCount * 1024 * 1024;
            if(groupByTsview == "tid") {
                sfContextDataTable.addContextTableHeader(row,groupByTsview,1,"class='context-menu-two'");
            }else{
                sfContextDataTable.addContextTableHeader(row,groupByTsview,-1,"class='context-menu-two'");
            }
            sfContextDataTable.addContextTableHeader(row,"Memory Mb",1);
            sfContextDataTable.addContextTableHeader(row,"Samples",1);
        }else{*/
            if(groupByTsview == "tid") {
                sftsviewtable.addContextTableHeader(row,groupByTsview,1,"class='context-menu-three'",localContextData.tooltips[groupByTsview]);
            }else{
                sftsviewtable.addContextTableHeader(row,groupByTsview,-1,"class='context-menu-two'",localContextData.tooltips[groupByTsview]);
            }
            sftsviewtable.addContextTableHeader(row,"Sample Count",1);
            sftsviewtable.addContextTableHeader(row,"Samples",1);
        //}
    }

    let uniquecontentionTids = {};
    let uniquecontentionLockTimeStamps = {};
    let uniquecontentionLockTids = {};
    function identifyLockWaitTids(){
        let localContextData = getContextData(1);
        let contextDataRecords = undefined;
        if (localContextData != undefined && localContextData.records != undefined) {
            contextDataRecords = localContextData.records["monitor-context"];
        }
        if(contextDataRecords != undefined) {
            for (var tid in contextDataRecords) {
                contextDataRecords[tid].forEach(function (obj) {
                    let record = obj.record;
                    if (uniquecontentionTids[record[1]] == undefined) {
                        uniquecontentionTids[record[1]] = true;
                    }
                    if (uniquecontentionLockTids[record[1]] == undefined) {
                        uniquecontentionLockTids[record[1]] = true;
                        uniquecontentionLockTimeStamps[record[1]] = {};
                    }
                    if (uniquecontentionLockTimeStamps[record[1]][record[0]] == undefined) {
                        uniquecontentionLockTimeStamps[record[1]][record[0]] = true;
                    }

                    let list = [];
                    if(obj.record["8"] == "true"){
                        let arr = obj.record["9"].split("\n\nDeadlock");
                        list = eval(arr[0]);
                    }else {
                        list = eval(obj.record["9"]);
                    }
                    for (let i = 1; i < list.length; i = i + 2) {
                        if (uniquecontentionTids[list[i]] == undefined) {
                            uniquecontentionTids[list[i]] = true;
                        }
                    }
                });
            }
        }
    }

    let tsviewtableRows = [];
    let tsviewtableHeader = [];
    let moreTsviews = [];

    const sftsviewtable = new SFDataTable("sftsviewtable");
    Object.freeze(sftsviewtable);

    let tsviewSortMap = undefined;
    function gentsviewtable(addContext, level) {
        if($("#event-type-tsview").val() == "json-jstack") {//process all events
            $('#mcontention').show();
            if(document.getElementById("monitorCheck").checked == true){
                monitorCheck=true;
            }else{
                monitorCheck=false;
            }
        }else{
            monitorCheck=false;
            $('#mcontention').hide();
        }

        identifyLockWaitTids();
        if (tsviewtableFormat == 0) {
            tsviewtableFormat = 1;
        }
        let eventType = getEventType();
        let jfrprofilestart = 0;

        let tempeventTypeArray = [];
        for (var tempeventType in jfrprofiles1) {//for all profile event types
            tempeventTypeArray.push(tempeventType);
            if (jfrprofilestart == 0 && !(tempeventType == "Jstack" || tempeventType == "json-jstack") && getContextTree(1, tempeventType) != undefined) {
                jfrprofilestart = getContextTree(1, tempeventType).context.start;
            }
        }
        tempeventTypeArray.sort();

        let jstackdiff = 0;
        let jstactprofilestart = 0;
        let jstackEvent = getContextTree(1, "json-jstack") == undefined ?  "Jstack" : "json-jstack";
        if (getContextTree(1, jstackEvent) !== undefined) {
            jstackdiff = getContextTree(1, jstackEvent).context.start - jfrprofilestart;
            jstactprofilestart = getContextTree(1, jstackEvent).context.start;
        }

        let tidSamplesTimestamps = {};
        let dimIndexMap = {};
        let metricsIndexMap = {};
        let metricsIndexArray = [];
        let spanIndex = -1;
        let timestampIndex = -1;
        let tidRowIndex = -1;

        let sampleCountMap = new Map();
        tsviewSortMap = new Map();

        $('#stack-tsview-guid').text("");
        let start1 = performance.now();
        let groupByTsview = tsviewBy;
        tsviewtableHeader = [];
        tsviewtableRows = [];
        moreTsviews = [];

        if(fContext == 'without'){//context without supported only for tid, todo support thread name for jstacks
            groupByTsview = 'tid';
        }
        getTsviewTableHeader(groupByTsview, tsviewtableHeader, eventType);
        let totalSampleCount = getContextTree(1, eventType).tree.sz;
        let samplerowIndex = -1;

        if(addContext) {
            updateTsviewEventInputOptions('event-input-tsview');
            updateTsviewGroupByOptions('tsview-grp-by');
            updateTsviewFormatOptions('tsview-format-input');
        }

        let isAll = (fContext === 'all' || fContext === '');
        let isWith = (fContext === 'with');

        let localContextData = getContextData(1);
        //let table = "<table   style=\"width: 100%;\" id=\"sample-table\" class=\"table compact table-striped table-bordered  table-hover dataTable\"><thead><tr><th width=\"50%\">" + getHearderFor(groupByTsview) + "</th><th width=\"10%\">Sample Count</th><th width=\"40%\">Samples</th></thead>";
        for (let tempeventTypeCount = 0; tempeventTypeCount< tempeventTypeArray.length; tempeventTypeCount++){
            let eventSampleCount = 0;
            let isJstack = false;
            if($("#event-type-tsview").val() == "All"){//process all events
                eventType = tempeventTypeArray[tempeventTypeCount];
                applyContextFilters(eventType,level);
                addContext=true;
            }else if(tempeventTypeArray[tempeventTypeCount] != eventType){
                continue;
            }
            if (addContext) {
                addContextData(eventType, 1);
            }


            for (let val in localContextData.header[tsviewCustomEvent]) {
                const tokens = localContextData.header[tsviewCustomEvent][val].split(":");
                if (tokens[1] == "number") {
                    metricsIndexArray.push(val);
                    metricsIndexMap[tokens[0]] = val;
                }

                if ("tid" == tokens[0]) {
                    tidRowIndex = val;
                }

                if ("duration" == tokens[0] || "runTime" == tokens[0]) { // TODO: take from user
                    spanIndex = val;
                }
                if ("timestamp" == tokens[0]) { // TODO: take from user
                    timestampIndex = val;
                }
                if (tokens[1] == "text" || tokens[1] == "timestamp") {
                    dimIndexMap[tokens[0]] = val;
                }
            }
            if (localContextData == undefined) {
                //support only tid or tn
                if (!(groupByTsview === "threadname" || groupByTsview === "tid")) {
                    //set default tid
                    groupByTsview = "tid";
                    if (eventType == "Jstack" || eventType == "json-jstack") {
                        updateFilterViewStatus("Note: Failed to get Request context, only tid and threadName group by options supported.");
                    } else {
                        updateFilterViewStatus("Note: Failed to get Request context, only tid group by option supported.");
                    }
                }
            }
            let contextDataRecords = undefined;
            if (localContextData != undefined && localContextData.records != undefined) {
                contextDataRecords = localContextData.records[tsviewCustomEvent];
            }

            let tidDatalistVal = filterMap["tid"];

            if(getContextTree(1, eventType) == undefined){
                continue;
            }
            let contextTidMap = getContextTree(1, eventType).context.tidMap;
            let contextStart = getContextTree(1, eventType).context.start;

            if (eventType == "Jstack" || eventType == "json-jstack") {
                filteredStackMap[FilterLevel.LEVEL3] = {};
                isJstack=true;
            }
            //every sample of jstack has a tn
            let combinedEventKey = eventType + tsviewCustomEvent;
            if ((eventType == "Jstack" || eventType == "json-jstack") && groupByTsview == "threadname" && isFilterEmpty(dimIndexMap)) {
                //for (var tid in contextDataRecords) {
                for (var tid in contextTidMap) {
                    if (tidDatalistVal == undefined || tidDatalistVal == tid) {
                        for (let i = 0; i < contextTidMap[tid].length; i++) {
                            if ((pStart == '' || pEnd == '') || (contextTidMap[tid][i].time + contextStart) >= pStart && (contextTidMap[tid][i].time + contextStart) <= pEnd) {//apply time range filter
                                if (isAll || (isWith && contextTidMap[tid][i][customEvent]?.obj != undefined) || (!isWith && contextTidMap[tid][i][customEvent]?.obj == undefined)) {
                                    let stack = contextTidMap[tid][i].hash;
                                    if (frameFilterString == "" || (frameFilterStackMap[combinedEventKey] != undefined && frameFilterStackMap[combinedEventKey][stack] !== undefined)) {

                                        if (tidSamplesTimestamps[tid] == undefined) {
                                            tidSamplesTimestamps[tid] = [];
                                        }
                                        if (isJstack) {
                                            tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time + jstackdiff, jstackcolorsmap[contextTidMap[tid][i].ts], i, contextTidMap[tid][i][customEvent]?.obj[timestampIndex]]);
                                        } else {
                                            tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time, tempeventTypeCount, i, contextTidMap[tid][i][customEvent]?.obj[timestampIndex]]);
                                        }
                                        eventSampleCount++;

                                        if (tsviewtableFormat == 0) {
                                            let key = contextTidMap[tid][i].tn;
                                            //consider
                                            if (tsviewSortMap.has(key)) {
                                                tsviewSortMap.set(key, tsviewSortMap.get(key) + 1);
                                            } else {
                                                tsviewSortMap.set(key, 1);
                                            }

                                            if (sampleCountMap.has(key)) {
                                                let tmpMap = sampleCountMap.get(key);
                                                if (tmpMap.has(stack)) {
                                                    tmpMap.set(stack, tmpMap.get(stack) + 1);
                                                } else {
                                                    tmpMap.set(stack, 1);
                                                }
                                            } else {
                                                let tmpMap = new Map();
                                                tmpMap.set(stack, 1);
                                                sampleCountMap.set(key, tmpMap);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                //every sample will have a tid, so include all
            } else if (groupByTsview == "tid" && isFilterEmpty()) {
                //for (var tid in contextDataRecords) {
                for (var tid in contextTidMap) {
                    if(monitorCheck && uniquecontentionTids[tid] == undefined){
                        continue;
                    }
                    if (tidDatalistVal == undefined || tidDatalistVal == tid) {
                        for (let i = 0; i < contextTidMap[tid].length; i++) {
                            if ((pStart == '' || pEnd == '') || (contextTidMap[tid][i].time + contextStart) >= pStart && (contextTidMap[tid][i].time + contextStart) <= pEnd) {//apply time range filter
                                if (isAll || (isWith && contextTidMap[tid][i][customEvent]?.obj != undefined) || (!isWith && contextTidMap[tid][i][customEvent]?.obj == undefined)) {
                                    let stack = contextTidMap[tid][i].hash;
                                    if (frameFilterString == "" || (frameFilterStackMap[combinedEventKey] != undefined && frameFilterStackMap[combinedEventKey][stack] !== undefined)) {

                                        if (tidSamplesTimestamps[tid] == undefined) {
                                            tidSamplesTimestamps[tid] = [];
                                        }
                                        if (isJstack) {
                                            tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time + jstackdiff, jstackcolorsmap[contextTidMap[tid][i].ts], i, contextTidMap[tid][i][customEvent]?.obj[timestampIndex]]);
                                        } else {
                                            tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time, tempeventTypeCount, i, contextTidMap[tid][i][customEvent]?.obj[timestampIndex]]);
                                        }
                                        eventSampleCount++;
                                        if (tsviewtableFormat == 0) {
                                            let key = tid;
                                            if (tsviewSortMap.has(key)) {
                                                tsviewSortMap.set(key, tsviewSortMap.get(key) + 1);
                                            } else {
                                                tsviewSortMap.set(key, 1);
                                            }
                                            if (sampleCountMap.has(key)) {
                                                let tmpMap = sampleCountMap.get(key);
                                                if (tmpMap.has(stack)) {
                                                    tmpMap.set(stack, tmpMap.get(stack) + 1);
                                                } else {
                                                    tmpMap.set(stack, 1);
                                                }
                                            } else {
                                                let tmpMap = new Map();
                                                tmpMap.set(stack, 1);
                                                sampleCountMap.set(key, tmpMap);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                //if only frame filter is selected then we need to include stacks that are any stack sample and containing frame filter string
            } else if (frameFilterString !== "" && isFilterEmpty()) {
                //for (var tid in contextDataRecords) {
                for (var tid in contextTidMap) {
                    if (tidDatalistVal == undefined || tidDatalistVal == tid) {
                        for (let i = 0; i < contextTidMap[tid].length; i++) {
                            if ((pStart == '' || pEnd == '') || (contextTidMap[tid][i].time + contextStart) >= pStart && (contextTidMap[tid][i].time + contextStart) <= pEnd) {//apply time range filter
                                if (isAll || (isWith && contextTidMap[tid][i][customEvent]?.obj != undefined) || (!isWith && contextTidMap[tid][i][customEvent]?.obj == undefined)) {
                                    let stack = contextTidMap[tid][i].hash;
                                    if ((frameFilterStackMap[combinedEventKey] != undefined && frameFilterStackMap[combinedEventKey][stack] !== undefined)) {

                                        if (tidSamplesTimestamps[tid] == undefined) {
                                            tidSamplesTimestamps[tid] = [];
                                        }
                                        if (isJstack) {
                                            tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time + jstackdiff, jstackcolorsmap[contextTidMap[tid][i].ts], i, contextTidMap[tid][i][customEvent]?.obj[timestampIndex]]);
                                        } else {
                                            tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time, tempeventTypeCount, i, contextTidMap[tid][i][customEvent]?.obj[timestampIndex]]);
                                        }
                                        eventSampleCount++;
                                        if (tsviewtableFormat == 0) {
                                            let key = "";
                                            if (contextTidMap[tid][i][tsviewCustomEvent]?.obj != undefined) {
                                                key = contextTidMap[tid][i][tsviewCustomEvent].obj[dimIndexMap[groupByTsview]];
                                            } else {
                                                key = "stacks matched frame but no context match";
                                            }
                                            if (key != undefined && key.slice != undefined) {
                                                key = key.slice(0, tsviewgroupByLength);
                                            }
                                            //consider
                                            if (tsviewSortMap.has(key)) {
                                                tsviewSortMap.set(key, tsviewSortMap.get(key) + 1);
                                            } else {
                                                tsviewSortMap.set(key, 1);
                                            }
                                            if (sampleCountMap.has(key)) {
                                                let tmpMap = sampleCountMap.get(key);
                                                if (tmpMap.has(stack)) {
                                                    tmpMap.set(stack, tmpMap.get(stack) + 1);
                                                } else {
                                                    tmpMap.set(stack, 1);
                                                }
                                            } else {
                                                let tmpMap = new Map();
                                                tmpMap.set(stack, 1);
                                                sampleCountMap.set(key, tmpMap);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                if (localContextData != undefined && localContextData.records != undefined) {
                    if(isAll || isWith) {
                        for (var tid in contextDataRecords) {
                            if (tidDatalistVal == undefined || tidDatalistVal == tid) {
                                //context filter provided, check for matching requests and then find samples of those requests
                                contextDataRecords[tid].forEach(function (obj) {

                                    let record = obj.record;
                                    let flag = false;
                                    let recordSpan = record[spanIndex] == undefined ? 0 : record[spanIndex];

                                    if (filterMatch(record, dimIndexMap, timestampIndex, recordSpan)) {
                                        if (obj[combinedEventKey] != undefined) {
                                            flag = true;
                                            let key = record[dimIndexMap[groupByTsview]];
                                            if (key != undefined && key.slice != undefined) {
                                                key = key.slice(0, tsviewgroupByLength);
                                            }
                                            //check if request samples match frame filter string
                                            let cursampleCount = 0;
                                            for (let i = obj[combinedEventKey][0]; i <= obj[combinedEventKey][1]; i++) {
                                                if ((pStart === '' || pEnd === '') || ((contextTidMap[tid][i].time + contextStart) >= pStart && (contextTidMap[tid][i].time + contextStart) <= pEnd)) {
                                                    if (isAll || (isWith && contextTidMap[tid][i][customEvent]?.obj != undefined) || (!isWith && contextTidMap[tid][i][customEvent]?.obj == undefined)) {
                                                        let stack = contextTidMap[tid][i].hash;
                                                        //for (var stack in obj[combinedEventKey]) {
                                                        if (frameFilterString == "" || (frameFilterStackMap[combinedEventKey] != undefined && frameFilterStackMap[combinedEventKey][stack] !== undefined)) {

                                                            if (tidSamplesTimestamps[tid] == undefined) {
                                                                tidSamplesTimestamps[tid] = [];
                                                            }
                                                            if (isJstack) {
                                                                tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time + jstackdiff, jstackcolorsmap[contextTidMap[tid][i].ts], i, contextTidMap[tid][i][customEvent]?.obj[timestampIndex]]);
                                                            } else {
                                                                tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time, tempeventTypeCount, i, contextTidMap[tid][i][customEvent]?.obj[timestampIndex]]);
                                                            }
                                                            eventSampleCount++;

                                                            cursampleCount++;

                                                            if (tsviewtableFormat == 0) {
                                                                if (sampleCountMap.has(key)) {
                                                                    let tmpMap = sampleCountMap.get(key);
                                                                    if (tmpMap.has(stack)) {
                                                                        tmpMap.set(stack, tmpMap.get(stack) + 1);
                                                                    } else {
                                                                        tmpMap.set(stack, 1);
                                                                    }
                                                                } else {
                                                                    let tmpMap = new Map();
                                                                    tmpMap.set(stack, 1);
                                                                    sampleCountMap.set(key, tmpMap);
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            if (tsviewtableFormat == 0) {
                                                if (cursampleCount != 0) {
                                                    if (tsviewSortMap.has(key)) {
                                                        tsviewSortMap.set(key, tsviewSortMap.get(key) + cursampleCount);
                                                    } else {
                                                        tsviewSortMap.set(key, cursampleCount);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                });
                            }
                        }
                    }else{
                        for (var tid in contextTidMap) {
                            if (tidDatalistVal == undefined || tidDatalistVal == tid) {
                                for (let i = 0; i < contextTidMap[tid].length; i++) {
                                    if ((pStart == '' || pEnd == '') || (contextTidMap[tid][i].time + contextStart) >= pStart && (contextTidMap[tid][i].time + contextStart) <= pEnd) {//apply time range filter
                                        if (isAll || (isWith && contextTidMap[tid][i][customEvent]?.obj != undefined) || (!isWith && contextTidMap[tid][i][customEvent]?.obj == undefined)) {
                                            let stack = contextTidMap[tid][i].hash;
                                            if (frameFilterString == "" || (frameFilterStackMap[combinedEventKey] != undefined && frameFilterStackMap[combinedEventKey][stack] !== undefined)) {

                                                if (tidSamplesTimestamps[tid] == undefined) {
                                                    tidSamplesTimestamps[tid] = [];
                                                }
                                                if (isJstack) {
                                                    tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time + jstackdiff, jstackcolorsmap[contextTidMap[tid][i].ts], i, contextTidMap[tid][i][customEvent]?.obj[timestampIndex]]);
                                                } else {
                                                    tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time, tempeventTypeCount, i, contextTidMap[tid][i][customEvent]?.obj[timestampIndex]]);
                                                }
                                                eventSampleCount++;
                                                if (tsviewtableFormat == 0) {
                                                    let key = tid;
                                                    if (tsviewSortMap.has(key)) {
                                                        tsviewSortMap.set(key, tsviewSortMap.get(key) + 1);
                                                    } else {
                                                        tsviewSortMap.set(key, 1);
                                                    }
                                                    if (sampleCountMap.has(key)) {
                                                        let tmpMap = sampleCountMap.get(key);
                                                        if (tmpMap.has(stack)) {
                                                            tmpMap.set(stack, tmpMap.get(stack) + 1);
                                                        } else {
                                                            tmpMap.set(stack, 1);
                                                        }
                                                    } else {
                                                        let tmpMap = new Map();
                                                        tmpMap.set(stack, 1);
                                                        sampleCountMap.set(key, tmpMap);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    if (eventType == "Jstack" || eventType == "json-jstack") {
                        updateFilterViewStatus("Note: Failed to get Request context, only tid and threadName group by options supported.");
                    } else {
                        updateFilterViewStatus("Note: Failed to get Request context, only tid group by option supported.");
                    }
                }
            }
            console.log("count " + eventType +":"+eventSampleCount + ":"+jfrprofilestart+":"+jstactprofilestart);
        }

        let start = performance.now();
        $("#tsviewtablecontext").html("");
        if (tsviewtableFormat == 1) {
            $('#extraoptions').hide();
            $("#tsviewtablecontext").css({"height":''});
            $('#stack-tsview-guid').text("");
            $('#stack-tsview-java-label-guid').text("Stack Trace");
            prevTsviewReqCellObj = undefined;
            prevTsviewReqCellSid = undefined;
            prevTsviewReqCellTime = undefined;

            let matchedTidCount = 0;
            let tidSamplesCountMap = new Map(); //sort tid based on number of samples
            for (var tid in tidSamplesTimestamps) {
                tidSamplesCountMap.set(tid, tidSamplesTimestamps[tid].length);
                tidSamplesTimestamps[tid].sort((a, b) => a[0] - b[0]);
                matchedTidCount++;
            }
            tidSamplesCountMap = new Map([...tidSamplesCountMap.entries()].sort((a, b) => b[1] - a[1]));
            let isJstack = false;
            if((getEventType() == "Jstack" || getEventType() == "json-jstack") && $("#event-type-tsview").val() != "All"){
                isJstack = true;
            }
            let top = 75;
            if(matchedTidCount < top){
                top = matchedTidCount+15;
            }else if(isJstack){
                top = matchedTidCount + 15;
            }
            let uniquetimestamps = generateTimestamseries(tidSamplesTimestamps,tidSamplesCountMap, top);
            $("#tsviewtable").html("");

            //tsviewtable
            let cellh = 8;
            let cellw = 4;
            let x = 20;
            let y = 10;

            if(isJstack) {
                cellh = 8;
                cellw = 8;
                $("#colorcodes").html("");
                d3.select("#colorcodes").append("svg").attr("width", 1000).attr("height", 25);
                let colorcodesSvg = d3.select('#colorcodes').select("svg");
                let tmpx = 15;
                let tmpy = 10;
                for (var state in jstackcolorsmap) {
                    colorcodesSvg.append("rect")
                        .attr("width", 10)
                        .attr("height", 10)
                        .attr("x", tmpx)
                        .attr("y", tmpy)
                        .attr("fill", getTsviewSampleColor(jstackcolorsmap[state]));
                    colorcodesSvg.append("text")
                        .text(state)
                        .attr("x", tmpx + 11)
                        .style("font-size", "10px")
                        .attr("y", tmpy + 10);

                    tmpx += (state.length * 8 + 20);
                }
            }else{
                $("#colorcodes").html("");
            }


            document.getElementById("tsviewtable").innerHTML = "<div class='row col-lg-12' style='padding: 0px !important;'>"
                + "<div  style='width: 7%;float: left;'></div>"
                + "<div style=\"max-height: 50px;overflow: hidden;width: 93%;float: right;\">"
                + " <div class='row col-lg-12' style='padding: 0px !important;'>"
                + "   <div class='xaxisidTsview col-lg-12' id='xaxisidTsview' style=\"padding: 0px !important; max-height: 50px;overflow: scroll;overflow-y: hidden;\" onscroll='OnScroll1Samples(this)'>"
                + "   </div>"
                + " </div>"
                + "</div>"
                + "</div>"
                + "<div class='row col-lg-12' style='padding: 0px !important;'>"
                + " <div  id='yaxisidTsview' style=\"max-height: " + (top + 2) * cellh + "px;overflow: scroll;overflow-x: hidden;width: 7%;float: left;\" class='yaxisidTsview' onscroll='OnScroll0Samples(this)'></div>"
                + " <div id='requestbarchartTsviewwrapper' style=\"max-height: " + (top + 2) * cellh + "px;overflow: hidden;width: 93%;float: right;\">"
                + "    <div class='row col-lg-12' style='padding: 0px !important;'>"
                + "      <div class='requestbarchartTsview col-lg-12' onscroll='OnScroll2Samples(this)' style=\"padding: 0px !important; height: " + (top + 2) * cellh + "px;max-height: " + (top + 2) * cellh + "px;overflow: auto;\" id='requestbarchartTsview'>"
                + "      </div>"
                + "    </div>"
                + " </div>"
                + "</div><div>Note: Top " + (top-15) + " threads sorted by number of samples</div>";

            d3.select("#requestbarchartTsview").append("svg").attr("width", (maxTsviewThreadSamples *cellw)+37).attr("height", (top+2)*cellh);
            d3.select("#yaxisidTsview").append("svg").attr("width", 50).attr("height", (top+2)*cellh);
            d3.select("#xaxisidTsview").append("svg").attr("width",  (maxTsviewThreadSamples *cellw)+37).attr("height", 10);

            let d3yaxis = d3.select('#yaxisidTsview').select("svg");
            let d3xaxis = d3.select('#xaxisidTsview').select("svg");
            let d3svg = d3.select("#requestbarchartTsview").select("svg");

            let layer1 = d3svg.append('g');
            let layer2 = d3svg.append('g');
            let count = 0;
            let minTimeStamp = 0;
            let maxTimeStamp = 0;

            let xinterval = 80;
            let intervalcount = 0;
            for (let [timestamp, check] of uniquetimestamps) {
                if((intervalcount % xinterval) == 0) {
                    d3xaxis.append("text")
                        .text(moment.utc(jfrprofilestart+timestamp).format('HH:mm:ss'))//moment.utc(d * downScale + contextStart).format('MM-DD HH:mm:ss');
                        .attr("x", intervalcount + x)
                        .style("font-size", "10px")
                        .attr("y", 10);
                }
                intervalcount++;
            }

            for (let [tid, value] of tidSamplesCountMap) {
                if (count < top) {
                    count++;

                    d3yaxis.append("text")
                        .text(tid)
                        .attr("x", 15)
                        .style("font-size", cellh+"px")
                        .attr("y", y+cellh);

                    layer1.append('line')
                        .style('stroke-dasharray', [2,1])
                        .style('stroke', '#E2E2E2')
                        .attr('x1', x)
                        .attr('y1', y+cellh/2 )
                        .attr('x2', maxTsviewThreadSamples*cellh)
                        .attr('y2', y+cellh/2);

                    let i = 0;
                    //console.log("total len:" + tidSamplesTimestamps[tid].length);
                    let dupCount = 0;
                    let prevx = -1;
                    let lastx = -1;
                    let prevt = -1;
                    for (let [timestamp, check] of uniquetimestamps) {


                        if (i < tidSamplesTimestamps[tid].length) {
                            if (check == -1) {
                                //put a dash rect
                            } else if (timestamp == tidSamplesTimestamps[tid][i][0]) {
                                if(minTimeStamp == 0){
                                    minTimeStamp = timestamp;
                                }
                                if(timestamp > maxTimeStamp) {
                                    maxTimeStamp = timestamp;
                                }
                                //put color rect
                                //handle duplicates
                                if(timestamp == tidSamplesTimestamps[tid][i][0]) {

                                    layer2.append("rect")
                                        .attr("width", cellw)
                                        .attr("height", cellh)
                                        .attr("x", x)
                                        .attr("y", y)
                                        .attr("e", tidSamplesTimestamps[tid][i][1])
                                        .attr("t", tid)
                                        .attr("in", tidSamplesTimestamps[tid][i][2])
                                        .attr("class", " tgl")
                                        .attr("onclick", 'showSVGTsviewStack(evt)')
                                        .attr("fill", getTsviewSampleColor(tidSamplesTimestamps[tid][i][1]));

                                    if(monitorCheck && uniquecontentionLockTids[tid] != undefined && uniquecontentionLockTimeStamps[tid][tidSamplesTimestamps[tid][i][0]] != undefined){
                                        layer2.append("rect")
                                            .attr("width", cellw-5)
                                            .attr("height", cellh-5)
                                            .attr("x", x+2.5)
                                            .attr("y", y+2.5)
                                            .attr("e", tidSamplesTimestamps[tid][i][1])
                                            .attr("t", tid)
                                            .attr("in", tidSamplesTimestamps[tid][i][2])
                                            .attr("class", " tgl")
                                            .attr("onclick", 'showSVGTsviewStack(evt)')
                                            .attr("fill", "white");
                                    }

                                    if(prevx == -1){
                                        if (tidSamplesTimestamps[tid][i][3] != undefined) {
                                            lastx = x;
                                            prevx = x;
                                        }
                                    }else {
                                        if (tidSamplesTimestamps[tid][i][3] == undefined) {
                                            if ((prevx - lastx) > 1) {
                                                layer1.append('line')
                                                    .style('stroke-width', 0.5)
                                                    .style('stroke', 'red')
                                                    .attr('skip', true)
                                                    .attr('x1', lastx)
                                                    .attr('y1', y+cellh/2)
                                                    .attr('x2', prevx+cellw)
                                                    .style("opacity",0.5)
                                                    .attr('y2', y+cellh/2);
                                            }
                                            prevx=-1;
                                        } else if (tidSamplesTimestamps[tid][i][3] != undefined && prevt != tidSamplesTimestamps[tid][i][3]) {
                                            //draw line
                                            if ((prevx - lastx) > 1) {
                                                layer1.append('line')
                                                    .style('stroke-width', 0.5)
                                                    .style('stroke', 'red')
                                                    .attr('skip', true)
                                                    .attr('x1', lastx)
                                                    .attr('y1', y+cellh/2)
                                                    .attr('x2', prevx+cellw)
                                                    .attr('y2', y+cellh/2)
                                                    .style("opacity",0.5);
                                            }
                                            lastx = x;
                                        }else if (tidSamplesTimestamps[tid][i][3] != undefined) {
                                            prevx = x;
                                        }
                                    }
                                    prevt = tidSamplesTimestamps[tid][i][3];

                                    i++;

                                }
                                while(i < tidSamplesTimestamps[tid].length && timestamp == tidSamplesTimestamps[tid][i][0]) {
                                    i++;
                                    dupCount++;
                                }
                            }
                        } else {
                            //put a whitc rect
                        }
                        x += cellw;
                    }

                    //console.log("matched len:" + i + " dup:"+dupCount);
                    x = 20;
                    y += cellh;
                }
            }
            let requiredWidth = (uniquetimestamps.size*cellw+37 > 500)? uniquetimestamps.size*cellw+37 : 500;
            d3svg.style('width',requiredWidth);
            if(y > 700){
                y = 700;
            }
            $("#yaxisidTsview").css({"max-height":y});
            $("#requestbarchartTsviewwrapper").css({"max-height":y+30});
            $("#requestbarchartTsview").css({"max-height":y+30});
        } else {
            $('#extraoptions').show();
            $("#tsviewtablecontext").css({"height":''});
            //sort based on number of stacks
            for (let [key, value] of sampleCountMap) {
                sampleCountMap.set(key, new Map([...value.entries()].sort((a, b) => b[1] - a[1])));
            }

            tsviewSortMap = new Map([...tsviewSortMap.entries()].sort((a, b) => b[1] - a[1]));


            let end1 = performance.now();
            console.log("gentsviewtable 0 time:" + (end1 - start1))

            let order = 1;

            moreTsviews = {};
            for (let [key, value] of tsviewSortMap) {

                if ((tsviewgroupByMatch != '' && key.includes != undefined && !key.includes(tsviewgroupByMatch))) {
                    continue;
                }

                let str = "";
                let more = "";
                let morec = 0;
                let skipc = 0;
                let count = 0;
                let order = 0;
                samplerowIndex++;

                for (let [key1, value1] of sampleCountMap.get(key)) {
                    if (count < 8) {
                        if (order == 0) {
                            order = value1;
                        }
                        str = str + "<div style=\" cursor: pointer;\" data-ga-category=\"samples-table\" data-ga-action=\"show-stack\" id=\"+ key1 + \" class=\"send-ga stack-badge badge badge-secondary  stack" + key1 + "\" onclick=\"showTsviewSampleStack('" + key1 + "');\">" + (100 * value1 / value).toFixed(2) + "%, " + value1 + "</div> &nbsp;";
                    } else {
                        if (morec < 25) {
                            morec++;
                            more = more + "<div style=\"display: none; cursor: pointer; \"   class=\"stack-badge badge badge-secondary  stack" + key1 + " hidden-stacks-" + hashCode(key) + "\" onclick=\"showTsviewSampleStack('" + key1 + "');\">" + (100 * value1 / value).toFixed(2) + "%, " + value1 + "</div>&nbsp;";
                        } else {
                            skipc++;
                        }
                    }
                    count++;
                }
                if (morec != 0) {
                    moreTsviews[key] = more;
                    str += '<div style="cursor: pointer;" class="badge badge-primary more-stacks-' + hashCode(key) + '" onclick="showTsviewHiddenStacks(\'' + hashCode(key) + '\');"> +' + (morec + skipc) + ' more</div>';
                    str += '<div style="cursor: pointer; display: none;" class="badge badge-primary less-stacks-' + hashCode(key) + '" onclick="hideTsviewHiddenStacks(\'' + hashCode(key) + '\');"> << </div> ';
                    str += more;
                    str += '<div style="cursor: pointer; display: none;" class="badge badge-primary less-stacks-' + hashCode(key) + '" onclick="hideTsviewHiddenStacks(\'' + hashCode(key) + '\');"> -' + morec + ' less</div> ';
                    if (skipc != 0) {
                        str += "<div style=\"display: none;\"   class=\"stack-badge badge " + " hidden-stacks-" + hashCode(key) + "\"\">" + skipc + " more</div>";
                    }
                }
                tsviewtableRows[samplerowIndex] = [];
                /*if(eventType == EventType.MEMORY) {
                    addContextTableRow(tsviewtableRows[samplerowIndex], ("<label style=\"word-wrap: break-word; width: 300px\" >" + (key == undefined ? "NA" : key) + "</label>"), "hint='"+groupByTsview+"'");
                    addContextTableOrderRow(tsviewtableRows[samplerowIndex], ("<b>" + (value / (1024 * 1024)).toFixed(3) + "</b>&nbsp;<div class=\"badge badge-info\"> " + (100 * value / totalSampleCount).toFixed(3) + "</div>"), value);
                    addContextTableOrderRow(tsviewtableRows[samplerowIndex], str, order);
                }else{*/

                //"id='"+Number(dim) + "_dummy'"
                if (groupByTsview == "tid") {
                    sftsviewtable.addContextTableRow(tsviewtableRows[samplerowIndex], ("<div style=\"cursor: pointer; word-wrap: break-word;\" >" + (key == undefined ? "NA" : key) + "</div>"), "id='" + key + "_dummy'" + " hint='" + groupByTsview + "'");
                } else {
                    sftsviewtable.addContextTableRow(tsviewtableRows[samplerowIndex], ("<div style=\"cursor: pointer; word-wrap: break-word;\" >" + (key == undefined ? "NA" : key) + "</div>"), "hint='" + groupByTsview + "'");
                }
                sftsviewtable.addContextTableOrderRow(tsviewtableRows[samplerowIndex], ("<div class=\"badge badge-info\"><span style='font-size: 12px; color:black'>" + value + "</span> " + (100 * value / totalSampleCount).toFixed(3) + "%</div>"), value);
                sftsviewtable.addContextTableOrderRow(tsviewtableRows[samplerowIndex], str, order);

                // }
                //table = table + "<tr><td  hint=" + groupByTsview + " class=\"context-menu-two\"><label style=\"word-wrap: break-word; width: 300px\" >" + (key == undefined ? "NA" : key) + "</label></td><td data-order="+value+"><b>" +value+"</b>&nbsp;<div class=\"badge badge-info\"> "+ (100*value/totalSampleCount).toFixed(3) + "</div></td><td data-order="+order+">" + str + "</td></tr>";
            }

            sftsviewtable.SFDataTable(tsviewtableRows, tsviewtableHeader, "tsviewtable", order);

        }

        if(addContext) {
            updateTsviewEventInputOptions('event-input-tsview');
            updateTsviewGroupByOptions('tsview-grp-by');
            updateTsviewFormatOptions('tsview-format-input');

            if(tsview_stack_id != '' && tsviewtableFormat == 0){
                showTsviewSampleStack(tsview_stack_id);
            }
        }

        let end = performance.now();
        console.log("gentsviewtable 1 time:" + (end - start) )
    }

    function OnScroll0Samples(div) {
        var d2 = document.getElementById("requestbarchartTsview");
        d2.scrollTop = div.scrollTop;
    }

    function OnScroll1Samples(div) {
        var d2 = document.getElementById("requestbarchartTsview");
        d2.scrollLeft = div.scrollLeft;
    }

    function OnScroll2Samples(div) {
        var d1 = document.getElementById("xaxisidTsview");
        var d0 = document.getElementById("yaxisidTsview");
        d0.scrollTop = div.scrollTop;
        d1.scrollLeft = div.scrollLeft;
    }


    var TooltipTSV = undefined;
    var mouseoverSVGSamples = function (key, obj) {
        if (d3.select(obj).attr("style") == undefined || !d3.select(obj).attr("style").includes("opacity: 0")) {

            //TooltipTSV.style("opacity", 1);

            d3.select(obj)
                .style("stroke", "black")
                .style("cursor", "pointer");
        }
    }

    var mousemoveSVGSamples = function (d, key, obj, metricVal) {
        if (d3.select(obj).attr("style") == undefined || !d3.select(obj).attr("style").includes("opacity: 0")) {
            /*TooltipTSV
                .html(d + ", " + metricVal + '<br>Click to see request profile samples and context')
                .style("left", (d3.mouse(obj)[0] + 20) + "px")
                .style("top", (d3.mouse(obj)[1]) + "px");*/
        }
    }

    var mouseleaveSVGSamples = function (key, obj) {
        if (d3.select(obj).attr("style") == undefined || !d3.select(obj).attr("style").includes("opacity: 0")) {
            //TooltipTSV.style("opacity", 0);
            d3.select(obj)
                .style("stroke", "none")
                .style("cursor", "default");
        }
    }

    let prevTsviewReqCellObj = undefined;
    let prevTsviewReqCellSid = undefined;
    let prevTsviewReqCellTime = undefined;
    const sfTsviewcontextTable = new SFDataTable("tsviewtablecontext");
    Object.freeze(sfTsviewcontextTable);

    function showTsviewContextTable(record, event) {
        let rowIndex = 0;
        tsviewtableHeader = [];
        tsviewtableRows = [];
        if(customEvent == undefined || customEvent == ""){
            return; //no context available for this.
        }
        getContextTableHeadernew("", tsviewtableHeader, customEvent, false);
        tsviewtableRows[rowIndex] = [];
        if(record.length == 0){
            sfTsviewcontextTable.addContextTableRow(tsviewtableRows[rowIndex], "no context available");
        }else {
            for (let field in record) {
                if (field == 1) {
                    sfTsviewcontextTable.addContextTableRow(tsviewtableRows[rowIndex], moment.utc(record[field]).format('YYYY-MM-DD HH:mm:ss SSS'));
                } else {
                    sfTsviewcontextTable.addContextTableRow(tsviewtableRows[rowIndex], record[field]);
                }
            }
        }
        sfTsviewcontextTable.SFDataTable(tsviewtableRows, tsviewtableHeader, "tsviewtablecontext", undefined, false);
    }

    function showSVGTsviewStack(obj) {
        document.getElementById('TSprofileID').focus();
        let tempeventTypeArray = [];
        let jevent = "json-jstack";
        for (var tempeventType in jfrprofiles1) {//for all profile event types
            tempeventTypeArray.push(tempeventType);
            if(tempeventType == "Jstack"){
                jevent = "Jstack";
            }
        }
        tempeventTypeArray.sort();

        let pid = obj.target.getAttribute("t");
        let eventType = ""
        if(obj.target.getAttribute("e") > 8){
            eventType = jevent;
        }else {
            eventType = tempeventTypeArray[obj.target.getAttribute("e")];
        }

        let index = obj.target.getAttribute("in");

        if(contextTree1[eventType].context.tidMap[pid][index][customEvent] != undefined && contextTree1[eventType].context.tidMap[pid][index][customEvent].obj != undefined){
            showTsviewContextTable(contextTree1[eventType].context.tidMap[pid][index][customEvent].obj, eventType);
        }else{
            if($("#tsviewtablecontext").height() != 0) {
                $("#tsviewtablecontext").css("height", $("#tsviewtablecontext").height());
            }
            showTsviewContextTable([], eventType);
        }

        let stackid = contextTree1[eventType].context.tidMap[pid][index].hash;

        if(prevTsviewReqCellObj != undefined) {
            prevTsviewReqCellObj.classList.remove('stackCells');
        }
        prevTsviewReqCellObj = obj.target;
        prevTsviewReqCellSid = stackid;
        prevTsviewReqCellTime = contextTree1[eventType].context.tidMap[pid][index].time + contextTree1[eventType].context.start;
        prevTsviewReqCellObj.classList.add('stackCells');

        updateUrl("tsview_stack_id",stackid,true);
        tsview_stack_id=stackid;
        if(contextTree1[eventType].context.tidMap[pid][index].tn != undefined){
            $('#stack-tsview-java-label-guid').text("Stack Trace at " + moment.utc(prevTsviewReqCellTime).format('YYYY-MM-DD HH:mm:ss.SSS') + " tid:" + pid +" tn:" + contextTree1[eventType].context.tidMap[pid][index].tn);
        }else {
            $('#stack-tsview-java-label-guid').text("Stack Trace at " + moment.utc(prevTsviewReqCellTime).format('YYYY-MM-DD HH:mm:ss.SSS'));
        }
        let blockedStack = "";
        if(jstackidcolorsmap[obj.target.getAttribute("e")] == "BLOCKED"){
            blockedStack = getBlockedThreadStack(prevTsviewReqCellTime,eventType, pid);
        }
        $('#stack-tsview-guid').text(getStackTrace(stackid, eventType,obj.target.getAttribute("e"), prevTsviewReqCellTime) +"\n\n" + blockedStack);
    }

    function getBlockedThreadStack(timestamp, eventType, waittid){
        let localContextData = getContextData(1);
        let contextDataRecords = undefined;
        if (localContextData != undefined && localContextData.records != undefined) {
            contextDataRecords = localContextData.records["monitor-context"];
        }
        let blockedTid = "";
        let lockContext = "";
        if(contextDataRecords != undefined) {
            for (var tid in contextDataRecords) {
                let found = false;
                //contextDataRecords[tid].forEach(function (obj) {
                for(let i =0;i<contextDataRecords[tid].length; i++) {
                    let record = contextDataRecords[tid][i].record;
                    //TODO need to fix for prod already parsed jstacks, timestamp is not matching
                    let diff = Math.abs(timestamp - record["0"]);
                    if (record["0"] == timestamp || diff < 5000) { //5 sec diff
                        let list = [];
                        if (record["8"] == "true") {
                            let arr = record["9"].split("\n\nDeadlock");
                            list = eval(arr[0]);
                        } else {
                            list = eval(record["9"]);
                        }
                        for (let i = 1; i < list.length; i = i + 2) {
                            if (waittid == list[i]) {
                                blockedTid = tid;//todo break this loop
                                found=true;
                                lockContext = lockContext + "lock:" + record["3"] + " object:"+record["4"] + "\nframe got lock:"+record["5"];
                                break;
                            }
                        }
                    }
                }
                if(found){
                    break;
                }
                //});
            }
            let stackTrace = "";
            if(blockedTid != "") {
                let contextArr = contextTree1[eventType].context.tidMap[blockedTid];
                for (let i = 0; i < contextArr.length; i++) {
                    if (contextArr[i].time + contextTree1[eventType].context.start == timestamp) {
                        stackTrace = "Blocked by tid: " + blockedTid + " tn: " + contextArr[i].tn + "\n" + lockContext + "\n\n" + getStackTrace(contextArr[i].hash, eventType, jstackcolorsmap[contextArr[i].ts], timestamp);
                        break;
                    }
                }
            }
            return stackTrace;
        }
        return "monitor-context not available to show locked thread";
    }

    function getTsviewSampleColor(id){
        return profilecolors[id];
    }

    let maxTsviewThreadSamples=0;
    let minTsviewThreadSamplesTimeStamp = 0;
    let maxTsviewThreadSamplesTimeStamp = 0;
    function generateTimestamseries(tidSamplesTimestamps,tidSamplesCountMap, top){

        let tmpTimestampap = new Map();
        let timestampArray = [];

        let start = performance.now();

        //generate unique timestamp array
        let count = 0;
        for (let [tid, value] of tidSamplesCountMap) {
            if (count < top) {
                count++;
                for (let i = 0; i < tidSamplesTimestamps[tid].length; i++) {
                    if (!tmpTimestampap.hasOwnProperty(tidSamplesTimestamps[tid][i][0])) {
                        tmpTimestampap.set(tidSamplesTimestamps[tid][i][0], true);
                        timestampArray.push(tidSamplesTimestamps[tid][i][0]);
                    }
                }
            }
        }
        timestampArray.sort(function (a, b) {
            return a - b
        });
        let prev = timestampArray[0];
        count = 0;
        for(let i = 0; i<timestampArray.length; i++){
            if((timestampArray[i]-prev) > 60000){
                tmpTimestampap.set(Math.round((timestampArray[i]+prev)/2),-1);
                count++;
            }
            tmpTimestampap.set(timestampArray[i], i);
            prev = timestampArray[i];
            count++;
        }
        let end = performance.now();
        console.log("generateTimestamseries time :" + (end - start));
        maxTsviewThreadSamples = count;
        minTsviewThreadSamplesTimeStamp = timestampArray[0];
        maxTsviewThreadSamplesTimeStamp = timestampArray[timestampArray.length-1];
        console.log("unique timestamps length:" + timestampArray.length);
        tmpTimestampap = new Map([...tmpTimestampap.entries()].sort((a, b) => a[0] - b[0]));
        return tmpTimestampap;
    }


    function showTsviewHiddenStacks(guid) {
        $(".more-stacks-" + guid).css("display", "none");
        $(".less-stacks-" + guid).css("display", "");
        $(".hidden-stacks-" + guid).css("display", "");
    }

    function hideTsviewHiddenStacks(guid) {
        $(".more-stacks-" + guid).css("display", "");
        $(".less-stacks-" + guid).css("display", "none");
        $(".hidden-stacks-" + guid).css("display", "none");
    }

    function getTsviewEventOfStackID(id){
        for (var profile in jfrprofiles1) {
            let tree = getContextTree(1,profile);
            if(tree != undefined && tree.tree != undefined && tree.tree.sm[id] != undefined){
                return profile;
            }
        }
        return getEventType();//default
    }

    function showTsviewSampleStack(stackid) {
        updateUrl("tsview_stack_id",stackid,true);
        tsview_stack_id=stackid;
        $('#stack-tsview-guid').text(getStackTrace(stackid,getTsviewEventOfStackID(stackid)));
        $('.stack-badge').removeClass("badge-warning");
        $(".stack"+stackid).addClass("badge-warning");
    }

    //create html tree recursively
    let prevTsviewSampleProfile = undefined;
    function updateProfilerViewTsview(level, skipFilter) {
        addTabNote(false,"");
        let eventType = getEventType();

        let contextData = getContextData(1);
        if(contextData == undefined) {
            if(compareTree){
                addTabNote(true,"This view is not supported when Compare option is selected.")
            }else{
                addTabNote(true,"Context data not available to show this view");
            }
            console.log("updateProfilerViewTsview skip:" + level);
            return false;
        }

        updateTsviewEventInputOptions('event-input-tsview');
        updateTsviewGroupByOptions('tsview-grp-by');
        updateTsviewFormatOptions('tsview-format-input');

        if(skipFilter == undefined){
            skipFilter = false;
        }

        showTimelineView(false);

        if(!skipFilter) {

            if (level == undefined) {
                level = FilterLevel.LEVEL1;
            }

            let start = performance.now();
            if (!filterToLevel(level)) {
                let end = performance.now();
                console.log("filterToLevel time:" + (end - start));
                return;
            }
            let end = performance.now();
            console.log("filterToLevel time:" + (end - start));


            let treeToProcess = getActiveTree(eventType, isCalltree);
            let selectedLevel = getSelectedLevel(getActiveTree(eventType, false));

            if (prevTsviewSampleProfile != "All" && prevCustomEvent === customEvent && currentLoadedTree === treeToProcess && prevOption === currentOption && isRefresh === false && isLevelRefresh === false && prevSelectedLevel === selectedLevel) {
                console.log("no change in sample table, option:" + (prevCustomEvent == customEvent) + ":" + (currentLoadedTree === treeToProcess)+":"+ (prevOption === currentOption) +" isRefresh:"+(isRefresh === false)+":"+" isLevelRefresh:"+(isLevelRefresh === false)+" selectedLevel:"+ (prevSelectedLevel === selectedLevel));
                end = performance.now();
                console.log("updateProfilerViewTsview 1 time:" + (end - start));
                return;
            }else{
                console.log("change in sample table, option:" + prevTsviewSampleProfile +":"+ (prevCustomEvent == customEvent) + ":" + (currentLoadedTree === treeToProcess)+":"+ (prevOption === currentOption) +" isRefresh:"+(isRefresh === false)+":"+" isLevelRefresh:"+(isLevelRefresh === false)+" selectedLevel:"+ (prevSelectedLevel === selectedLevel));
            }
            currentLoadedTree = treeToProcess;
            prevOption = currentOption;
            prevCustomEvent = customEvent;
            prevSelectedLevel = selectedLevel;
            isLevelRefresh = false;
            isRefresh = false;
            prevTsviewSampleProfile = $("#event-type-tsview").val();

            // if no data returned from our call don't try to parse it
            if (treeToProcess === undefined) {
                end = performance.now();
                console.log("updateProfilerViewTsview 2 time:" + (end - start));
                return;
            }

            resetTreeHeader("");

            gentsviewtable(true, level);

            end = performance.now();
            console.log("updateProfilerViewTsview 3 time:" + (end - start));
        }else{
            prevTsviewSampleProfile = $("#event-type-tsview").val();

            let start = performance.now();

            resetTreeHeader("");

            gentsviewtable(true, level);

            let end = performance.now();
            console.log("updateProfilerViewTsview 4 time:" + (end - start));

            if(!isFilterOnType){
                addTabNote(true,getContextHintNote(true,customEvent));
            }
        }
    }

    function hashCode(str) { // java String#hashCode
        if (str === undefined || str === null) {
            str = "";
        }
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return hash;
    }

    function prepData(event){
        let profile = getContextTree(1, event);
        if(profile.prep != undefined && profile.prep == true){
            end = performance.now();
            console.log("prepData skip for:" + event);
            return;//done only once
        }

        let start = performance.now();

        let tidMap = profile.context.tidMap;

        //generate unique timestamp array
        for (var k in tidMap) {
            for (let i = 0; i < tidMap[k].length; i++) {
                if (timestampArray.indexOf(tidMap[k][i].time) === -1) {
                    timestampArray.push(tidMap[k][i].time);
                }
            }
        }
        timestampArray.sort(function (a, b) {
            return a - b
        });

        profile.prep = true;
        end = performance.now();
        console.log("prepData time :" + (end - start));
    }
</script>