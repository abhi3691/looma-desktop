import test from "node:test";
import assert from "node:assert/strict";
import { personalMemory } from "../src/personal-memory";
test("personal details are recalled locally without treating arbitrary conversation as facts", () => {
  assert.equal(
    personalMemory("My name is Abhinand", [])?.save,
    "Name: Abhinand",
  );
  assert.match(
    personalMemory("What is my name?", ["Name: Abhinand"])?.answer ?? "",
    /Abhinand/,
  );
  assert.equal(personalMemory("What is the weather?", []), undefined);
  assert.equal(
    personalMemory("My name is sk_live_abcdef12345678901234567890", []),
    undefined,
  );
});
