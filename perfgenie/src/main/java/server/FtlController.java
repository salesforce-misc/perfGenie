/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server;

import org.apache.catalina.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Controller
public class FtlController {
    private final PerfGenieService service;
    private final boolean enableAuth;

    private Map<String, LocalDateTime> usersLastAccess = new HashMap<>();

    @GetMapping("/")
    public String getCurrentUser(@AuthenticationPrincipal User user, Model model) {
        if(enableAuth) {
            String username = SecurityContextHolder.getContext().getAuthentication().getName();
            model.addAttribute("username", username);
            model.addAttribute("lastAccess", usersLastAccess.get(username));
            usersLastAccess.put(username, LocalDateTime.now());
        }
        return "index";
    }

    @Autowired
    public FtlController(PerfGenieService service) {
        this.service = service;
        String substrate = System.getenv("SUBSTRATE");
        if(substrate == null){
            enableAuth = true;
        }else{
            enableAuth=false;
        }
    }

    @RequestMapping(value = "/index", method = RequestMethod.GET)
    public String index() {
        return "/templates/index";
    }

   @GetMapping(path = {"/templates", "/templates/{tenant}"})
    public String user( @PathVariable(required=false,name="tenant") String tenant) {
        return tenant;
    }
}
