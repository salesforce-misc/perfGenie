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
let maxTimeRange = 24*60 * 60 * 1000;

let jfrprofiles1 = {};
let jfrprofiles2 = {};
let jfrevents1 = {};
let jfrevents2 = {};
const urlParams = new URLSearchParams(window.location.search);

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

    //getMetaData1(getStart1(), getEnd1());
    //getMetaData2(getStart2(), getEnd2());

    getTenantData1(getStart1(), getEnd1());
    getTenantData2(getStart2(), getEnd2());


    $("#startpicker1").change(function (event) {
        if (moment.utc($("#startpicker1").val()).valueOf() != startTime1) {
            startTime1 = moment.utc($("#startpicker1").val()).valueOf();
            if(validateDateRange(1)) {
                getTenantData1(startTime1, endTime1);
                //getMetaData1(startTime1, endTime1);
            }
        }
    });

    $("#startpicker2").change(function (event) {
        if (moment.utc($("#startpicker2").val()).valueOf() != startTime2) {
            startTime2 = moment.utc($("#startpicker2").val()).valueOf();
            if(validateDateRange(2)) {
                getTenantData2(startTime2, endTime2);
                //getMetaData2(startTime2, endTime2);
            }
        }
    });

    $("#endpicker1").change(function (event) {
        if (moment.utc($("#endpicker1").val()).valueOf() != endTime1) {
            endTime1 = moment.utc($("#endpicker1").val()).valueOf();
            if(validateDateRange(1)) {
                getTenantData1(startTime1, endTime1);
                //getMetaData1(startTime1, endTime1);
            }
        }
    });

    $("#endpicker2").change(function (event) {
        if (moment.utc($("#endpicker2").val()).valueOf() != endTime2) {
            endTime2 = moment.utc($("#endpicker2").val()).valueOf();
            if(validateDateRange(2)) {
                getTenantData2(startTime2, endTime2);
                //getMetaData2(startTime2, endTime2);
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
        getMetaData1(startTime1, endTime1, tenant1);
        //populateHostsSelector1(tenant1);
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
        getMetaData2(startTime2, endTime2, tenant2);
        //populateHostsSelector2(tenant2);
    });

    $("#host-input1").on("change", (event) => {
        host1 = $("#host-input1").val();
        profile1 = undefined;
        $("#bases1").empty();
        populateIDs1(tenant1, host1);
    });

    $("#host-input2").on("change", (event) => {
        host2 = $("#host-input2").val();
        profile2 = undefined;
        $("#bases2").empty();
        populateIDs2(tenant2, host2);
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
    $.ajax({
        url: URL, success: function (result) {
            tenantData2 = result;
            updateTenantDropdown2(start, end);
        }
    });
}

function getMetaData1(start, end, tenant) {
    let URL = getMetaDataURL(start, end, tenant);
    showSpinner();
    $.ajax({
        url: URL, success: function (result) {
            hideSpinner();
            metaData1 = result;
            populateHostsSelector1(tenant);
            //updateTenantDropdown1();
        }
    });
}

function getMetaData2(start, end, tenant) {
    let URL = getMetaDataURL(start, end, tenant);
    $.ajax({
        url: URL, success: function (result) {
            metaData2 = result;
            populateHostsSelector2(tenant);
            //updateTenantDropdown2();
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
    updateUrl("groupBy", 'tid');
    updateUrl("isCalltree", false);
    updateUrl("filterStack", '');
    updateUrl("filterReq", '');
    updateUrl("stack_id", '');
    updateUrl("spanThreshold", 200);
}

function updateTenantDropdown1(start, end) {
    let tenants = {};
    let tenantOptionHtml = "";
    const tenantDatalist = $("#tenants1");
    tenantDatalist.empty();
    if(tenantData1 != undefined) {
        for (let val in tenantData1) {
            tenantOptionHtml += "<option value=\"" + val + "\"></option>";
        }
    }

    /*for (var key in metaData1) {
        if (metaData1[key].metadata.tenant != undefined && tenants[metaData1[key].metadata.tenant] == undefined) {
            tenantOptionHtml += "<option value=\"" + metaData1[key].metadata.tenant + "\"></option>";
            tenants[metaData1[key].metadata.tenant] = 1;
        }
        if (metaData1[key].metadata.type == "jfrprofile" && jfrprofiles1[metaData1[key].metadata.name] == undefined) {
            jfrprofiles1[metaData1[key].metadata.name] = true;
        } else if (metaData1[key].metadata.type == "jfrevent" && jfrprofiles1[metaData1[key].metadata.name] == undefined) {
            jfrevents1[metaData1[key].metadata.name] = true;
        } else if (metaData1[key].metadata.type == "jstack" && jfrprofiles1[metaData1[key].metadata.name] == undefined) {
            jfrprofiles1[metaData1[key].metadata.name] = true;
        }
    }*/
    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    tenantDatalist.append(optGroupTemplate.replace("OPTIONS", tenantOptionHtml));
    if (tenant1 != undefined) {
        getMetaData1(start, end, tenant1);
        //populateHostsSelector1(tenant1);
    }
}

function updateTenantDropdown2(start, end) {
    let tenants = {};
    let tenantOptionHtml = "";
    const tenantDatalist = $("#tenants2");
    tenantDatalist.empty();

    if(tenantData2 != undefined) {
        for (let val in tenantData2) {
            tenantOptionHtml += "<option value=\"" + val + "\"></option>";
        }
    }

    /*for (var key in metaData2) {
        if (metaData2[key].metadata.tenant != undefined && metaData2[key].metadata.tenant != undefined && tenants[metaData2[key].metadata.tenant] == undefined) {
            tenantOptionHtml += "<option value=\"" + metaData2[key].metadata.tenant + "\"></option>";
            tenants[metaData2[key].metadata.tenant] = 1;
        }
        if (metaData2[key].metadata.type != undefined && metaData2[key].metadata.type == "jfrprofile" && jfrprofiles2[metaData2[key].metadata.name] == undefined) {
            jfrprofiles2[metaData2[key].metadata.name] = true;
        } else if (metaData2[key].metadata.type != undefined && metaData2[key].metadata.type == "jfrevent" && jfrprofiles2[metaData2[key].metadata.name] == undefined) {
            jfrevents2[metaData2[key].metadata.name] = true;
        } else if (metaData2[key].metadata.type != undefined && metaData2[key].metadata.type == "jstack" && jfrprofiles2[metaData2[key].metadata.name] == undefined) {
            jfrprofiles2[metaData2[key].metadata.name] = true;
        }
    }*/
    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    tenantDatalist.append(optGroupTemplate.replace("OPTIONS", tenantOptionHtml));
    if (tenant2 != undefined) {
        getMetaData2(start, end, tenant2);
        //populateHostsSelector2(tenant2);
    }
}


function populateHostsSelector1(tenant) {
    if (tenant == undefined || tenant == "") {
        return;
    }
    let hosts = {};
    let hostOptionHtml = "";
    const hostDatalist = $("#hosts1");
    hostDatalist.empty();
    $("#host-input1").val("");

    for (var key in metaData1) {
        if (hosts[metaData1[key].metadata.host] == undefined && (tenant === metaData1[key].metadata.tenant || tenant === metaData1[key].metadata["tenant-id"]) ) {
            if (host1 == metaData1[key].metadata.host || host1 == "") {
                $("#host-input1").val(metaData1[key].metadata.host);
            }
            hostOptionHtml += "<option value=\"" + metaData1[key].metadata.host + "\"></option>";
            hosts[metaData1[key].metadata.host] = 1;
        }
    }
    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    hostDatalist.append(optGroupTemplate.replace("OPTIONS", hostOptionHtml));
    if (tenant1 != undefined && host1 != undefined) {
        populateIDs1(tenant1, host1);
    }
}

function populateHostsSelector2(tenant) {
    if (tenant == undefined || tenant == "") {
        return;
    }
    let hosts = {};
    let hostOptionHtml = "";
    const hostDatalist = $("#hosts2");
    hostDatalist.empty();
    $("#host-input2").val("");

    for (var key in metaData2) {
        if (hosts[metaData2[key].metadata.host] == undefined && (tenant === metaData2[key].metadata.tenant || tenant === metaData2[key].metadata["tenant-id"])) {
            if (host2 == metaData2[key].metadata.host || host2 == "") {
                $("#host-input2").val(host2);
            }
            hostOptionHtml += "<option value=\"" + metaData2[key].metadata.host + "\"></option>";
            hosts[metaData2[key].metadata.host] = 1;
        }
    }
    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    hostDatalist.append(optGroupTemplate.replace("OPTIONS", hostOptionHtml));
    if (tenant2 != undefined && host2 != undefined) {
        populateIDs2(tenant2, host2);
    }
}

function updateTypes1(tenant, host){
    jfrevents1={};
    jfrprofiles1={};
    let profiles = {};
    try {
        for (var key in metaData1) {
            let name = metaData1[key].metadata["file-name"];
            let guid = metaData1[key].metadata["guid"];
            if (profiles[metaData1[key].metadata.guid] == undefined && (tenant === metaData1[key].metadata.tenant || tenant === metaData1[key].metadata["tenant-id"]) && host === metaData1[key].metadata.host) {
                let val = metaData1[key].timestampMillis + " - " + metaData1[key].metadata.guid;
                if (profile1 == val || profile1 == "All") {//update only for matching profile
                    if (name.includes("jfr_dump") && jfrprofiles1[name] == undefined && profile1 != "All") {//sfdc
                            if (name.includes("dump_log")) {
                                jfrevents1[name] = true;
                            } else if(!name.includes("sql")){
                                jfrprofiles1[name] = true;
                            }
                    }else if (metaData1[key].metadata.type == "jfrprofile" && jfrprofiles1[metaData1[key].metadata.name] == undefined) {
                        jfrprofiles1[metaData1[key].metadata.name] = true;
                    } else if (metaData1[key].metadata.type == "jfrevent" && jfrprofiles1[metaData1[key].metadata.name] == undefined) {
                        jfrevents1[metaData1[key].metadata.name] = true;
                    } else if (metaData1[key].metadata.type == "jstack" && jfrprofiles1[metaData1[key].metadata.name] == undefined) {
                        jfrprofiles1[metaData1[key].metadata.name] = true;
                    }
                }
            }
        }
    }catch(e){
        console.log(e);
    }
    console.log(jfrprofiles1);
}

function updateTypes2(tenant, host){
    jfrevents2={};
    jfrprofiles2={};
    let profiles = {};
    try {
        for (var key in metaData2) {
            let name = metaData2[key].metadata["file-name"];
            let guid = metaData2[key].metadata["guid"];
            if (profiles[metaData2[key].metadata.guid] == undefined && (tenant === metaData2[key].metadata.tenant || tenant === metaData2[key].metadata["tenant-id"]) && host === metaData2[key].metadata.host) {
                let val = metaData2[key].timestampMillis + " - " + metaData2[key].metadata.guid;
                if (profile2 == val || profile2 == "All") {//update only for matching profile
                    if (name.includes("jfr_dump") && jfrprofiles2[name] == undefined && profile2 != "All") {//sfdc
                        if (name.includes("data")) {
                            jfrevents2[name] = true;
                        } else {
                            jfrprofiles2[name] = true;
                        }
                    }else if (metaData2[key].metadata.type == "jfrprofile" && jfrprofiles2[metaData2[key].metadata.name] == undefined) {
                        jfrprofiles2[metaData2[key].metadata.name] = true;
                    } else if (metaData2[key].metadata.type == "jfrevent" && jfrprofiles2[metaData2[key].metadata.name] == undefined) {
                        jfrevents2[metaData2[key].metadata.name] = true;
                    } else if (metaData2[key].metadata.type == "jstack" && jfrprofiles2[metaData2[key].metadata.name] == undefined) {
                        jfrprofiles2[metaData2[key].metadata.name] = true;
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
    jfrEventMap = {};

    let profiles = {};
    let profileOptionHtml = "<option  value=''> Choose a profile... </option>";
    const baseDatalist = $("#bases1");
    baseDatalist.empty();
    let profileFound = false;
    let jstackFound = false;
    for (var key in metaData1) {
        if (metaData1[key].metadata["name"] != undefined && metaData1[key].metadata["name"] == "Jstack") {
            jstackFound = true;
            continue;
        }

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
            profileOptionHtml += "<option value=\"All\" selected>All</option>";
        } else {
            profileOptionHtml += "<option value=\"All\">All</option>";
        }
    } else if (jstackFound) {
        if (profile1 == "Jstacks") {
            profileOptionHtml += "<option value=\"Jstacks\" selected>Jstacks</option>";
        } else {
            profileOptionHtml += "<option value=\"Jstacks\">Jstacks</option>";
        }
    }
    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    baseDatalist.append(optGroupTemplate.replace("OPTIONS", profileOptionHtml));


}

function populateIDs2(tenant, host, clearInput) {
    if (tenant === undefined || tenant.length === 0 || host === undefined || host.length === 0) {
        return;
    }
    let profiles = {};
    let profileOptionHtml = "<option value=''> Choose a profile... </option>";
    const baseDatalist = $("#bases2");
    baseDatalist.empty();
    let profileFound = false;
    let jstackFound = false;
    for (var key in metaData2) {
        if (metaData2[key].metadata["name"] != undefined && metaData2[key].metadata["name"] == "Jstack") {
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
            profileOptionHtml += "<option value=\"All\" selected>All</option>";
        } else {
            profileOptionHtml += "<option value=\"All\">All</option>";
        }
    } else if (jstackFound) {
        if (profile1 == "Jstacks") {
            profileOptionHtml += "<option value=\"Jstacks\" selected>Jstacks</option>";
        } else {
            profileOptionHtml += "<option value=\"Jstacks\">Jstacks</option>";
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