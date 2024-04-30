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
let otherEventsSupported = {"top":true, "ps":true};
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
        if($( "#input-info-text" ).html("") != "") {
            $("#input-info").css("display", "none");
            $("#input-info-text").html("");
        }
    }
}

$(function () {
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
        startTime1 = moment.utc($("#startpicker1").val()).valueOf();
        endTime1 = moment.utc($("#endpicker1").val()).valueOf();
        getMetaData1(startTime1, endTime1, tenant1, host1);
    });

    $("#host-input2").on("change", (event) => {
        host2 = $("#host-input2").val();
        profile2 = undefined;
        $("#bases2").empty();
        startTime2 = moment.utc($("#startpicker2").val()).valueOf();
        endTime2 = moment.utc($("#endpicker2").val()).valueOf();
        getMetaData2(startTime2, endTime2, tenant2, host2);
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
        step: 1
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
        step: 1
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
    let URL = getInstanceDataURL(start, end, tenant);
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
    let URL =getInstanceDataURL(start, end, tenant);
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
    let URL = getMetaDataURL(start, end, tenant, host);
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

function loadDiagData1(){
    if(contextData == undefined || contextData.header == undefined){
        return;
    }
    
    let records = {};
    let header = {};

    for (let key in metaData1) {
        if(metaData1[key].metadata.name != undefined) {
            if(metaData1[key].metadata.name === "jfr"){
                continue;
            }
            if(!metaData1[key].metadata.name.includes("json") && (metaData1[key].metadata["file-name"] == undefined || !metaData1[key].metadata["file-name"].includes("json")) ) {
                let diagnostics = []
                diagnostics.push(metaData1[key].timestampMillis);
                diagnostics.push(metaData1[key].metadata.name);
                diagnostics.push(1);
                diagnostics.push(metaData1[key].metadata.guid);
                if (header["diagnostics(raw)"] == undefined) {
                    header["diagnostics(raw)"] = ["timestamp:timestamp", "event:text", "count:number", "guid:text"];
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
        contextData.header[key] = header[key];
        isloaded=true;
    }
    for (let key in records) {
        contextData.records[key] = records[key];
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
    }
}

function getMetaData2(start, end, tenant, host) {
    let URL = getMetaDataURL(start, end, tenant, host);
    showSpinner();
    $.ajax({
        url: URL, success: function (result) {
            hideSpinner();
            metaData2 = result;
            populateIDs2(tenant, host);
        }
    });
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
    for (var key in jfrprofiles1) {
        types = types + key + ":";
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
    updateUrl("otherevent", '');
    updateUrl("groupBy", 'tid');
    updateUrl("isCalltree", false);
    updateUrl("filterStack", '');
    updateUrl("filterReq", '');
    updateUrl("stack_id", '');
    updateUrl("spanThreshold", 200);
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
        for (let val in instanceData1) {
            if (host1 == val || host1 == "") {
                host1 = val;
                $("#host-input1").val(val);
                hostOptionHtml += "<option value=\"" + val + "\" selected></option>";
            }else{
                hostOptionHtml += "<option value=\"" + val + "\"></option>";
            }
        }
    }

    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    hostDatalist.append(optGroupTemplate.replace("OPTIONS", hostOptionHtml));
    if (tenant != undefined && host1 != undefined) {
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
        getMetaData2(start, end, tenant, host2);
    }
}

function updateTypes1(tenant, host){
    jfrevents1={};
    jfrprofiles1={};
    let profiles = {};
    try {
        for (var key in metaData1) {

            if (metaData1[key].metadata["name"] != undefined && ((metaData1[key].metadata["file-name"] != undefined && metaData1[key].metadata["file-name"] == "json-jstack") || metaData1[key].metadata.type == "jstack") && (tenant === metaData1[key].metadata.tenant || tenant === metaData1[key].metadata["tenant-id"]) && host === metaData1[key].metadata.host) {
                if(metaData1[key].metadata["file-name"] != undefined && metaData1[key].metadata["file-name"] == "json-jstack"){
                    if (jfrprofiles1[metaData1[key].metadata["file-name"]] == undefined) {
                        jfrprofiles1[metaData1[key].metadata["file-name"]] = true;
                    }
                }else {
                    if (jfrprofiles1[metaData1[key].metadata.name] == undefined) {
                        jfrprofiles1[metaData1[key].metadata.name] = true;
                    }
                }

                continue;
            }



            let name = metaData1[key].metadata["file-name"];
            let guid = metaData1[key].metadata["guid"];
            if (profiles[metaData1[key].metadata.guid] == undefined && (tenant === metaData1[key].metadata.tenant || tenant === metaData1[key].metadata["tenant-id"]) && host === metaData1[key].metadata.host) {
                let val = metaData1[key].timestampMillis + " - " + metaData1[key].metadata.guid;
                if (profile1 == val || profile1 == "All") {//update only for matching profile
                    if (name != undefined && name.includes("jfr_dump") && jfrprofiles1[name] == undefined) {//sfdc
                            if (name.includes("dump_log")) {
                                jfrevents1[name] = true;
                            } else if(!name.includes("sql")){
                                jfrprofiles1[name] = true;
                            }
                    }else if (name == "json-stack" && jfrprofiles1[name] == undefined) {
                        jfrprofiles1[name] = true;
                    }else if (metaData1[key].metadata.type == "jfrprofile" && jfrprofiles1[metaData1[key].metadata.name] == undefined) {
                        jfrprofiles1[metaData1[key].metadata.name] = true;
                    } else if (metaData1[key].metadata.type == "jfrevent" && jfrprofiles1[metaData1[key].metadata.name] == undefined) {
                        jfrevents1[metaData1[key].metadata.name] = true;
                    } else if (metaData1[key].metadata.type == "jstack" && jfrprofiles1[metaData1[key].metadata.name] == undefined) {
                        jfrprofiles1[metaData1[key].metadata.name] = true;
                    }
                }else if(profile1 == "Jstacks"){
                    if (name != undefined && name.includes("jfr_dump") && jfrprofiles1[name] == undefined) {//sfdc
                        if (name.includes("dump_log")) {
                            jfrevents1[name] = true;
                        } else if (metaData1[key].metadata.type == "jfrevent" && jfrprofiles1[metaData1[key].metadata.name] == undefined) {
                            jfrevents1[metaData1[key].metadata.name] = true;
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
            if (metaData2[key].metadata["name"] != undefined && ((metaData2[key].metadata["file-name"] != undefined && metaData2[key].metadata["file-name"] == "json-jstack") || metaData1[key].metadata.type == "jstack") && (tenant === metaData2[key].metadata.tenant || tenant === metaData2[key].metadata["tenant-id"]) && host === metaData2[key].metadata.host) {
                if(metaData2[key].metadata["file-name"] != undefined && metaData2[key].metadata["file-name"] == "json-jstack"){
                    if (jfrprofiles2[metaData2[key].metadata["file-name"]] == undefined) {
                        jfrprofiles2[metaData2[key].metadata["file-name"]] = true;
                    }
                }else {
                    if (jfrprofiles2[metaData1[key].metadata.name] == undefined) {
                        jfrprofiles2[metaData1[key].metadata.name] = true;
                    }
                }
                continue;
            }

            let name = metaData2[key].metadata["file-name"];
            let guid = metaData2[key].metadata["guid"];
            if (profiles[metaData2[key].metadata.guid] == undefined && (tenant === metaData2[key].metadata.tenant || tenant === metaData2[key].metadata["tenant-id"]) && host === metaData2[key].metadata.host) {
                let val = metaData2[key].timestampMillis + " - " + metaData2[key].metadata.guid;
                if (profile2 == val || profile2 == "All") {//update only for matching profile
                    if (name != undefined && name.includes("jfr_dump") && jfrprofiles2[name] == undefined && profile2 != "All") {//sfdc
                        if (name.includes("data")) {
                            jfrevents2[name] = true;
                        } else {
                            jfrprofiles2[name] = true;
                        }
                    }else if (name == "json-stack" && jfrprofiles2[name] == undefined) {
                        jfrprofiles2[name] = true;
                    }else if (metaData2[key].metadata.type == "jfrprofile" && jfrprofiles2[metaData2[key].metadata.name] == undefined) {
                        jfrprofiles2[metaData2[key].metadata.name] = true;
                    } else if (metaData2[key].metadata.type == "jfrevent" && jfrprofiles2[metaData2[key].metadata.name] == undefined) {
                        jfrevents2[metaData2[key].metadata.name] = true;
                    } else if (metaData2[key].metadata.type == "jstack" && jfrprofiles2[metaData2[key].metadata.name] == undefined) {
                        jfrprofiles2[metaData2[key].metadata.name] = true;
                    }
                }else if(profile2 == "Jstacks"){
                    if (name != undefined && name.includes("jfr_dump") && jfrprofiles2[name] == undefined) {//sfdc
                        if (name.includes("dump_log")) {
                            jfrevents2[name] = true;
                        } else if (metaData2[key].metadata.type == "jfrevent" && jfrprofiles2[metaData2[key].metadata.name] == undefined) {
                            jfrevents2[metaData2[key].metadata.name] = true;
                        }
                    }
                }
            }
        }
    }catch(e){
        console.log(e);
    }
    console.log(jfrprofiles2);
}

function populateIDs1(tenant, host, clearInput) {
    if (tenant === undefined || tenant.length === 0 || host === undefined || host.length === 0) {
        return;
    }

    let profiles = {};
    let profileOptionHtml = "<option  value=''> Choose a profile... </option>";
    const baseDatalist = $("#bases1");
    baseDatalist.empty();

    let profileFound = false;
    let jstackFound = false;
    for (var key in metaData1) {
        if ((tenant === metaData1[key].metadata.tenant || tenant === metaData1[key].metadata["tenant-id"]) && (host === metaData1[key].metadata.host || tenant === metaData1[key].metadata["instance-id"])) {
            if ((metaData1[key].metadata["name"] != undefined && (metaData1[key].metadata["name"] == "jfr" || metaData1[key].metadata["name"] == "jstack" || metaData1[key].metadata["name"] == "Jstack")) || (metaData1[key].metadata["type"] != undefined && (metaData1[key].metadata["type"] == "jfrprofile" || metaData1[key].metadata["type"] == "jfrevent"))) {
                if (metaData1[key].metadata["name"] != undefined && (metaData1[key].metadata["name"] == "Jstack" || metaData1[key].metadata["name"] == "jstack")) {
                    jstackFound = true;
                    continue;
                }
                const index = metaData1[key].metadata["guid"].indexOf("jfr_dump");
                if (index !== -1) { //sfdc
                    let guid = metaData1[key].metadata["guid"].substring(0, index);
                    metaData1[key].metadata.guid = guid;
                }
                if (profiles[metaData1[key].metadata.guid] == undefined) {
                    let str = moment.utc(metaData1[key].timestampMillis).format("YYYY-MM-DD HH:mm:ss");
                    let val = metaData1[key].timestampMillis + " - " + metaData1[key].metadata.guid;
                    if (metaData1[key].metadata["file-name"] != undefined) {
                        let name = metaData1[key].metadata["file-name"];
                        if (name.includes("jfr_dump")) {
                            name = "jfr-sfdc"; //sfdc
                        }
                        if (profile1 == val || profile1 == "") {
                            profile1 = val;
                            profileOptionHtml += "<option value=\"" + val + "\" selected>" + str + ":" + name + "</option>";
                        } else {
                            profileOptionHtml += "<option value=\"" + val + "\">" + str + ":" + name + "</option>";
                        }
                        profileFound = true;
                        profiles[metaData1[key].metadata.guid] = 1;
                    }
                }
            } else {//not a profile
                if (metaData1[key].metadata["name"] != undefined && otherEventsSupported[metaData1[key].metadata["name"]]) {
                    otherEvents1[metaData1[key].metadata["name"]] = true;
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

    /*

    const index = metaData1[key].metadata["guid"].indexOf("jfr_dump");
    if (index !== -1) { //sfdc
        let guid = metaData1[key].metadata["guid"].substring(0, index);
        metaData1[key].metadata.guid = guid;
    }

    if (profiles[metaData1[key].metadata.guid] == undefined && (tenant === metaData1[key].metadata.tenant || tenant === metaData1[key].metadata["tenant-id"]) && host === metaData1[key].metadata.host) {
        let str = moment.utc(metaData1[key].timestampMillis).format("YYYY-MM-DD HH:mm:ss");

        let val = metaData1[key].timestampMillis + " - " + metaData1[key].metadata.guid;

        let name = metaData1[key].metadata["file-name"];
        if(name.includes("jfr_dump")){
            name = "jfr-sfdc"; //sfdc
        }
        if (profile1 == val || profile1 == "") {
            profile1 = val;
            profileOptionHtml += "<option value=\"" + val + "\" selected>" + str + ":" + name + "</option>";
        } else {
            profileOptionHtml += "<option value=\"" + val + "\">" + str + ":" + name + "</option>";
        }
        profileFound = true;
        profiles[metaData1[key].metadata.guid] = 1;
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
        profileOptionHtml += "<option value=\"Jstacks\" selected>Jstacks</option>";
    } else {
        profileOptionHtml += "<option value=\"Jstacks\">Jstacks alone</option>";
    }
}
for (var key in otherEvents) {
    if (profile1 == key) {
        profileOptionHtml += "<option value=\""+key+"\" selected>"+key+"</option>";
    } else {
        profileOptionHtml += "<option value=\""+key+"\">"+key+"</option>";
    }
}
const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
baseDatalist.append(optGroupTemplate.replace("OPTIONS", profileOptionHtml));

*/
}

function populateIDs2(tenant, host, clearInput) {
    if (tenant === undefined || tenant.length === 0 || host === undefined || host.length === 0) {
        return;
    }

    let profiles = {};
    let profileOptionHtml = "<option  value=''> Choose a profile... </option>";
    const baseDatalist = $("#bases2");
    baseDatalist.empty();

    let profileFound = false;
    let jstackFound = false;
    for (var key in metaData2) {
        if ((tenant === metaData2[key].metadata.tenant || tenant === metaData2[key].metadata["tenant-id"]) && (host === metaData2[key].metadata.host || tenant === metaData2[key].metadata["instance-id"])) {
            if ((metaData2[key].metadata["name"] != undefined && (metaData2[key].metadata["name"] == "jfr" || metaData2[key].metadata["name"] == "jstack" || metaData2[key].metadata["name"] == "Jstack")) || (metaData2[key].metadata["type"] == undefined && (metaData2[key].metadata["type"] == "jfrprofile" || metaData2[key].metadata["type"] == "jfrevent"))) {
                if (metaData2[key].metadata["name"] != undefined && (metaData2[key].metadata["name"] == "Jstack" || metaData2[key].metadata["name"] == "jstack")) {
                    jstackFound = true;
                    continue;
                }

                const index = metaData2[key].metadata["guid"].indexOf("jfr_dump");
                if (index !== -1) { //sfdc
                    let guid = metaData2[key].metadata["guid"].substring(0, index);
                    metaData2[key].metadata.guid = guid;
                }
                if (profiles[metaData2[key].metadata.guid] == undefined) {
                    let str = moment.utc(metaData2[key].timestampMillis).format("YYYY-MM-DD HH:mm:ss");
                    let val = metaData2[key].timestampMillis + " - " + metaData2[key].metadata.guid;
                    if (metaData2[key].metadata["file-name"] != undefined) {
                        let name = metaData2[key].metadata["file-name"];
                        if (name.includes("jfr_dump")) {
                            name = "jfr-sfdc"; //sfdc
                        }
                        if (profile2 == val || profile2 == "") {
                            profile2 = val;
                            profileOptionHtml += "<option value=\"" + val + "\" selected>" + str + ":" + name + "</option>";
                        } else {
                            profileOptionHtml += "<option value=\"" + val + "\">" + str + ":" + name + "</option>";
                        }
                        profileFound = true;
                        profiles[metaData2[key].metadata.guid] = 1;
                    }
                }
            } else {//not a profile
                if (metaData2[key].metadata["name"] != undefined && otherEventsSupported[metaData2[key].metadata["name"]]) {
                    otherEvents2[metaData2[key].metadata["name"]] = true;
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
    /*
    let profiles = {};
    let profileOptionHtml = "<option value=''> Choose a profile... </option>";
    const baseDatalist = $("#bases2");
    baseDatalist.empty();
    let profileFound = false;
    let jstackFound = false;
    for (var key in metaData2) {
        if (metaData2[key].metadata["name"] != undefined && metaData2[key].metadata["name"] == "Jstack" && (tenant === metaData2[key].metadata.tenant || tenant === metaData2[key].metadata["tenant-id"]) && host === metaData2[key].metadata.host) {
            jstackFound = true;
            continue;
        }
        const index = metaData2[key].metadata["guid"].indexOf("jfr_dump");
        if (index !== -1) { //sfdc
            let guid = metaData2[key].metadata["guid"].substring(0, index);
            metaData2[key].metadata.guid = guid;
        }

        if (profiles[metaData2[key].metadata.guid] == undefined && (tenant === metaData2[key].metadata.tenant || tenant === metaData2[key].metadata["tenant-id"]) && host === metaData2[key].metadata.host) {
            let str = moment.utc(metaData2[key].timestampMillis).format("YYYY-MM-DD HH:mm:ss");
            let val = metaData2[key].timestampMillis + " - " + metaData2[key].metadata.guid;

            let name = metaData2[key].metadata["file-name"];
            if(name.includes("jfr_dump")){
                name = "jfr-sfdc"; //sfdc
            }

            if (profile2 == val || profile2 == "") {
                profile2 = val;
                profileOptionHtml += "<option value=\"" + val + "\" selected>" + str + ":" + name + "</option>";
            } else {
                profileOptionHtml += "<option value=\"" + val + "\">" + str + ":" + name + "</option>";
            }
            profiles[metaData2[key].metadata.guid] = 1;
            profileFound = true;
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
        if (profile1 == "Jstacks") {
            profileOptionHtml += "<option value=\"Jstacks\" selected>Jstacks</option>";
        } else {
            profileOptionHtml += "<option value=\"Jstacks\">Jstacks alone</option>";
        }
    }
    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    baseDatalist.append(optGroupTemplate.replace("OPTIONS", profileOptionHtml));
    */

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