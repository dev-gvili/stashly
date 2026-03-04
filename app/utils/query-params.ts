/**
 * Gets a specific query parameter from the URL, parsing comma-separated values into an array.
 * @param searchParams The URLSearchParams instance.
 * @param key The key of the query parameter (e.g., 'category').
 * @returns An array of string values, or an empty array if the key doesn't exist.
 */
export function getQueryParamArray(
  searchParams: URLSearchParams,
  key: string
): string[] {
  const value = searchParams.get(key)
  return value ? value.split(',') : []
}

/**
 * Gets a specific query parameter from the URL.
 * @param searchParams The URLSearchParams instance.
 * @param key The key of the query parameter (e.g., 'category').
 * @returns string | null
 */
export function getQueryParam(
  searchParams: URLSearchParams,
  key: string
): string | null {
  return searchParams.get(key)
}

/**
 * Adds or updates a comma-separated query parameter value in a URL's search params.
 * This function handles URL encoding correctly using URLSearchParams.
 *
 * @param {URLSearchParams} searchParams The URLSearchParams object to modify.
 * @param {string} paramName The name of the query parameter (e.g., 'tags').
 * @param {string} valueToAdd The string value to add to the parameter.
 * @returns {URLSearchParams} The modified URLSearchParams object.
 */
export const addQueryParamValue = (
  searchParams: URLSearchParams,
  paramName: string,
  valueToAdd: string
): URLSearchParams => {
  // Correctly split the string, handling potential spaces.
  const newValues = valueToAdd
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  // Get the current values for the parameter, correctly decoded.
  const currentValues = searchParams.get(paramName)
    ? searchParams
        .get(paramName)!
        .split(',')
        .map((s) => s.trim())
    : []

  // Combine current and new values, filter for uniqueness.
  const combinedValues = [...new Set([...currentValues, ...newValues])]

  // Set the new value, which URLSearchParams will correctly encode.
  searchParams.set(paramName, combinedValues.join(','))

  return searchParams
}
/**
 * Removes a specific value from a comma-separated query parameter in the URL.
 * @param searchParams The URLSearchParams instance.
 * @param key The key of the query parameter (e.g., 'category').
 * @param valueToRemove The string value to remove (e.g., 'VIDEO').
 */
export function removeQueryParamValue(
  searchParams: URLSearchParams,
  key: string,
  valueToRemove: string | string[]
): URLSearchParams {
  const values = getQueryParamArray(searchParams, key)
  if (Array.isArray(valueToRemove)) {
    const updatedValues = values.filter(
      (value) => !valueToRemove.includes(value)
    )
    searchParams.set(key, updatedValues.join(','))
    return searchParams
  } else {

    // Remove only the specified single value. If no values remain, delete the param.
    const updatedValues = values.filter((v) => v !== valueToRemove)
    if (updatedValues.length === 0) {
      searchParams.delete(key)
    } else {
      searchParams.set(key, updatedValues.join(','))
    }
    return searchParams
  }
}

/**
 * Removes a query parameter entirely from the URL.
 * @param searchParams The URLSearchParams instance.
 * @param key The key of the query parameter to remove.
 * @returns The modified URLSearchParams object.
 */
export function removeQueryParam(
  searchParams: URLSearchParams,
  key: string
): URLSearchParams {
  const values = getQueryParamArray(searchParams, key)

  if (values.length > 0) {
    searchParams.delete(key)
  }
  return searchParams
}

/**
 * Checks if a specific value exists within a comma-separated query parameter.
 * @param searchParams The URLSearchParams instance.
 * @param key The key of the query parameter (e.g., 'category').
 * @param value The string value to check for.
 * @returns True if the value exists, false otherwise.
 */
export function hasQueryParamValue(
  searchParams: URLSearchParams,
  key: string,
  value: string
): boolean {
  const values = getQueryParamArray(searchParams, key)
  return values.includes(value)
}

/**
 * Checks if a query parameter exists and has at least one value.
 * @param searchParams The URLSearchParams instance.
 * @param key The key of the query parameter (e.g., 'tags').
 */
export function hasQueryParam(
  searchParams: URLSearchParams,
  key: string
): boolean {
  const values = getQueryParamArray(searchParams, key)
  return values.length > 0
}
