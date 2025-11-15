/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server.profiler;

import org.apache.catalina.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import server.profiler.PerfGenieService;

@Controller
public class FtlController {
    private final PerfGenieService service; //future need, populate ftl fields?
    private final boolean enableAuth;

    @GetMapping(path = {"/"})
    public String getIndex(@PathVariable(required = false, name = "page") String page, @AuthenticationPrincipal User user, Model model) {
        if (enableAuth) {
            String username = SecurityContextHolder.getContext().getAuthentication().getName();
            model.addAttribute("username", username);
        }
        return "index";
    }

    @GetMapping(path = {"/genie"})
    public String getGenie(@PathVariable(required = false, name = "page") String page, @AuthenticationPrincipal User user, Model model) {
        if (enableAuth) {
            String username = SecurityContextHolder.getContext().getAuthentication().getName();
            model.addAttribute("username", username);
        }
        return "genie";
    }

    @GetMapping(path = {"/component/{team}/{page}"})
    public String getComponent(@PathVariable(required = false, name = "team") String team, @PathVariable(required = false, name = "page") String page, @AuthenticationPrincipal User user, Model model) {
        if (enableAuth) {
            String username = SecurityContextHolder.getContext().getAuthentication().getName();
            model.addAttribute("username", username);
        }
        if (page != null) {
            return "component/" + team + "/" + page;
        } else {
            return "component/" + team + "/index";
        }
    }

    @Autowired
    public FtlController(PerfGenieService service) {
        this.service = service;
        String substrate = System.getenv("SUBSTRATE");
        if (substrate == null) {
            enableAuth = true;
        } else {
            enableAuth = false;
        }
    }
}
