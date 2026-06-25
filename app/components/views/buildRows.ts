export type ImageData = {
  id: string
  src: string | null
  alt: string
  width: number
  height: number
  sizes: string
  srcSet: string
}

export type RowImageData = {
  img: ImageData
  width: number
  height: number
}

export const calculateImageDimensions = (
  originalWidth: number,
  originalHeight: number,
  targetHeight: number
) => {
  const aspectRatio = originalWidth / originalHeight
  const newWidth = targetHeight * aspectRatio
  return { width: newWidth, height: targetHeight }
}

/**
 * Builds a justified layout of images within a container.
 *
 * This function takes a list of images and arranges them into rows that fit
 * within a specified container width. The height of each row is adjusted to
 * maintain the aspect ratio of the images.
 *
 * @param images An array of image data objects.
 * @param containerWidth The width of the container in pixels.
 * @param targetRowHeight The target height of each row in pixels.
 * @param gap The gap between images in pixels.
 * @returns An array of rows, where each row is an array of image objects with calculated dimensions.
 */
export function buildRows(
  images: ImageData[],
  containerWidth: number,
  targetRowHeight: number = 150,
  maxPerRow: number = 8,
  gap: number = 8
) {
  // An array to store the rows of images.
  const rows: RowImageData[][] = []
  // The current row being built.
  let currentRow: RowImageData[] = []
  // The sum of aspect ratios of images in the current row.
  let aspectSum = 0

  // Iterate over each image to place it in a row.
  for (const img of images) {
    // Calculate the aspect ratio of the image.
    const aspectRatio = img.width / img.height

    const { width, height } = calculateImageDimensions(
      img.width,
      img.height,
      targetRowHeight
    )

    // Add the image to the current row.
    currentRow.push({
      img,
      // Temporarily use dimensions based on target height for row width check
      width,
      height,
    })
    // Add the aspect ratio of the image to the sum.
    aspectSum += aspectRatio

    // Calculate the total width of the current row, including gaps.
    const totalGapsWidth = gap * (currentRow.length - 1)
    const rowWidthAtTargetHeight = aspectSum * targetRowHeight + totalGapsWidth

 // If the current row exceeds the container width or hits the item cap, justify the row.
    if (rowWidthAtTargetHeight > containerWidth || currentRow.length >= maxPerRow) {
      // Calculate the final row height that makes the row fit the container width.
      const availableWidthForImages = containerWidth - totalGapsWidth
      const finalRowHeight = availableWidthForImages / aspectSum

      // Justify the current row.
      for (let i = 0; i < currentRow.length; i++) {
        const item = currentRow[i]
        const { width, height } = calculateImageDimensions(
          item.img.width,
          item.img.height,
          finalRowHeight
        )
        item.width = width
        item.height = height
      }

      // Add the justified row to the list of rows.
      rows.push(
        currentRow.map((item) => ({
          img: item.img,
          width: finalRowHeight * (item.img.width / item.img.height),
          height: finalRowHeight,
        }))
      )
      // Reset the current row and aspect sum.
      currentRow = []
      aspectSum = 0
    }
  }

  // Push any trailing images as a final, non-stretched row. These don't fill the
  // container, so keep them at the target height (left-aligned) rather than
  // justifying — otherwise a lone leftover image would stretch full-width.
  if (currentRow.length > 0) {
    rows.push(
      currentRow.map((item) => ({
        img: item.img,
        width: targetRowHeight * (item.img.width / item.img.height),
        height: targetRowHeight,
      }))
    )
  }

  // Return the completed rows.
  return rows
}
