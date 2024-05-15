<script>
    /*
* Copyright (c) 2022, Salesforce.com, Inc.
* All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
* For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/
</script>
<style>
    .node rect {
        cursor: pointer;
        stroke: #5d5d5d;
        fill-opacity: 0.5;
        stroke-width: 1px;
    }
    .node text {
        font-size: 10px;
        pointer-events: none;
    }
    path.link {
        fill: none;
        stroke: #9ee1b5;
        stroke-width: 1px;
    }
    .tsviewtable {
        width: 1%;
        table-layout: fixed;
        font-size: 8px;
    }
    .POINTER {
        cursor: pointer;
    }
    .LEGEND {
        display: inline-block;
        width: 10px;
        height: 10px;
    }
    .RUNNABLE {
        background-color: #29b193;
    }
    .TIMED_WAITING {
        background-color: #377bb5;
    }
    .WAITING {
        background-color: #f6ab60;
    }
    .BLOCKED {
        background-color: #ee5869;
    }
    .DB_HOLDING {
        background-color: brown;
    }
    .DB_SAMPLE {
        background-color: yellow;
    }
    td.fixedcol {
        position: absolute;
        left: 0;
        top: auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        width: 70px;
        max-width: 70px;
    }
    td.hiddenfixedcol {
        width: 0px;
        max-width: 0px;
        visibility: hidden;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    td.fixedcol div {
        width: 70px;
        max-width: 70px;
        padding-left: 5px;
    }
    td.hiddenfixedcol div {
        min-width: 70px;
        max-width: 70px;
        padding-left: 5px;
    }
</style>

<div class="row" id="tsview-header">
    <label>Profile: </label>
    <select style="height:30px;text-align: center;" class="filterinput" name="event-type-tsview" id="event-type-tsview">
    </select>
    <div class="col-lg-12" padding="0">
        <table class=" table-striped table-bordered table-hover" padding="0" cellspacing="0" width="100%">
            <row>
                <td style="width:70px;padding-left:5px;">ThreadId</td>
                <td style="padding-left: 15px;">RUNNABLE&nbsp;
                    <div class="RUNNABLE LEGEND"></div>&nbsp;&nbsp;&nbsp;WAITING&nbsp;
                    <div class="WAITING LEGEND"></div>&nbsp;&nbsp;&nbsp;TIMED_WAITING&nbsp;
                    <div class="TIMED_WAITING LEGEND"></div>&nbsp;&nbsp;&nbsp;BLOCKED&nbsp;
                    <div class="BLOCKED LEGEND"></div>&nbsp;&nbsp;&nbsp;DB_HOLDING&nbsp;
                    <div class="DB_HOLDING LEGEND"></div>&nbsp;&nbsp;&nbsp;DB_SAMPLE&nbsp;
                    <div class="DB_SAMPLE LEGEND"></div>
                </td>
            </row>
        </table>
    </div>
</div>
<div id="tsview-note"></div>
<div id="datatable-wrapper-guid" class="row">
    <div class="col-lg-12" >
        <div class="col-lg-12" style="max-height: 1150px; min-height: 10px; overflow-y: auto; border: solid 1px; border-color: #e7e7e7" >
            <div style="overflow-x:auto;  margin-left:55px;">
                <table id="datatable-guid" cellspacing="0" class="tsviewtable table-striped table-bordered table-hover" cellspacing="0" width="100%">
                </table>
            </div>
        </div>
    </div>
</div>

<div class="row">
    <ul id="tsviewpagination" class="pagination" padding="0">
    </ul>
</div>


<script>
    $("#event-type-tsview").on("change", (event) => {
        handleEventTypeChange($("#event-type-tsview").val());
    });

    let jstack = undefined;
    let context = undefined;
    let timestampHeader = "";
    var prevCell = null;
    let timestampArray = [];

    function buildRowHeader(timestampArray, start) {
        // fixedcol and hiddenfixedcol are used to freeze the first column during harizontal scrolling
        let header = "<tr>";
        header += "<td style=\"border: 0px;\" class=\"fixedcol\"><div></div></td>";
        header += "<td style=\"border: 0px;\" class=\"hiddenfixedcol\"><div></div></td>";
        let span = 10;
        for (i = 0; i < timestampArray.length; i+=span) {
            header += "<td colspan=\"" + span + "\" style=\"border: 0px; width:" + span * 5 + "px;\">" + getTime(timestampArray[i]+start) + "</td>"
        }
        header += "</tr>";
        return header;
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


    function  updateProfilerViewTsview(level,skipFilter){
        let eventType = getEventType();

        addTabNote(false,"");

        if(compareTree){
            addTabNote(true,"This view is not supported when Compare option is selected.")
            return;
        }else{
            addTabNote(false,"")
        }

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
                console.log("no change in tree, option:" + (prevCustomEvent === customEvent) +":"+ (currentLoadedTree === treeToProcess)+":"+ (prevOption === currentOption) +" isRefresh:"+(isRefresh === false)+":"+" isLevelRefresh:"+(isLevelRefresh === false)+" selectedLevel:"+ (prevSelectedLevel === selectedLevel));
                end = performance.now();
                console.log("updateProfilerViewTsview 1 time:" + (end - start));
                return;
            }else{
                console.log("change in tree, option:" + (prevCustomEvent === customEvent) +":"+ (currentLoadedTree === treeToProcess)+":"+ (prevOption === currentOption) +" isRefresh:"+(isRefresh === false)+":"+" isLevelRefresh:"+(isLevelRefresh === false)+" selectedLevel:"+ (prevSelectedLevel === selectedLevel));
            }

            currentLoadedTree = treeToProcess;
            prevOption = currentOption;
            prevCustomEvent = customEvent;
            prevSelectedLevel = selectedLevel;
            isLevelRefresh = false;
            threshold = 0;
            isRefresh = false;

            // if no data returned from our call don't try to parse it
            if (treeToProcess === undefined) {
                end = performance.now();
                console.log("updateProfilerViewTsview 2 time:" + (end - start));
                return;
            }

            if(!(eventType == "Jstack" || eventType == "json-jstack")){
                document.getElementById("datatable-guid").innerHTML = "";
                addTabNote(true,"Thread state view supported only for "+getProfileName(eventType))
                return;
            }else{
                addTabNote(false,"")
            }


            var tableInnerHTML = "";

            jstack = getContextTree(1,eventType);
            context = getContextData(1);
            let startMilli = getContextTree(1,eventType).context.start;

            addContextData(eventType, 1);



            let start1 = performance.now();

            timestampHeader = buildRowHeader(timestampArray, startMilli);

            // build header row containing number of colums equal to number of unique timestamps/samples
            tableInnerHTML += timestampHeader;
            let treeToProcesstmp = getActiveTree(eventType, false);
            if(selectedLevel !== FilterLevel.UNDEFINED) {
                console.log("tsview show level:"+selectedLevel +":"+eventType);
                $.each(filteredStackMap[selectedLevel], function (tid, samples) {
                    tableInnerHTML += buildRow(treeToProcesstmp, selectedLevel, tid, samples, timestampArray.length);
                });
            }else{
                console.log("tsview show level:"+selectedLevel +":"+eventType);
                $.each(jstack.context.tidMap, function (tid, samples) {
                    tableInnerHTML += buildRow(treeToProcesstmp, selectedLevel, tid, samples, timestampArray.length);
                });
            }

            document.getElementById("datatable-guid").innerHTML = tableInnerHTML;

            showContextFilter();
            showTimelineView(false);
            let end1 = performance.now();
            console.log("buildRow time:" + (end1 - start1));

            end = performance.now();
            console.log("updateProfilerViewTsview 3 time:" + (end - start));
        }else{
            if(compareTree){
                addTabNote(true,"This view is not supported when Compare option is selected.")
                return;
            }else{
                addTabNote(false,"")
            }

            if(!(eventType == "Jstack" || eventType == "json-jstack")){
                document.getElementById("datatable-guid").innerHTML = "";
                addTabNote(true,"Thread state view supported only for "+getProfileName(eventType))
                return;
            }else{
                addTabNote(false,"")
            }

            let start = performance.now();

            let selectedLevel = getSelectedLevel(getActiveTree(eventType, false));

            var tableInnerHTML = "";
            jstack = getContextTree(1,eventType);
            context = getContextData(1);
            let startMilli = getContextTree(1,eventType).context.start;
            addContextData(eventType, 1);


            let start1 = performance.now();

            timestampHeader = buildRowHeader(timestampArray, startMilli);

            // build header row containing number of colums equal to number of unique timestamps/samples
            tableInnerHTML += timestampHeader;
            let treeToProcesstmp = getActiveTree(eventType, false);
            if(selectedLevel !== FilterLevel.UNDEFINED) {
                console.log("tsview show level:"+selectedLevel +":"+eventType);
                $.each(filteredStackMap[selectedLevel], function (tid, samples) {
                    tableInnerHTML += buildRow(treeToProcesstmp, selectedLevel, tid, samples, timestampArray.length);
                });
            }else{
                console.log("tsview show level:"+selectedLevel +":"+eventType);
                $.each(jstack.context.tidMap, function (tid, samples) {
                    tableInnerHTML += buildRow(treeToProcesstmp, selectedLevel, tid, samples, timestampArray.length);
                });
            }

            document.getElementById("datatable-guid").innerHTML = tableInnerHTML;

            showContextFilter();
            showTimelineView(false);
            let end1 = performance.now();
            console.log("buildRow time:" + (end1 - start1));

            let end = performance.now();
            console.log("updateProfilerViewTsview 4 time:" + (end - start));
        }

    }

    function includeSample(treeToProcess, stackid, level){
        if(level == FilterLevel.UNDEFINED){
            return true;
        }
        if(treeToProcess.sm !== undefined && treeToProcess.sm[stackid] !== undefined
            && treeToProcess.ch !== undefined && treeToProcess.ch[treeToProcess.sm[stackid]].sm[stackid] !== undefined && treeToProcess.ch[treeToProcess.sm[stackid]][level] !== undefined){
            return true;
        }
        return false;
    }

    function buildRow(treeToProcess, level, tid, samples, colCount) {
        let columns = "";
        let row = "";
        var i = 1;
        var threadName = "";
        for (sample in samples) {
            if(includeSample(treeToProcess,samples[sample].hash,level)){
                var threadNameStyle = "";
                threadNameStyle = "background-repeat: no-repeat;background-size: 100% 30%;background-image: linear-gradient(to bottom,"+getColor(samples[sample].context,samples[sample].ts.charAt(0))+");";
                while (i <= colCount && i != samples[sample].sampleNo) {
                    columns += "<td onclick=\"sStack(-1, -1, \'none\',this,\'\',\'\',0);\"></td>";
                    i++;
                }
                // add a black right border if next thread name is different
                if (parseInt(sample) + 1 < samples.length && threadName !== samples[parseInt(sample) + 1].tn) {
                    if (threadName != "") {
                        threadNameStyle += "border-right: solid black 1px;"
                    }
                    threadName = samples[parseInt(sample) + 1].tn;
                }
                let timed = parseInt(samples[sample].time) + jstack.context.start;
                columns += "<td style=\"" + threadNameStyle + "\" title=\"" + getTime(timed) + ", " + samples[sample].tn + "\" onclick=\"sStack("+parseInt(sample)+","+ tid+", \'" + samples[sample].hash + "\',this,\'" + samples[sample].time + "\',\'" + samples[sample].tn + "\',"+level+");\" class=\"POINTER " + samples[sample].ts + "\"></td>";
                i++;
            }
        }

        if(columns != "") {
            while (i <= colCount) {
                columns += "<td onclick=\"sStack(-1,-1,\'none\',this,\'\',\'\',0);\"></td>";
                i++;
            }
            row = "<tr>";
            row += "<td class=\"fixedcol\"><div>" + tid + "</div></td>";
            row += "<td class=\"hiddenfixedcol\"><div>" + tid + "</div></td>";
            row += columns;
            row += "</tr>";
        }
        return row;
    }

    function sStack(index, tid, stackid, cell, time, threadName,level) {
        var date = getTime(time);
        if (stackid === undefined || stackid === null) {
            if (currentstackid === undefined) {
                return;
            }
            stackid = currentstackid;
        }
        if (prevCell != null) {
            prevCell.style.backgroundColor = "";
        }
        if (stackid === 'none') {
            cell.style.backgroundColor = "#ddd";
            setModalHtml(-1, -1, stackid, cell, "", "", "Sample not available", "", "",0);
            prevCell = cell;
            return;
        }

        const style = getComputedStyle(cell);
        cell.style.backgroundColor = "black";
        prevCell = cell;

        currentstackid = stackid;
        let javaStack = "";

        let tmpcontextTree1Level1 = getStackFrameV1("root");
        let tmpActiveTree = getActiveTree(getEventType(), false);//todo need to use eventType argument sStack
        //updateStackIndex(tmpActiveTree);
        let arr = getTreeStack(tmpActiveTree, stackid, tmpcontextTree1Level1, 1);

        let ch = tmpcontextTree1Level1.ch;
        let timed = parseInt(time) + jstack.context.start;
        javaStack +=  moment.utc(timed).format('YYYY-MM-DD HH:mm:ss SSS') + "\n";
        while (ch !== undefined && ch != null && ch.length == 1) {
            javaStack += getFrameName(ch[0].nm) + "\n";
            ch = ch[0].ch;
        }

        $('#stack-view-guid').html(javaStack);

        setModalHtml(index, tid, stackid, cell, javaStack, date, threadName, time, level);
        $('.stack-badge').removeClass("badge-warning");
        $('.stack-' + hashCode(stackid)).addClass("badge-warning");
        updateUrl("stack_guid", stackid, true);

    }

    function getJstackContextTable(tid, time, hash) {
        let dimIndexMap = {};
        let metricsIndexMap = {};
        let metricsIndexArray = [];
        let groupByIndex = -1;
        let spanIndex = -1;
        let timestampIndex = -1;

        let localContextData = getContextData(1);

        for (let val in localContextData.header[customEvent]) {
            const tokens = localContextData.header[customEvent][val].split(":");
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

        let table = "<table style=\"padding: 0px;\" class=\" table-striped\" >";
        let sample = undefined;
        if (jstack.context.tidMap[tid] !== undefined) {
            for (let i = 0; i < jstack.context.tidMap[tid].length; i++) {
                if (jstack.context.tidMap[tid][i].time == time && jstack.context.tidMap[tid][i].hash == hash) {
                    sample = jstack.context.tidMap[tid][i];
                    break;
                }
            }
            if (sample != undefined) {
                table = table + "<tr><td style=\"white-space: nowrap;\">thread_name</td><td  style=\"white-space: nowrap;padding-left: 5px;\">" + sample.tn + "</td></tr>";
                table = table + "<tr><td style=\"white-space: nowrap;\">thread_state</td><td  style=\"white-space: nowrap;padding-left: 5px;\">" + sample.ts + "</td></tr>";
            }
            if(sample[customEvent]?.obj !== undefined){
                table = table + getContextView(sample[customEvent].obj, dimIndexMap, metricsIndexMap);
            }
        }

        table = table + "</table>";
        return table;
    }


    function setModalHtml(index, tid, stackid, cell, javaStack, date, threadName, time, level) {
        var modalHtml = "<div class=\"row\">" +
            "   <div class=\"col-lg-12\" style=\"padding-bottom:5px;\">" +
            "       <div class=\"col-lg-12\" style=\"border: solid 1px; border-color: #ddd; max-height: 1150px; min-height: 10px;\">" +
            "           <div style=\"overflow-x:auto;  margin-left:55px;\">" +
            "               <table id=\"tsview\" class=\"tsviewtable table-striped table-bordered table-hover\"  cellspacing=\"0\">" +
            "                   <tr>" + document.getElementById("datatable-guid").rows[0].innerHTML + "</tr>" +
            "                   <tr>" +
            cell.parentElement.innerHTML +
            "</tr>" +
            "</table>" +
            "</div></div></div></div>" +
            "<div class=\"row\">" +
            "   <div id=\"quick-stack-view\" class=\"col-lg-12\">" +
            "       <a id=\"detail-stack-view-link\" target=\"_blank\"></a>" +
            "           <div style=\"float: right;\">" + date + "&nbsp; <i onClick=\"previousAvailableTsviewStack();\" class=\"POINTER fa fa-toggle-left\"></i>&nbsp;<i onClick=\"nextAvailableTsviewStack();\" class=\"POINTER fa fa-toggle-right\"></i>" +
            "           </div>" +
            "               <label id=\"stack-view-apex-label-guid\" for=\"stack-view-apex-guid\">Context</label>" +
            "               <pre class=\"small\" style=\"max-height: 200px; min-height: 50px; overflow-y: scroll;\" id=\"stack-view-guid\">";


        modalHtml += getJstackContextTable(tid, time, stackid);
        modalHtml += "               </pre>" +
            "   </div>" +
            "   <div class=\"col-lg-12\">" +
            "       <a id=\"detail-stack-view-link\" target=\"_blank\"></a>";

        if (javaStack != "") {
            modalHtml += "      <label id=\"stack-view-java-label-guid\" for=\"stack-view-guid\">Java Stack Trace</label>" +
                "               <pre class=\"small\" style=\"max-height: 650px; min-height: 425px; overflow-y: scroll;\" id=\"stack-view-guid\">" + javaStack + "</pre>";
        }
        modalHtml += "  </div>" +
            "</div>";
        var modalElement = document.getElementById("tsviewpopup");
        // do not load a new modal window when next / previous buttons clicked
        if (modalElement != null && modalElement.style.display === "block") {
            document.getElementById("data-modal-body").innerHTML = modalHtml
        } else {
            createTsviewModal('tsviewpopup', modalHtml);
            loadTsviewModal('tsviewpopup');
        }
    }

    function createTsviewModal(modalId, data) {
        $('#modals-guid')[0].innerHTML = "<div class='modal inmodal fade' id='" + modalId + "' tabindex='-1' role='dialog'  aria-hidden='true'>\n" +
            "    <div class='modal-dialog' style=\"max-width: 95%;\" role=\"document\">" +
            "        <div class='modal-content'>\n" +
            "            <div id='data-modal-body' class='modal-body'>\n" +
            data +
            "            </div>\n" +
            "        </div>\n" +
            "    </div>\n" +
            "</div>";
    }

    function loadTsviewModal(modalId) {
        $('#' + modalId).modal('show');
    }

    function actViewKeyDown(evt) {
        evt = evt || window.event;
        let modalElement = document.getElementById("tsviewpopup");

        if (modalElement === null || modalElement.style.display === "none") {
            return;
        }

        if (evt.keyCode == 39) {
            nextAvailableTsviewStack();
        } else if (evt.keyCode == 37) {
            previousAvailableTsviewStack();
        }
    };

    function nextAvailableTsviewStack() {
        var cur = prevCell;
        while (cur != null && cur.nextSibling != null) {
            cur = cur.nextSibling;
            if (cur.hasAttribute("title")) {
                cur.click();
                break;
            }
        }
    }

    function previousAvailableTsviewStack() {
        var cur = prevCell;
        while (cur != null && cur.previousSibling != null) {
            cur = cur.previousSibling;
            if (cur.hasAttribute("title")) {
                cur.click();
                break;
            }
        }
    }

    function getTime(timeStamp) {
        var date = moment(0).utc().milliseconds(timeStamp);
        return date.format("HH:mm:ss");
    }

    function getColor(context,state) {
        var color = "";
        if(state == 'R') {
            color = "#29b193";
        } else if(state == 'T') {
            color = "#377bb5";
        } else if(state == 'W') {
            color = "#f6ab60";
        } else if(state == 'B') {
            color = "#ee5869";
        }
        var styleColor = "";
        $.each(context, function(index, value) {
            if(value.key == "db_holding" && value.value == "true") {
                styleColor += "brown 50%, brown 50%";
            }
            if(value.key == "db_sample" && value.value == "true") {
                if(styleColor != "") {
                    styleColor += ", yellow 50%, yellow 100%";
                }else {
                    styleColor += "yellow 50%, yellow 100%";
                }
            }
        });
        return styleColor;
    }
    
    
    //svg thread state
    function svgShowReqTSV(evt) {
        var svgobj = evt.target;
        if (svgobj.getAttribute("style") == undefined || !svgobj.getAttribute("style").includes("opacity: 0")) {
            showRequestContextPopupTSV(svgobj.getAttribute("id"));
        }
    }

    function OnScroll0TSV(div) {
        var d2 = document.getElementById("requestbarchartTSV");
        d2.scrollTop = div.scrollTop;
    }

    function OnScroll1TSV(div) {
        var d2 = document.getElementById("requestbarchartTSV");
        d2.scrollLeft = div.scrollLeft;
    }

    function OnScroll2TSV(div) {
        var d1 = document.getElementById("xaxisidTSV");
        var d0 = document.getElementById("yaxisidTSV");
        d0.scrollTop = div.scrollTop;
        d1.scrollLeft = div.scrollLeft;
    }

    function addXAxisTSV(id, top, right, bottom, left, min_x, max_x, w, h, contextStart, downScale) {
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

    function drowStateChartTSV(filteredTidRequests, chartWidth, downScale, minStart, chartHeight, tidSortByMetricMap, groupByCountSum, timestampIndex, spanIndex, groupByIndex, sortByIndex, tidRowIndex, isContextViewFiltered, customEvent, groupByTypeSortByMetricMap) {

        if (customEvent == otherEvent) {
            getOtherHintNote(false, otherEvent);
        } else {
            if (!isContextViewFiltered) {
                getContextHintNote(false, customEvent);
            }
        }


        document.getElementById("statetableTSV").innerHTML = "<div class='row col-lg-12' style='padding: 0 !important;'>"
            + "<div  style='width: 4%;float: left;'></div>"
            + "<div style=\"max-height: 50px;overflow: hidden;width: 96%;float: right;\">"
            + " <div class='row col-lg-12' style='padding: 0 !important;'>"
            + "   <div class='xaxisidTSV col-lg-10' id='xaxisidTSV' style=\"padding: 0 !important; max-height: 50px;overflow: scroll;overflow-y: hidden;\" onscroll='OnScroll1TSV(this)'>"
            + "   </div>"
            + "   <div class='col5 col-lg-2' style=\"padding: 0 !important; max-height: 50px;overflow: hidden;\" id='col5'>"
            + "   </div>"
            + " </div>"
            + "</div>"
            + "</div>"

            + "<div class='row col-lg-12' style='padding: 0 !important;'>"
            + " <div  id='yaxisidTSV' style=\"max-height: 400px;overflow: scroll;overflow-x: hidden;width: 4%;float: left;\" class='yaxisidTSV' onscroll='OnScroll0TSV(this)'></div>"
            + " <div style=\"max-height: 400px;overflow: hidden;width: 96%;float: right;\">"
            + "    <div class='row col-lg-12' style='padding: 0 !important;'>"
            + "      <div class='requestbarchartTSV col-lg-10' onscroll='OnScroll2TSV(this)' style=\"padding: 0 !important; height: 400px;max-height: 400px;overflow: auto;\" id='requestbarchartTSV'>"
            + "      </div>"
            + "      <div class='legendid col-lg-2' style=\"padding: 10px !important; height: 400px; max-height: 400px;overflow: auto;\" id='legendid'>"
            + "      </div>"
            + "    </div>"
            + " </div>"
            + "</div>";

        d3.select("#requestbarchartTSV").append("svg").attr("width", chartWidth).attr("height", chartHeight);

        let d3svg = d3.select("#requestbarchartTSV").select("svg");

        TooltipTSV = d3.select("#requestbarchartTSV")
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

        let localContextData = getContextData(1);
        let contextDataRecords = undefined;
        if (localContextData != undefined && localContextData.records != undefined) {
            contextDataRecords = localContextData.records[customEvent];
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
                            .attr("onclick", 'svgShowReqTSV(evt)')
                            .attr("id", record[tidRowIndex] + "_" + record[timestampIndex])
                            .on("mouseover", function () {
                                return mouseoverSVGTSV(key1, this);
                            })
                            .on("mousemove", function () {
                                return mousemoveSVGTSV(getHearderFor(groupBy) + ": " + key, key1, this, sortBy + ": " + metricVal);
                            })
                            .on("mouseleave", function () {
                                return mouseleaveSVGTSV(key1, this);
                            });
                    }

                    x = x + tmpRunTime / downScale;

                    curTime = tmpEpoch + tmpRunTime;
                }

            }
            y = y + h;
        }
    }

    var TooltipTSV = undefined;
    var mouseoverSVGTSV = function (key, obj) {
        if (d3.select(obj).attr("style") == undefined || !d3.select(obj).attr("style").includes("opacity: 0")) {

            TooltipTSV
                .style("opacity", 1);

            d3.select(obj)
                .style("stroke", "black")
                .style("cursor", "pointer");
        }
    }

    var mousemoveSVGTSV = function (d, key, obj, metricVal) {
        if (d3.select(obj).attr("style") == undefined || !d3.select(obj).attr("style").includes("opacity: 0")) {
            TooltipTSV
                .html(d + ", " + metricVal + '<br>Click to see request profile samples and context')
                .style("left", (d3.mouse(obj)[0] + 20) + "px")
                .style("top", (d3.mouse(obj)[1]) + "px");
        }
    }

    var mouseleaveSVGTSV = function (key, obj) {
        if (d3.select(obj).attr("style") == undefined || !d3.select(obj).attr("style").includes("opacity: 0")) {
            TooltipTSV
                .style("opacity", 0);
            d3.select(obj)
                .style("stroke", "none")
                .style("cursor", "default");
        }
    }
</script>