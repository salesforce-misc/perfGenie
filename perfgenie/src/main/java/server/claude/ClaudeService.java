/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server.claude;

import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import server.claude.config.ClaudeConfig;
import server.claude.model.ClaudeMessage;
import server.claude.model.ClaudeRequest;
import server.claude.model.ClaudeResponse;
import server.claude.mcp.MCPManager;
import server.claude.mcp.MCPTool;
import server.claude.rag.RAGService;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Service implementation for interacting with Claude API
 */
@Service
public class ClaudeService implements IClaudeService {
    
    private static final Logger logger = LoggerFactory.getLogger(ClaudeService.class);
    
    private final ClaudeConfig config;
    private final ObjectMapper objectMapper;
    private final MCPManager mcpManager;
    private final ConversationHistoryManager historyManager;
    private final RAGService ragService;
    private final TokenCounter tokenCounter;
    private OkHttpClient httpClient;
    
    @Autowired
    public ClaudeService(ClaudeConfig config, MCPManager mcpManager, 
                        ConversationHistoryManager historyManager, RAGService ragService,
                        TokenCounter tokenCounter) {
        this.config = config;
        this.mcpManager = mcpManager;
        this.historyManager = historyManager;
        this.ragService = ragService;
        this.tokenCounter = tokenCounter;
        this.objectMapper = new ObjectMapper();
    }
    
    @PostConstruct
    public void init() {
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();
        
        // Optionally connect to all enabled MCP servers on startup
        // Uncomment if you want automatic connection
        // mcpManager.connectAllServers();
        
        logger.info("ClaudeService initialized");
    }
    
    @PreDestroy
    public void cleanup() {
        if (httpClient != null) {
            httpClient.dispatcher().executorService().shutdown();
            httpClient.connectionPool().evictAll();
            logger.info("ClaudeService cleaned up");
        }
    }
    
    @Override
    public ClaudeResponse sendMessage(String userMessage) throws IOException {
        return sendMessage(userMessage, null);
    }
    
    @Override
    public ClaudeResponse sendMessage(String userMessage, List<ClaudeMessage> conversationHistory) throws IOException {
        // Build messages list
        List<ClaudeMessage> messages = new java.util.ArrayList<>();
        
        // Handle conversation history with truncation
        if (conversationHistory != null && !conversationHistory.isEmpty()) {
            // Strategy 1: If RAG is enabled, retrieve relevant context instead of full history
            if (ragService.isEnabled()) {
                List<ClaudeMessage> relevantContext = ragService.retrieveRelevantContext(
                    userMessage, null, 10); // Get top 10 relevant messages
                if (!relevantContext.isEmpty()) {
                    messages.addAll(relevantContext);
                    logger.debug("Using RAG: Retrieved {} relevant messages from vector database", 
                            relevantContext.size());
                } else {
                    // Fallback to truncation if RAG returns nothing
                    List<ClaudeMessage> truncated = historyManager.smartTruncate(conversationHistory, config.getModel());
                    messages.addAll(truncated);
                    logTruncation(conversationHistory.size(), truncated.size());
                }
            } else {
                // Strategy 2: Use truncation (sliding window + token limits)
                List<ClaudeMessage> truncated = historyManager.smartTruncate(conversationHistory, config.getModel());
                messages.addAll(truncated);
                logTruncation(conversationHistory.size(), truncated.size());
            }
        }
        
        // Add user message - this is always required
        if (userMessage == null || userMessage.trim().isEmpty()) {
            throw new IllegalArgumentException("User message cannot be null or empty");
        }
        messages.add(new ClaudeMessage("user", userMessage));
        
        // Final validation - ensure we have at least the user message
        if (messages.isEmpty()) {
            throw new IllegalStateException("Messages list is empty after adding user message");
        }
        
        // Log token estimate for debugging
        int estimatedTokens = historyManager.estimateTokens(messages);
        logger.debug("Estimated tokens in request: {} ({} messages)", estimatedTokens, messages.size());
        
        // Create request
        ClaudeRequest request = new ClaudeRequest(config.getModel(), messages);
        
        // Validate request before sending
        if (request.getMessages() == null || request.getMessages().isEmpty()) {
            throw new IllegalStateException("Request has empty messages list before sending");
        }
        
        return sendRequest(request);
    }
    
    /**
     * Send a direct message without history management (for internal use like summarization).
     * This bypasses truncation and summarization logic to avoid recursion.
     * 
     * @param message The message to send
     * @return ClaudeResponse containing the API response
     * @throws IOException if there's an error communicating with the API
     */
    public ClaudeResponse sendDirectMessage(String message) throws IOException {
        if (message == null || message.trim().isEmpty()) {
            throw new IllegalArgumentException("Message cannot be null or empty");
        }
        
        List<ClaudeMessage> messages = new java.util.ArrayList<>();
        ClaudeMessage userMessage = new ClaudeMessage("user", message);
        messages.add(userMessage);
        
        // Validate we have at least one message
        if (messages.isEmpty()) {
            throw new IllegalStateException("Failed to create message list");
        }
        
        ClaudeRequest request = new ClaudeRequest(config.getModel(), messages);
        
        // Validate request before sending
        if (request.getMessages() == null || request.getMessages().isEmpty()) {
            throw new IllegalStateException("Request has empty messages list");
        }
        
        return sendRequestOnce(request, 0);
    }
    
    /**
     * Log truncation information.
     */
    private void logTruncation(int originalSize, int truncatedSize) {
        if (originalSize > truncatedSize) {
            logger.info("Truncated conversation history from {} to {} messages to fit token limits", 
                    originalSize, truncatedSize);
        }
    }
    
    @Override
    public ClaudeResponse sendRequest(ClaudeRequest request) throws IOException {
        // Validate request
        if (request == null) {
            throw new IllegalArgumentException("Request cannot be null");
        }
        
        if (request.getMessages() == null || request.getMessages().isEmpty()) {
            throw new IllegalArgumentException("Request must contain at least one message");
        }
        
        // Apply truncation to prevent "Input is too long" errors
        List<ClaudeMessage> originalMessages = request.getMessages();
        String modelName = request.getModel() != null ? request.getModel() : config.getModel();
        
        // Apply model-aware truncation
        List<ClaudeMessage> truncatedMessages = historyManager.smartTruncate(originalMessages, modelName);
        
        // Validate truncated messages are not empty
        if (truncatedMessages == null || truncatedMessages.isEmpty()) {
            logger.error("Truncation resulted in empty message list! Original had {} messages. Using original messages.", 
                    originalMessages.size());
            // Use original messages as fallback
            truncatedMessages = originalMessages;
        }
        
        if (truncatedMessages.size() < originalMessages.size()) {
            int originalSize = originalMessages.size();
            int truncatedSize = truncatedMessages.size();
            int estimatedTokens = historyManager.estimateTokens(truncatedMessages);
            logger.warn("Truncated request messages from {} to {} messages ({} tokens) to prevent 'Input is too long' error", 
                    originalSize, truncatedSize, estimatedTokens);
            request.setMessages(truncatedMessages);
        } else {
            // Still log token count for monitoring
            int estimatedTokens = historyManager.estimateTokens(truncatedMessages);
            logger.debug("Request contains {} messages with estimated {} tokens", 
                    truncatedMessages.size(), estimatedTokens);
        }
        
        // Final validation before sending
        if (request.getMessages() == null || request.getMessages().isEmpty()) {
            throw new IllegalStateException("Cannot send request with empty messages list");
        }
        
        // Check if auth token exists, if not try to reload from /tmp/settings.json
        if (config.getAuthToken() == null || config.getAuthToken().isEmpty()) {
            File tmpConfigFile = new File("/tmp/settings.json");
            if (tmpConfigFile.exists()) {
                logger.info("Auth token not found, attempting to reload config from /tmp/settings.json");
                boolean reloaded = config.loadConfigFromPath("/tmp/settings.json");
                if (reloaded && (config.getAuthToken() != null && !config.getAuthToken().isEmpty())) {
                    logger.info("Successfully reloaded config from /tmp/settings.json");
                    
                    // Reload MCP servers after config reload
                    try {
                        // Disconnect all existing MCP servers
                        List<String> connectedServers = mcpManager.getConnectedServers();
                        for (String serverName : connectedServers) {
                            mcpManager.disconnectServer(serverName);
                            logger.debug("Disconnected MCP server: " + serverName);
                        }
                        
                        // Reload MCP server configurations from the updated config
                        mcpManager.reloadMCPServers();
                        
                        // Reconnect all MCP servers from the reloaded config
                        mcpManager.connectAllServers();
                        logger.info("MCP servers reloaded and reconnected");
                    } catch (Exception e) {
                        logger.warn("Failed to reload MCP servers after config reload", e);
                    }
                } else {
                    logger.warn("Failed to load auth token from /tmp/settings.json");
                }
            } else {
                logger.debug("/tmp/settings.json does not exist, skipping config reload");
            }
        }
        
        // Internal method to send request with retry logic (used by retry mechanism)
        return sendRequestOnce(request, 0);
    }
    
    /**
     * Internal method to send a single request with retry logic
     * @param request The request to send
     * @param retryCount Current retry count (0 = first attempt)
     */
    private ClaudeResponse sendRequestOnce(ClaudeRequest request, int retryCount) throws IOException {
        // Prevent infinite retry loops (allow up to 3 retries = 4 total attempts)
        if (retryCount > 3) {
            logger.error("Max retry attempts reached ({}). Giving up to prevent infinite loop.", retryCount);
            throw new IOException("Max retry attempts reached. Request is still too long after multiple truncation attempts.");
        }
        // Final validation before building JSON
        if (request == null) {
            throw new IllegalArgumentException("Request cannot be null");
        }
        
        if (request.getMessages() == null || request.getMessages().isEmpty()) {
            logger.error("Attempting to send request with empty messages list. Model: {}, MaxTokens: {}", 
                    request.getModel(), request.getMaxTokens());
            throw new IllegalArgumentException("Request must contain at least one message");
        }
        
        logger.debug("Sending request with {} messages to model {}", 
                request.getMessages().size(), request.getModel());
        
        // Validate messages before serialization
        List<ClaudeMessage> messagesToSend = request.getMessages();
        if (messagesToSend == null || messagesToSend.isEmpty()) {
            logger.error("Messages list is null or empty before JSON serialization. Request model: {}", 
                    request.getModel());
            throw new IllegalStateException("Cannot serialize request with empty messages list");
        }
        
        logger.debug("Serializing request with {} messages", messagesToSend.size());
        
        String json;
        if (config.isUseBedrock()) {
            // For Bedrock, create a custom JSON payload without model and stream fields
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("max_tokens", request.getMaxTokens());
            payload.put("messages", messagesToSend); // Use validated list
            payload.put("anthropic_version", request.getAnthropicVersion());
            json = objectMapper.writeValueAsString(payload);
        } else {
            json = objectMapper.writeValueAsString(request);
        }
        
        // Validate JSON was created and contains messages
        if (json == null || json.isEmpty()) {
            throw new IllegalStateException("Failed to serialize request to JSON");
        }
        
        // Check for empty messages array in JSON
        if (json.contains("\"messages\":[]") || json.contains("\"messages\": null")) {
            logger.error("JSON payload has empty or null messages array. JSON: {}", json);
            throw new IllegalStateException("JSON payload has empty messages array");
        }
        
        // Verify messages array exists in JSON
        if (!json.contains("\"messages\"")) {
            logger.error("JSON payload missing messages field. JSON: {}", json);
            throw new IllegalStateException("JSON payload missing messages field");
        }
        
        RequestBody body = RequestBody.create(
                MediaType.parse("application/json; charset=utf-8"),
                json
        );
        
        Request.Builder requestBuilder = new Request.Builder()
                .url(config.getApiUrl())
                .post(body);
        
        // Add headers based on configuration
        if (config.isUseBedrock()) {
            // For Bedrock, we need to use x-api-key header and anthropic_version
            requestBuilder.addHeader("x-api-key", config.getAuthToken());
            requestBuilder.addHeader("Content-Type", "application/json");
            requestBuilder.addHeader("anthropic_version", "2023-06-01");
        } else {
            requestBuilder.addHeader("x-api-key", config.getAuthToken());
            requestBuilder.addHeader("Content-Type", "application/json");
            requestBuilder.addHeader("anthropic-version", "2023-06-01");
        }
        
        Request httpRequest = requestBuilder.build();
        
        // Debug output
        logger.debug("=== API Request Debug ===");
        logger.debug("URL: " + httpRequest.url());
        logger.debug("Method: " + httpRequest.method());
        logger.debug("Headers: " + httpRequest.headers());
        logger.debug("Body: " + json);
        logger.debug("========================");
        
        try (Response response = httpClient.newCall(httpRequest).execute()) {
            if (!response.isSuccessful()) {
                String errorBody = response.body() != null ? response.body().string() : "Unknown error";
                logger.error("Claude API error: HTTP {} - {}", response.code(), errorBody);
                
                // Handle "Input is too long" error with automatic retry
                if (errorBody.contains("Input is too long") || errorBody.contains("input_too_long") 
                        || errorBody.contains("context_length_exceeded") || errorBody.contains("Input is too long for requested model")) {
                    
                    if (retryCount >= 2) {
                        logger.error("Input too long error persists after {} retries. Using final fallback: last message only.", retryCount);
                        // Last resort: keep only the user's current message, and truncate its content if needed
                        if (request != null && request.getMessages() != null && !request.getMessages().isEmpty()) {
                            ClaudeMessage lastMessage = request.getMessages().get(request.getMessages().size() - 1);
                            
                            // If even the last message is too long, truncate its content
                            String messageContent = lastMessage.getContent();
                            if (messageContent != null) {
                                int messageTokens = tokenCounter.countTokens(messageContent);
                                
                                // If message is very long (>30k tokens), truncate it aggressively
                                if (messageTokens > 30000) {
                                    logger.warn("Last message is also very long ({} tokens), truncating content", messageTokens);
                                    // Keep first 500 characters and last 500 characters (total ~1000 chars = ~250 tokens)
                                    if (messageContent.length() > 1000) {
                                        messageContent = messageContent.substring(0, 500) + 
                                                "\n\n[... content truncated due to length - keeping only beginning and end ...]\n\n" + 
                                                messageContent.substring(messageContent.length() - 500);
                                    }
                                    lastMessage = new ClaudeMessage(lastMessage.getRole(), messageContent);
                                }
                            }
                            
                            List<ClaudeMessage> singleMessage = new java.util.ArrayList<>();
                            singleMessage.add(lastMessage);
                            request.setMessages(singleMessage);
                            
                            int finalTokens = tokenCounter.countTokens(singleMessage);
                            logger.warn("Final retry (attempt {}): sending only the last message ({} tokens).", 
                                    retryCount + 1, finalTokens);
                            
                            // This is the absolute last attempt - if this fails, we give up
                            return sendRequestOnce(request, retryCount + 1);
                        } else {
                            logger.error("Cannot perform final fallback - request has no messages");
                            throw new IOException("Request is too long and has no messages to send.");
                        }
                    }
                    
                    logger.warn("Input too long error detected (retry {}), attempting retry with more aggressive truncation", retryCount + 1);
                    
                    // Retry with very aggressive truncation
                    if (request != null && request.getMessages() != null && !request.getMessages().isEmpty()) {
                        List<ClaudeMessage> originalMessages = request.getMessages();
                        int originalSize = originalMessages.size();
                        int currentTokens = historyManager.estimateTokens(originalMessages);
                        
                        // Progressively more aggressive: reduce by 70% each retry
                        double reductionFactor = Math.pow(0.3, retryCount + 1); // 0.3, 0.09, 0.027...
                        int newMaxTokens = Math.max(2000, (int)(currentTokens * reductionFactor)); // At least 2k tokens
                        int newMaxMessages = Math.max(1, (int)(originalSize * reductionFactor)); // At least 1 message
                        
                        logger.warn("Retry {}: Current request has {} messages (~{} tokens). Retrying with max {} messages and {} tokens", 
                                retryCount + 1, originalSize, currentTokens, newMaxMessages, newMaxTokens);
                        
                        List<ClaudeMessage> moreAggressivelyTruncated = historyManager.smartTruncate(
                            originalMessages, newMaxMessages, newMaxTokens);
                        
                        // Ensure we have at least one message (keep the last one - the user's current message)
                        if (moreAggressivelyTruncated == null || moreAggressivelyTruncated.isEmpty()) {
                            logger.warn("Aggressive truncation resulted in empty list, keeping last message only");
                            ClaudeMessage lastMessage = originalMessages.get(originalMessages.size() - 1);
                            moreAggressivelyTruncated = new java.util.ArrayList<>();
                            moreAggressivelyTruncated.add(lastMessage);
                        }
                        
                        request.setMessages(moreAggressivelyTruncated);
                        logger.info("Retry {}: Retrying with {} messages and max {} tokens (reduced from {} messages, ~{} tokens)", 
                                retryCount + 1, moreAggressivelyTruncated.size(), newMaxTokens, originalSize, currentTokens);
                        
                        // Recursively retry with incremented counter
                        return sendRequestOnce(request, retryCount + 1);
                    }
                }
                
                throw new IOException("HTTP " + response.code() + ": " + errorBody);
            }
            
            String responseBody = response.body().string();
            return objectMapper.readValue(responseBody, ClaudeResponse.class);
        }
    }
    
    /**
     * Call an MCP tool
     * 
     * @param toolName The name of the tool to call
     * @param arguments The arguments for the tool
     * @return The result from the tool
     */
    public String callMCPTool(String toolName, Map<String, Object> arguments) {
        if (arguments == null) {
            arguments = new HashMap<>();
        }
        return mcpManager.callTool(toolName, arguments);
    }
    
    /**
     * Call an MCP tool on a specific server
     * 
     * @param serverName The name of the MCP server
     * @param toolName The name of the tool to call
     * @param arguments The arguments for the tool
     * @return The result from the tool
     */
    public String callMCPTool(String serverName, String toolName, Map<String, Object> arguments) {
        if (arguments == null) {
            arguments = new HashMap<>();
        }
        return mcpManager.callTool(serverName, toolName, arguments);
    }
    
    /**
     * Get all available MCP tools from all connected servers
     * 
     * @return Map of tool names to MCPTool objects
     */
    public Map<String, MCPTool> getAvailableMCPTools() {
        return mcpManager.getAllAvailableTools();
    }
    
    /**
     * Get available MCP tools from a specific server
     * 
     * @param serverName The name of the MCP server
     * @return Map of tool names to MCPTool objects
     */
    public Map<String, MCPTool> getAvailableMCPTools(String serverName) {
        return mcpManager.getAvailableTools(serverName);
    }
    
    /**
     * Connect to an MCP server
     * 
     * @param serverName The name of the server to connect to
     * @return true if connection was successful
     */
    public boolean connectMCPServer(String serverName) {
        return mcpManager.connectServer(serverName);
    }
    
    /**
     * Connect to all enabled MCP servers
     */
    public void connectAllMCPServers() {
        mcpManager.connectAllServers();
    }
    
    /**
     * Disconnect from an MCP server
     * 
     * @param serverName The name of the server to disconnect from
     */
    public void disconnectMCPServer(String serverName) {
        mcpManager.disconnectServer(serverName);
    }
    
    /**
     * Get list of connected MCP servers
     * 
     * @return List of server names
     */
    public List<String> getConnectedMCPServers() {
        return mcpManager.getConnectedServers();
    }
    
    /**
     * Get list of configured MCP servers
     * 
     * @return List of server names
     */
    public List<String> getConfiguredMCPServers() {
        return mcpManager.getConfiguredServers();
    }
    
    /**
     * Check if an MCP server is connected
     * 
     * @param serverName The name of the server
     * @return true if the server is connected
     */
    public boolean isMCPServerConnected(String serverName) {
        return mcpManager.isServerConnected(serverName);
    }
    
    /**
     * Send a message to Claude with MCP tool context
     * This method enhances the user message with information about available MCP tools
     * 
     * @param userMessage The user's message
     * @param includeMCPContext Whether to include MCP tool information in the message
     * @return ClaudeResponse containing the API response
     * @throws IOException if there's an error communicating with the API
     */
    public ClaudeResponse sendMessageWithMCPContext(String userMessage, boolean includeMCPContext) throws IOException {
        if (includeMCPContext) {
            Map<String, MCPTool> tools = getAvailableMCPTools();
            if (!tools.isEmpty()) {
                StringBuilder context = new StringBuilder(userMessage);
                context.append("\n\nAvailable MCP Tools:\n");
                for (MCPTool tool : tools.values()) {
                    context.append("- ").append(tool.getName());
                    if (tool.getDescription() != null && !tool.getDescription().isEmpty()) {
                        context.append(": ").append(tool.getDescription());
                    }
                    context.append("\n");
                }
                userMessage = context.toString();
            }
        }
        return sendMessage(userMessage);
    }
}

