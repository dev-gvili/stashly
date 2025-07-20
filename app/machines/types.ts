import { z } from "zod"
import {
	config,
	fileMachineContext,
	mediafile,
	mediaFileStatus,
	mediafileUploadInfo,
	uiConfig,
	uploadManagerSchema,
	uploadManagerEvents,
	mediafileEvents,
    mediafileMachineInput,
} from "./schema.zod"

export type MediaFileInput = z.infer<typeof mediafileMachineInput>
export type MediaFileEvents = z.infer<typeof mediafileEvents>
export type MediaFileData = z.infer<typeof fileMachineContext>
export type MediaFileStatus = z.infer<typeof mediaFileStatus>
export type MediaFileUploadInfo = z.infer<typeof mediafileUploadInfo>
export type MediaFile = z.infer<typeof mediafile>
export type Config = z.infer<typeof config>
export type UIConfig = z.infer<typeof uiConfig>
export type UploadManagerData = z.infer<typeof uploadManagerSchema>
export type UploadManagerEvents = z.infer<typeof uploadManagerEvents>
