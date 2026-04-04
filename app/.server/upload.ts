import type { CompletedPart } from '@aws-sdk/client-s3'
import { S3Service } from '@/.server/s3'
import type { User } from '@/services/auth.types'

interface UploadServiceArgs {
  s3Service: S3Service
  user: User
}

interface BaseUploadArgs {
  key: string
  uploadId: string
}

export interface CreateMultipartUploadInput extends Omit<
  BaseUploadArgs,
  'uploadId'
> {
  metadata?: Record<string, string>
}
export interface GetPresignedUrlForPartInput extends BaseUploadArgs {
  partNumber: number
}
export interface CompleteMultipartUploadInput extends BaseUploadArgs {
  parts: CompletedPart[]
}
export interface AbortMultipartUploadInput extends BaseUploadArgs {}

export interface CreateMultipartUploadOutput {
  uploadId: string
}

export interface GetPresignedUrlForPartOutput {
  url: string
}

export interface CompleteMultipartUploadOutput {
  etag: string
  version?: string
}

export interface AbortMultipartUploadOutput {
  success: boolean
}

export class UploadService {
  private s3: S3Service
  private user: User

  constructor({ s3Service, user }: UploadServiceArgs) {
    this.s3 = s3Service
    this.user = user
  }

  async fixCors(bucket?: string) {
    let cors = await this.s3.getBucketCors()
    console.log('Current CORS configuration:', cors)
    if (!cors || !cors.CORSRules || cors.CORSRules.length === 0) {
      cors = await this.s3.setCorsOnBucket()
      console.log('CORS configuration set:', cors)
    }
    return cors // Return the (potentially updated) CORS configuration
  }
  /**
   * Initiates a multipart upload for a large file.
   *
   * @param {object} args - The arguments for creating a multipart upload.
   * @param {string} args.key - The S3 object key for the file.
   * @param {string} args.itemId - The ID of the associated item in the database.
   * @param {Record<string, string>} [args.metadata] - Optional metadata to attach to the upload.
   * @returns {Promise<string>} The Upload ID for the multipart upload.
   */
  async createMultipartUpload({
    key,
    metadata,
  }: CreateMultipartUploadInput): Promise<string> {
    const { UploadId: uploadId } = await this.s3.createMultipartUpload(
      key,
      metadata
    )
    if (!uploadId) throw new Error('Failed to create multipart upload')
    return uploadId
  }

  /**
   * Retrieves a presigned URL for a specific part of a multipart upload.
   * This URL is used by the client to upload individual chunks of the file directly to S3.
   *
   * @param {object} args - The arguments for getting a presigned URL for a part.
   * @param {string} args.key - The S3 object key.
   * @param {string} args.uploadId - The upload ID of the multipart upload.
   * @param {number} args.partNumber - The part number for which to get the presigned URL.
   * @returns {Promise<string>} A presigned URL for uploading the specified part.
   */

  async getPresignedUrlForPart({
    key,
    uploadId,
    partNumber,
  }: GetPresignedUrlForPartInput): Promise<string> {
    return this.s3.getPresignedUrlForPart(key, uploadId, partNumber)
  }

  /**
   * Completes a multipart upload.
   *
   * @param {string} key - The S3 object key.
   * @param {string} uploadId - The upload ID.
   * @param {{ ETag: string; PartNumber: number }[]} parts - The uploaded parts.
   */
  async completeMultipartUpload({
    key,
    uploadId,
    parts,
  }: CompleteMultipartUploadInput) {
    const { Key, Bucket, ETag, VersionId, Location, $metadata } =
      await this.s3.completeMultipartUpload(key, uploadId, parts)
    return {
      key: Key,
      bucket: Bucket,
      etag: ETag,
      version: VersionId,
      location: Location,
      metadata: $metadata,
    }
  }

  /**
   * Aborts a multipart upload.
   *
   * @param {AbortMultipartUploadInput} input - The input object containing the key and uploadId.
   * @returns {Promise<void>} - A promise that resolves when the multipart upload is aborted.
   * @throws {Error} - Throws an error if the multipart upload fails to abort.
   */
  async abortMultipartUpload({
    key,
    uploadId,
  }: AbortMultipartUploadInput): Promise<void> {
    await this.s3.abortMultipartUpload(key, uploadId)
  }
}
