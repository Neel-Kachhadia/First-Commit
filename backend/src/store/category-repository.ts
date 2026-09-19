import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamo } from "./dynamodb.js";
import { TABLE_NAME } from "./table.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Category {
  /** URL-safe slug  e.g. "groceries" or "electrical-household" */
  slug: string;
  /** Display name shown in dropdowns  e.g. "Electrical & household" */
  name: string;
  /** Default purpose sentence auto-filled when category is selected */
  purpose: string;
  /** Default merchant list auto-filled when category is selected */
  merchants: string[];
  /** system = built-in (non-deletable)  user = created by this user */
  source: "system" | "user";
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const SYSTEM_USER = "__system__";

// ─── Key helpers ──────────────────────────────────────────────────────────────

function categoryKey(userId: string, slug: string) {
  return { PK: `USER#${userId}`, SK: `CATEGORY#${slug}` };
}

// ─── Repository ──────────────────────────────────────────────────────────────

export class CategoryRepository {
  /** Merge system + user-owned categories, system first, each group alpha-sorted. */
  async listForUser(userId: string): Promise<Category[]> {
    const [system, user] = await Promise.all([
      this.listByOwner(SYSTEM_USER),
      this.listByOwner(userId),
    ]);
    const sort = (arr: Category[]) => arr.sort((a, b) => a.name.localeCompare(b.name));
    return [...sort(system), ...sort(user)];
  }

  private async listByOwner(userId: string): Promise<Category[]> {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":prefix": "CATEGORY#",
        },
      })
    );
    return (result.Items ?? []) as Category[];
  }

  async put(
    userId: string,
    category: Omit<Category, "source" | "createdAt"> & { createdAt?: string }
  ): Promise<void> {
    const now = new Date().toISOString();
    const source: Category["source"] = userId === SYSTEM_USER ? "system" : "user";
    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...categoryKey(userId, category.slug),
          entityType: "CATEGORY",
          ...category,
          source,
          createdAt: category.createdAt ?? now,
        },
      })
    );
  }

  async exists(userId: string, slug: string): Promise<boolean> {
    const result = await dynamo.send(
      new GetCommand({ TableName: TABLE_NAME, Key: categoryKey(userId, slug) })
    );
    return !!result.Item;
  }

  async delete(userId: string, slug: string): Promise<void> {
    await dynamo.send(
      new DeleteCommand({ TableName: TABLE_NAME, Key: categoryKey(userId, slug) })
    );
  }
}

export const categoryRepository = new CategoryRepository();
