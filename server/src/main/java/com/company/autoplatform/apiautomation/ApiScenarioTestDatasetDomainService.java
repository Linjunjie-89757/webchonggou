package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.workspace.WorkspaceService;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.blankToFallback;
import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.blankToNull;
import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;

@Service
public class ApiScenarioTestDatasetDomainService {

    private static final int MAX_DATASET_COLUMNS = 100;
    private static final int MAX_DATASET_ROWS = 5000;

    private final ApiScenarioTestDatasetMapper datasetMapper;
    private final ApiScenarioMapper scenarioMapper;
    private final ApiDataFileDomainService dataFileDomainService;
    private final WorkspaceService workspaceService;
    private final ApiWorkspaceScopeSupport workspaceScopeSupport;

    public ApiScenarioTestDatasetDomainService(
            ApiScenarioTestDatasetMapper datasetMapper,
            ApiScenarioMapper scenarioMapper,
            ApiDataFileDomainService dataFileDomainService,
            WorkspaceService workspaceService,
            ApiWorkspaceScopeSupport workspaceScopeSupport
    ) {
        this.datasetMapper = datasetMapper;
        this.scenarioMapper = scenarioMapper;
        this.dataFileDomainService = dataFileDomainService;
        this.workspaceService = workspaceService;
        this.workspaceScopeSupport = workspaceScopeSupport;
    }

    public List<ApiScenarioTestDatasetItem> listDatasets(Long scenarioId, String workspaceCode) {
        ApiScenarioEntity scenario = requireReadableScenario(scenarioId, workspaceCode);
        return datasetMapper.selectList(new LambdaQueryWrapper<ApiScenarioTestDatasetEntity>()
                        .eq(ApiScenarioTestDatasetEntity::getScenarioId, scenario.getId())
                        .orderByDesc(ApiScenarioTestDatasetEntity::getUpdatedAt))
                .stream()
                .map(this::toItem)
                .toList();
    }

    public ApiScenarioTestDatasetDetail getDataset(Long scenarioId, Long datasetId, String workspaceCode) {
        requireReadableScenario(scenarioId, workspaceCode);
        ApiScenarioTestDatasetEntity entity = requireDataset(datasetId, scenarioId);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot access the test dataset");
        return toDetail(entity);
    }

    public ApiScenarioTestDatasetDetail createDataset(Long scenarioId, String workspaceCode, ApiScenarioTestDatasetSaveRequest request) {
        ApiScenarioEntity scenario = requireWritableScenario(scenarioId, workspaceCode);
        ApiScenarioTestDatasetEntity entity = new ApiScenarioTestDatasetEntity();
        fillDataset(entity, scenario, request, null);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        datasetMapper.insert(entity);
        return toDetail(entity);
    }

    public ApiScenarioTestDatasetDetail updateDataset(Long scenarioId, Long datasetId, String workspaceCode, ApiScenarioTestDatasetSaveRequest request) {
        ApiScenarioEntity scenario = requireWritableScenario(scenarioId, workspaceCode);
        ApiScenarioTestDatasetEntity entity = requireDataset(datasetId, scenarioId);
        if (!entity.getWorkspaceId().equals(scenario.getWorkspaceId())) {
            throw new BadRequestException("Test dataset must belong to the same workspace");
        }
        fillDataset(entity, scenario, request, entity.getId());
        entity.setUpdatedAt(LocalDateTime.now());
        datasetMapper.updateById(entity);
        return toDetail(entity);
    }

    public ApiScenarioTestDatasetDetail importCsv(Long scenarioId, String workspaceCode, MultipartFile file, String datasetName) {
        ApiScenarioEntity scenario = requireWritableScenario(scenarioId, workspaceCode);
        ApiDataFileDomainService.ApiDataFileParsedContent parsed = dataFileDomainService.parseCsvUpload(file);
        List<ApiScenarioTestDatasetColumn> columns = parsed.columns().stream()
                .map(column -> new ApiScenarioTestDatasetColumn(column, "CSV_COLUMN"))
                .toList();
        List<ApiScenarioTestDatasetRow> rows = parsed.rows().stream()
                .map(row -> new ApiScenarioTestDatasetRow(row.rowIndex(), row.values()))
                .toList();
        ApiScenarioTestDatasetSaveRequest request = new ApiScenarioTestDatasetSaveRequest(
                blankToFallback(datasetName, parsed.originalName()),
                true,
                "CSV",
                null,
                parsed.columns().contains("caseDesc") ? "caseDesc" : null,
                columns,
                rows
        );
        ApiScenarioTestDatasetEntity entity = new ApiScenarioTestDatasetEntity();
        fillDataset(entity, scenario, request, null);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        datasetMapper.insert(entity);
        return toDetail(entity);
    }

    public void deleteDataset(Long scenarioId, Long datasetId, String workspaceCode) {
        requireWritableScenario(scenarioId, workspaceCode);
        ApiScenarioTestDatasetEntity entity = requireDataset(datasetId, scenarioId);
        datasetMapper.deleteById(entity.getId());
    }

    List<ApiScenarioDatasetRuntimeRow> readEnabledDatasetRows(Long scenarioId, Long workspaceId) {
        ApiScenarioTestDatasetEntity entity = datasetMapper.selectList(new LambdaQueryWrapper<ApiScenarioTestDatasetEntity>()
                        .eq(ApiScenarioTestDatasetEntity::getScenarioId, scenarioId)
                        .eq(ApiScenarioTestDatasetEntity::getWorkspaceId, workspaceId)
                        .eq(ApiScenarioTestDatasetEntity::getEnabled, true)
                        .orderByDesc(ApiScenarioTestDatasetEntity::getUpdatedAt))
                .stream()
                .findFirst()
                .orElse(null);
        if (entity == null) {
            return List.of();
        }
        return readRows(entity).stream()
                .map(row -> new ApiScenarioDatasetRuntimeRow(
                        entity.getId(),
                        entity.getDatasetName(),
                        row.rowIndex(),
                        blankToNull(row.values().get(entity.getCaseDescColumn())),
                        row.values()
                ))
                .toList();
    }

    List<ApiScenarioDatasetRuntimeRow> readDatasetRows(Long scenarioId, Long workspaceId, Long datasetId) {
        ApiScenarioTestDatasetEntity entity = requireDataset(datasetId, scenarioId);
        if (!entity.getWorkspaceId().equals(workspaceId)) {
            throw new BadRequestException("Test dataset must belong to the same workspace");
        }
        if (!Boolean.TRUE.equals(entity.getEnabled())) {
            throw new BadRequestException("Test dataset is disabled");
        }
        return readRows(entity).stream()
                .map(row -> new ApiScenarioDatasetRuntimeRow(
                        entity.getId(),
                        entity.getDatasetName(),
                        row.rowIndex(),
                        blankToNull(row.values().get(entity.getCaseDescColumn())),
                        row.values()
                ))
                .toList();
    }

    ApiScenarioDatasetRuntimeInfo getRuntimeDatasetInfo(Long scenarioId, Long workspaceId, Long datasetId) {
        ApiScenarioTestDatasetEntity entity = requireDataset(datasetId, scenarioId);
        if (!entity.getWorkspaceId().equals(workspaceId)) {
            throw new BadRequestException("Test dataset must belong to the same workspace");
        }
        return new ApiScenarioDatasetRuntimeInfo(entity.getId(), entity.getDatasetName());
    }

    private void fillDataset(ApiScenarioTestDatasetEntity entity, ApiScenarioEntity scenario, ApiScenarioTestDatasetSaveRequest request, Long currentId) {
        String datasetName = blankToNull(request.datasetName());
        if (datasetName == null) {
            throw new BadRequestException("Test dataset name cannot be blank");
        }
        ensureDatasetNameUnique(scenario.getId(), currentId, datasetName);
        List<ApiScenarioTestDatasetColumn> columns = normalizeColumns(request.columns());
        List<ApiScenarioTestDatasetRow> rows = normalizeRows(request.rows(), columns);
        entity.setWorkspaceId(scenario.getWorkspaceId());
        entity.setScenarioId(scenario.getId());
        entity.setDatasetName(datasetName);
        entity.setEnabled(Boolean.TRUE.equals(request.enabled()));
        entity.setSourceType(blankToFallback(request.sourceType(), "MANUAL").trim());
        entity.setSourceFileId(request.sourceFileId());
        entity.setCaseDescColumn(blankToNull(request.caseDescColumn()));
        entity.setRowCount(rows.size());
        entity.setColumnJson(ApiAutomationJsonSupport.toJson(columns, "Failed to serialize scenario test dataset columns"));
        entity.setRowJson(ApiAutomationJsonSupport.toJson(rows, "Failed to serialize scenario test dataset rows"));
    }

    private List<ApiScenarioTestDatasetColumn> normalizeColumns(List<ApiScenarioTestDatasetColumn> inputColumns) {
        List<ApiScenarioTestDatasetColumn> columns = new ArrayList<>();
        for (ApiScenarioTestDatasetColumn column : inputColumns == null ? List.<ApiScenarioTestDatasetColumn>of() : inputColumns) {
            String name = blankToNull(column == null ? null : column.name());
            if (name == null) {
                continue;
            }
            if (columns.stream().anyMatch(existing -> existing.name().equals(name))) {
                throw new BadRequestException("Test dataset column duplicated: " + name);
            }
            columns.add(new ApiScenarioTestDatasetColumn(name, blankToFallback(column.sourceType(), "MANUAL")));
        }
        if (columns.size() > MAX_DATASET_COLUMNS) {
            throw new BadRequestException("Test dataset cannot exceed 100 columns");
        }
        return columns;
    }

    private List<ApiScenarioTestDatasetRow> normalizeRows(List<ApiScenarioTestDatasetRow> inputRows, List<ApiScenarioTestDatasetColumn> columns) {
        List<ApiScenarioTestDatasetRow> rows = new ArrayList<>();
        int index = 1;
        for (ApiScenarioTestDatasetRow row : inputRows == null ? List.<ApiScenarioTestDatasetRow>of() : inputRows) {
            Map<String, String> values = new LinkedHashMap<>();
            Map<String, String> sourceValues = row == null || row.values() == null ? Map.of() : row.values();
            for (ApiScenarioTestDatasetColumn column : columns) {
                values.put(column.name(), sourceValues.getOrDefault(column.name(), ""));
            }
            rows.add(new ApiScenarioTestDatasetRow(index++, values));
        }
        if (rows.size() > MAX_DATASET_ROWS) {
            throw new BadRequestException("Test dataset cannot exceed 5000 rows in V1");
        }
        return rows;
    }

    private void ensureDatasetNameUnique(Long scenarioId, Long currentId, String datasetName) {
        Long count = datasetMapper.selectCount(new LambdaQueryWrapper<ApiScenarioTestDatasetEntity>()
                .eq(ApiScenarioTestDatasetEntity::getScenarioId, scenarioId)
                .eq(ApiScenarioTestDatasetEntity::getDatasetName, datasetName)
                .ne(currentId != null, ApiScenarioTestDatasetEntity::getId, currentId));
        if (count != null && count > 0) {
            throw new BadRequestException("Test dataset name already exists in current scenario");
        }
    }

    private ApiScenarioEntity requireReadableScenario(Long scenarioId, String workspaceCode) {
        ApiScenarioEntity scenario = requireScenario(scenarioId);
        workspaceScopeSupport.validateReadable(scenario.getWorkspaceId(), workspaceCode, "Current workspace cannot access the scenario");
        return scenario;
    }

    private ApiScenarioEntity requireWritableScenario(Long scenarioId, String workspaceCode) {
        ApiScenarioEntity scenario = requireReadableScenario(scenarioId, workspaceCode);
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(scenario.getWorkspaceId()).getWorkspaceCode());
        return scenario;
    }

    private ApiScenarioEntity requireScenario(Long scenarioId) {
        ApiScenarioEntity scenario = scenarioId == null ? null : scenarioMapper.selectById(scenarioId);
        if (scenario == null) {
            throw new NotFoundException("Scenario not found");
        }
        return scenario;
    }

    private ApiScenarioTestDatasetEntity requireDataset(Long datasetId, Long scenarioId) {
        ApiScenarioTestDatasetEntity entity = datasetId == null ? null : datasetMapper.selectById(datasetId);
        if (entity == null || !entity.getScenarioId().equals(scenarioId)) {
            throw new NotFoundException("Scenario test dataset not found");
        }
        return entity;
    }

    private ApiScenarioTestDatasetItem toItem(ApiScenarioTestDatasetEntity entity) {
        return new ApiScenarioTestDatasetItem(
                entity.getId(),
                entity.getScenarioId(),
                entity.getDatasetName(),
                Boolean.TRUE.equals(entity.getEnabled()),
                blankToFallback(entity.getSourceType(), "MANUAL"),
                entity.getCaseDescColumn(),
                entity.getRowCount(),
                readColumns(entity),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private ApiScenarioTestDatasetDetail toDetail(ApiScenarioTestDatasetEntity entity) {
        return new ApiScenarioTestDatasetDetail(
                entity.getId(),
                entity.getScenarioId(),
                entity.getDatasetName(),
                Boolean.TRUE.equals(entity.getEnabled()),
                blankToFallback(entity.getSourceType(), "MANUAL"),
                entity.getSourceFileId(),
                entity.getCaseDescColumn(),
                entity.getRowCount(),
                readColumns(entity),
                readRows(entity),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private List<ApiScenarioTestDatasetColumn> readColumns(ApiScenarioTestDatasetEntity entity) {
        return ApiAutomationJsonSupport.readList(
                entity.getColumnJson(),
                new TypeReference<>() {
                },
                List.of()
        );
    }

    private List<ApiScenarioTestDatasetRow> readRows(ApiScenarioTestDatasetEntity entity) {
        return ApiAutomationJsonSupport.readList(
                entity.getRowJson(),
                new TypeReference<>() {
                },
                List.of()
        );
    }

    record ApiScenarioDatasetRuntimeRow(
            Long datasetId,
            String datasetName,
            Integer rowIndex,
            String caseDesc,
            Map<String, String> values
    ) {
    }

    record ApiScenarioDatasetRuntimeInfo(
            Long datasetId,
            String datasetName
    ) {
    }
}
