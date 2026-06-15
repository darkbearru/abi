CREATE UNIQUE INDEX "Book_contentHash_key" ON "Book"("contentHash");
CREATE UNIQUE INDEX "BookSeries_userId_title_key" ON "BookSeries"("userId", "title");
