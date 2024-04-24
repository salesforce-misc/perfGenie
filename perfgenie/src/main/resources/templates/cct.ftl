<script>
    /*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

    function createCCTModal(modalId, data) {
        $('#modals-guid')[0].innerHTML = "<div   id='" + modalId + "' class='modal inmodal fade' tabindex='-1' role='dialog' aria-labelledby='cctmodel' aria-hidden='true'>" +
            "<div class='modal-dialog' style=\"max-width: 95%;\" role=\"document\">" +
            "<div class='modal-content'>" +
            "<div id='data-modal-body' class='modal-body' style='overflow: auto'>" +
            "<ul class='tree'>" +
            "<li>" + data + "</li>" +
            "</ul>"+
            "</div>" +
            "</div>" +
            "</div>" +
            "</div>";
    }

    function loadCCTModal(modalId) {
        $('#' + modalId).modal('show');
        addClickActionsToElement($('#modals-guid')[0]);
    }

    function unLoadCCTModal(modalId) {
        $('#' + modalId).modal('hide');
    }

    function showTree(treeToProcess) {
        treeHtml = "";
        let skip = false;
        let index = 0;
        if (treeToProcess.ch != null) {
            treeToProcess.children.forEach(function (root) {
                if (skip || isSkipSubtree(root.bsize, root.csize)) {
                    return;
                }
                if ((100 * (root.bsize) / (treeToProcess.bsize + treeToProcess.csize) < Number(threshold)) && (100 * (root.csize) / (treeToProcess.bsize + treeToProcess.csize) < Number(threshold))) {
                    if (treeToProcess.bsize > 1 || treeToProcess.csize > 1) {
                        treeHtml = treeHtml + "<li>...\n";
                    }
                    skip = true;
                } else if (treeToProcess.children.length > 0) {
                    treeHtml = treeHtml + getLi(root.bsize, root.csize, treeToProcess.bsize + treeToProcess.csize, root.name, 0, index);
                    treeHtml = treeHtml + "<ul><li></ul>\n";
                }
                index++;
            });
        }
        $("ul.tree").html(treeHtml);
    }

    function showTreeV1Level(treeToProcess, level) {
        treeHtml = "";
        let skip = false;
        let index = 0;
        if (treeToProcess.ch != null) {
            treeToProcess.ch.forEach(function (root) {
                if (skip || root[level] === undefined || root[level] === 0 || isSkipSubtree(root[level], 0)) {
                    return;
                }
                if ((100 * (root[level]) / (treeToProcess.sz) < Number(threshold)) && (100 * (root[level]) / (treeToProcess.sz) < Number(threshold))) {
                    if (treeToProcess[level] > 1) {
                        treeHtml = treeHtml + "<li>...\n";
                    }
                    skip = true;
                } else if (treeToProcess.ch.length > 0) {
                    treeHtml = treeHtml + getLi(root[level], 0, treeToProcess.sz, root.nm, 0, index);
                    treeHtml = treeHtml + "<ul><li></ul>\n";
                }
                index++;
            });
        }
        $("ul.tree").html(treeHtml);
    }

    function showTreeV1(treeToProcess, level) {
        treeHtml = "";
        let skip = false;
        let index = 0;
        if (treeToProcess.ch != null) {
            treeToProcess.ch.forEach(function (root) {
                if (skip || isSkipSubtree(root.sz, 0)) {
                    return;
                }
                if ((100 * (root.sz) / (treeToProcess.sz) < Number(threshold)) && (100 * (root.sz) / (treeToProcess.sz) < Number(threshold))) {
                    if (treeToProcess.sz > 1) {
                        treeHtml = treeHtml + "<li>...\n";
                    }
                    skip = true;
                } else if (treeToProcess.ch.length > 0) {
                    treeHtml = treeHtml + getLi(root.sz, 0, treeToProcess.sz, root.nm, 0, index);
                    treeHtml = treeHtml + "<ul><li></ul>\n";
                }
                index++;
            });
        }
        $("ul.tree").html(treeHtml);
    }

    function showTreeV1Compare(treeToProcess) {
        treeHtml = "";
        let skip = false;
        let index = 0;
        if (treeToProcess.ch != null) {
            treeToProcess.ch.forEach(function (root) {
                if (skip || isSkipSubtree(root.bsz, root.csz)) {
                    return;
                }
                if ((100 * (root.bsz) / (treeToProcess.bsz + treeToProcess.csz) < Number(threshold)) && (100 * (root.csz) / (treeToProcess.bsz + treeToProcess.csz) < Number(threshold))) {
                    if (treeToProcess.bsz > 1 || treeToProcess.csz > 1) {
                        treeHtml = treeHtml + "<li>...\n";
                    }
                    skip = true;
                } else if (treeToProcess.ch.length > 0) {
                    treeHtml = treeHtml + getLi(root.bsz, root.csz, treeToProcess.bsz + treeToProcess.csz, root.nm, 0, index);
                    treeHtml = treeHtml + "<ul><li></ul>\n";
                }
                index++;
            });
        }
        $("ul.tree").html(treeHtml);
    }

    function searchWord(root, word) {
        let skip = false;
        if (root.children !== undefined) {
            root.children.forEach(function (child) {
                if (skip == false) {
                    if (getFrameName(child.name).includes(word)) {
                        skip = true;
                    } else {
                        skip = searchWord(child, word);
                    }
                }
            });
        } else {
            if (root.ch !== null) {
                root.ch.forEach(function (child) {
                    if (skip == false) {
                        if (getFrameName(child.nm).includes(word)) {
                            skip = true;
                        } else {
                            skip = searchWord(child, word);
                        }
                    }
                });
            }
        }
        return skip;
    }

    function initSearchTree(word) {
        let treeToProcess;

        treeToProcess = getActiveTree(getEventType(), isCalltree);

        // if no data returned from our call don't try to parse it
        if (treeToProcess === undefined) {
            return;
        }

        const tree = document.querySelectorAll('li.expand');
        if (treeToProcess.children !== undefined) {
            for (let i = 0; i < tree.length; i++) {
                if (searchWord(treeToProcess.children[Number(tree[i].getAttribute('index'))], word)) {
                    expandTree(Number(tree[i].getAttribute('index')), tree[i]);
                }
            }
        } else {
            for (let i = 0; i < tree.length; i++) {
                if (searchWord(treeToProcess.ch[Number(tree[i].getAttribute('index'))], word)) {
                    expandTree(Number(tree[i].getAttribute('index')), tree[i]);
                }
            }
        }
        if (!compareTree) {
            $(".img-swap").each(function () {
                this.src = this.src.replace("_on", "_off");
            });
        }
    }

    function isSkipSubtree(bsize, csize) {
        if ((bsize === 0 && currentOption === 2) || (csize === 0 && currentOption === 3)) {
            return true;
        }
        return false;
    }

    function expandTree(index, element) {

        let treeToProcess = getActiveTree(getEventType(), isCalltree); //getTreeToProcess();

        // if no data returned from our call don't try to parse it
        if (treeToProcess === undefined) {
            return;
        }

        let selectedLevel = getSelectedLevel(treeToProcess);

        treeHtml = "";
        if (compareTree && isJfrContext) {
            if (!processChildV1Compare(treeToProcess.ch[index], treeToProcess.bsz + treeToProcess.csz, 1)) {
                treeHtml = treeHtml + "<li>...\n";
            }
        } else if (isJfrContext && selectedLevel !== FilterLevel.UNDEFINED) {
            if (!processChildV1Level(treeToProcess.ch[index], treeToProcess.sz, 1, selectedLevel)) {
                treeHtml = treeHtml + "<li>...\n";
            }
        } else if (isJfrContext) {
            if (!processChildV1(treeToProcess.ch[index], treeToProcess.sz, 1)) {
                treeHtml = treeHtml + "<li>...\n";
            }
        } else {
            if (!processChild(treeToProcess.children[index], treeToProcess.bsize + treeToProcess.csize, 1)) {
                treeHtml = treeHtml + "<li>...\n";
            }
        }
        element.getElementsByTagName("ul")[0].innerHTML = treeHtml;
        addClickActionsToElement(element.getElementsByTagName("ul")[0]);
    }

    function processChildV1Level(tree, total, depth, level) {
        //skip sub tree for below given threshold
        if (100 * tree[level] / total < Number(threshold)) {
            return false;
        }
        let skip = false;

        if (tree.ch == null) {
            tree.ch = [];
        }

        tree.ch.forEach(function (child) {
            if (skip || child[level] === undefined || child[level] === 0 || isSkipSubtree(child[level], 0)) {
                return;
            }
            if (100 * child[level] / total < Number(threshold)) {
                treeHtml = treeHtml + "<li>...\n";
                skip = true;
            } else if (tree.ch.length > 0) {
                treeHtml = treeHtml + getLi(child[level], 0, total, child.nm, depth, 0);
                treeHtml = treeHtml + "<ul>\n";
                if (!processChildV1Level(child, total, depth + 1, level)) {
                    treeHtml = treeHtml + "<li>...\n";
                }
                treeHtml = treeHtml + "</ul>\n";
            }
        });
        return true;
    }

    function processChildV1(tree, total, depth) {
        //skip sub tree for below given threshold
        if (100 * tree.sz / total < Number(threshold)) {
            return false;
        }
        let skip = false;

        if (tree.ch == null) {
            tree.ch = [];
        }

        tree.ch.forEach(function (child) {
            if (skip || isSkipSubtree(child.sz, 0)) {
                return;
            }
            if (100 * child.sz / total < Number(threshold)) {
                treeHtml = treeHtml + "<li>...\n";
                skip = true;
            } else if (tree.ch.length > 0) {
                treeHtml = treeHtml + getLi(child.sz, 0, total, child.nm, depth, 0);
                treeHtml = treeHtml + "<ul>\n";
                if (!processChildV1(child, total, depth + 1)) {
                    treeHtml = treeHtml + "<li>...\n";
                }
                treeHtml = treeHtml + "</ul>\n";
            }
        });
        return true;
    }

    function processChildV1Compare(tree, total, depth) {
        //skip sub tree for below given threshold
        if ((100 * (tree.bsz) / total < Number(threshold)) && (100 * ((tree.csz !== undefined) ? tree.csz : 0) / total < Number(threshold))) {
            return false;
        }
        let skip = false;

        if (tree.ch == null) {
            tree.ch = [];
        }

        tree.ch.forEach(function (child) {
            if (skip || isSkipSubtree(child.bsz, ((child.csz !== undefined) ? child.csz : 0))) {
                return;
            }
            if (100 * (child.bsz + ((child.csz !== undefined) ? child.csz : 0)) / total < Number(threshold)) {
                treeHtml = treeHtml + "<li>...\n";
                skip = true;
            } else if (tree.ch.length > 0) {
                treeHtml = treeHtml + getLi(child.bsz, ((child.csz !== undefined) ? child.csz : 0), total, child.nm, depth, 0);
                treeHtml = treeHtml + "<ul>\n";
                if (!processChildV1Compare(child, total, depth + 1)) {
                    treeHtml = treeHtml + "<li>...\n";
                }
                treeHtml = treeHtml + "</ul>\n";
            }
        });
        return true;
    }

    function processChild(tree, total, depth) {
        //skip sub tree for below given threshold
        if ((100 * (tree.bsize) / total < Number(threshold)) && (100 * (tree.csize) / total < Number(threshold))) {
            return false;
        }
        let skip = false;

        tree.children.forEach(function (child) {
            if (skip || isSkipSubtree(child.bsize, child.csize)) {
                return;
            }
            if (100 * (child.bsize + child.csize) / total < Number(threshold)) {
                treeHtml = treeHtml + "<li>...\n";
                skip = true;
            } else if (tree.children.length > 0) {
                treeHtml = treeHtml + getLi(child.bsize, child.csize, total, child.name, depth, 0);
                treeHtml = treeHtml + "<ul>\n";
                if (!processChild(child, total, depth + 1)) {
                    treeHtml = treeHtml + "<li>...\n";
                }
                treeHtml = treeHtml + "</ul>\n";
            }
        });
        return true;
    }

    function getLi(bsize, csize, total, name, depth, index) {
        let color = "black";
        let compareDiff = "";
        let toolTip = "";
        let diffPercent = "NA";
        let bar = "";
        if (compareTree) {
            if (bsize === 0) {
                color = "tclr";
            } else if (csize === 0) {
                color = "bclr"
            }

            if (bsize > 0 && csize > 0) {
                diffPercent = csize - bsize;
                if(diffPercent !== 0) {
                    diffPercent = (100 * diffPercent / bsize).toFixed(2);
                }
                if (diffPercent === 0) {
                    bar = "<div title=\"% diff \" class = \"rbar\" style=\"width:" + diffPercent + "px;\">&nbsp;</div>";
                }else if (diffPercent > 0) {
                    bar = "<div title=\"" +diffPercent+ "% increase \" class = \"rbar\" style=\"width:" + Math.log(diffPercent) * 2 + "px;\">&nbsp;</div>";
                } else {
                    bar = "<div title=\"" +diffPercent+ "% decrease\" class = \"ibar\" style=\"width:" + Math.log(Math.abs(diffPercent)) * 2 + "px;\">&nbsp;</div>";
                }
                diffPercent = " diff percent: " + diffPercent + " %";
            }
            compareDiff = "<span class=\"bclr\">" + (100 * (bsize) / total).toFixed(2) + "% </span>" + "<span class=\"tclr\">" + (100 * (csize) / total).toFixed(2) + "%&nbsp;</span>";
            toolTip = "base: " + bsize + " new: " + csize + " diff: " + (csize - bsize) + diffPercent;
        } else {
            compareDiff = (100 * (bsize + csize) / total).toFixed(2) + "% " + (bsize + csize);
        }

        let tmpClass = "";
        if (depth == 0) {
            tmpClass = " class=\"expand\" index=" + index + " ";
        }
        if (isJfrContext == true) {
            return "<li" + tmpClass + "><div class=\"subtree\">[" + depth + "] " + compareDiff + " </div>" + bar + "<span title=\"" + toolTip + "\" class=\"" + color + "\">&nbsp;" + getFrameName(name) + "</span>\n";
        } else {
            return "<li" + tmpClass + "><div class=\"subtree\">[" + depth + "] " + compareDiff + " </div>" + bar + "<span title=\"" + toolTip + "\" class=\"" + color + "\">&nbsp;" + name + "</span>\n";
        }
    }

    function treeView(opt) {
        const tree = document.querySelectorAll('ul.tree div:not(:last-child)');
        for (let i = 0; i < tree.length; i++) {
            const parent = tree[i].parentElement;
            const classList = parent.classList;
            if (opt == 0) {
                classList.add('open');
            } else {
                classList.remove('open');
            }
        }
    }

    function openParent(p, t) {
        if (p.parentElement.classList.contains("tree")) {
            return;
        }
        p.parentElement.classList.add('open');
        openParent(p.parentElement, t);
    }

    function search() {
        $("#search-flame").val(document.getElementById("search").value);
        initSearchTree(document.getElementById("search").value);
        let searchCount = 0;
        const tree = document.querySelectorAll('ul.tree span');
        for (let i = 0; i < tree.length; i++) {
            tree[i].classList.remove('sc');
            if (document.getElementById("search").value !== "" && tree[i].innerHTML.includes(document.getElementById("search").value)) {
                searchCount++;
                tree[i].classList.add('sc');
                openParent(tree[i].parentElement, tree);
            }
        }
        $("span.cct-search-guid").html("<strong> Search found " + searchCount + " matching frame(s)</strong>");
    }

    function openUL(n) {
        const children = n.children;
        if (children.length == 1) {
            openNode(children[0]);
        }
    }

    function openNode(n) {
        const children = n.children;
        for (let i = 0; i < children.length; i++) {
            if (children[i].nodeName == 'UL') {
                n.classList.add('open');
                openUL(children[i]);
            }
        }
    }

    function addClickActionsToElement(element) {
        const tree = element.querySelectorAll('ul.tree div.subtree:not(:last-child)');
        for (let i = 0; i < tree.length; i++) {
            tree[i].addEventListener('click', function (e) {
                const parent = $(e.target).closest("li")[0];
                if (parent === undefined) {
                    return;
                }
                const classList = parent.classList;
                if (classList.contains("expand")) {
                    classList.remove('expand');
                    expandTree(Number(parent.getAttribute('index')), parent)
                }

                if (classList.contains("open")) {
                    classList.remove('open');
                    const opensubs = parent.querySelectorAll(':scope .open');
                    for (let i = 0; i < opensubs.length; i++) {
                        opensubs[i].classList.remove('open');
                    }
                } else {
                    if (e.altKey) {
                        classList.add('open');
                        const opensubs = parent.querySelectorAll('li');
                        for (let i = 0; i < opensubs.length; i++) {
                            opensubs[i].classList.add('open');
                        }
                    } else {
                        openNode(parent);
                    }
                }
            });

            tree[i].addEventListener('contextmenu', function (e) {
                e.preventDefault();
                const parent = $(e.target).closest("li")[0];
                const classList = parent.classList;
                if (classList.contains("expand")) {
                    classList.remove('expand');
                    expandTree(Number(parent.getAttribute('index')), parent)
                }
                createCCTModal("cctpopup", parent.innerHTML);
                loadCCTModal("cctpopup");
                setTimeout(function () {
                    $('#cctpopup').focus();
                }, 500);
                return false;
            });
        }
    }

    function updateProfilerViewCCT(level, skipFilter) {
        if (skipFilter == undefined) {
            skipFilter = false;
        }
        console.log("updateProfilerView start");
        addTabNote(false,"");


        if (!skipFilter) {
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

            if (prevCustomEvent === customEvent && currentLoadedTree === treeToProcess && prevOption === currentOption && isRefresh === false && isLevelRefresh === false && prevSelectedLevel === selectedLevel) {
                console.log("no change in tree, option:" + (prevCustomEvent == customEvent) + ":" + (currentLoadedTree === treeToProcess)+":"+ (prevOption === currentOption) +" isRefresh:"+(isRefresh === false)+":"+" isLevelRefresh:"+(isLevelRefresh === false)+" selectedLevel:"+ (prevSelectedLevel === selectedLevel));
                end = performance.now();
                console.log("updateProfilerView 1 time:" + (end - start));
                return;
            }else{
                console.log("change in tree, option:" + (prevCustomEvent == customEvent) + ":" + (currentLoadedTree === treeToProcess)+":"+ (prevOption === currentOption) +" isRefresh:"+(isRefresh === false)+":"+" isLevelRefresh:"+(isLevelRefresh === false)+" selectedLevel:"+ (prevSelectedLevel === selectedLevel));
            }

            currentLoadedTree = treeToProcess;
            prevOption = currentOption;
            prevCustomEvent = customEvent;
            prevSelectedLevel = selectedLevel;
            isLevelRefresh = false;

            resetThreshold(selectedLevel);

            let graphType = isCalltree ? "Call tree view" : "Backtrace view";

            // if no data returned from our call don't try to parse it
            if (treeToProcess === undefined) {
                end = performance.now();
                console.log("updateProfilerView 2 time:" + (end - start));
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
                showTreeV1Compare(treeToProcess);
            } else if (isJfrContext && selectedLevel !== FilterLevel.UNDEFINED) {
                if (!isCalltree) {
                    showTreeV1Level(treeToProcess, selectedLevel);
                } else {
                    showTreeV1(treeToProcess);
                }
            } else if (isJfrContext) {
                showTreeV1(treeToProcess);
            } else {
                showTree(treeToProcess);
            }
            addClickActionsToElement(document);
            if (!compareTree) {
                $(".img-swap").each(function () {
                    this.src = this.src.replace("_on", "_off");
                });
            }
            end = performance.now();
            console.log("updateProfilerView 3 time:" + (end - start));
        } else {
            let start = performance.now();
            let treeToProcess = getActiveTree(getEventType(), isCalltree);
            let selectedLevel = getSelectedLevel(getActiveTree(getEventType(), false));

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

            let graphType = isCalltree ? "Call tree view" : "Backtrace view";
            if (isJfrContext && !compareTree) {
                resetTreeHeader("<span style=\"font-weight:bold\">" + graphType + "</span>," + " Total samples: "
                    + treeToProcess.sz + ", <span title=\"Exclude samples below threshold %\">Threshold</span>: " + threshold + timeRange + (isAggregation() ? getTextForAggregationInput(contextTree1["1"]) : ""));
            } else {
                resetTreeHeader("<span style=\"font-weight:bold\">" + graphType + "</span>," + " Total samples: "
                    + (((treeToProcess.bsize !== undefined) ? treeToProcess.bsize : treeToProcess.bsz) + ((treeToProcess.csize !== undefined) ? treeToProcess.csize : treeToProcess.csz)) + ", <span title=\"Exclude samples below threshold %\">Threshold</span>: "
                    + threshold + timeRange);
            }


            if (compareTree && isJfrContext) {
                showTreeV1Compare(treeToProcess);
            } else if (isJfrContext && selectedLevel !== FilterLevel.UNDEFINED) {
                if (!isCalltree) {
                    showTreeV1Level(treeToProcess, selectedLevel);
                } else {
                    showTreeV1(treeToProcess);
                }
            } else if (isJfrContext) {
                showTreeV1(treeToProcess);
            } else {
                showTree(treeToProcess);
            }
            addClickActionsToElement(document);
            if (!compareTree) {
                $(".img-swap").each(function () {
                    this.src = this.src.replace("_on", "_off");
                });
            }
            let end = performance.now();
            console.log("updateProfilerView 4 time:" + (end - start));
        }
        if(!isFilterOnType){
            addTabNote(true,getContextHintNote(true));
        }
    }

</script>
<div id="cctnote"></div>
<div style="padding-left: 25px;">
    <a title='Compress' href='javascript:treeView(1)'><i style="font-size:18px" class="fa fa-minus-square-o"
                                                         aria-hidden="true"></i></a>
    <img title='Base (blue), Common (black) and New (beige)' style="cursor: pointer" opt=1 class="img-swap" height="24px"
         align="middle" src="/images/aub_on.png">
    <img title='Base (blue) and Common (black)' style="cursor: pointer" opt=2 height="24px" class="img-swap" align="middle"
         src="/images/a_off.png">
    <img title='Common (black) and New (beige)' style="cursor: pointer" opt=3 class="img-swap" height="24px" align="top"
         src="/images/b_off.png">
    <select   style="height:30px;text-align: center;" class="filterinput" name="tree-view-type" id="tree-view-type">
        <option  value="backtrace">Backtrace view</option>
        <option   value="calltree">Call tree view</option>
    </select>
    <label>Profile: </label>
    <select   style="height:30px;text-align: center;" class="filterinput" name="event-type" id="event-type">

    </select>
    <input  style="height:30px;text-align: center;" class="filterinput" type='text' id='search' value='' size='35'
           onkeypress="if(event.keyCode == 13) document.getElementById('searchtree').click()">
    <a title='Search' id="searchtree" href='javascript:search()'><i style="font-size:18px" class="fa fa-search" aria-hidden="true"></i></a>&nbsp;&nbsp;
    <span title="Exclude samples below threshold %">Threshold</span>: <input  style="height:30px;text-align: center;" class="filterinput" type='text' id='threshold' value='0.01' size='5'
                                                                             onkeypress="if(event.keyCode == 13) javascript:refreshTree()">
    <a title='Redo' href='javascript:refreshTree()'><i style="font-size:18px" class="fa fa-repeat" aria-hidden="true"></i></a>
    <span class="hide" id="framefilterId" title="filter">Filter: <input  style="height:30px;text-align: center;" class="filterinput" type='text' id='framefilter' value='' size='10'
                                                                        onkeypress="if(event.keyCode == 13) javascript:frameFilter()">
           <a title='Redo' href='javascript:frameFilter()'><i style="font-size:18px" class="fa fa-filter" aria-hidden="true"></i></a></span>
</div>
<div style="overflow: auto; padding-left: 0px; max-height: 900px; width: 100%;" class="cct-customized-scrollbar">
    <ul class="tree">
        <!-- STUFF!! -->
    </ul>
</div>