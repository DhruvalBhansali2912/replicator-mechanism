# Privacy Policy for InventKid Page Replicator

**Last Updated:** October 18, 2026  
**Effective Date:** October 18, 2026  
**Developer:** InventKid (https://inventkid.com)  
**Contact:** support@inventkid.com  

---

## 1. Introduction & Single Purpose

**InventKid Page Replicator** is a developer and designer productivity extension designed exclusively to deconstruct and clone web components and sections into clean, offline-ready HTML/CSS/JS packages directly from your active browser tab.

We respect your privacy and adhere strictly to the **Google Chrome Web Store Developer Program Policies**, including the **Limited Use requirements** and data minimization principles.

---

## 2. What Information We Process

### A. Data Handled Strictly Locally on Your Device
* **User-Selected Sections:** When you use the interactive Section Picker or click "Replicate", the extension captures the DOM structure and computed styles of the active tab strictly at your request.
* **Extension Preferences & Storage:** The extension uses `chrome.storage.local` to store your License Key, remaining token balance, and configuration options (e.g. mobile emulation toggle, purge unused styles). This data never leaves your device unless you initiate an extraction job.

### B. Data Transmitted to the Server
* **Target Page Assets:** When you click "Replicate", the URL of the page you explicitly choose to clone (and user-selected section HTML and stylesheets) are transmitted over secure HTTPS (`https://replicator.inventkid.com`) to our deconstruction engine to synthesize the clean, offline ZIP archive.
* **Device Identifier:** A randomly generated pseudonymous UUID (`deviceId`) is generated locally upon installation to bind your license key and track your starter token balance. No hardware serial numbers, MAC addresses, or personal identity numbers are ever accessed or collected.
* **Authentication Tokens:** If you activate a license or claim starter credits, a cryptographic API key is transmitted in request headers (`Authorization: Bearer <key>` or `X-API-Key: <key>`) to authorize the extraction.

---

## 3. What Information We DO NOT Collect
* **We DO NOT collect personal browsing history.** We never track, record, or log websites you browse. The extension is completely inert until you explicitly open the popup and click "Replicate" or use the section picker on a specific page.
* **We DO NOT collect personal information (PII).** We do not collect names, credit card numbers, passwords, phone numbers, or social media accounts.
* **We DO NOT sell, rent, or trade your data.** Under no circumstances is user data sold to data brokers, ad networks, or third-party marketing services.
* **We DO NOT use remote code or analytics trackers in the extension.** The extension contains no Google Analytics, Mixpanel, Facebook Pixel, or external telemetry scripts. All client logic is bundled locally.

---

## 4. Permissions & Justification

Every permission requested by **InventKid Page Replicator** is strictly necessary for its core single purpose:

| Permission | Justification |
| :--- | :--- |
| `activeTab` | Grants temporary access to the active webpage only when the user clicks the extension action, allowing the extension to detect the current tab URL and identify sections. |
| `scripting` | Enables programmatic injection of the interactive Section Picker UI (`picker.js`) into the active tab when the user explicitly clicks "Select Section from Page". |
| `storage` | Stores your API license key, remaining token count, and extraction settings locally inside your browser via `chrome.storage.local`. |
| `downloads` | Downloads the synthesized, offline-ready ZIP archive of the replicated page or component directly to your computer when complete. |
| `notifications` | Displays a system notification when background replication has finished, allowing you to click directly to view or download the package. |
| `alarms` | Maintains an internal watchdog timer to resume polling if Chrome suspends the background service worker during lengthy asset localization. |
| `host_permissions` (`*://*/*`) | Required to inspect user-selected pages on any public website you choose to deconstruct, and to fetch cross-origin stylesheets that are otherwise blocked by browser CORS restrictions. |

---

## 5. Data Retention & Security

* **Server Retention:** Replicated packages, previews, and ZIP archives generated on the server are automatically and permanently purged after **7 days** via scheduled cleanup tasks.
* **Transmission Security:** All communication between the extension and backend API is encrypted in transit using industry-standard Transport Layer Security (TLS/HTTPS).
* **Local Storage Erasure:** You can erase all local data and unlink your license key at any time by clicking "Unlink License Key" in the Extension Options page or uninstalling the extension.

---

## 6. Children’s Privacy
Our extension is designed for software developers, designers, and educators. We do not knowingly collect information from children under the age of 13.

---

## 7. Changes to This Privacy Policy
If we make material changes to this policy, we will update the "Last Updated" date at the top of this document and notify users through the extension update notes.

---

## 8. Contact Us
For any privacy questions, data deletion requests, or support inquiries:
* **Website:** https://inventkid.com
* **Email:** support@inventkid.com
