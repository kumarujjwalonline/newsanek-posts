# NewsAnek – Shorts and Reels

Project brief for any Claude session working on News Anek content. Read this first.

## Goal
Make short vertical news videos (YouTube Shorts and Instagram Reels) for News Anek, and automate making and posting them over time.

## Accounts and tools
- **Instagram:** newsanek24 (Business account linked to the News Anek Facebook Page). Connected through Zapier.
- **Facebook:** News Anek Page, through Zapier (connection: shreemastore@gmail.com).
- **YouTube:** News Anek channel (not yet connected in Zapier).
- **Image hosting:** this repo, `kumarujjwalonline/newsanek-posts` (public). Files under `posts/YYYY-MM-DD/` are served at
  `https://raw.githubusercontent.com/kumarujjwalonline/newsanek-posts/main/posts/...`, which Instagram can fetch.
- **Gemini:** connected through Zapier. Text works; image generation is throttled (free key has no image quota).

## Content rules
- News Anek content is in **Hindi**.
- Every post needs approval before it goes live. The owner wants approval over **WhatsApp** for automated posts.
- Check a story against a second source before publishing.
- Don't use press photos (copyright); use drawn graphics.

## What already works
- 1080×1080 news image posts, drawn in code (navy background, red "breaking" ribbon, yellow highlight bar, icons, red footer).
- Publishing an image post to newsanek24: render image → commit to `posts/` here → Zapier "Publish Photo(s)" with the raw GitHub URL.
- First post published 2026-10-12: Tamil Nadu ₹13,000 crore projects.

## Known issues
- Instagram rejected the location tag "Tamil Nadu, India". Post without a location.
- The cloud workspace can't open raw.githubusercontent.com to check links; the links still work for Instagram.

## Plans mentioned
- A daily n8n workflow: pick the top 10 trending news stories, make a carousel for each, and post to newsanek24 and the News Anek YouTube channel.

## Open questions
- Shorts/Reels format: length, voiceover (voice and language), on-screen text style.
- How many videos a day, and at what time.
