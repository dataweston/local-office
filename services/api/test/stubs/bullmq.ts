export class Queue<T = any> {
  constructor(public readonly name: string, public readonly options?: unknown) {}

  async add(_name: string, _data: T, _opts?: unknown): Promise<{ id: string }> {
    return { id: 'stub-job' };
  }

  async close(): Promise<void> {}
}
