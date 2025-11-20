/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server.claude.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Represents a response from the Claude API
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class ClaudeResponse {
    
    @JsonProperty("id")
    private String id;
    
    @JsonProperty("type")
    private String type;
    
    @JsonProperty("role")
    private String role;
    
    @JsonProperty("content")
    private List<ContentBlock> content;
    
    @JsonProperty("model")
    private String model;
    
    @JsonProperty("stop_reason")
    private String stopReason;
    
    @JsonProperty("stop_sequence")
    private String stopSequence;
    
    @JsonProperty("usage")
    private Usage usage;
    
    public static class ContentBlock {
        @JsonProperty("type")
        private String type;
        
        @JsonProperty("text")
        private String text;
        
        public String getType() {
            return type;
        }
        
        public void setType(String type) {
            this.type = type;
        }
        
        public String getText() {
            return text;
        }
        
        public void setText(String text) {
            this.text = text;
        }
    }
    
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Usage {
        @JsonProperty("input_tokens")
        private int inputTokens;
        
        @JsonProperty("output_tokens")
        private int outputTokens;
        
        @JsonProperty("cache_creation_input_tokens")
        private int cacheCreationInputTokens;
        
        public int getInputTokens() {
            return inputTokens;
        }
        
        public void setInputTokens(int inputTokens) {
            this.inputTokens = inputTokens;
        }
        
        public int getOutputTokens() {
            return outputTokens;
        }
        
        public void setOutputTokens(int outputTokens) {
            this.outputTokens = outputTokens;
        }
        
        public int getCacheCreationInputTokens() {
            return cacheCreationInputTokens;
        }
        
        public void setCacheCreationInputTokens(int cacheCreationInputTokens) {
            this.cacheCreationInputTokens = cacheCreationInputTokens;
        }
    }
    
    public String getId() {
        return id;
    }
    
    public void setId(String id) {
        this.id = id;
    }
    
    public String getType() {
        return type;
    }
    
    public void setType(String type) {
        this.type = type;
    }
    
    public String getRole() {
        return role;
    }
    
    public void setRole(String role) {
        this.role = role;
    }
    
    public List<ContentBlock> getContent() {
        return content;
    }
    
    public void setContent(List<ContentBlock> content) {
        this.content = content;
    }
    
    public String getModel() {
        return model;
    }
    
    public void setModel(String model) {
        this.model = model;
    }
    
    public String getStopReason() {
        return stopReason;
    }
    
    public void setStopReason(String stopReason) {
        this.stopReason = stopReason;
    }
    
    public String getStopSequence() {
        return stopSequence;
    }
    
    public void setStopSequence(String stopSequence) {
        this.stopSequence = stopSequence;
    }
    
    public Usage getUsage() {
        return usage;
    }
    
    public void setUsage(Usage usage) {
        this.usage = usage;
    }
    
    /**
     * Get the text content from the response
     */
    public String getTextContent() {
        if (content != null && !content.isEmpty()) {
            StringBuilder text = new StringBuilder();
            for (ContentBlock block : content) {
                if ("text".equals(block.getType()) && block.getText() != null) {
                    text.append(block.getText());
                }
            }
            return text.toString();
        }
        return "";
    }
}


