import type { WorkerConfig } from '../../../config/environment.js';
import type { AiProvider } from './ai-provider.js';
import { AiProviderService } from './ai-provider.service.js';
import type { AiTokenBudgetStore } from './ai-token-budget.store.js';

export function createWorkerAiProviderService(
  provider: AiProvider,
  config: Pick<WorkerConfig, 'aiMaxTokensPerDocument'>,
  tokenBudget?: AiTokenBudgetStore,
): AiProviderService {
  return new AiProviderService(provider, {
    maxTokensPerDocument: config.aiMaxTokensPerDocument,
    ...(tokenBudget ? { tokenBudget } : {}),
  });
}
