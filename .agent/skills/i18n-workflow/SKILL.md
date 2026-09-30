---
name: i18n-workflow
description: >-
  Use this skill whenever generating, adding, or modifying UI components or elements to ensure they are properly localized using next-intl.
---

# i18n Component Workflow

Whenever you add or modify a UI component or element in this ERP system, you MUST extract any user-facing text into our i18n language variables rather than hardcoding it.

## Steps

1. **Identify User-Facing Text**: Find all static text within the new component or element (labels, placeholders, buttons, titles, etc.).
2. **Add to JSON Files**: Open the locale JSON files located in `messages/` (e.g., `messages/en.json`, `messages/ru.json`).
3. **Create Namespaces**: Create a new key or namespace for the component if it doesn't exist (e.g., `"Sidebar": { "title": "Main Menu" }`). Add translations for all supported languages.
4. **Use useTranslations Hook**: 
   - Import `useTranslations` from `next-intl`.
   - Call the hook with the appropriate namespace: `const t = useTranslations('Namespace');`
   - Replace hardcoded text with `t('key')`.

## Guidelines

- Never hardcode strings in JSX.
- If a component is a Server Component, use the `useTranslations` hook just as you would in a Client Component (since `next-intl` supports it in server components without `"use client"`).
- Always ensure both `en.json` and `ru.json` are updated simultaneously to prevent missing keys.
