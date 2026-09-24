import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // add other tables here

    // tableName: defineTable({
    //   ...
    //   // table fields
    // }).index("by_field", ["field"])

    /*
     * Finance tables.
     *
     * Money is stored as integer paise (₹120.50 → 12050) so totals are exact.
     * Dates are stored twice: `dateKey` ("YYYY-MM-DD", local calendar day —
     * what "today" means to the user) for grouping/filtering, and `occurredAt`
     * (epoch ms) for ordering and time display.
     */
    expenses: defineTable({
      userId: v.id("users"),
      title: v.string(),
      amountPaise: v.number(),
      dateKey: v.string(), // "YYYY-MM-DD" — the day the money was spent
      occurredAt: v.number(), // epoch ms — ordering + time-of-day display
      notes: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user_date", ["userId", "dateKey"])
      .index("by_user", ["userId"]),

    income: defineTable({
      userId: v.id("users"),
      source: v.string(), // Salary | Freelance | Other (free text, validated server-side)
      amountPaise: v.number(),
      dateKey: v.string(),
      occurredAt: v.number(),
      notes: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user_date", ["userId", "dateKey"])
      .index("by_user", ["userId"]),

    /*
     * Summary-only historical months (spec §4): the user may know
     * "income ₹30,000, expenses ₹29,700" without reconstructing every
     * transaction. One row per user per month key "YYYY-MM".
     */
    monthlySummaries: defineTable({
      userId: v.id("users"),
      monthKey: v.string(), // "YYYY-MM"
      totalIncomePaise: v.number(),
      totalExpensePaise: v.number(),
      note: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user_month", ["userId", "monthKey"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
