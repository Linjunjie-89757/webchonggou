package com.company.autoplatform.apiautomation;

import com.company.autoplatform.common.BadRequestException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.blankToFallback;
import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.blankToNull;
import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.emptyAuthConfig;
import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;

@Service
public class ApiDefinitionImportDomainService {

    private static final List<String> HTTP_METHODS = List.of("get", "post", "put", "delete", "patch", "head", "options", "trace");
    private static final int DEFAULT_TIMEOUT_MS = 10000;
    private static final int SCHEMA_PLACEHOLDER_MAX_DEPTH = 8;

    private final ApiDefinitionDomainService definitionDomainService;
    private final ObjectMapper jsonMapper = new ObjectMapper();
    private final ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public ApiDefinitionImportDomainService(ApiDefinitionDomainService definitionDomainService) {
        this.definitionDomainService = definitionDomainService;
    }

    public ApiDefinitionImportResult importContent(String headerWorkspaceCode, ApiDefinitionImportRequest request) {
        String content = blankToNull(request.content());
        if (content == null && blankToNull(request.url()) != null) {
            content = fetchUrl(request.url());
        }
        if (content == null) {
            throw new BadRequestException("Import content cannot be blank");
        }
        return importDefinitions(headerWorkspaceCode, request, content);
    }

    public ApiDefinitionImportResult importFile(
            String headerWorkspaceCode,
            String bodyWorkspaceCode,
            String mode,
            String directoryName,
            Boolean groupByTags,
            MultipartFile file
    ) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Import file cannot be blank");
        }
        try {
            String content = new String(file.getBytes(), StandardCharsets.UTF_8);
            return importDefinitions(headerWorkspaceCode,
                    new ApiDefinitionImportRequest(bodyWorkspaceCode, mode, "file", null, content, directoryName, groupByTags),
                    content);
        } catch (IOException exception) {
            throw new BadRequestException("Failed to read import file");
        }
    }

    private ApiDefinitionImportResult importDefinitions(String headerWorkspaceCode, ApiDefinitionImportRequest request, String content) {
        String mode = normalizeMode(request.mode());
        JsonNode root = readDocument(content, mode);
        String directoryName = blankToFallback(request.directoryName(), defaultDirectoryName(mode));
        List<SaveApiDefinitionRequest> definitions = switch (mode) {
            case "swagger" -> parseOpenApi(root, request.workspaceCode(), directoryName, true);
            case "postman" -> parsePostman(root, request.workspaceCode(), directoryName);
            case "har" -> parseHar(root, request.workspaceCode(), directoryName);
            default -> throw new BadRequestException("Unsupported import mode");
        };
        if (definitions.isEmpty()) {
            throw new BadRequestException("No API requests found in import content");
        }

        List<ApiDefinitionImportItem> items = new ArrayList<>();
        List<ApiDefinitionImportError> errors = new ArrayList<>();
        int createdCount = 0;
        for (SaveApiDefinitionRequest definition : definitions) {
            try {
                ApiDefinitionDomainService.ImportedApiDefinition imported = definitionDomainService.importDefinition(headerWorkspaceCode, definition);
                ApiDefinitionDetail detail = imported.detail();
                if (imported.created()) {
                    createdCount++;
                }
                items.add(new ApiDefinitionImportItem(detail.id(), detail.name(), detail.method(), detail.path(), detail.directoryName()));
            } catch (RuntimeException exception) {
                errors.add(new ApiDefinitionImportError(
                        definition.name(),
                        definition.requestConfig().method(),
                        definition.requestConfig().path(),
                        exception.getMessage()
                ));
            }
        }
        return new ApiDefinitionImportResult(createdCount, errors.size(), items, errors);
    }

    private List<SaveApiDefinitionRequest> parseOpenApi(JsonNode root, String workspaceCode, String directoryName, boolean groupByTags) {
        JsonNode paths = root.path("paths");
        if (!paths.isObject()) {
            return List.of();
        }
        List<SaveApiDefinitionRequest> definitions = new ArrayList<>();
        Iterator<Map.Entry<String, JsonNode>> pathFields = paths.fields();
        while (pathFields.hasNext()) {
            Map.Entry<String, JsonNode> pathEntry = pathFields.next();
            String path = normalizePath(pathEntry.getKey());
            JsonNode pathNode = pathEntry.getValue();
            List<JsonNode> pathParameters = collectOpenApiParameters(pathNode.path("parameters"));
            for (String methodKey : HTTP_METHODS) {
                JsonNode operation = pathNode.path(methodKey);
                if (!operation.isObject()) {
                    continue;
                }
                List<JsonNode> parameters = new ArrayList<>(pathParameters);
                parameters.addAll(collectOpenApiParameters(operation.path("parameters")));
                String method = methodKey.toUpperCase(Locale.ROOT);
                String resolvedDirectoryName = resolveOpenApiDirectoryName(directoryName, path, operation, groupByTags);
                definitions.add(new SaveApiDefinitionRequest(
                        workspaceCode,
                        firstText(operation, "summary", firstText(operation, "operationId", method + " " + path)),
                        resolvedDirectoryName,
                        blankToNull(firstText(operation, "description", null)),
                        List.of("imported", "openapi"),
                        new ApiRequestConfigInput(
                                method,
                                path,
                                DEFAULT_TIMEOUT_MS,
                                toOpenApiKeyValues(parameters, "query"),
                                toOpenApiKeyValues(parameters, "header"),
                                List.of(),
                                openApiBody(root, operation, parameters),
                                emptyAuthConfig(),
                                openApiSchemaFields(root, operation, parameters)
                        ),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of()
                ));
            }
        }
        return definitions;
    }

    private String resolveOpenApiDirectoryName(String baseDirectoryName, String path, JsonNode operation, boolean groupByTags) {
        String base = normalizeDirectoryName(baseDirectoryName);
        String group = null;
        if (groupByTags) {
            group = firstOpenApiTag(operation);
        }
        if (group == null) {
            group = firstPathSegment(path);
        }
        String normalizedGroup = normalizeDirectoryName(group);
        if (normalizedGroup == null) {
            return base;
        }
        if (base == null) {
            return normalizedGroup;
        }
        return base + "/" + normalizedGroup;
    }

    private String firstOpenApiTag(JsonNode operation) {
        JsonNode tags = operation.path("tags");
        if (!tags.isArray()) {
            return null;
        }
        for (JsonNode tag : tags) {
            String value = blankToNull(tag.asText(null));
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private String firstPathSegment(String path) {
        String normalizedPath = normalizePath(path);
        for (String segment : normalizedPath.split("/")) {
            String value = blankToNull(segment);
            if (value != null && !value.startsWith("{") && !value.startsWith(":")) {
                return value;
            }
        }
        return null;
    }

    private String normalizeDirectoryName(String value) {
        String normalized = blankToNull(value);
        if (normalized == null) {
            return null;
        }
        normalized = normalized.replace('\\', '/');
        List<String> parts = new ArrayList<>();
        for (String part : normalized.split("/")) {
            String trimmed = blankToNull(part);
            if (trimmed != null) {
                parts.add(trimmed);
            }
        }
        return parts.isEmpty() ? null : String.join("/", parts);
    }

    private List<SaveApiDefinitionRequest> parsePostman(JsonNode root, String workspaceCode, String directoryName) {
        List<SaveApiDefinitionRequest> definitions = new ArrayList<>();
        collectPostmanItems(root.path("item"), workspaceCode, directoryName, definitions);
        return definitions;
    }

    private void collectPostmanItems(JsonNode items, String workspaceCode, String directoryName, List<SaveApiDefinitionRequest> definitions) {
        if (!items.isArray()) {
            return;
        }
        for (JsonNode item : items) {
            if (item.path("request").isObject()) {
                definitions.add(postmanRequest(item, workspaceCode, directoryName));
            }
            collectPostmanItems(item.path("item"), workspaceCode, directoryName, definitions);
        }
    }

    private SaveApiDefinitionRequest postmanRequest(JsonNode item, String workspaceCode, String directoryName) {
        JsonNode request = item.path("request");
        String method = blankToFallback(request.path("method").asText(null), "GET").toUpperCase(Locale.ROOT);
        ParsedUrl url = parsePostmanUrl(request.path("url"));
        return new SaveApiDefinitionRequest(
                workspaceCode,
                blankToFallback(item.path("name").asText(null), method + " " + url.path()),
                directoryName,
                blankToNull(request.path("description").asText(null)),
                List.of("imported", "postman"),
                new ApiRequestConfigInput(
                        method,
                        url.path(),
                        DEFAULT_TIMEOUT_MS,
                        url.queryParams(),
                        postmanHeaders(request.path("header")),
                        List.of(),
                        postmanBody(request.path("body")),
                        emptyAuthConfig()
                ),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );
    }

    private List<SaveApiDefinitionRequest> parseHar(JsonNode root, String workspaceCode, String directoryName) {
        JsonNode entries = root.path("log").path("entries");
        if (!entries.isArray()) {
            return List.of();
        }
        List<SaveApiDefinitionRequest> definitions = new ArrayList<>();
        for (JsonNode entry : entries) {
            JsonNode request = entry.path("request");
            if (!request.isObject()) {
                continue;
            }
            String method = blankToFallback(request.path("method").asText(null), "GET").toUpperCase(Locale.ROOT);
            ParsedUrl url = parseUrl(request.path("url").asText(""));
            definitions.add(new SaveApiDefinitionRequest(
                    workspaceCode,
                    method + " " + url.path(),
                    directoryName,
                    null,
                    List.of("imported", "har"),
                    new ApiRequestConfigInput(
                            method,
                            url.path(),
                            DEFAULT_TIMEOUT_MS,
                            harQueryParams(request.path("queryString"), url.queryParams()),
                            harHeaders(request.path("headers")),
                            List.of(),
                            harBody(request.path("postData")),
                            emptyAuthConfig()
                    ),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of()
            ));
        }
        return definitions;
    }

    private ApiRequestBodyInput openApiBody(JsonNode root, JsonNode operation, List<JsonNode> parameters) {
        JsonNode requestBody = resolveOpenApiRef(root, operation.path("requestBody")).path("content");
        if (requestBody.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = requestBody.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                String contentType = entry.getKey();
                String rawText = exampleText(entry.getValue());
                if (rawText == null && entry.getValue().has("schema")) {
                    rawText = schemaPlaceholder(root, entry.getValue().path("schema"));
                }
                return rawBody(contentType, rawText == null ? "" : rawText);
            }
        }
        for (JsonNode parameter : parameters) {
            JsonNode resolvedParameter = resolveOpenApiRef(root, parameter);
            if ("body".equalsIgnoreCase(resolvedParameter.path("in").asText(""))) {
                String rawText = exampleText(resolvedParameter);
                if (rawText == null && resolvedParameter.has("schema")) {
                    rawText = schemaPlaceholder(root, resolvedParameter.path("schema"));
                }
                return rawBody("application/json", rawText == null ? "" : rawText);
            }
        }
        return emptyBody();
    }

    private List<ApiSchemaFieldInput> openApiSchemaFields(JsonNode root, JsonNode operation, List<JsonNode> parameters) {
        List<ApiSchemaFieldInput> fields = new ArrayList<>();
        for (JsonNode parameter : parameters) {
            JsonNode resolvedParameter = resolveOpenApiRef(root, parameter);
            String location = resolvedParameter.path("in").asText("");
            if (List.of("query", "header", "path").contains(location.toLowerCase(Locale.ROOT))) {
                JsonNode schema = openApiParameterSchema(root, resolvedParameter);
                fields.add(schemaField(
                        location.toLowerCase(Locale.ROOT),
                        resolvedParameter.path("name").asText(""),
                        resolvedParameter.path("name").asText(""),
                        schema,
                        resolvedParameter.path("required").asBoolean(false),
                        resolvedParameter.path("description").asText(null)
                ));
            } else if ("body".equalsIgnoreCase(location) && resolvedParameter.has("schema")) {
                collectOpenApiSchemaFields(root, fields, "body", "", resolvedParameter.path("schema"), Set.of(), SCHEMA_PLACEHOLDER_MAX_DEPTH);
            }
        }

        JsonNode requestBody = resolveOpenApiRef(root, operation.path("requestBody")).path("content");
        if (requestBody.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> contentFields = requestBody.fields();
            while (contentFields.hasNext()) {
                Map.Entry<String, JsonNode> entry = contentFields.next();
                collectOpenApiSchemaFields(root, fields, "body", "", entry.getValue().path("schema"), Set.of(), SCHEMA_PLACEHOLDER_MAX_DEPTH);
                break;
            }
        }
        collectOpenApiResponseSchemaFields(root, fields, operation.path("responses"));
        return fields;
    }

    private JsonNode openApiParameterSchema(JsonNode root, JsonNode parameter) {
        JsonNode schema = parameter.path("schema");
        if (schema.isObject()) {
            return resolveOpenApiSchemaRef(root, schema);
        }
        return parameter;
    }

    private void collectOpenApiResponseSchemaFields(JsonNode root, List<ApiSchemaFieldInput> fields, JsonNode responses) {
        if (!responses.isObject()) {
            return;
        }
        Iterator<Map.Entry<String, JsonNode>> responseFields = responses.fields();
        while (responseFields.hasNext()) {
            Map.Entry<String, JsonNode> entry = responseFields.next();
            String code = entry.getKey();
            collectOpenApiResponseSchemaFields(root, fields, normalizeOpenApiResponseCode(code), entry.getValue());
        }
    }

    private void collectOpenApiResponseSchemaFields(JsonNode root, List<ApiSchemaFieldInput> fields, String responseCode, JsonNode responseNode) {
        JsonNode response = resolveOpenApiRef(root, responseNode);
        if (response == null || response.isMissingNode() || response.isNull()) {
            return;
        }
        JsonNode content = response.path("content");
        if (content.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> contentFields = content.fields();
            while (contentFields.hasNext()) {
                collectOpenApiSchemaFields(root, fields, "response", responseCode, "", contentFields.next().getValue().path("schema"), Set.of(), SCHEMA_PLACEHOLDER_MAX_DEPTH);
                return;
            }
        }
        if (response.has("schema")) {
            collectOpenApiSchemaFields(root, fields, "response", responseCode, "", response.path("schema"), Set.of(), SCHEMA_PLACEHOLDER_MAX_DEPTH);
        }
    }

    private String normalizeOpenApiResponseCode(String code) {
        String normalized = blankToNull(code);
        return normalized == null ? "default" : normalized;
    }

    private void collectOpenApiSchemaFields(
            JsonNode root,
            List<ApiSchemaFieldInput> fields,
            String location,
            String parentPath,
            JsonNode schema,
            Set<String> parentRequired,
            int depth
    ) {
        collectOpenApiSchemaFields(root, fields, location, null, parentPath, schema, parentRequired, depth);
    }

    private void collectOpenApiSchemaFields(
            JsonNode root,
            List<ApiSchemaFieldInput> fields,
            String location,
            String responseCode,
            String parentPath,
            JsonNode schema,
            Set<String> parentRequired,
            int depth
    ) {
        if (schema == null || schema.isMissingNode() || schema.isNull() || depth <= 0) {
            return;
        }
        JsonNode resolvedSchema = resolveOpenApiSchemaRef(root, schema);
        if (resolvedSchema != schema) {
            collectOpenApiSchemaFields(root, fields, location, responseCode, parentPath, resolvedSchema, parentRequired, depth - 1);
            return;
        }
        JsonNode allOf = schema.path("allOf");
        if (allOf.isArray()) {
            for (JsonNode item : allOf) {
                collectOpenApiSchemaFields(root, fields, location, responseCode, parentPath, item, parentRequired, depth - 1);
            }
            return;
        }
        JsonNode oneOf = schema.path("oneOf");
        if (oneOf.isArray() && !oneOf.isEmpty()) {
            collectOpenApiSchemaFields(root, fields, location, responseCode, parentPath, oneOf.get(0), parentRequired, depth - 1);
            return;
        }
        JsonNode anyOf = schema.path("anyOf");
        if (anyOf.isArray() && !anyOf.isEmpty()) {
            collectOpenApiSchemaFields(root, fields, location, responseCode, parentPath, anyOf.get(0), parentRequired, depth - 1);
            return;
        }

        String type = schema.path("type").asText("");
        if (type.isBlank() && schema.path("properties").isObject()) {
            type = "object";
        }
        if ("object".equals(type) && schema.path("properties").isObject()) {
            Set<String> requiredNames = openApiRequiredNames(schema.path("required"));
            schema.path("properties").fields().forEachRemaining(entry -> {
                String fieldPath = parentPath.isBlank() ? entry.getKey() : parentPath + "." + entry.getKey();
                JsonNode propertySchema = resolveOpenApiSchemaRef(root, entry.getValue());
                fields.add(schemaField(
                        location,
                        fieldPath,
                        entry.getKey(),
                        propertySchema,
                        requiredNames.contains(entry.getKey()) || parentRequired.contains(entry.getKey()),
                        propertySchema.path("description").asText(null),
                        responseCode
                ));
                collectOpenApiSchemaFields(root, fields, location, responseCode, fieldPath, propertySchema, requiredNames, depth - 1);
            });
            return;
        }
        if ("array".equals(type)) {
            String arrayPath = parentPath.isBlank() ? "[]" : parentPath + "[]";
            collectOpenApiSchemaFields(root, fields, location, responseCode, arrayPath, schema.path("items"), Set.of(), depth - 1);
        }
    }

    private Set<String> openApiRequiredNames(JsonNode requiredNode) {
        Set<String> values = new LinkedHashSet<>();
        if (requiredNode.isArray()) {
            requiredNode.forEach(item -> {
                String value = item.asText("");
                if (!value.isBlank()) {
                    values.add(value);
                }
            });
        }
        return values;
    }

    private ApiSchemaFieldInput schemaField(
            String location,
            String fieldPath,
            String name,
            JsonNode schema,
            boolean required,
            String fallbackDescription
    ) {
        return schemaField(location, fieldPath, name, schema, required, fallbackDescription, null);
    }

    private ApiSchemaFieldInput schemaField(
            String location,
            String fieldPath,
            String name,
            JsonNode schema,
            boolean required,
            String fallbackDescription,
            String responseCode
    ) {
        JsonNode resolvedSchema = schema == null ? jsonMapper.missingNode() : schema;
        List<String> enumValues = new ArrayList<>();
        if (resolvedSchema.path("enum").isArray()) {
            resolvedSchema.path("enum").forEach(item -> enumValues.add(item.asText("")));
        }
        return new ApiSchemaFieldInput(
                location,
                fieldPath,
                name,
                resolvedSchema.path("type").asText(""),
                resolvedSchema.path("format").asText(null),
                required,
                blankToNull(resolvedSchema.path("description").asText(fallbackDescription)),
                jsonScalarValue(resolvedSchema.path("example")),
                jsonScalarValue(resolvedSchema.path("default")),
                enumValues,
                resolvedSchema.has("minLength") ? resolvedSchema.path("minLength").asInt() : null,
                resolvedSchema.has("maxLength") ? resolvedSchema.path("maxLength").asInt() : null,
                resolvedSchema.has("minimum") ? resolvedSchema.path("minimum").asText() : null,
                resolvedSchema.has("maximum") ? resolvedSchema.path("maximum").asText() : null,
                responseCode
        );
    }

    private Object jsonScalarValue(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (node.isTextual()) {
            return node.asText();
        }
        if (node.isBoolean()) {
            return node.asBoolean();
        }
        if (node.isNumber()) {
            return node.numberValue();
        }
        return node.toString();
    }

    private ApiRequestBodyInput postmanBody(JsonNode body) {
        String mode = body.path("mode").asText("");
        if ("raw".equals(mode)) {
            String raw = body.path("raw").asText("");
            String language = body.path("options").path("raw").path("language").asText("");
            String contentType = language.equalsIgnoreCase("json") ? "application/json"
                    : language.equalsIgnoreCase("xml") ? "application/xml"
                    : null;
            return rawBody(contentType, raw);
        }
        if ("urlencoded".equals(mode)) {
            return new ApiRequestBodyInput("FORM_URLENCODED", null, postmanFormItems(body.path("urlencoded")), "application/x-www-form-urlencoded", null, null);
        }
        if ("formdata".equals(mode)) {
            return new ApiRequestBodyInput("FORM_DATA", null, postmanFormItems(body.path("formdata")), "multipart/form-data", null, null);
        }
        return emptyBody();
    }

    private ApiRequestBodyInput harBody(JsonNode postData) {
        if (!postData.isObject()) {
            return emptyBody();
        }
        String mimeType = postData.path("mimeType").asText(null);
        String text = postData.path("text").asText("");
        if (blankToNull(text) != null) {
            return rawBody(mimeType, text);
        }
        JsonNode params = postData.path("params");
        if (params.isArray()) {
            return new ApiRequestBodyInput("FORM_URLENCODED", null, harParams(params), mimeType, null, null);
        }
        return emptyBody();
    }

    private List<ApiKeyValueInput> toOpenApiKeyValues(List<JsonNode> parameters, String in) {
        return parameters.stream()
                .filter(parameter -> in.equalsIgnoreCase(parameter.path("in").asText("")))
                .map(parameter -> keyValue(
                        parameter.path("name").asText(""),
                        exampleValue(parameter),
                        parameter.path("description").asText(null),
                        parameter.path("required").asBoolean(false)
                ))
                .filter(item -> blankToNull(item.key()) != null)
                .toList();
    }

    private List<ApiKeyValueInput> postmanHeaders(JsonNode headers) {
        if (!headers.isArray()) {
            return List.of();
        }
        List<ApiKeyValueInput> values = new ArrayList<>();
        for (JsonNode header : headers) {
            values.add(keyValue(header.path("key").asText(""), header.path("value").asText(""), header.path("description").asText(null), false));
        }
        return values.stream().filter(item -> blankToNull(item.key()) != null).toList();
    }

    private List<ApiKeyValueInput> harHeaders(JsonNode headers) {
        if (!headers.isArray()) {
            return List.of();
        }
        List<ApiKeyValueInput> values = new ArrayList<>();
        for (JsonNode header : headers) {
            values.add(keyValue(header.path("name").asText(""), header.path("value").asText(""), null, false));
        }
        return values.stream().filter(item -> blankToNull(item.key()) != null).toList();
    }

    private List<ApiKeyValueInput> postmanFormItems(JsonNode items) {
        if (!items.isArray()) {
            return List.of();
        }
        List<ApiKeyValueInput> values = new ArrayList<>();
        for (JsonNode item : items) {
            values.add(keyValue(item.path("key").asText(""), item.path("value").asText(""), item.path("description").asText(null), false));
        }
        return values.stream().filter(item -> blankToNull(item.key()) != null).toList();
    }

    private List<ApiKeyValueInput> harParams(JsonNode items) {
        List<ApiKeyValueInput> values = new ArrayList<>();
        for (JsonNode item : items) {
            values.add(keyValue(item.path("name").asText(""), item.path("value").asText(""), null, false));
        }
        return values.stream().filter(item -> blankToNull(item.key()) != null).toList();
    }

    private List<ApiKeyValueInput> harQueryParams(JsonNode queryString, List<ApiKeyValueInput> fallback) {
        if (!queryString.isArray()) {
            return fallback;
        }
        return harParams(queryString);
    }

    private ParsedUrl parsePostmanUrl(JsonNode url) {
        if (url.isTextual()) {
            return parseUrl(url.asText(""));
        }
        String raw = url.path("raw").asText(null);
        ParsedUrl parsed = parseUrl(raw == null ? "" : raw);
        if (!"/".equals(parsed.path()) || !url.path("path").isArray()) {
            return parsed;
        }
        List<String> segments = new ArrayList<>();
        for (JsonNode pathSegment : url.path("path")) {
            segments.add(pathSegment.asText(""));
        }
        List<ApiKeyValueInput> queryParams = new ArrayList<>();
        for (JsonNode query : url.path("query")) {
            queryParams.add(keyValue(query.path("key").asText(""), query.path("value").asText(""), query.path("description").asText(null), false));
        }
        return new ParsedUrl("/" + String.join("/", segments), queryParams);
    }

    private ParsedUrl parseUrl(String rawUrl) {
        try {
            URI uri = URI.create(blankToFallback(rawUrl, "/"));
            String path = blankToFallback(uri.getPath(), "/");
            return new ParsedUrl(normalizePath(path), parseQuery(uri.getRawQuery()));
        } catch (IllegalArgumentException exception) {
            int queryIndex = rawUrl == null ? -1 : rawUrl.indexOf('?');
            String path = queryIndex >= 0 ? rawUrl.substring(0, queryIndex) : rawUrl;
            String query = queryIndex >= 0 ? rawUrl.substring(queryIndex + 1) : null;
            return new ParsedUrl(normalizePath(path), parseQuery(query));
        }
    }

    private List<ApiKeyValueInput> parseQuery(String query) {
        if (blankToNull(query) == null) {
            return List.of();
        }
        List<ApiKeyValueInput> values = new ArrayList<>();
        for (String part : query.split("&")) {
            if (part.isBlank()) {
                continue;
            }
            String[] keyValue = part.split("=", 2);
            values.add(keyValue(keyValue[0], keyValue.length > 1 ? keyValue[1] : "", null, false));
        }
        return values;
    }

    private JsonNode readDocument(String content, String mode) {
        try {
            return jsonMapper.readTree(content);
        } catch (IOException jsonException) {
            if (!"swagger".equals(mode)) {
                throw new BadRequestException("Import content must be valid JSON");
            }
            try {
                return yamlMapper.readTree(content);
            } catch (IOException yamlException) {
                throw new BadRequestException("Import content must be valid OpenAPI JSON or YAML");
            }
        }
    }

    private String fetchUrl(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(20))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new BadRequestException("Import URL returned HTTP " + response.statusCode());
            }
            return response.body();
        } catch (IOException | InterruptedException | IllegalArgumentException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new BadRequestException("Failed to fetch import URL");
        }
    }

    private List<JsonNode> collectOpenApiParameters(JsonNode parameters) {
        if (!parameters.isArray()) {
            return List.of();
        }
        List<JsonNode> values = new ArrayList<>();
        parameters.forEach(values::add);
        return values;
    }

    private String exampleText(JsonNode node) {
        if (node.has("example")) {
            return node.path("example").isTextual() ? node.path("example").asText() : toPrettyJson(node.path("example"));
        }
        JsonNode examples = node.path("examples");
        if (examples.isObject()) {
            Iterator<JsonNode> iterator = examples.elements();
            if (iterator.hasNext()) {
                JsonNode example = iterator.next();
                JsonNode value = example.has("value") ? example.path("value") : example;
                return value.isTextual() ? value.asText() : toPrettyJson(value);
            }
        }
        return null;
    }

    private String schemaPlaceholder(JsonNode root, JsonNode schema) {
        JsonNode placeholder = schemaPlaceholderNode(root, schema, SCHEMA_PLACEHOLDER_MAX_DEPTH);
        if (placeholder == null || placeholder.isMissingNode() || placeholder.isNull()) {
            return "";
        }
        if (placeholder.isTextual()) {
            return placeholder.asText();
        }
        return toPrettyJson(placeholder);
    }

    private JsonNode schemaPlaceholderNode(JsonNode root, JsonNode schema, int depth) {
        if (schema == null || schema.isMissingNode() || schema.isNull() || depth <= 0) {
            return jsonMapper.createObjectNode();
        }
        JsonNode resolvedSchema = resolveOpenApiSchemaRef(root, schema);
        if (resolvedSchema != schema) {
            return schemaPlaceholderNode(root, resolvedSchema, depth - 1);
        }
        if (schema.has("example")) {
            return schema.path("example");
        }
        if (schema.has("default")) {
            return schema.path("default");
        }
        if (schema.path("enum").isArray() && !schema.path("enum").isEmpty()) {
            return schema.path("enum").get(0);
        }
        JsonNode allOf = schema.path("allOf");
        if (allOf.isArray() && !allOf.isEmpty()) {
            ObjectNode merged = jsonMapper.createObjectNode();
            for (JsonNode item : allOf) {
                JsonNode value = schemaPlaceholderNode(root, item, depth - 1);
                if (value.isObject()) {
                    value.fields().forEachRemaining(entry -> merged.set(entry.getKey(), entry.getValue()));
                }
            }
            return merged;
        }
        JsonNode oneOf = schema.path("oneOf");
        if (oneOf.isArray() && !oneOf.isEmpty()) {
            return schemaPlaceholderNode(root, oneOf.get(0), depth - 1);
        }
        JsonNode anyOf = schema.path("anyOf");
        if (anyOf.isArray() && !anyOf.isEmpty()) {
            return schemaPlaceholderNode(root, anyOf.get(0), depth - 1);
        }

        String type = schema.path("type").asText("");
        if (type.isBlank()) {
            if (schema.path("properties").isObject()) {
                type = "object";
            } else if (schema.has("items")) {
                type = "array";
            }
        }
        if ("object".equals(type)) {
            ObjectNode objectNode = jsonMapper.createObjectNode();
            JsonNode properties = schema.path("properties");
            if (properties.isObject()) {
                properties.fields().forEachRemaining(entry ->
                        objectNode.set(entry.getKey(), schemaPlaceholderNode(root, entry.getValue(), depth - 1)));
            }
            return objectNode;
        }
        if ("array".equals(type)) {
            ArrayNode arrayNode = jsonMapper.createArrayNode();
            arrayNode.add(schemaPlaceholderNode(root, schema.path("items"), depth - 1));
            return arrayNode;
        }
        return switch (type) {
            case "integer", "number" -> jsonMapper.getNodeFactory().numberNode(0);
            case "boolean" -> jsonMapper.getNodeFactory().booleanNode(false);
            default -> jsonMapper.getNodeFactory().textNode("");
        };
    }

    private JsonNode resolveOpenApiSchemaRef(JsonNode root, JsonNode schema) {
        return resolveOpenApiRef(root, schema);
    }

    private JsonNode resolveOpenApiRef(JsonNode root, JsonNode schema) {
        if (schema == null) {
            return jsonMapper.missingNode();
        }
        String ref = schema.path("$ref").asText(null);
        if (blankToNull(ref) == null || !ref.startsWith("#/")) {
            return schema;
        }
        JsonNode resolved = root.at(ref.substring(1));
        return resolved.isMissingNode() ? schema : resolved;
    }

    private String exampleValue(JsonNode parameter) {
        if (parameter.has("example")) {
            return parameter.path("example").asText("");
        }
        JsonNode schema = parameter.path("schema");
        if (schema.has("default")) {
            return schema.path("default").asText("");
        }
        return "";
    }

    private String firstText(JsonNode node, String field, String fallback) {
        String value = node.path(field).asText(null);
        return blankToFallback(value, fallback);
    }

    private ApiRequestBodyInput rawBody(String contentType, String rawText) {
        String type = bodyTypeForContentType(contentType);
        return new ApiRequestBodyInput(type, rawText, List.of(), contentType, null, null);
    }

    private ApiRequestBodyInput emptyBody() {
        return new ApiRequestBodyInput("NONE", null, List.of(), null, null, null);
    }

    private String bodyTypeForContentType(String contentType) {
        String normalized = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        if (normalized.contains("json")) {
            return "RAW_JSON";
        }
        if (normalized.contains("xml")) {
            return "RAW_XML";
        }
        return "RAW_TEXT";
    }

    private ApiKeyValueInput keyValue(String key, String value, String description, boolean required) {
        return new ApiKeyValueInput(key, value == null ? "" : value, description, true, "STRING", required, true, null, null, null, null, null);
    }

    private String normalizeMode(String mode) {
        String normalized = blankToFallback(mode, "").toLowerCase(Locale.ROOT);
        if (!List.of("swagger", "postman", "har").contains(normalized)) {
            throw new BadRequestException("Unsupported import mode");
        }
        return normalized;
    }

    private String defaultDirectoryName(String mode) {
        return switch (mode) {
            case "swagger" -> "Imported/OpenAPI";
            case "postman" -> "Imported/Postman";
            case "har" -> "Imported/HAR";
            default -> "Imported";
        };
    }

    private String normalizePath(String path) {
        String value = blankToFallback(path, "/");
        return value.startsWith("/") ? value : "/" + value;
    }

    private String toPrettyJson(JsonNode node) {
        try {
            return jsonMapper.writerWithDefaultPrettyPrinter().writeValueAsString(node);
        } catch (IOException exception) {
            return node.toString();
        }
    }

    private record ParsedUrl(String path, List<ApiKeyValueInput> queryParams) {
    }
}
