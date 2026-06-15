DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'CharacterVersion'
      AND column_name = 'sourceFactIds'
  ) THEN
    ALTER TABLE "CharacterVersion" ALTER COLUMN "sourceFactIds" DROP DEFAULT;
  END IF;
END $$;
