# Chrome Web Store Submission Guide: InventKid Page Replicator

This document contains all official store listing metadata, reviewer justifications, and developer dashboard disclosures required for 100% compliance with Google Chrome Web Store Developer Program Policies.

---

## 1. Store Metadata

* **Extension Name:** InventKid Page Replicator
* **Short Name:** PageReplicator
* **Version:** 1.0.0
* **Category:** Developer Tools
* **Primary Language:** English
* **Homepage URL:** https://inventkid.com
* **Privacy Policy URL:** https://inventkid.com/privacy (or host `PRIVACY_POLICY.md` on your domain)

### Short Description (Max 132 characters)
> 1-Click website clone and section deconstructor. Downloads 100% offline-fidelity packages directly from your browser.

---

## 2. Detailed Description (Formatted for Chrome Web Store)

```markdown
⚡ Deconstruct and clone any web section or full page into clean, self-contained, offline-ready code in 1 click!

InventKid Page Replicator is the ultimate developer and designer tool for extracting, inspecting, and replicating modern web components. Whether you want to study a sophisticated navigation mega-menu, extract an interactive hero slider, or backup an entire page layout, Page Replicator extracts clean HTML, scoped CSS, and authentic vanilla JavaScript—with zero bloated external runtime dependencies.

🎯 KEY FEATURES:
• Visual Section Picker: Hover and select any component on the active page (Navbar, Hero, Features, Pricing, Testimonials, Footers).
• 100% Offline Asset Localization: Automatically localizes and bundles high-resolution images, SVG icons, fonts, and inline media.
• Cross-Fade Media & Animation Synthesis: Synthesizes pure vanilla ES6 interactive behaviors (expanding carousels, faceted filter dropdowns, tabbed switches, detent sliders, video loops).
• Mobile Emulation Mode: Option to synthesize and deconstruct mobile viewports (e.g., iPhone / 390px) with responsive navigation drawer handling.
• Zero Unused CSS: Intelligent stylesheet purging strips unused global framework rules, keeping your code lean and lightning-fast.
• Instant Download: 1-Click export to a structured, ready-to-run ZIP package with standalone `index.html`, `style.css`, and `script.js`.

🔒 PRIVACY & TRANSPARENCY FIRST:
• No background tracking or browsing history surveillance. The extension only executes when you explicitly click "Replicate" or activate the Section Picker.
• No remotely hosted code or third-party analytics trackers.
• Secure encrypted TLS transmission to our synthesis engine.
• Server-side generated packages are automatically purged after 7 days.

Created by InventKid. Built for professional developers, UI/UX engineers, and web designers.
```

---

## 3. Single Purpose Declaration (For Reviewers)

> **Single Purpose:**
> InventKid Page Replicator serves a single dedicated purpose: deconstructing user-selected web components and pages into clean, standalone, offline-ready HTML, CSS, and JavaScript packages for developer inspection and design replication.

---

## 4. Permission Justifications (Copy into Developer Dashboard)

| Requested Permission | Reason / Justification |
| :--- | :--- |
| **`activeTab`** | Required to identify the URL and DOM context of the currently active tab when the user opens the extension popup, allowing them to initiate extraction of that specific page. |
| **`scripting`** | Required to programmatically inject the interactive Section Picker overlay (`picker.js`) into the active tab when the user clicks "Select Section from Page". |
| **`storage`** | Used to persist user configuration locally (`chrome.storage.local`), including the user's License Key, token balance, and extraction preferences (e.g., mobile emulation, asset localization). |
| **`downloads`** | Required to initiate the automatic download of the synthesized ZIP package directly into the user's browser download folder upon job completion. |
| **`notifications`** | Required to deliver a desktop notification when long-running background page replication has completed, providing a one-click shortcut to the live preview or download. |
| **`alarms`** | Used as a lightweight background watchdog timer to ensure asynchronous job polling resumes reliably if the browser suspends the service worker during heavy asset downloads. |
| **`*://*/*` (`host_permissions`)** | Required because users can choose to replicate public webpages from any domain on the web. Additionally, fetching cross-origin stylesheets referenced by `<link rel="stylesheet">` tags in the background service worker is necessary to bypass browser CORS restrictions during stylesheet localization. |

---

## 5. Privacy & Data Practices Disclosures (In Developer Dashboard)

Select the following answers in the Chrome Web Store **Privacy** tab:

1. **Single Purpose:**
   * Select: *Yes, my extension has a single purpose.*
2. **Permission Justification:**
   * Provide the justifications listed in Section 4 above.
3. **Data Usage / Data Types:**
   * **Location:** *No*
   * **User Activity (Clicks, mouse position, scroll, etc.):** *No (not collected or transmitted)*
   * **Website Content (Text, images, sounds, videos, or hyperlinks):** *Yes*  
     * Justification: *When the user explicitly initiates replication, the HTML and referenced CSS/media assets of that user-selected page are sent to the synthesis server to package into an offline ZIP archive.*
   * **Personal Communications:** *No*
   * **Personally Identifiable Information (Name, email, etc.):** *No*
   * **Authentication Information:** *Yes*  
     * Justification: *The extension stores and transmits the user's API License Key in request headers to authorize extraction requests.*
   * **Financial & Payment Information:** *No*
   * **Health Information:** *No*
4. **Certification:**
   * Check: *I confirm that this extension does not sell user data to third parties.*
   * Check: *I confirm that this extension does not use or transfer user data for purposes unrelated to the item's core functionality.*
   * Check: *I confirm that this extension does not use or transfer user data to determine creditworthiness or for lending purposes.*

---

## 6. Reviewer Testing Instructions (Notes for Chrome Web Store Reviewer)

> **To Reviewer:**  
> 1. Install the extension. It will automatically initialize a trial license key with starter tokens (`trial_...`).
> 2. Navigate to any public webpage (e.g. `https://example.com` or `https://news.ycombinator.com`).
> 3. Click the InventKid Page Replicator extension icon in the toolbar.
> 4. Click **"Select Section from Page"** to test the visual Section Picker. Hover over any block on the page and click it.
> 5. Click **"Replicate (-1 Token)"**. The progress bar will track extraction progress, and upon completion, **"Open Live Preview"** and **"Download Clean ZIP"** will be displayed.
> 6. Alternatively, open the Options page to verify custom server configuration and license management.
