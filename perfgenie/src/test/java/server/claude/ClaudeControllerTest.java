/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server.claude;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import server.claude.model.ClaudeMessage;
import server.claude.model.ClaudeResponse;
import server.investigation.InvestigateConnectionPoolIssues;
import server.profiler.IPerfGenieService;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.testng.Assert.*;

public class ClaudeControllerTest {

    @Mock
    private IClaudeService claudeService;
    
    @Mock
    private IPerfGenieService perfGenieService;

    private ClaudeController controller;

    @BeforeMethod
    public void setup() {
        MockitoAnnotations.openMocks(this);
        InvestigateConnectionPoolIssues investigateConnectionPoolIssues = 
            new InvestigateConnectionPoolIssues(perfGenieService);
        controller = new ClaudeController(claudeService, investigateConnectionPoolIssues);
    }

    @Test
    public void testSendMessage() throws IOException {
        // Given
        ClaudeResponse mockResponse = createMockResponse("Test response");
        when(claudeService.sendMessage(anyString())).thenReturn(mockResponse);

        Map<String, String> request = new HashMap<>();
        request.put("message", "Hello, Claude!");

        // When
        ResponseEntity<?> result = controller.sendMessage(request);

        // Then
        assertEquals(result.getStatusCode(), HttpStatus.OK);
        assertNotNull(result.getBody());
        verify(claudeService).sendMessage(eq("Hello, Claude!"));
    }

    @Test
    public void testSendMessageWithEmptyMessage() throws IOException {
        // Given
        Map<String, String> request = new HashMap<>();
        request.put("message", "");

        // When
        ResponseEntity<?> result = controller.sendMessage(request);

        // Then
        assertEquals(result.getStatusCode(), HttpStatus.BAD_REQUEST);
        verify(claudeService, never()).sendMessage(anyString());
    }

    @Test
    public void testSendMessageWithNullMessage() throws IOException {
        // Given
        Map<String, String> request = new HashMap<>();
        request.put("message", null);

        // When
        ResponseEntity<?> result = controller.sendMessage(request);

        // Then
        assertEquals(result.getStatusCode(), HttpStatus.BAD_REQUEST);
        verify(claudeService, never()).sendMessage(anyString());
    }

    @Test
    public void testSendMessageWithHistory() throws Exception {
        // Given
        ClaudeResponse mockResponse = createMockResponse("Response with history");
        when(claudeService.sendMessage(anyString(), anyList())).thenReturn(mockResponse);

        Map<String, Object> request = new HashMap<>();
        request.put("message", "Follow-up question");
        
        List<Map<String, String>> history = new ArrayList<>();
        Map<String, String> msg1 = new HashMap<>();
        msg1.put("role", "user");
        msg1.put("content", "First message");
        history.add(msg1);
        
        Map<String, String> msg2 = new HashMap<>();
        msg2.put("role", "assistant");
        msg2.put("content", "First response");
        history.add(msg2);
        
        request.put("history", history);

        // When
        ResponseEntity<?> result = controller.sendMessageWithHistory(request);

        // Then
        assertEquals(result.getStatusCode(), HttpStatus.OK);
        assertNotNull(result.getBody());
        verify(claudeService).sendMessage(eq("Follow-up question"), anyList());
    }

    @Test
    public void testSendMessageWithHistoryButNoHistory() throws Exception {
        // Given
        ClaudeResponse mockResponse = createMockResponse("Response without history");
        when(claudeService.sendMessage(anyString(), isNull())).thenReturn(mockResponse);

        Map<String, Object> request = new HashMap<>();
        request.put("message", "Simple question");

        // When
        ResponseEntity<?> result = controller.sendMessageWithHistory(request);

        // Then
        assertEquals(result.getStatusCode(), HttpStatus.OK);
        verify(claudeService).sendMessage(eq("Simple question"), isNull());
    }

    @Test
    public void testSendRequest() throws Exception {
        // Given
        ClaudeResponse mockResponse = createMockResponse("Custom request response");
        when(claudeService.sendRequest(any(server.claude.model.ClaudeRequest.class))).thenReturn(mockResponse);

        server.claude.model.ClaudeRequest request = new server.claude.model.ClaudeRequest();
        List<ClaudeMessage> messages = new ArrayList<>();
        messages.add(new ClaudeMessage("user", "Test message"));
        request.setMessages(messages);
        request.setModel("claude-3-sonnet-20240229");
        request.setMaxTokens(100);

        // When
        ResponseEntity<?> result = controller.sendRequest(request);

        // Then
        assertEquals(result.getStatusCode(), HttpStatus.OK);
        assertNotNull(result.getBody());
        verify(claudeService).sendRequest(any(server.claude.model.ClaudeRequest.class));
    }

    @Test
    public void testSendRequestWithNullMessages() throws IOException {
        // Given
        server.claude.model.ClaudeRequest request = new server.claude.model.ClaudeRequest();
        request.setMessages(null);

        // When
        ResponseEntity<?> result = controller.sendRequest(request);

        // Then
        assertEquals(result.getStatusCode(), HttpStatus.BAD_REQUEST);
        verify(claudeService, never()).sendRequest(any());
    }

    @Test
    public void testSendRequestWithEmptyMessages() throws IOException {
        // Given
        server.claude.model.ClaudeRequest request = new server.claude.model.ClaudeRequest();
        request.setMessages(new ArrayList<>());

        // When
        ResponseEntity<?> result = controller.sendRequest(request);

        // Then
        assertEquals(result.getStatusCode(), HttpStatus.BAD_REQUEST);
        verify(claudeService, never()).sendRequest(any());
    }

    @Test
    public void testHealth() {
        // When
        ResponseEntity<Map<String, String>> result = controller.health();

        // Then
        assertEquals(result.getStatusCode(), HttpStatus.OK);
        assertNotNull(result.getBody());
        assertEquals(result.getBody().get("status"), "ok");
        assertEquals(result.getBody().get("service"), "claude");
    }

    @Test
    public void testSendMessageIOException() throws Exception {
        // Given
        when(claudeService.sendMessage(anyString())).thenThrow(new IOException("API error"));

        Map<String, String> request = new HashMap<>();
        request.put("message", "Test message");

        // When
        ResponseEntity<?> result = controller.sendMessage(request);

        // Then
        assertEquals(result.getStatusCode(), HttpStatus.INTERNAL_SERVER_ERROR);
        assertNotNull(result.getBody());
    }

    private ClaudeResponse createMockResponse(String text) {
        ClaudeResponse response = new ClaudeResponse();
        response.setId("test-id");
        response.setModel("claude-3-sonnet-20240229");
        response.setRole("assistant");
        
        ClaudeResponse.ContentBlock contentBlock = new ClaudeResponse.ContentBlock();
        contentBlock.setType("text");
        contentBlock.setText(text);
        
        List<ClaudeResponse.ContentBlock> content = new ArrayList<>();
        content.add(contentBlock);
        response.setContent(content);
        
        return response;
    }
}

