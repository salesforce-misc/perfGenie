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
        $("#event-type-surface").val(event_type);
        $("#event-type-river").val(event_type);
        $("#event-type-sample").val(event_type);
        $("#event-type-flame").val(event_type);
        $("#event-type").val(event_type);
        updateUrl("filterEvent",filterEvent,true);
        let note = getNote(filterEvent);
        if(note != ""){
            $('#cct-note').text(note);
            $('#cct-note').show();
        }else{
            $('#cct-note').hide();
        }
        applyFilter();
    }

    $(document).ready(() => {
        $( "#tabs" ).tabs({
            activate: function (event, ui) {
                if(ui.newPanel.attr("id") == "cct"){
                    updateProfilerViewCCT(prevSelectedLevel,true);
                }else if(ui.newPanel.attr("id") == "flame"){
                    updateProfilerViewFlame(prevSelectedLevel,true);
                }else if(ui.newPanel.attr("id") == "samples"){
                    updateProfilerViewSample(prevSelectedLevel,true);
                }else if(ui.newPanel.attr("id") == "tsview"){
                    updateProfilerViewTsview(prevSelectedLevel,true);
                }else if(ui.newPanel.attr("id") == "river"){
                    updateProfilerViewRiver(prevSelectedLevel,true);
                }else if(ui.newPanel.attr("id") == "surface"){
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
        for (var key in jfrprofiles1) {
            if(filterEvent == key) {
                $('#event-type').append($('<option>', {
                    value: key,
                    text: key,
                    selected: true
                }));
                $('#event-type-flame').append($('<option>', {
                    value: key,
                    text: key,
                    selected: true
                }));
                $('#event-type-sample').append($('<option>', {
                    value: key,
                    text: key,
                    selected: true
                }));
                $('#event-type-river').append($('<option>', {
                    value: key,
                    text: key,
                    selected: true
                }));
                $('#event-type-surface').append($('<option>', {
                    value: key,
                    text: key,
                    selected: true
                }));
            }else{
                $('#event-type').append($('<option>', {
                    value: key,
                    text: key
                }));
                $('#event-type-flame').append($('<option>', {
                    value: key,
                    text: key
                }));
                $('#event-type-sample').append($('<option>', {
                    value: key,
                    text: key
                }));
                $('#event-type-river').append($('<option>', {
                    value: key,
                    text: key,
                    selected: true
                }));
                $('#event-type-surface').append($('<option>', {
                    value: key,
                    text: key,
                    selected: true
                }));
            }
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
        }
    }

    function createJFRCallTree(count) {
        if (count == 1) {
            if (getContextTree(1).context !== undefined && getContextTree(1).context !== null) {
                isJfrContext = true;
            } else {
                const defaultResult = {error_messages: [], total: 0, roots: []};
                setmergedContextTree(mergeTrees(invertTree(getContextTree(1)), defaultResult));
            }
        } else {
            if (getContextTree(1).context !== undefined && getContextTree(1).context !== null && getContextTree(2).context !== undefined && getContextTree(2).context !== null) {
                isJfrContext = true;
                setmergedContextTree(mergeTreesV1(invertTreeV1(getContextTree(1), 1), invertTreeV1(getContextTree(2), 2), 1));
            } else {
                setmergedContextTree(mergeTrees(invertTree(getContextTree(1)), invertTree(getContextTree(2))));
            }
        }
    }

    function createContextTree(dateRanges, pods, queries, profilers, tenants, hosts, profiles, uploads, fileIds, uploadTimes, aggregates, retry) {
        let start = performance.now();
        if (isCalltree == true && getmergedContextTree() === undefined && getContextTree(1) !== undefined) {
            // this will happen when backtrace view  is loaded and requesting a call tree view
            resetTreeHeader("Inverting tree ...");
            spinnerToggle('spinnerId');
            createJFRCallTree(profiles.length); //generate call tree from back trace

            //apply filter and display tree
            updateProfilerView();
            spinnerToggle('spinnerId');
            let end = performance.now();
            console.log("createContextTree time:" + (end - start));
            return;
        }
        //data not available, retrieve and create context tree
        retrievAndcreateContextTree(dateRanges, pods, queries, profilers, tenants, hosts, profiles, uploads, fileIds, uploadTimes, aggregates, retry, getEventType());
        let end = performance.now();
        console.log("createContextTree time:" + (end - start));
    }

    function retrievAndcreateContextTree(dateRanges, pods, queries, profilers, tenants, hosts, profiles, uploads, fileIds, uploadTimes, aggregates, retry, eventType) {
        let start = performance.now();
        if(getEventType() === eventType) {
            resetTreeHeader("Retrieving tree data ...");
        }
        const queryResults = fetchData(dateRanges, pods, queries, profilers, tenants, hosts, profiles, uploads, fileIds, uploadTimes, aggregates, retry, eventType);
        if (queryResults === undefined) {
            let end = performance.now();
            console.log("retrievAndcreateContextTree 0 time:" + (end - start) + " event:" + eventType);
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
                }else if(eventType == "Jstack"){
                    if(contextTree.meta != undefined && contextTree.meta['jstack-interval'] != undefined){
                        let jstackinterval = contextTree.meta['jstack-interval'];
                        $("#event-type option[value='jstack']").html("Java (Thread State(s): All, Sampling Frequency: "+jstackinterval+" s)");
                        $("#event-type-flame option[value='jstack']").html("Java (Thread State(s): All, Sampling Frequency: "+jstackinterval+" s)");
                        $("#event-type-sample option[value='jstack']").html("Java (Thread State(s): All, Sampling Frequency: "+jstackinterval+" s)");
                        $("#event-type-river option[value='jstack']").html("Java (Thread State(s): All, Sampling Frequency: "+jstackinterval+" s)");
                        $("#event-type-surface option[value='jstack']").html("Java (Thread State(s): All, Sampling Frequency: "+jstackinterval+" s)");
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
                    const defaultResult = {error_messages: [], sz: 0, ch: []};
                    if(contextTree1Frames == undefined){
                        contextTree1Frames = contextTrees[0].context.frames;
                        contextTree1Frames[3506402] = "root";
                    }
                    if (eventType == "Jstack") {
                        for (var key in contextTrees[0].context.frames) {
                            if(contextTree1Frames[key] === undefined){
                                contextTree1Frames[key]=contextTrees[0].context.frames[key];
                            }
                        }
                    }
                    if (isCalltree) {
                        setContextTree(contextTrees[0], 1, eventType);
                        setContextTreeInverted(invertTreeV1(contextTrees[0], 1), 1, eventType);
                    } else {
                        setContextTree(contextTrees[0], 1, eventType);
                    }
                    contextTrees[0].context.start = Math.round(contextTrees[0].context.start / 1000000);
                    contextTrees[0].context.end = Math.round(contextTrees[0].context.end / 1000000);
                    if (getEventType() == eventType) {
                        if(uploads[0] == "true" && fileIds[0] != "") {
                            setContextData({"records": {}, "tidlist": [], "header": {}});
                        }else{
                            getLogContext(dateRanges[0], pods[0], queries[0], profilers[0], tenants[0], profiles[0], hosts[0], uploads[0], fileIds[0], uploadTimes[0], aggregates[0], eventType, contextTrees[0].context.start, contextTrees[0].context.end);
                        }
                        for (var type in jfrprofiles1) {
                            if(type != eventType) {
                                retrievAndcreateContextTree(dateRanges, pods, queries, profilers, tenants, hosts, profiles, uploads, fileIds, uploadTimes, aggregates, retry, type);
                            }
                        }
                    }
                } else {
                    $("#framefilterId").addClass("hide");
                    const defaultResult = {error_messages: [], size: 0, children: []};
                    if (isCalltree) {
                        setmergedContextTree(mergeTrees(invertTree(contextTrees[0]), defaultResult), eventType);
                    } else {
                        setContextTree(contextTrees[0], 1, eventType);//cache to generate backtrave view
                        setmergedBacktraceTree(mergeTrees(contextTrees[0], defaultResult), eventType);
                    }
                }
            } else {
                $("#framefilterId").addClass("hide");
                if (contextTrees[0].context !== undefined && contextTrees[1].context !== undefined && contextTrees[0].context !== null && contextTrees[1].context !== null) {
                    isJfrContext = true;
                    if(contextTree1Frames == undefined){
                        contextTree1Frames = contextTrees[0].context.frames;
                        contextTree1Frames[3506402] = "root";
                    }
                    if(contextTree2Frames == undefined){
                        contextTree2Frames = contextTrees[1].context.frames;
                    }

                    if (eventType == "Jstack") {
                        for (var key in contextTrees[0].context.frames) {
                            if(contextTree1Frames[key] === undefined){
                                contextTree1Frames[key]=contextTrees[0].context.frames[key];
                            }
                        }
                        for (var key in contextTrees[1].context.frames) {
                            if(contextTree2Frames[key] === undefined){
                                contextTree2Frames[key]=contextTrees[1].context.frames[key];
                            }
                        }
                    }

                    if (isCalltree) {
                        setmergedContextTree(mergeTreesV1(invertTreeV1(contextTrees[0], 1), invertTreeV1(contextTrees[1], 2), 1), eventType);
                    } else {
                        setContextTree(contextTrees[0], 1, eventType);
                        setContextTree(contextTrees[1], 2, eventType);
                        setmergedBacktraceTree(mergeTreesV1(contextTrees[0], contextTrees[1], 1), eventType);
                    }
                    console.log("Skipping context data for compare tree");
                    updateFilterViewStatus("Note: Context filter is disabled when compare option selected.");

                    unhideFilterViewStatus();
                    $("#cct-panel").css("height","100%");

                    if (eventType == getEventType()) {
                        for (var type in jfrprofiles1) {
                            if(type != eventType) {
                                retrievAndcreateContextTree(dateRanges, pods, queries, profilers, tenants, hosts, profiles, uploads, fileIds, uploadTimes, aggregates, retry, type);
                            }
                        }
                    }
                } else {
                    if (isCalltree) {
                        setmergedContextTree(mergeTrees(invertTree(contextTrees[0]), invertTree(contextTrees[1])), eventType);
                    } else {
                        setContextTree(contextTrees[0], 1, eventType);//cache to generate backtrave view
                        setContextTree(contextTrees[1], 2, eventType);//cache to generate backtrave view
                        setmergedBacktraceTree(mergeTrees(contextTrees[0], contextTrees[1]), eventType);
                    }
                }

            }
            if (!isJfrContext) {
                updateProfilerView();
            } else if (getEventType() == eventType) {
                updateProfilerView();
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

    function getLogContext(timeRange, pod, query, profiler, tenant, profile, host, upload, fileId, uploadTime, aggregate, eventType, start, end) {
        unhideFilterViewStatus();
        updateFilterViewStatus("Note: Retrieving request context from jfr, this may take few sec  ...");
        const callTreeUrl = getCallTreeUrl(timeRange, pod, query, profiler, tenant, profile, host, upload, fileId, uploadTime, aggregate, "customEvent");
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
                setContextData({"records": {}, "tidlist": [], "header": {}});
            }else {
                if(response.tidlist == undefined && response.error != undefined){
                    updateFilterViewStatus("Note: Failed to get Request context.");
                    toastr_warning("Failed to get Request context.");
                    setContextData({"records": {}, "tidlist": [], "header": {}});
                }else {
                    setContextData(response);
                    showContextFilter();
                    hideFilterViewStatus();
                    refreshTree();
                }
            }
        }, function (error) {
            setContextData({"records": {}, "tidlist": [], "header": {}});
            updateFilterViewStatus("Note: Failed to get Request context.");
            toastr_warning("Failed to get Request context.");
            console.error(error);
        });
    }

    function getNote(eventType){
        if(eventType.includes("Socket")){
            return "Note: socket R/W events are captured only when R/W operation takes more than xx ms";
        }
        return "";
    }

    function refreshTree() {
        isRefresh = true;
        updateProfilerView();
    }

    //create html tree recursively
    function updateProfilerView(level) {
        if($("#tabs .ui-tabs-panel:visible").attr("id") == "flame"){
            updateProfilerViewFlame(level);
        }else if($("#tabs .ui-tabs-panel:visible").attr("id") == "cct"){
            updateProfilerViewCCT(level);
        }else if($("#tabs .ui-tabs-panel:visible").attr("id") == "samples"){
            updateProfilerViewSample(level);
        }else if($("#tabs .ui-tabs-panel:visible").attr("id") == "tsview"){
            updateProfilerViewTsview(level);
        }else if($("#tabs .ui-tabs-panel:visible").attr("id") == "river"){
            updateProfilerViewRiver(level);
        }else if($("#tabs .ui-tabs-panel:visible").attr("id") == "surface"){
            updateProfilerViewSurface(level);
        }
    }

    // [ajax request(s)] gets context tree data
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
        if (retry) {
            requests.push(callTreeStackDigVizAjax(toTenant, "GET", callTreeUrl, result => result));
        } else {
            requests.push(callTreeStackDigVizAjax(toTenant, "GET", callTreeUrl, result => result));
        }
        if (profiles.length === 2) {
            let toTenant = "";
            if (uploads[1] != "true" && isS3 == "false") {
                toTenant = datacenters[1];
            }
            const callTreeUrl = getCallTreeUrl(dateRanges[1], pods[1], (queries.length === 2) ? queries[1] : '', (profilers.length === 2) ? profilers[1] : '', (tenants.length === 2) ? tenants[1] : '', (profiles.length === 2) ? profiles[1] : '', (hosts.length === 2) ? hosts[1] : '', (uploads.length === 2) ? uploads[1] : '', (fileIds.length === 2) ? fileIds[1] : '', (uploadTimes.length === 2) ? uploadTimes[1] : '', aggregates[1], eventType);
            if (retry) {
                requests.push(callTreeStackDigVizAjax(toTenant, "GET", callTreeUrl, result => result));
            } else {
                requests.push(callTreeStackDigVizAjax(toTenant, "GET", callTreeUrl, result => result));
            }
        }
        return Promise.all(requests);
    }

    // the url to get calling context trees
    function getCallTreeUrl(timeRange, pod, query, profiler, tenant, profile, host, upload, fileId, uploadTime, aggregate, eventType) {
        // for debug console.log("getCallTreeUrl timeRange:" + timeRange + " pod:" + pod + " query:"+query + " profiler:" + profiler + " tenant:"+tenant + " profile:" + profile + " host:" + host + " upload:" + upload + " fileId:" + fileId + " uploadTime:" + uploadTime + " aggregate:" + aggregate)
        let endpoint = "";
        {
            if (eventType == "Jstack") {
                const start = parseInt(timeRange.split(" - ")[0]);
                const end = parseInt(timeRange.split(" - ")[1]);
                endpoint = "/v1/jstack/" + tenant + "/?start=" + start + "&end=" + end +
                    "&metadata_query=" + encodeURIComponent("host=" + host) +
                    "&metadata_query=" + encodeURIComponent("tenant=" + tenant) +
                    "&metadata_query=" + encodeURIComponent("name=Jstack");
                return endpoint;
            }
            if (profile == "Jstacks") {
                const start = parseInt(timeRange.split(" - ")[0]);
                const end = parseInt(timeRange.split(" - ")[1]);
                endpoint = "/v1/customevents/" + tenant + "/?start=" + start + "&end=" + end +
                    "&metadata_query=" + encodeURIComponent("host=" + host) +
                    "&metadata_query=" + encodeURIComponent("tenant=" + tenant) +
                    "&metadata_query=" + encodeURIComponent("name=" + eventType);
                return endpoint;
            }

            if (profile !== "All") {
                let array = profile.split(" - ");
                const timestamp = array[0];
                let guid = array[1];
                endpoint = "/v1/profile/" + tenant + "/?start=" + timestamp + "&end=" + timestamp +
                    "&metadata_query=" + encodeURIComponent("host=" + host) +
                    "&metadata_query=" + encodeURIComponent("tenant=" + tenant) +
                    "&metadata_query=" + encodeURIComponent("guid=" + guid) +
                    "&metadata_query=" + encodeURIComponent("name=" + eventType);
            } else {
                const start = parseInt(timeRange.split(" - ")[0]);
                const end = parseInt(timeRange.split(" - ")[1]);
                if(eventType == "customEvent"){
                    endpoint = "/v1/customevents/" + tenant + "/?start=" + start + "&end=" + end +
                        "&metadata_query=" + encodeURIComponent("host=" + host) +
                        "&metadata_query=" + encodeURIComponent("tenant=" + tenant) +
                        "&metadata_query=" + encodeURIComponent("name=customEvent");
                }else {
                    endpoint = "/v1/profiles/" + tenant + "/?start=" + start + "&end=" + end +
                        "&metadata_query=" + encodeURIComponent("host=" + host) +
                        "&metadata_query=" + encodeURIComponent("tenant=" + tenant) +
                        "&metadata_query=" + encodeURIComponent("name=" + eventType);
                }
            }
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