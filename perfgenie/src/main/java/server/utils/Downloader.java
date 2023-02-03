package server.utils;

import com.salesforce.cantor.Cantor;
import com.salesforce.cantor.Events;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

public class Downloader {
    private final static Logger logger = LoggerFactory.getLogger(Downloader.class);

    private final Cantor cantor;

    public Downloader(Cantor cantor) {
        this.cantor = cantor;
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

    public String download(final String namespace, final long startTimestamp, final long endTimestamp, final Map<String,
            String> metadataQuery, final Map<String, String> dimensionsQuery) throws IOException {
        logger.info("Started downloading file {}", metadataQuery.get("file-name"));
        final DownloadIterator iterator = new DownloadIterator(namespace, startTimestamp, endTimestamp, metadataQuery, dimensionsQuery);
        ByteArrayOutputStream outStream = new ByteArrayOutputStream();
        while (iterator.hasNext()) {
            final Events.Event event = iterator.next();
            outStream.write(event.getPayload());
            outStream.flush();
        }
        logger.info("Completed downloading file {}", metadataQuery.get("file-name"));
        return new String(Utils.decompress(outStream.toByteArray()));
    }
}
