/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

let metaData1 = undefined;
let metaData2 = undefined;
let tenantData1 = undefined;
let tenantData2 = undefined;
let instanceData1 = undefined;
let instanceData2 = undefined;
let startTime1 = undefined;
let endTime1 = undefined;
let startTime2 = undefined;
let endTime2 = undefined;
let host1 = undefined;
let host2 = undefined;
let tenant1 = undefined;
let tenant2 = undefined;
let profile1 = undefined;
let profile2 = undefined;
let dateFormat = 'YYYY-MM-DD HH:mm:ss.SSS';
let maxTimeRange = 60 * 60 * 1000;
let isSFDC = false;
let jfrprofiles1 = {};
let jfrprofiles2 = {};
let jfrevents1 = {};
let jfrevents2 = {};
let otherEvents1 = {};
let otherEvents2 = {};
let otherEventsFetched = {};
const urlParams = new URLSearchParams(window.location.search);
let otherEventsSupported = {"top":true, "ps":true};//{"top":true, "ps":true, "pidstat":true, "monitor":true,};
let jstackcolors = ["#29b193","#ee5869","#f6ab60","#377bb5"];
let jstackcolorsmap ={"RUNNABLE":9,"BLOCKED":10,"WAITING":11,"TIMED_WAITING":12};
let jstackidcolorsmap ={9:"RUNNABLE",10:"BLOCKED",11:"WAITING",12:"TIMED_WAITING"};
let profilecolors =["lightseagreen","#bbbb0d","deeppink","brown","dodgerblue","slateblue","blue","green","yellow","#29b193","#ee5869","#f6ab60","#377bb5"];
let knowprofilecolormap = {"jfr_dump.json.gz":0,"jfr_dump_socket.json.gz":1,"jfr_dump_apex.json.gz":2, "jfr_dump_memory.json.gz":3, "json-jstack":4,"Jstack":4};
let dataSource = "genie";
let diagEvent = '';

let isZip = true;
function setSubmitDisabled(shouldDisable) {
    $("#submit-input").prop("disabled", shouldDisable);
}

function validateDateRange(index) {
    const startTimeE = document.getElementById("startpicker" + index);
    const endTimeE = document.getElementById("endpicker" + index);
    startTimeE.style.borderColor = null;
    endTimeE.style.borderColor = null;
    addInputNote(false,"");

    let startEpoch = eval("startTime" + index);
    let endEpoch = eval("endTime" + index);

    if (startEpoch > endEpoch) {
        addInputNote(true,"Start time is after end time")
        startTimeE.style.borderColor = "red";
        endTimeE.style.borderColor = "red";
        setSubmitDisabled(true);
        return false;
    }

    if ((endEpoch - startEpoch) > maxTimeRange) {
        addInputNote(true,"Time ranges are limited to 1 hour. Given " + moment.utc(startEpoch).format('YYYY-MM-DD HH:mm:ss') + " - " + moment.utc(endEpoch).format('YYYY-MM-DD HH:mm:ss'));
        startTimeE.style.borderColor = "red";
        endTimeE.style.borderColor = "red";
        setSubmitDisabled(true);
        return false;
    }

    setSubmitDisabled(false);
    return true;
}

function addInputNote(toggle, msg){
    if(toggle){
        if($( "#input-info" ).css("display") === "none"){
            $( "#input-info-text" ).html(msg);
            $( "#input-info" ).toggle( "slide", { direction: "left" }, 500 );
        }
    }else{
        if($( "#input-info-text" ).html() != "") {
            $("#input-info").css("display", "none");
            $("#input-info-text").html("");
        }
    }
}

$(document).ready(function () {

    dataSource = urlParams.get('dataSource') || "genie";
    startTime1 = Number(urlParams.get('startTime1')) || moment.utc(moment.utc().subtract('minute', 10).format('YYYY-MM-DD HH:mm:ss')).valueOf();
    startTime2 = Number(urlParams.get('startTime2')) || moment.utc(moment.utc().subtract('minute', 24 * 60 + 10).format('YYYY-MM-DD HH:mm:ss')).valueOf();
    endTime1 = Number(urlParams.get('endTime1')) || moment.utc(moment.utc().format('YYYY-MM-DD HH:mm:ss')).valueOf();
    endTime2 = Number(urlParams.get('endTime2')) || moment.utc(moment.utc().subtract('minute', 24 * 60).format('YYYY-MM-DD HH:mm:ss')).valueOf();
    host1 = urlParams.get('host1') || undefined;
    host2 = urlParams.get('host2') || undefined;
    tenant1 = urlParams.get('tenant1') || undefined;
    tenant2 = urlParams.get('tenant2') || undefined;
    profile1 = urlParams.get('profile1') || undefined;
    profile2 = urlParams.get('profile2') || undefined;
    diagEvent = urlParams.get('diagEvent') || '';
    let tempstr = urlParams.get('types') || undefined;
    if (tempstr != undefined) {
        let tokens = tempstr.split("\:");
        tokens.forEach(tok => {
            if (tok != "") {
                jfrprofiles1[tok] = true;
            }
        });
    }
    tempstr = urlParams.get('events') || undefined;
    if (tempstr != undefined) {
        let tokens = tempstr.split("\:");
        tokens.forEach(tok => {
            if (tok != "") {
                jfrevents1[tok] = true;
            }
        });
    }
    tempstr = urlParams.get('otherEvents') || undefined;
    if (tempstr != undefined) {
        let tokens = tempstr.split("\:");
        tokens.forEach(tok => {
            if (tok != "") {
                otherEvents1[tok] = true;
            }
        });
    }


    $("#startpicker1").val(moment.utc(startTime1).format('YYYY-MM-DD HH:mm:ss'));
    $("#endpicker1").val(moment.utc(endTime1).format('YYYY-MM-DD HH:mm:ss'));
    $("#startpicker2").val(moment.utc(startTime2).format('YYYY-MM-DD HH:mm:ss'));
    $("#endpicker2").val(moment.utc(endTime2).format('YYYY-MM-DD HH:mm:ss'));

    $("#tenant-input1").val(tenant1);
    $("#tenant-input2").val(tenant2);
    $("#host-input1").val(host1);
    $("#host-input2").val(host2);
    $("#bases1").val(profile1);
    $("#bases2").val(profile2);


    getTenantData1(getStart1(), getEnd1());
    getTenantData2(getStart2(), getEnd2());


    $("#startpicker1").change(function (event) {
        if (moment.utc($("#startpicker1").val()).valueOf() != startTime1) {
            startTime1 = moment.utc($("#startpicker1").val()).valueOf();
            if(validateDateRange(1)) {
                getTenantData1(startTime1, endTime1);
            }
        }
    });

    $("#startpicker2").change(function (event) {
        if (moment.utc($("#startpicker2").val()).valueOf() != startTime2) {
            startTime2 = moment.utc($("#startpicker2").val()).valueOf();
            if(validateDateRange(2)) {
                getTenantData2(startTime2, endTime2);
            }
        }
    });

    $("#endpicker1").change(function (event) {
        if (moment.utc($("#endpicker1").val()).valueOf() != endTime1) {
            endTime1 = moment.utc($("#endpicker1").val()).valueOf();
            if(validateDateRange(1)) {
                getTenantData1(startTime1, endTime1);
            }
        }
    });

    $("#endpicker2").change(function (event) {
        if (moment.utc($("#endpicker2").val()).valueOf() != endTime2) {
            endTime2 = moment.utc($("#endpicker2").val()).valueOf();
            if(validateDateRange(2)) {
                getTenantData2(startTime2, endTime2);
            }
        }
    });

    $("#tenant-input1").on("change", (event) => {
        tenant1 = $("#tenant-input1").val();
        host1 = undefined;
        profile1 = undefined;
        $("#hosts1").empty();
        $("#host-input1").val("");
        $("#bases1").empty();

        startTime1 = moment.utc($("#startpicker1").val()).valueOf();
        endTime1 = moment.utc($("#endpicker1").val()).valueOf();
        getInstanceData1(startTime1, endTime1, tenant1);
    });

    $("#tenant-input2").on("change", (event) => {
        tenant2 = $("#tenant-input2").val();
        host2 = undefined;
        profile2 = undefined;
        $("#hosts2").empty();
        $("#host-input2").val("");
        $("#bases2").empty();
        startTime2 = moment.utc($("#startpicker2").val()).valueOf();
        endTime2 = moment.utc($("#endpicker2").val()).valueOf();
        getInstanceData2(startTime2, endTime2, tenant2);
    });

    $("#host-input1").on("change", (event) => {
        host1 = $("#host-input1").val();
        profile1 = undefined;
        $("#bases1").empty();
        if(host1 != "") {
            startTime1 = moment.utc($("#startpicker1").val()).valueOf();
            endTime1 = moment.utc($("#endpicker1").val()).valueOf();
            getMetaData1(startTime1, endTime1, tenant1, host1);
        }
    });

    $("#host-input2").on("change", (event) => {
        host2 = $("#host-input2").val();
        profile2 = undefined;
        $("#bases2").empty();
        if(host2 != "") {
            startTime2 = moment.utc($("#startpicker2").val()).valueOf();
            endTime2 = moment.utc($("#endpicker2").val()).valueOf();
            getMetaData2(startTime2, endTime2, tenant2, host2);
        }
    });

    $("#bases1").on("change", (event) => {
        profile1 = $("#bases1").val();
    });

    $("#bases2").on("change", (event) => {
        profile2 = $("#bases2").val();
    });

    jQuery("#startpicker1").datetimepicker({
        format: 'Y-m-d H:i:s',
        formatDate: 'Y-m-d',
        formatTime: 'H:i',
        step: 5
    });

    jQuery("#endpicker1").datetimepicker({
        format: 'Y-m-d H:i:s',
        formatDate: 'Y-m-d',
        formatTime: 'H:i',
        step: 5
    });

    jQuery("#startpicker2").datetimepicker({
        format: 'Y-m-d H:i:s',
        formatDate: 'Y-m-d',
        formatTime: 'H:i',
        step: 5
    });

    jQuery("#endpicker2").datetimepicker({
        format: 'Y-m-d H:i:s',
        formatDate: 'Y-m-d',
        formatTime: 'H:i',
        step: 5
    });

    $("#submit-input").click(function () {
        if(validateDateRange(1) && validateDateRange(2)) {
            addInputToURL();
        }
    });
});

function submitTo() {
    window.location.reload(true);
}
function getTenantData1(start, end) {
    let URL = getTenantDataURL(start, end);
    showSpinner();
    $.ajax({
        url: URL, success: function (result) {
            hideSpinner();
            tenantData1 = result;
            updateTenantDropdown1(start, end);
        }
    });
}

function getTenantData2(start, end) {
    let URL = getTenantDataURL(start, end);
    showSpinner();
    $.ajax({
        url: URL, success: function (result) {
            hideSpinner();
            tenantData2 = result;
            updateTenantDropdown2(start, end);
        }
    });
}

function getInstanceData1(start, end, tenant) {
    let URL = getInstanceDataURL(start, end, tenant, tenantData1[tenant]);
    showSpinner();
    $.ajax({
        url: URL, success: function (result) {
            hideSpinner();
            instanceData1 = result;
            populateHostsSelector1(start, end, tenant);
        }
    });
}

function getInstanceData2(start, end, tenant) {
    let URL =getInstanceDataURL(start, end, tenant, tenantData2[tenant]);
    showSpinner();
    $.ajax({
        url: URL, success: function (result) {
            hideSpinner();
            instanceData2 = result;
            populateHostsSelector2(start, end, tenant);
        }
    });
}

function getMetaData1(start, end, tenant, host) {
    let URL = getMetaDataURL(start, end, tenant, host, instanceData1[host]);
    showSpinner();
    $.ajax({
        url: URL, success: function (result) {
            hideSpinner();
            metaData1 = result;
            populateIDs1(tenant, host);
            loadDiagData1();
        }
    });
}
function addUploadedContext(csv,name){
    let records = {};
    let header = {};
    header[name] = [];
    records[name] = {};

    let isContext = false;

    let lines = csv.split(/\r?\n/);
    let columnTypes = [];
    let checkUntil = 200
    let checkReached = 0;
    let spanIndex = -1;
    for(let i=0; i<lines.length;i++){
        if(i==0){
            header[name] = lines[i].split(/\,/);
            header[name][0] = "timestamp:timestamp";
            header[name][1] = "tid:text";
            for(let k=0; k<header[name].length; k++){
                columnTypes.push(0);
                if(header[name][k] == "runTime" || header[name][k] == "duration"){
                    spanIndex = k;
                    isContext = true;
                }
            }
        }else {
            if(lines[i].length !=0 ) {
                lines[i] = lines[i].replaceAll('\"', '');
                let record = lines[i].split(/\,/);
                for(let j=0; j< record.length;j++){
                    if(record[j] == ''){
                        record[j] = "NA";
                    }
                }
                record[0] = record[0].replaceAll('.', '');
                record[0] = Number(record[0]);//todo convert numbers for all measures
                if(spanIndex != -1){
                //    record[0] = record[0] - Number(record[spanIndex]); //if we use end timestamp
                }
                //record[1] = Number(record[1]);//tid
                if(records[name][record[1]] == undefined){
                    records[name][record[1]] = [];
                }
                records[name][record[1]].push({"record": record});
                if(i<checkUntil){
                    checkReached++;
                    for(let k=2; k<record.length; k++){
                        if(isNaN(record[k])){
                            columnTypes[k]++;
                        }
                    }
                }
            }
        }
    }
    for(let k=2; k<header[name].length; k++){
        if( columnTypes[k]/checkReached > 0.5){
            header[name][k] = header[name][k] + ":text";
        }else{
            header[name][k] = header[name][k] + ":number";
        }
    }
    for (let tid in  records[name]) {
        for (let k = 0; k < records[name][tid].length; k++) {
            for (let i = 2; i < records[name][tid][k].record.length; i++) {
                if (columnTypes[i]/checkReached <= 0.5) {
                    records[name][tid][k].record[i] = Number(records[name][tid][k].record[i]);
                }
            }
        }
    }
    let localContextData = getContextData(1);
    localContextData.header[name] = header[name];
    localContextData.records[name] = records[name];
    if(isContext) {
        $('#event-input').append($('<option>', {
            value: name,
            text: name
        }));

        Toastify({
            text: name + " context loaded",
            duration: 8000
        }).showToast();
    }else{
        otherEvents1[name] = true;

        $('#other-event-input').append($('<option>', {
            value: name,
            text: name
        }));

        Toastify({
            text: name + " data loaded",
            duration: 8000
        }).showToast();
    }
}
function loadDiagData1(){

    let localcontextData = getContextData(1);
    if(localcontextData == undefined || localcontextData.header == undefined){
        return;
    }

    let records = {};
    let header = {};

    for (let key in metaData1) {
        if(metaData1[key].metadata.name != undefined) {

            /*
            if(metaData1[key].metadata.name === "jfr"){
                if(metaData1[key].metadata["file-name"] == undefined) {
                    continue;
                }
                if( !metaData1[key].metadata["file-name"].includes(".jfr.gz")){
                    continue;
                }
            }*/

            if(!metaData1[key].metadata.name.includes("json") && (metaData1[key].metadata["file-name"] == undefined || (!metaData1[key].metadata["file-name"].includes("json") && !metaData1[key].metadata["file-name"].includes("monitor"))) ) {
                let diagnostics = []
                diagnostics.push(metaData1[key].timestampMillis);

                if(metaData1[key].metadata[".is-large-file"] != undefined && metaData1[key].metadata[".is-large-file"] == "true"){
                    diagnostics.push(metaData1[key].metadata["file-name"]);
                    diagnostics.push(1);
                    //1_048_576
                    diagnostics.push(metaData1[key].metadata.guid);
                    diagnostics.push(metaData1[key].dimensions["file-length"] == undefined ? 0 : Number(metaData1[key].dimensions["file-length"]));
                    diagnostics.push(true);
                }else {
                    diagnostics.push(metaData1[key].metadata.name);
                    diagnostics.push(1);
                    //1_048_576
                    diagnostics.push(metaData1[key].metadata.guid);
                    diagnostics.push(metaData1[key].dimensions[".maiev-event-payload-size"] == undefined ? 0 : Number(metaData1[key].dimensions[".maiev-event-payload-size"]));
                    diagnostics.push(false);
                }
                if (header["diagnostics(raw)"] == undefined) {
                   // header["diagnostics(raw)"] = ["timestamp:timestamp", "event:text", "count:number","guid:text","size:number"];
                    header["diagnostics(raw)"] = ["timestamp:timestamp", "event:text","size:number"];
                    records["diagnostics(raw)"] = {};
                    records["diagnostics(raw)"][1] = [];
                }
                records["diagnostics(raw)"][1].push({"record": diagnostics});
            }

            let dimExists = false;
            for(let dim in metaData1[key].dimensions) {
                if(dim.charAt(0) !== '.' && dim !== 'exit_code') {
                    dimExists=true;
                    break;
                }
            }

            if (dimExists) {
                let headerExists = true;
                if (header[metaData1[key].metadata.name] == undefined) {
                    header[metaData1[key].metadata.name] = [];
                    header[metaData1[key].metadata.name].push("timestamp:timestamp");
                    header[metaData1[key].metadata.name].push("name:text");
                    headerExists=false;
                }
                if (records[metaData1[key].metadata.name] == undefined) {
                    records[metaData1[key].metadata.name] = {};
                    records[metaData1[key].metadata.name][1] = [];
                }
                let record = [];


                record.push(metaData1[key].timestampMillis);
                record.push(metaData1[key].metadata.name);

                for(let dim in metaData1[key].dimensions)
                {
                    if(dim.charAt(0) !=='.' && dim !== 'exit_code'){
                        if(!headerExists){
                            header[metaData1[key].metadata.name].push(dim+":number");
                        }
                        record.push(Number(metaData1[key].dimensions[dim]));
                    }
                }
                records[metaData1[key].metadata.name][1].push({"record" : record});
            }
        }
    }
    let isloaded = false;
    for (let key in header) {
        otherEventsFetched[key]=true;
        localcontextData.header[key] = header[key];
        isloaded=true;
    }
    for (let key in records) {
        localcontextData.records[key] = records[key];
        $('#other-event-input').append($('<option>', {
            value: key,
            text: key
        }));
    }
    if(isloaded){
        Toastify({
            text: "diagnostics(raw) events loaded",
            duration: 8000
        }).showToast();
        $("#cct-panel").css("height", "100%");//expand context table view

        if(diagEvent != ''){
            let values = diagEvent.split("_");
            getDiagEvent(Number(values[0]),values[1],values[2],values[3]);
        }
    }
}

function getMetaData2(start, end, tenant, host) {
    let URL = getMetaDataURL(start, end, tenant, host, instanceData2[host]);
    showSpinner();
    $.ajax({
        url: URL, success: function (result) {
            hideSpinner();
            metaData2 = result;
            populateIDs2(tenant, host);
            loadDiagData2();
        }
    });
}

function loadDiagData2(){
    let localcontextData = getContextData(2);
    if(localcontextData == undefined || localcontextData.header == undefined){
        return;
    }

    let records = {};
    let header = {};

    for (let key in metaData2) {
        if(metaData2[key].metadata.name != undefined) {
            /*if(metaData2[key].metadata.name === "jfr"){
                if(metaData2[key].metadata["file-name"] == undefined) {
                    continue;
                }
                if( !metaData2[key].metadata["file-name"].includes(".jfr.gz")){
                    continue;
                }
            }*/
            if(!metaData2[key].metadata.name.includes("json") && (metaData2[key].metadata["file-name"] == undefined || (!metaData2[key].metadata["file-name"].includes("json") && !metaData2[key].metadata["file-name"].includes("monitor"))) ) {
                let diagnostics = []
                diagnostics.push(metaData2[key].timestampMillis);
                if(metaData2[key].metadata[".is-large-file"] != undefined && metaData2[key].metadata[".is-large-file"] == "true"){
                    diagnostics.push(metaData2[key].metadata["file-name"]);
                    diagnostics.push(1);
                    //1_048_576
                    diagnostics.push(metaData2[key].metadata.guid);
                    diagnostics.push(metaData2[key].dimensions["file-length"] == undefined ? 0 : Number(metaData2[key].dimensions["file-length"]));
                    diagnostics.push(true);
                }else {
                    diagnostics.push(metaData2[key].metadata.name);
                    diagnostics.push(1);
                    //1_048_576
                    diagnostics.push(metaData2[key].metadata.guid);
                    diagnostics.push(metaData2[key].dimensions[".maiev-event-payload-size"] == undefined ? 0 : Number(metaData2[key].dimensions[".maiev-event-payload-size"]));
                    diagnostics.push(false);
                }
                if (header["diagnostics(raw)"] == undefined) {
                    header["diagnostics(raw)"] = ["timestamp:timestamp", "event:text", "count:number","guid:text","size:number"];
                    records["diagnostics(raw)"] = {};
                    records["diagnostics(raw)"][1] = [];
                }
                records["diagnostics(raw)"][1].push({"record": diagnostics});
            }

            let dimExists = false;
            for(let dim in metaData2[key].dimensions) {
                if(dim.charAt(0) !== '.' && dim !== 'exit_code') {
                    dimExists=true;
                    break;
                }
            }

            if (dimExists) {
                let headerExists = true;
                if (header[metaData2[key].metadata.name] == undefined) {
                    header[metaData2[key].metadata.name] = [];
                    header[metaData2[key].metadata.name].push("timestamp:timestamp");
                    header[metaData2[key].metadata.name].push("name:text");
                    headerExists=false;
                }
                if (records[metaData2[key].metadata.name] == undefined) {
                    records[metaData2[key].metadata.name] = {};
                    records[metaData2[key].metadata.name][1] = [];
                }
                let record = [];


                record.push(metaData2[key].timestampMillis);
                record.push(metaData2[key].metadata.name);

                for(let dim in metaData2[key].dimensions)
                {
                    if(dim.charAt(0) !=='.' && dim !== 'exit_code'){
                        if(!headerExists){
                            header[metaData2[key].metadata.name].push(dim+":number");
                        }
                        record.push(Number(metaData2[key].dimensions[dim]));
                    }
                }
                records[metaData2[key].metadata.name][1].push({"record" : record});
            }
        }
    }
    let isloaded = false;
    for (let key in header) {
        otherEventsFetched[key]=true;
        localcontextData.header[key] = header[key];
        isloaded=true;
    }
    for (let key in records) {
        localcontextData.records[key] = records[key];
        $('#other-event-input').append($('<option>', {
            value: key,
            text: key
        }));
    }
    if(isloaded){
        Toastify({
            text: "diagnostics(raw) events loaded",
            duration: 8000
        }).showToast();
        $("#cct-panel").css("height", "100%");//expand context table view
    }
}

function addInputToURL() {
    if (startTime1 != undefined) {
        updateUrl("startTime1", startTime1);
    } else {
        updateUrl("startTime1", "");
    }
    if (startTime2 != undefined) {
        updateUrl("startTime2", startTime2);
    } else {
        updateUrl("startTime2", "");
    }

    if (endTime1 != undefined) {
        updateUrl("endTime1", endTime1);
    } else {
        updateUrl("endTime1", "");
    }
    if (endTime2 != undefined) {
        updateUrl("endTime2", endTime2);
    } else {
        updateUrl("endTime2", "");
    }

    if (host1 != undefined) {
        updateUrl("host1", host1);
    } else {
        updateUrl("host1", "");
    }
    if (host2 != undefined) {
        updateUrl("host2", host2);
    } else {
        updateUrl("host2", "");
    }

    if (tenant1 != undefined) {
        updateUrl("tenant1", tenant1);
    } else {
        updateUrl("tenant1", "");
    }
    if (tenant2 != undefined) {
        updateUrl("tenant2", tenant2);
    } else {
        updateUrl("tenant2", "");
    }

    if (profile1 != undefined) {
        updateUrl("profile1", profile1);
    } else {
        updateUrl("profile1", "");
    }
    if (profile2 != undefined) {
        updateUrl("profile2", profile2);
    } else {
        updateUrl("profile2", "");
    }

    updateTypes1(tenant1, host1);
    updateTypes2(tenant2, host2);

    let otherEvents = "";
    for (var key in otherEvents1) {
        otherEvents = otherEvents + key + ":";
    }
    updateUrl("otherEvents", otherEvents);

    let types = "";
    if(jfrprofiles1["jfr_dump.json.gz"]){ //keep this first in list
        types = "jfr_dump.json.gz:";
    }
    for (var key in jfrprofiles1) {
        if(key !==  "jfr_dump.json.gz") {
            types = types + key + ":";
        }
    }
    let events = "";
    for (var key in jfrevents1) {
        events = events + key + ":";
    }
    updateUrl("types", types);
    updateUrl("events", events);

    //reset
    updateUrl("filterEvent", '');
    updateUrl("customevent", '');
    //updateUrl("otherevent", '');
    updateUrl("groupBy", '');
    updateUrl("smplBy", '');
    updateUrl("isCalltree", false);
    updateUrl("filterStack", '');
    updateUrl("filterReq", '');
    updateUrl("stack_id", '');
    updateUrl("spanThreshold", 0);
    updateUrl("filterBy", '');
    updateUrl("filterEvent", '');
    updateUrl("pStart", '');
    updateUrl("pEnd", '');
    updateUrl("fContext", '');
    updateUrl("tableFormat", '0');
    updateUrl("sampletableFormat", '0');
    updateUrl("sortBy", '');
    updateUrl("cumulative", '0');
    updateUrl("seriesCount", '10');
    updateUrl("groupByMatch", '');
    updateUrl("groupByLength", '200');
    updateUrl("diagEvent", '');

    if(instanceData1[host1] != undefined) {
        if(instanceData1[host1] != undefined) {
            updateUrl("dataSource", instanceData1[host1]);//todo, support different data sources for each host
        }else if(tenantData1 != undefined && tenantData1[tenant1] != undefined){
            updateUrl("dataSource", tenantData1[tenant1]);
        }else{
            updateUrl("dataSource", "other");
        }
    }
    if(instanceData2 != undefined && instanceData2[host2] != undefined) {
        if(instanceData2[host2] != undefined) {
            updateUrl("dataSource", instanceData2[host2]);//todo, support different data sources for each host
        }else if(tenantData2 != undefined && tenantData2[tenant2] != undefined){
            updateUrl("dataSource", tenantData2[tenant2]);
        }else{
            updateUrl("dataSource", "other");
        }
    }
}

function updateTenantDropdown1(start, end) {
    let tenantOptionHtml = "";
    const tenantDatalist = $("#tenants1");
    tenantDatalist.empty();
    $("#tenant-input1").val("");
    if(tenantData1 != undefined) {
        for (let val in tenantData1) {
            if (tenant1 == val || tenant1 == "") {
                tenant1 = val;
                $("#tenant-input1").val(val);
                tenantOptionHtml += "<option value=\"" + val + "\"></option>";
            }else{
                tenantOptionHtml += "<option value=\"" + val + "\"></option>";
            }
        }
    }

    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    tenantDatalist.append(optGroupTemplate.replace("OPTIONS", tenantOptionHtml));
    if (tenant1 != undefined) {
        getInstanceData1(start, end, tenant1);
    }
}

function updateTenantDropdown2(start, end) {
    let tenantOptionHtml = "";
    const tenantDatalist = $("#tenants2");
    tenantDatalist.empty();
    $("#tenant-input2").val("");

    if(tenantData2 != undefined) {
        for (let val in tenantData2) {
            if (tenant2 == val || tenant2 == "") {
                tenant2 = val;
                $("#tenant-input2").val(val);
                tenantOptionHtml += "<option value=\"" + val + "\"></option>";
            }else{
                tenantOptionHtml += "<option value=\"" + val + "\"></option>";
            }
        }
    }

    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    tenantDatalist.append(optGroupTemplate.replace("OPTIONS", tenantOptionHtml));
    if (tenant2 != undefined) {
        getInstanceData2(start, end, tenant2);
    }
}


function populateHostsSelector1(start, end, tenant) {
    if (tenant == undefined || tenant == "") {
        return;
    }
    let hostOptionHtml = "";
    const hostDatalist = $("#hosts1");
    hostDatalist.empty();
    $("#host-input1").val("");

    if(instanceData1 != undefined) {
        let hostExist = false;
        for (let val in instanceData1) {
            if (host1 == val || host1 == "") {
                host1 = val;
                $("#host-input1").val(val);
                hostOptionHtml += "<option value=\"" + val + "\" selected></option>";
            }else{
                hostOptionHtml += "<option value=\"" + val + "\"></option>";
            }
            hostExist = true;
        }
        if(!hostExist && host1 != undefined && host1 != ""){
            $("#host-input1").val(host1);
        }
    }

    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    hostDatalist.append(optGroupTemplate.replace("OPTIONS", hostOptionHtml));
    if (tenant != undefined && host1 != undefined) {
        if(profile1 != undefined){
            $("#bases1").val(profile1);
        }
        getMetaData1(start, end, tenant, host1);
    }
}

function populateHostsSelector2(start, end, tenant) {
    if (tenant == undefined || tenant == "") {
        return;
    }
    let hostOptionHtml = "";
    const hostDatalist = $("#hosts2");
    hostDatalist.empty();
    $("#host-input2").val("");

    if(instanceData2 != undefined) {
        for (let val in instanceData2) {
            if (host2 == val || host2 == "") {
                host2 = val;
                $("#host-input2").val(val);
                hostOptionHtml += "<option value=\"" + val + "\" selected></option>";
            }else{
                hostOptionHtml += "<option value=\"" + val + "\"></option>";
            }
        }
    }

    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    hostDatalist.append(optGroupTemplate.replace("OPTIONS", hostOptionHtml));
    if (tenant2 != undefined && host2 != undefined) {
        if(profile2 != undefined){
            $("#bases2").val(profile2);
        }
        getMetaData2(start, end, tenant, host2);
    }
}

function updateTypes1(tenant, host){
    jfrevents1={};
    jfrprofiles1={};
    let profiles = {};
    try {
        for (var key in metaData1) {

            if(metaData1[key].metadata["file-name"] != undefined && metaData1[key].metadata["file-name"].includes(".jfr.gz")){
                continue;
            }

            if((metaData1[key].metadata["file-name"] != undefined && metaData1[key].metadata["file-name"] == "json-jstack") || (metaData1[key].metadata["name"] != undefined && metaData1[key].metadata["name"] == "jstack")){
                jfrprofiles1["json-jstack"] = true; //jstacks or parsed jstacks exist
                continue;
            }

            let guid = metaData1[key].metadata["guid"];
            let name = metaData1[key].metadata["file-name"];
            if(metaData1[key].metadata["source-file"] != undefined){
                name = metaData1[key].metadata["source-file"];
            }

            if (profiles[guid] == undefined && (tenant === metaData1[key].metadata.tenant || tenant === metaData1[key].metadata["tenant-id"]) && host === metaData1[key].metadata.host) {
                let val = metaData1[key].timestampMillis + " - " + metaData1[key].metadata.guid;
                if (profile1 == val || profile1 == "All") {//update only for matching profile
                    if (name != undefined && name.includes("jfr_dump") && jfrprofiles1[name] == undefined) {//sfdc
                            if (name.includes("dump_log")) {
                                jfrevents1[name] = true;
                            } else if(!name.includes("sql")){
                                jfrprofiles1[name] = true;
                            }
                    }else if (metaData1[key].metadata.type == "jfrprofile" && jfrprofiles1[metaData1[key].metadata["file-name"]] == undefined) {
                        jfrprofiles1[metaData1[key].metadata["file-name"]] = true;
                    } else if (metaData1[key].metadata.type == "jfrevent" && jfrprofiles1[metaData1[key].metadata["file-name"]] == undefined) {
                        jfrevents1[metaData1[key].metadata["file-name"]] = true;
                    }
                }else if(profile1 == "Jstacks"){
                    if (name != undefined && name.includes("jfr_dump") && jfrprofiles1[name] == undefined) {//sfdc
                        if (name.includes("dump_log")) {
                            jfrevents1[name] = true;
                        } else if (metaData1[key].metadata.type == "jfrevent" && jfrprofiles1[metaData1[key].metadata["name"]] == undefined) {
                            jfrevents1[metaData1[key].metadata["name"]] = true;
                        }
                    }
                }
            }
        }
    }catch(e){
        console.log(e);
    }
    console.log("jfrprofiles1:"+jfrprofiles1);
}

function updateTypes2(tenant, host){
    jfrevents2={};
    jfrprofiles2={};
    let profiles = {};
    try {
        for (var key in metaData2) {

            if(metaData2[key].metadata["file-name"] != undefined && metaData2[key].metadata["file-name"].includes(".jfr.gz")){
                continue;
            }

            if((metaData2[key].metadata["name"] != undefined && metaData2[key].metadata["name"] == "jstack") || (metaData2[key].metadata["file-name"] != undefined && metaData2[key].metadata["file-name"] == "json-jstack")){
                jfrprofiles2["json-jstack"] = true;
                continue;
            }

            let guid = metaData2[key].metadata["guid"];
            let name = metaData2[key].metadata["file-name"];
            if(metaData2[key].metadata["source-file"] != undefined){
                name = metaData2[key].metadata["source-file"];
            }

            if (profiles[guid] == undefined && (tenant === metaData2[key].metadata.tenant || tenant === metaData2[key].metadata["tenant-id"]) && host === metaData2[key].metadata.host) {
                let val = metaData2[key].timestampMillis + " - " + metaData2[key].metadata.guid;
                if (profile2 == val || profile2 == "All") {//update only for matching profile
                    if (name != undefined && name.includes("jfr_dump") && jfrprofiles2[name] == undefined) {//sfdc
                        if (name.includes("dump_log")) {
                            jfrevents2[name] = true;
                        } else if(!name.includes("sql")){
                            jfrprofiles2[name] = true;
                        }
                    }else if (metaData2[key].metadata.type == "jfrprofile" && jfrprofiles2[metaData2[key].metadata["file-name"]] == undefined) {
                        jfrprofiles2[metaData2[key].metadata["file-name"]] = true;
                    } else if (metaData2[key].metadata.type == "jfrevent" && jfrprofiles2[metaData2[key].metadata["file-name"]] == undefined) {
                        jfrevents2[metaData2[key].metadata["file-name"]] = true;
                    }
                }else if(profile2 == "Jstacks"){
                    if (name != undefined && name.includes("jfr_dump") && jfrprofiles2[name] == undefined) {//sfdc
                        if (name.includes("dump_log")) {
                            jfrevents2[name] = true;
                        } else if (metaData2[key].metadata.type == "jfrevent" && jfrprofiles2[metaData2[key].metadata["name"]] == undefined) {
                            jfrevents2[metaData2[key].metadata["name"]] = true;
                        }
                    }
                }
            }
        }
    }catch(e){
        console.log(e);
    }
    console.log("jfrprofiles2:"+jfrprofiles2);
}


let toPArse = {1:[],2:[]};

function jfrJsonExists(metaData, timestamp, guid, host){
    for (var key in metaData) {
        let filename = metaData1[key].metadata["file-name"];
        if(metaData[key].timestampMillis == timestamp && metaData[key].metadata["name"] == "jfr" && filename!= undefined && filename.includes(".json.gz")){
            console.log("No need to parse " + filename + ":" + timestamp + ":"+guid);
            return true;
        }
    }
    console.log("need to parse " + timestamp+":"+guid);
    return false;
}

function addToParse(count, tenant, host, timestamp, eventType, guid){
    if(count == 1){
        if(jfrJsonExists(metaData1, timestamp, guid, host)){
            return;
        }
    }else{
        if(jfrJsonExists(metaData2, timestamp, guid, host)){
            return;
        }
    }

    let endpoint = "/v1/profile/" + tenant + "/?start=" + timestamp + "&end=" + timestamp +
        "&metadata_query=" + encodeURIComponent("host=" + host) +
        "&metadata_query=" + encodeURIComponent("tenant-id=" + tenant) +
        "&metadata_query=" + encodeURIComponent("guid=" + guid) +
        "&metadata_query=" + encodeURIComponent("file-name=" + eventType);
    toPArse[count].push(endpoint);
}

function parsePendingJFRs1(tenant, host){
    const requests = [];
    for(let i=0; i< toPArse[1].length; i++){
        requests.push(callTreePerfGenieAjax(tenant, "GET", toPArse[1][i], result => result));
    }
    if(requests.length == 0){
        populateIDs1(tenant, host, false, true);
        return;
    }
    addInputNote(true,(toPArse[1].length + toPArse[2].length) +" full JFR(s) found, sequential download and parsing will take few minutes, please be patient ...")
    showSpinner();
    let queryResults = Promise.all(requests);
    queryResults.then(contextDatas => {

        for (var key in contextDatas) {
            for(let k in contextDatas[key]) {
                if (contextDatas[key].error == undefined || contextDatas[key].error == "") {
                    let meta = {"dimensions": {}, "metadata": {}, "timestampMillis": 0, "payload": ""};
                    meta.metadata["tenant-id"] = tenant;
                    meta.metadata["name"] = "jfr";
                    meta.metadata["host"] = host;
                    meta.metadata["instance-id"] = host;
                    meta.metadata["file-name"] = k;
                    let tokens = contextDatas[key][k].split(" - ");
                    meta.metadata["guid"] = tokens[1] + k; //change guid
                    meta.timestampMillis = parseInt(tokens[0]);
                    metaData1.push(meta);
                }
            }
        }

        populateIDs1(tenant, host, false, true);
        addInputNote(false,"");
        hideSpinner();
    });
}

function parsePendingJFRs2(tenant, host){
    const requests = [];
    for(let i=0; i< toPArse[2].length; i++){
        requests.push(callTreePerfGenieAjax(tenant, "GET", toPArse[2][i], result => result));
    }
    if(requests.length == 0){
        populateIDs2(tenant, host, false, true);
        return;
    }
    addInputNote(true,(toPArse[1].length + toPArse[2].length) +" full JFR(s) found, sequential download and parsing will take few minutes, please be patient ...")
    showSpinner();
    let queryResults = Promise.all(requests);
    queryResults.then(contextDatas => {

        for (var key in contextDatas) {
            for(let k in contextDatas[key]){
                if (contextDatas[key].error == undefined || contextDatas[key].error == "") {
                    let meta = {"dimensions": {}, "metadata": {}, "timestampMillis": 0, "payload": ""};
                    meta.metadata["tenant-id"] = tenant;
                    meta.metadata["name"] = "jfr";
                    meta.metadata["host"] = host;
                    meta.metadata["instance-id"] = host;
                    meta.metadata["file-name"] = k;
                    meta.metadata["guid"] = contextDatas[key][k] + k; //change guid
                    meta.timestampMillis = contextDatas[key][k];
                    metaData2.push(meta);
                }
            }
        }

        populateIDs2(tenant, host, false, true);
        addInputNote(false,"");
        hideSpinner();
    });
}

function populateIDs1(tenant, host, clearInput, skipPArsing) {
    if (tenant === undefined || tenant.length === 0 || host === undefined || host.length === 0) {
        return;
    }
    if(skipPArsing == undefined){
        skipPArsing = false;
    }
    let profiles = {};
    let profileOptionHtml = "<option  value=''> Choose a profile... </option>";
    const baseDatalist = $("#bases1");
    baseDatalist.empty();

    let profileFound = false;
    let jstackFound = false;

    let needToParse = false;
    toPArse[1]=[];
    if(!skipPArsing) {
        for (var key in metaData1) {

            let guid = metaData1[key].metadata["guid"];
            let name = metaData1[key].metadata["name"];
            let filename = metaData1[key].metadata["file-name"];

            if (filename != undefined && filename.includes(".jfr.gz")) {//need to parse
                addToParse(1, tenant, host, metaData1[key].timestampMillis, filename, guid)
                needToParse = true;
            }
        }
    }
    if(needToParse){//populateIDs1 after parsing
        parsePendingJFRs1(tenant, host);
        return;
    }
    for (var key in metaData1) {

        let guid = metaData1[key].metadata["guid"];
        let name = metaData1[key].metadata["name"];
        let filename = metaData1[key].metadata["file-name"];

        if(filename!= undefined && filename.includes(".jfr.gz")){
            continue;
        }

        if(metaData1[key].metadata["source-file"] != undefined){
            filename = metaData1[key].metadata["source-file"];
        }

        if ((tenant === metaData1[key].metadata["tenant-id"]) && (host === metaData1[key].metadata.host || host === metaData1[key].metadata["instance-id"])) {

            if(metaData1[key].metadata["name"] != undefined && metaData1[key].metadata["name"] == "jstack"){
                if (otherEventsSupported["monitor"]) {
                    otherEvents1["monitor"] = true;
                }
            }
            if ((metaData1[key].metadata["name"] != undefined && metaData1[key].metadata["name"] == "jstack") || (metaData1[key].metadata["file-name"] != undefined && metaData1[key].metadata["file-name"] == "json-jstack")) {
                jstackFound = true;
                continue;
            }
            if (name != undefined && name == "jfr") {
                const index = guid.indexOf("jfr_dump");
                if (index !== -1) { //sfdc
                    guid = metaData1[key].metadata["guid"].substring(0, index);
                    metaData1[key].metadata.guid = guid;
                }
                if (profiles[metaData1[key].metadata.guid] == undefined) {
                    let str = moment.utc(metaData1[key].timestampMillis).format("YYYY-MM-DD HH:mm:ss");
                    let val = metaData1[key].timestampMillis + " - " + metaData1[key].metadata.guid;
                    if (filename != undefined) {
                        if (filename.includes("jfr_dump")) {
                            filename = "jfr-sfdc"; //sfdc
                        }
                        if (profile1 == val || profile1 == "") {
                            profile1 = val;
                            profileOptionHtml += "<option value=\"" + val + "\" selected>" + str + ":" + filename + "</option>";
                        } else {
                            profileOptionHtml += "<option value=\"" + val + "\">" + str + ":" + filename + "</option>";
                        }
                        profileFound = true;
                        profiles[metaData1[key].metadata.guid] = 1;
                    }
                }
            } else {//not a profile
                if (name != undefined && otherEventsSupported[name]) {
                    otherEvents1[name] = true;
                }
            }
        }
    }

    if (profileFound) {
        if (profile1 == "All") {
            profileOptionHtml += "<option value=\"All\" selected>All profiles</option>";
        } else {
            profileOptionHtml += "<option value=\"All\">All profiles</option>";
        }
    }
    if (jstackFound) {
        if (profile1 == "Jstacks") {
            profileOptionHtml += "<option value=\"Jstacks\" selected>Jstacks profile alone</option>";
        } else {
            profileOptionHtml += "<option value=\"Jstacks\">Jstacks profile alone</option>";
        }
    }
    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    baseDatalist.append(optGroupTemplate.replace("OPTIONS", profileOptionHtml));
}

function populateIDs2(tenant, host, clearInput, skipPArsing) {
    if (tenant === undefined || tenant.length === 0 || host === undefined || host.length === 0) {
        return;
    }
    if(skipPArsing == undefined){
        skipPArsing = false;
    }
    let profiles = {};
    let profileOptionHtml = "<option  value=''> Choose a profile... </option>";
    const baseDatalist = $("#bases2");
    baseDatalist.empty();

    let profileFound = false;
    let jstackFound = false;

    let needToParse = false;
    toPArse[2]=[];
    if(!skipPArsing) {
        for (var key in metaData2) {

            let guid = metaData2[key].metadata["guid"];
            let name = metaData2[key].metadata["name"];
            let filename = metaData2[key].metadata["file-name"];

            if (filename != undefined && filename.includes(".jfr.gz")) {//need to parse
                addToParse(2, tenant, host, metaData2[key].timestampMillis, filename, guid)
                needToParse = true;
            }
        }
    }
    if(needToParse){//populateIDs1 after parsing
        parsePendingJFRs2(tenant, host);
        return;
    }

    for (var key in metaData2) {
        let guid = metaData2[key].metadata["guid"];
        let name = metaData2[key].metadata["name"];
        let filename = metaData2[key].metadata["file-name"];
        if(metaData2[key].metadata["source-file"] != undefined){
            filename = metaData2[key].metadata["source-file"];
        }

        if ((tenant === metaData2[key].metadata["tenant-id"]) && (host === metaData2[key].metadata.host || host === metaData2[key].metadata["instance-id"])) {
            if(metaData2[key].metadata["name"] != undefined && metaData2[key].metadata["name"] == "jstack"){
                if (otherEventsSupported["monitor"]) {
                    otherEvents2["monitor"] = true;
                }
            }
            if ((metaData2[key].metadata["name"] != undefined && metaData2[key].metadata["name"] == "jstack") || (metaData2[key].metadata["file-name"] != undefined && metaData2[key].metadata["file-name"] == "json-jstack")) {
                jstackFound = true;
                continue;
            }
            if (name != undefined && name == "jfr") {
                const index = guid.indexOf("jfr_dump");
                if (index !== -1) { //sfdc
                    guid = metaData2[key].metadata["guid"].substring(0, index);
                    metaData2[key].metadata.guid = guid;
                }
                if (profiles[metaData2[key].metadata.guid] == undefined) {
                    let str = moment.utc(metaData2[key].timestampMillis).format("YYYY-MM-DD HH:mm:ss");
                    let val = metaData2[key].timestampMillis + " - " + metaData2[key].metadata.guid;
                    if (filename != undefined) {
                        if (filename.includes("jfr_dump")) {
                            filename = "jfr-sfdc"; //sfdc
                        }
                        if (profile2 == val || profile2 == "") {
                            profile2 = val;
                            profileOptionHtml += "<option value=\"" + val + "\" selected>" + str + ":" + filename + "</option>";
                        } else {
                            profileOptionHtml += "<option value=\"" + val + "\">" + str + ":" + filename + "</option>";
                        }
                        profileFound = true;
                        profiles[metaData2[key].metadata.guid] = 1;
                    }
                }
            } else {//not a profile
                if (name != undefined && otherEventsSupported[name]) {
                    otherEvents2[name] = true;
                }
            }
        }
    }

    if (profileFound) {
        if (profile2 == "All") {
            profileOptionHtml += "<option value=\"All\" selected>All profiles</option>";
        } else {
            profileOptionHtml += "<option value=\"All\">All profiles</option>";
        }
    }
    if (jstackFound) {
        if (profile2 == "Jstacks") {
            profileOptionHtml += "<option value=\"Jstacks\" selected>Jstacks profile alone</option>";
        } else {
            profileOptionHtml += "<option value=\"Jstacks\">Jstacks profile alone</option>";
        }
    }
    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    baseDatalist.append(optGroupTemplate.replace("OPTIONS", profileOptionHtml));
}

function getStart1() {
    return startTime1;
}

function getEnd1() {
    return endTime1;
}

function getStart2() {
    return startTime2;
}

function getEnd2() {
    return endTime2;
}