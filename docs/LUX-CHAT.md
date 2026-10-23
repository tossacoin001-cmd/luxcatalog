# Lux: a real chat, not a form

Written 2026-10-22. Replaces the "concierge" panel, which opens an enquiry form. The Founder's words: a conversational assistant that pops up with a warm greeting based on the visitor's own time of day, offers questions to tap, answers in real time, understands the brand, confirms listings and availability every time, helps with a booking or a purchase, and finds a product within a budget.

## What the visitor sees

1. **A chat panel**, not a form. It opens with a greeting from the visitor's own clock ("Good morning", "Good afternoon", "Good evening"; their first name if signed in) and one warm question: what are they looking for.
2. **Tappable questions** under the greeting, for example "Find a home to buy", "A shortlet for my dates", "Hire a car", "A private chef this weekend", "Help me stay within a budget", "Speak to a person". On a listing page the chips are about that listing ("Is it free on my dates?", "What is included?").
3. **Answers appear in the conversation** as short text with **cards** (photo, name, price, "free on your dates" or "not free"), each linking to the listing. The chips update after every answer.
4. **Booking and buying**: a card has "Book these dates" (opens the booking panel with the dates already filled; booking still needs sign-in) or "Ask about buying" (sends the conversation to the team).
5. **A person, any time**: "Speak to a person" turns the chat into a short form (name, email) and sends the whole conversation to the team as one enquiry. WhatsApp stays a small plain link.

## What it can and cannot do (the rules)

- **It only ever shows real, published listings.** Cards come from our own matching (the same engine as Discover); the wording can never add an item.
- **Availability is checked every time**, live, for stays, hire, yachts and security on the dates given. If something is not free, Lux says so and offers the nearest similar available item.
- **Prices are shown as stored.** Lux does not invent discounts, fees or terms. Anything it does not know, it says so and offers a person.
- **It understands the brand** from a short, written knowledge base (what we sell, how booking and payment work, cancellation, partners). Anything outside it goes to a person.
- **It never takes payment or personal documents in the chat.** Booking and payment happen on the booking panel, where the existing protections apply.
- **Rate limited** per visitor, with a message cap per conversation, and refuses attempts to make it ignore its rules.
- **Privacy:** the conversation is kept in the visitor's own browser for now. Server-side storage (90 days, with a notice and a delete option, decision D6) comes with the model layer.

## How it is built

- **Now (no model keys needed):** our own rules read the message (what, budget, bedrooms, guests, dates) and answer from the database. This is the part that has to be right, so it is the part with tests.
- **Next (needs Groq and Gemini keys from the Founder):** a model writes friendlier wording and handles open questions, **after** our rules have chosen the listings. If a model is unavailable, our own wording is used, as Discover does today.
- Files: `src/lib/lux-chat.ts` (greeting, tappable questions, reading a message), `src/lib/discover-brief-server.ts` (shared matching and availability), `src/app/api/lux/route.ts`, `src/components/lux/LuxChat.tsx`.

## Tests (written first)

`lux-chat-unit` (greeting by hour, chips, budget, kind, bedrooms, guests and dates from plain text, intent), `lux-chat-e2e` (real listings only, availability, budget limits, safety, rate limit, handoff), `lux-chat-ui` (the panel opens as a chat with a greeting and chips, tapping a chip answers with cards, phone and desktop, no enquiry form).
