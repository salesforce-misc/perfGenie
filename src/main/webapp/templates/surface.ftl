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
    <select   style="height:30px;text-align: center;" class="filterinput" name="event-type-surface" id="event-type-surface">

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
        $('#modals-guid')[0].innerHTML = "<div   id='" + modalId + "' class='modal fade' tabindex='-1' role='dialog' aria-labelledby='cctmodel' aria-hidden='true'>" +
            "<div class='modal-dialog'  role=\"document\">" +
            "<div class='modal-content'>" +
            "<div id='data-modal-body' class='modal-body' style='overflow: auto'>" +
            "<ul class='tree'>" +
            "<li>" + data + "</li>" +
            "</ul>"+
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
        $('#'+modalId).modal('hide');
    }

    function updateProfilerViewSurface(level) {
        clearPlotData();
        surfacePlot();
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
                //addFrameV1(bseJsonTree['nm'], size, size, filterTree);
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
                //key = key + ":" + firstKey;
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
        // return;
        console.log("surfacePlot");
        //for(i=0;i<5;i++){
        //if(parseData) {
        //genSurfaceData();
        //}else{
        sortPlotData();
        //}
        //}

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
                            stack = stack +"<tr><td class='plotstacktd'>" + getFrameName(tree['nm'])+ "</td><tr>";
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
            //alert(pts);
        });
    }

    function sortPlotData() {
        let baseJsonTree = getContextTree(1, getEventType());
        if (baseJsonTree.meta.data != undefined) {
            newplotdata = JSON.parse(baseJsonTree.meta.data);
        }

        for (let i = 0; i < newplotdata.pathList.length; i++) {
            sortedPlotOrder.push(i);
        }
        sortedPlotOrder.sort(function (x, y) {
            if (newplotdata.data[x][0] > newplotdata.data[y][0]) {
                return -1;
            }
            if (newplotdata.data[x][0] < newplotdata.data[y][0]) {
                return 1;
            }
            return 0;
        });
    }
/*
    function getAreaData() {

        let tmpdata = [];
        let tmpx = [];

        for (let j = 0; j < newplotdata.data[0].length; j++) {
            tmpx.push(j);
        }
        var trace = {
            'x': tmpx,
            'y': newplotdata.cpuSamplesList,
            mode: 'lines',
            line: {
                color: 'red',
                width: 3
            },
            name: "CPU%"
        };
        tmpdata.push(trace);
        //for(let i=0; i< newplotdata.pathList.length; i++) {
        for (let i = 0; i < sortedPlotOrder.length; i++) {
            //let order = newplotdata.pathList[i].split(":");
            let index = sortedPlotOrder[i];
            //if ( newplotdata.pathList[index].startsWith("0") || newplotdata.pathList[index].startsWith("1")) {
            let trace = {};
            trace['x'] = [];
            trace['y'] = [];

            trace['stackgroup'] = 'one';
            trace['mode'] = 'none';
            trace['path'] = newplotdata.pathList[index];

            for (let j = 0; j < newplotdata.data[index].length; j++) {
                trace['x'].push(j);
                // trace['y'].push((100 * plotdata[i][j] / plotdata[i][plotdata[i].length - 1]));
                trace['y'].push((100 * newplotdata.data[index][j] / newplotdata.chunkSamplesTotalList[j]));
            }
            tmpdata.push(trace);
            //}
        }

        return tmpdata;
    }
*/
    function downloadPlotData(strData, strFileName, strMimeType) {
        var D = document,
            A = arguments,
            a = D.createElement("a"),
            d = A[0],
            n = A[1],
            t = A[2] || "text/plain";

        //build download link:
        a.href = "data:" + strMimeType + "charset=utf-8," + escape(strData);


        if (window.MSBlobBuilder) { // IE10
            var bb = new MSBlobBuilder();
            bb.append(strData);
            return navigator.msSaveBlob(bb, strFileName);
        } /* end if(window.MSBlobBuilder) */


        if ('download' in a) { //FF20, CH19
            a.setAttribute("download", n);
            a.innerHTML = "downloading...";
            D.body.appendChild(a);
            setTimeout(function () {
                var e = D.createEvent("MouseEvents");
                e.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
                a.dispatchEvent(e);
                D.body.removeChild(a);
            }, 66);
            return true;
        }
        ; /* end if('download' in a) */


        //do iframe dataURL download: (older W3)
        var f = D.createElement("iframe");
        D.body.appendChild(f);
        f.src = "data:" + (A[2] ? A[2] : "application/octet-stream") + (window.btoa ? ";base64" : "") + "," + (window.btoa ? window.btoa : escape)(strData);
        setTimeout(function () {
            D.body.removeChild(f);
        }, 333);
        return true;
    }
</script>


