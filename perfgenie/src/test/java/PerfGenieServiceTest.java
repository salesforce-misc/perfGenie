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
import server.PerfGenieService;
import server.utils.CustomJfrParser;
import server.utils.EventHandler;
import server.utils.EventStore;
import server.utils.Utils;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;


import static org.testng.Assert.assertTrue;
import static server.utils.EventStore.NAMESPACE_JFR_JSON_CACHE;

public class PerfGenieServiceTest extends PerfGenieService {
    private static  CustomJfrParser parser = new CustomJfrParser(1);
    private static EventStore eventStore;

    static {
        try {
            eventStore = new EventStore(getCantorInstance());
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private static final Cantor cantor = getCantorInstance();
    public PerfGenieServiceTest serviceTest;
    String guid = Utils.generateGuid();

    PerfGenieServiceTest() throws IOException{
        super(eventStore, parser);
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
        queryMap.put("tenant", "test");
        queryMap.put("host", "localhost");
        queryMap.put("file-name", "testfile");
        queryMap.put("type", "jfrprofile");
        queryMap.put("name", "testname");
        boolean ret = serviceTest.addEvent(Utils.toJson(handler.getProfileTree("jdk.ExecutionSample")), timestamp, dimMap, queryMap);

        queryMap.put("type", "jfrevent");
        queryMap.put("name", "customEvent");
        boolean ret1 = serviceTest.addEvent(Utils.toJson(handler.getLogContext()), timestamp, dimMap, queryMap);

        assertTrue(ret==true, "true expected");
        assertTrue(ret1==true, "true expected");
    }

    @Test (dependsOnMethods = {"addEventTest"})
    void getMetaTest() throws IOException{
        final Map<String, String> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("guid", guid);
        queryMap.put("name", "testname");
        long end = System.currentTimeMillis();
        long start = end-60000;
        String json = serviceTest.getMeta(start,end,queryMap,dimMap);
        ObjectMapper mapper = new ObjectMapper();
        JsonNode n = mapper.readTree(json);
        assertTrue(n.size()==1, "1 expected");
    }

    @Test (dependsOnMethods = {"addEventTest"})
    void getProfileTest() throws IOException{
        final Map<String, String> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("guid", guid);
        queryMap.put("tenant", "test");
        queryMap.put("host", "localhost");
        queryMap.put("file-name", "testfile");
        queryMap.put("type", "jfrprofile");
        queryMap.put("name", "testname");
        long end = System.currentTimeMillis();
        long start = end-60000;
        String json = serviceTest.getProfile("tenant", start,end,queryMap,dimMap);
        ObjectMapper mapper = new ObjectMapper();
        JsonNode n = mapper.readTree(json);
        assertTrue(n.size()==4, "4 expected");
    }

    @Test (dependsOnMethods = {"addEventTest"})
    void getProfilesTest() throws IOException{
        final Map<String, String> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("guid", guid);
        queryMap.put("tenant", "test");
        queryMap.put("host", "localhost");
        queryMap.put("file-name", "testfile");
        queryMap.put("type", "jfrprofile");
        queryMap.put("name", "testname");
        long end = System.currentTimeMillis();
        long start = end-60000;
        String json = serviceTest.getProfiles("tenant", start,end,queryMap,dimMap);
        ObjectMapper mapper = new ObjectMapper();
        JsonNode n = mapper.readTree(json);
        assertTrue(n.size()==4, "4 expected");
    }

    @Test (dependsOnMethods = {"addEventTest"})
    void getCustomEventsTest() throws IOException{
        final Map<String, String> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("guid", guid);
        queryMap.put("tenant", "test");
        queryMap.put("host", "localhost");
        queryMap.put("file-name", "testfile");
        queryMap.put("type", "jfrevent");
        queryMap.put("name", "customEvent");
        long end = System.currentTimeMillis();
        long start = end-60000;
        String json = serviceTest.getCustomEvents("tenant", start,end,queryMap,dimMap);
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
