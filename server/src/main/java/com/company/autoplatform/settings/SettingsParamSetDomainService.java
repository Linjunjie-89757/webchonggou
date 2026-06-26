package com.company.autoplatform.settings;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
public class SettingsParamSetDomainService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final ParamSetMapper paramSetMapper;
    private final ParamSetChangeHistoryMapper changeHistoryMapper;
    private final ParamSetVersionMapper versionMapper;
    private final WorkspaceService workspaceService;
    private final ConfigReferenceDomainService referenceDomainService;

    public SettingsParamSetDomainService(
            ParamSetMapper paramSetMapper,
            ParamSetChangeHistoryMapper changeHistoryMapper,
            ParamSetVersionMapper versionMapper,
            WorkspaceService workspaceService,
            ConfigReferenceDomainService referenceDomainService
    ) {
        this.paramSetMapper = paramSetMapper;
        this.changeHistoryMapper = changeHistoryMapper;
        this.versionMapper = versionMapper;
        this.workspaceService = workspaceService;
        this.referenceDomainService = referenceDomainService;
    }

    public PageResponse<ParamSetItem> listParams(String workspaceCode, String keyword, String paramType, Integer status) {
        WorkspaceEntity workspace = resolveScopedWorkspace(workspaceCode);
        LambdaQueryWrapper<ParamSetEntity> query = new LambdaQueryWrapper<>();
        if (workspace != null) {
            query.eq(ParamSetEntity::getWorkspaceId, workspace.getId());
        } else if (!workspaceService.isPlatformAdmin()) {
            List<Long> workspaceIds = workspaceService.listReadableWorkspaceIds();
            if (workspaceIds.isEmpty()) {
                return new PageResponse<>(List.of(), 0);
            }
            query.in(ParamSetEntity::getWorkspaceId, workspaceIds);
        }
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.and(wrapper -> wrapper
                    .like(ParamSetEntity::getParamName, trimmedKeyword)
                    .or()
                    .like(ParamSetEntity::getContentJson, trimmedKeyword));
        }
        String trimmedParamType = blankToNull(paramType);
        if (trimmedParamType != null) {
            query.eq(ParamSetEntity::getParamType, trimmedParamType.trim().toUpperCase(Locale.ROOT));
        }
        if (status != null) {
            query.eq(ParamSetEntity::getStatus, normalizeStatus(status));
        }
        var items = paramSetMapper.selectList(query.orderByAsc(ParamSetEntity::getId)).stream()
                .map(this::toParamItem)
                .toList();
        return new PageResponse<>(items, items.size());
    }

    public ParamSetItem createParam(String headerWorkspaceCode, CreateParamSetRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        ParamSetEntity entity = new ParamSetEntity();
        entity.setWorkspaceId(workspace.getId());
        entity.setParamType(request.paramType());
        entity.setParamName(request.paramName());
        entity.setContentJson(request.contentJson());
        entity.setStatus(1);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        paramSetMapper.insert(entity);
        recordChange(entity, "CREATE", null, snapshot(entity), "paramType,paramName,contentJson,status");
        recordVersion(entity, "CREATE", "paramType,paramName,contentJson,status", null);
        return toParamItem(entity);
    }

    public ParamSetItem updateParam(Long id, String headerWorkspaceCode, CreateParamSetRequest request) {
        ParamSetEntity entity = requireParam(id);
        validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "当前空间上下文不可编辑该参数集");
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("不允许修改参数集归属空间");
        }
        Map<String, Object> before = snapshot(entity);
        String changedFields = changedFields(entity, request);
        entity.setParamType(request.paramType());
        entity.setParamName(request.paramName());
        entity.setContentJson(request.contentJson());
        entity.setUpdatedAt(LocalDateTime.now());
        paramSetMapper.updateById(entity);
        recordChange(entity, "UPDATE", before, snapshot(entity), changedFields);
        recordVersion(entity, "UPDATE", changedFields, null);
        return toParamItem(entity);
    }

    public ParamSetItem updateParamStatus(Long id, String workspaceCode, UpdateSettingStatusRequest request) {
        ParamSetEntity entity = requireParam(id);
        validateReadable(entity.getWorkspaceId(), workspaceCode, "当前空间上下文不可修改该参数集");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        Map<String, Object> before = snapshot(entity);
        entity.setStatus(normalizeStatus(request.status()));
        entity.setUpdatedAt(LocalDateTime.now());
        paramSetMapper.updateById(entity);
        recordChange(entity, "STATUS", before, snapshot(entity), "status");
        recordVersion(entity, "STATUS", "status", null);
        return toParamItem(entity);
    }

    public PageResponse<ParamSetVersionItem> listVersions(Long id, String workspaceCode) {
        ParamSetEntity entity = requireParam(id);
        validateReadable(entity.getWorkspaceId(), workspaceCode, "当前空间上下文不可查看该参数集版本");
        List<ParamSetVersionItem> items = versionMapper.selectList(new LambdaQueryWrapper<ParamSetVersionEntity>()
                        .eq(ParamSetVersionEntity::getParamSetId, id)
                        .orderByDesc(ParamSetVersionEntity::getVersionNo)
                        .orderByDesc(ParamSetVersionEntity::getId))
                .stream()
                .map(this::toVersionItem)
                .toList();
        return new PageResponse<>(items, items.size());
    }

    public ParamSetItem rollbackVersion(Long id, Long versionId, String workspaceCode) {
        ParamSetEntity entity = requireParam(id);
        validateReadable(entity.getWorkspaceId(), workspaceCode, "当前空间上下文不可回滚该参数集");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        ParamSetVersionEntity version = versionMapper.selectById(versionId);
        if (version == null || !version.getParamSetId().equals(id) || !version.getWorkspaceId().equals(entity.getWorkspaceId())) {
            throw new NotFoundException("参数集版本不存在");
        }
        Map<String, Object> before = snapshot(entity);
        String changedFields = changedFields(entity, version);
        entity.setParamType(version.getParamType());
        entity.setParamName(version.getParamName());
        entity.setContentJson(version.getContentJson());
        entity.setStatus(version.getStatus());
        entity.setUpdatedAt(LocalDateTime.now());
        paramSetMapper.updateById(entity);
        recordChange(entity, "ROLLBACK", before, snapshot(entity), changedFields);
        recordVersion(entity, "ROLLBACK", changedFields, version.getId());
        return toParamItem(entity);
    }

    public PageResponse<ParamSetChangeHistoryItem> listChangeHistory(Long id, String workspaceCode) {
        ParamSetEntity entity = requireParam(id);
        validateReadable(entity.getWorkspaceId(), workspaceCode, "当前空间上下文不可查看该参数集变更记录");
        List<ParamSetChangeHistoryItem> items = changeHistoryMapper.selectList(new LambdaQueryWrapper<ParamSetChangeHistoryEntity>()
                        .eq(ParamSetChangeHistoryEntity::getParamSetId, id)
                        .orderByDesc(ParamSetChangeHistoryEntity::getCreatedAt)
                        .orderByDesc(ParamSetChangeHistoryEntity::getId))
                .stream()
                .map(this::toChangeHistoryItem)
                .toList();
        return new PageResponse<>(items, items.size());
    }

    public void deleteParam(Long id, String workspaceCode) {
        ParamSetEntity entity = requireParam(id);
        validateReadable(entity.getWorkspaceId(), workspaceCode, "当前空间上下文不可删除该参数集");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        referenceDomainService.assertParamNotReferenced(id, entity.getWorkspaceId());
        paramSetMapper.deleteById(id);
    }

    private WorkspaceEntity resolveScopedWorkspace(String workspaceCode) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        return WorkspaceScope.isAll(normalized) ? null : workspaceService.requireReadableWorkspace(normalized);
    }

    private ParamSetEntity requireParam(Long id) {
        ParamSetEntity entity = paramSetMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("参数集不存在");
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

    private Integer normalizeStatus(Integer status) {
        if (status == null || (status != 0 && status != 1)) {
            throw new BadRequestException("状态只能是 0 或 1");
        }
        return status;
    }

    private ParamSetItem toParamItem(ParamSetEntity item) {
        WorkspaceEntity currentWorkspace = workspaceService.requireWorkspaceById(item.getWorkspaceId());
        return new ParamSetItem(
                item.getId(),
                currentWorkspace.getWorkspaceCode(),
                currentWorkspace.getWorkspaceName(),
                item.getParamType(),
                item.getParamName(),
                item.getContentJson(),
                item.getStatus()
        );
    }

    private ParamSetChangeHistoryItem toChangeHistoryItem(ParamSetChangeHistoryEntity entity) {
        WorkspaceEntity currentWorkspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new ParamSetChangeHistoryItem(
                entity.getId(),
                currentWorkspace.getWorkspaceCode(),
                currentWorkspace.getWorkspaceName(),
                entity.getParamSetId(),
                entity.getParamName(),
                entity.getChangeType(),
                entity.getBeforeJson(),
                entity.getAfterJson(),
                entity.getChangedFields(),
                entity.getOperatorId(),
                entity.getOperatorName(),
                entity.getCreatedAt()
        );
    }

    private ParamSetVersionItem toVersionItem(ParamSetVersionEntity entity) {
        WorkspaceEntity currentWorkspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new ParamSetVersionItem(
                entity.getId(),
                currentWorkspace.getWorkspaceCode(),
                currentWorkspace.getWorkspaceName(),
                entity.getParamSetId(),
                entity.getVersionNo(),
                entity.getParamType(),
                entity.getParamName(),
                entity.getContentJson(),
                entity.getStatus(),
                entity.getChangeType(),
                entity.getChangedFields(),
                entity.getSourceVersionId(),
                entity.getOperatorId(),
                entity.getOperatorName(),
                entity.getLatest(),
                entity.getCreatedAt()
        );
    }

    private void recordChange(ParamSetEntity entity, String changeType, Map<String, Object> before, Map<String, Object> after, String changedFields) {
        if (("UPDATE".equals(changeType) || "ROLLBACK".equals(changeType)) && blankToNull(changedFields) == null) {
            return;
        }
        CurrentUserPrincipal currentUser = currentUserOrNull();
        ParamSetChangeHistoryEntity history = new ParamSetChangeHistoryEntity();
        history.setWorkspaceId(entity.getWorkspaceId());
        history.setParamSetId(entity.getId());
        history.setParamName(entity.getParamName());
        history.setChangeType(changeType);
        history.setBeforeJson(toJson(before));
        history.setAfterJson(toJson(after));
        history.setChangedFields(changedFields);
        history.setOperatorId(currentUser == null ? null : currentUser.userId());
        history.setOperatorName(currentUser == null ? null : currentUser.displayName());
        history.setCreatedAt(LocalDateTime.now());
        history.setUpdatedAt(LocalDateTime.now());
        changeHistoryMapper.insert(history);
    }

    private void recordVersion(ParamSetEntity entity, String changeType, String changedFields, Long sourceVersionId) {
        if (("UPDATE".equals(changeType) || "ROLLBACK".equals(changeType)) && blankToNull(changedFields) == null) {
            return;
        }
        Integer nextVersion = nextVersionNo(entity.getId());
        versionMapper.selectList(new LambdaQueryWrapper<ParamSetVersionEntity>()
                        .eq(ParamSetVersionEntity::getParamSetId, entity.getId())
                        .eq(ParamSetVersionEntity::getLatest, true))
                .forEach(item -> {
                    item.setLatest(false);
                    item.setUpdatedAt(LocalDateTime.now());
                    versionMapper.updateById(item);
                });
        CurrentUserPrincipal currentUser = currentUserOrNull();
        ParamSetVersionEntity version = new ParamSetVersionEntity();
        version.setWorkspaceId(entity.getWorkspaceId());
        version.setParamSetId(entity.getId());
        version.setVersionNo(nextVersion);
        version.setParamType(entity.getParamType());
        version.setParamName(entity.getParamName());
        version.setContentJson(entity.getContentJson());
        version.setStatus(entity.getStatus());
        version.setChangeType(changeType);
        version.setChangedFields(changedFields);
        version.setSourceVersionId(sourceVersionId);
        version.setOperatorId(currentUser == null ? null : currentUser.userId());
        version.setOperatorName(currentUser == null ? null : currentUser.displayName());
        version.setLatest(true);
        version.setCreatedAt(LocalDateTime.now());
        version.setUpdatedAt(LocalDateTime.now());
        versionMapper.insert(version);
    }

    private Integer nextVersionNo(Long paramSetId) {
        return versionMapper.selectList(new LambdaQueryWrapper<ParamSetVersionEntity>()
                        .eq(ParamSetVersionEntity::getParamSetId, paramSetId)
                        .orderByDesc(ParamSetVersionEntity::getVersionNo)
                        .last("LIMIT 1"))
                .stream()
                .findFirst()
                .map(item -> item.getVersionNo() == null ? 1 : item.getVersionNo() + 1)
                .orElse(1);
    }

    private Map<String, Object> snapshot(ParamSetEntity entity) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("paramType", entity.getParamType());
        snapshot.put("paramName", entity.getParamName());
        snapshot.put("contentJson", entity.getContentJson());
        snapshot.put("status", entity.getStatus());
        return snapshot;
    }

    private String changedFields(ParamSetEntity entity, CreateParamSetRequest request) {
        List<String> fields = new ArrayList<>();
        if (!Objects.equals(entity.getParamType(), request.paramType())) {
            fields.add("paramType");
        }
        if (!Objects.equals(entity.getParamName(), request.paramName())) {
            fields.add("paramName");
        }
        if (!Objects.equals(entity.getContentJson(), request.contentJson())) {
            fields.add("contentJson");
        }
        return String.join(",", fields);
    }

    private String changedFields(ParamSetEntity entity, ParamSetVersionEntity version) {
        List<String> fields = new ArrayList<>();
        if (!Objects.equals(entity.getParamType(), version.getParamType())) {
            fields.add("paramType");
        }
        if (!Objects.equals(entity.getParamName(), version.getParamName())) {
            fields.add("paramName");
        }
        if (!Objects.equals(entity.getContentJson(), version.getContentJson())) {
            fields.add("contentJson");
        }
        if (!Objects.equals(entity.getStatus(), version.getStatus())) {
            fields.add("status");
        }
        return String.join(",", fields);
    }

    private String toJson(Map<String, Object> value) {
        if (value == null) {
            return null;
        }
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("参数集变更记录序列化失败");
        }
    }

    private CurrentUserPrincipal currentUserOrNull() {
        try {
            return CurrentUserContext.require();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
