import { z } from "zod";
export * from "./shape.ts";
/** True when `hostname` is permitted by an `allowedHosts` list (exact match, or one label under a `*.` entry). */
export declare function hostAllowed(hosts: readonly string[], hostname: string): boolean;
declare const useDefinition: z.ZodObject<{
    v: z.ZodLiteral<1>;
    id: z.ZodString;
    kind: z.ZodLiteral<"use">;
    name: z.ZodString;
    description: z.ZodString;
    category: z.ZodEnum<{
        payments: "payments";
        ai: "ai";
        developer: "developer";
        messaging: "messaging";
        data: "data";
        other: "other";
    }>;
    author: z.ZodString;
    license: z.ZodString;
    operation: z.ZodString;
    credentialPattern: z.ZodString;
    allowedHosts: z.ZodArray<z.ZodString>;
    input: z.ZodNullable<z.ZodType<import("./shape.ts").Shape, unknown, z.core.$ZodTypeInternals<import("./shape.ts").Shape, unknown>>>;
    output: z.ZodType<import("./shape.ts").Shape, unknown, z.core.$ZodTypeInternals<import("./shape.ts").Shape, unknown>>;
    limits: z.ZodObject<{
        timeoutMs: z.ZodNumber;
        maxResponseBytes: z.ZodNumber;
        maxRequests: z.ZodNumber;
    }, z.core.$strict>;
    ui: z.ZodObject<{
        label: z.ZodString;
        hint: z.ZodString;
        placeholder: z.ZodString;
    }, z.core.$strict>;
    tier: z.ZodEnum<{
        verified: "verified";
        community: "community";
    }>;
    deprecated: z.ZodBoolean;
}, z.core.$strict>;
export declare const definitionSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    v: z.ZodLiteral<1>;
    id: z.ZodString;
    kind: z.ZodLiteral<"use">;
    name: z.ZodString;
    description: z.ZodString;
    category: z.ZodEnum<{
        payments: "payments";
        ai: "ai";
        developer: "developer";
        messaging: "messaging";
        data: "data";
        other: "other";
    }>;
    author: z.ZodString;
    license: z.ZodString;
    operation: z.ZodString;
    credentialPattern: z.ZodString;
    allowedHosts: z.ZodArray<z.ZodString>;
    input: z.ZodNullable<z.ZodType<import("./shape.ts").Shape, unknown, z.core.$ZodTypeInternals<import("./shape.ts").Shape, unknown>>>;
    output: z.ZodType<import("./shape.ts").Shape, unknown, z.core.$ZodTypeInternals<import("./shape.ts").Shape, unknown>>;
    limits: z.ZodObject<{
        timeoutMs: z.ZodNumber;
        maxResponseBytes: z.ZodNumber;
        maxRequests: z.ZodNumber;
    }, z.core.$strict>;
    ui: z.ZodObject<{
        label: z.ZodString;
        hint: z.ZodString;
        placeholder: z.ZodString;
    }, z.core.$strict>;
    tier: z.ZodEnum<{
        verified: "verified";
        community: "community";
    }>;
    deprecated: z.ZodBoolean;
}, z.core.$strict>, z.ZodObject<{
    v: z.ZodLiteral<1>;
    id: z.ZodLiteral<"export">;
    kind: z.ZodLiteral<"export">;
    name: z.ZodString;
    description: z.ZodString;
    category: z.ZodLiteral<"other">;
    author: z.ZodString;
    license: z.ZodString;
    operation: z.ZodLiteral<"get">;
    ui: z.ZodObject<{
        label: z.ZodString;
        hint: z.ZodString;
        placeholder: z.ZodString;
    }, z.core.$strict>;
    tier: z.ZodLiteral<"verified">;
    deprecated: z.ZodBoolean;
}, z.core.$strict>], "kind">;
export type ActionDefinition = z.infer<typeof definitionSchema>;
export type UseDefinition = z.infer<typeof useDefinition>;
/** Catalog as emitted by the build: definitions keyed by release id. */
export type Catalog = Record<string, ActionDefinition>;
export declare const catalogSchema: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
    v: z.ZodLiteral<1>;
    id: z.ZodString;
    kind: z.ZodLiteral<"use">;
    name: z.ZodString;
    description: z.ZodString;
    category: z.ZodEnum<{
        payments: "payments";
        ai: "ai";
        developer: "developer";
        messaging: "messaging";
        data: "data";
        other: "other";
    }>;
    author: z.ZodString;
    license: z.ZodString;
    operation: z.ZodString;
    credentialPattern: z.ZodString;
    allowedHosts: z.ZodArray<z.ZodString>;
    input: z.ZodNullable<z.ZodType<import("./shape.ts").Shape, unknown, z.core.$ZodTypeInternals<import("./shape.ts").Shape, unknown>>>;
    output: z.ZodType<import("./shape.ts").Shape, unknown, z.core.$ZodTypeInternals<import("./shape.ts").Shape, unknown>>;
    limits: z.ZodObject<{
        timeoutMs: z.ZodNumber;
        maxResponseBytes: z.ZodNumber;
        maxRequests: z.ZodNumber;
    }, z.core.$strict>;
    ui: z.ZodObject<{
        label: z.ZodString;
        hint: z.ZodString;
        placeholder: z.ZodString;
    }, z.core.$strict>;
    tier: z.ZodEnum<{
        verified: "verified";
        community: "community";
    }>;
    deprecated: z.ZodBoolean;
}, z.core.$strict>, z.ZodObject<{
    v: z.ZodLiteral<1>;
    id: z.ZodLiteral<"export">;
    kind: z.ZodLiteral<"export">;
    name: z.ZodString;
    description: z.ZodString;
    category: z.ZodLiteral<"other">;
    author: z.ZodString;
    license: z.ZodString;
    operation: z.ZodLiteral<"get">;
    ui: z.ZodObject<{
        label: z.ZodString;
        hint: z.ZodString;
        placeholder: z.ZodString;
    }, z.core.$strict>;
    tier: z.ZodLiteral<"verified">;
    deprecated: z.ZodBoolean;
}, z.core.$strict>], "kind">>;
