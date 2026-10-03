<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
# Rules
- Live events are scraped from public pages listed in src/lib/live-events.functions.ts, extracted by AI, cached in server memory for 1h — no DB needed for the demo.
- Student timetables come from a published Outlook ICS link, parsed server-side and stored in browser localStorage (no login/DB); clashes cut score ×0.1, user can toggle ignore.
- Non-Ember bus times come from the official Scotland Bus Open Data GTFS, pre-extracted into src/lib/bus-timetable.json (St Andrews + Dundee stops, 60-day calendar); regenerate it periodically since the calendar window expires.
- Accounts, preferences, friendships and 'I'm going' live in Lovable Cloud (profiles/friendships/attendance tables); counts and friend lists are read via security-definer RPCs so no identities leak. Sorting/preference nudges live in src/lib/sorting.ts.
- Map venue coordinates: verified table in src/lib/geo.ts → OpenStreetMap Nominatim lookup (server + browser cache, 1 req/s) → town centre flagged 'Approximate location'; never draw distance radii, journey time is the reachability truth.
- Saved activities + what-you-liked reasons live in browser localStorage (src/lib/likes.ts) and nudge ranking ×1.2 for similar items; no login needed.
- Render the Event Spark brand through the shared BrandLogo component so the supplied logo stays consistent across entry points.
