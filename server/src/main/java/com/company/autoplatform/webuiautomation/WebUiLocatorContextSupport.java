package com.company.autoplatform.webuiautomation;

import com.company.autoplatform.common.BadRequestException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

import static com.company.autoplatform.webuiautomation.WebUiAutomationFormatSupport.blankToNull;

@Component
public class WebUiLocatorContextSupport {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };
    private static final TypeReference<List<Map<String, Object>>> FRAME_PATH_TYPE = new TypeReference<>() {
    };

    private final ObjectMapper objectMapper;

    public WebUiLocatorContextSupport(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper == null ? new ObjectMapper() : objectMapper;
    }

    public String write(List<Map<String, Object>> framePath, List<Object> shadowPath) {
        if ((framePath == null || framePath.isEmpty()) && (shadowPath == null || shadowPath.isEmpty())) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(Map.of(
                    "framePath", framePath == null ? List.of() : framePath,
                    "shadowPath", shadowPath == null ? List.of() : shadowPath
            ));
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("Locator context is invalid");
        }
    }

    public List<Map<String, Object>> framePath(String locatorContextJson) {
        Object value = read(locatorContextJson).get("framePath");
        return value instanceof List<?> list ? objectMapper.convertValue(list, FRAME_PATH_TYPE) : List.of();
    }

    public List<Object> shadowPath(String locatorContextJson) {
        Object value = read(locatorContextJson).get("shadowPath");
        return value instanceof List<?> list ? List.copyOf(list) : List.of();
    }

    public Map<String, Object> read(String locatorContextJson) {
        String normalized = blankToNull(locatorContextJson);
        if (normalized == null) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(normalized, MAP_TYPE);
        } catch (JsonProcessingException exception) {
            return Map.of();
        }
    }
}
