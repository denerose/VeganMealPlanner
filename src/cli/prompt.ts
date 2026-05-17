/** True when stdin is connected to a terminal (interactive session). */
export function isInteractive(): boolean {
  return Boolean(process.stdin?.isTTY);
}

/**
 * Prompt the user for a text value.
 * When stdin is not a TTY, throws with a clear error naming the missing flag.
 */
export async function prompt(label: string, flagName: string): Promise<string> {
  if (!isInteractive()) {
    throw new Error(`Missing required flag: --${flagName}. Provide it or run interactively.`);
  }
  process.stdout.write(`${label}: `);
  const line = await readLine();
  return line.trim();
}

/**
 * Prompt for a value, keeping input hidden (for passwords).
 * Uses raw terminal mode so characters are not echoed.
 */
export async function promptHidden(label: string, flagName: string): Promise<string> {
  if (!isInteractive()) {
    throw new Error(`Missing required flag: --${flagName}. Provide it or run interactively.`);
  }

  const { stdin } = process;
  if (stdin?.isTTY && typeof stdin.setRawMode === 'function') {
    process.stdout.write(`${label}: `);
    return await readHiddenLine();
  }

  // Fallback: visible input (no raw mode available)
  return prompt(label, flagName);
}

/**
 * Return a value: use `provided` if non-empty, otherwise prompt interactively.
 * Throws when the value is missing and stdin is not a TTY.
 */
export async function required(
  label: string,
  flagName: string,
  provided?: string
): Promise<string> {
  const val = provided?.trim();
  if (val) return val;
  return prompt(label, flagName);
}

/**
 * Same as `required` but hides input (for passwords).
 */
export async function requiredHidden(
  label: string,
  flagName: string,
  provided?: string
): Promise<string> {
  const val = provided?.trim();
  if (val) return val;
  return promptHidden(label, flagName);
}

// --- internal helpers ---

function readLine(): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin } = process;
    if (!stdin) {
      reject(new Error('stdin is not available'));
      return;
    }

    const onData = (chunk: Buffer) => {
      cleanup();
      resolve(chunk.toString('utf-8').replace(/\r?\n$/, ''));
    };
    const onEnd = () => {
      cleanup();
      resolve('');
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.removeListener('end', onEnd);
      stdin.removeListener('error', onError);
      if (stdin.isTTY) {
        stdin.setRawMode(false);
        stdin.pause();
      }
    };

    if (stdin.isTTY) {
      stdin.setRawMode(false);
    }
    stdin.resume();
    stdin.once('data', onData);
    stdin.once('end', onEnd);
    stdin.once('error', onError);
  });
}

function readHiddenLine(): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin } = process;
    if (!stdin || !stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      reject(new Error('Hidden input requires a TTY'));
      return;
    }

    let input = '';
    const onData = (chunk: Buffer) => {
      const chars = chunk.toString('utf-8');
      for (const ch of chars) {
        if (ch === '\n' || ch === '\r') {
          cleanup();
          process.stdout.write('\n');
          resolve(input);
          return;
        }
        if (ch === '\u007f' || ch === '\b') {
          // backspace
          input = input.slice(0, -1);
        } else if (ch === '\u0003') {
          // Ctrl+C
          cleanup();
          process.stdout.write('\n');
          process.exit(1);
        } else {
          input += ch;
        }
      }
    };

    const onEnd = () => {
      cleanup();
      process.stdout.write('\n');
      resolve(input);
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.removeListener('end', onEnd);
      stdin.removeListener('error', onError);
      stdin.setRawMode(false);
      stdin.pause();
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
    stdin.once('end', onEnd);
    stdin.once('error', onError);
  });
}
