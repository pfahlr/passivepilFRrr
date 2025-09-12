declare global {
  function defineBackground(init: () => void): unknown
  interface ContentScriptDefinition {
    matches: string[]
    runAt?: string
    main: () => void
  }
  function defineContentScript(def: ContentScriptDefinition): unknown
}
export {}
