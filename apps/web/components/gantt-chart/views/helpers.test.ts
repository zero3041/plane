import assert from "node:assert/strict";
import { test } from "node:test";
import { getWeekNumberByDate } from "./helpers";

test("Gantt weeks start on Monday, including around New Year", () => {
  assert.equal(getWeekNumberByDate(new Date(2023, 0, 1)), 1);
  assert.equal(getWeekNumberByDate(new Date(2023, 0, 2)), 2);
  assert.equal(getWeekNumberByDate(new Date(2023, 11, 31)), 53);
  assert.equal(getWeekNumberByDate(new Date(2024, 0, 1)), 1);
  assert.equal(getWeekNumberByDate(new Date(2024, 0, 7)), 1);
  assert.equal(getWeekNumberByDate(new Date(2024, 0, 8)), 2);
});
