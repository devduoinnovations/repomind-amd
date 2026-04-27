import type { WriteRepoFileInput } from "./github";

export interface RepoFileWriter {
  writeFiles(inputs: WriteRepoFileInput[]): Promise<void>;
}

export class CommitBatcher {
  private pending = new Map<string, WriteRepoFileInput>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly writer: RepoFileWriter,
    private readonly debounceMs = 30_000
  ) {}

  enqueue(input: WriteRepoFileInput): void {
    this.pending.set(input.path, input);

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      void this.flush();
    }, this.debounceMs);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const inputs = [...this.pending.values()];
    this.pending.clear();

    if (inputs.length > 0) {
      await this.writer.writeFiles(inputs);
    }
  }
}
