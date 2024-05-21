<script>
    /*
* Copyright (c) 2022, Salesforce.com, Inc.
* All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
* For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/
</script>

<div  class='ui-widget' style="padding-left: 25px;">
    <label>Profile: </label>
    <select style="height:30px;text-align: center;" class="filterinput" name="event-type-surface"
            id="event-type-surface">
    </select>
</div>
<div id="areaplot" style="width:90%;min-height: 900px; paddingt-left: 0px" class="row no-padding">
</div>
<style>
    .plotstacktable {
        border-collapse: collapse;
    }

    /* And this to your table's `td` elements. */
    .plotstacktd {
        padding: 0 !important;
        margin: 0 !important;
    }
</style>

<script>
    $("#event-type-surface").on("change", (event) => {
        handleEventTypeChange($("#event-type-surface").val());
    });

    function createRiverModal(modalId, data) {
        $('#modals-guid')[0].innerHTML = "<div  id='" + modalId + "' class='modal fade' tabindex='-1' role='dialog' aria-labelledby='cctmodel' aria-hidden='true'>" +
            "<div  class='modal-dialog'  role=\"document\">" +
            "<div class='modal-content'>" +
            "<div id='data-modal-body' class='modal-body' style='overflow: auto'>" +
            "<ul class='tree'>" +
            "<li>" + data + "</li>" +
            "</ul>" +
            "</div>" +
            "</div>" +
            "</div>" +
            "</div>";
        loadRiverModal(modalId);
    }

    function loadRiverModal(modalId) {
        $('#' + modalId).modal('show');
    }

    function unLoadRiverModal(modalId) {
        $('#' + modalId).modal('hide');
    }

    function updateProfilerViewSurface(level) {
        addTabNote(false,"");
        clearPlotData();
        $("#areaplot").html("");
        if (compareTree) {
            addTabNote(true,"This view is not supported when Compare option is selected.")
        } else {
            surfacePlot();
        }
    }

    function getTreeStackTmp(tree, stackid, filterTree, size) {
        if (tree['tree'] !== undefined) {
            tree = tree['tree'];
        }
        totalSize = tree.sz;

        if (tree.sm[stackid] != undefined && tree.ch[tree.sm[stackid]].sm[stackid] !== undefined) {//} && tree.sm[stackid] < 1) {

            let bseJsonTree = tree.ch[tree.sm[stackid]];

            //handle single frame case
            if (bseJsonTree['ch'] == null || bseJsonTree['ch'].length == 0) {
                return;
            } else {
                let arr = [];
                arr.push(tree.sm[stackid]);
                let res = getStackTmp(tree.ch[tree.sm[stackid]], filterTree, arr, size, stackid, false);
                return res;
            }
        }
    }

    function getData(baseJsonTree, arr) {
        if (baseJsonTree['ch'] == undefined) {
            if (baseJsonTree['sz'] > thresholdCount) {

                let firstKey = Object.keys(baseJsonTree['sm'])[0];
                let key = "";
                for (let i = 0; i < arr.length; i++) {
                    if (i == 0) {
                        key = arr[i];
                    } else {
                        key = key + ":" + arr[i];
                    }
                }
                for (var key1 in baseJsonTree['sm']) {
                    let tmpKey = key + ":" + key1;
                    if (gotSurfaceData) {
                        if (surfaceData[tmpKey] == undefined) {
                            surfaceData[tmpKey] = [];
                            surfaceData[tmpKey].push(baseJsonTree['sz'] + ":" + chunkCount);
                        } else {
                            surfaceData[tmpKey].push(baseJsonTree['sz'] + ":" + chunkCount);
                        }
                    }
                    if (!gotSurfaceData) {
                        surfaceDataOrderTmp[tmpKey] = baseJsonTree['sz'];
                        surfaceDataOrder.push(tmpKey);
                    }
                }
            }
        } else if (baseJsonTree['ch'].length > 1) {
            if (baseJsonTree['sz'] > thresholdCount) {
                let key = "";
                for (let i = 0; i < arr.length; i++) {
                    if (i == 0) {
                        key = arr[i];
                    } else {
                        key = key + ":" + arr[i];
                    }
                }
                if (gotSurfaceData) {
                    if (surfaceData[key] == undefined) {
                        surfaceData[key] = [];
                        surfaceData[key].push(baseJsonTree['sz'] + ":" + chunkCount);
                    } else {
                        surfaceData[key].push(baseJsonTree['sz'] + ":" + chunkCount);
                    }
                }
                if (!gotSurfaceData) {
                    surfaceDataOrderTmp[key] = baseJsonTree['sz'];
                    surfaceDataOrder.push(key);
                }
            }
        }
        if (baseJsonTree['ch'] != undefined && baseJsonTree['ch'].length > 0) {
            for (let treeIndex = 0; treeIndex < baseJsonTree['ch'].length; treeIndex++) {
                let tmparr = [...arr];
                if (baseJsonTree['ch'] == undefined || baseJsonTree['ch'].length > 1) {
                    tmparr.push(treeIndex);
                }
                getData(baseJsonTree['ch'][treeIndex], tmparr);
            }
        }
    }

    function getStackTmp(baseJsonTree, filterTree, arr, size, stackid, flag) {
        if (baseJsonTree['ch'] == null || baseJsonTree['ch'].length == 0) {
            if (flag && baseJsonTree.sm[stackid] !== undefined) {
                if (100.0 * (baseJsonTree['sz'] / totalSize) >= thresholdCount) {
                    let key = "";
                    for (let i = 0; i < arr.length; i++) {
                        if (i == 0) {
                            key = arr[i];
                        } else {
                            key = key + ":" + arr[i];
                        }
                    }
                    key = key + ":" + stackid;
                    if (surfaceDataTmp[key] == undefined) {
                        surfaceDataTmp[key] = size;
                    } else {
                        surfaceDataTmp[key] = surfaceDataTmp[key] + size;
                    }
                }
                return true;
            }
            return false;
        } else {
            let res = false;
            for (let treeIndex = 0; treeIndex < baseJsonTree['ch'].length; treeIndex++) {
                let tmparr = [...arr];
                if (baseJsonTree['ch'] == undefined || baseJsonTree['ch'].length > 1) {
                    tmparr.push(treeIndex);
                }

                let res1 = getStackTmp(baseJsonTree['ch'][treeIndex], filterTree, tmparr, size, stackid, true);

                if (!res && res1) {
                    res = true;
                }
            }
            if (res && baseJsonTree['ch'].length > 1) {
                if (100.0 * (baseJsonTree['sz'] / totalSize) >= thresholdCount) {
                    let key = "";
                    for (let i = 0; i < arr.length; i++) {
                        if (i == 0) {
                            key = arr[i];
                        } else {
                            key = key + ":" + arr[i];
                        }
                    }

                    if (surfaceDataTmp[key] == undefined) {
                        surfaceDataTmp[key] = size;
                    } else {
                        surfaceDataTmp[key] = surfaceDataTmp[key] + size;
                    }

                }
            }
            if (flag && baseJsonTree.sm[stackid] !== undefined) {
                if (100.0 * (baseJsonTree['sz'] / totalSize) >= thresholdCount) {
                    let key = "";
                    for (let i = 0; i < arr.length; i++) {
                        if (i == 0) {
                            key = arr[i];
                        } else {
                            key = key + ":" + arr[i];
                        }
                    }
                    key = key + ":" + stackid;
                    if (surfaceDataTmp[key] == undefined) {
                        surfaceDataTmp[key] = size;
                    } else {
                        surfaceDataTmp[key] = surfaceDataTmp[key] + size;
                    }
                }
                return true;
            }
            return res;
        }
    }

    function surfacePlot() {
        console.log("surfacePlot");
        let baseJsonTree = getContextTree(1, getEventType());
        if (baseJsonTree.meta == undefined || baseJsonTree.meta.data == undefined || baseJsonTree.meta.data.length < 3) {
            addTabNote(true,"Data not available to show this view, check if isExperimental is enabled in config.properties")
            return;
        }
        //let selectedLevel = getSelectedLevel(getActiveTree(getEventType(), false));
        let selectedLevel = getSelectedLevel(getTree(1, getEventType()));//both trees should be at the same level
        if(selectedLevel !== FilterLevel.UNDEFINED){
            addTabNote(true,"Filters not applied on this view.")
        }

        sortPlotData();
        z_data = getplotData();
        var data = [{
            z: z_data,
            type: 'surface'
        }];

        var layout = {
            title: 'profile surface hotspot',
            autosize: true,

            height: 900,
            margin: {
                l: 65,
                r: 50,
                b: 65,
                t: 90,
            },
            scene: {
                xaxis: {
                    title: 'Time',
                    titlefont: {
                        color: 'black',
                        family: 'Arial, Open Sans',
                        size: 12
                    }
                },
                yaxis: {
                    title: 'Stack path',
                    titlefont: {
                        color: 'black',
                        family: 'Arial, Open Sans',
                        size: 12
                    }
                },
                zaxis: {
                    title: 'Significance',
                    titlefont: {
                        color: 'black',
                        family: 'Arial, Open Sans',
                        size: 12
                    }
                }
            }
        };
        Plotly.newPlot('areaplot', data, layout);

        var myPlot = document.getElementById('areaplot');
        myPlot.on('plotly_click', function (data) {
            var pts = '';
            if (parseData) {
                for (var i = 0; i < data.points.length; i++) {
                    pts = 'x = ' + data.points[i].x + '\n' +
                        'y = ' + data.points[i].y.toPrecision(4) + '\n' +
                        'z= ' + data.points[i].z.toPrecision(4) + '\n' +
                        'i= ' + yToSurefaceOrderMap[data.points[i].y] + '\n' +
                        'order= ' + surfaceDataOrder[yToSurefaceOrderMap[data.points[i].y]] + '\n' +
                        'order data= ' + surfaceData[surfaceDataOrder[yToSurefaceOrderMap[data.points[i].y]]] + '\n';
                }
            } else {
                pts = '<table class="plotstacktable">'
                for (var i = 0; i < data.points.length; i++) {
                    pts += '<tr><td class="plotstacktd"> x = ' + data.points[i].x + ' , ' +
                        'y = ' + data.points[i].y.toPrecision(4) + ' , ' +
                        'z= ' + data.points[i].z.toPrecision(4) + ' &nbsp;' +
                        '(path= ' + newplotdata.pathList[sortedPlotOrder[yToSurefaceOrderMap[data.points[i].y]]] + ')</td></tr>';
                    let tree = getContextTree(1, getEventType());
                    if (tree['tree'] !== undefined) {
                        tree = tree['tree'];
                    }
                    let order = newplotdata.pathList[sortedPlotOrder[yToSurefaceOrderMap[data.points[i].y]]].split(":");
                    let stack = "";
                    for (let i = 0; i < order.length; i++) {
                        if (tree.ch != null && tree.ch[Number(order[i])] != undefined) {
                            tree = tree.ch[Number(order[i])];
                            stack = stack + "<tr><td class='plotstacktd'>" + getFrameName(tree['nm']) + "</td><tr>";
                            while (tree.ch != null && tree.ch.length == 1) {
                                tree = tree.ch[0];
                                stack = stack + "<tr><td class='plotstacktd'>" + getFrameName(tree['nm']) + "</td><tr>";
                            }
                        } else {
                            stack = stack + "<tr><td class='plotstacktd'>stackID:" + Number(order[i]) + "</td><tr>";
                        }
                    }
                    pts = pts + stack;
                }
            }
            pts = pts + "</table>";
            createRiverModal("surface-model-guid", pts);
        });
    }
</script>