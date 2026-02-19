/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
package perfgenie.utils;

import com.google.common.base.Stopwatch;
import com.google.common.collect.ImmutableMap;
import com.mysql.cj.jdbc.SuspendableXAConnection;
import com.salesforce.cantor.Cantor;
import com.salesforce.cantor.Events;
import com.salesforce.cantor.grpc.CantorOnGrpc;
import com.salesforce.cantor.h2.CantorOnH2;
import com.salesforce.cantor.mysql.CantorOnMysql;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class EventStore {
    private final static Logger logger = LoggerFactory.getLogger(EventStore.class);
    //public static final String NAMESPACE_JFR_JSON_CACHE = "jfr-json-cache";
    //public static final String NAMESPACE_EVENT_LARGE_FILE = "event-large-file";
    //public static final String NAMESPACE_EVENT_META = "event-meta-data";//TODO: need a tenant specific metadata?
    public static final int LARGE_FILE_SIZE = 1024 * 1024;
    public static boolean enableLargeFile = true;
    private final Cantor cantor;
    final Config config;
    public static HashMap<String, String> tenantsCache = new HashMap<>();
    public static Long tenantsCacheTime = System.currentTimeMillis();

    private static Lock cacheLock = new ReentrantLock();

    final CommandExecutor executor = CommandExecutor.getInstance();

    boolean isBackupNamespaceAvailable = false;

    public EventStore(final Config config) throws IOException {
        this.config = config;
        if (config.getStorageType().equals("mySQL")) {
            this.cantor = new CantorOnMysql(config.getMySQL_host(), config.getMySQL_port(), config.getMySQL_user(), config.getMySQL_pwd());
        } else if (config.getStorageType().equals("grpc")) {
            this.cantor = new CantorOnGrpc(config.getGrpc_target());
        } else {
            this.cantor = new CantorOnH2(config.getH2dir());//default
        }
        try {
            this.cantor.events().get(
                    PerfGenieConstants.getEventNameSpace(config.getTenant(), PerfGenieConstants.PERFGENIE, config.getBackup_namespace()),
                    0L,
                    0L);
        } catch (Exception e) {
            this.cantor.events().create(PerfGenieConstants.getEventNameSpace(config.getTenant(), PerfGenieConstants.PERFGENIE, config.getBackup_namespace()));
        }
        try {
            this.cantor.events().get(
                    PerfGenieConstants.getLargeEventNameSpace(config.getTenant(), PerfGenieConstants.PERFGENIE, config.getBackup_namespace()),
                    0L,
                    0L);
        } catch (Exception e) {
            this.cantor.events().create(PerfGenieConstants.getLargeEventNameSpace(config.getTenant(), PerfGenieConstants.PERFGENIE, config.getBackup_namespace()));
        }

        try {
            this.cantor.events().get(
                    PerfGenieConstants.getMetatNameSpace(config.getTenant(), PerfGenieConstants.PERFGENIE, config.getBackup_namespace()),
                    0L,
                    0L);
        } catch (Exception e) {
            this.cantor.events().create(PerfGenieConstants.getMetatNameSpace(config.getTenant(), PerfGenieConstants.PERFGENIE, config.getBackup_namespace()));
        }

        if(config.getBackup_namespace() != null){
            try {
                this.cantor.events().get(
                        config.getBackup_namespace(),
                        0L,
                        0L);
                isBackupNamespaceAvailable = true;
            } catch (Exception e) {
                //this.cantor.events().create(config.getBackup_namespace());
            }
        }

    }

    public EventStore(final Cantor cantor, final Config config) throws IOException {
        this.cantor = cantor;
        this.config = config;
        try {
            this.cantor.events().get(
                    PerfGenieConstants.getEventNameSpace(config.getTenant(), PerfGenieConstants.PERFGENIE, config.getBackup_namespace()),
                    0L,
                    0L);
        } catch (Exception e) {
            this.cantor.events().create(PerfGenieConstants.getEventNameSpace(config.getTenant(), PerfGenieConstants.PERFGENIE, config.getBackup_namespace()));
        }
        try {
            this.cantor.events().get(
                    PerfGenieConstants.getLargeEventNameSpace(config.getTenant(), PerfGenieConstants.PERFGENIE, config.getBackup_namespace()),
                    0L,
                    0L);
        } catch (Exception e) {
            this.cantor.events().create(PerfGenieConstants.getLargeEventNameSpace(config.getTenant(), PerfGenieConstants.PERFGENIE, config.getBackup_namespace()));
        }
        try {
            this.cantor.events().get(
                    PerfGenieConstants.getMetatNameSpace(config.getTenant(), PerfGenieConstants.PERFGENIE, config.getBackup_namespace()),
                    0L,
                    0L);
        } catch (Exception e) {
            this.cantor.events().create(PerfGenieConstants.getMetatNameSpace(config.getTenant(), PerfGenieConstants.PERFGENIE, config.getBackup_namespace()));
        }
        if(config.getBackup_namespace() != null){
            try {
                this.cantor.events().get(
                        config.getBackup_namespace(),
                        0L,
                        0L);
                isBackupNamespaceAvailable = true;
            } catch (Exception e) {
                //this.cantor.events().create(config.getBackup_namespace());
            }
        }
    }

    public boolean addGenieEventMetaData(final long timestamp, final Map<String, String> queryMap, final Map<String, Double> dimMap, final String tenant) throws IOException {
        final Stopwatch timer = Stopwatch.createStarted();
        if (queryMap.containsKey(PerfGenieConstants.TENANT_KEY)) {
            this.cantor.events().store(
                    PerfGenieConstants.getMetatNameSpace(config.getTenant(), PerfGenieConstants.PERFGENIE, config.getBackup_namespace()),
                    timestamp,
                    queryMap,
                    dimMap,
                    null);
            logger.info("addGenieEventMetaData successfully added event metadata under namespace: " + PerfGenieConstants.getMetatNameSpace(config.getTenant(), PerfGenieConstants.PERFGENIE, config.getBackup_namespace()) + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
        } else {
            logger.error("addEvent missing value of " + PerfGenieConstants.TENANT_KEY);
            return false;
        }
        return true;
    }

    private boolean addOtherEventMetaData(final long timestamp, final Map<String, String> queryMap, final Map<String, Double> dimMap, final String namespace) throws IOException { //TODO merge this with addGenieEventMetaData
        final Stopwatch timer = Stopwatch.createStarted();
        if (queryMap.containsKey(PerfGenieConstants.TENANT_KEY)) {
            this.cantor.events().store(
                    namespace,
                    timestamp,
                    queryMap,
                    dimMap,
                    null);
            logger.info("addGenieEventMetaData successfully added event metadata under namespace: " + namespace + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
        } else {
            logger.error("addEvent missing value of " + PerfGenieConstants.TENANT_KEY);
            return false;
        }
        return true;
    }

    public boolean addGenieEvent(final long timestamp, final Map<String, String> queryMap, final Map<String, Double> dimMap, final String payload, final String tenant) throws IOException {
        final Stopwatch timer = Stopwatch.createStarted();
        if (payload != null) {
            queryMap.put("size", String.valueOf(payload.length()));
        }
        try {
            if (queryMap.containsKey(PerfGenieConstants.TENANT_KEY)) {
                //addGenieEventMetaData(timestamp, queryMap, dimMap, config.getTenant()); // ? removed, using event name space for getting metadata

                this.cantor.events().store(
                        PerfGenieConstants.getEventNameSpace(tenant, queryMap.get("source"), config.getBackup_namespace()),
                        timestamp,
                        queryMap,
                        dimMap,
                        payload != null ? Utils.compress(payload.getBytes(StandardCharsets.UTF_8)) : null);
                logger.info("addEvent successfully stored even in database under namespace: " + PerfGenieConstants.getEventNameSpace(tenant, queryMap.get("source"), config.getBackup_namespace()) + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
            } else {
                logger.error("addEvent missing value of " + PerfGenieConstants.TENANT_KEY);
                return false;
            }
        } catch (Exception e) {
            logger.error("Failed to add event " + PerfGenieConstants.getEventNameSpace(tenant, PerfGenieConstants.PERFGENIE, config.getBackup_namespace()) + " " + queryMap.toString());
            return false;
        }
        return true;
    }

    public void addGenieLargeEvent(final long timestamp, final Map<String, String> queryMap, final Map<String, Double> dimMap, final String payload, final String tenant, final String eventSource) throws IOException {
        queryMap.put("size", String.valueOf(payload.length()));
        if (eventSource != null && eventSource.contains(PerfGenieConstants.PERFGENIE)) {
            addGenieEventMetaData(timestamp, queryMap, dimMap, config.getTenant());//metadata event
        } else {
            addOtherEventMetaData(timestamp, queryMap, dimMap, PerfGenieConstants.getEventNameSpace(tenant, eventSource, config.getBackup_namespace()));//metadata event
        }
        upload(timestamp, queryMap, dimMap, payload, PerfGenieConstants.getLargeEventNameSpace(tenant, eventSource, config.getBackup_namespace()));
    }

    public void addGenieLargeEvent(final long timestamp, final Map<String, String> queryMap, final Map<String, Double> dimMap, final byte[] payload, final String tenant, final String eventSource) throws IOException {
        queryMap.put("size", String.valueOf(payload.length));
        if (eventSource != null && eventSource.contains(PerfGenieConstants.PERFGENIE)) {
            addGenieEventMetaData(timestamp, queryMap, dimMap, config.getTenant());//metadata event
        } else {
            addOtherEventMetaData(timestamp, queryMap, dimMap, PerfGenieConstants.getEventNameSpace(tenant, eventSource, config.getBackup_namespace()));//metadata event
        }
        uploadBytes(timestamp, queryMap, dimMap, payload, PerfGenieConstants.getLargeEventNameSpace(tenant, eventSource, config.getBackup_namespace()));
    }

    public void addGenieLargeEventtoNamespace(final long timestamp, final Map<String, String> queryMap, final Map<String, Double> dimMap, final byte[] payload, final String namespace, final String eventSource) throws IOException {
        queryMap.put("size", String.valueOf(payload.length));
        addOtherEventMetaData(timestamp, queryMap, dimMap, namespace);//metadata event
        uploadBytes(timestamp, queryMap, dimMap, payload, namespace);
    }

    public String getGenieTenants(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final List<String> namespaces) throws IOException {
        try {
            Long currTime = System.currentTimeMillis();
            if (tenantsCache.size() == 0 || (currTime - tenantsCacheTime) > 5 * 60 * 1000) {
                currTime = System.currentTimeMillis();
                cacheLock.lock();
                logger.warn("acquired lock at" + currTime);
                if (tenantsCache.size() == 0 || (currTime - tenantsCacheTime) > 5 * 60 * 1000) {
                    logger.warn("Updating tenantCache at " + currTime);
                    tenantsCache.clear();
                    final Collection<String> tenantst;
                    tenantst = this.cantor.objects().keys("tenants", 0, 20000);
                    for (String tenant : tenantst) {
                        tenantsCache.put(tenant, "other");
                    }
                    tenantsCacheTime = System.currentTimeMillis();
                } else {
                    logger.warn("updated at " + tenantsCacheTime);
                }
                cacheLock.unlock();
            }
        } catch (Exception e) {
            cacheLock.unlock();
            logger.warn("getTenants cantor tenants namespace does not exist");
        }

        namespaces.add(PerfGenieConstants.getMetatNameSpace(config.getTenant(), PerfGenieConstants.PERFGENIE, config.getBackup_namespace()));//1715561760005
        for (final String namespace : namespaces) {
            try {
                final List<Events.Event> results = this.cantor.events().get(
                        namespace,
                        start,
                        end,
                        queryMap,
                        dimMap,
                        false
                );
                if (results.size() > 0) {
                    for (final Events.Event result : results) {
                        if (result.getMetadata().containsKey("tenant-id")) {
                            tenantsCache.put(result.getMetadata().get("tenant-id"), PerfGenieConstants.PERFGENIE);
                        }
                    }
                }
            }catch (Exception e){
                logger.warn("getTenants cantor tenants exception " + e.getMessage());
            }
        }
        return Utils.toJson(tenantsCache);
    }

    public String getGenieInstances(final String tenant, long start, long end, final Map<String, String> queryMap) throws IOException {

        HashMap<String, String> instances = new HashMap();
        if (tenant != null) {
            if (queryMap.containsKey(PerfGenieConstants.SOURCE_KEY)) {
                try {
                    final List<Events.Event> results = this.cantor.events().get(
                            PerfGenieConstants.getMetatNameSpace(config.getTenant(), PerfGenieConstants.PERFGENIE, config.getBackup_namespace()),
                            start,
                            end,
                            Collections.emptyMap(),
                            Collections.emptyMap()
                    );

                    if (results.size() > 0) {
                        for (final Events.Event result : results) {
                            if (result.getMetadata().containsKey("host")) {
                                instances.put(result.getMetadata().get("host"), PerfGenieConstants.PERFGENIE);
                            }
                        }
                    }
                } catch (final IOException exception) {
                    logger.warn("exception while getting instances from " + PerfGenieConstants.getLargeEventNameSpace(tenant, PerfGenieConstants.PERFGENIE, config.getBackup_namespace()));
                }
            } else {
                try {
                    final Collection<String> instances1 = this.cantor.events().metadata(
                            String.format("maiev-heartbeat-%s", tenant),
                            "instance-id",
                            start,
                            end,
                            Collections.emptyMap(),
                            Collections.emptyMap());
                    for (String s : instances1) {
                        instances.put(s, "other");
                    }
                } catch (final IOException exception) {
                    logger.warn("exception while getting instances from namespace" + String.format("maiev-heartbeat-%s", tenant));
                }
            }
        }
        return Utils.toJson(instances);
    }

    private boolean writeEventToFile(final Events.Event event, final Map<String, String> dimMap, final String from_namespace, final String filePath){
        try {
            final List<Events.Event> results1 = this.cantor.events().get(
                    from_namespace,
                    event.getTimestampMillis() - 1,
                    event.getTimestampMillis() + 1,
                    event.getMetadata(),
                    dimMap,
                    true
            );
            if (results1.size() > 0) {
                logger.info("backup event : " + results1.get(0).getMetadata().toString());
                Path path = Paths.get(filePath);
                Files.write(path, results1.get(0).getPayload());
                Path path1 = Paths.get(filePath+".meta");
                Files.write(path1, Utils.toJson(results1.get(0).getMetadata()).getBytes());
                Path path2 = Paths.get(filePath+".dimension");
                Files.write(path2, Utils.toJson(results1.get(0).getDimensions()).getBytes());
                return true;
            }else{
                logger.info("backup source event not found : " + event.getMetadata().toString());
            }
        }catch(IOException e){
            return false;
        }
        return false;
    }
    private boolean backupEvent(final Events.Event event, final Map<String, String> dimMap, final String from_namespace, final String to_namespace){
        try {
            final List<Events.Event> results1 = this.cantor.events().get(
                    from_namespace,
                    event.getTimestampMillis() - 1,
                    event.getTimestampMillis() + 1,
                    event.getMetadata(),
                    dimMap,
                    true
            );
            if (results1.size() > 0) {
                logger.info("backup event : " + results1.get(0).getMetadata().toString());
                this.cantor.events().store(
                        to_namespace,
                        results1.get(0).getTimestampMillis(),
                        results1.get(0).getMetadata(),
                        results1.get(0).getDimensions(),
                        results1.get(0).getPayload());
                return true;
            }else{
                logger.info("backup source event not found : " + event.getMetadata().toString());
            }
        }catch(IOException e){
            return false;
        }
        return false;
    }
    private boolean backupLargeEvent(final Events.Event event, final Map<String, String> dimMap, final String from_namespace, final String to_namespace){
        try {
            final Map<String, String> queryMap = new HashMap<>();
            queryMap.put("guid", event.getMetadata().get("guid"));
            queryMap.put("tenant-id", event.getMetadata().get("tenant-id"));
            queryMap.put("instance-id", event.getMetadata().get("instance-id"));
            queryMap.put("host", event.getMetadata().get("host"));
            queryMap.put("file-name", event.getMetadata().get("file-name"));

            logger.info("backup large event : " + event.getMetadata().toString());
            final byte[] bytes = downloadBytes(event.getTimestampMillis()-1,event.getTimestampMillis()+1,queryMap, dimMap,from_namespace);
            final Map<String, Double> tmpdimMap = new HashMap<>();
            tmpdimMap.putAll(event.getDimensions());
            queryMap.put("name", "jfr");
            tmpdimMap.put("file-length", (double) bytes.length);
            queryMap.put(".is-large-file", "true");
            addGenieLargeEventtoNamespace(event.getTimestampMillis(), queryMap, tmpdimMap, bytes, to_namespace, queryMap.get(PerfGenieConstants.SOURCE_KEY));
            return true;
        }catch(IOException e){
            return false;
        }
    }
    private byte[] downloadBytes(final long startTimestamp, final long endTimestamp, final Map<String,
            String> metadataQuery, final Map<String, String> dimensionsQuery, final String namespace) throws IOException {

        logger.info("Started downloading bytes {}", metadataQuery);
        if (namespace != null) {
            try {
                final DownloadIterator iterator = new DownloadIterator(namespace, startTimestamp, endTimestamp, metadataQuery, dimensionsQuery);
                ByteArrayOutputStream outStream = new ByteArrayOutputStream();
                while (iterator.hasNext()) {
                    final Events.Event event = iterator.next();
                    outStream.write(event.getPayload());
                    outStream.flush();
                }
                logger.info("Completed downloading bytes {}", metadataQuery);
                return outStream.toByteArray();
            } catch (Exception e) {
                logger.error("Failed to download bytes from {}  {}", namespace, metadataQuery);
                e.printStackTrace();
            }
        }
        return null;
    }

    public boolean downlaodAllEvents(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final String tenant, final String instance, final String fileName) throws IOException {

        Instant instantS = Instant.ofEpochMilli(start);
        Instant instantE = Instant.ofEpochMilli(end);
        // Format the Instant to a human-readable string in UTC (using ZoneOffset.UTC)
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss").withZone(ZoneOffset.UTC);
        formatter.format(instantS);

        String filePath = System.getProperty("java.io.tmpdir") + "/" +  formatter.format(instantS) + "_to_" + formatter.format(instantE) + "-" + instance;
        Utils.createDirectoryIfNotExists(filePath);
        //downloadToFile
        List<String>  list = new ArrayList<>();
        if (tenant != null && instance != null) {
            String namespace = PerfGenieConstants.getEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());//queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? NAMESPACE_EVENT_META : PerfGenieConstants.getEventNameSpace(tenant, false, config.getBackup_namespace());
            String largenamespace = PerfGenieConstants.getLargeEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());//queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? NAMESPACE_EVENT_META : PerfGenieConstants.getLargeEventNameSpace(tenant, false, config.getBackup_namespace());
            queryMap.put("tenant-id", tenant);
            queryMap.put("instance-id", instance);
            final List<Events.Event> results = this.cantor.events().get(
                    namespace,
                    start,
                    end,
                    queryMap,
                    dimMap,
                    false
            );
            if (results.size() != 0) {
                HashSet <String> skipEvents = new HashSet<>();
                HashSet backupEvents = config.getBackupEvents();
                for (final Events.Event result : results) {
                    //TODO: support heap dumps and other large files
                    if(((result.getMetadata().containsKey("name") && backupEvents.contains(result.getMetadata().get("name"))) || (result.getMetadata().containsKey("file-name") && backupEvents.contains(result.getMetadata().get("file-name")))) && (!result.getMetadata().containsKey("file-name") || (result.getMetadata().get("file-name").contains("json")) || result.getMetadata().get("file-name").contains("jfr.gz"))) {
                        String fileNameToWrite = filePath + "/" + result.getTimestampMillis() + "-" + (result.getMetadata().containsKey("name") ? result.getMetadata().get("name") : "NA") + "-" + (result.getMetadata().containsKey("file-name") ? result.getMetadata().get("file-name") : "NA");
                        File file = new File(fileNameToWrite);
                        if(file.exists()) {
                            list.add("download exists for event:"  + Utils.getDateTimeString(result.getTimestampMillis()) + ":"+  result.getMetadata().get("name"));
                            logger.info("download exists for event " + Utils.getDateTimeString(result.getTimestampMillis()) + ":"+ result.getMetadata().toString());
                        }else{
                            if (result.getMetadata().containsKey(".is-large-file") && result.getMetadata().get(".is-large-file").equals("true")) {
                                final Map<String, String> metadata = new HashMap<>();
                                metadata.put("host","=" + result.getMetadata().get("host"));
                                metadata.put("file-name","=" + result.getMetadata().get("file-name"));
                                metadata.put("guid","=" + result.getMetadata().get("guid"));
                                metadata.put("tenant-id","=" + result.getMetadata().get("tenant-id"));
                                downloadToFile(result.getTimestampMillis(), result.getTimestampMillis(), metadata, dimMap, largenamespace, fileNameToWrite);
                                Path path1 = Paths.get(fileNameToWrite+".meta");
                                Files.write(path1, Utils.toJson(result.getMetadata()).getBytes());
                                Path path2 = Paths.get(fileNameToWrite+".dimension");
                                Files.write(path2, Utils.toJson(result.getDimensions()).getBytes());
                            } else {
                                if (writeEventToFile(result, dimMap, namespace, fileNameToWrite)) {
                                    list.add("download success for event:"  + Utils.getDateTimeString(result.getTimestampMillis()) + ":"+ result.getMetadata().get("name"));
                                } else {
                                    list.add("download failed for event:"  + Utils.getDateTimeString(result.getTimestampMillis()) + ":" + result.getMetadata().get("name"));
                                }
                            }
                        }
                    }else{
                        list.add("skip download for event:"  + Utils.getDateTimeString(result.getTimestampMillis()) + ":"+ result.getMetadata().get("name"));
                    }
                }
                list.add("successfully downloaded");

                logger.info("successfully downloaded");
            }
            String resultFile = filePath + "/result.txt";
            Path resPath = Paths.get(resultFile);
            Files.write(resPath, list);
            Utils.createTarGzFromFolder(filePath, filePath+".tar.gz");
            return true;
        }else{
            list.add("Error: need tenant and host as input");
            String resultFile = filePath + "/result.txt";
            Path resPath = Paths.get(resultFile);
            Files.write(resPath, list);
            logger.error("Error: need tenant and host as input");
        }
        return true;
    }

    //TODO this will not work for Genie, metadata namespace need to be fixed
    public String backupEvents(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final String tenant, final String instance) throws IOException {
        List list = new ArrayList<>();
        if (tenant != null && instance != null) {
            String namespace = PerfGenieConstants.getEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());//queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? NAMESPACE_EVENT_META : PerfGenieConstants.getEventNameSpace(tenant, false, config.getBackup_namespace());
            String largenamespace = PerfGenieConstants.getLargeEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());//queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? NAMESPACE_EVENT_META : PerfGenieConstants.getLargeEventNameSpace(tenant, false, config.getBackup_namespace());
            queryMap.put("tenant-id", tenant);
            queryMap.put("instance-id", instance);
            final List<Events.Event> results = this.cantor.events().get(
                    namespace,
                    start,
                    end,
                    queryMap,
                    dimMap,
                    false
            );
            if (results.size() != 0) {
                //get backup list to check if it already exists
                final List<Events.Event> backupresults = this.cantor.events().get(
                        config.getBackup_namespace(),
                        start,
                        end,
                        queryMap,
                        dimMap,
                        false
                );
                HashSet <String> skipEvents = new HashSet<>();
                for (final Events.Event result : backupresults) {
                    skipEvents.add(result.getMetadata().get("guid"));
                }
                HashSet backupEvents = config.getBackupEvents();
                for (final Events.Event result : results) {
                    //TODO: support heap dumps and other large files
                    if(((result.getMetadata().containsKey("name") && backupEvents.contains(result.getMetadata().get("name"))) || (result.getMetadata().containsKey("file-name") && backupEvents.contains(result.getMetadata().get("file-name")))) && (!result.getMetadata().containsKey("file-name") || (result.getMetadata().get("file-name").contains("json")) || result.getMetadata().get("file-name").contains("jfr.gz"))) {
                        if(skipEvents.contains(result.getMetadata().get("guid"))) {
                            list.add("<span style=\"color:green\">backup exists for event: </span>"  + Utils.getDateTimeString(result.getTimestampMillis()) + ":"+  result.getMetadata().get("name"));
                            logger.info("backup exists for event " + Utils.getDateTimeString(result.getTimestampMillis()) + ":"+ result.getMetadata().toString());
                        }else{
                            if (result.getMetadata().containsKey(".is-large-file") && result.getMetadata().get(".is-large-file").equals("true")) {
                                if (backupLargeEvent(result, dimMap, largenamespace, config.getBackup_namespace())) {
                                    list.add("<span style=\"color:green\">backup success for large event: </span>" + Utils.getDateTimeString(result.getTimestampMillis()) + ":"+  result.getMetadata().get("name"));
                                } else {
                                    list.add("<span style=\"color:red\">backup failed for large event:</span> "  + Utils.getDateTimeString(result.getTimestampMillis()) + ":" + result.getMetadata().get("name"));
                                }
                            } else {
                                if (backupEvent(result, dimMap, namespace, config.getBackup_namespace())) {
                                    list.add("<span style=\"color:green\">backup success for event: </span>"  + Utils.getDateTimeString(result.getTimestampMillis()) + ":"+ result.getMetadata().get("name"));
                                } else {
                                    list.add("<span style=\"color:red\">backup failed for event: </span>"  + Utils.getDateTimeString(result.getTimestampMillis()) + ":" + result.getMetadata().get("name"));
                                }
                            }
                        }
                    }else{
                        list.add("<span style=\"color:orange\">skip backup for event: </span>"  + Utils.getDateTimeString(result.getTimestampMillis()) + ":"+ result.getMetadata().get("name"));
                    }
                }
                logger.info("successfully backed up to " + config.getBackup_namespace());
            }
            return Utils.toJson(list);
        }else{
            return "[\"Error: need tenant and host as input\"]";
        }
    }

    public String getGenieGoldMeta(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException {
        String namespace = config.getBackup_namespace();
        final List<Events.Event> results = this.cantor.events().get(
                namespace,
                start,
                end,
                queryMap,
                dimMap,
                false
        );
        if (results.size() != 0) {
            logger.info("getMeta successfully fetched metadata from namespace: " + namespace);
            return Utils.toJson(results);
        }
        return Utils.toJson(results);
    }
    public String getGenieMeta(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final String tenant, final String instance) throws IOException {
        if (tenant != null && instance != null) {
            String namespace = PerfGenieConstants.getEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());//queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? NAMESPACE_EVENT_META : PerfGenieConstants.getEventNameSpace(tenant, false, config.getBackup_namespace());
            queryMap.put("tenant-id", tenant);
            queryMap.put("instance-id", instance);
            final List<Events.Event> results = this.cantor.events().get(
                    namespace,
                    start,
                    end,
                    queryMap,
                    dimMap,
                    false
            );
            if (results.size() != 0) {
                logger.info("getMeta successfully fetched metadata from namespace: " + namespace);
                return Utils.toJson(results);
            }
        }
        return "";
    }

    public static boolean waitForFile(final String filePath, long timeout) throws IOException, InterruptedException {
        long maxWaitSec = timeout * 60 * 1000;
        long checkInterval = 1000; // 1 second
        long startTime = System.currentTimeMillis();
        File file = new File(filePath);
        while (System.currentTimeMillis() - startTime < maxWaitSec) {
            if (file.exists()) {
                return true;
            }
            try {
                Thread.sleep(checkInterval);
            } catch (InterruptedException e) {
                System.err.println("Thread was interrupted.");
            }
        }
        return false;
    }

    private void addGenieLargeEventFromFile(final long timestamp, final Map<String, String> queryMap, final String tenant, final String file) throws IOException {
        final String uploaded = config.getJfrdir() + "/" + file.replaceAll(".json", ".done");
        File check = new File(uploaded);
        if (check.exists()) {
            logger.info("Upload tried once : " + uploaded);
            return;
        }

        final Map<String, Double> dimMap = new HashMap<>();
        final Map<String, String> queryMapTmp = new HashMap<>();

        final String filePath = config.getJfrdir() + "/" + file;
        final byte[] payload = Utils.compress(Files.readAllBytes(Paths.get(filePath)));
        dimMap.put("file-length", (double) payload.length);
        queryMapTmp.put("host", queryMap.get("host").replaceAll("^=", ""));
        queryMapTmp.put("instance-id", queryMap.get("host").replaceAll("^=", ""));
        queryMapTmp.put("guid", queryMap.get("guid").replaceAll("^=", "") + file.replaceAll("^\\d+", "") + ".gz");
        queryMapTmp.put("tenant-id", queryMap.get("tenant-id").replaceAll("^=", ""));
        queryMapTmp.put("name", "jfr");
        queryMapTmp.put("file-name", file.replaceAll("^\\d+", "") + ".gz");
        queryMapTmp.put(".is-large-file", "true");

        logger.info("Uploading parsed event: " + file + ":" + queryMapTmp + ":" + dimMap);
        //add an upload flag
        check.createNewFile();
        addGenieLargeEvent(timestamp, queryMapTmp, dimMap, payload, tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY)); //TODO use correct destination

        /*
        Uploading parsed event: 1730959240745jfr_dump_socket.json:
        {
        instance-id=sdb34-casam-app-green-b5f79dcd4-t4hjt,
        host=sdb34-casam-app-green-b5f79dcd4-t4hjt,
        name=jfr, guid=434adba3-e7ca-4af7-99aa-a47415379968jfr_dump_socket.json.gz,
        file-name=jfr_dump_socket.json.gz,
        tenant-id=falcon-perf1-useast2-core1-sdb34,
        .is-large-file=true
        }
        {file-length=284165.0}
//needed
{
  "timestampMillis": 1730994142867,
  "metadata": {
    "instance-id": "ind64-casam-app-blue-59d597f9cd-l8lrq",
    "host": "ind64-casam-app-blue-59d597f9cd-l8lrq",
    "name": "jfr",
    "guid": "94f5fdff-8af6-4741-94d3-9f95bfc82aa0jfr_dump.json.gz",
    "file-name": "jfr_dump.json.gz",
    "tenant-id": "falcon-aws-prod2-apsouth1-core1-ind64",
    ".is-large-file": "true",
  },
  "dimensions": {
    ".maiev-event-payload-size": 0,
    "file-length": 7830098,
    "chunk-total": 1
  },
  "payload": ""
}
         */
    }

    public String getGenieLargeEvent(final long start, final long end, final Map<String,
            String> queryMap, final Map<String, String> dimMap, final String tenant) throws IOException {

        String namespace = PerfGenieConstants.getLargeEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());//queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getLargeEventNameSpace(tenant, true, config.getBackup_namespace()) : PerfGenieConstants.getLargeEventNameSpace(tenant, false, config.getBackup_namespace());
        final Stopwatch timer = Stopwatch.createStarted();
        try {
            if (queryMap.containsKey("file-name") && queryMap.get("file-name").contains(".jfr.gz")) {
                final String filepath = config.getJfrdir() + "/" + Long.toString(start);
                queryMap.put("guid", queryMap.get("guid").replace(queryMap.get("file-name").replace("=", ""), ""));
                if (downloadToFile(start, end, queryMap, dimMap, namespace, filepath + ".tmp")) {
                    File f = new File(filepath + "jfr_dump.json");
                    if (!f.exists()) {
                        executor.addCommand("java -Xloggc:" + config.getJfrdir() + "/jfrparsergc.log -XX:ErrorFile=" + config.getJfrdir() + "/jfrparser_error.log -XX:ParallelGCThreads=8 -XX:+PrintGCDetails -XX:NewSize=400m -XX:MaxNewSize=400m -Xms7G -Xmx7G  -cp " + config.getJfrparser() + " Parser -c -jfr " + filepath + ".tmp  -timeout 90000 -timestamp " + start * 1000000 + " -json " + filepath + "jfr_dump.json");
                    }
                    if (waitForFile(filepath + "jfr_dump.json", 2)) {
                        logger.info("successfully parsed jfr: " + queryMap + " time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
                        final HashMap<String, String> profiles = new HashMap();
                        Thread.sleep(5000);//let parser create all files
                        File folder = new File(config.getJfrdir());
                        File[] listOfFiles = folder.listFiles();
                        if (listOfFiles != null) {
                            for (File file : listOfFiles) {
                                if (file.getName().contains(Long.toString(start))) {
                                    String tmpfileName = file.getName();
                                    if (!(tmpfileName.contains("_sql.json") || tmpfileName.contains(".tmp"))) {
                                        if (tmpfileName.contains(".json")) {
                                            tmpfileName = tmpfileName.replace(Long.toString(start), "");
                                            profiles.put(tmpfileName + ".gz", Long.toString(start) + " - " + queryMap.get("guid").replaceAll("^=", ""));
                                            addGenieLargeEventFromFile(start, queryMap, tenant, file.getName());
                                        }
                                    }
                                }
                            }
                            return Utils.toJson(profiles);
                        } else {
                            return Utils.toJson(new EventHandler.JfrParserResponse(null, "parsed json not found", queryMap, null));
                        }
                    } else {
                        return Utils.toJson(new EventHandler.JfrParserResponse(null, "Failed to parse jfr", queryMap, null));
                    }
                } else {
                    return Utils.toJson(new EventHandler.JfrParserResponse(null, "Failed to download jfr", queryMap, null));
                }
            } else {
                String res = download(start, end, queryMap, dimMap, namespace);
                logger.info("successfully fetched event from namespace: " + namespace + " time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
                return res;
            }
        } catch (Exception e) {
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Event not found", queryMap, null));
        }
    }

    public String getGenieEvent(final long start, final long end, final Map<String,
            String> queryMap, final Map<String, String> dimMap, final String tenant) throws IOException {

        final Stopwatch timer = Stopwatch.createStarted();
        String namespace = PerfGenieConstants.getEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());//queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getEventNameSpace(tenant, true, config.getBackup_namespace()) : PerfGenieConstants.getEventNameSpace(tenant, false, config.getBackup_namespace());
        final List<Events.Event> results = this.cantor.events().get(
                namespace,
                start - 1,
                end + 1,
                queryMap,
                dimMap,
                true
        );
        if (results.size() > 0) {
            String res = new String(Utils.decompress(results.get(0).getPayload()));
            logger.info("successfully fetched event from namespace: " + namespace + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
            return res;
        } else {
            logger.warn("failed to fetch event from namespace: " + namespace + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
        }
        return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Event not found", queryMap, null));
    }

    //done
    /*public boolean addEvent(final long timestamp, final Map<String, String> queryMap, final Map<String, Double> dimMap, final String payload, final String tenant) throws IOException {
        final Stopwatch timer = Stopwatch.createStarted();
        queryMap.put("size", String.valueOf(payload.length()));

        if (enableLargeFile && payload.length() > LARGE_FILE_SIZE) {
            addMeta(timestamp, dimMap, queryMap,tenant);
            upload(timestamp, queryMap, dimMap, payload, PerfGenieConstants.getLargeEventNameSpace(tenant, true));
        } else {
            if(queryMap.containsKey(PerfGenieConstants.TENANT_KEY)) {
                this.cantor.events().store(
                        PerfGenieConstants.getEventNameSpace(tenant,true),
                        timestamp,
                        queryMap,
                        dimMap,
                        Utils.compress(payload.getBytes(StandardCharsets.UTF_8)));
                logger.info("addEvent successfully stored even in database under namespace: " + PerfGenieConstants.getEventNameSpace(tenant,true) + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
            }else{
                logger.error("addEvent missing value of " + PerfGenieConstants.TENANT_KEY);
                return false;
            }
        }
        return true;
    }*/

    //done
   /* public boolean addMeta(final long timestamp, final Map<String, Double> dimMap, final Map<String, String> queryMap, final String tenant) throws IOException {
        final Stopwatch timer = Stopwatch.createStarted();
        String namespace = PerfGenieConstants.getEventNameSpace(tenant, true);
        this.cantor.events().store(
                namespace,
                timestamp,
                queryMap,
                dimMap,
                null);
        logger.info("addMeta successfully stored metadata in database under namespace: " + namespace + " time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));

        return true;
    }*/

    public List getGeniePayLoads(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final boolean payload) throws IOException {
        String namespace = PerfGenieConstants.getEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());//queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getEventNameSpace(tenant, true, config.getBackup_namespace()) : PerfGenieConstants.getEventNameSpace(tenant, false, config.getBackup_namespace());
        final List<Events.Event> results = this.cantor.events().get(
                namespace,
                start,
                end,
                queryMap,
                dimMap,
                payload
        );
        if (results.size() > 0) {
            List<String> payloads = new ArrayList<>();
            results.sort(Comparator.comparing(Events.Event::getTimestampMillis));
            for (final Events.Event result : results) {
                payloads.add(new String(Utils.decompress(result.getPayload())));
            }
            return payloads;
        }
        return null;
    }

    public List getCanaryLenses(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final boolean payload) throws IOException {
        String namespace = PerfGenieConstants.getEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());//queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getEventNameSpace(tenant, true, config.getBackup_namespace()) : PerfGenieConstants.getEventNameSpace(tenant, false, config.getBackup_namespace());
        final List<Events.Event> results = this.cantor.events().get(
                namespace,
                start,
                end,
                queryMap,
                dimMap,
                payload
        );
        if (results.size() > 0) {
            List<String> comments = new ArrayList<>();//timestamp payload map
            results.sort(Comparator.comparing(Events.Event::getTimestampMillis));
            for (final Events.Event result : results) {
                comments.add( new String(Utils.decompress(result.getPayload())));
            }
            return comments;
        }
        return null;
    }

    public List getCanaryComments(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final boolean payload) throws IOException {
        String namespace = PerfGenieConstants.getEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());//queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getEventNameSpace(tenant, true, config.getBackup_namespace()) : PerfGenieConstants.getEventNameSpace(tenant, false, config.getBackup_namespace());
        final List<Events.Event> results = this.cantor.events().get(
                namespace,
                start,
                end,
                queryMap,
                dimMap,
                payload
        );
        if (results.size() > 0) {
            List<String> comments = new ArrayList<>();//timestamp payload map
            results.sort(Comparator.comparing(Events.Event::getTimestampMillis));
            for (final Events.Event result : results) {
                comments.add( new String(Utils.decompress(result.getPayload())));
            }
            return comments;
        }
        return null;
    }

    public Map getOtherPayLoads(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final boolean payload) throws IOException {
        String namespace = PerfGenieConstants.getEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());//queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getEventNameSpace(tenant, true, config.getBackup_namespace()) : PerfGenieConstants.getEventNameSpace(tenant, false, config.getBackup_namespace());
        final List<Events.Event> results = this.cantor.events().get(
                namespace,
                start,
                end,
                queryMap,
                dimMap,
                payload
        );
        if (results.size() > 0) {
            Map<Long, String> payloads = new HashMap<>();//timestamp payload map
            results.sort(Comparator.comparing(Events.Event::getTimestampMillis));
            for (final Events.Event result : results) {
                payloads.put(result.getTimestampMillis(), new String(Utils.decompress(result.getPayload())));
            }
            return payloads;
        }
        return null;
    }

    public HashMap<String,ArrayList<String>> getPidStatPayLoads(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final boolean payload, int limit) throws IOException {
        String namespace = PerfGenieConstants.getEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());
        long queryWindowLimit = 1*60*60*1000; // 1 hour in milliseconds
        
        // Calculate time range
        long timeRange = end - start;
        
        // If time range is within limit, process normally
        if (timeRange <= queryWindowLimit) {
            return getPidStatPayLoadsForWindow(tenant, start, end, queryMap, dimMap, payload, limit, namespace);
        }
        
        // Break into smaller windows and process each
        HashMap<String, ArrayList<String>> combinedPayloads = new HashMap<>();
        HashMap<String, Boolean> isProcessed = new HashMap<>();
        int totalCount = 0;
        boolean hasFailure = false;
        
        long windowStart = start;
        while (windowStart < end) {
            long windowEnd = Math.min(windowStart + queryWindowLimit, end);
            
            logger.info("Processing time window: {} to {} (window size: {} ms)", 
                windowStart, windowEnd, (windowEnd - windowStart));
            
            // Process this window
            HashMap<String, ArrayList<String>> windowPayloads;
            try {
                windowPayloads = getPidStatPayLoadsForWindow(
                    tenant, windowStart, windowEnd, queryMap, dimMap, payload, limit, namespace);
            } catch (Exception e) {
                logger.error("Error processing window {} to {}", windowStart, windowEnd, e);
                hasFailure = true;
                break;
            }
            
            // If window processing returned null, it indicates a failure
            if (windowPayloads == null) {
                logger.error("Window processing returned null for window {} to {}", windowStart, windowEnd);
                hasFailure = true;
                break;
            }
            
            // Combine payloads from this window
            for (Map.Entry<String, ArrayList<String>> entry : windowPayloads.entrySet()) {
                String host = entry.getKey();
                ArrayList<String> hostPayloads = entry.getValue();
                
                if (!combinedPayloads.containsKey(host)) {
                    combinedPayloads.put(host, new ArrayList<>());
                }
                combinedPayloads.get(host).addAll(hostPayloads);
                
                // Track processed hosts for limit check
                if (!isProcessed.containsKey(host)) {
                    isProcessed.put(host, true);
                    totalCount++;
                }
            }
            
            // Check if we've reached the limit
            if (totalCount >= limit) {
                logger.info("Reached host limit ({}) after processing window {} to {}", limit, windowStart, windowEnd);
                break;
            }
            
            windowStart = windowEnd;
        }
        
        // Return null if any failure occurred
        if (hasFailure) {
            logger.error("getPidStatPayLoads: Returning null due to failure in window processing");
            return null;
        }
        
        return combinedPayloads.isEmpty() ? null : combinedPayloads;
    }
    
    /**
     * Helper method to get pidstat payloads for a single time window
     * Uses parallel execution to process multiple hosts concurrently
     */
    private HashMap<String,ArrayList<String>> getPidStatPayLoadsForWindow(
            final String tenant, final long start, final long end, 
            final Map<String, String> queryMap, final Map<String, String> dimMap, 
            final boolean payload, int limit, final String namespace) throws IOException {
        
        // Create a copy of queryMap to avoid modifying the original
        Map<String, String> windowQueryMap = new HashMap<>(queryMap);
        
        // Check disk cache before making the first call (metadata call)
        List<Events.Event> results1;
        try {
            results1 = DiskCache.getCache(namespace, start, end, windowQueryMap);
            
            if (results1 == null) {
                // Cache miss - fetch from cantor
                results1 = this.cantor.events().get(
                namespace,
                start,
                end,
                        windowQueryMap,
                dimMap,
                false
        );
                // Store in cache
                if (results1 != null && results1.size() > 0) {
                    DiskCache.setCache(namespace, start, end, windowQueryMap, results1);
                }
            }
        } catch (Exception e) {
            logger.error("Error fetching metadata events for window {} to {}", start, end, e);
            return null;
        }
        
        if (results1 == null || results1.isEmpty()) {
            logger.warn("No metadata events found for window {} to {}", start, end);
            return null;
        }
        
        // Use thread-safe collections for parallel processing
        ConcurrentHashMap<String, ArrayList<String>> payloads = new ConcurrentHashMap<>();
        ConcurrentHashMap<String, Boolean> isProcessed = new ConcurrentHashMap<>();
        AtomicInteger count = new AtomicInteger(0);
        AtomicInteger processedCount = new AtomicInteger(0);
        
        // Create ParallelExecutor with concurrency limit (default: 10, can be configured)
        int concurrencyLimit = 8; // Can be made configurable via config
        ParallelExecutor executor = new ParallelExecutor(concurrencyLimit);
        
        try {
            // Collect unique hosts
            Set<String> uniqueHosts = new HashSet<>();
            for (final Events.Event result1 : results1) {
                String host = result1.getMetadata().get("host");
                if (host != null && !uniqueHosts.contains(host)) {
                    uniqueHosts.add(host);
                }
            }
            
            logger.info("Processing {} unique hosts in parallel with concurrency limit: {}", uniqueHosts.size(), concurrencyLimit);
            
            // Create tasks for each host
            List<Callable<HostPayloadResult>> tasks = new ArrayList<>();
            for (final String host : uniqueHosts) {
                tasks.add(new HostPayloadTask(host, namespace, start, end, windowQueryMap, dimMap, payload, count, isProcessed));
            }
            
            // Execute all tasks in parallel
            List<Future<HostPayloadResult>> futures = executor.invokeAll(tasks);
            
            // Track if any task failed
            boolean hasFailure = false;
            int expectedHostCount = uniqueHosts.size();
            int processedHostCount = 0;
            
            // Process results - if any task fails, mark as failure
            for (Future<HostPayloadResult> future : futures) {
                try {
                    // Skip if already failed
                    if (hasFailure) {
                        future.cancel(true);
                        continue;
                    }
                    
                    HostPayloadResult result = future.get();
                    processedHostCount++;
                    
                    if (result != null && result.payloads != null && !result.payloads.isEmpty()) {
                        // Merge results into the main payloads map
                        String host = result.host;
                        payloads.putIfAbsent(host, new ArrayList<>());
                        payloads.get(host).addAll(result.payloads);
                        processedCount.incrementAndGet();
                    } else {
                        // Task returned null or empty - this indicates a failure
                        logger.error("Host payload task returned null or empty result for host: {}", 
                            result != null ? result.host : "unknown");
                        hasFailure = true;
                        continue;
                    }
                    
                    // Check if we've reached the limit
                    if (processedCount.get() >= limit) {
                        logger.info("Reached host limit ({}) during parallel processing", limit);
                        // Cancel remaining tasks
                        for (Future<HostPayloadResult> f : futures) {
                            if (!f.isDone()) {
                                f.cancel(true);
                            }
                        }
                        break;
                    }
                } catch (ExecutionException e) {
                    logger.error("Error processing host payload task", e.getCause());
                    hasFailure = true;
                    processedHostCount++;
                } catch (CancellationException e) {
                    logger.debug("Task was cancelled (expected when limit reached or failure occurred)");
                    // Cancellation is expected when limit is reached or failure occurred
                }
            }
            
            // Verify all expected hosts were processed (unless limit was reached)
            if (!hasFailure && processedHostCount < expectedHostCount && processedCount.get() < limit) {
                logger.error("Not all hosts were processed. Expected: {}, Processed: {}", expectedHostCount, processedHostCount);
                hasFailure = true;
            }
            
            // If any task failed, return null
            if (hasFailure) {
                logger.error("getPidStatPayLoadsForWindow: Returning null due to task failure. Processed {}/{} hosts", 
                    processedHostCount, expectedHostCount);
                return null;
            }
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logger.error("Parallel processing interrupted", e);
            return null;
        } catch (Exception e) {
            logger.error("Unexpected error in parallel processing", e);
            return null;
        } finally {
            executor.shutdown();
            try {
                if (!executor.awaitTermination(60, TimeUnit.SECONDS)) {
                    logger.warn("ParallelExecutor did not terminate within timeout");
                    executor.shutdownNow();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                executor.shutdownNow();
            }
        }
        
        return payloads.isEmpty() ? null : new HashMap<>(payloads);
    }
    
    /**
     * Result class for host payload processing
     */
    private static class HostPayloadResult {
        final String host;
        final ArrayList<String> payloads;
        
        HostPayloadResult(String host, ArrayList<String> payloads) {
            this.host = host;
            this.payloads = payloads;
        }
    }
    
    /**
     * Callable task for processing a single host's payloads
     */
    private class HostPayloadTask implements Callable<HostPayloadResult> {
        private final String host;
        private final String namespace;
        private final long start;
        private final long end;
        private final Map<String, String> windowQueryMap;
        private final Map<String, String> dimMap;
        private final boolean payload;
        private final AtomicInteger count;
        private final ConcurrentHashMap<String, Boolean> isProcessed;
        
        HostPayloadTask(String host, String namespace, long start, long end,
                       Map<String, String> windowQueryMap, Map<String, String> dimMap,
                       boolean payload, AtomicInteger count,
                       ConcurrentHashMap<String, Boolean> isProcessed) {
            this.host = host;
            this.namespace = namespace;
            this.start = start;
            this.end = end;
            this.windowQueryMap = windowQueryMap;
            this.dimMap = dimMap;
            this.payload = payload;
            this.count = count;
            this.isProcessed = isProcessed;
        }
        
        @Override
        public HostPayloadResult call() throws Exception {
            // Check if already processed (thread-safe check)
            if (isProcessed.putIfAbsent(host, true) != null) {
                // Already being processed by another thread
                return null;
            }
            
            int currentCount = count.incrementAndGet();
            logger.debug("Processing host: {} (count: {})", host, currentCount);
            
            // Create a new queryMap with host for this specific query
            Map<String, String> hostQueryMap = new HashMap<>(windowQueryMap);
            hostQueryMap.put("host", "=" + host);
            
            // Check disk cache before making the call
            List<Events.Event> results = DiskCache.getCache(namespace, start, end, hostQueryMap);
            
            if (results == null) {
                // Cache miss - fetch from cantor
                try {
                    results = cantor.events().get(
                            namespace,
                            start,
                            end,
                            hostQueryMap,
                            dimMap,
                            payload
                    );
                    // Store in cache
                    if (results != null && results.size() > 0) {
                        DiskCache.setCache(namespace, start, end, hostQueryMap, results);
                    }
                } catch (IOException e) {
                    logger.error("Error fetching events for host: {}", host, e);
                    throw new RuntimeException("Failed to fetch events for host: " + host, e);
                } catch (Exception e) {
                    logger.error("Unexpected error fetching events for host: {}", host, e);
                    throw new RuntimeException("Unexpected error fetching events for host: " + host, e);
                }
            }
            
            if (results == null || results.isEmpty()) {
                logger.warn("No events found for host: {}", host);
                throw new RuntimeException("No events found for host: " + host);
            }
            
            // Sort by timestamp
            results.sort(Comparator.comparing(Events.Event::getTimestampMillis));
            
            ArrayList<String> hostPayloads = new ArrayList<>();
            for (final Events.Event result : results) {
                try {
                    hostPayloads.add(new String(Utils.decompress(result.getPayload())));
                } catch (Exception e) {
                    logger.error("Error decompressing payload for host: {}", host, e);
                    throw new RuntimeException("Failed to decompress payload for host: " + host, e);
                }
            }
            
            if (hostPayloads.isEmpty()) {
                logger.warn("No payloads extracted for host: {}", host);
                throw new RuntimeException("No payloads extracted for host: " + host);
            }
            
            logger.debug("Completed processing host: {} with {} payloads", host, hostPayloads.size());
            return new HostPayloadResult(host, hostPayloads);
        }
    }

    public Collection<com.salesforce.cantor.Events.Event> getHeartbeatEvents(final String tenant, final String instanceId, final long startTimestamp, final long endTimestamp) {
        try {
            return this.cantor.events().get(
                    String.format("maiev-heartbeat-%s", tenant),
                    startTimestamp,
                    endTimestamp,
                    ImmutableMap.of("instance-id", instanceId),
                    Collections.emptyMap());
        } catch (final IOException exception) {
            logger.warn("exception while getting heartbeat events: tenant={} instance={} start={} end={}",
                    tenant, instanceId, startTimestamp, endTimestamp, exception);
            throw new RuntimeException(String.format("Error retrieving events from database for: tenant=%s instance=%s", tenant, instanceId), exception);
        }
    }

    public boolean backupGenieEventAndComments(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final boolean payload) throws IOException {
        String namespace = PerfGenieConstants.getEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());
        final List<Events.Event> results = this.cantor.events().get(
                namespace,
                start,
                end,
                queryMap,
                dimMap,
                payload
        );
        if (results.size() > 0) {
            for (final Events.Event result : results) {
                Map<String,String> copy = new HashMap<>();
                Map<String,String> map =  result.getMetadata();
                for (String key : map.keySet()) {
                    copy.put(key,map.get(key));
                }
                copy.put("source","gold");
                final List<Events.Event> results1 = this.cantor.events().get(
                        config.getBackup_namespace(),
                        result.getTimestampMillis(),
                        result.getTimestampMillis(),
                        copy,
                        dimMap,
                        payload
                );
                if(results1.size() < 1) {
                    logger.info("backup canary event : " +  ":" + copy.toString());
                    this.cantor.events().store(
                            config.getBackup_namespace(),
                            result.getTimestampMillis(),
                            copy,
                            result.getDimensions(),
                            result.getPayload());
                }else{
                    logger.info("skip backup, event exist: " + result.getTimestampMillis() + ":" + copy.toString());
                }
            }
            return true;
        }else{
            logger.info("backup source events not found : " + queryMap.toString());
            return false;
        }
    }


    public CanaryEvents loadGenieEventAndCommentPayloads(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final boolean payload) throws IOException {
        String namespace = PerfGenieConstants.getEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());//queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getLargeEventNameSpace(tenant, true, config.getBackup_namespace()) : PerfGenieConstants.getLargeEventNameSpace(tenant, false, config.getBackup_namespace());
        final List<Events.Event> results = this.cantor.events().get(
                namespace,
                start,
                end,
                queryMap,
                dimMap,
                payload
        );

        List<String> list = new ArrayList<>();
        Map<String,String> payloads = new HashMap<>();
        Map<String,Long> processedMap = new HashMap<>();
        Map<String,Integer> commentCount = new HashMap<>();
        Map<String,String> commentColor = new HashMap<>();
        Map<String,Long> commentOrder = new HashMap<>();
        if (results.size() > 0) {
            for (final Events.Event result : results) {
                if(result.getMetadata().get("cell") != null) {
                    if(result.getPayload() != null) {
                        String key = result.getTimestampMillis() + result.getMetadata().get("cell");
                        if(result.getMetadata().get("file-name").equals("canary-context")) {
                            if(result.getMetadata().get("etime") != null){
                                long etime = Long.parseLong(result.getMetadata().get("etime"));
                                if (processedMap.containsKey(key)) {
                                    if (etime > processedMap.get(key)) {
                                        processedMap.put(key, etime);
                                        payloads.put(key,new String(Utils.decompress(result.getPayload())));
                                    }
                                }else{
                                    processedMap.put(key, etime);
                                    payloads.put(key,new String(Utils.decompress(result.getPayload())));
                                }
                            }
                            if(!processedMap.containsKey(key)){
                                payloads.put(key,new String(Utils.decompress(result.getPayload())));
                                processedMap.put(key, result.getTimestampMillis());
                            }
                        }else{
                            if(commentColor.containsKey(key)) {
                                Long ctime = Long.parseLong(result.getMetadata().get("ctime"));
                                if(ctime > commentOrder.get(key)){
                                    commentColor.put(key,result.getMetadata().get("color"));
                                    commentOrder.put(key,ctime);
                                }
                            }else{
                                commentColor.put(key,result.getMetadata().get("color"));
                                commentOrder.put(key,Long.parseLong(result.getMetadata().get("ctime")));
                            }

                            if(commentCount.containsKey(key)){
                                commentCount.put(key,(commentCount.get(key)+ 1));
                            }else {
                                commentCount.put(key, 1);
                            }
                        }
                    }
                }
            }
        }
        payloads.forEach((key, value) -> {
            list.add(value);
        });
        commentCount.forEach((key, value) -> {
            commentColor.put(key,value +":"+ commentColor.get(key));
        });
        if (list.size() > 0) {
            CanaryEvents response = new CanaryEvents();
            response.setCounts(commentColor);
            response.setEvents(list);
            return response;
        }
        return null;
    }
    public static class CanaryEvents{
        public List<String> getEvents() {
            return events;
        }

        public void setEvents(List<String> events) {
            this.events = events;
        }

        List<String> events;

        public Map<String, String> getCounts() {
            return counts;
        }

        public void setCounts(Map<String, String> counts) {
            this.counts = counts;
        }

        Map<String,String> counts;

    }
    public List<String> loadGenieEventPayloads(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final boolean payload) throws IOException {
        String namespace = PerfGenieConstants.getEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());//queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getLargeEventNameSpace(tenant, true, config.getBackup_namespace()) : PerfGenieConstants.getLargeEventNameSpace(tenant, false, config.getBackup_namespace());
        final List<Events.Event> results = this.cantor.events().get(
                namespace,
                start,
                end,
                queryMap,
                dimMap,
                payload
        );

        List<String> payloads = new ArrayList<>();
        Map<String,Long> processedMap = new HashMap<>();

        if (results.size() > 0) {
            for (final Events.Event result : results) {
                if(result.getMetadata().get("cell") != null) {
                    if(result.getPayload() != null) {
                        String key = result.getTimestampMillis() + result.getMetadata().get("cell");
                        if (processedMap.containsKey(key) && result.getTimestampMillis() > processedMap.get(key)) { //consider latest
                            payloads.add(new String(Utils.decompress(result.getPayload())));
                            processedMap.put(key,result.getTimestampMillis());
                        } else if(!processedMap.containsKey(key)){
                            payloads.add(new String(Utils.decompress(result.getPayload())));
                            processedMap.put(key,result.getTimestampMillis());
                        }
                    }
                }
            }
        }

        if (payloads.size() > 0) {
            return payloads;
        }
        return null;
    }

    public int isEventExist(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException {
        String namespace = PerfGenieConstants.getEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());//queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getLargeEventNameSpace(tenant, true, config.getBackup_namespace()) : PerfGenieConstants.getLargeEventNameSpace(tenant, false, config.getBackup_namespace());
        //System.out.println("0--->"+namespace);
        final List<Events.Event> results = this.cantor.events().get(
                namespace,
                start,
                end,
                queryMap,
                dimMap,
                false
        );
        return results.size();
    }

    public Map<String, Map<String, String>> loadGenieProfilesAll(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final boolean payload) throws IOException {
        String namespace = PerfGenieConstants.getLargeEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());//queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getLargeEventNameSpace(tenant, true, config.getBackup_namespace()) : PerfGenieConstants.getLargeEventNameSpace(tenant, false, config.getBackup_namespace());
        final List<Events.Event> results = this.cantor.events().get(
                namespace,
                start,
                end,
                queryMap,
                dimMap,
                payload
        );

        Map<String, Map<String, String>> profiles = new HashMap<>();

        if (results.size() > 0) {
            results.sort(Comparator.comparing(Events.Event::getTimestampMillis));
            for (final Events.Event result : results) {
                profiles.put(result.getTimestampMillis() + "::" + result.getMetadata().get("guid"), result.getMetadata());
            }
            //return profiles;
        }

        if (profiles.size() > 0) {
            return profiles;
        }
        return null;
    }

    public Map<Long, Map<String, String>> loadGenieProfiles(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final boolean payload) throws IOException {
        String namespace = PerfGenieConstants.getLargeEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());//queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getLargeEventNameSpace(tenant, true, config.getBackup_namespace()) : PerfGenieConstants.getLargeEventNameSpace(tenant, false, config.getBackup_namespace());
        final List<Events.Event> results = this.cantor.events().get(
                namespace,
                start,
                end,
                queryMap,
                dimMap,
                payload
        );
        Map<Long, Map<String, String>> profiles = new HashMap<>();
        if (results.size() > 0) {
            results.sort(Comparator.comparing(Events.Event::getTimestampMillis));
            for (final Events.Event result : results) {
                profiles.put(result.getTimestampMillis(), result.getMetadata());

            }
            //return profiles;
        }

        if (!queryMap.containsKey(PerfGenieConstants.SOURCE_KEY)) {//for sfdc check full jfrs too
            //try to look for full jfrs, sfdc fix
            final Map<String, String> tmpqueryMap = new HashMap<>();
            tmpqueryMap.put("host", queryMap.get("host"));
            tmpqueryMap.put("tenant-id", queryMap.get("tenant-id"));
            tmpqueryMap.put("file-name", "=jfr_dump_toparse.jfr.gz");

            final List<Events.Event> results1 = this.cantor.events().get(
                    namespace,
                    start,
                    end,
                    tmpqueryMap,
                    dimMap,
                    payload
            );
            if (results1.size() > 0) {
                //Map<Long, Map<String, String>> profiles = new HashMap<>();
                results1.sort(Comparator.comparing(Events.Event::getTimestampMillis));
                final HashMap<Long, Boolean> check = new HashMap<>();
                for (final Events.Event result : results1) {
                    if (!check.containsKey(result.getTimestampMillis())) {
                        final Map<String, String> meta = new HashMap<>();
                        meta.put("host", queryMap.get("host").replace("=", ""));
                        meta.put("tenant-id", queryMap.get("tenant-id").replace("=", ""));
                        meta.put("file-name", queryMap.get("file-name").replace("=", ""));
                        meta.put("guid", result.getMetadata().get("guid") + queryMap.get("file-name").replace("=", ""));
                        profiles.put(result.getTimestampMillis(), meta);
                        check.put(result.getTimestampMillis(), true);
                    }
                }
            }
        }
        if (profiles.size() > 0) {
            return profiles;
        }

        return null;
    }

    private void uploadBytes(final long timestamp, final Map<String, String> metadata,
                             final Map<String, Double> dimensions, final byte[] bytes, final String namespace) throws IOException {
        logger.info("Started uploading bytes {} to {}", metadata, namespace);
        final UploadIterator iterator = new UploadIterator(metadata, dimensions, bytes);
        this.cantor.events().store(namespace, timestamp, iterator.metadata, iterator.dimension);
        while (iterator.hasNext()) {
            final Events.Event event = iterator.next();
            this.cantor.events().store(namespace, timestamp, event.getMetadata(), event.getDimensions(), event.getPayload());
        }
        logger.info("Completed uploading bytes to {} {} as {} cantor events", namespace, metadata, dimensions.get("chunk-total").longValue());
    }

    //Done
    private void upload(final long timestamp, final Map<String, String> metadata,
                        final Map<String, Double> dimensions, final String rawPayload, final String namespace) throws IOException {
        logger.info("Started uploading {} to {}", metadata, namespace);
        final UploadIterator iterator = new UploadIterator(metadata, dimensions, rawPayload);
        this.cantor.events().store(namespace, timestamp, iterator.metadata, iterator.dimension);
        while (iterator.hasNext()) {
            final Events.Event event = iterator.next();
            this.cantor.events().store(namespace, timestamp, event.getMetadata(), event.getDimensions(), event.getPayload());
        }
        logger.info("Completed uploading to {} {} as {} cantor events", namespace, metadata, dimensions.get("chunk-total").longValue());
    }

    public synchronized InputStream eventStream(final long timestamp, final Map<String,
            String> queryMap, final Map<String, String> dimMap, final String tenant) throws IOException {

        String namespace = PerfGenieConstants.getLargeEventNameSpace(tenant, queryMap.get(PerfGenieConstants.SOURCE_KEY), config.getBackup_namespace());//queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getLargeEventNameSpace(tenant, true, config.getBackup_namespace()) : PerfGenieConstants.getLargeEventNameSpace(tenant, false, config.getBackup_namespace());
        final Stopwatch timer = Stopwatch.createStarted();
        try {
            final DownloadIterator iterator = new DownloadIterator(namespace, timestamp, timestamp, queryMap, dimMap);
            ByteArrayOutputStream outStream = new ByteArrayOutputStream();
            while (iterator.hasNext()) {
                final Events.Event event = iterator.next();
                outStream.write(event.getPayload());
                outStream.flush();
            }
            logger.info("Completed downloading {}", queryMap);
            if (queryMap.containsKey(PerfGenieConstants.SOURCE_KEY)) {//genie
                return new ByteArrayInputStream(outStream.toByteArray());
            } else {
                return new ByteArrayInputStream(Utils.decompress(outStream.toByteArray()));
            }
        } catch (IOException e) {
            logger.error("Failed to download from {}  {}", namespace, queryMap);
            e.printStackTrace();
            throw e;
        }
    }

    public final Map<String, Boolean> downloadRequests = new ConcurrentHashMap<String, Boolean>();

    private synchronized boolean downloadToFile(final long startTimestamp, final long endTimestamp, final Map<String,
            String> metadataQuery, final Map<String, String> dimensionsQuery, final String namespace, final String filepath) throws IOException {


        String req = metadataQuery.toString() + Long.toString(startTimestamp);

        File file = new File(filepath);

        if (file.exists()) {
            logger.info("already download req  {}", metadataQuery);
            return true;
        } else if (downloadRequests.containsKey(req)) {
            logger.info("duplicate  download req  {}", metadataQuery);
            return true;
        }

        downloadRequests.put(req, true);

        logger.info("Started downloading  {}", metadataQuery);
        if (namespace != null) {
            try {
                final DownloadIterator iterator = new DownloadIterator(namespace, startTimestamp, endTimestamp, metadataQuery, dimensionsQuery);
                ByteArrayOutputStream outStream = new ByteArrayOutputStream();
                Path path = Paths.get(filepath);
                while (iterator.hasNext()) {
                    final Events.Event event = iterator.next();
                    outStream.write(event.getPayload());
                    outStream.flush();
                }
                logger.info("Completed downloading {}", metadataQuery);
                if (metadataQuery.containsKey(PerfGenieConstants.SOURCE_KEY)) {//genie
                    Files.write(path, outStream.toByteArray());
                    downloadRequests.remove(req);
                    return true;
                } else {
                    Files.write(path, Utils.decompress(outStream.toByteArray()));
                    downloadRequests.remove(req);
                    return true;
                }
            } catch (Exception e) {
                logger.error("Failed to download from {}  {}", namespace, metadataQuery);
                e.printStackTrace();
                downloadRequests.remove(req);
                return false;
            }
        }
        downloadRequests.remove(req);
        return false;
    }


    private String download(final long startTimestamp, final long endTimestamp, final Map<String,
            String> metadataQuery, final Map<String, String> dimensionsQuery, final String namespace) throws IOException {

        if (metadataQuery.containsKey("file-name")) {
            String filepath = config.getJfrdir() + "/" + Long.toString(startTimestamp) + metadataQuery.get("file-name");
            filepath = filepath.replace("=", "");
            filepath = filepath.replace(".gz", "");
            File f = new File(filepath);
            if (f.exists()) {
                logger.info("using local downloaded  {}", metadataQuery);
                return new String(Files.readAllBytes(Paths.get(filepath)));
            }
        }
        logger.info("Started downloading  {}", metadataQuery);
        if (namespace != null) {
            try {
                final DownloadIterator iterator = new DownloadIterator(namespace, startTimestamp, endTimestamp, metadataQuery, dimensionsQuery);
                ByteArrayOutputStream outStream = new ByteArrayOutputStream();
                while (iterator.hasNext()) {
                    final Events.Event event = iterator.next();
                    outStream.write(event.getPayload());
                    outStream.flush();
                }
                logger.info("Completed downloading {}", metadataQuery);
                if (metadataQuery.containsKey(PerfGenieConstants.SOURCE_KEY)) {//genie
                    return new String(Utils.decompress(outStream.toByteArray()));
                } else {
                    //return new String(Utils.decompress(outStream.toByteArray()));
                    return new String(Utils.decompress(Utils.decompress(outStream.toByteArray())));
                }
            } catch (Exception e) {
                logger.error("Failed to download from {}  {}", namespace, metadataQuery);
                e.printStackTrace();
                return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to download 1 ", metadataQuery, null));
            }
        }
        return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to download 2 ", metadataQuery, null));
    }

    private static class UploadIterator implements Iterator<Events.Event> {
        public static final int MAX_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
        final Map<String, String> metadata;
        final Map<String, Double> dimension;
        private final byte[] payload;
        private final int fileLength;
        private final int totalChunkCount;

        private int chunkIndex;
        private int start;
        private int end;
        private byte[] currentChunk;

        UploadIterator(final Map<String, String> metadata, final Map<String, Double> dimension, final byte[] bytes) throws IOException {
            this.metadata = metadata;
            this.dimension = dimension;

            payload = Utils.compress(bytes);
            fileLength = payload.length;
            totalChunkCount = (fileLength / MAX_CHUNK_SIZE) + (fileLength % MAX_CHUNK_SIZE != 0 ? 1 : 0);
            dimension.put("file-length", (double) fileLength);
            dimension.put("chunk-total", (double) totalChunkCount);

            chunkIndex = 0;
            start = 0;
            end = MAX_CHUNK_SIZE - 1;
            currentChunk = new byte[MAX_CHUNK_SIZE];

            if (fileLength < MAX_CHUNK_SIZE) {
                end = this.fileLength - 1;
                currentChunk = new byte[Long.valueOf(fileLength).intValue()];
            }
        }

        UploadIterator(final Map<String, String> metadata, final Map<String, Double> dimension, final String rawPayload) throws IOException {
            this.metadata = metadata;
            this.dimension = dimension;

            payload = Utils.compress(rawPayload.getBytes(StandardCharsets.UTF_8));
            fileLength = payload.length;
            totalChunkCount = (fileLength / MAX_CHUNK_SIZE) + (fileLength % MAX_CHUNK_SIZE != 0 ? 1 : 0);
            dimension.put("file-length", (double) fileLength);
            dimension.put("chunk-total", (double) totalChunkCount);

            chunkIndex = 0;
            start = 0;
            end = MAX_CHUNK_SIZE - 1;
            currentChunk = new byte[MAX_CHUNK_SIZE];

            if (fileLength < MAX_CHUNK_SIZE) {
                end = this.fileLength - 1;
                currentChunk = new byte[Long.valueOf(fileLength).intValue()];
            }
        }

        @Override
        public boolean hasNext() {
            return chunkIndex < totalChunkCount;
        }

        @Override
        public Events.Event next() {
            if (!hasNext()) throw new IllegalArgumentException("No more chunk to iterate");

            currentChunk = Arrays.copyOfRange(payload, start, end + 1);
            final Events.Event event = createChunkEvent();
            start = end + 1;
            chunkIndex++;
            if (end + MAX_CHUNK_SIZE > fileLength - 1) {
                end = fileLength - 1;
                currentChunk = new byte[Long.valueOf(end - start + 1).intValue()];
            } else {
                end = end + MAX_CHUNK_SIZE;
                currentChunk = new byte[MAX_CHUNK_SIZE];
            }
            return event;
        }

        Events.Event createChunkEvent() {
            final Map<String, Double> dimensions = new HashMap<>(this.dimension);
            final Map<String, String> metadata = new HashMap<>(this.metadata);
            dimensions.put("start", (double) start);
            dimensions.put("end", (double) end);
            dimensions.put("chunk-index", (double) chunkIndex);
            return new Events.Event(0, metadata, dimensions, currentChunk);
        }
    }

    private class DownloadIterator implements Iterator<Events.Event> {

        private final String namespace;
        private final long startTimestamp;
        private final long endTimestamp;
        private final Map<String, String> metadataQuery;
        private final Map<String, String> dimensionQuery;

        private long totalCount = 1;
        private long processedCount = 0;
        private boolean retry = true;

        DownloadIterator(final String namespace, final long startTimestamp, final long endTimestamp,
                         final Map<String, String> metadataQuery, final Map<String, String> dimensionQuery) {
            this.namespace = namespace;
            this.startTimestamp = startTimestamp;
            this.endTimestamp = endTimestamp;
            this.metadataQuery = metadataQuery;
            this.dimensionQuery = dimensionQuery;
        }

        @Override
        public boolean hasNext() {
            return processedCount < totalCount;
        }

        @Override
        public Events.Event next() {
            try {
                if (!hasNext()) {
                    throw new IllegalArgumentException("No more events to iterate.");
                }
                final Map<String, String> currentDimensionQuery = new HashMap<>(dimensionQuery);
                currentDimensionQuery.put("chunk-index", Double.toString(this.processedCount));
                final List<Events.Event> result = cantor.events().get(
                        this.namespace,
                        this.startTimestamp,
                        this.endTimestamp,
                        metadataQuery,
                        currentDimensionQuery,
                        true
                );

                if (result.size() < 1) {
                    throw new IllegalArgumentException("Should have exactly one event per query but found: " + result.size());
                }

                final Events.Event event = result.get(0);
                if (this.processedCount == 0) {
                    this.totalCount = event.getDimensions().get("chunk-total").longValue();
                }
                processedCount++;
                retry = true;
                return event;
            } catch (final IOException e) {
                logger.warn("exception caught getting event for payload download: ", e);
                if (retry) {
                    logger.info("retrying event pull once...");
                    retry = false;
                    return next();
                }
            } catch (final NullPointerException e) {
                logger.warn("event is missing one or more required fields: ", e);
            }

            throw new IllegalArgumentException(String.format("failed to load the file with: namespace=%s " +
                            "timestamp=%d-%d current-count=%d total-count=%d", this.namespace, this.startTimestamp,
                    this.endTimestamp, this.processedCount, this.totalCount));
        }
    }
}

