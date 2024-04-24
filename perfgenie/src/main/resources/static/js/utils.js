/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

function getMetaDataURL(start,end,tenant='dev', host){
    const URL = "v1/meta/"+tenant+"/"+host+
        "/?start=" + start +
        "&end=" + end;
    return URL;
}

function getTenantDataURL(start,end,tenant='dev'){
    const URL = "v1/tenants/"+tenant+
        "/?start=" + start +
        "&end=" + end;
    return URL;
}


function getInstanceDataURL(start,end,tenant='dev'){
    const URL = "v1/instances/"+tenant+
        "/?start=" + start +
        "&end=" + end;
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

function updateUrl(key, value) {
    let newLocation = window.location.href.replace(new RegExp("((\\?|\\&)" + key + "=)[^\\&]*"), '$1' + encodeURIComponent(value));
    if (newLocation.indexOf(key) === -1) {
        const separator = (newLocation.indexOf("?") === -1) ? "?" : "&";
        newLocation = newLocation + separator + key + "=" + encodeURIComponent(value);
    }
    window.history.replaceState({}, "", newLocation);
}

function stackDigVizAjax(pod, method, endpoint, successFunc, errorFunc) {
    if (errorFunc === undefined) {
        errorFunc = defaultErrorFunc;
    }

    const headers = {};
    const errorFuncWithRetry = function () {
            return internalPerfGenieAjax(endpoint, method, successFunc, errorFunc, headers);
    };

    return internalPerfGenieAjax(endpoint, method, successFunc, errorFuncWithRetry, headers);
}