export interface ParsedFlags {
  json: boolean;
  args: string[];
  flags: Record<string, string>;
}
