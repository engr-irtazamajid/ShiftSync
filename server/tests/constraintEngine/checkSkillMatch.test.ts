import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { checkSkillMatch } from "../../src/constraintEngine/rules/checkSkillMatch";
import { buildContext, makeLocation, makeShift, makeUser } from "./fixtures";

describe("checkSkillMatch", () => {
  it("passes when staff has the required skill", () => {
    const skillId = new Types.ObjectId();
    const location = makeLocation();
    const staff = makeUser({ skillIds: [skillId] } as never);
    const shift = makeShift(location, { requiredSkillId: skillId });
    const ctx = buildContext({ staff, shift, location });

    const result = checkSkillMatch(ctx);
    expect(result.violations).toHaveLength(0);
  });

  it("blocks when staff lacks the required skill", () => {
    const location = makeLocation();
    const staff = makeUser({ skillIds: [new Types.ObjectId()] } as never);
    const shift = makeShift(location, { requiredSkillId: new Types.ObjectId() });
    const ctx = buildContext({ staff, shift, location });

    const result = checkSkillMatch(ctx);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe("block");
  });
});
