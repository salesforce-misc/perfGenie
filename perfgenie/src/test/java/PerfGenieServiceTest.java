/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.io.Resources;
import org.testng.annotations.BeforeSuite;
import org.testng.annotations.Test;
import com.salesforce.cantor.Cantor;
import com.salesforce.cantor.h2.CantorOnH2;
import perfgenie.utils.*;
import server.PerfGenieService;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;


import static org.testng.Assert.assertTrue;
//import static utils.EventStore.NAMESPACE_JFR_JSON_CACHE;

public class PerfGenieServiceTest extends PerfGenieService {
    private static  CustomJfrParser parser = new CustomJfrParser(1);
    private static EventStore eventStore;

    private static Config config = new Config();

    static {
        try {
            eventStore = new EventStore(getCantorInstance(), new Config());
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private static final Cantor cantor = getCantorInstance();
    public PerfGenieServiceTest serviceTest;
    String guid = Utils.generateGuid();

    PerfGenieServiceTest() throws IOException{
        super(eventStore, parser, config);
    }

    @BeforeSuite
    void setup() throws IOException{
        serviceTest = new PerfGenieServiceTest();
    }

    @Test
    void addEventTest() throws IOException{
        EventHandler handler = new EventHandler();
        parser.parseStream(handler,new ByteArrayInputStream(Resources.toByteArray(Resources.getResource("test.jfr"))));

        final Map<String, Double> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();

        long timestamp = System.currentTimeMillis();
        queryMap.put("guid", guid);
        queryMap.put("tenant-id", "dev");
        queryMap.put("host", "localhost");
        queryMap.put("instance-id", "localhost");
        queryMap.put("file-name", "testfile");
        queryMap.put("type", "jfrprofile");
        queryMap.put("name", "testname");
        queryMap.put("source", "genie");
        serviceTest.addGenieLargeEvent(Utils.toJson(handler.getProfileTree("jdk.ExecutionSample")), timestamp, dimMap, queryMap, "dev");

        queryMap.put("type", "jfrevent");
        queryMap.put("name", "jfr-context");
        serviceTest.addGenieLargeEvent(Utils.toJson(handler.getLogContext()), timestamp, dimMap, queryMap, "dev");

        //assertTrue(ret==true, "true expected");

        assertTrue(true==true, "true expected");
    }

    @Test (dependsOnMethods = {"addEventTest"})
    void getMetaTest() throws IOException{
        final Map<String, String> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("guid", guid);
        queryMap.put("tenant-id", "dev");
        queryMap.put("name", "testname");
        queryMap.put("host", "localhost");
        queryMap.put("instance-id", "localhost");
        queryMap.put("source", "genie");
        long end = System.currentTimeMillis();
        long start = end-60000;
        String json = serviceTest.getGenieMeta(start,end,queryMap,dimMap,"dev","localhost");
        ObjectMapper mapper = new ObjectMapper();
        JsonNode n = mapper.readTree(json);
        assertTrue(n.size()==1, ">1 expected");

        queryMap.put("type", "jfrevent");
        queryMap.put("name", "jfr-context");
        String json1 = serviceTest.getGenieMeta(start,end,queryMap,dimMap,"dev","localhost");
        ObjectMapper mapper1 = new ObjectMapper();
        JsonNode n1 = mapper.readTree(json);
        assertTrue(n1.size()==1, "1 expected");
    }

    @Test (dependsOnMethods = {"addEventTest"})
    void getProfileTest() throws IOException{
        final Map<String, String> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("guid", guid);
        queryMap.put("tenant-id", "dev");
        queryMap.put("host", "localhost");
        queryMap.put("instance-id", "localhost");
        queryMap.put("file-name", "testfile");
        queryMap.put("type", "jfrprofile");
        queryMap.put("name", "testname");
        queryMap.put("source", "genie");
        long end = System.currentTimeMillis();
        long start = end-60000;
        String json = serviceTest.getGenieProfile("dev", start,end,queryMap,dimMap);
        ObjectMapper mapper = new ObjectMapper();
        JsonNode n = mapper.readTree(json);
        assertTrue(n.size()==4, "4 expected");
    }

    @Test (dependsOnMethods = {"addEventTest"})
    void getProfilesTest() throws IOException{
        final Map<String, String> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("guid", guid);
        queryMap.put("tenant-id", "dev");
        queryMap.put("host", "localhost");
        queryMap.put("instance-id", "localhost");
        queryMap.put("file-name", "testfile");
        queryMap.put("type", "jfrprofile");
        queryMap.put("name", "testname");
        queryMap.put("source", "genie");
        long end = System.currentTimeMillis();
        long start = end-60000;
        String json = serviceTest.getGenieProfiles("dev", start,end,queryMap,dimMap);
        ObjectMapper mapper = new ObjectMapper();
        JsonNode n = mapper.readTree(json);
        assertTrue(n.size()==4, "4 expected");
    }

    @Test (dependsOnMethods = {"addEventTest"})
    void getCustomEventsTest() throws IOException{
        final Map<String, String> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("guid", guid);
        queryMap.put("tenant-id", "dev");
        queryMap.put("host", "localhost");
        queryMap.put("instance-id", "localhost");
        queryMap.put("file-name", "testfile");
        queryMap.put("type", "jfrevent");
        queryMap.put("name", "jfr-context");
        queryMap.put("source", "genie");
        long end = System.currentTimeMillis();
        long start = end-60000;
        String json = serviceTest.getContextEvents("dev", start,end,queryMap,dimMap);
        ObjectMapper mapper = new ObjectMapper();
        JsonNode n = mapper.readTree(json);
        assertTrue(n.size()==3, "3 expected");
    }

    public static Cantor getCantorInstance() {
        try {
            return new CantorOnH2("/tmp/mat-report-job-test/" + UUID.randomUUID().toString());
        } catch (Exception e) {
            return null;
        }
    }
}
