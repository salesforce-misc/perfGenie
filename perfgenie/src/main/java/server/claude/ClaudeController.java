/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server.claude;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import server.claude.model.ClaudeMessage;
import server.claude.model.ClaudeRequest;
import server.claude.model.ClaudeResponse;
import server.claude.mcp.MCPTool;
import server.investigation.InvestigateConnectionPoolIssues;

import java.io.IOException;
import java.util.Collections;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.regex.Pattern;
import java.util.regex.Matcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.List;
import java.util.Map;

/**
 * REST controller for Claude API endpoints
 */
@RestController
@RequestMapping("/api/claude")
public class ClaudeController {
    
    private static final Logger logger = LoggerFactory.getLogger(ClaudeController.class);

    private final IClaudeService claudeService;
    private final InvestigateConnectionPoolIssues investigateConnectionPoolIssues;
    
    @Autowired
    public ClaudeController(IClaudeService claudeService, InvestigateConnectionPoolIssues investigateConnectionPoolIssues) {
        this.claudeService = claudeService;
        this.investigateConnectionPoolIssues = investigateConnectionPoolIssues;
    }
    
    /**
     * Send a simple message to Claude
     * POST /api/claude/message
     */
    @PostMapping(value = "/message", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> sendMessage(@RequestBody Map<String, String> request) {
        try {
            String userMessage = request.get("message");
            if (userMessage == null || userMessage.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Collections.singletonMap("error", "Message is required"));
            }
            
            ClaudeResponse response = claudeService.sendMessage(userMessage);
            return ResponseEntity.ok(response);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Failed to send message: " + e.getMessage()));
        }
    }
    
    /**
     * Send a message with conversation history
     * POST /api/claude/message/with-history
     * Includes MCP tool context by default so Claude can use available tools
     */
    @PostMapping(value = "/message/with-history", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> sendMessageWithHistory(@RequestBody Map<String, Object> request) {
        try {
            String userMessage = (String) request.get("message");
            if (userMessage == null || userMessage.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Collections.singletonMap("error", "Message is required"));
            }
            
            @SuppressWarnings("unchecked")
            List<Map<String, String>> historyData = (List<Map<String, String>>) request.get("history");
            List<ClaudeMessage> conversationHistory = null;
            
            if (historyData != null && !historyData.isEmpty()) {
                conversationHistory = new java.util.ArrayList<>();
                for (Map<String, String> msg : historyData) {
                    conversationHistory.add(new ClaudeMessage(
                            msg.get("role"),
                            msg.get("content")
                    ));
                }
            }
            
            // Include MCP context by default so Claude knows about available tools
            // Check if user explicitly wants to disable it
            Boolean includeMCPContext = (Boolean) request.getOrDefault("includeMCPContext", true);
            
            // Build message with MCP tool information if enabled
            if (includeMCPContext) {
                Map<String, MCPTool> tools = claudeService.getAvailableMCPTools();
                if (!tools.isEmpty()) {
                    StringBuilder context = new StringBuilder(userMessage);
                    context.append("\n\nAvailable Tools:\n");
                    for (MCPTool tool : tools.values()) {
                        context.append("- ").append(tool.getName());
                        if (tool.getDescription() != null && !tool.getDescription().isEmpty()) {
                            context.append(": ").append(tool.getDescription());
                        }
                        // Include parameter information
                        if (tool.getInputSchema() != null) {
                            Map<String, Object> inputSchema = (Map<String, Object>) tool.getInputSchema();
                            if (inputSchema.containsKey("properties")) {
                                Map<String, Object> properties = (Map<String, Object>) inputSchema.get("properties");
                                if (!properties.isEmpty()) {
                                    context.append(" (Parameters: ");
                                    List<String> paramNames = new java.util.ArrayList<>();
                                    for (String paramName : properties.keySet()) {
                                        paramNames.add(paramName);
                                    }
                                    context.append(String.join(", ", paramNames)).append(")");
                                }
                            }
                        }
                        context.append("\n");
                    }
                    
                    // Check if user message contains jstack-related keywords
                    String userMessageLower = userMessage.toLowerCase();
                    boolean isJstackRequest = userMessageLower.contains("jstack") || 
                                            userMessageLower.contains("thread dump") ||
                                            userMessageLower.contains("connection pool") ||
                                            (userMessageLower.contains("analyze") && 
                                             (userMessageLower.contains("cell") || userMessageLower.contains("kpod") || userMessageLower.contains("host")));
                    
                    context.append("\n\nCRITICAL: When you need to use a tool, you MUST use the following XML format in your response:\n");
                    context.append("<tool_use>\n");
                    context.append("<tool_name>tool_name_here</tool_name>\n");
                    context.append("<parameters>\n");
                    context.append("<paramName1>paramValue1</paramName1>\n");
                    context.append("<paramName2>paramValue2</paramName2>\n");
                    context.append("</parameters>\n");
                    context.append("</tool_use>\n");
                    context.append("\nDo NOT ask the user to call the tool. Do NOT use markdown formatting. ");
                    context.append("Use the XML format above and the system will automatically call the tool for you.\n");
                    
                    if (isJstackRequest && tools.containsKey("investigate_connection_pool_issues")) {
                        context.append("\n⚠️ USER REQUEST DETECTED: The user is asking about jstack analysis. ");
                        context.append("You MUST immediately use the 'investigate_connection_pool_issues' tool using the XML format above. ");
                        context.append("Extract the cell name, host/kpod name, and time range from the user's message. ");
                        context.append("If time range is not specified, use a reasonable default (e.g., last 1 hour from current time). ");
                        context.append("Do NOT ask the user - just use the tool directly with the XML format.\n");
                    }
                    userMessage = context.toString();
                }
            }
            
            ClaudeResponse response = claudeService.sendMessage(userMessage, conversationHistory);
            
            // Check if Claude's response contains tool_use blocks and automatically call them
            String responseText = extractTextFromResponse(response);
            if (responseText != null && responseText.contains("<tool_use>")) {
                logger.info("Detected tool_use in Claude response, parsing and calling tools...");
                
                // Parse tool_use blocks from the response
                List<ToolUseRequest> toolRequests = parseToolUseBlocks(responseText);
                
                if (!toolRequests.isEmpty()) {
                    logger.info("Found {} tool use request(s), calling tools...", toolRequests.size());
                    
                    // Call each tool and collect results
                    StringBuilder toolResults = new StringBuilder();
                    toolResults.append("Tool execution results:\n\n");
                    
                    for (ToolUseRequest toolRequest : toolRequests) {
                        logger.info("Calling tool: {} with parameters: {}", toolRequest.toolName, toolRequest.parameters);
                        
                        String toolResult;
                        try {
                            // Check if this is the connection pool investigation tool
                            if ("investigate_connection_pool_issues".equals(toolRequest.toolName) || 
                                "investigateConnectionPoolIssues".equals(toolRequest.toolName)) {
                                toolResult = investigateConnectionPoolIssues.investigate(toolRequest.parameters);
                            } else {
                                // Use MCP service for other tools
                                toolResult = claudeService.callMCPTool(toolRequest.toolName, toolRequest.parameters);
                            }
                            
                            toolResults.append("Tool: ").append(toolRequest.toolName).append("\n");
                            toolResults.append("Result:\n").append(toolResult).append("\n\n");
                            
                        } catch (Exception e) {
                            logger.error("Error calling tool {}: {}", toolRequest.toolName, e.getMessage(), e);
                            toolResult = "Error calling tool: " + e.getMessage();
                            toolResults.append("Tool: ").append(toolRequest.toolName).append("\n");
                            toolResults.append("Error: ").append(toolResult).append("\n\n");
                        }
                    }
                    
                    // Send tool results back to Claude and get final response
                    logger.info("Sending tool results back to Claude for final response...");
                    List<ClaudeMessage> updatedHistory = new java.util.ArrayList<>();
                    if (conversationHistory != null) {
                        updatedHistory.addAll(conversationHistory);
                    }
                    updatedHistory.add(new ClaudeMessage("assistant", responseText));
                    updatedHistory.add(new ClaudeMessage("user", toolResults.toString()));
                    
                    ClaudeResponse finalResponse = claudeService.sendMessage(
                        "Based on the tool execution results above, provide a clear and concise answer to the user's original question.", 
                        updatedHistory
                    );
                    
                    return ResponseEntity.ok(finalResponse);
                }
            }
            
            return ResponseEntity.ok(response);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Failed to send message: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Collections.singletonMap("error", "Invalid request format: " + e.getMessage()));
        }
    }
    
    /**
     * Process Step 2 message with batched panel data to handle length constraints
     * POST /api/claude/message/step2-batched
     * 
     * Request body:
     * {
     *   "userMessage": "original user question",
     *   "history": [...],
     *   "panelIds": ["p1", "p2", ...],
     *   "panelData": { "p1": {...}, "p2": {...} }
     * }
     */
    @PostMapping(value = "/message/step2-batched", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> sendStep2Batched(@RequestBody Map<String, Object> request) {
        try {
            String userMessage = (String) request.get("userMessage");
            if (userMessage == null || userMessage.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Collections.singletonMap("error", "userMessage is required"));
            }
            
            @SuppressWarnings("unchecked")
            List<Map<String, String>> historyData = (List<Map<String, String>>) request.get("history");
            @SuppressWarnings("unchecked")
            List<String> panelIds = (List<String>) request.get("panelIds");
            @SuppressWarnings("unchecked")
            Map<String, Object> panelData = (Map<String, Object>) request.get("panelData");
            
            if (panelIds == null || panelIds.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Collections.singletonMap("error", "panelIds is required"));
            }
            
            if (panelData == null || panelData.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Collections.singletonMap("error", "panelData is required"));
            }
            
            List<ClaudeMessage> conversationHistory = null;
            if (historyData != null && !historyData.isEmpty()) {
                conversationHistory = new java.util.ArrayList<>();
                for (Map<String, String> msg : historyData) {
                    conversationHistory.add(new ClaudeMessage(
                            msg.get("role"),
                            msg.get("content")
                    ));
                }
            }
            
            ClaudeResponse response = claudeService.processStep2Batched(
                    userMessage, conversationHistory, panelIds, panelData);
            return ResponseEntity.ok(response);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Failed to process batched message: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Collections.singletonMap("error", "Invalid request format: " + e.getMessage()));
        }
    }
    
    /**
     * Process Step 1 message with batched panel metadata to handle length constraints
     * POST /api/claude/message/step1-batched
     */
    @PostMapping(value = "/message/step1-batched", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> sendStep1Batched(@RequestBody Map<String, Object> request) {
        try {
            String userMessage = (String) request.get("userMessage");
            if (userMessage == null || userMessage.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Collections.singletonMap("error", "userMessage is required"));
            }
            
            @SuppressWarnings("unchecked")
            List<Map<String, String>> historyData = (List<Map<String, String>>) request.get("history");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> panelMetadata = (List<Map<String, Object>>) request.get("panelMetadata");
            
            if (panelMetadata == null || panelMetadata.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Collections.singletonMap("error", "panelMetadata is required"));
            }
            
            // Convert history
            List<ClaudeMessage> conversationHistory = null;
            if (historyData != null && !historyData.isEmpty()) {
                conversationHistory = new ArrayList<>();
                for (Map<String, String> msg : historyData) {
                    conversationHistory.add(new ClaudeMessage(
                            msg.get("role"),
                            msg.get("content")
                    ));
                }
            }
            
            ClaudeResponse response = claudeService.processStep1Batched(
                    userMessage, conversationHistory, panelMetadata);
            return ResponseEntity.ok(response);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Failed to process batched message: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Collections.singletonMap("error", "Invalid request format: " + e.getMessage()));
        }
    }
    
    /**
     * Send a custom request to Claude API
     * POST /api/claude/request
     */
    @PostMapping(value = "/request", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> sendRequest(@RequestBody ClaudeRequest request) {
        try {
            if (request == null || request.getMessages() == null || request.getMessages().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Collections.singletonMap("error", "Request with messages is required"));
            }
            
            ClaudeResponse response = claudeService.sendRequest(request);
            return ResponseEntity.ok(response);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Failed to send request: " + e.getMessage()));
        }
    }
    
    /**
     * Health check endpoint
     * GET /api/claude/health
     */
    @GetMapping(value = "/health", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "ok");
        response.put("service", "claude");
        return ResponseEntity.ok(response);
    }
    
    /**
     * Send a message with MCP context
     * POST /api/claude/message/with-mcp
     */
    @PostMapping(value = "/message/with-mcp", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> sendMessageWithMCP(@RequestBody Map<String, Object> request) {
        try {
            String userMessage = (String) request.get("message");
            if (userMessage == null || userMessage.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Collections.singletonMap("error", "Message is required"));
            }
            
            Boolean includeMCPContext = (Boolean) request.getOrDefault("includeMCPContext", true);
            
            ClaudeResponse response = claudeService.sendMessageWithMCPContext(userMessage, includeMCPContext);
            return ResponseEntity.ok(response);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Failed to send message: " + e.getMessage()));
        }
    }
    
    /**
     * Call an MCP tool
     * POST /api/claude/mcp/tool
     */
    @PostMapping(value = "/mcp/tool", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> callMCPTool(@RequestBody Map<String, Object> request) {
        try {
            String toolName = (String) request.get("toolName");
            if (toolName == null || toolName.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Collections.singletonMap("error", "toolName is required"));
            }
            
            @SuppressWarnings("unchecked")
            Map<String, Object> arguments = (Map<String, Object>) request.getOrDefault("arguments", new HashMap<>());
            String serverName = (String) request.get("serverName");
            
            String result;
            
            // Check if this is the connection pool investigation tool
            if ("investigate_connection_pool_issues".equals(toolName) || 
                "investigateConnectionPoolIssues".equals(toolName)) {
                // Use our local service instead of MCP
                result = investigateConnectionPoolIssues.investigate(arguments);
            } else {
                // Use MCP service for other tools
                if (serverName != null && !serverName.trim().isEmpty()) {
                    result = claudeService.callMCPTool(serverName, toolName, arguments);
                } else {
                    result = claudeService.callMCPTool(toolName, arguments);
                }
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("toolName", toolName);
            response.put("result", result);
            if (serverName != null) {
                response.put("serverName", serverName);
            }
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Failed to call MCP tool: " + e.getMessage()));
        }
    }
    
    /**
     * Get all available MCP tools
     * GET /api/claude/mcp/tools
     */
    @GetMapping(value = "/mcp/tools", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getMCPTools(@RequestParam(required = false) String serverName) {
        try {
            Map<String, MCPTool> tools;
            if (serverName != null && !serverName.trim().isEmpty()) {
                tools = claudeService.getAvailableMCPTools(serverName);
            } else {
                tools = claudeService.getAvailableMCPTools();
            }
            
            // Add the connection pool investigation tool to the list
            @SuppressWarnings("unchecked")
            Map<String, Object> toolSchema = (Map<String, Object>) investigateConnectionPoolIssues.getToolSchema().get("inputSchema");
            MCPTool connectionPoolTool = new MCPTool();
            connectionPoolTool.setName("investigate_connection_pool_issues");
            connectionPoolTool.setDescription("Investigate connection pool issues and provide recommendations");
            connectionPoolTool.setInputSchema(toolSchema);
            tools.put("investigate_connection_pool_issues", connectionPoolTool);
            
            return ResponseEntity.ok(tools);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Failed to get MCP tools: " + e.getMessage()));
        }
    }
    
    /**
     * Investigate connection pool issues (dedicated endpoint)
     * POST /api/claude/investigate/connection-pool
     */
    @PostMapping(value = "/investigate/connection-pool", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> investigateConnectionPool(@RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> arguments = (Map<String, Object>) request.getOrDefault("arguments", request);
            
            String result = investigateConnectionPoolIssues.investigate(arguments);
            
            Map<String, Object> response = new HashMap<>();
            response.put("toolName", "investigate_connection_pool_issues");
            response.put("result", result);
            response.put("status", "success");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Failed to investigate connection pool: " + e.getMessage()));
        }
    }
    
    /**
     * Connect to an MCP server
     * POST /api/claude/mcp/connect
     */
    @PostMapping(value = "/mcp/connect", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> connectMCPServer(@RequestBody Map<String, String> request) {
        try {
            String serverName = request.get("serverName");
            if (serverName == null || serverName.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Collections.singletonMap("error", "serverName is required"));
            }
            
            boolean connected = claudeService.connectMCPServer(serverName);
            Map<String, Object> response = new HashMap<>();
            response.put("serverName", serverName);
            response.put("connected", connected);
            
            if (connected) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(response);
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Failed to connect to MCP server: " + e.getMessage()));
        }
    }
    
    /**
     * Disconnect from an MCP server
     * POST /api/claude/mcp/disconnect
     */
    @PostMapping(value = "/mcp/disconnect", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> disconnectMCPServer(@RequestBody Map<String, String> request) {
        try {
            String serverName = request.get("serverName");
            if (serverName == null || serverName.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Collections.singletonMap("error", "serverName is required"));
            }
            
            claudeService.disconnectMCPServer(serverName);
            Map<String, String> response = new HashMap<>();
            response.put("serverName", serverName);
            response.put("status", "disconnected");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Failed to disconnect from MCP server: " + e.getMessage()));
        }
    }
    
    /**
     * Get list of MCP servers
     * GET /api/claude/mcp/servers
     */
    @GetMapping(value = "/mcp/servers", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getMCPServers(@RequestParam(required = false, defaultValue = "connected") String type) {
        try {
            List<String> servers;
            if ("configured".equals(type)) {
                servers = claudeService.getConfiguredMCPServers();
            } else {
                servers = claudeService.getConnectedMCPServers();
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("type", type);
            response.put("servers", servers);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Failed to get MCP servers: " + e.getMessage()));
        }
    }
    
    /**
     * Extract text content from ClaudeResponse
     */
    private String extractTextFromResponse(ClaudeResponse response) {
        if (response == null || response.getContent() == null) {
            return null;
        }
        StringBuilder text = new StringBuilder();
        for (ClaudeResponse.ContentBlock block : response.getContent()) {
            if ("text".equals(block.getType()) && block.getText() != null) {
                text.append(block.getText());
            }
        }
        return text.toString();
    }
    
    /**
     * Parse tool_use XML blocks from Claude's response
     */
    private List<ToolUseRequest> parseToolUseBlocks(String responseText) {
        List<ToolUseRequest> toolRequests = new ArrayList<>();
        
        if (responseText == null || !responseText.contains("<tool_use>")) {
            return toolRequests;
        }
        
        // Pattern to match <tool_use> blocks
        Pattern toolUsePattern = Pattern.compile(
            "<tool_use>\\s*<tool_name>(.*?)</tool_name>\\s*<parameters>(.*?)</parameters>\\s*</tool_use>",
            Pattern.DOTALL | Pattern.CASE_INSENSITIVE
        );
        
        Matcher matcher = toolUsePattern.matcher(responseText);
        while (matcher.find()) {
            String toolName = matcher.group(1).trim();
            String parametersXml = matcher.group(2).trim();
            
            // Parse parameters from XML
            Map<String, Object> parameters = parseParametersFromXml(parametersXml);
            
            ToolUseRequest request = new ToolUseRequest();
            request.toolName = toolName;
            request.parameters = parameters;
            toolRequests.add(request);
            
            logger.info("Parsed tool use request: toolName={}, parameters={}", toolName, parameters);
        }
        
        return toolRequests;
    }
    
    /**
     * Parse parameters from XML format
     * Example: <cellName>fra44-casam</cellName><host>fra44-casam-app-blue-6bd4848db4-24ld4</host>
     */
    private Map<String, Object> parseParametersFromXml(String parametersXml) {
        Map<String, Object> parameters = new HashMap<>();
        
        if (parametersXml == null || parametersXml.trim().isEmpty()) {
            return parameters;
        }
        
        // Pattern to match <key>value</key>
        Pattern paramPattern = Pattern.compile("<([^>]+)>(.*?)</\\1>", Pattern.DOTALL);
        Matcher matcher = paramPattern.matcher(parametersXml);
        
        while (matcher.find()) {
            String key = matcher.group(1).trim();
            String value = matcher.group(2).trim();
            
            // Try to parse as number if it looks like a number
            if (value.matches("\\d+")) {
                try {
                    long longValue = Long.parseLong(value);
                    parameters.put(key, longValue);
                } catch (NumberFormatException e) {
                    parameters.put(key, value);
                }
            } else {
                parameters.put(key, value);
            }
        }
        
        return parameters;
    }
    
    /**
     * Helper class to represent a tool use request
     */
    private static class ToolUseRequest {
        String toolName;
        Map<String, Object> parameters;
    }
}

