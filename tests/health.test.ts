import { healthCheck } from "../src/index";

describe("healthCheck", () => {
  it("should return service status", () => {
    const result = healthCheck();

    expect(result).toEqual({
      status: "ok",
      service: "automatisation-support"
    });
  });
});