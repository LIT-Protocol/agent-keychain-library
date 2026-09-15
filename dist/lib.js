/** Throws unless `ok` is truthy. Inside Lit every throw becomes `access_denied`. */
export function requireThat(ok, message = "Authorization denied") {
    if (!ok)
        throw new Error(message);
}
export const defineAction = (use) => use;
/** Percent-encodes one path segment and rejects anything that could change the route. */
export function pathSegment(value, maxLength = 128) {
    if (typeof value !== "string" ||
        value.length === 0 ||
        value.length > maxLength ||
        value === "." ||
        value === "..")
        throw new Error("Invalid path segment");
    return encodeURIComponent(value);
}
