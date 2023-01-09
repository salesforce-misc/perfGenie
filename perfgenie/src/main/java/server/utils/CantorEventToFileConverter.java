package server.utils;

import com.salesforce.cantor.Cantor;
import com.salesforce.cantor.Events;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

public class CantorEventToFileConverter {
    public static final int MAX_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
    private final static Logger logger = LoggerFactory.getLogger(CantorEventToFileConverter.class);
    private final Cantor cantor;

    public CantorEventToFileConverter(Cantor cantor) {
        this.cantor = cantor;
    }
    private static class UploadIterator implements Iterator<Events.Event> {
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
            end = MAX_CHUNK_SIZE;
            currentChunk = new byte[MAX_CHUNK_SIZE];

            if (fileLength < MAX_CHUNK_SIZE) {
                end = this.fileLength;
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
            currentChunk = Arrays.copyOfRange(payload, start, end);

            final Events.Event event = createChunkEvent();
            start = end + 1;
            chunkIndex ++;
            if ((end + MAX_CHUNK_SIZE) > fileLength) {
                end = fileLength;
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
        private final Cantor cantor;
        private final String namespace;
        private final long startTimestamp;
        private final long endTimestamp;
        private final Map<String, String> metadataQuery;
        private final Map<String, String> dimensionQuery;

        private long totalCount = 1;
        private long processedCount = 0;
        private boolean retry = true;

        DownloadIterator(final String namespace, final long startTimestamp, final long endTimestamp, final Map<String, String> metadataQuery, final Map<String, String> dimensionQuery, final Cantor cantor) {
            this.cantor = cantor;
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
                final List<Events.Event> result = this.cantor.events().get(
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
                if (this.totalCount == 0) {
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

            throw new IllegalArgumentException(String.format("failed to load the file with: namespace=%s timestamp=%d-%d current-count=%d total-count=%d", this.namespace, this.startTimestamp, this.endTimestamp, this.processedCount, this.totalCount));

        }
    }

    public void upload(final String namespace, final long timestamp, final Map<String, String> metadata, final Map<String, Double> dimensions, final String rawPayload) throws IOException {
        logger.info("Started uploading file {}", metadata.get("file-name"));
        final UploadIterator uploader = new UploadIterator(metadata, dimensions, rawPayload);
        this.cantor.events().store(namespace, timestamp, uploader.metadata, uploader.dimension);
        while (uploader.hasNext()) {
            final Events.Event event = uploader.next();
            this.cantor.events().store(namespace, timestamp, event.getMetadata(), event.getDimensions(), event.getPayload());
        }
        logger.info("Completed uploading file {} as {} cantor events", metadata.get("file-name"), dimensions.get("chunk-total"));
    }

    public String download(final String namespace, final long startTimestamp, final long endTimestamp, final Map<String, String> metadataQuery, final Map<String, String> dimensionsQuery, final Cantor cantor) throws IOException {
        logger.info("Started downloading file {}", metadataQuery.get("file-name"));
        final DownloadIterator downloader = new DownloadIterator(namespace, startTimestamp, endTimestamp, metadataQuery, dimensionsQuery, cantor);
        ByteArrayOutputStream outStream = new ByteArrayOutputStream();
        while (downloader.hasNext()) {
            final Events.Event event = downloader.next();
            outStream.write(Utils.decompress(event.getPayload()));
            outStream.flush();
        }
        logger.info("Completed downloading file {}", metadataQuery.get("file-name"));
        return outStream.toString();
    }
}
