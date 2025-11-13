/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

function getMetaDataURL(start,end,tenant='dev', host, source){
    let URL = "v1/meta/"+tenant+"/"+host+
        "/?start=" + start +
        "&end=" + end;
    if(source == "genie"){
        URL += "&metadata_query=" + encodeURIComponent("source=" + source);
    }
    return URL;
}

function getGoldDataURL(start,end){
    let URL = "v1/gold/meta/?start=" + start +
        "&end=" + end;
        //URL += "&metadata_query=" + encodeURIComponent("source=gold");
    return URL;
}

function getTenantDataURL(start,end,tenant='dev'){
    let URL = "v1/tenants/"+tenant+
        "/?start=" + start +
        "&end=" + end;
    return URL;
}

function getBackupDataURL(start,end,tenant='dev', host, source){
    let URL = "v1/backup/"+tenant+"/"+host+
        "/?start=" + start +
        "&end=" + end;
    if(source == "genie"){
        URL += "&metadata_query=" + encodeURIComponent("source=" + source);
    }
    return URL;
}


function getKpodViewDataURL(start,end,tenant){
    //tenant format falcon-aws-prod2-apsouth1-core1-ind86
    let array = tenant?.split('-');
    let URL = undefined;
    if(array != undefined && array.length == 6){
        let cell = array[5];
        let domain = array[4];
        let instance = array[1] + '-' + array[2] + '-' + array[3];
        URL = "v1/kpodview/?start=" + start +
                "&end=" + end +
                "&cell=" + cell +
                "&domain=" + domain +
                "&instance=" + instance;
    }
    return URL;
}

function getInstanceDataURL(start,end,tenant='dev', source){
    let URL = "v1/instances/"+tenant+
        "/?start=" + start +
        "&end=" + end;
    if(source == "genie"){
        URL += "&metadata_query=" + encodeURIComponent("source=" + source);
    }
    return URL;
}

function getEventUrl(timeRange, tenant, host, customEvent){
    let endpoint = "";
    const start = parseInt(timeRange.split(" - ")[0]);
    const end = parseInt(timeRange.split(" - ")[1]);
    endpoint = "/v1/otherevents/" + tenant + "/?start=" + start + "&end=" + end +
        "&metadata_query=" + encodeURIComponent("host=" + host) +
        "&metadata_query=" + encodeURIComponent("tenant-id=" + tenant) +
        "&metadata_query=" + encodeURIComponent("name=" + customEvent);
    if(dataSource.includes("genie")){
        endpoint += "&metadata_query=" + encodeURIComponent("source=" + dataSource);
    }
    return endpoint;
}

// the url to get calling context trees
function getCallTreeUrl(timeRange, pod, query, profiler, tenant, profile, host, upload, fileId, uploadTime, aggregate, eventType) {
    // for debug console.log("getCallTreeUrl timeRange:" + timeRange + " pod:" + pod + " query:"+query + " profiler:" + profiler + " tenant:"+tenant + " profile:" + profile + " host:" + host + " upload:" + upload + " fileId:" + fileId + " uploadTime:" + uploadTime + " aggregate:" + aggregate)
    let endpoint = "";
    {
        //for any type of profile selection jstacks are handled in the same way
        if (eventType == "Jstack" || eventType == "json-jstack") {
            const start = parseInt(timeRange.split(" - ")[0]);
            const end = parseInt(timeRange.split(" - ")[1]);
            endpoint = "/v1/jstacks/" + tenant + "/?start=" + start + "&end=" + end +
                "&metadata_query=" + encodeURIComponent("host=" + host) +
                "&metadata_query=" + encodeURIComponent("tenant-id=" + tenant) +
                "&metadata_query=" + encodeURIComponent("file-name=" + eventType);
            if(dataSource.includes("genie")){
                endpoint += "&metadata_query=" + encodeURIComponent("source=" + dataSource);
            }
            return endpoint;
        }

        if (profile === "All") {
            const start = parseInt(timeRange.split(" - ")[0]);
            const end = parseInt(timeRange.split(" - ")[1]);
            if (eventType == "jfr-context" || eventType.includes("jfr_dump_log")) {
                endpoint = getCustomEventsURL(start, end, tenant, host, eventType);
            } else {
                endpoint = "/v1/profiles/" + tenant + "/?start=" + start + "&end=" + end +
                    "&metadata_query=" + encodeURIComponent("host=" + host) +
                    "&metadata_query=" + encodeURIComponent("tenant-id=" + tenant) +
                    "&metadata_query=" + encodeURIComponent("file-name=" + eventType);
            }
        } else if(profile === "Jstacks"){
            const start = parseInt(timeRange.split(" - ")[0]);
            const end = parseInt(timeRange.split(" - ")[1]);
            if (eventType == "jfr-context" || eventType.includes("jfr_dump_log")) {
                endpoint = getCustomEventsURL(start, end, tenant, host, eventType);
            }
        }else{
            let array = profile.split(" - ");
            const timestamp = array[0];
            let guid = eventType.includes("jfr_dump") ? array[1] + eventType : array[1];
            endpoint = getProfileURL(timestamp, tenant, host, guid, eventType);
        }
    }
    if(dataSource.includes("genie")){
        endpoint += "&metadata_query=" + encodeURIComponent("source=" + dataSource);
    }
    return endpoint;
}

function getCustomEventsURL(start, end, tenant, host, eventType){
    let URL = "/v1/customevents/" + tenant + "/?start=" + start + "&end=" + end +
        "&metadata_query=" + encodeURIComponent("host=" + host) +
        "&metadata_query=" + encodeURIComponent("tenant-id=" + tenant) +
        "&metadata_query=" + encodeURIComponent("file-name=" + eventType);
    return URL;
}
function getProfileURL(timestamp, tenant, host, guid, eventType){
    let URL = "/v1/profile/" + tenant + "/?start=" + timestamp + "&end=" + timestamp +
        "&metadata_query=" + encodeURIComponent("host=" + host) +
        "&metadata_query=" + encodeURIComponent("tenant-id=" + tenant) +
        "&metadata_query=" + encodeURIComponent("guid=" + guid) +
        "&metadata_query=" + encodeURIComponent("file-name=" + eventType);
    return URL;
}

function getDiagEventUrl(timestamp, tenant, host, guid, name){
    let endpoint = "/v1/event/" + tenant + "/?start=" + timestamp + "&end=" + timestamp +
        "&metadata_query=" + encodeURIComponent("host=" + host) +
        "&metadata_query=" + encodeURIComponent("tenant-id=" + tenant) +
        "&metadata_query=" + encodeURIComponent("guid=" + guid) +
        "&metadata_query=" + encodeURIComponent("name=" + name);
    if(dataSource.includes("genie")){
        endpoint += "&metadata_query=" + encodeURIComponent("source=" + dataSource);
    }
    return endpoint;
}
function getLargeFileDownloadURL(timestamp, guid, name, count){
    return "v1/download/" + (count == 1 ? tenant1 : tenant2) + "?timestamp=" + timestamp + "&metadata_query=" + encodeURIComponent("guid=" + guid) + "&metadata_query=" + encodeURIComponent("file-name=" + name);
}

function spinnerToggle(id){
//todo
}

function toastr_success(str){
    console.log(str);
}

function toastr_warning(str){
    console.log(str);
}

function toastr_error(str){
    console.log(str);
}

function updateTabUrl(tab){
    let newLocation = window.location.href.replace(new RegExp("(#.*)"), tab);
    if (newLocation.indexOf("#") === -1) {
        newLocation = newLocation + tab;
    }
    window.history.replaceState({}, "", newLocation);
}
function updateUrl(key, value) {
    const myArray = window.location.href.split("#");
    let newLocation = myArray[0];
    newLocation = newLocation.replace(new RegExp("((\\?|\\&)" + key + "=)[^\\&]*"), '$1' + encodeURIComponent(value));
    if (newLocation.indexOf(key) === -1) {
        const myArray = newLocation.split("#");
        newLocation = myArray[0];
        const separator = (newLocation.indexOf("?") === -1) ? "?" : "&";
        newLocation = newLocation + separator + key + "=" + encodeURIComponent(value);
    }
    if(myArray[1] != undefined){
        newLocation = newLocation + "#" + myArray[1];
    }
    window.history.replaceState({}, "", newLocation);
}

function stackDigVizAjax(pod, method, endpoint, successFunc, errorFunc) {
    if (errorFunc === undefined) {
        errorFunc = defaultErrorFunc;
    }
    const headers = { 'x-envoy-upstream-rq-timeout-ms': 600001,
        'x-envoy-max-retries': 1,
        'x-envoy-upstream-rq-per-try-timeout-ms': 600000
    };
    const errorFuncWithRetry = function () {
            return internalPerfGenieAjax(endpoint, method, successFunc, errorFunc, headers);
    };

    return internalPerfGenieAjax(endpoint, method, successFunc, errorFuncWithRetry, headers);
}

const toastType = {
    INFO: 1,
    WARNING: 2,
    ERROR: 3
};
Object.freeze(toastType);

function toastMessage(type, msg, d = 5000){
    if(type == toastType.INFO) {
        Toastify({
            text: msg,
            backgroundColor: "linear-gradient(135deg, #73a5ff, #5477f5)",
            duration: d,
            close: true
        }).showToast();
    }else if(type == toastType.WARNING){
        Toastify({
            text: msg,
            backgroundColor: "linear-gradient(135deg, #FAC898, orange)",
            duration: d,
            close: true
        }).showToast();
    }else if(type == toastType.ERROR){
        Toastify({
            text: msg,
            backgroundColor: "linear-gradient(135deg, #FFAB91, #FF7043)",
            duration: d,
            close: true
        }).showToast();
    }


}

function showSpinner(id) {
    if(id === undefined){
        id = "spinner";
    }
    document.getElementById(id).style.display = 'block';
}

// Function to hide the spinner
function hideSpinner(id) {
    if(id === undefined){
        id = "spinner";
    }
    if(document.getElementById(id) != undefined) {
        document.getElementById(id).style.display = 'none';
    }
}