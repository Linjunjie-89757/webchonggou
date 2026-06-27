package com.company.autoplatform.apiautomation;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ApiDefinitionImportDomainServiceTests {

    private final ApiDefinitionDomainService definitionDomainService = mock(ApiDefinitionDomainService.class);
    private final ApiDefinitionImportDomainService importDomainService = new ApiDefinitionImportDomainService(definitionDomainService);

    @Test
    void importsOpenApiOperationsAsDefinitions() {
        List<SaveApiDefinitionRequest> captured = captureImportRequests();
        String content = """
                {
                  "openapi": "3.0.1",
                  "info": {"title": "Order API"},
                  "paths": {
                    "/orders": {
                      "get": {
                        "summary": "List orders",
                        "parameters": [
                          {"name": "status", "in": "query", "required": false, "description": "Order status"},
                          {"name": "X-Trace-Id", "in": "header", "required": false}
                        ]
                      },
                      "post": {
                        "operationId": "createOrder",
                        "requestBody": {
                          "content": {
                            "application/json": {
                              "example": {"sku": "A001", "amount": 1}
                            }
                          }
                        }
                      }
                    }
                  }
                }
                """;

        ApiDefinitionImportResult result = importDomainService.importContent("ws_1", new ApiDefinitionImportRequest(
                "ws_1", "swagger", "content", null, content, "Imported/OpenAPI"));

        assertThat(result.createdCount()).isEqualTo(2);
        assertThat(captured).hasSize(2);
        assertThat(captured.get(0).name()).isEqualTo("List orders");
        assertThat(captured.get(0).requestConfig().method()).isEqualTo("GET");
        assertThat(captured.get(0).requestConfig().path()).isEqualTo("/orders");
        assertThat(captured.get(0).directoryName()).isEqualTo("Imported/OpenAPI/orders");
        assertThat(captured.get(0).requestConfig().queryParams()).extracting(ApiKeyValueInput::key).containsExactly("status");
        assertThat(captured.get(0).requestConfig().headers()).extracting(ApiKeyValueInput::key).containsExactly("X-Trace-Id");
        assertThat(captured.get(1).name()).isEqualTo("createOrder");
        assertThat(captured.get(1).directoryName()).isEqualTo("Imported/OpenAPI/orders");
        assertThat(captured.get(1).requestConfig().body().type()).isEqualTo("RAW_JSON");
        assertThat(captured.get(1).requestConfig().body().rawText()).contains("\"sku\"");
    }

    @Test
    void importsOpenApiOperationsIntoTagDirectories() {
        List<SaveApiDefinitionRequest> captured = captureImportRequests();
        String content = """
                {
                  "openapi": "3.0.1",
                  "info": {"title": "Order API"},
                  "paths": {
                    "/admin/order/page": {
                      "post": {
                        "summary": "Order page",
                        "tags": ["订单管理"]
                      }
                    },
                    "/admin/refund/page": {
                      "get": {
                        "summary": "Refund page",
                        "tags": ["售后/退款"]
                      }
                    }
                  }
                }
                """;

        ApiDefinitionImportResult result = importDomainService.importContent("ws_1", new ApiDefinitionImportRequest(
                "ws_1", "swagger", "content", null, content, "Imported"));

        assertThat(result.createdCount()).isEqualTo(2);
        assertThat(captured).extracting(SaveApiDefinitionRequest::directoryName)
                .containsExactlyInAnyOrder("Imported/订单管理", "Imported/售后/退款");
    }

    @Test
    void importsOpenApiOperationsIntoPathSegmentDirectoriesWhenTagsAreMissing() {
        List<SaveApiDefinitionRequest> captured = captureImportRequests();
        String content = """
                {
                  "openapi": "3.0.1",
                  "info": {"title": "Order API"},
                  "paths": {
                    "/admin/order/page": {
                      "post": {
                        "summary": "Order page"
                      }
                    }
                  }
                }
                """;

        ApiDefinitionImportResult result = importDomainService.importContent("ws_1", new ApiDefinitionImportRequest(
                "ws_1", "swagger", "content", null, content, "Imported"));

        assertThat(result.createdCount()).isEqualTo(1);
        assertThat(captured.getFirst().directoryName()).isEqualTo("Imported/admin");
    }

    @Test
    void importsOpenApiReferencedRequestBodySchemaAsJsonPlaceholder() {
        List<SaveApiDefinitionRequest> captured = captureImportRequests();
        String content = """
                {
                  "openapi": "3.0.1",
                  "info": {"title": "Order API"},
                  "paths": {
                    "/orders": {
                      "post": {
                        "summary": "Create order",
                        "requestBody": {
                          "required": true,
                          "content": {
                            "application/json": {
                              "schema": {
                                "$ref": "#/components/schemas/CreateOrderRequest"
                              }
                            }
                          }
                        },
                        "responses": {
                          "200": {
                            "description": "Created",
                            "content": {
                              "application/json": {
                                "schema": {
                                  "$ref": "#/components/schemas/CreateOrderResponse"
                                }
                              }
                            }
                          },
                          "400": {
                            "description": "Invalid request",
                            "content": {
                              "application/json": {
                                "schema": {
                                  "$ref": "#/components/schemas/ErrorResponse"
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  },
                  "components": {
                    "schemas": {
                      "CreateOrderRequest": {
                        "type": "object",
                        "properties": {
                          "sku": {"type": "string", "example": "A001"},
                          "amount": {"type": "integer", "default": 1},
                          "buyer": {
                            "$ref": "#/components/schemas/Buyer"
                          },
                          "items": {
                            "type": "array",
                            "items": {
                              "$ref": "#/components/schemas/OrderItem"
                            }
                          }
                        },
                        "required": ["sku", "amount"]
                      },
                      "Buyer": {
                        "type": "object",
                        "properties": {
                          "mobile": {"type": "string"}
                        }
                      },
                      "OrderItem": {
                        "type": "object",
                        "properties": {
                          "quantity": {"type": "integer"}
                        }
                      },
                      "CreateOrderResponse": {
                        "type": "object",
                        "properties": {
                          "data": {
                            "type": "object",
                            "properties": {
                              "orderId": {"type": "string", "description": "Order id"}
                            }
                          }
                        }
                      },
                      "ErrorResponse": {
                        "type": "object",
                        "properties": {
                          "errorCode": {"type": "string", "description": "Error code"}
                        }
                      }
                    }
                  }
                }
                """;

        ApiDefinitionImportResult result = importDomainService.importContent("ws_1", new ApiDefinitionImportRequest(
                "ws_1", "swagger", "content", null, content, "Imported/OpenAPI"));

        assertThat(result.createdCount()).isEqualTo(1);
        SaveApiDefinitionRequest request = captured.getFirst();
        assertThat(request.requestConfig().body().type()).isEqualTo("RAW_JSON");
        assertThat(request.requestConfig().body().rawText())
                .contains("\"sku\"")
                .contains("\"A001\"")
                .contains("\"amount\"")
                .contains("\"buyer\"")
                .contains("\"mobile\"")
                .contains("\"items\"")
                .contains("\"quantity\"");
        assertThat(request.requestConfig().schemaFields()).extracting(ApiSchemaFieldInput::fieldPath)
                .contains("sku", "amount", "buyer.mobile", "items[].quantity", "data.orderId");
        assertThat(request.requestConfig().schemaFields())
                .filteredOn(field -> "sku".equals(field.fieldPath()))
                .first()
                .satisfies(field -> {
                    assertThat(field.location()).isEqualTo("body");
                    assertThat(field.type()).isEqualTo("string");
                    assertThat(field.required()).isTrue();
                    assertThat(field.example()).isEqualTo("A001");
                });
        assertThat(request.requestConfig().schemaFields())
                .filteredOn(field -> "data.orderId".equals(field.fieldPath()))
                .first()
                .satisfies(field -> {
                    assertThat(field.location()).isEqualTo("response");
                    assertThat(field.responseCode()).isEqualTo("200");
                    assertThat(field.description()).isEqualTo("Order id");
                });
        assertThat(request.requestConfig().schemaFields())
                .filteredOn(field -> "errorCode".equals(field.fieldPath()))
                .first()
                .satisfies(field -> {
                    assertThat(field.location()).isEqualTo("response");
                    assertThat(field.responseCode()).isEqualTo("400");
                    assertThat(field.description()).isEqualTo("Error code");
                });
    }

    @Test
    void importsSwaggerTwoBodyParameterSchemaFields() {
        List<SaveApiDefinitionRequest> captured = captureImportRequests();
        String content = """
                {
                  "swagger": "2.0",
                  "info": {"title": "Order API", "version": "1.0.0"},
                  "paths": {
                    "/orders": {
                      "post": {
                        "summary": "Create order",
                        "parameters": [
                          {"name": "page", "in": "query", "type": "integer", "description": "Page number"},
                          {
                            "name": "body",
                            "in": "body",
                            "schema": {"$ref": "#/definitions/CreateOrderRequest"}
                          }
                        ],
                        "responses": {
                          "200": {
                            "description": "OK",
                            "schema": {"$ref": "#/definitions/CreateOrderResponse"}
                          }
                        }
                      }
                    }
                  },
                  "definitions": {
                    "CreateOrderRequest": {
                      "type": "object",
                      "required": ["sku"],
                      "properties": {
                        "sku": {"type": "string", "description": "Product code"},
                        "amount": {"type": "integer", "minimum": 1}
                      }
                    },
                    "CreateOrderResponse": {
                      "type": "object",
                      "properties": {
                        "success": {"type": "boolean"}
                      }
                    }
                  }
                }
                """;

        ApiDefinitionImportResult result = importDomainService.importContent("ws_1", new ApiDefinitionImportRequest(
                "ws_1", "swagger", "content", null, content, "Imported/Swagger2"));

        assertThat(result.createdCount()).isEqualTo(1);
        SaveApiDefinitionRequest request = captured.getFirst();
        assertThat(request.requestConfig().schemaFields()).extracting(ApiSchemaFieldInput::fieldPath)
                .contains("page", "sku", "amount", "success");
        assertThat(request.requestConfig().schemaFields())
                .filteredOn(field -> "page".equals(field.fieldPath()))
                .first()
                .satisfies(field -> {
                    assertThat(field.location()).isEqualTo("query");
                    assertThat(field.type()).isEqualTo("integer");
                    assertThat(field.description()).isEqualTo("Page number");
                });
        assertThat(request.requestConfig().schemaFields())
                .filteredOn(field -> "sku".equals(field.fieldPath()))
                .first()
                .satisfies(field -> {
                    assertThat(field.location()).isEqualTo("body");
                    assertThat(field.required()).isTrue();
                    assertThat(field.description()).isEqualTo("Product code");
                });
        assertThat(request.requestConfig().schemaFields())
                .filteredOn(field -> "success".equals(field.fieldPath()))
                .first()
                .satisfies(field -> assertThat(field.location()).isEqualTo("response"));
    }

    @Test
    void importsPostmanCollectionRequestsAsDefinitions() {
        List<SaveApiDefinitionRequest> captured = captureImportRequests();
        String content = """
                {
                  "info": {"name": "Postman smoke"},
                  "item": [{
                    "name": "Create user",
                    "request": {
                      "method": "POST",
                      "header": [{"key": "Content-Type", "value": "application/json"}],
                      "url": {"raw": "https://example.test/api/users?source=postman"},
                      "body": {"mode": "raw", "raw": "{\\"name\\":\\"Ada\\"}", "options": {"raw": {"language": "json"}}}
                    }
                  }]
                }
                """;

        ApiDefinitionImportResult result = importDomainService.importContent("ws_1", new ApiDefinitionImportRequest(
                "ws_1", "postman", "content", null, content, "Imported/Postman"));

        assertThat(result.createdCount()).isEqualTo(1);
        SaveApiDefinitionRequest request = captured.getFirst();
        assertThat(request.name()).isEqualTo("Create user");
        assertThat(request.requestConfig().method()).isEqualTo("POST");
        assertThat(request.requestConfig().path()).isEqualTo("/api/users");
        assertThat(request.requestConfig().queryParams()).extracting(ApiKeyValueInput::key).containsExactly("source");
        assertThat(request.requestConfig().body().type()).isEqualTo("RAW_JSON");
    }

    @Test
    void importsHarEntriesAsDefinitions() {
        List<SaveApiDefinitionRequest> captured = captureImportRequests();
        String content = """
                {
                  "log": {
                    "entries": [{
                      "request": {
                        "method": "PUT",
                        "url": "https://example.test/api/users/1?from=har",
                        "headers": [{"name": "Authorization", "value": "Bearer token"}],
                        "postData": {"mimeType": "application/json", "text": "{\\"active\\":true}"}
                      }
                    }]
                  }
                }
                """;

        ApiDefinitionImportResult result = importDomainService.importContent("ws_1", new ApiDefinitionImportRequest(
                "ws_1", "har", "content", null, content, "Imported/HAR"));

        assertThat(result.createdCount()).isEqualTo(1);
        SaveApiDefinitionRequest request = captured.getFirst();
        assertThat(request.name()).isEqualTo("PUT /api/users/1");
        assertThat(request.requestConfig().method()).isEqualTo("PUT");
        assertThat(request.requestConfig().path()).isEqualTo("/api/users/1");
        assertThat(request.requestConfig().queryParams()).extracting(ApiKeyValueInput::key).containsExactly("from");
        assertThat(request.requestConfig().headers()).extracting(ApiKeyValueInput::key).containsExactly("Authorization");
        assertThat(request.requestConfig().body().type()).isEqualTo("RAW_JSON");
    }

    @Test
    void duplicateOpenApiImportUpdatesExistingDefinitionsWithoutCountingAsCreated() {
        when(definitionDomainService.importDefinition(eq("ws_1"), org.mockito.ArgumentMatchers.any(SaveApiDefinitionRequest.class)))
                .thenAnswer(invocation -> {
                    SaveApiDefinitionRequest request = invocation.getArgument(1);
                    return importedDefinition(true, 11L, request);
                })
                .thenAnswer(invocation -> {
                    SaveApiDefinitionRequest request = invocation.getArgument(1);
                    return importedDefinition(false, 11L, request);
                });
        String content = """
                {
                  "openapi": "3.0.1",
                  "info": {"title": "Order API"},
                  "paths": {
                    "/orders": {
                      "post": {
                        "summary": "Create order",
                        "requestBody": {
                          "content": {
                            "application/json": {
                              "example": {"sku": "A001", "amount": 1}
                            }
                          }
                        }
                      }
                    }
                  }
                }
                """;

        ApiDefinitionImportRequest request = new ApiDefinitionImportRequest(
                "ws_1", "swagger", "content", null, content, "Imported/OpenAPI");
        ApiDefinitionImportResult firstResult = importDomainService.importContent("ws_1", request);
        ApiDefinitionImportResult secondResult = importDomainService.importContent("ws_1", request);

        assertThat(firstResult.createdCount()).isEqualTo(1);
        assertThat(secondResult.createdCount()).isZero();
        assertThat(secondResult.items()).hasSize(1);
        assertThat(secondResult.items().getFirst().id()).isEqualTo(11L);
        verify(definitionDomainService, times(2))
                .importDefinition(eq("ws_1"), org.mockito.ArgumentMatchers.any(SaveApiDefinitionRequest.class));
    }

    private List<SaveApiDefinitionRequest> captureImportRequests() {
        List<SaveApiDefinitionRequest> captured = new ArrayList<>();
        when(definitionDomainService.importDefinition(eq("ws_1"), org.mockito.ArgumentMatchers.any(SaveApiDefinitionRequest.class)))
                .thenAnswer(invocation -> {
                    SaveApiDefinitionRequest request = invocation.getArgument(1);
                    captured.add(request);
                    return importedDefinition(true, (long) captured.size(), request);
                });
        return captured;
    }

    private ApiDefinitionDomainService.ImportedApiDefinition importedDefinition(boolean created, Long id, SaveApiDefinitionRequest request) {
        return new ApiDefinitionDomainService.ImportedApiDefinition(created, new ApiDefinitionDetail(
                id,
                "ws_1",
                "Workspace",
                request.name(),
                request.requestConfig().method(),
                request.requestConfig().path(),
                request.directoryName(),
                request.description(),
                request.tags(),
                request.requestConfig(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                null,
                null,
                null,
                null
        ));
    }
}
