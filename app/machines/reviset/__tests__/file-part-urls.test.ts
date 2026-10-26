import { describe, expect, it } from 'vitest'
import { createActor, createMachine, fromCallback, fromPromise, waitFor } from 'xstate'
import { fileMachine } from '../file.machine'
import type {
  CreateMultipartUploadInput,
  CreateMultipartUploadOutput,
  UploadPartsInput,
} from '@/machines/multipart/s3.mulipart.utils'

/**
 * The file machine tells the create request how many parts the file has, and
 * hands the URLs the answer carries to the part uploader, so the uploader
 * needn't ask for them again (tech-debt item 39).
 */
describe('file machine part URLs', () => {
  it('sends the part count and passes the create answer’s URLs on', async () => {
    let created: CreateMultipartUploadInput | undefined
    let uploader: UploadPartsInput | undefined
    const actor = createActor(
      fileMachine.provide({
        actors: {
          checkQuota: fromPromise(async () => ({ itemId: 'item_1', result: 'allowed' as 'allowed' | 'denied' })),
          createMultipartUpload: fromPromise<CreateMultipartUploadOutput, CreateMultipartUploadInput>(
            async ({ input }) => {
              created = input
              return { uploadId: 'up_1', partUrls: ['https://s3.fake/1', 'https://s3.fake/2', 'https://s3.fake/3'] }
            }
          ),
          multipart: fromCallback(({ input }) => {
            uploader = input as UploadPartsInput
          }),
        },
      }),
      {
        input: {
          manager: createActor(createMachine({})).start(),
          user: { id: 'usr_1', bucket: 'bucket', rootId: 'item_root', email: 'a@b.c' },
          mediaFile: {
            id: 'item_1',
            key: 'item_root/a.bin',
            // 2 full 5 MiB parts and 1 byte: 3 parts.
            file: new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'a.bin'),
          },
        } as never,
      }
    ).start()
    actor.send({ type: 'start' } as never)
    await waitFor(actor, (s) => s.matches({ uploading: 'active' }), { timeout: 1000 })

    expect(created?.partCount).toBe(3)
    expect(uploader).toMatchObject({
      key: 'item_root/a.bin',
      uploadId: 'up_1',
      partUrls: ['https://s3.fake/1', 'https://s3.fake/2', 'https://s3.fake/3'],
    })
  })
})
