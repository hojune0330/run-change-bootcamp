export function parseXml(content: string): Document | null {
  const document = new DOMParser().parseFromString(content, "application/xml")
  return document.querySelector("parsererror") === null ? document : null
}
