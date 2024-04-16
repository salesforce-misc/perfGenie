/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server;

import com.google.common.base.Strings;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
public class PerfGenieController {
    private final PerfGenieService service;
    private static final Pattern queryPatterns = Pattern.compile("(?<key>.*?)(?<value>(>|<|=|!=|~|!~|<=|>=).*)");

    @Autowired
    public PerfGenieController(PerfGenieService service) {
        this.service = service;
    }

    @GetMapping(path = {"/v1/profile", "/v1/profile/{tenant}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String profile(@PathVariable(required = false, name = "tenant") String tenant,
                          @RequestParam(required = false, name = "start") final long start,
                          @RequestParam(required = false, name = "end") final long end,
                          @RequestParam("metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        final Map<String, String> dimMap = new HashMap<>();

        return service.getProfile(tenant, start, end, queryMap, dimMap);
    }

    @GetMapping(path = {"/v1/profiles", "/v1/profiles/{tenant}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String profiles(@PathVariable(required = false, name = "tenant") String tenant,
                           @RequestParam(required = false, name = "start") final long start,
                           @RequestParam(required = false, name = "end") final long end,
                           @RequestParam("metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        final Map<String, String> dimMap = new HashMap<>();

        return service.getProfiles(tenant, start, end, queryMap, dimMap);
    }

    @GetMapping(path = {"/v1/customevents", "/v1/customevents/{tenant}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String customevents(@PathVariable(required = false, name = "tenant") String tenant,
                               @RequestParam(required = false, name = "start") final long start,
                               @RequestParam(required = false, name = "end") final long end,
                               @RequestParam("metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        final Map<String, String> dimMap = new HashMap<>();

        return service.getCustomEvents(tenant, start, end, queryMap, dimMap);
    }

    @CrossOrigin
    @GetMapping(path = {"/v1/meta", "/v1/meta/{tenant}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String meta(@PathVariable(required = false, name = "tenant") String tenant,
                       @RequestParam(required = false, name = "start") final long start,
                       @RequestParam(required = false, name = "end") final long end,
                        @RequestParam(required = false, name = "metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        final Map<String, String> dimMap = new HashMap<>();
        return service.getMeta(start, end, queryMap, dimMap, tenant);
    }

    @CrossOrigin
    @GetMapping(path = {"/v1/tenants", "/v1/tenants/{tenant}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String tenants(@PathVariable(required = false, name = "tenant") String tenant,
                       @RequestParam(required = false, name = "start") final long start,
                       @RequestParam(required = false, name = "end") final long end,
                       @RequestParam(required = false, name = "metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        final Map<String, String> dimMap = new HashMap<>();
        return service.getTenants(start, end, queryMap, dimMap);
    }

    @CrossOrigin
    @GetMapping(path = {"/v1/jstack", "/v1/jstack/{tenant}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String jstack(@PathVariable(required = false, name = "tenant") String tenant,
                         @RequestParam(required = false, name = "start") final long start,
                         @RequestParam(required = false, name = "end") final long end,
                         @RequestParam("metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        return service.getJstack(tenant, start, end, queryMap);
    }

    private static Map<String, String> queryToMap(final List<String> queryList) {
        if (queryList == null || queryList.isEmpty()) {
            final Map<String, String> queryMap = new HashMap<>();
            return queryMap;
            //return Collections.emptyMap();
        }

        final Map<String, String> queryMap = new HashMap<>();
        for (final String query : queryList) {
            if (Strings.isNullOrEmpty(query)) {
                continue;
            }

            final Matcher matcher = queryPatterns.matcher(query);
            if (matcher.matches()) {
                if (query.contains("..") || query.contains("~")) {
                    // remove the equals when using these operators
                    queryMap.put(matcher.group("key"), matcher.group("value").substring(1));
                } else {
                    queryMap.put(matcher.group("key"), matcher.group("value"));
                }
            } else {
                throw new IllegalArgumentException("Invalid query format: " + query);
            }
        }
        return queryMap;
    }

}
