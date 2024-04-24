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
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.SimpleDateFormat;
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
        runJob();
    }

    public void runJob() throws IOException{

        tenant = config.getTenant();
        host = InetAddress.getLocalHost().getHostName();
        logger.info("looking for Jfrs at " + config.getJfrdir());
        File folder = new File(config.getJfrdir());
        File[] listOfFiles = folder.listFiles();
        Arrays.sort(listOfFiles, Comparator.comparingLong(File::lastModified));

        if (listOfFiles == null)
            return;
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
                    handler.processMonitorLog("/tmp/jfrs/monitor.log");
                    Path path = Paths.get("/tmp/jfrs/monitor.log");
                    // deleteIfExists File
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                    final Map<String, Double> dimMap = new HashMap<>();
                    final Map<String, String> queryMap = new HashMap<>();
                    queryMap.put("guid", guid);
                    queryMap.put("tenant", tenant);
                    queryMap.put("host", host);
                    queryMap.put("file-name", file.getName());

                    List<String> l = handler.getProfileList();
                    for (int i = 0; i < l.size(); i++) {
                        Object profile = handler.getProfileTree(config.getFilterDepth(),l.get(i),config.isExperimental());
                        queryMap.put("type", "jfrprofile");
                        queryMap.put("name", l.get(i));
                        final String payload = Utils.toJson(profile);
                        int payloadSize = payload.length();
                        queryMap.put("size", String.valueOf(payloadSize));
                        System.out.println(payloadSize);
                        eventStore.addEvent(timestamp, queryMap, dimMap, payload);
                    }
                    Object logContext = handler.getLogContext();
                    queryMap.put("type", "jfrevent");
                    queryMap.put("name", "customEvent");

                    eventStore.addEvent(timestamp, queryMap, dimMap, Utils.toJson(logContext));
                } catch (Exception e) {
                    System.out.println(e);
                    logger.warn("Exception parsing file 3" + file.getPath() + ":" + e.getStackTrace());
                    e.printStackTrace();
                }
                new File(file.getPath()).delete();
                logger.info("successfully parsed " + file.getPath() + " and stored " + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
            } else if (file.isFile() && file.getName().contains(".jstack")) {
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
                    queryMap.put("tenant", tenant);
                    queryMap.put("host", host);
                    queryMap.put("file-name", file.getName());
                    Object profile = handler.getProfileTree("Jstack");
                    queryMap.put("type", "jstack");
                    queryMap.put("name", "Jstack");
                    eventStore.addEvent(timestamp, queryMap, dimMap, Utils.toJson(profile));
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
    public boolean addEvent(final String payload, final long timestamp, final Map<String, Double> dimMap, final Map<String, String> queryMap) throws IOException {
        return eventStore.addEvent(timestamp, queryMap, dimMap, payload);
    }

    /*@Override
    public String getMeta(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException {
        if(queryMap.containsKey("tenant-id")){
            return eventStore.getMeta(start, end, queryMap, dimMap, queryMap.get("tenant-id"),queryMap.containsKey("instance-id") ? queryMap.get("tenant-id") : null);
        }else {
            return eventStore.getMeta(start, end, queryMap, dimMap, null, queryMap.containsKey("host") ? queryMap.get("host") : null);
        }
    }*/

    @Override
    public String getTenants(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException {
        List<String> namespaces = new ArrayList<>();
        namespaces.add("maiev-tenant-dev");//todo config.properties

        return eventStore.getTenants(start, end, queryMap, dimMap, namespaces);
    }

    @Override
    public String getInstances(long start, long end, final String tenant) throws IOException {
        List<String> namespaces = new ArrayList<>();
        namespaces.add("maiev-tenant-dev");//todo config.properties

        return eventStore.getInstances(tenant, start, end);
    }

    @Override
    public String getMeta(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final String tenant, final String instance) throws IOException {
        return eventStore.getMeta(start, end, queryMap, dimMap, tenant, instance);
    }

    @Override
    public String getProfile(final String tenant, long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) {
        try {
            if(queryMap.containsKey("tenant-id")) {
                return eventStore.getEvent(start, end, queryMap, dimMap, "maiev-large-files-"+tenant);
            }else{
                return eventStore.getEvent(start, end, queryMap, dimMap, null);
            }
        } catch (Exception e) {
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Profiles not found", queryMap, null));
        }
    }

    @Override
    public String getProfiles(final String tenant, long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException {
        Map<String, Map<String, String>> profiles;
        if(queryMap.containsKey("tenant-id")) {
            profiles = eventStore.loadProfiles(tenant, start, end, queryMap, dimMap, "maiev-tenant-"+tenant, false);
        }else {
            queryMap.put("type", "=jfrprofile");
            profiles = eventStore.loadProfiles(tenant, start, end, queryMap, dimMap, null, false);
        }
            if (profiles == null || profiles.size() < 1) {
                return Utils.toJson(new EventHandler.JfrParserResponse(null, "no profiles found for the given time range", queryMap, null));
            }
            try {
                final EventHandler aggregator = new EventHandler();
                for (String guid : profiles.keySet()) {
                    //long timestamp = Integer.parseInt(profiles.get(guid).get("timestamp"));
                    queryMap.put("guid", guid);
                    String result;
                    if(queryMap.containsKey("tenant-id")) {
                        result = eventStore.getEvent(start, end, queryMap, dimMap, "maiev-large-files-"+tenant);
                    }else {
                        result = eventStore.getEvent(start, end, queryMap, dimMap, Integer.parseInt(profiles.get(guid).get("size")));
                    }

                    aggregator.aggregateTree((EventHandler.JfrParserResponse) Utils.readValue(result, EventHandler.JfrParserResponse.class));
                }
                if(config.isExperimental()) {
                    SurfaceDataResponse res = genSurfaceData(aggregator.getAggregatedProfileTree(), tenant, queryMap.get("host"));
                    EventHandler.JfrParserResponse apr = (EventHandler.JfrParserResponse) aggregator.getAggregatedProfileTree();
                    apr.addMeta(ImmutableMap.of("data", Utils.toJson(res)));
                    final String response = Utils.toJson(apr);
                    return response;
                }else{
                    EventHandler.JfrParserResponse apr = (EventHandler.JfrParserResponse) aggregator.getAggregatedProfileTree();
                    return Utils.toJson(apr);
                }


            } catch (Exception e) {
                return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to aggregate" + e.getMessage(), queryMap, null));
            }
    }

    @Override
    public String getJstack(final String tenant, final long start, final long end, final Map<String, String> queryMap) throws IOException {
        final Map<String, String> dimMap = new HashMap<>();
        try {
            if(queryMap.containsKey("tenant-id")) {//sfdc
                List<String> profiles = eventStore.getPayLoads(tenant, start, end, queryMap, dimMap, "maiev-tenant-"+tenant, true);
                if (profiles == null || profiles.size() < 1) {
                    return Utils.toJson(new EventHandler.JfrParserResponse(null, "Jstack events not found", queryMap, null));
                }
                final EventHandler aggregator = new EventHandler();
                for (int i=0; i< profiles.size() ; i++) {
                    aggregator.aggregateTree((EventHandler.JfrParserResponse) Utils.readValue(profiles.get(i), EventHandler.JfrParserResponse.class));
                }
                final EventHandler.JfrParserResponse res = aggregator.getAggregatedProfileTree();
                int jstackInterval = (int) (end - start) / (profiles.size() * 1000);
                jstackInterval = ((jstackInterval + 5) / 10) * 10; // round to nearest 10sec
                res.addMeta(ImmutableMap.of("jstack-interval", Integer.toString(jstackInterval), "jstack-count", Integer.toString(profiles.size())));
                final String response = Utils.toJson(res);
                logger.info("getJstack response length: " + response.length());
                return response;
            }else{
                Map<String, Map<String, String>> profiles = eventStore.loadProfiles(tenant, start, end, queryMap, dimMap, null, false);
                if (profiles == null || profiles.size() < 1) {
                    return Utils.toJson(new EventHandler.JfrParserResponse(null, "Jstack events not found", queryMap, null));
                }
                final EventHandler aggregator = new EventHandler();
                for (String guid : profiles.keySet()) {
                    //long timestamp = Integer.parseInt(profiles.get(guid).get("timestamp"));
                    queryMap.put("guid", guid);
                    final String json = eventStore.getEvent(start, end, queryMap, dimMap, Integer.parseInt(profiles.get(guid).get("size")));
                    aggregator.aggregateTree((EventHandler.JfrParserResponse) Utils.readValue(json, EventHandler.JfrParserResponse.class));
                }
                final EventHandler.JfrParserResponse res = aggregator.getAggregatedProfileTree();
                int jstackInterval = (int) (end - start) / (profiles.size() * 1000);
                jstackInterval = ((jstackInterval + 5) / 10) * 10; // round to nearest 10sec
                res.addMeta(ImmutableMap.of("jstack-interval", Integer.toString(jstackInterval), "jstack-count", Integer.toString(profiles.size())));
                final String response = Utils.toJson(res);
                logger.info("getJstack response length: " + response.length());
                return response;
            }

        } catch (Exception e) {
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to aggregate Jstack events " + e.getMessage(), queryMap, null));
        }
    }

    @Override
    public String getOtherEvents(final String tenant, long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException {
        Map<Long,String> otherevents;
        if(queryMap.containsKey("tenant-id")) {
            queryMap.put("name", queryMap.get("name"));
            otherevents = eventStore.getOtherPayLoads(tenant, start, end, queryMap, dimMap, "maiev-tenant-"+tenant, true);
        }else {
            //queryMap.put("name", "=customEvent");
            //profiles = eventStore.getOtherPayLoads(tenant, start, end, queryMap, dimMap, null,false);
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Not implemented ", queryMap, null));
        }
        if (otherevents == null || otherevents.size() < 1) {
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "no profiles found for the given time range", queryMap, null));
        }
        try {
            final EventHandler aggregator = new EventHandler();
            List<Long> keys = new ArrayList<Long>(otherevents.keySet());
            Collections.sort(keys);

            for (int i=0; i< keys.size(); i++) {
                if(queryMap.get("name").contains("=top")) {
                    aggregator.aggregateTop(otherevents.get(keys.get(i)),keys.get(i));
                }else if(queryMap.get("name").contains("=ps")){
                    aggregator.aggregatePS(otherevents.get(keys.get(i)),keys.get(i));
                }
            }
            final EventHandler.ContextResponse res = (EventHandler.ContextResponse) aggregator.getLogContext();
            final String response = Utils.toJson(res);
            logger.info(queryMap.get("name")+" response length: " + response.length());
            return response;
        } catch (Exception e) {
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to aggregate" + e.getMessage(), queryMap, null));
        }
    }

    @Override
    public String getCustomEvents(final String tenant, long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException {
        Map<String, Map<String, String>> profiles;
        if(queryMap.containsKey("tenant-id")) {
            profiles = eventStore.loadProfiles(tenant, start, end, queryMap, dimMap, "maiev-tenant-"+tenant, false);
        }else {
            queryMap.put("type", "jfrevent");
            queryMap.put("name", "=customEvent");
            profiles = eventStore.loadProfiles(tenant, start, end, queryMap, dimMap, null, false);
        }
        if (profiles == null || profiles.size() < 1) {
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "no profiles found for the given time range", queryMap, null));
        }
        try {
            final EventHandler aggregator = new EventHandler();
            boolean isSF = false;
            for (String guid : profiles.keySet()) {
                //long timestamp = Integer.parseInt(profiles.get(guid).get("timestamp"));
                queryMap.put("guid", guid);
                String result;
                if(queryMap.containsKey("tenant-id")) {
                    result = eventStore.getEvent(start, end, queryMap, dimMap, "maiev-large-files-"+tenant);
                    aggregator.aggregateSFLogContext((EventHandler.SFContextResponse) Utils.readValue(result, EventHandler.SFContextResponse.class));
                    isSF=true;
                }else {
                    result = eventStore.getEvent(start, end, queryMap, dimMap, Integer.parseInt(profiles.get(guid).get("size")));
                    aggregator.aggregateLogContext((EventHandler.ContextResponse) Utils.readValue(result, EventHandler.ContextResponse.class));
                }

            }
            if(isSF) {
                return Utils.toJson(aggregator.getSFLogContext());
            }else{
                return Utils.toJson(aggregator.getLogContext());
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

}