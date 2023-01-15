package server.utils;

import com.salesforce.cantor.Cantor;
import com.salesforce.cantor.Events;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

public class Uploader {
    private final static Logger logger = LoggerFactory.getLogger(Uploader.class);
    private final Cantor cantor;

    public Uploader(Cantor cantor) {
        this.cantor = cantor;
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

            payload =  Utils.compress(rawPayload.getBytes(StandardCharsets.UTF_8));
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
            chunkIndex ++;
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

    public void upload(final String namespace, final long timestamp, final Map<String, String> metadata,
            final Map<String, Double> dimensions, final String rawPayload) throws IOException {
        logger.info("Started uploading file {}", metadata.get("file-name"));
        final UploadIterator iterator = new UploadIterator(metadata, dimensions, rawPayload);
        this.cantor.events().store(namespace, timestamp, iterator.metadata, iterator.dimension);
        while (iterator.hasNext()) {
            final Events.Event event = iterator.next();
            this.cantor.events().store(namespace, timestamp, event.getMetadata(), event.getDimensions(), event.getPayload());
        }
        logger.info("Completed uploading file {} as {} cantor events", metadata.get("file-name"), dimensions.get("chunk-total").longValue());
    }
}
