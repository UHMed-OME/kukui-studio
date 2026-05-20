import { describe, it, expectTypeOf } from "vitest";
import type { ActivityManifest, BloomLevel } from "./types.js";
import type { z } from "zod";
import type { ComponentType, LazyExoticComponent } from "react";

describe("ActivityManifest", () => {
  it("pins kind as a string literal", () => {
    type M = ActivityManifest<"foo">;
    expectTypeOf<M["kind"]>().toEqualTypeOf<"foo">();
  });

  it("requires schema, Component, uiSchema, starter, label, description, bloom, live", () => {
    type M = ActivityManifest<"foo">;
    expectTypeOf<M["schema"]>().toMatchTypeOf<z.ZodTypeAny>();
    expectTypeOf<M["Component"]>().toMatchTypeOf<LazyExoticComponent<ComponentType<unknown>>>();
    expectTypeOf<M["uiSchema"]>().toMatchTypeOf<Record<string, unknown>>();
    expectTypeOf<M["starter"]>().toMatchTypeOf<unknown>();
    expectTypeOf<M["label"]>().toEqualTypeOf<string>();
    expectTypeOf<M["description"]>().toEqualTypeOf<string>();
    expectTypeOf<M["bloom"]>().toMatchTypeOf<BloomLevel>();
    expectTypeOf<M["live"]>().toEqualTypeOf<boolean>();
  });

  it("permits optional Icon and Editor", () => {
    type M = ActivityManifest<"foo">;
    expectTypeOf<M["Icon"]>().toMatchTypeOf<ComponentType<{ className?: string }> | undefined>();
    expectTypeOf<M["Editor"]>().toMatchTypeOf<LazyExoticComponent<ComponentType<unknown>> | undefined>();
  });
});
