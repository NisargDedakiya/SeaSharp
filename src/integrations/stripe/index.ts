// Stripe adapter — reserved for real escrow funding and trade-finance
// disbursement (see docs/04-database-design.md's Finance domain: `payments`,
// `wallets`, `transactions`). Escrow today is modeled and enforced entirely
// at the data layer (src/app/api/rfqs/[id]/award and
// .../escrow/[id]/release) with no live payment processor — award/release
// just move status flags, no money actually moves. Wire a real Stripe
// PaymentIntent/webhook flow here before this goes anywhere near real funds.
export {};
