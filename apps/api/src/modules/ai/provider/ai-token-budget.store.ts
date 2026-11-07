export interface AiTokenBudgetIdentity {
  documentId: string;
  requestId: string;
}

export type AiTokenReservation = 'RESERVED' | 'DUPLICATE' | 'EXHAUSTED';

export interface AiTokenBudgetStore {
  reserve(
    identity: AiTokenBudgetIdentity,
    limit: number,
    reservationTokens: number,
  ): Promise<AiTokenReservation>;
  settle(identity: AiTokenBudgetIdentity, chargedTokens: number): Promise<void>;
}
