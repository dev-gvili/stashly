-- An upload is refused when a "File" row already serves its key
-- (`assertKeyUnfiled`, twice per file), and a refused upload's bytes are only
-- deleted when no row serves them (`discardUploadedObject`). Both look "File"
-- up by bucket and key, which had no index. Measured 31 Oct in a rolled-back
-- probe on 8,791 rows: 1.34 ms / 387 buffers (seq scan) -> 0.10 ms / 4 buffers.
CREATE INDEX "file_bucket_key" ON "File"("bucket", "key");
