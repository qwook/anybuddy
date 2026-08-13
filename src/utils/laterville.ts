/**
 * Promise but you can resolve and reject it from it's object.
 */
export default class LaterVille<T> extends Promise<T> {
  resolve: (ret: T) => void = () => {};
  reject: (error: string) => void = () => {};
  constructor(
    executor: (
      resolve: (ret: T) => void,
      reject: (error: string) => void,
    ) => void = () => {},
  ) {
    let _resolve, _reject;
    super((resolve, reject) => {
      _resolve = resolve;
      _reject = reject;
      return executor(resolve, reject);
    });
    // @ts-ignore
    this.resolve = _resolve;
    // @ts-ignore
    this.reject = _reject;
  }
}
