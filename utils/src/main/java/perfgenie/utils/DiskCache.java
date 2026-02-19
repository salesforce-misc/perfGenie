/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
package perfgenie.utils;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.salesforce.cantor.Events;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;

public class DiskCache {
    private static final Logger logger = LoggerFactory.getLogger(DiskCache.class);
    private static String CACHE_DIR = "/tmp/jfrs";
    private static final String CACHE_FILE_EXTENSION = ".cache";
    private static final ObjectMapper objectMapper = new ObjectMapper();

    static {
        // Ensure cache directory exists
        Utils.createDirectoryIfNotExists(CACHE_DIR);
    }

    /**
     * Gets the current cache directory
     * @return The current cache directory path
     */
    public static String getCacheDirectory() {
        return CACHE_DIR;
    }

    /**
     * Sets the cache directory and ensures it exists
     * @param cacheDir The new cache directory path
     * @throws IllegalArgumentException if the path is null or empty
     */
    public static void setCacheDirectory(String cacheDir) {
        if (cacheDir == null || cacheDir.trim().isEmpty()) {
            throw new IllegalArgumentException("Cache directory cannot be null or empty");
        }
        
        String trimmedDir = cacheDir.trim();
        CACHE_DIR = trimmedDir;
        
        // Ensure the new directory exists
        Utils.createDirectoryIfNotExists(CACHE_DIR);
        logger.info("Cache directory set to: {}", CACHE_DIR);
    }

    /**
     * Generates a cache key hash from namespace, start, end, and queryMap
     */
    private static String generateCacheKey(String namespace, long start, long end, Map<String, String> queryMap) {
        try {
            // Create a deterministic string representation of the cache key
            StringBuilder keyBuilder = new StringBuilder();
            keyBuilder.append(namespace).append("|");
            keyBuilder.append(start).append("|");
            keyBuilder.append(end).append("|");
            
            // Sort queryMap entries for deterministic ordering
            List<String> sortedKeys = new ArrayList<>(queryMap.keySet());
            Collections.sort(sortedKeys);
            for (String key : sortedKeys) {
                keyBuilder.append(key).append("=").append(queryMap.get(key)).append("|");
            }
            
            String keyString = keyBuilder.toString();
            
            // Generate MD5 hash
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] hashBytes = md.digest(keyString.getBytes("UTF-8"));
            
            // Convert to hex string
            StringBuilder hexString = new StringBuilder();
            for (byte b : hashBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            
            return hexString.toString();
        } catch (NoSuchAlgorithmException | UnsupportedEncodingException e) {
            logger.error("Failed to generate cache key", e);
            // Fallback to a simple hash
            return String.valueOf((namespace + start + end + queryMap.toString()).hashCode());
        }
    }

    /**
     * Gets cached events from disk
     * @param namespace The namespace
     * @param start Start timestamp
     * @param end End timestamp
     * @param queryMap Query map
     * @return List of Events.Event if found in cache, null otherwise
     */
    public static List<Events.Event> getCache(String namespace, long start, long end, Map<String, String> queryMap) {
        try {
            String cacheKey = generateCacheKey(namespace, start, end, queryMap);
            Path cacheFile = Paths.get(CACHE_DIR, cacheKey + CACHE_FILE_EXTENSION);
            
            if (!Files.exists(cacheFile)) {
                logger.info("DiskCache: CACHE MISS - Cache file not found for key: {}", cacheKey);
                return null;
            }
            
            logger.info("DiskCache: CACHE HIT - Found cache file for key: {}", cacheKey);
            
            // Read cached data
            try (DataInputStream dis = new DataInputStream(new BufferedInputStream(new FileInputStream(cacheFile.toFile())))) {
                int eventCount = dis.readInt();
                List<Events.Event> events = new ArrayList<>();
                
                for (int i = 0; i < eventCount; i++) {
                    long timestamp = dis.readLong();
                    
                    // Read metadata JSON
                    int metadataLength = dis.readInt();
                    byte[] metadataBytes = new byte[metadataLength];
                    dis.readFully(metadataBytes);
                    Map<String, String> metadata = objectMapper.readValue(metadataBytes, 
                        new TypeReference<Map<String, String>>() {});
                    
                    // Read dimensions JSON
                    int dimensionsLength = dis.readInt();
                    byte[] dimensionsBytes = new byte[dimensionsLength];
                    dis.readFully(dimensionsBytes);
                    Map<String, Double> dimensions = objectMapper.readValue(dimensionsBytes, 
                        new TypeReference<Map<String, Double>>() {});
                    
                    // Read payload
                    int payloadLength = dis.readInt();
                    byte[] payload = null;
                    if (payloadLength > 0) {
                        payload = new byte[payloadLength];
                        dis.readFully(payload);
                    }
                    
                    // Reconstruct event
                    Events.Event event = new Events.Event(timestamp, metadata, dimensions, payload);
                    events.add(event);
                }
                
                logger.info("DiskCache: Successfully loaded {} events from cache (CACHE USED)", events.size());
                return events;
            }
        } catch (Exception e) {
            logger.warn("DiskCache: CACHE ERROR - Failed to read from cache, will fallback to direct call", e);
            return null;
        }
    }

    /**
     * Stores events to disk cache
     * @param namespace The namespace
     * @param start Start timestamp
     * @param end End timestamp
     * @param queryMap Query map
     * @param events List of Events.Event to cache
     */
    public static void setCache(String namespace, long start, long end, Map<String, String> queryMap, List<Events.Event> events) {
        if (events == null || events.isEmpty()) {
            return;
        }
        
        try {
            String cacheKey = generateCacheKey(namespace, start, end, queryMap);
            Path cacheFile = Paths.get(CACHE_DIR, cacheKey + CACHE_FILE_EXTENSION);
            
            // Write cached data
            try (DataOutputStream dos = new DataOutputStream(new BufferedOutputStream(new FileOutputStream(cacheFile.toFile())))) {
                dos.writeInt(events.size());
                
                for (Events.Event event : events) {
                    dos.writeLong(event.getTimestampMillis());
                    
                    // Write metadata as JSON
                    byte[] metadataBytes = objectMapper.writeValueAsBytes(event.getMetadata());
                    dos.writeInt(metadataBytes.length);
                    dos.write(metadataBytes);
                    
                    // Write dimensions as JSON
                    byte[] dimensionsBytes = objectMapper.writeValueAsBytes(event.getDimensions());
                    dos.writeInt(dimensionsBytes.length);
                    dos.write(dimensionsBytes);
                    
                    // Write payload
                    byte[] payload = event.getPayload();
                    if (payload == null) {
                        dos.writeInt(0);
                    } else {
                        dos.writeInt(payload.length);
                        dos.write(payload);
                    }
                }
            }
            
            logger.info("DiskCache: Successfully stored {} events to cache with key: {} (CACHE WRITTEN)", events.size(), cacheKey);
        } catch (Exception e) {
            logger.warn("DiskCache: CACHE ERROR - Failed to write to cache", e);
        }
    }

    /**
     * Cleans up cache files older than the specified number of minutes
     * Keeps only cache files created in the last x minutes
     * @param minutes Number of minutes - files older than this will be deleted
     * @return Number of files deleted
     */
    public static int cleanup(int minutes) {
        int deletedCount = 0;
        long cutoffTime = System.currentTimeMillis() - (minutes * 60 * 1000L);
        
        try {
            Path cacheDir = Paths.get(CACHE_DIR);
            if (!Files.exists(cacheDir) || !Files.isDirectory(cacheDir)) {
                logger.debug("Cache directory does not exist: {}", CACHE_DIR);
                return 0;
            }
            
            File dir = cacheDir.toFile();
            // Include both .cache files (for Events) and .cache.json files (for query results)
            File[] files = dir.listFiles((dir1, name) -> name.endsWith(CACHE_FILE_EXTENSION) || name.endsWith(CACHE_FILE_EXTENSION + ".json"));
            
            if (files == null) {
                logger.debug("No cache files found in directory: {}", CACHE_DIR);
                return 0;
            }
            
            for (File file : files) {
                try {
                    long lastModified = file.lastModified();
                    if (lastModified < cutoffTime) {
                        // File is older than cutoff time, delete it
                        if (file.delete()) {
                            deletedCount++;
                            logger.debug("Deleted old cache file: {}", file.getName());
                        } else {
                            logger.warn("Failed to delete cache file: {}", file.getName());
                        }
                    }
                } catch (Exception e) {
                    logger.warn("Error processing cache file: {}", file.getName(), e);
                }
            }
            
            logger.info("Cache cleanup completed: deleted {} files older than {} minutes", deletedCount, minutes);
        } catch (Exception e) {
            logger.error("Failed to cleanup cache", e);
        }
        
        return deletedCount;
    }

    /**
     * Generates a cache key hash for a query string
     */
    private static String generateQueryCacheKey(String query, String refId, String previous, long start, long end, String regex) {
        try {
            // Create a deterministic string representation of the cache key
            StringBuilder keyBuilder = new StringBuilder();
            keyBuilder.append("genieQuery|");
            keyBuilder.append(query != null ? query : "").append("|");
            keyBuilder.append(refId != null ? refId : "").append("|");
            keyBuilder.append(previous != null ? previous : "").append("|");
            keyBuilder.append(start).append("|");
            keyBuilder.append(end).append("|");
            keyBuilder.append(regex != null ? regex : "").append("|");
            
            String keyString = keyBuilder.toString();
            
            // Generate MD5 hash
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] hashBytes = md.digest(keyString.getBytes("UTF-8"));
            
            // Convert to hex string
            StringBuilder hexString = new StringBuilder();
            for (byte b : hashBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            
            return hexString.toString();
        } catch (NoSuchAlgorithmException | UnsupportedEncodingException e) {
            logger.error("Failed to generate query cache key", e);
            // Fallback to a simple hash
            return String.valueOf((query + refId + previous + start + end + regex).hashCode());
        }
    }

    /**
     * Gets cached query result (JSON string) from disk
     * @param query The query string
     * @param refId The refId
     * @param previous The previous parameter
     * @param start Start timestamp
     * @param end End timestamp
     * @param regex The regex parameter
     * @return Cached JSON string if found, null otherwise
     */
    public static String getQueryCache(String query, String refId, String previous, long start, long end, String regex) {
        try {
            String cacheKey = generateQueryCacheKey(query, refId, previous, start, end, regex);
            Path cacheFile = Paths.get(CACHE_DIR, cacheKey + CACHE_FILE_EXTENSION + ".json");
            
            if (!Files.exists(cacheFile)) {
                logger.debug("DiskCache: CACHE MISS - Query cache file not found for key: {}", cacheKey);
                return null;
            }
            
            logger.info("DiskCache: CACHE HIT - Found query cache file for key: {}", cacheKey);
            
            // Read cached JSON string
            String cachedResult = Files.readString(cacheFile, StandardCharsets.UTF_8);
            logger.info("DiskCache: Successfully loaded cached query result (CACHE USED)");
            return cachedResult;
        } catch (Exception e) {
            logger.warn("DiskCache: CACHE ERROR - Failed to read query cache, will fallback to direct call", e);
            return null;
        }
    }

    /**
     * Stores query result (JSON string) to disk cache
     * @param query The query string
     * @param refId The refId
     * @param previous The previous parameter
     * @param start Start timestamp
     * @param end End timestamp
     * @param regex The regex parameter
     * @param result The JSON string result to cache
     */
    public static void setQueryCache(String query, String refId, String previous, long start, long end, String regex, String result) {
        if (result == null || result.trim().isEmpty()) {
            return;
        }
        
        try {
            String cacheKey = generateQueryCacheKey(query, refId, previous, start, end, regex);
            Path cacheFile = Paths.get(CACHE_DIR, cacheKey + CACHE_FILE_EXTENSION + ".json");
            
            // Write cached JSON string
            Files.writeString(cacheFile, result, StandardCharsets.UTF_8);
            
            logger.info("DiskCache: Successfully stored query result to cache with key: {} (CACHE WRITTEN)", cacheKey);
        } catch (Exception e) {
            logger.warn("DiskCache: CACHE ERROR - Failed to write query cache", e);
        }
    }
}

