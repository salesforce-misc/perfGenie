/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

let metaData1 = undefined;
let metaData2 = undefined;
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

let jfrprofiles1 = {};
let jfrprofiles2 = {};
let jfrevents1 = {};
let jfrevents2 = {};
const urlParams = new URLSearchParams(window.location.search);

$( function() {
    startTime1 = Number(urlParams.get('startTime1')) || moment(moment().subtract('minute', 10).format('YYYY-MM-DD HH:mm:ss')).valueOf();
    startTime2 = Number(urlParams.get('startTime2')) || moment(moment().subtract('minute', 24*60+10).format('YYYY-MM-DD HH:mm:ss')).valueOf();
    endTime1=Number(urlParams.get('endTime1')) || moment(moment().format('YYYY-MM-DD HH:mm:ss')).valueOf();
    endTime2 = Number(urlParams.get('endTime2')) || moment(moment().subtract('minute', 24*60).format('YYYY-MM-DD HH:mm:ss')).valueOf();
    host1=urlParams.get('host1') || undefined;
    host2=urlParams.get('host2') || undefined;
    tenant1=urlParams.get('tenant1') || undefined;
    tenant2=urlParams.get('tenant2') || undefined;
    profile1=urlParams.get('profile1') || undefined;
    profile2=urlParams.get('profile2') || undefined;
    let tempstr=urlParams.get('types') || undefined;
    if(tempstr != undefined){
        let tokens = tempstr.split("\:");
        tokens.forEach(tok => {
            if(tok != ""){
                jfrprofiles1[tok] = true;
            }
        });
    }
    tempstr=urlParams.get('events') || undefined;
    if(tempstr != undefined){
        let tokens = tempstr.split("\:");
        tokens.forEach(tok => {
            if(tok != ""){
                jfrevents1[tok] = true;
            }
        });
    }

    $("#startpicker1").val(moment(startTime1).format('YYYY-MM-DD HH:mm:ss'));
    $("#endpicker1").val(moment(endTime1).format('YYYY-MM-DD HH:mm:ss'));
    $("#startpicker2").val(moment(startTime2).format('YYYY-MM-DD HH:mm:ss'));
    $("#endpicker2").val(moment(endTime2).format('YYYY-MM-DD HH:mm:ss'));

    $("#tenant-input1").val(tenant1);
    $("#tenant-input2").val(tenant2);
    $("#host-input1").val(host1);
    $("#host-input2").val(host2);
    $("#bases1").val(profile1);
    $("#bases2").val(profile2);

    getMetaData1(getStart1(),getEnd1());
    getMetaData2(getStart2(),getEnd2());

    $("#startpicker1").change(function (event) {
        if(moment($("#startpicker1").val()).valueOf() != startTime1){
            startTime1=moment($("#startpicker1").val()).valueOf();
            getMetaData1(startTime1,endTime1);
        }
    });

    $("#startpicker2").change(function (event) {
        if(moment($("#startpicker2").val()).valueOf() != startTime2){
            startTime2=moment($("#startpicker2").val()).valueOf();
            getMetaData2(startTime2,endTime2);
        }
    });

    $("#endpicker1").change(function (event) {
        if(moment($("#endpicker1").val()).valueOf() != endTime1){
            endTime1=moment($("#endpicker1").val()).valueOf();
            getMetaData1(startTime1,endTime1);
        }
    });

    $("#endpicker2").change(function (event) {
        if(moment($("#endpicker2").val()).valueOf() != endTime2){
            endTime2=moment($("#endpicker2").val()).valueOf();
            getMetaData2(startTime2,endTime2);
        }
    });

    $("#tenant-input1").on("change", (event) => {
        tenant1 = $("#tenant-input1").val();
        host1=undefined;
        profile1=undefined;
        $("#hosts1").empty();
        $("#host-input1").val("");
        $("#bases1").empty();

        populateHostsSelector1(tenant1);
    });

    $("#tenant-input2").on("change", (event) => {
        tenant2 = $("#tenant-input2").val();
        host2=undefined;
        profile2=undefined;
        $("#hosts2").empty();
        $("#host-input2").val("");
        $("#bases2").empty();
        populateHostsSelector2(tenant2);
    });

    $("#host-input1").on("change", (event) => {
        host1 = $("#host-input1").val();
        profile1=undefined;
        $("#bases1").empty();
        populateIDs1(tenant1,host1);
    });

    $("#host-input2").on("change", (event) => {
        host2 = $("#host-input2").val();
        profile2=undefined;
        $("#bases2").empty();
        populateIDs2(tenant2,host2);
    });

    $("#bases1").on("change", (event) => {
        profile1 = $("#bases1").val();
    });

    $("#bases2").on("change", (event) => {
        profile2 = $("#bases2").val();
    });

    jQuery("#startpicker1").datetimepicker({
        format:'Y-m-d H:i:s',
        formatDate:'Y-m-d',
        formatTime:'H:i',
        step:1
    });

    jQuery("#endpicker1").datetimepicker({
        format:'Y-m-d H:i:s',
        formatDate:'Y-m-d',
        formatTime:'H:i',
        step:5
    });

    jQuery("#startpicker2").datetimepicker({
        format:'Y-m-d H:i:s',
        formatDate:'Y-m-d',
        formatTime:'H:i',
        step:5
    });

    jQuery("#endpicker2").datetimepicker({
        format:'Y-m-d H:i:s',
        formatDate:'Y-m-d',
        formatTime:'H:i',
        step:1
    });

    $("#update").click(function(){
        addInputToURL();
    });

});

function submitTo(){
    window.location.reload(true);
}

function getMetaData1(start,end){
    let URL = getMetaDataURL(start,end);
    $.ajax({url: URL, success: function(result){
            metaData1 = result;
            updateTenantDropdown1();
            //$("#cct").text(JSON.stringify(result));
        }});
}

function getMetaData2(start,end){
    let URL = getMetaDataURL(start,end);
    $.ajax({url: URL, success: function(result){
            metaData2 = result;
            updateTenantDropdown2();
        }});
}

function addInputToURL(){
    if(startTime1 != undefined) {updateUrl("startTime1",startTime1);}
    else{updateUrl("startTime1","");}
    if(startTime2 != undefined) {updateUrl("startTime2",startTime2);}
    else{updateUrl("startTime2","");}

    if(endTime1 != undefined) {updateUrl("endTime1",endTime1);}
    else{updateUrl("endTime1","");}
    if(endTime2 != undefined) {updateUrl("endTime2",endTime2);}
    else{updateUrl("endTime2","");}

    if(host1 != undefined) {updateUrl("host1",host1);}
    else{updateUrl("host1","");}
    if(host2 != undefined) {updateUrl("host2",host2);}
    else{updateUrl("host2","");}

    if(tenant1 != undefined) {updateUrl("tenant1",tenant1);}
    else{updateUrl("tenant1","");}
    if(tenant2 != undefined) {updateUrl("tenant2",tenant2);}
    else{updateUrl("tenant2","");}

    if(profile1 != undefined) {updateUrl("profile1",profile1);}
    else{updateUrl("profile1","");}
    if(profile2 != undefined) {updateUrl("profile2",profile2);}
    else{updateUrl("profile2","");}

    let types = "";
    for (var key in jfrprofiles1) {
        types = types + key + ":";
    }
    let events = "";
    for (var key in jfrevents1) {
        events = events + key + ":";
    }
    updateUrl("types",types);
    updateUrl("events",events);

    //reset
    updateUrl("filterEvent",'');
    updateUrl("customevent",'');
    updateUrl("groupBy",'tid');
    updateUrl("isCalltree",false);
    updateUrl("filterStack",'');
    updateUrl("filterReq",'');
    updateUrl("stack_id",'');
    updateUrl("spanThreshold",200);
}

function updateTenantDropdown1() {
    let tenants = {};
    let tenantOptionHtml = "";
    const tenantDatalist = $("#tenants1");
    tenantDatalist.empty();

    for (var key in metaData1) {
        if(metaData1[key].metadata.tenant != undefined && tenants[metaData1[key].metadata.tenant] == undefined){
            tenantOptionHtml += "<option value=\"" + metaData1[key].metadata.tenant + "\"></option>";
            tenants[metaData1[key].metadata.tenant]=1;
        }
        if(metaData1[key].metadata.type == "jfrprofile" && jfrprofiles1[metaData1[key].metadata.name] == undefined){
            jfrprofiles1[metaData1[key].metadata.name] = true;
        }else if(metaData1[key].metadata.type == "jfrevent" && jfrprofiles1[metaData1[key].metadata.name] == undefined){
            jfrevents1[metaData1[key].metadata.name] = true;
        }else if(metaData1[key].metadata.type == "jstack" && jfrprofiles1[metaData1[key].metadata.name] == undefined){
            jfrprofiles1[metaData1[key].metadata.name] = true;
        }
    }
    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    tenantDatalist.append(optGroupTemplate.replace("OPTIONS", tenantOptionHtml));
    if(tenant1 != undefined){
        populateHostsSelector1(tenant1);
    }
}

function updateTenantDropdown2() {
    let tenants = {};
    let tenantOptionHtml = "";
    const tenantDatalist = $("#tenants2");
    tenantDatalist.empty();

    for (var key in metaData2) {
        if(metaData2[key].metadata.tenant != undefined && metaData2[key].metadata.tenant != undefined && tenants[metaData2[key].metadata.tenant] == undefined){
            tenantOptionHtml += "<option value=\"" + metaData2[key].metadata.tenant + "\"></option>";
            tenants[metaData2[key].metadata.tenant]=1;
        }
        if(metaData2[key].metadata.type != undefined && metaData2[key].metadata.type == "jfrprofile" && jfrprofiles2[metaData2[key].metadata.name] == undefined){
            jfrprofiles2[metaData2[key].metadata.name] = true;
        }else if(metaData2[key].metadata.type != undefined && metaData2[key].metadata.type == "jfrevent" && jfrprofiles2[metaData2[key].metadata.name] == undefined){
            jfrevents2[metaData2[key].metadata.name] = true;
        }else if(metaData2[key].metadata.type != undefined && metaData2[key].metadata.type == "jstack" && jfrprofiles2[metaData2[key].metadata.name] == undefined){
            jfrprofiles2[metaData2[key].metadata.name] = true;
        }
    }
    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    tenantDatalist.append(optGroupTemplate.replace("OPTIONS", tenantOptionHtml));
    if(tenant2 != undefined){
        populateHostsSelector2(tenant2);
    }
}


function populateHostsSelector1(tenant) {
    if(tenant == undefined || tenant == ""){
        return;
    }
    let hosts = {};
    let hostOptionHtml = "";
    const hostDatalist = $("#hosts1");
    hostDatalist.empty();
    $("#host-input1").val("");
    for (var key in metaData1) {
        if(hosts[metaData1[key].metadata.host] == undefined && tenant === metaData1[key].metadata.tenant){
            if(host1 == metaData1[key].metadata.host || host1 == "") {
                $("#host-input1").val(metaData1[key].metadata.host);
            }
            hostOptionHtml += "<option value=\"" + metaData1[key].metadata.host + "\"></option>";
            hosts[metaData1[key].metadata.host]=1;
        }
    }
    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    hostDatalist.append(optGroupTemplate.replace("OPTIONS", hostOptionHtml));
    if(tenant1 != undefined && host1 != undefined){
        populateIDs1(tenant1,host1);
    }
}

function populateHostsSelector2(tenant) {
    if(tenant == undefined || tenant == ""){
        return;
    }
    let hosts = {};
    let hostOptionHtml = "";
    const hostDatalist = $("#hosts2");
    hostDatalist.empty();
    $("#host-input2").val("");
    for (var key in metaData2) {
        if(hosts[metaData2[key].metadata.host] == undefined && tenant === metaData2[key].metadata.tenant){
            if(host2 == metaData2[key].metadata.host || host2 == "") {
                $("#host-input2").val(host2);
            }
            hostOptionHtml += "<option value=\"" + metaData2[key].metadata.host + "\"></option>";
            hosts[metaData2[key].metadata.host]=1;
        }
    }
    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    hostDatalist.append(optGroupTemplate.replace("OPTIONS", hostOptionHtml));
    if(tenant2 != undefined && host2 != undefined){
        populateIDs2(tenant2,host2);
    }
}

function populateIDs1(tenant, host, clearInput) {
    if (tenant === undefined || tenant.length === 0 || host === undefined || host.length === 0) {
        return;
    }
    let profiles = {};
    let profileOptionHtml = "<option  value=''> Choose a profile... </option>";
    const baseDatalist = $("#bases1");
    baseDatalist.empty();
    let profileFound=false;
    let jstackFound=false;
    for (var key in metaData1) {
        if(metaData1[key].metadata["name"] != undefined && metaData1[key].metadata["name"] == "Jstack"){
            jstackFound=true;
            continue;
        }
        if(profiles[metaData1[key].metadata.guid] == undefined && tenant === metaData1[key].metadata.tenant && host === metaData1[key].metadata.host){
            let str = moment(metaData1[key].timestampMillis).format("YYYY-MM-DD HH:mm:ss");
            let val = metaData1[key].timestampMillis +" - "+metaData1[key].metadata.guid;
            if(profile1 == val || profile1 == ""){
                profile1=val;
                profileOptionHtml += "<option value=\"" + val + "\" selected>" + str + ":" + metaData1[key].metadata["file-name"] + "</option>";
            }else {
                profileOptionHtml += "<option value=\"" + val + "\">" + str + ":" + metaData1[key].metadata["file-name"] + "</option>";
            }
            profileFound=true;
            profiles[metaData1[key].metadata.guid]=1;
        }
    }
    if(profileFound){
        if(profile1 == "All") {
            profileOptionHtml += "<option value=\"All\" selected>All</option>";
        }else{
            profileOptionHtml += "<option value=\"All\">All</option>";
        }
    }else if(jstackFound){
        if(profile1 == "Jstacks") {
            profileOptionHtml += "<option value=\"Jstacks\" selected>Jstacks</option>";
        }else{
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
    let profileFound=false;
    let jstackFound=false;
    for (var key in metaData2) {
        if(metaData2[key].metadata["name"] != undefined && metaData2[key].metadata["name"] == "Jstack"){
            jstackFound=true;
            continue;
        }
        if(profiles[metaData2[key].metadata.guid] == undefined && tenant === metaData2[key].metadata.tenant && host === metaData2[key].metadata.host){
            let str = moment(metaData2[key].timestampMillis).format("YYYY-MM-DD HH:mm:ss");
            let val = metaData2[key].timestampMillis +" - "+metaData2[key].metadata.guid;
            if(profile2 == val || profile2 == ""){
                profile2=val;
                profileOptionHtml += "<option value=\"" + val + "\" selected>" + str + ":" + metaData2[key].metadata["file-name"] + "</option>";
            }else {
                profileOptionHtml += "<option value=\"" + val + "\">" + str + ":" + metaData2[key].metadata["file-name"] + "</option>";
            }
            profiles[metaData2[key].metadata.guid]=1;
            profileFound=true;
        }
    }

    if(profileFound){
        if(profile2 == "All") {
            profileOptionHtml += "<option value=\"All\" selected>All</option>";
        }else{
            profileOptionHtml += "<option value=\"All\">All</option>";
        }
    }else if(jstackFound){
        if(profile1 == "Jstacks") {
            profileOptionHtml += "<option value=\"Jstacks\" selected>Jstacks</option>";
        }else{
            profileOptionHtml += "<option value=\"Jstacks\">Jstacks</option>";
        }
    }
    const optGroupTemplate = '<optgroup label="">OPTIONS</optgroup>';
    baseDatalist.append(optGroupTemplate.replace("OPTIONS", profileOptionHtml));
}

function getStart1(){
    return startTime1;
}

function getEnd1(){
    return endTime1;
}

function getStart2(){
    return startTime2;
}

function getEnd2(){
    return endTime2;
}