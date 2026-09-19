import type { Request, Response } from "express";
import { categoryService } from "../services/category-service.js";

// ─── GET /v0/categories ───────────────────────────────────────────────────────

export async function listCategoriesHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.sub;
    const categories = await categoryService.listCategories(userId);
    res.status(200).json({ success: true, categories });
  } catch (error) {
    console.error("listCategoriesHandler error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to list categories",
    });
  }
}

// ─── POST /v0/categories ──────────────────────────────────────────────────────

export async function createCategoryHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.sub;
    const { name, purpose, merchants } = req.body ?? {};

    if (!name || typeof name !== "string") {
      res.status(400).json({ success: false, error: "name is required." });
      return;
    }

    const category = await categoryService.createCategory(userId, {
      name,
      purpose: typeof purpose === "string" ? purpose : undefined,
      merchants: Array.isArray(merchants) ? merchants : undefined,
    });

    res.status(201).json({ success: true, category });
  } catch (error) {
    console.error("createCategoryHandler error:", error);
    const message = error instanceof Error ? error.message : "Failed to create category";
    const status = message.includes("already") ? 409 : 400;
    res.status(status).json({ success: false, error: message });
  }
}

// ─── DELETE /v0/categories/:slug ──────────────────────────────────────────────

export async function deleteCategoryHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.sub;
    const slug = req.params.slug;

    if (!slug) {
      res.status(400).json({ success: false, error: "slug is required." });
      return;
    }

    await categoryService.deleteCategory(userId, slug);
    res.status(200).json({ success: true, message: "Category deleted." });
  } catch (error) {
    console.error("deleteCategoryHandler error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete category";
    const status = message.includes("not found") ? 404
      : message.includes("cannot be deleted") ? 403
      : 400;
    res.status(status).json({ success: false, error: message });
  }
}
