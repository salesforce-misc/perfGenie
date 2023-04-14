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
<script type="text/javascript" class="init">

    function refreshTreeFlame() {
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

    $(document).ready(function () {
        searchString =  urlParams.get('search') || '';
        $("#search").val(searchString);
        $("#search-flame").val(searchString);
    });

    function searchFlame(value, event) {
        searchString = value;
        $("#search").val(value);
        $("#search-flame").val(value);
        updateUrl("search", value, true);
        refreshTreeFlame();
    }

    function updateProfilerViewFlame(level, skipFilter) {
        if (skipFilter == undefined) {
            skipFilter = false;
        }
        console.log("updateProfilerView start");
        addTabNote(false,"");

        if (!skipFilter) {
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
                    //sortTreeLevelBySizeWrapper(treeToProcess, selectedLevel);
                    sFlameGraph.setThreshold(threshold);
                    sFlameGraph.setSizeKey(selectedLevel);
                    sFlameGraph.showTreeV1Flame(treeToProcess, searchString);
                } else {
                    //sortTreeBySizeWrapper(treeToProcess);
                    sFlameGraph.setThreshold(threshold);
                    sFlameGraph.setSizeKey('sz');
                    treeToProcess['sz'] = treeToProcess['subtotal'];
                    sFlameGraph.showTreeV1Flame(treeToProcess, searchString);
                }
            } else if (isJfrContext) {
                //sortTreeBySizeWrapper(treeToProcess);
                sFlameGraph.setThreshold(threshold);
                sFlameGraph.setSizeKey('sz');
                sFlameGraph.showTreeV1Flame(treeToProcess, searchString);
            }
            if(searchString != ""){
                $("span.cct-search-guid").html((sFlameGraph.getSearchMatchCount() >= 0) ? "<strong> Search found " + sFlameGraph.getSearchMatchCount() + " matching frame(s)</strong>" : "");
            }
            if (!compareTree) {
                $(".img-swap").each(function () {
                    this.src = this.src.replace("_on", "_off");
                });
            }
            end = performance.now();
            console.debug("updateProfilerView 3 time:" + (end - start));
        } else {
            let start = performance.now();
            let treeToProcess = getActiveTree(getEventType(), isCalltree);
            let selectedLevel = getSelectedLevel(getActiveTree(getEventType(), false));

            if (compareTree && isJfrContext) {
                sFlameGraph.setIsCompare(true);
                sFlameGraph.setThreshold(threshold);
                sFlameGraph.showTreeV1FlameCompare(treeToProcess, searchString);
            } else if (isJfrContext && selectedLevel !== FilterLevel.UNDEFINED) {
                if (!isCalltree) {
                    //sortTreeLevelBySizeWrapper(treeToProcess, selectedLevel);
                    sFlameGraph.setThreshold(threshold);
                    sFlameGraph.setSizeKey(selectedLevel);
                    sFlameGraph.showTreeV1Flame(treeToProcess, searchString);
                } else {
                    //sortTreeBySizeWrapper(treeToProcess);
                    sFlameGraph.setThreshold(threshold);
                    sFlameGraph.setSizeKey('sz');
                    treeToProcess['sz'] = treeToProcess['subtotal'];
                    sFlameGraph.showTreeV1Flame(treeToProcess, searchString);
                }
            } else if (isJfrContext) {
                //sortTreeBySizeWrapper(treeToProcess);
                sFlameGraph.setThreshold(threshold);
                sFlameGraph.setSizeKey('sz');
                sFlameGraph.showTreeV1Flame(treeToProcess, searchString);
            }
            if(searchString != ""){
                $("span.cct-search-guid").html((sFlameGraph.getSearchMatchCount() >= 0) ? "<strong> Search found " + sFlameGraph.getSearchMatchCount() + " matching frame(s)</strong>" : "");
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