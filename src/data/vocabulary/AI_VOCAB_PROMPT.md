# AI Vocabulary Deck Generator Prompt

Use this prompt with another AI to generate vocabulary cards for the app.

```text
Generate an Anki-style English vocabulary deck for a Ukrainian-speaking learner.
Return ONLY valid JSON. No markdown, no comments.

Schema:
{
  "deck": "Short deck name",
  "level": "A1 | A2 | B1 | B2 | C1 | C2",
  "cards": [
    {
      "word": "English word or phrase",
      "translation": "Ukrainian translation",
      "meaning": "Simple English definition",
      "partOfSpeech": "noun | verb | adjective | phrase | ...",
      "ipa": "/pronunciation/",
      "imageUrl": "https://direct-image-url.jpg",
      "imagePrompt": "Prompt for generating a clear educational image if imageUrl is not available",
      "examples": [
        "Natural example sentence 1.",
        "Natural example sentence 2."
      ],
      "tags": ["topic", "usage"]
    }
  ]
}

Rules:
- Generate 50 cards.
- Use the requested CEFR level only.
- Keep examples short and natural.
- Prefer concrete, imageable words when possible.
- imageUrl must be a direct HTTPS image URL if you provide it.
- If you cannot provide a reliable imageUrl, leave it empty and provide imagePrompt.
- Return valid JSON only.
```

Paste the generated JSON into Settings -> AI Vocabulary Import.
