<script>
    /*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
</script>

<div style="padding-left: 25px;">
    <img title='Base (blue), Common (black) and New (beige)' style="cursor: pointer" opt=1 class="img-swap" height="24px"
         align="middle" src="/images/aub_on.png">
    <img title='Base (blue) and Common (black)' style="cursor: pointer" opt=2 height="24px" class="img-swap" align="middle"
         src="/images/a_off.png">
    <img title='Common (black) and New (beige)' style="cursor: pointer" opt=3 class="img-swap" height="24px" align="top"
         src="/images/b_off.png">
    <select   style="height:30px;text-align: center;" class="filterinput" name="tree-view-type-flame" id="tree-view-type-flame">
        <option  value="backtrace">Backtrace view</option>
        <option   value="calltree">Call tree view</option>
    </select>
    <select  style="height:30px;text-align: center;" class="filterinput" name="event-type-flame" id="event-type-flame">

    </select>
    <input  style="height:30px;text-align: center;" class="filterinput" type='text' id='search-flame' value='${(search??)?then(search?first, '')}' size='35'
           onkeydown="if(event.keyCode === 13) searchFlame(event.target.value, event);">
    <a title='Search' id="searchtree-flame" href='javascript:searchFlame(document.getElementById("search-flame").value, event)'><i style="font-size:18px" class="fa fa-search" aria-hidden="true"></i></a>&nbsp;&nbsp;
    <span title="Exclude samples below threshold %">Threshold</span>: <input  style="height:30px;text-align: center;" class="filterinput" type='text' id='threshold-flame' value='0.01' size='5'
                                                                             onkeypress="if(event.keyCode === 13) javascript:refreshTreeFlame()">
    <a title='Redo' href='javascript:refreshTreeFlame()'><i style="font-size:18px" class="fa fa-repeat" aria-hidden="true"></i></a>
</div>

<div class="row">
    <div id="flame-graph-foundation-wrapper" class="col-lg-4 col-md-4 col-sm-4 text-center"
         title="When this toggle is on it shows the union of the two data sets, diffing the matching frame counts or diffing against zero if it doesn't exist in one set.

When off only the first data set (BASE) is displayed with the changes compared to the second set (COMPARE).

In other words, data that's in the second set but not in the first will not be displayed when the toggle is off."></div>
    <div class="col-lg-12 col-md-12 col-sm-12">
        <div  id="flame-graph-guid"></div>
        <div id="flame-graph-details-guid"></div>
        <!-- custom context-menu -->
        <ul id="custom-menu-guid" class="items">
            <li>Copy</li>
            <li>Reset Zoom</li>
        </ul>
    </div>
</div>
<!-- context menu css -->
<style>
    .items {
        list-style: none;
        margin: 4px 0 0;
        padding: 3px 10px;
        font-size: 100%;
        color: grey;
    }

    .items li:hover {
        border-radius:2px;
        background: lightblue;
        color: black;
        cursor: pointer;
    }

    .items li {
        padding: 3px 3px 3px 10px;
    }

    rect:hover, foreignObject:hover {
        cursor: pointer;
    }

    #custom-menu-guid {
        display: none;
        position: absolute;
        border: 1px solid #B2B2B2;
        width: 120px;
        background: #F9F9F9;
        box-shadow: 3px 3px 2px rgba(0, 0, 0, 0.5);
        border-radius: 4px;
        z-index: 99;
    }

    #flame-graph-guid {
        overflow: auto;
        height: auto;
        width: auto;
        max-height: 80vh;
        text-align: center;
    }

    #flame-graph-details-guid {
        min-height: 2vh;
    }

</style>
<!-- context menu javascript -->
<script>

    function refreshTreeFlame(){
        isRefresh = true;
        $("#threshold").val($("#threshold-flame").val());
        updateProfilerView();
    }

    $("#tree-view-type-flame").on("change", (event) => {
        handleTreeViewTypeChange($("#tree-view-type-flame").val());
    });
    $("#event-type-flame").on("change", (event) => {
        handleEventTypeChange($("#event-type-flame").val());
    });

    let searchString = undefined;
    function searchFlame(value, event) {
        searchString=value;
        $("#search").val(value);
        //let matches = searchGraph(value);
        //$("span.cct-search-guid").html((matches.length >= 0) ? "<strong> Search found " + matches.length + " matching frame(s)</strong>" : "");
        updateUrl("search", value, true);
        refreshTreeFlame();
    }

    function contextMenu(data) {
        d3.event.preventDefault();

        const position = d3.mouse($("#flame-graph-guid")[0]);
        d3.select("#custom-menu-guid")
            .style('position', 'absolute')
            .style('left', (position[0] + 10) + "px")
            .style('top', (position[1] - 10) + "px")
            .style('display', 'inline-block')
            .selectAll("li")
            .on('click', function(_, index) {
                d3.select("#custom-menu-guid").style('display', 'none');
                if (index === 0) { // copy
                    if (copyToClipboard(generateLabel(data))) {
                        toastr_success("Copied to clipboard!");
                    }
                } else if (index === 1) { // code ownership
                    openCodeOwnership(data);
                } else { // reset zoom
                    flameGraph.resetZoom();
                }
            });

        // hide context-menu on click
        $(document).on("click",function(){
            d3.select("#custom-menu-guid").style('display', 'none');
        });
    }

    // creates an element to put the provided string so it can be selected and copied
    function copyToClipboard(string) {
        const tempElement = document.createElement('textarea');
        tempElement.value = string;
        document.body.appendChild(tempElement);
        tempElement.select();
        document.execCommand('copy');
        document.body.removeChild(tempElement);
        return true;
    }
</script>
<script type="text/javascript" class="init">
    // in order to adjust for color we need to track the largest number so we know the extreme
    let largestDiff;
    // global for the flame graph once it's generated
    let flameGraph;
    // store the diff context trees, so we don't have to make another call if we shift the foundation
    let diffContextTrees;

    // [ajax request] builds a flame graph based on a single query
    function createPlainFlameGraph(graphJson) {
        if (graphJson.children.length === 0) {
            toastr_warning("Nothing to display");
            spinnerToggle('spinnerId');
            return;
        }

        flameGraph = flameGraphFromBuilder(flameGraphBuilder(), graphJson);
        searchGraph($('#search').val());
    }

    // creates a label string with data relative the provided data
    function generateLabel(d) {
        if (d['data']['diffValue'] === undefined) {
            return d['data']['name'] + " (" + d3.format(".3f")(100 * (d.x1 - d.x0), 3) + "%, " + d['data']['value'] + " samples)";
        } else {
            return d['data']['name']
                + " (base: " + d['data']['baseValue']
                + ", new: " + (d['data']['baseValue'] + d['data']['diffValue'])
                + ", diff: " + d['data']['diffValue']
                + ", percent: " + d3.format(".2f")(100 * (d.x1 - d.x0), 3) + "%)";
        }
    }

    // attaches specialized processes to flame graph and returns the 'builder'
    function flameGraphBuilder() {
        return d3.flameGraph()
            .width($('#tabs').width() * 0.95) // 95% div width
            .details(document.getElementById("flame-graph-details-guid"));
    }

    // builds the flame graph based on the flame graph 'builder' and json provided
    function flameGraphFromBuilder(flameGraph, graphJson) {
        const flameGraphContainer = document.getElementById('flame-graph-guid');
        flameGraphContainer.innerHTML = "";
        const flameSelect = d3.select("#flame-graph-guid");
        // load data and generate graph
        flameSelect
            .datum(graphJson)
            .call(flameGraph);
        // add custom right click event
        flameSelect.select("svg")
            .selectAll("g")
            .on("contextmenu", contextMenu);

        // scroll to bottom
        flameGraphContainer.scrollTop = flameGraphContainer.scrollHeight;
        return flameGraph;
    }

    // color gradient from red to white to blue
    function generateColorForDiff(d) {
        if (d.highlight) {
            return "#E600E6";
        }

        const value = d.data.diffValue;
        let b = 255;
        let r = 255;
        let g = 255;
        if (value < 0) {
            g = r = 255 - (Math.abs(value/largestDiff) * 255);
        } else if (value > 0) {
            g = b = 255 - (Math.abs(value/largestDiff) * 255);
        }
        return 'rgba(' + r + ', ' + g + ', ' + b + ', 0.5)';
    }

    // on context-menu option click open the code ownership page with the provided frame
    function openCodeOwnership(data) {
        const cleanFrame = function (frameText) {
            let frame = frameText.substring(0, frameText.lastIndexOf("."));
            if (frame.includes("$")) {
                frame = frame.substring(0, frame.indexOf("$"));
            }
            if (frame.includes("?")) {
                frame = frame.replace(/\?/g, "");
            }
            return frame;
        };

        if (data['data']['name'] !== "root") {
            window.open('/page/utility-code-ownership?frame=' + encodeURIComponent(cleanFrame(data['data']['name'])), '_blank');
        }
    }

    function searchGraph(value) {
        if (flameGraph === undefined || value === undefined) {
            return -1;
        }

        if (value === "") {
            flameGraph.clear();
            return -1;
        }
        return flameGraph.search(value);
    }

    // interface method to convert call graph json to flame graph friendly format
    function showTreeV1FlameOld(treeToProcess, level) {
        const stack = [];
        treeToProcess['name'] = 'root';
        treeToProcess['total'] = treeToProcess[level];
        treeToProcess['children'] = [...treeToProcess['ch']];

        let truncationIndex;
        let toRemove = [];
        for (let rootIndex = 0; rootIndex < treeToProcess['children'].length; rootIndex++) {
            if (100 * (treeToProcess['children'][rootIndex][level]) / (treeToProcess.sz) < Number(threshold)) {
                const value = +treeToProcess['children'][rootIndex][level];
                if (truncationIndex === undefined) {
                    truncationIndex = rootIndex;
                    treeToProcess['children'][rootIndex] = {
                        "name": "Summed samples below threshold...",
                        "value": value,
                        "children": []
                    };
                } else {
                    treeToProcess['children'][truncationIndex]['value'] += value;
                    toRemove.push(rootIndex);
                }
            } else {
                stack.push(treeToProcess['children'][rootIndex]);
            }
        }
        // removing all the elements below the threshold without disrupting the array
        toRemove.sort((a, b) => b - a).forEach(index => treeToProcess["children"].splice(index, 1));

        while (stack.length !== 0) {
            const node = stack.pop();
            if (node[level] === undefined || node[level] === 0 || isSkipSubtree(node[level], 0)) {
                node['children'] = [];
                continue;
            }
            if (100 * (node[level]) / (treeToProcess.sz) < Number(threshold)) {
                if (treeToProcess[level] > 1) {
                    node['name'] = "Below threshold..."
                    node['value'] = node[level];
                    node['children'] = [];
                }
                continue;
            }

            node['name'] = getFrameName(node['nm']);
            node['value'] = node[level];

            node['children'] = (node.ch === null) ? [] : node['ch'];
            for (let child of node.children) {
                stack.push(child);
            }
        }

        createPlainFlameGraph(treeToProcess);
    }

    function updateProfilerViewFlame(level, skipFilter) {
        if(skipFilter == undefined){
            skipFilter = false;
        }
        console.log("updateProfilerView start");
        if(!skipFilter) {
            if (level === undefined) {
                level = FilterLevel.LEVEL1;
            }

            let start = performance.now();
            if (!filterToLevel(level)) {
                let end = performance.now();
                console.debug("filterToLevel time:" + (end - start));
                return;
            }
            let end = performance.now();
            console.debug("filterToLevel time:" + (end - start));


            let treeToProcess = getActiveTree(getEventType(), isCalltree);
            let selectedLevel = getSelectedLevel(getActiveTree(getEventType(), false));

            if (currentLoadedTree === treeToProcess && prevOption === currentOption && isRefresh === false && isLevelRefresh === false && prevSelectedLevel === selectedLevel) {
                console.log("no change in tree, option:" + prevOption + ":" + isRefresh + ":" + ":" + isLevelRefresh + ":" + selectedLevel);
                end = performance.now();
                console.debug("updateProfilerView 1 time:" + (end - start));
                return;
            }
            currentLoadedTree = treeToProcess;
            prevOption = currentOption;
            prevSelectedLevel = selectedLevel;
            isLevelRefresh = false;

            resetThreshold(selectedLevel);

            let graphType = isCalltree ? "Call tree view" : "Backtrace view";

            // if no data returned from our call don't try to parse it
            if (treeToProcess === undefined) {
                end = performance.now();
                console.debug("updateProfilerView 2 time:" + (end - start));
                return;
            }

            let timeRange = "";
            if (compareTree) {
                let $profile1 = "";
                let $profile2 = "";

                $profile1 = $("#bases1 :selected").text();


                $profile2 = $("#bases2 :selected").text();

                timeRange = ", Profile(s): <span class=\"bclr\">" + $profile1 + "</span> <span class=\"tclr\">" + $profile2 + "</span>";

            } else {

                timeRange = ", Profile: <span>" + $("#bases1 :selected").text() + "</span>";
            }

            if (isJfrContext && !compareTree) {
                resetTreeHeader("<span style=\"font-weight:bold\">" + graphType + "</span>," + " Total samples: "
                    + treeToProcess.sz + ", <span title=\"Exclude samples below threshold %\">Threshold</span>: " + threshold + timeRange + (isAggregation() ? getTextForAggregationInput(contextTree1["1"]) : ""));
            } else {
                resetTreeHeader("<span style=\"font-weight:bold\">" + graphType + "</span>," + " Total samples: "
                    + (((treeToProcess.bsize !== undefined) ? treeToProcess.bsize : treeToProcess.bsz) + ((treeToProcess.csize !== undefined) ? treeToProcess.csize : treeToProcess.csz)) + ", <span title=\"Exclude samples below threshold %\">Threshold</span>: "
                    + threshold + timeRange);
            }

            if (compareTree && isJfrContext) {
                sFlameGraph.setIsCompare(true);
                sFlameGraph.setThreshold(threshold);
                sFlameGraph.showTreeV1FlameCompare(treeToProcess, searchString);
            } else if (isJfrContext && selectedLevel !== FilterLevel.UNDEFINED) {
                if (!isCalltree) {
                    sortTreeLevelBySize(treeToProcess, selectedLevel);
                    //updateStackIndex(treeToProcess);
                    sFlameGraph.setThreshold(threshold);
                    sFlameGraph.setSizeKey(selectedLevel);
                    sFlameGraph.showTreeV1Flame(treeToProcess,searchString);
                } else {
                    sortTreeBySize(treeToProcess);
                    sFlameGraph.setThreshold(threshold);
                    sFlameGraph.setSizeKey('sz');
                    treeToProcess['sz'] = treeToProcess['subtotal'];
                    sFlameGraph.showTreeV1Flame(treeToProcess,searchString);
                }
            } else if (isJfrContext) {
                sortTreeBySize(treeToProcess);
                sFlameGraph.setThreshold(threshold);
                sFlameGraph.setSizeKey('sz');
                sFlameGraph.showTreeV1Flame(treeToProcess,searchString);
            }
            if (!compareTree) {
                $(".img-swap").each(function () {
                    this.src = this.src.replace("_on", "_off");
                });
            }
            end = performance.now();
            console.debug("updateProfilerView 3 time:" + (end - start));
        }else{
            let start = performance.now();
            let treeToProcess = getActiveTree(getEventType(), isCalltree);
            let selectedLevel = getSelectedLevel(getActiveTree(getEventType(), false));

            if (compareTree && isJfrContext) {
                sFlameGraph.setIsCompare(true);
                sFlameGraph.setThreshold(threshold);
                sFlameGraph.showTreeV1FlameCompare(treeToProcess, searchString);
            } else if (isJfrContext && selectedLevel !== FilterLevel.UNDEFINED) {
                if (!isCalltree) {
                    sortTreeLevelBySize(treeToProcess, selectedLevel);
                    //updateStackIndex(treeToProcess);
                    sFlameGraph.setThreshold(threshold);
                    sFlameGraph.setSizeKey(selectedLevel);
                    sFlameGraph.showTreeV1Flame(treeToProcess,searchString);
                } else {
                    sortTreeBySize(treeToProcess);
                    sFlameGraph.setThreshold(threshold);
                    sFlameGraph.setSizeKey('sz');
                    treeToProcess['sz'] = treeToProcess['subtotal'];
                    sFlameGraph.showTreeV1Flame(treeToProcess,searchString);
                }
            } else if (isJfrContext) {
                sortTreeBySize(treeToProcess);
                sFlameGraph.setThreshold(threshold);
                sFlameGraph.setSizeKey('sz');
                sFlameGraph.showTreeV1Flame(treeToProcess,searchString);
            }
            if (!compareTree) {
                $(".img-swap").each(function () {
                    this.src = this.src.replace("_on", "_off");
                });
            }
            let end = performance.now();
            console.log("updateProfilerView 4 time:" + (end - start));
        }
    }
</script>