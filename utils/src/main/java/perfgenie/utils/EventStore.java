/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
package perfgenie.utils;

import com.google.common.base.Stopwatch;
import com.google.common.collect.ImmutableMap;
import com.salesforce.cantor.Cantor;
import com.salesforce.cantor.Events;
import com.salesforce.cantor.grpc.CantorOnGrpc;
import com.salesforce.cantor.h2.CantorOnH2;
import com.salesforce.cantor.mysql.CantorOnMysql;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class EventStore {
    private final static Logger logger = LoggerFactory.getLogger(EventStore.class);
    public static final String NAMESPACE_JFR_JSON_CACHE = "jfr-json-cache";
    public static final String NAMESPACE_EVENT_LARGE_FILE = "event-large-file";
    public static final String NAMESPACE_EVENT_META = "event-meta-data";
    public static final int LARGE_FILE_SIZE = 1024 * 1024;
    public static boolean enableLargeFile = true;
    private final Cantor cantor;
    final Config config;
    public static HashMap<String, Integer> tenantsCache = new HashMap<>();
    public static Long tenantsCacheTime = System.currentTimeMillis();

    private static Lock cacheLock = new ReentrantLock();

    public EventStore(final Config config) throws IOException {
        this.config = config;
        if (config.getStorageType().equals("mySQL")) {
            this.cantor =  new CantorOnMysql(config.getMySQL_host(), config.getMySQL_port(), config.getMySQL_user(), config.getMySQL_pwd());
        } else if (config.getStorageType().equals("grpc")) {
            this.cantor =   new CantorOnGrpc(config.getGrpc_target());
        } else {
            this.cantor =   new CantorOnH2(config.getH2dir());//default
        }
        try {
            this.cantor.events().store(
                    NAMESPACE_JFR_JSON_CACHE,
                    System.currentTimeMillis(),
                    ImmutableMap.of(),
                    ImmutableMap.of(),
                    null);
        } catch (Exception e) {
            this.cantor.events().create(NAMESPACE_JFR_JSON_CACHE);
            this.cantor.events().create(NAMESPACE_EVENT_LARGE_FILE);
            this.cantor.events().create(NAMESPACE_EVENT_META);
        }
    }

    public EventStore(final Cantor cantor, final Config config) throws IOException {
        this.cantor = cantor;
        this.config = config;
        try {
            this.cantor.events().store(
                    NAMESPACE_JFR_JSON_CACHE,
                    System.currentTimeMillis(),
                    ImmutableMap.of(),
                    ImmutableMap.of(),
                    null);
        } catch (Exception e) {
            this.cantor.events().create(NAMESPACE_JFR_JSON_CACHE);
        }
        try {
            this.cantor.events().store(
                    NAMESPACE_EVENT_LARGE_FILE,
                    System.currentTimeMillis(),
                    ImmutableMap.of(),
                    ImmutableMap.of(),
                    null);
        } catch (Exception e) {
            this.cantor.events().create(NAMESPACE_EVENT_LARGE_FILE);
        }
        try {
            this.cantor.events().store(
                    NAMESPACE_EVENT_META,
                    System.currentTimeMillis(),
                    ImmutableMap.of(),
                    ImmutableMap.of(),
                    null);
        } catch (Exception e) {
            this.cantor.events().create(NAMESPACE_EVENT_META);
        }
    }

    public String getEvent(final long start, final long end, final Map<String,
            String> queryMap, final Map<String, String> dimMap, int payloadSize) throws IOException {
            if (enableLargeFile && payloadSize > LARGE_FILE_SIZE) {
                final Stopwatch timer = Stopwatch.createStarted();
                String res = download(start, end, queryMap, dimMap, null);
                logger.info("successfully fetched event from namespace: " + NAMESPACE_EVENT_LARGE_FILE + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
                return res;
            } else {
                final List<Events.Event> results1 = this.cantor.events().get(
                        NAMESPACE_JFR_JSON_CACHE,
                        start,
                        end,
                        queryMap,
                        dimMap,
                        true
                );
                if (results1.size() > 0) {
                    return new String(Utils.decompress(results1.get(0).getPayload()));
                }
            }
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Profiles not found", queryMap, null));
    }

    public String getEvent(final long start, final long end, final Map<String,
            String> queryMap, final Map<String, String> dimMap, final String namespace) throws IOException {

        if(namespace != null){
            final Stopwatch timer = Stopwatch.createStarted();
            String res = download(start, end, queryMap, dimMap, namespace);
            logger.info("successfully fetched event from namespace: " + namespace + " time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
            return res;
        }else {
            final List<Events.Event> results = this.cantor.events().get(
                    NAMESPACE_EVENT_META,
                    start,
                    end,
                    queryMap,
                    dimMap,
                    false
            );
            if (results.size() > 0) {
                final Stopwatch timer = Stopwatch.createStarted();
                if (enableLargeFile && Integer.parseInt(results.get(0).getMetadata().get("size")) > LARGE_FILE_SIZE) {
                    String res = download(start, end, queryMap, dimMap, null);
                    logger.info("successfully fetched event from namespace: " + NAMESPACE_EVENT_LARGE_FILE + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
                    return res;
                } else {
                    final List<Events.Event> results1 = this.cantor.events().get(
                            NAMESPACE_JFR_JSON_CACHE,
                            start,
                            end,
                            queryMap,
                            dimMap,
                            true
                    );
                    if (results1.size() > 0) {
                        String res = new String(Utils.decompress(results1.get(0).getPayload()));
                        logger.info("successfully fetched event from namespace: " + NAMESPACE_JFR_JSON_CACHE + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
                        return res;
                    }
                }
            }
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Profiles not found", queryMap, null));
        }
    }

    public boolean addEvent(final long timestamp, final Map<String, String> queryMap, final Map<String, Double> dimMap, final String payload) throws IOException {
        final Stopwatch timer = Stopwatch.createStarted();
        queryMap.put("size", String.valueOf(payload.length()));
        addMeta(timestamp, dimMap, queryMap);

        if (enableLargeFile && payload.length() > LARGE_FILE_SIZE) {
            upload(timestamp, queryMap, dimMap, payload);
            logger.info("successfully stored even in database under namespace: " + NAMESPACE_EVENT_LARGE_FILE + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
        } else {
            this.cantor.events().store(
                    NAMESPACE_JFR_JSON_CACHE,
                    timestamp,
                    queryMap,
                    dimMap,
                    Utils.compress(payload.getBytes(StandardCharsets.UTF_8)));
            logger.info("successfully stored even in database under namespace: " + NAMESPACE_JFR_JSON_CACHE + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
        }

        return true;
    }

    public boolean addMeta(final long timestamp, final Map<String, Double> dimMap, final Map<String, String> queryMap) throws IOException {
        final Stopwatch timer = Stopwatch.createStarted();
        this.cantor.events().store(
                NAMESPACE_EVENT_META,
                timestamp,
                queryMap,
                dimMap,
                null);

        logger.info("successfully stored even in database under namespace: " + NAMESPACE_JFR_JSON_CACHE + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
        return true;
    }

    public String getMeta(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException {
        final List<Events.Event> results = this.cantor.events().get(
                NAMESPACE_EVENT_META,
                start,
                end,
                queryMap,
                dimMap,
                false
        );
        if (results.size() > 0) {
            return Utils.toJson(results);
        }
        return Utils.toJson(results);
    }
    public String getTenants(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final List<String> namespaces) throws IOException {
        if(config.getStorageType().equals("grpc")) {
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
                        tenantsCache.put(tenant, 1);
                    }
                    tenantsCacheTime = System.currentTimeMillis();
                } else {
                    logger.warn("updated at " + tenantsCacheTime);
                }
                cacheLock.unlock();
            }
        }
        namespaces.add(NAMESPACE_EVENT_META);
        for (final String namespace : namespaces) {
            final List<Events.Event> results = this.cantor.events().get(
                    NAMESPACE_EVENT_META,
                    start,
                    end,
                    queryMap,
                    dimMap,
                    false
            );
            if (results.size() > 0) {
                for (final Events.Event result : results) {
                    if(result.getMetadata().containsKey("tenant")){
                        tenantsCache.put(result.getMetadata().get("tenant"),1);
                    }else if(result.getMetadata().containsKey("tenant-id")){
                        tenantsCache.put(result.getMetadata().get("tenant-id"),1);
                    }
                }
            }
        }
        return Utils.toJson(tenantsCache);
    }

    public String getMeta(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final String tenant, final String instance) throws IOException {
        final Map<String, String> queryMap1 = new HashMap<>();
        final Map<String, String> dimMap1 = new HashMap<>();
        if(tenant != null) {
            queryMap1.put("tenant", tenant);
        }
        if(instance != null) {
            queryMap1.put("host", instance);
        }
        final List<Events.Event> results1 = this.cantor.events().get(
                NAMESPACE_EVENT_META,
                start,
                end,
                queryMap1,
                dimMap1,
                false
        );

        if(config.getStorageType().equals("grpc")) {
            if (tenant != null) {

                if(instance != null) {
                    queryMap.put("instance-id", instance);
                }

                queryMap.put("tenant-id", tenant);

                //queryMap.put("name", "jfr");//get only jfr events
                final List<Events.Event> results = this.cantor.events().get(
                        "maiev-tenant-" + tenant,
                        start,
                        end,
                        queryMap,
                        dimMap,
                        false
                );
                if (results.size() > 0) {
                    for (final Events.Event result : results) {
                        results1.add(result);
                    }
                }
                /*final Map<String, String> queryMap2 = new HashMap<>();
                queryMap2.put("tenant-id", tenant);
                if(instance != null) {
                    queryMap2.put("instance-id", instance);
                }
                queryMap2.put("name", "json-jstack");//get only jfr events
                final List<Events.Event> results2 = this.cantor.events().get(
                        "maiev-tenant-" + tenant,
                        start,
                        end,
                        queryMap2,
                        dimMap,
                        false
                );
                if (results2.size() > 0) {
                    for (final Events.Event result : results2) {
                        results1.add(result);
                    }
                }*/
            }
        }

        return Utils.toJson(results1);
    }

    public List getPayLoads(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final String namespace, final boolean payload) throws IOException {
        if(namespace == null){
            final List<Events.Event> results = this.cantor.events().get(
                    NAMESPACE_EVENT_META,
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
        }else {
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
        }
        return null;
    }

    public Map getOtherPayLoads(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final String namespace, final boolean payload) throws IOException {
        if(namespace == null){
            final List<Events.Event> results = this.cantor.events().get(
                    NAMESPACE_EVENT_META,
                    start,
                    end,
                    queryMap,
                    dimMap,
                    payload
            );
            if (results.size() > 0) {
                Map<Long,String> payloads = new HashMap<>();
                results.sort(Comparator.comparing(Events.Event::getTimestampMillis));
                for (final Events.Event result : results) {
                    payloads.put(result.getTimestampMillis(),new String(Utils.decompress(result.getPayload())));
                }
                return payloads;
            }
        }else {
            final List<Events.Event> results = this.cantor.events().get(
                    namespace,
                    start,
                    end,
                    queryMap,
                    dimMap,
                    payload
            );
            if (results.size() > 0) {
                Map<Long,String> payloads = new HashMap<>();
                results.sort(Comparator.comparing(Events.Event::getTimestampMillis));
                for (final Events.Event result : results) {
                    payloads.put(result.getTimestampMillis(),new String(Utils.decompress(result.getPayload())));
                }
                return payloads;
            }
        }
        return null;
    }

    public String getInstances(final String tenant, long start, long end) throws IOException{

            HashMap<String, Integer> instances = new HashMap();
            final List<Events.Event> results = this.cantor.events().get(
                    NAMESPACE_EVENT_META,
                    start,
                    end,
                    Collections.emptyMap(),
                    Collections.emptyMap()
            );

            if (results.size() > 0) {
                for (final Events.Event result : results) {
                    if(result.getMetadata().containsKey("host")){
                        instances.put(result.getMetadata().get("host"),1);
                    }
                }
            }

        if(config.getStorageType().equals("grpc")) {
            try {
                final Collection<String> instances1 = this.cantor.events().metadata(
                        String.format("maiev-heartbeat-%s", tenant),
                        "instance-id",
                        start,
                        end,
                        Collections.emptyMap(),
                        Collections.emptyMap());
                for (String s : instances1) {
                    instances.put(s,1);
                }
            } catch (final IOException exception) {
                logger.warn("exception while getting instances ", exception);
            }
        }
        return  Utils.toJson(instances);
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

    public Map loadProfiles(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final String namespace, final boolean payload) throws IOException {
        if(namespace == null){
            final List<Events.Event> results = this.cantor.events().get(
                    NAMESPACE_EVENT_META,
                    start,
                    end,
                    queryMap,
                    dimMap,
                    payload
            );
            if (results.size() > 0) {
                Map<String, Map<String, String>> profiles = new HashMap<>();
                results.sort(Comparator.comparing(Events.Event::getTimestampMillis));
                for (final Events.Event result : results) {
                    profiles.put(result.getMetadata().get("guid"), result.getMetadata());
                }
                return profiles;
            }
        }else {
            final List<Events.Event> results = this.cantor.events().get(
                    namespace,
                    start,
                    end,
                    queryMap,
                    dimMap,
                    payload
            );
            if (results.size() > 0) {
                Map<String, Map<String, String>> profiles = new HashMap<>();
                results.sort(Comparator.comparing(Events.Event::getTimestampMillis));
                for (final Events.Event result : results) {
                    profiles.put(result.getMetadata().get("guid"), result.getMetadata());
                }
                return profiles;
            }
        }
        return null;
    }

    private void upload(final long timestamp, final Map<String, String> metadata,
                        final Map<String, Double> dimensions, final String rawPayload) throws IOException {
        logger.info("Started uploading {}", metadata);

        final UploadIterator iterator = new UploadIterator(metadata, dimensions, rawPayload);
        this.cantor.events().store(NAMESPACE_EVENT_LARGE_FILE, timestamp, iterator.metadata, iterator.dimension);
        while (iterator.hasNext()) {
            final Events.Event event = iterator.next();
            this.cantor.events().store(NAMESPACE_EVENT_LARGE_FILE, timestamp, event.getMetadata(), event.getDimensions(), event.getPayload());
        }
        logger.info("Completed uploading {} as {} cantor events", metadata, dimensions.get("chunk-total").longValue());
    }

    private String download(final long startTimestamp, final long endTimestamp, final Map<String,
            String> metadataQuery, final Map<String, String> dimensionsQuery, final String namespace) throws IOException {
        logger.info("Started downloading  {}", metadataQuery);
        if(namespace != null){
            try {
                final DownloadIterator iterator = new DownloadIterator(namespace, startTimestamp, endTimestamp, metadataQuery, dimensionsQuery);
                ByteArrayOutputStream outStream = new ByteArrayOutputStream();
                while (iterator.hasNext()) {
                    final Events.Event event = iterator.next();
                    outStream.write(event.getPayload());
                    outStream.flush();
                }
                logger.info("Completed downloading {}", metadataQuery);
                return new String(Utils.decompress(Utils.decompress(outStream.toByteArray())));
            }catch(Exception e){
                e.printStackTrace();
                return null;
            }
        }else {
            final DownloadIterator iterator = new DownloadIterator(NAMESPACE_EVENT_LARGE_FILE, startTimestamp, endTimestamp, metadataQuery, dimensionsQuery);
            ByteArrayOutputStream outStream = new ByteArrayOutputStream();
            while (iterator.hasNext()) {
                final Events.Event event = iterator.next();
                outStream.write(event.getPayload());
                outStream.flush();
            }
            logger.info("Completed downloading {}", metadataQuery);
            return new String(Utils.decompress(outStream.toByteArray()));
        }
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

                if (result.size() != 1) {
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
