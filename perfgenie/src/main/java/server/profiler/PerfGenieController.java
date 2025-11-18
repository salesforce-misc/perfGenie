/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server.profiler;

import com.google.common.base.Strings;
import com.google.common.io.Resources;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRange;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import perfgenie.utils.ArgusQueryT;
import perfgenie.utils.Utils;
import server.profiler.PerfGenieService;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.nio.file.Path;
import java.nio.file.Paths;

@RestController
public class PerfGenieController {
    private final PerfGenieService service;
    private static final Pattern queryPatterns = Pattern.compile("(?<key>.*?)(?<value>(>|<|=|!=|~|!~|<=|>=).*)");

    @PostMapping(path = {"/v1/savelense","/v1/savelense/{host}","/component/casp/v1/savelense","/component/casp/v1/savelense/{host}"})
    public ResponseEntity<String> saveLense(@PathVariable(required = false, name = "host") String host,
                                            @RequestBody Lense lense) throws IOException{
        lense.setTimestamp(System.currentTimeMillis());
        lense.setSource(host);
        service.addLense(Utils.toJson(lense),lense.getTimestamp(),lense.getSource(), lense.getType(), lense.getName());
        return ResponseEntity.ok("Lense added successfully!");
    }

    @PostMapping(path = {"/v1/saveexpression","/v1/saveexpression/{host}","/component/casp/v1/saveexpression","/component/casp/v1/saveexpression/{host}"})
    public ResponseEntity<String> saveExpression(@PathVariable(required = false, name = "host") String host,
                                                @RequestBody Expression expression) throws IOException{
        expression.setTimestamp(System.currentTimeMillis());
        expression.setSource(host);
        service.addExpression(Utils.toJson(expression),expression.getTimestamp(),expression.getSource(), expression.getType(),expression.getName());
        return ResponseEntity.ok("Derived metric added successfully!");
    }

    @GetMapping(path = {"/v1/getlenses","/v1/getlenses/{host}","/component/casp/v1/getlenses","/component/casp/v1/getlenses/{host}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String getLenses(
            @PathVariable(required = false, name = "host") String host,
            @RequestParam(required = false, name = "metadata_query") final List<String> metadataQuery) throws IOException {
        final Map<String, String> queryMap = queryToMap(metadataQuery);
        String res = service.getCanaryLenses(queryMap,host);
        return res;
    }

    @GetMapping(path = {"/v1/getexpressions","/v1/getexpressions/{host}","/component/casp/v1/getexpressions","/component/casp/v1/getexpressions/{host}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String getExpressions(
            @PathVariable(required = false, name = "host") String host,
            @RequestParam(required = false, name = "metadata_query") final List<String> metadataQuery) throws IOException {
        final Map<String, String> queryMap = queryToMap(metadataQuery);
        String res = service.getCanaryExpressions(queryMap,host);
        return res;
    }

    //http://localhost:15372/component/casp/v1/canaryview/timeseries/perf-genie-test41/?cell=deu72&start=1761116400000&end=1761670800000
    @GetMapping(path = {"/v1/canaryview/timeseries/","/v1/canaryview/timeseries/{host}","/component/casp/v1/canaryview/timeseries/","/component/casp/v1/canaryview/timeseries/{host}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String getCanaryCellTimeSeries(
            @PathVariable(required = false, name = "host") String host,
            @RequestParam(required = false, name = "start") final long start,
            @RequestParam(required = false, name = "end") final long end,
            @RequestParam(required = false, name = "cell") final String cell) throws IOException {
        final Map<String, String> queryMap = new HashMap<>();
        String res = service.getAllCanaryCellTimeSeries(start, end, cell,host);
        return Utils.toJson(res);
    }

    @GetMapping(path = {"/v1/getscope","/v1/getscope/{host}","/component/casp/v1/getscope","/component/casp/v1/getscope/{host}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String getScope(
            @PathVariable(required = false, name = "host") String host,
            @RequestParam(required = false, name = "start") final long start,
            @RequestParam(required = false, name = "end") final long end,
            @RequestParam(required = false, name = "cell") final String cell) throws IOException {
        ArrayList<String> scopes = ArgusQueryT.getScopeList(start, end, cell);
        if (scopes == null) {
            scopes = new ArrayList<>();
        }
        return Utils.toJson(scopes);
    }

    @GetMapping(path = {"/v1/canaryview/pidstats/","/v1/canaryview/pidstats/{host}","/component/casp/v1/canaryview/pidstats/","/component/casp/v1/canaryview/pidstats/{host}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String getCanaryPidstats(
            @PathVariable(required = false, name = "host") String host,
            @RequestParam(required = false, name = "start") final long start,
            @RequestParam(required = false, name = "end") final long end,
            @RequestParam(required = false, name = "instance") final String instance,
            @RequestParam(required = false, name = "cell") final String cell) throws IOException {
        final Map<String, String> queryMap = new HashMap<>();
        String res = service.getAllPidStatData(start, end, cell,instance,host);
        return res;
    }

    @GetMapping(path = {"/v1/kpodview"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String kpodview(
            @RequestParam(required = false, name = "start") final long start,
            @RequestParam(required = false, name = "end") final long end,
            @RequestParam(required = false, name = "cell") final String cell,
            @RequestParam(required = false, name = "domain") final String domain,
            @RequestParam(required = false, name = "instance") final String instance) throws IOException {
        return ArgusQueryT.kPODKeyMetricSums(start,end,instance,domain,cell);
    }

    @GetMapping(path = {"/v1/geniequery"}, produces = MediaType.APPLICATION_JSON_VALUE)
    
    public String geniequery(
        @RequestParam(required = false, name = "query") final String query,
        @RequestParam(required = false, name = "refId") final String refId,
        @RequestParam(required = false, name = "datasource") final String datasource,
        @RequestParam(required = false, name = "previous") final String previous,
        @RequestParam(required = false, name = "startTimestamp") final long startTimestamp,
        @RequestParam(required = false, name = "endTimestamp") final long endendTimestamp) throws IOException {
        //System.out.println(refId);
        if(datasource.equals("genie")){
            if(refId.equals("pidstats")){
                String[] array = query.split(":");
                return service.getAllPidStatData(startTimestamp,endendTimestamp,array[3],array[2],array[4]);
            }
        }else {
            return ArgusQueryT.genieQuery(query, refId, previous);
        }
        return null;
    }

    @GetMapping(path = {"/v1/canaryview","/v1/canaryview/{host}","/component/casp/v1/canaryview","/component/casp/v1/canaryview/{host}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String canaryview(
            @PathVariable(required = false, name = "host") String host,
            @RequestParam(required = false, name = "start") final long start,
            @RequestParam(required = false, name = "end") final long end,
            @RequestParam(required = false, name = "metadata_query") final List<String> metadataQuery) throws IOException {
        final Map<String, String> queryMap = queryToMap(metadataQuery);
        String res = service.getCanaryEvent(host,start,end);
        return res;
    }

    @PostMapping(path = {"/v1/comment","/v1/comment/{host}","/component/casp/v1/comment","/component/casp/v1/comment/{host}"})
    public ResponseEntity<String> postComment(@PathVariable(required = false, name = "host") String host,
                                              @RequestBody Comment comment) throws IOException{
        comment.setCommentTime(System.currentTimeMillis());
        service.addCanaryComment(Utils.toJson(comment),comment.getTimestamp(),comment.getCell(),comment.getColor(),comment.getCommentTime(), host);
        return ResponseEntity.ok("Comment posted successfully!");
    }

    @Autowired
    public PerfGenieController(PerfGenieService service) {
        this.service = service;
    }

    @GetMapping(path = {"/component/casp/v1/canaryheader","/v1/canaryheader",}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String canaryheader() throws IOException {
        return Resources.toString(Resources.getResource("canaryheader.json"), StandardCharsets.UTF_8);
    }

    /*@GetMapping(path = {"/component/casp/v1/canary","/component/casp/v1/canary/{host}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String canary(
            @PathVariable(required = false, name = "host") String host,
                          @RequestParam(required = false, name = "start") final long start,
                          @RequestParam(required = false, name = "end") final long end,
                          @RequestParam(required = false, name = "metadata_query") final List<String> metadataQuery) throws IOException {
        //final Map<String, String> queryMap = queryToMap(metadataQuery);
        return service.canaryTask(start,end,host);
    }*/

    @GetMapping(path = {"/v1/canarytask","/v1/canarytask/{host}","/component/casp/v1/canarytask","/component/casp/v1/canarytask/{host}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String canarySideBySideTask(
            @PathVariable(required = false, name = "host") String host,
            @RequestParam(required = false, name = "start") final long start,
            @RequestParam(required = false, name = "end") final long end,
            @RequestParam(required = false, name = "type") final String type,
            @RequestParam(required = false, name = "metadata_query") final List<String> metadataQuery) throws IOException {
        //final Map<String, String> queryMap = queryToMap(metadataQuery);
        //avoids duplicates
        if(type == null){
            return service.canarySideBySideTask(start,end,"sidebyside",host);
        }else{
            return service.canarySideBySideTask(start,end,type,host);
        }

    }

    /*@GetMapping(path = {"/component/casp/v1/release","/component/casp/v1/release/{host}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String release(
            @PathVariable(required = false, name = "host") String host,
            @RequestParam(required = false, name = "start") final long start,
            @RequestParam(required = false, name = "end") final long end,
            @RequestParam(required = false, name = "metadata_query") final List<String> metadataQuery) throws IOException {
        //final Map<String, String> queryMap = queryToMap(metadataQuery);
        return service.releaseTask(start,end, host);
    }*/

    @GetMapping(path = {"/v1/processcustomcanary","/v1/processcustomcanary/{host}","/component/casp/v1/processcustomcanary","/component/casp/v1/processcustomcanary/{host}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String processcustomcanary(
            @PathVariable(required = false, name = "host") String host,
            @RequestParam(required = false, name = "start") final long start,
            @RequestParam(required = false, name = "end") final long end,
            @RequestParam(required = false, name = "cell") final String cell,
            @RequestParam(required = false, name = "basekpods") final String basekpods,
            @RequestParam(required = false, name = "canarykpods") final String canarykpods
            ) throws IOException {
        // Default to "*" if not provided
        final String basekpodsValue = (basekpods != null && !basekpods.trim().isEmpty()) ? basekpods : "*";
        final String canarykpodsValue = (canarykpods != null && !canarykpods.trim().isEmpty()) ? canarykpods : "*";
        //creates duplicates
        return service.processSideBySideCanaryTask(start,end,cell,host,basekpodsValue,canarykpodsValue);
    }

    @GetMapping(path = {"/v1/refreshcanary","/v1/refreshcanary/{host}","/component/casp/v1/refreshcanary","/component/casp/v1/refreshcanary/{host}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String refreshcanary(
            @PathVariable(required = false, name = "host") String host,
            @RequestParam(required = false, name = "start") final long start,
            @RequestParam(required = false, name = "end") final long end,
            @RequestParam(required = false, name = "cell") final String cell
    ) throws IOException {
        //creates duplicates
        return service.processRefreshRequest(start,end,cell,host);
    }

    @GetMapping(path = {"/v1/processperfswat","/v1/processperfswat/{host}","/component/casp/v1/processperfswat","/component/casp/v1/processperfswat/{host}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String processperfswat(
            @PathVariable(required = false, name = "host") String host,
            @RequestParam(required = false, name = "start1") final long start1,
            @RequestParam(required = false, name = "end1") final long end1,
            @RequestParam(required = false, name = "cell1") final String cell1,
            @RequestParam(required = false, name = "start2") final long start2,
            @RequestParam(required = false, name = "end2") final long end2,
            @RequestParam(required = false, name = "cell2") final String cell2
    ) throws IOException {

        //creates duplicates
        return service.processWeekOverWeekCanaryTask(start1,end1,cell1,start2,end2,cell2,host);
    }

    @GetMapping(path = {"/v1/canarybackup","/component/casp/v1/canarybackup"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String canarybackup(
            @RequestParam(required = false, name = "start") final long start,
            @RequestParam(required = false, name = "end") final long end,
            @RequestParam(required = false, name = "metadata_query") final List<String> metadataQuery) throws IOException {
        final Map<String, String> queryMap = queryToMap(metadataQuery);
        String res = service.backupCanaryEvent(start,end);
        return res;
    }

    @GetMapping(path = {"/v1/canarycomments","/v1/canarycomments/{host}","/component/casp/v1/canarycomments","/component/casp/v1/canarycomments/{host}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String canarycomments(
            @PathVariable(required = false, name = "host") String host,
            @RequestParam(required = false, name = "start") final long start,
            @RequestParam(required = false, name = "end") final long end,
            @RequestParam(required = false, name = "metadata_query") final List<String> metadataQuery) throws IOException {
        final Map<String, String> queryMap = queryToMap(metadataQuery);
        String res = service.getCanaryComments(start,end, queryMap,host);
        return res;
    }

    //@CrossOrigin
    @GetMapping(path = {"/v1/tenants", "/v1/tenants/{tenant}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String tenants(@PathVariable(required = false, name = "tenant") String tenant,
                          @RequestParam(required = false, name = "start") final long start,
                          @RequestParam(required = false, name = "end") final long end,
                          @RequestParam(required = false, name = "metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        final Map<String, String> dimMap = new HashMap<>();
        return service.getGenieTenants(start, end, queryMap, dimMap);
    }

    //@CrossOrigin
    @GetMapping(path = {"/v1/instances", "/v1/instances/{tenant}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String instances(@PathVariable(required = false, name = "tenant") String tenant,
                            @RequestParam(required = false, name = "start") final long start,
                            @RequestParam(required = false, name = "end") final long end,
                            @RequestParam(required = false, name = "metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        return service.getGenieInstances(start, end, tenant, queryMap);
    }

    //@CrossOrigin
    @GetMapping(path = {"/v1/meta", "/v1/meta/{tenant}/{instance}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String meta(@PathVariable(required = false, name = "tenant") String tenant,
                       @PathVariable(required = false, name = "instance") final String instance,
                       @RequestParam(required = false, name = "start") final long start,
                       @RequestParam(required = false, name = "end") final long end,
                       @RequestParam(required = false, name = "metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        final Map<String, String> dimMap = new HashMap<>();
        return service.getGenieMeta(start, end, queryMap, dimMap, tenant, instance);//, host);
    }

    @GetMapping(path = {"/v1/gold/meta"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String goldMeta(@RequestParam(required = false, name = "start") final long start,
                       @RequestParam(required = false, name = "end") final long end,
                       @RequestParam(required = false, name = "metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        final Map<String, String> dimMap = new HashMap<>();
        return service.getGenieGoldMeta(start, end, queryMap, dimMap);//, host);
    }

    @GetMapping(path = {"/v1/backup", "/v1/backup/{tenant}/{instance}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String backup(@PathVariable(required = false, name = "tenant") String tenant,
                       @PathVariable(required = false, name = "instance") final String instance,
                       @RequestParam(required = false, name = "start") final long start,
                         @RequestParam(required = false, name = "end") final long end,
                         @RequestParam(required = false, name = "metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        final Map<String, String> dimMap = new HashMap<>();
        return service.backupEvents(start, end, queryMap, dimMap, tenant, instance);
    }

    @GetMapping(path = {"/v1/downloadall", "/v1/downloadall/{tenant}/{instance}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> downloadAll(@PathVariable(required = false, name = "tenant") String tenant,
                              @PathVariable(required = false, name = "instance") final String instance,
                              @RequestParam(required = false, name = "start") final long start,
                              @RequestParam(required = false, name = "end") final long end,
                              @RequestParam(required = false, name = "metadata_query") final List<String> metadataQuery,
                              @RequestHeader(value = HttpHeaders.RANGE, required = false) String range) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        final Map<String, String> dimMap = new HashMap<>();

        String fileName = tenant + instance + start + end;
        Path path = Paths.get("/tmp/", fileName);
        File file = path.toFile();

        if (!file.exists()) {
            service.downlaodAllEvents(start, end, queryMap, dimMap, tenant, instance, fileName);
        }

        if (!file.exists()) {
            return ResponseEntity.notFound().build();
        }

        long fileSize = file.length();
        try {

            if (range != null) {
                // Parse the range header, e.g., "bytes=100-199,300-399"
                List<HttpRange> ranges = HttpRange.parseRanges(range);
                if (ranges.isEmpty()) {
                    return ResponseEntity.badRequest().build();
                }

                long totalLength = 0;
                StringBuilder contentRange = new StringBuilder();
                StringBuilder contentDisposition = new StringBuilder();
                byte[] boundary = ("--boundary" + System.currentTimeMillis()).getBytes();

                // Prepare the response as a multipart message with each part representing a byte range
                StringBuilder body = new StringBuilder();

                // Iterate through each range, handle multiple ranges
                for (HttpRange httpRange : ranges) {
                    long rangeStart = httpRange.getRangeStart(fileSize);
                    long rangeEnd = httpRange.getRangeEnd(fileSize);
                    long rangeLength = rangeEnd - rangeStart + 1;

                    // Append each part's headers
                    body.append("--boundary\n")
                            .append("Content-Type: application/octet-stream\n")
                            .append("Content-Range: bytes ").append(rangeStart).append("-").append(rangeEnd)
                            .append("/").append(fileSize).append("\n")
                            .append("Content-Length: ").append(rangeLength).append("\n\n");

                    // Read the file content for this range and append to the response body
                    byte[] fileBytes = new byte[(int) rangeLength];
                    try (InputStream inputStream = Files.newInputStream(path)) {
                        inputStream.skip(rangeStart); // Skip to the start of the range
                        inputStream.read(fileBytes);
                    }

                    // Add the actual file content to the body
                    body.append(new String(fileBytes));
                    totalLength += rangeLength;
                }

                // End of multipart message
                body.append("\n--boundary--\n");

                // Set headers for multipart response
                HttpHeaders headers = new HttpHeaders();
                headers.set("Content-Type", "multipart/byteranges; boundary=boundary");
                headers.set("Content-Length", String.valueOf(totalLength));

                return ResponseEntity.ok()
                        .headers(headers)
                        .body(body.toString());

            } else {
                // If no range header, return the full file
                FileSystemResource fileResource = new FileSystemResource(file);
                String contentType = Files.probeContentType(path);

                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.getName() + "\"")
                        .contentType(org.springframework.http.MediaType.parseMediaType(contentType))
                        .body(fileResource);
            }

        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }



    //@CrossOrigin
    @GetMapping(path = {"/v1/jstacks", "/v1/jstacks/{tenant}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String jstacks(@PathVariable(required = false, name = "tenant") String tenant,
                          @RequestParam(required = false, name = "start") final long start,
                          @RequestParam(required = false, name = "end") final long end,
                          @RequestParam("metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        return service.getJstackProfile(tenant, start, end, queryMap);
    }

    @GetMapping(path = {"/v1/event", "/v1/event/{tenant}"}, produces = MediaType.ALL_VALUE)
    public String event(@PathVariable(required = false, name = "tenant") String tenant,
                        @RequestParam(required = false, name = "start") final long start,
                        @RequestParam(required = false, name = "end") final long end,
                        @RequestParam("metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        final Map<String, String> dimMap = new HashMap<>();

        return service.getGenieEvent(tenant, start, end, queryMap, dimMap);
    }

    @GetMapping(path = {"/v1/profile", "/v1/profile/{tenant}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String profile(@PathVariable(required = false, name = "tenant") String tenant,
                          @RequestParam(required = false, name = "start") final long start,
                          @RequestParam(required = false, name = "end") final long end,
                          @RequestParam("metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        final Map<String, String> dimMap = new HashMap<>();

        return service.getGenieProfile(tenant, start, end, queryMap, dimMap);
    }

    @GetMapping(path = {"/v1/profiles", "/v1/profiles/{tenant}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String profiles(@PathVariable(required = false, name = "tenant") String tenant,
                           @RequestParam(required = false, name = "start") final long start,
                           @RequestParam(required = false, name = "end") final long end,
                           @RequestParam("metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        final Map<String, String> dimMap = new HashMap<>();
        return service.getGenieProfiles(tenant, start, end, queryMap, dimMap);
    }

    @GetMapping(path = {"/v1/customevents", "/v1/customevents/{tenant}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String customevents(@PathVariable(required = false, name = "tenant") String tenant,
                               @RequestParam(required = false, name = "start") final long start,
                               @RequestParam(required = false, name = "end") final long end,
                               @RequestParam("metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        final Map<String, String> dimMap = new HashMap<>();
        return service.getContextEvents(tenant, start, end, queryMap, dimMap);
    }

    @GetMapping(path = {"/v1/otherevents", "/v1/otherevents/{tenant}"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String otherevents(@PathVariable(required = false, name = "tenant") String tenant,
                              @RequestParam(required = false, name = "start") final long start,
                              @RequestParam(required = false, name = "end") final long end,
                              @RequestParam("metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        final Map<String, String> dimMap = new HashMap<>();
        return service.getOtherEvents(tenant, start, end, queryMap, dimMap);
    }

    @GetMapping(path = {"/v1/download", "/v1/download/{tenant}"})//, produces = MediaType.APPLICATION_OCTET_STREAM)
    public ResponseEntity<InputStreamResource> downloadPayload(@PathVariable(required = false, name = "tenant") String tenant,
                                                               @RequestParam(required = false, name = "timestamp") final long timestamp,
                                                               @RequestParam("metadata_query") final List<String> metadataQuery) throws IOException {

        final Map<String, String> queryMap = queryToMap(metadataQuery);
        final Map<String, String> dimMap = new HashMap<>();

        byte[] fileContent = "Hello, world!".getBytes();
        InputStream inputStream = service.getGenieEventStream(tenant, timestamp, queryMap, dimMap);

        HttpHeaders headers = new HttpHeaders();
        String filename = queryMap.get("file-name");
        filename = Long.toString(timestamp) + "_" + filename.replace("=", "");
        headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename);
        return ResponseEntity.ok()
                .headers(headers)
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(new InputStreamResource(inputStream));
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


    public static class Comment {
        private String comment;
        private String color;

        public String getCell() {
            return cell;
        }

        public void setCell(String cell) {
            this.cell = cell;
        }

        private String cell;

        public Long getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(Long timestamp) {
            this.timestamp = timestamp;
        }

        public Long getCommentTime() {
            return commentTime;
        }

        public void setCommentTime(Long commentTime) {
            this.commentTime = commentTime;
        }

        private Long commentTime;

        private Long timestamp;
        // Getters and Setters
        public String getComment() {
            return comment;
        }

        public void setComment(String comment) {
            this.comment = comment;
        }

        public String getColor() {
            return color;
        }

        public void setColor(String color) {
            this.color = color;
        }
    }
    public static class Lense {
        public String getConfig() {
            return config;
        }

        public void setConfig(String config) {
            this.config = config;
        }

        private String config;

        public String getSource() {
            return source;
        }

        public void setSource(String source) {
            this.source = source;
        }

        private String source;

        public long getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(long timestamp) {
            this.timestamp = timestamp;
        }

        private long timestamp;

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        private String type;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        private String name;

    }

    public static class Expression {
        public String getConfig() {
            return config;
        }

        public void setConfig(String config) {
            this.config = config;
        }

        private String config;

        public String getSource() {
            return source;
        }

        public void setSource(String source) {
            this.source = source;
        }

        private String source;

        public long getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(long timestamp) {
            this.timestamp = timestamp;
        }

        private long timestamp;

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        private String type;
        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        private String name;

    }

}
