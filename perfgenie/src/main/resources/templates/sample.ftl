<script>
    /*
* Copyright (c) 2022, Salesforce.com, Inc.
* All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
* For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/
</script>
<div style="padding-left: 25px;">
    <label>Profile: </label>
    <select  style="height:30px;text-align: center;" class="filterinput" name="event-type-sample" id="event-type-sample">

    </select>
    <label >Event: </label>
    <select  style="height:30px;text-align: center;" class="filterinput"  name="event-input-smpl" id="event-input-smpl">

    </select>
    <label  >Group by: </label>
    <select  style="height:30px;text-align: center;" class="filterinput"  name="smpl-grp-by" id="smpl-grp-by">

    </select>

    <span title="Consider first N characters of group by option values">Len:</span><input  style="height:30px;width:35px;text-align: left;" class="filterinput" id="samples-groupby-length" type="text" value="">
    <span title="Sub string match with group by option values">Match:</span><input  style="height:30px;width:120px;text-align: left;" class="filterinput" id="samples-groupby-match" type="text" value="">

</div>


<div class="row">
    <div class="col-lg-8">
        <div style="overflow: auto; padding-left: 0px; width: 100%;" class="cct-customized-scrollbar">
            <div id="sampletable" class="sampletable col-lg-12">
            </div>
        </div>
    </div>
    <div id="quick-stack-view" class="col-lg-4">
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


        if (contextData != undefined && contextData.records != undefined) {
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
        }
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
        genSampleTable();
    });

    $("#event-input-smpl").on("change", (event) => {
        updateUrl("scustomevent",$("#event-input-smpl").val(),true);
        samplesCustomEvent = $("#event-input-smpl").val();
        updateProfilerViewSample(getSelectedLevel(getContextTree(1,getEventType())),true);
    });

    $("#event-type-sample").on("change", (event) => {
        handleEventTypeChange($("#event-type-sample").val());
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
        samplesgroupByLength = urlParams.get('sgroupByLength') || '20';

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

    //add context data for all request matching samples
    function addContextData(selectedLevel, event){
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

            if ("duration" == tokens[0]) { // TODO: take from user
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

                    let stackMap = {};
                    try {
                        //do a binary search
                        let entryIndex = isinRequest(contextTidMap[tid], start, end);
                        if (entryIndex != -1) {
                            let requestArr = contextTidMap[tid];
                            let curIndex = entryIndex;
                            //consider all matching samples downward
                            while (curIndex >= 0 && requestArr[curIndex].time >= start && requestArr[curIndex].time <= end) {
                                if (stackMap[requestArr[curIndex].hash] !== undefined) {
                                    stackMap[requestArr[curIndex].hash] = stackMap[requestArr[curIndex].hash] + 1;
                                } else {
                                    stackMap[requestArr[curIndex].hash] = 1;
                                }
                                requestArr[curIndex].obj = record;
                                if(requestArr[curIndex][samplesCustomEvent] == undefined){
                                    requestArr[curIndex][samplesCustomEvent]={};
                                }
                                requestArr[curIndex][samplesCustomEvent].obj = record;
                                scount++;
                                curIndex--;
                            }
                            curIndex = entryIndex + 1;
                            //consider all matching samples upward
                            while (curIndex < requestArr.length && requestArr[curIndex].time >= start && requestArr[curIndex].time <= end) {
                                if (stackMap[requestArr[curIndex].hash] !== undefined) {
                                    stackMap[requestArr[curIndex].hash] = stackMap[requestArr[curIndex].hash] + 1;
                                } else {
                                    stackMap[requestArr[curIndex].hash] = 1;
                                }
                                requestArr[curIndex].obj = record;
                                if(requestArr[curIndex][samplesCustomEvent] == undefined){
                                    requestArr[curIndex][samplesCustomEvent]={};
                                }
                                requestArr[curIndex][samplesCustomEvent].obj = record;
                                scount++;
                                curIndex++;
                            }
                            reqCount++;
                            obj[event] = stackMap;

                            obj[event+samplesCustomEvent] = stackMap;
                        }
                    } catch (err) {
                        console.log("tid not found in JFR" + tid + " " + err.message);
                    }
                }
            });
        }

        if(event == "Jstack"){
            addContextDataJstack();
        }

        treeToProcess[samplesCustomEvent + event+"-context"] = "done";
        let end = performance.now();
        console.log("addContextData time:" + (end - start) + ":" + samplesCustomEvent + ":" + event + ":" +scount+":"+reqCount);
        return true;
    }

    function addContextDataJstackOld(){
        return;

        let treeToProcess = getContextTree(1,"Jstack");
        let contextData = getContextData();
        if(contextData == undefined || treeToProcess[samplesCustomEvent +"Jstack-context"] != undefined) {
            console.log("addContextData skip:" + samplesCustomEvent + event);
            return false;
        }

        //let contextStart = treeToProcess.context.start;
        let tidMap = treeToProcess.context.tidMap;

        /* we already did this in addContextData
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
        }*/

        let start = performance.now();
        for(var tid in tidMap){
            for (let i = 0; i < tidMap[tid].length; i++) {
                if (tidMap[tid][i].tn == undefined) {
                    let pair = tidMap[tid][i].ctx.split(";");
                    tidMap[tid][i].tn = pair[1];
                    tidMap[tid][i].ts = getThreadState(pair[0]);
                }
            }
        }
        let end = performance.now();
        console.log("addContextDataJstack time:" + (end - start) + ":" + event);

        treeToProcess[samplesCustomEvent +"Jstack-context"] = "done";

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
                sfSampleTable.addContextTableHeader(row,groupBySamples,1,"class='context-menu-two'");
            }else{
                sfSampleTable.addContextTableHeader(row,groupBySamples,-1,"class='context-menu-two'");
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
    function genSampleTable() {
        updateEventInputOptions('event-input-smpl');
        updateGroupByOptions('smpl-grp-by');

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

            if ("duration" == tokens[0]) { // TODO: take from user
                spanIndex = val;
            }
            if ("timestamp" == tokens[0]) { // TODO: take from user
                timestampIndex = val;
            }
            if (tokens[1] == "text" || tokens[1] == "timestamp") {
                dimIndexMap[tokens[0]] = val;
            }
        }

        $('#stack-view-guid').text("");
        let start1 = performance.now();
        let groupBySamples = smplBy;
        if(contextData == undefined) {
            //support only tid or tn
            if(!(groupBySamples === "threadname" || groupBySamples === "tid")){
                //set default tid
                groupBySamples = "tid";
                if(getEventType() == "Jstack"){
                    updateFilterViewStatus("Note: Failed to get Request context, only tid and threadName group by options supported.");
                }else{
                    updateFilterViewStatus("Note: Failed to get Request context, only tid group by option supported.");
                }
            }
        }

        let contextDataRecords = undefined;
        if (contextData != undefined && contextData.records != undefined) {
            contextDataRecords = contextData.records[samplesCustomEvent];
        }

        let tidDatalistVal = filterMap["tid"];

        let tableFormat = $("#format-input").val();

        let contextTidMap = getContextTree(1).context.tidMap;
        let contextStart = getContextTree(1).context.start;

        let sampleCountMap = new Map();
        sampleSortMap = new Map();

        let totalSampleCount = getContextTree(1).tree.sz;

        let event = getEventType();

        let table = "<table   style=\"width: 100%;\" id=\"sample-table\" class=\"table compact table-striped table-bordered  table-hover dataTable\"><thead><tr><th width=\"50%\">"+getHearderFor(groupBySamples)+"</th><th width=\"10%\">Sample Count</th><th width=\"40%\">Samples</th></thead>";


        if (getEventType() == "Jstack") {
            filteredStackMap[FilterLevel.LEVEL3] = {};
        }

        let samplerowIndex = -1;
        sampleTableHeader = [];
        sampleTableRows = [];
        moreSamples = [];
        getSamplesTableHeader(groupBySamples, sampleTableHeader, event);

        //every sample of jstack has a tn
        if (getEventType() == "Jstack" && groupBySamples == "threadname" && isFilterEmpty(dimIndexMap)) {
            for (var tid in contextDataRecords) {
                if(contextTidMap[tid] != undefined && (tidDatalistVal == undefined || tidDatalistVal == tid)) {
                    for (let i = 0; i < contextTidMap[tid].length; i++) {
                        if ((pStart == '' || pEnd == '') || (contextTidMap[tid][i].time + contextStart) >= pStart && (contextTidMap[tid][i].time + contextStart) <= pEnd) {//apply time range filter
                            let stack = contextTidMap[tid][i].hash;
                            if (frameFilterString == "" || frameFilterStackMap[event][stack] !== undefined) {
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
        }else if(groupBySamples == "tid" && isFilterEmpty()){
            for (var tid in contextDataRecords) {
                if(contextTidMap[tid] != undefined && (tidDatalistVal == undefined || tidDatalistVal == tid)) {
                    for (let i = 0; i < contextTidMap[tid].length; i++) {
                        if ((pStart == '' || pEnd == '') || (contextTidMap[tid][i].time + contextStart) >= pStart && (contextTidMap[tid][i].time + contextStart) <= pEnd) {//apply time range filter
                            let stack = contextTidMap[tid][i].hash;
                            if (frameFilterString == "" || frameFilterStackMap[event][stack] !== undefined) {
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
        }else if(frameFilterString !== "" && isFilterEmpty()){
            if (spanIndex == -1) { // record duration span not available
                //Context hints cannot be applied, apply only time range filter and tid, threadname filter
                isFilterOnType=false;
                let threadNameTidMap = {};
                if(dimIndexMap["threadname"] != undefined && (filterMap["threadname"] != undefined || groupBySamples == "threadname")) {
                    for (var tid in contextDataRecords) {
                        if ((tidDatalistVal == undefined || tidDatalistVal == tid) && contextTidMap[tid] != undefined) {

                            //contextDataRecords[tid].forEach(function (obj) {
                            if(contextDataRecords[tid][0].record != undefined && contextDataRecords[tid][0].record[dimIndexMap["threadname"]] != undefined) {
                                threadNameTidMap[tid] = contextDataRecords[tid][0].record[dimIndexMap["threadname"]];
                            }
                            //});
                        }
                    }
                }
                for (var tid in contextDataRecords) {
                    if ((tidDatalistVal == undefined || tidDatalistVal == tid) && contextTidMap[tid] != undefined) {
                        if(dimIndexMap["threadname"] == undefined || filterMap["threadname"] == undefined || (threadNameTidMap[tid].includes(filterMap["threadname"]))) {
                            for (let i = 0; i < contextTidMap[tid].length; i++) {
                                if ((pStart === '' || pEnd === '') || ((contextTidMap[tid][i].time + contextStart) >= pStart && (contextTidMap[tid][i].time + contextStart) <= pEnd)) {
                                    let stack = contextTidMap[tid][i].hash;
                                    if (frameFilterString == "" || frameFilterStackMap[event][stack] !== undefined) {
                                        let key = "";
                                        if(groupBySamples === "tid"){
                                            key = tid;
                                        }else if(groupBySamples === "threadname"){
                                            key = threadNameTidMap[tid].slice(0, samplesgroupByLength);
                                            //key = threadNameTidMap[tid];
                                        }else{
                                            if (contextTidMap[tid][i].obj != undefined) {
                                                key = eval("contextTidMap[tid][i].obj." + groupBySamples);
                                            } else {
                                                key = eval("contextTidMap[tid][i]." + groupBySamples);
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
                                if (frameFilterStackMap[event][stack] !== undefined) {
                                    let key = "";
                                    if (contextTidMap[tid][i].obj != undefined) {
                                        key = eval("contextTidMap[tid][i].obj." + groupBySamples);
                                    } else {
                                        key = eval("contextTidMap[tid][i]." + groupBySamples);
                                    }
                                    if( key.slice != undefined){
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
        }else {
            if (spanIndex == -1) { // record duration span not available
                //Context hints cannot be applied, apply only time range filter and tid, threadname filter
                isFilterOnType=false;
                let threadNameTidMap = {};
                if(dimIndexMap["threadname"] != undefined && (filterMap["threadname"] != undefined || groupBySamples == "threadname")) {
                    for (var tid in contextDataRecords) {
                        if ((tidDatalistVal == undefined || tidDatalistVal == tid) && contextTidMap[tid] != undefined) {

                            //contextDataRecords[tid].forEach(function (obj) {
                            if(contextDataRecords[tid][0].record != undefined && contextDataRecords[tid][0].record[dimIndexMap["threadname"]] != undefined) {
                                threadNameTidMap[tid] = contextDataRecords[tid][0].record[dimIndexMap["threadname"]];
                            }
                            //});
                        }
                    }
                }
                for (var tid in contextDataRecords) {
                    if ((tidDatalistVal == undefined || tidDatalistVal == tid) && contextTidMap[tid] != undefined) {
                        if(dimIndexMap["threadname"] == undefined || filterMap["threadname"] == undefined || (threadNameTidMap[tid].includes(filterMap["threadname"]))) {
                            for (let i = 0; i < contextTidMap[tid].length; i++) {
                                if ((pStart === '' || pEnd === '') || ((contextTidMap[tid][i].time + contextStart) >= pStart && (contextTidMap[tid][i].time + contextStart) <= pEnd)) {
                                    let stack = contextTidMap[tid][i].hash;
                                    if (frameFilterString == "" || frameFilterStackMap[event][stack] !== undefined) {
                                        let key = "";
                                        if(groupBySamples === "tid"){
                                            key = tid;
                                        }else if(groupBySamples === "threadname"){
                                            key = threadNameTidMap[tid];
                                        }else{
                                            if (contextTidMap[tid][i].obj != undefined) {
                                                key = eval("contextTidMap[tid][i].obj." + groupBySamples);
                                            } else {
                                                key = eval("contextTidMap[tid][i]." + groupBySamples);
                                            }
                                        }
                                        if( key.slice != undefined){
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
                                    if (obj[event] != undefined) {
                                        flag = true;
                                        //TODO: we are including all the samples in a matching request, some of them may not be part of timerange filter
                                        let key = record[dimIndexMap[groupBySamples]];
                                        if( key.slice != undefined){
                                            key = key.slice(0, samplesgroupByLength);
                                        }
                                        //check if request samples match frame filter string
                                        for (var stack in obj[event]) {
                                            if (frameFilterString == "" || frameFilterStackMap[event][stack] !== undefined) {
                                                //consider
                                                if (sampleSortMap.has(key)) {
                                                    sampleSortMap.set(key, sampleSortMap.get(key) + Number(obj[event][stack]));
                                                } else {
                                                    sampleSortMap.set(key, Number(obj[event][stack]));
                                                }
                                                if (sampleCountMap.has(key)) {
                                                    let tmpMap = sampleCountMap.get(key);
                                                    if (tmpMap.has(stack)) {
                                                        tmpMap.set(stack, tmpMap.get(stack) + Number(obj[event][stack]));
                                                    } else {
                                                        tmpMap.set(stack, Number(obj[event][stack]));
                                                    }
                                                } else {
                                                    let tmpMap = new Map();
                                                    tmpMap.set(stack, Number(obj[event][stack]));
                                                    sampleCountMap.set(key, tmpMap);
                                                }
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    }
                } else {
                    if (getEventType() == "Jstack") {
                        updateFilterViewStatus("Note: Failed to get Request context, only tid and threadName group by options supported.");
                    } else {
                        updateFilterViewStatus("Note: Failed to get Request context, only tid group by option supported.");
                    }
                }
            }
        }

        //sort based on number of stacks
        for (let [key, value] of sampleCountMap) {
            sampleCountMap.set(key, new Map([...value.entries()].sort((a, b) => b[1] - a[1])));
        }

        sampleSortMap=new Map([...sampleSortMap.entries()].sort((a, b) => b[1] - a[1]));


        let end1 = performance.now();
        console.log("genSampleTable 0 time:" + (end1 - start1) )

        let start = performance.now();

        let order = 1;

        moreSamples = {};
        for (let [key, value] of sampleSortMap) {

            if ((samplesgroupByMatch != '' && key.includes != undefined && !key.includes(samplesgroupByMatch))) {
                continue;
            }

            let str = "";
            let more = "";
            let morec= 0;
            let skipc=0;
            let count = 0;
            let order = 0;
            samplerowIndex++;

            for(let [key1, value1] of sampleCountMap.get(key)){
                if(count < 5) {
                    if(order == 0) {
                        order = value1;
                    }
                    str = str + "<div style=\"cursor: pointer;\" data-ga-category=\"samples-table\" data-ga-action=\"show-stack\" id=\"+ key1 + \" class=\"send-ga stack-badge badge stack" + key1 + "\" onclick=\"showSampleStack('" + key1 + "');\">" + (100 * value1 / value).toFixed(2) + "%, " + value1 + "</div>&nbsp;";
                }else{
                    if(morec < 25) {
                        morec++;
                        more = more + "<div style=\"display: none; cursor: pointer;\"   class=\"stack-badge badge stack" + key1 + " hidden-stacks-" + hashCode(key) + "\" onclick=\"showSampleStack('" + key1 + "');\">" + (100 * value1 / value).toFixed(2) + "%, " + value1 + "</div>&nbsp;";
                    }else{
                        skipc++;
                    }
                }
                count++;
            }
            if(morec != 0){
                moreSamples[key]=more;
                str += '<div style="cursor: pointer;" class="badge badge-primary more-stacks-' + hashCode(key) + '" onclick="showHiddenStacks(\'' + hashCode(key) + '\');"> +' + (morec + skipc) + ' more</div> ';
                str += '<div style="cursor: pointer; display: none;" class="badge badge-primary less-stacks-' + hashCode(key) + '" onclick="hideHiddenStacks(\'' + hashCode(key) + '\');"> << </div> ';
                str += more;
                str += '<div style="cursor: pointer; display: none;" class="badge badge-primary less-stacks-' + hashCode(key) + '" onclick="hideHiddenStacks(\'' + hashCode(key) + '\');"> -' + morec + ' less</div> ';
                if(skipc != 0){
                    str += "<div style=\"display: none;\"   class=\"stack-badge badge " + " hidden-stacks-" + hashCode(key) + "\"\">" + skipc + " more</div>";
                }
            }
            sampleTableRows[samplerowIndex] = [];
            /*if(event == EventType.MEMORY) {
                addContextTableRow(sampleTableRows[samplerowIndex], ("<label style=\"word-wrap: break-word; width: 300px\" >" + (key == undefined ? "NA" : key) + "</label>"), "hint='"+groupBySamples+"'");
                addContextTableOrderRow(sampleTableRows[samplerowIndex], ("<b>" + (value / (1024 * 1024)).toFixed(3) + "</b>&nbsp;<div class=\"badge badge-info\"> " + (100 * value / totalSampleCount).toFixed(3) + "</div>"), value);
                addContextTableOrderRow(sampleTableRows[samplerowIndex], str, order);
            }else{*/

            sfSampleTable.addContextTableRow(sampleTableRows[samplerowIndex], ("<label style=\"cursor: pointer; word-wrap: break-word; width: 300px\" >" + (key == undefined ? "NA" : key) + "</label>"), "hint='"+groupBySamples+"'");
            sfSampleTable.addContextTableOrderRow(sampleTableRows[samplerowIndex], ("<b>" + value+ "</b>&nbsp;<div class=\"badge badge-info\"> " + (100 * value / totalSampleCount).toFixed(3) + "</div>"), value);
            sfSampleTable.addContextTableOrderRow(sampleTableRows[samplerowIndex], str, order);

           // }
            //table = table + "<tr><td  hint=" + groupBySamples + " class=\"context-menu-two\"><label style=\"word-wrap: break-word; width: 300px\" >" + (key == undefined ? "NA" : key) + "</label></td><td data-order="+value+"><b>" +value+"</b>&nbsp;<div class=\"badge badge-info\"> "+ (100*value/totalSampleCount).toFixed(3) + "</div></td><td data-order="+order+">" + str + "</td></tr>";
        }

        sfSampleTable.SFDataTable(sampleTableRows, sampleTableHeader, "sampletable", order);

       /* //table = table + "</table>";

        //document.getElementById("sampletable").innerHTML = table;

        //if(sampleTable != undefined) {
        //    sampleTablePage = 0; //reset to 0 except 1st time
        //}

        sampleTable=$('#sample-table').DataTable({
            "order": [[ order, "desc" ]],
            searching: true,
            "pageLength": 20,
            "columnDefs": [ {
                "targets": 0,
                "orderable": false
            } ],
            "drawCallback": function( settings ) {
                if(sampleTable != undefined) {
                    //when we change table page focus, remove request selection
                    if (filterReq != undefined && filterReq != "" && $("#" + filterReq).length != 0) {
                        updateRequestView();
                    }
                    sampleTablePage = sampleTable.page.info().page * sampleTable.page.len();
                    updateUrl("spage", sampleTablePage, true);
                }
                //addClickActionsToFilterTable("sample-table"); // todo check what is this
            },
            "displayStart": sampleTablePage,
            aoColumnDefs: [
                {
                    orderSequence: ["desc", "asc"],
                    aTargets: ['_all']
                }
            ],
            "sDom": '<"sampletoolbar">tfp<"clear">'

        });
*/
        updateEventInputOptions('event-input-smpl');

        updateGroupByOptions('smpl-grp-by');

        if(stack_id != ''){
            showSampleStack(stack_id);
        }
        let end = performance.now();
        console.log("genSampleTable 1 time:" + (end - start) )
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

    function showSampleStack(stackid) {
        updateUrl("stack_id",stackid,true);
        stack_id=stackid;
        $('#stack-view-guid').text(getStackTrace(stackid));
        $('.stack-badge').removeClass("badge-warning");
        $(".stack"+stackid).addClass("badge-warning");
    }

    //create html tree recursively
    function updateProfilerViewSample(level, skipFilter) {
        addTabNote(false,"");

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


            let treeToProcess = getActiveTree(getEventType(), isCalltree);
            let selectedLevel = getSelectedLevel(getActiveTree(getEventType(), false));

            if (currentLoadedTree === treeToProcess && prevOption === currentOption && isRefresh === false && isLevelRefresh === false && prevSelectedLevel === selectedLevel) {
                console.log("no change in tree, option:" + (currentLoadedTree === treeToProcess)+":"+ (prevOption === currentOption) +" isRefresh:"+(isRefresh === false)+":"+" isLevelRefresh:"+(isLevelRefresh === false)+" selectedLevel:"+ (prevSelectedLevel === selectedLevel));
                end = performance.now();
                console.log("updateProfilerViewSample 1 time:" + (end - start));
                return;
            }else{
                console.log("change in tree, option:" + (currentLoadedTree === treeToProcess)+":"+ (prevOption === currentOption) +" isRefresh:"+(isRefresh === false)+":"+" isLevelRefresh:"+(isLevelRefresh === false)+" selectedLevel:"+ (prevSelectedLevel === selectedLevel));
            }
            currentLoadedTree = treeToProcess;
            prevOption = currentOption;
            prevSelectedLevel = selectedLevel;
            isLevelRefresh = false;
            isRefresh = false;

            // if no data returned from our call don't try to parse it
            if (treeToProcess === undefined) {
                end = performance.now();
                console.log("updateProfilerViewSample 2 time:" + (end - start));
                return;
            }

            addContextData(selectedLevel, getEventType());

            resetTreeHeader("");

            genSampleTable();

            end = performance.now();
            console.log("updateProfilerViewSample 3 time:" + (end - start));
        }else{
            let start = performance.now();

            let selectedLevel = getSelectedLevel(getActiveTree(getEventType(), false));
            addContextData(selectedLevel, getEventType());

            resetTreeHeader("");

            genSampleTable();

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