<script>
    /*
* Copyright (c) 2022, Salesforce.com, Inc.
* All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
* For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/
</script>

<script>
    let threshold = 0.01;
    let treeThreshold = 0.01;
    let levelThreshold = 0;

    function handleTreeViewType(isCalltree){
        if(isCalltree){
            $("#tree-view-type option[value='calltree']").attr("selected", "selected");
            $("#tree-view-type-flame option[value='calltree']").attr("selected", "selected");
        }else {
            $("#tree-view-type option[value='backtrace']").attr("selected", "selected");
            $("#tree-view-type-flame option[value='backtrace']").attr("selected", "selected");
        }
    }

    function handleTreeViewTypeChange(tree_view_type){
        $("#tree-view-type").val(tree_view_type);
        $("#tree-view-type-flame").val(tree_view_type);
        if(tree_view_type === "backtrace"){
            backtrace();
        }else{
            calltree();
        }
    }

    function handleEventTypeChange(event_type){
        filterEvent = event_type;
        $("#event-type-tsview").val(event_type);
        $("#event-type-surface").val(event_type);
        $("#event-type-river").val(event_type);
        $("#event-type-sample").val(event_type);
        $("#event-type-flame").val(event_type);
        $("#event-type").val(event_type);
        updateUrl("filterEvent", filterEvent, true);
        setNote(filterEvent);
        applyFilter();
    }

    $(document).ready(() => {
        $( "#tabs" ).tabs({
            activate: function (event, ui) {
                if(ui.newPanel.attr("id") == "cct"){
                    updateTabUrl("#cct");
                    updateProfilerViewCCT(prevSelectedLevel,true);
                }else if(ui.newPanel.attr("id") == "flame"){
                    updateTabUrl("#flame");
                    updateProfilerViewFlame(prevSelectedLevel,true);
                }else if(ui.newPanel.attr("id") == "samples"){
                    updateTabUrl("#samples");
                    updateProfilerViewSample(prevSelectedLevel,true);
                }else if(ui.newPanel.attr("id") == "tsview"){
                    updateTabUrl("#tsview");
                    updateProfilerViewTsview(prevSelectedLevel,true);
                }else if(ui.newPanel.attr("id") == "river"){
                    updateTabUrl("#river");
                    updateProfilerViewRiver(prevSelectedLevel,true);
                }else if(ui.newPanel.attr("id") == "surface"){
                    updateTabUrl("#surface");
                    updateProfilerViewSurface(prevSelectedLevel,true);
                }
            }
        });

        isCalltree = urlParams.get('isCalltree') || 'false';
        if(isCalltree == 'false'){isCalltree = false;}
        else{isCalltree = true;}

        handleTreeViewType(isCalltree);

        $("#tree-view-type").on("change", (event) => {
            handleTreeViewTypeChange($("#tree-view-type").val());
        });

        $("#event-type").on("change", (event) => {
            handleEventTypeChange($("#event-type").val());
        });

        console.log(startTime1, endTime1, tenant1, host1, profile1);
        filterEvent = urlParams.get('filterEvent') || 'jdk.ExecutionSample';
        threshold = urlParams.get('threshold') || "0.01";
        threshold = Number(threshold);

        $('#event-type').empty();
        $('#event-type-flame').empty();
        $('#event-type-sample').empty();
        $("#event-type-surface").empty();
        $("#event-type-river").empty();
        $("#event-type-tsview").empty();

        let isSFProfile = false;
        for (var key in jfrprofiles1) {//sfdc
            if(key.includes("jfr_dump")){
                isSFProfile = true;
                break;
            }
        }

        let order = [];//put method profile on top
        if(jfrprofiles1["jfr_dump.json.gz"]){
            order.push("jfr_dump.json.gz");
        }
        for (let key in jfrprofiles1) {
            if(key !==  "jfr_dump.json.gz"){
                order.push(key);
            }
        }
        for (let i = 0; i< order.length; i++) {
            let key = order[i];
            let profileName = getProfileName(key);
            if(filterEvent == key) {
                $('#event-type').append($('<option>', {
                    value: key,
                    text: profileName,
                    selected: true
                }));
                $('#event-type-flame').append($('<option>', {
                    value: key,
                    text: profileName,
                    selected: true
                }));
                $('#event-type-sample').append($('<option>', {
                    value: key,
                    text: profileName,
                    selected: true
                }));
                $('#event-type-river').append($('<option>', {
                    value: key,
                    text: profileName,
                    selected: true
                }));
                $('#event-type-surface').append($('<option>', {
                    value: key,
                    text: profileName,
                    selected: true
                }));
                $('#event-type-tsview').append($('<option>', {
                    value: key,
                    text: profileName,
                    selected: true
                }));
            }else{
                $('#event-type').append($('<option>', {
                    value: key,
                    text: profileName
                }));
                $('#event-type-flame').append($('<option>', {
                    value: key,
                    text: profileName
                }));
                $('#event-type-sample').append($('<option>', {
                    value: key,
                    text: profileName
                }));
                $('#event-type-river').append($('<option>', {
                    value: key,
                    text: profileName
                }));
                $('#event-type-surface').append($('<option>', {
                    value: key,
                    text: profileName
                }));
                $('#event-type-tsview').append($('<option>', {
                    value: key,
                    text: profileName
                }));
            }
        }

        if(sampletableFormat == 1 || sampletableFormat == 0) {
            $('#event-type-sample').append($('<option>', {
                value: "All",
                text: "All"
            }));
        }

        if(tsviewtableFormat != undefined && tsviewtableFormat == 1) {
            $('#event-type-tsview').append($('<option>', {
                value: "All",
                text: "All"
            }));
        }

        validateInputAndcreateContextTree(true);

    });

    function resetThreshold(selectedLevel) {
        if (isRefresh) {
            if(selectedLevel === FilterLevel.UNDEFINED) {
                treeThreshold = Number(document.getElementById("threshold").value);
            }else {
                levelThreshold = Number(document.getElementById("threshold").value);
            }
        }
        if (selectedLevel === FilterLevel.UNDEFINED) {
            threshold = treeThreshold;
        } else {
            threshold = levelThreshold;
        }
        isRefresh = false;
        document.getElementById("threshold").value = threshold;
        document.getElementById("threshold-flame").value = threshold;
    }

    function getEventType() {
        if($("#event-type").val() == null){
            return undefined;
        }
        //return filterEvent; //this is breaking jstacks alone case
        return $("#event-type").val();
    }

    function validateInputAndcreateContextTree(retry) {
        const dateRanges = [];
        const pods = [];
        const queries = [];
        const profilers = [];
        const tenants = [];
        const hosts = [];
        const profiles = [];
        const uploads = [];
        const fileIds = [];
        const uploadTimes = [];
        const aggregates = [];
        if(startTime1 != undefined && endTime1 != undefined){
            dateRanges.push(startTime1 +" - "+endTime1);
        }
        if(startTime2 != undefined && endTime2 != undefined){
            dateRanges.push(startTime2 +" - "+endTime2);
        }

        profilers.push("Java Flight recorder");
        profilers.push("Java Flight recorder");
        if(tenant1 != undefined){
            tenants.push(tenant1);
        }
        if(tenant2 != undefined){
            tenants.push(tenant2);
        }
        if(host1 != undefined){
            hosts.push(host1);
        }
        if(host2 != undefined){
            hosts.push(host2);
        }
        if(profile1 != undefined){
            profiles.push(profile1);
        }
        if(profile2 != undefined){
            profiles.push(profile2);
        }

        let isValidReq = true;
        for (let i = 0; i < dateRanges.length; i++) {
            if((profiles[i] === "All"  && aggregates[i] === "") || (profiles[i] === "" || hosts[i] === "" || tenants[i] === "")) {
                isValidReq=false;
            }
        }

        if (profiles.length === 2) {
            compareTree = true;
        }
        if (profilers.length > 0) {
            $("#backtrace").removeClass('hidden');
            if (profilers.length === 2) {
                if (profilers[0] != profilers[1]) {
                    toastr_warning("Profilers selected must be of same type, selected " + profilers[0] + " and " + profilers[1], null, {
                        timeOut: 0,
                        closeButton: true
                    });
                    return;
                }
            }
        }

        if(isValidReq && getEventType() != undefined) {
            createContextTree(dateRanges, pods, queries, profilers, tenants, hosts, profiles, uploads, fileIds, uploadTimes, aggregates, true);
        }else{
            console.log("Warn: Event type undefined.")
        }
    }

    function createJFRCallTree(length, eventType) {
        if (length == 1) {
            if (getContextTree(1, eventType).context !== undefined && getContextTree(1, eventType).context !== null) {
                isJfrContext = true;
            }
        } else {
            if (getContextTree(1, eventType).context !== undefined && getContextTree(1, eventType).context !== null && getContextTree(2, eventType).context !== undefined && getContextTree(2, eventType).context !== null) {
                isJfrContext = true;
                setmergedContextTree(mergeTreesV1(invertTreeV1(getContextTree(1, eventType), 1), invertTreeV1(getContextTree(2, eventType), 2), 1));
            }
        }
    }

    function getProfileName(profile, interval){
        if(profile === "jfr_dump.json.gz"){
            return "Java (Thread State(s): Runnable, Sampling Frequency: 10 ms)";
        }else if(profile === "jfr_dump_socket.json.gz"){
            return "Java (Thread State(s): Socket R/W, Threshold: 200 ms)";
        }else if(profile === "jfr_dump_apex.json.gz"){
            return "Apex (Thread State(s): All, Sampling Frequency: 2 s)";
        }else if(profile === "jfr_dump_memory.json.gz"){
            return "Java Memory (Sampling after every: xxm)";
        }else if(profile === "Jstack" || profile === "json-jstack"){
            if(interval != undefined) {
                return "Java (Thread State(s): All, Sampling Frequency: " + interval + " s)";
            }else{
                return "Java (Thread State(s): All, Sampling Frequency: x s)";
            }
        }
        return profile;
    }

    function createContextTree(dateRanges, pods, queries, profilers, tenants, hosts, profiles, uploads, fileIds, uploadTimes, aggregates, retry) {
        let start = performance.now();
        let eventType = getEventType();

        if(getContextTree(1, eventType) !== undefined){//data already fetched, try updateProfilerView
            updateProfilerView();
            console.log("createContextTree skip data fetch");
            return;
        }
        /*if (isCalltree == true && getmergedContextTree() === undefined && getContextTree(1, eventType) !== undefined) {
            // this will happen when backtrace view  is loaded and requesting a call tree view
            resetTreeHeader("Inverting tree ...");
            spinnerToggle('spinnerId');
            createJFRCallTree(profiles.length, eventType); //generate call tree from back trace

            //apply filter and display tree
            updateProfilerView();
            spinnerToggle('spinnerId');
            let end = performance.now();
            console.log("createContextTree time:" + (end - start));
            return;
        }*/


        //data not available, retrieve and create context tree

        if(eventType.includes("jfr_dump")) {
            retrievAndcreateContextTree(dateRanges, pods, queries, profilers, tenants, hosts, profiles, uploads, fileIds, uploadTimes, aggregates, retry, eventType);
        }else{
            retrievAndcreateContextTree(dateRanges, pods, queries, profilers, tenants, hosts, profiles, uploads, fileIds, uploadTimes, aggregates, retry, getEventType());
        }
        let end = performance.now();
        console.log("createContextTree time:" + (end - start));
    }

    function getLogContextWrapper(dateRanges, pods, queries, profilers, tenants, profiles, hosts, uploads, fileIds, uploadTimes, aggregates, eventType, contextTrees, customEvent){
        let customEventCount = 0;
        for (var customEvent in jfrevents1) {
            getLogContext(dateRanges, pods, queries, profilers, tenants, profiles, hosts, uploads, fileIds, uploadTimes, aggregates, eventType, contextTrees, customEvent);
            customEventCount++;
            break;
        }
        if(customEventCount == 0){
            getLogContext(dateRanges, pods, queries, profilers, tenants, profiles, hosts, uploads, fileIds, uploadTimes, aggregates, eventType, contextTrees, "jfr-context");
        }
    }

    function retrievAndcreateContextTree(dateRanges, pods, queries, profilers, tenants, hosts, profiles, uploads, fileIds, uploadTimes, aggregates, retry, eventType) {
        let start = performance.now();
        if(getEventType() === eventType) {
            resetTreeHeader("<div style='padding-right: 10px'>Retrieving profile data ... <span style='float: right;' class='spinner' id='profilespinner'></span></div>");
            showSpinner('profilespinner');
        }
        let isJstackEvent = false;
        if(eventType == "Jstack" || eventType == "json-jstack"){
            isJstackEvent=true;
        }
        const queryResults = fetchData(dateRanges, pods, queries, profilers, tenants, hosts, profiles, uploads, fileIds, uploadTimes, aggregates, retry, eventType);
        if (queryResults === undefined) {
            let end = performance.now();
            console.log("retrievAndcreateContextTree 0 time:" + (end - start) + " event:" + eventType);
            resetTreeHeader("<div style='padding-right: 10px'>Failed to retrieve profile data of "+eventType+"<span style='float: right;' class='spinner' id='profilespinner'></span></div>");
            hideSpinner('profilespinner');
            return;
        }
        spinnerToggle('spinnerId');

        queryResults.then(contextTrees => {

            let isError = false;

            for (let contextTree of contextTrees) {
                if (contextTree.hasOwnProperty("error_messages") && contextTree["error_messages"].length > 0) {
                    toastr_warning("Partial results returned. Recommend refreshing the page to retry.", null, {
                        timeOut: 0,
                        closeButton: true
                    });
                }
                if (contextTree["error"] != null) {
                    if (contextTree["error"].includes("JFR parser is busy")) {
                        toastr_warning("JFR parser is busy, please try after sometime");
                    } else {
                        toastr_error("Failed to process profile: " + contextTree["error"]);
                    }
                    isError = true;
                }else if(isJstackEvent){
                    if(contextTree.meta != undefined && contextTree.meta['jstack-interval'] != undefined){
                        let jstackinterval = contextTree.meta['jstack-interval'];
                        $("#event-type option[value='jstack']").html("Java (Thread State(s): All, Sampling Frequency: "+jstackinterval+" s)");
                        $("#event-type-flame option[value='jstack']").html("Java (Thread State(s): All, Sampling Frequency: "+jstackinterval+" s)");
                        $("#event-type-sample option[value='jstack']").html("Java (Thread State(s): All, Sampling Frequency: "+jstackinterval+" s)");
                        $("#event-type-river option[value='jstack']").html("Java (Thread State(s): All, Sampling Frequency: "+jstackinterval+" s)");
                        $("#event-type-surface option[value='jstack']").html("Java (Thread State(s): All, Sampling Frequency: "+jstackinterval+" s)");
                        $("#event-type-tsview option[value='jstack']").html("Java (Thread State(s): All, Sampling Frequency: "+jstackinterval+" s)");
                    }
                }
                if (contextTree["meta"] !== undefined && contextTree["meta"] != null && contextTree["meta"]["filename"] !== undefined && contextTree["meta"]["fileid"] !== undefined) {
                    uploadIDMap[contextTree["meta"]["fileid"]] = contextTree["meta"]["filename"];
                }
            }

            if (isError) {
                if(getEventType() === eventType) {
                    resetTreeHeader("");
                    let end = performance.now();
                    console.log("retrievAndcreateContextTree 1 time:" + (end - start) + " event:" + eventType);
                }
                spinnerToggle('spinnerId');
                hideSpinner('profilespinner');
                resetTreeHeader("<div style='padding-right: 10px'>Failed to retrieve profile data of "+eventType+"<span style='float: right;' class='spinner' id='profilespinner'></span></div>");
                return;
            }

            if (contextTrees.length !== profiles.length) {
                toastr_error("Failed to get both context trees.");
                let end = performance.now();
                console.log("retrievAndcreateContextTree 2 time:" + (end - start) + " event:" + eventType);
                return;
            }

            if (contextTrees.length === 1) {
                if (contextTrees[0].context !== undefined && contextTrees[0].context !== null) {
                    //$("#framefilterId").removeClass("hide");
                    isJfrContext = true;
                    //const defaultResult = {error_messages: [], sz: 0, ch: []};
                    setContextTreeFrames(contextTrees[0].context.frames, 1, eventType);

                    if (isCalltree) {
                        setContextTree(contextTrees[0], 1, eventType);
                        //setContextTreeInverted(invertTreeV1(contextTrees[0], 1), 1, eventType);
                    } else {
                        setContextTree(contextTrees[0], 1, eventType);
                    }
                    contextTrees[0].context.start = Math.round(contextTrees[0].context.start / 1000000);
                    contextTrees[0].context.end = Math.round(contextTrees[0].context.end / 1000000);
                    if ( (getEventType() == eventType)){//} && !(eventType == "json-jstack" && eventType.contains("dump_"))) || eventType == "jfr_dump.json.gz") { //todo check this, dirty fix for sfdc
                        if(uploads[0] == "true" && fileIds[0] != "") {
                            setContextData({"records": {}, "tidlist": [], "header": {}},1);
                        }else{
                            getLogContextWrapper(dateRanges, pods, queries, profilers, tenants, profiles, hosts, uploads, fileIds, uploadTimes, aggregates, eventType, contextTrees, customEvent);
                        }
                        for (var type in jfrprofiles1) {
                            if(type != eventType){//} && eventType != "jfr_dump.json.gz") {
                                retrievAndcreateContextTree(dateRanges, pods, queries, profilers, tenants, hosts, profiles, uploads, fileIds, uploadTimes, aggregates, retry, type);
                            }
                        }
                    }
                }
            } else {
                $("#framefilterId").addClass("hide");
                if (contextTrees[0].context !== undefined && contextTrees[1].context !== undefined && contextTrees[0].context !== null && contextTrees[1].context !== null) {
                    isJfrContext = true;

                    setContextTreeFrames(contextTrees[0].context.frames, 1, eventType);
                    setContextTreeFrames(contextTrees[1].context.frames, 2, eventType);

                    if (isCalltree) {
                        setContextTree(contextTrees[0], 1, eventType);
                        setContextTree(contextTrees[1], 2, eventType);
                        //setmergedContextTree(mergeTreesV1(invertTreeV1(contextTrees[0], 1), invertTreeV1(contextTrees[1], 2), 1), eventType);
                    } else {
                        setContextTree(contextTrees[0], 1, eventType);
                        setContextTree(contextTrees[1], 2, eventType);
                        //setmergedBacktraceTree(mergeTreesV1(contextTrees[0], contextTrees[1], 1), eventType);
                    }
                    contextTrees[0].context.start = Math.round(contextTrees[0].context.start / 1000000);
                    contextTrees[0].context.end = Math.round(contextTrees[0].context.end / 1000000);
                    contextTrees[1].context.start = Math.round(contextTrees[1].context.start / 1000000);
                    contextTrees[1].context.end = Math.round(contextTrees[1].context.end / 1000000);

                    //console.log("Skipping context data for compare tree");
                    //updateFilterViewStatus("Note: Context filter is disabled when compare option selected.");
                    //unhideFilterViewStatus();

                    $("#cct-panel").css("height","100%");

                    if ( (getEventType() == eventType)){//} && !(eventType == "json-jstack" && eventType.contains("dump_"))) || eventType == "jfr_dump.json.gz") { //todo check this, dirty fix for sfdc

                        getLogContextWrapper(dateRanges, pods, queries, profilers, tenants, profiles, hosts, uploads, fileIds, uploadTimes, aggregates, eventType, contextTrees, customEvent);

                        for (var type in jfrprofiles1) {
                            if(type != eventType){//} && eventType != "jfr_dump.json.gz") {
                                retrievAndcreateContextTree(dateRanges, pods, queries, profilers, tenants, hosts, profiles, uploads, fileIds, uploadTimes, aggregates, retry, type);
                            }
                        }
                    }
                }
            }
            if (!isJfrContext) {
                updateProfilerView();
            } else if (getEventType() == eventType) {//if SF profile, we need to wait for jfr_dump.json.gz event
                if(eventType.includes("jfr_dump") || eventType.includes("json-jstack")){
                    //console.log("waiting for jfr_dump.json.gz ...");
                    incrementTimer = setInterval(waitAndupdateProfilerView, 1000);
                }else {
                    updateProfilerView();
                }
            }
            spinnerToggle('spinnerId');
        }).catch(error => {
            let end = performance.now();
            console.log("retrievAndcreateContextTree 4 time:" + (end - start) + " event:" + eventType);
            if (retry) {
                console.log("retry retrievAndcreateContextTree " + eventType + " error: "+error.stack);
                retrievAndcreateContextTree(dateRanges, pods, queries, profilers, tenants, hosts, profiles, uploads, fileIds, uploadTimes, aggregates, false, eventType);
            } else {
                console.error(error);
                toastr_error("Failed to load data for the calling context tree:" + eventType);
            }
            spinnerToggle('spinnerId');
        });
        let end = performance.now();
        console.log("retrievAndcreateContextTree 5 time:" + (end - start) + " event:" + eventType);
    }

    function fetchOtherEvents(timeRange, tenant, host, count){
        for (var key in otherEvents1) {
            getOtherEvent(timeRange, tenant, host, key, count);
        }
    }

    let incrementRefreshTimer = undefined;
    let updateProfilerViewLock = false;
    let waitForEventCount = 0;
    let waitForEventMax = 600;
    function waitAndrefreshTree(count) {
        if(waitForEventCount > waitForEventMax){
            clearInterval(incrementRefreshTimer);
            console.log("waitAndrefreshTree timeout");
        }else {
            if ( (profile1 != undefined  && profile1 != "Jstacks") && (updateProfilerViewLock  || getContextTree(1, "jfr_dump.json.gz") === undefined)) {
                if(waitForEventCount == 0){
                    console.log("waitAndrefreshTree ... ");
                }
                waitForEventCount++;
            } else {
                updateProfilerViewLock = true;
                clearInterval(incrementRefreshTimer);
                refreshTree();
                updateProfilerViewLock = false;
            }
        }
    }

    let incrementTimer = undefined;
    function waitAndupdateProfilerView() {
        if(waitForEventCount > waitForEventMax){
            clearInterval(incrementTimer);
            console.log("waitAndupdateProfilerView timeout");
        }else {
            if ((profile1 != undefined  && profile1 != "Jstacks") && (updateProfilerViewLock  ||  getContextTree(1, "jfr_dump.json.gz") === undefined)) {
                if(waitForEventCount == 0){
                    console.log("waitAndupdateProfilerView ... ");
                }
                waitForEventCount++;
            } else {
                updateProfilerViewLock = true;
                clearInterval(incrementTimer);
                updateProfilerView();
                updateProfilerViewLock = false;
            }
        }
    }

    function fetchContextData(dateRanges, pods, queries, profilers, tenants, profiles, hosts, uploads, fileIds, uploadTimes, aggregates, eventType){
        const requests = [];
        let datacenters = [];
        for (let i = 0; i < tenants.length; i++) {
            if (tenants[i].includes(".")) {
                datacenters[i] = tenants[i].split(".")[0].trim();
                tenants[i] = tenants[i].split(".")[1].trim();
            }else {
                datacenters[i] = tenants[i];
            }
        }
        let toTenant = "";
        if (uploads[0] != "true" && isS3 == "false") {
            toTenant = datacenters[0];
        }
        const callTreeUrl = getCallTreeUrl(dateRanges[0], pods[0], queries[0], profilers[0], tenants[0], profiles[0], hosts[0], uploads[0], fileIds[0], uploadTimes[0], aggregates[0], eventType);
        requests.push(callTreePerfGenieAjax(toTenant, "GET", callTreeUrl, result => result));
        if (profiles.length === 2) {
            let toTenant = "";
            if (uploads[1] != "true") {
                toTenant = datacenters[1];
            }
            const callTreeUrl = getCallTreeUrl(dateRanges[1], pods[1], (queries.length === 2) ? queries[1] : '', (profilers.length === 2) ? profilers[1] : '', (tenants.length === 2) ? tenants[1] : '', (profiles.length === 2) ? profiles[1] : '', (hosts.length === 2) ? hosts[1] : '', (uploads.length === 2) ? uploads[1] : '', (fileIds.length === 2) ? fileIds[1] : '', (uploadTimes.length === 2) ? uploadTimes[1] : '', aggregates[1], eventType);
            requests.push(callTreePerfGenieAjax(toTenant, "GET", callTreeUrl, result => result));
        }
        return Promise.all(requests);
    }


    function getLogContext(dateRanges, pods, queries, profilers, tenants, profiles, hosts, uploads, fileIds, uploadTimes, aggregates, eventType, contextTrees, customEvent) {
        let start = performance.now();

        unhideFilterViewStatus();
        updateFilterViewStatus("<div style='padding-right: 0px'>Retrieving request context of profile, this may take few sec  ... <span style='float: right;' class='spinner' id='contextspinner'></span></div>");
        showSpinner('contextspinner');

        let queryResults = fetchContextData(dateRanges, pods, queries, profilers, tenants, profiles, hosts, uploads, fileIds, uploadTimes, aggregates, customEvent);
        if (queryResults === undefined) {
            let end = performance.now();
            console.log("getLogContext 0 time:" + (end - start) + " event:" + customEvent);
            return;
        }
        console.log("getLogContext done");

        queryResults.then(contextDatas => {
            let isError = false;
            if (contextDatas.length === 1) {
                if(contextDatas[0] === "") {
                    console.log("log context not available in JFR");
                    updateFilterViewStatus("Note: Failed to get Request context.");
                    toastr_warning("Failed to get Request context.");
                    setContextData({"records": {}, "tidlist": [], "header": {}},1);
                    fetchOtherEvents(dateRanges[0], tenants[0], hosts[0], 1);
                    showContextFilter();
                    hideFilterViewStatus();
                    refreshTreeAfterContext(customEvent);
                }else {
                    if(contextDatas[0].tidlist == undefined && contextDatas[0].error != undefined){
                        updateFilterViewStatus("Note: Failed to get Request context.");
                        toastr_warning("Failed to get Request context.");
                        setContextData({"records": {}, "tidlist": [], "header": {}},1);
                        fetchOtherEvents(dateRanges[0], tenants[0], hosts[0], 1);
                        showContextFilter();
                        hideFilterViewStatus();
                        refreshTreeAfterContext(customEvent);
                    }else {
                        setContextData(contextDatas[0],1);
                        fetchOtherEvents(dateRanges[0], tenants[0], hosts[0], 1);
                        //showContextFilter();
                        //hideFilterViewStatus();
                        refreshTreeAfterContext(customEvent);
                    }
                }
            }else{
                if(contextDatas[0] === "" || contextDatas[1] === "") {
                    console.log("log context not available in JFR");
                    updateFilterViewStatus("Note: Failed to get Request context.");
                    toastr_warning("Failed to get Request context.");
                    setContextData({"records": {}, "tidlist": [], "header": {}},1);
                    setContextData({"records": {}, "tidlist": [], "header": {}},2);
                    fetchOtherEvents(dateRanges[0], tenants[0], hosts[0], 1);
                    fetchOtherEvents(dateRanges[1], tenants[1], hosts[1], 2);
                    showContextFilter();
                    hideFilterViewStatus();
                    refreshTreeAfterContext(customEvent);
                }else {
                    if(contextDatas[0].tidlist == undefined && contextDatas[0].error != undefined){
                        updateFilterViewStatus("Note: Failed to get Request context.");
                        toastr_warning("Failed to get Request context.");
                        setContextData({"records": {}, "tidlist": [], "header": {}},2);
                        fetchOtherEvents(dateRanges[0], tenants[0], hosts[0], 1);
                        fetchOtherEvents(dateRanges[1], tenants[1], hosts[1], 2);
                        showContextFilter();
                        hideFilterViewStatus();
                        refreshTreeAfterContext(customEvent);
                    }else {
                        setContextData(contextDatas[0],1);
                        setContextData(contextDatas[1],2);
                        fetchOtherEvents(dateRanges[0], tenants[0], hosts[0], 1);
                        fetchOtherEvents(dateRanges[1], tenants[1], hosts[1], 2);
                        //showContextFilter();
                        //hideFilterViewStatus();
                        refreshTreeAfterContext(customEvent);
                    }
                }
            }

            }).catch(error => {
                setContextData({"records": {}, "tidlist": [], "header": {}},1);
                fetchOtherEvents(dateRanges[0], tenants[0], hosts[0], 1);
                updateFilterViewStatus("Note: Failed to get Request context.");
                toastr_warning("Failed to get Request context.");
                refreshTreeAfterContext(customEvent);
                console.error(error);
            });
    }

    function getLogContextold(timeRange, pod, query, profiler, tenant, profile, host, upload, fileId, uploadTime, aggregate, eventType, start, end, customEvent) {
        unhideFilterViewStatus();
        updateFilterViewStatus("<div style='padding-right: 0px'>Retrieving request context of profile, this may take few sec  ... <span style='float: right;' class='spinner' id='contextspinner'></span></div>");
        showSpinner('contextspinner');

        const callTreeUrl = getCallTreeUrl(timeRange, pod, query, profiler, tenant, profile, host, upload, fileId, uploadTime, aggregate, customEvent);
        let toTenant = tenant;
        if(isS3 == "true") {
            toTenant = "";
        }
        let request = stackDigVizAjax(toTenant, "GET", callTreeUrl, function (response) { // success function
            console.log("getLogContext done");
            if(response === "") {
                console.log("log context not available in JFR, will fetch from Splunk");
                updateFilterViewStatus("Note: Failed to get Request context.");
                toastr_warning("Failed to get Request context.");
                setContextData({"records": {}, "tidlist": [], "header": {}},1);
                fetchOtherEvents(timeRange, tenant, host);

                showContextFilter();
                hideFilterViewStatus();

                refreshTreeAfterContext(customEvent);
            }else {
                if(response.tidlist == undefined && response.error != undefined){
                    updateFilterViewStatus("Note: Failed to get Request context.");
                    toastr_warning("Failed to get Request context.");
                    setContextData({"records": {}, "tidlist": [], "header": {}},1);
                    fetchOtherEvents(timeRange, tenant, host);

                    showContextFilter();
                    hideFilterViewStatus();
                    refreshTreeAfterContext(customEvent);
                }else {
                    setContextData(response,1);
                    fetchOtherEvents(timeRange, tenant, host);

                    showContextFilter();
                    hideFilterViewStatus();

                    refreshTreeAfterContext(customEvent);
                }
            }
        }, function (error) {
            if(error.status == 401){
                location.reload();
            }
            setContextData({"records": {}, "tidlist": [], "header": {}},1);
            fetchOtherEvents(timeRange, tenant, host);
            updateFilterViewStatus("Note: Failed to get Request context.");
            toastr_warning("Failed to get Request context.");
            console.error(error);
        });
    }

    function refreshTreeAfterContext(customEvent){
        //if sfdc, we need to wait for jfr_dump.json.gz
        if(customEvent.includes("jfr_dump")){
            //console.log("waiting for jfr_dump.json.gz ...");
            incrementRefreshTimer = setInterval(waitAndrefreshTree, 1000);
        }else {
            refreshTree();
        }
    }

    function setOtherEventData(data, count){
        let localContextData = getContextData(count);
        if(localContextData.records != undefined && data.records != undefined){

            for (var customevent in data.records) {
                if(customevent == "monitor-context"){
                    let note = "";
                    let contextDataRecords = data.records[customevent];

                    for (var tid in contextDataRecords) {
                        contextDataRecords[tid].forEach(function (obj) {
                            let record = obj.record;
                            if(record["8"] == "true"){
                                note = note +  " tid:"+tid+"<a title='click to view lock details' style='cursor: pointer;' class='fa fa-eye' onclick='showLockDetail(" + record[0] + ", " + tid + ", \"" + count + "\")'></a>";
                            }
                        });
                    }
                    if(note != "") {
                        $("#timeLineChartError").html("Deadlocks detected: " + note);
                        $('#timeLineChartError').show();
                    }
                }
                localContextData.records[customevent] = data.records[customevent];
            }
        }
        if(localContextData.header != undefined && data.header != undefined){
            for (var customevent in data.header) {
                otherEventsFetched[customevent]=true;
                localContextData.header[customevent] = data.header[customevent];
                $('#other-event-input').append($('<option>', {
                    value: customevent,
                    text: customevent
                }));
                //if no options exist then reload the table to show this other event. URL sharing may not work when there are many other events
                if($('#other-event-input')[0].children.length == 1){
                    genRequestTable();
                }
                Toastify({
                    text: customevent + " data loaded",
                    duration: 8000
                }).showToast();
                $("#cct-panel").css("height", "100%");//expand context table view
            }
        }
        console.log("setOtherEventData done count:" + count);
    }
    let otherEventsMaxAjaxTris = {};
    function getOtherEvent(timeRange, tenant, host, customEvent, count) {
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
        let toTenant = tenant;
        if(isS3 == "true") {
            toTenant = "";
        }
        let request = stackDigVizAjax(toTenant, "GET", callTreeUrl, function (response) { // success function
            console.log("getOtherEvent done count:" + count);
            if(response == undefined || response === "" || response.header == undefined) {
                console.log("Warn: unable to fetch other event" + customEvent);
            }else {
                setOtherEventData(response, count);
            }
        }, function (error) {
            if(error.status == 401){
                location.reload();
            }
            console.log("Warn: unable to fetch other event" + customEvent);
        });
    }

    function setNote(eventType){
        if(eventType.includes("Socket")){
            //addTabNote(true,"socket R/W events are captured only when R/W operation takes more than xx ms");
            //return "Note: socket R/W events are captured only when R/W operation takes more than xx ms";
        }else{
            //addTabNote(false,"");
        }
        //return "";
    }

    function refreshTree() {
        isRefresh = true;
        updateProfilerView();
    }

    //create html tree recursively
    function updateProfilerView(level) {
        if($("#tabs .ui-tabs-panel:visible").attr("id") == "flame"){
            updateTabUrl("#flame");
            updateProfilerViewFlame(level);
        }else if($("#tabs .ui-tabs-panel:visible").attr("id") == "cct"){
            updateTabUrl("#cct");
            updateProfilerViewCCT(level);
        }else if($("#tabs .ui-tabs-panel:visible").attr("id") == "samples"){
            updateTabUrl("#samples");
            updateProfilerViewSample(level);
        }else if($("#tabs .ui-tabs-panel:visible").attr("id") == "tsview"){
            updateTabUrl("#tsview");
            updateProfilerViewTsview(level);
        }else if($("#tabs .ui-tabs-panel:visible").attr("id") == "river"){
            updateTabUrl("#river");
            updateProfilerViewRiver(level);
        }else if($("#tabs .ui-tabs-panel:visible").attr("id") == "surface"){
            updateTabUrl("#surface");
            updateProfilerViewSurface(level);
        }
    }



    // [ajax request(s)] gets context tree data
    let numberOfTries = {};
    let maxAjaxRetries = 1;
    function fetchData(dateRanges, pods, queries, profilers, tenants, hosts, profiles, uploads, fileIds, uploadTimes, aggregates, retry, eventType) {
        const requests = [];
        let datacenters = [];
        for (let i = 0; i < tenants.length; i++) {
            if (tenants[i].includes(".")) {
                datacenters[i] = tenants[i].split(".")[0].trim();
                tenants[i] = tenants[i].split(".")[1].trim();
            }else {
                datacenters[i] = tenants[i];
            }
        }
        let toTenant = "";

        if (uploads[0] != "true" && isS3 == "false") {
            toTenant = datacenters[0];
        }
        const callTreeUrl = getCallTreeUrl(dateRanges[0], pods[0], queries[0], profilers[0], tenants[0], profiles[0], hosts[0], uploads[0], fileIds[0], uploadTimes[0], aggregates[0], eventType);

        if(numberOfTries[callTreeUrl] == undefined){
            numberOfTries[callTreeUrl] = 1;
        }else{
            numberOfTries[callTreeUrl]++;
        }

        if(numberOfTries[callTreeUrl] > maxAjaxRetries){
            console.log("fetchData reached max for this URL:" + callTreeUrl);
            return undefined;
        }

        if (retry) {
            requests.push(callTreePerfGenieAjax(toTenant, "GET", callTreeUrl, result => result));
        } else {
            requests.push(callTreePerfGenieAjax(toTenant, "GET", callTreeUrl, result => result));
        }
        if (profiles.length === 2) {
            let toTenant = "";
            if (uploads[1] != "true" && isS3 == "false") {
                toTenant = datacenters[1];
            }
            const callTreeUrl = getCallTreeUrl(dateRanges[1], pods[1], (queries.length === 2) ? queries[1] : '', (profilers.length === 2) ? profilers[1] : '', (tenants.length === 2) ? tenants[1] : '', (profiles.length === 2) ? profiles[1] : '', (hosts.length === 2) ? hosts[1] : '', (uploads.length === 2) ? uploads[1] : '', (fileIds.length === 2) ? fileIds[1] : '', (uploadTimes.length === 2) ? uploadTimes[1] : '', aggregates[1], eventType);
            if (retry) {
                requests.push(callTreePerfGenieAjax(toTenant, "GET", callTreeUrl, result => result));
            } else {
                requests.push(callTreePerfGenieAjax(toTenant, "GET", callTreeUrl, result => result));
            }
        }
        return Promise.all(requests);
    }

    function getDiagEventUrl(timestamp, tenant, host, guid, name){
        let endpoint = "/v1/event/" + tenant + "/?start=" + timestamp + "&end=" + timestamp +
            "&metadata_query=" + encodeURIComponent("host=" + host) +
            "&metadata_query=" + encodeURIComponent("tenant-id=" + tenant) +
            "&metadata_query=" + encodeURIComponent("guid=" + guid) +
            "&metadata_query=" + encodeURIComponent("name=" + name);
        if(dataSource.includes("genie")){
            endpoint += "&metadata_query=" + encodeURIComponent("source=" + dataSource);
        }
        return endpoint;
    }

    function getEventUrl(timeRange, tenant, host, customEvent){
        let endpoint = "";
        const start = parseInt(timeRange.split(" - ")[0]);
        const end = parseInt(timeRange.split(" - ")[1]);
        endpoint = "/v1/otherevents/" + tenant + "/?start=" + start + "&end=" + end +
            "&metadata_query=" + encodeURIComponent("host=" + host) +
            "&metadata_query=" + encodeURIComponent("tenant-id=" + tenant) +
            "&metadata_query=" + encodeURIComponent("name=" + customEvent);
        if(dataSource.includes("genie")){
            endpoint += "&metadata_query=" + encodeURIComponent("source=" + dataSource);
        }
        return endpoint;
    }

    // the url to get calling context trees
    function getCallTreeUrl(timeRange, pod, query, profiler, tenant, profile, host, upload, fileId, uploadTime, aggregate, eventType) {
        // for debug console.log("getCallTreeUrl timeRange:" + timeRange + " pod:" + pod + " query:"+query + " profiler:" + profiler + " tenant:"+tenant + " profile:" + profile + " host:" + host + " upload:" + upload + " fileId:" + fileId + " uploadTime:" + uploadTime + " aggregate:" + aggregate)
        let endpoint = "";
        {
            //for any type of profile selection jstacks are handled in the same way
            if (eventType == "Jstack" || eventType == "json-jstack") {
                const start = parseInt(timeRange.split(" - ")[0]);
                const end = parseInt(timeRange.split(" - ")[1]);
                endpoint = "/v1/jstacks/" + tenant + "/?start=" + start + "&end=" + end +
                    "&metadata_query=" + encodeURIComponent("host=" + host) +
                    "&metadata_query=" + encodeURIComponent("tenant-id=" + tenant) +
                    "&metadata_query=" + encodeURIComponent("file-name=" + eventType);
                if(dataSource.includes("genie")){
                    endpoint += "&metadata_query=" + encodeURIComponent("source=" + dataSource);
                }
                return endpoint;
            }

            if (profile === "All") {
                const start = parseInt(timeRange.split(" - ")[0]);
                const end = parseInt(timeRange.split(" - ")[1]);
                if (eventType == "jfr-context" || eventType.includes("jfr_dump_log")) {
                    endpoint = "/v1/customevents/" + tenant + "/?start=" + start + "&end=" + end +
                        "&metadata_query=" + encodeURIComponent("host=" + host) +
                        "&metadata_query=" + encodeURIComponent("tenant-id=" + tenant) +
                        "&metadata_query=" + encodeURIComponent("file-name=" + eventType);
                } else {
                    endpoint = "/v1/profiles/" + tenant + "/?start=" + start + "&end=" + end +
                        "&metadata_query=" + encodeURIComponent("host=" + host) +
                        "&metadata_query=" + encodeURIComponent("tenant-id=" + tenant) +
                        "&metadata_query=" + encodeURIComponent("file-name=" + eventType);
                }
            } else if(profile === "Jstacks"){
                const start = parseInt(timeRange.split(" - ")[0]);
                const end = parseInt(timeRange.split(" - ")[1]);
                if (eventType == "jfr-context" || eventType.includes("jfr_dump_log")) {
                        endpoint = "/v1/customevents/" + tenant + "/?start=" + start + "&end=" + end +
                            "&metadata_query=" + encodeURIComponent("host=" + host) +
                            "&metadata_query=" + encodeURIComponent("tenant-id=" + tenant) +
                            "&metadata_query=" + encodeURIComponent("file-name=" + eventType);
                }
            }else{
                let array = profile.split(" - ");
                const timestamp = array[0];
                let guid = eventType.includes("jfr_dump") ? array[1] + eventType : array[1];
                endpoint = "/v1/profile/" + tenant + "/?start=" + timestamp + "&end=" + timestamp +
                    "&metadata_query=" + encodeURIComponent("host=" + host) +
                    "&metadata_query=" + encodeURIComponent("tenant-id=" + tenant) +
                    "&metadata_query=" + encodeURIComponent("guid=" + guid) +
                    "&metadata_query=" + encodeURIComponent("file-name=" + eventType);
            }
        }
        if(dataSource.includes("genie")){
            endpoint += "&metadata_query=" + encodeURIComponent("source=" + dataSource);
        }
        return endpoint;
    }

    function actViewKeyDown(evt) {
        evt = evt || window.event;
        const cctmodalElement = document.getElementById("cctpopup");

        if (cctmodalElement !== null && cctmodalElement.style.display !== "none") {
            console.log("cctpopup active " + clickC+ ":" +evt.keyCode);
            clickC++;
        }
    };

    $(function () {
        $(".img-swap").click(function () {
            if (compareTree) {
                $(".img-swap").each(function () {
                    this.src = this.src.replace("_on", "_off");
                });
                this.src = this.src.replace("_off", "_on");
                spinnerToggle('spinnerId');
                prevOption = currentOption;
                currentOption = Number($(this).attr('opt'));
                updateProfilerView();
                spinnerToggle('spinnerId');
            }
        });
    });

    function backtrace() {
        if (!isCalltree) {
            return;
        }
        updateUrl("isCalltree", false, true);
        isCalltree = false;

        if (getActiveTree(getEventType(), isCalltree) === undefined) {
            validateInputAndcreateContextTree(true);
        } else {
            updateProfilerView();
        }
    }

    function calltree() {
        if (isCalltree) {
            return;
        }
        updateUrl("isCalltree", true, true);
        isCalltree = true;
        if (getActiveTree(getEventType(), isCalltree) === undefined) {
            validateInputAndcreateContextTree(true);
        } else {
            updateProfilerView();
        }
    }

    function resetTreeHeader(msg) {
        $("span.cct-header-guid").html(msg);
        $("span.cct-search-guid").html("");
        $("ul.tree").html("");
    }

    function getTextForAggregationInput(tree) {
        let text = "<br><span>";
        // trim off prefix
        let metadata = tree["meta"];
        Object.keys(metadata).forEach(key => text += key.replace("aggregation-", "") + ": " + metadata[key] + "; ");
        text += "</span>";
        return text;
    }

    function isAggregation() {
        const urlParams = new URLSearchParams(location.href);
        return urlParams.get("is-aggregation") === "true";
    }

    function getTenantFromURL() {
        const urlParams = new URLSearchParams(location.href);
        let tenant = (urlParams.get("tenant"));
        return tenant ? tenant : ""; // return empty string when tenant is not set
    }

    function setAggregationFlag() {
        return "is-aggregation=true";
    }

    function getThreadState(state){
        if(state == 0){
            return "RUNNABLE";
        }else if(state == 1){
            return "BLOCKED";
        }else if(state == 2){
            return "WAITING";
        }else if(state == 3){
            return "TIMED_WAITING";
        }
    }
</script>