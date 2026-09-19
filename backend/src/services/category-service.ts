import { categoryRepository, SYSTEM_USER, type Category } from "../store/category-repository.js";

// ─── Seed data ────────────────────────────────────────────────────────────────
// This is the ONLY place categories and their defaults are defined.
// Add new system categories here; they are written to DynamoDB on first use.

export interface CategorySeed {
  slug: string;
  name: string;
  purpose: string;
  merchants: string[];
}

export const SYSTEM_CATEGORY_SEEDS: CategorySeed[] = [
  {
    slug: "groceries",
    name: "Groceries",
    purpose: "Weekly household restocking from approved grocery merchants.",
    merchants: ["Blinkit", "BigBasket", "Zepto", "JioMart", "Swiggy Instamart", "Dunzo", "DMart"],
  },
  {
    slug: "pharmacy-healthcare",
    name: "Pharmacy / Healthcare",
    purpose: "Prescription refills and OTC purchases from approved pharmacies.",
    merchants: ["Apollo Pharmacy", "PharmEasy", "Netmeds", "1mg", "MedPlus", "Tata 1mg"],
  },
  {
    slug: "travel",
    name: "Travel",
    purpose: "Domestic flights, hotels, and intercity travel within the approved scope.",
    merchants: ["MakeMyTrip", "IRCTC", "Indigo", "Cleartrip", "Goibibo", "Yatra", "RedBus", "SpiceJet", "Air India", "OYO"],
  },
  {
    slug: "retail-apparel",
    name: "Retail & apparel",
    purpose: "Approved household and apparel replenishment from allowed retailers.",
    merchants: ["Amazon", "Myntra", "AJIO", "Flipkart", "Nykaa", "Meesho", "Tata Cliq", "Snapdeal"],
  },
  {
    slug: "food-delivery",
    name: "Food delivery",
    purpose: "Meal orders from approved food-delivery providers.",
    merchants: ["Swiggy", "Zomato", "EatFit", "Faasos", "Box8"],
  },
  {
    slug: "utilities",
    name: "Utilities",
    purpose: "Recurring household utility and telecom payments.",
    merchants: ["BESCOM", "Airtel", "Jio", "BSNL", "Tata Power", "MSEDCL", "Adani Electricity", "Vi"],
  },
  {
    slug: "electronics",
    name: "Electronics",
    purpose: "Consumer electronics and appliances from approved retailers.",
    merchants: ["Reliance Digital", "Croma", "Vijay Sales", "Amazon", "Flipkart", "Samsung", "Apple Store", "OnePlus"],
  },
  {
    slug: "fuel-transport",
    name: "Fuel & transport",
    purpose: "Fuel top-ups and local/intercity transport bookings.",
    merchants: ["Ola", "Uber", "Rapido", "HP Petrol", "BPCL", "IOCL", "Indian Oil", "BluSmart"],
  },
  {
    slug: "entertainment",
    name: "Entertainment",
    purpose: "Streaming, gaming, events and entertainment subscriptions.",
    merchants: ["Netflix", "Hotstar", "Amazon Prime", "Sony LIV", "Zee5", "BookMyShow", "JioCinema", "Spotify"],
  },
  {
    slug: "fitness-wellness",
    name: "Fitness & wellness",
    purpose: "Gym memberships, wellness products, and fitness service payments.",
    merchants: ["Cult.fit", "Decathlon", "1mg", "HealthKart", "Noise", "boAt"],
  },
  {
    slug: "education",
    name: "Education",
    purpose: "Online courses, books, and educational platform subscriptions.",
    merchants: ["Udemy", "Coursera", "BYJU'S", "Unacademy", "Vedantu", "Kindle", "Notion"],
  },
  {
    slug: "software-tools",
    name: "Software & tools",
    purpose: "SaaS subscriptions and software licence renewals.",
    merchants: ["Microsoft", "Google", "Adobe", "Notion", "Figma", "Slack", "Zoom", "GitHub", "AWS", "Vercel"],
  },
];

// ─── Flat brand list for NLU hints ────────────────────────────────────────────
// Derived from seeds + extra fintech / payments brands.
// The Gemini transcription prompt reads this list at runtime via the service.

export const EXTRA_BRAND_NAMES: string[] = [
  // Fintech / payments
  "Razorpay", "Paytm", "PhonePe", "CRED", "Jupiter", "Fi Money", "Google Pay",
  "Amazon Pay", "BharatPe", "Cashfree", "Instamojo", "Stripe",
  // Investments
  "Groww", "Zerodha", "Upstox", "INDmoney", "Smallcase", "Navi", "Kite", "Angel One",
  // Banking
  "HDFC Bank", "ICICI Bank", "SBI", "Axis Bank", "Kotak", "IDFC First", "IndusInd",
];

// ─── Service ──────────────────────────────────────────────────────────────────

export class CategoryService {
  /**
   * Return all categories for the user.
   * Seeds system categories into DynamoDB on first call if they are missing.
   */
  async listCategories(userId: string): Promise<Category[]> {
    await this.seedSystemCategories();
    return categoryRepository.listForUser(userId);
  }

  /**
   * Create a new user-owned category.
   * Rejects duplicates and reserved slugs.
   */
  async createCategory(
    userId: string,
    input: { name: string; purpose?: string; merchants?: string[] }
  ): Promise<Category> {
    if (!input.name || input.name.trim().length < 2) {
      throw new Error("Category name must be at least 2 characters.");
    }

    const slug = input.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Reject if slug exists at system level
    const systemExists = await categoryRepository.exists(SYSTEM_USER, slug);
    if (systemExists) {
      throw new Error(`A system category with this name already exists.`);
    }

    // Reject if slug exists at user level
    const userExists = await categoryRepository.exists(userId, slug);
    if (userExists) {
      throw new Error(`You already have a category named "${input.name}".`);
    }

    const category: Omit<Category, "source" | "createdAt"> = {
      slug,
      name: input.name.trim(),
      purpose: input.purpose?.trim() ?? "",
      merchants: input.merchants ?? [],
    };

    await categoryRepository.put(userId, category);

    return {
      ...category,
      source: "user",
      createdAt: new Date().toISOString(),
    };
  }

  /** Delete a user-owned category. System categories cannot be deleted. */
  async deleteCategory(userId: string, slug: string): Promise<void> {
    const systemExists = await categoryRepository.exists(SYSTEM_USER, slug);
    if (systemExists) {
      throw new Error("System categories cannot be deleted.");
    }

    const userExists = await categoryRepository.exists(userId, slug);
    if (!userExists) {
      throw new Error(`Category "${slug}" was not found.`);
    }

    await categoryRepository.delete(userId, slug);
  }

  /**
   * Build the flat canonical brand list for the Gemini NLU prompt.
   * Merges merchant lists from all system seed categories + extra fintech brands.
   * Called at request time so additions to seeds are automatically picked up.
   */
  buildCanonicalBrandList(): string[] {
    const fromSeeds = SYSTEM_CATEGORY_SEEDS.flatMap((s) => s.merchants);
    const all = [...new Set([...fromSeeds, ...EXTRA_BRAND_NAMES])];
    return all;
  }

  // ─── Private: seed system categories ───────────────────────────────────────

  private seeded = false;

  private async seedSystemCategories(): Promise<void> {
    if (this.seeded) return; // in-memory guard — avoids DB check on every request

    for (const seed of SYSTEM_CATEGORY_SEEDS) {
      const exists = await categoryRepository.exists(SYSTEM_USER, seed.slug);
      if (!exists) {
        await categoryRepository.put(SYSTEM_USER, seed);
      }
    }

    this.seeded = true;
  }
}

export const categoryService = new CategoryService();
