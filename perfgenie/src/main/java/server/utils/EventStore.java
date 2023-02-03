package server.utils;

import com.google.common.base.Stopwatch;
import com.google.common.collect.ImmutableMap;
import com.salesforce.cantor.Cantor;
import com.salesforce.cantor.Events;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.TimeUnit;

public class EventStore {
    private final static Logger logger = LoggerFactory.getLogger(EventStore.class);
    public static final String NAMESPACE_JFR_JSON_CACHE = "jfr-json-cache";
    public static final String NAMESPACE_EVENT_LARGE_FILE = "event-large-file";
    public static final String NAMESPACE_EVENT_META = "event-meta-data";
    public static final int LARGE_FILE_SIZE = 1024*1024;
    public static boolean enableLargeFile = true;
    private final Cantor cantor;

    @Autowired
    public EventStore(final Cantor cantor) throws IOException {
        this.cantor = cantor;
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

    public String getEvent(final long start, final long end, final Map<String,
            String> queryMap, final Map<String, String> dimMap, int payloadSize) throws IOException {
        if (enableLargeFile && payloadSize > LARGE_FILE_SIZE) {
            return download(start, end, queryMap, dimMap);
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
            String> queryMap, final Map<String, String> dimMap) throws IOException {

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
                String res =  download(start, end, queryMap, dimMap);
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

    public Map loadProfiles(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException {
        final List<Events.Event> results = this.cantor.events().get(
                NAMESPACE_EVENT_META,
                start,
                end,
                queryMap,
                dimMap,
                false
        );
        if (results.size() > 0) {
            //Map<String, Long> profiles = new HashMap<>();
            Map<String, Map<String, String>> profiles = new HashMap<>();
            results.sort(Comparator.comparing(Events.Event::getTimestampMillis));
            for (final Events.Event result : results) {
                //profiles.put(result.getMetadata().get("guid"), result.getTimestampMillis());
                profiles.put(result.getMetadata().get("guid"), result.getMetadata());
            }
            return profiles;
        }
        return null;
    }

    private void upload(final long timestamp, final Map<String, String> metadata,
                        final Map<String, Double> dimensions, final String rawPayload) throws IOException {
        logger.info("Started uploading {}", metadata);


        final EventStore.UploadIterator iterator = new EventStore.UploadIterator(metadata, dimensions, rawPayload);
        this.cantor.events().store(NAMESPACE_EVENT_LARGE_FILE, timestamp, iterator.metadata, iterator.dimension);
        while (iterator.hasNext()) {
            final Events.Event event = iterator.next();
            this.cantor.events().store(NAMESPACE_EVENT_LARGE_FILE, timestamp, event.getMetadata(), event.getDimensions(), event.getPayload());
        }
        logger.info("Completed uploading {} as {} cantor events", metadata, dimensions.get("chunk-total").longValue());
    }

    private String download(final long startTimestamp, final long endTimestamp, final Map<String,
            String> metadataQuery, final Map<String, String> dimensionsQuery) throws IOException {
        logger.info("Started downloading  {}", metadataQuery);
        final EventStore.DownloadIterator iterator = new EventStore.DownloadIterator(NAMESPACE_EVENT_LARGE_FILE, startTimestamp, endTimestamp, metadataQuery, dimensionsQuery);
        ByteArrayOutputStream outStream = new ByteArrayOutputStream();
        while (iterator.hasNext()) {
            final Events.Event event = iterator.next();
            outStream.write(event.getPayload());
            outStream.flush();
        }
        logger.info("Completed downloading {}", metadataQuery);
        return new String(Utils.decompress(outStream.toByteArray()));
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
