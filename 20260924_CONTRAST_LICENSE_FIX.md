# Commissioner — verification + contrast correction

## Changes in this pass

1. Business verification no longer mentions or presents license checking.
2. Business verification copy uses business information + authorized representative information.
3. The business verification UI no longer shows a license/registration-license status item; the existing business-information status is presented as **Business information checked**.
4. Corrected the homepage hero contrast shown in the reported screenshot:
   - light homepage background uses dark/navy headline and body text;
   - dark Commissioner preview uses white/light text;
   - the white floating trust card uses dark text.
5. Added a targeted contrast rule so legacy white inline text inside white cards becomes dark without flattening intentional brand pink/cyan colors or dark preview panels.
6. Form inputs, textareas and selects on white surfaces use dark text and readable placeholders.
7. Search/review actions that had white text on a white button were changed to a visible Commissioner magenta action.
8. Kept the prior 50/50 milestone, Explore tabs, UGC onboarding, Admin-only live counts, pinned Commissioner account, and Account Settings verification changes.

## Important

Legacy SQL migration files may still contain old database columns/functions related to historical license-status fields. The live UI and verification presentation in `Site.jsx` do not request, display, or check a business license. Those legacy database fields were not dropped because removing a live database column/function without inspecting the deployed schema could break an existing Supabase installation.

A production build was not claimed as verified in this pass because the ZIP does not include `node_modules` and the previous environment did not have the required Vite dependencies available offline.
