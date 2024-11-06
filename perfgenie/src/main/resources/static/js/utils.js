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

function getTenantDataURL(start,end,tenant='dev'){
    let URL = "v1/tenants/"+tenant+
        "/?start=" + start +
        "&end=" + end;
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

function getEventURL(tenant,start,end,host){
    const URLUnprocessedIDsOld = "v1/events/" +  tenant +
        "?start=" + start +
        "&end=" + end +
        "&metadata_query=" + encodeURIComponent("host=" + host) +
        "&metadata_query=" + encodeURIComponent("tenant-id=" + tenant) +
        "&metadata_query=" + encodeURIComponent("name=jfr");
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