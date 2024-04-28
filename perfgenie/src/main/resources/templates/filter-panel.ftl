<script>
    /*
* Copyright (c) 2022, Salesforce.com, Inc.
* All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
* For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/
</script>
<style type="text/css">
    .xaxisid::-webkit-scrollbar {
        width: 0px;
    }
    .yaxisid::-webkit-scrollbar {
        width: 0px;
    }
    .nopadding {
        padding: 0 !important;
        margin: 0 !important;
    }
    .popupstackncontextview {
        max-height:568px;
        min-height: 568px;
        overflow: auto;
        color: black;
    }
    .popupstackpanel {
        max-height:538px;
        min-height: 538px;
    }
    .popupstackcontext {
        width: 100%;
        overflow: auto;
        font-size: 13px;
        height:538px;
    }
    .popuphackstak {
        width: 100%;
        font-size: 13px;
        max-height:507px;
        overflow: auto;
        color: black;
    }
    .strippedTable tr:nth-child(even){
        background-color : #ededed;
    }
    .stackncontextview {
        max-height:368px;
        min-height: 368px;
        overflow: auto;
        color: black;
    }
    .stackpanel {
        max-height:338px;
        min-height: 338px;
    }
    .stackcontext {
        width: 100%;
        overflow: auto;
        font-size: 11px;
        height:338px;
    }
    .hackstak {
        width: 100%;
        font-size: 11px;
        max-height:307px;
        overflow: auto;
        color: black;
    }
    .tgl:hover{
        fill: blue;
    }
    .requestHover{
        fill: blue;
    }
    .zoom {
        transition: transform .2s; /* Animation */
        margin: 0 auto;
    }
    .zoom:hover {
        transform: scale(1.5);
    }
    .rCell {
        background-color: #E21605;
    }
    .rsCell {
        background-color:#E5E6E7;
    }
    .stackCell0 {
        background-color:lightseagreen;
        height:10px;
        min-width:5px;
        border: 1px solid;
    }
    .stackCell1 {
        background-color:yellow;
        height:10px;
        min-width:5px;
        border: 1px solid;
    }
    .stackCell2 {
        background-color:deeppink;
        height:10px;
        min-width:5px;
        border: 1px solid;
    }
    .stackCell3 {
        background-color:brown;
        height:10px;
        min-width:5px;
        border: 1px solid;
    }
    .stackCell4 {
        background-color:dodgerblue;
        height:10px;
        min-width:5px;
        border: 1px solid;
    }
    .stackCells {
        background-color:black;
        height:12px;
        min-width:5px;
        border: 1px solid;
    }
    .filterinput {
        border: 1px solid #E5E6E7;
    }
    table.dataTable td,th {
        padding-left: 5px;
    }
    .statetable {
        overflow: auto;
    }
    div.dataTables_info {
        position: absolute
    }
    div.dataTables_paginate {
        float: left !important;
    }
    .dataTables_filter {
        float: left !important;
    }
    .toolbar {
        padding-bottom: 2px;
    }
    table.dataTable td {
        padding: 2px !important;
    }

    .popup {
        position: absolute;
        display: inline-block;
        cursor: pointer;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
    }

    /* The actual popup */
    .popup .popuptext {
        visibility: hidden;
        max-width: 1600px;
        max-height: 1600px;
        background-color: #555;
        color: #fff;
        text-align: left;
        border-radius: 6px;
        padding: 8px 0;
        position: absolute;
        z-index: 2;
        bottom: 125%;
        left: 50%;
        margin-left: 0px;
        padding: 5px;
    }

    /* Toggle this class - hide and show the popup */
    .popup .show {
        visibility: visible;
        -webkit-animation: fadeIn 1s;
        animation: fadeIn 1s;
    }

    /* Add animation (fade in the popup) */
    @-webkit-keyframes fadeIn {
        from {opacity: 0;}
        to {opacity: 1;}
    }

    @keyframes fadeIn {
        from {opacity: 0;}
        to {opacity:1 ;}
    }

    .cct-customized-scrollbar::-webkit-scrollbar {
        width: 8px;
        height: 8px;
        background-color: #E5E8E9; /* or add it to the track */
    }
    .cct-customized-scrollbar::-webkit-scrollbar-thumb {
        background: #6D6F70;
    }

    table.alternate_color tr:nth-of-type(even) {
        background-color:#F9F9F9;
    }

    table.alternate_color th, td {
        border: 1px solid #E8EAEC;
        border-collapse: collapse;
    }

</style>
<script type="text/javascript" class="init">
    $(function () {
        $("#accordion").accordion({
            collapsible: true,
            heightStyle: "content"
        });
    });

    $(function () {
        $("#contextfilter").accordion({
            collapsible: true
        });
    });

    let filterMap = {};
    $(function () {
        $.contextMenu({
            selector: '.context-menu-one',
            callback: function (key, options) {
                if (key == "add") {
                    let pair = $(this).attr("id").split("_")
                    addToFilter("timestamp=" + pair[1]);
                } else if (key == "show") {
                    showRequestContextPopup($(this).attr("id"));
                }
            },
            items: {
                "add": {name: "Add to filter"},
                "show": {name: "Show request timeline"}
            }
        });
        $.contextMenu({
            selector: '.context-menu-two',
            callback: function (key, options) {
                if (key == "add") {
                    addToFilter($(this).attr("hint") + "=" + $(this).text());
                }
            },
            items: {
                "add": {name: "Add to filter"}
            }
        });
    });

    function setApplyDisabled(shouldDisable) {
        $("#filter-apply").prop("disabled", shouldDisable);
    }

    function setResetDisabled(shouldDisable) {
        $("#filter-reset").prop("disabled", shouldDisable);
    }

    $(document).ready(function () {

        $("#queryfilter").on("change", (event) => {
            //validate manually edited filters
            $("#queryfilter").val($("#queryfilter").val().replace(/\s/g, ''));
            if($("#queryfilter").val() == ''){
                setApplyDisabled(true);
            }else {
                let array = $("#queryfilter").val().split(";");
                for (let i = 0; i < array.length; i++) {
                    if (array[i] != "") {
                        let pair = array[i].split("=");
                        if (pair.length != 2) {
                            toastr_warning("Invalid filter(s) provided");
                            break;
                        }
                    }
                }
                setApplyDisabled(false);
            }
        });

        $("#filter-reset").on("click", (event) => {
            prevReqTid = "";
            prevReqTime = "";
            prevReqCellSid = "";
            prevReqCellTime = "";
            prevReqCellObj = null;

            $("#queryfilter").val("");
            filterBy = "";
            updateUrl("filterBy", "", true);
            filterReq = "";
            updateUrl("filterReq", "", true);
            filterStack = "";
            updateUrl("filterStack", "", true);
            filterFrame = "";
            frameFilterString = "";
            $("#filtertimepickerstart").val('');
            $("#filtertimepickerend").val('');
            pStart='';
            pEnd='';
            isFilterOnType=true;

            resetTreeInvertedLevel(FilterLevel.LEVEL1);
            resetTreeInvertedLevel(FilterLevel.LEVEL2);
            resetTreeInvertedLevel(FilterLevel.LEVEL3);

            resetTreeAllLevel(getActiveTree(getEventType(), false));
            enableRequestTimelineView(false);
            ;

            $("#filter-apply").click();
        });

        $("#filter-apply").on("click", (event) => {
            if (filterStarted) {
                toastr_warning("Please wait for previous filter to finish.");
                return;
            }

            filterMap = {};
            filterFrame = "";
            frameFilterString = "";
            pStart='';
            pEnd='';
            let hasReqIDFilter = false;
            let array = $("#queryfilter").val().split(";");
            for (let i = 0; i < array.length; i++) {
                if (array[i] != "") {
                    let pair = array[i].split("=");
                    if (pair[0] == "frame") {
                        filterFrame = pair[1];
                        frameFilterString = pair[1];
                    }else if(pair[0] == "pStart"){
                        pStart=Number(pair[1]);
                        if(pEnd === ''){
                            pEnd = moment.utc( getContextTree(1).context.end);
                        }
                    }else if(pair[0] == "pEnd"){
                        pEnd=Number(pair[1]);
                        if(pStart === ''){
                            pStart = moment.utc( getContextTree(1).context.start);
                        }
                    }else if (pair[0] == "req") {
                        hasReqIDFilter = true;
                        if (filterReq == "" || filterReq == undefined) {
                            //find matching request to show time line
                            findRequest(pair[1]);
                        }
                    }
                    filterMap[pair[0]] = pair[1];
                }
            }

            filterBy = $("#queryfilter").val();

            setApplyDisabled(true);
            if (filterBy == "") {
                setResetDisabled(true);
            } else {
                setResetDisabled(false);
            }

            customEvent = $("#event-input").val();
            otherEvent = customEvent; //reset to default
            console.log("customEvent 4: " +customEvent);

            updateUrl("customevent", customEvent, true);

            updateUrl("filterBy", filterBy, true);
            if (hasReqIDFilter) {
                //updaate url with request timeline TO CHECK
                updateUrl("filterReq", filterReq, true);
                updateUrl("filterStack", filterStack, true);
            } else {
                //disable request timeline
                filterReq = "";
                filterStack = "";
                updateUrl("filterReq", "", true);
                updateUrl("filterStack", "", true);
                enableRequestTimelineView(false);
            }
            updateProfilerView(FilterLevel.LEVEL1);
        });

        filterBy = urlParams.get('filterBy') || '';
        filterReq = urlParams.get('filterReq') || '';
        filterStack = urlParams.get('filterStack') || '';
        filterStack = urlParams.get('filterStack') || '';
        contextTablePage = urlParams.get('cpage') || 0;
        customEvent = urlParams.get('customevent') || '';
        otherEvent = customEvent; //reset to default
        console.log("customEvent 6: " + customEvent);
        let tmpMultiSelect = urlParams.get('mSelect') || '';

        pStart = urlParams.get("pStart") || '';
        pEnd = urlParams.get("pEnd") || '';


        setApplyDisabled(true);
        if (filterBy == "") {
            setResetDisabled(true);
        }

        if (tmpMultiSelect !== undefined && tmpMultiSelect !== "") {
            let array = tmpMultiSelect.split(";");
            for (let i = 0; i < array.length; i++) {
                multiSelect[array[i]] = "selected";
            }
        }

        if (filterBy !== "" || filterBy !== undefined) {
            $("#queryfilter").val(filterBy);
            let array = filterBy.split(";");
            for (let i = 0; i < array.length; i++) {
                if (array[i] != "") {
                    let pair = array[i].split("=");
                    if (pair[0] == "frame") {
                        filterFrame = pair[1];
                        frameFilterString = pair[1];
                    }else if(pair[0] == "pStart"){
                        pStart = pair[1];
                    }else if(pair[0] == "pEnd"){
                        pEnd = pair[1];
                    }
                    filterMap[pair[0]] = pair[1];
                }
            }
        }

        contextTablePage = Number(contextTablePage);

       /* let str = "<table style=\"width: 100%;\" id=\"state-table\" class=\" \"><thead><tr><th><select style=\"border: 0px;\" class=\"\"  name=\"filtertable-input\" id=\"filtertable-input\"> <option value=\"org\">orgId</option> <option value=\"user\">userId</option> <option value=\"log\">logRecordType</option> <option value=\"reqId\">reqId</option> </select></th><th>cpuTime</th><th>runTime</th><th>gcTime</th><th><select style=\"border: 0px;\" class=\"\"  name=\"filtertable-input\" id=\"filtertable-input\"> <option value=\"org\">dbTime</option> <option value=\"user\">safepointTime</option> <option value=\"log\">apexTime</option> <option value=\"reqId\">dbCpu</option> </select></th></tr></thead>";
        str = str + "</table>";
        document.getElementById("statetable").innerHTML = str;
        $('#state-table').DataTable({
            "order": [[1, "desc"]],
            searching: false,
            "columnDefs": [{
                "targets": 0,
                "orderable": false
            }],
            "sDom": '<"toolbar">frtip'
        });*/

        groupBy = urlParams.get('groupBy') || '';
        tableFormat = urlParams.get('tableFormat') || '0';
        sortBy = urlParams.get('sortBy') || '';

        sortBy = urlParams.get('sortBy') || '';
        cumulativeLine = urlParams.get('cumulative') || '0';
        seriesCount = urlParams.get('seriesCount') || 5;
        groupByMatch = urlParams.get('groupByMatch') || '';
        groupByLength = urlParams.get('groupByLength') || '20';
        spanThreshold = urlParams.get('spanThreshold') || 200;
        tableThreshold = urlParams.get('tableThreshold') || 'duration';

        setToolBarOptions("statetabledrp");
        $("#filter-input").on("change", (event) => {
            genRequestTable();
        });
    });


    const FilterLevel = {
        LEVEL1: 1,
        LEVEL2: 2,
        LEVEL3: 3,
        UNDEFINED: 4
    };

    Object.freeze(FilterLevel);

    let treeHtml = "";
    // store the diff context trees so we don't have to make another call if we shift the foundation
    //1 for METHOD, 2 for SOCKET, 3 for APEX andd 4 for JSTACK, 5 for NATIVE
    let contextTree1 = {};
    let contextTree2 = {};

    let contextTreeInverted1 = {};
    let contextTreeInverted2 = {};

    let mergedContextTree = {};
    let mergedBacktraceTree = {};

    let queryStatus = {};

    let compareTree = false;
    let currentOption = 0;
    let isRefresh = true;
    let isLevelRefresh = true;
    let prevOption = 0;
    let prevCustomEvent = undefined;
    let isCalltree = false;
    let uploadIDMap = {};

    let contextData;
    let contextTree1Frames;
    let contextTree2Frames;
    let contextTree1JstackFrames=false;
    let contextTree2JstackFrames=false;
    let isJfrContext = false;
    let isS3 = "true";

    //1 for LEVEL1, 2 for LEVEL2 and 3 for LEVEL3
    let contextTree1InvertedLevel = {};

    let prevReqTid = "";
    let prevReqTime = "";

    let sortBy = "";
    let groupBy = "";
    let tableFormat = "";
    let cumulativeLine = "";
    let seriesCount = 5;
    let groupByLength = "20";
    let groupByMatch = "";
    let filterBy = "";
    let filterReq = "";
    let filterStack = "";
    let filterFrame = "";
    let filterEvent = 'jdk.ExecutionSample';
    let spanThreshold = 200;
    let tableThreshold = "duration";
    let isFilterOnType = true;

    let multiSelect = {};

    //one for LEVEL1, 2 for LEVEL2 and 3 for LEVEL3
    let contextInput = {1:{},2:{},3:{}};
    let filterStarted = false;
    let currentLoadedTree = null;

    let contextTable = undefined;
    let contextTablePage = 0;
    let customEvent = 0;
    let otherEvent = undefined;
    let pStart = '';
    let pEnd = '';

    let showTimeline = true;

    //one for LEVEL1, 2 for LEVEL2 and 3 for LEVEL3
    let filteredStackMap = {1:{},2:{},3:{}};

    function addToFilter(val) {
        let inppair = val.split("=");
        let array = $("#queryfilter").val().split(";");
        let tmpMap = {};
        for (let i = 0; i < array.length; i++) {
            array[i] = array[i].replace(/\s/g, '');
            if (array[i] != "") {
                let pair = array[i].split("=");
                if (pair[0] != inppair[0]) {
                    tmpMap[pair[0]] = pair[1];
                }
            }
        }
        if (inppair[0] == "context" && inppair[1] == "all") {
            //skip
        } else {
            tmpMap[inppair[0]] = inppair[1];
        }
        let str = "";
        for (var key in tmpMap) {
            str = str + key + "=" + tmpMap[key] + ";";
        }
        $("#queryfilter").val(str);
        setApplyDisabled(false);
    }

    function getFrameName(id) {
        if (isJfrContext == false) {
            return id;
        }
        if (contextTree1Frames[id] !== undefined) {
            return contextTree1Frames[id];
        } else if (contextTree2Frames !== undefined && contextTree2Frames[id] !== undefined) {
            return contextTree2Frames[id];
        }
        return "." + id;
    }

    function onLevel3Filter() {
        console.log("onLevel3Filter start");
        if (filterFrame !== undefined && filterFrame != "") {
            updateStackIndex(getActiveTree(getEventType(), false));
            isLevelRefresh = true;
            filterTree(getActiveTree(getEventType(), false));
            if (getSelectedLevel(getActiveTree(getEventType(), false)) !== FilterLevel.LEVEL3) {
                getActiveTree(getEventType(), false)[FilterLevel.LEVEL3] = 0;
            }
        }
    }

    function onLevel2Filter() {
        console.log("onLevel2Filter start");
        if (filterReq !== undefined && filterReq != "") {
            updateStackIndex(getActiveTree(getEventType(), false));//need this as stacks identified based on index
            let pair = filterReq.split("_");
            isLevelRefresh = true;
            showRequestTimelineView(pair[0], pair[1], true);
            if (getSelectedLevel(getActiveTree(getEventType(), false)) !== FilterLevel.LEVEL2) {
                getActiveTree(getEventType(), false)[FilterLevel.LEVEL2] = 0;
            }
        }
    }

    function updateRequestView() {
        console.log("updateRequestView start");
        if (filterReq !== undefined && filterReq != "") {
            let pair = filterReq.split("_");
            if ($("#" + filterReq).length != 0 && !$("#" + filterReq).hasClass("rsCell")) {
                $("#" + filterReq).addClass("rsCell");
                $("#" + filterReq).removeClass("rCell");
                prevReqTid = pair[0];
                prevReqTime = pair[1];

                if (filterStack !== undefined && filterStack != "") {
                    enableRequestTimelineView(true);
                    let stackPair = filterStack.split("_");
                    if ($("#" + stackPair[0] + "-" + stackPair[1]).length != 0 && !$("#" + stackPair[0] + "-" + stackPair[1]).hasClass('stackCells')) {
                        $("#" + stackPair[0] + "-" + stackPair[1]).click();
                    }
                }
            }
        }
    }

    function onLevel1Filter() {
        console.log("onLevel1Filter start");
        if (filterMap["tid"] == undefined && isFilterEmpty() && (pStart === '' || pEnd === '')) {
            //none
        } else {
            updateStackIndex(getActiveTree(getEventType(), false));//need this as stacks identified based on index
            isLevelRefresh = true;
            filterOnType();
            if (getSelectedLevel(getActiveTree(getEventType(), false)) !== FilterLevel.LEVEL1) {
                getActiveTree(getEventType(), false)[FilterLevel.LEVEL1] = 0;
            }
        }
    }

    let tableUpdateInput = "";

    function getLevel1FilterInput() {
        let str = "";
        let array = filterBy.split(";");
        for (let i = 0; i < array.length; i++) {
            if (array[i] != "") {
                let pair = array[i].split("=");
                if (pair[0] != "frame") { //frame is a second level filter
                    str = str + pair[0] + "=" + pair[1] + ";";
                }
            }
        }
        return str + customEvent; //custom event added to filters
    }

    function filterToLevel(level) {
        let eventType = getEventType();
        console.log("filterToLevel start:" + level + " eventType:" + eventType);
        if (contextData === undefined || isJfrContext == false) {
            return true;
        }
        if (filterStarted) {
            toastr_warning("Please wait for previous filter to finish.");
            return false;
        }
        filterStarted = true;

        let updateContextTable = false;

        try {
            if (level == FilterLevel.LEVEL1) {
                let level1InputTmp = getLevel1FilterInput();
                if (level1InputTmp !== contextInput[FilterLevel.LEVEL1][eventType]) {
                    contextInput[FilterLevel.LEVEL1][eventType] = level1InputTmp;
                    //level1  filter
                    //clean off level 2 history
                    prevReqTid = "";
                    prevReqTime = "";
                    document.getElementById("stack").innerHTML = "";
                    resetTreeLevel(getActiveTree(eventType, false), FilterLevel.LEVEL1);
                    resetTreeInvertedLevel(FilterLevel.LEVEL1);
                    resetTreeLevel(getActiveTree(eventType, false), FilterLevel.LEVEL2);
                    resetTreeInvertedLevel(FilterLevel.LEVEL2);
                    resetTreeLevel(getActiveTree(eventType, false), FilterLevel.LEVEL3);
                    resetTreeInvertedLevel(FilterLevel.LEVEL3);

                    onLevel1Filter();
                    updateContextTable = true;
                }
            }

            if (level == FilterLevel.LEVEL2 || level == FilterLevel.LEVEL1) {
                let level2InputTmp = filterBy + filterReq + filterStack + customEvent;
                if (level2InputTmp !== contextInput[FilterLevel.LEVEL2][eventType]) {
                    contextInput[FilterLevel.LEVEL2][eventType] = level2InputTmp;
                    document.getElementById("stack").innerHTML = "";
                    document.getElementById("stackcontext").innerHTML = "";
                    document.getElementById("threadstate").innerHTML = "";
                    //clean off sub level history
                    prevReqCellSid = "";
                    prevReqCellTime = "";
                    prevReqCellObj = null;
                    resetTreeLevel(getActiveTree(eventType, false), FilterLevel.LEVEL2);
                    resetTreeInvertedLevel(FilterLevel.LEVEL2);
                    resetTreeLevel(getActiveTree(eventType, false), FilterLevel.LEVEL3);
                    resetTreeInvertedLevel(FilterLevel.LEVEL3);
                    onLevel2Filter();
                }
            }

            if (level == FilterLevel.LEVEL3 || level == FilterLevel.LEVEL2 || level == FilterLevel.LEVEL1) {
                let level3InputTmp = filterBy + filterReq + filterStack + filterFrame + customEvent;

                if (level3InputTmp !== contextInput[FilterLevel.LEVEL3][eventType]) {
                    contextInput[FilterLevel.LEVEL3][eventType] = level3InputTmp;
                    resetTreeLevel(getActiveTree(eventType, false), FilterLevel.LEVEL3);
                    resetTreeInvertedLevel(FilterLevel.LEVEL3);
                    onLevel3Filter();
                    updateContextTable = true;
                }
            }

            if (updateContextTable) {
                genRequestTable();
            }

            updateRequestView();

            if (isCalltree) {
                if (getSelectedLevel(getActiveTree(eventType, false)) === FilterLevel.UNDEFINED) {
                    if (getContextTreeInverted(1, eventType) === undefined) {
                        setContextTreeInverted(invertTreeV1(getContextTree(1, eventType), 1), 1, eventType);
                    }
                } else if (getcontextTree1InvertedLevel(eventType, getSelectedLevel(getActiveTree(eventType, false))) === undefined) {
                    setcontextTree1InvertedLevel(invertTreeV1AtLevel(getActiveTree(eventType, false), 1), eventType, getSelectedLevel(getActiveTree(eventType, false)));
                }
            }

            if (!compareTree && isJfrContext){
                let treeToProcess = getActiveTree(getEventType(), isCalltree);
                let selectedLevel = getSelectedLevel(getActiveTree(getEventType(), false));
                if(getSelectedLevel(getActiveTree(eventType, false)) !== FilterLevel.UNDEFINED && !isCalltree){
                    sortTreeLevelBySizeWrapper(treeToProcess, selectedLevel);
                    updateStackIndex(treeToProcess);//should we always do this?
                }else{
                    sortTreeBySize(treeToProcess);
                }
            }

            filterStarted = false;
        } catch (err) {
            filterStarted = false;
            console.log("FilterToLevel Exception:" + err + " " + err.stack);

            return false;
        }
        return true;
    }

    function resetTreeInvertedLevel(level) {
        for (var key in jfrevents1) {
            setcontextTree1InvertedLevel(undefined, key, level);
        }
    }

    function resetTreeLevel(tree, level) {
        if (tree[level] !== undefined) {
            tree[level] = undefined;
        }
        let ch = tree['ch'];

        if (ch != undefined && ch !== null) {
            for (let index = 0; index < ch.length; index++) {
                resetTreeLevel(ch[index], level);
            }
        }
    }

    function resetTreeAllLevel(tree) {
        if (tree[FilterLevel.LEVEL1] !== undefined) {
            tree[FilterLevel.LEVEL1] = undefined;
        }
        if (tree[FilterLevel.LEVEL2] !== undefined) {
            tree[FilterLevel.LEVEL2] = undefined;
        }
        if (tree[FilterLevel.LEVEL3] !== undefined) {
            tree[FilterLevel.LEVEL3] = undefined;
        }
        let ch = tree['ch'];
        if (ch != undefined && ch !== null) {
            for (let index = 0; index < ch.length; index++) {
                resetTreeAllLevel(ch[index]);
            }
        }
    }

    function applyFilter(){
        $("#filter-apply").click();
    }

    function findRequest(reqId) {
        if (contextData !== undefined) {
            var BreakException = {};
            try {
                for (var tid in contextData.records) {
                    contextData.records[tid].forEach(function (obj) {
                        if (obj.type == 2 || obj.type == 6) {//do not include sub requests
                            if (obj.reqId !== undefined && obj.reqId == reqId) {
                                filterReq = obj.tid + "_" + obj.epoch;
                                throw BreakException;
                            }
                        }
                    });
                }
            } catch (e) {
                if (e !== BreakException) throw e;
            }
        }
    }

    function showTimelineView(opt) {
        showTimeline = opt;
    }

    function enableRequestTimelineView(opt) {
        if (showTimeline && opt) {
            $("#stackncontextview").removeClass("hide");
        } else {
            document.getElementById("timelinetitle").innerHTML = "";
            $("#stackncontextview").addClass("hide");
        }
    }

    let frameFilterString = "";

    function filterTree(tree) {
        if (frameFilterString !== undefined && frameFilterString.length != 0) {
            if (tree['tree'] !== undefined) {
                tree = tree['tree'];
            }
            let level = getSelectedLevel(getActiveTree(getEventType(), false));
            frameFilterStackMap[getEventType()] = {};
            filterFramesV1Level(tree, false, level);
        }
    }

    function sortTreeLevelBySizeWrapper(tree, level){
        //console.log("sortTreeLevelBySize:"+level);
        sortTreeLevelBySize(tree, level);
    }

    function sortTreeLevelBySize(tree, level) {
        let ch = tree['ch'];
        if (ch != undefined && ch !== null) {
            for (let index = 0; index < ch.length; index++) {
                sortTreeLevelBySize(ch[index], level);
            }
            ch.sort(function (a, b) {
                if (b[level] !== undefined && a[level] !== undefined) {
                    return b[level] - a[level];
                } else if (b[level] !== undefined) {
                    return b[level];
                } else if (a[level] !== undefined) {
                    return 0 - a[level];
                } else {
                    return 0;
                }
            });
        }
    }

    let prevReqCellSid = "";
    let prevReqCellTime = "";
    let prevReqCellObj = null;

    function getStackTrace(stackid) {
        let eventType = getEventType();

        let sampleType = eventType;

        let stacktrace = "";
        let tmpcontextTree1Level1 = getStackFrameV1("root");
        let tmpActiveTree = getActiveTree(eventType, false);
        updateStackIndex(tmpActiveTree); //at this point tree must be indexed on LEVEL2

        let arr = getTreeStack(tmpActiveTree, stackid, tmpcontextTree1Level1, 1);
        let ch = tmpcontextTree1Level1.ch;
        stacktrace = stacktrace + getProfileName(sampleType) + "\n\n";
        while (ch !== undefined && ch != null && ch.length == 1) {
            stacktrace = stacktrace + getFrameName(ch[0].nm) + "\n";
            ch = ch[0].ch;
        }
        return stacktrace;
    }

    function showStack(stackid, time, eventType, obj) {
        if (prevReqCellSid == stackid && prevReqCellTime == time) {
            updateUrl("filterStack", "");
            document.getElementById("stack").innerHTML = "";
            prevReqCellSid = "";
            prevReqCellTime = "";
            prevReqCellObj = null;
            filterStack = "";

            if ($("#" + stackid + "-" + time).length != 0) {
                $("#" + stackid + "-" + time).removeClass("stackCells");
            }
        } else {
            updateUrl("filterStack", stackid + "_" + time);
            filterStack = stackid + "_" + time;
            document.getElementById("stack").innerHTML = "";
            if ($("#" + prevReqCellSid + "-" + prevReqCellTime).length != 0) {
                $("#" + prevReqCellSid + "-" + prevReqCellTime).removeClass("stackCells");
            }

            if ($("#" + stackid + "-" + time).length != 0) {
                $("#" + stackid + "-" + time).addClass("stackCells");
            }

            prevReqCellObj = obj;
            prevReqCellSid = stackid;
            prevReqCellTime = time;

            let sampleType = eventType;

            let stacktrace = "<table  style=\"border: 0px;\">";
            let tmpcontextTree1Level1 = getStackFrameV1("root");
            let tmpActiveTree = getActiveTree(eventType, false);
            updateStackIndex(tmpActiveTree); //at this point tree must be indexed on LEVEL2

            let arr = getTreeStack(tmpActiveTree, stackid, tmpcontextTree1Level1, 1);
            let ch = tmpcontextTree1Level1.ch;
            stacktrace = stacktrace + "<tr><td>" + moment.utc(time).format('YYYY-MM-DD HH:mm:ss.SSS') + " - " + sampleType + "<p></p></td></tr>";
            while (ch !== undefined && ch != null && ch.length == 1) {
                stacktrace = stacktrace + "<tr><td>" + getFrameName(ch[0].nm) + "</td></tr>";
                ch = ch[0].ch;
            }
            stacktrace = stacktrace + "</table>";
            document.getElementById("stack").innerHTML = stacktrace;
        }
    }


    let prevpopReqCellSid = "";
    let prevpopReqCellTime = "";
    let prevpopReqCellObj = null;

    function showpopStack(stackid, time, eventType, obj) {
        if (prevpopReqCellSid == stackid && prevpopReqCellTime == time) {
            document.getElementById("popupstack").innerHTML = "";
            prevpopReqCellSid = "";
            prevpopReqCellTime = "";
            prevpopReqCellObj = null;
            popfilterStack = "";

            if ($("#" + stackid + "-" + time + "_pop").length != 0) {
                $("#" + stackid + "-" + time + "_pop").removeClass("stackCells");
            }
        } else {
            popfilterStack = stackid + "_" + time + "_pop";
            document.getElementById("popupstack").innerHTML = "";
            if ($("#" + prevpopReqCellSid + "-" + prevpopReqCellTime + "_pop").length != 0) {
                $("#" + prevpopReqCellSid + "-" + prevpopReqCellTime + "_pop").removeClass("stackCells");
            }

            if ($("#" + stackid + "-" + time + "_pop").length != 0) {
                $("#" + stackid + "-" + time + "_pop").addClass("stackCells");
            }

            prevpopReqCellObj = obj;
            prevpopReqCellSid = stackid;
            prevpopReqCellTime = time;

            let sampleType = eventType;

            let stacktrace = "<table class='ui-widget' style=\"border: none;\">";
            let tmpcontextTree1Level1 = getStackFrameV1("root");
            let tmpActiveTree = getActiveTree(eventType, false);
            updateStackIndex(tmpActiveTree); //at this point tree must be indexed on LEVEL2

            let arr = getTreeStack(tmpActiveTree, stackid, tmpcontextTree1Level1, 1);
            let ch = tmpcontextTree1Level1.ch;
            stacktrace = stacktrace + "<tr style='border: none' ><td style='border:none' >" + moment.utc(time).format('YYYY-MM-DD HH:mm:ss.SSS') + " - " + getProfileName(sampleType) + "<p></p></td></tr>";
            while (ch !== undefined && ch != null && ch.length == 1) {
                stacktrace = stacktrace + "<tr style='border: none'><td style='border:none'>" + getFrameName(ch[0].nm) + "</td></tr>";
                ch = ch[0].ch;
            }
            stacktrace = stacktrace + "</table>";
            document.getElementById("popupstack").innerHTML = stacktrace;
        }
    }

    function frameFilter() {
        if (filterStarted) {
            toastr_warning("Please wait for previous filter to finish.");
            return;
        }
        updateProfilerView(FilterLevel.LEVEL3);
    }

    function hideFilterViewStatus() {
        $("#filter-view-status").addClass("hide");
    }

    function unhideFilterViewStatus() {
        $("#filter-view-status").removeClass("hide");
    }

    function updateFilterViewStatus(status) {
        document.getElementById("filter-view-status").innerHTML = status;
    }

    function showContextFilter() {
        $("#contextpanel").removeClass("hide");
    }

    function isinRequest(arr, start, end) {
        let l = 0, r = arr.length - 1;
        while (l <= r) {
            let m = Math.floor((l + r) / 2);
            if (arr[m].time >= start && arr[m].time <= end)
                return m;
            else if (arr[m].time > end)
                r = m - 1;
            else
                l = m + 1;
        }
        return -1;
    }

    function logColor(line) {
        if (line == "U") {
            return "#DA823B";
        } else if (line == "5") {
            return "#925EB0";
        } else if (line == "4") {
            return "#5098D5";
        } else {
            return "#828282";
        }
    }

    let curStackIDT = undefined;
    let curLevelT = undefined;
    let curSizeT = undefined;

    function getTreeStackLevel(tree, stackid, size, level) {
        if (tree['tree'] !== undefined) {
            tree = tree['tree'];
        }
        if (tree.sm[stackid] !== undefined && tree.ch[tree.sm[stackid]].sm[stackid] !== undefined) {

            curStackIDT = stackid;
            curLevelT = level;
            curSizeT = size;

            if (getStackLevel(tree.ch[tree.sm[stackid]], 0)) {
                if (tree[level] !== undefined) {
                    tree[level] = tree[level] + size;
                } else {
                    tree[level] = size;
                }
            }
        }
    }

    function getTreeStack(tree, stackid, filterTree, size) {
        if (tree['tree'] !== undefined) {
            tree = tree['tree'];
        }
        if (tree.sm[stackid] != undefined && tree.ch[tree.sm[stackid]].sm[stackid] !== undefined) {

            let bseJsonTree = tree.ch[tree.sm[stackid]];
            //handle single frame case
            if (bseJsonTree['ch'] == null || bseJsonTree['ch'].length == 0) {
                addFrameV1(bseJsonTree['nm'], size, size, filterTree);
                return;
            } else {
                let arr = [];
                let res = getStack(tree.ch[tree.sm[stackid]], filterTree, arr, size, stackid, false);
                return res;
            }
        }
    }

    function resetTree(baseJsonTree) {
        if (baseJsonTree['tree'] !== undefined) {
            baseJsonTree = baseJsonTree['tree'];
        }
        if (baseJsonTree['1'] !== undefined) {
            baseJsonTree['1'] = 0;
        }
        if (baseJsonTree['2'] !== undefined) {
            baseJsonTree['2'] = 0;
        }
        if (baseJsonTree['3'] !== undefined) {
            baseJsonTree['3'] = 0;
        }
        for (let treeIndex = 0; treeIndex < baseJsonTree['ch'].length; treeIndex++) {
            resetTree(baseJsonTree['ch'][treeIndex]);
        }
    }

    function getStackLevel(baseJsonTree, depth) {

        if (depth != 0 && baseJsonTree.sm[curStackIDT] !== undefined && baseJsonTree.sm[curStackIDT] === 1) {

            if (baseJsonTree[curLevelT] !== undefined) {
                baseJsonTree[curLevelT] = baseJsonTree[curLevelT] + curSizeT;
            } else {
                baseJsonTree[curLevelT] = curSizeT;
            }
            return true;
        }

        if (baseJsonTree['ch'] == null || baseJsonTree['ch'].length == 0) {
            return false;
        }

        let found = false;
        if (isCalltree && baseJsonTree.hash !== undefined && baseJsonTree.hash[curStackIDT] !== undefined) {
            let res = getStackLevel(baseJsonTree['ch'][baseJsonTree.hash[curStackIDT]], depth + 1);
            if (res === true) {
                found = true;
            }
        } else {
            for (let treeIndex = 0; treeIndex < baseJsonTree['ch'].length; treeIndex++) {
                let res = getStackLevel(baseJsonTree['ch'][treeIndex], depth + 1);
                if (res === true) {
                    found = true;
                    break; // break loop, stack already found
                }
            }
        }
        if (found === true) {
            if (baseJsonTree[curLevelT] !== undefined) {
                baseJsonTree[curLevelT] = baseJsonTree[curLevelT] + curSizeT;
            } else {
                baseJsonTree[curLevelT] = curSizeT;
            }
        }
        return found;
    }

    function getStack(baseJsonTree, filterTree, arr, size, stackid, flag) {
        if (baseJsonTree['ch'] == null || baseJsonTree['ch'].length == 0) {
            let tmparr = [...arr];
            tmparr.push(baseJsonTree['nm']);
            if (flag && baseJsonTree.sm[stackid] !== undefined) {
                let frame = filterTree;
                let tmparr = [...arr];
                tmparr.push(baseJsonTree['nm']);
                for (let i = 0; i < tmparr.length; i++) {
                    if (i == tmparr.length - 1) {
                        frame = addFrameV1(tmparr[i], size, size, frame);
                    } else {
                        frame = addFrameV1(tmparr[i], size, 0, frame);
                    }
                }
            }
            return;
        } else {
            for (let treeIndex = 0; treeIndex < baseJsonTree['ch'].length; treeIndex++) {
                let tmparr = [...arr];
                tmparr.push(baseJsonTree['nm']);
                getStack(baseJsonTree['ch'][treeIndex], filterTree, tmparr, size, stackid, true)
            }
            if (flag && baseJsonTree.sm[stackid] !== undefined) {
                let frame = filterTree;
                let tmparr = [...arr];
                tmparr.push(baseJsonTree['nm']);
                for (let i = 0; i < tmparr.length; i++) {
                    if (i == tmparr.length - 1) {
                        frame = addFrameV1(tmparr[i], size, size, frame);
                    } else {
                        frame = addFrameV1(tmparr[i], size, 0, frame);
                    }
                }
            }
            return;
        }
    }

    let frameFilterStackMap = {1:undefined,2:undefined,3:undefined,4:undefined};

    function filterFramesV1Level(baseJsonTree, include, level) {
        if (baseJsonTree == null) {//safety check
            return 0;
        }
        if (level != FilterLevel.UNDEFINED && baseJsonTree[level] === undefined) {
            return 0;
        }

        let count = 0;
        let curInclude = false;
        let event = getEventType();
        if (!include) {
            //check if current frame contains filter string
            if (baseJsonTree !== null && getFrameName(baseJsonTree['nm']) !== undefined && getFrameName(baseJsonTree['nm']).includes(frameFilterString)) {
                if (level != FilterLevel.UNDEFINED) {
                    count = baseJsonTree[level];
                } else {
                    count = baseJsonTree['sz'];
                }
                include = true;
                curInclude = true;
            }
        }

        if (include) {
            //either current or parent included
            if (level != FilterLevel.UNDEFINED) {
                baseJsonTree[FilterLevel.LEVEL3] = baseJsonTree[level];
            } else {
                baseJsonTree[FilterLevel.LEVEL3] = baseJsonTree['sz'];
            }
        } else {
            if (baseJsonTree[FilterLevel.LEVEL3] !== undefined) {
                baseJsonTree[FilterLevel.LEVEL3] = undefined;
            }
        }

        let chCount = 0;
        if (baseJsonTree['ch'] != null) {
            //search filter string in all sub nodes
            for (let treeIndex = 0; treeIndex < baseJsonTree['ch'].length; treeIndex++) {
                if (level != FilterLevel.UNDEFINED && baseJsonTree['ch'][treeIndex][level] === undefined) {
                    continue;
                }
                chCount = chCount + filterFramesV1Level(baseJsonTree['ch'][treeIndex], include, level);
            }
        } else {
            if (curInclude || include) {
                //collect stacks included in frame filter
                if (baseJsonTree.sm !== undefined) {
                    for (var key in baseJsonTree.sm) {
                        frameFilterStackMap[event][key] = 1;
                    }
                }
            }
        }

        if (curInclude) {
            //let parent know the number of stacks count included
            return count;
        } else if (include) {
            //parent included, return is just ignored
            return 0;
        } else {
            if (chCount > 0) {
                //none of parents or this frame contains filter string, but children has filter string so include the occurrence count
                baseJsonTree[FilterLevel.LEVEL3] = chCount;
            }
            //let parent know that the children found filter string and count
            return chCount;
        }
    }

    function showRequestContextPopup(filterReq) {
        if (filterReq != undefined) {
            popfilterStack = "";
            createTimelineModal("timelinepopup");
            loadModal("timelinepopup");
            setTimeout(function () {
                $('#timelinepopup').focus();
                let pair = filterReq.split("_");
                showRequestTimelineView(pair[0], pair[1], false);
                let stackPair = popfilterStack.split("_");
                if ($("#" + stackPair[0] + "-" + stackPair[1] + "_pop").length != 0 && !$("#" + stackPair[0] + "-" + stackPair[1] + "_pop").hasClass("stackCells")) {
                    $("#" + stackPair[0] + "-" + stackPair[1] + "_pop").click();
                }
            }, 500);
        }
    }

    function createTimelineModal(modalId) {
        $('#modals-guid')[0].innerHTML = "<div  class='modal inmodal fade' data-backdrop=\"static\"  id='" + modalId + "' tabindex='-1' role='dialog'  aria-hidden='true'>\n" +
            "    <div style=\"max-width: 90%;\" class='modal-dialog' role=\"document\">\n" +
            "        <div class='modal-content'>\n" +
            "           <div id='data-modal-body' class='modal-body' style='overflow: auto'> \n" +
            "<div id=\"popupstackncontextview\"  style=\"padding-top: 5px; padding-left: 0px;padding-right: 0px;\" class=\"popupstackncontextview col-lg-12\" >\n" +
            "<span id=\"timelinepopuptitle\" style=\"color: #686A6C;font-family: 'Arial', serif;\">Profiling samples collected during request runTime</span>\n" +
            "<div style=\"padding-top:0px; padding-left: 15px;padding-right: 0px;\" class=\"row col-lg-12\">\n" +
            "<div style=\"padding-top: 0px; padding-left: 0px;padding-right: 5px;padding-bottom: 5px;\" class=\"popupfilterpanel col-lg-9\">\n" +
            "<div style=\"border-color: #e5e6e7;  border-width: 1px; border-style: solid;padding-top: 3px; padding-left: 5px;padding-right: 5px;\" class=\"popupstackpanel\">\n" +
            "<div style=\"overflow: auto;\" class=\"cct-customized-scrollbar popupthreadstate\" id=\"popupthreadstate\">\n" +
            "</div>\n" +
            "<div class=\"popuphackstak\" id=\"popupstack\">\n" +
            "</div>\n" +
            "</div>\n" +
            "</div>\n" +
            "<div class=\"nopadding col-lg-3\">\n" +
            "<div  style=\"border-color: #e5e6e7;  border-width: 1px; border-style: solid; padding: 5px;\"  class=\"popupstackcontext\" id=\"popupstackcontext\">\n" +
            "</div>\n" +
            "</div>\n" +
            "</div>\n" +
            "</div>\n" +
            "            </div>\n" +
            "        </div>\n" +
            "    </div>\n" +
            "</div>";
    }

    function loadModal(modalId) {
        $('#' + modalId).modal('show');
    }

    function unLoadModal(modalId) {
        $('#' + modalId).modal('hide');
        prevpopReqCellObj = null;
        prevReqCellObj = null;
    }

    let clickC = 0;

    document.onkeydown = function (evt) {
        evt = evt || window.event;

        const timelinepopupmodalElement = document.getElementById("timelinepopup");
        const timelineElement = document.getElementById("stackncontextview");

        if (timelinepopupmodalElement !== null && timelinepopupmodalElement.style.display !== "none") {
            console.log("timelinepopup active " + clickC + ":" + evt.keyCode);
            if (evt.keyCode == 39) {
                nextAvailablepopStack();
            } else if (evt.keyCode == 37) {
                previousAvailablepopStack();
            } else if (evt.keyCode == 27) {
                prevpopReqCellObj = null;
            }
            clickC++;
        } else if (timelineElement !== null && timelineElement.style.display !== "none") {
            console.log("stackncontextview active " + clickC + ":" + evt.keyCode);
            if (evt.keyCode == 39) {
                nextAvailableStack();
            } else if (evt.keyCode == 37) {
                previousAvailableStack();
            }
            clickC++;
        }
        actViewKeyDown(evt);
    };

    function nextAvailablepopStack() {
        var cur = prevpopReqCellObj;
        while (cur != null && cur.nextSibling != null) {
            cur = cur.nextSibling;
            if (!cur.classList.contains('hide')) {
                cur.click();
                break;
            }
        }
    }

    function previousAvailablepopStack() {
        var cur = prevpopReqCellObj;
        while (cur != null && cur.previousSibling != null) {
            cur = cur.previousSibling;
            if (!cur.classList.contains('hide')) {
                cur.click();
                break;
            }
        }
    }

    function nextAvailableStack() {
        var cur = prevReqCellObj;
        while (cur != null && cur.nextSibling != null) {
            cur = cur.nextSibling;
            if (!cur.classList.contains('hide')) {
                cur.click();
                break;
            }
        }
    }

    function previousAvailableStack() {
        var cur = prevReqCellObj;
        while (cur != null && cur.previousSibling != null) {
            cur = cur.previousSibling;
            if (!cur.classList.contains('hide')) {
                cur.click();
                break;
            }
        }
    }

    function getContextView(record, dimIndexMap, metricsIndexMap) {
        let str = "";
        for (var dim in dimIndexMap) {
            if (dim == "timestamp") {
                str += "<tr><td style=\"white-space: nowrap;\" title='start time of the request'>" + dim + "</td><td  style=\"white-space: nowrap;padding-left: 5px;\">" + moment.utc(record[dimIndexMap[dim]]).format('YYYY-MM-DD HH:mm:ss SSS') + " UTC</td></tr>";
            } else {
                str += "<tr><td style=\"white-space: nowrap;\" title=''>" + dim + "</td><td  style=\"white-space: nowrap;padding-left: 5px;\">" + record[dimIndexMap[dim]] + "</td></tr>";
            }
        }
        for (var metric in metricsIndexMap) {
            str += "<tr><td style=\"white-space: nowrap;\" title=''>" + metric + "</td><td  style=\"white-space: nowrap;padding-left: 5px;\">" + record[metricsIndexMap[metric]] + "</td></tr>";
        }
        return str;
    }

    function filterOnType() {
        console.log("filterOnType start");
        let scount = 0;
        let stackMap = {};

        let tidDatalistVal = filterMap["tid"];
        let dimIndexMap = {};
        let metricsIndexMap = {};
        let metricsIndexArray = [];
        let groupByIndex = -1;
        let spanIndex = -1;
        let timestampIndex = -1;
        isFilterOnType = true;

        for (let val in contextData.header[customEvent]) {
            const tokens = contextData.header[customEvent][val].split(":");
            if (tokens[1] == "number") {
                metricsIndexArray.push(val);
                metricsIndexMap[tokens[0]] = val;
            }
            if (groupBy == tokens[0]) {
                groupByIndex = val;
            }
            if ("duration" == tokens[0] || "runTime" == tokens[0] ) { // TODO: take from user
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
            contextDataRecords = contextData.records[customEvent];
        }

        let contextStart = getContextTree(1).context.start;
        let contextTidMap = getContextTree(1).context.tidMap;

        let isJstack = false;
        if(getEventType() == "Jstack" || getEventType() == "json-jstack"){
            isJstack = true;
            filteredStackMap[FilterLevel.LEVEL1] = {};
        }

        if (isFilterEmpty(dimIndexMap) && tidDatalistVal != undefined) {
            if (contextTidMap[tidDatalistVal] != undefined) { //check if the thread has samples
                for (let i = 0; i < contextTidMap[tidDatalistVal].length; i++) {
                    if ((pStart === '' || pEnd === '') || ((contextTidMap[tidDatalistVal][i].time + contextStart) >= pStart && (contextTidMap[tidDatalistVal][i].time + contextStart) <= pEnd)) {
                        if (stackMap[contextTidMap[tidDatalistVal][i].hash] !== undefined) {
                            stackMap[contextTidMap[tidDatalistVal][i].hash] = stackMap[contextTidMap[tidDatalistVal][i].hash] + 1;
                        } else {
                            stackMap[contextTidMap[tidDatalistVal][i].hash] = 1;
                        }
                        if (isJstack) {
                            if (filteredStackMap[FilterLevel.LEVEL1][tidDatalistVal] == undefined) {
                                filteredStackMap[FilterLevel.LEVEL1][tidDatalistVal] = [];
                            }
                            filteredStackMap[FilterLevel.LEVEL1][tidDatalistVal].push(contextTidMap[tidDatalistVal][i]);
                        }
                    }
                }
            }
        } else {
            //we are here means one of DatalistVal is not empty
            if (spanIndex == -1) { // record duration span not available
                //Context hints cannot be applied, apply only time range filter and threadname, tid filter
                isFilterOnType=false;
                let threadNameTidMap = {};//assuming thread name do not change
                if(dimIndexMap["threadname"] != undefined && filterMap["threadname"] != undefined) {
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
                                    if (stackMap[contextTidMap[tid][i].hash] !== undefined) {
                                        stackMap[contextTidMap[tid][i].hash] = stackMap[contextTidMap[tid][i].hash] + 1;
                                    } else {
                                        stackMap[contextTidMap[tid][i].hash] = 1;
                                    }
                                    if (isJstack) {
                                        if (filteredStackMap[FilterLevel.LEVEL1][tid] == undefined) {
                                            filteredStackMap[FilterLevel.LEVEL1][tid] = [];
                                        }
                                        filteredStackMap[FilterLevel.LEVEL1][tid].push(contextTidMap[tid][i]);
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                for (var tid in contextDataRecords) {
                    contextDataRecords[tid].forEach(function (obj) {
                        if (tidDatalistVal == undefined || tidDatalistVal == tid) {
                            let record = obj.record;
                            let flag = false;
                            let recordSpan = record[spanIndex] == undefined ? 0 : record[spanIndex];
                            if (filterMatch(record, dimIndexMap, timestampIndex, recordSpan)) {
                                flag = true;
                            }
                            if (flag) {
                                let end = record[timestampIndex] - contextStart + recordSpan;
                                let start = record[timestampIndex] - contextStart;

                                try {
                                    //do a binary search
                                    let entryIndex = isinRequest(contextTidMap[tid], start, end);
                                    if (entryIndex != -1) {
                                        let requestArr = contextTidMap[tid];
                                        let curIndex = entryIndex;
                                        //consider all matching samples downward
                                        while (curIndex >= 0 && requestArr[curIndex].time >= start && requestArr[curIndex].time <= end) {
                                            //TODO check if sample time is within time filter range (tidDatalistVal][i].time + contextStart) > pStart && (tidDatalistVal][i].time + contextStart) < pEnd
                                            if ((pStart === '' || pEnd === '') || (requestArr[curIndex].time + contextStart) >= pStart && (requestArr[curIndex].time + contextStart) <= pEnd) {
                                                if (isJstack) {
                                                    if (filteredStackMap[FilterLevel.LEVEL1][tid] == undefined) {
                                                        filteredStackMap[FilterLevel.LEVEL1][tid] = [];
                                                    }
                                                    filteredStackMap[FilterLevel.LEVEL1][tid].push(requestArr[curIndex]);
                                                }
                                                if (stackMap[requestArr[curIndex].hash] !== undefined) {
                                                    stackMap[requestArr[curIndex].hash] = stackMap[requestArr[curIndex].hash] + 1;
                                                } else {
                                                    stackMap[requestArr[curIndex].hash] = 1;
                                                }
                                                scount++;
                                            }
                                            curIndex--;
                                        }
                                        curIndex = entryIndex + 1;
                                        //consider all matching samples upward
                                        while (curIndex < requestArr.length && requestArr[curIndex].time >= start && requestArr[curIndex].time <= end) {
                                            if ((pStart === '' || pEnd === '') || (requestArr[curIndex].time + contextStart) >= pStart && (requestArr[curIndex].time + contextStart) <= pEnd) {
                                                if (isJstack) {
                                                    filteredStackMap[FilterLevel.LEVEL1][tid].push(requestArr[curIndex]);
                                                }
                                                if (stackMap[requestArr[curIndex].hash] !== undefined) {
                                                    stackMap[requestArr[curIndex].hash] = stackMap[requestArr[curIndex].hash] + 1;
                                                } else {
                                                    stackMap[requestArr[curIndex].hash] = 1;
                                                }
                                                scount++;
                                            }
                                            curIndex++;
                                        }
                                    }
                                } catch (err) {
                                    console.log("tid not found in JFR" + tid + " " + err.message);
                                }
                            }
                        }
                    });
                }
            }
        }
        for (stack in stackMap) {
            getTreeStackLevel(getActiveTree(getEventType(), false), stack, stackMap[stack], FilterLevel.LEVEL1);
        }
        console.log("filterOnType 1");
    }

    function showRequestTimelineView(tid, time, applyFilter) {
        let str = "";
        let table = "";
        let runTime = 0;
        let profilestart = 0;

        for (var eventType in jfrprofiles1) {
            if (profilestart == 0 && !(eventType == "Jstack" || eventType == "json-jstack") && getContextTree(1, eventType) != undefined) {
                profilestart = getContextTree(1, eventType).context.start;
            }
        }

        let start = time - profilestart;

        let jstackstart = 0;
        let jstackdiff = 0;
        let jstackEvent = getContextTree(1, "json-jstack") == undefined ?  "Jstack" : "json-jstack";

        if (getContextTree(1, jstackEvent) !== undefined) {
            jstackstart = time - getContextTree(1, jstackEvent).context.start;
            jstackdiff = getContextTree(1, jstackEvent).context.start - profilestart;
        }

        let colorStackStr = "";
        let reqId = "";

        let dimIndexMap = {};
        let metricsIndexMap = {};
        let metricsIndexArray = [];
        let groupByIndex = -1;
        let spanIndex = -1;
        let timestampIndex = -1;


        for (let val in contextData.header[customEvent]) {
            const tokens = contextData.header[customEvent][val].split(":");
            if (tokens[1] == "number") {
                metricsIndexArray.push(val);
                metricsIndexMap[tokens[0]] = val;
            }
            if (groupBy == tokens[0]) {
                groupByIndex = val;
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
            contextDataRecords = contextData.records[customEvent];
        }

        contextDataRecords[tid].forEach(function (obj) {
            let record = obj.record;
            if (record[timestampIndex] == time) {
                reqId = record[timestampIndex] + ":" + record[dimIndexMap["tid"]]; //make a unique key
                runTime = record[spanIndex];
                str = getContextView(record, dimIndexMap, metricsIndexMap);
                return false;
            }
        });

        let str1 = "<table><tr>";
        let scount = 0;
        let srwcount = 0;
        //identify stacks
        const tmpIdMap = new Map();

        let eventTypeCount = 0;
        let eventTypeArray = [];
        for (var eventType in jfrprofiles1) {//for all profile event types
            if (eventType == jstackEvent) {
                let isJstack = false;
                if (getEventType() == jstackEvent) {
                    isJstack=true;
                }
                if (isJstack && applyFilter) {
                    filteredStackMap[FilterLevel.LEVEL2] = {};
                }
                if (getContextTree(1, jstackEvent) !== undefined && getContextTree(1, jstackEvent).context != undefined && getContextTree(1, jstackEvent).context.tidMap[tid] !== undefined) {
                    getContextTree(1, jstackEvent).context.tidMap[tid].forEach(function (obj) {
                        if((pStart === '' || pEnd === '') || ((obj.time + jstackstart) >= pStart && (obj.time + jstackstart) <= pEnd)) { //check time rang
                            if (obj.time >= jstackstart && obj.time <= jstackstart + runTime) {
                                if (isJstack && applyFilter) {
                                        getTreeStackLevel(getActiveTree(jstackEvent, false), obj.hash, 1, FilterLevel.LEVEL2);
                                }
                                if (isJstack && applyFilter) {
                                    if (filteredStackMap[FilterLevel.LEVEL2][tid] == undefined) {
                                        filteredStackMap[FilterLevel.LEVEL2][tid] = [];
                                    }
                                    filteredStackMap[FilterLevel.LEVEL2][tid].push(obj);
                                }
                                tmpIdMap.set(obj.hash + "_" + eventTypeCount + "_" + obj.time, obj.time + jstackdiff);
                                scount++;
                            }
                        }
                    });
                }
                eventTypeArray.push(jstackEvent);
            } else {
                if (getContextTree(1, eventType) != undefined && getContextTree(1, eventType).context != undefined && getContextTree(1, eventType).context.tidMap[tid] !== undefined) {
                    getContextTree(1, eventType).context.tidMap[tid].forEach(function (obj) {
                        if((pStart === '' || pEnd === '') || ((obj.time + profilestart) >= pStart && (obj.time + profilestart) <= pEnd)) { //check time rang
                            if (obj.time >= start && obj.time <= start + runTime) {
                                tmpIdMap.set(obj.hash + "_" + eventTypeCount + "_" + obj.time, obj.time);
                                scount++;
                                if (getEventType() == eventType) {
                                    if (applyFilter) {
                                        getTreeStackLevel(getActiveTree(eventType, false), obj.hash, 1, FilterLevel.LEVEL2);
                                    }
                                }
                            }
                        }
                    });
                }
                eventTypeArray.push(eventType);
            }
            eventTypeCount++;
        }

        const tmpIdMapSorted = new Map([...tmpIdMap.entries()].sort((a, b) => a[1] - b[1]));
        let startTime = profilestart;
        let firstfilterStack = "";
        for (let [key, value] of tmpIdMapSorted) {
            let epoch = startTime + value;
            let pair = key.split("_");
            if (firstfilterStack == "") {
                firstfilterStack = pair[0] + "_" + epoch;
            }
            if (applyFilter) {
                str1 = str1 + "<td class=\"zoom stackCell" + pair[1] + "\" id=\"" + pair[0] + "-" + epoch + "\" onclick=\"showStack(" + pair[0] + "," + epoch + ",'" + eventTypeArray[Number(pair[1])] + "', this)\"> </td>";
            } else {
                str1 = str1 + "<td class=\"zoom stackCell" + pair[1] + "\" id=\"" + pair[0] + "-" + epoch + "_pop\" onclick=\"showpopStack(" + pair[0] + "," + epoch + ",'" + eventTypeArray[Number(pair[1])] + "', this)\"> </td>";
            }
        }

        //set default to 1st stack
        if (applyFilter) {
            if (filterStack == "") {
                filterStack = firstfilterStack;
            }
        } else {
            if (popfilterStack == "") {
                popfilterStack = firstfilterStack;
            }
        }

        str1 = str1 + "</tr></table>";

        let timelinetitleID = "timelinetitle";
        let threadstateID = "threadstate";
        let stackcontextID = "stackcontext";
        let stackID = "stack";

        if (!applyFilter) {
            timelinetitleID = "timelinepopuptitle";
            threadstateID = "popupthreadstate";
            stackcontextID = "popupstackcontext";
            stackID = "popupstack";
        }
        let jstackinterval = '60';
        if (getContextTree(1, jstackEvent) != undefined && getContextTree(1, jstackEvent).meta != undefined && getContextTree(1, jstackEvent).meta['jstack-interval'] != undefined) {
            jstackinterval = getContextTree(1, jstackEvent).meta['jstack-interval'];
        }
        let timelinetitleIDHTML = "<select multiple=\"multiple\" style=\"border-color:#F2F2F3; height: 24px; width: 223px;\" name=\"timeline-event-type\" id=\"timeline-event-type\"> ";
        eventTypeCount = 0;
        let multiSelectEmpty = false;
        if (Object.keys(multiSelect).length == 0) {
            multiSelectEmpty = true;
        }
        for (let eventType in jfrprofiles1) {//for all profile event types
            timelinetitleIDHTML += "<option " + ((multiSelectEmpty || multiSelect[eventTypeCount] != undefined) ? "selected" : "") + " value=" + eventTypeCount + ">" + getProfileName(eventType) + "</option>";
            if (multiSelectEmpty) {
                multiSelect[eventTypeCount] = "selected";
            }
            eventTypeCount++;
        }

        timelinetitleIDHTML += "</select>" +
            "&nbsp;profiling samples between " + moment.utc(Number(time)).format('YYYY-MM-DD HH:mm:ss.SSS') + " to " + moment.utc(Number(time) + runTime).format('YYYY-MM-DD HH:mm:ss.SSS');

        document.getElementById(timelinetitleID).innerHTML = timelinetitleIDHTML;
        document.getElementById(threadstateID).innerHTML = str1;
        str = str + "<tr><td style=\"white-space: nowrap;\" title='total samples collected in this request'>samples</td><td style=\"white-space: nowrap;padding-left: 5px;\" >" + scount + " </td></tr>";
        if (str != "") {
            table = table + colorStackStr;
            table = table + "<table  style=\"border-left: none; border-right: none; width:100%; padding: 0px;\" class=\"ui-widget table-striped\" >";
            table = table + str;
            table = table + "</table>";

        }
        document.getElementById(stackcontextID).innerHTML = table;
        document.getElementById(stackID).innerHTML = "";
        $('#timeline-event-type').multiselect({
            buttonWidth: '200px',
            numberDisplayed: 1,
            onDropdownHide: function (event) {
                let isChanged = false;
                let tmpmultiSelect = {};
                var values = $('#timeline-event-type').val();
                for (let i = 0; i < values.length; i++) {
                    if (multiSelect[values[i]] == undefined) {
                        isChanged = true;
                    }
                    tmpmultiSelect[values[i]] = "selected";
                }
                for (var key in multiSelect) {
                    if (tmpmultiSelect[key] == undefined) {
                        isChanged = true;
                    }
                }
                if (isChanged) {
                    let newmultiSelect = "";
                    let separator = "";
                    for (var key in tmpmultiSelect) {
                        newmultiSelect = newmultiSelect + separator + key;
                        if (separator == "") {
                            separator = ";";
                        }

                    }
                    updateUrl("mSelect", newmultiSelect, true);
                    multiSelect = tmpmultiSelect;
                    updateThreadStateView();
                }
            }
        });
        updateThreadStateView();
    }

    function updateThreadStateView() {
        let eventTypeCount = 0;
        for (var eventType in jfrprofiles1) {//for all profile event types
            if (multiSelect[eventTypeCount] != undefined) {
                $('.stackCell' + eventTypeCount).removeClass('hide');
            } else {
                $('.stackCell' + eventTypeCount).addClass('hide');
            }
            eventTypeCount++;
        }

        let element = undefined;
        if ($("#popupthreadstate").length != 0) {
            let stackPair = popfilterStack.split("_");
            if ($("#" + stackPair[0] + "-" + stackPair[1] + "_pop").length != 0 && !$("#" + stackPair[0] + "-" + stackPair[1] + "_pop").hasClass("stackCells")) {
                $("#" + stackPair[0] + "-" + stackPair[1] + "_pop").click();
            } else {
                element = $("#popupthreadstate table tbody tr td").not(".hide");
                if (element != undefined && element[0] != undefined && !element[0].classList.contains("stackCells")) {
                    element[0].click();
                }
            }
        } else {
            let stackPair = filterStack.split("_");
            if ($("#" + stackPair[0] + "-" + stackPair[1]).length != 0 && !$("#" + stackPair[0] + "-" + stackPair[1]).hasClass("stackCells")) {
                $("#" + stackPair[0] + "-" + stackPair[1]).click();
            } else {
                element = $("#threadstate table tbody tr td").not(".hide");
                if (element != undefined && element[0] != undefined && !element[0].classList.contains("stackCells")) {
                    element[0].click();
                }
            }
        }
    }

    function isFilterEmpty(dimIndexMap) {
        if (dimIndexMap == undefined) {
            dimIndexMap = {};
            for (let val in contextData.header[customEvent]) {
                const tokens = contextData.header[customEvent][val].split(":");
                if (tokens[1] == "text" || tokens[1] == "timestamp") {
                    dimIndexMap[tokens[0]] = val;
                }
            }
        }
        let isEmpty = true;
        for (dim in dimIndexMap) {
            if (filterMap[dim] != undefined && dim != "tid") { //handle tid separately
                isEmpty = false;
            }
        }

        if(isSFDC && !customEvent.includes(".Async")){//sfdc patch
            return false;
        }
        return isEmpty;
    }

    function filterMatch(record, dimIndexMap, timestampIndex, recordSpan) {
        //TODO: time range filter apply to all context, so check if the record is overlapping with time range given.
        if(pStart != '' && pEnd != ''){
            if(!( (record[timestampIndex] >= pStart && record[timestampIndex] <= pEnd) || //request end in range
                (record[timestampIndex] - recordSpan >= pStart && record.epoch - recordSpan <= pEnd) || //request start in range
                (record[timestampIndex] - recordSpan <= pStart && record[timestampIndex] >= pEnd) ) //range is part of request span
            ){
                return false;
            }
        }
        for (dim in dimIndexMap) {
            if (dim === "tid" || dim === "timestamp") {
                if (!(filterMap[dim] == undefined || record[dimIndexMap[dim]] == filterMap[dim])) {
                    return false;
                }
            } else {
                if (!(filterMap[dim] == undefined || record[dimIndexMap[dim]]?.includes(filterMap[dim]))) {
                    return false;
                }
            }
        }
        return true;
    }

    function getHearderFor(field) {
        return field;
    }

    var randomColor = (function () {
        var golden_ratio_conjugate = 0.618033988749895;
        var h = Math.random();

        var hslToRgb = function (h, s, l) {
            var r, g, b;

            if (s == 0) {
                r = g = b = l; // achromatic
            } else {
                function hue2rgb(p, q, t) {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1 / 6) return p + (q - p) * 6 * t;
                    if (t < 1 / 2) return q;
                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                    return p;
                }

                var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                var p = 2 * l - q;
                r = hue2rgb(p, q, h + 1 / 3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1 / 3);
            }

            return '#' + Math.round(r * 255).toString(16) + Math.round(g * 255).toString(16) + Math.round(b * 255).toString(16);
        };

        return function () {
            h += golden_ratio_conjugate;
            h %= 1;
            return hslToRgb(h, 0.5, 0.60);
        };
    })();

    function svgShowReq(evt) {
        var svgobj = evt.target;
        if (svgobj.getAttribute("style") == undefined || !svgobj.getAttribute("style").includes("opacity: 0")) {
            showRequestContextPopup(svgobj.getAttribute("id"));
        }
    }

    function OnScroll0(div) {
        var d2 = document.getElementById("requestbarchart");
        d2.scrollTop = div.scrollTop;
    }

    function OnScroll1(div) {
        var d2 = document.getElementById("requestbarchart");
        d2.scrollLeft = div.scrollLeft;
    }

    function OnScroll2(div) {
        var d1 = document.getElementById("xaxisid");
        var d0 = document.getElementById("yaxisid");
        d0.scrollTop = div.scrollTop;
        d1.scrollLeft = div.scrollLeft;
    }

    function addXAxis(id, top, right, bottom, left, min_x, max_x, w, h, contextStart, downScale) {
        const margin = {top: top, right: right, bottom: bottom, left: left};
        const width = w - margin.left - margin.right,
            height = h - margin.top - margin.bottom;
        const g = d3.select(id).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        let ticCount = (max_x - min_x) / 75;

        let xScale = d3.scaleLinear()
            .domain([min_x, max_x])
            .range([0, width]);

        let curTick = 0;
        let xAxisGenerator = d3.axisBottom()
            .scale(xScale)
            .tickPadding(5)
            .ticks(ticCount)
            .tickFormat(function (d) {
                if (curTick == 0) {
                    curTick = 1;
                    return moment.utc(d * downScale + contextStart).format('MM-DD HH:mm:ss');
                } else {
                    return moment.utc(d * downScale + contextStart).format('mm:ss');
                }
            });

        let xAxis = g.append("g")
            .call(xAxisGenerator);

        xAxis.selectAll(".tick text")
            .attr("y", 6)
            .attr("x", 6)
            .style("text-anchor", "start");
    }

    function addYAxis(id, top, right, bottom, left, min_x, max_x, w, h) {
        const margin = {top: top, right: right, bottom: bottom, left: left};
        const width = w - margin.left - margin.right,
            height = h - margin.top - margin.bottom;
        const g = d3.select(id).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        let xScale = d3.scaleLinear()
            .domain([min_x, max_x])
            .range([0, h]);

        g.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -20)
            .attr("x", -100)
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .text("Thread ID");

        let xAxisGenerator = d3.axisRight()
            .scale(xScale)
            .ticks(max_x)
            .tickSize(4)
            .tickFormat(function (d) {
                return tidIndex[d];
            });

        let xAxis = g.append("g")
            .call(xAxisGenerator);

        xAxis.selectAll(".tick text")
            .style("font-size", 8)
            .attr("y", 4)
            .attr("x", 3)
            .style("text-anchor", "start");
    }

    function drowStateChart(filteredTidRequests, chartWidth, downScale, minStart, chartHeight, tidSortByMetricMap, groupByCountSum, timestampIndex, spanIndex, groupByIndex, sortByIndex, tidRowIndex, isContextViewFiltered, customEvent, groupByTypeSortByMetricMap) {
        let viewNote = '';

        if(!isContextViewFiltered){
            if(customEvent == otherEvent){
                viewNote = "<div id='timeLineChartNote' class='col-lg-12' style='padding: 0 !important;'>" + getOtherHintNote(false, otherEvent) + "</div>";
            }else {
                viewNote = "<div id='timeLineChartNote' class='col-lg-12' style='padding: 0 !important;'>" + getContextHintNote(false) + "</div>";
            }
        }

        document.getElementById("statetable").innerHTML = viewNote+"<div class='row col-lg-12' style='padding: 0 !important;'>"
            + "<div  style='width: 4%;float: left;'></div>"
            + "<div style=\"max-height: 50px;overflow: hidden;width: 96%;float: right;\">"
            + " <div class='row col-lg-12' style='padding: 0 !important;'>"
            + "   <div class='xaxisid col-lg-10' id='xaxisid' style=\"padding: 0 !important; max-height: 50px;overflow: scroll;overflow-y: hidden;\" onscroll='OnScroll1(this)'>"
            + "   </div>"
            + "   <div class='col5 col-lg-2' style=\"padding: 0 !important; max-height: 50px;overflow: hidden;\" id='col5'>"
            + "   </div>"
            + " </div>"
            + "</div>"
            + "</div>"

            + "<div class='row col-lg-12' style='padding: 0 !important;'>"
            + " <div  id='yaxisid' style=\"max-height: 400px;overflow: scroll;overflow-x: hidden;width: 4%;float: left;\" class='yaxisid' onscroll='OnScroll0(this)'></div>"
            + " <div style=\"max-height: 400px;overflow: hidden;width: 96%;float: right;\">"
            + "    <div class='row col-lg-12' style='padding: 0 !important;'>"
            + "      <div class='requestbarchart col-lg-10' onscroll='OnScroll2(this)' style=\"padding: 0 !important; height: 400px;max-height: 400px;overflow: auto;\" id='requestbarchart'>"
            + "      </div>"
            + "      <div class='legendid col-lg-2' style=\"padding: 10px !important; height: 400px; max-height: 400px;overflow: auto;\" id='legendid'>"
            + "      </div>"
            + "    </div>"
            + " </div>"
            + "</div>";

        d3.select("#requestbarchart").append("svg").attr("width", chartWidth).attr("height", chartHeight);

        let d3svg = d3.select("#requestbarchart").select("svg");

        Tooltip = d3.select("#requestbarchart")
            .append("div")
            .style("opacity", 0)
            .attr("class", "tooltip")
            .style("background-color", "white")
            .style("border", "solid")
            .style("border-width", "2px")
            .style("border-radius", "5px")
            .style("padding", "5px");

        let h = 8;
        let y = 0;

        let contextDataRecords = undefined;
        if (contextData != undefined && contextData.records != undefined) {
            contextDataRecords = contextData.records[customEvent];
        }

        let curI = 0;
        let countMax = seriesCount;
        for (let [tid, value] of tidSortByMetricMap) {
            if (curI >= countMax) {
                break;
            }
            curI++;

            let curTime = minStart;
            let x = 0;
            for (let index of filteredTidRequests[tid]) {
                let record = contextDataRecords[tid][index].record;
                let tmpEpoch = record[timestampIndex];
                let tmpRunTime = record[spanIndex] == undefined ? 0 : record[spanIndex];
                if (tmpEpoch < minStart) {
                    tmpRunTime = tmpRunTime - (minStart - tmpEpoch);
                    tmpEpoch = minStart;
                }
                if (tmpEpoch >= curTime) {
                    d3svg.append("rect")
                        .attr("width", (tmpEpoch - curTime) / downScale)
                        .attr("height", h)
                        .attr("x", x)
                        .attr("y", y)
                        .attr("fill", "white");

                    x = x + (tmpEpoch - curTime) / downScale;
                    let key = (groupByIndex != -1 &&  record[groupByIndex] != undefined && record[groupByIndex].slice != undefined) ? record[groupByIndex].slice(0, groupByLength) : record[groupByIndex];
                    let metricVal = record[sortByIndex];
                    let key1 = tmpColorMap.get(key);
                    key1 = key1.replace("#", "_");
                    if (tmpRunTime > spanThreshold) {
                        d3svg.append("rect")
                            .attr("width", tmpRunTime / downScale)
                            .attr("height", h)
                            .attr("d", key)
                            .attr("x", x)
                            .attr("y", y)
                            .attr("fill", tmpColorMap.get(key))
                            .attr("class", key1 + " tgl")
                            .attr("onclick", 'svgShowReq(evt)')
                            .attr("id", record[tidRowIndex] + "_" + record[timestampIndex])
                            .on("mouseover", function () {
                                return mouseoverSVG(key1, this);
                            })
                            .on("mousemove", function () {
                                return mousemoveSVG(getHearderFor(groupBy) + ": " + key, key1, this, sortBy + ": " + metricVal);
                            })
                            .on("mouseleave", function () {
                                return mouseleaveSVG(key1, this);
                            });
                    }

                    x = x + tmpRunTime / downScale;

                    curTime = tmpEpoch + tmpRunTime;
                }

            }
            y = y + h;
        }
    }

    var Tooltip = undefined;
    var mouseoverSVG = function (key, obj) {
        if (d3.select(obj).attr("style") == undefined || !d3.select(obj).attr("style").includes("opacity: 0")) {

            Tooltip
                .style("opacity", 1);

            d3.select(obj)
                .style("stroke", "black")
                .style("cursor", "pointer");
        }
    }

    var mousemoveSVG = function (d, key, obj, metricVal) {
        if (d3.select(obj).attr("style") == undefined || !d3.select(obj).attr("style").includes("opacity: 0")) {
            Tooltip
                .html(d + ", " + metricVal + '<br>Click to see request profile samples and context')
                .style("left", (d3.mouse(obj)[0] + 20) + "px")
                .style("top", (d3.mouse(obj)[1]) + "px");
        }
    }

    var mouseleaveSVG = function (key, obj) {
        if (d3.select(obj).attr("style") == undefined || !d3.select(obj).attr("style").includes("opacity: 0")) {
            Tooltip
                .style("opacity", 0);
            d3.select(obj)
                .style("stroke", "none")
                .style("cursor", "default");
        }
    }

    function legendMouseOver(e, key) {
        if (!e.hasAttribute("dimmed")) {
            d3.selectAll("." + key).classed("requestHover", true);
        }
        e.style.cursor = "pointer";
    }

    function legendMouseOut(e, key, color) {
        if (!e.hasAttribute("dimmed")) {
            d3.selectAll("." + key).classed("requestHover", false);
        }
        e.style.cursor = "default";
    }

    function disableCategory(e, key) {
        if (e.hasAttribute("dimmed")) {
            d3.selectAll("." + key).style("opacity", 1);
            e.removeAttribute("dimmed");
            e.style.opacity = 1;
        } else {
            d3.selectAll("." + key).style("opacity", 0);
            e.setAttribute("dimmed", true);
            e.style.opacity = 0.3;
        }
    }

    function addLegend(id, groupByTypeSortByMetricMap, groupByCount, groupByCountSum) {
        if (getHearderFor(groupBy) == "timestamp") {
            return;
        }
        let table = "<table style='font-size: 10px;font-weight:bold;border:none;'>"
            + "<tr><td style='border:none;text-align: left;padding-right: 5px'>" + getHearderFor(sortBy) + "</td><td style='border:none;text-align: left;'>" + getHearderFor(groupBy) + "</td></tr>";
        for (let [key, value] of groupByTypeSortByMetricMap) {
            let key1 = tmpColorMap.get(key);
            key1 = key1.replace("#", "_");
            let legend = key;
            if (isSFDC && key == undefined && (groupBy == "msg" || groupBy == "userId" || groupBy == "qTier" || groupBy == "sfdcMsgId")) {
                legend = "NA (non MQ)";
            }

            table += "<tr style='padding:0px;border:none; color:" + tmpColorMap.get(key) + "'><td style='padding:1px;border:none;padding-right: 3px;width:40px'>" + (100 * value / groupByCountSum).toFixed(2) + "%" + "</td><td style='padding:1px;border:none;' onclick=\"disableCategory(this,'" + key1 + "')\" onmouseout=\"legendMouseOut(this,'" + key1 + "','" + tmpColorMap.get(key) + "')\" onmouseover=\"legendMouseOver(this,'" + key1 + "')\" title='right click to add to filter' hint='" + groupBy + "' class=\"context-menu-two\" style='curson: pointer'>" + legend + "</td></tr>";
        }
        table += "</table>";
        $(id).html(table);
    }

    function closePin(id){
        $("#"+id).remove();
    }

    let pinCount = 0;
    function addChart(){
        for(let i=0; i<pinCount; i++) {
            if ($('#pinid' + i).length) {
                    charts['pinid' + i].load({
                        xs: pinxs,
                        columns: pincolumns
                    });
            }
        }
    }

    function pinChart(){
        let pinid = "pinid"+pinCount;
        let closepin = "pinclose"+pinCount;

        pinCount++;
        $('#statetablewrapper').append("<div id='"+closepin+"'style='border-style: dotted hidden hidden hidden;' class='statetable col-lg-12'><div style='float:right;cursor: pointer;' onclick='closePin(\""+closepin+"\")'>Close</div><div>Pinned chart Event:"+customEvent+", groupBy:"+groupBy+", Len:"+groupByLength+", Match:"+groupByMatch+", sortBy:"+sortBy+", Top:"+seriesCount+"</div><div id='"+pinid+"' class='col-lg-12' style='padding: 0 !important;'></div></div>");
        charts[pinid] = c3.generate({
            data: {
                xs: pinxs,
                columns: pincolumns
            },
            axis: {
                x: {
                    type: "timeseries",
                    localtime: false,
                    tick: {
                        format: function (d) {
                            const time = moment.utc(d);
                            if (time.year() > 1970) {
                                return time.format("D/M HH:mm:ss");
                            }
                            return (time.format("X") / 60).toFixed(2) + "m";
                        },
                        count: 100,
                    }
                },
                y: {
                    label: pinYlabel
                },
            },
            bindto: document.getElementById(pinid),
            size: {
                height: 300
            },
            legend: {
                position: 'right'
            },
            subchart: {
                show: false
            },
            point: {
                show: false
            }
        });

        $("#"+pinid).data('c3-chart', charts[pinid]);
    }
    let pincolumns = [];//use this for pinning
    let pinxs = {};
    let pincolor = {};
    let charts = {};

    let pinYlabel = "";
    function drawTimelineChart(filteredTidRequests, minStart, tidSortByMetricMap, groupByTypeSortByMetricMap, groupByCountSum, timestampIndex, spanIndex, groupByIndex, sortByIndex, isContextViewFiltered, customEvent) {
        let chartType = "line";
        let showPoint = false;
        let showLables = false;
        if(isContextViewFiltered){
            document.getElementById("statetable").innerHTML = "<div id='timeLineChart' class='col-lg-12' style='padding: 0 !important;'></div>"
        }else{
            if(customEvent == otherEvent) {
                if(customEvent === "diagnostics") {
                    chartType = "scatter";
                }else{
                    showPoint = true;
                    showLables = true;
                }
                document.getElementById("statetable").innerHTML = "<div id='timeLineChartNote' class='col-lg-12' style='padding: 0 !important;'>" + getOtherHintNote(false, otherEvent) + "</div><div id='timeLineChart' class='col-lg-12' style='padding: 0 !important;'></div>"
            }else{
                document.getElementById("statetable").innerHTML = "<div id='timeLineChartNote' class='col-lg-12' style='padding: 0 !important;'>" + getContextHintNote(false) + "</div><div id='timeLineChart' class='col-lg-12' style='padding: 0 !important;'></div>"
            }
        }
        pinxs = {};//clear off while drawing new, this will be the source for next pinning
        pincolumns = [];//clear off while drawing new, this will be the source for next pinning
        let countMax = seriesCount;
        let curI = 0;
        pincolor = {};//clear off while drawing new, this will be the source for next pinning
        let contextDataRecords = undefined;
        if (contextData != undefined && contextData.records != undefined) {
            contextDataRecords = contextData.records[customEvent];
        }

        for (let [type, value1] of groupByTypeSortByMetricMap) {
            if((groupByMatch != '' && type!= undefined && type.includes != undefined && !type.includes(groupByMatch))){
                continue;
            }
            if (curI >= countMax) {
                break;
            }
            let legend = (groupByCountSum == 0 ? 0 :(100 * value1 / groupByCountSum).toFixed(2)) + "% " + type + ":"+sortBy;

            curI++
            pincolor[type] = tmpColorMap.get(type);
            let series = [];
            let series_x = [];
            let cumulative_map = new Map();
            pinxs[legend] = legend + "_x";
            series_x.push(legend + "_x");
            series.push(legend);
            for (let [tid, value] of tidSortByMetricMap) {
                for (let index of filteredTidRequests[tid]) {
                    let record = contextDataRecords[tid][index].record;
                    let tmpEpoch = record[timestampIndex];
                    let tmpRunTime = record[spanIndex] == undefined ? 0 : record[spanIndex];
                    let key = (groupByIndex != -1 && record[groupByIndex] != undefined && record[groupByIndex].slice != undefined) ? record[groupByIndex].slice(0, groupByLength) : record[groupByIndex];

                    if (key == type) {
                        let diff = record[sortByIndex];
                        if (cumulative_map.has(tmpEpoch + tmpRunTime)) {
                            cumulative_map.set(tmpEpoch + tmpRunTime, cumulative_map.get(tmpEpoch + tmpRunTime) + diff);
                        } else {
                            cumulative_map.set(tmpEpoch + tmpRunTime, diff);
                        }
                    }

                }
            }
            const tmpSort = new Map([...cumulative_map].sort((a, b) => a[0] - b[0]));
            let tmpValSum = 0;
            let prevTmpTime = 0;
            let tmpValMax = 0;
            for (let [tmpTime, tmpVal] of tmpSort) {
                tmpValSum += tmpVal;
                if(tmpValMax < tmpVal){
                    tmpValMax = tmpVal;
                }
                //make series points once every 1000ms to improve chart performance
                if (prevTmpTime == 0 || (tmpTime - prevTmpTime) >= 1000) {
                    series_x.push(tmpTime);
                    if (cumulativeLine != 0) {
                        series.push(tmpValMax);
                        tmpValSum = 0;
                        tmpValMax = 0;
                    }else{
                        series.push(tmpValSum);
                    }
                    prevTmpTime = tmpTime;
                }
            }
            pincolumns.push(series);
            pincolumns.push(series_x);
        }

        pinYlabel = sortBy;
        var chart = c3.generate({
            data: {
                xs: pinxs,
                columns: pincolumns,
                colors: pincolor,
                type: chartType,
                labels: showLables
            },
            bar: {
                width: {
                    ratio: 5
                }
            },
            axis: {
                x: {
                    type: "timeseries",
                    localtime: false,
                    tick: {
                        format: function (d) {
                            const time = moment.utc(d);
                            if (time.year() > 1970) {
                                return time.format("D/M HH:mm:ss");
                            }
                            return (time.format("X") / 60).toFixed(2) + "m";
                        },
                        count: 100,
                    }
                },
                y: {
                    label: sortBy
                },
            },
            bindto: document.getElementById("timeLineChart"),
            size: {
                height: 400
            },
            legend: {
                position: 'right'
            },
            subchart: {
                show: true
            },
            point: {
                show: showPoint,
                r: function(d) {
                    return 5;
                }
            }
        });
        $("#timeLineChart").data('c3-chart', chart);
    }

    function getOrderandType() {
        return 1;
    }

    function getEventTableHeader(groupby) {
        let header = "<thead><tr>";
        if (!(groupby == undefined || groupby == "" || groupby == "All records")) {
            header = header + "<th>" + groupby + "</th>";
        }
        if (contextData != undefined && contextData.header != undefined) {
            for (let val in contextData.header[customEvent]) {
                const tokens = contextData.header[customEvent][val].split(":");
                if (groupby == undefined || groupby == "" || groupby == "All records" || tokens[1] == "number") {
                    header = header + "<th>" + tokens[0] + "</th>";
                }
            }
        }
        if (!(groupby == undefined || groupby == "" || groupby == "All records")) {
            header = header + "<th>Count</th>";
        }
        header = header + "</tr></thead>";
        return header;
    }

    function addContextHints() {
        let eventToUse = $("#event-input").val();
        let table = "<table  class='ui-widget' style='border-spacing: 2px; border-collapse: separate;border: hidden'><tr><td style='border: hidden'  id='filter-heading'>Context hints:</td>";
        if (contextData != undefined && contextData.header != undefined) {
            for (let val in contextData.header[eventToUse]) {
                const tokens = contextData.header[eventToUse][val].split(":");
                if (tokens[1] == "text") {
                    table += "<td style='border: hidden' class='all-hints'><a class='send-ga' href=\"javascript:addToFilter('" + tokens[0] + "=xxxx');\" title='Narrows down a filter to a single "+tokens[0]+". For example " + tokens[0] + "=xxxx' tabindex='-1'>" + tokens[0] + "</a></td>";
                }
                if(tokens[0] == "threadname"){
                    table += "<td style='border: hidden' class='all-hints'><a class='send-ga' href=\"javascript:addToFilter('frame=xxxx');\" title='Narrows down a filter to a single frame. For example frame=xxxx' tabindex='-1'>frame</a></td>";
                }
            }
            table += "<td style='border: hidden' class='all-hints'>Start:<input  style='height:30px;text-align: center;' class='filterinput' id='filtertimepickerstart' type='text'></td>";
            table += "<td style='border: hidden' class='all-hints'>End:<input  style='height:30px;text-align: center;' class='filterinput' id='filtertimepickerend' type='text'></td>";
        }
        table += "</tr></table>";
        $("#contexthints").html(table);
        if (contextData != undefined && contextData.header != undefined) {
            jQuery("#filtertimepickerstart").datetimepicker({
                format: 'Y-m-d H:i:s',
                formatDate: 'Y-m-d',
                formatTime: 'H:i',
                step: 1
            });
            jQuery("#filtertimepickerend").datetimepicker({
                format: 'Y-m-d H:i:s',
                formatDate: 'Y-m-d',
                formatTime: 'H:i',
                step: 1
            });
            $("#filtertimepickerstart").change(function (event) {
                if (moment.utc($("#filtertimepickerstart").val()).valueOf() < getContextTree(1).context.start) {
                    $("#filtertimepickerstart").val(moment.utc(getContextTree(1).context.start).format('YYYY-MM-DD HH:mm:ss'));
                    pStart = getContextTree(1).context.start;
                }else{
                    pStart = moment.utc($("#filtertimepickerstart").val()).valueOf();
                }
                if ($("#filtertimepickerend").val() != '' && moment.utc($("#filtertimepickerend").val()).valueOf() > getContextTree(1).context.end) {
                    $("#filtertimepickerend").val(moment.utc(getContextTree(1).context.end).format('YYYY-MM-DD HH:mm:ss'));
                    pEnd = getContextTree(1).context.end;
                }else{
                    pEnd = moment.utc($("#filtertimepickerend").val()).valueOf();
                }
                addToFilter("pStart="+pStart);
                addToFilter("pEnd="+pEnd);
            });
            $("#filtertimepickerend").change(function (event) {
                if (moment.utc($("#filtertimepickerend").val()).valueOf() > getContextTree(1).context.end) {
                    $("#filtertimepickerend").val(moment.utc(getContextTree(1).context.end).format('YYYY-MM-DD HH:mm:ss'));
                    pEnd = getContextTree(1).context.end;
                }else{
                    pEnd = moment.utc($("#filtertimepickerend").val()).valueOf();
                }
                if ($("#filtertimepickerstart").val() != '' && moment.utc($("#filtertimepickerstart").val()).valueOf() < getContextTree(1).context.start) {
                    $("#filtertimepickerstart").val(moment.utc(getContextTree(1).context.start).format('YYYY-MM-DD HH:mm:ss'));
                    pStart = getContextTree(1).context.start;
                }else{
                    pStart = moment.utc($("#filtertimepickerstart").val()).valueOf();
                }
                addToFilter("pStart="+pStart);
                addToFilter("pEnd="+pEnd);
            });
            if(pStart != '') {
                $("#filtertimepickerstart").val(moment.utc(Number(pStart)).format('YYYY-MM-DD HH:mm:ss'));
            }else{
                $("#filtertimepickerstart").val(moment.utc( getContextTree(1).context.start).format('YYYY-MM-DD HH:mm:ss'));
            }
            if(pEnd != '') {
                $("#filtertimepickerend").val(moment.utc(Number(pEnd)).format('YYYY-MM-DD HH:mm:ss'));
            }else{
                $("#filtertimepickerend").val(moment.utc( getContextTree(1).context.end).format('YYYY-MM-DD HH:mm:ss'));
            }
        }
    }

    function populateEventInputOptions(id){
        $('#'+id).empty();
        let events = [];

        if (contextData != undefined && contextData.records != undefined) {
            let customEventFound = false;
            if(!(customEvent == '' || customEvent == undefined)) {
                for (let value in contextData.records) {
                    if(customEvent == value){
                        customEventFound = true;
                        otherEvent = value;
                        break;
                    }
                }
            }
            for (let value in contextData.records) {
                events.push(value);
            }
            events.sort();

            for (let i = 0; i < events.length; i++) {
                if(customEvent == '' || customEvent == undefined || !customEventFound){
                    customEvent = events[i];
                    otherEvent =  events[i];
                    console.log("customEvent 2: " +customEvent);
                    customEventFound=true;
                }
                $('#'+id).append($('<option>', {
                    value:  events[i],
                    text:  events[i],
                    selected: (customEvent ==  events[i])
                }));
            }
        }

        $("#event-input").on("change", (event) => {
            //updateUrl("customevent", $("#event-input").val(), true);
            //customEvent = $("#event-input").val();
            //tmpColorMap.clear();
            addContextHints();
            if( $("#event-input").val() == customEvent) {
                setApplyDisabled(true);
            }else{
                setApplyDisabled(false);
            }
        });
    }

    function setCustomEvent() {
        if (customEvent == "") {
            //try to get first available
            if (contextData != undefined && contextData.records != undefined) {
                for (let value in contextData.records) {
                    customEvent = value;
                    otherEvent = customEvent; // reset to default
                    console.log("customEvent 3: " +customEvent);
                    break;
                }
            }
        }
    }

    function isRequestHasFrame(requestArr, entryIndex, event, start, end, addTofilteredStackMap) {
        let flag = false;
        let curIndex = entryIndex;

        //consider all matching requests downward
        let isJstack = false;
        if(event == "Jstack" || event == "json-jstack"){
            isJstack = true;
        }
        while ((flag == false || addTofilteredStackMap) && curIndex >= 0 && requestArr[curIndex].time >= start && requestArr[curIndex].time <= end) {
            if (frameFilterStackMap[event][requestArr[curIndex].hash] !== undefined) {
                flag = true;
                if (isJstack) {
                    if (filteredStackMap[FilterLevel.LEVEL3][tid] == undefined) {
                        filteredStackMap[FilterLevel.LEVEL3][tid] = [];
                    }
                    filteredStackMap[FilterLevel.LEVEL3][tid].push(requestArr[curIndex]);
                }
            }
            curIndex--;
        }
        curIndex = entryIndex + 1;
        //consider all matching samples upward
        while ((flag == false || addTofilteredStackMap) && curIndex < requestArr.length && requestArr[curIndex].time >= start && requestArr[curIndex].time <= end) {
            if (frameFilterStackMap[event][requestArr[curIndex].hash] !== undefined) {
                flag = true;
                if (isJstack) {
                    if (filteredStackMap[FilterLevel.LEVEL3][tid] == undefined) {
                        filteredStackMap[FilterLevel.LEVEL3][tid] = [];
                    }
                    filteredStackMap[FilterLevel.LEVEL3][tid].push(requestArr[curIndex]);
                }
            }
            curIndex++;
        }
        return flag;
    }

    function getOtherHintNote(treeview, eventToHandle){
        if(eventToHandle == undefined){
            eventToHandle = customEvent;
        }
        let note = "Note: Context hint(s) ";
        let filterSkipped = false;
        if(contextData.header != undefined && contextData.header[customEvent] != undefined) {
            for (let val in contextData.header[customEvent]) {
                const tokens = contextData.header[customEvent][val].split(":");
                if (tokens[1] == "text" || tokens[1] == "timestamp") {
                    if(filterMap[tokens[0]] != undefined) {
                        if(!treeview) {
                            note = note + " '" + tokens[0] + "'";
                            filterSkipped = true;
                        }
                    }
                }
            }
            if(frameFilterString !== "" && !treeview){
                note = note + " 'frame'";
                filterSkipped=true;
            }
            note = note + " not applied on this event '" + eventToHandle + "' view";
        }
        if(filterSkipped){
            return note;
        }else{
            return "";
        }
    }


    function getContextHintNote(treeview, eventToHandle){
        if(eventToHandle == undefined){
            eventToHandle = customEvent;
        }
        let note = "Note: Context hint(s) ";
        let filterSkipped = false;
        if(contextData.header != undefined && contextData.header[customEvent] != undefined) {
            for (let val in contextData.header[customEvent]) {
                const tokens = contextData.header[customEvent][val].split(":");
                if (tokens[1] == "text" || tokens[1] == "timestamp") {
                    if(tokens[0] != "tid" && filterMap[tokens[0]] != undefined) {
                        if(!treeview || tokens[0] != "threadname") {
                            note = note + " '" + tokens[0] + "'";
                            filterSkipped = true;
                        }
                    }
                }
            }
            if(frameFilterString !== "" && !treeview){
                note = note + " 'frame'";
                filterSkipped=true;
            }
            note = note + " not applied on this view, event " + eventToHandle + " do not have 'duration' span";
        }
        if(filterSkipped){
            return note;
        }else{
            return "";
        }
    }


/*
    function genRequestTableWithDataTables() { //deprecated

        console.log("genRequestTable start");
        setToolBarOptions("statetabledrp");

        let start1 = performance.now();
        //setCustomEvent();

        if (customEvent == "" || customEvent == undefined) {
            return;
        }

        //status graph start
        let downScale = 200;
        let maxEndTimeOfReq = 0;
        let totalRows = 0;
        let rowHeight = 8;
        let filteredTidRequests = {};
        let lineCount = 0;
        if (tableFormat == 2 || tableFormat == 3) {
            tidIndex = {};
        }
        let tmpTidSortByMetricMap = new Map();
        let tmpGgroupByTypeSortByMetricMap = new Map();
        let groupByCount = 0;
        let groupByCountSum = 0;
        //status graph end

        let metricSumMap = {};
        let tidDatalistVal = filterMap["tid"];

        let event = getEventType();
        let isJstack = false;
        if(event == "Jstack" || event == "json-jstack"){
            isJstack = true;
        }

        let dimIndexMap = {};
        let metricsIndexMap = {};
        let metricsIndexArray = [];
        let isDimIndexMap = {};
        let groupByIndex = -1;
        let sortByIndex = -1;
        let spanIndex = -1;
        let timestampIndex = -1;
        let tidRowIndex = -1;
        let isContextViewFiltered = true;


        let sortByFound = false;
        let groupByFound = false;

        for (let val in contextData.header[customEvent]) {
            const tokens = contextData.header[customEvent][val].split(":");
            if (tokens[1] == "number") {
                metricsIndexArray.push(val);
                metricsIndexMap[tokens[0]] = val;
            }
            if (groupBy == tokens[0]) {
                groupByIndex = val;
                groupByFound = true;
            }
            if (sortBy == tokens[0]) {
                sortByFound = true;
                sortByIndex = val;
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
                isDimIndexMap[val]=tokens[0];
            }
        }

        if (!groupByFound) {
            //groupBy = "tid";
            //groupByIndex=tidRowIndex;
        }
        if (!sortByFound) {
            //sortBy = "duration";
            //sortByIndex = spanIndex;
        }

        addContextHints();

        let contextStart = getContextTree(1).context.start;
        let contextTidMap = getContextTree(1).context.tidMap;
        let contextDataRecords = undefined;
        if (contextData != undefined && contextData.records != undefined) {
            contextDataRecords = contextData.records[customEvent];
        }

        let table = "<table   style=\"border:none;padding=0px;width: 100%;\" id=\"state-table\" class=\"table compact table-striped table-bordered  table-hover dataTable\">" + getEventTableHeader(groupBy);

        if((!isFilterEmpty(dimIndexMap) || frameFilterString !== "") && spanIndex == -1 ){
            isContextViewFiltered = false;//record do not have duration span to apply context filters
        }
        //if only frame filter is selected then we need to include stacks that are not part of any request spans.
        if (frameFilterString !== "" && tidDatalistVal == undefined && isFilterEmpty(dimIndexMap)) {
            for (var tid in contextTidMap) {
                if (isJstack  ) {
                    for (let index = 0; index < contextTidMap[tid].length; index++) {
                        if ((pStart === '' || pEnd === '') || (contextTidMap[tid][index].time + contextStart) >= pStart && (contextTidMap[tid][index].time + contextStart) <= pEnd) { // apply time range filter
                            if (frameFilterStackMap[event][contextTidMap[tid][index].hash] !== undefined) {
                                if (filteredStackMap[FilterLevel.LEVEL3][tid] == undefined) {
                                    filteredStackMap[FilterLevel.LEVEL3][tid] = [];
                                }
                                filteredStackMap[FilterLevel.LEVEL3][tid].push(contextTidMap[tid][index]);
                            }
                        }
                    }
                }
                //generate context table data, need to include requests that has frame filter found stacks
                if (contextDataRecords[tid] != undefined) {
                    let includeTid = false;
                    let reqArray = [];
                    let recordIndex = -1;
                    contextDataRecords[tid].forEach(function (obj) {
                        let record = obj.record;
                        let flag = false;
                        recordIndex++;
                        let recordSpan = record[spanIndex] == undefined ? 0 : record[spanIndex];
                        if (filterMatch(record, dimIndexMap, timestampIndex, recordSpan)) {
                            if(record[spanIndex] == undefined){
                                flag = true; //include all records when 'duration' span is not available. context view cannot be filtered
                            }else {
                                let end = record[timestampIndex] - contextStart + recordSpan;
                                let start = record[timestampIndex] - contextStart;
                                try {
                                    //do a binary search
                                    let entryIndex = isinRequest(contextTidMap[tid], start, end);
                                    if (entryIndex != -1) {
                                        let requestArr = contextTidMap[tid];
                                        flag = isRequestHasFrame(requestArr, entryIndex, event, start, end, false);
                                    }
                                } catch (err) {
                                    //console.log("tid not found in JFR" + tid.key + " " + err.message);
                                }
                            }
                        }

                        if (flag) {
                            if ((tableFormat == 2 || tableFormat == 3)) {
                                includeTid = true;
                                reqArray.push(recordIndex);
                                if ((recordSpan + record[timestampIndex]) > maxEndTimeOfReq) {
                                    maxEndTimeOfReq = recordSpan + record[timestampIndex];
                                }
                                let key = (groupByIndex != -1 && record[groupByIndex] != undefined && record[groupByIndex].slice != undefined) ? record[groupByIndex].slice(0, groupByLength) : record[groupByIndex];
                                if (!tmpColorMap.has(key)) {
                                    tmpColorMap.set(key, randomColor());
                                    groupByCount++;
                                }
                                let metricValue = record[metricsIndexMap[sortBy]];
                                if (metricValue != undefined) {
                                    groupByCountSum += metricValue;
                                } else {
                                    metricValue = 0;
                                }
                                if (tmpGgroupByTypeSortByMetricMap.has(key)) {
                                    tmpGgroupByTypeSortByMetricMap.set(key, tmpGgroupByTypeSortByMetricMap.get(key) + metricValue);
                                } else {
                                    tmpGgroupByTypeSortByMetricMap.set(key, metricValue);
                                }

                                if (tmpTidSortByMetricMap.has(tid)) {
                                    tmpTidSortByMetricMap.set(tid, tmpTidSortByMetricMap.get(tid) + metricValue);
                                } else {
                                    tmpTidSortByMetricMap.set(tid, metricValue);
                                }
                            }
                            if (groupBy == "" || groupBy == undefined || groupBy == "All records") {
                                if (record[metricsIndexMap[tableThreshold]] >= spanThreshold) {//todo change names tableThreshold to recordInput, spanThreshold to recordThreshold
                                    table = table + "<tr>";
                                    for (let field in record) {
                                        if (field == timestampIndex) {
                                            table = table + "<td  hint='timestamp' class='context-menu-one' id='" + record[tidRowIndex] + "_" + record[field] + "'>" + moment.utc(record[field]).format('YYYY-MM-DD HH:mm:ss SSS') + ":"+ record[field] + "</td>";
                                        } else {
                                            if(isDimIndexMap[field] !== undefined){
                                                table = table + "<td hint='"+isDimIndexMap[field]+"' class='context-menu-two'>" + record[field] + "</td>";
                                            }else {
                                                table = table + "<td>" + record[field] + "</td>";
                                            }
                                        }
                                    }
                                    table = table + "</tr>";
                                }
                            } else {
                                let key = (groupByIndex != -1 && record[groupByIndex] != undefined && record[groupByIndex].slice != undefined) ? record[groupByIndex].slice(0, groupByLength) : record[groupByIndex];

                                if (metricSumMap[key] == undefined) {
                                    metricSumMap[key] = Array(metricsIndexArray.length + 1).fill(0);
                                }

                                for (let i = 0; i < metricsIndexArray.length; i++) {
                                    metricSumMap[key][i] += record[metricsIndexArray[i]];
                                }
                                metricSumMap[key][metricsIndexArray.length] += 1;
                            }
                        }
                    });
                    if (includeTid) {
                        filteredTidRequests[tid] = reqArray;
                        lineCount++;
                        totalRows++;
                    }
                }
            }
        } else {
            for (var tid in contextDataRecords) {
                let includeTid = false;
                let reqArray = [];
                let recordIndex = -1;
                if (tidDatalistVal == undefined || tidDatalistVal == tid) {
                    contextDataRecords[tid].forEach(function (obj) {
                        let record = obj.record;
                        let flag = false;
                        recordIndex++;
                        let recordSpan = record[spanIndex] == undefined ? 0 : record[spanIndex];
                        if (filterMatch(record, dimIndexMap, timestampIndex, recordSpan)) {
                            if (record[spanIndex] == undefined) {
                                flag = true; //include all records when 'duration' span is not available. context view cannot be filtered
                            } else {
                                //context filter matched, but check if samples of request is matching frame filter
                                if (frameFilterString !== "") {
                                    flag = false;

                                    //check if the request has a stack and if stack is in frameFilterStackMap
                                    let end = record[timestampIndex] - contextStart + recordSpan;
                                    let start = record[timestampIndex] - contextStart;

                                    try {
                                        //do a binary search
                                        let entryIndex = isinRequest(contextTidMap[tid], start, end);
                                        if (entryIndex != -1) {
                                            let requestArr = contextTidMap[tid];
                                            flag = isRequestHasFrame(requestArr, entryIndex, event, start, end, false);
                                        }
                                    } catch (err) {
                                        //console.log("tid not found in JFR" + tid + " " + err.message);
                                    }
                                }else{
                                    flag = true;
                                }
                            }
                        }

                        if (flag) {
                            if ((tableFormat == 2 || tableFormat == 3)) {
                                includeTid = true;
                                reqArray.push(recordIndex);
                                if ((recordSpan + record[timestampIndex]) > maxEndTimeOfReq) {
                                    maxEndTimeOfReq = recordSpan + record[timestampIndex];
                                }
                                let key = (groupByIndex != -1 &&   record[groupByIndex] != undefined &&record[groupByIndex].slice != undefined) ? record[groupByIndex].slice(0, groupByLength) : record[groupByIndex];
                                if (!tmpColorMap.has(key)) {
                                    tmpColorMap.set(key, randomColor());
                                    groupByCount++;
                                }
                                let metricValue = record[metricsIndexMap[sortBy]];
                                if (metricValue != undefined) {
                                    groupByCountSum += metricValue;
                                } else {
                                    metricValue = 0;
                                }
                                if (tmpGgroupByTypeSortByMetricMap.has(key)) {
                                    tmpGgroupByTypeSortByMetricMap.set(key, tmpGgroupByTypeSortByMetricMap.get(key) + metricValue);
                                } else {
                                    tmpGgroupByTypeSortByMetricMap.set(key, metricValue);
                                }

                                if (tmpTidSortByMetricMap.has(tid)) {
                                    tmpTidSortByMetricMap.set(tid, tmpTidSortByMetricMap.get(tid) + metricValue);
                                } else {
                                    tmpTidSortByMetricMap.set(tid, metricValue);
                                }
                            }
                            if (groupBy == "" || groupBy == undefined || groupBy == "All records") {
                                if (record[metricsIndexMap[tableThreshold]] >= spanThreshold) {
                                    table = table + "<tr>";
                                    for (let field in record) {
                                        if (field == timestampIndex) {
                                            table = table + "<td hint='timestamp' class=\"context-menu-one\" id='" + record[tidRowIndex] + "_" + record[field] + "'>" + moment.utc(record[field]).format('YYYY-MM-DD HH:mm:ss SSS') + ":"+ record[field] + "</td>";
                                        } else {
                                            if(isDimIndexMap[field] !== undefined){
                                                table = table + "<td hint='"+isDimIndexMap[field]+"' class='context-menu-two'>" + record[field] + "</td>";
                                            }else {
                                                table = table + "<td>" + record[field] + "</td>";
                                            }
                                        }
                                    }
                                    table = table + "</tr>";
                                }
                            } else {
                                let key = (groupByIndex != -1 &&  record[groupByIndex] != undefined && record[groupByIndex].slice != undefined) ? record[groupByIndex].slice(0, groupByLength) : record[groupByIndex];
                                if (metricSumMap[key] == undefined) {
                                    metricSumMap[key] = Array(metricsIndexArray.length + 1).fill(0);
                                }

                                for (let i = 0; i < metricsIndexArray.length; i++) {
                                    metricSumMap[key][i] += record[metricsIndexArray[i]];
                                }
                                metricSumMap[key][metricsIndexArray.length] += 1;
                            }
                        }
                    });
                    if (includeTid) {
                        filteredTidRequests[tid] = reqArray;
                        lineCount++;
                        totalRows++;
                    }
                }
            }
        }
        let end1 = performance.now();
        console.log("genRequestTable 0 time:" + (end1 - start1))
        let start = performance.now();
        let order = getOrderandType();
        if (tableFormat == 2 || tableFormat == 3) {
            let minStart = getContextTree(1, getEventType()).context.start; //records are aligned to method profile context start
            let chartWidth = maxEndTimeOfReq - minStart;
            if (chartWidth < 600000) {//min 10 min
                chartWidth = 600000;
            }
            chartWidth = chartWidth / downScale;
            const tidSortByMetricMap = new Map([...tmpTidSortByMetricMap.entries()].sort((a, b) => b[1] - a[1]));
            const groupByTypeSortByMetricMap = new Map([...tmpGgroupByTypeSortByMetricMap.entries()].sort((a, b) => b[1] - a[1]));
            //generate tidIndex for Yaxis
            let index = 0;
            for (let [tid, value] of tidSortByMetricMap) {
                tidIndex[index] = tid;
                index++;
            }
            if (tableFormat == 2) {
                drowStateChart(filteredTidRequests, chartWidth, downScale, minStart, totalRows * rowHeight, tidSortByMetricMap, groupByCountSum, timestampIndex, spanIndex, groupByIndex, sortByIndex, tidRowIndex, isContextViewFiltered, customEvent);
                addLegend("#legendid", groupByTypeSortByMetricMap, groupByCount, groupByCountSum);
                addYAxis("#yaxisid", 0, 0, 0, 17, 0, lineCount, 500, totalRows * rowHeight);
                addXAxis("#xaxisid", 15, 0, 0, 0, 0, chartWidth, chartWidth, 50, minStart, downScale);
            } else {
                drawTimelineChart(filteredTidRequests, minStart, tidSortByMetricMap, groupByTypeSortByMetricMap, groupByCountSum, timestampIndex, spanIndex, groupByIndex, sortByIndex, isContextViewFiltered, customEvent);
            }
        } else {
            if (!(groupBy == "" || groupBy == undefined || groupBy == "All records")) {
                for (let dim in metricSumMap) {
                    table = table + "<tr>";
                    table = table + "<td hint='"+groupBy+"' class='context-menu-two'>" + dim + "</td>";
                    for (let i = 0; i < metricSumMap[dim].length; i++) {
                        table = table + "<td>" + metricSumMap[dim][i] + "</td>";
                    }
                    table = table + "</tr>";
                }
            }
            if(!isContextViewFiltered) {
                table = table + "<div id='timeLineChartNote' class='col-lg-12' style='padding: 0 !important;'>"+getContextHintNote(false)+"</div>";
            }
            table = table + "</table>";
            document.getElementById("statetable").innerHTML = table;

            enableDataTable(order);
        }
        setToolBarOptions("statetabledrp");

        $("#event-input").on("change", (event) => {
            updateUrl("customevent", $("#event-input").val(), true);
            customEvent = $("#event-input").val();
            //tmpColorMap.clear();
            //setToolBarOptions("statetabledrp");
            //genRequestTable();
            //updateRequestView();
        });
        $("#filter-input").on("change", (event) => {
            updateUrl("groupBy", $("#filter-input").val(), true);
            groupBy = $("#filter-input").val();
            tmpColorMap.clear();
            genRequestTable();
            updateRequestView();
        });
        $("#format-input").on("change", (event) => {
            updateUrl("tableFormat", $("#format-input").val(), true);
            tableFormat = $("#format-input").val();
            genRequestTable();
            updateRequestView();
        });
        $("#sort-input").on("change", (event) => {
            updateUrl("sortBy", $("#sort-input").val(), true);
            sortBy = $("#sort-input").val();
            genRequestTable();
            updateRequestView();
        });
        $("#line-type").on("change", (event) => {
            updateUrl("cumulative", $("#line-type").val(), true);
            cumulativeLine = $("#line-type").val();
            genRequestTable();
            updateRequestView();
        });
        $("#line-count").on("change", (event) => {
            updateUrl("seriesCount", $("#line-count").val(), true);
            seriesCount = $("#line-count").val();
            genRequestTable();
            updateRequestView();
        });
        $("#groupby-match").on("change", (event) => {
            updateUrl("groupByMatch", $("#groupby-match").val(), true);
            groupByMatch = $("#groupby-match").val();
            genRequestTable();
            updateRequestView();
        });
        $("#groupby-length").on("change", (event) => {
            updateUrl("groupByLength", $("#groupby-length").val(), true);
            groupByLength = $("#groupby-length").val();
            genRequestTable();
            updateRequestView();
        });

        $("#table-threshold").on("change", (event) => {
            updateUrl("tableThreshold", $("#table-threshold").val(), true);
            tableThreshold = $("#table-threshold").val();
            genRequestTable();
            updateRequestView();
        });
        $("#span-threshold").on("change", (event) => {
            updateUrl("spanThreshold", $("#span-threshold").val(), true);
            spanThreshold = $("#span-threshold").val();
            genRequestTable();
            updateRequestView();
        });
        $("#cct-panel").css("height", "100%");


        let end = performance.now();
        console.log("genRequestTable 1 time:")
    }
    */

    function enableDataTable(order) {
        /*
        if (contextTable != undefined) {
            contextTablePage = 0; //reset to 0 except 1st time
        }

        contextTable = $('#state-table').DataTable({
            "order": [[ order, "desc" ]],
            searching: true,
            "columnDefs": [{}],
            "drawCallback": function (settings) {
                if (contextTable != undefined) {
                    //when we change table page focus, remove request selection
                    if ((filterReq != "" && filterReq != undefined) && $("#" + filterReq).length != 0) {
                        updateRequestView();
                    }
                    contextTablePage = contextTable.page.info().page * contextTable.page.len();
                    updateUrl("cpage", contextTablePage, true);
                }
            },
            "displayStart": contextTablePage,
            aoColumnDefs: [
                {
                    orderSequence: ["desc", "asc"],
                    aTargets: ['_all']
                }
            ],
            "sDom": '<"toolbar">tfp<"clear">'
        });*/
    }

    function setToolBarOptions(id) {

        console.log("getToolBarOptions1 otherEvent: " + otherEvent + " customEvent: " + customEvent +" groupBy:" +groupBy+ " tableFormat: "+tableFormat+" sortBy:"+sortBy+" cumulativeLine:"+cumulativeLine+" spanThreshold: "+ spanThreshold + " tableThreshold:"+tableThreshold);

        let toolBarOptions = '<span title="JFR Event type">Data:</span> <select  style="height:30px;width:200px;text-align: center; " class="filterinput"  name="other-event-input" id="other-event-input">\n';
        if (contextData != undefined && contextData.records != undefined) {
            let otherEventFound = false;
            if(!(otherEventFound == '' || otherEventFound == undefined)) {
                for (let value in contextData.records) {
                    if(otherEvent == value){
                        otherEventFound = true;
                        break;
                    }
                }
            }

            for (let value in contextData.records) {
                if(otherEvent == '' || otherEvent == undefined || !otherEventFound){
                    //otherEvent = customEvent;
                    console.log("otherEvent 1: " + otherEvent);
                    otherEventFound=true;
                }
                if(customEvent == value || otherEventsFetched[value] != undefined) {
                    toolBarOptions += '<option ' + ((otherEvent == value || customEvent == value) ? "selected" : "") + " value='" + value + "'>" + value + "</option>\n";
                }
            }
        }
        toolBarOptions += '             </select>';

        toolBarOptions += '&nbsp;&nbsp;<span title="Context view format">Format:</span> <select  style="height:30px;width:120px;text-align: center; " class="filterinput"  name="format-input" id="format-input">\n' +
            '                            <option ' + (tableFormat == 0 ? "selected" : "") + ' value=0>table</option>\n' +
            //'                            <option ' + (tableFormat == 1 ? "selected" : "") + ' value=1>percent</option>\n' +
            '                            <option ' + (tableFormat == 2 ? "selected" : "") + ' value=2>thread request view</option>\n' +
            '                            <option ' + (tableFormat == 3 ? "selected" : "") + ' value=3>metric timeline view</option>\n' +
            '                    </select>';


        if (tableFormat == 2 || tableFormat == 3) {

            toolBarOptions += '                        </select>' +
                '&nbsp;&nbsp;<span title="Sort context view by event metric">'+ ((tableFormat == 2)? "Sort by": "Series") +':</span> <select  style="height:30px;width:120px;text-align: center; " class="filterinput"  name="sort-input" id="sort-input">\n';

            if (contextData != undefined && contextData.header != undefined) {

                let sortByFound = false;
                if(!(sortBy == '' || sortBy == undefined)) {
                    for (let val in contextData.header[otherEvent]) {
                        const tokens = contextData.header[otherEvent][val].split(":");
                        if(sortBy == tokens[0] && sortBy != "timestamp"){
                            sortByFound = true;
                            break;
                        }
                    }
                }

                for (let val in contextData.header[otherEvent]) {
                    const tokens = contextData.header[otherEvent][val].split(":");
                    if((sortBy == '' || sortBy == undefined || !sortByFound) && !(tokens[1] == "text" || tokens[1] == "timestamp")){
                        sortBy = tokens[0];
                        sortByFound = true;
                    }
                    if (!(tokens[1] == "text" || tokens[1] == "timestamp")) {
                        toolBarOptions += '<option ' + (sortBy == tokens[0] ? "selected" : "") + " value='" + tokens[0] + "'>" + tokens[0] + "</option>\n";
                    }
                }
            }
            toolBarOptions += '       </select> ';
        }

        toolBarOptions += '&nbsp;&nbsp;<span title="Group by event dimension">Group by:</span> <select  style="height:30px;width:120px;text-align: center; " class="filterinput"  name="filter-input" id="filter-input">\n';

        if (tableFormat == 0) {
            toolBarOptions += "<option value='All records'>Show all records</option>";
        }


        if (contextData != undefined && contextData.header != undefined) {
            let groups = [];
            for (let val in contextData.header[otherEvent]) {
                const tokens = contextData.header[otherEvent][val].split(":");
                if (tokens[1] == "text") {
                    groups.push(tokens[0]);
                }else if(tokens[1] == "timestamp" && tableFormat == 0){
                    groups.push(tokens[0]);
                }
            }
            groups.sort();

            let groupByFound = false;
            if(!(groupBy == '' || groupBy == undefined || groupBy == "All records")) {
                for (let val in contextData.header[otherEvent]) {
                    const tokens = contextData.header[otherEvent][val].split(":");
                    if(groupBy == tokens[0]){
                        groupByFound = true;
                        break;
                    }
                }
            }

            if(groupBy == "All records"){
                groupByFound=true;
            }

            for (let i = 0; i < groups.length; i++) {
                if((groupBy == '' || groupBy == undefined || !groupByFound) ){
                    groupBy = groups[i];
                    groupByFound=true;
                }
                toolBarOptions += '<option ' + (groupBy == groups[i] ? "selected" : "") + " value='" + groups[i] + "'>" + groups[i] + "</option>\n";
            }
        }
        toolBarOptions += '             </select>';

        toolBarOptions +=    '&nbsp;&nbsp;<span title="Consider first N characters of group by option values">Len:</span> <input  style="height:30px;width:35px;text-align: left;" class="filterinput" id="groupby-length" type="text" value="'+groupByLength+'">\n';
        toolBarOptions +=    '&nbsp;&nbsp;<span title="Sub string match with group by option values">Match:</span><input  style="height:30px;width:120px;text-align: left;" class="filterinput" id="groupby-match" type="text" value="'+groupByMatch+'">\n';


        if (tableFormat == 3) {
            if(seriesCount > 40){
                seriesCount = 5;
            }
            toolBarOptions += '                        </select>' +
                '&nbsp;&nbsp;<span title="Show time series by cumulative/abolute diff">Value:</span> <select  style="height:30px;text-align: center; " class="filterinput"  name="line-type" id="line-type">\n' +
                '                            <option ' + (cumulativeLine == 0 ? "selected" : "") + ' value=0>cumulative</option>\n' +
                '                            <option ' + (cumulativeLine == 1 ? "selected" : "") + ' value=1>absolute diff</option>\n' +
                '                            </select> ';

            toolBarOptions += '                        </select>' +
                '&nbsp;&nbsp;<span title="Show top N series">Top:</span> <select  style="height:30px;text-align: center; " class="filterinput"  name="line-count" id="line-count">\n' +
                '                            <option ' + (seriesCount == 5 ? "selected" : "") + ' value=5>5</option>\n' +
                '                            <option ' + (seriesCount == 10 ? "selected" : "") + ' value=10>10</option>\n' +
                '                            <option ' + (seriesCount == 15 ? "selected" : "") + ' value=15>15</option>\n' +
                '                            <option ' + (seriesCount == 20 ? "selected" : "") + ' value=20>20</option>\n' +
                '                            <option ' + (seriesCount == 25 ? "selected" : "") + ' value=25>25</option>\n' +
                '                            <option ' + (seriesCount == 30 ? "selected" : "") + ' value=30>30</option>\n' +
                '                            <option ' + (seriesCount == 40 ? "selected" : "") + ' value=40>40</option>\n' +
                '                            </select> ';
            toolBarOptions += '<button title="pin a copy of this chart below" style="cursor: pointer;" id="pin-input" class="btn-info" type="submit">PIN</button>&nbsp;<button title="copy this chart series onto pinned charts" style="cursor: pointer;" id="add-chart" class="btn-info" type="submit">LOAD</button>';
        }

        if (tableFormat == 2) {
            if(seriesCount < 50){
                seriesCount = 100;
            }

            toolBarOptions += '                        </select>' +
                '&nbsp;&nbsp;<span title="Show top N threads">Top:</span> <select  style="height:30px;text-align: center; " class="filterinput"  name="line-count" id="line-count">\n' +
                '                            <option ' + (seriesCount == 100 ? "selected" : "") + ' value=100>100</option>\n' +
                '                            <option ' + (seriesCount == 50 ? "selected" : "") + ' value=50>50</option>\n' +
                '                            <option ' + (seriesCount == 200 ? "selected" : "") + ' value=200>200</option>\n' +
                '                            <option ' + (seriesCount == 500 ? "selected" : "") + ' value=500>500</option>\n' +
                '                            <option ' + (seriesCount == 1000 ? "selected" : "") + ' value=1000>1000</option>\n' +
                '                            <option ' + (seriesCount == 5000 ? "selected" : "") + ' value=5000>5000</option>\n' +
                '                            <option ' + (seriesCount == 10000 ? "selected" : "") + ' value=10000>10000</option>\n' +
                '                            </select> ';
        }

        if ((groupBy == "" || groupBy == undefined || groupBy == "All records") && tableFormat != 3 ) {
            toolBarOptions += '                        </select>' +
                '&nbsp;&nbsp;<span title="Show events above selected metric value">Threshold:</span> <select  style="height:30px;text-align: center; " class="spanMetric"  name="table-threshold" id="table-threshold">\n';
            if (contextData != undefined && contextData.header != undefined) {
                let tableThresholdFound = false;
                if(!(tableThreshold == '' || tableThreshold == undefined)) {
                    for (let val in contextData.header[otherEvent]) {
                        const tokens = contextData.header[otherEvent][val].split(":");
                        if(tableThreshold == tokens[0]){
                            tableThresholdFound = true;
                            break;
                        }
                    }
                }

                for (let val in contextData.header[otherEvent]) {
                    const tokens = contextData.header[otherEvent][val].split(":");

                    if((tableThreshold == '' || tableThreshold == undefined || !tableThresholdFound) && !(tokens[1] == "text" || tokens[1] == "timestamp")){
                        tableThreshold = tokens[0];
                        tableThresholdFound = true;
                    }
                    if (!(tokens[1] == "text" || tokens[1] == "timestamp")) {
                        toolBarOptions += '<option ' + (tableThreshold == tokens[0] ? "selected" : "") + " value='" + tokens[0] + "'>" + tokens[0] + "</option>\n";
                    }
                }
            }
            toolBarOptions += '       </select> ';
            toolBarOptions += '                        </select>' +
                '&nbsp;&nbsp;<select  style="height:30px;text-align: center; " class="filterinput"  name="span-threshold" id="span-threshold">\n' +
                '                            <option ' + (spanThreshold == 200 ? "selected" : "") + " value='200'>200</option>\n" +
                '                            <option ' + (spanThreshold == 100 ? "selected" : "") + " value='100'>100</option>\n" +
                '                            <option ' + (spanThreshold == 0 ? "selected" : "") + " value='0'>0</option>\n" +
                '                            </select> ';
        }

        console.log("getToolBarOptions2 otherEvent: " + otherEvent +" groupBy:" +groupBy+ " tableFormat: "+tableFormat+" sortBy:"+sortBy+" cumulativeLine:"+cumulativeLine+" spanThreshold: "+ spanThreshold + " tableThreshold:"+tableThreshold);

        $('#'+id).html(toolBarOptions);

        $("#pin-input").on("click", (event) => {
            pinChart();
        });
        $("#add-chart").on("click", (event) => {
            addChart();
        });

        $("#other-event-input").on("change", (event) => {
            updateUrl("customevent", $("#event-input").val(), true);
            otherEvent = $("#other-event-input").val();
            tmpColorMap.clear();
            setToolBarOptions("statetabledrp");
            genRequestTable();
            updateRequestView();
        });
    }

    //context tree start
    function getStackFrameV1(name) {
        try {
            let obj = JSON.parse('{"nm":"","sz":0,"sf":0,"ch":[], "map":{}}');
            obj["nm"] = name;
            return obj;
        } catch (e) {
            console.log(e.message);
        }
    }

    function addFrameV1(frameName, size, self, frame) {
        if (frame['map'][frameName] === undefined) {
            frame['map'][frameName] = getStackFrameV1(frameName);
            frame['ch'].push(frame['map'][frameName]);
        }
        frame['map'][frameName]['sz'] = frame['map'][frameName]['sz'] + size;
        frame['map'][frameName]['sf'] = frame['map'][frameName]['sf'] + self;
        return frame['map'][frameName];
    }

    function invertTreeV1(tree, num) {
        if (tree['tree'] !== undefined) {
            tree = tree['tree'];
        }
        let arr = [];
        var invertTree = getStackFrameV1("root");
        let count = invertV1(tree, invertTree, arr, 0, num);
        invertTree['sz'] = tree['sz'];
        invertTree['subtotal'] = count;
        return invertTree;
    }

    function invertV1(baseJsonTree, invertTree, arr, size, num) {
        if (baseJsonTree == null) {
            let frame = invertTree;
            for (let i = arr.length - 1; i > 0; i--) {
                if (i == arr.length - 1) {
                    frame = addFrameV1(arr[i], size, size, frame);
                } else {
                    frame = addFrameV1(arr[i], size, 0, frame);
                }
            }
            return 0;
        }
        if (compareTree) {
            if ((baseJsonTree['bsz'] !== undefined && num == 1 && baseJsonTree['bsz'] == 0) || (baseJsonTree['csz'] !== undefined && num == 2 && baseJsonTree['csz'] == 0)) { // this was added form compare tree 2
                return 0;
            }
        }
        if (baseJsonTree['ch'] == null || baseJsonTree['ch'].length == 0) {
            let tmparr = [...arr];
            tmparr.push(baseJsonTree['nm']);
            invertV1(null, invertTree, tmparr, baseJsonTree['sz'], num);
            return baseJsonTree['sz'];
        } else {
            let count = 0;
            for (let treeIndex = 0; treeIndex < baseJsonTree['ch'].length; treeIndex++) {
                let tmparr = [...arr];
                tmparr.push(baseJsonTree['nm']);
                count = count + invertV1(baseJsonTree['ch'][treeIndex], invertTree, tmparr, baseJsonTree['sz'], num)
            }
            if (baseJsonTree['sf'] != 0) {
                let frame = invertTree;
                let tmparr = [...arr];
                let diff = baseJsonTree['sf'];
                tmparr.push(baseJsonTree['nm']);
                for (let i = tmparr.length - 1; i > 0; i--) {
                    if (i == arr.length - 1) {
                        frame = addFrameV1(tmparr[i], diff, diff, frame);
                    } else {
                        frame = addFrameV1(tmparr[i], diff, 0, frame);
                    }
                }
            }
            return count;
        }
    }

    function invertTreeV1AtLevel(tree, num) {
        if (tree['tree'] !== undefined) {
            tree = tree['tree'];
        }
        let level = getSelectedLevel(getActiveTree(getEventType(), false));
        let arr = [];
        var invertTree = getStackFrameV1("root");
        let count = invertV1atLevel(tree, invertTree, arr, 0, num, level);
        invertTree['sz'] = tree['sz'];
        invertTree['subtotal'] = count;
        //invertTree[level] = tree[level]; // set level size?
        return invertTree;
    }

    function invertV1atLevel(baseJsonTree, invertTree, arr, size, num, level) {
        if(baseJsonTree[level] === undefined || baseJsonTree[level] === 0) {
            return 0;
        }
        if (baseJsonTree == null) {
            let frame = invertTree;
            for (let i = arr.length - 1; i > 0; i--) {
                if (i == arr.length - 1) {
                    frame = addFrameV1(arr[i], size, size, frame);
                } else {
                    frame = addFrameV1(arr[i], size, 0, frame);
                }
            }
            return 0;
        }
        if (compareTree) {
            if ((baseJsonTree['bsz'] !== undefined && num == 1 && baseJsonTree['bsz'] == 0) || (baseJsonTree['csz'] !== undefined && num == 2 && baseJsonTree['csz'] == 0)) { // this was added form compare tree 2
                return 0;
            }
        }
        if (baseJsonTree['ch'] == null || baseJsonTree['ch'].length == 0) {
            let tmparr = [...arr];
            tmparr.push(baseJsonTree['nm']);

            let frame = invertTree;
            for (let i = tmparr.length - 1; i > 0; i--) {
                if (i == 1) {
                    frame = addFrameV1(tmparr[i], baseJsonTree[level], baseJsonTree[level], frame);
                } else {
                    frame = addFrameV1(tmparr[i], baseJsonTree[level], 0, frame);
                }
            }
            return baseJsonTree[level];
        } else {
            let count = 0;
            for (let treeIndex = 0; treeIndex < baseJsonTree['ch'].length; treeIndex++) {
                if(level !== FilterLevel.UNDEFINED){
                    let tmparr = [...arr];
                    tmparr.push(baseJsonTree['nm']);
                    count = count + invertV1atLevel(baseJsonTree['ch'][treeIndex], invertTree, tmparr, baseJsonTree[level], num, level);
                }
            }
            let diff = baseJsonTree[level] - count;
            if (diff > 0) {
                let frame = invertTree;
                let tmparr = [...arr];
                tmparr.push(baseJsonTree['nm']);
                for (let i = tmparr.length - 1; i > 0; i--) {
                    if (i == arr.length - 1) {
                        frame = addFrameV1(tmparr[i], diff, diff, frame);
                    } else {
                        frame = addFrameV1(tmparr[i], diff, 0, frame);
                    }
                }
            }
            return baseJsonTree[level];
        }
    }

    function sortTreeBySizeWrapper(tree){
        //console.log("sortTreeBySize");
        sortTreeBySize(tree);
    }

    function sortTreeBySize(tree) {
        let ch = tree['ch'];
        if (ch != undefined && ch !== null) {
            for (let index = 0; index < ch.length; index++) {
                sortTreeBySize(ch[index]);
            }
            ch.sort(function (a, b) {
                return b.sz  - a.sz;
            });
        }
    }
    //context tree end

    let prevSelectedLevel = undefined;

    function getSelectedLevel(tree) {

        if(tree === undefined){
            console.log("getSelectedLevel:" + FilterLevel.UNDEFINED);
            return FilterLevel.UNDEFINED;
        }
        if(tree[FilterLevel.LEVEL3] !== undefined) {
            console.log("getSelectedLevel:" + FilterLevel.LEVEL3);
            return FilterLevel.LEVEL3;
        }
        if(tree[FilterLevel.LEVEL2] !== undefined) {
            console.log("getSelectedLevel:" + FilterLevel.LEVEL2);
            return FilterLevel.LEVEL2;
        }
        if(tree[FilterLevel.LEVEL1] !== undefined) {
            console.log("getSelectedLevel:" + FilterLevel.LEVEL1);
            return FilterLevel.LEVEL1;
        }
        console.log("getSelectedLevel:" + FilterLevel.UNDEFINED);
        return FilterLevel.UNDEFINED;
    }

    function callTreePerfGenieAjax(pod, method, endpoint, successFunc) {
        const headers = {};
        return internalPerfGenieAjax(endpoint, method, successFunc, () => {
        }, headers);
    }

    function internalPerfGenieAjax(url, method, successFunc, errorFunc, headers, data, includeCookies = false) {
        let requestObject = {
            url: url,
            type: method,
            success: successFunc,
            error: errorFunc,
            headers: headers,
            xhrFields: { withCredentials: includeCookies }
        };

        if (data !== undefined) {
            requestObject["data"] = data;
            return $.ajax(requestObject);
        }

        return $.ajax(requestObject);
    }

    // update the url with key/value
    function updateUrl(key, value, replace) {
        let newLocation = window.location.href.replace(new RegExp("((\\?|\\&)" + key + "=)[^\\&]*"), '$1' + encodeURIComponent(value));
        if (newLocation.indexOf(key) === -1) {
            const separator = (newLocation.indexOf("?") === -1) ? "?" : "&";
            newLocation = newLocation + separator + key + "=" + encodeURIComponent(value);
        }
        if (replace) {
            window.history.replaceState({}, "", newLocation);
        } else {
            window.history.pushState({}, "", newLocation);
        }
    }

    function setContextTree(tree, count, eventType) {
        if (eventType == undefined) {
            eventType = getEventType();
        }
        if (count == 1) {
            contextTree1[eventType] = tree;
        } else {
            contextTree2[eventType] = tree;
        }
    }

    function getContextTree(count, eventType) {
        if (eventType == undefined) {
            eventType = getEventType();
        }

        if(eventType == undefined) {
            return undefined;
        }

        if (count == 1) {
            return contextTree1[eventType];
        } else {
            return contextTree2[eventType];
        }
    }

    function setContextTreeInverted(tree, count, eventType) {
        if (eventType == undefined) {
            eventType = getEventType();
        }
        if (count == 1) {
            contextTreeInverted1[eventType] = tree;
        } else {
            contextTreeInverted2[eventType] = tree;
        }
    }

    function getContextTreeInverted(count, eventType) {
        if (eventType == undefined) {
            eventType = getEventType();
        }

        if(eventType == undefined) {
            return undefined;
        }

        if (count == 1) {
            return contextTreeInverted1[eventType];
        } else {
            return contextTreeInverted2[eventType];
        }
    }

    function setmergedContextTree(tree, eventType) {
        if (eventType == undefined) {
            eventType = getEventType();
        }
        mergedContextTree[eventType] = tree;
    }

    function getmergedContextTree(eventType) {
        if (eventType == undefined) {
            eventType = getEventType();
        }
        if(eventType == undefined) {
            return undefined;
        }
        return mergedContextTree[eventType];
    }

    function setmergedBacktraceTree(tree, eventType) {
        if (eventType == undefined) {
            eventType = getEventType();
        }
        mergedBacktraceTree[eventType] = tree;
    }

    function getmergedBacktraceTree(eventType) {
        if (eventType == undefined) {
            eventType = getEventType();
        }
        if(eventType == undefined) {
            return undefined;
        }
        return mergedBacktraceTree[eventType];
    }

    function setcontextTree1InvertedLevel(tree, eventType, level) {
        if (eventType == undefined) {
            eventType = getEventType();
        }
        if(contextTree1InvertedLevel[eventType] == undefined){
            contextTree1InvertedLevel[eventType] = {};
        }
        contextTree1InvertedLevel[eventType][level] = tree;
    }

    function getcontextTree1InvertedLevel(eventType, level) {
        if (eventType == undefined) {
            eventType = getEventType();
        }
        if(contextTree1InvertedLevel[eventType] != undefined) {
            return contextTree1InvertedLevel[eventType][level];
        }
        return undefined;
    }

    function getActiveTree(eventType, isCT) {
        if (eventType == undefined) {
            eventType = getEventType();
        }

        if (isCT == undefined) {
            isCT = isCalltree;
        }

        if (isCT) {
            if(isJfrContext && !compareTree) {
                let tree = getContextTree(1, eventType);
                if (tree['tree'] !== undefined) {
                    tree =  tree['tree'];
                }
                if(getSelectedLevel(tree) === FilterLevel.UNDEFINED){
                    return getContextTreeInverted(1, eventType);
                }else {
                    return getcontextTree1InvertedLevel(eventType, getSelectedLevel(tree));
                }
            }else {
                return getmergedContextTree();
            }
        } else {
            if(isJfrContext && !compareTree) {
                let tree = getContextTree(1, eventType);
                if (tree['tree'] !== undefined) {
                    return tree['tree'];
                }
                return tree;
            }else {
                return getmergedBacktraceTree();
            }
        }
    }

    function setContextData(data){
        contextData = data;
        processCustomEvents();
        populateEventInputOptions("event-input");
        setToolBarOptions("statetabledrp");
        loadDiagData1();
    }

    function setContextTreeFrames(frames, count){
        if(count == 1) {
            contextTree1Frames = frames;
        }
    }

    function getContextData() {
        return contextData;
    }

    function processCustomEvents() {

        if(contextData != undefined && contextData.records != undefined){
            if(contextData.header != undefined) {
                for (var customevent in contextData.records) {
                    for (var tid in contextData.records[customevent]) {
                        //sort by timestamp
                        contextData.records[customevent][tid].sort(function (a, b) {
                            return a.record[0] - b.record[0];
                        });
                    }
                }
                contextData.tooltips = {};
            }else {//convert to perfgene format sfdc
                isSFDC = true;
                let taskStart = performance.now();
                let joinRecords = {};
                let records = {};
                let header = {};
                let tooltips = {};
                let logContext = "logContext";
                let lastKey = "";
                let lastReq = "";
                for (var tid in contextData.records) {

                    contextData.records[tid].sort(function (a, b) {
                        return a.record[1] - b.record[1];
                    });

                    contextData.records[tid].forEach(function (obj) {
                        logContext = getContextName(obj.record[0]);
                        if (logContext != undefined) {
                            if (header[logContext] == undefined) {
                                header[logContext] = getContextHeader(obj.record[0]);
                                if (header[logContext] != undefined) {
                                    for (let val in header[logContext]) {
                                        const tokens = header[logContext][val].split(":");
                                        tooltips[tokens[0]] = tokens[2];
                                    }
                                }
                            }
                            if (records[logContext] == undefined) {
                                records[logContext] = {};
                            }
                            if (records[logContext][tid] == undefined) {
                                records[logContext][tid] = [];
                            }
                            if (obj.record[0] == 9) {
                                obj.record[1] = obj.record[1] - obj.record[6];//need to reset start time curtime - runTime
                            } else if (obj.record[0] == 10 || obj.record[0] == 12) {//change duration to millis
                                obj.record[4] = obj.record[4] / 1000000;
                            } else if (obj.record[0] == 2) {
                                if (header[".Async + Sync"] == undefined) {
                                    header[".Async + Sync"] = getContextHeader(20);
                                    if (header[".Async + Sync"] != undefined) {
                                        for (let val in header[".Async + Sync"]) {
                                            const tokens = header[".Async + Sync"][val].split(":");
                                            tooltips[tokens[0]] = tokens[2];
                                        }
                                    }
                                }
                                if (joinRecords[tid] == undefined) {
                                    joinRecords[tid] = [];
                                }

                                if (!(lastKey == obj.record[1] && lastReq == obj.record[10])) {
                                    lastKey = obj.record[1];
                                    lastReq = obj.record[10];
                                    //join:2 time 1,tid 2,orgId 5,userId 6,log 4,uri 3,threadName 27,reqId 10,runTime 8,cpuTime 7,dbTime 9,NA,apexTime 17,dbCpuTime 21,gcTime 12,spTime 13,bytesAllocated 28,dequeueLatency NA
                                    joinRecords[tid].push({"record": [obj.record[0], obj.record[1], obj.record[2], obj.record[5], obj.record[6], obj.record[4], obj.record[3], obj.record[27], obj.record[10], obj.record[8], obj.record[7], obj.record[9], "NA", obj.record[17], obj.record[21], obj.record[12], obj.record[13], obj.record[28], "NA"]});
                                }
                            } else if (obj.record[0] == 6) {
                                if (header[".Async + Sync"] == undefined) {
                                    header[".Async + Sync"] = getContextHeader(20);
                                    if (header[".Async + Sync"] != undefined) {
                                        for (let val in header[".Async + Sync"]) {
                                            const tokens = header[".Async + Sync"][val].split(":");
                                            tooltips[tokens[0]] = tokens[2];
                                        }
                                    }
                                }
                                if (joinRecords[tid] == undefined) {
                                    joinRecords[tid] = [];
                                }
                                if (!(lastKey == obj.record[1] && lastReq == obj.record[9])) {
                                    lastKey = obj.record[1];
                                    lastReq = obj.record[9];
                                    //join:6 time 1,tid 2,orgId 5,userId NA,log 4,uri 13,threadName 3,reqId 9,runTime 7,cpuTime 6,dbTime 8,dbHoldingTime NA,apexTime NA,dbCpuTime 12,gcTime NA,spTime NA,bytesAllocated 14,dequeueLatency 16
                                    joinRecords[tid].push({"record": [obj.record[0], obj.record[1], obj.record[2], obj.record[5], "NA", obj.record[4], obj.record[13], obj.record[3], obj.record[9], obj.record[7], obj.record[6], obj.record[8], "NA", "NA", obj.record[12], "NA", "NA", obj.record[14], Number(obj.record[16])]});
                                }
                            }
                            records[logContext][tid].push(obj);
                        }
                    });
                    records[logContext][tid].sort(function (a, b) {
                        return a.record[1] - b.record[1];
                    });
                }

                contextData.records = records;
                contextData.header = header;
                contextData.tooltips = tooltips;
                contextData.records[".Async + Sync"] = joinRecords;

                if (contextData.records["ActiveAsyncContext"] != undefined) {
                    for (var tid in contextData.records["ActiveAsyncContext"]) {
                        let missingmq = [];
                        let missingIDMap = {};
                        /*contextData.records["ActiveAsyncContext"][tid].sort(function (a, b) {
                            return a.record[1] - b.record[1];
                        });*/
                        contextData.records["ActiveAsyncContext"][tid].forEach(function (obj) {
                            let found = false;
                            if (contextData.records["AsyncContext"] != undefined && contextData.records["AsyncContext"][tid] != undefined) {
                                contextData.records["AsyncContext"][tid].forEach(function (obj1) {
                                    if (!found) {
                                        if (obj.record[7] === obj1.record[9]) {
                                            found = true;
                                            return false;
                                        }
                                    }
                                });
                            }
                            if (!found) {
                                if (missingIDMap[obj.record[7]] == undefined) {
                                    missingmq.push({"record": [obj.record[0], obj.record[1], obj.record[2], obj.record[3], "mqfrm-active", obj.record[4], obj.record[5], obj.record[6], 0, obj.record[7], obj.record[8], 0, obj.record[9], obj.record[10], obj.record[11], 0, 0, "NA", "NA", "NA", "NA"]});
                                    console.log(obj);
                                    missingIDMap[obj.record[7]] = 1;
                                }
                            }
                        });
                        if (Object.keys(missingmq).length !== 0) {
                            if (contextData.records["AsyncContext"] == undefined) {
                                contextData.records["AsyncContext"] = {};
                            }
                            if (contextData.records["AsyncContext"][tid] == undefined) {
                                contextData.records["AsyncContext"][tid] = [];
                            }
                            missingmq.forEach(function (obj) {
                                contextData.records["AsyncContext"][tid].push(obj);
                                contextData.records[".Async + Sync"][tid].push(obj);
                            });
                        }
                    }
                }
                console.log("sf adapter time : " + (performance.now() - taskStart));
                /*
                for (var customevent in contextData.records) {
                    for (var tid in contextData.records[customevent]) {
                        //sort by timestamp
                        contextData.records[customevent][tid].sort(function (a, b) {
                            return a.record[1] - b.record[1];
                        });
                    }
                }*/
            }
        }
    }

    function getContextName(type){
        if(type == 2){
            return "LogContext";
        }else if(type == 6){
            return "MessageQueue";
        }else if(type == 5){
            return "GlobalDescribe";
        }else if(type == 4) {
            return "ApexExecutionLogInfo";
        }else if(type == 9){//todo merge with AsyncContext
            return "MessageQueueActive";
        }else if( type == 10){
            return "DbConnectionContext";
        }else if(type == 12){
            return "CptskContext";
        }else if(type == 13) {//todo test
            return "SearchContext";
        }
        return undefined;
    }

    function getContextHeader(type){
        if(type == 2){
            return ["type:text","timestamp:timestamp:start time of the request","tid:text:tid","uri:text:log name of the request","logType:text:log record type associated with the request","orgId:text:organization Id","userId:text:user Id","cpuTime:number:the amount of cpu time in ms this request took","runTime:number:the wall time in ms this request took (APT)","dbTime:number:time spent in database","reqId:text:request Id","racNode:text:rac node","gcTime:number:GC duraiton in ms that impacted this request","safepointTime:number:time spent waiting for and including a safepoint","waitTime:number:approximate accumulated time ms that the thread waited for notification","blockedTime:number:approximate accumulated time ms that the thread blocked to enter/reenter a monitor","trust:text:is this a trust request","apexTime:number:wall clock time ms spent in apex code","apexCalloutTime:number:wall clock time ms spent in apex call out","cacheTime:number:wall clock time ms spent in apex call out","oraDbTime:number:time spent ms in db","dbCpu:number:cpu time ms in db","physRead:number:number of physical reads in db","physWrite:number:number of physical writes in db","dbConChkOut:number:time ms for which the connection was checkedout from the pool","dbGetCon:number:time ms taken to acquire a db connection or hit the timout","gets:number:number of buffer gets in db","threadname:text","bytes:number"];
        }else if(type == 6){
            return ["type:text","timestamp:timestamp:start time of the request","tid:text:tid","threadname:text","logType:text:log record type associated with the request","orgId:text:organization Id","cpuTime:number:the amount of cpu time in ms this request took","runTime:number:the wall time in ms this request took (APT)","dbTime:number:time spent in database","reqId:text:request Id","racNode:text:rac node","oraDbTime:number:time spent ms in db","dbCpu:number:cpu time ms in db","uri:text:log name of the request","bytes:number","totalMsg:number:total number of messages in dequeue set","dqLatency:number:time between enqueue and dequeue in ms","queueTier:text:tier of service for the queue where message is dequeued","sfdcMsgId:text:sfdc Id of the message","dqTrnBhvr:text:whether the handler is comitted or un-committed","connType:text:type of connection pool used by handler"];
        }else if(type == 5){
            return ["type:text","timestamp:timestamp:start time of the request","tid:text:tid","threadname:text","runTime:number:the wall time in ms this request took (APT)","reqId:text:request Id","classMethod:text:class and method calling getGlobalDescribe"];
        }else if(type == 4) {
            return ["type:text", "timestamp:timestamp:start time of the request", "tid:text:tid", "threadname:text", "runTime:number:the wall time in ms this request took (APT)", "reqId:text:request Id", "apexTime:number:wall clock time ms spent in apex code", "apexCalloutTime:number:wall clock time ms spent in apex call out", "oraDbTime:number:time spent ms in db", "dbCpu:number:cpu time ms in db", "classMethod:text:class and method calling getGlobalDescribe", "cmplTime:number:apex compilation time ms", "wfTime:number:time ms spent in workflow action and rules", "noSoql:number:number of soql query executions", "quidty:text:what kind of outer execution is this", "isLog:text:is apex debug logging enabled", "cpuTime:number:the amount of cpu time in ms this request took", "orgId:text:organization Id", "userId:text:user Id"];
        }else if(type == 9){
            return ["type:text","timestamp:timestamp:start time of the request","tid:text:tid","threadname:text","orgId:text:organization Id","cpuTime:number:the amount of cpu time in ms this request took","runTime:number:the wall time in ms this request took (APT)","reqId:text:request Id","racNode:text:rac node","dbCpu:number:cpu time ms in db","uri:text:log name of the request","bytes:number"];
        }else if( type == 10){//todo test
            return ["type:text","timestamp:timestamp:start time of the request","tid:text:tid","threadname:text","duration:number","orgId:text:organization Id","userId:text:user Id","reqId:text:request Id","backendPid:text","backendStartUpperBound:number","sid:text","serialNumber:text","connPoolType:text:the connection pool type id","racNode:text:rac node"];
        }else if(type == 12){//todo test
            return ["type:text","timestamp:timestamp:start time of the request","tid:text:tid","threadname:text","duration:number","gackId:text","spOid:text","spUrn:text","spRTime:number","spAppcpuTime:number","spAppMemoryAllocation:number","spDbcpuTime:number","spdblockedTime:number","spDbBufferGets:number","spDbDiskReads:number","spDbUndoBlocks:number","spTid:text","spKind:text","spStatusCode:text","spDbNodes","reqId:text:request Id"];
        }else if(type == 13){//todo test
            return ["type:text","timestamp:timestamp:start time of the request","tid:text:tid","threadname:text","duration:number","orgId:text:organization Id","ThreadName:text","reqId:text:request Id","RequestType:text","CoreName:text","PartitionId:text","RevisionId:text","ConsumerName:text","KeyPrefix:text"];
        }else if(type == 20){
            //join:6 time 1,tid 2,orgId 5,userId NA,log 4,uri 13,threadName 3,reqId 9,runTime 7,cpuTime 6,dbTime 8,dbHoldingTime NA,apexTime NA,dbCpuTime 12,gcTime NA,spTime NA,bytesAllocated 14,dequeueLatency 16
            return ["type:text","timestamp:timestamp:start time of the request","tid:text:tid","orgId:text","userId:text","logType:text","uri:text","threadname:text","reqId:text","runTime:number","cpuTime:number","dbTime:number","dbHoldingTime:number","apexTime:number","dbCpuTime:number","gcTime:number","spTime:number","bytesAllocated:number","dequeueLatency:number"];
        }
        return undefined;
    }

    //jfr context start
    // merge trees
    function mergeTreesV1(contextTreeMaster, contextTreeBranch, excludeDepth) {
        if ((isJfrContext) || (compareTree && isJfrContext)) {
            if (contextTreeMaster['merged'] !== undefined) {
                toastr_warning("mergeTreesV1 already done");
            }
            if (contextTreeMaster['tree'] !== undefined) {
                contextTreeMaster = contextTreeMaster['tree'];
            }
            if (contextTreeBranch['tree'] !== undefined) {
                contextTreeBranch = contextTreeBranch['tree'];
            }
            mergeTreesV2(contextTreeMaster, contextTreeBranch);

            updateStackIndex(contextTreeMaster);

            if (contextTreeMaster.ch == null || contextTreeMaster.ch.length === 0) {
                toastr_warning("Nothing to display");
                //return;
            } else {
                contextTreeMaster.bsz = contextTreeMaster.sz;
                contextTreeMaster.csz = contextTreeBranch.sz;
            }
            contextTreeMaster['merged'] = true;
            return contextTreeMaster;
        } /*else {
            const diffJson = breadthFirstDiffV1(contextTreeMaster, contextTreeBranch, excludeDepth);
            if (diffJson.children.length === 0) {
                toastr_warning("Nothing to display");
                //return;
            }
            return diffJson;
        }*/
    }
    function updateStackIndex(contextTreeMaster){
        contextTreeMaster["treeIndex"] = getSelectedLevel(contextTreeMaster);
        console.log("updateStackIndex:" + contextTreeMaster["treeIndex"]);
        if(contextTreeMaster.sm !== undefined && contextTreeMaster.ch !== undefined && contextTreeMaster.ch !== null) {
            for (let index = 0; index < contextTreeMaster.ch.length; index++) {
                if(contextTreeMaster.ch[index].sm !== undefined) {
                    for(var key in contextTreeMaster.ch[index].sm){
                        contextTreeMaster.sm[key] = index;
                    }
                }
            }
        }
    }

    //This will not create an extra tree to merge, memory optimization
    function mergeTreesV2(contextTreeBase, contextTreeCanary) {
        let baseCh = contextTreeBase['ch'];
        let canaryCh = contextTreeCanary['ch'];
        let baseLen = (baseCh !== null) ? baseCh.length : 0;
        let canaryLen = (canaryCh !== null) ? canaryCh.length : 0;

        //sort children based on name
        if (baseCh != null) {
            baseCh.sort(function (a, b) {
                if (a.nm == b.nm) {
                    return 0;
                } else if (a.nm < b.nm) {
                    return -1;
                } else {
                    return 1;
                }
            });
        }
        if (canaryCh != null) {
            canaryCh.sort(function (a, b) {
                if (a.nm == b.nm) {
                    return 0;
                } else if (a.nm < b.nm) {
                    return -1;
                } else {
                    return 1;
                }
            });
        }

        let baseIndex = 0;
        let canaryIndex = 0;
        let appendIndex = baseLen;
        while (baseIndex < baseLen && canaryIndex < canaryLen) {
            if (baseCh[baseIndex]['nm'] == canaryCh[canaryIndex]['nm']) {
                baseCh[baseIndex]['csz'] = canaryCh[canaryIndex]['sz'];
                baseCh[baseIndex]['bsz'] = baseCh[baseIndex]['sz'];
                mergeTreesV2(baseCh[baseIndex], canaryCh[canaryIndex]);//merge recurrsively
                baseIndex++;
                canaryIndex++;
            } else if (baseCh[baseIndex]['nm'] < canaryCh[canaryIndex]['nm']) {
                baseCh[baseIndex]['csz'] = 0;
                baseCh[baseIndex]['bsz'] = baseCh[baseIndex]['sz'];
                sortBaseTreeBySizeWrapper(baseCh[baseIndex]);//make sure sub tree is sorted by size
                baseIndex++;
            } else if (baseCh[baseIndex]['nm'] > canaryCh[canaryIndex]['nm']) {
                baseCh[appendIndex] = canaryCh[canaryIndex];
                baseCh[appendIndex]['csz'] = canaryCh[canaryIndex]['sz'];
                baseCh[appendIndex]['bsz'] = 0;
                sortCanaryTreeBySizeWrapper(baseCh[appendIndex]);//make sure sub tree is sorted by size
                appendIndex++;
                canaryIndex++;
            }
        }

        //update remaining baseCh
        for (let index = baseIndex; index < baseLen; index++) {
            baseCh[index]['csz'] = 0;
            baseCh[index]['bsz'] = baseCh[index]['sz'];
            //TODO update all childs bsz to sz and csz to 0
            sortBaseTreeBySizeWrapper(baseCh[index]);//make sure sub tree is sorted by size
        }

        //append remaining canaryCh to baseCh
        for (let index = canaryIndex; index < canaryLen; index++) {
            if (baseCh === null) {
                baseCh = [];
            }
            baseCh[appendIndex] = canaryCh[index];
            baseCh[appendIndex]['csz'] = canaryCh[index]['sz'];
            baseCh[appendIndex]['bsz'] = 0;
            sortCanaryTreeBySizeWrapper(baseCh[appendIndex]);//make sure sub tree is sorted by size
            index++;
            appendIndex++;
        }

        //sort merged children based on frame count
        if (baseCh != null) {
            baseCh.sort(function (a, b) {
                return b.bsz + b.csz - a.bsz - a.csz
            });
        }
    }

    function sortBaseTreeBySizeWrapper(tree){
        //console.log("sortBaseTreeBySize");
        sortBaseTreeBySize(tree);
    }

    function sortBaseTreeBySize(tree) {
        let ch = tree['ch'];
        if (ch != undefined && ch !== null) {
            for (let index = 0; index < ch.length; index++) {
                ch[index]['csz'] = 0;
                ch[index]['bsz'] = ch[index]['sz'];
                sortBaseTreeBySize(ch[index]);
            }
            ch.sort(function (a, b) {
                return b.bsz + b.csz - a.bsz - a.csz
            });
        }
    }

    function sortCanaryTreeBySizeWrapper(tree) {
        //console.log("sortCanaryTreeBySize");
        sortCanaryTreeBySize(tree);
    }

    function sortCanaryTreeBySize(tree) {
        let ch = tree['ch'];
        if (ch != undefined && ch !== null) {
            for (let index = 0; index < ch.length; index++) {
                ch[index]['csz'] = ch[index]['sz'];
                ch[index]['bsz'] = 0;
                sortCanaryTreeBySize(ch[index]);
            }
            ch.sort(function (a, b) {
                return b.bsz + b.csz - a.bsz - a.csz
            });
        }
    }

/*    // traverses two context trees diffing their size values
    function breadthFirstDiffV1(baseJsonTree, canaryJsonTree, excludeDepth) {
        const defaultNode = {name: "", bsize: 0, csize: 0, children: []};
        if (baseJsonTree === undefined || canaryJsonTree === undefined) {
            return defaultNode;
        }
        if(baseJsonTree['tree'] !== undefined) {
            baseJsonTree = baseJsonTree['tree'];
        }
        if(canaryJsonTree['tree'] !== undefined) {
            canaryJsonTree = canaryJsonTree['tree'];
        }
        // top level diff
        const mergedTree = {
            name: "root",
            bsize: parseInt( baseJsonTree['sz']),
            csize: parseInt(canaryJsonTree['sz']),
            children: []
        };
        const queue = [];

        const alignedChildren = alignNodesV1(baseJsonTree['ch'], canaryJsonTree['ch'], excludeDepth);

        // populate queue with root level
        addChildrenToQueueV1(queue, alignedChildren, mergedTree);

        // diff tuples in queue and add children
        while (queue.length !== 0) {
            const diffNode = {name: "", bsize: 0, csize: 0, children: []};
            const treeNodes = queue.shift();

            diffNode.name = (treeNodes[0].nm === "") ? treeNodes[1].nm : treeNodes[0].nm;
            diffNode.bsize = treeNodes[0].sz;
            diffNode.csize = treeNodes[1].sz;

            treeNodes[2].children.push(diffNode);

            const alignedChildren = alignNodesV1(treeNodes[0].ch, treeNodes[1].ch, 0);
            addChildrenToQueueV1(queue, alignedChildren, diffNode);
        }
        return mergedTree;
    }

    // gets the child elements from the master and branch trees and attaches each pair to the queue
    // along with the level of the tree they will be added
    function addChildrenToQueueV1(queue, alignedChildren, currentLevel) {
        if (alignedChildren === undefined) {
            return;
        }
        for (let treeIndex = 0; treeIndex < alignedChildren.length; treeIndex++) {
            queue.push([alignedChildren[treeIndex][0], alignedChildren[treeIndex][1], currentLevel]);
        }
    }

    // if both base and canary trees have matching thread names line them up
    function alignNodesV1(bTreeNode, cTreeNode, excludeDepth) {
        const existsInBoth = [];
        const alignedNodes = [];
        const defaultNode = {nm: "", sz: 0, ch: []};
        if (bTreeNode != null) {
            for (const mChild of bTreeNode) {
                if (cTreeNode != null) {
                    for (const bChild of cTreeNode) {
                        if((mChild.sz + bChild.sz) > excludeDepth) {
                            if (mChild.nm === bChild.nm) {
                                existsInBoth.push(mChild.nm);
                                alignedNodes.push([mChild, bChild]);
                            }
                        }
                    }
                }
            }
        }
        if (bTreeNode != null) {
            for (const mChild of bTreeNode) {
                if(mChild.sz > excludeDepth) {
                    if (!existsInBoth.includes(mChild.nm)) {
                        alignedNodes.push([mChild, defaultNode])
                    }
                }
            }
        }
        if (cTreeNode != null) {
            for (const bChild of cTreeNode) {
                if(bChild.sz > excludeDepth) {
                    if (!existsInBoth.includes(bChild.nm)) {
                        alignedNodes.push([defaultNode, bChild])
                    }
                }
            }
        }
        alignedNodes.sort(function (a, b) {
            return b[0].sz + b[1].sz - a[0].sz - a[1].sz
        });
        return alignedNodes;
    }
    */

    //jfr context end

    //Request context table crash  fix START

    let tableRows = [];
    let tableHeader = [];

    const sfContextDataTable = new SFDataTable("sfContextDataTable");
    Object.freeze(sfContextDataTable);

    let tidIndex = {};
    let tmpColorMap = new Map();

    function genRequestTable() {
        console.log("genRequestTable start");

        setToolBarOptions("statetabledrp");

        let start1 = performance.now();

        if(otherEvent !== customEvent){
            genOtherTable();
            return;
        }

        if (customEvent == "" || customEvent == undefined) {
            return;
        }

        //status graph start
        let downScale = 200;
        let maxEndTimeOfReq = 0;
        let totalRows = 0;
        let rowHeight = 8;
        let filteredTidRequests = {};
        let lineCount = 0;
        if (tableFormat == 2 || tableFormat == 3) {
            tidIndex = {};
        }
        let tmpTidSortByMetricMap = new Map();
        let tmpGgroupByTypeSortByMetricMap = new Map();
        let groupByCount = 0;
        let groupByCountSum = 0;
        //status graph end

        let metricSumMap = {};
        let tidDatalistVal = filterMap["tid"];

        let event = getEventType();
        let isJstack = false;
        if(event == "Jstack" || event == "json-jstack"){
            isJstack = true;
        }

        let dimIndexMap = {};
        let metricsIndexMap = {};
        let metricsIndexArray = [];
        let isDimIndexMap = {};
        let groupByIndex = -1;
        let sortByIndex = -1;
        let spanIndex = -1;
        let timestampIndex = -1;
        let tidRowIndex = -1;
        let isContextViewFiltered = true;


        let sortByFound = false;
        let groupByFound = false;

        for (let val in contextData.header[customEvent]) {
            const tokens = contextData.header[customEvent][val].split(":");
            if (tokens[1] == "number") {
                metricsIndexArray.push(val);
                metricsIndexMap[tokens[0]] = val;
            }
            if (groupBy == tokens[0]) {
                groupByIndex = val;
                groupByFound = true;
            }
            if (sortBy == tokens[0]) {
                sortByFound = true;
                sortByIndex = val;
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
                isDimIndexMap[val]=tokens[0];
            }
        }

        if (!groupByFound) {
            //groupBy = "tid";
            //groupByIndex=tidRowIndex;
        }
        if (!sortByFound) {
            //sortBy = "duration";
            //sortByIndex = spanIndex;
        }

        addContextHints();

        let contextStart = getContextTree(1).context.start;
        let contextTidMap = getContextTree(1).context.tidMap;
        let contextDataRecords = undefined;
        if (contextData != undefined && contextData.records != undefined) {
            contextDataRecords = contextData.records[customEvent];
        }

        let rowIndex = -1;
        tableHeader = [];
        tableRows = [];
        getContextTableHeadernew(groupBy, tableHeader, customEvent);

        let table = "<table   style=\"border:none;padding=0px;width: 100%;\" id=\"state-table\" class=\"table compact table-striped table-bordered  table-hover dataTable\">" + getEventTableHeader(groupBy);

        if((!isFilterEmpty(dimIndexMap) || frameFilterString !== "") && spanIndex == -1 ){
            isContextViewFiltered = false;//record do not have duration span to apply context filters
        }
        //if only frame filter is selected then we need to include stacks that are not part of any request spans.
        if (frameFilterString !== "" && tidDatalistVal == undefined && isFilterEmpty(dimIndexMap)) {
            for (var tid in contextTidMap) {
                if (isJstack  ) {
                    for (let index = 0; index < contextTidMap[tid].length; index++) {
                        if ((pStart === '' || pEnd === '') || (contextTidMap[tid][index].time + contextStart) >= pStart && (contextTidMap[tid][index].time + contextStart) <= pEnd) { // apply time range filter
                            if (frameFilterStackMap[event][contextTidMap[tid][index].hash] !== undefined) {
                                if (filteredStackMap[FilterLevel.LEVEL3][tid] == undefined) {
                                    filteredStackMap[FilterLevel.LEVEL3][tid] = [];
                                }
                                filteredStackMap[FilterLevel.LEVEL3][tid].push(contextTidMap[tid][index]);
                            }
                        }
                    }
                }
                //generate context table data, need to include requests that has frame filter found stacks
                if (contextDataRecords[tid] != undefined) {
                    let includeTid = false;
                    let reqArray = [];
                    let recordIndex = -1;
                    contextDataRecords[tid].forEach(function (obj) {
                        let record = obj.record;
                        let flag = false;
                        recordIndex++;
                        let recordSpan = record[spanIndex] == undefined ? 0 : record[spanIndex];
                        if (filterMatch(record, dimIndexMap, timestampIndex, recordSpan)) {
                            if(record[spanIndex] == undefined){
                                flag = true; //include all records when 'duration' span is not available. context view cannot be filtered
                            }else {
                                let end = record[timestampIndex] - contextStart + recordSpan;
                                let start = record[timestampIndex] - contextStart;
                                try {
                                    //do a binary search
                                    let entryIndex = isinRequest(contextTidMap[tid], start, end);
                                    if (entryIndex != -1) {
                                        let requestArr = contextTidMap[tid];
                                        flag = isRequestHasFrame(requestArr, entryIndex, event, start, end, false);
                                    }
                                } catch (err) {
                                    //console.log("tid not found in JFR" + tid.key + " " + err.message);
                                }
                            }
                        }

                        if (flag) {
                            if ((tableFormat == 2 || tableFormat == 3)) {
                                includeTid = true;
                                reqArray.push(recordIndex);
                                if ((recordSpan + record[timestampIndex]) > maxEndTimeOfReq) {
                                    maxEndTimeOfReq = recordSpan + record[timestampIndex];
                                }
                                let key = (groupByIndex != -1 && record[groupByIndex] != undefined && record[groupByIndex].slice != undefined) ? record[groupByIndex].slice(0, groupByLength) : record[groupByIndex];
                                if (!tmpColorMap.has(key)) {
                                    tmpColorMap.set(key, randomColor());
                                    groupByCount++;
                                }
                                let metricValue = record[metricsIndexMap[sortBy]];
                                if (metricValue != undefined) {
                                    groupByCountSum += metricValue;
                                } else {
                                    metricValue = 0;
                                }
                                if (tmpGgroupByTypeSortByMetricMap.has(key)) {
                                    tmpGgroupByTypeSortByMetricMap.set(key, tmpGgroupByTypeSortByMetricMap.get(key) + metricValue);
                                } else {
                                    tmpGgroupByTypeSortByMetricMap.set(key, metricValue);
                                }

                                if (tmpTidSortByMetricMap.has(tid)) {
                                    tmpTidSortByMetricMap.set(tid, tmpTidSortByMetricMap.get(tid) + metricValue);
                                } else {
                                    tmpTidSortByMetricMap.set(tid, metricValue);
                                }
                            }
                            if (groupBy == "" || groupBy == undefined || groupBy == "All records") {
                                if (record[metricsIndexMap[tableThreshold]] >= spanThreshold) {//todo change names tableThreshold to recordInput, spanThreshold to recordThreshold
                                    rowIndex++;
                                    tableRows[rowIndex] = [];
                                    for (let field in record) {
                                        if (field == timestampIndex) {
                                            sfContextDataTable.addContextTableRow(tableRows[rowIndex],moment.utc(record[field]).format('YYYY-MM-DD HH:mm:ss SSS'),"id='"+record[tidRowIndex] + "_" + record[field]+"'");
                                        } else if(field == tidRowIndex) {
                                            sfContextDataTable.addContextTableRow(tableRows[rowIndex],Number(record[field]),"' hint='tid'");
                                        }else {
                                            if(isDimIndexMap[field] == undefined) {
                                                sfContextDataTable.addContextTableRow(tableRows[rowIndex],record[field]);
                                            }else{
                                                sfContextDataTable.addContextTableRow(tableRows[rowIndex],record[field],"' hint='"+isDimIndexMap[field]+"'");
                                            }
                                        }
                                    }
                                }
                            } else {
                                let key = (groupByIndex != -1 && record[groupByIndex] != undefined && record[groupByIndex].slice != undefined) ? record[groupByIndex].slice(0, groupByLength) : record[groupByIndex];

                                if (metricSumMap[key] == undefined) {
                                    metricSumMap[key] = Array(metricsIndexArray.length + 1).fill(0);
                                }

                                for (let i = 0; i < metricsIndexArray.length; i++) {
                                    metricSumMap[key][i] += record[metricsIndexArray[i]];
                                }
                                metricSumMap[key][metricsIndexArray.length] += 1;
                            }
                        }
                    });
                    if (includeTid) {
                        filteredTidRequests[tid] = reqArray;
                        lineCount++;
                        totalRows++;
                    }
                }
            }
        } else {
            for (var tid in contextDataRecords) {
                let includeTid = false;
                let reqArray = [];
                let recordIndex = -1;
                if (tidDatalistVal == undefined || tidDatalistVal == tid) {
                    contextDataRecords[tid].forEach(function (obj) {
                        let record = obj.record;
                        let flag = false;
                        recordIndex++;
                        let recordSpan = record[spanIndex] == undefined ? 0 : record[spanIndex];
                        if (filterMatch(record, dimIndexMap, timestampIndex, recordSpan)) {
                            if (record[spanIndex] == undefined) {
                                flag = true; //include all records when 'duration' span is not available. context view cannot be filtered
                            } else {
                                //context filter matched, but check if samples of request is matching frame filter
                                if (frameFilterString !== "") {
                                    flag = false;

                                    //check if the request has a stack and if stack is in frameFilterStackMap
                                    let end = record[timestampIndex] - contextStart + recordSpan;
                                    let start = record[timestampIndex] - contextStart;

                                    try {
                                        //do a binary search
                                        let entryIndex = isinRequest(contextTidMap[tid], start, end);
                                        if (entryIndex != -1) {
                                            let requestArr = contextTidMap[tid];
                                            flag = isRequestHasFrame(requestArr, entryIndex, event, start, end, false);
                                        }
                                    } catch (err) {
                                        //console.log("tid not found in JFR" + tid + " " + err.message);
                                    }
                                }else{
                                    flag = true;
                                }
                            }
                        }

                        if (flag) {
                            if ((tableFormat == 2 || tableFormat == 3)) {
                                includeTid = true;
                                reqArray.push(recordIndex);
                                if ((recordSpan + record[timestampIndex]) > maxEndTimeOfReq) {
                                    maxEndTimeOfReq = recordSpan + record[timestampIndex];
                                }
                                let key = (groupByIndex != -1 &&   record[groupByIndex] != undefined &&record[groupByIndex].slice != undefined) ? record[groupByIndex].slice(0, groupByLength) : record[groupByIndex];
                                if (!tmpColorMap.has(key)) {
                                    tmpColorMap.set(key, randomColor());
                                    groupByCount++;
                                }
                                let metricValue = record[metricsIndexMap[sortBy]];
                                if (metricValue != undefined) {
                                    groupByCountSum += metricValue;
                                } else {
                                    metricValue = 0;
                                }
                                if (tmpGgroupByTypeSortByMetricMap.has(key)) {
                                    tmpGgroupByTypeSortByMetricMap.set(key, tmpGgroupByTypeSortByMetricMap.get(key) + metricValue);
                                } else {
                                    tmpGgroupByTypeSortByMetricMap.set(key, metricValue);
                                }

                                if (tmpTidSortByMetricMap.has(tid)) {
                                    tmpTidSortByMetricMap.set(tid, tmpTidSortByMetricMap.get(tid) + metricValue);
                                } else {
                                    tmpTidSortByMetricMap.set(tid, metricValue);
                                }
                            }
                            if (groupBy == "" || groupBy == undefined || groupBy == "All records") {
                                if (record[metricsIndexMap[tableThreshold]] >= spanThreshold) {
                                    rowIndex++;
                                    tableRows[rowIndex] = [];
                                    for (let field in record) {
                                        if (field == timestampIndex) {
                                            sfContextDataTable.addContextTableRow(tableRows[rowIndex],moment.utc(record[field]).format('YYYY-MM-DD HH:mm:ss SSS'),"id='"+record[tidRowIndex] + "_" + record[field]+"'");
                                        } else if(field == tidRowIndex) {
                                            sfContextDataTable.addContextTableRow(tableRows[rowIndex],Number(record[field]),"' hint='tid'");
                                        }else {
                                            if(isDimIndexMap[field] == undefined) {
                                                sfContextDataTable.addContextTableRow(tableRows[rowIndex],record[field]);
                                            }else{
                                                sfContextDataTable.addContextTableRow(tableRows[rowIndex],record[field],"' hint='"+isDimIndexMap[field]+"'");
                                            }
                                        }
                                    }
                                }
                            } else {
                                let key = (groupByIndex != -1 &&  record[groupByIndex] != undefined && record[groupByIndex].slice != undefined) ? record[groupByIndex].slice(0, groupByLength) : record[groupByIndex];
                                if (metricSumMap[key] == undefined) {
                                    metricSumMap[key] = Array(metricsIndexArray.length + 1).fill(0);
                                }

                                for (let i = 0; i < metricsIndexArray.length; i++) {
                                    metricSumMap[key][i] += record[metricsIndexArray[i]];
                                }
                                metricSumMap[key][metricsIndexArray.length] += 1;
                            }
                        }
                    });
                    if (includeTid) {
                        filteredTidRequests[tid] = reqArray;
                        lineCount++;
                        totalRows++;
                    }
                }
            }
        }
        let end1 = performance.now();
        console.log("genRequestTable 0 time:" + (end1 - start1))
        let start = performance.now();
        let order = getOrderandType();
        if (tableFormat == 2 || tableFormat == 3) {
            let minStart = getContextTree(1, getEventType()).context.start; //todo: records are aligned to method profile context start
            if(getEventType() == "json-jstack" || getEventType() == "Jstack"){//find other profile start time
                for (var profile in jfrprofiles1) {
                    if(profile !== "json-jstack" && profile !== "Jstack") {
                        minStart = getContextTree(1, profile).context.start;
                        break;
                    }
                }
            }
            let chartWidth = maxEndTimeOfReq - minStart;
            if (chartWidth < 600000) {//min 10 min
                chartWidth = 600000;
            }
            chartWidth = chartWidth / downScale;
            const tidSortByMetricMap = new Map([...tmpTidSortByMetricMap.entries()].sort((a, b) => b[1] - a[1]));
            const groupByTypeSortByMetricMap = new Map([...tmpGgroupByTypeSortByMetricMap.entries()].sort((a, b) => b[1] - a[1]));
            //generate tidIndex for Yaxis
            let index = 0;
            for (let [tid, value] of tidSortByMetricMap) {
                tidIndex[index] = tid;
                index++;
            }
            if (tableFormat == 2) {
                let end2 = performance.now();
                console.log("genRequestTable 2:" + (end2 - start1));
                drowStateChart(filteredTidRequests, chartWidth, downScale, minStart, totalRows * rowHeight, tidSortByMetricMap, groupByCountSum, timestampIndex, spanIndex, groupByIndex, sortByIndex, tidRowIndex, isContextViewFiltered, customEvent, groupByTypeSortByMetricMap);
                let end3 = performance.now();
                console.log("genRequestTable 3:" + (end3 - start1));
                addLegend("#legendid", groupByTypeSortByMetricMap, groupByCount, groupByCountSum);
                addYAxis("#yaxisid", 0, 0, 0, 17, 0, lineCount, 500, totalRows * rowHeight);
                addXAxis("#xaxisid", 15, 0, 0, 0, 0, chartWidth, chartWidth, 50, minStart, downScale);
                let end4 = performance.now();
                console.log("genRequestTable 4:" + (end4 - start1));
            } else {
                drawTimelineChart(filteredTidRequests, minStart, tidSortByMetricMap, groupByTypeSortByMetricMap, groupByCountSum, timestampIndex, spanIndex, groupByIndex, sortByIndex, isContextViewFiltered, customEvent);
            }
        } else {
            if (!(groupBy == "" || groupBy == undefined || groupBy == "All records")) {
                for (let dim in metricSumMap) {
                    rowIndex++;
                    tableRows[rowIndex] = [];
                    if(groupBy == "tid"){
                        sfContextDataTable.addContextTableRow(tableRows[rowIndex],(dim == undefined ? "NA" : Number(dim)),"hint='"+groupBy+"'");
                    }else {
                        sfContextDataTable.addContextTableRow(tableRows[rowIndex],(dim == undefined ? "NA" : dim),"hint='"+groupBy+"'");
                    }
                    for (let i = 0; i < metricSumMap[dim].length; i++) {
                        sfContextDataTable.addContextTableRow(tableRows[rowIndex],Math.round(metricSumMap[dim][i] * 100) / 100);
                    }
                }
            }
            sfContextDataTable.SFDataTable(tableRows, tableHeader, "statetable", order);
            if(!isContextViewFiltered) {
                $('#statetable').append("<div id='timeLineChartNote' class='col-lg-12' style='padding: 0 !important;'>"+getContextHintNote(false)+"</div>");
            }
        }

        //setToolBarOptions("statetabledrp");

        /*$("#event-input").on("change", (event) => {
            updateUrl("customevent", $("#event-input").val(), true);
            customEvent = $("#event-input").val();
            tmpColorMap.clear();
            setToolBarOptions("statetabledrp");
            genRequestTable();
            updateRequestView();
        });*/

        $("#filter-input").on("change", (event) => {
            updateUrl("groupBy", $("#filter-input").val(), true);
            groupBy = $("#filter-input").val();
            tmpColorMap.clear();
            genRequestTable();
            updateRequestView();
        });
        $("#format-input").on("change", (event) => {
            updateUrl("tableFormat", $("#format-input").val(), true);
            tableFormat = $("#format-input").val();
            genRequestTable();
            updateRequestView();
        });
        $("#sort-input").on("change", (event) => {
            updateUrl("sortBy", $("#sort-input").val(), true);
            sortBy = $("#sort-input").val();
            genRequestTable();
            updateRequestView();
        });
        $("#line-type").on("change", (event) => {
            updateUrl("cumulative", $("#line-type").val(), true);
            cumulativeLine = $("#line-type").val();
            genRequestTable();
            updateRequestView();
        });
        $("#line-count").on("change", (event) => {
            updateUrl("seriesCount", $("#line-count").val(), true);
            seriesCount = $("#line-count").val();
            genRequestTable();
            updateRequestView();
        });
        $("#groupby-match").on("change", (event) => {
            updateUrl("groupByMatch", $("#groupby-match").val(), true);
            groupByMatch = $("#groupby-match").val();
            genRequestTable();
            updateRequestView();
        });
        $("#groupby-length").on("change", (event) => {
            updateUrl("groupByLength", $("#groupby-length").val(), true);
            groupByLength = $("#groupby-length").val();
            genRequestTable();
            updateRequestView();
        });

        $("#table-threshold").on("change", (event) => {
            updateUrl("tableThreshold", $("#table-threshold").val(), true);
            tableThreshold = $("#table-threshold").val();
            genRequestTable();
            updateRequestView();
        });
        $("#span-threshold").on("change", (event) => {
            updateUrl("spanThreshold", $("#span-threshold").val(), true);
            spanThreshold = $("#span-threshold").val();
            genRequestTable();
            updateRequestView();
        });
        $("#cct-panel").css("height", "100%");


        let end = performance.now();
        console.log("genRequestTable end time:" + (end - start1));
    }

    function genOtherTable() {
        console.log("genOtherTable start");

        let start1 = performance.now();

        if (otherEvent == "" || otherEvent == undefined) {
            return;
        }

        //status graph start
        let downScale = 200;
        let maxEndTimeOfReq = 0;
        let totalRows = 0;
        let rowHeight = 8;
        let filteredTidRequests = {};
        let lineCount = 0;
        if (tableFormat == 2 || tableFormat == 3) {
            tidIndex = {};
        }
        let tmpTidSortByMetricMap = new Map();
        let tmpGgroupByTypeSortByMetricMap = new Map();
        let groupByCount = 0;
        let groupByCountSum = 0;
        //status graph end

        let metricSumMap = {};
        let tidDatalistVal = filterMap["tid"];

        let event = getEventType();
        let isJstack = false;
        if(event == "Jstack" || event == "json-jstack"){
            isJstack = true;
        }

        let dimIndexMap = {};
        let metricsIndexMap = {};
        let metricsIndexArray = [];
        let isDimIndexMap = {};
        let groupByIndex = -1;
        let sortByIndex = -1;
        let spanIndex = -1;
        let timestampIndex = -1;
        let tidRowIndex = -1;
        let isContextViewFiltered = false;


        let sortByFound = false;
        let groupByFound = false;

        for (let val in contextData.header[otherEvent]) {
            const tokens = contextData.header[otherEvent][val].split(":");
            if (tokens[1] == "number") {
                metricsIndexArray.push(val);
                metricsIndexMap[tokens[0]] = val;
            }
            if (groupBy == tokens[0]) {
                groupByIndex = val;
                groupByFound = true;
            }
            if (sortBy == tokens[0]) {
                sortByFound = true;
                sortByIndex = val;
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
                isDimIndexMap[val]=tokens[0];
            }
        }

        if (!groupByFound) {
            //groupBy = "tid";
            //groupByIndex=tidRowIndex;
        }
        if (!sortByFound) {
            //sortBy = "duration";
            //sortByIndex = spanIndex;
        }

        //addContextHints();

        let contextStart = getContextTree(1).context.start;
        let contextTidMap = getContextTree(1).context.tidMap;
        let contextDataRecords = undefined;
        if (contextData != undefined && contextData.records != undefined) {
            contextDataRecords = contextData.records[otherEvent];
        }

        let rowIndex = -1;
        tableHeader = [];
        tableRows = [];
        getContextTableHeadernew(groupBy, tableHeader, otherEvent);

        let table = "<table   style=\"border:none;padding=0px;width: 100%;\" id=\"state-table\" class=\"table compact table-striped table-bordered  table-hover dataTable\">" + getEventTableHeader(groupBy);

        if((!isFilterEmpty(dimIndexMap) || frameFilterString !== "") && spanIndex == -1 ){
            isContextViewFiltered = false;//record do not have duration span to apply context filters
        }
        //if only frame filter is selected then we need to include stacks that are not part of any request spans.
        if (frameFilterString !== "" && tidDatalistVal == undefined && isFilterEmpty(dimIndexMap)) {
            for (var tid in contextTidMap) {
                //generate context table data, need to include requests that has frame filter found stacks
                if (contextDataRecords[tid] != undefined) {
                    let includeTid = false;
                    let reqArray = [];
                    let recordIndex = -1;
                    contextDataRecords[tid].forEach(function (obj) {
                        let record = obj.record;
                        let flag = false;
                        recordIndex++;
                        let recordSpan = record[spanIndex] == undefined ? 0 : record[spanIndex];
                        if (filterMatch(record, dimIndexMap, timestampIndex, recordSpan)) {
                            if(record[spanIndex] == undefined){
                                flag = true; //include all records when 'duration' span is not available. context view cannot be filtered
                            }else {
                                let end = record[timestampIndex] - contextStart + recordSpan;
                                let start = record[timestampIndex] - contextStart;
                                try {
                                    //do a binary search
                                    let entryIndex = isinRequest(contextTidMap[tid], start, end);
                                    if (entryIndex != -1) {
                                        let requestArr = contextTidMap[tid];
                                        flag = isRequestHasFrame(requestArr, entryIndex, event, start, end, false);
                                    }
                                } catch (err) {
                                    //console.log("tid not found in JFR" + tid.key + " " + err.message);
                                }
                            }
                        }

                        if (flag) {
                            if ((tableFormat == 2 || tableFormat == 3)) {
                                includeTid = true;
                                reqArray.push(recordIndex);
                                if ((recordSpan + record[timestampIndex]) > maxEndTimeOfReq) {
                                    maxEndTimeOfReq = recordSpan + record[timestampIndex];
                                }
                                let key = (groupByIndex != -1 && record[groupByIndex] != undefined && record[groupByIndex].slice != undefined) ? record[groupByIndex].slice(0, groupByLength) : record[groupByIndex];
                                if (!tmpColorMap.has(key)) {
                                    tmpColorMap.set(key, randomColor());
                                    groupByCount++;
                                }
                                let metricValue = record[metricsIndexMap[sortBy]];
                                if (metricValue != undefined) {
                                    groupByCountSum += metricValue;
                                } else {
                                    metricValue = 0;
                                }
                                if (tmpGgroupByTypeSortByMetricMap.has(key)) {
                                    tmpGgroupByTypeSortByMetricMap.set(key, tmpGgroupByTypeSortByMetricMap.get(key) + metricValue);
                                } else {
                                    tmpGgroupByTypeSortByMetricMap.set(key, metricValue);
                                }

                                if (tmpTidSortByMetricMap.has(tid)) {
                                    tmpTidSortByMetricMap.set(tid, tmpTidSortByMetricMap.get(tid) + metricValue);
                                } else {
                                    tmpTidSortByMetricMap.set(tid, metricValue);
                                }
                            }
                            if (groupBy == "" || groupBy == undefined || groupBy == "All records") {
                                if (record[metricsIndexMap[tableThreshold]] >= spanThreshold) {//todo change names tableThreshold to recordInput, spanThreshold to recordThreshold
                                    rowIndex++;
                                    tableRows[rowIndex] = [];
                                    for (let field in record) {
                                        if (field == timestampIndex) {
                                            sfContextDataTable.addContextTableRow(tableRows[rowIndex],moment.utc(record[field]).format('YYYY-MM-DD HH:mm:ss SSS'),"id='"+record[tidRowIndex] + "_" + record[field]+"'");
                                        } else if(field == tidRowIndex) {
                                            sfContextDataTable.addContextTableRow(tableRows[rowIndex],Number(record[field]),"' hint='tid'");
                                        }else {
                                            if(isDimIndexMap[field] == undefined) {
                                                sfContextDataTable.addContextTableRow(tableRows[rowIndex],record[field]);
                                            }else{
                                                sfContextDataTable.addContextTableRow(tableRows[rowIndex],record[field],"' hint='"+isDimIndexMap[field]+"'");
                                            }
                                        }
                                    }
                                }
                            } else {
                                let key = (groupByIndex != -1 && record[groupByIndex] != undefined && record[groupByIndex].slice != undefined) ? record[groupByIndex].slice(0, groupByLength) : record[groupByIndex];

                                if (metricSumMap[key] == undefined) {
                                    metricSumMap[key] = Array(metricsIndexArray.length + 1).fill(0);
                                }

                                for (let i = 0; i < metricsIndexArray.length; i++) {
                                    metricSumMap[key][i] += record[metricsIndexArray[i]];
                                }
                                metricSumMap[key][metricsIndexArray.length] += 1;
                            }
                        }
                    });
                    if (includeTid) {
                        filteredTidRequests[tid] = reqArray;
                        lineCount++;
                        totalRows++;
                    }
                }
            }
        } else {
            for (var tid in contextDataRecords) {
                let includeTid = false;
                let reqArray = [];
                let recordIndex = -1;
                if (tidDatalistVal == undefined || tidDatalistVal == tid) {
                    contextDataRecords[tid].forEach(function (obj) {
                        let record = obj.record;
                        let flag = false;
                        recordIndex++;
                        let recordSpan = record[spanIndex] == undefined ? 0 : record[spanIndex];
                        if (filterMatch(record, dimIndexMap, timestampIndex, recordSpan)) {
                            if (record[spanIndex] == undefined) {
                                flag = true; //include all records when 'duration' span is not available. context view cannot be filtered
                            } else {
                                //context filter matched, but check if samples of request is matching frame filter
                                if (frameFilterString !== "") {
                                    flag = false;

                                    //check if the request has a stack and if stack is in frameFilterStackMap
                                    let end = record[timestampIndex] - contextStart + recordSpan;
                                    let start = record[timestampIndex] - contextStart;

                                    try {
                                        //do a binary search
                                        let entryIndex = isinRequest(contextTidMap[tid], start, end);
                                        if (entryIndex != -1) {
                                            let requestArr = contextTidMap[tid];
                                            flag = isRequestHasFrame(requestArr, entryIndex, event, start, end, false);
                                        }
                                    } catch (err) {
                                        //console.log("tid not found in JFR" + tid + " " + err.message);
                                    }
                                }else{
                                    flag = true;
                                }
                            }
                        }

                        if (flag) {
                            if ((tableFormat == 2 || tableFormat == 3)) {
                                includeTid = true;
                                reqArray.push(recordIndex);
                                if ((recordSpan + record[timestampIndex]) > maxEndTimeOfReq) {
                                    maxEndTimeOfReq = recordSpan + record[timestampIndex];
                                }
                                let key = (groupByIndex != -1 &&   record[groupByIndex] != undefined &&record[groupByIndex].slice != undefined) ? record[groupByIndex].slice(0, groupByLength) : record[groupByIndex];
                                if (!tmpColorMap.has(key)) {
                                    tmpColorMap.set(key, randomColor());
                                    groupByCount++;
                                }
                                let metricValue = record[metricsIndexMap[sortBy]];
                                if (metricValue != undefined) {
                                    groupByCountSum += metricValue;
                                } else {
                                    metricValue = 0;
                                }
                                if (tmpGgroupByTypeSortByMetricMap.has(key)) {
                                    tmpGgroupByTypeSortByMetricMap.set(key, tmpGgroupByTypeSortByMetricMap.get(key) + metricValue);
                                } else {
                                    tmpGgroupByTypeSortByMetricMap.set(key, metricValue);
                                }

                                if (tmpTidSortByMetricMap.has(tid)) {
                                    tmpTidSortByMetricMap.set(tid, tmpTidSortByMetricMap.get(tid) + metricValue);
                                } else {
                                    tmpTidSortByMetricMap.set(tid, metricValue);
                                }
                            }
                            if (groupBy == "" || groupBy == undefined || groupBy == "All records") {
                                if (record[metricsIndexMap[tableThreshold]] >= spanThreshold) {
                                    rowIndex++;
                                    tableRows[rowIndex] = [];
                                    for (let field in record) {
                                        if (field == timestampIndex) {
                                            sfContextDataTable.addContextTableRow(tableRows[rowIndex],moment.utc(record[field]).format('YYYY-MM-DD HH:mm:ss SSS'),"id='"+record[tidRowIndex] + "_" + record[field]+"'");
                                        } else if(field == tidRowIndex) {
                                            sfContextDataTable.addContextTableRow(tableRows[rowIndex],Number(record[field]),"' hint='tid'");
                                        }else {
                                            if(isDimIndexMap[field] == undefined) {
                                                sfContextDataTable.addContextTableRow(tableRows[rowIndex],record[field]);
                                            }else{
                                                sfContextDataTable.addContextTableRow(tableRows[rowIndex],record[field],"' hint='"+isDimIndexMap[field]+"'");
                                            }
                                        }
                                    }
                                }
                            } else {
                                let key = (groupByIndex != -1 &&  record[groupByIndex] != undefined && record[groupByIndex].slice != undefined) ? record[groupByIndex].slice(0, groupByLength) : record[groupByIndex];
                                if (metricSumMap[key] == undefined) {
                                    metricSumMap[key] = Array(metricsIndexArray.length + 1).fill(0);
                                }

                                for (let i = 0; i < metricsIndexArray.length; i++) {
                                    metricSumMap[key][i] += record[metricsIndexArray[i]];
                                }
                                metricSumMap[key][metricsIndexArray.length] += 1;
                            }
                        }
                    });
                    if (includeTid) {
                        filteredTidRequests[tid] = reqArray;
                        lineCount++;
                        totalRows++;
                    }
                }
            }
        }
        let end1 = performance.now();
        console.log("genRequestTable 0 time:" + (end1 - start1))
        let start = performance.now();
        let order = getOrderandType();
        if (tableFormat == 2 || tableFormat == 3) {
            let minStart = getContextTree(1, getEventType()).context.start; //records are aligned to method profile context start
            let chartWidth = maxEndTimeOfReq - minStart;
            if (chartWidth < 600000) {//min 10 min
                chartWidth = 600000;
            }
            chartWidth = chartWidth / downScale;
            const tidSortByMetricMap = new Map([...tmpTidSortByMetricMap.entries()].sort((a, b) => b[1] - a[1]));
            const groupByTypeSortByMetricMap = new Map([...tmpGgroupByTypeSortByMetricMap.entries()].sort((a, b) => b[1] - a[1]));
            //generate tidIndex for Yaxis
            let index = 0;
            for (let [tid, value] of tidSortByMetricMap) {
                tidIndex[index] = tid;
                index++;
            }
            if (tableFormat == 2) {
                drowStateChart(filteredTidRequests, chartWidth, downScale, minStart, totalRows * rowHeight, tidSortByMetricMap, groupByCountSum, timestampIndex, spanIndex, groupByIndex, sortByIndex, tidRowIndex, isContextViewFiltered, otherEvent);
                addLegend("#legendid", groupByTypeSortByMetricMap, groupByCount, groupByCountSum);
                addYAxis("#yaxisid", 0, 0, 0, 17, 0, lineCount, 500, totalRows * rowHeight);
                addXAxis("#xaxisid", 15, 0, 0, 0, 0, chartWidth, chartWidth, 50, minStart, downScale);
            } else {
                drawTimelineChart(filteredTidRequests, minStart, tidSortByMetricMap, groupByTypeSortByMetricMap, groupByCountSum, timestampIndex, spanIndex, groupByIndex, sortByIndex, isContextViewFiltered, otherEvent);
            }
        } else {
            if (!(groupBy == "" || groupBy == undefined || groupBy == "All records")) {
                for (let dim in metricSumMap) {
                    rowIndex++;
                    tableRows[rowIndex] = [];
                    if(groupBy == "tid"){
                        sfContextDataTable.addContextTableRow(tableRows[rowIndex],(dim == undefined ? "NA" : Number(dim)),"hint='"+groupBy+"'");
                    }else {
                        sfContextDataTable.addContextTableRow(tableRows[rowIndex],(dim == undefined ? "NA" : dim),"hint='"+groupBy+"'");
                    }
                    for (let i = 0; i < metricSumMap[dim].length; i++) {
                        sfContextDataTable.addContextTableRow(tableRows[rowIndex],Math.round(metricSumMap[dim][i] * 100) / 100);
                    }
                }
            }
            sfContextDataTable.SFDataTable(tableRows, tableHeader, "statetable", order);
            if(!isContextViewFiltered) {
                $('#statetable').append("<div id='timeLineChartNote' class='col-lg-12' style='padding: 0 !important;'>"+getOtherHintNote(false, otherEvent)+"</div>");
            }
        }
        setToolBarOptions("statetabledrp");

        $("#filter-input").on("change", (event) => {
            updateUrl("groupBy", $("#filter-input").val(), true);
            groupBy = $("#filter-input").val();
            tmpColorMap.clear();
            genRequestTable();
            updateRequestView();
        });
        $("#format-input").on("change", (event) => {
            updateUrl("tableFormat", $("#format-input").val(), true);
            tableFormat = $("#format-input").val();
            genRequestTable();
            updateRequestView();
        });
        $("#sort-input").on("change", (event) => {
            updateUrl("sortBy", $("#sort-input").val(), true);
            sortBy = $("#sort-input").val();
            genRequestTable();
            updateRequestView();
        });
        $("#line-type").on("change", (event) => {
            updateUrl("cumulative", $("#line-type").val(), true);
            cumulativeLine = $("#line-type").val();
            genRequestTable();
            updateRequestView();
        });
        $("#line-count").on("change", (event) => {
            updateUrl("seriesCount", $("#line-count").val(), true);
            seriesCount = $("#line-count").val();
            genRequestTable();
            updateRequestView();
        });
        $("#groupby-match").on("change", (event) => {
            updateUrl("groupByMatch", $("#groupby-match").val(), true);
            groupByMatch = $("#groupby-match").val();
            genRequestTable();
            updateRequestView();
        });
        $("#groupby-length").on("change", (event) => {
            updateUrl("groupByLength", $("#groupby-length").val(), true);
            groupByLength = $("#groupby-length").val();
            genRequestTable();
            updateRequestView();
        });

        $("#table-threshold").on("change", (event) => {
            updateUrl("tableThreshold", $("#table-threshold").val(), true);
            tableThreshold = $("#table-threshold").val();
            genRequestTable();
            updateRequestView();
        });
        $("#span-threshold").on("change", (event) => {
            updateUrl("spanThreshold", $("#span-threshold").val(), true);
            spanThreshold = $("#span-threshold").val();
            genRequestTable();
            updateRequestView();
        });
        $("#cct-panel").css("height", "100%");

        let end = performance.now();
        console.log("genRequestTable 1 time:")
    }

    function getContextTableHeadernew(groupBy, row, customEvent) {
        if (!(groupBy == undefined || groupBy == "" || groupBy == "All records")) {
            if(groupBy == "tid") {
                sfContextDataTable.addContextTableHeader(row,groupBy,1,"class='context-menu-two' " , contextData.tooltips[groupBy]);
            }else{
                sfContextDataTable.addContextTableHeader(row,groupBy,-1,"class='context-menu-two'" , contextData.tooltips[groupBy]);
            }
        }
        if (contextData != undefined && contextData.header != undefined) {
            for (let val in contextData.header[customEvent]) {
                const tokens = contextData.header[customEvent][val].split(":");
                if (groupBy == undefined || groupBy == "" || groupBy == "All records" || tokens[1] == "number") {
                    if(tokens[1] == "number") {
                        sfContextDataTable.addContextTableHeader(row,tokens[0],1, undefined, contextData.tooltips[tokens[0]]);
                    }else if(tokens[1] == "timestamp"){
                        sfContextDataTable.addContextTableHeader(row,tokens[0],-1,"class='context-menu-one'");
                    }else if(tokens[0] == "tid"){
                        sfContextDataTable.addContextTableHeader(row,tokens[0],1,"class='context-menu-two'", contextData.tooltips[tokens[0]]);
                    }else{
                        sfContextDataTable.addContextTableHeader(row,tokens[0],-1,"class='context-menu-two'", contextData.tooltips[tokens[0]]);
                    }
                }
            }
        }
        if (!(groupBy == undefined || groupBy == "" || groupBy == "All records")) {
            if(contextData.tooltips["Count"] != undefined) {
                sfContextDataTable.addContextTableHeader(row, "Count", 1, undefined, contextData.tooltips[groupBy]);
            }else{
                sfContextDataTable.addContextTableHeader(row, "Count", 1);
            }
        }
    }

</script>

<div style="padding: 0px" id="contextfilter" class="row">
    <h3 style="width:100%">Context filter</h3>
    <div style="padding-top: 0px;" id="cct-panel" class="col-lg-12">
        <span id="filter-view-status" style="" class="hide"></span>
        <div id="contextpanel" class="hide">
            <div id="contexthints" class="row col-lg-12">
                <table style="border-spacing: 0px; border-collapse: separate;">
                    <tr>
                        <td id="filter-heading">Context hints:</td>
                    </tr>
                </table>
            </div>
            <div id="queryfilter-inp-id" class=" form-group row">
                <div class="col-lg-6">
                    <input type="text" id="queryfilter"
                           class="form-control send-ga"
                           name="queryfilter" title="Query" value=""
                           onkeypress="if(event.keyCode == 13) javascript:applyFilter()"
                    >
                </div>
                <div class="col-lg-2">
                    <select style="text-align: center; " class="form-control send-ga" name="event-input"
                            id="event-input">
                    </select>
                </div>
                <div class="col-lg-2">
                    <button style="cursor: pointer;" id="filter-apply" class="btn btn-block btn-info" type="submit">
                        Apply Filter(s)
                    </button>
                </div>
                <div class="col-lg-2">
                    <button style="cursor: pointer;" id="filter-reset" class="btn btn-block btn-info" type="submit">
                        Reset Filter(s)
                    </button>
                </div>
            </div>

            <hr style="border-top: 1px solid #599BCE"/>

            <div class="row form-group" id="statetablewrapper" class="statetablewrapper col-lg-12">
                <div id="statetabledrp" class="ui-widget statetabledrop col-lg-12">
                </div>

                <div id="statetable" class="ui-widget statetable col-lg-12">
                </div>
            </div>
            <div class="row">
                <div class='popup'><span class='popuptext' id='idPopup'>A Simple Popup!</span></div>
            </div>
            <div id="stackncontextview" style="padding-top: 5px; padding-left: 0px;padding-right: 0px;"
                 class="hide stackncontextview col-lg-12">
                <span id="timelinetitle" style="color: #686A6C;font-family: 'Arial', serif;">Profiling samples collected during request runTime</span>
                <div style="padding-top:0px; padding-left: 0px;padding-right: 0px;" class="col-lg-12">
                    <div style="padding-top: 0px; padding-left: 0px;padding-right: 5px;padding-bottom: 5px;"
                         class="filterpanel col-lg-9">
                        <div style="border-color: #e5e6e7;  border-width: 1px; border-style: solid;padding-top: 3px; padding-left: 5px;padding-right: 5px;"
                             class="stackpanel">
                            <div style="overflow: auto;" class="cct-customized-scrollbar threadstate"
                                 id="threadstate">
                            </div>
                            <div class="hackstak" id="stack">
                            </div>
                        </div>
                    </div>
                    <div class="nopadding col-lg-3">
                        <div style="border-color: #e5e6e7;  border-width: 1px; border-style: solid; padding: 5px;"
                             class="stackcontext" id="stackcontext">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>