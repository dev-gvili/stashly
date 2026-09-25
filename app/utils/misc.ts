
/**
 * this function take any number of functions with any number of arguments and run them one by one
 * @param fns any number of functions
 * @returns void
 */
export const callAll =
  (...fns: any[]) =>
  (...args: any[]) => {
    return fns.forEach((fn) => typeof fn === 'function' && fn(...args))
  }
