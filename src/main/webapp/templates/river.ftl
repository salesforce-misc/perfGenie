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
    <select   style="height:30px;text-align: center;" class="filterinput" name="event-type-river" id="event-type-river">

    </select>

</div>
<div id="riverview" style="width:75%; min-height: 900px; paddingt-left: 0px" class="row no-padding">
</div>

<script>
    $("#event-type-river").on("change", (event) => {
        handleEventTypeChange($("#event-type-river").val());
    });

    function  updateProfilerViewRiver(level){
        clearPlotData();
        riverPlot();
    }
    let bucketTotal = [];
    let useTimeslots=true;
    let surfaceDataTmp = {};
    let surfaceData = {};
    let surfaceDataOrder = [];
    let surfaceDataOrderTmp = {};
    let gotSurfaceData = false;
    let chunkCount = 0;
    let thresholdCount = 0.01;
    let totalSize = 0;
    let yToSurefaceOrderMap = {};
    let  NewsurfaceDataOrder     = [];
    var z_data=[];
    let parseData = false;
    let plotOption = 4;
    let plotDepth = 0;
    let onlyStacks = false;
    let sortedPlotOrder = [];
    let newplotdata = undefined;
    let plotdata = [];
    function clearPlotData(){
        bucketTotal = [];
        useTimeslots=true;
        surfaceDataTmp = {};
        surfaceData = {};
        surfaceDataOrder = [];
        surfaceDataOrderTmp = {};
        gotSurfaceData = false;
        chunkCount = 0;
        thresholdCount = 0.01;
        totalSize = 0;
        yToSurefaceOrderMap = {};
        NewsurfaceDataOrder     = [];
        z_data=[];
        parseData = false;
        plotOption = 4;
        plotDepth = 0;
        onlyStacks = false;
        sortedPlotOrder = [];
        newplotdata = undefined;
        plotdata = [];
    }

    function getTreeStackTmp(tree, stackid, filterTree, size) {
        if (tree['tree'] !== undefined) {
            tree = tree['tree'];
        }
        totalSize = tree.sz;

        if (tree.sm[stackid] != undefined  && tree.ch[tree.sm[stackid]].sm[stackid] !== undefined){//} && tree.sm[stackid] < 1) {

            let bseJsonTree = tree.ch[tree.sm[stackid]];

            //handle single frame case
            if(bseJsonTree['ch'] == null || bseJsonTree['ch'].length == 0){
                //addFrameV1(bseJsonTree['nm'], size, size, filterTree);
                return;
            }else {
                let arr = [];
                arr.push(tree.sm[stackid]);
                let res = getStackTmp(tree.ch[tree.sm[stackid]], filterTree, arr, size, stackid, false);
                return res;
            }
        }
    }



    function getData(baseJsonTree,arr){
        if (baseJsonTree['ch'] == undefined) {
            if(baseJsonTree['sz'] > thresholdCount){

                let firstKey =  Object.keys( baseJsonTree['sm'])[0];
                let key = "";
                for (let i = 0; i < arr.length; i++) {
                    if(i==0){
                        key = arr[i];
                    }else {
                        key = key + ":" + arr[i];
                    }
                }
                //key = key + ":" + firstKey;
                for (var key1 in baseJsonTree['sm']) {
                    let tmpKey = key + ":" + key1;
                    if(gotSurfaceData) {
                        if (surfaceData[tmpKey] == undefined) {
                            surfaceData[tmpKey] = [];
                            surfaceData[tmpKey].push(baseJsonTree['sz'] + ":" + chunkCount);
                        } else {
                            surfaceData[tmpKey].push(baseJsonTree['sz'] + ":" + chunkCount);
                        }
                    }
                    if(!gotSurfaceData){
                        surfaceDataOrderTmp[tmpKey]=baseJsonTree['sz'];
                        surfaceDataOrder.push(tmpKey);
                    }
                }


            }
        }else if(baseJsonTree['ch'].length > 1) {
            if(baseJsonTree['sz'] > thresholdCount){
                let key = "";
                for (let i = 0; i < arr.length; i++) {
                    if(i==0){
                        key = arr[i];
                    }else {
                        key = key + ":" + arr[i];
                    }
                }
                if(gotSurfaceData) {
                    if (surfaceData[key] == undefined) {
                        surfaceData[key] = [];
                        surfaceData[key].push(baseJsonTree['sz']+":" + chunkCount);
                    } else {
                        surfaceData[key].push(baseJsonTree['sz']+":" + chunkCount);
                    }
                }
                if(!gotSurfaceData) {
                    surfaceDataOrderTmp[key]=baseJsonTree['sz'];
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
                if(100.0*(baseJsonTree['sz']/totalSize) >= thresholdCount) {
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

                if(!res && res1){
                    res=true;
                }
            }
            if(res && baseJsonTree['ch'].length > 1) {
                if(100.0*(baseJsonTree['sz']/totalSize) >= thresholdCount){
                    let key = "";
                    for (let i = 0; i < arr.length; i++) {
                        if(i==0){
                            key = arr[i];
                        }else {
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
                if(100.0*(baseJsonTree['sz']/totalSize) >= thresholdCount) {
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


    function riverPlot() {
        console.log("riverPlot");
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
                //'order= ' + plotdata[data.points[i].y][plotdata[data.points[i].y].length-2] + '\n';
                let tree = getContextTree(1, getEventType());
                if (tree['tree'] !== undefined) {
                    tree = tree['tree'];
                }
                let order = data.points[i].data.path.split(":");
                let stack = "";
                for (let i = 0; i < order.length; i++) {
                    if (tree.ch != null && tree.ch[Number(order[i])] != undefined) {
                        tree = tree.ch[Number(order[i])];
                        stack = stack + "<tr><td class='plotstacktd'>" + getFrameName(tree['nm'])+ "</td><tr>";
                        while (tree.ch != null && tree.ch.length == 1) {
                            tree = tree.ch[0];
                            stack = stack + "<tr><td class='plotstacktd'>" + getFrameName(tree['nm']) + "</td><tr>";
                        }
                    } else {
                        stack = stack + "<tr><td class='plotstacktd'>stackID:" + Number(order[i]) + "</td><tr>";
                    }
                }
                pts = pts  + stack ;
            }
            pts = pts + "</table>";
            createRiverModal("river-model-guid", pts);
            //alert(pts);
        });

    }

    function sortPlotData(){
        let baseJsonTree = getContextTree(1, getEventType());
        if(baseJsonTree.meta.data != undefined){
            newplotdata = JSON.parse(baseJsonTree.meta.data);
        }

        for(let i=0; i< newplotdata.pathList.length; i++) {
            sortedPlotOrder.push(i);
        }
        sortedPlotOrder.sort(function(x, y) {
            if (newplotdata.data[x][0] > newplotdata.data[y][0]) {
                return -1;
            }
            if (newplotdata.data[x][0] < newplotdata.data[y][0]) {
                return 1;
            }
            return 0;
        });
    }

    function getAreaData(){

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
        for(let i=0; i< sortedPlotOrder.length; i++) {
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

    function getplotData(){

        let tmpdata = [];

        let index = 0;
        for(let i=0; i< sortedPlotOrder.length; i++) {
            tmpdata[index] = [];
            let aindex = sortedPlotOrder[i];
            let order = newplotdata.pathList[aindex].split(":");
            //if ( newplotdata.pathList[aindex].startsWith("0") || newplotdata.pathList[aindex].startsWith("1")) {
            for (let j = 0; j < newplotdata.data[aindex].length; j++) {
                tmpdata[index].push((100 * newplotdata.data[aindex][j] / newplotdata.chunkSamplesTotalList[j]));
            }
            yToSurefaceOrderMap[index] = i;
            index++;
            //}
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
        } /* end if(window.MSBlobBuilder) */



        if ('download' in a) { //FF20, CH19
            a.setAttribute("download", n);
            a.innerHTML = "downloading...";
            D.body.appendChild(a);
            setTimeout(function() {
                var e = D.createEvent("MouseEvents");
                e.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
                a.dispatchEvent(e);
                D.body.removeChild(a);
            }, 66);
            return true;
        }; /* end if('download' in a) */



        //do iframe dataURL download: (older W3)
        var f = D.createElement("iframe");
        D.body.appendChild(f);
        f.src = "data:" + (A[2] ? A[2] : "application/octet-stream") + (window.btoa ? ";base64" : "") + "," + (window.btoa ? window.btoa : escape)(strData);
        setTimeout(function() {
            D.body.removeChild(f);
        }, 333);
        return true;
    }

    function downloadPlData(){
        let str = "[";

        for(let i = 0; i< z_data.length; i++){
            let row = "";
            for(let j=0; j< z_data[i].length; j++) {
                if(j==0){
                    row =  z_data[i][j];
                }else if (j == z_data[i].length - 2) {
                    row = row + ",\"" + z_data[i][j] + "\"";
                } else {
                    row = row + "," + z_data[i][j];
                }
            }
            if(i == z_data.length-1){
                str = str + "[" + row + "]";
            }else{
                str = str + "[" + row + "],";
            }
        }
        str = str + "];";
        downloadPlotData(str,'filename.txt', 'text/plain');
    }
</script>

