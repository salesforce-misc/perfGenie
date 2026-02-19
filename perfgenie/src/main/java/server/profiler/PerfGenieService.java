/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server.profiler;

import com.google.common.base.Stopwatch;
import com.google.common.collect.ImmutableMap;
import com.salesforce.cantor.Cantor;
import com.salesforce.cantor.grpc.CantorOnGrpc;
import com.salesforce.cantor.h2.CantorOnH2;
import com.salesforce.cantor.mysql.CantorOnMysql;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import perfgenie.ParsePidStat;
import perfgenie.PidStatResponse;
import perfgenie.utils.*;

import java.io.*;
import java.net.InetAddress;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.LoggerFactory;
import javax.annotation.PostConstruct;


public class PerfGenieService implements IPerfGenieService {
    final EventStore eventStore;
    final CustomJfrParser parser;

    private final org.slf4j.Logger logger = LoggerFactory.getLogger(PerfGenieService.class);
    private static String tenant = "dev";
    private static String host = "localhost";
    final Config config;

    //cronjob to parse jfrs placed in a directory
    @Scheduled(cron = "*/10 * * ? * *")
    private void cronJob() throws IOException {
        Utils.createDirectoryIfNotExists(config.getJfrdir());
        runJob();
    }

    @Scheduled(cron = "0 */10 * ? * *")
    private void cleanupJob() throws IOException {
        LocalDateTime now = LocalDateTime.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        logger.info(now.format(formatter) + " running cleanup job for dir " + config.getJfrdir());
        deleteOldFiles(config.getJfrdir(), 15);
    }

    @Scheduled(cron = "0 0 * * * *")
    //@Scheduled(cron = "*/10 * * ? * *")
    private void canaryJob() throws IOException {
        LocalDateTime now = LocalDateTime.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null) {
            logger.info(now.format(formatter) + " running canaryJob");
            //canaryTask(0, 0, null);
        }
    }

    @Scheduled(cron = "0 0 * * * *")
    //@Scheduled(cron = "*/10 * * ? * *")
    private void canaryTaskJob() throws IOException {
        LocalDateTime now = LocalDateTime.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null) {
            logger.info(now.format(formatter) + " running canaryTaskJob");
            //canarySideBySideTask(0, 0,"sidebyside", null);
            canarySideBySideTask(0, 0,"release", "perf-genie-test45");
            //System.exit(0);
        }
    }
    
    private void loadLatestConfigEvent() {
        try {
            long end = System.currentTimeMillis();
            long start = end - (7L * 24 * 59 * 60 * 1000); // 7 days ago
            long fiveDaysAgo = end - (5L * 24 * 60 * 60 * 1000); // 5 days ago

            final Map<String, String> dimMap = new HashMap<>();
            final Map<String, String> queryMap = new HashMap<>();
            queryMap.put("source", "=" + canarySource);
            queryMap.put("tenant-id", "=podconfig");
            queryMap.put("type", "=podconfig");
            queryMap.put("name", "=podconfig");
            queryMap.put("file-name", "=podconfig-update");
            
            Map<Long, String> configEvents = eventStore.getOtherPayLoads(config.getTenant(), start, end, queryMap, dimMap, true);
            
            if (configEvents != null && !configEvents.isEmpty()) {
                // Get the latest event (highest timestamp)
                Long latestTimestamp = configEvents.keySet().stream()
                    .max(Long::compareTo)
                    .orElse(null);
                
                if (latestTimestamp != null) {
                    String configJson = configEvents.get(latestTimestamp);
                    if (configJson != null && !configJson.trim().isEmpty()) {
                        perfgenie.utils.PodConfig latestConfig = (perfgenie.utils.PodConfig) Utils.readValue(configJson, perfgenie.utils.PodConfig.class);
                        if (latestConfig != null && latestConfig.getConfig() != null) {
                            ArgusQueryT.pc = latestConfig;
                            logger.info("Loaded latest PodConfig from event at timestamp: " + latestTimestamp + " (" + 
                                Utils.convertEpochToUTCString(latestTimestamp) + ")");
                            
                            // If the latest event is older than 5 days, save it again to make it fresh
                            if (latestTimestamp < fiveDaysAgo) {
                                try {
                                    String currentConfigJson = Utils.toJson(ArgusQueryT.pc);
                                    addConfigEvent(currentConfigJson);
                                    logger.info("Refreshed PodConfig event (previous event was older than 5 days)");
                                } catch (IOException e) {
                                    logger.warn("Failed to refresh PodConfig event: " + e.getMessage(), e);
                                }
                            }
                        }
                    }
                }
            } else {
                // No config events found - save the current in-memory pc config as an event
                logger.info("No config events found in the last 7 days, saving current in-memory PodConfig as event");
                if (ArgusQueryT.pc != null && ArgusQueryT.pc.getConfig() != null) {
                    try {
                        String currentConfigJson = Utils.toJson(ArgusQueryT.pc);
                        addConfigEvent(currentConfigJson);
                        logger.info("Saved current in-memory PodConfig as event");
                    } catch (IOException e) {
                        logger.warn("Failed to save current PodConfig as event: " + e.getMessage(), e);
                    }
                } else {
                    logger.warn("ArgusQueryT.pc is null or has no config, cannot save as event");
                }
            }
        } catch (Exception e) {
            logger.warn("Failed to load latest config event: " + e.getMessage(), e);
        }
    }

    private static boolean tmpTask = false;//only to catch up last week
    @Scheduled(cron = "0 0 * * * *")
    //@Scheduled(cron = "*/10 * * ? * *")
    private void canaryTaskJobTmp() throws IOException {
        LocalDateTime now = LocalDateTime.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null && tmpTask) {
            tmpTask=false;
            logger.info(now.format(formatter) + " running canaryTaskJobTmp");
            //canarySideBySideTask(0, 0,"sidebyside", null);
            canarySideBySideTask(10, 2,"release", "perf-genie-test45");
            //System.exit(0);
        }
    }


    public void runJob() throws IOException {
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
                    handler.processMonitorLog(config.getJfrdir() + "/monitor.log");
                    Path path = Paths.get(config.getJfrdir() + "/monitor.log");
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
                        Object profile = handler.getProfileTree(config.getFilterDepth(), l.get(i), config.isExperimental());
                        queryMap.put("type", "jfrprofile");
                        queryMap.put("name", "jfr");
                        queryMap.put("file-name", l.get(i));//
                        final String payload = Utils.toJson(profile);
                        int payloadSize = payload.length();
                        queryMap.put("size", String.valueOf(payloadSize));
                        System.out.println(payloadSize);
                        eventStore.addGenieLargeEvent(timestamp, queryMap, dimMap, payload, config.getTenant(), "genie");
                    }
                    Object logContext = handler.getLogContext();
                    queryMap.put("file-name", "jfr-context");//
                    queryMap.put("type", "jfrevent");
                    queryMap.put("name", "jfr");

                    eventStore.addGenieLargeEvent(timestamp, queryMap, dimMap, Utils.toJson(logContext), config.getTenant(), "genie");
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
                    eventStore.addGenieEvent(timestamp, queryMap, dimMap, Utils.toJson(profile), config.getTenant());

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
            } else if (file.isFile() && file.getName().contains(".tar.gz")) {
                String tmpDir = file.getAbsolutePath().replace(".tar.gz", "");
                Utils.createDirectoryIfNotExists(tmpDir);
                Utils.extractTarGzToFolder(file.getAbsolutePath(), tmpDir);
                Files.delete(Paths.get(file.getAbsolutePath()));
                uploadEvents(tmpDir);
                //tmpDir remove directory and files
            }
        }
    }

    private void uploadEvents(final String path) {
        logger.info("uploadEvents from " + path);
        File folder = new File(path);
        File[] listOfFiles = folder.listFiles();

        if (listOfFiles == null)
            return;
        for (File file : listOfFiles) {
            if (file.getName().contains(".meta") || file.getName().contains(".dimension")) {
                logger.info("Skipping event upload for " + file.getName());
            } else if (file.isFile() && file.getName().contains(".json.gz")) {
                //upload large envent
                try {
                    logger.info("uploading large event " + file.getName());
                    String meta = file.getAbsolutePath() + ".meta";
                    byte[] bytes = Files.readAllBytes(Paths.get(meta));
                    String str = new String(bytes);
                    HashMap metaD = (HashMap) Utils.readValue(str, HashMap.class);

                    String dim = file.getAbsolutePath() + ".dimension";
                    byte[] bytes1 = Files.readAllBytes(Paths.get(dim));
                    String str1 = new String(bytes1);
                    final Map<String, Double> dimMap = (HashMap) Utils.readValue(str1, HashMap.class);

                    Pattern pattern = Pattern.compile("(\\d{13})-");
                    Matcher matcher = pattern.matcher(file.getName());
                    if (matcher.find()) {
                        // Extract the first timestamp from the match (the first 13-digit number)
                        String timestampStr = matcher.group(1);
                        long timestampMillis = Long.parseLong(timestampStr);
                        metaD.put("tenant-id", config.getTenant());
                        metaD.put("source", "genie");
                        eventStore.addGenieLargeEvent(timestampMillis, metaD, dimMap, new String(Utils.decompress(Files.readAllBytes(Paths.get(file.getAbsolutePath())))), config.getTenant(), "genie");
                        new File(file.getAbsolutePath()).delete();
                        new File(meta).delete();
                        new File(dim).delete();
                    }
                } catch (IOException e) {
                    logger.warn("uploadEvents exception " + file.getName());
                }
            } else if (file.isFile() && file.getName().contains(".jfr.gz")) {
                logger.warn("Skipping event upload for " + file.getName());
            } else {
                //upload diag event
                try {
                    logger.info("uploading event " + file.getName());
                    String meta = file.getAbsolutePath() + ".meta";
                    byte[] bytes = Files.readAllBytes(Paths.get(meta));
                    String str = new String(bytes);
                    HashMap metaD = (HashMap) Utils.readValue(str, HashMap.class);

                    String dim = file.getAbsolutePath() + ".dimension";
                    byte[] bytes1 = Files.readAllBytes(Paths.get(dim));
                    String str1 = new String(bytes1);
                    final Map<String, Double> dimMap = (HashMap) Utils.readValue(str1, HashMap.class);


                    Pattern pattern = Pattern.compile("(\\d{13})-");


                    Matcher matcher = pattern.matcher(file.getName());
                    if (matcher.find()) {
                        // Extract the first timestamp from the match (the first 13-digit number)
                        String timestampStr = matcher.group(1);
                        long timestampMillis = Long.parseLong(timestampStr);
                        metaD.put("tenant-id", config.getTenant());
                        metaD.put("source", "genie");
                        eventStore.addGenieEvent(timestampMillis, metaD, dimMap, new String(Utils.decompress(Files.readAllBytes(Paths.get(file.getAbsolutePath())))), config.getTenant());
                        new File(file.getAbsolutePath()).delete();
                        new File(meta).delete();
                        new File(dim).delete();
                    }
                } catch (IOException e) {
                    logger.warn("uploadEvents exception " + file.getName());
                    new File(file.getPath()).delete();
                }
            }
        }
    }

    @Autowired
    public PerfGenieService(final EventStore eventStore, final CustomJfrParser parser, final Config config) throws IOException {
        this.eventStore = eventStore;
        this.parser = parser;
        this.config = config;
        WeekOverWeek.setEventStore(eventStore);
    }
    
    @PostConstruct
    public void initialize() {
        // Load latest config event once after application starts
        loadLatestConfigEvent();
    }

    @Override
    public void addGenieLargeEvent(final String payload, final long timestamp, final Map<String, Double> dimMap, final Map<String, String> queryMap, final String tenant) throws IOException {
        eventStore.addGenieLargeEvent(timestamp, queryMap, dimMap, payload, tenant, "genie");
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
    public String getGenieGoldMeta(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException {
        return eventStore.getGenieGoldMeta(start, end, queryMap, dimMap);
    }

    @Override
    public String backupEvents(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final String tenant, final String instance) throws IOException {
        return eventStore.backupEvents(start, end, queryMap, dimMap, tenant, instance);
    }

    @Override
    public boolean downlaodAllEvents(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final String tenant, final String instance, final String fileName) throws IOException {
        return eventStore.downlaodAllEvents(start, end, queryMap, dimMap, tenant, instance, fileName);
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
    public InputStream getGenieEventStream(final String tenant, long timestamp, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException {
        return eventStore.eventStream(timestamp, queryMap, dimMap, tenant);
    }

    /**
     * Detect anomalies and calculate percentage changes for genie dashboard panels
     * @param request Anomaly detection request with panel data
     * @return JSON response with anomaly scores and percentage changes
     */
    public String detectGenieAnomalies(PerfGenieController.AnomalyRequest request) throws IOException {
        long overallStartTime = System.currentTimeMillis();
        logger.info("[Genie Backend Performance] Starting anomaly detection at " + new java.util.Date());
        
        try {
            List<PerfGenieController.PanelData> panels = request.getPanels();
            List<PerfGenieController.PanelData> noncomparepanels = request.getNoncomparepanels();
            PerfGenieController.AnomalyOptions options = request.getOptions();
            
            int maxDataPoints = (options != null && options.getMaxDataPoints() != null) 
                ? options.getMaxDataPoints() : 200;
            boolean enablePatternAnalysis = (options != null && options.getEnablePatternAnalysis() != null)
                ? options.getEnablePatternAnalysis() : false;
            double threshold = (options != null && options.getThreshold() != null)
                ? options.getThreshold() : 1.5;
            
            logger.info("[Genie Backend Performance] Request parameters: maxDataPoints=" + maxDataPoints + 
                ", enablePatternAnalysis=" + enablePatternAnalysis + ", threshold=" + threshold);
            logger.info("[Genie Backend Performance] Input: " + (panels != null ? panels.size() : 0) + 
                " comparable panels, " + (noncomparepanels != null ? noncomparepanels.size() : 0) + " non-comparable panels");
            
            List<Map<String, Object>> comparePanels = new ArrayList<>();
            List<Map<String, Object>> nonComparePanels = new ArrayList<>();
            
            // Process comparable panels (with historical data)
            long comparableStartTime = System.currentTimeMillis();
            if (panels != null && !panels.isEmpty()) {
                logger.info("[Genie Backend Performance] Processing " + panels.size() + " comparable panels");
                for (PerfGenieController.PanelData panelData : panels) {
                    long panelStartTime = System.currentTimeMillis();
                    try {
                        Map<String, Object> panelResult = processPanelForAnomaly(
                            panelData, maxDataPoints, enablePatternAnalysis, threshold);
                        comparePanels.add(panelResult);
                        long panelDuration = System.currentTimeMillis() - panelStartTime;
                        logger.info("[Genie Backend Performance] Processed comparable panel \"" + 
                            (panelData.getPanelTitle() != null ? panelData.getPanelTitle() : panelData.getPanelId()) + 
                            "\" in " + panelDuration + "ms");
                    } catch (Exception e) {
                        long panelDuration = System.currentTimeMillis() - panelStartTime;
                        logger.warn("Error processing comparable panel " + panelData.getPanelId() + " (took " + 
                            panelDuration + "ms): " + e.getMessage());
                        // Add error result to nonComparePanels
                        Map<String, Object> errorResult = new HashMap<>();
                        errorResult.put("panelId", panelData.getPanelId());
                        errorResult.put("error", e.getMessage());
                        nonComparePanels.add(errorResult);
                    }
                }
            }
            long comparableDuration = System.currentTimeMillis() - comparableStartTime;
            logger.info("[Genie Backend Performance] Completed processing comparable panels in " + 
                comparableDuration + "ms (avg: " + (panels != null && !panels.isEmpty() ? 
                (comparableDuration / panels.size()) : 0) + "ms per panel)");
            
            // Process non-comparable panels (without historical data)
            long nonComparableStartTime = System.currentTimeMillis();
            if (noncomparepanels != null && !noncomparepanels.isEmpty()) {
                logger.info("[Genie Backend Performance] Processing " + noncomparepanels.size() + " non-comparable panels");
                for (PerfGenieController.PanelData panelData : noncomparepanels) {
                    long panelStartTime = System.currentTimeMillis();
                    try {
                        // Process for incidents only (no comparison/anomaly scoring)
                        Map<String, Object> panelResult = processPanelForAnomalyNonComparable(
                            panelData, maxDataPoints);
                        nonComparePanels.add(panelResult);
                        long panelDuration = System.currentTimeMillis() - panelStartTime;
                        logger.info("[Genie Backend Performance] Processed non-comparable panel \"" + 
                            (panelData.getPanelTitle() != null ? panelData.getPanelTitle() : panelData.getPanelId()) + 
                            "\" in " + panelDuration + "ms");
                    } catch (Exception e) {
                        long panelDuration = System.currentTimeMillis() - panelStartTime;
                        logger.warn("Error processing non-comparable panel " + panelData.getPanelId() + " (took " + 
                            panelDuration + "ms): " + e.getMessage());
                        // Add error result
                        Map<String, Object> errorResult = new HashMap<>();
                        errorResult.put("panelId", panelData.getPanelId());
                        errorResult.put("error", e.getMessage());
                        nonComparePanels.add(errorResult);
                    }
                }
            }
            long nonComparableDuration = System.currentTimeMillis() - nonComparableStartTime;
            logger.info("[Genie Backend Performance] Completed processing non-comparable panels in " + 
                nonComparableDuration + "ms (avg: " + (noncomparepanels != null && !noncomparepanels.isEmpty() ? 
                (nonComparableDuration / noncomparepanels.size()) : 0) + "ms per panel)");
            
            Map<String, Object> response = new HashMap<>();
            response.put("panels", comparePanels);
            response.put("noncomparepanels", nonComparePanels);
            
            long overallDuration = System.currentTimeMillis() - overallStartTime;
            logger.info("[Genie Backend Performance] ========================================");
            logger.info("[Genie Backend Performance] Anomaly Detection Performance Summary:");
            logger.info("[Genie Backend Performance]   Total Duration: " + overallDuration + "ms");
            logger.info("[Genie Backend Performance]   Comparable Panels: " + comparableDuration + "ms (" + 
                (overallDuration > 0 ? String.format("%.1f", (comparableDuration * 100.0 / overallDuration)) : "0") + "%)");
            logger.info("[Genie Backend Performance]   Non-Comparable Panels: " + nonComparableDuration + "ms (" + 
                (overallDuration > 0 ? String.format("%.1f", (nonComparableDuration * 100.0 / overallDuration)) : "0") + "%)");
            logger.info("[Genie Backend Performance]   Response: " + comparePanels.size() + " comparable, " + 
                nonComparePanels.size() + " non-comparable");
            logger.info("[Genie Backend Performance] ========================================");
            
            return Utils.toJson(response);
        } catch (Exception e) {
            long overallDuration = System.currentTimeMillis() - overallStartTime;
            logger.error("Error in detectGenieAnomalies (took " + overallDuration + "ms): " + e.getMessage(), e);
            throw new IOException("Failed to detect anomalies: " + e.getMessage(), e);
        }
    }
    
    /**
     * Process a single panel for anomaly detection
     */
    private Map<String, Object> processPanelForAnomaly(
            PerfGenieController.PanelData panelData,
            int maxDataPoints,
            boolean enablePatternAnalysis,
            double threshold) {
        
        long methodStartTime = System.currentTimeMillis();
        String panelId = panelData.getPanelId();
        String panelTitle = panelData.getPanelTitle() != null ? panelData.getPanelTitle() : panelId;
        
        Map<String, Object> result = new HashMap<>();
        result.put("panelId", panelId);
        
        // STEP 1: Extract threshold config
        long stepStartTime = System.currentTimeMillis();
        // Detect and store threshold value for incident detection
        // Priority: orange first, then red as fallback
        Double orangeThresholdValue = null;
        Double redThresholdValue = null;
        try {
            Object fieldConfigObj = panelData.getFieldConfig();
            if (fieldConfigObj != null && fieldConfigObj instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> fieldConfig = (Map<String, Object>) fieldConfigObj;
                
                // Try to get thresholds from fieldConfig.defaults.thresholds or fieldConfig.thresholds
                Object thresholdsObj = null;
                if (fieldConfig.containsKey("defaults")) {
                    Object defaultsObj = fieldConfig.get("defaults");
                    if (defaultsObj instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> defaults = (Map<String, Object>) defaultsObj;
                        if (defaults.containsKey("thresholds")) {
                            thresholdsObj = defaults.get("thresholds");
                        }
                    }
                }
                
                // Fallback to direct thresholds in fieldConfig
                if (thresholdsObj == null && fieldConfig.containsKey("thresholds")) {
                    thresholdsObj = fieldConfig.get("thresholds");
                }
                
                // Also check panelData.getThresholds() as fallback
                if (thresholdsObj == null) {
                    thresholdsObj = panelData.getThresholds();
                }
                
                if (thresholdsObj != null && thresholdsObj instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> thresholds = (Map<String, Object>) thresholdsObj;
                    
                    if (thresholds.containsKey("steps")) {
                        Object stepsObj = thresholds.get("steps");
                        if (stepsObj instanceof List) {
                            @SuppressWarnings("unchecked")
                            List<Object> steps = (List<Object>) stepsObj;
                            
                            logger.info("Panel " + panelData.getPanelId() + " (" + panelData.getPanelTitle() + "): Found " + steps.size() + " threshold steps");
                            
                            // First pass: look for orange threshold
                            for (int i = 0; i < steps.size(); i++) {
                                Object stepObj = steps.get(i);
                                if (stepObj instanceof Map) {
                                    @SuppressWarnings("unchecked")
                                    Map<String, Object> step = (Map<String, Object>) stepObj;
                                    
                                    Object colorObj = step.get("color");
                                    if (colorObj != null && "orange".equalsIgnoreCase(colorObj.toString())) {
                                        Object valueObj = step.get("value");
                                        if (valueObj != null) {
                                            try {
                                                if (valueObj instanceof Number) {
                                                    orangeThresholdValue = ((Number) valueObj).doubleValue();
                                                } else {
                                                    orangeThresholdValue = Double.parseDouble(valueObj.toString());
                                                }
                                                logger.info("Panel " + panelData.getPanelId() + " (" + panelData.getPanelTitle() + "): Found orange threshold step[" + i + "] with value: " + orangeThresholdValue);
                                                break; // Use first orange threshold found
                                            } catch (NumberFormatException e) {
                                                logger.warn("Panel " + panelData.getPanelId() + ": Invalid orange threshold value: " + valueObj);
                                            }
                                        }
                                    }
                                }
                            }
                            
                            // Second pass: if orange not found, look for red threshold
                            if (orangeThresholdValue == null) {
                                for (int i = 0; i < steps.size(); i++) {
                                    Object stepObj = steps.get(i);
                                    if (stepObj instanceof Map) {
                                        @SuppressWarnings("unchecked")
                                        Map<String, Object> step = (Map<String, Object>) stepObj;
                                        
                                        Object colorObj = step.get("color");
                                        if (colorObj != null && "red".equalsIgnoreCase(colorObj.toString())) {
                                            Object valueObj = step.get("value");
                                            if (valueObj != null) {
                                                try {
                                                    if (valueObj instanceof Number) {
                                                        redThresholdValue = ((Number) valueObj).doubleValue();
                                                    } else {
                                                        redThresholdValue = Double.parseDouble(valueObj.toString());
                                                    }
                                                    logger.info("Panel " + panelData.getPanelId() + " (" + panelData.getPanelTitle() + "): Found red threshold step[" + i + "] with value: " + redThresholdValue + " (using as fallback since orange not found)");
                                                    break; // Use first red threshold found
                                                } catch (NumberFormatException e) {
                                                    logger.warn("Panel " + panelData.getPanelId() + ": Invalid red threshold value: " + valueObj);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            logger.warn("Error processing panel config thresholds for panel " + panelId + ": " + e.getMessage());
        }
        long stepDuration = System.currentTimeMillis() - stepStartTime;
        logger.debug("[Genie Backend Performance] Panel \"" + panelTitle + "\" - Step 1 (Config): " + stepDuration + "ms");
        
        // STEP 2: Extract series data
        stepStartTime = System.currentTimeMillis();
        // Extract series data from current and historical periods (keep individual kpods)
        Map<String, List<Double>> currentSeriesData = extractSeriesData(panelData.getCurrentData(), maxDataPoints);
        // Keep individual kpods - don't aggregate yet
        
        // Extract historical data with original series structure for grouping-based matching
        Map<String, Map<String, List<Double>>> historicalSeriesData = new HashMap<>();
        Map<String, List<Object>> historicalRawData = new HashMap<>();
        
        if (panelData.getHistoricalData() != null) {
            for (Map.Entry<String, java.util.List<Object>> entry : panelData.getHistoricalData().entrySet()) {
                String duration = entry.getKey();
                List<Object> rawData = entry.getValue();
                historicalRawData.put(duration, rawData);
                Map<String, List<Double>> periodData = extractSeriesData(rawData, maxDataPoints);
                historicalSeriesData.put(duration, periodData);
            }
        }
        stepDuration = System.currentTimeMillis() - stepStartTime;
        logger.debug("[Genie Backend Performance] Panel \"" + panelTitle + "\" - Step 2 (Data Extraction): " + 
            stepDuration + "ms (current: " + currentSeriesData.size() + " series, historical: " + 
            historicalSeriesData.size() + " periods)");
        
        // STEP 3: Calculate percentage changes and anomaly scores
        stepStartTime = System.currentTimeMillis();
        // Calculate percentage changes and anomaly scores for individual kpods
        Map<String, Object> changes = new HashMap<>();
        Map<String, Double> anomalyScores = new HashMap<>(); // Individual kpod scores
        Map<String, Double> aggregatedAnomalyScores = new HashMap<>(); // Aggregated by grouping key
        Map<String, List<String>> kpodGroups = new HashMap<>(); // Group kpods by grouping key: groupingKey -> [seriesName1, seriesName2, ...]
        Map<String, String> kpodToGroupingKey = new HashMap<>(); // Map seriesName -> groupingKey
        double overallAnomalyScore = 0.0;
        
        int seriesCount = 0;
        int slowSeriesCount = 0; // Count series taking > 100ms
        long totalSeriesTime = 0;
        long totalGroupingKeyTime = 0;
        long totalAggregateTime = 0;
        long totalChangeCalcTime = 0;
        long totalAnomalyCalcTime = 0;
        
        // For comparable panels, we match series names directly (no grouping needed)
        // Cache for matched series by name to avoid re-matching
        Map<String, List<Double>> cachedMatchedSeries = new HashMap<>(); // Key: "seriesName:duration"
        
        // Process each current kpod individually
        for (Map.Entry<String, List<Double>> currentEntry : currentSeriesData.entrySet()) {
            long seriesStartTime = System.currentTimeMillis();
            String seriesName = currentEntry.getKey();
            List<Double> currentValues = currentEntry.getValue();
            
            if (currentValues.isEmpty()) {
                continue;
            }
            
            seriesCount++;
            long groupingKeyTime = 0;
            long aggregateTime = 0;
            long changeCalcTime = 0;
            long anomalyCalcTime = 0;
            
            // For comparable panels, use series name directly (no grouping needed)
            // Grouping is only used for non-comparable panels
            String groupingKey = seriesName; // Use series name as the key for comparable panels
            
            // Store mapping from kpod to grouping key (using series name)
            kpodToGroupingKey.put(seriesName, groupingKey);
            
            // Group kpods by grouping key (each series is its own group for comparable panels)
            kpodGroups.computeIfAbsent(groupingKey, k -> new ArrayList<>()).add(seriesName);
            
            // Calculate current average
            double currentAvg = calculateAverage(currentValues);
            
            // Calculate changes for all historical periods using direct series name matching
            long opStartTime = System.currentTimeMillis();
            Map<String, Double> changesByDuration = new HashMap<>();
            double maxAbsChange = 0.0;
            String maxAbsChangeDuration = null;
            
            // For each period, find matching series by name directly
            for (Map.Entry<String, Map<String, List<Double>>> histEntry : historicalSeriesData.entrySet()) {
                String duration = histEntry.getKey();
                Map<String, List<Double>> periodData = histEntry.getValue();
                
                // Use cache if available
                String cacheKey = seriesName + ":" + duration;
                List<Double> previousValues = cachedMatchedSeries.get(cacheKey);
                if (previousValues == null) {
                    previousValues = findMatchingSeries(seriesName, periodData);
                    if (previousValues != null) {
                        cachedMatchedSeries.put(cacheKey, previousValues);
                    }
                }
                
                if (previousValues != null && !previousValues.isEmpty()) {
                    double previousAvg = calculateAverage(previousValues);
                    
                    double percentChange;
                    if (previousAvg != 0) {
                        percentChange = 100.0 * (previousAvg - currentAvg) / previousAvg;
                    } else {
                        percentChange = (currentAvg == 0) ? 0.0 : (currentAvg > 0 ? Double.POSITIVE_INFINITY : Double.NEGATIVE_INFINITY);
                    }
                    
                    changesByDuration.put(duration, percentChange);
                    
                    double absChange = Math.abs(percentChange);
                    if (absChange > maxAbsChange && Double.isFinite(percentChange)) {
                        maxAbsChange = absChange;
                        maxAbsChangeDuration = duration;
                    }
                }
            }
            changeCalcTime = System.currentTimeMillis() - opStartTime;
            totalChangeCalcTime += changeCalcTime;
            if (changeCalcTime > 50) {
                logger.debug("[Genie Backend Performance] Panel \"" + panelTitle + "\" - Series \"" + 
                    seriesName + "\": change calculation took " + changeCalcTime + "ms");
            }
            
            // Store change data if we found matches
            if (maxAbsChangeDuration != null) {
                Map<String, Object> changeData = new HashMap<>();
                changeData.put("change", changesByDuration.get(maxAbsChangeDuration));
                changeData.put("byDuration", changesByDuration);
                changeData.put("maxAbsChangeDuration", maxAbsChangeDuration);
                changes.put(seriesName, changeData);
                
                // Build historical data map for anomaly score calculation using matched series directly
                Map<String, Map<String, List<Double>>> historicalForAnomaly = new HashMap<>();
                for (String duration : historicalSeriesData.keySet()) {
                    String cacheKey = seriesName + ":" + duration;
                    List<Double> matchedValues = cachedMatchedSeries.get(cacheKey);
                    if (matchedValues == null) {
                        Map<String, List<Double>> periodData = historicalSeriesData.get(duration);
                        matchedValues = findMatchingSeries(seriesName, periodData);
                        if (matchedValues != null) {
                            cachedMatchedSeries.put(cacheKey, matchedValues);
                        }
                    }
                    if (matchedValues != null && !matchedValues.isEmpty()) {
                        Map<String, List<Double>> periodMap = new HashMap<>();
                        periodMap.put(seriesName, matchedValues); // Use series name as key
                        historicalForAnomaly.put(duration, periodMap);
                    }
                }
                
                // Calculate anomaly score for this individual series using matched historical data
                opStartTime = System.currentTimeMillis();
                double anomalyScore = calculateAnomalyScore(
                    currentValues, historicalForAnomaly, seriesName, 
                    enablePatternAnalysis, threshold);
                anomalyCalcTime = System.currentTimeMillis() - opStartTime;
                totalAnomalyCalcTime += anomalyCalcTime;
                if (anomalyCalcTime > 50) {
                    logger.debug("[Genie Backend Performance] Panel \"" + panelTitle + "\" - Series \"" + 
                        seriesName + "\": calculateAnomalyScore took " + anomalyCalcTime + "ms");
                }
                anomalyScores.put(seriesName, anomalyScore);
                
                // Also track aggregated score by grouping key (for overall panel score)
                aggregatedAnomalyScores.put(groupingKey, 
                    Math.max(aggregatedAnomalyScores.getOrDefault(groupingKey, 0.0), anomalyScore));
                
                // Update overall anomaly score (use max)
                overallAnomalyScore = Math.max(overallAnomalyScore, anomalyScore);
            }
            
            long seriesDuration = System.currentTimeMillis() - seriesStartTime;
            totalSeriesTime += seriesDuration;
            if (seriesDuration > 100) {
                slowSeriesCount++;
                logger.info("[Genie Backend Performance] Panel \"" + panelTitle + "\" - Series \"" + 
                    seriesName + "\" took " + seriesDuration + "ms (groupingKey: " + groupingKeyTime + 
                    "ms, aggregate: " + aggregateTime + "ms, changeCalc: " + changeCalcTime + 
                    "ms, anomalyCalc: " + anomalyCalcTime + "ms)");
            }
        }
        stepDuration = System.currentTimeMillis() - stepStartTime;
        logger.info("[Genie Backend Performance] Panel \"" + panelTitle + "\" - Step 3 (Change & Anomaly Calc): " + 
            stepDuration + "ms (processed " + seriesCount + " series, " + slowSeriesCount + " slow series >100ms, " +
            "avg per series: " + (seriesCount > 0 ? (totalSeriesTime / seriesCount) : 0) + "ms)");
        if (seriesCount > 0) {
            logger.info("[Genie Backend Performance] Panel \"" + panelTitle + "\" - Step 3 Breakdown: " +
                "buildGroupingKey: " + (totalGroupingKeyTime / seriesCount) + "ms avg (" + 
                String.format("%.1f", (totalGroupingKeyTime * 100.0 / stepDuration)) + "%), " +
                "aggregateHistorical: " + (totalAggregateTime / seriesCount) + "ms avg (" + 
                String.format("%.1f", (totalAggregateTime * 100.0 / stepDuration)) + "%), " +
                "changeCalc: " + (totalChangeCalcTime / seriesCount) + "ms avg (" + 
                String.format("%.1f", (totalChangeCalcTime * 100.0 / stepDuration)) + "%), " +
                "anomalyCalc: " + (totalAnomalyCalcTime / seriesCount) + "ms avg (" + 
                String.format("%.1f", (totalAnomalyCalcTime * 100.0 / stepDuration)) + "%)");
        }
        
        result.put("changes", changes);
        result.put("anomalyScores", anomalyScores); // Individual kpod scores
        result.put("aggregatedAnomalyScores", aggregatedAnomalyScores); // Aggregated by grouping key
        result.put("anomalyScore", overallAnomalyScore);
        result.put("kpodGroups", kpodGroups); // Group kpods by grouping key: {groupingKey: [seriesName1, seriesName2, ...]}
        result.put("kpodToGroupingKey", kpodToGroupingKey); // Map seriesName -> groupingKey
        
        // STEP 4: Detect incidents
        stepStartTime = System.currentTimeMillis();
        // Use red threshold as fallback if orange not found
        Double thresholdValue = orangeThresholdValue != null ? orangeThresholdValue : redThresholdValue;
        
        // Detect incidents if threshold value exists (orange or red)
        if (thresholdValue != null) {
            Map<String, List<Map<String, Object>>> incidents = detectIncidents(
                panelData.getCurrentData(), thresholdValue, maxDataPoints);
            if (!incidents.isEmpty()) {
                result.put("incidents", incidents);
                String thresholdType = orangeThresholdValue != null ? "orange" : "red";
                logger.info("Panel " + panelId + " (" + panelTitle + "): Found incidents for " + incidents.size() + " series using " + thresholdType + " threshold " + thresholdValue);
            }
        }
        stepDuration = System.currentTimeMillis() - stepStartTime;
        if (stepDuration > 0) {
            logger.debug("[Genie Backend Performance] Panel \"" + panelTitle + "\" - Step 4 (Incident Detection): " + stepDuration + "ms");
        }
        
        long methodDuration = System.currentTimeMillis() - methodStartTime;
        logger.debug("[Genie Backend Performance] Panel \"" + panelTitle + "\" - Total method time: " + methodDuration + "ms");
        
        return result;
    }
    
    /**
     * Process a non-comparable panel (no exact matching historical series)
     * Uses prefix-based grouping to compare against aggregated historical baseline
     * Falls back to self-referential analysis if no historical data available
     */
    private Map<String, Object> processPanelForAnomalyNonComparable(
            PerfGenieController.PanelData panelData,
            int maxDataPoints) {
        
        long methodStartTime = System.currentTimeMillis();
        String panelId = panelData.getPanelId();
        String panelTitle = panelData.getPanelTitle() != null ? panelData.getPanelTitle() : panelId;
        
        Map<String, Object> result = new HashMap<>();
        result.put("panelId", panelId);
        
        // STEP 1: Extract threshold config
        long stepStartTime = System.currentTimeMillis();
        // Detect threshold value for incident detection
        // Priority: orange first, then red as fallback
        Double orangeThresholdValue = null;
        Double redThresholdValue = null;
        try {
            Object fieldConfigObj = panelData.getFieldConfig();
            if (fieldConfigObj != null && fieldConfigObj instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> fieldConfig = (Map<String, Object>) fieldConfigObj;
                
                Object thresholdsObj = null;
                if (fieldConfig.containsKey("defaults")) {
                    Object defaultsObj = fieldConfig.get("defaults");
                    if (defaultsObj instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> defaults = (Map<String, Object>) defaultsObj;
                        if (defaults.containsKey("thresholds")) {
                            thresholdsObj = defaults.get("thresholds");
                        }
                    }
                }
                
                if (thresholdsObj == null && fieldConfig.containsKey("thresholds")) {
                    thresholdsObj = fieldConfig.get("thresholds");
                }
                
                if (thresholdsObj == null) {
                    thresholdsObj = panelData.getThresholds();
                }
                
                if (thresholdsObj != null && thresholdsObj instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> thresholds = (Map<String, Object>) thresholdsObj;
                    
                    if (thresholds.containsKey("steps")) {
                        Object stepsObj = thresholds.get("steps");
                        if (stepsObj instanceof List) {
                            @SuppressWarnings("unchecked")
                            List<Object> steps = (List<Object>) stepsObj;
                            
                            // First pass: look for orange threshold
                            for (int i = 0; i < steps.size(); i++) {
                                Object stepObj = steps.get(i);
                                if (stepObj instanceof Map) {
                                    @SuppressWarnings("unchecked")
                                    Map<String, Object> step = (Map<String, Object>) stepObj;
                                    
                                    Object colorObj = step.get("color");
                                    if (colorObj != null && "orange".equalsIgnoreCase(colorObj.toString())) {
                                        Object valueObj = step.get("value");
                                        if (valueObj != null) {
                                            try {
                                                if (valueObj instanceof Number) {
                                                    orangeThresholdValue = ((Number) valueObj).doubleValue();
                                                } else {
                                                    orangeThresholdValue = Double.parseDouble(valueObj.toString());
                                                }
                                                break;
                                            } catch (NumberFormatException e) {
                                                logger.warn("Panel " + panelData.getPanelId() + ": Invalid orange threshold value: " + valueObj);
                                            }
                                        }
                                    }
                                }
                            }
                            
                            // Second pass: if orange not found, look for red threshold
                            if (orangeThresholdValue == null) {
                                for (int i = 0; i < steps.size(); i++) {
                                    Object stepObj = steps.get(i);
                                    if (stepObj instanceof Map) {
                                        @SuppressWarnings("unchecked")
                                        Map<String, Object> step = (Map<String, Object>) stepObj;
                                        
                                        Object colorObj = step.get("color");
                                        if (colorObj != null && "red".equalsIgnoreCase(colorObj.toString())) {
                                            Object valueObj = step.get("value");
                                            if (valueObj != null) {
                                                try {
                                                    if (valueObj instanceof Number) {
                                                        redThresholdValue = ((Number) valueObj).doubleValue();
                                                    } else {
                                                        redThresholdValue = Double.parseDouble(valueObj.toString());
                                                    }
                                                    logger.info("Panel " + panelData.getPanelId() + " (" + panelTitle + "): Found red threshold step[" + i + "] with value: " + redThresholdValue + " (using as fallback since orange not found)");
                                                    break; // Use first red threshold found
                                                } catch (NumberFormatException e) {
                                                    logger.warn("Panel " + panelData.getPanelId() + ": Invalid red threshold value: " + valueObj);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            logger.warn("Error processing panel config thresholds for panel " + panelId + ": " + e.getMessage());
        }
        long stepDuration = System.currentTimeMillis() - stepStartTime;
        logger.debug("[Genie Backend Performance] Panel \"" + panelTitle + "\" (non-comparable) - Step 1 (Config): " + stepDuration + "ms");
        
        // STEP 2: Extract series data
        stepStartTime = System.currentTimeMillis();
        // Extract current series data (keep individual kpods)
        Map<String, List<Double>> currentSeriesData = extractSeriesData(panelData.getCurrentData(), maxDataPoints);
        
        // Extract historical data if available (for aggregated baseline comparison)
        Map<String, Map<String, List<Double>>> historicalSeriesData = new HashMap<>();
        Map<String, List<Object>> historicalRawData = new HashMap<>();
        boolean hasHistoricalData = false;
        
        if (panelData.getHistoricalData() != null && !panelData.getHistoricalData().isEmpty()) {
            hasHistoricalData = true;
            for (Map.Entry<String, java.util.List<Object>> entry : panelData.getHistoricalData().entrySet()) {
                String duration = entry.getKey();
                List<Object> rawData = entry.getValue();
                if (rawData != null && !rawData.isEmpty()) {
                    historicalRawData.put(duration, rawData);
                    Map<String, List<Double>> periodData = extractSeriesData(rawData, maxDataPoints);
                    historicalSeriesData.put(duration, periodData);
                }
            }
        }
        
        // Combine current and historical data for longest common prefix calculation
        List<Object> allDataForGrouping = new ArrayList<>();
        if (panelData.getCurrentData() != null) {
            allDataForGrouping.addAll(panelData.getCurrentData());
        }
        if (hasHistoricalData && panelData.getHistoricalData() != null) {
            for (List<Object> historicalPeriodData : panelData.getHistoricalData().values()) {
                if (historicalPeriodData != null) {
                    allDataForGrouping.addAll(historicalPeriodData);
                }
            }
        }
        stepDuration = System.currentTimeMillis() - stepStartTime;
        logger.debug("[Genie Backend Performance] Panel \"" + panelTitle + "\" (non-comparable) - Step 2 (Data Extraction): " + 
            stepDuration + "ms (current: " + currentSeriesData.size() + " series, historical: " + 
            (hasHistoricalData ? historicalSeriesData.size() : 0) + " periods)");
        
        // STEP 3: Calculate anomaly scores with grouping
        stepStartTime = System.currentTimeMillis();
        // Calculate individual kpod anomaly scores
        Map<String, Double> anomalyScores = new HashMap<>();
        Map<String, List<String>> kpodGroups = new HashMap<>(); // Group kpods by grouping key
        Map<String, String> kpodToGroupingKey = new HashMap<>(); // Map seriesName -> groupingKey
        double overallAnomalyScore = 0.0;
        double threshold = 1.5; // Default threshold for anomaly detection
        boolean enablePatternAnalysis = false; // Can be enabled via options if needed
        
        for (Map.Entry<String, List<Double>> currentEntry : currentSeriesData.entrySet()) {
            String seriesName = currentEntry.getKey();
            List<Double> currentValues = currentEntry.getValue();
            
            if (currentValues.isEmpty()) {
                continue;
            }
            
            // Build grouping key for this series using all data (current + historical) for longest common prefix
            String groupingKey = buildGroupingKey(seriesName, allDataForGrouping.isEmpty() ? 
                panelData.getCurrentData() : allDataForGrouping);
            
            // Debug: Log grouping key generation for first few series
            if (anomalyScores.size() < 3) {
                logger.info("Panel " + panelData.getPanelId() + ": Series \"" + seriesName + 
                    "\" -> grouping key: \"" + groupingKey + "\" (allDataForGrouping size: " + 
                    (allDataForGrouping != null ? allDataForGrouping.size() : 0) + ")");
            }
            
            // Store mapping from kpod to grouping key
            kpodToGroupingKey.put(seriesName, groupingKey);
            
            // Group kpods by grouping key
            kpodGroups.computeIfAbsent(groupingKey, k -> new ArrayList<>()).add(seriesName);
            
            double anomalyScore = 0.0;
            
            // Try to use aggregated historical baseline if available
            if (hasHistoricalData) {
                // Aggregate historical data by grouping key across all periods
                // Pass allDataForGrouping to ensure consistent grouping key building
                List<Double> aggregatedHistoricalValues = aggregateHistoricalDataByGroupingKey(
                    groupingKey, historicalSeriesData, historicalRawData, panelData.getHistoricalData(), allDataForGrouping);
                
                if (aggregatedHistoricalValues != null && !aggregatedHistoricalValues.isEmpty()) {
                    // Build historical data map for anomaly score calculation
                    Map<String, Map<String, List<Double>>> historicalForAnomaly = new HashMap<>();
                    for (String duration : historicalSeriesData.keySet()) {
                        List<Double> periodValues = aggregateHistoricalDataByGroupingKeyForPeriod(
                            groupingKey, duration, historicalSeriesData, historicalRawData, panelData.getHistoricalData(), allDataForGrouping);
                        if (periodValues != null && !periodValues.isEmpty()) {
                            Map<String, List<Double>> periodMap = new HashMap<>();
                            periodMap.put(groupingKey, periodValues);
                            historicalForAnomaly.put(duration, periodMap);
                        }
                    }
                    
                    // Calculate anomaly score using aggregated baseline
                    // IMPORTANT: Pass groupingKey as seriesName so calculateAnomalyScore can look it up correctly
                    
                    // Log statistics about current and historical data (INFO level for visibility)
                    double currentMin = currentValues.stream().filter(v -> v != null && Double.isFinite(v)).mapToDouble(Double::doubleValue).min().orElse(0.0);
                    double currentMax = currentValues.stream().filter(v -> v != null && Double.isFinite(v)).mapToDouble(Double::doubleValue).max().orElse(0.0);
                    double currentMedian = calculateMedian(currentValues);
                    long currentSpikes = currentValues.stream().filter(v -> v != null && Double.isFinite(v) && v > 1.5).count();
                    
                    double histMin = aggregatedHistoricalValues.stream().filter(v -> v != null && Double.isFinite(v)).mapToDouble(Double::doubleValue).min().orElse(0.0);
                    double histMax = aggregatedHistoricalValues.stream().filter(v -> v != null && Double.isFinite(v)).mapToDouble(Double::doubleValue).max().orElse(0.0);
                    double histMedian = calculateMedian(aggregatedHistoricalValues);
                    long histSpikes = aggregatedHistoricalValues.stream().filter(v -> v != null && Double.isFinite(v) && v > 1.5).count();
                    
                    // Log first few series at INFO level to see what's happening
                    if (anomalyScores.size() < 3) {
                        logger.info("Panel " + panelData.getPanelId() + ": Series \"" + seriesName + "\" data stats - " +
                            "Current: min=" + currentMin + ", max=" + currentMax + ", median=" + currentMedian + 
                            ", spikes(>1.5)=" + currentSpikes + "/" + currentValues.size() + 
                            " | Historical: min=" + histMin + ", max=" + histMax + ", median=" + histMedian +
                            ", spikes(>1.5)=" + histSpikes + "/" + aggregatedHistoricalValues.size());
                    }
                    
                    anomalyScore = calculateAnomalyScore(
                        currentValues, historicalForAnomaly, groupingKey, 
                        enablePatternAnalysis, threshold);
                    
                    logger.info("Panel " + panelData.getPanelId() + ": Non-comparable series \"" + seriesName + 
                        "\" (grouping key: \"" + groupingKey + "\") compared against aggregated historical baseline: " + 
                        aggregatedHistoricalValues.size() + " values, anomaly score: " + anomalyScore);
                } else {
                    // No matching historical data for this grouping key, fall back to self-referential analysis
                    logger.warn("Panel " + panelData.getPanelId() + ": No historical data found for grouping key \"" + 
                        groupingKey + "\" (current series: \"" + seriesName + "\"), using self-referential analysis. " +
                        "Historical periods available: " + (historicalSeriesData != null ? historicalSeriesData.keySet() : "null") +
                        ", Historical raw data available: " + (historicalRawData != null ? historicalRawData.keySet() : "null"));
                    anomalyScore = calculateSelfReferentialAnomalyScore(currentValues);
                }
            } else {
                // No historical data at all, use self-referential analysis
                anomalyScore = calculateSelfReferentialAnomalyScore(currentValues);
            }
            
            anomalyScores.put(seriesName, anomalyScore);
            overallAnomalyScore = Math.max(overallAnomalyScore, anomalyScore);
        }
        stepDuration = System.currentTimeMillis() - stepStartTime;
        logger.debug("[Genie Backend Performance] Panel \"" + panelTitle + "\" (non-comparable) - Step 3 (Anomaly Calc): " + 
            stepDuration + "ms (processed " + currentSeriesData.size() + " series)");
        
        result.put("anomalyScores", anomalyScores);
        result.put("anomalyScore", overallAnomalyScore);
        result.put("kpodGroups", kpodGroups); // Group kpods by grouping key
        result.put("kpodToGroupingKey", kpodToGroupingKey); // Map seriesName -> groupingKey
        
        // STEP 4: Detect incidents
        stepStartTime = System.currentTimeMillis();
        // Use red threshold as fallback if orange not found
        Double thresholdValue = orangeThresholdValue != null ? orangeThresholdValue : redThresholdValue;
        
        // Detect incidents if threshold value exists (orange or red)
        if (thresholdValue != null) {
            Map<String, List<Map<String, Object>>> incidents = detectIncidents(
                panelData.getCurrentData(), thresholdValue, maxDataPoints);
            if (!incidents.isEmpty()) {
                result.put("incidents", incidents);
                String thresholdType = orangeThresholdValue != null ? "orange" : "red";
                logger.info("Panel " + panelId + " (" + panelTitle + "): Found incidents for " + incidents.size() + " series using " + thresholdType + " threshold " + thresholdValue);
            }
        }
        stepDuration = System.currentTimeMillis() - stepStartTime;
        if (stepDuration > 0) {
            logger.debug("[Genie Backend Performance] Panel \"" + panelTitle + "\" (non-comparable) - Step 4 (Incident Detection): " + stepDuration + "ms");
        }
        
        long methodDuration = System.currentTimeMillis() - methodStartTime;
        logger.debug("[Genie Backend Performance] Panel \"" + panelTitle + "\" (non-comparable) - Total method time: " + methodDuration + "ms");
        
        return result;
    }
    
    /**
     * Calculate self-referential anomaly score based on current data only
     * Used as fallback when no historical baseline is available
     */
    private double calculateSelfReferentialAnomalyScore(List<Double> currentValues) {
        if (currentValues == null || currentValues.isEmpty()) {
            return 0.0;
        }
        
        double currentMedian = calculateMedian(currentValues);
        double currentIQR = calculateIQR(currentValues);
        
        // Simple anomaly score: how far is median from expected range
        double simpleAnomalyScore = 0.0;
        if (currentIQR > 0) {
            // Check if median is outside normal range (beyond 2x IQR from Q1/Q3)
            List<Double> sorted = new ArrayList<>(currentValues);
            Collections.sort(sorted);
            int q1Index = sorted.size() / 4;
            int q3Index = (3 * sorted.size()) / 4;
            double q1 = sorted.get(q1Index);
            double q3 = sorted.get(q3Index);
            
            // Calculate deviation from expected range
            double expectedRange = q3 - q1;
            if (expectedRange > 0) {
                double deviation = Math.abs(currentMedian - (q1 + q3) / 2.0);
                simpleAnomalyScore = Math.min(deviation / expectedRange, 1.0);
            }
        }
        
        return simpleAnomalyScore;
    }
    
    /**
     * Detect incidents in time series data
     * An incident is defined as 5 consecutive data points 
     * where the threshold is exceeded at least 3 times
     * Overlapping incident windows are merged
     */
    @SuppressWarnings("unchecked")
    private Map<String, List<Map<String, Object>>> detectIncidents(
            List<Object> dataArray, double threshold, int maxDataPoints) {
        
        Map<String, List<Map<String, Object>>> allIncidents = new HashMap<>();
        
        if (dataArray == null || dataArray.isEmpty()) {
            return allIncidents;
        }
        
        for (Object item : dataArray) {
            if (item instanceof Map) {
                Map<String, Object> series = (Map<String, Object>) item;
                
                // Get series name
                String seriesName = getSeriesName(series);
                if (seriesName == null) {
                    continue;
                }
                
                // Extract values and timestamps
                List<DataPoint> dataPoints = extractDataPointsWithTimestamps(series, maxDataPoints);
                if (dataPoints.size() < 5) {
                    continue; // Need at least 5 points for a 5-minute window
                }
                
                // Detect incidents for this series
                List<Map<String, Object>> incidents = detectIncidentsInSeries(dataPoints, threshold);
                if (!incidents.isEmpty()) {
                    allIncidents.put(seriesName, incidents);
                }
            }
        }
        
        return allIncidents;
    }
    
    /**
     * Data point with timestamp and value
     */
    private static class DataPoint {
        long timestamp;
        double value;
        
        DataPoint(long timestamp, double value) {
            this.timestamp = timestamp;
            this.value = value;
        }
    }
    
    /**
     * Extract data points with timestamps from series object
     */
    @SuppressWarnings("unchecked")
    private List<DataPoint> extractDataPointsWithTimestamps(Map<String, Object> series, int maxDataPoints) {
        List<DataPoint> dataPoints = new ArrayList<>();
        
        // Format 1: datapoints as object {timestamp: value}
        if (series.containsKey("datapoints") && series.get("datapoints") instanceof Map) {
            Map<String, Object> datapoints = (Map<String, Object>) series.get("datapoints");
            for (Map.Entry<String, Object> entry : datapoints.entrySet()) {
                try {
                    long timestamp = Long.parseLong(entry.getKey());
                    Object valueObj = entry.getValue();
                    if (valueObj instanceof Number) {
                        double value = ((Number) valueObj).doubleValue();
                        dataPoints.add(new DataPoint(timestamp, value));
                    }
                } catch (NumberFormatException e) {
                    // Skip invalid timestamp
                }
            }
        }
        // Format 2: datapoints as array [[value, timestamp], ...]
        else if (series.containsKey("datapoints") && series.get("datapoints") instanceof List) {
            List<Object> datapoints = (List<Object>) series.get("datapoints");
            for (Object point : datapoints) {
                if (point instanceof List && ((List<?>) point).size() >= 2) {
                    Object valueObj = ((List<?>) point).get(0);
                    Object timestampObj = ((List<?>) point).get(1);
                    if (valueObj instanceof Number && timestampObj instanceof Number) {
                        long timestamp = ((Number) timestampObj).longValue();
                        double value = ((Number) valueObj).doubleValue();
                        dataPoints.add(new DataPoint(timestamp, value));
                    }
                }
            }
        }
        // Format 3: separate times and values arrays
        else if (series.containsKey("values") && series.get("values") instanceof List &&
                 series.containsKey("times") && series.get("times") instanceof List) {
            List<Object> values = (List<Object>) series.get("values");
            List<Object> times = (List<Object>) series.get("times");
            int minSize = Math.min(values.size(), times.size());
            for (int i = 0; i < minSize; i++) {
                Object valueObj = values.get(i);
                Object timeObj = times.get(i);
                if (valueObj instanceof Number && timeObj instanceof Number) {
                    long timestamp = ((Number) timeObj).longValue();
                    double value = ((Number) valueObj).doubleValue();
                    dataPoints.add(new DataPoint(timestamp, value));
                }
            }
        }
        
        // Sort by timestamp
        dataPoints.sort((a, b) -> Long.compare(a.timestamp, b.timestamp));
        
        // Sample if too many points
        if (dataPoints.size() > maxDataPoints) {
            int step = dataPoints.size() / maxDataPoints;
            List<DataPoint> sampled = new ArrayList<>();
            for (int i = 0; i < dataPoints.size(); i += step) {
                sampled.add(dataPoints.get(i));
            }
            return sampled;
        }
        
        return dataPoints;
    }
    
    /**
     * Detect incidents in a single series
     * Returns list of incident windows, each with startTimestamp, endTimestamp, and count
     */
    private List<Map<String, Object>> detectIncidentsInSeries(List<DataPoint> dataPoints, double threshold) {
        List<Map<String, Object>> incidents = new ArrayList<>();
        
        if (dataPoints.size() < 5) {
            return incidents;
        }
        
        // Find all 5-point windows that exceed threshold at least 3 times
        List<int[]> incidentRanges = new ArrayList<>();
        
        for (int i = 0; i <= dataPoints.size() - 5; i++) {
            int exceedCount = 0;
            for (int j = i; j < i + 5 && j < dataPoints.size(); j++) {
                if (dataPoints.get(j).value > threshold) {
                    exceedCount++;
                }
            }
            
            // If threshold exceeded 3+ times in this 5-point window, mark as incident
            if (exceedCount >= 3) {
                incidentRanges.add(new int[]{i, i + 4});
            }
        }
        
        // Merge overlapping incident windows
        if (!incidentRanges.isEmpty()) {
            List<int[]> mergedRanges = mergeOverlappingRanges(incidentRanges);
            
            // Convert to incident objects with timestamps
            for (int[] range : mergedRanges) {
                int originalStartIdx = range[0];
                int originalEndIdx = Math.min(range[1], dataPoints.size() - 1);
                
                // Trim start: find first index where value > threshold
                int trimmedStartIdx = originalStartIdx;
                for (int i = originalStartIdx; i <= originalEndIdx; i++) {
                    if (dataPoints.get(i).value > threshold) {
                        trimmedStartIdx = i;
                        break;
                    }
                }
                
                // Trim end: find last index where value > threshold
                int trimmedEndIdx = originalEndIdx;
                for (int i = originalEndIdx; i >= trimmedStartIdx; i--) {
                    if (dataPoints.get(i).value > threshold) {
                        trimmedEndIdx = i;
                        break;
                    }
                }
                
                // Only create incident if we have valid trimmed range
                if (trimmedStartIdx <= trimmedEndIdx) {
                    Map<String, Object> incident = new HashMap<>();
                    incident.put("startTimestamp", dataPoints.get(trimmedStartIdx).timestamp);
                    incident.put("endTimestamp", dataPoints.get(trimmedEndIdx).timestamp);
                    incident.put("startIndex", trimmedStartIdx);
                    incident.put("endIndex", trimmedEndIdx);
                    incident.put("dataPointCount", trimmedEndIdx - trimmedStartIdx + 1);
                    
                    // Count how many points exceed threshold in this trimmed incident window
                    int exceedCount = 0;
                    for (int i = trimmedStartIdx; i <= trimmedEndIdx; i++) {
                        if (dataPoints.get(i).value > threshold) {
                            exceedCount++;
                        }
                    }
                    incident.put("exceedCount", exceedCount);
                    
                    incidents.add(incident);
                }
            }
        }
        
        return incidents;
    }
    
    /**
     * Merge overlapping ranges
     */
    private List<int[]> mergeOverlappingRanges(List<int[]> ranges) {
        if (ranges.isEmpty()) {
            return ranges;
        }
        
        // Sort by start index
        ranges.sort((a, b) -> Integer.compare(a[0], b[0]));
        
        List<int[]> merged = new ArrayList<>();
        int[] current = ranges.get(0);
        
        for (int i = 1; i < ranges.size(); i++) {
            int[] next = ranges.get(i);
            
            // If overlapping or adjacent (end + 1 >= start), merge
            if (current[1] >= next[0] - 1) {
                current[1] = Math.max(current[1], next[1]);
            } else {
                merged.add(current);
                current = next;
            }
        }
        merged.add(current);
        
        return merged;
    }
    
    /**
     * Extract series data from panel data array
     */
    @SuppressWarnings("unchecked")
    private Map<String, List<Double>> extractSeriesData(List<Object> dataArray, int maxDataPoints) {
        Map<String, List<Double>> seriesData = new HashMap<>();
        
        if (dataArray == null || dataArray.isEmpty()) {
            return seriesData;
        }
        
        for (Object item : dataArray) {
            if (item instanceof Map) {
                Map<String, Object> series = (Map<String, Object>) item;
                
                // Get series name
                String seriesName = getSeriesName(series);
                if (seriesName == null) {
                    continue;
                }
                
                // Extract values
                List<Double> values = extractValues(series, maxDataPoints);
                if (!values.isEmpty()) {
                    seriesData.put(seriesName, values);
                }
            }
        }
        
        return seriesData;
    }
    
    /**
     * Get series name from series object
     */
    @SuppressWarnings("unchecked")
    private String getSeriesName(Map<String, Object> series) {
        if (series.containsKey("displayName")) {
            return (String) series.get("displayName");
        }
        // Build from scope:metric:tags if available
        StringBuilder name = new StringBuilder();
        if (series.containsKey("scope")) {
            name.append(series.get("scope"));
        }
        if (series.containsKey("metric")) {
            if (name.length() > 0) name.append(":");
            name.append(series.get("metric"));
        }
        if (series.containsKey("tags") && series.get("tags") instanceof Map) {
            Map<String, Object> tags = (Map<String, Object>) series.get("tags");
            if (!tags.isEmpty()) {
                if (name.length() > 0) name.append(":");
                name.append(tags.toString());
            }
        }
        return name.length() > 0 ? name.toString() : null;
    }
    
    /**
     * Extract values from series object (handles multiple formats)
     */
    @SuppressWarnings("unchecked")
    private List<Double> extractValues(Map<String, Object> series, int maxDataPoints) {
        List<Double> values = new ArrayList<>();
        
        // Format 1: datapoints as object {timestamp: value}
        if (series.containsKey("datapoints") && series.get("datapoints") instanceof Map) {
            Map<String, Object> datapoints = (Map<String, Object>) series.get("datapoints");
            for (Object value : datapoints.values()) {
                if (value instanceof Number) {
                    values.add(((Number) value).doubleValue());
                }
            }
        }
        // Format 2: datapoints as array [[value, timestamp], ...]
        else if (series.containsKey("datapoints") && series.get("datapoints") instanceof List) {
            List<Object> datapoints = (List<Object>) series.get("datapoints");
            for (Object point : datapoints) {
                if (point instanceof List && ((List<?>) point).size() >= 1) {
                    Object value = ((List<?>) point).get(0);
                    if (value instanceof Number) {
                        values.add(((Number) value).doubleValue());
                    }
                }
            }
        }
        // Format 3: separate times and values arrays
        else if (series.containsKey("values") && series.get("values") instanceof List) {
            List<Object> valueList = (List<Object>) series.get("values");
            for (Object value : valueList) {
                if (value instanceof Number) {
                    values.add(((Number) value).doubleValue());
                }
            }
        }
        
        // Sample if too many points
        if (values.size() > maxDataPoints) {
            int step = values.size() / maxDataPoints;
            List<Double> sampled = new ArrayList<>();
            for (int i = 0; i < values.size(); i += step) {
                sampled.add(values.get(i));
            }
            return sampled;
        }
        
        return values;
    }
    
    /**
     * Find matching series in historical data (handles name variations)
     */
    private List<Double> findMatchingSeries(String seriesName, Map<String, List<Double>> periodData) {
        // Try exact match first
        if (periodData.containsKey(seriesName)) {
            return periodData.get(seriesName);
        }
        
        // Extract metric name (part after last colon, or the whole name if no colon)
        String metricName = extractMetricName(seriesName);
        if (metricName == null) {
            return null;
        }
        
        // Try matching by metric name (e.g., "containerCpu" matches "pod1:containerCpu" and "pod2:containerCpu")
        for (Map.Entry<String, List<Double>> entry : periodData.entrySet()) {
            String histName = entry.getKey();
            String histMetricName = extractMetricName(histName);
            if (metricName.equals(histMetricName)) {
                return entry.getValue();
            }
        }
        
        // Try matching by name before colon (e.g., "Series Name" matches "Series Name:metric")
        int colonIndex = seriesName.lastIndexOf(':');
        if (colonIndex >= 0) {
            String nameBeforeColon = seriesName.substring(0, colonIndex);
            for (Map.Entry<String, List<Double>> entry : periodData.entrySet()) {
                String histName = entry.getKey();
                int histColonIndex = histName.lastIndexOf(':');
                if (histColonIndex >= 0 && histName.substring(0, histColonIndex).equals(nameBeforeColon)) {
                    return entry.getValue();
                }
            }
        } else {
            // Current has no colon, try matching against names before colon in historical
            for (Map.Entry<String, List<Double>> entry : periodData.entrySet()) {
                String histName = entry.getKey();
                int histColonIndex = histName.lastIndexOf(':');
                if (histColonIndex >= 0 && histName.substring(0, histColonIndex).equals(seriesName)) {
                    return entry.getValue();
                }
            }
        }
        
        return null;
    }
    
    /**
     * Extract metric name from series name
     * Examples:
     *   "pod-name:containerCpu" -> "containerCpu"
     *   "scope:metric:tags" -> "metric" (if tags present) or "metric" (if no tags)
     *   "Wall Clock Time" -> "Wall Clock Time"
     */
    private String extractMetricName(String seriesName) {
        if (seriesName == null || seriesName.isEmpty()) {
            return null;
        }
        
        // Check if it contains tags (has {})
        int braceIndex = seriesName.indexOf('{');
        if (braceIndex >= 0) {
            // Has tags, metric is the part between last colon before { and the {
            String beforeBrace = seriesName.substring(0, braceIndex);
            int colonIndex = beforeBrace.lastIndexOf(':');
            if (colonIndex >= 0) {
                return beforeBrace.substring(colonIndex + 1).trim();
            }
            return beforeBrace.trim();
        }
        
        // No tags, check for colon
        int colonIndex = seriesName.lastIndexOf(':');
        if (colonIndex >= 0) {
            // Metric is the part after the last colon
            return seriesName.substring(colonIndex + 1).trim();
        }
        
        // No colon, return the whole name
        return seriesName.trim();
    }
    
    /**
     * Build grouping key from series name for matching across time periods
     * Extracts stable identifiers like deployment name, metric name, etc.
     * Examples:
     *   "myapp-abc123:containerCpu" -> "myapp:containerCpu" (extracts deployment prefix)
     *   "pod-name:containerCpu" -> "containerCpu" (no deployment prefix, use metric only)
     *   "scope:metric:tags" -> "metric" (extract metric)
     */
    @SuppressWarnings("unchecked")
    private String buildGroupingKey(String seriesName, List<Object> currentData) {
        if (seriesName == null || seriesName.isEmpty()) {
            return seriesName;
        }
        
        // Try to extract deployment/stable identifier from series name
        // Look for pattern like "deployment-podid" or "deployment-podid:metric"
        int colonIndex = seriesName.indexOf(':');
        String prefix = colonIndex > 0 ? seriesName.substring(0, colonIndex) : seriesName;
        
        // Try to find longest common prefix across all series (for better grouping)
        // This helps match series with different pod types (e.g., blue vs green)
        String commonPrefix = findLongestCommonPrefix(currentData, seriesName);
        String deployment;
        
        if (commonPrefix != null && commonPrefix.length() > 0 && 
            !commonPrefix.equals(prefix) && prefix.startsWith(commonPrefix)) {
            // Use the common prefix if it's shorter than the current prefix
            // This means we found a prefix that matches multiple series
            deployment = commonPrefix.endsWith("-") ? 
                commonPrefix.substring(0, commonPrefix.length() - 1) : commonPrefix;
        } else {
            // Fall back to extracting deployment name (remove pod-specific suffix like hash/random id)
            // Common patterns: "myapp-abc123" -> "myapp", "myapp-deployment-xyz" -> "myapp-deployment"
            deployment = extractDeploymentFromScope(prefix);
        }
        
        // Extract metric name - try to get from raw data first, then from series name
        String metricName = null;
        String additionalGrouping = "";
        if (currentData != null) {
            for (Object item : currentData) {
                if (item instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> series = (Map<String, Object>) item;
                    String name = getSeriesName(series);
                    if (seriesName.equals(name)) {
                        // Try to get metric from the series object
                        if (series.containsKey("metric")) {
                            Object metricObj = series.get("metric");
                            if (metricObj != null) {
                                String metricStr = metricObj.toString();
                                // Only use if it's different from the series name (not a pod name)
                                if (!metricStr.equals(seriesName) && !metricStr.equals(prefix)) {
                                    metricName = metricStr;
                                }
                            }
                        }
                        // Extract tags/labels for additional grouping
                        if (series.containsKey("tags") && series.get("tags") instanceof Map) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> tags = (Map<String, Object>) series.get("tags");
                            // Extract key labels like app, version, role, cell
                            List<String> keyLabels = new ArrayList<>();
                            for (String key : new String[]{"app", "version", "role", "cell", "namespace"}) {
                                if (tags.containsKey(key)) {
                                    keyLabels.add(key + "=" + tags.get(key));
                                }
                            }
                            if (!keyLabels.isEmpty()) {
                                additionalGrouping = ":" + String.join(",", keyLabels);
                            }
                        }
                        break;
                    }
                }
            }
        }
        
        // If no metric found in raw data, extract from series name
        if (metricName == null) {
            metricName = extractMetricName(seriesName);
            if (metricName == null || metricName.equals(seriesName)) {
                // If extractMetricName returns the full series name (no colon), 
                // and we have a common prefix, use just the common prefix as the grouping key
                // This handles cases where series names are pod names without a metric
                if (deployment != null && !deployment.isEmpty() && !deployment.equals(prefix)) {
                    return deployment + additionalGrouping;
                }
                // Otherwise, use the common prefix if available
                if (commonPrefix != null && commonPrefix.length() > 0 && !commonPrefix.equals(prefix)) {
                    String commonPrefixClean = commonPrefix.endsWith("-") ? 
                        commonPrefix.substring(0, commonPrefix.length() - 1) : commonPrefix;
                    return commonPrefixClean + additionalGrouping;
                }
                // Last resort: use the deployment name
                metricName = deployment != null && !deployment.isEmpty() ? deployment : seriesName;
            }
        }
        
        // Build grouping key: deployment:metric or metric:labels or just metric
        if (deployment != null && !deployment.isEmpty() && !deployment.equals(prefix)) {
            return deployment + ":" + metricName + additionalGrouping;
        } else if (!additionalGrouping.isEmpty()) {
            return metricName + additionalGrouping;
        } else {
            return metricName;
        }
    }
    
    /**
     * Extract deployment name from scope/pod name
     * Removes pod-specific suffixes like random hashes
     * Enhanced to find longest common prefix when all series are provided
     */
    private String extractDeploymentFromScope(String scope) {
        if (scope == null || scope.isEmpty()) {
            return scope;
        }
        
        // Common patterns:
        // "myapp-abc123" -> "myapp" (remove hash suffix)
        // "myapp-deployment-xyz" -> "myapp-deployment"
        // "myapp-12345-67890" -> "myapp" (remove numeric suffixes)
        
        // Try to find the deployment prefix by removing common pod suffixes
        // Look for last dash followed by alphanumeric hash (typically 5-10 chars)
        int lastDash = scope.lastIndexOf('-');
        if (lastDash > 0 && lastDash < scope.length() - 1) {
            String suffix = scope.substring(lastDash + 1);
            // Check if suffix looks like a pod hash (alphanumeric, 5-10 chars)
            if (suffix.matches("[a-z0-9]{5,10}")) {
                return scope.substring(0, lastDash);
            }
        }
        
        // If no clear pattern, return as-is (will fall back to metric-only grouping)
        return scope;
    }
    
    /**
     * Find longest common prefix across all series names in the panel
     * Used to create grouping keys that match all series (e.g., "fra44-casam-app-" matches both blue and green pods)
     */
    @SuppressWarnings("unchecked")
    private String findLongestCommonPrefix(List<Object> allData, String currentSeriesName) {
        if (allData == null || allData.isEmpty()) {
            return null;
        }
        
        // Extract prefix part (before colon) from all series
        List<String> prefixes = new ArrayList<>();
        
        // Add current series prefix
        int colonIndex = currentSeriesName.indexOf(':');
        String currentPrefix = colonIndex > 0 ? currentSeriesName.substring(0, colonIndex) : currentSeriesName;
        prefixes.add(currentPrefix);
        
        // Extract prefixes from all data (current + historical)
        for (Object item : allData) {
            if (item instanceof Map) {
                Map<String, Object> series = (Map<String, Object>) item;
                String name = getSeriesName(series);
                if (name != null && !name.equals(currentSeriesName)) {
                    int nameColonIndex = name.indexOf(':');
                    String prefix = nameColonIndex > 0 ? name.substring(0, nameColonIndex) : name;
                    if (!prefix.isEmpty()) {
                        prefixes.add(prefix);
                    }
                }
            }
        }
        
        if (prefixes.size() < 2) {
            // Only one prefix, return it
            return currentPrefix;
        }
        
        // Find longest common prefix
        String firstPrefix = prefixes.get(0);
        int maxCommonLength = firstPrefix.length();
        
        for (int i = 1; i < prefixes.size(); i++) {
            String otherPrefix = prefixes.get(i);
            int commonLength = 0;
            int minLength = Math.min(firstPrefix.length(), otherPrefix.length());
            
            // Find common prefix length
            for (int j = 0; j < minLength; j++) {
                if (firstPrefix.charAt(j) == otherPrefix.charAt(j)) {
                    commonLength++;
                } else {
                    break;
                }
            }
            
            // Ensure we break at word boundaries (dash or end)
            // Find the last dash before the mismatch
            if (commonLength < maxCommonLength) {
                // Find last dash in the common part
                int lastDashInCommon = firstPrefix.lastIndexOf('-', commonLength - 1);
                if (lastDashInCommon > 0) {
                    commonLength = lastDashInCommon + 1; // Include the dash
                }
                maxCommonLength = Math.min(maxCommonLength, commonLength);
            }
        }
        
        // Return common prefix (including trailing dash if present)
        if (maxCommonLength > 0) {
            String commonPrefix = firstPrefix.substring(0, maxCommonLength);
            // Ensure it ends with dash for consistency (e.g., "fra44-casam-app-")
            if (!commonPrefix.endsWith("-") && maxCommonLength < firstPrefix.length() && 
                firstPrefix.charAt(maxCommonLength) == '-') {
                commonPrefix = firstPrefix.substring(0, maxCommonLength + 1);
            }
            return commonPrefix;
        }
        
        return currentPrefix;
    }
    
    /**
     * Aggregate historical data by grouping key across all periods
     * Collects all values from historical pods that match the grouping key
     * @param allDataForGrouping Combined current + historical data for consistent grouping key building
     */
    @SuppressWarnings("unchecked")
    private List<Double> aggregateHistoricalDataByGroupingKey(
            String groupingKey,
            Map<String, Map<String, List<Double>>> historicalSeriesData,
            Map<String, List<Object>> historicalRawData,
            Map<String, java.util.List<Object>> historicalData,
            List<Object> allDataForGrouping) {
        
        List<Double> aggregatedValues = new ArrayList<>();
        
        // Iterate through all historical periods
        for (Map.Entry<String, Map<String, List<Double>>> periodEntry : historicalSeriesData.entrySet()) {
            String duration = periodEntry.getKey();
            Map<String, List<Double>> periodData = periodEntry.getValue();
            
            // Get raw data for this period to extract grouping keys
            List<Object> rawPeriodData = historicalRawData.get(duration);
            if (rawPeriodData == null && historicalData != null) {
                java.util.List<Object> histPeriodData = historicalData.get(duration);
                if (histPeriodData != null) {
                    rawPeriodData = new ArrayList<>(histPeriodData);
                }
            }
            
        // Find all series in this period that match the grouping key
        if (rawPeriodData != null) {
            int matchedCount = 0;
            int totalCount = 0;
            for (Object item : rawPeriodData) {
                if (item instanceof Map) {
                    Map<String, Object> series = (Map<String, Object>) item;
                    String seriesName = getSeriesName(series);
                    if (seriesName != null) {
                        totalCount++;
                        // Use allDataForGrouping for consistent grouping key building (same as current series)
                        String histGroupingKey = buildGroupingKey(seriesName, 
                            (allDataForGrouping != null && !allDataForGrouping.isEmpty()) ? allDataForGrouping : rawPeriodData);
                        if (groupingKey.equals(histGroupingKey)) {
                            matchedCount++;
                            // Extract values for this matching series
                            List<Double> values = periodData.get(seriesName);
                            if (values != null) {
                                aggregatedValues.addAll(values);
                            } else {
                                logger.warn("Panel grouping key match: Found matching series \"" + seriesName + 
                                    "\" with grouping key \"" + histGroupingKey + "\" but no values in periodData");
                            }
                        } else {
                            // Log first few mismatches for debugging
                            if (totalCount <= 3) {
                                logger.debug("Panel grouping key mismatch: Series \"" + seriesName + 
                                    "\" has grouping key \"" + histGroupingKey + "\" (expected \"" + groupingKey + "\")");
                            }
                        }
                    }
                }
            }
            if (matchedCount == 0 && totalCount > 0) {
                logger.warn("Panel " + duration + ": No historical series matched grouping key \"" + groupingKey + 
                    "\" out of " + totalCount + " series in period");
            } else if (matchedCount > 0) {
                logger.debug("Panel " + duration + ": Matched " + matchedCount + " historical series for grouping key \"" + 
                    groupingKey + "\" (total: " + totalCount + ")");
            }
        } else {
                // Fallback: try to match by metric name if grouping key is just metric
                String metricName = extractMetricName(groupingKey);
                if (metricName != null && metricName.equals(groupingKey)) {
                    // Grouping key is just metric name, aggregate all series with this metric
                    for (Map.Entry<String, List<Double>> entry : periodData.entrySet()) {
                        String histMetricName = extractMetricName(entry.getKey());
                        if (metricName.equals(histMetricName)) {
                            aggregatedValues.addAll(entry.getValue());
                        }
                    }
                }
            }
        }
        
        return aggregatedValues.isEmpty() ? null : aggregatedValues;
    }
    
    /**
     * Aggregate historical data by grouping key for a specific period
     * @param allDataForGrouping Combined current + historical data for consistent grouping key building
     */
    @SuppressWarnings("unchecked")
    private List<Double> aggregateHistoricalDataByGroupingKeyForPeriod(
            String groupingKey,
            String duration,
            Map<String, Map<String, List<Double>>> historicalSeriesData,
            Map<String, List<Object>> historicalRawData,
            Map<String, java.util.List<Object>> historicalData,
            List<Object> allDataForGrouping) {
        
        List<Double> aggregatedValues = new ArrayList<>();
        
        Map<String, List<Double>> periodData = historicalSeriesData.get(duration);
        if (periodData == null) {
            return null;
        }
        
        // Get raw data for this period
        List<Object> rawPeriodData = historicalRawData.get(duration);
        if (rawPeriodData == null && historicalData != null) {
            java.util.List<Object> histPeriodData = historicalData.get(duration);
            if (histPeriodData != null) {
                rawPeriodData = new ArrayList<>(histPeriodData);
            }
        }
        
        // Find all series in this period that match the grouping key
        if (rawPeriodData != null) {
            for (Object item : rawPeriodData) {
                if (item instanceof Map) {
                    Map<String, Object> series = (Map<String, Object>) item;
                    String seriesName = getSeriesName(series);
                    if (seriesName != null) {
                        // Use allDataForGrouping for consistent grouping key building (same as current series)
                        String histGroupingKey = buildGroupingKey(seriesName, 
                            (allDataForGrouping != null && !allDataForGrouping.isEmpty()) ? allDataForGrouping : rawPeriodData);
                        if (groupingKey.equals(histGroupingKey)) {
                            List<Double> values = periodData.get(seriesName);
                            if (values != null) {
                                aggregatedValues.addAll(values);
                            }
                        }
                    }
                }
            }
        } else {
            // Fallback: match by metric name
            String metricName = extractMetricName(groupingKey);
            if (metricName != null && metricName.equals(groupingKey)) {
                for (Map.Entry<String, List<Double>> entry : periodData.entrySet()) {
                    String histMetricName = extractMetricName(entry.getKey());
                    if (metricName.equals(histMetricName)) {
                        aggregatedValues.addAll(entry.getValue());
                    }
                }
            }
        }
        
        return aggregatedValues.isEmpty() ? null : aggregatedValues;
    }
    
    /**
     * Aggregate series by metric name (combines multiple series with the same metric)
     * For example, combines all "containerCpu" series from different pods into one aggregated series
     */
    private Map<String, List<Double>> aggregateSeriesByMetric(Map<String, List<Double>> seriesData) {
        Map<String, List<Double>> aggregated = new HashMap<>();
        Map<String, List<List<Double>>> groupedByMetric = new HashMap<>();
        
        // Group series by metric name
        for (Map.Entry<String, List<Double>> entry : seriesData.entrySet()) {
            String seriesName = entry.getKey();
            String metricName = extractMetricName(seriesName);
            if (metricName == null) {
                metricName = seriesName; // Fallback to full name if extraction fails
            }
            
            groupedByMetric.computeIfAbsent(metricName, k -> new ArrayList<>()).add(entry.getValue());
        }
        
        // Aggregate values for each metric group
        for (Map.Entry<String, List<List<Double>>> entry : groupedByMetric.entrySet()) {
            String metricName = entry.getKey();
            List<List<Double>> valueLists = entry.getValue();
            
            if (valueLists.size() == 1) {
                // Only one series, use it directly
                aggregated.put(metricName, valueLists.get(0));
            } else {
                // Multiple series, aggregate by summing values at each time point
                // First, find the maximum length
                int maxLength = 0;
                for (List<Double> values : valueLists) {
                    maxLength = Math.max(maxLength, values.size());
                }
                
                // Aggregate values (sum at each index)
                List<Double> aggregatedValues = new ArrayList<>();
                for (int i = 0; i < maxLength; i++) {
                    double sum = 0.0;
                    int count = 0;
                    for (List<Double> values : valueLists) {
                        if (i < values.size() && values.get(i) != null && 
                            !Double.isNaN(values.get(i)) && Double.isFinite(values.get(i))) {
                            sum += values.get(i);
                            count++;
                        }
                    }
                    aggregatedValues.add(count > 0 ? sum : 0.0);
                }
                
                aggregated.put(metricName, aggregatedValues);
            }
        }
        
        return aggregated;
    }
    
    /**
     * Calculate average of values
     */
    private double calculateAverage(List<Double> values) {
        if (values == null || values.isEmpty()) {
            return 0.0;
        }
        double sum = 0.0;
        int count = 0;
        for (Double value : values) {
            if (value != null && !Double.isNaN(value) && Double.isFinite(value)) {
                sum += value;
                count++;
            }
        }
        return count > 0 ? sum / count : 0.0;
    }
    
    /**
     * Calculate anomaly score for a series
     * 
     * @return Anomaly score in range [0.0, 1.0]
     *         - 0.0 = no anomaly (normal behavior)
     *         - 1.0 = maximum anomaly (highly anomalous)
     *         The score is calculated based on:
     *         - Magnitude deviation from baseline (normalized by IQR)
     *         - Consensus across historical periods
     *         - Pattern similarity (if enabled)
     */
    private double calculateAnomalyScore(
            List<Double> currentValues,
            Map<String, Map<String, List<Double>>> historicalData,
            String seriesName,
            boolean enablePatternAnalysis,
            double threshold) {
        
        if (currentValues == null || currentValues.isEmpty()) {
            return 0.0;
        }
        
        // Calculate current statistics
        double currentMedian = calculateMedian(currentValues);
        List<Double> historicalMedians = new ArrayList<>();
        
        // Collect historical medians
        for (Map<String, List<Double>> periodData : historicalData.values()) {
            List<Double> previousValues = null;
            // First, try direct lookup by seriesName (works for non-comparable panels where seriesName is groupingKey)
            if (periodData.containsKey(seriesName)) {
                previousValues = periodData.get(seriesName);
            } else {
                // Fall back to findMatchingSeries for comparable panels
                previousValues = findMatchingSeries(seriesName, periodData);
            }
            if (previousValues != null && !previousValues.isEmpty()) {
                historicalMedians.add(calculateMedian(previousValues));
            }
        }
        
        if (historicalMedians.isEmpty()) {
            return 0.0;
        }
        
        // Calculate baseline (median of historical medians)
        double baselineMedian = calculateMedian(historicalMedians);
        double baselineIQR = calculateIQR(historicalMedians);
        
        // Log anomaly calculation details for first few series (INFO level for visibility)
        if (historicalMedians.size() > 0 && seriesName != null && !seriesName.contains(":") && currentValues.size() > 0) {
            // This is likely a grouping key for non-comparable panels
            // Only log first calculation to avoid spam
            if (currentMedian != 0.0 || baselineMedian != 0.0) {
                logger.info("Anomaly calc for grouping key \"" + seriesName + "\": currentMedian=" + currentMedian + 
                    ", baselineMedian=" + baselineMedian + ", baselineIQR=" + baselineIQR + 
                    ", historicalMedians=" + historicalMedians + ", currentValues count=" + currentValues.size() +
                    ", currentValues sample (first 10)=" + (currentValues.size() > 10 ? 
                        currentValues.subList(0, Math.min(10, currentValues.size())) : currentValues));
            }
        }
        
        // Calculate deviation
        double deviation = Math.abs(currentMedian - baselineMedian);
        double normalizedDeviation = baselineIQR > 0 ? deviation / baselineIQR : 0.0;
        
        // Calculate consensus (how many historical periods differ significantly)
        int consensusCount = 0;
        double consensusThreshold = baselineIQR > 0 ? baselineIQR * threshold : 0.0;
        for (Double histMedian : historicalMedians) {
            if (Math.abs(currentMedian - histMedian) > consensusThreshold) {
                consensusCount++;
            }
        }
        double consensusRatio = (double) consensusCount / historicalMedians.size();
        
        // Enhanced detection for spike/outlier scenarios (when median-based detection fails)
        // This handles cases where median stays the same but spike ratios differ significantly
        double spikeAnomaly = 0.0;
        if (baselineIQR == 0.0 || normalizedDeviation == 0.0) {
            // Calculate spike ratios for current and historical data
            // Use a threshold based on the baseline median (e.g., 1.5x median for binary metrics)
            double spikeThreshold = Math.max(baselineMedian * 1.5, 1.5);
            
            // Count spikes in current data
            long currentSpikes = currentValues.stream()
                .filter(v -> v != null && Double.isFinite(v) && v > spikeThreshold)
                .count();
            double currentSpikeRatio = currentValues.size() > 0 ? (double) currentSpikes / currentValues.size() : 0.0;
            
            // Collect spike ratios from historical periods
            List<Double> historicalSpikeRatios = new ArrayList<>();
            for (Map<String, List<Double>> periodData : historicalData.values()) {
                List<Double> previousValues = null;
                if (periodData.containsKey(seriesName)) {
                    previousValues = periodData.get(seriesName);
                } else {
                    previousValues = findMatchingSeries(seriesName, periodData);
                }
                if (previousValues != null && !previousValues.isEmpty()) {
                    long histSpikes = previousValues.stream()
                        .filter(v -> v != null && Double.isFinite(v) && v > spikeThreshold)
                        .count();
                    double histSpikeRatio = previousValues.size() > 0 ? (double) histSpikes / previousValues.size() : 0.0;
                    historicalSpikeRatios.add(histSpikeRatio);
                }
            }
            
            if (!historicalSpikeRatios.isEmpty()) {
                // Calculate baseline spike ratio (median of historical spike ratios)
                double baselineSpikeRatio = calculateMedian(historicalSpikeRatios);
                double spikeRatioDeviation = Math.abs(currentSpikeRatio - baselineSpikeRatio);
                
                // Calculate spike ratio IQR for normalization
                double spikeRatioIQR = calculateIQR(historicalSpikeRatios);
                double normalizedSpikeDeviation = spikeRatioIQR > 0 ? spikeRatioDeviation / spikeRatioIQR : spikeRatioDeviation;
                
                // If current spike ratio is significantly higher than baseline, flag as anomaly
                // Use a threshold: if current is 2x or more of baseline, or absolute difference > 0.1 (10%)
                if (currentSpikeRatio > baselineSpikeRatio * 2.0 || spikeRatioDeviation > 0.1) {
                    spikeAnomaly = Math.min(normalizedSpikeDeviation / 2.0, 1.0);
                    // Boost spike anomaly if the difference is very significant
                    if (currentSpikeRatio > baselineSpikeRatio * 3.0 || spikeRatioDeviation > 0.2) {
                        spikeAnomaly = Math.min(spikeAnomaly * 1.5, 1.0);
                    }
                }
            }
        }
        
        // Also check percentiles for additional signal (95th percentile)
        double percentileAnomaly = 0.0;
        if (baselineIQR == 0.0 || normalizedDeviation < 0.1) {
            double currentP95 = calculatePercentile(currentValues, 95.0);
            List<Double> historicalP95s = new ArrayList<>();
            for (Map<String, List<Double>> periodData : historicalData.values()) {
                List<Double> previousValues = null;
                if (periodData.containsKey(seriesName)) {
                    previousValues = periodData.get(seriesName);
                } else {
                    previousValues = findMatchingSeries(seriesName, periodData);
                }
                if (previousValues != null && !previousValues.isEmpty()) {
                    historicalP95s.add(calculatePercentile(previousValues, 95.0));
                }
            }
            if (!historicalP95s.isEmpty()) {
                double baselineP95 = calculateMedian(historicalP95s);
                double p95Deviation = Math.abs(currentP95 - baselineP95);
                double p95IQR = calculateIQR(historicalP95s);
                if (p95IQR > 0) {
                    double normalizedP95Deviation = p95Deviation / p95IQR;
                    percentileAnomaly = Math.min(normalizedP95Deviation / 3.0, 1.0);
                } else if (p95Deviation > baselineP95 * 0.5) {
                    // If IQR is 0 but there's a significant absolute difference, flag it
                    percentileAnomaly = Math.min(p95Deviation / (baselineP95 + 1.0), 1.0);
                }
            }
        }
        
        // Log anomaly score components for first calculation (INFO level for visibility)
        if (historicalMedians.size() > 0 && seriesName != null && !seriesName.contains(":") && currentValues.size() > 0) {
            double magnitudeAnomaly = Math.min(normalizedDeviation / 3.0, 1.0);
            // Only log if there's actual data to analyze
            if (currentMedian != 0.0 || baselineMedian != 0.0) {
                logger.info("Anomaly calc components for \"" + seriesName + "\": deviation=" + deviation + 
                    ", normalizedDeviation=" + normalizedDeviation + ", magnitudeAnomaly=" + magnitudeAnomaly +
                    ", consensusCount=" + consensusCount + "/" + historicalMedians.size() + 
                    ", consensusRatio=" + consensusRatio + ", spikeAnomaly=" + spikeAnomaly +
                    ", percentileAnomaly=" + percentileAnomaly);
            }
        }
        
        // Calculate pattern similarity if enabled
        double patternAnomaly = 0.0;
        if (enablePatternAnalysis) {
            double avgCorrelation = 0.0;
            int correlationCount = 0;
            for (Map<String, List<Double>> periodData : historicalData.values()) {
                List<Double> previousValues = null;
                // First, try direct lookup by seriesName (works for non-comparable panels where seriesName is groupingKey)
                if (periodData.containsKey(seriesName)) {
                    previousValues = periodData.get(seriesName);
                } else {
                    // Fall back to findMatchingSeries for comparable panels
                    previousValues = findMatchingSeries(seriesName, periodData);
                }
                if (previousValues != null && previousValues.size() > 1) {
                    double corr = calculateCorrelation(currentValues, previousValues);
                    if (!Double.isNaN(corr)) {
                        avgCorrelation += corr;
                        correlationCount++;
                    }
                }
            }
            if (correlationCount > 0) {
                avgCorrelation /= correlationCount;
                patternAnomaly = 1.0 - avgCorrelation; // Low correlation = high anomaly
            }
        }
        
        // Combine into final score
        double magnitudeAnomaly = Math.min(normalizedDeviation / 3.0, 1.0);
        double consensusAnomaly = consensusRatio;
        
        // Use the maximum of spike anomaly and percentile anomaly as additional signal
        // This ensures we detect anomalies even when median-based detection fails
        double additionalAnomaly = Math.max(spikeAnomaly, percentileAnomaly);
        
        double anomalyScore;
        if (enablePatternAnalysis) {
            // If we have additional anomaly signals, weight them appropriately
            if (additionalAnomaly > 0) {
                anomalyScore = magnitudeAnomaly * 0.3 + consensusAnomaly * 0.3 + patternAnomaly * 0.15 + additionalAnomaly * 0.25;
            } else {
                anomalyScore = magnitudeAnomaly * 0.4 + consensusAnomaly * 0.4 + patternAnomaly * 0.2;
            }
        } else {
            // If we have additional anomaly signals, weight them appropriately
            if (additionalAnomaly > 0) {
                anomalyScore = magnitudeAnomaly * 0.35 + consensusAnomaly * 0.35 + additionalAnomaly * 0.3;
            } else {
                anomalyScore = magnitudeAnomaly * 0.5 + consensusAnomaly * 0.5;
            }
        }
        
        return Math.min(anomalyScore, 1.0);
    }
    
    /**
     * Calculate median
     */
    private double calculateMedian(List<Double> values) {
        if (values == null || values.isEmpty()) {
            return 0.0;
        }
        List<Double> sorted = new ArrayList<>(values);
        sorted.removeIf(v -> v == null || Double.isNaN(v) || !Double.isFinite(v));
        if (sorted.isEmpty()) {
            return 0.0;
        }
        Collections.sort(sorted);
        int mid = sorted.size() / 2;
        if (sorted.size() % 2 == 0) {
            return (sorted.get(mid - 1) + sorted.get(mid)) / 2.0;
        } else {
            return sorted.get(mid);
        }
    }
    
    /**
     * Calculate Interquartile Range (IQR)
     */
    private double calculateIQR(List<Double> values) {
        if (values == null || values.size() < 2) {
            return 0.0;
        }
        List<Double> sorted = new ArrayList<>(values);
        sorted.removeIf(v -> v == null || Double.isNaN(v) || !Double.isFinite(v));
        if (sorted.size() < 2) {
            return 0.0;
        }
        Collections.sort(sorted);
        int q1Index = sorted.size() / 4;
        int q3Index = (3 * sorted.size()) / 4;
        double q1 = sorted.get(q1Index);
        double q3 = sorted.get(q3Index);
        return q3 - q1;
    }
    
    /**
     * Calculate percentile for a list of values
     * @param values List of values
     * @param percentile Percentile to calculate (0-100)
     * @return The value at the specified percentile
     */
    private double calculatePercentile(List<Double> values, double percentile) {
        if (values == null || values.isEmpty()) {
            return 0.0;
        }
        List<Double> sorted = new ArrayList<>(values);
        sorted.removeIf(v -> v == null || Double.isNaN(v) || !Double.isFinite(v));
        if (sorted.isEmpty()) {
            return 0.0;
        }
        Collections.sort(sorted);
        double index = (percentile / 100.0) * (sorted.size() - 1);
        int lowerIndex = (int) Math.floor(index);
        int upperIndex = (int) Math.ceil(index);
        if (lowerIndex == upperIndex) {
            return sorted.get(lowerIndex);
        }
        double weight = index - lowerIndex;
        return sorted.get(lowerIndex) * (1 - weight) + sorted.get(upperIndex) * weight;
    }
    
    /**
     * Calculate correlation between two time series
     */
    private double calculateCorrelation(List<Double> x, List<Double> y) {
        if (x == null || y == null || x.size() != y.size() || x.size() < 2) {
            return 0.0;
        }
        
        // Align sizes
        int minSize = Math.min(x.size(), y.size());
        List<Double> xAligned = new ArrayList<>(x.subList(0, minSize));
        List<Double> yAligned = new ArrayList<>(y.subList(0, minSize));
        
        // Remove invalid values
        for (int i = xAligned.size() - 1; i >= 0; i--) {
            if (xAligned.get(i) == null || yAligned.get(i) == null ||
                Double.isNaN(xAligned.get(i)) || Double.isNaN(yAligned.get(i)) ||
                !Double.isFinite(xAligned.get(i)) || !Double.isFinite(yAligned.get(i))) {
                xAligned.remove(i);
                yAligned.remove(i);
            }
        }
        
        if (xAligned.size() < 2) {
            return 0.0;
        }
        
        // Calculate means
        double xMean = calculateAverage(xAligned);
        double yMean = calculateAverage(yAligned);
        
        // Calculate correlation
        double numerator = 0.0;
        double xSumSq = 0.0;
        double ySumSq = 0.0;
        
        for (int i = 0; i < xAligned.size(); i++) {
            double xDiff = xAligned.get(i) - xMean;
            double yDiff = yAligned.get(i) - yMean;
            numerator += xDiff * yDiff;
            xSumSq += xDiff * xDiff;
            ySumSq += yDiff * yDiff;
        }
        
        double denominator = Math.sqrt(xSumSq * ySumSq);
        if (denominator == 0.0) {
            return 0.0;
        }
        
        return numerator / denominator;
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
        queryMap.put("name", "=jstack");
        //queryMap.put("get_raw_jstack_flag","=true");
        queryMap.remove("file-name");
        logger.info("trying getJstackProfileFromRaw");
        Map<Long, String> jstackRawEvents = eventStore.getOtherPayLoads(tenant, start, end, queryMap, dimMap, true);
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
        aggregator.initializePid("Jstack");
        List<Long> keys = new ArrayList<Long>(jstackRawEvents.keySet());
        Collections.sort(keys);
        Long prevKey = -1L;
        for (int i = 0; i < keys.size(); i++) {
            if (keys.get(i) == prevKey) {
                continue;//avoid processing dup events
            }
            prevKey = keys.get(i);
            aggregator.processJstackEvent(keys.get(i), jstackRawEvents.get(keys.get(i)), true);
        }
        Object profile = aggregator.getProfileTree("Jstack");
        final String response = Utils.toJson(profile);
        logger.info(queryMap.get("name") + " response length: " + response.length());
        return response;
    }
    
    @Override
    @SuppressWarnings("unchecked")
    public Map<Long, String> getRawJstacks(final String tenant, final long start, final long end, final Map<String, String> queryMap) throws IOException {
        final Map<String, String> dimMap = new HashMap<>();
        // Build query map similar to getJstackProfileFromRaw
        Map<String, String> jstackQueryMap = new HashMap<>(queryMap);
        jstackQueryMap.put("name", "=jstack");
        jstackQueryMap.remove("file-name");
        
        logger.info("Fetching raw jstacks for tenant: {}, start: {}, end: {}, queryMap: {}", tenant, start, end, jstackQueryMap);
        
        Map<Long, String> jstackRawEvents = (Map<Long, String>) eventStore.getOtherPayLoads(tenant, start, end, jstackQueryMap, dimMap, true);
        if (jstackRawEvents == null || jstackRawEvents.size() < 1) {
            logger.info("No raw jstacks found with initial query, trying without get_raw_jstack_flag");
            jstackQueryMap.remove("get_raw_jstack_flag"); // do not trust this flag
            jstackRawEvents = (Map<Long, String>) eventStore.getOtherPayLoads(tenant, start, end, jstackQueryMap, dimMap, true);
            if (jstackRawEvents == null || jstackRawEvents.size() < 1) {
                logger.info("No raw jstack events found for the given time range");
                return null;
            }
        }
        
        logger.info("Found {} raw jstack events", jstackRawEvents.size());
        return jstackRawEvents;
    }

    @Override
    public String getJstackProfile(final String tenant, final long start, final long end, final Map<String, String> queryMap) throws IOException {
        final Map<String, String> dimMap = new HashMap<>();
        try {
            List<String> profiles = eventStore.getGeniePayLoads(tenant, start, end, queryMap, dimMap, true);
            if (profiles == null || profiles.size() < 1) {
                return getJstackProfileFromRaw(tenant, start, end, queryMap, dimMap);
            }
            final EventHandler aggregator = new EventHandler();
            for (int i = 0; i < profiles.size(); i++) {
                aggregator.aggregateTree((EventHandler.JfrParserResponse) Utils.readValue(profiles.get(i), EventHandler.JfrParserResponse.class));
            }

            if (config.isExperimental()) {
                SurfaceDataResponse res = genSurfaceData(aggregator.getAggregatedProfileTree(), tenant, queryMap.get("host"));
                EventHandler.JfrParserResponse apr = (EventHandler.JfrParserResponse) aggregator.getAggregatedProfileTree();
                apr.addMeta(ImmutableMap.of("data", Utils.toJson(res)));
                final String response = Utils.toJson(apr);
                return response;
            } else {
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
        } catch (Exception e) {
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to aggregate Jstack events " + e.getMessage(), queryMap, null));
        }
    }

    public String getSafepointContext(long start, long end, String instance, String domain, String cell, String pod){
        String cr = ArgusQueryT.getSafepointData(start, end, instance, domain, cell, pod);
        return cr;
    }

    public String getOldgenContext(long start, long end, String instance, String domain, String cell, String pod){
        String cr = ArgusQueryT.getOldgenData(start, end, instance, domain, cell, pod);
        return cr;
    }

    @Override
    public String getOtherEvents(final String tenant, long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) {
        logger.info("getOtherEvents processing " + queryMap);
        try {
            if (queryMap.get("name").contains("=safepoint")){
                System.out.println("get safepoint metrics");
                String res = getSafepointContext(start,end,queryMap.get("instance"),"core1", tenant, queryMap.get("host").replace("=",""));
                if(res != null){
                    return res;
                }else{
                    return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to get safepoint metric", queryMap, null));
                }
            }
            if (queryMap.get("name").contains("=oldgen")){
                System.out.println("get oldgen metrics");
                String res = getOldgenContext(start,end,queryMap.get("instance"),"core1", tenant, queryMap.get("host").replace("=",""));
                if(res != null){
                    return res;
                }else {
                    return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to get oldgen metric", queryMap, null));
                }
            }

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
        if (queryMap.containsKey(PerfGenieConstants.SOURCE_KEY)) {
            profiles = eventStore.loadGenieProfiles(tenant, start, end, queryMap, dimMap, false);
        } else {
            profiles = eventStore.loadGenieProfiles(tenant, start, end, queryMap, dimMap, false);
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
            boolean useSFContext = false;
            for (int i = 0; i < tosort.size(); i++) {
                queryMap.put("guid", profiles.get(tosort.get(i)).get("guid"));
                String result = eventStore.getGenieLargeEvent(tosort.get(i), tosort.get(i), queryMap, dimMap, tenant);
                if (queryMap.containsKey(PerfGenieConstants.SOURCE_KEY)) {
                    try {
                        aggregator.aggregateLogContext((EventHandler.ContextResponse) Utils.readValue(result, EventHandler.ContextResponse.class));
                    } catch (Exception e) {
                        //try SF context, could be an upload
                        aggregator.aggregateSFLogContext((EventHandler.SFContextResponse) Utils.readValue(result, EventHandler.SFContextResponse.class));
                        useSFContext = true;
                    }
                } else {
                    useSFContext = true;
                    aggregator.aggregateSFLogContext((EventHandler.SFContextResponse) Utils.readValue(result, EventHandler.SFContextResponse.class));
                }
            }
            if (useSFContext) {
                return Utils.toJson(aggregator.getSFLogContext());
            } else {
                return Utils.toJson(aggregator.getLogContext());
            }
        } catch (Exception e) {
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to aggregate" + e.getMessage(), queryMap, null));
        }
    }

    /// ////////////////////////////
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
                        if (file.toString().contains(".tmp") || file.toString().contains(".json")) {
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
        DiskCache.cleanup(15*24*60);
    }

    public static String canarySource = "gold";
    public void addCanaryComment(String comment, Long timestamp, String cell, String color, Long ctime, String host) throws IOException {
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null || config.getStorageType().equals("grpc")) {
            if(host == null) {
                host = "perf-genie-tracker";
            }
        }else{
            host = InetAddress.getLocalHost().getHostName();
        }

        final Map<String, Double> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("source", canarySource);
        queryMap.put("tenant-id", "canary");
        queryMap.put("instance-id", host);//TODO this shold be input
        queryMap.put("host", host);
        queryMap.put("source-file", "canary");
        queryMap.put("file-name", "canary-comment");//
        queryMap.put("type", "canaryevent");
        queryMap.put("name", "canary");
        queryMap.put("guid", timestamp + cell);
        queryMap.put("cell", cell);
        queryMap.put("color", color);
        queryMap.put("ctime", String.valueOf(ctime));

        System.out.println(timestamp + "  4--->" + Utils.toJson(queryMap));
        eventStore.addGenieEvent(timestamp, queryMap, dimMap, comment, config.getTenant());
    }

    public void addLense(String lense, Long timestamp, String host, String type, String name) throws IOException {
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null || config.getStorageType().equals("grpc")) {
            if(host == null) {
                host = "perf-genie-tracker";
            }
        }else{
            host = InetAddress.getLocalHost().getHostName();
        }

        final Map<String, Double> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("source", canarySource);
        queryMap.put("tenant-id", "lenses");
        queryMap.put("instance-id", host);//TODO this shold be input
        queryMap.put("host", host);
        queryMap.put("source-file", "lense");
        queryMap.put("file-name", "canary-lense");//
        queryMap.put("type", type);
        queryMap.put("name", name);
        queryMap.put("guid", timestamp + type);

        System.out.println(timestamp + " addLense 5--->" + Utils.toJson(queryMap));
        eventStore.addGenieEvent(timestamp, queryMap, dimMap, lense, config.getTenant());
    }

    public void addExpression(String expression, Long timestamp, String host, String type, String name) throws IOException {
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null || config.getStorageType().equals("grpc")) {
            if(host == null) {
                host = "perf-genie-tracker";
            }
        }else{
            host = InetAddress.getLocalHost().getHostName();
        }

        final Map<String, Double> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("source", canarySource);
        queryMap.put("tenant-id", "expressions");
        queryMap.put("instance-id", host);//TODO this shold be input
        queryMap.put("host", host);
        queryMap.put("source-file", "expression");
        queryMap.put("file-name", "canary-expression");//
        queryMap.put("type", type);
        queryMap.put("name", name);
        queryMap.put("guid", timestamp + type);

        System.out.println(timestamp + " addDerivedMetric 6--->" + Utils.toJson(queryMap));
        eventStore.addGenieEvent(timestamp, queryMap, dimMap, expression, config.getTenant());
    }

    public void addConfigEvent(String c) throws IOException {
        long timestamp = System.currentTimeMillis(); // Always use new timestamp
        // Always use fixed host name for config events
        String host = "perf-genie-tracker";
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null || config.getStorageType().equals("grpc")) {
            if(host == null) {
                host = "perf-genie-tracker";
            }
        }else{
            host = InetAddress.getLocalHost().getHostName();
        }
        final Map<String, Double> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("source", canarySource);
        queryMap.put("tenant-id", "podconfig");
        queryMap.put("instance-id", host);
        queryMap.put("host", host);
        queryMap.put("source-file", "podconfig");
        queryMap.put("file-name", "podconfig-update");//
        queryMap.put("type", "podconfig");
        queryMap.put("name", "podconfig");
        queryMap.put("guid", timestamp + "podconfig");

        System.out.println(timestamp + " addConfigEvent 7--->" + Utils.toJson(queryMap));
        eventStore.addGenieEvent(timestamp, queryMap, dimMap, c, this.config.getTenant());
    }

    public String getAllPidStatData(long start, long end, final String cell,String instance, String substrate, String domain, String host) throws IOException {
        List<List<Object>> datas = new ArrayList<>();
        final Map<String, String> queryMap =new HashMap<>();

        String tenant_id = "falcon-"+instance + "-" + domain +"-"+cell;
        queryMap.put("name","=pidstat");
        queryMap.put("tenant-id","="+tenant_id);
        //String scope = ArgusQueryT.getScope(start,start,cell);
        //List<String> kpods = ArgusQueryT.getCanaryPods(String.valueOf(start),String.valueOf(end),"aws-prod2-apsouth1","core1","ind86");
        final Map<String, String> dimMap = new HashMap<>();

        HashMap<String,ArrayList<String>> otherevents = eventStore.getPidStatPayLoads(tenant_id, start, end, queryMap, dimMap, true,200);
        List<String> keys = new ArrayList<String>(otherevents.keySet());
        List<PidStatResponse> responses = new ArrayList<>();
        for (int i = 0; i < keys.size(); i++) {

            HashMap<Object,ArrayList<Object>> mdata = new HashMap<>();

            for (int j=0; j<otherevents.get(keys.get(i)).size();j++){
                // First response
                ParsePidStat parser = new ParsePidStat();
                parser.parsePidStatString(cell,keys.get(i),otherevents.get(keys.get(i)).get(j));
                List<List<Object>> list = parser.getPidstatParseOutputArray();
                for(int k=0;k<list.size();k++){
                    if(!mdata.containsKey(list.get(k).get(3))){
                        mdata.put(list.get(k).get(3),new ArrayList<>());
                    }
                    mdata.get(list.get(k).get(3)).add(list.get(k));
                    //System.out.println(list.size());
                }
            }

            List<Object> metrics = new ArrayList<Object>(mdata.keySet());
            for(int z=0; z<metrics.size();z++){
                ArrayList<Object> r = mdata.get(metrics.get(z));

                PidStatResponse response1 = new PidStatResponse();
                response1.setScope(keys.get(i));
                response1.setMetric(metrics.get(z).toString());//????
                response1.addTag("cell", cell);
                response1.addTag("datacenter", tenant_id);
                response1.setDisplayName(keys.get(i)+ ":" + metrics.get(z));//????
                for (int m=0;m<r.size();m++){
                    response1.addDatapoint(((ArrayList)r.get(m)).get(2).toString()+"000", Double.parseDouble(((ArrayList)r.get(m)).get(4).toString()));
                }
                responses.add(response1);
            }
         }
        String res = Utils.toJson(responses);
        return res;
    }

    public String getAllCanaryCellTimeSeries(long start, long end, final String cell,String host) throws IOException {
        ArrayList<String> metrics = new ArrayList<>(Arrays.asList("cCpuT","rCnt","Apt","rCpuT", "kpodC","PA","heap","cCpuTN"));
        HashMap<String,Object> canaryType = getCanaryCellTimeSeries(start,end,cell,host,"CanaryType", null);

        List<HashMap<String,Object>> datas = new ArrayList<>();

        List<Future<HashMap<String,Object>>> futures = new ArrayList<>();
        FunctionExecutorPool pool = new FunctionExecutorPool(8);

        for(int i=0; i<metrics.size();i++){
            //HashMap<String,Object> data = getCanaryCellTimeSeries(start,end,cell,host,metrics.get(i),canaryType);
            final int index = i;
            futures.add(pool.submitTask(() -> getCanaryCellTimeSeries(start,end,cell,host,metrics.get(index),canaryType)));
            /*if(data != null && data.size()>0){
                datas.add(data);
            }*/
        }
        for (Future<HashMap<String,Object>> future : futures) {
            try {
                HashMap<String, Object> data = future.get();
                if(data != null && data.size()>0){
                    datas.add(data);
                }
            }catch (Exception e){

            }
        }
        pool.shutdown();
        return Utils.toJson(datas);
    }

    public HashMap<String,Object> getCanaryCellTimeSeries(long start, long end, final String cell,String host,String metric, HashMap<String,Object> canaryType) throws IOException {
        System.out.println("getCanaryCellTimeSeries " + cell + ":" + metric + " start:" + Utils.getDateTimeString(start) + " end:" + Utils.getDateTimeString(end));
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null || config.getStorageType().equals("grpc")) {
            if(host == null) {
                host = "perf-genie-tracker";
            }
        }else{
            host = InetAddress.getLocalHost().getHostName();
        }

        final Map<String, String> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("source", "=gold");
        queryMap.put("name", "=timeseries");
        queryMap.put("tenant-id", "=timeseries");
        queryMap.put("cell", "=" + cell);
        queryMap.put("instance-id", "=" + host);
        queryMap.put("host", "=" + host);
        queryMap.put("cell", "=" + cell);
        queryMap.put("metric", "=" + metric);
        try {
            ArrayList<Double> values_canaryType = null;
            List<Long> timestamps_canaryType = null;
            if(canaryType != null){
                values_canaryType = (ArrayList)((HashMap)canaryType.get("metrics")).get("CanaryType");
                timestamps_canaryType = (ArrayList) canaryType.get("timestamps");
                if(timestamps_canaryType != null && values_canaryType != null) {
                    TimeseriesSorter.sortByTimestampsIfNeeded(values_canaryType, timestamps_canaryType);
                }
                //System.out.println(timestamps_canaryType.get(0) +":"+timestamps_canaryType.get(values_canaryType.size()-1));
            }


            HashMap<String,Object> data = new HashMap<>();
            HashMap<String,List<Double>> metrics = new HashMap<>();

            List<Double> values = new ArrayList<>();
            List<Double> values_canary = new ArrayList<>();
            List<Long> timestamps = new ArrayList<>();
            List<Long> timestamps_canary = new ArrayList<>();
            HashMap<String,String> colors = new HashMap<>();
            long curStart = start - 15 * 24 * 60 * 60 * 1000; // start 7 days earlier
            long metricStartTime = 0;
            int metricSeriesCount = 0;
            long canaryMetricStartTime = 0;
            long interval = 0;
            while (curStart<=end) {
                long curEnd = curStart + 5 * 24 * 60 * 60 * 1000;
                if(curEnd > end){
                    curEnd = end + 1;
                }
                System.out.println("getCanaryCellTimeSeries1 " + cell + ":" + metric + " start:" + Utils.getDateTimeString(curStart) + " end:" + Utils.getDateTimeString(curEnd));
                List<String> lenses = eventStore.getCanaryComments(config.getTenant(), curStart, curEnd, queryMap, dimMap, true);
                if(lenses != null) {

                    for (String lense : lenses) {
                        SeriesData map = (SeriesData) Utils.readValue(lense, SeriesData.class);
                        ArrayList<Double> tmp_values = map.getV();
                        ArrayList<Long> tmp_timestamps = map.getX();
                        TimeseriesSorter.sortByTimestampsIfNeeded(tmp_values, tmp_timestamps);

                        if(interval == 0){
                            interval = TimeseriesSorter.findInterval(tmp_timestamps);
                            //System.out.println(interval);
                        }else{
                            //fill gaps with null values
                            long lastTimestamp = timestamps.get(timestamps.size()-1);
                            if((tmp_timestamps.get(0) - lastTimestamp) > interval){
                                long curStartTimestamp = tmp_timestamps.get(0);
                                while(curStartTimestamp > lastTimestamp) {
                                    lastTimestamp = lastTimestamp + interval;
                                    timestamps.add(lastTimestamp);
                                    values_canary.add(null);
                                    values.add(null);
                                }
                            }
                            //System.out.println(lastTimestamp);
                        }

                        if(metricStartTime == 0){
                            canaryMetricStartTime = tmp_timestamps.get(0);
                            metricStartTime = canaryMetricStartTime + 7 * 24 * 60 * 60 * 1000;
                        }
                        if(timestamps_canaryType != null && values_canaryType != null) {
                            long typeEnd = timestamps_canaryType.get(0);
                            Double typeValue = values_canaryType.get(0);
                            int curTypeIndex = 0;
                            int curSeriesIndex = 0;
                            while(curSeriesIndex < tmp_timestamps.size()){
                                while(curTypeIndex < values_canaryType.size() && typeValue == values_canaryType.get(curTypeIndex)){
                                    typeEnd= timestamps_canaryType.get(curTypeIndex);
                                    curTypeIndex++;
                                }
                                while(curSeriesIndex < tmp_timestamps.size() && (tmp_timestamps.get(curSeriesIndex) < typeEnd || curTypeIndex == values_canaryType.size()) ){
                                    //if(tmp_timestamps.get(curSeriesIndex) >= metricStartTime) {
                                        timestamps.add(tmp_timestamps.get(curSeriesIndex));
                                    //    metricSeriesCount++;
                                    //}
                                    //timestamps_canary.add(tmp_timestamps.get(curSeriesIndex));
                                    if(metric.equals("rCpuT")) {
                                        if (typeValue == null) {
                                            values_canary.add(null);
                                            values.add(null);
                                        } else if (typeValue == 2) {
                                            values.add(tmp_values.get(curSeriesIndex) / 60000.0);
                                            values_canary.add(null);
                                        } else {
                                            values.add(null);
                                            values_canary.add(tmp_values.get(curSeriesIndex) / 60000.0);
                                        }

                                    }else{
                                        if (typeValue == null) {
                                            values_canary.add(null);
                                            values.add(null);
                                        } else if(typeValue == 2) {
                                            values.add(tmp_values.get(curSeriesIndex));
                                            values_canary.add(null);
                                        }else {
                                            values.add(null);
                                            values_canary.add(tmp_values.get(curSeriesIndex));
                                        }
                                    }
                                    curSeriesIndex++;
                                }
                                if(curTypeIndex < values_canaryType.size()) {
                                    typeValue = values_canaryType.get(curTypeIndex);
                                }
                            }
                        }else {
                            if (metric.equals("rCpuT")) {
                                ArrayList<Double> tmp = map.getV();
                                for (int i = 0; i < tmp.size(); i++) {
                                    values.add(tmp.get(i) / 60000.0);
                                }
                            } else {
                                values.addAll(map.getV());
                            }
                            ArrayList<Long> tmp = map.getX();
                            for (int i = 0; i < tmp.size(); i++) {
                                timestamps.add(tmp.get(i));
                            }
                        }
                    }
                }
                curStart = curEnd+1;
            }
            if(timestamps_canaryType != null && values_canaryType != null) {


                if(timestamps.size() != 0) {
                    canaryMetricStartTime = timestamps.get(0)+ 7 * 24 * 60 * 60 * 1000;
                    metricSeriesCount = 0;
                    for(int i =0; i<timestamps.size(); i++){
                        if(timestamps.get(i) >= canaryMetricStartTime){
                            metricSeriesCount++;
                        }
                    }
                    System.out.println("getCanaryCellTimeSeries2 " + cell + ":" + metric + " count:" + metricSeriesCount + " data start:" + Utils.getDateTimeString(timestamps.get(0)) + "data end:" + Utils.getDateTimeString(timestamps.get(timestamps.size()-1)) + " canary start:" + Utils.getDateTimeString(canaryMetricStartTime));

                    List<Double> values_canary_p = values_canary.subList(0,metricSeriesCount);
                    List<Double> values_p = values.subList(0,metricSeriesCount);
                    timestamps = timestamps.subList(timestamps.size()-metricSeriesCount,timestamps.size());
                    values = values.subList(values.size()-metricSeriesCount,values.size());
                    values_canary = values_canary.subList(values_canary.size()-metricSeriesCount,values_canary.size());
                    metrics.put("zing-" + metric, values_canary);
                    metrics.put("zulu-" + metric, values);
                    metrics.put("zing-lastweek-" + metric, values_canary_p);
                    metrics.put("zulu-lastweek-" + metric, values_p);
                    colors.put("zing-" + metric, "#FF5F1F");
                    colors.put("zulu-" + metric, "#1F51FF");
                    colors.put("zing-lastweek-" + metric, "#EC5800");
                    colors.put("zulu-lastweek-" + metric, "#4169E1");
                }
            }else{
                metrics.put(metric, values);
                colors.put(metric,"blue");
            }

            data.put("timestamps",timestamps);
            data.put("metrics",metrics);
            data.put("colors",colors);
            System.out.println("getCanaryCellTimeSeries done " + timestamps.size());
            return data;
        } catch (Exception e) {
            System.out.println(e.getMessage() + ":" + e.getStackTrace());;
            return null;
        }
    }
    public static class SeriesData{
        public ArrayList<Double> getV() {
            return v;
        }

        public void setV(ArrayList<Double> v) {
            this.v = v;
        }

        public ArrayList<Long> getX() {
            return x;
        }

        public void setX(ArrayList<Long> x) {
            this.x = x;
        }

        public ArrayList<Double> v;
        public ArrayList<Long> x;

    }

    public String getCanaryLenses(final Map<String, String> queryMap,String host) throws IOException {
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null || config.getStorageType().equals("grpc")) {
            if(host == null) {
                host = "perf-genie-tracker";
            }
        }else{
            host = InetAddress.getLocalHost().getHostName();
        }

        final Map<String, String> dimMap = new HashMap<>();
        queryMap.put("source", canarySource);
        queryMap.put("tenant-id", "lenses");
        queryMap.put("instance-id", host);//TODO this shold be input
        queryMap.put("host", host);
        queryMap.put("source-file", "lense");
        queryMap.put("file-name", "canary-lense");//
        //queryMap.put("name", "lense");
        //queryMap.put("name", "lense");

        try {
            long end = Instant.now().toEpochMilli() + 60 * 60 * 1000;
            List<String> lenses = new ArrayList<>();
            for (int j = 5; j <= 40; j += 5) {
                long start = end - 5 * 24 * 60 * 60 * 1000L;
                List<String> lenses1 = eventStore.getCanaryLenses(config.getTenant(), start, end, queryMap, dimMap, true);
                if(lenses1 != null){
                    lenses.addAll(lenses1);
                }
                end = start;
            }
            return Utils.toJson(lenses);
        } catch (Exception e) {
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to get lenses" + e.getMessage(), queryMap, null));
        }
    }

    public String getCanaryExpressions(final Map<String, String> queryMap,String host) throws IOException {
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null || config.getStorageType().equals("grpc")) {
            if(host == null) {
                host = "perf-genie-tracker";
            }
        }else{
            host = InetAddress.getLocalHost().getHostName();
        }

        final Map<String, String> dimMap = new HashMap<>();
        queryMap.put("source", canarySource);
        queryMap.put("tenant-id", "expressions");
        queryMap.put("instance-id", host);//TODO this shold be input
        queryMap.put("host", host);
        queryMap.put("source-file", "expression");
        queryMap.put("file-name", "canary-expression");//
        //queryMap.put("name", "expression");

        try {
            long end = Instant.now().toEpochMilli() + 60 * 60 * 1000;
            List<String> expressions = new ArrayList<>();
            for (int j = 5; j <= 10; j += 5) {
                long start = end - 5 * 24 * 60 * 60 * 1000L;
                List<String> expressions1 = eventStore.getCanaryLenses(config.getTenant(), start, end, queryMap, dimMap, true);
                if(expressions1 != null){
                    expressions.addAll(expressions1);
                }
                end = start;
            }
            return Utils.toJson(expressions);
        } catch (Exception e) {
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to get expressions" + e.getMessage(), queryMap, null));
        }
    }


    public void addCanaryEvent(List<Object> record, long timestamp, String cell, String host) throws IOException {
        List<String> header = new ArrayList<>();
        header.add("timestamp:timestamp");
        header.add("tid:text");
        header.add("cell:text");
        header.add("avgApt %ch:number");
        header.add("avgJCpu/r %ch:number");
        header.add("avgCCpu/r %ch:number");
        header.add("dashURL:text");
        header.add("zingCC:number");
        header.add("zuluCC:number");
        header.add("metrURL:text");
        header.add("startUp %c:number");
        header.add("aptQ:text");
        header.add("jCpuQ:text");
        header.add("cCpuQ:text");
        header.add("zingCCQ:text");
        header.add("zuluCCQ:text");
        header.add("reqCpu %c:number");
        header.add("5xx4xx %c:number");
        header.add("instance:text");
        header.add("domain:text");

        final Map<String, Double> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("source", canarySource);
        queryMap.put("tenant-id", "canary");
        queryMap.put("instance-id", host);
        queryMap.put("host", host);
        queryMap.put("source-file", "canary");
        queryMap.put("file-name", "canary-context");//
        queryMap.put("type", "canaryevent");
        queryMap.put("name", "canary");
        queryMap.put("etime", String.valueOf(System.currentTimeMillis()));
        final EventHandler aggregator = new EventHandler();
        aggregator.initializeEvent("canary");
        aggregator.addHeader("canary", header);
        aggregator.processContext(record, 1, "canary");
        String guid = Utils.generateGuid();
        queryMap.put("guid", guid);
        queryMap.put("cell", cell);
        Object logContext = aggregator.getLogContext();
        //if (!eventEsists(timestamp, host, record.get(2).toString())) {
        System.out.println(timestamp + " 2--->" + Utils.toJson(queryMap));
        eventStore.addGenieEvent(timestamp, queryMap, dimMap, Utils.toJson(logContext), config.getTenant());
        //}
    }

    public void addCanaryEventNew(List<Object> record, long timestamp, String cell, String host, List<String> header) throws IOException {
        final Map<String, Double> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("source", canarySource);
        queryMap.put("tenant-id", "canary");
        queryMap.put("instance-id", host);
        queryMap.put("host", host);
        queryMap.put("source-file", "canary");
        queryMap.put("file-name", "canary-context");//
        queryMap.put("type", "canaryevent");
        queryMap.put("name", "canary");
        queryMap.put("etime", String.valueOf(System.currentTimeMillis()));
        final EventHandler aggregator = new EventHandler();
        aggregator.initializeEvent("canary");
        aggregator.addHeader("canary", header);
        aggregator.processContext(record, 1, "canary");
        String guid = Utils.generateGuid();
        queryMap.put("guid", guid);
        queryMap.put("cell", cell);
        Object logContext = aggregator.getLogContext();
        //if (!eventEsists(timestamp, host, record.get(2).toString())) {
        System.out.println("2 addCanaryEventNew --------->" + timestamp + ":" + Utils.toJson(queryMap));

        eventStore.addGenieEvent(timestamp, queryMap, dimMap, Utils.toJson(logContext), config.getTenant());
        //}
    }

    /*
    public synchronized String releaseTask(long start, long end, String host) throws IOException {
        int hr = Canary.getCurrentHourUTC();
        boolean local = false;
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null || config.getStorageType().equals("grpc")) {
            if(host == null) {
                host = "perf-genie-releasemonitor";
            }
        }else{
            local = true;
            host = InetAddress.getLocalHost().getHostName();
        }

        List<List<Object>> response = new ArrayList<>();
        for (int lastndays = (int) end; lastndays <= start; lastndays++) {
            for (Map.Entry<String, Integer[]> entry : Canary.podsList.entrySet()) {
                String cell = entry.getKey();
                //Integer[] arr = entry.getValue();
                long curTimeMillis = System.currentTimeMillis();
                curTimeMillis = curTimeMillis - lastndays * 24 * 60 * 60 * 1000L;
                CanaryResponse res = WeekOverWeek.processWeekOverWeekCanary(curTimeMillis, curTimeMillis+24 * 60 * 60 * 1000, cell);
                List<Object> record = res.getRecord();
                List<String> header = res.getHeader();
                if (record != null && record.size() > 0) {
                    if (record.size() > 0) {
                        long eventTimestamp = Utils.roundEpochToMidnightUTC(curTimeMillis) + 24 * 60 * 60 * 1000L;
                        if (!eventEsists(eventTimestamp, host, cell) && (!local)) {
                            addCanaryEventNew(record, eventTimestamp, cell, host, header);
                            response.add(record);
                        } else {
                            System.out.println("skip release event exists:" + cell + " : " + eventTimestamp);
                        }
                    }
                }
            }
        }
        return Utils.toJson(response);
    }*/

    /*
    public synchronized String canaryTask(long start, long end, String host) throws IOException {
        int hr = Canary.getCurrentHourUTC();
        boolean local = false;
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null || config.getStorageType().equals("grpc")) {
            if(host == null) {
                host = "perf-genie-tracker";
            }
        }else{
            local = true;
            host = InetAddress.getLocalHost().getHostName();
        }

        List<List<Object>> response = new ArrayList<>();
        for (int lastndays = (int) end; lastndays <= start; lastndays++) {
            for (Map.Entry<String, Integer[]> entry : Canary.podsList.entrySet()) {
                String cell = entry.getKey();
                Integer[] arr = entry.getValue();
                if (hr >= arr[1]) {
                    long tmp1 = Canary.getUtcEpochForHour(arr[0]);
                    long tmp2 = Canary.getUtcEpochForHour(arr[1]);
                    tmp1 = tmp1 - lastndays * 24 * 60 * 60 * 1000L;
                    tmp2 = tmp2 - lastndays * 24 * 60 * 60 * 1000L;
                    //check if event exists
                    if (!eventEsists(tmp2, host, cell) && (!local)) {
                        System.out.println("canaryTask process ------->:" + cell + " : " + arr[1] + " : " + hr);
                        List<Object> record = Canary.processCellCanary(tmp1, tmp2, cell);
                        if (record != null && record.size() > 0) {
                            if (record.size() > 0) {
                                addCanaryEvent(record, tmp2, cell, host);
                                response.add(record);
                            }
                        } else {
                            System.out.println("canaryTask skip record count:" + record.size() + " : " + cell + " : " + arr[1] + " : " + hr);
                        }
                    } else {
                        System.out.println("canaryTask skip event exists:" + cell + " : " + arr[1] + " : " + hr);
                    }
                } else {
                    System.out.println("canaryTask skip:" + cell + " : " + arr[1] + " : " + hr);
                }
            }
        }
        return Utils.toJson(response);
    }*/

    public boolean eventEsists(long timestamp, String host, String cell) {
        Map<Long, Map<String, String>> profiles;
        final Map<String, String> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("source", "="+canarySource);
        queryMap.put("name", "=canary");
        queryMap.put("tenant-id", "=canary");
        queryMap.put("cell", "=" + cell);
        queryMap.put("instance-id", "=" + host);
        queryMap.put("host", "=" + host);
        try {
            int count = eventStore.isEventExist(config.getTenant(), timestamp - 1, timestamp + 1, queryMap, dimMap);
            System.out.println("1 eventEsists --------->" + timestamp + ":"+ count + ":" + Utils.toJson(queryMap));
            if (count > 0) {
                return true;
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    public static String convertEpochToDateString(long epochMilli, String pattern, String timezone) {
        Instant instant = Instant.ofEpochMilli(epochMilli);
        LocalDateTime localDateTime = instant.atZone(ZoneId.of(timezone)).toLocalDateTime();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern(pattern);
        return localDateTime.format(formatter);
    }


    public String getCanaryEvent(String host, long start, long end) throws IOException {
        List<String> events;
        Map<String, String> counts;
        EventStore.CanaryEvents response;
        //String host = InetAddress.getLocalHost().getHostName();
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null || config.getStorageType().equals("grpc")) {
            if(host == null) {
                host = "perf-genie-tracker";
            }
        }else{
            host = InetAddress.getLocalHost().getHostName();
        }
        final Map<String, String> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("source", "="+canarySource);
        queryMap.put("name", "=canary");
        queryMap.put("tenant-id", "=canary");
        queryMap.put("instance-id", "=" + host);
        queryMap.put("host", "=" + host);
        //queryMap.put("file-name", "=canary-context");//
        queryMap.put("type", "=canaryevent");
        try {
            final EventHandler aggregator = new EventHandler();
            Map<String, String> allcounts = new HashMap<>();

            long curEnd = end + 60 * 60 * 1000;
            long curStart = curEnd - 5 * 24 * 60 * 60 * 1000L;

            while (curEnd > start) {
                curStart = curEnd - 5 * 24 * 60 * 60 * 1000L;
                if(start > curStart){
                    curStart=start;
                }
                String pattern = "yyyy-MM-dd HH:mm:ss";
                String timezone = "UTC";

                String dateString1 = convertEpochToDateString(curStart, pattern, timezone);
                String dateString2 = convertEpochToDateString(curEnd, pattern, timezone);

                queryMap.remove("guid");
                response = eventStore.loadGenieEventAndCommentPayloads(config.getTenant(), curStart, curEnd, queryMap, dimMap, true);

                if(response != null){
                    System.out.println(dateString1 + ":" + dateString2 + ":" + response.getEvents().size());
                }else{
                    System.out.println(dateString1 + ":" + dateString2 + ":null");
                }
                if (response == null || response.getEvents().size() < 1) {
                    //System.out.println("Skip");
                    curEnd = curStart;

                    continue;
                    //return Utils.toJson(new EventHandler.JfrParserResponse(null, "no profiles found for the given time range", queryMap, null));
                }

                events = response.getEvents();
                counts = response.getCounts();
                counts.forEach((key, value) -> {
                    allcounts.put(key, value);
                });

                for (int i = 0; i < events.size(); i++) {
                    String payload = events.get(i);
                    try {
                        aggregator.aggregateLogContext((EventHandler.ContextResponse) Utils.readValue(payload, EventHandler.ContextResponse.class));
                    }catch (Exception e){
                        System.out.println("skip:"+payload);
                    }
                }
                curEnd = curStart;
            }
            return Utils.toJson(new canaryResponse(aggregator.getLogContext(), allcounts));
        } catch (Exception e) {
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to aggregate" + e.getMessage(), queryMap, null));
        }
    }

    public String backupCanaryEvent(long start, long end) throws IOException {
        String host = InetAddress.getLocalHost().getHostName();
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null || config.getStorageType().equals("grpc")) {
            host = "perf-genie-tracker";
        }
        final Map<String, String> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("source", "=genie");//get from genie and put in gold
        queryMap.put("name", "=canary");
        queryMap.put("tenant-id", "=canary");
        queryMap.put("instance-id", "=" + host);
        queryMap.put("host", "=" + host);
        queryMap.put("type", "=canaryevent");
        try {
            end = Instant.now().toEpochMilli() + 60 * 60 * 1000;
            for (int j = 5; j <= 30; j += 5) {
                start = end - 5 * 24 * 60 * 60 * 1000L;
                String pattern = "yyyy-MM-dd HH:mm:ss";
                String timezone = "UTC";
                String dateString1 = convertEpochToDateString(start, pattern, timezone);
                String dateString2 = convertEpochToDateString(end, pattern, timezone);
                boolean ret = eventStore.backupGenieEventAndComments(config.getTenant(), start, end, queryMap, dimMap, true);
                if (ret) {
                    System.out.println( "Backup success" + dateString1 + ":" + dateString2);
                    end = start;
                    continue;
                }
                end = start;
            }
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "backup Success", queryMap, null));
        } catch (Exception e) {
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to aggregate" + e.getMessage(), queryMap, null));
        }
    }

    class canaryResponse {
        canaryResponse(Object entry, Map<String, String> counts) {
            this.entry = entry;
            this.counts = counts;
        }

        public Object getEntry() {
            return entry;
        }

        public void setEntry(Object entry) {
            this.entry = entry;
        }

        Object entry;

        public Map<String, String> getCounts() {
            return counts;
        }

        public void setCounts(Map<String, String> counts) {
            this.counts = counts;
        }

        Map<String, String> counts;
    }

    public String getCanaryComments(long start, long end, final Map<String, String> queryMap,String host) throws IOException {
        Map<Long, PerfGenieController.Comment> comments = new HashMap<>();
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null || config.getStorageType().equals("grpc")) {
            if(host == null) {
                host = "perf-genie-tracker";
            }
        }else{
            host = InetAddress.getLocalHost().getHostName();
        }

        final Map<String, String> dimMap = new HashMap<>();
        queryMap.put("source", "="+canarySource);
        queryMap.put("name", "=canary");
        queryMap.put("tenant-id", "=canary");
        queryMap.put("instance-id", "=" + host);
        queryMap.put("host", "=" + host);
        queryMap.put("type", "=canaryevent");
        queryMap.put("file-name", "=canary-comment");

        try {
            String pattern = "yyyy-MM-dd HH:mm:ss";
            String timezone = "UTC";
            List<String> events = eventStore.getCanaryComments(config.getTenant(), start, end, queryMap, dimMap, true);
            List<Long> tosort = new ArrayList<>();
            for (int i = 0; i < events.size(); i++) {
                PerfGenieController.Comment comment = (PerfGenieController.Comment) Utils.readValue(events.get(i), PerfGenieController.Comment.class);
                comments.put(comment.getCommentTime(), comment);
                tosort.add(comment.getCommentTime());
            }
            Collections.sort(tosort);
            Map<Long, PerfGenieController.Comment> commentsRes = new HashMap<>();
            for (int i = 0; i < tosort.size(); i++) {
                commentsRes.put(tosort.get(i), comments.get(tosort.get(i)));
                System.out.println(convertEpochToDateString(tosort.get(i), pattern, timezone));
            }
            return Utils.toJson(commentsRes);
        } catch (Exception e) {
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to get comments" + e.getMessage(), queryMap, null));
        }
    }

    public synchronized String processWeekOverWeekCanaryTask(long timestampStart1, long timestampEnd1, String cell1, long timestampStart2, long timestampEnd2, String cell2,String host) throws IOException{
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null || config.getStorageType().equals("grpc")) {
            if(host == null) {
                host = "perf-genie-test45";
            }
        }else{
            host = InetAddress.getLocalHost().getHostName();
        }
        List<List<Object>> res = new ArrayList<>();
        String dateString1 = Utils.convertEpochToUTCString(timestampStart1);
        String dateString2 = Utils.convertEpochToUTCString(timestampEnd1);
        CanaryResponse response = WeekOverWeek.getCanaryResponseWeekOverWeek(timestampStart1,timestampEnd1,cell1,timestampStart2,timestampEnd2,cell2,4, host);
        System.out.println("processWeekOverWeekCanaryTask " + dateString1 + ":" + dateString2 + ":" + cell1 + "--->" + Utils.toJson(response));
        List<Object> record = response.getRecord();
        if (record.size() > 0) {
            addCanaryEventNew(record, System.currentTimeMillis(), cell1, host, response.getHeader());
            res.add(record);
            System.out.println(cell1 + "processWeekOverWeekCanaryTask ----> record count " + record.size());
        } else {
            System.out.println(cell1 + "processWeekOverWeekCanaryTask ----> skip record count " + record.size());
        }
        return Utils.toJson(res);
    }


    public synchronized String processSideBySideCanaryTask(long timestampStart, long timestampEnd, String cell,String host, String basekpods, String canarykpods) throws IOException{
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null || config.getStorageType().equals("grpc")) {
            if(host == null) {
                host = "perf-genie-test45";
            }
        }else{
            host = InetAddress.getLocalHost().getHostName();
        }
        List<List<Object>> res = new ArrayList<>();
        String dateString1 = Utils.convertEpochToUTCString(timestampStart);
        String dateString2 = Utils.convertEpochToUTCString(timestampEnd);
        // Default to "*" if not provided
        final String basekpodsValue = (basekpods != null && !basekpods.trim().isEmpty()) ? basekpods : "*";
        final String canarykpodsValue = (canarykpods != null && !canarykpods.trim().isEmpty()) ? canarykpods : "*";
        CanaryResponse response = SideBySide.processSideBySideCanaryTask(timestampStart, timestampEnd, cell, 3, basekpodsValue, canarykpodsValue);
        System.out.println(dateString1 + ":" + dateString2 + ":" + cell + ":basekpods=" + basekpodsValue + ":canarykpods=" + canarykpodsValue + "--->" + Utils.toJson(response));
        List<Object> record = response.getRecord();
        if (record.size() > 0) {
            addCanaryEventNew(record, System.currentTimeMillis(), cell, host, response.getHeader());
            res.add(record);
            System.out.println(cell + "---->processSideBySideCanaryTask record count " + record.size());
        } else {
            System.out.println(cell + "---->processSideBySideCanaryTask skip record count " + record.size());
        }
        return Utils.toJson(res);
    }

    public String processRefreshRequest(long start, long end, String cell, String host) throws IOException{
        //type is 1
        List<List<Object>> res = new ArrayList<>();
        String dateString1 = Utils.convertEpochToUTCString(start);
        String dateString2 = Utils.convertEpochToUTCString(end);
        if((int) ArgusQueryT.pc.getConfig().get(cell).get("type") == 1) {
            CanaryResponse response = WeekOverWeek.processWeekOverWeekCanary(start, end, cell, host);
            if(response != null){
                List<Object> record = response.getRecord();
                if (record.size() > 0) {
                    addCanaryEventNew(record, end, cell, host, response.getHeader());
                    res.add(record);
                    System.out.println("<-----COMPLETED----->"+ dateString1 + ":"+ dateString2 + ":" +cell + " record count " + record.size()+"<-----COMPLETED----->");
                } else {
                    System.out.println("<-----SKIPPED----->"+ dateString1 + ":"+ dateString2 + ":" +cell + " record count " + record.size()+"<-----SKIPPED----->");
                }
            }
        }
        return Utils.toJson(res);
    }

    //this will use canary end time stamp to save record, used by scheduled task and UI. This will avoid duplicate records
    public synchronized String canarySideBySideTask(long start, long end, String type, String host) throws IOException {
        int hr = Utils.getCurrentHourUTC();
        boolean local = false;
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null || config.getStorageType().equals("grpc")) {
            if(host == null) {
                host = "perf-genie-test45";
            }
        }else{
            local = true;
            host = InetAddress.getLocalHost().getHostName();
        }

        List<List<Object>> res = new ArrayList<>();
        for (int lastndays = (int)end; lastndays <= start; lastndays++) {
            for (String cell : ArgusQueryT.pc.getConfig().keySet()) {
                if ((boolean) ArgusQueryT.pc.getConfig().get(cell).get("enabled") == true) {
                    if ((lastndays != 0) || (hr >= (int) (((List) ArgusQueryT.pc.getConfig().get(cell).get("peak")).get(0)))){// current hr greather than or equal to end hour for current day
                        long tmp2 = Utils.getUtcEpochForHour((int) (((List) ArgusQueryT.pc.getConfig().get(cell).get("peak")).get(0)));//end hour
                        long tmp1 = tmp2 - ((int) (((List) ArgusQueryT.pc.getConfig().get(cell).get("peak")).get(1))) * 60 * 60 * 1000; // tmp1 minus duration hours * 60 * 60 * 1000

                        tmp1 = tmp1 - lastndays * 24 * 60 * 60 * 1000L;
                        tmp2 = tmp2 - lastndays * 24 * 60 * 60 * 1000L;
                        try {
                            if (!eventEsists(tmp2, host, cell)) {
                                CanaryResponse response;
                                if (type.equals("sidebyside")) {
                                    //type is 2
                                    if((int) ArgusQueryT.pc.getConfig().get(cell).get("type") == 2) {
                                        System.out.println(type + " SideBySide.processSideBySideCanary");
                                        response = SideBySide.processSideBySideCanary(tmp1, tmp2, cell);
                                    }else{
                                        System.out.println(type + " SideBySide.processSideBySideCanary");
                                        System.out.println("Ignore cell 1 " + cell + ", request type not matched, type " + (int) ArgusQueryT.pc.getConfig().get(cell).get("type"));
                                        continue;
                                    }
                                } else {
                                    //type is 1
                                    if((int) ArgusQueryT.pc.getConfig().get(cell).get("type") == 1) {
                                        System.out.println(type + " WeekOverWeek.processWeekOverWeekCanary");
                                        response = WeekOverWeek.processWeekOverWeekCanary(tmp1, tmp2, cell, host);
                                    }else{
                                        System.out.println(type + " WeekOverWeek.processWeekOverWeekCanary");
                                        System.out.println("Ignore cell 2 " + cell + ", request type not matched, type " + (int) ArgusQueryT.pc.getConfig().get(cell).get("type"));
                                        continue;
                                    }
                                }
                                String dateString1 = Utils.convertEpochToUTCString(tmp1);
                                String dateString2 = Utils.convertEpochToUTCString(tmp2);
                                System.out.println(dateString1 + ":" + dateString2 + ":" + cell + "--->" + Utils.toJson(response));
                                if(response != null){
                                    List<Object> record = response.getRecord();
                                    if (record.size() > 0) {
                                        addCanaryEventNew(record, tmp2, cell, host, response.getHeader());
                                        res.add(record);
                                        System.out.println("<-----COMPLETED----->"+dateString2 + ":" +cell + ":" + lastndays + " record count " + record.size()+"<-----COMPLETED----->");
                                    } else {
                                        System.out.println(cell + ":" + lastndays + "----> skip record count " + record.size());
                                    }
                                }
                            } else {
                                System.out.println(cell + ":" + lastndays + "---> Event exists");
                            }
                        } catch (Exception e) {
                            System.out.println(cell + "----> Exception " + lastndays + ":" + cell + e.getMessage());
                            e.printStackTrace();
                        }
                    }else {
                        System.out.println("skip:" + cell + " : " + type + ":" + (int) (((List) ArgusQueryT.pc.getConfig().get(cell).get("peak")).get(0)) + " : " + hr);
                    }
                }
            }
        }
        return Utils.toJson(res);
    }

    public static void main(String[] args) {
        try {
            long start = 0;
            long end = 0;
            boolean duplicates = false;//set this to true if you want to update data

            Config config = new Config();
            Cantor cantor = null;
            if (config.getStorageType().equals("mySQL")) {
                cantor = new CantorOnMysql(config.getMySQL_host(), config.getMySQL_port(), config.getMySQL_user(), config.getMySQL_pwd());
            } else if (config.getStorageType().equals("grpc")) {
                cantor = new CantorOnGrpc(config.getGrpc_target());
            } else {
                cantor = new CantorOnH2(config.getH2dir());//default
            }
            CustomJfrParser parser = new CustomJfrParser(2);
            EventStore eventStore = new EventStore(cantor, config);
            PerfGenieService service = new PerfGenieService(eventStore, parser, config);
            String substrate = System.getenv("SUBSTRATE");
            String host = InetAddress.getLocalHost().getHostName();
            System.out.println(args[0]);
            if (substrate != null) {
                host = "perf-genie-test45";
            }
            host = "perf-genie-test45";
            if (args[0].equals("process")) {
                if (args.length > 5) {
                    long startTime1 = Long.parseLong(args[1]);
                    long endTime1 = Long.parseLong(args[2]);
                    long startTime2 = Long.parseLong(args[3]);
                    long endTime2 = Long.parseLong(args[4]);
                    String cell = args[5];
                    System.out.println("process service.processWeekOverWeekCanaryTask");
                    service.processWeekOverWeekCanaryTask(startTime1, endTime1, cell, startTime2, endTime2, cell, host);
                }else{
                    System.out.println(args.length);
                }

            }else if (args[0].equals("refresh")) {
                long startTime = Long.parseLong(args[1]);
                long endTime = Long.parseLong(args[2]);
                String cell = args[3];
                System.out.println("1 refresh service.processRefreshRequest");
                service.processRefreshRequest(startTime, endTime, cell, host);
            } else if (args[0].equals("week")) {
                long startTime = Long.parseLong(args[1]);
                long endTime = Long.parseLong(args[2]);
                String cell = args[3];
                String instance = args[4];
                long previousTimeDiffMs = 7 * 24 * 60 * 60 * 1000L;
                //type 4, custom
                System.out.println("2 week service.processWeekOverWeekCanaryTask");
                service.processWeekOverWeekCanaryTask(startTime, endTime, cell, startTime - previousTimeDiffMs, endTime - previousTimeDiffMs, cell, host);
            } else if (args[0].equals("side")) {
                System.out.println("side");
                //type 3 custom
                return;
            } else if (args[0].equals("release") || args[0].equals("canary")) {
                start = Long.parseLong(args[1]);
                end = Long.parseLong(args[2]);
                if (!duplicates) {
                    // this will avoid duplicates but checks for current hour  > end time
                    if (args[0].equals("canary")) {
                        //type 2
                        System.out.println("3 canary service.canarySideBySideTas");
                        service.canarySideBySideTask(start, end, "sidebyside", host);
                    } else {
                        //type 1
                        System.out.println("4 release service.canarySideBySideTas");
                        service.canarySideBySideTask(start, end, "release", host);
                    }
                } else {
                    for (int lastndays = (int) end; lastndays <= start; lastndays++) {
                        for (String cell : ArgusQueryT.pc.getConfig().keySet()) {
                            if ((boolean) ArgusQueryT.pc.getConfig().get(cell).get("enabled") == true) {
                                System.out.println(((List) ArgusQueryT.pc.getConfig().get(cell).get("peak")).get(0));

                                long tmp2 = Utils.getUtcEpochForHour((int) (((List) ArgusQueryT.pc.getConfig().get(cell).get("peak")).get(0)));//end hour
                                long tmp1 = tmp2 - ((int) (((List) ArgusQueryT.pc.getConfig().get(cell).get("peak")).get(1))) * 60 * 60 * 1000; // tmp1 minus duration hours * 60 * 60 * 1000

                                //long tmp1 = Canary.getUtcEpochForHour((int) (((List) ArgusQueryT.pc.getConfig().get(cell).get("peak")).get(0)));
                                //long tmp2 = Canary.getUtcEpochForHour((int) (((List) ArgusQueryT.pc.getConfig().get(cell).get("peak")).get(1)));
                                tmp1 = tmp1 - lastndays * 24 * 60 * 60 * 1000L;
                                tmp2 = tmp2 - lastndays * 24 * 60 * 60 * 1000L;
                                try {
                                    if (!service.eventEsists(tmp2, host, cell)) {
                                        CanaryResponse response;
                                        if (args[0].equals("canary")) {
                                            //type 3
                                            if ((int) ArgusQueryT.pc.getConfig().get(cell).get("type") == 2) {
                                                System.out.println("5 canary service.processSideBySideCanaryTask");
                                                service.processSideBySideCanaryTask(tmp1, tmp2, cell, host, "*", "*");// this will save record with a new timestamp
                                            } else {
                                                System.out.println("Ignore cell " + cell + ", request type not matched, type " + (int) ArgusQueryT.pc.getConfig().get(cell).get("type"));
                                            }
                                        } else {
                                            long previousTimeDiffMs = 7 * 24 * 60 * 60 * 1000L;
                                            //type 4
                                            if ((int) ArgusQueryT.pc.getConfig().get(cell).get("type") == 1) {
                                                System.out.println("6 release service.processWeekOverWeekCanaryTask");
                                                service.processWeekOverWeekCanaryTask(tmp1, tmp2, cell, tmp1 - previousTimeDiffMs, tmp2 - previousTimeDiffMs, cell, host); // this will save record with a new timestamp
                                            } else {
                                                System.out.println("Ignore cell " + cell + ", request type not matched, type " + (int) ArgusQueryT.pc.getConfig().get(cell).get("type"));
                                            }
                                        }
                                    } else {
                                        System.out.println(cell + ":" + lastndays + "---> Event exists");
                                    }
                                } catch (Exception e) {
                                    System.out.println(cell + "----> Exception " + lastndays + ":" + cell + e.getMessage());
                                    e.printStackTrace();
                                }
                            }
                        }
                    }
                }
            } else {
                System.out.println("----> Invalid arguments");
            }

            /*else if (args.length == 3 || args.length == 4 || args.length == 5) {
                if (substrate != null) {
                    host = "perf-genie-tracker";
                }
                String cell = args[0];

                start = Long.parseLong(args[1]);
                end = Long.parseLong(args[2]);
                int numDays = 1;
                int numDaysSt = 0;
                if (args.length == 4 || args.length == 5) {
                    numDays = Integer.parseInt(args[3]);
                }
                if (args.length == 5) {
                    numDaysSt = Integer.parseInt(args[4]);
                }
                for (int i = numDaysSt; i < numDays; i++) {
                    long curstart = start - i * 24 * 60 * 60 * 1000L;
                    long curend = end - i * 24 * 60 * 60 * 1000L;
                    System.out.println("----------------->" + Utils.convertEpochToUTCString(curstart) +" to "+ Utils.convertEpochToUTCString(curend));
                    try {
                        if (true || !service.eventEsists(curend, host, cell)) {
                            List<Object> record = test1(curstart, curend, cell);
                            if (record.size() > 0) {
                                service.addCanaryEvent(record, curend, cell, host);
                                System.out.println(cell + ":" + i + "----> record count " + record.size());
                            } else {
                                System.out.println(cell + ":" + i + "----> skip record count " + record.size());
                            }
                        } else {
                            System.out.println(cell + ":" + i + "---> Event exists");
                        }
                    } catch (Exception e) {
                        System.out.println(cell + "----> Exception " + i + ":" + cell);
                    }
                }
            } else if (args.length == 2) {
                if (substrate != null) {
                    host = "perf-genie-releasemonitor";
                }
                String cell = args[0];
                start = Long.parseLong(args[1]);
                long eventTimestamp = Utils.roundEpochToMidnightUTC(start) + 24 * 60 * 60 * 1000L;
                if (!service.eventEsists(eventTimestamp, host, cell)) {
                    CanaryResponse res = test2(start, cell);
                    List<Object> record = res.getRecord();
                    List<String> header = res.getHeader();
                    if (record.size() > 0) {
                        //service.addCanaryEventNew(record, eventTimestamp, cell, host, header);
                        System.out.println(Utils.toJson(res));
                    } else {
                        System.out.println(cell + "----> skip record count " + record.size());
                    }
                } else {
                    System.out.println(cell + "----> Event exists");
                }
            } */

        } catch (Exception e) {
            System.out.println(e.getMessage());
        }
    }

    /*public static List<Object> test1(long start, long end, String cell) {
        System.out.println("test1 start");
        try {
            List<Object> record = Canary.processCellCanary(start, end, cell);
            System.out.println(record.size());
            return record;
        } catch (Exception e) {
            System.out.println(e.getMessage());
        }
        System.out.println("test1 end");
        return new ArrayList<Object>();
    }*/

    /*public static CanaryResponse test2(long start, String cell) {
        System.out.println("test2 start");
        try {
            CanaryResponse res = WeekOverWeek.processWeekOverWeekCanary(start, start+24*60*60*1000,cell);
            return res;
        } catch (Exception e) {
            System.out.println(e.getMessage());
        }
        System.out.println("test2 end");
        return null;
    }*/

    /*public synchronized String releaseUploadTask(long start, long end) throws IOException {
        int hr = Utils.getCurrentHourUTC();
        String host = InetAddress.getLocalHost().getHostName();
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null) {
            host = "perf-genie-releasemonitor";
        }
        List<List<Object>> response = new ArrayList<>();
        for (int lastndays = (int) end; lastndays <= start; lastndays++) {
            for (Map.Entry<String, Integer[]> entry : Canary.podsList.entrySet()) {
                String cell = entry.getKey();
                if (!cell.equals("ind86")) {
                    continue;
                }
                long curTimeMillis = System.currentTimeMillis() - 4 * 60 * 60 * 1000;
                curTimeMillis = curTimeMillis - lastndays * 24 * 60 * 60 * 1000L;
                CanaryResponse res = WeekOverWeek.processWeekOverWeekCanary(curTimeMillis, curTimeMillis+24*60*60*1000, cell);
                List<Object> record = res.getRecord();
                List<String> header = res.getHeader();
                if (record != null && record.size() > 0) {
                    if (record.size() > 0) {
                        long eventTimestamp = Utils.roundEpochToMidnightUTC(curTimeMillis)+ 24 * 60 * 60 * 1000L;
                        if (!eventEsists(eventTimestamp, host, cell)) {
                            addCanaryEventNew(record, eventTimestamp, cell, host,header);
                            response.add(record);
                        } else {
                            System.out.println("skip release event exists:" + cell + " : " + eventTimestamp);
                        }
                    }
                }
            }
        }
        return Utils.toJson(response);
    }*/

}