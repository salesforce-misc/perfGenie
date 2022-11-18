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

    constructor() {
        if (!SFlameGraph.instance) {
            SFlameGraph.instance = this;
        }
        return SFlameGraph.instance;
    }

    setSFlameGraphDivId(id){
        SFlameGraph.instance.#SFlameGraphDiv=id;
    }

    setSFlameGraphDetailsDiv(id){
        SFlameGraph.instance.#SFlameGraphDetailsDiv=id;
    }

    showTreeV1Flame(treeToProcess, level, searchString) {

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

        SFlameGraph.instance.addSVGRect(SFlameGraph.instance.#flameGraphActiveTree.sz / SFlameGraph.instance.#flameGraphActiveTree.sz, SFlameGraph.instance.#flameGraphActiveTree.sz, SFlameGraph.instance.#flameGraphActiveTree.sz, SFlameGraph.instance.#flameGraphActiveTree.nm, 0, "", 1);

        SFlameGraph.instance.genSVG(SFlameGraph.instance.#flameGraphActiveTree, SFlameGraph.instance.#flameGraphActiveTree.sz, 2, 0, "");

        $(SFlameGraph.instance.#SFlameGraphDiv).height(SFlameGraph.instance.#flameSvgHeight);
        $(SFlameGraph.instance.#SFlameGraphDiv).scrollTop($(SFlameGraph.instance.#SFlameGraphDiv)[0].scrollHeight);

        SFlameGraph.instance.#SFlameGraphTooltip = d3.select("#flamegraphdiv").append("div")
            .attr("class", "SFlameGraphTooltip")
            .style("opacity", 0);
    }

    genSVG(tree, total, depth, x, path) {
        //skip sub tree for below given threshold
        if (100 * tree.sz / total < Number(threshold)) {
            return false;
        }
        let skip = false;
        if (tree.ch == null) {
            tree.ch = [];
        }
        let nx = x;

        let index = 0;
        tree.ch.forEach(function (child) {
            if (skip || isSkipSubtree(child.sz, 0)) {
                return;
            }
            if (100 * child.sz / total < Number(threshold)) {
                if (tree.ch.length > 1) {
                    SFlameGraph.instance.addSVGRect(child.sz / total, child.sz, total, "...", nx, path + index + ":", depth);
                } else {
                    SFlameGraph.instance.addSVGRect(child.sz / total, child.sz, total, "...", nx, path, depth);
                }
                skip = true;
            } else if (tree.ch.length > 0) {
                if (tree.ch.length > 1) {
                    SFlameGraph.instance.addSVGRect(child.sz / total, child.sz, total, child.nm, nx, path + index + ":", depth);
                    if (!SFlameGraph.instance.genSVG(child, total, depth + 1, nx, path + index + ":")) {
                        SFlameGraph.instance.addSVGRect(child.sz / total, child.sz, total, "...", nx, path, depth);
                    }
                } else {
                    SFlameGraph.instance.addSVGRect(child.sz / total, child.sz, total, child.nm, nx, path, depth);
                    if (!SFlameGraph.instance.genSVG(child, total, depth + 1, nx, path)) {
                        SFlameGraph.instance.addSVGRect(child.sz / total, child.sz, total, "...", nx, path, depth);
                    }
                }
                nx += SFlameGraph.instance.#flameSvgWidth * child.sz / total;
            }
            index++;
        });
        return true;
    }

    addSVGRect(width, sz, total, id, x, path, depth, dull = false) {
        if (SFlameGraph.instance.#flameSvgHeight < SFlameGraph.instance.#flameSvgRowHeight * depth) {
            SFlameGraph.instance.#flameSvgHeight = SFlameGraph.instance.#flameSvgRowHeight * depth;
        }
        //it does not make sense to show such a small rects unless clicked on a cell to see deeper
        if (SFlameGraph.instance.#flameSvgWidth * width < 0.5 && depth > 1 && SFlameGraph.instance.#flameGraphClickDepth == 0) {
            return;
        }

        let fN = getFrameName(id);
        d3.select("#flamegraphdiv").select("svg").append("rect")
            .attr("width", SFlameGraph.instance.#flameSvgWidth * width)
            .attr("height", SFlameGraph.instance.#flameSvgRowHeight)
            .attr("p", path)
            .attr("d", depth)
            .attr("x", x)
            .attr("y", SFlameGraph.instance.#flameMaxSvgHeight - SFlameGraph.instance.#flameSvgRowHeight * depth)
            .attr("stroke", SFlameGraph.instance.#flameSvgWidth * width < 3 ? "none" : "white")
            .attr("fill", SFlameGraph.instance.generateFlameColor(dull, id))
            .attr("class", "testclass")
            .attr("onclick", 'SFlameGraph.instance.svgShowFlame(evt)')
            .attr("id", id)
            .on("contextmenu", function () {
                return SFlameGraph.instance.flameGraphcontextMenu(fN);
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
        if (SFlameGraph.instance.#flameSvgWidth * width >= 50) {
            d3.select("#flamegraphdiv").select("svg").append('text').text(SFlameGraph.instance.getFlameRectText(width * SFlameGraph.instance.#flameSvgWidth, fN))
                .attr('x', x + 5)
                .attr('y', SFlameGraph.instance.#flameMaxSvgHeight - SFlameGraph.instance.#flameSvgRowHeight * depth + 12)
                .attr('fill', 'black')
                .style('font-size', '14px')
                .style('font-family', '"Open Sans", sans-serif')
                .attr("onclick", 'SFlameGraph.instance.svgShowFlame(evt)')
                .attr("id", id)
                .attr("p", path)
                .attr("d", depth)
                .on("contextmenu", function () {
                    return SFlameGraph.instance.flameGraphcontextMenu(fN);
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
            SFlameGraph.instance.showClickedFlame(paths, clickDepth);
        }
    }

    showClickedFlame(paths, clickDepth) {
        d3.select("#flamegraphdiv").select("svg").selectAll("*").remove();
        if (paths.length == 1 && clickDepth == 1) {
            SFlameGraph.instance.#flameGraphPath = "";
            SFlameGraph.instance.#flameGraphClickDepth = 0;
            //full svg
            SFlameGraph.instance.addSVGRect(SFlameGraph.instance.#flameGraphActiveTree.sz / SFlameGraph.instance.#flameGraphActiveTree.sz, SFlameGraph.instance.#flameGraphActiveTree.sz, SFlameGraph.instance.#flameGraphActiveTree.sz, SFlameGraph.instance.#flameGraphActiveTree.nm, 0, "", 1);
            SFlameGraph.instance.genSVG(SFlameGraph.instance.#flameGraphActiveTree, SFlameGraph.instance.#flameGraphActiveTree.sz, 2, 0, "");
        } else {
            //find click node
            SFlameGraph.instance.addSVGRect(SFlameGraph.instance.#flameGraphActiveTree.sz / SFlameGraph.instance.#flameGraphActiveTree.sz, SFlameGraph.instance.#flameGraphActiveTree.sz, SFlameGraph.instance.#flameGraphActiveTree.sz, SFlameGraph.instance.#flameGraphActiveTree.nm, 0, "", 1, true);
            let tmpCh = SFlameGraph.instance.#flameGraphActiveTree;
            let curDepth = 1;
            let curPathIndex = 0;
            let curPath = "";
            while (curDepth < clickDepth) {
                while (tmpCh.ch.length == 1 && curDepth < clickDepth) {
                    tmpCh = tmpCh.ch[0];
                    curDepth++;

                    if (curDepth == clickDepth) {
                        SFlameGraph.instance.addSVGRect(1, tmpCh.sz, tmpCh.sz, tmpCh.nm, 0, curPath, curDepth);
                        SFlameGraph.instance.genSVG(tmpCh, tmpCh.sz, curDepth + 1, 0, curPath);
                    } else {
                        SFlameGraph.instance.addSVGRect(1, tmpCh.sz, tmpCh.sz, tmpCh.nm, 0, curPath, curDepth, true);
                    }
                }
                if (curDepth < clickDepth) {
                    curPath = curPath + Number(paths[curPathIndex]) + ":";
                    curDepth++;
                    if (tmpCh.ch[Number(paths[curPathIndex])] == undefined) {
                        console.log("check");
                    }
                    tmpCh = tmpCh.ch[Number(paths[curPathIndex])];

                    if (curDepth == clickDepth) {
                        SFlameGraph.instance.addSVGRect(1, tmpCh.sz, tmpCh.sz, tmpCh.nm, 0, curPath, curDepth);
                        SFlameGraph.instance.genSVG(tmpCh, tmpCh.sz, curDepth + 1, 0, curPath);
                    } else {
                        if (tmpCh == undefined) {
                            console.log("check");
                        }
                        SFlameGraph.instance.addSVGRect(1, tmpCh.sz, tmpCh.sz, tmpCh.nm, 0, curPath, curDepth, true);
                    }
                    curPathIndex++;
                }
            }
        }
    }

    mouseoverFlame(val, obj, width) {
        $(SFlameGraph.instance.#SFlameGraphDetailsDiv).html(d3.mouse(obj)[0].toFixed(0) + ":" + d3.mouse(obj)[1].toFixed(0) + ":" + getFrameName(val) + "|" + width);
        if (d3.select(obj).attr("style") == undefined || !d3.select(obj).attr("style").includes("opacity: 0")) {
            SFlameGraph.instance.#SFlameGraphTooltip
                .style("opacity", 1);
            d3.select(obj)
                .style("cursor", "pointer");
        }
    }

    mousemoveFlame(val, obj, sz, total) {
        if (d3.select(obj).attr("style") == undefined || !d3.select(obj).attr("style").includes("opacity: 0")) {
            SFlameGraph.instance.#SFlameGraphTooltip
                .html(getFrameName(val) + '<br>' + (100 * sz / total).toFixed(2) + "%, " + sz + ' sample(s)')
                .style("left", (d3.mouse(obj)[0] + 40) + "px")
                .style("top", (d3.mouse(obj)[1]) + "px");
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
            return s.slice(0, (w / 7) - 3) + "...";
        }
    }

    generateFlameColor(dull, id) {
        if (SFlameGraph.instance.#flameGraphSearch && getFrameName(id).includes(SFlameGraph.instance.#flameGraphSearchStr)) {
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

        const position = d3.mouse($("#flame-graph-guid")[0]);
        d3.select("#custom-menu-guid")
            .style('position', 'absolute')
            .style('left', (position[0] + 10) + "px")
            .style('top', (position[1] - 10) + "px")
            .style('display', 'inline-block')
            .selectAll("li")
            .on('click', function (_, index) {
                d3.select("#custom-menu-guid").style('display', 'none');
                if (index === 0) { // copy
                    if (SFlameGraph.instance.flamegraphcopyToClipboard(data)) {
                        toastr_success("Copied to clipboard!");
                    }
                } else if (index === 1) { // code ownership
                    SFlameGraph.instance.flamegraphopenCodeOwnership(data);
                } else { // reset zoom
                    SFlameGraph.instance.showClickedFlame([""], 1);
                }
            });

        $(document).on("click", function () {
            d3.select("#custom-menu-guid").style('display', 'none');
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

    flamegraphopenCodeOwnership(frame) {
        const cleanFrame = function (frameText) {
            let frame = frameText.substring(0, frameText.lastIndexOf("."));
            if (frame.includes("$")) {
                frame = frame.substring(0, frame.indexOf("$"));
            }
            if (frame.includes("?")) {
                frame = frame.replace(/\?/g, "");
            }
            return frame;
        };

        if (frame !== "root") {
            window.open('/page/utility-code-ownership?frame=' + encodeURIComponent(cleanFrame(frame)), '_blank');
        }
    }
}
const sFlameGraph = new SFlameGraph();
Object.freeze(sFlameGraph);
