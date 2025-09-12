declare function defineBackground(
  main: () => void | Promise<void>
): void;

declare function defineContentScript(def: {
  matches: string[];
  runAt?: string;
  main: () => void;
}): void;
