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

import java.io.IOException;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST controller for Claude API endpoints
 */
@RestController
@RequestMapping("/api/claude")
public class ClaudeController {
    
    private final IClaudeService claudeService;
    
    @Autowired
    public ClaudeController(IClaudeService claudeService) {
        this.claudeService = claudeService;
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
            
            ClaudeResponse response = claudeService.sendMessage(userMessage, conversationHistory);
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
            if (serverName != null && !serverName.trim().isEmpty()) {
                result = claudeService.callMCPTool(serverName, toolName, arguments);
            } else {
                result = claudeService.callMCPTool(toolName, arguments);
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
            
            return ResponseEntity.ok(tools);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Failed to get MCP tools: " + e.getMessage()));
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
}

