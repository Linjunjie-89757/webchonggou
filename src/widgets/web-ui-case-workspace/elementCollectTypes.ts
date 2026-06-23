import type {
  WebUiElementCollectCandidate,
  WebUiElementCollectGroupStrategy,
  WebUiElementCollectScope,
  WebUiLocatorType,
} from '@/entities/web-ui-automation'

export type WebUiElementCollectMode = 'ONLINE' | 'OFFLINE'

export interface WebUiElementCollectLaunchForm {
  providerConnectionId: number | null
  environmentId: number | null
  pageUrl: string
  moduleId: number | null
  pageId: number | null
  pageName: string
  groupStrategy: WebUiElementCollectGroupStrategy
  groupId: number | null
  groupName: string
  scope: WebUiElementCollectScope
}

export interface WebUiElementCollectCandidateView extends WebUiElementCollectCandidate {
  id: string
  selected: boolean
  groupName: string
  elementName: string
  locatorType: WebUiLocatorType
  locatorValue: string
  confidence: number
  reason: string
  candidateSource: string
  validationStatus: string
  saveBlockedReason: string | null
}

export function mapCollectCandidatesToViews(
  candidates: WebUiElementCollectCandidate[],
  options: {
    groupStrategy?: WebUiElementCollectGroupStrategy
    customGroupName?: string
    idPrefix?: string
  } = {},
): WebUiElementCollectCandidateView[] {
  const idPrefix = options.idPrefix || ''
  return candidates.map((item, index) => ({
    ...item,
    id: `${idPrefix}${item.locatorType}-${index}-${item.locatorValue}`,
    selected: item.recommendedToSave
      && (item.validationStatus === 'PASSED' || item.validationStatus === 'UNVERIFIED')
      && !item.saveBlockedReason,
    groupName: options.groupStrategy === 'CUSTOM' ? (options.customGroupName || item.groupName) : item.groupName,
    elementName: item.elementName,
    locatorType: item.locatorType,
    locatorValue: item.locatorValue,
    confidence: Number(item.confidence || 0),
    reason: item.reason || '',
    candidateSource: item.candidateSource || 'RULE',
    validationStatus: item.validationStatus || 'UNVERIFIED',
    saveBlockedReason: item.saveBlockedReason || null,
  }))
}
