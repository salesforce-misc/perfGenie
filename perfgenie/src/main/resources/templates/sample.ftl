<script>
    /*
* Copyright (c) 2022, Salesforce.com, Inc.
* All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
* For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/
</script>
<div class='ui-widget' style="padding-left: 0px;">
    <label>Profile: </label>
    <select  style="height:30px;text-align: center;" class="filterinput" name="event-type-sample" id="event-type-sample">

    </select>
    <label style='display:none'>Event: </label>
    <select  style="height:30px;text-align: center;display:none" class="filterinput"  name="event-input-smpl" id="event-input-smpl">

    </select>

    <label >Format: </label>
    <select  style="height:30px;text-align: center;" class="filterinput"  name="sample-format-input" id="sample-format-input">
        <option selected value=0>table</option>
        <option value=1>thread sample view</option>
    </select>

    <label  >Group by: </label>
    <select  style="height:30px;text-align: center;" class="filterinput"  name="smpl-grp-by" id="smpl-grp-by">

    </select>

    <span title="Consider first N characters of group by option values">Len:</span><input  style="height:30px;width:35px;text-align: left;" class="filterinput" id="samples-groupby-length" type="text" value="">
    <span title="Sub string match with group by option values">Match:</span><input  style="height:30px;width:120px;text-align: left;" class="filterinput" id="samples-groupby-match" type="text" value="">

</div>

<div class="row">
<div style="padding: 0px !important;overflow: scroll"  id="sampletablecontext" class="ui-widget sampletable col-lg-12">
</div>
</div>

<div class="row">
    <div class="col-lg-7">
        <div style="overflow: auto; padding-left: 0px; width: 100%;" class="cct-customized-scrollbar">
            <div style="padding: 0px !important;"  id="sampletable" class="ui-widget sampletable col-lg-12">
            </div>
        </div>
    </div>
    <div style="padding-left: 0px !important;" id="quick-stack-view" class="col-lg-5">
        <a id="detail-stack-view-link" target="_blank"></a>
        <label id="stack-view-java-label-guid" for="stack-view-guid" >Stack Trace</label>
        <pre class="small" style="max-height: 900px; min-height: 900px; overflow-y: scroll;" id="stack-view-guid" >
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
    let sampleTable = undefined;
    let sampleTablePage = 0;
    let stack_id = undefined;
    let smplBy = 'tid';
    let samplesCustomEvent = '';
    let samplesgroupByLength = '';
    let samplesgroupByMatch = '';
    function updateEventInputOptions(id){
        $('#'+id).empty();


        /*if (contextData != undefined && contextData.records != undefined) {
            let samplesCustomEventFound = false;
            if(!(samplesCustomEvent == '' || samplesCustomEvent == undefined)) {
                for (let value in contextData.records) {
                    if(samplesCustomEvent == value){
                        samplesCustomEventFound = true;
                        break;
                    }
                }
            }

            for (let value in contextData.records) {
                if(samplesCustomEvent == '' || samplesCustomEvent == undefined || !samplesCustomEventFound){
                    samplesCustomEvent = value;
                    samplesCustomEventFound=true;
                }
                $('#'+id).append($('<option>', {
                    value: value,
                    text: value,
                    selected: (samplesCustomEvent == value)
                }));
            }
        }*/

        //filters are not applied, so we should use only customEvent everywhere
        samplesCustomEvent = customEvent;
        $('#'+id).append($('<option>', {
            value: samplesCustomEvent,
            text: samplesCustomEvent,
            selected: true
        }));

        $("#samples-groupby-length").val(samplesgroupByLength);
        $("#samples-groupby-match").val(samplesgroupByMatch);
    }

    function updateGroupByOptions(id){
        $('#'+id).empty();
        if (contextData != undefined && contextData.header != undefined) {
            let groups = [];
            for (let val in contextData.header[samplesCustomEvent]) {
                const tokens = contextData.header[samplesCustomEvent][val].split(":");
                if (tokens[1] == "text" || tokens[1] == "timestamp") {
                    groups.push(tokens[0]);
                }
            }
            groups.sort();

            let groupByFound = false;
            if(!(smplBy == '' || smplBy == undefined)) {
                for (let val in contextData.header[samplesCustomEvent]) {
                    const tokens = contextData.header[samplesCustomEvent][val].split(":");
                    if(smplBy == tokens[0]){
                        groupByFound = true;
                        break;
                    }
                }
            }

            for (let i = 0; i < groups.length; i++) {
                if ((smplBy == '' || smplBy == undefined || !groupByFound)) {
                    smplBy = groups[i];
                    groupByFound = true;
                }
                if (smplBy == groups[i]) {
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

    $("#smpl-grp-by").on("change", (event) => {
        updateUrl("smplBy",$("#smpl-grp-by").val(),true);
        smplBy = $("#smpl-grp-by").val();
        genSampleTable(false, undefined);
    });

    $("#event-input-smpl").on("change", (event) => {
        updateUrl("scustomevent",$("#event-input-smpl").val(),true);
        samplesCustomEvent = $("#event-input-smpl").val();
        updateProfilerViewSample(getSelectedLevel(getContextTree(1,getEventType())),true);
    });

    $("#sample-format-input").on("change", (event) => {
        updateUrl("tableFormat", $("#sample-format-input").val(), true);
        sampletableFormat = $("#sample-format-input").val();

        if(sampletableFormat == 1 || sampletableFormat == 0) {
            if($("#event-type-sample option[value='All']").length ==0)
            {
                $('#event-type-sample').append($('<option>', {
                    value: "All",
                    text: "All"
                }));
            }
        }

        updateProfilerViewSample(getSelectedLevel(getContextTree(1,getEventType())),true);
    });

    $("#event-type-sample").on("change", (event) => {
        if($("#event-type-sample").val() == "All"){
            updateProfilerViewSample(getSelectedLevel(getContextTree(1,getEventType())),true);
        }else {
            handleEventTypeChange($("#event-type-sample").val());
        }
    });

    $("#samples-groupby-match").on("change", (event) => {
        updateUrl("sgroupByMatch", $("#samples-groupby-match").val(), true);
        samplesgroupByMatch = $("#samples-groupby-match").val();
        updateProfilerViewSample(getSelectedLevel(getContextTree(1,getEventType())),true);
    });
    $("#samples-groupby-length").on("change", (event) => {
        updateUrl("sgroupByLength", $("#samples-groupby-length").val(), true);
        samplesgroupByLength = $("#samples-groupby-length").val();
        updateProfilerViewSample(getSelectedLevel(getContextTree(1,getEventType())),true);
    });

    $(document).ready(function () {

        smplBy=urlParams.get('smplBy') || 'tid';
        sampleTablePage=urlParams.get('spage') || '0';
        stack_id=urlParams.get('stack_id') || '';
        samplesCustomEvent=urlParams.get('scustomevent') || '';
        samplesgroupByMatch = urlParams.get('sgroupByMatch') || '';
        samplesgroupByLength = urlParams.get('sgroupByLength') || '200';

        let filterType = smplBy;

        let str = "<table   style=\"width: 100%;\" id=\"sample-table\" class=\"table compact table-striped table-bordered  table-hover dataTable\"><thead><tr><th width=\"50%\">" + getHearderFor(filterType) + "</th><th width=\"10%\">Sample Count</th><th width=\"40%\">Samples</th></thead>";
        str = str + "</table>";
        document.getElementById("sampletable").innerHTML = str;
        $('#sample-table').DataTable({
            "order": [[1, "desc"]],
            searching: false,
            "columnDefs": [{
                "targets": 0,
                "orderable": false
            }],
            "sDom": '<"sampletoolbar">frtip'
        });

        updateEventInputOptions('event-input-smpl');

        updateGroupByOptions('smpl-grp-by');
        //validateInputAndcreateContextTree(true);
    });


    let eventTypeMaxThreadSamples={};
    function prepSamplesData(eventType){
        let profile = getContextTree(1, eventType);
        if(profile.times != undefined){
            end = performance.now();
            console.log("prepData skip for:" + eventType);
            return;//done only once
        }
        let tmpTimestampap = {};
        let timestampArray = [];

        let start = performance.now();

        let tidMap = profile.context.tidMap;

        //generate unique timestamp array
        for (var k in tidMap) {
            for (let i = 0; i < tidMap[k].length; i++) {
                if(tmpTimestampap[tidMap[k][i].time] == undefined) {
                    tmpTimestampap[tidMap[k][i].time] = true;
                    timestampArray.push(tidMap[k][i].time);
                }
            }
        }
        timestampArray.sort(function (a, b) {
            return a - b
        });
        let prev = timestampArray[0];
        let count = 0;
        for(let i = 0; i<timestampArray.length; i++){
            if((timestampArray[i]-prev) > 60000){
                tmpTimestampap[Math.round((timestampArray[i]+prev)/2)] = -1;
                count++;
            }
            tmpTimestampap[timestampArray[i]] = i;
            prev = timestampArray[i];
            count++;
        }
        eventTypeMaxThreadSamples[eventType]=count;

        profile.times = tmpTimestampap;
        end = performance.now();
        console.log("prepSamplesData time :" + (end - start));
    }

    //add context data for all request matching samples
    function addContextData(event){
        //prepSamplesData(event);
        let contextTidMap = undefined;
        let treeToProcess = getContextTree(1,event);
        let contextData = getContextData();
        if(contextData == undefined || treeToProcess[samplesCustomEvent + event+"-context"] != undefined) {
            console.log("addContextData skip:" + samplesCustomEvent + event);
            return false;
        }

        let contextStart = treeToProcess.context.start;
        contextTidMap = treeToProcess.context.tidMap;

        //sort records based on time, do we really need? move to jmc code?
        if(contextData != undefined && contextData.records != undefined){
            for (var customevent in contextData.records) {
                for(var tid in contextData.records[customevent]) {
                    //sort by timestamp
                    contextData.records[customevent][tid].sort(function (a, b) {
                        return a.record[0] - b.record[0];
                    });
                }
            }
        }

        let start = performance.now();
        let scount=0;
        let reqCount=0;

        let dimIndexMap = {};
        let metricsIndexMap = {};
        let metricsIndexArray = [];
        let spanIndex = -1;
        let timestampIndex=-1;
        let tidRowIndex = -1;

        for (let val in contextData.header[samplesCustomEvent]) {
            const tokens = contextData.header[samplesCustomEvent][val].split(":");
            if (tokens[1] == "number") {
                metricsIndexArray.push(val);
                metricsIndexMap[tokens[0]]=val;
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

        let contextDataRecords = undefined;
        if (contextData != undefined && contextData.records != undefined) {
            contextDataRecords = contextData.records[samplesCustomEvent];
        }

        let combinedEventKey = event+samplesCustomEvent;
        let combinedEventKeyn = event+"-"+samplesCustomEvent;
        for(var tid in contextDataRecords) {
            contextDataRecords[tid].forEach(function (obj) {
                let record = obj.record;
                let flag = false;
                if (contextTidMap[tid] != undefined) {
                    flag = true;
                }
                if (flag) {
                    let end = record[timestampIndex] - contextStart + record[spanIndex];
                    let start =  record[timestampIndex] - contextStart;

                    //let stackMap = {};
                    try {
                        //do a binary search
                        let entryIndex = isinRequest(contextTidMap[tid], start, end);
                        if (entryIndex != -1) {
                            let minIndex = entryIndex;
                            let maxIndex = entryIndex;
                            let requestArr = contextTidMap[tid];
                            let curIndex = entryIndex;
                            //consider all matching samples downward
                            while (curIndex >= 0 && requestArr[curIndex].time >= start && requestArr[curIndex].time <= end) {
                                //if (stackMap[requestArr[curIndex].hash] !== undefined) {
                                //    stackMap[requestArr[curIndex].hash] = stackMap[requestArr[curIndex].hash] + 1;
                                //} else {
                                //    stackMap[requestArr[curIndex].hash] = 1;
                                //}
                                //requestArr[curIndex].obj = record;
                                if(requestArr[curIndex][samplesCustomEvent] == undefined){
                                    requestArr[curIndex][samplesCustomEvent]={};
                                }
                                requestArr[curIndex][samplesCustomEvent].obj = record;
                                if(curIndex < minIndex){
                                    curIndex = curIndex;
                                }
                                scount++;
                                curIndex--;
                            }
                            curIndex = entryIndex + 1;
                            //consider all matching samples upward
                            while (curIndex < requestArr.length && requestArr[curIndex].time >= start && requestArr[curIndex].time <= end) {
                                //if (stackMap[requestArr[curIndex].hash] !== undefined) {
                                //    stackMap[requestArr[curIndex].hash] = stackMap[requestArr[curIndex].hash] + 1;
                                //} else {
                                //    stackMap[requestArr[curIndex].hash] = 1;
                                //}
                                //requestArr[curIndex].obj = record;
                                if(requestArr[curIndex][samplesCustomEvent] == undefined){
                                    requestArr[curIndex][samplesCustomEvent]={};
                                }
                                requestArr[curIndex][samplesCustomEvent].obj = record;
                                if(curIndex > maxIndex){
                                    maxIndex = curIndex;
                                }
                                scount++;
                                curIndex++;
                            }
                            reqCount++;
                            //obj[combinedEventKeyn] = stackMap;
                            obj[combinedEventKey] = [minIndex, maxIndex];
                        }
                    } catch (err) {
                        console.log("tid not found in JFR" + tid + " " + err.message);
                    }
                }
            });
        }

        if(event == "Jstack" || event == "json-jstack"){
            addContextDataJstack(event);
        }

        treeToProcess[samplesCustomEvent + event+"-context"] = "done";
        let end = performance.now();
        console.log("addContextData time:" + (end - start) + ":" + samplesCustomEvent + ":" + event + ":" +scount+":"+reqCount);
        return true;
    }

    function getSamplesTableHeader(groupBySamples, row, event) {

        /*if(event === EventType.MEMORY) {
            totalSampleCount = totalSampleCount * 1024 * 1024;
            if(groupBySamples == "tid") {
                sfContextDataTable.addContextTableHeader(row,groupBySamples,1,"class='context-menu-two'");
            }else{
                sfContextDataTable.addContextTableHeader(row,groupBySamples,-1,"class='context-menu-two'");
            }
            sfContextDataTable.addContextTableHeader(row,"Memory Mb",1);
            sfContextDataTable.addContextTableHeader(row,"Samples",1);
        }else{*/
            if(groupBySamples == "tid") {
                sfSampleTable.addContextTableHeader(row,groupBySamples,1,"class='context-menu-three'",contextData.tooltips[groupBySamples]);
            }else{
                sfSampleTable.addContextTableHeader(row,groupBySamples,-1,"class='context-menu-two'",contextData.tooltips[groupBySamples]);
            }
            sfSampleTable.addContextTableHeader(row,"Sample Count",1);
            sfSampleTable.addContextTableHeader(row,"Samples",1);
        //}
    }

    let sampleTableRows = [];
    let sampleTableHeader = [];
    let moreSamples = [];

    const sfSampleTable = new SFDataTable("sfSampleTable");
    Object.freeze(sfSampleTable);

    let sampleSortMap = undefined;
    function genSampleTable(addContext, level) {

        let eventType = getEventType();

        let tempeventTypeArray = [];
        for (var tempeventType in jfrprofiles1) {//for all profile event types
            tempeventTypeArray.push(tempeventType);
        }
        tempeventTypeArray.sort();

        let tidSamplesTimestamps = {};
        let dimIndexMap = {};
        let metricsIndexMap = {};
        let metricsIndexArray = [];
        let spanIndex = -1;
        let timestampIndex = -1;
        let tidRowIndex = -1;

        let sampleCountMap = new Map();
        sampleSortMap = new Map();

        $('#stack-view-guid').text("");
        let start1 = performance.now();
        let groupBySamples = smplBy;
        sampleTableHeader = [];
        sampleTableRows = [];
        moreSamples = [];
        getSamplesTableHeader(groupBySamples, sampleTableHeader, eventType);
        let totalSampleCount = getContextTree(1, eventType).tree.sz;
        let samplerowIndex = -1;

        if(addContext) {
            updateEventInputOptions('event-input-smpl');
            updateGroupByOptions('smpl-grp-by');
        }

        let table = "<table   style=\"width: 100%;\" id=\"sample-table\" class=\"table compact table-striped table-bordered  table-hover dataTable\"><thead><tr><th width=\"50%\">" + getHearderFor(groupBySamples) + "</th><th width=\"10%\">Sample Count</th><th width=\"40%\">Samples</th></thead>";

        for (let tempeventTypeCount = 0; tempeventTypeCount< tempeventTypeArray.length; tempeventTypeCount++){
            let eventSampleCount = 0;
            let isJstack = false;
            if($("#event-type-sample").val() == "All"){//process all events
                eventType = tempeventTypeArray[tempeventTypeCount];
                applyContextFilters(eventType,level);
                addContext=true;
            }else if(tempeventTypeArray[tempeventTypeCount] != eventType){
                continue;
            }

            if (addContext) {
                addContextData(eventType);
            }

            for (let val in contextData.header[samplesCustomEvent]) {
                const tokens = contextData.header[samplesCustomEvent][val].split(":");
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


            if (contextData == undefined) {
                //support only tid or tn
                if (!(groupBySamples === "threadname" || groupBySamples === "tid")) {
                    //set default tid
                    groupBySamples = "tid";
                    if (eventType == "Jstack" || eventType == "json-jstack") {
                        updateFilterViewStatus("Note: Failed to get Request context, only tid and threadName group by options supported.");
                    } else {
                        updateFilterViewStatus("Note: Failed to get Request context, only tid group by option supported.");
                    }
                }
            }

            let contextDataRecords = undefined;
            if (contextData != undefined && contextData.records != undefined) {
                contextDataRecords = contextData.records[samplesCustomEvent];
            }

            let tidDatalistVal = filterMap["tid"];

            let contextTidMap = getContextTree(1, eventType).context.tidMap;
            let contextStart = getContextTree(1, eventType).context.start;

            if (eventType == "Jstack" || eventType == "json-jstack") {
                filteredStackMap[FilterLevel.LEVEL3] = {};
                isJstack=true;
            }

            //every sample of jstack has a tn
            let combinedEventKey = eventType + samplesCustomEvent;
            if ((eventType == "Jstack" || eventType == "json-jstack") && groupBySamples == "threadname" && isFilterEmpty(dimIndexMap)) {
                for (var tid in contextDataRecords) {
                    if (contextTidMap[tid] != undefined && (tidDatalistVal == undefined || tidDatalistVal == tid)) {
                        for (let i = 0; i < contextTidMap[tid].length; i++) {
                            if ((pStart == '' || pEnd == '') || (contextTidMap[tid][i].time + contextStart) >= pStart && (contextTidMap[tid][i].time + contextStart) <= pEnd) {//apply time range filter
                                let stack = contextTidMap[tid][i].hash;
                                if (frameFilterString == "" || (frameFilterStackMap[combinedEventKey] != undefined && frameFilterStackMap[combinedEventKey][stack] !== undefined)) {

                                    if (tidSamplesTimestamps[tid] == undefined) {
                                        tidSamplesTimestamps[tid] = [];
                                    }
                                    if(isJstack){
                                        tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time, jstackcolorsmap[contextTidMap[tid][i].ts], i]);
                                    }else {
                                        tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time, tempeventTypeCount, i]);
                                    }
                                    eventSampleCount++;

                                    let key = contextTidMap[tid][i].tn;
                                    //consider
                                    if (sampleSortMap.has(key)) {
                                        sampleSortMap.set(key, sampleSortMap.get(key) + 1);
                                    } else {
                                        sampleSortMap.set(key, 1);
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
                //every sample will have a tid, so include all
            } else if (groupBySamples == "tid" && isFilterEmpty()) {
                for (var tid in contextDataRecords) {
                    if (contextTidMap[tid] != undefined && (tidDatalistVal == undefined || tidDatalistVal == tid)) {
                        for (let i = 0; i < contextTidMap[tid].length; i++) {
                            if ((pStart == '' || pEnd == '') || (contextTidMap[tid][i].time + contextStart) >= pStart && (contextTidMap[tid][i].time + contextStart) <= pEnd) {//apply time range filter
                                let stack = contextTidMap[tid][i].hash;
                                if (frameFilterString == "" || (frameFilterStackMap[combinedEventKey] != undefined && frameFilterStackMap[combinedEventKey][stack] !== undefined)) {

                                    if (tidSamplesTimestamps[tid] == undefined) {
                                        tidSamplesTimestamps[tid] = [];
                                    }
                                    if(isJstack){
                                        tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time, jstackcolorsmap[contextTidMap[tid][i].ts], i]);
                                    }else {
                                        tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time, tempeventTypeCount, i]);
                                    }
                                    eventSampleCount++;

                                    let key = tid;
                                    if (sampleSortMap.has(key)) {
                                        sampleSortMap.set(key, sampleSortMap.get(key) + 1);
                                    } else {
                                        sampleSortMap.set(key, 1);
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
                //if only frame filter is selected then we need to include stacks that are any stack sample and containing frame filter string
            } else if (frameFilterString !== "" && isFilterEmpty()) {
                if (spanIndex == -1) { // record duration span not available
                    //Context hints cannot be applied, apply only time range filter and tid, threadname filter
                    isFilterOnType = false;
                    let threadNameTidMap = {};
                    if (dimIndexMap["threadname"] != undefined && (filterMap["threadname"] != undefined || groupBySamples == "threadname")) {
                        for (var tid in contextDataRecords) {
                            if ((tidDatalistVal == undefined || tidDatalistVal == tid) && contextTidMap[tid] != undefined) {

                                //contextDataRecords[tid].forEach(function (obj) {
                                if (contextDataRecords[tid][0].record != undefined && contextDataRecords[tid][0].record[dimIndexMap["threadname"]] != undefined) {
                                    threadNameTidMap[tid] = contextDataRecords[tid][0].record[dimIndexMap["threadname"]];
                                }
                                //});
                            }
                        }
                    }
                    for (var tid in contextDataRecords) {
                        if ((tidDatalistVal == undefined || tidDatalistVal == tid) && contextTidMap[tid] != undefined) {
                            if (dimIndexMap["threadname"] == undefined || filterMap["threadname"] == undefined || (threadNameTidMap[tid].includes(filterMap["threadname"]))) {
                                for (let i = 0; i < contextTidMap[tid].length; i++) {
                                    if ((pStart === '' || pEnd === '') || ((contextTidMap[tid][i].time + contextStart) >= pStart && (contextTidMap[tid][i].time + contextStart) <= pEnd)) {
                                        let stack = contextTidMap[tid][i].hash;
                                        if (frameFilterString == "" || (frameFilterStackMap[combinedEventKey] != undefined && frameFilterStackMap[combinedEventKey][stack] !== undefined)) {
                                            let key = "";
                                            if (groupBySamples === "tid") {
                                                key = tid;
                                            } else if (groupBySamples === "threadname") {
                                                key = threadNameTidMap[tid].slice(0, samplesgroupByLength);
                                                //key = threadNameTidMap[tid];
                                            } else {
                                                if (contextTidMap[tid][i][samplesCustomEvent]?.obj != undefined) {
                                                    key = contextTidMap[tid][i][samplesCustomEvent].obj[dimIndexMap[groupBySamples]];
                                                } else {
                                                    key = "stacks matched frame but no context match";
                                                }
                                            }

                                            //consider
                                            if (sampleSortMap.has(key)) {
                                                sampleSortMap.set(key, sampleSortMap.get(key) + 1);
                                            } else {
                                                sampleSortMap.set(key, 1);
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
                } else {
                    for (var tid in contextDataRecords) {
                        if (contextTidMap[tid] != undefined && (tidDatalistVal == undefined || tidDatalistVal == tid)) {
                            for (let i = 0; i < contextTidMap[tid].length; i++) {
                                if ((pStart == '' || pEnd == '') || (contextTidMap[tid][i].time + contextStart) >= pStart && (contextTidMap[tid][i].time + contextStart) <= pEnd) {//apply time range filter
                                    let stack = contextTidMap[tid][i].hash;
                                    if ((frameFilterStackMap[combinedEventKey] != undefined && frameFilterStackMap[combinedEventKey][stack] !== undefined)) {

                                        if (tidSamplesTimestamps[tid] == undefined) {
                                            tidSamplesTimestamps[tid] = [];
                                        }
                                        if(isJstack){
                                            tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time, jstackcolorsmap[contextTidMap[tid][i].ts], i]);
                                        }else {
                                            tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time, tempeventTypeCount, i]);
                                        }
                                        eventSampleCount++;

                                        let key = "";
                                        if (contextTidMap[tid][i][samplesCustomEvent]?.obj != undefined) {
                                            key = contextTidMap[tid][i][samplesCustomEvent].obj[dimIndexMap[groupBySamples]];
                                        } else {
                                            key = "stacks matched frame but no context match";
                                        }
                                        if (key != undefined && key.slice != undefined) {
                                            key = key.slice(0, samplesgroupByLength);
                                        }
                                        //consider
                                        if (sampleSortMap.has(key)) {
                                            sampleSortMap.set(key, sampleSortMap.get(key) + 1);
                                        } else {
                                            sampleSortMap.set(key, 1);
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
            } else {
                if (spanIndex == -1) { // record duration span not available
                    //Context hints cannot be applied, apply only time range filter and tid, threadname filter
                    isFilterOnType = false;
                    let threadNameTidMap = {};
                    if (dimIndexMap["threadname"] != undefined && (filterMap["threadname"] != undefined || groupBySamples == "threadname")) {
                        for (var tid in contextDataRecords) {
                            if ((tidDatalistVal == undefined || tidDatalistVal == tid) && contextTidMap[tid] != undefined) {

                                //contextDataRecords[tid].forEach(function (obj) {
                                if (contextDataRecords[tid][0].record != undefined && contextDataRecords[tid][0].record[dimIndexMap["threadname"]] != undefined) {
                                    threadNameTidMap[tid] = contextDataRecords[tid][0].record[dimIndexMap["threadname"]];
                                }
                                //});
                            }
                        }
                    }
                    for (var tid in contextDataRecords) {
                        if ((tidDatalistVal == undefined || tidDatalistVal == tid) && contextTidMap[tid] != undefined) {
                            if (dimIndexMap["threadname"] == undefined || filterMap["threadname"] == undefined || (threadNameTidMap[tid].includes(filterMap["threadname"]))) {
                                for (let i = 0; i < contextTidMap[tid].length; i++) {
                                    if ((pStart === '' || pEnd === '') || ((contextTidMap[tid][i].time + contextStart) >= pStart && (contextTidMap[tid][i].time + contextStart) <= pEnd)) {
                                        let stack = contextTidMap[tid][i].hash;
                                        if (frameFilterString == "" || (frameFilterStackMap[combinedEventKey] != undefined && frameFilterStackMap[combinedEventKey][stack] !== undefined)) {
                                            let key = "";
                                            if (groupBySamples === "tid") {
                                                key = tid;
                                            } else if (groupBySamples === "threadname") {
                                                key = threadNameTidMap[tid];
                                            } else {
                                                if (contextTidMap[tid][i][samplesCustomEvent]?.obj != undefined) {
                                                    key = contextTidMap[tid][i][samplesCustomEvent].obj[dimIndexMap[groupBySamples]];
                                                } else {
                                                    key = "NA";
                                                }
                                            }
                                            if (key != undefined && key.slice != undefined) {
                                                key = key.slice(0, samplesgroupByLength);
                                            }

                                            //consider
                                            if (sampleSortMap.has(key)) {
                                                sampleSortMap.set(key, sampleSortMap.get(key) + 1);
                                            } else {
                                                sampleSortMap.set(key, 1);
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
                } else {
                    if (contextData != undefined && contextData.records != undefined) {
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
                                            //TODO: we are including all the samples in a matching request, some of them may not be part of timerange filter
                                            let key = record[dimIndexMap[groupBySamples]];
                                            if (key != undefined && key.slice != undefined) {
                                                key = key.slice(0, samplesgroupByLength);
                                            }

                                            //check if request samples match frame filter string
                                            let cursampleCount = 0;
                                            for (let i = obj[combinedEventKey][0]; i <= obj[combinedEventKey][1]; i++) {
                                                if ((pStart === '' || pEnd === '') || ((contextTidMap[tid][i].time + contextStart) >= pStart && (contextTidMap[tid][i].time + contextStart) <= pEnd)) {
                                                    let stack = contextTidMap[tid][i].hash;
                                                    //for (var stack in obj[combinedEventKey]) {
                                                    if (frameFilterString == "" || (frameFilterStackMap[combinedEventKey] != undefined && frameFilterStackMap[combinedEventKey][stack] !== undefined)) {

                                                        if (tidSamplesTimestamps[tid] == undefined) {
                                                            tidSamplesTimestamps[tid] = [];
                                                        }
                                                        if(isJstack){
                                                            tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time, jstackcolorsmap[contextTidMap[tid][i].ts], i]);
                                                        }else {
                                                            tidSamplesTimestamps[tid].push([contextTidMap[tid][i].time, tempeventTypeCount, i]);
                                                        }
                                                        eventSampleCount++;

                                                        cursampleCount++;

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
                                            if (cursampleCount != 0) {
                                                if (sampleSortMap.has(key)) {
                                                    sampleSortMap.set(key, sampleSortMap.get(key) + cursampleCount);
                                                } else {
                                                    sampleSortMap.set(key, cursampleCount);
                                                }
                                            }

                                            /*
                                            for (var stack in obj[combinedEventKey]) {
                                                if (frameFilterString == "" || frameFilterStackMap[combinedEventKey][stack] !== undefined) {
                                                    //consider
                                                    if (sampleSortMap.has(key)) {
                                                        sampleSortMap.set(key, sampleSortMap.get(key) + Number(obj[combinedEventKey][stack]));
                                                    } else {
                                                        sampleSortMap.set(key, Number(obj[combinedEventKey][stack]));
                                                    }

                                                    //if(tidSamplesTimestamps[tid] == undefined){
                                                    //    tidSamplesTimestamps[tid] = [];
                                                    //}

                                                    if (sampleCountMap.has(key)) {
                                                        let tmpMap = sampleCountMap.get(key);
                                                        if (tmpMap.has(stack)) {
                                                            tmpMap.set(stack, tmpMap.get(stack) + Number(obj[combinedEventKey][stack]));
                                                        } else {
                                                            tmpMap.set(stack, Number(obj[combinedEventKey][stack]));
                                                        }
                                                    } else {
                                                        let tmpMap = new Map();
                                                        tmpMap.set(stack, Number(obj[combinedEventKey][stack]));
                                                        sampleCountMap.set(key, tmpMap);
                                                    }
                                                }
                                            }*/
                                        }
                                    }
                                });
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
            }

            console.log("count " + eventType +":"+eventSampleCount);
        }

        let start = performance.now();
        $("#sampletablecontext").html("");
        if (sampletableFormat == 1) {
            $('#stack-view-guid').text("");
            prevSampleReqCellObj = undefined;
            prevSampleReqCellSid = undefined;
            prevSampleReqCellTime = undefined;

            let tidSamplesCountMap = new Map(); //sort tid based on number of samples
            for (var tid in tidSamplesTimestamps) {
                tidSamplesCountMap.set(tid, tidSamplesTimestamps[tid].length);
                tidSamplesTimestamps[tid].sort((a, b) => a[0] - b[0]);
            }
            tidSamplesCountMap = new Map([...tidSamplesCountMap.entries()].sort((a, b) => b[1] - a[1]));

            let top = 75;
            let uniquetimestamps = generateTimestamseries(tidSamplesTimestamps,tidSamplesCountMap, top);
            $("#sampletable").html("");

            //sampletable
            let cellh = 7;
            let cellw = 3;
            let x = 30;
            let y = 7;
            d3.select("#sampletable").append("svg").attr("width", (maxThreadSamples *cellw)+37).attr("height", (top+2)*cellh);

            let d3svg = d3.select("#sampletable").select("svg");

            let count = 0;
            let minTimeStamp = 0;
            let maxTimeStamp = 0;
            for (let [tid, value] of tidSamplesCountMap) {
                if (count < top) {
                    count++;
                    d3svg.append("text")
                        .text(tid)
                        .attr("x", 0)
                        .style("font-size", "7px")
                        .attr("y", y+cellh/2);

                    d3svg.append('line')
                        .style('stroke-dasharray', [2,1])
                        .style('stroke', '#E2E2E2')
                        .attr('x1', x)
                        .attr('y1', y+cellh/2 )
                        .attr('x2', maxThreadSamples*cellh)
                        .attr('y2', y+cellh/2);

                    let i = 0;
                    //console.log("total len:" + tidSamplesTimestamps[tid].length);
                    for (let timestamp in uniquetimestamps) {

                        if(minTimeStamp == 0){
                            minTimeStamp = timestamp;
                        }
                        if(timestamp > maxTimeStamp) {
                            maxTimeStamp = timestamp;
                        }

                        if (i < tidSamplesTimestamps[tid].length) {
                            if (uniquetimestamps[timestamp] == -1) {
                                //put a dash rect
                            } else if (timestamp == tidSamplesTimestamps[tid][i][0]) {
                                //put color rect
                                d3svg.append("rect")
                                    .attr("width", cellw)
                                    .attr("height", cellh)
                                    .attr("x", x)
                                    .attr("y", y)
                                    .attr("e", tidSamplesTimestamps[tid][i][1])
                                    .attr("t", tid)
                                    .attr("in", tidSamplesTimestamps[tid][i][2])
                                    .attr("class", " tgl")
                                    .attr("onclick", 'showSVGSampleStack(evt)')
                                    .attr("fill", getSampleColor(tidSamplesTimestamps[tid][i][1]));
                                i++;
                            }
                        } else {
                            //put a whitc rect
                        }
                        x += cellw;
                    }
                    //console.log("matched len:" + i);
                    x = 30;
                    y += cellh;
                }
            }

        } else {

            //sort based on number of stacks
            for (let [key, value] of sampleCountMap) {
                sampleCountMap.set(key, new Map([...value.entries()].sort((a, b) => b[1] - a[1])));
            }

            sampleSortMap = new Map([...sampleSortMap.entries()].sort((a, b) => b[1] - a[1]));


            let end1 = performance.now();
            console.log("genSampleTable 0 time:" + (end1 - start1))

            let order = 1;

            moreSamples = {};
            for (let [key, value] of sampleSortMap) {

                if ((samplesgroupByMatch != '' && key.includes != undefined && !key.includes(samplesgroupByMatch))) {
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
                        str = str + "<div style=\" cursor: pointer;\" data-ga-category=\"samples-table\" data-ga-action=\"show-stack\" id=\"+ key1 + \" class=\"send-ga stack-badge badge badge-secondary  stack" + key1 + "\" onclick=\"showSampleStack('" + key1 + "');\">" + (100 * value1 / value).toFixed(2) + "%, " + value1 + "</div> &nbsp;";
                    } else {
                        if (morec < 25) {
                            morec++;
                            more = more + "<div style=\"display: none; cursor: pointer; \"   class=\"stack-badge badge badge-secondary  stack" + key1 + " hidden-stacks-" + hashCode(key) + "\" onclick=\"showSampleStack('" + key1 + "');\">" + (100 * value1 / value).toFixed(2) + "%, " + value1 + "</div>&nbsp;";
                        } else {
                            skipc++;
                        }
                    }
                    count++;
                }
                if (morec != 0) {
                    moreSamples[key] = more;
                    str += '<div style="cursor: pointer;" class="badge badge-primary more-stacks-' + hashCode(key) + '" onclick="showHiddenStacks(\'' + hashCode(key) + '\');"> +' + (morec + skipc) + ' more</div>';
                    str += '<div style="cursor: pointer; display: none;" class="badge badge-primary less-stacks-' + hashCode(key) + '" onclick="hideHiddenStacks(\'' + hashCode(key) + '\');"> << </div> ';
                    str += more;
                    str += '<div style="cursor: pointer; display: none;" class="badge badge-primary less-stacks-' + hashCode(key) + '" onclick="hideHiddenStacks(\'' + hashCode(key) + '\');"> -' + morec + ' less</div> ';
                    if (skipc != 0) {
                        str += "<div style=\"display: none;\"   class=\"stack-badge badge " + " hidden-stacks-" + hashCode(key) + "\"\">" + skipc + " more</div>";
                    }
                }
                sampleTableRows[samplerowIndex] = [];
                /*if(eventType == EventType.MEMORY) {
                    addContextTableRow(sampleTableRows[samplerowIndex], ("<label style=\"word-wrap: break-word; width: 300px\" >" + (key == undefined ? "NA" : key) + "</label>"), "hint='"+groupBySamples+"'");
                    addContextTableOrderRow(sampleTableRows[samplerowIndex], ("<b>" + (value / (1024 * 1024)).toFixed(3) + "</b>&nbsp;<div class=\"badge badge-info\"> " + (100 * value / totalSampleCount).toFixed(3) + "</div>"), value);
                    addContextTableOrderRow(sampleTableRows[samplerowIndex], str, order);
                }else{*/

                //"id='"+Number(dim) + "_dummy'"
                if (groupBySamples == "tid") {
                    sfSampleTable.addContextTableRow(sampleTableRows[samplerowIndex], ("<div style=\"cursor: pointer; word-wrap: break-word;\" >" + (key == undefined ? "NA" : key) + "</div>"), "id='" + key + "_dummy'" + " hint='" + groupBySamples + "'");
                } else {
                    sfSampleTable.addContextTableRow(sampleTableRows[samplerowIndex], ("<div style=\"cursor: pointer; word-wrap: break-word;\" >" + (key == undefined ? "NA" : key) + "</div>"), "hint='" + groupBySamples + "'");
                }
                sfSampleTable.addContextTableOrderRow(sampleTableRows[samplerowIndex], ("<div class=\"badge badge-info\"><span style='font-size: 12px; color:black'>" + value + "</span> " + (100 * value / totalSampleCount).toFixed(3) + "%</div>"), value);
                sfSampleTable.addContextTableOrderRow(sampleTableRows[samplerowIndex], str, order);

                // }
                //table = table + "<tr><td  hint=" + groupBySamples + " class=\"context-menu-two\"><label style=\"word-wrap: break-word; width: 300px\" >" + (key == undefined ? "NA" : key) + "</label></td><td data-order="+value+"><b>" +value+"</b>&nbsp;<div class=\"badge badge-info\"> "+ (100*value/totalSampleCount).toFixed(3) + "</div></td><td data-order="+order+">" + str + "</td></tr>";
            }

            sfSampleTable.SFDataTable(sampleTableRows, sampleTableHeader, "sampletable", order);

        }

        if(addContext) {
            updateEventInputOptions('event-input-smpl');
            updateGroupByOptions('smpl-grp-by');

            if(stack_id != '' && sampletableFormat == 0){
                showSampleStack(stack_id);
            }
        }

        let end = performance.now();
        console.log("genSampleTable 1 time:" + (end - start) )
    }

    let prevSampleReqCellObj = undefined;
    let prevSampleReqCellSid = undefined;
    let prevSampleReqCellTime = undefined;
    const sfSamplecontextTable = new SFDataTable("sampletablecontext");
    Object.freeze(sfSamplecontextTable);

    function showSampleContextTable(record, event) {
        let rowIndex = 0;
        sampleTableHeader = [];
        sampleTableRows = [];
        getContextTableHeadernew("", sampleTableHeader, customEvent, false);
        sampleTableRows[rowIndex] = [];
        if(record.length == 0){
            sfSamplecontextTable.addContextTableRow(sampleTableRows[rowIndex], "no context available");
        }else {
            for (let field in record) {
                if (field == 1) {
                    sfSamplecontextTable.addContextTableRow(sampleTableRows[rowIndex], moment.utc(record[field]).format('YYYY-MM-DD HH:mm:ss SSS'));
                } else {
                    sfSamplecontextTable.addContextTableRow(sampleTableRows[rowIndex], record[field]);
                }
            }
        }
        sfSamplecontextTable.SFDataTable(sampleTableRows, sampleTableHeader, "sampletablecontext", undefined, false);
    }

    function showSVGSampleStack(obj) {
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
            showSampleContextTable(contextTree1[eventType].context.tidMap[pid][index][customEvent].obj, eventType);
        }else{
            $("#sampletablecontext").css("height",$("#sampletablecontext").height());
            showSampleContextTable([], eventType);
        }

        let stackid = contextTree1[eventType].context.tidMap[pid][index].hash;

        if(prevSampleReqCellObj != undefined) {
            prevSampleReqCellObj.classList.remove('stackCells');
        }
        prevSampleReqCellObj = obj.target;
        prevSampleReqCellSid = stackid;
        prevSampleReqCellTime = contextTree1[eventType].context.tidMap[pid][index].time;
        prevSampleReqCellObj.classList.add('stackCells');

        updateUrl("stack_id",stackid,true);
        stack_id=stackid;
        $('#stack-view-guid').text(getStackTrace(stackid, eventType,obj.target.getAttribute("e")));
    }

    function getSampleColor(id){
        return profilecolors[id];
    }

    let maxThreadSamples=0;
    let minThreadSamplesTimeStamp = 0;
    let maxThreadSamplesTimeStamp = 0;
    function generateTimestamseries(tidSamplesTimestamps,tidSamplesCountMap, top){

        let tmpTimestampap = {};
        let timestampArray = [];

        let start = performance.now();

        //generate unique timestamp array
        let count = 0;
        for (let [tid, value] of tidSamplesCountMap) {
            if (count < top) {
                count++;
                for (let i = 0; i < tidSamplesTimestamps[tid].length; i++) {
                    if (tmpTimestampap[tidSamplesTimestamps[tid][i][0]] == undefined) {
                        tmpTimestampap[tidSamplesTimestamps[tid][i][0]] = true;
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
                tmpTimestampap[Math.round((timestampArray[i]+prev)/2)] = -1;
                count++;
            }
            tmpTimestampap[timestampArray[i]] = i;
            prev = timestampArray[i];
            count++;
        }
        let end = performance.now();
        console.log("generateTimestamseries time :" + (end - start));
        maxThreadSamples = count;
        minThreadSamplesTimeStamp = timestampArray[0];
        maxThreadSamplesTimeStamp = timestampArray[timestampArray.length-1];
        return tmpTimestampap;
    }


    function showHiddenStacks(guid) {
        $(".more-stacks-" + guid).css("display", "none");
        $(".less-stacks-" + guid).css("display", "");
        $(".hidden-stacks-" + guid).css("display", "");
    }

    function hideHiddenStacks(guid) {
        $(".more-stacks-" + guid).css("display", "");
        $(".less-stacks-" + guid).css("display", "none");
        $(".hidden-stacks-" + guid).css("display", "none");
    }

    function getEventOfStackID(id){
        for (var profile in jfrprofiles1) {
            let tree = getContextTree(1,profile);
            if(tree != undefined && tree.tree != undefined && tree.tree.sm[id] != undefined){
                return profile;
            }
        }
        return getEventType();//default
    }

    function showSampleStack(stackid) {
        updateUrl("stack_id",stackid,true);
        stack_id=stackid;
        $('#stack-view-guid').text(getStackTrace(stackid,getEventOfStackID(stackid)));
        $('.stack-badge').removeClass("badge-warning");
        $(".stack"+stackid).addClass("badge-warning");
    }

    //create html tree recursively
    function updateProfilerViewSample(level, skipFilter) {
        addTabNote(false,"");
        let eventType = getEventType();

        let contextData = getContextData();
        if(contextData == undefined) {
            if(compareTree){
                addTabNote(true,"This view is not supported when Compare option is selected.")
            }else{
                addTabNote(true,"Context data not available to show this view");
            }
            console.log("updateProfilerViewSample skip:" + level);
            return false;
        }

        updateEventInputOptions('event-input-smpl');
        updateGroupByOptions('smpl-grp-by');

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

            if (prevCustomEvent === customEvent && currentLoadedTree === treeToProcess && prevOption === currentOption && isRefresh === false && isLevelRefresh === false && prevSelectedLevel === selectedLevel) {
                console.log("no change in sample table, option:" + (prevCustomEvent == customEvent) + ":" + (currentLoadedTree === treeToProcess)+":"+ (prevOption === currentOption) +" isRefresh:"+(isRefresh === false)+":"+" isLevelRefresh:"+(isLevelRefresh === false)+" selectedLevel:"+ (prevSelectedLevel === selectedLevel));
                end = performance.now();
                console.log("updateProfilerViewSample 1 time:" + (end - start));
                return;
            }else{
                console.log("change in sample table, option:" + (prevCustomEvent == customEvent) + ":" + (currentLoadedTree === treeToProcess)+":"+ (prevOption === currentOption) +" isRefresh:"+(isRefresh === false)+":"+" isLevelRefresh:"+(isLevelRefresh === false)+" selectedLevel:"+ (prevSelectedLevel === selectedLevel));
            }
            currentLoadedTree = treeToProcess;
            prevOption = currentOption;
            prevCustomEvent = customEvent;
            prevSelectedLevel = selectedLevel;
            isLevelRefresh = false;
            isRefresh = false;

            // if no data returned from our call don't try to parse it
            if (treeToProcess === undefined) {
                end = performance.now();
                console.log("updateProfilerViewSample 2 time:" + (end - start));
                return;
            }

            //addContextData(selectedLevel, eventType);

            resetTreeHeader("");

            genSampleTable(true, level);

            end = performance.now();
            console.log("updateProfilerViewSample 3 time:" + (end - start));
        }else{
            let start = performance.now();

            let selectedLevel = getSelectedLevel(getActiveTree(eventType, false));
            //addContextData(selectedLevel, eventType);

            resetTreeHeader("");

            genSampleTable(true, level);

            let end = performance.now();
            console.log("updateProfilerViewSample 4 time:" + (end - start));

            if(!isFilterOnType){
                addTabNote(true,getContextHintNote(true));
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

</script>