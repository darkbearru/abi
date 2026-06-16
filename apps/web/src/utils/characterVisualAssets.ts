import type { Asset, Character, CharacterVersion } from '@abi/shared';

export const CHARACTER_PASSPORT_ASSET_TYPES = [
  'front_view',
  'side_view',
  'back_view',
  'portrait'
] as const;

export type CharacterPassportAssetType = (typeof CHARACTER_PASSPORT_ASSET_TYPES)[number];

export function getCharacterPortraitAsset(
  assets: readonly Asset[],
  character: Character
): Asset | null {
  const versionIds = new Set(character.versions.map((version) => version.id));
  const portraits = assets.filter(
    (asset) =>
      asset.entityType === 'CHARACTER_VERSION' &&
      typeof asset.entityId === 'string' &&
      versionIds.has(asset.entityId) &&
      getPassportAssetType(asset) === 'portrait'
  );

  return portraits.find(isApprovedAsset) ?? portraits[0] ?? null;
}

export function getCharacterVersionAssets(
  assets: readonly Asset[],
  version: CharacterVersion
): readonly Asset[] {
  return CHARACTER_PASSPORT_ASSET_TYPES.flatMap((assetType) => {
    const candidates = assets.filter(
      (asset) =>
        asset.entityType === 'CHARACTER_VERSION' &&
        asset.entityId === version.id &&
        getPassportAssetType(asset) === assetType
    );
    const selected = candidates.find(isApprovedAsset) ?? candidates[0];

    return selected ? [selected] : [];
  });
}

export function getPassportAssetType(asset: Asset): CharacterPassportAssetType | null {
  const metadata = toRecord(asset.metadata);
  const value = metadata?.passportAssetType;

  return isCharacterPassportAssetType(value) ? value : null;
}

export function isApprovedAsset(asset: Asset): boolean {
  return asset.approvalStatus?.toLocaleUpperCase() === 'APPROVED';
}

function isCharacterPassportAssetType(value: unknown): value is CharacterPassportAssetType {
  return (
    typeof value === 'string' &&
    CHARACTER_PASSPORT_ASSET_TYPES.includes(value as CharacterPassportAssetType)
  );
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
