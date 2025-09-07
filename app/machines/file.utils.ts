import type { MediaFileUploadInfo } from "./machine.types"
import { mediafileUploadInfo } from "./schema.zod"

export const getTimeLeft = (secondsRemaining: number) => {
	if (isNaN(secondsRemaining)) {
		return { hours: 0, minutes: 0, seconds: 0 }
	}
	const hours = Math.floor(secondsRemaining / 3600)
	const minutes = Math.floor((secondsRemaining % 3600) / 60)
	const seconds = Math.floor(secondsRemaining % 60)
	if (hours === Infinity && isNaN(minutes) && isNaN(seconds)) {
		return { hours: 0, minutes: 0, seconds: 0 }
	}
	return { hours, minutes, seconds }
}

export const calcProgress = (loadedBytes: number, size: number) => {
	let progress = (loadedBytes / size) * 100
	return parseInt(progress.toFixed(0))
}

export const parseHeaders = (xhr: XMLHttpRequest) => {
	const headersString = xhr.getAllResponseHeaders()
	console.log("headersString", headersString)
	const headersArray = headersString.split("\r\n")
	const parsedHeaders: MediaFileUploadInfo = {
		"x-amz-version-id": "",
		"x-amz-request-id": "",
		Etag: "",
	}
	headersArray.forEach((header) => {
		const [name, value] = header.split(": ")
		parsedHeaders[name as keyof MediaFileUploadInfo] = value
	})
	let headers = mediafileUploadInfo.parse(parsedHeaders)
	return {
		etag: headers.Etag,
		version: headers["x-amz-version-id"],
	}
}

export function getStats(loadedBytes: number, startTime: number, file: File) {
	let date = new Date().valueOf()
	const remainingBytes = file.size - loadedBytes
	const durationInSeconds = parseInt(((date - startTime) / 1000).toFixed(0))

	let uploadSpeedMbps = parseInt((loadedBytes / durationInSeconds).toFixed(0))

	if (isNaN(uploadSpeedMbps)) {
		uploadSpeedMbps = 0
	}
	const secondsRemaining = remainingBytes / uploadSpeedMbps
	let timeLeft = getTimeLeft(secondsRemaining)
	let progress = calcProgress(loadedBytes, file.size)
	return {
		timeLeft,
		progress,
		uploadSpeedMbps,
		runTime: durationInSeconds,
	}
}

export async function getPresignUrl(bucketName: string, file: File){
    if (!bucketName) {
		throw new Error(`Upload file ${file.name} failed, missing bucketName`)
	}
	if (!file) {
		throw new Error(`Upload failed, file is undefined`)
	}
	const formData = new FormData()
	formData.append("intent", "put_url")
	formData.append("bucketName", bucketName)
	formData.append("fileName", file.name)

	const res = await fetch(`/api/s3/presign_url`, {
		method: "POST",
		body: formData,
	})

	const data: { url: string } = await res.json()
	return data
}