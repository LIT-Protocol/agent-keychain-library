// Well-formed sample credentials per action (test values, not real keys).
export const SAMPLE_CREDENTIALS: Record<string, string> = {
  stripe_balance: "sk_test_abcdefghijklmnopqrstuvwxyz",
  openai_chat: "sk-" + "a".repeat(40),
  github_read_file: "ghp_" + "A".repeat(36),
  slack_post_message: "xoxb-1234567890-abcdefghijkl",
  supabase_tables: JSON.stringify({
    ref: "abcdefghijklmnopqrst",
    key: "sb_secret_" + "k".repeat(40),
    tables: {
      orders: {
        select: ["id", "status", "total_cents", "created_at"],
        filter: ["id", "status"],
        insert: ["status"],
        maxRows: 50,
      },
      notes: { select: ["id", "body"], insert: ["body", "order_id"] },
    },
  }),
};
