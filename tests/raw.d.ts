// Vite: bestanden als tekst importeren ("pad?raw"), gebruikt in tests/themes.test.ts.
declare module "*?raw" {
  const content: string;
  export default content;
}
