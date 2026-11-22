---
inclusion: always
---

# Audience and positioning

Canonical product positioning: `docs/product/PRODUCT_POSITIONING.md` (read it before any product,
content or messaging work; it is not inlined here because of its length).

## Who we build for

SCAMMAZE serves **two primary audiences with equal weight**:

1. internet users aged 16+ in **Vietnam**, and
2. internet users aged 16+ **everywhere else**.

Secondary: educators and community groups in both. During the hackathon,
Kiroween judges (international, English-speaking) also need a clear demo.

Never design for one audience and "adapt" for the other.

## Rules for content and features

- **Teach the pattern, not the brand.** Core scenarios are built on tactics
  that exist everywhere (urgency, impersonation, too-good-to-be-true, OTP
  requests, off-platform payment, many small steps).
- **No country-specific assumptions in core content:** no real brands,
  currencies, phone or address formats, payment methods or reporting channels
  that only exist in one country. Put those in a region pack (tagged, for
  example `region: "vn"`), and only when asked.
- **Scam content imitates its real target (owner rule, 2026-11-22).** A scam
  in the game must look like the real thing with only a few details wrong,
  because spotting those details is the lesson. If everything is obviously
  fake, the player learns nothing.
  - The scam copies the real organisation's name, logo, layout, tone and the
    shape of its addresses. The legitimate counterpart in the game uses the
    real official address. Example: the real UEH payment site is
    `payment.ueh.edu.vn`, so the scam uses `payment-ueh.vn`.
  - Make the differences small and findable, as real scams do: a hyphen
    instead of a dot, an extra or swapped word, a different TLD (`.vn` for
    `.edu.vn`, `.com` for `.com.vn`), a letter swap (`rn` for `m`), a sender
    display name that matches while the address does not, a fee or deadline
    the real organisation never asks for.
  - Before adding a look-alike domain, check that it does not resolve in DNS
    (`dig +short A <domain>`); pick another if it does, so the game never
    points at someone's real site. Add every real or look-alike domain to
    `apps/game/src/game/narrative/approvedDomains.ts`; the content tests
    reject any other unreserved domain.
  - Content that is not tied to a real target (generic examples, other
    chapters' fictional brands) keeps reserved addresses: `.test`,
    `.example`, `.invalid`, `example.com`, and documentation IPs
    `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`.
  - Phone numbers stay fictional (`+000 ...`): a real-looking number can
    belong to a real person. Never use real credentials, card numbers or
    OTPs.
- **Plain English** that works for non-native readers and for translation:
  short sentences, common words, no idioms or culture-specific references,
  explain acronyms once, complete sentences (no string concatenation).
- **Statistics on the site must cite a source** with a link, use the
  source's own wording, and must not be presented as SCAMMAZE results.
- **Never** blame victims or stereotype a group, and never use fear as the
  main motivator.

When a change would only make sense for one audience, say so in the pull
request and ask before merging.
