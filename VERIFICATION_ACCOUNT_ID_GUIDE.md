# Commissioner verification — account ID guide

Commissioner accepts either a platform account ID when the platform exposes one, or a public username/profile link. Users should never submit passwords, access tokens, private payment information, or login credentials.

## Automatic behavior

- Paste a supported public profile/channel URL into the username or account-ID field.
- Commissioner extracts the public identifier it can safely determine.
- If the user has a connected social OAuth account, Commissioner can automatically use the provider account ID and username stored for that connection.
- For platforms that do not expose a public numeric ID in their normal UI, the public username/profile URL is the correct review identifier.

## Platforms

### YouTube
Open YouTube Studio → Settings → Channel → Advanced settings and copy **Channel ID**. It starts with `UC` and is 24 characters long. Pasting a `/channel/UC...` URL also lets Commissioner extract it.

### Instagram
Instagram normally does not expose a public numeric account ID in the normal app UI. Use the **@username** or paste the public Instagram profile link.

### TikTok
TikTok normally does not expose a public numeric account ID in the normal app UI. Use the **@username** or paste the public TikTok profile link.

### Facebook
For a Page, open **Page transparency** and copy the **Page ID**. You can also paste the Page URL. A `profile.php?id=...` link can be parsed automatically.

### X
Use the **@username** or paste the public X profile URL. A connected X account can supply the provider account ID automatically.

### Twitch
Use the channel username or public channel URL. A connected Twitch account can supply the provider account ID automatically.

### LinkedIn
Paste the public profile or company URL. A connected LinkedIn account can supply the provider account ID automatically.

## Important

The account ID is not the same as a Commissioner account ID. The verification form asks for the **social platform account being verified**. Commissioner should use the platform's public identifier or a securely connected provider identifier.

The verification request is still reviewed by Commissioner. An account ID alone does not prove ownership or guarantee verification.
