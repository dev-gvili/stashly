export function fileUploadHandler(
	url: string,
	file: File,
	onProgress: (loadedBytes: number) => void,
	onAbort: () => void,
    xhr: XMLHttpRequest
) {
	// Listen for the `upload.error` event (upload failed)
	xhr.upload.onerror = () => {
		console.error("Upload failed.")
	}
	// Listen for the `upload.abort` event (upload cancelled)
	xhr.upload.onabort = () => {
		console.error(`Upload cancelled. ${xhr.response}`)
		onAbort()
	}
	// Listen for the `upload.progress` event
	xhr.upload.onprogress = (event) => {
		onProgress(event.loaded)
	}
	// Open the request (replace '/upload' with your server endpoint)
	xhr.open("PUT", url, true)
	// Send the request (you can append form data or a blob here)
	xhr.send(file)
}
