/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server;

import com.google.common.base.Stopwatch;
import com.google.common.collect.ImmutableMap;
import com.salesforce.cantor.Events;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import perfgenie.utils.*;

import java.io.*;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.slf4j.LoggerFactory;



public class PerfGenieService implements IPerfGenieService {
    final EventStore eventStore;
    final CustomJfrParser parser;

    private final org.slf4j.Logger  logger =  LoggerFactory.getLogger(PerfGenieService.class);
    private static String tenant = "dev";
    private static String host = "localhost";
    final Config config;

    //cronjob to parse jfrs placed in a directory
    @Scheduled(cron = "*/10 * * ? * *")
    private void cronJob() throws IOException {
        createDirectoryIfNotExists(config.getJfrdir());
        runJob();
    }
    @Scheduled(cron = "0 */10 * ? * *")
    private void cleanupJob() throws IOException {
        LocalDateTime now = LocalDateTime.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        logger.info(now.format(formatter) + " running cleanup job for dir " + config.getJfrdir());
        deleteOldFiles(config.getJfrdir(), 1);
    }
    public static void createDirectoryIfNotExists(String directoryPath) {
        Path path = Paths.get(directoryPath);
        if (Files.notExists(path)) {
            try {
                Files.createDirectories(path);
                System.out.println("Directory created: " + directoryPath);
            } catch (IOException e) {
                System.err.println("Failed to create directory: " + e.getMessage());
            }
        }
    }

    public void runJob() throws IOException{
        tenant = config.getTenant();
        host = InetAddress.getLocalHost().getHostName();

        logger.info("looking for Jfrs at " + config.getJfrdir());
        File folder = new File(config.getJfrdir());
        File[] listOfFiles = folder.listFiles();

        if (listOfFiles == null)
            return;

        Arrays.sort(listOfFiles, Comparator.comparingLong(File::lastModified));

        /*
        boolean hasJsonEvent = false;
        for (File file : listOfFiles) {
            if(file.isFile() && file.getName().contains(".json.gz")){
                hasJsonEvent = true;
                break;
            }
        }
        if(hasJsonEvent) {
            long timestamp = System.currentTimeMillis();
            String guid = Utils.generateGuid();
            final Stopwatch timer = Stopwatch.createStarted();
            final Map<String, Double> dimMap = new HashMap<>();
            final Map<String, String> queryMap = new HashMap<>();

            queryMap.put("tenant-id", tenant);
            queryMap.put("host", host);
            queryMap.put("instance-id", host);

            for (File file : listOfFiles) {
                if (file.isFile() && file.getName().contains(".json.gz")) {
                    if (file.getName().equals("jfr_dump_log.json.gz")){
                        //queryMap.put("type", "jfrevent");
                        queryMap.put("name", "jfr");
                    }else{
                        //queryMap.put("type", "jfrprofile");
                        queryMap.put("name", "jfr");
                    }
                    queryMap.put("guid", guid+file.getName());
                    queryMap.put("file-name", file.getName());

                    String payload = new String(Utils.decompress(Files.readAllBytes(Paths.get(file.getPath()))), StandardCharsets.UTF_8);
                    int payloadSize = payload.length();
                    //queryMap.put("size", String.valueOf(payloadSize));
                    System.out.println(payloadSize);
                    eventStore.addEvent(timestamp, queryMap, dimMap, payload);
                    logger.info("successfully loaded " + file.getName() + " and stored event.");
                    Path path = Paths.get(file.getPath());
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                }
            }
            logger.info("successfully handled json events " + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
        }
         */

        for (File file : listOfFiles) {
            if (file.isFile() && file.getName().contains(".jfr") || file.getName().contains(".jfr.gz")) {
                logger.info("processing file: " + file.getName());
                EventHandler handler = new EventHandler();
                long timestamp = System.currentTimeMillis();
                String guid = Utils.generateGuid();
                final Stopwatch timer = Stopwatch.createStarted();
                try {
                    parser.parseStream(handler, file.getPath());
                    handler.processMonitorLog(config.getJfrdir()+"/monitor.log");
                    Path path = Paths.get(config.getJfrdir()+"/monitor.log");
                    // deleteIfExists File
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                    final Map<String, Double> dimMap = new HashMap<>();
                    final Map<String, String> queryMap = new HashMap<>();
                    queryMap.put("guid", guid);
                    queryMap.put("source", "genie");
                    queryMap.put("tenant-id", tenant);
                    queryMap.put("instance-id", host);
                    queryMap.put("host", host);
                    queryMap.put("source-file", file.getName());

                    List<String> l = handler.getProfileList();
                    for (int i = 0; i < l.size(); i++) {
                        Object profile = handler.getProfileTree(config.getFilterDepth(),l.get(i),config.isExperimental());
                        queryMap.put("type", "jfrprofile");
                        queryMap.put("name", "jfr");
                        queryMap.put("file-name", l.get(i));//
                        final String payload = Utils.toJson(profile);
                        int payloadSize = payload.length();
                        queryMap.put("size", String.valueOf(payloadSize));
                        System.out.println(payloadSize);
                        eventStore.addGenieLargeEvent(timestamp, queryMap, dimMap, payload, config.getTenant(), true);
                    }
                    Object logContext = handler.getLogContext();
                    queryMap.put("file-name", "jfr-context");//
                    queryMap.put("type", "jfrevent");
                    queryMap.put("name", "jfr");

                    eventStore.addGenieLargeEvent(timestamp, queryMap, dimMap, Utils.toJson(logContext), config.getTenant(), true);
                } catch (Exception e) {
                    System.out.println(e);
                    logger.warn("Exception parsing file 3" + file.getPath() + ":" + e.getStackTrace());
                    e.printStackTrace();
                }
                new File(file.getPath()).delete();
                logger.info("successfully parsed " + file.getPath() + " and stored " + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
            } else if (file.isFile() && (file.getName().contains(".jstack") || file.getName().contains(".txt"))) {
                EventHandler handler = new EventHandler();
                long timestamp = System.currentTimeMillis();
                String guid = Utils.generateGuid();
                final Stopwatch timer = Stopwatch.createStarted();
                try {
                    BufferedReader reader = new BufferedReader(new FileReader(file.getPath()));
                    StringBuilder stringBuilder = new StringBuilder();
                    char[] buffer = new char[10];
                    while (reader.read(buffer) != -1) {
                        stringBuilder.append(new String(buffer));
                        buffer = new char[10];
                    }
                    reader.close();
                    String content = stringBuilder.toString();
                    handler.initializeProfile("Jstack");
                    handler.initializePid("Jstack");
                    handler.processJstackEvent(timestamp * 1000000, content);
                    final Map<String, Double> dimMap = new HashMap<>();
                    final Map<String, String> queryMap = new HashMap<>();
                    queryMap.put("guid", guid);
                    queryMap.put("source", "genie");
                    queryMap.put("tenant-id", tenant);
                    queryMap.put("instance-id", host);
                    queryMap.put("host", host);
                    queryMap.put("source-file", file.getName());

                    queryMap.put("file-name", "json-jstack");
                    Object profile = handler.getProfileTree("Jstack");
                    queryMap.put("type", "json-jstack");
                    queryMap.put("name", "jstack");
                    eventStore.addGenieEvent(timestamp, queryMap, dimMap, Utils.toJson(profile),config.getTenant());

                    Object logContext = handler.getLogContext();
                    queryMap.put("file-name", "monitor-context");//
                    queryMap.put("type", "monitorevent");
                    queryMap.put("name", "monitor");

                    eventStore.addGenieEvent(timestamp, queryMap, dimMap, Utils.toJson(logContext), config.getTenant());
                } catch (Exception e) {
                    System.out.println(e);
                    logger.warn("Exception parsing file 4" + file.getPath() + ":" + e.getStackTrace());
                    e.printStackTrace();
                }
                new File(file.getPath()).delete();
                logger.info("successfully parsed " + file.getPath() + " and stored event " + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
            }
        }
    }
    @Autowired
    public PerfGenieService(final EventStore eventStore, final CustomJfrParser parser, final Config config) throws IOException {
        this.eventStore = eventStore;
        this.parser = parser;
        this.config = config;
    }

    @Override
    public void addGenieLargeEvent(final String payload, final long timestamp, final Map<String, Double> dimMap, final Map<String, String> queryMap, final String tenant) throws IOException {
        eventStore.addGenieLargeEvent(timestamp, queryMap, dimMap, payload, tenant, true);
    }

    @Override
    public boolean addGenieEvent(final String payload, final long timestamp, final Map<String, Double> dimMap, final Map<String, String> queryMap, final String tenant) throws IOException {
        return eventStore.addGenieEvent(timestamp, queryMap, dimMap, payload, tenant);
    }

    @Override
    public String getGenieTenants(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException {
        List<String> namespaces = new ArrayList<>();
        namespaces.add("maiev-tenant-dev");//todo config.properties

        return eventStore.getGenieTenants(start, end, queryMap, dimMap, namespaces);
    }

    @Override
    public String getGenieInstances(long start, long end, final String tenant, final Map<String, String> queryMap) throws IOException {
        return eventStore.getGenieInstances(tenant, start, end, queryMap);
    }

    @Override
    public String getGenieMeta(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final String tenant, final String instance) throws IOException {
        return eventStore.getGenieMeta(start, end, queryMap, dimMap, tenant, instance);
    }

    @Override
    public String getGenieProfile(final String tenant, long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) {
        try {
            return eventStore.getGenieLargeEvent(start, end, queryMap, dimMap, tenant);
        } catch (Exception e) {
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Profiles not found", queryMap, null));
        }
    }

    @Override
    public String getGenieEvent(final String tenant, long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) {
        try {
            return eventStore.getGenieEvent(start, end, queryMap, dimMap, tenant);
        } catch (Exception e) {
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Profiles not found", queryMap, null));
        }
    }

    @Override
    public InputStream getGenieEventStream(final String tenant, long timestamp,final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException{
        return eventStore.eventStream(timestamp,queryMap,dimMap,tenant);
    }

    @Override
    public String getGenieProfiles(final String tenant, long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException {
            logger.info("getGenieProfiles processing " + queryMap);

            Map<Long, Map<String, String>> profiles = eventStore.loadGenieProfiles(tenant, start, end, queryMap, dimMap, false);

            if (profiles == null || profiles.size() < 1) {
                logger.info("getGenieProfiles done error " + queryMap);
                return Utils.toJson(new EventHandler.JfrParserResponse(null, "no profiles found for the given time range", queryMap, null));
            }
            try {
                final EventHandler aggregator = new EventHandler();
                List<Long> tosort = new ArrayList<>();
                for (Long timestamp : profiles.keySet()) {
                    tosort.add(timestamp);
                }
                Collections.sort(tosort);
                for (int i = 0; i < tosort.size(); i++) {
                    queryMap.put("guid", profiles.get(tosort.get(i)).get("guid"));
                    String result;
                    result = eventStore.getGenieLargeEvent(tosort.get(i), tosort.get(i), queryMap, dimMap, tenant);
                    aggregator.aggregateTree((EventHandler.JfrParserResponse) Utils.readValue(result, EventHandler.JfrParserResponse.class));
                }
                if (config.isExperimental() || tosort.size() == 1) {
                    SurfaceDataResponse res = genSurfaceData(aggregator.getAggregatedProfileTree(), tenant, queryMap.get("host"));
                    EventHandler.JfrParserResponse apr = (EventHandler.JfrParserResponse) aggregator.getAggregatedProfileTree();
                    apr.addMeta(ImmutableMap.of("data", Utils.toJson(res)));
                    final String response = Utils.toJson(apr);
                    logger.info("getGenieProfiles done with surface " + queryMap);
                    return response;
                } else {
                    EventHandler.JfrParserResponse apr = (EventHandler.JfrParserResponse) aggregator.getAggregatedProfileTree();
                    logger.info("getGenieProfiles done" + queryMap);
                    return Utils.toJson(apr);
                }
            } catch (Exception e) {
                return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to aggregate" + e.getMessage(), queryMap, null));
            }
    }

    private String getJstackProfileFromRaw(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException {
        queryMap.put("name","=jstack");
        //queryMap.put("get_raw_jstack_flag","=true");
        queryMap.remove("file-name");
        logger.info("trying getJstackProfileFromRaw");
        Map<Long,String> jstackRawEvents = eventStore.getOtherPayLoads(tenant, start, end, queryMap, dimMap, true);
        if (jstackRawEvents == null || jstackRawEvents.size() < 1) {
            logger.info("get raw jstacks without get_raw_jstack_flag response ");
            queryMap.remove("get_raw_jstack_flag"); //do not trust this flag
            jstackRawEvents = eventStore.getOtherPayLoads(tenant, start, end, queryMap, dimMap, true);
            if (jstackRawEvents == null || jstackRawEvents.size() < 1) {
                return Utils.toJson(new EventHandler.JfrParserResponse(null, "no jstack / raw jstack events found for the given time range", queryMap, null));
            }
        }
        final EventHandler aggregator = new EventHandler();
        aggregator.initializeProfile("Jstack");
        aggregator.initializePid("Jstack"); List<Long> keys = new ArrayList<Long>(jstackRawEvents.keySet());
        Collections.sort(keys);
        Long prevKey = -1L;
        for (int i = 0; i < keys.size(); i++) {
            if (keys.get(i) == prevKey) {
                continue;//avoid processing dup events
            }
            prevKey = keys.get(i);
            aggregator.processJstackEvent(keys.get(i), jstackRawEvents.get(keys.get(i)), true);
        }
        Object profile =  aggregator.getProfileTree("Jstack");
        final String response = Utils.toJson(profile);
        logger.info(queryMap.get("name")+" response length: " + response.length());
        return response;
    }
    @Override
    public String getJstackProfile(final String tenant, final long start, final long end, final Map<String, String> queryMap) throws IOException {
        final Map<String, String> dimMap = new HashMap<>();
        try{
            List<String> profiles = eventStore.getGeniePayLoads(tenant, start, end, queryMap, dimMap, true);
            if (profiles == null || profiles.size() < 1) {
                return getJstackProfileFromRaw(tenant, start, end, queryMap, dimMap);
            }
            final EventHandler aggregator = new EventHandler();
            for (int i=0; i< profiles.size() ; i++) {
                aggregator.aggregateTree((EventHandler.JfrParserResponse) Utils.readValue(profiles.get(i), EventHandler.JfrParserResponse.class));
            }

            if(config.isExperimental()) {
                SurfaceDataResponse res = genSurfaceData(aggregator.getAggregatedProfileTree(), tenant, queryMap.get("host"));
                EventHandler.JfrParserResponse apr = (EventHandler.JfrParserResponse) aggregator.getAggregatedProfileTree();
                apr.addMeta(ImmutableMap.of("data", Utils.toJson(res)));
                final String response = Utils.toJson(apr);
                return response;
            }else{
                final EventHandler.JfrParserResponse res = aggregator.getAggregatedProfileTree();
                int jstackInterval = (int) (end - start) / (profiles.size() * 1000);
                jstackInterval = ((jstackInterval + 5) / 10) * 10; // round to nearest 10sec
                res.addMeta(ImmutableMap.of("jstack-interval", Integer.toString(jstackInterval), "jstack-count", Integer.toString(profiles.size())));
                final String response = Utils.toJson(res);
                logger.info("getJstack response length: " + response.length());
                return response;
            }


            //one by one
            /*
            Map<Long, Map<String, String>> profiles = eventStore.loadProfiles(tenant, start, end, queryMap, dimMap,  false);
            if (profiles == null || profiles.size() < 1) {
                return Utils.toJson(new EventHandler.JfrParserResponse(null, "Jstack events not found", queryMap, null));
            }
            final EventHandler aggregator = new EventHandler();
            List<Long> tosort = new ArrayList<>();
            for (Long timestamp : profiles.keySet()) {
                tosort.add(timestamp);
            }
            Collections.sort(tosort);
            for (int i = 0; i< tosort.size(); i++ ) {
                //long timestamp = Integer.parseInt(profiles.get(guid).get("timestamp"));
                queryMap.put("guid", profiles.get(tosort.get(i)).get("guid"));
                final String json = eventStore.getEvent(tosort.get(i), tosort.get(i), queryMap, dimMap, Integer.parseInt(profiles.get(tosort.get(i)).get("size")), tenant);
                aggregator.aggregateTree((EventHandler.JfrParserResponse) Utils.readValue(json, EventHandler.JfrParserResponse.class));
            }
            final EventHandler.JfrParserResponse res = aggregator.getAggregatedProfileTree();
            int jstackInterval = (int) (end - start) / (profiles.size() * 1000);
            jstackInterval = ((jstackInterval + 5) / 10) * 10; // round to nearest 10sec
            res.addMeta(ImmutableMap.of("jstack-interval", Integer.toString(jstackInterval), "jstack-count", Integer.toString(profiles.size())));
            final String response = Utils.toJson(res);
            logger.info("getJstack response length: " + response.length());
            return response;*/
        }catch (Exception e){
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to aggregate Jstack events " + e.getMessage(), queryMap, null));
        }
    }

    @Override
    public String getOtherEvents(final String tenant, long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) {
            logger.info("getOtherEvents processing " + queryMap);
            try {
                Map<Long, String> otherevents = eventStore.getOtherPayLoads(tenant, start, end, queryMap, dimMap, true);
                boolean parseJstacks = false;
                if (otherevents == null || otherevents.size() < 1) {
                    if (queryMap.get("name").contains("=monitor")) {
                        //try to get monitor context from jstacks
                        parseJstacks = true;
                        queryMap.put("name", "=jstack");
                        queryMap.put("get_raw_jstack_flag", "=true");
                        otherevents = eventStore.getOtherPayLoads(tenant, start, end, queryMap, dimMap, true);
                        if (otherevents == null || otherevents.size() < 1) {
                            logger.info("get raw jstacks without get_raw_jstack_flag response ");
                            queryMap.remove("get_raw_jstack_flag"); //do not trust this flag
                            otherevents = eventStore.getOtherPayLoads(tenant, start, end, queryMap, dimMap, true);
                            if (otherevents == null || otherevents.size() < 1) {
                                logger.info("getOtherEvents done error 1 " + queryMap);
                                return Utils.toJson(new EventHandler.JfrParserResponse(null, "no monitor events found for the given time range", queryMap, null));
                            }
                        }
                        queryMap.put("name", "=monitor");//reset
                    } else {
                        logger.info("getOtherEvents done error 2 " + queryMap);
                        return Utils.toJson(new EventHandler.JfrParserResponse(null, "no events found for the given time range", queryMap, null));
                    }
                }
                final EventHandler aggregator = new EventHandler();
                if (parseJstacks) {
                    aggregator.initializeProfile("Jstack");
                    aggregator.initializePid("Jstack");
                }
                List<Long> keys = new ArrayList<Long>(otherevents.keySet());
                Collections.sort(keys);
                Long prevKey = -1L;
                for (int i = 0; i < keys.size(); i++) {
                    if (queryMap.get("name").contains("=top")) {
                        aggregator.aggregateTop(otherevents.get(keys.get(i)), keys.get(i));
                    } else if (queryMap.get("name").contains("=ps")) {
                        aggregator.aggregatePS(otherevents.get(keys.get(i)), keys.get(i));
                    } else if (queryMap.get("name").contains("=pidstat")) {
                        aggregator.aggregatePIDSTAT(otherevents.get(keys.get(i)), keys.get(i));
                    } else if (queryMap.get("name").contains("=monitor")) {
                        if (keys.get(i) == prevKey) {
                            continue;//avoid processing dup events
                        }
                        prevKey = keys.get(i);
                        if (parseJstacks) {
                            aggregator.processJstackEvent(keys.get(i), otherevents.get(keys.get(i)), true);
                        } else {
                            aggregator.aggregateLogContext((EventHandler.ContextResponse) Utils.readValue(otherevents.get(keys.get(i)), EventHandler.ContextResponse.class));
                        }
                    }
                }
                final EventHandler.ContextResponse res = (EventHandler.ContextResponse) aggregator.getLogContext();
                final String response = Utils.toJson(res);
                logger.info(queryMap.get("name") + " response length: " + response.length());
                logger.info("getOtherEvents done " + queryMap);
                return response;
            } catch (Exception e) {
                logger.info("getOtherEvents done error 3 " + queryMap);
                return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to aggregate events " + e.getMessage(), queryMap, null));
            }
    }

    @Override
    public String getContextEvents(final String tenant, long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException {
        Map<Long, Map<String, String>> profiles;
        if(queryMap.containsKey(PerfGenieConstants.SOURCE_KEY)) {
            profiles = eventStore.loadGenieProfiles(tenant, start, end, queryMap, dimMap, false);
        }else {
            profiles = eventStore.loadGenieProfiles(tenant, start, end, queryMap, dimMap , false);
        }
        if (profiles == null || profiles.size() < 1) {
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "no profiles found for the given time range", queryMap, null));
        }
        try {
            final EventHandler aggregator = new EventHandler();
            List<Long> tosort = new ArrayList<>();
            for (Long timestamp : profiles.keySet()) {
                tosort.add(timestamp);
            }
            Collections.sort(tosort);
            for (int i = 0; i< tosort.size(); i++ ) {
                queryMap.put("guid", profiles.get(tosort.get(i)).get("guid"));
                String result = eventStore.getGenieLargeEvent(tosort.get(i), tosort.get(i), queryMap, dimMap, tenant);
                if(queryMap.containsKey(PerfGenieConstants.SOURCE_KEY)) {
                     aggregator.aggregateLogContext((EventHandler.ContextResponse) Utils.readValue(result, EventHandler.ContextResponse.class));
                }else {
                     aggregator.aggregateSFLogContext((EventHandler.SFContextResponse) Utils.readValue(result, EventHandler.SFContextResponse.class));
                }
            }
            if(queryMap.containsKey(PerfGenieConstants.SOURCE_KEY)) {
                return Utils.toJson(aggregator.getLogContext());
            }else{
                return Utils.toJson(aggregator.getSFLogContext());
            }
        } catch (Exception e) {
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to aggregate" + e.getMessage(), queryMap, null));
        }
    }

    ///////////////////////////////
    //experimental, patents
    private int chunkCount = 0;
    private List<Integer> chunkSamplesTotalList = new ArrayList();
    private List<Double> cpuSamplesList = new ArrayList();
    static double threshold = 0.01;
    private final Map<String, List<String>> surfaceData = new ConcurrentHashMap<String, List<String>>();
    private final List<String> uniquePaths = new ArrayList<String>();
    private final Map<String, Long> uniquePathsSize = new HashMap<>();
    private boolean useTimeSeries = true;
    private long totalSize = 0;
    private Map<String, Integer> chunkSurfaceData = new ConcurrentHashMap<>();

    class SurfaceDataResponse {
        private List cpuSamplesList;
        private List<Integer> chunkSamplesTotalList;
        private List<String> pathList = new ArrayList<String>();
        private List<Long> pathSizeList = new ArrayList<Long>();
        private Map<Integer, List<Integer>> data = new HashMap<>();

        SurfaceDataResponse(List cpuSamplesList, List<Integer> chunkSamplesTotalList, Map<String, List<String>> surfaceData) {
            this.cpuSamplesList = cpuSamplesList;
            this.chunkSamplesTotalList = chunkSamplesTotalList;
            int colIndex = 0;
            int maxCol = chunkCount;
            for (int i = 0; i < uniquePaths.size(); i++) {
                if (surfaceData.containsKey(uniquePaths.get(i)) && surfaceData.get(uniquePaths.get(i)).size() > 0) {
                    List<String> list = surfaceData.get(uniquePaths.get(i));
                    for (int j = 0; j < list.size(); j++) {
                        if (!data.containsKey(colIndex)) {
                            data.put(colIndex, new ArrayList<Integer>());
                        }
                        String[] pair = list.get(j).split(":");
                        if (pair.length > 1) {
                            for (int k = data.get(colIndex).size(); k < Integer.valueOf(pair[1]); k++) {
                                data.get(colIndex).add(0);
                            }
                            data.get(colIndex).add(Integer.valueOf(pair[0]));
                        } else {
                            data.get(colIndex).add(Integer.valueOf(list.get(j)));
                        }
                    }
                    for (int k = data.get(colIndex).size(); k < maxCol; k++) {
                        data.get(colIndex).add(0);
                    }
                    pathList.add(uniquePaths.get(i));
                    pathSizeList.add(uniquePathsSize.get(uniquePaths.get(i)));
                    colIndex++;
                }
            }
        }

        public List getCpuSamplesList() {
            return cpuSamplesList;
        }

        public void setCpuSamplesList(List cpuSamplesList) {
            this.cpuSamplesList = cpuSamplesList;
        }

        public List getChunkSamplesTotalList() {
            return chunkSamplesTotalList;
        }

        public void setChunkSamplesTotalList(List chunkSamplesTotalList) {
            this.chunkSamplesTotalList = chunkSamplesTotalList;
        }

        public List<String> getPathList() {
            return pathList;
        }

        public void setPathList(List<String> pathList) {
            this.pathList = pathList;
        }

        public List<Long> getPathSizeList() {
            return pathSizeList;
        }

        public void setPathSizeList(List<Long> pathSizeList) {
            this.pathSizeList = pathSizeList;
        }

        public Map<Integer, List<Integer>> getData() {
            return data;
        }

        public void setData(Map<Integer, List<Integer>> data) {
            this.data = data;
        }
    }

    public SurfaceDataResponse genSurfaceData(final EventHandler.JfrParserResponse response, final String tenant, String host) throws IOException {
        chunkCount = 0;
        chunkSamplesTotalList.clear();
        cpuSamplesList.clear();
        surfaceData.clear();
        uniquePaths.clear();
        uniquePathsSize.clear();
        totalSize = 0;
        chunkSurfaceData.clear();

        final EventHandler.StackFrame source = (EventHandler.StackFrame) response.getTree();
        totalSize = source.getSz();

        for (int treeIndex = 0; treeIndex < source.getCh().size(); treeIndex++) {
            final List<Integer> tmpList = new ArrayList();
            tmpList.add(treeIndex);
            getAllPaths(source.getCh().get(treeIndex), tmpList);
        }
        long contextStart = ((EventHandler.JfrContext) response.getContext()).getStart() / 1000000;
        long contextEnd = ((EventHandler.JfrContext) response.getContext()).getEnd() / 1000000;
        Map<Integer, List<EventHandler.StackidTime>> tidMap = (ConcurrentHashMap<Integer, List<EventHandler.StackidTime>>) ((EventHandler.JfrContext) response.getContext()).getTidMap();

        long filterStart = contextStart;
        long filterEnd = filterStart + 60000;

        List<timeSeries> ts = getCPUTimeSeries(contextStart, contextEnd, tenant, host);
        if (ts.size() == 0) {
            useTimeSeries = false;
        }
        int startIndex = 0;
        if (useTimeSeries) {
            for (int i = 0; i < ts.size(); i++, startIndex++) {
                if (ts.get(i).epoch > filterStart) {
                    break;
                }
                System.out.println("skip:  " + filterStart + ":" + ts.get(i).epoch);
            }

            filterStart = ts.get(startIndex).epoch;
            filterEnd = ts.get(startIndex + 1).epoch;
        }

        while (filterEnd <= contextEnd) {
            System.out.println(chunkCount + ":" + filterStart + ":" + filterEnd);
            if (useTimeSeries) {
                cpuSamplesList.add(ts.get(startIndex + 1).value);
            }
            HashMap<Integer, Integer> stackMap = new HashMap<>();

            for (Integer tid : tidMap.keySet()) {
                List<EventHandler.StackidTime> list = tidMap.get(tid);
                for (int i = 0; i < list.size(); i++) {
                    if ((list.get(i).getTime() + contextStart) >= filterStart && (list.get(i).getTime() + contextStart) < filterEnd) {
                        if (stackMap.containsKey(list.get(i).getHash())) {
                            stackMap.put(list.get(i).getHash(), stackMap.get(list.get(i).getHash()) + 1);
                        } else {
                            stackMap.put(list.get(i).getHash(), 1);
                        }
                    } else {
                        //break;
                    }
                }
            }
            int chunkSamplesTotal = 0;
            chunkSurfaceData.clear();
            final ExecutorService executorService = Executors.newFixedThreadPool(10);
            for (Integer stackid : stackMap.keySet()) {
                chunkSamplesTotal = chunkSamplesTotal + stackMap.get(stackid);
                executorService.execute(new GetSurfaceData(source, stackid, stackMap.get(stackid)));
            }
            executorService.shutdown();
            try {
                executorService.awaitTermination(600, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                System.out.println(e);
            }
            chunkSamplesTotalList.add(chunkSamplesTotal);

            for (String key : chunkSurfaceData.keySet()) {
                if (surfaceData.containsKey(key)) {
                    surfaceData.get(key).add(Integer.toString(chunkSurfaceData.get(key)) + ":" + Integer.toString(chunkCount));
                } else {
                    surfaceData.put(key, new ArrayList<String>());
                    surfaceData.get(key).add(Integer.toString(chunkSurfaceData.get(key)) + ":" + Integer.toString(chunkCount));
                }
            }

            if (useTimeSeries) {
                startIndex++;
                filterStart = ts.get(startIndex).epoch;
                if (ts.size() - 1 == startIndex) {
                    filterEnd = contextEnd + 1;//end loop
                } else {
                    filterEnd = ts.get(startIndex + 1).epoch;
                }
            } else {
                filterStart = filterEnd;
                filterEnd = filterStart + 60000;
            }
            chunkCount++;
        }
        return new SurfaceDataResponse(cpuSamplesList, chunkSamplesTotalList, surfaceData);
    }

    private void getSurfaceData(final EventHandler.StackFrame tree, int stackid, int size) {
        if (tree.getSm().containsKey(stackid) && tree.getCh() != null && tree.getCh().size() > tree.getSm().get(stackid)) {
            final EventHandler.StackFrame baseJsonTree = tree.getCh().get(tree.getSm().get(stackid));
            if (baseJsonTree.getCh() == null || baseJsonTree.getCh().size() == 0) {
                return;
            } else {
                final List<Integer> tmpList = new ArrayList();
                tmpList.add(tree.getSm().get(stackid));
                addStackSurfaceData(baseJsonTree, tmpList, stackid, size, false);
            }
        }
    }

    class GetSurfaceData implements Runnable {
        final EventHandler.StackFrame tree;
        int stackid;
        int size;

        GetSurfaceData(final EventHandler.StackFrame tree, int stackid, int size) {
            this.tree = tree;
            this.stackid = stackid;
            this.size = size;
        }

        @Override
        public void run() {
            getSurfaceData(tree, stackid, size);
        }
    }

    private boolean addStackSurfaceData(final EventHandler.StackFrame tree, final List<Integer> list, int stackid, int size, boolean flag) {
        if (tree.getCh() == null || tree.getSz() == 0) {
            if (flag && tree.getSm().containsKey(stackid)) {
                if (((tree.getSz() * 100.0) / totalSize) >= threshold) {
                    final StringBuilder builder = new StringBuilder();
                    for (int i = 0; i < list.size(); i++) {
                        if (i == 0) {
                            builder.append(list.get(i));
                        } else {
                            builder.append(":" + list.get(i));
                        }
                    }
                    builder.append(":" + Integer.toString(stackid));
                    final String key = builder.toString();
                    if (chunkSurfaceData.containsKey(key)) {
                        chunkSurfaceData.put(key, chunkSurfaceData.get(key) + size);
                    } else {
                        chunkSurfaceData.put(key, size);
                    }
                }
                return true;
            }
            return false;
        } else {
            boolean res = false;
            for (int treeIndex = 0; treeIndex < tree.getCh().size(); treeIndex++) {
                final List<Integer> tmpList = new ArrayList(list);
                if (tree.getCh() == null || tree.getCh().size() > 1) {
                    tmpList.add(treeIndex);
                }
                if (addStackSurfaceData(tree.getCh().get(treeIndex), tmpList, stackid, size, true) && !res) {
                    res = true;
                }
            }
            if (res && tree.getCh().size() > 1) {
                if (((tree.getSz() * 100.0) / totalSize) >= threshold) {
                    final StringBuilder builder = new StringBuilder();
                    for (int i = 0; i < list.size(); i++) {
                        if (i == 0) {
                            builder.append(list.get(i));
                        } else {
                            builder.append(":" + list.get(i));
                        }
                    }
                    final String key = builder.toString();
                    if (chunkSurfaceData.containsKey(key)) {
                        chunkSurfaceData.put(key, chunkSurfaceData.get(key) + size);
                    } else {
                        chunkSurfaceData.put(key, size);
                    }
                }
            }
            if (flag && tree.getSm().containsKey(stackid)) {
                if (((tree.getSz() * 100.0) / totalSize) >= threshold) {
                    final StringBuilder builder = new StringBuilder();
                    for (int i = 0; i < list.size(); i++) {
                        if (i == 0) {
                            builder.append(list.get(i));
                        } else {
                            builder.append(":" + list.get(i));
                        }
                    }
                    builder.append(":" + Integer.toString(stackid));
                    final String key = builder.toString();
                    if (chunkSurfaceData.containsKey(key)) {
                        chunkSurfaceData.put(key, chunkSurfaceData.get(key) + size);
                    } else {
                        chunkSurfaceData.put(key, size);
                    }
                }
                return true;
            }
            return res;
        }
    }

    public void getAllPaths(final EventHandler.StackFrame baseJsonTree, final List<Integer> list) {
        if (baseJsonTree.getCh() == null) {
            if (baseJsonTree.getSz() > 0) { //do it for all counts
                Map.Entry<Integer, Integer> entry = baseJsonTree.getSm().entrySet().iterator().next();
                final StringBuilder builder = new StringBuilder();
                for (int i = 0; i < list.size(); i++) {
                    if (i == 0) {
                        builder.append(list.get(i));
                    } else {
                        builder.append(":" + list.get(i));
                    }
                }
                final String key = builder.toString();

                for (Integer stackid : baseJsonTree.getSm().keySet()) {
                    String tmpKey = key + ":" + Integer.toString(stackid);
                    uniquePaths.add(tmpKey);
                    uniquePathsSize.put(tmpKey, baseJsonTree.getSz());
                }
            }
        } else if (baseJsonTree.getCh().size() > 1) {
            if (baseJsonTree.getSz() > 0) { //do it for all counts
                final StringBuilder builder = new StringBuilder();
                for (int i = 0; i < list.size(); i++) {
                    if (i == 0) {
                        builder.append(list.get(i));
                    } else {
                        builder.append(":" + list.get(i));
                    }
                }
                final String key = builder.toString();
                uniquePaths.add(key);
                uniquePathsSize.put(key, baseJsonTree.getSz());
            }
        }
        if (baseJsonTree.getCh() != null && baseJsonTree.getCh().size() > 0) {
            for (int treeIndex = 0; treeIndex < baseJsonTree.getCh().size(); treeIndex++) {
                final List<Integer> tmpList = new ArrayList(list);
                if (baseJsonTree.getCh() == null || baseJsonTree.getCh().size() > 1) {
                    tmpList.add(treeIndex);
                }
                getAllPaths(baseJsonTree.getCh().get(treeIndex), tmpList);
            }
        }
    }

    class timeSeries {
        long epoch;
        double value;

        void add(long epoch, double value) {
            this.epoch = epoch;
            this.value = value;
        }

        timeSeries(long epoch, double value) {
            this.epoch = epoch;
            this.value = value;
        }

        timeSeries(String time, double value) {
            try {
                SimpleDateFormat df = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS");
                Date date = df.parse(time);
                this.epoch = date.getTime();//always in UTC
                this.value = value;
            } catch (Exception e) {
                System.out.println(e.getMessage());
            }
        }
    }

    private List<timeSeries> getCPUTimeSeries(long start, long end, String tenant, String host) {
        int columnCount = 0;
        try {
            List<timeSeries> ts = new ArrayList<>();
            for (int i = 0; i < columnCount; i++) {
                ts.add(new timeSeries(0L, 0d));
            }
            return ts;
        } catch (Exception e) {

        }
        return null;
    }

    public static void deleteOldFiles(String folderPath, int days) {
        Path directory = Paths.get(folderPath);
        Instant oneDayAgo = Instant.now().minus(days, ChronoUnit.DAYS);

        try {
            Files.walkFileTree(directory, new SimpleFileVisitor<Path>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    if (attrs.creationTime().toInstant().isBefore(oneDayAgo)) {
                        if(file.toString().contains(".tmp") || file.toString().contains(".json")) {
                            System.out.println("Deleting old file : " + attrs.creationTime() + ":" + file.toString());
                            Files.delete(file);
                        }
                    }
                    return FileVisitResult.CONTINUE;
                }
                @Override
                public FileVisitResult visitFileFailed(Path file, IOException exc) throws IOException {
                    System.err.println("Failed to process file: " + file.toString() + " due to " + exc.getMessage());
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException e) {
            System.err.println("Error: walking through directory: " + e.getMessage());
        }
    }
}