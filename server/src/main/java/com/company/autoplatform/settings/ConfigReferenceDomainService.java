package com.company.autoplatform.settings;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.apiautomation.ApiDefinitionCaseRunHistoryEntity;
import com.company.autoplatform.apiautomation.ApiDefinitionCaseRunHistoryMapper;
import com.company.autoplatform.apiautomation.ApiExecutionSuiteEntity;
import com.company.autoplatform.apiautomation.ApiExecutionSuiteMapper;
import com.company.autoplatform.apiautomation.ApiExecutionSuiteRunHistoryEntity;
import com.company.autoplatform.apiautomation.ApiExecutionSuiteRunHistoryMapper;
import com.company.autoplatform.apiautomation.ApiScenarioEntity;
import com.company.autoplatform.apiautomation.ApiScenarioMapper;
import com.company.autoplatform.apiautomation.ApiScenarioRunHistoryEntity;
import com.company.autoplatform.apiautomation.ApiScenarioRunHistoryMapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.webuiautomation.WebUiEnvironmentEntity;
import com.company.autoplatform.webuiautomation.WebUiEnvironmentMapper;
import com.company.autoplatform.webuiautomation.WebUiRunBatchEntity;
import com.company.autoplatform.webuiautomation.WebUiRunBatchMapper;
import com.company.autoplatform.webuiautomation.WebUiRunEntity;
import com.company.autoplatform.webuiautomation.WebUiRunMapper;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static com.company.autoplatform.settings.ConfigReferenceModels.ConfigReferenceItem;
import static com.company.autoplatform.settings.ConfigReferenceModels.ConfigReferenceSummary;

@Service
public class ConfigReferenceDomainService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final int HISTORY_SAMPLE_LIMIT = 10;

    private final EnvConfigMapper envConfigMapper;
    private final ParamSetMapper paramSetMapper;
    private final MockApplicationMapper mockApplicationMapper;
    private final ApiScenarioMapper apiScenarioMapper;
    private final ApiExecutionSuiteMapper apiExecutionSuiteMapper;
    private final ApiDefinitionCaseRunHistoryMapper apiCaseRunHistoryMapper;
    private final ApiScenarioRunHistoryMapper apiScenarioRunHistoryMapper;
    private final ApiExecutionSuiteRunHistoryMapper apiSuiteRunHistoryMapper;
    private final WebUiEnvironmentMapper webUiEnvironmentMapper;
    private final WebUiRunMapper webUiRunMapper;
    private final WebUiRunBatchMapper webUiRunBatchMapper;
    private final WorkspaceService workspaceService;

    public ConfigReferenceDomainService(
            EnvConfigMapper envConfigMapper,
            ParamSetMapper paramSetMapper,
            MockApplicationMapper mockApplicationMapper,
            ApiScenarioMapper apiScenarioMapper,
            ApiExecutionSuiteMapper apiExecutionSuiteMapper,
            ApiDefinitionCaseRunHistoryMapper apiCaseRunHistoryMapper,
            ApiScenarioRunHistoryMapper apiScenarioRunHistoryMapper,
            ApiExecutionSuiteRunHistoryMapper apiSuiteRunHistoryMapper,
            WebUiEnvironmentMapper webUiEnvironmentMapper,
            WebUiRunMapper webUiRunMapper,
            WebUiRunBatchMapper webUiRunBatchMapper,
            WorkspaceService workspaceService
    ) {
        this.envConfigMapper = envConfigMapper;
        this.paramSetMapper = paramSetMapper;
        this.mockApplicationMapper = mockApplicationMapper;
        this.apiScenarioMapper = apiScenarioMapper;
        this.apiExecutionSuiteMapper = apiExecutionSuiteMapper;
        this.apiCaseRunHistoryMapper = apiCaseRunHistoryMapper;
        this.apiScenarioRunHistoryMapper = apiScenarioRunHistoryMapper;
        this.apiSuiteRunHistoryMapper = apiSuiteRunHistoryMapper;
        this.webUiEnvironmentMapper = webUiEnvironmentMapper;
        this.webUiRunMapper = webUiRunMapper;
        this.webUiRunBatchMapper = webUiRunBatchMapper;
        this.workspaceService = workspaceService;
    }

    public ConfigReferenceSummary environmentReferences(Long id, String workspaceCode) {
        EnvConfigEntity env = requireEnv(id);
        validateReadable(env.getWorkspaceId(), workspaceCode, "当前空间上下文不可查看该环境引用");
        List<ConfigReferenceItem> items = new ArrayList<>();
        int total = collectEnvironmentReferences(id, env.getWorkspaceId(), items);
        return new ConfigReferenceSummary("ENVIRONMENT", id, env.getEnvName(), total, items);
    }

    public ConfigReferenceSummary paramReferences(Long id, String workspaceCode) {
        ParamSetEntity param = requireParam(id);
        validateReadable(param.getWorkspaceId(), workspaceCode, "当前空间上下文不可查看该参数集引用");
        List<ConfigReferenceItem> items = new ArrayList<>();
        int total = collectParamReferences(id, param.getWorkspaceId(), items);
        return new ConfigReferenceSummary("PARAM_SET", id, param.getParamName(), total, items);
    }

    public ConfigReferenceSummary mockApplicationReferences(Long id, String workspaceCode) {
        MockApplicationEntity application = requireMockApplication(id);
        validateReadable(application.getWorkspaceId(), workspaceCode, "当前空间上下文不可查看该 Mock 应用引用");
        List<ConfigReferenceItem> items = new ArrayList<>();
        int total = collectMockApplicationReferences(id, application.getWorkspaceId(), items);
        return new ConfigReferenceSummary("MOCK_APPLICATION", id, application.getAppName(), total, items);
    }

    public void assertEnvironmentNotReferenced(Long id, Long workspaceId) {
        if (collectEnvironmentReferences(id, workspaceId, null) > 0) {
            throw new BadRequestException("该环境已被自动化运行配置或历史记录引用，请先查看引用详情并调整相关配置后再删除。");
        }
    }

    public void assertParamNotReferenced(Long id, Long workspaceId) {
        if (collectParamReferences(id, workspaceId, null) > 0) {
            throw new BadRequestException("该变量集已被环境、场景、套件或运行历史引用，请先查看引用详情并调整相关配置后再删除。");
        }
    }

    public void assertMockApplicationNotReferenced(Long id, Long workspaceId) {
        if (collectMockApplicationReferences(id, workspaceId, null) > 0) {
            throw new BadRequestException("该 Mock 应用已被环境或运行历史引用，请先查看引用详情并调整相关配置后再删除。");
        }
    }

    private int collectEnvironmentReferences(Long id, Long workspaceId, List<ConfigReferenceItem> items) {
        int total = 0;
        total += collectApiScenarios(ApiScenarioEntity::getDefaultEnvId, id, workspaceId, "API 场景", "默认环境", items);
        total += collectApiSuites(ApiExecutionSuiteEntity::getEnvironmentId, id, workspaceId, "执行套件", "运行环境", items);
        total += collectApiCaseRuns(ApiDefinitionCaseRunHistoryEntity::getEnvironmentId, id, workspaceId, "接口调试/用例运行历史", "运行环境", items);
        total += collectApiScenarioRuns(ApiScenarioRunHistoryEntity::getEnvironmentId, id, workspaceId, "场景运行历史", "运行环境", items);
        total += collectApiSuiteRuns(ApiExecutionSuiteRunHistoryEntity::getEnvironmentId, id, workspaceId, "套件运行历史", "运行环境", items);
        total += collectWebUiRuns(id, workspaceId, "Web UI 单次运行历史", "运行环境", items);
        total += collectWebUiBatches(id, workspaceId, "Web UI 批次运行历史", "运行环境", items);
        return total;
    }

    private int collectParamReferences(Long id, Long workspaceId, List<ConfigReferenceItem> items) {
        int total = 0;
        total += collectEnvJsonReferences(workspaceId, "defaultVariableSetId", id, "环境配置", "默认变量集", items);
        total += collectLegacyWebUiEnvironmentReferences(id, workspaceId, items);
        total += collectApiScenarios(ApiScenarioEntity::getVariableSetId, id, workspaceId, "API 场景", "变量集", items);
        total += collectApiSuites(ApiExecutionSuiteEntity::getVariableSetId, id, workspaceId, "执行套件", "变量集", items);
        total += collectApiCaseRuns(ApiDefinitionCaseRunHistoryEntity::getVariableSetId, id, workspaceId, "接口用例运行历史", "变量集", items);
        total += collectApiScenarioRuns(ApiScenarioRunHistoryEntity::getVariableSetId, id, workspaceId, "场景运行历史", "变量集", items);
        total += collectApiSuiteRuns(ApiExecutionSuiteRunHistoryEntity::getVariableSetId, id, workspaceId, "套件运行历史", "变量集", items);
        total += collectWebUiRunSnapshots(workspaceId, "\"variableSetId\":" + id, "Web UI 运行历史", "变量集快照", items);
        return total;
    }

    private int collectMockApplicationReferences(Long id, Long workspaceId, List<ConfigReferenceItem> items) {
        int total = 0;
        total += collectEnvJsonReferences(workspaceId, "mockApplicationId", id, "环境配置", "Mock 应用", items);
        total += collectApiCaseRunSnapshots(workspaceId, mockSnapshotNeedle(id), "接口用例运行历史", "Mock 快照", items);
        total += collectApiScenarioRunSnapshots(workspaceId, mockSnapshotNeedle(id), "场景运行历史", "Mock 快照", items);
        total += collectApiSuiteRunSnapshots(workspaceId, mockSnapshotNeedle(id), "套件运行历史", "Mock 快照", items);
        total += collectWebUiRunSnapshots(workspaceId, mockSnapshotNeedle(id), "Web UI 运行历史", "Mock 快照", items);
        return total;
    }

    private int collectEnvJsonReferences(Long workspaceId, String fieldName, Long expectedId, String sourceType, String referenceField, List<ConfigReferenceItem> items) {
        List<EnvConfigEntity> envs = envConfigMapper.selectList(new LambdaQueryWrapper<EnvConfigEntity>()
                .eq(EnvConfigEntity::getWorkspaceId, workspaceId));
        int count = 0;
        for (EnvConfigEntity env : envs) {
            JsonNode node = readJson(env.getConfigJson()).path(fieldName);
            if (node.canConvertToLong() && expectedId.equals(node.asLong())) {
                count++;
                add(items, sourceType, env.getId(), env.getEnvName(), env.getWorkspaceId(), referenceField, env.getUpdatedAt());
            }
        }
        return count;
    }

    private int collectLegacyWebUiEnvironmentReferences(Long id, Long workspaceId, List<ConfigReferenceItem> items) {
        LambdaQueryWrapper<WebUiEnvironmentEntity> query = new LambdaQueryWrapper<WebUiEnvironmentEntity>()
                .eq(WebUiEnvironmentEntity::getWorkspaceId, workspaceId)
                .eq(WebUiEnvironmentEntity::getDefaultVariableSetId, id);
        int total = count(webUiEnvironmentMapper.selectCount(query));
        if (items != null) {
            webUiEnvironmentMapper.selectList(query.orderByDesc(WebUiEnvironmentEntity::getUpdatedAt).last("LIMIT " + HISTORY_SAMPLE_LIMIT))
                    .forEach(env -> add(items, "Web UI 环境", env.getId(), env.getEnvironmentName(), env.getWorkspaceId(), "默认变量集", env.getUpdatedAt()));
        }
        return total;
    }

    private int collectApiScenarios(com.baomidou.mybatisplus.core.toolkit.support.SFunction<ApiScenarioEntity, ?> column, Long id, Long workspaceId, String sourceType, String field, List<ConfigReferenceItem> items) {
        LambdaQueryWrapper<ApiScenarioEntity> query = new LambdaQueryWrapper<ApiScenarioEntity>()
                .eq(ApiScenarioEntity::getWorkspaceId, workspaceId)
                .eq(column, id);
        int total = count(apiScenarioMapper.selectCount(query));
        if (items != null) {
            apiScenarioMapper.selectList(query.orderByDesc(ApiScenarioEntity::getUpdatedAt).last("LIMIT " + HISTORY_SAMPLE_LIMIT))
                    .forEach(entity -> add(items, sourceType, entity.getId(), entity.getScenarioName(), entity.getWorkspaceId(), field, entity.getUpdatedAt()));
        }
        return total;
    }

    private int collectApiSuites(com.baomidou.mybatisplus.core.toolkit.support.SFunction<ApiExecutionSuiteEntity, ?> column, Long id, Long workspaceId, String sourceType, String field, List<ConfigReferenceItem> items) {
        LambdaQueryWrapper<ApiExecutionSuiteEntity> query = new LambdaQueryWrapper<ApiExecutionSuiteEntity>()
                .eq(ApiExecutionSuiteEntity::getWorkspaceId, workspaceId)
                .eq(column, id);
        int total = count(apiExecutionSuiteMapper.selectCount(query));
        if (items != null) {
            apiExecutionSuiteMapper.selectList(query.orderByDesc(ApiExecutionSuiteEntity::getUpdatedAt).last("LIMIT " + HISTORY_SAMPLE_LIMIT))
                    .forEach(entity -> add(items, sourceType, entity.getId(), entity.getSuiteName(), entity.getWorkspaceId(), field, entity.getUpdatedAt()));
        }
        return total;
    }

    private int collectApiCaseRuns(com.baomidou.mybatisplus.core.toolkit.support.SFunction<ApiDefinitionCaseRunHistoryEntity, ?> column, Long id, Long workspaceId, String sourceType, String field, List<ConfigReferenceItem> items) {
        LambdaQueryWrapper<ApiDefinitionCaseRunHistoryEntity> query = new LambdaQueryWrapper<ApiDefinitionCaseRunHistoryEntity>()
                .eq(ApiDefinitionCaseRunHistoryEntity::getWorkspaceId, workspaceId)
                .eq(column, id);
        int total = count(apiCaseRunHistoryMapper.selectCount(query));
        if (items != null) {
            apiCaseRunHistoryMapper.selectList(query.orderByDesc(ApiDefinitionCaseRunHistoryEntity::getCreatedAt).last("LIMIT " + HISTORY_SAMPLE_LIMIT))
                    .forEach(entity -> add(items, sourceType, entity.getId(), entity.getCaseName(), entity.getWorkspaceId(), field, entity.getCreatedAt()));
        }
        return total;
    }

    private int collectApiScenarioRuns(com.baomidou.mybatisplus.core.toolkit.support.SFunction<ApiScenarioRunHistoryEntity, ?> column, Long id, Long workspaceId, String sourceType, String field, List<ConfigReferenceItem> items) {
        LambdaQueryWrapper<ApiScenarioRunHistoryEntity> query = new LambdaQueryWrapper<ApiScenarioRunHistoryEntity>()
                .eq(ApiScenarioRunHistoryEntity::getWorkspaceId, workspaceId)
                .eq(column, id);
        int total = count(apiScenarioRunHistoryMapper.selectCount(query));
        if (items != null) {
            apiScenarioRunHistoryMapper.selectList(query.orderByDesc(ApiScenarioRunHistoryEntity::getCreatedAt).last("LIMIT " + HISTORY_SAMPLE_LIMIT))
                    .forEach(entity -> add(items, sourceType, entity.getId(), entity.getScenarioName(), entity.getWorkspaceId(), field, entity.getCreatedAt()));
        }
        return total;
    }

    private int collectApiSuiteRuns(com.baomidou.mybatisplus.core.toolkit.support.SFunction<ApiExecutionSuiteRunHistoryEntity, ?> column, Long id, Long workspaceId, String sourceType, String field, List<ConfigReferenceItem> items) {
        LambdaQueryWrapper<ApiExecutionSuiteRunHistoryEntity> query = new LambdaQueryWrapper<ApiExecutionSuiteRunHistoryEntity>()
                .eq(ApiExecutionSuiteRunHistoryEntity::getWorkspaceId, workspaceId)
                .eq(column, id);
        int total = count(apiSuiteRunHistoryMapper.selectCount(query));
        if (items != null) {
            apiSuiteRunHistoryMapper.selectList(query.orderByDesc(ApiExecutionSuiteRunHistoryEntity::getCreatedAt).last("LIMIT " + HISTORY_SAMPLE_LIMIT))
                    .forEach(entity -> add(items, sourceType, entity.getId(), entity.getSuiteName(), entity.getWorkspaceId(), field, entity.getCreatedAt()));
        }
        return total;
    }

    private int collectWebUiRuns(Long id, Long workspaceId, String sourceType, String field, List<ConfigReferenceItem> items) {
        LambdaQueryWrapper<WebUiRunEntity> query = new LambdaQueryWrapper<WebUiRunEntity>()
                .eq(WebUiRunEntity::getWorkspaceId, workspaceId)
                .and(wrapper -> wrapper.eq(WebUiRunEntity::getEnvironmentId, id).or().eq(WebUiRunEntity::getEnvironmentId, -id));
        int total = count(webUiRunMapper.selectCount(query));
        if (items != null) {
            webUiRunMapper.selectList(query.orderByDesc(WebUiRunEntity::getCreatedAt).last("LIMIT " + HISTORY_SAMPLE_LIMIT))
                    .forEach(entity -> add(items, sourceType, entity.getId(), entity.getCaseName(), entity.getWorkspaceId(), field, entity.getCreatedAt()));
        }
        return total;
    }

    private int collectWebUiBatches(Long id, Long workspaceId, String sourceType, String field, List<ConfigReferenceItem> items) {
        LambdaQueryWrapper<WebUiRunBatchEntity> query = new LambdaQueryWrapper<WebUiRunBatchEntity>()
                .eq(WebUiRunBatchEntity::getWorkspaceId, workspaceId)
                .and(wrapper -> wrapper.eq(WebUiRunBatchEntity::getEnvironmentId, id).or().eq(WebUiRunBatchEntity::getEnvironmentId, -id));
        int total = count(webUiRunBatchMapper.selectCount(query));
        if (items != null) {
            webUiRunBatchMapper.selectList(query.orderByDesc(WebUiRunBatchEntity::getCreatedAt).last("LIMIT " + HISTORY_SAMPLE_LIMIT))
                    .forEach(entity -> add(items, sourceType, entity.getId(), entity.getBatchName(), entity.getWorkspaceId(), field, entity.getCreatedAt()));
        }
        return total;
    }

    private int collectApiCaseRunSnapshots(Long workspaceId, String needle, String sourceType, String field, List<ConfigReferenceItem> items) {
        LambdaQueryWrapper<ApiDefinitionCaseRunHistoryEntity> query = new LambdaQueryWrapper<ApiDefinitionCaseRunHistoryEntity>()
                .eq(ApiDefinitionCaseRunHistoryEntity::getWorkspaceId, workspaceId)
                .like(ApiDefinitionCaseRunHistoryEntity::getContextSnapshotJson, needle);
        int total = count(apiCaseRunHistoryMapper.selectCount(query));
        if (items != null) {
            apiCaseRunHistoryMapper.selectList(query.orderByDesc(ApiDefinitionCaseRunHistoryEntity::getCreatedAt).last("LIMIT " + HISTORY_SAMPLE_LIMIT))
                    .forEach(entity -> add(items, sourceType, entity.getId(), entity.getCaseName(), entity.getWorkspaceId(), field, entity.getCreatedAt()));
        }
        return total;
    }

    private int collectApiScenarioRunSnapshots(Long workspaceId, String needle, String sourceType, String field, List<ConfigReferenceItem> items) {
        LambdaQueryWrapper<ApiScenarioRunHistoryEntity> query = new LambdaQueryWrapper<ApiScenarioRunHistoryEntity>()
                .eq(ApiScenarioRunHistoryEntity::getWorkspaceId, workspaceId)
                .like(ApiScenarioRunHistoryEntity::getContextSnapshotJson, needle);
        int total = count(apiScenarioRunHistoryMapper.selectCount(query));
        if (items != null) {
            apiScenarioRunHistoryMapper.selectList(query.orderByDesc(ApiScenarioRunHistoryEntity::getCreatedAt).last("LIMIT " + HISTORY_SAMPLE_LIMIT))
                    .forEach(entity -> add(items, sourceType, entity.getId(), entity.getScenarioName(), entity.getWorkspaceId(), field, entity.getCreatedAt()));
        }
        return total;
    }

    private int collectApiSuiteRunSnapshots(Long workspaceId, String needle, String sourceType, String field, List<ConfigReferenceItem> items) {
        LambdaQueryWrapper<ApiExecutionSuiteRunHistoryEntity> query = new LambdaQueryWrapper<ApiExecutionSuiteRunHistoryEntity>()
                .eq(ApiExecutionSuiteRunHistoryEntity::getWorkspaceId, workspaceId)
                .like(ApiExecutionSuiteRunHistoryEntity::getContextSnapshotJson, needle);
        int total = count(apiSuiteRunHistoryMapper.selectCount(query));
        if (items != null) {
            apiSuiteRunHistoryMapper.selectList(query.orderByDesc(ApiExecutionSuiteRunHistoryEntity::getCreatedAt).last("LIMIT " + HISTORY_SAMPLE_LIMIT))
                    .forEach(entity -> add(items, sourceType, entity.getId(), entity.getSuiteName(), entity.getWorkspaceId(), field, entity.getCreatedAt()));
        }
        return total;
    }

    private int collectWebUiRunSnapshots(Long workspaceId, String needle, String sourceType, String field, List<ConfigReferenceItem> items) {
        LambdaQueryWrapper<WebUiRunEntity> query = new LambdaQueryWrapper<WebUiRunEntity>()
                .eq(WebUiRunEntity::getWorkspaceId, workspaceId)
                .like(WebUiRunEntity::getContextSnapshotJson, needle);
        int total = count(webUiRunMapper.selectCount(query));
        if (items != null) {
            webUiRunMapper.selectList(query.orderByDesc(WebUiRunEntity::getCreatedAt).last("LIMIT " + HISTORY_SAMPLE_LIMIT))
                    .forEach(entity -> add(items, sourceType, entity.getId(), entity.getCaseName(), entity.getWorkspaceId(), field, entity.getCreatedAt()));
        }
        return total;
    }

    private String mockSnapshotNeedle(Long id) {
        return "\"mock\":{\"id\":" + id;
    }

    private JsonNode readJson(String json) {
        if (json == null || json.isBlank()) {
            return OBJECT_MAPPER.createObjectNode();
        }
        try {
            return OBJECT_MAPPER.readTree(json);
        } catch (Exception ignored) {
            return OBJECT_MAPPER.createObjectNode();
        }
    }

    private void add(List<ConfigReferenceItem> items, String sourceType, Long sourceId, String sourceName, Long workspaceId, String field, LocalDateTime updatedAt) {
        if (items == null) {
            return;
        }
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(workspaceId);
        items.add(new ConfigReferenceItem(
                sourceType,
                sourceId,
                sourceName,
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                field,
                updatedAt
        ));
    }

    private int count(Long value) {
        return value == null ? 0 : Math.toIntExact(value);
    }

    private EnvConfigEntity requireEnv(Long id) {
        EnvConfigEntity entity = envConfigMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("环境不存在");
        }
        return entity;
    }

    private ParamSetEntity requireParam(Long id) {
        ParamSetEntity entity = paramSetMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("参数集不存在");
        }
        return entity;
    }

    private MockApplicationEntity requireMockApplication(Long id) {
        MockApplicationEntity entity = mockApplicationMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Mock 应用不存在");
        }
        return entity;
    }

    private void validateReadable(Long workspaceId, String workspaceCode, String message) {
        WorkspaceEntity workspace = resolveScopedWorkspace(workspaceCode);
        if (workspace != null && !workspace.getId().equals(workspaceId)) {
            throw new BadRequestException(message);
        }
        if (workspace == null && !workspaceService.isPlatformAdmin()
                && !workspaceService.listReadableWorkspaceIds().contains(workspaceId)) {
            throw new BadRequestException(message);
        }
    }

    private WorkspaceEntity resolveScopedWorkspace(String workspaceCode) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        return WorkspaceScope.isAll(normalized) ? null : workspaceService.requireReadableWorkspace(normalized);
    }
}
