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
    <select style="height:30px;text-align: center;" class="filterinput" name="event-type-river" id="event-type-river">
    </select>
</div>
<div id="riverview" style="width:75%; min-height: 900px; paddingt-left: 0px" class="row no-padding">
</div>

<script>
    $("#event-type-river").on("change", (event) => {
        handleEventTypeChange($("#event-type-river").val());
    });

    function updateProfilerViewRiver(level) {
        addTabNote(false,"");

        clearPlotData();
        $("#riverview").html("");
        if (compareTree) {
            addTabNote(true,"This view is not supported when Compare option is selected.")
        } else {
            riverPlot();
        }
    }

    let bucketTotal = [];
    let useTimeslots = true;
    let surfaceDataTmp = {};
    let surfaceData = {};
    let surfaceDataOrder = [];
    let surfaceDataOrderTmp = {};
    let gotSurfaceData = false;
    let chunkCount = 0;
    let thresholdCount = 0.01;
    let totalSize = 0;
    let yToSurefaceOrderMap = {};
    let NewsurfaceDataOrder = [];
    var z_data = [];
    let parseData = false;
    let plotOption = 4;
    let plotDepth = 0;
    let onlyStacks = false;
    let sortedPlotOrder = [];
    let newplotdata = undefined;
    let plotdata = [];

    function clearPlotData() {
        bucketTotal = [];
        useTimeslots = true;
        surfaceDataTmp = {};
        surfaceData = {};
        surfaceDataOrder = [];
        surfaceDataOrderTmp = {};
        gotSurfaceData = false;
        chunkCount = 0;
        thresholdCount = 0.01;
        totalSize = 0;
        yToSurefaceOrderMap = {};
        NewsurfaceDataOrder = [];
        z_data = [];
        parseData = false;
        plotOption = 4;
        plotDepth = 0;
        onlyStacks = false;
        sortedPlotOrder = [];
        newplotdata = undefined;
        plotdata = [];
    }

    function riverPlot() {
        console.log("riverPlot");
        let baseJsonTree = getContextTree(1, getEventType());
        if (baseJsonTree.meta == undefined || baseJsonTree.meta.data == undefined || baseJsonTree.meta.data.length < 3) {
            addTabNote(true,"Data not available to show this view, check if isExperimental is enabled in config.properties")
            return;
        }
        //let selectedLevel = getSelectedLevel(getActiveTree(getEventType(), false));
        let selectedLevel = getSelectedLevel(getTree(1, getEventType()));
        if(selectedLevel !== FilterLevel.UNDEFINED){
            addTabNote(true,"Filters not applied on this view.")
        }

        sortPlotData();

        layout = {
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
            }
        }

        Plotly.newPlot('riverview', getAreaData(), layout);
        var myPlot1 = document.getElementById('riverview');
        myPlot1.on('plotly_click', function (data) {

            var pts = '';
            pts = '<table>'
            for (var i = 0; i < data.points.length; i++) {
                pts += '<tr><td class="plotstacktd">x = ' + data.points[i].x + ' , ' +
                    'y = ' + data.points[i].y.toPrecision(4) + ' , ' +
                    '(path = ' + data.points[i].data.path + ')</td></tr>';
                let tree = getContextTree(1, getEventType());
                if (tree['tree'] !== undefined) {
                    tree = tree['tree'];
                }
                let order = data.points[i].data.path.split(":");
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
            pts = pts + "</table>";
            createRiverModal("river-model-guid", pts);
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
                color: 'blue',
                width: 3
            },
            name: "Application CPU%"
        };
        tmpdata.push(trace);
        for (let i = 0; i < sortedPlotOrder.length; i++) {
            let index = sortedPlotOrder[i];
            let trace = {};
            trace['x'] = [];
            trace['y'] = [];

            trace['stackgroup'] = 'one';
            trace['mode'] = 'none';

            trace['path'] = newplotdata.pathList[index];

            for (let j = 0; j < newplotdata.data[index].length; j++) {
                trace['x'].push(j);
                trace['y'].push((100 * newplotdata.data[index][j] / newplotdata.chunkSamplesTotalList[j]) + 0.01);
            }
            tmpdata.push(trace);
        }
        return tmpdata;
    }

    function getplotData() {
        let tmpdata = [];
        let index = 0;
        for (let i = 0; i < sortedPlotOrder.length; i++) {
            tmpdata[index] = [];
            let aindex = sortedPlotOrder[i];
            for (let j = 0; j < newplotdata.data[aindex].length; j++) {
                tmpdata[index].push((100 * newplotdata.data[aindex][j] / newplotdata.chunkSamplesTotalList[j]));
            }
            yToSurefaceOrderMap[index] = i;
            index++;
        }
        return tmpdata;
    }

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
        }

        if ('download' in a) {
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

        var f = D.createElement("iframe");
        D.body.appendChild(f);
        f.src = "data:" + (A[2] ? A[2] : "application/octet-stream") + (window.btoa ? ";base64" : "") + "," + (window.btoa ? window.btoa : escape)(strData);
        setTimeout(function () {
            D.body.removeChild(f);
        }, 333);
        return true;
    }

    function downloadPlData() {
        let str = "[";

        for (let i = 0; i < z_data.length; i++) {
            let row = "";
            for (let j = 0; j < z_data[i].length; j++) {
                if (j == 0) {
                    row = z_data[i][j];
                } else if (j == z_data[i].length - 2) {
                    row = row + ",\"" + z_data[i][j] + "\"";
                } else {
                    row = row + "," + z_data[i][j];
                }
            }
            if (i == z_data.length - 1) {
                str = str + "[" + row + "]";
            } else {
                str = str + "[" + row + "],";
            }
        }
        str = str + "];";
        downloadPlotData(str, 'filename.txt', 'text/plain');
    }
</script>

