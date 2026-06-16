export interface ServiceInfo {
  readonly name: string;
  readonly version: string;
}

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly bookTitle?: string | null;
  readonly seriesTitle?: string | null;
  readonly updatedAt?: string | null;
}

export interface BookUploadResponse {
  readonly bookId: string;
  readonly projectId: string;
  readonly bookAnalysisId?: string;
  readonly existingAnalysisAvailable: boolean;
}

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly role: 'USER' | 'ADMIN';
}

export interface AuthResponse {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresInSeconds: number;
  readonly user: AuthUser;
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface RegisterRequest extends LoginRequest {
  readonly name?: string;
}

export interface VisualStyle {
  readonly id: string;
  readonly name: string;
  readonly slug?: string;
  readonly prompt?: string;
  readonly primaryColor?: string | null;
  readonly secondaryColor?: string | null;
  readonly accentColor?: string | null;
}

export interface CharacterVersion {
  readonly id: string;
  readonly version: number;
  readonly age?: string | null;
  readonly appearance?: unknown;
  readonly personality?: unknown;
  readonly speechManner?: string | null;
  readonly clothing?: unknown;
}

export interface Character {
  readonly id: string;
  readonly canonicalName: string;
  readonly aliases: readonly { readonly id: string; readonly alias: string }[];
  readonly versions: readonly CharacterVersion[];
}

export interface LocationVersion {
  readonly id: string;
  readonly version: number;
  readonly description: string;
  readonly atmosphere?: unknown;
  readonly palette?: unknown;
  readonly era?: string | null;
}

export interface Location {
  readonly id: string;
  readonly name: string;
  readonly parentId?: string | null;
  readonly aliases: readonly { readonly id: string; readonly alias: string }[];
  readonly versions: readonly LocationVersion[];
}

export interface TimelineEvent {
  readonly id: string;
  readonly title: string;
  readonly description?: string | null;
  readonly chapterIndex: number;
  readonly relativeOrder: number;
  readonly confidence: number;
}

export interface GraphNode {
  readonly id: string;
  readonly labels: readonly string[];
  readonly properties: Record<string, unknown>;
}

export interface GraphRelationship {
  readonly id: string;
  readonly type: string;
  readonly source: string;
  readonly target: string;
  readonly properties: Record<string, unknown>;
}

export interface ProjectGraph {
  readonly nodes: readonly GraphNode[];
  readonly relationships: readonly GraphRelationship[];
}

export interface Asset {
  readonly id: string;
  readonly localPath: string;
  readonly mimeType: string;
  readonly prompt?: string | null;
  readonly entityType?: string | null;
  readonly entityId?: string | null;
  readonly approvalStatus?: string | null;
}

export interface GenerationJob {
  readonly id: string;
  readonly status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  readonly progress: number;
  readonly error?: unknown;
}

export interface SceneGenerationRequest {
  readonly text: string;
  readonly styleId: string;
  readonly timelineHint?: string;
  readonly aspectRatio?: string;
}

export interface SceneGenerationResponse {
  readonly status: 'generated' | 'queued' | 'needs_resolution' | 'missing_references';
  readonly sceneId?: string;
  readonly generationJobId?: string;
  readonly assetId?: string;
  readonly localPath?: string;
  readonly prompt?: string;
  readonly candidates: readonly unknown[];
  readonly createSuggestions: readonly unknown[];
  readonly missingReferences: readonly unknown[];
  readonly referenceAssets: readonly unknown[];
}
