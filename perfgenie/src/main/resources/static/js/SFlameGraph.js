/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

class SFlameGraph {
    #flameSvgRowHeight = 16;
    #flameMaxSvgHeight = this.#flameSvgRowHeight * 128; //max stack depth 128
    #flameSvgHeight = 0;
    #flameSvgWidth = 1000;
    #flameGraphActiveTree = undefined;
    #flameGraphSearch = false;
    #flameGraphSearchStr = "";
    #flameGraphPath = "";
    #flameGraphClickDepth = 0;
    #SFlameGraphTooltip = undefined;
    #SFlameGraphDiv = "#flame-graph-guid";
    #SFlameGraphDetailsDiv = "#flame-graph-details-guid";
    #SFlameGraphCustomMenuDiv = "#custom-menu-guid";
    #threshold = 0.01;
    #sizeKey = 'sz';
    #nameKey = 'nm';
    #childrenKey = 'ch';
    #leftKey = 'bsz';
    #rightKey = 'csz';
    #pixelThreshold = 0.5;
    #filterOption = 1; // 1 show all, 2 do not show right, 3 do not show left
    #isCompare = false;
    #searchMatchCount = 0;
    #SFlameGraphcontextMenu = this.flameGraphcontextMenu;

    getSearchMatchCount(){
        return SFlameGraph.instance.#searchMatchCount;
    }

    constructor() {
        if (!SFlameGraph.instance) {
            SFlameGraph.instance = this;
        }
        return SFlameGraph.instance;
    }

    setContextMenu(f){
        SFlameGraph.instance.#SFlameGraphcontextMenu=f;
    }

    setRightKey(key){
        SFlameGraph.instance.#rightKey=key;
    }

    setLeftKey(key){
        SFlameGraph.instance.#leftKey=key;
    }

    setPixelThreshold(threshold){
        SFlameGraph.instance.#pixelThreshold=threshold;
    }

    setFilterOption(option){
        SFlameGraph.instance.#filterOption=option;
    }

    setIsCompare(isCompare){
        SFlameGraph.instance.#isCompare=isCompare;
    }

    setThreshold(threshold){
        SFlameGraph.instance.#threshold=threshold;
    }

    setSizeKey(key){
        SFlameGraph.instance.#sizeKey=key;
    }
    setNameKey(key){
        SFlameGraph.instance.#nameKey=key;
    }
    setChildrenKey(key){
        SFlameGraph.instance.#childrenKey=key;
    }

    setSFlameGraphDivId(id){
        SFlameGraph.instance.#SFlameGraphDiv='#'+id;
    }

    setSFlameGraphDetailsDiv(id){
        SFlameGraph.instance.#SFlameGraphDetailsDiv='#'+id;
    }

    setSFlameGraphCustomMenuDiv(id){
        SFlameGraph.instance.#SFlameGraphCustomMenuDiv='#'+id;
    }

    showTreeV1Flame(treeToProcess, searchString) {
        if($(SFlameGraph.instance.#SFlameGraphDetailsDiv).length < 1){
            $(SFlameGraph.instance.#SFlameGraphDiv).after(
                '<div id="'+SFlameGraph.instance.#SFlameGraphDetailsDiv.substring(1)+'"></div>' +
                '<ul id="custom-menu-guid" class="items"> <li>Copy</li> <li>Reset Zoom</li> </ul>'
            );
        }
        $(SFlameGraph.instance.#SFlameGraphDetailsDiv).html("");
        SFlameGraph.instance.#searchMatchCount = 0;
        if (searchString != "" && searchString != undefined) {
            SFlameGraph.instance.#flameGraphSearch = true;
            SFlameGraph.instance.#flameGraphSearchStr = searchString;
        } else {
            SFlameGraph.instance.#flameGraphSearch = false;
            SFlameGraph.instance.#flameGraphSearchStr = "";
        }

        if (SFlameGraph.instance.#flameGraphPath != "" && SFlameGraph.instance.#flameGraphClickDepth != 0 && SFlameGraph.instance.#flameGraphActiveTree == treeToProcess) {
            SFlameGraph.instance.showClickedFlame(SFlameGraph.instance.#flameGraphPath, SFlameGraph.instance.#flameGraphClickDepth);
            return;
        } else {
            SFlameGraph.instance.#flameGraphPath = "";
            SFlameGraph.instance.#flameGraphClickDepth = 0;
        }

        SFlameGraph.instance.#flameGraphActiveTree = treeToProcess;
        SFlameGraph.instance.#flameSvgHeight = 0;
        $(SFlameGraph.instance.#SFlameGraphDiv).html("<div id='flamegraphdiv' class='row col-lg-12' style='padding-left: ;: 10px !important;'></div>");

        d3.select("#flamegraphdiv").append("svg").attr("width", $(SFlameGraph.instance.#SFlameGraphDiv).width()).attr("height", SFlameGraph.instance.#flameMaxSvgHeight);
        SFlameGraph.instance.#flameSvgWidth = $(SFlameGraph.instance.#SFlameGraphDiv).width();

        SFlameGraph.instance.addSVGRect(SFlameGraph.instance.#flameGraphActiveTree, SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#sizeKey], SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#nameKey], 0, "", 1);

        SFlameGraph.instance.genSVG(SFlameGraph.instance.#flameGraphActiveTree, SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#sizeKey], 2, 0, "");

        $(SFlameGraph.instance.#SFlameGraphDiv).height(SFlameGraph.instance.#flameSvgHeight);
        $(SFlameGraph.instance.#SFlameGraphDiv).scrollTop($(SFlameGraph.instance.#SFlameGraphDiv)[0].scrollHeight);

        SFlameGraph.instance.#SFlameGraphTooltip = d3.select("#flamegraphdiv").append("div")
            .attr("class", "SFlameGraphTooltip")
            .style("opacity", 0);
    }

    genSVG(tree, total, depth, x, path) {
        //skip sub tree for below given threshold
        if (100 * tree[SFlameGraph.instance.#sizeKey] / total < SFlameGraph.instance.#threshold) {
            return false;
        }
        let skip = false;
        if (tree[SFlameGraph.instance.#childrenKey] == null) {
            tree[SFlameGraph.instance.#childrenKey] = [];
        }
        let nx = x;

        let index = 0;
        tree[SFlameGraph.instance.#childrenKey].forEach(function (child) {
            if (skip || child[SFlameGraph.instance.#sizeKey] === undefined || child[SFlameGraph.instance.#sizeKey] === 0 || isSkipSubtree(child[SFlameGraph.instance.#sizeKey], 0)) {
                return;
            }
            if (100 * child[SFlameGraph.instance.#sizeKey] / total < SFlameGraph.instance.#threshold) {
                if (tree[SFlameGraph.instance.#childrenKey].length > 1) {
                    SFlameGraph.instance.addSVGRect(child, total, "...", nx, path + index + ":", depth);
                } else {
                    SFlameGraph.instance.addSVGRect(child, total, "...", nx, path, depth);
                }
                skip = true;
            } else if (tree[SFlameGraph.instance.#childrenKey].length > 0) {
                if (tree[SFlameGraph.instance.#childrenKey].length > 1) {
                    SFlameGraph.instance.addSVGRect(child, total, child[SFlameGraph.instance.#nameKey], nx, path + index + ":", depth);
                    if (!SFlameGraph.instance.genSVG(child, total, depth + 1, nx, path + index + ":")) {
                        SFlameGraph.instance.addSVGRect(child, total, "...", nx, path, depth);
                    }
                } else {
                    SFlameGraph.instance.addSVGRect(child, total, child[SFlameGraph.instance.#nameKey], nx, path, depth);
                    if (!SFlameGraph.instance.genSVG(child, total, depth + 1, nx, path)) {
                        SFlameGraph.instance.addSVGRect(child, total, "...", nx, path, depth);
                    }
                }
                nx += SFlameGraph.instance.#flameSvgWidth * child[SFlameGraph.instance.#sizeKey] / total;
            }
            index++;
        });
        return true;
    }

    addSVGRect(child, total, id, x, path, depth, dull = false) {
        let width = child[SFlameGraph.instance.#sizeKey]/total;
        let sz = child[SFlameGraph.instance.#sizeKey];

        if (SFlameGraph.instance.#flameSvgHeight < SFlameGraph.instance.#flameSvgRowHeight * depth) {
            SFlameGraph.instance.#flameSvgHeight = SFlameGraph.instance.#flameSvgRowHeight * depth;
        }
        //it does not make sense to show such a small rects unless clicked on a cell to see deeper
        if (SFlameGraph.instance.#flameSvgWidth * width < SFlameGraph.instance.#pixelThreshold && depth > 1 && SFlameGraph.instance.#flameGraphClickDepth == 0) {
            return;
        }

        let fN = getFrameName(id);
        /*if (SFlameGraph.instance.#flameSvgWidth * width >= 50) { //this block will improve some performance but but hover and click will work only on text when text added
            d3.select("#flamegraphdiv").select("svg").append("rect")
                .attr("width", SFlameGraph.instance.#flameSvgWidth * width)
                .attr("height", SFlameGraph.instance.#flameSvgRowHeight)
                .attr("x", x)
                .attr("y", SFlameGraph.instance.#flameMaxSvgHeight - SFlameGraph.instance.#flameSvgRowHeight * depth)
                .attr("fill", SFlameGraph.instance.getFlameColor(dull, id))
                .attr("class", "testclass")
                .style("cursor", "default");
        }else */{
            d3.select("#flamegraphdiv").select("svg").append("rect")
                .attr("width", SFlameGraph.instance.#flameSvgWidth * width)
                .attr("height", SFlameGraph.instance.#flameSvgRowHeight)
                .attr("p", path)
                .attr("d", depth)
                .attr("x", x)
                .attr("y", SFlameGraph.instance.#flameMaxSvgHeight - SFlameGraph.instance.#flameSvgRowHeight * depth)
                .attr("stroke", SFlameGraph.instance.#flameSvgWidth * width < 3 ? "none" : "white")
                .attr("fill", SFlameGraph.instance.getFlameColor(dull, id))
                .attr("class", "testclass")
                .attr("onclick", 'SFlameGraph.instance.svgShowFlame(evt)')
                .attr("id", id)
                .on("contextmenu", function () {
                    return SFlameGraph.instance.#SFlameGraphcontextMenu(fN);
                    //return SFlameGraph.instance.flameGraphcontextMenu(fN);
                })
                .on("mouseover", function () {
                    return SFlameGraph.instance.mouseoverFlame(id, this, width * SFlameGraph.instance.#flameSvgWidth);
                })
                .on("mousemove", function () {
                    return SFlameGraph.instance.mousemoveFlame(id, this, sz, total);
                })
                .on("mouseleave", function () {
                    return SFlameGraph.instance.mouseleaveFlame(id, this);
                });
        }
        if (SFlameGraph.instance.#flameSvgWidth * width >= 50) {
            d3.select("#flamegraphdiv").select("svg").append('text').text(SFlameGraph.instance.getFlameRectText(width * SFlameGraph.instance.#flameSvgWidth, fN))
                .attr('x', x + 3)
                .attr('y', SFlameGraph.instance.#flameMaxSvgHeight - SFlameGraph.instance.#flameSvgRowHeight * depth + 12)
                .attr('fill', 'black')
                .style('font-size', '14px')
                .style('font-family', '"Open Sans", sans-serif')
                .attr("onclick", 'SFlameGraph.instance.svgShowFlame(evt)')
                .attr("id", id)
                .attr("p", path)
                .attr("d", depth)
                .on("contextmenu", function () {
                    return SFlameGraph.instance.#SFlameGraphcontextMenu(fN);
                    //return SFlameGraph.instance.flameGraphcontextMenu(fN);
                })
                .on("mouseover", function () {
                    return SFlameGraph.instance.mouseoverFlame(id, this, width * SFlameGraph.instance.#flameSvgWidth);
                })
                .on("mousemove", function () {
                    return SFlameGraph.instance.mousemoveFlame(id, this, sz, total);
                })
                .on("mouseleave", function () {
                    return SFlameGraph.instance.mouseleaveFlame(id, this);
                });
        }
    }

    svgShowFlame(evt) {
        var svgobj = evt.target;
        if (svgobj.getAttribute("style") == undefined || !svgobj.getAttribute("style").includes("opacity: 0")) {
            const paths = svgobj.getAttribute("p").split(":");
            let clickDepth = Number(svgobj.getAttribute("d"));
            SFlameGraph.instance.#flameGraphPath = paths;
            SFlameGraph.instance.#flameGraphClickDepth = clickDepth;
            if(SFlameGraph.instance.#isCompare){
                SFlameGraph.instance.showClickedFlameCompare(paths, clickDepth);
            }else{
                SFlameGraph.instance.showClickedFlame(paths, clickDepth);
            }
        }
    }

    showClickedFlame(paths, clickDepth) {
        d3.select("#flamegraphdiv").select("svg").selectAll("*").remove();
        if (paths.length == 1 && clickDepth == 1) {
            SFlameGraph.instance.#flameGraphPath = "";
            SFlameGraph.instance.#flameGraphClickDepth = 0;
            //full svg
            SFlameGraph.instance.addSVGRect(SFlameGraph.instance.#flameGraphActiveTree, SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#sizeKey], SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#nameKey], 0, "", 1);
            SFlameGraph.instance.genSVG(SFlameGraph.instance.#flameGraphActiveTree, SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#sizeKey], 2, 0, "");
        } else {
            //find click node
            SFlameGraph.instance.addSVGRect(SFlameGraph.instance.#flameGraphActiveTree, SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#sizeKey], SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#nameKey], 0, "", 1, true);
            let tmpCh = SFlameGraph.instance.#flameGraphActiveTree;
            let curDepth = 1;
            let curPathIndex = 0;
            let curPath = "";
            while (curDepth < clickDepth) {
                while (tmpCh[SFlameGraph.instance.#childrenKey].length == 1 && curDepth < clickDepth) {
                    tmpCh = tmpCh[SFlameGraph.instance.#childrenKey][0];
                    curDepth++;

                    if (curDepth == clickDepth) {
                        SFlameGraph.instance.addSVGRect(tmpCh, tmpCh[SFlameGraph.instance.#sizeKey], tmpCh[SFlameGraph.instance.#nameKey], 0, curPath, curDepth);
                        SFlameGraph.instance.genSVG(tmpCh, tmpCh[SFlameGraph.instance.#sizeKey], curDepth + 1, 0, curPath);
                    } else {
                        SFlameGraph.instance.addSVGRect(tmpCh, tmpCh[SFlameGraph.instance.#sizeKey], tmpCh[SFlameGraph.instance.#nameKey], 0, curPath, curDepth, true);
                    }
                }
                if (curDepth < clickDepth) {
                    curPath = curPath + Number(paths[curPathIndex]) + ":";
                    curDepth++;
                    if (tmpCh[SFlameGraph.instance.#childrenKey][Number(paths[curPathIndex])] == undefined) {
                        console.log("warning1");
                    }
                    tmpCh = tmpCh[SFlameGraph.instance.#childrenKey][Number(paths[curPathIndex])];

                    if (curDepth == clickDepth) {
                        SFlameGraph.instance.addSVGRect(tmpCh, tmpCh[SFlameGraph.instance.#sizeKey], tmpCh[SFlameGraph.instance.#nameKey], 0, curPath, curDepth);
                        SFlameGraph.instance.genSVG(tmpCh, tmpCh[SFlameGraph.instance.#sizeKey], curDepth + 1, 0, curPath);
                    } else {
                        if (tmpCh == undefined) {
                            console.log("warning2");
                        }
                        SFlameGraph.instance.addSVGRect(tmpCh, tmpCh[SFlameGraph.instance.#sizeKey], tmpCh[SFlameGraph.instance.#nameKey], 0, curPath, curDepth, true);
                    }
                    curPathIndex++;
                }
            }
        }
    }

    showTreeV1FlameCompare(treeToProcess, searchString) {
        if($(SFlameGraph.instance.#SFlameGraphDetailsDiv).length < 1){
            $(SFlameGraph.instance.#SFlameGraphDiv).after(
                '<div id="'+SFlameGraph.instance.#SFlameGraphDetailsDiv.substring(1)+'"></div>' +
                '<ul id="custom-menu-guid" class="items"> <li>Copy</li> <li>Reset Zoom</li> </ul>'
            );
        }
        $(SFlameGraph.instance.#SFlameGraphDetailsDiv).html("");
        SFlameGraph.instance.#searchMatchCount = 0;
        if (searchString != "" && searchString != undefined) {
            SFlameGraph.instance.#flameGraphSearch = true;
            SFlameGraph.instance.#flameGraphSearchStr = searchString;
        } else {
            SFlameGraph.instance.#flameGraphSearch = false;
            SFlameGraph.instance.#flameGraphSearchStr = "";
        }

        if (SFlameGraph.instance.#flameGraphPath != "" && SFlameGraph.instance.#flameGraphClickDepth != 0 && SFlameGraph.instance.#flameGraphActiveTree == treeToProcess) {
            SFlameGraph.instance.showClickedFlameCompare(SFlameGraph.instance.#flameGraphPath, SFlameGraph.instance.#flameGraphClickDepth);
            return;
        } else {
            SFlameGraph.instance.#flameGraphPath = "";
            SFlameGraph.instance.#flameGraphClickDepth = 0;
        }

        SFlameGraph.instance.#flameGraphActiveTree = treeToProcess;
        SFlameGraph.instance.#flameSvgHeight = 0;
        $(SFlameGraph.instance.#SFlameGraphDiv).html("<div id='flamegraphdiv' class='row col-lg-12' style='padding-left: ;: 10px !important;'></div>");

        d3.select("#flamegraphdiv").append("svg").attr("width", $(SFlameGraph.instance.#SFlameGraphDiv).width()).attr("height", SFlameGraph.instance.#flameMaxSvgHeight);
        SFlameGraph.instance.#flameSvgWidth = $(SFlameGraph.instance.#SFlameGraphDiv).width();

        SFlameGraph.instance.addSVGRectCompare(SFlameGraph.instance.#flameGraphActiveTree, SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#leftKey] + SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#rightKey], SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#nameKey], 0, "", 1);

        SFlameGraph.instance.genSVGCompare(SFlameGraph.instance.#flameGraphActiveTree, SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#leftKey] + SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#rightKey], 2, 0, "");

        $(SFlameGraph.instance.#SFlameGraphDiv).height(SFlameGraph.instance.#flameSvgHeight);
        $(SFlameGraph.instance.#SFlameGraphDiv).scrollTop($(SFlameGraph.instance.#SFlameGraphDiv)[0].scrollHeight);

        SFlameGraph.instance.#SFlameGraphTooltip = d3.select("#flamegraphdiv").append("div")
            .attr("class", "SFlameGraphTooltip")
            .style("opacity", 0);
    }

    genSVGCompare(tree, total, depth, x, path) {
        //skip sub tree for below given threshold
        if (100 * tree[SFlameGraph.instance.#leftKey] / total < SFlameGraph.instance.#threshold && 100 * tree[SFlameGraph.instance.#rightKey] / total < SFlameGraph.instance.#threshold) {
            return false;
        }
        let skip = false;
        if (tree[SFlameGraph.instance.#childrenKey] == null) {
            tree[SFlameGraph.instance.#childrenKey] = [];
        }
        let nx = x;

        let index = 0;
        tree[SFlameGraph.instance.#childrenKey].forEach(function (child) {
            if (skip || isSkipSubtree(child[SFlameGraph.instance.#leftKey], child[SFlameGraph.instance.#rightKey])) {
                return;
            }
            if (100 * child[SFlameGraph.instance.#leftKey] / total < SFlameGraph.instance.#threshold && 100 * child[SFlameGraph.instance.#rightKey] / total < SFlameGraph.instance.#threshold) {
                if (tree[SFlameGraph.instance.#childrenKey].length > 1) {
                    SFlameGraph.instance.addSVGRectCompare(child, total, "...", nx, path + index + ":", depth);
                } else {
                    SFlameGraph.instance.addSVGRectCompare(child, total, "...", nx, path, depth);
                }
                skip = true;
            } else if (tree[SFlameGraph.instance.#childrenKey].length > 0) {
                if (tree[SFlameGraph.instance.#childrenKey].length > 1) {
                    SFlameGraph.instance.addSVGRectCompare(child, total, child[SFlameGraph.instance.#nameKey], nx, path + index + ":", depth);
                    if (!SFlameGraph.instance.genSVGCompare(child, total, depth + 1, nx, path + index + ":")) {
                        SFlameGraph.instance.addSVGRectCompare(child, total, "...", nx, path, depth);
                    }
                } else {
                    SFlameGraph.instance.addSVGRectCompare(child, total, child[SFlameGraph.instance.#nameKey], nx, path, depth);
                    if (!SFlameGraph.instance.genSVGCompare(child, total, depth + 1, nx, path)) {
                        SFlameGraph.instance.addSVGRectCompare(child, total, "...", nx, path, depth);
                    }
                }
                nx += SFlameGraph.instance.#flameSvgWidth * (child[SFlameGraph.instance.#leftKey] + child[SFlameGraph.instance.#rightKey]) / total;
            }
            index++;
        });
        return true;
    }

    addSVGRectCompare(child, total, id, x, path, depth, dull = false) {
        let width = (child[SFlameGraph.instance.#leftKey] + child[SFlameGraph.instance.#rightKey])/total;
        let sz = (child[SFlameGraph.instance.#leftKey] + child[SFlameGraph.instance.#rightKey]);

        if (SFlameGraph.instance.#flameSvgHeight < SFlameGraph.instance.#flameSvgRowHeight * depth) {
            SFlameGraph.instance.#flameSvgHeight = SFlameGraph.instance.#flameSvgRowHeight * depth;
        }
        //it does not make sense to show such a small rects unless clicked on a cell to see deeper
        if (SFlameGraph.instance.#flameSvgWidth * width < SFlameGraph.instance.#pixelThreshold && depth > 1 && SFlameGraph.instance.#flameGraphClickDepth == 0) {
            return;
        }

        let fN = getFrameName(id);
        /*if (SFlameGraph.instance.#flameSvgWidth * width >= 50) { //this block will improve some performance but but hover and click will work only on text when text added
            d3.select("#flamegraphdiv").select("svg").append("rect")
                .attr("width", SFlameGraph.instance.#flameSvgWidth * width)
                .attr("height", SFlameGraph.instance.#flameSvgRowHeight)
                .attr("x", x)
                .attr("y", SFlameGraph.instance.#flameMaxSvgHeight - SFlameGraph.instance.#flameSvgRowHeight * depth)
                .attr("fill", SFlameGraph.instance.getCompareFlameColor(dull, child[SFlameGraph.instance.#leftKey], child[SFlameGraph.instance.#rightKey], id))
                .attr("class", "testclass")
                .style("cursor", "default");
        }else */{
            d3.select("#flamegraphdiv").select("svg").append("rect")
                .attr("width", SFlameGraph.instance.#flameSvgWidth * width)
                .attr("height", SFlameGraph.instance.#flameSvgRowHeight)
                .attr("p", path)
                .attr("d", depth)
                .attr("x", x)
                .attr("y", SFlameGraph.instance.#flameMaxSvgHeight - SFlameGraph.instance.#flameSvgRowHeight * depth)
                .attr("stroke", SFlameGraph.instance.#flameSvgWidth * width < 3 ? "none" : "white")
                .attr("fill", SFlameGraph.instance.getCompareFlameColor(dull, child[SFlameGraph.instance.#leftKey], child[SFlameGraph.instance.#rightKey], id))
                .attr("class", "testclass")
                .attr("onclick", 'SFlameGraph.instance.svgShowFlame(evt)')
                .attr("id", id)
                .on("contextmenu", function () {
                    return SFlameGraph.instance.#SFlameGraphcontextMenu(fN);
                    //return SFlameGraph.instance.flameGraphcontextMenu(fN);
                })
                .on("mouseover", function () {
                    return SFlameGraph.instance.mouseoverFlame(id, this, width * SFlameGraph.instance.#flameSvgWidth);
                })
                .on("mousemove", function () {
                    return SFlameGraph.instance.mousemoveFlameCompare(id, this, child[SFlameGraph.instance.#leftKey], child[SFlameGraph.instance.#rightKey], total);
                })
                .on("mouseleave", function () {
                    return SFlameGraph.instance.mouseleaveFlame(id, this);
                });
        }
        if (SFlameGraph.instance.#flameSvgWidth * width >= 50) {
            d3.select("#flamegraphdiv").select("svg").append('text').text(SFlameGraph.instance.getFlameRectText(width * SFlameGraph.instance.#flameSvgWidth, fN))
                .attr('x', x + 3)
                .attr('y', SFlameGraph.instance.#flameMaxSvgHeight - SFlameGraph.instance.#flameSvgRowHeight * depth + 12)
                .attr('fill', 'black')
                .style('font-size', '14px')
                .style('font-family', '"Open Sans", sans-serif')
                .attr("onclick", 'SFlameGraph.instance.svgShowFlame(evt)')
                .attr("id", id)
                .attr("p", path)
                .attr("d", depth)
                .on("contextmenu", function () {
                    return SFlameGraph.instance.#SFlameGraphcontextMenu(fN);
                    //return SFlameGraph.instance.flameGraphcontextMenu(fN);
                })
                .on("mouseover", function () {
                    return SFlameGraph.instance.mouseoverFlame(id, this, width * SFlameGraph.instance.#flameSvgWidth);
                })
                .on("mousemove", function () {
                    return SFlameGraph.instance.mousemoveFlameCompare(id, this, child[SFlameGraph.instance.#leftKey], child[SFlameGraph.instance.#rightKey], total);
                })
                .on("mouseleave", function () {
                    return SFlameGraph.instance.mouseleaveFlame(id, this);
                });
        }
    }

    showClickedFlameCompare(paths, clickDepth) {
        d3.select("#flamegraphdiv").select("svg").selectAll("*").remove();
        if (paths.length == 1 && clickDepth == 1) {
            SFlameGraph.instance.#flameGraphPath = "";
            SFlameGraph.instance.#flameGraphClickDepth = 0;
            //full svg
            SFlameGraph.instance.addSVGRectCompare(SFlameGraph.instance.#flameGraphActiveTree, SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#leftKey] + SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#rightKey], SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#nameKey], 0, "", 1);
            SFlameGraph.instance.genSVGCompare(SFlameGraph.instance.#flameGraphActiveTree, SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#leftKey] + SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#rightKey], 2, 0, "");
        } else {
            //find click node
            SFlameGraph.instance.addSVGRectCompare(SFlameGraph.instance.#flameGraphActiveTree, SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#leftKey] + SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#rightKey], SFlameGraph.instance.#flameGraphActiveTree[SFlameGraph.instance.#nameKey], 0, "", 1, true);
            let tmpCh = SFlameGraph.instance.#flameGraphActiveTree;
            let curDepth = 1;
            let curPathIndex = 0;
            let curPath = "";
            while (curDepth < clickDepth) {
                while (tmpCh[SFlameGraph.instance.#childrenKey].length == 1 && curDepth < clickDepth) {
                    tmpCh = tmpCh[SFlameGraph.instance.#childrenKey][0];
                    curDepth++;

                    if (curDepth == clickDepth) {
                        SFlameGraph.instance.addSVGRectCompare(tmpCh, tmpCh[SFlameGraph.instance.#leftKey] + tmpCh[SFlameGraph.instance.#rightKey], tmpCh[SFlameGraph.instance.#nameKey], 0, curPath, curDepth);
                        SFlameGraph.instance.genSVGCompare(tmpCh, tmpCh[SFlameGraph.instance.#leftKey] + tmpCh[SFlameGraph.instance.#rightKey], curDepth + 1, 0, curPath);
                    } else {
                        SFlameGraph.instance.addSVGRectCompare(tmpCh, tmpCh[SFlameGraph.instance.#leftKey] + tmpCh[SFlameGraph.instance.#rightKey], tmpCh[SFlameGraph.instance.#nameKey], 0, curPath, curDepth, true);
                    }
                }
                if (curDepth < clickDepth) {
                    curPath = curPath + Number(paths[curPathIndex]) + ":";
                    curDepth++;
                    if (tmpCh[SFlameGraph.instance.#childrenKey][Number(paths[curPathIndex])] == undefined) {
                        console.log("warning1");
                    }
                    tmpCh = tmpCh[SFlameGraph.instance.#childrenKey][Number(paths[curPathIndex])];

                    if (curDepth == clickDepth) {
                        SFlameGraph.instance.addSVGRectCompare(tmpCh, tmpCh[SFlameGraph.instance.#leftKey] + tmpCh[SFlameGraph.instance.#rightKey], tmpCh[SFlameGraph.instance.#nameKey], 0, curPath, curDepth);
                        SFlameGraph.instance.genSVGCompare(tmpCh, tmpCh[SFlameGraph.instance.#leftKey] + tmpCh[SFlameGraph.instance.#rightKey], curDepth + 1, 0, curPath);
                    } else {
                        if (tmpCh == undefined) {
                            console.log("warning2");
                        }
                        SFlameGraph.instance.addSVGRectCompare(tmpCh, tmpCh[SFlameGraph.instance.#leftKey] + tmpCh[SFlameGraph.instance.#rightKey], tmpCh[SFlameGraph.instance.#nameKey], 0, curPath, curDepth, true);
                    }
                    curPathIndex++;
                }
            }
        }
    }


    mouseoverFlame(val, obj, width) {
        $(SFlameGraph.instance.#SFlameGraphDetailsDiv).html(getFrameName(val));
        if (d3.select(obj).attr("style") == undefined || !d3.select(obj).attr("style").includes("opacity: 0")) {
            SFlameGraph.instance.#SFlameGraphTooltip
                .style("opacity", 1);
            d3.select(obj)
                .style("cursor", "pointer");
        }
    }

    mousemoveFlame(val, obj, sz, total) {
        if (d3.select(obj).attr("style") == undefined || !d3.select(obj).attr("style").includes("opacity: 0")) {
            let x = d3.mouse(obj)[0];
            let y = d3.mouse(obj)[1];
            if(x+500 > SFlameGraph.instance.#flameSvgWidth){
                x = x-getFrameName(val).length * 7-130;
            }else{
                x = x+20;
            }
            if(y + 50 > SFlameGraph.instance.#flameMaxSvgHeight){
                y = y - 25;
            }else{
                y = y+15;
            }
            SFlameGraph.instance.#SFlameGraphTooltip
                .html(getFrameName(val) + ' ' + (100 * sz / total).toFixed(2) + "%, " + sz + ' sample(s)')
                .style("left", x + "px")
                .style("top", y + "px");
        }
    }

    mousemoveFlameCompare(val, obj, bsz, csz, total) {
        if (d3.select(obj).attr("style") == undefined || !d3.select(obj).attr("style").includes("opacity: 0")) {
            let x = d3.mouse(obj)[0];
            let y = d3.mouse(obj)[1];
            if(x+500 > SFlameGraph.instance.#flameSvgWidth){
                x = x-getFrameName(val).length * 7-130;
            }else{
                x = x+20;
            }
            if(y + 50 > SFlameGraph.instance.#flameMaxSvgHeight){
                y = y - 25;
            }else{
                y = y+15;
            }

            let diff = bsz-csz;
            let pDiff = "NA";
            if(bsz+csz !== 0){
                pDiff = (100*diff/(bsz+csz)).toFixed(2) + "%";
            }

            SFlameGraph.instance.#SFlameGraphTooltip
                .html(getFrameName(val) + ' base:' + bsz + ' new:' + csz + ' diff:' + diff + ' percent:' + pDiff)
                //.html(getFrameName(val) + ' ' + (100 * sz / total).toFixed(2) + "%, " + sz + ' sample(s)')
                .style("left", x + "px")
                .style("top", y + "px");
        }
    }


    mouseleaveFlame(val, obj) {
        if (d3.select(obj).attr("style") == undefined || !d3.select(obj).attr("style").includes("opacity: 0")) {
            SFlameGraph.instance.#SFlameGraphTooltip
                .style("opacity", 0);
            if (d3.select(obj).attr("width") == undefined) {
                d3.select(obj)
                    .style("cursor", "default");
            } else {
                d3.select(obj)
                    .style("cursor", "default");
            }
        }
    }

    getFlameRectText(w, s) {
        if (w / 7 > s.length) {
            return s;
        } else {
            return s.slice(0, (w / 7) - 4) + "...";
        }
    }

    getCompareFlameColor(dull, bsz, csz, id) {
        let percDiff = bsz-csz;
        if(bsz+csz !== 0){
            percDiff = percDiff/(bsz+csz);
        }

        if (SFlameGraph.instance.#flameGraphSearch && getFrameName(id).includes(SFlameGraph.instance.#flameGraphSearchStr)) {
            SFlameGraph.instance.#searchMatchCount++;
            if (dull) {
                return 'hsl(90, 75%, 80%)';
            } else {
                return 'hsl(90, 100%, 50%)';
            }
        } else {
            if(percDiff === 0) {
                return 'hsl(0, 0%, 90%)';
            }else if(percDiff < 0) {
                if (dull) {
                    return 'hsl(360, 100%, 80%, '+-1*percDiff+')';
                } else {
                    return 'hsl(360, 100%, 50%, '+-1*percDiff+')';
                }
            }else{
                if (dull) {
                    return 'hsl(240, 100%, 80%, '+percDiff+')';
                } else {
                    return 'hsl(240, 100%, 50%, '+percDiff+')';
                }
            }
        }
    }

    getFlameColor(dull, id) {
        if (SFlameGraph.instance.#flameGraphSearch && getFrameName(id).includes(SFlameGraph.instance.#flameGraphSearchStr)) {
            SFlameGraph.instance.#searchMatchCount++;
            if (dull) {
                return 'hsl(90, 75%, 80%)';
            } else {
                return 'hsl(90, 100%, 50%)';
            }
        } else {
            //const hue = 180 + Math.random() * 30;//blue scale
            const hue = 25 + Math.random() * 30;
            if (dull) {
                return 'hsl(' + hue + ', 100%, 80%)';
                //return 'hsl(' + hue + ', 54%, 80%)';//blue scale
            } else {
                return 'hsl(' + hue + ', 150%, 50%)';
                //return 'hsl(' + hue + ', 54%, 57%)';//blue scale
            }
        }
    }

    flameGraphcontextMenu(data) {
        d3.event.preventDefault();
        const position = d3.mouse($(SFlameGraph.instance.#SFlameGraphDiv)[0]);
        d3.select(SFlameGraph.instance.#SFlameGraphCustomMenuDiv)
            .style('position', 'absolute')
            .style('left', (position[0] + 10) + "px")
            .style('top', (position[1] - 10) + "px")
            .style('display', 'inline-block')
            .selectAll("li")
            .on('click', function (_, index) {
                d3.select(SFlameGraph.instance.#SFlameGraphCustomMenuDiv).style('display', 'none');
                if (index === 0) { // copy
                    if (SFlameGraph.instance.flamegraphcopyToClipboard(data)) {
                        toastr_success("Copied to clipboard!");
                    }
                } else { // reset zoom
                    if(SFlameGraph.instance.#isCompare){
                        SFlameGraph.instance.showClickedFlameCompare([""], 1);
                    }else{
                        SFlameGraph.instance.showClickedFlame([""], 1);
                    }
                }
            });

        $(document).on("click", function () {
            d3.select(SFlameGraph.instance.#SFlameGraphCustomMenuDiv).style('display', 'none');
        });
    }

    flamegraphcopyToClipboard(string) {
        const tempElement = document.createElement('textarea');
        tempElement.value = string;
        document.body.appendChild(tempElement);
        tempElement.select();
        document.execCommand('copy');
        document.body.removeChild(tempElement);
        return true;
    }

    isSkipSubtree(bsize, csize) {
        if (SFlameGraph.instance.#isCompare && ((bsize === 0 && SFlameGraph.instance.#filterOption === 2) || (csize === 0 && SFlameGraph.instance.#filterOption === 3))) {
            return true;
        }
        return false;
    }
}
const sFlameGraph = new SFlameGraph();
Object.freeze(sFlameGraph);
