import { describe, expect, it, vi, beforeEach } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@aws-sdk/client-bedrock-runtime", () => {
  return {
    BedrockRuntimeClient: class {
      send = sendMock;
    },

    ConverseCommand: class {
      input: unknown;

      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

import {
  BedrockService,
} from "./bedrock-service.js";

describe("BedrockService", () => {
  let service: BedrockService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BedrockService();
  });

  it("extracts a valid financial mandate", async () => {
    sendMock.mockResolvedValue({
      output: {
        message: {
          content: [
            {
              text: JSON.stringify({
                label: "Grocery Agent",
                totalBudget: 4000,
                transactionMaximum: 1500,
                currency: "INR",
                allowedMerchants: ["blinkit"],
                blockedMerchants: ["alcohol-store"],
                allowedCategories: ["GROCERY"],
                validityDays: 7,
              }),
            },
          ],
        },
      },
    });

    const result = await service.extractMandate(
      "Give my grocery agent ₹4,000 for 7 days, " +
      "maximum ₹1,500 per transaction, only on Blinkit."
    );

    expect(result).toEqual({
      label: "Grocery Agent",
      totalBudget: 4000,
      transactionMaximum: 1500,
      currency: "INR",
      allowedMerchants: ["blinkit"],
      blockedMerchants: ["alcohol-store"],
      allowedCategories: ["GROCERY"],
      validityDays: 7,
    });
  });

  it("uses empty arrays for omitted rule fields", async () => {
    sendMock.mockResolvedValue({
      output: {
        message: {
          content: [
            {
              text: JSON.stringify({
                label: "Travel Agent",
                totalBudget: 6000,
                currency: "INR",
              }),
            },
          ],
        },
      },
    });

    const result = await service.extractMandate(
      "Give my travel agent ₹6,000."
    );

    expect(result).toEqual({
      label: "Travel Agent",
      totalBudget: 6000,
      currency: "INR",
      allowedMerchants: [],
      blockedMerchants: [],
      allowedCategories: [],
    });
  });

  it("rejects an empty natural-language mandate", async () => {
    await expect(
      service.extractMandate("")
    ).rejects.toThrow(
      "Natural-language mandate is required."
    );

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects an empty Bedrock response", async () => {
    sendMock.mockResolvedValue({
      output: {
        message: {
          content: [],
        },
      },
    });

    await expect(
      service.extractMandate(
        "Give my agent ₹4,000 for groceries."
      )
    ).rejects.toThrow(
      "Bedrock returned an empty mandate response."
    );
  });

  it("rejects malformed Bedrock JSON", async () => {
    sendMock.mockResolvedValue({
      output: {
        message: {
          content: [
            {
              text: "this is not json",
            },
          ],
        },
      },
    });

    await expect(
      service.extractMandate(
        "Give my agent ₹4,000 for groceries."
      )
    ).rejects.toThrow(
      "Bedrock returned invalid JSON for the mandate."
    );
  });

  it("rejects a response without a total budget", async () => {
    sendMock.mockResolvedValue({
      output: {
        message: {
          content: [
            {
              text: JSON.stringify({
                label: "Grocery Agent",
                currency: "INR",
                allowedMerchants: ["blinkit"],
                blockedMerchants: [],
                allowedCategories: ["GROCERY"],
              }),
            },
          ],
        },
      },
    });

    await expect(
      service.extractMandate(
        "Create a grocery mandate."
      )
    ).rejects.toThrow();
  });

  it("does not make an authorization decision", async () => {
    sendMock.mockResolvedValue({
      output: {
        message: {
          content: [
            {
              text: JSON.stringify({
                label: "Grocery Agent",
                totalBudget: 4000,
                currency: "INR",
              }),
            },
          ],
        },
      },
    });

    const result = await service.extractMandate(
      "Give my grocery agent ₹4,000."
    );

    expect(result).not.toHaveProperty("decision");
    expect(result).not.toHaveProperty("reasonCode");
    expect(result).not.toHaveProperty("approved");
    expect(result).not.toHaveProperty("denied");
  });
});
