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
import server.investigation.InvestigateConnectionPoolIssues;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;

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
    private final InvestigateConnectionPoolIssues investigateConnectionPoolIssues;
    private OkHttpClient httpClient;
    
    @Autowired
    public ClaudeService(ClaudeConfig config, MCPManager mcpManager, 
                        ConversationHistoryManager historyManager, RAGService ragService,
                        TokenCounter tokenCounter, InvestigateConnectionPoolIssues investigateConnectionPoolIssues) {
        this.config = config;
        this.mcpManager = mcpManager;
        this.historyManager = historyManager;
        this.ragService = ragService;
        this.tokenCounter = tokenCounter;
        this.investigateConnectionPoolIssues = investigateConnectionPoolIssues;
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
     * Includes both external MCP server tools and local tools
     * 
     * @return Map of tool names to MCPTool objects
     */
    public Map<String, MCPTool> getAvailableMCPTools() {
        Map<String, MCPTool> tools = new HashMap<>(mcpManager.getAllAvailableTools());
        
        // Add the local connection pool investigation tool
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> toolSchema = (Map<String, Object>) investigateConnectionPoolIssues.getToolSchema().get("inputSchema");
            MCPTool connectionPoolTool = new MCPTool();
            connectionPoolTool.setName("investigate_connection_pool_issues");
            connectionPoolTool.setDescription("Investigate connection pool issues by analyzing jstacks. Use this tool when asked to analyze jstacks, investigate connection pools, or debug thread issues. Requires: cellName (cell name), host (host or kpod name), startTime (epoch milliseconds), endTime (epoch milliseconds).");
            connectionPoolTool.setInputSchema(toolSchema);
            tools.put("investigate_connection_pool_issues", connectionPoolTool);
            logger.debug("Added local tool 'investigate_connection_pool_issues' to available MCP tools");
        } catch (Exception e) {
            logger.warn("Failed to add local connection pool investigation tool to MCP tools: {}", e.getMessage());
        }
        
        return tools;
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
    
    /**
     * Process Step 2 message with batched panel data to handle length constraints
     * 
     * @param userMessage Original user question
     * @param conversationHistory Step 1 conversation history
     * @param panelIds List of panel IDs to process
     * @param panelData Map of panel ID to panel data
     * @return Final consolidated response
     * @throws IOException if there's an error communicating with the API
     */
    public ClaudeResponse processStep2Batched(
            String userMessage,
            List<ClaudeMessage> conversationHistory,
            List<String> panelIds,
            Map<String, Object> panelData) throws IOException {
        
        logger.info("Processing Step 2 batched: {} panels, {} history messages", 
                panelIds.size(), conversationHistory != null ? conversationHistory.size() : 0);
        
        // Load templates
        String step2Template = loadTemplate("dashboard-assistant-templates/step2-data-template.json");
        String step3Template = loadTemplate("dashboard-assistant-templates/step3-consolidation-template.json");
        
        // Token limit: 85000 tokens (as specified)
        final int TOKEN_LIMIT = 85000;
        
        // Filter history to only include assistant responses (skip user messages to save tokens)
        // User messages are redundant since Step 2 message already includes the current user question and panel data
        // But assistant responses may contain useful context
        List<ClaudeMessage> filteredHistory = new java.util.ArrayList<>();
        if (conversationHistory != null && !conversationHistory.isEmpty()) {
            for (ClaudeMessage msg : conversationHistory) {
                if ("assistant".equals(msg.getRole())) {
                    filteredHistory.add(msg);
                }
            }
            logger.info("Step 2 filtered history: {} total messages -> {} assistant messages (skipped {} user messages)", 
                    conversationHistory.size(), filteredHistory.size(), conversationHistory.size() - filteredHistory.size());
        }
        
        // Estimate history tokens for filtered history (assistant responses only)
        int historyTokens = historyManager.estimateTokens(filteredHistory);
        
        // Reserve tokens for history + response buffer (leave ~5000 for response)
        int reservedTokens = historyTokens + 5000;
        int availableTokens = TOKEN_LIMIT - reservedTokens;
        
        // Ensure we have at least some tokens available for data
        if (availableTokens < 1000) {
            logger.warn("Very little token budget available ({}), filtered history is large ({} tokens)", 
                    availableTokens, historyTokens);
            availableTokens = Math.max(1000, TOKEN_LIMIT - historyTokens - 5000);
        }
        
        logger.info("Token budget: limit={}, history={}, reserved={}, available={}", 
                TOKEN_LIMIT, historyTokens, reservedTokens, availableTokens);
        
        // Batch panels based on data size
        List<List<String>> batches = createBatches(panelIds, panelData, step2Template, userMessage, availableTokens);
        logger.info("Created {} batches for {} panels", batches.size(), panelIds.size());
        
        // Process batches in parallel (max 8 concurrent)
        final int MAX_CONCURRENT_BATCHES = 8;
        ExecutorService executor = Executors.newFixedThreadPool(MAX_CONCURRENT_BATCHES);
        
        try {
            // Create CompletableFuture for each batch
            List<CompletableFuture<String>> batchFutures = new java.util.ArrayList<>();
            
            for (int i = 0; i < batches.size(); i++) {
                final int batchIndex = i;
                final List<String> batch = batches.get(i);
                
                CompletableFuture<String> batchFuture = CompletableFuture.supplyAsync(() -> {
                    try {
                        logger.info("Processing batch {}/{} with {} panels", batchIndex + 1, batches.size(), batch.size());
                        
                        // Create batch data
                        Map<String, Object> batchData = new java.util.HashMap<>();
                        for (String panelId : batch) {
                            batchData.put(panelId, panelData.get(panelId));
                        }
                        
                        // Build Step 2 message for this batch
                        String batchMessage = buildStep2Message(step2Template, userMessage, batchData);
                        
                        // Validate token count before sending to avoid retries
                        int batchMessageTokens = tokenCounter.countTokens(batchMessage);
                        int totalTokens = historyTokens + batchMessageTokens;
                        
                        if (totalTokens > TOKEN_LIMIT) {
                            logger.warn("Batch {}/{} exceeds token limit: total={} (history={} + message={}) > limit={}. Reducing batch size...", 
                                    batchIndex + 1, batches.size(), totalTokens, historyTokens, batchMessageTokens, TOKEN_LIMIT);
                            
                            // Reduce batch size and retry
                            int maxTokensForBatch = TOKEN_LIMIT - historyTokens - 1000; // Leave 1000 token buffer
                            List<String> reducedBatch = reduceBatchSize(batch, batchData, step2Template, userMessage, maxTokensForBatch);
                            
                            if (reducedBatch.isEmpty()) {
                                logger.error("Cannot create valid batch for panels: {}", batch);
                                return null; // Skip this batch
                            }
                            
                            // Rebuild message with reduced batch
                            Map<String, Object> reducedBatchData = new java.util.HashMap<>();
                            for (String panelId : reducedBatch) {
                                reducedBatchData.put(panelId, panelData.get(panelId));
                            }
                            batchMessage = buildStep2Message(step2Template, userMessage, reducedBatchData);
                            batchMessageTokens = tokenCounter.countTokens(batchMessage);
                            totalTokens = historyTokens + batchMessageTokens;
                            
                            logger.info("Reduced batch to {} panels, new token count: total={} (history={} + message={})", 
                                    reducedBatch.size(), totalTokens, historyTokens, batchMessageTokens);
                        }
                        
                        // Final validation before sending
                        if (totalTokens > TOKEN_LIMIT) {
                            logger.error("Batch {}/{} still exceeds token limit after reduction: {} > {}. Skipping batch.", 
                                    batchIndex + 1, batches.size(), totalTokens, TOKEN_LIMIT);
                            return null; // Skip this batch
                        }
                        
                        logger.debug("Batch {}/{} token count: total={} (history={} + message={}) <= limit={}", 
                                batchIndex + 1, batches.size(), totalTokens, historyTokens, batchMessageTokens, TOKEN_LIMIT);
                        
                        // Send to Claude (now guaranteed to be within limit)
                        // Use filtered history (assistant responses only) - user messages are redundant
                        ClaudeResponse batchResponse = sendMessage(batchMessage, filteredHistory);
                        String batchResponseText = extractTextFromResponse(batchResponse);
                        
                        logger.debug("Batch {}/{} completed, response length: {} chars", batchIndex + 1, batches.size(), batchResponseText.length());
                        return batchResponseText;
                    } catch (Exception e) {
                        logger.error("Error processing batch {}/{}: {}", batchIndex + 1, batches.size(), e.getMessage(), e);
                        return null;
                    }
                }, executor);
                
                batchFutures.add(batchFuture);
            }
            
            // Wait for all batches to complete and collect responses (maintain order)
            List<String> batchResponses = new java.util.ArrayList<>();
            for (CompletableFuture<String> future : batchFutures) {
                try {
                    String response = future.get(); // Wait for completion
                    if (response != null) {
                        batchResponses.add(response);
                    }
                } catch (InterruptedException | ExecutionException e) {
                    logger.error("Error waiting for batch completion: {}", e.getMessage(), e);
                }
            }
            
            logger.info("Completed {} batches in parallel, collected {} responses", batches.size(), batchResponses.size());
            
            // Check if we have any responses
            if (batchResponses.isEmpty()) {
                logger.error("No batch responses generated. All batches may have been skipped due to token limits.");
                return createTextResponse("I apologize, but I was unable to process the panel data due to size constraints. Please try with fewer panels or a shorter time range.");
            }
            
            // Consolidate responses using Step 3 template
            if (batchResponses.size() == 1) {
                // Single batch, return directly
                return createTextResponse(batchResponses.get(0));
            }
            
            logger.info("Consolidating {} batch responses", batchResponses.size());
            String consolidationMessage = buildStep3Message(step3Template, userMessage, batchResponses, panelIds);
            
            // Validate consolidation message token count before sending
            int consolidationTokens = tokenCounter.countTokens(consolidationMessage);
            int consolidationTotalTokens = historyTokens + consolidationTokens;
            
            if (consolidationTotalTokens > TOKEN_LIMIT) {
                logger.warn("Consolidation message exceeds token limit: total={} (history={} + message={}) > limit={}. Truncating batch responses...", 
                        consolidationTotalTokens, historyTokens, consolidationTokens, TOKEN_LIMIT);
                
                // Truncate batch responses to fit within limit
                List<String> truncatedResponses = truncateBatchResponses(batchResponses, 
                        TOKEN_LIMIT - historyTokens - 2000); // Leave 2000 tokens for template and structure
                
                consolidationMessage = buildStep3Message(step3Template, userMessage, truncatedResponses, panelIds);
                consolidationTokens = tokenCounter.countTokens(consolidationMessage);
                consolidationTotalTokens = historyTokens + consolidationTokens;
                
                logger.info("Truncated batch responses, new token count: total={} (history={} + message={})", 
                        consolidationTotalTokens, historyTokens, consolidationTokens);
            }
            
            // Final validation
            if (consolidationTotalTokens > TOKEN_LIMIT) {
                logger.error("Consolidation message still exceeds token limit after truncation: {} > {}. Using last batch response only.", 
                        consolidationTotalTokens, TOKEN_LIMIT);
                // Fallback: return the last batch response
                if (!batchResponses.isEmpty()) {
                    return createTextResponse(batchResponses.get(batchResponses.size() - 1));
                }
            }
            
            logger.debug("Consolidation token count: total={} (history={} + message={}) <= limit={}", 
                    consolidationTotalTokens, historyTokens, consolidationTokens, TOKEN_LIMIT);
            
            // Use filtered history (assistant responses only) for consolidation
            ClaudeResponse finalResponse = sendMessage(consolidationMessage, filteredHistory);
            
            return finalResponse;
        } finally {
            // Shutdown executor
            executor.shutdown();
            try {
                if (!executor.awaitTermination(60, TimeUnit.SECONDS)) {
                    executor.shutdownNow();
                }
            } catch (InterruptedException e) {
                executor.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
    }
    
    /**
     * Process Step 1 message with batched panel metadata to handle length constraints
     * Similar to processStep2Batched but for panel metadata instead of timeseries data
     */
    @Override
    public ClaudeResponse processStep1Batched(
            String userMessage,
            List<ClaudeMessage> conversationHistory,
            List<Map<String, Object>> panelMetadata) throws IOException {
        
        // Filter history to only include assistant responses (skip user messages to save tokens)
        // User messages are redundant since Step 1 message already includes the current user question and panel metadata
        // But assistant responses may contain useful context
        List<ClaudeMessage> filteredHistory = new java.util.ArrayList<>();
        if (conversationHistory != null && !conversationHistory.isEmpty()) {
            for (ClaudeMessage msg : conversationHistory) {
                if ("assistant".equals(msg.getRole())) {
                    filteredHistory.add(msg);
                }
            }
            logger.info("Step 1 filtered history: {} total messages -> {} assistant messages (skipped {} user messages)", 
                    conversationHistory.size(), filteredHistory.size(), conversationHistory.size() - filteredHistory.size());
        }
        
        logger.info("Processing Step 1 batched: {} panels, {} filtered history messages (assistant responses only)", 
                panelMetadata.size(), filteredHistory.size());
        
        // Load Step 1 template
        String step1Template = loadTemplate("dashboard-assistant-templates/step1-metadata-template.json");
        if (step1Template == null) {
            logger.warn("Step 1 template not found, using fallback");
            step1Template = "You are a dashboard analyzer. This is a TWO-STEP process:\n\nSTEP 1 (THIS MESSAGE): Identify panel IDs needed - respond with ONLY comma-separated panel IDs using the EXACT IDs shown below (e.g., \"{exampleFormat}\" or \"none\")\nSTEP 2 (NEXT MESSAGE): You will receive the actual timeseries data from those panels, then analyze and answer\n\nDashboard has {panelCount} panels:\n\n{panelMetadataList}\n\nUser question: \"{userMessage}\"\n\nCONTEXT-AWARE PANEL IDENTIFICATION:\n- Carefully examine panel Titles, Descriptions, Categories, and Series names to identify relevant panels\n- Match keywords from the user's question to panel metadata (e.g., \"Availability\" matches panels with \"Availability\" in title/category/description)\n- Consider panel Categories (Parent titles) when questions mention categories or groupings\n- Look for series/metric names that match the question (e.g., questions about specific metrics should match Series names)\n- If the question asks about \"what are X metrics\" or \"what metrics are in X\", identify panels that contain those metrics based on Titles, Descriptions, Categories, and Series names\n\nCRITICAL RULES - FOLLOW EXACTLY:\n1. Your response MUST be ONLY comma-separated panel IDs or the word \"none\" - nothing else\n2. Use ONLY the EXACT Panel ID values from the list above (e.g., \"p1\", \"p2\", \"p8\")\n3. Do NOT include any explanations, questions, or additional text\n4. Do NOT use panel titles, descriptions, or DOM IDs\n5. If you cannot determine which panels are needed, respond with \"none\"\n6. If panels are needed: respond with exactly: {exampleFormat} (comma-separated, no spaces or quotes)\n7. If no panels are needed: respond with exactly: none\n\nVALID RESPONSE FORMATS (choose one):\n- {exampleFormat}\n- {firstPanelId}\n- none\n\nYOUR RESPONSE MUST BE:\n- Either: comma-separated panel IDs (e.g., \"p1,p2,p3\") with NO spaces, NO quotes, NO explanations\n- Or: the single word \"none\"\n- Nothing else. No prefixes, no suffixes, no additional text.\n\nRespond now (ONLY panel IDs or \"none\"):";
        }
        
        // Token limit: 85000 tokens
        final int TOKEN_LIMIT = 85000;
        
        // Estimate history tokens for filtered history (assistant responses only)
        int historyTokens = historyManager.estimateTokens(filteredHistory);
        
        // Reserve tokens for history + response buffer (leave ~5000 for response)
        int reservedTokens = historyTokens + 5000;
        int availableTokens = TOKEN_LIMIT - reservedTokens;
        
        // Ensure we have at least some tokens available
        if (availableTokens < 1000) {
            logger.warn("Very little token budget available ({}), history is large ({} tokens)", 
                    availableTokens, historyTokens);
            availableTokens = Math.max(1000, TOKEN_LIMIT - historyTokens - 5000);
        }
        
        logger.info("Token budget: limit={}, history={}, reserved={}, available={}", 
                TOKEN_LIMIT, historyTokens, reservedTokens, availableTokens);
        
        // Batch panel metadata based on size
        List<List<Map<String, Object>>> batches = createStep1Batches(panelMetadata, step1Template, userMessage, availableTokens);
        logger.info("Created {} batches for {} panels", batches.size(), panelMetadata.size());
        
        // Process each batch and collect responses
        List<String> batchResponses = new java.util.ArrayList<>();
        for (int i = 0; i < batches.size(); i++) {
            List<Map<String, Object>> batch = batches.get(i);
            logger.info("Processing batch {}/{} with {} panels", i + 1, batches.size(), batch.size());
            
            // Build Step 1 message for this batch
            String batchMessage = buildStep1Message(step1Template, userMessage, batch);
            
            // Validate token count before sending
            int batchMessageTokens = tokenCounter.countTokens(batchMessage);
            int totalTokens = historyTokens + batchMessageTokens;
            
            if (totalTokens > TOKEN_LIMIT) {
                logger.warn("Batch {}/{} exceeds token limit: total={} (history={} + message={}) > limit={}. Reducing batch size...", 
                        i + 1, batches.size(), totalTokens, historyTokens, batchMessageTokens, TOKEN_LIMIT);
                
                // Reduce batch size and retry
                int maxTokensForBatch = TOKEN_LIMIT - historyTokens - 1000;
                List<Map<String, Object>> reducedBatch = reduceStep1BatchSize(batch, step1Template, userMessage, maxTokensForBatch);
                
                if (reducedBatch.isEmpty()) {
                    logger.error("Cannot create valid batch for panels: {}", batch.size());
                    continue; // Skip this batch
                }
                
                batchMessage = buildStep1Message(step1Template, userMessage, reducedBatch);
                batchMessageTokens = tokenCounter.countTokens(batchMessage);
                totalTokens = historyTokens + batchMessageTokens;
                
                logger.info("Reduced batch to {} panels, new token count: total={} (history={} + message={})", 
                        reducedBatch.size(), totalTokens, historyTokens, batchMessageTokens);
                
                batch = reducedBatch;
            }
            
            // Final validation before sending
            if (totalTokens > TOKEN_LIMIT) {
                logger.error("Batch {}/{} still exceeds token limit after reduction: {} > {}. Skipping batch.", 
                        i + 1, batches.size(), totalTokens, TOKEN_LIMIT);
                continue;
            }
            
            logger.debug("Batch {}/{} token count: total={} (history={} + message={}) <= limit={}", 
                    i + 1, batches.size(), totalTokens, historyTokens, batchMessageTokens, TOKEN_LIMIT);
            
            // Send to Claude with filtered history (assistant responses only)
            ClaudeResponse batchResponse = sendMessage(batchMessage, filteredHistory);
            String batchResponseText = extractTextFromResponse(batchResponse);
            batchResponses.add(batchResponseText);
            
            logger.info("Batch {}/{} completed, response length: {}", i + 1, batches.size(), batchResponseText.length());
        }
        
        // Check if we have any responses
        if (batchResponses.isEmpty()) {
            logger.error("No batch responses generated. All batches may have been skipped due to token limits.");
            return createTextResponse("none");
        }
        
        // Consolidate responses - extract panel IDs from each batch response and combine
        if (batchResponses.size() == 1) {
            // Single batch, return directly
            return createTextResponse(batchResponses.get(0));
        }
        
        logger.info("Consolidating {} batch responses", batchResponses.size());
        
        // Extract panel IDs from each batch response and combine them
        List<String> allPanelIds = new java.util.ArrayList<>();
        for (String batchResponse : batchResponses) {
            // Parse panel IDs from response (comma-separated)
            String cleanResponse = batchResponse.trim()
                    .replaceAll("^[\"']|[\"']$", "") // Remove surrounding quotes
                    .replaceAll("^```[\\w]*\\n?|\\n?```$", "") // Remove code blocks
                    .replaceAll("(?i)^panel\\s*ids?[:\\s]+", "") // Remove "Panel IDs:" prefix (case-insensitive)
                    .trim();
            
            if (cleanResponse.equalsIgnoreCase("none")) {
                continue; // Skip "none" responses
            }
            
            // Split by comma and add to list
            String[] ids = cleanResponse.split(",");
            for (String id : ids) {
                String trimmedId = id.trim();
                if (!trimmedId.isEmpty() && !allPanelIds.contains(trimmedId)) {
                    allPanelIds.add(trimmedId);
                }
            }
        }
        
        // Combine all panel IDs into final response
        String finalResponse = allPanelIds.isEmpty() ? "none" : String.join(",", allPanelIds);
        logger.info("Consolidated {} panel IDs from {} batches", allPanelIds.size(), batchResponses.size());
        
        return createTextResponse(finalResponse);
    }
    
    /**
     * Create batches of panel metadata based on size
     */
    private List<List<Map<String, Object>>> createStep1Batches(
            List<Map<String, Object>> panelMetadata,
            String step1Template,
            String userMessage,
            int maxTokensPerBatch) {
        
        List<List<Map<String, Object>>> batches = new java.util.ArrayList<>();
        List<Map<String, Object>> currentBatch = new java.util.ArrayList<>();
        int currentBatchTokens = 0;
        
        for (Map<String, Object> panel : panelMetadata) {
            // Estimate tokens for this panel
            String testMessage = buildStep1Message(step1Template, userMessage, java.util.Collections.singletonList(panel));
            int panelTokens = tokenCounter.countTokens(testMessage);
            
            // If single panel exceeds limit, add it anyway (will be handled by validation)
            if (panelTokens > maxTokensPerBatch && currentBatch.isEmpty()) {
                logger.warn("Panel {} exceeds token limit ({}), adding as single batch", 
                        panel.get("id"), panelTokens);
                batches.add(java.util.Collections.singletonList(panel));
                continue;
            }
            
            // Check if adding this panel would exceed limit
            if (currentBatchTokens + panelTokens > maxTokensPerBatch && !currentBatch.isEmpty()) {
                // Start new batch
                batches.add(new java.util.ArrayList<>(currentBatch));
                currentBatch.clear();
                currentBatchTokens = 0;
            }
            
            currentBatch.add(panel);
            currentBatchTokens += panelTokens;
        }
        
        // Add remaining panels as final batch
        if (!currentBatch.isEmpty()) {
            batches.add(currentBatch);
        }
        
        return batches;
    }
    
    /**
     * Build Step 1 message from template and panel metadata
     */
    private String buildStep1Message(String template, String userMessage, List<Map<String, Object>> panelMetadata) {
        if (template == null || panelMetadata == null || panelMetadata.isEmpty()) {
            return "User question: \"" + userMessage + "\"\n\nNo panel metadata available.";
        }
        
        // Format panel metadata list
        StringBuilder panelMetadataList = new StringBuilder();
        for (Map<String, Object> panel : panelMetadata) {
            panelMetadataList.append("Panel ID: ").append(panel.get("id")).append("\n");
            panelMetadataList.append("Title: ").append(panel.get("title")).append("\n");
            panelMetadataList.append("Description: ").append(panel.getOrDefault("description", "No description")).append("\n");
            panelMetadataList.append("Type: ").append(panel.get("type")).append("\n");
            
            // Add category (parent title) if available (for child panels)
            if (panel.containsKey("parentTitle") && panel.get("parentTitle") != null) {
                panelMetadataList.append("Category: ").append(panel.get("parentTitle")).append("\n");
            }
            
            // Add stat value if available
            if (panel.containsKey("statValue") && panel.get("statValue") != null) {
                panelMetadataList.append("Stat Value: ").append(panel.get("statValue")).append("\n");
            }
            
            // Add series if available
            Object seriesObj = panel.get("series");
            if (seriesObj != null) {
                if (seriesObj instanceof List) {
                    @SuppressWarnings("unchecked")
                    List<String> series = (List<String>) seriesObj;
                    panelMetadataList.append("Series: ").append(String.join(", ", series)).append("\n");
                } else if (seriesObj instanceof String) {
                    panelMetadataList.append("Series: ").append(seriesObj).append("\n");
                }
            } else {
                panelMetadataList.append("Series: No series\n");
            }
            
            panelMetadataList.append("\n---\n\n");
        }
        
        // Build example panel IDs
        String exampleFormat = panelMetadata.stream()
                .limit(3)
                .map(p -> String.valueOf(p.get("id")))
                .reduce((a, b) -> a + "," + b)
                .orElse("p1,p2");
        String firstPanelId = panelMetadata.isEmpty() ? "p1" : String.valueOf(panelMetadata.get(0).get("id"));
        
        // Replace template variables
        String message = template.replace("{userMessage}", userMessage)
                .replace("{panelCount}", String.valueOf(panelMetadata.size()))
                .replace("{panelMetadataList}", panelMetadataList.toString())
                .replace("{exampleFormat}", exampleFormat)
                .replace("{firstPanelId}", firstPanelId);
        
        return message;
    }
    
    /**
     * Reduce Step 1 batch size to fit within token limit
     */
    private List<Map<String, Object>> reduceStep1BatchSize(
            List<Map<String, Object>> batch,
            String step1Template,
            String userMessage,
            int maxTokens) {
        
        List<Map<String, Object>> reducedBatch = new java.util.ArrayList<>(batch);
        int attempts = 0;
        int maxAttempts = 10;
        
        while (attempts < maxAttempts && !reducedBatch.isEmpty()) {
            String testMessage = buildStep1Message(step1Template, userMessage, reducedBatch);
            int testTokens = tokenCounter.countTokens(testMessage);
            
            if (testTokens <= maxTokens) {
                logger.debug("Reduced Step 1 batch to {} panels, token count: {}", reducedBatch.size(), testTokens);
                return reducedBatch;
            }
            
            // Remove last panel and try again
            reducedBatch.remove(reducedBatch.size() - 1);
            attempts++;
        }
        
        // If still too large, try with just the first panel
        if (reducedBatch.isEmpty() && !batch.isEmpty()) {
            reducedBatch.add(batch.get(0));
            logger.warn("Reduced Step 1 batch to single panel: {}", batch.get(0).get("id"));
        }
        
        return reducedBatch;
    }
    
    /**
     * Load template from resources
     */
    @SuppressWarnings("unchecked")
    private String loadTemplate(String resourcePath) {
        try {
            java.io.InputStream resourceStream = getClass().getClassLoader()
                    .getResourceAsStream(resourcePath);
            if (resourceStream == null) {
                logger.warn("Template not found: {}", resourcePath);
                return null;
            }
            
            java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
            byte[] data = new byte[1024];
            int nRead;
            while ((nRead = resourceStream.read(data, 0, data.length)) != -1) {
                buffer.write(data, 0, nRead);
            }
            buffer.flush();
            String content = new String(buffer.toByteArray(), java.nio.charset.StandardCharsets.UTF_8);
            resourceStream.close();
            
            // Parse JSON and extract template
            Map<String, Object> templateJson = (Map<String, Object>) objectMapper.readValue(content, Map.class);
            if (templateJson.containsKey("template")) {
                return (String) templateJson.get("template");
            } else if (templateJson.containsKey("templateWithData")) {
                return (String) templateJson.get("templateWithData");
            }
            return null;
        } catch (Exception e) {
            logger.error("Error loading template {}: {}", resourcePath, e.getMessage());
            return null;
        }
    }
    
    /**
     * Create batches of panels based on data size
     */
    private List<List<String>> createBatches(
            List<String> panelIds,
            Map<String, Object> panelData,
            String step2Template,
            String userMessage,
            int maxTokensPerBatch) {
        
        List<List<String>> batches = new java.util.ArrayList<>();
        List<String> currentBatch = new java.util.ArrayList<>();
        int currentBatchTokens = 0;
        
        for (String panelId : panelIds) {
            Object panelDataObj = panelData.get(panelId);
            if (panelDataObj == null) continue;
            
            // Estimate tokens for this panel
            String testMessage = buildStep2Message(step2Template, userMessage, 
                    java.util.Collections.singletonMap(panelId, panelDataObj));
            int panelTokens = tokenCounter.countTokens(testMessage);
            
            // If single panel exceeds limit, add it anyway (will be handled by validation before sending)
            if (panelTokens > maxTokensPerBatch && currentBatch.isEmpty()) {
                logger.warn("Panel {} exceeds token limit ({}), adding as single batch (will be validated before sending)", 
                        panelId, panelTokens);
                batches.add(java.util.Collections.singletonList(panelId));
                continue;
            }
            
            // Check if adding this panel would exceed limit
            if (currentBatchTokens + panelTokens > maxTokensPerBatch && !currentBatch.isEmpty()) {
                // Start new batch
                batches.add(new java.util.ArrayList<>(currentBatch));
                currentBatch.clear();
                currentBatchTokens = 0;
            }
            
            currentBatch.add(panelId);
            currentBatchTokens += panelTokens;
        }
        
        // Add remaining panels
        if (!currentBatch.isEmpty()) {
            batches.add(currentBatch);
        }
        
        return batches;
    }
    
    /**
     * Build Step 2 message from template
     */
    private String buildStep2Message(String template, String userMessage, Map<String, Object> panelData) {
        // Get current date/time in ISO 8601 format (UTC)
        String currentDateTime = java.time.Instant.now().toString() + " (UTC)";
        
        if (template == null) {
            // Fallback template
            return String.format("Current Date and Time (UTC): %s\n\nUser question: \"%s\"\n\nHere is the timeseries data from the requested panels:\n\n%s\n\nCRITICAL: USE PANEL METADATA CONTEXT FOR CONTEXTUAL ANSWERS\n- Each panel in the data includes: panelId, title, description, type, category (if child panel), and seriesData\n- When answering questions about \"what are X metrics\" or \"what metrics are in X category\", use the panel data context:\n  * Panel title indicates what the panel measures\n  * Panel description provides additional context about metrics\n  * Panel category (if present) indicates the grouping/categorization (e.g., \"Availability\", \"Performance\")\n  * Series names in seriesData are the actual metric names available in each panel\n- For questions that can be answered from metadata context (e.g., \"what are Availability Category metrics?\"), provide a contextual answer based on:\n  1. Which panels have category matching the question (check the category field in each panel object)\n  2. What metrics/series are available in those panels (check seriesData keys)\n  3. What each panel measures (check title and description fields)\n- Combine metadata context with actual data values to provide comprehensive answers\n- If the question asks about metric definitions or what metrics exist, use panel titles, descriptions, categories, and series names from the panel data\n\nIMPORTANT: Provide a SHORT and CRISP answer. Be concise and direct. Focus on key findings only. Avoid lengthy explanations or unnecessary details. Maximum 2-3 sentences unless the question specifically requires more detail.",
                    currentDateTime, userMessage, serializePanelData(panelData));
        }
        
        String panelDataJSON = serializePanelData(panelData);
        return template.replace("{currentDateTime}", currentDateTime)
                .replace("{userMessage}", userMessage)
                .replace("{panelDataJSON}", panelDataJSON);
    }
    
    /**
     * Build Step 3 consolidation message
     */
    private String buildStep3Message(String template, String userMessage, 
            List<String> batchResponses, List<String> panelIds) {
        if (template == null) {
            // Fallback template
            StringBuilder sb = new StringBuilder();
            sb.append("You are consolidating multiple analysis responses from a dashboard assistant.\n\n");
            sb.append("User's original question: \"").append(userMessage).append("\"\n\n");
            sb.append("You received ").append(batchResponses.size()).append(" separate analysis responses:\n\n");
            for (int i = 0; i < batchResponses.size(); i++) {
                sb.append("--- Batch ").append(i + 1).append(" ---\n");
                sb.append(batchResponses.get(i)).append("\n\n");
            }
            sb.append("Your task: Provide a SINGLE, CONSOLIDATED, and COMPREHENSIVE answer by combining insights from all responses.\n\n");
            sb.append("Consolidated answer:");
            return sb.toString();
        }
        
        // Format batch responses
        StringBuilder batchResponsesText = new StringBuilder();
        int batchSize = batchResponses.size() > 0 ? panelIds.size() / batchResponses.size() : panelIds.size();
        for (int i = 0; i < batchResponses.size(); i++) {
            int startIdx = i * batchSize;
            int endIdx = Math.min(startIdx + batchSize, panelIds.size());
            List<String> batchPanelIds = panelIds.subList(startIdx, endIdx);
            batchResponsesText.append("--- Batch ").append(i + 1)
                    .append(" (Panels: ").append(String.join(", ", batchPanelIds)).append(") ---\n")
                    .append(batchResponses.get(i)).append("\n\n");
        }
        
        return template.replace("{userMessage}", userMessage)
                .replace("{batchCount}", String.valueOf(batchResponses.size()))
                .replace("{batchResponses}", batchResponsesText.toString());
    }
    
    /**
     * Reduce batch size to fit within token limit
     */
    private List<String> reduceBatchSize(
            List<String> batch,
            Map<String, Object> batchData,
            String step2Template,
            String userMessage,
            int maxTokens) {
        
        if (batch.isEmpty()) {
            return batch;
        }
        
        // Try removing panels from the end until we fit
        List<String> reducedBatch = new java.util.ArrayList<>(batch);
        int attempts = 0;
        int maxAttempts = batch.size(); // Don't try more times than panels
        
        while (attempts < maxAttempts && !reducedBatch.isEmpty()) {
            // Build message with current batch
            Map<String, Object> testData = new java.util.HashMap<>();
            for (String panelId : reducedBatch) {
                testData.put(panelId, batchData.get(panelId));
            }
            
            String testMessage = buildStep2Message(step2Template, userMessage, testData);
            int testTokens = tokenCounter.countTokens(testMessage);
            
            if (testTokens <= maxTokens) {
                logger.debug("Reduced batch to {} panels, token count: {}", reducedBatch.size(), testTokens);
                return reducedBatch;
            }
            
            // Remove last panel and try again
            reducedBatch.remove(reducedBatch.size() - 1);
            attempts++;
        }
        
        // If still too large, try with just the first panel
        if (reducedBatch.isEmpty() && !batch.isEmpty()) {
            reducedBatch.add(batch.get(0));
            logger.warn("Reduced batch to single panel: {}", batch.get(0));
        }
        
        return reducedBatch;
    }
    
    /**
     * Truncate batch responses to fit within token limit
     */
    private List<String> truncateBatchResponses(List<String> batchResponses, int maxTokens) {
        if (batchResponses.isEmpty()) {
            return batchResponses;
        }
        
        // Estimate tokens for template structure (without responses)
        String testTemplate = "User's original question: \"{userMessage}\"\n\nYou received {batchCount} separate analysis responses:\n\n{batchResponses}\n\nYour task: Provide a SINGLE, CONSOLIDATED answer.";
        int templateTokens = tokenCounter.countTokens(testTemplate.replace("{userMessage}", "").replace("{batchCount}", "0").replace("{batchResponses}", ""));
        
        List<String> truncatedResponses = new java.util.ArrayList<>();
        int currentTokens = templateTokens;
        
        for (String response : batchResponses) {
            int responseTokens = tokenCounter.countTokens(response);
            
            // Check if adding this response would exceed limit
            if (currentTokens + responseTokens > maxTokens) {
                // Truncate this response to fit
                int availableTokens = maxTokens - currentTokens - 100; // Leave 100 token buffer
                if (availableTokens > 0) {
                    // Truncate response (rough estimate: 4 chars per token)
                    int maxChars = availableTokens * 4;
                    if (response.length() > maxChars) {
                        response = response.substring(0, maxChars) + "\n\n[... response truncated due to length ...]";
                        logger.debug("Truncated batch response from {} to {} chars", response.length() + maxChars, maxChars);
                    }
                    truncatedResponses.add(response);
                }
                break; // Can't fit more responses
            }
            
            truncatedResponses.add(response);
            currentTokens += responseTokens;
        }
        
        logger.info("Truncated batch responses from {} to {} to fit token limit", 
                batchResponses.size(), truncatedResponses.size());
        
        return truncatedResponses;
    }
    
    /**
     * Serialize panel data to JSON string
     */
    private String serializePanelData(Map<String, Object> panelData) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(panelData);
        } catch (Exception e) {
            logger.error("Error serializing panel data: {}", e.getMessage());
            return "{}";
        }
    }
    
    /**
     * Extract text from Claude response
     */
    private String extractTextFromResponse(ClaudeResponse response) {
        if (response == null) {
            return "";
        }
        // Use the existing getTextContent method
        return response.getTextContent();
    }
    
    /**
     * Create a text response from string
     */
    private ClaudeResponse createTextResponse(String text) {
        ClaudeResponse response = new ClaudeResponse();
        ClaudeResponse.ContentBlock block = new ClaudeResponse.ContentBlock();
        block.setType("text");
        block.setText(text);
        response.setContent(new java.util.ArrayList<>(java.util.Collections.singletonList(block)));
        response.setRole("assistant");
        return response;
    }
}

