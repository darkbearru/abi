DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Book"
    GROUP BY "contentHash"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate Book.contentHash rows exist. Merge duplicate books before applying uniqueness constraints.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Book_contentHash_key" ON "Book"("contentHash");
CREATE UNIQUE INDEX IF NOT EXISTS "BookSeries_userId_title_key" ON "BookSeries"("userId", "title");
