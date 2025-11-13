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
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.LoggerFactory;


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
        deleteOldFiles(config.getJfrdir(), 1);
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
        DiskCache.cleanup(24*60);
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

    public String getAllPidStatData(long start, long end, final String cell,String instance, String host) throws IOException {
        List<List<Object>> datas = new ArrayList<>();
        final Map<String, String> queryMap =new HashMap<>();
        //queryMap.put("host","=");
        String[] arr = instance.split("\\.");

        String tenant_id = "falcon-aws-"+arr[0] + "-" + arr[1]+"-core1-"+cell;
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
        System.out.println("getCanaryCellTimeSeries " + cell + ":" + metric);
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
            long curStart = start - 8 * 24 * 60 * 60 * 1000; // start 7 days earlier
            long metricStartTime = 0;
            int metricSeriesCount = 0;
            long canaryMetricStartTime = 0;
            long interval = 0;
            while (curStart<=end) {
                long curEnd = curStart + 5 * 24 * 60 * 60 * 1000;
                if(curEnd > end){
                    curEnd = end + 1;
                }
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

        try {
            long end = Instant.now().toEpochMilli() + 60 * 60 * 1000;
            List<String> lenses = new ArrayList<>();
            for (int j = 5; j <= 10; j += 5) {
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
            end = Instant.now().toEpochMilli() + 60 * 60 * 1000;
            for (int j = 5; j <= 50; j += 5) {
                start = end - 5 * 24 * 60 * 60 * 1000L;
                String pattern = "yyyy-MM-dd HH:mm:ss";
                String timezone = "UTC";

                String dateString1 = convertEpochToDateString(start, pattern, timezone);
                String dateString2 = convertEpochToDateString(end, pattern, timezone);

                queryMap.remove("guid");
                response = eventStore.loadGenieEventAndCommentPayloads(config.getTenant(), start, end, queryMap, dimMap, true);

                if(response != null){
                    System.out.println(dateString1 + ":" + dateString2 + ":" + response.getEvents().size());
                }else{
                    System.out.println(dateString1 + ":" + dateString2 + ":null");
                }
                if (response == null || response.getEvents().size() < 1) {
                    //System.out.println("Skip");
                    end = start;

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
                end = start;
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
                host = "perf-genie-test13";
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


    public synchronized String processSideBySideCanaryTask(long timestampStart, long timestampEnd, String cell,String host) throws IOException{
        String substrate = System.getenv("SUBSTRATE");
        if (substrate != null || config.getStorageType().equals("grpc")) {
            if(host == null) {
                host = "perf-genie-test13";
            }
        }else{
            host = InetAddress.getLocalHost().getHostName();
        }
        List<List<Object>> res = new ArrayList<>();
        String dateString1 = Utils.convertEpochToUTCString(timestampStart);
        String dateString2 = Utils.convertEpochToUTCString(timestampEnd);
        CanaryResponse response = SideBySide.processSideBySideCanaryTask(timestampStart, timestampEnd, cell, 3);
        System.out.println(dateString1 + ":" + dateString2 + ":" + cell + "--->" + Utils.toJson(response));
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
                host = "perf-genie-test13";
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
                host = "perf-genie-test13";
            }
            host = "perf-genie-test45";
            if (args[0].equals("refresh")) {
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
                                                service.processSideBySideCanaryTask(tmp1, tmp2, cell, host);// this will save record with a new timestamp
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